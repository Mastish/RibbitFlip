# NAKLADKA POKAZUJE CALY KONTROLER, NIE JEDNA REKE. Run: py tests/test_overlay_controller.py
#
# ZGLOSZENIE WLASCICIELA (2026-09-11): „jak aktywuje nakladke z kontrolerem na kapslu 2, a np.
# kontroler obslugiwany jest przez kapsel 1 i 2, to widze tylko input z kapsla 2 na nakladce.
# idealnie by bylo, gdyby kontroler to byla osobna nakladka, zeby mozna bylo jeden kontroler
# kilkoma kapslami obslugiwac — co juz sie dzieje — ale zeby bylo to widoczne wszystko na jednej".
#
# I tak wlasnie bylo. Nakladka to KOLUMNA JEDNEGO KAPSLA (ovlColumns w rf-41 chowa wszystkie poza
# ta z `?dev=`), a rysunek pada w srodku czytal `gpvSnapshot(D)` — reguly i ruch tego jednego.
# Rysowal wiec polowe przedmiotu, ktorego gra i tak widzi w calosci, jako jednego gracza, i nie
# mial jak powiedziec, ze to polowa.
#
# CZEGO TEN PLIK PILNUJE:
#
#   * JEDNA MATEMATYKA SCALANIA. Zakladka „Kontroler" scala pady od dnia, w ktorym hub stal sie
#     pad-centryczny (`padMergedSnap` w rf-44). Nakladka ma z tego KORZYSTAC, a nie liczyc drugi
#     raz — druga kopia rozjechalaby sie z panelem w pierwszym tygodniu (ten projekt ma juz taki
#     przypadek: dwie listy wygladow kola, patrz RF_LOOKS w rf-41).
#   * WYBOR POKAZUJE SIE, GDY ZACZYNA COS ZNACZYC. Przelacznik „ten kapsel / caly kontroler" i
#     wiersz chipow „kto na nim gra" istnieja dopiero od DWOCH kapsli na kontrolerze. Przy jednym
#     obie odpowiedzi znacza to samo, a pytanie bez dwoch roznych odpowiedzi to nie wybor, tylko
#     kontrolka do przeczytania.
#   * OKNO DALEJ NALEZY DO KAPSLA. `cfg.pad` jest ETYKIETA („zrobiono je dla Kontrolera N"), z
#     ktorej biora sie tytul i rzad w galerii — nie drugim rodzajem okna. Celowo,
#     swiadomie przeciwko zarezerwowanemu identyfikatorowi w stylu `d0~kolo`.
#   * ETYKIETA PRZECHODZI PRZEZ REJESTR. Identyfikator pada, ktorego juz nie ma (kontroler
#     usunieto), robi z okna zwykla nakladke kapsla — nie sierote w rzedzie, do ktorego nie
#     da sie wejsc.
#   * PANEL SIE NIE ZMIENIL. `data-pad` na widgecie stawia WYLACZNIE nakladka; kolumna w panelu
#     i mapa w zakladce „Kontroler" nigdy go nie niosa, wiec malowanie ida stara sciezka.
#
# Nic tu nie otwiera okna i nic nie dotyka Settings/ uzytkownika: warstwa serwera jest sprawdzana
# na sanityzatorze w katalogu tymczasowym, a warstwa przegladarki na ZRODLE.
import os
import sys

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


_WEB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "web")


def _read(*parts):
    with open(os.path.join(_WEB, *parts), "r", encoding="utf-8") as f:
        return f.read()


_ovl = _read("js", "rf-41-overlay.js")
_editor = _read("js", "rf-41c-overlay-editor.js")
_gal = _read("js", "rf-41d-overlay-gallery.js")
_pad = _read("js", "rf-42-padview.js")
_hub = _read("js", "rf-44-pad-hub.js")
_gpv_css = _read("css", "14b-gamepad.css")
_gal_css = _read("css", "24-overlay-gallery.css")

print("\n--- serwer zna dwa nowe pola okna ---")
check("okno ma `pad` (etykieta kontrolera) i `padScope`",
      rf.OVERLAY_WIN_DEFAULTS.get("pad") == "" and rf.OVERLAY_WIN_DEFAULTS.get("padScope") == "all")
check("domyslnie widac CALY kontroler, bo rysunek pada jest rysunkiem jednego przedmiotu",
      rf.OVERLAY_WIN_DEFAULTS["padScope"] == "all")
check("chipy „kto na nim gra” sa czescia sciagi, nie osobnym przelacznikiem okna",
      "pad.who" in rf.OVERLAY_SHOW_KEYS and rf.OVERLAY_WIN_DEFAULTS["show"]["pad.who"] is True)
check("...i sa DROBIAZGIEM pada, wiec nie wchodza do kolejnosci blokow",
      "pad.who" not in rf.OVERLAY_ORDER_KEYS and "pad" in rf.OVERLAY_ORDER_KEYS)

_s = rf._sanitize_overlay_win({"pad": "p2", "padScope": "own"})
check("sanityzator przepuszcza jedno i drugie", _s["pad"] == "p2" and _s["padScope"] == "own", _s)
check("...i odrzuca zakres, ktorego nie ma, zamiast zapisac go do pliku",
      rf._sanitize_overlay_win({"padScope": "wszystko"})["padScope"] == "all")
check("...a identyfikator pada tnie do dlugosci, ktora zmiesci sie w nazwie okna",
      len(rf._sanitize_overlay_win({"pad": "p" * 90})["pad"]) == 24)
check("pole `pad` nie jest walidowane przeciw rejestrowi — bo plik ustawien czyta sie PRZED nim",
      rf._sanitize_overlay_win({"pad": "pNieistnieje"})["pad"] == "pNieistnieje")
check("okno bez tych pol dostaje domyslne, a nie None",
      rf._sanitize_overlay_win({})["pad"] == "" and rf._sanitize_overlay_win({})["padScope"] == "all")

print("\n--- rysunek scala JEDNA matematyka, ta z zakladki „Kontroler” ---")
check("rf-42 ma osobna sciezke malowania pada scalonego",
      "function gpvPaintMerged(box,padId,keep)" in _pad)
check("...i bierze migawke z rf-44, zamiast liczyc scalanie drugi raz",
      "padMergedSnap(padId)" in _pad and "_gpvFlash" not in _pad.split("function gpvPaintMerged")[1][:3000])
check("...odmawia, gdy takiego kontrolera nie ma w rejestrze (wolajacy wraca do kapsla)",
      'if(typeof padById!=="function"||typeof padMergedSnap!=="function"||!padById(padId))return false;' in _pad)
_merged = _pad.split("function gpvPaintMerged")[1].split("\n// Per-frame paint")[0]
check("obwodka nosi kolor kapsla, ktorym przycisk wchodzi",
      'padCapColor(snap.src[b])' in _merged)
check("...a przycisk obslugiwany przez DWA kapsle wraca na neutralna",
      "(snap.mapped[b]&&!snap.multi[b])?padCapColor(snap.src[b]):\"\"" in _merged)
check("...dokladnie tym samym wyrazeniem, co mapa w panelu (jedno zdanie, dwa miejsca)",
      "(snap.mapped[b]&&!snap.multi[b])?padCapColor(snap.src[b]):\"\"" in _hub)
check("kolor wchodzi do odcisku przycisku, inaczej przepiecie kapsla nie przemalowaloby obwodki",
      '(snap.live[b]?"l":"")+"|"+col' in _merged)
check("dwa drazki naraz — po jednym na reke — bo scalony pad bywa sterowany dwiema",
      "for(const s of snap.sticks)" in _merged)
check("podpis mowi, KTORY kapsel wlasnie strzelil, gdy pad jest wspolny",
      "(shared&&snap.capDev?padCapName(snap.capDev)+\" · \":\"\")" in _merged)

print("\n--- przelacznik jest jeden i stoi w nakladce ---")
check("to `data-pad` na widgecie decyduje o sciezce malowania",
      "if(box.dataset.pad&&gpvPaintMerged(box,box.dataset.pad,keep))continue;" in _pad)
check("stawia go WYLACZNIE nakladka",
      "box.dataset.pad=want" in _ovl and "dataset.pad" not in _hub)
check("...a mapa w zakladce „Kontroler” maluje sie po staremu, wlasna funkcja",
      "function padViewFrame()" in _hub and "gpvPaintMerged" not in _hub)
check("nakladka scala dopiero od DWOCH kapsli na kontrolerze",
      "const want=(mem.length>1)?pid:\"\";" in _ovl)
check("...i czysci odciski przy przelaczeniu, bo obie sciezki licza klucz inaczej",
      "box._numV=null; box._whoV=null; box._sk=null; box._st=null;" in _ovl)
check("zapisany kontroler wygrywa, ale tylko gdy jeszcze istnieje",
      "function ovlPadOwner()" in _ovl and 'if(want&&typeof padById==="function"&&padById(want))return want;' in _ovl)
check("...inaczej okno pokazuje pada, w ktory wpiety jest jego kapsel",
      'return (typeof gpvPadId==="function")?gpvPadId(RF_OVL_DEV):"";' in _ovl)
check("„own” to jedyna droga do starego zachowania, i jest swiadoma",
      'function ovlPadScope(){return (OVL.cfg&&OVL.cfg.padScope==="own")?"own":"all";}' in _ovl)

print("\n--- rejestr padow dociera do okna kazda z trzech drog ---")
check("hak siedzi w `_padsTake`, a nie w `onPads`",
      "_padsTake=function(){const r=_pt.apply(this,arguments)" in _ovl)
check("...bo odpytanie przy starcie i odpowiedz na zapis omijaja zdarzenie SSE",
      "function padsFetch(){" in _hub and "_padsTake(m)" in _hub
      and "function onPads(m){ _padsTake(m||{}); }" in _hub)

print("\n--- pasek okna nazywa to, co pokazuje ---")
check("okno zrobione dla kontrolera mowi „Kontroler N”, nie nazwa kapsla",
      "t.textContent=ctl?ctl:(lab?(cap+\" · \"+lab):cap);" in _ovl)
check("...a nazwa idzie z rejestru, wiec zmiana nazwy kontrolera dochodzi tu sama",
      'padLabel(pid):""' in _ovl and "function padLabel(id){" in _hub)

print("\n--- „kto na nim gra”: legenda jest czescia rysunku, nie drugim zdaniem ---")
check("wiersz chipow stoi w znacznikach pada",
      '<div class="ov-pad-who" aria-hidden="true"></div>' in _pad)
check("...wypelnia go WYLACZNIE malowanie scalone, wiec w panelu zostaje pusty",
      'box._who.innerHTML=sig?' in _merged and "ov-pad-who" not in _hub)
check("...pusty znika sam",
      ".ov-pad-who:empty{display:none}" in _gpv_css)
check("kropka chipu ma DOKLADNIE kolor obwodki tego kapsla — jedna legenda, nie dwie",
      "background:var(--dcol,#8a8375)" in _gpv_css and "'<span class=\"ov-pad-chip\" style=\"--dcol:'" in _merged)
check("jeden kapsel nie dostaje zadnego chipu (podpis „tylko ja” to nie informacja)",
      "const sig=shared?mem.map(" in _merged)
check("da sie go zgasic jak kazda inna czesc",
      '{key:"pad.who", label:"kto na nim gra", cls:"ovl-no-padwho", parent:"pad"}' in _ovl
      and ".ovl-no-padwho .ov-pad-who{display:none}" in _gpv_css)
check("...i podswietla sie z edytora, jak kazda inna czesc",
      '"pad.who":".ov-pad-who"' in _ovl)

print("\n--- edytor pyta tylko wtedy, gdy jest o co ---")
check("wiersz zakresu istnieje wylacznie przy „kontrolerze”",
      'p.key === "pad"' in _editor and 'class="ovm-row ovm-padscope" id="ovmPadScope" hidden' in _editor)
check("...i odslania sie od dwoch kapsli na kontrolerze",
      "psRow.hidden = mem.length < 2;" in _editor)
check("...liczonych z REJESTRU, bo pytanie brzmi „czy jest tu co wybierac TERAZ”",
      'const pid = (typeof gpvPadId === "function") ? gpvPadId(w.dev) : "";' in _editor)
check("klikniecie zapisuje do OKNA, nie do kapsla",
      "ovmSend(w.wid, { padScope: ps.dataset.scope }, true)" in _editor)
check("pigulka nie zwija bloku, w ktorym stoi",
      _editor.index('const ps = e.target.closest(".ovm-pscope");')
      < _editor.index('const row = e.target.closest(".ovm-blk-row");'))
check("„pusto” pyta o caly kontroler, gdy rysunek jest scalony",
      "if (out.pad && (!cfg || cfg.padScope !== \"own\"))" in _editor
      and "if (mem.length > 1) out.pad = mem.every(_mute);" in _editor)
check("...i dostaje config okna, zeby miec czym to rozstrzygnac",
      "_ovmEmptyBlocks(w.dev, c)" in _editor and "function _ovmEmptyBlocks(dev, cfg)" in _editor)

print("\n--- galeria: kontroler ma wlasny rzad ---")
check("rzad powstaje dla kazdego kontrolera, w ktory wpiety jest kapsel",
      "function _ovgCtlPads()" in _gal and "padList().filter(p => padMembers(p.id).length)" in _gal)
check("...takze dla takiego BEZ nakladki — rzad z samym plusem pokazuje, ze da sie ja zrobic",
      "for (const w of mine) html += tile(w, mine);" in _gal
      and 'const first = row.querySelector(".ovg-tile[data-win]"); if (!first) continue;' in _gal)
check("nagłowek niesie chipy kapsli — i to jest cale wytlumaczenie tej nakladki",
      'class="ovg-capchip"' in _gal and "padCapName(d)" in _gal)
check("okno kontrolera stoi w JEDNYM rzedzie, nie w dwoch naraz",
      "const capWins = wins.filter(w => !_ovgPadOf(w));" in _gal)
check("etykieta przechodzi przez rejestr — kontroler usuniety oddaje okno kapslowi",
      "function _ovgPadOf(w)" in _gal
      and 'if (typeof padById !== "function" || !padById(pid)) return "";' in _gal)
check("sklad kontrolerow wchodzi do sygnatury, wiec wpiecie kapsla przerysowuje pas",
      'padMembers(p.id).join(",")' in _gal)
check("plus kontrolera nie otwiera menu szablonow — rodzaj okna rozstrzygnal rzad",
      'if (nw.dataset.pad) { _ovgCloseMenu(); _ovgAddCtl(nw.dataset.dev, nw.dataset.pad, nw); return; }' in _gal)
check("nowe okno ma pad i wiersz „kto na nim gra”, i nic wiecej",
      'return { pad: padId, padScope: "all", label: "",' in _gal
      and '_ovgShow(["pad", "pad.who"])' in _gal)
check("...i nalezy do kapsla, nie do kontrolera",
      'ovlPost({ act: "add", dev: dev, config: _ovgCtlCfg(padId) })' in _gal)
check("rzad kontrolera nie udaje koloru jednego kapsla",
      ".ovg-grp-ctl>.ovg-cap{border-left-style:dashed" in _gal_css)

print("\n--- „Tylko kontroler” wreszcie dotrzymuje tego, co obiecuje ---")
check("szablon robi nakladke kontrolera, gdy kapsel jest w cokolwiek wpiety",
      'if (tplKey === "pad") {' in _gal and "body.config = _ovgCtlCfg(pid);" in _gal)
check("...a przy dwoch kapslach nazywa konkretny kontroler i wymienia obie rece",
      'if (t.k === "pad" && mem0.length > 1)' in _gal
      and 'hint = mem0.map(d => padCapName(d)).join(" + ");' in _gal)

print("\n--- droga jednym klikiem: z zakladki „Kontroler” ---")
check("nagłowek pudelka kontrolera ma ikone nakladki",
      'ovl.className="ph-tool ph-ovl"' in _hub and '<span class="rfic ovl-ic" aria-hidden="true">' in _hub)
check("...ta sama, co na kapslu w „Twoje urzadzenia” — bez nowej wiedzy do przekazania",
      "ovl-ic" in _read("js", "rf-11-devices-ui.js"))
check("klik pokazuje albo chowa; okna jeszcze nie ma — robi je",
      "function padOverlayToggle(pid)" in _hub
      and "if(typeof _ovgAddCtl===\"function\")_ovgAddCtl(mem[0],pid,null);" in _hub
      and 'ovlPost({act:"toggle",win:win.wid,dev:win.dev})' in _hub)
check("pusty kontroler zostawia przycisk na miejscu i mowi dlaczego",
      "if(!padMembers(pid).length){ovl.disabled=true;" in _hub
      and "Najpierw wepnij w ten kontroler kapsel" in _hub)
check("ikona swieci razem z oknem, takze gdy zamknieto je z zasobnika",
      "const w=_padOvlWin(p.id);return w?(w.wid+(w.running?\"!\":\"\")):\"\";" in _hub)

print("\n--- angielski nadazyl ---")
for pl, en in [("kto na nim gra", "who plays on it"),
               ("Pokazuj", "Show"),
               ("cały kontroler", "the whole controller"),
               ("ten kapsel", "this capsule only"),
               ("nakładka kontrolera", "controller overlay")]:
    src = _ovl if pl == "kto na nim gra" else (_gal if "nakładka" in pl else _editor)
    check("para EN: „%s”" % pl, ('"%s": "%s"' % (pl, en)) in src or ('"%s":"%s"' % (pl, en)) in src)
check("zdania zlozone w kodzie (`_gl`) nie potrzebuja slownika i go nie dostaly",
      '_gl("Pokaż ten kontroler nad grą' in _hub)

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
