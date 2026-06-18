"""Quick smoke test for the SSE stream.

Submits a video generation task and captures every event the server sends
back so we can verify whether progress events are actually emitted.
"""
import asyncio
import json
import time
import httpx


BASE = "http://localhost:8001"
LOGIN_PAYLOAD = {"email": "admin@pixelle.ai", "password": "Admin1234"}
GEN_PAYLOAD = {
    "text": "smoke-test gamming",
    "frame_template": "1080x1080/image_minimal_framed.html",
    "n_scenes": 2,
    "media_workflow": "runninghub/image_Z-image.json",
    "tts_workflow": "selfhost/tts_edge.json",
    "bgm_path": "bgm/default.mp3",
}


async def main() -> None:
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Auth
        resp = await client.post(f"{BASE}/api/auth/login", json=LOGIN_PAYLOAD)
        token = resp.json()["tokens"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Submit a task
        resp = await client.post(
            f"{BASE}/api/video/generate/async",
            json=GEN_PAYLOAD,
            headers=headers,
        )
        resp.raise_for_status()
        task_id = resp.json()["task_id"]
        print(f"[submit] task_id={task_id}")

        # 3. Open the SSE stream and tally events
        start = time.monotonic()
        events: list[tuple[str, dict, float]] = []
        async with client.stream(
            "GET",
            f"{BASE}/api/tasks/{task_id}/stream",
            headers={**headers, "Accept": "text/event-stream"},
        ) as r:
            async for raw in r.aiter_lines():
                if not raw:
                    continue
                # SSE blocks are `event: ...` then `data: ...`
                if raw.startswith("event:"):
                    evt_name = raw.split(":", 1)[1].strip()
                elif raw.startswith("data:"):
                    payload_raw = raw.split(":", 1)[1].strip()
                    try:
                        payload = json.loads(payload_raw)
                    except json.JSONDecodeError:
                        payload = {"_raw": payload_raw}
                    elapsed = time.monotonic() - start
                    events.append((evt_name, payload, elapsed))
                    print(f"[{elapsed:6.2f}s] {evt_name}: {payload}")

        # 4. Summarize
        print("\n--- summary ---")
        for name, _, _ in events:
            print(f"  {name}")
        kinds = {n for n, _, _ in events}
        print(f"event kinds seen: {kinds}")


if __name__ == "__main__":
    asyncio.run(main())
