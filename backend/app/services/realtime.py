"""In-memory WebSocket rooms. Works for a single Uvicorn worker; for several workers/servers
put Redis pub/sub behind `broadcast` (the rest of the code does not change)."""
from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.rooms: dict[str, dict[WebSocket, int]] = defaultdict(dict)

    async def connect(self, room: str, ws: WebSocket, user_id: int) -> None:
        # Register BEFORE accepting: once the client sees the handshake finish it may send
        # immediately, and it must already be in the room to receive broadcasts.
        self.rooms[room][ws] = user_id
        try:
            await ws.accept()
        except Exception:
            self.disconnect(room, ws)
            raise

    def disconnect(self, room: str, ws: WebSocket) -> None:
        self.rooms[room].pop(ws, None)
        if not self.rooms[room]:
            self.rooms.pop(room, None)

    async def broadcast(self, room: str, payload: dict, exclude: WebSocket | None = None) -> None:
        for ws in list(self.rooms.get(room, {})):
            if ws is exclude:
                continue
            try:
                await ws.send_json(payload)
            except Exception:
                self.disconnect(room, ws)

    def is_online(self, room: str, user_id: int) -> bool:
        return user_id in self.rooms.get(room, {}).values()


chat_manager = ConnectionManager()
tracking_manager = ConnectionManager()
