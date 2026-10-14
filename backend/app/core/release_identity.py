from pathlib import Path

_BAKED_IMAGE_REVISION_PATH = Path("/app/.image-revision")


def baked_image_revision() -> str:
    """Return the immutable revision baked into a container image.

    Source-tree executions intentionally return an empty value. Deployment and
    load-test gates treat an empty revision as invalid for staging/production.
    """

    try:
        return _BAKED_IMAGE_REVISION_PATH.read_text(encoding="utf-8").strip()
    except OSError:
        return ""
