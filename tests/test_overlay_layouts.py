# NAZWANE UKŁADY OKIEN NAKŁADEK („Stream", „Trening"). Uruchom: py tests/test_overlay_layouts.py
#
# Okna nakładek są bytami od dnia, w którym kapsel dostał ich kilka (test_overlay_multi.py).
# Ten plik sprawdza piętro wyżej: nazwę dla CAŁEGO ZESTAWU okien — zapis i przywrócenie rozstawienia
# z pozycjami, rozmiarami i motywami. To pierwsza konfiguracja w aplikacji, której nośnikiem nie
# jest kapsel, tylko aplikacja, więc nazwa mieszka na wierzchu pliku nakładek (`layoutName`).
#
# Co jest tu łatwe do zepsucia i ciche, kiedy się zepsuje:
#
# 1. UKŁAD NIE NIESIE `open`. To ta sama zasada, co „konfiguracja nie niesie przełączników"
#    (apply_setup, MOUSE_PRESET_SKIP): układ mówi, JAK okna wyglądają i GDZIE stoją, a nie CZY są
#    na ekranie. Zgubione — wczytanie „Treningu" zapala komuś nakładkę nad grą w środku meczu,
#    a każde otwarcie okna zapala w panelu „zmienione".
#
# 2. OKNA KOŁA (`d0~kolo`) SĄ POZA UKŁADAMI. Nie są nakładkami, które ktoś postawił: chodzą za
#    kursorem, włącza się je w karcie „Koło wyboru" i są celowo pominięte we wszystkich listach
#    okien. Wpuszczone tutaj dałyby drugie miejsce, w którym ustawia się to samo okno.
#
# 3. KOLEJNOŚĆ OPERACJI PRZY WCZYTYWANIU. Najpierw nałóż i utwórz, POTEM usuwaj — odwrotnie kapsel
#    przejściowo zostaje z zerem okien, a `remove` broni ostatniego i odmówiłoby usunięcia tego,
#    które układ chce zastąpić innym.
#
# 4. UKŁAD DZIAŁA TYLKO NA KAPSLACH, O KTÓRYCH COŚ MÓWI, a te, których teraz nie ma, są POLICZONE
#    (`skipped`), nie pominięte po cichu. Ciche pominięcie połowy układu czyta się jak sukces.
#
# Nic tutaj nie otwiera okna Windows i nic nie jest do tego potrzebne — dokładnie jak w
# test_overlay_multi.py: `add` uruchamia przeglądarkę tylko wtedy, gdy dostanie adres, a żaden
# test go nie podaje. Ustawienia idą do katalogu tymczasowego, nie do prawdziwego Settings/.
import json
import os
import shutil
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import ribbitflip_monitor as rf   # noqa: E402

_passed = 0
_failed = 0


def check(name, cond, detail=""):
    global _passed, _failed
    if cond:
        _passed += 1
        print("PASS  %s" % name)
    else:
        _failed += 1
        print("FAIL  %s%s" % (name, ("  -> " + str(detail)) if detail else ""))


_TMP = tempfile.mkdtemp(prefix="rf-ovl-lay-")
rf.OVERLAY_LAYOUTS_FILE = os.path.join(_TMP, "ribbitflip_overlay_layouts.json")


def mgr(seed=None):
    """Menedżer na własnym pliku ustawień, bez możliwości uruchomienia przeglądarki."""
    path = os.path.join(tempfile.mkdtemp(prefix="rf-ovl-", dir=_TMP), "ribbitflip_overlay.json")
    if seed is not None:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(seed, f)
    rf.OVERLAY_CONFIG_FILE = path
    m = rf.OverlayManager()
    m.available = lambda: (True, "")     # „czy jest tu Chromium" to nie jest temat tych testów
    return m, path


def wipe_layouts():
    rf.save_overlay_layouts([])


try:
    print("\n--- migawka: co układ w ogóle zapamiętuje ---")
    M, CFG = mgr()
    M.first_wid("d0", create=True)
    M.add("d0")
    M.configure("d0", {"theme": "bare", "x": 40, "y": 60, "w": 300, "label": "widzowie"})
    M.wins["d0"].cfg["open"] = True
    M.wheel_wid("d0", create=True)             # okno koła — istnieje, ale do układu nie należy
    M.first_wid("d1", create=True)
    snap = M.layout_snapshot()
    check("migawka bierze WSZYSTKIE zwykłe okna, także drugiego kapsla",
          sorted(snap) == ["d0", "d0~2", "d1"], sorted(snap))
    check("okno koła przy kursorze jest poza układem",
          rf.overlay_wheel_wid("d0") in M.wins and rf.overlay_wheel_wid("d0") not in snap,
          sorted(M.wins))
    check("`open` wycięte — układ nie mówi, czy okno jest na ekranie",
          all("open" not in c for c in snap.values()))
    check("…ale miejsce, rozmiar, wygląd i nazwa okna zostają",
          (snap["d0"]["x"], snap["d0"]["w"], snap["d0"]["theme"], snap["d0"]["label"])
          == (40, 300, "bare", "widzowie"), snap["d0"])
    check("zawartość i skale części też (to jest cała różnica między „Stream” a „Treningiem”)",
          isinstance(snap["d0"].get("show"), dict) and isinstance(snap["d0"].get("scaleParts"), dict))
    # PASEK OKNA (2026-09-03). Układ niesie go tak samo, jak „przepuszczaj kliknięcia": „Stream" to
    # okna bez uchwytu i ⚙, oddane widzom, a „Trening" to okna, którymi się w trakcie rusza ręką.
    M.configure("d0~2", {"winBar": False})
    snap2 = M.layout_snapshot()
    check("układ niesie pasek okna — i osobno dla każdego okna",
          snap2["d0"]["winBar"] is True and snap2["d0~2"]["winBar"] is False,
          (snap2["d0"].get("winBar"), snap2["d0~2"].get("winBar")))
    check("…i przechodzi przez sanityzację układu tak samo jak reszta",
          rf.sanitize_overlay_layout(
              {"name": "Stream", "windows": {"d0": {"winBar": False}}})["windows"]["d0"]["winBar"]
          is False)
    M.configure("d0~2", {"winBar": True})

    print("\n--- sanityzacja układu ---")
    good = rf.sanitize_overlay_layout({"name": " Stream ", "windows": {"d0": {"x": 1}}})
    check("nazwa zwinięta i przycięta jak każda inna w tej aplikacji", good["name"] == "Stream")
    check("okno przeszło przez tę samą sanityzację, co ustawienia żywego okna",
          good["windows"]["d0"]["theme"] == "bare" and good["windows"]["d0"]["x"] == 1)
    check("`open` wycięte także tutaj — pole, którego w pliku nie ma, nie może zostać zastosowane",
          "open" not in good["windows"]["d0"])
    check("bez nazwy nie ma układu",
          rf.sanitize_overlay_layout({"name": "  ", "windows": {"d0": {}}}) is None)
    check("bez okien nie ma układu (nie ma czego rozstawić)",
          rf.sanitize_overlay_layout({"name": "Pusty", "windows": {}}) is None)
    check("słownik okien, który nie jest słownikiem, to nie jest układ",
          rf.sanitize_overlay_layout({"name": "Zły", "windows": ["d0"]}) is None)
    _bad = rf.sanitize_overlay_layout({"name": "Mix", "windows": {
        "d0": {}, "d0~kolo": {}, "d0~99": {}, "../d0": {}, "": {}, "d0~x": {}}})
    check("id spoza tego, co aplikacja wydaje, jest odrzucane, a nie wpuszczane do menedżera okien",
          sorted(_bad["windows"]) == ["d0"], sorted(_bad["windows"]))
    check("nazwa dłuższa niż wolno jest przycinana, a nie odrzucana",
          len(rf.sanitize_overlay_layout({"name": "x" * 90, "windows": {"d0": {}}})["name"])
          == rf.OVERLAY_LAYOUT_NAME_MAX)

    print("\n--- lista układów: zapis, podmiana, limit, usunięcie ---")
    wipe_layouts()
    ok, err, items = rf.overlay_layout_put({"name": "Stream", "windows": snap})
    check("zapisany", ok and err is None and len(items) == 1, (ok, err))
    ok, _e, items = rf.overlay_layout_put({"name": "stream", "windows": {"d1": {"w": 999}}})
    check("ta sama nazwa inną wielkością liter to TEN SAM układ (podmiana, nie druga pozycja)",
          ok and len(items) == 1 and items[0]["windows"]["d1"]["w"] == 999, items)
    check("…i podmieniony W MIEJSCU, więc lista nie tasuje się pod czytającym",
          items[0]["name"] == "stream")
    ok, err, _i = rf.overlay_layout_put({"name": "", "windows": snap})
    check("odmowa jest zdaniem, nie ciszą", ok is False and bool(err), (ok, err))
    for i in range(rf.OVERLAY_LAYOUT_MAX + 3):
        rf.overlay_layout_put({"name": "U%d" % i, "windows": {"d0": {}}})
    check("limit trzyma, zamiast robić układ numer 500",
          len(rf.load_overlay_layouts()) == rf.OVERLAY_LAYOUT_MAX,
          len(rf.load_overlay_layouts()))
    ok, err, _i = rf.overlay_layout_put({"name": "Jeszcze jeden", "windows": {"d0": {}}})
    check("…i mówi, dlaczego nie", ok is False and bool(err), err)
    check("usunięcie nieistniejącego nie jest błędem — odpowiedzią jest lista",
          isinstance(rf.overlay_layout_drop("nie ma takiego"), list))

    print("\n--- wczytanie układu: istniejące, brakujące, nadmiarowe ---")
    wipe_layouts()
    M2, CFG2 = mgr()
    M2.first_wid("d0", create=True)
    M2.add("d0")
    M2.add("d0")                                     # d0, d0~2, d0~3
    M2.first_wid("d1", create=True)
    M2.wheel_wid("d0", create=True)
    M2.wins["d0"].cfg["open"] = True                 # jedno okno JEST na ekranie
    M2.configure(rf.overlay_wheel_wid("d0"), {"x": 111, "y": 222})
    rf.overlay_layout_put({"name": "Trening", "windows": {
        "d0": {"theme": "dark", "x": 10, "y": 20, "w": 900, "label": "ściąga"},
        "d0~4": {"theme": "bare", "x": 30, "y": 40},          # tego okna jeszcze nie ma
    }})
    ok, err, rep = rf.apply_overlay_layout(M2, "Trening", devs={"d0", "d1"})
    check("wczytany", ok and err is None, (ok, err))
    check("istniejące okno dostało ustawienia z układu",
          (M2.wins["d0"].cfg["theme"], M2.wins["d0"].cfg["x"], M2.wins["d0"].cfg["label"])
          == ("dark", 10, "ściąga"), M2.wins["d0"].cfg)
    check("`open` istniejącego okna ZOSTAŁO — układ niczego nie zamyka",
          M2.wins["d0"].cfg["open"] is True)
    check("brakujące okno powstało", "d0~4" in M2.wins)
    check("…i jest ZAMKNIĘTE — układ niczego nie otwiera",
          M2.wins["d0~4"].cfg["open"] is False, M2.wins["d0~4"].cfg["open"])
    check("…z ustawieniami z układu, a nie kopią sąsiada",
          M2.wins["d0~4"].cfg["theme"] == "bare" and M2.wins["d0~4"].cfg["x"] == 30)
    check("nadmiarowe zwykłe okna tego kapsla zniknęły",
          M2.wids_for("d0") == ["d0", "d0~4"], M2.wids_for("d0"))
    check("raport mówi, co się stało (nie tylko „ok”)",
          rep["applied"] == ["d0"] and rep["created"] == ["d0~4"]
          and sorted(rep["removed"]) == ["d0~2", "d0~3"], rep)
    check("KAPSEL SPOZA UKŁADU jest nietknięty — układ zapisany przy jednym kapslu nie sprząta "
          "ekranu drugiemu", M2.wids_for("d1") == ["d1"], M2.wids_for("d1"))
    check("okno koła przy kursorze nietknięte i nieusunięte",
          rf.overlay_wheel_wid("d0") in M2.wins
          and M2.wins[rf.overlay_wheel_wid("d0")].cfg["x"] == 111)
    check("okna noszą teraz nazwę tego układu", M2.layout_name == "Trening", M2.layout_name)
    rf.OVERLAY_CONFIG_FILE = CFG2
    with open(CFG2, "r", encoding="utf-8") as f:
        onDisk = json.load(f)
    check("…i nazwa jest NA DYSKU, razem z oknami", onDisk.get("layoutName") == "Trening",
          onDisk.get("layoutName"))
    check("…a plik zna dokładnie te okna, które zostały",
          sorted(k for k in onDisk["windows"] if not rf.overlay_is_wheel_wid(k))
          == ["d0", "d0~4", "d1"], sorted(onDisk["windows"]))

    print("\n--- kolejność: najpierw utwórz, potem usuwaj ---")
    # Kapsel z JEDNYM oknem o innym id niż to, którego chce układ. Odwrotna kolejność operacji
    # zderzyłaby się z regułą „ostatniego okna kapsla nie można usunąć" i układ nie wszedłby wcale.
    wipe_layouts()
    M3, _ = mgr({"windows": {"d0~5": {"theme": "dark"}}})
    check("kapsel ma jedno okno, i nie jest nim to, którego chce układ",
          M3.wids_for("d0") == ["d0~5"], M3.wids_for("d0"))
    rf.overlay_layout_put({"name": "Stream", "windows": {"d0": {"theme": "felt"}}})
    ok, _e, rep = rf.apply_overlay_layout(M3, "Stream", devs={"d0"})
    check("podmiana jedynego okna na inne udała się w całości",
          ok and M3.wids_for("d0") == ["d0"], (ok, M3.wids_for("d0"), rep))

    print("\n--- kapsel z układu, którego teraz nie ma ---")
    wipe_layouts()
    M4, _ = mgr()
    M4.first_wid("d0", create=True)
    rf.overlay_layout_put({"name": "Dwa kapsle", "windows": {
        "d0": {"theme": "dark"}, "d1": {"theme": "bare"}, "d1~2": {"theme": "felt"}}})
    ok, _e, rep = rf.apply_overlay_layout(M4, "Dwa kapsle", devs={"d0"})
    check("niesparowany kapsel jest POLICZONY, nie pominięty po cichu",
          ok and rep["skipped"] == ["d1"], rep)
    check("…i żadne jego okno nie powstało", "d1" not in M4.wins and "d1~2" not in M4.wins,
          sorted(M4.wins))
    check("…a kapsel, który jest, został rozstawiony", M4.wins["d0"].cfg["theme"] == "dark")
    check("`devs=None` znaczy „nie sprawdzaj” (tak wołają testy i tak wolno wołać skryptowi)",
          rf.apply_overlay_layout(M4, "Dwa kapsle")[2]["skipped"] == [])
    check("…i wtedy okna nieobecnego kapsla jednak powstają",
          "d1" in M4.wins and "d1~2" in M4.wins, sorted(M4.wins))
    ok, err, _r = rf.apply_overlay_layout(M4, "nie ma takiego układu")
    check("nieznana nazwa to odmowa ze zdaniem, a nie cicha zgoda", ok is False and bool(err), err)

    print("\n--- nazwa układu w pliku ustawień ---")
    M5, CFG5 = mgr()
    M5.first_wid("d0", create=True)
    M5.set_layout_name("  Stream   nocny  ")
    rf.OVERLAY_CONFIG_FILE = CFG5
    M5._save_now()
    M6 = rf.OverlayManager()
    check("nazwa wraca z pliku tak, jak ją zapisano (białe znaki zwinięte)",
          M6.layout_name == "Stream nocny", M6.layout_name)
    check("…i jedzie do panelu w stanie nakładek",
          M6.state()["layoutName"] == "Stream nocny"
          and M6.state("d0")["layoutName"] == "Stream nocny")
    M6.set_layout_name("")
    M6._save_now()
    check("zdjęcie nazwy nie rusza ani jednego okna",
          rf.OverlayManager().wids_for("d0") == ["d0"])
    # Plik sprzed tej zmiany: same `windows`, bez `layoutName`.
    M7, CFG7 = mgr({"windows": {"d0": {"theme": "dark"}}})
    check("stary plik czyta się jako „bez nazwy”, a nie jako błąd",
          M7.layout_name == "" and M7.wins["d0"].cfg["theme"] == "dark", M7.layout_name)
    # …a zapis przez wołającego, który o układach nic nie wie, nie ma prawa skasować nazwy.
    rf.OVERLAY_CONFIG_FILE = CFG5
    rf.save_overlay_config({"d0": {}}, "Stream nocny")
    rf.save_overlay_config({"d0": {"w": 500}})
    check("zapis bez podanej nazwy zostawia ją taką, jaka była",
          rf.load_overlay_layout_name() == "Stream nocny", rf.load_overlay_layout_name())

    print("\n--- usunięcie układu nie rusza tego, co na ekranie ---")
    wipe_layouts()
    M8, CFG8 = mgr()
    M8.first_wid("d0", create=True)
    rf.overlay_layout_put({"name": "Stream", "windows": {"d0": {"theme": "dark"}}})
    rf.apply_overlay_layout(M8, "Stream", devs={"d0"})
    rf.overlay_layout_drop("Stream")
    check("układ zniknął z listy", rf.overlay_layout_find("Stream") is None)
    check("…ale okna zostały tam, gdzie były", M8.wins["d0"].cfg["theme"] == "dark")
    check("…i dalej noszą tę nazwę, więc pasek powie „tego układu nie ma już na liście”",
          M8.layout_name == "Stream", M8.layout_name)

    print("\n--- panel: odcisk liczy dokładnie to, co układ niesie ------------")
    wipe_layouts()
    M9, _ = mgr()
    M9.first_wid("d0", create=True)
    M9.add("d0")
    M9.first_wid("d1", create=True)
    M9.configure("d0", {"theme": "bare", "x": 40, "y": 60, "w": 300, "opacity": 55,
                        "label": "widzowie", "show": {"pad": True},
                        "scaleParts": {"pose": 140}, "clickThrough": True})
    M9.wins["d0"].cfg["open"] = True
    cur = {w: json.loads(json.dumps(M9.wins[w].cfg)) for w in M9.wins
           if not rf.overlay_is_wheel_wid(w)}
    payload = json.dumps({"cur": cur,
                          "layout": {"name": "Stream", "windows": M9.layout_snapshot()},
                          "defaults": rf.OVERLAY_WIN_DEFAULTS}, ensure_ascii=False)
    harness = os.path.join(os.path.dirname(os.path.abspath(__file__)), "overlay_layouts_harness.mjs")
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

print("\n%d PASS / %d FAIL" % (_passed, _failed))
sys.exit(1 if _failed else 0)
