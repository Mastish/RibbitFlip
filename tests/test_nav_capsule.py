# Test portretu aktywnego kapsla w nawigacji (blok `#rfNavCap` nad sekcją „Moduł").
# Uruchom: py tests/test_nav_capsule.py
#
# PO CO TEN BLOK ISTNIEJE. Kropki przy modułach opisują JEDEN kapsel — ten wybrany. Wybierało się
# go jednak w PRAWEJ kolumnie, więc pytanie „czyje są te kropki" i odpowiedź stały po dwóch
# stronach okna. Nad kropkami stoi teraz duży rysunek kapsla ze strzałkami po bokach.
#
# STĄD KSZTAŁT ASERCJI. Nie sprawdzamy, czy w pliku jest jakiś napis — napis da się dopisać, nie
# zmieniając niczego w zachowaniu. Sprawdzamy cztery rzeczy, na których taki blok realnie pada:
#   1. MIEJSCE — blok musi powstać NAD sekcją „Moduł", bo kolejność w pionie jest tu treścią;
#      wstawiony niżej mówiłby o kropkach, które są nad nim.
#   2. DROGA ZMIANY KAPSLA — strzałki muszą iść przez `switchDevice`. Ustawienie samego
#      `state.activeDeviceId` zostawia reguły, warstwę, bufory i panele na poprzednim kapslu,
#      a panel WYGLĄDA przy tym poprawnie — to jest awaria cicha i dlatego mierzona tutaj
#      przez REALNE wykonanie `_capStep` (wycięte z pliku i uruchomione w `vm`), a nie przez grep.
#   3. ODŚWIEŻANIE — blok ma mówić prawdę po kliknięciu pigułki, po zmianie nazwy/rysunku, po
#      zmianie połączenia z SSE i po dodaniu/usunięciu slotu. Wszystkie cztery drogi przechodzą
#      przez `renderDeviceSelector` / `setViewDev` / `updateTabDots` — każde z tych miejsc musi
#      wołać `rfNavCapSync`, a samo odświeżenie musi być RÓŻNICOWE (odbudowa zabrałaby fokus
#      ze strzałki pod kursorem).
#   4. JEDEN KAPSEL — strzałki mają być WYGASZONE, nie schowane: kontrolka, która znika, zabiera
#      odpowiedź na pytanie „a gdzie to było".
#
# Nic tu nie otwiera przeglądarki i nie wymaga serwera. Część dynamiczna potrzebuje `node`
# (funkcje są wycinane z pliku po nazwie i wykonywane naprawdę, jak w tests/devices_hub_harness.mjs);
# gdy node-a nie ma, te trzy asercje zgłaszają FAIL zamiast po cichu zniknąć.
import json
import os
import re
import subprocess
import sys
import tempfile

# Konsola Windows bez UTF-8 wywraca print() na polskich znakach — liczy się PASS/FAIL, nie glify.
try:
    sys.stdout.reconfigure(errors="replace")
except Exception:
    pass

_passed = 0
_failed = 0


def check(name, cond, detail=""):
    global _passed, _failed
    if cond:
        _passed += 1
        print("PASS  %s" % name)
    else:
        _failed += 1
        print("FAIL  %s%s" % (name, ("  [%s]" % detail) if detail else ""))


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read(*parts):
    with open(os.path.join(ROOT, *parts), "r", encoding="utf-8") as f:
        return f.read()


COLS = read("web", "js", "rf-34b-cols.js")
DEV = read("web", "js", "rf-11-devices-ui.js")
TABS = read("web", "js", "rf-34-tabs.js")
CSS = read("web", "css", "20-cols.css")
I18N = read("web", "js", "rf-01-i18n.js")


def fn_body(src, decl):
    """Treść funkcji od jej nagłówka do domknięcia klamry (liczonej po balansie)."""
    i = src.index(decl)
    j = src.index("{", i)
    depth = 0
    for k in range(j, len(src)):
        if src[k] == "{":
            depth += 1
        elif src[k] == "}":
            depth -= 1
            if depth == 0:
                return src[i:k + 1]
    raise AssertionError(decl + ": nie domknięta")


# ── a. miejsce w układzie: NAD „Moduł" ─────────────────────────────────────────────────────
print("--- a. miejsce w układzie ---")
_build = fn_body(COLS, "function build(o) {")
check("a1. blok jest budowany i wstawiany do karty nawigacji",
      "navCard.appendChild(buildNavCap());" in _build)
check("a2. ...PRZED „Zestawami” i sekcją „Moduły” (kolejność w pionie jest tu treścią)",
      _build.index("navCard.appendChild(buildNavCap());")
      < _build.index("navCard.appendChild(navTop);")
      < _build.index('navCard.appendChild(navSect("Moduły"));'))
check("a3. ...i POD paskiem „Nawigacja” (nie wypycha nagłówka karty)",
      _build.index("navCard.appendChild(navBar);")
      < _build.index("navCard.appendChild(buildNavCap());"))
check("a4. blok powstaje dokładnie raz (nie jest dublowany w prawej kolumnie)",
      COLS.count("buildNavCap()") == 2, COLS.count("buildNavCap()"))   # definicja + jedno wstawienie
_navcap_src = fn_body(COLS, "function buildNavCap()")
check("a5. to nie jest drugi hub kapsli — blok nie buduje ani jednej pigułki",
      "devpill" not in _navcap_src and "deviceSel" not in _navcap_src
      and " of " not in _navcap_src and "forEach" not in _navcap_src)   # zero pętli po kapslach

# ── b. droga zmiany kapsla: WYŁĄCZNIE switchDevice ────────────────────────────────────────
print("\n--- b. strzałki zmieniają kapsel przez switchDevice ---")
_step = fn_body(COLS, "function _capStep(delta)")
check("b1. _capStep woła switchDevice", "global.switchDevice(id)" in _step)
check("b2. ...i nigdzie w pliku nie ustawia state.activeDeviceId po swojemu",
      not re.search(r"state\.activeDeviceId\s*=", COLS))
_arrow = fn_body(COLS, "function mkCapArrow(next)")
check("b3. klik strzałki jest podpięty do _capStep (a nie do własnej ścieżki)",
      '"click"' in _arrow and "_capStep(next ? 1 : -1)" in _arrow)
check("b4. kolejność kapsli ta sama, co pigułek — sortowanie po meta.slot",
      "meta.slot" in fn_body(COLS, "function _capOrder()")
      and "meta.slot" in fn_body(DEV, "function renderDeviceSelector()"))

# ── b-dyn. te same funkcje URUCHOMIONE, nie tylko przeczytane ─────────────────────────────
_harness = r"""
import fs from "node:fs";
import vm from "node:vm";
const src = fs.readFileSync(process.argv[2], "utf8");
function cut(name){
  const i = src.indexOf("function " + name + "(");
  if (i < 0) throw new Error(name + " nie ma w pliku");
  let depth = 0;
  const j = src.indexOf("{", i);
  for (let k = j; k < src.length; k++){
    if (src[k] === "{") depth++;
    else if (src[k] === "}"){ depth--; if (!depth) return src.slice(i, k + 1); }
  }
  throw new Error(name + ": nie domknieta");
}
const calls = [];
const ctx = { state:{ devices:{}, activeDeviceId:"d0" },
              global:{ switchDevice:(id)=>calls.push(id) }, console };
vm.createContext(ctx);
vm.runInContext(cut("_capOrder"), ctx);
vm.runInContext(cut("_capStep"), ctx);
const order = () => vm.runInContext("_capOrder()", ctx);
const step  = (d) => vm.runInContext("_capStep(" + d + ")", ctx);
const out = {};

// Klucze obiektu celowo w innej kolejnosci niz sloty — kolejnosc ma brac sie ze slotu.
ctx.state.devices = { d5:{meta:{dev:"d5",slot:2}}, d1:{meta:{dev:"d1",slot:0}}, d3:{meta:{dev:"d3",slot:1}} };
ctx.state.activeDeviceId = "d1";
out.order = order();

calls.length = 0; step(1);  out.next = calls.slice();
calls.length = 0; step(-1); out.prevWrap = calls.slice();     // z pierwszego w tyl = ostatni
ctx.state.activeDeviceId = "d5";
calls.length = 0; step(1);  out.nextWrap = calls.slice();     // z ostatniego w przod = pierwszy

ctx.state.devices = { d1:{meta:{dev:"d1",slot:0}} };
ctx.state.activeDeviceId = "d1";
calls.length = 0; step(1); step(-1); out.single = calls.slice();
out.activeUntouched = (ctx.state.activeDeviceId === "d1");
process.stdout.write(JSON.stringify(out));
"""
_dyn = None
_err = ""
try:
    _tmp = os.path.join(tempfile.gettempdir(), "rf_navcap_harness.mjs")
    with open(_tmp, "w", encoding="utf-8") as f:
        f.write(_harness)
    _r = subprocess.run(["node", _tmp, os.path.join(ROOT, "web", "js", "rf-34b-cols.js")],
                        capture_output=True, text=True, timeout=60)
    if _r.returncode == 0:
        _dyn = json.loads(_r.stdout)
    else:
        _err = (_r.stderr or "")[-300:]
except Exception as e:                                     # noqa: BLE001
    _err = str(e)

check("b5. [wykonane] kolejność idzie po slotach, nie po kolejności kluczy obiektu",
      bool(_dyn) and _dyn["order"] == ["d1", "d3", "d5"], _err or (_dyn or {}).get("order"))
check("b6. [wykonane] „następny” i „poprzedni” trafiają w sąsiada i zawijają się w kółko",
      bool(_dyn) and _dyn["next"] == ["d3"] and _dyn["prevWrap"] == ["d5"] and _dyn["nextWrap"] == ["d1"],
      _err or json.dumps((_dyn or {}).get("next", "")) + "/" + json.dumps((_dyn or {}).get("prevWrap", "")))
check("b7. [wykonane] przy JEDNYM kapslu strzałka nic nie robi i nie rusza activeDeviceId",
      bool(_dyn) and _dyn["single"] == [] and _dyn["activeUntouched"] is True,
      _err or json.dumps((_dyn or {}).get("single", "")))

# ── c. jeden kapsel = strzałki wygaszone, NIE schowane ────────────────────────────────────
print("\n--- c. stan przy jednym kapslu ---")
_sync = fn_body(COLS, "function capSync()")
check("c1. capSync liczy, czy jest więcej niż jeden kapsel", "ids.length > 1" in _sync)
check("c2. ...i wyłącza obie strzałki właściwością disabled", "b.disabled = !many" in _sync)
check("c3. ...oraz mówi to czytnikowi przez aria-disabled",
      'setAttribute("aria-disabled", ad)' in _sync and 'many ? "false" : "true"' in _sync)
check("c4. strzałki nie są CHOWANE (żadnego display:none ani hidden na nich)",
      "hidden" not in _sync.split("rfNavCapPrev")[-1]
      and not re.search(r"\.rf-navcap-arrow[^{]*\{[^}]*display:\s*none", CSS))

# ── d. dostępność ─────────────────────────────────────────────────────────────────────────
print("\n--- d. dostępność ---")
check("d1. strzałki to <button type=\"button\"> (nie <div> z klikiem)",
      'el("button", "icon-btn rf-navcap-arrow"' in _arrow and 'b.type = "button"' in _arrow)
_navcap = fn_body(COLS, "function buildNavCap()")
check("d2. obie strzałki mają nazwę dostępną",
      'setAttribute("aria-label", txt)' in _arrow
      and "Poprzedni kapsel" in _arrow and "Następny kapsel" in _arrow)
check("d3. nazwa kapsla jest ogłaszana po zmianie (aria-live=polite)",
      'nm.setAttribute("aria-live", "polite")' in _navcap)
check("d4. nazwa kapsla nie jest tłumaczona (podpis człowieka)",
      'nm.setAttribute("data-noi18n", "")' in _navcap)
check("d5. rysunek nie jest czytany drugi raz — alt=\"\" + aria-hidden",
      'img.alt = ""' in _navcap and 'img.setAttribute("aria-hidden", "true")' in _navcap)
check("d6. blok NIE przechwytuje globalnych strzałek (nawigacja modułów ich używa)",
      "keydown" not in COLS.split("---- portret aktywnego kapsla")[1].split("---- budowa układu")[0]
      and "ArrowLeft" not in COLS and "ArrowRight" not in COLS)
_tips = re.findall(r'b\.title = txt', _arrow)
check("d7. podpowiedź = to samo zdanie, co nazwa dostępna (jeden klucz, jedno brzmienie)",
      len(_tips) == 1)
check("d8. jednozdaniowe title bez kropki na końcu (test_ui_tabs l10)",
      not any(s.strip().endswith(".") for s in ("Poprzedni kapsel", "Następny kapsel")))

# ── e. odświeżanie: jedna nazwa, wołana ze wszystkich miejsc ──────────────────────────────
print("\n--- e. odświeżanie ---")
check("e1. rf-34b wystawia rfNavCapSync globalnie", "global.rfNavCapSync = capSync;" in COLS)
check("e2. ...woła je setViewDev (kliknięcie pigułki kapsla, przez switchDevice)",
      "rfNavCapSync()" in fn_body(DEV, "function setViewDev(id)"))
check("e3. ...woła je renderDeviceSelector (nazwa/rysunek z edytora, stan z SSE, +/- slot)",
      "rfNavCapSync()" in fn_body(DEV, "function renderDeviceSelector()"))
check("e4. ...woła je updateTabDots (kropki i portret to jedno zdanie)",
      "rfNavCapSync()" in fn_body(TABS, "function updateTabDots()"))
check("e5. każde wywołanie jest chronione (brak pliku rf-34b nie może wywrócić panelu)",
      DEV.count('typeof rfNavCapSync==="function"') == 2 and "window.rfNavCapSync" in TABS)
check("e6. odświeżanie jest RÓŻNICOWE — sygnatura odcina przebiegi bez zmian",
      "box._rfSig === sig" in _sync and "box._rfSig = sig" in _sync)
check("e7. ...i nigdy nie odbudowuje bloku (żadnego innerHTML — zabrałby fokus ze strzałki)",
      "innerHTML" not in _sync and "innerHTML" not in _navcap)
check("e8. tekst stanu porównywany do data-pl, nie do widocznego napisu (pułapka i18n z .dp-state)",
      'st.getAttribute("data-pl") !== word' in _sync)
check("e9. brak rysunku → kolorowa kropka, a nie pusty <img src=\"\"> (drugie pobranie strony)",
      'img.removeAttribute("src")' in _sync and "dot.hidden = false" in _sync)
check("e10. duża grafika bierze się z CAP_IMG_HI przez capImgBig (256 px, jak w edytorze)",
      "capImgBig(meta.cap)" in _sync)

# ── f. czego nie wolno było ruszyć ────────────────────────────────────────────────────────
print("\n--- f. nietknięte punkty zaczepienia ---")
for _id in ("rfRail", "rfMain", "rfRcol"):
    check("f1. identyfikator #%s nietknięty" % _id, '"%s"' % _id in COLS, _id)
check("f2. klasy .tab-btn / .rnav-btn nadal obsługiwane w rf-34b",
      "rnav-btn" in COLS and "tab-btn" in COLS)

# ── g. arkusz ─────────────────────────────────────────────────────────────────────────────
print("\n--- g. arkusz 20-cols.css ---")
check("g1. reguły bloku są w 20-cols.css (tam, gdzie mieszka układ kolumn)",
      ".rf-navcap{" in CSS and ".rf-navcap-art{" in CSS and ".rf-navcap-arrow{" in CSS)
_rules = re.findall(r"\.rf-navcap[^{};]*\{[^}]*\}", CSS)
check("g2. blok nie dokłada trzeciej kreskowanej ramki (ścieg nosi karta i przyciski)",
      not any("dashed" in r for r in _rules), len(_rules))
check("g3. przy zwiniętym pasku strzałki wypadają z kolejności tabulatora (visibility, nie sam opacity)",
      "body.lp-collapsed .rf-rail .rf-navcap-arrow{" in CSS
      and "visibility:hidden" in CSS.split("body.lp-collapsed .rf-rail .rf-navcap-arrow{")[1][:400])
check("g4. ...a rysunek zostaje, tylko mniejszy (portret jest tam całą odpowiedzią)",
      "body.lp-collapsed .rf-rail .rf-navcap-art{width:36px" in CSS)
# W tym arkuszu są TRZY bloki `prefers-reduced-motion` — bierzemy ten, który gasi przejścia kolumn.
_rm = [b for b in CSS.split("@media (prefers-reduced-motion:reduce)")[1:]
       if ".rf-rail,.rf-rcol,.rf-pbar b" in b[:600]][0][:700]
check("g5. przy wyłączonym ruchu przejścia bloku gasną",
      ".rf-navcap-arrow" in _rm and ".rf-navcap-art" in _rm and ".rf-navcap-name" in _rm)
# UX 261120 (D7): 64 px zamiast 100 px, bez zdania „Kropki niżej…”.
check("g6. rysunek ma 64 px w rozwiniętym pasku (rozpoznawalny, a nawigacja odzyskuje wysokość)",
      "width:64px;height:64px" in CSS.split(".rf-navcap-art{")[1][:260])
check("g7. zdanie „Kropki niżej…” zniknęło z portretu",
      "rf-navcap-note" not in fn_body(COLS, "function buildNavCap() {"))

# ── h. słownik ────────────────────────────────────────────────────────────────────────────
print("\n--- h. i18n ---")
for _k, _v in (("Poprzedni kapsel", "Previous capsule"),
               ("Następny kapsel", "Next capsule")):
    check("h. klucz „%s” w I18N_EN" % _k, '"%s":"%s"' % (_k, _v) in I18N, _k)
check("h. martwy klucz „Kropki niżej…” zdjęty ze słownika",
      "Kropki niżej mówią, co jest włączone na tym kapslu" not in I18N)

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
