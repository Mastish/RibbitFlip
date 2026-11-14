# Motywy RibbitBeat: kontrakt dla autorów (2026-10-09)

Stopnie progresji mają się od siebie **wyraźnie różnić** („nie pięć wariacji smoka”), być
tematyczne (Halloween, 8-bit…), a całość ma się odblokować w jedno popołudnie. Dlatego stopień = **motyw**: jeden plik
`motywy/<id>.js` przestawia naraz kartę toru, taśmy nut, klawiaturę, tło, widownię i efekt serii (streak).
Mechanikę (rejestr, budowa czterech drabinek, most do stylów nut) ma `js/motywy.js`; przeczytaj jego nagłówek.

## Zasada nadrzędna: inny JĘZYK WIZUALNY, nie inny kolor

Motyw musi być rozpoznawalny na zrzucie w miniaturze 160×90. Zmienia **technikę rysowania** (piksele, tusz i raster,
ołówek, neon, pod wodą), nie tylko barwę. Najbardziej widoczne są: karta toru (zajmuje ~80 % ekranu), taśmy nut, efekt
przy głowie żaby i pas widowni. Tło widać tylko w ramie wokół kart, więc to nie ono niesie motyw.

## Runda 2 (2026-10-09 wieczór): dopracowane, nie tandetne

Pierwsza wersja wyglądała tandetnie i niedopracowanie. Przyczyny: motyw siedział tylko w
ramce i pasku widowni, a karta (80 % ekranu) wszędzie była prawie ta sama; rzędy identycznych cliparów rysowanych
kółkami; napisy-naklejki (POW!, ZIP!, 1UP); kolory nut zlewające się z kartą; pół motywu w innej technice. Od teraz:

0. **Język marki: filc i drobne elementy DIY**. Każdy motyw to ten sam materiał (filc ze ściegiem,
   guziki, włóczka, haft, cekiny, koraliki hama, taśma washi), a różni się tematem i techniką rękodzieła: 8-bit = piksele z
   koralików hama i haftu krzyżykowego, Halloween = filcowe dynie i pajęczyny z włóczki, Komiks = aplikacje z konturem z
   czarnej nici, Synthwave = neonowy haft na ciemnym filcu, Szkicownik = scrapbook z washi i filcowymi naklejkami itd.
   Rysowanie w kodzie (nuty, karta, klawisze, poświaty) ma to naśladować: ścieg (przerywany obrys), faktura filcu,
   „szwy”, guziki, koraliki, nitki, a nie gładkie wektory, neonowe gradienty ani pixel art z ekranu.
1. **Ilustracje zamiast cliparów z kodu.** Każdy motyw ma grafiki wygenerowane z logo jako wzorem w
   `web/assets/motywy/<id>/`: `tlo.webp` (scena), `zaba-0.webp`/`zaba-1.webp` (żaba gracza w kostiumie motywu, buzia
   zamknięta / śpiew, 192×192), `fan-0..5.webp` (sześciu różnych fanów, wysokość 256), `iskra-0..5.webp` (drobiazgi
   streaka, 96×96). Wczytywanie: `Motywy.zasob(id, plik)` zwraca obrazek albo null (jeszcze się wczytuje: narysuj nic
   albo prosty zamiennik), `Motywy.cover(c, im, x, y, w, h, ax, ay)`. W definicji motywu: `zasoby:[lista plików]`
   (gra ładuje je w lobby) i `zaba:true` (gra podmienia żabę gracza na `zaba-0/1`).
2. **Cały ekran w jednej technice i palecie.** Tło = `tlo.webp` na cały ekran (cover, statycznie, w `rysuj2d`), z
   lekką winietą albo przyciemnieniem tylko tam, gdzie trzeba czytelności. Karta toru = **szyba** w kolorze z palety
   motywu z prześwitem (`tlo.przeswit` 0,15–0,4), przez którą widać ilustrację; faktura karty subtelna, jedna technika,
   bez rekwizytów na karcie.
3. **Nuty czytelne przede wszystkim.** Kolor i obrys taśm dobrane do karty (kontrast), technika motywu (piksele, tusz,
   neon, ołówek), bez ozdobników kosztem czytelności. Pasek partii gracza i wypełnienie celnością muszą być widoczne.
4. **Widownia z `fan-*.webp`.** Rząd fanów w pasie widowni, różne sprite'y obok siebie (nigdy dwa takie same obok),
   lustrzane odbicia dla różnorodności, skok w rytm (`faza`), wyżej przy kombo (`skok`, `zar`), w `spokoj` bez ruchu.
   Tylko `drawImage` z bufora; bez napisów i dymków.
5. **Streak**: cząstki z `iskra-*.webp` (pula, mało, czytelnie) + czysta poświata/ślad w palecie motywu. Bez napisów.
6. **Zakaz**: napisów-naklejek (POW, ZIP, WOW, 1UP, KOMBO itp.), rzędów identycznych rysunków, rysowania postaci i
   rekwizytów kółkami i prostokątami, różu na różu, mieszania technik (np. gładkie nuty w 8-bit).
7. Wydajność bez zmian (sekcja niżej): ilustracje są statyczne, sprite'y z bufora, zero `filter`/`shadowBlur` w klatce.

## Runda 4 (2026-10-16): przebranie żaby zamiast efektu głowy

Efekty wokół głowy żaby często wyglądały brzydko, więc zamiast nich zmienia się wygląd samej śpiewającej żaby
(inne akcesoria podczas śpiewania). Motyw z `przebranie:true` ma w `web/assets/motywy/<id>/` sześć klatek głowy żaby z logo
w kostiumie motywu: `glowa-c.webp` (cicha, plaster na pysku) i `glowa-0..4.webp` (pysk jak `assets/frog/sing-0..4-96.png`),
160 × 160 px na pole 144 jednostek sprite'a 96 × 96 o środku w (48, 48) (`Motywy.PRZEBRANIE`). Żaba gracza nosi przebranie
motywu swojego efektu (tor streak), a gra NIE woła wtedy `glowa` (efekt za głową), więc w nowych motywach `glowa(){}` jest
pusty: sygnatura motywu idzie w ślad, iskry, płonącą nutę i aurę. Filc zostaje bez przebrania (żaba z logo i jej efekt).
Arkusze generuje Codex po 2 motywy × 6 klatek w jednym obrazie (skrypty `zadania.py`, `generuj.py` poza repozytorium), a tnie
je `tnij.py` (składowe spójne arkusza, wyrównanie klatek po kostiumie, głowa w miejscu żaby z logo). Druga runda tego samego dnia (irokez wystawał, akcesoria wyglądały na doklejone): głowy bez irokeza, przeprojektowane
w całości w motywie (`arkusz2`/`STYLIZ`), skalowane z obrysu do 108 jednostek, gdy skóry jest mało. Nawiązania
(10-16): 8-bit = czapka bohatera starych platformówek, Piraci = filmowy kapitan z dredami, Dziki Zachód = rewolwerowiec
w poncho, Disco = biały garnitur i czub z filmu o gorączce sobotniej nocy; hołdy bez logo i liter.

### Ruch widowni (10-16)
Fana rysuj przez `Motywy.fan(c, b, x, dol, st, styl, i)` (środek `x`, stopy na `dol`): styl ruchu pasuje do tematu
(`poklatkowo`, `bujanie`, `fala`, `poklad`, `headbang`, `upior`, `disco`, `tupanie`, `akrobata`, `niewazkosc`, `zabi`,
`groove`, `pop`, `szkic`, `obrot`, `koleda`, `uklon`, `podrzut`, `skok`; opis w `motywy.js` przy `ruchFana`). Arkusz widowni
generuj w siatce 3×2 z odstępami, bo postacie stykające się w rzędzie nie dają się wyciąć bez ucięć.

## Runda 5 (2026-10-17): 29 motywów, dodatkowi tancerze, dwa motywy poza filcem

Dziesięć nowych motywów (kuchnia, szachy, voodoo, gielda, muchomor, zloto, olimp, kredki, prawdziwy, einstein; kolejność 21–30) wg
wspólnego briefu, grafiki skryptami poza repozytorium (zadania.py → generuj.py → obrob.py). Zasady jak w rundzie 4
(przebranie, `glowa(){}`, sygnatura w śladzie i iskrach), plus:
- **Widownia może mieć więcej niż 6 sprite'ów**: `fan-6..11.webp` to dodatkowi tancerze (koguciki w `wycinanka`, bałwany w
  `sweter`, totemy w `tiki`); `FANY=12`, a permutacja w `rzad()` idzie po `FANY`, nie po sztywnych 6.
- **Dwa motywy celowo łamią język filcu**: `kredki` = rysunek dziecka kredkami na wyciętym papierze,
  `prawdziwy` = fotorealizm (bez ściegu, `scieg:false`/`scieg:null`). Każdy inny motyw nadal trzyma się filcu i DIY.
- Zmiany nazw bez zmiany id: `wycinanka` = „Słowiańska” (Slavic), `sweter` = „Zima” (Winter), `sashiko` = „Sushi” (10-18: cały
  motyw przerobiony na knajpę sushi z sushi masterem i 12 tańczącymi kawałkami sushi).
- Liczba fanów w rzędzie: `Motywy.ileFanow(ID,W,fh,x)` (z realnej szerokości sprite'ów, 3–48), nie sztywne `Math.min(18, …)`;
  gra sama rysuje ciemny pas ziemi na stopach fanów (`Motywy.zaslonaStop` w `rysujWidownie`), więc ucięte doły sprite'ów nie rażą.
- Pomiar po rundzie 5 (spokojna maszyna, `--uklad siatka --boty 4 --fps`): p95 JS klatki 2,9–3,5 ms, `kredki` 3,1–4,3 ms (trzy pomiary), `filc` 3,8 ms.

## Runda 6 (2026-10-19): Kukiełki (31 motywów)

`kukielki` (kolejność 31, rzadki; „Puppets” po angielsku): teatr kukiełkowy z filcu, dwanaście zmyślonych, losowych kukiełek w stylu
telewizyjnych kukiełek rewiowych na widowni (`fan-0..11`, `FANY=12`, ruch `pop`), żaba w kołnierzu z zębami z filcu jako przebranie,
iskry to rekwizyty rzucane na scenę. ⭐ Pierwsza wersja widowni była za bardzo podobna do znanych kukiełek telewizyjnych, więc
postacie są wymyślone, bez nawiązań do znanych bohaterów; nie wracaj do opisów typu „niebieski potwór z ciasteczkiem”.
Grafiki: skrypty poza repozytorium (`zadania.py` → `generuj.py` → `obrob.py`; ikona instrumentu Krzyk: `ikona.py`). Skrót z
osiągnięcia „Wrzask na scenie” (zaśpiewaj piosenkę na instrumencie Krzyk) otwiera scenę Kukiełek.

## Definicja (Motywy.dodaj)

```js
Motywy.dodaj({id, nazwa, kolejnosc, kolor, opis,
  cechy:{tlo, klawisze, streak, widownia},          // 2–4 słowa per tor, po polsku
  en:{nazwa, opis, cechy:{tlo, klawisze, streak, widownia}},   // to samo po angielsku (gra w EN, js/jezyk.js); obowiązkowe
  karta:{papier, cien, czarne, liniaC, minione, nazwy, kreski, nic, szpilka, szpilkaBlask, cienNuty, scieg, rysuj(c,L,st)},
  tlo:{…}, klawisze:{…}, nuty:{…}, streak:{…}, widownia:{…}});
```
Każda część to albo `{z:"id"}` (gotowy stopień z efekty-*.js / efekty.js / efekty-nuty.js), albo własny wpis z hakami.
`id` motywu NIE zmieniaj (zapis graczy, osiągnięcia-skróty w postepy.js na nie wskazują).

### karta (paleta i faktura karty toru) — rysowane RAZ na układ do bufora
Pola kolorów jak w `KARTA` w motywy.js. `rysuj(c, L, st)`: faktura karty (siatka pikseli, kratka, raster), w przycięciu
do karty, POD rzędami półtonów, klawiaturą i nazwami dźwięków. `L`: `{x,y,w,h,teraz,kx,kw,rh,dolN,goraN,gorna,rzedy}`.
Ciemna karta = jasne `nazwy`, `kreski`, `liniaC`; czytelność taśm nut i główek ma pierwszeństwo.

### tlo — `rysuj2d(c, st)`: STATYCZNE (celowo: tła nie ruszają się)
Gra składa `#tlo` tylko przy zmianie układu i skokach światła ognia, więc `rysuj2d` może kosztować do ~20 ms, ale nie
licz na animację. Rysuj w px CSS na całe `st.W × st.H`. Pola: `przeswit` (0–0,2), `rama` (true = karty odsunięte od
brzegów, widać więcej tła; obiekt `{bok,gora,dol,odstep}`), `scieg:false` (bez ściegu kart), `tlo:{promienie:[["r,g,b",a],…], swiatlo:["r,g,b","r,g,b"]}`
(kolory promieni i światła ognia pod kartami), `nadKartami(c,st)` (2D na kartach przy złożeniu, też statyczne).
Shader GL (`shader`, `klatka`) jest dozwolony, ale niepotrzebny: tło i tak stoi.

### klawisze — `tlo(c, L, st, domyslna)` statycznie do bufora + `gracz(c, L, g, st)` co klatkę
`domyslna(c,L)` rysuje zwykłą klawiaturę. `gracz` = podświetlenie śpiewanego klawisza i drobne efekty (co klatkę, tanio).
Pomocnicze globale gry: `prostokatKlawisza(L,s)`, `ySemi(L,s)`, `isBlack(s)`. Ogień NIGDY nie pali klawiszy.

### nuty — styl taśmy nut (kontrakt w nagłówku efekty-nuty.js)
`cialo(c, w, nh, o)`: ciało taśmy w przycięciu do jej ścieżki, środek w (0,0), `o={ep, ziarno, minela}`;
`poza(c,w,nh,o)` dodatki poza obrysem; `brzeg(ep)` kolor obrysu; `zapas(nh)` px wystawania dodatków. Opcjonalnie
piętra jak w „Upiornej nocy”: `granice`, `epoka`, `znak`. Pasek partii (kolor gracza), główki i wypełnienie celnością
rysuje gra NA Twoim ciele: zostaw je czytelne. ⚠️ Nadjeżdżające nuty idą do bitmap (raz), ale nuta na linii i miniona
rysuje się CO KLATKĘ: `cialo` ma być tanie (≤ ~10 wywołań, gradienty i wzory z pamięci podręcznej, nie tworzone co
wywołanie), deterministyczne z `ziarno`, bez `filter`/`shadowBlur`.

### streak — efekt serii przy głowie żaby
Kształt wpisu `Efekty.STREAKI` (efekty.js: zobacz `pixel`, `konfetti`, `neon` jako wzór) + haki z efekty-streak.js:
`glowa(c,sc,og,ts,z,przod)` (rysuj TYLKO przy `przod===false`: efekt za głową, jak „unusual” w TF2), `slad(c,k)`,
`nuty(c,w,nh,fx,p,ts,z,a,g)` (płonąca nuta), `aura`, `wypelnienie:[3 kolory]`, `scena:["r,g,b"×3]`, `iskry:{kolory,ksztalt?}`,
`dym` (kolor albo false), `tlo:{promienie,swiatlo}`, `tor(c,L,g,st)` co klatkę, `zerwanie(L,g,st)` raz przy zerwaniu
kombo. Poziom ognia `og` 0–3 rośnie z kombo 4/8/12. W grafice uproszczonej gra używa zawsze domyślnego ognia.

### widownia — `rysuj(c, Wd, st)` co klatkę + `fx(st)` opcjonalnie
`Wd={y,h}` pas widowni na dole, `st` z `Efekty.stan` (zobacz `rysujZaby`, `rysujZapalniczki` w efekty.js): `n`, `krok`,
`faza` (LICZBA ćwierćnut), `skok`, `spiewaja`, `zar`, `wyniki`, `ap` (brawa), `kolor`, `akcent`, `spokoj`, `bezRuchu`.
Rysunki postaci buforuj (`bufor(klucz,szer,wys,rysuj)` z gry, klucz zależny od rozmiaru i koloru), w klatce tylko
`drawImage` z przesunięciem w rytm.

## Wydajność (gra rytmiczna: ścinka = błąd)

- Zero `filter`, `shadowBlur`, `getImageData` w klatce. Gradienty, wzory i postacie z pamięci podręcznej.
- Co klatkę: widownia ≤ ~40 wywołań rysujących, streak `tor`+`glowa`+`slad` ≤ ~40 na gracza, klawisze `gracz` ≤ ~10.
- Bez alokacji w gorącej ścieżce (pule cząstek, tablice wielokrotnego użytku, kolory jako gotowe napisy).
- Pomiar: `--fps` w narzędziu zrzutów podaje czas JS klatki p50/p95 (headless: fps nie są wiarygodne, JS jest).
  Cel: p95 JS ≤ 4 ms przy `--uklad siatka --boty 4`. Porównaj z motywem `filc` z tej samej serii.

## Grafika pixel-art (8-bit) i podobne

Rysuj do małego płótna (np. 1/4 rozdzielczości) w `bufor()`, potem `drawImage` z `c.imageSmoothingEnabled=false`.
Pamiętaj o dpr: bufory gry mają dpr wbudowany, rysuj je w px CSS.

## Narzędzie zrzutów (skrypt poza repozytorium; NIE otwieraj widocznych okien ani pełnego ekranu: ktoś może grać w tle)

```
node zrzut_stopnia.mjs --tor motyw --stopien <id> --out motyw-<id>.png
  … --kombo 0            (bez serii)        … --wyniki          (ekran wyników)
  … --spokoj             (grafika uproszczona) … --gl 0          (silnik w 2D)
  … --uklad siatka --boty 4 --fps          (4 tory, pomiar)
node zrzut_stopnia.mjs --tor motyw --arkusz           (wszystkie motywy → arkusz-motyw.png)
```
Narzędzie samo uruchamia serwer gry na porcie 8781. Błędy konsoli wypisuje na końcu (kod wyjścia 1).

## Teksty
Po polsku, naturalnie, bez pauz „—” w tekstach dla gracza. Komentarze w kodzie po polsku, zwięźle, w stylu reszty.
