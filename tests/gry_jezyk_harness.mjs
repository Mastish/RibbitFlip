// RibbitBeat (web/gry/): wersja angielska gry w Node, bez przeglądarki. Wołany z tests/test_gry_jezyk.py; ostatnia
// linia wyjścia to JSON {checks:[[nazwa, ok, szczegół], …], braki:[…]}.
//  - słownik T (wycięty z zabi-chor.js) i RB_EN.T (js/jezyk-en.js): te same klucze, niepuste napisy, te same {zmienne},
//    te same klucze w obiektach zagnieżdżonych, ta sama długość list,
//  - osiągnięcia i kategorie (postepy.js), wbudowane piosenki (piosenki.js), motywy (motywy/*.js): każdy wpis ma EN,
//  - angielskie napisy bez polskich liter (poza nazwami własnymi z listy WYJATKI),
//  - wybór języka w js/jezyk.js (adres, zapis gry, język aplikacji, system, przeglądarka, automat) na atrapach,
//  - RBJezyk.blad tłumaczy komunikaty parsera MIDI i serwera, a nieznany tekst zostawia.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const GRY = path.join(REPO, "web", "gry", "js");
const czytaj = f => fs.readFileSync(path.join(GRY, f), "utf8");
const checks = [];
const ck = (n, ok, d) => checks.push([n, !!ok, d === undefined ? "" : String(d)]);
const PL_LITERY = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
// nazwy własne, które zostają po polsku także w EN: kanały serwera Discord i nazwa języka w przełączniku
const WYJATKI = ["#pochwal-się", "#pomysły", "Język", "Polski"];
const bezWyjatkow = s => WYJATKI.reduce((a, w) => a.split(w).join(""), String(s));

// ---- słowniki ----
const zc = czytaj("zabi-chor.js");
const iT = zc.indexOf("const T={"), jT = zc.indexOf("\nfunction tt(", iT);
const T = new Function(zc.slice(iT, jT) + ";return T;")();   // razem z nakładką EN (bez RBJezyk nic nie robi)
const ctxEn = {};
vm.createContext(ctxEn);
vm.runInContext(czytaj("jezyk-en.js") + ";this.RB_EN=RB_EN;", ctxEn);
const EN = ctxEn.RB_EN;
const zmienne = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(",");
const braki = [], puste = [], zleZmienne = [], zleZagniezdzone = [], nadmiar = [], polskie = [];
for (const [k, v] of Object.entries(T)) {
  if (!(k in EN.T)) { braki.push(k); continue; }
  const e = EN.T[k];
  if (Array.isArray(v)) {
    if (!Array.isArray(e) || e.length !== v.length || e.some(x => !String(x).trim())) zleZagniezdzone.push(k);
  } else if (v && typeof v === "object") {
    const a = Object.keys(v).sort().join(","), b = e && typeof e === "object" ? Object.keys(e).sort().join(",") : "";
    if (a !== b || Object.values(e).some(x => !String(x).trim())) zleZagniezdzone.push(k);
  } else {
    if (typeof e !== "string" || (!e.trim() && String(v).trim())) puste.push(k);
    else if (zmienne(v) !== zmienne(e)) zleZmienne.push(k + " (" + zmienne(v) + " / " + zmienne(e) + ")");
  }
  const tekst = typeof e === "string" ? e : JSON.stringify(e);
  if (PL_LITERY.test(bezWyjatkow(tekst))) polskie.push(k);
}
for (const k of Object.keys(EN.T)) if (!(k in T)) nadmiar.push(k);
ck("słownik: każdy klucz T (" + Object.keys(T).length + ") ma tłumaczenie w RB_EN.T", !braki.length, braki.join(", "));
ck("słownik: żadne tłumaczenie nie jest puste", !puste.length, puste.join(", "));
ck("słownik: tłumaczenia mają te same {zmienne} co polskie napisy", !zleZmienne.length, zleZmienne.join("; "));
ck("słownik: obiekty i listy (instrumenty, kolumny tablicy, boty) mają te same klucze i długości", !zleZagniezdzone.length, zleZagniezdzone.join(", "));
ck("słownik: RB_EN.T nie ma kluczy, których nie ma w T (literówki)", !nadmiar.length, nadmiar.join(", "));
ck("słownik: angielskie napisy bez polskich liter (poza nazwami własnymi)", !polskie.length, polskie.join(", "));
ck("słownik: liczba mnoga po angielsku ma dwie formy (klucze *2 i *5 równe)",
  ["partia", "nuta", "piosenka"].every(k => EN.T[k + "2"] === EN.T[k + "5"] && EN.T[k + "1"] !== EN.T[k + "2"]));

// ---- osiągnięcia, kategorie, piosenki, motywy ----
const ps = czytaj("postepy.js");
const osIds = [...ps.slice(ps.indexOf("const OSIAGNIECIA=["), ps.indexOf("const MAPA=")).matchAll(/\bid:"([^"]+)"/g)].map(m => m[1]);
const katIds = [...ps.slice(ps.indexOf("const KATEGORIE=["), ps.indexOf("const MIN_NUT")).matchAll(/\bid:"([^"]+)"/g)].map(m => m[1]);
const osBrak = osIds.filter(id => !(EN.osiagniecia[id] && EN.osiagniecia[id][0] && EN.osiagniecia[id][1]));
ck("osiągnięcia: każde z " + osIds.length + " ma angielską nazwę i opis", osIds.length >= 40 && !osBrak.length, osBrak.join(", "));
ck("osiągnięcia: każda z " + katIds.length + " kategorii ma angielską nazwę", katIds.length >= 7 && katIds.every(id => EN.kategorie[id]),
  katIds.filter(id => !EN.kategorie[id]).join(", "));
ck("osiągnięcia: angielskie nazwy i opisy bez polskich liter",
  !Object.values(EN.osiagniecia).flat().concat(Object.values(EN.kategorie)).some(s => PL_LITERY.test(s)));
const pio = czytaj("piosenki.js");
const wbIds = [...pio.slice(pio.indexOf("const BUILTIN=["), pio.indexOf("function parseBars(")).matchAll(/\{id:'([^']+)'/g)].map(m => m[1]);
const pioBrak = wbIds.filter(id => !EN.piosenki[id]);
ck("piosenki: każda z " + wbIds.length + " wbudowanych ma wpis RB_EN.piosenki (tytuł albo oryginał i podtytuł)",
  wbIds.length >= 19 && !pioBrak.length && wbIds.every(id => EN.piosenki[id][1]), pioBrak.join(", "));
ck("piosenki: angielskie tytuły i podtytuły bez polskich liter", !Object.values(EN.piosenki).flat().some(s => PL_LITERY.test(s)));
const motywyBez = fs.readdirSync(path.join(GRY, "motywy")).filter(f => f.endsWith(".js"))
  .filter(f => { const s = czytaj("motywy/" + f); return /Motywy\.dodaj\(/.test(s) && !/\ben:\s*(\{|Object\.assign)/.test(s); });
ck("motywy: każdy plik motywu podaje napisy po angielsku (pole en)", !motywyBez.length, motywyBez.join(", "));

// ---- wybór języka (jezyk.js) ----
const jz = czytaj("jezyk.js");
function jezyk({ q = "", zapis = null, apl = null, rfLang, sys, langs = ["pl-PL"], webdriver = false } = {}) {
  const ls = new Map();
  if (zapis) ls.set("ribbitflip.zabiChor.jezyk", JSON.stringify(zapis));
  if (apl) ls.set("ribbitflip.lang", apl);
  const html = { lang: "pl" };
  const ctx = {
    location: { search: q, href: "http://x/gry/" + q, reload() { ctx.przeladowano = true; }, replace(u) { ctx.przeladowano = u; } },
    localStorage: { getItem: k => ls.has(k) ? ls.get(k) : null, setItem: (k, v) => ls.set(k, String(v)) },
    navigator: { languages: langs, language: langs[0], webdriver },
    document: { documentElement: html }, URL, URLSearchParams, JSON, CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } },
    zdarzenia: [], przeladowano: false,
  };
  ctx.window = ctx; ctx.dispatchEvent = e => ctx.zdarzenia.push(e);
  if (rfLang) ctx.RIBBITFLIP_LANG = rfLang;
  if (sys) ctx.RIBBITFLIP_SYS_LANG = sys;
  vm.createContext(ctx);
  vm.runInContext(jz + ";this.RBJezyk=RBJezyk;", ctx);
  return { J: ctx.RBJezyk, ctx, html, ls };
}
// Domyślnie po polsku: głosują tylko jawne wybory (adres, gra/konto, kliknięcie w panelu);
// język Windows, przeglądarki i RIBBITFLIP_LANG z serwera (notuje też wykryty) nie zmieniają języka gry.
const przypadki = [
  ["przeglądarka po polsku → pl", {}, "pl"],
  ["przeglądarka po angielsku (osobny RibbitBeat.exe) → nadal pl", { langs: ["en-US"] }, "pl"],
  ["automat (navigator.webdriver) z en-US → pl", { langs: ["en-US"], webdriver: true }, "pl"],
  ["bez żadnej wskazówki → pl", { langs: [], webdriver: true }, "pl"],
  ["Windows po angielsku (RIBBITFLIP_SYS_LANG) → nadal pl", { sys: "en", langs: ["en-US"] }, "pl"],
  ["jawny wybór w panelu (ribbitflip.lang = en) przechodzi na grę", { apl: "en", sys: "pl" }, "en"],
  ["RIBBITFLIP_LANG z serwera (może być wykryty) nie głosuje", { rfLang: "en", sys: "en" }, "pl"],
  ["wybór w grze wygrywa, dopóki panel ma ten sam jawny wybór", { zapis: { jezyk: "en", aplikacja: "pl" }, apl: "pl" }, "en"],
  ["panel przełączony na en po wyborze pl w grze → en", { zapis: { jezyk: "pl", aplikacja: "pl" }, apl: "en" }, "en"],
  ["panel przełączony na pl po wyborze en w grze → pl", { zapis: { jezyk: "en", aplikacja: "en" }, apl: "pl" }, "pl"],
  ["wybór w grze bez aplikacji (RibbitBeat.exe) zostaje", { zapis: { jezyk: "en", aplikacja: null }, langs: ["pl-PL"] }, "en"],
  ["?jezyk=en w adresie wygrywa ze wszystkim", { q: "?jezyk=en", zapis: { jezyk: "pl", aplikacja: null }, apl: "pl" }, "en"],
  ["zepsuty zapis gry nie psuje startu (i nie przechodzi na język przeglądarki)", { zapis: "{", langs: ["en-GB"] }, "pl"],
];
const zleWybory = [];
for (const [nazwa, o, ma] of przypadki) { const { J, html } = jezyk(o); if (J.jezyk !== ma || html.lang !== ma) zleWybory.push(nazwa + ": " + J.jezyk + " (" + J.skad + ")"); }
ck("jezyk.js: wybór języka na starcie (" + przypadki.length + " przypadków) i <html lang> zgodny z językiem", !zleWybory.length, zleWybory.join("; "));
{
  const { J, ctx, ls } = jezyk({ apl: "pl" });
  J.ustaw("en");
  const z = JSON.parse(ls.get("ribbitflip.zabiChor.jezyk") || "null");
  ck("jezyk.js: ustaw('en') zapisuje {jezyk, aplikacja}, wysyła zdarzenie rb-jezyk i przeładowuje stronę",
    z && z.jezyk === "en" && z.aplikacja === "pl" && ctx.zdarzenia.length === 1 && ctx.zdarzenia[0].type === "rb-jezyk" &&
    ctx.zdarzenia[0].detail.jezyk === "en" && ctx.przeladowano === true, JSON.stringify([z, ctx.zdarzenia.length, ctx.przeladowano]));
  const b = jezyk({ q: "?jezyk=pl&auto=1" });
  b.J.ustaw("en");
  ck("jezyk.js: ustaw przy ?jezyk= w adresie usuwa ten parametr (inaczej wygrałby z zapisem)",
    typeof b.ctx.przeladowano === "string" && !/jezyk=/.test(b.ctx.przeladowano) && /auto=1/.test(b.ctx.przeladowano), b.ctx.przeladowano);
  const c = jezyk({});
  c.J.ustaw("pl");
  ck("jezyk.js: ustaw bieżącego języka nic nie robi", !c.ctx.przeladowano && !c.ctx.zdarzenia.length);
  ck("jezyk.js: loc i wybierz", c.J.loc === "pl-PL" && c.J.wybierz("a", "b") === "a" && c.J.wybierz({ pl: "a", en: "b" }) === "a" &&
    jezyk({ q: "?jezyk=en" }).J.wybierz("a", "b") === "b" && jezyk({ q: "?jezyk=en" }).J.loc === "en-US");
}
{
  const { J, ctx } = jezyk({ q: "?jezyk=en" });
  ctx.RB_EN = EN;
  vm.runInContext("var RB_EN=this.RB_EN;", ctx);
  const pary = [
    ["Nie znalazłem melodii w tym pliku", "I couldn't find a melody in this file"],
    ["To nie jest plik MIDI", "This is not a MIDI file"],
    ["dwa rejestry z przerwą 7 półtonów", "two registers with a gap of 7 semitones"],
    ["Plik jest za duży (12 MB), a pliki MIDI mają zwykle kilkadziesiąt KB.", "The file is too big (12 MB), and MIDI files are usually a few dozen KB."],
    ["HTTP 500", "HTTP 500"]];
  const zle = pary.filter(([pl, en]) => J.blad(pl) !== en).map(([pl]) => pl + " → " + J.blad(pl));
  ck("jezyk.js: RBJezyk.blad tłumaczy komunikaty parsera MIDI i serwera, nieznane zostawia", !zle.length, zle.join("; "));
  ck("jezyk.js: po polsku RBJezyk.blad nic nie zmienia", jezyk({}).J.blad("Nie znalazłem melodii w tym pliku") === "Nie znalazłem melodii w tym pliku");
}
console.log(JSON.stringify({ checks, braki }));
