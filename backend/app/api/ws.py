import asyncio
import json
import logging
import time

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from app.api.session_validation import validate_session_identity
from app.core.config import settings
from app.core.notification_bus import (
    NOTIFICATION_BUS_RETRY_CLOSE_CODE,
    NOTIFICATION_BUS_RETRY_CLOSE_REASON,
    notification_bus_ready,
)
from app.core.security import verify_token
from app.core.sockets import manager

logger = logging.getLogger(__name__)
router = APIRouter()

async def _accept_and_close(websocket: WebSocket, *, code: int, reason: str) -> None:
    """Complete the handshake so browsers receive the intended close code."""
    # A real Starlette WebSocket exposes CONNECTING before the handshake.
    # Lightweight adapters/tests may not expose client_state; in that case the
    # safest behavior is to send the close frame directly instead of assuming an
    # accept() method exists.
    client_state = getattr(websocket, "client_state", None)
    if client_state == WebSocketState.CONNECTING or not isinstance(client_state, WebSocketState):
        await websocket.accept()
    await websocket.close(code=code, reason=reason)


async def _close_unauthorized(websocket: WebSocket, reason: str) -> None:
    await _accept_and_close(websocket, code=1008, reason=reason)


@router.websocket("/notifications")
async def websocket_endpoint(websocket: WebSocket):
    if not settings.NOTIFICATIONS_REALTIME_ENABLED:
        await _accept_and_close(
            websocket,
            code=1000,
            reason="Realtime disabled",
        )
        return
    if not notification_bus_ready():
        await _accept_and_close(
            websocket,
            code=NOTIFICATION_BUS_RETRY_CLOSE_CODE,
            reason=NOTIFICATION_BUS_RETRY_CLOSE_REASON,
        )
        return

    token = websocket.cookies.get("access_token")
    if not token and settings.WS_ALLOW_QUERY_TOKEN:
        token = websocket.query_params.get("token")
        if token:
            logger.warning("websocket_query_token_deprecated")
    if not token:
        await _close_unauthorized(websocket, "Authentication required")
        return

    payload = verify_token(token)
    if not payload:
        await _close_unauthorized(websocket, "Invalid session")
        return
    identity = {
        "id": payload.get("sub"),
        "email": payload.get("email"),
        "role": payload.get("role"),
        "token_version": payload.get("token_version", 1),
        "session_id": payload.get("sid"),
    }
    try:
        identity = await validate_session_identity(identity)
    except HTTPException:
        await _close_unauthorized(websocket, "Invalid session")
        return

    employee_id = str(identity["id"])
    account_id = str(identity["account_id"])
    canary_ids = {
        value.strip()
        for value in settings.NOTIFICATIONS_REALTIME_CANARY_IDS.split(",")
        if value.strip()
    }
    if canary_ids and employee_id not in canary_ids:
        await _accept_and_close(
            websocket,
            code=1000,
            reason="Realtime canary disabled",
        )
        return
    role_value = identity["role"]
    role = getattr(role_value, "value", str(role_value)).split(".")[-1].upper()
    await manager.connect(websocket, role, account_id)
    if not notification_bus_ready():
        try:
            await websocket.close(
                code=NOTIFICATION_BUS_RETRY_CLOSE_CODE,
                reason=NOTIFICATION_BUS_RETRY_CLOSE_REASON,
            )
        finally:
            manager.disconnect(websocket, role, account_id)
        return
    recheck_seconds = float(settings.WS_SESSION_RECHECK_SECONDS)
    next_session_recheck = time.monotonic() + recheck_seconds
    try:
        await websocket.send_json({"type": "ready"})
        while True:
            data = None
            timed_out = False
            wait_seconds = next_session_recheck - time.monotonic()
            if wait_seconds <= 0:
                timed_out = True
            else:
                try:
                    data = await asyncio.wait_for(
                        websocket.receive_text(),
                        timeout=wait_seconds,
                    )
                except (asyncio.TimeoutError, TimeoutError):
                    timed_out = True

            # Client pings do not cause database reads.  Account/session state
            # is still checked at least once per configured revocation SLA,
            # even if a client continuously sends messages.
            if timed_out or time.monotonic() >= next_session_recheck:
                try:
                    identity = await validate_session_identity(identity)
                except HTTPException:
                    await websocket.close(code=1008, reason="Session revoked")
                    return
                next_session_recheck = time.monotonic() + recheck_seconds
                if timed_out:
                    continue

            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                continue
            if message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        logger.info(
            "websocket_disconnected",
            extra={"employee_id": employee_id, "role": role},
        )
    except Exception:
        logger.exception("websocket_connection_failed")
    finally:
        manager.disconnect(websocket, role, account_id)
