from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List, Dict
import json

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        # Default channel is "broadcast"
        self.active_connections: Dict[str, List[WebSocket]] = {"broadcast": []}

    async def connect(self, websocket: WebSocket, channel: str = "broadcast"):
        await websocket.accept()
        if channel not in self.active_connections:
            self.active_connections[channel] = []
        self.active_connections[channel].append(websocket)

    def disconnect(self, websocket: WebSocket, channel: str = "broadcast"):
        if channel in self.active_connections and websocket in self.active_connections[channel]:
            self.active_connections[channel].remove(websocket)

    async def broadcast(self, message: str, channel: str = "broadcast"):
        """Sends message to all connections in a specific channel."""
        if channel not in self.active_connections:
            return
        for connection in self.active_connections[channel]:
            try:
                await connection.send_text(message)
            except Exception:
                pass

manager = ConnectionManager()

@router.websocket("/ws")
@router.websocket("/ws/{channel}")
async def websocket_endpoint(websocket: WebSocket, channel: str = "broadcast"):
    await manager.connect(websocket, channel)
    try:
        while True:
            # Receive message and check if it's a heartbeat (PING)
            # This is critical for keeping connections alive on Render/Nginx
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                if message.get("type") == "ping":
                    # Send PONG reply with timestamp to verify round-trip
                    await websocket.send_text(json.dumps({
                        "type": "pong", 
                        "timestamp": message.get("timestamp")
                    }))
            except (json.JSONDecodeError, AttributeError):
                # Ignore non-JSON or malformed messages in the heartbeat loop
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket, channel)
    except Exception:
        manager.disconnect(websocket, channel)
