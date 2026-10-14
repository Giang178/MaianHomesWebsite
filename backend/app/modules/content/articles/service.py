import re
from uuid import uuid4

from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError

from app.modules.content.articles.mappers import serialize_article
from app.modules.content.articles.repository import article_repository
from app.modules.content.common.audit import record_audit
from app.modules.content.common.enums import (
    MarketingAction,
    PublicationStatus,
    WorkflowStatus,
    actor_id,
    role_value,
)
from app.modules.content.common.idempotency import execute_once
from app.modules.content.common.outbox import enqueue
from app.modules.content.common.transactions import marketing_transaction
from app.modules.content.media.service import marketing_media_service
from app.modules.content.seo_geo.html_sanitizer import sanitize_marketing_html
from app.modules.content.seo_geo.validators import validate_article_for_publish
from app.modules.content.workflow.policies import assert_can_edit, has_permission
from app.modules.content.workflow.schemas import TransitionRequest
from app.modules.content.workflow.service import transition_fields


class ArticleApplicationService:
    repository = article_repository

    @staticmethod
    async def _execute_once(**kwargs):
        try:
            return await execute_once(**kwargs)
        except DuplicateKeyError as exc:
            raise HTTPException(
                status_code=409,
                detail={"code": "SLUG_CONFLICT", "field": "slug"},
            ) from exc

    @staticmethod
    def _admin_item(item: dict) -> dict:
        mapped = serialize_article(item)
        report = validate_article_for_publish(item)
        mapped["quality_summary"] = {
            "score": report.score,
            "error_count": len(report.errors),
            "warning_count": len(report.warnings),
        }
        return mapped

    async def _validate_slug(self, slug: str, exclude_id: str | None = None) -> None:
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug or ""):
            raise HTTPException(status_code=422, detail={"code": "INVALID_SLUG", "field": "slug"})
        if await self.repository.slug_exists(slug, exclude_id):
            raise HTTPException(status_code=409, detail={"code": "SLUG_CONFLICT", "field": "slug"})

    async def _validate_linked_project(self, payload: dict) -> None:
        category = getattr(payload.get("category"), "value", payload.get("category"))
        if category != "project":
            return
        project_id = payload.get("project_id")
        if not project_id:
            raise HTTPException(status_code=422, detail={"code": "PROJECT_REQUIRED"})
        from app.modules.content.projects.service import project_application_service
        project = await project_application_service.public_detail(str(project_id))
        if not project or project.get("redirect_to"):
            raise HTTPException(status_code=422, detail={"code": "PUBLISHED_PROJECT_REQUIRED"})

    async def create(self, request, actor: dict) -> dict:
        payload = request.model_dump(exclude={"idempotency_key"}, mode="json")
        payload["content"] = sanitize_marketing_html(payload.get("content", ""))
        await self._validate_slug(payload["slug"])
        owner = actor_id(actor)
        metadata = {
            "author_id": owner,
            "author_name": actor.get("full_name") or actor.get("email") or "Marketing",
            "author_email": actor.get("email", ""),
            "workflow_status": WorkflowStatus.DRAFT.value,
            "publication_status": PublicationStatus.NEVER_PUBLISHED.value,
            "version": 1,
            "published_version": 0,
            "created_by": owner,
            "updated_by": owner,
            "view_count": 0,
            "editor_owner_id": owner,
            "ownership_status": "ACTIVE",
            "is_provisional": False,
        }

        async def operation():
            async with marketing_transaction() as session:
                root = await self.repository.create(payload, metadata, session=session)
                await marketing_media_service.sync_article_references(
                    str(root["_id"]), payload, session=session
                )
                await record_audit(
                    entity_type="ARTICLE",
                    entity_id=str(root["_id"]),
                    action="create",
                    actor=actor,
                    current=root,
                    session=session,
                )
                await enqueue(
                    "MARKETING_ARTICLE_CREATED",
                    {"article_id": str(root["_id"]), "actor_id": owner},
                    session=session,
                )
            response = serialize_article(root)
            response["autosave_status"] = "saved"
            return response

        return await self._execute_once(
            key=request.idempotency_key,
            scope="article:create",
            actor_id=owner,
            operation=operation,
        )

    async def create_provisional_draft(self, request, actor: dict) -> dict:
        owner = actor_id(actor)
        token = uuid4().hex
        payload = {
            "title": "",
            "slug": f"draft-{token}",
            "category": "market",
            "project_id": None,
            "sapo": "",
            "content": "",
            "featured_image_id": None,
            "gallery": [],
            "seo": {"meta_title": "", "meta_description": "", "canonical_url": ""},
            "geo": {"answer_summary": "", "key_facts": [], "faqs": [], "sources": []},
        }
        metadata = {
            "author_id": owner,
            "author_name": actor.get("full_name") or actor.get("email") or "Marketing",
            "author_email": actor.get("email", ""),
            "workflow_status": WorkflowStatus.DRAFT.value,
            "publication_status": PublicationStatus.NEVER_PUBLISHED.value,
            "version": 1,
            "published_version": 0,
            "created_by": owner,
            "updated_by": owner,
            "view_count": 0,
            "editor_owner_id": owner,
            "ownership_status": "ACTIVE",
            "is_provisional": True,
        }

        async def operation():
            async with marketing_transaction() as session:
                root = await self.repository.create(payload, metadata, session=session)
                await record_audit(
                    entity_type="ARTICLE",
                    entity_id=str(root["_id"]),
                    action="create_provisional_draft",
                    actor=actor,
                    current=root,
                    session=session,
                )
            response = serialize_article(root)
            response["autosave_status"] = "saved"
            return response

        return await self._execute_once(
            key=request.idempotency_key,
            scope="article:draft:create",
            actor_id=owner,
            operation=operation,
        )

    async def detail(self, article_id: str, actor: dict) -> dict:
        root = await self.repository.root(article_id)
        if not root:
            raise HTTPException(status_code=404, detail="Không tìm thấy bài viết.")
        owner = root.get("editor_owner_id") or root.get("created_by") or root.get("author_id")
        if role_value(actor) == "MARKETING_STAFF" and owner != actor_id(actor):
            raise HTTPException(status_code=403, detail="Bạn không có quyền xem draft này.")
        draft = await self.repository.draft(article_id)
        working = {**root, **((draft or {}).get("payload") or {})}
        working["_id"] = root["_id"]
        working["version"] = root.get("version", 1)
        working["autosave_status"] = "saved"
        revision_items, _revision_total = await self.repository.revisions(article_id, 0, 50)
        return {
            "article": serialize_article(working),
            "live": serialize_article(root, public=True) if root.get("status") == "published" else None,
            "validation": validate_article_for_publish(working).model_dump(),
            "revisions": [serialize_article(item) for item in revision_items],
        }

    async def update(self, article_id: str, request, actor: dict) -> dict:
        root = await self.repository.root(article_id)
        if not root:
            raise HTTPException(status_code=404, detail="Không tìm thấy bài viết.")
        root.setdefault("created_by", root.get("author_id", ""))
        assert_can_edit(root, actor, publish_permission="website.articles.publish")
        draft = await self.repository.draft(article_id)
        current = (draft or {}).get("payload") or {
            key: value for key, value in root.items() if not key.startswith("_")
        }
        patch = request.model_dump(exclude_unset=True, mode="json")
        expected = patch.pop("expected_version")
        key = patch.pop("idempotency_key")
        if "content" in patch:
            patch["content"] = sanitize_marketing_html(patch["content"])
        payload = {**current, **patch}
        if root.get("is_provisional") and not str(payload.get("slug") or "").strip():
            payload["slug"] = root.get("slug")
        await self._validate_slug(payload.get("slug", ""), article_id)
        is_provisional = not bool(
            str(payload.get("title") or "").strip()
            or str(payload.get("sapo") or "").strip()
            or str(payload.get("content") or "").strip()
            or payload.get("gallery")
        )

        async def operation():
            async with marketing_transaction() as session:
                updated = await self.repository.save_draft(
                    article_id,
                    payload,
                    expected,
                    actor_id(actor),
                    is_provisional,
                    session=session,
                )
                if not updated:
                    latest = await self.repository.root(article_id, session=session)
                    raise HTTPException(
                        status_code=409,
                        detail={"code": "VERSION_CONFLICT", "current_version": (latest or {}).get("version")},
                    )
                await marketing_media_service.sync_article_references(
                    article_id, payload, session=session
                )
                await record_audit(
                    entity_type="ARTICLE",
                    entity_id=article_id,
                    action="update_draft",
                    actor=actor,
                    previous=root,
                    current=updated,
                    session=session,
                )
                await enqueue(
                    "MARKETING_ARTICLE_DRAFT_UPDATED",
                    {"article_id": article_id, "actor_id": actor_id(actor)},
                    session=session,
                )
            response = serialize_article({**payload, **updated, "_id": updated["_id"]})
            response["autosave_status"] = "saved"
            return response

        return await self._execute_once(
            key=key,
            scope=f"article:{article_id}:update",
            actor_id=actor_id(actor),
            operation=operation,
        )

    async def transition(self, article_id: str, request: TransitionRequest, actor: dict) -> dict:
        root = await self.repository.root(article_id)
        if not root:
            raise HTTPException(status_code=404, detail="Không tìm thấy bài viết.")
        root.setdefault("created_by", root.get("author_id", ""))
        draft = await self.repository.draft(article_id)
        payload = (draft or {}).get("payload") or root
        if request.override_warning_codes and not has_permission(actor, "website.articles.publish"):
            raise HTTPException(
                status_code=403,
                detail={"code": "WARNING_OVERRIDE_MANAGER_ONLY"},
            )
        if request.override_warning_codes and not (request.note or "").strip():
            raise HTTPException(
                status_code=422,
                detail={"code": "WARNING_OVERRIDE_REASON_REQUIRED", "field": "note"},
            )
        try:
            fields = transition_fields(
                root, request.action, actor, request.note,
                update_permission="website.articles.update",
                publish_permission="website.articles.publish",
                delete_permission="website.articles.delete",
            )
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

        if request.action == MarketingAction.PUBLISH:
            await self._validate_linked_project(payload)
            report = validate_article_for_publish(payload)
            if report.errors:
                raise HTTPException(
                    status_code=422,
                    detail={"code": "QUALITY_GATE_FAILED", **report.model_dump()},
                )
            if request.action == MarketingAction.PUBLISH:
                warning_codes = {item.code for item in report.warnings}
                requested_overrides = set(request.override_warning_codes)
                unknown = requested_overrides - warning_codes
                if unknown:
                    raise HTTPException(
                        status_code=422,
                        detail={
                            "code": "UNKNOWN_WARNING_OVERRIDE",
                            "warning_codes": sorted(unknown),
                        },
                    )
                missing = warning_codes - requested_overrides
                if missing:
                    raise HTTPException(
                        status_code=422,
                        detail={
                            "code": "QUALITY_WARNINGS_REQUIRE_CONFIRMATION",
                            "warning_codes": sorted(missing),
                        },
                    )

        async def operation():
            async with marketing_transaction() as session:
                if request.action == MarketingAction.PUBLISH:
                    updated = await self.repository.publish(
                        article_id,
                        request.expected_version,
                        payload,
                        fields,
                        actor_id(actor),
                        session=session,
                    )
                else:
                    if request.action in {MarketingAction.UNPUBLISH, MarketingAction.ARCHIVE}:
                        fields["status"] = "draft" if request.action == MarketingAction.UNPUBLISH else "archived"
                    elif request.action == MarketingAction.RESTORE:
                        fields["status"] = "draft"
                    updated = await self.repository.update_workflow(
                        article_id, request.expected_version, fields, session=session
                    )
                if not updated:
                    latest = await self.repository.root(article_id, session=session)
                    raise HTTPException(
                        status_code=409,
                        detail={"code": "VERSION_CONFLICT", "current_version": (latest or {}).get("version")},
                    )
                await record_audit(
                    entity_type="ARTICLE",
                    entity_id=article_id,
                    action=request.action.value,
                    actor=actor,
                    previous=root,
                    current=updated,
                    note=request.note,
                    metadata={
                        "override_warning_codes": request.override_warning_codes,
                        "override_reason": request.note,
                    } if request.override_warning_codes else None,
                    session=session,
                )
                await enqueue(
                    f"MARKETING_ARTICLE_{request.action.value.upper()}",
                    {
                        "article_id": article_id,
                        "entity_id": article_id,
                        "title": payload.get("title"),
                        "slug": payload.get("slug"),
                        "old_slug": root.get("slug"),
                        "actor_id": actor_id(actor),
                        "author_id": root.get("created_by"),
                    },
                    session=session,
                )
            return serialize_article(updated)

        return await self._execute_once(
            key=request.idempotency_key,
            scope=f"article:{article_id}:{request.action.value}",
            actor_id=actor_id(actor),
            operation=operation,
        )

    async def list_admin(
        self,
        actor: dict,
        status_filter: str | None,
        category: str | None,
        skip: int,
        limit: int,
        search: str | None = None,
    ) -> dict:
        query: dict = {}
        if role_value(actor) == "MARKETING_STAFF":
            query["$or"] = [
                {"editor_owner_id": actor_id(actor)},
                {
                    "editor_owner_id": {"$exists": False},
                    "$or": [
                        {"created_by": actor_id(actor)},
                        {"author_id": actor_id(actor)},
                    ],
                },
            ]
        if status_filter:
            workflow_map = {
                "draft": "DRAFT",
            }
            publication_map = {
                "published": "PUBLISHED",
                "unpublished": "UNPUBLISHED",
                "archived": "ARCHIVED",
            }
            if status_filter in workflow_map:
                query["workflow_status"] = workflow_map[status_filter]
            elif status_filter in publication_map:
                query["publication_status"] = publication_map[status_filter]
        if category:
            query["category"] = category
        items, total = await self.repository.list_admin(query, skip, limit, search)
        return {
            "data": [self._admin_item(item) for item in items],
            "total": total,
            "skip": skip,
            "limit": limit,
        }

    async def revisions(self, article_id: str, actor: dict, skip: int, limit: int) -> tuple[list[dict], int]:
        await self.detail(article_id, actor)
        items, total = await self.repository.revisions(article_id, skip, limit)
        return [serialize_article(item) for item in items], total

    async def audit_logs(self, article_id: str, actor: dict, skip: int, limit: int) -> tuple[list[dict], int]:
        await self.detail(article_id, actor)
        items, total = await self.repository.audit_logs(article_id, skip, limit)
        results = []
        for item in items:
            mapped = serialize_article(item)
            mapped.setdefault("timestamp", mapped.get("created_at"))
            mapped.setdefault("performed_by_email", mapped.get("actor_email"))
            mapped.setdefault("performed_by_role", mapped.get("actor_role"))
            mapped.setdefault("old_status", mapped.get("previous_workflow_status"))
            mapped.setdefault("new_status", mapped.get("workflow_status"))
            results.append(mapped)
        return results, total

    async def delete_permanently(
        self,
        article_id: str,
        expected_version: int,
        idempotency_key: str,
        actor: dict,
    ) -> dict:
        if not has_permission(actor, "website.articles.delete"):
            raise HTTPException(status_code=403, detail="Yêu cầu quyền Quản lý.")
        root = await self.repository.root(article_id)
        if not root:
            raise HTTPException(status_code=404, detail="Không tìm thấy bài viết.")
        if root.get("publication_status") != PublicationStatus.ARCHIVED.value:
            raise HTTPException(
                status_code=409,
                detail={"code": "ARCHIVE_REQUIRED_BEFORE_DELETE"},
            )
        if int(root.get("version") or 1) != expected_version:
            raise HTTPException(
                status_code=409,
                detail={"code": "VERSION_CONFLICT", "current_version": root.get("version", 1)},
            )

        async def operation():
            async with marketing_transaction() as session:
                await record_audit(
                    entity_type="ARTICLE",
                    entity_id=article_id,
                    action="delete_permanently",
                    actor=actor,
                    previous=root,
                    note="Archived article permanently deleted",
                    session=session,
                )
                deleted = await self.repository.delete_archived(
                    article_id,
                    expected_version,
                    session=session,
                )
                if not deleted:
                    latest = await self.repository.root(article_id, session=session)
                    raise HTTPException(
                        status_code=409,
                        detail={
                            "code": "VERSION_CONFLICT",
                            "current_version": (latest or {}).get("version"),
                        },
                    )
                await marketing_media_service.sync_article_references(
                    article_id, {}, session=session
                )
                await enqueue(
                    "MARKETING_ARTICLE_DELETE_PERMANENTLY",
                    {"article_id": article_id, "slug": root.get("slug")},
                    session=session,
                )
            return {"deleted": True, "id": article_id}

        return await self._execute_once(
            key=idempotency_key,
            scope=f"article:{article_id}:delete_permanently",
            actor_id=actor_id(actor),
            operation=operation,
        )

article_application_service = ArticleApplicationService()
