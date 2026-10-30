#!/usr/bin/env python3
"""Synthesizes the phase-change sounds (no recordings, no licences):

  whistle  a three-chime steam whistle, the chord whistle of American engines around 1880-1910:
           three tuned pipes sounding a minor triad, the breathy hiss of steam, the pitch scooping
           up as the valve opens and sagging as it closes; two long blasts ("proceed").
  horn     a five-chime diesel air horn for the first diesel (phase 7): brassy, a quick attack,
           steady pressure, a slightly sour chord; two blasts.

Writes tools/sounds/<name>.mp3 (embedded in index.html; MP3 plays in Safari and Chromium alike).
Usage: python3 tools/make-sounds.py
"""
import os
import subprocess
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 44100
rng = np.random.default_rng(1830)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sounds')
os.makedirs(OUT, exist_ok=True)


def band(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo / (SR / 2), hi / (SR / 2)], btype='band', output='sos'), x)


def smooth_noise(n, rate_hz, depth):
    """Slow random wandering (pressure and pitch are never perfectly steady)."""
    k = max(2, int(n / SR * rate_hz) + 2)
    pts = rng.standard_normal(k)
    return 1 + depth * np.interp(np.linspace(0, k - 1, n), np.arange(k), pts)


def env(n, attack, release, shape=2.0):
    t = np.arange(n) / SR
    dur = n / SR
    a = np.clip(t / attack, 0, 1) ** shape
    r = np.clip((dur - t) / release, 0, 1) ** 1.5
    return a * r


def tone(freqs, partials, dur, scoop=0.06, scoop_t=0.22, sag=0.025, vib=0.003):
    """Tuned pipes: each a few harmonics, with the valve's pitch scoop up and sag down."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    # pitch curve: starts low and rises as the valve opens, wanders a little, sags at the close
    curve = 1 - scoop * np.exp(-t / scoop_t * 3)
    curve *= 1 - sag * np.clip((t - (dur - 0.35)) / 0.35, 0, 1) ** 2
    curve *= smooth_noise(n, 3, vib) * (1 + 0.0025 * np.sin(2 * np.pi * 5.3 * t))
    out = np.zeros(n)
    for i, f0 in enumerate(freqs):
        det = 1 + rng.uniform(-0.003, 0.003)
        phase = 2 * np.pi * np.cumsum(f0 * det * curve) / SR
        amp = smooth_noise(n, 4, 0.06)
        for h, a in partials:
            out += a * amp * np.sin(h * phase + rng.uniform(0, 6.28))
    return out / len(freqs)


def steam_hiss(n, freqs, level):
    """Breath of steam: noise resonating in each pipe, plus a broad hiss."""
    noise = rng.standard_normal(n)
    out = sum(band(noise, f * 0.94, f * 1.06) for f in freqs) * 0.9
    out += band(noise, 2500, 9000) * 0.35
    return out * level


def reverb(x, seconds=1.1, mix=0.18):
    n = int(seconds * SR)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / SR * 5.5)
    ir = band(ir, 200, 6000)
    wet = fftconvolve(x, ir)[:len(x)]
    wet /= np.max(np.abs(wet)) + 1e-9
    return (1 - mix) * x / (np.max(np.abs(x)) + 1e-9) + mix * wet


def blast(freqs, dur, kind):
    n = int(dur * SR)
    if kind == 'whistle':
        body = tone(freqs, [(1, 1.0), (2, 0.28), (3, 0.09), (4, 0.03)], dur)
        hiss = steam_hiss(n, freqs, 0.22)
        # the valve: hiss first, the pipes speak a moment later; at the end the tone dies first
        e_body = env(n, 0.16, 0.30, 1.6)
        e_hiss = env(n, 0.03, 0.18, 1.0) * (0.55 + 0.45 * np.exp(-np.arange(n) / SR / 0.25))
        x = body * e_body + hiss * e_hiss
    else:
        # air horn: brassy reeds (rich harmonics), quick attack, almost no scoop, a little growl
        parts = [(h, 0.9 / h ** 1.15) for h in range(1, 14)]
        body = tone(freqs, parts, dur, scoop=0.02, scoop_t=0.08, sag=0.012, vib=0.0015)
        growl = 1 + 0.08 * np.sin(2 * np.pi * 31 * np.arange(n) / SR)
        x = body * growl * env(n, 0.05, 0.16, 1.2) + band(rng.standard_normal(n), 900, 5000) * 0.03 * env(n, 0.02, 0.1)
        x = band(x, 120, 7000, 1)
    return x


def sequence(freqs, pattern, kind):
    pieces = []
    for dur, gap in pattern:
        pieces.append(blast(freqs, dur, kind))
        pieces.append(np.zeros(int(gap * SR)))
    x = np.concatenate(pieces + [np.zeros(int(0.9 * SR))])
    return reverb(x, 1.2 if kind == 'whistle' else 0.9, 0.2 if kind == 'whistle' else 0.14)


def write(name, x, peak=0.7):
    x = x / (np.max(np.abs(x)) + 1e-9) * peak
    fade = np.linspace(1, 0, int(0.25 * SR))
    x[-len(fade):] *= fade
    wav = os.path.join(OUT, name + '.tmp.wav')
    pcm = (x * 32767).astype('<i2').tobytes()
    import wave
    with wave.open(wav, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-c:a', 'libmp3lame', '-b:a', '64k', '-ac', '1',
                    '-af', 'loudnorm=I=-18:TP=-2:LRA=7', '-ar', '44100', os.path.join(OUT, name + '.mp3')], check=True)
    os.remove(wav)                                          # keep only the small MP3 (it is what plays)
    print(name, round(len(x) / SR, 2), 's')


# steam: F minor triad (F4, A-flat4, C5): the mournful chord of a three-chime whistle
WHISTLE = [349.2, 415.3, 523.3]
# diesel: a five-chime horn chord (D#4 F#4 G#4 B4 D#5), slightly sour like the real thing
HORN = [311.1, 370.0, 415.3, 493.9, 622.3]

if __name__ == '__main__':
    write('whistle', sequence(WHISTLE, [(1.15, 0.28), (1.6, 0)], 'whistle'))
    write('horn', sequence(HORN, [(0.9, 0.22), (1.3, 0)], 'horn'))


def embed():
    """Puts the two MP3 files into index.html (generated block), so the app stays one offline file."""
    import base64, re
    page = os.path.join(os.path.dirname(OUT), '..', 'index.html')
    src = open(page, encoding='utf-8').read()
    data = {n: 'data:audio/mpeg;base64,' + base64.b64encode(open(os.path.join(OUT, n + '.mp3'), 'rb').read()).decode() for n in ('whistle', 'horn')}
    block = ('<script id="sounds">/* @generated sounds start: tools/make-sounds.py */\nwindow.BANKER_SOUNDS = { whistle: "' + data['whistle'] +
             '", horn: "' + data['horn'] + '" };\n/* @generated sounds end */</script>\n')
    if '<script id="sounds">' in src:
        src = re.sub(r'<script id="sounds">.*?</script>\n', lambda m: block, src, flags=re.S)
    else:
        src = src.replace('<script id="app">', block + '<script id="app">', 1)
    open(page, 'w', encoding='utf-8').write(src)
    print('index.html: sounds embedded (%d KB)' % (sum(len(v) for v in data.values()) // 1024))


if __name__ == '__main__':
    embed()
