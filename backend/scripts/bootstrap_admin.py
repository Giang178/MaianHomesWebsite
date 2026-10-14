# ruff: noqa: E402
"""
Bootstrap Admin - Maian Homes 2.0
=================================
Initializes the first ADMIN account in an empty or new system.
Strict safety rules:
- Fails and refuses to run if an active ADMIN already exists.
- Enforces password complexity policy.
- Does not hardcode plain passwords into code; reads from CLI arguments or environment.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import bcrypt
from pymongo import ASCENDING

from app.core.config import settings
from app.db.mongodb import close_mongo_connection, connect_to_mongo, db_manager
from app.modules.identity.policies import validate_password
from app.modules.identity.service import DEFAULT_POLICY


async def bootstrap_admin(
    email: str | None = None,
    password: str | None = None,
    full_name: str | None = None,
    phone: str | None = None,
) -> dict:
    if db_manager.db is None:
        await connect_to_mongo()
    db = db_manager.db
    if db is None:
        raise RuntimeError("Không thể kết nối đến cơ sở dữ liệu MongoDB.")

    # 1. Resolve credentials
    admin_email = (
        email
        or os.getenv("ADMIN_BOOTSTRAP_EMAIL")
        or os.getenv("CEO_EMAIL")
        or getattr(settings, "CEO_EMAIL", None)
        or "admin@maianhomes.vn"
    ).strip().lower()

    admin_password = (
        password
        or os.getenv("ADMIN_BOOTSTRAP_PASSWORD")
        or os.getenv("CEO_BOOTSTRAP_PASSWORD")
        or getattr(settings, "CEO_BOOTSTRAP_PASSWORD", None)
    )

    if not admin_password:
        raise ValueError(
            "Mật khẩu khởi tạo ADMIN là bắt buộc. Hãy cung cấp qua tham số --password "
            "hoặc biến môi trường ADMIN_BOOTSTRAP_PASSWORD."
        )

    admin_password = admin_password.strip()
    validate_password(admin_password, DEFAULT_POLICY)

    admin_name = (
        full_name
        or os.getenv("ADMIN_BOOTSTRAP_NAME")
        or os.getenv("CEO_FULL_NAME")
        or getattr(settings, "CEO_FULL_NAME", None)
        or "Quản Trị Viên Hệ Thống"
    ).strip()

    admin_phone = (
        phone
        or os.getenv("ADMIN_BOOTSTRAP_PHONE")
        or os.getenv("CEO_PHONE")
        or getattr(settings, "CEO_PHONE", None)
        or "0969105059"
    ).strip()

    # 2. Check if an active ADMIN already exists
    existing_admin = await db["user_accounts"].find_one(
        {
            "$or": [
                {"role": {"$in": ["ADMIN", "CEO"]}},
                {"is_protected": True},
            ],
            "is_active": True,
            "status": "ACTIVE",
        }
    )

    if existing_admin:
        existing_email = existing_admin.get("email")
        print(f"[BOOTSTRAP NOTICE] Hệ thống đã có tài khoản quản trị hoạt động: {existing_email}")
        print("[BOOTSTRAP NOTICE] Từ chối tạo trùng tài khoản ADMIN mới.")
        return {
            "status": "already_exists",
            "account_id": str(existing_admin["_id"]),
            "email": existing_email,
        }

    # 3. Create unique email index if not exists
    await db["user_accounts"].create_index(
        [("normalized_email", ASCENDING)], unique=True, name="uq_account_email"
    )
    await db["user_accounts"].create_index(
        [("email", ASCENDING)], unique=True, name="uq_account_email_raw"
    )

    # 4. Hash password with bcrypt
    salt = bcrypt.gensalt(rounds=12)
    password_hash = bcrypt.hashpw(admin_password.encode("utf-8"), salt).decode("utf-8")

    now = datetime.now(timezone.utc)
    account_doc = {
        "email": admin_email,
        "normalized_email": admin_email,
        "password_hash": password_hash,
        "full_name": admin_name,
        "phone": admin_phone,
        "role": "CEO",
        "permissions": ["*"],
        "status": "ACTIVE",
        "is_active": True,
        "is_protected": True,
        "must_change_password": True,
        "token_version": 1,
        "created_by": "system_bootstrap",
        "created_at": now,
        "updated_at": now,
    }

    result = await db["user_accounts"].insert_one(account_doc)
    account_id = str(result.inserted_id)

    print("================================================================")
    print("   KHỞI TẠO TÀI KHOẢN CEO ĐẦU TIÊN THÀNH CÔNG (MAIAN HOMES 2.0)")
    print("================================================================")
    print(f"ID Tài khoản : {account_id}")
    print(f"Email        : {admin_email}")
    print(f"Họ tên       : {admin_name}")
    print("Vai trò      : CEO (Toàn quyền)")
    print("Trạng thái   : ACTIVE")
    print("================================================================")

    return {
        "status": "created",
        "account_id": account_id,
        "email": admin_email,
    }


def main():
    parser = argparse.ArgumentParser(description="Khởi tạo tài khoản ADMIN đầu tiên cho Maian Homes 2.0")
    parser.add_argument("--email", type=str, help="Email đăng nhập của ADMIN")
    parser.add_argument("--password", type=str, help="Mật khẩu khởi tạo của ADMIN (>= 8 ký tự, hoa, thường, số, ký tự đặc biệt)")
    parser.add_argument("--name", type=str, help="Họ và tên của ADMIN")
    parser.add_argument("--phone", type=str, help="Số điện thoại của ADMIN")

    args = parser.parse_args()

    async def _run():
        try:
            await bootstrap_admin(
                email=args.email,
                password=args.password,
                full_name=args.name,
                phone=args.phone,
            )
        finally:
            await close_mongo_connection()

    asyncio.run(_run())


if __name__ == "__main__":
    main()
