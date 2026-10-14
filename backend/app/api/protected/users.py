"""
User Management API - Maian Homes 2.0
====================================
Administrative user governance strictly restricted to ADMIN accounts.
Enforces:
- Backend-level role checking (HTTP 403 for non-ADMIN).
- Mass-assignment prevention on self-profile endpoints.
- Explicit invitation issuance after a profile is created.
- Safe admin protections (cannot lock the last active ADMIN).
- Session revocation on credential/status changes.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.api.deps import get_current_user, get_current_user_for_password_change, require_permissions
from app.db.mongodb import get_database
from app.models.user_account import (
    AccountStatus,
    ChangePasswordRequest,
    UserAccountCreateAdmin,
    UserAccountCreatedResponse,
    UserAccountResponse,
    UserAccountUpdateAdmin,
    UserProfileUpdate,
    UserRole,
)
from app.modules.identity.accounts.service import account_service
from app.modules.identity.permissions.catalog import (
    DEFAULT_MARKETING_PERMISSIONS,
    MARKETING_FORBIDDEN_PERMISSIONS,
    WEBSITE_PERMISSIONS,
    normalize_permissions,
)
from app.modules.identity.policies import validate_effective_password
from app.modules.content.media.service import marketing_media_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/website/accounts", tags=["Website Accounts"])

def _format_user_response(doc: dict) -> UserAccountResponse:
    return UserAccountResponse(
        id=str(doc.get("_id")),
        email=doc.get("email", ""),
        full_name=doc.get("full_name", "") or "",
        phone=doc.get("phone"),
        avatar_url=doc.get("avatar_url"),
        role=UserRole.normalize(doc.get("role")),
        permissions=doc.get("permissions", []) or [],
        status=str(doc.get("status", "ACTIVE")),
        is_active=bool(doc.get("is_active", True)),
        must_change_password=bool(doc.get("must_change_password", False)),
        created_at=doc.get("created_at"),
        last_login_at=doc.get("last_login_at"),
    )


# ---------------------------------------------------------------------------
# ADMIN ENDPOINTS (Strictly require_admin)
# ---------------------------------------------------------------------------

@router.get("", response_model=list[UserAccountResponse])
async def list_users(current_user: dict = Depends(require_permissions("website.accounts.read"))):
    """ADMIN ONLY: Liệt kê danh sách tất cả các tài khoản quản trị."""
    db = get_database()
    cursor = db["user_accounts"].find().sort("created_at", -1)
    users = []
    async for doc in cursor:
        users.append(_format_user_response(doc))
    return users


@router.post("", response_model=UserAccountCreatedResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserAccountCreateAdmin,
    current_user: dict = Depends(require_permissions("website.accounts.create")),
):
    """
    ADMIN ONLY: Tạo hồ sơ tài khoản ADMIN hoặc MARKETING ở trạng thái chờ cấp.
    Thao tác này không tạo mật khẩu và không gửi email.
    """
    db = get_database()
    normalized_email = payload.email.strip().lower()

    # 1. Check duplicate email
    existing = await db["user_accounts"].find_one(
        {"$or": [{"normalized_email": normalized_email}, {"email": normalized_email}]}
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Email '{normalized_email}' đã được đăng ký trong hệ thống.",
        )

    now = datetime.now(timezone.utc)
    role_str = UserRole.normalize(payload.role)
    if role_str not in {UserRole.ADMIN.value, UserRole.MARKETING.value}:
        raise HTTPException(status_code=422, detail="Chỉ được tạo tài khoản ADMIN hoặc MARKETING")
    try:
        perms = normalize_permissions(payload.permissions) if payload.permissions else (
            sorted(WEBSITE_PERMISSIONS) if role_str == UserRole.ADMIN.value else DEFAULT_MARKETING_PERMISSIONS
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail={"code": "UNKNOWN_PERMISSIONS", "permissions": exc.args[0]}) from exc

    granted = set(current_user.get("permissions") or [])
    can_manage_permissions = "*" in granted or "website.permissions.manage" in granted
    if role_str == UserRole.ADMIN.value and not can_manage_permissions:
        raise HTTPException(status_code=403, detail={"code": "PERMISSION_DENIED", "required_permissions": ["website.permissions.manage"]})
    if set(perms) != set(DEFAULT_MARKETING_PERMISSIONS) and not can_manage_permissions:
        raise HTTPException(status_code=403, detail={"code": "PERMISSION_DENIED", "required_permissions": ["website.permissions.manage"]})
    if role_str == UserRole.MARKETING.value and set(perms).intersection(MARKETING_FORBIDDEN_PERMISSIONS):
        raise HTTPException(status_code=422, detail={"code": "ROLE_PERMISSION_NOT_ALLOWED", "permissions": sorted(set(perms).intersection(MARKETING_FORBIDDEN_PERMISSIONS))})

    doc = {
        "email": normalized_email,
        "normalized_email": normalized_email,
        "password_hash": "",
        "full_name": payload.full_name.strip(),
        "phone": payload.phone.strip() if payload.phone else None,
        "role": role_str,
        "permissions": perms,
        "status": AccountStatus.PENDING_SETUP.value,
        "is_active": False,
        "is_protected": False,
        "must_change_password": False,
        "token_version": 1,
        "created_by": str(current_user.get("account_id") or current_user.get("id")),
        "created_at": now,
        "updated_at": now,
    }

    result = await db["user_accounts"].insert_one(doc)
    doc["_id"] = result.inserted_id

    return UserAccountCreatedResponse(**_format_user_response(doc).model_dump())


@router.put("/{user_id}", response_model=UserAccountResponse)
async def update_user(
    user_id: str,
    payload: UserAccountUpdateAdmin,
    current_user: dict = Depends(require_permissions("website.accounts.update")),
):
    """
    ADMIN ONLY: Chỉnh sửa thông tin, vai trò, hoặc khóa/mở khóa tài khoản người khác.
    Bảo vệ chống khóa hoặc hạ quyền tài khoản ADMIN đang hoạt động cuối cùng.
    """
    db = get_database()
    if UserRole.normalize(current_user.get("role")) not in {UserRole.CEO.value, UserRole.ADMIN.value}:
        raise HTTPException(status_code=403, detail="Chỉ CEO hoặc Admin được cập nhật tài khoản.")
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ID tài khoản không hợp lệ.")

    target = await db["user_accounts"].find_one({"_id": ObjectId(user_id)})
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy tài khoản.")

    # Guard: Cannot lock or demote the last active ADMIN
    target_role = UserRole.normalize(target.get("role"))
    target_is_protected = target.get("is_protected", False)

    current_id = str(current_user.get("account_id") or current_user.get("id") or "")
    changing_access = payload.role is not None or payload.status is not None or payload.is_active is not None or payload.permissions is not None
    if str(target.get("_id")) == current_id and changing_access:
        raise HTTPException(status_code=403, detail="Không thể tự thay đổi vai trò, trạng thái hoặc quyền của chính mình.")
    if target_role == UserRole.CEO.value and changing_access:
        raise HTTPException(status_code=403, detail="Tài khoản CEO được bảo vệ và không thể thay đổi quyền hoặc trạng thái.")

    granted = set(current_user.get("permissions") or [])
    if payload.permissions is not None and "*" not in granted and "website.permissions.manage" not in granted:
        raise HTTPException(status_code=403, detail={"code": "PERMISSION_DENIED", "required_permissions": ["website.permissions.manage"]})
    if payload.role is not None and "*" not in granted and "website.permissions.manage" not in granted:
        raise HTTPException(status_code=403, detail={"code": "PERMISSION_DENIED", "required_permissions": ["website.permissions.manage"]})
    if (payload.status is not None or payload.is_active is not None) and "*" not in granted and "website.accounts.disable" not in granted:
        raise HTTPException(status_code=403, detail={"code": "PERMISSION_DENIED", "required_permissions": ["website.accounts.disable"]})

    is_demoting_or_locking = False
    protected_roles = {UserRole.ADMIN.value, UserRole.CEO.value}
    if payload.role and UserRole.normalize(payload.role) != target_role and target_role in protected_roles:
        is_demoting_or_locking = True
    if payload.status in (AccountStatus.LOCKED, AccountStatus.DISABLED) or payload.is_active is False:
        if target_role in protected_roles:
            is_demoting_or_locking = True

    if is_demoting_or_locking:
        if target_is_protected:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Không thể khóa hoặc hạ quyền tài khoản ADMIN được bảo vệ của hệ thống.",
            )
        active_admins_count = await db["user_accounts"].count_documents(
            {
                "_id": {"$ne": ObjectId(user_id)},
                "role": {"$in": ["ADMIN", "CEO"]},
                "status": "ACTIVE",
                "is_active": True,
            }
        )
        if active_admins_count == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không thể khóa hoặc hạ quyền tài khoản ADMIN hoạt động cuối cùng.",
            )

    update_fields: dict = {"updated_at": datetime.now(timezone.utc)}
    if payload.full_name is not None:
        full_name = payload.full_name.strip()
        if not full_name:
            raise HTTPException(status_code=422, detail="Họ và tên không được để trống.")
        update_fields["full_name"] = full_name
    if payload.phone is not None:
        update_fields["phone"] = payload.phone.strip()
    if payload.role is not None:
        new_role = UserRole.normalize(payload.role)
        if new_role not in {UserRole.ADMIN.value, UserRole.MARKETING.value}:
            raise HTTPException(status_code=422, detail="Vai trò không hợp lệ")
        update_fields["role"] = new_role
    if payload.permissions is not None:
        try:
            update_fields["permissions"] = normalize_permissions(payload.permissions)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail={"code": "UNKNOWN_PERMISSIONS", "permissions": exc.args[0]}) from exc
    effective_role = UserRole.normalize(payload.role) if payload.role is not None else target_role
    effective_permissions = set(update_fields.get("permissions", target.get("permissions") or []))
    if effective_role == UserRole.MARKETING.value:
        forbidden = effective_permissions.intersection(MARKETING_FORBIDDEN_PERMISSIONS)
        if forbidden:
            raise HTTPException(status_code=422, detail={"code": "ROLE_PERMISSION_NOT_ALLOWED", "permissions": sorted(forbidden)})
    if payload.status is not None:
        update_fields["status"] = payload.status.value
        if payload.status in (AccountStatus.LOCKED, AccountStatus.DISABLED):
            update_fields["is_active"] = False
        elif payload.status == AccountStatus.ACTIVE:
            update_fields["is_active"] = True
    if payload.is_active is not None:
        update_fields["is_active"] = payload.is_active
        if not payload.is_active:
            if payload.status is None:
                update_fields["status"] = AccountStatus.DISABLED.value

    # Every access-policy change invalidates existing sessions consistently.
    # Permission checks use the persisted account on each request, while the
    # token-version bump also prevents the client from retaining stale menus.
    if changing_access:
        update_fields["$inc"] = {"token_version": 1}

    inc_dict = update_fields.pop("$inc", None)
    update_op: dict = {"$set": update_fields}
    if inc_dict:
        update_op["$inc"] = inc_dict

    updated = await db["user_accounts"].find_one_and_update(
        {"_id": ObjectId(user_id)},
        update_op,
        return_document=True,
    )

    return _format_user_response(updated)


@router.post("/{user_id}/avatar", response_model=UserAccountResponse)
async def upload_user_avatar(
    user_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(require_permissions("website.accounts.update")),
):
    if UserRole.normalize(current_user.get("role")) not in {UserRole.CEO.value, UserRole.ADMIN.value}:
        raise HTTPException(status_code=403, detail="Chỉ CEO hoặc Admin được cập nhật ảnh tài khoản.")
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="ID tài khoản không hợp lệ.")
    db = get_database()
    target = await db["user_accounts"].find_one({"_id": ObjectId(user_id)})
    if not target:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản.")
    if file.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=422, detail="Ảnh đại diện chỉ chấp nhận JPEG, PNG hoặc WebP.")
    stored = await marketing_media_service.store(
        "account-avatars", file,
        str(current_user.get("account_id") or current_user.get("id") or "system"),
        5 * 1024 * 1024,
        alt_text=f"Ảnh đại diện {target.get('full_name') or target.get('email') or 'tài khoản'}",
    )
    updated = await db["user_accounts"].find_one_and_update(
        {"_id": ObjectId(user_id)},
        {"$set": {"avatar_url": stored["url"], "avatar_media_id": stored["id"], "updated_at": datetime.now(timezone.utc)}},
        return_document=True,
    )
    await marketing_media_service.sync_account_avatar_reference(user_id, stored["id"])
    return _format_user_response(updated)


@router.post("/{user_id}/revoke-sessions")
async def revoke_user_sessions(
    user_id: str,
    current_user: dict = Depends(require_permissions("website.accounts.disable")),
):
    """ADMIN ONLY: Thu hồi toàn bộ phiên làm việc của tài khoản đích lập tức."""
    db = get_database()
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ID tài khoản không hợp lệ.")

    current_id = str(current_user.get("account_id") or current_user.get("id") or "")
    target_doc = await db["user_accounts"].find_one({"_id": ObjectId(user_id)})
    if not target_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy tài khoản.")
    if user_id == current_id:
        raise HTTPException(status_code=403, detail="Không thể thu hồi phiên của chính mình tại màn hình quản trị.")
    if UserRole.normalize(target_doc.get("role")) == UserRole.CEO.value:
        raise HTTPException(status_code=403, detail="Không thể thu hồi phiên của tài khoản CEO được bảo vệ.")

    target = await db["user_accounts"].find_one_and_update(
        {"_id": ObjectId(user_id)},
        {"$inc": {"token_version": 1}, "$set": {"updated_at": datetime.now(timezone.utc)}},
        return_document=True,
    )
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy tài khoản.")

    # Also mark active sessions revoked in auth_sessions collection
    now = datetime.now(timezone.utc)
    await db["auth_sessions"].update_many(
        {"$or": [{"account_id": user_id}, {"employee_id": user_id}], "revoked_at": None},
        {"$set": {"revoked_at": now, "revoke_reason": "Thu hồi phiên bởi Quản trị viên"}},
    )

    return {
        "success": True,
        "message": f"Đã thu hồi tất cả các phiên đăng nhập của {target.get('email')}.",
        "new_token_version": target.get("token_version"),
    }


# ---------------------------------------------------------------------------
# SELF PROFILE ENDPOINTS (Mass Assignment Protected)
# ---------------------------------------------------------------------------

@router.get("/me/profile", response_model=UserAccountResponse)
async def get_my_profile(current_user: dict = Depends(get_current_user)):
    """Xem thông tin cá nhân của chính mình."""
    db = get_database()
    account_id = current_user.get("account_id") or current_user.get("id")
    if ObjectId.is_valid(account_id):
        doc = await db["user_accounts"].find_one({"_id": ObjectId(account_id)})
    else:
        doc = await db["user_accounts"].find_one({"email": current_user.get("email")})

    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy thông tin tài khoản.")
    return _format_user_response(doc)


@router.put("/me/profile", response_model=UserAccountResponse)
async def update_my_profile(
    payload: UserProfileUpdate,
    current_user: dict = Depends(get_current_user),
):
    """
    Cập nhật thông tin cá nhân của chính mình.
    CHỐNG MASS ASSIGNMENT: Chỉ nhận full_name, phone, avatar_url.
    Tuyệt đối không nhận role, status, permissions hay is_superuser.
    """
    db = get_database()
    if UserRole.normalize(current_user.get("role")) not in {UserRole.CEO.value, UserRole.ADMIN.value}:
        raise HTTPException(status_code=403, detail="Chỉ CEO hoặc Admin được cập nhật tài khoản.")
    account_id = current_user.get("account_id") or current_user.get("id")

    update_fields: dict = {"updated_at": datetime.now(timezone.utc)}
    if payload.full_name is not None:
        update_fields["full_name"] = payload.full_name.strip()
    if payload.phone is not None:
        update_fields["phone"] = payload.phone.strip()
    if payload.avatar_url is not None:
        update_fields["avatar_url"] = payload.avatar_url.strip()

    if ObjectId.is_valid(account_id):
        query = {"_id": ObjectId(account_id)}
    else:
        query = {"email": current_user.get("email")}

    updated = await db["user_accounts"].find_one_and_update(
        query,
        {"$set": update_fields},
        return_document=True,
    )
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy tài khoản.")

    return _format_user_response(updated)


@router.post("/me/change-password")
async def change_my_password(
    payload: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user_for_password_change),
):
    """Đổi mật khẩu tài khoản cá nhân, vô hiệu hóa các phiên cũ và xóa cờ must_change_password."""
    db = get_database()
    account_id = current_user.get("account_id") or current_user.get("id")

    if ObjectId.is_valid(account_id):
        account = await db["user_accounts"].find_one({"_id": ObjectId(account_id)})
    else:
        account = await db["user_accounts"].find_one({"email": current_user.get("email")})

    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy tài khoản.")

    # 1. Verify current password
    if not account_service.verify_password(payload.current_password, account.get("password_hash", "")):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mật khẩu hiện tại không chính xác.")

    # 2. Validate new password complexity
    await validate_effective_password(payload.new_password)

    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu mới không được trùng với mật khẩu cũ.",
        )

    # 3. Hash new password
    new_hash = account_service.hash_password(payload.new_password)
    now = datetime.now(timezone.utc)

    await db["user_accounts"].update_one(
        {"_id": account["_id"]},
        {
            "$set": {
                "password_hash": new_hash,
                "must_change_password": False,
                "password_changed_at": now,
                "updated_at": now,
            },
            "$unset": {
                "temporary_password": "",
                "temporary_password_expires_at": "",
            },
            "$inc": {"token_version": 1},
        },
    )

    return {
        "success": True,
        "message": "Đổi mật khẩu thành công. Vui lòng sử dụng mật khẩu mới cho các lần đăng nhập tiếp theo.",
    }
