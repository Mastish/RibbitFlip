# Contract test: wczytanie zestawu PYTA, zanim nadpisze, i żaden przycisk nie obiecuje więcej,
# niż robi.
# Run: py tests/test_setup_guard.py
#
# SKĄD TEN PLIK. Zgłoszenie (2026-09-13): „po wczytaniu presetu Exo One (…) wydaje mi
# się, że nie wczytano odpowiednio presetu, a tylko zakomunikowano, że tak się stanie". Prześledzenie
# ścieżki pokazało pięć osobnych rzeczy, z których KAŻDA z osobna wygląda jak nieudane wczytanie,
# a żadnej nie widać w testach silnika — bo wszystkie siedzą w kolejności okien i w napisach na
# przyciskach. Ten test pilnuje ich statycznie: czyta pliki panelu i sprawdza, że zdania i wywołania
# są na miejscu. Nie zastępuje klik-through, tylko nie pozwala cicho wrócić do stanu sprzed naprawy.
#
# Warstwa „Włącz od razu po wczytaniu" (rf-29e) ma własny plik — tests/test_arm_on_load.py.
import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

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
    with io.open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()


GUARD = read("web/js/rf-29f-setup-guard.js")
UNDO = read("web/js/rf-29-undo-import.js")
SETUPS = read("web/js/rf-28-setups.js")
LIB = read("web/js/rf-39i-library.js")
ROLES = read("web/js/rf-29c-bundle-roles.js")
TRIG = read("web/js/rf-10-triggers-model.js")
HTML = read("web/ribbitflip_dashboard.html")
PY = read("ribbitflip_monitor.py")

print("--- bramka istnieje i jest wpięta ---")
for fn in ("rfSetupGuard", "rfSetupGuardRisk", "rfSetupGuardGroups"):
    check("rf-29f wystawia %s" % fn, ("window.%s = %s;" % (fn, fn)) in GUARD)
check("rf-29f wpięty w panel", "/web/js/rf-29f-setup-guard.js" in HTML)
check("…PO rf-28 (czyta RF_SETUP_SECTIONS i rfBackupStamp)",
      HTML.index("/web/js/rf-28-setups.js") < HTML.index("/web/js/rf-29f-setup-guard.js"))

print("\n--- pyta na każdej z trzech dróg wczytania ---")
# Biblioteka („Wczytaj zestaw") była do 13.09 JEDYNYM miejscem, w którym jedno kliknięcie
# wymieniało całą konfigurację bez żadnego pytania.
check("Biblioteka pyta przed /setup/load", "rfSetupGuard({name: name" in LIB)
check("…i przerywa, gdy człowiek anuluje", "if (!G) return;" in LIB)
check("import pliku pyta", "const G=await _rfGuard(o,null);" in UNDO)
check("import paczki pyta, znając już role", "const G=await _rfGuard(o,Array.isArray(map)?map.filter(Boolean):null);" in UNDO)
check("obie ścieżki przerywają po anulowaniu", UNDO.count("if(!G)return;") == 2)

print("\n--- przycisk nazywa to, co robi ---")
# „Wczytaj", które otwiera kolejne okno, to dosłowna treść zgłoszenia.
check("podgląd importu zna `nextStep`", "const _next=!!opts.nextStep;" in SETUPS)
check("…i mówi wtedy „Dalej”", '_next?_gl("Dalej","Continue"):_gl("Wczytaj","Load")' in SETUPS)
check("import zestawu podaje nextStep", "analysis:a,nextStep:true" in UNDO)
check("import paczki podaje nextStep", UNDO.count("nextStep:true") == 2)
check("okno ról też mówi „Dalej”, gdy po nim idzie bramka",
      'nextStep ? _gl("Dalej", "Continue") : _gl("Wczytaj", "Load")' in ROLES)
check("…i dostaje to od wywołującego", "rfBundleMap(a,true)" in UNDO)

print("\n--- nic nie kończy się w ciszy ---")
check("zamknięcie okna ról mówi, że nie wczytano",
      "Nie wczytano: nie wybrano kapsli do ról." in UNDO)
check("…zamiast cichego `if(!map)return;`", "if(!map)return;" not in UNDO)

print("\n--- liczniki reguł w paczce ---")
# analyze_bundle trzyma je per kapsel, więc czytanie `a.safeCount` dawało „0 · 0" nad listą reguł.
check("podgląd sumuje po kapslach", 'const risky=_cnt("riskyCount");' in SETUPS)
check("…i tak samo bezpieczne", "a.devices.reduce((s,d)=>s+((d&&d.safeCount!=null)" in SETUPS)

print("\n--- kopia „przed wczytaniem” jest decyzją, nie odruchem ---")
check("import zestawu nie robi już cichej kopii", "_rfKeepCurrent({name:backupName})" not in UNDO)
check("bramka umie zapisać zestaw jednego kapsla", '"/setup/save" + (dev ? "?dev="' in GUARD)
check("…i CAŁĄ paczkę, gdy celów jest więcej", 'let url = "/bundle/save";' in GUARD)
check("nieudany zapis NIE wczytuje", "Nie udało się zapisać kopii — nic nie wczytałem." in GUARD)
check("serwer umie zapisać paczkę do biblioteki", 'if path == "/bundle/save":' in PY)
check("…przez build_bundle, nie przez kopię jednego kapsla",
      "env = build_bundle(self.dm, dd.get(\"name\", \"\")" in PY)

print("\n--- co człowiek widzi zaraz po wczytaniu ---")
# Zestaw pod grę na padzie składa się z reguł `pad:`, a te idą na ekran Kontroler — pierwszy ekran
# po wczytaniu mówił więc „Brak wyzwalaczy" i wyglądał jak nieudane wczytanie.
check("pusta lista Mapowania prowadzi do Kontrolera", 'data-gopad="1"' in TRIG)
check("…i przycisk naprawdę tam skacze", 'setTabById("kontroler")' in TRIG)
check("…i mówi, ILE tam czeka", "mapowania przycisków kontrolera (`+pads.length+`)" in TRIG)

print("\n--- ryzyko liczone z JEDNEGO źródła ---")
# Ta sama funkcja, która rysuje kropkę „zmienione" w nawigacji (rf-49q → rfCfgIdState). Druga
# implementacja odpowiadałaby na to samo pytanie inaczej i nikt by nie zauważył, która kłamie.
check("bramka pyta rfCfgIdState", "rfCfgIdState(A, dev)" in GUARD)
check("trzy powody straty nazwane po imieniu",
      all(w in GUARD for w in ('why = "gone"', 'why = "dirty"', 'why = "unnamed"')))
check("okno ról znaczy kapsle z realną stratą", "_brmLossMark" in ROLES)
check("…i tylko realną (nie „bez nazwy” na świeżej instalacji)",
      'r.why === "dirty" || r.why === "gone"' in ROLES)

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
