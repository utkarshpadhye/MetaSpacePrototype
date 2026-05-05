import asyncio
import uuid
from collections import defaultdict

from fastapi import WebSocket


class NotificationHub:
    def __init__(self) -> None:
        self._connections: dict[tuple[uuid.UUID, uuid.UUID], set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, workspace_id: uuid.UUID, user_id: uuid.UUID, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections[(workspace_id, user_id)].add(websocket)

    async def disconnect(self, workspace_id: uuid.UUID, user_id: uuid.UUID, websocket: WebSocket) -> None:
        async with self._lock:
            key = (workspace_id, user_id)
            sockets = self._connections.get(key)
            if sockets is None:
                return
            sockets.discard(websocket)
            if not sockets:
                self._connections.pop(key, None)

    async def publish(self, workspace_id: uuid.UUID, user_id: uuid.UUID, payload: dict) -> None:
        async with self._lock:
            sockets = list(self._connections.get((workspace_id, user_id), set()))

        stale: list[WebSocket] = []
        for socket in sockets:
            try:
                await socket.send_json(payload)
            except Exception:
                stale.append(socket)

        if stale:
            async with self._lock:
                key = (workspace_id, user_id)
                current = self._connections.get(key)
                if current is None:
                    return
                for socket in stale:
                    current.discard(socket)
                if not current:
                    self._connections.pop(key, None)


notification_hub = NotificationHub()
