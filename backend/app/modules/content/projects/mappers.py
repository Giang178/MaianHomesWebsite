from fastapi.encoders import jsonable_encoder

# Public project responses are allowlisted. New workflow, routing or assignment
# fields must never become public merely because they were added to a MongoDB
# document.
PUBLIC_PROJECT_FIELDS = {
    "name",
    "slug",
    "slogan",
    "tagline",
    "description",
    "developer",
    "developer_description",
    "location",
    "location_description",
    "location_distances",
    "map_embed_url",
    "location_map_image",
    "location_map_x",
    "location_map_y",
    "location_map_position",
    "hero_images",
    "hero_video_url",
    "master_plan_image",
    "amenity_map_image",
    "images",
    "stats_bg_image",
    "overview_images",
    "overview_image_position",
    "logo_url",
    "contact_bg_image",
    "primary_color",
    "accent_color",
    "section_colors",
    "contact_phone",
    "contact_email",
    "contact_title",
    "contact_description",
    "story_blocks",
    "master_plan_description",
    "price_range",
    "status",
    "stats",
    "towers",
    "amenities",
    "amenity_floors",
    "amenity_template",
    "amenity_gallery",
    "outdoor_amenities_description",
    "indoor_amenities_description",
    "interior_design_description",
    "highlights",
    "floor_layouts",
    "seo_metadata",
    "image_metadata",
    "marketing_tags",
    "is_featured",
    "created_at",
    "updated_at",
}

PUBLIC_PROJECT_SUMMARY_FIELDS = {
    "name",
    "slug",
    "logo_url",
    "images",
    "hero_images",
    "marketing_tags",
    "location",
    "status",
    "price_range",
    "is_featured",
    "created_at",
    "updated_at",
}

LIST_FIELDS = {
    "hero_images", "images", "overview_images", "location_distances", "story_blocks",
    "towers", "amenities", "amenity_floors", "amenity_gallery",
    "highlights", "floor_layouts", "marketing_tags", "image_metadata",
}

SEO_DEFAULTS = {
    "title": "",
    "description": "",
    "keywords": [],
    "focus_keyword": "",
    "cornerstone_text": "",
    "usps": [],
    "key_facts": [],
    "faqs": [],
    "sources": [],
    "image_alts": [],
}


def normalize_project_payload(document: dict) -> dict:
    payload = dict(document)
    for field in LIST_FIELDS:
        if not isinstance(payload.get(field), list):
            payload[field] = []
    for field in ("stats", "section_colors"):
        if not isinstance(payload.get(field), dict):
            payload[field] = {}
    seo = payload.get("seo_metadata")
    payload["seo_metadata"] = {
        **SEO_DEFAULTS,
        **(seo if isinstance(seo, dict) else {}),
    }
    for field in ("keywords", "usps", "key_facts", "faqs", "sources", "image_alts"):
        if not isinstance(payload["seo_metadata"].get(field), list):
            payload["seo_metadata"][field] = []
    return payload


def serialize_document(
    document: dict,
    *,
    public: bool = False,
    summary: bool = False,
) -> dict:
    payload = normalize_project_payload(document)
    object_id = payload.pop("_id", None)
    if object_id is not None:
        payload["id"] = str(object_id)
    if public:
        allowed = PUBLIC_PROJECT_SUMMARY_FIELDS if summary else PUBLIC_PROJECT_FIELDS
        payload = {
            field: value
            for field, value in payload.items()
            if field == "id" or field in allowed
        }
        if summary:
            # Keep the summary contract bounded even when a caller supplies an
            # unprojected document (for example in a unit test or compatibility
            # path).
            for field in ("images", "hero_images", "marketing_tags"):
                value = payload.get(field)
                payload[field] = value[:1] if isinstance(value, list) else []
    return jsonable_encoder(payload)

