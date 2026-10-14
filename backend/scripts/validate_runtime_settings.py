"""Side-effect-free, redacted runtime Settings preflight for release images."""

from __future__ import annotations

import json
from typing import Any

from pydantic import ValidationError


def _safe_validation_errors(exc: ValidationError) -> list[dict[str, Any]]:
    return [
        {
            "location": ".".join(str(part) for part in item.get("loc", ())),
            "message": item.get("msg", "invalid setting"),
            "type": item.get("type", "validation_error"),
        }
        for item in exc.errors(include_input=False, include_url=False)
    ]


def main() -> int:
    try:
        from app.core.config import settings
        from app.core.release_identity import baked_image_revision
    except ValidationError as exc:
        print(
            json.dumps(
                {"settings": "invalid", "errors": _safe_validation_errors(exc)},
                sort_keys=True,
            )
        )
        return 2
    except Exception as exc:  # noqa: BLE001 - preflight must fail closed and redact
        print(
            json.dumps(
                {"settings": "invalid", "error_type": type(exc).__name__},
                sort_keys=True,
            )
        )
        return 2

    print(
        json.dumps(
            {
                "settings": "valid",
                "environment": settings.ENVIRONMENT,
                "deployment_tier": settings.DEPLOYMENT_TIER,
                "deployment_instance_id": settings.DEPLOYMENT_INSTANCE_ID,
                "release": settings.APP_RELEASE,
                "image_revision": baked_image_revision(),
            },
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
