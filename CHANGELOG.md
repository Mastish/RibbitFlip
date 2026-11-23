# Changelog

All notable changes to RibbitFlip are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **Controller:** an installed ViGEmBus driver that stops responding gets its own warning with the repair steps, and **Check again** sees the repaired driver without restarting the app.

## [1.0.0] - 2026-11-22

First public release: everything below is new, so this list is the whole app as it went public. What
the app does is in the README ([English](README.en.md) · [Polski](README.md)) and in the ℹ tab of every
module in the panel. From this point on, each release says what changed since the one before it.

### Added
- **Connection:** RibbitFlip connects to the "Triki" capsule over Bluetooth with no Windows pairing, reads its tilt, turn and button, and handles several capsules at once, each with its own settings and colour.
- **Panel:** everything is set up in a panel that opens in your browser, in Polish or English; on first start it asks what you want to use it for and shows only those modules, with a guide in every screen's About tab.
- **Simulation:** no capsule yet? Drive a virtual one with the mouse; rules react just as they do to a real capsule.
- **Mapping:** tilting, turning or clicking the capsule presses a key, clicks the mouse or presses a gamepad button; start from six ready motions or build rules of the kind "when the capsule does X, do Y".
- **Selection wheel:** a wheel with up to 16 actions on screen, picked by moving the capsule; you set a slice's action by pressing the key or shortcut.
- **Mouse:** the capsule drives the cursor, and a click can happen by itself when you hold the cursor still, with a tolerance you set for a tremor.
- **Scanner:** the whole computer with one signal: a bar sweeps the screen, you stop it, a second one crosses it and the click lands there; it tunes itself to your reaction time and has a practice desktop.
- **Controller:** the capsule acts as an Xbox 360, DualShock 4 or Wii controller.
- **Readiness line:** every module lists what still has to be in place for it to work (control, capsule, module, port, driver), each missing item with a button that fixes it.
- **Less at once:** each screen shows what you use every day; settings you set once fold away with their current values and a changed count, rarely used tuning sits under **Advanced**.
- **Undo:** deleting a rule, a wheel slice, a sound or a pad, resetting the 3D axes and **Restore defaults** can be undone for 25 seconds.
- **MIDI and OSC:** the capsule's motion controls music programs and stage software for visuals and lighting, such as TouchDesigner, Resolume and VRChat.
- **Services:** the capsule's motion sends commands to Discord, Home Assistant, OBS Studio and more; with two panel windows open, only one of them sends.
- **Synth:** the capsule plays in the browser like an instrument, with a sound library, samples you record yourself and backgrounds that react to the sound; one click takes you from "off" to the first sound.
- **Setups:** load a ready-made setup, share your own as a file or a Discord post, and let a setup load by itself when you switch to the game you named; the game field tells you if that is switched on.
- **Setups › Overwrite:** overwriting a setup keeps its game, description and instructions, and a setup saved without the Synth never clears the pads of whoever loads it.
- **Setups › Cassettes:** every setup is a felt cassette tape; pick one of eight with the cassette button next to **Save setup** or in the setup's preview, which also shows the creator's description and what the setup does, rule by rule; the file carries the cassette to everyone.
- **Setups › Games:** a setup that loads with a game lands on the capsule picked in the panel, saves a copy first and offers Undo.
- **Setups › Ready for games:** example setups for Exo One, Egging On, UFO 50, Balatro, Big Walk, Outer Wilds (with a tool wheel) and Portal 2, with the buttons read from the games' own files.
- **Several capsules:** Undo import goes back to the capsule the import changed, and the Mapping switch shows the capsule you picked.
- **Overlay:** small windows over your game show a cheat sheet of your settings, the selection wheel, a capsule preview and your own key guide written as a player's note.
- **Capsule preview:** the orientation preview shows the ball or a 3D model of the capsule, picked in the panel and separately in each overlay window.
- **Capsule look:** nine felt caps, picked in the capsule editor with a slowly turning 3D preview; the pill and the 3D model always show the same cap.
- **Sensitivity:** smoothing, zero point, dead zone, range and curve, and a capsule you put down stops steering until it moves again.
- **Settings › Modules switched off at start:** modules you do not use stay off, with no tab, no background work and no open ports; a shortcut with `--disable` or `--only` does the same.
- **Emergency stop:** `Alt`+`R`+`F` switches everything off at once, running macros and controller motion included, and lets go of held keys, also from the tray icon menu; each module comes back with its own switch.
- **MCP server:** an AI assistant such as Claude Code can read and compose your setups, and every change it makes shows a note in the panel; it never overwrites a saved setup.
- **Safe settings:** settings files are written in one step, and a damaged file is kept as a copy instead of being replaced with defaults; the panel warns when the folder cannot be written to.
- **Privacy:** everything runs on your own computer; the server listens only on `127.0.0.1`, with no cloud, no accounts and no telemetry.
- **RibbitBeat (preview):** a rhythm game that comes with the project: tilt the capsule to hit the pitch of each note and hold the button so your frog sings.
- **RibbitBeat › Players:** up to eight players at once on capsules, gamepads, the mouse or the keyboard, on their own lanes or as a choir, plus frog bots on four levels.
- **RibbitBeat › Menus:** the capsule and the gamepad drive the menus with a frog-paw pointer in the player's colour, aimed by tilting the capsule or with the left stick.
- **RibbitBeat › Songs:** 19 built-in public domain melodies, your own MIDI files and three packs of openly licensed classical music from IMSLP, downloaded with one click.
- **RibbitBeat › Song step:** songs sit on a wheel that snaps one at a time, with an **Easiest first** sort, the difficulty range of every part, and your own .mid files, downloads and packs under **Add your own**.
- **RibbitBeat › MIDI engine:** the backing plays as a **Single instrument**, **As in the file** or as the **Band**, **Orchestra**, **Brass band**, **8-bit console**, **Music box** or **Synths** set, with the drums from the file.
- **RibbitBeat › In a song:** each player's box shows the multiplier, five star slots and, with two or more players, the place and the gap to the leader.
- **RibbitBeat › Rewards:** the crew earns fame and spins a wheel for instruments, frog skins and scenes; the full set opens the Instrument studio, where you build or record an instrument of your own.
- **RibbitBeat › Accounts:** local accounts, profiles and a leaderboard remember who played and who hit the notes cleanest; nothing leaves the computer.
- **RibbitBeat › Made with AI:** the game's code and artwork were made with the help of AI, directed by the author, and the menu says so under the **Made with AI** tag.
- **Downloads:** three files: `RibbitFlip.exe` with everything, `RibbitFlip-Essential.exe` without the Synth and the game, and `RibbitBeat.exe`, the game alone in full screen.
- **Docs:** a README and a project page in Polish and English, a getting-started guide, a guide to the capsule as a helping hand, pages for developers and how to remove the app.
