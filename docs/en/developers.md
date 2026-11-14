# For developers

← [README](../../README.en.md) · [Polski](../pl/programisci.md)

**Running from source.** You need Windows and Python 3.10 or newer.

```bash
pip install -r requirements.txt
python ribbitflip_monitor.py --simulate     # no hardware: synthetic motion, real output
python ribbitflip_monitor.py                # real capsule, full control
```

Either way a local server starts on `http://127.0.0.1:8770/` and the panel opens in your browser.
The `--simulate` flag does the same as the **LIVE / Simulation** switch in the panel.

> **Windows tip:** if `python` opens the Microsoft Store ("Python was not found"), use the
> **`py`** launcher instead: `py ribbitflip_monitor.py`.

## Under the hood

Three parts, all on your own computer:

1. **The capsule** sends 6-axis IMU data plus button, battery and signal-strength status over BLE
   (a Nordic-UART-style service, `6e4000xx`, reverse-engineered by the community, see
   [`CREDITS.md`](../CREDITS.md)).
2. **`ribbitflip_monitor.py`** decodes the packets, stabilises the pose (1-Euro filter, expo curve,
   calibration, auto-tare) and runs the rules you set.
3. **Output modules** turn the result into real control: keys, mouse motion, a virtual gamepad,
   MIDI/OSC messages, REST calls.

The panel is a static page served by the same local process. It receives live data over
Server-Sent Events. No build step, no bundler, no cloud.

**Repo layout**

```text
ribbitflip_monitor.py     BLE client, pose pipeline, output engines, local HTTP server (almost 28k lines)
ribbitflip_audio.py       standalone audio script, no panel
ribbitflip_gesture.py     recorded gestures: recording and matching motion
ribbitflip_mcp.py         MCP server for AI assistants
web/                      the whole front end: HTML shell + 149 JS modules (rf-NN-*.js, load-ordered) + 29 CSS files
docs/                     project page, screenshots, diagrams, MCP.md
examples/                 sanitized example configs
Presets/                  the setups that ship with the app (read-only, bundled into the .exe)
tests/                    Python test scripts + Node harnesses
tools/                    osc_monitor.py, mcp_stdio_bridge.py, build_banner.py (+ build_banner_art.txt,
                          make_banner_art.py), gamepad_art.py, wii_art.py
RibbitFlip.spec           PyInstaller recipe for the one-file .exe
```

**Signal pipeline** (classes in `ribbitflip_monitor.py`)

```
PuckSource → DeviceBus → Device → PoseFilter → TriggerEngine │ AirMouse │ MidiMapper
                                                             └→ KeyEmitter · GamepadEmitter
                                                                MidiEmitter · OscEmitter
```

**Local server.** It binds `127.0.0.1:8770` only (`--port` to change). `GET /stream` is the
Server-Sent Events feed the panel listens to, alongside more than 100 JSON routes. Every call that
changes state carries the `X-RibbitFlip-Token` CSRF header, and a Host/Origin gate refuses foreign
origins. The server listens on loopback only, and that is the security boundary: the session token
stops other websites in your browser, not other programs running under your account.

**Outgoing connections.** Network services: http/https only, no redirects. The OBS client: a
websocket (obs-websocket) to loopback or the home network only; the OBS password and service tokens
stay in the browser, and only a signature travels on. Fetching a setup from a link
(`/setup/fetch`): https only, and only from an allowlist of hosts: Discord's CDN,
`raw.githubusercontent.com` and gist. The diagnostic bundle is a zip built from an allowlist of
files, with no password vault, no overlay browser profile, no contents of your setups and no
Windows account name; keys redacted, Bluetooth address trimmed, saved to the `Zgloszenia/` folder.
Full model: [`SECURITY.md`](../../.github/SECURITY.md).

**Config on disk** is plain JSON next to the executable, in the `Settings` and `Library` folders:
one set per device slot (`*_rules.json`, `*_midi.json`, `*_mouse.json`, `*_pose.json`,
`*_power.json`, `*_wheel.json`, `*_devices.json`), a few app-wide files (among them
`Settings/ribbitflip_synth.json`, the services log `Settings/ribbitflip_rest_log.jsonl` and the
overlay browser profile `Settings/OverlayBrowser/`), and setups for sharing. See
[`examples/`](../../examples) for the shapes.

**Credential vault.** Service credentials are encrypted by the browser (WebCrypto, PBKDF2-SHA-256,
310 000 iterations → AES-GCM-256). Neither the passphrase nor the plaintext reaches Python.

**Outputs in detail.** OSC sends float/int/bool over UDP. The Wii controller goes out over DSU on
`127.0.0.1:26760`. MIDI goes through the system `winmm`, with no extra libraries. The Synth plays
through WebAudio.

**The audio script** [`ribbitflip_audio.py`](../../ribbitflip_audio.py) controls volume without the
panel, and [`ribbitflip_audio_launcher.vbs`](../../examples/ribbitflip_audio_launcher.vbs) starts it
silently.

## Command-line flags

Everyday use needs no flags at all. These come in handy when you run the app from source or from a
shortcut:

| Flag | When it helps |
|---|---|
| `--simulate` | You want to try the app without a capsule. The motion is synthetic but the output is real, which is why modules start off. |
| `--no-keys` | You want to watch the capsule with no risk: no key and no mouse movement reaches the system. |
| `--port <number>` | Another program already holds port `8770`. |
| `--no-mcp` | You want the AI assistant locked out for good, whatever the switch in the panel says. |
| `--disable <modules>` | The computer is slower and you want the listed modules not to start at all, e.g. `--disable wheel,scanner`. |
| `--only <modules>` | The other way round: only the listed modules, what they need and the core ones start. |
| `--list-modules` | You want to see the module names and dependencies. |

Module list, dependencies and examples: [A slower computer](features.md#a-slower-computer-start-only-the-modules-you-need).
`GET /modules` says what runs in this start (a reason for every module that is off, and the names of
the engine threads), and the routes of a switched-off module answer `404` with `disabled`, `module`
and `error`. The choice made in the panel lives in `Settings/ribbitflip_modules.json`
(`{"disable": [...]}`) and only counts when the option and the variables are silent. `GET
/modules/startup` reads it, `POST /modules/startup` saves it (with the session token, the same names
as `--disable`) and `POST /modules/restart` restarts the app.

The other flags are for testing and diagnostics. [`CONTRIBUTING.md`](../../.github/CONTRIBUTING.md)
describes them, and `python ribbitflip_monitor.py --help` lists them.

**Testing OSC without extra software.** Run `python tools/osc_monitor.py` (listens on UDP
`127.0.0.1:9000`; add `--lan` to hear another machine), add an OSC mapping and switch the module on: messages print live.
[Protokol](https://hexler.net/protokol) (free, by the TouchOSC makers) works too.

## Building the `.exe`

The file on Releases is unsigned, and the program presses keys and moves the mouse by design, so
building it yourself is the simplest way to see what you are running: same sources, your machine,
your copy. The `pynput` and `pystray` licences (LGPL) require the recipe to be public anyway.

You need Windows and Python 3.10 or newer. Version 1.0.0 was built with Python 3.14 and
PyInstaller 6.19.

```bash
pip install -r requirements.txt
pip install pyinstaller
build_exe.bat        # or: py -m PyInstaller --noconfirm --clean RibbitFlip.spec
```

`build_exe.bat` runs the same command, but first checks that the app is not running, and it uses
the `py` launcher, so it never hits the Microsoft Store stub.

**Three variants.** With no parameter (a double-click) you get the full app and the game, `RibbitFlip.exe` and
`RibbitBeat.exe`; `build_exe.bat full` builds the app alone. `build_exe.bat essential` builds
`RibbitFlip-Essential.exe` without the Synth and the game (the same `RibbitFlip.spec` with
`RF_EDITION=lite`, the edition's internal name in the code), `build_exe.bat beat` builds the game on its own, `RibbitBeat.exe`, from
`RibbitBeat.spec` (entry point `ribbitbeat_app.py`, no BLE or keyboard libraries, around 13 MB),
and `build_exe.bat all` builds all three in a row.

**What you get:** a single `dist/RibbitFlip.exe`, around 26 MB, with `bleak`, `pynput`,
`vgamepad`, `pystray`, the `web/` front end, the setups from `Presets/`, icons and licence texts.
It does **not** hold the ViGEmBus installer (you
[install the driver separately](https://github.com/nefarius/ViGEmBus/releases)) or `numpy`.
**A fresh build starts empty**: Settings, Library and problem reports live next to the `.exe`, so
the copy in `dist/` cannot see the configuration of the one downloaded from Releases.

**When something goes wrong:**

| What you see | What it means |
|---|---|
| `Python was not found` | `python` hit the Microsoft Store stub. Use `py`. |
| `PermissionError: [WinError 5] ... dist\RibbitFlip.exe` | The old copy is still running and Windows holds the file. Quit it from the tray. |
| `No module named objc` | The macOS BLE backend, unused on Windows. Harmless. |
| `UPX is not available` | The file comes out a bit larger, nothing else changes. |
| Your antivirus deletes the fresh build | A PyInstaller-packed program that presses keys looks like a keylogger from the outside. Add a folder exception and report the false positive. More in the [FAQ on the project page](https://mastish.github.io/RibbitFlip/#faq). |

**Checksum.** At the end `build_exe.bat` prints the SHA-256 of the fresh file under the frog
(`certutil -hashfile dist\RibbitFlip.exe SHA256` gives the same number). It tells you whether the
copy on a pen drive is the one that came off your machine. Two builds from the same sources are not
byte-identical, because PyInstaller writes paths and timestamps into the file, so comparing against
the release proves nothing.

Would you rather not build anything? Run the app from source, as described at the start of
[For developers](#for-developers).
