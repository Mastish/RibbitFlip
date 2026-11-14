// RibbitBeat, pakiety piosenek z audio: mapa czasu i układy miksu z web/gry/js/pakiet-piosenki.js w Node.
//
// Funkcje są WYCINANE z pliku gry po nazwie i wykonywane w `vm` (mechanizm skopiowany z
// tests/ribbitbeat_konwerter_harness.mjs; tamtego pliku nie ruszamy). Test pilnuje kodu gry, nie jego kopii.
// Wywołanie: node tests/gry_pakiety_harness.mjs. Ostatnia linia wyjścia to JSON {checks:[[nazwa, ok, szczegół], …]}.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PLIK = path.join(REPO, "web", "gry", "js", "pakiet-piosenki.js");
const src = fs.readFileSync(PLIK, "utf8");
const checks = [];
const ck = (name, ok, detail) => checks.push([name, !!ok, detail === undefined ? "" : String(detail)]);

function domknij(od, naSredniku) {
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
function funkcja(nazwa) {
  const i = src.indexOf("function " + nazwa + "(");
  if (i < 0) throw new Error(nazwa + " nie ma w pakiet-piosenki.js");
  return src.slice(i, domknij(src.indexOf("{", src.indexOf(")", i)), false));
}
function stala(nazwa) {
  const i = src.indexOf("const " + nazwa + "=");
  if (i < 0) throw new Error(nazwa + " nie ma w pakiet-piosenki.js");
  return src.slice(i, domknij(i, true)).replace(/^const /, "var ");
}

const ctx = { Math, Number, JSON, Array, Object, String, Error, Infinity };
vm.createContext(ctx);
const run = kod => vm.runInContext(kod, ctx);
try {
  for (const s of ["ZC_PP", "PP_AUDIO", "PP_STEMY", "PP_MIDI", "PP_UKLADY", "ppGlosnosc"]) run(stala(s));
  for (const f of ["ppOkresMediany", "ppCzasNaUderzenie", "ppUderzenieNaCzas", "ppMapa", "ppTickNaSekundy", "ppSekundyNaTick",
    "ppPozycja", "ppBeat", "ppUklady", "ppDomyslnyUklad", "ppZlozUklad", "ppKluczSciezki", "ppRate"]) run(funkcja(f));
  ck("funkcje mapy czasu i układów wycinają się z pakiet-piosenki.js", true);
} catch (e) {
  ck("funkcje mapy czasu i układów wycinają się z pakiet-piosenki.js", false, e.message);
  console.log(JSON.stringify({ checks }));
  process.exit(0);
}
const F = n => ctx[n] || vm.runInContext(n, ctx);
const blisko = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// ---- mapa czasu: nagranie z rubato, dwa uderzenia na ćwierćnutę (tempo „połówkowe”), tick 0 na pierwszym uderzeniu
const ud = [0.1, 0.62, 1.1, 1.65, 2.1, 2.58];
const mapa = F("ppMapa")({ uderzenia_s: ud, tpq: 480, wspolczynnik: 2, start_tick: 0, start_s: 0.1 });
const t2s = t => F("ppTickNaSekundy")(mapa, t), s2t = s => F("ppSekundyNaTick")(mapa, s);
ck("mediana okresu uderzeń (0,45 0,48 0,48 0,52 0,55 → 0,48)", blisko(mapa.okres, 0.48), mapa.okres);
ck("tick 0 = start_s, ćwierćnuta (480) = 2 uderzenia = 1,1 s, 1200 = uderzenie 5 = 2,58 s",
  blisko(t2s(0), 0.1) && blisko(t2s(480), 1.1) && blisko(t2s(1200), 2.58), [t2s(0), t2s(480), t2s(1200)]);
ck("interpolacja liniowa między uderzeniami (tick 120 = pół drogi 0,1 → 0,62)", blisko(t2s(120), 0.36), t2s(120));
{
  let mono = true, odwr = 0, prev = -Infinity;
  for (let t = -2000; t <= 6000; t += 37) {
    const s = t2s(t); if (!(s > prev)) mono = false; prev = s;
    odwr = Math.max(odwr, Math.abs(s2t(s) - t));
  }
  ck("tick → s ściśle rosnące na całym zakresie (także poza siatką)", mono);
  ck("odwracalność tick → s → tick (błąd < 1e-6 ticka)", odwr < 1e-6, odwr);
  let odwr2 = 0;
  for (let s = -1.5; s <= 4.5; s += 0.013) odwr2 = Math.max(odwr2, Math.abs(t2s(s2t(s)) - s));
  ck("odwracalność s → tick → s (błąd < 1e-9 s)", odwr2 < 1e-9, odwr2);
}
ck("ekstrapolacja przed siatką medianą okresu (tick −240 = −1 uderzenie = 0,1 − 0,48 s)", blisko(t2s(-240), 0.1 - 0.48), t2s(-240));
ck("ekstrapolacja za siatką medianą okresu (tick 1680 = 2,58 + 2 × 0,48 s)", blisko(t2s(1680), 2.58 + 0.96), t2s(1680));
ck("sekundy przed nagraniem dają ujemny tick (odliczanie przed pierwszą nutą)", s2t(0) < 0 && blisko(s2t(0), -0.1 / 0.48 * 240), s2t(0));
{
  const m2 = F("ppMapa")({ uderzenia_s: ud, tpq: 480, wspolczynnik: 2, start_tick: 960, start_s: 1.1 });
  ck("start_tick/start_s: tick 960 w 1,1 s, tick 0 cztery uderzenia wcześniej (0,1 − 2 × 0,48 s z ekstrapolacji)",
    blisko(F("ppTickNaSekundy")(m2, 960), 1.1) && blisko(F("ppTickNaSekundy")(m2, 0), 0.1 - 0.96), F("ppTickNaSekundy")(m2, 0));
  const m3 = F("ppMapa")({ uderzenia_s: ud, tpq: 480, wspolczynnik: 1, start_tick: 0, start_s: 0, poczatek_u: 1 });
  ck("poczatek_u z konwertera wygrywa ze start_s (tick 0 = uderzenie 1 = 0,62 s)", blisko(F("ppTickNaSekundy")(m3, 0), 0.62));
  const m4 = F("ppMapa")({ uderzenia_s: [0, 0.5], tpq: 96 });
  ck("domyślnie: tpq z mapy, współczynnik 1, tick 0 na pierwszym uderzeniu", blisko(F("ppTickNaSekundy")(m4, 96), 0.5));
}
{
  let rzuca = 0;
  for (const zle of [null, {}, { uderzenia_s: [1] }, { uderzenia_s: [0, 1, 1] }, { uderzenia_s: [0, 2, 1] }])
    try { F("ppMapa")(zle); } catch (e) { rzuca++; }
  ck("ppMapa odrzuca brak mapy, jedno uderzenie i nierosnące czasy", rzuca === 5, rzuca);
}

// ---- fragment piosenki z powtórkami: ćwierćnuta gry ↔ ćwierćnuta utworu
{
  const fr = { od: 2, do: 3, powtorz: 2, caly: false }, poz = F("ppPozycja"), bt = F("ppBeat");
  const a = poz(0, fr, 4), b = poz(9, fr, 4), c = poz(-2, fr, 4), d = poz(20, fr, 4);
  ck("fragment takty 2–3 ×2: beat 0 → ćwierćnuta 4, beat 9 → 5 w powtórce 1, odliczanie −2 → 2",
    a.q === 4 && a.powt === 0 && b.q === 5 && b.powt === 1 && c.q === 2 && c.powt === 0, JSON.stringify([a, b, c]));
  ck("po ostatniej powtórce czas biegnie dalej (beat 20 → ćwierćnuta 16, powtórka 1)", d.q === 16 && d.powt === 1, JSON.stringify(d));
  let ok = true;
  for (let x = -4; x <= 18; x += 0.25) { const p = poz(x, fr, 4); if (Math.abs(bt(p.q, p.powt, fr, 4) - x) > 1e-12) ok = false; }
  ck("ppBeat odwraca ppPozycja (fragment z powtórkami)", ok);
  const cal = poz(7.5, { caly: true }, 4);
  ck("cała piosenka: ćwierćnuta gry = ćwierćnuta utworu", cal.q === 7.5 && cal.powt === 0);
}

// ---- układy miksu
{
  const U = F("ppUklady")({ uklady: [
    { id: "karaoke", nazwa: "Moje karaoke", zrodla: { oryginal: 0.5 }, melodia_gracza: "instrument" },
    { id: "glosno", nazwa: "Głośno", zrodla: { bass: 3, drums: -1, other: "x", vocals: 0.5 } },
    { id: "../zly", zrodla: { bass: 1 } }, { id: "bez_zrodel" }, null] });
  const ids = U.map(u => u.id);
  // Wpis o id wbudowanego zostaje wbudowany (nazwa ze słownika), ale głośności bierze z pliku (poprawka 04.10).
  ck("ppUklady: 4 wbudowane + własny; wpis o id wbudowanego zostaje wbudowany z głośnościami z pliku; złe id i brak źródeł pominięte",
    ids.join(",") === "karaoke,zabi_wokal,oryginal_w_tle,czysty_ribbitbeat,glosno" && U[0].wbudowany === true && U[0].nazwa === ""
    && U[0].zrodla.oryginal === 0.5 && U[0].melodia_gracza === "instrument",
    ids.join(",") + " wbudowany=" + U[0].wbudowany + " oryginal=" + (U[0].zrodla && U[0].zrodla.oryginal));
  const g = U.find(u => u.id === "glosno");
  ck("głośności przycięte do 0–1 (3 → 1, −1 → 0, „x” → 0, 0,5 zostaje), brak = 0, melodia domyślnie „spiew”",
    g.zrodla.bass === 1 && g.zrodla.drums === 0 && g.zrodla.other === 0 && g.zrodla.vocals === 0.5 && g.zrodla.midi_vocal === 0
    && g.melodia_gracza === "spiew", JSON.stringify(g.zrodla));
  const W = F("ppUklady")(null);
  const kar = W[0].zrodla, zw = W[1].zrodla, ot = W[2].zrodla, cz = W[3].zrodla;
  ck("wbudowane wg kontraktu v1: karaoke bez wokalu i MIDI, żabi wokal z midi_vocal, oryginał w tle 0,3 + MIDI, czysty bez audio",
    kar.vocals === 0 && kar.drums === 1 && kar.midi_vocal === 0 && W[0].melodia_gracza === "spiew"
    && zw.vocals === 0 && zw.midi_vocal === 1 && zw.midi_bass === 0 && W[1].melodia_gracza === "instrument"
    && ot.oryginal === 0.3 && ot.midi_chords === 1 && ot.drums === 0 && cz.oryginal === 0 && cz.midi_drums === 1 && cz.bass === 0);
  const D = F("ppDomyslnyUklad");
  ck("układ startowy: miks.json > manifest > karaoke (nieznane id pominięte)",
    D(W, { uklad_domyslny: "zabi_wokal" }, { uklad_domyslny: "oryginal_w_tle" }) === "zabi_wokal"
    && D(W, { uklad_domyslny: "nie-ma" }, { uklad_domyslny: "oryginal_w_tle" }) === "oryginal_w_tle"
    && D(W, null, {}) === "karaoke");
  const Z = F("ppZlozUklad"), wszystko = { oryginal: true, vocals: true, drums: true, bass: true, other: true };
  const z1 = Z(W[0], wszystko);
  ck("złożenie: komplet plików = głośności układu bez zmian", z1.audio.oryginal === 0 && z1.audio.vocals === 0 && z1.audio.drums === 1
    && z1.midi.midi_vocal === 0 && z1.melodia_gracza === "spiew", JSON.stringify(z1));
  const z2 = Z(W[0], { oryginal: true });
  ck("fold: bez stemów karaoke gra oryginał z głośnością 0 + średnia stemów (0+1+1+1)/4 = 0,75", z2.audio.oryginal === 0.75
    && z2.audio.drums === 0, JSON.stringify(z2.audio));
  const z3 = Z(W[2], { vocals: true, drums: true, bass: true, other: true });
  ck("fold: bez oryginału jego 0,3 idzie na każdy stem (oryginał = suma stemów)",
    ["vocals", "drums", "bass", "other"].every(k => z3.audio[k] === 0.3) && z3.audio.oryginal === 0, JSON.stringify(z3.audio));
  const z4 = Z({ zrodla: { oryginal: 1, vocals: 1, drums: 1, bass: 1, other: 1 } }, { oryginal: true });
  ck("fold: suma po złożeniu przycięta do 1 (kontrakt: głośności 0–1)", z4.audio.oryginal === 1, z4.audio.oryginal);
  const z4b = Z({ zrodla: { oryginal: 0.8 } }, { vocals: true, drums: true, bass: true, other: true });
  const z4c = Z({ zrodla: { drums: 1.5 } }, { vocals: true, drums: true, bass: true, other: true });
  ck("fold bez oryginału i wartość > 1 z pliku: przycięte do 1", z4b.audio.drums === 0.8 && z4c.audio.drums === 1, [z4b.audio.drums, z4c.audio.drums]);
  const z5 = Z({ zrodla: { drums: 0.5, midi_bass: 0.5 } }, wszystko);
  ck("0,5 zostaje 0,5 (audio i MIDI)", z5.audio.drums === 0.5 && z5.midi.midi_bass === 0.5, JSON.stringify(z5));
  const z6 = Z(W[0], { vocals: true });
  ck("stem, którego nie ma, milczy (bez oryginału i bez kompletu nic nie zgaduje)", z6.audio.drums === 0 && z6.audio.vocals === 0);
}
ck("nazwy ścieżek konwertera → źródła MIDI (Vocal, Bass, Chords, Drums)",
  F("ppKluczSciezki")("Vocal") === "midi_vocal" && F("ppKluczSciezki")("Bass") === "midi_bass"
  && F("ppKluczSciezki")("Chords") === "midi_chords" && F("ppKluczSciezki")("Drums") === "midi_drums" && F("ppKluczSciezki")("") === "midi_chords");
ck("szybkość nagrania = tempo gry / tempo zapisu, w granicach 0,25–4",
  blisko(F("ppRate")(120, 120), 1) && blisko(F("ppRate")(90, 120), 0.75) && F("ppRate")(500, 50) === 4 && F("ppRate")(100, 0) === 1);

console.log(JSON.stringify({ checks }));
