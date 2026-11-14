# -*- coding: utf-8 -*-
"""Colours the build-banner ASCII art by sampling the felt patches it was drawn from.

`build_banner_art.txt` holds two things per picture: the ASCII drawing, and one palette letter
per character saying what colour to print it in. The drawing is authored by hand (or by an
image-to-ASCII converter); the colours are generated here, because hand-painting five thousand
characters is not a thing anyone should do twice.

Only the pictures drawn from a felt patch go through that. The wordmark has no patch and no
header image: it is two words in two colours, its colour blocks are written by hand, and this
script copies them over unchanged.

How it works: the drawing and the patch are lined up by their bounding boxes, so every character
cell covers a small rectangle of the .png, and the cell takes whichever palette entry wins a
majority vote among that rectangle's pixels. Cells that land just off the silhouette - the ASCII
outline overshoots it here and there - widen their search until they find felt, so an outline
keeps the colour of the edge it traces.

The palette matches against the colour in the photo but prints something else where the console
demands it: black felt is most of the skull and all of the frog's spikes, and near-black on a
dark terminal is a hole, so it prints as near-white. Everything else stays close to the original.

Needs Pillow (already a runtime dependency). Run after changing the art or the patches:

    py tools/make_banner_art.py
"""
import io
import os
import sys
from collections import Counter

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(HERE, 'build_banner_art.txt')

#      key: (colour in the photo,  xterm-256 index printed)
PALETTE = {
    'k': ((20, 20, 20),     252),   # black felt -> near-white, so it survives a dark console
    'K': ((70, 70, 70),     255),   # black felt, lighter edge
    'b': ((45, 33, 26),     246),   # pupil / eye socket, kept a shade darker than the felt
    'p': ((200, 24, 96),    161),   # mohawk pink, in shadow
    'P': ((240, 48, 120),   198),   # mohawk pink, lit
    'g': ((168, 192, 96),   149),   # felt green, light
    'G': ((120, 168, 72),   107),   # felt green, mid
    'D': ((96, 128, 48),     64),   # felt green, dark
    't': ((198, 168, 120),  180),   # eye ring / bone, tan
    's': ((190, 190, 190),  250),   # safety pin, metal
    'w': ((240, 240, 240),  255),   # stitching, eye highlight
}


def nearest(rgb):
    r, g, b = rgb
    best, bd = 'k', 1 << 30
    for key, (pal, _) in PALETTE.items():
        d = (r - pal[0]) ** 2 + (g - pal[1]) ** 2 + (b - pal[2]) ** 2
        if d < bd:
            bd, best = d, key
    return best


def colours_for(art, img_path):
    """One palette letter per character of `art`, sampled from the patch at `img_path`."""
    im = Image.open(img_path).convert('RGBA')
    px, alpha = im.load(), im.split()[3].load()
    W, H = im.size

    xs = [x for x in range(W) if any(alpha[x, y] > 40 for y in range(H))]
    ys = [y for y in range(H) if any(alpha[x, y] > 40 for x in range(W))]
    X0, X1, Y0, Y1 = min(xs), max(xs), min(ys), max(ys)

    ink = [(r, c) for r, line in enumerate(art) for c, ch in enumerate(line) if ch != ' ']
    R0, R1 = min(r for r, _ in ink), max(r for r, _ in ink)
    C0, C1 = min(c for _, c in ink), max(c for _, c in ink)
    cw = (X1 - X0 + 1) / float(C1 - C0 + 1)
    ch_ = (Y1 - Y0 + 1) / float(R1 - R0 + 1)

    def cell(r, c):
        for grow in (0, 1, 2, 3, 5, 8):
            x0 = X0 + (c - C0) * cw - grow * cw
            y0 = Y0 + (r - R0) * ch_ - grow * ch_
            votes = Counter()
            for yy in range(int(y0), int(y0 + ch_ * (1 + 2 * grow)) + 1):
                for xx in range(int(x0), int(x0 + cw * (1 + 2 * grow)) + 1):
                    if 0 <= xx < W and 0 <= yy < H and alpha[xx, yy] > 120:
                        votes[nearest(px[xx, yy][:3])] += 1
            if votes:
                return votes.most_common(1)[0][0]
        return 'k'

    return [''.join(' ' if c_ == ' ' else cell(r, c) for c, c_ in enumerate(line)).rstrip()
            for r, line in enumerate(art)]


def load(path):
    """Reads the data file into [(name, image, art_lines)], ignoring any colour blocks."""
    blocks, name, img, art = [], None, None, []
    for raw in io.open(path, encoding='utf-8').read().split('\n'):
        if raw.startswith('@'):
            if name and not name.endswith('.colours'):
                blocks.append((name, img, art))
            head = raw[1:].split()
            name, img, art = head[0], (head[1] if len(head) > 1 else None), []
        elif name and not raw.startswith('#'):
            art.append(raw.rstrip())
    if name and not name.endswith('.colours'):
        blocks.append((name, img, art))
    out = []
    for name, img, art in blocks:
        while art and not art[0].strip():
            art.pop(0)
        while art and not art[-1].strip():
            art.pop()
        out.append((name, img, art))
    return out


def kept_colours(path):
    """The colour blocks already in the file, for the pictures that are not sampled from a photo
    (the wordmark: white word, pink word). Those are written by hand and stay as they are."""
    out, name = {}, None
    for raw in io.open(path, encoding='utf-8').read().split('\n'):
        if raw.startswith('@'):
            head = raw[1:].split()[0]
            name = head[:-len('.colours')] if head.endswith('.colours') else None
            if name:
                out[name] = []
        elif name and not raw.startswith('#') and raw.strip():
            out[name].append(raw.rstrip())
    return out


def main():
    header = [ln for ln in io.open(DATA, encoding='utf-8').read().split('\n')
              if ln.startswith('#')]
    kept = kept_colours(DATA)
    out = list(header)
    for name, img, art in load(DATA):
        if not img:
            if name not in kept:
                sys.exit('block @%s has neither an image path nor a @%s.colours block'
                         % (name, name))
            out += ['', '@%s' % name] + art + ['', '@%s.colours' % name] + kept[name]
            print('%-10s %d rows x %d cols  (hand-set colours, left alone)'
                  % (name, len(art), max(len(l) for l in art)))
            continue
        mask = colours_for(art, os.path.join(ROOT, img))
        out += ['', '@%s %s' % (name, img)] + art + ['', '@%s.colours' % name] + mask
        print('%-8s %d rows x %d cols  %s' % (
            name, len(art), max(len(l) for l in art),
            ' '.join('%s:%d' % kv for kv in
                     Counter(c for l in mask for c in l if c != ' ').most_common())))
    io.open(DATA, 'w', encoding='utf-8', newline='\n').write('\n'.join(out) + '\n')


if __name__ == '__main__':
    main()
