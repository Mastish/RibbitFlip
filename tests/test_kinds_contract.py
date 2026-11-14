# Contract test: JEDEN REJESTR RODZAJÓW, JEDNE DRZWI IMPORTU.
# Run: py tests/test_kinds_contract.py
#
# PO CO TEN PLIK ISTNIEJE. Rodzaj zapisanej rzeczy („preset myszy", „zestaw", „preset koła") był
# do 2026-08-31 opisany w PIĘTNASTU miejscach: mapa katalogów na serwerze, sześć tablic Biblioteki,
# lista modułów, rejestr opisów, dwie tablice kreatora posta, okno wymiany, okno linku, gałęzie
# sniffera i rysunek „co jest czym". Nic nie sprawdzało, czy te piętnaście list się zgadza — i one
# się nie zgadzały. Zmierzone tego dnia na żywym serwerze:
#
#   * preset usług sieciowych upuszczony na okno → „Pusty lub nieznany zestaw",
#   * preset koła pobrany z aplikacji → to samo (plik wychodził bez `kind`),
#   * presety myszy i MIDI dawało się POBRAĆ, ale nie wczytać.
#
# Każdy z tych trzech błędów to ta sama pomyłka: rodzaj dołożony w jednym miejscu z piętnastu.
# Test pilnuje więc nie funkcji, tylko ZGODNOŚCI: rejestr panelu (rf-49-kinds.js) kontra to, co
# serwer naprawdę zapisuje, wystawia i przyjmuje.
#
# Druga połowa to PODGLĄD PRZED WCZYTANIEM (`analyze_preset`). Presety modułów wchodziły dotąd
# wyłącznie z własnej biblioteki, więc podglądu nie miały. Od chwili, gdy wchodzą z pliku od obcej
# osoby, muszą go mieć — bo preset myszy niesie OSIEM pól klawiszowych, a wycinki koła niosą `spec`
# i `sequence`, czyli dokładnie to samo, co reguła zestawu, razem z makrami.
#
# Nic tu nie startuje serwera HTTP i nic nie dotyka Settings/ ani Library/ użytkownika.
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import ribbitflip_monitor as rf  # noqa: E402

_passed = 0
_failed = 0
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _say(s):
    enc = getattr(sys.stdout, "encoding", None) or "utf-8"
    print(s.encode(enc, "replace").decode(enc, "replace"))


def check(name, cond, detail=""):
    global _passed, _failed
    if cond:
        _passed += 1
        _say("PASS  %s" % name)
    else:
        _failed += 1
        _say("FAIL  %s%s" % (name, ("   -> " + str(detail)) if detail else ""))


def src(rel):
    with open(os.path.join(REPO, rel), "r", encoding="utf-8") as f:
        return f.read()


# ---------------------------------------------------------------------------
#  1. KOPERTY: co serwer zapisuje, panel musi umieć rozpoznać
# ---------------------------------------------------------------------------
print("--- koperty plików ------------------------------------------------")
KINDS_JS = src("web/js/rf-49-kinds.js")
SERVER = src("ribbitflip_monitor.py")

# Rodzaje kopert wypisane WPROST w serwerze (`"kind": "…"` w budowanych plikach). Gdyby doszedł
# nowy, a rejestr panelu o nim nie wiedział, plik z tej aplikacji nie wróciłby do tej aplikacji.
import re  # noqa: E402
env_kinds = set(re.findall(r'"app":\s*"ribbitflip",\s*"kind":\s*"([a-z-]+)"', SERVER))
env_kinds |= set(re.findall(r'"kind":\s*"(setup|bundle|profile|pose-preset|mouse-preset|'
                            r'midi-preset|rest-preset|rest-actions|wheel-preset)"', SERVER))
# `rest-log` NIE jest rodzajem zapisanej rzeczy, tylko nagłówkiem dziennika wywołań REST
# (REST_LOG_META). Nikt go nie wysyła, nie wczytuje i nie trzyma w bibliotece — w rejestrze
# rodzajów byłby pozycją, której nie da się ani opisać, ani wczytać.
env_kinds.discard("rest-log")
check("serwer pisze co najmniej 7 rodzajów kopert", len(env_kinds) >= 7, sorted(env_kinds))
for e in sorted(env_kinds):
    check("koperta „%s” jest w rejestrze panelu" % e, ('env: "%s"' % e) in KINDS_JS, e)

# Koperta koła powstaje po stronie PANELU (rf-46f), nie serwera — i to jest cała poprawka z E1.
check("preset koła wychodzi z kopertą",
      'kind: "wheel-preset"' in src("web/js/rf-46f-wheel-share.js"))
check("plik i blok w poście używają TEJ SAMEJ koperty",
      src("web/js/rf-46f-wheel-share.js").count("whPresetEnvelope(") >= 3,
      src("web/js/rf-46f-wheel-share.js").count("whPresetEnvelope("))

# ---------------------------------------------------------------------------
#  2. ADRESY: każdy adres z rejestru musi istnieć w serwerze
# ---------------------------------------------------------------------------
print("\n--- adresy z rejestru istnieją w serwerze -------------------------")
# Literówka w adresie („/mouse-presets/save" zamiast „/mouse-preset/save") daje 404 i CICHY brak
# zapisu — panel pokaże „Nie udało się zapisać" i nikt nie zgadnie dlaczego.
for path_ in sorted(set(re.findall(r'"(/[a-z0-9/-]+)"', KINDS_JS))):
    check("adres %s obsługiwany przez serwer" % path_,
          ('path == "%s"' % path_) in SERVER, path_)

# ---------------------------------------------------------------------------
#  3. SZUFLADY BIBLIOTEKI: rejestr panelu kontra `_LIBRARY_KINDS`
# ---------------------------------------------------------------------------
print("\n--- szuflady Biblioteki -------------------------------------------")
lib_files = set(rf._LIBRARY_KINDS.keys())
lib_stores = set(rf._LIBRARY_STORES.keys())
check("siedem szuflad to pliki w katalogach",
      lib_files == {"setup", "profile", "pose", "mouse", "midi", "rest", "scan"}, sorted(lib_files))
# Trzy rodzaje NIE są plikami w katalogu, tylko listą w jednym pliku ustawień. Do 2026-08-31
# znaczyło to, że w Bibliotece ich w ogóle nie było — a nagłówek nad listą mówił „wszystko, co masz
# zapisane na tym komputerze". Magazyn (`_LIBRARY_STORES`) oddaje je w tej samej kopercie, co pliki.
check("trzy szuflady to magazyny spoza katalogów",
      lib_stores == {"wheel", "synth", "overlay"}, sorted(lib_stores))
check("szuflady się nie nakładają", not (lib_files & lib_stores), sorted(lib_files & lib_stores))
for k in sorted(lib_files | lib_stores):
    check("szuflada „%s” jest w rejestrze panelu" % k, ('lib: "%s"' % k) in KINDS_JS, k)
check("rodzaje z Settings są w rejestrze oznaczone",
      KINDS_JS.count("inSettings: true") == 3, KINDS_JS.count("inSettings: true"))

# Magazyn ma oddawać KOPERTĘ, nie surowy wiersz listy: bez `app` i `kind` pobrany plik nie wróciłby
# do aplikacji tą samą drogą, co każdy inny (sniffer rozpoznaje rodzaj właśnie po `kind`).
import tempfile  # noqa: E402
_T = tempfile.mkdtemp(prefix="rf-kinds-")
_old = (rf.SETTINGS_DIR, rf.WHEEL_PRESETS_FILE)
rf.SETTINGS_DIR = os.path.join(_T, "Settings")
rf.WHEEL_PRESETS_FILE = os.path.join(rf.SETTINGS_DIR, "w.json")
os.makedirs(rf.SETTINGS_DIR, exist_ok=True)
try:
    rf.save_wheel_presets([{"name": "Zrzuty", "category": "Praca", "config": {
        "confirm": "release",
        "slices": [{"label": "a", "spec": "ctrl+c"},
                   {"label": "m", "children": [{"label": "b", "spec": "win+r"}]}]}}])
    doc = rf.library_item("wheel", "Zrzuty")
    check("magazyn oddaje kopertę z `app`", (doc or {}).get("app") == "ribbitflip", doc)
    check("magazyn oddaje kopertę z `kind`", (doc or {}).get("kind") == "wheel-preset", doc)
    check("magazyn oddaje treść", isinstance((doc or {}).get("config"), dict), doc)
    check("nieznana nazwa to None, nie wyjątek", rf.library_item("wheel", "Nie ma") is None)
    rows = rf.library_index().get("wheel") or []
    check("wiersz z magazynu ma nazwę i liczbę wycinków",
          rows and rows[0]["name"] == "Zrzuty" and rows[0]["slices"] == 3, rows)
finally:
    rf.SETTINGS_DIR, rf.WHEEL_PRESETS_FILE = _old
    import shutil  # noqa: E402
    shutil.rmtree(_T, ignore_errors=True)

# ---------------------------------------------------------------------------
#  4. SNIFFER: preset modułu nie może wpaść w gałąź zestawu
# ---------------------------------------------------------------------------
print("\n--- sniffer (rf-29) -----------------------------------------------")
SNIFF = src("web/js/rf-29-undo-import.js")
check("sniffer pyta rejestr, a nie mnoży gałęzie", "rfKindByEnv(o.kind)" in SNIFF)
check("preset modułu ma własną drogę", "rfPresetImportObj(o,K)" in SNIFF)
check("rozstrzygnięcie stoi PRZED testem zestawu",
      SNIFF.index("rfKindByEnv(o.kind)") < SNIFF.index("looksSetup"))
# Ślepe zaułki („wrzuć plik do folderu Library/MousePresets i odśwież panel") mają zniknąć —
# to była instrukcja obsługi przez Eksplorator Windows.
check("znikł ślepy zaułek presetu myszy", "Library/MousePresets obok aplikacji" not in SNIFF)
check("znikł ślepy zaułek presetu MIDI", "Library/MidiPresets obok aplikacji" not in SNIFF)
# Zestaw, bundle, wyzwalacze, osie i paczka MAJĄ zostać przy swoich drzwiach: tam siedzą bramki
# (podgląd bezpieczeństwa reguł, wybór ról, kopia osi, przegląd akcji), których nie wolno ominąć.
for f in ("bundleImport(file)", "importConfig(file)", "poseImport(file)", "importPackFile"):
    check("własne drzwi zachowane: %s" % f, f in SNIFF, f)

# ---------------------------------------------------------------------------
#  5. PODGLĄD PRESETU: co niesie plik od obcej osoby
# ---------------------------------------------------------------------------
print("\n--- analyze_preset: mysz -----------------------------------------")
A = rf.analyze_preset

m_ok = A("mouse", {"kind": "mouse-preset", "name": "Precyzja", "desc": "do celowania",
                   "config": {"mode": "stick", "stickUp": "w", "stickDown": "s",
                              "stickLeft": "a", "stickRight": "d", "dwellOn": True}})
check("zwykłe WSAD to preset bezpieczny", m_ok["level"] == "safe", m_ok["level"])
check("wszystkie cztery klawisze opisane", len(m_ok["keys"]) == 4, len(m_ok["keys"]))
check("nazwa i opis przechodzą", (m_ok["name"], m_ok["desc"]) == ("Precyzja", "do celowania"), m_ok)
check("tryb ruchu wśród faktów",
      {"k": "mode", "v": "stick"} in m_ok["facts"], m_ok["facts"])

m_bad = A("mouse", {"config": {"stickUp": "w", "stickRight": "win+r"}})
check("klawisz Windows w presecie myszy = ryzykowny", m_bad["level"] == "risky", m_bad["level"])
bad_rows = [k for k in m_bad["keys"] if k["level"] == "risky"]
check("ryzykowny klawisz wskazany z pola", bad_rows and bad_rows[0]["field"] == "stickRight", bad_rows)
check("i z powodem", bool(bad_rows and bad_rows[0]["why"]), bad_rows)

print("\n--- analyze_preset: koło ------------------------------------------")
w = A("wheel", {"config": {"confirm": "release", "slices": [
    {"label": "Kopiuj", "spec": "ctrl+c"},
    {"label": "Zamknij", "sequence": "alt+f4; wait 200; enter"},
    {"label": "Menu", "children": [{"label": "Uruchom", "spec": "win+r"}]}]}})
check("koło z makrem jest ryzykowne", w["level"] == "risky", w["level"])
specs = [k["spec"] for k in w["keys"]]
check("akcja wycinka policzona", "ctrl+c" in specs, specs)
check("makro policzone", any("alt+f4" in s for s in specs), specs)
# PODMENU. Wycinek-drzwi ma dzieci, a w nich mieszkają akcje — pominięcie ich znaczyłoby, że
# preset z „win+r" schowanym o poziom niżej przechodzi jako bezpieczny.
check("akcja z PODMENU też policzona", "win+r" in specs, specs)
check("bezpieczna akcja nie udaje ryzykownej",
      [k for k in w["keys"] if k["spec"] == "ctrl+c"][0]["level"] == "safe")

print("\n--- analyze_preset: usługi sieciowe -------------------------------")
r = A("rest", {"config": {"apis": [
    {"name": "OBS", "base": "http://localhost:4455",
     "actions": [{"url": "http://localhost:4455/x"}], "triggers": [{}]},
    {"name": "Twitch", "base": "https://api.twitch.tv/helix",
     "actions": [{"url": "https://api.twitch.tv/helix/channels"}], "triggers": []}]}})
facts = {f["k"]: f["v"] for f in r["facts"]}
check("policzone aplikacje", facts.get("apis") == 2, facts)
check("policzone akcje", facts.get("acts") == 2, facts)
check("policzone wyzwalacze", facts.get("trigs") == 1, facts)
# GOSPODARZE, nie całe adresy: pytanie brzmi „do kogo to zacznie mówić", a nie „jaką ścieżką".
check("gospodarze wymienieni", r["hosts"] == ["localhost", "api.twitch.tv"], r["hosts"])
check("gospodarz bez powtórzeń", len(r["hosts"]) == len(set(r["hosts"])), r["hosts"])
check("preset usług nie wysyła klawiszy", r["keys"] == [], r["keys"])

print("\n--- analyze_preset: MIDI i osie ------------------------------------")
mi = A("midi", {"config": {"scale": "minor", "mappings": [
    {"dest": "osc"}, {"dest": "osc"}, {"dest": "midi"}]}})
mf = {f["k"]: f["v"] for f in mi["facts"]}
check("policzone mapowania", mf.get("maps") == 3, mf)
check("rozbite na OSC i MIDI", (mf.get("osc"), mf.get("midi")) == (2, 1), mf)
check("skala przechodzi", mf.get("scale") == "minor", mf)
check("preset MIDI nie wysyła klawiszy", mi["keys"] == [], mi["keys"])

print("\n--- analyze_preset: nic go nie wywraca ----------------------------")
# Plik od obcej osoby bywa uszkodzony, obcięty albo w ogóle nie tym, za co się podaje. Podgląd ma
# wtedy powiedzieć „nie", a nie wywalić serwer — to jest jedyne miejsce, w którym te bajty są
# dotykane, zanim człowiek cokolwiek zatwierdzi.
for junk in (None, [], "napis", 42, {"config": None}, {"config": []}, {"config": "x"}):
    try:
        got = A("mouse", junk)
        check("śmieć %r nie wywraca podglądu" % (junk,), isinstance(got, dict), got)
    except Exception as e:  # noqa: BLE001
        check("śmieć %r nie wywraca podglądu" % (junk,), False, repr(e))
check("nieznany rodzaj odpowiada spokojnie",
      A("czegos-takiego-nie-ma", {"config": {"a": 1}})["ok"] is True)
deep = {"config": {"slices": [{"label": "a", "children": [{"label": "b", "children": [
    {"label": "c", "children": [{"label": "d", "children": [{"label": "e", "spec": "win+r"}]}]}]}]}]}}
check("bardzo głębokie drzewo nie zapętla podglądu", isinstance(A("wheel", deep), dict))

# ---------------------------------------------------------------------------
#  6. ZESTAW = POWIĄZANE PRESETY (`items` / `adoptable` / `setup_adopt`)
# ---------------------------------------------------------------------------
# Zestaw NIÓSŁ nazwy presetów autora od zawsze (siedzą w `config`), tylko nikt tego nie mówił:
# po imporcie kapsel dostawał do trzech nazw, których nie ma w bibliotece, i wiersz „tej
# konfiguracji nie ma już na liście". Te asercje pilnują trzech rzeczy: że nazwy da się wyczytać
# z pliku, że wiadomo, co się z każdą stanie, i że dopisanie NICZEGO nie nadpisuje.
print("\n--- zestaw: z czego się składa -------------------------------------")
CFG = {"rules": [{"id": "r1", "source": {"kind": "axis", "channel": 0}, "cmp": ">",
                  "threshold": 5000, "keySpec": "space"}],
       "rulesConfigName": "Elden — walka",
       "mouse": {"mode": "stick", "configName": "Precyzja"},
       "midi": {"mappings": [], "configName": ""},
       "pose": {"gain": 1.2, "configName": "Triki 3"}}
items = rf.setup_items(CFG)
check("nazwa wyzwalaczy odczytana", items.get("trig", {}).get("name") == "Elden — walka", items)
check("nazwa myszy odczytana", items.get("mouse", {}).get("name") == "Precyzja", items)
check("nazwa osi odczytana", items.get("pose", {}).get("name") == "Triki 3", items)
# Moduł bez nazwy (ułożony ręcznie, nigdy niezapisany) to NORMALNY stan, nie brak danych —
# pusty wpis kazałby panelowi rysować pozycję „bez nazwy", której nikt nie prosił.
check("moduł bez nazwy nie ma wpisu", "midi" not in items, items)
check("pusty config nie wywraca", rf.setup_items(None) == {} and rf.setup_items("x") == {})

_T2 = tempfile.mkdtemp(prefix="rf-e5-")
_old2 = (rf.SETTINGS_DIR, rf.PROFILE_DIR, rf.MOUSE_PRESET_DIR, rf.POSE_PROFILE_DIR,
         dict(rf._LIBRARY_KINDS))
rf.SETTINGS_DIR = os.path.join(_T2, "Settings")
rf.PROFILE_DIR = os.path.join(_T2, "Library", "Profiles")
rf.MOUSE_PRESET_DIR = os.path.join(_T2, "Library", "MousePresets")
rf.POSE_PROFILE_DIR = os.path.join(_T2, "Library", "AxisPresets")
rf._LIBRARY_KINDS = dict(rf._LIBRARY_KINDS, profile=rf.PROFILE_DIR, mouse=rf.MOUSE_PRESET_DIR,
                         pose=rf.POSE_PROFILE_DIR)
for _p in (rf.SETTINGS_DIR, rf.PROFILE_DIR, rf.MOUSE_PRESET_DIR, rf.POSE_PROFILE_DIR):
    os.makedirs(_p, exist_ok=True)
try:
    ad = rf.setup_adoptable(CFG)
    check("pusta biblioteka: wszystko nowe",
          {k: v["state"] for k, v in ad.items()} == {"trig": "new", "mouse": "new", "pose": "new"}, ad)
    # Ta sama nazwa z INNĄ treścią to nie to samo — i to jest jedyny stan, w którym coś dałoby się
    # przez nieuwagę stracić.
    rf.save_mouse_preset("Precyzja", {"mode": "mouse"})
    check("zajęta nazwa rozpoznana", rf.setup_adoptable(CFG)["mouse"]["state"] == "taken",
          rf.setup_adoptable(CFG))
    # …a ta sama nazwa z TĄ SAMĄ treścią nie wymaga niczego.
    rf.save_mouse_preset("Bliźniak", rf.mouse_preset_config({"mode": "stick"}))
    CFG2 = json.loads(json.dumps(CFG))
    CFG2["mouse"]["configName"] = "Bliźniak"
    check("identyczna treść: nic do dopisania",
          rf.setup_adoptable(CFG2)["mouse"]["state"] == "same", rf.setup_adoptable(CFG2))
finally:
    (rf.SETTINGS_DIR, rf.PROFILE_DIR, rf.MOUSE_PRESET_DIR, rf.POSE_PROFILE_DIR,
     rf._LIBRARY_KINDS) = _old2
    shutil.rmtree(_T2, ignore_errors=True)

# Podgląd importu MUSI o tym mówić — inaczej cała ta wiedza siedzi w odpowiedzi serwera i nie
# dociera do nikogo. I musi zostawić WYBÓR, bo dopisywanie czegoś do cudzej biblioteki bez pytania
# to nie jest uprzejmość.
SETUPS_JS = src("web/js/rf-28-setups.js")
check("podgląd importu wymienia składniki", "rfSetupItemsHtml" in SETUPS_JS)
check("…i ma zgodę na dopisanie", 'id="tsAdopt"' in SETUPS_JS)
check("…domyślnie zaznaczoną", 'id="tsAdopt" checked' in SETUPS_JS)
check("zgoda jedzie do importu", 'adopt:adopt!==false' in src("web/js/rf-29-undo-import.js"))
check("i wraca zdaniem po przeładowaniu", "_rfAdoptedAnnounce" in src("web/js/rf-29-undo-import.js"))

# ---------------------------------------------------------------------------
#  7. PANEL: rejestr i wolne nazwy (node w `vm`)
# ---------------------------------------------------------------------------
print("\n--- panel: rejestr, wolne nazwy, liczebnik ------------------------")
# ===== UX 261120 B5a (F-G5-02): ZAWARTOŚĆ ZESTAWU MÓWIONA W JEDEN SPOSÓB =====
# Od 13.09 Skaner wchodzi do zestawu (RF_SETUP_SECTIONS w rf-28 buduje `include`). Opis rodzaju,
# rysunek „co jest czym" (rf-39k) i poradnik Zestawów (rf-39b) długo twierdziły, że Skaner jest
# „obok, osobno". Pilnujemy, żeby wszystkie trzy szły za listą sekcji.
import re as _re
_js = os.path.join(REPO, "web", "js")
_rd = lambda f: open(os.path.join(_js, f), "r", encoding="utf-8").read()
_sec_src = _rd("rf-28-setups.js")
_sec = _sec_src[_sec_src.index("const RF_SETUP_SECTIONS=["):]
_sec = _sec[:_sec.index("];")]
_keys = _re.findall(r'\{key:"(\w+)"', _sec)
check("F-G5-02: RF_SETUP_SECTIONS ma Skaner", "scan" in _keys, _keys)
# nazwa modułu, pod którą sekcja stoi w zdaniu rodzaju
_NAMES = {"rules": "Mapowanie", "mouse": "Mysz", "midi": "MIDI", "scan": "Skaner",
          "pose": "Osie 3D", "power": "Bateria", "pad": "Synth"}
_kinds = _rd("rf-49-kinds.js")
_m = _re.search(r'setup:\s*\{.*?explain:\s*\["([^"]+)"', _kinds, _re.S)
_expl = _m.group(1) if _m else ""
_head = _expl.split("Koło wyboru")[0]
check("F-G5-02: zdanie rodzaju „Zestaw” wymienia każdą sekcję zestawu przed „Koło wyboru”",
      bool(_expl) and all(_NAMES[k] in _head for k in _keys), _expl)
check("F-G5-02: zdanie rodzaju mówi „podmienia”, nie „wymienia”",
      "podmienia" in _expl and "wymienia" not in _expl, _expl)
_wi = _rd("rf-39k-whatis.js")
_cov = _re.search(r'\{id: "setup".*?covers: \[([^\]]*)\]', _wi, _re.S)
_cov = _re.findall(r'"(\w+)"', _cov.group(1)) if _cov else []
check("F-G5-02: rysunek „co jest czym”: zestaw pokrywa dokładnie RF_SETUP_SECTIONS",
      sorted(_cov) == sorted(_keys), (_cov, _keys))
check("F-G5-02: rysunek ma blok „scan”, do którego prowadzi krawędź",
      '{id: "scan"' in _wi)
_g = _rd("rf-39b-guides.js")
_gi = _g.index('{id:"konfiguracje",panel:"tab-konfiguracje"')
_fig = _g[_gi:_g.index("</figure>", _gi)]
_left, _right = _fig.split("OBOK", 1) if "OBOK" in _fig else (_fig, "")
check("F-G5-02: poradnik Zestawów rysuje Skaner w lewej kolumnie („ZESTAW, jeden plik”)",
      ">Skaner<" in _left and "Skaner" not in _right, _right[:200])

harness = os.path.join(os.path.dirname(os.path.abspath(__file__)), "kinds_harness.mjs")
try:
    p = subprocess.run(["node", harness], capture_output=True, text=True,
                       encoding="utf-8", timeout=60)
    out = json.loads((p.stdout or "").strip().splitlines()[-1]) if p.returncode == 0 else None
except (OSError, ValueError, IndexError, subprocess.SubprocessError) as e:  # noqa: BLE001
    p, out = None, None
    print("POMINIETO  panel (Node): %s" % e)
if out is None and p is not None:
    check("harness panelu wystartował", False, (p.stderr or p.stdout or "")[-400:])
for nm, ok_, detail in (out or {}).get("checks", []):
    check(nm, ok_, detail)

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
