from typing import Any, Iterable

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.api.session_validation import validate_session_identity
from app.core.security import verify_token

# Security schemes
security = HTTPBearer(auto_error=False)


# 1. Dependency: Lấy user hiện tại từ Cookie hoặc Authorization Header
async def get_token_payload(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer(auto_error=False)),
) -> dict:
    """
    Trích xuất và xác thực JWT ưu tiên từ Cookie httponly, fallback sang Bearer Token.
    """
    token = None
    if credentials and credentials.credentials:
        token = credentials.credentials
    if not token:
        token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=(
                "Phiên làm việc hết hạn hoặc không có quyền truy cập. "
                "Vui lòng đăng nhập lại."
            ),
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = verify_token(token)
    if not payload:
        if verify_token(token, expected_purpose="password_change"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Yêu cầu thay đổi mật khẩu",
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Thông tin xác thực không hợp lệ hoặc đã hết hạn.",
        )

    return {
        "id": payload.get("sub"),  # Đây thường là employee_id
        "email": payload.get("email"),
        "role": payload.get("role"),
        "token_version": payload.get("token_version", 1),
        "session_id": payload.get("sid"),
    }


async def get_optional_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer(auto_error=False)),
) -> dict | None:
    """Return the active session user when present, without protecting public routes."""
    token = credentials.credentials if credentials and credentials.credentials else request.cookies.get("access_token")
    if not token:
        return None
    payload = verify_token(token)
    if not payload:
        return None
    candidate = {
        "id": payload.get("sub"),
        "email": payload.get("email"),
        "role": payload.get("role"),
        "token_version": payload.get("token_version", 1),
        "session_id": payload.get("sid"),
    }
    try:
        return await validate_session_identity(candidate)
    except HTTPException:
        return None


def invalidate_auth_cache(employee_id: str) -> None:
    """No-op because account state is read for every request across all workers."""


# 2. Kiểm tra tài khoản còn hoạt động; áp dụng mặc định cho mọi API.
async def get_current_user(
    request: Request, current_user: dict = Depends(get_token_payload)
):
    current_user = await validate_session_identity(current_user)
    session_id = current_user["session_id"]
    request.state.current_user = current_user
    from app.core.security import get_real_client_ip
    from app.modules.activity.service import set_activity_request_context

    set_activity_request_context(
        ip_address=get_real_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        request_id=getattr(request.state, "request_id", None),
        session_id=session_id,
    )

    return current_user


# 2.5. Backward Compatibility cho các router cũ lỡ gọi get_current_active_user
async def get_current_active_user(user: dict = Depends(get_current_user)):
    return user


async def get_current_user_for_password_change(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer(auto_error=False)),
) -> dict:
    """
    Cho phép xác thực bằng access token thông thường HOẶC token đổi mật khẩu tạm thời.
    Dùng riêng cho các endpoint đổi mật khẩu.
    """
    token = None
    if credentials and credentials.credentials:
        token = credentials.credentials
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Phiên làm việc hết hạn. Vui lòng đăng nhập lại.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = verify_token(token) or verify_token(token, expected_purpose="password_change")
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Thông tin xác thực không hợp lệ hoặc đã hết hạn.",
        )
    user_data = {
        "id": payload.get("sub"),
        "email": payload.get("email"),
        "role": payload.get("role"),
        "token_version": payload.get("token_version", 1),
        "session_id": payload.get("sid"),
        "purpose": payload.get("purpose"),
    }
    from app.modules.identity.accounts.service import account_service
    account = await account_service.get_by_account_id(str(user_data["id"]))
    if not account or not account.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tài khoản không tồn tại hoặc đã bị khóa.",
        )
    return {
        **user_data,
        "full_name": getattr(account, "full_name", "") or user_data.get("full_name", ""),
        "account_id": str(account.id),
        "employee_id": str(getattr(account, "employee_id", None) or account.id),
        "role": str(getattr(account.role, "value", account.role)),
    }


# 3. RBAC Checker Class: Kiểm tra quyền truy cập (Role-Based Access Control)
class RoleChecker:
    def __init__(self, allowed_roles: list[Any]):
        self.allowed_roles = {self._normalize(r) for r in allowed_roles}

    def _normalize(self, role: Any) -> str:
        if not role:
            return ""
        if hasattr(role, "value"):
            return str(role.value).upper()
        role_str = str(role)
        if "." in role_str:
            return role_str.split(".")[-1].upper()
        return role_str.upper()

    def __call__(self, user: dict = Depends(get_current_active_user)):
        user_role = user.get("role")
        role_val = self._normalize(user_role)
        if role_val not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Quyền hạn '{user_role}' không được phép thực hiện "
                    "thao tác này."
                ),
            )
        return user


# Website-only compatibility guards. New domain endpoints must prefer
# require_permissions() so individually granted permissions remain authoritative.
require_admin = RoleChecker(["ADMIN", "CEO"])
require_marketing = RoleChecker(["ADMIN", "CEO", "MARKETING"])


class PermissionChecker:
    '''Authorize protected operations from persisted account permissions.'''

    def __init__(self, permissions: Iterable[str], *, require_all: bool = True):
        self.permissions = {str(item).strip() for item in permissions if str(item).strip()}
        self.require_all = require_all

    def __call__(self, user: dict = Depends(get_current_active_user)) -> dict:
        granted = set(user.get('permissions') or [])
        if '*' in granted:
            return user
        allowed = self.permissions.issubset(granted) if self.require_all else bool(self.permissions.intersection(granted))
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    'code': 'PERMISSION_DENIED',
                    'message': 'Tài khoản không có quyền thực hiện thao tác này.',
                    'required_permissions': sorted(self.permissions),
                },
            )
        return user


def require_permissions(*permissions: str, require_all: bool = True) -> PermissionChecker:
    return PermissionChecker(permissions, require_all=require_all)

get_current_ceo = RoleChecker(["CEO", "ADMIN"])
