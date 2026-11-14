# Contract test: THE CAPSULE CARRIES A NAMED TRIGGER CONFIGURATION.
# Run: py tests/test_trig_config.py
#
# Until now a capsule's mapping list was nameless. Presets lived in a library next to it, loading
# one made a copy, and there the relationship ended — so three questions asked every day had no
# answer anywhere in the app: what does this capsule have on it, is it still what I saved, which
# capsules have the same thing. The name (`configName`, next to the rules on disk) is what makes
# those answerable; „zmienione" is then COMPUTED in the panel by comparing fingerprints, and is
# deliberately not stored anywhere — a flag in a file drifts from the truth on the first save
# nobody anticipated.
#
# What is easy to break here, and silent when it breaks:
#
# 1. AN OLD FILE. Every rules file written before names existed — a bare list, or an envelope with
#    no `configName` — has to load as "arranged by hand", which is what an empty name means. Get
#    this wrong and the app either crashes on somebody's existing setup or invents a name for it.
#
# 2. SAVING RULES MUST NOT ERASE THE NAME, and setting the name must not touch a single rule.
#    Both directions matter: the emergency stop, the group switch and the layer switch all save
#    rules without having any opinion about the name, and taking a label off („to już nie jest
#    Multimedia") has no business rewriting forty triggers.
#
# 3. LOADING A PRESET NAMES THE CAPSULE, and deleting that preset does NOT un-name it. The panel
#    then says „tej konfiguracji nie ma już na liście", which is the truth; a silently blanked
#    label would look like the capsule had always been nameless.
#
# 4. THE NAME TRAVELS IN A SETUP — it describes the contents, like the group flags do, and unlike
#    them it is safe to obey, because a name cannot make anything start sending. A setup written
#    before names existed must leave the capsule's own name alone rather than blanking it.
#
# Nothing here touches the owner's Settings/ or Library/: both are pointed at a temp directory
# first, and no HTTP server is ever started — the endpoints' payload rules are tested through
# `rules_post_payload`, which is the function the handler itself calls.
import json
import os
import shutil
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
    """Enough of a Device for apply_profile / build_setup / apply_setup, with the REAL engines."""

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


def rule(rid="r1", key="right"):
    return {"id": rid, "label": "Test", "source": {"kind": "axis", "channel": 0},
            "cmp": ">", "threshold": 5000, "keySpec": key}


# A sandbox for Settings/ and Library/, so nothing below can reach the owner's live configuration.
_TMP = tempfile.mkdtemp(prefix="rf-trigcfg-")
rf.SETTINGS_DIR = os.path.join(_TMP, "Settings")
rf.PROFILE_DIR = os.path.join(_TMP, "Library", "Profiles")
os.makedirs(rf.SETTINGS_DIR, exist_ok=True)
os.makedirs(rf.PROFILE_DIR, exist_ok=True)
RULES_PATH = rf._dev_path("d0", "rules")


def write_raw(obj):
    with open(RULES_PATH, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False)


def read_raw():
    with open(RULES_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


try:
    # ---------------------------------------------------------------------------
    #  1. the name itself
    # ---------------------------------------------------------------------------
    print("--- nazwa konfiguracji (sanityzacja) ------------------------------")
    N = rf._rules_config_name

    check("zwykła nazwa przechodzi", N("Elden Ring") == "Elden Ring", N("Elden Ring"))
    check("spacje po bokach obcięte", N("  Multimedia  ") == "Multimedia", N("  Multimedia  "))
    # Nazwa jest PODPISEM na pasku — imię z nowej linii rozbiłoby wiersz, na którym stoi.
    check("biały znak zwinięty do jednej spacji",
          N("Gry\n  i  \tfilmy") == "Gry i filmy", N("Gry\n  i  \tfilmy"))
    check("obcięta do 40 znaków", len(N("x" * 80)) == 40, len(N("x" * 80)))
    # Liczba albo słownik w tym polu to zepsuty plik, a nie nazwa: lepiej „bez nazwy" niż „123".
    check("liczba to nie nazwa", N(123) == "", repr(N(123)))
    check("słownik to nie nazwa", N({"a": 1}) == "", repr(N({"a": 1})))
    check("brak wartości to pusto", N(None) == "", repr(N(None)))

    # ---------------------------------------------------------------------------
    #  2. what a POST /rules body is asking for
    # ---------------------------------------------------------------------------
    print("\n--- POST /rules: co niesie treść zapytania ------------------------")
    P = rf.rules_post_payload

    r, n = P([rule()])
    check("gołą listę (starsze buildy) nadal rozumiemy", len(r or []) == 1 and n is None, (r, n))
    r, n = P({"rules": [rule()]})
    check("{rules} bez nazwy nie mówi nic o nazwie", len(r or []) == 1 and n is None, (r, n))
    r, n = P({"rules": [rule()], "configName": "Gry"})
    check("{rules, configName} niesie oba", len(r or []) == 1 and n == "Gry", (r, n))
    # NAZWA BEZ REGUŁ zmienia SAMĄ nazwę — to jest cała różnica między „None" a „[]" tutaj.
    r, n = P({"configName": "Gry"})
    check("sama nazwa nie mówi nic o regułach", r is None and n == "Gry", (r, n))
    r, n = P({"configName": ""})
    check("pusta nazwa to zdjęcie podpisu, nie brak zdania", r is None and n == "", (r, n))
    r, n = P({"rules": "nie lista"})
    check("śmieci w rules to brak reguł", r is None and n is None, (r, n))
    r, n = P("nonsens")
    check("śmieci zamiast treści to brak wszystkiego", r is None and n is None, (r, n))

    # ---------------------------------------------------------------------------
    #  3. round-trip przez plik
    # ---------------------------------------------------------------------------
    print("\n--- zapis i odczyt nazwy przy regułach ----------------------------")
    rf.save_rules(rf.sanitize_rules([rule()]), "d0", True, 1, "Multimedia")
    check("nazwa ląduje w kopercie", read_raw().get("configName") == "Multimedia", read_raw())
    check("i wraca odczytem", rf.load_rules_config_name("d0") == "Multimedia",
          rf.load_rules_config_name("d0"))
    check("reguły przeżyły zapis z nazwą", len(rf.load_rules("d0")) == 1, rf.load_rules("d0"))

    # config_name=None znaczy „nie mam zdania" — dokładnie jak active_layer=None. Tak zapisują
    # stop awaryjny, przełącznik grupy i przełączenie warstwy, i żaden z nich nie ma prawa
    # skasować podpisu.
    rf.save_rules(rf.sanitize_rules([rule(), rule("r2", "left")]), "d0", True, 1)
    check("zapis bez zdania o nazwie jej nie kasuje",
          rf.load_rules_config_name("d0") == "Multimedia", read_raw())
    check("…i zapisał nowe reguły", len(rf.load_rules("d0")) == 2, len(rf.load_rules("d0")))

    rf.save_rules(rf.sanitize_rules([rule()]), "d0", True, 1, "")
    check("pusta nazwa naprawdę zdejmuje podpis",
          rf.load_rules_config_name("d0") == "", read_raw())
    rf.save_rules(rf.sanitize_rules([rule()]), "d0", True, 1, " " * 5 + "Gry" + "x" * 60)
    check("nazwa idzie przez sanityzację po drodze na dysk",
          len(rf.load_rules_config_name("d0")) == 40
          and rf.load_rules_config_name("d0").startswith("Gry"),
          rf.load_rules_config_name("d0"))

    print("\n--- stare pliki (migracja) ---------------------------------------")
    write_raw([rule()])                                     # kształt sprzed kopert
    check("goła lista wczytuje się bez nazwy", rf.load_rules_config_name("d0") == "",
          rf.load_rules_config_name("d0"))
    check("…i nadal ma swoje reguły", len(rf.load_rules("d0")) == 1, rf.load_rules("d0"))
    write_raw({"enabled": True, "activeLayer": 2, "rules": [rule()]})   # koperta sprzed nazw
    check("koperta bez klucza to też brak nazwy", rf.load_rules_config_name("d0") == "",
          rf.load_rules_config_name("d0"))
    check("…i nie gubi warstwy", rf.load_rules_layer("d0") == 2, rf.load_rules_layer("d0"))
    write_raw({"enabled": True, "configName": 17, "rules": []})   # ktoś ręcznie zepsuł plik
    check("zepsuta nazwa w pliku to brak nazwy, nie wyjątek",
          rf.load_rules_config_name("d0") == "", rf.load_rules_config_name("d0"))

    print("\n--- świeży silnik ------------------------------------------------")
    check("nowy TriggerEngine nie nosi niczego",
          rf.TriggerEngine(FakeBus(), emitter=None).config_name == "")

    # ---------------------------------------------------------------------------
    #  4. wczytanie presetu nazywa kapsel
    # ---------------------------------------------------------------------------
    print("\n--- /profile/load: kapsel NOSI wczytany preset --------------------")
    rf.save_profile("Multimedia", {"rules": rf.sanitize_rules([rule(), rule("r2", "left")])})
    d = FakeDevice()
    d.trig.config_name = "Coś starego"
    got = rf.apply_profile(d, "Multimedia", d.bus)
    check("preset się wczytał", isinstance(got, list) and len(got) == 2, got)
    check("kapsel od razu nosi jego nazwę", d.trig.config_name == "Multimedia", d.trig.config_name)
    check("…i jest to zapisane na dysku", rf.load_rules_config_name("d0") == "Multimedia",
          read_raw())
    check("rozgłoszenie niesie nazwę",
          any(e.get("t") == "rules" and e.get("configName") == "Multimedia" for e in d.bus.events),
          d.bus.events)
    # Wczytanie zmienia to, CO kapsel robi — nigdy tego, czy mu WOLNO (jak apply_setup).
    check("przełącznik grupy nietknięty", d.trig.enabled is True)
    check("nieistniejący preset to brak odpowiedzi, nie pusta lista",
          rf.apply_profile(d, "Nie ma takiego", d.bus) is None)
    check("…i nazwa po nieudanym wczytaniu zostaje", d.trig.config_name == "Multimedia",
          d.trig.config_name)

    print("\n--- /profile/delete: skasowany preset NIE odbiera nazwy -----------")
    check("preset skasowany", rf.delete_profile("Multimedia") is True)
    check("kapsel nadal nosi tę nazwę w pamięci", d.trig.config_name == "Multimedia",
          d.trig.config_name)
    check("…i na dysku", rf.load_rules_config_name("d0") == "Multimedia", read_raw())
    check("preset naprawdę zniknął z listy", "Multimedia" not in rf.list_profiles(),
          rf.list_profiles())

    print("\n--- GET /profiles niesie TREŚĆ presetów ---------------------------")
    rf.save_profile("Gry", {"rules": rf.sanitize_rules([rule()])})
    items = rf.profile_items()
    check("każdy preset przychodzi z regułami",
          len(items) == 1 and items[0]["name"] == "Gry" and len(items[0]["rules"]) == 1, items)
    # Porównanie „czy to jeszcze to samo" musi porównywać jabłka z jabłkami: kapsel jest ZAWSZE
    # po sanityzacji, więc treść presetu też — inaczej preset, którego nikt nie tknął, zgłaszałby
    # się jako zmieniony tylko dlatego, że silnik przyciął mu wartość przy wczytaniu.
    check("…i to po tej samej sanityzacji, co kapsel",
          items[0]["rules"] == rf.sanitize_rules(items[0]["rules"]), items[0]["rules"])

    # ---------------------------------------------------------------------------
    #  5. nazwa jedzie w zestawie
    # ---------------------------------------------------------------------------
    print("\n--- zestaw (build_setup / apply_setup) ----------------------------")
    src = FakeDevice()
    src.trig.set_rules(rf.sanitize_rules([rule()]))
    src.trig.config_name = "Multimedia"
    cfg = rf.build_setup(src)
    check("zestaw niesie nazwę zestawu wyzwalaczy",
          cfg.get("rulesConfigName") == "Multimedia", cfg.get("rulesConfigName"))
    # Nazwa OPISUJE zawartość, więc nie może być zgłaszana jako „grupa, której nie znam" —
    # inaczej podgląd importu obiecywałby, że ją pominie.
    comp = rf.setup_compat({"config": cfg})
    check("podgląd importu nie nazywa jej nieznaną grupą",
          "rulesConfigName" not in (comp.get("unknownGroups") or []), comp)
    check("…i nie udaje szóstej grupy w podglądzie",
          "rulesConfigName" not in (rf.analyze_config(cfg).get("groups") or []),
          rf.analyze_config(cfg).get("groups"))

    dst = FakeDevice()
    dst.trig.config_name = "Stara nazwa"
    res = rf.apply_setup(dst, cfg, dst.bus)
    check("zestaw się nałożył", "rules" in res["applied"], res)
    check("kapsel-cel nosi nazwę z zestawu", dst.trig.config_name == "Multimedia",
          dst.trig.config_name)
    check("…i jest to zapisane", rf.load_rules_config_name("d0") == "Multimedia", read_raw())

    # Zestaw sprzed nazw nie ma prawa wyczyścić podpisu, którego nie zna.
    old_style = dict(cfg)
    old_style.pop("rulesConfigName")
    dst2 = FakeDevice()
    dst2.trig.config_name = "Moje własne"
    rf.apply_setup(dst2, old_style, dst2.bus)
    check("stary zestaw zostawia nazwę kapsla w spokoju",
          dst2.trig.config_name == "Moje własne", dst2.trig.config_name)

finally:
    shutil.rmtree(_TMP, ignore_errors=True)

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
