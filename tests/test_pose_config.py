# Contract test: THE CAPSULE CARRIES A NAMED 3D AXIS CONFIGURATION.
# Run: py tests/test_pose_config.py
#
# Axis presets (Library/AxisPresets) existed here long before this: what did not exist was the
# LINK. Loading a preset made a COPY and the relationship ended there, so the capsule was nameless
# afterwards and three everyday questions had no answer anywhere in the app: what does this capsule
# have on its axes, is it still what I saved, which capsules have the same. The name (`configName`,
# a key of the pose config) is what makes those answerable; „zmienione" is then COMPUTED in the
# panel by comparing fingerprints and is deliberately stored nowhere.
#
# What is easy to break here, and silent when it breaks:
#
# 1. SETTING THE NAME MUST NOT TOUCH A SINGLE AXIS, and saving the axes must not erase the name.
#    Both directions matter: the name is a caption, and a caption has no business rewriting ten
#    tuning chains — while every ordinary save (a slider drag posts the whole configuration) has no
#    opinion about the caption and must leave it alone.
#
# 2. THE PRESET FILE DOES NOT CARRY THE NAME. It stands on the envelope; a file with a name inside
#    AND on top is a question about which one is true.
#
# 3. „FULL MEANS FULL". A preset that predates a field must come back with that field at its
#    FACTORY value, not missing — the panel rebuilds those fields from factory values too, and if
#    the two disagreed the fingerprints would differ and every capsule would read „zmienione" from
#    the moment it was loaded.
#
# 4. THE CALIBRATION TRAVELS. `cal` (the channel map plus signs) is carried by the preset and
#    applied on load — that is how this feature has always worked and this change does NOT alter
#    it. The test pins that behaviour down, because the panel's fingerprint counts `cal` for
#    exactly this reason (see the header of rf-49h).
#
# 5. THE NAME TRAVELS IN A SETUP — it describes the contents, and unlike a switch it is safe to
#    obey, because a name cannot make anything start sending.
#
# Nothing here touches the owner's Settings/ or Library/: both are pointed at a temp directory
# first, and no HTTP server is ever started — the endpoints' logic is tested through the very
# functions the handlers call (apply_pose_preset, save_pose_preset, pose_preset_items).
import json
import os
import shutil
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import ribbitflip_monitor as rf  # noqa: E402

_passed = 0
_failed = 0


def check(name, cond, detail=""):
    global _passed, _failed
    if cond:
        _passed += 1
        print("PASS  %s" % name)
    else:
        _failed += 1
        print("FAIL  %s%s" % (name, ("   -> " + str(detail)) if detail else ""))


class FakeBus:
    def now(self):
        return 0.0

    def publish(self, ev):
        pass


class FakeSource:
    def __init__(self):
        self.power = {}

    def set_power(self, cfg):
        if isinstance(cfg, dict):
            self.power.update(cfg)


class FakeDm:
    simulate = False


class FakeDevice:
    """Enough of a Device for apply_pose_preset / build_setup / apply_setup, with the REAL engines."""

    def __init__(self, dev_id="d0"):
        self.id = dev_id
        bus = FakeBus()
        self.bus = bus
        self.dm = FakeDm()
        self.trig = rf.TriggerEngine(bus, emitter=None, armed=True)
        self.mouse = rf.AirMouse(bus, emitter=None, trig=self.trig, gamepad=None)
        self.midimap = rf.MidiMapper(bus, midi=None, osc=None, trig=self.trig, slot=0)
        # SKANER wszedł do zestawu 2026-09-13 (`SETUP_KEYS` + `build_setup`), więc atrapa
        # kapsla bez niego przestała wystarczać: `build_setup` sięga po `d.scan.get_config()`.
        self.scan = rf.ScanModule(bus, dev_id)
        self.pose = rf.PoseFilter()
        self.source = FakeSource()
        self.cal = None

    def apply_cal(self, cal):
        self.cal = cal


# A sandbox for Settings/ and Library/, so nothing below can reach the owner's live configuration.
_TMP = tempfile.mkdtemp(prefix="rf-posecfg-")
rf.SETTINGS_DIR = os.path.join(_TMP, "Settings")
rf.POSE_PROFILE_DIR = os.path.join(_TMP, "Library", "AxisPresets")
rf.PROFILE_DIR = os.path.join(_TMP, "Library", "Profiles")
rf.MOUSE_PRESET_DIR = os.path.join(_TMP, "Library", "MousePresets")
rf.SETUPS_DIR = os.path.join(_TMP, "Library", "Setups")
# …and the library index, which was built from those names at import time.
rf._LIBRARY_KINDS = {"setup": rf.SETUPS_DIR, "profile": rf.PROFILE_DIR,
                     "pose": rf.POSE_PROFILE_DIR, "mouse": rf.MOUSE_PRESET_DIR}
for _d in (rf.SETTINGS_DIR, rf.POSE_PROFILE_DIR, rf.PROFILE_DIR, rf.MOUSE_PRESET_DIR, rf.SETUPS_DIR):
    os.makedirs(_d, exist_ok=True)
POSE_PATH = rf._dev_path("d0", "pose")


def write_preset_raw(name, obj):
    """A preset file exactly as written, bypassing save_pose_preset — that is how a file from an
    older build, or one edited by hand, arrives."""
    with open(os.path.join(rf.POSE_PROFILE_DIR, name + ".json"), "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False)


def read_pose_file():
    with open(POSE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def post_pose(dev, body):
    """What POST /pose does with a body, minus the HTTP: merge onto the file, then save. The engine
    calls the handler makes around it (set_gain / set_resp / …) do not touch the name, so the merge
    is the whole of the interesting part."""
    cfg = rf._sanitize_pose_cfg(body, rf.load_pose(dev))
    rf.save_pose(cfg, dev)
    return cfg


# A configuration with something REAL in it: a non-default channel map, an inverted lean, one tuned
# filter axis and one tuned raw channel. `tilt` is deliberately left at factory values — the Node
# harness probes every field of a chain there, and a probe that happened to match would pass for
# the wrong reason.
def sample_cfg():
    axes = rf.pose_axes_default()
    axes["twist"] = dict(axes["twist"], on=True, smooth="adapt", smoothMs=140.0, zero=5.0,
                         dead=12.0, inHi=360.0, outHi=200.0, expo=1.4)
    chans = rf.pose_chans_default()
    chans["ch3"] = dict(chans["ch3"], on=True, dead=250.0, inHi=20000.0, outHi=16000.0)
    return {"resp": 0.62, "smoothLvl": 0.4, "mirror": True, "mode": "filter", "gain": 1.8,
            "inv": {"pitch": True, "roll": False},
            "cal": {"acc": [[4, 1], [3, -1], [5, 1]], "gyr": [[1, 1], [0, 1], [2, -1]]},
            "axes": axes, "chans": chans}


try:
    # ---------------------------------------------------------------------------
    #  1. the name itself
    # ---------------------------------------------------------------------------
    print("--- nazwa konfiguracji osi (ta sama sanityzacja, co przy wyzwalaczach) ---")
    d = FakeDevice()
    cfg = post_pose("d0", dict(sample_cfg(), configName="  Biurko \n  z   dwoma  ekranami "))
    check("biały znak zwinięty, spacje po bokach obcięte",
          cfg["configName"] == "Biurko z dwoma ekranami", repr(cfg["configName"]))
    check("obcięta do 40 znaków",
          len(post_pose("d0", {"configName": "x" * 80})["configName"]) == 40,
          len(post_pose("d0", {"configName": "x" * 80})["configName"]))
    # Liczba albo słownik w tym polu to zepsuty plik, a nie nazwa: lepiej „bez nazwy" niż „123".
    check("liczba to nie nazwa", post_pose("d0", {"configName": 123})["configName"] == "")
    check("słownik to nie nazwa", post_pose("d0", {"configName": {"a": 1}})["configName"] == "")

    print("\n--- POST /pose: nazwa i osie nie depczą sobie po piętach -----------")
    d = FakeDevice()
    base = post_pose("d0", sample_cfg())
    before = json.dumps({k: v for k, v in base.items() if k != "configName"}, sort_keys=True)
    named = post_pose("d0", {"configName": "Biurko z dwoma ekranami"})   # pasek wysyła TYLKO nazwę
    check("nadanie nazwy nie rusza ani jednej osi",
          json.dumps({k: v for k, v in named.items() if k != "configName"}, sort_keys=True) == before,
          named)
    check("…i nazwa jest na kapslu", named["configName"] == "Biurko z dwoma ekranami",
          named["configName"])
    # Zapis osi BEZ zdania o nazwie (auto-zapis panelu przy każdym suwaku) jej nie kasuje —
    # _sanitize_pose_cfg scala i dotyka wyłącznie kluczy, które przyszły.
    after = post_pose("d0", {"resp": 0.15})
    check("zapis osi bez zdania o nazwie jej nie kasuje",
          after["configName"] == "Biurko z dwoma ekranami" and abs(after["resp"] - 0.15) < 1e-9,
          after["configName"])
    check("…i naprawdę leży w pliku kapsla",
          read_pose_file().get("configName") == "Biurko z dwoma ekranami", read_pose_file().get("configName"))
    check("pusta nazwa naprawdę zdejmuje podpis",
          post_pose("d0", {"configName": ""})["configName"] == "")

    print("\n--- plik sprzed nazw: kapsel po prostu nic nie nosi ----------------")
    rf.save_pose({"resp": 0.5, "gain": 1.0}, "d1")       # tak wyglądał plik przed tą zmianą
    old = rf.load_pose("d1")
    check("stary plik nie ma tego klucza", "configName" not in old, list(old.keys()))
    # Tak składa odpowiedź GET /pose (i tak samo panel pyta o nazwę): brak klucza = pusto,
    # co jest zupełnie normalnym stanem — osie ułożone ręcznie i nigdy nie zapisane pod nazwą.
    check("…a odczyt oddaje pusto, nie `None`",
          rf._rules_config_name(old.get("configName")) == "",
          repr(rf._rules_config_name(old.get("configName"))))

    # ---------------------------------------------------------------------------
    #  2. preset: co plik niesie, a czego nie
    # ---------------------------------------------------------------------------
    print("\n--- zapis presetu: nazwa stoi na WIERZCHU, nie w treści ------------")
    src = dict(sample_cfg(), configName="Nie ta nazwa")
    check("preset zapisany", rf.save_pose_preset("Biurko z dwoma ekranami",
                                                 rf._pose_full_cfg(src)) is True)
    with open(os.path.join(rf.POSE_PROFILE_DIR, "Biurko z dwoma ekranami.json"),
              "r", encoding="utf-8") as f:
        env = json.load(f)
    check("koperta mówi, co to za plik",
          env.get("app") == "ribbitflip" and env.get("kind") == "pose-preset"
          and env.get("version") == rf.POSE_FORMAT and env.get("name") == "Biurko z dwoma ekranami", env)
    check("nazwa stoi na WIERZCHU pliku, nie w treści", "configName" not in env["config"],
          list(env["config"].keys()))
    check("…a osie są w całości",
          abs(env["config"]["resp"] - 0.62) < 1e-9 and env["config"]["mirror"] is True
          and env["config"]["axes"]["twist"]["on"] is True
          and env["config"]["chans"]["ch3"]["dead"] == 250.0, env["config"].get("resp"))
    check("…razem z kalibracją, bo preset ją NIESIE (patrz nagłówek rf-49h)",
          env["config"]["cal"] == {"acc": [[4, 1], [3, -1], [5, 1]],
                                   "gyr": [[1, 1], [0, 1], [2, -1]]}, env["config"].get("cal"))
    # Obrona przy zapisie działa też wtedy, gdy ktoś woła save_pose_preset z surową konfiguracją
    # (testy, przyszły eksport) — plik z dwiema nazwami to pytanie, która jest prawdziwa.
    rf.save_pose_preset("Surowy", dict(sample_cfg(), configName="Przemycona"))
    with open(os.path.join(rf.POSE_PROFILE_DIR, "Surowy.json"), "r", encoding="utf-8") as f:
        raw_env = json.load(f)
    check("surowy zapis też wycina nazwę z treści", "configName" not in raw_env["config"],
          list(raw_env["config"].keys()))
    check("preset skasowany", rf.delete_pose_preset("Surowy") is True)

    print("\n--- „pełne znaczy pełne”: preset sprzed pola oddaje wartość fabryczną ---")
    # Konfiguracja sprzed `smoothLvl`, `inv` i łańcuchów strojenia. Panel odbudowuje te pola
    # z wartości fabrycznych, więc serwer musi zrobić DOKŁADNIE to samo — inaczej odcisk porównuje
    # „nic" z „1.000" i kapsel jest „zmieniony" od chwili wczytania.
    thin = rf._pose_full_cfg({"resp": 0.4})
    check("czułość z pliku zostaje", abs(thin["resp"] - 0.4) < 1e-9, thin["resp"])
    check("wygładzanie podglądu wraca fabryczne", thin["smoothLvl"] == 1.0, thin.get("smoothLvl"))
    check("lustro wraca fabryczne", thin["mirror"] is False, thin.get("mirror"))
    check("tryb podglądu wraca fabryczny", thin["mode"] == "mahony", thin.get("mode"))
    check("kierunki przechyłu wracają fabryczne",
          thin["inv"] == {"pitch": False, "roll": False}, thin.get("inv"))
    check("mapa kanałów wraca potwierdzona", thin["cal"] == rf.POSE_CAL_DEFAULT, thin.get("cal"))
    check("wychylenie wraca fabryczne", abs(thin["gain"] - 1.0) < 1e-9, thin.get("gain"))
    check("łańcuchy strojenia w komplecie",
          sorted(thin["axes"]) == sorted(rf.POSE_AXIS_KEYS)
          and sorted(thin["chans"]) == sorted(rf.POSE_CHAN_KEYS), sorted(thin.get("axes", {})))
    # …i domyślna mapa kanałów jest KOPIĄ, nie współdzielonym słownikiem: dwie konfiguracje
    # trzymające ten sam obiekt to jedna rekalibracja psująca oba presety naraz.
    other = rf._pose_full_cfg({})
    thin["cal"]["acc"][0][0] = 1
    check("…a domyślna mapa to kopia, nie wspólny obiekt",
          other["cal"] == rf.POSE_CAL_DEFAULT and rf.POSE_CAL_DEFAULT["acc"][0][0] == 3,
          rf.POSE_CAL_DEFAULT)

    print("\n--- stara generacja pliku presetu (goła konfiguracja) --------------")
    # Plik sprzed koperty JEST konfiguracją. Rozpoznawany po znaczniku, nie po zgadywaniu kluczy.
    write_preset_raw("Prastary", {"resp": 0.9, "gain": 2.0,
                                  "cal": {"acc": [[3, 1], [4, 1], [5, 1]],
                                          "gyr": [[0, 1], [1, 1], [2, 1]]}})
    loaded = rf.load_pose_preset("Prastary")
    check("goła konfiguracja dalej się wczytuje",
          isinstance(loaded, dict) and abs(loaded["resp"] - 0.9) < 1e-9, loaded)
    check("nieznana nazwa to brak pliku, nie wyjątek", rf.load_pose_preset("Nie ma takiego") is None)

    # ---------------------------------------------------------------------------
    #  3. wczytanie presetu nazywa kapsel
    # ---------------------------------------------------------------------------
    print("\n--- apply_pose_preset: osie podmienione, kapsel nazwany ------------")
    dst = FakeDevice()
    post_pose("d0", {"resp": 0.1, "gain": 1.0, "mirror": False,
                     "cal": {"acc": [[3, 1], [4, 1], [5, 1]], "gyr": [[0, 1], [1, 1], [2, 1]]},
                     "configName": "Coś starego"})
    got = rf.apply_pose_preset(dst, "Biurko z dwoma ekranami")
    check("preset się wczytał", isinstance(got, dict), type(got))
    check("osie podmienione",
          abs(got["resp"] - 0.62) < 1e-9 and got["mirror"] is True
          and got["axes"]["twist"]["on"] is True, got.get("resp"))
    check("kapsel od razu nosi nazwę presetu",
          got["configName"] == "Biurko z dwoma ekranami", got["configName"])
    check("KALIBRACJA nałożona na silnik (zachowanie sprzed tej zmiany)",
          dst.cal == {"acc": [[4, 1], [3, -1], [5, 1]], "gyr": [[1, 1], [0, 1], [2, -1]]}, dst.cal)
    check("…i wychylenie poszło do filtra", abs(dst.pose.gain - 1.8) < 1e-9, dst.pose.gain)
    check("…a wszystko jest zapisane na dysku",
          read_pose_file().get("configName") == "Biurko z dwoma ekranami"
          and abs(read_pose_file().get("resp") - 0.62) < 1e-9, read_pose_file().get("configName"))
    check("nieistniejący preset to brak odpowiedzi, nie pusta konfiguracja",
          rf.apply_pose_preset(dst, "Nie ma takiego") is None)
    check("…i nazwa po nieudanym wczytaniu zostaje",
          read_pose_file().get("configName") == "Biurko z dwoma ekranami", read_pose_file())
    # Nazwa jest NAZWĄ PLIKU, nawet gdy ktoś wpisał inną do środka.
    write_preset_raw("Podstępny", {"app": "ribbitflip", "kind": "pose-preset", "version": 1,
                                   "name": "Podstępny",
                                   "config": {"resp": 0.25, "configName": "Nie ta nazwa"}})
    out = rf.apply_pose_preset(FakeDevice("d3"), "Podstępny")   # inny kapsel — d0 ma nas jeszcze zainteresować
    check("nazwa z KOPERTY wygrywa z tą wpisaną w treść",
          out["configName"] == "Podstępny", out["configName"])

    # ---------------------------------------------------------------------------
    #  4. lista dla paska (GET /pose-presets)
    # ---------------------------------------------------------------------------
    print("\n--- GET /pose-presets niesie TREŚĆ presetów ------------------------")
    # Wartość poza zakresem w pliku: kapsel jest ZAWSZE po sanityzacji, więc preset też musi być —
    # inaczej preset, którego nikt nie tknął, zgłaszałby się jako „zmieniony" tylko dlatego, że
    # silnik przyciął mu wartość przy wczytaniu.
    write_preset_raw("Przesadzony", {"app": "ribbitflip", "kind": "pose-preset", "version": 1,
                                     "name": "Przesadzony",
                                     "config": {"gain": 99.0, "mode": "bzdura", "resp": -5}})
    names = rf.list_pose_presets()
    check("wszystkie presety na liście, po alfabecie",
          names == sorted(names, key=str.lower) and len(names) == 4, names)
    items = rf.pose_preset_items()
    by = {it["name"]: it["config"] for it in items}
    check("każdy preset przychodzi z konfiguracją", len(items) == 4 and all(by.values()), len(items))
    check("…przyciętą tak, jak przyciąłby ją silnik",
          abs(by["Przesadzony"]["gain"] - 4.0) < 1e-9 and by["Przesadzony"]["mode"] == "mahony"
          and abs(by["Przesadzony"]["resp"] - 0.0) < 1e-9, by["Przesadzony"].get("gain"))
    check("…i bez nazwy w treści", all("configName" not in c for c in by.values()),
          [n for n, c in by.items() if "configName" in c])
    check("…i z pełnymi łańcuchami strojenia, nawet gdy plik ich nie zna",
          sorted(by["Prastary"]["axes"]) == sorted(rf.POSE_AXIS_KEYS), sorted(by["Prastary"]["axes"]))

    print("\n--- kasowanie presetu NIE odbiera kapslowi nazwy -------------------")
    check("preset skasowany", rf.delete_pose_preset("Przesadzony") is True)
    check("…i naprawdę zniknął z listy", "Przesadzony" not in rf.list_pose_presets(),
          rf.list_pose_presets())
    check("kapsel nadal nosi swoją nazwę",
          read_pose_file().get("configName") == "Biurko z dwoma ekranami", read_pose_file())

    # ---------------------------------------------------------------------------
    #  5. nazwa jedzie w zestawie
    # ---------------------------------------------------------------------------
    print("\n--- zestaw (build_setup / apply_setup) ------------------------------")
    s = FakeDevice()
    post_pose("d0", dict(sample_cfg(), configName="Biurko z dwoma ekranami"))
    setup = rf.build_setup(s)
    check("zestaw niesie nazwę konfiguracji osi",
          setup["pose"].get("configName") == "Biurko z dwoma ekranami",
          setup["pose"].get("configName"))

    t = FakeDevice("d2")
    post_pose("d2", {"resp": 0.2, "configName": "Stara nazwa"})
    res = rf.apply_setup(t, setup, t.bus)
    check("zestaw się nałożył", "pose" in res["applied"], res)
    tgt = rf.load_pose("d2")
    check("kapsel-cel nosi nazwę z zestawu",
          tgt.get("configName") == "Biurko z dwoma ekranami", tgt.get("configName"))
    check("…i jego osie są z zestawu", abs(tgt.get("resp") - 0.62) < 1e-9, tgt.get("resp"))

    # Zestaw sprzed nazw nie ma prawa wyczyścić podpisu, którego nie zna.
    old_style = dict(setup)
    old_style["pose"] = {k: v for k, v in setup["pose"].items() if k != "configName"}
    post_pose("d2", {"configName": "Moje własne"})
    rf.apply_setup(FakeDevice("d2"), old_style, FakeBus())
    check("stary zestaw zostawia nazwę kapsla w spokoju",
          rf.load_pose("d2").get("configName") == "Moje własne",
          rf.load_pose("d2").get("configName"))

    # ---------------------------------------------------------------------------
    #  6. pasek jest w ogóle WŁĄCZONY do aplikacji
    # ---------------------------------------------------------------------------
    # Najtańsza awaria tej zmiany: plik napisany, ale nigdzie nie wpięty. Wtedy wszystko poniżej
    # przechodzi, serwer robi swoje, a w przeglądarce nie ma paska i NIE MA BŁĘDU — bo nic go nie
    # woła. Trzy warunki, bez których to nie ma prawa działać, sprawdzone statycznie.
    print("\n--- wpięcie do aplikacji (skrypt, boot, miejsce montażu) ------------")
    _WEB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "web")

    def _read(rel):
        with open(os.path.join(_WEB, rel), "r", encoding="utf-8") as f:
            return f.read()

    html, boot, tabs = _read("ribbitflip_dashboard.html"), _read("js/rf-40-boot.js"), _read("js/rf-34-tabs.js")
    check("skrypt wpięty w stronę", "rf-49h-pose-config.js" in html)
    check("…po rf-49g (kolejność sekcji)",
          html.index("rf-49g-synth-scenes.js") < html.index("rf-49h-pose-config.js"))
    check("montaż wołany przy starcie", "initPoseCfgBar" in boot)
    check("…i PO initTabs, bo dopiero tam powstaje fold",
          boot.index("initTabs") < boot.index("initPoseCfgBar"))
    check("miejsce montażu istnieje: fold osi", 'calFold.id="poseCalFold"' in tabs)
    check("…i panel, obok którego pasek stanie", 'calBox.className="posecal"' in tabs)
    # Hak, bez którego pasek nigdy nie zapali „zmienione": jedyna droga zapisu z panelu.
    check("savePoseCal odświeża pasek", "poseCfgSync" in _read("js/rf-33-posecal.js"))
    check("stary rząd presetów też go odświeża", "poseCfgSync" in _read("js/rf-13-power-profiles.js"))

    # ---------------------------------------------------------------------------
    #  7. druga połowa granicy — ta, którą liczy PANEL
    # ---------------------------------------------------------------------------
    # „Zmienione" wylicza przeglądarka, więc najkruchsze założenie tej funkcji nie mieszka
    # w Pythonie: odcisk musi liczyć DOKŁADNIE te pola, które preset niesie. Jedno za dużo i każdy
    # kapsel jest „zmieniony" od chwili wczytania. Harness w Node bierze obie strony prosto stąd
    # (serwer) i puszcza je przez PRAWDZIWY kod panelu — bez przeglądarki i bez serwera.
    print("\n--- panel: odcisk liczy dokładnie to, co preset niesie -------------")
    live = rf.apply_pose_preset(FakeDevice(), "Biurko z dwoma ekranami")
    payload = json.dumps({"cfg": live, "preset": by["Biurko z dwoma ekranami"]}, ensure_ascii=False)
    harness = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pose_config_harness.mjs")
    try:
        p = subprocess.run(["node", harness, payload], capture_output=True, text=True,
                           encoding="utf-8", timeout=60)
        out = json.loads((p.stdout or "").strip().splitlines()[-1]) if p.returncode == 0 else None
    except (OSError, ValueError, IndexError, subprocess.SubprocessError) as e:
        p, out = None, None
        print("POMINIETO  panel (Node): %s" % e)
    if out is None and p is not None:
        check("harness panelu wystartował", False, (p.stderr or p.stdout or "")[-300:])
    for nm, ok, detail in (out or {}).get("checks", []):
        check(nm, ok, detail)

finally:
    shutil.rmtree(_TMP, ignore_errors=True)

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
