# ruff: noqa: E402
"""Idempotently bootstrap the clean website-only development database."""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import sys
from datetime import datetime, timezone
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.config import settings
from app.db.mongodb import close_mongo_connection, connect_to_mongo, db_manager
from app.modules.content.common.indexes import ensure_marketing_indexes
from app.modules.identity.indexes import ensure_identity_indexes
from app.modules.identity.permissions.catalog import (
    DEFAULT_MARKETING_PERMISSIONS,
    WEBSITE_PERMISSIONS,
)
from app.modules.identity.service import identity_service
from app.modules.system.common.indexes import ensure_system_indexes
from app.modules.website.branding.constants import (
    DEFAULT_ZALO_OA_ID,
    DEFAULT_ZALO_OA_URL,
)
from app.modules.website.common.indexes import ensure_website_indexes
from scripts.bootstrap_admin import bootstrap_admin

PAGE_KEYS = (
    "home", "about", "contact", "consignment", "projects_index",
    "news_index", "team_index", "recruitment_index", "privacy", "sitemap",
)
MEDIA_SEEDS = {
    "seed-logo-header": ("/images/logo_maian.png", "Logo Maian Homes"),
    "seed-favicon": ("/images/minilogo.png", "Biểu tượng Maian Homes"),
    "seed-home-hero": ("/images/banner_sec1.png", "Banner trang chủ Maian Homes"),
    "seed-about-hero": ("/images/banner.jpg", "Banner giới thiệu Maian Homes"),
    "seed-about-story": ("/images/banner_gioithieu.jpg", "Câu chuyện thương hiệu Maian Homes"),
    "seed-about-culture": ("/images/Global/culture_banner.png", "Văn hóa doanh nghiệp Maian Homes"),
    "seed-consignment-hero": ("/images/banner_Kg.jpg", "Banner ký gửi bất động sản"),
    "seed-recruitment-hero": ("/images/banner_hr.png", "Banner tuyển dụng Maian Homes"),
}
PAGE_CONTENT_SEEDS = {
    "home": {
        "hero_media_id": "seed-home-hero",
        "hero_eyebrow": "Maian Homes",
        "hero_title_line_1": "TƯ VẤN ĐÚNG GIÁ TRỊ",
        "hero_title_line_2": "CHỌN ĐÚNG BẤT ĐỘNG SẢN",
        "hero_description": "Maian Homes - Không bán điều chúng tôi có · Tư vấn điều khách hàng thực sự cần",
        "hero_cta_label": "Khám Phá Dự Án",
        "hero_cta_href": "#du-an",
    },
    "about": {
        "hero_media_id": "seed-about-hero",
        "intro_summary": "Maian Homes cung cấp giải pháp tư vấn bất động sản minh bạch từ mua ở, đầu tư, chuyển nhượng, cho thuê đến quản lý tài sản.",
        "story_media_id": "seed-about-story",
        "story_title": "Câu Chuyện Thương Hiệu",
        "mission_label": "Sứ Mệnh",
        "story_content": "Maian Homes giúp mỗi khách hàng hiểu đúng giá trị và lựa chọn đúng bất động sản thông qua sự thấu hiểu nhu cầu, tư vấn minh bạch và đồng hành có trách nhiệm.",
        "core_eyebrow": "Định hướng",
        "core_title": "Giá Trị Cốt Lõi",
        "core_values": [
            {"id": "core-1", "title": "Chính Trực", "content": "Minh bạch trong thông tin, trung thực trong tư vấn. Lợi ích của khách hàng luôn được đặt trước lợi ích của giao dịch."},
            {"id": "core-2", "title": "Chuyên Nghiệp", "content": "Am hiểu thị trường, hiểu sâu sản phẩm và không ngừng nâng cao năng lực để tư vấn đúng giá trị, đúng nhu cầu."},
            {"id": "core-3", "title": "Tận Tâm", "content": "Lắng nghe để thấu hiểu, tư vấn bằng trách nhiệm và đồng hành như chính tài sản của mình."},
            {"id": "core-4", "title": "Bền Vững", "content": "Maian Homes xây dựng niềm tin, mối quan hệ và giá trị lâu dài với khách hàng, đối tác và đội ngũ."},
        ],
        "culture_media_id": "seed-about-culture",
        "culture_eyebrow": "Môi trường làm việc",
        "culture_title": "Văn Hóa Doanh Nghiệp",
        "culture_content": "Tại Maian Homes, chúng tôi tin rằng sự phát triển bền vững của doanh nghiệp bắt nguồn từ sự phát triển toàn diện của mỗi cá nhân.",
        "culture_values": [
            {"id": "culture-1", "title": "Chính Trực & Chuẩn Mực", "content": "Đề cao tính trung thực và minh bạch trong mọi giao dịch và mối quan hệ với khách hàng, đối tác."},
            {"id": "culture-2", "title": "Học Tập Không Ngừng", "content": "Đào tạo kiến thức thị trường và kỹ năng tư vấn chuyên sâu để đội ngũ luôn đi trước đón đầu xu hướng."},
            {"id": "culture-3", "title": "Gắn Kết & Đồng Lòng", "content": "Tinh thần đoàn kết, sẻ chia và hỗ trợ lẫn nhau tạo nên sức mạnh tập thể vượt trội."},
            {"id": "culture-4", "title": "Năng Động & Sáng Tạo", "content": "Khuyến khích tư duy đổi mới, linh hoạt thích ứng nhanh và duy trì năng lượng tích cực."},
        ],
        "partners_eyebrow": "Đồng hành cùng phát triển",
        "partners_title": "Đối Tác Chiến Lược",
        "philosophy_eyebrow": "Triết lý kinh doanh",
        "philosophy_title": "Ưu Tiên Lợi Ích Khách Hàng",
        "philosophy_quote": "Với định hướng phát triển bền vững, Maian Homes xây dựng uy tín dựa trên giá trị cốt lõi Tâm – Tín, không ngừng nỗ lực mang lại giá trị thực cho khách hàng và đối tác trong từng giao dịch.",
        "philosophy_points": [
            {"id": "philosophy-1", "title": "Người Bạn Đồng Hành", "content": "Maian Homes luôn đặt lợi ích của khách hàng làm trọng tâm và hướng đến vai trò là người bạn đồng hành tin cậy trong lĩnh vực bất động sản."},
            {"id": "philosophy-2", "title": "Đội Ngũ Chuyên Nghiệp", "content": "Đội ngũ tư vấn được đào tạo bài bản, am hiểu thị trường và luôn giữ tinh thần nhiệt huyết."},
            {"id": "philosophy-3", "title": "Đào Tạo Liên Tục", "content": "Công ty chú trọng phát triển đội ngũ thông qua chương trình đào tạo về thị trường, dự án, kỹ năng tư vấn và chuẩn mực nghề nghiệp."},
        ],
    },
    "consignment": {"hero_media_id": "seed-consignment-hero"},
    "recruitment_index": {"hero_media_id": "seed-recruitment-hero"},
}


async def migrate_legacy_idempotency(db) -> int:
    """Archive the old technical collection after copying its records safely."""
    legacy_name = "it_idempotency"
    collection_names = set(await db.list_collection_names())
    if legacy_name not in collection_names:
        return 0

    migrated = 0
    async for document in db[legacy_name].find({}):
        identity = str(document.get("identity") or "").strip()
        if not identity:
            continue
        payload = {key: value for key, value in document.items() if key != "_id"}
        await db["website_idempotency"].update_one(
            {"identity": identity},
            {"$set": payload},
            upsert=True,
        )
        migrated += 1

    archive_name = f"website_idempotency_legacy_archive_{datetime.now(timezone.utc):%Y%m%d%H%M%S}"
    await db[legacy_name].rename(archive_name, dropTarget=False)
    return migrated

async def seed_website(db) -> dict:
    now = datetime.now(timezone.utc)
    for media_id, (public_url, alt_text) in MEDIA_SEEDS.items():
        await db["media_assets"].update_one(
            {"_id": media_id},
            {
                "$set": {
                    "alt_text": alt_text,
                    "lifecycle_status": "ACTIVE",
                    "updated_at": now,
                },
                "$setOnInsert": {
                    "checksum": hashlib.sha256(public_url.encode("utf-8")).hexdigest(),
                    "original_url": public_url,
                    "original_filename": public_url.rsplit("/", 1)[-1],
                    "namespace": "website-seed",
                    "variants": {},
                    "created_by": "system_seed",
                    "created_at": now,
                },
            },
            upsert=True,
        )
    branding = {
        "logo_header_media_id": "seed-logo-header", "logo_footer_media_id": "seed-logo-header",
        "favicon_media_id": "seed-favicon", "default_og_media_id": "seed-home-hero",
        "phone": "0969 10 50 59", "email": "maianhomes.vn@gmail.com",
        "zalo_oa_id": DEFAULT_ZALO_OA_ID, "zalo_url": DEFAULT_ZALO_OA_URL,
        "messenger_url": "https://m.me/MaianHomes",
        "social_links": {}, "header": {}, "footer": {},
    }
    await db["website_settings"].update_one(
        {"_id": "global"},
        {"$setOnInsert": {
            "version": 1, "status": "PUBLISHED", "draft": branding,
            "published_snapshot": branding, "published_at": now,
            "created_at": now, "updated_at": now, "created_by": "system_seed",
        }}, upsert=True,
    )
    created_pages = 0
    for page_key in PAGE_KEYS:
        content = PAGE_CONTENT_SEEDS.get(page_key, {})
        initial_page = {
            "content": content,
            "seo": {},
            "geo": {},
        }
        result = await db["website_pages"].update_one(
            {"page_key": page_key},
            {"$setOnInsert": {
                "page_key": page_key, "version": 1, "published_version": 1,
                "status": "PUBLISHED", "draft": initial_page,
                "published_snapshot": initial_page,
                "published_at": now, "created_at": now, "updated_at": now,
                "created_by": "system_seed", "published_by": "system_seed",
            }}, upsert=True,
        )
        if page_key == "about":
            for key, value in content.items():
                await db["website_pages"].update_one(
                    {"page_key": page_key, f"draft.content.{key}": {"$exists": False}},
                    {"$set": {f"draft.content.{key}": value}},
                )
                await db["website_pages"].update_one(
                    {"page_key": page_key, f"published_snapshot.content.{key}": {"$exists": False}},
                    {"$set": {f"published_snapshot.content.{key}": value}},
                )
        created_pages += int(result.upserted_id is not None)
    return {"pages_created": created_pages, "media_seeded": len(MEDIA_SEEDS)}


async def bootstrap_database(db) -> dict:
    """Create the idempotent website-only baseline in an initialized database."""
    await ensure_system_indexes(db)
    await ensure_website_indexes(db)
    await migrate_legacy_idempotency(db)
    await ensure_identity_indexes(db)
    await ensure_marketing_indexes(db)
    await identity_service.seed_defaults()
    now = datetime.now(timezone.utc)
    await db["permission_presets"].update_one(
        {"_id": "ADMIN"},
        {
            "$set": {
                "permissions": sorted(WEBSITE_PERMISSIONS),
                "updated_at": now,
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    await db["user_accounts"].update_many(
        {"role": "ADMIN"},
        {"$addToSet": {"permissions": {"$each": sorted(WEBSITE_PERMISSIONS)}}},
    )
    await db["permission_presets"].update_one(
        {"_id": "MARKETING"},
        {
            "$set": {
                "permissions": DEFAULT_MARKETING_PERMISSIONS,
                "updated_at": now,
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    await db["user_accounts"].update_many(
        {"role": "MARKETING"},
        {
            "$set": {"permissions": DEFAULT_MARKETING_PERMISSIONS},
            "$pull": {"allowed_paths": {"$in": ["/admin/branding", "/admin/media"]}},
        },
    )
    seed_result = await seed_website(db)
    ceo_result = await bootstrap_admin()
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
    return {
        "database": settings.DATABASE_NAME,
        **seed_result,
        "ceo": ceo_result,
    }


async def run(*, reset: bool = False) -> dict:
    if reset and str(settings.ENVIRONMENT).casefold() in {"production", "prod"}:
        raise RuntimeError("Refusing to reset a production database")
    await connect_to_mongo()
    if reset:
        await db_manager.client.drop_database(settings.DATABASE_NAME)
        db_manager.db = db_manager.client[settings.DATABASE_NAME]
    result = await bootstrap_database(db_manager.db)
    return {"reset": reset, **result}

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true")
    args = parser.parse_args()

    async def execute():
        try:
            print(await run(reset=args.reset))
        finally:
            await close_mongo_connection()

    asyncio.run(execute())


if __name__ == "__main__":
    main()
