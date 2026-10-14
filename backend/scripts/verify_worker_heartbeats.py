# ruff: noqa: E402
"""Verify heartbeats from the exact worker containers selected for a release."""

from __future__ import annotations

import argparse
import asyncio
import json
import re
from datetime import datetime, timedelta, timezone

from motor.motor_asyncio import AsyncIOMotorClient

import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.config import settings
from app.core.release_identity import baked_image_revision


def _expectation(value: str) -> tuple[str, str]:
    worker_name, separator, hostname = value.partition("=")
    if (
        not separator
        or not worker_name
        or not hostname
        or not re.fullmatch(r"[a-z0-9-]+", worker_name)
        or not re.fullmatch(r"[A-Za-z0-9_.-]+", hostname)
    ):
        raise argparse.ArgumentTypeError("expectation must be worker-name=hostname")
    return worker_name, hostname


async def _verify(
    expectations: list[tuple[str, str]],
    expected_release: str,
    expected_tier: str,
    expected_instance: str,
    timeout_seconds: int,
) -> int:
    revision = baked_image_revision()
    if settings.APP_RELEASE != expected_release or revision != expected_release:
        print(json.dumps({"status": "invalid", "error_type": "ReleaseMismatch"}))
        return 2
    if settings.DEPLOYMENT_TIER != expected_tier:
        print(json.dumps({"status": "invalid", "error_type": "DeploymentTierMismatch"}))
        return 2
    if settings.DEPLOYMENT_INSTANCE_ID != expected_instance:
        print(
            json.dumps(
                {"status": "invalid", "error_type": "DeploymentInstanceMismatch"}
            )
        )
        return 2

    client = AsyncIOMotorClient(
        settings.MONGODB_URL,
        tz_aware=True,
        serverSelectionTimeoutMS=settings.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
        connectTimeoutMS=settings.MONGODB_CONNECT_TIMEOUT_MS,
        socketTimeoutMS=settings.MONGODB_SOCKET_TIMEOUT_MS,
    )
    collection = client[settings.DATABASE_NAME]["system_worker_heartbeats"]
    deadline = asyncio.get_running_loop().time() + timeout_seconds
    try:
        while True:
            cutoff = datetime.now(timezone.utc) - timedelta(
                seconds=settings.WORKER_HEARTBEAT_MAX_AGE_SECONDS
            )
            verified: list[dict[str, str]] = []
            missing: list[str] = []
            for worker_name, hostname in expectations:
                heartbeat = await collection.find_one(
                    {
                        "worker_name": worker_name,
                        "instance_id": {"$regex": f"^{re.escape(hostname)}-"},
                        "release": expected_release,
                        "image_revision": expected_release,
                        "deployment_tier": expected_tier,
                        "deployment_instance_id": expected_instance,
                        "status": "running",
                        "updated_at": {"$gte": cutoff},
                    },
                    projection={
                        "_id": 0,
                        "worker_name": 1,
                        "instance_id": 1,
                        "updated_at": 1,
                    },
                )
                if not heartbeat:
                    missing.append(worker_name)
                    continue
                verified.append(
                    {
                        "worker_name": worker_name,
                        "instance_id": str(heartbeat["instance_id"]),
                        "updated_at": heartbeat["updated_at"].isoformat(),
                    }
                )
            if not missing:
                print(
                    json.dumps(
                        {
                            "status": "valid",
                            "release": expected_release,
                            "deployment_tier": expected_tier,
                            "deployment_instance_id": expected_instance,
                            "workers": verified,
                        },
                        sort_keys=True,
                    )
                )
                return 0
            if asyncio.get_running_loop().time() >= deadline:
                print(
                    json.dumps(
                        {
                            "status": "invalid",
                            "error_type": "WorkerHeartbeatTimeout",
                            "missing_workers": sorted(missing),
                        },
                        sort_keys=True,
                    )
                )
                return 2
            await asyncio.sleep(2)
    except Exception as exc:  # noqa: BLE001 - release evidence must be redacted
        print(
            json.dumps(
                {"status": "invalid", "error_type": type(exc).__name__},
                sort_keys=True,
            )
        )
        return 2
    finally:
        client.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--expect", action="append", required=True, type=_expectation)
    parser.add_argument("--expected-release", required=True)
    parser.add_argument(
        "--expected-tier", required=True, choices=("production", "staging")
    )
    parser.add_argument("--expected-instance", required=True)
    parser.add_argument("--timeout-seconds", type=int, default=90)
    args = parser.parse_args()
    if not 10 <= args.timeout_seconds <= 180:
        parser.error("--timeout-seconds must be between 10 and 180")
    worker_names = [worker_name for worker_name, _ in args.expect]
    if len(set(worker_names)) != len(worker_names):
        parser.error("--expect worker names must be unique")
    return asyncio.run(
        _verify(
            args.expect,
            args.expected_release,
            args.expected_tier,
            args.expected_instance,
            args.timeout_seconds,
        )
    )


if __name__ == "__main__":
    raise SystemExit(main())
