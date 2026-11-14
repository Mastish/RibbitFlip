# Purpose and safeguards: a map of the code that controls the computer

← [README](../../README.en.md) · [Polski](../pl/cel-i-zabezpieczenia.md) · [Safety & privacy](privacy.md) · [`SECURITY.md`](../../.github/SECURITY.md)

RibbitFlip generates key presses, mouse movement and clicks, virtual gamepads, MIDI and OSC
messages, and on request it takes a screenshot. Read without context, code like that looks
suspicious, so this page gathers in one place **why** each mechanism exists, **when** it runs,
**what it does not do** and **how it is guarded**, with a pointer to the file and function.
Every sentence describes what the code does today. The same information sits in comments next
to the code.

## What the app is for

To let a person control **their own** computer with a motion controller (the Triki bottle cap
over Bluetooth LE): in games, in music software and for accessibility, when a keyboard and mouse
are out of reach (single-switch screen scanning, dwell click). The chain is always the same:

**capsule movement → a rule the person wrote or loaded → an output group the person switched on → input in the system.**

## What the app does not do

- **No keylogging.** The only keyboard hook (`PanicHotkey`) keeps just the set of keys held at
  this instant, to recognise three hotkeys. It stores, logs and sends nothing. There is no mouse
  hook at all.
- **No remote control.** Every server listens on `127.0.0.1` only (the HTTP dashboard, the DSU
  motion server). There is no option to change the listening address.
- **No hiding.** A tray icon (or a console window under `--no-tray`), no injection into other
  processes, no files marked hidden. It closes only the browser windows it opened itself for
  overlays and the scanner.
- **No autostart with Windows** until the person ticks "Run at Windows startup" in the tray menu.
- **No data collection.** No telemetry, no update check, no accounts. Outbound traffic happens
  only because of something the person did (list below).
- **No screenshots on its own.** A screenshot is taken only from a button or from a hotkey that
  ships switched off. The image stays on disk.
- **No typing on behalf of an AI assistant.** The MCP server configures the app, but it has no
  tool that presses a key, moves the mouse, takes a screenshot or reads the screen. It can arm
  the app only if the person allows that in the dashboard.

## Mechanism map

### Output to the system

| Mechanism | Purpose | When it runs | Safeguards | Code |
| --- | --- | --- | --- | --- |
| Keyboard and mouse | keys, combinations, clicks, scrolling, click at a screen point | at the end of the chain movement → rule → switched-on group; the Test button in the dashboard | no emitter under `--no-keys`; `armed` gate + group switch; the emergency stop releases everything; writes input only, reads none | `ribbitflip_monitor.py`: `KeyEmitter`, `SlotOutput` |
| Virtual pad (Xbox 360 / DualShock 4) | games that understand only a pad | Controller module on and capsule armed | a visible device in the system (ViGEmBus driver); no emitter under `--no-keys`; the emergency stop recentres the stick | `GamepadEmitter`, `AirMouse._tick` (`live`) |
| Triggers (Mapping) | threshold on an axis or the capsule's button → action | rule met, emitter present, `armed`, group switch (`_gate_for`) | disarming releases held keys; imported rules pass the classifier; `scan:stop` always passes | `TriggerEngine`, `DeviceManager._effective` |
| Motion control | cursor, stick, d-pad, dwell click | module on (off by default) and capsule armed | 1.5 s without samples releases the outputs; a switched-off module only computes the preview | `AirMouse` |
| Selection wheel | picking an action from a wheel of slices | module on (off by default), at least two slices | an action leaves only from an armed capsule (`trig.armed`) with the wheel switched on through the ordinary emitter; no emitter under `--no-keys` | `RadialMenu._fire` |
| Scanner (accessibility) | a bar sweeps the screen, one signal chooses where to click | module switched on by the person, or by an MCP assistant the person connected; the window over the desktop is open | a trigger from a setup cannot switch the module on; the click goes through `/test-key` with the token and only while the capsule is armed; Shift+R+F closes the window; orphaned windows are cleaned up at start | `ScanModule`, `ScanOverlay`, `SlotOutput._scan` |
| MIDI OUT | notes and CC for music software | MIDI group on and capsule armed | output only, no MIDI input; not created under `--no-midi`; MIDI panic and the emergency stop silence notes | `MidiEmitter`, `MidiMapper`, `midi_panic` |
| OSC OUT | motion values for TouchOSC, Resolume, VRChat, ESP32 | OSC group on and capsule armed | sends only to the address the person typed (default `127.0.0.1`), never reads anything; not created under `--no-midi` | `OscEmitter` |
| DSU motion server | capsule motion for emulators (Dolphin, Cemu and others) | after it is switched on in the Controller card | listens on `127.0.0.1` only; answers three read requests, presses nothing; not created under `--no-midi` | `DsuServer` |
| Commands to the capsule | writing bytes to the capsule over BLE (LED, wake-up) | from the dashboard | only to the connected capsule, up to 64 bytes | `PuckSource.queue_command` |

### Reading the screen and system state

| Mechanism | Purpose | When it runs | Safeguards | Code |
| --- | --- | --- | --- | --- |
| Screenshot | background of a scanner view, on which the scanning area is drawn | the "Screenshot" button in the Scanner's "Advanced" fold or on the bar over the desktop; the Alt+R+digit hotkey, off by default | no periodic captures and no text recognition; the file goes to `Settings/ScanTla/`; it leaves the computer only inside a scanner setup the person downloads; MCP has no screenshot tool | `zrzut_monitora`, `scan_zrzut_ekranu`, `scan_zrzut_skrotem`, `scan_zrzuty_spakuj` |
| Keyboard hook | emergency stop Alt+R+F, close the scanner Shift+R+F, screenshot Alt+R+digit | while that hotkey is enabled in Settings | keeps only the keys held now and two counters; swallows only the key that completes its own combination; a bug lets the key through; not installed in an `--allow-multi` test copy; right Alt never fires it | `PanicHotkey._match`, `hotkey_check` |
| Foreground program | loading the setup assigned to a game automatically | only after the feature is switched on (off by default) | reads only the `.exe` file name, not the window title or contents; never arms outputs; does not poll while off | `GameSwitcher`, `_foreground_exe` |

### Servers and control channels

| Mechanism | Purpose | When it runs | Safeguards | Code |
| --- | --- | --- | --- | --- |
| Dashboard HTTP server | the dashboard in the browser | the whole time the app runs | listens on `127.0.0.1` only; `Host` must be `127.0.0.1` or `localhost` (DNS rebinding defence); a foreign `Origin` is rejected; session token on every `POST`; 2 MB body cap; files only from `web/` | `_bind_http`, `make_handler._csrf_reject` |
| MCP server for AI assistants | an assistant composes setups and rules | after it is switched on in Settings, in the "Advanced" fold (off by default); `--no-mcp` locks it for the whole run | programs on this computer only, any request with a browser `Origin` is rejected; the same sanitizers as the dashboard; no tools for typing, clicking or screenshots; arming, switching the Scanner or the Wheel on and advanced mode pass only with the "Assistant may arm" switch (off by default); every assistant change shows a note in the dashboard | `_serve_mcp`, `_require_consent`, `rfOnMcpAction`, `ribbitflip_mcp.py`, `tools/mcp_stdio_bridge.py` |
| Emergency stop | switching outputs off at once | Alt+R+F (configurable), works with the dashboard hidden too | switches off Mapping, Motion control, MIDI, OSC, Services, Synth, Scanner and Selection wheel on every capsule, releases keys, silences notes, closes the scanner window and the wheel-at-the-cursor window; not a toggle, turning things back on is a deliberate click. The master switch stays as it is on purpose: the stop works through the module switches | `panic_stop`, `midi_panic`, `rfOnPanic` (`web/js/rf-39j-hotkey.js`) |

### Outbound connections (all started by the person)

| Mechanism | Purpose | When it runs | Safeguards | Code |
| --- | --- | --- | --- | --- |
| Network services (HTTP) | a rule sends a request to the person's address | a rule or the Test button, module on (checked by the dashboard) | redirects not followed; 30 s, 256 KiB of reply; headers and body never logged; nothing about the user is added | `make_handler._rest_send` |
| OBS Studio | controlling OBS over obs-websocket 5 | after connecting in the Services card | only a loopback or private-network IP literal; the password stays in the browser | `ObsClient`, `ObsClient._host_reject` |
| Setup from a link | downloading a shared setup | after a link is pasted | `https` from an allowlist of hosts only (Discord, GitHub); 1 MiB; applies nothing, the dashboard shows the safety preview | `make_handler._setup_fetch` |
| RibbitBeat MIDI packs | MIDI files from Hugging Face, importing a song from an address | after a click in the game | size cap, MIDI header check; import from an address works only from the internet: addresses of this computer and the local network are refused, after a redirect too | `ribbitflip_songpacks.py`: `sprawdz_adres`, `_otworz_import`, `pobierz_zakres` |

### Presence in the system

| Mechanism | Purpose | When it runs | Safeguards | Code |
| --- | --- | --- | --- | --- |
| Tray icon | opening the dashboard, overlays, quitting | the whole time (without it, a console window under `--no-tray`) | a visible "Quit" item | `_make_tray_image`, tray menu |
| Autostart | starting after login | only after the tray menu item is ticked | the only writer of the `HKCU\…\Run` key; no admin rights; visible in Task Manager; removed by the same click | `_set_autostart`, `_autostart_cmd` |
| System notifications | telling the person a rule fired | after notifications are switched on | a name and icon entry under `HKCU\Software\Classes\AppUserModelId` only at the first notification | `_register_app_user_model_id`, `SystemNotifier` |
| Overlays | cheat sheets and the orientation ball over the game | opened and closed by the person | show only the app's own page from `127.0.0.1`; never take focus; send no input | `OverlayWindow`, `OverlayManager` |
| Starting processes | browser windows for overlays and the scanner, Explorer on a fixed folder, opening the dashboard, restart on a mode switch | on the person's action | a fixed argument list built by the app, never from request data | `OverlayWindow.open`, `ScanOverlay.open`, `reveal_in_explorer`, `_open_panel`, `_do_mode_restart` |

## Launch flags that restrict output

| Flag | Effect |
| --- | --- |
| `--no-keys` | hard block: no keyboard, mouse or pad-button emitter is created; the preview stays |
| `--simulate` | fake motion, real keys; every output group starts off, the first one switched on asks for confirmation, and switches flipped in simulation are not saved |
| `--no-mcp` | the MCP endpoint is locked for the whole run |
| `--no-midi` | no MIDI, OSC or DSU server |
| `--disable` / `--only` | the chosen modules do not start at all |
| `--allow-multi` | test copy: installs no keyboard hook |

## Importing other people's setups

Rules from setups, bundles and profiles from outside the app pass the classifier
(`analyze_config`, `_classify_rule`, `_classify_spec`). Combinations with the Windows key,
system shortcuts (Alt+F4, Ctrl+W, Alt+Tab and similar), macros, clicks at a fixed screen point
and unknown actions are "risky" and are dropped in safe mode. A loaded setup never flips a group
switch.

## Fixed on 2026-10-16, and deliberate decisions

The first version of this map listed gaps found while checking the code. All of them are fixed:

- **The emergency stop** switches the Selection wheel off too (`panic_stop`).
- **An AI assistant** cannot arm the app, switch the Scanner or the Wheel on, or load risky rules
  without the "Assistant may arm" switch in the MCP server card; the server checks this
  (`ribbitflip_mcp._require_consent`), not only the instructions to the model.
- **Every assistant change** shows a note in the dashboard (`rfOnMcpAction`).
- **Importing a song from an address** works only from the internet, and every redirect passes
  the same check (`sprawdz_adres`, `_otworz_import`).
- **`tools/osc_monitor.py`** listens on `127.0.0.1`; the network only with `--lan`.
- **`ribbitflip_audio.py`** has the same Alt+R+F emergency stop.
- **`SECURITY.md` and the privacy pages** list every outbound connection, every place a process
  is started, the files outside the app folder and the registry entries.

Two things stay on purpose, because that is how the app is designed (see `SECURITY.md`):

1. **The master switch starts armed.** Saved group switches work as soon as a capsule connects;
   every group switch is turned on by the person, and the emergency stop turns them off.
2. **The session token does not authenticate local programs.** The security boundary is the
   `127.0.0.1` bind.
