# SYNTEZATOR: stan po stronie APLIKACJI i nazwane SCENY. Uruchom: py tests/test_synth_store.py
#
# Silnik dźwięku (WebAudio) i cały model padów żyją w przeglądarce i tak zostaje. Zmienia się
# JEDNO: gdzie leży odpowiedź na pytanie „co ten syntezator gra". Do dziś leżała wyłącznie
# w localStorage, czyli w jednej przeglądarce na jednym profilu — druga przeglądarka zastawała
# pusty syntezator, wyczyszczenie danych strony kasowało brzmienia bezpowrotnie, a kopia katalogu
# Settings/ (jedyna kopia, którą ktokolwiek robi) nie niosła ich wcale.
#
# Co jest tu łatwe do zepsucia i ciche, kiedy się zepsuje:
#
# 1. SERWER NIE ZAGLĄDA DO ŚRODKA — dokładnie jak `/rest/config`. Model padów ma sto pól i mieszka
#    w rf-19/rf-20; drugi jego opis tutaj rozjechałby się z pierwszym przy pierwszej zmianie
#    w przeglądarce i wtedy serwer zaczynałby po cichu WYCINAĆ pola, których nie zna. Sprawdzana
#    jest KOPERTA: słownik, nazwa sceny, rozmiar. Ten plik pilnuje właśnie tej granicy.
#
# 2. STAN I SCENY SĄ W JEDNYM PLIKU, więc zapis jednego nie ma prawa zgubić drugiego. Stan
#    zapisuje się przy KAŻDYM ruchu suwaka, a sceny obok niego — nadpisanie całego pliku przy
#    zapisie stanu skasowałoby je przy pierwszym dotknięciu pokrętła.
#
# 3. SCENA NIE NIESIE PRZEŁĄCZNIKA (`enabled`) ani własnej nazwy (`configName`). To jest połowa
#    po stronie przeglądarki i sprawdza ją harness `synth_scenes_harness.mjs`, uruchamiany na
#    końcu tego pliku — razem, bo to jedna funkcja przecięta na pół siecią.
#
# 4. NOWY KLUCZ BRZMIENIA NIE RUSZA STARYCH. Fala własna z oscyloskopu edytora (`wave:"custom"` + `wt`,
#    2026-10-02) wchodzi do zapisu przez sanitizePatch; harness `sound_screens_harness.mjs` (też na końcu)
#    pilnuje, że stare brzmienia wychodzą z niego bajt w bajt, a nowe przeżywają obieg zapisu.
#
# 5. NOWE BRZMIENIA BAZOWE NIE RUSZAJĄ STARYCH. 12 brzmień z 2026-10-02 (rf-17) i losowanie (rf-25) sprawdza
#    harness `sound_library_harness.mjs` (też na końcu): stare 23 bajt w bajt jak w kopii sprzed zmiany, nowe
#    już w postaci zapisu, a każdy wynik „Zaskocz mnie” i kostek modułów przechodzi sanitizePatch bez zmiany.
#
# 6. EDYTOR JAKO „RACK” NIE ZAPALA FAŁSZYWEJ KROPKI. rf-25d porównuje formularz z odniesieniem po sanitizePatch;
#    harness `sound_rack_harness.mjs` (też na końcu) wczytuje każde z 35 brzmień bazowych i pilnuje, że kropka
#    „niezapisane zmiany” zapala się dopiero po zmianie, a gaśnie po zapisie, anulowaniu i „+ Nowe”.
#
# 7. PŁASKIE EDYTORY KRZYWYCH NIOSĄ PATCH JAK LAMPA. Od etapu E6 fala, korektor i obwiednia edytuje się na panelach
#    w kartach modułów (rf-25e), a lampa jest tylko wizualizacją; harness `curve_editors_harness.mjs` (też na końcu)
#    pilnuje, że readInto / load, rysowanie, pierścienie i uchwyty na suwakach zachowują się jak przed przeprowadzką.
#
# Nic tutaj nie potrzebuje serwera HTTP ani przeglądarki: sprawdzane są funkcje modułu, a plik
# ustawień idzie do katalogu tymczasowego, nie do Settings/ użytkownika.
import json
import os
import subprocess
import shutil
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


_TMP = tempfile.mkdtemp(prefix="rf-synth-")
rf.SYNTH_FILE = os.path.join(_TMP, "ribbitflip_synth.json")


def wipe():
    try:
        os.remove(rf.SYNTH_FILE)
    except OSError:
        pass


def raw_doc():
    with open(rf.SYNTH_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


# Stan w kształcie, w jakim przysyła go przeglądarka (`padState`). Serwer go NIE rozumie i o to
# chodzi — musi przejść tam i z powrotem bez jednego zgubionego pola.
STATE = {
    "_v": 5, "enabled": True, "configName": "Ambient pad",
    "pads": [{"id": "p1", "name": "Bas", "sound": "bass", "vol": 70,
              "dev": {"d0": {"on": True, "axX": "roll", "axY": "pitch", "range": 45, "drag": 30}},
              "gate": {"conds": [], "rhythm": {"on": False, "type": "rhythm-8", "bpm": 120}}}],
    "customSounds": {"moja": {"name": "Moja", "emoji": "🎛", "patch": {"wave": "square"}}},
    "baseOverrides": {"ribbit": {"name": "Żaba Kumaka"}},
    "fxPads": [],
}
SCENE = {k: v for k, v in STATE.items() if k not in ("enabled", "configName")}

try:
    print("\n--- stan: plik, którego jeszcze nie ma ---")
    wipe()
    # „Nie ma pliku" jest ODPOWIEDZIĄ, nie błędem: przeglądarka sięga wtedy do swojej kopii
    # i jednorazowo ją tu wypycha (migracja). Wyjątek na tym miejscu wywróciłby cały start panelu.
    check("brak pliku = brak stanu (None, nie wyjątek)", rf.load_synth_state() is None)
    check("brak pliku = pusta lista scen", rf.load_synth_scenes() == [])

    print("\n--- stan: tam i z powrotem, bez jednego zgubionego pola ---")
    ok, err = rf.save_synth_state(STATE)
    check("zapis stanu przyjęty", ok and err is None, err)
    got = rf.load_synth_state()
    check("stan wraca IDENTYCZNY (serwer do środka nie zagląda)", got == STATE,
          json.dumps(got, ensure_ascii=False)[:200])
    check("polskie znaki i emoji przeżyły podróż",
          got["baseOverrides"]["ribbit"]["name"] == "Żaba Kumaka"
          and got["customSounds"]["moja"]["emoji"] == "🎛")
    check("mapa kapsli przeżyła podróż", got["pads"][0]["dev"]["d0"]["axY"] == "pitch")

    print("\n--- stan: zapis atomowy ---")
    # `tmp` + `os.replace`, jak każdy inny plik ustawień: przerwany zapis nie ma prawa zostawić
    # połowy pliku, bo to jest jedyna kopia brzmień, które ktoś układał godzinę.
    leftovers = [f for f in os.listdir(_TMP) if f.endswith(".tmp")]
    check("po zapisie nie zostaje plik tymczasowy", leftovers == [], leftovers)
    check("plik na dysku jest poprawnym JSON-em", isinstance(raw_doc(), dict))

    print("\n--- stan: koperta, czyli jedyne, czego serwer pilnuje ---")
    ok, err = rf.save_synth_state("to nie jest slownik")
    check("tekst zamiast stanu odrzucony", not ok)
    check("…i odmowa jest zdaniem, nie kodem", isinstance(err, str) and len(err) > 10, err)
    ok, err = rf.save_synth_state(None)
    check("brak stanu odrzucony", not ok and isinstance(err, str))
    check("odrzucony zapis NIE ruszył tego, co było", rf.load_synth_state() == STATE)

    big = {"pads": [{"id": "p%d" % i, "name": "x" * 400} for i in range(3000)]}
    ok, err = rf.save_synth_state(big)
    check("stan ponad limit odrzucony", not ok)
    check("…a odmowa mówi, ILE się mieści", err and str(rf.SYNTH_STATE_MAX_BYTES) in err, err)
    check("odrzucony przerost NIE ruszył tego, co było", rf.load_synth_state() == STATE)
    check("limit ten sam, co przy /rest/config", rf.SYNTH_STATE_MAX_BYTES == 500_000)

    print("\n--- sceny: zapisz, znajdź, podmień w miejscu ---")
    ok, err, scenes = rf.synth_scene_put("Ambient pad", SCENE)
    check("scena zapisana", ok and err is None, err)
    check("…i jest na liście", [s["name"] for s in scenes] == ["Ambient pad"])
    check("scena wraca z TREŚCIĄ, nie samą nazwą", scenes[0]["state"] == SCENE)

    rf.synth_scene_put("Perkusja dwóch kapsli", {"pads": [{"id": "p1"}, {"id": "p2"}]})
    names = [s["name"] for s in rf.load_synth_scenes()]
    check("druga scena dopisana na koniec", names == ["Ambient pad", "Perkusja dwóch kapsli"], names)

    # Podmiana W MIEJSCU, nie dopisanie na koniec: scena zapisana drugi raz pod tą samą nazwą to
    # ta sama scena, a przesunięcie jej na koniec przetasowałoby listę, którą ktoś właśnie czyta.
    rf.synth_scene_put("Ambient pad", {"pads": [{"id": "zmieniony"}]})
    lst = rf.load_synth_scenes()
    check("nadpisanie NIE przestawia kolejności",
          [s["name"] for s in lst] == ["Ambient pad", "Perkusja dwóch kapsli"])
    check("…i naprawdę podmienia treść", lst[0]["state"]["pads"][0]["id"] == "zmieniony")

    print("\n--- sceny: co znaczy „ta sama scena” ---")
    # Wielkość liter i zbłąkane spacje nie znaczą nic. Lista z „Ambient pad" i „ambient  pad"
    # to lista, w której wybór jest rzutem monetą.
    rf.synth_scene_put("  ambient   PAD  ", {"pads": [{"id": "casefold"}]})
    lst = rf.load_synth_scenes()
    check("„ambient PAD” to ta sama scena, co „Ambient pad”", len(lst) == 2,
          [s["name"] for s in lst])
    check("…i to ONA jest teraz treścią", lst[0]["state"]["pads"][0]["id"] == "casefold")
    check("nazwa zapisana tak, jak ją wpisano (spacje zwinięte)", lst[0]["name"] == "ambient PAD",
          lst[0]["name"])

    print("\n--- sceny: koperta ---")
    ok, err, _ = rf.synth_scene_put("", SCENE)
    check("scena bez nazwy odrzucona", not ok and isinstance(err, str))
    ok, err, _ = rf.synth_scene_put("   ", SCENE)
    check("sama spacja to nie nazwa", not ok)
    ok, err, _ = rf.synth_scene_put(123, SCENE)
    check("liczba to nie nazwa", not ok)
    ok, err, _ = rf.synth_scene_put("Bez treści", "nie slownik")
    check("scena bez stanu odrzucona", not ok and isinstance(err, str))
    ok, err, _ = rf.synth_scene_put("Za duża", big)
    check("scena ponad limit odrzucona", not ok and str(rf.SYNTH_STATE_MAX_BYTES) in (err or ""))
    check("żadna z odmów niczego nie dopisała", len(rf.load_synth_scenes()) == 2)

    long_name = "S" * 90
    rf.synth_scene_put(long_name, {"pads": []})
    got_names = [s["name"] for s in rf.load_synth_scenes()]
    check("nazwa przycięta do 40 znaków", len(got_names[-1]) == rf.SYNTH_SCENE_NAME_MAX,
          got_names[-1])

    print("\n--- sceny: sufit ---")
    for i in range(rf.SYNTH_SCENE_MAX):
        rf.synth_scene_put("Scena %02d" % i, {"pads": [{"id": "p%d" % i}]})
    lst = rf.load_synth_scenes()
    check("lista nie przekracza sufitu", len(lst) == rf.SYNTH_SCENE_MAX, len(lst))
    ok, err, _ = rf.synth_scene_put("Jeszcze jedna", {"pads": []})
    check("scena ponad sufit odrzucona", not ok)
    check("…a odmowa mówi, ile ich się mieści", err and str(rf.SYNTH_SCENE_MAX) in err, err)
    # Nadpisanie ISTNIEJĄCEJ przy pełnej liście MUSI przejść: sufit dotyczy dodawania nowych,
    # a nie poprawiania tego, co już jest.
    ok, err, _ = rf.synth_scene_put("Scena 00", {"pads": [{"id": "poprawione"}]})
    check("nadpisanie przy pełnej liście przechodzi", ok, err)

    print("\n--- sceny: usuwanie ---")
    before = len(rf.load_synth_scenes())
    lst = rf.synth_scene_drop("scena 01")          # inna wielkość liter — ta sama scena
    check("usunięta mimo innej wielkości liter", len(lst) == before - 1)
    check("…i nie ma jej na liście", "Scena 01" not in [s["name"] for s in lst])
    lst = rf.synth_scene_drop("Nigdy takiej nie było")
    # Nazwa, której nikt nie ma, nie jest błędem — odpowiedzią jest lista, a lista już mówi,
    # że tego tam nie ma.
    check("usuwanie nieistniejącej to nie błąd", len(lst) == before - 1)

    print("\n--- jeden plik, dwie rzeczy: żadna nie gubi drugiej ---")
    wipe()
    rf.save_synth_state(STATE)
    rf.synth_scene_put("Ambient pad", SCENE)
    check("zapis sceny NIE zgubił stanu", rf.load_synth_state() == STATE)
    # …i w drugą stronę. To jest ten cichy: stan leci przy każdym ruchu suwaka, więc gdyby
    # nadpisywał cały plik, sceny znikałyby przy pierwszym dotknięciu pokrętła.
    rf.save_synth_state({"_v": 5, "pads": [{"id": "inny"}]})
    check("zapis stanu NIE zgubił scen", len(rf.load_synth_scenes()) == 1)
    check("…i stan naprawdę się zmienił", rf.load_synth_state()["pads"][0]["id"] == "inny")
    rf.synth_scene_drop("Ambient pad")
    check("usunięcie sceny NIE zgubiło stanu", rf.load_synth_state()["pads"][0]["id"] == "inny")

    print("\n--- plik zastany: sprzed tej zmiany, uszkodzony, ręcznie sklejony ---")
    # Plik zapisany przez wersję, która znała tylko stan. Sceny mają się z niego przeczytać jako
    # pusta lista, a nie jako błąd — i pierwsza zapisana scena ma go dopisać, nie zastąpić.
    wipe()
    with open(rf.SYNTH_FILE, "w", encoding="utf-8") as f:
        json.dump({"state": STATE}, f, ensure_ascii=False)
    check("plik bez `scenes` czyta się jako brak scen", rf.load_synth_scenes() == [])
    check("…a stan z niego jest normalnie widoczny", rf.load_synth_state() == STATE)
    rf.synth_scene_put("Pierwsza", SCENE)
    check("dopisana scena nie zdmuchnęła stanu", rf.load_synth_state() == STATE)

    # Plik przerobiony ręcznie w bzdurę. To jest wygoda, a nie dane — utrata panelu kosztowałaby
    # więcej niż utrata jednej sceny, więc czyta się to jako pusto.
    for junk in ("{to nie jest json", "[]", '"tekst"', "12"):
        with open(rf.SYNTH_FILE, "w", encoding="utf-8") as f:
            f.write(junk)
        check("zepsuty plik (%s) = pusto, nie wyjątek" % junk[:14],
              rf.load_synth_state() is None and rf.load_synth_scenes() == [])

    # Ręcznie sklejony z dwóch: wiersze bez nazwy albo bez stanu wypadają, druga kopia tej samej
    # nazwy nie ma jak wygrać (lista z dwiema „Ambient pad" to lista, w której wybór jest losowy).
    with open(rf.SYNTH_FILE, "w", encoding="utf-8") as f:
        json.dump({"scenes": [
            {"name": "Dobra", "state": {"pads": []}},
            {"name": "", "state": {"pads": []}},
            {"name": "Bez stanu"},
            {"name": "Stan tekstem", "state": "nie slownik"},
            "wcale nie wiersz",
            {"name": "dobra", "state": {"pads": [{"id": "duplikat"}]}},
        ]}, f, ensure_ascii=False)
    lst = rf.load_synth_scenes()
    check("z ręcznie sklejonego pliku zostaje tylko to, co jest sceną",
          [s["name"] for s in lst] == ["Dobra"], [s["name"] for s in lst])
    check("…a druga kopia tej samej nazwy nie wygrywa",
          lst[0]["state"] == {"pads": []}, lst[0]["state"])

    # ---- PRÓBKI BRZMIEŃ: bajty nagrań w Library/Probki/ (2026-10-19) --------------------------
    # Jedyne trasy tej aplikacji, które przyjmują BAJTY, a nie konfigurację — i jedyne, które
    # zaglądają do treści. Ścieżka powstaje z identyfikatora przysłanego przez przeglądarkę,
    # więc to jest miejsce, w którym „id" z `..` byłoby zapisem w dowolnym punkcie dysku.
    print("\n--- próbki: ścieżka, nagłówek WAV, zapis i sprzątanie ---")
    rf.SAMPLE_DIR = os.path.join(_TMP, "Probki")

    def wav(sek=0.05, sr=32000, kanaly=1, bity=16, fmt=1):
        n = int(sr * sek)
        dane = b"".join(int(16000 * ((i * 220.0 / sr) % 1 * 2 - 1)).to_bytes(2, "little", signed=True)
                        for i in range(n))
        blok = kanaly * bity // 8
        head = (b"RIFF" + (36 + len(dane)).to_bytes(4, "little") + b"WAVE"
                + b"fmt " + (16).to_bytes(4, "little") + fmt.to_bytes(2, "little")
                + kanaly.to_bytes(2, "little") + sr.to_bytes(4, "little")
                + (sr * blok).to_bytes(4, "little") + blok.to_bytes(2, "little") + bity.to_bytes(2, "little")
                + b"data" + len(dane).to_bytes(4, "little"))
        return head + dane

    for zly in ["", "probka", "s-", "s-ABC", "s-a/../b", "s-" + "a" * 17, "../ribbitflip.log", None, 7]:
        check("ścieżka: „%s” nie jest identyfikatorem próbki" % zly, rf._sample_path(zly) is None)
    sciezka = rf._sample_path("s-abc123")
    check("ścieżka: poprawny identyfikator trafia do Library/Probki/",
          sciezka and os.path.dirname(sciezka) == os.path.realpath(rf.SAMPLE_DIR), sciezka)

    ok, err = rf.sample_write("s-abc123", wav())
    check("zapis: poprawny WAV przyjęty", ok and err is None, err)
    check("zapis: plik leży pod swoim identyfikatorem", os.path.exists(sciezka))
    check("zapis: po zapisie nie zostaje plik tymczasowy",
          [f for f in os.listdir(rf.SAMPLE_DIR) if f.endswith(".tmp")] == [])
    check("odczyt: bajty wracają identyczne", rf.sample_read("s-abc123") == wav())
    check("lista: widać zapisaną próbkę", rf.sample_ids() == ["s-abc123"], rf.sample_ids())

    # Serwer czyta NAGŁÓWEK, nie rozszerzenie: katalog biblioteki nie jest miejscem, w którym przez
    # przeglądarkę da się położyć dowolny plik.
    for nazwa, bajty in [("nie WAV", b"<html>a tu niespodzianka</html>" + b"x" * 40),
                         ("pusty", b""),
                         ("stereo", wav(kanaly=2)),
                         ("8-bit", wav(bity=8)),
                         ("nie PCM (float)", wav(fmt=3)),
                         ("za duży", wav(sek=40))]:
        ok2, err2 = rf.sample_write("s-zly1", bajty)
        check("zapis: %s odrzucony ze zdaniem" % nazwa, not ok2 and isinstance(err2, str) and err2, err2)
    check("zapis: odrzucone bajty nie zostawiają pliku", "s-zly1" not in rf.sample_ids(), rf.sample_ids())
    ok3, err3 = rf.sample_write("s-a/../b", wav())
    check("zapis: identyfikator ze ścieżką odrzucony", not ok3 and isinstance(err3, str), err3)

    rf.sample_write("s-druga", wav())
    check("sprzątanie: próbka z listy „żywych” zostaje, reszta znika",
          rf.sample_sweep(["s-druga"]) == 1 and rf.sample_ids() == ["s-druga"], rf.sample_ids())
    # Pusta lista znaczy „żadne brzmienie nie ma już próbki” — inaczej skasowanie ostatniego
    # brzmienia z próbką zostawiałoby plik na zawsze. Kompletności listy pilnuje strona, która ją
    # składa (`PadSampler.sweep` odmawia, dopóki nie wie, co leży na serwerze) — patrz harness niżej.
    check("sprzątanie: pusta lista opróżnia katalog",
          rf.sample_sweep([]) == 1 and rf.sample_ids() == [], rf.sample_ids())
    check("usuwanie: próbki, której nie ma, nie da się usunąć (i nie jest to wyjątek)",
          rf.sample_drop("s-niema") is False and rf.sample_drop("s-a/../b") is False)

    print("\n--- panel: próbka w patchu, tempo odtwarzania, formularz (Node) ---")
    harness = os.path.join(os.path.dirname(os.path.abspath(__file__)), "synth_probki_harness.mjs")
    p, out = None, None
    try:
        p = subprocess.run(["node", harness], capture_output=True, text=True, encoding="utf-8", timeout=60)
        out = json.loads((p.stdout or "").strip().splitlines()[-1])
    except (OSError, ValueError, IndexError, subprocess.SubprocessError) as e:
        print("POMINIETO  próbki (Node): %s" % e)
    if out is None and p is not None:
        check("harness próbek wystartował", False, (p.stderr or p.stdout or "")[-300:])
    for nm, ok4, detail in (out or {}).get("checks", []):
        check(nm, ok4, detail)

    print("\n--- panel: odcisk sceny i przełącznik (Node) ---")
    harness = os.path.join(os.path.dirname(os.path.abspath(__file__)), "synth_scenes_harness.mjs")
    try:
        p = subprocess.run(["node", harness], capture_output=True, text=True,
                           encoding="utf-8", timeout=60)
        out = json.loads((p.stdout or "").strip().splitlines()[-1]) if p.returncode == 0 else None
    except (OSError, ValueError, IndexError, subprocess.SubprocessError) as e:
        p, out = None, None
        print("POMINIETO  panel (Node): %s" % e)
    if out is None and p is not None:
        check("harness panelu wystartował", False, (p.stderr or p.stdout or "")[-300:])
    for nm, ok, detail in (out or {}).get("checks", []):
        check(nm, ok, detail)

    # 4. FALA WŁASNA Z OSCYLOSKOPU (rf-25c, 2026-10-02) — nowy klucz patcha `wt` (64 próbki) przechodzi przez
    #    sanitizePatch i obieg zapisu, a stare brzmienia zostają bajt w bajt (inaczej zmienia się odcisk sceny).
    #    Harness kończy się kodem 1 przy porażce, więc JSON czytamy niezależnie od kodu — chcemy NAZWY porażek.
    print("\n--- panel: fala własna z oscyloskopu (Node) ---")
    harness = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sound_screens_harness.mjs")
    p, out = None, None
    try:
        p = subprocess.run(["node", harness], capture_output=True, text=True,
                           encoding="utf-8", timeout=60)
        out = json.loads((p.stdout or "").strip().splitlines()[-1])
    except (OSError, ValueError, IndexError, subprocess.SubprocessError) as e:
        if p is None:
            print("POMINIETO  oscyloskop (Node): %s" % e)
        else:   # node ruszył, ale nie oddał JSON-a (błąd składni, wyjątek przy wczytaniu)
            check("harness oscyloskopu wystartował", False, (p.stderr or p.stdout or "")[-300:])
    for nm, ok, detail in (out or {}).get("checks", []):
        check(nm, ok, detail)

    # 5. BIBLIOTEKA BRZMIEŃ BAZOWYCH I LOSOWANIE (rf-17 + rf-25, 2026-10-02) — 12 nowych brzmień bazowych na fali
    #    własnej / korektorze / krzywiznach obwiedni: już w postaci zapisu (sanitizePatch nic nie zmienia), stare 23
    #    bajt w bajt jak w kopii sprzed zmiany; „Zaskocz mnie” i kostki modułów dają poprawne, grywalne patche.
    print("\n--- panel: biblioteka brzmień i losowanie (Node) ---")
    harness = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sound_library_harness.mjs")
    p, out = None, None
    try:
        p = subprocess.run(["node", harness], capture_output=True, text=True,
                           encoding="utf-8", timeout=60)
        out = json.loads((p.stdout or "").strip().splitlines()[-1])
    except (OSError, ValueError, IndexError, subprocess.SubprocessError) as e:
        if p is None:
            print("POMINIETO  biblioteka brzmień (Node): %s" % e)
        else:   # node ruszył, ale nie oddał JSON-a (błąd składni, wyjątek przy wczytaniu)
            check("harness biblioteki brzmień wystartował", False, (p.stderr or p.stdout or "")[-300:])
    for nm, ok, detail in (out or {}).get("checks", []):
        check(nm, ok, detail)

    # 6. EDYTOR JAKO „RACK” (rf-25d, 2026-10-02) — kropka „niezapisane zmiany” na prawdziwym formularzu i prawdziwych
    #    funkcjach rf-25 (żadne z 35 brzmień bazowych nie zapala jej samym wczytaniem), plakietka rodzaju, szukanie bez
    #    polskich znaków, szybki odsłuch na busie laba i układ edytora w dashboardzie.
    print("\n--- panel: edytor brzmień jako rack (Node) ---")
    harness = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sound_rack_harness.mjs")
    p, out = None, None
    try:
        p = subprocess.run(["node", harness], capture_output=True, text=True,
                           encoding="utf-8", timeout=60)
        out = json.loads((p.stdout or "").strip().splitlines()[-1])
    except (OSError, ValueError, IndexError, subprocess.SubprocessError) as e:
        if p is None:
            print("POMINIETO  rack edytora (Node): %s" % e)
        else:   # node ruszył, ale nie oddał JSON-a (błąd składni, wyjątek przy wczytaniu)
            check("harness racka edytora wystartował", False, (p.stderr or p.stdout or "")[-300:])
    for nm, ok, detail in (out or {}).get("checks", []):
        check(nm, ok, detail)

    # 7. PŁASKIE EDYTORY KRZYWYCH (rf-25e, etap E6, 2026-10-02) — stan edycji, narzędzia i patch I/O przeniesione 1:1
    #    z lampy oscyloskopu na trzy panele w kartach modułów: fala z interpolacją i słupkami, pasma korektora, uchwyty
    #    obwiedni na suwakach, mapowanie obraz ↔ canvas, analiza dźwięku laba, rama z obszyciem i montaż w DOM-ie.
    print("\n--- panel: płaskie edytory krzywych (Node) ---")
    harness = os.path.join(os.path.dirname(os.path.abspath(__file__)), "curve_editors_harness.mjs")
    p, out = None, None
    try:
        p = subprocess.run(["node", harness], capture_output=True, text=True,
                           encoding="utf-8", timeout=60)
        out = json.loads((p.stdout or "").strip().splitlines()[-1])
    except (OSError, ValueError, IndexError, subprocess.SubprocessError) as e:
        if p is None:
            print("POMINIETO  edytory krzywych (Node): %s" % e)
        else:   # node ruszył, ale nie oddał JSON-a (błąd składni, wyjątek przy wczytaniu)
            check("harness edytorów krzywych wystartował", False, (p.stderr or p.stdout or "")[-300:])
    for nm, ok, detail in (out or {}).get("checks", []):
        check(nm, ok, detail)

finally:
    shutil.rmtree(_TMP, ignore_errors=True)

print("\n%d PASS / %d FAIL" % (_passed, _failed))
sys.exit(1 if _failed else 0)
