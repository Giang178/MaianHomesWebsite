import asyncio
import json
import logging

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, set[WebSocket]] = {}
        self.user_connections: dict[str, set[WebSocket]] = {}
        self.connection_identity: dict[WebSocket, tuple[str, str]] = {}

    async def connect(self, websocket: WebSocket, role: str, account_id: str):
        await websocket.accept()
        self.active_connections.setdefault(role, set()).add(websocket)
        self.user_connections.setdefault(account_id, set()).add(websocket)
        self.connection_identity[websocket] = (role, account_id)
        logger.info(
            "websocket_connected user=%s role=%s active_connections=%d",
            account_id, role, len(self.connection_identity),
        )

    def disconnect(self, websocket: WebSocket, role: str, account_id: str):
        role_connections = self.active_connections.get(role)
        if role_connections is not None:
            role_connections.discard(websocket)
            if not role_connections:
                self.active_connections.pop(role, None)
        user_connections = self.user_connections.get(account_id)
        if user_connections is not None:
            user_connections.discard(websocket)
            if not user_connections:
                self.user_connections.pop(account_id, None)
        self.connection_identity.pop(websocket, None)
        logger.info(
            "websocket_disconnected user=%s role=%s active_connections=%d",
            account_id, role, len(self.connection_identity),
        )

    def _disconnect_failed(self, websocket: WebSocket) -> None:
        identity = self.connection_identity.get(websocket)
        if identity:
            self.disconnect(websocket, *identity)

    async def _send_many(self, connections: set[WebSocket], message: dict) -> None:
        failed = []
        encoded = json.dumps(message, ensure_ascii=False)
        for connection in list(connections):
            try:
                await connection.send_text(encoded)
            except Exception:
                failed.append(connection)
        for connection in failed:
            self._disconnect_failed(connection)

    async def send_personal_message(self, message: dict, account_id: str):
        connections = self.user_connections.get(account_id)
        if connections:
            await self._send_many(connections, message)

    async def broadcast_to_role(self, message: dict, role: str):
        connections = self.active_connections.get(role)
        if connections:
            await self._send_many(connections, message)

    async def broadcast_to_roles(self, message: dict, roles: tuple[str, ...]):
        for role in roles:
            await self.broadcast_to_role(message, role)

    async def broadcast(self, message: dict):
        seen: set[WebSocket] = set()
        for connections in list(self.active_connections.values()):
            unseen = set(connections) - seen
            seen.update(unseen)
            if unseen:
                await self._send_many(unseen, message)

    async def close_all(self, *, code: int, reason: str) -> None:
        """Close and forget every socket owned by this API process.

        Redis Pub/Sub is the cross-worker delivery path. If that subscription
        is lost, keeping these sockets open would make clients believe realtime
        delivery is healthy while notifications from other workers are missed.
        """
        connections = list(self.connection_identity)
        if not connections:
            return

        results = await asyncio.gather(
            *(connection.close(code=code, reason=reason) for connection in connections),
            return_exceptions=True,
        )
        failed_closes = sum(isinstance(result, Exception) for result in results)
        for connection in connections:
            self._disconnect_failed(connection)

        logger.warning(
            "websocket_connections_closed code=%s active_connections=%d failed_closes=%d",
            code,
            len(connections),
            failed_closes,
        )


manager = ConnectionManager()
