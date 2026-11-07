#!/usr/bin/env python3
"""Draws the blinking-star background tile, the way the old space sites did it: a small animated GIF
that tiles seamlessly (stars wrap around the edges), 12 frames at 120 ms, hard on/off blinks, a few
four-point sparkles that grow and shrink. Shown at 2x by gate.css (image-rendering: pixelated) so the
stars are chunky on a phone screen.

    python3 tools/stars-gif.py        -> img/stars.gif (120x120, 12 frames) and img/stars.png (frame 1, for reduced motion)

Needs Pillow (python3 -m pip install pillow).
"""
import os
import random

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
N, FRAMES, MS = 120, 12, 120
rnd = random.Random(333)

BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
BLUE = (154, 154, 255)      # the site's link blue
PALE = (200, 200, 255)
RED = (255, 64, 64)
DUST = [(70, 70, 86), (96, 96, 116), (124, 124, 148)]


def wrap(x, y):
    return x % N, y % N


# ---------- the cast ----------
dust = [(rnd.randrange(N), rnd.randrange(N), rnd.choice(DUST)) for _ in range(72)]

stars = []
for _ in range(26):
    t = rnd.random()
    colour = BLUE if t < 0.22 else RED if t < 0.30 else WHITE
    on = rnd.randrange(FRAMES // 2, FRAMES)                  # frames lit per loop (mostly on)
    pattern = [1] * on + [0] * (FRAMES - on)
    rnd.shuffle(pattern)
    # a star that blinks every other frame looks like noise; merge runs so it blinks in beats
    for i in range(1, FRAMES - 1):
        if pattern[i - 1] == pattern[i + 1] != pattern[i] and rnd.random() < 0.6:
            pattern[i] = pattern[i - 1]
    wide = rnd.random() < 0.3                                 # a 2-pixel star
    stars.append((rnd.randrange(N), rnd.randrange(N), colour, pattern, wide))

sparkles = []
for _ in range(4):
    sparkles.append((rnd.randrange(N), rnd.randrange(N), rnd.choice([WHITE, PALE, BLUE]), rnd.randrange(FRAMES)))
SPARK = [0, 1, 2, 3, 2, 1, 0, 0, 0, 0, 0, 0]                 # arm length per frame of the sparkle cycle


def frame(f):
    im = Image.new("RGB", (N, N), BLACK)
    px = im.load()

    def put(x, y, c):
        x, y = wrap(x, y)
        px[x, y] = c

    for x, y, c in dust:
        put(x, y, c)
    for x, y, c, pattern, wide in stars:
        if not pattern[f]:
            continue
        put(x, y, c)
        if wide:
            put(x + 1, y, c)
    for x, y, c, phase in sparkles:
        arm = SPARK[(f + phase) % FRAMES]
        put(x, y, c if arm else DUST[2])
        for k in range(1, arm + 1):
            dim = tuple(int(v * (1 - 0.25 * k)) for v in c)
            put(x + k, y, dim); put(x - k, y, dim); put(x, y + k, dim); put(x, y - k, dim)
    return im


frames = [frame(f) for f in range(FRAMES)]
pal = [fr.quantize(colors=32, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE) for fr in frames]
out = os.path.join(ROOT, "img", "stars.gif")
pal[0].save(out, save_all=True, append_images=pal[1:], duration=MS, loop=0, disposal=1, optimize=False)
frames[0].save(os.path.join(ROOT, "img", "stars.png"), optimize=True)
print("wrote img/stars.gif: %dx%d, %d frames, %d bytes" % (N, N, FRAMES, os.path.getsize(out)))
