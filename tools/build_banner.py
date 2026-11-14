# -*- coding: utf-8 -*-
"""Prints what build_exe.bat has to say: the wordmark when it starts, and when it stops the frog
if the build worked or the punk skull if it did not.

Called from build_exe.bat, never bundled into the .exe - this is build-time decoration and a
summary of what just happened (version, where the file landed, how big it is, how long it took,
and the SHA-256 of the .exe, so the file that leaves this machine can be told apart from any
other copy).

    py tools/build_banner.py start
    py tools/build_banner.py ok     [--since %TIME%]
    py tools/build_banner.py fail   [--since %TIME%]
    py tools/build_banner.py locked
    ... --exe dist\\RibbitBeat.exe    which file the summary is about (default dist\\RibbitFlip.exe);
                                      build_exe.bat passes it for each of its three builds

    NO_COLOR=1           the same art, uncoloured
    RF_BANNER_STATIC=1   the whole picture at once, no entrance

Four things it refuses to do, because a build script that makes a mess of the console is worse
than one with no picture at all:

* wrap the art. The drawing comes in several widths (see build_banner_art.txt) and the widest
  one that fits the console wins; below the narrowest, it prints the summary as plain text.
  A drawing that misses by a column or two gives up its margin instead of its detail - the
  wordmark is 120 wide and a Windows console opens 120 wide, so it prints flush to both edges.
* emit escape codes nobody will interpret. Colour needs a console that has virtual-terminal
  processing (every Windows 10+ terminal, once asked), stdout still attached to that console,
  and no NO_COLOR in the environment. Otherwise the same art prints uncoloured.
* keep anybody waiting. The drawing arrives row by row over about three quarters of a second,
  and only when there is a console on the other end - piped into a file or a CI log the delays
  would buy nobody anything. Ctrl+C during it prints the rest at once.
* fail. It runs after the build has already succeeded or failed, so anything unexpected in here
  degrades to the one-line summary rather than adding a traceback to somebody's real problem.
"""
import datetime
import hashlib
import io
import os
import re
import shutil
import sys
import textwrap
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ART_FILE = os.path.join(HERE, 'build_banner_art.txt')
EXE = os.path.join(ROOT, 'dist', 'RibbitFlip.exe')   # replaced by --exe (RibbitFlip-Essential.exe, RibbitBeat.exe)


def product():
    """The name the summary uses for the file being built: "RibbitFlip", "RibbitFlip-Essential", "RibbitBeat"."""
    name = os.path.basename(EXE)
    return name[:-4] if name.lower().endswith('.exe') else 'RibbitFlip'

# Palette letters used by the colour blocks -> xterm-256 indexes. Kept in step with
# tools/make_banner_art.py, which is what decides which letter a character gets.
INK = {'k': 252, 'K': 255, 'b': 246, 'p': 161, 'P': 198, 'g': 149,
       'G': 107, 'D': 64, 't': 180, 's': 250, 'w': 255}
GREEN, RED, DIM, TEXT = 118, 203, 245, 255

# MARGIN is the breathing room a drawing gets when there is room for it; PAD is what it is being
# printed with right now. art_for() narrows PAD when the alternative is dropping to a smaller
# picture over a column or two - the console width is what it is, and the right-hand margin was
# never printed anyway, only reserved.
MARGIN = 2
PAD = MARGIN

# Widest first: the printer walks this list and takes the first drawing the console can hold.
LADDER = {'ok': ['frog', 'frog80', 'frog60'], 'fail': ['skull', 'skull80', 'skull60'],
          'start': ['wordmark', 'wordmark76']}

# The entrance. The drawing is dealt out one row at a time over ENTRANCE seconds, then BEAT of
# quiet before the summary; with colour, each row lands dark and comes up to full (FADE) so the
# leading edge is a soft one rather than a hard pop.
#
# Only the row being written is ever rewritten, and only with \r. Nothing here moves the cursor
# back up whole rows on purpose: the frog is some fifty rows tall and a console window is thirty,
# so a redraw of the whole picture would reach past the top of the window and land in the wrong
# place - which is also why it arrives top-down and cannot, say, rise from the bottom.
ENTRANCE, BEAT = 0.80, 0.14

# The pictures take ENTRANCE whatever their height, and the frog is some fifty rows, so that comes
# to about fifteen milliseconds a row. The wordmark is a dozen rows: given the same total it does
# not look gentler, it looks slow next to the frog (owner, 2026-09-22 - "bardzo pomalu sie
# pokazuje"). So it goes at the pictures' PACE instead of their duration, and lands in a fifth of
# the time. One drawing, one speed; the only knob here is ENTRANCE.
PACE = ENTRANCE / 50.0
FADE = (0.30, 1.0)
FADE_STEP = 0.012
CLEAR = '\x1b[K'


def colour_ok():
    """True if it is worth emitting ANSI at all - and on Windows, switches it on first."""
    if os.environ.get('NO_COLOR') or not sys.stdout.isatty():
        return False
    if os.name != 'nt':
        return True
    try:
        import ctypes
        k32 = ctypes.windll.kernel32
        handle, mode = k32.GetStdHandle(-11), ctypes.c_uint32()
        if not k32.GetConsoleMode(handle, ctypes.byref(mode)):
            return False
        return bool(k32.SetConsoleMode(handle, mode.value | 0x0004))  # VIRTUAL_TERMINAL_PROCESSING
    except Exception:
        return False


def anim_ok():
    """True if the drawing is worth dealing out row by row - i.e. somebody is watching a console.
    RF_BANNER_STATIC=1 turns it off for anyone who just wants the picture and the summary."""
    if os.environ.get('RF_BANNER_STATIC') or os.environ.get('CI'):
        return False
    try:
        return bool(sys.stdout.isatty())
    except Exception:
        return False


COLOUR = False


def tint(text, index):
    return '\x1b[38;5;%dm%s\x1b[0m' % (index, text) if COLOUR else text


def shade(index, factor):
    """A darker entry of the same 256-colour palette: the 6x6x6 cube and the grey ramp are both
    scaled where they stand, so the fade needs neither truecolour nor a second palette."""
    if factor >= 1.0:
        return index
    if 16 <= index <= 231:
        n = index - 16
        r, g, b = n // 36, (n // 6) % 6, n % 6
        return 16 + 36 * int(r * factor) + 6 * int(g * factor) + int(b * factor)
    if 232 <= index <= 255:
        return 232 + int((index - 232) * factor)
    return index


def load_art(name):
    """Returns (art_lines, colour_lines) for one block of build_banner_art.txt."""
    blocks, current = {}, None
    for line in io.open(ART_FILE, encoding='utf-8').read().split('\n'):
        if line.startswith('@'):
            current = line[1:].split()[0]
            blocks[current] = []
        elif current is not None and not line.startswith('#'):
            blocks[current].append(line.rstrip('\n'))
    art = [l for l in blocks.get(name, []) if l.strip()]
    ink = [l for l in blocks.get(name + '.colours', []) if l.strip()]
    return art, ink


def render(line, key_row, factor=1.0):
    """One row of the drawing exactly as it goes to the console: margin, colour runs, and no
    trailing blanks. factor < 1 darkens it - that is the row still on its way in."""
    pad = ' ' * PAD
    if not COLOUR:
        return (pad + line).rstrip()
    out, run, run_key = [], [], None
    for col, char in enumerate(line):
        key = key_row[col] if col < len(key_row) else ' '
        key = key if key in INK else None
        if key != run_key and run:
            out.append(tint(''.join(run), shade(INK[run_key], factor)) if run_key else ''.join(run))
            run = []
        run_key = key
        run.append(char)
    if run:
        out.append(tint(''.join(run), shade(INK[run_key], factor)) if run_key else ''.join(run))
    return (pad + ''.join(out)).rstrip()


def clear():
    """The erase-to-end-of-line that follows a row. Dropped when the drawing prints flush to the
    right edge: the cursor is then parked in the last cell, and an erase from there would rub out
    the character just written into it. Nothing is lost - every frame of a row is the same length,
    so there is never anything left over to erase; the escape is belt and braces."""
    return CLEAR if PAD else ''


def land(line, key_row, step):
    """One row arriving: the dark frames it passes through, then the row itself, then whatever is
    left of its share of the entrance. Every frame overwrites the same line, never an earlier one."""
    spent = 0.0
    for factor in (FADE[:-1] if COLOUR else ()):
        sys.stdout.write('\r' + render(line, key_row, factor) + clear())
        sys.stdout.flush()
        time.sleep(FADE_STEP)
        spent += FADE_STEP
    sys.stdout.write('\r' + render(line, key_row) + (clear() if COLOUR else '') + '\n')
    sys.stdout.flush()
    if step > spent:
        time.sleep(step - spent)


def draw(art, ink, entrance=0.0):
    """Prints the drawing; entrance > 0 spreads it over that many seconds, one row at a time.
    Ctrl+C partway through prints the rest at once rather than leaving half a frog on screen."""
    def key_row(row):
        return ink[row] if row < len(ink) else ''

    step = entrance / len(art) if entrance and art else 0.0
    done = 0
    if step:
        try:
            for row, line in enumerate(art):
                land(line, key_row(row), step)
                done = row + 1
        except KeyboardInterrupt:
            if done < len(art):                      # finish the row that was interrupted
                sys.stdout.write('\r' + render(art[done], key_row(done)) + '\n')
                done += 1
    for row in range(done, len(art)):
        print(render(art[row], key_row(row)))


def printable(art):
    """True if this stream can write those characters at all. The frog and the skull are plain
    ASCII, but a drawing may reach for box-drawing or block glyphs: fine on a console, where
    Python hands them to Windows as Unicode, and a lost cause in a pipe under a legacy code page,
    where writing them raises instead of printing. There the next rung down - or the plain-text
    line - is the better answer than a row of question marks or no banner at all."""
    try:
        '\n'.join(art).encode(getattr(sys.stdout, 'encoding', None) or 'ascii')
        return True
    except Exception:
        return False


def art_for(kind, width, spare=0):
    """The widest drawing this console can hold, having also decided what margin to print it with:
    MARGIN when there is room, less when the alternative is dropping to a smaller picture over a
    column or two, none at all for a drawing exactly as wide as the window. `spare` is how many
    columns must stay free at the end of a row - see main()."""
    global PAD
    for name in LADDER.get(kind, []):
        try:
            art, ink = load_art(name)
        except Exception:
            return None, None   # no art file, no drawing - the facts below it still get printed
        if not art or not printable(art):
            continue
        drawn = max(len(l) for l in art)
        for pad in range(MARGIN, -1, -1):
            if drawn + pad + spare <= width:
                PAD = pad
                return art, ink
    return None, None


def version():
    try:
        src = io.open(os.path.join(ROOT, 'ribbitflip_monitor.py'), encoding='utf-8').read()
        return re.search(r'^APP_VERSION\s*=\s*"([^"]+)"', src, re.M).group(1)
    except Exception:
        return None


def digest(path):
    """SHA-256 of the built file, or None if it cannot be read. It goes under the frog so a copy
    that has travelled - a download, a pen drive, a colleague's Zgloszenia folder - can be told
    apart from the one that came off this machine. The same sum, from a console:

        certutil -hashfile dist\\RibbitFlip.exe SHA256
    """
    try:
        h = hashlib.sha256()
        with open(path, 'rb') as f:
            for chunk in iter(lambda: f.read(1 << 20), b''):
                h.update(chunk)
        return h.hexdigest()
    except Exception:
        return None


def elapsed(since):
    """Turns two Windows %TIME% strings into "1 m 12 s". Locale decides ':' and ',' - and a
    build started before midnight finishes with a smaller clock reading, hence the wrap."""
    def seconds(stamp):
        parts = re.split(r'[:.,]', stamp.strip())
        if len(parts) < 3:
            raise ValueError(stamp)
        h, m, s = (int(p or 0) for p in parts[:3])
        return h * 3600 + m * 60 + s + (int(parts[3]) / 100.0 if len(parts) > 3 else 0)
    try:
        now = datetime.datetime.now()
        gap = (now.hour * 3600 + now.minute * 60 + now.second
               + now.microsecond / 1e6) - seconds(since)
    except Exception:
        return None
    if -2 < gap < 0:
        gap = 0.0          # sub-second build, and the two clock readings truncate differently
    elif gap < 0:
        gap += 24 * 3600   # started before midnight, finished after
    return '%d m %02d s' % (gap // 60, gap % 60) if gap >= 60 else '%.1f s' % gap


def summary(kind, since):
    """The facts, as a list of (text, colour) pieces - printed with or without the art."""
    bits = []
    ver = version()
    if kind == 'ok':
        bits.append(('BUILD OK', GREEN))
        if ver:
            bits.append((product() + ' ' + ver, TEXT))
        bits.append((os.path.join('dist', os.path.basename(EXE)), TEXT))
        if os.path.exists(EXE):
            bits.append(('%.1f MB' % (os.path.getsize(EXE) / 1048576.0), DIM))
    else:
        bits.append(('BUILD FAILED' if kind == 'fail' else 'BUILD SKIPPED', RED))
        if ver:
            bits.append((product() + ' ' + ver, DIM))
    took = elapsed(since) if since else None
    if took:
        bits.append((took, DIM))
    return bits


# One paragraph each; wrapped to the console below, so do not pre-break the lines.
NOTES = {
    'ok': 'Copy it anywhere - Settings\\ and Library\\ are written next to the .exe.',
    'fail': 'Scroll up for the reason. The usual ones are a missing PyInstaller '
            '(py -m pip install pyinstaller), a missing runtime dependency from '
            'requirements.txt, or dist\\RibbitFlip.exe being open in another program.',
    'locked': 'RibbitFlip is still running, so Windows will not let the build replace '
              'dist\\RibbitFlip.exe. Close it first - right-click the frog in the system tray, '
              '"Zakoncz / Quit" - then run this again. Quitting that way also releases held '
              'keys and closes the MIDI port cleanly, which killing the process does not.',
    'locked-beat': 'RibbitBeat is still running, so Windows will not let the build replace '
                   'dist\\RibbitBeat.exe. Close the game window (Alt+F4), then run this again.',
}


def wordmark(width, animate, spare=0):
    """The name at the top of the build, a row at a time: "Ribbit" in white, "Flip" in pink.
    A console too narrow for the drawing gets the name as plain text - same two colours, no
    picture, rather than a wrapped one."""
    art, ink = art_for('start', width, spare)
    print()
    if art:
        draw(art, ink, min(ENTRANCE, len(art) * PACE) if animate else 0.0)
    else:
        print(' ' * MARGIN + tint('Ribbit', INK['w']) + tint('Flip', INK['P']))
    print()


def main(argv):
    global COLOUR, EXE
    try:
        sys.stdout.reconfigure(errors='replace')   # one character this stream cannot take must
    except Exception:                              # never take the summary down with it
        pass
    kind = argv[0] if argv else 'ok'
    since = argv[argv.index('--since') + 1] if '--since' in argv[:-1] else None
    if '--exe' in argv[:-1]:
        EXE = os.path.join(ROOT, argv[argv.index('--exe') + 1])
    COLOUR = colour_ok()
    animate = anim_ok()
    width = shutil.get_terminal_size(fallback=(80, 25)).columns

    # Whether a row may end in the very last cell of the window. With virtual-terminal processing
    # on - which is what colour_ok() has just switched on, and what colour needs anyway - the
    # console defers its line wrap until the next character, so it may; a redirected stream has
    # no width to wrap at. An old console without VT wraps the moment that cell is written and
    # would then sit a blank line between every row of the drawing: there, keep one column spare.
    try:
        console = bool(sys.stdout.isatty())
    except Exception:
        console = False
    spare = 1 if console and not COLOUR else 0

    if kind == 'start':
        wordmark(width, animate, spare)
        return

    art, ink = art_for('ok' if kind == 'ok' else 'fail', width, spare)
    print()
    if art:
        draw(art, ink, ENTRANCE if animate else 0.0)
        print()
        if animate:
            time.sleep(BEAT)   # the picture gets a moment to itself before the facts land
    pad = ' ' * MARGIN
    print(pad + '   '.join(tint(text, colour) for text, colour in summary(kind, since)))
    if kind == 'ok':
        sha = digest(EXE)
        if sha:
            print(pad + tint('SHA-256', DIM) + '  ' + tint(sha, TEXT))
    note = NOTES.get('locked-beat' if kind == 'locked' and product() == 'RibbitBeat' else kind)
    if note and product() != 'RibbitFlip':
        note = note.replace('dist\\RibbitFlip.exe',os.path.join('dist', os.path.basename(EXE)))
    if note:
        for chunk in textwrap.wrap(note, max(30, min(78, width - 2 * MARGIN))):
            print(pad + tint(chunk, DIM))
    print()


if __name__ == '__main__':
    try:
        main(sys.argv[1:])
    except (Exception, KeyboardInterrupt):
        # Never let the decoration bury the thing it was decorating - Ctrl+C through the
        # entrance included, which is somebody asking for the summary and nothing else.
        # The wordmark is the one kind with nothing to fall back to: it carries no facts, so
        # it leaves the line blank rather than inventing a verdict about a build that has not
        # even started.
        kind = sys.argv[1] if len(sys.argv) > 1 else 'ok'
        if kind == 'start':
            print()
        else:
            print('\n  ' + ('Done. File: dist\\' + os.path.basename(EXE) if kind == 'ok'
                            else 'BUILD FAILED - scroll up for the reason.') + '\n')
