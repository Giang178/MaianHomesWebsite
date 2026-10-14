from fastapi import Depends

from app.api.deps import require_permissions

marketing_user = Depends(require_permissions(
    "website.projects.update", "website.articles.update", "website.media.upload",
    require_all=False,
))
marketing_manager = Depends(require_permissions(
    "website.projects.publish", "website.articles.publish", "website.pages.publish",
    require_all=False,
))
marketing_reader = Depends(require_permissions(
    "website.projects.read", "website.articles.read", "website.media.read",
    require_all=False,
))

