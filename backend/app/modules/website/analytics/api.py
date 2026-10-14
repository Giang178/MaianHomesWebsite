from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from app.api.deps import require_permissions
from app.modules.website.analytics.service import analytics_service

router = APIRouter(prefix="/website/analytics", tags=["Website Analytics"])


@router.get("/summary")
async def get_analytics_summary(
    period: str = Query("30d", description="Time range: today, 7d, 30d, this_month, all"),
    date_from: str | None = Query(None, description="ISO datetime string start"),
    date_to: str | None = Query(None, description="ISO datetime string end"),
    current_user: dict = Depends(require_permissions("website.analytics.read")),
):
    """Retrieve comprehensive marketing and conversion analytics for website leads."""
    return await analytics_service.get_summary(
        period=period,
        date_from=date_from,
        date_to=date_to,
    )
