import asyncio
import logging
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from uuid import uuid4

import aiosmtplib
from pymongo import ReturnDocument

from app.core.config import settings
from app.core.worker_health import heartbeat_loop
from app.db.mongodb import get_database
from app.modules.identity.invitations.secrets import (
    decrypt_secret_payload,
    encrypt_secret_payload,
)
from app.modules.system.settings.service import system_settings_service

logger = logging.getLogger(__name__)


def utcnow():
    return datetime.now(timezone.utc)


async def process_invitation_batch(limit: int = 20) -> int:
    identity_events = ["ACCOUNT_INVITATION", "PASSWORD_RESET"]
    await get_database()["outbox_events"].update_many(
        {
            "event_type": {"$in": identity_events},
            "status": {"$in": ["SENT", "DEAD", "FAILED", "EXPIRED"]},
            "payload.setup_url": {"$exists": True},
        },
        {"$unset": {"payload.setup_url": "", "secret": ""}, "$set": {"updated_at": utcnow()}},
    )
    allowed_events: list[str] = []
    if settings.ACCOUNT_CREDENTIAL_DELIVERY_ENABLED:
        allowed_events.append("ACCOUNT_INVITATION")
    if settings.PASSWORD_RESET_ENABLED:
        allowed_events.append("PASSWORD_RESET")
    if not allowed_events:
        return 0
    try:
        smtp = await system_settings_service.smtp_config(require_verified=True)
    except Exception:
        return 0
    processed = 0
    worker = f"identity-{uuid4().hex[:10]}"
    await get_database()["outbox_events"].update_many(
        {
            "event_type": {"$in": allowed_events},
            "status": {"$in": ["PENDING", "PROCESSING"]},
            "secret_expires_at": {"$lte": utcnow()},
        },
        {
            "$set": {"status": "EXPIRED", "updated_at": utcnow()},
            "$unset": {"secret": "", "payload.setup_url": "", "locked_until": "", "worker_id": ""},
        },
    )
    for _ in range(limit):
        now = utcnow()
        event = await get_database()["outbox_events"].find_one_and_update(
            {
                "event_type": {"$in": allowed_events},
                "available_at": {"$lte": now},
                "$or": [
                    {"status": "PENDING"},
                    {"status": "PROCESSING", "locked_until": {"$lte": now}},
                ],
                "$and": [{"$or": [
                    {"secret_expires_at": {"$gt": now}},
                    {"secret_expires_at": {"$exists": False}},
                ]}],
            },
            {
                "$set": {
                    "status": "PROCESSING", "worker_id": worker,
                    "locked_until": now + timedelta(minutes=2), "updated_at": now,
                },
                "$inc": {"attempts": 1},
            },
            sort=[("created_at", 1)], return_document=ReturnDocument.AFTER,
        )
        if not event:
            break
        try:
            payload = event.get("payload") or {}
            secret = event.get("secret")
            if secret:
                payload = {**payload, **decrypt_secret_payload(secret)}
            elif payload.get("setup_url"):
                # Upgrade legacy clear-text events before delivery.
                secret = encrypt_secret_payload({"setup_url": payload["setup_url"]})
                await get_database()["outbox_events"].update_one(
                    {"_id": event["_id"], "worker_id": worker},
                    {"$set": {"secret": secret, "updated_at": utcnow()}, "$unset": {"payload.setup_url": ""}},
                )
            message = EmailMessage()
            message["From"] = f"{smtp['from_name']} <{smtp['from_email']}>"
            message["To"] = payload.get("email")
            message["Subject"] = "Cấp tài khoản quản trị website Maian Homes"
            message.set_content(
                f"Xin chào {payload.get('full_name') or ''},\n\n"
                f"Vui lòng thiết lập mật khẩu tại: {payload.get('setup_url')}\n"
                f"Liên kết có hiệu lực trong {payload.get('expires_hours', 48)} giờ."
            )
            if event.get("event_type") == "PASSWORD_RESET":
                message.replace_header("Subject", "Đặt lại mật khẩu Maian Homes")
                message.set_content(f"Vui lòng đặt lại mật khẩu tại: {payload.get('setup_url')}. Liên kết có hiệu lực trong {payload.get('expires_minutes', 30)} phút.")
            await aiosmtplib.send(
                message, hostname=smtp["host"], port=smtp["port"],
                username=smtp["username"], password=smtp["password"],
                start_tls=bool(smtp.get("start_tls", True)), timeout=20,
            )
            await get_database()["outbox_events"].update_one(
                {"_id": event["_id"], "worker_id": worker},
                {
                    "$set": {"status": "SENT", "sent_at": utcnow(), "updated_at": utcnow()},
                    "$unset": {"locked_until": "", "worker_id": "", "secret": "", "payload.setup_url": ""},
                },
            )
            processed += 1
        except Exception as exc:
            attempts = int(event.get("attempts") or 1)
            dead = attempts >= 10
            await get_database()["outbox_events"].update_one(
                {"_id": event["_id"], "worker_id": worker},
                {
                    "$set": {
                        "status": "DEAD" if dead else "PENDING",
                        "last_error": str(exc)[:1000],
                        "available_at": utcnow() + timedelta(seconds=min(900, 2 ** attempts)),
                        "updated_at": utcnow(),
                    },
                    "$unset": {
                        "locked_until": "", "worker_id": "",
                        **({"secret": "", "payload.setup_url": ""} if dead else {}),
                    },
                },
            )
            logger.exception("Account invitation delivery failed")
    return processed


async def start_invitation_loop(interval_seconds: int = 3) -> None:
    heartbeat = asyncio.create_task(heartbeat_loop("invitation-worker"))
    try:
        while True:
            try:
                processed = await process_invitation_batch()
                if not processed:
                    await asyncio.sleep(interval_seconds)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Invitation worker loop failed")
                await asyncio.sleep(interval_seconds)
    finally:
        heartbeat.cancel()
        await asyncio.gather(heartbeat, return_exceptions=True)
