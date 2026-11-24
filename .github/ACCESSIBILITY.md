# Dostępność / Accessibility

**[Polski](#polski)** · [English](#english)

---

## Polski

RibbitFlip powstał także z myślą o osobach, które nie mogą korzystać ze standardowej myszy
i klawiatury. Dostępność traktujemy jako jeden z celów projektu, a nie dodatek. Uczciwie: to
projekt hobbystyczny rozwijany po godzinach, nie wyrób medyczny i nie certyfikowany sprzęt
wspomagający.

### Co RibbitFlip daje

- **Skaner ekranu:** cały komputer obsłużysz jednym sygnałem, na przykład skinieniem głowy,
  przechyleniem albo znieruchomieniem kapsla. Żaden sygnał nie wymaga naciśnięcia przycisku.
- **Klik bez klikania:** kliknięcie robi się samo, gdy zatrzymasz kursor. Czas zatrzymania
  i tolerancję drżenia ustawiasz pod siebie.
- **Kursor prowadzony ruchem głowy albo dłoni**, z kapslem przypiętym do czapki lub opaski.
- **Koło wyboru:** do szesnastu akcji pod jednym przyciskiem zamiast skrótów klawiszowych.
- **Odłożony kapsel nic nie klika**, więc kapsel położony na kocu czy poręczy fotela przestaje
  sterować.

Szczegóły: [RibbitFlip jako pomocna dłoń](../docs/pl/pomocna-dlon.md).

### O co dbamy w panelu i w grze

- Przyciski, nawigacja i statusy używają ikon SVG, żeby rozmiar, kolor i kontrast były takie same
  w każdym systemie. Staramy się o kontrast tekstu co najmniej 4,5:1, także dla przycisków
  wyłączonych.
- Panel i gra RibbitBeat respektują systemowe ustawienie ograniczonego ruchu: animacje stają albo
  pokazują od razu końcowy stan.
- Kontrolki panelu mają etykiety dostępności (ARIA).
- Panel, dokumentacja i gra są po polsku i po angielsku.
- RibbitBeat ma pomoce (między innymi przyciąganie do nut, żabę śpiewającą samą i zmianę tempa)
  oraz gotowe zestawy od **Na luzie** do **Mistrz**. Zagrasz też bez kapsla: myszą, klawiaturą
  albo padem.

### Gdzie działa

- Windows 10 albo 11 (64-bitowy) z Bluetooth LE. Innych systemów nie obsługujemy.
- Panel otwiera się w przeglądarce pod adresem `http://127.0.0.1:8770/` i działa tylko na Twoim
  komputerze.
- Bez kapsla da się wszystko obejrzeć w trybie `--simulate`.

### Znane ograniczenia

- **Pierwsza konfiguracja** (instalacja, parowanie kapsla, ustawienie skanera) wymaga zwykłej
  myszy i klawiatury albo pomocy drugiej osoby.
- **Trzeba wykonać choć jeden powtarzalny ruch kapslem.** Bez żadnego pewnego ruchu skaner nie
  zadziała.
- **Czytniki ekranu:** nie mamy udokumentowanych testów panelu z czytnikami ekranu (na przykład
  NVDA czy Narrator). Jeśli z nich korzystasz, Twoja opinia bardzo nam pomoże.
- **RibbitBeat to gra rytmiczna** w wersji testowej: wymaga wyczucia czasu, a informacje przekazuje
  dźwiękiem i kolorem. Pomoce łagodzą to, ale nie usuwają.
- Projekt jest hobbystyczny, więc nie obiecujemy terminów odpowiedzi ani poprawek.

### Jak zgłosić barierę

Jeśli coś w RibbitFlipie jest dla Ciebie trudne albo niemożliwe do zrobienia, chcemy o tym wiedzieć.

- Otwórz zgłoszenie na GitHubie z szablonem
  **[Bariera dostępności](https://github.com/Mastish/RibbitFlip/issues/new?template=bariera-dostepnosci.yml)**.
- Albo napisz na forum `#pomoc` na [serwerze Discord](https://discord.gg/tyv2MjjVdb).

Napisz, co próbowałeś zrobić, co Cię zatrzymało i z jakiego sprzętu wspomagającego lub ustawień
systemu korzystasz. Zgłoszenia barier traktujemy jak błędy, a nie jak prośby o nową funkcję.

Przy rozbieżności między wersjami wiążąca jest wersja polska.

---

## English

RibbitFlip was also built for people who cannot use a standard mouse and keyboard. We treat
accessibility as one of the project's goals, not an extra. To be honest: this is a hobby project
maintained in spare time, not a medical device and not certified assistive technology.

### What RibbitFlip offers

- **Screen scanner:** run the whole computer with one signal, for example a nod, a tilt or holding
  the capsule still. No signal requires pressing a button.
- **Click without clicking:** a click happens by itself when you hold the cursor still. You set the dwell time
  and the tremor tolerance to suit you.
- **Cursor driven by head or hand movement**, with the capsule clipped to a cap or a headband.
- **Selection wheel:** up to sixteen actions under one button instead of keyboard shortcuts.
- **A capsule put down clicks nothing**, so a capsule resting on a blanket or an armrest stops
  controlling.

Details: [RibbitFlip as a helping hand](../docs/en/helping-hand.md).

### What we look after in the panel and the game

- Buttons, navigation and status use SVG icons, so size, colour and contrast stay the same on
  every system. We aim for text contrast of at least 4.5:1, including disabled buttons.
- The panel and the RibbitBeat game respect the system's reduced motion setting: animations stop
  or show the final state at once.
- Panel controls have accessibility labels (ARIA).
- The panel, the documentation and the game are in Polish and English.
- RibbitBeat has aids (including snapping to notes, a frog that sings by itself and tempo changes)
  and ready presets from **Relaxed** to **Master**. You can also play without the capsule:
  with a mouse, keyboard or gamepad.

### Where it runs

- Windows 10 or 11 (64-bit) with Bluetooth LE. Other systems are not supported.
- The panel opens in your browser at `http://127.0.0.1:8770/` and only works on your computer.
- Without a capsule you can explore everything in `--simulate` mode.

### Known limitations

- **First-time setup** (installing, pairing the capsule, setting up the scanner) needs a regular
  mouse and keyboard or help from another person.
- **You need at least one repeatable movement with the capsule.** Without any reliable movement the
  scanner cannot work.
- **Screen readers:** we have no documented tests of the panel with screen readers (such as NVDA or
  Narrator). If you use one, your feedback would help a lot.
- **RibbitBeat is a rhythm game** in a test version: it needs a sense of timing and conveys
  information through sound and colour. The aids soften this but do not remove it.
- This is a hobby project, so we cannot promise response or fix times.

### How to report a barrier

If something in RibbitFlip is hard or impossible for you to do, we want to know.

- Open a GitHub issue with the
  **[Accessibility barrier](https://github.com/Mastish/RibbitFlip/issues/new?template=bariera-dostepnosci.yml)**
  template.
- Or post in the `#pomoc` forum on the [Discord server](https://discord.gg/tyv2MjjVdb).

Tell us what you were trying to do, what stopped you, and which assistive technology or system
settings you use. Barrier reports are treated as bugs, not as feature requests.

If the two language versions disagree, the Polish text is the one that counts.
