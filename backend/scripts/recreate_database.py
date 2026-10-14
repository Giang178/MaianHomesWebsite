"""
Recreate & Seed Database Script - Maian Homes 2.0
=================================================
Initializes a clean, fully populated database with:
- Required indexes & security policies
- Website CMS pages, branding settings & media assets
- Workspace solutions & company knowledge
- 3 core accounts: CEO, ADMIN, MARKETING
- Sample published projects & articles
"""

# Imports below intentionally follow sys.path bootstrap for direct script execution.
# ruff: noqa: E402

from __future__ import annotations

import asyncio
import secrets
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

from app.core.config import settings
from app.db.mongodb import close_mongo_connection, connect_to_mongo, db_manager
from app.modules.identity.indexes import ensure_identity_indexes
from app.modules.identity.permissions.catalog import (
    DEFAULT_MARKETING_PERMISSIONS,
    WEBSITE_PERMISSIONS,
)
from app.modules.identity.policies import validate_password
from app.modules.identity.service import DEFAULT_POLICY, identity_service
from app.modules.content.common.indexes import ensure_marketing_indexes
from app.modules.system.common.indexes import ensure_system_indexes
from app.modules.website.common.indexes import ensure_website_indexes
from scripts.bootstrap_website import migrate_legacy_idempotency, seed_website
from scripts.migrations.seed_company_knowledge_draft import run as seed_company_knowledge
from scripts.migrations.seed_workspace_solutions import seed_workspace_data
from scripts.verify_website_bootstrap import verify_database

ACCOUNTS_CONFIG = [
    {
        "role": "CEO",
        "email": "ceo@maianhomes.vn",
        "full_name": "Tổng Giám Đốc (CEO)",
        "password": secrets.token_urlsafe(18) + "Aa1!",
        "phone": "0969105059",
        "permissions": ["*"],
        "is_protected": True,
    },
    {
        "role": "ADMIN",
        "email": "admin@maianhomes.vn",
        "full_name": "Quản Trị Viên (Admin)",
        "password": secrets.token_urlsafe(18) + "Aa1!",
        "phone": "0969105059",
        "permissions": sorted(WEBSITE_PERMISSIONS),
        "is_protected": False,
    },
    {
        "role": "MARKETING",
        "email": "marketing@maianhomes.vn",
        "full_name": "Chuyên Viên Marketing",
        "password": secrets.token_urlsafe(18) + "Aa1!",
        "phone": "0969105059",
        "permissions": DEFAULT_MARKETING_PERMISSIONS,
        "is_protected": False,
    },
]

SAMPLE_PROJECTS = [
    {
        "name": "The Privé",
        "slug": "the-prive",
        "slogan": "Tuyệt Tác Kiến Trúc Thượng Lưu Bên Dòng Sông",
        "tagline": "Không gian sống chuẩn 5 sao dành cho chủ nhân tinh hoa",
        "description": "The Privé là khu phức hợp căn hộ hạng sang và biệt thự trên không tọa lạc tại vị trí độc tôn ven sông. Dự án được thiết kế theo phong cách hiện đại nhiệt đới, kết hợp hài hòa giữa mảng xanh thiên nhiên rộng lớn và các tiện ích đặc quyền đỉnh cao mang lại trải nghiệm sống resort đích thực.",
        "developer": "Maian Homes & Đối tác chiến lược",
        "location": "Khu Đô Thị Nam Rạch Chiếc, An Phú, TP. Thủ Đức, TP.HCM",
        "location_description": "Vị trí kết nối vàng liền kề Mai Chí Thọ và cao tốc TP.HCM - Long Thành - Dầu Giây, chỉ mất 10 phút đến Thủ Thiêm và Quận 1.",
        "price_range": "Từ 5.5 Tỷ/căn",
        "status": "AVAILABLE",
        "is_published": True,
        "is_featured": True,
        "primary_color": "#1a3a5c",
        "accent_color": "#c9a85c",
        "contact_phone": "0969 10 50 59",
        "contact_email": "ceo@maianhomes.vn",
        "hero_images": [
            "/images/The_Prive/glb1.jpg",
            "/images/The_Prive/glb2.jpg",
            "/images/The_Prive/glb4.jpg",
        ],
        "images": [
            "/images/The_Prive/glb1.jpg",
            "/images/The_Prive/glb2.jpg",
            "/images/The_Prive/glb4.jpg",
        ],
        "location_map_image": "/images/The_Prive/map1.jpg",
        "stats": {
            "Tổng diện tích": "2.8 ha",
            "Mật độ xây dựng": "24%",
            "Quy mô": "3 Tháp căn hộ cao cấp 32 tầng",
            "Tổng số căn": "680 căn hộ & Sky Villas",
            "Pháp lý": "Sở hữu lâu dài",
        },
        "amenities": [
            "Hồ bơi vô cực điện phân muối tầng cao",
            "Bến du thuyền tiêu chuẩn quốc tế",
            "Phòng tiệc Cigar & Wine Lounge sang trọng",
            "Khu công viên ven sông 1.5 ha",
            "Spa, Gym & Yoga chuẩn Wellness",
            "Sảnh đón khách khách sạn 5 sao cao 9m",
        ],
        "highlights": [
            {
                "title": "Vị Trí Độc Tôn Ven Sông",
                "description": "3 mặt giáp sông mang lại không khí trong lành quanh năm và tầm nhìn vĩnh cửu.",
                "icon": "🌊",
                "image": "/images/The_Prive/glb1.jpg",
            },
            {
                "title": "Tiêu Chuẩn Bàn Giao Thượng Hạng",
                "description": "Trang thiết bị nội thất nhập khẩu từ các thương hiệu danh tiếng hàng đầu châu Âu.",
                "icon": "✨",
                "image": "/images/The_Prive/glb2.jpg",
            },
            {
                "title": "Hệ Sinh Thái Tiện Ích Khép Kín",
                "description": "Đặc quyền nghỉ dưỡng ngay thềm nhà với an ninh đa lớp tuyệt đối 24/7.",
                "icon": "🛡️",
                "image": "/images/The_Prive/glb4.jpg",
            },
        ],
    },
    {
        "name": "The Horizon Phú Mỹ Hưng",
        "slug": "the-horizon-phu-my-hung",
        "slogan": "Trái Tim Hồ Bán Nguyệt - Đẳng Cấp Thượng Lưu",
        "tagline": "Dấu ấn biểu tượng bên kỳ quan Crescent Lake",
        "description": "The Horizon Phú Mỹ Hưng là dự án căn hộ hạng sang duy nhất tọa lạc tại trung tâm Khu Hồ Bán Nguyệt (The Crescent), tâm điểm sôi động và danh giá bậc nhất đô thị Phú Mỹ Hưng. Nơi hội tụ cộng đồng cư dân tinh hoa quốc tế cùng tầm nhìn toàn cảnh công viên Ánh Sao tuyệt mỹ.",
        "developer": "Phú Mỹ Hưng & Phân phối bởi Maian Homes",
        "location": "Khu Hồ Bán Nguyệt, Phú Mỹ Hưng, Phường Tân Phú, Quận 7, TP.HCM",
        "location_description": "Trực diện Hồ Bán Nguyệt và Cầu Ánh Sao, liền kề Crescent Mall và Bệnh viện Quốc tế FV.",
        "price_range": "Từ 10 Tỷ/căn",
        "status": "HANDING_OVER",
        "is_published": True,
        "is_featured": True,
        "primary_color": "#1A2530",
        "accent_color": "#D4AF37",
        "contact_phone": "0969 10 50 59",
        "contact_email": "admin@maianhomes.vn",
        "hero_images": [
            "/images/Global/Global01.jpg",
            "/images/Global/Global02.jpg",
        ],
        "images": [
            "/images/Global/Global01.jpg",
            "/images/Global/Global02.jpg",
        ],
        "stats": {
            "Vị trí": "Mặt tiền Hồ Bán Nguyệt",
            "Quy mô": "166 căn hộ độc bản",
            "Bàn giao": "Hoàn thiện cao cấp nhập khẩu",
            "Pháp lý": "Sổ hồng sở hữu lâu dài",
        },
        "amenities": [
            "Hồ bơi vô cực đáy kính view trọn Hồ Bán Nguyệt",
            "Khu BBQ Garden trên không",
            "Phòng Gym hiện đại thiết bị Technogym",
            "Khu vui chơi trẻ em Kid Club trong nhà và ngoài trời",
        ],
    },
    {
        "name": "Grand Marina Saigon",
        "slug": "grand-marina-saigon",
        "slogan": "Bất Động Sản Hàng Hiệu Marriott Lớn Nhất Thế Giới",
        "tagline": "Biểu tượng đỉnh cao phong cách sống thượng lưu tại trung tâm Sài Gòn",
        "description": "Grand Marina, Saigon là khu bất động sản hàng hiệu quy mô lớn nhất thế giới của tập đoàn Marriott International. Tọa lạc tại khu Ba Son lịch sử ngay trung tâm Quận 1, dự án kiến tạo một chuẩn mực sống danh giá với dịch vụ quản lý chuẩn mực quốc tế.",
        "developer": "Masterise Homes & Vận hành bởi JW Marriott",
        "location": "Số 2 Tôn Đức Thắng, Phường Bến Nghé, Quận 1, TP.HCM",
        "location_description": "Vị trí vàng bên bờ sông Sài Gòn, kết nối trực tiếp ga ngầm Metro số 1 Bến Thành - Suối Tiên.",
        "price_range": "Từ 18 Tỷ/căn",
        "status": "COMING_SOON",
        "is_published": True,
        "is_featured": True,
        "primary_color": "#0d1b2a",
        "accent_color": "#e0a96d",
        "contact_phone": "0969 10 50 59",
        "contact_email": "marketing@maianhomes.vn",
        "hero_images": [
            "/images/Global/Global03.jpg",
            "/images/Global/Global04.jpg",
        ],
        "images": [
            "/images/Global/Global03.jpg",
            "/images/Global/Global04.jpg",
        ],
        "stats": {
            "Tổng diện tích": "10 ha ven sông Sài Gòn",
            "Thương hiệu vận hành": "JW Marriott & The Ritz-Carlton",
            "Công viên ven sông": "Lớn nhất trung tâm Quận 1",
            "Bến du thuyền": "Tiêu chuẩn quốc tế",
        },
        "amenities": [
            "Dịch vụ quản gia chuyên nghiệp 24/7 từ Marriott",
            "Hồ bơi vô cực view trực diện bến thuyền sông Sài Gòn",
            "Phòng chiếu phim riêng tư Cinema Room",
            "Thư viện & Business Executive Lounge",
        ],
    },
]

SAMPLE_ARTICLES = [
    {
        "title": "Maian Homes Đồng Hành Cùng Thị Trường Bất Động Sản Cao Cấp 2026",
        "slug": "maian-homes-dong-hanh-bat-dong-san-cao-cap-2026",
        "category": "market",
        "sapo": "Nhận định thị trường bất động sản phân khúc căn hộ hạng sang tại TP.HCM và xu hướng đầu tư bền vững năm 2026.",
        "content": "<p>Năm 2026 đánh dấu bước chuyển mình mạnh mẽ của thị trường bất động sản phân khúc hạng sang. Khách hàng thượng lưu không chỉ tìm kiếm một nơi an cư đẳng cấp mà còn đặc biệt quan tâm đến giá trị bảo chứng tài sản và môi trường sống xanh, bền vững.</p><p>Tại Maian Homes, với triết lý <strong>'Tư Vấn Đúng Giá Trị - Chọn Đúng Bất Động Sản'</strong>, chúng tôi luôn chọn lọc những sản phẩm bất động sản có pháp lý vững vàng, vị trí độc tôn và tiềm năng tăng trưởng vượt trội để giới thiệu đến quý khách hàng.</p>",
        "status": "published",
        "is_published": True,
        "featured_image": "/images/banner.jpg",
        "tags": ["Thị Trường", "Bất Động Sản Cao Cấp", "Maian Homes"],
    },
    {
        "title": "Xu Hướng Sống Chuẩn Wellness & Resort Tại Đô Thị Năm 2026",
        "slug": "xu-huong-song-chuan-wellness-resort-do-thi-2026",
        "category": "project",
        "sapo": "Không gian sống xanh tích hợp tiện ích chăm sóc sức khỏe toàn diện đang trở thành chuẩn mực ưu tiên hàng đầu của giới tinh hoa.",
        "content": "<p>Sự gia tăng của tầng lớp thượng lưu kéo theo yêu cầu khắt khe về chất lượng không gian sống. Những dự án ven sông với mật độ xây dựng thấp, cảnh quan thiên nhiên đa tầng và hệ thống lọc nước, không khí cao cấp luôn nhận được sự quan tâm vượt trội.</p><p>Các dự án như The Privé với hệ tiện ích nghỉ dưỡng khép kín chính là minh chứng rõ nét cho xu hướng an cư tương lai.</p>",
        "status": "published",
        "is_published": True,
        "featured_image": "/images/The_Prive/glb1.jpg",
        "tags": ["Wellness", "Không Gian Sống", "The Privé"],
    },
    {
        "title": "Văn Hóa Doanh Nghiệp & Tinh Thần Phụng Sự Khách Hàng Tại Maian Homes",
        "slug": "van-hoa-doanh-nghiep-phung-su-tai-maian-homes",
        "category": "internal",
        "sapo": "Đội ngũ nhân sự chuyên nghiệp, tận tâm và luôn đặt quyền lợi của khách hàng làm kim chỉ nam trong mọi hoạt động tư vấn.",
        "content": "<p>Không chỉ là nhà cung cấp giải pháp bất động sản, Maian Homes tự hào xây dựng một môi trường làm việc văn minh, nơi mỗi thành viên được đào tạo chuyên sâu về kiến thức thị trường, đạo đức nghề nghiệp và kỹ năng tư vấn giải pháp tài chính toàn diện.</p><p>Chúng tôi tin rằng niềm tin của khách hàng là tài sản quý giá nhất của thương hiệu Maian Homes.</p>",
        "status": "published",
        "is_published": True,
        "featured_image": "/images/Global/culture_banner.png",
        "tags": ["Văn Hóa", "Đội Ngũ", "Maian Homes"],
    },
]


async def recreate_database():
    print("=================================================================")
    print("   KHỞI TẠO LẠI TOÀN BỘ CƠ SỞ DỮ LIỆU MAIAN HOMES 2.0")
    print("=================================================================")

    await connect_to_mongo()
    db = db_manager.db
    now = datetime.now(timezone.utc)

    # 1. Đảm bảo toàn bộ Index hệ thống
    print("\n[1/7] Đang thiết lập hệ thống Index cơ sở dữ liệu...")
    await ensure_system_indexes(db)
    await ensure_website_indexes(db)
    await migrate_legacy_idempotency(db)
    await ensure_identity_indexes(db)
    await ensure_marketing_indexes(db)
    print("  -> Hoàn tất khởi tạo Indexes.")

    # 2. Khởi tạo cấu hình bảo mật Identity & Email Templates
    print("\n[2/7] Khởi tạo Identity Settings & Email Templates...")
    await identity_service.seed_defaults()
    print("  -> Hoàn tất cấu hình chính sách bảo mật & templates.")

    # 3. Phân quyền Permission Presets (ADMIN, MARKETING, CEO)
    print("\n[3/7] Cập nhật nhóm quyền chuẩn (Permission Presets)...")
    await db["permission_presets"].update_one(
        {"_id": "CEO"},
        {
            "$set": {"permissions": ["*"], "name": "Tổng Giám Đốc", "updated_at": now},
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    await db["permission_presets"].update_one(
        {"_id": "ADMIN"},
        {
            "$set": {
                "permissions": sorted(WEBSITE_PERMISSIONS),
                "name": "Quản Trị Viên",
                "updated_at": now,
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    await db["permission_presets"].update_one(
        {"_id": "MARKETING"},
        {
            "$set": {
                "permissions": DEFAULT_MARKETING_PERMISSIONS,
                "name": "Phòng Marketing",
                "updated_at": now,
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    print("  -> Hoàn tất thiết lập quyền CEO, ADMIN, MARKETING.")

    # 4. Khởi tạo Website CMS (Trang chủ, Giới thiệu, Ký gửi, Media, Branding)
    print("\n[4/7] Khởi tạo dữ liệu Website CMS & Branding...")
    website_res = await seed_website(db)
    print(f"  -> CMS Pages & Media: {website_res}")

    # Seed Workspace Solutions (Coworking, Office)
    print("  -> Khởi tạo Dịch vụ Co-working & Văn phòng chia sẻ...")
    await seed_workspace_data()

    # Seed Company Knowledge Draft
    print("  -> Khởi tạo Dữ liệu Tri thức Doanh nghiệp (Company Knowledge)...")
    await seed_company_knowledge(apply=True, database=db)

    # 5. Khởi tạo 3 Tài khoản chuẩn (CEO, ADMIN, MARKETING)
    print("\n[5/7] Khởi tạo 3 tài khoản người dùng theo yêu cầu...")
    created_credentials: list[dict] = []
    for acc in ACCOUNTS_CONFIG:
        validate_password(acc["password"], DEFAULT_POLICY)
        salt = bcrypt.gensalt(rounds=12)
        password_hash = bcrypt.hashpw(acc["password"].encode("utf-8"), salt).decode("utf-8")

        account_doc = {
            "email": acc["email"].strip().lower(),
            "normalized_email": acc["email"].strip().lower(),
            "password_hash": password_hash,
            "full_name": acc["full_name"],
            "phone": acc["phone"],
            "role": acc["role"],
            "permissions": acc["permissions"],
            "status": "ACTIVE",
            "is_active": True,
            "is_protected": acc["is_protected"],
            "must_change_password": True,
            "token_version": 1,
            "created_by": "system_bootstrap",
            "created_at": now,
            "updated_at": now,
        }

        result = await db["user_accounts"].update_one(
            {"normalized_email": acc["email"].strip().lower()},
            {
                "$setOnInsert": account_doc,
                "$set": {
                    "full_name": acc["full_name"],
                    "role": acc["role"],
                    "permissions": acc["permissions"],
                    "is_protected": acc["is_protected"],
                    "updated_at": now,
                },
            },
            upsert=True,
        )
        if result.upserted_id:
            created_credentials.append(acc)
            print(f"  -> Đã tạo tài khoản [{acc['role']}]: {acc['email']}")
        else:
            print(f"  -> Giữ nguyên mật khẩu tài khoản đã tồn tại [{acc['role']}]: {acc['email']}")

    # 6. Seed các Dự án & Bài viết mẫu hiển thị giao diện
    print("\n[6/7] Khởi tạo các Dự án & Tin tức mẫu...")
    for proj in SAMPLE_PROJECTS:
        proj_doc = {
            **proj,
            "version": 1,
            "published_version": 1,
            "publication_status": "PUBLISHED",
            "created_at": now,
            "updated_at": now,
            "published_at": now,
        }
        await db["projects"].update_one(
            {"slug": proj["slug"]},
            {"$set": proj_doc},
            upsert=True,
        )
        print(f"  -> Đã tạo dự án: {proj['name']} ({proj['slug']})")

    for art in SAMPLE_ARTICLES:
        art_doc = {
            **art,
            "version": 1,
            "published_version": 1,
            "author_id": "ceo@maianhomes.vn",
            "created_at": now,
            "updated_at": now,
            "published_at": now,
        }
        await db["articles"].update_one(
            {"slug": art["slug"]},
            {"$set": art_doc},
            upsert=True,
        )
        print(f"  -> Đã tạo tin tức: {art['title']}")

    # 7. Đánh dấu Bootstrap hoàn tất
    print("\n[7/7] Đánh dấu System Bootstrap Complete...")
    await db["system_bootstrap"].update_one(
        {"_id": "current"},
        {
            "$set": {
                "status": "complete",
                "source": "fresh-bootstrap",
                "profile": "website-only-v1",
                "completed_at": datetime.now(timezone.utc),
                "database": settings.DATABASE_NAME,
            }
        },
        upsert=True,
    )

    # 8. Chạy hàm kiểm tra chuẩn hóa
    print("\n[Kiểm Tra] Đang xác thực baseline cơ sở dữ liệu...")
    verify_result = await verify_database(db)
    print(f"  -> Kết quả kiểm tra: ok={verify_result['ok']}")
    if not verify_result["ok"]:
        print(f"  -> Chi tiết lỗi: {verify_result['checks']}")
        raise RuntimeError("Database verification failed")

    print("\n=================================================================")
    print("   KHỞI TẠO CƠ SỞ DỮ LIỆU VÀ CÁC TÀI KHOẢN THÀNH CÔNG RỰC RỠ!")
    print("=================================================================")
    if created_credentials:
        print("Thông tin đăng nhập một lần cho các tài khoản vừa tạo (hãy lưu vào trình quản lý mật khẩu):")
        for acc in created_credentials:
            print(f"• Vai trò : {acc['role']}")
            print(f"  Email   : {acc['email']}")
            print(f"  Mật khẩu tạm: {acc['password']}")
            print("-----------------------------------------------------------------")
    else:
        print("Không tạo tài khoản mới; không có mật khẩu nào bị thay đổi.")


async def main():
    try:
        await recreate_database()
    finally:
        await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main())
