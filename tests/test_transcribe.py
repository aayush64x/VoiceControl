"""Tests for the VoiceTranscriber (mocks the mic and Google Speech Recognition)."""

import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

import numpy as np
import pytest
import speech_recognition as sr
from transcribe import VoiceTranscriber


def _frames(n_samples):
    return [np.zeros((n_samples, 1), dtype="int16")]


@pytest.fixture
def mock_stream():
    with patch("transcribe.sd.InputStream") as cls:
        yield cls


@pytest.mark.asyncio
async def test_start_sets_running(mock_stream):
    t = VoiceTranscriber()
    await t.start(AsyncMock())
    assert t.running
    mock_stream.return_value.start.assert_called_once()


@pytest.mark.asyncio
async def test_start_reports_mic_error(mock_stream):
    mock_stream.side_effect = Exception("no device")
    t = VoiceTranscriber()
    cb = AsyncMock()
    await t.start(cb)
    assert not t.running
    cb.assert_awaited_once()
    assert "Microphone unavailable" in cb.await_args.kwargs["error"]


@pytest.mark.asyncio
async def test_stop_when_not_running_does_nothing():
    t = VoiceTranscriber()
    cb = AsyncMock()
    t._callback = cb
    await t.stop()
    assert not t.running
    cb.assert_not_awaited()


@pytest.mark.asyncio
async def test_stop_transcribes_and_sends_text(mock_stream):
    t = VoiceTranscriber()
    cb = AsyncMock()
    await t.start(cb)
    t._frames = _frames(16000)
    with patch.object(t._recognizer, "recognize_google", return_value="click five"):
        await t.stop()
    cb.assert_awaited_once_with("click five", True)
    mock_stream.return_value.close.assert_called_once()


@pytest.mark.asyncio
async def test_short_audio_reports_error(mock_stream):
    t = VoiceTranscriber()
    cb = AsyncMock()
    await t.start(cb)
    t._frames = _frames(10)
    await t.stop()
    assert cb.await_args.args[0] == ""
    assert cb.await_args.kwargs["error"] == "No audio recorded"


@pytest.mark.asyncio
async def test_no_frames_reports_error(mock_stream):
    t = VoiceTranscriber()
    cb = AsyncMock()
    await t.start(cb)
    await t.stop()
    assert cb.await_args.kwargs["error"] == "No audio recorded"


@pytest.mark.asyncio
async def test_unintelligible_audio_sends_error_not_text(mock_stream):
    t = VoiceTranscriber()
    cb = AsyncMock()
    await t.start(cb)
    t._frames = _frames(16000)
    with patch.object(t._recognizer, "recognize_google", side_effect=sr.UnknownValueError()):
        await t.stop()
    assert cb.await_args.args[0] == ""
    assert cb.await_args.kwargs["error"] == "Could not understand audio"


@pytest.mark.asyncio
async def test_request_error_sends_error(mock_stream):
    t = VoiceTranscriber()
    cb = AsyncMock()
    await t.start(cb)
    t._frames = _frames(16000)
    with patch.object(t._recognizer, "recognize_google", side_effect=sr.RequestError("offline")):
        await t.stop()
    assert cb.await_args.args[0] == ""
    assert "offline" in cb.await_args.kwargs["error"]


@pytest.mark.asyncio
async def test_cancel_skips_transcription(mock_stream):
    t = VoiceTranscriber()
    cb = AsyncMock()
    await t.start(cb)
    t._frames = _frames(16000)
    with patch.object(t._recognizer, "recognize_google") as rec:
        await t.stop(transcribe=False)
    rec.assert_not_called()
    cb.assert_not_awaited()
    assert t._frames == []


@pytest.mark.asyncio
async def test_audio_callback_only_records_while_running(mock_stream):
    t = VoiceTranscriber()
    await t.start(AsyncMock())
    audio_cb = mock_stream.call_args.kwargs["callback"]
    audio_cb(np.ones((4, 1), dtype="int16"), 4, None, None)
    t.running = False
    audio_cb(np.ones((4, 1), dtype="int16"), 4, None, None)
    assert len(t._frames) == 1


def test_default_config():
    assert VoiceTranscriber()._sample_rate == 16000


def test_voice_level_scale():
    from transcribe import voice_level
    assert voice_level(np.zeros(1024, dtype="int16")) == 0.0
    quiet = (np.random.default_rng(1).normal(0, 0.003 * 32768, 1024)).astype("int16")
    speech = (np.random.default_rng(2).normal(0, 0.08 * 32768, 1024)).astype("int16")
    assert voice_level(quiet) < 0.1
    assert 0.5 < voice_level(speech) <= 1.0
    assert voice_level(None) == 0.0


@pytest.mark.asyncio
async def test_audio_callback_tracks_level(mock_stream):
    t = VoiceTranscriber()
    await t.start(AsyncMock())
    audio_cb = mock_stream.call_args.kwargs["callback"]
    loud = (np.random.default_rng(3).normal(0, 0.2 * 32768, (1024, 1))).astype("int16")
    audio_cb(loud, 1024, None, None)
    assert t.level > 0.5


@pytest.mark.asyncio
async def test_transcribes_in_the_chosen_language(mock_stream):
    t = VoiceTranscriber(language="ko-KR")
    cb = AsyncMock()
    await t.start(cb)
    t._frames = _frames(16000)
    with patch.object(t._recognizer, "recognize_google", return_value="멈춰") as rec:
        await t.stop()
    assert rec.call_args.kwargs["language"] == "ko-KR"
    cb.assert_awaited_once_with("멈춰", True)
