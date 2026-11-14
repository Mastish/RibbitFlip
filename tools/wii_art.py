"""Draw the Wii controller — the third body, and the only one that is OURS.

The Xbox and DualShock skins come from Gamepad Viewer (MIT, see docs/CREDITS.md). There is no
Wii Remote in that project and none was found under a licence this app could carry, so this one
is drawn here, from primitives, and generated rather than hand-written for two reasons: the two
colourways stay in step by construction, and every coordinate below is also the coordinate the
CSS uses, so the drawing and its hotspots cannot drift apart.

WHY IT EXISTS AT ALL. A Wii controller used to be drawn with the DualShock body, on the argument
that the DSU protocol describes a DualShock-shaped device. That is true of the WIRE and false of
the picture: you picked "Wii" and were shown a DualShock, which the owner reported twice. Three
kinds of controller now mean three distinct drawings.

WHAT IS DRAWN, and why a Nunchuk is in it. A bare Wii Remote has no analog stick, and DSU carries
one — so a remote on its own would leave the app's stick pointing at nothing on the picture. The
Nunchuk is the part of the real hardware that HAS that stick, so it is drawn beside the remote and
the stick lives on it, where a player would look for it.

THE REMOTE IS TRACED NOW, like the Nunchuk beside it always was. What stood here until 2026-08-25
was drawn by eye — the proportions and the spacing were guessed, and it showed. Every position
and size on the remote below is now MEASURED off a reference outline, in that drawing's own
frame; see REM_REF.

WHAT THE STRIP ON THE RIGHT IS. DSU describes rather more than a remote and a nunchuk hold — a
right stick, R1, R2 and a touch surface have no counterpart on this hardware, but they do go out
on the wire and an emulator can bind them. Hiding them would make four mappings that work and
cannot be clicked; drawing them on the remote would be a lie. So they sit apart, small and
labelled DSU, which is what they are.

THE PALETTE is written out below rather than ramped, and that is the one place this body parts
company with the other two. They are photographs of black plastic and the espresso ramp in
tools/gamepad_art.py is what keeps them from looking like a photograph dropped into a sketchbook.
This one went through that ramp at first and came out a BLACK Wii Remote — a real product, but
not the one anybody pictures, and it was reported as looking wrong. The whiteness is half of what
makes the shape recognisable, so the shell is white and every accent on it is drawn from the same
espresso family the other two pads live in. A real remote has that contrast built in.

Usage:
    python tools/wii_art.py            # writes web/assets/gamepad/wii/base-{black,white}.svg
"""
import math
import os
import sys

W, H = 806, 599

# --- THE COLOURS, WRITTEN OUT RATHER THAN RAMPED ------------------------------------------
# The other two bodies go through the espresso ramp in tools/gamepad_art.py, because they are
# photographs of black plastic and that ramp is what stops them looking like a photograph
# dropped into a sketchbook. This one went through it too at first, and came out as a BLACK Wii
# Remote — a real product, but not the one anybody pictures. Reported, and rightly: the whiteness
# is half of what makes the shape recognisable.
#
# So the palette is explicit here. What keeps it from clashing with the app's warm cream is that
# the white is warm too, and every accent on it — the d-pad, the recesses, the small buttons —
# is drawn from the same espresso family the other two pads live in. A real remote has that
# contrast built in: white shell, near-black d-pad, grey buttons.
#
# THE ONE HARD PART is that a white shell on a cream panel (#f6f1e5) is nearly invisible: body
# against panel comes to a contrast of about 1.05. It is carried by an OUTLINE and a shadow
# rather than by tinting the shell grey, because tinting it grey is how you get a controller
# that is no longer white. The outline reads on both backgrounds — 1.9 against the cream panel,
# 5+ against the dark overlay card.
PAL = {
    # on the cream panel (#f6f1e5)
    "body-dark": {
        "body": "#fbfaf7", "edge": "#ffffff", "outline": "#a89e8b", "shadow": "#ddd3bf",
        "recess": "#39352f", "dpad": "#45403a", "abtn": "#dcd6cb", "rim": "#b8b0a1",
        "btn": "#d2ccc1", "small": "#bcb4a8", "trigger": "#cdc6ba", "stick": "#c9c1b4",
        "cable": "#ddd6c9", "chip": "#a89f8e", "chiptext": "#7a7264",
        "text": "#57514a", "textlight": "#efe9dd",
    },
    # on the dark overlay card (#101318) — still a white remote; only what surrounds it changes
    "body-light": {
        "body": "#f4f2ee", "edge": "#ffffff", "outline": "#8f877a", "shadow": "#2a2723",
        "recess": "#2b2824", "dpad": "#3a3731", "abtn": "#d5cec3", "rim": "#9a9284",
        "btn": "#cbc4b8", "small": "#b4aca0", "trigger": "#c6bfb2", "stick": "#c2baad",
        "cable": "#d6cfc1", "chip": "#9a9284", "chiptext": "#b7af9f",
        "text": "#4a453d", "textlight": "#101318",
    },
}

# --- GEOMETRY -----------------------------------------------------------------------------
# Every box here is also a box in web/css/14b-gamepad.css. Kept in one table and printed at the
# end of a run, so a change here can be pasted there rather than re-measured.
#
# THE REMOTE — TRACED, not remembered, exactly as the Nunchuk below it is.
#
# The first version of this drawing was mine by eye: I knew what a Wii Remote looks like and
# typed numbers that felt right. They were not right. What follows was
# measured off a reference outline (AdGUW01.svg, a face-on remote, potraced line art):
# the file was parsed, every sub-contour's box taken, and the parts named from those boxes.
#
# Coordinates are the REFERENCE'S own (an 1800 x 1800 page; the shell's outer contour is
# REM_REF) and are mapped into this drawing by _rem(). Keeping them in the reference's frame
# means the next person can put the outline back on screen and check them, which is not true of
# numbers already multiplied out. Everything the trace put within a pixel of the remote's centre
# line was snapped to it — a shell is symmetrical and a tracer's wobble is not a design.
#
# WHAT THE TRACING CHANGED, besides every position and size:
#   * the shell is no longer 120 x 550 but the reference's own ratio, 1 : 3.833. Anchored on the
#     height so the composition beside the Nunchuk survives; the remote gains 24 px of width.
#   * POWER sits at the top LEFT, not on the centre line. That is where the reference has it and
#     where it is on the hardware.
#   * minus / HOME / plus are three CIRCLES, not two pills flanking a disc.
#   * the SPEAKER moved ABOVE 1 and 2 — the grille is between HOME and those two buttons, not
#     below them — and it is a 3 x 6 grid of holes rather than three in a row.
#   * the IR window went. This is the FACE of a remote and the reference draws nothing there:
#     what the top of the face carries is the POWER button, which now has that space to itself.
#
# NOT taken from the reference: B. It is the trigger UNDERNEATH, drawn as a tab on the left edge
# because a face-on drawing cannot show it — the reference cannot either, so the tab
# deliberately stays where it is. Its box is untouched, and the shell still starts at x = 150, so it
# keeps the same bite out of the same edge.
REM_REF = (667.5, 3.2, 468.5, 1795.7)   # the shell on the reference: x, y, w, h
REM_AT = (150, 25, 144)                 # where it goes here: x, y, width — the height follows
_RS = REM_AT[2] / float(REM_REF[2])
REM_H = round(REM_REF[3] * _RS)         # 552
REM_R = round(67 * _RS)                 # the corner: the straight top edge starts 67 units in
RC = REM_AT[0] + REM_AT[2] / 2.0        # the remote's centre line
NC = 460                                # the nunchuk's
R_CX = REM_REF[0] + REM_REF[2] / 2.0    # the same centre line, in the reference's frame


def _rem(p):
    """One point, from the reference's frame into this drawing's."""
    return (REM_AT[0] + (p[0] - REM_REF[0]) * _RS,
            REM_AT[1] + (p[1] - REM_REF[1]) * _RS)


def _rembox(x, y, w, h):
    a = _rem((x, y))
    return (round(a[0]), round(a[1]), round(w * _RS), round(h * _RS))


def _remdot(cx, cy, d):
    """A round part by its OUTER diameter — the box a finger presses, which is the box the CSS
    wants. What gets DRAWN is smaller by half a stroke, since a stroke straddles its own edge."""
    return _rembox(cx - d / 2.0, cy - d / 2.0, d, d)


# --- WHAT WAS MEASURED, in the reference's frame --------------------------------------------
# Centres and OUTER diameters — the outside of the traced line, which is the outside of the part.
# The d-pad's numbers are the cross ALONE: the reference draws centring hairlines out of all four
# tips, so its bounding box (277.6) is 40 units wider than the cross (237.0). Measured off the
# contour away from those hairlines instead, which is the only reason the arms are not too long.
REF_POWER = (787.5, 89.8, 97.6, 77.4)   # centre x, centre y, the surround, the button in it
REF_DPAD = (299.6, 237.0, 90.0)         # centre y, tip to tip, the arm's width
REF_A = (567.7, 142.3)                  # centre y, diameter
# The three of these are one ROW on the hardware; the trace has them at 863.4 / 862.0 / 862.9,
# which is the same wobble the centre line got and is snapped the same way.
REF_MINUS = (-121.4, 862.8, 77.2)       # dx off the centre line, centre y, diameter
REF_HOME = (862.8, 98.2, 80.3)          # centre y, the outer ring, the disc inside it
REF_PLUS = (121.4, 862.8, 77.6)
REF_SPK = (1092.2, 32.05, 32.48, 15.4)  # the grid's centre y, x step, y step, one hole
REF_ONE = (1327.0, 104.1)
REF_TWO = (1483.5, 104.2)
REF_LAMPS = (1610.5, 79.1, 31.0)        # the player lamps: centre y, spacing, one lamp's side

_DP_HALF = REF_DPAD[1] / 2.0
_DP_ARM = REF_DPAD[2] / 2.0
_LAMPS_W = REF_LAMPS[1] * 3 + REF_LAMPS[2]

PARTS = {
    # THE D-PAD. The four arms stop at the CROSSING BAND rather than running through it — the
    # vertical arms end where the horizontal ones begin, and the other way round. Overlapping
    # hotspots are not a cosmetic problem: a click in one of the four inner corners lands on
    # whichever box the browser happens to hit-test first, so „up" and „left" would take turns.
    # It leaves the crossing band in the middle belonging to nobody, which is right — that is
    # where the reference's four seams meet, and it is not a direction.
    "up":       _rembox(R_CX - _DP_ARM, REF_DPAD[0] - _DP_HALF, REF_DPAD[2], _DP_HALF - _DP_ARM),
    "down":     _rembox(R_CX - _DP_ARM, REF_DPAD[0] + _DP_ARM, REF_DPAD[2], _DP_HALF - _DP_ARM),
    "left":     _rembox(R_CX - _DP_HALF, REF_DPAD[0] - _DP_ARM, _DP_HALF - _DP_ARM, REF_DPAD[2]),
    "right":    _rembox(R_CX + _DP_ARM, REF_DPAD[0] - _DP_ARM, _DP_HALF - _DP_ARM, REF_DPAD[2]),
    "a":        _remdot(R_CX, REF_A[0], REF_A[1]),                       # A — the big one
    "back":     _remdot(R_CX + REF_MINUS[0], REF_MINUS[1], REF_MINUS[2]),  # minus
    "guide":    _remdot(R_CX, REF_HOME[0], REF_HOME[1]),                 # HOME
    "start":    _remdot(R_CX + REF_PLUS[0], REF_PLUS[1], REF_PLUS[2]),   # plus
    "x":        _remdot(R_CX, REF_ONE[0], REF_ONE[1]),                   # 1
    "y":        _remdot(R_CX, REF_TWO[0], REF_TWO[1]),                   # 2
    "b":        (126, 168, 32, 64),     # B, the trigger underneath — drawn as a tab on the edge
    # THE NUNCHUK, side-on and traced (see NUN_OUTLINE_REF). The two boxes below are the
    # reference's own, mapped — the tabs on the front edge: the small one high up is C, the long
    # one under it is Z. Written out rather than computed so the CSS can be pasted from the
    # generator's own printout, as with every other part here. ("ls", the stick, is added further
    # down: its box is computed from the mushroom's own measurements, so the two cannot drift.)
    "lb":       (384, 162, 32, 28),     # C — the small one, high on the front edge
    "lt":       (350, 193, 40, 60),     # Z — the trigger, longer, right under it
    # what DSU carries and this hardware does not have
    "rb":       (630, 220, 120, 44),
    "rt":       (630, 285, 120, 44),
    "rs":       (630, 350, 120, 44),
    "touchpad": (630, 415, 120, 44),
}
# WHERE THE CONTROLLER'S NUMBER GOES — the player lamps, and the one place this drawing departs
# from the reference on purpose. The four lamps there are 31 units square, which lands at 9 px
# here, and a 9 px lamp cannot hold a digit. So they are drawn as one recessed strip across the
# row: the reference's width and the reference's centre line, and enough height for the number.
# 72 reference units, which is the 22 px the digit had before and still needs.
PLAYER_STRIP = _rembox(R_CX - _LAMPS_W / 2.0, REF_LAMPS[0] - 36.0, _LAMPS_W, 72.0)

# THE NUNCHUK — TRACED, not remembered.
#
# Three attempts got this wrong before the owner supplied an outline: a rounded rectangle, then a
# silhouette face-on, then a side view drawn from a photograph by eye. Every one of them was me
# retyping a shape I had looked at. These numbers are MEASURED off that outline instead — the
# raster was walked row by row and the position of every contour recorded, which is also how the
# two long creases down the body got here. They are what give the thing its form; without them a
# Nunchuk is a blob.
#
# Coordinates are the reference's own (a 600x1375 page, ink inside NUN_REF) and are mapped into
# this drawing by _nun(). Keeping them in the reference's frame means the next person can put the
# outline back on screen and check them, which is not true of numbers already multiplied out.
#
# NOT COPIED: the two small buttons the tracing puts beside the stick. The owner flagged them as
# something the artist added; a Nunchuk has C and Z and nothing else.
NUN_REF = (77, 68, 501, 1077)     # the reference ink: x, y, w, h (its cable is below this)
NUN_AT = (352, 155, 188)          # where it goes here: x, y, width — the height follows the scale
_NS = NUN_AT[2] / float(NUN_REF[2])


def _nun(p):
    """One point, from the reference's frame into this drawing's."""
    return (NUN_AT[0] + (p[0] - NUN_REF[0]) * _NS,
            NUN_AT[1] + (p[1] - NUN_REF[1]) * _NS)


def _nunbox(x, y, w, h):
    a = _nun((x, y))
    return (round(a[0]), round(a[1]), round(w * _NS), round(h * _NS))


# the outline, clockwise: down the front, round the foot, up the back, over the head
NUN_OUTLINE_REF = [
    # the front (left) — out to the tabs, a corner under them, then the finger hollow and the belly
    (317, 68), (276, 84), (252, 98), (216, 113), (196, 127), (181, 146),
    (171, 182), (167, 210), (156, 238), (142, 252), (129, 280), (112, 306), (99, 322),
    (108, 340), (141, 360), (190, 420), (215, 480), (221, 540),
    (209, 600), (191, 660), (174, 720), (160, 780), (149, 840), (145, 900),
    (149, 960), (165, 1020), (202, 1080), (251, 1140),
    # the foot
    (300, 1152), (355, 1140),
    # the back (right), bottom to top
    (389, 1080), (417, 1020), (446, 960), (472, 900), (495, 840), (514, 780),
    (530, 720), (541, 660), (548, 600), (548, 540), (544, 480), (533, 420), (513, 360),
    (492, 300), (470, 250), (448, 205), (430, 190), (408, 159), (383, 129), (355, 98), (321, 68),
]

# THE STICK — measured off the same outline, and the last thing on this drawing that was not.
#
# What stood here was a slanted quad for the stalk and a WIDE ellipse for the cap, tilted -28° —
# a disc seen from ABOVE, stuck onto a body drawn from the SIDE. The owner's word for it was
# „paskudnie", and the geometry says why: on the reference the cap's long axis runs at +61°, so
# the ellipse is TALL and narrow — a disc looked at nearly edge-on — and the stalk is WAISTED,
# pinched in the middle like a spool rather than straight-sided.
#
# Measured by filling the reference's regions and taking their principal axes: the cap's
# silhouette is 151 x 42 units at 61°, its top face 136 x 29 at 60°, and the face sits 4 units
# up-and-right of the silhouette's centre — which is what leaves the rim showing along the
# lower-left edge, and what makes the thing read as a disc with thickness.
NUN_STICK_REF = [           # the stalk, walked round the traced contour from its top edge
    (498, 226), (504, 234), (509, 245), (514, 256), (520, 266), (526, 277),
    (532, 287), (539, 297), (543, 306), (532, 311), (521, 317), (511, 324),
    (502, 331), (493, 323), (485, 314), (478, 304), (471, 294), (466, 283),
    (461, 272), (457, 260), (456, 248), (466, 243), (477, 238), (488, 233),
]
NUN_CAP = (539.5, 257.5, 75.5, 21.0, 61.0)      # the cap: centre, semi-axes, tilt
NUN_CAP_TOP = (542.0, 253.5, 68.0, 14.3, 60.4)  # its top face, offset up-and-right


def _ell_half(a, b, deg):
    """Half the axis-aligned box of an ellipse tilted by deg — for the hotspot, which is a box."""
    t = math.radians(deg)
    return (math.hypot(a * math.cos(t), b * math.sin(t)),
            math.hypot(a * math.sin(t), b * math.cos(t)))


def _hull_box(pts):
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return _nunbox(min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys))


# The stick's hotspot FOLLOWS the drawing rather than the other way round: it is the whole
# mushroom's extent, stalk and cap together, taken off the two tables above.
_CHX, _CHY = _ell_half(NUN_CAP[2], NUN_CAP[3], NUN_CAP[4])
PARTS["ls"] = _hull_box(NUN_STICK_REF + [(NUN_CAP[0] - _CHX, NUN_CAP[1] - _CHY),
                                         (NUN_CAP[0] + _CHX, NUN_CAP[1] + _CHY)])

# the two long creases — measured, and the reason the reference reads as a solid object
NUN_CREASE_A = [(300, 190), (332, 266), (358, 336), (384, 420), (397, 480), (407, 540),
                (414, 600), (414, 660), (413, 720), (406, 780), (397, 840), (386, 900),
                (373, 960), (360, 1020), (347, 1080), (325, 1135)]
NUN_CREASE_B = [(360, 200), (394, 266), (428, 360), (445, 420), (457, 480), (465, 540),
                (469, 600), (469, 660), (466, 720), (457, 780), (444, 840), (429, 900),
                (411, 960), (392, 1020), (374, 1080), (356, 1135)]


def _shift(pts, dx, dy):

    return [(x + dx, y + dy) for x, y in pts]


def _smooth_closed(pts):
    """A closed path through `pts`, rounded by putting each point at the apex of a quadratic and
    the joins at the midpoints between them. Cheap, stable, and it never overshoots — which a
    spline through the same points would, and an overshoot on a silhouette reads as a dent."""
    n = len(pts)
    mid = lambda i: ((pts[i][0] + pts[(i + 1) % n][0]) / 2.0,   # noqa: E731
                     (pts[i][1] + pts[(i + 1) % n][1]) / 2.0)
    m0 = mid(n - 1)
    out = ["M%g %g" % m0]
    for i in range(n):
        m = mid(i)
        out.append("Q%g %g %g %g" % (pts[i][0], pts[i][1], m[0], m[1]))
    out.append("Z")
    return " ".join(out)


def _smooth_open(pts):
    """The same rounding as _smooth_closed, for a line that does not come back on itself."""
    n = len(pts)
    out = ["M%g %g" % pts[0]]
    for i in range(1, n - 1):
        m = ((pts[i][0] + pts[i + 1][0]) / 2.0, (pts[i][1] + pts[i + 1][1]) / 2.0)
        out.append("Q%g %g %g %g" % (pts[i][0], pts[i][1], m[0], m[1]))
    out.append("L%g %g" % pts[-1])
    return " ".join(out)


def _round_poly(pts, r):
    """A closed path through `pts` with every corner rounded by r.

    Quadratics, not arcs: the control point IS the corner, so one number says it and the same
    rounding works on the four INWARD corners of a plus, where an arc would need its sweep flag
    flipped and would be the second thing to get wrong."""
    n = len(pts)
    out = []
    for i in range(n):
        p0, p1, p2 = pts[i - 1], pts[i], pts[(i + 1) % n]
        v0 = (p0[0] - p1[0], p0[1] - p1[1])
        v1 = (p2[0] - p1[0], p2[1] - p1[1])
        l0 = math.hypot(*v0) or 1.0
        l1 = math.hypot(*v1) or 1.0
        rr = min(r, l0 / 2.0, l1 / 2.0)
        s = (p1[0] + v0[0] / l0 * rr, p1[1] + v0[1] / l0 * rr)
        e = (p1[0] + v1[0] / l1 * rr, p1[1] + v1[1] / l1 * rr)
        out.append(("M%g %g" if i == 0 else "L%g %g") % s)
        out.append("Q%g %g %g %g" % (p1[0], p1[1], e[0], e[1]))
    out.append("Z")
    return " ".join(out)


def _cross(cx, cy, span, arm, r):
    """The d-pad's plus: tip to tip `span`, arms `arm` wide, corners rounded by r.

    ONE shape rather than two crossed bars, because the reference draws a line just inside the
    silhouette and two bars cannot carry it — the line would run straight through the middle of
    the cross where the bars overlap."""
    h, w = span / 2.0, arm / 2.0
    pts = [(-w, -h), (w, -h), (w, -w), (h, -w), (h, w), (w, w),
           (w, h), (-w, h), (-w, w), (-h, w), (-h, -w), (-w, -w)]
    return _round_poly([(cx + x, cy + y) for x, y in pts], r)


def _c(name, kind):
    return PAL[kind][name]


def _stroke(kind, edge, w=2):
    """`edge` is a palette key, or None for a shape that needs no line around it."""
    return "" if not edge else ' stroke="%s" stroke-width="%g"' % (_c(edge, kind), w)


def _rect(x, y, w, h, r, tone, kind, extra="", edge=None, ew=2):
    return ('<rect x="%g" y="%g" width="%g" height="%g" rx="%g" fill="%s"%s%s/>'
            % (x, y, w, h, r, _c(tone, kind) if tone else "none", _stroke(kind, edge, ew), extra))


def _circ(cx, cy, r, tone, kind, extra="", edge=None, ew=2):
    return ('<circle cx="%g" cy="%g" r="%g" fill="%s"%s%s/>'
            % (cx, cy, r, _c(tone, kind) if tone else "none", _stroke(kind, edge, ew), extra))


def _text(x, y, s, size, kind, anchor="middle", weight="700", tone="text"):
    return ('<text x="%g" y="%g" text-anchor="%s" font-family="system-ui,Segoe UI,sans-serif" '
            'font-size="%g" font-weight="%s" fill="%s">%s</text>'
            % (x, y, anchor, size, weight, _c(tone, kind), s))


def body(kind):
    o = []
    a = o.append

    # ---------------- the Wii Remote ----------------
    # Every number below comes out of the reference through _rem(); nothing on the remote is
    # typed in this drawing's own units any more, which is the whole point of the change.
    # The shadow is offset DOWN and RIGHT rather than being a fatter twin behind: a white shell
    # needs a direction of light to read as an object, and on the cream panel that offset is most
    # of what separates it from the background before the outline does the rest.
    bx, by, bw = REM_AT
    a(_rect(bx + 3, by + 6, bw, REM_H, REM_R, "shadow", kind))       # the drop under the shell
    a(_rect(bx, by, bw, REM_H, REM_R, "body", kind, edge="outline", ew=3))   # the shell
    a(_rect(bx + 8, by + 6, bw - 16, 6, 3, "edge", kind))            # the highlight along its top

    # POWER — top left, in its recess, exactly as the reference draws it (two rings, one inside
    # the other). It is the only thing on this face that is NOT on the centre line.
    pwx, pwy = _rem(REF_POWER[:2])
    a(_circ(pwx, pwy, REF_POWER[2] / 2.0 * _RS - 0.75, "body", kind, edge="rim", ew=1.5))
    a(_circ(pwx, pwy, REF_POWER[3] / 2.0 * _RS - 0.75, "small", kind, edge="rim", ew=1.5))

    # THE D-PAD, as one cross under the four hotspots — the plus spans exactly the four PARTS
    # boxes plus the crossing band between them, so drawing and hotspots share their edges. The
    # line just inside the silhouette and the four seams out of the centre are the reference's;
    # they are what makes it read as a moulded rocker rather than a black plus sign.
    dx, dy = _rem((R_CX, REF_DPAD[0]))
    span, arm = REF_DPAD[1] * _RS, REF_DPAD[2] * _RS
    a('<path d="%s" fill="%s" stroke="%s" stroke-width="1.5" stroke-linejoin="round"/>'
      % (_cross(dx, dy, span - 1.5, arm - 1.5, 4.5), _c("dpad", kind), _c("recess", kind)))
    a('<path d="%s" fill="none" stroke="%s" stroke-width="1" opacity=".5"/>'
      % (_cross(dx, dy, span - 8, arm - 8, 3.5), _c("rim", kind)))
    for sx in (-1, 1):
        for sy in (-1, 1):
            a('<path d="M%g %g L%g %g" fill="none" stroke="%s" stroke-width="1" opacity=".4"/>'
              % (dx, dy, dx + sx * arm / 2.0, dy + sy * arm / 2.0, _c("rim", kind)))

    ax, ay = _rem((R_CX, REF_A[0]))                                  # A
    a(_circ(ax, ay, REF_A[1] / 2.0 * _RS - 1, "abtn", kind, edge="rim", ew=2))
    a(_text(ax, ay + 5.5, "A", 16, kind))

    # minus / HOME / plus — three circles on the reference, and the glyphs are ours: the tracing
    # has none, and a bare grey disc says nothing about which of the three it is.
    mx, my = _rem((R_CX + REF_MINUS[0], REF_MINUS[1]))
    a(_circ(mx, my, REF_MINUS[2] / 2.0 * _RS - 0.75, "small", kind, edge="rim", ew=1.5))
    a(_rect(mx - 5.5, my - 1.2, 11, 2.4, 1.2, "body", kind))
    hx, hy = _rem((R_CX, REF_HOME[0]))
    a(_circ(hx, hy, REF_HOME[1] / 2.0 * _RS - 0.75, "small", kind, edge="rim", ew=1.5))
    a(_circ(hx, hy, REF_HOME[2] / 2.0 * _RS, "btn", kind))
    sx, sy = _rem((R_CX + REF_PLUS[0], REF_PLUS[1]))
    a(_circ(sx, sy, REF_PLUS[2] / 2.0 * _RS - 0.75, "small", kind, edge="rim", ew=1.5))
    a(_rect(sx - 5.5, sy - 1.2, 11, 2.4, 1.2, "body", kind))
    a(_rect(sx - 1.2, sy - 5.5, 2.4, 11, 1.2, "body", kind))

    # THE SPEAKER — above 1 and 2, where the hardware has it, and 3 x 6 holes as traced. It sat
    # below them here for as long as this drawing was drawn from memory.
    for row in range(6):
        for cx in (-1, 0, 1):
            hox, hoy = _rem((R_CX + cx * REF_SPK[1], REF_SPK[0] + (row - 2.5) * REF_SPK[2]))
            a(_circ(hox, hoy, REF_SPK[3] / 2.0 * _RS, "recess", kind))

    for ref, label in ((REF_ONE, "1"), (REF_TWO, "2")):
        cx, cy = _rem((R_CX, ref[0]))
        a(_circ(cx, cy, ref[1] / 2.0 * _RS - 0.75, "btn", kind, edge="rim", ew=1.5))
        a(_text(cx, cy + 5, label, 14, kind))

    # THE PLAYER STRIP. On a real remote these four lamps say which player you are, which is
    # exactly what the number in the middle of the other two drawings says. So the number goes
    # here rather than into HOME: it is the one place a Wii player already looks for it. Drawn
    # as one strip with three dividers rather than four separate lamps — see PLAYER_STRIP.
    px, py, pw, ph = PLAYER_STRIP
    a(_rect(px, py, pw, ph, 6, "recess", kind))
    for i in range(1, 4):
        a(_rect(px + pw * i / 4.0 - 0.5, py + 4, 1, ph - 8, 0, "body", kind))

    # B, the trigger underneath — a tab on the left edge, seen edge-on
    a(_rect(126, 168, 32, 64, 12, "trigger", kind, edge="rim", ew=1.5))
    a(_rect(150, 168, 12, 64, 0, "trigger", kind))
    a(_text(136, 205, "B", 13, kind))

    # ---------------- the cable ----------------
    # Out of the BOTTOM, as the reference shows it, and along the floor to the foot of the remote,
    # where the expansion port is.
    CABLE = "M448 566 C 418 582, 368 588, 298 574"
    a('<path d="%s" fill="none" stroke="%s" stroke-width="9" stroke-linecap="round"/>'
      % (CABLE, _c("outline", kind)))
    a('<path d="%s" fill="none" stroke="%s" stroke-width="6" stroke-linecap="round"/>'
      % (CABLE, _c("cable", kind)))

    # ---------------- the Nunchuk ----------------
    body_pts = [_nun(p) for p in NUN_OUTLINE_REF]
    a('<path d="%s" fill="%s"/>'
      % (_smooth_closed(_shift(body_pts, 4, 6)), _c("shadow", kind)))
    a('<path d="%s" fill="%s" stroke="%s" stroke-width="3"/>'
      % (_smooth_closed(body_pts), _c("body", kind), _c("outline", kind)))
    # the two creases: what turns a silhouette into a solid
    for ref in (NUN_CREASE_A, NUN_CREASE_B):
        a('<path d="%s" fill="none" stroke="%s" stroke-width="2" stroke-linecap="round"/>'
          % (_smooth_open([_nun(p) for p in ref]), _c("rim", kind)))

    # THE STICK — a mushroom seen from the SIDE, and now measured rather than typed: a WAISTED
    # stalk out of the shoulder and a cap that is a TALL narrow ellipse, because from here the
    # disc is looked at nearly edge-on. What it replaces was a slanted quad under a wide ellipse
    # tilted the other way — a disc seen from above pasted onto a side view (see NUN_STICK_REF).
    # Drawn stalk first, cap over it: on the reference the cap hides the top of the stalk, which
    # is what puts the cap in FRONT rather than on a stick standing behind it.
    a('<path d="%s" fill="%s" stroke="%s" stroke-width="2" stroke-linejoin="round"/>'
      % (_smooth_closed([_nun(p) for p in NUN_STICK_REF]),
         _c("stick", kind), _c("outline", kind)))
    for (ecx, ecy, era, erb, eang), tone, edge, ew in (
            (NUN_CAP, "stick", "outline", 2), (NUN_CAP_TOP, "btn", "rim", 1.5)):
        p = _nun((ecx, ecy))
        a('<ellipse cx="%g" cy="%g" rx="%g" ry="%g" transform="rotate(%g %g %g)" '
          'fill="%s" stroke="%s" stroke-width="%g"/>'
          % (p[0], p[1], era * _NS, erb * _NS, eang, p[0], p[1],
             _c(tone, kind), _c(edge, kind), ew))

    # C and Z, on the front edge where the reference puts them
    x, y, w, h = PARTS["lb"]
    a(_rect(x, y, w, h, 12, "trigger", kind, edge="rim", ew=1.5))     # C
    a(_text(x + w / 2.0, y + h / 2.0 + 5, "C", 12, kind))
    x, y, w, h = PARTS["lt"]
    a(_rect(x, y, w, h, 14, "trigger", kind, edge="rim", ew=1.5))     # Z
    a(_text(x + w / 2.0, y + h / 2.0 + 5, "Z", 12, kind))

    # ---------------- what DSU carries and this hardware has not ----------------
    # OUTLINED, never filled — and that is the whole point of drawing them this way. Solid plates
    # would read as four more buttons of the controller you picked; an empty outline reads as a
    # slot for something that is not there, which is exactly what these are.
    a(_text(690, 202, "DSU", 15, kind, tone="chiptext"))
    for nm, label in (("rb", "R1"), ("rt", "R2"), ("rs", "R3"), ("touchpad", "Touch")):
        x, y, w, h = PARTS[nm]
        a(_rect(x, y, w, h, 10, None, kind, edge="chip", ew=3,
                extra=' stroke-dasharray="7 5"'))
        a(_text(x + w / 2.0, y + h / 2.0 + 5, label, 14, kind, weight="600", tone="chiptext"))

    return ('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">'
            % (W, H, W, H)) + "".join(o) + "</svg>"


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = os.path.join(root, "web", "assets", "gamepad", "wii")
    os.makedirs(out, exist_ok=True)
    for name, kind in (("base-black.svg", "body-dark"), ("base-white.svg", "body-light")):
        svg = body(kind)
        with open(os.path.join(out, name), "w", encoding="utf-8", newline="") as f:
            f.write(svg)
        print("%-16s %6d B" % (name, len(svg)))
    print("\nzapisano do", out)
    print("\nboxy dla 14b-gamepad.css (left, top, width, height w jednostkach %dx%d):" % (W, H))
    for nm in sorted(PARTS):
        print("  %-9s %s" % (nm, PARTS[nm]))
    print("  %-9s %s   <- numer kontrolera" % ("_player", PLAYER_STRIP))
    print("  %-9s %s   <- sam korpus (skala kalki %.5f)"
          % ("_korpus", (REM_AT[0], REM_AT[1], REM_AT[2], REM_H), _RS))


if __name__ == "__main__":
    main()
