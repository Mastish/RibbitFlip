# Przykładowe konfiguracje / Example configurations

**[Polski](#polski)** · [English](#english)

---

## Polski

To **poglądowe szablony**, które pokazują budowę plików konfiguracji RibbitFlipa. Aplikacja nie
wczytuje ich sama: własne pliki tworzy w `Settings/` (obok skryptu albo pliku `.exe`) przy
pierwszym uruchomieniu, gdy coś zapiszesz w panelu.

Traktuj je jako ściągę ze schematu JSON albo skopiuj któryś do `Settings/` (ze zmianą nazwy na
odpowiednią `ribbitflip_*.json`) jako punkt wyjścia.

| Plik przykładu | Gdzie skopiować (w `Settings/`) | Co ustawia |
|---|---|---|
| `rules.example.json` | `ribbitflip_rules.json` | Reguły wyzwalaczy (próg osi albo przycisku → akcja klawiatury lub myszy) |
| `midi.example.json` | `ribbitflip_midi.json` | Mapowania MIDI/OSC dla każdego urządzenia |
| `midi_global.example.json` | `ribbitflip_midi_global.json` | Port wyjścia MIDI i cel OSC (host/port), wspólne dla wszystkich urządzeń |
| `mouse.example.json` | `ribbitflip_mouse.json` | Strojenie myszy powietrznej, drążka i krzyżaka |
| `pose.example.json` | `ribbitflip_pose.json` | Kalibracja osi orientacji 3D |
| `power.example.json` | `ribbitflip_power.json` | Automatyczne usypianie przy bezczynności i odpytywanie baterii |
| `profiles/example-platformer.json` | `Library/Profiles/<nazwa>.json` | Zapisany profil wyzwalaczy (dla gry albo programu) |
| `egging-on-2-kapsle.bundle.json` | import w zakładce Zestawy (przeciągnij plik na panel), nie plik `Settings/` | Zestaw na dwa kapsle do *Egging On* (Steam): lewy kapsel steruje jajkiem i hamuje na drążku, prawy obraca kamerę i skacze na RT, oba na jednym wirtualnym padzie Xbox. Wymaga ViGEmBus. |
| `exo-one-2-kapsle.bundle.json` | import w zakładce Zestawy (przeciągnij plik na panel), nie plik `Settings/` | Zestaw na dwa kapsle do *Exo One* (Steam): lewy kapsel prowadzi i trzyma grawitację (RT), prawy kręci kamerą, trzyma szybowanie (LT) i skacze obrotem nadgarstka (A). Przyciski odczytane z plików gry. Wymaga ViGEmBus. |
| `exo-one-1-kapsel.bundle.json` | jak wyżej | Ten sam lot na jednym kapslu: przechył prowadzi, przycisk trzyma grawitację, obrót nadgarstkiem włącza i wyłącza szybowanie. Bez kamery i skoku. Wymaga ViGEmBus. |
| `ufo-50-2-kapsle.bundle.json` | jak wyżej | Zestaw na dwa kapsle do *UFO 50* (Steam): lewy kapsel to krzyżak i pierwszy przycisk, prawy trzyma drugi przycisk, potrząśnięcie daje Start. Przyciski z pliku ustawień gry. Wymaga ViGEmBus. |
| `ufo-50-1-kapsel.bundle.json` | jak wyżej | UFO 50 na jednym kapslu: przechył to krzyżak, przycisk to pierwszy przycisk, obrót nadgarstkiem drugi (tapnięcie), potrząśnięcie Start. Wymaga ViGEmBus. |
| `balatro-2-kapsle.bundle.json` | jak wyżej | Zestaw na dwa kapsle do *Balatro* (Steam): lewy kapsel przesuwa wybór po kartach i zaznacza, prawy zagrywa rękę, obrót nadgarstkiem odrzuca, potrząśnięcie otwiera menu. Przyciski z plików gry. Wymaga ViGEmBus. |
| `balatro-1-kapsel.bundle.json` | jak wyżej | Balatro na jednym kapslu: przechył przesuwa wybór, przycisk zaznacza, obrót w prawo zagrywa, w lewo odrzuca, potrząśnięcie otwiera menu. Wymaga ViGEmBus. |
| `big-walk-2-kapsle.bundle.json` | jak wyżej | Zestaw na dwa kapsle do *Big Walk* (Steam), na klawiaturze i myszy, bez wirtualnego pada: lewy kapsel to chodzenie (W, S, A, D), bieg, skok, machanie i siadanie, prawy to rozglądanie ruchem dłoni jak myszą, podnoszenie i odkładanie. Klawisze z pliku ustawień gry. |
| `outer-wilds-2-kapsle.bundle.json` | jak wyżej | Zestaw na dwa kapsle do *Outer Wilds* (Steam), ten sam na piechotę i w statku: lewy kapsel to ruch i ciąg (w górę na przycisku, w dół przełączany obrotem), prawy to kamera i obrót statku, skok i wyrównanie prędkości, interakcja, sonda. Przyciski z plików gry. Wymaga ViGEmBus. |
| `outer-wilds-3-kapsle.bundle.json` | jak wyżej | To samo plus trzeci kapsel z kołem narzędzi (mapa, latarka, tryb obrotu, autopilot, rozglądanie, namierzanie, kamera lądowania, pauza). Wymaga ViGEmBus. |
| `outer-wilds-kolo-narzedzi.wheel.json` | upuść na panel albo wczytaj w module Koło wyboru | Koło do trzeciego kapsla w zestawie Outer Wilds na trzy kapsle. |
| `portal-2-2-kapsle.bundle.json` | import w zakładce Zestawy (przeciągnij plik na panel), nie plik `Settings/` | Zestaw na dwa kapsle do *Portal 2* (Steam), na klawiaturze i myszy: lewy kapsel to chodzenie, pomarańczowy portal, skok, podnoszenie i kucanie, prawy celuje ruchem dłoni jak myszą i strzela niebieskim portalem. Klawisze z pliku `config.cfg` gry. |
| `pad-na-dwa-kapsle-start.bundle.json` | import w zakładce Zestawy (przeciągnij plik na panel), nie plik `Settings/` | Uniwersalny punkt wyjścia na dwa kapsle z jednym wirtualnym padem Xbox (lewy drążek / prawy drążek / LB / A) do dowolnej gry. Wersja do udostępniania wbudowanego zestawu `Presets/Pad na dwa kapsle (start).json`. Wymaga ViGEmBus. |
| `ribbitflip_audio_launcher.vbs` | to nie konfiguracja, tylko skrypt VBScript, który po cichu uruchamia `ribbitflip_audio.py` przy logowaniu, opis w [Dla programistów](../docs/pl/programisci.md#pod-maską) | Wrzuć go do folderu Autostart Windows, a samodzielny skrypt gestów audio będzie się uruchamiał w tle przy każdym logowaniu. |

Wszystkie wartości to ogólne wypełniacze. Prawdziwe strojenie zależy od urządzenia i Twoich
upodobań, więc ustaw je w panelu zamiast ręcznie edytować JSON. Dwa pliki `.bundle.json` to
kompletne przykłady gotowe do importu, a nie szablony schematu. Plik `.vbs` to skrypt pomocniczy,
a nie konfiguracja.

---

## English

These are **illustrative templates** that show the shape of RibbitFlip's config
files. They are not loaded automatically — RibbitFlip creates its own files under
`Settings/` (next to the script or the `.exe`) the first time you run it and save
something in the dashboard.

Use them as a reference for the JSON schema, or copy one into `Settings/`
(renaming it to the matching `ribbitflip_*.json` name) as a starting point.

| Example file | Copy to (in `Settings/`) | What it configures |
|---|---|---|
| `rules.example.json` | `ribbitflip_rules.json` | Trigger rules (axis/button threshold → key/mouse action) |
| `midi.example.json` | `ribbitflip_midi.json` | Per-device MIDI/OSC mappings |
| `midi_global.example.json` | `ribbitflip_midi_global.json` | MIDI output port + OSC target (host/port), shared by all devices |
| `mouse.example.json` | `ribbitflip_mouse.json` | Air-mouse / stick / d-pad tuning |
| `pose.example.json` | `ribbitflip_pose.json` | 3D orientation axis calibration |
| `power.example.json` | `ribbitflip_power.json` | Idle auto-sleep / battery polling |
| `profiles/example-platformer.json` | `Library/Profiles/<name>.json` | A saved trigger profile (per game/app) |
| `egging-on-2-kapsle.bundle.json` | import via the Zestawy tab (drag the file onto the panel) — not a `Settings/` file | Two-capsule bundle for *Egging On* (Steam): left capsule steers/brakes the egg on its stick, right capsule aims the camera and jumps on RT, both sharing one virtual Xbox pad. Requires ViGEmBus. |
| `exo-one-2-kapsle.bundle.json` | import via the Zestawy tab (drag the file onto the panel), not a `Settings/` file | Two-capsule bundle for *Exo One* (Steam): left capsule steers and holds gravity (RT), right capsule aims the camera, holds glide (LT) and jumps with a wrist flick (A). Buttons read from the game's own files. Requires ViGEmBus. |
| `exo-one-1-kapsel.bundle.json` | as above | The same flight on one capsule: tilt steers, the button holds gravity, a wrist flick turns glide on and off. No camera or jump. Requires ViGEmBus. |
| `ufo-50-2-kapsle.bundle.json` | as above | Two-capsule bundle for *UFO 50* (Steam): left capsule is the D-pad and the first button, right capsule holds the second button, a shake is Start. Buttons from the game's settings file. Requires ViGEmBus. |
| `ufo-50-1-kapsel.bundle.json` | as above | UFO 50 on one capsule: tilt is the D-pad, the button is the first button, a wrist flick the second (a tap), a shake Start. Requires ViGEmBus. |
| `balatro-2-kapsle.bundle.json` | as above | Two-capsule bundle for *Balatro* (Steam): left capsule moves the selection across cards and selects, right capsule plays the hand, a wrist flick discards, a shake opens the menu. Buttons from the game's files. Requires ViGEmBus. |
| `balatro-1-kapsel.bundle.json` | as above | Balatro on one capsule: tilt moves the selection, the button selects, a flick right plays, a flick left discards, a shake opens the menu. Requires ViGEmBus. |
| `big-walk-2-kapsle.bundle.json` | as above | Two-capsule bundle for *Big Walk* (Steam) on keyboard and mouse, no virtual pad: left capsule walks (W, S, A, D), sprints, jumps, waves and sits, right capsule looks around by moving the hand like an air mouse, picks up and drops. Keys from the game's settings file. |
| `outer-wilds-2-kapsle.bundle.json` | as above | Two-capsule bundle for *Outer Wilds* (Steam), the same on foot and in the ship: left capsule moves and thrusts (up on the button, down toggled with a wrist flick), right capsule is the camera and ship rotation, jump and match velocity, interact, probe. Buttons from the game's files. Requires ViGEmBus. |
| `outer-wilds-3-kapsle.bundle.json` | as above | The same plus a third capsule with a tool wheel (map, flashlight, roll mode, autopilot, free look, lock-on, landing camera, pause). Requires ViGEmBus. |
| `outer-wilds-kolo-narzedzi.wheel.json` | drop onto the panel or load in the Selection wheel module | The wheel for the third capsule in the three-capsule Outer Wilds bundle. |
| `portal-2-2-kapsle.bundle.json` | import via the Zestawy tab (drag the file onto the panel), not a `Settings/` file | Two-capsule bundle for *Portal 2* (Steam) on keyboard and mouse: left capsule walks, fires the orange portal, jumps, picks up and crouches, right capsule aims by moving the hand like a mouse and fires the blue portal. Keys from the game's `config.cfg`. |
| `pad-na-dwa-kapsle-start.bundle.json` | import via the Zestawy tab (drag the file onto the panel) — not a `Settings/` file | General-purpose two-capsule starting point sharing one virtual Xbox pad (left stick / right stick / LB / A) for any game — the shareable twin of the built-in preset `Presets/Pad na dwa kapsle (start).json`. Requires ViGEmBus. |
| `ribbitflip_audio_launcher.vbs` | not a config — a VBScript that starts `ribbitflip_audio.py` silently at login, see [For developers](../docs/en/developers.md#under-the-hood) | Drops into the Windows Startup folder so the standalone audio-gesture script runs hidden every time you log in. |

All values here are generic placeholders. Real tuning depends on your device and
preferences — set it up in the dashboard instead of editing JSON by hand. The two
`.bundle.json` files above are complete, ready-to-import examples rather than
schema templates, and the `.vbs` file is a helper script, not a config at all.
