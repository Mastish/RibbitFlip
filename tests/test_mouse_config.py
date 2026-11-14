# Contract test: THE CAPSULE CARRIES A NAMED MOUSE PROFILE.
# Run: py tests/test_mouse_config.py
#
# Motion control was the one module with no presets at all: over a hundred knobs, one set per
# capsule, and no way to keep „Precyzja przy głowie" next to „FPS szybki" — let alone to answer
# „is this still what I set up yesterday". The name (`configName`, a key of the mouse config) is
# what makes that answerable; „zmienione" is then COMPUTED in the panel by comparing fingerprints
# and is deliberately stored nowhere.
#
# What is easy to break here, and silent when it breaks:
#
# 1. THE BORDER OF THE PROFILE (MOUSE_PRESET_SKIP). A profile carries BEHAVIOUR. The group switch,
#    the capsule's virtual controller and the whole cursor-area group stay with the capsule: they
#    are decisions about THIS capsule at THIS desk. Get this wrong and loading somebody's profile
#    arms an output, re-plugs the capsule into another player's controller, or fences the cursor
#    onto a monitor this machine does not have.
#
# 2. THE DEFENCE HAS TO WORK ON READ, NOT ONLY ON WRITE. A file with those keys hand-added (or
#    written by a future build) must be just as harmless as one this build saved.
#
# 3. SETTING THE NAME MUST NOT TOUCH A SINGLE KNOB, and saving the settings must not erase the
#    name. Both directions matter: the name is a caption, and a caption has no business rewriting
#    a hundred fields — while every ordinary save (the pad registry writes the mouse file
#    key-by-key) has no opinion about the caption and must leave it alone.
#
# 4. THE NAME TRAVELS IN A SETUP — it describes the contents, like the group flags do, and unlike
#    them it is safe to obey, because a name cannot make anything start sending.
#
# 5. THE PROFILE ALSO CARRIES A DESCRIPTION (`desc`, since 2026-08-28). The name answers "which one
#    is this"; it does NOT answer "what is it for", and a week later „FPS szybki" means nothing to
#    the person who typed it. Three things break silently here: an OLD FILE has to load as "the
#    author wrote nothing"; saving the settings must not erase the sentence (both go down one road,
#    POST /mouse-preset/save, so the caller has to hand the existing description back); and editing
#    the sentence must not rewrite a hundred knobs with whatever is on the capsule at that moment.
#    One limit for all three preset kinds — PROFILE_DESC_MAX — read by the panel from the server.
#
# Nothing here touches the owner's Settings/ or Library/: both are pointed at a temp directory
# first, and no HTTP server is ever started — the endpoints' logic is tested through the very
# functions the handlers call (apply_mouse_preset, save_mouse_preset, mouse_preset_items).
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


def _say(s):
    # Konsola Windows bywa w cp1250, a nazwy sprawdzen z harnessu niosa znaki z panelu (✎, ✕,
    # cudzyslowy drukarskie). Wyjatek kodowania w linii RAPORTU przerwalby test, ktory wlasnie cos
    # sprawdzil - czyli zabralby dokladnie te informacje, dla ktorej test istnieje.
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


class FakeBus:
    def __init__(self):
        self.events = []

    def now(self):
        return 0.0

    def publish(self, ev):
        self.events.append(ev)


class FakeSource:
    def __init__(self):
        self.power = {}

    def set_power(self, cfg):
        if isinstance(cfg, dict):
            self.power.update(cfg)


class FakeDm:
    simulate = False


class FakeDevice:
    """Enough of a Device for apply_mouse_preset / build_setup / apply_setup, with the REAL engines."""

    def __init__(self, dev_id="d0"):
        self.id = dev_id
        bus = FakeBus()
        self.bus = bus
        self.dm = FakeDm()
        self.trig = rf.TriggerEngine(bus, emitter=None, armed=True)
        self.mouse = rf.AirMouse(bus, emitter=None, trig=self.trig, gamepad=None)
        self.midimap = rf.MidiMapper(bus, midi=None, osc=None, trig=self.trig, slot=0)
        # SKANER wszedł do zestawu 2026-09-13 (`SETUP_KEYS` + `build_setup`), więc atrapa kapsla
        # bez niego przestała wystarczać: `build_setup` sięga po `d.scan.get_config()` i cały ten
        # plik wywracał się na AttributeError, zanim doszedł do sekcji o zestawach.
        self.scan = rf.ScanModule(bus, dev_id)
        self.pose = rf.PoseFilter()
        self.source = FakeSource()
        self.cal = None

    def apply_cal(self, cal):
        self.cal = cal


class FakePads:
    """The REAL pad-registry writer, without a whole DeviceManager. `_pad_share_set` is the one
    place that writes the mouse file KEY-BY-KEY (rather than dumping the engine), so it is the one
    place where a caption could quietly fall out of the file."""

    _pad_share_of = rf.DeviceManager._pad_share_of
    _pad_share_set = rf.DeviceManager._pad_share_set


# A sandbox for Settings/ and Library/, so nothing below can reach the owner's live configuration.
_TMP = tempfile.mkdtemp(prefix="rf-mousecfg-")
rf.SETTINGS_DIR = os.path.join(_TMP, "Settings")
rf.MOUSE_PRESET_DIR = os.path.join(_TMP, "Library", "MousePresets")
rf.PROFILE_DIR = os.path.join(_TMP, "Library", "Profiles")
rf.POSE_PROFILE_DIR = os.path.join(_TMP, "Library", "AxisPresets")
rf.SETUPS_DIR = os.path.join(_TMP, "Library", "Setups")
# …and the library index, which was built from those names at import time.
rf._LIBRARY_KINDS = {"setup": rf.SETUPS_DIR, "profile": rf.PROFILE_DIR,
                     "pose": rf.POSE_PROFILE_DIR, "mouse": rf.MOUSE_PRESET_DIR}
for _d in (rf.SETTINGS_DIR, rf.MOUSE_PRESET_DIR, rf.PROFILE_DIR, rf.POSE_PROFILE_DIR, rf.SETUPS_DIR):
    os.makedirs(_d, exist_ok=True)
MOUSE_PATH = rf._dev_path("d0", "mouse")


def write_preset_raw(name, obj):
    """A preset file exactly as written, bypassing save_mouse_preset — that is how a file from a
    newer build, or one edited by hand, arrives."""
    with open(os.path.join(rf.MOUSE_PRESET_DIR, name + ".json"), "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False)


def read_mouse_file():
    with open(MOUSE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


try:
    # ---------------------------------------------------------------------------
    #  1. the name itself
    # ---------------------------------------------------------------------------
    print("--- nazwa profilu myszy (sanityzacja przez silnik) ----------------")
    d = FakeDevice()
    d.mouse.set_config({"configName": "  Precyzja \n  przy   głowie "})
    check("biały znak zwinięty, spacje po bokach obcięte",
          d.mouse.get_config()["configName"] == "Precyzja przy głowie",
          repr(d.mouse.get_config()["configName"]))
    d.mouse.set_config({"configName": "x" * 80})
    check("obcięta do 40 znaków", len(d.mouse.get_config()["configName"]) == 40,
          len(d.mouse.get_config()["configName"]))
    # Liczba albo słownik w tym polu to zepsuty plik, a nie nazwa: lepiej „bez nazwy" niż „123".
    d.mouse.set_config({"configName": 123})
    check("liczba to nie nazwa", d.mouse.get_config()["configName"] == "",
          repr(d.mouse.get_config()["configName"]))
    d.mouse.set_config({"configName": {"a": 1}})
    check("słownik to nie nazwa", d.mouse.get_config()["configName"] == "",
          repr(d.mouse.get_config()["configName"]))
    check("świeży silnik nic nie nosi",
          rf.AirMouse(FakeBus(), emitter=None, trig=None, gamepad=None).get_config()["configName"] == "")

    # ---------------------------------------------------------------------------
    #  2. SAMA nazwa vs CAŁA konfiguracja (to, co robią oba warianty POST /airmouse)
    # ---------------------------------------------------------------------------
    print("\n--- POST /airmouse: nazwa i ustawienia nie depczą sobie po piętach ---")
    d = FakeDevice()
    d.mouse.set_config({"sensX": 0.2, "maxStep": 50, "mode": "stick"})
    d.mouse.set_config({"configName": "FPS szybki"})     # pasek wysyła TYLKO nazwę
    cfg = d.mouse.get_config()
    check("nadanie nazwy nie rusza ani jednego pokrętła",
          abs(cfg["sensX"] - 0.2) < 1e-9 and cfg["maxStep"] == 50 and cfg["mode"] == "stick", cfg["sensX"])
    check("…i nazwa jest na kapslu", cfg["configName"] == "FPS szybki", cfg["configName"])
    # Zapis ustawień BEZ zdania o nazwie (starszy build, zestaw sprzed nazw) jej nie kasuje —
    # set_config scala, dotyka wyłącznie kluczy, które przyszły.
    d.mouse.set_config({"sensX": 0.4})
    check("zapis ustawień bez zdania o nazwie jej nie kasuje",
          d.mouse.get_config()["configName"] == "FPS szybki", d.mouse.get_config()["configName"])
    d.mouse.set_config({"configName": ""})
    check("pusta nazwa naprawdę zdejmuje podpis",
          d.mouse.get_config()["configName"] == "", d.mouse.get_config()["configName"])

    print("\n--- nazwa przeżywa zapis i odczyt pliku kapsla --------------------")
    d.mouse.set_config({"configName": "Precyzja przy głowie"})
    rf.save_mouse(d.mouse.get_config(), "d0")
    check("nazwa ląduje w pliku myszy",
          read_mouse_file().get("configName") == "Precyzja przy głowie", read_mouse_file().get("configName"))
    d2 = FakeDevice()
    d2.mouse.set_config(rf.load_mouse("d0"))
    check("…i wraca przy starcie kapsla",
          d2.mouse.get_config()["configName"] == "Precyzja przy głowie",
          d2.mouse.get_config()["configName"])
    # Rejestr padów zapisuje plik myszy KLUCZ PO KLUCZU (bo w symulacji nie wolno mu zrzucić
    # pamięci). To jedyne miejsce, w którym podpis mógłby po cichu wypaść z pliku.
    FakePads()._pad_share_set(d, "p7")
    check("przepięcie kapsla na inny pad nie gubi nazwy w pliku",
          read_mouse_file().get("configName") == "Precyzja przy głowie", read_mouse_file())
    check("…i naprawdę zapisało pada", read_mouse_file().get("padShare") == "p7", read_mouse_file())

    # ---------------------------------------------------------------------------
    #  3. granica profilu — co plik NIESIE, a co zostaje przy kapslu
    # ---------------------------------------------------------------------------
    print("\n--- zapis presetu: przełącznik, pad i stanowisko NIE wchodzą -----")
    src = FakeDevice()
    src.mouse.set_config({"enabled": True, "padShare": "p3", "mouseArea": "monitor",
                          "mouseMonitor": "\\\\.\\DISPLAY2", "mouseAreaWork": True,
                          "mouseAreaPad": 12.0, "mouseRectX": 100.0, "mouseRectY": 200.0,
                          "mouseRectW": 1280.0, "mouseRectH": 720.0,
                          "configName": "Precyzja przy głowie",
                          "sensX": 0.11, "mouseExpo": 1.7, "dwellOn": True})
    check("preset zapisany", rf.save_mouse_preset("Precyzja przy głowie", src.mouse.get_config()) is True)
    with open(os.path.join(rf.MOUSE_PRESET_DIR, "Precyzja przy głowie.json"), "r", encoding="utf-8") as f:
        env = json.load(f)
    check("koperta mówi, co to za plik",
          env.get("app") == "ribbitflip" and env.get("kind") == "mouse-preset"
          and env.get("version") == rf.MOUSE_FORMAT and env.get("name") == "Precyzja przy głowie", env)
    left = [k for k in rf.MOUSE_PRESET_SKIP if k in (env.get("config") or {})]
    check("w pliku NIE MA ani jednego klucza z MOUSE_PRESET_SKIP", left == [], left)
    check("…a zachowanie jest w całości",
          abs(env["config"]["sensX"] - 0.11) < 1e-9 and abs(env["config"]["mouseExpo"] - 1.7) < 1e-9
          and env["config"]["dwellOn"] is True, env["config"].get("sensX"))
    check("nazwa stoi na WIERZCHU pliku, nie w treści",
          env.get("name") == "Precyzja przy głowie" and "configName" not in env["config"], env.get("name"))

    print("\n--- wczytanie presetu: kapsel zostaje przy swoim stanowisku ------")
    dst = FakeDevice()
    dst.mouse.set_config({"enabled": True, "padShare": "p1", "mouseArea": "custom",
                          "mouseMonitor": "\\\\.\\DISPLAY1", "mouseAreaWork": False,
                          "mouseAreaPad": 4.0, "mouseRectX": 0.0, "mouseRectY": 0.0,
                          "mouseRectW": 800.0, "mouseRectH": 600.0,
                          "configName": "Coś starego", "sensX": 0.9})
    got = rf.apply_mouse_preset(dst, "Precyzja przy głowie")
    check("preset się wczytał", isinstance(got, dict), type(got))
    check("zachowanie podmienione", abs(got["sensX"] - 0.11) < 1e-9 and got["dwellOn"] is True, got["sensX"])
    check("kapsel od razu nosi nazwę profilu", got["configName"] == "Precyzja przy głowie", got["configName"])
    # Wczytanie zmienia to, CO kapsel robi — nigdy tego, czy mu WOLNO (jak apply_setup/apply_profile).
    check("przełącznik grupy nietknięty", got["enabled"] is True, got["enabled"])
    check("kapsel gra dalej na SWOIM kontrolerze", got["padShare"] == "p1", got["padShare"])
    check("obszar kursora zostaje tej maszyny",
          got["mouseArea"] == "custom" and got["mouseMonitor"] == "\\\\.\\DISPLAY1"
          and got["mouseAreaWork"] is False and abs(got["mouseAreaPad"] - 4.0) < 1e-9
          and abs(got["mouseRectW"] - 800.0) < 1e-9 and abs(got["mouseRectH"] - 600.0) < 1e-9,
          {k: got[k] for k in ("mouseArea", "mouseMonitor", "mouseAreaWork", "mouseRectW")})
    check("…i jest to zapisane na dysku",
          read_mouse_file().get("configName") == "Precyzja przy głowie"
          and read_mouse_file().get("padShare") == "p1", read_mouse_file().get("padShare"))
    check("nieistniejący preset to brak odpowiedzi, nie pusta konfiguracja",
          rf.apply_mouse_preset(dst, "Nie ma takiego") is None)
    check("…i nazwa po nieudanym wczytaniu zostaje",
          dst.mouse.get_config()["configName"] == "Precyzja przy głowie")

    print("\n--- obrona przy ODCZYCIE: spreparowany plik nic nie przemyci -----")
    # Plik z ręki (albo z nowszego builda) z całą paczką kluczy, których preset nie ma prawa nieść.
    write_preset_raw("Podstępny", {"app": "ribbitflip", "kind": "mouse-preset", "version": 1,
                                   "name": "Podstępny",
                                   "config": {"enabled": True, "padShare": "p9",
                                              "mouseArea": "desktop",
                                              "mouseMonitor": "\\\\.\\DISPLAY9",
                                              "mouseAreaWork": True, "mouseAreaPad": 99.0,
                                              "mouseRectX": 9.0, "mouseRectY": 9.0,
                                              "mouseRectW": 9999.0, "mouseRectH": 9999.0,
                                              "configName": "Nie ta nazwa",
                                              "sensX": 0.05}})
    tgt = FakeDevice()
    tgt.mouse.set_config({"enabled": False, "padShare": "p2", "mouseArea": "cursor",
                          "mouseMonitor": "", "mouseAreaWork": False, "mouseRectW": 640.0})
    out = rf.apply_mouse_preset(tgt, "Podstępny")
    check("zachowanie z pliku weszło", abs(out["sensX"] - 0.05) < 1e-9, out["sensX"])
    check("przełącznik z pliku NIE uzbroił wyjścia", out["enabled"] is False, out["enabled"])
    check("pad z pliku nie przepiął kapsla", out["padShare"] == "p2", out["padShare"])
    check("stanowisko z pliku nie ruszyło kursora",
          out["mouseArea"] == "cursor" and out["mouseMonitor"] == ""
          and out["mouseAreaWork"] is False and abs(out["mouseRectW"] - 640.0) < 1e-9,
          {k: out[k] for k in ("mouseArea", "mouseMonitor", "mouseAreaWork", "mouseRectW")})
    check("nazwa jest NAZWĄ PLIKU, nie tym, co ktoś wpisał w treść",
          out["configName"] == "Podstępny", out["configName"])

    # ---------------------------------------------------------------------------
    #  4. lista dla paska (GET /mouse-presets)
    # ---------------------------------------------------------------------------
    print("\n--- GET /mouse-presets niesie TREŚĆ profili -----------------------")
    # Wartość poza zakresem w pliku: kapsel jest ZAWSZE po sanityzacji, więc preset też musi być —
    # inaczej profil, którego nikt nie tknął, zgłaszałby się jako „zmieniony" tylko dlatego, że
    # silnik przyciął mu wartość przy wczytaniu.
    write_preset_raw("Przesadzony", {"app": "ribbitflip", "kind": "mouse-preset", "version": 1,
                                     "name": "Przesadzony",
                                     "config": {"sensX": 99.0, "mode": "bzdura"}})
    names = rf.list_mouse_presets()
    check("wszystkie trzy profile na liście",
          names == sorted(names, key=str.lower) and len(names) == 3, names)
    items = rf.mouse_preset_items()
    by = {it["name"]: it["config"] for it in items}
    check("każdy profil przychodzi z konfiguracją", len(items) == 3 and all(by.values()), len(items))
    check("…przyciętą tak, jak przyciąłby ją silnik",
          abs(by["Przesadzony"]["sensX"] - 2.0) < 1e-9 and by["Przesadzony"]["mode"] == "mouse",
          by["Przesadzony"]["sensX"])
    left = [k for k in rf.MOUSE_PRESET_SKIP if any(k in c for c in by.values())]
    check("…i bez kluczy, które zostają przy kapslu", left == [], left)
    check("…i każdy z polem opisu, choćby pustym",
          all("desc" in it for it in items), [sorted(it.keys()) for it in items][:1])

    # ---------------------------------------------------------------------------
    #  4b. OPIS PROFILU — druga połowa odpowiedzi, której nazwa nie daje
    # ---------------------------------------------------------------------------
    print("\n--- opis profilu myszy --------------------------------------------")
    src3 = FakeDevice()
    src3.mouse.set_config({"sensX": 0.21, "mode": "mouse", "dwellOn": True})
    ok = rf.save_mouse_preset("Precyzja przy głowie", src3.mouse.get_config(),
                              "Wolno i dokładnie. Do celowania w małe przyciski, nie do gry.")
    check("zapis z opisem się udał", ok is True)
    with open(os.path.join(rf.MOUSE_PRESET_DIR, "Precyzja przy głowie.json"), "r",
              encoding="utf-8") as f:
        env = json.load(f)
    check("opis ląduje w kopercie", env.get("desc", "").startswith("Wolno i dokładnie."),
          env.get("desc"))
    check("…obok ustawień, a nie zamiast nich",
          abs(env["config"]["sensX"] - 0.21) < 1e-9, env["config"].get("sensX"))
    check("…i nie ląduje w treści, którą opisuje", "desc" not in env["config"], list(env["config"])[:5])
    # Jedna stała na wszystkie rodzaje presetów — inaczej opis myszy urywałby się w innym miejscu
    # niż opis wyzwalaczy i nikt nie wiedziałby dlaczego.
    rf.save_mouse_preset("Za długi", src3.mouse.get_config(), "y" * 900)
    with open(os.path.join(rf.MOUSE_PRESET_DIR, "Za długi.json"), "r", encoding="utf-8") as f:
        check("opis idzie przez tę samą sanityzację, co przy wyzwalaczach",
              len(json.load(f).get("desc")) == rf.PROFILE_DESC_MAX)
    rf.delete_mouse_preset("Za długi")
    rf.save_mouse_preset("Bez opisu", src3.mouse.get_config())
    with open(os.path.join(rf.MOUSE_PRESET_DIR, "Bez opisu.json"), "r", encoding="utf-8") as f:
        check("zapis bez opisu daje pusty opis, nie brak klucza", json.load(f).get("desc") == "")
    # STARY PLIK: koperta sprzed opisów i goła konfiguracja sprzed kopert. Oba muszą wczytać się
    # jako „autor nic nie napisał", a nie wywrócić listy albo wypisać „undefined" na kaflu.
    write_preset_raw("Sprzed opisow", {"app": "ribbitflip", "kind": "mouse-preset", "version": 1,
                                       "name": "Sprzed opisow", "config": {"sensX": 0.3}})
    write_preset_raw("Prastary", {"sensX": 0.4, "mode": "stick"})
    write_preset_raw("Zepsuty opis", {"app": "ribbitflip", "kind": "mouse-preset", "version": 1,
                                      "name": "Zepsuty opis", "desc": 17, "config": {"sensX": 0.5}})
    old = {it["name"]: it for it in rf.mouse_preset_items()}
    check("koperta bez klucza to brak opisu", old["Sprzed opisow"]["desc"] == "", old["Sprzed opisow"])
    check("goła konfiguracja sprzed kopert też się wczytuje",
          old["Prastary"]["desc"] == "" and old["Prastary"]["config"]["mode"] == "stick",
          old.get("Prastary"))
    check("zepsuty opis w pliku to brak opisu, nie wyjątek",
          old["Zepsuty opis"]["desc"] == "", repr(old["Zepsuty opis"]["desc"]))
    for nm in ("Sprzed opisow", "Prastary", "Zepsuty opis"):
        rf.delete_mouse_preset(nm)

    # DWIE DROGI ZAPISU, KTÓRE NIE MOGĄ SOBIE SZKODZIĆ. To jest kontrakt, którego pilnuje
    # `overwrite` w rf-49c: zapis ustawień MUSI oddać opis, który preset już ma.
    have = [it for it in rf.mouse_preset_items() if it["name"] == "Precyzja przy głowie"][0]
    rf.save_mouse_preset("Precyzja przy głowie", have["config"], have["desc"])
    with open(os.path.join(rf.MOUSE_PRESET_DIR, "Precyzja przy głowie.json"), "r",
              encoding="utf-8") as f:
        check("zapis ustawień z oddanym opisem zachowuje jedno i drugie",
              json.load(f).get("desc").startswith("Wolno i dokładnie."))
    rf.save_mouse_preset("Precyzja przy głowie", have["config"])
    with open(os.path.join(rf.MOUSE_PRESET_DIR, "Precyzja przy głowie.json"), "r",
              encoding="utf-8") as f:
        check("…a ten sam zapis BEZ opisu go kasuje (dlatego overwrite go oddaje)",
              json.load(f).get("desc") == "")
    rf.save_mouse_preset("Precyzja przy głowie", have["config"], have["desc"])

    print("\n--- wiersz Biblioteki mówi to samo, co kafel ----------------------")
    row = rf._library_entry("mouse", rf.MOUSE_PRESET_DIR, "Precyzja przy głowie")
    check("wiersz niesie opis", row.get("desc", "").startswith("Wolno i dokładnie."), row.get("desc"))
    check("…i nadal to, dokąd idzie ruch", row.get("mode") == "mouse" and row.get("dwell") is True, row)
    check("profil bez opisu ma pole, tylko puste",
          rf._library_entry("mouse", rf.MOUSE_PRESET_DIR, "Bez opisu").get("desc") == "",
          rf._library_entry("mouse", rf.MOUSE_PRESET_DIR, "Bez opisu"))

    print("\n--- kasowanie profilu NIE odbiera kapslowi nazwy ------------------")
    check("profil skasowany", rf.delete_mouse_preset("Przesadzony") is True)
    check("…i naprawdę zniknął z listy", "Przesadzony" not in rf.list_mouse_presets(),
          rf.list_mouse_presets())
    check("kapsel nadal nosi swoją nazwę",
          tgt.mouse.get_config()["configName"] == "Podstępny", tgt.mouse.get_config()["configName"])

    # ---------------------------------------------------------------------------
    #  5. Biblioteka
    # ---------------------------------------------------------------------------
    print("\n--- Biblioteka zna rodzaj mouse -----------------------------------")
    idx = rf.library_index()
    check("szuflada profili myszy istnieje", "mouse" in idx, list(idx.keys()))
    row = [it for it in idx.get("mouse", []) if it["name"] == "Precyzja przy głowie"]
    check("profil jest wierszem listy", len(row) == 1, idx.get("mouse"))
    if row:
        it = row[0]
        check("wiersz mówi, dokąd idzie ruch i czy kursor klika sam",
              it.get("mode") == "mouse" and it.get("dwell") is True, it)
        check("…i którą wersją zapisany", it.get("appVersion") == rf.APP_VERSION, it.get("appVersion"))
    item = rf.library_item("mouse", "Precyzja przy głowie")
    check("pobranie oddaje CAŁĄ kopertę",
          isinstance(item, dict) and item.get("kind") == "mouse-preset"
          and isinstance(item.get("config"), dict), item)
    check("nieznana nazwa to brak pliku, nie wyjątek",
          rf.library_item("mouse", "Nie ma takiego") is None)

    # ---------------------------------------------------------------------------
    #  6. nazwa jedzie w zestawie
    # ---------------------------------------------------------------------------
    print("\n--- zestaw (build_setup / apply_setup) ----------------------------")
    s = FakeDevice()
    s.mouse.set_config({"configName": "FPS szybki", "sensX": 0.33, "enabled": True})
    cfg = rf.build_setup(s)
    check("zestaw niesie nazwę profilu myszy",
          cfg["mouse"].get("configName") == "FPS szybki", cfg["mouse"].get("configName"))
    # Przełącznik zostaje w pliku (opisuje, czego zestaw używa), ale NIE jest wykonywany —
    # i wycinane jest DOKŁADNIE to jedno pole, nie nazwa razem z nim.
    without = rf._without_switches("mouse", cfg["mouse"])
    check("_without_switches wycina TYLKO przełącznik",
          "enabled" not in without and without.get("configName") == "FPS szybki"
          and len(without) == len(cfg["mouse"]) - 1, len(cfg["mouse"]) - len(without))

    t = FakeDevice()
    t.mouse.set_config({"configName": "Stara nazwa", "enabled": False, "padShare": "p5"})
    res = rf.apply_setup(t, cfg, t.bus)
    check("zestaw się nałożył", "mouse" in res["applied"], res)
    check("kapsel-cel nosi nazwę z zestawu",
          t.mouse.get_config()["configName"] == "FPS szybki", t.mouse.get_config()["configName"])
    check("…i jego przełącznik nadal jest jego", t.mouse.get_config()["enabled"] is False,
          t.mouse.get_config()["enabled"])
    check("…a zestaw NIÓSŁ pada, więc go przenosi (inaczej niż preset)",
          t.mouse.get_config()["padShare"] == cfg["mouse"]["padShare"], t.mouse.get_config()["padShare"])

    # Zestaw sprzed nazw nie ma prawa wyczyścić podpisu, którego nie zna.
    old_style = dict(cfg)
    old_style["mouse"] = {k: v for k, v in cfg["mouse"].items() if k != "configName"}
    t2 = FakeDevice()
    t2.mouse.set_config({"configName": "Moje własne"})
    rf.apply_setup(t2, old_style, t2.bus)
    check("stary zestaw zostawia nazwę kapsla w spokoju",
          t2.mouse.get_config()["configName"] == "Moje własne", t2.mouse.get_config()["configName"])

    # ---------------------------------------------------------------------------
    #  7. druga połowa granicy — ta, którą liczy PANEL
    # ---------------------------------------------------------------------------
    # „Zmienione" wylicza przeglądarka, więc najkruchsze założenie tej funkcji nie mieszka
    # w Pythonie: odcisk musi liczyć DOKŁADNIE te pola, które profil niesie. Jedno za dużo i każdy
    # kapsel jest „zmieniony" od chwili wczytania. Harmess w Node bierze obie strony prosto stąd
    # (silnik) i puszcza je przez PRAWDZIWY kod panelu — bez przeglądarki i bez serwera.
    print("\n--- panel: odcisk liczy dokładnie to, co profil niesie ------------")
    src2 = FakeDevice()
    src2.mouse.set_config({"sensX": 0.11, "mouseExpo": 1.7, "dwellOn": True, "mode": "stick",
                           "configName": "FPS szybki", "enabled": True, "padShare": "p3",
                           "mouseArea": "monitor", "mouseMonitor": "\\\\.\\DISPLAY2",
                           "mouseAreaWork": True, "mouseAreaPad": 8.0,
                           "mouseRectX": 1.0, "mouseRectY": 2.0,
                           "mouseRectW": 1280.0, "mouseRectH": 720.0})
    live = src2.mouse.get_config()
    payload = json.dumps({"cfg": live, "preset": rf.mouse_preset_config(live)}, ensure_ascii=False)
    harness = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mouse_config_harness.mjs")
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

    # ---------------------------------------------------------------------------
    #  8. HUB KONFIGURACJI — kafle z biblioteki, chipy kapsli, zdanie o zapisie
    # ---------------------------------------------------------------------------
    # Cienki pasek („Konfiguracja: X · zmienione") zniknął z karty Mysz 2026-08-28 i zastąpił go
    # hub (rf-49i). To NIE jest zmiana kosmetyczna: pasek nie miał gdzie pokazać opisu, nie mówił,
    # które kapsle noszą to samo, i nie tłumaczył, że zmiany działają NA KAPSLU od razu, a
    # w BIBLIOTECE dopiero po „Zapisz zmiany". Harness montuje hub przez PRAWDZIWE
    # `initMouseCfgHub` w atrapie karty i sprawdza to, co zbudował z węzłów — bo montowanie to nie
    # działanie (pułapka „montowanie to nie działanie” w .github/CONTRIBUTING.md).
    print("\n--- panel: hub składa bibliotekę profili ruchu --------------------")
    # Dwie konfiguracje: jedna Z OPISEM, jedna BEZ — dwa kafle, które muszą wyglądać inaczej.
    for nm in list(rf.list_mouse_presets()):
        rf.delete_mouse_preset(nm)
    a = FakeDevice()
    a.mouse.set_config({"sensX": 0.11, "mode": "mouse", "dwellOn": True})
    rf.save_mouse_preset("Precyzja przy głowie", a.mouse.get_config(),
                         "Wolno i dokładnie. Do celowania w małe przyciski, nie do gry.")
    b = FakeDevice()
    b.mouse.set_config({"sensX": 0.6, "mode": "stick", "dwellOn": False})
    rf.save_mouse_preset("FPS szybki", b.mouse.get_config())
    payload = json.dumps({"module": "mouse", "items": rf.mouse_preset_items()}, ensure_ascii=False)
    harness = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cfghub_modules_harness.mjs")
    try:
        p = subprocess.run(["node", harness, payload], capture_output=True, text=True,
                           encoding="utf-8", timeout=60)
        out = json.loads((p.stdout or "").strip().splitlines()[-1]) if p.returncode == 0 else None
    except (OSError, ValueError, IndexError, subprocess.SubprocessError) as e:
        p, out = None, None
        print("POMINIETO  hub (Node): %s" % e)
    if out is None and p is not None:
        check("harness huba wystartował", False, (p.stderr or p.stdout or "")[-400:])
    for nm, ok, detail in (out or {}).get("checks", []):
        check(nm, ok, detail)

finally:
    shutil.rmtree(_TMP, ignore_errors=True)

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
