WEBSITE_PERMISSIONS = {
    "website.dashboard.read",
    "website.pages.read", "website.pages.create", "website.pages.update", "website.pages.review",
    "website.pages.publish", "website.pages.unpublish",
    "website.projects.read", "website.projects.create", "website.projects.update",
    "website.projects.publish", "website.projects.delete", "website.articles.read",
    "website.articles.create", "website.articles.update", "website.articles.publish",
    "website.articles.delete", "website.staff.read", "website.staff.create",
    "website.staff.update", "website.staff.publish", "website.staff.archive",
    "website.staff.delete",
    "website.recruitment.read", "website.recruitment.create", "website.recruitment.update",
    "website.recruitment.publish", "website.recruitment.archive", "website.seo.read",
    "website.seo.update", "website.seo.publish", "website.geo.read", "website.geo.update",
    "website.geo.publish", "website.leads.read", "website.leads.update",
    "website.leads.archive", "website.leads.export", "website.leads.delete",
    "website.analytics.read", "website.accounts.read", "website.accounts.create",
    "website.accounts.update", "website.accounts.disable", "website.permissions.manage",
    "website.audit.read", "website.system.monitoring.read", "website.system.monitoring.run",
    "website.system.email.read", "website.system.email.update", "website.system.email.test",
    "website.branding.read", "website.branding.update", "website.branding.publish",
    "website.media.read", "website.media.upload", "website.media.update", "website.media.delete",
    "website.workspaces.read", "website.workspaces.update", "website.workspaces.publish",
    "website.workspaces.delete",
}

MARKETING_FORBIDDEN_PERMISSIONS = {
    permission for permission in WEBSITE_PERMISSIONS
    if permission.startswith(("website.branding.", "website.media."))
    or (permission.startswith("website.pages.") and permission != "website.pages.read")
}

PERMISSION_DEPENDENCIES = {
    "website.branding.update": {"website.branding.read"},
    "website.branding.publish": {"website.branding.read", "website.branding.update"},
    "website.media.upload": {"website.media.read"},
    "website.media.update": {"website.media.read"},
    "website.media.delete": {"website.media.read"},
    "website.pages.create": {"website.pages.read"},
    "website.pages.update": {"website.pages.read"},
    "website.pages.review": {"website.pages.read"},
    "website.pages.publish": {"website.pages.read", "website.pages.update"},
    "website.pages.unpublish": {"website.pages.read"},
    "website.seo.update": {"website.seo.read"},
    "website.seo.publish": {"website.seo.read", "website.seo.update"},
    "website.geo.update": {"website.geo.read"},
    "website.geo.publish": {"website.geo.read", "website.geo.update"},
    "website.leads.update": {"website.leads.read"},
    "website.leads.archive": {"website.leads.read"},
    "website.leads.export": {"website.leads.read"},
    "website.leads.delete": {"website.leads.read"},
    "website.accounts.create": {"website.accounts.read"},
    "website.accounts.update": {"website.accounts.read"},
    "website.accounts.disable": {"website.accounts.read"},
    "website.permissions.manage": {"website.accounts.read"},
    "website.system.monitoring.run": {"website.system.monitoring.read"},
    "website.system.email.update": {"website.system.email.read"},
    "website.system.email.test": {"website.system.email.read"},
}

for domain in ("projects", "articles", "staff", "recruitment", "workspaces"):
    for action in ("create", "update", "publish", "archive", "delete"):
        permission = f"website.{domain}.{action}"
        if permission in WEBSITE_PERMISSIONS:
            PERMISSION_DEPENDENCIES.setdefault(permission, set()).add(f"website.{domain}.read")


def normalize_permissions(permissions) -> list[str]:
    """Validate a grant and add the minimum permissions it depends on."""
    normalized = {str(item).strip() for item in permissions if str(item).strip()}
    unknown = normalized - WEBSITE_PERMISSIONS
    if unknown:
        raise ValueError(sorted(unknown))
    changed = True
    while changed:
        before = len(normalized)
        for permission in tuple(normalized):
            normalized.update(PERMISSION_DEPENDENCIES.get(permission, set()))
        changed = len(normalized) != before
    return sorted(normalized)


DEFAULT_MARKETING_PERMISSIONS = sorted({
    item for item in WEBSITE_PERMISSIONS
    if not item.startswith("website.accounts.")
    and not item.startswith("website.permissions.")
    and not item.startswith("website.leads.")
    and not item.startswith("website.branding.")
    and not item.startswith("website.media.")
    and not item.startswith("website.pages.")
    and item != "website.audit.read"
    and not item.startswith("website.system.")
    and not item.endswith(".publish")
    and not item.endswith(".delete")
})

DEFAULT_MARKETING_PERMISSIONS = sorted(set(DEFAULT_MARKETING_PERMISSIONS) | {
    "website.dashboard.read",
    "website.pages.read",
    "website.seo.publish", "website.geo.publish",
})

DEFAULT_MARKETING_PERMISSIONS = normalize_permissions(DEFAULT_MARKETING_PERMISSIONS)
