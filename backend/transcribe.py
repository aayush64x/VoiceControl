"""Voice transcription using native mic capture + Google Speech Recognition.

Captures audio directly from the system microphone using sounddevice,
then transcribes using Google's free Speech Recognition API.
No browser permissions needed.
"""

import asyncio
import numpy as np
import sounddevice as sd
import speech_recognition as sr

# 0.1s of 16-bit mono audio at 16 kHz — anything shorter is a mis-click
MIN_AUDIO_BYTES = 3200


def voice_level(samples):
    """0..1 loudness of a block of int16 samples, for the panel's mascot.

    Maps -50 dBFS (quiet room) .. -10 dBFS (speaking up close) onto 0..1.
    """
    if samples is None or len(samples) == 0:
        return 0.0
    rms = float(np.sqrt(np.mean(np.square(samples.astype(np.float32) / 32768.0))))
    if rms <= 1e-6:
        return 0.0
    db = 20 * np.log10(rms)
    return float(min(1.0, max(0.0, (db + 50) / 40)))


class VoiceTranscriber:
    def __init__(self, sample_rate=16000, language="en-US"):
        self._sample_rate = sample_rate
        self.language = language  # Google speech language code: en-US, es-US, ko-KR
        self._frames = []
        self._callback = None
        self.running = False
        self._recognizer = sr.Recognizer()
        self._stream = None
        self.level = 0.0  # live loudness while recording (read by the server)

    async def start(self, callback):
        """Start recording. callback(text, is_final, error=None) is awaited once on stop."""
        self._callback = callback
        self._frames = []

        def audio_callback(indata, frames, time_info, status):
            if self.running:
                self._frames.append(indata.copy())
                self.level = voice_level(indata)

        try:
            self._stream = sd.InputStream(
                samplerate=self._sample_rate,
                channels=1,
                dtype="int16",
                blocksize=1024,  # ~64ms blocks: smooth enough for the live voice level
                callback=audio_callback,
            )
            self._stream.start()
        except Exception as exc:
            self._stream = None
            await callback("", True, error=f"Microphone unavailable: {exc}")
            return
        self.running = True

    async def feed(self, chunk):
        pass

    async def stop(self, transcribe=True):
        """Stop recording and, unless transcribe=False, send the result to the callback."""
        was_running = self.running
        self.running = False

        if self._stream:
            self._stream.stop()
            self._stream.close()
            self._stream = None

        frames, self._frames = self._frames, []
        if not was_running or not transcribe or not self._callback:
            return

        raw_bytes = np.concatenate(frames).tobytes() if frames else b""
        if len(raw_bytes) < MIN_AUDIO_BYTES:
            await self._callback("", True, error="No audio recorded")
            return

        audio = sr.AudioData(raw_bytes, self._sample_rate, 2)
        loop = asyncio.get_running_loop()
        try:
            # recognize_google is a blocking HTTP call — keep it off the event loop
            text = await loop.run_in_executor(
                None, lambda: self._recognizer.recognize_google(audio, language=self.language))
        except sr.UnknownValueError:
            await self._callback("", True, error="Could not understand audio")
            return
        except sr.RequestError as e:
            await self._callback("", True, error=f"Transcription error: {e}")
            return

        if text:
            await self._callback(text, True)
        else:
            await self._callback("", True, error="Could not understand audio")
