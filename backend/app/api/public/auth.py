import logging
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field

from app.api.deps import get_current_active_user, get_current_user_for_password_change
from app.core.config import settings
from app.core.security import (
    create_access_token,
    get_real_client_ip,
    limiter,
    verify_token,
)
from app.modules.activity.service import record_activity
from app.modules.identity.policies import validate_effective_password
from app.modules.identity.service import identity_service
from app.modules.identity.sessions.service import session_service
from app.models.user_account import UserRole
from app.modules.identity.accounts.service import account_service

router = APIRouter(prefix="/auth", tags=["Authentication"])

PUBLIC_PASSWORD_POLICY_FIELDS = (
    "password_min_length",
    "require_uppercase",
    "require_lowercase",
    "require_digit",
    "require_special",
)


def get_allowed_paths_for_role(role: str, permissions: list[str] | None = None) -> list[str]:
    """Compatibility response derived from persisted permissions, not legacy roles."""
    normalized_role = UserRole.normalize(role)
    if normalized_role not in {item.value for item in UserRole}:
        return []
    granted = set(permissions or [])
    if normalized_role == UserRole.CEO.value:
        granted.add("*")
    if "*" in granted:
        return [
            "/admin", "/admin/accounts", "/admin/workspaces",
            "/admin/content", "/admin/projects",
            "/admin/articles", "/admin/team", "/admin/recruitment", "/admin/leads",
            "/admin/analytics", "/admin/activity", "/admin/branding", "/admin/system",
        ]
    paths: list[str] = []
    mapping = {
        "website.accounts.": "/admin/accounts", "website.pages.": "/admin/content",
        "website.projects.": "/admin/projects", "website.articles.": "/admin/articles",
        "website.staff.": "/admin/team", "website.recruitment.": "/admin/recruitment",
        "website.leads.": "/admin/leads", "website.analytics.": "/admin/analytics",
        "website.audit.": "/admin/activity",
        "website.workspaces.": "/admin/workspaces",
        "website.dashboard.": "/admin",
        "website.system.monitoring.": "/admin/system",
        "website.system.email.": "/admin/system",
        "website.branding.": "/admin/branding",
    }
    for prefix, path in mapping.items():
        if any(item.startswith(prefix) for item in granted):
            paths.append(path)
    return list(dict.fromkeys(paths))


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str | None = None
    email: str
    role: str
    account_id: str
    employee_id: str
    name: str
    phone: str | None = None
    avatar_url: str | None = None
    employee_code: str | None = None
    allowed_paths: list[str] = []
    permissions: list[str] = []
    must_change_password: bool = False
    next_action: str | None = None
    user: dict | None = None


def set_auth_cookie(response: Response, token: str, max_age: int, request: Request | None = None) -> None:
    is_secure = False
    if request:
        proto = (request.headers.get("x-forwarded-proto") or request.url.scheme or "").lower()
        is_secure = (proto == "https")
    response.set_cookie(
        key="access_token", value=token, httponly=True,
        secure=is_secure, samesite="lax",
        max_age=max_age, path="/",
    )


async def login_actor(email: str) -> dict:
    normalized = email.strip().casefold()
    account = await account_service.collection.find_one(
        {"$or": [{"normalized_email": normalized}, {"email": normalized}]},
        {"employee_id": 1, "email": 1, "role": 1},
    )
    return account or {"email": normalized}


async def employee_profile(result: dict) -> tuple[str, str | None, str | None, str | None]:
    return (
        result.get("full_name") or result["email"].split("@")[0],
        result.get("phone"),
        result.get("avatar_url"),
        result.get("employee_code"),
    )


@router.post("/login", response_model=LoginResponse)
@limiter.limit("5/minute")
async def login(request: Request, response: Response, payload: LoginRequest):
    try:
        result = await account_service.authenticate(payload.email, payload.password)
    except HTTPException:
        await record_activity(
            "LOGIN_FAILED", actor=await login_actor(payload.email), result="FAILED",
            ip_address=get_real_client_ip(request), user_agent=request.headers.get("user-agent"),
            metadata={"reason": "ACCOUNT_UNAVAILABLE"},
        )
        raise
    if not result:
        await record_activity(
            "LOGIN_FAILED", actor=await login_actor(payload.email), result="FAILED",
            ip_address=get_real_client_ip(request), user_agent=request.headers.get("user-agent"),
            metadata={"reason": "INVALID_CREDENTIALS"},
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email hoặc mật khẩu không chính xác")
    name, phone, avatar_url, employee_code = await employee_profile(result)
    requires_change = bool(result.get("must_change_password"))
    session = await session_service.create(result, request)
    subject_id = str(result.get("id") or result.get("employee_id"))
    token = create_access_token(
        subject=subject_id, role=result["role"], email=result["email"],
        token_version=result.get("token_version", 1), session_id=session["_id"],
    )
    from bson import ObjectId
    update_filter = {}
    if result.get("id") and ObjectId.is_valid(str(result["id"])):
        update_filter = {"_id": ObjectId(str(result["id"]))}
    elif result.get("employee_id"):
        update_filter = {"employee_id": result["employee_id"]}
    if update_filter:
        await account_service.collection.update_one(
            update_filter, {"$set": {"last_login_at": datetime.now(timezone.utc)}}
        )
    await record_activity(
        "LOGIN_SUCCESS", actor=result, ip_address=session["ip_address"],
        user_agent=session["user_agent"], session_id=session["_id"],
    )
    set_auth_cookie(response, token, settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60, request=request)
    user_info = {
        "id": subject_id,
        "email": result["email"],
        "role": str(getattr(result["role"], "value", result["role"])),
        "name": name,
        "phone": phone,
        "avatar_url": avatar_url,
        "account_id": subject_id,
        "employee_id": str(result.get("employee_id") or subject_id),
        "employee_code": employee_code,
        "allowed_paths": ["/change-password"] if requires_change else get_allowed_paths_for_role(result["role"], result.get("permissions")),
        "permissions": result.get("permissions", []),
        "must_change_password": requires_change,
        "next_action": "CHANGE_PASSWORD" if requires_change else None,
    }
    return LoginResponse(
        access_token=token,
        email=result["email"], role=str(getattr(result["role"], "value", result["role"])),
        account_id=subject_id,
        employee_id=str(result.get("employee_id") or subject_id),
        name=name, phone=phone, avatar_url=avatar_url,
        employee_code=employee_code,
        allowed_paths=["/change-password"] if requires_change else get_allowed_paths_for_role(result["role"], result.get("permissions")),
        permissions=result.get("permissions", []),
        must_change_password=requires_change,
        next_action="CHANGE_PASSWORD" if requires_change else None,
        user=user_info,
    )


@router.post("/logout")
async def logout(request: Request, response: Response):
    raw_token = request.cookies.get("access_token") or ""
    decoded = verify_token(raw_token) or verify_token(
        raw_token, expected_purpose="password_change"
    )
    if decoded and decoded.get("sid"):
        actor = {"id": decoded.get("sub"), "employee_id": decoded.get("sub"),
                 "email": decoded.get("email"), "role": decoded.get("role")}
        await session_service.revoke(decoded["sid"], reason="Người dùng đăng xuất", actor=actor, allow_self=True)
        await record_activity(
            "LOGOUT", actor=actor, ip_address=get_real_client_ip(request),
            user_agent=request.headers.get("user-agent"), session_id=decoded["sid"],
        )
    response.delete_cookie(key="access_token", path="/", secure=settings.ENVIRONMENT == "production", samesite="lax")
    return {"message": "Đã đăng xuất thành công"}


@router.get("/verify")
async def verify(current_user: dict = Depends(get_current_active_user)):
    result = {
        "id": current_user["id"],
        "employee_id": current_user.get("employee_id") or current_user["id"],
        "email": current_user["email"],
        "full_name": current_user.get("full_name"),
        "phone": current_user.get("phone"),
        "avatar_url": current_user.get("avatar_url"),
    }
    name, phone, avatar_url, employee_code = await employee_profile(result)
    role_str = str(getattr(current_user["role"], "value", current_user["role"]))
    return {"status": "valid", "user": {
        "id": current_user["id"],
        "email": current_user["email"],
        "role": role_str,
        "account_id": current_user.get("account_id") or current_user["id"],
        "employee_id": current_user.get("employee_id") or current_user["id"],
        "name": name,
        "phone": phone,
        "avatar_url": avatar_url,
        "employee_code": employee_code,
        "allowed_paths": get_allowed_paths_for_role(current_user["role"], current_user.get("permissions")),
        "permissions": current_user.get("permissions", []),
        "must_change_password": False,
    }}


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class CompleteFirstLoginRequest(BaseModel):
    new_password: str = Field(min_length=8, max_length=128)


@router.get("/password-policy")
async def password_policy():
    policy = await identity_service.get_policy()
    return {field: policy[field] for field in PUBLIC_PASSWORD_POLICY_FIELDS}


@router.post("/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(request: Request, payload: ForgotPasswordRequest):
    from app.modules.identity.invitations.service import invitation_service
    try:
        return await invitation_service.request_reset(payload.email)
    except Exception:
        logging.getLogger(__name__).exception("Password reset request could not be queued")
        return {"message": invitation_service.GENERIC_RESET_RESPONSE}

@router.post("/reset-password")
@limiter.limit("5/minute")
async def reset_password(request: Request, payload: ResetPasswordRequest):
    from app.modules.identity.invitations.service import invitation_service
    return await invitation_service.reset_password(payload.token, payload.new_password)

@router.post("/complete-first-login")
async def complete_first_login(
    request: Request,
    response: Response,
    payload: CompleteFirstLoginRequest,
    current_user: dict = Depends(get_current_user_for_password_change),
):
    account_id = str(current_user.get("account_id") or current_user.get("id") or "")
    query = {"_id": ObjectId(account_id)} if ObjectId.is_valid(account_id) else {
        "email": str(current_user.get("email") or "").strip().casefold()
    }
    account = await account_service.collection.find_one(query)
    if not account:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản.")
    if not account.get("must_change_password"):
        raise HTTPException(status_code=409, detail="Tài khoản không yêu cầu đổi mật khẩu lần đầu.")

    await validate_effective_password(payload.new_password)
    if account_service.verify_password(payload.new_password, account.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Mật khẩu mới không được trùng với mật khẩu tạm.")

    now = datetime.now(timezone.utc)
    updated = await account_service.collection.update_one(
        {**query, "must_change_password": True},
        {
            "$set": {
                "password_hash": account_service.hash_password(payload.new_password),
                "must_change_password": False,
                "password_changed_at": now,
                "updated_at": now,
            },
            "$unset": {"temporary_password": "", "temporary_password_expires_at": ""},
            "$inc": {"token_version": 1},
        },
    )
    if updated.modified_count != 1:
        raise HTTPException(status_code=409, detail="Trạng thái tài khoản đã thay đổi. Vui lòng đăng nhập lại.")
    if current_user.get("session_id"):
        await session_service.revoke(
            str(current_user["session_id"]),
            reason="Hoàn tất đổi mật khẩu lần đầu",
            actor=current_user,
            allow_self=True,
        )
    response.delete_cookie(key="access_token", path="/", samesite="lax")
    return {"success": True, "message": "Đổi mật khẩu thành công. Vui lòng đăng nhập lại."}
