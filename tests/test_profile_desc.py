# Contract test: A TRIGGER CONFIGURATION CARRIES A DESCRIPTION.
# Run: py tests/test_profile_desc.py
#
# The name answers "which one is this". It does NOT answer "what is it for" — and a week later
# „Triki 2" means nothing to the person who typed it, let alone to whoever it was sent to on the
# forum. `desc` in the preset envelope is that second answer, and the hub above the trigger list
# (rf-49i) is where it is read and written.
#
# What is easy to break here, and silent when it breaks:
#
# 1. AN OLD FILE. Every preset written before descriptions existed — a bare list, or an envelope
#    with no `desc` — has to load as "the author wrote nothing", which is what an empty string
#    means. Get this wrong and the app either crashes on somebody's saved library or prints
#    „undefined" on a tile.
#
# 2. SAVING RULES MUST NOT ERASE THE DESCRIPTION. „Zapisz zmiany" goes down the same road as
#    „Zapisz jako…" — one POST /profile/save — so unless the caller hands the existing description
#    back, every rule save would quietly blank it. There would be no error and no sign in the
#    interface: the tile would simply say „bez opisu" and nobody would know why.
#
# 3. …AND EDITING THE DESCRIPTION MUST NOT TOUCH A SINGLE RULE. The reverse of the same road:
#    fixing a typo in a sentence has no business rewriting forty triggers with whatever happens to
#    be on the capsule at that moment.
#
# 4. ONE LIMIT, ONE PLACE. The file, the library row and the text box all cut at PROFILE_DESC_MAX,
#    and the panel READS it from GET /profiles instead of keeping a copy — two numbers drift apart
#    on the first change, and the user finds out by having a sentence cut in half.
#
# The panel's half (tiles, chips, the status sentence) is checked at the end by cfghub_harness.mjs,
# which runs the REAL panel modules in `vm` against the library this file just built.
#
# Nothing here touches the owner's Settings/ or Library/: both are pointed at a temp directory
# first, and no HTTP server is ever started.
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
    # Konsola Windows bywa w cp1250, a szczegoly niosa cytaty z paska (emoji ostrzezenia, mysliniki).
    # Wyjatek kodowania w linii RAPORTU przerwalby test, ktory wlasnie cos znalazl - czyli zabralby
    # dokladnie te informacje, dla ktorej test istnieje.
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


def rule(rid="r1", key="right", th=5000):
    return {"id": rid, "label": "Test", "source": {"kind": "axis", "channel": 0},
            "cmp": ">", "threshold": th, "keySpec": key}


_TMP = tempfile.mkdtemp(prefix="rf-profdesc-")
rf.SETTINGS_DIR = os.path.join(_TMP, "Settings")
rf.PROFILE_DIR = os.path.join(_TMP, "Library", "Profiles")
os.makedirs(rf.SETTINGS_DIR, exist_ok=True)
os.makedirs(rf.PROFILE_DIR, exist_ok=True)


def read_raw(name):
    with open(os.path.join(rf.PROFILE_DIR, name + ".json"), "r", encoding="utf-8") as f:
        return json.load(f)


def write_raw(name, obj):
    with open(os.path.join(rf.PROFILE_DIR, name + ".json"), "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False)


try:
    # ---------------------------------------------------------------------------
    #  1. the description itself
    # ---------------------------------------------------------------------------
    print("--- opis (sanityzacja) -------------------------------------------")
    S = rf._profile_desc

    check("zwykłe zdanie przechodzi",
          S("Wolfenstein: kamera i strzelanie") == "Wolfenstein: kamera i strzelanie")
    check("spacje po bokach obcięte", S("  chodzenie i skok  ") == "chodzenie i skok",
          repr(S("  chodzenie i skok  ")))
    # Opis bywa dwuzdaniowy — nowa linia jest w nim normalna i nie ma powodu jej zjadać (inaczej
    # niż w NAZWIE, która jest podpisem na jednej linijce; patrz test_trig_config.py).
    check("nowa linia w środku zostaje", S("Pierwsze.\nDrugie.") == "Pierwsze.\nDrugie.",
          repr(S("Pierwsze.\nDrugie.")))
    check("obcięty do limitu", len(S("x" * 500)) == rf.PROFILE_DESC_MAX, len(S("x" * 500)))
    check("limit to jedna stała, równa 200", rf.PROFILE_DESC_MAX == 200, rf.PROFILE_DESC_MAX)
    # Liczba albo słownik w tym polu to zepsuty plik, a nie opis: lepiej pusto niż „{'a': 1}" na kaflu.
    check("liczba to nie opis", S(123) == "", repr(S(123)))
    check("słownik to nie opis", S({"a": 1}) == "", repr(S({"a": 1})))
    check("lista to nie opis", S(["a"]) == "", repr(S(["a"])))
    check("brak wartości to pusto", S(None) == "", repr(S(None)))

    # ---------------------------------------------------------------------------
    #  2. round-trip przez plik
    # ---------------------------------------------------------------------------
    print("\n--- zapis i odczyt opisu przy regułach ----------------------------")
    ok = rf.save_profile("Wolfenstein chodzenie", {
        "rules": rf.sanitize_rules([rule(), rule("r2", "left")]),
        "desc": "Chodzenie, skok i sprint. Kamera osobno, w drugiej konfiguracji."})
    check("zapis się udał", ok is True)
    env = read_raw("Wolfenstein chodzenie")
    check("opis ląduje w kopercie",
          env.get("desc", "").startswith("Chodzenie, skok i sprint."), env.get("desc"))
    check("…obok reguł, a nie zamiast nich", len(env.get("rules") or []) == 2, env.get("rules"))
    check("koperta nadal mówi, czym jest",
          env.get("kind") == "profile" and env.get("version") == rf.PROFILE_FORMAT, env)

    rf.save_profile("Bez opisu", {"rules": rf.sanitize_rules([rule()])})
    check("zapis bez opisu daje pusty opis, nie brak klucza",
          read_raw("Bez opisu").get("desc") == "", read_raw("Bez opisu"))
    rf.save_profile("Za długi", {"rules": [], "desc": "y" * 900})
    check("opis idzie przez sanityzację po drodze na dysk",
          len(read_raw("Za długi").get("desc")) == rf.PROFILE_DESC_MAX,
          len(read_raw("Za długi").get("desc")))
    rf.delete_profile("Za długi")

    # ---------------------------------------------------------------------------
    #  3. GET /profiles niesie opis — to z tego hub rysuje kafel
    # ---------------------------------------------------------------------------
    print("\n--- profile_items(): opis jedzie razem z treścią ------------------")
    rf.save_profile("Wolfenstein kamera", {"rules": rf.sanitize_rules([rule("r9", "mouse:left", 7000)]),
                                           "desc": ""})
    items = {it["name"]: it for it in rf.profile_items()}
    check("każda konfiguracja przychodzi z opisem",
          all("desc" in it for it in items.values()), list(items.values())[:1])
    check("…i jest to opis z pliku",
          items["Wolfenstein chodzenie"]["desc"].startswith("Chodzenie, skok"),
          items["Wolfenstein chodzenie"]["desc"])
    check("konfiguracja bez opisu ma pusty łańcuch, nie None",
          items["Bez opisu"]["desc"] == "", repr(items["Bez opisu"]["desc"]))
    check("…i nadal niesie reguły po sanityzacji",
          items["Wolfenstein chodzenie"]["rules"]
          == rf.sanitize_rules(items["Wolfenstein chodzenie"]["rules"]))

    print("\n--- stare pliki (migracja) ---------------------------------------")
    write_raw("Prastary", [rule()])                       # kształt sprzed kopert
    write_raw("Sprzed opisow", {"kind": "profile", "name": "Sprzed opisow", "rules": [rule()]})
    write_raw("Zepsuty opis", {"kind": "profile", "rules": [rule()], "desc": 17})
    old = {it["name"]: it for it in rf.profile_items()}
    check("goła lista wczytuje się bez opisu", old["Prastary"]["desc"] == "", old["Prastary"])
    check("…i nadal ma swoje reguły", len(old["Prastary"]["rules"]) == 1, old["Prastary"])
    check("koperta bez klucza to też brak opisu", old["Sprzed opisow"]["desc"] == "",
          old["Sprzed opisow"])
    check("zepsuty opis w pliku to brak opisu, nie wyjątek",
          old["Zepsuty opis"]["desc"] == "", repr(old["Zepsuty opis"]["desc"]))
    for nm in ("Prastary", "Sprzed opisow", "Zepsuty opis"):
        rf.delete_profile(nm)

    # ---------------------------------------------------------------------------
    #  4. dwie drogi zapisu, które nie mogą sobie nawzajem szkodzić
    # ---------------------------------------------------------------------------
    print("\n--- nadpisanie: reguły i opis nie kasują się nawzajem -------------")
    # POPRAWKA OPISU BEZ RUSZANIA REGUŁ — dokładnie to, co robi ✎ na kaflu: odsyła reguły, które
    # konfiguracja już ma, i nowe zdanie obok nich. Bez własnego adresu na serwerze.
    have = rf.profile_items()
    src = [it for it in have if it["name"] == "Wolfenstein chodzenie"][0]
    rf.save_profile("Wolfenstein chodzenie", {"rules": src["rules"], "desc": "Nowe zdanie."})
    after = read_raw("Wolfenstein chodzenie")
    check("nowy opis zapisany", after.get("desc") == "Nowe zdanie.", after.get("desc"))
    check("…a reguły co do jednej te same", after.get("rules") == src["rules"])

    # ZAPIS REGUŁ Z ODDANYM OPISEM — to jest kontrakt, którego pilnuje `overwrite` w rf-49b.
    # Gdyby wysłał sam `rules`, opis zniknąłby bez śladu w interfejsie.
    rf.save_profile("Wolfenstein chodzenie",
                    {"rules": rf.sanitize_rules([rule(), rule("r2", "left"), rule("r3", "up")]),
                     "desc": after.get("desc")})
    both = read_raw("Wolfenstein chodzenie")
    check("zapis reguł z oddanym opisem zachowuje jedno i drugie",
          len(both.get("rules")) == 3 and both.get("desc") == "Nowe zdanie.", both.get("desc"))
    # …i dowód, że to naprawdę jest pułapka: ten sam zapis BEZ opisu go kasuje.
    rf.save_profile("Wolfenstein chodzenie", {"rules": both.get("rules")})
    check("zapis reguł bez oddania opisu KASUJE opis (dlatego overwrite go oddaje)",
          read_raw("Wolfenstein chodzenie").get("desc") == "",
          read_raw("Wolfenstein chodzenie").get("desc"))
    rf.save_profile("Wolfenstein chodzenie",
                    {"rules": both.get("rules"),
                     "desc": "Chodzenie, skok i sprint. Kamera osobno, w drugiej konfiguracji."})

    # ---------------------------------------------------------------------------
    #  5. wiersz Biblioteki mówi to samo, co kafel
    # ---------------------------------------------------------------------------
    print("\n--- _library_entry: opis w wierszu Biblioteki ---------------------")
    row = rf._library_entry("profile", rf.PROFILE_DIR, "Wolfenstein chodzenie")
    check("wiersz niesie opis", row.get("desc", "").startswith("Chodzenie, skok"), row.get("desc"))
    check("…i liczbę reguł, jak przedtem", row.get("rules") == 3, row.get("rules"))
    check("…i nazwę", row.get("name") == "Wolfenstein chodzenie", row.get("name"))
    check("konfiguracja bez opisu ma pole, tylko puste",
          rf._library_entry("profile", rf.PROFILE_DIR, "Bez opisu").get("desc") == "",
          rf._library_entry("profile", rf.PROFILE_DIR, "Bez opisu"))
    # Zepsuty plik nadal DA SIĘ opisać (i skasować) — to się nie zmieniło.
    with open(os.path.join(rf.PROFILE_DIR, "Polamany.json"), "w", encoding="utf-8") as f:
        f.write("{{{nie json")          # nie JSON, a nie „JSON, ktory jest napisem"
    check("plik nie do odczytania nadal ma wiersz z flagą",
          rf._library_entry("profile", rf.PROFILE_DIR, "Polamany").get("broken") is True)
    rf.delete_profile("Polamany")
    idx = rf.library_index()
    check("indeks biblioteki niesie opisy presetów",
          all("desc" in it for it in idx.get("profile", []) if not it.get("broken")),
          idx.get("profile"))

    # Nazwa nie jest opisem i opis nie jest nazwą — wczytanie nadal nazywa kapsel samą nazwą.
    print("\n--- opis NIE ląduje na kapslu ------------------------------------")

    class FakeBus:
        def now(self):
            return 0.0

        def publish(self, ev):
            pass

    class FakeDevice:
        def __init__(self):
            self.id = "d0"
            self.bus = FakeBus()
            self.trig = rf.TriggerEngine(self.bus, emitter=None, armed=True)

    d = FakeDevice()
    rf.apply_profile(d, "Wolfenstein chodzenie", d.bus)
    check("kapsel nosi nazwę wczytanej konfiguracji",
          d.trig.config_name == "Wolfenstein chodzenie", d.trig.config_name)
    check("…a opis zostaje w bibliotece, nie na kapslu",
          not hasattr(d.trig, "config_desc"), dir(d.trig))

    # ---------------------------------------------------------------------------
    #  5b. nazwa z plusem i z podwójną spacją — jedna polityka po obu stronach
    # ---------------------------------------------------------------------------
    # Regresja z 2026-08-28: `+` był wycinany z nazwy pliku i zostawiał podwójną spację,
    # a nazwa na kapslu przechodziła przez _rules_config_name, który spacje zwija.
    # Kapsel nosił przez to „konfigurację, której nie ma na liście", choć preset istniał.
    print("\n--- nazwa: plus zostaje, spacje zwijane, kapsel = koperta ----------")
    check("plus w nazwie przezywa sanityzacje",
          rf._safe_profile_name("Wolfenstein kamera + strzelanie") == "Wolfenstein kamera + strzelanie",
          rf._safe_profile_name("Wolfenstein kamera + strzelanie"))
    check("biale znaki zwijane jak w _rules_config_name",
          rf._safe_profile_name("  Gry\t retro   2026 ") == "Gry retro 2026",
          rf._safe_profile_name("  Gry\t retro   2026 "))
    rf.save_profile("Wolfenstein kamera + strzelanie",
                    {"name": rf._safe_profile_name("Wolfenstein kamera + strzelanie"),
                     "desc": "", "rules": []})
    d2 = FakeDevice()
    rf.apply_profile(d2, "Wolfenstein kamera + strzelanie", d2.bus)
    names = [p["name"] for p in rf.profile_items()]
    check("nazwa na kapslu == nazwa w bibliotece (bez ducha)",
          d2.trig.config_name in names, (d2.trig.config_name, names))
    rf.delete_profile("Wolfenstein kamera + strzelanie")

    # ---------------------------------------------------------------------------
    #  6. panel: kafle, chipy i zdanie o tym, co znaczy zapis
    # ---------------------------------------------------------------------------
    print("\n--- panel: hub składa bibliotekę z tych samych danych -------------")
    payload = json.dumps({"items": rf.profile_items()}, ensure_ascii=False)
    harness = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cfghub_harness.mjs")
    try:
        p = subprocess.run(["node", harness, payload], capture_output=True, text=True,
                           encoding="utf-8", timeout=60)
        out = json.loads((p.stdout or "").strip().splitlines()[-1]) if p.returncode == 0 else None
    except (OSError, ValueError, IndexError, subprocess.SubprocessError) as e:
        p, out = None, None
        print("POMINIETO  panel (Node): %s" % e)
    if out is None and p is not None:
        check("harness panelu wystartował", False, (p.stderr or p.stdout or "")[-400:])
    for nm, ok_, detail in (out or {}).get("checks", []):
        check(nm, ok_, detail)

finally:
    shutil.rmtree(_TMP, ignore_errors=True)

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
