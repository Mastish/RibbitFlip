# „WŁĄCZ OD RAZU PO WCZYTANIU” — kontrakt obu stron. Uruchom: py tests/test_arm_on_load.py
#
# Przy wczytaniu zestawu użytkownik ma od razu możliwość aktywacji elementów, które powinny
# być włączone.
#
# Zasada się NIE zmienia: zestaw niesie konfigurację, nigdy uzbrojenie (test_setup_switches.py).
# Nowe jest to, że:
#   1. serwer umie powiedzieć Z SAMEGO PLIKU, co autor miał włączone (`setup_wants_on`), i mówi
#      to w podglądzie importu (`/setup/analyze.wantsOn`, `analyze_bundle.devices[].wantsOn`)
#      oraz w indeksie biblioteki (`wantsOn` / `wantsOnBy`), czyli PRZED wczytaniem;
#   2. po wczytaniu lista „do włączenia” dla panelu (`switchesKeptBy`) zawiera WYŁĄCZNIE grupy,
#      które plik miał włączone, a ten komputer wyłączone — nie te, które autor miał wyłączone;
#   3. front (rf-29e) włącza je zaraz po wczytaniu tylko wtedy, gdy człowiek zaznaczył pole —
#      tą samą drogą, co przycisk „Włącz teraz”. Ten kawałek sprawdza harness w Node
#      (tests/arm_on_load_harness.mjs), tu tylko czytany jest jego raport.
#
# Konsola Windows bez UTF-8 (cp1250) wywraca print() na znakach spoza strony kodowej; wypisujemy
# z zamianą zamiast padać — liczy się PASS/FAIL, nie glify.
import io
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import ribbitflip_monitor as rf  # noqa: E402

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
        print("FAIL  %s   %s" % (name, detail))


def read(rel):
    return io.open(os.path.join(ROOT, rel), encoding="utf-8").read()


print("--- serwer: co autor miał włączone, czytane z samego pliku -----------")
check("nic włączonego → pusta lista", rf.setup_wants_on({}) == [] and rf.setup_wants_on(None) == [])
check("wyłączone jawnie → pusta lista",
      rf.setup_wants_on({"trigEnabled": False, "mouse": {"enabled": False},
                         "midi": {"enabled": False, "oscEnabled": False}}) == [])
full = {"trigEnabled": True, "mouse": {"enabled": True}, "midi": {"enabled": True, "oscEnabled": True}}
check("wszystko włączone → cztery grupy w stałej kolejności", rf.setup_wants_on(full) == ["rules", "mouse", "midi", "osc"],
      rf.setup_wants_on(full))
check("sam OSC bez MIDI", rf.setup_wants_on({"midi": {"oscEnabled": True}}) == ["osc"])
check("śmieci zamiast słowników nie wywracają", rf.setup_wants_on({"mouse": "tak", "midi": 3, "trigEnabled": "1"}) == ["rules"])

print("--- serwer: podgląd importu mówi to PRZED wczytaniem -----------------")
env_b = {"kind": "bundle", "name": "Gra", "devices": [
    {"slot": "d0", "name": "Triki 1", "role": {"name": "Toczenie"},
     "setup": {"trigEnabled": True, "rules": [{"id": "a", "keySpec": "space"}], "mouse": {"enabled": True, "mode": "stick"}}},
    {"slot": "d1", "name": "Triki 2", "role": {"name": "Skok"},
     "setup": {"trigEnabled": True, "rules": [{"id": "b", "keySpec": "x"}], "mouse": {"enabled": False}}},
    {"slot": "d2", "name": "Triki 3", "role": {"name": "Nic"}, "setup": {"rules": []}},
]}
ab = rf.analyze_bundle(env_b)
check("analyze_bundle: każda rola niesie wantsOn",
      [d.get("wantsOn") for d in ab["devices"]] == [["rules", "mouse"], ["rules"], []],
      [d.get("wantsOn") for d in ab["devices"]])
check("...obok nazwy roli, którą pokaże okno importu", [d["role"]["name"] for d in ab["devices"]] == ["Toczenie", "Skok", "Nic"])

print("--- serwer: indeks biblioteki (opis zestawu) --------------------------")
it1 = {"name": "x"}
rf._library_facts("setup", it1, {"name": "x", "config": {"trigEnabled": True, "rules": [{"id": "a"}], "mouse": {"enabled": True}}})
check("zestaw na jeden kapsel: wantsOn", it1.get("wantsOn") == ["rules", "mouse"], it1.get("wantsOn"))
check("...bez wantsOnBy (nie ma ról)", "wantsOnBy" not in it1)
it0 = {"name": "y"}
rf._library_facts("setup", it0, {"name": "y", "config": {"rules": [{"id": "a"}]}})
check("zestaw bez włączników: wantsOn puste (panel nie pokaże pola)", it0.get("wantsOn") == [], it0.get("wantsOn"))
it2 = {"name": "z"}
rf._library_facts("setup", it2, env_b)
check("paczka: wantsOnBy po ROLI, rola bez włączników pominięta",
      it2.get("wantsOnBy") == [{"name": "Toczenie", "groups": ["rules", "mouse"]}, {"name": "Skok", "groups": ["rules"]}],
      it2.get("wantsOnBy"))
check("paczka: wantsOn scalone bez powtórzeń", it2.get("wantsOn") == ["rules", "mouse"], it2.get("wantsOn"))
check("paczka: dotychczasowe fakty nietknięte", it2.get("bundle") is True and it2.get("deviceCount") == 3 and it2.get("rules") == 2)
it3 = {"name": "r"}
rf._library_facts("setup", it3, {"kind": "bundle", "devices": [{"slot": "d0", "setup": {"trigEnabled": True}}]})
check("paczka bez roli: nazwa spada na slot", it3.get("wantsOnBy") == [{"name": "d0", "groups": ["rules"]}], it3.get("wantsOnBy"))

print("--- serwer: co panel może włączyć = tylko „plik on, tu off” ----------")
check("_switches_on_of woli switchesOn", rf._switches_on_of({"switchesKept": ["rules", "mouse"], "switchesOn": ["rules"]}) == ["rules"])
check("...a bez niego bierze listę zbiorczą (stary wynik)", rf._switches_on_of({"switchesKept": ["rules"]}) == ["rules"])
check("...i nie wywraca się na pustym", rf._switches_on_of({}) == [])

print("--- pliki gier w repo: każdy zestaw mówi, co ma włączone ---------------")
try:
    idx = rf.library_index()
    setups = idx.get("setup") or []
    check("indeks biblioteki się liczy", isinstance(setups, list))
    check("każda pozycja zestawu (nieuszkodzona) ma listę wantsOn",
          all(isinstance(s.get("wantsOn"), list) for s in setups if not s.get("broken")),
          [s.get("name") for s in setups if not s.get("broken") and not isinstance(s.get("wantsOn"), list)])
    check("każda paczka ma wantsOnBy", all(isinstance(s.get("wantsOnBy"), list) for s in setups if s.get("bundle")))
except Exception as e:  # pragma: no cover
    check("indeks biblioteki się liczy", False, repr(e))

print("--- kontrakt: panel nadąża za grupami serwera --------------------------")
# DLACZEGO TEN TEST ISTNIEJE. 2026-09-13 skaner stał się grupą zestawu (`SETUP_KEYS` + `build_setup`
# + `setup_wants_on`) i panel NIE zauważył tego w dwóch miejscach naraz:
#   • `RF_SETUP_SECTIONS` (rf-28) buduje `include`, po którym serwer TNIE kopertę przy zapisie
#     i eksporcie — brak wiersza znaczył ciche gubienie konfiguracji skanera z KAŻDEGO zapisanego
#     zestawu, łącznie z kopią „zapisz przed wczytaniem", czyli z drogą powrotu;
#   • `rfArmSwitches` (rf-29e) miał na nieznaną grupę `continue`, więc pole „Wczytaj i od razu
#     aktywuj zestaw" wypisywało skaner w tym, co włączy, po czym go nie włączało i nic nie mówiło.
# Obie rzeczy są CICHE: żaden błąd, żaden czerwony test. Stąd kontrakt liczony z serwera, a nie
# lista nazw przepisana ręcznie — następna grupa ma wywalić ten test, a nie czyjś wieczór.
_meta = set(getattr(rf, "SETUP_META_KEYS", ()))
_grupy = [k for k in rf.SETUP_KEYS if k not in _meta and k != "trigEnabled"]
_s28 = read("web/js/rf-28-setups.js")
_sekcje = set(re.findall(r'cfg:\[([^\]]*)\]', _s28))
_cfg_keys = set()
for _blok in _sekcje:
    _cfg_keys.update(re.findall(r'"([^"]+)"', _blok))
for _g in _grupy:
    check(f"RF_SETUP_SECTIONS zna grupę „{_g}” (inaczej zapis i eksport ją gubią)", _g in _cfg_keys,
          sorted(_cfg_keys))
# Grupy, które `setup_wants_on` potrafi zwrócić, MUSZĄ mieć obsługę w rfArmSwitches — to jest
# dokładnie lista, którą pole obiecuje włączyć.
_s29e = read("web/js/rf-29e-arm-on-load.js")
_obsluga = set(re.findall(r'g === "([a-z]+)"', _s29e))
for _g in ("rules", "mouse", "midi", "osc", "scan"):
    check(f"rfArmSwitches umie włączyć „{_g}”", _g in _obsluga, sorted(_obsluga))
check("nieznana grupa idzie do „zostało do włączenia”, nie do kosza",
      "if (!url) { bad.push(g); continue; }" in _s29e)
# Skaner resetuje się do fabrycznych, gdy dostanie sam `enabled` (ScanModule.sanitize buduje
# konfigurację od `dict(DEFAULTS)`), więc uzbrojenie MUSI być czytaj-zmień-zapisz.
check("...a skaner uzbraja się przez odczyt stanu, nie gołym `enabled`",
      'fetch("/scan" + q)' in _s29e and 'Object.assign({}, cur, { enabled: true })' in _s29e)

print("--- front: wpięcie (statycznie) ----------------------------------------")
html = read("web/ribbitflip_dashboard.html")
i29 = html.find('rf-29-undo-import.js')
i29e = html.find('rf-29e-arm-on-load.js')
i39i = html.find('rf-39i-library.js')
check("rf-29e wpięty po rf-29 i przed rf-39i", 0 < i29 < i29e < i39i, (i29, i29e, i39i))
s28 = read("web/js/rf-28-setups.js")
check("okno importu rysuje ramkę „co autor miał włączone”", "rfArmBoxHtml(a)" in s28 and "items+armBox+" in s28)
check("...i oddaje odpowiedź z pola jako trzeci argument apply", 'opts.apply("safe",A,R)' in s28 and 'opts.apply("advanced",A,R)' in s28)
s29 = read("web/js/rf-29-undo-import.js")
check("import zestawu i paczki przyjmuje `arm`", s29.count("apply:async(mode,adopt,arm)=>{") == 2)
check("...i włącza PRZED przeładowaniem, w obu ścieżkach", s29.count("await rfArmAfterLoad(res,arm)") == 2)
check("„Włącz teraz” idzie tą samą drogą co pole (rfArmSwitches)", "await rfArmSwitches(by)" in s29)
check("stare zapisy switches/switchesBy zniknęły z rf-29", 'localStorage.setItem("ribbitflip.undo.switches"' not in s29
      and 'localStorage.setItem("ribbitflip.undo.switchesBy"' not in s29)
check("dymek po przeładowaniu ogłasza, co włączono", "rfArmedAnnounce(ar)" in s29)
s39 = read("web/js/rf-39i-library.js")
check("Biblioteka: wczytanie własnego zestawu czyta zapamiętane pole", "await rfArmAfterLoad(j, (typeof rfArmPref === \"function\") && rfArmPref())" in s39)
s392 = read("web/js/rf-39i2-lib-detail.js")
check("opis zestawu: wiersz „włączone u autora”", 'lib-sumrow lib-wants' in s392 and '"włączone u autora": "on at the author\'s"' in s392)
check("opis zestawu: pole obok „Wczytaj zestaw”, tylko dla zestawu z włącznikami i nie dla paczki",
      "!it.bundle && Array.isArray(it.wantsOn) && it.wantsOn.length" in s392 and '"lib-arm"' in s392)
guides = read("web/js/rf-39b-guides.js")
check("pomoc mówi o polu w obu językach",
      guides.count("Zaznacz tam „Wczytaj i od razu aktywuj zestaw”") == 2
      and guides.count("Tick “Load the setup and switch it on right away” there") == 1)
# Stara nazwa pola nie może zostać NIGDZIE w tekstach widocznych dla człowieka: klucz słownika
# I18N równa się dokładnemu polskiemu napisowi, więc jedno przeoczone miejsce to albo napis bez
# tłumaczenia, albo pomoc odsyłająca do pola, którego w oknie nie ma. Komentarze w kodzie i wpisy
# w dzienniku prac opisują historię tej zmiany i zostają — stąd wycięcie ich przed sprawdzeniem.
_widoczne = [("web/js/rf-39b-guides.js", guides), ("web/js/rf-39i2-lib-detail.js", s392),
             ("web/js/rf-29e-arm-on-load.js", read("web/js/rf-29e-arm-on-load.js")),
             ("web/js/rf-28-setups.js", s28)]
for _nm, _txt in _widoczne:
    _bez_komentarzy = "\n".join(ln for ln in _txt.splitlines() if not ln.lstrip().startswith("//"))
    check(f"{_nm}: brak starej nazwy pola w widocznym tekście",
          "Włącz od razu po wczytaniu" not in _bez_komentarzy
          and "Włącz to od razu po wczytaniu" not in _bez_komentarzy)
css13 = read("web/css/13-dialogs-overview.css")
css21 = read("web/css/21-presets.css")
check("style: ramka w oknie importu i pole w Bibliotece", "#rfSafe .ts-arm{" in css13 and ".lib-arm{" in css21)

print("--- front: kontrakt rf-29e (harness w Node) ----------------------------")
node = None
for cand in ("node", "node.exe"):
    try:
        subprocess.run([cand, "--version"], capture_output=True, check=True)
        node = cand
        break
    except Exception:
        continue
if not node:
    print("SKIP  brak Node — harness pominięty")
else:
    p = subprocess.run([node, os.path.join(ROOT, "tests", "arm_on_load_harness.mjs")], capture_output=True)
    if p.returncode != 0:
        check("harness się uruchamia", False, p.stderr.decode("utf-8", "replace")[-800:])
    else:
        rep = json.loads(p.stdout.decode("utf-8"))
        for name, ok, detail in rep["checks"]:
            check(name, ok, detail)

print()
print("OK" if not _failed else "FAILED", "- %d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
