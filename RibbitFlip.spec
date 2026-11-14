# -*- mode: python ; coding: utf-8 -*-
import io as _io
import os as _os
import re as _re

from PyInstaller.utils.hooks import collect_all

# The version shown in the Windows file properties of the .exe comes from the ONE place it is
# written, APP_VERSION in ribbitflip_monitor.py. Read out with a regex rather than by importing
# the module: importing it would run the whole application at build time.
_src = _io.open('ribbitflip_monitor.py', encoding='utf-8').read()
APP_VERSION = _re.search(r'^APP_VERSION\s*=\s*"([^"]+)"', _src, _re.M).group(1)
_nums = [int(x) for x in _re.findall(r'\d+', APP_VERSION)][:4]
_nums += [0] * (4 - len(_nums))

# THREE BUILDS come out of this repository (build_exe.bat [essential|beat|all]); this spec makes two:
#   RF_EDITION=full (the default) - the whole app, exactly as before;
#   RF_EDITION=lite - RibbitFlip-Essential.exe ("lite" is the internal name of that edition, kept in the
#     code and in edition.txt; only the file and its description say Essential): the same app WITHOUT the RibbitBeat game (web/gry/ and
#     the song-pack manifests stay out of the file) and with the "Wypróbuj" section of the panel
#     (Synth + the game link) hidden. The Synth CODE stays in: it is woven into dozens of rf-*.js
#     files, so Lite hides it instead of cutting it out. The panel learns it is Lite from a one-word
#     resource, edition.txt (read by ribbitflip_monitor.py, _edition()).
# The third build, the game on its own, is RibbitBeat.spec.
EDITION = (_os.environ.get('RF_EDITION') or 'full').strip().lower()
if EDITION not in ('full', 'lite'):
    raise SystemExit('RF_EDITION must be "full" or "lite", not %r' % EDITION)
LITE = EDITION == 'lite'
EXE_NAME = 'RibbitFlip-Essential' if LITE else 'RibbitFlip'

_os.makedirs('build', exist_ok=True)
_VERSION_FILE = _os.path.join('build', 'version_info_lite.txt' if LITE else 'version_info.txt')
_io.open(_VERSION_FILE, 'w', encoding='utf-8').write("""VSVersionInfo(
  ffi=FixedFileInfo(filevers=%(n)s, prodvers=%(n)s, mask=0x3f, flags=0x0,
                    OS=0x40004, fileType=0x1, subtype=0x0, date=(0, 0)),
  kids=[
    StringFileInfo([StringTable('040904B0', [
      StringStruct('CompanyName', 'Mastish'),
      StringStruct('FileDescription', 'RibbitFlip%(lite)s: turn the motion capsule into a keyboard, mouse, gamepad, MIDI and OSC'),
      StringStruct('FileVersion', '%(v)s'),
      StringStruct('InternalName', '%(exe)s'),
      StringStruct('LegalCopyright', '© 2026 Mastish. MIT License. Unofficial, not affiliated with Żabka.'),
      StringStruct('OriginalFilename', '%(exe)s.exe'),
      StringStruct('ProductName', 'RibbitFlip'),
      StringStruct('ProductVersion', '%(v)s'),
    ])]),
    VarFileInfo([VarStruct('Translation', [1033, 1200])])
  ]
)
""" % {'n': tuple(_nums), 'v': APP_VERSION, 'exe': EXE_NAME, 'lite': ' Essential' if LITE else ''})

datas = [# The frog head: the tray icon, and the small icon on top of our system notifications
         # (AppUserModelId IconUri, read at RUNTIME by Windows from this path).
         ('assets/ribbitflip_head.png', 'assets'),
         # The big picture that sits BESIDE the notification text (NIIF_USER hBalloonIcon).
         ('assets/ribbitflip_notify.ico', 'assets'),
         ('assets/ribbitflip.ico', 'assets'),
         ('web', 'web'),   # the whole front-end incl. the HTML shell — a dir tuple bundles recursively
         # Setups that ship with the app (read-only). Without them a fresh install starts with an
         # empty library, so the cap does nothing until somebody builds a mapping from zero.
         ('Presets', 'Presets'),
         # RibbitBeat: manifesty pakietów MIDI (same metadane i skróty, BEZ plików MIDI: pliki pobiera aplikacja
         # użytkownika z Hugging Face, patrz ribbitflip_songpacks.py).
         ('packs/cc0_classics.json', 'packs'), ('packs/basic_classics.json', 'packs'),
         ('packs/cc_by_classics.json', 'packs'),
         # A downloaded .exe travels without this repository, so it has to carry the
         # licence texts of everything frozen into it (CPython, OpenSSL, PyWinRT,
         # ViGEmClient, the OFL fonts, …). See third_party_licenses/README.md.
         ('third_party_licenses', 'third_party_licenses'),
         ('LICENSE', '.')]
binaries = []
hiddenimports = []
tmp_ret = collect_all('bleak')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]
tmp_ret = collect_all('pynput')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]
tmp_ret = collect_all('vgamepad')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]
# pystray drives the system-tray icon (near the Windows clock). Collect its
# backend so the windowless (console=False) build finds pystray._win32 + six.
tmp_ret = collect_all('pystray')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]
hiddenimports += ['pystray._win32', 'six', 'PIL.Image', 'PIL.ImageDraw']

# Do NOT bundle the ViGEmBus kernel-driver .msi installers that vgamepad ships
# (see third_party_licenses/README.md). RibbitFlip only talks to an already-installed
# ViGEmBus via ViGEmClient.dll; users install the driver separately if they want
# gamepad output. This keeps a third-party driver installer out of the executable.
def _keep(entry):
    src = str(entry[0] or '').lower().replace('\\', '/')
    return not (src.endswith('.msi') or 'vigem/install' in src)
datas = [d for d in datas if _keep(d)]
binaries = [b for b in binaries if _keep(b)]

if LITE:
    # LITE: the game folder and the song-pack manifests stay out. ('web', 'web') bundles the whole
    # tree in one go, so for Lite it is spelled out file by file with web/gry/ pruned; the server
    # answers 404 for the game routes on its own (it reads edition.txt, see below).
    def _web_without_game():
        out = []
        for root, dirs, files in _os.walk('web'):
            if _os.path.normpath(root) == 'web':
                dirs[:] = [d for d in dirs if d != 'gry']
            if _os.path.normpath(root) == _os.path.normpath('web/assets'):
                dirs[:] = [d for d in dirs if d != 'motywy']   # game theme art (~11 MB), only the game uses it
            for f in files:
                out.append((_os.path.join(root, f), _os.path.normpath(root)))
        # The one file the panel shares with the game (sample recording and processing: Synth > Sample and
        # the game's instrument studio). It lives under web/gry/js/ only because RibbitBeat.exe packs that
        # folder alone; the dashboard loads it unconditionally, so Essential keeps it and the server lets it
        # past the game gate (SHARED_GAME_FILE in ribbitflip_monitor.py). 2026-10-21.
        out.append((_os.path.join('web', 'gry', 'js', 'probki-audio.js'), _os.path.normpath('web/gry/js')))
        return out
    datas = [d for d in datas
             if d != ('web', 'web') and str(d[1]).replace('\\', '/').split('/')[0] != 'packs']
    datas += _web_without_game()
    # One word, generated here so nothing in the repository has to carry it: the full build simply
    # has no such file, which ribbitflip_monitor.py reads as "full".
    _EDITION_FILE = _os.path.join('build', 'edition.txt')
    _io.open(_EDITION_FILE, 'w', encoding='utf-8').write('lite\n')
    datas.append((_EDITION_FILE, '.'))


a = Analysis(
    ['ribbitflip_monitor.py'],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    # numpy is only an OPTIONAL Pillow accelerator (Image.fromarray); we draw the
    # tray icon with Image.new + ImageDraw primitives, so drop ~15 MB of unused numpy.
    excludes=['numpy'],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name=EXE_NAME,
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='assets/ribbitflip.ico',
    version=_VERSION_FILE,
)
