import asyncio
import logging
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pymongo.errors import PyMongoError
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException

# --- Domain Module API Router Imports ---
from app.modules.content.assistant.protected_api import router as ai_router
from app.modules.content.assistant.public_api import router as public_ai
from app.modules.notifications.api import router as protected_notifications
from app.modules.identity.auth.api import router as public_auth
from app.modules.identity.accounts.api import router as protected_users
from app.modules.activity.api import router as protected_activity
from app.modules.website.router import protected_router as protected_website
from app.modules.website.router import public_router as public_website

from app.core.config import settings
from app.core.logging_config import configure_json_logging
from app.core.security import limiter
from app.db.mongodb import close_mongo_connection, connect_to_mongo
from app.api.ws import router as ws_router
# --- Domain Module API Router Imports ---


# Logging Configuration
configure_json_logging()
logger = logging.getLogger("api_diagnostics")

@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.core.notification_bus import (
        start_notification_subscriber,
        stop_notification_subscriber,
    )
    from app.modules.content.jobs.runner import (
        start_marketing_jobs,
        stop_marketing_jobs,
    )
    from app.modules.identity.invitations.worker import start_invitation_loop
    await connect_to_mongo()
    from app.modules.activity.outbox import run_worker as run_activity_outbox
    
    # Pre-import heavy modules during startup to prevent first-request latency spikes in health checks

    activity_outbox_stop = asyncio.Event()
    activity_outbox_task = asyncio.create_task(run_activity_outbox(activity_outbox_stop))
    invitation_task = asyncio.create_task(start_invitation_loop())
    notification_task = start_notification_subscriber()
    # Technical outbox delivery only; no business SLA, expiry, or auto-recall jobs.
    marketing_tasks = start_marketing_jobs() if settings.MARKETING_EMBEDDED_JOBS else []
    yield
    activity_outbox_stop.set()
    invitation_task.cancel()
    
    import contextlib
    with contextlib.suppress(asyncio.CancelledError):
        await invitation_task
        
    with contextlib.suppress(asyncio.CancelledError, asyncio.TimeoutError):
        await activity_outbox_task
    await stop_notification_subscriber(notification_task)
    await stop_marketing_jobs(marketing_tasks)
    await close_mongo_connection()

app = FastAPI(
    title="Maian Homes Enterprise API",
    description="Backend bảo mật cao cấp cho Maian Homes (FastAPI + MongoDB)",
    version=settings.APP_RELEASE,
    lifespan=lifespan
)

# --- Enterprise Grade: Rate Limiting ---
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- Enterprise Grade: Global Exception Handler ---
async def custom_http_exception_handler(request: Request, exc: StarletteHTTPException):
    detail = exc.detail
    if exc.status_code == 409:
        conflict_detail = detail if isinstance(detail, dict) else {"message": str(detail)}
        logger.warning("api_conflict", extra={
            "request_id": getattr(request.state, "request_id", None),
            "path": request.url.path,
            "conflict_code": conflict_detail.get("code", "VERSION_CONFLICT"),
        })
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": detail},
        headers=getattr(exc, "headers", None)
    )

async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    field_translations = {
        "phone": "Số điện thoại",
        "email": "Email",
        "full_name": "Họ và tên",
        "position": "Vị trí chức danh",
        "department": "Phòng ban",
        "password": "Mật khẩu",
        "reason": "Lý do",
    }
    messages = []
    for err in errors:
        loc = err.get("loc", ())
        field_name = loc[-1] if loc else ""
        field_label = field_translations.get(str(field_name), str(field_name))
        msg = err.get("msg", "")
        if "at least" in msg:
            min_len = err.get("ctx", {}).get("min_length", "")
            messages.append(f"{field_label} phải có tối thiểu {min_len} ký tự." if min_len else f"{field_label} chưa đủ độ dài quy định.")
        elif "Field required" in msg or "field required" in msg.lower():
            messages.append(f"Vui lòng điền {field_label}.")
        else:
            messages.append(f"{field_label}: {msg}")
    
    friendly_message = " ".join(messages) if messages else "Dữ liệu đầu vào không hợp lệ"
    return JSONResponse(
        status_code=422,
        content={"detail": jsonable_encoder(errors), "message": friendly_message}
    )

async def global_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, (HTTPException, StarletteHTTPException)):
        return await custom_http_exception_handler(request, exc)
    if isinstance(exc, RequestValidationError):
        return await validation_exception_handler(request, exc)
    if isinstance(exc, PyMongoError):
        logger.warning(
            "database_temporarily_unavailable",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "path": request.url.path,
                "exception_type": type(exc).__name__,
            },
        )
        return JSONResponse(
            status_code=503,
            content={
                "detail": {
                    "code": "DATABASE_UNAVAILABLE",
                    "message": "Cơ sở dữ liệu đang tạm gián đoạn. Vui lòng thử lại sau ít giây.",
                }
            },
            headers={"Retry-After": "2"},
        )
    logger.exception(
        "unhandled_request_error",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "path": request.url.path,
        },
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Máy chủ gặp sự cố kỹ thuật. Vui lòng thử lại sau."}
    )

app.add_exception_handler(StarletteHTTPException, custom_http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, global_exception_handler)


@app.middleware("http")
async def request_context(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
    request.state.request_id = request_id
    from app.core.request_security import mutation_origin_is_allowed
    if not mutation_origin_is_allowed(
        request,
        settings.ALLOWED_ORIGINS,
        enforcement_enabled=settings.CSRF_ORIGIN_ENFORCEMENT,
    ):
        logger.warning(
            "mutation_origin_rejected",
            extra={"request_id": request_id, "path": request.url.path},
        )
        return JSONResponse(
            status_code=403,
            content={"detail": {"code": "ORIGIN_NOT_ALLOWED", "message": "Request origin is not allowed."}},
            headers={"X-Request-ID": request_id},
        )
    from app.modules.activity.service import (
        reset_activity_request_context,
        set_activity_request_context,
    )
    activity_context_token = set_activity_request_context(
        request=request,
        request_id=request_id,
        method=request.method,
        route=request.url.path,
    )
    started = datetime.now(timezone.utc)
    try:
        response = await call_next(request)
    except Exception:
        reset_activity_request_context(activity_context_token)
        raise
    response.headers["X-Request-ID"] = request_id
    elapsed_seconds = (datetime.now(timezone.utc) - started).total_seconds()
    elapsed_ms = int(elapsed_seconds * 1000)
    try:
        from app.core.metrics import observe
        route = getattr(request.scope.get("route"), "path", request.url.path)
        observe(request.method, route, response.status_code, elapsed_seconds)
    except Exception:
        logger.exception("metrics_observation_failed")
    logger.info("request_complete", extra={
        "request_id": request_id,
        "method": request.method,
        "path": request.url.path,
        "status": response.status_code,
        "latency_ms": elapsed_ms,
    })
    actor = getattr(request.state, "current_user", None)
    protected = request.url.path.startswith("/api/protected/")
    exported = "attachment" in response.headers.get("content-disposition", "").casefold()
    business_recorded = getattr(request.state, "activity_business_recorded", False)
    activity_api = request.url.path.startswith("/api/protected/activity-events")
    if actor and protected and not activity_api and not business_recorded and (
        (request.method in {"POST", "PATCH", "PUT", "DELETE"}) or exported
    ):
        from app.core.security import get_real_client_ip
        from app.modules.activity.service import enqueue_event
        event_type = (
            "DATA_EXPORTED" if exported
            else "ROLE_CHANGED" if request.url.path.endswith("/account/role")
            else "API_MUTATION"
        )
        path_parts = [part.upper() for part in request.url.path.split("/") if part]
        module = next((part for part in path_parts if part in {"WEBSITE", "IDENTITY", "MARKETING"}), "SYSTEM")
        result = "DENIED" if response.status_code in {401, 403} else "FAILURE" if response.status_code >= 400 else "SUCCESS"
        try:
            await enqueue_event(
                event_type, module=module, category="DATA_ACCESS" if exported else "DATA_CHANGE",
                actor=actor, result=result, target_type="API_RESOURCE", target_id=request.url.path,
                ip_address=get_real_client_ip(request), user_agent=request.headers.get("user-agent"),
                session_id=actor.get("session_id"), request_id=request_id,
                metadata={"method": request.method, "status_code": response.status_code},
            )
        except Exception:
            logger.exception("activity_fallback_write_failed", extra={"request_id": request_id, "path": request.url.path})
    reset_activity_request_context(activity_context_token)
    return response

# --- Enterprise Grade: Strict CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# --- API Router Inclusion ---
# Public Flow
app.include_router(public_website, prefix="/api/public")
app.include_router(public_auth, prefix="/api/public")
app.include_router(public_ai, prefix="/api/public")

# Protected Flow (Internal Dashboard)
app.include_router(protected_activity, prefix='/api/protected')
app.include_router(protected_website, prefix="/api/protected")
app.include_router(protected_notifications, prefix="/api/protected")
app.include_router(ai_router, prefix="/api/protected")
app.include_router(protected_users, prefix="/api/protected")


# WebSockets
app.include_router(ws_router, prefix="/api/ws")

# Static Files & Uploads (Chỉ mount các thư mục công khai không nhạy cảm)
upload_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), settings.UPLOAD_DIR)
os.makedirs(os.path.join(upload_dir, "avatars"), exist_ok=True)
os.makedirs(os.path.join(upload_dir, "resumes"), exist_ok=True)
os.makedirs(os.path.join(upload_dir, "projects"), exist_ok=True)
os.makedirs(os.path.join(upload_dir, "articles"), exist_ok=True)
app.mount("/uploads/avatars", StaticFiles(directory=os.path.join(upload_dir, "avatars")), name="uploads_avatars")
app.mount("/uploads/projects", StaticFiles(directory=os.path.join(upload_dir, "projects")), name="uploads_projects")
app.mount("/uploads/articles", StaticFiles(directory=os.path.join(upload_dir, "articles")), name="uploads_articles")

@app.get("/")
async def root():
    return {
        "system": "Maian Homes Enterprise API",
        "release": settings.APP_RELEASE,
        "status": "operational",
        "environment": settings.ENVIRONMENT
    }


@app.get("/metrics", include_in_schema=False)
async def metrics(request: Request):
    from app.core.request_security import metrics_access_allowed
    from app.core.metrics import exposition
    if not metrics_access_allowed(
        request, settings.METRICS_ALLOWED_CIDRS, settings.METRICS_TOKEN
    ):
        return JSONResponse(status_code=403, content={"detail": "Metrics access denied."})
    content, media_type = exposition()
    return Response(content=content, media_type=media_type)


@app.get("/health/live", include_in_schema=False)
async def health_live():
    return {"status": "alive"}


@app.get("/health/ready", include_in_schema=False)
async def health_ready():
    from app.db.mongodb import db_manager
    from app.modules.system.settings.service import system_settings_service

    checks = {}
    try:
        await db_manager.db.command("ping")
        checks["mongodb"] = "ok"
    except Exception:
        checks["mongodb"] = "failed"
    try:
        bootstrap = await db_manager.db["system_bootstrap"].find_one(
            {"_id": "current", "status": "complete"}
        )
        checks["database_baseline"] = "ok" if bootstrap else "failed"
    except Exception:
        checks["database_baseline"] = "failed"
    smtp_required = bool(
        settings.ACCOUNT_CREDENTIAL_DELIVERY_ENABLED
        or settings.PASSWORD_RESET_ENABLED
    )
    if smtp_required:
        try:
            await system_settings_service.smtp_config(require_verified=True)
            checks["smtp"] = "ok"
        except Exception:
            checks["smtp"] = "unavailable"
    else:
        checks["smtp"] = "not_required"
    ai_required = (
        settings.GEMINI_REQUIRED
        if settings.AI_PROVIDER == "gemini"
        else settings.OLLAMA_REQUIRED
    )
    if ai_required:
        try:
            from app.infrastructure.ai_runtime import OllamaService

            checks["ai_provider"] = (
                "ok" if await OllamaService.readiness() else "failed"
            )
        except Exception:
            checks["ai_provider"] = "failed"
    if settings.WORKER_HEALTH_REQUIRED:
        cutoff = datetime.now(timezone.utc) - timedelta(
            seconds=settings.WORKER_HEARTBEAT_MAX_AGE_SECONDS
        )
        expected_workers = [
            "activity-worker",
            "content-worker",
            "system-monitor-worker",
        ]
        if smtp_required:
            expected_workers.append("invitation-worker")
        for worker_name in expected_workers:
            try:
                heartbeat = await db_manager.db["system_worker_heartbeats"].find_one(
                    {
                        "worker_name": worker_name,
                        "deployment_tier": settings.DEPLOYMENT_TIER,
                        "deployment_instance_id": settings.DEPLOYMENT_INSTANCE_ID,
                        "status": "running",
                        "updated_at": {"$gte": cutoff},
                    }
                )
                checks[worker_name] = "ok" if heartbeat else "failed"
            except Exception:
                checks[worker_name] = "failed"

    required_checks = {
        key: value
        for key, value in checks.items()
        if key != "smtp" or smtp_required
    }
    ready = all(value == "ok" for value in required_checks.values())
    return JSONResponse(
        status_code=200 if ready else 503,
        content={
            "status": "ready" if ready else "not_ready",
            "environment": settings.ENVIRONMENT,
            "deployment_tier": settings.DEPLOYMENT_TIER,
            "deployment_instance_id": settings.DEPLOYMENT_INSTANCE_ID,
            "release": settings.APP_RELEASE,
            "load_test_marker": (
                settings.LOAD_TEST_TARGET_MARKER
                if settings.DEPLOYMENT_TIER == "staging"
                else ""
            ),
            "checks": checks,
        },
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=settings.API_PORT)
