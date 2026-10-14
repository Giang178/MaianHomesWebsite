from datetime import datetime, timezone

from app.db.mongodb import get_database


async def cleanup_expired_credentials() -> int:
    db = get_database()
    now = datetime.now(timezone.utc)
    total = 0
    while True:
        documents = await db["hr_credential_deliveries"].find(
            {"secret_expires_at": {"$lte": now}, "status": {"$in": ["PENDING", "PROCESSING"]}},
            {"account_id": 1},
        ).sort("_id", 1).limit(500).to_list(length=500)
        if not documents:
            return total
        delivery_ids = [document["_id"] for document in documents]
        expired = await db["hr_credential_deliveries"].update_many(
            {"_id": {"$in": delivery_ids}, "status": {"$in": ["PENDING", "PROCESSING"]}},
            {"$set": {"status": "EXPIRED", "updated_at": now}, "$unset": {"nonce": "", "ciphertext": ""}},
        )
        total += int(expired.modified_count)
        account_ids = [document.get("account_id") for document in documents if document.get("account_id")]
        if account_ids:
            from bson import ObjectId
            await db["user_accounts"].update_many(
                {"_id": {"$in": [ObjectId(value) for value in account_ids if ObjectId.is_valid(value)]},
                 "credential_delivery_status": "PENDING"},
                {"$set": {"credential_delivery_status": "EXPIRED", "updated_at": now}},
            )
