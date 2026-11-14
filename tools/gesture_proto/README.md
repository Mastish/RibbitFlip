# Prototyp: wyzwalacz z NAGRANEGO gestu (test przed implementacją)

> **2026-09-05: wdrożone w aplikacji.** Rdzeń z tego folderu żyje teraz w `ribbitflip_gesture.py`
> (źródło reguły `kind:"gesture"`, nagrywarka auto / Start-Stop, próba szkicu), a w panelu jako tryb
> „Prosty — nagraj gest” edytora reguł i warunek „Gest” w trybie zaawansowanym (rf-12d / rf-12e).
> Laboratorium `lab.py` i `live.py` zostają jako stanowisko do strojenia i testów na sprzęcie.
>
> Stan: **prototyp poza aplikacją** (2026-09-03). Nie dotyka `ribbitflip_monitor.py`, panelu ani
> `Settings/`. Odpowiada na pytanie: „czy zamiast ręcznej konfiguracji reguły (oś, próg, zachowanie)
> użytkownik może po prostu nagrać ruch, a wyzwalacz ma odpalać, gdy ktoś wykona go ponownie?".
> Odpowiedź: **tak, to jest do zrobienia** — w czystym Pythonie, bez nowych zależności, za ułamek
> procenta czasu procesora. Pomysł jest z założenia **drugą drogą obok reguł ręcznych**, nie ich
> zamiennikiem.

## Jak to działa

```
próbka 6×int16 @ 50 Hz (ta sama, co w Pipeline.handle)
  → kalibracja osi jak PoseFilter (gyr = CH0-2, acc = CH3-5) i odjęcie biasu żyroskopu (EMA w spoczynku)
  → SEGMENTACJA po energii ruchu: start, gdy |żyro| > 20 °/s (albo szarpnięcie akcelerometru)
      przez 2 próbki; koniec, gdy energia spadnie poniżej max(10 °/s, 12 % szczytu) na 200 ms
  → cechy: wygładzenie, przepróbkowanie gestu do 40 punktów w czasie, wybór osi
  → DTW (Dynamic Time Warping, krok symmetric2, pasmo Sakoe-Chiba 20 %) do każdego nagranego wzorca
  → podobieństwo 0–100 % + osobne bramki: intensywność (stosunek energii) i czas trwania
  → ≥ próg → zdarzenie „gest X" (raz na segment, cooldown 300 ms)
```

Wzorzec to 1–3 nagrania tego samego gestu. Z ich wzajemnego podobieństwa program **sam proponuje
próg** (najniższe podobieństwo parami − 10 pkt), a przy nagrywaniu nowego gestu **ostrzega, gdy jest
za blisko już zapisanego** (≥ 80 %) — to zastępuje ręczne zgadywanie liczb.

## Pokrętła, które widziałby użytkownik

| Pokrętło | Parametr | Co robi | Domyślnie |
|---|---|---|---|
| **Podobieństwo** | `threshold` | jak wiernie trzeba powtórzyć kształt gestu | 70 % (albo auto z nagrań) |
| **Intensywność** | `intensityTol` | dopuszczalny stosunek siły wykonania do nagrania (2.0 = od połowy do dwukrotności; 0 = bez znaczenia) | 2.0 |
| **Tempo** | `durationTol` | to samo dla czasu trwania całego gestu | 1.8 |
| **Osie** | `channels` | `gyro` (obrót, niezależny od tego, jak kapsel leży), `both` (+ akcelerometr: stuknięcia, położenie), `accel`, `magnitude` (bez kierunku) | `gyro` |
| Tolerancja tempa *wewnątrz* gestu | `band` | ile DTW może przesuwać fragmenty w czasie | 0.2 |
| Sam kształt | `shapeOnly` | podobieństwo ignoruje amplitudę; o sile decyduje tylko Intensywność | tak |
| Przerwa kończąca gest | `endHoldMs` | jak długa cisza zamyka gest (dwuklik z dłuższą przerwą → podnieś) | 200 ms |

Wszystkie mają sens fizyczny i da się je pokazać na żywo: „ostatni ruch był podobny w 84 %,
1,1× mocniejszy, 0,9× krótszy".

## Wyniki na ruchu syntetycznym (`evaluate.py`, pełny bieg)

Generator (`synth.py`) tworzy pakiety w układzie kanałów prawdziwego kapsla z orientacją całkowaną
tym samym wzorem, co `PoseFilter`. 7 gestów (potrząśnięcie, machnięcie w prawo i w lewo, kiwnięcie,
kółko, zygzak, podwójne stuknięcie) + 4 „ruchy codzienne" (spoczynek, powolne pochylanie jak myszą,
podniesienie z biurka, machanie bez sensu). Każde wykonanie dostaje losowe odchyłki: amplituda i tempo
do ±40 %, obrót osi ruchu do 20° (inny chwyt), nieliniowe tempo, przechył startowy do 30°, drżenie
ręki, szum czujnika, bias żyroskopu — skalowane poziomem *mały / średni / duży*.

| Osie | Nagrań wzorca | mały | średni | duży | pomyłki między gestami | fałszywe odpalenia (ruch codzienny) |
|---|---|---|---|---|---|---|
| **gyro** | 3 | 99,0 % | 99,0 % | 93,3 % | 0 % | 0 % |
| gyro | 1 (próg stały 70 %) | 97,6 % | 96,7 % | 87,6 % | ≤ 0,5 % | ≤ 0,8 % |
| both | 3 | 99,0 % | 99,0 % | 86,7 % | ≤ 0,5 % | 0 % |
| magnitude | 3 | 83 % | 85 % | 80 % | 14–16 % | 3–13 % |

Pozostałe ustalenia:

- **Próg podobieństwa** (gyro, 3 nagrania, poziom średni): 60–70 % → 99 % rozpoznań i 0 % fałszywych;
  80 % → 91 %; 90 % → 80 %. Przy 50 % pojawia się 2,5 % fałszywych. Sensowny zakres dla użytkownika: 60–85.
- **Intensywność** działa jak obiecuje: tolerancja 1,5 przepuszcza wykonanie 1× (90 %), a odrzuca
  0,5× i 2× (≤ 3 % przyjęć). Z bramką wyłączoną i trybem „sam kształt" 0,5× i 2× przechodzą w 83–95 %.
- **Tempo**: dzięki przepróbkowaniu gest 2× szybszy albo 2× wolniejszy jest rozpoznawany w 99–100 %,
  gdy tolerancja czasu jest wyłączona; przy 1,8 odrzuca je zgodnie z ustawieniem.
- **Ciągły strumień** 165 s z 46 gestami i 34 ruchami codziennymi wmieszanymi losowo:
  **46/46 trafień, 0 pomyłek, 0 fałszywych alarmów**; decyzja po medianie 140 ms (max 200 ms)
  od końca gestu. Te same wzorce z osiami `both`: 34/46 — akcelerometr przegrywa, bo ten sam obrót
  daje inną zmianę grawitacji z innego przechyłu startowego, a po serii gestów kapsel leży inaczej
  niż przy nagraniu. Stąd `gyro` jako domyślne.
- **Koszt** (czysty Python, bez numpy): segmentacja 3 µs na próbkę; klasyfikacja 2,8 ms na gest
  przy 21 wzorcach (0,13 ms na wzorzec) — raz na gest, nie na próbkę. Strumień 50 Hz zjada 0,15 %
  czasu rzeczywistego.
- **Tryb `magnitude`** (bez kierunku, niezależny od chwytu) odpada jako domyślny: z definicji nie
  odróżnia lustrzanych gestów i ma kilkunastoprocentowe fałszywe odpalenia.

## Test end-to-end na strumieniu aplikacji

`live.py` czyta `GET /stream?dev=…` (zdarzenia `s`, ~49 Hz zmierzone) z działającej aplikacji
i nagrywa albo rozpoznaje gesty. Sprawdzone na osobnej kopii aplikacji w symulacji (port 8846,
`--simulate --no-keys --allow-multi`), gdzie „ręką" był skrypt sterujący wirtualnym kapslem przez
`POST /virtual` — czyli tą samą drogą, co widżet 3D w panelu:

- `record --name nod --takes 3`: trzy nagrania po 0,72–0,76 s, spójność 95–96 %, proponowany próg 85 %;
  `record --name flick`: spójność 97 %, próg 87 %, ostrzeżenia brak (do „nod" 31 %).
- `check` (walidacja krzyżowa, każde nagranie vs wzorce z pozostałych): 6/6 trafień, własny gest
  96–97 %, najbliższy inny ~30 %.
- `match --all` na żywo, sekwencja nod · flick · *shake* · nod · *circle* (kursywą gesty nienagrane):
  nod 96 % ✓ · flick 98 % ✓ · shake 40 % odrzucone ✓ · nod 97 % ✓ · circle 48 % odrzucone ✓.

## Środowisko testowe: laboratorium gestów (`lab.py`)

Strona w przeglądarce do prób na prawdziwym kapslu i do strojenia. Kapsel łączysz jak zwykle
w RibbitFlipie (laboratorium czyta jego strumień `/stream`, więc aplikacja musi działać; najlepiej
z wyłączonym **Uzbrojone** albo z `--no-keys`, żeby próby nie naciskały klawiszy):

```bash
py tools/gesture_proto/lab.py
```

Otwiera się `http://127.0.0.1:8790/`. Laboratorium samo bierze **ten kapsel, który wysyła dane**
(slot nie ma znaczenia: Triki 5 na d4 jest widziany tak samo jak d0); konkretny slot da się wymusić
w Zaawansowanych albo przez `--dev d4`. **Tryb prosty** (cała pierwsza strona, pomyślany dla
kogoś bez wiedzy technicznej): naciśnij **● Nagraj**, wykonaj gest 3 razy z krótkimi przerwami
(licznik ✓ 1/3, 2/3, 3/3 — koniec sam; **■ Zakończ** kończy wcześniej z tym, co się zebrało),
a potem wykonaj gest jeszcze raz — jego karta zaświeci się na zielono i pokaże podobieństwo.
Jeden suwak **„Jak dokładnie trzeba powtórzyć gest?"** (luźno … dokładnie) ustawia naraz próg
podobieństwa oraz tolerancję siły i tempa; po lewej stronie siła i tempo nie mają znaczenia.
Każde powtórzenie zostaje osobnym wzorcem — przy rozpoznawaniu wygrywa najbliższe — a ze zgodności
powtórzeń wynikają ostrzeżenia: „powtórzenia bardzo się różnią", „zgodność niższa niż wymagana
dokładność", „bardzo podobny do innego gestu — będą się mylić". Karta gestu ma pole **klawisz**
(po rozpoznaniu laboratorium woła `/test-key` aplikacji — działa tylko przy Uzbrojone), **↻ dograj**
(dokłada powtórzenia) i 🗑.

**Zaawansowane** (zwinięte na dole, dla strojenia): adres aplikacji i wybór kapsla, oscyloskop
energii ruchu z progami startu i końca oraz zaznaczonymi segmentami, krzywe ostatniego ruchu na tle
najbliższego wzorca, dziennik każdego ruchu z trzema kandydatami (podobieństwo, siła, tempo, dlaczego
odrzucony), wszystkie parametry działające od razu i zapisywane w `lab_settings.json`, nagrywanie
z odliczaniem 3‑2‑1 i własnym progiem gestu, walidacja krzyżowa nagrań z kolizjami oraz **sesja
testowa**: wybierasz gest, wykonujesz go np. 10 razy, laboratorium liczy trafione / pomylone /
pominięte (albo fałszywe odpalenia przy zwykłym ruszaniu kapslem). Wzorce to te same pliki
`templates/*.json`, które czyta `live.py`.

Bez sprzętu: kopia aplikacji w osobnym folderze w trybie `--simulate --allow-multi --port 8846`,
laboratorium `--url http://127.0.0.1:8846`, a gesty wykonuje `virtual_hand.py` (prowadzi wirtualny
kapsel przez `/virtual`). Tak właśnie sprawdzono cały tor: nagranie 1 i 3 powtórzeń, rozpoznanie
kolejnych kiwnięć (96–97 %), odrzucenie innego gestu (22 %), ostrzeżenie o kolizji dwóch nagrań
tego samego ruchu (96 %).

## Co trzeba sprawdzić na PRAWDZIWYM kapslu (jeszcze nie zrobione)

Syntetyk zakłada szum żyroskopu ~0,5 °/s i drżenie ręki ~2 °/s; prawdziwe liczby, sposób trzymania
kapsla i to, jak ludzie naprawdę powtarzają gesty, może zweryfikować tylko sprzęt. Przy działającej
aplikacji (8770, kapsel połączony, może być `--no-keys`):

```bash
py tools/gesture_proto/live.py record --name potrzasniecie --takes 3
```

```bash
py tools/gesture_proto/live.py record --name obrot-w-prawo --takes 3
```

```bash
py tools/gesture_proto/live.py check
```

```bash
py tools/gesture_proto/live.py match --all
```

`check` mówi, czy nagrania rozpoznają się nawzajem i które gesty kolidują; `match --all` pokazuje
każdy wycięty ruch z trzema najlepszymi kandydatami, więc od razu widać, jak stroić pokrętła
(`--threshold`, `--channels both`, `--intensityTol 0`, `--band 0.3`, `--endHoldMs 300`…). Nagrania
zostają w `templates/*.json` z surowymi próbkami, więc parametry zmienia się bez ponownego nagrywania.
Na co patrzeć: spójność ≥ 80 % przy nagrywaniu, brak fałszywych odpaleń przy zwykłym „kręceniu
kapslem jak myszą", stuknięcia (jeśli mają być gestem → `--channels both`).

## Szkic wdrożenia w aplikacji (na później, po teście sprzętowym)

1. **Silnik**: `Spotter` + `Recognizer` per kapsel, karmione z `Pipeline.handle()` tuż obok
   `trig.on_sample()` — segmentacja to 3 µs na próbkę, DTW liczy się raz na gest (2–3 ms), więc może
   zostać w wątku danych albo iść przez kolejkę do wątku wyzwalaczy.
2. **Nowe źródło reguły** obok `axis / button / filter / trigger`: `{"kind": "gesture", "id": "…"}`
   z zachowaniem `once` (gest jest zdarzeniem; `hold` nie ma sensu). Reszta reguły — akcja, warstwa,
   LED, toast, makro — bez zmian; `TriggerEngine` widzi po prostu krótki impuls warunku.
3. **Nagrania** w `Settings/ribbitflip_gestures.json` per kapsel: surowe próbki (żeby zmiana
   pokręteł nie wymagała ponownego nagrywania), kalibracja osi z chwili nagrania, próg. Zestaw
   (bundle) może je nieść jak każdą inną konfigurację; nagranie niesie charakterystykę ruchu, ale
   żadnych danych osobowych — w UI napisać to wprost (jak w notatce BACKLOG o nagrywaniu).
4. **UI w edytorze reguły**: przełącznik „Ręcznie / Nagrany gest"; przy gestach przycisk
   **Nagraj** (3 powtórzenia z odliczaniem), pasek spójności i auto-próg, ostrzeżenie o kolizji
   z innym gestem, **licznik na żywo** „ostatni ruch: 84 %, 1,1×, 0,9×" i trzy suwaki
   (Podobieństwo, Intensywność, Tempo) z sekcją zaawansowaną (osie, przerwa kończąca).
5. **Współistnienie z ruchem ciągłym** (air-mouse, drążek): rozpoznawanie działa równolegle, ale gest
   wykonany *w trakcie* ciągłego ruchu zamyka się dopiero po uspokojeniu albo po 2,5 s; w praktyce
   gesty powinny być krótkimi wtrąceniami między ruchem, a najlepiej mieć własną warstwę.

## Ograniczenia i ryzyka

- **Brak testu na sprzęcie** — to jest główny brak; liczby wyżej są z modelu.
- Gesty **zawierające się w sobie** (pojedyncze machnięcie kontra zygzak na tej samej osi) dostają
  80–90 % podobieństwa. Gdy oba są nagrane, wygrywa właściwy (klasyfikacja po najlepszym), ale gdy
  nagrany jest tylko krótszy, dłuższy też go odpali. Stąd ostrzeżenie o kolizji przy nagrywaniu.
- **Stuknięcia** w domyślnym trybie `gyro` są słabo widoczne (w syntetyku 12 °/s); realny kapsel
  w dłoni zwykle obraca się przy stuknięciu, ale to trzeba zmierzyć. Opcja `both` je widzi.
- **Sufit czujnika ±250 °/s**: bardzo energiczne gesty są obcinane. Kształt po obcięciu jest
  powtarzalny, więc rozpoznawanie działa, ale bramka intensywności traci sens powyżej sufitu.
- **Pakiety BLE w paczkach** (kilka z tym samym znacznikiem czasu): `live.py` wygładza zegar próbek;
  w aplikacji lepiej nadawać czas przy źródle, tak jak robi to teraz `Pipeline`.
- **Opóźnienie** decyzji ≈ przerwa kończąca (200 ms) + ~40 ms; da się skrócić kosztem dwukliku.

## Pliki

| Plik | Rola |
|---|---|
| `gesture_dtw.py` | rdzeń: segmentacja (`Spotter`), cechy, DTW, wzorce (`Recognizer`), złożenie (`Detector`) |
| `synth.py` | syntetyczny kapsel i biblioteka gestów z odchyłkami |
| `evaluate.py` | benchmark z kryteriami PASS/FAIL (`--quick`, `--with-amplitude`) |
| `live.py` | nagrywanie / dopasowywanie / walidacja na żywym strumieniu aplikacji |
| `templates/` | nagrania z `live.py record` (tworzy się przy pierwszym nagraniu) |
