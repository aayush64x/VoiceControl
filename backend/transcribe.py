"""AWS Transcribe Streaming integration for voice input.

Captures PCM audio chunks from the WebSocket, streams them to AWS Transcribe,
and returns partial/final transcription results via a callback.
"""

import asyncio

from amazon_transcribe.client import TranscribeStreamingClient
from amazon_transcribe.handlers import TranscriptResultStreamHandler
from amazon_transcribe.model import TranscriptEvent


class _Handler(TranscriptResultStreamHandler):
    """Routes transcript events to a callback."""

    def __init__(self, output_stream, callback):
        super().__init__(output_stream)
        self._callback = callback

    async def handle_transcript_event(self, transcript_event: TranscriptEvent):
        for result in transcript_event.transcript.results:
            for alt in result.alternatives:
                await self._callback(alt.transcript, not result.is_partial)


class VoiceTranscriber:
    """Manages one streaming transcription session with AWS Transcribe."""

    def __init__(self, region="us-east-1", sample_rate=16000, language="en-US"):
        self._region = region
        self._sample_rate = sample_rate
        self._language = language
        self._queue = None
        self._running = False
        self._task = None

    @property
    def running(self):
        return self._running

    async def start(self, callback):
        """Start transcription. callback(text, is_final) is awaited for each result."""
        if self._running:
            return
        self._running = True
        self._queue = asyncio.Queue()
        self._task = asyncio.create_task(self._run(callback))

    async def stop(self):
        """Stop the transcription session gracefully."""
        if not self._running:
            return
        self._running = False
        if self._queue:
            await self._queue.put(None)
        if self._task:
            try:
                await asyncio.wait_for(self._task, timeout=5)
            except (asyncio.TimeoutError, asyncio.CancelledError, Exception):
                self._task.cancel()
            self._task = None

    async def feed(self, chunk: bytes):
        """Feed raw PCM audio (16-bit signed, 16 kHz, mono)."""
        if self._running and self._queue:
            await self._queue.put(chunk)

    async def _audio_gen(self):
        """Async generator yielding audio chunks until None sentinel."""
        while True:
            chunk = await self._queue.get()
            if chunk is None:
                break
            yield chunk

    async def _run(self, callback):
        try:
            client = TranscribeStreamingClient(region=self._region)
            stream = await client.start_stream_transcription(
                language_code=self._language,
                media_sample_rate_hz=self._sample_rate,
                media_encoding="pcm",
            )
            handler = _Handler(stream.output_stream, callback)

            async def send_audio():
                async for chunk in self._audio_gen():
                    await stream.input_stream.send_audio_event(audio_chunk=chunk)
                await stream.input_stream.end_stream()

            await asyncio.gather(send_audio(), handler.handle_events())
        except Exception as exc:
            self._running = False
            await callback(f"[Transcription error: {exc}]", True)
