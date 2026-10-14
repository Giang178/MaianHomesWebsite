from __future__ import annotations

import asyncio
import logging
import struct
from collections.abc import Mapping
from pathlib import Path
from typing import BinaryIO

from fastapi import HTTPException
from PIL import Image, UnidentifiedImageError

from app.core.config import settings

logger = logging.getLogger(__name__)

FILE_SIGNATURES: dict[str, tuple[bytes, ...]] = {
    "application/pdf": (b"%PDF-",),
    "application/msword": (bytes.fromhex("D0CF11E0"),),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": (b"PK",),
    "image/jpeg": (bytes.fromhex("FFD8FF"),),
    "image/png": (bytes.fromhex("89504E470D0A1A0A"),),
    "image/gif": (b"GIF87a", b"GIF89a"),
    "image/webp": (b"RIFF",),
}

IMAGE_CONTENT_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_IMAGE_PIXELS = 40_000_000


def validate_signature(stream: BinaryIO, content_type: str) -> None:
    signatures = FILE_SIGNATURES.get(content_type)
    if not signatures:
        raise HTTPException(status_code=422, detail="Định dạng tệp không được hỗ trợ")

    stream.seek(0)
    header = stream.read(16)
    if not any(header.startswith(signature) for signature in signatures):
        stream.seek(0)
        raise HTTPException(
            status_code=422,
            detail="Nội dung tệp không khớp với loại tệp đã khai báo",
        )
    if content_type == "image/webp" and header[8:12] != b"WEBP":
        stream.seek(0)
        raise HTTPException(status_code=422, detail="File WebP không hợp lệ")
    if content_type == "application/pdf":
        stream.seek(0, 2)
        size = stream.tell()
        stream.seek(max(0, size - 2048))
        if b"%%EOF" not in stream.read():
            stream.seek(0)
            raise HTTPException(status_code=422, detail="File PDF không hoàn chỉnh")
    stream.seek(0)


def validate_image(stream: BinaryIO, content_type: str) -> tuple[int, int]:
    if content_type not in IMAGE_CONTENT_TYPES:
        raise HTTPException(status_code=422, detail="Định dạng ảnh không được hỗ trợ")
    validate_signature(stream, content_type)
    try:
        with Image.open(stream) as image:
            width, height = image.size
            if width <= 0 or height <= 0 or width * height > MAX_IMAGE_PIXELS:
                raise HTTPException(
                    status_code=422,
                    detail="Kích thước ảnh không hợp lệ hoặc vượt giới hạn",
                )
            image.verify()
    except HTTPException:
        raise
    except (Image.DecompressionBombError, UnidentifiedImageError, OSError, ValueError) as exc:
        raise HTTPException(status_code=422, detail="Không thể giải mã ảnh tải lên") from exc
    finally:
        stream.seek(0)
    return width, height


def validate_declared_upload(
    stream: BinaryIO,
    filename: str | None,
    content_type: str | None,
    allowed_types: Mapping[str, str],
) -> tuple[str, str]:
    extension = Path(filename or "").suffix.casefold()
    expected_type = allowed_types.get(extension)
    if not expected_type or content_type != expected_type:
        raise HTTPException(
            status_code=415,
            detail="Phần mở rộng và Content-Type của tệp không hợp lệ",
        )
    if expected_type in IMAGE_CONTENT_TYPES:
        validate_image(stream, expected_type)
    else:
        validate_signature(stream, expected_type)
    return extension, expected_type


def validate_scan_response(response: str) -> None:
    normalized = response.strip().rstrip("\0")
    if normalized.endswith(" FOUND"):
        raise HTTPException(
            status_code=422,
            detail={"code": "MALWARE_DETECTED", "message": "Tệp bị từ chối do phát hiện mã độc"},
        )
    if not normalized.endswith(" OK"):
        raise HTTPException(
            status_code=503,
            detail={"code": "MALWARE_SCAN_UNAVAILABLE", "message": "Không thể xác minh an toàn tệp"},
        )


async def scan_stream(stream: BinaryIO) -> None:
    if not settings.MALWARE_SCAN_ENABLED:
        return
    writer = None
    stream.seek(0)
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(settings.CLAMAV_HOST, settings.CLAMAV_PORT),
            timeout=settings.CLAMAV_TIMEOUT_SECONDS,
        )
        writer.write(b"zINSTREAM\0")
        while chunk := stream.read(64 * 1024):
            writer.write(struct.pack("!I", len(chunk)))
            writer.write(chunk)
            await writer.drain()
        writer.write(struct.pack("!I", 0))
        await writer.drain()
        response = await asyncio.wait_for(
            reader.read(4096),
            timeout=settings.CLAMAV_TIMEOUT_SECONDS,
        )
        validate_scan_response(response.decode("utf-8", errors="replace"))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail={"code": "MALWARE_SCAN_UNAVAILABLE", "message": "Dịch vụ quét tệp chưa sẵn sàng"},
        ) from exc
    finally:
        stream.seek(0)
        if writer is not None:
            writer.close()
            try:
                await writer.wait_closed()
            except Exception:
                logger.debug("malware_scan_writer_close_failed", exc_info=True)
