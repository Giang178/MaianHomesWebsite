from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request

from app.api.deps import require_permissions
from app.modules.activity.service import record_activity
from app.modules.website.common.idempotency import execute_mutation_once
from app.modules.system.monitoring.service import monitoring_service
from app.modules.system.settings.schemas import EmailSettingsUpdate, EmailTestRequest
from app.modules.system.settings.service import system_settings_service
from app.core.security import get_real_client_ip
from app.infrastructure.email_delivery import send_email

router = APIRouter(prefix="/website/system/monitoring", tags=["Website System Monitoring"])
email_router = APIRouter(prefix="/website/system/email", tags=["Website Company Email"])


def ensure_system_admin(user: dict) -> None:
    if str(user.get("role")) not in {"CEO", "ADMIN"}:
        raise HTTPException(status_code=403, detail="Chỉ CEO hoặc Admin được cấu hình email công ty.")


@email_router.get("")
async def company_email(current_user: dict = Depends(require_permissions("website.system.email.read"))):
    ensure_system_admin(current_user)
    return await system_settings_service.email()


@email_router.patch("")
async def update_company_email(
    payload: EmailSettingsUpdate,
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
    current_user: dict = Depends(require_permissions("website.system.email.update")),
):
    ensure_system_admin(current_user)
    async def operation():
        return await system_settings_service.update_email(payload.model_dump(), current_user)
    return await execute_mutation_once(
        key=idempotency_key, scope="website-company-email-update", actor=current_user, operation=operation,
    )


@email_router.post("/test")
async def test_company_email(
    request: Request,
    payload: EmailTestRequest,
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
    current_user: dict = Depends(require_permissions("website.system.email.test")),
):
    ensure_system_admin(current_user)
    async def operation():
        config = await system_settings_service.smtp_config()
        if config.get("source") == "database" and int(config.get("version", 1)) != payload.expected_version:
            raise HTTPException(status_code=409, detail={"code": "VERSION_CONFLICT"})
        sent = await send_email(payload.recipient, "[TEST] Maian Homes SMTP", "<p>SMTP Authentication của email công ty đang hoạt động.</p>")
        email_settings = await system_settings_service.email()
        if sent and config.get("source") == "database":
            email_settings = await system_settings_service.mark_verified(payload.expected_version)
        await record_activity(
            "EMAIL_TEST_SENT" if sent else "EMAIL_TEST_FAILED", actor=current_user,
            result="SUCCESS" if sent else "FAILED", target_type="SYSTEM_SETTINGS",
            target_id="company_email", ip_address=get_real_client_ip(request),
            user_agent=request.headers.get("user-agent"),
            metadata={"recipient": payload.recipient, "smtp_host": config["host"], "reason": payload.reason},
        )
        return {"sent": sent, "email_settings": email_settings}
    return await execute_mutation_once(
        key=idempotency_key, scope="website-company-email-test", actor=current_user,
        operation=operation, reclaimable=False,
    )


@router.get("/summary")
async def summary(current_user: dict = Depends(require_permissions("website.system.monitoring.read"))):
    return await monitoring_service.summary()


@router.get("/timeseries")
async def timeseries(hours: int = Query(24, ge=1, le=720), current_user: dict = Depends(require_permissions("website.system.monitoring.read"))):
    return await monitoring_service.timeseries(hours)


@router.post("/checks/run")
async def run_checks(idempotency_key: str = Header(..., alias="Idempotency-Key"), current_user: dict = Depends(require_permissions("website.system.monitoring.run"))):
    async def operation():
        snapshot = await monitoring_service.run()
        await record_activity(
            "SYSTEM_HEALTH_CHECK_RUN", actor=current_user, target_type="SYSTEM_HEALTH",
            target_id=snapshot.get("id"), metadata={"status": snapshot.get("status"), "reason": "Manual health check"},
        )
        return snapshot
    return await execute_mutation_once(
        key=idempotency_key, scope="website-monitoring-run", actor=current_user, operation=operation,
    )
