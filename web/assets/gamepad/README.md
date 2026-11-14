# Controller artwork — two skins third-party (MIT), one ours

Two of the three drawings are **not** original RibbitFlip artwork. They come from
**Gamepad Viewer** by Michaël "e7d" Ferrand:

- Project: https://github.com/e7d/gamepad-viewer (and https://gamepad.e7d.io)
- Copyright (c) 2017-2020 Michaël "e7d" Ferrand
- Licence: MIT — full text in
  [`third_party_licenses/gamepad-viewer-LICENSE.txt`](../../../third_party_licenses/gamepad-viewer-LICENSE.txt)
- Upstream paths: `templates/xbox-one/` (this folder) and `templates/ds4/` (`ds4/`)

The **third**, in `wii/`, carries no third-party rights at all: that project has no Wii
template and none was found under a licence this app could use, so it is drawn from
primitives by [`tools/wii_art.py`](../../../tools/wii_art.py). Its own section is at the
foot of this file.

The skins in that project are themselves reworked from assets originally created
by **mrmcpowned** for [gamepadviewer.com](https://gamepadviewer.com); e7d credits
that origin in the project's README, and so does RibbitFlip — see
[`docs/CREDITS.md`](../../../docs/CREDITS.md).

The **shapes** are upstream's: every path, every coordinate, the whole 750 × 630
drawing. One shape was ADDED — the right trigger's wide facet, which upstream is
missing: the left trigger stub is drawn with two paths (89 px of shape) and the right
one with a single path (39 px), while the lit overlay is the full 89 px on both sides,
so RT lit up wider than the stub beneath it. What was added is the LEFT path mirrored
about the centre of the drawing (`translate(750 0) scale(-1 1)`), not a shape of our
own. Beyond that, what was changed is the **logo** and the **palette** — all three
described at the bottom of this file and all three applied by
[`tools/gamepad_art.py`](../../../tools/gamepad_art.py) — a script rather than a hand
edit, so that the difference from upstream can be re-derived and read instead of being
an unexplained binary diff. Point it at a folder of freshly fetched upstream files and
it prints every substitution it makes.

What RibbitFlip wrote itself is the CSS that composes the parts
([`web/css/14b-gamepad.css`](../../css/14b-gamepad.css), the geometry in it ported from
upstream's `template.css`) and the widget that lights them up from this app's own live
state ([`web/js/rf-42-padview.js`](../../js/rf-42-padview.js)). Upstream's own
`controller.js` reads the browser Gamepad API; none of it is used here.

| File | What it draws |
|---|---|
| `base-black.svg`, `base-white.svg` | the pad body, 750 × 630, two colourways |
| `bumper.svg` | a lit shoulder button (LB / RB, the right one mirrored) |
| `trigger.svg` | a lit trigger (LT / RT), clipped from the bottom by its value |
| `buttons.svg` | sprite: A B X Y, released on the top row, pressed on the bottom |
| `dpad.svg` | sprite: the four lit d-pad faces |
| `start-select.svg` | sprite: the lit Start and Back buttons |
| `stick.svg` | sprite: a stick, pressed and released |

## Modification 1: the mark on the Guide button

Upstream's body art draws the Guide button as a white disc with the console
maker's **logo** on it — one `<path>`, `d="M384.006 182.009…"`, in both colourways.
Both were **deleted**, leaving the disc: 51 paths upstream, 50 here.

Why: an MIT licence covers copyright, not somebody's trademark. RibbitFlip is
published, is not endorsed by any console maker, and does not need the mark to
say "this is the Guide button" — the disc is in the same place it always was, and
this app's own ring is what lights up when a rule points at it.

## Modification 2: the palette

Upstream draws a photoreal glossy **black** pad with the console's four primary
colours on the face buttons. Dropped onto RibbitFlip's cream felt panel that looked
like a photograph pasted into a sketchbook, and at column width it was the size of
the card it was meant to be one row of.

No shape was touched. Every colour was moved onto this app's palette by luminance,
so all of the original's moulding and shading survives:

| Upstream | Here |
|---|---|
| the body's greys (3 %–42 % luminance, crushed) | a warm espresso ramp, gamma-lifted so the moulding stays readable — same family as the app's dark chrome `#211f1d` |
| `base-white.svg`, the pale twin for dark overlays | the light end of the same warm ramp, held back from white so it does not glow on a dark card |
| the near-white "this button is down" overlays | the app's amber `--amber`, the one colour in the app that means "now" |
| A green / B red / X blue / Y yellow | the app's own data palette: `--gy`, `--ax`, `--gx`, `--az` — the coding survives, the console's primaries do not |
| the Guide disc, pure white | a muted warm tone; left cream it read as a hole punched through the pad |

Both modifications are permitted by the MIT licence and are recorded here rather
than in silence, so that anyone diffing against upstream knows they were on purpose.

## The `ds4/` folder — the second skin

A controller in this app can be an Xbox 360 pad, a DualShock 4 or a Wii controller
for emulators (the pad registry's `kind`). The second is drawn with
upstream's **`templates/ds4/`**, fetched and adapted exactly the same way — same
project, same MIT licence, same script (`python tools/gamepad_art.py ds4 <folder>`).
Nine files, laid out like the Xbox set except where upstream's own sprites differ:

| File | What it draws |
|---|---|
| `base-black.svg`, `base-white.svg` | the pad body, **806 × 599**, two colourways |
| `bumper.svg` | a lit shoulder button (L1 / R1, the right one mirrored by CSS) |
| `triggers.svg` | sprite: the lit L2 and R2, each its own cell — no mirroring |
| `buttons.svg` | sprite: ✕ ○ □ △ across, released on the top row, pressed on the bottom |
| `dpad.svg` | sprite: the four **arms**, resting row and pressed row — see below |
| `sticks.svg` | sprite: a stick released, then pressed-left and pressed-right |
| `start.svg` | the lit Share / Options button (one cell, mirrored for Options) |
| `touchpad.svg` | the lit touchpad plate (the click; the finger is drawn by CSS) |

Not taken: `base-blue.svg` / `base-red.svg` (colourways this app does not offer),
`disconnected.svg` and `meta.svg`. The PS button needs no lit sprite because the app
draws the controller's NUMBER there.

### `dpad.svg` is the d-pad ITSELF, not an overlay

Worth spelling out, because the opposite assumption cost a release. The DualShock body
art **has no cross on it**: it draws a round dish (a circle of r = 94.3 at 153.65,
244.767) and four small arrow markings out near its rim, and a scanline straight through
that dish reads one single tone from edge to edge. The arms live in `dpad.svg`, which
carries both states the way `buttons.svg` does for the face buttons — a dark row at rest
and a light one pressed.

So this one file is **not** ramped to the app's amber (it is absent from `DS4_LIT_FILES`
in `tools/gamepad_art.py`, unlike its Xbox namesake) and the CSS draws it **always**,
switching rows on press. Treated as a lit overlay it appeared only while a direction was
held, leaving a bare disc with four specks on it the rest of the time.

Two numbers that go with that, both measured rather than taken from upstream:

* **which cell is which direction.** Each arm has a rounded cap at its outer end and a
  tapered wedge at the inner one, where the four converge. They are told apart by how
  fast the width changes — a cap rounds over in ~5 px (22 → 34), a wedge narrows over
  15+ (16 → 6). All four agree, and with upstream's own up/down pairing:
  **x 0 = down · 37 = up · 74 = left · 128 = right.**
* **how big the cross is.** Upstream's 125 × 126 box puts the tips at a radius of 63 and
  leaves a 21 px hole in the middle. On a real DualShock the cross very nearly reaches
  its own arrow markings, whose inner edges sit at radii 76.8 / 75.7 / 75.4 / 74.2 — so
  the sprite is scaled by **1.333**, putting the tips at 72 (≥ 2.2 px clear of every
  marking) and the cross at 144 px across a 188.6 px dish.

### Modification 3: the mark on the PS button

Upstream draws the PlayStation logo on the PS button as **two `<path>`s** over a dark
disc. Both are **deleted**, in both colourways, for the same reason the Xbox logo was:
a copyright licence is not a trademark licence, this app is endorsed by nobody, and
the disc underneath still reads as a button. Unlike the Xbox skin there is no white
disc to repaint afterwards — this one is already dark.

The palette move is the same one described above, with one addition: the DualShock's
four face glyphs carry their own colour coding (✕ blue, ○ red, □ pink, △ green), so
they get their own map onto the app's palette — `--gx`, `--ax`, a muted magenta and
`--gy`. The app has no magenta token; leaving the square grey would have broken the
four-way coding that is the only reason those glyphs are not monochrome, so one was
mixed to sit in the same low-chroma range as the rest.

### One thing that is ours, not upstream's

The **sprite offsets** in `web/css/14b-gamepad.css` are not ported from upstream's
`template.css` the way the coordinates are. Upstream's are inconsistent in sign and do
not match the files it currently ships (e.g. its d-pad cells are quoted at 0 / 37 / 52
/ 104 where the artwork's actually sit at 0 / 37 / 74 / 128). They were measured off
the rendered artwork instead — a per-column and per-row alpha profile to find the cell
boundaries, and the cap-versus-wedge test above to tell the four d-pad directions apart —
and written in CSS's own convention, where a cell starting at image x is `-x`.

⚠ A **centre of mass** was used for that last job at first and got all four directions
BACKWARDS: the mass sits at the wide end, which names the arm's outer end rather than the
way it points. Anything that identifies a shape by where it is heaviest will do the same.

The **touchpad's** position was measured differently again, and exactly: the three paths
that draw the plate in `touchpad.svg` are also present in the body art, so the offset
between them is the answer. All three agree on **(271.001, 122.367)** to a thousandth of
a pixel. Upstream's `.touchpad` box (272, 122, with the image centred in a 262 × 151 box)
works out at (271.05, 121.9) — close, but measured beats close.

## The `wii/` folder — the third body, and the only one that is ours

Nothing in here comes from Gamepad Viewer or from anywhere else. The project has no Wii
template and no drawing of a Wii Remote was found under a licence this app could carry,
so it is drawn by [`../../../tools/wii_art.py`](../../../tools/wii_art.py) out of circles
and rounded rectangles.

**It is white, and that took saying twice.** The other two bodies go through the espresso
ramp in `tools/gamepad_art.py`, because they are photographs of black plastic and that ramp is
what stops them looking like a photograph dropped into a sketchbook. This one went through it
too at first and came out a **black** Wii Remote — a real product, but not the one anybody
pictures, and it was reported as looking wrong. The whiteness is half of what makes the shape
recognisable. So the palette here is written out instead: a warm white shell, with every accent
on it — the d-pad, the speaker grille, the player strip, the small buttons — drawn from the same
espresso family the other two pads live in. A real remote has that contrast built in.

The hard part is that a white shell on the cream panel (`#f6f1e5`) is nearly invisible on its
own: **1.08**. It is carried by a 3 px outline (**2.35**, about 1.3 px once the drawing is
scaled into its column) and an offset shadow, rather than by tinting the shell grey — tinting
it grey is how you get a controller that is no longer white. On the dark overlay card the same
drawing needs no help at all: body **16.7**, d-pad **10.6**.

Until 2026-08-25 the Wii kind borrowed the DualShock body, on the argument that the DSU
protocol describes a DualShock-shaped device. That is true of the WIRE and false of the
picture: you picked "Wii" and were shown a DualShock, and it was reported as exactly that.

| File | What it draws |
|---|---|
| `base-black.svg` | the whole drawing, **806 × 599**, on the dark end of the ramp |
| `base-white.svg` | the same shapes on the light end, for the two dark overlay looks |

There are no part sprites. The other two skins get their "pressed" look from upstream's
artwork; every part of this one is a circle or a rounded rectangle, so the lit state is a
fill and a radius in `14b-gamepad.css` and needs no file.

**What is in the picture.** A Wii Remote (d-pad, A, B underneath drawn as a tab on the
edge, 1, 2, minus, HOME, plus), a Nunchuk beside it (stick, C, Z) and a small strip
marked DSU on the right. The Nunchuk is there because a bare remote has no analog stick
and DSU carries one — without it the app's stick would point at nothing on the drawing.
The strip is there for the four inputs the protocol carries and this hardware has not
(R1, R2, R3 and the touch surface): they stay clickable because they stay mappable, and
putting them on the remote instead would have been a lie.

**The controller's NUMBER** goes into the player strip at the foot of the remote rather
than into HOME, where the other two skins put it. On a real Wii those four lamps say
which player you are, which is the very thing the digit says.

**Both halves of it are TRACED, and the remote only since 2026-08-25.** The Nunchuk was
measured off an outline from the day it appeared; the remote was drawn by eye, and it
showed, so a face-on
drawing of a remote, it was parsed contour by contour, and every position and size on
that half now comes from it: the shell's own ratio (1 : 3.833, so 144 × 552 here),
POWER at the top left, minus / HOME / plus as three circles, the speaker grille as a
3 × 6 grid **above** 1 and 2, the d-pad as a single plus 73 px across. The numbers stay
in the reference's frame in `tools/wii_art.py` (`REM_REF`, `REF_*`, mapped by `_rem()`),
so the outline can be put back on screen and checked against them.

The **stick** on the Nunchuk was measured the same day and by a different method: the
reference's regions were filled and their principal axes taken, which gives a centre, a
length, a width and an angle without guessing at any of them. It is a mushroom seen from
the side — a waisted stalk (24 traced points) under a cap whose long axis runs at 61°, so
the ellipse is tall and narrow rather than wide. It had been a wide ellipse tilted the
other way: a disc seen from ABOVE on a body drawn from the SIDE.

Two things are ours rather than the reference's, both on purpose. The **IR window went**:
this is the face of a remote, the reference draws nothing at the top of it, and the space
belongs to POWER. The **player lamps** are one recessed strip with three dividers instead
of four separate lamps — the reference's are 31 units square, which lands at 9 px here,
and the controller's NUMBER has to fit in that row.

**One rule worth keeping.** `tools/wii_art.py` prints the box of every part at the end of
a run, and those printed numbers are what `14b-gamepad.css` holds — pasted, never
re-measured. The four d-pad arms stop at the crossing band rather than running through
it: overlapping hotspots are not cosmetic, a click in an inner corner would land on
whichever box hit-tests first and "up" and "left" would take turns.
