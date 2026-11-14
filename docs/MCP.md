# MCP — asystent AI konfiguruje RibbitFlipa / let an AI assistant configure RibbitFlip

**[Polski](#polski)** · [English](#english)

---

## Polski

### Co to jest

RibbitFlip udostępnia serwer [MCP](https://modelcontextprotocol.io) (Model Context Protocol) na
tym samym lokalnym porcie co panel: `POST http://127.0.0.1:8770/mcp`. MCP to protokół, którym
asystenci AI rozmawiają z narzędziami na Twoim komputerze — po podłączeniu możesz napisać:

> „Oto sterowanie w *Hades*: A/D krok w bok, W/S chodzenie, Spacja unik. Ułóż mi Zestaw
> RibbitFlipa, w którym przechylam kapsel, żeby się ruszać, a puknięcie to unik."

…a asystent odczyta aktualną konfigurację, sprawdzi nazwy pól i zakresy we wbudowanym
przewodniku, przepuści wynik na sucho i zapisze go w aplikacji. Nic nie wychodzi poza komputer:
asystent rozmawia z serwerem nasłuchującym na `127.0.0.1`.

Endpoint jest **wyłączony, dopóki go nie włączysz** — zgoda na to, żeby asystent pisał Twoje
mapowania, należy do Ciebie, a nie do ustawienia domyślnego. Mówi MCP **Streamable HTTP**
zwykłymi odpowiedziami JSON (bez strumienia SSE, bez identyfikatorów sesji — serwer jest
bezstanowy). Obsługiwane wersje protokołu: `2025-06-18` i `2025-03-26`.

### Jak włączyć

Otwórz panel, przejdź do **Ustawienia** (ekran ustawień aplikacji na dole lewej nawigacji), rozwiń
**Zaawansowane** i przestaw przełącznik **Serwer MCP (asystenci AI)**. Karta pokazuje adres endpointu z
przyciskiem kopiowania; ustawienie zapisuje się w `Settings/ribbitflip_mcp.json` i działa od razu —
bez restartu.

Wolisz plik? Zapisz go sam:

```json
{ "enabled": true }
```

Tak czy inaczej `GET /health` zwraca stan jako `"mcp": true|false`, a baner startowy wypisuje adres
endpointu albo `MCP: wylaczony (wlacz w panelu)`.

Uruchomiono z `--no-mcp`? To twarda blokada na całą sesję: przełącznik w panelu jest wyszarzony i
odmawia zmiany. Żeby użyć MCP, uruchom aplikację bez tej flagi.

### Podłączenie

**Claude Code** (transport HTTP, zalecany):

```bash
claude mcp add --transport http ribbitflip http://127.0.0.1:8770/mcp
```

Albo na stałe w projekcie — plik `.mcp.json`:

```json
{
  "mcpServers": {
    "ribbitflip": {
      "type": "http",
      "url": "http://127.0.0.1:8770/mcp"
    }
  }
}
```

**Klienty obsługujące wyłącznie stdio** używają mostu `tools/mcp_stdio_bridge.py` — przekazuje
JSON-RPC (linia = wiadomość) ze stdin na endpoint HTTP:

```json
{
  "mcpServers": {
    "ribbitflip": {
      "command": "python",
      "args": ["C:/sciezka/do/RibbitFlip/tools/mcp_stdio_bridge.py", "--port", "8770"]
    }
  }
}
```

RibbitFlip musi być uruchomiony — inaczej most odpowiada „RibbitFlip is not running on port N".
Jeśli używasz innego portu (`--port`), podaj ten sam numer mostowi (albo ustaw `RIBBITFLIP_PORT`).

### Trzynaście narzędzi

| Narzędzie | Czyta / pisze | Co robi |
|---|---|---|
| `get_overview` | odczyt | Wersja aplikacji, tryb symulacja/realny, uzbrojenie, każdy slot urządzenia (połączenie, bateria, liczba reguł, włączone grupy wyjścia, koło i skaner), cele MIDI/OSC, nazwy zapisanych Zestawów. |
| `get_mapping_reference` | odczyt | Kanoniczny przewodnik składania konfiguracji: schemat reguły, źródła ruchu z jednostkami i sensownymi progami, zachowania wyzwalaczy, gramatyka klawiszy i myszy, DSL makr, schemat mapowań MIDI/OSC, klucze sterowania ruchem, koło wyboru, skaner ekranu, oszczędzanie baterii, model bezpieczeństwa oraz dwa kompletne przykłady. |
| `get_accessibility_guide` | odczyt | Jak dobrać schemat do ciała: o co zapytać, wszystkie moduły ułożone według tego, ile sprawności wymagają, gotowe punkty startowe per ograniczenie, antywzorce i lista kroków, które może wykonać wyłącznie człowiek przy panelu. |
| `check_accessibility` | odczyt | Przykłada schemat do tego, co osoba o sobie powiedziała, i nazywa to, co wymaga więcej: klawisz trzymany przez kogoś, kto nie utrzyma, dwuklik przy drżeniu, próg poza zasięgiem ruchu, skaner bez możliwości zatrzymania. |
| `get_setup` | odczyt | Pełna konfiguracja wraz z analizą bezpieczeństwa — na żywo ze slotu albo Zestaw z biblioteki `Library/Setups/`. |
| `analyze_setup` | odczyt | Symulacja: ile reguł, ile ryzykownych, które grupy, werdykt dla każdej reguły. Nic nie zmienia. |
| `get_module_config` | odczyt | Dwa moduły, których Zestaw nie niesie: koło wyboru i skaner ekranu — konfiguracja, zapisane zestawy, a dla skanera też to, czy cokolwiek potrafi go w ogóle poprowadzić. |
| `apply_setup` | **zapis** | Stosuje całą konfigurację (reguły + sterowanie ruchem + MIDI/OSC + osie + bateria) do slotu i zapisuje ją. |
| `set_rules` | **zapis** | Podmienia lub dopisuje same wyzwalacze, nie ruszając pozostałych grup. |
| `set_module_config` | **zapis** | Zapisuje koło wyboru albo skaner: zmiana pojedynczych ustawień, wczytanie zapisanego zestawu po nazwie, włącznik modułu i okno skanera nad pulpitem. |
| `set_scanner_layout` | **zapis** | Zamienia zrzut ekranu z gry w działający skaner: jedna plansza na każdy widok gry, a w niej prostokąty do przejeżdżania, zmierzone w pikselach tego zrzutu. |
| `save_setup` | **zapis** | Zapisuje konfigurację jako nazwany Zestaw w `Library/Setups/` (bez stosowania). |
| `set_output` | **zapis** | Uzbrojenie wł./wył., wybór portu MIDI, host/port OSC. |

Każdy zapis publikuje dodatkowo zdarzenie `mcp_action`, więc otwarty panel odświeża się od razu
i widzisz, co zrobił asystent.

Kilka zachowań warto znać, zanim się na nich oprzesz:

- `apply_setup` przyjmuje `config` albo `name`, nigdy jedno i drugie naraz — albo pełną konfigurację
  wprost, albo nazwę Zestawu już zapisanego w `Library/Setups/`.
- `set_rules` wywołane z `append: true` podmienia po id reguły: reguła o id, które już istnieje,
  zastępuje starą zamiast się dublować, więc powtórzenie tego samego wywołania jest bezpieczne.
- `set_output` wywołane bez argumentów niczego nie zmienia — tylko odczytuje aktualny stan
  przełączników (uzbrojenie, port MIDI, cel OSC).
- `get_mapping_reference` opisuje też pola stojące za zakładką **Synth** (pady dźwiękowe), nie tylko
  reguły i źródła ruchu.
- `set_scanner_layout` dopasowuje po nazwie, więc drugie wywołanie z tymi samymi nazwami
  poprawia zamiast dublować, i nie kasuje niczego bez `replace: true`. Podaj ścieżkę do zrzutu
  na tym komputerze — rozmiar obrazka odczyta sam, a prostokąty zmierzone na nim zapisze
  w procentach ekranu, żeby układ przeżył zmianę monitora.
- `set_module_config` scala: wyślij tylko te ustawienia, które chcesz zmienić, a reszta modułu
  zostaje taka, jaka była. Spisu skanerów ani spisu plansz tą drogą **nie zapisze** — te mają
  jedno wejście, `set_scanner_layout`, bo konfiguracja odczytana minutę temu niesie spis sprzed
  minuty.

### Dostępność: schemat dopasowany do Ciebie

Powiedz asystentowi własnymi słowami, co możesz, a czego nie — „nie mogę naciskać przycisków", „ręce
mi drżą", „mam ruch tylko w głowie", „męczę się po minucie", „słabo widzę ekran". To jest
specyfikacja i asystent ma polecenie zaczynać właśnie od niej, a nie od tego, czego chce gra:

> „Potrafię pewnie puknąć w kapsel raz i w zasadzie tyle. Nic nie utrzymam. Ustaw mi to tak, żebym
> mógł obsłużyć komputer."

Sięgnie wtedy po te części RibbitFlipa, które powstały dokładnie do tego, zamiast po zwykły schemat
„przechył na WSAD":

- **skaner ekranu** — pasek jedzie, jeden sygnał go zatrzymuje, w przecięcie idzie kliknięcie, więc
  jeden ruch obsługuje cały pulpit (prawy przycisk, dwuklik i przeciąganie są w menu akcji);
- **koło wyboru** w trybie `tilt-hold` (bez przycisku) albo `cycle` (bez celowania);
- **klik bez klikania** — kursor, który klika przez zatrzymanie się;
- **zatrzask** zamiast trzymania, **warstwy**, żeby z kilku ruchów zrobić kilkanaście akcji, oraz
  **wzmocnienie osi**, żeby kilka stopni ruchu liczyło się jak pełny zakres.

To wszystko asystent potrafi zapisać sam, łącznie z włączeniem skanera i postawieniem jego okna nad
pulpitem. Czterech rzeczy nadal musi dokonać człowiek przy panelu i asystent ma to powiedzieć
wprost, zamiast po cichu zostawić: **nagranie gestu**, **utworzenie wirtualnego kontrolera**,
**okna nakładek** i **skrót awaryjny**.

Dwa nawyki, przy których warto się upierać: nic nie jest uzbrajane, zanim nie masz czym to
**zatrzymać** (gest `scan:stop`, rozbrojenie, skrót awaryjny albo ktoś w pokoju), a ustawienia
zmienia się **po jednym**, żeby w chwili, gdy zacznie działać, było wiadomo od czego.

### Model bezpieczeństwa

**Domyślny jest tryb bezpieczny.** `apply_setup` i `set_rules` przyjmują `mode`, którego wartość
domyślna to `"safe"` — wczytywane są tylko reguły sklasyfikowane jako bezpieczne, reszta jest
odrzucana i policzona w `droppedRisky`. To ten sam klasyfikator, którego panel używa przy
imporcie Zestawu przysłanego przez obcą osobę.

Reguła jest **ryzykowna**, gdy zawiera makro (niepuste `sequence`), używa klawisza Windows,
używa kombinacji systemowej (Alt+F4, Ctrl+W, Alt+Tab, Ctrl+Alt+Del, Ctrl+Shift+Esc, Ctrl+Esc,
Alt+Spacja), używa modyfikatorów spoza ctrl/shift/alt albo wskazuje klawisz, którego aplikacja
nie zna. Powód: `keySpec` i `sequence` mapują ruch na **prawdziwy input systemowy**, więc zestaw
mapujący przechył na `win+r; cmd; enter; <polecenie>; enter` to zdalne wykonanie kodu w
przebraniu JSON-a.

`mode: "advanced"` wczytuje wszystko — opisy narzędzi nakazują asystentowi najpierw zapytać i
ponowić dopiero po Twojej wyraźnej zgodzie.

**Uzbrojenie to osobna sprawa.** Dopóki aplikacja jest rozbrojona, do systemu nie trafia nic,
niezależnie od konfiguracji. Uzbraja `set_output(master: true)`, a opis narzędzia zaznacza, że to
decyzja wyłącznie Twoja.

**Zgodę sprawdza serwer, nie tylko asystent.** Uzbrojenie (`set_output(master: true)`), włączenie
Skanera albo Koła (`set_module_config` z `enabled: true`) i `mode: "advanced"` przechodzą tylko
wtedy, gdy w karcie Serwer MCP włączysz „Asystent może uzbrajać” (domyślnie wyłączone, zapisane
w `Settings/ribbitflip_mcp.json` jako `allowArm`). Bez tego narzędzie odpowiada błędem, który
mówi asystentowi, czym Ty to klikniesz. Rozbrajanie, wyłączanie i tryb bezpieczny przechodzą
zawsze. Każdą zmianę zrobioną przez asystenta panel pokazuje dymkiem.

**Zabezpieczenie transportu** — endpoint `/mcp` ma własną bramkę, bo klient MCP jest lokalnym
procesem i nie może znać tokenu sesji panelu:

1. `Host` musi być adresem lokalnym (loopback) — blokuje atak DNS rebinding.
2. Nagłówek `Origin` musi być **nieobecny**. Dołączają go wyłącznie przeglądarki, więc każda
   strona WWW (również przejęta karta z panelem) dostaje 403. To zastępuje tu token anty-CSRF.
3. `GET /mcp` odpowiada 405 — jedyną metodą jest POST.

### Jak wyłączyć

Przestaw ten sam przełącznik w panelu — endpoint przestaje odpowiadać natychmiast, bez restartu.
To samo daje wpis `{"enabled": false}` w `Settings/ribbitflip_mcp.json`.

Żeby mieć pewność, że w danej sesji w ogóle nie wstanie — na przykład na współdzielonym
komputerze — uruchom aplikację z flagą:

```bash
python ribbitflip_monitor.py --no-mcp
```

Flaga jest nadrzędna wobec pliku ustawień i przełącznika w panelu.

### Typowy przebieg

Ty: *„Gram w wyścigi — skręt to A/D, gaz W, hamulec S, ręczny Spacja. Ustaw kapsel tak, żeby
przechylenie skręcało, a puknięcie było ręcznym."*

Asystent po kolei:

1. `get_overview` — widzi slot `d0`, brak reguł, wyjście rozbrojone.
2. `get_mapping_reference` — dowiaduje się, że `roll` to przechył na boki w stopniach (-90..90),
   że `behavior: "hold"` trzyma klawisz wciśnięty póki trwa przechył, a puknięcie kapsla to
   `{"kind": "button", "any": true}`.
3. `analyze_setup` — 5 reguł, 0 ryzykownych.
4. `apply_setup` — zastosowane.
5. Uzbrojenie zostawia Tobie (albo pyta o zgodę i dopiero wtedy woła `set_output`).

### Testy

`python tests/test_mcp.py` sprawdza całą warstwę end-to-end. Najpierw kopiuje aplikację do
katalogu tymczasowego, więc Twoje prawdziwe `Settings/` i `Library/Setups/` nie są ruszane.

---

## English

### What this is

RibbitFlip ships an [MCP](https://modelcontextprotocol.io) (Model Context Protocol) server on
the same local port as the dashboard: `POST http://127.0.0.1:8770/mcp`. MCP is the protocol AI
assistants use to talk to tools on your machine, so once it is connected you can say:

> "Here are the controls for *Hades*: A/D strafe, W/S walk, Space dash. Build me a RibbitFlip
> Setup where I lean the cap to move and tap it to dash."

…and the assistant reads your current configuration, checks the field names and ranges against
the built-in reference, dry-runs the result and writes it into the app. Nothing leaves your
computer: the assistant talks to a server bound to `127.0.0.1`.

The endpoint is **off until you turn it on** — letting an assistant write your mappings is your
call, not a default. It speaks MCP **Streamable HTTP** with plain JSON responses (no SSE stream,
no session ids — the server is stateless). Protocol revisions: `2025-06-18` and `2025-03-26`.

### Turning it on

Open the dashboard and go to **Ustawienia / Settings**, the app-settings screen at the bottom of
the left navigation, open **Advanced** and flip the **MCP server (AI assistants)**
switch. The card shows the endpoint address with a copy button; the setting is saved to
`Settings/ribbitflip_mcp.json` and takes effect immediately — no restart.

Prefer a file? Write it yourself:

```json
{ "enabled": true }
```

Either way, `GET /health` reports the current state as `"mcp": true|false`, and the startup banner
prints the endpoint URL or `MCP: wylaczony (wlacz w panelu)`.

Started with `--no-mcp`? That is a hard lock for the whole session: the dashboard switch is greyed
out and refuses to flip. Restart without the flag to use it.

### Connecting

**Claude Code** (HTTP transport, recommended):

```bash
claude mcp add --transport http ribbitflip http://127.0.0.1:8770/mcp
```

Or commit it to a project by putting this in `.mcp.json`:

```json
{
  "mcpServers": {
    "ribbitflip": {
      "type": "http",
      "url": "http://127.0.0.1:8770/mcp"
    }
  }
}
```

**Clients that only speak stdio** use the bridge in `tools/mcp_stdio_bridge.py` — it forwards
newline-delimited JSON-RPC from stdin to the HTTP endpoint:

```json
{
  "mcpServers": {
    "ribbitflip": {
      "command": "python",
      "args": ["C:/path/to/RibbitFlip/tools/mcp_stdio_bridge.py", "--port", "8770"]
    }
  }
}
```

RibbitFlip must be running — the bridge answers "RibbitFlip is not running on port N" otherwise.
If you changed the port with `--port`, pass the same number to the bridge (or set
`RIBBITFLIP_PORT`).

### The thirteen tools

| Tool | Reads / writes | What it does |
|---|---|---|
| `get_overview` | read | App version, simulate/real mode, master arm, every device slot (connection, battery, rule counts, which output groups are on, the wheel and the scanner), MIDI/OSC targets, saved Setup names. |
| `get_mapping_reference` | read | The authoritative guide for composing configs: rule schema, motion sources with units and sane thresholds, trigger behaviours, key/mouse grammar, macro DSL, MIDI/OSC mapping schema, motion-control, the wheel, the screen scanner, power keys, the safety model, and two complete worked examples. |
| `get_accessibility_guide` | read | How to fit a scheme to a body: the questions worth asking, every module ranked by how much ability it demands, ready starting configurations per limitation, the anti-patterns, and which steps only a person at the panel can do. |
| `check_accessibility` | read | Holds a scheme up against what somebody said they can do, and names what asks for more: keys held by a person who cannot hold, double taps asked of a tremor, thresholds past their range, a scanner with no way to stop it. |
| `get_setup` | read | A full configuration plus its safety analysis — live from a slot, or a Setup from the `Library/Setups/` library. |
| `analyze_setup` | read | Dry-run: how many rules, how many risky, which groups, per-rule verdict. Changes nothing. |
| `get_module_config` | read | The two modules a Setup does not carry: the wheel and the screen scanner — their config, their saved sets, and for the scanner whether anything can actually drive it. |
| `apply_setup` | **write** | Applies a whole configuration (rules + motion control + MIDI/OSC + axes + power) to a slot and saves it. |
| `set_rules` | **write** | Replaces or appends trigger rules only, leaving the other groups alone. |
| `set_module_config` | **write** | Writes the wheel or the scanner: change single settings, load a saved set by name, switch the module on, and put the scanner's window over the desktop. |
| `set_scanner_layout` | **write** | Turns a screenshot of a game into a working scanner: one view per screen of the game, and inside it the rectangles to sweep, measured in the screenshot's own pixels. |
| `save_setup` | **write** | Saves a configuration as a named Setup in `Library/Setups/` (does not apply it). |
| `set_output` | **write** | Master arm on/off, MIDI port selection, OSC host/port. |

Every write also publishes an `mcp_action` event, so an open dashboard refreshes immediately and
you can see what the assistant did.

A few behaviors worth knowing before you rely on them:

- `apply_setup` takes either `config` or `name`, never both — a full configuration inline, or the
  name of a Setup already saved in `Library/Setups/`, not both at once.
- `set_rules` called with `append: true` upserts by rule id: a rule whose id matches one already
  present replaces it in place instead of duplicating it, so sending the same call twice is safe.
- `set_output` called with no arguments changes nothing — it only reads back the current switches
  (master arm, MIDI port, OSC target).
- `get_mapping_reference` also documents the fields behind the **Synth** tab (the sound pads), not
  just rules and motion sources.
- `set_module_config` merges: send only the settings you want to change and the rest of that
  module keeps its current value. It does **not** write the scanner's list of scanners or its
  list of views — those have one door, `set_scanner_layout`, because a config read a minute ago
  carries a list from a minute ago.
- `set_scanner_layout` matches by name, so calling it twice with the same names edits instead of
  duplicating, and removes nothing unless you pass `replace: true`. Give it the path to a
  screenshot on this machine and it reads the picture's size itself — the rectangles you measured
  on it are stored as percent of the screen, so the layout survives a change of monitor.

### Accessibility: a scheme that fits you

Tell the assistant what your body can and cannot do, in your own words — "I cannot press buttons",
"my hands shake", "I only have movement in my head", "I tire after a minute", "I cannot see the
screen well". That is the specification, and the assistant is told to start from it rather than
from what the game wants:

> "I can tap the cap once, reliably, and that is about it. I cannot hold anything. Set me up so I
> can use the computer."

It will reach for the parts of RibbitFlip built for exactly this, instead of the usual
lean-for-WASD scheme:

- the **screen scanner** — a bar sweeps, one signal stops it, the crossing is clicked, so one
  movement drives the whole desktop (right click, double click and drag come from its action menu);
- the **wheel** in `tilt-hold` (no button at all) or `cycle` (no aiming at all);
- **dwell click** — a pointer that clicks by standing still;
- **latch** instead of hold, **layers** to get more actions out of fewer movements, and **axis
  gain** so a few degrees of movement count as the full range.

It can write all of that itself, including switching the scanner on and putting its window over the
desktop. Four things still need a person at the panel, and the assistant is told to say so rather
than quietly leave them undone: **recording a gesture**, **creating a virtual controller**, the
**overlay windows**, and the **emergency hotkey**.

Two habits worth insisting on: nothing is armed until you have a way to **stop** it (a `scan:stop`
gesture, a disarm, the hotkey, or somebody in the room), and settings change **one at a time**, so
when it starts working you know what did it.

### Safety model

**Safe mode is the default.** Both `apply_setup` and `set_rules` take `mode`, and it defaults to
`"safe"` — only rules classified safe are loaded, the rest are dropped and counted in
`droppedRisky`. This is the same classifier the dashboard uses when you import a Setup a stranger
sent you.

A rule is **risky** when it contains a macro (any non-empty `sequence`), uses the Windows key,
uses a system combination (Alt+F4, Ctrl+W, Alt+Tab, Ctrl+Alt+Del, Ctrl+Shift+Esc, Ctrl+Esc,
Alt+Space), uses modifiers outside ctrl/shift/alt, or names a key the app does not know.
The reason: `keySpec` and `sequence` map motion to **real system input**, so a setup mapping a
tilt to `win+r; cmd; enter; <command>; enter` is remote code execution wearing a JSON hat.

`mode: "advanced"` loads everything — the tool descriptions instruct the assistant to ask you
first and only retry after you say yes.

**Master arm is separate.** Nothing reaches your operating system while the app is disarmed, no
matter what is configured. Arming is `set_output(master: true)`, and the tool description marks
it as a decision only you make.

**The server checks consent, not only the assistant.** Arming (`set_output(master: true)`),
switching the Scanner or the Wheel on (`set_module_config` with `enabled: true`) and
`mode: "advanced"` pass only when you tick "Assistant may arm" in the MCP server card (off by
default, saved in `Settings/ribbitflip_mcp.json` as `allowArm`). Without it the tool answers
with an error telling the assistant which click is yours. Disarming, switching off and safe mode
always pass. The dashboard shows a note for every change the assistant makes.

**Transport hardening** — the `/mcp` endpoint has its own gate, because an MCP client is a local
process and cannot know the dashboard's session token:

1. `Host` must be loopback — blocks DNS rebinding.
2. `Origin` must be **absent**. Only browsers attach it, so any web page (including a compromised
   dashboard tab) is rejected with 403. This replaces the CSRF token for this endpoint.
3. `GET /mcp` answers 405 — POST is the only verb.

### Turning it off

Flip the same dashboard switch back — the endpoint stops answering right away, no restart needed.
The same happens if you write `{"enabled": false}` into `Settings/ribbitflip_mcp.json`.

To make sure it can never come up in a session at all — for example on a shared machine — start
the app with the flag:

```bash
python ribbitflip_monitor.py --no-mcp
```

The flag outranks both the settings file and the dashboard switch.

### A typical session

You: *"I'm playing a racing game — steering is A/D, gas W, brake S, handbrake Space. Set up my
cap so tilting steers and tapping is the handbrake."*

The assistant then:

1. `get_overview` — sees slot `d0`, no rules yet, output disarmed.
2. `get_mapping_reference` — learns that `roll` is left/right lean in degrees (-90..90), that
   `behavior: "hold"` is what keeps a key pressed while you stay tilted, and that a cap tap is
   `{"kind": "button", "any": true}`.
3. `analyze_setup` — 5 rules, 0 risky.
4. `apply_setup` — applied.
5. Tells you to arm it yourself (or asks first, then calls `set_output`).

### Testing

`python tests/test_mcp.py` runs the whole layer end to end. It copies the app into a temp
directory first, so your real `Settings/` and `Library/Setups/` are never touched.
