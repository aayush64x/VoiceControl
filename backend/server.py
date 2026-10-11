"""WebSocket server that bridges the Strands agent to the Chrome extension."""

import asyncio
import json
import time

import websockets

from transcribe import VoiceTranscriber

PORT = 8765
client = None
pending = {}
request_id = 0
last_page = None

on_user_input = None
_transcriber = None
_processing = False


async def handler(websocket):
    global client, _transcriber, _processing
    client = websocket
    print("[bridge] Extension connected")
    try:
        async for raw in websocket:
            if isinstance(raw, bytes):
                if _transcriber and _transcriber.running:
                    await _transcriber.feed(raw)
                continue

            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                print(f"[bridge] Ignoring malformed message")
                continue

            msg_type = msg.get("type")

            if msg_type == "voice_start":
                if _transcriber and _transcriber.running:
                    await _transcriber.stop()
                _transcriber = VoiceTranscriber()

                async def on_transcript(text, is_final):
                    if client:
                        await client.send(json.dumps({
                            "type": "transcript",
                            "text": text,
                            "is_final": is_final,
                        }))

                await _transcriber.start(on_transcript)
                print("[voice] Transcription started")
                continue

            if msg_type == "voice_stop":
                if _transcriber:
                    await _transcriber.stop()
                    _transcriber = None
                print("[voice] Transcription stopped")
                continue

            if msg_type == "user_said":
                text = msg.get("text", "").strip()
                if not text:
                    continue
                if _processing:
                    await websocket.send(json.dumps({
                        "type": "agent_response",
                        "text": "Still processing previous command...",
                    }))
                    continue
                _processing = True
                try:
                    if on_user_input:
                        await websocket.send(json.dumps({"type": "agent_thinking"}))
                        print(f"[voice] Processing: {text}")
                        result = await on_user_input(text)
                        await websocket.send(json.dumps({
                            "type": "agent_response",
                            "text": str(result),
                        }))
                    else:
                        await websocket.send(json.dumps({
                            "type": "agent_response",
                            "text": "Agent not ready. Start the backend with agent.py.",
                        }))
                finally:
                    _processing = False
                continue

            if msg.get("id") in pending:
                pending[msg["id"]].set_result(msg.get("result"))
            elif msg_type == "page_ready":
                global last_page
                last_page = msg
                print(f"[bridge] Page ready: {msg.get('title', '?')} ({msg.get('count', 0)} elements)")
    except websockets.ConnectionClosed:
        print("[bridge] Extension disconnected")
    finally:
        client = None
        if _transcriber and _transcriber.running:
            await _transcriber.stop()
            _transcriber = None
        _processing = False
        for rid, future in list(pending.items()):
            if not future.done():
                future.set_result({"error": "Extension disconnected."})


async def send_command(msg_type, timeout=10.0, **kwargs):
    """Send a command to the extension and wait for the result."""
    global request_id
    if not client:
        return {"error": "Extension not connected. Open the side panel in Chrome."}

    request_id += 1
    rid = request_id
    msg = {"id": rid, "type": msg_type, **kwargs}

    future = asyncio.get_running_loop().create_future()
    pending[rid] = future

    try:
        await client.send(json.dumps(msg))
        result = await asyncio.wait_for(future, timeout=timeout)
        return result
    except asyncio.TimeoutError:
        return {"error": "Timeout waiting for extension response."}
    except websockets.ConnectionClosed:
        return {"error": "Extension disconnected."}
    finally:
        pending.pop(rid, None)


async def list_elements():
    return await send_command("list_elements")


async def ask_user(question, yes_no=False):
    """Send a question to the side panel and wait for the user's answer."""
    return await send_command("ask_user", timeout=120.0, question=question, yes_no=yes_no)


async def do_action(action, element=None, value=None):
    kwargs = {"action": action}
    if element is not None:
        kwargs["element"] = element
    if value is not None:
        kwargs["value"] = value
    return await send_command("action", **kwargs)


async def interactive_mode():
    """Simple REPL for testing the bridge manually."""
    print("[bridge] Interactive mode. Commands: list, click N, type N text, scroll, back, open URL, quit")
    loop = asyncio.get_event_loop()

    while True:
        try:
            line = await loop.run_in_executor(None, lambda: input("\n> "))
        except (EOFError, KeyboardInterrupt):
            break

        line = line.strip()
        if not line:
            continue
        if line == "quit":
            break

        if line == "list":
            result = await list_elements()
            if result and "elements" in result:
                print(f"Found {result['count']} elements:")
                for el in result["elements"]:
                    print(f"  {el['num']}: {el['label']} ({el['type']}){el.get('value', '')}")
            else:
                print(result)
            continue

        parts = line.split(None, 2)
        action = parts[0]

        start = time.time()

        if action in ("scroll", "back"):
            value = parts[1] if len(parts) > 1 else None
            result = await do_action(action, value=value)
        elif action == "open":
            url = parts[1] if len(parts) > 1 else None
            result = await do_action("open", value=url)
        elif action in ("click", "type", "select"):
            element = int(parts[1]) if len(parts) > 1 else None
            value = parts[2] if len(parts) > 2 else None
            result = await do_action(action, element=element, value=value)
        else:
            print(f"Unknown: {action}")
            continue

        elapsed = (time.time() - start) * 1000
        if result and result.get("success"):
            print(f"OK: {json.dumps(result)} ({elapsed:.0f}ms)")
        else:
            print(f"FAIL: {result}")


async def main():
    print(f"[bridge] Starting on ws://localhost:{PORT}")
    try:
        async with websockets.serve(handler, "localhost", PORT):
            await interactive_mode()
    except OSError as e:
        if "address already in use" in str(e).lower():
            print(f"[bridge] Port {PORT} already in use. Stop the other server first.")
        else:
            raise


if __name__ == "__main__":
    asyncio.run(main())
