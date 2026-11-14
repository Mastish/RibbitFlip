# Demo instrumentów z NAGRAŃ do odsłuchania BEZ uruchamiania gry (2026-10-21).
# Ten sam pomysł, co tools/ribbitbeat_krzyk_demo.py.
#
# Wynik: build/probki-demo.html — JEDEN plik do dwukliku, bez serwera i bez internetu. W środku siedzi PRAWDZIWY SILNIK GRY
# (web/gry/js/glos.js, wklejony w całości) z prawdziwymi recepturami, a próbki z web/assets/<instrument>/ są wklejone jako
# base64 i wchodzą do silnika przez `Glos.ustawProbki(nazwa, lista, strefy=true)` — czyli grają dokładnie tak, jak w
# RibbitBeacie. Przełącznik „nagrania / oscylatory” zdejmuje zestaw z tablicy próbek (`Glos.usunProbki`), więc słychać
# TEN SAM instrument głosem zastępczym, którym gra zagra, zanim pliki dojadą — i którym grał do dziś.
#
#   py -I -X utf8 tools/ribbitbeat_probki_demo.py [--otworz]
import base64
import json
import os
import re
import sys
import webbrowser

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
ASSETY = os.path.join(REPO, "web", "assets")
WYNIK = os.path.join(REPO, "build", "probki-demo.html")


def instrumenty_z_nagran(glos):
    """[(id, zestaw, okt)] z tablicy RECEPTURY: każda receptura z `probki` (dziesięć z `probkiRec` i Krzyk)."""
    blok = glos[glos.index("const RECEPTURY={"):glos.index("const Z_PROBEK=")]
    out = []
    for m in re.finditer(r'^\s*([a-z]+):\s*\{(.*probki:"([a-z]+)".*)$', blok, re.M):
        okt = re.search(r"probkaOkt:(-?\d)", m.group(2))
        out.append((m.group(1), m.group(3), int(okt.group(1)) if okt else 0))
    return out


def nazwy(plik):
    src = open(os.path.join(REPO, "web", "gry", "js", plik), encoding="utf-8").read()
    blok = re.search(r"instrumentyGracza:\{(.*?)\}", src, re.S).group(1)
    return dict(re.findall(r'([a-z]+):"([^"]*)"', blok))


def zestaw(nazwa):
    kat = os.path.join(ASSETY, nazwa)
    m = json.load(open(os.path.join(kat, nazwa + ".json"), encoding="utf-8"))
    out = []
    for p in m["probki"]:
        with open(os.path.join(kat, p["plik"]), "rb") as f:
            b = f.read()
        out.append({"plik": p["plik"], "nazwa": p.get("nazwa", ""), "nuta": p.get("nuta"), "root": p["root"], "petla": p["petla"],
                    "kb": round(len(b) / 1024), "wav": base64.b64encode(b).decode("ascii")})
    return {"probki": out, "zrodlo": m.get("zrodlo", {}), "strefy": bool(m.get("strefy"))}


SZABLON = r"""<!doctype html>
<meta charset="utf-8">
<title>Instrumenty z nagrań — demo (RibbitBeat)</title>
<style>
 :root{color-scheme:dark}
 body{margin:0;padding:28px 22px 40px;background:#1b1714;color:#f3ecdd;font:15px/1.5 system-ui,"Segoe UI",sans-serif;max-width:900px}
 h1{font-size:23px;margin:0 0 4px}
 h2{font-size:15px;margin:26px 0 8px;color:#eaa32b;text-transform:uppercase;letter-spacing:.06em}
 p{margin:0 0 10px;color:#cfc6b6}
 .mi{color:#9d9387;font-size:13px}
 .rzad{display:flex;flex-wrap:wrap;gap:9px;margin:10px 0 4px}
 button.gra,button.inst{border:0;border-radius:11px;background:#332c26;color:#f3ecdd;font:700 14px/1 inherit;padding:13px 17px;cursor:pointer;box-shadow:inset 0 0 0 1.5px #4a4038}
 button.gra:hover,button.inst:hover{background:#3f372f}
 button.inst.on{background:#6cb33f;color:#14200c;box-shadow:none}
 button.gra.teraz{background:#ec1a83;box-shadow:none}
 .ab{display:flex;margin:14px 0 6px;border-radius:999px;overflow:hidden;width:max-content;box-shadow:inset 0 0 0 2px #4a4038}
 .ab button{border:0;background:transparent;color:#cfc6b6;font:700 14px/1 inherit;padding:11px 20px;cursor:pointer}
 .ab button.on{background:#ec1a83;color:#fff}
 .stan{min-height:1.4em;color:#eaa32b;font-weight:700;margin:6px 0 0}
 table{border-collapse:collapse;margin:8px 0 0;font-size:13px}
 td,th{padding:3px 12px 3px 0;vertical-align:middle;text-align:left}
 th{color:#9d9387;font-weight:600}
 td.pl{color:#9d9387;font-family:ui-monospace,Consolas,monospace}
 #pole{position:relative;height:260px;border-radius:14px;background:#241f1b;cursor:crosshair;box-shadow:inset 0 0 0 2px #4a4038;touch-action:none;-webkit-user-select:none;user-select:none;overflow:hidden}
 #pole.gra{box-shadow:inset 0 0 0 2px #ec1a83}
 #pole canvas{display:block;width:100%;height:100%}
 #podp{position:absolute;inset:auto 0 12px 0;text-align:center;color:#8d8377;font:600 13px/1 inherit;pointer-events:none}
 #pole.gra #podp{opacity:0}
 #odczyt{display:flex;gap:18px;align-items:baseline;margin:8px 0 0;min-height:1.6em}
 #nuta{font:800 22px/1 ui-monospace,Consolas,monospace;color:#f3ecdd;min-width:5ch}
 #szczegol{color:#9d9387;font-size:13px}
 a{color:#9ad6ff}
</style>
<h1>Instrumenty z nagrań — demo</h1>
<p>Prawdziwy silnik RibbitBeata i prawdziwe receptury, wklejone w ten plik razem z próbkami z <code>web/assets/</code>.
   Nic nie pobiera, nic nie zapisuje. Nagrania: <a href="https://github.com/sgossner/VSCO-2-CE">VSCO 2 Community Edition</a> (CC0).</p>

<h2>Instrument</h2>
<div class="rzad" id="lista"></div>
<div class="ab" id="ab">
  <button data-k="nagr" class="on">nagrania</button>
  <button data-k="synt">oscylatory (głos zastępczy, dawne brzmienie)</button>
</div>
<div class="ab" id="abPrz">
  <button data-k="auto" class="on">przejścia: jak w grze (domyślne)</button>
  <button data-k="skok">skokowo</button>
  <button data-k="plynne">płynnie</button>
</div>
<p class="mi" id="przOpis"></p>

<h2>Posłuchaj</h2>
<div class="rzad">
  <button class="gra" id="bFraza">▶ Fraza instrumentu</button>
  <button class="gra" id="bTrzym">▶ Nuta trzymana (3 s)</button>
  <button class="gra" id="bGama">▶ Gama C4–C5 (przez strefy)</button>
  <button class="gra" id="bLegato">▶ Melodia w jednym oddechu</button>
  <button class="gra" id="bGliss">▶ Zjazd 2 oktawy w jednej nucie</button>
  <button class="gra" id="bWszystkie">▶ Wszystkie po kolei (fraza)</button>
</div>
<p class="stan" id="stan"></p>

<h2>Śpiewaj myszą</h2>
<p>Tak samo jak w grze: <b>przytrzymaj lewy przycisk</b> i prowadź mysz w górę i w dół. Szybki ruch w lewo i w prawo to
   wibrato. Kreski z boku to stroje stref (nagrań) przeliczone na nutę śpiewaną — między nimi silnik przestraja najbliższą.
   Tu nie ma nut piosenki, więc skokowo głos staje na każdym półtonie; w grze staje tylko na nutach piosenki.</p>
<div id="pole"><canvas id="plotno"></canvas><div id="podp">przytrzymaj i prowadź</div></div>
<div id="odczyt"><span id="nuta"></span><span id="szczegol"></span></div>

<h2>Strefy wybranego instrumentu</h2>
<table id="tabela"></table>
<p class="mi" id="zrodlo"></p>

<script>__GLOS__</script>
<script>
"use strict";
const ZESTAWY = __ZESTAWY__;       // {id: {nazwa, zestaw, okt, probki:[{plik, nazwa, nuta, root, petla, kb, wav}], zrodlo}}
const IDS = Object.keys(ZESTAWY);
let biezacy = IDS[0], tryb = "nagr", pamiec = {}, zywy = null, timery = [];
const el = id => document.getElementById(id);

function bajty(b64){ const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; }
// Dekodowanie TYM SAMYM parserem, co w grze.
function rozpakuj(id){
  if (pamiec[id]) return pamiec[id];
  pamiec[id] = ZESTAWY[id].probki.map(p => { const w = Glos.parsujWav(bajty(p.wav));
    return {sr: w.sr, dane: w.dane, root: p.root, petla: [p.petla[0], Math.min(p.petla[1], w.dane.length / w.sr)]}; });
  return pamiec[id];
}
function wstawWszystkie(){ for (const id of IDS) Glos.ustawProbki(ZESTAWY[id].zestaw, rozpakuj(id), ZESTAWY[id].strefy); }   // Krzyk: warianty na zmianę, nie strefy
function usunWszystkie(){ for (const id of IDS) Glos.usunProbki(ZESTAWY[id].zestaw); }
function ustawTryb(k){ stop(); tryb = k; if (k === "nagr") wstawWszystkie(); else usunWszystkie();
  document.querySelectorAll("#ab button").forEach(b => b.classList.toggle("on", b.dataset.k === k)); }

function stop(){
  timery.forEach(clearTimeout); timery = [];
  if (zywy) { try { zywy.spiewaj(false); const g = zywy; setTimeout(() => { try { g.zniszcz(); } catch(e){} }, 800); } catch(e){} }
  zywy = null; Glos.stopProbka(); puscPole();
  document.querySelectorAll("button.gra.teraz").forEach(b => b.classList.remove("teraz"));
}
// ten sam tryb przejść, który gra ustawia głosowi z przełącznika na karcie gracza (`opcje.przejscia`)
function glos(id){ return Glos.glos(id, Glos.skala(1), 0, null, { przejscia }); }
function fraza(){ stop(); Glos.odblokuj(); const dl = Glos.fraza(biezacy, { przejscia });
  el("stan").textContent = dl ? "Gra: fraza — " + ZESTAWY[biezacy].nazwa : "Kliknij jeszcze raz (dźwięk się budzi)."; }
function trzymana(){
  stop(); const c = Glos.odblokuj(); if (!c) return;
  const g = glos(biezacy); zywy = g; const t = c.currentTime + .05;
  g.ustaw(67, .7, 0, t); g.spiewaj(true, t); g.spiewaj(false, t + 3);
  timery.push(setTimeout(stop, 3900)); el("stan").textContent = "Gra: nuta G4 trzymana 3 s — słychać zapętlony odcinek.";
}
function gama(){
  stop(); const c = Glos.odblokuj(); if (!c) return;
  const g = glos(biezacy); zywy = g; const t0 = c.currentTime + .05, krok = .38;
  [60, 62, 64, 65, 67, 69, 71, 72].forEach((m, i) => { const t = t0 + i * krok; g.ustaw(m, .7, 0, t); g.spiewaj(true, t); g.spiewaj(false, t + krok * .8); });
  timery.push(setTimeout(stop, (krok * 8 + .8) * 1000)); el("stan").textContent = "Gra: gama C4–C5 — każda nuta to osobny start próbki z najbliższej strefy.";
}
function glissando(){
  stop(); const c = Glos.odblokuj(); if (!c) return;
  const g = glos(biezacy); zywy = g; const t = c.currentTime + .05;
  g.ustaw(55, .6, 0, t); g.spiewaj(true, t);
  for (let i = 1; i <= 60; i++) g.ustaw(55 + 24 * i / 60, .6 + .3 * i / 60, 0, t + i * .05);
  g.spiewaj(false, t + 3.4);
  timery.push(setTimeout(stop, 4200));
  el("stan").textContent = "Gra: zjazd G3→G5 w jednej nucie — skokowo: półtony z artykulacją; płynnie: próbka strefy startowej rozciągana.";
}
// melodia bez puszczania nuty (jak frazowanie na jednym oddechu): tu słychać przejścia między nutami, nie ataki osobnych nut.
// Jak w grze (zabi-chor.js `nutyGlosu`): głos dostaje nuty melodii — na nucie ją samą, w przejściu obie — więc skokowo staje
// tylko na nich (skok 67→71 to jeden krok, nie 67-68-69-70-71), a płynnie i tak jedzie za śpiewem.
function melodiaLegato(){
  stop(); const c = Glos.odblokuj(); if (!c) return;
  const g = glos(biezacy); zywy = g; const t = c.currentTime + .05;
  const nuty = [60, 62, 64, 65, 67, 69, 71, 72, 71, 67, 64, 60];
  g.ustaw(nuty[0], .7, 0, t, [nuty[0]]); g.spiewaj(true, t);
  nuty.forEach((m, i) => { if (i) { const a = nuty[i - 1];
    for (let k = 1; k <= 4; k++) g.ustaw(a + (m - a) * k / 4, .7, 0, t + i * .3 - .06 + k * .015, [a, m]);
    g.ustaw(m, .7, 0, t + i * .3 + .02, [m]); } });
  g.spiewaj(false, t + nuty.length * .3);
  timery.push(setTimeout(stop, (nuty.length * .3 + .8) * 1000));
  el("stan").textContent = "Gra: melodia w jednym oddechu, jak w grze — skokowo jeden krok z nowym atakiem na każdą nutę melodii; płynnie zjazd.";
}
// przełącznik przejść = to samo, co przełącznik na karcie gracza w grze: "auto" (domyślne instrumentu), "skok", "plynne";
// głos buduje się z tym trybem przy każdym starcie, więc działa od następnej nuty
let przejscia = undefined;
function ustawPrzejscia(k){
  stop(); przejscia = k === "auto" ? undefined : k;
  document.querySelectorAll("#abPrz button").forEach(b => b.classList.toggle("on", b.dataset.k === k));
  opiszPrzejscia();
}
function opiszPrzejscia(){
  const r = Glos.RECEPTURY[biezacy] || {}, pr = r.probkiRec || r, dom = Glos.domyslnePrzejscia(biezacy), tryb = przejscia || dom;
  const l = pr.legato || r.legato, a = pr.artyk || r.artyk;
  el("przOpis").textContent = (przejscia ? "" : "Domyślnie dla tego instrumentu: " + (dom === "skok" ? "skokowo" : "płynnie") + ". ") +
    (tryb === "plynne" ? "Płynnie: wysokość próbki goni śpiew ciągle, między nutami słychać zjazd (tak gra puzon i trąbka)."
    : "Skokowo: kroki z nuty na nutę z wejściem " + Math.round((l ? l.czas : .07) * 1000) + " ms, swoboda intonacji " + Math.round((l ? l.swoboda : .25) * 100) + " % (najwyżej pół półtonu)" +
      "; nowa nuta = nowe źródło od " + Math.round((a ? a.od : .012) * 1000) + " ms nagrania, przenikanie " + Math.round((a ? a.zlep : .04) * 1000) + " ms" +
      (l ? "." : " (nastawy ogólne, instrument nie ma własnych)."));
}
function wszystkie(){
  stop(); Glos.odblokuj(); let t = 0;
  IDS.forEach(id => { timery.push(setTimeout(() => { wybierz(id); Glos.fraza(id, { przejscia }); el("stan").textContent = "Gra: " + ZESTAWY[id].nazwa; }, t * 1000)); t += 3.2; });
  timery.push(setTimeout(() => el("stan").textContent = "", t * 1000));
}
function wybierz(id){
  biezacy = id; odswiezPole = true; opiszPrzejscia();
  document.querySelectorAll("#lista button").forEach(b => b.classList.toggle("on", b.dataset.id === id));
  const z = ZESTAWY[id];
  el("tabela").innerHTML = "<tr><th>plik</th><th>nagranie źródłowe</th><th>nuta</th><th>strój</th><th>pętla</th><th>rozmiar</th></tr>" +
    z.probki.map(p => '<tr><td class="pl">' + p.plik + '</td><td class="pl">' + p.nazwa + '</td><td>' + p.nuta + '</td><td>' + p.root.toFixed(2) +
      '</td><td>' + Math.round((p.petla[1] - p.petla[0]) * 1000) + ' ms</td><td>' + p.kb + ' kB</td></tr>').join("");
  el("zrodlo").textContent = (z.zrodlo.nazwa || "") + (z.zrodlo.katalog ? " · " + z.zrodlo.katalog : "") + (z.zrodlo.licencja ? " · " + z.zrodlo.licencja : "") +
    (z.okt ? " · próbka gra " + Math.abs(z.okt) + (Math.abs(z.okt) === 1 ? " oktawę" : " oktawy") + (z.okt > 0 ? " wyżej" : " niżej") + " niż nuta śpiewana (jak dotąd oscylatory)" : "");
}

// ---- pole do śpiewania myszą (liczby przepisane z gry, jak w demie Krzyku) ----
const ZAKRES = 40, LO = 55, HI = 79, TAU_PITCH = .06, TAU_WIB = .12, WIB_MYSZ = .5, WIB_PROG = 150;
const NAZWY = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const pole = el("pole"), plotno = el("plotno");
let gra = false, celY = .5, deg = 0, wib = 0, vx = 0, ostX = null, ostT = 0, ostKlatka = 0, glosPola = null, odswiezPole = true;
const nazwaNuty = m => NAZWY[((Math.round(m) % 12) + 12) % 12] + (Math.floor(Math.round(m) / 12) - 1);
const stopnieNaPolton = st => { const x = Math.max(-1, Math.min(1, st / ZAKRES)), d = LO - 2, g = HI + 2; return d + (g - d) * (1 - x) / 2; };
const ema = (p, cel, dt, tau) => (tau > 0 && isFinite(p)) ? p + (cel - p) * (1 - Math.exp(-dt / tau)) : cel;
function puscPole(){
  if (!gra) return;
  gra = false; pole.classList.remove("gra"); odswiezPole = true;
  if (glosPola) { try { glosPola.spiewaj(false); const g = glosPola; setTimeout(() => { try { g.zniszcz(); } catch(e){} }, 900); } catch(e){} }
  glosPola = null;
}
function zPola(e){
  const r = pole.getBoundingClientRect();
  celY = Math.max(0, Math.min(1, (e.clientY - r.top) / Math.max(1, r.height)));
  const t = performance.now();
  if (ostX !== null) { const dt = (t - ostT) / 1000; if (dt > 0 && dt < .15) vx = .6 * vx + .4 * Math.abs(e.clientX - ostX) / dt; }
  ostX = e.clientX; ostT = t;
}
pole.addEventListener("pointerdown", e => {
  if (e.button !== 0) return;
  e.preventDefault(); pole.setPointerCapture(e.pointerId);
  stop(); const c = Glos.odblokuj(); if (!c) return;
  ostX = null; zPola(e); deg = (celY - .5) * 2 * ZAKRES; wib = 0;
  glosPola = glos(biezacy); gra = true; pole.classList.add("gra");
  glosPola.ustaw(stopnieNaPolton(deg), .6, 0); glosPola.spiewaj(true);
  el("stan").textContent = "";
});
pole.addEventListener("pointermove", e => { if (gra || e.buttons === 0) zPola(e); });
for (const ev of ["pointerup", "pointercancel", "pointerleave"]) pole.addEventListener(ev, puscPole);
function klatka(t){
  requestAnimationFrame(klatka);
  const dt = Math.min(.1, (t - ostKlatka) / 1000 || .016); ostKlatka = t;
  if (performance.now() - ostT > 120) vx = 0;
  if (!gra && !odswiezPole) return;
  deg = ema(deg, (celY - .5) * 2 * ZAKRES, dt, TAU_PITCH);
  wib = ema(wib, Math.min(50, (vx * WIB_MYSZ) / 6), dt, TAU_WIB);
  const semi = stopnieNaPolton(deg), poz = Math.max(0, Math.min(1, (semi - (LO - 2)) / (HI - LO + 4)));
  if (gra && glosPola) glosPola.ustaw(semi, .35 + .5 * poz, wib);
  rysujPole(semi); odswiezPole = false;
  el("nuta").textContent = gra ? nazwaNuty(semi) : "";
  el("szczegol").textContent = gra ? ("półton " + semi.toFixed(1) + (vx * WIB_MYSZ >= WIB_PROG ? " · wibrato" : "")) : "";
}
addEventListener("resize", () => { odswiezPole = true; });
function rysujPole(semi){
  const r = pole.getBoundingClientRect(), sz = Math.min(3, window.devicePixelRatio || 1);
  const w = Math.max(2, Math.round(r.width)), h = Math.max(2, Math.round(r.height));
  if (plotno.width !== Math.round(w * sz) || plotno.height !== Math.round(h * sz)) { plotno.width = Math.round(w * sz); plotno.height = Math.round(h * sz); }
  const c = plotno.getContext("2d"); c.setTransform(sz, 0, 0, sz, 0, 0); c.clearRect(0, 0, w, h);
  const dol = LO - 2, gora = HI + 2, yNuty = m => h * (1 - (m - dol) / (gora - dol));
  c.strokeStyle = "rgba(255,255,255,.07)"; c.lineWidth = 1; c.font = "11px ui-monospace,Consolas,monospace";
  for (let m = Math.ceil(dol / 12) * 12; m <= gora; m += 12) { const y = yNuty(m);
    c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); c.fillStyle = "rgba(243,236,221,.32)"; c.fillText(nazwaNuty(m), 8, y - 4); }
  const z = ZESTAWY[biezacy];
  for (const p of z.probki) { const y = yNuty(p.root - 12 * z.okt); c.fillStyle = "rgba(234,163,43,.75)"; c.fillRect(w - 30, y - 1, 22, 2); }
  if (gra) { const y = yNuty(semi), szer = 16 + wib * 1.6;
    c.strokeStyle = "#ec1a83"; c.lineWidth = 2; c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke();
    c.fillStyle = "#ec1a83"; c.beginPath(); c.ellipse(w / 2, y, szer, 7, 0, 0, Math.PI * 2); c.fill(); }
}
requestAnimationFrame(klatka);

el("lista").innerHTML = IDS.map(id => '<button class="inst" data-id="' + id + '">' + ZESTAWY[id].nazwa + '</button>').join("");
el("lista").addEventListener("click", e => { const b = e.target.closest("button[data-id]"); if (b) { stop(); wybierz(b.dataset.id); } });
el("ab").addEventListener("click", e => { const b = e.target.closest("button[data-k]"); if (b) ustawTryb(b.dataset.k); });
el("abPrz").addEventListener("click", e => { const b = e.target.closest("button[data-k]"); if (b) ustawPrzejscia(b.dataset.k); });
el("bFraza").onclick = fraza; el("bTrzym").onclick = trzymana; el("bGama").onclick = gama; el("bLegato").onclick = melodiaLegato; el("bGliss").onclick = glissando; el("bWszystkie").onclick = wszystkie;
wstawWszystkie(); ustawPrzejscia("auto"); wybierz(biezacy);
</script>
"""


def main():
    glos = open(os.path.join(REPO, "web", "gry", "js", "glos.js"), encoding="utf-8").read()
    pl = nazwy("zabi-chor.js")
    zest = {}
    for id_, nazwa, okt in instrumenty_z_nagran(glos):
        z = zestaw(nazwa)
        zest[id_] = {"nazwa": pl.get(id_, id_), "zestaw": nazwa, "okt": okt, "probki": z["probki"], "zrodlo": z["zrodlo"], "strefy": z["strefy"]}
    if not zest:
        raise SystemExit("w glos.js nie ma receptur z `probki` i `probkiRec`")
    html = SZABLON.replace("__GLOS__", glos).replace("__ZESTAWY__", json.dumps(zest, ensure_ascii=False))
    os.makedirs(os.path.dirname(WYNIK), exist_ok=True)
    open(WYNIK, "w", encoding="utf-8", newline="\n").write(html)
    print("zapisano %s (%d kB, %d instrumentów: %s)" % (os.path.normpath(WYNIK), os.path.getsize(WYNIK) // 1024, len(zest), ", ".join(zest)))
    if "--otworz" in sys.argv:
        webbrowser.open("file:///" + WYNIK.replace("\\", "/"))


if __name__ == "__main__":
    main()
