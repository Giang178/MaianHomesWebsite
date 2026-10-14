from fastapi.encoders import jsonable_encoder

PRIVATE_FIELDS = {
    "workflow_status", "publication_status", "created_by", "updated_by",
    "reviewed_by", "reviewed_at", "rejection_reason",
    "editor_owner_id", "ownership_status", "previous_editor_owner_ids",
    "ownership_transferred_at", "ownership_transferred_by", "is_provisional",
}


def serialize_article(document: dict, *, public: bool = False) -> dict:
    payload = dict(document)
    object_id = payload.pop("_id", None)
    if object_id is not None:
        payload["id"] = str(object_id)
    if public:
        for field in PRIVATE_FIELDS:
            payload.pop(field, None)
        payload.pop("author_email", None)
        payload.pop("author_id", None)
    return jsonable_encoder(payload)

