"""
Backend smoke test for REST + WebSocket participant flow.

Run from backend folder:
  python test_server.py

Prerequisite:
  uvicorn main:app --reload --port 8000
"""
import asyncio
import json
from typing import Any

import httpx
import websockets


BASE_URL = "http://localhost:8000"
WS_URL = "ws://localhost:8000/ws"


def ws_payload(event_type: str, data: dict[str, Any] | None = None) -> str:
    return json.dumps({"type": event_type, "data": data or {}})


async def recv_json(ws, timeout: float = 5.0) -> dict[str, Any]:
    raw = await asyncio.wait_for(ws.recv(), timeout=timeout)
    return json.loads(raw)


async def drain_startup_messages(ws, attempts: int = 3) -> None:
    for _ in range(attempts):
        try:
            await recv_json(ws, timeout=0.6)
        except Exception:
            break


async def wait_for_type(ws, expected_type: str, timeout: float = 8.0) -> dict[str, Any]:
    end_time = asyncio.get_event_loop().time() + timeout
    while True:
        remaining = max(0.1, end_time - asyncio.get_event_loop().time())
        msg = await recv_json(ws, timeout=remaining)
        if msg.get("type") == "error" and expected_type != "error":
            raise RuntimeError(f"WebSocket error received: {msg.get('data')}")
        if msg.get("type") == expected_type:
            return msg
        if asyncio.get_event_loop().time() >= end_time:
            break
    raise TimeoutError(f"Timed out waiting for {expected_type}")


async def wait_for_session_state(ws, predicate, timeout: float = 8.0) -> dict[str, Any]:
    end_time = asyncio.get_event_loop().time() + timeout
    while True:
        remaining = max(0.1, end_time - asyncio.get_event_loop().time())
        msg = await recv_json(ws, timeout=remaining)
        event_type = msg.get("type")
        if event_type == "error":
            raise RuntimeError(f"WebSocket error received: {msg.get('data')}")
        if event_type == "session:info":
            data = msg.get("data") or {}
            if predicate(data):
                return msg
        if asyncio.get_event_loop().time() >= end_time:
            break
    raise TimeoutError("Timed out waiting for expected session:info state")


async def test_backend() -> None:
    print("🧪 Testing Semantic Signaling Backend (REST + WS participant flow)...")
    print("-" * 60)

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            health = await client.get(f"{BASE_URL}/")
            health.raise_for_status()
            print("✅ Health check:", health.json())
        except Exception as exc:
            print(f"❌ Cannot connect to backend: {exc}")
            print("\n💡 Start backend first:")
            print("   uvicorn main:app --reload --port 8000")
            return

        print("🔧 Setting engine config to auto_run=False for deterministic manual flow...")
        cfg_resp = await client.post(
            f"{BASE_URL}/api/config",
            json={
                "llm_provider": "gemini",
                "llm_model": "gemini-2.0-flash",
                "turn_delay_seconds": 2.0,
                "auto_run": False,
                "max_rounds": 3,
                "noisy_channel_mode": False,
                "noisy_channel_probability": 0.0,
                "delayed_information_turns": 0,
            },
        )
        cfg_resp.raise_for_status()
        print("✅ Config updated")

        start_resp = await client.post(f"{BASE_URL}/api/game/start", json={"num_players": 6}, timeout=120.0)
        start_resp.raise_for_status()
        start_data = start_resp.json()
        if not start_data.get("success"):
            raise RuntimeError("Game start returned success=False")
        state = start_data.get("state", {})

        players = state.get("players", [])
        if not players:
            raise RuntimeError("No players returned from start state")

        current_index = state.get("currentPlayerIndex", 0)
        current_player = players[current_index]
        participant_id = current_player["id"]
        target_id = next((p["id"] for p in players if p["id"] != participant_id), None)
        if not target_id:
            raise RuntimeError("Could not find vote target")

        print(f"✅ Game started with {len(players)} players")
        print(f"   Current turn player: {current_player['name']} ({participant_id})")

    # WebSocket role/participant checks
    async with websockets.connect(WS_URL) as participant_ws, websockets.connect(WS_URL) as observer_ws:
        await drain_startup_messages(participant_ws)
        await drain_startup_messages(observer_ws)

        # Move first client to participant mode and claim slot
        await participant_ws.send(ws_payload("session:set_mode", {"mode": "participant"}))
        session_info = await wait_for_session_state(
            participant_ws,
            lambda data: data.get("mode") == "participant",
        )
        if session_info.get("data", {}).get("mode") != "participant":
            raise RuntimeError("Participant mode did not apply")
        print("✅ Participant mode enabled")

        await participant_ws.send(ws_payload("player:claim_slot", {"playerId": participant_id}))
        claim_info = await wait_for_session_state(
            participant_ws,
            lambda data: data.get("participantPlayerId") == participant_id,
        )
        if claim_info.get("data", {}).get("participantPlayerId") != participant_id:
            raise RuntimeError("Participant slot claim failed")
        print("✅ Participant slot claimed")

        # Second client tries to claim same slot (should fail)
        await observer_ws.send(ws_payload("player:claim_slot", {"playerId": participant_id}))
        conflict_msg = await wait_for_type(observer_ws, "error")
        conflict_text = (conflict_msg.get("data") or {}).get("message", "")
        if "already claimed" not in conflict_text.lower():
            raise RuntimeError(f"Expected slot conflict error, got: {conflict_text}")
        print("✅ Slot lock enforcement verified")

        # Submit human clue from claimed participant
        await participant_ws.send(ws_payload("clue:submit", {"playerId": participant_id, "clue": "warm aroma"}))
        await wait_for_type(participant_ws, "clue:new")
        print("✅ Human clue submission accepted")

        # Switch to voting and submit human vote
        await participant_ws.send(ws_payload("game:set_phase", {"phase": "voting"}))
        await wait_for_type(participant_ws, "game:state")

        await participant_ws.send(
            ws_payload(
                "vote:submit",
                {"voterId": participant_id, "targetId": target_id, "reason": "smoke test vote"},
            )
        )
        await wait_for_type(participant_ws, "vote:new")
        print("✅ Human vote submission accepted")

    print("-" * 60)
    print("🎮 Backend smoke test passed")
    print("📡 WebSocket endpoint:", WS_URL)
    print("📚 API docs: http://localhost:8000/docs")


if __name__ == "__main__":
    asyncio.run(test_backend())
