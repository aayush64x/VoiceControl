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


class VoiceTranscriber:
    def __init__(self, sample_rate=16000):
        self._sample_rate = sample_rate
        self._frames = []
        self._callback = None
        self.running = False
        self._recognizer = sr.Recognizer()
        self._stream = None

    async def start(self, callback):
        """Start recording. callback(text, is_final, error=None) is awaited once on stop."""
        self._callback = callback
        self._frames = []

        def audio_callback(indata, frames, time_info, status):
            if self.running:
                self._frames.append(indata.copy())

        try:
            self._stream = sd.InputStream(
                samplerate=self._sample_rate,
                channels=1,
                dtype="int16",
                blocksize=4096,
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
            text = await loop.run_in_executor(None, self._recognizer.recognize_google, audio)
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
