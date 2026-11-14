# Test of Settings/ribbitflip_ui.json — the file the PANEL remembers itself in. Run:
#   py tests/test_ui_tabs.py
#
# This file has exactly one way to fail badly, and the app shipped with it until 2026-08-26:
# save_ui_lang() wrote a literal {"lang": ...} over the whole file. While `lang` was the only key
# nobody noticed. The moment a second key moved in ("hiddenTabs" — which tabs the user folded away
# on the bar), a single click on the language toggle would have erased it, and the tabs would have
# come back on the next reload with no explanation on screen.
#
# So the first and loudest group below is exactly that: write both keys through the REAL functions,
# in both orders, and check that neither erases the other. The rest guards the properties that keep
# it that way — the write is atomic, a damaged file degrades to defaults instead of an exception,
# an old file with nothing but {"lang": "pl"} still reads, and the id list cannot be stuffed with
# rubbish by anything that gets to POST.
#
# Nothing here touches the real Settings/ — SETTINGS_DIR and UI_CONFIG_FILE are pointed at a temp
# folder for the duration and restored at the end. No server is started.
import json
import os
import shutil
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Konsola Windows bez UTF-8 (cp1250) wywraca print() na znakach spoza strony kodowej — nazwa
# jednego checka ma w sobie "ℹ", wiec plik uruchamiany przez wspolny runner przerywal sie
# w polowie z UnicodeEncodeError i reszta grup po prostu sie nie wykonywala. Wypisujemy z
# zamiana zamiast padac, dokladnie jak tests/test_i18n_dupes.py.
try:
    sys.stdout.reconfigure(errors="replace")
except Exception:
    pass
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


def _read_raw():
    """The file as it is ON DISK, parsed independently of the loaders under test."""
    with open(rf.UI_CONFIG_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _write_raw(text):
    os.makedirs(os.path.dirname(rf.UI_CONFIG_FILE), exist_ok=True)
    with open(rf.UI_CONFIG_FILE, "w", encoding="utf-8") as f:
        f.write(text)


def _wipe():
    try:
        os.remove(rf.UI_CONFIG_FILE)
    except OSError:
        pass


# --- redirect the module at a temp Settings/ ---------------------------------------------------
tmp = tempfile.mkdtemp(prefix="rf-uitabs-")
_saved = (rf.SETTINGS_DIR, rf.UI_CONFIG_FILE, dict(rf.UI_STATE))
_saved_tray = rf.tray_menu_refresh
rf.SETTINGS_DIR = os.path.join(tmp, "Settings")
rf.UI_CONFIG_FILE = os.path.join(rf.SETTINGS_DIR, "ribbitflip_ui.json")
# save_ui_lang() rebuilds the tray menu. There is no tray in a test, and its absence must not
# decide whether the SAVE happened — that is the thing being measured.
rf.tray_menu_refresh = lambda *a, **k: None

try:
    # ================================================================= a. THE MINE ==============
    # The regression this whole file exists for. Both directions, through the real functions the
    # endpoints call — not through a hand-built dict, because the bug WAS in those functions.
    print("--- a. jezyk nie kasuje zakladek (i odwrotnie) ---")
    _wipe()
    rf.UI_STATE["lang"] = "pl"

    rf.save_hidden_tabs(["midi", "osc", "pad"])
    check("a1. zakladki zapisane", rf.load_hidden_tabs() == ["midi", "osc", "pad"],
          rf.load_hidden_tabs())

    rf.save_ui_lang("en")                       # <- the click that used to erase everything
    check("a2. zmiana jezyka NIE kasuje ukrytych zakladek",
          rf.load_hidden_tabs() == ["midi", "osc", "pad"], _read_raw())
    check("a3. ...i jezyk faktycznie sie zapisal", rf.load_ui_lang() == "en", _read_raw())

    rf.save_ui_lang("pl")                       # and back — the other direction of the same click
    check("a4. powrot do polskiego tez nie kasuje zakladek",
          rf.load_hidden_tabs() == ["midi", "osc", "pad"], _read_raw())

    # the mirror case: a tab save must not lose the language
    rf.save_hidden_tabs(["restapi"])
    check("a5. zapis zakladek NIE kasuje jezyka", _read_raw().get("lang") == "pl", _read_raw())
    check("a6. ...i zakladki sie zmienily", rf.load_hidden_tabs() == ["restapi"],
          rf.load_hidden_tabs())

    # a key nobody has written yet: whatever moves into this file next must survive too
    rf.save_ui_config({"czegosTakiegoJeszczeNieMa": 7})
    rf.save_ui_lang("en")
    rf.save_hidden_tabs(["midi"])
    raw = _read_raw()
    check("a7. obcy klucz przezywa oba zapisy", raw.get("czegosTakiegoJeszczeNieMa") == 7, raw)
    check("a8. ...razem z jezykiem i zakladkami",
          raw.get("lang") == "en" and raw.get("hiddenTabs") == ["midi"], raw)
    rf.UI_STATE["lang"] = "pl"

    # ================================================================= b. atomic write ==========
    print("\n--- b. zapis atomowy ---")
    _wipe()
    rf.save_hidden_tabs(["midi"])
    check("b1. po zapisie nie zostaje plik tymczasowy",
          not os.path.exists(rf.UI_CONFIG_FILE + ".tmp"),
          os.listdir(rf.SETTINGS_DIR))
    check("b2. w katalogu lezy tylko docelowy plik",
          [x for x in os.listdir(rf.SETTINGS_DIR) if x.startswith("ribbitflip_ui")]
          == ["ribbitflip_ui.json"], os.listdir(rf.SETTINGS_DIR))

    # A serialisation that blows up mid-dump: the PREVIOUS file must still be there and readable.
    # That is the whole point of writing to a temp name and moving it into place — json.dump()
    # streams, so a plain open(..., "w") would already have truncated the real file by now.
    class _Boom:
        pass

    before = _read_raw()
    ok = rf.save_ui_config({"psujacy": _Boom()})       # not JSON-serialisable
    check("b3. nieudany zapis zglasza porazke", ok is False, ok)
    check("b4. ...i NIE niszczy poprzedniej tresci", _read_raw() == before, _read_raw())
    check("b5. ...i nie zostawia smiecia .tmp",
          not os.path.exists(rf.UI_CONFIG_FILE + ".tmp"), os.listdir(rf.SETTINGS_DIR))
    check("b6. kod uzywa os.replace, nie zwyklego zapisu",
          "os.replace(tmp, UI_CONFIG_FILE)" in open(
              os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                           "ribbitflip_monitor.py"), "r", encoding="utf-8").read())

    # ================================================================= c. sanitising ============
    print("\n--- c. sanityzacja listy zakladek ---")
    san = rf.sanitize_hidden_tabs
    check("c1. porzadna lista przechodzi", san(["midi", "osc"]) == ["midi", "osc"], san(["midi", "osc"]))
    check("c2. wielkie litery odrzucone", san(["MIDI"]) == [], san(["MIDI"]))
    check("c3. polskie znaki odrzucone", san(["polaczenie", "połączenie"]) == ["polaczenie"],
          san(["polaczenie", "połączenie"]))
    # the shapes that matter: anything that could end up inside the injected <script> block
    check("c4. znaki specjalne odrzucone",
          san(["a b", "a/b", "a.b", "a<b", '"x"', "</script>", "a'b", "a;b"]) == [],
          san(["a b", "a/b", "a.b", "a<b", '"x"', "</script>", "a'b", "a;b"]))
    check("c5. za dlugi id odrzucony (>24)", san(["x" * 25]) == [], san(["x" * 25]))
    check("c6. dokladnie 24 znaki przechodza", san(["x" * 24]) == ["x" * 24])
    check("c7. pusty string odrzucony", san([""]) == [], san([""]))
    check("c8. nie-stringi odrzucone", san([1, None, True, {"a": 1}, ["midi"]]) == [],
          san([1, None, True, {"a": 1}, ["midi"]]))
    check("c9. duplikaty zwiniete", san(["midi", "midi", "osc", "midi"]) == ["midi", "osc"],
          san(["midi", "midi", "osc", "midi"]))
    check("c10. spacje po bokach obcinane", san(["  midi  "]) == ["midi"], san(["  midi  "]))
    many = san(["t%02d" % i for i in range(80)])
    check("c11. lista przycieta do 32", len(many) == rf.UI_TABS_MAX == 32, len(many))
    check("c12. nie-lista to pusta lista",
          san(None) == [] and san("midi") == [] and san({"midi": True}) == [],
          (san(None), san("midi"), san({"midi": True})))
    check("c13. krotka tez jest lista", san(("midi",)) == ["midi"], san(("midi",)))
    # end to end: rubbish POSTed by anything must not reach the disk
    _wipe()
    rf.save_hidden_tabs(["midi", "MIDI", "a b", "midi", 5, "x" * 40, "osc"])
    check("c14. smieci nie docieraja na dysk", _read_raw().get("hiddenTabs") == ["midi", "osc"],
          _read_raw())
    check("c15. odczyt tez sanityzuje (plik ruszony recznie)",
          (_write_raw('{"lang":"pl","hiddenTabs":["midi","ZLE ID",7,"osc"]}')
           or rf.load_hidden_tabs()) == ["midi", "osc"], rf.load_hidden_tabs())

    # ================================================================= d. damaged file ==========
    print("\n--- d. uszkodzony plik ---")
    for label, text in (("d1", "{to nie jest json"), ("d2", ""), ("d3", "[1,2,3]"),
                        ("d4", "null"), ("d5", '"napis"')):
        _write_raw(text)
        check("%s. uszkodzona tresc -> domyslne, bez wyjatku" % label,
              rf.load_ui_config() == {} and rf.load_hidden_tabs() == []
              and rf.load_ui_lang() in ("pl", "en"), repr(text))
    _write_raw("{to nie jest json")
    rf.UI_STATE["lang"] = "pl"
    rf.save_hidden_tabs(["midi"])
    check("d6. zapis na uszkodzonym pliku odbudowuje go",
          _read_raw() == {"hiddenTabs": ["midi"]}, _read_raw())
    _wipe()
    check("d7. brak pliku -> domyslne",
          rf.load_ui_config() == {} and rf.load_hidden_tabs() == [], rf.UI_CONFIG_FILE)
    check("d8. brak pliku -> jezyk z systemu", rf.load_ui_lang() == rf.detect_system_lang())

    # ================================================================= e. backward compat =======
    # The file that is on every existing installation right now: one key, written by the old
    # whole-file save. It must read, and it must GAIN the new key instead of being replaced.
    print("\n--- e. zgodnosc wstecz (stary plik) ---")
    _write_raw('{\n  "lang": "en"\n}')
    check("e1. stary plik czyta sie poprawnie", rf.load_ui_lang() == "en", _read_raw())
    check("e2. ...i nie ma jeszcze zakladek", rf.load_hidden_tabs() == [], _read_raw())
    rf.UI_STATE["lang"] = "en"
    rf.save_hidden_tabs(["pad"])
    raw = _read_raw()
    check("e3. dopisanie zakladek zachowuje stary jezyk",
          raw.get("lang") == "en" and raw.get("hiddenTabs") == ["pad"], raw)
    check("e4. jezyk nadal czytelny po dopisaniu", rf.load_ui_lang() == "en", raw)
    rf.UI_STATE["lang"] = "pl"

    # ================================================================= f. wiring ================
    print("\n--- f. podlaczenie ---")
    src = open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                            "ribbitflip_monitor.py"), "r", encoding="utf-8").read()
    check("f1. endpoint /ui-tabs istnieje", '"/ui-tabs"' in src)
    check("f2. GET i POST maja osobne galezie", src.count('path == "/ui-tabs"') == 2,
          src.count('path == "/ui-tabs"'))
    check("f3. endpoint stoi PRZED bramka slotu (dziala bez kapsla)",
          src.index('if path == "/ui-tabs"')
          < src.index('d = self.dm.get(self._dev_id())   # target slot'))
    check("f4. save_ui_lang idzie przez wspolny tor (bez wlasnego open/dump)",
          "save_ui_config({\"lang\": lang})" in src)
    check("f5. HTML wstrzykuje liste ukrytych zakladek",
          "window.RIBBITFLIP_HIDDEN_TABS=%s" in src)
    check("f6. wstrzykiwana lista przechodzi przez load_hidden_tabs (sanityzacja)",
          "json.dumps(load_hidden_tabs())" in src)
    check("f7. ribbitflip_ui.json nadal jedzie w paczce zgloszenia",
          "ribbitflip_ui.json" in rf.DIAG_GLOBAL_FILES, rf.DIAG_GLOBAL_FILES)

    # The panel side of the contract: the tab bar has to apply the list in the FIRST paint (no
    # flash), and the anchor has to be un-hideable. Both are one line each and both are the kind
    # of thing a later refactor drops silently.
    web = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "web")
    tabs_js = open(os.path.join(web, "js", "rf-34-tabs.js"), "r", encoding="utf-8").read()
    vis_js = open(os.path.join(web, "js", "rf-48-tabvis.js"), "r", encoding="utf-8").read()
    boot_js = open(os.path.join(web, "js", "rf-40-boot.js"), "r", encoding="utf-8").read()
    _axis7 = open(os.path.join(web, "js", "rf-33c-axis-plots.js"), "r", encoding="utf-8").read()
    _core7 = open(os.path.join(web, "js", "rf-00-core.js"), "r", encoding="utf-8").read()
    _ovl7 = open(os.path.join(web, "js", "rf-41-overlay.js"), "r", encoding="utf-8").read()
    html = open(os.path.join(web, "ribbitflip_dashboard.html"), "r", encoding="utf-8").read()
    check("f8. pasek czyta wstrzyknieta liste (bez fetcha na starcie)",
          "window.RIBBITFLIP_HIDDEN_TABS" in tabs_js)
    # UX 261120 L23: schowana pozycja stoi pod „Wiecej modulow (N)" i da sie na nia wejsc; do kotwicy
    # odsyla tylko nieznane id, a schowanie ogladanej pozycji (rfTabsApplyVisibility).
    check("f9. schowana zakladka jest osiagalna (Wiecej modulow), nieznane id ida na kotwice",
          "if(!TABS.some(t=>t.id===id))id=TAB_ANCHOR;" in tabs_js
          and "_tabHidden.has(id))id=TAB_ANCHOR" not in tabs_js
          and "if(on&&_tabHidden.has(on))setTab(TAB_ANCHOR);" in tabs_js
          and "window.rfCols.placeHidden(_tabHidden)" in tabs_js)
    check("f10. Mapowanie jest kotwica po obu stronach",
          'TAB_ANCHOR="mapowanie"' in tabs_js and "rfTabsAnchor" in vis_js)
    check("f11. initTabVis startuje PO initTabs",
          boot_js.index("initTabs,") < boot_js.index("initTabVis,"))
    check("f12. rf-48 podpiety w HTML przed bootstrapem",
          html.index("rf-48-tabvis.js") < html.index("rf-40-boot.js"))
    check("f13. 15-overlay.css nadal ladowany jako ostatni arkusz",
          html.rindex("15-overlay.css") > html.rindex("16-devmods.css"))
    # Pierwsza klatka NIE ma wisiec w SYNCHRONICZNYM lancuchu bootu: frame() (rf-09) rysuje cztery
    # oscyloskopy, kule pozy, pas naciskniec i miniature prawej kolumny — i robi to z wymuszonym
    # ukladem, a przy starcie nikt jeszcze tego ekranu nie widzi. Od 2026-09-05 idzie przez
    # frameDeferred(), czyli o jedna requestAnimationFrame pozniej; pomiar w
    # tests/boot_timing_harness.mjs. Tu pilnujemy samego kontraktu, bo to jedna linia, ktora
    # kazdy powrot do "frame" w tablicy cofa po cichu.
    check("s1. pierwsza klatka odroczona do rAF (frameDeferred w tablicy initow)",
          ",connect,frameDeferred," in boot_js and ",connect,frame," not in boot_js
          and "function frameDeferred(){requestAnimationFrame(frame);}" in boot_js)

    # --- s2-s16. Uklad, responsywnosc i wydajnosc (iteracja 7 UX) --------------------------------
    # Statyczne grepy zrodel; czesc "w przegladarce" robi tests/ux_walk_harness.cjs (checksIter7),
    # a pomiary CPU/ukladu maja wlasne skrypty (boot_timing_harness.mjs, perf_frame_layout.cjs).
    # Kazda pozycja to JEDNA linia lub jedna regula, ktora latwo cofnac po cichu przy nastepnej
    # przebudowie — stad ten blok.
    _c7 = {}
    for _n in ("02-base", "03-triggers", "06-connect-midi-pads", "07-felt-core", "20-cols", "22-modtabs"):
        _c7[_n] = open(os.path.join(web, "css", _n + ".css"), "r", encoding="utf-8").read()
    _cols7, _mod7, _tri7 = _c7["20-cols"], _c7["22-modtabs"], _c7["03-triggers"]
    _narrow = _cols7[_cols7.index("@media (max-width:1279px){"):_cols7.index("@media (max-width:1100px){")]
    _rcol7 = open(os.path.join(web, "js", "rf-34c-rcol.js"), "r", encoding="utf-8").read()
    _scopes7 = open(os.path.join(web, "js", "rf-09-scopes.js"), "r", encoding="utf-8").read()

    check("s2. naglowek modulu przykleja sie POD poziomym pasem kapsli (--rf-strip-h)",
          "top:calc(var(--topbar-h,64px) + var(--rf-strip-h,0px))" in _mod7
          and "_syncStripH" in boot_js and "--rf-strip-h" in boot_js
          and "background-color:var(--bg)" in _narrow and "top:var(--topbar-h,64px)" in _narrow)
    check("s3. ekran dwukolumnowy zwija sie od szerokosci PANELU, nie okna",
          "grid-template-columns:minmax(0,0.92fr) minmax(0,1.28fr)" in _mod7
          and "container-type:inline-size" in _mod7
          and "@container (width < 766px)" in _mod7
          and "@media (max-width:1180px)" not in _mod7)
    check("s4. lista mapowan MIDI/OSC: drugi tor dopiero od 420 px na tor",
          "repeat(auto-fit,minmax(min(100%,420px),1fr))" in _c7["06-connect-midi-pads"]
          and "@media(min-width:1120px){.midilist" not in _c7["06-connect-midi-pads"])
    check("s5. surowy stos kart nie miga przy starcie (html.rf-boot)",
          html.index('classList.add("rf-boot")') < html.index("<script src=")
          and "setTimeout(function(){document.documentElement.classList.remove(\"rf-boot\");},8000)" in html
          and "html.rf-boot header,html.rf-boot .wrap{visibility:hidden}" in _c7["02-base"]
          and "html.rf-boot header,html.rf-boot .wrap{display:none}" not in _c7["02-base"]
          and boot_js.index("].forEach(function(fn){try{fn();}") < boot_js.index('classList.remove("rf-boot")'))
    # UX 261120 L23: w kolumnie zostaje mala kula i pas nacisniec; wykresy kanalow sa tylko w Czujniku.
    check("s6. poziomy pas podgladu: kula w pierwszej kolumnie, akcje i pas nacisniec obok",
          ".rf-lvgrid.pose-big .rf-mini-pose{grid-row:1/4}" in _narrow
          and "grid-auto-flow:dense" in _narrow
          and ".rf-lvgrid .rf-mini-acts,.rf-lvgrid .rf-mini-lane,.rf-lvgrid .rf-mini-vpacts{grid-column:2/-1}" in _narrow
          and "@media (max-width:1100px){" in _cols7
          and ".rf-devwrap{width:230px}" in _cols7 and ".rf-scope" not in _cols7 and ".rf-minileg" not in _cols7)
    check("s7. wartosci suwakow Kola nie wychodza na scieg sekcji",
          ".wh-row .wh-fl{flex:0 1 132px;min-width:0}" in _tri7
          and "min-width:70px;accent-color:var(--az)" in _tri7)
    check("s8. lista regul: drugi tor dopiero od 480 px na tor",
          "repeat(auto-fit,minmax(min(100%,480px),1fr))" in _tri7
          and "@media(min-width:1120px){.ruleslist" not in _tri7)
    # UX 261120 (F-G0-09): budzet paska. Pomoc i spolecznosc z napisem dopiero od 1440 px.
    # UX 261120 L23 (L-D3): Strona projektu i Discord w okienku „Pomoc i spolecznosc" (rf-34h).
    _help9 = open(os.path.join(web, "js", "rf-34h-help.js"), "r", encoding="utf-8").read()
    check("s9. pasek gorny: Przewodnik i „Pomoc i spolecznosc\" bez napisu ponizej 1440 px, odnosniki w okienku",
          '<span class="btn-lbl">Strona projektu</span>' in html
          and '<span class="btn-lbl">Discord</span>' in html
          and 'aria-label="Strona projektu RibbitFlip' in html
          and "@media (max-width:1439px){" in _c7["07-felt-core"]
          and "header #helpBtn .btn-lbl,header #tourBtn .btn-lbl{display:none}" in _c7["07-felt-core"]
          and "_pop.appendChild(site);" in _help9 and "_pop.appendChild(dsc);" in _help9
          and "header .rf-help-pop .btn-lbl{display:inline}" in _cols7
          and "initTour,initHelpMenu,initFirstAsk" in boot_js)
    check("s10. kubek nie siada na przycisku stopki w waskim oknie",
          "footer{padding-bottom:76px}" in _narrow and ".rf-rcol{padding-bottom:78px}" in _cols7)
    check("s11. wykresy osi pracuja tylko na Czujniku",
          "tab.classList.contains('active')" in _axis7 and "_rdSet(el,'text'," in _axis7)
    check("s12. miniatura: bez przebiegow kanalow (L23), klucz stanu pasa, jeden test offsetParent",
          "_scopeDt" not in _rcol7 and "rfMiniSc1" not in _rcol7 and "_lastKey" in _rcol7
          and "if (!c || !c.offsetParent) return;" not in _rcol7
          and "if (!g || !g.offsetParent) return;" in _rcol7
          and 'say.id = "rfMiniSay"' in _rcol7 and "Kapsel reaguje na ruch." in _rcol7)
    check("s13. petla klatek: odczyty geometrii przed zapisami do DOM",
          "function fitSync()" in _scopes7 and "new ResizeObserver" in _scopes7
          and _scopes7.index("drawAxisPlots();   // per-axis") < _scopes7.index("    drawPose3D();"))
    check("s14. pasek gorny wyrownany do .rf-app (1780)",
          "padding-inline:max(18px,calc((100% - 1780px)/2 + 18px))" in _c7["07-felt-core"]
          and "max-width:1780px" in _cols7)
    check("s15. cv() pamieta odczytane tokeny, nakladka je czysci",
          "_cvM" in _core7 and "function cvReset()" in _core7
          and 'if(typeof cvReset==="function")cvReset();' in _ovl7)
    check("s16. preload obejmuje takze podzbiory latin-ext",
          all(("/web/assets/fonts/%s-latin-ext.woff2" % _f) in html for _f in ("baloo2", "titan-one", "nunito-600"))
          and "jetbrains-mono-latin-ext.woff2" not in html)

    # ================================================================= g. „Reszta" =================
    # Rozbicie „Zestawow i wymiany" na Zestawy + Konfiguracje oraz pasek dwoch zakladek w kazdej
    # pozycji „Reszty" (2026-08-31). Wszystko ponizej to POLACZENIA, czyli rzeczy niewidoczne az do
    # chwili, gdy przestana dzialac: kolejnosc wczytywania plikow, miejsce w bootstrapie i to, czy
    # kazda zakladka ma czym wypelnic swoje „i". Tresci nikt tu nie sprawdza.
    print("\n--- g. Reszta: Zestawy + Konfiguracja + pasek dwoch zakladek ---")
    rest_js = open(os.path.join(web, "js", "rf-49p-resttabs.js"), "r", encoding="utf-8").read()
    guides_js = open(os.path.join(web, "js", "rf-39b-guides.js"), "r", encoding="utf-8").read()
    # UX 261120 (D1): ekran programu nazywa sie „Ustawienia” i stoi na dole nawigacji (grp:"app").
    check("g1. zakladka `ustawienia` jest w rejestrze TABS jako „Ustawienia” na dole nawigacji",
          'id:"ustawienia",  label:"Ustawienia"' in tabs_js and 'grp:"app"' in tabs_js)
    check("g2. jej panel jedzie do rfCols.build (inaczej nie ma go w DOM)",
          "pUstaw" in tabs_js and "pKonfig,pUstaw" in tabs_js)
    for cid, cfile in (("mcpCard", "rf-39c-mcp-ui.js"), ("hkCard", "rf-39j-hotkey.js"),
                       ("diagCard", "rf-47-diag.js")):
        src = open(os.path.join(web, "js", cfile), "r", encoding="utf-8").read()
        check("g3. %s wchodzi do tab-ustawienia, nie do tab-konfiguracje" % cid,
              'getElementById("tab-ustawienia")' in src
              and 'getElementById("tab-konfiguracje")' not in src, cfile)
    check("g4. rf-49p wczytany PO rf-49m (bierze z niego guideBox/isGuide)",
          html.index("rf-49m-modtabs.js") < html.index("rf-49p-resttabs.js"))
    check("g5. ...i przed bootstrapem",
          html.index("rf-49p-resttabs.js") < html.index("rf-40-boot.js"))
    # Umowa jest o KOLEJNOSCI, nie o byciu ostatnim: initRestTabs przenosi zawartosc paneli, wiec
    # musi isc PO wszystkim, co te panele wypelnia (hub wymiany i biblioteka dokladaja karty juz po
    # initPresetCols). Sprawdzanie „ostatni w tablicy" pekalo przy kazdym nowym init na koncu.
    # ⚠️ Szukamy w SAMEJ TABLICY, nie w calym pliku: komentarz nad nia wymienia te same nazwy
    # w innej kolejnosci („initRestTabs … stoi za initExchangeHero i initLibrary"), wiec `index()`
    # po calym zrodle trafialby w proze i dawal odwrotny wynik.
    _arr = boot_js[boot_js.index("[buildAxisCards"):boot_js.index("].forEach")]
    check("g6. initRestTabs idzie PO initLibrary i initExchangeHero",
          _arr.index("initExchangeHero") < _arr.index("initRestTabs")
          and _arr.index("initLibrary") < _arr.index("initRestTabs"), _arr[-90:])
    # Kazda pozycja „Reszty" musi miec czym wypelnic zakladke „i" — inaczej swieci zdaniem o braku
    # poradnika, co przy pieciu ekranach widac natychmiast.
    for tid in ("konfiguracje", "ustawienia", "wszystkie", "czujnik", "polaczenie"):
        check("g7. poradnik dla zakladki %s istnieje" % tid,
              ('{id:"%s",panel:"tab-%s"' % (tid, tid)) in guides_js)
    check("g8. rf-49p zna wszystkie piec pozycji",
          all(('"%s"' % t) in rest_js for t in
              ("konfiguracje", "ustawienia", "wszystkie", "czujnik", "polaczenie")))
    # Sciaga ?view=overview pokazuje JEDEN panel — ten sam, ktory od 08-31 ma wlasny poradnik.
    # Bez tej bramki poradnik ladowalby zwiniety na samej gorze widoku, ktory istnieje po to, zeby
    # stac na drugim monitorze i pokazywac wylacznie sciage.
    check("g10. sciaga ?view=overview nie dostaje poradnikow",
          'classList.contains("overview-only")' in guides_js and "if(_cheat)continue;" in guides_js)
    check("g11. ...i pasek dwoch zakladek tez ja omija",
          'classList.contains("overview-only")' in rest_js)
    check("g9. odnosniki skaczace w glab zakladki najpierw ja odslaniaja",
          open(os.path.join(web, "js", "rf-39m-share-howto.js"), "r", encoding="utf-8")
          .read().count("rfRestTabs.reveal") == 2)

    # ================================================================= g2. przyklejony pasek =======
    # Pasek nagłówka jest przyklejony do góry ekranu i to jest polaczenie z TRZECH osobnych miejsc,
    # z ktorych kazde da sie zepsuc nie ruszajac dwoch pozostalych.
    print("\n--- g2. przyklejony pasek naglowka ---")
    css_pres = open(os.path.join(web, "css", "21-presets.css"), "r", encoding="utf-8").read()
    css_mod = open(os.path.join(web, "css", "22-modtabs.css"), "r", encoding="utf-8").read()
    # Od 2026-09-05 "pod paskiem aplikacji" znaczy tez "pod poziomym pasem kapsli": ponizej
    # 1280 px prawa kolumna staje sie przyklejonym pasem nad trescia, a jego ZMIERZONA wysokosc
    # siedzi w --rf-strip-h (rf-40, _syncStripH). Przy >=1280 i <=900 px zmienna jest 0px.
    check("g12. pasek jest sticky pod paskiem aplikacji (i pod pasem kapsli, gdy ten jest)",
          "position:sticky;top:calc(var(--topbar-h,64px) + var(--rf-strip-h,0px))"
          in css_mod.replace("\n  ", ""))
    # `overflow:hidden` na ramce zrobiloby z niej pojemnik przewijania, a przyklejone dziecko
    # trzyma sie NAJBLIZSZEGO takiego pojemnika — pasek stalby w miejscu przy 0 bledow konsoli.
    check("g13. ramka ma overflow:clip, nie hidden (bez tego sticky jest martwe)",
          "overflow:clip}" in css_pres and "overflow:hidden}" not in css_pres.split(".rfpc{")[1][:200])
    check("g14. pasek ma wlasne, nieprzezroczyste tlo (jedzie NAD trescia karty)",
          ".rfpc-head{" in css_mod and "background:var(--panel)" in css_mod)
    # Kreski szukamy jako REGULY na poczatku linii — w komentarzu wyzej stoi zdanie o tym, ze
    # kiedys tam byla, i zwykle „in" znalazloby wlasnie je.
    check("g15. ...i wlasny scieg zamiast kreski na panelu pod spodem",
          ".rfpc-head::before" in css_mod and "dashed var(--stitch)" in css_mod
          and "\n.rfpc-panes{border-top" not in css_mod)
    _col_js = open(os.path.join(web, "js", "rf-49j-preset-col.js"), "r", encoding="utf-8").read()
    check("g16. tytul ekranu bierze ikone z ZYWEGO przycisku nawigacji",
          "$.modIcon = function" in _col_js and "tab-ic-" in _col_js)
    check("g17. kapsel w pasku niesie rysunek I kolor, nie samo imie",
          "$.devChip = function" in _col_js and "_cfhDevColor" in _col_js
          and "_cfhDevImg" in _col_js and ".rfpc-dev{" in css_mod)

    # ================================================================= g3. poradnik makr ===========
    # Poradnik pisania makr stoi na SPODZIE zakladki „Informacje" modulu, a nie w miejscach pracy
    # (edytor reguly, karta kola). Tekst jest JEDEN — `macroGuideFoldHtml` w rf-12 — wiec test
    # pilnuje, ze zaden z tamtych plikow go z powrotem nie wstawia u siebie.
    print("\n--- g3. poradnik pisania makr ---")
    ed_js = open(os.path.join(web, "js", "rf-12-preview-editor.js"), "r", encoding="utf-8").read()
    wh_js = open(os.path.join(web, "js", "rf-46b-wheel-card.js"), "r", encoding="utf-8").read()
    mt_js = open(os.path.join(web, "js", "rf-49m-modtabs.js"), "r", encoding="utf-8").read()
    check("g18. edytor reguly NIE wstawia poradnika, tylko odsylacz",
          'macroGuideFoldHtml("edSeqGuide")' not in ed_js and "data-mg-goto" in ed_js)
    check("g19. karta kola tez go nie wstawia",
          "macroGuideFoldHtml(" not in wh_js)
    check("g20. wstawia go ramka modulu, na koncu zakladki „Informacje\"",
          "spec.macroGuide" in mt_js and "I.panes.info.appendChild" in mt_js)
    check("g21. ktore moduly go dostaja, mowi spis modulow",
          'macroGuide: "edSeqGuide"' in _col_js and 'macroGuide: "whMacroGuide"' in _col_js)
    # Odsylacze do niego musza najpierw ODSLONIC zakladke — przewijanie do czegos bez wymiaru
    # konczy sie niczym i niczym nie miga.
    check("g22. odsylacze odslaniaja zakladke przed przewinieciem",
          "$.revealPane" in mt_js and "rfRevealPane" in mt_js
          and "rfRevealPane" in open(os.path.join(web, "js", "rf-46c-wheel-tree.js"),
                                     "r", encoding="utf-8").read())
    check("g23. nasluch odsylacza jest DELEGOWANY (edytor przebudowuje swoj DOM)",
          "_rfMgGoto" in mt_js and 'closest("[data-mg-goto]")' in mt_js)
    # Nazwa dostepna zakladki „Informacje" to „<nazwa> — <podpowiedz>"; podpowiedz nie moze zaczynac
    # sie od tego samego slowa („Informacje — Informacje o module…" / „About — About this module…").
    check("g23a. podpowiedz zakladki ℹ nie powtarza jej nazwy (stara para zdjeta)",
          "Informacje o module i jak" not in mt_js and "About this module and how" not in mt_js)
    check("g23b. nowa para podpowiedzi zakladki ℹ (hint + slownik RF_MODTABS_I18N)",
          mt_js.count("Co robi ten moduł i jak z niego korzystać") == 2
          and mt_js.count("What this module does and how to use it") == 2)

    # ================================================================= g4. ikony i prawa kolumna ===
    print("\n--- g4. ikona „Przegladu\" i kolejnosc prawej kolumny ---")
    rcol_js = open(os.path.join(web, "js", "rf-34c-rcol.js"), "r", encoding="utf-8").read()
    css_ico = open(os.path.join(web, "css", "10-icons-controls.css"), "r", encoding="utf-8").read()
    # „donttouch" w calej aplikacji znaczy WSTRZYMANY (pigulka kapsla, `dt-ic`, kolumna „Caly
    # kapsel" w tej samej macierzy). Ta sama grafika na „Przeglad" byla druga umowa o tym samym.
    check("g24. „Przeglad\" nie nosi juz ikony wstrzymania",
          'png:"donttouch"' not in tabs_js and 'png:"eye"' in tabs_js)
    check("g25. ...a naglowek ekranu ma TE SAMA ikone, co przycisk",
          "hd-ic-eye" in tabs_js and ".hd-ic-eye{" in css_ico and ".tab-ic-eye{" in css_ico)
    # DZWIGNIA MODULU NIE MIGA CALA. `#mEnable.live` (04-pose-mouse-cmd) i `.grp-enable.live`
    # (06-connect-midi-pads) to spadek po czasach, gdy wlacznik grupy byl <button>: obie niosa
    # `animation:pulse`, czyli opacity 1 -> 0.35 -> 1, a `.rf-toggle.on{...!important}` zdejmuje
    # z nich tylko kolory. Skutek widac bylo WYLACZNIE u Myszy, jedynego modulu z regula po `id`:
    # cala dzwignia znikala i wracala co 1,4 s, gdy kapsel prowadzil kursor (zgloszenie
    # 2026-09-10: „mysz jak jest aktywna — jej przycisk znika i pojawia sie… zachowuje sie inaczej
    # niz pozostale moduly"). Sygnal „na zywo" zostaje w bursztynowym napisie „On", ten sam we
    # wszystkich modulach. Bez tej linii usterka wraca po cichu przy pierwszym powrocie do arkusza.
    _ico_ns = "".join(css_ico.split())
    check("g25a. dzwignia „na zywo\" nie animuje sie CALA (stare reguly po id zneutralizowane)",
          ".rf-toggle.live{animation:none!important}" in _ico_ns)
    dm_js = open(os.path.join(web, "js", "rf-45-devmods.js"), "r", encoding="utf-8").read()
    check("g26. „donttouch\" zostaje tam, gdzie znaczy wstrzymanie", 'ic:"hd-ic-donttouch"' in dm_js)
    # Kolumna „Dzwiek (Synth)" NIE nazywa sie „Synth" jak zakladka: komorka przestawia WYCISZENIE
    # jednego kapsla (toggleMute), nie modul. Nazwa zostaje, a powod stoi w komentarzu nad wpisem.
    _snd = dm_js.find('key:"sound"')
    check("g26a. kolumna dzwieku nadal „Dzwiek (Synth)\"",
          _snd > 0 and 'pl:"Dźwięk (Synth)"' in dm_js[_snd:_snd + 120])
    check("g26b. ...a komentarz nad nia mowi, DLACZEGO (toggleMute jednego kapsla, nie modul)",
          "toggleMute" in dm_js[max(0, _snd - 900):_snd] and "//" in dm_js[max(0, _snd - 900):_snd])
    # Kolumna czytala tylko `muted`, a `sound` nie mial wlasnej galezi w `dmCellOn` — wpadal do
    # `_dmSrv`, ktory tego pola nie ma, wiec komorka zostawala na zawsze w stanie „sprawdzam...".
    _cell = dm_js[dm_js.index("function dmCellOn"):dm_js.index("function dmSynthOn")]
    check("g26c. ...a komorka dzwieku ma odpowiedz (nie „sprawdzam...\") — galaz key===\"sound\"",
          'key==="sound"' in _cell and "dmSynthOn()" in _cell and "muted" in _cell)
    # Kolejnosc w prawej kolumnie niesie tresc: bierzesz kapsel do reki (Steruj recznie), naciskasz
    # jego przycisk (przyciski kapsla), a pas nacisniec rysuje wynik — wszystko pod kula.
    _order = [rcol_js.index(x) for x in ('mini("", "rfMiniPose"', 'NS0.manualBtn()',
                                         "NS0.laneRow()", "NS0.vpActs()",
                                         "frontRailTile()")]
    check("g27. pod kula: Steruj recznie, nacisniecia, przyciski kapsla, na koncu przod kapsla",
          _order == sorted(_order), _order)
    check("g28. pusty wiersz „Steruj recznie\" znika w LIVE (przycisk jest podtrybem symulacji)",
          ".rf-mini-acts:not(:has(.btn:not([hidden])))" in
          open(os.path.join(web, "css", "20-cols.css"), "r", encoding="utf-8").read())

    # ============================================== g5. podpowiedz glownego przelacznika ==========
    # Skrot stopu awaryjnego widac dzis tylko na ekranie Konfiguracja, a szuka sie go wtedy, gdy
    # cos juz leci do systemu — czyli patrzac na #armBtn w pasku gornym. Podpowiedz przycisku ma
    # wiec dwa zrodla zmian (przelacznik i skrot), stad osobna funkcja i wolanie jej z rf-39j.
    print("\n--- g5. podpowiedz „Uzbrojone\" mowi o stopie awaryjnym ---")
    hk_js = open(os.path.join(web, "js", "rf-39j-hotkey.js"), "r", encoding="utf-8").read()
    check("g29. dymek #armBtn sklada osobna funkcja rfArmTipSync",
          "function rfArmTipSync" in ed_js and "rfArmTipSync();" in ed_js)
    check("g30. ...bierze kombinacje z rfHotkeyKeys, a nie z wpisanego „Alt+R+F\"",
          "rfHotkeyKeys()" in ed_js and "Alt+R+F" not in ed_js
          and "rfHotkeyLine()" not in ed_js and "rfHotkeyText()" not in ed_js)
    _hkr = hk_js[hk_js.index("function _hkRender()"):hk_js.index("function _hkRenderVerdict")]
    check("g31. ...a rf-39j odswieza ja po KAZDEJ zmianie skrotu (_hkRender)",
          "rfArmTipSync" in _hkr, _hkr[-160:])

    # ================================================================= h. niezapisane zmiany =======
    print("\n--- h. kropka „niezapisane zmiany\" ---")
    dirty_js = open(os.path.join(web, "js", "rf-49q-dirtymark.js"), "r", encoding="utf-8").read()
    col_js = open(os.path.join(web, "js", "rf-49j-preset-col.js"), "r", encoding="utf-8").read()
    check("h1. rf-49q wczytany przed bootstrapem",
          html.index("rf-49q-dirtymark.js") < html.index("rf-40-boot.js"))
    check("h2. kropke rysuje `$.paint` modulu (jedno zrodlo stanu, nie drugi nasluch)",
          "$.dirtyMark(I)" in col_js)
    check("h3. znacznik trafia i do nawigacji, i do zakladki „Konfiguracja\" modulu",
          '.tab-btn[data-tab="' in dirty_js and "I.tabBtn.cfg" in dirty_js)
    check("h4. konfiguracja BEZ NAZWY nie jest oznaczana (stan startowy kazdej instalacji)",
          "st.name && !st.known" in dirty_js and "else if (st.dirty)" in dirty_js)
    check("h5. znacznik jest <i>, nie <span> (span lapie zapytanie o etykiete zakladki)",
          'createElement("i")' in dirty_js)
    check("h6. ma nazwe dostepna, nie sam kolor",
          'setAttribute("aria-label", txt)' in dirty_js)
    # Zgloszenie 14.09: „chcialbym, zeby bylo to zrozumiale dla uzytkownika koncowego,
    # bo jest to kryptyczne". Dymek mowil „Ta konfiguracja zniknela z listy — ustawienia sa tylko
    # na kapslu": bez nazwy, bez informacji czy cos sie zepsulo i bez wyjscia. Tresc sprawdza na
    # zywo `scan_library_harness` (oba stany, oba dymki); tutaj pilnujemy, ze zdanie SKLADA SIE
    # z nazwy i wskazuje przycisk — bo to jest to, co odroznia opis stanu od komunikatu.
    check("h7. dymek nazywa konfiguracje po imieniu (zdanie skladane, nie klucz slownika)",
          "st.name" in dirty_js and "_tf(TXT[kind]" in dirty_js and 'data-noi18n' in dirty_js)
    check("h8. ...i mowi, ktory przycisk to zalatwia",
          "Zapisz zmiany" in dirty_js and "Zapisz z powrotem" in dirty_js
          and "Save the changes" in dirty_js and "Save it back" in dirty_js)
    check("h9. modul bez konfiguracji per kapsel nie mowi o kapslu",
          "perDev === false" in dirty_js and "wProgramie" in dirty_js)
    # Dwa sztywne zdania mialy wlasny slowniczek dopisywany do I18N_EN. Napis skladany z nazwa
    # nie ma jak byc kluczem, wiec slowniczek znikl — gdyby wrocil, znaczyloby to, ze ktos wrocil
    # tez do zdania bez nazwy. (Samo zdanie zostaje w komentarzu i to jest w porzadku: tam stoi
    # zapisane, czego ten napis NIE ma juz robic.)
    check("h10. nie ma juz slowniczka dwoch sztywnych zdan (napis sklada sie z nazwa)",
          "RF_DIRTYMARK_I18N" not in dirty_js and "Object.assign(I18N_EN" not in dirty_js)
    # Napis jest skladany z nazwa, wiec walker go nie przetlumaczy — jezyk musi wrocic przez
    # przerysowanie modulu. Ta sciezka juz istnieje (rfpcRelang → paintAll → paint → dirtyMark),
    # ale gdyby ktos ja kiedys uciac, dymek zostalby w poprzednim jezyku bez sladu w konsoli.
    check("h11. przelacznik jezyka przerysowuje kolumne presetow (a z nia kropke)",
          "rfpcRelang" in open(os.path.join(web, "js", "rf-01-i18n.js"), "r", encoding="utf-8").read()
          and "$.paintAll()" in col_js)

    # ================================================================= i. kolko nad kula ==========
    # Kolko myszy nad orientacja 3D NIE przejmuje steru. Chwyt, dwuklik i klawisz to czynnosci
    # wymierzone w widzet; kolko nad nim bywa po prostu przewijaniem strony, ktore akurat tedy
    # przechodzi — a prawa kolumna jest wezsza niz jej tresc, wiec przewija sie ja czesto.
    print("\n--- i. kolko nad kula 3D ---")
    vp_js = open(os.path.join(web, "js", "rf-14b-virtualpuck.js"), "r", encoding="utf-8").read()
    _w = vp_js.index('addEventListener("wheel"')
    _blok = vp_js[_w:_w + 260]
    check("i1. kolko dziala dopiero przy WLACZONYM trybie recznym",
          "if(!VPUCK.on)return;" in _blok, _blok[:120])
    check("i2. ...i nie wola vpEngage (to ono wlaczalo tryb)", "vpEngage" not in _blok, _blok[:120])
    # `preventDefault` PO strazniku — inaczej strona nie przewinie sie mimo poprawki.
    check("i3. przewijanie zjadane dopiero, gdy kolko naprawde steruje",
          _blok.index("if(!VPUCK.on)return;") < _blok.index("preventDefault"))
    # Chwyt i dwuklik ZOSTAJA gestami wlaczajacymi — to sa czynnosci wymierzone w kule.
    check("i4. chwyt nadal wlacza tryb", "if(!vpEngage())return;" in vp_js)
    check("i5. ...i dwuklik tez", "vpEngage(vpLevel)" in vp_js)

    # ================================================================= j. wlasny pasek ============
    # Kursor nad NATYWNYM paskiem maluje przegladarka i nie da sie go zmienic — dlatego kolumny maja
    # wlasny. To polaczenie z czterech miejsc naraz i kazde da sie zepsuc osobno.
    print("\n--- j. wlasny pasek przewijania kolumn ---")
    sb_js = open(os.path.join(web, "js", "rf-34g-railscroll.js"), "r", encoding="utf-8").read()
    cols = open(os.path.join(web, "css", "20-cols.css"), "r", encoding="utf-8").read()
    check("j1. rf-34g wczytany przed bootstrapem",
          html.index("rf-34g-railscroll.js") < html.index("rf-40-boot.js"))
    _arr2 = boot_js[boot_js.index("[buildAxisCards"):boot_js.index("].forEach")]
    check("j2. initRailScroll jest w bootstrapie, PO initTabs (kolumny musza juz istniec)",
          "initRailScroll" in _arr2 and _arr2.index("initTabs,") < _arr2.index("initRailScroll"))
    # Systemowy pasek chowamy DOPIERO, gdy skrypt dolozyl swoj — inaczej wyciety plik zostawia
    # kolumne bez zadnego paska i bez zadnego znaku, ze sie przewija.
    check("j3. systemowy pasek chowa klasa nadawana przez skrypt, nie sam arkusz",
          ".rf-sb-host{scrollbar-width:none}" in cols and 'classList.add("rf-sb-host")' in sb_js)
    check("j4. kciuk ma pozy uchwytu wartosci",
          "html.rf-cursor .rf-sb-th{cursor:var(--rf-cur-hover)" in cols
          and "html.rf-cursor .rf-sb-th.drag{cursor:var(--rf-cur-grab)" in cols)
    # Reka wyjezdza poza 11-pikselowy kciuk przy pierwszym szarpnieciu — bez przechwycenia wskaznika
    # zdarzenia leca do elementu pod spodem, a bez klasy na dokumencie kursor przestaje byc piescia.
    check("j5. ciagniecie przechwytuje wskaznik", "setPointerCapture" in sb_js)
    check("j6. ...i trzyma zacisnieta dlon na CALYM dokumencie",
          'classList.add("rf-sb-dragging")' in sb_js
          and "html.rf-cursor.rf-sb-dragging" in cols)
    # Ponizej 1280 px prawa kolumna jest SIATKA z nazwanymi obszarami — dziecko bez obszaru
    # rozpychaloby jej uklad.
    check("j7. ponizej 1280 px wraca pasek systemowy", ".rf-rcol .rf-sb{display:none}" in cols)
    check("j8. wysokosc kciuka liczona z proporcji, nie wpisana", "m.view / m.total" in sb_js)

    # ================================================================= k. gutter kart ============
    # Kazda karta jest obszyta sciegiem biegnacym 5 px w srodku (.card::before). Tresc ma sie
    # trzymac od niego z daleka, i to WSZEDZIE tak samo — naglowek od zawsze stal 20 px od
    # krawedzi, a paski, listy i dzienniki dorabialy sobie te liczbe osobno (12/13/14/16/18/19),
    # wiec opieraly sie o scieg i nie trzymaly jednej pionowej linii z naglowkiem nad nimi.
    # Odtad jedna liczba w jednym miejscu: --card-x (karty pelnej szerokosci) i --card-x-sm
    # (waskie kafle pasa podgladu i kolumna wyjsc). Ten blok pilnuje, zeby nikt nie wrocil do
    # wpisywania pikseli — bo to wlasnie tak sie rozjechalo poprzednim razem.
    print("\n--- k. gutter kart (--card-x) ---")
    _tok = open(os.path.join(web, "css", "01-assets-tokens.css"), "r", encoding="utf-8").read()
    check("k1. tokeny sa zdefiniowane raz, w arkuszu tokenow",
          "--card-x:20px" in _tok and "--card-x-sm:16px" in _tok
          and "--card-y:12px" in _tok and "--card-y-sm:8px" in _tok)
    _sheets = {}
    for _n in ("03-triggers", "04-pose-mouse-cmd", "05-macro-tabs", "06-connect-midi-pads",
               "07-felt-core", "08-felt-components", "10-icons-controls", "12-rest-api",
               "13-dialogs-overview", "14c-controller", "17-wheel", "20-cols"):
        _sheets[_n] = open(os.path.join(web, "css", _n + ".css"), "r", encoding="utf-8").read()
    # Po jednym swiadku z kazdej rodziny powierzchni, ktora sie o scieg opierala.
    _witness = [
        ("k2. pasek i lista wyzwalaczy", "03-triggers", ".trigbar{", "padding:11px var(--card-x)"),
        ("k3. dzienniki i kanaly (.feed/.cmd-log/.log)", "08-felt-components",
         ".feed,.cmd-log,.log{", "margin:var(--card-y) var(--card-x) var(--card-x)"),
        ("k4. lista regul", "08-felt-components", ".ruleslist{", "padding:var(--card-y) var(--card-x) 0"),
        ("k5. paski i notki ustawien", "08-felt-components", ".setupbar{", "padding-left:var(--card-x)"),
        ("k6. cialo kart Uslug", "12-rest-api", ".ra-body{", "padding:12px var(--card-x)"),
        ("k7. sekcje kontrolera", "14c-controller", "#padHubSec{", "padding:10px var(--card-x) 12px"),
        # Pasek „dlaczego nic nie dochodzi" jest RODZENSTWEM tych sekcji, nie ich dzieckiem, wiec
        # gutter musi dostac sam. Bez niego szedl przez CALA szerokosc karty i jego wlasna ramka
        # wychodzila poza scieg. Margines, nie padding: ten pasek ma ramke, ktora ma stanac w linii.
        ("k7b. pasek 'dlaczego nic nie dochodzi'", "14c-controller",
         ".pad-offnote{", "margin:var(--card-y) var(--card-x) 10px"),
        ("k8. kafle kola", "17-wheel", ".wh-caps{", "padding:11px var(--card-x)"),
        ("k9. sciaga wszystkich kapsli", "13-dialogs-overview", ".ov-wrap{", "padding:var(--card-y) var(--card-x) var(--card-x)"),
        ("k10. waskie kafle pasa podgladu", "08-felt-components",
         ".live-rail .scopewrap{", "padding:var(--card-y-sm) var(--card-x-sm) 12px"),
        ("k11. kolumna wyjsc po prawej", "20-cols", ".rf-sect{", "padding:9px var(--card-x-sm) 4px"),
    ]
    for _name, _sheet, _sel, _decl in _witness:
        _css = _sheets[_sheet]
        check(_name, _sel in _css and _decl in _css, "%s: brak %r" % (_sheet, _decl))
    # Naglowek jest wzorcem, od ktorego te 20 px pochodzi — gdyby ktos ruszyl JEGO, reszta
    # ustawilaby sie wzgledem czegos, czego juz nie ma.
    check("k12. wzorzec sie nie ruszyl: .card>.head nadal stoi 20 px od krawedzi",
          ".card>.head{background:transparent;border-bottom:none;padding:14px 20px 12px"
          in _sheets["07-felt-core"])

    # --- l. spojnosc przyciskow i dymkow (iteracja 1 UX, pozycje 1.11-1.14) -----------------------
    # Statyczne grepy zrodel — czesc "w przegladarce" robi tests/ux_walk_harness.cjs (checksIter1c).
    # Jedna ikona "dodaj" w calym panelu = PNG .bic-plus; przyciski Uslug bez emoji (reszta panelu
    # ma PNG .bic); dymek z jednego zdania NIE konczy sie kropka (dwa i wiecej zdan — kropka po kazdym).
    print("\n--- l. spojnosc przyciskow i dymkow (1.11-1.14) ---")
    import glob as _glob, re as _re
    _js = {}
    for _f in _glob.glob(os.path.join(web, "js", "rf-*.js")):
        _js[os.path.basename(_f)] = open(_f, "r", encoding="utf-8").read()
    _html = open(os.path.join(web, "ribbitflip_dashboard.html"), "r", encoding="utf-8").read()
    _i18n = _js["rf-01-i18n.js"]
    check("l1. placeholder wyszukiwarki Zestawow jak w Bibliotekach modulow (mala litera + wielokropek)",
          'placeholder="szukaj po nazwie, grze albo autorze\u2026"' in _html
          and '"szukaj po nazwie, grze albo autorze\u2026":"search by name, game or author\u2026"' in _i18n)
    _plus_emoji = [n for n, t in _js.items() if "\u2795" in t and n != "rf-01-i18n.js"]
    check("l2. emoji-plus (U+2795) nie wystepuje w zadnym rf-*.js poza slownikiem", _plus_emoji == [], _plus_emoji)
    _old_keys = ['"\u2795 Dodaj API"', '"\u2699 Ustawienia"', '"\u2b73 Eksportuj"', '"\U0001f3af Wyzwalacze"',
                 '"\U0001f4e6 Z szablonu\u2026"', '"\U0001f511 Ustaw has\u0142o sejfu"',
                 '"\U0001f50c Test po\u0142\u0105czenia"', '"+ puste pole"', '"+ podmenu"',
                 '"+ Dodaj po\u015bwiadczenie"', '"+ Dodaj wyzwalacz"', '"+ Nowa akcja"', '"+ Nowa zmienna"',
                 '"\U0001f513 Odblokuj sejf"', '"\U0001f501 Zmie\u0144 has\u0142o"', '"\U0001f5d1 Usu\u0144 sejf"',
                 '"\U0001f50c Po\u0142\u0105cz"', '"\u26a1 Akcje"']
    # (komentarze pominiete — rf-35 opisuje w komentarzu historyczne dwa przyciski "🔓 Odblokuj sejf")
    _code = {n: "\n".join(l for l in t.split("\n") if not l.lstrip().startswith("//")) for n, t in _js.items()}
    _left = sorted(set((n, k) for n, t in _code.items() for k in _old_keys if k in t))
    check("l3. stare etykiety/klucze z prefiksem '+' albo emoji zniknely ze zrodel", _left == [], ascii(_left))
    _sites = [("rf-35-rest-e2.js", '_raBtnLabel(add,_gl("Dodaj po\u015bwiadczenie","Add credential"),"bic-plus")'),
              ("rf-36-rest-e3.js", '_ra3Btn(tpl,_ra3T("Wybierz szablon","Pick a template"),"bic-plus")'),
              ("rf-36-rest-e3.js", '_ra3Btn(add,_ra3T("Nowa akcja","New action"),"bic-plus")'),
              ("rf-37-rest-e4.js", '_ra4Btn(add,_ra4T("Dodaj wyzwalacz","Add trigger"),"bic-plus")'),
              ("rf-39-rest-e5.js", '_raBtnLabel(b,label,"bic-plus")'),
              ("rf-46b-wheel-card.js", '<span class="bic bic-plus" aria-hidden="true"></span>puste pole'),
              ("rf-46c-wheel-tree.js", '<span class="bic bic-plus" aria-hidden="true"></span>${_wheelT("podmenu", "submenu")}')]
    _miss = [(n, k[:40]) for n, k in _sites if k not in _js[n]]
    check("l4. kazdy przycisk 'dodaj' Uslug i Kola rysuje ikone .bic-plus", _miss == [], ascii(_miss))
    _vault = ['_gl("Odblokuj sejf","Unlock vault")', '_gl("Zmie\u0144 has\u0142o","Change password")',
              '_gl("Usu\u0144 sejf","Delete vault"),_raDeleteVault,"","bic-bin")',
              '_gl("Sprawd\u017a sejf ponownie","Re-check the vault")', '_gl("Ustaw has\u0142o sejfu","Set vault password")']
    check("l5. przyciski sejfu: czysty czasownik, Usun sejf z ikona kosza",
          all(v in _js["rf-35-rest-e2.js"] for v in _vault), ascii([v for v in _vault if v not in _js["rf-35-rest-e2.js"]]))
    check("l6. Folder / Eksportuj / Test polaczenia / Polacz z PNG .bic zamiast emoji",
          '<span class="bic bic-folder" aria-hidden="true"></span>\'+_ra3T("Folder","Folder")' in _js["rf-36-rest-e3.js"]
          and '<span class="bic bic-export" aria-hidden="true"></span>\'+_ra3T("Eksportuj","Export")' in _js["rf-36-rest-e3.js"]
          and '<span class="bic bic-connect" aria-hidden="true"></span>Test po\u0142\u0105czenia</button>' in _js["rf-36-rest-e3.js"]
          and '<span class="bic bic-connect" aria-hidden="true"></span>Po\u0142\u0105cz</button>' in _js["rf-38b-obs.js"])
    check("l7. pod-zakladki aplikacji Akcje / Wyzwalacze / Ustawienia i test bez emoji",
          '[["actions","Akcje","Actions","co wysłać","what to send"],'
          in _js["rf-36-rest-e3.js"]
          and '["settings","Ustawienia i test","Settings & test","czy dochodzi","does it arrive"]]'
          in _js["rf-36-rest-e3.js"])
    # Poradnik Uslug i szablony cytuja przyciski w <b>…</b> / „…” — bez prefiksu, jak same przyciski.
    _guides = "\n".join(l for l in _js["rf-39b-guides.js"].split("\n") if 'id:"restapi"' in l or 'id:"kolo"' in l)
    check("l8a. poradniki Uslug i Kola sa w rf-39b (po jednym wierszu)", _guides.count("\n") == 1, _guides.count("\n"))
    _cites = [c for c in ("<b>+ ", "<b>\u2795 ", "<b>\u2699 ", "<b>\u2b73 ", "<b>\U0001f3af ", "<b>\U0001f4e6 ", "<b>\U0001f50c ",
                          "<b>\U0001f511 ", "<b>\U0001f5c1 ") if c in _guides]
    check("l8. poradniki Uslug i Kola: cytaty <b> przyciskow bez '+'/emoji (zostaja Wyslij/Podglad/Instrukcja z ikona)",
          _cites == [], ascii(_cites))
    _pk = [c for c in ("\u201e\U0001f3af ", "\u201e\u2699 ", "\u201e\U0001f511 ", "\u201e+ Dodaj", '\\"+ Add credential', '\\"+ Add trigger',
                       '\\"\U0001f3af ', '\\"\u2699 ', '\\"\U0001f511 ') if c in _js["rf-38-rest-packs.js"]]
    check("l9. szablony uslug: instrukcje cytuja przyciski bez '+'/emoji", _pk == [], ascii(_pk))
    # 1.14 — statyczne title="…" (HTML i szablony JS) oraz .title=_xT("…") z jednego zdania i kropka na koncu → 0.
    _tip_files = ["rf-46b-wheel-card.js", "rf-46c-wheel-tree.js", "rf-46d-wheel-stage.js", "rf-41c-overlay-editor.js",
                  "rf-37-rest-e4.js", "rf-39-rest-e5.js", "rf-39i3-lib-list.js", "rf-49n-rest-config.js"]
    _one = lambda t: t.strip().endswith(".") and not _re.search(r"[.!?\u2026]\s+\S", t) and not t.startswith("$")
    _found = []
    for _n, _t in [(n, _js[n]) for n in _tip_files] + [("ribbitflip_dashboard.html", _html)]:
        for _i, _l in enumerate(_t.split("\n"), 1):
            for _m in _re.finditer(r'(?:title|data-tip)="([^"]*)"', _l):
                if _one(_m.group(1)): _found.append((_n, _i, _m.group(1)[:50]))
            for _m in _re.finditer(r'title\s*=\s*(?:\w+\?)?_\w+\(\s*"([^"]*)"', _l):
                if _one(_m.group(1)): _found.append((_n, _i, _m.group(1)[:50]))
    check("l10. zero jednozdaniowych dymkow z kropka na koncu w plikach z planu 1.14 (bylo 8)", _found == [], ascii(_found))
    _i18n_dots = [k for k in ("Jak du\u017cy jest \u015brodek ko\u0142a, w kt\u00f3rym nic nie jest wskazane.",
                              "Systemowe menu wyboru emoji otworzysz skr\u00f3tem Win + kropka.",
                              "Wy\u015brodkuj \u2014 wyzeruj obr\u00f3t i ustaw bie\u017c\u0105ce po\u0142o\u017cenie jako odniesienie.",
                              'tak jak w grze.":', 'ruch boczny szyi jest niedost\u0119pny.":', '\u017ceby wyb\u00f3r poszed\u0142 do systemu.":',
                              'w chwili wyboru.":', 'tam gdzie je postawisz.":', 'przy kursorze i w nak\u0142adkach.":')
                  if k in _i18n]
    check("l11. klucze I18N tych dymkow przepisane razem z tekstem (stare z kropka zniknely)", _i18n_dots == [], ascii(_i18n_dots))
    check("l12. klucz dymka nazwy nakladki (rf-41) i uzycie w rf-41c bez kropki",
          'w menu przy zegarku."' not in _js["rf-41-overlay.js"] and 'w menu przy zegarku."' not in _js["rf-41c-overlay-editor.js"]
          and 'w menu przy zegarku":' in _js["rf-41-overlay.js"])
    # The EN value is a separate string — a key rewritten without its value leaves the full stop in EN only.
    check("l12b. wartosc EN dymka nazwy nakladki tez bez kropki",
          'in the tray menu",' in _js["rf-41-overlay.js"] and 'in the tray menu.",' not in _js["rf-41-overlay.js"])

    # --- m. czytelnosc (iteracja 3 UX, pozycje 3.1-3.5) ------------------------------------------
    # Statyczne grepy arkuszy — czesc "w przegladarce" (kontrast, miara czytania) robi
    # tests/ux_walk_harness.cjs (checksIter3/checksIter3b). Tutaj tylko rzeczy, ktore da sie cofnac
    # jednym slowem w CSS i ktorych nikt nie zauwazy bez pomiaru.
    print("\n--- m. czytelnosc: kontrast i miara czytania (3.1-3.5) ---")
    _dev = open(os.path.join(web, "css", "16-devmods.css"), "r", encoding="utf-8").read()
    _tok3 = open(os.path.join(web, "css", "01-assets-tokens.css"), "r", encoding="utf-8").read()
    _cmp = open(os.path.join(web, "css", "06-connect-midi-pads.css"), "r", encoding="utf-8").read()
    _cols3 = open(os.path.join(web, "css", "20-cols.css"), "r", encoding="utf-8").read()
    _mod3 = open(os.path.join(web, "css", "22-modtabs.css"), "r", encoding="utf-8").read()
    # 3.1 — nazwa kapsla w Przegladzie: kolor kapsla WMIESZANY w atrament (40%), nie surowy
    # (#ffcb05 na papierze to 1,41:1). Goly var(--dcol) w tej regule = powrot do zoltego na kremie.
    _capname = _dev[_dev.index(".dm-capname{"):_dev.index(".dm-capname{") + 130]
    check("m1. .dm-capname miesza kolor kapsla z atramentem (color-mix 40%)",
          "color-mix(in srgb,var(--dcol,var(--ink)) 40%,var(--ink))" in _capname, _capname[:110])
    check("m2. ...i nie ma juz golego color:var(--dcol", "color:var(--dcol" not in _capname, _capname[:110])
    # 3.3 — bursztyn jako TEKST ma wlasny token; --az/--warn zostaja dla linii, suwakow i LED-ow.
    check("m3. token --warn-ink zdefiniowany raz, w arkuszu tokenow", "--warn-ink:#8a5f0a" in _tok3)
    _ink = [(n, sel) for n, sel in (
        ("05-macro-tabs", ".pcal-live{"), ("05-macro-tabs", ".pcal-resp .num{"),
        ("06-connect-midi-pads", ".osc-dev-adr{"), ("06-connect-midi-pads", ".mi-liveval{"),
        ("14c-controller", ".pl-you{"), ("14c-controller", ".ph-wii-warn b{"),
        ("14b-gamepad", '.ov-padbox[data-kind="wii"] .gpv-kind{'))]
    _bad = []
    for _n, _sel in _ink:
        _css = open(os.path.join(web, "css", _n + ".css"), "r", encoding="utf-8").read()
        _i = _css.find(_sel)
        _rule = _css[_i:_css.find("}", _i) + 1] if _i >= 0 else ""
        if "var(--warn-ink" not in _rule: _bad.append((_n, _sel, _rule[:70]))
    check("m4. napisy bursztynowe jada na var(--warn-ink), nie na --az/--warn", _bad == [], ascii(_bad))
    # Bursztyn jako RYSUNEK zostaje jasny — gdyby ktos podmienil takze te dwa, wykres i suwak
    # pociemnialyby razem z napisami, a to jest kolor danych, nie tekstu.
    check("m5. suwak i obrys pola nadal na --az (rysunek, nie tekst)",
          "accent-color:var(--az)" in open(os.path.join(web, "css", "05-macro-tabs.css"), "r", encoding="utf-8").read())
    # 3.2 — poradniki „Jak polaczyc…": linki dziedzicza link aplikacji (--pink-d), plakietka ma pare
    # od .row .tag.stat i 11 px zamiast 10.
    check("m6. .setup-body a i .mt-hint a nie nadpisuja juz koloru linku",
          ".setup-body a{color:var(--az)}" not in _cmp and ".mt-hint a{color:var(--az)}" not in _cmp)
    _badge = _cmp[_cmp.index(".setup-badge{"):_cmp.index(".setup-badge{") + 200]
    check("m7. .setup-badge: bursztynowy atrament, 11 px, wypelnienie mieszane z papierem",
          "color:var(--warn-ink)" in _badge and "font-size:11px" in _badge
          and "color-mix(in srgb,var(--amber) 20%,var(--panel))" in _badge, _badge[:150])
    # 3.4 — wybrana pozycja nawigacji to ten sam roz, co kazdy .btn.on; --pink zostaje dla sloika Ko-fi.
    # UX 261120 (P-G0-03): wybrana pozycja to kremowa naszywka z rozowym sciegiem, roz = akcja.
    check("m8. .rnav-btn.active to krem z twardym rozowym cieniem",
          ".rnav-btn.active{background:var(--panel);color:var(--ink)" in _cols3
          and ".rnav-btn.active::after{border-color:var(--pink-btn)}" in _cols3)
    check("m9. ...a pod kursorem drugi krem (--panel2)",
          ".rnav-btn.active:hover{background:var(--panel2)}" in _cols3)
    # 3.5 — miara czytania dla prozy poza poradnikiem (uklad-09 rozliczony ta sama regula).
    check("m10. proza ma 86ch, notki 78ch (jedna regula w 22-modtabs)",
          ".setup-body p,.setup-body li,.ra-lead{max-width:86ch}" in _mod3
          and ".setup-note,.ra-note,.mi-grouphint,.rfpc-state-tx,.pcal-hint,.lib-explain{max-width:78ch}" in _mod3)
    # Nakladka ma WLASNE motywy (15-overlay.css) i te same widzety co panel: bursztyn przyciemniony
    # pod papier ma na ciemnej karcie 3,2:1, wiec rodzina ciemnych zawraca token do jasnego.
    _ovl3 = open(os.path.join(web, "css", "15-overlay.css"), "r", encoding="utf-8").read()
    _darkfam = _ovl3[_ovl3.index('html.rf-ovl:is([data-theme="dark"]'):]
    check("m12. ciemne motywy nakladki cofaja --warn-ink do jasnego bursztynu",
          "--warn-ink:#c8971a" in _darkfam[:_darkfam.index("}")], _darkfam[:200])
    # Regula m10 pyta o `p` i `li`; akapit zapisany jako goly wezel tekstowy wprost w
    # `.setup-body` omijal ja bez sladu (bloki "Jak polaczyc…" na MIDI i Kontrolerze szly przez
    # cala szerokosc karty tuz nad juz zwezona lista). Opakowanie w <p> nie zmienia tekstu, wiec
    # klucze I18N_EN zostaja te same — ten test pilnuje, zeby opakowanie nie zniknelo.
    check("m13. wstepy blokow \"Jak polaczyc…\" sa akapitami, nie golym tekstem",
          "<p>Windows nie ma wbudowanego wirtualnego portu MIDI." in _html
          and "<p>OSC dzia\u0142a od razu po sieci UDP" in _html
          # blok ViGEmBus z rf-31 (#mGpSetup) zszed\u0142 w UX 261120 B3: o sterowniku m\u00f3wi linia gotowo\u015bci
          and "mGpSetup" not in _js["rf-31-mouse-ui.js"])
    # Ten sam akapit nie moze przyniesc ze soba domyslnego marginesu przegladarki (1em = 13 px):
    # cala karta jest dostrojona do 3-4 px, wiec naglowek stalby blizej cudzego bloku niz wlasnego
    # tekstu. Regula zywi sie <p> z m13, dlatego stoi tuz obok niego.
    check("m14. akapit w \"Jak polaczyc…\" trzyma rytm karty (4 px, nie 13)",
          ".setup-body p{margin:4px 0}" in _cmp)
    check("m11. .pw-note zostaje ze swoimi 62ch, .card>.head .hint nietkniety",
          ".pw-idlehold .pw-note{flex:0 0 100%;max-width:62ch}"
          in open(os.path.join(web, "css", "03-triggers.css"), "r", encoding="utf-8").read()
          and ".card>.head .hint{max-width" not in _mod3)

    print("\n--- n. czytelnosc: czerwien, plus nakladki, zielen stanu, strzalki, skroty (3.6-3.10) ---")
    _ic3 = open(os.path.join(web, "css", "10-icons-controls.css"), "r", encoding="utf-8").read()
    _ctl3 = open(os.path.join(web, "css", "14c-controller.css"), "r", encoding="utf-8").read()
    _ra3 = open(os.path.join(web, "css", "12-rest-api.css"), "r", encoding="utf-8").read()
    _pre3 = open(os.path.join(web, "css", "21-presets.css"), "r", encoding="utf-8").read()
    _core3 = open(os.path.join(web, "css", "07-felt-core.css"), "r", encoding="utf-8").read()
    _fc3 = open(os.path.join(web, "css", "08-felt-components.css"), "r", encoding="utf-8").read()
    _dlg3 = open(os.path.join(web, "css", "13-dialogs-overview.css"), "r", encoding="utf-8").read()
    _pw3 = _js["rf-13-power-profiles.js"]
    # 3.6 — czerwien jako TEKST ma wlasny token; --bad zostaje rysunkiem (LED, obrys, wypelnienie).
    check("n1. token --bad-ink zdefiniowany raz, w arkuszu tokenow", "--bad-ink:#b8264a" in _tok3)
    check("n2. \"Off\" przelacznika: 12 px i czerwien do tekstu",
          "font-size:12px;letter-spacing:.5px;color:var(--dim)" in _ic3
          and ".rf-toggle:not(.on) .rf-tg-lbl.off{color:var(--bad-ink)}" in _ic3)
    check("n3. lustrzany przelacznik Kontrolera nie schodzi juz do 10 px",
          "#padTrigEnable.mirror .rf-tg-lbl{font-size:11px}" in _ctl3
          and "#padTrigEnable.mirror .rf-tg-lbl{font-size:10px}" not in _ctl3)
    check("n4. pigulka bledu Uslug: napis --bad-ink, obrys nadal --bad",
          ".ra-pill.bad{color:var(--bad-ink);border-color:var(--bad)}" in _ra3)
    check("n5. \"Zatrzymaj teraz\" i \"Usun\" w czerwieni do tekstu",
          # UX 261120 B5a: „Wyłącz wszystko teraz" nosi wspólny czerwony `.btn.danger` (14d), więc
          # lokalnej reguły z napisem --bad-ink w 06 ma nie być (wygrałaby z białym napisem na czerwieni).
          "#hkPanicNow{" not in _cmp
          and "color:var(--bad-ink);box-shadow:0 3px 0 color-mix(in srgb,var(--bad) 42%,transparent)" in _pre3)
    check("n6. ...a czerwien RYSUNKOWA nietknieta (bialy napis na .rfm-btn.danger)",
          ".rfm-btn.danger{background:var(--bad,#d42b28);color:#fff" in _core3)
    # 3.7 — Nakladka: „Dolóz okno” to zwykly `.btn.sm` z filcowym plusem i napisem (UX 261120 B5b),
    # wiec kolor i kontrast bierze z 14d-buttons.css; lokalnej reguly koloru juz nie ma.
    check("n7. .ovl-add: przycisk .btn.sm z napisem, bez lokalnych kolorow",
          ".ovl-add{white-space:nowrap}" in _ovl3 and "color:var(--dcol,#8aa0b5)" not in _ovl3
          and ".ovl-add:disabled" not in _ovl3)
    # 3.8 — zielone napisy stanu: kolor wraca do arkusza (inline style nie da sie poprawic z CSS-a).
    check("n8. renderPowerState ustawia KLASY stanu, nie kolor w atrybucie",
          'st.classList.toggle("is-on",!parked)' in _pw3
          and 'st.classList.toggle("is-parked",parked)' in _pw3
          and 'st.style.color=""' in _pw3
          and "st.style.color=parked?" not in _pw3)
    check("n9. ...a arkusz dobiera do nich atramenty (--green-d / --warn-ink)",
          ".pw-state.is-on{color:var(--green-d)}" in _fc3
          and ".pw-state.is-parked{color:var(--warn-ink)}" in _fc3)
    check("n10. \"polaczony\" w glowce arkusza na zielonym atramencie",
          ".ov-conn.on{color:var(--green-d)}" in _dlg3
          and ".ov-conn.on{color:var(--ok,var(--green-d))}" not in _dlg3)
    # Ta sama pulapka co przy --warn-ink (m12): --green-d jest atramentem POD PAPIER, a arkusz
    # bywa rysowany na ciemnej karcie nakladki, gdzie ma 2,0:1.
    check("n11. ciemne motywy nakladki cofaja .ov-conn.on do rysunkowego --ok",
          'html.rf-ovl:is([data-theme="dark"],[data-theme="bare"],[data-theme="neon"]) .ov-conn.on{'
          in _ovl3 and "color:var(--ok)}" in _ovl3)
    check("n12. tag IMU w dzienniku czujnika o krok ciemniejszy (4,15 -> 6,4)",
          "color:color-mix(in srgb,var(--green-d) 60%,var(--ink))" in _core3)
    # 3.10 — skroty bez rozwiniecia. Kazdy zmieniony polski napis ma swoj klucz EN przepisany.
    check("n13. naglowek kanalu mowi, co to za os (bez \"wg RE:\")",
          '_gl("o\u015b:","axis:")' in _js["rf-08-sse-ui.js"]
          and "wg RE:" not in _js["rf-08-sse-ui.js"])
    check("n14. podpowiedz karty zbiorczej rozwija \"surowe LSB\" (+ klucz EN)",
          "surowe odczyty czujnika (LSB) \u00b7 auto-detekcja grawitacji/ruchu" in _html
          and '"surowe odczyty czujnika (LSB) \u00b7 auto-detekcja grawitacji/ruchu":'
              '"raw sensor counts (LSB) \u00b7 auto-detect gravity/motion"' in _i18n
          and "surowe LSB \u00b7 auto-detekcja" not in _i18n)
    # UX 261120 B5b (P-G6-04): opis karty mowi, co pokazuje wykres; jednostka LSB zostaje na osi wykresu.
    check("n15. ...a karty Kanaly 0-2 / 3-5 mowia po ludzku, co pokazuja (bez \"(potwierdzone)\")",
          "\u017byroskop: jak szybko kapsel si\u0119 obraca" in _html
          and "Akcelerometr: grawitacja i przyspieszenie" in _html
          and "(potwierdzone) \u00b7 surowe LSB" not in _html)
    check("n16. odczyt baterii mowi \"przez Bluetooth\", nie \"BLE\" (+ klucz EN)",
          "(rzadziej = mniej zapyta\u0144 przez Bluetooth)" in _html
          and '"(rzadziej = mniej zapyta\u0144 przez Bluetooth)":"(less often = fewer Bluetooth queries)"' in _i18n
          and "zapyta\u0144 BLE" not in _html)
    # UX 261120 B3 (P-G3-06): podpis typu nad karta Kontrolera zniknal bez zastepnika, bo typ stoi
    # na kaflu kontrolera (lista „typ"), a pierwszy ekran przy 1280x720 nie miescil rysunku pada.
    check("n17. karta Kontrolera nie ma jednolinijkowca z typem (typ jest na kaflu)",
          'id="padCardHint"' not in _html and "_padCardHintSync" not in _js["rf-44-pad-hub.js"])

    print("\n--- o. czytelnosc: szerszy dymek dla dlugich podpowiedzi (3.11) ---")
    # 3.11 — 200-240 znakow w 264 px to bylo 6-7 wierszy. Prog liczony PO tlumaczeniu (EN bywa
    # dluzszy od PL), wiec toggle musi stac ZA podmiana `t` na wersje ze slownika.
    _tip3 = _js["rf-05-tooltip-state.js"]
    check("o1. rf-05 znakuje dlugie dymki klasa rf-tip-long",
          'TIP.classList.toggle("rf-tip-long",t.length>160)' in _tip3
          and _tip3.index("if(I18N_EN[_k]!=null)t=I18N_EN[_k];")
              < _tip3.index('TIP.classList.toggle("rf-tip-long"'))
    check("o2. ...a arkusz daje im 360 px, po regule wariantu z obrazkiem",
          "#rf-tip.rf-tip-long{max-width:360px}" in _ic3
          and _ic3.index("#rf-tip:has(.rf-tip-row){max-width:320px")
              < _ic3.index("#rf-tip.rf-tip-long{max-width:360px}"))
    check("o3. ...bez ruszania domyslnej miary krotkiego dymka",
          "max-width:264px;padding:5px 10px 6px" in _ic3)

    print("\n--- p. dostepnosc: dymki przy fokusie, falda widocznosci, nazwy pol (5.6-5.10) ---")
    # Iteracja 5 UX, pozycje 5.6-5.10. Statyczne grepy — czesc "w przegladarce" robia
    # tests/ux_walk_harness.cjs (checksIter5b) i tests/tooltip_focus_headless.cjs.
    _tip5 = _js["rf-05-tooltip-state.js"]
    _vis5 = _js["rf-48-tabvis.js"]
    _mod5 = _js["rf-06-modals.js"]
    # 5.6 — dymek pokazuje sie takze przy fokusie z klawiatury (WCAG 1.4.13). Tab i same
    # modyfikatory NIE moga go chowac, bo Tab wlasnie przenosi fokus na kolejny przycisk.
    check("p1. rf-05 pokazuje dymek przy fokusie z klawiatury",
          'addEventListener("focusin"' in _tip5 and 'addEventListener("focusout"' in _tip5
          and 'matches(":focus-visible")' in _tip5)
    check("p2. ...i nie robi tego dla pol tekstowych",
          "input,textarea,select,[contenteditable]" in _tip5)
    check("p3. Tab i same modyfikatory nie chowaja dymka, reszta klawiszy chowa",
          "var KBKEEP={Tab:1,Shift:1,Alt:1,Control:1,Meta:1" in _tip5
          and 'document.addEventListener("keydown",function(e){if(!KBKEEP[e.key])hide();},true);' in _tip5
          and '["mousedown","wheel"].forEach' in _tip5)
    # Escape MUSI dochodzic do dialogow (rfModal 5.1, #devEdit 5.2, edytor 5.4) — dymek go tylko chowa.
    # Szukamy w KODZIE (bez komentarzy) — komentarz nad nasluchem mowi wlasnie o tym, ze
    # stopPropagation tam nie ma, i zwykle "in" znalazloby jego.
    check("p4. ...a Escape nie jest zatrzymywany po drodze (dialogi nadal go dostaja)",
          "stopPropagation" not in _code["rf-05-tooltip-state.js"]
          and "preventDefault" not in _code["rf-05-tooltip-state.js"])
    check("p5. ruch myszy nie przestawia dymka pokazanego z klawiatury",
          "if(cur&&!kb&&!raf)raf=requestAnimationFrame(place)" in _tip5
          and "if(!cur||kb)return;" in _tip5)
    # 5.7 — "Widocznosc modulow": fokus wchodzi do szuflady i wraca na oko; Escape zamyka.
    check("p6. rf-48 przenosi fokus tylko przy otwarciu PRZEZ CZLOWIEKA (byUser)",
          "function tvSetOpen(open, byUser)" in _vis5
          and "tvSetOpen(!_tvOpen, true)" in _vis5
          and '#tabVisBox .tv-tg:not([disabled])' in _vis5)
    check("p7. ...i oddaje go oku po zamknieciu",
          "function _tvFocusInBox()" in _vis5 and 'document.getElementById("tabVisBtn")' in _vis5)
    check("p8. Escape w szufladzie ja zamyka",
          'if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); tvSetOpen(false, true); return; }' in _vis5)
    # 5.8 — suwak progu w warunku wyzwalacza mial sam sasiedni <span>, nie etykiete.
    check("p9. oba suwaki progu maja aria-label (te same slowa, co pole liczbowe)",
          'data-cf="thrRange" aria-label="${isRange?"Od (x)":"Próg"}"' in ed_js
          and 'data-cf="thrRangeHi" aria-label="Do (y)"' in ed_js)
    check("p10. ...a ich klucze EN sa w slowniku",
          all(('"%s"' % k) in _i18n for k in ("Próg", "Od (x)", "Do (y)")))
    # 5.9 — pola paska zapisu zestawu i wyszukiwarka Biblioteki mialy tylko placeholder.
    _fields = {"setupName": "Nazwa zestawu", "setupFor": "Dla programu lub gry",
               "setupExe": "Plik gry (auto-wczytywanie)", "setupDesc": "Krótki opis zestawu",
               "libFind": "Szukaj w bibliotece"}
    _noal = []
    _keys5 = []
    for _id, _al in _fields.items():
        _i = _html.find('id="%s"' % _id)
        _tag = _html[_html.rfind("<", 0, _i):_html.find(">", _i) + 1] if _i > 0 else ""
        if ('aria-label="%s"' % _al) not in _tag: _noal.append((_id, _tag[:120]))
        for _m in _re.finditer(r'(?:aria-label|placeholder)="([^"]*)"', _tag):
            _v = _m.group(1)
            if _v != "gra.exe" and ('"%s"' % _v) not in _i18n: _keys5.append((_id, _v))
    check("p11. piec pol zapisu zestawu i wyszukiwarka maja aria-label", _noal == [], ascii(_noal))
    check("p12. ...a kazda ich etykieta i placeholder ma klucz EN (poza 'gra.exe')", _keys5 == [], ascii(_keys5))
    check("p13. podpowiedz w pustym polu na atramencie panelu, nie na szarosci przegladarki",
          "input::placeholder,textarea::placeholder{color:var(--dim);opacity:1}"
          in open(os.path.join(web, "css", "11-felt-forms-devices.css"), "r", encoding="utf-8").read())
    # 5.10 — region aria-live musi istniec PRZED wiadomoscia (czytnik oglasza zmiane w obserwowanym
    # obszarze) i POZA #rfSkullNotes, ktory znika razem z ostatnia notka.
    check("p14. rfSkullNote ma dwa gotowe regiony odczytu, tworzone raz przy starcie",
          "function _noteLiveRegions()" in _mod5
          and '"rfNoteLive","status","polite"' in _mod5
          and '"rfNoteLiveAlert","alert","assertive"' in _mod5
          and "if(document.body)_noteLiveRegions();" in _mod5)
    check("p15. ...i to one mowia notke, a nie sam babel",
          "function _noteSay(" in _mod5 and "_noteSay(_tn+" in _mod5
          and 'b.setAttribute("aria-live"' not in _mod5)
    check("p16. regiony ida do document.body, poza znikajacy #rfSkullNotes",
          "body.appendChild(n)" in _mod5)

    print("\n--- r. dostepnosc: nawigacja z klawiatury, aria-pressed, naglowki (5.11-5.13) ---")
    # Iteracja 5 UX, pozycje 5.11-5.13. Statyczne grepy — czesc "w przegladarce" robi
    # tests/ux_walk_harness.cjs (checksIter5c).
    _tabs5 = _js["rf-34-tabs.js"]
    _cols5 = _js["rf-34b-cols.js"]
    _pcol5 = _js["rf-49j-preset-col.js"]
    _ged5 = _js["rf-12e-gesture-editor.js"]
    # 5.11 — nawigacja to tablist: strzalki chodza po pozycjach, Tab z niej wychodzi.
    check("r1. nawigacja obsluguje strzalki, Home i End",
          "function _navKey(e)" in _tabs5
          and 'k==="ArrowDown"||k==="ArrowRight"' in _tabs5
          and 'k==="ArrowUp"||k==="ArrowLeft"' in _tabs5
          and 'k==="Home"' in _tabs5 and 'k==="End"' in _tabs5
          and 'b.addEventListener("keydown",_navKey);' in _tabs5)
    check("r2. ...po wszystkich pieciu listach naraz, z pominieciem pozycji ukrytych",
          'const RF_NAV_LISTS=["#rfNavTop","#rfNavMod","#rfNavMore","#rfNavPlay","#rfNavTools","#rfNavApp"];' in _tabs5
          and 'RF_NAV_LISTS.map(s=>s+" .tab-btn").join(", ")' in _tabs5
          and "b.offsetParent!==null" in _tabs5)
    check("r3. roving tabindex: jeden przystanek Tab na liste, odswiezany przy kazdej zmianie",
          "function _navRoving()" in _tabs5
          and _tabs5.count("_navRoving();") >= 2
          and "b.tabIndex=(b===act)?0:-1" in _tabs5)
    check("r4. ...i po schowaniu pozycji fokus nie spada na <body>",
          '_hadFocus.classList.contains("tab-btn")' in _tabs5
          and 'RF_NAV_LISTS.map(s=>s+" .tab-btn.active").join(",")' in _tabs5)
    check("r5. kazda pozycja mowi, ktorym panelem steruje",
          'b.setAttribute("aria-controls",t.panel.id)' in _tabs5)
    check("r6. wszystkie piec list nawigacji sa zadeklarowane jako pionowe (jeden budowniczy mkList)",
          _cols5.count('setAttribute("aria-orientation", "vertical")') == 1
          and all('mkList("%s")' % i in _cols5 for i in ("rfNavTop", "rfNavMod", "rfNavPlay", "rfNavTools", "rfNavApp")))
    # 5.12 — przyciski segmentowe to przelaczniki: aria-pressed w tej samej linii, co klasa `on`.
    _segbad = []
    for _n, _t in _js.items():
        for _line in _t.split("\n"):
            if _re.search(r"data-(ck|b|am|grm)=", _line) and "<button" in _line:
                if "aria-pressed=" not in _line or 'type="button"' not in _line:
                    _segbad.append((_n, _line.strip()[:90]))
    check("r7. kazdy przycisk segmentowy edytora ma aria-pressed i type=button", _segbad == [], ascii(_segbad))
    check("r8. przelacznik podgladu sciagi (Kompakt/Szczegoly, 3D/2D) tez",
          ed_js.count('<button type="button" aria-pressed="${state.detailView?') == 4
          and ed_js.count('<button type="button" aria-pressed="${POSE.view2d?') == 2)
    _grp5 = {"Źródło warunku": "Condition source", "Zachowanie": "Behaviour",
             "Rodzaj akcji": "Action kind", "Podgląd": "Preview", "Orientacja": "Orientation"}
    check("r9. grupy przyciskow segmentowych maja role=group i nazwe",
          all(('role="group" aria-label="%s"' % _k) in ed_js for _k in _grp5)
          and 'id="mAbsSeg" role="group" aria-label="Ruch kapsla to"' in _html)
    check("r10. ...a kazda ta nazwa ma klucz EN",
          all(('"%s":"%s"' % (_k, _v)) in _i18n for _k, _v in _grp5.items()), ascii(_grp5))
    # 5.13 — jeden h1 na ekran (nazwa modulu w okruszkach) i landmarki na trzech kolumnach.
    check("r11. tytul modulu w okruszkach to h1, nie <b>",
          'el("h1", null, $.modLabel(tab))' in _pcol5
          and ".rfpc-mod b,.rfpc-mod h1{" in css_mod and ".rfpc-mod h1{margin:0}" in css_mod)
    check("r12. trzy kolumny to landmarki (nawigacja, tresc, uzupelnienie)",
          'rail.setAttribute("role", "navigation")' in _cols5
          and 'main.setAttribute("role", "main")' in _cols5
          and 'rcol.setAttribute("role", "complementary")' in _cols5)
    check("r13. ...a obie nazwane kolumny skladaja nazwe przez _gl",
          '_gl("Nawigacja", "Navigation")' in _cols5
          and '_gl("Kapsle i podgląd", "Capsules and preview")' in _cols5)
    check("r14. sekcje edytora wyzwalacza to h3 (pod h1 modulu i h2 karty)",
          '<h4 class="ed-sec-h">' not in ed_js and '<h4 class="ed-sec-h">' not in _ged5
          # UX 261120 L4e: Warunki, Zachowanie, Więcej warunków, Więcej zachowań, Akcja, Sygnały
          and ed_js.count('<h3 class="ed-sec-h">') == 6
          and '<h3 class="ed-sec-h">' in _ged5)

    # --- t. przewodnik po panelu (rf-39p, 2026-09-29) ------------------------------------------
    # Zgloszenie: "guide tour, ktore mozna wlaczyc na zyczenie". Pilnujemy trzech rzeczy: plik jest
    # zaladowany i odpalany PO initTabs (przycisk staje w pasku, ktory initTabs uklada), przewodnik
    # NIGDY nie startuje sam (jedyne wejscie to klik przycisku) i kazdy krok celuje w element, ktory
    # nadal istnieje w zrodlach — zmiana id bez poprawki przewodnika zostawilaby krok w prozni.
    print("\n--- t. przewodnik po panelu (rf-39p) ---")
    _tour = _js.get("rf-39p-tour.js", "")
    _boot_list = boot_js[:boot_js.index("].forEach(function(fn){try{fn();}")]
    check("t1. rf-39p zaladowany przed rf-40-boot, arkusz 27 przed 15-overlay",
          0 < _html.index('src="/web/js/rf-39p-tour.js"') < _html.index('src="/web/js/rf-40-boot.js"')
          and 0 < _html.index('href="/web/css/27-tour.css"') < _html.index('href="/web/css/15-overlay.css"'))
    check("t2. initTour w lancuchu startowym PO initTabs",
          "initTour" in _boot_list and _boot_list.index("initTabs") < _boot_list.index("initTour"))
    # UX 261120 (D8): jednorazowe zaproszenie notka czaszki; przewodnik dalej rusza dopiero po kliknieciu.
    check("t3. przewodnik startuje z przycisku albo z klikniecia w zaproszenie, nigdy sam",
          "b.onclick = start;" in _tour and "setTimeout(() => _offer(false), 1500);" in _tour
          and 'const OFFER_LS = "ribbitflip.tourOffered";' in _tour
          and "onClick: start}" in _tour and "start()" not in _tour.split("function _offer(force)")[1].split("\n  }\n")[0]
          and not any("rfTourStart" in _v for _k, _v in _js.items() if _k != "rf-39p-tour.js")
          # rf-48b (UX 261120 L23) po pierwszym pytaniu woła to samo zaproszenie D8 (`rfTourOffer(true)`)
          and "global.rfTourOffer = _offer;" in _tour
          and "global.rfTourOffer(true)" in _js["rf-48b-firstask.js"]
          and "rfTourStart" not in _html)
    check("t4. przelacznik jezyka przepisuje otwarty krok (rfTourRelang w setLang)",
          'typeof rfTourRelang==="function")rfTourRelang()' in _i18n)
    check("t5. przycisk ma napis „Przewodnik” i ikone pytanie.png, a nazwa dostepna klucz EN",
          '"Przewodnik po panelu: pokażę krok po kroku, gdzie co jest":"' in _i18n
          and '"Przewodnik":"Tour"' in _i18n
          and 'b.setAttribute("aria-label", tip)' in _tour and '<span class="btn-lbl">Przewodnik</span>' in _tour)
    _sels = _re.findall(r'sel: "([^"]+)"', _tour)
    # Zrodla BEZ samego przewodnika — inaczej kazdy selektor "znalazlby sie" w nim samym.
    _src = _html + "".join(_v for _k, _v in _js.items() if _k != "rf-39p-tour.js")
    def _t6_ok(part):
        name = part[1:]
        if part.startswith("#rfpc-"):   # ramka modulu: id skladane w rf-49m jako "rfpc-" + spec.tab
            return 'wrap.id = "rfpc-" + spec.tab' in _src and ('{id:"%s"' % name[5:]) in _src
        if ('b.id = "%s"' % name) in _tour:   # przycisk, ktory przewodnik stawia sam
            return True
        return ('"%s"' % name) in _src or (' %s"' % name) in _src or ('"%s ' % name) in _src
    _miss = [p for x in _sels for p in x.replace(",", " ").split() if p[0] in "#." and not _t6_ok(p)]
    check("t6. kazdy krok celuje w element obecny w zrodlach panelu", len(_sels) >= 8 and not _miss,
          ascii(_miss))

    # --- v. grupa "Wypróbuj" (2026-10-03) ----------------------------------------------------------
    # Celowo: Synth i RibbitBeat wydzielone OBOK modulow jako "Wypróbuj". Pilnujemy, ze
    # Synth naprawde przeszedl do tej grupy (i zachowal kropke), ze trzeci pojemnik jest w jednej
    # liscie klawiatury z dwoma pozostalymi, ze link do gry idzie za nim, a nie za "Modulem", i ze
    # naglowek ma klucz EN.
    print("\n--- v. grupa Wyprobuj (Synth + RibbitBeat) ---")
    check("v1. Synth ma grp:\"play\" i dalej kropke stanu pad",
          '{id:"pad",         label:"Synth",                  panel:pPad,    png:"synth", dot:"pad", grp:"play"}' in _tabs5
          and '(t.grp !== "mod" && t.grp !== "play") || !t.dot' in _cols5)
    check("v2. #rfNavPlay jest tablistem w jednej karcie miedzy Modulami a Narzedziami i w liscie klawiatury",
          'const navPlay = mkList("rfNavPlay");' in _cols5 and 'navSect("Wypróbuj")' in _cols5
          and _cols5.index('navSect("Moduły")') < _cols5.index('navSect("Wypróbuj")') < _cols5.index('navSect("Narzędzia")')
          and '"#rfNavMod","#rfNavMore","#rfNavPlay","#rfNavTools"' in _tabs5)
    check("v3. link RibbitBeat wstawiany za #rfNavPlay (Modul tylko jako zapas)",
          'const lista=document.getElementById("rfNavPlay")||document.getElementById("rfNavMod")' in _tabs5)
    check("v4. naglowek Wyprobuj ma pare EN, a Widocznosc zakladek ma dla niego wlasny wiersz",
          '"Wypróbuj":"Try it out"' in _i18n
          and '_tvL("Wypróbuj", "Try it out"), by("play")' in _js.get("rf-48-tabvis.js", ""))

    # ---- u. klik w powiadomienie systemowe (rf-39q) + Kopiuj/Wytnij skanera bez kliku (29.09) ----
    print("\n--- u. klik w powiadomienie, skaner bez kliku ---")
    _goto = _js.get("rf-39q-notify-goto.js", "")
    check("u1. rf-39q zaladowany przed boot, initNotifyGoto w lancuchu, SSE `goto` obsluzone",
          0 < _html.index('src="/web/js/rf-39q-notify-goto.js"') < _html.index('src="/web/js/rf-40-boot.js"')
          and "initNotifyGoto" in _boot_list
          and 'if(t==="goto"){if(typeof rfNotifyGoto==="function")rfNotifyGoto(m);return;}' in _js.get("rf-08-sse-ui.js", ""))
    check("u2. ?goto uzywany raz (znika z adresu) i miga ta sama klasa co 'Jak udostepnic'",
          "history.replaceState" in _goto and "rfh-blink" in _goto)
    _model = _js.get("rf-50-scan-model.js", "")
    _bez = _re.findall(r"kod: '(\w+)'[^\n]*bezKliku: true", _model)
    check("u3. bez kliku sa DOKLADNIE Kopiuj i Wytnij (klik w tekst kasuje zaznaczenie)",
          sorted(_bez) == ["kopiuj", "wytnij"], _bez)
    _ov = _js.get("rf-50h-scan-overlay.js", "")
    _kn = _ov[_ov.index("function klikNaprawde"):]
    check("u4. klikNaprawde wysyla sam skrot PRZED zbudowaniem klikniecia",
          0 < _kn.index("opis.bezKliku") < _kn.index('"mouse:"'))
    # Katalog kontra wykonanie: kazda akcja z NS.AKCJE ma w klikNaprawde WLASNA droge. Do 29.09
    # przewijanie, przeciaganie i klawiatura spadaly do `|| "left"` i nad pulpitem robily lewy klik.
    _kat = dict(_re.findall(r"kod: '(\w+)', pl:([^\n]*)", _model))   # kod -> reszta wiersza katalogu
    _mapa = _re.search(r"\{ lewy: \"left\"[^}]*\}", _kn).group(0)
    _kody = list(_kat)
    _brak = [k for k in _kody if k != "anuluj"   # anuluj konczy sie w silniku, zanim dojdzie do akcji
             and "rodzaj: 'klawisze'" not in _kat[k]   # klik + skrot albo sam skrot (bezKliku)
             and ('"%s"' % k) not in _kn and ("%s:" % k) not in _mapa]
    check("u5. kazda akcja katalogu ma droge w klikNaprawde (nic nie spada do lewego kliku)",
          len(_kody) >= 16 and not _brak, _brak)

finally:
    rf.SETTINGS_DIR, rf.UI_CONFIG_FILE, _st = _saved
    rf.UI_STATE.clear(); rf.UI_STATE.update(_st)
    rf.tray_menu_refresh = _saved_tray
    shutil.rmtree(tmp, ignore_errors=True)

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
