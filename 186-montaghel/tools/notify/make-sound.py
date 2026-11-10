#!/usr/bin/env python3
"""Build ~/Library/Sounds/ClaudeReply.aiff — the reply-done alarm.

A sound no other app uses: three rising bell notes (E5 → G#5 → B5, an E-major
arpeggio) with a soft decay, played twice. macOS's built-in sounds (Glass,
Submarine, ...) are shared by every app, so they could not tell a Claude reply
apart from anything else.
"""

import math
import os
import struct
import subprocess
import tempfile
import wave

RATE = 44100
NOTES = [659.25, 830.61, 987.77]  # E5, G#5, B5
NOTE_S, GAP_S, PAUSE_S = 0.16, 0.04, 0.18
OUT = os.path.expanduser("~/Library/Sounds/ClaudeReply.aiff")


def bell(freq, secs):
    n = int(RATE * secs)
    for i in range(n):
        t = i / RATE
        env = min(1.0, t / 0.005) * math.exp(-t * 14)
        # fundamental + a quiet octave for a bell-like colour
        yield env * (0.75 * math.sin(2 * math.pi * freq * t)
                     + 0.25 * math.sin(4 * math.pi * freq * t))


def main():
    samples = []
    for rep in range(2):
        for f in NOTES:
            samples += list(bell(f, NOTE_S))
            samples += [0.0] * int(RATE * GAP_S)
        if rep == 0:
            samples += [0.0] * int(RATE * PAUSE_S)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        wav = tmp.name
    with wave.open(wav, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b"".join(struct.pack("<h", int(s * 0.6 * 32767)) for s in samples))
    subprocess.run(["afconvert", "-f", "AIFF", "-d", "BEI16", wav, OUT], check=True)
    os.unlink(wav)
    print(OUT)


if __name__ == "__main__":
    main()
