"""Tests for the WebSocket bridge server."""

import asyncio
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

import pytest
import websockets

import server


@pytest.fixture(autouse=True)
def reset_server_state():
    server.client = None
    server.pending = {}
    server.request_id = 0
    yield


@pytest.mark.asyncio
async def test_server_starts_and_accepts_connection():
    async with websockets.serve(server.handler, "localhost", 0) as ws_server:
        port = ws_server.sockets[0].getsockname()[1]
        async with websockets.connect(f"ws://localhost:{port}") as ws:
            assert server.client is not None


@pytest.mark.asyncio
async def test_send_command_returns_error_when_no_client():
    result = await server.send_command("list_elements")
    assert "error" in result
    assert "not connected" in result["error"].lower()


@pytest.mark.asyncio
async def test_send_command_gets_response():
    async with websockets.serve(server.handler, "localhost", 0) as ws_server:
        port = ws_server.sockets[0].getsockname()[1]
        async with websockets.connect(f"ws://localhost:{port}") as ws:
            await asyncio.sleep(0.05)

            async def fake_extension():
                raw = await ws.recv()
                msg = json.loads(raw)
                assert msg["type"] == "list_elements"
                await ws.send(json.dumps({
                    "id": msg["id"],
                    "result": {"elements": [{"num": 1, "type": "button", "label": "Go"}], "count": 1},
                }))

            result_task = asyncio.create_task(server.list_elements())
            await fake_extension()
            result = await result_task

            assert result["count"] == 1
            assert result["elements"][0]["label"] == "Go"


@pytest.mark.asyncio
async def test_send_action_command():
    async with websockets.serve(server.handler, "localhost", 0) as ws_server:
        port = ws_server.sockets[0].getsockname()[1]
        async with websockets.connect(f"ws://localhost:{port}") as ws:
            await asyncio.sleep(0.05)

            async def fake_extension():
                raw = await ws.recv()
                msg = json.loads(raw)
                assert msg["type"] == "action"
                assert msg["action"] == "click"
                assert msg["element"] == 5
                await ws.send(json.dumps({
                    "id": msg["id"],
                    "result": {"success": True, "action": "click", "element": 5, "label": "Submit"},
                }))

            result_task = asyncio.create_task(server.do_action("click", element=5))
            await fake_extension()
            result = await result_task

            assert result["success"] is True
            assert result["label"] == "Submit"


@pytest.mark.asyncio
async def test_disconnection_returns_error():
    async with websockets.serve(server.handler, "localhost", 0) as ws_server:
        port = ws_server.sockets[0].getsockname()[1]
        ws = await websockets.connect(f"ws://localhost:{port}")
        await asyncio.sleep(0.05)
        assert server.client is not None

        await ws.close()
        await asyncio.sleep(0.05)

        result = await server.send_command("list_elements")
        assert "error" in result


@pytest.mark.asyncio
async def test_pending_futures_cancelled_on_disconnect():
    async with websockets.serve(server.handler, "localhost", 0) as ws_server:
        port = ws_server.sockets[0].getsockname()[1]
        ws = await websockets.connect(f"ws://localhost:{port}")
        await asyncio.sleep(0.05)

        result_task = asyncio.create_task(server.list_elements())
        await asyncio.sleep(0.05)
        await ws.close()
        await asyncio.sleep(0.1)

        result = await result_task
        assert "error" in result
        assert "disconnect" in result["error"].lower()


@pytest.mark.asyncio
async def test_malformed_json_does_not_crash():
    async with websockets.serve(server.handler, "localhost", 0) as ws_server:
        port = ws_server.sockets[0].getsockname()[1]
        async with websockets.connect(f"ws://localhost:{port}") as ws:
            await asyncio.sleep(0.05)
            await ws.send("not valid json{{{")
            await asyncio.sleep(0.05)
            assert server.client is not None
