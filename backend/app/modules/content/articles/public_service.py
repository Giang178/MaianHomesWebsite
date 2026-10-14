
import hashlib
import logging
import re
from datetime import datetime, timezone

from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError, PyMongoError

from app.db.mongodb import get_database
from app.modules.content.articles.mappers import serialize_article
from app.modules.content.articles.repository import article_repository
from app.modules.content.projects.service import project_application_service


logger = logging.getLogger(__name__)
BOT_PATTERN = re.compile(
    r"(googlebot|bingbot|yandex|baiduspider|facebookexternalhit|twitterbot|rogerbot|linkedinbot|embedly|quora|showyoubot|outbrain|pinterest|slackbot|vkShare|W3C_Validator|telegrambot|discordbot|zalo|postman|curl|python|node-fetch|next\.js)",
    re.IGNORECASE,
)


class PublicArticleService:
    repository = article_repository

    async def list(self, category: str | None, project_id: str | None, skip: int, limit: int):
        query = {}
        if category:
            query["category"] = category
        if project_id:
            query["project_id"] = project_id
        items, total = await self.repository.public_list(query, skip, limit)
        return {
            "data": [serialize_article(item, public=True) for item in items],
            "total": total,
            "skip": skip,
            "limit": limit,
        }

    async def detail(self, slug: str):
        article = await self.repository.public_by_slug(slug)
        if not article:
            redirect = await self.repository.redirect_for_slug(slug)
            return {"redirect_to": redirect["new_slug"]} if redirect else None

        linked_project = None
        if article.get("project_id"):
            linked_project = await project_application_service.public_detail(
                str(article["project_id"])
            )
            if linked_project and not linked_project.get("redirect_to"):
                linked_project = {
                    "id": linked_project.get("id"),
                    "name": linked_project.get("name", ""),
                    "slug": linked_project.get("slug", ""),
                    "developer": linked_project.get("developer", "Maian Homes"),
                    "location": linked_project.get("location", "Việt Nam"),
                    "price_range": linked_project.get("price_range", "Đang cập nhật"),
                    "status": linked_project.get("status", "AVAILABLE"),
                    "hero_image": (
                        (linked_project.get("hero_images") or [None])[0]
                        or (linked_project.get("images") or [None])[0]
                        or ""
                    ),
                }
            else:
                linked_project = None

        related = await self.repository.related(article, limit=3)
        revisions = await self.repository.public_revisions(str(article["_id"]))
        return {
            "article": serialize_article(article, public=True),
            "linked_project": linked_project,
            "related_articles": [
                serialize_article(item, public=True) for item in related
            ],
            "revisions": revisions,
        }

    async def track_view(self, article_id_or_slug: str, ip: str, user_agent: str) -> dict:
        if BOT_PATTERN.search(user_agent or ""):
            return {"tracked": False, "reason": "bot_detected", "current_views": None}

        query = (
            {"_id": ObjectId(article_id_or_slug)}
            if ObjectId.is_valid(article_id_or_slug)
            else {"slug": article_id_or_slug}
        )
        db = get_database()
        document = await db["articles"].find_one(
            query, {"_id": 1, "view_count": 1, "status": 1, "publication_status": 1}
        )
        if not document or (
            str(document.get("status") or "").lower() != "published"
            and document.get("publication_status") != "PUBLISHED"
        ):
            return {"tracked": False, "reason": "article_not_found_or_unpublished", "current_views": None}

        article_id = str(document["_id"])
        viewer_hash = hashlib.sha256(
            f"{article_id}:{ip}:{(user_agent or '')[:50]}".encode()
        ).hexdigest()
        try:
            await db["article_view_logs"].insert_one({
                "article_id": article_id,
                "viewer_hash": viewer_hash,
                "ip_address": ip,
                "user_agent": (user_agent or "")[:150],
                "created_at": datetime.now(timezone.utc),
            })
        except DuplicateKeyError:
            return {
                "tracked": False,
                "reason": "duplicate_view_in_window",
                "current_views": document.get("view_count", 0),
            }
        except PyMongoError:
            logger.exception("article_view_tracking_failed", extra={"article_id": article_id})
            return {
                "tracked": False,
                "reason": "database_error",
                "current_views": document.get("view_count", 0),
            }

        updated = await db["articles"].find_one_and_update(
            {"_id": document["_id"]},
            {"$inc": {"view_count": 1}},
            return_document=ReturnDocument.AFTER,
        )
        return {
            "tracked": True,
            "reason": None,
            "current_views": (updated or {}).get("view_count", document.get("view_count", 0) + 1),
        }


public_article_service = PublicArticleService()
