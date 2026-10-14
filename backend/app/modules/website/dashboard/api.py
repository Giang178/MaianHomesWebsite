from fastapi import APIRouter, Depends

from app.api.deps import require_permissions
from app.db.mongodb import get_database

router = APIRouter(prefix="/website/dashboard", tags=["Website Dashboard"])


@router.get("/overview")
async def overview(current_user: dict = Depends(require_permissions("website.dashboard.read"))):
    db = get_database()
    page_pipeline = [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    page_counts = {item["_id"]: item["count"] async for item in db["website_pages"].aggregate(page_pipeline)}
    
    # Calculate SEO & GEO completed counts
    all_pages = await db["website_pages"].find({}, {"page_key": 1, "draft": 1, "status": 1}).to_list(50)
    seo_completed = sum(
        1 for p in all_pages
        if 30 <= len(str((p.get("draft") or {}).get("seo", {}).get("title") or "").strip()) <= 60
        and 120 <= len(str((p.get("draft") or {}).get("seo", {}).get("description") or "").strip()) <= 160
    )
    geo_completed = sum(
        1 for p in all_pages
        if bool(str((p.get("draft") or {}).get("geo", {}).get("answer_summary") or "").strip())
        and len((p.get("draft") or {}).get("geo", {}).get("key_facts") or []) >= 3
    )

    # Leads statistics
    total_leads = await db["website_leads"].count_documents({})
    new_leads = await db["website_leads"].count_documents({"status": "NEW"})

    # Projects & Articles statistics
    projects_total = await db["projects"].count_documents({"status": {"$ne": "DELETED"}})
    projects_published = await db["projects"].count_documents({"status": "PUBLISHED"})

    articles_total = await db["articles"].count_documents({"status": {"$ne": "DELETED"}})
    articles_published = await db["articles"].count_documents({"status": "PUBLISHED"})

    media_query = {"namespace": {"$in": ["website", "website-pages", "website-branding", "website-global", "website-seed"]}, "lifecycle_status": {"$ne": "DELETED"}}
    media_total = await db["media_assets"].count_documents(media_query)
    missing_alt = await db["media_assets"].count_documents({**media_query, "$or": [{"alt_text": {"$exists": False}}, {"alt_text": ""}]})
    unused = await db["media_assets"].count_documents({**media_query, "references.0": {"$exists": False}})
    branding = await db["website_settings"].find_one({"_id": "global"}, {"status": 1, "updated_at": 1})
    recent = await db["website_pages"].find({}, {"page_key": 1, "status": 1, "updated_at": 1, "updated_by": 1}).sort("updated_at", -1).limit(8).to_list(8)

    return {
        "pages": {
            "total": sum(page_counts.values()),
            "by_status": page_counts,
            "seo_completed": seo_completed,
            "geo_completed": geo_completed,
        },
        "leads": {
            "total": total_leads,
            "new": new_leads,
        },
        "projects": {
            "total": projects_total,
            "published": projects_published,
        },
        "articles": {
            "total": articles_total,
            "published": articles_published,
        },
        "branding": branding or {},
        "media": {"total": media_total, "missing_alt": missing_alt, "unused": unused},
        "recent": [{"page_key": item["page_key"], "status": item.get("status"), "updated_at": item.get("updated_at"), "updated_by": item.get("updated_by")} for item in recent],
    }
