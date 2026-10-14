from fastapi import APIRouter, Depends

from app.api.deps import require_permissions
from app.modules.identity.permissions.catalog import (
    DEFAULT_MARKETING_PERMISSIONS,
    PERMISSION_DEPENDENCIES,
    WEBSITE_PERMISSIONS,
)

router = APIRouter(prefix="/website/permissions", tags=["Website Permissions"])


@router.get("")
async def list_permissions(
    current_user: dict = Depends(require_permissions("website.accounts.read")),
):
    return {
        "items": sorted(WEBSITE_PERMISSIONS),
        "dependencies": {key: sorted(value) for key, value in PERMISSION_DEPENDENCIES.items()},
        "presets": {
            "MARKETING": DEFAULT_MARKETING_PERMISSIONS,
            "ADMIN": sorted(WEBSITE_PERMISSIONS),
        },
    }
