"""Quick test: record 3 seconds from your mic and transcribe."""

import sounddevice as sd
import speech_recognition as sr
import numpy as np

print("Recording 3 seconds... speak now!")
audio = sd.rec(int(3 * 16000), samplerate=16000, channels=1, dtype="int16")
sd.wait()
print("Done recording. Transcribing...")

raw_bytes = audio.tobytes()
audio_data = sr.AudioData(raw_bytes, 16000, 2)
recognizer = sr.Recognizer()

try:
    text = recognizer.recognize_google(audio_data)
    print(f"You said: {text}")
except sr.UnknownValueError:
    print("Could not understand audio")
except sr.RequestError as e:
    print(f"Transcription error: {e}")
