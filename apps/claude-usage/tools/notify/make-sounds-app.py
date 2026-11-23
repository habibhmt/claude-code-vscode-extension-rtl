#!/usr/bin/env python3
"""Build ClaudeCache.aiff and ClaudeAdvisor.aiff in ~/Library/Sounds.

Both used to be copies of macOS's Glass and Hero — the very sounds the price
app (CryptoMenuBar) rings for its alerts, so a cache nudge sounded like a
price alarm. These are made here and used by no other app:

  ClaudeCache   — two soft, low knocks (A3 then E3), short and dry
  ClaudeAdvisor — one long soft note (G4) with a slow swell, no attack
"""

import math
import os
import struct
import subprocess
import tempfile
import wave

RATE = 44100
DIR = os.path.expanduser("~/Library/Sounds")


def knock(freq, secs):
    for i in range(int(RATE * secs)):
        t = i / RATE
        env = min(1.0, t / 0.002) * math.exp(-t * 38)
        yield env * (0.8 * math.sin(2 * math.pi * freq * t) + 0.2 * math.sin(2 * math.pi * freq * 2.7 * t))


def swell(freq, secs):
    n = int(RATE * secs)
    for i in range(n):
        t = i / RATE
        env = math.sin(math.pi * i / n) ** 2          # rises and falls, no click
        yield env * (0.85 * math.sin(2 * math.pi * freq * t) + 0.15 * math.sin(4 * math.pi * freq * t))


def write(name, samples, gain):
    out = os.path.join(DIR, name)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        wav = tmp.name
    with wave.open(wav, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b"".join(struct.pack("<h", int(s * gain * 32767)) for s in samples))
    subprocess.run(["afconvert", "-f", "AIFF", "-d", "BEI16", wav, out], check=True)
    os.unlink(wav)
    print(out)


def main():
    os.makedirs(DIR, exist_ok=True)
    cache = list(knock(220.0, 0.18)) + [0.0] * int(RATE * 0.12) + list(knock(164.81, 0.22))
    write("ClaudeCache.aiff", cache, 0.75)
    write("ClaudeAdvisor.aiff", list(swell(392.0, 0.9)), 0.55)


if __name__ == "__main__":
    main()
