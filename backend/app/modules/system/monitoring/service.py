from __future__ import annotations

import asyncio
import socket
import ssl
import time
from datetime import datetime, timedelta, timezone
from io import BytesIO
from urllib.parse import urlparse
from uuid import uuid4

import httpx

from app.core.config import settings
from app.db.mongodb import get_database
from app.modules.system.settings.service import system_settings_service


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def _http_check(name: str, url: str) -> dict:
    started = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=settings.SYSTEM_MONITOR_TIMEOUT_SECONDS) as client:
            response = await client.get(url)
        latency = round((time.perf_counter() - started) * 1000, 2)
        return {
            "name": name, "status": "HEALTHY" if response.is_success else "DEGRADED",
            "latency_ms": latency, "message": f"HTTP {response.status_code}",
        }
    except Exception as exc:
        return {"name": name, "status": "DOWN", "latency_ms": None, "message": type(exc).__name__}


async def _database_check() -> dict:
    started = time.perf_counter()
    try:
        await get_database().command("ping")
        return {"name": "database", "status": "HEALTHY",
                "latency_ms": round((time.perf_counter() - started) * 1000, 2), "message": "MongoDB ping ok"}
    except Exception as exc:
        return {"name": "database", "status": "DOWN", "latency_ms": None, "message": type(exc).__name__}


async def _email_check() -> dict:
    started = time.perf_counter()
    try:
        import aiosmtplib
        config = await system_settings_service.smtp_config()
        client = aiosmtplib.SMTP(
            hostname=config["host"], port=config["port"],
            start_tls=bool(config.get("start_tls", True)),
            timeout=settings.SYSTEM_MONITOR_TIMEOUT_SECONDS,
        )
        await client.connect()
        await client.login(config["username"], config["password"])
        await client.noop()
        await client.quit()
        return {"name": "company_email", "status": "HEALTHY",
                "latency_ms": round((time.perf_counter() - started) * 1000, 2), "message": "SMTP authenticated"}
    except Exception as exc:
        return {"name": "company_email", "status": "DOWN", "latency_ms": None, "message": type(exc).__name__}


async def _storage_check() -> dict:
    started = time.perf_counter()
    try:
        if not settings.S3_ENABLED:
            return {"name": "uploads", "status": "DEGRADED", "latency_ms": None, "message": "S3/MinIO disabled"}
        from app.infrastructure.object_storage import storage_service
        await storage_service.check_bucket()
        probe_key = f"system-health/probes/{uuid4().hex}.txt"
        try:
            await storage_service.put_fileobj(
                probe_key, BytesIO(b"maian-system-health-probe"), "text/plain"
            )
            if await storage_service.get_bytes(probe_key) != b"maian-system-health-probe":
                raise RuntimeError("Dữ liệu đọc sau khi ghi không khớp")
        finally:
            try:
                await storage_service.delete(probe_key)
            except Exception:
                pass
        return {"name": "uploads", "status": "HEALTHY",
                "latency_ms": round((time.perf_counter() - started) * 1000, 2), "message": "Upload/read/delete ok"}
    except Exception as exc:
        return {"name": "uploads", "status": "DOWN", "latency_ms": None, "message": type(exc).__name__}


async def _domain_check() -> dict:
    domain = settings.SYSTEM_MONITOR_DOMAIN.strip()
    if not domain:
        return {"name": "domain_ssl", "status": "DEGRADED", "latency_ms": None, "message": "Domain not configured"}
    host = urlparse(domain if "://" in domain else f"https://{domain}").hostname or domain
    try:
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, socket.getaddrinfo, host, 443)
        context = ssl.create_default_context()

        def certificate():
            with socket.create_connection((host, 443), timeout=settings.SYSTEM_MONITOR_TIMEOUT_SECONDS) as raw:
                with context.wrap_socket(raw, server_hostname=host) as secure:
                    return secure.getpeercert()

        certificate_data = await loop.run_in_executor(None, certificate)
        expires = datetime.strptime(certificate_data["notAfter"], "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
        days = (expires - utcnow()).days
        return {
            "name": "domain_ssl", "status": "HEALTHY" if days >= 14 else "DEGRADED",
            "latency_ms": None, "message": f"SSL còn {days} ngày", "ssl_expires_at": expires.isoformat(),
        }
    except Exception as exc:
        return {"name": "domain_ssl", "status": "DOWN", "latency_ms": None, "message": type(exc).__name__}


async def _worker_check() -> dict:
    cutoff = utcnow() - timedelta(seconds=settings.WORKER_HEARTBEAT_MAX_AGE_SECONDS)
    workers = await get_database()["system_worker_heartbeats"].find(
        {
            "deployment_tier": settings.DEPLOYMENT_TIER,
            "deployment_instance_id": settings.DEPLOYMENT_INSTANCE_ID,
            "updated_at": {"$gte": cutoff},
            "status": "running",
        }
    ).to_list(None)
    active = {
        str(item.get("worker_name"))
        for item in workers
        if item.get("worker_name")
    }

    expected = {item.strip() for item in settings.SYSTEM_MONITOR_EXPECTED_WORKERS.split(",") if item.strip()}
    if not settings.MARKETING_EMBEDDED_JOBS:
        expected.add("content-worker")
    
    missing = sorted(expected - active)
    return {
        "name": "background_tasks",
        "status": "HEALTHY" if not missing else "DEGRADED",
        "latency_ms": None,
        "message": (
            f"{len(active)} worker đang hoạt động"
            if not missing
            else f"Thiếu heartbeat: {', '.join(missing)}"
        ),
        "workers": sorted(active),
        "missing_workers": missing,
    }


async def _isolated_check(name: str, operation) -> dict:
    try:
        return await operation()
    except Exception as exc:
        return {
            "name": name,
            "status": "DOWN",
            "latency_ms": None,
            "message": type(exc).__name__,
        }


class MonitoringService:
    @property
    def collection(self):
        return get_database()["system_health_snapshots"]

    async def run(self) -> dict:
        allowed = {
            urlparse(settings.SYSTEM_MONITOR_FRONTEND_URL).hostname,
            urlparse(settings.SYSTEM_MONITOR_BACKEND_URL).hostname,
            urlparse(settings.SYSTEM_MONITOR_API_URL).hostname,
        }
        if None in allowed:
            raise RuntimeError("URL giám sát phải là địa chỉ tuyệt đối và nằm trong danh sách cho phép")
        checks = await asyncio.gather(
            _isolated_check(
                "frontend",
                lambda: _http_check("frontend", settings.SYSTEM_MONITOR_FRONTEND_URL),
            ),
            _isolated_check(
                "backend",
                lambda: _http_check("backend", settings.SYSTEM_MONITOR_BACKEND_URL),
            ),
            _isolated_check(
                "api",
                lambda: _http_check("api", settings.SYSTEM_MONITOR_API_URL),
            ),
            _isolated_check("database", _database_check),
            _isolated_check("company_email", _email_check),
            _isolated_check("uploads", _storage_check),
            _isolated_check("background_tasks", _worker_check),
            _isolated_check("domain_ssl", _domain_check),
        )
        now = utcnow()
        healthy = sum(1 for item in checks if item["status"] == "HEALTHY")
        document = {
            "status": "HEALTHY" if healthy == len(checks) else "DEGRADED" if healthy else "DOWN",
            "checks": checks, "generated_at": now, "purge_at": now + timedelta(days=30),
        }
        result = await self.collection.insert_one(document)
        document["id"] = str(result.inserted_id)
        document.pop("_id", None)
        document["generated_at"] = now.isoformat()
        document["purge_at"] = document["purge_at"].isoformat()
        return document

    async def summary(self) -> dict:
        document = await self.collection.find_one(sort=[("generated_at", -1)])
        if not document:
            return await self.run()
        document["id"] = str(document.pop("_id"))
        for key in ("generated_at", "purge_at"):
            if document.get(key):
                document[key] = document[key].isoformat()
        return document

    async def timeseries(self, hours: int) -> dict:
        since = utcnow() - timedelta(hours=hours)
        documents = await self.collection.find(
            {"generated_at": {"$gte": since}}, {"checks": 1, "status": 1, "generated_at": 1}
        ).sort("generated_at", 1).to_list(2000)
        return {"items": [{
            "generated_at": item["generated_at"].isoformat(),
            "status": item["status"],
            "checks": item["checks"],
        } for item in documents]}


monitoring_service = MonitoringService()
