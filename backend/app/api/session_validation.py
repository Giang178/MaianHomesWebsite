import asyncio

from fastapi import HTTPException, status

from app.modules.identity.sessions.service import session_service
from app.modules.identity.accounts.service import account_service


async def validate_session_identity(current_user: dict) -> dict:
    """Validate account state, token generation and the persisted login session."""
    user_id = str(current_user.get("id") or "")
    token_version = int(current_user.get("token_version", 1))
    session_id = current_user.get("session_id")
    if not user_id or not session_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Phiên đăng nhập không hợp lệ.",
        )

    account, _session = await asyncio.gather(
        account_service.get_by_employee_id(user_id),
        session_service.validate(str(session_id), user_id, token_version),
    )
    if not account:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tài khoản của bạn không tồn tại hoặc đã bị xóa.",
        )

    raw_status = getattr(account, "status", None) or getattr(account, "account_status", "ACTIVE")
    account_status = raw_status.value if hasattr(raw_status, "value") else str(raw_status)
    database_token_version = int(getattr(account, "token_version", 1))
    if (
        not account.is_active
        or account_status != "ACTIVE"
        or database_token_version != token_version
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tài khoản đã bị khóa hoặc phiên đăng nhập đã hết hạn.",
        )

    if bool(getattr(account, "must_change_password", False)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "PASSWORD_CHANGE_REQUIRED", "message": "Yêu cầu thay đổi mật khẩu lần đầu."},
        )

    role_str = getattr(account.role, "value", account.role)
    return {
        'permissions': list(getattr(account, 'permissions', []) or []),
        **current_user,
        "role": role_str,
        "full_name": getattr(account, "full_name", "") or current_user.get("full_name", ""),
        "account_id": str(account.id),
        "employee_id": str(account.employee_id) if getattr(account, "employee_id", None) else str(account.id),
    }
