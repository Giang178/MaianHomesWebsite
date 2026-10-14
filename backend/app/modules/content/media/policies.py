from app.core.upload_security import (
    FILE_SIGNATURES,
    MAX_IMAGE_PIXELS,
    validate_image,
)

IMAGE_SIGNATURES = {
    content_type: FILE_SIGNATURES[content_type]
    for content_type in ("image/jpeg", "image/png", "image/gif", "image/webp")
}

__all__ = ["IMAGE_SIGNATURES", "MAX_IMAGE_PIXELS", "validate_image"]
