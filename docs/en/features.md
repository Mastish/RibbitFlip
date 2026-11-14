# What RibbitFlip can do

← [README](../../README.en.md) · [Polski](../pl/funkcje.md)

## Modules

The panel has **nine modules**. Each has its own switch and a dot in the navigation that shows
whether it is on. You can use one or several at once.

| Module | What it does | Needs |
|---|---|---|
| **Mapping** | Tilting, turning or clicking the capsule presses a key, clicks the mouse or presses a gamepad button. | ViGEmBus for gamepad buttons |
| **Selection wheel** | A wheel with up to 16 actions appears on screen, and you pick one by moving the capsule. | – |
| **Mouse** | The capsule drives the mouse cursor, and a click can happen by itself when you hold the cursor still. | – |
| **Scanner** | Run the whole computer with one signal: a bar sweeps the screen and you stop it where it should click. | Edge, Chrome, Brave or Vivaldi for the window over the desktop |
| **Controller** | The capsule acts as a gamepad: Xbox 360, DualShock 4 or Wii. | ViGEmBus for Xbox 360 and DualShock 4 |
| **MIDI** | The capsule's motion controls a music program: volume, a filter or notes. | loopMIDI, to connect to a music program |
| **OSC** | Sends the capsule's motion to visuals, lighting and stage software, e.g. TouchDesigner, Resolume, VRChat. | – |
| **Services** | The capsule's motion sends a command to another app or a device on the network: Discord, Home Assistant, OBS Studio… | – |
| **Synth** | The capsule plays sounds in the browser like an instrument, each capsule with its own voice. | – (audio never leaves the browser) |

MIDI and OSC are two popular "languages" that programs use to talk to each other: MIDI is the
standard for instruments and music programs, and OSC is the standard for visuals, lighting and
stage software.

Besides the modules, the panel has the screens **Setups** (ready-made and saved sets of settings),
**Settings** (settings for the whole app), **Overlay** (small windows shown over a game),
**Sensor** (a view of what the capsule measures) and **Connection** (connection status and the capsule battery). On
the right of the panel you pick a capsule and watch its motion live.

In the navigation the **Synth** sits in its own **Try it out** group, together with the **RibbitBeat**
game, between the modules and the other screens. It is the quickest way to see and hear the capsule
in action with no setup at all. The Synth still works as an instrument wired to everything else
(mapping, effect pads), and RibbitBeat is a rhythm game for several people: capsule, gamepad or mouse,
with a leaderboard.

Every module has the same three tabs:

| Tab | What is in it |
|---|---|
| **Configuration** | The module's settings for the selected capsule. At the top, one sentence on what that capsule has set up and whether it is saved. |
| **Library** | Your saved settings for the module. You can load them, describe them, move them to another capsule or send them to someone. |
| **About** | The module's guide, with drawings. |

**Overlay** has the tabs Overlay · Cheat sheet · About, and **Synth** adds **Sounds** between
Configuration and Library.

**Three levels of settings.** The top of a screen holds what you use every day and one pink main
action. What you set once sits in folds: a closed fold shows its current values and the number of
changes ("changed: 3") in its heading, and inside it has **Restore defaults**, which you can
undo. Rarely used settings are in a single **Advanced** fold at the bottom of the screen. If you
would rather see everything at once, switch on **Expand all settings** on the **Settings** screen,
in the "Panel appearance" card.

**How saving works:** changes to the selected capsule's settings take effect and are saved in the
app immediately; they reach the **Library** only once you hit "Save the changes". An amber dot next
to a module means you have changes that are not in the Library yet. The capsule itself stores
nothing: the app keeps each capsule's settings on your computer.

Shared by every module:

- **Several capsules at once**, each with its own settings and colour.
- **Sharing setups.** You can load a setup from a file or from a link to a Discord post (and undo
  it within 25 s). A wizard helps you write a post with your setup. A setup can also load by
  itself when you switch to the game you named.
- **A setup is a cassette.** The cassette button next to **Save setup** lets you pick one of eight
  felt cassettes; it travels with the file, so the setup looks the same for everyone who loads it.
  A setup's preview shows the cassette, the creator's description and what it does, rule by rule.
  Clicking the cassette of your own setup changes it without saving the setup again.
- **Overlays over the game**: a cheat sheet of your settings, the selection wheel and a capsule
  preview.
- **Windows notifications** when a chosen rule fires. You see them even while the panel sits
  behind the game.
- **A capsule you put down stops steering.** When the capsule does not move for the time you set,
  the app pauses it, and movement brings it back.
- **Sensitivity tuning**: smoothing, zero point, dead zone (a small movement that does nothing),
  range and curve.
- **Simulation** with the capsule driven by hand with the mouse. Rules react just as they do to a
  real capsule.
- **Fewer things at once.** The first time you open it, the panel asks what you want to use
  RibbitFlip for (playing games, helping someone use a computer, music and streaming, or
  everything). The modules outside your choice wait under **More modules (N)** at the bottom of the
  module list, and they keep working. Change your choice with the eye above the navigation or in
  **Settings** ("Choose again" in the "Panel appearance" card). To keep a module from starting at
  all, start the app with `--disable` (below).
- **Polish and English interface**, and an illustrated guide in the **About** tab of every screen.
- **Tour and help** in the top bar: **Tour** shows you the panel step by step, and **Help and
  community** holds the links to the project page and the Discord server.

`Ctrl`+`B` folds the panel's left column, `Ctrl`+`\` the right one.

## A slower computer: start only the modules you need

You can switch off the modules you do not need when the app starts. Such a module does not start
for the whole run: it has no tab or card in the panel, computes nothing in the background, opens no
ports and installs no keyboard shortcuts. This is different from a module's **Off/On** switch and
from hiding its tab: those keep the module ready to work, this option removes it entirely until the
next start without it.

**The easy way, in the panel:** the **Settings** screen has a **Program start** fold with a switch
next to every module. Switch off what you do not need and click **Restart**. The
choice is saved straight away in `Settings\ribbitflip_modules.json` and applies to every later start,
from the Start menu and from autostart too, with no shortcut option needed. The fold also shows the
dependencies: switching off the Overlay switches off the Selection wheel with it. The start option
and the variable described below take priority over this choice. When the app was started with one
of them, the fold says so, and the choice stays saved for a start without the option.

| Name | Module | What it saves | Needs |
|---|---|---|---|
| `kolo` | Selection wheel | the wheel loop for every capsule and the wheel window at the pointer | `nakladka` |
| `mysz` | Mouse | the motion loop for every capsule (when `kontroler` is off too) | – |
| `kontroler` | Controller | the motion loop (together with `mysz`), virtual pads and the motion server for emulators | – |
| `skaner` | Scanner | two keyboard shortcuts and the window over the desktop | – |
| `midi` | MIDI | the MIDI port | – |
| `osc` | OSC | the OSC network socket | – |
| `uslugi` | Services | sending to services and the OBS Studio link | – |
| `synth` | Synth | the Synth's sound and drawing in the panel | – |
| `gra` | RibbitBeat | the game link and the game's page | – |
| `nakladka` | Overlay | windows over the game | – |
| `autozestawy` | Auto setups by game | checking every second which game is in front | – |
| `mcp` | MCP server | the AI assistant (same as `--no-mcp`) | – |

Always on, because the app makes no sense without them: **Mapping**, **Sensor**, **Connection**,
**All capsules at a glance**, **Setups** and **Settings** with the emergency stop.

Dependencies:

- **The selection wheel needs the Overlay**, because the wheel is shown in an overlay window (at the
  pointer, in the middle of the screen or in the overlays over the game). `--disable nakladka` also
  switches off the wheel, and `--only kolo` adds the Overlay by itself. The app says so in one line
  in the console.
- **Mouse and Controller** share one motion engine. Switching off one takes away only its modes
  (pointer, or stick and d-pad); the engine stops only when both are off.
- **MIDI and OSC** share the settings that map motion to channels. Each can be switched off on its own.

The settings of a module that is off are not lost. A rule that presses a pad button (with the
Controller off) or sends a scanner signal (with the Scanner off) stays in the **Mapping** list with a
“module switched off at start” badge, and the editor does not offer such actions for new rules. The
setup preview before loading shows which parts of a setup belong to modules that are off: they load
and are saved, but only work once the app starts without the option.

How to write it:

- `--disable kolo,skaner,midi` switches the listed modules off and keeps the rest,
- `--only mysz` keeps only the listed modules (and what they need) plus the core ones,
- `--list-modules` prints this list with English names and exits.

Names work with or without Polish letters, in any case, and in English too (`wheel`, `scanner`,
`controller`, `services`, `overlay`, `game`, `autosets`). An unknown name, or `--disable` together
with `--only`, stops the start with a message and the list of valid names.

Examples for a slower computer:

```bash
RibbitFlip.exe --disable wheel,overlay,scanner,synth,game
```

The capsule only presses keys (Mapping) and moves the pointer (Mouse):

```bash
RibbitFlip.exe --only mouse
```

The capsule as a music controller, without everything else:

```bash
RibbitFlip.exe --only midi,osc
```

**Permanently, from a shortcut:** right-click `RibbitFlip.exe`, choose "Create shortcut", then in the
shortcut's properties add the option to the **Target** field after the closing quote, e.g.
`"C:\RibbitFlip\RibbitFlip.exe" --disable wheel,scanner`. Instead of the option you can set the
environment variable `RIBBITFLIP_DISABLE` or `RIBBITFLIP_ONLY` to the same list. Only one source
counts at a time, in this order: the command line, then the variable, then the choice in the panel.

What is switched off is shown in the panel on the **Settings** screen: the closed **Program start**
fold says in its heading how many modules are off. Switching between **Live** and **Simulation** keeps the list, and "Run at Windows
startup" in the tray icon's menu remembers it when you switch it on in such a run. **RibbitFlip
Essential** simply has no Synth or game, so there is no need to switch those two off there.

## Feature details

- **Layers.** A layer is a separate set of rules you switch between, a bit like tabs. In the rule
  editor you pick a **Layer**: "Always" or one of four. The "Layer: 1 2 3 4" bar switches it, and
  so does the capsule: `layer:2`, `layer:next`, `layer:hold:2` (like Shift).
- **Macros.** A macro is several actions run one after another by a single rule.
- **Ready-made gestures.** The **"Ready-made gesture"** list in the rule editor fills in the
  condition, threshold and timings for you: shake, capsule upside down, a quick twist right and
  left, a double-click, a long hold. The **"Spin (|gyro|)"** measure takes how strongly the capsule
  moves in every direction, so a shake means the same however you hold it.
- **A new rule** starts from the "What should the capsule do?" tiles: a lean in four directions, a
  turn or a button click. Under the tiles there are two other ways in: **Record your own gesture**
  and **Set up manually**. In the editor the name and the action stay on top, the condition and the
  three basic behaviours are in the **Condition and behaviour** fold, and extra conditions, rarer
  behaviours and signals in **Advanced**.
- **Recorded gestures.** You repeat the gesture two or three times, set the accuracy with a slider
  and pick the action; a live motion chart shows where a gesture starts and ends. In advanced mode
  a recorded gesture is a condition you combine with others.
- **Selection wheel.** Five ways to drive it: *Hold the button and let go*, *Lean and hold it
  there* (no button), *Lean, then click*, *Click, lean, click* and *Step through it with clicks*,
  where a single button does everything and the trigger (whatever fires the rule) can be a lean
  alone. **Where to show the wheel**: at the pointer, in the overlays, in both or in the middle of
  the screen. The look, the control and the place of the wheel are folds with a summary, and the
  control tuning, the submenu shape and file import are in **Advanced**. Built-in wheels come back
  with **Restore the factory ones** in the Library, and the preview in the card works with the arrow
  keys and Enter.
- **Screen scanner.** Four ways to point (bars, blocks, screen items, radar), an action menu
  (click, double-click, right-click, drag, copy, paste, delete, on-screen keyboard) and a setting
  that matches how fast you react. You pick the signal separately for stopping the bar, stepping
  back and breaking off. **Views** are game screenshots the scanner sweeps its bar over: `Alt`+`R`
  and a digit take a full-screen shot straight into view 1–9 (switch it on in the "Screenshot to a
  view with a hotkey" fold in **Advanced**), and "Right after the shot" picks what follows: the area
  editor over the desktop (the default), the panel with that view open, or nothing. The top of the
  card holds the preview, **SIGNAL** and the pink **Run over the desktop**; the views, the practice
  and the rarer dials are in **Advanced**. You can also load a
  screenshot from a file, drop it or paste it with `Ctrl`+`V`, then mark the area with the mouse.
  The editor over the desktop has a "⚙ Settings" window with every setting and six ready-made
  sets, a "Triggers" tab, and "🎯 Signal": a trial in which the bar crosses the real screen and
  marks where it would click, without clicking. "■ End the trial" ends it.
- **Overlays.** Each capsule can have several named windows. The **Overlay** screen sets up one at
  a time: on top a preview that is the real overlay and the window's contents, in folds "Place and
  size" and "This window's look", and in **Advanced** the window tiles, templates (*controller
  only*, *selection wheel only*, *triggers only*, *orientation only*) and the name. The window takes
  its height from its contents, and window layouts are saved in the **Library**.
- **Capsule front.** The capsule is round, so you cannot see where its front is, and that decides
  which way tipping "forward" works. The *capsule front* overlay element shows it as a drop: hold
  the capsule upright like a steering wheel (button facing you) or lay it flat, and the drop ripples
  while the direction is wrong, then calms down, turns green and dims after a moment once the
  capsule points forward. The front can be the factory one or your own: **Tip forward** or
  **Steering wheel** in the window editor puts it where you want it (for example at the logo),
  separately for each capsule. The same drop sits in the right-hand column, in the **Capsule front**
  fold under the live preview: open, it has the same settings (front, sensitivity, threshold,
  degrees, wedge, dimming) and a **Show in the overlay** button. The settings belong to the capsule, so a change in the panel
  changes the overlay at once. **Light the LED when the capsule points forward** lights the
  capsule's own LED, so you can find the front without looking at the screen (it works with the
  panel closed, too).
- **Overlay look.** *Light*, *Dark* or *Content only* (the default). Clicks can pass through the
  overlay to the game, a pin keeps the window on top, and the window bar can be switched off, with
  X/Y position sliders instead. Overlays open in Edge, Chrome, Brave or Vivaldi. A game in
  exclusive fullscreen covers every overlay; switch it to "borderless window".
- **The Wii controller** needs no driver, but Windows does not see it, so neither does an ordinary
  game. Emulators pick it up: Dolphin, Cemu, Citra, yuzu, Ryujinx, PPSSPP (over the DSU protocol).
  It alone passes the capsule's real motion to the game. **DualShock 4** has a "gyroscope" box
  (read by Steam Input and Cemu), a `pad:touchpad` click, and tilting the capsule can drive a
  finger on the touchpad. Several capsules can make up one gamepad, and a capsule can act as a
  stick or a d-pad.
- **Motion and cursor tuning.** Smoothing, zero point, dead zone, range and curve for every motion
  axis, with live charts. For the cursor: curve, two-zone acceleration, stabilisation, automatic
  re-zeroing and calibration.
- **Cursor area and pointing.** The capsule drives the cursor across the whole screen, one chosen
  monitor, whichever monitor the pointer is on, or a rectangle of your own. In **Position** mode
  the tilt says where the cursor is, not how fast it moves.
- **Click without clicking.** **Dwell time** 0.15 to 5 s, **Calm radius** 2 to 60 px, **Click
  type** (left, right, middle, double). It clicks once and waits for movement. Starts off.
- **Pausing a capsule you put down** on the **Connection** screen, "Battery saving" fold: the "Hold
  the outputs when nothing moves" switch and an "After" slider from 5 s to 10 min. It stops what
  the capsule does, but the capsule keeps transmitting, so it saves no battery.
- **Setups loaded by game.** A "game.exe" field in the "Game and description" fold under the setup
  save bar; the pairs are listed in the "Auto sets by game" fold on the **Setups** screen. An
  automatic load never switches anything on.
- **MIDI.** A music program's sliders and knobs (CC messages, 14-bit too), notes in scales, pitch
  bend, aftertouch, program change, 18 curves and a "panic" button that silences every note.
  Nothing to install apart from loopMIDI.
- **OSC.** RibbitFlip sends numbers (float, int) and yes/no values (bool) to named devices, each
  with its own address. There are profiles for popular receivers, and at the threshold it can send
  an impulse, a gate or a latch.
- **Synth.** An XY pad in the browser: every capsule gets its own cursor and voice, 35 sounds,
  scenes, any number of pads, effect pads, gates, portamento, echo, vibrato from rotation,
  momentum. Programmed pads play a melody line or a drum beat drawn on a note grid by themselves,
  with a singing frog on every note, all at one shared tempo so they never drift apart. A pad layout saves as a scene, and you tune sounds in the
  **Sounds** tab. There an oscilloscope lamp shows the sound live, and under the knobs you draw
  your own wave, set an equaliser of up to four bands on the live spectrum and bend the envelope's
  segments; "Surprise me" rolls the whole sound, and the dice on a module card rolls only that
  module.
- **RibbitBeat.** The **RibbitBeat** button under Synth, in the **Try it out** group of the navigation, opens the game in a new tab: you sing the notes of a MIDI song with a capsule, a gamepad stick or the mouse. The game opens on a menu with the frog sticker and two buttons: **Play** and **Songs**. **Songs** holds the whole library (All, Built-in, Mine and Packs tabs, sorting A to Z, recently played, newest or favourites, a heart pins a favourite), a "How to add a song" note (from disk, by dragging, from an address, with Ctrl+V or from a pack) and "Credits and licences"; each song card has its scoreboard and licence badge. The scoreboard recognises a MIDI file by its content (SHA-256 fingerprint), so the same file under another name keeps the same results. **Play** goes in two steps: 1 Song (part preview, with a drop-down list of parts when a song has more than three, difficulty from 1 to 10, top three scores) and 2 Game setup: you pick the line-up by hand (mouse, W/S or arrow keys, a pad, a bot of four levels, a capsule), each player has a name, a colour and a place in the **Line-up** list (up to 8 players), and the whole line-up is remembered for next time; the settings are grouped and explained (Game level, Difficulty, Assists, Controls, Screen and lanes, Sound, Graphics) and are picture tiles. At the top sit ready-made sets, **Relaxed**, **Normal**, **Challenge** and **Master**, and any change of your own is kept as **Custom**. Tempo, time to move on wide leaps and every assist (pull to notes from “Gentle” to “From afar”, the frog singing on its own, jump to note on the keyboard, a quiet melody hint) show a points multiplier: an assist makes the game easier but lowers points by about as much as it adds, while the percentage and stars always count from singing alone. A capsule joins with its button on any screen and steers the menus by tilting and pressing (holding goes back); in step 2 it picks its own part and instrument. In the game each note fills with the colour of your accuracy, points fly up from the frog, combo and fire build up; the button between notes croaks at the pitch of your tilt, just for fun, with no points and no penalty. Pressing right at a note's start and releasing right at its end (within 100 ms) scores "Spot on": a big bonus that grows with a streak, a stamp and a HUD counter; the *Time to move* slider (0–150%) sets the slack on wide leaps and the score multiplier. Esc pauses the song: from the pause you resume (after a 3, 2, 1 countdown), restart it (R) or quit (Q). Vibrato on long notes works with every control: shake the mouse left and right, tap Q and E (or . and /) in turn, push the right pad stick or rock the capsule side to side. The **How to play** button in the menu (and the first Play) runs a guided demo in the real game, and each song ends with a jingle and confetti in the style of the chosen theme. The results break the score down into note grades, bonuses, in-rhythm hits and spot-on notes. Three packs of classical music from IMSLP (about 530 pieces under CC0, CC BY and CC BY-SA) download in one click straight from Hugging Face, with full author and licence details. Every player earns **Fame** (for songs, combos, new pieces, accuracy; the first song of the day counts double), and unlocks come in two layers: the **Board** (backdrop, crowd and keys as one of 30 themes, from felt through 8-bit, Halloween, comics, pirates, disco and a tiki island to a kitchen, chess, voodoo, a stock exchange, fly agarics, gold, Olympus, a crayon drawing, a real photographic pond and Einstein's lecture hall) and the **Effect** are unlocked by the whole crew together, that is everyone who plays on this computer; the board is one for the whole game, while each player picks their own effect from the unlocked ones: the singing frog's head redesigned in the theme's style (an astronaut in space, a mummy for Halloween, a pixel hero of old platform games for 8-bit, a captain straight out of an adventure movie for the pirates) plus a trail and sparks in the theme's colours. There are 40 instruments (from trumpet, choir and piano to saxophone, bagpipes, didgeridoo and opera voice), each with its own felt icon, and each holds the note as long as you sing. A new crew sings as Ribbit, and everything follows one shared **road**: every shared level is one spin of a horizontal reward wheel (category first, then an item, from common to legendary and secret; the last spin gives two things; everything after about 3–5 hours of play). With several players the shared pool gets the average fame times a bonus (×1.25 for two, ×1.4 for three, ×1.5 from four), and the wheel starts only when everyone holds their button. The results show one **Shared progress** bar with the next reward, and the effects window has a **Shared road** section where items not won yet stay hidden behind a padlock. Skins and scenes are unlocked separately and one at a time, only on the wheel (fame alone opens nothing): the skin and the scene of the same theme share a name with their kind, e.g. "Sushi · skin" and "Sushi · scene", and a scene you win uses up the draw like an instrument or a skin (only the secret card is free). The first draws come in the very first song; a crew of four has about 80% of the 95 items after about 35 songs and everything after about 65 (about 3 hours), a solo player about 80% after about 65 songs and everything after about 4–5 hours; the results show roughly how many songs are left to the next draw. 53 achievements give Fame and shortcuts: either to a skin or to a scene, never to both at once. The lobby has one **Board** bar above the cards with arrows, a crew fame meter and a window with a live preview, each player card has one **Effect** row with a window of effects and achievements, and the results show the player's and the board's Fame bars and level-ups. Achievements (with progress counters such as "47 / 100" and the date earned) also open without joining the line-up: with **Skin and achievements**, from the menu's "Playing as" badge or in the **Profiles** window next to any profile. **Profiles** marks the account you play as, and Export says plainly that the scoreboard, your own songs and favourites stay in the browser. Left and right on a gamepad change the song on the song carousel, just like the arrow keys. The background and light effects are drawn by the graphics card (WebGL2); without it the game keeps its classic look. The menu links to the Discord server, and the results offer “Show off on Discord” and “Copy result”.
- **RibbitBeat on its own.** The game also comes as a separate `RibbitBeat.exe`: start it and it opens full screen straight away, with nothing to install and no RibbitFlip needed. You play with a mouse, the keyboard or a gamepad, and capsules join in when RibbitFlip is running on the same computer. Song packs downloaded in the app show up in the game and the other way round. The game window opens in Edge or Chrome, or in your default browser if neither is there. Closing the window ends the game.
- **Services.** 15 ready templates and 61 actions, including Discord, Slack, ntfy, n8n, Make.com,
  IFTTT, Home Assistant, Spotify, Philips Hue, WLED, Telegram and Twitch (badged
  "unverified"). Filling values into the message (`{{var.x}}`), rate limits, a send log with
  passwords masked, and an encrypted vault for passwords. **OBS Studio** (8 actions: scene,
  recording, replay, microphone) connects in the "OBS Studio" fold of the applications card.
- **AI assistant (MCP).** MCP is a way for an AI assistant (such as a chat with a language model)
  to use programs on your computer. The [MCP server](../MCP.md) has thirteen tools and is off by
  default: switch it on on the **Settings** screen, under **Advanced**. The assistant can build a setup, fit a scheme
  to what your body can do, and set up the screen scanner and the selection wheel. Safe mode
  refuses macros, system key combinations and clicks at a screen point unless you agree, and the
  assistant never switches modules on by itself.
- **Report a problem** in the footer prepares a bundle of information about the problem (see
  [Community](../../README.en.md#community)). **Notifications** come from the tray icon, off and silent by default,
  at most once every 3 s.
- **The tray icon** has a menu: open the panel · overlays on top · run at Windows startup (off by
  default) · open the app folder · quit.
