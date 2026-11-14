# Contract test: THE CAPSULE CARRIES A NAMED SET OF MIDI/OSC MAPPINGS.
# Run: py tests/test_midi_config.py
#
# Mappings were the third module with no presets at all: one list per capsule, up to 64 entries,
# and no way to keep „TouchOSC scena A" next to „Serwo ramienia" — let alone to answer „is this
# still the set that played yesterday". The name (`configName`, a key of the MIDI config) is what
# makes that answerable; „zmienione" is then COMPUTED in the panel by comparing fingerprints and
# is deliberately stored nowhere.
#
# What is easy to break here, and silent when it breaks:
#
# 1. THE BORDER OF THE PRESET (MIDI_PRESET_SKIP). A preset carries the MAPPINGS and the SCALE.
#    Both group switches, the MIDI channel and the OSC prefix stay with the capsule: the first two
#    because a file may never arm an output, the other two because they are what tells two capsules
#    apart on one receiver. Get that wrong and loading a preset either starts sending, or makes two
#    capsules play into the same place and nobody can tell why.
#
# 2. THE DEFENCE HAS TO WORK ON READ, NOT ONLY ON WRITE. A file with those keys hand-added (or
#    written by a future build) must be just as harmless as one this build saved.
#
# 3. SETTING THE NAME MUST NOT TOUCH A SINGLE MAPPING — and, specific to this module, it must not
#    wake the `enabled` -> `oscEnabled` MIGRATION either. That migration reads a lone `enabled` as
#    "an old single-switch config" and mirrors it onto OSC; a body carrying only a caption has no
#    business deciding whether OSC is on.
#
# 4. THE NAME TRAVELS IN A SETUP — it describes the contents, like the group flags do, and unlike
#    them it is safe to obey, because a name cannot make anything start sending.
#
# 5. THE PRESET ALSO CARRIES A DESCRIPTION (`desc`, since 2026-08-28). „TouchOSC scena A" says
#    which one it is; it does not say what it plays. Three things break silently here: an OLD FILE
#    has to load as "the author wrote nothing"; saving the mappings must not erase the sentence
#    (both go down one road, POST /midi-preset/save, so the caller has to hand the existing
#    description back); and editing the sentence must not rewrite sixty-four mappings with whatever
#    is on the capsule at that moment. One limit for all three preset kinds — PROFILE_DESC_MAX.
#
# Nothing here touches the owner's Settings/ or Library/: both are pointed at a temp directory
# first, and no HTTP server is ever started — the endpoints' logic is tested through the very
# functions the handlers call (apply_midi_preset, save_midi_preset, midi_preset_items).
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
    """Enough of a Device for apply_midi_preset / build_setup / apply_setup, with the REAL engines."""

    def __init__(self, dev_id="d0", slot=0):
        self.id = dev_id
        bus = FakeBus()
        self.bus = bus
        self.dm = FakeDm()
        self.trig = rf.TriggerEngine(bus, emitter=None, armed=True)
        self.mouse = rf.AirMouse(bus, emitter=None, trig=self.trig, gamepad=None)
        self.midimap = rf.MidiMapper(bus, midi=None, osc=None, trig=self.trig, slot=slot)
        # SKANER wszedł do zestawu 2026-09-13 (`SETUP_KEYS` + `build_setup`), więc atrapa
        # kapsla bez niego przestała wystarczać: `build_setup` sięga po `d.scan.get_config()`.
        self.scan = rf.ScanModule(bus, dev_id)
        self.pose = rf.PoseFilter()
        self.source = FakeSource()
        self.cal = None

    def apply_cal(self, cal):
        self.cal = cal


# Dwa mapowania o różnych celach — bo preset jest JEDEN na oba wyjścia i zestaw mieszany
# (kilka CC plus kilka adresów OSC) jest tu najzwyklejszym przypadkiem.
MAPS = [
    {"id": "m1", "name": "Filtr", "srcKind": "filter", "metric": "tilt", "dest": "cc",
     "cc": 74, "inLo": 0, "inHi": 90, "rateMs": 20},
    {"id": "m2", "name": "Kolor", "srcKind": "filter", "metric": "roll", "dest": "osc",
     "addr": "/kolor", "oscProfile": "unit", "mode": "threshold", "threshold": 30.0,
     "oscEdge": "toggle", "safeOnDisarm": 0.0, "oscGroup": "scena", "oscGroupIdx": 3},
]

# A sandbox for Settings/ and Library/, so nothing below can reach the owner's live configuration.
_TMP = tempfile.mkdtemp(prefix="rf-midicfg-")
rf.SETTINGS_DIR = os.path.join(_TMP, "Settings")
rf.MIDI_PRESET_DIR = os.path.join(_TMP, "Library", "MidiPresets")
rf.MOUSE_PRESET_DIR = os.path.join(_TMP, "Library", "MousePresets")
rf.PROFILE_DIR = os.path.join(_TMP, "Library", "Profiles")
rf.POSE_PROFILE_DIR = os.path.join(_TMP, "Library", "AxisPresets")
rf.SETUPS_DIR = os.path.join(_TMP, "Library", "Setups")
# …and the library index, which was built from those names at import time.
rf._LIBRARY_KINDS = {"setup": rf.SETUPS_DIR, "profile": rf.PROFILE_DIR,
                     "pose": rf.POSE_PROFILE_DIR, "mouse": rf.MOUSE_PRESET_DIR,
                     "midi": rf.MIDI_PRESET_DIR}
for _d in (rf.SETTINGS_DIR, rf.MIDI_PRESET_DIR, rf.MOUSE_PRESET_DIR, rf.PROFILE_DIR,
           rf.POSE_PROFILE_DIR, rf.SETUPS_DIR):
    os.makedirs(_d, exist_ok=True)
MIDI_PATH = rf._dev_path("d0", "midi")


def write_preset_raw(name, obj):
    """A preset file exactly as written, bypassing save_midi_preset — that is how a file from a
    newer build, or one edited by hand, arrives."""
    with open(os.path.join(rf.MIDI_PRESET_DIR, name + ".json"), "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False)


def read_midi_file():
    with open(MIDI_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


try:
    # ---------------------------------------------------------------------------
    #  1. the name itself
    # ---------------------------------------------------------------------------
    print("--- nazwa zestawu mapowań (sanityzacja przez silnik) --------------")
    d = FakeDevice()
    d.midimap.set_config({"configName": "  TouchOSC \n  scena   A "})
    check("biały znak zwinięty, spacje po bokach obcięte",
          d.midimap.get_config()["configName"] == "TouchOSC scena A",
          repr(d.midimap.get_config()["configName"]))
    d.midimap.set_config({"configName": "x" * 80})
    check("obcięta do 40 znaków", len(d.midimap.get_config()["configName"]) == 40,
          len(d.midimap.get_config()["configName"]))
    # Liczba albo słownik w tym polu to zepsuty plik, a nie nazwa: lepiej „bez nazwy" niż „123".
    d.midimap.set_config({"configName": 123})
    check("liczba to nie nazwa", d.midimap.get_config()["configName"] == "",
          repr(d.midimap.get_config()["configName"]))
    d.midimap.set_config({"configName": {"a": 1}})
    check("słownik to nie nazwa", d.midimap.get_config()["configName"] == "",
          repr(d.midimap.get_config()["configName"]))
    check("świeży silnik nic nie nosi",
          rf.MidiMapper(FakeBus(), midi=None, osc=None, trig=None, slot=0)
            .get_config()["configName"] == "")

    # ---------------------------------------------------------------------------
    #  2. SAMA nazwa vs CAŁA konfiguracja (to, co robią oba warianty POST /midi)
    # ---------------------------------------------------------------------------
    print("\n--- POST /midi: nazwa i mapowania nie depczą sobie po piętach -----")
    d = FakeDevice()
    d.midimap.set_config({"mappings": MAPS, "scale": "blues", "scaleRoot": 5,
                          "midiChannel": 9, "oscPrefix": "/moje"})
    d.midimap.set_config({"configName": "TouchOSC scena A"})     # pasek wysyła TYLKO nazwę
    cfg = d.midimap.get_config()
    check("nadanie nazwy nie rusza ani jednego mapowania",
          len(cfg["mappings"]) == 2 and cfg["mappings"][0]["cc"] == 74
          and cfg["mappings"][1]["addr"] == "/kolor", cfg["mappings"])
    check("…ani skali, kanału i prefiksu",
          cfg["scale"] == "blues" and cfg["scaleRoot"] == 5 and cfg["midiChannel"] == 9
          and cfg["oscPrefix"] == "/moje", (cfg["scale"], cfg["midiChannel"], cfg["oscPrefix"]))
    check("…i nazwa jest na kapslu", cfg["configName"] == "TouchOSC scena A", cfg["configName"])

    # ⚠️ MIGRACJA `enabled` -> `oscEnabled`. Silnik czyta samotne `enabled` jako „stary config
    # sprzed rozdzielenia przełączników" i lustruje je na OSC. Body z SAMĄ nazwą nie niesie
    # `enabled`, więc nie ma prawa tej migracji obudzić — inaczej zdjęcie podpisu włączałoby
    # (albo wyłączało) drugie wyjście.
    print("\n--- POST samej nazwy NIE budzi migracji enabled -> oscEnabled -----")
    dm2 = FakeDevice()
    dm2.midimap.set_config({"enabled": True, "oscEnabled": False})
    check("stan wyjściowy: MIDI włączone, OSC nie",
          dm2.midimap.get_config()["enabled"] is True
          and dm2.midimap.get_config()["oscEnabled"] is False)
    dm2.midimap.set_config({"configName": "Sama nazwa"})
    check("po nadaniu nazwy OSC NADAL wyłączone",
          dm2.midimap.get_config()["oscEnabled"] is False,
          dm2.midimap.get_config()["oscEnabled"])
    check("…a MIDI nadal włączone", dm2.midimap.get_config()["enabled"] is True)
    # …a sama migracja ma dalej działać dla plików, dla których powstała.
    dm3 = FakeDevice()
    dm3.midimap.set_config({"enabled": True})
    check("stary plik z jednym przełącznikiem nadal się migruje",
          dm3.midimap.get_config()["oscEnabled"] is True)

    # Zapis mapowań BEZ zdania o nazwie (starszy build, zestaw sprzed nazw) jej nie kasuje —
    # set_config scala, dotyka wyłącznie kluczy, które przyszły.
    d.midimap.set_config({"mappings": MAPS[:1]})
    check("zapis mapowań bez zdania o nazwie jej nie kasuje",
          d.midimap.get_config()["configName"] == "TouchOSC scena A",
          d.midimap.get_config()["configName"])
    d.midimap.set_config({"configName": ""})
    check("pusta nazwa naprawdę zdejmuje podpis",
          d.midimap.get_config()["configName"] == "", d.midimap.get_config()["configName"])

    print("\n--- nazwa przeżywa zapis i odczyt pliku kapsla --------------------")
    d.midimap.set_config({"mappings": MAPS, "configName": "TouchOSC scena A"})
    rf.save_midi(d.midimap.get_config(), "d0")
    check("nazwa ląduje w pliku MIDI",
          read_midi_file().get("configName") == "TouchOSC scena A",
          read_midi_file().get("configName"))
    d2 = FakeDevice()
    d2.midimap.set_config(rf.load_midi("d0"))
    check("…i wraca przy starcie kapsla",
          d2.midimap.get_config()["configName"] == "TouchOSC scena A",
          d2.midimap.get_config()["configName"])

    # ---------------------------------------------------------------------------
    #  3. granica presetu — co plik NIESIE, a co zostaje przy kapslu
    # ---------------------------------------------------------------------------
    print("\n--- zapis presetu: przełączniki, kanał i prefiks NIE wchodzą -----")
    src = FakeDevice()
    src.midimap.set_config({"enabled": True, "oscEnabled": True, "midiChannel": 9,
                            "oscPrefix": "/moje", "scale": "blues", "scaleRoot": 5,
                            "configName": "TouchOSC scena A", "mappings": MAPS})
    check("preset zapisany",
          rf.save_midi_preset("TouchOSC scena A", src.midimap.get_config()) is True)
    with open(os.path.join(rf.MIDI_PRESET_DIR, "TouchOSC scena A.json"), "r", encoding="utf-8") as f:
        env = json.load(f)
    check("koperta mówi, co to za plik",
          env.get("app") == "ribbitflip" and env.get("kind") == "midi-preset"
          and env.get("version") == rf.MIDI_FORMAT and env.get("name") == "TouchOSC scena A", env)
    left = [k for k in rf.MIDI_PRESET_SKIP if k in (env.get("config") or {})]
    check("w pliku NIE MA ani jednego klucza z MIDI_PRESET_SKIP", left == [], left)
    check("…a treść jest w całości",
          len(env["config"]["mappings"]) == 2 and env["config"]["scale"] == "blues"
          and env["config"]["scaleRoot"] == 5, env["config"].get("scale"))
    check("…łącznie z polami, których ta wersja nie czyta (round-trip)",
          env["config"]["mappings"][1]["oscGroup"] == "scena"
          and env["config"]["mappings"][1]["oscGroupIdx"] == 3, env["config"]["mappings"][1])
    check("nazwa stoi na WIERZCHU pliku, nie w treści",
          env.get("name") == "TouchOSC scena A" and "configName" not in env["config"],
          env.get("name"))
    check("preset niesie DOKŁADNIE trzy rzeczy",
          sorted(env["config"].keys()) == ["mappings", "scale", "scaleRoot"],
          sorted(env["config"].keys()))

    print("\n--- wczytanie presetu: kapsel zostaje przy swoim stanowisku ------")
    # Slot 1 -> domyślnie kanał 1 i prefiks /ribbitflip/dev2, czyli dokładnie to, co odróżnia
    # drugi kapsel od pierwszego na jednym odbiorniku. Preset nie ma prawa tego zetrzeć.
    dst = FakeDevice(slot=1)
    dst.midimap.set_config({"enabled": False, "oscEnabled": True, "configName": "Coś starego",
                            "mappings": [{"id": "stare", "dest": "cc", "cc": 1}]})
    before_ch, before_pfx = (dst.midimap.get_config()["midiChannel"],
                             dst.midimap.get_config()["oscPrefix"])
    got = rf.apply_midi_preset(dst, "TouchOSC scena A")
    check("preset się wczytał", isinstance(got, dict), type(got))
    check("mapowania podmienione w całości",
          len(got["mappings"]) == 2 and got["mappings"][0]["cc"] == 74, got["mappings"])
    check("…i skala razem z nimi", got["scale"] == "blues" and got["scaleRoot"] == 5,
          (got["scale"], got["scaleRoot"]))
    check("kapsel od razu nosi nazwę presetu", got["configName"] == "TouchOSC scena A",
          got["configName"])
    # Wczytanie zmienia to, CO kapsel gra — nigdy tego, czy mu WOLNO (jak apply_setup/apply_profile).
    check("przełącznik MIDI nietknięty", got["enabled"] is False, got["enabled"])
    check("przełącznik OSC nietknięty", got["oscEnabled"] is True, got["oscEnabled"])
    check("kanał MIDI zostaje ten kapsla", got["midiChannel"] == before_ch == 1, got["midiChannel"])
    check("prefiks OSC zostaje ten kapsla",
          got["oscPrefix"] == before_pfx == "/ribbitflip/dev2", got["oscPrefix"])
    check("…i jest to zapisane na dysku",
          rf.load_midi("d0").get("configName") == "TouchOSC scena A", rf.load_midi("d0").get("configName"))
    check("nieistniejący preset to brak odpowiedzi, nie pusta konfiguracja",
          rf.apply_midi_preset(dst, "Nie ma takiego") is None)
    check("…i nazwa po nieudanym wczytaniu zostaje",
          dst.midimap.get_config()["configName"] == "TouchOSC scena A")

    print("\n--- obrona przy ODCZYCIE: spreparowany plik nic nie przemyci -----")
    # Plik z ręki (albo z nowszego builda) z całą paczką kluczy, których preset nie ma prawa nieść.
    write_preset_raw("Podstępny", {"app": "ribbitflip", "kind": "midi-preset", "version": 1,
                                   "name": "Podstępny",
                                   "config": {"enabled": True, "oscEnabled": True,
                                              "midiChannel": 15, "oscPrefix": "/cudzy",
                                              "configName": "Nie ta nazwa",
                                              "scale": "dorian",
                                              "mappings": [{"id": "z-pliku", "dest": "cc", "cc": 3}]}})
    tgt = FakeDevice()
    tgt.midimap.set_config({"enabled": False, "oscEnabled": False, "midiChannel": 2,
                            "oscPrefix": "/moje"})
    out = rf.apply_midi_preset(tgt, "Podstępny")
    check("treść z pliku weszła",
          len(out["mappings"]) == 1 and out["mappings"][0]["cc"] == 3 and out["scale"] == "dorian",
          out["mappings"])
    check("przełącznik MIDI z pliku NIE uzbroił wyjścia", out["enabled"] is False, out["enabled"])
    check("przełącznik OSC z pliku NIE uzbroił wyjścia", out["oscEnabled"] is False, out["oscEnabled"])
    check("kanał z pliku nie przestawił kapsla", out["midiChannel"] == 2, out["midiChannel"])
    check("prefiks z pliku nie przestawił kapsla", out["oscPrefix"] == "/moje", out["oscPrefix"])
    check("nazwa jest NAZWĄ PLIKU, nie tym, co ktoś wpisał w treść",
          out["configName"] == "Podstępny", out["configName"])

    # ---------------------------------------------------------------------------
    #  4. lista dla paska (GET /midi-presets)
    # ---------------------------------------------------------------------------
    print("\n--- GET /midi-presets niesie TREŚĆ presetów -----------------------")
    # Wartość poza zakresem w pliku: kapsel jest ZAWSZE po sanityzacji, więc preset też musi być —
    # inaczej preset, którego nikt nie tknął, zgłaszałby się jako „zmieniony" tylko dlatego, że
    # silnik przyciął mu wartość przy wczytaniu.
    write_preset_raw("Przesadzony", {"app": "ribbitflip", "kind": "midi-preset", "version": 1,
                                     "name": "Przesadzony",
                                     "config": {"scale": "bzdura",
                                                "mappings": [{"id": "x", "dest": "cc", "cc": 999,
                                                              "rateMs": 99999}]}})
    names = rf.list_midi_presets()
    check("wszystkie trzy presety na liście",
          names == sorted(names, key=str.lower) and len(names) == 3, names)
    items = rf.midi_preset_items()
    by = {it["name"]: it["config"] for it in items}
    check("każdy preset przychodzi z konfiguracją", len(items) == 3 and all(by.values()), len(items))
    check("…przyciętą tak, jak przyciąłby ją silnik",
          by["Przesadzony"]["mappings"][0]["cc"] == 127
          and by["Przesadzony"]["mappings"][0]["rateMs"] == 1000
          and by["Przesadzony"]["scale"] == "chromatic",
          by["Przesadzony"]["mappings"][0])
    left = [k for k in rf.MIDI_PRESET_SKIP if any(k in c for c in by.values())]
    check("…i bez kluczy, które zostają przy kapslu", left == [], left)
    check("…i każdy z polem opisu, choćby pustym",
          all("desc" in it for it in items), [sorted(it.keys()) for it in items][:1])

    # ---------------------------------------------------------------------------
    #  4b. OPIS PRESETU — druga połowa odpowiedzi, której nazwa nie daje
    # ---------------------------------------------------------------------------
    print("\n--- opis presetu MIDI/OSC ----------------------------------------")
    src3 = FakeDevice()
    src3.midimap.set_config({"mappings": MAPS, "scale": "blues", "scaleRoot": 5})
    ok = rf.save_midi_preset("TouchOSC scena A", src3.midimap.get_config(),
                             "Filtr na CC 74, kolor na /kolor. Scena A z tabletu, bez DAW-a.")
    check("zapis z opisem się udał", ok is True)
    with open(os.path.join(rf.MIDI_PRESET_DIR, "TouchOSC scena A.json"), "r", encoding="utf-8") as f:
        env = json.load(f)
    check("opis ląduje w kopercie", env.get("desc", "").startswith("Filtr na CC 74"), env.get("desc"))
    check("…obok mapowań, a nie zamiast nich", len(env["config"]["mappings"]) == 2,
          len(env["config"].get("mappings") or []))
    check("…i nie ląduje w treści, którą opisuje", "desc" not in env["config"], list(env["config"])[:5])
    # Jedna stała na wszystkie rodzaje presetów — inaczej opis zestawu urywałby się w innym miejscu
    # niż opis wyzwalaczy i nikt nie wiedziałby dlaczego.
    rf.save_midi_preset("Za długi", src3.midimap.get_config(), "y" * 900)
    with open(os.path.join(rf.MIDI_PRESET_DIR, "Za długi.json"), "r", encoding="utf-8") as f:
        check("opis idzie przez tę samą sanityzację, co przy wyzwalaczach",
              len(json.load(f).get("desc")) == rf.PROFILE_DESC_MAX)
    rf.delete_midi_preset("Za długi")
    rf.save_midi_preset("Bez opisu", src3.midimap.get_config())
    with open(os.path.join(rf.MIDI_PRESET_DIR, "Bez opisu.json"), "r", encoding="utf-8") as f:
        check("zapis bez opisu daje pusty opis, nie brak klucza", json.load(f).get("desc") == "")
    # STARY PLIK: koperta sprzed opisów i goła konfiguracja sprzed kopert. Oba muszą wczytać się
    # jako „autor nic nie napisał", a nie wywrócić listy albo wypisać „undefined" na kaflu.
    write_preset_raw("Sprzed opisow", {"app": "ribbitflip", "kind": "midi-preset", "version": 1,
                                       "name": "Sprzed opisow", "config": {"mappings": MAPS[:1]}})
    write_preset_raw("Prastary", {"mappings": MAPS[:1], "scale": "blues"})
    write_preset_raw("Zepsuty opis", {"app": "ribbitflip", "kind": "midi-preset", "version": 1,
                                      "name": "Zepsuty opis", "desc": {"a": 1},
                                      "config": {"mappings": MAPS[:1]}})
    old = {it["name"]: it for it in rf.midi_preset_items()}
    check("koperta bez klucza to brak opisu", old["Sprzed opisow"]["desc"] == "", old["Sprzed opisow"])
    check("goła konfiguracja sprzed kopert też się wczytuje",
          old["Prastary"]["desc"] == "" and old["Prastary"]["config"]["scale"] == "blues",
          old.get("Prastary"))
    check("zepsuty opis w pliku to brak opisu, nie wyjątek",
          old["Zepsuty opis"]["desc"] == "", repr(old["Zepsuty opis"]["desc"]))
    for nm in ("Sprzed opisow", "Prastary", "Zepsuty opis"):
        rf.delete_midi_preset(nm)

    # DWIE DROGI ZAPISU, KTÓRE NIE MOGĄ SOBIE SZKODZIĆ. To jest kontrakt, którego pilnuje
    # `overwrite` w rf-49d: zapis mapowań MUSI oddać opis, który preset już ma.
    have = [it for it in rf.midi_preset_items() if it["name"] == "TouchOSC scena A"][0]
    rf.save_midi_preset("TouchOSC scena A", have["config"], have["desc"])
    with open(os.path.join(rf.MIDI_PRESET_DIR, "TouchOSC scena A.json"), "r", encoding="utf-8") as f:
        check("zapis mapowań z oddanym opisem zachowuje jedno i drugie",
              json.load(f).get("desc").startswith("Filtr na CC 74"))
    rf.save_midi_preset("TouchOSC scena A", have["config"])
    with open(os.path.join(rf.MIDI_PRESET_DIR, "TouchOSC scena A.json"), "r", encoding="utf-8") as f:
        check("…a ten sam zapis BEZ opisu go kasuje (dlatego overwrite go oddaje)",
              json.load(f).get("desc") == "")
    rf.save_midi_preset("TouchOSC scena A", have["config"], have["desc"])

    print("\n--- wiersz Biblioteki mówi to samo, co kafel ----------------------")
    row0 = rf._library_entry("midi", rf.MIDI_PRESET_DIR, "TouchOSC scena A")
    check("wiersz niesie opis", row0.get("desc", "").startswith("Filtr na CC 74"), row0.get("desc"))
    check("…i nadal rozbicie na wyjścia",
          row0.get("maps") == 2 and row0.get("midi") == 1 and row0.get("osc") == 1, row0)
    check("preset bez opisu ma pole, tylko puste",
          rf._library_entry("midi", rf.MIDI_PRESET_DIR, "Bez opisu").get("desc") == "",
          rf._library_entry("midi", rf.MIDI_PRESET_DIR, "Bez opisu"))
    rf.delete_midi_preset("Bez opisu")

    print("\n--- kasowanie presetu NIE odbiera kapslowi nazwy ------------------")
    check("preset skasowany", rf.delete_midi_preset("Przesadzony") is True)
    check("…i naprawdę zniknął z listy", "Przesadzony" not in rf.list_midi_presets(),
          rf.list_midi_presets())
    check("kapsel nadal nosi swoją nazwę",
          tgt.midimap.get_config()["configName"] == "Podstępny",
          tgt.midimap.get_config()["configName"])

    # ---------------------------------------------------------------------------
    #  5. Biblioteka
    # ---------------------------------------------------------------------------
    print("\n--- Biblioteka zna rodzaj midi ------------------------------------")
    idx = rf.library_index()
    check("szuflada presetów MIDI/OSC istnieje", "midi" in idx, list(idx.keys()))
    row = [it for it in idx.get("midi", []) if it["name"] == "TouchOSC scena A"]
    check("preset jest wierszem listy", len(row) == 1, idx.get("midi"))
    if row:
        it = row[0]
        check("wiersz mówi, ile mapowań i jak dzielą się na wyjścia",
              it.get("maps") == 2 and it.get("midi") == 1 and it.get("osc") == 1, it)
        check("…i jaka skala", it.get("scale") == "blues", it.get("scale"))
        check("…i którą wersją zapisany", it.get("appVersion") == rf.APP_VERSION,
              it.get("appVersion"))
    item = rf.library_item("midi", "TouchOSC scena A")
    check("pobranie oddaje CAŁĄ kopertę",
          isinstance(item, dict) and item.get("kind") == "midi-preset"
          and isinstance(item.get("config"), dict), item)
    check("nieznana nazwa to brak pliku, nie wyjątek",
          rf.library_item("midi", "Nie ma takiego") is None)

    # ---------------------------------------------------------------------------
    #  6. nazwa jedzie w zestawie
    # ---------------------------------------------------------------------------
    print("\n--- zestaw (build_setup / apply_setup) ----------------------------")
    s = FakeDevice()
    s.midimap.set_config({"configName": "Serwo ramienia", "mappings": MAPS,
                          "enabled": True, "oscEnabled": True, "midiChannel": 4})
    cfg = rf.build_setup(s)
    check("zestaw niesie nazwę zestawu mapowań",
          cfg["midi"].get("configName") == "Serwo ramienia", cfg["midi"].get("configName"))
    # Przełączniki zostają w pliku (opisują, czego zestaw używa), ale NIE są wykonywane —
    # i wycinane są DOKŁADNIE te dwa pola, nie nazwa razem z nimi.
    without = rf._without_switches("midi", cfg["midi"])
    check("_without_switches wycina TYLKO enabled i oscEnabled",
          "enabled" not in without and "oscEnabled" not in without
          and without.get("configName") == "Serwo ramienia"
          and without.get("midiChannel") == 4
          and len(without) == len(cfg["midi"]) - 2, sorted(set(cfg["midi"]) - set(without)))

    t = FakeDevice()
    t.midimap.set_config({"configName": "Stara nazwa", "enabled": False, "oscEnabled": False})
    res = rf.apply_setup(t, cfg, t.bus)
    check("zestaw się nałożył", "midi" in res["applied"], res)
    check("kapsel-cel nosi nazwę z zestawu",
          t.midimap.get_config()["configName"] == "Serwo ramienia",
          t.midimap.get_config()["configName"])
    check("…i jego przełączniki nadal są jego",
          t.midimap.get_config()["enabled"] is False
          and t.midimap.get_config()["oscEnabled"] is False,
          (t.midimap.get_config()["enabled"], t.midimap.get_config()["oscEnabled"]))
    check("…a zestaw NIÓSŁ kanał, więc go przenosi (inaczej niż preset)",
          t.midimap.get_config()["midiChannel"] == 4, t.midimap.get_config()["midiChannel"])

    # Zestaw sprzed nazw nie ma prawa wyczyścić podpisu, którego nie zna.
    old_style = dict(cfg)
    old_style["midi"] = {k: v for k, v in cfg["midi"].items() if k != "configName"}
    t2 = FakeDevice()
    t2.midimap.set_config({"configName": "Moje własne"})
    rf.apply_setup(t2, old_style, t2.bus)
    check("stary zestaw zostawia nazwę kapsla w spokoju",
          t2.midimap.get_config()["configName"] == "Moje własne",
          t2.midimap.get_config()["configName"])

    # ---------------------------------------------------------------------------
    #  7. stary plik kapsla, sprzed nazw
    # ---------------------------------------------------------------------------
    print("\n--- plik sprzed nazw wczytuje się jako „bez nazwy” ----------------")
    rf.save_midi({"enabled": True, "midiChannel": 3, "mappings": MAPS[:1]}, "d0")
    d3 = FakeDevice()
    d3.midimap.set_config(rf.load_midi("d0"))
    check("brak klucza w pliku = pusta nazwa, nie wyjątek",
          d3.midimap.get_config()["configName"] == "", d3.midimap.get_config()["configName"])
    check("…a reszta wczytała się normalnie",
          d3.midimap.get_config()["midiChannel"] == 3
          and len(d3.midimap.get_config()["mappings"]) == 1)

    # ---------------------------------------------------------------------------
    #  8. druga połowa granicy — ta, którą liczy PANEL
    # ---------------------------------------------------------------------------
    # „Zmienione" wylicza przeglądarka, więc najkruchsze założenie tej funkcji nie mieszka
    # w Pythonie: odcisk musi liczyć DOKŁADNIE te pola, które preset niesie. Mapowanie ma ponad
    # sześćdziesiąt pól i lista w panelu jest wypisana z ręki, więc harness dostaje też KLUCZE
    # prosto z `_sanitize_map` i porównuje jedno z drugim.
    print("\n--- panel: odcisk liczy dokładnie to, co preset niesie ------------")
    src2 = FakeDevice()
    src2.midimap.set_config({"mappings": MAPS, "scale": "blues", "scaleRoot": 5,
                             "configName": "TouchOSC scena A", "enabled": True,
                             "oscEnabled": True, "midiChannel": 9, "oscPrefix": "/moje"})
    live = src2.midimap.get_config()
    payload = json.dumps({"cfg": live, "preset": rf.midi_preset_config(live),
                          "mapKeys": sorted(live["mappings"][0].keys()),
                          "skip": list(rf.MIDI_PRESET_SKIP)}, ensure_ascii=False)
    harness = os.path.join(os.path.dirname(os.path.abspath(__file__)), "midi_config_harness.mjs")
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
    #  9. DWA HUBY nad jednym stanem — to, co ten moduł robi inaczej niż pozostałe
    # ---------------------------------------------------------------------------
    # Mapowania mieszkają w DWÓCH zakładkach i mają JEDEN config, więc sekcje konfiguracji są dwie.
    # Do 2026-08-28 były to dwa cienkie paski („Konfiguracja: X · zmienione"); zastąpił je hub
    # (rf-49i) — kafle biblioteki z OPISEM, chipy kapsli z kropką „zmienione" i zdanie, które mówi
    # wprost, że zmiany działają NA KAPSLU od razu, a w BIBLIOTECE dopiero po „Zapisz zmiany".
    # Asercje dawnego midi_bar_harness.mjs są tu przepisane na hub, nie usunięte: dwie instancje,
    # rozłączne id, jeden stan, podpięte handlery, kapsel z nazwą skasowanego presetu.
    # Montowanie to nie działanie (pułapka „montowanie to nie działanie” w .github/CONTRIBUTING.md): namespace potrafi
    # zamontować się w 100% przy martwych przyciskach — więc harness klika w sam mechanizm.
    print("\n--- panel: dwa huby, jeden stan, podpięte handlery ----------------")
    # Dwie konfiguracje: jedna Z OPISEM, jedna BEZ — dwa kafle, które muszą wyglądać inaczej.
    for nm in list(rf.list_midi_presets()):
        rf.delete_midi_preset(nm)
    a = FakeDevice()
    a.midimap.set_config({"mappings": MAPS, "scale": "blues", "scaleRoot": 5})
    rf.save_midi_preset("TouchOSC scena A", a.midimap.get_config(),
                        "Filtr na CC 74, kolor na /kolor. Scena A z tabletu, bez DAW-a.")
    b = FakeDevice()
    b.midimap.set_config({"mappings": MAPS[:1], "scale": "chromatic"})
    rf.save_midi_preset("Serwo ramienia", b.midimap.get_config())
    payload = json.dumps({"module": "midi", "items": rf.midi_preset_items()}, ensure_ascii=False)
    hub_harness = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                               "cfghub_modules_harness.mjs")
    try:
        p = subprocess.run(["node", hub_harness, payload], capture_output=True, text=True,
                           encoding="utf-8", timeout=60)
        out = json.loads((p.stdout or "").strip().splitlines()[-1]) if p.returncode == 0 else None
    except (OSError, ValueError, IndexError, subprocess.SubprocessError) as e:
        p, out = None, None
        print("POMINIETO  huby (Node): %s" % e)
    if out is None and p is not None:
        check("harness hubów wystartował", False, (p.stderr or p.stdout or "")[-400:])
    for nm, ok, detail in (out or {}).get("checks", []):
        check(nm, ok, detail)

    # ============ „NIE MA loopMIDI" TO NIE TO SAMO, CO „NIE JEST WŁĄCZONY" =====================
    # Zgłoszenie (2026-09-10): „w midi mam włączony loopMIDI, ale komunikat mówi, że nie
    # ma midi loop… przeczytałem komunikat i przeinstalowałem niepotrzebnie apkę, a wystarczyło
    # włączyć". Porty loopMIDI istnieją WYŁĄCZNIE, gdy program działa, więc lista portów nie umie
    # odróżnić tych dwóch przypadków — musi o to zapytać system.
    print("\n--- loopMIDI: instalacja i uruchomienie to dwa pytania ---")
    pr = rf.loopmidi_probe()
    check("sonda odpowiada na OBA pytania osobno",
          isinstance(pr, dict) and set(pr) == {"installed", "running"}, pr)
    check("...i każda odpowiedź to tak / nie / nie wiem (None), nigdy zgadywanie",
          all(pr[k] in (True, False, None) for k in ("installed", "running")), pr)
    # Sonda procesów musi UMIEĆ ZNALEŹĆ i UMIEĆ NIE ZNALEŹĆ — inaczej „nie działa" bywa jej własną
    # awarią. Ten interpreter jest uruchomiony, więc jest dowodem pod ręką.
    me = os.path.basename(sys.executable)
    check("proces, który NA PEWNO działa (ten interpreter), jest widziany",
          rf._proc_running(me) is True, (me, rf._proc_running(me)))
    check("...a wymyślona nazwa daje NIE, a nie „nie wiem\"",
          rf._proc_running("nie-ma-takiego-programu-rf.exe") is False)
    check("działający loopMIDI liczy się jako zainstalowany (da się go odpalić z pendrive'a)",
          not (pr["running"] is True) or pr["installed"] is True, pr)

    # PANEL: każdy przypadek ma swoje zdanie i SWOJĄ radę, a instrukcja instalacji pokazuje się
    # tylko tam, gdzie instalowanie jest odpowiedzią.
    _mi_js = open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                               "web", "js", "rf-16-midi.js"), "r", encoding="utf-8").read()
    for _kind in ("winmm", "brak", "niedziala", "bezportu", "nieznane", "niewybrany", "gs", "niegotowy"):
        check("panel ma zdanie dla przypadku „%s\"" % _kind, (_kind + ":{why:") in _mi_js)
    # Liczymy w SAMEJ tablicy przypadków, nie w całym pliku: komentarz nad nią też wymienia
    # `install:true` i test liczyłby wtedy zdanie o kodzie jako kolejny przypadek.
    _mi_warn = _mi_js.split("const MI_WARN={")[1].split("\n};")[0]
    check("instrukcja instalacji tylko przy „brak\" i „nieznane\"",
          _mi_warn.count("install:true") == 2, _mi_warn.count("install:true"))
    check("zdanie o uruchomieniu mówi WPROST, że nie trzeba nic instalować",
          "Nie musisz niczego instalować ponownie." in _mi_js)
    # …i samo się poprawia: kto poszedł włączyć loopMIDI, wraca do panelu, który już o tym wie.
    check("ostrzeżenie dopytuje serwer, póki wisi (miWarnWatch)",
          "function miWarnWatch" in _mi_js and "miWarnWatch(d.kind===" in _mi_js)
    check("...i odświeżenie portów przerysowuje ostrzeżenie",
          "miRenderWarn();" in _mi_js.split("function miLoadPorts")[1][:600])

finally:
    shutil.rmtree(_TMP, ignore_errors=True)

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
