#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""MCP (Model Context Protocol) server layer for RibbitFlip.

Lets an AI assistant (Claude Code, Claude Desktop, any MCP client) read and compose
RibbitFlip configurations: "here are the controls of game X, build me a Setup".

Design notes
------------
* Transport: MCP **Streamable HTTP**, JSON responses only (no SSE stream, no
  Mcp-Session-Id). The spec allows a server to answer a POST with a plain
  `application/json` body; RibbitFlip has no server->client requests to push, so a
  stateless server is the simplest correct implementation.
* Protocol: JSON-RPC 2.0, hand-rolled — the whole app is stdlib-only and this module
  keeps that promise (no `mcp` package, no pydantic).
* This module never imports `ribbitflip_monitor`: the monitor imports *us*, so an
  import back would be a cycle. Everything we need arrives in `ctx["fn"]`, injected
  by the monitor at startup.
* Transport security (Host/Origin checks, on/off switch) lives in the monitor's
  `_serve_mcp` gate — this module assumes the caller is already trusted-local.

Consent and limits (for reviewers and code scanners)
----------------------------------------------------
* OFF by default (Settings/ribbitflip_mcp.json, `load_mcp_config`); the user switches it on in
  Konfiguracja, and `--no-mcp` locks it off for the whole run. Reachable only from programs on
  this computer (127.0.0.1, no browser Origin).
* What a model can do here is configure the app - rules, setups, the scanner and wheel modules,
  output routing - through the same sanitizers as the dashboard. There is no tool that types
  text, presses a key, moves the mouse, takes a screenshot or reads the screen: input still
  happens only when the capsule moves.
* Consent is checked by the server, not left to the model: `set_output(master=true)`,
  `mode='advanced'` and switching the scanner or the wheel on are refused unless the person
  ticked "Assistant may arm" in Konfiguracja (`allowArm`, off by default, see
  `_require_consent`). Disarming, switching off and safe mode always pass. Every write is
  shown in the dashboard (`mcp_action` -> a toast naming the tool), the switches it flips are
  the ones the panel shows, and the emergency stop still wins.
"""

import json

# Protocol revisions we can speak. First entry = what we answer with when the client
# asks for something we do not know (spec: server replies with its own version and the
# client then decides whether to continue).
SUPPORTED_VERSIONS = ("2025-06-18", "2025-03-26")

SERVER_NAME = "ribbitflip"
SERVER_TITLE = "RibbitFlip"

# Sent once in `initialize` — the client keeps it in context, so it is the cheapest
# place to teach the model the workflow and the consent rules.
INSTRUCTIONS = (
    "RibbitFlip maps the motion of a BLE bottle cap (\"Triki\") onto keyboard keys, mouse "
    "actions, virtual game controllers (Xbox 360, DualShock 4 or an emulated Wii pad), MIDI "
    "and OSC. This server exposes the live app running on the user's machine: "
    "you can read its state and write its configuration.\n"
    "\n"
    "Workflow:\n"
    "1. get_overview - what devices exist, what is already configured, is output armed.\n"
    "2. get_mapping_reference - ALWAYS read this before composing rules or MIDI mappings. "
    "It carries the exact field names, enums, ranges and the macro grammar. Do not invent fields.\n"
    "3. analyze_setup - dry-run a config you composed; it reports which rules are classified risky.\n"
    "4. apply_setup / set_rules - write it. Default mode is 'safe'. Two modules are NOT part of a "
    "setup and have their own pair of tools (get_module_config / set_module_config): the screen "
    "scanner and the wheel.\n"
    "\n"
    "WHEN THE PERSON DESCRIBES THEIR BODY - \"I cannot press buttons\", \"my hands shake\", \"I "
    "can only move my head\", \"I get tired after a minute\", \"I cannot see the screen well\" - "
    "that is not small talk, it is the specification. Call get_accessibility_guide BEFORE "
    "composing anything, and check what you composed with check_accessibility. This app has "
    "mechanisms that need no button at all (screen scanning, the wheel's lean-only and click-only "
    "modes, dwell click, latch instead of hold), and the default lean-for-WASD-tap-for-space "
    "scheme is the wrong answer for most of them. Never ask somebody to demonstrate a movement "
    "they have just told you they cannot make.\n"
    "\n"
    "Safety rules you must follow:\n"
    "* mode='advanced' loads macros, the Windows key and system combinations (Alt+F4, Ctrl+W...). "
    "These are keystroke injection into the user's live desktop. Use it ONLY after the human has "
    "explicitly said yes to that specific setup.\n"
    "* set_output(master=true) ARMS the app: motion starts sending real input to the operating "
    "system. Only do this when the user explicitly asks to arm it.\n"
    "* The server enforces this too: arming, mode='advanced' and switching the scanner or the "
    "wheel on are refused unless the person ticked 'Assistant may arm' in the dashboard. When "
    "refused, tell them which click does it instead of retrying.\n"
    "* Rules describe motion thresholds in degrees; prefer conservative thresholds so a resting "
    "cap never fires.\n"
    "* Composing gameplay keys is normal, low-risk work. Composing shell commands, Run-dialog "
    "sequences or anything that types text into a system prompt is not - refuse and explain."
)


class ToolError(Exception):
    """Tool-level failure -> reported as isError:true content, NOT a JSON-RPC error.

    MCP draws that line deliberately: protocol errors are for malformed calls, while a tool
    that ran and failed should hand the model a readable explanation it can act on."""


# ============================================================================
#  MAPPING REFERENCE — the static guide handed to the model.
#  Every enum/range below is transcribed from the runtime sanitizers in
#  ribbitflip_monitor.py (sanitize_rules, _sanitize_source, MidiMapper._sanitize_map,
#  AirMouse.set_config, PuckSource.set_power). Keep them in sync when those change.
# ============================================================================

MAPPING_REFERENCE = {
    "readMeFirst": (
        "Field names are case-sensitive and unknown fields are dropped silently by the "
        "sanitizers. Every number below is clamped server-side to the range shown. A config "
        "object ('setup config') may contain any subset of the six groups listed in "
        "'setupGroups'; each group is applied independently."
    ),
    "setupGroups": {
        "rules": "list of trigger rules (motion/button -> key or macro)",
        "trigEnabled": "bool - master switch of the whole 'Mapping' (rules) group",
        "mouse": "motion control: cursor / analog stick / d-pad",
        "midi": "MIDI + OSC output (continuous mappings)",
        "pose": ("3D axis calibration + gain/responsiveness + per-axis direction (inv: pitch/roll) "
                 "+ the signal chain, in two families with the SAME fields "
                 "{on, smooth ema|adapt, smoothMs, zero, dead, inHi, outHi, expo}: "
                 "axes: {tilt|twist|pitch|roll} (degrees, twist in degrees/s; full 180/720/90/90) and "
                 "chans: {ch0..ch5} (raw accelerometer + gyroscope channels, LSB, full 32768). "
                 "Both are off by default and an exact identity when switched on. A tuned channel is "
                 "what every consumer of that channel reads (triggers, MIDI/OSC, stick/d-pad/mouse, "
                 "pad gates); the orientation filter itself keeps the untouched sample"),
        "power": "battery saving of the cap",
        "_notInASetup": (
            "The play pads (the 'Synth' tab) are NOT one of these groups. Their state IS on disk "
            "since 2026-08-28 (Settings/ribbitflip_synth.json, written by the browser through "
            "POST /synth), but it is an opaque blob the server never interprets and it is not a "
            "config group - so get_setup / apply_setup still neither read nor write it. An "
            "exported setup file carries a separate top-level 'pad' section, which the browser, "
            "not apply_setup, restores. See 'padsSynth' for what the pads do and which control to "
            "point the human at."
        ),
        "_envelopeNotConfig": (
            "'name', 'description', 'forApp', 'author', 'rev', 'basedOn', 'cassette' and 'exe' are "
            "fields of the ENVELOPE, not of the config - they describe the file, not the capsule, so "
            "they are not groups and apply_setup neither reads nor writes them. 'cassette' (1-8) is "
            "the felt cassette the Setups screen draws as the set's icon; a file without it shows "
            "cassette 1. 'exe' is the list of "
            "process names that make the app load this set by itself (see "
            "get_overview.gameSwitch); it is written when the set is SAVED, through the "
            "dashboard's save bar or POST /setup/save {exe:[...]}. Names are normalised "
            "server-side: lower case, no path, always ending in .exe, at most 5."
        ),
    },
    "deviceFlags": (
        "Three per-capsule flags that are NOT setup groups and that apply_setup neither reads "
        "nor writes. They belong to the DEVICE, they survive loading a setup, and you can only "
        "read them - in get_overview.devices[].muted, .paused and .autoPaused.\n"
        "'muted' is the application's own sound and nothing else: the Synth pads ignore that "
        "capsule. Its keys, mouse, pad buttons, MIDI and OSC all keep going, so a muted capsule "
        "is still a working one.\n"
        "'paused' is the opposite in scope: EVERY output of that capsule is cut - keys, mouse, "
        "pad, MIDI, OSC and the sound - while the BLE link stays up and the capsule keeps "
        "streaming motion. That last part is what makes it worth checking first: the app looks "
        "alive, the groups below still report enabled=true, and nothing whatsoever leaves the "
        "machine. If a human says a mapping stopped working, read .paused before you read "
        "anything else. (It is distinct from sleep, which drops the link to save battery and "
        "shows as conn='parked'.)\n"
        "'autoPaused' is that same cut made by the capsule itself, after lying still for "
        "power.autoPauseSec (switched on with power.autoPause). It is a THIRD flag on purpose: it "
        "lifts itself on the first movement, so a capsule reading autoPaused=true is not broken "
        "and needs no resuming - it is on the desk. Never clear it by writing 'paused'; if a human "
        "wants the feature gone, set power.autoPause=false.\n"
        "'armed' sitting next to them in get_overview is NOT a fourth switch and nothing writes it "
        "directly: it is DERIVED, and it is exactly (masterArmed AND NOT paused AND NOT "
        "autoPaused). So a capsule reads armed=false because the whole app is disarmed "
        "(set_output master), because that one capsule is paused, or because it has been lying "
        "still - check masterArmed, paused and autoPaused to tell the three apart.\n"
        "The human flips 'muted' and 'paused' in the dashboard, in the 'Moduły' section of the "
        "devices panel: a matrix of capsules by modules whose first column, 'Cały kapsel', is the "
        "manual pause flag. That column shows 'paused' ONLY - an idle hold never moves it, or the "
        "switch would report a choice the human never made. 'autoPaused' is configured instead on "
        "the Connection tab, under 'Wstrzymuj wyjscia przy bezczynnosci'.\n"
        "The module switches in that same matrix ARE ordinary setup keys, so those you can "
        "change: send apply_setup with just the one key you mean - {trigEnabled:true}, "
        "{mouse:{enabled:true}} or {midi:{enabled:true, oscEnabled:false}} - and everything else "
        "keeps its current value. Send BOTH midi flags whenever you touch either: a lone "
        "'enabled' is read as the old shared MIDI+OSC switch and will move OSC with it."
    ),
    # get_overview.devices[].conn, every value it can carry. A capsule that is not 'connected' or
    # 'sim' is not sending anything, whatever the rest of its configuration says.
    "connStates": {
        "connected": "a real capsule is paired and streaming over BLE",
        "sim": "a simulated slot - the MOTION is synthetic, the outputs are not (see safety.simulation)",
        "scanning": "paired, but its capsule is not in range yet; the app is looking for that one address",
        "pairing": "the slot is in pairing mode and will bind the strongest unpaired capsule it hears",
        "idle": "the slot exists but was never paired, and it deliberately does not steal anyone else's capsule",
        "parked": "asleep on purpose to save battery; the link is down and stays down until it is woken",
        "disconnected": "the link dropped and nothing is arriving",
        "init": "the slot's very first moments, before any status has been reported",
    },
    "ruleSchema": {
        "id": "string <=40, unique inside the list; auto-generated when missing",
        "label": "string <=60, shown in the UI",
        "enabled": "bool, default true",
        "source": "object - see 'sources'",
        "abs": "bool - compare |value| instead of value (default false)",
        "cmp": ["<", "<=", ">", ">=", "in", "out"],
        "threshold": "number - main threshold (units follow the source)",
        "thresholdHi": "number - upper bound, ONLY meaningful when cmp is 'in' or 'out' (else null)",
        "neg": "bool - negate the main condition (NOT)",
        "extraConditions": (
            "list of <=4 objects {source, abs, cmp, threshold, thresholdHi, op, neg}; "
            "'op' is 'and'|'or' and combines this condition with the result so far, "
            "evaluated left to right"
        ),
        "match": "'all'|'any' - legacy; per-condition 'op' is authoritative",
        "behavior": ["once", "continuous", "hold", "multi", "dwell", "latch"],
        "intervalMs": "int 10..5000 (default 100) - repeat period for 'continuous'",
        "dwellMs": "int 50..10000 (default 500) - how long the condition must hold for 'dwell'",
        "crossings": "int 2..8 (default 2) - number of crossings for 'multi'",
        "windowMs": "int 100..10000 (default 600) - time window for 'multi'",
        "layer": (
            "int 0..4 (default 0) - WHICH MAPPING LAYER this rule listens in. 0 = 'Zawsze': it "
            "works in every layer, and it is what every rule written before layers existed has, so "
            "leave it at 0 unless the user asked for layers. 1..4 = the rule only listens while "
            "that layer is the capsule's active one; in the others it behaves EXACTLY like a "
            "switched-off rule (held keys released, counters cleared), so switching layers can "
            "never strand a key down. The active layer is per capsule, is reported by "
            "get_overview.devices[].activeLayer, and is changed by a rule with a 'layer:' keySpec"
        ),
        "keySpec": "string <=40 - single key/combo/mouse action/controller button, see 'keySpec'",
        "sequence": "string <=500 - macro, see 'sequenceDsl'. ANY non-empty sequence = risky",
        "glow": "bool - highlight the rule in the UI when it fires (default true)",
        "led": "{on: bool, ms: int 0..10000} - flash the cap's LED on fire",
        "toast": (
            "{on: bool, mode: 'fire'|'active', silent: bool, text: string <=120} - Windows system "
            "notification for this rule (default off). 'fire' = one per trigger, 'active' = one "
            "when the rule becomes active and one when it stops. 'silent' (default true) drops the "
            "notification sound. 'text' is the user's own wording; empty = built from the rule. "
            "Rate-limited to one per rule per 3 s. Use sparingly: it is for the one or two rules a "
            "user wants to watch, not for a whole setup"
        ),
    },
    "sources": {
        "filter": {
            "shape": {"kind": "filter", "metric": "tilt|twist|pitch|roll|spin"},
            "units": "degrees, from the orientation filter (quaternion) - EXCEPT twist, which is "
                     "a speed in degrees per second, and spin, which is raw sensor units. Read "
                     "the ranges below before picking a threshold: a number that is a sane angle "
                     "is a nonsensical turn rate, and both are nonsense as motion energy.",
            "ranges": {
                "tilt": "0..180 deg - how far the cap has tipped away from lying flat, always "
                        "positive: 0 = flat on the table face up, 90 = standing on its edge, "
                        "180 = upside down. Use 'tilt < 20-25' to mean 'the cap is lying flat'.",
                "twist": "-720..720 DEGREES PER SECOND - not an angle: how fast the cap is being "
                         "rotated around the vertical (the gyroscope projected onto 'up'), so it "
                         "is 0 whenever the cap is held still, however it is turned. Positive = "
                         "counter-clockwise seen from above with the default calibration. A slow "
                         "deliberate turn reads about 60-150, a brisk one 250+. This is the "
                         "source for a 'volume knob' gesture: the cap flat on the desk, turned.",
                "pitch": "-90..90 deg - forward (-) / backward (+) lean; the sign can be flipped "
                         "per capsule in the 3D axis panel (pose.inv.pitch)",
                "roll": "-90..90 deg - left (-) / right (+) lean; flippable the same way (pose.inv.roll)",
                "spin": "0..~56000 RAW CALIBRATED LSB - not an angle and not degrees per second: "
                        "the MAGNITUDE of the whole gyro vector, i.e. how energetically the cap "
                        "is being moved, whatever the direction. 131 LSB = 1 deg/s, so 12000 is "
                        "about 92 deg/s. Always >= 0 (so 'abs' does nothing to it) and "
                        "deliberately NOT scaled by the per-axis gain the user may have dialled "
                        "in, which is what makes it stable across setups. Each axis saturates at "
                        "250 deg/s, so a threshold much above 30000 is a gesture no hand can "
                        "perform. This is THE source for a shake: {kind:'filter', metric:'spin'}, "
                        "cmp '>', threshold 12000, behavior 'once'.",
            },
            "typicalThresholds": {
                "gentle": "10-15 deg - easy to hit by accident, good for continuous control",
                "deliberate": "25-35 deg - a clear, intentional tilt; the safe default for keys",
                "extreme": "50+ deg - hard to reach without lifting the cap",
                "_appliesTo": "tilt/pitch/roll only. For twist (deg/s) use 55+ for a deliberate "
                              "turn; anything under ~30 is hand tremor. For spin (LSB) 12000 is a "
                              "deliberate shake, ~3000 is a nudge or a cap being put down, and "
                              "the app's own 'which cap is this?' shake uses exactly 12000.",
            },
            "note": "This is the source to use for gameplay. It is stable and human-readable.",
        },
        "axis": {
            "shape": {"kind": "axis", "channel": "int 0..5"},
            "units": "raw IMU LSB, roughly -16000..16000",
            "channels": "0-2 gyro, 3-5 accelerometer (default calibration; the user can remap)",
            "note": "Raw and calibration-dependent - prefer 'filter' unless you need raw speed.",
        },
        "button": {
            "shape": {"kind": "button", "any": "bool", "byte": "int 1..4", "bit": "int 0..7",
                      "holdMs": "float 20..5000 (default 250)"},
            "note": (
                "The cap's tap/touch sensor. any=true means 'any button activity' and is what you "
                "want unless the user has already learned a specific bit. holdMs = how long the "
                "condition stays true after a tap pulse. cmp/threshold are ignored for this source."
            ),
        },
        "trigger": {
            "shape": {"kind": "trigger", "ref": "<id of another rule>"},
            "note": "True while the referenced rule is currently active - lets you layer rules "
                    "(e.g. 'shoot only while walking'). Point it at a rule whose behavior is "
                    "'latch' and you get a MODE instead: the referenced rule stays active after "
                    "its gesture ends, so this one works only while that switch is on.",
        },
        "gesture": {
            "shape": {"kind": "gesture", "takes": "[packed recordings — made by the RECORDER in the "
                                                  "dashboard, never composed by hand]",
                      "accuracy": "int 0..100 (default 50)", "endHoldMs": "int 40..2000 (default 200)",
                      "channels": "gyro|both|accel|magnitude", "desc": "str, what the movement looks like"},
            "note": (
                "A movement the user RECORDED with the capsule (the editor's simple mode: record and "
                "repeat). The rule fires when a similar movement is made again; cmp/threshold are "
                "ignored. You cannot invent one: a source without `takes` never fires. When you meet "
                "one in a setup, keep it byte for byte (takes, accuracy, endHoldMs, channels, desc) and "
                "describe it to the user by its `desc`. Behaviours that make sense: once, multi, "
                "latch (a gesture is an event, not a level)."
            ),
        },
    },
    "behaviors": {
        "once": "fire once on the rising edge (condition false -> true). Default.",
        "continuous": "fire immediately, then every intervalMs while the condition holds",
        "hold": (
            "press on the rising edge and keep holding until the condition drops - THE choice for "
            "movement keys (WASD). Not available for macros (a sequence falls back to 'once') nor "
            "for non-holdable mouse actions (scroll/move/double -> behave like 'continuous')."
        ),
        "multi": "fire after 'crossings' crossings inside 'windowMs' (double/triple tap)",
        "dwell": "fire after the condition has held continuously for 'dwellMs'",
        "latch": (
            "like 'once', plus the rule REMEMBERS an on/off state that the gesture flips: meet "
            "the condition and it turns on, meet it again and it turns off, and it stays that way "
            "after the motion is over. This is the only state in the app. Read it from another "
            "rule with a {kind:'trigger', ref:'<this rule id>'} condition - that is how you build "
            "a mode: tap to switch the cap from volume to track skipping. keySpec is optional "
            "here (leave it empty for a pure state) and, when set, is tapped on EVERY flip. The "
            "state goes back to OFF by itself (no tap) when the capsule stops sending data "
            "(disconnected, asleep, out of range), so a rule gated on it never holds a key "
            "without a live capsule; after reconnecting it takes a new gesture to turn it on. Note "
            "you rarely need this for play/pause: media_play_pause is already a toggle handled by "
            "the player, and a state kept here would drift out of sync with it."
        ),
    },
    "keySpec": {
        "format": ("'<mod>+<mod>+<key>' or 'mouse:<action>' or 'mouse:<action>@<x>,<y>[:<ms>]' "
                   "or 'pad:<button>' or 'layer:<n>' / 'layer:next' / 'layer:hold:<n>'"),
        "safeModifiers": ["ctrl", "shift", "alt"],
        "safeNamedKeys": [
            "up", "down", "left", "right", "space", "enter", "esc", "tab", "backspace",
            "delete", "insert", "home", "end", "page_up", "page_down",
            "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10", "f11", "f12",
            "media_volume_up", "media_volume_down", "media_volume_mute",
            "media_play_pause", "media_next", "media_previous",
        ],
        "safeSingleChars": "any single letter a-z or digit 0-9 (punctuation works, best effort)",
        "mouseActions": [
            "left", "click", "leftclick", "right", "rightclick", "middle", "middleclick",
            "double", "doubleclick", "dbl", "scrollup", "scrolldown", "wheelup", "wheeldown",
            "scrollleft", "scrollright", "moveup", "movedown", "moveleft", "moveright",
        ],
        "mousePoint": (
            "Append '@<x>,<y>' to left/right/middle/double/move to do it at a FIXED POINT of the "
            "screen: 'mouse:left@960,540', 'mouse:right@50%,50%', 'mouse:move@0,0' (pointer only, "
            "no click). Add ':<ms>' to press and release after that long: 'mouse:left@960,540:800' "
            "(1..10000 ms). Coordinates are whole-desktop, so a monitor left of the primary one is "
            "negative; percentages are of the whole desktop and are what survives being shared with "
            "somebody whose screen is a different size. A point spec is ALWAYS classified risky "
            "(it clicks where the person is not looking), so safe mode drops such rules. With "
            "behavior 'hold' and no ':<ms>', the pointer moves there, the button goes down on the "
            "rising edge and is released when the condition drops (drag). An app that needs a "
            "moment to notice the hover wants the macro form: 'mouse:move@x,y; wait 60; mouse:left'."
        ),
        "padButtons": [
            "a", "b", "x", "y", "lb", "rb", "lt", "rt", "back", "start",
            "ls", "rs", "guide", "up", "down", "left", "right", "touchpad",
        ],
        "padOnly": {"touchpad": ["ds4", "wii"]},
        "padNote": (
            "'pad:<button>' presses a button on THIS capsule's virtual controller. lt/rt are the "
            "analog triggers (pressed = fully down). PlayStation names work as aliases "
            "(cross/circle/square/triangle, l1/r1/l2/r2, l3/r3, select/options), and the "
            "touchpad CLICK answers to tp/touch/touchpadclick/tpclick. Which controller 'this "
            "capsule's' means is mouse.padShare - a pad id from the registry; capsules on "
            "different pads are different players, and putting two capsules on the SAME pad is "
            "the only way to make their buttons and stick land on one controller (one player, "
            "both hands).\n"
            "There are THREE kinds of controller, picked when the human creates the pad in the "
            "dashboard's Kontroler tab, and the kind decides WHO CAN SEE IT. 'x360' is the Xbox "
            "pad every game on Windows understands - reach for it unless there is a reason not "
            "to. 'ds4' is a DualShock 4, also a real Windows device through ViGEmBus, and the "
            "only Windows one that carries a GYROSCOPE, which is what Steam Input and Cemu read "
            "motion from. 'wii' is an emulated Wii controller spoken over the DSU protocol and is "
            "NOT a Windows device at all: nothing outside an emulator (Dolphin, Cemu, Citra...) "
            "will ever see it, and in exchange it carries real motion. x360 and ds4 need the "
            "vgamepad module and the ViGEmBus driver; without them the mapping reports a failed "
            "send instead of falling back to anything.\n"
            "Buttons that only SOME kinds have are listed in 'padOnly'. The touchpad is the one "
            "that exists today: 'pad:touchpad' on an x360 pad reports sent:false rather than "
            "pretending to press something the device does not have - an Xbox pad has no "
            "touchpad and no amount of emulation gives it one, so the mapping can never fire and "
            "the person who wrote it has to be told which. get_overview.pads says what kind each "
            "pad is."
        ),
        "layerActions": ["layer:1", "layer:2", "layer:3", "layer:4", "layer:next",
                         "layer:hold:1", "layer:hold:2", "layer:hold:3", "layer:hold:4"],
        "layerNote": (
            "The one action that goes NOWHERE: it presses no key, no mouse button and no pad "
            "button. It changes which of THIS capsule's rules are listening (see rule.layer). "
            "'layer:<n>' switches and stays. 'layer:next' steps through the layers that actually "
            "contain a rule, layer 1 always among them, and does nothing at all when there is "
            "only one such layer - a button that moves somebody into an empty layer looks exactly "
            "like a broken button. 'layer:hold:<n>' is a SHIFT and is the only holdable form: use "
            "it with behavior 'hold', and the capsule goes to layer n while the condition holds "
            "and returns to wherever it came from when it drops (one level deep, no stack). A "
            "layer action is never gated on the master switch or the Mapping group, because a way "
            "out of a layer that dies with them would trap the user inside it. Give the rule that "
            "switches layers layer:0 ('Zawsze') unless you mean each layer to have its own way "
            "out - a rule that lives in the layer it switches AWAY from cannot switch back."
        ),
        "aliases": {
            "arrowleft/arrowright/arrowup/arrowdown": "left/right/up/down",
            "escape": "esc", "return": "enter", "del": "delete", "ins": "insert",
            "pgup/pageup": "page_up", "pgdn/pagedown": "page_down", "spacebar": "space",
            "control": "ctrl", "option": "alt",
            "win/super/meta/windows": "cmd (ALWAYS classified risky)",
            "volumeup/volumedown/mute": "media_volume_*",
            "playpause/play": "media_play_pause", "next/prev/previous": "media_next|media_previous",
        },
        "examples": ["a", "space", "ctrl+c", "ctrl+shift+left", "f5", "mouse:left",
                     "mouse:scrollup", "mouse:left@960,540", "mouse:right@50%,50%",
                     "mouse:left@960,540:800", "pad:a", "pad:rt", "pad:up"],
        "forbiddenInSafeMode": [
            "anything containing the Windows key (win/super/meta/cmd)",
            "alt+f4", "ctrl+w", "alt+tab", "ctrl+alt+delete", "ctrl+shift+esc", "ctrl+esc", "alt+space",
            "modifiers outside ctrl/shift/alt",
            "any mouse action with a screen point ('mouse:...@x,y') - see mousePoint",
            "unknown key names (typos land here - check spelling against safeNamedKeys)",
        ],
    },
    "sequenceDsl": {
        "separator": "';' or a newline",
        "steps": {
            "<keySpec>": "tap that key / mouse action / controller button",
            "wait <n> | czekaj <n> | delay <n> | <n>ms": "pause, 0..10000 ms",
            "down <key> | hold <key> | wcisnij <key>": "press and keep holding",
            "up <key> | release <key> | pusc <key>": "release a held key",
            "led on | led off": "cap LED",
            "layer:<n> | layer:next | layer:hold:<n>": (
                "switch this capsule's MAPPING LAYER mid-macro. Presses nothing and leaves the "
                "machine, so it also works with --no-keys and while the Mapping group is off. "
                "Legal inside a macro everywhere a macro is legal - including a wheel slice, "
                "where the same spec is refused as the slice's single action."),
        },
        "example": "down w; wait 500; up w; space",
        "limits": ("whole sequence <=500 chars, one step <=40 chars, a pause is clamped to "
                   "0..10000 ms. Keywords are case-insensitive; a key's own name keeps its case. "
                   "A bare `down` / `up` with no key after it is the ARROW KEY, not a hold."),
        "warning": "A non-empty sequence makes the rule RISKY by definition - safe mode drops it.",
    },
    "midi": {
        "configSchema": {
            "enabled": "bool - MIDI output group (default false, opt-in)",
            "oscEnabled": "bool - OSC output group, independent switch (default false)",
            "midiChannel": "int 0..15 (slot default: slot index)",
            "oscPrefix": "string <=60, leading '/' added automatically (default '/ribbitflip')",
            "scaleRoot": "int 0..11 (0=C .. 11=B)",
            "scale": "one of 'scales'",
            "mappings": "list of <=64 mapping objects",
        },
        "scales": [
            "chromatic", "major", "minor", "harmonic_minor", "pentatonic_major",
            "pentatonic_minor", "blues", "dorian", "phrygian", "lydian", "mixolydian", "whole_tone",
        ],
        # How OSC output works. An assistant setting one up needs the MODEL, not just the field
        # list: which knob answers which question, what the defaults reproduce, and which failure
        # mode each safeguard exists for.
        "oscGuide": {
            "wire": "OSC is plain UDP: a packet is address + type tag + argument. There are three "
                    "argument types here - int ('i'), float ('f') and boolean ('T'/'F', carried in "
                    "the tag with no body). The wire has NO notion of PWM, servos or DACs. What a "
                    "number means is decided by the receiver (TouchOSC, Resolume, an ESP32 sketch), "
                    "never by RibbitFlip. The full address is oscPrefix + the mapping's addr.",
            "twoAxes": "An OSC mapping answers two INDEPENDENT questions. (1) WHAT value goes out = "
                       "oscProfile, or oscType + outLoF/outHiF when the profile is 'free'. (2) WHEN "
                       "and FOR HOW LONG = mode, plus oscEdge when mode='threshold'. Do not conflate "
                       "them: 'pulse' on its own never says WHICH value is held, and on a servo "
                       "mapping that is the difference between 180 and a bare 1.",
            "profiles": {
                "unit": "float 0..1 - the AV convention (TouchOSC, Resolume, TouchDesigner, VRChat)",
                "digital": "bool - ON/OFF, sent as the OSC boolean tag",
                "pwm": "int 0..100 - duty cycle in percent",
                "servo": "int 0..180 - angle in degrees (the common hobby servo)",
                "servo270": "int 0..270 - angle in degrees",
                "servo360": "int 0..360 - a POSITIONAL 360° servo. NOT a continuous-rotation one: "
                            "there the number is speed and direction, not an angle, and the middle "
                            "value means stopped - use pwm or servoUs for those",
                "servoUs": "int 1000..2000 - pulse width in µs, the other common servo dialect "
                           "(1000 = one end, 1500 = middle, 2000 = the other)",
                "int10": "int 0..1023 - ten-bit scale",
                "dac8": "int 0..255 - e.g. the ESP32 DAC",
                "dac12": "int 0..4095 - e.g. Due / MCP4725 (split from dac8 because one preset "
                         "would have to lie to one of them)",
                "free": "derive nothing - oscType and outLoF/outHiF are whatever you send",
            },
            "profileIsAuthoritative": "While oscProfile != 'free' the server DERIVES oscType from it "
                                      "and ignores that field in your payload. The range follows the "
                                      "profile's full span unless oscRangeCustom says otherwise (see "
                                      "workingRange). To set a completely free type+range pair, send "
                                      "oscProfile='free'. The derivation happens in _sanitize_map, so "
                                      "an MCP client, the browser UI and an imported bundle agree.",
            "workingRange": "The two numbers in a profile are the DEVICE'S FULL SPAN, not the range "
                            "every mapping must use. Send oscRangeCustom=true together with "
                            "outLoF/outHiF to work inside a narrower window while KEEPING the "
                            "profile - a servo whose mechanism only leaves 10..25 free, a fan that "
                            "stalls below 30%, an LED that flickers at the lowest duty, a safe "
                            "voltage window on a converter, a fader that should not reach zero. Each "
                            "end is clamped into the span independently, so 250 on a 0..180 servo "
                            "becomes 180 and an INVERTED window (outLoF > outHiF) stays inverted and "
                            "reverses the direction of travel. oscRangeCustom is forced false for "
                            "'digital' (a boolean has no window) and for 'free' (there the range is "
                            "already yours). One subtlety: a narrowed 'unit' mapping is promoted from "
                            "oscType 'float' to 'floatrange', because plain 'float' is pinned to "
                            "0..1 in the engine and the window would otherwise be silently ignored. "
                            "Same type tag on the wire, so no receiver notices.",
            "edges": {
                "bang": "one message on the rising edge only",
                "gate": "HIGH while over the threshold, LOW once the signal drops below",
                "toggle": "every rising edge flips a latch between HIGH and LOW; falling edges send "
                          "nothing",
                "pulse": "HIGH on the rising edge, then LOW by itself after pulseMs - it does NOT "
                         "wait for the signal to drop below the threshold",
            },
            "highLow": "HIGH is the far end of the output range (what t=1 produces in continuous "
                       "mode), LOW is the near end; both are typed to match the mapping's argument "
                       "type. So servo+gate sends 180/0, pwm+toggle sends 100/0, digital+pulse sends "
                       "true/false.",
            "parking": "UDP has no acknowledgement and no close, so on disarm / OSC group off / puck "
                       "disconnect the receiver simply keeps the last value it got - a servo stays "
                       "turned out, a lamp stays lit. safeOnDisarm sends ONE message with a parking "
                       "value at that moment (null = do not park). toggle and pulse park themselves "
                       "at LOW unless safeOnDisarm says otherwise, and their state is reset with the "
                       "parking packet so the next rising edge starts from a known position.",
            "pace": "rateMs, maxRate and keepaliveMs are read in the CONTINUOUS branch only - in "
                    "threshold mode the packet goes out on the edge and none of them applies. "
                    "rateMs = upper bound on packet rate. maxRate = speed limit in OUTPUT units per "
                    "second (0 = off), so on a servo 0..180 a value of 90 means 'full travel no "
                    "faster than 2 s' and gives the mechanism a guaranteed travel time instead of a "
                    "step. keepaliveMs = lower bound, the stream's heartbeat: UDP acknowledges "
                    "nothing, so without it a motionless puck is total silence and a lost final "
                    "packet leaves the receiver wrong for good. It is clamped UP to rateMs (the "
                    "heartbeat can never outrun the declared ceiling) and anything in 1..99 is "
                    "treated as 0.",
            "backCompat": "Configs written before profiles existed keep behaving identically: they "
                          "normalise to oscProfile='free' and oscEdge='gate' for bool / 'bang' "
                          "otherwise, which is exactly what the engine did before the field existed. "
                          "'bang' on a 'free' mapping also still sends a bare int 1 rather than the "
                          "typed HIGH - promoting that silently would break receivers that never "
                          "asked for the change. Pick a profile to get the typed value.",
            "testing": "POST /test-midi (or the UI's test button) runs the SAME output stage as the "
                       "processing chain, so it sends the profile's type and value - not a stand-in "
                       "float. tools/osc_monitor.py listens on UDP :9000 and prints packets live.",
            "recipes": [
                "Servo follows tilt, safely: {dest:'osc', addr:'/servo', oscProfile:'servo', "
                "mode:'continuous', srcKind:'filter', metric:'tilt', inLo:0, inHi:90, "
                "maxRate:90, keepaliveMs:500, safeOnDisarm:0} - maxRate 90 caps full travel at 2 s, "
                "the heartbeat repairs a dropped final packet, and safeOnDisarm=0 is the 'detach' "
                "sentinel in a typical sketch.",
                "Lamp on/off by shaking: {dest:'osc', addr:'/lamp', oscProfile:'digital', "
                "mode:'threshold', oscEdge:'toggle', metric:'spin', threshold:4000}.",
                "Door buzzer for 300 ms: {dest:'osc', addr:'/buzzer', oscProfile:'pwm', "
                "mode:'threshold', oscEdge:'pulse', pulseMs:300, metric:'tilt', threshold:45}.",
                "A TouchOSC fader: {dest:'osc', addr:'/fader1', oscProfile:'unit', "
                "mode:'continuous', metric:'roll', inLo:-45, inHi:45}.",
                "A servo boxed in by its mechanism: {dest:'osc', addr:'/arm', oscProfile:'servo', "
                "oscRangeCustom:true, outLoF:10, outHiF:25, mode:'continuous', metric:'tilt', "
                "inLo:0, inHi:90} - full tilt reaches 25°, not 180°, and 250 would be clamped to "
                "the profile's 180.",
                "A fan that stalls when idling: {dest:'osc', addr:'/fan', oscProfile:'pwm', "
                "oscRangeCustom:true, outLoF:30, outHiF:80, mode:'continuous', metric:'spin', "
                "inLo:0, inHi:12000} - at rest it sends 30, not 0.",
            ],
        },
        "mappingSchema": {
            "id": "string <=40 (auto when missing)",
            "name": "string <=40",
            "enabled": "bool (default true)",
            "srcKind": "'filter' | 'axis'",
            "metric": "filter source: tilt|twist|pitch|roll|spin (spin = |gyro| motion energy)",
            "ch": "axis source: int 0..5",
            "dest": ["cc", "cc14", "pitchbend", "aftertouch", "program", "note", "osc"],
            "mode": "'continuous' (stream the value) | 'threshold' (fire on crossing)",
            "inLo/inHi": (
                "input range; defaults follow the source: filter+tilt 0..90, filter+spin 0..12000, "
                "other filters -90..90, axis -16000..16000"
            ),
            "cc": "int 0..127 (dest 'cc14': 0..95, because it also uses cc+32)",
            "outLo/outHi": "int 0..127 - output range for cc/aftertouch",
            "outLo14/outHi14": "int 0..16383 - output range for cc14/pitchbend",
            "prog": "int 0..127 - dest 'program'",
            "loNote/hiNote": "int 0..127 (default 48/72) - note range for continuous dest 'note'",
            "note": "int 0..127 (default 60) - single note for threshold mode",
            "velocity": "int 1..127 (default 100)",
            "velSource": "'fixed' | 'motion' (derive velocity from gesture energy)",
            "noteLatch": "bool - keep the note on until the condition drops",
            "cmp": "'>' | '<' - threshold mode only",
            "threshold": "number - threshold mode only (defaults to the middle of inLo..inHi)",
            "absVal": "bool - compare |value|",
            "curve": "response curve, see 'curves'",
            "curveFlip": "bool - mirror the curve",
            "curveN": "int 2..32 - steps for 'step' curve",
            "curveBez": "[x1,y1,x2,y2] each 0..1 - control points for 'bez' curve",
            "invert": "bool - invert the output",
            "centered": "bool - bipolar mode around the middle",
            "deadzone": "int 0..30 (% around the middle)",
            "rateMs": "int 5..1000 (default 15) - minimum time between messages",
            "midiCh": "int 0..16 - per-mapping channel override (0 = use the slot channel)",
            "slewMs": "int 0..2000 - smoothing time constant",
            "smoothMode": "'off' | 'ema' | 'oneeuro' | 'damp'",
            "medN": "0 | 3 | 5 - median filter window",
            "oeMinCutoff": "float 0.05..8.0, oeBeta: float 0.0..0.5 (One-Euro filter)",
            "dzMode": "'off' | 'srodek' (centre) | 'dol' (bottom), dzRef / dzWidth: numbers",
            "hystIn": "number - input hysteresis",
            "outOfRange": "'clamp' | 'wrap' | 'pass'",
            "antiDz": "float 0..0.6 - anti-deadzone on the output",
            "hardLo/hardHi": "number or null - hard output limits",
            "quantStep / quantHyst": "float - output quantisation (quantHyst 0..0.5)",
            "maxRate": "float - max output units per second (0 = off)",
            "sendDelta": "float - minimum change worth sending",
            "addr": "string <=80 - OSC address (default '/cc<n>' or '/note')",
            "oscTarget": "'' | 't1'..'t99' - WHICH named OSC device this mapping talks to; '' (the "
                         "default) is the default target, i.e. the oscHost/oscPort settings. Named "
                         "devices are made by the user in the panel (OSC tab -> 'Urzadzenia OSC'), "
                         "and an id is LOCAL to one machine: a mapping quoting a device this machine "
                         "does not have falls back to the default target rather than going silent.",
            "oscProfile": "'free' | 'unit' | 'digital' | 'pwm' | 'servo' | 'int10' | 'dac8' | 'dac12' "
                          "- receiver profile: a NAME for the pair (oscType, range) a receiver expects. "
                          "Anything but 'free' DERIVES oscType/outLoF/outHiF server-side and overrides "
                          "whatever you send in those fields. OSC carries no notion of PWM or servos - "
                          "the sketch on the other side still decides what the number means.",
            "oscRangeCustom": "bool - work inside a NARROWER window than the profile's full span "
                              "(outLoF/outHiF are then used and clamped into that span). Forced "
                              "false for oscProfile 'digital' and 'free'. See oscGuide.workingRange.",
            "oscType": "'float' | 'floatrange' | 'int' | 'bool' (derived when oscProfile != 'free')",
            "outLoF/outHiF": "float - OSC output range (default 0.0..1.0). With a profile these are "
                             "the profile's span, unless oscRangeCustom=true makes them your window",
            "oscEdge": "'bang' | 'gate' | 'toggle' | 'pulse' - OSC + mode='threshold' only: WHEN and for "
                       "HOW LONG, as opposed to oscProfile's WHAT. bang = one shot on the rising edge, "
                       "gate = held while over, toggle = flips on every rising edge, pulse = HIGH for "
                       "pulseMs then back on its own. Default reproduces the pre-profile behaviour "
                       "('gate' for bool, 'bang' otherwise). toggle/pulse park themselves at the rest "
                       "value on disarm unless safeOnDisarm says otherwise.",
            "pulseMs": "int 20..10000 - HIGH stretch of oscEdge='pulse' (default 200; the floor is the "
                       "~50 Hz sample period that carries the falling edge)",
            "keepaliveMs": "int 0 or 100..10000 - OSC only, resend period",
            "safeOnDisarm": "number or null - OSC only, value sent when the group is disarmed",
            "oscGroup / oscGroupIdx": "string <=16 / int 0..7 - STORED BUT NOT IMPLEMENTED: the fields "
                                      "round-trip, nothing reads them, so setting them changes nothing "
                                      "on the wire",
        },
        "curves": [
            "lin", "exp", "exp2", "exp3", "exp4", "log", "log2", "log3", "smooth", "smoother",
            "sine_in", "sine_out", "sine_io", "circ_in", "circ_out", "circ_io",
            "expo_in", "expo_out", "step", "bez",
        ],
    },
    "mouse": {
        "note": "Motion control group. Only send the keys you actually want to change - the rest "
                "keeps its current value. enabled=false by default (opt-in). "
                "IMPORTANT: the 'common' / 'mouseMode' / 'stickMode' / 'dpadMode' / 'autoSwitch' "
                "headings below are how this DOCUMENT is organised and nothing else - they are "
                "not objects and must not appear in what you send. Every key listed under any of "
                "them lives FLAT under 'mouse', so it is "
                "{mouse:{enabled:true, mode:'stick', stickBackend:'touchpad'}}, never "
                "{mouse:{stickMode:{stickBackend:'touchpad'}}} - a nested version is dropped "
                "silently by the sanitizer and the setting simply never arrives.",
        "common": {
            "enabled": "bool", "mode": "'mouse' | 'stick' | 'dpad'",
            "padShare": (
                "WHICH virtual Xbox controller this capsule plays on - a pad id from the "
                "registry ('p1', 'p2'...; GET /pads lists them, and the dashboard's Kontroler tab "
                "creates, names and removes them). Capsules on DIFFERENT pads are different "
                "players, which is what a two-player game wants. ONE player using two capsules "
                "needs the opposite, and this is the only way to get it: put both capsules on the "
                "SAME pad id, and both their stick/d-pad and their `pad:` mappings land on one "
                "controller - left hand rolls the stick, right hand presses the trigger, and the "
                "game sees a single player. Otherwise the game reads the stick from pad 1 and "
                "never sees the button pressed on pad 2. "
                "'off' is the third value and it is a VALUE, not an absence: the capsule is "
                "plugged into no controller at all, on purpose. Its keyboard, mouse, macro and "
                "MIDI outputs keep working exactly as before and only its `pad:` mappings have "
                "nowhere to go, which they report as sent:false. An EMPTY padShare means "
                "something else entirely - 'nobody has said yet' - and the app answers it by "
                "finding the capsule a pad, so do not send '' when you mean 'off'. "
                "get_overview.pads.free lists the capsules currently on no pad. "
                "The two pre-registry values are still fully accepted, on WRITE as well as on "
                "load: 'own' means a controller of this capsule's own and a slot id ('d0'..'d9') "
                "means 'play where that capsule plays', and rewire_pads() turns either into a "
                "real pad id the first time it sees it. Anything the sanitizer does not "
                "recognise as a pad id, 'own', 'off' or a slot id is treated as a typo and "
                "becomes 'own' - so a mistyped pad id does not silently send a whole capsule's "
                "buttons nowhere, but it does not land where you meant either. Prefer a pad id "
                "read from get_overview.pads."
            ),
        },
        "mouseMode": {
            "mouseSource": "'axis' (gyro velocity) | 'filter' (tilt angle -> cursor velocity)",
            "mouseMetricX/mouseMetricY": "filter source: tilt|twist|pitch|roll (default roll/pitch)",
            "mouseAxisX/mouseAxisY": "int 0..5 (axis source; default 5/4)",
            "mouseInvertX/mouseInvertY": "bool",
            "mouseDeadzone": "float 0..20000 (LSB, default 35)",
            "mouseFilterScale": "float 2..180 - degrees that mean full speed (default 30); with "
                                "mouseAbsolute they are the degrees that reach the EDGE of the area",
            "mouseFilterDead": "float 0..30 - angular dead zone (deg)",
            "mouseEdgeFollow": "bool - keep moving after reaching full deflection (default true)",
            "mouseAbsolute": (
                "bool (default false) - POINTING instead of pushing: the tilt IS the place in the "
                "area, like a presentation pointer, and the cursor is only re-placed when the "
                "aimed-at point moves (a still capsule leaves the real mouse alone). Needs an "
                "angle, so it applies to mouseSource='filter' only - with 'axis' it is ignored "
                "and the cursor is moved as usual. sensX/sensY, acceleration and maxStep say "
                "'how fast' and have no meaning here; mouseFilterScale is the range."
            ),
            "mouseArea": (
                "'desktop' (default, every monitor together - what the mouse always did) | "
                "'monitor' (the one in mouseMonitor) | 'cursor' (whichever monitor the pointer is "
                "on right now, re-read as it moves) | 'custom' (the mouseRect* rectangle). This is "
                "the FENCE: only the capsule's own movement is clamped, a hand on the real mouse "
                "still goes anywhere - and the next capsule movement brings the pointer back in."
            ),
            "mouseMonitor": "Windows device name ('\\\\\\\\.\\\\DISPLAY1') for mouseArea='monitor'; "
                            "'' = the primary one. GET /screens lists them. An unplugged monitor "
                            "falls back to the primary and the panel says so",
            "mouseAreaWork": "bool - use the WORK area (no taskbar) instead of the whole screen",
            "mouseAreaPad": "float 0..500 - inset in px on every side (keeps the pointer off the edge)",
            "mouseRectX/mouseRectY/mouseRectW/mouseRectH": "float - the rectangle for "
                "mouseArea='custom', in desktop pixels (a monitor left of the primary has a "
                "negative x). W/H of 0 means 'never picked one' and behaves as the whole desktop",
            "sensX/sensY": "float 0..2 (default 0.035)",
            "mouseExpo": "float 0.5..3 (1 = linear)",
            "tighten": "float 0..30 - stabilisation near zero",
            "accelOn": "bool, sensFast: float 0..2, accelThrLo/accelThrHi: float 0..20000",
            "smoothMode": "'classic' (EMA) | 'oneeuro'; smooth: float 0..0.98",
            "oeMinCutoff": "float 0.05..8, oeBeta: float 0..0.1",
            "maxStep": "int 1..200 - px per sample safety limit",
            "dwellOn": (
                "bool (default false) - KLIK BEZ KLIKANIA (dwell click): a cursor steered by the "
                "capsule that STOPS MOVING is the click. Written first as an accessibility aid - "
                "steering a pointer and pressing a button are two different abilities - and handy "
                "with both hands busy. Works in BOTH mouse halves (velocity and mouseAbsolute "
                "pointing). ONE click per stop: after firing it will not arm again until the "
                "cursor has travelled further than dwellRadius. The click leaves through the "
                "ordinary emitter behind the same armed/enabled gate as every other output, so a "
                "paused capsule clicks nothing."
            ),
            "dwellMs": "float 150..5000 - how long the cursor must stand still (default 900)",
            "dwellRadius": "float 2..200 - px of DISPLACEMENT from the anchor that still counts "
                           "as standing still (default 12). Summed as a vector, so a hand tremor "
                           "cancels itself out and only a real drift re-anchors the countdown",
            "dwellClick": "'left' | 'right' | 'middle' | 'double' - which click is sent, as "
                          "`mouse:<this>` (default 'left'); anything else falls back to 'left'",
            "scroll": "bool, scrollAxis: int 0..5, scrollSens: float 0..5, scrollThreshold: float 0..32000",
            "autoTare": "bool - auto de-drift the gyro while the cap rests",
        },
        "stickMode": {
            "stickBackend": "'gamepad' (virtual analog stick) | 'wsad' (keyboard) | 'touchpad'",
            "stickBackendNote": (
                "'touchpad' is not a third way of moving a stick, it is a different device: the "
                "deflection is read as a PLACE on the pad's glass instead of as a push, so the "
                "centre of the surface is where a resting capsule points and full tilt reaches "
                "the edge. Inside the dead zone the finger LIFTS rather than parking in the "
                "middle - a stick springs back, a finger does not, and a thumb resting on the "
                "glass forever is not what a still capsule means. It needs a pad that HAS glass, "
                "so it works on the 'ds4' and 'wii' kinds only; on an 'x360' pad there is "
                "nothing to put a finger on. The touchpad CLICK is a separate thing and stays an "
                "ordinary mapping ('pad:touchpad') - sliding across the surface and clicking it "
                "are two different controls on the pad in your hands, so they are two here too."
            ),
            "stickSource": "'filter' (default) | 'axis'",
            "stickMetricX/stickMetricY": "tilt|twist|pitch|roll (default roll/pitch)",
            "stickFilterScale": "float 2..720 - degrees = full deflection (default 45)",
            "stickWhich": "'left' | 'right'", "stickAccel": "float 0..1",
            "stickRange": "float 200..32000 (axis source)",
            "stickInner": "float 0..0.9 (inner dead zone), stickOuter: float 0..0.6 (anti-deadzone)",
            "stickExpo": "float 0.3..5", "stickWsadThr": "float 0.1..0.95",
            "stickSensX/stickSensY": (
                "float 0..3 (default 1 = unchanged) - sensitivity PER AXIS, a multiplier on the "
                "deflection applied before the dead zone and the curve. 0.5 means half the tilt "
                "counts: you tilt twice as far for the same push and that axis tops out at half a "
                "stick, and 0 takes the axis off the stick entirely (the other one keeps its full "
                "travel). This is the aiming setting - a camera that swings left/right fast and "
                "creeps up/down is stickSensX high, stickSensY low. Read by the 'gamepad' backend "
                "only: the touchpad reads the pair as a PLACE on the glass and wsad reads it "
                "against stickWsadThr, so neither is scaled."
            ),
            "stickUp/stickDown/stickLeft/stickRight": "keySpec strings (wsad backend; default w/s/a/d)",
            "stickAxisX/stickAxisY/stickInvertX/stickInvertY/stickDeadzone": "axis-source settings",
        },
        "dpadMode": {
            "_howItDecides": (
                "SECTORS, like a real d-pad: the RADIUS decides whether a key fires at all and the "
                "ANGLE decides which one. It is tuned like the analog stick - a full deflection and "
                "a DEAD ZONE measured against it; leave the zone and the direction fires. A pressed "
                "direction holds until the lean falls back to 60% of that radius (anti-flicker, a "
                "constant - the old 'dpadHyst' slider is gone), and a direction only changes once "
                "the sector border has been cleared by ~7 degrees. It is no longer 'each axis "
                "compared to its own threshold', so a corner means 'pointing north-east' rather "
                "than 'both axes happen to be past their line'."
            ),
            "dpadBackend": "'keyboard' | 'gamepad'",
            "dpadSource": "'axis' | 'filter'",
            "dpadMetricX/dpadMetricY": "tilt|twist|pitch|roll (default roll/pitch)",
            "dpadFilterScale": "float 2..720 (default 45) - degrees = full deflection (filter source); "
                               "dpadFilterDead: float 0..0.9*dpadFilterScale (default 22.5) = the dead "
                               "zone in degrees, i.e. the lean at which a direction fires",
            "dpadDiagonal": (
                "bool - false (DEFAULT) = four 90-degree wedges, so exactly ONE direction key can be "
                "held; true = eight 45-degree wedges, and a diagonal means TWO keys held at once, "
                "which some games mis-handle. An existing config keeps whatever it saved."
            ),
            "dpadRange": "float 200..32000 (default 10000) - full deflection in LSB (axis source), "
                         "mirrors stickRange",
            "dpadInner": "float 0.02..0.9 (default 0.30) - dead zone as a fraction of dpadRange; the "
                         "firing radius IS its edge (mirrors stickInner). Legacy files carrying "
                         "dpadThreshold/dpadHyst are converted on load, keeping the radius they fired at",
            "dpadUp/dpadDown/dpadLeft/dpadRight": "keySpec strings (default up/down/left/right)",
            "dpadAxisX/dpadAxisY/dpadInvertX/dpadInvertY/dpadDeadzone": "axis-source settings",
            "_inTheUI": (
                "The preview draws all of it: the rim is the full deflection, the dashed circle is "
                "the dead zone, plus the wedge borders and a dot for the live position - and the "
                "dead zone can be dragged straight on that preview instead of typed. With "
                "dpadDiagonal=false the diagonal arrows are not drawn at all, because nothing can "
                "ever light them."
            ),
        },
        "autoSwitch": {
            "autoSwitch": "bool - pick the mode from a live condition",
            "switchKind": "'filter' | 'axis'", "switchMetric": "tilt|twist|pitch|roll",
            "switchChannel": "int 0..5", "switchCmp": "'>' | '<' | '>=' | '<='",
            "switchThreshold": "float", "switchAbs": "bool", "switchHyst": "float 0..10000",
            "modeTrue/modeFalse": "'mouse' | 'stick' | 'dpad'",
        },
    },
    # ------------------------------------------------------------------------------------
    #  KOŁO WYBORU (the radial menu). Read/write through its own endpoint, NOT through
    #  apply_setup - it is deliberately not one of the setup groups yet, so a model must not
    #  offer to carry it inside a setup file.
    # ------------------------------------------------------------------------------------
    "wheel": {
        "whatItIs": (
            "A 'weapon wheel' for the capsule's single button. Something opens a wheel of 2..16 "
            "slices on the cheat sheet and wherever `showWhere` says; the lean picks one (roll = "
            "left/right, pitch = forward/back, 30 degrees reaches the rim) and something else "
            "commits it - WHICH events play those two parts is the `confirm` mode below. Landing "
            "near the centre (inside `deadzone` of the rim) picks nothing, which is the deliberate "
            "escape hatch. It is a group of its own, independent of rules, motion control and "
            "MIDI/OSC."
        ),
        "whereItLives": (
            "NOT a setup group: get_setup / apply_setup neither read nor write it, and a saved "
            "Setup does not carry it. Its config is one file per capsule, "
            "Settings/[<dev>/]ribbitflip_wheel.json, reachable over HTTP as GET/POST "
            "/wheel?dev=<id> and from here with get_module_config / set_module_config "
            "{module:'wheel'}. get_overview reports wheelEnabled, wheelSlices and wheelConfirm."
        ),
        "config": {
            "enabled": ("bool, default false. Stored as FALSE whenever there are fewer than 2 "
                        "slices - the save is not refused, the switch simply cannot go on."),
            "holdMs": ("number 150..5000, default 300. In 'release' it is how long the button is "
                       "held before the wheel opens. In every other mode it is the line between a "
                       "CLICK (shorter) and a LONG PRESS (longer or equal)."),
            "confirm": ("one of 'release' | 'tilt-hold' | 'tilt-click' | 'click' | 'cycle', "
                        "default 'release'. Anything else falls back to 'release'. See "
                        "'confirmModes'."),
            "confirmMs": ("number 200..3000, default 600 - the wait that commits a choice in "
                          "'tilt-hold' (on one slice) and 'cycle' (since the last click). "
                          "Ignored by the other three."),
            "deadzone": ("number 0.10..0.70, default 0.34 - the fraction of the rim inside which "
                         "NOTHING is picked. Widen it for an unsteady hand, narrow it so a small "
                         "lean already decides."),
            "showWhere": ("one of 'overlay' | 'cursor' | 'both', default 'overlay'. Anything else "
                          "falls back to 'overlay'. WHERE the wheel is drawn, as ONE choice - see "
                          "'showWhere' below for what each does and what the server does about "
                          "it. A config saved before this key existed is migrated on read: it "
                          "becomes 'both' when that capsule's window at the pointer "
                          "('<dev>~kolo') was left OPEN, and 'overlay' otherwise, so nothing "
                          "changes behaviour behind anybody's back."),
            "slices": ("list, at most 16, each {label: string <=24 chars, spec: string <=40 "
                       "chars, sequence: string <=500 chars, and optionally icon: one emoji "
                       "<=4 chars, color: '#rrggbb', children: a list of the same shape}. Extra "
                       "slices past the 16th are dropped, at every level. Beyond about 8 slices "
                       "aiming gets fiddly - 4..8 is the sane range, and MORE CHOICES GO IN A "
                       "SUBMENU rather than in thinner slices.\n"
                       "A SLICE WITH CHILDREN IS A DOOR, NOT AN ACTION: its `spec` and `sequence` "
                       "are never run. Three levels deep at most (root + submenu + sub-submenu); "
                       "anything deeper is dropped in silence rather than refused. A config "
                       "written before submenus existed comes back out of the sanitizer byte for "
                       "byte - icon/color/children are only ever written when they are there."),
            "submenuMode": ("one of 'replace' | 'arc' | 'ring', default 'replace'. HOW children "
                            "are shown: 'replace' puts them on the parent's own ring (never grows, "
                            "always fits), 'arc' opens a short arc on a second ring centred on the "
                            "parent, 'ring' gives them a whole second ring (big targets). In 'arc' "
                            "and 'ring' the LENGTH of the lean picks the ring: middle - main ring "
                            "- children - grandchildren, three rings on screen at most. 'cycle' "
                            "always draws like 'replace', whatever this says."),
            "subOpenMs": ("number 150..800, default 300. How long a parent must be pointed at "
                          "before its children open by themselves. It is what the button-held "
                          "mode uses - there is no spare finger to click with there."),
            "iconChips": ("bool, default false. Draws a disc in the slice's colour under its icon. "
                          "Off by default: on a wheel with no colours it is sixteen identical grey "
                          "coins, which is noise rather than information."),
        },
        "confirmModes": {
            "release": ("the original. Hold the button past holdMs to open, lean, LET GO to send. "
                        "Letting go in the middle cancels."),
            "tilt-hold": ("NO BUTTON AT ALL. A lean past the opening bar, held for 150 ms, opens "
                          "the wheel; keeping the SAME slice for confirmMs sends it; coming back "
                          "inside the dead zone closes it with nothing sent. Works on capsules "
                          "that cannot report a button level."),
            "tilt-click": ("opens by lean the same way, and a CLICK of the button sends whatever "
                           "is pointed at. Coming back to the middle closes it, so a click can "
                           "never land on 'nothing'."),
            "click": ("a click opens the wheel (a long press does NOT), the lean points, a second "
                      "click sends it - or cancels if the lean is in the middle."),
            "cycle": ("for hands that cannot aim by leaning. A lean DOWNWARDS past the opening bar "
                      "opens it; after that the lean is ignored entirely and each CLICK steps to "
                      "the next slice, wrapping round. The choice is sent by waiting confirmMs "
                      "since the last click, or immediately by one long press. Zero clicks plus "
                      "the wait closes it with nothing sent."),
        },
        "openBar": (
            "The three lean-opened modes (tilt-hold, tilt-click, cycle) need a lean of 0.8 of the "
            "rim, NOT the dead zone - deliberately far above anything ordinary steering does, and "
            "deliberately not a slider. If `deadzone` is widened until it approaches that bar, the "
            "bar is raised to deadzone + 0.15 (capped at 0.95) so there is always room between "
            "'nothing chosen' and 'open the wheel'. WARN THE HUMAN: on a capsule that also drives "
            "the mouse or the stick, these modes fight the steering - they belong on a capsule "
            "that does not."
        ),
        "timeout": (
            "Every mode that stays open without anything held (all four besides 'release') gives "
            "up after 8 seconds with nothing sent. Not configurable: it is the promise that a "
            "wheel opened by accident goes away instead of eating the next click."
        ),
        "spec": (
            "The SAME language as a rule's keySpec (see 'keySpec'): a key, a combination, "
            "'mouse:...', 'pad:...'. One difference: 'layer:...' is REFUSED as a slice's single "
            "action - it is emptied on save, because a wheel that reshuffles which rules listen "
            "underneath itself is a puzzle rather than a feature. An empty spec is legal - that "
            "slice highlights and sends nothing."
        ),
        "sequence": (
            "A slice may run a MACRO instead of a single action, in the same language and with "
            "the same 500-character ceiling as a rule's `sequence` (see 'sequenceDsl'). A "
            "non-empty sequence WINS over `spec`, which is then not sent at all. It is executed "
            "by the rules' own machinery (TriggerEngine._launch_sequence), so it gets the "
            "background thread, the no-overlap guard, the progress the dashboard draws and the "
            "release of anything left held. Unlike `spec`, a 'layer:' STEP inside it is allowed."
        ),
        "gates": (
            "Opening the wheel is only a drawing and happens whatever the arming state, so a "
            "paused capsule still SHOWS what it would have chosen. Sending - a tap or a macro - "
            "goes through the same gate as every other output: trig.armed, i.e. (masterArmed AND "
            "NOT paused AND NOT autoPaused). The button is read as a LEVEL from byte 1 of the IMU "
            "frame; capsules that report their button only as a rare 0x21 pulse cannot say how "
            "long it has been held, so on those every mode but 'tilt-hold' is unusable - and "
            "'tilt-hold' is exactly the mode to suggest there."
        ),
        "collision": (
            "The wheel does NOT swallow the button. A rule bound to the capsule's button still "
            "fires while the wheel is being opened. That is on purpose, and it is the first thing "
            "to check when a human says 'opening the wheel also does something else'."
        ),
        "liveStream": (
            "While open, the wheel publishes `t:\"wheel\"` on /stream with open, idx, n, mag, ang, "
            "labels, plus confirm (the mode), cd (0..1 progress of the confirmMs countdown), cyc "
            "(true in 'cycle', where mag is deliberately 0 because the lean is not the pointer), "
            "dz (the dead-zone fraction, so a drawing never has to guess it) and where (the "
            "`showWhere` setting, which is how an overlay page - a separate window with no "
            "settings card - knows whether it is supposed to draw at all).\n"
            "SUBMENUS ADD: mode (the shape being drawn), crumbs (the labels of the open parents, "
            "from the root down), bands (the rings on screen, innermost first; each carries its "
            "items with label/icon/color/sub, openIdx = which of them has a ring standing above "
            "it, and a0/a1 = its angular range in degrees), sel = {band, idx} or null, geom = the "
            "ring boundaries as fractions of the drawn radius, chips and clk (a 'release' wheel "
            "that outlived the press which opened it and is now waiting for a CLICK).\n"
            "`labels`, `idx` and `n` describe the ACTIVE band - on a wheel with no children that "
            "is the only band, so anything written before submenus reads exactly what it always "
            "did. THE DRAWING COMPUTES NO GEOMETRY OF ITS OWN: the engine picks a ring from the "
            "LENGTH of the lean, so a second opinion about where the rings are would mean aiming "
            "at a ring the server cannot see."
        ),
        "showWhere": (
            "WHERE THE WHEEL IS DRAWN, as one choice instead of three switches. The wheel has "
            "three possible surfaces: the cheat sheet in the panel, the ordinary overlay windows, "
            "and the window at the pointer. Before this setting each was switched on separately, "
            "so the commonest wish ('put the wheel under my cursor') produced TWO wheels at once - "
            "the same choice drawn in two places while a person looks at one of them.\n"
            "  'overlay' (default) - the ordinary overlays draw it; the window at the pointer is "
            "CLOSED by the server.\n"
            "  'cursor' - the window at the pointer is OPENED by the server, and the ordinary "
            "overlays stop drawing the wheel. The suppression happens in the DRAWING, not in the "
            "window configs: each overlay's own `show.wheel` is left exactly as its owner set it, "
            "so switching back restores what was there with nothing to re-tick.\n"
            "  'both' - both at once. Worth it when the overlay is for viewers and the little "
            "window is for the player; otherwise it is the duplication above.\n"
            "The cheat sheet IN THE PANEL always draws it, whatever this says: that is the surface "
            "the setting is changed on, and a preview that vanished while being set would be a "
            "setting whose effect cannot be seen.\n"
            "THE SERVER ENFORCES IT. POST /wheel with a changed showWhere opens or closes "
            "'<dev>~kolo' itself (the response then carries `cursorUp`), and at startup that "
            "window is re-opened ONLY when the capsule still says 'cursor' or 'both'. So do NOT "
            "pair a showWhere write with a POST /overlay open/close - that is the server's half."
        ),
        "cursorWindow": (
            "THE WHEEL DRAWN AROUND THE MOUSE POINTER, in a floating window of its own. It is one "
            "more OVERLAY WINDOW, with the reserved id '<dev>~kolo' and the window flag "
            "`followCursor: true`. The app centres "
            "it on the pointer ONCE, on the edge where the wheel opens (RadialMenu._open -> "
            "OverlayManager.wheel_opened), and never while a choice is being aimed at - a drawing "
            "that slid after the cursor would move the target under the hand. It is clamped to the "
            "monitor the pointer is on, so a wheel opened at a screen edge stays whole.\n"
            "WHETHER IT STANDS AT ALL is the wheel's `showWhere` (see above), not a switch of its "
            "own: the koło wyboru card writes 'cursor' or 'both' to POST /wheel and the SERVER "
            "opens or closes this window. Its size (w = h, 180..560 px), theme and "
            "opacity are still ordinary overlay settings written with POST /overlay act 'config'. "
            "It shows ONLY the "
            "wheel (`show.wheel` on, everything else off), carries no bar, no resize corner and no "
            "cog, and ALWAYS passes clicks through - it sits directly under the pointer and in "
            "'click', 'tilt-click' and 'cycle' the very next click is the one that confirms.\n"
            "Deliberately absent from every list of overlays (tray menu, panel buttons, 'open "
            "all', the capsule pill's switch): one window with two switches in two places is a "
            "window whose state nobody can predict. It IS answered by name - GET "
            "/overlay?win=<dev>~kolo - which is how the card reads its size, theme and opacity. It "
            "is also the only overlay that re-opens by itself when the app starts - and only while "
            "`showWhere` is still 'cursor' or 'both' - because it is a feature somebody switched "
            "on rather than a window somebody placed."
        ),
    },
    # ------------------------------------------------------------------------------------
    #  SKANER EKRANU (the screen scanner). Not a setup group either — its own file, its own engine
    #  in the browser, its own tool (get_module_config / set_module_config with module:"scan").
    #  Described here in full because it is the module that answers "I cannot press buttons": the
    #  whole desktop from ONE signal. A model that does not know it exists composes a tilt-and-tap
    #  scheme for somebody who cannot tap.
    # ------------------------------------------------------------------------------------
    "scan": {
        "whatItIs": (
            "A bar sweeps across the screen by itself; the person STOPS it with one signal. A "
            "second bar then sweeps the other way and is stopped the same way, and the crossing "
            "is where the click lands. TIME REPLACES SPACE, so one signal - a tap on the capsule, "
            "a lean, a shake, anything a rule can detect - drives the whole desktop. This is the "
            "assistive technique behind Apple's Switch Control and Android's Switch Access, not "
            "an invention of this app; the timing ranges come from Colven & Judge, 'Switch access "
            "to technology'."
        ),
        "whenItIsTheAnswer": (
            "Reach for it when the person has FEWER reliable movements than a mapping needs: one "
            "switch, one tap, one lean they can repeat - and nothing else dependable. Every other "
            "module in this app spends a movement per action (a tilt for W, another for A); the "
            "scanner spends the same one movement on every action there is, and pays for it in "
            "time. That trade is the whole point: it is slower than anything else here and it is "
            "the only thing that works when the body has one signal to give."
        ),
        "whereItLives": (
            "Settings/[<dev>/]ribbitflip_scan.json, one per capsule, HTTP GET/POST /scan?dev=<id>. "
            "Read it with get_module_config {module:'scan'}, write it with set_module_config. "
            "apply_setup / get_setup neither read nor write it, and a saved Setup does not carry "
            "it - a scanning scheme has to be set up as its own step, and said out loud as one."
        ),
        "engineIsInTheBrowser": (
            "The server stores the config, broadcasts the signal and opens the window. The bar "
            "itself is drawn and timed by a PAGE, so nothing moves unless one is on screen: "
            "either the full-screen overlay above the desktop (set_module_config {module:'scan', "
            "window:'open'}, which needs the module switched on first) or the Skaner card in the "
            "dashboard. 'I turned the scanner on and nothing happens' is this, nine times out of "
            "ten."
        ),
        "theWholeChain": [
            "scan.enabled = true (the module switch, per capsule)",
            "a page is up: the overlay window over the desktop, or the Skaner card in the panel",
            "at least one rule whose keySpec is 'scan:sygnal' - that is the person's signal",
            "master arm on: the CLICK leaves through the ordinary emitter, so a disarmed app "
            "scans and points and clicks nothing (the bar still moves - that is deliberate, it "
            "lets somebody practise safely)",
            "and one rule with 'scan:stop', which is not optional - see pitfalls",
        ],
        "signals": {
            "scan:sygnal": "stop the bar / commit the choice. THE signal - map it first.",
            "scan:cofnij": "step back one stage (wrong bar stopped, wrong quadrant). Worth its own "
                           "gesture: without it a mistake costs a whole cycle.",
            "scan:stop": "stop the scanner. Goes through EVEN WITH THE MODULE SWITCHED OFF - the "
                         "way out must not depend on the thing it is getting out of. It still "
                         "needs master arm, which is fine: disarming stops the clicking anyway.",
            "scan:start": "start a cycle without waiting for the idle timeout.",
            "_note": "These are NOT output. Nothing is pressed on the machine: they are answers "
                     "given TO the app, like 'layer:'. They therefore listen to the SKANER "
                     "module's switch, not to the Mapping group - for somebody driving the "
                     "computer this way the scanner IS the keyboard and the mouse, and hanging it "
                     "on the Mapping switch would let one switch-off cut the person off from the "
                     "computer, including from the way to switch it back on. Classified SAFE "
                     "(since 2026-09-13), so safe mode keeps them.",
        },
        "whatItClicks": (
            "The point is clicked as 'mouse:left@<x>%,<y>%' through the same emitter as 'Klik w "
            "punkcie ekranu' in a mapping - sent by the PAGE, not by a rule. So the person's own "
            "rules stay simple and safe: they carry 'scan:sygnal', never a screen coordinate. "
            "With 'menuAkcji' on, the point is followed by a scanned menu of actions (left click, "
            "double, right, drag, copy, paste, cancel), which is how a right-click or a drag "
            "happens with one signal."
        ),
        "modes": {
            "pasy": "BARS, the default and the one to start from: horizontal bar, then vertical. "
                    "With przebiegi=2 each axis gets a second, slow, thin pass inside the first "
                    "band - coarse then fine, which is what makes a 6 px accurate point reachable "
                    "at a speed a person can actually stop.",
            "cwiartki": "QUADRANTS: the screen is halved again and again (siatka, poziomyMax) "
                        "until a block is smaller than progKoncaBloku. Fewer signals than bars, "
                        "and each choice is a big target - good for somebody whose timing is "
                        "unreliable. poCwiartkach='paski' finishes the last block with bars, so "
                        "the click lands on a thing rather than on the middle of a square.",
            "radar": "A sweeping arm plus a travelling radius (stopnieNaSek, predkoscPromienia). "
                     "Two signals, angle then distance.",
            "elementy": "NOT AVAILABLE, and do not offer it: the panel's model knows the word, but "
                        "the server drops it back to 'pasy' because scanning actual clickable "
                        "things needs a list of them, and over the desktop only UI Automation "
                        "could supply one. Better that the scanner works differently than not at "
                        "all.",
        },
        "areaWhereItWorks": (
            "A scanner does not have to sweep the whole desktop. 'obszar' is 'caly' (everything), "
            "'monitor' (one screen from get_overview.screens, named in 'obszarMonitor') or "
            "'wlasny' - a rectangle given by obszarX1/obszarY1/obszarX2/obszarY2 with "
            "'obszarJednostka' saying whether those four are 'procent' of the screen or 'piksele' "
            "on it. Narrowing is the single biggest accuracy win there is: a bar crossing a 300 px "
            "strip finds a button in a third of the signals it needs to cross 1920 px. Percent "
            "travels between machines, pixels do not - use pixels only when the person plays on "
            "the same screen the numbers were measured on."
        ),
        "severalScanners": (
            "One configuration carries up to 8 named SCANNERS ('sekcje'), each a complete set of "
            "those knobs with its own area, mode and colour; 'sekcjaAktywna' (1-based) says which "
            "one the flat keys currently mirror. Write the list with set_scanner_layout, never by "
            "sending 'sekcje' in set_module_config - POST /scan carries the KNOBS and ignores the "
            "list on purpose, so a scanner added that way disappears at the next slider move. "
            "The person switches between them with a rule carrying 'scan:sekcja=2' (that exact "
            "scanner) or 'scan:sekcja=nast' (the next one on the current view - one capsule button "
            "for a whole screen)."
        ),
        "viewsOfTheGame": (
            "A VIEW ('plansza', 'zrzuty' in the file) is one screen of a game - its menu, its "
            "board, its options panel - carrying a screenshot, a name, the resolution it was taken "
            "at and the numbers of the scanners that work on it. The same scanner may belong to "
            "several views. 'zrzutAktywny' is which one is being looked at: 0 is the TEST DESKTOP, "
            "a drawn desktop that is always first, cannot be deleted, shows every scanner at once "
            "and has its own size in 'szablonW'/'szablonH' (0 = the person's own monitor). "
            "Views exist so one configuration covers a whole game instead of one screen of it; a "
            "view with a name and no screenshot is just a GROUP of scanners, which is legitimate."
        ),
        "fromAScreenshot": {
            "_whatThisIsFor": (
                "The workflow this module was built around: somebody shows you a screenshot of a "
                "game and says what they want to click there. You LOOK at the picture, measure the "
                "clickable region in its pixels, and write it down with set_scanner_layout - one "
                "view per screen of the game, one scanner per region that is scanned differently."
            ),
            "steps": [
                "Ask for the screenshot and for the resolution it was taken at (a full-screen "
                "grab is the screen's own size; 1920x1080 unless told otherwise). Pass the file "
                "path as 'image' and that size as 'width'/'height' - the numbers you measure mean "
                "nothing without them.",
                "Find the smallest rectangle that contains everything the person wants to reach on "
                "that screen, and give it as the scanner's 'area' in the screenshot's own pixels. "
                "Do not scan the whole picture out of caution: everything outside the rectangle is "
                "time the person pays for on every single click.",
                "Choose the mode from the SHAPE of what is inside, not from taste - see "
                "modeFromShape.",
                "One scanner per region that needs a different shape. A board and the button bar "
                "under it are two scanners on one view, not one rectangle around both.",
                "Say out loud which rule switches between them ('scan:sekcja=nast') and which one "
                "stops the scanner ('scan:stop'). A view with four scanners and no way to change "
                "scanner is four scanners the person can only reach one of.",
            ],
            "modeFromShape": {
                "a grid of equal tiles (a board, an inventory, a level select)":
                    "tryb 'cwiartki' with siatka [cols, rows] matching the grid EXACTLY, "
                    "poziomyMax 1 and cwiartkiKolejnosc 'wiersze' - rows first, then the tiles in "
                    "the chosen row, which is cols+rows signals instead of cols*rows. "
                    "poCwiartkach 'klik' clicks the middle of the tile, which is what a tile wants.",
                "a row of buttons, a menu, a vertical list":
                    "tryb 'pasy' with kolejnosc 'Y' for a vertical list or 'X' for a horizontal "
                    "row - one axis, half the signals. przebiegi 1: entries that big need no fine "
                    "pass. Set pasmoY/pasmoX to roughly one entry's height/width so each jump "
                    "lands on one entry.",
                "a dense screen with small controls (an options panel, a toolbar)":
                    "tryb 'pasy', kolejnosc 'Y-X', przebiegi 2 - coarse then fine, the only "
                    "combination that reaches a small control at a speed a person can stop.",
                "anything circular (a radial menu, a dial)":
                    "tryb 'radar' - angle, then distance.",
            },
            "pixelsOrPercent": (
                "Give 'area' in the screenshot's pixels ('unit':'px') - that is what you can "
                "actually measure - and say what the screenshot's resolution was. The tool stores "
                "the rectangle as PERCENT of the screen, computed from that resolution, so the "
                "same layout still lands correctly if the person later plays at another size or "
                "on another monitor. Ask for 'unit':'percent' only when the person gives you "
                "proportions instead of a picture."
            ),
            "traps": [
                "The area is measured against the SCREEN, not against the game window. A game "
                "running windowed puts its menu somewhere else entirely - say so, and ask for a "
                "full-screen screenshot.",
                "A screenshot that was scaled down before you saw it makes every measurement "
                "wrong by that factor. Measure on the picture you were given and report its size "
                "as 'width'/'height' - the tool does the arithmetic, you do not.",
                "Letterboxing: a 16:9 game on a 16:10 screen has black bars, and the bars belong "
                "to the screen while the game's own coordinates do not. Measure on the "
                "screenshot of the whole screen, bars included.",
                "Naming a view after the file ('screenshot_012') costs the person the only label "
                "they will ever see in the bar over the desktop. Name it after what it shows.",
            ],
        },
        "config": {
            "_keysArePolish": (
                "This module's keys are Polish, exactly as the panel writes them - one set of "
                "names on both sides, no translation layer. Unknown keys are dropped, numbers are "
                "clamped to the ranges below, and a word outside the allowed set falls back to "
                "the default (a colour that is not #rrggbb makes an INVISIBLE bar, which looks "
                "like a broken scanner, so it is refused)."
            ),
            "enabled": "bool - the module switch of this capsule. Default false.",
            "tryb": "'pasy' | 'cwiartki' | 'radar' (see modes; 'elementy' -> 'pasy')",
            "ruch": "'skokowy' (default: the bar JUMPS one width at a time - a discrete target to "
                    "aim at, far easier to hit) | 'plynny' (it glides)",
            "kolejnosc": "'Y-X' (default) | 'X-Y' | 'Y' | 'X' - which bar comes first, or only one "
                         "axis at all",
            "przebiegi": "1..2 (default 2) - 2 adds the fine pass. Drop to 1 for somebody who "
                         "only needs big targets and gets tired: half the signals per click.",
            "pasmoY/pasmoX": "8..800 px (default 170/200) - thickness of the coarse bar. WIDER = "
                             "fewer steps, less accuracy: the first thing to widen for somebody "
                             "with unreliable timing.",
            "pasmoDokladnyY/pasmoDokladnyX": "2..60 px (default 6) - thickness of the fine bar.",
            "skok": "0..800 px (default 0 = one own thickness) - how far a jump goes in 'skokowy'.",
            "predkosc": "20..6000 px/s (default 700) - coarse speed. THE knob for reaction time.",
            "mnoznikDokladny": "0.05..1.0 (default 0.28) - the fine pass runs this much slower.",
            "czasKroku": "60..6000 ms (default 900) - time per jump in 'skokowy'. This, not "
                         "'predkosc', is what a jumping bar is actually paced by.",
            "kierunek": "'wahadlo' (default, back and forth - gentler on the eye) | 'jeden'",
            "pauzaNaKrancach": "0..6000 ms (default 900) - a REAL stop at each end before turning "
                               "back; the moment a slow hand uses to catch up.",
            "nawroty": "0..20 (default 3) - sweeps without a signal before the engine rests, so a "
                       "scanner nobody is using does not run forever.",
            "siatka": "[cols, rows], each 1..6 (default [2,2]) - the quadrant split",
            "czasBloku": "120..6000 ms (default 900) - time per block in 'cwiartki'",
            "progKoncaBloku": "10..500 px (default 90) - stop halving below this size",
            "poziomyMax": "1..8 (default 4) - how many halvings at most",
            "poCwiartkach": "'klik' (default) | 'paski' - what happens after the last quadrant",
            "cwiartkiKolejnosc": "'kratka' (default, every cell of the grid in turn) | 'wiersze' "
                                 "(whole rows first, then the cells of the chosen row). On a 4x4 "
                                 "board that is 4+4 steps instead of 16 - the setting to reach for "
                                 "whenever siatka matches a real grid.",
            "obszar / obszarMonitor / obszarJednostka / obszarX1..obszarY2":
                "where this scanner works - see areaWhereItWorks. Written by set_scanner_layout.",
            "sekcje / sekcjaAktywna": "the list of scanners and which one the flat keys mirror - "
                                      "see severalScanners. IGNORED by set_module_config.",
            "zrzuty / zrzutAktywny": "the views of the game and which one is being looked at - "
                                     "see viewsOfTheGame. IGNORED by set_module_config.",
            "szablonW / szablonH": "0..32000 px (default 0 = this monitor) - the size the TEST "
                                   "DESKTOP stands for, so a layout can be built for a screen "
                                   "other than the one in front of you.",
            "stopnieNaSek": "5..720 (default 90) - radar sweep speed",
            "predkoscPromienia": "40..4000 px/s (default 500) - radar radius speed",
            "wzorElementow": "'wiersz-kolumna' | 'liniowy'", "czasElementu": "120..6000 ms",
            "_timingsAreTheAccessibility": (
                "The next five are the standard switch-access timings, and they are where a "
                "scheme is fitted to a PERSON rather than to a screen. Every one of them is "
                "named after the setting it mirrors in Switch Control / Switch Access."
            ),
            "opoznienieStartu": "0..6000 ms (default 1000) - 'delay on first item': how long it "
                                "stands still before it starts moving.",
            "czasPrzytrzymania": "0..3000 ms (default 0) - 'acceptance time': how long the signal "
                                 "must be HELD to count. Raise it for somebody who brushes the "
                                 "capsule by accident or whose hand bounces; 0 means the first "
                                 "pulse counts.",
            "blokadaPoWyborze": "0..6000 ms (default 600) - 'post-activation delay': how long no "
                                "further signal is accepted after a choice. This is what stops "
                                "one intended press from being read as two.",
            "odbicie": "0..1000 ms (default 80) - 'debounce': a second press this soon after "
                       "letting go is the same press. Raise it for a tremor or a bouncy switch.",
            "wyprzedzenie": "-1000..2000 ms (default 0) - REACTION-TIME CORRECTION: the position "
                            "is read this many ms BEFORE the signal arrived. Somebody who "
                            "consistently lands late by a constant amount gets it back here "
                            "instead of being asked to react faster.",
            "dociaganie": "0..400 px (default 100) - snap the point to the nearest target when it "
                          "is closer than this. The cheapest accuracy this module has.",
            "menuAkcji": "bool (default false) - scan a menu of actions after the point",
            "akcjaDomyslna": "what happens without the menu (default 'lewy')",
            "menuPozycje": "up to 16 action codes; default ['lewy','dwuklik','prawy','przeciagnij',"
                           "'kopiuj','wklej','anuluj']. Trim it: every entry costs a sweep.",
            "powrotPoAkcji": "'spoczynek' (default, wait for the next signal) | 'odRazu'",
            "configName": "<=40 chars - which saved scanner set this capsule is carrying",
            "_lookAndSound": (
                "kolorY / kolorX / kolorDokladny ('#rrggbb'), kryciePasma 0..1, przyciemnienie "
                "0..0.95, grubosc 1..10, poswiata bool, etykietaPrzyPasku bool, pokrycieY/pokrycieX "
                "5..100 - and the two that are not decoration: 'dzwiek' (bool) ticks on every step "
                "and 'tonPozycji' (bool) makes the pitch follow the bar's position, so the screen "
                "can be scanned BY EAR. Together with glosnosc 0..1 they are what the shipped "
                "'Bez patrzenia' set is built from."
            ),
        },
        "presets": (
            "Named scanner sets live in Library/ScanPresets/ and are listed by "
            "get_module_config {module:'scan'}; apply one with set_module_config {module:'scan', "
            "preset:'<name>'}. The app ships six, and they are the honest starting points: "
            "'Ostrozny' (the DEFAULT for a new install - slow, forgiving), 'Zrownowazony', "
            "'Szybki', 'Cwiartki', 'Z menu akcji' and 'Bez patrzenia' (sound and position tone, "
            "for scanning without looking). Start from the one nearest the person and tune ONE "
            "number at a time - a preset is a starting point, not an answer."
        ),
        "pitfalls": [
            "NO WAY TO STOP. A scanner running with nobody able to stop it is the worst failure "
            "this module has. Always map 'scan:stop' to a second gesture, and tell the person "
            "what it is, before turning anything on.",
            "The module on, no page open - nothing moves and nothing says why (see "
            "engineIsInTheBrowser).",
            "Speed tuned for you, not for them. Somebody stopping the bar late every time needs "
            "'wyprzedzenie', not a lecture about reacting sooner.",
            "One signal on a capsule that is ALSO steering the mouse or the stick: the movement "
            "that drives the pointer will trip the scanner. Give the scanner its own capsule, or "
            "switch motion control off on that one.",
            "A menu with seven entries costs up to seven sweeps. Trim 'menuPozycje' to what the "
            "person actually uses.",
        ],
    },
    # ------------------------------------------------------------------------------------
    #  PLAY PADS ("Synth" tab). Read-only knowledge: a pad is a browser-side instrument. Its state
    #  is mirrored to Settings/ribbitflip_synth.json since 2026-08-28 (and the browser keeps a copy
    #  in localStorage 'ribbitflip.pad'), but as an OPAQUE blob outside the config groups, so
    #  nothing here can be applied through apply_setup. What it buys the model is the ability to
    #  say exactly which control to touch,
    #  in the words printed on it, instead of guessing. Ranges transcribed from padDefaults() and
    #  padDe() in web/js/rf-19-pad-model2.js / rf-20-gate-model.js.
    # ------------------------------------------------------------------------------------
    "padsSynth": {
        "whatItIs": (
            "An XY instrument played by a finger AND/OR by the capsules, one independent "
            "instrument per pad. It is LOCAL sound (WebAudio) - a pad never sends MIDI, OSC or "
            "keystrokes, so it plays even while master arm is off."
        ),
        "howSoundHappens": [
            "The 'Pady grające' group switch (card header) must be on - off collapses the pads.",
            "The browser needs one click anywhere in the page before it will make any sound.",
            "A finger/mouse on the canvas always plays. A CAPSULE plays a pad when that pad's "
            "'Graj z ruchu' (motion) switch is on - it now defaults to ON for a new pad, so every "
            "pad sings from the capsule unless it was turned off or the capsule is muted.",
            "Every pad plays at once: one capsule drives all of them, each with its own sound.",
        ],
        "whySilentChecklist": [
            "capsule muted in the devices hub -> every pad goes quiet (that is what the mute is for)",
            "'Graj z ruchu' off on THAT pad -> the frog still glides, the pad stays silent; the "
            "canvas says so with a badge in the top-right corner",
            "gate closed -> the pad dims and shows a 'bramka zamknieta' badge (a rhythm gate chops "
            "the sound to its pattern; conditions can close it entirely)",
            "no data at all -> the app is in LIVE mode with no capsule connected; switch to "
            "simulation or connect one. Be exact about what simulation is: only the MOTION is "
            "synthetic. EVERY output is real - keys, mouse, pad, MIDI and OSC all reach the "
            "operating system exactly as they would from a real capsule. What keeps a simulated "
            "session safe is not the mode, it is that every output group STARTS SWITCHED OFF and "
            "the panel asks the human to confirm before the first one goes on. The only thing "
            "that withholds the keyboard and the mouse is the separate launch flag --no-keys "
            "(it builds no key/mouse emitter at all), meant for test machines. Read it from "
            "get_overview.app.sendKeys - do not infer it from the mode.",
            "pad volume at 0, or the app's own 'Kill stuck audio' left everything released",
        ],
        "padFields": {
            "sound": "the id of one of the 35 built-in sounds (the PAD_SOUND_LIST in "
                     "web/js/rf-17-pad-model.js, e.g. ribbit, lead, pluck, fx) or of a custom "
                     "sound saved in the library",
            "motion": "bool - does this pad listen to the capsules (DEFAULT true)",
            "glideMode": (
                "'hard' = stepped, an instant jump to the next note of the scale; "
                "'smooth' (default) = portamento between notes, the glide lengthening with the "
                "interval; 'free' = ULTRA-SMOOTH: no scale and no notes at all, the pad's whole "
                "width is one continuous pitch band and the sound tracks the finger. In 'free' the "
                "scale and root selects do nothing (the UI greys them out), the canvas drops its "
                "note columns, and struck sounds (marimba, pluck) are BENT while they ring instead "
                "of being re-struck - once the ring fades they are struck again at the exact "
                "current pitch, which reads as a roll."
            ),
            "yParam": (
                "what the VERTICAL axis steers: 'both' (default - brightness and loudness "
                "together, the historical behaviour) | 'bright' (tone only) | 'vol' (loudness "
                "only) | 'vib' (vibrato depth) | 'cutq' (cutoff AND resonance - a filter sweep) | "
                "'q' (filter resonance) | 'fenv' (how hard the filter kicks at the strike) | "
                "'att' (attack time) | 'dec' (tail: the decay of a struck sound, the release of a "
                "held one) | 'det' (a unison pair that fades in with the detune, silent at zero) | "
                "'drive' (per-voice overdrive) | 'none' (Y leaves the sound alone). Anything Y "
                "does not steer sits at a fixed middle instead of following the finger. "
                "'att' and 'fenv' happen AT the strike, so they land on the next note rather than "
                "on the one already ringing; 'det', 'fenv' and 'drive' have nothing to apply to in "
                "the 'fx' (noise) sound."
            ),
            "yLo/yHi": (
                "int 0..100 (default 0 and 100) - the slice of that parameter the pad's height is "
                "stretched over. Bottom of the pad = yLo, top = yHi. yHi < yLo is legal and simply "
                "means the axis runs backwards."
            ),
            "base": "int 24..84 - MIDI note at the left edge (default 48 = C3)",
            "oct": "int 1..4 - how many octaves fit across the width (default 2)",
            "scale": "chromatic|major|minor|harmonic_minor|pentatonic_major|pentatonic_minor|blues|"
                     "dorian|phrygian|lydian|mixolydian|whole_tone (per pad; ignored by glideMode 'free')",
            "scaleRoot": "int 0..11 (0 = C)",
            "vol": "int 0..100 (default 70)",
            "drag": "int 0..100 (default 30) - how lazily the touch cursor follows the finger",
            "echo/vib/latch/momentum/velMotion": (
                "bools. echo = delay send; vib = vibrato from twist; latch = the frog stays and "
                "keeps playing after release; momentum = it coasts on like a trackball; velMotion "
                "= a new note is louder the more energetic the gesture was"
            ),
            "fx": "{bright, hp, tremolo} floats 0..1 with their own on/off switches (fxOn)",
        },
        "perCapsule": {
            "_what": "Each pad maps each capsule separately (the 'Kapsle' panel under the pad).",
            "on": "bool - does this capsule play this pad",
            "axX/axY": "which motion drives X and Y: tilt|twist|pitch|roll (default roll/pitch)",
            "range": "float 15..180 - degrees that cover the pad's full width/height (default 45)",
            "drag": "int 0..100 - this capsule's own lag (default 30)",
            "invX/invY": "bools", "curX/curY": "response curve id (default 'lin')",
        },
        "gate": {
            "_what": "'Bramka - kiedy pad gra': conditions and/or a rhythm that decide whether the "
                     "pad may sound at all. A closed gate silences the pad while still drawing the "
                     "cursors, which is the most common cause of 'it moves but says nothing'.",
            "conds": "list of {source, cmp, threshold, thresholdHi?, neg, op} - same source grammar "
                     "as trigger rules, plus {kind:'mapping', ref:<rule id>} to follow a mapping",
            "rhythm": "{on: bool, type: 'rhythm-4'|'rhythm-8'|'rhythm-16'|'offbeat'|'gallop'|"
                      "'trance', bpm: 40..220} - chops the sound to a pattern",
        },
    },
    "power": {
        "autoSleep": "bool - park the cap when idle",
        "idleMin": "float 0.2..120 - minutes of stillness before sleeping",
        "batterySec": "float 5..600 - battery read period",
        "wakeHex": "hex string - wake-up BLE command (leave alone unless the user knows why)",
        # The two answers to a still capsule are NOT the same thing, and picking the wrong one is
        # the mistake worth heading off here: sleep drops the BLE link, so it saves battery but
        # costs a reconnection to come back; autoPause only cuts the outputs while the stream runs
        # on, so the first movement restores it in one packet and the battery is untouched.
        "autoPause": "bool - cut this capsule's outputs while it lies still, and give them back "
                     "on the first movement. NOT autoSleep: the BLE link stays up and no battery "
                     "is saved. Shows up as get_overview.devices[].autoPaused.",
        "autoPauseSec": "int 5..3600 - seconds of stillness before the outputs are cut",
    },
    "safety": {
        "modes": {
            "safe": "DEFAULT. Applies only rules classified 'safe'; risky ones are dropped and "
                    "counted in droppedRisky.",
            "advanced": "Applies everything. Requires the human's explicit, informed consent for "
                        "that specific setup - ask, wait for a yes, then retry.",
        },
        "riskyMeans": [
            "the rule contains a macro (any non-empty 'sequence')",
            "the keySpec uses the Windows key - the vector for opening Run/terminal",
            "a system combination: Alt+F4, Ctrl+W, Alt+Tab, Ctrl+Alt+Del, Ctrl+Shift+Esc, "
            "Ctrl+Esc, Alt+Space",
            "modifiers outside ctrl/shift/alt, or an unknown key name",
        ],
        "why": (
            "keySpec and sequence map motion to REAL system input. A setup that maps a tilt to "
            "'win+r; cmd; enter; <command>; enter' is remote code execution by another name, so "
            "content decides trust, not the file's origin."
        ),
        "masterArm": "Nothing reaches the operating system while master arm is off. set_output "
                     "with master=true is a user decision, never yours.",
    },
    "examples": {
        "gamePreset": {
            "what": "Third-person game: lean left/right to strafe, lean forward/back to walk, "
                    "tap the cap to jump. Movement keys use 'hold' so they stay pressed while tilted.",
            "config": {
                "trigEnabled": True,
                "rules": [
                    {"id": "g_left", "label": "Lean left -> A", "enabled": True,
                     "source": {"kind": "filter", "metric": "roll"},
                     "cmp": "<", "threshold": -25.0, "behavior": "hold", "keySpec": "a"},
                    {"id": "g_right", "label": "Lean right -> D", "enabled": True,
                     "source": {"kind": "filter", "metric": "roll"},
                     "cmp": ">", "threshold": 25.0, "behavior": "hold", "keySpec": "d"},
                    {"id": "g_fwd", "label": "Lean forward -> W", "enabled": True,
                     "source": {"kind": "filter", "metric": "pitch"},
                     "cmp": "<", "threshold": -20.0, "behavior": "hold", "keySpec": "w"},
                    {"id": "g_back", "label": "Lean back -> S", "enabled": True,
                     "source": {"kind": "filter", "metric": "pitch"},
                     "cmp": ">", "threshold": 20.0, "behavior": "hold", "keySpec": "s"},
                    {"id": "g_jump", "label": "Tap -> Space", "enabled": True,
                     "source": {"kind": "button", "any": True, "holdMs": 250.0},
                     "cmp": ">", "threshold": 0.0, "behavior": "once", "keySpec": "space"},
                    # A shake, on motion ENERGY rather than on any one angle: it fires however the
                    # cap happens to be held, which is the whole point of the gesture.
                    {"id": "g_shake", "label": "Shake -> reload", "enabled": True,
                     "source": {"kind": "filter", "metric": "spin"},
                     "cmp": ">", "threshold": 12000.0, "behavior": "once", "keySpec": "r"},
                ],
            },
        },
        "midiPreset": {
            "what": "Instrument: tilt drives the mod wheel (CC1), forward/back lean picks a note "
                    "from a C minor pentatonic scale, velocity comes from how energetic the gesture is.",
            "config": {
                "midi": {
                    "enabled": True, "oscEnabled": False, "midiChannel": 0,
                    "scaleRoot": 0, "scale": "pentatonic_minor",
                    "mappings": [
                        {"id": "m_mod", "name": "Tilt -> Mod wheel", "enabled": True,
                         "srcKind": "filter", "metric": "tilt", "dest": "cc", "mode": "continuous",
                         "cc": 1, "inLo": 0.0, "inHi": 60.0, "outLo": 0, "outHi": 127,
                         "curve": "lin", "rateMs": 15, "slewMs": 60, "smoothMode": "ema"},
                        {"id": "m_note", "name": "Pitch -> note in scale", "enabled": True,
                         "srcKind": "filter", "metric": "pitch", "dest": "note", "mode": "continuous",
                         "inLo": -45.0, "inHi": 45.0, "loNote": 48, "hiNote": 72,
                         "velocity": 100, "velSource": "motion", "rateMs": 30},
                        # OSC, both axes at once: the profile decides WHAT (int 0..180), the edge
                        # decides WHEN (a 300 ms pulse that ends on its own). oscType/outLoF/outHiF
                        # are deliberately absent - the profile derives them server-side.
                        {"id": "m_servo", "name": "Tilt -> servo pulse", "enabled": True,
                         "srcKind": "filter", "metric": "tilt", "dest": "osc", "mode": "threshold",
                         "addr": "/servo", "oscProfile": "servo", "oscEdge": "pulse", "pulseMs": 300,
                         "threshold": 45.0, "cmp": ">", "safeOnDisarm": 0},
                    ],
                },
            },
        },
    },
}


# ============================================================================
#  DOSTĘPNOŚĆ — the decision layer between a PERSON and the modules above.
#
#  Everything in MAPPING_REFERENCE answers "what can this app do". Nothing in it answers the
#  question somebody actually arrives with: "this is what my body can do - now what?". That gap
#  was not theoretical. The facts were all there (dwell click was written as an accessibility
#  aid, the wheel's 'cycle' mode exists for hands that cannot aim, the scanner is Switch Control
#  by another name) and they were scattered across four modules, so the cheapest thing for a
#  model to do was to compose the default scheme - lean for WASD, tap for space - for somebody
#  who had just said they cannot tap.
#
#  This table is therefore ordered by ONE thing: how much ability each mechanism demands. Read it
#  from the top when the person has little, from the bottom when they have plenty.
# ============================================================================

ACCESSIBILITY = {
    "whatThisIs": (
        "How to fit a RibbitFlip scheme to a body. Read it whenever somebody describes what they "
        "can and cannot do - 'I cannot press buttons', 'my hands shake', 'I only have movement in "
        "my head', 'I get tired after a minute', 'I cannot see the screen well'. It covers EVERY "
        "module, not only the obvious ones, and it says for each whether you can set it yourself "
        "or have to hand it to a person at the panel."
    ),
    "firstPrinciple": (
        "Start from the movement, not from the game. The usual order - 'what does this game need? "
        "W, A, S, D, space' - produces a scheme that demands five reliable movements, and then "
        "asks the person to supply them. Turn it round: find the movements that are RELIABLE, "
        "REPEATABLE and CHEAP for this person, count them, and spend them. One reliable movement "
        "plus time (the scanner) beats five unreliable ones every single time, and 'unreliable' "
        "usually means 'works for three minutes, then hurts'."
    ),
    "askFirst": [
        {"ask": "What movement can you make that you could repeat a hundred times today without "
                "it hurting?",
         "why": "This is the whole specification. One such movement is enough for the scanner or "
                "the wheel; three or four make an ordinary mapping possible."},
        {"ask": "Can you HOLD that position - a few seconds - or is it more of a single push?",
         "why": "Decides behavior 'hold' versus 'latch'. Someone who cannot sustain a lean must "
                "never be given movement keys on 'hold': the key dies the moment the effort does."},
        {"ask": "Can you do it twice quickly, one after the other?",
         "why": "Decides whether 'multi' (double tap) and the wheel's 'click'/'cycle' modes are "
                "available at all."},
        {"ask": "How far can you move it - a few degrees, or right over?",
         "why": "Sets thresholds and, when the answer is 'a few degrees', sends you to pose gain "
                "(see mechanisms.pose) instead of to smaller thresholds."},
        {"ask": "Does your hand shake, or drift once it is out there?",
         "why": "Tremor changes the timings and the dead zones everywhere: smoothing, dwellRadius, "
                "wheel deadzone, the scanner's debounce."},
        {"ask": "Where will the capsule sit - in a hand, on a headband, on a footrest, taped to "
                "an armrest?",
         "why": "Decides pose.zero, pose.inv and which metric means what. A capsule on a head "
                "reads pitch/roll the way a nodding and tilting head moves, not the way a wrist "
                "does, and it must be zeroed in the position the head RESTS in."},
        {"ask": "Can you see the screen comfortably? Is sound available?",
         "why": "Sound scanning (dzwiek + tonPozycji, the 'Bez patrzenia' set) exists exactly for "
                "when the answer is no; feedback otherwise defaults to things on screen."},
        {"ask": "What must ALWAYS work, even if everything else goes wrong - and who is nearby?",
         "why": "The stop. Before anything is armed, the person needs a way to stop it that does "
                "not depend on the thing that went wrong: 'scan:stop', a disarm gesture, the "
                "emergency hotkey, or a person in the room. Never arm before this exists."},
        {"ask": "Is there someone who can click in the panel when needed?",
         "why": "Some steps are human-only (see onlyAHumanCanDo). If nobody can do them, choose a "
                "scheme that avoids them rather than one that quietly depends on them."},
    ],
    "abilityProfile": {
        "_whatFor": "The shape check_accessibility takes. Every field is optional; send what the "
                    "person actually told you and nothing else - a guessed field is worse than a "
                    "missing one, because the check will silently pass on it.",
        "signals": "int - how many DISTINCT movements they can make reliably (0 = none yet found)",
        "canHold": "bool - can sustain a position/press for several seconds",
        "canRepeatFast": "bool - can repeat a movement twice inside about a second",
        "tremor": "bool - shaking, spasm or drift",
        "rangeDeg": "number - how far they can tilt the capsule, in degrees",
        "steersPointer": "bool - can steer a pointer continuously (aim, not just trigger)",
        "reactionMs": "number - typical delay between deciding and the signal arriving",
        "tires": "bool - effort has to be rationed; short sessions",
        "sight": "'screen' | 'low' | 'none' - can they watch the screen while using it",
        "mount": "'hand' | 'head' | 'foot' | 'chair' | 'other' - where the capsule sits",
        "helper": "bool - somebody who can click in the panel / press a key",
        "stopGesture": "string - what they can always do to stop everything (free text)",
    },
    # --------------------------------------------------------------------------------
    #  MECHANISMS, least demanding first. `setBy`: 'assistant' = you can write it over MCP;
    #  'human' = somebody has to do it in the panel and you should say exactly where.
    # --------------------------------------------------------------------------------
    "mechanisms": [
        {
            "id": "scanner",
            "module": "Skaner (screen scanning)",
            "needs": "ONE repeatable signal. No aiming, no holding, no speed.",
            "gives": "The entire desktop: click anywhere, plus right click, double click, drag, "
                     "copy and paste through the action menu.",
            "cost": "Time. Every click costs two to four sweeps.",
            "fields": "reference.scan - and the five switch-access timings are where it is fitted "
                      "to the person: opoznienieStartu, czasPrzytrzymania, blokadaPoWyborze, "
                      "odbicie, wyprzedzenie.",
            "setBy": "assistant (set_module_config module='scan'), but the window over the desktop "
                     "has to be opened too (window:'open') or nothing moves.",
            "watchOut": "Always map 'scan:stop' as well. Never put the scanner on a capsule that "
                        "is also steering the pointer.",
        },
        {
            "id": "wheelCycle",
            "module": "Koło wyboru (the wheel), confirm:'cycle'",
            "needs": "One CLICK, repeated. Explicitly no aiming: after it opens, the lean is "
                     "ignored and each click steps to the next slice.",
            "gives": "2..16 actions from one gesture, plus submenus.",
            "fields": "reference.wheel - confirm:'cycle', confirmMs (how long the wait that "
                      "commits), deadzone (wide for an unsteady hand), slices.",
            "setBy": "assistant (set_module_config module='wheel')",
            "watchOut": "It opens on a lean DOWN past 0.8 of the rim, so it fights a capsule that "
                        "also drives the mouse or the stick. Give it its own capsule.",
        },
        {
            "id": "wheelTiltHold",
            "module": "Koło wyboru, confirm:'tilt-hold'",
            "needs": "A lean that can be held still for confirmMs. NO BUTTON AT ALL.",
            "gives": "The same 2..16 actions for somebody whose capsule button is unusable or "
                     "whose hand cannot press anything.",
            "fields": "confirm:'tilt-hold', confirmMs 200..3000, deadzone 0.10..0.70",
            "setBy": "assistant",
            "watchOut": "Widen deadzone until resting the capsule picks nothing; the opening bar "
                        "rises with it, so there is always room between rest and open.",
        },
        {
            "id": "dwellClick",
            "module": "Sterowanie ruchem -> mysz (dwell click, 'klik bez klikania')",
            "needs": "The ability to STEER a pointer. No press at all.",
            "gives": "Left/right/middle/double click by stopping the cursor. Written as an "
                     "accessibility aid: steering and pressing are two different abilities.",
            "fields": "mouse.dwellOn, dwellMs 150..5000, dwellRadius 2..200 px (displacement, "
                      "summed as a vector, so a tremor cancels itself out), dwellClick",
            "setBy": "assistant (setup group 'mouse')",
            "watchOut": "One click per stop; it re-arms only after the cursor has travelled "
                        "further than dwellRadius. With a tremor raise dwellRadius before you "
                        "raise dwellMs - a longer wait with a small radius never fires at all.",
        },
        {
            "id": "absolutePointing",
            "module": "Sterowanie ruchem -> mysz, mouseAbsolute",
            "needs": "A repeatable RESTING position and some range - typically a head-mounted "
                     "capsule.",
            "gives": "The tilt IS the place on screen, like a presentation pointer; a still "
                     "capsule leaves the real mouse alone.",
            "fields": "mouse.mouseSource:'filter', mouseAbsolute:true, mouseFilterScale (degrees "
                      "that reach the EDGE - lower it for a small range), mouseArea/mouseMonitor/"
                      "mouseRect* (fence it to one monitor or one rectangle so nothing is out of "
                      "reach), mouseAreaPad",
            "setBy": "assistant",
            "watchOut": "sensX/sensY, acceleration and maxStep mean nothing here; the range is "
                        "mouseFilterScale. Pair it with dwellClick unless they can press.",
        },
        {
            "id": "behaviours",
            "module": "Mapowanie (rules) - the behavior field",
            "needs": "Varies, and that is the point: the SAME gesture can be spent five ways.",
            "gives": "'latch' for somebody who cannot hold (one gesture on, one gesture off, the "
                     "state survives the movement); 'dwell' when a brush past must not count; "
                     "'continuous' for repeat without holding; 'hold' ONLY when the position can "
                     "be sustained; 'multi' only when a fast repeat is reliable.",
            "fields": "reference.behaviors, dwellMs, intervalMs, crossings/windowMs",
            "setBy": "assistant (set_rules / apply_setup)",
            "watchOut": "'hold' on movement keys is the default advice for gamers and the wrong "
                        "advice here. Ask before you use it.",
        },
        {
            "id": "layers",
            "module": "Mapowanie - warstwy (layers)",
            "needs": "One spare gesture.",
            "gives": "Four sets of mappings from the same few movements: 2 gestures + a layer "
                     "switch = 6 actions instead of 3.",
            "fields": "rule.layer 0..4, keySpec 'layer:next' / 'layer:<n>' / 'layer:hold:<n>'",
            "setBy": "assistant",
            "watchOut": "Give the switching rule layer 0 ('Zawsze'), or the person can get stuck "
                        "in a layer with no way back. 'layer:hold:' needs a sustained gesture.",
        },
        {
            "id": "pose",
            "module": "Osie 3D (pose) - gain, smoothing, zero, direction",
            "needs": "Nothing extra. This is the module that makes a SMALL movement count as a "
                     "big one, and it is the most under-used answer to limited range.",
            "gives": "inHi/outHi turn 10 degrees of available movement into the full scale, so "
                     "thresholds and stick ranges stay where they were; smooth ema|adapt + "
                     "smoothMs take out a tremor before anything downstream sees it; dead/zero "
                     "set the resting point where the body actually rests; inv.pitch/inv.roll fix "
                     "a capsule mounted upside down or sideways.",
            "fields": "setupGroups.pose - axes {tilt,twist,pitch,roll} and chans {ch0..ch5}, each "
                      "{on, smooth, smoothMs, zero, dead, inHi, outHi, expo}",
            "setBy": "assistant (setup group 'pose')",
            "watchOut": "A tuned channel is what EVERY consumer reads (rules, MIDI, stick, d-pad, "
                        "mouse), so fixing it here fixes it once instead of in four places. Do "
                        "this BEFORE lowering thresholds: a 5-degree threshold also fires on a "
                        "cough.",
        },
        {
            "id": "dpadStick",
            "module": "Sterowanie ruchem -> drążek / krzyżak",
            "needs": "Lean in two axes; the d-pad needs less precision than the stick.",
            "gives": "Movement in games and in software that reads a controller. The d-pad's "
                     "sectors mean a big dead zone can be set without losing the diagonals.",
            "fields": "mouse.mode 'stick'|'dpad', stickFilterScale / dpadFilterScale (degrees to "
                      "full), dpadInner / stickInner (dead zone), dpadDiagonal false = one key at "
                      "a time, stickSensX/Y per axis, stickBackend 'wsad' to send keys instead",
            "setBy": "assistant",
            "watchOut": "dpadDiagonal:true holds TWO keys at once - harder to control and "
                        "mis-handled by some games.",
        },
        {
            "id": "gestures",
            "module": "Mapowanie - nagrany gest (recorded gesture)",
            "needs": "The ability to repeat one's own movement approximately.",
            "gives": "A trigger shaped like the movement the person actually makes, instead of "
                     "one shaped like an angle threshold. Accuracy is a slider (0..100).",
            "fields": "source {kind:'gesture', takes, accuracy, endHoldMs, channels}",
            "setBy": "HUMAN - the recording is made with the recorder in the rule editor "
                     "('nagraj i powtórz'). You cannot compose `takes`; a gesture source without "
                     "them never fires. When you meet one, keep it byte for byte.",
        },
        {
            "id": "twoCapsules",
            "module": "Kontroler (pads) - mouse.padShare",
            "needs": "Two places on the body that can move, or a helper.",
            "gives": "Two capsules landing on ONE virtual controller = one player using two limbs "
                     "(a foot steers, a hand fires). Different pads = different players, which is "
                     "what you do NOT want here.",
            "fields": "mouse.padShare (a pad id from get_overview.pads), 'off' for a capsule with "
                      "no controller at all",
            "setBy": "assistant for padShare; HUMAN to CREATE a pad (Kontroler tab).",
        },
        {
            "id": "power",
            "module": "Zasilanie (power) - autoPause / autoSleep",
            "needs": "-",
            "gives": "Battery and safety, but it is listed here because it BITES: a capsule that "
                     "auto-pauses after 20 s eats the first movement of somebody who needs a "
                     "minute to prepare one. For a slow user raise autoPauseSec or switch it off; "
                     "autoSleep costs a reconnection, which is worse.",
            "fields": "power.autoPause, autoPauseSec 5..3600, autoSleep, idleMin",
            "setBy": "assistant (setup group 'power')",
        },
        {
            "id": "feedback",
            "module": "LED, powiadomienia, dźwięk, nakładki",
            "needs": "-",
            "gives": "Knowing that a gesture WORKED without watching a game: the capsule's LED "
                     "(rule.led), a Windows notification per rule (rule.toast, rate-limited to "
                     "one per rule per 3 s), the scanner's tick and position tone (dzwiek, "
                     "tonPozycji), the play pads for sound, the overlay windows for a big cheat "
                     "sheet on screen.",
            "fields": "rule.led, rule.toast, reference.scan look-and-sound, reference.padsSynth",
            "setBy": "assistant for led/toast and the scanner's sound; HUMAN for overlays "
                     "(Nakładki) and the play pads (Synth) - both live in the browser.",
            "watchOut": "Feedback is not decoration for somebody who cannot see the screen or "
                        "cannot feel the capsule. Ask which sense is free.",
        },
        {
            "id": "otherSoftware",
            "module": "MIDI / OSC / Usługi sieciowe",
            "needs": "-",
            "gives": "A way out of the keyboard entirely: MIDI or OSC into assistive or music "
                     "software, or an HTTP call to something in the house.",
            "fields": "setupGroups.midi, set_output (port, OSC target)",
            "setBy": "assistant for MIDI/OSC; HUMAN for the 'Usługi sieciowe' module (targets, "
                     "credentials and bindings are configured and encrypted in the browser).",
        },
        {
            "id": "theStop",
            "module": "Master arm, skrót awaryjny, scan:stop",
            "needs": "-",
            "gives": "The ability to make it all stop. set_output {master:false} disarms "
                     "everything; the emergency hotkey does it from the keyboard; 'scan:stop' "
                     "stops the scanner even with its module switched off.",
            "setBy": "assistant for the disarm; HUMAN for the emergency hotkey (Konfiguracja).",
            "watchOut": "If the person cannot press a key combination, the hotkey is not their "
                        "stop - a gesture or another person is. Establish it before arming.",
        },
    ],
    # --------------------------------------------------------------------------------
    #  RECIPES. Starting points, not answers: pick the nearest, then tune ONE thing at a time
    #  with the person. Every field below is real - they come from the sections above.
    # --------------------------------------------------------------------------------
    "recipes": {
        "oneSignalOnly": {
            "forWhom": "'I cannot press buttons' / one switch / one reliable movement.",
            "scheme": [
                "Scanner on this capsule, mode 'pasy', przebiegi 2.",
                "Rule 1: their movement -> 'scan:sygnal'.",
                "Rule 2: a second, different movement -> 'scan:stop'. If there is no second "
                "movement, agree out loud who stops it and how.",
                "Start from the 'Ostrozny' set, then tune speed and the timings.",
                "Open the window over the desktop, leave master arm OFF, and let them practise: "
                "the bar moves, nothing is clicked.",
                "Arm only when they say the bar stops where they mean it to.",
            ],
            "rules": [
                {"id": "a11y_sygnal", "label": "Sygnal skanera", "enabled": True,
                 "source": {"kind": "button", "any": True, "holdMs": 250.0},
                 "behavior": "once", "keySpec": "scan:sygnal"},
                {"id": "a11y_stop", "label": "Stop skanera", "enabled": True,
                 "source": {"kind": "filter", "metric": "spin"},
                 "cmp": ">", "threshold": 12000.0, "behavior": "once", "keySpec": "scan:stop"},
            ],
            "scan": {"enabled": True, "tryb": "pasy", "ruch": "skokowy", "przebiegi": 2,
                     "czasKroku": 1100, "opoznienieStartu": 1500, "blokadaPoWyborze": 900,
                     "odbicie": 150, "menuAkcji": True, "dociaganie": 120},
        },
        "steersButCannotClick": {
            "forWhom": "Can aim a pointer (hand, head) but pressing is unreliable or impossible.",
            "scheme": ["Motion control in 'mouse' mode + dwell click.",
                       "If the movement is small, fix it in pose first (gain), not by lowering "
                       "mouseFilterScale to something twitchy.",
                       "Fence the pointer to one monitor so nothing is unreachable."],
            "config": {"mouse": {"enabled": True, "mode": "mouse", "mouseSource": "filter",
                                 "mouseFilterScale": 25.0, "smoothMode": "oneeuro",
                                 "dwellOn": True, "dwellMs": 1000.0, "dwellRadius": 24.0,
                                 "dwellClick": "left", "mouseArea": "monitor"}},
        },
        "tremor": {
            "forWhom": "Shaking, spasm or drift.",
            "scheme": [
                "pose: smooth 'oneeuro' on the pointer, smooth ema on the axes that drive rules, "
                "and a real 'dead' zone around the resting position.",
                "Raise dwellRadius (displacement is summed as a vector, so a shake cancels out) "
                "before you raise dwellMs.",
                "Wheel deadzone wide (0.45-0.60) so resting picks nothing.",
                "Scanner: odbicie 150-250 ms and czasPrzytrzymania 150-300 ms, so one intended "
                "signal is one signal.",
                "NEVER 'multi' (double tap) and never tight thresholds: a tremor crosses them by "
                "itself.",
            ],
        },
        "smallRange": {
            "forWhom": "Can only move the capsule a few degrees.",
            "scheme": [
                "pose.axes: turn the axis on and set inHi to what they can actually reach "
                "(measure it - ask them to move as far as is comfortable and read get_overview), "
                "leaving outHi at full. Now 8 degrees of them is 90 degrees of everything else.",
                "Only then set thresholds, stickFilterScale or mouseFilterScale as usual.",
                "If even that is unreliable, stop spending movements: go to oneSignalOnly.",
            ],
        },
        "cannotSustain": {
            "forWhom": "Can start a movement but not hold it - fatigue, spasticity, a switch that "
                       "is pressed and released.",
            "scheme": ["Replace every 'hold' with 'latch' (on/off) or 'continuous'.",
                       "For a modifier that has to stay down, use a latch rule with no keySpec as "
                       "a MODE and a second rule conditioned on it "
                       "({kind:'trigger', ref:'<latch id>'}).",
                       "Avoid 'layer:hold:' - use 'layer:next' or 'layer:<n>'.",
                       "Wheel: 'click' or 'cycle', never 'release' (which holds the button open)."],
        },
        "headMounted": {
            "forWhom": "Capsule on a headband, cap or glasses.",
            "scheme": [
                "Zero the axes with the head in its RESTING position, not upright-and-attentive.",
                "pose.inv.pitch / inv.roll until 'look right' moves right - mounting decides the "
                "sign, not a preference.",
                "mouseAbsolute pointing + dwell click; mouseArea 'monitor' + mouseAreaPad so the "
                "edges are reachable without straining the neck.",
                "Keep the range small (mouseFilterScale 15-25) - a neck should not have to travel "
                "30 degrees to cross a screen.",
            ],
        },
        "cannotWatchScreen": {
            "forWhom": "Low vision, or eyes needed elsewhere.",
            "scheme": ["Scanner with dzwiek:true and tonPozycji:true - the pitch follows the bar, "
                       "so the screen is scanned by ear. The shipped 'Bez patrzenia' set is "
                       "exactly this.",
                       "'kolejnosc' Y or X alone halves the listening.",
                       "rule.led and rule.toast for confirmation that a gesture landed.",
                       "Keep menuPozycje short: every entry is another thing to hear out."],
        },
        "slowOrTires": {
            "forWhom": "Needs time; effort has to be rationed.",
            "scheme": ["Scanner: opoznienieStartu 1500-2500, czasKroku 1100-1500, "
                       "pauzaNaKrancach 1200, blokadaPoWyborze 900-1200.",
                       "przebiegi 1 if big targets are enough - it halves the signals per click.",
                       "'cwiartki' costs fewer signals than 'pasy'.",
                       "power.autoPauseSec up (or autoPause off) so the first movement is not "
                       "spent waking the capsule.",
                       "wyprzedzenie if they land late by a CONSTANT amount - that is a "
                       "measurement, not a lecture about reacting faster.",
                       "Plan short sessions and ask about fatigue after ten minutes, not after an "
                       "hour."],
        },
        "manyActionsFewMovements": {
            "forWhom": "Two or three reliable movements, a game or a program that needs ten.",
            "scheme": ["Wheel with submenus (submenuMode 'ring' for big targets) on one gesture, "
                       "plus layers for the rest.",
                       "4-8 slices per ring; more choices go in a submenu, never in thinner "
                       "slices.",
                       "Name every slice in the person's own words - the label is what they will "
                       "be aiming at."],
        },
    },
    "antiPatterns": [
        "Composing the standard scheme (lean = WASD, tap = space) for somebody who has just told "
        "you they cannot tap or cannot hold a lean.",
        "Asking the person to demonstrate a movement they said they cannot make, to 'check'.",
        "Lowering thresholds instead of raising pose gain: a 5-degree threshold fires on a cough, "
        "a breath and a bumped table.",
        "'hold' for movement keys when holding is the thing they cannot do.",
        "'multi' (double tap) with a tremor - the tremor supplies the second crossing.",
        "Turning the scanner on without a stop gesture, or without telling them what it is.",
        "Putting the scanner or a lean-opened wheel on a capsule that also drives the pointer: the "
        "steering movement trips them.",
        "Arming output (set_output master=true) before the person has a way to stop it.",
        "Quietly depending on a step only a person at the panel can do (see onlyAHumanCanDo) and "
        "reporting the scheme as finished.",
        "Changing five settings at once. When it then works, nobody knows which one mattered - and "
        "when it does not, nobody knows which one to undo.",
        "Treating a preset as an answer. It is a starting point for tuning WITH the person.",
    ],
    "tuningLoop": [
        "1. Compose with master arm OFF. Simulation and a disarmed app still show the rules "
        "firing, the wheel opening and the scanner sweeping - everything except the output.",
        "2. Change ONE number, then ask. 'Did the bar stop where you wanted?' beats any "
        "measurement you can take from here.",
        "3. Read it back: get_overview says which groups are really on, which layer the capsule is "
        "in, whether it is paused and whether anything is armed. A scheme that is not working "
        "usually has one switch off, not a wrong threshold.",
        "4. Save the working scheme as a named Setup (save_setup) and, for the scanner, as a named "
        "scanner set. Somebody will need to get back to it after a bad day of tuning.",
        "5. Arm last, and say what will happen when you do.",
    ],
    "onlyAHumanCanDo": {
        "_why": "Say which of these you need and where it is, rather than reporting a scheme as "
                "finished while it waits on a click nobody made.",
        "recordAGesture": "Rule editor -> the recorder ('nagraj i powtórz'). You cannot compose a "
                          "recording.",
        "createAPad": "Kontroler tab - creating/naming a virtual controller (you can only point "
                      "an existing capsule at an existing pad).",
        "overlays": "Nakładki - the windows above the game, their size, theme and layouts.",
        "playPads": "Synth - the pads are a browser instrument; their state is an opaque blob.",
        "networkServices": "Usługi sieciowe - targets, credentials (encrypted in the browser) and "
                           "bindings.",
        "emergencyHotkey": "Konfiguracja - the emergency stop combination.",
        "theMcpSwitch": "Konfiguracja -> 'Serwer MCP' - if it is off you are not talking to the "
                        "app at all, so this one is never your problem to report.",
    },
    "howToTalkAboutIt": [
        "Use the person's own words for what they can do. Do not rename their condition, do not "
        "diagnose, and do not ask for a diagnosis - the mapping needs movements, not labels.",
        "Say what each mechanism will COST them: 'this one needs one tap, about four seconds per "
        "click' is a decision they can make. 'This is the accessible option' is not.",
        "Offer the trade openly: fewer movements means more time, and more time means fatigue of "
        "a different kind. Let them choose.",
        "When something cannot be done, say so plainly and name the nearest thing that can.",
    ],
}


# ============================================================================
#  Tool catalogue (tools/list)
# ============================================================================

_DEV_PROP = {"type": "string",
             "description": "Device slot id ('d0', 'd1', ...). Omitted or unknown -> default slot."}

TOOLS = [
    {
        "name": "get_overview",
        "title": "Overview of the running app",
        "description": (
            "Read-only snapshot of RibbitFlip: app version, simulate/real mode, master arm state, "
            "every device slot (connection, battery, rule counts, which output groups are on), the "
            "MIDI/OSC targets and the names of Setups that can be loaded by name - the user's own "
            "plus the ones that ship with the app. Start here."
        ),
        "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "get_mapping_reference",
        "title": "Configuration reference",
        "description": (
            "The full, authoritative reference for composing RibbitFlip configs: rule schema, motion "
            "sources with their units and sane thresholds, trigger behaviours, key/mouse spec grammar, "
            "macro DSL, MIDI/OSC mapping schema with scales and curves, motion-control and power keys, "
            "the play pads (Synth tab) with every per-pad field and a why-is-it-silent checklist, "
            "the safe/advanced security model, and two complete worked examples (a game preset and a "
            "MIDI instrument). Read this BEFORE writing any config - the sanitizers drop unknown fields "
            "silently, so guessed field names fail quietly. Note that the pads are knowledge only: "
            "their state lives in the browser, so it is explained here but cannot be applied."
        ),
        "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "get_accessibility_guide",
        "title": "Fitting a scheme to a body",
        "description": (
            "READ THIS FIRST whenever somebody says what their body can or cannot do - \"I cannot "
            "press buttons\", \"my hands shake\", \"I only have movement in my head\", \"I get "
            "tired after a minute\", \"I cannot see the screen well\", \"I have limited movement "
            "in my right arm\". It is the decision layer the rest of the reference does not carry: "
            "the questions worth asking, EVERY module ordered by how much ability it demands (the "
            "screen scanner needs one signal and no aiming; the wheel's 'cycle' and 'tilt-hold' "
            "modes need no button; dwell click needs no press; 'latch' needs no holding; pose gain "
            "turns a few degrees of movement into the full range), ready starting configurations "
            "per limitation, the anti-patterns, the tuning loop, and which steps only a human at "
            "the panel can perform. Read it before composing, not after the person says it does "
            "not work."
        ),
        "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "check_accessibility",
        "title": "Does this scheme fit this person?",
        "description": (
            "Hold a scheme up against what the person told you they can do. Pass 'ability' (see "
            "get_accessibility_guide.abilityProfile - send ONLY what they actually said, a guessed "
            "field passes silently) and either what you composed ('config', 'wheel', 'scan') or "
            "nothing at all, in which case the capsule's LIVE configuration is read. Reports, per "
            "rule and per module: keys held by somebody who cannot sustain a hold, double taps "
            "asked of a tremor, thresholds past their range, more distinct movements than they "
            "have, a scanner with nothing to signal or stop it, a wheel mode that fights the "
            "pointer - plus the questions still unanswered that would change the verdict. Reads "
            "and writes nothing."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "dev": _DEV_PROP,
                "ability": {"type": "object",
                            "description": "What the person can do - abilityProfile from the "
                                           "accessibility guide."},
                "config": {"type": "object",
                           "description": "Setup config to check. Omitted -> the slot's live one."},
                "wheel": {"type": "object",
                          "description": "Wheel config to check. Omitted -> the slot's live one."},
                "scan": {"type": "object",
                         "description": "Scanner config to check. Omitted -> the slot's live one."},
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "get_module_config",
        "title": "Read a module that is not part of a Setup",
        "description": (
            "Read the configuration of one of the two modules a Setup does NOT carry, together "
            "with its saved sets and everything needed to tell whether it can work at all.\n"
            "module='scan': the SCREEN SCANNER - a bar sweeps, one signal stops it, the crossing "
            "is clicked. The answer for somebody who cannot press buttons (reference.scan). "
            "Returns the config, the saved scanner sets, whether the window over the desktop is "
            "open and whether any rule carries the signals that drive it.\n"
            "module='wheel': the WHEEL - 2..16 actions from one gesture, with modes that need no "
            "button ('tilt-hold') or no aiming ('cycle') (reference.wheel). Returns the config and "
            "the saved wheels."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "module": {"type": "string", "enum": ["scan", "wheel"],
                           "description": "'scan' = the screen scanner, 'wheel' = the wheel."},
                "dev": _DEV_PROP,
            },
            "required": ["module"],
            "additionalProperties": False,
        },
    },
    {
        "name": "set_module_config",
        "title": "Write the scanner or the wheel",
        "description": (
            "Write one of the two modules a Setup does not carry, and persist it exactly the way "
            "the dashboard does. Send 'config' with ONLY the keys you want to change - the rest "
            "keeps its current value - or 'preset' to load a saved set by name (its name is then "
            "carried by the capsule), or both, in which case the preset is loaded first and your "
            "keys are applied on top.\n"
            "'enabled' is the module's own switch and is a decision for the person, not for you: "
            "ask first. For the scanner, switching it on is only half - the bar is drawn by a "
            "page, so window:'open' puts the full-screen window over the desktop (it refuses while "
            "the module is off) and window:'close' takes it away. A scanner cannot be driven "
            "without a rule carrying 'scan:sygnal', and must not be turned on without a second one "
            "carrying 'scan:stop': write those with set_rules.\n"
            "Nothing here reaches the operating system on its own - the scanner's click still goes "
            "out behind master arm.\n"
            "A module switched off at start (--disable / --only, see get_overview.app.modulesOff) "
            "refuses with an error and writes nothing."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "module": {"type": "string", "enum": ["scan", "wheel"]},
                "dev": _DEV_PROP,
                "config": {"type": "object",
                           "description": "Keys to change (merged over the current config)."},
                "preset": {"type": "string",
                           "description": "Name of a saved set - see get_module_config.presets."},
                "enabled": {"type": "boolean",
                            "description": "The module's switch. Requires the user's intent."},
                "window": {"type": "string", "enum": ["open", "close"],
                           "description": "scan only: the full-screen window over the desktop."},
            },
            "required": ["module"],
            "additionalProperties": False,
        },
    },
    {
        "name": "set_scanner_layout",
        "title": "Describe the screens of a game; get the scanners set on them",
        "description": (
            "Write the SCANNERS and the VIEWS of the screen scanner from what you can see in a "
            "screenshot. This is the tool for 'here is a picture of the game, make it clickable': "
            "one view ('plansza') per screen of the game - its menu, its board, its options panel "
            "- and inside each, one scanner per region that has to be swept differently, with its "
            "rectangle given in the screenshot's own pixels.\n"
            "Read reference.scan.fromAScreenshot before the first call: it says which mode a shape "
            "asks for, and which mistakes make a measured rectangle land somewhere else.\n"
            "Why this exists next to set_module_config: POST /scan carries the KNOBS of the "
            "scanner being edited and IGNORES the lists, so a scanner or a view sent as 'config' "
            "is silently dropped at the next slider move. Everything here goes the same way the "
            "dashboard's own buttons go.\n"
            "Matching is BY NAME, so calling it twice with the same names edits instead of "
            "duplicating. Nothing is removed unless 'replace' is true. It does not switch the "
            "module on, does not open the window over the desktop and writes no rules - the "
            "scanner still needs 'scan:sygnal' and 'scan:stop' (set_rules) and a page on screen."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "dev": _DEV_PROP,
                "views": {
                    "type": "array",
                    "description": "The screens of the game, in the order they should appear.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string",
                                     "description": "What the screen IS, in the person's words "
                                                    "('Menu gry', 'Plansza', 'Opcje') - it is the "
                                                    "label they read in the bar over the desktop."},
                            "image": {"type": "string",
                                      "description": "Path to the screenshot on this machine "
                                                     "(PNG or JPEG). Optional: a view with a name "
                                                     "and no picture is a group of scanners."},
                            "width": {"type": "integer",
                                      "description": "Width in pixels of the screen the shot was "
                                                     "taken at. Read from the file when 'image' is "
                                                     "given; say it when you know better."},
                            "height": {"type": "integer", "description": "Height, as above."},
                            "scanners": {
                                "type": "array",
                                "description": "The scanners working on this view.",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "name": {"type": "string",
                                                 "description": "What it scans ('Plansza 4x4', "
                                                                "'Pasek akcji')."},
                                        "area": {
                                            "type": "object",
                                            "description": "The rectangle it sweeps. In the "
                                                           "screenshot's own pixels unless 'unit' "
                                                           "says otherwise.",
                                            "properties": {
                                                "unit": {"type": "string",
                                                         "enum": ["px", "percent"]},
                                                "x1": {"type": "number"}, "y1": {"type": "number"},
                                                "x2": {"type": "number"}, "y2": {"type": "number"},
                                            },
                                            "required": ["x1", "y1", "x2", "y2"],
                                            "additionalProperties": False,
                                        },
                                        "mode": {"type": "string",
                                                 "enum": ["pasy", "cwiartki", "radar"],
                                                 "description": "See reference.scan.fromAScreenshot"
                                                                ".modeFromShape."},
                                        "grid": {"type": "array", "items": {"type": "integer"},
                                                 "minItems": 2, "maxItems": 2,
                                                 "description": "[cols, rows] for 'cwiartki' - "
                                                                "match the real grid exactly."},
                                        "gridOrder": {"type": "string",
                                                      "enum": ["kratka", "wiersze"]},
                                        "afterGrid": {"type": "string", "enum": ["klik", "paski"]},
                                        "levels": {"type": "integer",
                                                   "description": "poziomyMax: 1 for a grid that "
                                                                  "is already the right size."},
                                        "axis": {"type": "string",
                                                 "enum": ["Y-X", "X-Y", "Y", "X"],
                                                 "description": "For 'pasy': one axis only is half "
                                                                "the signals."},
                                        "passes": {"type": "integer",
                                                   "description": "1 or 2 (the fine pass)."},
                                        "bandY": {"type": "integer",
                                                  "description": "Coarse bar thickness in px - "
                                                                 "about one entry's height."},
                                        "bandX": {"type": "integer", "description": "As above, X."},
                                        "speed": {"type": "integer",
                                                  "description": "px/s of the sweep."},
                                        "stepMs": {"type": "integer",
                                                   "description": "ms per jump in 'skokowy' - what "
                                                                  "a jumping bar is really paced "
                                                                  "by."},
                                        "config": {"type": "object",
                                                   "description": "Any further scanner keys, by "
                                                                  "their Polish names - see "
                                                                  "reference.scan.config."},
                                    },
                                    "required": ["name"],
                                    "additionalProperties": False,
                                },
                            },
                        },
                        "required": ["name"],
                        "additionalProperties": False,
                    },
                },
                "testDesktop": {
                    "type": "object",
                    "description": "The size the test desktop (view 0) stands for. 0 = this "
                                   "monitor.",
                    "properties": {"width": {"type": "integer"}, "height": {"type": "integer"}},
                    "additionalProperties": False,
                },
                "replace": {"type": "boolean",
                            "description": "Remove the views and scanners you did not list. False "
                                           "by default - somebody else's work is not yours to "
                                           "drop."},
            },
            "required": ["views"],
            "additionalProperties": False,
        },
    },
    {
        "name": "get_setup",
        "title": "Read a configuration",
        "description": (
            "Read a complete configuration together with its safety analysis. Without 'name' it returns "
            "the LIVE config of a device slot; with 'name' it returns a Setup saved in the Library/Setups/ "
            "library. Read-only."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "dev": _DEV_PROP,
                "name": {"type": "string",
                         "description": "Name of a saved Setup. Omit to read the live slot config."},
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "analyze_setup",
        "title": "Dry-run a configuration",
        "description": (
            "Classify a config WITHOUT applying anything: how many rules, how many of them are risky "
            "(macros / Windows key / system combinations), which groups it touches, and a per-rule "
            "verdict with a human-readable description. Run this on anything you composed or received "
            "from a file before applying it."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "config": {"type": "object",
                           "description": "Setup config object (or a full setup envelope; the config "
                                          "inside is unwrapped automatically)."},
            },
            "required": ["config"],
            "additionalProperties": False,
        },
    },
    {
        "name": "apply_setup",
        "title": "Apply a configuration",
        "description": (
            "Apply a complete configuration to a device slot and persist it. Provide EITHER 'config' "
            "(composed by you) OR 'name' (a Setup from the library), never both. Each group is applied "
            "independently.\n"
            "mode='safe' (default) drops rules classified risky and reports droppedRisky. "
            "mode='advanced' applies macros, the Windows key and system combinations - it injects real "
            "keystrokes into the user's desktop, so use it ONLY after the human explicitly consented to "
            "this specific setup."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "dev": _DEV_PROP,
                "config": {"type": "object", "description": "Setup config object to apply."},
                "name": {"type": "string", "description": "Name of a saved Setup to apply."},
                "mode": {"type": "string", "enum": ["safe", "advanced"], "default": "safe",
                         "description": "'advanced' requires the user's explicit consent."},
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "set_rules",
        "title": "Write trigger rules",
        "description": (
            "Replace (or extend, with append=true) the trigger rules of a device slot and persist them. "
            "Only touches the rules group - motion control, MIDI/OSC, axes and power are left alone. "
            "mode='safe' (default) silently drops risky rules; mode='advanced' keeps them and needs the "
            "user's explicit consent. Send an empty list to clear all rules."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "dev": _DEV_PROP,
                "rules": {"type": "array", "items": {"type": "object"},
                          "description": "Rule objects - see get_mapping_reference.ruleSchema."},
                "append": {"type": "boolean", "default": False,
                           "description": "true = keep the existing rules and add these after them. "
                                          "Append replaces any existing rule with a matching id, so "
                                          "re-sending the same call is safe."},
                "mode": {"type": "string", "enum": ["safe", "advanced"], "default": "safe"},
            },
            "required": ["rules"],
            "additionalProperties": False,
        },
    },
    {
        "name": "save_setup",
        "title": "Save a Setup to the library",
        "description": (
            "Save a configuration as a named Setup in the user's Library/Setups/ (one .json file, the "
            "unit users share with each other). With 'config' it saves what you composed; without it, a "
            "snapshot of the slot's current live configuration. Saving does NOT apply anything. "
            "An existing name (also a built-in Setup) is never overwritten: the file gets the first "
            "free 'name (n)' and the answer says so. A Setup saved here is marked source='mcp' and "
            "loads in safe mode, even from the library."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {"type": "string",
                         "description": "File name. Only letters, digits, space, _-() survive; <=60 chars."},
                "dev": _DEV_PROP,
                "config": {"type": "object",
                           "description": "Config to save. Omit to snapshot the live slot."},
                "description": {"type": "string", "description": "Free-text note, <=400 chars."},
                "forApp": {"type": "string",
                           "description": "Which game/program this is for, <=80 chars."},
                "cassette": {"type": "integer", "minimum": 1, "maximum": 8,
                             "description": "Which of the 8 felt cassettes the Setups screen shows "
                                            "as this set's icon. Optional, default 1."},
            },
            "required": ["name"],
            "additionalProperties": False,
        },
    },
    {
        "name": "set_output",
        "title": "Output routing and master arm",
        "description": (
            "Control where output goes. master=true ARMS the app: motion immediately starts sending real "
            "keystrokes/mouse/MIDI to the operating system - do this only when the user explicitly asks. "
            "master=false is always safe (it disarms). midiPort selects a MIDI OUT port by index (-1 "
            "closes it); oscHost/oscPort point OSC at a receiver. Call with no arguments to just read the "
            "current routing."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "master": {"type": "boolean",
                           "description": "Arm (true) or disarm (false) all output. Arming requires user intent "
                                          "and the dashboard's 'Assistant may arm' switch."},
                "midiPort": {"type": "integer",
                             "description": "MIDI OUT port index from get_overview.midi.ports; -1 closes."},
                "oscHost": {"type": "string", "description": "OSC target host (default 127.0.0.1)."},
                "oscPort": {"type": "integer", "description": "OSC target UDP port (default 9000)."},
            },
            "additionalProperties": False,
        },
    },
]


# ============================================================================
#  Helpers shared by the tools
# ============================================================================

def _fn(ctx, name):
    f = (ctx.get("fn") or {}).get(name)
    if f is None:
        raise ToolError("internal: monitor did not provide the '%s' helper" % name)
    return f


def _dev(ctx, args):
    """Resolve ?dev like the HTTP handler does: unknown/missing -> default slot."""
    dm = ctx["dm"]
    want = args.get("dev")
    if isinstance(want, str) and want in dm.devices:
        return dm.get(want)
    d = dm.get(dm.default_id)
    if d is None:
        raise ToolError("no device slot available")
    return d


def _mode(args, ctx=None):
    m = args.get("mode", "safe")
    if m not in ("safe", "advanced"):
        raise ToolError("mode must be 'safe' or 'advanced' (got %r)" % (m,))
    if m == "advanced" and ctx is not None:
        _require_consent(ctx, "mode='advanced'")
    return m


# ZGODA CZŁOWIEKA, SPRAWDZANA PRZEZ SERWER (2026-10-16). Do tej pory „zapytaj najpierw" stało
# tylko w INSTRUCTIONS i w opisach narzędzi, więc model, który ich nie posłuchał, uzbrajał
# aplikację sam. Trzy czynności, po których ruch kapsla zaczyna (albo może zacząć) wysyłać coś
# do systemu, przechodzą teraz wyłącznie przy `allowArm` — włączniku w karcie Konfiguracja →
# Asystent AI, zapisanym w Settings/ribbitflip_mcp.json, domyślnie WYŁĄCZONYM:
#   * set_output(master=true)              — uzbrojenie wyłączonej aplikacji,
#   * set_module_config(enabled=true)       — włączenie skanera albo koła, które stoi wyłączone,
#   * mode='advanced' w set_rules / apply_setup — wczytanie reguł „ryzykownych".
# Rozbrajanie, wyłączanie i tryb bezpieczny przechodzą zawsze: droga w stronę „mniej" nie
# potrzebuje niczyjej zgody.
def _require_consent(ctx, what):
    if ctx.get("allowArm"):
        return
    raise ToolError(
        "%s needs the person's consent, and this app checks it itself: ask them to do it in the "
        "dashboard (the arm button in the header, the module's own switch), or to tick "
        "'Assistant may arm' in Configuration > AI assistant if they want you to do it. "
        "Disarming, switching off and safe mode are always allowed." % what)


def _cfg_of(env):
    """Accept both a bare config and a setup envelope ({app,kind,version,...,config}).

    Same rule as POST /setup/load: a dict 'config' member wins. No setup group is named
    'config' (see SETUP_KEYS), so this can never swallow a real group."""
    if isinstance(env, dict) and isinstance(env.get("config"), dict):
        return env["config"]
    return env


def _rule_verdict(ctx, r):
    v = _fn(ctx, "classify_rule")(r)
    return {"id": r.get("id"), "label": v.get("label"), "level": v.get("level"),
            "desc": v.get("desc"), "reasons": v.get("reasons") or []}


def _note_action(ctx, dev_id, tool):
    """Tell the dashboard an assistant just changed something (SSE type 'mcp_action').
    The front-end ignores unknown event types, so this is additive and safe."""
    b = ctx.get("b")
    if b is None:
        return
    try:
        b.publish({"t": "mcp_action", "ts": b.now(), "dev": dev_id or "d0", "tool": tool})
    except Exception:
        pass


# ============================================================================
#  Tool implementations
# ============================================================================

def _t_get_overview(ctx, args):
    dm = ctx["dm"]
    classify = _fn(ctx, "classify_rule")
    devices = []
    for d in dm.all():
        rules = d.trig.snapshot_rules()
        risky = 0
        for r in rules:
            try:
                if classify(r).get("level") == "risky":
                    risky += 1
            except Exception:
                pass
        mcfg = d.mouse.get_config()
        midicfg = d.midimap.get_config()
        # KOŁO WYBORU — its own engine and its own file, so it is invisible in the mouse config.
        # Reported because "the button does nothing on a long press" has exactly two causes worth
        # naming: the group is off, or the wheel has no slices to choose between.
        try:
            wcfg = d.wheel.get_config()
        except Exception:
            wcfg = {}
        # SKANER — same reasoning as the wheel, one step further: for somebody who drives the
        # computer with one signal this module IS the keyboard and the mouse, so leaving it out of
        # the picture meant an assistant could not even see that it was the thing already set up.
        try:
            scfg = d.scan.get_config()
        except Exception:
            scfg = {}
        st = getattr(d.bus, "status", None) or {}
        info = getattr(d.bus, "device", None) or {}
        devices.append({
            "id": d.id, "slot": d.slot, "name": d.name, "label": d.label,
            "conn": st.get("conn"), "battery": info.get("battery"),
            "muted": bool(d.muted), "armed": bool(d.trig.armed),
            # `paused` has to be here or the picture lies. Every group below can read as switched
            # on while the capsule sends absolutely nothing, and an assistant with no eyes would
            # then debug the mapping instead of the one flag that is stopping it. It is also the
            # first switch a human meets now: the "Cały kapsel" column of the dashboard's
            # „Moduły" matrix. See reference.deviceFlags for what it does and does not cut.
            "paused": bool(d.paused),
            # The SAME cut, decided by the capsule instead of by a person: it has been lying still
            # for power.autoPauseSec. Reported separately because it undoes ITSELF on the first
            # movement — telling a human "resume this capsule" when nothing is wrong except that it
            # is on the desk would be advice to fix a non-problem.
            "autoPaused": bool(getattr(d, "auto_paused", False)),
            "trigEnabled": bool(d.trig.enabled),
            # WHICH mapping layer this capsule is on. Without it, a rule with layer 1..4 reads as
            # simply not working: it is enabled, the group is on, the condition is met, and it
            # still never fires — because the capsule is listening to another layer.
            "activeLayer": int(getattr(d.trig, "layer", 1) or 1),
            "ruleCount": len(rules), "riskyRuleCount": risky,
            "mouseEnabled": bool(mcfg.get("enabled")), "mouseMode": mcfg.get("mode"),
            # WHICH controller this capsule's `pad:` mappings and its stick reach — a pad id,
            # or "off" for a capsule deliberately plugged into none. Without it "pad:a does
            # nothing" has no visible cause.
            "padShare": mcfg.get("padShare"),
            "wheelEnabled": bool(wcfg.get("enabled")),
            "wheelSlices": len(wcfg.get("slices") or []),
            "wheelConfirm": wcfg.get("confirm"),
            "scanEnabled": bool(scfg.get("enabled")),
            "scanMode": scfg.get("tryb"),
            "scanSet": scfg.get("configName") or "",
            # Which scanner signals this capsule's rules actually carry. A scanner switched on
            # with nothing on 'sygnal' looks identical to a working one from every other angle.
            "scanSignals": _scan_signals_in(rules),
            "midiEnabled": bool(midicfg.get("enabled")),
            "oscEnabled": bool(midicfg.get("oscEnabled")),
            "mappingCount": len(midicfg.get("mappings") or []),
        })
    me = dm.midi_emitter
    oe = dm.osc_emitter
    ports = []
    if me:
        try:
            ports = [{"i": i, "name": nm} for i, nm in me.list_ports()]
        except Exception:
            ports = []
    # The virtual controllers, from the same registry the dashboard's Kontroler strip is drawn
    # from. A capsule's `padShare` is only half an answer — it names a pad id, and without the
    # registry there is no way to learn what kind of device that id is, who else is plugged into
    # it, or whether anything is listening. Read through ctx["dm"]: this module must never import
    # the monitor (it is imported BY it, so the other direction is a cycle).
    pads = {}
    try:
        pads = dm.pads_state() or {}
    except Exception:
        pads = {}
    # Whether ViGEmBus + the vgamepad module are actually reachable. Same question the motion
    # panel asks, asked of the first capsule that can answer it: without the driver the x360 and
    # ds4 kinds cannot be built at all, and "pad:a reports a failed send" has exactly one cause.
    pad_driver = None
    for d in dm.all():
        gp = getattr(getattr(d, "mouse", None), "gp", None)
        if gp is None or not hasattr(gp, "importable"):
            continue
        try:
            pad_driver = bool(gp.importable())
            break
        except Exception:
            pass
    return {
        "ok": True,
        # `sendKeys` answers the one question the mode does NOT: simulation sends for real, so
        # "simulate" says nothing about whether a keystroke will land. The launch flag --no-keys
        # is what withholds the keyboard and mouse, and it does so by building no emitter at all -
        # which is exactly what `d.out is None` means. Derived from dm rather than injected,
        # because ctx already carries everything needed to answer it.
        "app": {"name": SERVER_TITLE, "version": ctx.get("version") or "1.0",
                "mode": "simulate" if ctx.get("simulate") else "real",
                "sendKeys": any(getattr(d, "out", None) is not None for d in dm.all()),
                # Moduły, które w tym uruchomieniu nie wstały (--disable / --only). Ich narzędzia
                # odmawiają zapisu, a ich części zestawu zapisują się, ale nie działają do restartu.
                "modulesOff": _modules_off(ctx)},
        "masterArmed": bool(dm.master_armed),
        "defaultDev": dm.default_id,
        "devices": devices,
        "midi": {"avail": bool(me), "active": bool(me and me.active),
                 "port": (me.port if me else -1), "ports": ports},
        "osc": {"avail": bool(oe), "host": (oe.host if oe else None),
                "port": (oe.port if oe else None)},
        "pads": {
            "list": pads.get("pads") or [],
            "max": pads.get("max"),
            # Capsules plugged into NO controller. Sent as its own list rather than left to be
            # worked out by subtraction, for the same reason the dashboard gets it that way: a
            # capsule missing from every pad could equally mean "unplugged on purpose" and "the
            # registry has not arrived yet", and those two must not look alike.
            "free": pads.get("free") or [],
            "kinds": pads.get("kinds") or [],
            "driverAvail": pad_driver,
            "note": (
                "Virtual controllers this machine is holding. Each entry has an id (what a "
                "capsule's mouse.padShare points at), a name, a 1-based num, a kind "
                "('x360' | 'ds4' | 'wii' - see reference.keySpec.padNote), 'caps' (the capsules "
                "plugged into it; two on one pad is ONE player using both hands), 'motion' and "
                "'canMotion' (whether it carries gyro at all), and 'active' - which means the "
                "device is really UP: for x360/ds4 that ViGEmBus has been asked to build it and "
                "is holding it, for wii that the DSU server is listening. Pads are built lazily, "
                "on the first thing sent to them, so active=false on a fresh pad means 'nothing "
                "has needed it yet', NOT that it is broken; and for a wii pad it says nothing "
                "about whether an emulator has connected (that is dsuClients). A 'wii' pad also "
                "reports its DSU port and how many emulators are listening. 'free' lists the "
                "capsules on no pad at all, 'kinds' what this build can create, and "
                "'driverAvail' whether ViGEmBus + vgamepad are reachable - false means the x360 "
                "and ds4 kinds cannot send anything. Pads are created and removed by the human "
                "in the dashboard's Kontroler tab; this server can move a capsule between "
                "existing pads with apply_setup {mouse:{padShare:'<id>'}}."
            ),
        },
        "setups": _fn(ctx, "list_setups")(),
        # Whether the app loads sets by itself when a game comes to the front, and what it can
        # see there right now. Belongs in the overview because it is the one thing that can
        # change the whole configuration with nobody touching anything: without it, "the mapping
        # is not what I left it as" has an invisible cause. Read through a soft lookup so an
        # older monitor (one that does not provide the helper) simply reports nothing here.
        "gameSwitch": _gameswitch(ctx),
        # OBS Studio, driven from the "Uslugi sieciowe" tab over obs-websocket 5. Reported
        # because an OBS action that reaches nobody looks exactly like an action that is wrong:
        # both do nothing and both log an error nobody reads. connected=false means the socket is
        # not up at all; connected=true with identified=false means it is up and waiting for the
        # password digest, which only the browser can produce.
        "obs": _obs(ctx),
        # The scanner's window over the desktop. One window for the machine, not one per capsule,
        # and without it a scanner that is switched on draws and times nothing at all - which is
        # the single most common reason for "I turned it on and it does nothing".
        "scanWindowOpen": _scan_window_open(ctx),
        "hint": ("call get_mapping_reference before composing configs - and "
                 "get_accessibility_guide before composing one for somebody who has told you "
                 "what their body can and cannot do"),
    }


def _scan_window_open(ctx):
    f = (ctx.get("fn") or {}).get("scan_window_is_open")
    if f is None:
        return None
    try:
        return bool(f())
    except Exception:
        return None


def _obs(ctx):
    f = (ctx.get("fn") or {}).get("obs_state")
    if f is None:
        return None                     # older monitor: say nothing rather than guess "off"
    try:
        st = f()
    except Exception:
        return None
    if not isinstance(st, dict):
        return None
    return {
        "connected": bool(st.get("connected")),
        "identified": bool(st.get("identified")),
        "host": st.get("host") or "",
        "port": int(st.get("port") or 0),
        "obsVersion": st.get("obsVersion") or None,
        "note": (
            "The OBS Studio link of the 'Uslugi sieciowe' tab (obs-websocket 5). The socket is "
            "held by the app, not by the browser, and it is opened by hand in the OBS card of "
            "that tab - nothing reconnects on its own. An application in that tab with "
            "transport='ws' sends its actions through this link, so with connected=false every "
            "one of them fails with 'Nie połączono z OBS' no matter how correct it is."
        ),
    }


def _gameswitch(ctx):
    f = (ctx.get("fn") or {}).get("gameswitch_state")
    if f is None:
        return None
    try:
        st = f()
    except Exception:
        return None
    if not isinstance(st, dict):
        return None
    return dict(st, note=(
        "Auto sets by game. When 'enabled', a background thread reads which window Windows has "
        "in front and loads the set that names that process in its envelope field 'exe' (a list "
        "of process names, e.g. ['eldenring.exe']). 'lastExe' is what it last settled on - null "
        "means it has seen nothing yet, or the feature is off (it does not poll while off). Two "
        "or more sets claiming the same program is a QUESTION: the app asks in the dashboard and "
        "never picks for the user, unless a default was remembered for that program "
        "('defaultsCount' says how many are). Loading a set this way changes configuration only "
        "- it never arms an output group, exactly like every other way of loading one. "
        "'supported' is false off Windows, where there is no foreground to read."
    ))


def _t_get_mapping_reference(ctx, args):
    return {"ok": True, "reference": MAPPING_REFERENCE}


def _t_get_setup(ctx, args):
    analyze = _fn(ctx, "analyze_config")
    name = args.get("name")
    if isinstance(name, str) and name.strip():
        env = _fn(ctx, "load_setup")(name)
        if not env:
            raise ToolError("no saved Setup named %r (see get_overview.setups)" % (name,))
        cfg = _cfg_of(env) if isinstance(env, dict) else {}
        if not isinstance(cfg, dict):
            cfg = {}
        return {"ok": True, "source": "file", "name": name, "setup": env,
                "analysis": analyze(cfg)}
    d = _dev(ctx, args)
    env = _fn(ctx, "setup_envelope")(d)
    return {"ok": True, "source": "live", "dev": d.id, "device": d.meta_dict(),
            "setup": env, "analysis": analyze(env.get("config") or {})}


def _t_analyze_setup(ctx, args):
    cfg = args.get("config")
    if not isinstance(cfg, dict):
        raise ToolError("'config' must be an object")
    cfg = _cfg_of(cfg)
    if not isinstance(cfg, dict):
        raise ToolError("'config' must be an object")
    res = _fn(ctx, "analyze_config")(cfg)
    out = {"ok": True, "applied": False, "analysis": res,
           "note": ("mode='safe' would drop %d of %d rules" % (res.get("riskyCount", 0),
                                                               res.get("ruleCount", 0)))}
    mo = _setup_mods_off(ctx, cfg)
    if mo:
        out["modulesOff"] = mo
        out["warning"] = _mods_off_note(mo)
    return out


def _t_apply_setup(ctx, args):
    cfg = args.get("config")
    name = args.get("name")
    has_cfg = isinstance(cfg, dict)
    has_name = isinstance(name, str) and bool(name.strip())
    if has_cfg == has_name:
        raise ToolError("provide exactly one of 'config' or 'name'")
    if has_name:
        env = _fn(ctx, "load_setup")(name)
        if not env:
            raise ToolError("no saved Setup named %r (see get_overview.setups)" % (name,))
        cfg = _cfg_of(env)
    else:
        cfg = _cfg_of(cfg)
    if not isinstance(cfg, dict):
        raise ToolError("the setup carries no usable config object")
    mode = _mode(args, ctx)
    d = _dev(ctx, args)
    analysis = _fn(ctx, "analyze_config")(cfg)
    res = _fn(ctx, "apply_setup")(d, cfg, ctx.get("b"), mode)
    applied = res.get("applied") or []
    if not applied:
        # apply_setup returns an empty list for garbage input — that is a failure, not a no-op
        raise ToolError("nothing was applied - the config has no recognised group "
                        "(expected any of: rules, trigEnabled, mouse, midi, pose, power)")
    dropped = int(res.get("droppedRisky") or 0)
    _note_action(ctx, d.id, "apply_setup")
    kept = res.get("switchesKept") or []
    out = {"ok": True, "dev": d.id, "mode": mode, "applied": applied,
           "droppedRisky": dropped, "analysis": analysis, "switchesKept": kept,
           "switchesOn": res.get("switchesOn") or [],   # the subset the reader may switch on
           "source": ("library:" + name) if has_name else "inline"}
    if kept:
        # An assistant that does not know this will report "done" while the user sees nothing move.
        out["note"] = ("a setup never flips a group switch: %s stayed as the user left it. "
                       "Say so instead of claiming the setup is live." % ", ".join(kept))
    if dropped:
        out["warning"] = ("%d risky rule(s) were dropped in safe mode; ask the user whether they "
                          "want them, and only retry with mode='advanced' if they consent" % dropped)
    mo = res.get("modulesOff") or []
    if mo:
        out["modulesOff"] = mo
        out["modulesOffNote"] = _mods_off_note(mo)
    return out


def _t_set_rules(ctx, args):
    rules = args.get("rules")
    if not isinstance(rules, list):
        raise ToolError("'rules' must be an array (send [] to clear all rules)")
    mode = _mode(args, ctx)
    d = _dev(ctx, args)
    classify = _fn(ctx, "classify_rule")
    clean = _fn(ctx, "sanitize_rules")(rules)
    dropped = 0
    if mode == "safe":
        before = len(clean)
        clean = [r for r in clean if classify(r).get("level") == "safe"]
        dropped = before - len(clean)
    if args.get("append"):
        # Upsert, not concatenate: a client retrying after a timeout would otherwise duplicate
        # ids, and two rules sharing an id share edge/glow state and break `source.kind:"trigger"`
        # references. Re-sending the same call is now idempotent.
        incoming = {r.get("id") for r in clean}
        final = [r for r in d.trig.snapshot_rules() if r.get("id") not in incoming] + clean
    else:
        final = clean
    d.trig.set_rules(final)
    saved = _fn(ctx, "save_rules")(final, d.id, d.trig.enabled, d.trig.layer)
    b = ctx.get("b")
    if b is not None:
        # same event the POST /rules endpoint publishes -> open dashboards refresh live
        b.publish({"t": "rules", "ts": b.now(), "dev": d.id,
                   "rules": final, "armed": d.trig.armed,
                   "activeLayer": d.trig.layer})
    _note_action(ctx, d.id, "set_rules")
    out = {"ok": True, "dev": d.id, "count": len(final), "droppedRisky": dropped,
           "appended": bool(args.get("append")), "mode": mode,
           "rules": [_rule_verdict(ctx, r) for r in final]}
    if saved is False:
        out["saved"] = False
        out["saveError"] = ("the rules are active now but could not be written to Settings/ "
                            "(read-only folder or full disk); they will be gone after a restart")
    if dropped:
        out["warning"] = ("%d risky rule(s) were dropped in safe mode; ask the user before "
                          "retrying with mode='advanced'" % dropped)
    # Reguły `pad:` / `scan:` przy wyłączonym Kontrolerze albo Skanerze zapisują się (wrócą po
    # restarcie), ale teraz nic nie zrobią — tak samo, jak mówi o nich panel Mapowania.
    mo = _setup_mods_off(ctx, {"rules": final})
    if mo:
        out["modulesOff"] = mo
        out["modulesOffNote"] = _mods_off_note(mo)
    return out


def _t_save_setup(ctx, args):
    name = args.get("name")
    if not isinstance(name, str) or not name.strip():
        raise ToolError("'name' is required")
    safe_name = _fn(ctx, "safe_profile_name")(name)
    if not safe_name:
        raise ToolError("name %r has no usable characters (allowed: letters, digits, space, _-())"
                        % (name,))
    # NEVER OVER AN EXISTING SETUP. The library is the person's: a file of theirs replaced by the
    # assistant is lost without anybody having said yes, and a built-in shadowed by a file of the
    # same name would load the assistant's rules when they pick the original. A taken name gets
    # the first free " (n)" suffix instead, and the answer says so.
    requested = safe_name
    taken = {str(n).casefold() for n in (_fn(ctx, "list_setups")() or [])}
    if safe_name.casefold() in taken:
        free = None
        for n in range(2, 100):
            suffix = " (%d)" % n
            cand = _fn(ctx, "safe_profile_name")(safe_name[:60 - len(suffix)].rstrip() + suffix)
            if cand and cand.casefold() not in taken:
                free = cand
                break
        if not free:
            raise ToolError("a Setup named %r already exists and no free variant of the name was "
                            "found; pick another name (existing Setups are never overwritten)"
                            % (safe_name,))
        safe_name = free
    cfg = args.get("config")
    desc = str(args.get("description") or "")[:400]
    for_app = str(args.get("forApp") or "")[:80]
    if isinstance(cfg, dict):
        cfg = _cfg_of(cfg)
        if not isinstance(cfg, dict):
            raise ToolError("'config' must be an object")
        # Same envelope shape as POST /setup/save. Rules are sanitized here so the file on disk
        # is already clean; the other groups are normalised by apply_setup on load.
        out_cfg = dict(cfg)
        if isinstance(out_cfg.get("rules"), list):
            out_cfg["rules"] = _fn(ctx, "sanitize_rules")(out_cfg["rules"])
        env = {"app": "ribbitflip", "kind": "setup", "version": 1,
               "name": safe_name, "description": desc, "forApp": for_app, "author": "mcp",
               "cassette": _cassette_arg(ctx, args.get("cassette")),
               "config": out_cfg}
        dev_id = None
    else:
        d = _dev(ctx, args)
        env = _fn(ctx, "setup_envelope")(d, safe_name, desc, for_app, "mcp",
                                         cassette=args.get("cassette"))
        dev_id = d.id
    # Provenance the server reads back (setup_trust_mode): a Setup written here is loaded like a
    # stranger's file, in safe mode, also from the person's own library and by the game switcher.
    env["source"] = "mcp"
    ok = _fn(ctx, "save_setup")(safe_name, env)
    if not ok:
        raise ToolError("could not write the Setup file (check the Library/Setups/ folder)")
    _note_action(ctx, dev_id, "save_setup")
    out = {"ok": True, "name": safe_name, "dev": dev_id,
           "analysis": _fn(ctx, "analyze_config")(env.get("config") or {}),
           "setups": _fn(ctx, "list_setups")(),
           "note": ("saved with source='mcp': loading it from the library applies it in safe mode "
                    "(risky rules are dropped)")}
    if safe_name != requested:
        out["requestedName"] = requested
        out["warning"] = ("a Setup named %r already exists and was left untouched; this one was "
                          "saved as %r" % (requested, safe_name))
    return out


def _t_set_output(ctx, args):
    dm = ctx["dm"]
    # Sprawdzone PRZED czymkolwiek: odmowa po przestawieniu `master` zostawiłaby połowę zmian.
    if "midiPort" in args:
        _require_module(ctx, "midi", "set_output midiPort")
    if "oscHost" in args or "oscPort" in args:
        _require_module(ctx, "osc", "set_output oscHost/oscPort")
    if args.get("master") is True and not dm.master_armed:
        _require_consent(ctx, "set_output(master=true)")
    changed = {}
    if "master" in args:
        changed["master"] = dm.set_master_armed(bool(args.get("master")))
    if "midiPort" in args:
        try:
            idx = int(args.get("midiPort"))
        except Exception:
            raise ToolError("'midiPort' must be an integer (-1 closes the port)")
        changed["midi"] = dm.set_midi_port(idx)
    if "oscHost" in args or "oscPort" in args:
        oe = dm.osc_emitter
        host = args.get("oscHost") or (oe.host if oe else "127.0.0.1")
        port = args.get("oscPort", oe.port if oe else 9000)
        changed["osc"] = dm.set_osc_target(host, port)
    if changed:
        _note_action(ctx, dm.default_id, "set_output")
    me = dm.midi_emitter
    oe = dm.osc_emitter
    return {"ok": True, "changed": changed,
            "masterArmed": bool(dm.master_armed),
            "midi": {"avail": bool(me), "active": bool(me and me.active),
                     "port": (me.port if me else -1)},
            "osc": {"avail": bool(oe), "host": (oe.host if oe else None),
                    "port": (oe.port if oe else None)},
            "note": ("output is ARMED - motion now sends real input to the system"
                     if dm.master_armed else "output is disarmed - nothing reaches the system")}


# ============================================================================
#  MODULES OUTSIDE THE SETUP — the screen scanner and the wheel.
#
#  Both have their own file, their own engine and their own switch, so apply_setup neither reads
#  nor writes them. Until 2026-09-13 that also meant an assistant could not set them AT ALL, which
#  was worst exactly where it hurt most: these two are the answer to "I cannot press buttons" and
#  "I cannot aim", and the only thing the model could do was describe them and ask somebody else
#  to click. They are written here the same way the dashboard writes them (same sanitizers, same
#  persistence, same simulation rule for the group switch), so a file on disk looks identical
#  whoever wrote it.
# ============================================================================

_MODULES = ("scan", "wheel")


def _fn_opt(ctx, name):
    """Like _fn, but for helpers a READ can live without (an older monitor, a stub in a test)."""
    return (ctx.get("fn") or {}).get(name)


def _cassette_arg(ctx, v):
    """Kaseta zestawu 1-8 przez sanityzator monitora; bez niego (atrapa w teście) kaseta 1."""
    f = _fn_opt(ctx, "sanitize_cassette")
    try:
        return int(f(v)) if f else 1
    except Exception:
        return 1


def _modules_off(ctx):
    """Lista modułów wyłączonych przy starcie; [] od starszego monitora albo atrapy w teście."""
    f = _fn_opt(ctx, "modules_off")
    try:
        return list(f()) if f else []
    except Exception:
        return []


def _module_off_msg(ctx, mid):
    """(pl, en), gdy moduł `mid` wyłączono przy starcie (--disable / --only), inaczej None.
    Monitor bez tego pomocnika (starszy, atrapa w teście) = wszystko włączone, jak dotąd."""
    on = _fn_opt(ctx, "module_on")
    if on is None or on(mid):
        return None
    msg = _fn_opt(ctx, "module_off_message")
    if msg is None:
        return ("Moduł „%s” wyłączono przy starcie aplikacji." % mid,
                "The %s module was switched off when the app started." % mid)
    return msg(mid)


def _require_module(ctx, mid, what):
    """Odmowa zapisu dla modułu, który w tym uruchomieniu nie wstał. Cichy zapis byłby gorszy:
    asystent zgłosiłby „gotowe”, a silnik bez wątku nigdy by tego nie użył."""
    off = _module_off_msg(ctx, mid)
    if off:
        raise ToolError("%s refused, module '%s' is off: %s Nothing was written. (PL: %s)"
                        % (what, mid, off[1], off[0]))


def _setup_mods_off(ctx, cfg):
    f = _fn_opt(ctx, "setup_modules_off")
    try:
        return f(cfg) if f else []
    except Exception:
        return []


def _mods_off_note(lst):
    """Jedno zdanie dla asystenta o częściach zestawu, które zapiszą się, ale nie zadziałają."""
    if not lst:
        return ""
    return ("parts of this config belong to modules switched off at start (%s): they are saved, "
            "but will not work until the app is restarted without --disable / --only. Tell the "
            "user instead of claiming they work." % ", ".join(m.get("module", "?") for m in lst))


def _module_arg(args):
    m = args.get("module")
    if m not in _MODULES:
        raise ToolError("'module' must be one of: %s (got %r)" % (", ".join(_MODULES), m))
    return m


def _scan_signals_in(rules):
    """Which scanner signals the capsule's ENABLED rules carry: {'sygnal': 1, 'stop': 1}.

    Counted rather than just listed: two rules on 'sygnal' is a real setup (a tap and a lean, so
    a tired hand has a second way), while zero is a scanner nobody can drive."""
    out = {}
    for r in rules or []:
        if not isinstance(r, dict) or r.get("enabled") is False:
            continue
        ks = str(r.get("keySpec") or "").strip().lower()
        if ks.startswith("scan:"):
            co = ks[5:].strip()
            out[co] = out.get(co, 0) + 1
    return out


# Moduł aplikacji (APP_MODULES w monitorze) za każdym `module` tych dwóch narzędzi.
_MODULE_APP_ID = {"wheel": "kolo", "scan": "skaner"}


def _t_get_module_config(ctx, args):
    mod = _module_arg(args)
    d = _dev(ctx, args)
    # Czytanie zostaje (konfiguracja leży w pliku i wróci po restarcie), ale odpowiedź mówi wprost,
    # że w tym uruchomieniu moduł nie działa — inaczej asystent tłumaczyłby ustawienia martwego silnika.
    _off = _module_off_msg(ctx, _MODULE_APP_ID[mod])
    _off_note = ({"moduleOff": _off[1] + " (PL: " + _off[0] + ")"} if _off else {})
    if mod == "wheel":
        presets = []
        getp = _fn_opt(ctx, "wheel_presets")
        if getp:
            try:
                for p in (getp() or []):
                    cfg = p.get("config") or {}
                    presets.append({"name": p.get("name"), "category": p.get("category"),
                                    "desc": p.get("desc"),
                                    "slices": len(cfg.get("slices") or [])})
            except Exception:
                presets = []
        return {"ok": True, "module": "wheel", "dev": d.id, **_off_note,
                "config": d.wheel.get_config(), "presets": presets,
                "note": ("A saved wheel carries its slices and timings but NOT the switch, where "
                         "it is drawn or its name - those belong to the capsule. See "
                         "reference.wheel; 'cycle' and 'tilt-hold' are the modes for somebody who "
                         "cannot aim or cannot press.")}
    cfg = d.scan.get_config()
    presets = []
    getp = _fn_opt(ctx, "scan_preset_items")
    if getp:
        try:
            for p in (getp() or []):
                presets.append({"name": p.get("name"), "desc": p.get("desc")})
        except Exception:
            presets = []
    isopen = _fn_opt(ctx, "scan_window_is_open")
    try:
        window_open = bool(isopen()) if isopen else None
    except Exception:
        window_open = None
    signals = _scan_signals_in(d.trig.snapshot_rules())
    dm = ctx["dm"]
    missing = []
    if cfg.get("enabled"):
        if not signals.get("sygnal"):
            missing.append("no enabled rule carries 'scan:sygnal' - nothing can stop the bar")
        if not signals.get("stop"):
            missing.append("no enabled rule carries 'scan:stop' - there is no way out")
        if not window_open:
            missing.append("the window over the desktop is not open (set_module_config "
                           "window:'open'), so nothing is drawn or timed")
        if not dm.master_armed:
            missing.append("master arm is off - the bar sweeps but the click never goes out "
                           "(which is exactly what you want while somebody is practising)")
    return {"ok": True, "module": "scan", "dev": d.id, **_off_note, "config": cfg, "presets": presets,
            "windowOpen": window_open, "signalsInRules": signals,
            "masterArmed": bool(dm.master_armed), "blocking": missing,
            # Ta sama konfiguracja opowiedziana planszami: co jest na ekranie, jaki prostokąt
            # i który skaner gdzie pracuje. `config` niesie czterdzieści pokręteł i nie da się
            # z niego odczytać jednym spojrzeniem, że skaner „Opcje" nie stoi na żadnej planszy.
            "layout": _scan_layout_out(cfg),
            "note": ("The engine is a PAGE, not the server: see reference.scan.theWholeChain for "
                     "the five things that all have to be true. 'layout' is the same config told "
                     "as screens; write it back with set_scanner_layout, not with 'config'.")}


def _t_set_module_config(ctx, args):
    mod = _module_arg(args)
    _require_module(ctx, _MODULE_APP_ID[mod], "set_module_config")
    d = _dev(ctx, args)
    dm = ctx["dm"]
    cfg_in = args.get("config")
    if cfg_in is not None and not isinstance(cfg_in, dict):
        raise ToolError("'config' must be an object")
    preset = args.get("preset")
    preset = preset.strip() if isinstance(preset, str) else ""
    win = args.get("window")
    if win is not None and (mod != "scan" or win not in ("open", "close")):
        raise ToolError("'window' is 'open' or 'close' and only applies to module='scan'")
    changed, warnings = [], []
    # Włączenie modułu, który teraz stoi wyłączony, wymaga zgody (patrz _require_consent) — także
    # przemycone w `config`, bo obie ścieżki trafiają do tego samego `enabled`.
    want_on = args.get("enabled") is True or (isinstance(cfg_in, dict) and cfg_in.get("enabled") is True)
    is_on = bool(d.wheel.get_config().get("enabled")) if mod == "wheel" else bool(d.scan.enabled)
    if want_on and not is_on:
        _require_consent(ctx, "set_module_config(enabled=true)")

    if mod == "wheel":
        was_on = bool(d.wheel.get_config().get("enabled"))
        if preset:
            got = None
            for p in (_fn(ctx, "wheel_presets")() or []):
                if str(p.get("name") or "").strip().lower() == preset.lower():
                    got = p
                    break
            if got is None:
                raise ToolError("no saved wheel named %r (see get_module_config presets)" % preset)
            # The switch, the place it is drawn and the name belong to the CAPSULE, so a preset
            # carries none of them (sanitize_wheel_preset drops all three) — merge over what is
            # there instead of replacing, or loading a wheel would silently move somebody's.
            merged = dict(d.wheel.get_config())
            merged.update(got.get("config") or {})
            merged["configName"] = got.get("name") or merged.get("configName") or ""
            d.wheel.set_config(merged)
            changed.append("preset:" + preset)
        if cfg_in:
            merged = dict(d.wheel.get_config())
            merged.update(cfg_in)
            d.wheel.set_config(merged)
            changed.append("config")
        was_where = None
        if "enabled" in args:
            want = bool(args.get("enabled"))
            merged = dict(d.wheel.get_config())
            merged["enabled"] = want
            d.wheel.set_config(merged)
            changed.append("enabled")
            if want and not d.wheel.get_config().get("enabled"):
                warnings.append("the wheel needs at least two slices before its switch can go on")
        cfg = d.wheel.get_config()
        _fn(ctx, "save_wheel")(_fn(ctx, "sim_keep_switches")(dm, cfg, _fn(ctx, "load_wheel")(d.id),
                                                             ("enabled",)), d.id)
        # WHERE the wheel is drawn is half a word in a file and half a real window on the desktop.
        # The server owns the second half (the dashboard does not open it either), so a showWhere
        # that arrived in `config` has to be acted on here or the setting would be a lie.
        # The same goes for switching ON a wheel that lives in its own window: the emergency stop
        # closes that window (panic_stop), and nothing else would bring it back.
        if (cfg_in and "showWhere" in cfg_in) or (
                cfg.get("enabled") and not was_on
                and cfg.get("showWhere") in ("cursor", "both", "center")):
            applyw = _fn_opt(ctx, "wheel_apply_where")
            if applyw:
                try:
                    up, why = applyw(d.id, cfg.get("showWhere"),
                                     "http://127.0.0.1:%d/" % int(ctx.get("port") or 8770))
                    cfg = dict(cfg, cursorUp=up)
                    if why:
                        warnings.append(why)
                except Exception as e:
                    warnings.append("could not place the wheel's own window: %s" % e)
        _note_action(ctx, d.id, "set_module_config")
        out = {"ok": True, "module": "wheel", "dev": d.id, "changed": changed, "config": cfg}
        if warnings:
            out["warnings"] = warnings
        return out

    # --- scan ---------------------------------------------------------------
    if preset:
        applied = _fn(ctx, "apply_scan_preset")(d, preset)
        if applied is None:
            raise ToolError("no saved scanner set named %r (see get_module_config presets)"
                            % preset)
        changed.append("preset:" + preset)
    if cfg_in:
        # Merge, do not replace: ScanModule.sanitize fills every missing key from its DEFAULTS, so
        # sending {"predkosc": 500} on its own would quietly reset the other forty settings — and
        # the forty include the timings somebody spent an afternoon fitting to a person.
        merged = dict(d.scan.get_config())
        merged.update(cfg_in)
        # THE LISTS DO NOT COME IN THIS WAY, exactly as with POST /scan and for the same reason:
        # this call carries the KNOBS of one scanner, and a config that was read a minute ago
        # carries a list from a minute ago. Letting it through would quietly undo a view or a
        # scanner added meanwhile — the bug the panel already paid for on 2026-09-13. The lists
        # have one door: set_scanner_layout.
        teraz = d.scan.get_config()
        przemycone = [k for k in ("sekcje", "sekcjaAktywna", "zrzuty", "zrzutAktywny")
                      if k in cfg_in]
        for k in ("sekcje", "sekcjaAktywna", "zrzuty", "zrzutAktywny"):
            merged[k] = teraz.get(k)
        if przemycone:
            warnings.append("ignored %s - the list of scanners and the list of views are written "
                            "with set_scanner_layout, never as 'config'."
                            % ", ".join(sorted(przemycone)))
        d.scan.set_config(merged)
        changed.append("config")
    if "enabled" in args:
        d.scan.set_enabled(bool(args.get("enabled")))
        changed.append("enabled")
    cfg = d.scan.get_config()
    _fn(ctx, "save_scan")(_fn(ctx, "sim_keep_switches")(dm, cfg, _fn(ctx, "load_scan")(d.id),
                                                        ("enabled",)), d.id)
    window_open = None
    isopen = _fn_opt(ctx, "scan_window_is_open")
    if win == "close":
        closer = _fn(ctx, "scan_window_close")
        closer()
        window_open = False
        changed.append("window:close")
    elif win == "open":
        if not cfg.get("enabled"):
            # The same refusal as POST /scan/okno, and for the same reason: a window drawing a
            # scanner that is switched off is a window that does nothing.
            raise ToolError("switch the Skaner module on for this capsule first "
                            "(set_module_config {module:'scan', enabled:true})")
        ok, why = _fn(ctx, "scan_window_open")("http://127.0.0.1:%d"
                                               % int(ctx.get("port") or 8770), d.id)
        window_open = bool(ok)
        changed.append("window:open")
        if not ok:
            warnings.append(why or "could not open the window over the desktop")
    elif isopen:
        try:
            window_open = bool(isopen())
        except Exception:
            window_open = None
    signals = _scan_signals_in(d.trig.snapshot_rules())
    if cfg.get("enabled"):
        if not signals.get("sygnal"):
            warnings.append("nothing drives this scanner yet: no enabled rule carries "
                            "'scan:sygnal'. Write one with set_rules.")
        if not signals.get("stop"):
            warnings.append("there is no way to stop it: no enabled rule carries 'scan:stop'. "
                            "This is the one mapping that is not optional.")
        if not window_open:
            warnings.append("the window over the desktop is not open, so nothing is drawn "
                            "(window:'open').")
    _note_action(ctx, d.id, "set_module_config")
    out = {"ok": True, "module": "scan", "dev": d.id, "changed": changed, "config": cfg,
           "windowOpen": window_open, "signalsInRules": signals,
           "masterArmed": bool(dm.master_armed)}
    if warnings:
        out["warnings"] = warnings
    return out


# ============================================================================
#  SKANER ZE ZRZUTU EKRANU — plansze i skanery opisane z obrazka gry.
#
#  Osobne narzędzie, a nie kolejne pole `set_module_config`, i to z twardego powodu: POST /scan
#  wiezie POKRĘTŁA edytowanego skanera i SPIS IGNORUJE (patrz `ScanModule.sections_edit`), więc
#  sekcja albo plansza wysłana jako `config` ginie przy najbliższym ruchu suwaka. Tutaj wszystko
#  idzie tą samą drogą, co przyciski panelu: `sections_edit` / `screens_edit` / `set_config`.
# ============================================================================

# Pola skanera, które da się podać po ludzku — nazwa z narzędzia -> klucz konfiguracji.
_SCAN_FIELD = {
    "mode": "tryb", "grid": "siatka", "gridOrder": "cwiartkiKolejnosc",
    "afterGrid": "poCwiartkach", "levels": "poziomyMax", "axis": "kolejnosc",
    "passes": "przebiegi", "bandY": "pasmoY", "bandX": "pasmoX",
    "speed": "predkosc", "stepMs": "czasKroku",
}


def _scan_area_keys(area, w, h, nazwa, warnings):
    """Prostokąt z narzędzia -> klucze `obszar*`. Zwraca {} , gdy obszaru nie podano.

    ⭐ PIKSELE ZRZUTU IDĄ NA PROCENTY, gdy znamy rozdzielczość planszy. Zmierzyć da się tylko
    piksele — na obrazku nie ma innych jednostek — ale zapisany procent przeżyje zmianę monitora,
    a zapisany piksel nie. Gdy rozdzielczości nie znamy, zostaje piksel i mówimy o tym wprost:
    cicha zamiana na procenty z domyślnego 1920×1080 przesunęłaby obrys na innym ekranie."""
    if not isinstance(area, dict):
        return {}
    try:
        x1, y1 = float(area["x1"]), float(area["y1"])
        x2, y2 = float(area["x2"]), float(area["y2"])
    except (KeyError, TypeError, ValueError):
        raise ToolError("scanner %r: 'area' needs numbers x1, y1, x2, y2" % nazwa)
    x1, x2 = min(x1, x2), max(x1, x2)
    y1, y2 = min(y1, y2), max(y1, y2)
    if x2 - x1 <= 0 or y2 - y1 <= 0:
        raise ToolError("scanner %r: 'area' has no width or no height (x1,y1 is one corner, "
                        "x2,y2 the opposite one)" % nazwa)
    unit = str(area.get("unit") or "px").lower()
    if unit in ("percent", "procent", "%"):
        jednostka = "procent"
    elif w > 0 and h > 0:
        x1, x2 = x1 / w * 100.0, x2 / w * 100.0
        y1, y2 = y1 / h * 100.0, y2 / h * 100.0
        jednostka = "procent"
    else:
        jednostka = "piksele"
        warnings.append("scanner %r: the view has no resolution, so its rectangle was stored in "
                        "PIXELS of the screen. Give the view's 'width'/'height' (or an 'image' to "
                        "read them from) and it will be stored as percent, which survives a "
                        "change of monitor." % nazwa)
    if jednostka == "procent":
        x1, y1 = max(0.0, min(100.0, x1)), max(0.0, min(100.0, y1))
        x2, y2 = max(0.0, min(100.0, x2)), max(0.0, min(100.0, y2))
    return {"obszar": "wlasny", "obszarJednostka": jednostka,
            "obszarX1": round(x1, 2), "obszarY1": round(y1, 2),
            "obszarX2": round(x2, 2), "obszarY2": round(y2, 2)}


def _scan_scanner_keys(spec, w, h, warnings):
    """Jeden skaner z narzędzia -> płaskie klucze konfiguracji."""
    nazwa = str(spec.get("name") or "").strip()
    if not nazwa:
        raise ToolError("every scanner needs a 'name' - it is what the person reads in the bar")
    keys = {}
    for zew, wew in _SCAN_FIELD.items():
        if spec.get(zew) is not None:
            keys[wew] = spec[zew]
    if isinstance(spec.get("config"), dict):
        keys.update(spec["config"])
    keys.update(_scan_area_keys(spec.get("area"), w, h, nazwa, warnings))
    # Siatka 4x4 bez `poziomyMax:1` dzieli się dalej i pole przestaje być polem — a to jest
    # dokładnie ten błąd, po którym „skaner nie trafia w żeton". Sanityzator tego nie złapie:
    # obie wartości są prawidłowe osobno.
    if keys.get("tryb") == "cwiartki" and "poziomyMax" not in keys and spec.get("grid"):
        keys["poziomyMax"] = 1
        warnings.append("scanner %r: 'levels' was not given, so it is 1 - a grid you measured is "
                        "already the right size and halving it again would land between tiles."
                        % nazwa)
    return nazwa, keys


def _scan_layout_out(cfg):
    """Konfiguracja skanera opowiedziana planszami — to, co widać na ekranie, a nie 40 pokręteł."""
    sekcje = cfg.get("sekcje") or []
    def _obszar(s):
        if str(s.get("obszar")) != "wlasny":
            return {"whole": str(s.get("obszar") or "caly")}
        return {"unit": "percent" if s.get("obszarJednostka") == "procent" else "px",
                "x1": s.get("obszarX1"), "y1": s.get("obszarY1"),
                "x2": s.get("obszarX2"), "y2": s.get("obszarY2")}
    def _skaner(i, s):
        out = {"n": i + 1, "name": s.get("nazwa"), "mode": s.get("tryb"), "area": _obszar(s)}
        if s.get("tryb") == "cwiartki":
            out["grid"] = s.get("siatka")
            out["gridOrder"] = s.get("cwiartkiKolejnosc")
            out["levels"] = s.get("poziomyMax")
        else:
            out["axis"] = s.get("kolejnosc")
            out["passes"] = s.get("przebiegi")
        return out
    widoki = []
    for i, z in enumerate(cfg.get("zrzuty") or []):
        widoki.append({"n": i + 1, "name": z.get("nazwa"), "image": z.get("plik") or None,
                       "width": z.get("w") or 0, "height": z.get("h") or 0,
                       "scanners": [sekcje[n - 1].get("nazwa")
                                    for n in (z.get("sekcje") or []) if 1 <= n <= len(sekcje)]})
    wolne = [s.get("nazwa") for i, s in enumerate(sekcje)
             if not any((i + 1) in (z.get("sekcje") or []) for z in (cfg.get("zrzuty") or []))]
    out = {"views": widoki, "viewing": int(cfg.get("zrzutAktywny") or 0),
           "editing": int(cfg.get("sekcjaAktywna") or 1),
           "scanners": [_skaner(i, s) for i, s in enumerate(sekcje)],
           "testDesktop": {"width": cfg.get("szablonW") or 0, "height": cfg.get("szablonH") or 0}}
    if wolne:
        out["onNoView"] = wolne
    return out


def _t_set_scanner_layout(ctx, args):
    _require_module(ctx, "skaner", "set_scanner_layout")
    d = _dev(ctx, args)
    dm = ctx["dm"]
    views = args.get("views")
    if not isinstance(views, list) or not views:
        raise ToolError("'views' is the list of the game's screens and cannot be empty")
    replace = bool(args.get("replace"))
    warnings, changed = [], []

    def _cfg():
        return d.scan.get_config()

    def _idx_widoku(nazwa):
        n = nazwa.strip().lower()
        for i, z in enumerate(_cfg().get("zrzuty") or []):
            if str(z.get("nazwa") or "").strip().lower() == n:
                return i + 1
        return 0

    def _idx_skanera(nazwa):
        n = nazwa.strip().lower()
        for i, s in enumerate(_cfg().get("sekcje") or []):
            if str(s.get("nazwa") or "").strip().lower() == n:
                return i + 1
        return 0

    def _edit(fn, *a, **kw):
        cfg = fn(*a, **kw)
        if cfg is None:
            raise ToolError("the scanner refused that change (%s %r) - a name may be empty, or "
                            "the limit of 8 scanners / 8 views is reached" % (fn.__name__, a))
        return cfg

    # ⭐ PUSTA KONFIGURACJA MA JEDEN SKANER, KTÓREGO NIKT NIE ZAMAWIAŁ. Każdy plik skanera niesie
    # przynajmniej jedną sekcję (nie ma stanu „skaner bez sekcji"), więc bez tego opisanie układu
    # od zera zostawiałoby „Sekcja 1" na całym ekranie, przyklejoną do pierwszej planszy — obrys,
    # który w podglądzie wygląda jak pomyłka asystenta, bo nią jest. Pierwszy nazwany skaner
    # PRZEJMUJE tamten zamiast dokładać się obok.
    start = _cfg()
    adoptuj = len(start.get("sekcje") or []) == 1 and not (start.get("zrzuty") or [])

    chciane_widoki, chciane_skanery = [], []
    for v in views:
        if not isinstance(v, dict):
            raise ToolError("every entry of 'views' is an object with a 'name'")
        nazwa = str(v.get("name") or "").strip()
        if not nazwa:
            raise ToolError("every view needs a 'name' - it is the only label the person sees")
        chciane_widoki.append(nazwa.lower())
        plik, w, h = "", int(v.get("width") or 0), int(v.get("height") or 0)
        if v.get("image"):
            wczytaj = _fn_opt(ctx, "scan_zrzut_z_pliku")
            if not wczytaj:
                raise ToolError("this build cannot read a screenshot from disk; upload it in the "
                                "panel and call again with the view's 'width'/'height' only")
            plik, fw, fh, blad = wczytaj(v["image"], nazwa)
            if blad:
                raise ToolError("view %r: %s" % (nazwa, blad))
            # ROZMIAR Z PLIKU WYGRYWA z podanym, bo jest zmierzony. Podana liczba bywa tym, co
            # ktoś pamięta o swoim monitorze, a prostokąty mierzy się na TYM obrazku.
            if fw and fh:
                if w and h and (w, h) != (fw, fh):
                    warnings.append("view %r: the file is %dx%d, not the %dx%d you gave - the "
                                    "rectangles were converted using the file's size."
                                    % (nazwa, fw, fh, w, h))
                w, h = fw, fh

        i = _idx_widoku(nazwa)
        if not i:
            _edit(d.scan.screens_edit, "dodaj", nazwa=nazwa, plik=plik, w=w, h=h)
            i = _idx_widoku(nazwa) or int(_cfg().get("zrzutAktywny") or 0)
            changed.append("view+:" + nazwa)
        else:
            if plik:
                _edit(d.scan.screens_edit, "obraz", n=i, plik=plik, w=w, h=h)
                changed.append("view~image:" + nazwa)
            elif w and h:
                _edit(d.scan.screens_edit, "wymiar", n=i, w=w, h=h)
        # Wybranie planszy nie jest kosmetyką: `sections_edit("dodaj")` przypisuje nowy skaner do
        # WYBRANEJ planszy, więc bez tego wszystkie nowe skanery wylądowałyby na pierwszej.
        _edit(d.scan.screens_edit, "wybierz", n=i)

        for sp in (v.get("scanners") or []):
            if not isinstance(sp, dict):
                raise ToolError("view %r: every entry of 'scanners' is an object" % nazwa)
            sn, keys = _scan_scanner_keys(sp, w, h, warnings)
            chciane_skanery.append(sn.lower())
            s = _idx_skanera(sn)
            if not s and adoptuj:
                _edit(d.scan.sections_edit, "nazwij", n=1, nazwa=sn)
                s, adoptuj = 1, False
                # Ten skaner dostał planszę numer jeden od `screens_edit("dodaj")` — a należy do
                # tej, którą właśnie opisujemy. Zdejmujemy go więc z cudzej, zamiast zostawiać
                # ten sam obrys na dwóch widokach.
                for j, z in enumerate(_cfg().get("zrzuty") or []):
                    if j + 1 != i and 1 in (z.get("sekcje") or []):
                        _edit(d.scan.screens_edit, "przypisz", n=j + 1, sekcja=1, wlacz=False)
                changed.append("scanner+:" + sn)
            elif not s:
                _edit(d.scan.sections_edit, "dodaj", nazwa=sn)
                s = _idx_skanera(sn) or int(_cfg().get("sekcjaAktywna") or 1)
                changed.append("scanner+:" + sn)
            if keys:
                # Pokrętła pisze się przez sekcję AKTYWNĄ — płaskie pola konfiguracji SĄ nią.
                d.scan.activate_section(s)
                merged = dict(_cfg())
                merged.update(keys)
                d.scan.set_config(merged)
                changed.append("scanner~:" + sn)
            _edit(d.scan.screens_edit, "przypisz", n=i, sekcja=s, wlacz=True)

    if replace:
        # KASOWANIE NA KOŃCU I PO NAZWACH: każde usunięcie przenumerowuje resztę, więc indeks
        # policzony wcześniej wskazywałby po nim na cudzy wiersz.
        for z in list(_cfg().get("zrzuty") or []):
            zn = str(z.get("nazwa") or "").strip()
            if zn.lower() not in chciane_widoki:
                i = _idx_widoku(zn)
                if i and d.scan.screens_edit("usun", n=i) is not None:
                    changed.append("view-:" + zn)
        for s in list(_cfg().get("sekcje") or []):
            sn = str(s.get("nazwa") or "").strip()
            if sn.lower() not in chciane_skanery:
                i = _idx_skanera(sn)
                if i and d.scan.sections_edit("usun", n=i) is not None:
                    changed.append("scanner-:" + sn)
                elif i:
                    warnings.append("the last scanner cannot be removed (%r stays) - a scanner "
                                    "with no scanner has nothing to show." % sn)

    td = args.get("testDesktop")
    if isinstance(td, dict):
        _edit(d.scan.screens_edit, "wymiar", n=0,
              w=int(td.get("width") or 0), h=int(td.get("height") or 0))
        changed.append("testDesktop")

    cfg = _cfg()
    _fn(ctx, "save_scan")(_fn(ctx, "sim_keep_switches")(dm, cfg, _fn(ctx, "load_scan")(d.id),
                                                        ("enabled",)), d.id)
    signals = _scan_signals_in(d.trig.snapshot_rules())
    if not signals.get("sygnal"):
        warnings.append("nothing drives this scanner yet: no enabled rule carries 'scan:sygnal'. "
                        "Write one with set_rules.")
    if not signals.get("stop"):
        warnings.append("there is no way to stop it: no enabled rule carries 'scan:stop'. This is "
                        "the one mapping that is not optional.")
    if len(cfg.get("sekcje") or []) > 1 and not any(
            str(r.get("keySpec") or "").lower().startswith("scan:sekcja")
            for r in (d.trig.snapshot_rules() or [])):
        warnings.append("this configuration now has several scanners but no rule carries "
                        "'scan:sekcja=nast', so the person can only ever reach the first one.")
    if not cfg.get("enabled"):
        warnings.append("the Skaner module is still off on this capsule - switching it on is the "
                        "person's decision (set_module_config {module:'scan', enabled:true}), and "
                        "the bar is only drawn once a page is up (window:'open').")
    _note_action(ctx, d.id, "set_scanner_layout")
    out = {"ok": True, "dev": d.id, "changed": changed, "layout": _scan_layout_out(cfg)}
    if warnings:
        out["warnings"] = warnings
    return out


# ============================================================================
#  DOSTĘPNOŚĆ — the guide, and the check that holds a scheme up against a person.
# ============================================================================

def _t_get_accessibility_guide(ctx, args):
    return {"ok": True, "guide": ACCESSIBILITY}


_ANGLE_METRICS = ("tilt", "pitch", "roll")
_A11Y_ASKED = ("signals", "canHold", "canRepeatFast", "tremor", "rangeDeg", "steersPointer",
               "stopGesture")


def _num(v):
    try:
        return float(v)
    except Exception:
        return None


def _rule_signature(r):
    """What MOVEMENT a rule asks for, so two rules on the same one are not counted twice.

    A lean left and a lean right are two different movements; two rules both firing on 'lean
    right past 25 degrees' are one. That number is the whole budget when somebody has two."""
    src = (r.get("source") or {}) if isinstance(r, dict) else {}
    kind = src.get("kind")
    if kind == "button":
        return "button:%s" % (src.get("any") and "any" or "%s.%s" % (src.get("byte"), src.get("bit")))
    if kind == "gesture":
        return "gesture:%s" % (str(src.get("desc") or "")[:24] or id(src))
    if kind == "axis":
        return "axis:%s:%s" % (src.get("channel"), "+" if (_num(r.get("threshold")) or 0) >= 0 else "-")
    if kind == "filter":
        thr = _num(r.get("threshold")) or 0.0
        cmp_ = str(r.get("cmp") or ">")
        side = "+" if (thr > 0 or cmp_ in (">", ">=")) else "-"
        return "filter:%s:%s" % (src.get("metric"), side)
    if kind == "trigger":
        return None          # rides on another rule's movement; costs nothing extra
    return "other"


def _a11y_check(ability, cfg, wheel, scan, rules, armed):
    """The deterministic half of fitting a scheme to a person. Findings, not a score.

    Every finding names WHERE it is, WHAT it asks of the body and WHAT to do instead, because a
    warning somebody cannot act on is noise. Levels: 'mismatch' = this asks for something the
    person said they do not have; 'check' = likely wrong, ask them; 'tip' = a better fit exists."""
    out = []

    def add(level, where, what, fix):
        out.append({"level": level, "where": where, "what": what, "fix": fix})

    a = ability if isinstance(ability, dict) else {}
    can_hold = a.get("canHold")
    can_fast = a.get("canRepeatFast")
    tremor = a.get("tremor") is True
    range_deg = _num(a.get("rangeDeg"))
    signals = _num(a.get("signals"))
    steers = a.get("steersPointer")
    reaction = _num(a.get("reactionMs"))
    tires = a.get("tires") is True
    sight = str(a.get("sight") or "")
    mount = str(a.get("mount") or "")
    stop_gesture = str(a.get("stopGesture") or "").strip()

    cfg = cfg if isinstance(cfg, dict) else {}
    mouse = cfg.get("mouse") if isinstance(cfg.get("mouse"), dict) else {}
    power = cfg.get("power") if isinstance(cfg.get("power"), dict) else {}
    wheel = wheel if isinstance(wheel, dict) else {}
    scan = scan if isinstance(scan, dict) else {}
    rules = [r for r in (rules or []) if isinstance(r, dict) and r.get("enabled") is not False]

    # --- rule by rule ----------------------------------------------------
    moves = set()
    stop_moves = set()        # movements spent on stopping, not on doing something
    for r in rules:
        who = "rule '%s'" % (r.get("label") or r.get("id") or "?")
        ks = str(r.get("keySpec") or "").strip().lower()
        beh = str(r.get("behavior") or "once")
        src = r.get("source") or {}
        metric = src.get("metric")
        thr = _num(r.get("threshold"))
        sig = _rule_signature(r)
        if sig:
            moves.add(sig)
            if ks == "scan:stop":
                stop_moves.add(sig)
        if beh == "hold" and can_hold is False and ks and not ks.startswith(("scan:",)):
            add("mismatch", who,
                "holds %s for as long as the movement lasts" % (ks or "the action"),
                "behavior 'latch' (one movement switches it on, the next off) or 'continuous'")
        if ks.startswith("layer:hold:") and can_hold is False:
            add("mismatch", who, "keeps a layer open only while the movement is held",
                "'layer:next' or 'layer:<n>', which stay switched")
        if beh == "multi":
            if can_fast is False:
                add("mismatch", who,
                    "needs %s crossings inside %s ms (a double tap)"
                    % (r.get("crossings") or 2, r.get("windowMs") or 600),
                    "behavior 'once' on a separate movement, or put the action on a wheel slice")
            elif tremor:
                add("check", who, "a double tap next to a tremor - the shake supplies the second "
                                  "crossing by itself",
                    "'dwell' with dwellMs 400-700, or 'once' with a wider threshold")
        if beh == "dwell" and reaction:
            dwell_ms = _num(r.get("dwellMs")) or 500.0
            if dwell_ms < reaction:
                add("check", who,
                    "fires after %d ms, which is inside their %d ms reaction time"
                    % (dwell_ms, reaction),
                    "dwellMs at least reaction + 300 ms")
        if src.get("kind") == "filter" and metric in _ANGLE_METRICS and thr is not None:
            if range_deg and abs(thr) > range_deg:
                add("mismatch", who,
                    "asks for %g deg of %s; they reach about %g" % (abs(thr), metric, range_deg),
                    "raise the gain instead of dropping the threshold: pose.axes.%s "
                    "{on:true, inHi:<what they reach>, outHi:<full scale>}" % metric)
            elif tremor and 0 < abs(thr) < 12:
                add("check", who, "a %g deg threshold with a tremor fires on its own" % abs(thr),
                    "pose.axes.%s smoothing + 'dead', then a threshold above 15 deg" % metric)
        if src.get("kind") == "gesture" and not (src.get("takes") or []):
            add("mismatch", who, "a recorded-gesture rule with no recording never fires",
                "the person records it in the rule editor - you cannot compose 'takes'")

    # THE STOP IS NOT ONE OF THE MOVEMENTS THEY SPEND. Counting it with the rest turned the one
    # scheme that is right for a person with a single signal - scanner plus a way out - into a
    # "mismatch", with advice to use a scanner they were already using. So it is counted apart:
    # over budget on the ACTIONS is a real mismatch, over budget only because of the stop is a
    # question for the human ("who stops it, then?").
    doing = moves - stop_moves
    if signals is not None and doing and len(doing) > signals:
        add("mismatch", "the scheme as a whole",
            "asks for %d distinct movements, the stop aside; they said %g" % (len(doing), signals),
            "spend movements on a scanner or a wheel instead of one action each, or use layers")
    elif signals is not None and stop_moves and len(moves) > signals:
        add("check", "the stop costs a movement",
            "the actions fit in the %g movement(s) they have, but stopping takes one more" % signals,
            "ask whether that second movement exists; if it does not, agree who else stops it - "
            "the emergency hotkey, disarming, or a person in the room")

    # --- motion control ---------------------------------------------------
    if mouse.get("enabled"):
        mode = mouse.get("mode") or "mouse"
        if mode == "mouse":
            if steers is False:
                add("check", "motion control (mouse)",
                    "steering a pointer is aiming, and they said they cannot aim",
                    "the screen scanner (module 'scan') spends time instead of aim")
            if not mouse.get("dwellOn") and signals == 0:
                add("mismatch", "motion control (mouse)",
                    "the pointer moves but nothing can click it",
                    "mouse.dwellOn true (click by standing still) - see reference.mouse dwellOn")
            if tremor and mouse.get("dwellOn"):
                if (_num(mouse.get("dwellRadius")) or 12) < 20:
                    add("tip", "motion control (dwell click)",
                        "dwellRadius is tight for a shaking hand, so the countdown keeps "
                        "restarting",
                        "dwellRadius 24-40 px before touching dwellMs")
            if tremor and (mouse.get("smoothMode") or "classic") != "oneeuro":
                add("tip", "motion control (mouse)", "no one-euro filter with a tremor",
                    "smoothMode 'oneeuro' (oeMinCutoff ~0.6, oeBeta ~0.01)")
            if mount == "head" and not mouse.get("mouseAbsolute"):
                add("tip", "motion control (mouse)",
                    "a head usually points rather than pushes",
                    "mouseAbsolute true + mouseFilterScale 15-25 + mouseArea 'monitor'")
        if mode == "stick" and can_hold is False:
            add("check", "motion control (stick)",
                "a stick is a sustained lean; they said they cannot sustain one",
                "'dpad' with a wide dead zone, or put the actions on a wheel")

    # --- the wheel --------------------------------------------------------
    if wheel.get("enabled"):
        confirm = wheel.get("confirm") or "release"
        dz = _num(wheel.get("deadzone")) or 0.34
        n = len(wheel.get("slices") or [])
        if confirm == "release" and can_hold is False:
            add("mismatch", "the wheel",
                "'release' keeps the button held open until the choice is made",
                "confirm 'click' (click opens, click sends) or 'cycle' (clicks step through)")
        if confirm in ("tilt-hold", "tilt-click", "cycle") and mouse.get("enabled"):
            add("check", "the wheel",
                "it opens on a big lean, and this capsule is also steering - the steering "
                "movement will open it",
                "put the wheel on a capsule that does not drive the pointer or the stick")
        if confirm == "tilt-hold" and can_hold is False:
            add("mismatch", "the wheel",
                "'tilt-hold' commits by keeping the same slice for %g ms"
                % (_num(wheel.get("confirmMs")) or 600),
                "confirm 'click' or 'cycle'")
        if tremor and dz < 0.40:
            add("tip", "the wheel", "a narrow dead zone picks a slice while the hand rests",
                "deadzone 0.45-0.60")
        if n > 8 and (tremor or (range_deg and range_deg < 25)):
            add("tip", "the wheel", "%d slices is a narrow target for this hand" % n,
                "4-8 slices per ring and put the rest in a submenu (submenuMode 'ring')")

    # --- the scanner ------------------------------------------------------
    if scan.get("enabled"):
        sigs = _scan_signals_in(rules)
        if not sigs.get("sygnal"):
            add("mismatch", "the scanner",
                "it is switched on and no enabled rule carries 'scan:sygnal'",
                "one rule on their most reliable movement -> keySpec 'scan:sygnal'")
        if not sigs.get("stop"):
            add("mismatch", "the scanner",
                "nothing carries 'scan:stop', so a scanner that starts cannot be stopped from "
                "the capsule",
                "a second movement -> keySpec 'scan:stop' (it works even with the module off)")
        if mouse.get("enabled"):
            add("check", "the scanner",
                "this capsule also drives motion control; the steering movement will trip the "
                "scanner",
                "switch motion control off on this capsule, or scan from another one")
        if tremor:
            if (_num(scan.get("odbicie")) or 80) < 120:
                add("tip", "the scanner", "debounce is short for a shaky signal",
                    "odbicie 150-250 ms")
            if (_num(scan.get("czasPrzytrzymania")) or 0) <= 0:
                add("tip", "the scanner", "any brush counts as a signal",
                    "czasPrzytrzymania 150-300 ms (acceptance time)")
        if reaction and reaction > 400 and (_num(scan.get("wyprzedzenie")) or 0) == 0:
            add("tip", "the scanner",
                "they answer about %d ms late, and every click lands that far past the target"
                % reaction,
                "wyprzedzenie %d (the position is read that many ms before the signal)"
                % int(reaction))
        if sight in ("low", "none") and not scan.get("dzwiek"):
            add("check", "the scanner", "nothing to hear, and they cannot rely on the screen",
                "dzwiek true + tonPozycji true, or load the 'Bez patrzenia' set")
        if tires and ((_num(scan.get("czasKroku")) or 900) < 700
                      or (_num(scan.get("opoznienieStartu")) or 1000) < 1000):
            add("tip", "the scanner", "paced faster than somebody rationing effort can follow",
                "czasKroku 1100-1500, opoznienieStartu 1500-2500, przebiegi 1 if big targets "
                "are enough")

    # --- power, and the stop ---------------------------------------------
    if power.get("autoPause") and (tires or (reaction and reaction > 600)):
        secs = _num(power.get("autoPauseSec")) or 60
        if secs < 60:
            add("tip", "power", "the capsule pauses itself after %g s, so their first movement "
                                "is spent waking it" % secs,
                "autoPauseSec 120+ or autoPause false")
    has_stop_rule = bool(_scan_signals_in(rules).get("stop"))
    if not stop_gesture and (scan.get("enabled") or rules):
        if has_stop_rule:
            add("check", "the stop",
                "a 'scan:stop' gesture is mapped, but nothing says whether THEY can make it",
                "confirm that movement with them by name, and write it down as ability.stopGesture")
        else:
            add("check", "the stop",
                "nothing recorded about how this person stops everything if it goes wrong",
                "agree on it before arming: 'scan:stop', a disarm gesture, the emergency hotkey, "
                "or a person in the room")
    if armed and not stop_gesture:
        add("check", "master arm",
            "output is armed and the stop has not been %s"
            % ("confirmed with them" if has_stop_rule else "established"),
            "set_output {master:false} until it has")
    return out


def _t_check_accessibility(ctx, args):
    ability = args.get("ability")
    if ability is not None and not isinstance(ability, dict):
        raise ToolError("'ability' must be an object - see "
                        "get_accessibility_guide.abilityProfile")
    ability = ability or {}
    d = _dev(ctx, args)
    src = {}
    cfg = args.get("config")
    if isinstance(cfg, dict):
        cfg = _cfg_of(cfg)
        src["config"] = "given"
    else:
        env = _fn(ctx, "setup_envelope")(d)
        cfg = (env.get("config") if isinstance(env, dict) else {}) or {}
        src["config"] = "live"
    wheel = args.get("wheel")
    if not isinstance(wheel, dict):
        wheel = d.wheel.get_config()
        src["wheel"] = "live"
    else:
        src["wheel"] = "given"
    scan = args.get("scan")
    if not isinstance(scan, dict):
        scan = d.scan.get_config()
        src["scan"] = "live"
    else:
        src["scan"] = "given"
    rules = cfg.get("rules") if isinstance(cfg.get("rules"), list) else d.trig.snapshot_rules()
    findings = _a11y_check(ability, cfg, wheel, scan, rules, bool(ctx["dm"].master_armed))
    levels = {f["level"] for f in findings}
    unanswered = [k for k in _A11Y_ASKED if k not in ability]
    out = {
        "ok": True, "dev": d.id, "read": src,
        "fit": ("mismatch" if "mismatch" in levels
                else "check" if "check" in levels else "ok"),
        "findings": findings,
        "counted": {"rules": len(rules or []),
                    "distinctMovements": len({s for s in (_rule_signature(r) for r in (rules or [])
                                                          if isinstance(r, dict)) if s})},
        "unanswered": unanswered,
    }
    if not ability:
        # A green light on an empty profile would be the worst possible answer: it looks like
        # approval and it was never anything but "nobody told me what to check against".
        out["fit"] = "unknown"
        out["note"] = ("No ability profile was given, so nothing could be checked against a "
                       "person. Ask the questions in get_accessibility_guide.askFirst first.")
        out["askFirst"] = ACCESSIBILITY["askFirst"]
    elif unanswered:
        out["note"] = ("Checked against what you gave. Still unanswered, and each of these "
                       "changes the verdict: " + ", ".join(unanswered))
    return out


_IMPL = {
    "get_overview": _t_get_overview,
    "get_mapping_reference": _t_get_mapping_reference,
    "get_accessibility_guide": _t_get_accessibility_guide,
    "check_accessibility": _t_check_accessibility,
    "get_module_config": _t_get_module_config,
    "set_module_config": _t_set_module_config,
    "set_scanner_layout": _t_set_scanner_layout,
    "get_setup": _t_get_setup,
    "analyze_setup": _t_analyze_setup,
    "apply_setup": _t_apply_setup,
    "set_rules": _t_set_rules,
    "save_setup": _t_save_setup,
    "set_output": _t_set_output,
}


# ============================================================================
#  JSON-RPC 2.0 plumbing
# ============================================================================

def _resp(rid, result):
    return {"jsonrpc": "2.0", "id": rid, "result": result}


def _error(rid, code, message, data=None):
    e = {"code": code, "message": message}
    if data is not None:
        e["data"] = data
    return {"jsonrpc": "2.0", "id": rid, "error": e}


def _initialize(ctx, params):
    want = params.get("protocolVersion")
    version = want if want in SUPPORTED_VERSIONS else SUPPORTED_VERSIONS[0]
    return {
        "protocolVersion": version,
        "capabilities": {"tools": {}},
        "serverInfo": {"name": SERVER_NAME, "title": SERVER_TITLE,
                       "version": ctx.get("version") or "1.0"},
        "instructions": INSTRUCTIONS,
    }


def _tools_call(ctx, params):
    """Returns (result, jsonrpc_error_message). An unknown tool name is a malformed call,
    so it goes into the JSON-RPC error channel; a tool that ran and failed does not."""
    name = params.get("name")
    impl = _IMPL.get(name) if isinstance(name, str) else None
    if impl is None:
        return None, "unknown tool: %r (call tools/list)" % (name,)
    raw_args = params.get("arguments")
    args = raw_args if isinstance(raw_args, dict) else {}
    is_error = False
    try:
        out = impl(ctx, args)
    except ToolError as e:
        out = {"ok": False, "error": str(e)}
        is_error = True
    except Exception as e:                      # never let a tool bug kill the JSON-RPC session
        out = {"ok": False, "error": "%s: %s" % (type(e).__name__, str(e)[:300])}
        is_error = True
    text = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
    return {"content": [{"type": "text", "text": text}],
            "structuredContent": out, "isError": is_error}, None


def handle_request(ctx, payload):
    """Handle one MCP message. Returns (http_status, response_object_or_None).

    None means "no body": notifications get 202 Accepted, per the Streamable HTTP spec."""
    if isinstance(payload, list):
        # JSON-RPC batching was removed in MCP 2025-06-18 and we never supported it.
        return 400, _error(None, -32600,
                           "JSON-RPC batching is not supported - send one message per request")
    if not isinstance(payload, dict):
        return 400, _error(None, -32600, "Invalid Request: expected a JSON-RPC object")
    method = payload.get("method")
    if not isinstance(method, str) or not method:
        return 400, _error(payload.get("id"), -32600, "Invalid Request: missing 'method'")
    params = payload.get("params")
    if not isinstance(params, dict):
        params = {}
    # No "id" key at all = notification (an id of null/0 is still a request id for our purposes,
    # and answering one costs nothing).
    if "id" not in payload:
        # Notifications carry no reply. We accept every notifications/* (initialized, cancelled,
        # progress...) and simply have nothing to do with them - a stateless server has no state
        # to tear down.
        return 202, None
    rid = payload.get("id")

    if method == "initialize":
        return 200, _resp(rid, _initialize(ctx, params))
    if method == "ping":
        return 200, _resp(rid, {})
    if method == "tools/list":
        return 200, _resp(rid, {"tools": TOOLS})
    if method == "tools/call":
        result, err = _tools_call(ctx, params)
        if err is not None:
            return 200, _error(rid, -32602, err)
        return 200, _resp(rid, result)
    if method.startswith("notifications/"):
        # A notification sent WITH an id (some clients do this) - acknowledge instead of erroring.
        return 200, _resp(rid, {})
    return 200, _error(rid, -32601, "Method not found: %s" % method)
