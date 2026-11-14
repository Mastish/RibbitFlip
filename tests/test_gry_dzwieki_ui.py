"""RibbitBeat: punkowe dźwięki interfejsu (web/gry/js/dzwieki-ui.js), 2026-10-03.

Samodzielny skrypt: `py tests/test_gry_dzwieki_ui.py` → na końcu `N passed, M failed`.

Pilnuje kontraktu między modułami: 10 nazw dźwięków, każda
z receptą; ustawienia z localStorage (`ust.dzwiekiUI`, `ust.dzwiekiUIGlosnosc`); kolejność skryptów w index.html;
zero plików dźwiękowych; jeden AudioContext (ten z glos.js). Moduł wykonuje się w Node (vm) bez DOM i bez dźwięku.
Zachowanie w przeglądarce (klawiatura, pad, mysz, gra, wyniki) i pomiar offline (szczyt, długość, RMS, WAV-y)
sprawdza osobny smoke poza repozytorium.
"""
import json
import os
import re
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GRY = os.path.join(REPO, "web", "gry")
JS = os.path.join(GRY, "js")
NAZWY = ["ruch", "klik", "wstecz", "rozwin", "zwin", "przesun", "przelacz", "blad", "start", "wynik", "odblokowanie"]
# długość recepty (pole `dl`, sekundy): zakresy ze zlecenia (ruch 20–40 ms, klik 60–120, rozwijanie 120–200, wynik ≤ 700)
ZAKRESY = {"ruch": (.02, .04), "przesun": (.02, .06), "klik": (.06, .12), "wstecz": (.06, .12), "przelacz": (.06, .12),
           "rozwin": (.12, .2), "zwin": (.12, .2), "blad": (.1, .25), "start": (.15, .5), "wynik": (.3, .7),
           "odblokowanie": (.5, .9)}

wyniki = []


def check(nazwa, ok, szczegol=""):
    wyniki.append(bool(ok))
    print(("PASS  " if ok else "FAIL  ") + nazwa + ("" if ok or not szczegol else "  → " + str(szczegol)))


def czytaj(*sciezka):
    with open(os.path.join(*sciezka), encoding="utf-8") as f:
        return f.read()


def node(skrypt):
    r = subprocess.run(["node", "-e", skrypt], capture_output=True, text=True, encoding="utf-8", cwd=REPO, timeout=60)
    return r.returncode, r.stdout.strip(), r.stderr.strip()


ui = czytaj(JS, "dzwieki-ui.js")
glos = czytaj(JS, "glos.js")
wejscie = czytaj(JS, "wejscie.js")
index = czytaj(GRY, "index.html")

# ---- składnia
for plik in ("dzwieki-ui.js", "glos.js", "wejscie.js"):
    r = subprocess.run(["node", "--check", os.path.join(JS, plik)], capture_output=True, text=True, encoding="utf-8")
    check(f"node --check {plik}", r.returncode == 0, r.stderr[-300:])

# ---- moduł w Node (vm): bez document, bez localStorage, bez Glos → API działa i milczy bez błędów
VM = r"""
const vm=require("vm"),fs=require("fs");
const kod=fs.readFileSync("web/gry/js/dzwieki-ui.js","utf8")+"\n;globalThis.__ui=DzwiekiUI;";
function uruchom(ls){
  const ctx={console,Math,JSON,Date,Number,Object,Array,Float32Array,WeakMap,setTimeout,clearTimeout};
  if(ls!==undefined)ctx.localStorage={getItem:k=>k==="ribbitflip.zabiChor"?ls:null};
  vm.createContext(ctx);vm.runInContext(kod,ctx);return ctx.__ui;
}
const out={};
const a=uruchom();
out.nazwy=a.NAZWY;
out.recepty=Object.fromEntries(Object.entries(a.RECEPTY).map(([k,r])=>[k,{dl:r.dl,graj:typeof r.graj,wzm:r.wzm}]));
out.api=["graj","ustaw","wlaczone","glosnosc","renderuj","zglos","oznaczWejscie"].filter(k=>typeof a[k]!=="function");
out.domyslne=[a.wlaczone(),a.glosnosc()];
let rzut=null;try{out.graj=a.graj("klik");out.grajZla=a.graj("nie-ma-takiego");a.zglos("klik");}catch(e){rzut=String(e);}
out.rzut=rzut;
out.ustaw=a.ustaw({glosnosc:7});out.ustaw2=a.ustaw({wlaczone:false,glosnosc:-1});out.ustaw3=a.ustaw({glosnosc:"x"});
const b=uruchom(JSON.stringify({wersja:2,ust:{dzwiekiUI:false,dzwiekiUIGlosnosc:.3}}));
out.zapisane=[b.wlaczone(),b.glosnosc()];
const c=uruchom(JSON.stringify({ust:{dzwiekiUI:"tak",dzwiekiUIGlosnosc:5}}));
out.zle=[c.wlaczone(),c.glosnosc()];
const d=uruchom("{to nie json");
out.smieci=[d.wlaczone(),d.glosnosc()];
console.log(JSON.stringify(out));
"""
kod, wyj, err = node(VM)
check("dzwieki-ui.js wykonuje się bez DOM i bez dźwięku (vm)", kod == 0 and wyj, err[-400:])
try:
    o = json.loads(wyj.splitlines()[-1]) if wyj else {}
except ValueError:
    o = {}
if o:
    check("11 nazw z kontraktu, z „odblokowanie” toru C (DzwiekiUI.NAZWY)", sorted(o["nazwy"]) == sorted(NAZWY), o["nazwy"])
    for n in NAZWY:
        r = o["recepty"].get(n)
        check(f"recepta „{n}”: funkcja graj i długość", bool(r) and r["graj"] == "function" and isinstance(r["dl"], (int, float)), r)
        if r:
            od, do = ZAKRESY[n]
            check(f"recepta „{n}”: długość {od * 1000:.0f}–{do * 1000:.0f} ms", od <= r["dl"] <= do, r["dl"])
    check("dodatkowy „dzwonekPunkt” (nabijanie punktów) ma receptę", (o["recepty"].get("dzwonekPunkt") or {}).get("graj") == "function")
    check("API: graj, ustaw, wlaczone, glosnosc, renderuj, zglos, oznaczWejscie", not o["api"], o["api"])
    check("domyślnie: włączone, głośność 0,6", o["domyslne"] == [True, .6], o["domyslne"])
    check("bez kontekstu gry graj nic nie gra i nie rzuca", o["rzut"] is None and o["graj"] is False and o["grajZla"] is False, o)
    check("ustaw: głośność obcięta do 0..1, śmieci ignorowane",
          o["ustaw"] == {"wlaczone": True, "glosnosc": 1} and o["ustaw2"] == {"wlaczone": False, "glosnosc": 0}
          and o["ustaw3"] == {"wlaczone": False, "glosnosc": 0}, [o["ustaw"], o["ustaw2"], o["ustaw3"]])
    check("stan z localStorage[ribbitflip.zabiChor].ust (dzwiekiUI, dzwiekiUIGlosnosc)", o["zapisane"] == [False, .3], o["zapisane"])
    check("złe typy w zapisie = wartości domyślne (bool / liczba obcięta do 1)", o["zle"] == [True, 1], o["zle"])
    check("zepsuty JSON w zapisie = wartości domyślne", o["smieci"] == [True, .6], o["smieci"])

# ---- index.html: dzwieki-ui.js po glos.js i wejscie.js, przed zabi-chor.js
skrypty = re.findall(r'<script src="js/([^"]+)"', index)
check("index.html ładuje js/dzwieki-ui.js", "dzwieki-ui.js" in skrypty, skrypty)
if "dzwieki-ui.js" in skrypty:
    i = skrypty.index("dzwieki-ui.js")
    check("dzwieki-ui.js po glos.js i wejscie.js", skrypty.index("glos.js") < i and skrypty.index("wejscie.js") < i, skrypty)
    check("dzwieki-ui.js przed zabi-chor.js (gra może wołać DzwiekiUI.ustaw przy starcie)", i < skrypty.index("zabi-chor.js"), skrypty)

# ---- zero plików dźwiękowych i zero drugiego AudioContext
bez_komentarzy = re.sub(r"//[^\n]*", "", ui)
check("dzwieki-ui.js nie odwołuje się do plików dźwiękowych",
      not re.search(r"\.(wav|mp3|ogg|oga|m4a|flac|aac|opus|webm)\b|new\s+Audio\s*\(|decodeAudioData|fetch\s*\(|XMLHttpRequest",
                    bez_komentarzy, re.I))
check("dzwieki-ui.js nie tworzy AudioContext (używa kontekstu z glos.js)",
      not re.search(r"new\s+(window\.)?(webkit)?AudioContext|\b(webkit)?AudioContext\s*\(", bez_komentarzy)
      and "window.AudioContext" not in bez_komentarzy)
wszystkie = {f: czytaj(JS, f) for f in os.listdir(JS) if f.endswith(".js")}
nowe = {f: len(re.findall(r"new\s+(?:window\.)?(?:webkit)?AudioContext\s*\(|new\s+AC\s*\(", re.sub(r"//[^\n]*", "", t)))
        for f, t in wszystkie.items()}
check("w całej grze jest dokładnie jedno `new AudioContext` (glos.js)",
      sum(nowe.values()) == 1 and nowe.get("glos.js") == 1, {k: v for k, v in nowe.items() if v})
check("dzwieki-ui.js ma ogranicznik (DynamicsCompressor) na wspólnym masterze", "createDynamicsCompressor" in ui)

# ---- glos.js i wejscie.js: punktowe haki
check("glos.js udostępnia kontekstUI() (bez tworzenia kontekstu) i celUI()",
      re.search(r"function kontekstUI\(\)\{return ac&&!offline\?ac:null;\}", glos) and "function celUI()" in glos
      and re.search(r"return \{kontekst,kontekstUI,celUI,", glos))
check("glos.js: tik menu milknie, gdy grają dźwięki UI (bez dublowania)", "DzwiekiUI.wlaczone()" in glos)
check("wejscie.js: pad w menu zgłasza się dźwiękom UI (oznaczWejscie, „blad” w ścianę), z ochroną typeof",
      wejscie.count('typeof DzwiekiUI!=="undefined"') >= 2 and 'oznaczWejscie("pad")' in wejscie and 'ui.zglos("blad")' in wejscie)

# ---- podpięcie: delegacja i obserwator (bez edycji zabi-chor.js)
for zdarzenie in ("pointerdown", "keydown", "click", "focusin", "pointerover", "input", "change", "toggle", "scroll"):
    check(f"delegacja na document: {zdarzenie}", f'd.addEventListener("{zdarzenie}"' in ui)
check("obserwator atrybutów hidden / aria-expanded / data-ekran", 'attributeFilter:["hidden","aria-expanded","data-ekran"]' in ui)
check("w trakcie rozgrywki UI milczy (poza „start”)", 'nazwa==="start"||!wGrze()' in ui and 'n!=="start"&&wGrze()' in ui)

ok = sum(wyniki)
print(f"\n{ok} passed, {len(wyniki) - ok} failed")
sys.exit(0 if ok == len(wyniki) else 1)
