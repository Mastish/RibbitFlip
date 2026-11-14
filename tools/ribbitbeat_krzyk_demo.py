# Demo instrumentu „Krzyk” do odsłuchania BEZ uruchamiania gry, żeby nie trzeba było odpalać całej aplikacji.
#
# Wynik: build/krzyk-demo.html — JEDEN plik do dwukliku, bez serwera i bez internetu. W środku siedzi
# PRAWDZIWY SILNIK GRY (web/gry/js/glos.js, wklejony w całości) i prawdziwa receptura `krzyk`, wycięta
# z tego samego pliku. Nic nie jest tu przybliżone: to, co słychać w demie, to dokładnie to, co słychać
# w RibbitBeacie. Próbki idą do silnika przez `Glos.ustawProbki` (to samo wejście, z którego korzysta
# Studio instrumentów), więc nie trzeba niczego pobierać — WAV-y są wklejone jako base64.
#
# Demo porównuje DWA zestawy obok siebie: dzisiejszy z web/assets/krzyk/ i kopię sprzed wyrównania głośności
# z _backups/261021-krzyk-glosnosc/ (jeśli jest). O to w nim chodzi: usterka z 10-21 polegała na tym, że osiem
# nagrań grało z rozrzutem 10,8 dB, a silnik sięga po nie NA ZMIANĘ.
#
#   py -I -X utf8 tools/ribbitbeat_krzyk_demo.py [--otworz]
import base64
import json
import os
import sys
import webbrowser

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
ASSETY = os.path.join(REPO, "web", "assets", "krzyk")
PRZED = os.path.join(REPO, "_backups", "261021-krzyk-glosnosc")
WYNIK = os.path.join(REPO, "build", "krzyk-demo.html")


def domknij(src, od):
    """Koniec literału obiektu zaczynającego się na `{` w pozycji `od` (liczy nawiasy, pomija napisy)."""
    d, q = 0, None
    for i in range(od, len(src)):
        c = src[i]
        if q:
            if c == "\\":
                continue
            if c == q:
                q = None
            continue
        if c in "'\"`":
            q = c
            continue
        if c == "{":
            d += 1
        elif c == "}":
            d -= 1
            if d == 0:
                return i + 1
    raise SystemExit("nie znalazłem końca receptury `krzyk` w glos.js")


def receptura_krzyku(glos):
    i = glos.index("\n    krzyk:")
    j = glos.index("{", i)
    return glos[j:domknij(glos, j)]


def zestaw(kat):
    """{nazwa pliku, root, pętla, bajty WAV w base64} dla całego katalogu — albo None, gdy katalogu nie ma."""
    man = os.path.join(kat, "krzyk.json")
    if not os.path.isfile(man):
        return None
    m = json.load(open(man, encoding="utf-8"))
    out = []
    for p in m["probki"]:
        with open(os.path.join(kat, p["plik"]), "rb") as f:
            out.append({"plik": p["plik"], "root": p["root"], "petla": p["petla"],
                        "wav": base64.b64encode(f.read()).decode("ascii")})
    return out


SZABLON = r"""<!doctype html>
<meta charset="utf-8">
<title>Krzyk — demo (RibbitBeat)</title>
<style>
 :root{color-scheme:dark}
 body{margin:0;padding:28px 22px 40px;background:#1b1714;color:#f3ecdd;
      font:15px/1.5 system-ui,"Segoe UI",sans-serif;max-width:860px}
 h1{font-size:23px;margin:0 0 4px}
 h2{font-size:15px;margin:26px 0 8px;color:#eaa32b;text-transform:uppercase;letter-spacing:.06em}
 p{margin:0 0 10px;color:#cfc6b6}
 .ab{display:flex;gap:0;margin:14px 0 6px;border-radius:999px;overflow:hidden;width:max-content;
     box-shadow:inset 0 0 0 2px #4a4038}
 .ab button{border:0;background:transparent;color:#cfc6b6;font:700 14px/1 inherit;padding:11px 20px;cursor:pointer}
 .ab button.on{background:#ec1a83;color:#fff}
 .ab button:disabled{color:#6b6157;cursor:not-allowed}
 .rzad{display:flex;flex-wrap:wrap;gap:9px;margin:10px 0 4px}
 button.gra{border:0;border-radius:11px;background:#332c26;color:#f3ecdd;font:700 14px/1 inherit;
            padding:13px 17px;cursor:pointer;box-shadow:inset 0 0 0 1.5px #4a4038}
 button.gra:hover{background:#3f372f}
 button.gra.mala{padding:10px 0;width:46px;text-align:center}
 button.gra.teraz{background:#ec1a83;box-shadow:none}
 .stan{min-height:1.4em;color:#eaa32b;font-weight:700;margin:6px 0 0}
 table{border-collapse:collapse;margin:8px 0 0;font-size:13px}
 td{padding:3px 10px 3px 0;vertical-align:middle}
 td.pl{color:#9d9387;font-family:ui-monospace,Consolas,monospace}
 .slup{display:inline-block;height:11px;border-radius:3px;background:#6cb33f;vertical-align:middle}
 .slup.b{background:#ec1a83}
 .mi{color:#9d9387;font-size:13px}
 .ostrz{background:#3a2a14;border-left:4px solid #eaa32b;padding:9px 13px;border-radius:0 8px 8px 0;margin:12px 0}
 /* pole do śpiewania myszą — proporcje i zachowanie jak tor w grze */
 #pole{position:relative;height:260px;border-radius:14px;background:#241f1b;cursor:crosshair;
       box-shadow:inset 0 0 0 2px #4a4038;touch-action:none;-webkit-user-select:none;user-select:none;overflow:hidden}
 #pole.gra{box-shadow:inset 0 0 0 2px #ec1a83}
 #pole canvas{display:block;width:100%;height:100%}
 #podp{position:absolute;inset:auto 0 12px 0;text-align:center;color:#8d8377;font:600 13px/1 inherit;pointer-events:none}
 #pole.gra #podp{opacity:0}
 #odczyt{display:flex;gap:18px;align-items:baseline;margin:8px 0 0;min-height:1.6em}
 #nuta{font:800 22px/1 ui-monospace,Consolas,monospace;color:#f3ecdd;min-width:5ch}
 #szczegol{color:#9d9387;font-size:13px}
</style>
<h1>Krzyk — demo</h1>
<p>Prawdziwy silnik RibbitBeata i prawdziwa receptura instrumentu, wklejone w ten plik. Nic nie pobiera, nic nie zapisuje.</p>

<div class="ab" id="ab">
  <button data-k="po" class="on">po poprawce</button>
  <button data-k="przed">przed poprawką</button>
</div>
<p class="mi" id="ktory"></p>

<h2>Śpiewaj myszą</h2>
<p>Tak samo jak w grze: <b>przytrzymaj lewy przycisk</b> i prowadź mysz w górę i w dół. Szybki ruch
   w lewo i w prawo to wibrato. Kreski z boku to stroje ośmiu nagrań — im dalej od nich, tym mocniej
   silnik rozciąga próbkę.</p>
<div id="pole"><canvas id="plotno"></canvas><div id="podp">przytrzymaj i prowadź</div></div>
<div id="odczyt"><span id="nuta"></span><span id="szczegol"></span></div>

<h2>Ten sam dźwięk dziesięć razy</h2>
<p>Najważniejszy przycisk. Silnik sięga po osiem nagrań <b>na zmianę</b>, więc jeśli któreś jest głośniejsze,
   słychać to właśnie tutaj: ta sama nuta, a instrument skacze.</p>
<div class="rzad">
  <button class="gra" id="bDziesiec">▶ 10× ta sama nuta</button>
  <button class="gra" id="bFraza">▶ Fraza „AAA!”</button>
  <button class="gra" id="bTrzym">▶ Nuta trzymana (2 s)</button>
</div>

<h2>Osiem nagrań po kolei</h2>
<p>Każde zagrane osobno, przez ten sam instrument, na swoim stroju.</p>
<div class="rzad" id="solo"></div>

<h2>Zmierzona głośność</h2>
<p class="mi">Nuta 300 ms (atak + kawałek pętli), policzona w tej przeglądarce z tych samych bajtów, które przed chwilą grały.</p>
<table id="tabela"></table>
<p class="stan" id="stan"></p>

<script>__GLOS__</script>
<script>
"use strict";
const ZESTAWY = __ZESTAWY__;
const KRZYK = __RECEPTURA__;
const NUTA = 65;                       // w okolicy strojów ósemki — tu rotacja obejmuje najwięcej nagrań
let ktory = "po", pamiec = {}, zywy = null, timery = [];

const el = id => document.getElementById(id);
const db = v => 20 * Math.log10(Math.max(v, 1e-9));

function bajty(b64){
  const s = atob(b64), u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u.buffer;
}
// Dekodowanie TYM SAMYM parserem, co w grze — żadnej drugiej ścieżki, która mogłaby czytać inaczej.
function rozpakuj(k){
  if (pamiec[k]) return pamiec[k];
  pamiec[k] = ZESTAWY[k].map(p => {
    const w = Glos.parsujWav(bajty(p.wav));
    return {plik: p.plik, root: p.root, sr: w.sr, dane: w.dane,
            petla: [p.petla[0], Math.min(p.petla[1], w.dane.length / w.sr)]};
  });
  return pamiec[k];
}
function wstaw(k){
  const L = rozpakuj(k);
  Glos.ustawProbki("krzyk", L.map(p => ({sr: p.sr, dane: p.dane, root: p.root, petla: p.petla})));
  L.forEach((p, i) => {
    Glos.ustawProbki("solo" + i, [{sr: p.sr, dane: p.dane, root: p.root, petla: p.petla}]);
    Glos.dodajWlasny("w-solo" + i, Object.assign({}, KRZYK, {probki: "solo" + i}));
  });
  return L;
}
function stop(){
  timery.forEach(clearTimeout); timery = [];
  if (zywy) { try { zywy.spiewaj(false); const g = zywy; setTimeout(() => { try { g.zniszcz(); } catch(e){} }, 600); } catch(e){} }
  zywy = null;
  puscPole();
  document.querySelectorAll("button.gra.teraz").forEach(b => b.classList.remove("teraz"));
}
function glos(rodzaj){ return Glos.glos(rodzaj, Glos.skala(1), 0); }

function dziesiec(){
  stop();
  const c = Glos.odblokuj(); if (!c) return;
  const g = glos("krzyk"); zywy = g;
  const t0 = c.currentTime + .05, krok = .42;
  for (let i = 0; i < 10; i++) {
    const t = t0 + i * krok;
    g.ustaw(NUTA, .72, 0, t); g.spiewaj(true, t); g.spiewaj(false, t + krok * .62);
  }
  timery.push(setTimeout(stop, (krok * 10 + .6) * 1000));
  el("stan").textContent = "Gra: ta sama nuta dziesięć razy…";
}
function trzymana(){
  stop();
  const c = Glos.odblokuj(); if (!c) return;
  const g = glos("krzyk"); zywy = g;
  const t = c.currentTime + .05;
  g.ustaw(NUTA, .72, 0, t); g.spiewaj(true, t); g.spiewaj(false, t + 2);
  timery.push(setTimeout(stop, 2800));
  el("stan").textContent = "Gra: nuta trzymana — to słychać zapętlony odcinek.";
}
function fraza(){
  stop(); Glos.odblokuj();
  const dl = Glos.fraza("krzyk");
  el("stan").textContent = dl ? "Gra: fraza instrumentu…" : "Kliknij jeszcze raz (dźwięk się budzi).";
}
function solo(i, przycisk){
  stop();
  const c = Glos.odblokuj(); if (!c) return;
  const p = rozpakuj(ktory)[i];
  const g = glos("w-solo" + i); zywy = g;
  const t = c.currentTime + .05;
  g.ustaw(Math.round(p.root), .72, 0, t); g.spiewaj(true, t); g.spiewaj(false, t + .9);
  przycisk.classList.add("teraz");
  timery.push(setTimeout(stop, 1500));
  el("stan").textContent = "Gra: " + p.plik + " (strój " + p.root.toFixed(1) + ")";
}

// Głośność liczona tak, jak brzmi nuta: od początku próbki, potem pętla w kółko do 300 ms.
function nuta300(p){
  const sr = p.sr, s = Math.round(p.petla[0] * sr), e = Math.round(p.petla[1] * sr), ile = Math.round(sr * .3);
  let suma = 0, n = 0, i = 0;
  for (; i < Math.min(e, ile); i++) { suma += p.dane[i] * p.dane[i]; n++; }
  while (n < ile) { for (let j = s; j < e && n < ile; j++) { suma += p.dane[j] * p.dane[j]; n++; } }
  return db(Math.sqrt(suma / Math.max(1, n)));
}
function tabela(){
  const L = rozpakuj(ktory), v = L.map(nuta300);
  const lo = Math.min.apply(null, v), hi = Math.max.apply(null, v);
  el("tabela").innerHTML = L.map((p, i) =>
    '<tr><td class="pl">' + p.plik + '</td><td>' + v[i].toFixed(1) + ' dB</td><td style="width:320px">' +
    '<i class="slup' + (ktory === "przed" ? " b" : "") + '" style="width:' +
    Math.round(6 + (v[i] + 24) * 11) + 'px"></i></td></tr>').join("");
  el("ktory").textContent = (ktory === "po" ? "Dzisiejsze próbki z web/assets/krzyk/." :
    "Kopia sprzed wyrównania głośności (_backups/261021-krzyk-glosnosc/).") +
    " Rozrzut między najcichszym a najgłośniejszym nagraniem: " + (hi - lo).toFixed(1) + " dB.";
}
function przelacz(k){
  stop(); ktory = k; wstaw(k); tabela(); odswiezPole = true;   // kreski strojów są z zestawu
  document.querySelectorAll("#ab button").forEach(b => b.classList.toggle("on", b.dataset.k === k));
  el("stan").textContent = "";
}

// ---- pole do śpiewania myszą ------------------------------------------------------------------
// Wszystkie liczby poniżej są PRZEPISANE Z GRY, nie wymyślone:
//   zabi-chor.js `krokGracza`: deg = EMA(pitch, 0,06 s) → `stopnieNaPolton`, otwarcie = .35 + .5·poz,
//                              wib = EMA(min(50, |twist|/6), 0,12 s), i to samo `glos.ustaw(semi, otw, wib)`,
//   wejscie.js:                pitch = (y − 0,5)·2·zakres (domyślny zakres 40°), a wibrato z myszy to
//                              vx = 0,6·vx + 0,4·|dx|/dt (px/s, zerowane po 120 ms bezruchu) × WIB_MYSZ 0,5.
// LO/HI to zakres partii; w grze bierze się go z piosenki, tu jest stały i dobrany tak, żeby objąć stroje
// ósemki (61–67) plus oktawę w każdą stronę — czyli i „ryk”, i „pisk”.
const ZAKRES = 40, LO = 55, HI = 76, TAU_PITCH = .06, TAU_WIB = .12, WIB_MYSZ = .5, WIB_PROG = 150;
const NAZWY = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const pole = el("pole"), plotno = el("plotno");
let gra = false, celY = .5, deg = 0, wib = 0, vx = 0, ostX = null, ostT = 0, ostKlatka = 0, glosPola = null;

const nazwaNuty = m => NAZWY[((Math.round(m) % 12) + 12) % 12] + (Math.floor(Math.round(m) / 12) - 1);
const stopnieNaPolton = st => { const x = Math.max(-1, Math.min(1, st / ZAKRES)), d = LO - 2, g = HI + 2;
  return d + (g - d) * (1 - x) / 2; };
const ema = (p, cel, dt, tau) => (tau > 0 && isFinite(p)) ? p + (cel - p) * (1 - Math.exp(-dt / tau)) : cel;

function puscPole(){
  if (!gra) return;
  gra = false; pole.classList.remove("gra"); odswiezPole = true;   // jeszcze jedna klatka: znacznik znika
  if (glosPola) { try { glosPola.spiewaj(false); const g = glosPola; setTimeout(() => { try { g.zniszcz(); } catch(e){} }, 700); } catch(e){} }
  glosPola = null;
}
function zPola(e){
  const r = pole.getBoundingClientRect();
  celY = Math.max(0, Math.min(1, (e.clientY - r.top) / Math.max(1, r.height)));
  const t = performance.now();
  if (ostX !== null) { const dt = (t - ostT) / 1000;
    if (dt > 0 && dt < .15) vx = .6 * vx + .4 * Math.abs(e.clientX - ostX) / dt; }
  ostX = e.clientX; ostT = t;
}
pole.addEventListener("pointerdown", e => {
  if (e.button !== 0) return;
  e.preventDefault(); pole.setPointerCapture(e.pointerId);
  stop();                                   // „10×” albo fraza ustępuje polu
  const c = Glos.odblokuj(); if (!c) return;
  ostX = null; zPola(e); deg = (celY - .5) * 2 * ZAKRES; wib = 0;
  glosPola = glos("krzyk"); gra = true; pole.classList.add("gra");
  glosPola.ustaw(stopnieNaPolton(deg), .6, 0); glosPola.spiewaj(true);
  el("stan").textContent = "";
});
pole.addEventListener("pointermove", e => { if (gra || e.buttons === 0) zPola(e); });
for (const ev of ["pointerup", "pointercancel", "pointerleave"]) pole.addEventListener(ev, puscPole);

// Pętla klatek chodzi cały czas (jak w grze), ale RYSUJE tylko wtedy, gdy jest co zobaczyć: w trakcie
// śpiewania albo po zmianie, która rusza tło (start, A/B, zmiana rozmiaru okna). Inaczej otwarta karta
// przemalowywałaby kanwę sześćdziesiąt razy na sekundę po nic.
let odswiezPole = true;
function klatka(t){
  requestAnimationFrame(klatka);
  const dt = Math.min(.1, (t - ostKlatka) / 1000 || .016); ostKlatka = t;
  if (performance.now() - ostT > 120) vx = 0;        // mysz stoi: koniec wibrata
  if (!gra && !odswiezPole) return;
  deg = ema(deg, (celY - .5) * 2 * ZAKRES, dt, TAU_PITCH);
  wib = ema(wib, Math.min(50, (vx * WIB_MYSZ) / 6), dt, TAU_WIB);
  const semi = stopnieNaPolton(deg);
  const poz = Math.max(0, Math.min(1, (semi - (LO - 2)) / (HI - LO + 4)));
  if (gra && glosPola) glosPola.ustaw(semi, .35 + .5 * poz, wib);
  rysujPole(semi);
  odswiezPole = false;
  const liczyWib = vx * WIB_MYSZ >= WIB_PROG;
  el("nuta").textContent = gra ? nazwaNuty(semi) : "";
  el("szczegol").textContent = gra
    ? ("półton " + semi.toFixed(1) + (liczyWib ? " · wibrato" : "")) : "";
}
addEventListener("resize", () => { odswiezPole = true; });
function rysujPole(semi){
  const r = pole.getBoundingClientRect(), sz = Math.min(3, window.devicePixelRatio || 1);
  const w = Math.max(2, Math.round(r.width)), h = Math.max(2, Math.round(r.height));
  if (plotno.width !== Math.round(w * sz)) { plotno.width = Math.round(w * sz); plotno.height = Math.round(h * sz); }
  else if (plotno.height !== Math.round(h * sz)) plotno.height = Math.round(h * sz);
  const c = plotno.getContext("2d"); c.setTransform(sz, 0, 0, sz, 0, 0); c.clearRect(0, 0, w, h);
  const dol = LO - 2, gora = HI + 2, yNuty = m => h * (1 - (m - dol) / (gora - dol));
  c.strokeStyle = "rgba(255,255,255,.07)"; c.lineWidth = 1; c.font = "11px ui-monospace,Consolas,monospace";
  for (let m = Math.ceil(dol / 12) * 12; m <= gora; m += 12) {     // co oktawa: linia i podpis
    const y = yNuty(m);
    c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke();
    c.fillStyle = "rgba(243,236,221,.32)"; c.fillText(nazwaNuty(m), 8, y - 4);
  }
  for (const p of rozpakuj(ktory)) {                               // stroje ośmiu nagrań
    const y = yNuty(p.root);
    c.fillStyle = "rgba(234,163,43,.75)"; c.fillRect(w - 30, y - 1, 22, 2);
  }
  if (gra) {
    const y = yNuty(semi), szer = 16 + wib * 1.6;                  // wibrato rozpycha znacznik
    c.strokeStyle = "#ec1a83"; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke();
    c.fillStyle = "#ec1a83";
    c.beginPath(); c.ellipse(w / 2, y, szer, 7, 0, 0, Math.PI * 2); c.fill();
  }
}
requestAnimationFrame(klatka);

el("solo").innerHTML = ZESTAWY.po.map((p, i) =>
  '<button class="gra mala" data-i="' + i + '">' + (i + 1) + '</button>').join("");
el("solo").addEventListener("click", e => {
  const b = e.target.closest("button[data-i]"); if (b) solo(+b.dataset.i, b);
});
el("ab").addEventListener("click", e => {
  const b = e.target.closest("button[data-k]"); if (b && !b.disabled) przelacz(b.dataset.k);
});
el("bDziesiec").onclick = dziesiec;
el("bTrzym").onclick = trzymana;
el("bFraza").onclick = fraza;
if (!ZESTAWY.przed) {
  const b = document.querySelector('#ab button[data-k="przed"]');
  b.disabled = true; b.title = "Kopii sprzed poprawki nie ma na dysku";
}
przelacz("po");
</script>
"""


def main():
    glos = open(os.path.join(REPO, "web", "gry", "js", "glos.js"), encoding="utf-8").read()
    po = zestaw(ASSETY)
    if not po:
        raise SystemExit("nie ma web/assets/krzyk/krzyk.json")
    przed = zestaw(PRZED)
    zest = {"po": po, "przed": przed}
    html = (SZABLON
            .replace("__GLOS__", glos)
            .replace("__ZESTAWY__", json.dumps(zest, ensure_ascii=False))
            .replace("__RECEPTURA__", receptura_krzyku(glos)))
    os.makedirs(os.path.dirname(WYNIK), exist_ok=True)
    open(WYNIK, "w", encoding="utf-8", newline="\n").write(html)
    print("zapisano %s (%d kB)%s" % (os.path.normpath(WYNIK), os.path.getsize(WYNIK) // 1024,
                                     "" if przed else "  [bez kopii sprzed poprawki: A/B wyłączone]"))
    if "--otworz" in sys.argv:
        webbrowser.open("file:///" + WYNIK.replace("\\", "/"))


if __name__ == "__main__":
    main()
