"""Rebuild web/assets/gamepad/ from the upstream Gamepad Viewer artwork.

The drawing of the virtual controller in the cheat sheet is not ours: it is the
`templates/xbox-one/` skin of Gamepad Viewer by Michael "e7d" Ferrand (MIT,
https://github.com/e7d/gamepad-viewer), itself reworked from mrmcpowned's
originals for gamepadviewer.com. See docs/CREDITS.md.

Three things are done to it here, and this script exists so that all of them are
reproducible and reviewable instead of being an unexplained binary diff:

  1. THE MAKER'S LOGO IS DELETED from the Guide button in both body files. A
     copyright licence is not a trademark licence and this app is endorsed by
     nobody. One <path> per file; the plain white disc under it stays.

  2. THE PALETTE IS REMAPPED to RibbitFlip's own. Upstream draws a photoreal
     glossy black pad with the console's four primary-coloured face buttons,
     which on a cream felt panel looks like a photograph someone dropped into a
     sketchbook. Every grey is moved onto a warm espresso ramp (the same family
     as the app's dark chrome, #211f1d), the lit overlays become the app's amber,
     and A/B/X/Y keep their colour coding but in the app's own data palette.
     Relative lightness is preserved throughout, so all of the original's
     shading and depth survives the move.

  3. THE RIGHT TRIGGER GETS ITS SECOND HALF BACK. In both body files the left
     trigger sticking up behind the pad is drawn with TWO paths — the wide
     rounded facet and the narrower front — and the right one with only the
     front: 89 px of shape on the left, 39 px on the right. The lit overlay
     (trigger.svg, mirrored by the CSS) is the full 89 px on both sides, so RT
     lit up wider than the stub it was lighting. Upstream is missing the path;
     what is added here is the LEFT one mirrored about the drawing's centre
     (x=375, i.e. translate(750 0) scale(-1 1)) — the same geometry the pad's
     own symmetry already uses everywhere else, not a shape of our invention.

Usage:
    python tools/gamepad_art.py <folder-with-upstream-svgs>

where the folder holds the eight files fetched from upstream's
templates/xbox-one/. Writes into web/assets/gamepad/ and prints every colour
substitution it makes.
"""
import colorsys
import os
import re
import sys

FILES = ("base-black.svg", "base-white.svg", "bumper.svg", "buttons.svg",
         "dpad.svg", "start-select.svg", "stick.svg", "trigger.svg")

# The one path that draws the logo on the Guide button (identical start in both bodies).
LOGO_PATH_START = 'd="M384.006 182.009'
# The disc under it — a circle of r=32.577 centred on (375, 196.4). Upstream paints it pure
# white, which after the remap turns into the panel's own cream: at a glance the pad then has
# a HOLE punched through it. Repainted to a tone that reads as a button.
DISC_MARK = "32.577"
DISC_TONE = "#6b6153"

# --- the app's palette (mirrors web/css/01-assets-tokens.css) --------------------
CREAM = "#efe9dd"        # --bg
AMBER = "#eaa32b"        # --amber: everything that lights up when a button goes down
FACE = {                 # A/B/X/Y keep their coding, in the app's data palette
    "#39b54a": "#2f9e57",    # A  green  -> --gy
    "#c1272d": "#d83a5c",    # B  red    -> --ax / --bad
    "#0071bc": "#1f93c9",    # X  blue   -> --gx
    "#fcee21": "#c8971a",    # Y  yellow -> --az (the raw yellow is unreadable on cream)
}
# Files whose near-white artwork IS the "this button is down" overlay.
LIT_FILES = {"bumper.svg", "trigger.svg", "dpad.svg", "start-select.svg"}

# --- the DualShock skin ---------------------------------------------------------
# A second controller can be created in this app (the pad registry's `kind`), and it is drawn
# with upstream's `templates/ds4/` the same way the Xbox one is drawn with `templates/xbox-one/`.
# Same licence, same project, same treatment — so it goes through this script rather than being
# hand-edited into the repo. What differs is only what the two skins are made of:
#
#   * the DualShock's four face glyphs carry their OWN colour coding (✕ blue, ○ red, □ pink,
#     △ green) instead of the Xbox's, so they need their own map onto the app's palette;
#   * its Share/Options and its sticks come as different sprites (one cell for the two small
#     buttons, three for the stick: released and the two pressed variants);
#   * the maker's mark to delete is the PlayStation logo on the PS button, which upstream draws
#     as TWO paths on a dark disc — no white disc to repaint underneath, unlike the Xbox one;
#   * the right trigger is a sprite cell of its own, so it needs none of the mirroring hack.
DS4_FILES = ("base-black.svg", "base-white.svg", "bumper.svg", "buttons.svg",
             "dpad.svg", "sticks.svg", "triggers.svg", "start.svg", "touchpad.svg")
# ⚠ `dpad.svg` is NOT on this list for the DualShock, unlike the Xbox skin, and the difference is
# a fact about the two bodies. The Xbox body DRAWS its d-pad, so its sprite is only an overlay that
# lights up. The DualShock body draws a bare round dish with four small arrow markings near the rim
# and NO CROSS AT ALL — the arms are in `dpad.svg`, which carries both states the way `buttons.svg`
# does for ✕○□△: `#1A1A1A` at rest on the top row, `#E6E6E6` pressed on the bottom one. Ramping it
# to amber would paint a resting d-pad in the colour that means "going down right now".
DS4_LIT_FILES = {"bumper.svg", "triggers.svg", "start.svg", "touchpad.svg"}
DS4_FACE = {
    "#7fb1df": "#1f93c9",    # ✕ cross    blue  -> --gx
    "#f16667": "#d83a5c",    # ○ circle   red   -> --ax / --bad
    "#66c194": "#2f9e57",    # △ triangle green -> --gy
    # □ square is magenta and the app has no magenta token. Muted onto the same warm, low-chroma
    # range everything else lands in, rather than dropped: the four-way COLOUR CODING is the whole
    # reason these four are not greyscale, and three coded buttons plus one grey one is worse than
    # either. Picked by eye against --ax and --gx so the three cool-to-warm glyphs stay tellable.
    "#cb79b1": "#a8628f",
}
# The PlayStation mark on the PS button: two paths, matched on where they start. Same reasoning as
# Modification 1 — a copyright licence is not a trademark licence, and this app is endorsed by
# nobody. The dark disc beneath them stays, so the button is still visibly a button.
DS4_LOGO_STARTS = ('d="M404.05 368.567', 'd="M414.75 365.268')

# --- the d-pad: nothing is done to it here, and that is the fix ------------------
# There WAS a modification here, lifting the d-pad's disc and its four arrow markings a step out
# of the body, on the finding that "there are no arms, so the only thing that says «this is the
# d-pad» is a contrast that was not there". The finding was half right and the conclusion wrong.
#
# There really are no arms in the BODY: a scanline straight through that disc reads one single
# tone from rim to rim. But the arms are not missing from the artwork — they are in `dpad.svg`,
# which carries a dark resting row and a light pressed one, exactly as `buttons.svg` does for
# ✕○□△. They were simply never drawn, because the CSS treated that file as a lit overlay and
# showed it only while a direction was down. The pad therefore sat there as a bare disc with four
# specks on it, which is what the owner reported.
#
# With the cross drawn (14b-gamepad.css), lifting the disc would UNDO it: the resting arm comes
# out #37312c and the lifted disc was #3d352d — a contrast ratio of 1.07, which is invisible.
# Left alone, the disc stays #211d1a and the same arm reads 1.48 against it, lighter than its
# background the way a raised part should be. The arrow markings stay a quiet #3d3631 in the ring
# outside the cross, which is what decoration should look like next to the real thing.


def _lum(hx):
    r, g, b = (int(hx[i:i + 2], 16) / 255 for i in (1, 3, 5))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def _hex(r, g, b):
    return "#%02x%02x%02x" % (round(r * 255), round(g * 255), round(b * 255))


# Per-file ramp: (hue°, saturation, darkest lightness, span, gamma). Every grey in a file is
# placed on its own ramp by luminance, so the original's moulding and shading survive intact —
# only the family of colour changes. The gamma matters: upstream crushes its blacks (half the
# body sits between 3 % and 16 % luminance), and mapped linearly the pad arrives as one flat
# brown shape with every edge of the moulding gone.
RAMPS = {
    "body-dark":  (28, 0.11, 0.06, 0.75, 0.75),   # the pad itself, on the cream panel
    "body-light": (30, 0.10, 0.30, 0.42, 1.00),   # the pale twin, for the dark overlay looks
    "lit":        (38, 0.58, 0.40, 0.22, 0.90),   # amber: the overlays that mean "down now"
}


def ramp(hx, kind):
    hue, sat, lo, span, gamma = RAMPS[kind]
    l = lo + span * (_lum(hx) ** gamma)
    r, g, b = colorsys.hls_to_rgb(hue / 360, min(l, 0.95), sat)
    return _hex(r, g, b)


def expand(hx):
    """Full-colour hex: #ABC -> #AABBCC, lowercased, so one lookup table catches every spelling."""
    hx = hx.lower()
    if len(hx) == 4:
        hx = "#" + hx[1] * 2 + hx[2] * 2 + hx[3] * 2
    return hx


def convert(name, src, skin="xbox-one"):
    body = src
    ds4 = (skin == "ds4")
    if name.startswith("base-"):
        if ds4:
            gone = 0
            for start in DS4_LOGO_STARTS:
                paths = [p for p in re.findall(r"<path[^>]*/>", body) if start in p]
                if len(paths) != 1:
                    raise SystemExit("%s: expected exactly one logo path for %s, found %d"
                                     % (name, start[:14], len(paths)))
                body = body.replace(paths[0], "")
                gone += len(paths[0])
            print("  logo usuniete (2 sciezki, %d znakow)" % gone)
        else:
            paths = [p for p in re.findall(r"<path[^>]*/>", body) if LOGO_PATH_START in p]
            if len(paths) != 1:
                raise SystemExit("%s: expected exactly one logo path, found %d" % (name, len(paths)))
            body = body.replace(paths[0], "")
            print("  logo usuniete (%d znakow)" % len(paths[0]))

    lit = DS4_LIT_FILES if ds4 else LIT_FILES
    face = DS4_FACE if ds4 else FACE
    kind = "lit" if name in lit else ("body-light" if name == "base-white.svg" else "body-dark")
    subs = {}

    def repl(m):
        raw = m.group(1)
        # `none`, and a reference to a paint server. The DualShock body fills its grip and its
        # touchpad from three <pattern>s — `fill="url(#b)"` is not a colour and must be left
        # alone; the colours INSIDE those patterns are ordinary fills and get remapped like the
        # rest, so the texture still lands on the app's palette.
        if raw == "none" or raw.startswith("url("):
            return m.group(0)
        hx = expand(raw)
        if hx in face:
            out = face[hx]                    # the four face glyphs keep their coding
        elif hx == "#ffffff" and kind != "lit":
            out = CREAM                       # the Guide disc: cream, not a hole of pure white
        else:
            out = ramp(hx, kind)
        subs[raw] = out
        return 'fill="%s"' % out

    body = re.sub(r'fill="([^"]+)"', repl, body)

    if name.startswith("base-") and not ds4:
        # The DualShock's PS button sits on a DARK disc, so there is no hole of pure white to
        # repaint the way the Xbox's Guide disc needed.
        discs = [p for p in re.findall(r"<path[^>]*/>", body) if DISC_MARK in p]
        if len(discs) != 1:
            raise SystemExit("%s: expected exactly one Guide disc, found %d" % (name, len(discs)))
        body = body.replace(discs[0], re.sub(r'fill="[^"]+"', 'fill="%s"' % DISC_TONE, discs[0]))
        print("  krazek Guide -> %s" % DISC_TONE)

    for k in sorted(subs, key=lambda c: c.lower()):
        print("  %-9s -> %s" % (k, subs[k]))
    return body


def mirror_right_trigger(name, body, skin="xbox-one"):
    """Give the right trigger stub the facet upstream left off it (see 3. above).

    The three stubs are found by where their paths START — at the very top of the drawing
    (y < 8) and at an x that says which one it is. Matching on geometry rather than on the
    exact `d` string on purpose: the two colourways differ in the last decimal place, and a
    fresh fetch from upstream may differ again."""
    if skin != "xbox-one" or not name.startswith("base-"):
        return body    # the DualShock draws each trigger as its own sprite cell: nothing to mirror
    # SVG packs coordinates: "M522.043.142" is x=522.043, y=.142 — no separator, because a second
    # decimal point can only mean a new number. So the pair is read with a number pattern, not by
    # splitting on whitespace.
    NUM = r"[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?"
    head = re.compile(r'\sd="M\s*(%s)[\s,]*(%s)' % (NUM, NUM))
    facet = right = None
    for el in re.findall(r"<path[^>]*/>", body):
        m = head.search(el)
        if not m:
            continue
        x, y = float(m.group(1)), float(m.group(2))
        if y > 8.0:
            continue                       # not one of the stubs: they all start at the top edge
        if 195.0 <= x <= 210.0:
            facet = el                     # the left trigger's wide facet
        elif 515.0 <= x <= 530.0:
            right = el                     # the right trigger's front — the only one it has
    if facet is None or right is None:
        raise SystemExit("%s: trigger stubs not found (facet=%s, right=%s)"
                         % (name, facet is not None, right is not None))
    if 'transform="translate(750 0) scale(-1 1)"' in body:
        return body                        # already mirrored (re-run on our own output)
    twin = facet.replace("<path", '<path transform="translate(750 0) scale(-1 1)"', 1)
    # Under the front, exactly as its twin sits under the left one — document order is depth here.
    body = body.replace(right, twin + right, 1)
    print("  prawy spust: dolozona faseta (lustro lewej)")
    return body


def main():
    # gamepad_art.py <folder>         -> the Xbox skin,      into web/assets/gamepad/
    # gamepad_art.py ds4 <folder>     -> the DualShock skin, into web/assets/gamepad/ds4/
    args = sys.argv[1:]
    skin = "xbox-one"
    if args and args[0] in ("ds4", "xbox-one"):
        skin, args = args[0], args[1:]
    if len(args) != 1:
        raise SystemExit(__doc__)
    src_dir = args[0]
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out_dir = os.path.join(root, "web", "assets", "gamepad")
    files = FILES
    if skin == "ds4":
        out_dir = os.path.join(out_dir, "ds4")
        files = DS4_FILES
        os.makedirs(out_dir, exist_ok=True)
    for name in files:
        with open(os.path.join(src_dir, name), encoding="utf-8") as f:
            src = f.read()
        print(name)
        out = mirror_right_trigger(name, convert(name, src, skin), skin)
        with open(os.path.join(out_dir, name), "w", encoding="utf-8", newline="") as f:
            f.write(out)
    print("\nzapisano do", out_dir)


if __name__ == "__main__":
    main()
