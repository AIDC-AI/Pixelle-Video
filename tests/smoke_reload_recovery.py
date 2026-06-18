"""Test that reconnecting to an in-flight task resumes the live stream.

This mimics the page-reload scenario:
  1. Submit a task
  2. Wait a bit so some progress has been made
  3. "Reload" — open a *new* SSE connection with the same task_id
  4. Verify the new connection replays the current state (status +
     progress) and keeps receiving subsequent events.
"""
import asyncio
import json
import time
import httpx


BASE = "http://localhost:8001"
LOGIN_PAYLOAD = {"email": "admin@pixelle.ai", "password": "Admin1234"}
GEN_PAYLOAD = {
    "text": "reload-recovery test",
    "frame_template": "1080x1080/image_minimal_framed.html",
    "n_scenes": 2,
    "media_workflow": "runninghub/image_Z-image.json",
    "tts_workflow": "selfhost/tts_edge.json",
    "bgm_path": "bgm/default.mp3",
}


async def collect_events(client: httpx.AsyncClient, headers: dict, task_id: str,
                        deadline_s: float) -> list[tuple[str, dict, float]]:
    events: list[tuple[str, dict, float]] = []
    start = time.monotonic()
    async with client.stream(
        "GET",
        f"{BASE}/api/tasks/{task_id}/stream",
        headers={**headers, "Accept": "text/event-stream"},
    ) as r:
        async for raw in r.aiter_lines():
            if time.monotonic() - start > deadline_s:
                break
            if not raw:
                continue
            if raw.startswith("event:"):
                evt_name = raw.split(":", 1)[1].strip()
            elif raw.startswith("data:"):
                payload = json.loads(raw.split(":", 1)[1].strip())
                events.append((evt_name, payload, time.monotonic() - start))
                if evt_name == "done":
                    break
    return events


async def main() -> None:
    async with httpx.AsyncClient(timeout=30.0) as client:
        token = (await client.post(f"{BASE}/api/auth/login", json=LOGIN_PAYLOAD)).json()["tokens"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Submit task
        r = await client.post(f"{BASE}/api/video/generate/async", json=GEN_PAYLOAD, headers=headers)
        r.raise_for_status()
        task_id = r.json()["task_id"]
        print(f"[submit] task_id={task_id}")

        # Wait so some progress has been published
        await asyncio.sleep(8)

        # Read state via the REST endpoint (this is what the new
        # useTaskStream's initial GET does on page reload)
        rest = (await client.get(f"{BASE}/api/tasks/{task_id}", headers=headers)).json()
        print(f"[rest snapshot] status={rest['status']} progress={rest.get('progress')}")

        # Reconnect to the SSE stream (simulating page reload)
        print("[reconnect] opening fresh SSE connection")
        events = await collect_events(client, headers, task_id, deadline_s=60.0)
        print(f"\n--- reconnect events ({len(events)}) ---")
        for name, payload, t in events:
            print(f"  [{t:6.2f}s] {name}: {payload}")
        kinds = {n for n, _, _ in events}
        print(f"\nreconnect event kinds: {kinds}")

        # Assertions
        assert "status" in kinds, "expected a status event on reconnect"
        first_status = next(p for n, p, _ in events if n == "status")
        assert first_status["status"] == "running", (
            f"expected running on reconnect, got {first_status['status']}"
        )
        assert first_status.get("progress"), (
            "expected the replayed status to carry the current progress — "
            "without this, the page would show 0% after reload"
        )
        print("\n[OK] reconnect replays the current status with progress")
        print(f"[OK] replayed progress = {first_status['progress']}")


if __name__ == "__main__":
    asyncio.run(main())
