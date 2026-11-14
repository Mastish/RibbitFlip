# Zasady bezpieczeństwa / Security Policy

**[Polski](#polski)** · [English](#english)

---

## Polski

RibbitFlip to nieoficjalny projekt hobbystyczny bez formalnych terminów reakcji, ale lokalny
serwer zaprojektowano ostrożnie, a zgłoszenia traktujemy poważnie.

Po co aplikacja steruje klawiaturą, myszą, padem i ekranem, kiedy to robi i czego nie robi,
mechanizm po mechanizmie z odnośnikami do kodu: [`docs/pl/cel-i-zabezpieczenia.md`](../docs/pl/cel-i-zabezpieczenia.md).

### Model bezpieczeństwa

RibbitFlip uruchamia mały serwer HTTP **wyłącznie** na `127.0.0.1` (pętla zwrotna). Serwer nigdy
nie jest widoczny w sieci lokalnej ani w internecie i nie ma przełącznika, który zmieniałby adres
nasłuchu: da się ustawić tylko port. Panel, który serwuje, może **generować zdarzenia klawiatury,
myszy, pada i MIDI/OSC**, rozmawiać w Twoim imieniu z innymi programami i opcjonalnie udostępniać
kanał sterowania asystentom AI. Dlatego serwer stosuje kilka zabezpieczeń:

- **Nasłuch tylko na pętli zwrotnej** (`127.0.0.1`). Da się ustawić wyłącznie port.
- **Token CSRF na sesję** (192 bity, `secrets.token_urlsafe`), wstrzykiwany do strony panelu i
  wymagany przy każdym `POST` zmieniającym stan. Wszystkie 95 takich tras przechodzi przez tę samą
  kontrolę. Żądania `GET` **nie** wymagają tokenu, bo `EventSource` (strumień danych na żywo) nie
  może ustawić własnego nagłówka. Chroni je bramka Host + Origin opisana niżej.

  **Token chroni przed CSRF, a nie uwierzytelnia.** Powstrzymuje inne strony internetowe przed
  sterowaniem aplikacją w Twoim imieniu, ale nie powstrzyma innych programów na Twoim komputerze.
  Każdy lokalny proces, który dosięgnie `127.0.0.1:<port>` (skrypt, inny program uruchomiony na
  Twoim koncie, cokolwiek z dostępem lokalnym), może wczytać stronę panelu, odczytać z niej token
  i zrobić wszystko, co Ty. Właściwą granicą bezpieczeństwa jest nasłuch na pętli zwrotnej, a nie
  token.
- **Sprawdzanie Host i Origin.** `Host` musi mieć wartość `127.0.0.1` albo `localhost` (dowolny
  port). Wszystko inne, także żądanie bez nagłówka `Host`, jest odrzucane. Jeśli żądanie ma
  nagłówek `Origin`, musi on wskazywać jeden z tych dwóch hostów. Nigdzie nie ma
  `Access-Control-Allow-Origin: *`, a strumień danych i konfiguracji na żywo działa tylko w
  obrębie tego samego źródła.
- **Nagłówki ramek i treści.** `X-Frame-Options: SAMEORIGIN` i Content-Security-Policy z
  `frame-ancestors 'self'` (poluzowane z `DENY`/`'none'` 2026-09-01, żeby edytor nakładek mógł
  osadzić stronę panelu tej samej aplikacji w podglądzie na żywo; aplikacja nadal może osadzać
  tylko samą siebie i nic innego nie może jej osadzić). Odpowiedzi mają też
  `X-Content-Type-Options: nosniff`.
- **Limit treści żądania: 2 MB.** Żądania z nagłówkiem `Transfer-Encoding` są od razu odrzucane,
  bo serwer rozumie tylko treść z `Content-Length`.
- **Pliki statyczne** są serwowane wyłącznie z `web/*`, sprawdzane z listą dozwolonych rozszerzeń
  i rozwiązywane przez `realpath` z kontrolą przedrostka, więc żądanie nie wyjdzie poza ten jeden
  katalog.
- **Nigdzie nie ma `eval`, `exec` ani `pickle`.** `subprocess` występuje w pięciu miejscach,
  zawsze ze stałą listą argumentów budowaną przez aplikację, nigdy z danych żądania: przy
  uruchamianiu własnego okna Chromium dla nakładki i dla skanera, przy otwieraniu Eksploratora na
  stałym folderze (`Settings/` albo `Zgloszenia/`), jako zapasowy sposób otwarcia domyślnej
  przeglądarki (`cmd /c start`) i przy restarcie aplikacji po przełączeniu trybu symulacji.
  `os.startfile` dostaje wyłącznie jeden z trzech stałych folderów (`Settings/`, `Zgloszenia/`
  albo katalog aplikacji) albo adres `http://127.0.0.1:<port>/` samej aplikacji, nigdy ścieżkę
  zbudowaną z żądania. Konfiguracja to zwykły JSON z przycinaniem typów i zakresów, a nazwy
  profili i zestawów są oczyszczane: bez separatorów ścieżek, bez `..`, a zarezerwowane nazwy
  urządzeń Windows są odrzucane.
- **Dwustopniowe bezpieczeństwo importu.** Reguły w zestawach, paczkach i profilach wyzwalaczy
  importowanych spoza aplikacji są klasyfikowane po stronie serwera. Wszystko „ryzykowne”
  (kombinacje z klawiszem Windows, makra, nieznane akcje) jest w trybie *bezpiecznym* domyślnie
  pomijane. Zestawy wczytywane z Twojego folderu `Library/Setups/`, także przy automatycznym
  przełączaniu według gry, są już zaufane i stosowane w trybie zaawansowanym. Plik JSON, który
  sam tam wrzucisz, nie przechodzi przez klasyfikator. Wycinki koła wyboru są klasyfikowane tylko
  na potrzeby podglądu importu.
- **Połączenia wychodzące, wszystkie uruchamiane przez Ciebie:**
  1. **Usługi sieciowe** (karta „Usługi sieciowe”): akcje HTTP łączą się z dowolnym adresem
     `http`/`https`, który ustawisz. Przekierowania nie są śledzone, limit czasu to 30 sekund, a
     odpowiedź jest ucinana do 256 KiB. Celowo **nie ma ograniczenia celu** (dosięgną też pętli
     zwrotnej i adresów sieci prywatnej, bo do tego służą). Akcje OBS (`obs-websocket`) są
     bardziej ograniczone: tylko dosłowny adres IP pętli zwrotnej albo sieci prywatnej, nigdy
     nazwa DNS, co wyklucza DNS rebinding.
  2. **`/setup/fetch`** pobiera udostępniony zestaw przez `https` z dozwolonego zestawu hostów
     (CDN Discorda, `raw.githubusercontent.com`, GitHub Gist), do 1 MiB.
  3. Panel **Ko-fi**, ładowany dopiero po kliknięciu ikony kubka.
  4. **OSC** wysyła wartości ruchu wyłącznie na adres i port, które wpiszesz (domyślnie
     `127.0.0.1`), i niczego nie odbiera.
  5. **Gra RibbitBeat**: pakiety MIDI z Hugging Face po kliknięciu w grze oraz import piosenki
     z wklejonego adresu. Import przyjmuje tylko adresy w internecie: adresy tego komputera
     i sieci lokalnej odrzuca, także gdy strona przekieruje na nie po drodze.

  Nie ma sprawdzania aktualizacji ani telemetrii, a aplikacja nigdzie nie zakłada kont.
- **Endpoint MCP** (`/mcp`, domyślnie wyłączony; `--no-mcp` blokuje go na całą sesję) odrzuca
  każde żądanie z przeglądarkowym nagłówkiem `Origin`, bo prawdziwy klient MCP nigdy go nie
  wysyła. Asystent konfiguruje aplikację, ale **uzbrojenie** (`set_output` z `master: true`),
  **włączenie Skanera albo Koła** i **tryb zaawansowany** (`mode: "advanced"`, który wczytuje
  ryzykowne reguły) serwer przepuszcza tylko wtedy, gdy w karcie Serwer MCP włączysz „Asystent może
  uzbrajać” (domyślnie wyłączone). Rozbrajanie i wyłączanie przechodzą zawsze. Każdą zmianę
  zrobioną przez asystenta panel pokazuje dymkiem. Po włączeniu tej zgody traktuj endpoint jak
  **lokalny kanał sterowania z pełnymi uprawnieniami**. Pełny opis w [`docs/MCP.md`](../docs/MCP.md).

### Zachowania, o których warto wiedzieć

- **Główny przełącznik jest uzbrojony przy starcie i ten stan nie jest zapisywany.** Zapisane
  wcześniej reguły wyzwalaczy działają, gdy tylko połączy się kapsel i spełni się warunek. Pod
  `--simulate` przełączniki grup wyjść (mapowanie, mysz i kontroler, MIDI, OSC, usługi, syntezator)
  startują natomiast **wyłączone**, a pierwsze włączenie każdego z nich prosi o potwierdzenie.
  `--no-keys` twardo blokuje generowanie klawiatury i myszy niezależnie od reszty. Skrót
  **Alt+R+F** to awaryjny stop, który od razu wyłącza wszystkie moduły wyjścia.
- **`/test-key` może wysłać dowolny klawisz, gdy grupa mapowania jest uzbrojona.** Ten endpoint
  celowo omija klasyfikator bezpieczne/ryzykowne, żeby dało się przetestować mapowanie, także
  kombinacje klawiszy systemowych. Chroni go token CSRF jak każdą trasę zmieniającą stan, ale
  pamiętaj o zastrzeżeniu dotyczącym tokenu: wszystko na Twoim komputerze, co odczyta stronę
  panelu, też może go użyć.
- **Mikrofon jest proszony o zgodę dopiero przy kliknięciu „Nagraj”.** Używają go dwa miejsca i oba
  robią to samo: własna próbka dźwięku w Studiu instrumentów gry RibbitBeat i w Bibliotece dźwięków
  panelu (Synth). Aplikacja nie woła `getUserMedia` przy starcie ani w tle, tylko w obsłudze tego
  jednego przycisku. Odmowa kończy się zdaniem na ekranie, nie wyjątkiem. Po zakończeniu nagrania,
  po jego przerwaniu i przy zamknięciu edytora wszystkie ścieżki strumienia są zatrzymywane, więc
  wskaźnik mikrofonu gaśnie. Nagranie z gry zostaje w przeglądarce (IndexedDB), nagranie z panelu —
  w `Library/Probki/<id>.wav` na tym komputerze. Przez sieć nie jedzie nigdzie: aplikacja nie ma
  dokąd go wysłać. Do pliku do rozdania trafia dopiero wtedy, gdy sam klikniesz „Zapisz do pliku”.
- **Trasy `/synth-probka` to jedyne, które przyjmują bajty, a nie konfigurację.** Dlatego jako
  jedyne zaglądają do treści: zapis przyjmuje wyłącznie WAV PCM 16-bit mono z poprawnym nagłówkiem,
  do 1,2 MB, pod identyfikatorem pasującym do wzorca `s-[a-z0-9]{1,16}`, a ścieżka przechodzi przez
  `realpath` z kontrolą przedrostka. Bez tego katalog biblioteki byłby miejscem, w którym przez
  przeglądarkę da się położyć dowolny plik pod dowolną ścieżką.
- **Co aplikacja zapisuje na dysku.** Obok pliku wykonywalnego: `Settings/` (w tym pełny profil
  Chromium dla każdego okna nakładki zawsze na wierzchu, w
  `Settings/OverlayBrowser/<id-okna>/`), `Library/`, `Zgloszenia/` oraz `ribbitflip.log` z dwiema
  poprzednimi generacjami (2 MB na plik, razem 6 MB). Poza folderem aplikacji:
  `%LOCALAPPDATA%\RibbitFlip\.instance.json` (pid, port i nazwa pliku exe), używany przez strażnika
  pojedynczej instancji, oraz pakiety gry RibbitBeat w `%LOCALAPPDATA%\RibbitFlip\SongPacks\`
  i `Piosenki\`. W rejestrze (tylko `HKCU`, bez praw administratora): wpis autostartu w `…\Run`,
  wyłącznie po zaznaczeniu „Uruchamiaj przy starcie Windows” w menu ikony, i nazwa z ikoną
  powiadomień w `Software\Classes\AppUserModelId\Mastish.RibbitFlip`, dopiero przy pierwszym
  powiadomieniu. Strażnik pojedynczej instancji to nazwany mutex w obrębie sesji
  (`RibbitFlip.SingleInstance`), który **przepuszcza przy błędzie**: jeśli nie da się go utworzyć,
  aplikacja i tak startuje. `--allow-multi` celowo go omija na potrzeby testów.
- **Paczka diagnostyczna („Zgłoś problem”) powstaje z listy dozwolonych plików, a nie z listy
  wykluczeń.** Nigdy nie zawiera sejfu poświadczeń, profilu Chromium przeglądarki nakładek, treści
  zapisanych zestawów ani nazwy użytkownika Windows, a tokeny i zmienne w tym, co zbiera, są
  zamaskowane. Dołączona kopia `ribbitflip_devices.json` ma każdy adres Bluetooth skrócony do
  pierwszych trzech oktetów. Paczka nadal wymienia pliki exe gier przypisane do zestawów z
  automatycznym przełączaniem, więc traktuj ją tak, jakby je zawierała. To Ty decydujesz, kiedy ją
  opublikować. Aplikacja nigdy sama jej nigdzie nie wysyła.

### Zgłaszanie podatności

Podejrzewane podatności zgłaszaj prywatnie przez GitHub Security Advisories (zakładka repozytorium
**Security → Report a vulnerability**), a nie w publicznym zgłoszeniu ani na serwerze Discord. Daj
nam rozsądny czas na odpowiedź przed ujawnieniem. Dziękujemy.

---

## English

RibbitFlip is an unofficial hobby project with no formal security SLA, but the
local server was designed defensively and issues are taken seriously.

Why the app drives the keyboard, mouse, gamepad and screen, when it does and what it does not
do, mechanism by mechanism with links to the code: [`docs/en/purpose-and-safeguards.md`](../docs/en/purpose-and-safeguards.md).

### Security model

RibbitFlip runs a small HTTP server **only** on `127.0.0.1` (loopback) — it is
never exposed to the LAN or the internet, and there is no flag to change the bind
address; the port is the only configurable part. The dashboard it serves can
**synthesize keyboard, mouse, gamepad, and MIDI/OSC output**, can talk to other
software on your behalf, and can optionally expose a control channel for AI
assistants, so the server takes several precautions:

- **Loopback-only bind** (`127.0.0.1`); the port is the only configurable part.
- **Per-session CSRF token** (192-bit, `secrets.token_urlsafe`), injected into the
  dashboard page and required on every state-changing `POST` — all 95 of them go
  through the same check. `GET` requests are **not** token-gated, because an
  `EventSource` (the live telemetry stream) cannot set a custom header; those
  rely on the Host+Origin gate below instead.

  **The token is anti-CSRF, not authentication.** It stops other websites from
  driving the app on your behalf; it does not stop other programs on your
  machine. Any local process that can reach `127.0.0.1:<port>` — a script,
  another program running as you, anything with local access — can load the
  dashboard page, read the token out of it, and do anything you could do. The
  loopback bind is the actual security boundary here, not the token.
- **Host + Origin validation.** `Host` must be `127.0.0.1` or `localhost` (any
  port); anything else — including a request with no `Host` header at all — is
  rejected. When a request carries an `Origin` header, it must name one of those
  same two hosts. There is no `Access-Control-Allow-Origin: *` anywhere; the live
  telemetry/config stream is same-origin only.
- **Frame and content headers.** `X-Frame-Options: SAMEORIGIN` and a
  Content-Security-Policy with `frame-ancestors 'self'` (loosened from
  `DENY`/`'none'` on 2026-09-01 so the overlay editor can embed the app's own
  dashboard page in a live preview — the app can still only frame itself; nothing
  else can frame it). Responses also carry `X-Content-Type-Options: nosniff`.
- **Request-body cap of 2 MB.** Requests that carry a `Transfer-Encoding` header
  are rejected outright — the server only understands `Content-Length` bodies.
- **Static files** are served only from `web/*`, matched against an extension
  allowlist, and resolved with `realpath` plus a prefix check, so a request
  cannot walk out of that one directory.
- **No `eval`, `exec`, or `pickle` anywhere.** `subprocess` is used in five
  places, each with a fixed argument vector the app builds itself, never from
  request data: launching the app's own Chromium window for an overlay and for
  the scanner, opening Explorer on a fixed folder (`Settings/` or `Zgloszenia/`),
  a fallback for opening your default browser (`cmd /c start`), and restarting
  the app when you switch simulation mode. `os.startfile` is only ever handed one of three
  constant folders (`Settings/`, `Zgloszenia/`, or the app's own directory) or
  the app's own `http://127.0.0.1:<port>/` URL — never a path built from a
  request. Config is plain JSON with type/range clamping, and profile/setup
  names are sanitized: no path separators, no `..`, and Windows reserved device
  names are rejected.
- **Two-tier import safety.** Rules inside setups, bundles, and trigger profiles
  that you import from outside the app are classified server-side, and anything
  "risky" (Windows-key combos, macros, unknown actions) is dropped by default in
  *safe* mode. Setups loaded from your own `Library/Setups/` folder — including
  automatic switching by game — are already trusted and are applied in advanced
  mode; a JSON file you place there by hand is not run through the classifier.
  Selection-wheel slices are classified only for the import preview.
- **Outbound connections, all of them user-initiated:**
  1. **Network services** (the "Usługi sieciowe" card) — its HTTP actions reach
     whatever `http`/`https` URL you configure, with redirects not followed, a
     30-second timeout, and a 256 KiB response cap, and deliberately **no
     destination restriction** (it will reach loopback and private-network
     addresses too, because that is what it is for). Its OBS (`obs-websocket`)
     actions are more restricted: only a loopback or private-network IP literal,
     never a DNS name, which keeps DNS rebinding out.
  2. **`/setup/fetch`** downloads a shared setup over `https` from an allowlisted
     set of hosts (Discord's CDN, `raw.githubusercontent.com`, GitHub Gist),
     capped at 1 MiB.
  3. The **Ko-fi** panel, loaded only when you click the mug icon.
  4. **OSC** sends motion values only to the host and port you type in (default
     `127.0.0.1`) and receives nothing.
  5. **The RibbitBeat game**: MIDI packs from Hugging Face when you click in the
     game, and importing a song from a pasted address. The import accepts
     internet addresses only: addresses of this computer and of the local
     network are refused, also when a page redirects there on the way.

  There is no update check and no telemetry, and the app does not create
  accounts anywhere.
- **The MCP endpoint** (`/mcp`, off by default; `--no-mcp` hard-locks it for the
  whole session) rejects any request that carries a browser `Origin` header at
  all, since a real MCP client never sends one. The assistant configures the
  app, but **arming** (`set_output` with `master: true`), **switching the Scanner
  or the Wheel on** and **advanced mode** (`mode: "advanced"`, which loads risky
  rules) pass the server only when you tick "Assistant may arm" in the MCP
  server card (off by default). Disarming and switching off always pass, and
  the dashboard shows a note for every change the assistant makes. Once that
  consent is on, treat the endpoint as a **full-privilege local control
  channel**. See [`docs/MCP.md`](../docs/MCP.md) for the full model.

### Known behaviors to be aware of

- **The master switch is armed at startup, and this is not persisted.**
  Previously-saved trigger rules go live as soon as a puck connects and a
  condition fires. Under `--simulate`, the per-group output switches (mapping,
  mouse/controller, MIDI, OSC, services, synth) instead start **off**, and
  turning one on for the first time asks for confirmation. `--no-keys` is a hard
  block on keyboard/mouse synthesis regardless of anything else. The hotkey
  **Alt+R+F** is an emergency stop that disables all output modules immediately.
- **`/test-key` can emit any key spec while the mapping group is armed.** This
  endpoint intentionally bypasses the safe/risky classifier so you can test a
  mapping, including system-key combinations. It is protected by the CSRF token
  like any other state-changing route — but see the token caveat above:
  anything on your machine that can read the dashboard page can use it too.
- **The microphone is only asked for when you click "Record".** Two places use
  it and both do the same thing: your own sound sample in the RibbitBeat game's
  instrument studio and in the dashboard's sound library (Synth). The app never
  calls `getUserMedia` at startup or in the background, only in that one
  button's handler. A refusal ends with a sentence on screen, not an exception.
  When the recording ends, when you stop it and when you close the editor, every
  track of the stream is stopped, so the microphone indicator goes off. The
  game's recording stays in the browser (IndexedDB), the dashboard's in
  `Library/Probki/<id>.wav` on this computer. Neither travels over the network —
  the app has nowhere to send it. It reaches a shareable file only when you click
  "Save to file" yourself.
- **The `/synth-probka` routes are the only ones that take bytes rather than
  configuration.** That is why they are the only ones that look inside: the write
  accepts nothing but 16-bit mono PCM WAV with a valid header, up to 1.2 MB,
  under an id matching `s-[a-z0-9]{1,16}`, and the path goes through `realpath`
  with a prefix check. Without that, the library folder would be a place where a
  browser can drop any file at any path.
- **What the app writes to disk.** Next to the executable: `Settings/` (which
  includes a full per-window Chromium profile for each on-top overlay window, under
  `Settings/OverlayBrowser/<window-id>/`), `Library/`, `Zgloszenia/`, and
  `ribbitflip.log` plus two rotated generations (2 MB per file, 6 MB in total). Outside the
  app folder: `%LOCALAPPDATA%\RibbitFlip\.instance.json` (pid, port, and exe
  name), used by the single-instance guard, and the RibbitBeat game's packs in
  `%LOCALAPPDATA%\RibbitFlip\SongPacks\` and `Piosenki\`. In the registry (`HKCU`
  only, no admin rights): the autostart entry under `…\Run`, only after you tick
  "Run at Windows startup" in the tray menu, and the notification name and icon
  under `Software\Classes\AppUserModelId\Mastish.RibbitFlip`, written at the
  first notification. The single-instance guard is a
  session-scoped named mutex (`RibbitFlip.SingleInstance`) that **fails open** —
  if it cannot be created, the app still starts — and `--allow-multi` bypasses
  it deliberately, for testing.
- **The diagnostic bundle ("Zgłoś problem") is built from an allowlist, not an
  exclusion list.** It never includes the credential vault, the overlay
  browser's Chromium profile, the contents of your saved setups, or your
  Windows user name, and tokens/variables inside what it does collect are
  redacted. The copy of `ribbitflip_devices.json` it includes has each Bluetooth
  address masked down to its first three octets. It still lists the game
  executables you've assigned to auto-switching setups, so treat the bundle as
  containing that. You choose when to post it; the app never sends it anywhere
  on its own.

### Reporting a vulnerability

Please report suspected vulnerabilities privately via GitHub Security Advisories
(the repository's **Security → Report a vulnerability** tab) rather than a
public issue or the Discord server, and allow reasonable time to respond before
disclosure. Thank you.
