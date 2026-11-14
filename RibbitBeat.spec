# -*- mode: python ; coding: utf-8 -*-
# RibbitBeat.exe - the rhythm game on its own (build_exe.bat beat). Entry point ribbitbeat_app.py: a
# small 127.0.0.1-only server for web/gry + web/assets, the /gry/api/ song-pack routes (the same
# ribbitflip_songpacks module the app uses) and a full-screen Edge/Chrome app window. No BLE, no
# keyboard/mouse/gamepad output and no tray icon, so none of bleak/pynput/vgamepad/pystray is in here.
import io as _io
import os as _os
import re as _re

# One version number for all three builds: APP_VERSION in ribbitflip_monitor.py, read with a regex
# (importing that module would start the whole application at build time).
_src = _io.open('ribbitflip_monitor.py', encoding='utf-8').read()
APP_VERSION = _re.search(r'^APP_VERSION\s*=\s*"([^"]+)"', _src, _re.M).group(1)
_nums = [int(x) for x in _re.findall(r'\d+', APP_VERSION)][:4]
_nums += [0] * (4 - len(_nums))

_os.makedirs('build', exist_ok=True)
_VERSION_FILE = _os.path.join('build', 'version_info_beat.txt')
_io.open(_VERSION_FILE, 'w', encoding='utf-8').write("""VSVersionInfo(
  ffi=FixedFileInfo(filevers=%(n)s, prodvers=%(n)s, mask=0x3f, flags=0x0,
                    OS=0x40004, fileType=0x1, subtype=0x0, date=(0, 0)),
  kids=[
    StringFileInfo([StringTable('040904B0', [
      StringStruct('CompanyName', 'Mastish'),
      StringStruct('FileDescription', 'RibbitBeat: sing along to MIDI songs with a mouse, a keyboard, a gamepad or a capsule'),
      StringStruct('FileVersion', '%(v)s'),
      StringStruct('InternalName', 'RibbitBeat'),
      StringStruct('LegalCopyright', '© 2026 Mastish. MIT License. Unofficial, not affiliated with Żabka.'),
      StringStruct('OriginalFilename', 'RibbitBeat.exe'),
      StringStruct('ProductName', 'RibbitBeat'),
      StringStruct('ProductVersion', '%(v)s'),
    ])]),
    VarFileInfo([VarStruct('Translation', [1033, 1200])])
  ]
)
""" % {'n': tuple(_nums), 'v': APP_VERSION})

datas = [('web/gry', 'web/gry'),        # the game itself (served under /gry/)
         # Its pictures and fonts, reached as ../assets/ (caps, fonts, frog, pad, textures today).
         # The whole folder rather than those five, so new game art never needs a change here.
         ('web/assets', 'web/assets'),
         # Song-pack manifests (metadata and checksums only, no MIDI: the songs are downloaded by the
         # user's copy from Hugging Face, see ribbitflip_songpacks.py). Not the *.rejections.json.
         ('packs/cc0_classics.json', 'packs'), ('packs/basic_classics.json', 'packs'),
         ('packs/cc_by_classics.json', 'packs'),
         # The file travels without this repository: licence texts of what is frozen in (CPython,
         # OpenSSL, the OFL fonts, ...). See third_party_licenses/README.md.
         ('third_party_licenses', 'third_party_licenses'),
         ('LICENSE', '.')]

a = Analysis(
    ['ribbitbeat_app.py'],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    # Nothing here needs them; listed so a stray import can never drag them in.
    excludes=['numpy', 'tkinter', 'bleak', 'pynput', 'vgamepad', 'pystray', 'PIL'],
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
    name='RibbitBeat',
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
    icon='assets/ribbitbeat.ico',
    version=_VERSION_FILE,
)
