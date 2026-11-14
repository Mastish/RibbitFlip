// ŻABI CHÓR (web/gry/) — czyste funkcje gry w Node, bez przeglądarki i bez serwera.
//
// Funkcje i stałe są WYCINANE z plików gry po nazwie (jak devices_hub_harness.mjs), więc test pilnuje
// prawdziwego kodu, a nie jego kopii. Wejście (wejscie.js) idzie w całości, z atrapami window.
// Wywoływane z tests/test_gry_zabi_chor.py z argumentami: ścieżki do plików MIDI wygenerowanych przez
// test (cztery głosy, format 0, fortepian na dwie ręce, nie-MIDI). Na wyjściu ostatnia linia to JSON
// {checks:[[nazwa, ok, szczegół], …]}.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const GRY = path.join(REPO, "web", "gry", "js");
const checks = [];
const ck = (name, ok, detail) => checks.push([name, !!ok, detail === undefined ? "" : String(detail)]);
const zrodlo = {};
const czytaj = f => (zrodlo[f] = zrodlo[f] || fs.readFileSync(path.join(GRY, f), "utf8"));

// Koniec wyrażenia: liczy nawiasy (), [], {} z pominięciem napisów i komentarzy.
function domknij(src, od, naSredniku) {
  let d = 0, q = null;
  for (let k = od; k < src.length; k++) {
    const c = src[k];
    if (q) { if (c === "\\") { k++; continue; } if (c === q) q = null; continue; }
    if (c === "'" || c === '"' || c === "`") { q = c; continue; }
    if (c === "/" && src[k + 1] === "/") { k = src.indexOf("\n", k); continue; }
    if (c === "/" && src[k + 1] === "*") { k = src.indexOf("*/", k) + 1; continue; }
    if (c === "(" || c === "[" || c === "{") d++;
    else if (c === ")" || c === "]" || c === "}") { d--; if (d === 0 && !naSredniku) return k + 1; }
    else if (c === ";" && d === 0 && naSredniku) return k + 1;
  }
  throw new Error("niedomknięte wyrażenie od " + od);
}
function funkcja(plik, nazwa) {
  const src = czytaj(plik), i = src.indexOf("function " + nazwa + "(");
  if (i < 0) throw new Error(nazwa + " nie ma w " + plik);
  const od = src.slice(Math.max(0, i - 6), i) === "async " ? i - 6 : i;   // funkcje async (folder) razem z „async”
  return src.slice(od, domknij(src, src.indexOf("{", src.indexOf(")", i)), false));
}
function stala(plik, nazwa) {
  const src = czytaj(plik), i = src.indexOf("const " + nazwa + "=");
  if (i < 0) throw new Error(nazwa + " nie ma w " + plik);
  // `const A=…,B=…;` też jest jedną stałą do wycięcia: bierzemy do średnika na zerowej głębokości
  return src.slice(i, domknij(src, i, true)).replace(/^const /, "var ");
}

const ctx = { console, Math, Number, JSON, Array, Object, Map, Set, String, DataView, Uint8Array, Error, Infinity };
vm.createContext(ctx);
const run = kod => vm.runInContext(kod, ctx);
try {
  for (const s of ["NN", "nameOf", "isBlack", "BUILTIN", "noteName", "METHOD_NAME", "b64", "unb64", "ZC_TEMPO_GRY", "ZC_POWTORZ", "ZC_PODKLAD", "ZC_GM_PERKUSJA"])
    run(stala("piosenki.js", s));
  for (const f of ["midiOf", "parseBars", "midiMelody", "analyseSplit", "assignHandsBeam", "splitHands", "splitLabel",
    "reduceForTwoHands", "densityOf", "autoSplit", "parseMidiFile", "mapaTempa", "tickGry", "sumyTaktow", "opiszPartie", "domknijPiosenke",
    "zrodloZNotacji", "jednoglosowa", "zrodloZMidi", "zrodloZPliku", "parametryDomyslne", "domyslnyPodklad", "poprawParametry", "podzielPonownie",
    "tloPiosenki", "fragmentNut", "perkusjaPiosenki", "fragmentPerkusji", "piosenkaZeZrodla", "piosenkaZNotacji", "wbudowanePiosenki", "piosenkaZMidi", "piosenkaZPliku", "skrotBajtow", "sha256Hex"])
    run(funkcja("piosenki.js", f));
  for (const s of ["T", "ZC_PUNKTY", "ZC_MAKS_TOROW", "ZC_KUM", "ZC_APLAUZ", "ZC_TORY_STYL", "ZC_TRUDNOSC", "ZC_TRAFIONE", "ZC_KLIK"]) run(stala("zabi-chor.js", s));
  run(stala("biblioteka.js", "ZC_BIBLIO"));
  run(stala("tablica.js", "ZC_TABLICA"));
  for (const f of ["nazwaDoKlucza", "kluczZNazwy", "kluczUtworu", "przeniesStaryKlucz", "procentRuchuTablicy", "pomocTablicy", "konfiguracjaGry", "konfiguracjaGracza", "toryWGrze", "podpisKonfiguracji", "opisKonfiguracji", "wpisTablicy",
    "porownajWpisy", "ludzkiWpis", "filtrujWpisy", "miejsceWpisu", "rekordZTablicy", "scalWpisy", "przytnijWpisy"]) run(funkcja("tablica.js", f));
  run(stala("biblioteka.js", "ZC_PP_TAKT_MIN"));   // razem z ZC_PP_PX_CWIERC i ZC_PP_PAD (jedna instrukcja const)
  for (const s of ["ZC_PAK", "ZC_LICENCJE"]) run(stala("pakiety.js", s));
  for (const f of ["licencjaWpisu", "liniaAtrybucji", "fmtMB", "adresZeSchowka"]) run(funkcja("pakiety.js", f));
  for (const f of ["tytulZNazwyPliku", "idZNazwyPliku", "nazwaPlikuDoZapisu",
    "zapiszParametryWpisu", "scalParametry", "daneDoFolderu", "akcentPiosenki", "listaMidiWFolderze", "czytajDaneGry",
    "zapiszDaneGry", "zapiszMidiWFolderze", "nutaPod", "taktWejscia", "klikNaTakt", "zakresPartii", "pauzyPartii",
    "notkaPartii", "taktPiosenki", "geometriaRolki", "numeryTaktow", "ppTekstInfo",
    "przelaczUlubione", "sortujZUlubionymi", "odczytajUlubione", "sortujUtwory", "sasiedniUtwor", "plikWFolderze", "usunMidiZFolderu"]) run(funkcja("biblioteka.js", f));
  for (const f of ["tt", "odmiana", "stopnieNaPolton", "poltonNaStopnie", "wygladzEMA", "przyciagnijDoNuty",
    "offGracza", "celnoscKlatki", "wynikNuty", "ocenaNuty", "nastepneKombo", "mnoznikKombo", "punktyZaNute",
    "rozliczNute", "premiaChoru", "maksimumPunktow", "premiaKoncowa", "gwiazdki", "indeksNutyPod", "indeksNastepnej",
    "wPauzie", "klatkaNaNutach", "celnoscGracza", "podzialNaTory", "ukladChoru", "znajdzDoScalenia", "kluczPodpowiedzi",
    "rankingGraczy", "przyznajNagrody", "nazwaPartii", "rekordPiosenki", "krokKum", "zbierzAplauz", "najwiekszyAplauz",
    "skalaProgow", "cechyPartii", "trudnoscPartii", "poziomTrudnosci", "celBotaNaNutach", "poziomOgnia", "precyzjaZOcen",
    "ocenaKliku", "dopasujKlik", "premiaKliku", "rozbicieWyniku", "procentSpiewu",
    "krokDucha", "celNuty", "dodajPrzejscia", "zakresNut", "przygotujPartie", "klasaKlatki", "dopiszSlad", "dopiszWypelnienie", "lotPunktow", "nabijWartosc", "gwiazdkiNaZywo", "procentNaZywo", "postepGwiazdki",
    "plikPiktogramu", "ikonaFilc", "piktogram", "pierwszeZdanie", "wysokoscRechotu", "zapiszSklad", "odtworzSklad", "krokPilota", "dodajCzasNaRuch",
    "procentRuchu", "mnoznikRuchu", "premiaWPunkt", "ocenaWPunkt"]) run(funkcja("zabi-chor.js", f));
  for (const s of ["ZC_IKONY_GRY", "ZC_IKONY_APP", "ZC_PIKTOGRAMY_UST", "ZC_PILOT", "ZC_RUCH"]) run(stala("zabi-chor.js", s));
  run(funkcja("tablica.js", "topWpisy"));
  for (const s of ["ZC_PRZEJSCIA"]) run(stala("zabi-chor.js", s));
  for (const s of ["ZC_INSTR_NA_PODKLAD", "ZC_PODKLAD_ZAPAS"]) run(stala("zabi-chor.js", s));
  for (const f of ["podzialNaToryOsobno", "ukladSiatki", "instrumentPodkladu"]) run(funkcja("zabi-chor.js", f));
  // 10-18: poziomy przyciągania, mnożniki pomocy i „Poziom gry”
  for (const s of ["ZC_POMOC", "ZC_TEMPO", "ZC_MN_POMOCY", "klawiaturowy", "ZC_KLUCZE_PRESETU", "ZC_PRESETY"]) run(stala("zabi-chor.js", s));
  for (const f of ["poziomPrzyciagania", "procentTempa", "mnoznikTempa", "mnoznikPomocy", "mnoznikPunktowUst", "presetUstawien",
    "migrujPomoce", "migawkaPresetu"]) run(funkcja("zabi-chor.js", f));
  // 10-18 wieczór: pomoce osobno dla każdego gracza (karta gracza, zapis w profilu i w składzie)
  for (const f of ["pomoceZ", "pomoceGraczaZ", "ustGracza", "pomoceDoProfilu", "pomoceZProfilu", "opisPomocy"]) run(funkcja("zabi-chor.js", f));
  // 10-21: kto wybiera planszę po „Śpiewamy!” i w jakiej kolejności stoją kafle w oknie wyboru
  for (const s of ["ZC_PLANSZA_TRYBY", "ZC_RZADKOSC_KOLEJNOSC"]) run(stala("zabi-chor.js", s));
  for (const f of ["planPlanszy", "planszeWgJakosci"]) run(funkcja("zabi-chor.js", f));
  ck("czyste funkcje gry wycinają się z plików i wykonują", true);
} catch (e) {
  ck("czyste funkcje gry wycinają się z plików i wykonują", false, e && e.stack);
  console.log(JSON.stringify({ checks }));
  process.exit(0);
}
const F = name => run(name);
const blisko = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

// ---- 1. notacja trenera i wbudowane piosenki ---------------------------------------------------
const midiOf = F("midiOf");
ck("midiOf: C4 = 60, A4 = 69, F#3 = 54, Bb2 = 46, C-1 = 0",
   midiOf("C4") === 60 && midiOf("A4") === 69 && midiOf("F#3") === 54 && midiOf("Bb2") === 46 && midiOf("C-1") === 0);
let zla = null; try { midiOf("X4"); } catch (e) { zla = e.message; }
ck("midiOf: zły token rzuca błąd z nazwą tokenu", zla && zla.includes("X4"), zla);
const takty = F("parseBars")("E4/1 R/1 F4/2 | G4/1.5 A4/.5 B4/2/5", 4);
ck("parseBars: pauza przesuwa czas, takt zaczyna się od numer×metrum, palec nie wpływa na czas",
   JSON.stringify(takty.map(n => [n.m, n.t, n.d])) === JSON.stringify([[64, 0, 1], [65, 2, 2], [67, 4, 1.5], [69, 5.5, .5], [71, 6, 2]]),
   JSON.stringify(takty.map(n => [n.m, n.t, n.d])));
const BUILTIN = F("BUILTIN");
ck("wbudowanych piosenek jest 19 (5 spokojniejszych + 14 „Skoczne”, zestaw z 2026-11-11)", BUILTIN.length === 19, BUILTIN.length);
{
  // pakiet „Skoczne”: opis z tagiem, melodia ≤ 19 półtonów bez skoków > oktawy, takty melodii = takty basu
  const sk = BUILTIN.filter(d => /^Skoczne · /.test(d.sub || "")), zle = [];
  for (const d of sk) {
    const ns = F("parseBars")(d.src, d.beats), ms = ns.map(n => n.m);
    const skok = Math.max(...ns.slice(1).map((n, i) => Math.abs(n.m - ns[i].m)));
    if (Math.max(...ms) - Math.min(...ms) > 19 || skok > 12 || !d.left || d.left.split("|").length !== d.src.split("|").length) zle.push(d.id);
  }
  ck("pakiet „Skoczne”: 14 utworów, zakres ≤ 19 półtonów, skoki ≤ oktawa, bas na całą długość", sk.length === 14 && !zle.length, sk.length + " " + zle.join());
}
const zleTakty = [];
for (const d of BUILTIN) for (const [nazwa, src] of [["src", d.src], ["left", d.left]]) {
  if (!src) continue;
  F("sumyTaktow")(src).forEach((s, i) => { if (Math.abs(s - d.beats) > 1e-9) zleTakty.push(d.id + "." + nazwa + " takt " + (i + 1) + " = " + s); });
}
ck("każdy takt wbudowanych piosenek (melodia i akompaniament) trzyma metrum", !zleTakty.length, zleTakty.join("; "));
const wbud = F("wbudowanePiosenki")();
const oda = wbud.find(p => p.id === "oda");
ck("Oda do radości: melodia + akompaniament, metrum 4, tempo 80, koniec po 16 taktach",
   oda && oda.partie.length === 2 && oda.partie[0].rola === "melodia" && oda.partie[1].rola === "akompaniament" &&
   oda.metrum === 4 && oda.tempo === 80 && oda.koniec === 64, oda && JSON.stringify([oda.partie.length, oda.metrum, oda.tempo, oda.koniec]));
ck("Oda: zakres melodii G3–G4 (55–67), nuty posortowane po czasie",
   oda.partie[0].lo === 55 && oda.partie[0].hi === 67 && oda.partie[0].nuty.every((n, i, a) => !i || a[i - 1].t <= n.t));
ck("Jingle Bells (bez lewej ręki) ma jedną partię", wbud.find(p => p.id === "jingle").partie.length === 1);

// ---- 1b. parser MIDI: mapa tempa, pliki puste i ucięte, sama perkusja (PK-11, pliki w tests/fixtures) --------
{
  const FIX = path.join(REPO, "tests", "fixtures"), fx = n => { const b = fs.readFileSync(path.join(FIX, n)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
  const blad = (n, buf) => { try { F("zrodloZPliku")(buf || fx(n), n); return "(bez błędu)"; } catch (e) { return e.name + ": " + e.message; } };
  const pT = F("piosenkaZPliku")(fx("tempo-zmienne.mid"), "tempo-zmienne.mid"), sekT = pT.koniec * 60 / pT.tempo;
  ck("mapa tempa: 64 ćwierćnuty, 60 → 180 BPM w połowie trwają 42–44 s (32 s + 10,7 s), tempo gry = pierwsze",
     pT.tempo === 60 && sekT >= 42 && sekT <= 44 && pT.partie[0].nuty.length === 64, [pT.tempo, pT.koniec, sekT.toFixed(2)]);
  const kMt = F("konfiguracjaGry")({ tempo: 100 }, pT);
  ck("tablica: plik ze zmianami tempa (nuty z mapy tempa, inne niż przed 10-18) = osobna konkurencja |mt „tempo z pliku”; plik z jednym tempem bez zmian",
     pT.tempoZmienne === true && F("podpisKonfiguracji")(kMt).endsWith("|mt") && F("opisKonfiguracji")(kMt).includes("tempo z pliku") &&
     F("piosenkaZPliku")(fx("menuett.mid"), "menuett.mid").tempoZmienne === false &&
     !F("podpisKonfiguracji")(F("konfiguracjaGry")({ tempo: 100 }, { tempo: 100 })).includes("|mt"), F("podpisKonfiguracji")(kMt));
  ck("plik pusty (0 B): „To nie jest plik MIDI”", blad("pusty.mid") === "Error: To nie jest plik MIDI", blad("pusty.mid"));
  ck("plik krótszy niż nagłówek (13 B): „To nie jest plik MIDI”", blad("x.mid", fx("menuett.mid").slice(0, 13)) === "Error: To nie jest plik MIDI");
  const pU = F("piosenkaZPliku")(fx("uciety.mid"), "uciety.mid");
  ck("plik ucięty w połowie: nuty do miejsca ucięcia przyjęte, bez wyjątku", pU.partie[0].nuty.length > 0, pU.partie.map(p => p.nuty.length));
  ck("plik ucięty przed pierwszą nutą: „Plik MIDI jest uszkodzony albo niekompletny”",
     blad("x.mid", fx("menuett.mid").slice(0, 40)) === "Error: Plik MIDI jest uszkodzony albo niekompletny", blad("x.mid", fx("menuett.mid").slice(0, 40)));
  ck("sama perkusja (kanał 10): „Ten plik ma tylko perkusję, a żaby śpiewają melodię”",
     blad("perkusja.mid") === "Error: Ten plik ma tylko perkusję, a żaby śpiewają melodię", blad("perkusja.mid"));
  const pM = F("piosenkaZPliku")(fx("menuett.mid"), "menuett.mid");
  ck("plik z jednym tempem bez zmian (menuett: 167/69/171 nut, koniec 188, tempo 120 jak przed mapą tempa)",
     JSON.stringify(pM.partie.map(p => p.nuty.length)) === "[167,69,171]" && pM.koniec === 188 && pM.tempo === 120, [pM.partie.map(p => p.nuty.length), pM.koniec, pM.tempo]);
  const mt = F("mapaTempa");
  ck("mapaTempa: jedno tempo albo różnice < 1% = null; zmiana = odcinki w tickach gry",
     mt([], 500000) === null && mt([{ tick: 0, usq: 500000 }, { tick: 960, usq: 501000 }], 500000) === null &&
     JSON.stringify(mt([{ tick: 960, usq: 1000000 }, { tick: 0, usq: 1000000 }, { tick: 1920, usq: 500000 }], 1000000)) === "[[0,0,1],[1920,1920,0.5]]" &&
     F("tickGry")([[0, 0, 1], [1920, 1920, 0.5]], 2880) === 2400);
}

// ---- 2. parser SMF na plikach wygenerowanych przez test ------------------------------------------
const [plik4, plik0, plikFort, plikSmiec, plikGesty] = process.argv.slice(2);
const bufor = p => { const b = fs.readFileSync(p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
if (plik4 && fs.existsSync(plik4)) {
  const p4 = F("piosenkaZPliku")(bufor(plik4), "cztery_glosy.mid");
  const nazwy = p4.partie.map(p => p.nazwaSciezki);
  ck("SMF format 1: 4 partie (ścieżka dyrygenta bez nut się nie liczy)", p4.partie.length === 4, nazwy);
  ck("SMF: tytuł z nazwy pliku, podkreślenia na spacje", p4.tytul === "cztery glosy", p4.tytul);
  const sha4 = crypto.createHash("sha256").update(fs.readFileSync(plik4)).digest("hex");
  ck("SMF: piosenka niesie SHA-256 bajtów pliku (klucz tablicy wyników), ten sam co sha256sum", p4.hash === sha4, [p4.hash, sha4]);
  ck("SMF: tempo 100 i metrum 4/4 z meta-zdarzeń", p4.tempo === 100 && p4.metrum === 4, [p4.tempo, p4.metrum]);
  ck("SMF: melodia = ścieżka „Sopran” (rozpoznana po nazwie), reszta od najwyższej",
     p4.partie[0].rola === "melodia" && nazwy.join(",") === "Sopran,Alt,Tenor,Bas", nazwy);
  const alt = p4.partie.find(p => p.nazwaSciezki === "Alt");
  ck("SMF: głos wchodzący w 2. takcie zaczyna się w ćwierćnucie 4 (wspólny początek partii)",
     alt && alt.nuty[0].t === 4, alt && alt.nuty[0].t);
  const bas = p4.partie.find(p => p.nazwaSciezki === "Bas");
  ck("SMF: bas zostaje w swojej oktawie (C2–C3), nie jest przenoszony do „wygodnej”",
     bas && bas.lo === 36 && bas.hi === 48, bas && [bas.lo, bas.hi]);
  ck("SMF: liczby nut sopran/alt/tenor/bas = 27/13/15/8",
     p4.partie.map(p => p.nuty.length).join("/") === "27/13/15/8", p4.partie.map(p => p.nuty.length).join("/"));
  ck("SMF: koniec piosenki po 8 taktach (32 ćwierćnuty)", p4.koniec === 32, p4.koniec);
  const so = p4.partie[0].nuty;
  ck("SMF: pierwsze nuty sopranu E5 D5 C5 E5 w ćwierćnutach 0–3",
     JSON.stringify(so.slice(0, 4).map(n => [n.m, n.t, n.d])) === JSON.stringify([[76, 0, 1], [74, 1, 1], [72, 2, 1], [76, 3, 1]]),
     JSON.stringify(so.slice(0, 4)));
  const nazwyPartii = p4.partie.map(F("nazwaPartii"));
  ck("nazwy partii z MIDI: melodia jako „Chór (melodia)”, reszta po nazwie ścieżki",
     nazwyPartii.join("|") === "Chór (melodia)|„Alt”|„Tenor”|„Bas”", nazwyPartii.join("|"));
}
if (plik0 && fs.existsSync(plik0)) {
  const p0 = F("piosenkaZPliku")(bufor(plik0), "jedna.midi");
  ck("SMF format 0, running status, note-on z velocity 0: dwa kanały = dwie partie",
     p0.partie.length === 2, p0.partie.map(p => p.nuty.length));
  ck("SMF format 0: tempo 90, metrum 3/4 = 3 ćwierćnuty w takcie", p0.tempo === 90 && p0.metrum === 3, [p0.tempo, p0.metrum]);
  ck("SMF format 0: melodią jest wyżej śpiewająca partia (bez nazw ścieżek)",
     p0.partie[0].srednia > p0.partie[1].srednia && p0.partie[0].rola === "melodia",
     p0.partie.map(p => p.srednia.toFixed(1)));
  ck("SMF format 0: 12 nut melodii i 4 basu, długości z note-off (velocity 0)",
     p0.partie[0].nuty.length === 12 && p0.partie[1].nuty.length === 4 && p0.partie[1].nuty[0].d === 3,
     p0.partie.map(p => p.nuty.length + ":" + p.nuty[0].d));
}
if (plikFort && fs.existsSync(plikFort)) {
  const pf = F("piosenkaZPliku")(bufor(plikFort), "fortepian.mid");
  ck("fortepian na jednej ścieżce: podział trenera na ręce daje melodię i akompaniament",
     pf.partie.length === 2 && pf.partie[0].rola === "melodia" && pf.partie[1].rola === "akompaniament" &&
     pf.partie[0].lo >= 60 && pf.partie[1].hi < 60, pf.partie.map(p => p.rola + " " + p.lo + "-" + p.hi));
}
if (plikSmiec && fs.existsSync(plikSmiec)) {
  let blad = null; try { F("piosenkaZPliku")(bufor(plikSmiec), "x.mid"); } catch (e) { blad = e.message; }
  ck("plik, który nie jest MIDI, kończy się czytelnym błędem", blad === "To nie jest plik MIDI", blad);
}

// ---- 2b. runda 3: analizator partii trenera (20:32) i parametry piosenki --------------------------
if (plikGesty && fs.existsSync(plikGesty)) {
  const zr = F("zrodloZPliku")(bufor(plikGesty), "gesta_aranzacja.mid");
  const sc = zr.sciezki, mel = sc[zr.domMelodia], pod = sc[zr.domPodklad] || {};
  ck("analizator: 4 partie bez nazw rąk = uproszczenie trenera; domyślna melodia i podkład to uproszczona prawa i lewa ręka",
     mel.rodzaj === "uproszczenie" && mel.strona === "R" && pod.rodzaj === "uproszczenie" && pod.strona === "L" &&
     sc.filter(s => s.rodzaj === "sciezka").length === 4, sc.map(s => s.rodzaj + ":" + s.strona + ":" + s.nuty.length).join(" "));
  ck("analizator: zdanie trenera o powodzie uproszczenia („4 partii, … nut/s”)", /4 partii/.test(zr.w.reduced.why), zr.w.reduced.why);
  const g = F("piosenkaZeZrodla")(zr);
  const jednoNaRaz = nuty => nuty.every((n, i) => i === 0 || n.t > nuty[i - 1].t);
  ck("gra z uproszczeniem: dwie partie (melodia + bas), melodia jednogłosowa i nad basem",
     g.partie.length === 2 && g.partie[0].rola === "melodia" && g.partie[1].rola === "akompaniament" &&
     jednoNaRaz(g.partie[0].nuty) && g.partie[0].srednia > g.partie[1].srednia + 12,
     g.partie.map(p => p.rola + " " + p.nuty.length + " śr " + p.srednia.toFixed(1)).join(" | "));
  const smyczki = sc.find(s => s.nazwa === "Strings");
  const wspolne = g.partie[0].nuty.filter(n => smyczki.nuty.some(s => s.m === n.m && Math.abs(s.t - n.t) < .26)).length;
  ck("uproszczona melodia idzie za górną linią (smyczki): ≥ 60% nut wspólnych, przerzedzona do ≤ 12 nut w takcie",
     wspolne >= .6 * g.partie[0].nuty.length && Math.max(...Object.values(g.partie[0].nuty.reduce((a, n) => {
       const k = Math.floor(n.t / 4); a[k] = (a[k] || 0) + 1; return a; }, {}))) <= 12,
     wspolne + "/" + g.partie[0].nuty.length);
  const tloSloty = {};
  for (const n of g.tlo) tloSloty[n.t] = (tloSloty[n.t] || 0) + 1;
  ck("tło (reszta aranżacji dla instrumentu): niepuste, bez nut melodii, najwyżej 3 nuty w szesnastce",
     g.tlo.length > 20 && Math.max(...Object.values(tloSloty)) <= 3 &&
     !g.tlo.some(n => g.partie[0].nuty.some(m => m.m === n.m && Math.abs(m.t - n.t) < .2)), g.tlo.length);
  const iSm = sc.indexOf(smyczki);
  const gS = F("piosenkaZeZrodla")(zr, { melodia: iSm });
  ck("parametr „Melodia” = prawdziwa ścieżka: „reszta partii” to pozostałe ścieżki jako głosy chóru, bez uproszczonego basu",
     gS.partie[0].nazwaSciezki === "Strings" && gS.partie.length === 4 && gS.partie.every(p => p.rola !== "akompaniament"),
     gS.partie.map(p => p.rola + ":" + p.nazwaSciezki).join(" "));
  const gF = F("piosenkaZeZrodla")(zr, { od: 3, do: 4, powtorz: 2, tempo: 150 });
  const m = gF.partie[0].nuty, polowa = m.filter(n => n.t < 8);
  ck("fragment takty 3–4 ×2 w tempie 150: 16 ćwierćnut, druga połowa to powtórka pierwszej, tempo z parametru",
     gF.tempo === 150 && gF.koniec <= 16 + 1e-9 && m.length === 2 * polowa.length &&
     polowa.every((n, i) => m[i + polowa.length].m === n.m && Math.abs(m[i + polowa.length].t - n.t - 8) < 1e-9) &&
     gF.fragment.od === 3 && gF.fragment.do === 4 && gF.fragment.powtorz === 2 && !gF.fragment.caly, [gF.tempo, gF.koniec, m.length]);
  const pp = F("poprawParametry");
  const zle = pp(zr, { melodia: 99, podklad: 99, od: 7, do: 2, powtorz: 4, tempo: 900 });
  ck("parametry z zapisu przycinane do piosenki: zła ścieżka = domyślna, od > do, powtórzenia 1/2/3/5, tempo 30–200",
     zle.melodia === zr.domMelodia && zle.podklad === -1 && zle.od === 7 && zle.do === 7 && zle.powtorz === 1 && zle.tempo === 200 &&
     pp(zr, { podklad: -2 }).podklad === -2 &&
     pp(zr, { tempo: "" }).tempo === null && pp(zr, { podklad: zr.domMelodia }).podklad === -1, JSON.stringify(zle));
  ck("tempo pliku poza zakresem gry (30–140) startuje w najbliższym, z pliku zostaje w opisie",
     zr.tempoPliku === 132 && zr.tempo === 132, [zr.tempoPliku, zr.tempo]);
}
if (plikFort && fs.existsSync(plikFort)) {
  const zr = F("zrodloZPliku")(bufor(plikFort), "fortepian.mid");
  const sp = zr.podzial;
  ck("fortepian: podział jednej ścieżki (melodia = prawa, podkład = lewa ręka z podziału)",
     sp && zr.sciezki[zr.domMelodia].rodzaj === "podzial" && zr.sciezki[zr.domPodklad].strona === "L", sp && sp.method);
  if (sp && sp.method !== "voices") {
    const r60 = F("podzielPonownie")(zr, 60), r76 = F("podzielPonownie")(zr, 76);
    const g76 = F("piosenkaZeZrodla")(zr, { podzial: 76 });
    ck("„Podział rąk od”: wyżej postawiona granica zabiera prawej ręce nuty, gra bierze nowy podział",
       r76.R.length < r60.R.length && g76.partie[0].nuty.length === r76.R.length && /od E5/.test(r76.etR), [r60.R.length, r76.R.length, r76.etR]);
  }
}
{
  const wb = F("zrodloZNotacji")(F("BUILTIN").find(d => d.id === "oda"));
  const bez = F("piosenkaZeZrodla")(wb, { podklad: -2 }), z = F("piosenkaZeZrodla")(wb);
  ck("wbudowana piosenka: domyślnie melodia + akompaniament, „Bez podkładu” zostawia samą melodię",
     z.partie.length === 2 && bez.partie.length === 1 && z.fragment.caly && wb.takty === 16, [z.partie.length, bez.partie.length, wb.takty]);
}

// ---- 2b-wzorzec. podział rąk: szybka wiązka = kod sprzed optymalizacji, nuta w nutę (10-19) ---------
// assignHandsBeam przepisaliśmy 2026-10-19 na szybsze (paczka 471 utworów stawała się kartami przez ~90 s,
// 92% tego czasu było w tej jednej funkcji). Wolno jej być szybszą, nie wolno jej inaczej dzielić nut:
// id utworu i klucz tablicy wyników liczą się z nut, więc jedna nuta w innej ręce to inny utwór i inne
// wyniki gracza. Dlatego poniżej leży WZORZEC — kod z 2026-10-18 jeden do jednego — i test sprawdza, że
// nowy kod daje dokładnie ten sam podział: na własnym korpusie wiązki i na całych plikach MIDI.
// Wzorca się nie poprawia ani nie „czyści”: jego jedyne zadanie to być tym, co było.
function wzorAssignHandsBeam(raw,at,tpq,opts){const q=Math.max(1,tpq/8);const o=Object.assign({beam:12,regW:.5,moveW:.6,jumpW:1.2,crossW:3,switchW:2.5,shareW:2,voiceW:0},opts||{});
  const groups={};raw.forEach(n=>{const k=Math.round(n.s/q);(groups[k]=groups[k]||[]).push(n)});const keys=Object.keys(groups).map(Number).sort((a,b)=>a-b);
  let states=[{cost:0,lastR:null,lastL:null,lastHand:null,lastPitch:null,path:[]}];
  keys.forEach(k=>{const g=groups[k].slice().sort((a,b)=>a.m-b.m);const K=g.length;const next=[];
    states.forEach(st=>{for(let j=0;j<=K;j++){const L=g.slice(0,j),R=g.slice(j);let c=st.cost;
        const span=a=>a.length?a[a.length-1].m-a[0].m:0;if(span(L)>12)c+=40+(span(L)-12)*4;if(span(R)>12)c+=40+(span(R)-12)*4;
        const cR=R.length?(R[0].m+R[R.length-1].m)/2:null,cL=L.length?(L[0].m+L[L.length-1].m)/2:null;
        if(cR!==null){const ref=st.lastR!==null?st.lastR:at+6,w=st.lastR!==null?1:.5;const d=Math.max(0,Math.abs(cR-ref)-5);c+=(d*o.moveW+(d>7?(d-7)*o.jumpW:0))*w}
        if(cL!==null){const ref=st.lastL!==null?st.lastL:at-6,w=st.lastL!==null?1:.5;const d=Math.max(0,Math.abs(cL-ref)-5);c+=(d*o.moveW+(d>7?(d-7)*o.jumpW:0))*w}
        R.forEach(n=>{if(n.m<at-3)c+=(at-3-n.m)*o.regW;if(n.vc==='B')c+=o.voiceW});L.forEach(n=>{if(n.m>at+3)c+=(n.m-at-3)*o.regW;if(n.vc==='T')c+=o.voiceW});
        const lowR=R.length?R[0].m:null,highL=L.length?L[L.length-1].m:null;
        if(lowR!==null&&highL!==null&&lowR<=highL)c+=(highL-lowR+1)*o.crossW*3;
        if(lowR!==null&&highL===null&&st.lastL!==null&&lowR<st.lastL)c+=(st.lastL-lowR)*o.crossW;
        if(highL!==null&&lowR===null&&st.lastR!==null&&highL>st.lastR)c+=(highL-st.lastR)*o.crossW;
        let lh=st.lastHand,lp=st.lastPitch;if(K===1){const h=j===0?'R':'L';if(lh&&lh!==h&&lp!==null&&Math.abs(g[0].m-lp)<=12)c+=o.switchW*(Math.abs(g[0].m-lp)<=5?1:.7);lh=h;lp=g[0].m}
        if(K>=2&&span(g)>=10&&(j===0||j===K))c+=o.shareW;
        next.push({cost:c,lastR:cR!==null?cR:st.lastR,lastL:cL!==null?cL:st.lastL,lastHand:lh,lastPitch:lp,path:st.path.concat(j)})}});
    next.sort((a,b)=>a.cost-b.cost);states=next.slice(0,o.beam)});
  const best=states[0];const hi=[],lo=[];keys.forEach((k,i)=>{const g=groups[k].slice().sort((a,b)=>a.m-b.m);const j=best.path[i];g.forEach((n,x)=>(x<j?lo:hi).push(n))});
  return {hi,lo}}
{
  // korpus wiązki: siedem rodzajów materiału, każdy w trzech nastawach (podział ścieżki, „frazami”,
  // pula po uproszczeniu z głosami T/B). Liczby z własnego generatora, żeby korpus był ten sam zawsze.
  const losuj = z => () => ((z = (z * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const tpq = 480, ósemka = tpq / 2;
  const pule = {};
  {   // 1. jedna linia błądząca po dwóch oktawach
    const r = losuj(7); let m = 60; const ns = [];
    for (let i = 0; i < 400; i++) { m += Math.round((r() - .5) * 9); m = Math.max(43, Math.min(84, m)); ns.push({ m, s: i * ósemka, e: i * ósemka + ósemka }); }
    pule["jedna linia"] = ns;
  }
  {   // 2. akordy z melodią na górze (typowy fortepian na jednej ścieżce)
    const r = losuj(11); const ns = [];
    for (let i = 0; i < 160; i++) { const t = i * tpq, b = 36 + Math.round(r() * 12);
      for (const d of [0, 7, 12]) ns.push({ m: b + d, s: t, e: t + tpq });
      for (let j = 0; j < 4; j++) ns.push({ m: 67 + Math.round((r() - .5) * 10), s: t + j * (tpq / 4), e: t + (j + 1) * (tpq / 4) }); }
    pule["akordy z melodią"] = ns;
  }
  {   // 3. dwa rejestry z wyraźną przerwą
    const r = losuj(13); const ns = [];
    for (let i = 0; i < 220; i++) { const t = i * ósemka; ns.push({ m: 72 + Math.round(r() * 7), s: t, e: t + ósemka });
      if (i % 2 === 0) ns.push({ m: 40 + Math.round(r() * 7), s: t, e: t + tpq }); }
    pule["dwa rejestry"] = ns;
  }
  {   // 4. nuty podwojone w jednej grupie (kara za skrzyżowanie w grupie liczy się od równych wysokości)
    const ns = [];
    for (let i = 0; i < 120; i++) { const t = i * ósemka, m = 60 + (i % 5); ns.push({ m, s: t, e: t + ósemka }); ns.push({ m, s: t + 3, e: t + ósemka }); }
    pule["nuty podwojone"] = ns;
  }
  {   // 5. akordy szersze niż oktawa (kara za rozstaw ręki) i skoki między grupami
    const r = losuj(17); const ns = [];
    for (let i = 0; i < 140; i++) { const t = i * ósemka, b = 48 + Math.round(r() * 20);
      for (const d of [0, 11, 16, 22]) ns.push({ m: b + d, s: t, e: t + ósemka }); }
    pule["szerokie akordy"] = ns;
  }
  {   // 6. pula jak po uproszczeniu: górna linia T i dolna B w jednym worku
    const r = losuj(19); const ns = [];
    for (let i = 0; i < 200; i++) { const t = i * (tpq / 4);
      ns.push({ m: 64 + Math.round((r() - .5) * 14), s: t, e: t + tpq / 4, vc: "T" });
      if (i % 3 === 0) ns.push({ m: 45 + Math.round((r() - .5) * 10), s: t, e: t + tpq / 2, vc: "B" }); }
    pule["pula T/B po uproszczeniu"] = ns;
  }
  {   // 7. gęsto: osiem nut naraz, szesnastkami
    const r = losuj(23); const ns = [];
    for (let i = 0; i < 90; i++) { const t = i * (tpq / 4);
      for (let j = 0; j < 8; j++) ns.push({ m: 36 + Math.round(r() * 48), s: t, e: t + tpq / 4 }); }
    pule["gęsto, 8 nut naraz"] = ns;
  }
  const nastawy = [["podział ścieżki", {}], ["frazami", { switchW: 4, regW: .35 }], ["po uproszczeniu", { regW: .45, switchW: 3, voiceW: 3 }]];
  const szybka = F("assignHandsBeam"), slad = w => JSON.stringify([w.hi.map(n => [n.m, n.s, n.e]), w.lo.map(n => [n.m, n.s, n.e])]);
  const zle = []; let par = 0;
  for (const [nazwa, ns] of Object.entries(pule)) for (const [jak, opts] of nastawy) for (const at of [55, 60, 67]) {
    par++;
    if (slad(szybka(ns, at, tpq, opts)) !== slad(wzorAssignHandsBeam(ns, at, tpq, opts))) zle.push(nazwa + " / " + jak + " / at " + at);
  }
  ck("podział rąk: szybka wiązka daje ten sam podział co wzorzec na całym korpusie (" + par + " przebiegów)",
     !zle.length && par === 63, zle.slice(0, 5).join("; ") || par);
  // ten sam podział na całych plikach: parser raz z nowym kodem, raz z wzorcem w jego miejscu
  const odcisk = res => JSON.stringify([res, res._all && res._all.parts.map(p => [p.hand, p.label, p.split, p.reduced, p.raw])]);
  const przezWzorzec = f => { const org = ctx.assignHandsBeam; ctx.assignHandsBeam = wzorAssignHandsBeam; try { return f(); } finally { ctx.assignHandsBeam = org; } };
  const rozne = []; const sprawdzone = [];
  for (const [nazwa, buf] of [["menuett.mid", fs.readFileSync(path.join(REPO, "tests", "fixtures", "menuett.mid"))],
    ...[["cztery.mid", plik4], ["zero.mid", plik0], ["fortepian.mid", plikFort], ["gesty.mid", plikGesty]]
      .filter(([, p]) => p && fs.existsSync(p)).map(([n, p]) => [n, fs.readFileSync(p)])]) {
    const ab = () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const nowy = odcisk(ctx.parseMidiFile(ab(), nazwa, { forGame: true }));
    const stary = przezWzorzec(() => odcisk(ctx.parseMidiFile(ab(), nazwa, { forGame: true })));
    sprawdzone.push(nazwa);
    if (nowy !== stary) rozne.push(nazwa);
  }
  ck("parser na całych plikach: wynik z szybką wiązką identyczny jak z wzorcem (" + sprawdzone.join(", ") + ")",
     !rozne.length && sprawdzone.length >= 1, rozne.join("; ") || sprawdzone.length + " plików");
}

// ---- 2c. runda 3: biblioteka (folder, parametry per piosenka); wyszukiwarkę bitmidi usunęliśmy 2026-10-03 -----
{
  const idP = F("idZNazwyPliku"), tyt = F("tytulZNazwyPliku"), nz = F("nazwaPlikuDoZapisu");
  ck("biblioteka: id z samej nazwy pliku (bez bajtów) = id sprzed rundy 3b, które przenosimy przy wczytaniu",
     idP("Rush_E.mid") === "midi-rush-e" && tyt("Rush_E.MIDI") === "Rush E" && idP("Żabi_Chór (wersja 2).mid") === "midi-żabi-chór-wersja-2-");
  ck("biblioteka: nazwa do zapisu w piosenki/ bez ścieżek i znaków zakazanych, zawsze .mid",
     nz("../../evil:name?.mid") === ".. .. evil name .mid" && nz("Moonlight") === "Moonlight.mid" && nz("") === "piosenka.mid", nz("../../evil:name?.mid"));
  const zp = F("zapiszParametryWpisu"), sc = F("scalParametry");
  const m1 = zp({}, "oda", { od: 2, do: 4, zmieniono: 1 }, 100), m2 = zp(m1, "midi-x", { melodia: 3 }, 200);
  ck("parametry per piosenka: każda piosenka ma swój wpis z chwilą zmiany, zapis nie rusza innych piosenek",
     m2.oda.od === 2 && m2.oda.zmieniono === 100 && m2["midi-x"].melodia === 3 && !("midi-x" in m1), JSON.stringify(m2));
  const sc1 = sc({ oda: { od: 2, zmieniono: 300 }, a: { od: 1, zmieniono: 100 } }, { oda: { od: 5, zmieniono: 200 }, a: { od: 9, zmieniono: 400 }, b: { od: 3, zmieniono: 1 } });
  ck("parametry z folderu (dane/zabi-chor.json) scalają się z przeglądarką: nowszy wpis wygrywa, brakujące dochodzą",
     sc1.oda.od === 2 && sc1.a.od === 9 && sc1.b.od === 3, JSON.stringify(sc1));
  const dane = F("daneDoFolderu")(m2);
  ck("plik danych gry ma własny klucz i wersję, a w nim parametry", dane.gra === "zabi-chor" && dane.wersja === 1 && dane.parametry.oda.od === 2);
  ck("kolor piosenki stały dla id i z palety torów", F("akcentPiosenki")("oda") === F("akcentPiosenki")("oda") &&
     F("ZC_TORY_STYL").some(s => s.akcent === F("akcentPiosenki")("midi-rush-e")));
  // atrapa uchwytu folderu (File System Access): podfoldery, pliki, zapis
  function atrapa() {
    const drzewo = { piosenki: { "a.mid": "MThd-a", "B.MIDI": "MThd-b", "notatka.txt": "x" }, dane: { "keyboard-trener.json": "{\"trener\":1}" } };
    const zapisane = [];
    const plik = (kat, nazwa) => ({ kind: "file", name: nazwa,
      getFile: async () => ({ text: async () => typeof kat[nazwa] === "string" ? kat[nazwa] : new TextDecoder().decode(kat[nazwa]),
        arrayBuffer: async () => typeof kat[nazwa] === "string" ? new TextEncoder().encode(kat[nazwa]).buffer : kat[nazwa].slice(0) }),
      createWritable: async () => { let buf = ""; return { write: async d => { buf = typeof d === "string" ? d : d.slice(0); },
        close: async () => { kat[nazwa] = buf; zapisane.push(nazwa); } }; } });
    const katalog = (kat, nazwa) => ({ kind: "directory", name: nazwa,
      getDirectoryHandle: async (n, o) => { if (!kat[n]) { if (!(o && o.create)) throw new Error("NotFound"); kat[n] = {}; } return katalog(kat[n], n); },
      getFileHandle: async (n, o) => { if (!(n in kat)) { if (!(o && o.create)) { const e = new Error("NotFound"); e.name = "NotFoundError"; throw e; } kat[n] = ""; } return plik(kat, n); },
      removeEntry: async n => { if (!(n in kat)) { const e = new Error("NotFound"); e.name = "NotFoundError"; throw e; } delete kat[n]; },
      entries: async function* () { for (const n of Object.keys(kat)) yield [n, typeof kat[n] === "object" ? katalog(kat[n], n) : plik(kat, n)]; } });
    return { korzen: katalog(drzewo, "Scarborough Fair"), drzewo, zapisane };
  }
  const A = atrapa();
  const lista = await F("listaMidiWFolderze")(A.korzen);
  ck("folder: z piosenki/ tylko pliki .mid/.midi (bez .txt), posortowane", lista.map(x => x.nazwa).join(",") === "a.mid,B.MIDI", lista.map(x => x.nazwa));
  ck("folder: brak dane/zabi-chor.json = null (trenera nie czytamy)", (await F("czytajDaneGry")(A.korzen)) === null);
  await F("zapiszDaneGry")(A.korzen, F("daneDoFolderu")({ oda: { od: 2, zmieniono: 5 } }));
  const odczyt = await F("czytajDaneGry")(A.korzen);
  ck("folder: zapis i odczyt dane/zabi-chor.json; dane/keyboard-trener.json nietknięte",
     odczyt && odczyt.parametry.oda.od === 2 && A.drzewo.dane["keyboard-trener.json"] === "{\"trener\":1}" &&
     A.zapisane.join() === "zabi-chor.json", JSON.stringify([odczyt, A.zapisane]));
  A.drzewo.dane["zabi-chor.json"] = "{to nie json";
  ck("folder: zepsuty dane/zabi-chor.json nie wywraca gry (null)", (await F("czytajDaneGry")(A.korzen)) === null);
  const nazwa = await F("zapiszMidiWFolderze")(A.korzen, "Nowa: piosenka", new Uint8Array([77, 84, 104, 100]).buffer);
  ck("folder: przeciągnięty plik ląduje w piosenki/ pod bezpieczną nazwą",
     nazwa === "Nowa piosenka.mid" && A.drzewo.piosenki["Nowa piosenka.mid"].byteLength === 4, [nazwa, Object.keys(A.drzewo.piosenki)]);
  const zapisowPrzed = A.zapisane.length, w1 = {}, w2 = {};
  const n2 = await F("zapiszMidiWFolderze")(A.korzen, "Nowa: piosenka", new Uint8Array([77, 84, 104, 100]).buffer, w1);
  const n3 = await F("zapiszMidiWFolderze")(A.korzen, "Nowa piosenka.mid", new Uint8Array([1, 2, 3]).buffer, w2);
  ck("folder: ten sam plik drugi raz się nie zapisuje, a inny plik pod tą samą nazwą nie nadpisuje istniejącego (dostaje „ (2)”)",
     n2 === "Nowa piosenka.mid" && w1.nowy === false && n3 === "Nowa piosenka (2).mid" && w2.nowy === true &&
     A.drzewo.piosenki["Nowa piosenka.mid"].byteLength === 4 && A.zapisane.length === zapisowPrzed + 1, [n2, n3, A.zapisane.join()]);
  // 10-18 (D-11): usunięty z biblioteki utwór kasuje plik z piosenki/ tylko wtedy, gdy leży tam ten sam plik (te same bajty)
  const hash = F("sha256Hex")(new Uint8Array([77, 84, 104, 100]).buffer);
  const jest = [await F("plikWFolderze")(A.korzen, "Nowa piosenka.mid", hash), await F("plikWFolderze")(A.korzen, "Nowa piosenka (2).mid", hash),
    await F("plikWFolderze")(A.korzen, "nie-ma.mid", hash)];
  const usuniete = [await F("usunMidiZFolderu")(A.korzen, "Nowa piosenka (2).mid", hash), await F("usunMidiZFolderu")(A.korzen, "Nowa piosenka.mid", hash)];
  ck("folder (D-11): plik znika z piosenki/ tylko, gdy ma te same bajty; inny plik pod tą nazwą i brak pliku zostają bez zmian",
     jest.join() === "true,false,false" && usuniete.join() === "false,true" && !("Nowa piosenka.mid" in A.drzewo.piosenki) &&
     "Nowa piosenka (2).mid" in A.drzewo.piosenki && "a.mid" in A.drzewo.piosenki, JSON.stringify([jest, usuniete, Object.keys(A.drzewo.piosenki)]));
}

// ---- 2d. runda 3, A5: podgląd partii --------------------------------------------------------------
{
  const tw = F("taktWejscia"), kn = F("klikNaTakt"), zk = F("zakresPartii"), pz = F("pauzyPartii");
  const alt = [{ m: 72, t: 4, d: 2 }, { m: 71, t: 6, d: 2 }, { m: 67, t: 20, d: 4 }];   // wchodzi w 2. takcie, pauza 3 takty
  ck("podgląd partii: takt wejścia od 1 (nuta w ćwierćnucie 4 przy 4/4 = takt 2, w 0 = takt 1, 3/4 i ćw. 9 = takt 4)",
     tw(alt, 4) === 2 && tw([{ m: 60, t: 0, d: 1 }], 4) === 1 && tw([{ m: 60, t: 9, d: 1 }], 3) === 4 && tw([], 4) === null);
  ck("podgląd partii: klik w rolkę → takt (lewa krawędź = 1, środek 8 taktów = 5, prawa = ostatni, poza = przycięty)",
     kn(4, 408, 4, 32, 4) === 1 && kn(204.1, 408, 4, 32, 4) === 5 && kn(403.9, 408, 4, 32, 4) === 8 && kn(999, 408, 4, 32, 4) === 8 &&
     kn(-50, 408, 4, 32, 4) === 1, [kn(204.1, 408, 4, 32, 4), kn(403.9, 408, 4, 32, 4)]);
  const z = zk(alt);
  ck("podgląd partii: zakres nut partii z nazwami jak w trenerze (G4–C5)", z.lo === 67 && z.hi === 72 && z.tekst === "G4–C5" && zk([]) === null, z && z.tekst);
  const p = pz(alt, 4, 32);
  ck("podgląd partii: pauzy od 2 taktów (8–20 i 24–32), krótsze nie", p.length === 2 && p[0].od === 8 && p[0].do === 20 && p[1].od === 24 &&
     p[1].do === 32 && pz([{ m: 60, t: 0, d: 1 }, { m: 60, t: 5, d: 1 }], 4, 6).length === 0, JSON.stringify(p));
  ck("notka na karcie gracza: „wchodzi w takcie 2 · 3 nuty · zakres G4–C5”",
     F("notkaPartii")({ nuty: alt }, 4) === "wchodzi w takcie 2 · 3 nuty · zakres G4–C5", F("notkaPartii")({ nuty: alt }, 4));
}

// ---- 2e. runda 3b: powiększony podgląd, takty fragmentu, id ze skrótem bajtów ---------------------
{
  const geo = F("geometriaRolki"), nt = F("numeryTaktow"), kn = F("klikNaTakt"), tp = F("taktPiosenki"), MIN = F("ZC_PP_TAKT_MIN");
  const etk = n => String(n).length * 6.6 + 4;   // szerokość numeru: Nunito 800 11 px ok. 6,6 px na cyfrę (+4 jak w ppRysujRolke)
  // 48 taktów 4/4 (192 ćwierćnuty) w rolce panelu: 457 px przy 1280×720, 489 px przy 1366×768
  for (const szer of [457, 489]) {
    const g = geo(szer, 192, 4, true), maly = geo(szer, 192, 4, false), num = nt(48, g.naTakt, etk(48), null);
    const xs = num.map(q => g.pad + q.k * g.naTakt + 3);
    const nakladaja = num.some((q, i) => i > 0 && xs[i - 1] + etk(num[i - 1].n) > xs[i]);
    // takt 37 w kadrze po przewinięciu: klik = x w kadrze + przesunięcie, ten sam klikNaTakt co w małym widoku
    const przesun = Math.min(g.maks, g.pad + 36 * g.naTakt - szer * .3), xKadr = g.pad + (36 * 4 + 2) * g.px - przesun;
    const takt = kn(xKadr + przesun, g.pelna, g.pad, 192, 4);
    ck(`podgląd powiększony (${szer} px, 48 taktów): ≥ ${MIN} px na takt, numery się nie nakładają, klik w takt 37 = takt 37 (głowica 144)`,
       g.naTakt >= MIN && maly.naTakt < MIN && !nakladaja && num.length === 48 && takt === 37 && (takt - 1) * 4 === 144 &&
       xKadr >= 0 && xKadr <= szer && g.maks > 0,
       JSON.stringify({ naTakt: g.naTakt, maly: +maly.naTakt.toFixed(2), numerow: num.length, takt, xKadr: +xKadr.toFixed(1) }));
  }
  const m331 = geo(331, 192, 4, false), n331 = nt(48, m331.naTakt, etk(48), null);
  ck("mały podgląd 48 taktów (331 px): numery co 4 takty (1, 5, 9…) i się nie stykają",
     n331.slice(0, 3).map(q => q.n).join() === "1,5,9" && n331.every((q, i) => i === 0 || (q.k - n331[i - 1].k) * m331.naTakt >= etk(q.n) + 6),
     n331.map(q => q.n).join());
  const krotka = geo(457, 32, 4, true), dwa = geo(457, 400, 2, true);
  ck("powiększony widok: 8 taktów mieści się bez przewijania; 2/4 też ma co najmniej 16 px na takt",
     krotka.maks === 0 && krotka.naTakt >= MIN && dwa.naTakt >= MIN && dwa.maks > 0, [krotka.naTakt, dwa.naTakt]);
  const fr = { od: 3, do: 5, powtorz: 2, taktow: 8, caly: false }, info = F("ppTekstInfo");
  ck("fragment 3–5 ×2: takty rolki 1–6 to takty piosenki 3 4 5 3 4 5 (numery od 3, w ciasnej rolce bez stykania się)",
     [1, 2, 3, 4, 5, 6].map(k => tp(k, fr)).join() === "3,4,5,3,4,5" && nt(6, 54, 10, fr).map(q => q.n).join() === "3,4,5,3,4,5" &&
     (q => q[0].n === 3 && q.every((x, j) => j === 0 || (x.k - q[j - 1].k) * 6 >= 22))(nt(6, 6, 10, fr)) && tp(7, { caly: true }) === 7, nt(6, 6, 10, fr).map(q => q.k + ":" + q.n).join());
  ck("info podglądu: fragment 3–5 ×2 → „takt 3 z 5 · 2×” (też w drugim przejściu), cała piosenka „takt 5 z 32”",
     info(0, { metrum: 4, koniec: 24, fragment: fr }) === "takt 3 z 5 · 2×" && info(12.5, { metrum: 4, koniec: 24, fragment: fr }) === "takt 3 z 5 · 2×" &&
     info(16, { metrum: 4, koniec: 128, fragment: { caly: true } }) === "takt 5 z 32" &&
     info(4, { metrum: 4, koniec: 12, fragment: { od: 3, do: 5, powtorz: 1, caly: false } }) === "takt 4 z 5",
     info(0, { metrum: 4, koniec: 24, fragment: fr }));
  ck("notka gracza i naklejka przy fragmencie liczą wejście w taktach piosenki (od pierwszego taktu fragmentu)",
     F("notkaPartii")({ nuty: [{ m: 60, t: 4, d: 1 }] }, 4, fr).startsWith("wchodzi w takcie 4 ·"), F("notkaPartii")({ nuty: [{ m: 60, t: 4, d: 1 }] }, 4, fr));
}
if (plik4 && fs.existsSync(plik4)) {
  const b = bufor(plik4), u = new Uint8Array(b.slice(0)), idP = F("idZNazwyPliku");
  // ten sam utwór w tempie 180 (inna meta tempa FF 51 03), czyli inne bajty
  let i = 0; while (i < u.length - 5 && !(u[i] === 0xff && u[i + 1] === 0x51 && u[i + 2] === 3)) i++;
  const us = Math.round(60000000 / 180); u[i + 3] = us >> 16; u[i + 4] = (us >> 8) & 255; u[i + 5] = us & 255;
  const zA = F("zrodloZPliku")(b, "Cztery_glosy.mid"), zB = F("zrodloZPliku")(u.buffer, "cztery-glosy.mid"), zA2 = F("zrodloZPliku")(b.slice(0), "cztery-glosy.mid");
  ck("id = nazwa + 6 znaków skrótu bajtów: „Cztery_glosy.mid” i „cztery-glosy.mid” o innej treści to dwa wpisy, ten sam plik jeden",
     zA.id !== zB.id && zA.id === zA2.id && /^midi-cztery-glosy-[0-9a-z]{6}$/.test(zA.id) && zA.id === idP("Cztery_glosy.mid", b) &&
     zB.id === idP("cztery-glosy.mid", u.buffer), [zA.id, zB.id, zA2.id]);
  ck("tempo pliku 180: gra startuje w 140, prawdziwe tempo zostaje w źródle („Jak w pliku” je ustawia)",
     zB.tempoPliku === 180 && zB.tempo === 140 && F("poprawParametry")(zB, { tempo: 180 }).tempo === 180, [zB.tempoPliku, zB.tempo]);
  const iW = zA.sciezki.findIndex(s => s.rodzaj === "wszystkie");
  ck("„Wszystkie ścieżki razem” nie jest melodią (taki zapis wraca do domyślnej), w podkładzie zostaje; melodii do wyboru 6",
     iW >= 0 && F("poprawParametry")(zA, { melodia: iW }).melodia === zA.domMelodia && F("poprawParametry")(zA, { podklad: iW }).podklad === iW &&
     zA.sciezki.filter(s => s.rodzaj !== "wszystkie" && s.nuty.length).length === 6, iW);
}

// ---- 3. przechył → wysokość ---------------------------------------------------------------------
const naP = F("stopnieNaPolton"), naS = F("poltonNaStopnie");
ck("przechył: −R = najwyższa nuta + 2 (góra ekranu), +R = najniższa − 2, 0 = środek",
   naP(-40, 40, 60, 72) === 74 && naP(40, 40, 60, 72) === 58 && naP(0, 40, 60, 72) === 66,
   [naP(-40, 40, 60, 72), naP(40, 40, 60, 72), naP(0, 40, 60, 72)]);
ck("przechył: poza zakresem ±R wysokość stoi na krańcu", naP(-90, 40, 60, 72) === 74 && naP(55, 40, 60, 72) === 58);
// R=40 rozpięte na 16 półtonach (58–74): 10° to ćwierć połowy zakresu, czyli 2 półtony od środka (66)
ck("przechył: liniowo i ciągle (−10° = 2 półtony nad środkiem, +5° = 1 pod)",
   blisko(naP(-10, 40, 60, 72), 68) && blisko(naP(5, 40, 60, 72), 65), [naP(-10, 40, 60, 72), naP(5, 40, 60, 72)]);
ck("przechył: R = 20 i R = 60 rozciągają ten sam zakres partii", naP(-20, 20, 60, 72) === 74 && naP(30, 60, 60, 72) === 62);
let tamIzPowrotem = true;
for (let s = 58; s <= 74; s += .25) if (!blisko(naP(naS(s, 40, 60, 72), 40, 60, 72), s, 1e-9)) tamIzPowrotem = false;
ck("poltonNaStopnie jest odwrotnością (cały zakres co ćwierć tonu)", tamIzPowrotem);
const ema = F("wygladzEMA");
ck("EMA: po τ = 60 ms zostaje e⁻¹ drogi, niezależnie od liczby klatek",
   blisko(ema(0, 1, .06, .06), 1 - Math.exp(-1)) &&
   blisko([0, 1, 2, 3, 4, 5].reduce(v => ema(v, 1, .01, .06), 0), 1 - Math.exp(-1), 1e-9));
const mag = F("przyciagnijDoNuty");
ck("przyciąganie: w ±0,6 półtonu odchyłka maleje o połowę, dalej nic się nie dzieje",
   blisko(mag(60.4, 60, .6, .5), 60.2) && mag(60.7, 60, .6, .5) === 60.7 && mag(61, null, .6, .5) === 61);
// 10-18: pas za zasięgiem (poziomy 2–4) — przyciąganie słabnie do zera ciągle i rosnąco, bez skoku wysokości na granicy
{
  const z = 2.5, sl = .8, p = .75, x = [0, .5, 1, 2, 2.49, 2.5, 2.6, 3, 3.24, 3.25, 4, 6].map(d => mag(60 + d, 60, z, sl, p) - 60);
  ck("przyciąganie z pasem: w zasięgu ×(1−siła), na brzegach ciągłe (2,5 → 0,5; 3,25 → 3,25), rosnące, poza pasem bez zmian, symetryczne",
     blisko(x[1], .1) && blisko(x[5], .5) && blisko(x[9], 3.25) && x.every((v, i) => !i || v >= x[i - 1] - 1e-12) && x[10] === 4 && x[11] === 6 &&
     blisko(mag(57, 60, z, sl, p) - 60, -(mag(63, 60, z, sl, p) - 60)) && Math.abs(x[4] - x[5]) < .02 && Math.abs(x[8] - x[9]) < .05, x.map(v => +v.toFixed(3)));
  ck("przyciąganie bez pasa (poziom 1, dawna pomoc) = jak do 10-18: w zasięgu połowa odchyłki, tuż za nim bez zmian",
     blisko(mag(60.79, 60, .8, .5, 0), 60.395) && mag(60.81, 60, .8, .5, 0) === 60.81 && mag(60.81, 60, .8, .5) === 60.81, "");
}

// ---- 4. punktacja --------------------------------------------------------------------------------
const acc = F("celnoscKlatki");
ck("celność klatki: pełna w ±0,5 półtonu, 0,5 przy 1,5, zero od 2,5",
   acc(0) === 1 && acc(.5) === 1 && acc(-.5) === 1 && acc(1.5) === .5 && acc(-2.5) === 0 && acc(4) === 0);
const oc = F("ocenaNuty");
ck("oceny: progi 85 / 60 / 30, bez śpiewu = pudło",
   oc(85, true) === "czysto" && oc(84.9, true) === "dobrze" && oc(60, true) === "dobrze" && oc(59.9, true) === "prawie" &&
   oc(30, true) === "prawie" && oc(29.9, true) === "falsz" && oc(0, true) === "falsz" && oc(100, false) === "pudlo");
const kombo = F("nastepneKombo"), mn = F("mnoznikKombo");
ck("kombo: ≥60 dokłada, Prawie trzyma, Fałsz i Pudło zerują",
   kombo(3, "czysto") === 4 && kombo(3, "dobrze") === 4 && kombo(3, "prawie") === 3 && kombo(3, "falsz") === 0 && kombo(3, "pudlo") === 0);
ck("mnożnik: 1 do kombo 3, 2 od 4, 3 od 8, 4 od 12 i nie więcej",
   [0, 3, 4, 7, 8, 11, 12, 40].map(mn).join(",") === "1,1,2,2,3,3,4,4", [0, 3, 4, 7, 8, 11, 12, 40].map(mn).join(","));
const pkt = F("punktyZaNute");
ck("punkty: wynik × mnożnik × (0,6 + 0,4 × min(długość, 4))",
   pkt(100, 1, 1) === 100 && pkt(100, 2, 4) === 440 && pkt(100, 1, 8) === 220 && pkt(50, 3, .5) === 120,
   [pkt(100, 1, 1), pkt(100, 2, 4), pkt(100, 1, 8), pkt(50, 3, .5)]);
const roz = F("rozliczNute");
const r4 = roz(3, 90, true, 1);
ck("rozliczenie nuty: czwarta czysta z rzędu dostaje już mnożnik 2", r4.ocena === "czysto" && r4.kombo === 4 && r4.mnoznik === 2 && r4.punkty === 180,
   JSON.stringify(r4));
const rp = roz(9, 100, false, 2);
ck("rozliczenie: pudło = 0 punktów i zerowe kombo", rp.ocena === "pudlo" && rp.kombo === 0 && rp.punkty === 0 && rp.mnoznik === 1);
const maks = F("maksimumPunktow")([1, 1, 1, 1, 1, 2, .5, 4].map(d => ({ d })));
// ręcznie: kombo 1..8 → mnożniki 1,1,1,2,2,2,2,3; długości 1,1,1,1,1,2,.5,4 → 100,100,100,200,200,280,160,660
ck("maksimum: suma po kolejnych mnożnikach (100+100+100+200+200+280+160+660 = 1800) + 10% premii",
   maks.bezPremii === 1800 && maks.premia === 180 && maks.razem === 1980, JSON.stringify(maks));
const prem = F("premiaKoncowa");
ck("premia: tylko gdy żadna nuta nie zeszła poniżej Dobrze",
   prem({ czysto: 3, dobrze: 2, prawie: 0, falsz: 0, pudlo: 0 }, maks) === 180 &&
   prem({ czysto: 3, dobrze: 2, prawie: 1, falsz: 0, pudlo: 0 }, maks) === 0 &&
   prem({ czysto: 4, pudlo: 1 }, maks) === 0 && prem({}, maks) === 0);
const gw = F("gwiazdki");
ck("gwiazdki: 1 poniżej 25%, 5 od 85%",
   [0, 24.9, 25, 45, 64.9, 65, 85, 100].map(gw).join(",") === "1,1,2,3,3,4,5,5", [0, 24.9, 25, 45, 64.9, 65, 85, 100].map(gw).join(","));
// klatka po klatce: nuta 1 ćwierćnuty, 60 klatek na ćwierćnutę
const kl = F("klatkaNaNutach");
function zagraj(nuty, fn, kroki) {
  const ak = { sumaAcc: 0, spiewal: false }, zamk = [];
  let i = 0, b = -0.5;
  for (let k = 0; k < kroki; k++) {
    const b1 = b + 1 / 60, s = fn(b1);
    const r = kl(nuty, i, ak, b, b1, s.spiewa, s.polton);
    i = r.i; zamk.push(...r.zamkniete); b = b1;
  }
  return zamk;
}
const jedna = [{ m: 60, t: 0, d: 1 }];
const czysta = zagraj(jedna, () => ({ spiewa: true, polton: 60.3 }), 120);
ck("całkowanie klatek: czysto przez całą nutę = 100 i nuta się zamyka", czysta.length === 1 && blisko(czysta[0].wynik, 100, 1e-6) && czysta[0].spiewal);
const polowa = zagraj(jedna, b => ({ spiewa: b <= .5, polton: 60 }), 120);
ck("całkowanie klatek: śpiew przez pół nuty = 50 (cisza liczy się jako 0)", blisko(polowa[0].wynik, 50, 2), polowa[0].wynik);
const krzywo = zagraj(jedna, () => ({ spiewa: true, polton: 61.5 }), 120);
ck("całkowanie klatek: 1,5 półtonu obok przez całą nutę = 50", blisko(krzywo[0].wynik, 50, 1e-6), krzywo[0].wynik);
const cisza = zagraj(jedna, () => ({ spiewa: false, polton: 60 }), 120);
ck("całkowanie klatek: bez jednej klatki śpiewu = pudło", cisza.length === 1 && !cisza[0].spiewal && cisza[0].wynik === 0);
const dwieNaraz = kl([{ m: 60, t: 0, d: .25 }, { m: 62, t: .25, d: .25 }], 0, { sumaAcc: 0, spiewal: false }, 0, .6, true, 60);
ck("całkowanie: klatka dłuższa niż nuty zamyka obie i liczy każdą tylko za jej kawałek",
   // druga nuta: 2 półtony obok → celność 0,25 przez całą jej długość = 25
   dwieNaraz.i === 2 && dwieNaraz.zamkniete.length === 2 && blisko(dwieNaraz.zamkniete[0].wynik, 100) && blisko(dwieNaraz.zamkniete[1].wynik, 25),
   JSON.stringify(dwieNaraz));
const pod = F("indeksNutyPod"), nast = F("indeksNastepnej");
const nn = [{ t: 0, d: 1 }, { t: 2, d: 1 }, { t: 3, d: .5 }];
ck("nuta pod linią i następna (wyszukiwanie binarne)",
   pod(nn, 0) === 0 && pod(nn, .99) === 0 && pod(nn, 1.5) === -1 && pod(nn, 3.2) === 2 && pod(nn, 3.5) === -1 &&
   nast(nn, 1.5) === 1 && nast(nn, -1) === 0 && nast(nn, 3) === -1);
ck("celność gracza = średnia wszystkich nut partii (pominięte = 0)",
   blisko(F("celnoscGracza")([{ wynik: 100 }, { wynik: 50 }, undefined, { wynik: 90 }], 4), 60));

// ---- 4b. recenzja 1: opóźnienie per źródło, chór, wibrato, pauzy --------------------------------
const off = F("offGracza");
// 10-20: bot ma 0 — nie nadaje przez radio, a jego ślad i śpiew szły przez to o 150 ms za nutami
ck("offGracza: kapsel = suwak „Opóźnienie kapsli”, bot, mysz i klawiatura = 0",
   off("kapsel", { opoznienie: 150 }) === 150 && off("bot", { opoznienie: 150 }) === 0 && off("mysz", { opoznienie: 150 }) === 0 &&
   off("ws", { opoznienie: 150 }) === 0 && off("strzalki", { opoznienie: 300 }) === 0);
ck("offGracza: ujemny suwak działa, brak ustawień = 0", off("kapsel", { opoznienie: -100 }) === -100 && off("kapsel", null) === 0);
const pch = F("premiaChoru");
ck("premiaChoru: +50% tylko gdy WSZYSTKIE (≥ 2) żaby toru zamknęły nutę na „Czysto”",
   pch(["czysto", "czysto"]) === .5 && pch(Array(8).fill("czysto")) === .5 && pch(["czysto"]) === 0 &&
   pch(["czysto", "dobrze"]) === 0 && pch(["czysto", "pudlo", "czysto"]) === 0 && pch([]) === 0);
const maksChor = F("maksimumPunktow")([1, 1, 1, 1].map(d => ({ d })));
ck("maksimum NIE zawiera premii chóru ani wibrata (100+100+100+200 = 500, +10% = 550): dodatki tylko podnoszą procent",
   maksChor.bezPremii === 500 && maksChor.razem === 550, JSON.stringify(maksChor));
const rw = roz(0, 100, true, 2, true), rwBez = roz(0, 100, false, 2, true);
ck("rozliczNute z wibrato: punkty ×1,25 (140 → 175), bez śpiewu wibrato się nie liczy",
   rw.punkty === 175 && rw.wibrato === true && rwBez.punkty === 0 && rwBez.wibrato === false, JSON.stringify([rw, rwBez]));
function zagrajWib(d, wibOd, wibDo) {   // nuta d ćwierćnut, czysto, kapsel kręci się w [wibOd, wibDo)
  const n = [{ m: 60, t: 0, d }], ak = { sumaAcc: 0, spiewal: false, wib: 0 }, out = [];
  let i = 0, b = 0;
  while (b < d + .1) { const b1 = b + 1 / 60; const r = kl(n, i, ak, b, b1, true, 60, b1 > wibOd && b1 <= wibDo); i = r.i; out.push(...r.zamkniete); b = b1; }
  return out[0];
}
ck("wibrato: kręcenie przez całą drugą połowę nuty 2 ćwierćnut liczy się", zagrajWib(2, 1, 2).wibrato === true);
ck("wibrato: kręcenie tylko w pierwszej połowie się nie liczy", zagrajWib(2, 0, 1).wibrato === false);
ck("wibrato: 30% drugiej połowy to za mało (próg 40%), 50% wystarczy",
   zagrajWib(2, 1.7, 2).wibrato === false && zagrajWib(2, 1.5, 2).wibrato === true);
ck("wibrato: krótka nuta (1 ćwierćnuta) nie daje wibrata", zagrajWib(1, 0, 1).wibrato === false);
const pz = F("wPauzie"), nutyP = [{ t: 0, d: 1 }, { t: 1, d: 1 }, { t: 4, d: 1 }];
ck("wPauzie: odliczanie przed pierwszą nutą i czas po ostatniej to pauza", pz(nutyP, -2) && pz(nutyP, 6));
ck("wPauzie: pod nutą nie ma pauzy, tuż przed nutą (0,3) i tuż po (0,15) też nie",
   !pz(nutyP, .5) && !pz(nutyP, -.2) && !pz(nutyP, 2.05) && !pz(nutyP, 3.8));
ck("wPauzie: w środku przerwy dłuższej niż ćwierćnuta jest pauza", pz(nutyP, 2.5) && pz(nutyP, 3.6));
ck("wPauzie: przerwa krótsza niż ćwierćnuta (oddech między nutami) nie jest pauzą",
   !pz([{ t: 0, d: 1 }, { t: 1.5, d: 1 }], 1.2));
const uch = F("ukladChoru");
const u1 = uch(1, 70, 268), u4 = uch(4, 70, 268), u8 = uch(8, 70, 268), u3 = uch(3, 70, 268);
const miesci = u => (7 * u.krok + u.zaba / 2) <= 268 + 1e-9;
ck("ukladChoru: solista bez kroku i pełnej wielkości", u1.krok === 0 && u1.zaba === 70);
ck("ukladChoru: 3 żaby ×0,85, 4 żaby ×0,85, krok co najmniej 0,8 żaby",
   blisko(u3.zaba, 59.5) && blisko(u4.zaba, 59.5) && u4.krok >= .8 * u4.zaba - 1e-9 && u3.krok >= .8 * u3.zaba - 1e-9);
ck("ukladChoru: 8 żab mieści się w pasie przeszłości (krok ≥ 0,8 żaby, żaba ≤ 0,7 bazowej)",
   u8.zaba <= 49 + 1e-9 && u8.krok >= .8 * u8.zaba - 1e-9 && miesci(u8), JSON.stringify(u8));
const zds = F("znajdzDoScalenia"), torA = {}, torB = {};
const dymki = [{ tor: torA, rodzaj: "kombo", od: 1000 }, { tor: torA, rodzaj: "falsz", od: 1050 }, { tor: torB, rodzaj: "kombo", od: 1100 }];
ck("dymki: ten sam tor i rodzaj w oknie 150 ms scala się, inny rodzaj, tor albo starszy nie",
   zds(dymki, torA, "kombo", 1140, 150) === dymki[0] && zds(dymki, torA, "chor", 1140, 150) === null &&
   zds(dymki, torA, "kombo", 1200, 150) === null && zds(dymki, torB, "kombo", 1150, 150) === dymki[2]);
const kp = F("kluczPodpowiedzi"), T = F("T");
const klucze = ["kapsel", "mysz", "ws", "strzalki"].flatMap(z => [kp(z, false), kp(z, true)]);
ck("instrukcja startu: osobny tekst dla kapsla, myszy i obu klawiatur, w obu trybach; bot bez instrukcji",
   kp("kapsel", false) === "start_kapsel_pelny" && kp("mysz", true) === "start_mysz_latwy" && kp("bot", false) === null &&
   klucze.every(k => typeof T[k] === "string" && T[k].length > 10));
ck("instrukcja startu: tryb pełny mówi o trzymaniu przycisku, łatwy o tym, że żaba śpiewa sama",
   ["kapsel", "mysz", "ws", "strzalki"].every(z => /Trzymaj/.test(T[kp(z, false)]) && /śpiewa sama/.test(T[kp(z, true)])));

// ---- 4c. recenzja 2: tempo „kum”, aplauz kapslem, rekord solisty, żaba-duch ---------------------
function trzymaj(sek) {   // ciągłe gadanie przez `sek` s przy 60 fps: czasy kolejnych „kum”
  let k = { ciag: 0, za: 0 }, t = 0; const czasy = [];
  for (let n = 0; n < Math.round(sek * 60); n++) { t += 1 / 60; k = F("krokKum")(k, 1 / 60); if (k.kum) czasy.push(t); }
  return czasy;
}
const kumy = trzymaj(6);
const wOknie = (a, b) => kumy.filter(t => t > a + 1e-9 && t <= b + 1e-9).length;
ck("„kum”: pierwszy od razu (w pierwszej klatce), drugi po 0,5 s",
   blisko(kumy[0], 1 / 60) && blisko(kumy[1] - kumy[0], .5, 1e-6), JSON.stringify(kumy.slice(0, 3)));
ck("„kum”: w pierwszych 2 s najwyżej 2,2 na sekundę (jest " + wOknie(0, 2) / 2 + "/s), także w każdej pierwszej sekundzie",
   wOknie(0, 2) / 2 <= 2.2 && wOknie(0, 1) <= 2.2 && wOknie(1, 2) <= 2.2, JSON.stringify(kumy));
ck("„kum”: po 2 s gadania najwyżej 1,5 na sekundę (2–4 s: " + wOknie(2, 4) / 2 + "/s, 2–6 s: " + wOknie(2, 6) / 4 + "/s), odstęp 0,7 s",
   wOknie(2, 4) / 2 <= 1.5 && wOknie(2, 6) / 4 <= 1.5 && blisko(kumy[kumy.length - 1] - kumy[kumy.length - 2], .7, 1e-6),
   JSON.stringify(kumy));
const zbierz = F("zbierzAplauz");
let ap = { sumy: {} };
for (let n = 0; n < 60; n++) ap = zbierz(ap.sumy, [{ id: "k", twist: -300 }, { id: "drzy", twist: 20 }, { id: "m", ruch: 1000 },
  { id: "kl", klawisze: n % 20 === 0 ? 1 : 0 }], 1 / 60);
ck("aplauz: 1 s kręcenia kapslem 300 °/s = 300°, drżenie 20 °/s = 0, mysz 1000 px/s = 300°, 3 klawisze = 120°",
   blisko(ap.sumy.k, 300, 1e-6) && ap.sumy.drzy === 0 && blisko(ap.sumy.m, 300, 1e-6) && blisko(ap.sumy.kl, 120, 1e-6), JSON.stringify(ap.sumy));
ck("aplauz: głośność widowni 0..1 (900 °/s wszystkich razem = pełna, 450 = połowa, więcej się nie liczy)",
   blisko(zbierz({}, [{ id: "a", twist: 450 }, { id: "b", twist: 450 }], .1).glosnosc, 1) &&
   blisko(zbierz({}, [{ id: "a", twist: 450 }], .1).glosnosc, .5) && zbierz({}, [{ id: "a", twist: 5000 }, { id: "b", twist: 5000 }], .1).glosnosc === 1 &&
   zbierz({}, [], .1).glosnosc === 0);
ck("aplauz: obrót i mysz najwyżej 720 °/s na gracza (szarpanie myszą nie przebije kapsla), klawisze osobno",
   blisko(zbierz({}, [{ id: "m", ruch: 20000 }], 1).sumy.m, 720) && blisko(zbierz({}, [{ id: "k", twist: 2000, klawisze: 2 }], 1).sumy.k, 800));
ck("aplauz: zbierzAplauz nie zmienia sum wejściowych", (() => { const s = { a: 5 }; zbierz(s, [{ id: "a", twist: 100 }], 1); return s.a === 5; })());
const naj = F("najwiekszyAplauz");
ck("„Największy aplauz”: najwięcej stopni wygrywa, poniżej ćwierć obrotu nikt, remis: pierwszy z listy",
   naj({ a: 200, b: 500 }, ["a", "b"]) === "b" && naj({ a: 80, b: 60 }, ["a", "b"]) === null && naj({ a: 300, b: 300 }, ["b", "a"]) === "b" &&
   naj({ x: 999 }, ["a", "b"]) === null);
const nagSolo = F("przyznajNagrody")([{ id: "s", punkty: 9000, celnosc: 95, maxKombo: 40, falsze: 0, gadanie: 0 }]);
ck("solista nie dostaje żadnej nagrody (zamiast nich rekord piosenki)",
   nagSolo.czysty === null && nagSolo.kombo === null && nagSolo.falsz === null && nagSolo.gadula === null, JSON.stringify(nagSolo));
const rek = F("rekordPiosenki"), rek0 = { oda: 5000 };
const r1 = rek({}, "oda", 4200), r2 = rek(rek0, "oda", 4800), r3 = rek(rek0, "oda", 6100);
ck("rekord: pierwsze granie to nowy rekord, słabszy wynik zostawia stary, lepszy go podnosi; mapa wejściowa bez zmian",
   r1.nowy && r1.rekord === 4200 && r1.rekordy.oda === 4200 && !r2.nowy && r2.rekord === 5000 && r2.rekordy.oda === 5000 &&
   r3.nowy && r3.rekord === 6100 && r3.poprzedni === 5000 && r3.rekordy.oda === 6100 && rek0.oda === 5000 &&
   rek({ oda: 1 }, "buns", 10).rekordy.oda === 1, JSON.stringify([r1, r2, r3]));
const duch = { polton: 50, spiewa: false }, nutyD = [{ m: 64, t: 0, d: 1 }, { m: 67, t: 2, d: 1 }];
for (let b = -1; b < .4; b += 1 / 80) F("krokDucha")(duch, nutyD, b, 1 / 60);
const naNucie = Math.abs(duch.polton - 64) < .05 && duch.spiewa;
for (let b = .4; b < 1.6; b += 1 / 80) F("krokDucha")(duch, nutyD, b, 1 / 60);
ck("żaba-duch: w odliczaniu podjeżdża na pierwszą nutę i śpiewa ją pod linią, w przerwie milknie i szykuje następną",
   naNucie && !duch.spiewa && Math.abs(duch.polton - 67) < .2, JSON.stringify(duch));

// ---- 5. podział na tory ------------------------------------------------------------------------
const tory = F("podzialNaTory");
const partie5 = [70, 66, 61, 52, 75].map(srednia => ({ srednia }));
const t1 = tory([{ id: "a", partia: 0 }, { id: "b", partia: 0 }, { id: "c", partia: 0 }], partie5, 4);
ck("tory: wszyscy na melodii = jeden wspólny tor, reszta partii do podkładu",
   t1.tory.length === 1 && t1.tory[0].gracze.join() === "a,b,c" && t1.bezSpiewu.join() === "1,2,3,4", JSON.stringify(t1));
const t2 = tory([{ id: "a", partia: 3 }, { id: "b", partia: 0 }, { id: "c", partia: 2 }, { id: "d", partia: 1 }, { id: "e", partia: 0 }], partie5, 4);
ck("tory: cztery partie = cztery tory od najwyżej śpiewającej, ta sama partia dzieli tor",
   t2.tory.map(t => t.partia).join() === "0,1,2,3" && t2.tory[0].gracze.join() === "b,e" && !t2.przeniesieni.length,
   JSON.stringify(t2.tory));
const t3 = tory([{ id: "a", partia: 4 }, { id: "b", partia: 3 }, { id: "c", partia: 2 }, { id: "d", partia: 1 }, { id: "e", partia: 0 }, { id: "f", partia: 3 }], partie5, 4);
ck("tory: piąta partia nie dostaje toru, jej śpiewak idzie do melodii",
   t3.tory.length === 4 && t3.przeniesieni.join() === "a" && t3.tory.find(t => t.partia === 0).gracze.includes("a") &&
   t3.bezSpiewu.join() === "4", JSON.stringify(t3));
const partie6 = [70, 66, 61, 52, 75, 48].map(srednia => ({ srednia }));
const t4 = tory([{ id: "a", partia: 1 }, { id: "b", partia: 2 }, { id: "c", partia: 3 }, { id: "d", partia: 4 }, { id: "e", partia: 4 },
  { id: "f", partia: 5 }], partie6, 4);
ck("tory: bez melodii nadmiarowy śpiewak idzie do najliczniejszej partii, a melodia gra w podkładzie",
   t4.tory.length === 4 && t4.przeniesieni.join() === "f" && t4.bezSpiewu.join() === "0,5" &&
   t4.tory.find(t => t.partia === 4).gracze.join() === "d,e,f", JSON.stringify(t4));
const t5 = tory([{ id: "a", partia: 1 }, { id: "b", partia: 2 }, { id: "c", partia: 3 }, { id: "d", partia: 4 }, { id: "e", partia: 4 },
  { id: "f", partia: 0 }], partie5, 4);
ck("tory: przy remisie liczności tor dostaje niższy indeks (melodia), odpada partia 3",
   t5.tory.map(t => t.partia).sort().join() === "0,1,2,4" && t5.przeniesieni.join() === "c" &&
   t5.tory.find(t => t.partia === 0).gracze.join() === "c,f", JSON.stringify(t5));
ck("tory: brak graczy = brak torów, cała piosenka w podkładzie", tory([], partie5, 4).tory.length === 0 && tory([], partie5, 4).bezSpiewu.length === 5);
ck("tory: zły numer partii trafia do melodii", tory([{ id: "x", partia: 99 }], partie5, 4).tory[0].partia === 0);

// ---- 6. wyniki i słownik ---------------------------------------------------------------------
const lista = [{ id: "a", punkty: 900, celnosc: 70, maxKombo: 5, falsze: 0 }, { id: "b", punkty: 1200, celnosc: 88, maxKombo: 9, falsze: 3 },
  { id: "c", punkty: 1250, celnosc: 91, maxKombo: 9, falsze: 3 }];
ck("ranking: punkty, przy remisie celność", F("rankingGraczy")(lista).map(x => x.id).join() === "c,b,a" &&
   F("rankingGraczy")([{ id: "x", punkty: 5, celnosc: 10 }, { id: "y", punkty: 5, celnosc: 20 }]).map(x => x.id).join() === "y,x");
const ng = F("przyznajNagrody")(lista);
ck("nagrody: najczystszy głos, największe kombo (remis: więcej punktów), król fałszu (remis: gorsza celność)",
   ng.czysty === "c" && ng.kombo === "c" && ng.falsz === "b", JSON.stringify(ng));
ck("nagrody: bez fałszu nikt nie zostaje królem fałszu", F("przyznajNagrody")([lista[0]]).falsz === null);
ck("nagrody: solista nie dostaje „Króla fałszu” ani „Gaduły”, nawet gdy fałszował i gadał",
   F("przyznajNagrody")([{ id: "s", punkty: 1, celnosc: 20, maxKombo: 1, falsze: 9, gadanie: 5 }]).falsz === null &&
   F("przyznajNagrody")([{ id: "s", punkty: 1, celnosc: 20, maxKombo: 1, falsze: 9, gadanie: 5 }]).gadula === null);
const gad = F("przyznajNagrody")([{ id: "a", punkty: 5, celnosc: 50, maxKombo: 1, falsze: 0, gadanie: 3.2 },
  { id: "b", punkty: 6, celnosc: 60, maxKombo: 1, falsze: 0, gadanie: .4 }]);
ck("nagrody: „Największa gaduła” dla najdłużej gadającego w pauzach (od 1 s)", gad.gadula === "a" &&
   F("przyznajNagrody")([{ id: "a", punkty: 5, celnosc: 50, maxKombo: 1, falsze: 0, gadanie: .9 },
     { id: "b", punkty: 6, celnosc: 60, maxKombo: 1, falsze: 0, gadanie: .4 }]).gadula === null, JSON.stringify(gad));
const odm = F("odmiana");
ck("odmiana: 1 partia, 2 partie, 5 partii, 12 partii, 22 partie",
   [1, 2, 5, 12, 22].map(n => odm(n, "partia", "partie", "partii")).join() === "partia,partie,partii,partii,partie");
ck("tt: podstawia zmienne w napisie ze słownika", F("tt")("startZa", { n: 3 }) === "Start za 3…", F("tt")("startZa", { n: 3 }));

// ---- 7. wejście: kontrakt gracza z atrapami okna -------------------------------------------------
{
  const zdarzenia = [], magazyn = {};
  const w = {
    console, Math, Number, JSON, Array, Object, Map, Set, String, Error, performance: { now: () => 1000 },
    innerHeight: 800, addEventListener() {}, document: { activeElement: null },
    localStorage: { getItem: k => (k in magazyn ? magazyn[k] : null), setItem: (k, v) => { magazyn[k] = String(v); } },
    EventSource: function () {},
  };
  w.window = w;
  vm.createContext(w);
  vm.runInContext(czytaj("wejscie.js") + ";this.Wejscie=Wejscie;", w);
  const We = w.Wejscie;
  We.init({ zakres: 40, ziarno: 3, nazwy: { boty: ["Kumak"] } });
  We.naZdarzenie(z => zdarzenia.push(z.typ + ":" + z.gracz.id));
  We.obsluzZdarzenie({ t: "s", dev: "d0", pose: { pitch: 10 } });
  ck("wejście: `s` nieznanego slotu niczego nie tworzy (slot wprowadza tylko devmeta)", !We.gracz("kapsel-d0"));
  We.obsluzZdarzenie({ t: "devmeta", dev: "d0", slot: 0, name: "Triki 1", label: "Ola", color: "#ffcb05", cap: "4", muted: false });
  const g = We.gracz("kapsel-d0");
  ck("wejście: devmeta tworzy gracza kapsla z nazwą, kolorem i obrazkiem kapsla",
     g && g.nazwa === "Triki 1" && g.kolor === "#ffcb05" && g.obrazekKapsla === "../assets/caps/4-96.png" && g.zywy === true &&
     zdarzenia.join() === "nowe:kapsel-d0", JSON.stringify([g && g.obrazekKapsla, zdarzenia]));
  We.obsluzZdarzenie({ t: "s", dev: "d0", ts: 1, a: [0, 0, 0], g: [0, 0, 0], pose: { tilt: 20, twist: 90, pitch: -12.5, roll: 30, spin: 0 } });
  ck("wejście: `s` niesie pozę (pitch, roll, twist w stopniach ze znakiem)", g.pitch === -12.5 && g.roll === 30 && g.twist === 90);
  zdarzenia.length = 0;
  const b = by => We.obsluzZdarzenie({ t: "b", dev: "d0", ts: 2, bytes: by });
  b([0x21, 1, 0, 7, 0]); b([0x21, 1, 0, 8, 0]); b([0x21, 0, 0, 9, 0]);
  ck("wejście: przycisk = bajt 1 bit 0, zdarzenia tylko na zboczach (licznik w bajcie 3 nie klika)",
     zdarzenia.join() === "wcisniecie:kapsel-d0,puszczenie:kapsel-d0", zdarzenia.join());
  magazyn["ribbitflip.btnbit"] = JSON.stringify({ byte: 2, bit: 3 });
  zdarzenia.length = 0;
  b([0x21, 1, 0, 0, 0]); b([0x21, 0, 8, 0, 0]);
  ck("wejście: nauczony bit z localStorage['ribbitflip.btnbit'] zastępuje domyślny",
     zdarzenia.join() === "wcisniecie:kapsel-d0" && g.przycisk === true, zdarzenia.join());
  magazyn["ribbitflip.btnbit"] = JSON.stringify({ byte: 9, bit: 3 });
  b([0x21, 0, 0, 0, 0]);
  ck("wejście: nauczony bit spoza zakresu jest ignorowany (wraca bajt 1 bit 0)", g.przycisk === false);
  We.obsluzZdarzenie({ t: "devgone", dev: "d0" });
  ck("wejście: devgone usuwa gracza i zgłasza „znika”", !We.gracz("kapsel-d0") && zdarzenia[zdarzenia.length - 1] === "znika:kapsel-d0");
  const bot = We.dodajBota(0);
  We.ustawCelBotow(() => ({ idx: 5, polton: 64, doKonca: .4, naStopnie: s => (66 - s) * 5 }));
  for (let i = 0; i < 120; i++) We.krok(1 / 60, 1000 + i * 16);
  ck("bot przy luzie 0 dojeżdża do wysokości nuty i trzyma przycisk w trakcie nuty",
     blisko(bot.pitch, 10, .01) && bot.przycisk === true, [bot.pitch, bot.przycisk]);
  We.ustawCelBotow(() => ({ idx: 5, polton: 64, doKonca: .02, naStopnie: s => (66 - s) * 5 }));
  We.krok(1 / 60, 3000);
  ck("bot puszcza przycisk tuż przed końcem nuty (oddech między nutami)", bot.przycisk === false);
}

// ---- 9. Pakiety MIDI, import z adresu, licencje (pakiety.js) --------------------------------------------------------
{
  const lw = F("licencjaWpisu"), la = F("liniaAtrybucji");
  const sB = { title: "Symphony No.9, Op.125", composer: "Beethoven, Ludwig van", license: "cc-by-3.0", midi_author: "Michel Rondeau",
    source_url: "https://imslp.org/wiki/File:WIMA.c315-HymJoySco.mid", metadata_url: "https://imslp.org/wiki/Symphony_No.9", pakiet: "basic_classics" };
  const lP = lw("pakiet", sB), lW = lw("wbudowana"), lU = lw("upuszczona", null, "https://example.org/a.mid");
  ck("licencje: pakiet niesie licencję z manifestu (nazwa, link, autor pliku, źródło, wymóg atrybucji), wbudowane = domena publiczna, własne = plik użytkownika",
     lP.typ === "pakiet" && lP.nazwa === "CC BY 3.0" && lP.url === "https://creativecommons.org/licenses/by/3.0/" && lP.atrybucja === true &&
     lP.autorMidi === "Michel Rondeau" && lP.zrodlo === sB.source_url && lW.typ === "pd" && lW.nazwa === "Domena publiczna" && !lW.atrybucja &&
     lU.typ === "uzytkownik" && lU.zrodlo === "https://example.org/a.mid", JSON.stringify([lP, lW, lU]));
  ck("licencje: CC0 i domena publiczna z pakietu nie wymagają atrybucji, licencja spoza listy nie wysypuje",
     lw("pakiet", { license: "cc0-1.0" }).atrybucja === false && lw("pakiet", { license: "public-domain" }).krotko === "PD" &&
     lw("pakiet", { license: "dziwna" }).nazwa === "dziwna");
  ck("atrybucja w jednej linii: tytuł – kompozytor · licencja · MIDI: autor",
     la("x", lP) === "Symphony No.9, Op.125 – Beethoven, Ludwig van · CC BY 3.0 · MIDI: Michel Rondeau" &&
     la("Oda do radości", lW) === "Oda do radości · Domena publiczna", la("x", lP));
  const az = F("adresZeSchowka");
  ck("schowek: adres pliku tylko http/https bez spacji, inny tekst nie jest adresem",
     az(" https://x.org/a.mid ") === "https://x.org/a.mid" && az("http://127.0.0.1:8790/a.mid") === "http://127.0.0.1:8790/a.mid" &&
     az("ftp://x/a.mid") === null && az("zwykły tekst") === null && az("https://x.org/a b.mid") === null && az("") === null);
  const fm = F("fmtMB");
  ck("rozmiar pobrania w MB po polsku", fm(24_200_000) === "23 MB" && fm(1_572_864) === "1,5 MB" && fm(10) === "<0,1 MB", [fm(24_200_000), fm(1_572_864)]);
}

// ---- 8. RibbitBeat: trudność partii, precyzja, ogień, tablica wyników, poziomy botów, pad ---------------------
{
  const tr = F("trudnoscPartii"), cechy = F("cechyPartii");
  const ciag = (kroki, d) => kroki.map((m, i) => ({ m: 60 + m, t: i * d, d }));
  const gama = [0, 2, 4, 5, 7, 9, 11, 12, 11, 9, 7, 5, 4, 2];
  const wolne = ciag([0, 2, 4, 2, 0, 2, 4, 2], 2), oktawy = ciag(Array.from({ length: 48 }, (_, i) => i % 2 ? 12 : 0), .5);
  const t1 = tr(wolne, 80, 40), t2 = tr(oktawy, 120, 40);
  ck("trudność: wolne półnuty krokami to „łatwa”, ósemki skaczące o oktawę przy 120 to „ekstremalna”",
     t1.poziom === "latwa" && t1.ocena < 3 && t2.poziom === "ekstremalna" && t2.ocena >= 7.5, [t1.ocena, t2.ocena]);
  const tempa = [60, 90, 120, 150].map(b => tr(ciag(powtorzN(gama, 4), .5), b, 40).ocena);
  function powtorzN(a, n) { return Array.from({ length: n }, () => a).flat(); }
  ck("trudność rośnie z tempem (ósemki w gamie: 60 → 90 → 120 → 150)", tempa.every((v, i) => !i || v > tempa[i - 1]), tempa);
  ck("trudność: ocena w skali 1–10 z jednym miejscem po przecinku, pusta partia = 1",
     [t1, t2].every(x => x.ocena >= 1 && x.ocena <= 10 && Math.round(x.ocena * 10) === x.ocena * 10) && tr([], 100, 40).ocena === 1);
  const powt = cechy(ciag(Array(32).fill(7), .5), .5, 40), skok = cechy(oktawy, .5, 40);
  ck("trudność: powtarzana nuta nie wymaga ruchu (strata 0), a powtórka waży 0,25 w gęstości",
     powt.ruch === 0 && Math.abs(powt.nps - (1 + 31 * .25) / 8) < .01 && skok.ruch > .2, [powt.ruch, powt.nps, skok.ruch]);
  const bieg = cechy(ciag(gama, .25), .5, 40), zyg = cechy(ciag([0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2], .25), .5, 40);
  ck("trudność: gama (bieg w jedną stronę) kosztuje mniej ruchu niż przeskakiwanie tam i z powrotem o te same 2 półtony",
     bieg.ruch < zyg.ruch, [bieg.ruch, zyg.ruch]);
  const umpa = cechy(ciag(Array.from({ length: 24 }, (_, i) => i % 2 ? 7 : 0), 1), .5, 40);
  const zz = cechy(ciag([0, 7, 2, 9, 4, 11, 0, 7, 2, 9, 4, 11], 1), .5, 40);
  ck("trudność: bas „um-pa” (dwie nuty na zmianę) nie jest zygzakiem, 0-7-2-9-4-11 jest", umpa.zygzaki === 0 && zz.zygzaki > .5,
     [umpa.zygzaki, zz.zygzaki]);
  const synk = cechy([{ m: 60, t: 0, d: .5 }, { m: 62, t: .5, d: 1 }, { m: 64, t: 1.5, d: .5 }, { m: 65, t: 2, d: 1 }], .5, 40);
  const tri = cechy(ciag([0, 2, 4, 2, 0, 2], 1 / 3), .5, 40);
  ck("trudność: synkopa (nuta z „i” trwająca przez miarę) i triola liczą się do rytmu, równe ćwierćnuty nie",
     synk.rytm > 0 && tri.rytm > .5 && cechy(ciag(gama, 1), .5, 40).rytm === 0, [synk.rytm, tri.rytm]);
  const waska = cechy(ciag([0, 2, 4], 1), .5, 40), szeroka = cechy(ciag([0, 15, 30], 1), .5, 40);
  ck("trudność: szeroki zakres = mniej stopni na półton (mały cel)", szeroka.stopniNaPolton < waska.stopniNaPolton / 3,
     [waska.stopniNaPolton, szeroka.stopniNaPolton]);
  ck("trudność: „dlaczego” wskazuje skoki dla oktaw i podaje najwyżej dwa czynniki",
     t2.glowne[0] === "ruch" && t2.glowne.length <= 2 && t1.glowne.length === 0, JSON.stringify([t1.glowne, t2.glowne]));
  const P = F("ZC_TRUDNOSC").POZIOMY.map(p => p.k);
  ck("trudność: pięć poziomów po kolei, granice 3 / 4,5 / 6 / 7,5",
     P.join() === "latwa,srednia,trudna,bardzoTrudna,ekstremalna" &&
     [2.9, 3, 4.4, 4.5, 5.9, 6, 7.4, 7.5].map(F("poziomTrudnosci")).join() ===
     "latwa,srednia,srednia,trudna,trudna,bardzoTrudna,bardzoTrudna,ekstremalna");
  ck("skalaProgow: liniowo między progami, malejące progi (precyzja: mniej stopni = trudniej)",
     F("skalaProgow")(1.5, [[1, 0], [2, 10]]) === 5 && F("skalaProgow")(9, [[7, 0], [5, 2]]) === 0 && F("skalaProgow")(6, [[7, 0], [5, 2]]) === 1);
  // wbudowane: spokojniejsze melodie przy swoim tempie są łatwe (od 2026-11-11 cztery: oda, jingle, scarborough, gwiazdka)
  const wb = F("wbudowanePiosenki")(), latwe = wb.filter(p => tr(p.partie[0].nuty, p.tempo, 40).poziom === "latwa").map(p => p.id);
  ck("trudność: spokojniejsze wbudowane melodie przy tempie z pliku to „łatwa”", ["oda", "jingle", "scarborough", "gwiazdka"].every(id => latwe.includes(id)), latwe.join());
  // precyzja, ranking w dwóch kategoriach, ogień
  ck("precyzja: trafione = Czysto + Dobrze z WSZYSTKICH nut partii (pudło i nie zagrane = nietrafione)",
     F("precyzjaZOcen")({ czysto: 6, dobrze: 2, prawie: 1, falsz: 1 }, 10) === 80 && F("precyzjaZOcen")({}, 0) === 0);
  const zaw = [{ id: "a", punkty: 900, precyzja: 70, celnosc: 70 }, { id: "b", punkty: 500, precyzja: 95, celnosc: 90 },
    { id: "c", punkty: 500, precyzja: 80, celnosc: 85 }];
  ck("ranking w dwóch kategoriach: punkty (remis: precyzja) i precyzja (remis: celność, potem punkty)",
     F("rankingGraczy")(zaw).map(x => x.id).join() === "a,b,c" && F("rankingGraczy")(zaw, "precyzja").map(x => x.id).join() === "b,c,a");
  ck("ogień kombo: 0–3 przy kombo 0, 4, 8, 12 (te same progi co mnożnik)",
     [0, 3, 4, 7, 8, 11, 12, 40].map(F("poziomOgnia")).join() === "0,0,1,1,2,2,3,3");
  // klik w rytm: ocena krawędzi, dopasowanie do nuty, premia
  const ok = F("ocenaKliku");
  ck("klik: do 50 ms „idealnie”, do 100 ms „dobrze”, do 150 ms „obok” (zeruje serię), dalej nie należy do nuty",
     [0, -.05, .049, .07, -.1, .12, -.15, .16].map(ok).join() === "idealnie,idealnie,idealnie,dobrze,dobrze,obok,obok,");
  const dk = F("dopasujKlik"), nk = [{ m: 60, t: 0, d: 1 }, { m: 62, t: 1, d: 1 }, { m: 64, t: 3, d: 2 }];   // 120 bpm: 0,5 s na ćwierćnutę
  const w1 = dk(nk, .06, .5, "wejscie"), z1 = dk(nk, .98, .5, "zejscie"), w2 = dk(nk, 1.02, .5, "wejscie"),
    z3 = dk(nk, 5.1, .5, "zejscie"), brak = dk(nk, 2, .5, "wejscie"), dlugaZ = dk(nk, 4, .5, "zejscie");
  ck("klik: naciśnięcie trafia w wejście najbliższej nuty, puszczenie w zejście (w legato granica dzieli się na dwie nuty)",
     w1 && w1.idx === 0 && Math.abs(w1.dt - .03) < 1e-9 && z1 && z1.idx === 0 && Math.abs(z1.dt + .01) < 1e-9 &&
     w2 && w2.idx === 1 && z3 && z3.idx === 2 && Math.abs(z3.dt - .05) < 1e-9 && brak === null && dlugaZ === null,
     JSON.stringify([w1, z1, w2, z3, brak, dlugaZ]));
  const pk = F("premiaKliku");
  ck("klik: premia = 15% (idealnie) albo 7% (dobrze) punktów nuty zaśpiewanej czysto przy obecnym mnożniku, „obok” nic",
     pk("idealnie", 1, 1) === Math.round(F("punktyZaNute")(100, 1, 1) * .15) && pk("dobrze", 4, 2) === Math.round(F("punktyZaNute")(100, 4, 2) * .07) &&
     pk("obok", 4, 2) === 0 && pk(null, 1, 1) === 0 && pk("idealnie", 4, 1) > pk("idealnie", 1, 1));
  // w punkt (10-05): obie krawędzie nuty w oknie = osobna premia rosnąca z serią
  const ow = F("ocenaWPunkt"), pw = F("premiaWPunkt"), pzn = F("punktyZaNute");
  ck("w punkt: obie krawędzie idealnie = „idealnie”, obie co najmniej dobrze = „dobrze”, brak albo „obok” jednej = nic",
     ow("idealnie", "idealnie") === "idealnie" && ow("idealnie", "dobrze") === "dobrze" && ow("dobrze", "dobrze") === "dobrze" &&
     ow("idealnie", "obok") === null && ow(undefined, "idealnie") === null && ow("dobrze", undefined) === null);
  ck("w punkt: premia 20 % (dobrze) / 30 % (idealnie) punktów czystej nuty, seria +5 % za kolejną nutę, sufit ×1,5",
     pw("dobrze", 1, 1, 1) === Math.round(pzn(100, 1, 1) * .2) && pw("idealnie", 1, 2, 2) === Math.round(pzn(100, 2, 2) * .3) &&
     pw("dobrze", 5, 1, 1) === Math.round(pzn(100, 1, 1) * .2 * 1.2) && pw("dobrze", 50, 1, 1) === Math.round(pzn(100, 1, 1) * .2 * 1.5) &&
     pw("obok", 3, 1, 1) === 0, [pw("dobrze", 1, 1, 1), pw("dobrze", 5, 1, 1), pw("dobrze", 50, 1, 1)]);
  const rzw = F("rozbicieWyniku")({ punkty: 1000, premiaKlik: 200, oceny: { czysto: 3 }, kliki: { idealnie: 2 }, wPunkt: 2 });
  ck("w punkt: rozbicie wyniku ma żeton „w punkt”, a premia siedzi w części „klik” (suma się zgadza)",
     rzw.dodatki.some(x => x.k === "wpunkt" && x.n === 2) && rzw.punkty.klik === 200 && rzw.punkty.nuty === 800, JSON.stringify(rzw));
  // czas na ruch jako procent (10-05)
  const pr = F("procentRuchu"), mr = F("mnoznikRuchu");
  ck("czas na ruch: procent 0–150 krok 25, stary zapis true = 100, false = 0; mnożnik punktów 0 % ×1,25, 100 % ×1, 150 % ×0,9",
     pr(true) === 100 && pr(false) === 0 && pr(60) === 50 && pr(400) === 150 && pr(-5) === 0 &&
     mr(0) === 1.25 && mr(100) === 1 && mr(150) === .9 && mr(50) === 1.125 && mr(true) === 1);
  const nr = [{ m: 60, t: 0, d: 2 }, { m: 72, t: 2, d: 1 }];
  const r100 = F("dodajCzasNaRuch")(nr, .5), r50 = F("dodajCzasNaRuch")(nr, .5, { skala: .5 }), r0 = F("dodajCzasNaRuch")(nr, .5, { skala: 0 });
  ck("czas na ruch: skala 50 % daje połowę luki, 0 % żadnej (nuty bez t0/d0)",
     Math.abs((2 - r50[0].d) - (2 - r100[0].d) / 2) < 1e-9 && r0[0].d === 2 && r0[0].d0 == null, [r100[0].d, r50[0].d, r0[0].d]);
  const rm = F("rozliczNute")(0, 100, true, 1, false, 1.25), r1 = F("rozliczNute")(0, 100, true, 1, false);
  ck("czas na ruch: mnożnik ruchu mnoży punkty nuty i maksimum partii (procent bez zmian)",
     rm.punkty === Math.round(r1.punkty * 1.25) && F("maksimumPunktow")(nr, 1.25).razem > F("maksimumPunktow")(nr).razem, [rm.punkty, r1.punkty]);
  const k50 = F("konfiguracjaGry")({ tempo: 100, czasNaRuch: 50 }, { tempo: 100 }), k100 = F("konfiguracjaGry")({ tempo: 100, czasNaRuch: true }, { tempo: 100 });
  ck("tablica: czas na ruch 100 % ma stary podpis |r (stare wiersze w tej samej konkurencji), 50 % osobny |r50, 0 % bez",
     F("podpisKonfiguracji")(k100).endsWith("|r") && F("podpisKonfiguracji")(k50).endsWith("|r50") &&
     !F("podpisKonfiguracji")(F("konfiguracjaGry")({ tempo: 100, czasNaRuch: 0 }, { tempo: 100 })).includes("|r"),
     [F("podpisKonfiguracji")(k100), F("podpisKonfiguracji")(k50)]);
  // cel bota: nuta pod linią i następna
  const nb = [{ m: 60, t: 0, d: 1 }, { m: 67, t: 1, d: 1 }, { m: 62, t: 3, d: 1 }];
  const c1 = F("celBotaNaNutach")(nb, .5, .5, s => s), c2 = F("celBotaNaNutach")(nb, 2.5, .5, s => s);
  ck("cel bota: pod linią nuta i następna (legato = następna zaraz po końcu), w pauzie najbliższa",
     c1.idx === 0 && c1.nastepny === 67 && Math.abs(c1.nastepnyZa - c1.doKonca) < 1e-9 && c2.idx === null && c2.polton === 62 &&
     Math.abs(c2.nastepnyZa - .25) < 1e-9, JSON.stringify([c1, c2]));
  // tablica wyników
  const kl = F("kluczUtworu");
  const mid = r => ({ zrodlo: "midi", id: "midi-x", plik: "Moja_Piosenka (2).mid", tytul: "Moja Piosenka", rozmiar: r });
  ck("tablica: bez skrótu (stary klucz) = nazwa pliku (bez .mid i dopisku „ (2)”) + rozmiar; inny rozmiar = inna tablica; wbudowana po id",
     kl(mid(1234)) === "midi:moja piosenka:1234" && kl(mid(1235)) !== kl(mid(1234)) &&
     kl({ zrodlo: "midi", plik: "moja piosenka.MID", rozmiar: 1234 }) === kl(mid(1234)) && kl({ zrodlo: "wbudowana", id: "oda" }) === "wbud:oda",
     kl(mid(1234)));
  const sha = F("sha256Hex");
  ck("SHA-256: wektory FIPS 180-4 (pusty, „abc”, 56 bajtów) i 1000 losowych bajtów jak node:crypto",
     sha(new Uint8Array(0)) === "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" &&
     sha(new TextEncoder().encode("abc")) === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad" &&
     sha(new TextEncoder().encode("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")) === "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1" &&
     (b => sha(new Uint8Array(b)) === crypto.createHash("sha256").update(b).digest("hex"))(crypto.randomBytes(1000)));
  const H1 = "a".repeat(64), H2 = "b".repeat(64);
  const zHash = (plik, hash, r) => ({ zrodlo: "midi", plik, tytul: plik, rozmiar: r || 1234, hash });
  ck("tablica: plik ze skrótem = klucz midi:sha256:<skrót>, ten sam pod każdą nazwą i rozmiarem; inny skrót = inna tablica; zły skrót = stary klucz",
     kl(zHash("a.mid", H1)) === "midi:sha256:" + H1 && kl(zHash("zupelnie inna (3).mid", H1, 99)) === kl(zHash("a.mid", H1)) &&
     kl(zHash("a.mid", H2)) !== kl(zHash("a.mid", H1)) && kl(zHash("Moja_Piosenka (2).mid", "xyz")) === "midi:moja piosenka:1234",
     kl(zHash("a.mid", H1)));
  const wTab = (id, kiedy) => ({ id, kto: "A", punkty: 100, precyzja: 50, partia: "M", konfId: "k1", kiedy, zrodlo: "mysz" });
  const ut = new Map([["midi:moja piosenka:1234", { klucz: "midi:moja piosenka:1234", tytul: "Moja Piosenka", plik: "Moja_Piosenka (2).mid", rozmiar: 1234, wpisy: [wTab("s1", 1), wTab("s2", 2)] }],
    ["midi:sha256:" + H1, { klucz: "midi:sha256:" + H1, tytul: "Moja Piosenka", hash: H1, wpisy: [wTab("s2", 2), wTab("n1", 3)] }]]);
  const pMig = { zrodlo: "midi", plik: "Moja_Piosenka (2).mid", tytul: "Moja Piosenka", rozmiar: 1234, hash: H1 };
  const st = F("przeniesStaryKlucz")(ut, pMig), po = ut.get("midi:sha256:" + H1);
  ck("tablica: wiersze spod „nazwa + rozmiar” przechodzą pod skrót (scalone po id, bez dubli), stary klucz znika, drugi raz nic",
     st === "midi:moja piosenka:1234" && !ut.has(st) && po.wpisy.map(x => x.id).join() === "s1,s2,n1" && po.hash === H1 &&
     po.klucz === "midi:sha256:" + H1 && F("przeniesStaryKlucz")(ut, pMig) === null &&
     F("przeniesStaryKlucz")(ut, { zrodlo: "wbudowana", id: "oda" }) === null && F("przeniesStaryKlucz")(ut, null) === null,
     JSON.stringify([st, po && po.wpisy.map(x => x.id)]));
  const tw = F("toryWGrze"), sam = n => Array.from({ length: n }, (_, i) => ({ gracze: [i] }));
  const u5 = { tempo: 100, tory: "osobno" }, k5 = F("konfiguracjaGry")(Object.assign({}, u5, { tory: tw(u5, [{ gracze: [0, 1] }, { gracze: [2, 3] }, { gracze: [4] }]) }), { tempo: 100 });
  ck("tablica: „osobno” tylko gdy każdy tor miał jednego gracza; 5 graczy przy „osobno” (wspólne tory, premia chóru) = konkurencja chóru, bez |o",
     tw(u5, sam(4)) === "osobno" && tw(u5, [{ gracze: [0, 1] }, { gracze: [2] }]) === "chor" && tw({ tory: "chor" }, sam(2)) === "chor" &&
     !F("podpisKonfiguracji")(k5).includes("|o"), F("podpisKonfiguracji")(k5));
  const konf = F("konfiguracjaGry")({ tempo: 80, spiewaSama: true, przyciaganie: false, zakres: 40 },
    { tempo: 100, fragment: { caly: false, od: 3, do: 6, powtorz: 2 } });
  ck("tablica: konfiguracja (tempo, tryb, pomoc, zakres, fragment) ma podpis i opis dla ludzi",
     F("podpisKonfiguracji")(konf) === "t80|l|b|z40|f3-6x2" && konf.bpm === 80 &&
     F("opisKonfiguracji")(konf) === "tempo 80% · żaba śpiewa sama · bez przyciągania · takty 3–6 ×2", F("opisKonfiguracji")(konf));
  const konfO = F("konfiguracjaGry")({ tempo: 100, spiewaSama: false, przyciaganie: true, zakres: 40, tory: "osobno" }, { tempo: 90, fragment: { caly: true } });
  ck("tablica: „każdy na swoim torze” (bez premii chóru) to osobna konfiguracja; stare wiersze bez pola = wspólny tor",
     F("podpisKonfiguracji")(konfO) === "t100|p|m|z40|o" && F("opisKonfiguracji")(konfO).endsWith("każdy na swoim torze") &&
     F("podpisKonfiguracji")(Object.assign({}, konfO, { osobno: false })) === "t100|p|m|z40", F("podpisKonfiguracji")(konfO));
  const w = (id, kto, punkty, precyzja, partia, konfId, kiedy, zrodlo) => ({ id, kto, punkty, precyzja, celnosc: precyzja, partia, konfId, kiedy, zrodlo: zrodlo || "mysz" });
  const wpisy = [w("1", "A", 500, 90, "M", "k1", 1), w("2", "B", 700, 70, "M", "k1", 2), w("3", "C", 900, 99, "M", "k2", 3),
    w("4", "Bot", 800, 95, "M", "k1", 4, "bot"), w("5", "D", 300, 60, "Bas", "k1", 5)];
  ck("tablica: miejsce liczy się wśród ludzi tej samej partii i konfiguracji, osobno w punktach i precyzji (bot nie zajmuje miejsca)",
     F("miejsceWpisu")(wpisy, wpisy[0], "punkty") === 2 && F("miejsceWpisu")(wpisy, wpisy[0], "precyzja") === 1 &&
     F("miejsceWpisu")(wpisy, wpisy[2], "punkty") === 1);
  ck("tablica: rekord solisty = najlepszy WCZEŚNIEJSZY wynik ludzi w tej partii i konfiguracji (bez botów)",
     F("rekordZTablicy")(wpisy, "M", "k1", 10).id === "2" && F("rekordZTablicy")(wpisy, "M", "k1", 2) .id === "1" &&
     F("rekordZTablicy")(wpisy, "M", "k1", 1) === null);
  ck("tablica: filtr po partii, poziomie i konfiguracji; wiersze botów nigdy (10-18: tablica = wyniki ludzi)",
     F("filtrujWpisy")(wpisy, { partia: "M", konf: "k1" }).map(x => x.id).join() === "1,2" &&
     F("filtrujWpisy")(wpisy, {}).length === 4 && F("topWpisy")(wpisy, 9).every(x => x.zrodlo !== "bot"));
  ck("tablica: suma zapisów z przeglądarki i folderu po id, bez dubli, po czasie",
     F("scalWpisy")([wpisy[1], wpisy[0]], [wpisy[0], wpisy[2]]).map(x => x.id).join() === "1,2,3");
  const duzo = Array.from({ length: 30 }, (_, i) => w("x" + i, "K", i === 3 ? 9999 : 100 + i, i === 5 ? 100 : 50, "M", "k1", i));
  const zost = F("przytnijWpisy")(duzo, 8, 2).map(x => x.id);
  ck("tablica: przycięcie zostawia najlepszych (punkty i precyzja) i najnowsze, najstarsze przeciętne odchodzą",
     zost.length === 8 && zost.includes("x3") && zost.includes("x5") && zost.includes("x29") && !zost.includes("x0"), zost.join());
  const wpis = F("wpisTablicy")({ punkty: 1234.4, precyzja: 87.66, celnosc: 80, trafione: 34, nut: 39, maxKombo: 12, gwiazdki: 4, partia: 1 },
    { id: "bot-2", nazwa: "Kumak", zrodlo: "bot", poziom: "trudny", kolor: "#294aa8", obrazekKapsla: "x.png" }, "Basy",
    { ocena: 4.2, poziom: "srednia" }, konf, 1700000000000);
  ck("tablica: wiersz pamięta gracza, poziom bota, partię z trudnością i konfigurację",
     wpis.kto === "Kumak" && wpis.poziomBota === "trudny" && wpis.partia === "Basy" && wpis.trudnosc === 4.2 && wpis.punkty === 1234 &&
     wpis.precyzja === 87.7 && wpis.konfId === "t80|l|b|z40|f3-6x2" && /^[0-9a-z]+-bot-2$/.test(wpis.id), JSON.stringify(wpis));

  // wejście: poziomy botów i pad (atrapa Gamepad API)
  const pady = [], zdarzenia = [];
  const okno = {
    console, Math, Number, JSON, Array, Object, Map, Set, String, Error, performance: { now: () => 1000 },
    innerHeight: 800, addEventListener() {}, document: { activeElement: null },
    localStorage: { getItem: () => null, setItem() {} }, EventSource: function () {}, navigator: { getGamepads: () => pady },
  };
  okno.window = okno; vm.createContext(okno);
  vm.runInContext(czytaj("wejscie.js") + ";this.Wejscie=Wejscie;", okno);
  const We = okno.Wejscie;
  We.init({ zakres: 40, ziarno: 3, nazwy: { boty: ["Kumak"], pad: "Pad" } });
  We.naZdarzenie(z => zdarzenia.push(z.typ + ":" + z.gracz.id));
  const PB = We.POZIOMY_BOTOW, kol = ["latwy", "sredni", "trudny", "mistrz"];
  ck("boty: cztery poziomy, każdy kolejny szybszy, celniejszy, mniej drży i lepiej czyta nuty z wyprzedzeniem",
     Object.keys(PB).join() === kol.join() && kol.every((k, i) => !i || (PB[k].tau < PB[kol[i - 1]].tau && PB[k].stroj < PB[kol[i - 1]].stroj &&
       PB[k].drzenie < PB[kol[i - 1]].drzenie && PB[k].reakcja[1] < PB[kol[i - 1]].reakcja[1] && PB[k].przod > PB[kol[i - 1]].przod)));
  // 10-20: zatrzask (jak celnie żaba siada na nucie) i górna prędkość ręki też idą z poziomem — to po nich
  // widać na torze, który bot jest który, a bez drabiny ślad przestałby zgadzać się z wynikiem
  ck("boty: każdy kolejny poziom siada na nucie celniej (zatrzask) i ma szybszą rękę (predkosc)",
     kol.every((k, i) => !i || (PB[k].zatrzask[0] > PB[kol[i - 1]].zatrzask[0] && PB[k].zatrzask[1] > PB[kol[i - 1]].zatrzask[1] &&
       PB[k].zatrzask[2] > PB[kol[i - 1]].zatrzask[2] && PB[k].predkosc > PB[kol[i - 1]].predkosc)),
     kol.map(k => k + " " + PB[k].zatrzask.join("/") + " " + PB[k].predkosc).join(", "));
  const bm = We.dodajBota("mistrz"), bl = We.dodajBota(.3);
  ck("boty: poziom z napisu niesie cechy poziomu, liczba to dawny luz (bez drżenia i bez czytania z wyprzedzeniem)",
     bm.poziom === "mistrz" && bm._bot.tau === PB.mistrz.tau && bm._bot.legato === true && bl.poziom === null &&
     bl._bot.drzenie === 0 && bl._bot.przod === 0 && bl._bot.legato === false && Math.abs(bl._bot.tau - (.05 + .3 * .12)) < 1e-9);
  zdarzenia.length = 0;
  We.ustawPoziomBota(bm.id, "latwy");
  ck("boty: zmiana poziomu podmienia cechy i zgłasza „zmiana”", bm.poziom === "latwy" && bm._bot.tau === PB.latwy.tau &&
     zdarzenia.join() === "zmiana:" + bm.id && We.ustawPoziomBota(bm.id, "nie-ma") === null, zdarzenia.join());
  // legato: bot z poziomem przejeżdża krótką nutę z trzymanym przyciskiem, dłuższą artykułuje (oddech = klik w rytm),
  // przed pauzą zawsze bierze oddech
  const cel = (idx, dlugoscSek, nastepnyZa, doKonca) => g => ({ idx, polton: 64, doKonca, dlugosc: 1, dlugoscSek, postep: .98, nastepny: 65,
    nastepnyZa, naStopnie: s => (66 - s) * 5 });
  We.ustawPoziomBota(bm.id, "trudny");
  We.ustawCelBotow(cel(5, .2, .02, .02)); We.krok(1 / 60, 3000);
  const legatoTrzyma = bm.przycisk;
  // ta sama nuta (bez nowego losowania „zapomni nutę”): 40 ms przed końcem jeszcze śpiewa, 20 ms przed końcem już nie
  We.ustawCelBotow(cel(6, .6, .02, .04)); We.krok(1 / 60, 3020);
  const przedOddechem = bm.przycisk;
  We.ustawCelBotow(cel(6, .6, .02, .02)); We.krok(1 / 60, 3040);
  const dlugaPuszcza = bm.przycisk;
  We.ustawCelBotow(cel(8, .2, .5, .02)); We.krok(1 / 60, 3060);
  ck("boty: krótką nutę w legato trzymają, dłuższą artykułują oddechem poziomu (Trudny 30 ms), przed pauzą puszczają",
     legatoTrzyma === true && dlugaPuszcza === false && przedOddechem === true && bm.przycisk === false,
     [legatoTrzyma, dlugaPuszcza, przedOddechem, bm.przycisk]);
  We.usun(bm.id); We.usun(bl.id);
  // pad: pojawia się dopiero po naciśnięciu, gałka = przechył, A = śpiew, Start = pauza, odłączenie = znika
  const przyciski = n => Array.from({ length: 17 }, (_, i) => ({ pressed: n.includes(i), value: n.includes(i) ? 1 : 0 }));
  const pad = { index: 0, id: "Xbox Controller (STANDARD GAMEPAD)", connected: true, axes: [0, 0, 0, 0], buttons: przyciski([]) };
  pady.push(pad); zdarzenia.length = 0;
  We.krok(1 / 60, 4000);
  ck("pad: podłączony, ale bez naciśnięcia nie jest graczem", !We.gracz("pad-0") && !zdarzenia.length);
  pad.buttons = przyciski([0]); We.krok(1 / 60, 4016);
  const gp = We.gracz("pad-0");
  ck("pad: pierwsze naciśnięcie tworzy gracza („nowe”), samo nie jest „wcisnieciem”",
     gp && gp.zrodlo === "pad" && gp.nazwa === "Pad 1" && zdarzenia.join() === "nowe:pad-0" && gp.przycisk === true, zdarzenia.join());
  pad.buttons = przyciski([]); pad.axes = [.9, -1, .8, 0]; zdarzenia.length = 0; We.krok(1 / 60, 4032);
  ck("pad: lewa gałka do oporu w przód = −zakres (wysoko), w bok = przechył, prawa gałka = obrót (wibrato)",
     gp.pitch === -40 && gp.roll > 35 && gp.twist >= 150 && gp.przycisk === false && zdarzenia.join() === "puszczenie:pad-0",
     [gp.pitch, gp.roll, gp.twist, zdarzenia.join()]);
  pad.axes = [.05, .08, 0, 0]; We.krok(1 / 60, 4048);
  ck("pad: martwa strefa gałki (12%): drobne wychylenie to środek", gp.pitch === 0 && gp.roll === 0 && gp.twist === 0);
  zdarzenia.length = 0; pad.buttons = przyciski([7]); We.krok(1 / 60, 4064);
  pad.buttons = przyciski([9]); We.krok(1 / 60, 4080);
  ck("pad: spust śpiewa („wcisniecie”, potem „klawisz” jak klawiatura), Start zgłasza „start” (pauza)",
     zdarzenia.join() === "wcisniecie:pad-0,klawisz:pad-0,puszczenie:pad-0,start:pad-0", zdarzenia.join());
  pady.length = 0; zdarzenia.length = 0; We.krok(1 / 60, 4096);
  ck("pad: odłączony znika z gry („znika”)", !We.gracz("pad-0") && zdarzenia.join() === "znika:pad-0", zdarzenia.join());
}

// ---- podział ekranu i instrument gracza (2026-10-03) -------------------------------------------
{
  const us = F("ukladSiatki"), ob = { x: 20, y: 60, w: 1880, h: 900 }, odst = 12;
  const pole = r => r.reduce((s, p) => s + p.w * p.h, 0);
  const rozlaczne = r => r.every((a, i) => r.every((b, j) => i >= j ||
    a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y));
  const wObszarze = r => r.every(p => p.x >= ob.x && p.y >= ob.y && p.x + p.w <= ob.x + ob.w + 1 && p.y + p.h <= ob.y + ob.h + 1);
  const a1 = us(1, "siatka", ob, odst);
  ck("ukladSiatki: 1 tor zawsze cały obszar", a1.length === 1 && a1[0].w === 1880 && a1[0].h === 900, JSON.stringify(a1));
  const a2 = us(2, "auto", ob, odst);
  ck("ukladSiatki: auto przy 2 torach = pasy (jeden nad drugim, pełna szerokość)",
     a2.every(p => p.w === 1880) && a2[1].y > a2[0].y, JSON.stringify(a2));
  const a3 = us(3, "auto", ob, odst);
  ck("ukladSiatki: auto przy 3 torach = 3 wysokie kolumny",
     a3.every(p => p.h === 900) && a3[0].x < a3[1].x && a3[1].x < a3[2].x && rozlaczne(a3) && wObszarze(a3), JSON.stringify(a3));
  const a4 = us(4, "auto", ob, odst);
  ck("ukladSiatki: auto przy 4 torach = siatka 2×2 (lewy górny, prawy górny, lewy dolny, prawy dolny)",
     a4[0].y === a4[1].y && a4[2].y === a4[3].y && a4[0].x === a4[2].x && a4[1].x === a4[3].x && a4[2].y > a4[0].y &&
     a4[1].x > a4[0].x && rozlaczne(a4) && wObszarze(a4), JSON.stringify(a4));
  const s3 = us(3, "siatka", ob, odst);
  ck("ukladSiatki: siatka przy 3 torach = dwa u góry, jeden szeroki na dole",
     s3[0].y === s3[1].y && s3[2].w === 1880 && s3[2].y > s3[0].y && rozlaczne(s3) && wObszarze(s3), JSON.stringify(s3));
  const p4 = us(4, "pasy", ob, odst), k4 = us(4, "kolumny", ob, odst);
  ck("ukladSiatki: wymuszone pasy i kolumny przy 4 torach",
     p4.every(p => p.w === 1880) && k4.every(p => p.h === 900) && rozlaczne(p4) && rozlaczne(k4), JSON.stringify([p4, k4]));
  ck("ukladSiatki: każdy układ zajmuje obszar bez dziur poza odstępami (odstępy najwyżej 6% pola)",
     [a2, a3, a4, s3, p4, k4].every(r => pole(r) > ob.w * ob.h * .94 && pole(r) <= ob.w * ob.h));

  const po = F("podzialNaToryOsobno"), pt = F("podzialNaTory");
  const partie = [{ srednia: 70 }, { srednia: 60 }, { srednia: 50 }];
  const r1 = po([{ id: "a", partia: 0 }, { id: "b", partia: 0 }, { id: "c", partia: 2 }, { id: "d", partia: 0 }], partie, 4);
  ck("podzialNaToryOsobno: 4 graczy, w tym 3 na melodii = 4 osobne tory, melodia u góry w kolejności dołączenia",
     r1.tory.length === 4 && r1.tory.map(t => t.gracze[0]).join() === "a,b,d,c" && r1.tory.every(t => t.gracze.length === 1),
     JSON.stringify(r1));
  ck("podzialNaToryOsobno: partia bez śpiewaka idzie do podkładu", r1.bezSpiewu.join() === "1", JSON.stringify(r1.bezSpiewu));
  const wiele = Array.from({ length: 6 }, (_, i) => ({ id: "g" + i, partia: i % 2 }));
  ck("podzialNaToryOsobno: więcej graczy niż torów = podział chórem jak dotąd",
     JSON.stringify(po(wiele, partie, 4)) === JSON.stringify(pt(wiele, partie, 4)));

  const ip = F("instrumentPodkladu");
  ck("instrumentPodkladu: bez kolizji zostaje wybrany", ip("piano", ["trabka", "guitar"]) === "piano");
  ck("instrumentPodkladu: gracz na pianinie = podkład na pianinie elektrycznym", ip("piano", ["piano"]) === "epiano");
  ck("instrumentPodkladu: organy gracza zajmują organ podkładu", ip("organ", ["organy"]) === "piano");
}

// ---- 10. tryb nut (10-03): klasyczny / płynny, zjazdy między nutami ----------------------------------------------
{
  const cel = F("celNuty"), dp = F("dodajPrzejscia"), prz = F("przygotujPartie"), kl = F("klatkaNaNutach");
  const bota = F("celBotaNaNutach"), zak = F("zakresNut");
  const n = { m: 60, t: 0, d: 2, p: { od: .5, do: 64 } };
  ck("celNuty: przed rampą m, w połowie rampy w pół drogi, na końcu nuta docelowa, bez `p` zawsze m",
     cel(n, .9) === 60 && cel(n, 1.5) === 62 && cel(n, 2) === 64 && cel({ m: 60, t: 0, d: 2 }, 1.5) === 60, [cel(n, 1.5), cel(n, 2)]);
  ck("celNuty: rampa to krzywa S (łagodny start i dojazd): w ćwierci rampy mniej niż po prostej, w trzech czwartych więcej",
     cel(n, 1.25) < 61 && cel(n, 1.25) > 60 && cel(n, 1.75) > 63 && cel(n, 1.75) < 64, [cel(n, 1.25), cel(n, 1.75)]);
  const A = [{ m: 60, t: 0, d: 2 }, { m: 67, t: 2, d: 1 }, { m: 67, t: 3, d: 1 }, { m: 60, t: 4.5, d: 2 }, { m: 80, t: 6.5, d: 2 }, { m: 62, t: 8.5, d: .5 }, { m: 65, t: 9, d: 1 }];
  const zA = dp(A);
  ck("dodajPrzejscia (10-17): zjazd przy każdej nucie, po której następna jest od razu na innej wysokości (też skok 20/18 i krótka nuta); powtórka i przerwa bez zjazdu; rampa 35 % nuty",
     zA[0].p && zA[0].p.do === 67 && Math.abs(zA[0].p.od - .65) < 1e-9 && !zA[1].p && !zA[2].p && zA[3].p && zA[4].p && zA[5].p && Math.abs(zA[5].p.od - .65) < 1e-9 && !zA[6].p, JSON.stringify(zA.map(x => x.p || 0)));
  ck("dodajPrzejscia: nie zmienia długości ani startu nut, oryginał nietknięty", zA.every((x, i) => x.t === A[i].t && x.d === A[i].d) && !A[0].p);
  const B = dp([{ m: 60, t: 0, d: 2 }, { m: 70, t: 2, d: 2 }, { m: 60, t: 4, d: 1 }, { m: 70, t: 5, d: 1 }]);
  ck("dodajPrzejscia (10-17): skok 8–12 półtonów też zjeżdża, także z krótszej nuty",
     B[0].p && B[1].p && B[2].p && !B[3].p, JSON.stringify(B.map(x => x.p || 0)));
  const C = dp([{ m: 60, t: 0, d: 1 }, { m: 62, t: 1, d: 1 }, { m: 64, t: 2, d: 1 }, { m: 65, t: 3, d: 1 }, { m: 67, t: 4, d: 1 }]);
  ck("dodajPrzejscia (10-17): w gamie równych ćwierćnut zjeżdża każda (zbite nuty bez przemieszanych schodków), rampa 35 % nuty",
     C.slice(0, 4).every(x => x.p && Math.abs(x.p.od - .65) < 1e-9) && !C[4].p, JSON.stringify(C.map(x => x.p ? x.p.od : 0)));
  const D = dp([{ m: 60, t: 0, d: 2 }, { m: 62, t: 2, d: .25 }, { m: 64, t: 2.25, d: 2 }]);
  ck("dodajPrzejscia (10-17): ozdobnik też zjeżdża; zjazd najwyżej pół nuty (krótka nuta: pierwsza połowa płaska)",
     D[0].p && D[1].p && Math.abs(D[1].p.od - .5) < 1e-9 && !D[2].p, JSON.stringify(D.map(x => x.p || 0)));
  // klatka: śpiew po rampie daje 100, śpiew płasko na m traci na końcu rampy
  const ak1 = { sumaAcc: 0, spiewal: false, wib: 0 }, ak2 = { sumaAcc: 0, spiewal: false, wib: 0 };
  let w1 = null, w2 = null;
  for (let k = 0; k <= 40; k++) {   // 41 klatek po 0,05 ćwierćnuty; nuta zamyka się w klatce, która przekracza 2
    const b = k * .05, r1 = kl([n], 0, ak1, b, b + .05, true, cel(n, b + .025), false), r2 = kl([n], 0, ak2, b, b + .05, true, 60, false);
    w1 = w1 || r1.zamkniete[0]; w2 = w2 || r2.zamkniete[0];
  }
  ck("klatkaNaNutach z rampą: śpiew po rampie = 100, śpiew płasko na starcie traci (koniec rampy 4 półtony dalej)",
     w1 && w1.wynik >= 99 && w2 && w2.wynik < 80 && w2.wynik > 40, [w1 && w1.wynik, w2 && w2.wynik]);
  const cb = bota([n], 1.5, .5, x => x);
  ck("celBotaNaNutach: bot celuje w wysokość rampy", cb.polton === 62, cb.polton);
  const partia = { rola: "glos", nuty: A, lo: 60, hi: 80, srednia: 66 };
  const q = prz(partia, { tryb: "plynny" });
  ck("przygotujPartie: tryb klasyczny = ten sam obiekt; płynny = kopia z nutami ze zjazdami, zakresem i `oryginal`, a bez kandydatów też ten sam obiekt",
     prz(partia, { tryb: "klasyczny" }) === partia && prz(partia, {}) === partia && q !== partia && q.oryginal === partia && q.nuty[0].p && partia.nuty === A &&
     prz({ rola: "glos", nuty: [{ m: 60, t: 0, d: 1 }, { m: 60, t: 1, d: 1 }] }, { tryb: "plynny" }).oryginal === undefined);
  const z = zak([{ m: 60, t: 0, d: 1, p: { od: .5, do: 72 } }]);
  ck("zakresNut: rampa liczy się do zakresu (hi = cel zjazdu)", z.lo === 60 && z.hi === 72, JSON.stringify(z));
  const kg = F("konfiguracjaGry"), pk = F("podpisKonfiguracji"), ok = F("opisKonfiguracji");
  const k1 = kg({ tempo: 100, zakres: 40 }, null), k2 = kg({ tempo: 100, zakres: 40, tryb: "plynny" }, null);
  ck("tablica: tryb płynny to inna konkurencja (podpis `|g`, opis „tryb płynny”), klasyczny ma podpis jak dotąd",
     pk(k1) !== pk(k2) && pk(k1) === "t100|p|b|z40" && /\|g$/.test(pk(k2)) && ok(k2).endsWith("tryb płynny") && !k1.plynny, [pk(k1), pk(k2), ok(k2)]);
}

// ---- rozbicie wyniku na ekranie wyników (10-03): pięć ocen zawsze, dodatki tylko gdy były, części sumują się do punktów ----
{
  const rw = F("rozbicieWyniku");
  const r = rw({ punkty: 1234, premia: 100, premiaChoru: 50, premiaKlik: 34, wibrata: 2, kliki: { idealnie: 3, dobrze: 4 },
    oceny: { czysto: 10, dobrze: 5, prawie: 1, falsz: 2, pudlo: 0 } });
  ck("rozbicieWyniku: pięć ocen w stałej kolejności, także z zerem (0 pudło to też informacja)",
     r.nuty.map(x => x.k + ":" + x.n).join(",") === "czysto:10,dobrze:5,prawie:1,falsz:2,pudlo:0", JSON.stringify(r.nuty));
  ck("rozbicieWyniku: wibrato i „w rytm” (idealnie + dobrze, bez „obok”) tylko gdy były",
     r.dodatki.map(x => x.k + ":" + x.n).join(",") === "wibrato:2,klik:7" && rw({ punkty: 0, oceny: {} }).dodatki.length === 0, JSON.stringify(r.dodatki));
  ck("rozbicieWyniku: za nuty + premia + chór + w rytm = punkty gracza (1050 + 100 + 50 + 34 = 1234)",
     r.punkty.nuty === 1050 && r.punkty.premia === 100 && r.punkty.chor === 50 && r.punkty.klik === 34 && r.punkty.razem === 1234, JSON.stringify(r.punkty));
  const ps = F("procentSpiewu");
  ck("procentSpiewu: premia chóru i klik w rytm nie podnoszą procentu (1234 − 50 − 34 = 1150 z 2300 = 50 %), wibrato w nucie tak, sufit 100, brak maksimum = 0",
     blisko(ps(1234, 50, 34, 2300), 50) && ps(2600, 0, 0, 2300) === 100 && ps(100, 0, 0, 0) === 0 && blisko(ps(1234, 0, 0, 2300), 1234 / 23),
     [ps(1234, 50, 34, 2300), ps(2600, 0, 0, 2300), ps(100, 0, 0, 0)]);
  const pusty = rw({});
  ck("rozbicieWyniku: wiersz bez pól (stary zapis) daje same zera, nic nie pada",
     pusty.nuty.every(x => x.n === 0) && pusty.punkty.razem === 0 && pusty.punkty.nuty === 0, JSON.stringify(pusty));
}

// ---- ulubione w bibliotece (10-03, „UI jak w grze”): przełącznik, ulubione na górze, odczyt zapisu ----
{
  const pu = F("przelaczUlubione"), su = F("sortujZUlubionymi"), ou = F("odczytajUlubione");
  const l0 = ["oda"], l1 = pu(l0, "mary"), l2 = pu(l1, "oda");
  ck("przelaczUlubione: dopisuje na koniec, drugi raz usuwa, wejście bez zmian (nowa tablica)",
     l1.join(",") === "oda,mary" && l2.join(",") === "mary" && l0.join(",") === "oda" && l1 !== l0, [l1, l2, l0]);
  ck("przelaczUlubione: śmieci w zapisie (powtórki, nie-napisy, puste) znikają, id null/puste tylko czyści listę",
     pu(["a", "a", 7, "", null, "b"], null).join(",") === "a,b" && pu("zle", "x").join(",") === "x" && pu(["a"], "").join(",") === "a",
     [pu(["a", "a", 7, "", null, "b"], null), pu("zle", "x")]);
  const wpisy = [{ id: "s" }, { id: "o" }, { id: "p" }, { id: "k" }, { id: "m" }];
  ck("sortujZUlubionymi: ulubione na górze, a w obu grupach dotychczasowa kolejność (sortowanie stabilne)",
     su(wpisy, ["m", "o"]).map(w => w.id).join("") === "omspk" && wpisy.map(w => w.id).join("") === "sopkm",
     su(wpisy, ["m", "o"]).map(w => w.id));
  ck("sortujZUlubionymi: napisy jako id, własny klucz, brak ulubionych i złe wejście",
     su(["a", "b", "c"], ["c"]).join("") === "cab" && su([{ x: "a" }, { x: "b" }], ["b"], w => w.x)[0].x === "b" &&
     su(["a", "b"], null).join("") === "ab" && su(null, ["a"]).length === 0 && su([null, "a"], ["a"])[0] === "a",
     su(["a", "b", "c"], ["c"]));
  ck("odczytajUlubione: {wersja:1, ids} → lista bez powtórek; inna wersja, zepsuty JSON i brak zapisu = pusta lista",
     ou('{"wersja":1,"ids":["oda","oda","mary",3]}').join(",") === "oda,mary" && ou('{"wersja":2,"ids":["a"]}').length === 0 &&
     ou("{zepsute").length === 0 && ou(null).length === 0 && ou('["oda"]').length === 0, ou('{"wersja":1,"ids":["oda","oda","mary",3]}'));
  const sas = F("sasiedniUtwor");
  ck("sasiedniUtwor (D-11): po usunięciu wybór idzie na następny, za ostatnim na poprzedni; jedyny, nieznany i złe wejście = null",
     sas(["a", "b", "c"], "b") === "c" && sas(["a", "b", "c"], "c") === "b" && sas(["a"], "a") === null && sas(["a", "b"], "x") === null &&
     sas(null, "a") === null, [sas(["a", "b", "c"], "b"), sas(["a", "b", "c"], "c"), sas(["a"], "a")]);
}

// ---- runda 1 (10-03): feedback przy nucie: klasa klatki do wypełnienia taśmy, lot punktów ----
{
  const kk = F("klasaKlatki"), lp = F("lotPunktow");
  ck("klasaKlatki: |Δ| ≤ 0,5 = na nucie (0), do progu „Prawie” bursztyn (1), dalej róż (2), znak bez znaczenia",
     kk(0) === 0 && kk(.5) === 0 && kk(-.5) === 0 && kk(.6) === 1 && kk(-1.8) === 1 && kk(1.9) === 1 && kk(1.95) === 2 && kk(3) === 2,
     [kk(.5), kk(.6), kk(1.9), kk(1.95)]);
  const a0 = lp(0), a5 = lp(.5), a1 = lp(1);
  ck("lotPunktow: start przy głowie (dy 0, pełna alfa, wskoczenie od 0,85), koniec 40 px wyżej i zgaszony",
     a0.dy === 0 && a0.alfa === 1 && blisko(a0.skala, .85) && blisko(a1.dy, -40) && a1.alfa === 0 && a1.skala === 1, JSON.stringify([a0, a1]));
  ck("lotPunktow: ruch tylko w górę i wyhamowuje (bez odbicia), alfa gaśnie dopiero w drugiej połowie, własna wysokość",
     a5.dy < 0 && a5.dy < -20 && a5.alfa === 1 && lp(.75).alfa < 1 && [.1, .2, .4, .6, .8, 1].every((f, k, t) => k === 0 || lp(f).dy <= lp(t[k - 1]).dy) &&
     blisko(lp(1, 60).dy, -60) && lp(-1).dy === 0 && lp(2).alfa === 0, JSON.stringify(a5));
}

// ---- 10-20: ślad i wypełnienie taśmy w CZASIE GRACZA (b1), tym samym, w którym liczy się ocena ----
// Dotąd szły po zegarze gry, a u gracza z kapslem „Opóźnienie kapsli” (domyślnie 150 ms) jest prawdziwe, więc
// wszystko, co widać, stało o jedną trzecią ćwierćnuty obok ocenianych nut. Pomiar w grze (bot Mistrz jako model
// dobrego gracza, Korobeiniki melodia, 132 BPM, cała piosenka, offMs 150): ślad leżał na nucie przez 54 % czasu
// zamiast 95,5 %, a taśma dawała się pomalować tylko w 64,5 % (reszta farby wypadała za koniec nuty). Po zmianie
// 95,5 % i 96,2 %, punkty i oceny nut co do jednego takie same; u myszy (offMs 0) nic się nie zmieniło.
{
  const ds = F("dopiszSlad"), dw = F("dopiszWypelnienie");
  const sl = [];
  ds(sl, 10, 60, true, 2);
  ds(sl, 10.01, 61, true, 2);      // bliżej niż 1/40 ćwierćnuty: ta sama klatka śladu
  ds(sl, 10.03, 62, false, 2);
  ck("dopiszSlad: punkt niesie czas podany przez wołającego (czas gracza), nowy co najmniej 1/40 ćwierćnuty dalej",
     sl.length === 2 && sl[0].b === 10 && sl[0].s === 60 && sl[0].sp === true && sl[1].b === 10.03 && sl[1].s === 62 && sl[1].sp === false,
     JSON.stringify(sl));
  ds(sl, 12.5, 63, true, 2);
  ck("dopiszSlad: ślad trzyma ostatnie `dlugosc` ćwierćnut liczone od czasu gracza, starsze punkty odpadają",
     sl.length === 1 && sl[0].b === 12.5, JSON.stringify(sl));
  const sg = [];
  dw(sg, 1, .25, 0); dw(sg, 1.25, .25, 0); dw(sg, 1.5, .25, 1); dw(sg, 3, .25, 1);
  ck("dopiszWypelnienie: ciągły odcinek tej samej klasy się wydłuża, zmiana klasy i przerwa zaczynają nowy",
     sg.length === 3 && sg[0].k === 0 && sg[0].od === .75 && sg[0].do === 1.25 && sg[1].k === 1 && sg[1].od === 1.25 && sg[1].do === 1.5 &&
     sg[2].k === 1 && sg[2].od === 2.75, JSON.stringify(sg));
  // nuta [4, 5) i gracz z kapslem: odcinki w czasie gracza leżą w oknie SWOJEJ nuty, więc malują ją od początku
  // (zegar gry dałby [4,15; 5,15), czyli pierwsze 150 ms bez farby, a ostatnie 150 ms za nutą, do obcięcia)
  const n = { m: 60, t: 4, d: 1 }, sg2 = [];
  for (let b = 4; b < 5; b += .05) dw(sg2, +b.toFixed(2), .05, 0);
  const wNucie = sg2.reduce((s, o) => s + Math.max(0, Math.min(o.do, n.t + n.d) - Math.max(o.od, n.t)), 0);
  const przed = Math.max(0, n.t - sg2[0].od), za = Math.max(0, sg2[sg2.length - 1].do - (n.t + n.d));
  ck("wypełnienie taśmy: odcinki z czasu gracza malują nutę od początku — przed nutą najwyżej jedna klatka, za nutą nic",
     przed <= .05 + 1e-9 && za <= 1e-9 && wNucie > .9, [+przed.toFixed(3), +za.toFixed(3), +wNucie.toFixed(3)]);

  // decyzja 10-20 w kodzie gry: oba zapisy biorą b1 (czas gracza), a zegar gry wchodzi do krokGracza tylko po to,
  // żeby b1 policzyć; nuta oceniana przez żabę zostaje aktywna i nie zapieka się w bitmapie minionej taśmy
  const kg = funkcja("zabi-chor.js", "krokGracza"), rt = funkcja("zabi-chor.js", "rysujTor");
  ck("krokGracza: ślad i wypełnienie taśmy zapisują się w czasie gracza (b1), nie w zegarze gry",
     /dopiszSlad\(g\.slad,b1,/.test(kg) && /dopiszWypelnienie\(.*,b1,/.test(kg) &&
     (kg.match(/G\.beat/g) || []).length === 1 && /const b1=G\.beat-g\.offMs/.test(kg),
     (kg.match(/G\.beat/g) || []).length);
  ck("rysujTor: nuta, którą żaba ma pod SWOIM zegarem, dalej świeci i nie zastyga w bitmapie minionej taśmy",
     /spiewana=t\.gracze\.some\(g=>g\.idxPod===i\)/.test(rt) && /aktywna=spiewana\|\|/.test(rt) && /if\(minela&&!spiewana&&/.test(rt), "");
}

// ---- runda 2 (10-03): nabijanie wyniku, gwiazdki w HUD na żywo ----
{
  const nw = F("nabijWartosc"), gz = F("gwiazdkiNaZywo");
  ck("nabijWartosc: od 0, rośnie z wyhamowaniem (ease-out), zaokrąglone, na końcu dokładnie wartość, poza zakresem przycięte",
     nw(1234, 0) === 0 && nw(1234, 1) === 1234 && nw(1234, .5) === Math.round(1234 * .875) && nw(1234, .5) > 617 &&
     [0, .2, .4, .6, .8, 1].every((f, k, t) => k === 0 || nw(5000, f) >= nw(5000, t[k - 1])) && nw(99, 7) === 99 && nw(99, -1) === 0 &&
     Number.isInteger(nw(1001, .33)), [nw(1234, .5), nw(1001, .33)]);
  // runda 4: sygnatura (punkty, premiaChoru, premiaKlik, maks.razem, premiaCzysta, zamknięte, nut, od)
  ck("gwiazdkiNaZywo: przed 8 zamkniętymi nutami 0, potem progi 25/45/65/85% jak na wynikach (1–5 gwiazdek)",
     gz(900, 0, 0, 1000, 0, 7, 10, 8) === 0 && gz(0, 0, 0, 1000, 0, 8, 10, 8) === 1 && gz(800 * .25, 0, 0, 1000, 0, 8, 10, 8) === 2 &&
     gz(800 * .86, 0, 0, 1000, 0, 8, 10, 8) === 5 && gz(800 * .5, 0, 0, 1000, 0, 8, 10, 8) === 3, [gz(200, 0, 0, 1000, 0, 8, 10, 8), gz(688, 0, 0, 1000, 0, 8, 10, 8)]);
  ck("gwiazdkiNaZywo: maksimum proporcjonalne do zamkniętych nut, premia chóru i klik w rytm nie podnoszą gwiazdek, sufit 100%",
     gz(250, 0, 0, 1000, 0, 10, 20, 8) === 3 && gz(250 + 300, 200, 100, 1000, 0, 10, 20, 8) === 3 && gz(5000, 0, 0, 1000, 0, 10, 10, 8) === 5 &&
     gz(100, 0, 0, 0, 0, 10, 10, 8) === 0, gz(250, 0, 0, 1000, 0, 10, 20, 8));
  // po ostatniej nucie == wiersz wyników: gwiazdki(procentSpiewu(punkty + premia, chór, klik, maks.razem))
  const ps = F("procentSpiewu"), gw = F("gwiazdki"), mk = { razem: 1100, premia: 100 };
  const zgodne = [[600, 0, 0, 0], [600, 100, 0, 0], [800, 100, 50, 30], [930, 100, 0, 0], [420, 0, 40, 20]].every(([pk, pr, ch, kl]) =>
    gz(pk, ch, kl, mk.razem, pr, 40, 40, 8) === gw(ps(pk + pr, ch, kl, mk.razem)));
  ck("gwiazdkiNaZywo: po ostatniej nucie te same gwiazdki co wiersz wyników (maks.razem, premia za czystą piosenkę doliczona)",
     zgodne && gz(930, 0, 0, 1100, 0, 40, 40, 8) < gz(930, 0, 0, 1100, 100, 40, 40, 8), [gz(930, 0, 0, 1100, 100, 40, 40, 8), gw(ps(1030, 0, 0, 1100))]);
  // 11-20: pasek „do następnej gwiazdki” w żetonie HUD
  const pn = F("procentNaZywo"), pg = F("postepGwiazdki");
  ck("procentNaZywo: -1 przed 8 zamkniętymi nutami i bez maksimum, potem procent z zamkniętej części piosenki, sufit 100",
     pn(900, 0, 0, 1000, 0, 7, 10, 8) === -1 && pn(100, 0, 0, 0, 0, 10, 10, 8) === -1 && pn(400, 0, 0, 1000, 0, 8, 10, 8) === 50 &&
     pn(250 + 300, 200, 100, 1000, 0, 10, 20, 8) === 50 && pn(5000, 0, 0, 1000, 0, 10, 10, 8) === 100, [pn(400, 0, 0, 1000, 0, 8, 10, 8), pn(5000, 0, 0, 1000, 0, 10, 10, 8)]);
  ck("postepGwiazdki: 0..1 między progami 25/45/65/85, na progu zaczyna od zera, przy pięciu gwiazdkach komplet, przed startem 0",
     pg(-1) === 0 && pg(0) === 0 && pg(12.5) === .5 && pg(25) === 0 && pg(35) === .5 && pg(75) === .5 && pg(85) === 1 && pg(100) === 1 &&
     [0, 10, 20, 24.9].every((p, k, a) => k === 0 || pg(p) > pg(a[k - 1])), [pg(12.5), pg(35), pg(75), pg(85)]);
}

// ---- runda 3 (10-03): piktogramy ustawień, skład, pilot kapsla, rechot bez kary, sortowanie, top 3 ----
{
  const pk = F("piktogram"), P = F("ZC_PIKTOGRAMY_UST");
  const wszystkie = Object.entries(P).flatMap(([k, w]) => w.map(v => [k, v, pk(k, v)]));
  // 10-15: piktogramy filcowe (WebP w web/assets/icons/gry) zamiast wektora; każdy wariant ma istniejący plik
  const plikIkony = x => { const m = /src="\.\.\/assets\/icons\/gry\/([a-z0-9-]+)\.webp"/.exec(x); return m ? path.join(REPO, "web", "assets", "icons", "gry", m[1] + ".webp") : null; };
  ck("piktogram: każda opcja ustawień (" + wszystkie.length + " wariantów) to ikona filcowa <img class=\"piktogram\"> z istniejącym plikiem WebP, bez emoji",
     wszystkie.every(([, , x]) => /^<img class="piktogram" /.test(x) && /alt="" aria-hidden="true"/.test(x) && plikIkony(x) && fs.existsSync(plikIkony(x)) &&
       !/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u.test(x)) && new Set(P.uklad.map(v => pk("uklad", v))).size === 4,
     wszystkie.filter(([, , x]) => !(plikIkony(x) && fs.existsSync(plikIkony(x)))).map(([k, v]) => k + ":" + v));
  // każda opcja z USTAWIENIA_UI ma wpis w ZC_PIKTOGRAMY_UST (lista czytana ze źródła, bez Glos i T)
  const src = czytaj("zabi-chor.js"), ui = src.slice(src.indexOf("const USTAWIENIA_UI=["), src.indexOf("function ustaw(k,v)"));
  const klucze = [...ui.matchAll(/\{k:"(\w+)"/g)].map(m => m[1]);
  ck("piktogram: każda opcja USTAWIENIA_UI ma piktogram (" + klucze.length + " opcji)", klucze.length >= 12 && klucze.every(k => P[k]),
     klucze.filter(k => !P[k]));
  ck("piktogram: tempo wychyla metronom, instrumenty mają 4 klasy, głośnik 4 stopnie, puchar i ikony panelu",
     pk("tempo", 50) !== pk("tempo", 120) && new Set(P.glos.map(v => pk("glos", v))).size === 4 && /gry\/puchar\.webp/.test(pk("puchar")) &&
     new Set([0, .2, .5, 1].map(v => pk("glosnosc", v))).size === 4 && F("ikonaFilc")("app/heart").includes('src="../assets/icons/heart.png"'), "");
  const pz = F("pierwszeZdanie");
  ck("pierwszeZdanie: opis pod opcją skraca się do 1 zdania (pełny w title)",
     pz("Klasyczny: każda nuta osobno. Płynny: nuty zjeżdżają po łuku.") === "Klasyczny: każda nuta osobno." && pz("Bez kropki") === "Bez kropki" && pz("") === "", "");
  const wr = F("wysokoscRechotu");
  ck("wysokoscRechotu: półtony od środka partii, ucięte do ±18",
     wr(64, 60, 68) === 0 && wr(70, 60, 68) === 6 && wr(100, 60, 68) === 18 && wr(20, 60, 68) === -18 && wr(NaN, 60, 68) === 0, [wr(70, 60, 68), wr(100, 60, 68)]);
  // zero kary za rechot: naciśnięcie w środku pauzy nie trafia w okno kliku, klatka bez śpiewu nic nie liczy
  const dk = F("dopasujKlik"), kl = F("klatkaNaNutach");
  const nuty = [{ m: 60, t: 0, d: 1 }, { m: 62, t: 4, d: 1 }];   // pauza 1..4 (1,5 s przy 120 bpm)
  const ak = { sumaAcc: 0, spiewal: false, wib: 0 }, r1 = kl(nuty, 1, ak, 2, 2.1, false, 70, false);
  ck("rechot w pauzie: bez punktów i bez kary (klik w środku pauzy poza oknem 150 ms, klatka bez śpiewu nic nie zamyka ani nie liczy)",
     dk(nuty, 2.5, .5, "wejscie") === null && dk(nuty, 2.5, .5, "zejscie") === null && r1.zamkniete.length === 0 && ak.sumaAcc === 0 && !ak.spiewal,
     [dk(nuty, 2.5, .5, "wejscie"), r1]);
  const przed = dk(nuty, 4 - .2, .5, "wejscie");
  ck("rechot: ostatnie 150 ms przed nutą to już klik „wejście” w następną nutę (tak ma zostać)", przed && przed.idx === 1 && Math.abs(przed.dt + .1) < 1e-9, przed);
  const zs = F("zapiszSklad"), os = F("odtworzSklad");
  const sklad = zs([{ id: "mysz", zrodlo: "mysz", partia: 1, nazwa: "Ola", nazwaWlasna: true, kolor: "#ec1a83" },
    { id: "bot-3", zrodlo: "bot", poziom: "trudny", partia: 0, nazwa: "Kumak" },
    { id: "kapsel-AA", zrodlo: "kapsel", partia: 2, kolor: "#294aa8", kolorWlasny: true },
    { id: "ws", zrodlo: "ws", partia: 0 }]);
  ck("zapiszSklad: źródło, partia, nazwa i kolor tylko zmienione ręcznie, poziom bota, id kapsla",
     sklad.wersja === 1 && sklad.gracze.length === 4 && sklad.gracze[0].nazwa === "Ola" && !sklad.gracze[0].kolor && !sklad.gracze[1].nazwa &&
     sklad.gracze[1].poziom === "trudny" && sklad.gracze[2].id === "kapsel-AA" && sklad.gracze[2].kolor === "#294aa8" && !sklad.gracze[3].id, JSON.stringify(sklad));
  const o1 = os(sklad, { kapsle: [], pady: [] });
  ck("odtworzSklad: brakujący kapsel pominięty z powodem, reszta w kolejności z nazwą i poziomem",
     o1.gracze.map(g => g.zrodlo).join(",") === "mysz,bot,ws" && o1.pominiete.length === 1 && o1.pominiete[0].powod === "brak" &&
     o1.gracze[0].nazwa === "Ola" && o1.gracze[1].poziom === "trudny", JSON.stringify(o1));
  const o2 = os(sklad, { kapsle: ["kapsel-AA"], zajete: ["mysz"] });
  ck("odtworzSklad: źródło już w chórze pominięte (zajęte), podłączony kapsel wraca z kolorem",
     o2.gracze.map(g => g.zrodlo).join(",") === "bot,kapsel,ws" && o2.pominiete[0].powod === "zajete" && o2.gracze[1].kolor === "#294aa8", JSON.stringify(o2));
  const dziesiec = { wersja: 1, gracze: Array.from({ length: 10 }, (_, i) => ({ zrodlo: "bot", poziom: "zly", partia: i })).concat([{ zrodlo: "mysz" }, { zrodlo: "mysz" }]) };
  const o3 = os(dziesiec, {}), o4 = os({ wersja: 2, gracze: [{ zrodlo: "mysz" }] }, {}), o5 = os(dziesiec, { zajete: ["a", "b", "c"] });
  ck("odtworzSklad: limit 8 razem z zajętymi, zły poziom bota = Średni, obcy zapis = pusto",
     o3.gracze.length === 8 && o3.gracze.every(g => g.poziom === "sredni") && o3.pominiete.filter(p => p.powod === "limit").length === 4 &&
     o4.gracze.length === 0 && o5.gracze.length === 5 && os(null, null).gracze.length === 0, [o3.gracze.length, o5.gracze.length]);
  // pilot: martwa strefa, histereza, powtarzanie, klik vs przytrzymanie
  const kp = F("krokPilota"), PL = F("ZC_PILOT");
  const jedz = (st, poza, sek, krok = 1 / 60) => { const zd = []; for (let t = 0; t < sek - 1e-9; t += krok) { const r = kp(st, poza, krok); st = r.stan; zd.push(r.zdarzenia); } return { st, zd }; };
  const ile = (zd, k) => zd.filter(z => z[k]).length;
  let a = jedz(null, { pitch: 12, roll: -10 }, .5);
  ck("krokPilota: w martwej strefie (< 18°) nic", a.zd.every(z => !Object.values(z).some(Boolean)), "");
  a = jedz(null, { pitch: 25, roll: 5 }, .3);
  const b = jedz(a.st, { pitch: 25, roll: 5 }, 1.0);
  ck("krokPilota: przechył w przód = „dół” od razu, potem powtarzanie po 0,35 s co 0,14 s",
     ile(a.zd, "dol") === 1 && a.zd[0].dol && ile(b.zd, "dol") === Math.floor((1.3 - PL.POWTORZ_PO) / PL.POWTORZ_CO) + 1 && ile(b.zd, "gora") === 0,
     [ile(a.zd, "dol"), ile(b.zd, "dol")]);
  const c = jedz(a.st, { pitch: 14, roll: 0 }, .2), d = jedz(c.st, { pitch: 11, roll: 0 }, .1), e = jedz(d.st, { pitch: 19, roll: 0 }, .05);
  ck("krokPilota: histereza 6°: zejście do 14° trzyma kierunek, poniżej 12° puszcza, ponowne 19° to nowy krok",
     c.st.kier === "dol" && d.st.kier === null && ile(e.zd, "dol") === 1, [c.st.kier, d.st.kier, ile(e.zd, "dol")]);
  const f = jedz(null, { pitch: -3, roll: -30 }, .1), g2 = jedz(null, { pitch: -26, roll: 22 }, .05);
  ck("krokPilota: przechył w bok = lewo/prawo, przy obu osiach wygrywa mocniejsza", f.zd[0].lewo && g2.zd[0].gora && !g2.zd[0].prawo, "");
  let k1 = jedz(null, { przycisk: true }, .3); k1 = jedz(k1.st, { przycisk: false }, .05);
  let k2 = jedz(null, { przycisk: true }, .7); const k2wstecz = ile(k2.zd, "wstecz"); k2 = jedz(k2.st, { przycisk: false }, .05);
  let k3 = jedz({ blokada: true, wcisniety: true }, { przycisk: true }, .8); k3 = jedz(k3.st, { przycisk: false }, .05);
  ck("krokPilota: krótkie naciśnięcie = ok po puszczeniu, przytrzymanie 0,6 s = wstecz (raz, puszczenie bez ok), blokada po dołączeniu = nic",
     ile(k1.zd, "ok") === 1 && k2wstecz === 1 && ile(k2.zd, "ok") === 0 && ile(k3.zd, "ok") === 0 && ile(k3.zd, "wstecz") === 0 && !k3.st.blokada,
     [ile(k1.zd, "ok"), k2wstecz, ile(k3.zd, "ok")]);
  // sortowanie utworów
  const su = F("sortujUtwory");
  const w = [{ id: "z", tytul: "Żabka", kolejnosc: 0 }, { id: "a", tytul: "Ala", kolejnosc: 1 }, { id: "l", tytul: "Łąka", dodano: 300 },
    { id: "b", tytul: "Bęben", dodano: 500 }, { id: "c", tytul: "Ćma", kolejnosc: 2 }];
  const t = (tryb, o) => su(w, tryb, o).map(x => x.id).join("");
  ck("sortujUtwory: alfabetycznie po polsku (Ć po C, Ł po L, Ż na końcu), wejście bez zmian", t("alfabet") === "abclz" && w[0].id === "z", t("alfabet"));
  ck("sortujUtwory: ostatnio grane malejąco, niegrane na końcu alfabetycznie",
     t("ostatnio", { ostatnioGrane: { l: "2026-10-03T10:00:00Z", z: "2026-10-03T12:00:00Z" } }) === "zlabc", t("ostatnio", { ostatnioGrane: { l: "2026-10-03T10:00:00Z", z: "2026-10-03T12:00:00Z" } }));
  ck("sortujUtwory: najnowsze po czasie dodania, wbudowane (bez czasu) na końcu w kolejności listy", t("najnowsze") === "blzac", t("najnowsze"));
  ck("sortujUtwory: ulubione na górze, w obu grupach alfabetycznie; remis = alfabetycznie",
     t("ulubione", { ulubione: ["z", "b"] }) === "bzacl" && su([{ id: "2", tytul: "Ala" }, { id: "1", tytul: "ala" }], "alfabet").map(x => x.id).join("") === "12" &&
     su(null, "alfabet").length === 0 && t("cokolwiek") === "abclz", t("ulubione", { ulubione: ["z", "b"] }));
  const tw = F("topWpisy");
  const wp = [{ kto: "A", punkty: 100, precyzja: 50, kiedy: 3 }, { kto: "B", punkty: 300, precyzja: 70, kiedy: 1 }, { kto: "C", punkty: 300, precyzja: 90, kiedy: 2 },
    { kto: "D", punkty: 200, precyzja: 10, kiedy: 4 }, { kto: "X", punkty: "zle" }];
  const top = tw(wp, 3);
  ck("topWpisy: 3 najlepsze po punktach (remis: precyzja), z miejscem; zły wiersz pominięty, pusto bez błędu",
     top.map(x => x.miejsce + x.kto).join(",") === "1C,2B,3D" && tw(null, 3).length === 0 && tw(wp, 0).length === 0 && wp[0].kto === "A", JSON.stringify(top));
}

// ---- runda 4 (10-03): czas na ruch przy dalekich skokach ----
{
  const cr = F("dodajCzasNaRuch"), TR = F("ZC_TRUDNOSC"), mx = F("maksimumPunktow"), kl = F("klatkaNaNutach"), dk = F("dopasujKlik"), prz = F("przygotujPartie");
  const s = .5, mt = J => Math.min(.45, TR.FITTS_A + TR.FITTS_B * Math.log2(J + 1));   // ten sam model co cechyPartii
  const we = [{ m: 60, t: 0, d: 2 }, { m: 72, t: 2, d: 1 }];
  const a = cr(we, s);
  ck("czas na ruch: daleki skok bez przerwy dostaje lukę równą MT, A skrócona, B nietknięta, t0/d0 zachowane, wejście bez zmian",
     blisko((a[1].t - (a[0].t + a[0].d)) * s, mt(12), 1e-9) && a[0].t0 === 0 && a[0].d0 === 2 && a[1].t === 2 && a[1].t0 === undefined && we[0].d === 2, JSON.stringify(a));
  const b2 = cr([{ m: 60, t: 0, d: 1 }, { m: 72, t: 1, d: 1 }], s);
  ck("czas na ruch: A za krótka (najwyżej 40 %), resztę bierze początek B (najwyżej 30 %), luka nadal MT",
     blisko(b2[0].d, .6) && b2[1].t > 1 && b2[1].d0 === 1 && blisko((b2[1].t - (b2[0].t + b2[0].d)) * s, mt(12), 1e-9), JSON.stringify(b2));
  const c1 = cr([{ m: 60, t: 0, d: 1 }, { m: 62, t: 1, d: 1 }], s), c2 = cr([{ m: 60, t: 0, d: 1 }, { m: 72, t: 2, d: 1 }], s),
    c3 = cr([{ m: 60, t: 0, d: 2, p: { od: .6, do: 67 } }, { m: 67, t: 2, d: 1 }], s), c4 = cr([{ m: 60, t: 0, d: .2 }, { m: 72, t: .2, d: .2 }], s);
  ck("czas na ruch: mały interwał (2), przerwa już wystarczająca i nuta ze zjazdem: bez zmian; nuta nie krótsza niż 1/8",
     c1.every(n => n.d0 === undefined) && c2.every(n => n.d0 === undefined) && c3.every(n => n.d0 === undefined) && c4[0].d >= .125 - 1e-9 && c4[1].d >= .125 - 1e-9, JSON.stringify(c4));
  const dl = [{ m: 60, t: 0, d: 1 }, { m: 72, t: 1, d: 1 }, { m: 60, t: 2, d: 1 }, { m: 74, t: 3, d: 2 }], dl2 = cr(dl, s);
  ck("czas na ruch: maksimum punktów maleje (krótsze okna), ten sam wzór dla wszystkich", mx(dl2).razem < mx(dl).razem, [mx(dl).razem, mx(dl2).razem]);
  // luka: śpiew w niej nic nie liczy i nie zamyka niczego poza A; klik „zejście” A podąża za nowym końcem
  const ak = { sumaAcc: 0, spiewal: false, wib: 0 }, r1 = kl(a, 0, ak, 0, a[0].d, true, 60, false);
  const ak2 = { sumaAcc: 0, spiewal: false, wib: 0 }, r2 = kl(a, 1, ak2, a[0].d, 2, true, 72, false), zej = dk(a, a[0].d, s, "zejscie");
  ck("czas na ruch: w luce brak punktów i kary (nic się nie liczy ani nie zamyka), klik „zejście” na nowym końcu A",
     r1.zamkniete.length === 1 && r1.zamkniete[0].wynik === 100 && r2.zamkniete.length === 0 && ak2.sumaAcc === 0 && !ak2.spiewal && zej && zej.idx === 0 && Math.abs(zej.dt) < 1e-9,
     [r1.zamkniete, ak2, zej]);
  const pz = prz({ nuty: we, lo: 60, hi: 72 }, { czasNaRuch: true, tryb: "klasyczny" }, 120), pw = prz({ nuty: we, lo: 60, hi: 72 }, { czasNaRuch: false }, 120);
  ck("przygotujPartie: czas na ruch tylko przy ust.czasNaRuch === true i znanym tempie; wyłączony = partia bez zmian",
     pz.nuty[0].d0 === 2 && pz.oryginal && pw.nuty === we && prz({ nuty: we }, { czasNaRuch: true }).nuty === we, "");
}

// ---- 11. pomoce z odbiciem na punktach i „Poziom gry” (10-18) ----------------------------------------------------
{
  const pP = F("poziomPrzyciagania"), mp = F("mnoznikPomocy"), mu = F("mnoznikPunktowUst"), pr = F("presetUstawien"), mig = F("migrujPomoce"),
    M = F("ZC_MN_POMOCY"), PR = F("ZC_PRESETY"), z = (u, x) => Object.assign({}, u, x);
  ck("poziom przyciągania: stary przełącznik true = 1, false i brak = 0, liczby ucięte do 0–4, pięć poziomów",
     pP(true) === 1 && pP(false) === 0 && pP(undefined) === 0 && pP(3) === 3 && pP(9) === 4 && pP(-2) === 0 && pP("2") === 2 &&
     F("ZC_POMOC").POZIOMY.length === 5 && F("ZC_POMOC").POZIOMY[0] === null && F("ZC_POMOC").POZIOMY[1].pas === 0, "");
  const d = { przyciaganie: 1, spiewaSama: false, podpowiedz: false, klawDoNuty: false, pokazJak: true, czasNaRuch: 100, tempo: 100 };
  ck("mnożnik pomocy: domyślne ×1, bez przyciągania premia, mocniej = mniej, „skok do nuty” tylko na klawiaturze",
     mp(d) === 1 && mp(z(d, { przyciaganie: 0 })) > 1 && mp(z(d, { przyciaganie: 4 })) < mp(z(d, { przyciaganie: 3 })) &&
     mp(z(d, { spiewaSama: true })) === M.spiewaSama && mp(z(d, { klawDoNuty: true }), false) === 1 &&
     mp(z(d, { klawDoNuty: true }), true) === M.klawDoNuty && mp(z(d, { podpowiedz: true })) === M.podpowiedz && mp(z(d, { pokazJak: false })) === 1, "");
  ck("mnożniki przyciągania maleją z poziomem, poziom 1 (domyślny) = ×1, wszystkie dodatnie",
     M.przyciaganie.length === 5 && M.przyciaganie[1] === 1 && M.przyciaganie.every((v, i) => !i || v < M.przyciaganie[i - 1]) && M.przyciaganie[4] > 0, M.przyciaganie);
  const luz = PR.find(p => p.k === "luz").ust, mistrz = PR.find(p => p.k === "mistrz").ust;
  ck("mnożnik konfiguracji = czas na ruch × tempo × pomoce (Na luzie ×0,405, na klawiaturze ×0,288; Mistrz ok. ×1,52)",
     mu(luz, false) === .405 && mu(luz, true) === .288 && blisko(mu(mistrz, false), 1.25 * 1.18 * 1.03, 1e-3) && mu(d, true) === 1,
     [mu(luz, false), mu(luz, true), mu(mistrz, false)]);
  ck("zestawy: domyślne = Normalny, każdy zestaw rozpoznaje sam siebie, stary przełącznik przyciągania = poziom, inna wartość = własne",
     pr(d) === "normalny" && PR.every(p => pr(p.ust) === p.k) && pr(z(d, { przyciaganie: true })) === "normalny" && pr(z(d, { tempo: 105 })) === null &&
     PR.every(p => F("ZC_KLUCZE_PRESETU").every(k => k in p.ust)), "");
  const u1 = mig({ przyciaganie: true, klawiatura: "donuty" }), u2 = mig({ przyciaganie: false, klawiatura: "plynnie" }), u3 = mig({ klawiatura: "donuty", klawDoNuty: false });
  ck("migracja zapisu sprzed 10-18: przełącznik → poziom, „Do nuty” → „Szybko” + skok do nuty (własny wybór skoku zostaje)",
     u1.przyciaganie === 1 && u1.klawiatura === "szybko" && u1.klawDoNuty === true && u2.przyciaganie === 0 && u2.klawiatura === "plynnie" &&
     !("klawDoNuty" in u2) && u3.klawiatura === "szybko" && u3.klawDoNuty === false, [u1, u2, u3]);
  const kf = (u, mn) => F("konfiguracjaGry")(Object.assign({ tempo: 100, zakres: 40 }, u), { tempo: 100 }, mn), pk = k => F("podpisKonfiguracji")(k);
  ck("tablica: domyślna konfiguracja ma podpis jak przed 10-18; stare wiersze z pomoc true/false dalej m/b",
     pk(kf({ przyciaganie: 1 }, 1)) === "t100|p|m|z40" && pk({ tempo: 100, pomoc: true, zakres: 40, caly: true }) === "t100|p|m|z40" &&
     pk({ tempo: 100, pomoc: false, zakres: 40, caly: true }) === "t100|p|b|z40", pk(kf({ przyciaganie: 1 }, 1)));
  const k3 = kf({ przyciaganie: 3, spiewaSama: true, podpowiedz: true }, .41);
  ck("tablica: poziom przyciągania, podpowiedź, skok do nuty i mnożnik pomocy w podpisie i opisie (osobna konkurencja)",
     pk(k3) === "t100|l|m3|z40|h|a41" && pk(kf({ przyciaganie: 0 }, 1.03)) === "t100|p|b|z40|a103" &&
     pk(z(kf({ przyciaganie: 1 }, 1), { klawDoNuty: true, mnPomocy: .68 })) === "t100|p|m|z40|k|a68" &&
     F("opisKonfiguracji")(k3) === "tempo 100% · żaba śpiewa sama · przyciąganie mocne · podpowiedź melodii · pomoce ×0.41", [pk(k3), F("opisKonfiguracji")(k3)]);
}
// ---- 11b. pomoce osobno dla każdego gracza (10-18 wieczór): dziecko z pomocami i dorosły bez w jednej grze ------------------
{
  const pz = F("pomoceZ"), pg = F("pomoceGraczaZ"), ug = F("ustGracza"), dp = F("pomoceDoProfilu"), zp = F("pomoceZProfilu"),
    mp = F("mnoznikPomocy"), mu = F("mnoznikPunktowUst"), kg = F("konfiguracjaGracza"), pk = k => F("podpisKonfiguracji")(k),
    J = x => JSON.stringify(x), z = (u, x) => Object.assign({}, u, x);
  const ust = { tempo: 100, zakres: 40, czasNaRuch: 100, przyciaganie: 1, spiewaSama: false, podpowiedz: false, klawDoNuty: false, tory: "osobno", tryb: "plynny" };
  ck("pomoce gracza: normalizacja (stary przełącznik, tekst, brak); własne wygrywają z ustawieniami, null = jak w ustawieniach",
     J(pz({ przyciaganie: true })) === J({ przyciaganie: 1, spiewaSama: false, klawDoNuty: false }) && J(pz(null)) === J({ przyciaganie: 0, spiewaSama: false, klawDoNuty: false }) &&
     J(pz({ przyciaganie: "3", spiewaSama: 1 })) === J({ przyciaganie: 3, spiewaSama: true, klawDoNuty: false }) &&
     J(pg(null, ust)) === J({ przyciaganie: 1, spiewaSama: false, klawDoNuty: false }) && pg({ przyciaganie: 3 }, ust).przyciaganie === 3 &&
     J(pg({ przyciaganie: 0 }, z(ust, { spiewaSama: true }))) === J({ przyciaganie: 0, spiewaSama: false, klawDoNuty: false }), "");
  const dziecko = { przyciaganie: 3, spiewaSama: false, klawDoNuty: false }, dorosly = { przyciaganie: 0, spiewaSama: false, klawDoNuty: false };
  const uD = ug(ust, dziecko), uA = ug(ust, dorosly);
  ck("mnożnik w jednej grze: dziecko z „Mocnym” ×0,59, dorosły bez pomocy ×1,03, gracz jak w ustawieniach ×1; tempo i czas na ruch wspólne",
     mp(uD) === .59 && mp(uA) === 1.03 && mp(ug(ust, null)) === 1 && uD.tempo === 100 && uD.czasNaRuch === 100 &&
     mu(z(uD, { tempo: 125 })) === Math.round(mu(z(ust, { tempo: 125 })) * .59 * 1e4) / 1e4, [mp(uD), mp(uA), mu(z(uD, { tempo: 125 }))]);
  const mPD = mp(ug(z(ust, { podpowiedz: true }), dziecko)), mPA = mp(ug(z(ust, { podpowiedz: true }), dorosly));
  ck("podpowiedź melodii zostaje wspólna: wchodzi do mnożnika każdego gracza (×0,95), także z własnymi pomocami", mPD === .56 && mPA === .98, [mPD, mPA]);
  ck("skok do nuty z karty liczy się tylko na klawiaturze",
     mp(ug(ust, { przyciaganie: 1, klawDoNuty: true }), true) === .71 && mp(ug(ust, { przyciaganie: 1, klawDoNuty: true }), false) === 1, "");
  const prof = dp(dziecko);
  ck("zapis w profilu: płaskie klucze pomoc*, odczyt oddaje to samo; „jak w ustawieniach” = null; stary przełącznik i tekst czytane jak poziom",
     J(prof) === J({ pomocPrzyciaganie: 3, pomocSpiewaSama: false, pomocKlawDoNuty: false }) && J(zp(prof)) === J(dziecko) &&
     J(dp(null)) === J({ pomocPrzyciaganie: null, pomocSpiewaSama: null, pomocKlawDoNuty: null }) && zp(dp(null)) === null && zp({}) === null &&
     zp(null) === null && zp({ uklad: "auto" }) === null && J(zp({ pomocPrzyciaganie: true })) === J({ przyciaganie: 1, spiewaSama: false, klawDoNuty: false }) &&
     J(zp({ pomocPrzyciaganie: "4", pomocSpiewaSama: true })) === J({ przyciaganie: 4, spiewaSama: true, klawDoNuty: false }), J(prof));
  const sk = F("zapiszSklad")([{ id: "ws", zrodlo: "ws", partia: 0, pomoce: { przyciaganie: 3, klawDoNuty: true } },
    { id: "mysz", zrodlo: "mysz", partia: 0, nazwa: "Tata", nazwaWlasna: true, pomoce: dorosly },
    { id: "bot-1", zrodlo: "bot", poziom: "latwy", partia: 0, pomoce: dziecko }, { id: "strzalki", zrodlo: "strzalki", partia: 1 }]);
  const os = F("odtworzSklad")(sk, {});
  ck("skład: własne pomoce gościa jadą w zapisie składu, gracza z imieniem (pamięta je profil) i bota nie; odtworzenie je oddaje",
     J(sk.gracze[0].pomoce) === J({ przyciaganie: 3, spiewaSama: false, klawDoNuty: true }) && !("pomoce" in sk.gracze[1]) && !("pomoce" in sk.gracze[2]) &&
     !("pomoce" in sk.gracze[3]) && J(os.gracze[0].pomoce) === J(sk.gracze[0].pomoce) && os.gracze[1].pomoce === null && os.gracze[2].pomoce === null &&
     F("odtworzSklad")({ wersja: 1, gracze: [{ zrodlo: "ws", pomoce: [1, 2] }] }, {}).gracze[0].pomoce === null, J(sk.gracze));
  const kD = kg(ust, { tempo: 100 }, dziecko, false, .59), kA = kg(ust, { tempo: 100 }, dorosly, false, 1.03), kN = kg(ust, { tempo: 100 }, null, false, 1);
  ck("tablica: wiersz dziecka |m3|a59, dorosłego |b|a103, gracza jak w ustawieniach bez zmian (osobne konkurencje)",
     pk(kD) === "t100|p|m3|z40|o|g|r|a59" && pk(kA) === "t100|p|b|z40|o|g|r|a103" && pk(kN) === pk(F("konfiguracjaGry")(ust, { tempo: 100 }, 1)) &&
     pk(kN) === "t100|p|m|z40|o|g|r", [pk(kD), pk(kA), pk(kN)]);
  const obie = { przyciaganie: 2, spiewaSama: true, klawDoNuty: true };
  const kS = kg(ust, { tempo: 100 }, obie, true, .41), kM = kg(ust, { tempo: 100 }, obie, false, .58), kU = kg(z(ust, { klawDoNuty: true }), { tempo: 100 }, null, true, .71);
  ck("tablica: śpiewa sama |l, skok do nuty |k tylko na klawiaturze, także gdy idzie z ustawień gry",
     pk(kS) === "t100|l|m2|z40|o|g|r|k|a41" && pk(kM) === "t100|l|m2|z40|o|g|r|a58" && pk(kU) === "t100|p|m|z40|o|g|r|k|a71", [pk(kS), pk(kM), pk(kU)]);
  const op = F("opisPomocy");
  ck("opis pomocy gracza: przyciąganie, śpiew, skok do nuty tylko na klawiaturze",
     op(obie, true) === "przyciąganie średnie · żaba śpiewa sama · skok do nuty" && op(obie, false) === "przyciąganie średnie · żaba śpiewa sama" &&
     op({ przyciaganie: 0, spiewaSama: false }, false) === "bez przyciągania · śpiew przyciskiem" && op({ przyciaganie: 1 }, false) === "przyciąganie delikatne · śpiew przyciskiem",
     op(obie, true));
}

// ---- plansza: kto ją wybiera i w jakiej kolejności stoją kafle (10-21) -------------------------
// Wybór planszy przez gracza pomija losowanie (są też opcje „wybierz losową” i „wybierają wszyscy”),
// a kafle plansz są posortowane według jakości.
{
  const plan = F("planPlanszy"), pelne = { ludzi: 2, plansz: 8, zAdresu: false, kolo: true };
  const z = o => Object.assign({}, pelne, o);
  ck("plansza: tryb z paska decyduje, co robi „Śpiewamy!” — okno wyboru, samo losowanie albo plansza z paska bez okna",
     plan("wszyscy", pelne) === "wszyscy" && plan("los", pelne) === "los" && plan("ta", pelne) === "ta" &&
     plan("cokolwiek", pelne) === "wszyscy" && F("ZC_PLANSZA_TRYBY").join(",") === "wszyscy,los,ta",
     [plan("wszyscy", pelne), plan("los", pelne), plan("ta", pelne)].join(","));
  ck("plansza: sami boci, jedna zdobyta plansza, skład z adresu albo brak kolo.js = gramy tą z paska, bez okna i losowania",
     plan("wszyscy", z({ ludzi: 0 })) === "ta" && plan("los", z({ ludzi: 0 })) === "ta" && plan("los", z({ plansz: 1 })) === "ta" &&
     plan("wszyscy", z({ plansz: 1 })) === "ta" && plan("wszyscy", z({ zAdresu: true })) === "ta" && plan("los", z({ kolo: false })) === "ta" &&
     plan("wszyscy", null) === "ta");
  const rz = { prawdziwy: "sekretny", zloto: "legendarny", kosmos: "epicki", cyrk: "rzadki", disco: "zwykly", halloween: "zwykly" };
  const lista = ["disco", "zloto", "halloween", "kosmos", "prawdziwy", "cyrk", "filc"].map(id => ({ id }));
  const po = F("planszeWgJakosci")(lista, id => rz[id] || null).map(w => w.id);
  ck("plansza: kafle wg jakości (sekretna → zwykła), w tej samej rzadkości kolejność drabinki, plansza bez tieru na końcu; wejście nietknięte",
     po.join(",") === "prawdziwy,zloto,kosmos,cyrk,disco,halloween,filc" && lista[0].id === "disco" && lista.length === 7, po.join(","));
  ck("plansza: bez rzadkości (brak Postepy.rzadkosc) kolejność drabinki zostaje bez zmian",
     F("planszeWgJakosci")(lista, null).map(w => w.id).join(",") === "disco,zloto,halloween,kosmos,prawdziwy,cyrk,filc");
}

console.log(JSON.stringify({ checks }));
