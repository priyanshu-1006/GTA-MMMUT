"""Compose the 45-second Bullet and chai short score at 96 BPM.

Run with Python 3 and NumPy. The optional argument sets the WAV output path.
"""

from pathlib import Path
import sys
import wave

import numpy as np


RATE = 48_000
BEAT = 60 / 96
DURATION = 45
OUTPUT = Path(__file__).resolve().parents[2] / 'references/review/bullet-chai-score.wav'
rng = np.random.default_rng(42096)
mix = np.zeros((DURATION * RATE, 2), dtype=np.float64)


def timebase(duration):
    return np.arange(round(duration * RATE)) / RATE


def pitch(note):
    return 440 * 2 ** ((note - 69) / 12)


def envelope(t, attack, decay, release):
    return np.minimum(1, t / attack) * np.exp(-t / decay) * np.clip((t[-1] - t) / release, 0, 1)


def place(samples, beat, level, pan=0):
    start = round(beat * BEAT * RATE)
    length = min(len(samples), len(mix) - start)
    gains = np.sqrt([(1 - pan) / 2, (1 + pan) / 2]) * level
    mix[start:start + length] += samples[:length, None] * gains


def keys(note, duration):
    t = timebase(duration)
    phase = 2 * np.pi * pitch(note) * t
    tine = np.sin(phase + 0.63 * np.exp(-t * 7) * np.sin(2 * phase))
    overtones = 0.13 * np.exp(-t * 2) * np.sin(phase * 2.005) + 0.05 * np.exp(-t * 10) * np.sin(phase * 5.011)
    return (tine + overtones) * envelope(t, 0.008, 1.1, 0.35)


def pluck(note, duration):
    t = timebase(duration)
    phase = 2 * np.pi * pitch(note) * t
    overtones = sum(np.sin(n * phase + n * 0.12) * np.exp(-t * n * 2.3) / n ** 1.3 for n in range(1, 8))
    pick = np.diff(rng.uniform(-1, 1, len(t) + 1)) * 0.036 * np.exp(-t * 175)
    return (overtones + pick) * envelope(t, 0.006, 0.63, 0.13)


def bass(note, duration):
    t = timebase(duration)
    phase = 2 * np.pi * pitch(note) * t
    return (0.84 * np.sin(phase) + 0.14 * np.sin(2 * phase) + 0.06 * np.sin(3 * phase)) * envelope(t, 0.012, 0.7, 0.15)


def kick():
    t = timebase(0.31)
    phase = 2 * np.pi * (45 * t + 2.8 * (1 - np.exp(-t * 32)))
    return np.sin(phase) * envelope(t, 0.003, 0.074, 0.05)


def rim():
    t = timebase(0.17)
    noise = rng.uniform(-1, 1, len(t) + 2)
    snap = 0.48 * (noise[2:] - noise[:-2]) * np.exp(-t * 35)
    wood = (0.37 * np.sin(2 * np.pi * 426 * t) + 0.20 * np.sin(2 * np.pi * 730 * t)) * np.exp(-t * 56)
    return (snap + wood) * envelope(t, 0.001, 0.23, 0.02)


def shaker():
    t = timebase(0.09)
    noise = np.diff(rng.uniform(-1, 1, len(t) + 1))
    return noise * envelope(t, 0.013, 0.024, 0.02)


def cymbal():
    t = timebase(1.7)
    noise = np.diff(rng.uniform(-1, 1, len(t) + 1))
    partials = sum(np.sin(2 * np.pi * frequency * t) for frequency in [1281, 1734, 2517, 3689, 5022]) / 14
    return (noise * 0.31 + partials) * envelope(t, 0.014, 0.38, 0.2)


# C#m9, Amaj9, Emaj9 and Badd9, with an E6/9 resolution under the end card.
chords = [
    (37, (52, 56, 59, 63, 68)),
    (33, (52, 56, 59, 61, 64)),
    (40, (51, 54, 56, 59, 64)),
    (35, (51, 54, 59, 61, 66)),
    (40, (52, 56, 59, 61, 66)),
]
progression = [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 1, 2, 3, 0, 1, 2, 4]
motifs = [
    [(0.75, 68), (1.5, 71), (2.65, 73), (3.5, 71)],
    [(0.5, 68), (1.25, 66), (2.5, 64)],
    [(0.5, 66), (1.25, 68), (2.0, 71), (3.25, 68)],
    [(0.75, 66), (1.5, 63), (2.75, 66), (3.5, 68)],
    [(0.25, 64), (1.0, 68), (2.0, 71)],
]
kick_sample = kick()
rim_sample = rim()

for bar, chord in enumerate(progression):
    beat = bar * 4
    root, notes = chords[chord]
    riding = 3 <= bar < 8
    arriving = 8 <= bar < 11
    tea = 11 <= bar < 16
    card = 16 <= bar
    keys_level = 0.065 if riding else 0.072
    for index, note in enumerate(notes):
        strum = index * 0.036
        pan = (index - 2) * 0.19
        place(keys(note, 2.9 if card else 2.35), beat + strum, keys_level, pan)
        if riding or arriving:
            place(keys(note, 1.04), beat + 2.5 + strum, 0.027, -pan)

    melody_level = 0.1 if riding else 0.078
    melody = motifs[chord]
    if bar == 0:
        melody = [(1.5, 68), (3.0, 71)]
    if tea:
        melody = melody[::2]
    for index, (offset, note) in enumerate(melody):
        if card and bar == 17:
            note -= 12
        place(pluck(note, 0.96 if card else 0.72), beat + offset, melody_level, 0.2 if index % 2 == 0 else 0.02)

    if riding or arriving:
        for offset, note, length in [(0, root, 0.72), (1.5, root, 0.51), (2.5, root + 7, 0.63), (3.5, root + 12, 0.36)]:
            place(bass(note, length), beat + offset, 0.225 if riding else 0.15)
    elif bar == 2 or card or bar >= 14:
        place(bass(root, 1.75), beat, 0.16 if card else 0.10)

    if riding or arriving:
        for offset in (0, 1.75, 2.5) if riding else (0, 2.5):
            place(kick_sample, beat + offset, 0.48 if riding else 0.28)
        for offset in (1, 3):
            place(rim_sample, beat + offset + 0.022, 0.24 if riding else 0.14, -0.07)
        for step in range(8):
            swing = 0.045 if step % 2 else 0
            level = (0.095 if step % 2 else 0.065) * (1 if riding else 0.62)
            place(shaker(), beat + step / 2 + swing, level, 0.23 if step % 2 else -0.24)
    elif bar in (1, 2, 14, 15):
        for offset in (1.5, 2.5, 3.5):
            place(shaker(), beat + offset, 0.047, 0.17)

    if bar in (2, 3, 6, 8, 11, 14, 16):
        place(cymbal(), beat, 0.095 if bar in (3, 8, 16) else 0.055, 0.32)


# Cross-channel room taps leave the bass and kick centered.
dry = mix.copy()
for delay, gain in [(0.071, 0.075), (0.127, 0.055), (0.187, 0.042), (0.263, 0.026), (0.361, 0.019)]:
    offset = round(delay * RATE)
    mix[offset:] += dry[:-offset, ::-1] * gain

fade = timebase(1.4) / 1.4
mix[-len(fade):] *= np.cos(fade * np.pi / 2)[:, None] ** 2
mix = np.tanh(mix * 1.13)
mix *= (10 ** (-3 / 20)) / np.max(np.abs(mix))
output = Path(sys.argv[1]) if len(sys.argv) > 1 else OUTPUT
output.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(output), 'wb') as wav:
    wav.setparams((2, 2, RATE, 0, 'NONE', 'not compressed'))
    wav.writeframes(np.round(mix * 32767).astype('<i2').tobytes())
print(output.resolve())
