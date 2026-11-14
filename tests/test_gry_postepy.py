# RibbitBeat (web/gry/): postępy graczy w wersji 2 („Sława”), drabinki czterech torów sceny i osiągnięcia.
# Run: py tests/test_gry_postepy.py   (-v: katalog osiągnięć, sława przykładowych gier, pomiar rysowań stopni)
#
# Co pilnuje (postepy.js, efekty.js, gl-fx.js i moduły efekty-*.js liczone w Node, w kontekście vm z atrapami przeglądarki
# i gry):
#  1. node --check plików; moduł toru, który jest, wczytuje się bez błędu (brakujący = SKIP, gra działa bez niego),
#  2. drabinki 4 × 30 motywów (10-17; 20 od 10-16, 15 od 10-10, 9 od 10-09) (motywy.js, 10-09): ta sama lista id na każdym torze w kolejności MOTYWY, nazwa, opis
#     i cecha po polsku bez pauz, progi rosnące; bez modułu zapasowa drabinka gry,
#  3. każdy stopień rysuje się na atrapie płótna (tryb 2D silnika) bez wyjątku, bez filter/shadowBlur, w budżecie rysowań
#     na klatkę (limit per tor i stan: pomiar 2026-10-04 + 30 % zapasu), także wariant spokojny,
#  4. gl-fx.js w Node (bez WebGL2) przechodzi w tryb 2D i każdy prymityw rysuje na atrapie (zaślepka = SKIP),
#  5. progi motywów z tabeli PROGI (10-15: 80 % po ok. 40 piosenkach, całość po ok. 70; było 32·i + 3,5·i²) z puli sławy (suma torów), poziom, prestiż po ostatnim co 500,
#  6. slawaZaGre tabelą przypadków (solo, chór, fragment, pierwsza gra dnia, seria, pakiet, nowy utwór i instrument, sufity),
#  7. katalog 53 osiągnięć (10-17; 43 do 10-16): unikalne id, opis po polsku bez pauz, poziom 1–5, w kategorii poziomy nie maleją, KAŻDE ma
#     przypadek „zdobyte” i „niezdobyte” (tabela PRZYPADKI; brak przypadku = FAIL), skrót wskazuje stopień z planu, a przy
#     module istniejący wpis o tym numerze i nazwie,
#  8. zapis: migracja v1 → v2 (sława z liczników i osiągnięć, wybór zostaje, reszta „auto”), wersja 2, obcy i zepsuty zapis,
#  9. odblokowania: próg albo skrót (nieciągłe), „auto” = najwyższy zdobyty, przypięcie tylko odblokowanego,
# 10. poGrze: sława przed/po/zyski i awanse, osiągnięcia raz, boty bez profilu, dwóch „Gości” = jedna gra (lepszy wiersz),
#     ×2 raz dziennie (fragment go nie zjada), seria ×1,1, nocny marek z godziny gry, pakiety, limit profili,
# 11. parametry adresu (?widownia=, ?odblokuj=1) nie zapisują się trwale,
# 12. kontrakt z grą i stroną: ZC_DISCORD = RF_INVITE_HEADER / RF_INVITE_SHOWCASE, odnośniki target=_blank rel=noopener,
#     kolejność skryptów, poGrze z pełną konfiguracją, nowe klucze słownika bez pauz,
# 13. zarządzanie profilami (10-10): lista, utworz, zmienNazwe (kolizja, Gość, kapsle idą za profilem), skład po zmianie,
#     przypięcie, kolor, wyzeruj, usun, Gość nietykalny, kapsel → profil (także z poGrze), limit 200 usuwa tylko puste
#     nieprzypięte profile, eksport → import scal / zastąp z raportem i błędami (zapis bez zmian).
# Brak Node = SKIP (nie udawane).
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GRY_JS = os.path.join(REPO, "web", "gry", "js")
MODULY = ["efekty-widownia.js", "efekty-streak.js", "efekty-tlo.js", "efekty-klawisze.js"]

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

_passed = 0
_failed = 0
_skipped = 0


def check(name, cond, detail=""):
    global _passed, _failed
    if cond:
        _passed += 1
        print("PASS  %s" % name)
    else:
        _failed += 1
        print("FAIL  %s   %s" % (name, detail))


def skip(name, powod=""):
    global _skipped
    _skipped += 1
    print("SKIP  %s%s" % (name, ("   " + powod) if powod else ""))


HARNESS = r"""
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
const GRY = process.argv[2], POMIAR = process.argv.includes("--pomiar");
const checks = [], skips = [], info = {};
const ck = (n, ok, d) => checks.push([n, !!ok, d === undefined ? "" : (typeof d === "string" ? d : JSON.stringify(d)).slice(0, 900)]);
const sk = (n, d) => skips.push([n, d || ""]);
const TORY = ["widownia", "streak", "tlo", "klawisze"];

// ---- motywy (10-09): ta sama drabinka na każdym torze; skróty osiągnięć wskazują id motywów ----
const MOTYWY = ["filc","8bit","halloween","komiks","podwodny","koncert","synthwave","szkicownik","kosmos",
  "staw","skatepark","garaz","wycinanka","sweter","sashiko",   // 10-10: runda 3, 15 motywów
  "piraci","western","disco","cyrk","tiki",                       // 10-16: runda 4, 20 motywów
  "kuchnia","szachy","voodoo","gielda","muchomor","zloto","olimp","kredki","prawdziwy","einstein",   // 10-17: runda 5, 30 motywów
  "kukielki"];                      // 10-19: runda 6, 31 motywów
const PLAN = { widownia: MOTYWY, streak: MOTYWY, tlo: MOTYWY, klawisze: MOTYWY };
// Budżet rysowań na klatkę (drawImage, fill, stroke, fillRect, strokeRect, fillText, strokeText; najwięcej z 3 klatek
// i stanów stopnia). Pomiar 2026-10-04 (py tests/test_gry_postepy.py -v --pomiar) + 30 % zapasu. Stany: widownia
// kombo / spoczynek / brawa / spokój; streak głowa + ślad + nuty przy ogniu 1–3 i tor(); tło rysuj2d + nadKartami + fx
// w trybie 2D silnika; klawisze tlo (raz) i gracz + fx (co klatkę).
const LIMITY = __LIMITY__;

// ---- atrapy przeglądarki: płótno liczy rysowania i pilnuje filter/shadowBlur ----
const licz = { rys: 0, zakazane: [] };
function plotno(w, h, liczy) {
  const cv = { width: w || 300, height: h || 150, style: {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }) };
  const stan = { globalAlpha: 1, globalCompositeOperation: "source-over", lineWidth: 1, font: "10px sans-serif" };
  const c = new Proxy({}, {
    get(_, k) {
      if (k === "canvas") return cv;
      if (k === "createLinearGradient" || k === "createRadialGradient" || k === "createConicGradient" || k === "createPattern") return () => ({ addColorStop() {} });
      if (k === "measureText") return t => ({ width: String(t).length * 7, actualBoundingBoxAscent: 7, actualBoundingBoxDescent: 2 });
      if (k === "getImageData") return (x, y, ww, hh) => ({ width: ww | 0, height: hh | 0, data: new Uint8ClampedArray(Math.max(4, Math.min(4e6, (ww | 0) * (hh | 0) * 4))) });
      if (k === "createImageData") return (ww, hh) => ({ width: ww | 0, height: hh | 0, data: new Uint8ClampedArray(Math.max(4, (ww | 0) * (hh | 0) * 4)) });
      if (k === "getTransform") return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      if (k === "isPointInPath") return () => false;
      if (["drawImage", "fill", "stroke", "fillRect", "strokeRect", "fillText", "strokeText", "putImageData"].includes(k))
        return () => { if (liczy) licz.rys++; };
      if (k in stan) return stan[k];
      if (k === "then") return undefined;
      return () => {};
    },
    set(_, k, v) { if (liczy && (k === "filter" && v !== "none" || k === "shadowBlur" && v > 0)) licz.zakazane.push(k); stan[k] = v; return true; }
  });
  cv.getContext = typ => typ === "2d" ? c : null;   // bez WebGL2: silnik idzie w tryb 2D
  cv.addEventListener = () => {}; cv.removeEventListener = () => {}; cv.setAttribute = () => {};
  return cv;
}
const obraz = { complete: true, naturalWidth: 96, naturalHeight: 96, width: 96, height: 96 };
const pamiec = {};
const nazwy = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","H"];
const ctx = {
  console, Math, Number, JSON, Array, Object, Map, Set, WeakMap, String, Date, Uint8ClampedArray, Uint8Array, Uint16Array, Float32Array,
  Int32Array, Error, TypeError, Infinity, NaN, parseInt, parseFloat, isFinite, Symbol, Proxy, Reflect, Boolean, RegExp, Promise,
  performance: { now: () => 12345 },
  document: { createElement: () => plotno(96, 96, false), getElementById: () => null, querySelector: () => null },
  localStorage: { getItem: k => (k in pamiec ? pamiec[k] : null), setItem: (k, v) => { pamiec[k] = String(v); }, removeItem: k => { delete pamiec[k]; } },
  location: { search: "" }, devicePixelRatio: 1,
  IMG: { zaby: [obraz, obraz, obraz, obraz, obraz], cicha: obraz, lisc: obraz, kapsle: {} },
  obrazGotowy: im => !!im && im.complete && im.naturalWidth > 0,
  bufor: (k, w, h, fn) => { fn(plotno(w, h, false).getContext("2d")); return { cv: obraz, w, h }; },
  blask: () => ({ cv: obraz, w: 96, h: 96 }), blysk: () => ({ cv: obraz, w: 24, h: 24 }),
  zabaNaklejka: () => ({ cv: obraz, w: 110, h: 110 }), jezykOgnia: () => ({ cv: obraz, w: 40, h: 60 }),
  rysujJezyk: c => c.drawImage(), rysujOgienGlowy: c => c.drawImage(), rysujSladPlonacyPkt: c => c.stroke(), rysujSpalenizneNuty: c => c.fill(),
  rysujOgienMiekki: c => c.fill(), dodajIskry: () => {}, dodajDym: () => {},
  szum1: x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f), h = k => { const v = Math.sin(k * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); }; return h(i) * (1 - u) + h(i + 1) * u; },
  rgba: (hex, a) => "rgba(0,0,0," + a + ")", napisNa: () => "#211f1d",
  wygladzEMA: (a, b, dt, tau) => a + (b - a) * (1 - Math.exp(-dt / Math.max(1e-6, tau))),
  isBlack: s => [1, 3, 6, 8, 10].includes(((s % 12) + 12) % 12), nameOf: s => nazwy[((s % 12) + 12) % 12],
  ySemi: (L, s) => L.gorna + (L.goraN - s + .5) * L.rh,
  mocStopnia: w => Math.min(1, ((w && +w.stopien) || 1) / 30),
};
ctx.xBeat = (L, b) => L.teraz + (b - ctx.S.gra.beat) * L.pxNaBeat;
ctx.prostokatKlawisza = (L, s) => ({ x: L.kx, y: ctx.ySemi(L, s) - L.rh / 2, w: L.kw, h: L.rh });
ctx.pozycjaZaby = (L, g) => ({ x: L.teraz - (g.nrWTorze || 0) * (L.krokX || 0), y: Math.max(L.y + L.zaba * .42, Math.min(L.y + L.h - L.zaba * .36, ctx.ySemi(L, g.polton))) });
ctx.rysujKlawiature = (c, L) => { c.fillRect(L.kx, L.gorna, L.kw, L.rzedy * L.rh); c.stroke(); };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
const run = (src, plik) => vm.runInContext(src, ctx, { filename: plik });

// geometria jednej klatki gry 1280×720 (dwa tory jeden nad drugim, widownia na dole) jak w ukladGry
const torL = (y, partia) => { const dolN = 55, goraN = 69, rzedy = goraN - dolN + 1, h = 280, gorna = y + 26, rh = (h - 26 - 10) / rzedy;
  return { tor: { gracze: [], styl: { akcent: "#ec1a83" }, zar: 3, partia, oceny: [], ogien: 3 }, x: 24, y, w: 1232, h, teraz: 296, pxNaBeat: 60,
    dolN, goraN, rzedy, rh, gorna, zaba: 70, krokX: 0, kx: 33, kw: 23 }; };
const TORY_L = [torL(64, 0), torL(356, 1)];
ctx.R = { dpr: 1, f: 1.15, W: 1280, H: 720, wersja: 1, bufor: new Map(), tory: TORY_L, st: null, iskry: [], dym: [], widownia: { y: 652, h: 68 },
  ct: plotno(1280, 720, true).getContext("2d"), cs: plotno(1280, 720, true).getContext("2d"), zarWid: 3 };
ctx.S = { gra: { beat: 12.4, bpm: 120, ogien: 3, metrum: 4, tory: TORY_L.map(L => L.tor), piosenka: { koniec: 64 } }, gracze: [], ust: { grafika: "pelna" },
  ekran: "gra", scena: {}, wyniki: null };
const stanKlatki = (o) => Object.assign({ W: 1280, H: 720, dpr: 1, teraz: 12345, ts: 12.345, dt: 1 / 60, beat: 12.4, faza: .4, bpm: 120, og: 3, zar: 3, kombo: 12,
  moc: 1, spokoj: false, bezRuchu: false, gl: false, wyniki: false, ap: 0, kolor: "#ec1a83", akcent: "#6cb33f",
  tory: TORY_L.map(L => ({ x: L.x, y: L.y, w: L.w, h: L.h, teraz: L.teraz })), widownia: { y: 652, h: 68 } }, o);

// ---- 1. wczytanie w kolejności strony (gl-fx, efekty, moduły torów, postepy) ----
const wczytane = {};
for (const plik of ["gl-fx.js", "efekty.js", "efekty-widownia.js", "efekty-streak.js", "efekty-tlo.js", "efekty-klawisze.js", "efekty-nuty.js", "motywy.js",
    ...MOTYWY.map(m => "motywy/" + m + ".js"), "postepy.js"]) {
  const p = path.join(GRY, plik);
  if (!fs.existsSync(p)) { if (/^efekty-/.test(plik)) sk("moduł " + plik + " (brak pliku: gra rysuje bez niego)"); else ck("plik " + plik + " istnieje", false); continue; }
  let blad = null;
  try { run(fs.readFileSync(p, "utf8") + "\n;globalThis.__ok=1;", plik); } catch (e) { blad = e.message; }
  wczytane[plik] = !blad;
  if (/^(efekty-|motywy)/.test(plik)) ck("moduł " + plik + " wczytuje się w Node bez wyjątku", !blad, blad);
  else if (blad) ck(plik + " wczytuje się w Node", false, blad);
}
run("globalThis.Efekty=typeof Efekty!=='undefined'?Efekty:null;globalThis.Postepy=typeof Postepy!=='undefined'?Postepy:null;" +
  "globalThis.EW=typeof EfektyWidownia!=='undefined'?EfektyWidownia:null;globalThis.ES=typeof EfektyStreak!=='undefined'?EfektyStreak:null;" +
  "globalThis.ET=typeof EfektyTlo!=='undefined'?EfektyTlo:null;globalThis.EK=typeof EfektyKlawisze!=='undefined'?EfektyKlawisze:null;");
const E = ctx.Efekty, P = ctx.Postepy, MOD = { widownia: ctx.EW, streak: ctx.ES, tlo: ctx.ET, klawisze: ctx.EK }, FX = ctx.FX;
P.ustawProgSekretow(0);   // 10-19: blokada sekretów do 35. odblokowanej rzeczy jest testowana osobno
const osiagWGrze = P.OSIAGNIECIA_AKTYWNE;   // nagrodami są tylko skórki i instrumenty: osiągnięcia w grze wyłączone
P.ustawOsiagniecia(true);   // uśpiona mechanika osiągnięć testowana dalej jak dotąd; wyłączenie sprawdza blok na końcu
ctx.mocStopnia = w => Math.min(1, ((w && +w.stopien) || 1) / 30);

// ---- 2. drabinki ----
const zModulem = t => !!(MOD[t] && Array.isArray(MOD[t].DRABINKA) && MOD[t].DRABINKA.length);
const pelny = (t, w) => t === "widownia" && typeof w.rysuj !== "function" ? Object.assign({}, E.widownia(w.id), w)
  : t === "streak" && typeof w.glowa !== "function" ? Object.assign({}, E.streak(w.id), w) : w;
const zlyOpis = s => !s || !/^[A-ZĄĆĘŁŃÓŚŹŻ0-9„]/.test(s) || !/[.!]$/.test(s) || /—/.test(s);
for (const t of TORY) {
  const d = P.drabinka(t);
  if (!zModulem(t)) {
    sk("drabinka „" + t + "”: " + PLAN[t].length + " stopni z modułu", "brak modułu; zapasowa drabinka gry ma " + d.length + " (widownia i streak = katalog efekty.js, tło i klawisze = jeden stopień)");
    ck("drabinka „" + t + "” bez modułu = zapas gry (katalog efekty.js albo jeden stopień 1)",
       t === "tlo" ? d.length === 1 && d[0].id === "kraft" : t === "klawisze" ? d.length === 1 && d[0].id === "papier" :
       d.length === (t === "widownia" ? E.WIDOWNIE.length : E.STREAKI.length) && d[0].stopien === 1, d.map(w => w.id));
    continue;
  }
  const ids = d.map(w => w.id), nr = d.map(w => +w.stopien);
  const N = PLAN[t].length;
  ck("drabinka „" + t + "”: " + N + " stopni 1.." + N + " po kolei, unikalne id", d.length === N && nr.every((n, i) => n === i + 1) && new Set(ids).size === N, { nr, ids });
  ck("drabinka „" + t + "”: id motywów w kolejności (10-09), bo osiągnięcia-skróty wskazują je po id", ids.join() === PLAN[t].join(),
     ids.map((id, i) => id === PLAN[t][i] ? "" : (i + 1) + ":" + id + "≠" + PLAN[t][i]).filter(Boolean));
  const opisy = d.filter(w => !w.nazwa || (w.opis != null || t === "tlo" || t === "klawisze") && zlyOpis(w.opis)).map(w => w.stopien + ":" + w.id);
  ck("drabinka „" + t + "”: każdy stopień ma nazwę, własny opis zdaniem po polsku bez pauz", opisy.length === 0, opisy);
  const bezCechy = d.filter(w => !w.cecha || typeof w.cecha !== "string" || w.cecha.length > 40).map(w => w.stopien + ":" + w.id);
  ck("drabinka „" + t + "”: każdy stopień ma `cecha` (krótka sygnatura, ≤ 40 znaków)", bezCechy.length === 0, bezCechy);
  ck("drabinka „" + t + "”: progi z pozycji rosną, pierwszy 0, ostatni = prog(MAKS_STOPIEN) ≤ 40000 (10-17: komplet w 3–5 h grania, nie dni)",
     d.every((w, i) => i === 0 ? P.progI(0) === 0 : P.progI(i) > P.progI(i - 1)) && P.progI(N - 1) === P.prog(P.MAKS_STOPIEN) && P.progI(N - 1) <= 40000 &&
     N === P.MAKS_STOPIEN && d.every(w => P.progWpisu(t, w.id) === P.progI(d.indexOf(w))), d.map((w, i) => P.progI(i)));
  if (t === "widownia" || t === "streak") {
    const kat = t === "widownia" ? E.WIDOWNIE : E.STREAKI;
    ck("drabinka „" + t + "”: wszystkie stopnie są w katalogu efekty.js po rejestracji (miniatury, okno „Scena”)",
       d.every(w => kat.some(x => x.id === w.id)), d.filter(w => !kat.some(x => x.id === w.id)).map(w => w.id));
  }
}

// ---- 3. rysowanie stopni na atrapie (tryb 2D silnika) ----
let fxKlatka = () => {};
if (FX && typeof FX.start === "function") {
  try { FX.start(null, { gl: false }); } catch (e) {}
  fxKlatka = (st, c) => { try { FX.klatka(st, c); } catch (e) {} };
}
const pomiar = {};
const mierz = (t, w, stan, fn) => {
  licz.rys = 0; licz.zakazane = [];
  let blad = null, maks = 0;
  for (let k = 0; k < 3; k++) {
    licz.rys = 0;
    try { fn(k); } catch (e) { blad = (e && e.message) || String(e); break; }
    maks = Math.max(maks, licz.rys);
  }
  const r = (pomiar[t] = pomiar[t] || {})[w.id] = (pomiar[t] || {})[w.id] || {};
  r[stan] = { rys: maks, zakazane: licz.zakazane.length, blad };
  return r[stan];
};
const Wd = { y: 652, h: 68 };
for (const t of TORY) {
  if (!zModulem(t)) { sk("rysowanie stopni toru „" + t + "” na atrapie", "brak modułu"); continue; }
  const d = P.drabinka(t);
  for (const w0 of d) {
    const w = pelny(t, w0);
    if (t === "widownia") {
      for (const [stan, o] of [["kombo", {}], ["spoczynek", { zar: 0, skok: 0, spiewaja: false, G: false }], ["brawa", { wyniki: true, ap: .8, G: false, zar: 0 }],
          ["spokoj", { spokoj: true, bezRuchu: true }]]) {
        mierz(t, w, stan, k => {
          const c = plotno(1280, 720, true).getContext("2d"), st0 = stanKlatki({ spokoj: !!o.spokoj, bezRuchu: !!o.bezRuchu, teraz: 12345 + k * 400 });
          ctx.R.st = st0; fxKlatka(st0, c);
          const st = E.stan(Object.assign({ W: 1280, teraz: 12345 + k * 400, G: true, fala0: 12000, wyniki: false, ap: 0, faza: 33.4 + k * .37, spiewaja: true, skok: .9, zar: 3,
            bezRuchu: false, spokoj: false, kolor: "#ec1a83", akcent: "#6cb33f", moc: ctx.mocStopnia(w), gl: false }, o), Wd);
          w.rysuj(c, Wd, st); if (w.fx) w.fx(st);
        });
      }
    } else if (t === "streak") {
      const pts = [...Array(180)].map((_, i) => ({ x: 40 + i * 1.6, y: 300 + Math.sin(i / 9) * 30, sp: i % 50 < 44 }));
      for (const og of [1, 2, 3]) mierz(t, w, "og" + og, k => {
        const c = plotno(1280, 720, true).getContext("2d");
        w.glowa(c, 60, og, 3.21 + k * .1, 7, false); w.glowa(c, 60, og, 3.58 + k * .1, 8, true);
        w.slad(c, { pts, og, ts: 3.21 + k * .1, x0: 40, xT: 330, dlug: 290, ziarno: 31, pelna: true, emituj: false, kolor: "#ec1a83" });
        w.nuty(c, 120, 18, 10, og, 3.21, 5, true, 1); w.nuty(c, 120, 18, 60, og, 3.21, 6, false, .4);
      });
      if (w.tor || w.zerwanie) for (const [stan, kombo] of [["tor-kombo", 24], ["tor-zero", 0]]) mierz(t, w, stan, k => {
        const c = plotno(1280, 720, true).getContext("2d"), L = TORY_L[0];
        const g = { id: "g" + k, kolor: "#ec1a83", nrWTorze: 0, kombo: kombo + k * 4, ogien: kombo ? 3 : 0, polton: 62 + k, spiewa: true, naNucie: true, slad: [], idxPod: 3, wib: 0, poz: .5, halo: 1, tor: L.tor };
        L.tor.gracze = [g]; const st = stanKlatki({ teraz: 12345 + k * 50, og: kombo ? 3 : 0, kombo: g.kombo, moc: ctx.mocStopnia(w) });
        ctx.R.st = st; fxKlatka(st, c);
        if (w.tor) w.tor(c, L, g, st);
        if (!kombo && w.zerwanie) w.zerwanie(L, Object.assign({}, g, { kombo: 0, _komboPop: 20 }), st);
      });
    } else if (t === "tlo") {
      for (const [stan, o] of [["og3", {}], ["og0", { og: 0, zar: 0, kombo: 0 }], ["spokoj", { spokoj: true, bezRuchu: true }]]) mierz(t, w, stan, k => {
        const c = plotno(1280, 720, true).getContext("2d"), st = stanKlatki(Object.assign({ teraz: 12345 + k * 333, moc: ctx.mocStopnia(w) }, o));
        ctx.R.st = st; fxKlatka(st, c);
        if (w.rysuj2d) w.rysuj2d(c, st); if (w.nadKartami) w.nadKartami(c, st); if (w.fx) w.fx(st);
      });
    } else {
      mierz(t, w, "tlo", k => { const c = plotno(1280, 720, true).getContext("2d"), st = stanKlatki({});
        for (const L of TORY_L) { if (w.tlo) w.tlo(c, L, st, ctx.rysujKlawiature); else ctx.rysujKlawiature(c, L); } });
      for (const [stan, o] of [["spiew", {}], ["cisza", { spiewa: false, naNucie: false, kombo: 0, ogien: 0 }], ["spokoj", {}]]) mierz(t, w, stan, k => {
        const c = plotno(1280, 720, true).getContext("2d"), L = TORY_L[k % 2];
        const g = Object.assign({ id: "k" + k, kolor: "#6cb33f", nrWTorze: 0, kombo: 12 + k, ogien: 3, polton: 60 + k * 2, spiewa: true, naNucie: k !== 1, slad: [], idxPod: 2, wib: 0, poz: .6, halo: 1, tor: L.tor }, o);
        L.tor.gracze = [g]; const st = stanKlatki({ teraz: 12345 + k * 120, spokoj: stan === "spokoj", bezRuchu: stan === "spokoj", moc: ctx.mocStopnia(w) });
        ctx.R.st = st; fxKlatka(st, c);
        if (w.gracz) w.gracz(c, L, g, st); if (w.fx) w.fx(L, g, st);
      });
    }
  }
  const zle = [], maks = {};
  for (const [id, stany] of Object.entries(pomiar[t] || {}))
    for (const [stan, r] of Object.entries(stany)) {
      maks[stan] = Math.max(maks[stan] || 0, r.rys);
      const lim = LIMITY[t] && LIMITY[t][stan];
      if (r.blad || r.zakazane || (lim != null && r.rys > lim)) zle.push(id + "/" + stan + ":" + (r.blad || (r.zakazane ? "filter/shadowBlur" : r.rys + ">" + lim)));
    }
  info["maks_" + t] = maks;
  ck("tor „" + t + "”: każdy z " + P.drabinka(t).length + " stopni rysuje się na atrapie w trybie 2D bez wyjątku, bez filter/shadowBlur, w budżecie rysowań " +
     JSON.stringify(LIMITY[t] || {}), zle.length === 0, zle.slice(0, 12));
}
info.pomiar = Object.fromEntries(Object.entries(pomiar).map(([t, v]) => [t, Object.fromEntries(Object.entries(v).map(([id, s]) => [id, Object.fromEntries(Object.entries(s).map(([k, r]) => [k, r.rys]))]))]));

// ---- 4. gl-fx.js w Node: tryb 2D i każdy prymityw ----
{
  const zrodlo = fs.existsSync(path.join(GRY, "gl-fx.js")) ? fs.readFileSync(path.join(GRY, "gl-fx.js"), "utf8") : "";
  if (!FX || /szkic API w trybie no-op/.test(zrodlo)) sk("gl-fx.js w Node: tryb 2D i prymitywy na atrapie", "zaślepka silnika");
  else {
    const c = plotno(1280, 720, true).getContext("2d"), wyn = {};
    let blad = null;
    try {
      ck("gl-fx.js w Node: brak WebGL2 = tryb 2D (FX.gotowy() === false)", FX.gotowy() === false, FX.gotowy());
      FX.uklad(1280, 720, 1); FX.klatka(stanKlatki({}), c);
      const prob = { sprite: () => FX.sprite(100, 100, 12, "#ec1a83", .8, 0, "kolo", "add"), blask: () => FX.blask(200, 200, 40, 20, [234, 163, 43], .6),
        pierscien: () => FX.pierscien(300, 300, 30, 3, "#6cb33f", .7, 1), luk: () => FX.luk(10, 10, 300, 200, 2, "#ffd84a", .9, 7, 20, 12),
        wstega: () => FX.wstega([{ x: 10, y: 10 }, { x: 100, y: 40 }, { x: 200, y: 20 }, { x: 300, y: 80 }], 6, "#294aa8", .2, .9), blysk: () => FX.blysk("#ffffff", .2) };
      for (const [k, f] of Object.entries(prob)) { licz.rys = 0; licz.zakazane = []; f(); wyn[k] = licz.zakazane.length ? -1 : licz.rys; }
      for (const ks of FX.KSZTALTY || []) { licz.rys = 0; FX.sprite(50, 50, 10, "#ec1a83", 1, .3, ks, "normal"); wyn["sprite-" + ks] = licz.rys; }
      FX.rysuj();
    } catch (e) { blad = e.message; }
    ck("gl-fx.js w Node: każdy prymityw (sprite we wszystkich kształtach, blask, pierscien, luk, wstega, blysk) rysuje w 2D na atrapie",
       !blad && Object.values(wyn).every(v => typeof v === "number" && v > 0), blad || wyn);
  }
}

// ---- 5. progi, poziom, prestiż ----
const PROGI = [0,300,670,1090,1570,2120,2710,3380,4090,4870,5710,6600,7560,8580,9650,10790,11980,13230,14540,15910,17340,18830,20370,21990,23640,25370,27160,29000,30900,32860,34880];
const PROGI_1016 = [0,100,220,370,540,730,950,1190,1450,1740,2050,2380,2740,3120,3520,3950,4750,5650,6600,7600];
const PROGI_1015 = [0,120,300,500,750,1000,1300,1700,2150,2700,3300,3950,5000,6300,7600];
ck("progI(i) z tabeli 10-17 wieczór (komplet w 3–5 h): 0, 300, 670 … 34880 (motyw 31), odstępy nigdy w dół; prog(k) = progI(k − 1); stare krzywe zostają do migracji",
   PROGI.every((v, i) => P.progI(i) === v && P.prog(i + 1) === v) && P.PROGI.join() === PROGI.join() && PROGI.every((v, i) => i < 2 || v - PROGI[i - 1] >= PROGI[i - 1] - PROGI[i - 2]) &&
   P.PROGI_V4.length === 30 && P.PROGI_V4[29] === 8300 && P.progIStary(14) === 1134 && P.progIStary(1) === 36,
   PROGI.map((_, i) => P.progI(i)));
{
  const kroki = PROGI.slice(1).map((v, i) => v - PROGI[i]);
  // 10-17 wieczór: krzywa „3–5 h” leży WYŻEJ niż poprzednie, więc zapis v4 przechodzi przez naWersje5: pula tym samym miejscem krzywej
  // (przeliczKrzywa), motywy planszy z progów v4 do ekipa.motywy; poprzednia krzywa zostaje w PROGI_V4 tylko do migracji
  ck("10-17: przeliczenie puli v4 → v5 zachowuje miejsce na krzywej (próg v4 → ten sam motyw v5, połowa odstępu → połowa), ponad ostatnim proporcjonalnie",
     P.PROGI_V4.every((v, i) => P.przeliczKrzywa(v, P.PROGI_V4, PROGI) === PROGI[i]) && P.przeliczKrzywa((P.PROGI_V4[3] + P.PROGI_V4[4]) / 2, P.PROGI_V4, PROGI) === Math.round((PROGI[3] + PROGI[4]) / 2) &&
     P.przeliczKrzywa(P.PROGI_V4[29] * 2, P.PROGI_V4, PROGI) === PROGI[29] * 2 && PROGI_1016.length === 20 && PROGI_1015.length === 15, "");
  ck("rytm progresji: odstępy między motywami nigdy nie maleją (każdy następny trochę dalej, bez skoku w dół)", kroki.every((k, i) => i === 0 || k >= kroki[i - 1]), kroki);
}
{   // 10-16: droga gracza: 41 instrumentów i 30 efektów (10-19; było 19) na jednej liście nagród z własnej puli
  const K = P.INSTRUMENTY_KOLEJNOSC, PI = P.PROGI_INSTRUMENTOW, d = P.drogaPelna(), pr = d.map(n => n.prog);
  ck("instrumenty: 41 różnych, na start sam Ribbit, progi rosną z kolejnością, „wszystko” otwiera całość",
     new Set(K).size === 41 && P.instrumentyZ(0, false).join() === "ribbit" && K.every((k, i) => i === 0 || PI[k] > PI[K[i - 1]]) &&
     P.instrumentyZ(0, true).length === 41 && P.instrumentyZ(99999, false).length === 41, PI);
  const typy = d.map(n => n.typ[0]).join("");
  ck("droga: 69 nagród (29 efektów bez sekretnego Prawdziwego stawu i 40 instrumentów) rosnąco po progu, efekt k na progu motywu k, między efektami 1–3 instrumenty (10-17)",
     d.length === 69 && d.filter(n => n.typ === "efekt").length === 29 && pr.every((v, i) => i === 0 || v >= pr[i - 1]) &&
     d.filter(n => n.typ === "efekt").every((n, j) => n.prog === P.progI(j + 1 + (j >= 27 ? 1 : 0))) && !/ee/.test(typy.replace(/ee$/, "e")) && !/iiii/.test(typy) && typy.startsWith("iii") && typy.endsWith("iee"), typy);
  ck("droga: instrumenty z 10-16 rano (stopnie efektu) nie przychodzą później niż wtedy; ostatni instrument przed dwoma ostatnimi efektami (10-19: Krzyk i Kukiełki dołożone na końcu)",
     [["trabka",2],["chor",2],["flet",3],["piano",4],["guitar",4],["smyczki",5],["bas",6],["organy",7],["syntezator",8],["epiano",9],["hawajska",10],["theremin",11]]
       .every(([i, s]) => PI[i] <= P.progI(s - 1)) && Math.max(...K.map(k => PI[k])) < P.progI(29), PI);
  // 10-18 (SCENY_Z_KOLA): sceny też z koła, więc poziomy to osobna krzywa PROGI_LOS (98 = 40 + 29 + 29 rzeczy); stara droga (68) zostaje do migracji
  const dl = P.droga(), pl = dl.map(n => n.prog), z0 = P.poziomGraczaZ(0), z1 = P.poziomGraczaZ(pl[pl.length - 1]), zp = P.poziomGraczaZ(pl[9]);
  const odst = pl.map((v, i) => v - (i ? pl[i - 1] : 0));
  ck("poziom gracza (koło, 10-18: sceny też z koła; 10-19 bez dubla): 1 na starcie, 99 po ostatnim progu (98 poziomów = 98 rzeczy, każda osobno), następny próg i progi od/do",
     P.SCENY_Z_KOLA === true && dl.length === 98 && P.drogaV5().length === 68 && z0.poziom === 1 && z0.maks === 99 && z0.nastepna && z0.do === z0.nastepna.prog &&
     z1.poziom === 99 && z1.nastepna === null && z1.do === null && zp.od === pl[9] && zp.poziom === 11, [z0, zp, z1]);
  ck("krzywa poziomów (10-19): pierwsze losowanie ok. 255 sławy (2–3 po pierwszej piosence), każdy odstęp nie mniejszy od poprzedniego, ostatni większy od pierwszego (krzywa lekko rosnąca, 10-19: spłaszczona), suma ok. 26 tys. sławy (symulacja „komplet w 3–5 h”)",
     pl[0] >= 200 && pl[0] <= 400 && odst.every((k, i) => i === 0 || k >= odst[i - 1] - 5) && odst[odst.length - 1] > odst[0] * 1.05 && pl[pl.length - 1] > 20000 && pl[pl.length - 1] < 38000, pl);
  ck("noweInstrumentyZ: między pulami (liczby), nic przy tej samej", P.noweInstrumentyZ(0, P.progI(1)).join() === "trabka,chor,flet" &&
     P.noweInstrumentyZ(P.progI(1), P.progI(1)).length === 0, P.noweInstrumentyZ(0, P.progI(1)));
}
ck("poziomSlawy: próg dokładnie = ten motyw, o 1 mniej = poprzedni, ponad ostatni = ostatni", P.poziomSlawy(0) === 1 && P.poziomSlawy(P.PROGI[1] - 1) === 1 && P.poziomSlawy(P.PROGI[1]) === 2 &&
   P.poziomSlawy(P.PROGI[27] - 1) === 27 && P.poziomSlawy(P.PROGI[27]) === 28 && P.poziomSlawy(999999) === 31, "");
{ const ost = P.PROGI[30];
ck("prestiż po ostatnim motywie: gwiazdka co 1500 sławy ponad jego próg (10-17, było 500)", P.prestizZ(ost - 1) === 0 && P.prestizZ(ost + 1499) === 0 && P.prestizZ(ost + 1500) === 1 &&
   P.prestizZ(ost + 3100) === 2 && P.PRESTIZ_CO === 1500, ""); }
{
  const z = P.poziomZ(400, "widownia"), d = P.drabinka("widownia");
  const N = d.length, k = [...Array(N).keys()].filter(i => P.progI(i) <= 400).pop();
  ck("poziomZ(400): motyw z puli sławy i próg następnego", z.stopien === k + 1 && z.od === P.progI(k) && z.do === (k + 1 < N ? P.progI(k + 1) : null) && z.wpis === d[k] && z.maks === N, z);
  ck("pula: slawaRazem sumuje cztery tory", P.slawaRazem({ widownia: 10, streak: 20, tlo: 30, klawisze: 40 }) === 100 && P.slawaRazem(null) === 0, "");
}

// ---- 6. sława za grę ----
const W0 = { nut: 80, czysto: 40, dobrze: 20, prawie: 10, falsz: 5, pudlo: 5, precyzja: 75, gwiazdki: 3, maxKombo: 10, punkty: 5000, premiaChoru: 0,
  klikiWRytm: 0, wibrata: 0, trudnosc: 3, liczbaGraczy: 1, liczbaLudzi: 1, wygralZMistrzem: false, instrument: "trabka", kapsel: false, tryb: "klasyczny",
  czasNaRuch: true, dlugoscSek: 90, piosenka: "oda", pakiet: false, pakietId: null, godzina: 14 };
const Wg = o => Object.assign({}, W0, o);
const L0 = P.nowyLiczniki(), Lz = o => Object.assign(P.nowyLiczniki(), o);
const znane = Lz({ utwory: { oda: 1 }, instrumenty: { trabka: 1 } });
const SLAWA = [
  // [opis, wynik, liczniki przed, kontekst, oczekiwane {tor: wartość} albo funkcja]
  ["solo, 90 s, 3 gwiazdki, nowy utwór i instrument", Wg({}), L0, {},
    { widownia: 14 + 0 + 3 + 5, streak: 4 + 5 + 10, tlo: 16 + 8 + 3, klawisze: 15 + 6 + 0 + 12 }],
  ["powtórka utworu na znanym instrumencie", Wg({}), znane, {}, { tlo: 6 + 3 }],
  ["chór: 4 żaby, 2 ludzi, premia chóru", Wg({ liczbaGraczy: 4, liczbaLudzi: 2, premiaChoru: 400 }), znane, {}, { widownia: 14 + 9 + 8 + 3 + 5 + 6 }],
  ["gracze ponad 8: najwyżej 3·7, minuty najwyżej 12", Wg({ liczbaGraczy: 12, dlugoscSek: 600 }), znane, {}, { widownia: 14 + 21 + 12 + 5 }],
  ["kombo: połowa najdłuższego (najwyżej 60), ogień 3 i całe kombo", Wg({ nut: 70, maxKombo: 70 }), znane, {}, { streak: 4 + 35 + 15 + 12 }],
  ["kombo 200: sufit 60 za długość", Wg({ nut: 300, maxKombo: 200 }), znane, {}, { streak: 4 + 60 + 15 }],
  ["kombo 7: ogień 1 (próg 4), bez ognia przy 3", Wg({ maxKombo: 7 }), znane, {}, { streak: 4 + 3 + 5 }],
  ["tło: pakiet, trudność 7,9, płynny, 3 minuty", Wg({ pakiet: true, pakietId: "basic", trudnosc: 7.9, tryb: "plynny", dlugoscSek: 185 }), znane, {},
    { tlo: 6 + 6 + 7 + 4 + 4, widownia: 14 + 9 + 5 }],
  ["tło: trudność ponad 10 przycięta do 10", Wg({ trudnosc: 12.5 }), znane, {}, { tlo: 6 + 10 }],
  ["klawisze: precyzja 100, 120 czystych, 45 klików, 5 gwiazdek, zero fałszów i pudeł",
    Wg({ precyzja: 100, czysto: 120, klikiWRytm: 45, gwiazdki: 5, falsz: 0, pudlo: 0 }), znane, {}, { klawisze: 20 + 15 + 10 + 20 + 6 }],
  ["fragment 19 nut: zero sławy na każdym torze (także z mnożnikiem)", Wg({ nut: 19 }), L0, { pierwszaDnia: true, seria: 5 },
    { widownia: 0, streak: 0, tlo: 0, klawisze: 0, mnoznik: 1 }],
  ["pierwsza gra dnia: ×2 na każdym torze", Wg({}), znane, { pierwszaDnia: true }, { widownia: 44, streak: 38, tlo: 18, klawisze: 66, mnoznik: 2 }],
  ["seria 3 dni: ×1,1 i w górę (22 → 25, 19 → 21, 9 → 10, 33 → 37)", Wg({}), znane, { seria: 3 }, { widownia: 25, streak: 21, tlo: 10, klawisze: 37 }],
  ["seria 2 dni: bez mnożnika", Wg({}), znane, { seria: 2 }, { widownia: 22, mnoznik: 1 }],
  ["oba mnożniki: ×2,2 w górę (streak 25 → 55, bo 25 × 2,2 w liczbach zmiennoprzecinkowych to 55,000…01; klawisze 11 → 25)",
    Wg({ maxKombo: 12, precyzja: 50, czysto: 6, gwiazdki: 0 }), znane, { pierwszaDnia: true, seria: 4 }, { streak: 55, klawisze: 25, mnoznik: 2.2 }],
];
for (const [opis, w, l, k, ocz] of SLAWA) {
  const s = P.slawaZaGre(w, l, k), zle = Object.entries(ocz).filter(([t, v]) => Math.abs((s[t] || 0) - v) > 1e-9);
  ck("slawaZaGre: " + opis, zle.length === 0, { wynik: { widownia: s.widownia, streak: s.streak, tlo: s.tlo, klawisze: s.klawisze, mnoznik: s.mnoznik }, ocz });
}
{
  const s = P.slawaZaGre(Wg({}), L0, {});
  ck("slawaZaGre: powody sumują się do sławy toru (bez mnożnika), każdy z torem i dodatnią wartością",
     TORY.every(t => s.powody.filter(p => p.tor === t).reduce((a, p) => a + p.ile, 0) === s[t]) && s.powody.every(p => TORY.includes(p.tor) && p.ile > 0), s.powody);
  const a = Wg({ maxKombo: 33, precyzja: 91 }), b = JSON.stringify(a);
  P.slawaZaGre(a, znane, { pierwszaDnia: true });
  ck("slawaZaGre nie zmienia wejścia (czysta funkcja)", JSON.stringify(a) === b, "");
}

// ---- 7. katalog osiągnięć ----
const O = P.OSIAGNIECIA, K = P.KATEGORIE.map(k => k.id);
ck("katalog: " + O.length + " osiągnięć (24 z toru C + 19 nowych + 10 skrótów rundy 5 + 1 skrót rundy 6) w " + new Set(O.map(o => o.kategoria)).size + " kategoriach",
   O.length === 54 && [...new Set(O.map(o => o.kategoria))].every(k => K.includes(k)), O.length);
ck("katalog: unikalne id", new Set(O.map(o => o.id)).size === O.length);
const zleOs = O.filter(o => !o.nazwa || zlyOpis(o.opis) || /—/.test(o.nazwa) || typeof o.warunek !== "function" || !(o.poziom >= 1 && o.poziom <= 5));
ck("katalog: nazwa, opis zdaniem po polsku bez pauz „—”, warunek-funkcja, poziom 1–5", zleOs.length === 0, zleOs.map(o => o.id));
ck("katalog: każde osiągnięcie ma dokładnie jeden skrót (tor nagrody) i sławę wg poziomu 40/90/180/320/500",
   O.every(o => TORY.filter(t => o.nagroda[t]).length === 1 && P.skrot(o).slawa === P.SLAWA_ZA_OSIAGNIECIE[o.poziom]) &&
   JSON.stringify(P.SLAWA_ZA_OSIAGNIECIE) === JSON.stringify({ 1: 40, 2: 90, 3: 180, 4: 320, 5: 500 }), O.filter(o => TORY.filter(t => o.nagroda[t]).length !== 1).map(o => o.id));
const zlaKolejnosc = K.filter(k => { const p = O.filter(o => o.kategoria === k).map(o => o.poziom); return p.length && (p.some((v, i) => i && v < p[i - 1]) || p[0] > 2); });
ck("w każdej kategorii poziomy nie maleją, pierwsze osiągnięcie łatwe (poziom ≤ 2)", zlaKolejnosc.length === 0, zlaKolejnosc);
// Skróty (10-09): każde osiągnięcie wskazuje motyw z listy; każdy motyw 2+ ma co najmniej jedno osiągnięcie-skrót.
const zleSkroty = O.filter(o => { const t = P.torNagrody(o); return !MOTYWY.includes(o.nagroda[t]) || o.nagroda[t] === MOTYWY[0] || o.cel; }).map(o => o.id);
ck("skróty: każde osiągnięcie wskazuje motyw 2+ (bez pola `cel`)", zleSkroty.length === 0, zleSkroty);
const bezSkrotu = MOTYWY.slice(1).filter(id => !O.some(o => Object.values(o.nagroda).includes(id)));
ck("skróty: każdy motyw 2+ ma osiągnięcie-skrót", bezSkrotu.length === 0, bezSkrotu);
const inst13 = Object.fromEntries(["trabka","ribbit","chor","smyczki","flet","organy","syntezator","theremin","piano","epiano","guitar","bas","hawajska"].map(k => [k, 1]));
const utw = n => Object.fromEntries([...Array(n)].map((_, i) => ["u" + i, 1]));
const PRZYPADKI = {
  "czyste-100": [[Lz({ czyste: 100 }), W0], [Lz({ czyste: 99 }), W0]],
  "celnosc-80": [[L0, Wg({ precyzja: 80 })], [L0, Wg({ precyzja: 79.9 })], [L0, Wg({ precyzja: 95, nut: 10 })]],
  "pudlo-0": [[L0, Wg({ nut: 30, pudlo: 0 })], [L0, Wg({ nut: 30, pudlo: 1 })], [L0, Wg({ nut: 29, pudlo: 0 })]],
  "celnosc-czysto": [[L0, Wg({ falsz: 0, pudlo: 0 })], [L0, Wg({ falsz: 0, pudlo: 1 })], [L0, Wg({ falsz: 0, pudlo: 0, nut: 30 })]],
  "czyste-1000": [[Lz({ czyste: 1000 }), W0], [Lz({ czyste: 999 }), W0]],
  "celnosc-90": [[L0, Wg({ precyzja: 90, trudnosc: 4.5 })], [L0, Wg({ precyzja: 90, trudnosc: 4.4 })], [L0, Wg({ precyzja: 89, trudnosc: 6 })]],
  "celnosc-95": [[L0, Wg({ nut: 40, precyzja: 95 })], [L0, Wg({ nut: 40, precyzja: 94.9 })], [L0, Wg({ nut: 39, precyzja: 100 })]],
  "celnosc-100": [[L0, Wg({ nut: 30, precyzja: 100 })], [L0, Wg({ nut: 30, precyzja: 99.9 })], [L0, Wg({ nut: 29, precyzja: 100 })]],
  "kombo-25": [[L0, Wg({ maxKombo: 25 })], [L0, Wg({ maxKombo: 24 })]],
  "kombo-50": [[L0, Wg({ maxKombo: 50 })], [L0, Wg({ maxKombo: 49 })]],
  "kombo-100": [[L0, Wg({ maxKombo: 100 })], [L0, Wg({ maxKombo: 99 })]],
  "kombo-150": [[L0, Wg({ maxKombo: 150 })], [L0, Wg({ maxKombo: 149 })]],
  "kombo-200": [[L0, Wg({ maxKombo: 200 })], [L0, Wg({ maxKombo: 199 })]],
  "kombo-cala": [[L0, Wg({ nut: 60, maxKombo: 60, trudnosc: 4.5 })], [L0, Wg({ nut: 60, maxKombo: 59, trudnosc: 5 })], [L0, Wg({ nut: 60, maxKombo: 60, trudnosc: 4 })], [L0, Wg({ nut: 40, maxKombo: 40, trudnosc: 6 })]],
  "gry-5": [[Lz({ gry: 5 }), W0], [Lz({ gry: 4 }), W0]],
  "gry-25": [[Lz({ gry: 25 }), W0], [Lz({ gry: 24 }), W0]],
  "dni-3": [[Lz({ dni: { ost: "2026-10-03", seria: 1, naj: 3 } }), W0], [Lz({ dni: { ost: "2026-10-03", seria: 2, naj: 2 } }), W0]],
  "gry-100": [[Lz({ gry: 100 }), W0], [Lz({ gry: 99 }), W0]],
  "dni-7": [[Lz({ dni: { ost: "2026-10-03", seria: 7, naj: 7 } }), W0], [Lz({ dni: { ost: "2026-10-03", seria: 6, naj: 6 } }), W0]],
  "dni-14": [[Lz({ dni: { ost: "2026-10-03", seria: 1, naj: 14 } }), W0], [Lz({ dni: { ost: "2026-10-03", seria: 13, naj: 13 } }), W0]],
  "razem-2": [[L0, Wg({ liczbaGraczy: 2 })], [L0, Wg({ liczbaGraczy: 1 })]],
  "razem-4": [[L0, Wg({ liczbaGraczy: 4 })], [L0, Wg({ liczbaGraczy: 3 })]],
  "razem-6": [[L0, Wg({ liczbaGraczy: 6 })], [L0, Wg({ liczbaGraczy: 5 })]],
  "razem-chor": [[L0, Wg({ premiaChoru: 120 })], [L0, Wg({ premiaChoru: 0 })]],
  "razem-8": [[L0, Wg({ liczbaGraczy: 8 })], [L0, Wg({ liczbaGraczy: 7 })]],
  "razem-mistrz": [[L0, Wg({ wygralZMistrzem: true })], [L0, Wg({ wygralZMistrzem: false })]],
  "pakiet-1": [[L0, Wg({ pakiet: true, pakietId: "basic" })], [L0, Wg({ pakiet: false })], [L0, Wg({ pakiet: true, nut: 19 })]],
  "utwory-10": [[Lz({ utwory: utw(10) }), W0], [Lz({ utwory: utw(9) }), W0]],
  "dlugi-3min": [[L0, Wg({ dlugoscSek: 180 })], [L0, Wg({ dlugoscSek: 179 })]],
  "utwory-25": [[Lz({ utwory: utw(25) }), W0], [Lz({ utwory: utw(24) }), W0]],
  "pakiety-3": [[Lz({ pakiety: { a: 1, b: 1, c: 1 } }), W0], [Lz({ pakiety: { a: 1, b: 1 } }), W0]],
  "utwory-50": [[Lz({ utwory: utw(50) }), W0], [Lz({ utwory: utw(49) }), W0]],
  "trudna-7": [[L0, Wg({ trudnosc: 7, gwiazdki: 3 })], [L0, Wg({ trudnosc: 6.9, gwiazdki: 5 })], [L0, Wg({ trudnosc: 9, gwiazdki: 2 })]],
  "trudna-9": [[L0, Wg({ trudnosc: 9 })], [L0, Wg({ trudnosc: 8.9 })], [L0, Wg({ trudnosc: 9.5, nut: 19 })]],
  "nocny": [[L0, Wg({ godzina: 0 })], [L0, Wg({ godzina: 5 })], [L0, Wg({ godzina: 23 })], [L0, Wg({ godzina: null })]],
  "klik-20": [[L0, Wg({ klikiWRytm: 20 })], [L0, Wg({ klikiWRytm: 19 })]],
  "wibrato-10": [[L0, Wg({ wibrata: 10 })], [L0, Wg({ wibrata: 9 })]],
  "instrumenty-13": [[Lz({ instrumenty: inst13 }), W0], [Lz({ instrumenty: Object.fromEntries(Object.keys(inst13).slice(0, 12).map(k => [k, 1])) }), W0]],
  "plynny-4": [[L0, Wg({ tryb: "plynny", gwiazdki: 4 })], [L0, Wg({ tryb: "plynny", gwiazdki: 3 })], [L0, Wg({ tryb: "klasyczny", gwiazdki: 5 })]],
  "klik-40": [[L0, Wg({ klikiWRytm: 40 })], [L0, Wg({ klikiWRytm: 39 })]],
  "bez-ruchu-4": [[L0, Wg({ czasNaRuch: false, gwiazdki: 4, trudnosc: 3 })], [L0, Wg({ czasNaRuch: true, gwiazdki: 5, trudnosc: 5 })], [L0, Wg({ czasNaRuch: false, gwiazdki: 4, trudnosc: 2.9 })]],
  "kapsel-1": [[L0, Wg({ kapsel: true })], [L0, Wg({ kapsel: false })]],
  "kapsel-4": [[L0, Wg({ kapsel: true, gwiazdki: 4 })], [L0, Wg({ kapsel: true, gwiazdki: 3 })], [L0, Wg({ kapsel: false, gwiazdki: 5 })]],
  // 10-17 (runda 5): skróty do nowych motywów
  "utwory-75": [[Lz({ utwory: Object.fromEntries(Array.from({ length: 75 }, (_, i) => ["u" + i, 1])) }), W0], [Lz({ utwory: Object.fromEntries(Array.from({ length: 74 }, (_, i) => ["u" + i, 1])) }), W0]],
  "plynny-5": [[L0, Wg({ tryb: "plynny", gwiazdki: 5 })], [L0, Wg({ tryb: "plynny", gwiazdki: 4 })], [L0, Wg({ tryb: "klasyczny", gwiazdki: 5 })]],
  "wibrato-25": [[L0, Wg({ wibrata: 25 })], [L0, Wg({ wibrata: 24 })]],
  "gry-200": [[Lz({ gry: 200 }), W0], [Lz({ gry: 199 }), W0]],
  "kombo-300": [[L0, Wg({ maxKombo: 300 })], [L0, Wg({ maxKombo: 299 })]],
  "czyste-2500": [[Lz({ czyste: 2500 }), W0], [Lz({ czyste: 2499 }), W0]],
  "dni-21": [[Lz({ dni: { ost: "", seria: 21, naj: 21 } }), W0], [Lz({ dni: { ost: "", seria: 20, naj: 20 } }), W0]],
  "instrumenty-26": [[Lz({ instrumenty: Object.fromEntries(Array.from({ length: 26 }, (_, i) => ["i" + i, 1])) }), W0], [Lz({ instrumenty: Object.fromEntries(Array.from({ length: 25 }, (_, i) => ["i" + i, 1])) }), W0]],
  "krzyk-1": [[Lz({ instrumenty: { krzyk: 1 } }), W0], [Lz({ instrumenty: { wokal: 1 } }), W0]],
  "celnosc-98": [[L0, Wg({ nut: 60, precyzja: 98 })], [L0, Wg({ nut: 60, precyzja: 97.9 })], [L0, Wg({ nut: 59, precyzja: 100 })]],
  "utwory-100": [[Lz({ utwory: Object.fromEntries(Array.from({ length: 100 }, (_, i) => ["u" + i, 1])) }), W0], [Lz({ utwory: Object.fromEntries(Array.from({ length: 99 }, (_, i) => ["u" + i, 1])) }), W0]],
};
const bezPrzypadku = O.filter(o => !PRZYPADKI[o.id]).map(o => o.id);
ck("każde osiągnięcie ma przypadki testowe", bezPrzypadku.length === 0, bezPrzypadku);
for (const o of O) {
  const p = PRZYPADKI[o.id]; if (!p) continue;
  const [tak, ...nie] = p, wynTak = o.warunek(tak[0], tak[1]), wynNie = nie.map(([l, w]) => o.warunek(l, w));
  ck("warunek „" + o.id + "”: zdobyte w przypadku granicznym, niezdobyte tuż obok (" + nie.length + ")", wynTak && wynNie.every(x => !x), { wynTak, wynNie });
  if (o.prog) {
    const cel = o.prog.cel, pusty = o.prog.wartosc(P.nowyLiczniki());
    ck("pasek postępu „" + o.id + "”: 0 na starcie, cel " + cel, pusty === 0 && cel > 0, { pusty, cel });
  }
}
{
  const l = P.dodajGre(P.nowyLiczniki(), Wg({ maxKombo: 37, precyzja: 88.7, gwiazdki: 4, klikiWRytm: 12, kapsel: true, instrument: "flet", piosenka: "oda", czysto: 40, dobrze: 20,
    wibrata: 3, pakiet: true, pakietId: "basic", tryb: "plynny", godzina: 2 }), "2026-10-03");
  ck("dodajGre: gry, rekordy, kapsel, instrument, utwór, czyste, wibrata (suma), pakiety, tryby, gry nocne, dzień",
     l.gry === 1 && l.najKombo === 37 && l.najPrecyzja === 88 && l.najKlik === 12 && l.kapselGry === 1 && l.instrumenty.flet && l.utwory.oda && l.czyste === 40 &&
     l.trafione === 60 && l.wibrata === 3 && l.pakiety.basic === 1 && l.tryby.plynny === 1 && l.nocne === 1 && l.dni.naj === 1, l);
  const l2 = P.dodajGre(l, Wg({ maxKombo: 3, nut: 10, precyzja: 100, wibrata: 2, godzina: 14 }), "2026-10-03");
  ck("dodajGre: rekordy nie spadają, krótka partia nie liczy się do precyzji, wibrata się sumują, dzienna gra nie jest nocna", l2.najKombo === 37 && l2.najPrecyzja === 88 &&
     l2.dni.seria === 1 && l2.gry === 2 && l2.wibrata === 5 && l2.nocne === 1, l2);
  ck("dodajGre nie zmienia wejścia (czysta funkcja)", l.gry === 1 && l.najKombo === 37 && l.wibrata === 3, l);
}
{
  let d = { ost: "", seria: 0, naj: 0 };
  d = P.seriaDni(d, "2026-12-30"); d = P.seriaDni(d, "2026-12-31"); d = P.seriaDni(d, "2027-01-01");
  const trzy = Object.assign({}, d);
  d = P.seriaDni(d, "2027-01-03");
  ck("seria dni: 30.12 → 31.12 → 1.01 = 3 z rzędu (przez Nowy Rok), przerwa zeruje serię, najlepsza zostaje", trzy.seria === 3 && trzy.naj === 3 && d.seria === 1 && d.naj === 3, { trzy, d });
}

// ---- 8. zapis i migracja ----
const pusty = s => s && s.wersja === P.WERSJA && Object.keys(s.profile).length === 0 && s.ekipa && s.ekipa.slawa === 0 && Object.keys(s.ekipa.motywy).length === 0 &&
  s.ekipa.wybor === "auto" && s.ekipa.wszystko === null;
ck("migracja: brak zapisu, nieznana wersja, śmieci → pusty stan wersji 11 (z pustą ekipą; 10-18: sceny z koła)",
   pusty(P.migruj(null)) && pusty(P.migruj({ wersja: 0, profile: { a: {} } })) && pusty(P.migruj({ wersja: P.WERSJA + 1, profile: { a: {} } })) && pusty(P.migruj("x")) &&
   pusty(P.migruj({ wersja: 1, profile: null })) && P.WERSJA === 11, "");
const v1 = { wersja: 1, profile: { oczko: { nazwa: "Oczko", liczniki: { gry: 10, kapselGry: 2, najKombo: 40, utwory: { a: 1, b: 1, c: 1 }, instrumenty: { trabka: 1, flet: 1 },
  najPrecyzja: 85, najKlik: 12, najGwiazdki: 4, dni: { ost: "2026-10-02", seria: 2, naj: 3 } }, osiagniecia: { "gry-5": "2026-10-01T10:00:00Z", "razem-2": "x", "kombo-25": "y" },
  wybor: { widownia: "glosniki" }, ostatnio: 5 }, zly: null } };
const mig = P.migruj(v1), mo = mig.profile.oczko;
ck("migracja v1 → v2: sława z liczników (widownia 18·gry + 4·kapsel, streak 3·kombo + 8·gry, tło 14·utwory + 8·instrumenty + 4·gry, klawisze 2·precyzja + 2·klik + 8·gry + 20·gwiazdki) plus osiągnięcia",
   mo && mo.slawa.widownia === 180 + 8 + 40 + 40 && mo.slawa.streak === 120 + 80 + 40 && mo.slawa.tlo === 42 + 16 + 40 && mo.slawa.klawisze === 170 + 24 + 80 + 80, mo && mo.slawa);
ck("migracja v1 → v6: wybór widowni zostaje, streak, tło i klawisze „auto”; osiągnięcia, liczniki i nazwa bez zmian; zepsuty wpis odpada",
   mig.wersja === P.WERSJA && mo.wybor.widownia === "glosniki" && mo.wybor.streak === "auto" && mo.wybor.tlo === "auto" && mo.wybor.klawisze === "auto" &&
   mo.osiagniecia["gry-5"] === "2026-10-01T10:00:00Z" && mo.liczniki.gry === 10 && mo.liczniki.pakiety && mo.nazwa === "Oczko" && !mig.profile.zly, mig);
// 10-10: ekipa (pula planszy) odtwarza się z profili: suma sławy wszystkich, motywy planszy ze skrótów już zdobytych
// („Rozgrzewka” gry-5 i „Duet” razem-2 → widownia Komiks; „Kombo 25” → streak 8-bit, czyli efekt, nie plansza)
ck("migracja v1/v2 → v5: ekipa.slawa = suma sławy profili (przeliczona na krzywą 10-17), ekipa.motywy = motywy planszy ze skrótów (Komiks z gry-5, nie 8-bit ze streaka), wybór „auto”",
   mig.ekipa && mig.ekipa.slawa === P.przeliczKrzywa(P.slawaRazem(mo.slawa), P.PROGI_V4, P.PROGI) && Object.keys(mig.ekipa.motywy).filter(id => !/^progi-v/.test(mig.ekipa.motywy[id])).join() === "komiks" &&
   mig.ekipa.motywy.komiks === "2026-10-01T10:00:00Z" && mig.ekipa.wybor === "auto" && mig.ekipa.wszystko === null, mig.ekipa);
// 10-15: nowa krzywa nie zabiera odblokowań: plansza i efekty z zapisu ≤ 3 mają co najmniej tyle, ile dawała stara krzywa
{
  const s = P.slawaRazem(mo.slawa), ileStary = d => d.filter((w, i) => i === 0 || P.progIStary(i) <= s).length;
  const dP = P.drabinka(P.TOR_PLANSZY), dG = P.drabinka(P.TOR_GRACZA);
  const planszaPo = P.odblokowanePlanszyZ(mig.ekipa, false), efektyPo = P.odblokowaneZ(mo, false)[P.TOR_GRACZA];
  ck("migracja do v4: zachowane odblokowania starej krzywej (plansza w ekipa.motywy jako „progi-v3”, efekty w profil.zachowane), nowe progi ich nie zamykają",
     ileStary(dP) > 2 && planszaPo.length >= ileStary(dP) && efektyPo.length >= ileStary(dG) && mo.zachowane && Object.keys(mo.zachowane).length > 0 &&
     Object.values(mig.ekipa.motywy).includes("progi-v3"), { s, planszaPo, efektyPo, zach: mo.zachowane });
  const m4 = P.migruj(JSON.parse(JSON.stringify(mig)));
  ck("zapis v11 czyta się bez ponownej migracji: zachowane zostają, nic nie dochodzi", m4.wersja === P.WERSJA && JSON.stringify(m4.profile.oczko.zachowane) === JSON.stringify(mo.zachowane) &&
     JSON.stringify(m4.ekipa.motywy) === JSON.stringify(mig.ekipa.motywy), m4.ekipa.motywy);
  const nowyGracz = P.migruj({ wersja: 4, profile: { ala: { nazwa: "Ala", slawa: { widownia: 1134 } } } });
  ck("zapis v4 z tą samą sławą NIE dostaje starych odblokowań (zachowane tylko przy przejściu z ≤ 3)", !nowyGracz.profile.ala.zachowane &&
     P.odblokowaneZ(nowyGracz.profile.ala, false)[P.TOR_GRACZA].length === P.PROGI.filter(v => v <= 1134).length, nowyGracz.profile.ala);
}
const m3 = P.migruj({ wersja: 3, profile: { oczko: { nazwa: "Oczko", slawa: { widownia: 10 } }, ala: { nazwa: "Ala", slawa: { streak: 5 } } },
  ekipa: { slawa: 999.4, motywy: { kosmos: "2026-10-05T00:00:00Z", 7: 3 }, wybor: "kosmos", wszystko: "2026-10-06T00:00:00Z" } });
ck("wersja 3: ekipa z zapisu oczyszczona (sława zaokrąglona, motywy jako teksty, wybór i „wszystko” zostają), nie przeliczana z profili",
   m3.ekipa.slawa === P.przeliczKrzywa(999, P.PROGI_V4, P.PROGI) && m3.ekipa.motywy.kosmos === "2026-10-05T00:00:00Z" && m3.ekipa.motywy["7"] === "3" && m3.ekipa.wybor === "kosmos" &&
   m3.ekipa.wszystko === "2026-10-06T00:00:00Z", m3.ekipa);
const m3b = P.migruj({ wersja: 3, profile: { oczko: { nazwa: "Oczko", slawa: { widownia: 10 }, osiagniecia: { "razem-6": "x" } } }, ekipa: "zepsuta" });
ck("wersja 3 bez poprawnej ekipy: ekipa odtworzona z profili (suma 10, Synthwave z „Pełnej sali”)",
   m3b.ekipa.slawa === P.przeliczKrzywa(10, P.PROGI_V4, P.PROGI) && Object.keys(m3b.ekipa.motywy).join() === "synthwave", m3b.ekipa);
const m2 = P.migruj({ wersja: 2, profile: { oczko: { nazwa: "Oczko", slawa: { widownia: 77.6, streak: -5, tlo: "x" }, wybor: { widownia: "neon", tlo: 7 }, liczniki: { gry: 3 } } } });
ck("wersja 2: sława zaokrąglona i nieujemna, zły wybór = „auto”, brakujące pola domyślne",
   m2.profile.oczko.slawa.widownia === 78 && m2.profile.oczko.slawa.streak === 0 && m2.profile.oczko.slawa.tlo === 0 && m2.profile.oczko.slawa.klawisze === 0 &&
   m2.profile.oczko.wybor.widownia === "neon" && m2.profile.oczko.wybor.tlo === "auto" && m2.profile.oczko.liczniki.gry === 3 && m2.profile.oczko.liczniki.najKombo === 0, m2);
pamiec[P.KLUCZ] = JSON.stringify(v1); P.przeladuj();
ck("zapis v1 w localStorage czyta się jako v2 (sława przeliczona), a przy odczycie nic się nie zapisuje", P.profil("Oczko").slawa.widownia === 268 &&
   JSON.parse(pamiec[P.KLUCZ]).wersja === 1, pamiec[P.KLUCZ].slice(0, 80));
pamiec[P.KLUCZ] = "{zepsuty json"; P.przeladuj();
ck("zepsuty JSON w localStorage: profil czyta się jak nowy, wybór = stopień 1 każdego toru", P.profil("Oczko").liczniki.gry === 0 &&
   TORY.every(t => P.wybor("Oczko")[t] === (P.drabinka(t)[0] || {}).id), P.wybor("Oczko"));
ck("nazwa profilu: bot = brak, mysz/klawiatura/pad bez nazwy = „Gość”, wpisana nazwa (bez spacji), kapsel = jego nazwa",
   P.nazwaProfilu({ zrodlo: "bot", nazwa: "Kumak" }) === null && P.nazwaProfilu({ zrodlo: "mysz", nazwa: "Mysz" }) === "Gość" &&
   P.nazwaProfilu({ zrodlo: "pad", nazwa: "Pad 1" }) === "Gość" && P.nazwaProfilu({ zrodlo: "mysz", nazwa: "  Oczko ", nazwaWlasna: true }) === "Oczko" &&
   P.nazwaProfilu({ zrodlo: "kapsel", nazwa: "Kapsel 2" }) === "Kapsel 2" && P.kluczProfilu("Oczko") === P.kluczProfilu(" OCZKO "), "");

// ---- 9. odblokowania, auto, przypięcie, skróty ----
const prof = (slawa, os) => ({ slawa: Object.assign({ widownia: 0, streak: 0, tlo: 0, klawisze: 0 }, slawa), osiagniecia: os || {} });
{
  const d = P.drabinka("widownia"), o0 = P.odblokowaneZ(prof({}), false);
  ck("pusty profil: na każdym torze tylko stopień 1", TORY.every(t => o0[t].length === 1 && o0[t][0] === P.drabinka(t)[0].id), o0);
  const p3 = P.progI(2), o1 = P.odblokowaneZ(prof({ widownia: p3 }), false), o1m = P.odblokowaneZ(prof({ widownia: p3 - 1 }), false);
  ck("próg puli: dokładnie próg motywu 3 = motywy 1–3 na KAŻDYM torze, o 1 mniej = 1–2", TORY.every(t => o1[t].join() === d.slice(0, 3).map(w => w.id).join() &&
     o1m[t].join() === d.slice(0, 2).map(w => w.id).join()), [p3, o1.widownia, o1m.streak]);
  const pula = P.odblokowaneZ(prof({ widownia: 100, streak: 120, tlo: 60, klawisze: 20 }), false), pulaM = P.odblokowaneZ(prof({ widownia: 100, streak: 120, tlo: 60, klawisze: 19 }), false);
  ck("pula: sława z różnych torów sumuje się (100+120+60+20 = 300 = próg motywu 2 od 10-17 wieczór, o 1 mniej = sam pierwszy)", TORY.every(t => pula[t].join() === "filc,8bit" && pulaM[t].join() === "filc"), pula);
  const wszystko = P.odblokowaneZ(prof({}), true);
  ck("?odblokuj=1: cała drabinka każdego toru", TORY.every(t => wszystko[t].length === P.drabinka(t).length), "");
  if (zModulem("widownia")) {
    const sk6 = P.odblokowaneZ(prof({ widownia: 30 }, { "razem-6": "x" }), false);
    ck("skrót z osiągnięcia odblokowuje nieciągle i na wszystkich torach: sława 30 + „Pełna sala” = Filc i Synthwave", TORY.every(t => sk6[t].join() === "filc,synthwave"), sk6);
  } else sk("skrót nieciągły na widowni (stopień 8)", "brak modułu widowni");
  if (zModulem("tlo")) {
    const skT = P.odblokowaneZ(prof({}, { "nocny": "x", "pakiet-1": "y" }), false);
    ck("skróty: „Z pakietu” = 8-bit, „Nocny marek” = Halloween, bez sławy, na każdym torze",
       TORY.every(t => skT[t].join() === "filc,8bit,halloween"), skT);
  } else sk("skróty tła (3) i klawiszy (11)", "brak modułu tła");
}
{
  for (const k of Object.keys(pamiec)) delete pamiec[k]; P.przeladuj(); P.ustawDev({});
  const sklad = [{ id: "mysz", nazwa: "Test", nazwaWlasna: true, zrodlo: "mysz", instrument: "flet" }];
  const w1 = { id: "mysz", punkty: 5000, oceny: { czysto: 50, dobrze: 10, prawie: 0, falsz: 0, pudlo: 0 }, nut: 60, precyzja: 92, gwiazdki: 4, maxKombo: 60,
    premiaChoru: 0, kliki: { idealnie: 10, dobrze: 5 }, trudnosc: { ocena: 4 }, wibrata: 2 };
  for (let i = 0; i < 6; i++) P.poGrze(sklad, [w1], { piosenka: "u" + i, dlugoscSek: 200, tryb: "klasyczny", czasNaRuch: true, liczbaGraczy: 1, data: "2026-10-0" + (1 + (i % 3)) + "T12:00:00" });
  const odb = P.odblokowane("Test"), wyb = P.wybor("Test"), E = P.ekipa();
  ck("„auto”: każdy tor bierze najwyższy odblokowany stopień; tory planszy = motyw ekipy, streak = efekt profilu",
     TORY.every(t => wyb[t] === odb[t][odb[t].length - 1]) && P.stopien("Test", "widownia") >= 2 && P.stopien("Test", "streak") >= 2 &&
     P.TORY_PLANSZY.every(t => wyb[t] === E.motyw && odb[t].join() === E.odblokowane.join()) && E.slawa >= P.slawaRazem(P.profil("Test").slawa) &&
     E.jestAuto && E.odblokowane.every((id, i) => i === 0 || E.motywy[id]), { wyb, odb, E });   // 10-18: sceny bez progów (pierwsza + skróty / koło)
  // efekt (tor gracza): przypięcie w profilu
  const niski = odb.streak[0];
  P.wybierz("Test", { streak: niski });
  ck("przypięcie niższego efektu: zostaje, zapisane w profilu, przełącznik „auto” wyłączony", P.wybor("Test").streak === niski &&
     JSON.parse(pamiec[P.KLUCZ]).profile.test.wybor.streak === niski, P.profil("Test").wybor);
  const zabl = P.drabinka("streak").map(w => w.id).find(id => !odb.streak.includes(id));
  if (zabl) {
    P.wybierz("Test", { streak: zabl });
    ck("przypięcie zablokowanego efektu nie zapisuje się", P.profil("Test").wybor.streak === niski, P.profil("Test").wybor);
  }
  P.wybierz("Test", { streak: "auto" });
  ck("„auto” wraca do najwyższego efektu", P.wybor("Test").streak === odb.streak[odb.streak.length - 1] && P.profil("Test").wybor.streak === "auto", "");
  // plansza (ekipa): jeden wybór dla wszystkich, w zapisie ekipy, nie profilu; przez wybierzMotyw albo wybierz z torem planszy
  const niskiP = E.odblokowane[0], zablP = P.drabinka("tlo").map(w => w.id).find(id => !E.odblokowane.includes(id));
  P.wybierzMotyw(niskiP);
  ck("plansza: przypięcie niższego motywu zapisuje się w ekipie (nie w profilu) i wchodzi na trzy tory każdego profilu",
     P.ekipa().motyw === niskiP && !P.ekipa().jestAuto && JSON.parse(pamiec[P.KLUCZ]).ekipa.wybor === niskiP && JSON.parse(pamiec[P.KLUCZ]).profile.test.wybor.tlo === "auto" &&
     P.TORY_PLANSZY.every(t => P.wybor("Test")[t] === niskiP && P.wybor("Ktoś inny")[t] === niskiP), P.ekipa());
  if (zablP) { P.wybierzMotyw(zablP); ck("plansza: zablokowany motyw nie zapisuje się", P.ekipa().motyw === niskiP, P.ekipa()); }
  P.wybierz("Test", { tlo: "auto" });
  ck("plansza: wybierz(nazwa, {tlo:…}) idzie do ekipy, „auto” wraca do najwyższego", P.ekipa().jestAuto && P.ekipa().motyw === E.odblokowane[E.odblokowane.length - 1] &&
     JSON.parse(pamiec[P.KLUCZ]).ekipa.wybor === "auto", P.ekipa());
  // „wszystko” (ukryty kod): wszystkie motywy i efekty do wyboru, zapis, „auto” nadal najwyższy ZDOBYTY; cofnięcie
  const kon = P.odblokujWszystko(true, "Test");
  ck("odblokujWszystko: zapis ekipa.wszystko (data), raport z liczbą nowych motywów planszy i efektów, pełne drabinki do wyboru, „auto” bez zmian",
     kon.wszystko && !kon.bylo && kon.noweMotywy === P.drabinka("tlo").length - E.odblokowane.length && kon.noweEfekty === P.drabinka("streak").length - odb.streak.length &&
     /^\d{4}-/.test(JSON.parse(pamiec[P.KLUCZ]).ekipa.wszystko) && P.ekipa().odblokowane.length === P.drabinka("tlo").length &&
     P.odblokowane("Test").streak.length === P.drabinka("streak").length && P.odblokowane("Nowy").streak.length === P.drabinka("streak").length &&
     P.ekipa().motyw === E.motyw && P.wybor("Test").streak === odb.streak[odb.streak.length - 1], { kon, E: P.ekipa() });
  if (zablP) { P.wybierzMotyw(zablP); ck("po kodzie przypięcie dotąd zablokowanego motywu działa", P.ekipa().motyw === zablP, P.ekipa().motyw); }
  const kon2 = P.odblokujWszystko(true, "Test");
  ck("drugi raz: raport „było” bez nowych", kon2.bylo && kon2.noweMotywy === 0 && kon2.noweEfekty === 0, kon2);
  P.odblokujWszystko(false);
  ck("cofnięcie: zapis bez „wszystko”, przypięty zablokowany motyw wraca do „auto” (najwyższy zdobyty), lista jak przed kodem",
     JSON.parse(pamiec[P.KLUCZ]).ekipa.wszystko === null && P.ekipa().motyw === E.motyw && P.ekipa().odblokowane.join() === E.odblokowane.join() &&
     P.lista().find(x => x.klucz === "test").efekty === odb.streak.length, P.ekipa());
  P.wybierzMotyw("auto");
  // ?odblokuj=1 i parametry adresu
  const przed = JSON.stringify(Object.assign({}, JSON.parse(pamiec[P.KLUCZ]).profile.test, { wybor: null, ostatnio: null }));
  P.ustawDev({ widownia: "czaszki", streak: "kwas", tlo: "ocean", klawisze: "zloto", odblokuj: true });
  const sesja = P.odblokowane("Test"), wybS = P.wybor("Test");
  ck("?widownia= ?streak= ?tlo= ?klawisze= nie zmieniają wyboru profilu (wymusza je gra), ?odblokuj=1 nie zmienia „auto”",
     TORY.every(t => wybS[t] === wyb[t]) && P.dev.tlo === "ocean" && P.dev.odblokuj === true, { wybS, wyb });
  const ostatni = P.drabinka("streak")[P.drabinka("streak").length - 1].id;
  P.wybierz("Test", { streak: ostatni });
  const poSesji = JSON.parse(pamiec[P.KLUCZ]).profile.test;
  ck("?odblokuj=1: wszystko do wyboru w sesji, przypięcie działa, a osiągnięcia, liczniki i sława w zapisie bez zmian",
     sesja.streak.length === P.drabinka("streak").length && P.wybor("Test").streak === ostatni &&
     JSON.stringify(Object.assign({}, poSesji, { wybor: null, ostatnio: null })) === przed, { przed: przed.slice(0, 200) });
  P.ustawDev({}); P.przeladuj();
  ck("bez ?odblokuj (nowa sesja): przypięty zablokowany stopień wraca do „auto”", P.wybor("Test").streak === odb.streak[odb.streak.length - 1] || P.odblokowane("Test").streak.includes(ostatni), P.wybor("Test"));
}

// ---- 10. poGrze ----
for (const k of Object.keys(pamiec)) delete pamiec[k]; P.przeladuj(); P.ustawDev({});
const sklad = [{ id: "mysz", nazwa: "Test", nazwaWlasna: true, zrodlo: "mysz", instrument: "flet" },
  { id: "bot-1", nazwa: "Kumak", zrodlo: "bot", poziom: "mistrz", instrument: "trabka" }];
const wiersz = (id, o) => Object.assign({ id, punkty: 5000, oceny: { czysto: 30, dobrze: 10, prawie: 2, falsz: 1, pudlo: 2 }, nut: 45, precyzja: 88.9, gwiazdki: 3,
  maxKombo: 26, premiaChoru: 0, kliki: { idealnie: 3, dobrze: 2 }, trudnosc: { ocena: 2.4 }, wibrata: 1 }, o);
const konf = { piosenka: "oda", dlugoscSek: 95, tryb: "klasyczny", czasNaRuch: true, liczbaGraczy: 2, data: "2026-10-03T12:00:00" };
let wynik = P.poGrze(sklad, [wiersz("mysz", { punkty: 6000 }), wiersz("bot-1", { punkty: 5500 })], konf);
const pierwszy = wynik.find(x => x.id === "mysz");
ck("poGrze: „Test” zdobywa Duet, Pogromcę Mistrza, Celne ucho i Rozgrzewkę; bot nie ma wpisu",
   pierwszy.nowe.map(o => o.id).sort().join() === "celnosc-80,kombo-25,razem-2,razem-mistrz" && wynik.length === 1, wynik.map(x => x.nowe.map(o => o.id)));
const sl = pierwszy.slawa, oczGra = P.slawaZaGre(P.wynikGracza(sklad[0], wiersz("mysz", { punkty: 6000 }), Object.assign({}, konf, { godzina: 12 }),
  [{ r: wiersz("mysz", { punkty: 6000 }), gracz: sklad[0] }, { r: wiersz("bot-1"), gracz: sklad[1] }]), P.nowyLiczniki(), { pierwszaDnia: true, seria: 1 });
ck("poGrze: sława za grę ×2 (pierwsza gra dnia) + za osiągnięcia do torów skrótów; po = przed + zyski",
   sl.mnoznik === 2 && TORY.every(t => sl.zaGre[t] === oczGra[t] && sl.po[t] === sl.przed[t] + sl.zyski[t]) &&
   sl.zyski.widownia === oczGra.widownia + 40 + 320 && sl.zyski.streak === oczGra.streak + 90 + 40 && sl.zyski.tlo === oczGra.tlo, { sl, oczGra });
const ek = pierwszy.ekipa, losE = JSON.parse(pamiec[P.KLUCZ]).ekipa.los;
// 10-17 (WSPOLNE): wkład do puli ekipy = sława za grę × mnożnik długości + sława za osiągnięcia; solo średnia z jednego = on sam
const wkl = (s, dl) => P.slawaRazem(s.zaGre) * P.mnoznikDlugosci(dl) + (P.slawaRazem(s.zyski) - P.slawaRazem(s.zaGre));
ck("poGrze (koło, 10-16; wspólne 10-17): poziom daje losowanie, nie konkretną rzecz: awanse i nowe instrumenty puste, losowania.nowe = przyrost poziomu EKIPY, koło w ekipie, nie w profilu",
   sl.awanse.length === 0 && sl.noweInstrumenty.length === 0 && sl.losowania.nowe === P.poziomGraczaZ(ek.po).poziom - P.poziomGraczaZ(ek.przed).poziom + 1 &&   // +1: losowanie na start dla nowej ekipy
   sl.losowania.wolne === P.losowania("Test") && !P.profil("Test").los && losE && losE.uzyte === 0 && losE.bonus === 1 && P.losowania("Ktokolwiek") === P.losowania("Test"), sl);
ck("poGrze: ekipa (pula planszy) rośnie o zyski profilu, BEZ awansu „plansza” (10-18: scena tylko z koła), motywy ze skrótów planszy tej gry (Komiks z „Duetu”, Dziki Zachód z „Pogromcy Mistrza” od 10-16; 8-bit ze streaka nie)",
   ek && ek.przed === 0 && ek.po === Math.round(wkl(sl, konf.dlugoscSek)) && ek.zysk === ek.po && ek.wspolne === true && ek.ludzie === 1 && ek.mnoznikGraczy === 1 && ek.awanse.length === 0 &&
   ek.noweMotywy.slice().sort().join() === "komiks,western" &&
   P.ekipa().slawa === ek.po && P.ekipa().odblokowane.includes("western") && P.ekipa().odblokowane.includes("komiks"), ek);
const nowy = pierwszy.nowe.find(o => o.id === "razem-mistrz");
ck("poGrze: nowe osiągnięcie niesie skrót (tor, id, numer, nazwa motywu) i sławę", nowy && nowy.nagroda.tor === "widownia" && nowy.nagroda.id === "western" &&
   nowy.nagroda.nazwa === "Dziki Zachód" && nowy.nagroda.slawa === 320 && nowy.nagroda.stopien === P.drabinka("widownia").find(w => w.id === "western").stopien, nowy);
const zap = JSON.parse(pamiec[P.KLUCZ]);
ck("poGrze zapisuje wersję 6: profil „test” ze sławą, wyborem „auto”, datą ISO przy osiągnięciu, bez profilu bota; ekipa z sławą i motywami planszy",
   zap.wersja === P.WERSJA && Object.keys(zap.profile).join() === "test" && /^2026-10-03T/.test(zap.profile.test.osiagniecia["razem-2"]) && zap.profile.test.liczniki.gry === 1 &&
   zap.profile.test.slawa.widownia === sl.po.widownia && TORY.every(t => zap.profile.test.wybor[t] === "auto") &&
   zap.ekipa.slawa === ek.po && /^2026-10-03T/.test(zap.ekipa.motywy.western) && zap.ekipa.wybor === "auto", zap.profile.test);
wynik = P.poGrze(sklad, [wiersz("mysz", { punkty: 6000 }), wiersz("bot-1", { punkty: 5500 })], Object.assign({}, konf, { data: "2026-10-03T18:00:00" }));
ck("poGrze: druga gra tego dnia bez ×2, bez nowych osiągnięć, licznik gier 2, powtórka utworu w tle",
   wynik[0].nowe.length === 0 && wynik[0].slawa.mnoznik === 1 && P.profil("Test").liczniki.gry === 2 && wynik[0].slawa.zaGre.tlo === 6 + 2, wynik[0].slawa);
ck("poGrze: druga gra dokłada do ekipy tylko zyski (bez nowych motywów), wpis ekipy w pierwszym wierszu",
   wynik[0].ekipa && wynik[0].ekipa.przed === ek.po && wynik[0].ekipa.zysk === Math.round(wkl(wynik[0].slawa, konf.dlugoscSek)) && wynik[0].ekipa.noweMotywy.length === 0 &&
   P.ekipa().slawa === wynik[0].ekipa.po, wynik[0].ekipa);
{   // 10-17 (WSPOLNE): dwa profile w jednej grze: pula ekipy = ŚREDNIA wkładów × 1,25 (nie suma), odblokowania wspólne, sława profili osobno
  const dwoje = [{ id: "a", nazwa: "Oczko", nazwaWlasna: true, zrodlo: "mysz" }, { id: "b", nazwa: "Kumak", nazwaWlasna: true, zrodlo: "ws" }];
  const przedE = P.ekipa().slawa, w2 = P.poGrze(dwoje, [wiersz("a", { maxKombo: 3 }), wiersz("b", { maxKombo: 60, precyzja: 99 })], Object.assign({}, konf, { data: "2026-10-05T12:00:00" }));
  const zE = w2.filter(x => x.ekipa), sr = w2.reduce((a, x) => a + wkl(x.slawa, konf.dlugoscSek), 0) / 2, oczek = Math.round(sr * 1.25);
  ck("poGrze: dwa profile = ekipa rośnie o średnią wkładów ×1,25 (wpis ekipy raz, mnożnik i liczba ludzi w nim), odblokowania i losowania wspólne",
     zE.length === 1 && zE[0].ekipa.przed === przedE && zE[0].ekipa.zysk === oczek && P.ekipa().slawa === przedE + oczek && zE[0].ekipa.mnoznikGraczy === 1.25 && zE[0].ekipa.ludzie === 2 &&
     P.slawaRazem(P.profil("Kumak").slawa) > P.slawaRazem(P.profil("Oczko").slawa) && P.odblokowane("Kumak").streak.join() === P.odblokowane("Oczko").streak.join() &&
     P.instrumenty("Kumak").join() === P.instrumenty("Oczko").join() && P.losowania("Kumak") === P.losowania("Oczko") && P.wybor("Oczko").tlo === P.wybor("Kumak").tlo, { zE, oczek });
  ck("mnożnik graczy (10-17): 1 / 1,25 / 1,4 / 1,5 i dalej 1,5; mnożnik długości: 60 s = 1, krótka piosenka mniej, długa więcej, granice 0,5–3",
     [1, 2, 3, 4, 8].map(P.mnoznikGraczy).join() === "1,1.25,1.4,1.5,1.5" && P.mnoznikDlugosci(60) === 1 && P.mnoznikDlugosci(20) === .6 && P.mnoznikDlugosci(160) === 2 &&
     P.mnoznikDlugosci(5) === .5 && P.mnoznikDlugosci(900) === 3 && P.mnoznikDlugosci(0) === 1, "");
}
// fragment nie zjada premii dnia
for (const k of Object.keys(pamiec)) delete pamiec[k]; P.przeladuj();
wynik = P.poGrze(sklad.slice(0, 1), [wiersz("mysz", { nut: 12, maxKombo: 3 })], Object.assign({}, konf, { liczbaGraczy: 1, data: "2026-10-04T10:00:00" }));
const poFragmencie = P.poGrze(sklad.slice(0, 1), [wiersz("mysz")], Object.assign({}, konf, { liczbaGraczy: 1, data: "2026-10-04T11:00:00" }));
ck("fragment (12 nut): zero sławy, a pierwsza pełna piosenka tego dnia dalej ma ×2", TORY.every(t => wynik[0].slawa.zaGre[t] === 0) && poFragmencie[0].slawa.mnoznik === 2,
   { frag: wynik[0].slawa.zaGre, po: poFragmencie[0].slawa.mnozniki });
// seria ×1,1
for (const k of Object.keys(pamiec)) delete pamiec[k]; P.przeladuj();
let ser = null;
for (const d of ["2026-10-01", "2026-10-02", "2026-10-03"]) ser = P.poGrze(sklad.slice(0, 1), [wiersz("mysz")], Object.assign({}, konf, { liczbaGraczy: 1, data: d + "T20:00:00" }));
ck("trzeci dzień z rzędu: ×2 (pierwsza gra dnia) i ×1,1 (seria 3 dni) = ×2,2, plakietki w kolejności dzień, seria",
   Math.abs(ser[0].slawa.mnoznik - 2.2) < 1e-9 && ser[0].slawa.mnozniki.map(m => m.id + (m.dni || "")).join() === "dzien,seria3" &&
   !!P.profil("Test").osiagniecia["dni-3"], ser[0].slawa.mnozniki);
// nocny marek z godziny gry, pakiety
for (const k of Object.keys(pamiec)) delete pamiec[k]; P.przeladuj();
const noc = P.poGrze(sklad.slice(0, 1), [wiersz("mysz")], Object.assign({}, konf, { liczbaGraczy: 1, data: "2026-10-04T01:30:00", pakiet: true, pakietId: "basic" }));
ck("gra o 1:30 z pakietu: „Nocny marek” (skrót do motywu Halloween) i „Z pakietu” (8-bit), licznik nocnych gier i pakietów, premia tła za pakiet",
   noc[0].nowe.some(o => o.id === "nocny" && o.nagroda.tor === "klawisze" && o.nagroda.id === "halloween") && noc[0].nowe.some(o => o.id === "pakiet-1") &&
   P.profil("Test").liczniki.nocne === 1 && P.profil("Test").liczniki.pakiety.basic === 1 && noc[0].slawa.zaGre.tlo >= 2 * (16 + 8 + 6), noc[0]);
const dzien = P.poGrze(sklad.slice(0, 1), [wiersz("mysz")], Object.assign({}, konf, { liczbaGraczy: 1, data: "2026-10-04T12:00:00", godzina: 3 }));
ck("godzina z konfiguracji wygrywa nad datą (gra liczy ją sama); bez pakietu i w tym samym dniu tło = powtórka 6 + trudność 2", P.profil("Test").liczniki.nocne === 2 &&
   dzien[0].slawa.zaGre.tlo === 8 && dzien[0].slawa.mnoznik === 1, { l: P.profil("Test").liczniki.nocne, s: dzien[0].slawa });
// dwóch Gości
for (const k of Object.keys(pamiec)) delete pamiec[k]; P.przeladuj();
const goscie = [{ id: "mysz", nazwa: "Mysz", zrodlo: "mysz" }, { id: "ws", nazwa: "W/S", zrodlo: "ws" }];
wynik = P.poGrze(goscie, [wiersz("mysz", { maxKombo: 3, precyzja: 99 }), wiersz("ws", { maxKombo: 51, precyzja: 40 })], Object.assign({}, konf, { liczbaGraczy: 2 }));
const gA = P.slawaZaGre(P.wynikGracza(goscie[0], wiersz("mysz", { maxKombo: 3, precyzja: 99 }), Object.assign({}, konf, { godzina: 12 }), []), P.nowyLiczniki(), { pierwszaDnia: true, seria: 1 });
const gB = P.slawaZaGre(P.wynikGracza(goscie[1], wiersz("ws", { maxKombo: 51, precyzja: 40 }), Object.assign({}, konf, { godzina: 12 }), []), P.nowyLiczniki(), { pierwszaDnia: true, seria: 1 });
ck("dwóch „Gości” w jednej grze: jedna gra profilu, rekord z lepszego, sława toru z lepszego wiersza, wynik raz (drugi wiersz bez sławy i nowych)",
   P.profil("Gość").liczniki.gry === 1 && P.profil("Gość").liczniki.najKombo === 51 && wynik.length === 2 && wynik[1].nowe.length === 0 && wynik[1].slawa === null &&
   wynik[0].slawa.zaGre.streak === Math.max(gA.streak, gB.streak) && wynik[0].slawa.zaGre.klawisze === Math.max(gA.klawisze, gB.klawisze) &&
   wynik[0].nowe.some(o => o.id === "kombo-50"), { w: wynik[0].slawa.zaGre, gA, gB });
{
  // 10-10: limit 200 usuwa po cichu tylko profile bez postępu (najdawniej użyte), nigdy grające, przypięte, kapsli i Gościa
  for (let i = 0; i < 45; i++) P.poGrze([{ id: "m", nazwa: "Gracz " + i, nazwaWlasna: true, zrodlo: "mysz" }], [wiersz("m")], konf);
  ck("limit profili: 45 grających profili zostaje (dawniej po cichu odchodziło 5 ponad 40)", Object.keys(JSON.parse(pamiec[P.KLUCZ]).profile).length === 46 &&
     P.MAKS_PROFILI === 200, Object.keys(JSON.parse(pamiec[P.KLUCZ]).profile).length);
}
for (const k of Object.keys(pamiec)) delete pamiec[k]; P.przeladuj();
P.poGrze(sklad, [wiersz("mysz", { punkty: 6000 }), wiersz("bot-1", { punkty: 5500 })], konf);
ck("postepOsiagniecia: zdobyte = 1, liczbowe = wartość/cel, nieliczbowe niezdobyte = 0, nieznane = 0",
   P.postepOsiagniecia("Test", "razem-2") === 1 && Math.abs(P.postepOsiagniecia("Test", "gry-5") - .2) < 1e-9 && P.postepOsiagniecia("Test", "dlugi-3min") === 0 &&
   P.postepOsiagniecia("Test", "nie-ma") === 0 && Math.abs(P.postepOsiagniecia("Test", "kombo-50") - 26 / 50) < 1e-9, "");
ck("zrodloStylu(tor, id): kłódka stopnia wie, które osiągnięcie jest skrótem (pierwsze z katalogu, gdy jest kilka)", P.zrodloStylu("widownia", "synthwave").id === "razem-6" &&
   P.zrodloStylu("streak", "kosmos").id === "kombo-150" && P.zrodloStylu("klawisze", "halloween").id === "nocny" && P.zrodloStylu("klawisze", "filc") === null &&
   P.zrodloStylu("tlo", "halloween").id === "nocny", "");
ck("wynikGracza: wibrata, pakiet tylko z id, godzina z konfiguracji, liczba ludzi ze składu",
   (() => { const w = P.wynikGracza(sklad[0], wiersz("mysz", { wibrata: 7 }), Object.assign({}, konf, { pakiet: true, pakietId: "x", godzina: 2 }),
     [{ r: wiersz("mysz"), gracz: sklad[0] }, { r: wiersz("bot-1"), gracz: sklad[1] }]);
     return w.wibrata === 7 && w.pakiet === true && w.pakietId === "x" && w.godzina === 2 && w.liczbaLudzi === 1; })(), "");

// ---- 13. zarządzanie profilami (10-10, okno „Profile”, js/profile.js) ----
{
  const wyczysc = () => { for (const k of Object.keys(pamiec)) delete pamiec[k]; P.przeladuj(); P.ustawDev({}); };
  const zap = () => JSON.parse(pamiec[P.KLUCZ] || "{}");
  const sk1 = [{ id: "mysz", nazwa: "Oczko", nazwaWlasna: true, zrodlo: "mysz", instrument: "flet" }];
  const k1g = Object.assign({}, konf, { liczbaGraczy: 1 });
  wyczysc();
  P.poGrze(sk1, [wiersz("mysz")], k1g);
  const u1 = P.utworz("  Kumak "), u2 = P.utworz("kumak"), u3 = P.utworz("   "), u4 = P.utworz("gość"), u5 = P.utworz("Bardzo długa nazwa profilu 123");
  ck("utworz: nowy profil (nazwa bez spacji), ta sama nazwa inną wielkością liter i „Gość” = zajęta, pusta = odmowa, nazwa najwyżej 18 znaków",
     u1.ok && u1.nazwa === "Kumak" && !!zap().profile.kumak && !u2.ok && u2.powod === "zajeta" && !u3.ok && u3.powod === "pusta" && !u4.ok && u4.powod === "zajeta" &&
     u5.ok && u5.nazwa.length === 18, [u1, u2, u3, u4, u5]);
  const L = P.lista(), oczko = L.find(x => x.klucz === "oczko"), gosc = L.find(x => x.gosc);
  ck("lista: Oczko po grze (sława, motywy x/31, osiągnięcia x/54, gry, ostatnio), Kumak pusty, Gość zawsze (choć bez zapisu)",
     !!oczko && oczko.gry === 1 && oczko.slawa > 0 && oczko.motywy >= 1 && oczko.motywyZ === 31 && oczko.osiagnieciaZ === 54 && oczko.osiagniecia >= 1 && oczko.ostatnio > 0 && oczko.postep &&
     L.find(x => x.klucz === "kumak").gry === 0 && !!gosc && !gosc.zapisany && gosc.nazwa === "Gość" && L[0].klucz === "oczko", L.map(x => x.klucz));
  const z1 = P.zmienNazwe("Oczko", "Kumak"), z2 = P.zmienNazwe("Oczko", " "), z3 = P.zmienNazwe("Gość", "Gracz"), z4 = P.zmienNazwe("Nikt", "X"), z5 = P.zmienNazwe("Oczko", "gość");
  ck("zmienNazwe: kolizja z innym profilem, pusta nazwa, Gość, brak profilu, nowa nazwa „Gość” = odmowa, zapis bez zmian",
     !z1.ok && z1.powod === "zajeta" && !z2.ok && z2.powod === "pusta" && !z3.ok && z3.powod === "gosc" && !z4.ok && z4.powod === "brak" && !z5.ok && z5.powod === "zajeta" &&
     zap().profile.oczko.nazwa === "Oczko", [z1, z2, z3, z4, z5]);
  P.przypiszKapsel("kap-7", "Oczko");
  const przed = JSON.stringify(Object.assign({}, zap().profile.oczko, { nazwa: null }));
  const z6 = P.zmienNazwe("oczko", "Agawa");
  ck("zmienNazwe: profil z całym postępem pod nowym kluczem, stary klucz znika, kapsel idzie za profilem",
     z6.ok && z6.klucz === "agawa" && z6.staryKlucz === "oczko" && !zap().profile.oczko && zap().profile.agawa.nazwa === "Agawa" &&
     JSON.stringify(Object.assign({}, zap().profile.agawa, { nazwa: null })) === przed && zap().kapsle["kap-7"] === "agawa" && P.kapsel("kap-7") === "Agawa", z6);
  const z7 = P.zmienNazwe("agawa", "AGAWA");
  ck("zmienNazwe: sama wielkość liter = ten sam klucz, nowa pisownia", z7.ok && z7.klucz === "agawa" && zap().profile.agawa.nazwa === "AGAWA", z7);
  const sklad0 = { wersja: 1, gracze: [{ zrodlo: "mysz", partia: 0, nazwa: "agawa" }, { zrodlo: "ws", partia: 1, nazwa: "Kumak" }, { zrodlo: "bot", partia: 0, poziom: "sredni" }] };
  const s1 = P.skladPoZmianie(sklad0, "Agawa", "Oczko"), s2 = P.skladPoZmianie(sklad0, "kumak", null);
  ck("skladPoZmianie: wpis składu ze starą nazwą dostaje nową, przy usunięciu profilu traci nazwę, reszta bez zmian, wejście nietknięte",
     s1.gracze[0].nazwa === "Oczko" && s1.gracze[1].nazwa === "Kumak" && !("nazwa" in s2.gracze[1]) && s2.gracze[0].nazwa === "agawa" && s2.gracze[2].poziom === "sredni" &&
     sklad0.gracze[0].nazwa === "agawa" && "nazwa" in sklad0.gracze[1] && P.skladPoZmianie(null, "a", "b") === null, [s1, s2]);
  const p1 = P.przypnij("AGAWA", true), c1 = P.kolor("agawa", "#6CB33F"), c2 = P.kolor("agawa", "zielony"), p2 = P.przypnij("Nikt", true);
  ck("przypnij i kolor: zapis w profilu (kolor małymi literami), zły kolor i brak profilu = odmowa, kolor(nazwa) czyta",
     p1.ok && zap().profile.agawa.przypiety === true && c1.ok && P.kolor("Agawa") === "#6cb33f" && !c2.ok && c2.powod === "kolor" && !p2.ok && p2.powod === "brak" &&
     P.lista()[0].klucz === "agawa", [p1, c1, c2, p2]);
  const w1 = P.wyzeruj("Agawa"), pz = zap().profile.agawa;
  ck("wyzeruj: liczniki, osiągnięcia, sława i wybór motywów na zero; nazwa, kolor, przypięcie i kapsel zostają",
     w1.ok && pz.liczniki.gry === 0 && Object.keys(pz.osiagniecia).length === 0 && TORY.every(t => pz.slawa[t] === 0 && pz.wybor[t] === "auto") &&
     pz.nazwa === "AGAWA" && pz.kolor === "#6cb33f" && pz.przypiety === true && zap().kapsle["kap-7"] === "agawa" && !P.wyzeruj("Nikt").ok, pz);
  const d1 = P.usun("Gość"), d2 = P.usun("Nikt"), d3 = P.usun("agawa");
  ck("usun: Gościa nie, brak profilu = odmowa, usunięcie zabiera profil i jego kapsle",
     !d1.ok && d1.powod === "gosc" && !d2.ok && d2.powod === "brak" && d3.ok && !zap().profile.agawa && !zap().kapsle["kap-7"] && P.kapsel("kap-7") === null, [d1, d2, d3]);
  ck("Gość nietykalny: zawsze na liście, wolno go przypiąć, pokolorować i wyzerować, nie da się przemianować ani usunąć",
     P.przypnij("Gość", true).ok && P.kolor("Gość", "#ec1a83").ok && P.wyzeruj("Gość").ok && !P.zmienNazwe("Gość", "Ktoś").ok && !P.usun("gość").ok &&
     P.lista().find(x => x.gosc).przypiety === true && zap().profile["gość"].kolor === "#ec1a83", P.lista().find(x => x.gosc));
  // ustawienia per profil (`ust`, pod „aktywny profil” innej sesji)
  wyczysc();
  P.poGrze(sk1, [wiersz("mysz")], k1g);
  const us1 = P.zapiszUstawienia("Oczko", { jezyk: "en", tempo: 90, latwy: true, nic: null, zle: { a: 1 }, lista: [1], nan: NaN }),
    us2 = P.zapiszUstawienia("Oczko", { tempo: 100 }), us3 = P.zapiszUstawienia("Nikt", { a: 1 }), us4 = P.zapiszUstawienia("Oczko", [1, 2]);
  ck("ustawienia: płytkie scalenie prostych wartości (tekst, liczba, prawda/fałsz, null), złe odpadają i są w `pominiete`, brak profilu i nie-obiekt = odmowa",
     us1.ok && us1.pominiete.sort().join() === "lista,nan,zle" && us2.ok && JSON.stringify(P.ustawienia("oczko")) === JSON.stringify({ jezyk: "en", tempo: 100, latwy: true, nic: null }) &&
     !us3.ok && us3.powod === "brak" && !us4.ok && us4.powod === "ust" && JSON.stringify(P.ustawienia("Nikt")) === "{}" && P.zapiszUstawienia("Gość", { jezyk: "pl" }).ok, [us1, us2, us3, us4]);
  P.wyzeruj("Oczko"); P.zmienNazwe("Oczko", "Ula");
  const plikU = JSON.parse(P.eksport());
  P.usun("Ula"); P.importuj(JSON.stringify(plikU), "scal");
  ck("ustawienia: zostają po wyzerowaniu, idą za zmianą nazwy, eksport → import je niesie, migracja je zachowuje (bez pola = brak `ust`)",
     P.ustawienia("Ula").jezyk === "en" && plikU.profile.ula.ust.tempo === 100 && P.migruj({ wersja: 2, profile: { a: { nazwa: "A", ust: { x: 1, y: {} } } } }).profile.a.ust.x === 1 &&
     !("y" in P.migruj({ wersja: 2, profile: { a: { nazwa: "A", ust: { x: 1, y: {} } } } }).profile.a.ust) && !("ust" in P.migruj({ wersja: 2, profile: { a: { nazwa: "A" } } }).profile.a),
     P.ustawienia("Ula"));
  // kapsel → profil
  wyczysc();
  ck("kapsel: bez wpisu null; przypiszKapsel tworzy pusty profil i go zapamiętuje; Gość albo null = zapomnij",
     P.kapsel("kap-1") === null && P.przypiszKapsel("kap-1", "Zosia") === "Zosia" && zap().kapsle["kap-1"] === "zosia" && !!zap().profile.zosia && P.kapsel("kap-1") === "Zosia" &&
     P.przypiszKapsel("kap-1", "Gość") === null && P.kapsel("kap-1") === null && P.przypiszKapsel("kap-2", "zosia") === "Zosia" && P.przypiszKapsel("kap-2", null) === null &&
     !zap().kapsle["kap-2"], zap());
  wyczysc();
  const skK = [{ id: "kap-9", nazwa: "Zosia", nazwaWlasna: true, zrodlo: "kapsel", instrument: "flet" }, { id: "kap-3", nazwa: "Kapsel 3", zrodlo: "kapsel", instrument: "flet" }];
  P.poGrze(skK, [wiersz("kap-9"), wiersz("kap-3")], Object.assign({}, konf, { liczbaGraczy: 2 }));
  ck("poGrze: kapsel z wybraną nazwą pamięta profil (kap-9 → Zosia), kapsel grający pod własną nazwą kapsla nie", P.kapsel("kap-9") === "Zosia" && P.kapsel("kap-3") === null, zap().kapsle);
  P.przeladuj();
  ck("kapsle przeżywają przeładowanie; przy migracji wpis do nieistniejącego profilu odpada", P.kapsel("kap-9") === "Zosia" &&
     Object.keys(P.migruj({ wersja: 2, profile: { a: { nazwa: "A" } }, kapsle: { x: "a", y: "nie-ma", z: 5 } }).kapsle).join() === "x", "");
  // limit: przypięte, grające i kapsle chronione
  {
    const pp = o => Object.assign(P.migruj({ wersja: 2, profile: { x: { nazwa: "x" } } }).profile.x, o);
    const s = { profile: {}, kapsle: { kap: "k-kapsel" } };
    for (let i = 0; i < 205; i++) s.profile["p" + i] = pp({ nazwa: "p" + i, ostatnio: 1000 + i });
    s.profile["gość"] = pp({ nazwa: "Gość", ostatnio: 1 });
    s.profile["stary-przypiety"] = pp({ ostatnio: 2, przypiety: true });
    s.profile["stary-gral"] = pp({ ostatnio: 3, liczniki: Object.assign(P.nowyLiczniki(), { gry: 4 }) });
    s.profile["stary-slawa"] = pp({ ostatnio: 4, slawa: { widownia: 5, streak: 0, tlo: 0, klawisze: 0 } });
    s.profile["stary-osiag"] = pp({ ostatnio: 5, osiagniecia: { "gry-5": "x" } });
    s.profile["k-kapsel"] = pp({ ostatnio: 6 });
    const us = P.doUsunieciaPrzyLimicie(s, 200);
    ck("limit 200: ponad limit odchodzą najdawniej użyte PUSTE profile (p0…p10); nigdy Gość, przypięty, grający, ze sławą, z osiągnięciem ani kapsla",
       us.join() === [...Array(11)].map((_, i) => "p" + i).join(), us);
    const chronione = { profile: {}, kapsle: {} };
    for (let i = 0; i < 5; i++) chronione.profile["g" + i] = pp({ przypiety: true });
    ck("limit: gdy wszystkie profile są chronione, nic nie znika (zapis większy niż limit)", P.doUsunieciaPrzyLimicie(chronione, 3).length === 0, "");
    wyczysc();
    P.utworz("Przypięty"); P.przypnij("Przypięty", true);
    for (let i = 0; i < 200; i++) P.utworz("Nowy " + i);
    ck("zapis: 201. profil ponad limit usuwa najstarszy pusty nieprzypięty, przypięty zostaje, właśnie dodany też",
       Object.keys(zap().profile).length === 200 && !!zap().profile["przypięty"] && !zap().profile["nowy 0"] && !!zap().profile["nowy 199"], Object.keys(zap().profile).length);
  }
  // eksport i import
  wyczysc();
  P.poGrze(sk1, [wiersz("mysz")], k1g);
  P.utworz("Kumak"); P.przypnij("Kumak", true); P.kolor("Kumak", "#294aa8"); P.przypiszKapsel("kap-5", "Kumak");
  const plik = P.eksport(), obiekt = JSON.parse(plik);
  ck("eksport: JSON z formatem, wersją 11, datą, profilami, kapslami i ekipą", obiekt.format === "ribbitbeat-profile" && obiekt.wersja === P.WERSJA && /^\d{4}-\d{2}-\d{2}T/.test(obiekt.eksport) &&
     !!obiekt.profile.oczko && obiekt.profile.kumak.przypiety === true && obiekt.kapsle["kap-5"] === "kumak" && obiekt.ekipa && obiekt.ekipa.slawa === P.ekipa().slawa, Object.keys(obiekt));
  P.poGrze(sk1, [wiersz("mysz")], Object.assign({}, k1g, { data: "2026-10-05T12:00:00" }));   // lokalna Oczko ma więcej sławy niż w pliku
  const olaLok = zap().profile.oczko.slawa.widownia;
  P.utworz("Zenek"); P.kolor("Kumak", null); P.przypnij("Kumak", false);
  const obiekt2 = JSON.parse(plik);
  obiekt2.profile.marta = { nazwa: "Marta", liczniki: { gry: 2, utwory: "zle", dni: 7 }, slawa: { widownia: 30 }, osiagniecia: { "gry-5": "x", "nie-ma": "y" } };
  obiekt2.profile.zly = 5; obiekt2.profile.KUMAK2 = { nazwa: "kumak" };
  const r1 = P.importuj(JSON.stringify(obiekt2), "scal"), po = zap(), m = po.profile.marta;
  ck("import scal: nowe dochodzą (Marta), przy tej samej nazwie zostaje lepszy (lokalna Oczko z większą sławą), przypięcie i kolor z pliku dochodzą, zepsuty i powtórzony wpis odrzucone, lokalne bez pary zostają",
     r1.ok && r1.dodane.join() === "Marta" && r1.pominiete.includes("Oczko") && r1.pominiete.includes("Kumak") && r1.odrzucone === 2 && po.profile.oczko.slawa.widownia === olaLok &&
     po.profile.kumak.przypiety === true && po.profile.kumak.kolor === "#294aa8" && !!po.profile.zenek && po.kapsle["kap-5"] === "kumak" && r1.razem === Object.keys(po.profile).length, r1);
  ck("import: liczniki i osiągnięcia z pliku oczyszczone (zły typ = domyślny, nieznane osiągnięcie odpada)",
     m.liczniki.gry === 2 && typeof m.liczniki.utwory === "object" && m.liczniki.dni.naj === 0 && !!m.osiagniecia["gry-5"] && !m.osiagniecia["nie-ma"] && m.slawa.widownia === 30, m);
  P.wyzeruj("Oczko");
  const r2 = P.importuj(plik, "scal");
  ck("import scal: lepszy profil z pliku zastępuje wyzerowany lokalny", r2.ok && r2.zastapione.includes("Oczko") && zap().profile.oczko.slawa.widownia === obiekt.profile.oczko.slawa.widownia, r2);
  const r3 = P.importuj(plik, "zastap");
  ck("import zastąp: zostaje dokładnie zawartość pliku (Zenek i Marta znikają), kapsle z pliku, ekipa z pliku", r3.ok && r3.tryb === "zastap" &&
     Object.keys(zap().profile).sort().join() === "kumak,oczko" && zap().kapsle["kap-5"] === "kumak" && r3.dodane.length === 2 && zap().ekipa.slawa === obiekt.ekipa.slawa, r3);
  {   // ekipa przy scalaniu: motywy ze skrótów się łączą, sława ekipy = co najmniej suma scalonych profili, dwa importy nic nie dublują
    const o3 = JSON.parse(plik); o3.ekipa = { slawa: 5000, motywy: { sashiko: "2026-10-07T00:00:00Z" }, wybor: "sashiko", wszystko: "2026-10-07T00:00:00Z" };
    o3.profile.marta = { nazwa: "Marta", slawa: { widownia: 300 } };
    const przed = zap().ekipa, r5 = P.importuj(JSON.stringify(o3), "scal"), e5 = zap().ekipa, suma = Object.values(zap().profile).reduce((a, p) => a + P.slawaRazem(p.slawa), 0);
    const r6 = P.importuj(JSON.stringify(o3), "scal"), e6 = zap().ekipa;
    ck("import scal: ekipa.slawa = max(lokalna, suma profili po scaleniu), motyw ze skrótu z pliku dochodzi, wybór i „wszystko” zostają lokalne, drugi import bez zmian",
       r5.ok && e5.slawa === Math.max(przed.slawa, suma) && e5.slawa < 5000 && e5.motywy.sashiko === "2026-10-07T00:00:00Z" && e5.wybor === przed.wybor &&
       e5.wszystko === przed.wszystko && r6.ok && e6.slawa === e5.slawa, { przed, e5, e6, suma });
    const r7 = P.importuj(JSON.stringify({ wersja: 2, profile: { ala: { nazwa: "Ala", slawa: { tlo: 40 }, osiagniecia: { "pakiet-1": "x" } } } }), "zastap");
    // 10-18 (E-03): import przechodzi tę samą migrację co zapis: pula 40 ze starej krzywej przeliczona na krzywą wersji 5
    ck("import zastąp pliku wersji 2 (bez ekipy): ekipa odtworzona z jego profili (40 przeliczone na krzywą v5, 8-bit ze skrótu tła)",
       r7.ok && zap().ekipa.slawa === P.przeliczKrzywa(40, P.PROGI_V4, P.PROGI) && Object.keys(zap().ekipa.motywy).join() === "8bit", zap().ekipa);
    P.importuj(plik, "zastap");
  }
  const przedBledem = pamiec[P.KLUCZ];
  const b1 = P.importuj("{nie json", "scal"), b2 = P.importuj(JSON.stringify({ format: "inny", wersja: 2, profile: {} }), "zastap"),
    b3 = P.importuj(JSON.stringify({ format: "ribbitbeat-profile", wersja: 2, profile: { a: 1 } }), "zastap"), b4 = P.importuj("[1,2]", "scal"),
    b5 = P.importuj(" ".repeat(5e6 + 1), "scal");
  ck("import: zły JSON, obcy format, brak poprawnych profili, tablica, za duży plik = raport z błędem i zapis bez zmian (także przy „zastąp”)",
     !b1.ok && b1.blad === "json" && b2.blad === "format" && b3.blad === "pusty" && b4.blad === "format" && b5.blad === "rozmiar" && pamiec[P.KLUCZ] === przedBledem,
     [b1, b2, b3, b4, b5].map(x => x.blad));
  const r4 = P.importuj(JSON.stringify(v1), "scal");
  ck("import: surowy zapis wersji 1 też wchodzi (sława przeliczona, zepsuty wpis odrzucony)", r4.ok && r4.odrzucone === 1 &&
     r4.pominiete.concat(r4.zastapione).includes("Oczko"), r4);
}

// ---- 11. koło nagród (10-16): losowanie z pozostałych rzeczy, rzadkości, gwarancje, tło bez zużycia, dubel na końcu, migracja ----
{
  for (const k of Object.keys(pamiec)) delete pamiec[k]; P.przeladuj(); P.ustawDev({});
  const sk = { slawa: { widownia: 400, streak: 400, tlo: 400, klawisze: 400 }, liczniki: {}, osiagniecia: {}, nazwa: "Kolo", wybor: {} };
  // 10-17 (WSPOLNE): koło i pula należą do ekipy; helper wkłada `los` i sumę sławy profilu do ekipy zapisu wersji 5
  const zapisz = (profil) => { const los = profil.los || null, mot = profil.motywy || {}, pr = Object.assign({}, profil); delete pr.los; delete pr.motywy;
    pamiec[P.KLUCZ] = JSON.stringify({ wersja: P.WERSJA, profile: { kolo: pr }, kapsle: {}, ekipa: { slawa: P.slawaRazem(profil.slawa), motywy: mot, wybor: "auto", wszystko: null, los, gry: 5 } }); P.przeladuj(); };
  zapisz(Object.assign({}, sk, { los: { uzyte: 0, wygrane: [], bezE: 0, bezL: 0 } }));
  const wolne0 = P.losowania("Kolo"), pu0 = P.pulaLosowania("Kolo");
  ck("koło: wolne losowania = poziomy z puli minus zużyte; pula = 40 instrumentów (bez Ribbita), 29 efektów, 29 teł i 3 sekrety (10-19)",
     wolne0 === P.droga().filter(n => n.prog <= 1600).length && wolne0 > 2 && pu0.instrument.length === 40 && pu0.efekt.length === 29 && pu0.plansza.length === 29 - (P.ekipa().odblokowane.length - 1) && pu0.sekret.instrument === "studio" && pu0.sekret.efekt === "prawdziwy" && pu0.sekret.plansza === "prawdziwy" && !pu0.instrument.includes("ribbit"), [wolne0, pu0.instrument.length]);
  P.ustawDev({ odblokuj: true }); const wOdbl = P.losowania("Kolo"); P.ustawDev({});
  { // 10-19 (po cichu): dopóki nie odblokowano 35 rzeczy, sekretnych nie da się wylosować; od 35. wracają
    const ids = P.INSTRUMENTY_KOLEJNOSC.filter(i => i !== "ribbit").slice(0, 35), wyg = n => ids.slice(0, n).map(id => ({ t: "instrument", id, r: "zwykly", p: 0 }));
    const sekretyPrzy = (n, prog) => { zapisz(Object.assign({}, sk, { los: { uzyte: 0, wygrane: wyg(n), bezE: 0, bezL: 0 } })); P.ustawProgSekretow(prog); const pu = P.pulaLosowania("Kolo"); return [pu.sekret.instrument, pu.sekret.efekt, pu.sekret.plansza, P.liczbaWgRzadkosci("Kolo").sekretny]; };
    const przy0 = sekretyPrzy(0, 35), przy34 = sekretyPrzy(34, 35), przy35 = sekretyPrzy(35, 35), wylacz = sekretyPrzy(0, 0);
    zapisz(Object.assign({}, sk, { los: { uzyte: 0, wygrane: [], bezE: 0, bezL: 0 } })); P.ustawProgSekretow(0);
    ck("sekrety: do 34. odblokowanej rzeczy pula sekretów pusta (0 sekretnych), od 35. jak zwykle (3); ustawProgSekretow(0) wyłącza",
       przy0.join() === ",,,0" && przy34.join() === ",,,0" && przy35.join() === "studio,prawdziwy,prawdziwy,3" && wylacz.join() === "studio,prawdziwy,prawdziwy,3", [przy0, przy34, przy35, wylacz]);
  }
  ck("koło: ?odblokuj=1 otwiera wszystko, więc nie ma losowań (10-19: wcześniej koło dawało rzeczy już „odblokowane”), a bez niego wszystko jak było",
     wOdbl === 0 && P.losowania("Kolo") === wolne0, [wOdbl, wolne0]);
  const rz = P.liczbaWgRzadkosci("Kolo"), suma = rz.zwykly + rz.rzadki + rz.epicki + rz.legendarny + rz.sekretny;
  ck("rzadkości: każda rzecz ma rzadkość, są wszystkie cztery, legendarne to najfajniejsze (instrumenty i motywy z tier listy, 3 sekrety; 10-18)",
     suma === 40 + 29 + pu0.plansza.length + 3 && rz.sekretny === 3 && P.rzadkosc("efekt", "prawdziwy") === "sekretny" && P.rzadkosc("instrument", "studio") === "sekretny" && rz.legendarny > 0 && rz.epicki > 0 && rz.rzadki > 0 && rz.zwykly > rz.legendarny && P.rzadkosc("instrument", "robot") === "legendarny" &&
     P.rzadkosc("instrument", "trabka") === "zwykly" && P.rzadkosc("efekt", "zloto") === "legendarny" && P.rzadkosc("efekt", "einstein") === "rzadki" && P.rzadkosc("plansza", "prawdziwy") === "sekretny" && P.rzadkosc("efekt", "halloween") === "zwykly", rz);
  // ręcznie ułożona tier lista rzadkości: przydział
  // 41 instrumentów i 31 motywów; skin (efekt) i scena (plansza) tego samego motywu mają jedną rzadkość, rzecz spoza list jest zwykła,
  // liczby w każdej rzadkości zostają jak dotąd (więc wagi, gwarancje i krzywa poziomów bez zmian)
  const TIER_I = { legendarny: ["chiptune", "kwak", "krzyk", "robot", "syntezator"], epicki: ["flet", "harmonijka", "organy", "przester", "theremin", "tuba"],
    rzadki: ["chor", "dudy", "impuls", "kazoo", "oboj", "okaryna", "puzon", "smyczki", "sub", "trance", "wiolonczela"] };
  const TIER_M = { legendarny: ["8bit", "kredki", "szachy", "zloto"], epicki: ["gielda", "muchomor", "olimp", "piraci", "podwodny", "synthwave"],
    rzadki: ["cyrk", "einstein", "garaz", "kosmos", "kukielki", "sashiko", "skatepark", "tiki", "voodoo"] };
  const zgodne = (k, tier) => Object.entries(tier).every(([r, ids]) => ids.every(id => P.rzadkosc(k, id) === r));
  const reszta = (lista, tier) => lista.filter(id => !Object.values(tier).some(l => l.includes(id)));
  const licz = (k, ids) => { const o = { zwykly: 0, rzadki: 0, epicki: 0, legendarny: 0 }; for (const id of ids) o[P.rzadkosc(k, id)]++; return o; };
  const ladder = P.drabinka("streak").map(w => w.id);
  ck("rzadkości z tier listy: każdy instrument i motyw ma rzadkość z tier listy (skin i scena tę samą), reszta zwykła",
     zgodne("instrument", TIER_I) && zgodne("efekt", TIER_M) && zgodne("plansza", TIER_M) &&
     reszta(P.INSTRUMENTY_KOLEJNOSC, TIER_I).every(id => P.rzadkosc("instrument", id) === "zwykly") &&
     reszta(ladder, TIER_M).filter(id => id !== "prawdziwy").every(id => P.rzadkosc("efekt", id) === "zwykly" && P.rzadkosc("plansza", id) === "zwykly") &&
     ladder.length === 31 && Object.values(TIER_M).flat().every(id => ladder.includes(id)) && Object.values(TIER_I).flat().every(id => P.INSTRUMENTY_KOLEJNOSC.includes(id)),
     [reszta(P.INSTRUMENTY_KOLEJNOSC, TIER_I), reszta(ladder, TIER_M)]);
  ck("rzadkości z tier listy: liczby w puli koła bez zmian (instrumenty 5 / 6 / 11 / 18, skiny 4 / 6 / 9 / 10 jako legendarny / epicki / rzadki / zwykły; 10-19: Krzyk legendarny, Kukiełki rzadkie)",
     JSON.stringify(licz("instrument", pu0.instrument)) === JSON.stringify({ zwykly: 18, rzadki: 11, epicki: 6, legendarny: 5 }) &&
     JSON.stringify(licz("efekt", pu0.efekt)) === JSON.stringify({ zwykly: 10, rzadki: 9, epicki: 6, legendarny: 4 }), [licz("instrument", pu0.instrument), licz("efekt", pu0.efekt)]);
  ck("rzadkości z tier listy: od początku zostają Ribbit i Filc (poza pulą koła), sekrety Studio i Prawdziwy staw bez zmian",
     !pu0.instrument.includes("ribbit") && !pu0.efekt.includes("filc") && !pu0.plansza.includes("filc") && ladder[0] === "filc" &&
     pu0.sekret.instrument === "studio" && pu0.sekret.efekt === "prawdziwy" && pu0.sekret.plansza === "prawdziwy", [ladder[0], pu0.sekret]);
  const ziarno = (() => { let x = 7; return () => { x = (x * 16807) % 2147483647; return x / 2147483647; }; })();
  const wyn = P.losuj("Kolo", { rng: ziarno });
  const l1 = JSON.parse(pamiec[P.KLUCZ]).ekipa.los;
  ck("losuj: kategoria, rzadkość i rzecz z puli; zapis od razu; losowanie zużyte (10-18: także scena)",
     wyn && ["instrument", "efekt", "plansza"].includes(wyn.kat) && wyn.pula[wyn.kat].includes(wyn.id) && wyn.r === P.rzadkosc(wyn.kat, wyn.id) && l1.uzyte === 1 &&
     (wyn.kat === "plansza" ? P.ekipa().odblokowane.includes(wyn.id) : l1.wygrane.some(x => x.id === wyn.id)), [wyn.kat, wyn.id, wyn.r, l1]);
  // wymuszone kategorie: instrument trafia do listy instrumentów, efekt do odblokowanych efektów profilu
  const wi = P.losuj("Kolo", { rng: ziarno, kat: "instrument" }), we = P.losuj("Kolo", { rng: ziarno, kat: "efekt" });
  ck("losuj instrument → Postepy.instrumenty ma go; losuj efekt → odblokowane streaka ma go; rzeczy nie powtarzają się",
     P.instrumenty("Kolo").includes(wi.id) && P.odblokowane("Kolo").streak.includes(we.id) && !P.pulaLosowania("Kolo").instrument.includes(wi.id) && !P.pulaLosowania("Kolo").efekt.includes(we.id), [wi.id, we.id]);
  // 10-17: sekretna karta: rng przy 1 trafia w ostatnią rzadkość (sekretny), nie zużywa losowania, instrumenty otwierają Studio, skin = Prawdziwy staw
  {
    const u0 = P.losowania("Kolo"), st0 = P.studioOdblokowane("Kolo"), ws = P.losuj("Kolo", { rng: () => .9999, kat: "instrument" });
    ck("sekret instrumentów: rzadkość sekretny, id studio, losowanie niezużyte, Studio odblokowane, nie wchodzi do listy instrumentów",
       ws && ws.r === "sekretny" && ws.id === "studio" && ws.sekret === true && P.losowania("Kolo") === u0 && !st0 && P.studioOdblokowane("Kolo") === true &&
       !P.instrumenty("Kolo").includes("studio") && P.pulaLosowania("Kolo").sekret.instrument === null, [ws && ws.r, ws && ws.id, u0, P.losowania("Kolo")]);
    const we2 = P.losuj("Kolo", { rng: () => .9999, kat: "efekt" });
    ck("sekret skinów: Prawdziwy staw tylko z koła (progi sławy go nie otwierają), po wygranej jest w odblokowanych streaka, sekret znika z puli",
       we2 && we2.r === "sekretny" && we2.id === "prawdziwy" && P.odblokowane("Kolo").streak.includes("prawdziwy") && P.pulaLosowania("Kolo").sekret.efekt === null &&
       !P.odblokowaneZ({ slawa: { streak: 99999 }, osiagniecia: {} }, false).streak.includes("prawdziwy"), we2);
    ck("sekret scen: Prawdziwy staw nie wchodzi do następnego celu planszy ani nie otwiera się sławą ekipy",
       !P.odblokowanePlanszyZ({ slawa: 99999, motywy: {} }, false).includes("prawdziwy") && P.odblokowanePlanszyZ({ slawa: 0, motywy: { prawdziwy: "x" } }, false).includes("prawdziwy") &&
       P.odblokowanePlanszyZ({ slawa: 99999, motywy: {} }, true).includes("prawdziwy"), "");
  }
  const przed = P.losowania("Kolo"), wt = P.losuj("Kolo", { rng: ziarno, kat: "plansza" });
  ck("scena: odblokowuje się dla ekipy i ZUŻYWA losowanie jak instrument i skin (10-18, było: darmowa)", wt.kat === "plansza" && wt.bonus === false && P.losowania("Kolo") === przed - 1 && P.ekipa().odblokowane.includes(wt.id), [przed, P.losowania("Kolo")]);
  ck("sceny bez progów (10-18): pula ekipy 99999 nie otwiera żadnej sceny poza pierwszą, stara reguła (zProgow) tak; brak „następnej sceny” z progu",
     P.odblokowanePlanszyZ({ slawa: 99999, motywy: {} }, false).length === 1 && P.odblokowanePlanszyZ({ slawa: 99999, motywy: {} }, false, true).length === 30 && P.nastepnyCel(null, "plansza") === null, "");
  // gwarancje: po 5 losowaniach bez epickiej następne jest epickie lub lepsze; po 14 bez legendarnej legendarne
  zapisz(Object.assign({}, sk, { los: { uzyte: 0, wygrane: [], bezE: P.GWARANCJA_EPICKIEJ, bezL: 0 } }));
  const ge = P.losuj("Kolo", { rng: () => 0.001, kat: "instrument" });
  ck("gwarancja epickiej: po 5 losowaniach bez epickiej wypada epicka albo legendarna (nawet przy najgorszym losie)", ge.r === "epicki" || ge.r === "legendarny", ge.r);
  zapisz(Object.assign({}, sk, { los: { uzyte: 0, wygrane: [], bezE: 0, bezL: P.GWARANCJA_LEGENDARNEJ } }));
  const gl = P.losuj("Kolo", { rng: () => 0.001, kat: "instrument" });
  ck("gwarancja legendarnej: po 14 losowaniach bez legendarnej wypada legendarna", gl.r === "legendarny", gl.r);
  // ostatnie losowanie daje dwie rzeczy: zostają dokładnie dwa (instrument/efekt) i jedno losowanie
  const wszystkie = P.pulaLosowania("Kolo"), zostaw = ["kazoo", "trance"], wyg = P.INSTRUMENTY_KOLEJNOSC.filter(i => i !== "ribbit" && !zostaw.includes(i)).map(id => ({ t: "instrument", id, r: "zwykly", p: 1 }));
  const efZ = P.drabinka("streak").filter((w, i) => i > 0).map(w => ({ t: "efekt", id: w.id, r: "zwykly", p: 1 }));
  const scW = Object.fromEntries(P.drabinka("tlo").filter((w, i) => i > 0).map(w => [w.id, "x"]));   // 10-18: sceny też na kole, więc wszystkie już są
  zapisz(Object.assign({}, sk, { slawa: { widownia: 9000, streak: 9000, tlo: 9000, klawisze: 9000 }, motywy: scW, los: { uzyte: 56, wygrane: wyg.concat(efZ), bezE: 0, bezL: 0 } }));
  const dw = P.losuj("Kolo", { rng: ziarno, kat: "instrument" });
  const pu1 = P.pulaLosowania("Kolo").instrument.slice(), dw2 = P.losuj("Kolo", { rng: ziarno, kat: "instrument" });
  ck("bez dubla (10-19): przedostatnie losowanie daje jedną rzecz, ostatnia czeka na własne losowanie, które opróżnia pulę instrumentów",
     dw && dw.dubel === null && zostaw.includes(dw.id) && pu1.length === 1 && pu1[0] !== dw.id && dw2 && dw2.id === pu1[0] && dw2.dubel === null &&
     P.pulaLosowania("Kolo").instrument.length === 0 && P.instrumentyWszystkie("Kolo") === true, [dw, pu1, dw2]);
  {   // 10-18: dubel liczy też sceny: został jeden instrument i jedna scena
    const scB = Object.assign({}, scW); delete scB.kredki;
    zapisz(Object.assign({}, sk, { slawa: { widownia: 9000, streak: 9000, tlo: 9000, klawisze: 9000 }, motywy: scB, los: { uzyte: 56, wygrane: wyg.concat(efZ, [{ t: "instrument", id: "kazoo", r: "rzadki", p: 1 }]), bezE: 0, bezL: 0 } }));
    const ds = P.losuj("Kolo", { rng: ziarno, kat: "instrument" });
    ck("bez dubla ze sceną (10-19): ostatni instrument nie zabiera ostatniej sceny, scena zostaje na kole do osobnego losowania", ds && ds.id === "trance" && ds.dubel === null &&
       !P.ekipa().odblokowane.includes("kredki") && P.nicDoLosowania("Kolo") === false && P.pulaLosowania("Kolo").plansza.join() === "kredki", ds);
  }
  // migracja: profil bez `los` przechodzi na koło bez straty (wszystko, co dawały progi, zostaje), bez wolnych losowań
  // migracja 4 → 5 (10-17): koło ekipy = suma wygranych wszystkich profili (i stare progi profilu bez koła), Studio zostaje, pula na nowej krzywej
  pamiec[P.KLUCZ] = JSON.stringify({ wersja: 4, kapsle: {}, ekipa: { slawa: 3650, motywy: {}, wybor: "auto", wszystko: null }, profile: {
    ala: { nazwa: "Ala", slawa: { widownia: 300, streak: 300, tlo: 300, klawisze: 300 }, liczniki: { gry: 12 }, osiagniecia: {}, wybor: {},
      los: { uzyte: 3, wygrane: [{ t: "instrument", id: "kazoo", r: "rzadki", p: 2 }, { t: "efekt", id: P.drabinka("streak")[5].id, r: "zwykly", p: 3 }, { t: "studio", id: "studio", r: "sekretny", p: 3 }], bezE: 2, bezL: 2 } },
    bob: { nazwa: "Bob", slawa: { widownia: 100, streak: 100, tlo: 100, klawisze: 100 }, liczniki: { gry: 4 }, osiagniecia: {}, wybor: {},
      los: { uzyte: 1, wygrane: [{ t: "instrument", id: "robot", r: "legendarny", p: 1 }, { t: "instrument", id: "kazoo", r: "rzadki", p: 1 }], bezE: 0, bezL: 0 } } } });
  P.przeladuj();
  const z5 = JSON.parse(JSON.stringify(P.stan ? P.stan() : {})), e5 = P.ekipa(), los5 = P.profilEkipy ? P.profilEkipy().los : null;
  ck("migracja 4 → 5: instrumenty Ali i Boba są wspólne (bez dubli), Studio Ali odblokowane dla wszystkich, skin Ali u Boba, pula przeliczona tym samym miejscem krzywej",
     P.instrumenty("Bob").includes("kazoo") && P.instrumenty("Bob").includes("robot") && P.instrumenty("Ala").includes("robot") && P.studioOdblokowane("Bob") === true &&
     P.odblokowane("Bob").streak.includes(P.drabinka("streak")[5].id) && e5.slawa === P.PROGI[21] && P.przeliczKrzywa(P.PROGI_V4[10], P.PROGI_V4, P.PROGI) === P.PROGI[10] &&
     los5 && los5.wygrane.filter(x => x.id === "kazoo").length === 1 && e5.gry >= 16, [e5.slawa, los5]);
  // 10-18 (wersja 6): ten sam zapis idzie dalej: sceny z progów v5 zostają na stałe, wolne losowania nie maleją, a do końca drogi starczy losowań
  const wolneV5 = P.drogaV5().filter(n => n.prog <= e5.slawa).length - 3, scenyV5 = P.drabinka("tlo").filter((w, i) => i > 0 && P.progI(i) <= e5.slawa && w.id !== "prawdziwy");
  const pu6 = P.pulaLosowania("Bob"), zost6 = pu6.instrument.length + pu6.efekt.length + pu6.plansza.length;
  ck("migracja 5 → 6: sceny otwarte progami v5 zostają („progi-v5”), wolne losowania nie mniejsze niż w v5, losowań do końca drogi starczy na wszystko",
     scenyV5.length === 21 && scenyV5.every(w => e5.odblokowane.includes(w.id) && /^progi-v[45]$/.test(e5.motywy[w.id])) && P.losowania("Bob") >= wolneV5 &&
     P.droga().length - los5.uzyte + (los5.bonus | 0) >= zost6 - 1, [wolneV5, P.losowania("Bob"), los5.uzyte, zost6]);
  // 10-18 (E-03): import tego samego pliku wersji 4 („Zastąp”) = ta sama migracja co zapis z localStorage
  const surowy4 = pamiec[P.KLUCZ], ins5 = P.instrumenty("Bob").slice(), str5 = P.odblokowane("Bob").streak.slice();
  for (const k of Object.keys(pamiec)) delete pamiec[k]; P.przeladuj();
  const ri = P.importuj(surowy4, "zastap"), ei = P.ekipa();
  ck("import pliku wersji 4 (Zastąp): pula ekipy, instrumenty, skiny i Studio jak po migracji zapisu (10-18, E-03)",
     ri.ok && ei.slawa === e5.slawa && P.instrumenty("Bob").join() === ins5.join() && P.odblokowane("Bob").streak.join() === str5.join() && P.studioOdblokowane("Bob") === true,
     [ri.blad, ei.slawa, e5.slawa, P.instrumenty("Bob")]);
}

{   // 10-19 (wersja 7, krzywa losowań droższa na starcie): zapis v6 zachowuje wolne losowania i wygrane, brak idzie do bonusu
  for (const k of Object.keys(pamiec)) delete pamiec[k];
  const pula6 = 5000, wygr6 = [{ t: "instrument", id: "trabka", r: "zwykly", p: 1 }, { t: "instrument", id: "chor", r: "zwykly", p: 2 }];
  const uz6 = P.poziomLosV6(pula6) - 3;   // trzy czekające losowania na starej krzywej
  const z6 = JSON.stringify({ wersja: 6, profile: { oczko: { nazwa: "Oczko", slawa: { widownia: pula6 } } }, kapsle: {}, ekipa: { slawa: pula6, motywy: {}, wybor: "auto", wszystko: null, los: { uzyte: uz6, wygrane: wygr6, bezE: 0, bezL: 0, bonus: 0 }, gry: 20 } });
  pamiec[P.KLUCZ] = z6; P.przeladuj();
  const w7 = P.losowania("Oczko"), in7 = P.instrumenty("Oczko");
  P.utworz("Zapis7"); P.przeladuj();
  const zap7 = JSON.parse(pamiec[P.KLUCZ]);
  ck("zapis v6 → v11: przy tej samej puli tyle samo wolnych losowań (3), wygrane zostają; gdy nowa krzywa daje mniej poziomów niż zużyto, brak idzie do bonusu; kopia v6",
     P.poziomLosV6(pula6) > P.droga().filter(n => n.prog <= pula6).length && w7 === 3 && in7.includes("trabka") && in7.includes("chor") &&
     zap7.wersja === P.WERSJA && zap7.ekipa.los.uzyte === uz6 + P.droga().filter(n => n.prog <= pula6).length - P.poziomLosV6(pula6) && P.losowania("Oczko") === 3 && pamiec[P.KLUCZ + ".kopia-v6"] === z6 &&
     (() => { for (const k of Object.keys(pamiec)) delete pamiec[k]; pamiec[P.KLUCZ] = z6.replace('"uzyte":' + uz6, '"uzyte":0'); P.przeladuj(); const L = P.ekipa(); return P.losowania("Oczko") === P.poziomLosV6(pula6); })(),
     [w7, zap7.ekipa.los, P.poziomLosV6(pula6)]);
}

{   // 10-19 (wersja 8, krzywa rosnąca): zapis v7 (krzywa malejąca) zachowuje wolne losowania
  for (const k of Object.keys(pamiec)) delete pamiec[k];
  const pula7 = 9000, k7 = P.KRZYWE_LOS[7], uz7 = P.poziomLosKrzywej(k7, pula7) - 2;
  const z7 = JSON.stringify({ wersja: 7, profile: { oczko: { nazwa: "Oczko", slawa: { widownia: pula7 } } }, kapsle: {}, ekipa: { slawa: pula7, motywy: {}, wybor: "auto", wszystko: null, los: { uzyte: uz7, wygrane: [{ t: "instrument", id: "trabka", r: "zwykly", p: 1 }], bezE: 0, bezL: 0, bonus: 0 }, gry: 40 } });
  pamiec[P.KLUCZ] = z7; P.przeladuj();
  const w8 = P.losowania("Oczko"); P.utworz("Zapis8"); P.przeladuj();
  const zap8 = JSON.parse(pamiec[P.KLUCZ]);
  ck("zapis v7 → v11: przy tej samej puli tyle samo wolnych losowań (2), trąbka zostaje, wersja 11, kopia v7",
     w8 === 2 && P.losowania("Oczko") === 2 && P.instrumenty("Oczko").includes("trabka") && zap8.wersja === P.WERSJA && pamiec[P.KLUCZ + ".kopia-v7"] === z7,
     [w8, zap8.ekipa.los, P.poziomLosKrzywej(k7, pula7)]);
}

{   // 10-18 (wersja 6, sceny z koła): zapis v5 z 12 scenami z progów: po wczytaniu, przeładowaniu i imporcie pliku v5 nadal je ma
  for (const k of Object.keys(pamiec)) delete pamiec[k];
  const pula5 = P.PROGI[12], los5 = { uzyte: 10, wygrane: [{ t: "instrument", id: "trabka", r: "zwykly", p: 1 }], bezE: 0, bezL: 0, bonus: 0 };
  const z5 = JSON.stringify({ wersja: 5, profile: { oczko: { nazwa: "Oczko", slawa: { widownia: pula5 } } }, kapsle: {}, ekipa: { slawa: pula5, motywy: { kredki: "2026-10-17T10:00:00Z" }, wybor: "auto", wszystko: null, los: los5, gry: 30 } });
  const oczek = P.drabinka("tlo").filter((w, i) => i > 0 && i <= 12).map(w => w.id).concat(["kredki"]);
  const wolne5 = P.drogaV5().filter(n => n.prog <= pula5).length - 10;
  pamiec[P.KLUCZ] = z5; P.przeladuj();
  const a1 = P.ekipa().odblokowane, w1 = P.losowania("Oczko");
  P.utworz("Zapis6"); P.przeladuj();
  const a2 = P.ekipa().odblokowane, zap6 = JSON.parse(pamiec[P.KLUCZ]);
  ck("zapis v5 → v6: 12 scen z progów i scena z koła zostają, wolnych losowań nie ubywa (a do końca drogi starczy na wszystko), po zapisie i przeładowaniu dalej są (wersja 10, kopia v5)",
     oczek.every(id => a1.includes(id) && a2.includes(id)) && a1.length === 14 && w1 >= wolne5 && P.droga().length - zap6.ekipa.los.uzyte >= 95 - 14 - 1 - 1 && zap6.wersja === P.WERSJA && zap6.ekipa.motywy[oczek[0]] === "progi-v5" &&
     zap6.ekipa.motywy.kredki === "2026-10-17T10:00:00Z" && pamiec[P.KLUCZ + ".kopia-v5"] === z5, [a1, w1, wolne5]);
  for (const k of Object.keys(pamiec)) delete pamiec[k]; P.przeladuj();
  const ri = P.importuj(z5, "zastap"), a3 = P.ekipa().odblokowane;
  for (const k of Object.keys(pamiec)) delete pamiec[k]; P.przeladuj();
  const rs = P.importuj(z5, "scal"), a4 = P.ekipa().odblokowane;
  ck("import pliku v5 (Zastąp i Scal): ta sama migracja co zapis, sceny z progów zostają",
     ri.ok && rs.ok && oczek.every(id => a3.includes(id) && a4.includes(id)) && P.losowania("Oczko") >= 0, [a3, a4]);
}

{   // 10-18 (E-04): zapis nowszej wersji jest tylko do odczytu; starsza wersja dostaje jedną surową kopię przed nadpisaniem
  for (const k of Object.keys(pamiec)) delete pamiec[k];
  const z9 = JSON.stringify({ wersja: P.WERSJA + 1, profile: { ala: { nazwa: "Ala" } }, kapsle: {}, ekipa: { slawa: 777 } });
  pamiec[P.KLUCZ] = z9; P.przeladuj();
  P.utworz("Nowy9"); P.wybierzMotyw("auto"); P.poGrze([{ id: "mysz", nazwa: "Nowy9", nazwaWlasna: true, zrodlo: "mysz" }], [wiersz("mysz")], konf);
  ck("nowsza wersja zapisu (WERSJA + 1): gra działa, ale zapis w localStorage zostaje bez zmian (tylko do odczytu)",
     pamiec[P.KLUCZ] === z9 && P.tylkoOdczyt === true && Object.keys(pamiec).length === 1, Object.keys(pamiec));
  for (const k of Object.keys(pamiec)) delete pamiec[k];
  const z4 = JSON.stringify({ wersja: 4, profile: { oczko: { nazwa: "Oczko", slawa: { widownia: 50 } } }, kapsle: {}, ekipa: { slawa: 50, motywy: {} } });
  pamiec[P.KLUCZ] = z4; P.przeladuj(); P.utworz("Ewa");
  const kopia1 = pamiec[P.KLUCZ + ".kopia-v4"];
  P.przeladuj(); P.utworz("Ewa2");
  ck("zapis wersji 4: przed pierwszym nadpisaniem surowa kopia pod .kopia-v4 (raz, nie nadpisuje się), zapis przechodzi na wersję 6",
     kopia1 === z4 && pamiec[P.KLUCZ + ".kopia-v4"] === z4 && JSON.parse(pamiec[P.KLUCZ]).wersja === P.WERSJA && P.tylkoOdczyt === false, Object.keys(pamiec));
}

{   // 10-18 (D-4, E-02): po komplecie zwykłych rzeczy niezdobyty sekret zostaje na kole i wypada na pewno (progi i krzywa bez zmian)
  const N = 120; let studio = 0, stawP = 0, stawS = 0, wiszace = 0;
  for (let run = 0; run < N; run++) {
    for (const k of Object.keys(pamiec)) delete pamiec[k];
    let a = 1000 + run * 7919; const rng = () => { a = (a * 16807) % 2147483647; return (a - 1) / 2147483646; };
    pamiec[P.KLUCZ] = JSON.stringify({ wersja: 5, profile: {}, kapsle: {}, ekipa: { slawa: 40000, motywy: {}, wybor: "auto", gry: 100, los: { uzyte: 0, wygrane: [], bezE: 0, bezL: 0, bonus: 0 } } });
    P.przeladuj();
    let n = 0; while (P.losuj(P.GOSC, { rng }) && n < 400) n++;
    if (P.studioOdblokowane(P.GOSC)) studio++;
    if (P.ekipa().odblokowane.includes("prawdziwy")) stawP++;
    if (P.odblokowane(P.GOSC).streak.includes("prawdziwy")) stawS++;
    if (P.losowania(P.GOSC) !== 0 || !P.nicDoLosowania(P.GOSC)) wiszace++;
  }
  ck("sekrety po komplecie: w 120 przebiegach „losuj do końca” Studio, Prawdziwy staw (scena) i Prawdziwy staw (skin) zdobyte w 100 %, potem 0 losowań",
     studio === N && stawP === N && stawS === N && wiszace === 0, { studio, stawP, stawS, wiszace });
  // kategoria z samym sekretem: losowania liczą go, choć poziomy się skończyły; losuj daje go i nie zużywa losowania
  for (const k of Object.keys(pamiec)) delete pamiec[k];
  const wI = P.INSTRUMENTY_KOLEJNOSC.filter(i => i !== "ribbit").map(id => ({ t: "instrument", id, r: "zwykly", p: 1 })),
    wE = P.drabinka("streak").filter((w, i) => i > 0).map(w => ({ t: "efekt", id: w.id, r: "zwykly", p: 1 })),
    mP = Object.fromEntries(P.drabinka("tlo").filter((w, i) => i > 0).map(w => [w.id, "x"]));
  pamiec[P.KLUCZ] = JSON.stringify({ wersja: 5, profile: {}, kapsle: {}, ekipa: { slawa: 40000, motywy: mP, wybor: "auto", gry: 100, los: { uzyte: P.droga().length, wygrane: wI.concat(wE), bezE: 0, bezL: 0, bonus: 0 } } });
  P.przeladuj();
  const l0 = P.losowania(P.GOSC), kk = P.losujKategorie(P.GOSC, { rng: () => 0 }), ws = P.losuj(P.GOSC, { rng: () => 0 });
  ck("komplet bez Studia: 1 losowanie (sekret), koło ma tylko kategorię Instrument, losuj daje Studio, potem nic do losowania",
     l0 === 1 && kk && kk.kategorie.join() === "instrument" && ws && ws.id === "studio" && ws.r === "sekretny" && P.studioOdblokowane(P.GOSC) && P.losowania(P.GOSC) === 0 && P.nicDoLosowania(P.GOSC),
     [l0, kk && kk.kategorie, ws && ws.id]);
  // DEV „Przed Studiem” (E-08): zostaje sam sekret instrumentów; „dubel” bez bonusu startowego = dokładnie jedno losowanie
  for (const k of Object.keys(pamiec)) delete pamiec[k]; P.przeladuj();
  const ds = P.devKolo(P.GOSC, "studio"), pds = P.pulaLosowania(P.GOSC);
  ck("DEV „Przed Studiem”: 1 losowanie, zwykła pula pusta, został tylko sekret instrumentów",
     ds.wolne === 1 && !pds.instrument.length && !pds.efekt.length && !pds.plansza.length && pds.sekret.instrument === "studio" && !pds.sekret.efekt && !pds.sekret.plansza, [ds, pds.sekret]);
  for (const k of Object.keys(pamiec)) delete pamiec[k]; P.przeladuj();
  const dd = P.devKolo(P.GOSC, "dubel");
  ck("DEV „Dwie ostatnie” (tryb dubel, 10-19 bez dubla): bonus startowy wyzerowany, czekają dokładnie dwa losowania z poziomów na dwie rzeczy", JSON.parse(pamiec[P.KLUCZ]).ekipa.los.bonus === 0 &&
     P.droga().filter(n => n.prog <= P.ekipa().slawa).length - JSON.parse(pamiec[P.KLUCZ]).ekipa.los.uzyte === 2, dd);
}

{   // losowanie na start: nowy profil po pierwszej grze ma 1 losowanie (bonus), zużywa je przed poziomami
  for (const k of Object.keys(pamiec)) delete pamiec[k]; P.przeladuj(); P.ustawDev({});
  const menu0 = P.losowania("Nowy");   // menu pyta o losowania przed pierwszą grą: koło ekipy powstaje leniwie (E-06)
  const pg0 = P.poGrze([{ id: "mysz", nazwa: "Nowy", nazwaWlasna: true, zrodlo: "mysz", instrument: "flet" }],
    [wiersz("mysz", { punkty: 100, nut: 3, oceny: { czysto: 0, dobrze: 0, prawie: 0, falsz: 0, pudlo: 3 } })], Object.assign({}, konf, { liczbaGraczy: 1 }));
  const e0 = pg0.find(x => x.ekipa).ekipa, poz = s => P.droga().filter(n => n.prog <= s).length, awans = poz(e0.po) - poz(e0.przed);
  ck("pierwsza piosenka (koło utworzone już w menu): nowe losowania = awans + 1 (bonus startowy), wolne = to, co czeka na kole (10-18, E-06)",
     menu0 === 1 && e0.losowania.nowe === awans + 1 && e0.losowania.wolne === P.losowania("Nowy"), [menu0, e0.losowania, awans]);
  const przedB = P.losowania("Nowy"), wB = P.losuj("Nowy", { rng: () => 0.3, kat: "instrument" });
  const l = JSON.parse(pamiec[P.KLUCZ]).ekipa.los;
  ck("losowanie na start: nowa ekipa dostaje 1 losowanie (bonus), losuj je zużywa przed poziomami (uzyte zostaje 0)",
     przedB >= 1 && wB && l.bonus === 0 && l.uzyte === 0 && P.losowania("Nowy") === przedB - 1, [przedB, l]);
}
{   // 10-19: w grze osiągnięcia są wyłączone: po piosence nic nowego, bez ich sławy i bez skrótów do skinów i scen
  P.ustawOsiagniecia(false);
  for (const k of Object.keys(pamiec)) delete pamiec[k]; P.przeladuj();
  const r0 = P.poGrze([{ id: "a", nazwa: "Bez", nazwaWlasna: true, zrodlo: "mysz" }], [wiersz("a", { precyzja: 99, gwiazdki: 5, maxKombo: 45 })], Object.assign({}, konf, { liczbaGraczy: 1 }));
  const x0 = r0[0] || {}, zysk0 = x0.ekipa ? x0.ekipa.zysk : null;
  P.ustawOsiagniecia(true);
  for (const k of Object.keys(pamiec)) delete pamiec[k]; P.przeladuj();
  const r1 = P.poGrze([{ id: "a", nazwa: "Bez", nazwaWlasna: true, zrodlo: "mysz" }], [wiersz("a", { precyzja: 99, gwiazdki: 5, maxKombo: 45 })], Object.assign({}, konf, { liczbaGraczy: 1 }));
  const x1 = r1[0] || {}, zysk1 = x1.ekipa ? x1.ekipa.zysk : null;
  P.ustawOsiagniecia(false);
  ck("osiągnięcia w grze wyłączone (10-19): domyślnie OFF, po piosence brak nowych, zrodloStylu = null, sława bez premii za osiągnięcia (ta sama gra przy włączonych daje ich więcej)",
     osiagWGrze === false && Array.isArray(x0.nowe) && x0.nowe.length === 0 && (x1.nowe || []).length > 0 && P.zrodloStylu("widownia", "synthwave") === null &&
     zysk0 != null && zysk1 != null && zysk0 < zysk1, [x0.nowe, (x1.nowe || []).map(o => o.id), zysk0, zysk1]);
}
console.log(JSON.stringify({ checks, skips, info, osiagniecia: O.map(o => [o.kategoria, o.id, o.poziom, o.nazwa, P.torNagrody(o) + ":" + o.nagroda[P.torNagrody(o)]]) }));
"""

# Limity rysowań na klatkę (pomiar 2026-10-04 + 30 % zapasu); stan bez limitu = sprawdzane tylko wyjątki i zakazane pola.
LIMITY = {"widownia": {"kombo": 207, "spoczynek": 158, "brawa": 184, "spokoj": 146}, "streak": {"og1": 89, "og2": 90, "og3": 94, "tor-kombo": 171, "tor-zero": 164}, "tlo": {"og3": 162, "og0": 153, "spokoj": 36}, "klawisze": {"tlo": 120, "spiew": 24, "cisza": 24, "spokoj": 12}}


def main():
    for f in ("efekty.js", "postepy.js", "gl-fx.js"):
        check("plik web/gry/js/%s istnieje" % f, os.path.isfile(os.path.join(GRY_JS, f)))
    node = shutil.which("node")
    if not node:
        skip("sprawdzenia JS (node --check, harness postępów i drabinek)", "brak node")
    else:
        for f in ("efekty.js", "postepy.js", "gl-fx.js") + tuple(MODULY):
            p = os.path.join(GRY_JS, f)
            if not os.path.isfile(p):
                skip("node --check web/gry/js/" + f, "brak pliku")
                continue
            r = subprocess.run([node, "--check", p], capture_output=True, text=True, encoding="utf-8")
            check("node --check web/gry/js/" + f, r.returncode == 0, (r.stderr or "")[:400])
        fd, sciezka = tempfile.mkstemp(suffix=".mjs", prefix="gry_postepy_")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as plik:
                plik.write(HARNESS.replace("__LIMITY__", json.dumps(LIMITY)))
            arg = [node, sciezka, GRY_JS] + (["--pomiar"] if "--pomiar" in sys.argv else [])
            out = subprocess.run(arg, capture_output=True, text=True, timeout=300, encoding="utf-8")
        finally:
            os.unlink(sciezka)
        linia = (out.stdout or "").strip().splitlines()[-1:] or [""]
        try:
            dane = json.loads(linia[0])
        except Exception:
            check("harness postępów zwraca JSON", False, ((out.stderr or "") + (out.stdout or ""))[-1500:])
            dane = None
        if dane:
            for nazwa, powod in dane["skips"]:
                skip(nazwa, powod)
            for nazwa, ok, szczegol in dane["checks"]:
                check(nazwa, ok, szczegol)
            if "-v" in sys.argv:
                print("\nKatalog osiągnięć:")
                for k, i, p, n, nag in dane["osiagniecia"]:
                    print("  %-12s %-16s %d  %-24s %s" % (k, i, p, n, nag))
                print("\nNajwięcej rysowań na klatkę (tor: stan → maks):")
                for k, v in dane["info"].items():
                    if k.startswith("maks_"):
                        print("  %-9s %s" % (k[5:], v))
                if "--pomiar" in sys.argv:
                    print("\nPomiar per stopień:", json.dumps(dane["info"]["pomiar"], ensure_ascii=False))
    # ---- kontrakt z grą i stroną (bez Node) ----
    html = open(os.path.join(REPO, "web", "gry", "index.html"), encoding="utf-8").read()
    kolej = ["js/gl-fx.js", "js/efekty.js"] + ["js/" + m for m in MODULY] + ["js/postepy.js", "js/zabi-chor.js"]
    poz = [html.find('<script src="%s"></script>' % s) for s in kolej]
    check("index.html: gl-fx → efekty → cztery moduły torów → postepy → zabi-chor (kolejność ładowania)", all(p > 0 for p in poz) and poz == sorted(poz), poz)
    zc = open(os.path.join(GRY_JS, "zabi-chor.js"), encoding="utf-8").read()
    core = open(os.path.join(REPO, "web", "js", "rf-00-core.js"), encoding="utf-8").read()
    m_zc = re.search(r'const ZC_DISCORD=\{serwer:"([^"]+)",pochwal:"([^"]+)"\}', zc)
    m_h = re.search(r'const RF_INVITE_HEADER="([^"]+)"', core)
    m_s = re.search(r'const RF_INVITE_SHOWCASE="([^"]+)"', core)
    check("Discord: ZC_DISCORD.serwer === RF_INVITE_HEADER, ZC_DISCORD.pochwal === RF_INVITE_SHOWCASE (rf-00-core.js)",
          bool(m_zc and m_h and m_s) and m_zc.group(1) == m_h.group(1) and m_zc.group(2) == m_s.group(1),
          (m_zc and m_zc.groups(), m_h and m_h.group(1), m_s and m_s.group(1)))
    a_menu = re.search(r'<a id="menuDiscord"[^>]*>', html)
    a_wyn = re.search(r'<a id="wynikiDiscord"[^>]*>', html)
    check("index.html: odnośniki Discorda w menu i na wynikach z target=_blank rel=noopener, ikona ../assets/icons/discord.png istnieje",
          bool(a_menu and a_wyn) and all('target="_blank"' in a.group(0) and 'rel="noopener"' in a.group(0) for a in (a_menu, a_wyn)) and
          html.count('src="../assets/icons/discord.png"') == 2 and os.path.isfile(os.path.join(REPO, "web", "assets", "icons", "discord.png")) and
          'id="btnKopiujWynik"' in html and 'class="menu-linki"' in html, (a_menu and a_menu.group(0), a_wyn and a_wyn.group(0)))
    check("zabi-chor.js: Discord tylko odnośnikami (bez fetch, iframe, webhooków do discord.*)",
          not re.search(r'fetch\([^)]*discord|<iframe|discord(app)?\.com/api/webhooks', zc, re.I) and 'el("menuDiscord")' in zc and "ZC_DISCORD.pochwal" in zc, "")
    check("zabi-chor.js: koniec gry woła Postepy.poGrze raz, obok zapisu tablicy wyników, z pakietem, id pakietu i datą",
          zc.count("Postepy.poGrze(") == 1 and zc.find("Tablica.zapiszGre(") < zc.find("Postepy.poGrze(") < zc.find("S.wyniki={ranking") and
          re.search(r"pakiet:zPakietu,pakietId:[^,]+,data:Date\.now\(\)", zc) is not None, "")
    check("zabi-chor.js: stopień gracza z Postepy.wybor (cztery tory), okno „Scena” z drabinkami i podglądem, blok „Sława” na wynikach",
          "(Postepy.wybor(n)||{})[tor]" in zc and "function otworzScene(" in zc and "function podgladSceny(" in zc and "function rysujSlawe(" in zc and
          "FX.podglad" in zc and "DzwiekiUI.graj(\"odblokowanie\")" in zc and zc.count("DzwiekiUI.graj(\"odblokowanie\")") == 1, "")
    i = zc.find("const T={")
    j = zc.find("\nfunction tt(", i)
    slownik = zc[i:j]
    klucze = ["scenaAuto", "scenaProg", "scenaAlboOsiagniecie", "scenaNaglowek", "slawaTytul", "slawaDzien", "slawaSeria", "awansTytul",
              "discordDymek", "discordPochwal", "kopiujWynik", "kopiujSzablon", "skopiowano", "scenaTlo", "scenaKlawisze"]
    check("słownik T: nowe klucze Sławy i Discorda są, bez pauz „—”, „Auto: zawsze najwyższy”, „próg {n} sławy”, „motyw {n} z {z}”",
          all(re.search(r"\b%s:\"" % k, slownik) for k in klucze) and "—" not in slownik and 'scenaAuto:"Auto: zawsze najwyższy"' in slownik and
          'scenaProg:"próg {n} sławy"' in slownik and "motyw {n} z {z}" in slownik and
          'discordDymek:"Serwer RibbitFlip: #pomoc, #pochwal-się, #zestawy, #pomysły"' in slownik,
          [k for k in klucze if not re.search(r"\b%s:\"" % k, slownik)])
    # konto na tym komputerze (js/konta.js, 10-10): jedno wejście w menu, ładowanie przed ZC.init, okno znane nawigacji,
    # za kontem idą ustawienia osoby, nie sprzętu
    with open(os.path.join(REPO, "web", "gry", "js", "konta.js"), encoding="utf-8") as f:
        kj = f.read()
    m = re.search(r"KLUCZE_KONTA=\[([^\]]*)\]", kj)
    klucze_konta = re.findall(r'"([^"]+)"', m.group(1)) if m else []
    check("konta.js: plakietka #menuKonto w #menu (jedno wejście do kont), skrypt po zabi-chor.js i PRZED skryptem startowym z ZC.init, "
          "okno #kontoOkno w nakladkaLobby, za kontem tylko ustawienia osoby (bez opóźnienia, grafiki, klatek, głośności)",
          'id="menuKonto"' in html and html.find('id="menu"') < html.find('id="menuKonto"') < html.find('id="wybor"') and
          html.find('src="js/zabi-chor.js"') < html.find('src="js/konta.js"') < html.find("ZC.init(") and
          'el("kontoOkno")' in zc and "window.wczytajUstawienia=" in kj and "window.zapiszUstawienia=" in kj and "window.dolacz=" in kj and
          "navigator.webdriver" in kj and len(klucze_konta) >= 10 and
          not set(klucze_konta) & {"opoznienie", "zakres", "grafika", "klatki", "glosnosc", "glosnoscPodklad", "glosnoscZaby",
                                   "glosnoscEfekty", "dzwiekiUI", "dzwiekiUIGlosnosc"} and "—" not in kj,
          klucze_konta)
    print("\n%d passed, %d failed, %d skipped" % (_passed, _failed, _skipped))
    return 1 if _failed else 0


if __name__ == "__main__":
    sys.exit(main())
