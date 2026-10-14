from pymongo import ASCENDING, DESCENDING, IndexModel


async def ensure_website_indexes(db) -> None:
    """Create only collections and indexes used by the website runtime."""
    collections = {
        "permission_presets", "account_invitations", "website_settings", "website_pages",
        "website_setting_versions",
        "website_page_versions", "media_assets", "media_usage", "projects", "articles",
        "public_staff_profiles", "public_staff_profile_versions", "job_postings", "website_leads", "job_applications",
        "export_audits", "activity_events", "outbox_events", "idempotency_records", "website_idempotency",
        "workspace_coworking", "workspace_seat_types", "workspace_pricing_plans",
        "workspace_office_landing", "workspace_office_buildings", "workspace_office_units", "workspace_faqs",
    }
    existing = set(await db.list_collection_names())
    for name in collections - existing:
        await db.create_collection(name)

    await db["user_accounts"].create_index("normalized_email", unique=True, name="uq_account_email")
    await db["website_pages"].create_index("page_key", unique=True, name="uq_website_page_key")
    await db["website_page_versions"].create_index(
        [("page_key", ASCENDING), ("version", DESCENDING)], unique=True, name="uq_page_version"
    )
    await db["website_setting_versions"].create_index("version", unique=True, name="uq_website_setting_version")
    await db["website_leads"].create_indexes([
        IndexModel([("submitted_at", DESCENDING)], name="idx_leads_submitted"),
        IndexModel([("status", ASCENDING), ("submitted_at", DESCENDING)], name="idx_leads_status"),
        IndexModel([("source", ASCENDING), ("submitted_at", DESCENDING)], name="idx_leads_source"),
        IndexModel([("form_id", ASCENDING), ("submitted_at", DESCENDING)], name="idx_leads_form"),
        IndexModel([("project_id", ASCENDING), ("submitted_at", DESCENDING)], name="idx_leads_project"),
        IndexModel([("normalized_phone", ASCENDING)], name="idx_leads_phone"),
        IndexModel([("email", ASCENDING)], name="idx_leads_email"),
    ])
    await db["public_staff_profiles"].create_index(
        "slug", unique=True, partialFilterExpression={"slug": {"$type": "string"}}, name="uq_public_staff_slug"
    )
    await db["public_staff_profile_versions"].create_index(
        [("profile_id", ASCENDING), ("version", DESCENDING)], unique=True, name="uq_public_staff_version"
    )
    await db["media_usage"].create_index(
        [("reference", ASCENDING), ("media_id", ASCENDING)], unique=True, name="uq_media_usage_reference"
    )
    await db["job_postings"].create_index(
        "slug", unique=True, partialFilterExpression={"slug": {"$type": "string"}}, name="uq_job_slug"
    )
    await db["media_assets"].create_index("checksum", name="idx_media_checksum")
    await db["media_assets"].create_index([("namespace", ASCENDING), ("created_at", DESCENDING)], name="idx_website_media_namespace")
    await db["media_assets"].create_index([("lifecycle_status", ASCENDING), ("created_at", DESCENDING)], name="idx_website_media_status")
    await db["account_invitations"].create_index("token_hash", unique=True, name="uq_invitation_token")
    await db["account_invitations"].create_index("expires_at", expireAfterSeconds=0, name="ttl_invitation")
    await db["outbox_events"].create_index(
        [("event_type", ASCENDING), ("status", ASCENDING), ("available_at", ASCENDING)],
        name="idx_identity_outbox_delivery",
    )
    await db["outbox_events"].create_index(
        "secret_expires_at", expireAfterSeconds=0, name="ttl_identity_outbox_secret"
    )
    await db["idempotency_records"].create_index("key", unique=True, name="uq_idempotency_key")
    await db["idempotency_records"].create_index("expires_at", expireAfterSeconds=0, name="ttl_idempotency")
    await db["website_idempotency"].create_index(
        "identity", unique=True, name="uq_website_idempotency_identity"
    )
    await db["website_idempotency"].create_index(
        "expires_at", expireAfterSeconds=0, name="ttl_website_idempotency"
    )
    await db["website_idempotency"].create_index(
        [("state", ASCENDING), ("lease_until", ASCENDING)],
        name="idx_website_idempotency_lease",
    )
    await db["export_audits"].create_index([("created_at", DESCENDING)], name="idx_export_audit_time")

    # Workspace Solutions Indexes
    await db["workspace_coworking"].create_index("key", unique=True, name="uq_workspace_coworking_key")
    await db["workspace_office_landing"].create_index("key", unique=True, name="uq_workspace_office_landing_key")
    await db["workspace_office_buildings"].create_index(
        "slug", unique=True, partialFilterExpression={"slug": {"$type": "string"}}, name="uq_workspace_building_slug"
    )
    await db["workspace_office_units"].create_indexes([
        IndexModel([("building_id", ASCENDING), ("unit_code", ASCENDING)], unique=True, name="uq_building_unit_code"),
        IndexModel([("building_id", ASCENDING), ("status", ASCENDING)], name="idx_building_unit_status"),
    ])
    await db["workspace_faqs"].create_index(
        [("entity_type", ASCENDING), ("entity_id", ASCENDING), ("display_order", ASCENDING)],
        name="idx_workspace_faqs_entity",
    )
