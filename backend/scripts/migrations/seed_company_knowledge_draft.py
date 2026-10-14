"""Create the initial Company Knowledge draft without publishing it."""
from __future__ import annotations

import argparse
import asyncio
from datetime import datetime, timezone

from app.db.mongodb import close_mongo_connection, connect_to_mongo, db_manager

MIGRATION_ID = "2026-08-company-knowledge-draft-v1"

INITIAL_DRAFT = {
    "company_name": "Maian Homes",
    "overview": (
        "Maian Homes cung cấp các giải pháp tư vấn bất động sản từ mua ở, đầu tư đến chuyển nhượng, "
        "cho thuê và quản lý tài sản. Đội ngũ hướng đến tư vấn minh bạch, lựa chọn đúng tài sản "
        "và đồng hành có trách nhiệm với khách hàng."
    ),
    "services": [
        "Tư vấn và môi giới bất động sản",
        "Tư vấn đầu tư bất động sản",
        "Quản lý và vận hành tài sản",
    ],
    "service_areas": ["TP. Hồ Chí Minh"],
    "working_hours": "Thứ Hai - Thứ Bảy, 08:30 - 17:30",
    "consultation_process": [
        "Tiếp nhận nhu cầu và mục tiêu của khách hàng",
        "Đối chiếu thông tin dự án hoặc tài sản đã xác minh",
        "Tư vấn phương án phù hợp và hỗ trợ các bước tiếp theo",
    ],
    "policies": [
        "Minh bạch trong thông tin và trung thực trong tư vấn",
        "Ưu tiên lợi ích và nhu cầu thực tế của khách hàng",
    ],
    "faqs": [
        {
            "question": "Maian Homes cung cấp những dịch vụ nào?",
            "answer": "Maian Homes cung cấp dịch vụ tư vấn và môi giới, tư vấn đầu tư, chuyển nhượng, cho thuê và quản lý tài sản bất động sản.",
        },
        {
            "question": "Khách hàng liên hệ tư vấn bằng cách nào?",
            "answer": "Khách hàng sử dụng thông tin liên hệ chính thức được công bố trên website Maian Homes để được hỗ trợ.",
        },
    ],
    "effective_date": "2026-07-09",
}


async def run(*, apply: bool, database=None) -> dict:
    database = database if database is not None else db_manager.db
    collection = database["company_knowledge"]
    exists = await collection.count_documents({"_id": "company_profile"}, limit=1)
    created = 0
    if apply and not exists:
        now = datetime.now(timezone.utc)
        result = await collection.update_one(
            {"_id": "company_profile"},
            {"$setOnInsert": {
                "draft": INITIAL_DRAFT,
                "published": None,
                "workflow_status": "DRAFT",
                "publication_status": "NEVER_PUBLISHED",
                "version": 1,
                "published_version": 0,
                "created_at": now,
                "updated_at": now,
                "created_by": "migration",
                "updated_by": "migration",
                "migration_source": "website-about-snapshot-2026-07-09",
            }},
            upsert=True,
        )
        created = 1 if result.upserted_id else 0
    report = {"migration": MIGRATION_ID, "mode": "apply" if apply else "dry-run", "already_exists": bool(exists), "created": created, "published": False}
    if apply:
        await database["release_migrations"].update_one(
            {"_id": MIGRATION_ID},
            {"$set": {"status": "complete", "completed_at": datetime.now(timezone.utc), "report": report}},
            upsert=True,
        )
    return report


async def main() -> None:
    parser = argparse.ArgumentParser(description="Seed an unpublished Company Knowledge draft")
    parser.add_argument("--apply", action="store_true", help="Create the draft if it does not exist")
    args = parser.parse_args()
    await connect_to_mongo()
    try:
        print(await run(apply=args.apply))
    finally:
        await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main())
