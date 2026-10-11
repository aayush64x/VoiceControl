"""Tests for the VoiceTranscriber (mocks AWS Transcribe)."""

import asyncio
import sys
import os
from unittest.mock import AsyncMock, MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

import pytest
from transcribe import VoiceTranscriber, _Handler


@pytest.mark.asyncio
async def test_feed_queues_audio():
    t = VoiceTranscriber()
    t._running = True
    t._queue = asyncio.Queue()
    await t.feed(b"\x00\x01\x02")
    assert t._queue.qsize() == 1
    chunk = await t._queue.get()
    assert chunk == b"\x00\x01\x02"


@pytest.mark.asyncio
async def test_feed_ignored_when_not_running():
    t = VoiceTranscriber()
    t._running = False
    t._queue = asyncio.Queue()
    await t.feed(b"\x00\x01")
    assert t._queue.qsize() == 0


@pytest.mark.asyncio
async def test_stop_when_not_running():
    t = VoiceTranscriber()
    await t.stop()
    assert not t.running


@pytest.mark.asyncio
async def test_audio_gen_stops_on_none():
    t = VoiceTranscriber()
    t._queue = asyncio.Queue()
    await t._queue.put(b"chunk1")
    await t._queue.put(b"chunk2")
    await t._queue.put(None)

    chunks = []
    async for c in t._audio_gen():
        chunks.append(c)
    assert chunks == [b"chunk1", b"chunk2"]


@pytest.mark.asyncio
async def test_running_property():
    t = VoiceTranscriber()
    assert not t.running
    t._running = True
    assert t.running


@pytest.mark.asyncio
async def test_start_sets_running():
    t = VoiceTranscriber()

    with patch("transcribe.TranscribeStreamingClient") as mock_client_cls:
        mock_stream = AsyncMock()
        mock_stream.output_stream = AsyncMock()
        mock_stream.input_stream = AsyncMock()
        mock_stream.input_stream.send_audio_event = AsyncMock()
        mock_stream.input_stream.end_stream = AsyncMock()
        mock_client_cls.return_value.start_stream_transcription = AsyncMock(return_value=mock_stream)

        callback = AsyncMock()
        await t.start(callback)
        assert t.running

        await t.stop()
        assert not t.running


@pytest.mark.asyncio
async def test_handler_routes_final():
    results_received = []

    async def cb(text, is_final):
        results_received.append((text, is_final))

    mock_result = MagicMock()
    mock_result.is_partial = False
    mock_alt = MagicMock()
    mock_alt.transcript = "hello world"
    mock_result.alternatives = [mock_alt]

    mock_event = MagicMock()
    mock_event.transcript.results = [mock_result]

    handler = _Handler(AsyncMock(), cb)
    await handler.handle_transcript_event(mock_event)

    assert len(results_received) == 1
    assert results_received[0] == ("hello world", True)


@pytest.mark.asyncio
async def test_handler_routes_partial():
    results_received = []

    async def cb(text, is_final):
        results_received.append((text, is_final))

    mock_result = MagicMock()
    mock_result.is_partial = True
    mock_alt = MagicMock()
    mock_alt.transcript = "hel"
    mock_result.alternatives = [mock_alt]

    mock_event = MagicMock()
    mock_event.transcript.results = [mock_result]

    handler = _Handler(AsyncMock(), cb)
    await handler.handle_transcript_event(mock_event)

    assert len(results_received) == 1
    assert results_received[0] == ("hel", False)


@pytest.mark.asyncio
async def test_default_config():
    t = VoiceTranscriber()
    assert t._region == "us-east-1"
    assert t._sample_rate == 16000
    assert t._language == "en-US"


@pytest.mark.asyncio
async def test_custom_config():
    t = VoiceTranscriber(region="us-west-2", sample_rate=8000, language="es-US")
    assert t._region == "us-west-2"
    assert t._sample_rate == 8000
    assert t._language == "es-US"
