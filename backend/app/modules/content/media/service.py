import asyncio
import logging
import re
from collections.abc import AsyncIterator
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps
from pymongo.errors import ConnectionFailure, DuplicateKeyError

from app.core.config import settings
from app.core.upload_security import scan_stream
from app.db.mongodb import get_database
from app.modules.content.media.policies import validate_image
from app.infrastructure.object_storage import spool_upload, storage_service

RESPONSIVE_WIDTHS = {
    "thumbnail": 480,
    "medium": 960,
    "large": 1600,
}

logger = logging.getLogger(__name__)


def _render_variants(source: bytes) -> dict[str, dict]:
    variants: dict[str, dict] = {}
    with Image.open(BytesIO(source)) as original:
        image = ImageOps.exif_transpose(original)
        if image.mode not in {"RGB", "RGBA"}:
            image = image.convert("RGB")

        for label, target_width in RESPONSIVE_WIDTHS.items():
            width = min(target_width, image.width)
            height = max(1, round(image.height * width / image.width))
            resized = image.copy()
            if width != image.width:
                resized.thumbnail((width, height), Image.Resampling.LANCZOS)

            for output_format, extension, content_type in (
                ("WEBP", "webp", "image/webp"),
                ("AVIF", "avif", "image/avif"),
            ):
                buffer = BytesIO()
                save_image = resized
                if output_format == "AVIF" and resized.mode == "RGBA":
                    background = Image.new("RGB", resized.size, "white")
                    background.paste(resized, mask=resized.getchannel("A"))
                    save_image = background
                save_image.save(buffer, format=output_format, quality=82, optimize=True)
                payload = buffer.getvalue()
                variants[f"{label}_{extension}"] = {
                    "content": payload,
                    "extension": f".{extension}",
                    "content_type": content_type,
                    "size": len(payload),
                    "width": save_image.width,
                    "height": save_image.height,
                }

        og_image = ImageOps.fit(image, (1200, 630), method=Image.Resampling.LANCZOS)
        for output_format, extension, content_type in (
            ("WEBP", "webp", "image/webp"),
            ("AVIF", "avif", "image/avif"),
        ):
            buffer = BytesIO()
            save_image = og_image
            if output_format == "AVIF" and og_image.mode == "RGBA":
                background = Image.new("RGB", og_image.size, "white")
                background.paste(og_image, mask=og_image.getchannel("A"))
                save_image = background
            save_image.save(buffer, format=output_format, quality=82, optimize=True)
            payload = buffer.getvalue()
            variants[f"og_{extension}"] = {
                "content": payload,
                "extension": f".{extension}",
                "content_type": content_type,
                "size": len(payload),
                "width": 1200,
                "height": 630,
            }
    return variants


class MarketingMediaService:
    @staticmethod
    def article_media_ids(payload: dict) -> set[str]:
        media_ids: set[str] = set()
        for item in payload.get("gallery") or []:
            source = item if isinstance(item, dict) else item.model_dump()
            explicit = str(source.get("media_id") or "").strip().casefold()
            if re.fullmatch(r"[a-f0-9]{32}", explicit):
                media_ids.add(explicit)
            url = str(source.get("url") or "")
            match = re.search(r"/marketing-media/([a-f0-9]{32})(?:[/?#]|$)", url)
            if match:
                media_ids.add(match.group(1))
        content = str(payload.get("content") or "")
        media_ids.update(re.findall(r'data-media-id=["\']([a-f0-9]{32})["\']', content))
        media_ids.update(
            re.findall(r"/marketing-media/([a-f0-9]{32})(?:[/?#]|$)", content)
        )
        return media_ids

    @staticmethod
    def project_media_ids(payload: dict) -> set[str]:
        media_ids: set[str] = set()

        def collect(value) -> None:
            if isinstance(value, dict):
                explicit = str(value.get("media_id") or "").strip()
                if explicit:
                    media_ids.add(explicit)
                for nested in value.values():
                    collect(nested)
            elif isinstance(value, list):
                for nested in value:
                    collect(nested)
            elif isinstance(value, str):
                media_ids.update(
                    re.findall(r"/marketing-media/([a-f0-9]{32})(?:[/?#]|$)", value)
                )

        collect(payload)
        return media_ids

    @staticmethod
    async def unavailable_article_media_ids(payload: dict) -> set[str]:
        media_ids = MarketingMediaService.article_media_ids(payload)
        if not media_ids:
            return set()
        cursor = get_database()["media_assets"].find(
            {
                "_id": {"$in": sorted(media_ids)},
                "namespace": "articles",
                "lifecycle_status": "ACTIVE",
            },
            {"_id": 1},
        )
        active = {str(item["_id"]) async for item in cursor}
        return media_ids - active

    @staticmethod
    async def unavailable_project_media_ids(payload: dict) -> set[str]:
        media_ids = MarketingMediaService.project_media_ids(payload)
        if not media_ids:
            return set()
        cursor = get_database()["media_assets"].find(
            {"_id": {"$in": sorted(media_ids)}, "lifecycle_status": "ACTIVE"},
            {"_id": 1},
        )
        active = {str(item["_id"]) async for item in cursor}
        return media_ids - active

    async def _sync_references(
        self, reference: str, desired: set[str], *, session=None
    ) -> None:
        db = get_database()
        previous = await db["media_assets"].find(
            {"references": reference}, {"_id": 1}, session=session
        ).to_list(length=1000)
        previous_ids = {str(item["_id"]) for item in previous}
        removed = previous_ids - desired
        now = datetime.now(timezone.utc)

        if removed:
            await db["media_assets"].update_many(
                {"_id": {"$in": list(removed)}},
                {"$pull": {"references": reference}, "$set": {"updated_at": now}},
                session=session,
            )
            await db["media_assets"].update_many(
                {"_id": {"$in": list(removed)}, "references": {"$size": 0}},
                {"$set": {"lifecycle_status": "ORPHANED", "orphaned_at": now, "updated_at": now}},
                session=session,
            )
        if desired:
            await db["media_assets"].update_many(
                {"_id": {"$in": list(desired)}, "lifecycle_status": "ACTIVE"},
                {"$addToSet": {"references": reference}, "$set": {"updated_at": now}},
                session=session,
            )

    async def sync_article_references(
        self, article_id: str, payload: dict, *, session=None
    ) -> None:
        desired = self.article_media_ids(payload)
        unavailable = await self.unavailable_article_media_ids(payload)
        if unavailable:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "ARTICLE_MEDIA_UNAVAILABLE",
                    "media_ids": sorted(unavailable),
                },
            )
        reference = f"ARTICLE:{article_id}"
        await self._sync_references(reference, desired, session=session)

    async def sync_project_references(
        self, project_id: str, payload: dict, *, session=None
    ) -> None:
        await self._sync_references(
            f"PROJECT:{project_id}", self.project_media_ids(payload), session=session
        )

    async def sync_account_avatar_reference(self, account_id: str, media_id: str) -> None:
        await self._sync_references(f"ACCOUNT:{account_id}:AVATAR", {media_id})

    async def cleanup_orphaned(self, cutoff: datetime, limit: int = 50) -> int:
        db = get_database()
        await db["media_assets"].update_many(
            {
                "namespace": {"$in": ["articles", "projects", "staff-profiles", "account-avatars"]},
                "lifecycle_status": "ACTIVE",
                "references": {"$size": 0},
                "created_at": {"$lte": cutoff},
            },
            {
                "$set": {
                    "lifecycle_status": "ORPHANED",
                    "orphaned_at": datetime.now(timezone.utc),
                }
            },
        )
        documents = await db["media_assets"].find(
            {"lifecycle_status": "ORPHANED", "orphaned_at": {"$lte": cutoff}}
        ).limit(limit).to_list(length=limit)
        cleaned = 0
        for document in documents:
            assets = [
                (
                    str(document.get("storage_backend") or "LOCAL"),
                    document.get("object_key"),
                    document.get("local_path"),
                )
            ]
            for variant in (document.get("variants") or {}).values():
                assets.append(
                    (
                        "S3" if variant.get("object_key") else "LOCAL",
                        variant.get("object_key"),
                        variant.get("local_path"),
                    )
                )
            await self._cleanup_assets(assets)
            result = await db["media_assets"].delete_one(
                {"_id": document["_id"], "lifecycle_status": "ORPHANED"}
            )
            cleaned += result.deleted_count
        return cleaned

    async def _cleanup_assets(
        self,
        assets: list[tuple[str, str | None, str | None]],
    ) -> None:
        async def remove(asset: tuple[str, str | None, str | None]) -> None:
            backend, object_key, local_path = asset
            try:
                if backend == "S3" and object_key:
                    await storage_service.delete(object_key)
                elif local_path:
                    await asyncio.to_thread(Path(local_path).unlink, missing_ok=True)
            except Exception:
                logger.warning("Không thể dọn dẹp một bản tải lên Marketing không hoàn chỉnh", exc_info=True)

        await asyncio.gather(*(remove(asset) for asset in assets))

    async def _persist_stream(
        self,
        object_key: str,
        local: Path,
        stream,
        content_type: str,
    ) -> tuple[str, str | None, str | None]:
        if settings.S3_ENABLED:
            await storage_service.put_fileobj(object_key, stream, content_type)
            return "S3", object_key, None
        await storage_service.write_local(local, stream)
        return "LOCAL", None, str(local.resolve())

    async def store(
        self,
        namespace: str,
        upload: UploadFile,
        actor_id: str,
        max_bytes: int,
        alt_text: str = "",
    ) -> dict:
        stored_assets: list[tuple[str, str | None, str | None]] = []
        try:
            stream, size, checksum = await spool_upload(upload, max_bytes)
        except ValueError as exc:
            raise HTTPException(
                status_code=413,
                detail="Ảnh vượt quá dung lượng cho phép.",
            ) from exc

        try:
            content_type = upload.content_type or "application/octet-stream"
            width, height = validate_image(stream, content_type)
            await scan_stream(stream)
            extension = {
                "image/jpeg": ".jpg",
                "image/png": ".png",
                "image/gif": ".gif",
                "image/webp": ".webp",
            }[content_type]
            file_id = uuid4().hex
            object_key = f"marketing/{namespace}/{file_id}{extension}"
            local = (
                Path(settings.UPLOAD_DIR)
                / "marketing"
                / namespace
                / f"{file_id}{extension}"
            )
            stream.seek(0)
            source = stream.read()
            backend, stored_key, local_path = await self._persist_stream(
                object_key,
                local,
                BytesIO(source),
                content_type,
            )
            stored_assets.append((backend, stored_key, local_path))

            rendered = await asyncio.to_thread(_render_variants, source)
            variant_records: dict[str, dict] = {}
            for name, variant in rendered.items():
                variant_stream = BytesIO(variant.pop("content"))
                variant_key = (
                    f"marketing/{namespace}/{file_id}/{name}{variant['extension']}"
                )
                variant_local = (
                    Path(settings.UPLOAD_DIR)
                    / "marketing"
                    / namespace
                    / file_id
                    / f"{name}{variant['extension']}"
                )
                variant_backend, variant_object_key, variant_local_path = await self._persist_stream(
                    variant_key,
                    variant_local,
                    variant_stream,
                    variant["content_type"],
                )
                stored_assets.append(
                    (variant_backend, variant_object_key, variant_local_path)
                )
                variant_records[name] = {
                    **variant,
                    "object_key": variant_object_key,
                    "local_path": variant_local_path,
                }

            document = {
                "_id": file_id,
                "namespace": namespace,
                "original_filename": upload.filename or f"{file_id}{extension}",
                "content_type": content_type,
                "size": size,
                "width": width,
                "height": height,
                "checksum": checksum,
                "storage_backend": backend,
                "object_key": stored_key,
                "local_path": local_path,
                "variants": variant_records,
                "uploaded_by": actor_id,
                "alt_text": alt_text.strip(),
                "lifecycle_status": "ACTIVE",
                "references": [],
                "created_at": datetime.now(timezone.utc),
            }
            had_transient_failure = False
            for attempt in range(2):
                try:
                    await get_database()["media_assets"].insert_one(document)
                    break
                except ConnectionFailure:
                    if attempt == 1:
                        raise
                    had_transient_failure = True
                    logger.warning("Lỗi MongoDB tạm thời khi lưu trữ tệp đa phương tiện; đang thử lại")
                    await asyncio.sleep(0.2)
                except DuplicateKeyError:
                    if not had_transient_failure:
                        raise
                    break
            return {
                "id": file_id,
                "url": f"/api/public/marketing-media/{file_id}",
                "content_type": content_type,
                "size": size,
                "width": width,
                "height": height,
                "checksum": checksum,
                "variants": {
                    name: f"/api/public/marketing-media/{file_id}?variant={name}"
                    for name in variant_records
                },
            }
        except Exception:
            await self._cleanup_assets(stored_assets)
            raise
        finally:
            stream.close()

    async def open_stream(
        self,
        file_id: str,
        variant: str | None = None,
    ) -> tuple[AsyncIterator[bytes], dict]:
        """Open public media without buffering the complete object in API RAM."""
        document = await get_database()["media_assets"].find_one(
            {"_id": file_id, "lifecycle_status": "ACTIVE"}
        )
        if not document:
            raise HTTPException(status_code=404, detail="Không tìm thấy media.")

        selected = document
        if variant:
            selected = (document.get("variants") or {}).get(variant)
            if not selected:
                raise HTTPException(status_code=404, detail="Không tìm thấy biến thể media.")

        metadata = {
            **document,
            "content_type": selected.get("content_type", document["content_type"]),
            "size": selected.get("size", document["size"]),
        }
        if document["storage_backend"] == "S3":
            stream, content_length, _content_type = await storage_service.open_stream(
                selected["object_key"]
            )
            if content_length is not None:
                metadata["size"] = content_length
            return stream, metadata

        path = Path(selected["local_path"])
        try:
            handle = await asyncio.to_thread(path.open, "rb")
        except OSError as exc:
            raise HTTPException(status_code=404, detail="Không tìm thấy nội dung media.") from exc

        async def chunks() -> AsyncIterator[bytes]:
            try:
                while True:
                    chunk = await asyncio.to_thread(handle.read, 256 * 1024)
                    if not chunk:
                        break
                    yield chunk
            finally:
                await asyncio.to_thread(handle.close)

        return chunks(), metadata

    async def read(self, file_id: str, variant: str | None = None) -> tuple[bytes, dict]:
        db = get_database()
        document = await db["media_assets"].find_one(
            {"_id": file_id, "lifecycle_status": "ACTIVE"}
        )
        if not document:
            raise HTTPException(status_code=404, detail="Không tìm thấy media.")

        selected = document
        if variant:
            selected = (document.get("variants") or {}).get(variant)
            if not selected:
                raise HTTPException(
                    status_code=404,
                    detail="Không tìm thấy biến thể media.",
                )

        original_url = str(document.get("original_url") or "")
        if original_url.startswith("/images/"):
            import mimetypes
            import os
            static_dir = Path(os.getenv("STATIC_PUBLIC_DIR") or (Path(__file__).resolve().parents[5] / "frontend" / "public"))
            static_file = (static_dir / original_url.lstrip("/")).resolve()
            if static_file.is_file():
                content = await asyncio.to_thread(static_file.read_bytes)
                mime_type, _ = mimetypes.guess_type(str(static_file))
                return content, {
                    **document,
                    "content_type": mime_type or "image/jpeg",
                    "size": len(content),
                    "original_filename": static_file.name,
                }

        if document.get("storage_backend") == "S3":
            content = await storage_service.get_bytes(selected["object_key"])
        else:
            path = Path(selected["local_path"])
            if not path.exists():
                raise HTTPException(
                    status_code=404,
                    detail="Không tìm thấy nội dung media.",
                )
            content = await asyncio.to_thread(path.read_bytes)

        metadata = {
            **document,
            "content_type": selected.get("content_type", document["content_type"]),
            "size": selected.get("size", document["size"]),
        }
        return content, metadata


marketing_media_service = MarketingMediaService()
