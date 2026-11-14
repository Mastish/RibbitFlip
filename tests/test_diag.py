# Test of "ZGLOS PROBLEM" — the diagnostic bundle. Run: py tests/test_diag.py
#
# This feature has exactly one way to fail badly, and it is not "the zip was empty". It is
# "the zip went to a public forum with somebody's cookies in it". So the test is built as an
# ATTACK on the allowlist: the fake Settings/ below is stuffed with everything that must never
# travel, and then the bundle is searched for it.
#
# What is planted, and what it stands for:
#
#   * Settings/OverlayBrowser/d0/Cookies (1 MB) + Login Data — the overlay windows keep a FULL
#     browser profile there. In the real repo it is 919 MB. A bundle built as "zip Settings/,
#     minus a few things" ships it the day somebody adds a folder to the skip list and forgets.
#   * ribbitflip_rest_vault.json — the encrypted vault. Encrypted is not "safe to publish":
#     a blob plus a forum thread about the password is a worse day than a lost token.
#   * ribbitflip_rest.json with a Discord webhook (the URL *is* the token), a secret in `vars`
#     and an Authorization header. This file is plain JSON by design and people paste secrets
#     into it anyway — that is exactly why it travels redacted rather than verbatim.
#   * ribbitflip.log with C:\Users\JanTester\... — the account name is personal data, and it
#     is in every absolute path of every log line.
#
# The assertions grep the DECOMPRESSED CONTENT of the zip, not the file list: a redaction that
# hides a token in one field and leaves it in another passes a name check and fails this one.
#
# Nothing here touches the real Settings/ — everything happens in a temp folder that is removed
# at the end, and no server is started.
import io
import json
import os
import shutil
import sys
import tempfile
import zipfile

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


# --- the planted secrets ---------------------------------------------------------------------
# Long, URL-safe and unmistakable: if any of these strings survives into the bundle, the grep
# below finds it, and there is no ambiguity about which redaction failed.
WEBHOOK_TOKEN = "aB3dEf7GhIjKlMnOpQrStUvWxYz0123456789abcdefGHIJKLMNOPqrstuvwx"
VAR_SECRET = "SEKRET_ZMIENNEJ_9f8e7d6c5b4a3210zzz"
AUTH_SECRET = "Bearer TAJNY_TOKEN_AUTORYZACJI_0011223344"
LOG_TOKEN = "LOGOWY_TOKEN_abcdefghijklmnopqrstuvwxyz01"
USER_NAME = "JanTester"
# The capsule's Bluetooth address. Not a secret like the ones above — it is a stable
# hardware id for ONE person's puck, which is worse in a file built to be attached to a
# public forum post. The first three octets are the vendor and stay: that half is the only
# one anybody reading a pairing problem uses.
BLE_MAC = "02:AB:CD:12:34:56"
BLE_MAC_MASKED = "02:AB:CD:••:••:••"


def _w(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def _wj(path, obj):
    _w(path, json.dumps(obj, ensure_ascii=False, indent=2))


def _fabricate(root):
    """A Settings/ folder that looks like a real one, with every landmine in place."""
    s = os.path.join(root, "Settings")

    # 1. the browser profile — the big one, and the one that must never be in the bundle
    ob = os.path.join(s, "OverlayBrowser", "d0")
    os.makedirs(ob, exist_ok=True)
    with open(os.path.join(ob, "Cookies"), "wb") as f:
        f.write(b"CIASTECZKA" * 104858)          # ~1 MB, compressible on purpose (see assertion g)
    _w(os.path.join(ob, "Login Data"), "haslo=" + AUTH_SECRET)

    # 2. the vault
    _wj(os.path.join(s, "ribbitflip_rest_vault.json"),
        {"v": 1, "iter": 310000, "salt": "c2FsdA==", "iv": "aXY=", "data": "ZGFuZQ==" * 20})

    # 3. the plain REST config, with three different kinds of secret in it
    _wj(os.path.join(s, "ribbitflip_rest.json"), {
        "v": 2, "enabled": True,
        "vars": {"mojToken": VAR_SECRET, "kanal": "ogolny"},
        "apis": [{
            "id": "aDsc", "name": "Discord",
            "baseUrl": "https://discord.com/api/webhooks/1540416138704457820/" + WEBHOOK_TOKEN,
            "headers": [["Authorization", AUTH_SECRET], ["Content-Type", "application/json"]],
            "actions": [{"id": "x1", "name": "Wyslij na kanal", "method": "POST",
                         "path": "/webhooks/1540416138704457820/" + WEBHOOK_TOKEN,
                         "query": [["wait", "true"]],
                         "body": "{\"content\":\"czesc\"}"}],
        }],
        "settings": {"keepUnlockedForSend": True},
    })

    # 4. the send log — one line with a token in the url, one unparseable
    _w(os.path.join(s, "ribbitflip_rest_log.jsonl"),
       json.dumps({"_meta": {"app": "ribbitflip", "kind": "rest-log", "v": 1}}) + "\n"
       + json.dumps({"t": 1785927953025, "apiName": "Discord", "actionName": "Wyslij na kanal",
                     "url": "https://discord.com/api/webhooks/1/" + WEBHOOK_TOKEN,
                     "ok": True, "seq": 2}) + "\n"
       + "to nie jest JSON\n")

    # 5. the ordinary config files — the whole allowlist, so (f) can prove none went missing
    _wj(os.path.join(s, "ribbitflip_rules.json"),
        {"enabled": True, "activeLayer": 2, "rules": [{"id": "r1"}, {"id": "r2"}, {"id": "r3"}]})
    _wj(os.path.join(s, "ribbitflip_mouse.json"), {"enabled": True, "mode": "speed"})
    _wj(os.path.join(s, "ribbitflip_pose.json"), {"axes": {}})
    _wj(os.path.join(s, "ribbitflip_power.json"), {"autoSleep": False})
    _wj(os.path.join(s, "ribbitflip_midi.json"), {"enabled": False, "oscEnabled": True})
    _wj(os.path.join(s, "ribbitflip_wheel.json"), {"enabled": True, "holdMs": 200})
    for name, obj in (("ribbitflip_devices.json",
                       {"d0": {"name": "Triki", "addr": BLE_MAC}}),
                      ("ribbitflip_pads.json", {"pads": []}),
                      ("ribbitflip_dsu.json", {"enabled": False}),
                      ("ribbitflip_midi_global.json", {"port": ""}),
                      ("ribbitflip_overlay.json", {"windows": {}}),
                      ("ribbitflip_ui.json", {"lang": "pl"}),
                      ("ribbitflip_mcp.json", {"enabled": False}),
                      ("ribbitflip_gameswitch.json", {"enabled": True,
                                                      "defaults": {"eldenring.exe":
                                                                   {"kind": "setup",
                                                                    "name": "Elden"}}}),
                      ("ribbitflip_hotkey.json", {"enabled": True, "combo": "alt+r+f"})):
        _wj(os.path.join(s, name), obj)
    # a second slot, in its own subfolder
    _wj(os.path.join(s, "d1", "ribbitflip_rules.json"),
        {"enabled": False, "activeLayer": 1, "rules": [{"id": "q1"}]})
    _wj(os.path.join(s, "d1", "ribbitflip_mouse.json"), {"enabled": False})

    # 6. the windowed-build log, full of the user's home directory
    _w(os.path.join(root, "ribbitflip.log"),
       "[start] plik: C:\\Users\\%s\\AppData\\RibbitFlip\\x.json\n"
       "[rest] wyslano na https://api.example.com/v1/%s\n"
       "[sciezka] C:/Users/%s/Downloads/zestaw.json\n" % (USER_NAME, LOG_TOKEN, USER_NAME))

    # 7. a library, to prove only NAMES travel
    _wj(os.path.join(root, "Library", "Setups", "Elden.json"),
        {"rules": [{"id": "tajna-regula-z-zestawu"}]})
    return s


# ============================================================== build it =======================
print("--- building a bundle from a fabricated Settings/ ---")
tmp = tempfile.mkdtemp(prefix="rf-diag-test-")
try:
    settings = _fabricate(tmp)
    out = os.path.join(tmp, "Zgloszenia", "RibbitFlip-zgloszenie-test.zip")
    res = rf.build_diag_report(settings, tmp, out,
                               {"master": False, "urzadzenia": [], "obs": {"connected": False}})
    check("build_diag_report zwraca ok", res.get("ok") is True, res)
    check("...i wskazuje plik, ktory istnieje", os.path.isfile(out), out)

    # (h) the zip opens at all
    try:
        with zipfile.ZipFile(out) as z:
            names = z.namelist()
            bad = z.testzip()
            blobs = {n: z.read(n) for n in names}
        check("h. zip otwiera sie i nie ma uszkodzonych wpisow", bad is None, bad)
    except Exception as e:
        check("h. zip otwiera sie i nie ma uszkodzonych wpisow", False, e)
        raise

    whole = b"\n".join(blobs.values())          # every byte the user would be attaching
    txt = whole.decode("utf-8", errors="replace")

    # ---------------------------------------------------------------- a. nothing forbidden ----
    print("\n--- a. co NIE moze byc w paczce ---")
    check("a1. ani jednego pliku z OverlayBrowser",
          not [n for n in names if "overlaybrowser" in n.lower()], names)
    check("a2. ani sladu po pliku Cookies / Login Data",
          not [n for n in names if os.path.basename(n) in ("Cookies", "Login Data")], names)
    check("a3. sejf nie jedzie",
          not [n for n in names if "vault" in n.lower()], names)
    check("a4. ...ani jego zawartosc", "ZGFuZQ==" not in txt)
    check("a5. tresc zestawow zostaje w bibliotece",
          "tajna-regula-z-zestawu" not in txt)
    check("a6. adres BLE kapsla nie jedzie w calosci", BLE_MAC not in txt)
    dev_name = "Settings/ribbitflip_devices.json"
    dev_txt = blobs.get(dev_name, b"").decode("utf-8")
    check("a7. ...tylko z zamaskowana druga polowa", BLE_MAC_MASKED in dev_txt, dev_txt)
    try:
        dev_obj = json.loads(dev_txt)
        check("a8. ...a plik dalej jest poprawnym JSON-em", True)
    except Exception as e:
        dev_obj = {}
        check("a8. ...a plik dalej jest poprawnym JSON-em", False, e)
    check("a9. reszta pliku jedzie bez zmian",
          dev_obj.get("d0", {}).get("name") == "Triki", dev_obj)
    check("a10. maskowana jest KOPIA — plik na dysku nietkniety",
          BLE_MAC in io.open(os.path.join(settings, "ribbitflip_devices.json"),
                             encoding="utf-8").read())

    # ---------------------------------------------------------------- b. rest.json redacted ---
    print("\n--- b. ribbitflip_rest.json — zredagowany, ale czytelny ---")
    rest_name = "Settings/ribbitflip_rest.json"
    check("b0. plik jest w paczce", rest_name in names, names)
    rest_txt = blobs.get(rest_name, b"").decode("utf-8")
    rest_obj = json.loads(rest_txt)
    check("b1. token webhooka NIE wystepuje nigdzie w paczce", WEBHOOK_TOKEN not in txt)
    check("b2. wartosc z vars ukryta", VAR_SECRET not in txt)
    check("b3. ...i zastapiona miara dlugosci",
          rest_obj["vars"]["mojToken"].startswith("«ukryto:"), rest_obj["vars"])
    check("b4. nazwa zmiennej zostaje czytelna", "mojToken" in rest_obj["vars"])
    check("b5. naglowek Authorization ukryty", AUTH_SECRET not in txt)
    hdrs = dict(rest_obj["apis"][0]["headers"])
    check("b6. ...po NAZWIE, nie po wygladzie wartosci",
          hdrs["Authorization"].startswith("«ukryto:"), hdrs)
    check("b7. niewrazliwy naglowek zostaje bez zmian",
          hdrs.get("Content-Type") == "application/json", hdrs)
    check("b8. struktura i nazwy akcji przezywaja redakcje",
          rest_obj["apis"][0]["actions"][0]["name"] == "Wyslij na kanal", rest_obj["apis"])
    check("b9. widac, do jakiej uslugi szedl adres",
          "discord.com" in rest_obj["apis"][0]["baseUrl"], rest_obj["apis"][0]["baseUrl"])
    check("b10. ...ale token ze sciezki juz nie",
          "«ukryto:" in rest_obj["apis"][0]["actions"][0]["path"],
          rest_obj["apis"][0]["actions"][0]["path"])

    # ---------------------------------------------------------------- c. log, no account name -
    print("\n--- c. ribbitflip.log — ogon bez nazwy konta ---")
    check("c0. dziennik jest w paczce", "ribbitflip.log" in names, names)
    log_txt = blobs.get("ribbitflip.log", b"").decode("utf-8")
    check("c1. nazwa konta uzytkownika znikla", USER_NAME not in txt)
    check("c2. ...w obu wersjach ukosnikow",
          "C:\\Users\\…" in log_txt and "C:/Users/…" in log_txt, log_txt)
    check("c3. reszta wiersza zostaje czytelna", "AppData" in log_txt, log_txt)
    check("c4. token z dziennika tez zredagowany", LOG_TOKEN not in txt)

    # ---------------------------------------------------------------- d. rest log -------------
    print("\n--- d. ribbitflip_rest_log.jsonl — linia po linii ---")
    lg = "Settings/ribbitflip_rest_log.jsonl"
    check("d0. dziennik wysylek jest w paczce", lg in names, names)
    lines = [l for l in blobs.get(lg, b"").decode("utf-8").splitlines() if l.strip()]
    parsed = [json.loads(l) for l in lines]
    check("d1. kazda linia dalej jest poprawnym JSON-em", len(parsed) == 2, len(parsed))
    check("d2. linia nieparsowalna zostala pominieta",
          not [l for l in lines if "to nie jest JSON" in l], lines)
    entry = [p for p in parsed if p.get("seq") == 2][0]
    check("d3. token z url zredagowany", "«ukryto:" in entry["url"], entry["url"])
    check("d4. ...a nazwa akcji nie", entry["actionName"] == "Wyslij na kanal", entry)

    # ---------------------------------------------------------------- e. raport.json ----------
    print("\n--- e. raport.json ---")
    check("e0. raport jest w paczce", "raport.json" in names, names)
    rep = json.loads(blobs["raport.json"].decode("utf-8"))
    check("e1. niesie wersje aplikacji", rep.get("wersja") == rf.APP_VERSION, rep.get("wersja"))
    check("e2. mowi, czy to EXE czy skrypt", rep.get("tryb") in ("exe", "skrypt"), rep.get("tryb"))
    check("e3. niesie system i Pythona", bool(rep.get("system")) and bool(rep.get("python")), rep)
    check("e4. sejf opisany, nie zalaczony",
          rep["sejf"]["present"] is True and isinstance(rep["sejf"]["dataLen"], int), rep["sejf"])
    check("e5. liczy reguly slotu d0", rep["sloty"][0]["regul"] == 3, rep["sloty"])
    check("e6. ...i pamieta aktywna warstwe", rep["sloty"][0]["warstwa"] == 2, rep["sloty"])
    check("e7. widzi drugi slot", any(s["slot"] == "d1" for s in rep["sloty"]), rep["sloty"])
    check("e8. stan grup wyjscia jest w raporcie",
          rep["sloty"][0]["grupy"]["mapowanie"] is True
          and rep["sloty"][0]["grupy"]["mysz"] is True
          and rep["sloty"][0]["grupy"]["midi"] is False, rep["sloty"][0]["grupy"])
    check("e9. biblioteka to SAME NAZWY", rep["biblioteka"]["zestawy"] == ["Elden"],
          rep["biblioteka"])
    check("e10. sciezka aplikacji bez nazwy konta", USER_NAME not in json.dumps(rep))
    check("e11. raport mowi wprost, czego NIE zawiera", len(rep.get("wykluczono") or []) >= 3, rep)

    # ---------------------------------------------------------------- f. allowlist complete ---
    print("\n--- f. wszystkie pliki z allowlisty na miejscu ---")
    must = ["raport.json", "ribbitflip.log",
            "Settings/ribbitflip_rules.json", "Settings/ribbitflip_mouse.json",
            "Settings/ribbitflip_pose.json", "Settings/ribbitflip_power.json",
            "Settings/ribbitflip_midi.json", "Settings/ribbitflip_wheel.json",
            "Settings/ribbitflip_devices.json", "Settings/ribbitflip_pads.json",
            "Settings/ribbitflip_dsu.json", "Settings/ribbitflip_midi_global.json",
            "Settings/ribbitflip_overlay.json", "Settings/ribbitflip_ui.json",
            "Settings/ribbitflip_mcp.json", "Settings/ribbitflip_gameswitch.json",
            "Settings/ribbitflip_hotkey.json", "Settings/ribbitflip_rest.json",
            "Settings/ribbitflip_rest_log.jsonl",
            "Settings/d1/ribbitflip_rules.json", "Settings/d1/ribbitflip_mouse.json"]
    missing = [m for m in must if m not in names]
    check("f1. nic z listy nie wypadlo", not missing, missing)
    check("f2. w paczce nie ma NICZEGO spoza listy",
          not [n for n in names if n not in must], [n for n in names if n not in must])
    check("f3. plik konfiguracyjny jedzie doslownie",
          json.loads(blobs["Settings/ribbitflip_hotkey.json"].decode("utf-8"))["combo"]
          == "alt+r+f")

    # ---------------------------------------------------------------- g. size -----------------
    print("\n--- g. rozmiar ---")
    size = os.path.getsize(out)
    check("g1. paczka < 2 MB mimo 1 MB Cookies obok", size < 2 * 1024 * 1024, size)
    check("g2. ...bo Cookies zostaly na dysku",
          os.path.getsize(os.path.join(settings, "OverlayBrowser", "d0", "Cookies")) > 1000000)
    check("g3. sizeKB w odpowiedzi zgadza sie z plikiem",
          abs(res["sizeKB"] - size / 1024.0) < 1.0, (res["sizeKB"], size))
    check("g4. lista plikow w odpowiedzi == zawartosc zipu",
          sorted(res["files"]) == sorted(names), (res["files"], names))

    # ---------------------------------------------------------------- i. edge cases -----------
    print("\n--- i. przypadki brzegowe ---")
    empty = tempfile.mkdtemp(prefix="rf-diag-empty-")
    try:
        out2 = os.path.join(empty, "Zgloszenia", "pusta.zip")
        r2 = rf.build_diag_report(os.path.join(empty, "Settings"), empty, out2)
        check("i1. pusty katalog ustawien tez daje poprawna paczke", r2.get("ok") is True, r2)
        with zipfile.ZipFile(out2) as z:
            check("i2. ...z samym raportem w srodku", z.namelist() == ["raport.json"],
                  z.namelist())
    finally:
        shutil.rmtree(empty, ignore_errors=True)

    broken = tempfile.mkdtemp(prefix="rf-diag-broken-")
    try:
        _w(os.path.join(broken, "Settings", "ribbitflip_rest.json"),
           "{to nie jest JSON: " + WEBHOOK_TOKEN)
        out3 = os.path.join(broken, "Zgloszenia", "zepsuta.zip")
        rf.build_diag_report(os.path.join(broken, "Settings"), broken, out3)
        with zipfile.ZipFile(out3) as z:
            b3 = b"\n".join(z.read(n) for n in z.namelist())
        check("i3. nieparsowalny rest.json NIE jedzie surowy (token nie wycieka)",
              WEBHOOK_TOKEN.encode() not in b3, b3[:200])
    finally:
        shutil.rmtree(broken, ignore_errors=True)

    # the 20 MB brake: proven on the constant + the code path, not by fabricating 20 MB of files
    check("i4. jest twardy limit rozmiaru paczki",
          rf.DIAG_ZIP_MAX_BYTES == 20 * 1024 * 1024, rf.DIAG_ZIP_MAX_BYTES)
    big = tempfile.mkdtemp(prefix="rf-diag-big-")
    try:
        _saved = rf.DIAG_ZIP_MAX_BYTES
        rf.DIAG_ZIP_MAX_BYTES = 10          # 10 bytes: any real bundle trips it
        out4 = os.path.join(big, "Zgloszenia", "wielka.zip")
        raised = False
        try:
            rf.build_diag_report(os.path.join(big, "Settings"), big, out4)
        except Exception:
            raised = True
        check("i5. przekroczony limit przerywa budowanie", raised)
        check("i6. ...i nie zostawia pliku do wyslania", not os.path.exists(out4), out4)
    finally:
        rf.DIAG_ZIP_MAX_BYTES = _saved
        shutil.rmtree(big, ignore_errors=True)

    # ---------------------------------------------------------------- j. wiring ---------------
    print("\n--- j. podlaczenie ---")
    src = open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                            "ribbitflip_monitor.py"), "r", encoding="utf-8").read()
    check("j1. endpoint /diag/report istnieje", '"/diag/report"' in src)
    check("j2. endpoint /diag/open istnieje", '"/diag/open"' in src)
    check("j3. paczki lezą w katalogu Zgloszenia", rf.DIAG_DIR_NAME == "Zgloszenia",
          rf.DIAG_DIR_NAME)
    check("j4. OverlayBrowser nie figuruje w zadnej liscie plikow",
          not [x for x in (rf.DIAG_SLOT_FILES + rf.DIAG_GLOBAL_FILES)
               if "overlay" in x.lower() and "browser" in x.lower()])
    check("j5. sejf nie figuruje w allowliscie",
          not [x for x in (rf.DIAG_SLOT_FILES + rf.DIAG_GLOBAL_FILES) if "vault" in x.lower()])
    check("j6. endpointy stoja PRZED bramka slotu (dzialaja bez kapsla)",
          src.index('"/diag/report"')
          < src.index('d = self.dm.get(self._dev_id())   # target slot'))
    check("j7. dziennik aplikacji idzie przez redakcje, nie surowy",
          '_diag_scrub_log(txt)' in src)
finally:
    shutil.rmtree(tmp, ignore_errors=True)

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
