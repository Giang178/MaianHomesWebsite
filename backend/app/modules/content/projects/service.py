import re

from bson import ObjectId
from fastapi import HTTPException

from app.core.config import settings
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
from app.modules.content.projects.mappers import serialize_document
from app.modules.content.projects.repository import project_repository
from app.modules.content.seo_geo.validators import validate_project_for_publish
from app.modules.content.seo_geo.schemas import ValidationIssue
from app.modules.content.workflow.policies import assert_can_edit, has_permission
from app.modules.content.workflow.schemas import TransitionRequest
from app.modules.content.workflow.service import transition_fields


class ProjectApplicationService:
    repository = project_repository

    @staticmethod
    def _prepare_payload(payload: dict) -> dict:
        prepared = dict(payload)
        raw_seo = prepared.get("seo_metadata")
        if hasattr(raw_seo, "model_dump"):
            seo = raw_seo.model_dump()
        elif isinstance(raw_seo, dict):
            seo = dict(raw_seo)
        else:
            seo = {}
        site_url = settings.PUBLIC_SITE_URL.rstrip("/")
        slug = str(prepared.get("slug") or "").strip()
        hero_images = prepared.get("hero_images")
        gallery_images = prepared.get("images")
        hero_images = hero_images if isinstance(hero_images, list) else []
        gallery_images = gallery_images if isinstance(gallery_images, list) else []
        hero = next(
            (str(item).strip() for item in hero_images if str(item).strip()),
            next((str(item).strip() for item in gallery_images if str(item).strip()), ""),
        )
        seo["canonical_url"] = f"{site_url}/du_an/{slug}" if slug else ""
        seo["og_title"] = str(seo.get("title") or "").strip()
        seo["og_description"] = str(seo.get("description") or "").strip()
        image_metadata = prepared.get("image_metadata")
        if not isinstance(image_metadata, list):
            image_metadata = []
        metadata_alts = [
            {
                "url": str(item.get("url") or "").strip(),
                "alt_text": str(item.get("alt_text") or "").strip(),
            }
            for item in image_metadata
            if isinstance(item, dict) and str(item.get("url") or "").strip()
        ]
        if metadata_alts:
            seo["image_alts"] = metadata_alts
        hero_metadata = next(
            (
                item for item in image_metadata
                if isinstance(item, dict)
                and (
                    item.get("field") == "hero_images.0"
                    or (hero and item.get("url") == hero)
                )
            ),
            {},
        )
        hero_variants = hero_metadata.get("variants") if isinstance(hero_metadata, dict) else {}
        seo["og_image"] = (
            hero_variants.get("og_webp")
            if isinstance(hero_variants, dict)
            else ""
        ) or hero
        prepared["image_metadata"] = image_metadata
        prepared["seo_metadata"] = seo
        return prepared

    @staticmethod
    def _admin_item(item: dict) -> dict:
        item = ProjectApplicationService._prepare_payload(item)
        mapped = serialize_document(item)
        report = validate_project_for_publish(item)
        mapped["quality_summary"] = {
            "score": report.score,
            "error_count": len(report.errors),
            "warning_count": len(report.warnings),
        }
        return mapped

    @staticmethod
    def _response(working: dict, live: dict | None = None) -> dict:
        working = ProjectApplicationService._prepare_payload(working)
        live = ProjectApplicationService._prepare_payload(live) if live else None
        return {
            "project": serialize_document(working),
            "live": serialize_document(live, public=True) if live else None,
            "validation": validate_project_for_publish(working).model_dump(),
        }

    @staticmethod
    def validate(payload: dict) -> dict:
        return validate_project_for_publish(
            ProjectApplicationService._prepare_payload(payload)
        ).model_dump()

    async def _validate_slug(self, slug: str, exclude_id: str | None = None):
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug or ""):
            raise HTTPException(status_code=422, detail={"code": "INVALID_SLUG", "field": "slug"})
        if await self.repository.slug_exists(slug, exclude_id):
            raise HTTPException(status_code=409, detail={"code": "SLUG_CONFLICT", "field": "slug"})

    async def create(self, request, actor: dict) -> dict:
        payload = self._prepare_payload(request.model_dump(exclude={"idempotency_key"}))
        payload["is_published"] = False
        await self._validate_slug(payload["slug"])
        owner = actor_id(actor)
        metadata = {
            "workflow_status": WorkflowStatus.DRAFT.value,
            "publication_status": PublicationStatus.NEVER_PUBLISHED.value,
            "version": 1,
            "published_version": 0,
            "created_by": owner,
            "updated_by": owner,
            "reviewed_by": None,
            "reviewed_at": None,
            "rejection_reason": None,
        }

        async def operation():
            async with marketing_transaction() as session:
                root = await self.repository.create(payload, metadata, session=session)
                await marketing_media_service.sync_project_references(
                    str(root["_id"]), payload, session=session
                )
                await record_audit(
                    entity_type="PROJECT",
                    entity_id=str(root["_id"]),
                    action="create",
                    actor=actor,
                    current=root,
                    session=session,
                )
                await enqueue(
                    "MARKETING_PROJECT_CREATED",
                    {"project_id": str(root["_id"]), "actor_id": owner},
                    session=session,
                )
            working = {**root, **payload, "_id": root["_id"]}
            return self._response(working)

        return await execute_once(
            key=request.idempotency_key,
            scope="project:create",
            actor_id=owner,
            operation=operation,
        )
    async def detail(self, project_id: str, actor: dict) -> dict:
        root = await self.repository.find_root(project_id)
        if not root:
            raise HTTPException(status_code=404, detail="Không tìm thấy dự án.")
        if role_value(actor) == "MARKETING_STAFF" and root.get("created_by") not in {None, "", actor_id(actor)}:
            raise HTTPException(status_code=403, detail="Bạn không có quyền xem draft này.")
        draft = await self.repository.get_draft(project_id)
        working = {**root, **((draft or {}).get("payload") or {})}
        working["_id"] = root["_id"]
        working["version"] = root.get("version", 1)
        return self._response(working, root if root.get("is_published") else None)

    async def update(self, project_id: str, request, actor: dict) -> dict:
        root = await self.repository.find_root(project_id)
        if not root:
            raise HTTPException(status_code=404, detail="Không tìm thấy dự án.")
        assert_can_edit(root, actor, publish_permission="website.projects.publish")
        draft = await self.repository.get_draft(project_id)
        current_payload = (draft or {}).get("payload") or {
            key: value for key, value in root.items() if not key.startswith("_")
        }
        patch = request.model_dump(exclude_unset=True)
        expected_version = patch.pop("expected_version")
        key = patch.pop("idempotency_key")
        payload = self._prepare_payload({**current_payload, **patch})
        await self._validate_slug(payload.get("slug", ""), project_id)

        async def operation():
            async with marketing_transaction() as session:
                updated = await self.repository.save_draft(
                    project_id,
                    payload,
                    expected_version,
                    actor_id(actor),
                    session=session,
                )
                if not updated:
                    latest = await self.repository.find_root(project_id, session=session)
                    raise HTTPException(
                        status_code=409,
                        detail={"code": "VERSION_CONFLICT", "current_version": (latest or {}).get("version")},
                    )
                await marketing_media_service.sync_project_references(
                    project_id, payload, session=session
                )
                await record_audit(
                    entity_type="PROJECT",
                    entity_id=project_id,
                    action="update_draft",
                    actor=actor,
                    previous=root,
                    current=updated,
                    session=session,
                )
                await enqueue(
                    "MARKETING_PROJECT_DRAFT_UPDATED",
                    {"project_id": project_id, "actor_id": actor_id(actor)},
                    session=session,
                )
            working = {**payload, **updated, "_id": updated["_id"]}
            live = root if root.get("is_published") else None
            return self._response(working, live)

        return await execute_once(
            key=key, scope=f"project:{project_id}:update", actor_id=actor_id(actor), operation=operation
        )

    async def transition(self, project_id: str, request: TransitionRequest, actor: dict) -> dict:
        root = await self.repository.find_root(project_id)
        if not root:
            raise HTTPException(status_code=404, detail="Không tìm thấy dự án.")
        draft = await self.repository.get_draft(project_id)
        payload = self._prepare_payload((draft or {}).get("payload") or root)
        action = request.action
        try:
            fields = transition_fields(
                root, action, actor, request.note,
                update_permission="website.projects.update",
                publish_permission="website.projects.publish",
                delete_permission="website.projects.delete",
            )
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

        if action == MarketingAction.PUBLISH:
            report = validate_project_for_publish(payload)
            unavailable_media = await marketing_media_service.unavailable_project_media_ids(payload)
            for media_id in sorted(unavailable_media):
                metadata = next(
                    (
                        item for item in payload.get("image_metadata") or []
                        if isinstance(item, dict) and str(item.get("media_id") or "") == media_id
                    ),
                    {},
                )
                media_field = str(metadata.get("field") or "image_metadata")
                report.errors.append(
                    ValidationIssue(
                        code="MEDIA_UNAVAILABLE",
                        field=media_field,
                        message="Ảnh tại vị trí này không còn tồn tại hoặc đã bị gỡ khỏi kho media. Hãy tải lại ảnh.",
                        group="MEDIA",
                    )
                )
            if unavailable_media:
                report.score = max(0, report.score - len(unavailable_media) * 15)
            if report.errors:
                raise HTTPException(
                    status_code=422,
                    detail={"code": "QUALITY_GATE_FAILED", **report.model_dump()},
                )
            warning_codes = {item.code for item in report.warnings}
            missing = warning_codes - set(request.override_warning_codes)
            if missing:
                raise HTTPException(
                    status_code=422,
                    detail={
                        "code": "QUALITY_WARNINGS_REQUIRE_CONFIRMATION",
                        "warning_codes": sorted(missing),
                        **report.model_dump(),
                    },
                )

        async def operation():
            async with marketing_transaction() as session:
                if action == MarketingAction.PUBLISH:
                    updated = await self.repository.publish(
                        project_id,
                        request.expected_version,
                        payload,
                        fields,
                        actor_id(actor),
                        session=session,
                    )
                    if updated:
                        await marketing_media_service.sync_project_references(
                            project_id, payload, session=session
                        )
                else:
                    if action in {MarketingAction.UNPUBLISH, MarketingAction.ARCHIVE}:
                        fields["is_published"] = False
                    if action == MarketingAction.ARCHIVE:
                        await self.repository.preserve_lead_project_context(
                            project_id,
                            payload,
                            session=session,
                        )
                    updated = await self.repository.update_workflow(
                        project_id, request.expected_version, fields, session=session
                    )
                if not updated:
                    latest = await self.repository.find_root(project_id, session=session)
                    raise HTTPException(
                        status_code=409,
                        detail={"code": "VERSION_CONFLICT", "current_version": (latest or {}).get("version")},
                    )
                await record_audit(
                    entity_type="PROJECT",
                    entity_id=project_id,
                    action=action.value,
                    actor=actor,
                    previous=root,
                    current=updated,
                    note=request.note,
                    session=session,
                )
                await enqueue(
                    f"MARKETING_PROJECT_{action.value.upper()}",
                    {
                        "project_id": project_id,
                        "slug": payload.get("slug"),
                        "actor_id": actor_id(actor),
                        "author_id": root.get("created_by"),
                    },
                    session=session,
                )
            return serialize_document(updated)

        return await execute_once(
            key=request.idempotency_key,
            scope=f"project:{project_id}:{action.value}",
            actor_id=actor_id(actor),
            operation=operation,
        )

    async def revisions(self, project_id: str, actor: dict, skip: int, limit: int) -> list[dict]:
        await self.detail(project_id, actor)
        return [
            serialize_document(item)
            for item in await self.repository.revisions(project_id, skip, limit)
        ]

    async def delete_permanently(
        self,
        project_id: str,
        expected_version: int,
        idempotency_key: str,
        actor: dict,
    ) -> dict:
        if not has_permission(actor, "website.projects.delete"):
            raise HTTPException(status_code=403, detail="Yêu cầu quyền Quản lý.")
        root = await self.repository.find_root(project_id)
        if not root:
            raise HTTPException(status_code=404, detail="Không tìm thấy dự án.")
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
                await self.repository.preserve_lead_project_context(
                    project_id,
                    root,
                    session=session,
                )
                await record_audit(
                    entity_type="PROJECT",
                    entity_id=project_id,
                    action="delete_permanently",
                    actor=actor,
                    previous=root,
                    note="Archived project permanently deleted",
                    session=session,
                )
                deleted = await self.repository.delete_archived(
                    project_id,
                    expected_version,
                    session=session,
                )
                if not deleted:
                    latest = await self.repository.find_root(project_id, session=session)
                    raise HTTPException(
                        status_code=409,
                        detail={
                            "code": "VERSION_CONFLICT",
                            "current_version": (latest or {}).get("version"),
                        },
                    )
                await marketing_media_service.sync_project_references(
                    project_id, {}, session=session
                )
                await enqueue(
                    "MARKETING_PROJECT_DELETE_PERMANENTLY",
                    {"project_id": project_id, "slug": root.get("slug")},
                    session=session,
                )
            return {"deleted": True, "id": project_id}

        return await execute_once(
            key=idempotency_key,
            scope=f"project:{project_id}:delete_permanently",
            actor_id=actor_id(actor),
            operation=operation,
        )

    async def list(self, actor: dict, skip: int, limit: int, workflow: str | None, publication: str | None):
        query = {}
        if workflow:
            query["workflow_status"] = workflow
        if publication:
            query["publication_status"] = publication
        items, total = await self.repository.list_admin(query, skip, limit)
        return {
            "data": [self._admin_item(item) for item in items],
            "total": total,
            "skip": skip,
            "limit": limit,
        }

    async def public_list(
        self,
        skip: int,
        limit: int,
        is_featured: bool = None,
        *,
        summary: bool = False,
    ):
        items, total = await self.repository.list_public(
            skip,
            limit,
            is_featured,
            summary=summary,
        )
        return {
            "data": [serialize_document(item, public=True) for item in items],
            "total": total,
            "skip": skip,
            "limit": limit,
        }

    async def public_detail(self, slug_or_id: str):
        root = None
        if ObjectId.is_valid(slug_or_id):
            root = await self.repository.find_root(slug_or_id)
            if root and not root.get("is_published"):
                root = None
        if not root:
            root = await self.repository.find_by_slug(slug_or_id, published_only=True)
        if root:
            return serialize_document(root, public=True)
        redirect = await self.repository.redirect_for_slug(slug_or_id)
        if redirect:
            return {"redirect_to": redirect["new_slug"]}
        return None


project_application_service = ProjectApplicationService()
