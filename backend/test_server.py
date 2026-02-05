"""
Quick test script to verify backend is working.
Run from backend folder: python test_server.py
"""
import asyncio
import httpx

async def test_backend():
    base_url = "http://localhost:8000"
    
    print("🧪 Testing Semantic Signaling Backend...")
    print("-" * 40)
    
    async with httpx.AsyncClient() as client:
        # Test 1: Health check
        try:
            resp = await client.get(f"{base_url}/")
            if resp.status_code == 200:
                print("✅ Health check passed:", resp.json())
            else:
                print("❌ Health check failed:", resp.status_code)
                return
        except Exception as e:
            print(f"❌ Cannot connect to server: {e}")
            print("\n💡 Make sure the server is running:")
            print("   cd backend")
            print("   uvicorn main:app --reload --port 8000")
            return
        
        # Test 2: Get config
        try:
            resp = await client.get(f"{base_url}/api/config")
            if resp.status_code == 200:
                config = resp.json()
                print(f"✅ Config loaded: LLM={config['llm_provider']}, Model={config['llm_model']}")
            else:
                print("❌ Config fetch failed")
        except Exception as e:
            print(f"❌ Config error: {e}")
        
        # Test 3: Start a game
        try:
            resp = await client.post(f"{base_url}/api/game/start", json={"num_players": 6})
            if resp.status_code == 200:
                data = resp.json()
                if data.get("success"):
                    state = data.get("state", {})
                    print(f"✅ Game started!")
                    print(f"   Secret word: {state.get('secretWord')}")
                    print(f"   Players: {len(state.get('players', []))}")
                    print(f"   Phase: {state.get('phase')}")
                else:
                    print("❌ Game start returned failure")
            else:
                print(f"❌ Game start failed: {resp.status_code}")
        except Exception as e:
            print(f"❌ Game start error: {e}")
        
        # Test 4: Get current state
        try:
            resp = await client.get(f"{base_url}/api/state")
            if resp.status_code == 200:
                state = resp.json()
                print(f"✅ State retrieved: Round {state.get('round')}, Phase {state.get('phase')}")
            else:
                print(f"⚠️  No active game state (expected if game not started)")
        except Exception as e:
            print(f"❌ State error: {e}")
    
    print("-" * 40)
    print("🎮 Backend test complete!")
    print("\n📡 WebSocket endpoint: ws://localhost:8000/ws")
    print("📚 API docs: http://localhost:8000/docs")

if __name__ == "__main__":
    asyncio.run(test_backend())
