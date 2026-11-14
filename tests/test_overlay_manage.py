# NAKLADKAMI DA SIE ZARZADZAC Z PANELU. Run: py tests/test_overlay_manage.py
#
# Do 2026-08-31 wszystko, co da sie nakladce ustawic, dalo sie ustawic WYLACZNIE w niej samej —
# w szufladzie pod jej paskiem. Panel mial jeden rzad przyciskow (pokaz / schowaj / + / x), wiec
# zeby zmienic cokolwiek w oknie, trzeba je bylo najpierw postawic nad gra i trafic w pasek szeroki
# na pol centymetra. Cale zarzadzanie nakladkami ma sie odbywac w nakladce, ale tez na ekranie
# Nakladka na stronie aplikacji: zmiana proporcji, wielkosci, ukladow, dodawanie wiecej nakladek
# pod kapsel i edytowanie kazdej z osobna.
#
# Co tu jest sprawdzane — i czego tu nie ma:
#
#   * KANON JEST JEDEN. Karta w panelu rysuje z tych samych list, co szuflada okna (czesci, wyglady,
#     obrysy, proporcje). Dwie listy tego samego juz raz sie w tym pliku rozjechaly (wyglady:
#     "Jasna karta" kontra "Jasny"), wiec kazda nowa powierzchnia musi czerpac, a nie kopiowac.
#   * OKNO KOLA DA SIE USTAWIC. Serwer celowo pomija je we wszystkich listach okien, ale odpowiada
#     na pytanie PO NAZWIE i nie tworzy go przy tym — i to jest jedyna droga, ktora ma karta.
#     Od 2026-09-06 wyglad tego okna wybiera sie DWOMA rekami do jednej wartosci: tutaj (ekran
#     „Nakladka") i w karcie kola, w sekcji „Gdzie pokazywac kolo" — ale tymi samymi kaflami i z tej
#     samej listy kodow (OVL_WHEEL_THEMES z RF_LOOKS), wiec to jedno ustawienie ogladane z dwoch
#     stron, a nie dwa. Patrz test_wheel_window.py.
#     A CZEGO TO OKNO NIE MA: ani jednej czesci sciagi poza samym kolem i ani jednego paska. To nie
#     jest kosmetyka — czesc wlaczona tu wisi nad gra w oknie bez ✕, przezroczystym dla klikniec.
#   * ZAPIS IDZIE DO OKNA, NIE DO KAPSLA. `win`, nigdy `dev`: dwa okna jednego kapsla maja dwa
#     komplety ustawien, a `dev` trafia zawsze w pierwsze z nich.
#   * PROPORCJE MIESZCZA SIE W TYM, CO PRZYJMUJE SERWER. Przelicznik w przegladarce tnie do tych
#     samych granic, co `_sanitize_overlay_win`; inaczej "9:16" przy szerokim oknie dawaloby
#     wysokosc, ktora serwer po cichu przycina, i pigulka gasla po wlasnym kliknieciu.
#   * PASEK NAZWANYCH UKLADOW WIDAC. Regresja z tego samego dnia: ramka dwoch zakladek "Reszty"
#     (rf-49p) nosi te sama klase `.rfpc`, co ramka modulu, wiec regula chowajaca cienki pasek
#     tozsamosci w modulach wygasila po cichu takze pasek ukladow nakladek i pasek osi 3D.
#
# Zadne okno nie jest tu otwierane i nic nie dotyka prawdziwego Settings/: manager dostaje plik
# ustawien w katalogu tymczasowym, a warstwa przegladarki jest sprawdzana na ZRODLE.
import json
import os
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


def mgr(seed=None):
    path = os.path.join(tempfile.mkdtemp(prefix="rf-ovm-"), "ribbitflip_overlay.json")
    if seed is not None:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(seed, f)
    rf.OVERLAY_CONFIG_FILE = path
    m = rf.OverlayManager()
    m.available = lambda: (True, "")
    return m, path


_WEB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "web")


def _read(*parts):
    with open(os.path.join(_WEB, *parts), "r", encoding="utf-8") as f:
        return f.read()


def _read_py():
    """Serwer — czytany jako TEKST, bo sprawdzamy jedno zdanie jego logiki (kiedy okno gasi Windows,
    a kiedy strona), a nie zachowanie, ktore dalo by sie wywolac bez pulpitu."""
    with open(os.path.join(os.path.dirname(_WEB), "ribbitflip_monitor.py"), "r", encoding="utf-8") as f:
        return f.read()


_manage = _read("js", "rf-41b-overlay-manage.js")
_editor = _read("js", "rf-41c-overlay-editor.js")
_gal = _read("js", "rf-41d-overlay-gallery.js")
_rest = _read("js", "rf-49p-resttabs.js")
_wheel = _read("js", "rf-46-wheel.js")
_gal_css = _read("css", "24-overlay-gallery.css")
_mod_css = _read("css", "22-modtabs.css")
_ovl = _read("js", "rf-41-overlay.js")
_tabs = _read("js", "rf-34-tabs.js")
_lay = _read("js", "rf-49f-overlay-layouts.js")
_boot = _read("js", "rf-40-boot.js")
_html = _read("ribbitflip_dashboard.html")
_css = _read("css", "23-overlay-manage.css")
_presets_css = _read("css", "21-presets.css")

print("\n--- karta istnieje i jest wpieta tam, gdzie ma dzialac ---")
check("obie czesci karty sa zaladowane przez strone",
      "/web/js/rf-41b-overlay-manage.js" in _html and "/web/js/rf-41c-overlay-editor.js" in _html)
check("...po rf-41, bo z niego czytaja stan i kanony",
      _html.index("rf-41-overlay.js") < _html.index("rf-41b-overlay-manage.js"))
check("arkusz karty jest zaladowany PRZED skorka nakladki",
      "/web/css/23-overlay-manage.css" in _html
      and _html.index('href="/web/css/23-overlay-manage.css"')
      < _html.index('href="/web/css/15-overlay.css"'))
check("bootstrap ja montuje po zakladkach, a przed paskiem ukladow",
      "initTabs,initTabVis,initOvlManage,initOvlLayoutBar," in _boot)
check("w oknie samej nakladki karty nie ma (panel jest tam tylko do czytania)",
      'if (typeof RF_OVL !== "undefined" && RF_OVL) return;' in _manage)
check("karta wchodzi do panelu ekranu „Nakladka”, nad sciage",
      'document.getElementById("tab-wszystkie")' in _manage
      and "panel.insertBefore(card, ovCard)" in _manage)

print("\n--- przyciski nakladek przeprowadzily sie ze sciagi do karty ---")
check("nagłowek sciagi nie trzyma juz paska nakladek",
      'id="ovlBtns"' not in _tabs and 'id="ovlGroup"' not in _tabs)
check("...a karta trzyma (ten sam pasek, ten sam kod rf-41)",
      'id="ovlBtns"' in _manage and 'id="ovlGroup"' in _manage)
check("...i sciaga zostala przy swoim jednym przycisku",
      'id="ovWin"' in _tabs)
check("pasek nazwanych ukladow montuje sie w karcie",
      'document.getElementById("ovmCard") || document.getElementById("overviewCard")' in _lay)
# REGRESJA Z 2026-08-31: ramka "Reszty" (rf-49p) nosi te sama klase `.rfpc`, co ramka modulu, wiec
# regula chowajaca cienki pasek tozsamosci w modulach wygasila takze pasek ukladow nakladek
# (zakladka Nakladka) i pasek osi 3D (Czujnik) — oba byly w DOM-ie z `display:none`.
check("...i nie jest chowany razem z paskami w modulach",
      ".rfpc:not(.rfpc-rest) .rf-cfgbar{display:none}" in _presets_css
      and ".rfpc .rf-cfgbar{display:none}" not in _presets_css)

print("\n--- jeden kanon list, nie drugi komplet ---")
check("proporcje maja jedna liste, po stronie rf-41", "const OVL_RATIOS=[" in _ovl)
check("...i nikt ich sobie nie przepisuje", "OVL_RATIOS=[" not in _manage + _editor)
# OVL_RATIOS wypadlo z tej listy 2026-09-01: proporcji nie da sie juz USTAWIC (wielkosc okna jest
# wynikiem, nie ustawieniem), a nazwe tego, co wyszlo, dokleja `ovlRatioOf` — patrz nizej.
for _lst in ("OVL_PARTS", "OVL_SCALE_PARTS", "OVL_THEMES", "OVL_OUTLINES"):
    check("edytor czerpie z „%s”" % _lst, _lst in _editor, _lst)
    check("...i nie definiuje jej u siebie" % (),
          ("const " + _lst) not in _editor and ("const " + _lst) not in _manage, _lst)
# Od 2026-09-01 kanon jest DRZEWEM: pozycja z `parent` to drobiazg wewnatrz bloku, a nie kolejny
# element w jednym rzedzie. Edytor liczy z niego i bloki, i ich rozwiniecia.
check("wiersze czesci sa liczone z kanonu, a nie wypisane recznie",
      "_ovmBlocks().map(_ovmBlockHtml)" in _editor and "OVL_BLOCKS" in _editor
      and "ovlSubParts" in _editor)
check("...a kanon jest drzewem: blok i jego drobiazgi",
      "const OVL_BLOCKS=OVL_PARTS.filter(p=>!p.parent" in _ovl
      and 'parent:"rules"' in _ovl and 'parent:"pose"' in _ovl)
check("dwa zestawy podpowiedzi wygladow (zwykla nakladka / okienko kola), jedna lista kodow",
      "const OVL_WHEEL_THEMES=RF_LOOKS.map" in _ovl and "OVL_WHEEL_THEMES" in _editor)

print("\n--- wielkosc: to, co liczy przegladarka, musi sie miescic w tym, co przyjmuje serwer ---")
# Granice sanitizera sa TU, po stronie Pythona; dopasowanie w przegladarce ma je powtarzac.
_lo_w = rf._sanitize_overlay_win({"w": 1})["w"]
_hi_w = rf._sanitize_overlay_win({"w": 99999})["w"]
_lo_h = rf._sanitize_overlay_win({"h": 1})["h"]
_hi_h = rf._sanitize_overlay_win({"h": 99999})["h"]
check("serwer trzyma szerokosc w 180..4000 i wysokosc w 120..4000",
      (_lo_w, _hi_w, _lo_h, _hi_h) == (180, 4000, 120, 4000), (_lo_w, _hi_w, _lo_h, _hi_h))
check("...a dopasowanie tnie do tych samych liczb",
      "Math.max(180,Math.min(4000" in _ovl and "Math.max(120,Math.min(4000" in _ovl)
check("nazwa proporcji ma tolerancje, bo okno jest dopasowane co do piksela",
      "function ovlRatioOf" in _ovl and "0.015" in _ovl)
# PROPORCJI SIE NIE WYBIERA (2026-09-01). Byla przyciskiem w obu miejscach; dzis jest OPISEM tego,
# co wyszlo z ustawien — bo wielkosc okna jest wynikiem, a nie ustawieniem.
check("nigdzie nie ma juz przyciskow proporcji",
      "ovl-ratio" not in _ovl and "ovm-ratio" not in _editor
      and "function ovlRatioApply" not in _ovl)
check("...a nazwa proporcji stoi tam, gdzie sie CZYTA wielkosc",
      "ovlRatioOf(ww, hh)" in _editor and "ovlRatioOf(c.w, c.h)" in _gal)
check("...i pola liczbowe zapisuja na `change`, nie na `input`",
      '.addEventListener("change"' in _ovl and 'host.addEventListener("change"' in _editor)

print("\n--- okno kola: da sie ustawic, ale samo pytanie go nie tworzy ---")
M, _ = mgr()
_st = M.state("d0~kolo")
check("pytanie po nazwie odpowiada", _st["window"]["win"] == "d0~kolo")
check("...oddaje ustawienia FABRYCZNE okna kola, nie zwyklej nakladki",
      _st["window"]["config"]["clickThrough"] is True
      and _st["window"]["config"]["followCursor"] is True
      and _st["window"]["config"]["show"]["wheel"] is True
      and _st["window"]["config"]["show"]["rules"] is False)
check("...i niczego nie stworzylo", "d0~kolo" not in M.wins)
# CO PANEL DOSTAJE NA PYTANIE O OKNO, KTOREGO JESZCZE NIE MA — i dlaczego to musi byc juz czyste.
# Ta odpowiedz jest szablonem: pierwszy ruch suwaka w karcie kola ZAPISUJE ja jako konfiguracje
# tego okna. Gdyby niosla wlaczone czesci sciagi, kazda swieza instalacja rodzilaby okno, w ktorym
# nad gra wisi spis wycinkow („wheel.list", dolozony 2026-09-01) — napis bez paska i bez ✕, ktorego
# nie da sie ani chwycic, ani zamknac. Pytamy PETLA po wszystkich czesciach, a nie po liscie nazw:
# nowa czesc sciagi ma zapalic ten test, a nie zostac nad gra.
_shw = _st["window"]["config"]["show"]
_on = sorted(k for k in rf.OVERLAY_SHOW_KEYS if _shw.get(k))
check("...i to, co panel dostaje jako szablon, pokazuje TYLKO kolo",
      _on == ["card", "wheel"], _on)
check("...w tym spis wycinkow jest WYLACZONY (to on wisial nad gra)",
      _shw.get("wheel.list") is False, _shw.get("wheel.list"))
# Pasek: „nie" pada dwa razy i obie odpowiedzi musza sie zgadzac — raz w danych (`winBar`), raz
# w tym, co panel czyta o oknie (`hasBar`, ta sama odpowiedz, co has_bar() daje zywemu oknu).
check("...i pasek jest wylaczony juz w samym szablonie, nie dopiero w warunku po drodze",
      _st["window"]["config"]["winBar"] is False and _st["window"]["hasBar"] is False)
check("panel pyta wlasnie tak (po nazwie, oknem po oknie)",
      "const OVM_WHEEL_SUF" in _manage and "function ovmCfgFetch" in _manage
      and "ovlGet(wid)" in _manage)
# Od 2026-09-01 ta sama droga obsluguje takze okna, ktorych JESZCZE NIE MA (swieza instalacja,
# kapsel bez ani jednej nakladki): bez tego kafelek i miniatura pokazywalyby pustke, choc serwer
# potrafi powiedziec, jak takie okno bedzie wygladac.
check("...i tak samo o okna, ktorych jeszcze nie utworzono",
      "if (!mine.length && !have[dev]) want.push(dev);" in _manage
      and "w.config || _ovmCfg[wid] || null" in _manage)
# …a zapis TWORZY je i zostawia reszte fabrycznych ustawien nietknieta: zmiana samego wygladu nie
# ma prawa zrobic z okienka pod kursorem kremowej karty, ktora lapie mysz.
M.configure("d0~kolo", {"theme": "neon"})
_c = M.wins["d0~kolo"].cfg
check("zapis wygladu tworzy okno kola i nie rusza reszty",
      _c["theme"] == "neon" and _c["clickThrough"] is True and _c["followCursor"] is True
      and _c["show"]["wheel"] is True and _c["show"]["head"] is False, _c["theme"])
_c_on = sorted(k for k in rf.OVERLAY_SHOW_KEYS if _c["show"].get(k))
check("...i nowo utworzone okno kola dalej pokazuje TYLKO kolo, bez paska",
      _c_on == ["card", "wheel"] and _c["winBar"] is False, (_c_on, _c["winBar"]))
check("...i nadal nie ma go w listach okien",
      "d0~kolo" not in M.state()["windows"] and "d0~kolo" not in M.state()["order"])
check("...ani w migawce ukladu (uklad mowi, gdzie stoja okna; to nigdzie nie stoi)",
      "d0~kolo" not in M.layout_snapshot())
# STARY PLIK USTAWIEN TEZ. Sama zmiana domyslnych niczego nie zdejmuje z ekranu: kto raz uzyl kola
# przy kursorze, ma `show` tego okna ZAPISANE — z odciskiem domyslnych z dnia zapisu, czyli
# z „wheel.list": true — i to zapis wygrywal scalanie. Dlatego okno kola jako jedyne ma
# w `_sanitize_overlay_win` zapis PRZEGRYWAJACY z domyslnymi; wolno tak, bo edytor czesci dla tego
# okna jest schowany (rf-41c), wiec to `show` nigdy nie bylo niczyim wyborem — jest odciskiem
# domyslnych, a nie ptaszkami, ktore ktos postawil.
_MOLD, _ = mgr({"windows": {"d0~kolo": {"w": 500, "h": 500, "theme": "glass", "winBar": True,
                                        "show": {"wheel.list": True, "rules": True, "head": True}},
                            "d0": {"show": {"wheel.list": True, "rules": True}}}})
_old_on = sorted(k for k in rf.OVERLAY_SHOW_KEYS if _MOLD.wins["d0~kolo"].cfg["show"].get(k))
check("plik sprzed poprawki wczytuje sie juz bez wiszacego nad gra spisu wycinkow",
      _old_on == ["card", "wheel"] and _MOLD.wins["d0~kolo"].cfg["winBar"] is False, _old_on)
check("...ale wielkosc i wyglad, ktore ktos naprawde wybieral, zostaja",
      (_MOLD.wins["d0~kolo"].cfg["w"], _MOLD.wins["d0~kolo"].cfg["theme"]) == (500, "glass"))
check("...a zwykla nakladka NIE jest czyszczona — tam ptaszki postawil czlowiek",
      _MOLD.wins["d0"].cfg["show"]["wheel.list"] is True
      and _MOLD.wins["d0"].cfg["show"]["rules"] is True
      and _MOLD.wins["d0"].cfg["winBar"] is True)

print("\n--- ustawienia naleza do OKNA ---")
M2, _ = mgr()
M2.configure("d0", {"theme": "dark", "w": 600, "h": 400, "label": "drazek"})
M2.configure("d0~2", {"theme": "bare", "w": 300, "h": 300})
check("dwa okna jednego kapsla trzymaja dwa komplety",
      M2.wins["d0"].cfg["theme"] == "dark" and M2.wins["d0~2"].cfg["theme"] == "bare"
      and M2.wins["d0"].cfg["w"] == 600 and M2.wins["d0~2"].cfg["w"] == 300)
# Panel wysyla LATKE, nie caly config — a serwer sklada ja z tym, co okno juz ma. Bez tego jeden
# suwak kasowalby wszystkie pozostale ustawienia okna.
M2.configure("d0", {"opacity": 55})
check("latka dokleja sie do tego, co bylo (jeden suwak nie kasuje reszty)",
      M2.wins["d0"].cfg["opacity"] == 55 and M2.wins["d0"].cfg["theme"] == "dark"
      and M2.wins["d0"].cfg["label"] == "drazek")
M2.configure("d0", {"show": {"press": True}})
check("...takze w podslownikach (`show` scala sie, a nie podmienia)",
      M2.wins["d0"].cfg["show"]["press"] is True and M2.wins["d0"].cfg["show"]["head"] is True)
check("panel adresuje zapis oknem, nie kapslem",
      'ovlPost({ win: p.wid' in _manage and 'act: "config"' in _manage)
check("...i scala latki po swojej stronie tak samo (show / scaleParts osobno)",
      "function _ovmMerge" in _manage and "patch.scaleParts" in _manage)
check("czekajaca zmiana INNEGO okna leci przed zmiana kafelka, zamiast przepasc",
      "if (_ovmPend && _ovmPend.wid !== wid) _ovmFlush();" in _manage)

print("\n--- edytor pokazuje tylko to, co dane okno ma ---")
check("okienko kola nie dostaje miejsca, wielkosci, czesci, rozmiaru calosci ani nazwy",
      'geom.style.display = w.wheel ? "none"' in _editor
      and 'parts.style.display = w.wheel ? "none"' in _editor
      and 'srow.style.display = w.wheel ? "none"' in _editor
      and 'nrow.style.display = w.wheel ? "none"' in _editor)
check("...i mowi, dlaczego oraz gdzie te rzeczy stoja",
      "chodzi za kursorem" in _editor and "Wielkości koła" in _editor)
check("obrys tylko tam, gdzie nie ma karty pod literami (jak w szufladzie)",
      '(theme === "bare" && !hasBg)' in _editor)
check("pola nie sa przepisywane pod palcem (odczyt leci co 4 s)",
      "document.activeElement !== el" in _editor and "document.activeElement !== s" in _editor)
# Do 2026-09-01 zapalalo sie to na sciadze POD karta; sciaga zeszla na wlasna zakladke, wiec
# pytanie „ktory to prostokat" odpowiada teraz miniatura — czyli TO SAMO okno, o ktorym mowa.
# Kanon selektorow zostaje po stronie nakladki (OVL_PART_SEL), bo tam sie go uzywa.
check("najechanie na wiersz czesci podswietla ja w podgladzie",
      "ovgHighlight(part, on)" in _editor and "OVL_PART_SEL" not in _editor)
check("...a zapala to strona nakladki, bo tam stoi kanon selektorow",
      "window.rfOvlPreviewHighlight=function(part,on)" in _ovl
      and "OVL_PART_SEL[part]" in _ovl and 'classList.toggle("ovl-hl"' in _ovl)
check("kafelek okna nie przelacza nakladki, tylko wybiera ja do edycji",
      "function ovmSelect" in _manage and "act: \"toggle\"" not in _manage)
check("kafelki niosa to, co RÓZNI okna, a nie trzy razy nazwe kapsla",
      "function _ovgOwnName" in _gal and 'mine.length > 1' in _gal
      and '_gl("nakładka ", "overlay ")' in _gal)

print("\n--- przezroczystosc robi WINDOWS, a nie strona (2026-08-31) ---")
# Blad: przezroczystosc przestala dzialac, choc w starszej wersji dzialala. Dzialala:
# wersja z 08-23 przy ruchu suwakiem WLACZALA tlo i okno gaslo prawdziwa alfa warstwowa. Potem tlo
# przestalo sie wlaczac samo, a przygaszac zaczela STRONA (`opacity` na tresci) — co nad gra nie
# jest przezroczystoscia, tylko mieszaniem z kolorem dziury, czyli ciemnieniem.
#
# POMIAR 2026-08-31 (zywe okno, GetLayeredWindowAttributes + zrzut ekranu): `LWA_COLORKEY | LWA_ALPHA`
# dzialaja NARAZ. Otoczka zostaje wycieta przy kazdej alfie, a to, co narysowane, miesza sie liniowo
# z tym, co za oknem:  suwak 100% -> karta 246,241,229 / tlo za oknem 33,33,33;
# suwak 40% -> zmierzone 118,116,112 przy przewidzianych 118,116,111. Stara notatka w kodzie
# („AND YOU CANNOT HAVE BOTH") pochodzila sprzed dolozenia --disable-direct-composition.
_ovl_css = _read("css", "15-overlay.css")
_py = _read_py()
check("serwer wysyla alfe z ustawienia ZAWSZE, takze przy wycinanym tle",
      'alpha = max(20, min(100, int(self.cfg.get("opacity", 90))))' in _py
      and "alpha = 100 if cut else" not in _py)
check("...i nadal wycina kolor klucza, gdy nie ma tla (obie flagi naraz)",
      "flags = (self.LWA_ALPHA | self.LWA_COLORKEY) if cut else self.LWA_ALPHA" in _py)
check("...a pomiar, ktory to rozstrzygnal, stoi przy kodzie, ktory z niego wynika",
      "POMIAR (LWA_COLORKEY | LWA_ALPHA" in _py and "alfa 128" in _py)
# Strona NIE MOZE przygaszac niczego: kazde jej przygaszenie dokladaloby sie do alfy okna
# (50% i 50% dawaloby 25%).
# …z JEDNYM wyjatkiem od 2026-09-01: zywa miniatura w panelu (`preview=1`) nie jest oknem, wiec
# nie ma czemu wyslac alfy — tam suwak przygasza strone, zeby nie wygladal na zepsuty. Warunek
# musi byc W TEJ LINII: przygaszenie prawdziwego okna przez strone dokladaloby sie do jego alfy.
check("strona nie przygasza tresci prawdziwego okna (a w miniaturze udaje)",
      'host.style.opacity=RF_OVL_PREVIEW?String(effOp/100):""' in _ovl
      and "--ovl-card-a" not in _ovl and "--ovl-card-a" not in _ovl_css)
check("...i miniatura mowi wprost, ze udaje",
      "Miniatura udaje przezroczystość" in _gal)
check("...i mowi wprost, co suwak robi, a czego nie rusza",
      "Przygasza treść okna" in _ovl and "tło jest wycięte" in _ovl
      and "Przygasza treść okna" in _editor)
check("okienko kola zostaje przy swoim zdaniu („jak mocno kolo przygasa nad gra”)",
      'Jak mocno koło przygasa nad grą' in _editor)
# Barwy powierzchni stoja w JEDNYM miejscu — dzieki temu `.ov-padbox` przestal swiecic kremowa
# plytka w „Neonie" i w „Szkle" (mial ciemny wariant wylacznie dla wygladu „Ciemny").
for _t, _c in (("dark", "#171b21"), ("neon", "#0c1018"), ("glass", "#f4f8fd")):
    check("barwa karty „%s” stoi w zmiennej, nie w bloku motywu" % _t,
          ("--ovl-card:%s" % _c) in _ovl_css
          and ("background:%s!important" % _c) not in _ovl_css, _t)
check("...a talerzyk pada nalezy do tej samej listy powierzchni",
      ":is(.ov-pose,.ov-front,.ov-mouse,.ov-press,.ov-wheel,.ov-padbox){" in _ovl_css)
# REGRESJA ZLAPANA PRZY TEJ SAMEJ POPRAWCE: przelacznik tla w panelu nie mial ZADNEGO nasluchu —
# ani w „click" (nie jest przyciskiem), ani w „input", ani w „change" (nie jest polem liczbowym).
check("przelacznik „Przyciemnione tlo” w panelu naprawde zapisuje",
      'e.target.id === "ovmBg"' in _editor and "show: { bg: !!e.target.checked }" in _editor)

print("\n--- arkusz karty nie miesza sie ze skorka okna ---")
check("wlasny prefiks klas", ".ovm-card" in _css and ".ovm-blk" in _css and ".ovm-eye" in _css)
# Pigulki wyboru okna zastapila galeria (2026-09-01) — a martwa regula CSS jest gorsza niz brak
# reguly: nastepna osoba szuka, co ja rysuje, i nie znajduje niczego.
check("...i nie zostaly po nim martwe reguly dawnych pigulek",
      ".ovm-chip{" not in _css and ".ovm-chips{" not in _css and ".ovm-edit-head{" not in _css)
check("...ale miniatury wygladow sa wspolne (to obrazek tego samego motywu)",
      "ovl-thumb" in _editor and ".ovl-thumb-felt{" not in _css
      and ".ovl-thumb-felt{" in _read("css", "15-overlay.css"))
check("wciśniete przelaczniki zostaja przy kanonie panelu (`button.btn.on`)",
      ".ovm-tog.on{" not in _css)

# ==================================================================================================
#  EKRAN „NAKLADKA" PRZESTAL BYC SPISEM, A ZACZAL BYC MIEJSCEM PRACY (2026-09-01)
#
#  Ekran pokazuje podglad (rozmiarow i konfiguracji) kazdej wersji nakladki z osobna: zamiast
#  «pokaz mi wszystkie konfiguracje naraz» jest «pozwol mi skonfigurowac nakladke». Aktualnie
#  edytowana nakladka odpala sie od razu w nowym oknie, bo tam dziala przezroczystosc.
# ==================================================================================================
print("\n--- ekran ma trzy zakladki, a podglad stoi NAD nimi ---")
check("„Sciaga” jest dolozona do pary „ekran · i”",
      '"sheet"' in _rest and "const EXTRA_PANES" in _rest)
# ZAKLADKA „WYGLAD" ZDJETA 2026-09-09: miala tylko jedna karte, wiec karta przeszla pod
# «Ustawienia tego okna» (mniej klikania).
# Karta zostaje, zakladka nie: jedna karta nie ma czego ukryc, a kosztuje kliknicie przy kazdym
# wejsciu na ekran. Asercja pilnuje, zeby nie wrocila przez przypadek razem z nowa karta wygladu.
check("...a „Wyglad” NIE jest juz osobna zakladka",
      '{ k: "look"' not in _rest and '"--ic-spray"' not in _rest)
check("...i tylko na ekranie „Nakladka”",
      "EXTRA_PANES = {\n    wszystkie:" in _rest.replace("\r\n", "\n"))
check("przelaczanie chodzi po LISCIE zakladek, a nie po dwoch wpisanych na sztywno",
      "for (const p of I.order)" in _rest and 'const ORDER = I.order;' in _rest
      and 'for (const p of ["main", "info"])' not in _rest)
check("sciaga jedzie na swoja zakladke po wlasnym znaczniku",
      'ovCard.dataset.rfpcPane="sheet"' in _tabs and "n.dataset.rfpcPane" in _rest)
# ⚠️ NAJWAZNIEJSZA REGULA TEJ PRZEBUDOWY. Blok z podgladem niesie <iframe>, a przegladarka laduje
# ramke OD NOWA przy kazdej zmianie rodzica w DOM — przepinany miedzy zakladkami podglad gaslby
# i wstawal po kazdym klinieciu, czyli nie bylby podgladem.
check("blok z podgladem stoi POZA zakladkami i jest CHOWANY, nie przenoszony",
      "n.dataset.rfpcShared" in _rest
      and 'prev.dataset.rfpcShared = "left"' in _manage
      and 'classList.toggle("rfpc-shared-off"' in _rest
      and ".rfpc-shared.rfpc-shared-off{display:none}" in _mod_css)
check("...i widac go tam, gdzie sie ustawia okno, a nie na sciadze i w poradniku",
      'SHARED_ON = { wszystkie: ["main"] }' in _rest)
# UX 261120 L4b (pietra): „Wyglad tego okna” to juz nie osobna karta, tylko zwinieta wstawka
# (piętro 2) w karcie ustawien, POD „Miejscem i wielkoscia”; nazwa okna i galeria okien stoja
# w jednym „Zaawansowane” (#ovmAdv, piętro 3) za karta ustawien.
check("edytor to jedna karta na zakladce „Nakladka”, wyglad jako zwijak POD ustawieniami",
      "function ovmEditorCfgHtml" in _editor and "function ovmEditorLookHtml" in _editor
      and 'mk("ovmCfgCard", "main"' in _manage and 'mk("ovmLookCard"' not in _manage
      and 'id="ovmLookFold"' in _editor and "ovmEditorLookHtml() + `</div>`" in _editor)
check("...zawartosc stoi nad miejscem i wygladem, a nazwa i galeria w „Zaawansowane”",
      _editor.index('id="ovmPartsCol"') < _editor.index('id="ovmGeomSec"') < _editor.index("ovmEditorLookHtml() +")
      and 'adv.id = "ovmAdv"' in _manage and "ovgPickHtml()" in _manage.split('adv.id = "ovmAdv"')[1].split("insertBefore")[0]
      and "ovmEditorNameHtml()" in _manage)
_look = _editor.split("function ovmEditorLookHtml")[1].split("// ------")[0]
_cfg = _editor.split("function ovmEditorCfgHtml")[1].split("function ovmEditorLookHtml")[0]
check("„Wyglad” to SKORA OKNA i nic wiecej",
      all(k in _look for k in ("ovmThemes", "ovmOutlineRow", "ovmBg", "ovmOpacity", "ovmScale")))
# ZAWARTOSC MA JEDNO MIEJSCE (2026-09-01): rozmiary elementow zeszly z „Wygladu" do wierszy, ktore
# opisuja te same elementy. Trzy miejsca na jedna sprawe zasypywaly uzytkownika nadmiarem
# informacji.
check("...i nie mowi juz nic o zawartosci",
      "ovm-pscale" not in _look and "ovmScaleCol" not in _editor)
check("...a „Nakladka” zostala przy tym, CZYM okno jest",
      all(k in _cfg for k in ("ovmLabel", "ovmSizeV", "ovmX", "ovmTop", "ovmThru", "ovmBlocks")))
check("...i zadna z nich nie trzyma polowy tej samej kontrolki",
      "ovmThemes" not in _cfg)

# ---- PARYTET Z SZUFLADA ⚙ (2026-09-03) ------------------------------------------------------
# Wszystko, co da sie skonfigurowac na samej nakladce, ma byc mozliwe tez przez przegladarke. Dwie rzeczy w szufladzie nie mialy odpowiednika
# w panelu: krzyzyk (zamkniecie okna) i - od dzis - przelacznik paska okna. Reszta miala.
# (Bez znaku zebatki w NAPISIE: polska konsola to cp1250 i wydrukowanie go zabija caly przebieg,
#  zanim wynik zdazy sie pokazac — ta sama pulapka, co z pelnoszerokim plusem nizej w tym pliku.)
print("\n--- parytet: co da sie zrobic w szufladzie okna, da sie zrobic w panelu ---")
check("pasek okna jest przelacznikiem W OBU miejscach — w szufladzie i w edytorze",
      "ovlBarTick" in _ovl and "ovmBar" in _cfg
      and 'ovmSend(w.wid, { winBar: (c.winBar === false) }, true)' in _editor
      and "ovlSave({winBar:!!e.target.checked},true)" in _ovl)
# MIEJSCE TEGO PRZELACZNIKA (UX 261120 B5b, decyzja D20): PIERWSZY WIERSZ listy „Zawartosc”,
# z dzwignia rf-swi, zamiast pelnoszerokiego rozowego przycisku nad lista. Poza przeciaganym
# `#ovmBlocks`, bo pasek nie ma miejsca w kolejnosci elementow.
check("...i stoi w kolumnie zawartosci, jako PIERWSZY wiersz pod naglowkiem „Zawartosc”",
      "ovmBar" in _cfg and "ovmBar" not in _look
      and _cfg.index("Zawartość") < _cfg.index('id="ovmBar"') < _cfg.index('id="ovmBlocks"')
      and _cfg.index('id="ovmPartsCol"') < _cfg.index('id="ovmBar"'))
check("...jako wiersz z dzwignia rf-swi, a nie rozowy przycisk na cala szerokosc",
      'class="rf-swi sm" id="ovmBar"' in _cfg and "ovm-bar-wide" not in _cfg
      and ".ovm-bar-row{" in _css and ".ovm-bar-wide" not in _css)
check("...z jednozdaniowym wyjasnieniem POD nim",
      _cfg.index('id="ovmBar"') < _cfg.index('id="ovmBarNote"') < _cfg.index('id="ovmBlocks"'))
check("...a wlaczyc go z powrotem da sie TYLKO z panelu — okno bez paska nie ma czego kliknac",
      "Z powrotem włączysz go tylko tam." in _ovl)
check("zamkniecie okna ma w panelu wlasny przycisk, nazwany czasownikiem, a nie destrukcyjny krzyzyk",
      "ovmPower" in _cfg
      and 'ovlPost({ act: "toggle", win: w.wid, dev: w.dev })' in _editor
      and '"Zostaw nad grą"' in _editor and '"Schowaj"' in _editor and '"Pokaż nad grą"' in _editor
      and "ovgRelease(w.wid)" in _editor and "ovgKeep(w.wid)" in _editor)
check("...i nie ma go tam, gdzie nie ma czego otwierac (kolo przy kursorze, brak wyboru)",
      "const show = !!(w && !w.wheel && c);" in _editor)

# ---- POLOZENIE SUWAKAMI (2026-09-03) --------------------------------------------------------
# Pozycje okna na stronie ustawia sie suwakami zamiast wpisywania liczb. Suwak bez granic wzietych z prawdziwych ekranow bylby tym samym zgadywaniem, co pole
# liczbowe, wiec granice sa czescia tej zmiany, a nie dodatkiem.
print("\n--- polozenie okna: suwaki o zakresie prawdziwych ekranow ---")
check("sa dwa suwaki, X i Y, kazdy z polem liczbowym obok",
      all(k in _cfg for k in ("ovmXr", "ovmYr", "ovmX", "ovmY"))
      and 'class="ovm-pos"' in _cfg and "ovm-num-sm" in _cfg)
check("granice biora sie z EKRANOW, a nie z wpisanego na sztywno +-20000",
      "function _ovmPosLimits" in _editor and "OVL.state" in _editor
      and "Array.isArray(s.screens)" in _editor)
check("...w tej samej przestrzeni, w ktorej serwer stawia okna (fizyczne piksele)",
      "def overlay_screens(" in _py and "overlay_monitors_physical()" in _py
      and '"screens": scr' in _py)
check("...i sufit to KRAWEDZ MINUS BOK OKNA, zeby kazde polozenie suwaka pokazywalo cale okno",
      "Math.max(x0, x1 - w)" in _editor and "Math.max(y0, y1 - h)" in _editor)
check("okno stojace poza ekranami rozciaga suwak do siebie, zamiast parkowac go na koncu skali",
      "Math.min(lim.x[0], cx)" in _editor and "Math.max(lim.x[1], cx)" in _editor)
check("suwak rusza oknem W TRAKCIE ciagniecia, ale nie czesciej niz ~10 razy na sekunde",
      "function _ovmPosLive" in _editor and "100 - (now - _ovmPosT)" in _editor)
# Puszczenie suwaka idzie TA SAMA droga, co ruch. Zapis „od razu" na `change` wygladal na
# oczywisty, ale `change` na suwaku leci po KAZDYM nacisnieciu strzalki klawiatury — zmierzone:
# 26 zapisow na sekunde zamiast dziesieciu, czyli ograniczenie omijalo samo siebie.
check("...a puszczenie suwaka nie omija ograniczenia tempa (zegar i tak zawsze jest uzbrojony)",
      "_ovmPosFlush();" in _editor
      and '_ovmPosLive(w.wid, { [e.target.id === "ovmXr" ? "x" : "y"]' in _editor)
check("okno, ktore nigdzie jeszcze nie stoi, ma suwaki wygaszone zamiast klamiacych zer",
      "sl.disabled = !hasXY;" in _editor and ".ovm-pos:disabled" in _read("css", "23-overlay-manage.css"))
# Okno kola nie ma ANI JEDNEJ kontrolki w zakladce „Nakladka" — a pusta karta pod naglowkiem
# „Ustawienia tego okna" czyta sie jak awaria, wiec stoi tam zdanie, gdzie te rzeczy sa.
check("okno kola dostaje w „Nakladce” zdanie, a nie pusta karte",
      "if (w.wheel) {\n     if (cols) cols.hidden = true;" in _editor.replace("\r\n", "\n"))

print("\n--- galeria: kafelek na okno, jeden podglad na zywo ---")
check("galeria jest zaladowana przez strone, po rf-41b",
      "/web/js/rf-41d-overlay-gallery.js" in _html
      and _html.index("rf-41b-overlay-manage.js") < _html.index("rf-41d-overlay-gallery.js"))
check("...razem ze swoim arkuszem, przed skorka nakladki",
      "/web/css/24-overlay-gallery.css" in _html
      and _html.index('href="/web/css/24-overlay-gallery.css"')
      < _html.index('href="/web/css/15-overlay.css"'))
check("kafelek jest w PROPORCJI okna i mowi jego wymiar",
      "aspect-ratio:${ww}/${hh}" in _gal and 'Math.round(c.w / dpr0) + "×" + Math.round(c.h / dpr0)' in _gal)
check("...a jego szerokosc idzie za prawdziwa szerokoscia okna (o to prosil podglad rozmiarow)",
      "150 * ((+((w.cfg || {}).w) || 400) / (maxW || 400))" in _gal)
check("...i za suwakami rozmiaru czesci, wiec podkrecenie widac od razu",
      "OVG_WEIGHT[k] * sc" in _gal and "sp[k]" in _gal)
check("schemat zna kazda czesc, ktora da sie skalowac",
      all(k in _gal.split("const OVG_WEIGHT")[1].split("\n")[0] for k in
          [p for p in ("head", "pose", "motion", "press", "pad", "wheel", "rules", "graph", "midi")]))
check("barwy motywow siedza w CSS, a nie w JS (kolor nalezy do arkusza)",
      '.ovg-box[data-theme="felt"]' in _gal_css and "--ovg-card" in _gal_css
      and "#f3ecd9" not in _gal)
check("galeria czerpie z kanonu list, a nie kopiuje go",
      "OVL_PARTS" in _gal and "OVL_THEMES" in _gal and "ovlRatioOf" in _gal
      and "const OVL_PARTS" not in _gal and "const OVL_THEMES" not in _gal)

print("\n--- miniatura jest TA SAMA strona, ktora Windows postawi nad gra ---")
check("adres miniatury jest lustrem adresu, ktory buduje serwer",
      '"/?view=overview&overlay=1&preview=1&dev="' in _gal
      and '?view=overview&overlay=1&dev=%s&win=%s&mark=%s%s' in _read_py())
check("...lacznie z „view=overview”, bez ktorego ramka pokazalaby caly panel",
      "view=overview" in _gal and "IS_OVERVIEW" in _read("js", "rf-05-tooltip-state.js"))
check("okno kola dostaje w miniaturze swoja oprawe", '(w.wheel ? "&wheel=1" : "")' in _gal)
check("miniatura NIC nie zapisuje",
      "if(RF_OVL_PREVIEW)return Promise.resolve({ok:false,preview:true});" in _ovl)
# PASEK JEST, ale MARTWY (2026-09-01). Nad gra stoi i zabiera swoje kilkanascie pikseli u gory —
# miniatura bez niego bylaby o tyle „pustsza na dole" od prawdziwego okna. Nasluchow nie dostaje:
# chwytanie i szuflada to sterowanie oknem, a miniatura niczym nie steruje.
# Od 2026-09-03 pasek jest USTAWIENIEM okna (`winBar`), wiec nie powstaje raz przy starcie, tylko
# jest stawiany i zdejmowany przez `ovlBarSync` — a ten jeden warunek dalej decyduje, ze miniatura
# dostaje pasek BEZ nasluchow. Sprawdzamy wiec funkcje, a nie dawna linijke ze startu strony.
check("...ale pasek w niej JEST — tylko bez nasluchow",
      "function ovlBarSync(want)" in _ovl
      and "if(!RF_OVL_PREVIEW)ovlBarWire(bar);" in _ovl
      and "html.rf-ovl-preview body > *:not(.wrap):not(.ovl-bar)" in _ovl_css
      and "html.rf-ovl-preview .ovl-bar{pointer-events:none}" in _ovl_css)

# ---- PASEK OKNA STOI U SZCZYTU ZAWARTOSCI (2026-09-09) --------------------------------------
# Pasek okna stoi u szczytu zawartosci i wyglada tak samo jak jej wiersze. Do tej pory byl pierwszym dzieckiem `body`, czyli osobna
# pigulka w marginesie okna, z przerwa miedzy nim a pierwszym blokiem sciagi.
print("\n--- pasek okna: pierwszy wiersz sciagi, nie pigulka nad nia ---")
check("pasek wchodzi na szczyt karty sciagi, a nie na gore dokumentu",
      "function ovlBarMount(bar)" in _ovl
      and "ovlBarMount(bar);" in _ovl
      and "document.body.insertBefore(bar,document.body.firstChild);" not in _ovl)
# ⚠️ KARTA, A NIE KOLUMNA — i to jest ten warunek, ktory musi przezyc kazda przyszla sesje.
# `renderOverview` (rf-11) przy kazdym odrysowaniu robi `wrap.innerHTML=""`, wiec pasek wsadzony
# do `.ov-col` znikalby razem z kolumnami: z otwarta szuflada, nasluchami i pomiarem klikalnego
# paska. `#overviewCard` buduje sie raz (rf-34) i odrysowanie sciagi go nie rusza.
check("...czyli do #overviewCard, ktorego odrysowanie sciagi nie kasuje",
      'document.getElementById("overviewCard")||document.body' in _ovl
      and 'wrap.innerHTML=""' in _read("js", "rf-11-devices-ui.js"))
# Pasek powstaje ZANIM panel sie zbuduje (niesie komunikat „brak polaczenia z RibbitFlip"), wiec
# pierwszy raz laduje w `body`. `ovlColumns` chodzi po kazdym odrysowaniu i po kazdym `ovlApply`,
# wiec to on sprowadza go na miejsce — bez tego zostalby w `body` do konca sesji.
check("...i wraca na nie po kazdym odrysowaniu sciagi",
      "ovlColumns();" in _ovl and "ovlBarMount();" in _ovl)
# Paski komunikatow sa RODZENSTWEM paska, nie jego dziecmi (patrz `ovlBarWire`) — przeniesiony
# pasek zostawilby je wiszace nad karta, oderwane od paska, ktorego dotycza.
check("...razem z paskami komunikatow, ktore sa jego rodzenstwem",
      '["ovlOffNote","ovlPinNote","ovlSayNote"]' in _ovl
      and 'after.insertAdjacentElement("afterend",n); after=n;' in _ovl)
check("ksztalt: bez marginesu, bez zaokraglenia, z kreska pod spodem jak miedzy blokami",
      "margin:0;padding:3px 8px;border:0;border-bottom:1px solid var(--stitch,#39414d)" in _ovl_css
      and "margin:4px 4px 3px;padding:2px 6px;border-radius:9px" not in _ovl_css)
# Malowanie zostaje nietkniete i to nie jest przeoczenie: wyciety piksel nie odbiera myszy, wiec
# niemalowany pasek nad wycieta nakladka bylby paskiem, ktorego nie da sie zlapac z powrotem.
check("...ale malowanie zostaje, bo wyciety pasek bylby paskiem nie do zlapania",
      "html.rf-ovl:not(.ovl-bg) .ovl-bar{background:rgba(12,15,20,.62);opacity:.26}" in _ovl_css)
# Wysokosc okna liczy sie od DOLNEJ KRAWEDZI KARTY do gory widoku, wiec pasek — teraz w karcie —
# dalej sie w niej miesci. Zmierzone: pasek wlaczony 864, wylaczony 819 (piksele fizyczne).
check("okno dalej mierzy sie tak, ze pasek liczy sie do jego wysokosci",
      "const hCss=card.getBoundingClientRect().bottom;" in _ovl
      and "PIERWSZYM WIERSZEM karty" in _ovl)
check("...i ma wejscie „przeczytaj ustawienia TERAZ”, bo suwak ma dzialac na biezaco",
      "window.rfOvlPreviewRefresh=function()" in _ovl and "function ovgPoke" in _gal
      and "ovgPoke();" in _manage)
check("pod miniatura jest umowna gra, a nie kolor dziury",
      "html.rf-ovl-preview, html.rf-ovl-preview body{" in _ovl_css
      and "rf-ovl-bg-light" in _ovl_css and "function ovgBackdrop" in _gal)
check("...a `ovl-bg` dalej wygrywa, bo to realna roznica, ktora podglad ma pokazywac",
      "html.rf-ovl-preview.ovl-bg, html.rf-ovl-preview.ovl-bg body{background:#0b0d10" in _ovl_css)
check("kolo stoi w miniaturze na stale, bo podglad sluzy do USTAWIANIA",
      'if (typeof RF_OVL_PREVIEW !== "undefined" && RF_OVL_PREVIEW) return true;' in _wheel)
check("...i zdanie pod podgladem mowi, ze nad gra bedzie inaczej",
      "Koło wyboru stoi w podglądzie na stałe" in _gal)

print("\n--- podglad na zywo: prawdziwe okno, bo przezroczystosc robi Windows ---")
check("ustawiane okno otwiera sie naprawde", '{ act: "open", win: w.wid, dev: w.dev }' in _gal)
check("zamykamy WYLACZNIE to, co sami otworzylismy",
      "const wid = _ovgOpened; _ovgOpened = \"\";" in _gal and "if (w.running) return;" in _gal)
check("jedno naraz: zmiana okna zamyka poprzednie", "_ovgLiveClose();" in _gal)
check("wyjscie z ekranu zamyka nasze okno",
      "function ovgLiveLeave" in _gal
      and 'if(id!=="wszystkie"&&typeof ovgLiveLeave==="function")' in _tabs)
check("...a wejscie na ekran je otwiera",
      "function ovgLiveEnter" in _gal
      and 'if(id==="wszystkie"&&typeof ovgLiveEnter==="function")' in _tabs)
# Bez tego warunku panel otwieralby okno nad gra zaraz po starcie, komus, kto na ten ekran nie wszedl:
# `ovgSync` chodzi co 4 s niezaleznie od tego, gdzie sie stoi.
check("nic sie nie otwiera, dopoki nie jest sie na tym ekranie",
      "function _ovgOnScreen" in _gal and "if (!_ovgOnScreen()) return;" in _gal)
check("okna KOLA nie otwieramy nigdy (chodzi za kursorem)",
      "if (!_ovgLive || !w || w.wheel) return;" in _gal)
check("da sie to wylaczyc, a przelacznik pamieta swoj stan",
      "OVG_LIVE_KEY" in _gal and "localStorage.setItem(OVG_LIVE_KEY" in _gal
      and 'id="ovgLive"' in _gal)

print("\n--- szablony przy +: nakladka na jedna rzecz ---")
check("front wysyla szablon razem z prosba o nowe okno",
      "const OVG_TEMPLATES" in _gal and "body.config = t.cfg;" in _gal)
check("...i wypisuje CALY komplet czesci, nie same wlaczone",
      "function _ovgShow" in _gal and "out[p.key] = false;" in _gal)
# ZLAPANE POMIAREM 2026-09-01: samo `position:absolute` nie kotwiczy menu przy przycisku — bez
# ustawionego przodka liczylo sie od `.ovm-body` i otwieralo 300 px w lewo, na cudzych kafelkach.
check("menu szablonow otwiera sie PRZY swoim +",
      ".ovg-tiles{position:relative;" in _gal_css
      and "btn.offsetTop + btn.offsetHeight + 4" in _gal)
check("...i nie wychodzi poza pas przy prawej krawedzi",
      "Math.max(0, Math.min(btn.offsetLeft, room - w))" in _gal)
_py2 = _read_py()
check("serwer przyjmuje szablon w akcji „add”",
      'tpl = dd.get("config")' in _py2 and "patch=tpl if isinstance(tpl, dict) else None" in _py2)
check("...przepuszcza go przez ta sama sanityzacje, co kazde inne ustawienie",
      "cfg = _sanitize_overlay_win(patch, base=cfg)" in _py2)
# Zachowanie, nie tekst: szablon ma nadpisac kopie, wyczyscic miejsce (zeby nowe okno nie stanelo
# dokladnie na starym) i NIE zgubic tego, o co nie prosil.
M2, _ = mgr()
M2._mk("d0")
M2.wins["d0"].cfg["theme"] = "dark"
M2.wins["d0"].cfg["x"] = 111
M2.wins["d0"].cfg["y"] = 222
_tpl = {"label": "kontroler", "w": 640, "h": 360,
        "show": {k: (k == "pad") for k in rf.OVERLAY_SHOW_KEYS}}
_new, _why = M2.add("d0", base_url=None, patch=_tpl)
_c = M2.wins[_new].cfg if _new else {}
check("szablon nadaje rozmiar i nazwe", (_c.get("w"), _c.get("h"), _c.get("label")) == (640, 360, "kontroler"),
      (_c.get("w"), _c.get("h"), _c.get("label")))
check("...wlacza dokladnie to, o co prosil, i nic wiecej",
      _c.get("show", {}).get("pad") is True
      and all(_c.get("show", {}).get(k) is False for k in ("pose", "rules", "head", "wheel")))
check("...zostawia wyglad odziedziczony po oknie, z ktorego wyszedl", _c.get("theme") == "dark")
check("...i nie stawia nowego okna dokladnie na starym", _c.get("x") is None and _c.get("y") is None)
check("brak szablonu = kopia jak dotad (nic sie nie zmienilo dla + w pasku)",
      M2.wins[M2.add("d0", base_url=None)[0]].cfg.get("theme") == "dark")

print("\n--- wielkosc okna jest WYNIKIEM, nie ustawieniem (2026-09-01) ---")
# Wielkosc okna nie jest sterowana samym oknem, tylko z edytora nakladki: wysokosc i szerokosc
# dopasowuja sie automatycznie do parametrow, wiec uchwyt w prawym dolnym rogu odpada.
check("rogu do ciagniecia nie ma ANI w kodzie, ANI w arkuszu",
      "ovlResize" not in _ovl and "ovlSizeTag" not in _ovl and 'id="ovlSize"' not in _ovl
      and ".ovl-size" not in _ovl_css and ".ovl-resize-frame" not in _ovl_css)
check("...i nie ma juz trzech innych drog do tej samej liczby",
      'id="ovlW"' not in _ovl and 'id="ovlH"' not in _ovl and 'id="ovlFit"' not in _ovl
      and 'id="ovmW"' not in _editor and 'id="ovmH"' not in _editor)
check("zostal sam ODCZYT — w oknie i w panelu",
      'id="ovlWhV"' in _ovl and 'id="ovmSizeV"' in _editor)
# SZEROKOSC JEST LICZONA, NIE MIERZONA — i to nie jest skrot: kolumna sciagi nie ma wlasnej
# szerokosci, tylko wypelnia okno, wiec pomiar zwracalby te szerokosc, ktora okno juz ma.
check("szerokosc idzie z „Rozmiaru calosci” (od 09-07 razem z „Szerokoscia”, patrz nizej)",
      "function ovlAutoWidth" in _ovl and "ovlBaseW(baseW)*z*(dpr||1)" in _ovl)
check("...a podstawa jest ta sama liczba, co domyslna szerokosc okna na serwerze",
      "const OVL_BASE_W=400" in _ovl and rf.OVERLAY_WIN_DEFAULTS["w"] == 400,
      rf.OVERLAY_WIN_DEFAULTS["w"])
# WYSOKOSC MIERZONA Z KARTY, a nie z `documentElement.scrollHeight`: to drugie nigdy nie schodzi
# ponizej wysokosci okna, wiec okno umialoby tylko rosnac.
_measure = (_ovl.split("function ovlMeasure()")[1].split("function ovlAutoFit")[0]
            if "function ovlMeasure()" in _ovl else "")
check("wysokosc mierzona z karty sciagi, wiec okno umie sie te skrocic",
      'document.getElementById("overviewCard")' in _measure
      # `bottom`, NIE `height` — ZGLOSZENIE WLASCICIELA 2026-09-01: „wysokosc nakladki jest krotsza
      # o pasek gorny menu i na dole nie starczy". Pasek nakladki jest `position:sticky`, czyli stoi
      # W UKLADZIE nad karta i zabiera swoje kilkanascie pikseli; wysokosc samej karty o nim nie wie.
      and "card.getBoundingClientRect().bottom" in _measure
      and "getBoundingClientRect().height" not in _measure
      # …i NIE z `documentElement.scrollHeight`, ktore nigdy nie schodzi ponizej wysokosci okna
      # (tak liczyl dawny przycisk „Dopasuj do zawartosci" — i dlatego okno umialo tylko rosnac).
      # Szczegol w ASCII: konsola Windows jest na cp1250 i polski cytat z kodu wywalilby `print`
      # razem z calym testem (ta sama pulapka, co „+" w nazwie sekcji).
      and "scrollHeight" not in _measure, _measure[:120].encode("ascii", "replace").decode("ascii"))
check("prog 2 px, zeby zaokraglenia nie robily drgania",
      "Math.abs(m.w-cw)<=2&&Math.abs(m.h-ch)<=2" in _ovl)
check("dopasowanie chodzi po kazdej zmianie ustawien i po kazdej zmianie listy regul",
      ("ovlAutoFit();" + chr(10) + "  }") in _ovl.replace(chr(13), "")
      and "ovlColumns();ovlAutoFit();" in _ovl)
check("...oraz gdy tresc urosnie sama (kolo wyboru na czas wybierania)",
      "function ovlWatchSize" in _ovl and "new ResizeObserver" in _ovl)
check("okno kola sie nie dopasowuje — jego bok liczy karta „Kolo wyboru”",
      "if(RF_OVL_WHEEL)return;" in _ovl)
# DWA KONTEKSTY, JEDEN PISARZ. `w`/`h` sa w pikselach FIZYCZNYCH, wiec zaleza od skalowania ekranu,
# na ktorym sie mierzy — gdyby pisali obaj, kazdy poprawialby drugiego w kolko.
# MIERZY WYLACZNIE OKNO. Miniatura mierzyla przez chwile tego samego dnia i to byl blad: nie ma
# w niej paska, ktory nad gra zabiera swoje kilkanascie pikseli, wiec pomiar wychodzil systematycznie
# za niski — dokladnie tak, jak wygladalo zgloszenie „na dole nie starczy".
check("miniatura nie zapisuje wielkosci",
      "rfOvlPreviewFit" not in _ovl and "ovgFitFromPreview" not in _gal
      and "if(RF_OVL_PREVIEW)return;" in _ovl)
check("ramka podgladu dostaje piksele CSS, bo w takiej szerokosci uklada sie tresc",
      "Math.round((+c.w || 400) / dpr)" in _gal)
check("odczyty w panelu tez sa w pikselach CSS (tyle okno ma NA EKRANIE)",
      "Math.round(ww / dpr)" in _editor and "Math.round(c.w / dpr0)" in _gal)
check("szablony nie podaja rozmiaru, bo i tak zostalby nadpisany",
      '"kontroler"' in _gal and "w: 640" not in _gal and "h: 360" not in _gal)
# Zwykly fetch bywa porzucony przy zamykaniu strony — okno zostawalo wtedy otwarte na zawsze.
check("okno podgladu zamyka sie takze przy zamknieciu panelu (sendBeacon)",
      "navigator.sendBeacon" in _gal and 'act: "close"' in _gal)

print("\n--- zawartosc okna: jedna lista, kolejnosc i drobiazgi (2026-09-01) ---")
# Edytor nakladek pozwala wizualnie ukladac zawartosc przeciaganiem i konfigurowac ja w jednym
# miejscu, intuicyjnie i bez zasypywania uzytkownika nadmiarem informacji.
check("jedna lista blokow zamiast trzech miejsc",
      'id="ovmBlocks"' in _editor and "ovm-blk" in _editor
      and "ovm-el-chips" not in _editor and "ovm-els" not in _editor)
check("...a w kazdym wierszu wszystko o tej rzeczy: uchwyt, oko, rozmiar, drobiazgi",
      "ovm-grip" in _editor and "ovm-eye" in _editor and "ovm-pscale" in _editor
      and "ovm-sub" in _editor)
# HARMONIJKA: osiem otwartych rozwiniec to ta sama sciana kontrolek, od ktorej ten uklad ucieka.
check("rozwiniety jest najwyzej jeden wiersz",
      "function _ovmBlkOpen" in _editor and 'b.classList.toggle("is-open", on)' in _editor)
# ⚠️ `display:flex` na ciele wiersza BIJE domyslne `[hidden]{display:none}` — bez jawnej reguly
# wszystkie osiem rozwiniec stalo otwartych naraz (zlapane zrzutem tego samego dnia).
check("...i zwiniete NAPRAWDE sie chowa",
      ".ovm-blk-body[hidden]{display:none}" in _css)
check("kolejnosc zmienia sie przeciagnieciem",
      "function _ovmBlocksDrag" in _editor and "pointerdown" in _editor
      and "document.elementFromPoint" in _editor and "insertBefore" in _editor)
# Uchwyt jest przyciskiem, wiec ma ognisko — a wtedy strzalki robia to samo bez myszy. To jedyna
# droga dla kogos, kto przeciagac nie moze.
check("...i strzalkami na uchwycie",
      "ArrowUp: -1, ArrowDown: 1" in _editor and "_ovmCommitOrder" in _editor)
check("...a Escape w trakcie cofa, zamiast zostawiac polowe",
      'e.key === "Escape" && _ovmDrag' in _editor and "for (const n of d.before)" in _editor)
check("zapis dopiero po puszczeniu, nie po kazdym drgnieciu",
      "{ order: _ovmOrderFromDom(host) }" in _editor)
# Serwer trzyma WYBOR CZLOWIEKA, a nie pelna liste: czesc dolozona w przyszlosci ma sie pojawic na
# swoim naturalnym miejscu, a nie wypasc na koniec u kogos, kto raz cos przestawil.
check("serwer przyjmuje kolejnosc i odsiewa smieci",
      "OVERLAY_ORDER_KEYS" in _py2 and 'cfg["order"] = out_ord' in _py2)
_o = rf._sanitize_overlay_win({"order": ["rules", "pose", "rules", "nic-takiego", "head"]})["order"]
check("...bez duplikatow i bez nieznanych", _o == ["rules", "pose", "head"], _o)
check("...a pusta lista znaczy „jak zawsze”", rf.OVERLAY_WIN_DEFAULTS["order"] == [])
check("przegladarka dopelnia brakujace bloki kolejnoscia kanoniczna",
      "function ovlOrderOf" in _ovl and "for(const k of all)if(out.indexOf(k)<0)out.push(k);" in _ovl)
check("okno naprawde je przestawia (kolumna jest pudelkiem flex)",
      "html.rf-ovl .ov-col{margin:0!important;display:flex;flex-direction:column}" in _ovl_css
      and "function ovlOrderCol" in _ovl)
# ⚠️ Uchwyt kuli, spis wycinkow i obudowa pada maja jechac RAZEM ze swoim blokiem — dlatego
# porzadek nadaje sie IDAC PO DZIECIACH, a nie przypisujac go blokom.
check("...a drobiazgi jada razem ze swoim blokiem",
      "else sub++;" in _ovl and "cur+sub" in _ovl)
check("kafelek w galerii pokazuje te sama kolejnosc",
      "ovlOrderOf(c) : OVG_ORDER" in _gal)

print("\n--- drobiazgi wewnatrz blokow ---")
for _k in ("head.label", "head.conn", "pose.num", "press.val", "press.lane", "wheel.list"):
    check("serwer zna „%s”" % _k, _k in rf.OVERLAY_SHOW_KEYS, _k)
check("...i wszystkie sa domyslnie WLACZONE (do dzis rysowaly sie zawsze)",
      all(rf.OVERLAY_WIN_DEFAULTS["show"][k] for k in
          ("head.label", "head.conn", "pose.num", "press.val", "press.lane", "wheel.list")))
check("wykres, opis i liczniki naleza do wyzwalaczy, a nie stoja obok nich",
      'parent:"rules"' in _ovl and _ovl.count('parent:"rules"') == 3)
check("chowane sa klasa na kolumnie, tak jak bloki",
      "ovl-no-headlabel" in _ovl and "ovl-no-pressval" in _ovl
      and "html.rf-ovl .ov-col.ovl-no-headlabel .ov-lbl" in _ovl_css)
_rf12 = _read("js", "rf-12-preview-editor.js")
# LICZBY POD KULA rysuje plotno, wiec stylem sie ich nie schowa — flaga musi dojechac do rysowania.
check("liczby pod kula ida flaga do rysowania, bo stylem sie ich nie schowa",
      "draw:true" in _ovl and "function drawMiniPose(c, pose, num)" in _rf12
      and 'OVL.cfg.show["pose.num"]' in _rf12)
check("...a w panelu (sciaga wszystkich kapsli) rysuja sie zawsze",
      'typeof RF_OVL==="undefined"||!RF_OVL)' in _rf12 and "num!==false" in _rf12)
# Szuflada nad gra zostaje przy BLOKACH: czternasty jednakowy wiersz w pasku szerokim na jedna
# kolumne to nie jest miejsce na „opis reguly".
check("szuflada okna pokazuje same bloki, a szczegoly odsyla do panelu",
      "OVL_BLOCKS.map(p=>elRow(p.key,p.label))" in _ovl
      and "Szczegóły każdego elementu" in _ovl)

print("\n--- ekran na dwie kolumny: po lewej podglad, po prawej ustawienia (2026-09-01) ---")
# Po lewej podglad, po prawej parametry i kolejnosc. Do tej pory podglad i kafelki stały obok siebie w JEDNEJ karcie, a
# ustawienia leciały pod nia przez cala szerokosc — wiec przy dluzszej liscie podglad uciekal w gore.
check("blok staly deklaruje SWOJA strone ekranu",
      'data-rfpc-shared="left"' in _rest.replace("'", '"') or 'rfpcShared === "left"' in _rest)
check("...a panel stawia go w tej kolumnie",
      "rfpc-shared-l" in _rest and "rfpc-shared-r" in _rest and "rfpc-col-r" in _rest)
check("podglad jest karta LEWA, kafelki i reszta prawa",
      'prev.dataset.rfpcShared = "left"' in _manage and 'card.dataset.rfpcShared = "right"' in _manage)
check("...i podglad NIE jest przenoszony po drzewie (niesie ramke)",
      "card.parentNode.insertBefore(prev, card)" in _manage)
check("dwie kolumny tylko tam, gdzie ekran o to prosi",
      "const SPLIT = { wszystkie: true }" in _rest
      and ".rfpc-split .rfpc-body{display:grid" in _mod_css)
# ⚠️ Nad przyklejona kolumna stoja DWA albo TRZY przyklejone paski: pasek aplikacji, przy oknie
# 901-1279 px jeszcze pas kapsli, i pasek zakladek tego ekranu — a ten ostatni zmienia wysokosc,
# gdy zawija sie na waskim oknie. Bez pomiaru podglad wjezdzal pod pasek zakladek (zmierzone:
# top=8, czyli pod naglowek). Od 14.09 mierzy to `rfWatchModHead` (rf-40) dla wszystkich paskow
# modulow naraz: wlasny pomiar tego ekranu pomijal pas kapsli i przy oknie 1100 px blok staly
# parkowal 360 px za wysoko, czyli w calosci pod pasem.
check("lewa kolumna przykleja sie POD wszystkie paski, a wysokosc kazdego jest MIERZONA",
      "rfWatchModHead(head)" in _rest and "--rfpc-head-h" not in _rest
      and "top:var(--rf-sticky-top);" in _mod_css
      and "--rf-sticky-top:calc(var(--topbar-h,64px) + var(--rf-strip-h,0px) + var(--rf-modhead-h,0px) + 8px)" in _mod_css)
check("...i ma sufit wysokosci, zeby dalo sie ja doczytac na niskim oknie",
      "max-height:calc(100vh - var(--rf-sticky-top) - 8px)" in _mod_css)
check("bez blokow stalych panel dostaje CALA szerokosc",
      "rfpc-body-solo" in _rest and ".rfpc-split .rfpc-body.rfpc-body-solo{grid-template-columns:1fr}" in _mod_css)
# Prog liczony z szerokosci PANELU, nie okna (2026-09-05): od przebudowy na trzy kolumny
# srodek przy oknie 1280 px jest WEZSZY (724 px) niz przy oknie 1180 px z dwiema kolumnami
# (912 px), wiec media query na oknie zwijala uklad w zlym momencie — a przy 1280 px prawa
# kolumna ustawien wystawala ~30 px poza karte. 766 = 300 + 430 + 12 przerwy + 2 x 12 wciecia.
check("waskie okno: podglad wraca NAD ustawienia, bez przyklejenia (prog z szerokosci panelu)",
      "@container (width < 766px)" in _mod_css and ".rfpc.rfpc-split{container-type:inline-size}" in _mod_css
      and "@media (max-width:1180px)" not in _mod_css)
check("nasluchy galerii sa na dokumencie, bo jej polowki stoja w roznych kartach",
      'e.target.closest(".ovg-prev,.ovg-pick,.ovg-menu")' in _gal
      and "function ovgPrevHtml" in _gal and "function ovgPickHtml" in _gal)

print("\n--- pusty modul: wygaszony, nie usuniety ---")
# Zlecenie: „sama zawartosc nie powinna zawierac modulow, w ktorych uzytkownik nie ma nic
# wprowadzone — zadnego mapowania. domyslnie je wygas po prostu". WYGASZAMY: pozycja zdjeta z listy
# zabralaby odpowiedz na pytanie „a gdzie to bylo?" komus, kto wlasnie dopisal pierwsza regule.
check("jest funkcja, ktora mowi, co jest puste", "function _ovmEmptyBlocks" in _editor)
check("...i liczy to z tego samego, co rysuje sciaga",
      "D.rules || []" in _editor and 'indexOf("pad:") === 0' in _editor
      and "sl.length < 2" in _editor and "D.mouseLive && D.mouseLive.enabled" in _editor
      and "state.midi.mappings" in _editor)
check("pusty wiersz jest WYGASZONY, a nie usuniety",
      'b.classList.toggle("is-empty", e)' in _editor
      and ".ovm-blk.is-empty .ovm-blk-nm{color:var(--dim)}" in _css)
check("...i mowi jednym slowem, ze jest pusty",
      'class="ovm-blk-empty"' in _editor and ".ovm-blk-empty{" in _css)
check("...a po najechaniu mowi CZEGO brakuje i GDZIE to dopisac",
      "_OVM_EMPTY_WHY" in _editor
      and all(k in _editor for k in ("Mapowaniu", "Kontrolerze", "Kole wyboru", "Myszy")))
check("procent znika przy pustym module (nie ma czego skalowac)",
      "|| empty[key]" in _editor)
# Kapsel, ktorego nie ma w stanie, nie jest „pusty" — o niczym nie wiemy, wiec nic nie wygaszamy.
check("nieznany kapsel nie jest ogloszony pustym", "if (!D) return out;" in _editor)

print("\n--- poradnik i angielski nadazyly za ekranem ---")
_guides = _read("js", "rf-39b-guides.js")
check("poradnik opisuje EKRAN, ktory jest teraz, a nie ten sprzed przebudowy",
      'title:"Nakładki nad grą"' in _guides
      and "Trzy zakładki na górze" in _guides and "<h4>Podgląd w prawdziwym oknie</h4>" in _guides
      and "Ściąga i okienka nad grą" not in _guides)
# Zakladka „Wyglad" zeszla 2026-09-09 — poradnik nie ma prawa dalej wysylac po nia na gore ekranu.
check("...i nie wysyla juz do zakladki, ktorej nie ma",
      "Cztery zakładki" not in _guides and 'z zakładki „Wygląd”' not in _guides
      and 'ze zwijaka „Wygląd tego okna”' in _guides)   # UX 261120 L4b: „Wygląd tego okna” to zwijak
check("...i ma pare EN do kazdego nowego zdania",
      # tytuł bez „— poradnik” (UX 261120): „Nakładki nad grą” ma parę wspólną z nagłówkiem karty
      all(k in _guides for k in ("Three tabs at the top",
                                 "Tiles and the preview", "A new overlay, and templates")))
# WALKER DOPASOWUJE CALE WEZLY TEKSTOWE, wiec para bez rysunku nie trafia w nic. Przycisk
# „Przepuszczaj kliknięcia" mial ten blad od poczatku i zostawal po polsku w sesji angielskiej.
check("pary z rysunkiem w napisie zawieraja rysunek",
      '"🖱 Przepuszczaj kliknięcia": "🖱 Let clicks through"' in _editor)
# UX 261120 B5b (D20): „Otwieraj na zywo” to dzwignia z nazwa, ktora mowi, co robi.
check("podglad w prawdziwym oknie to dzwignia rf-swi ze zdaniem, a nie rozowy przycisk",
      'class="rf-swi" id="ovgLive"' in _gal and "Podgląd w prawdziwym oknie" in _gal
      and "Otwieraj na żywo</button>" not in _gal
      and "Dopóki jesteś na tym ekranie, ustawiane okno stoi otwarte. Zamknie się, gdy stąd wyjdziesz." in _gal)
check("pigulka okna ma trzy stany i zwalnia okno podgladu (F-G6-01)",
      "function ovgWinMode(" in _gal and "function ovgRelease(" in _gal and "function ovgKeep(" in _gal
      and 'return (wid && wid === _ovgOpened) ? "keep" : "hide";' in _gal)
check("napisy nowych zakladek maja pary",
      '"Ściąga": "Cheat sheet"' in _rest)

print("\n--- osadzenie wlasnej strony jest dozwolone, cudze osadzenie nadal nie ---")
# Miniatura wymagala poluzowania DWOCH naglowkow — i oba musza byc poluzowane dokladnie do „self":
# „DENY"/„none" blokowaloby takze nas, a „*"/brak wpuscilby obca strone (clickjacking na localhost).
check('okno przegladarki: „SAMEORIGIN”, nie „DENY”',
      'self.send_header("X-Frame-Options", "SAMEORIGIN")' in _py2
      and '"X-Frame-Options", "DENY"' not in _py2)
check("CSP: osadzic nas moze tylko nasza strona", "frame-ancestors 'self'" in _py2
      and "frame-ancestors 'none'" not in _py2)
check("...a my mozemy osadzic siebie (bez tego ramka padla po naszej stronie)",
      "frame-src 'self' https://ko-fi.com" in _py2)
check("reszta polityki nietknieta", "default-src 'none'" in _py2 and "object-src 'none'" in _py2
      and "base-uri 'none'" in _py2 and "form-action 'none'" in _py2)

# ---- SZEROKOSC UKLADU (2026-09-07) -----------------------------------------------------------
# Nakladka dostaje ustawienie szerokosci. Nie wraca
# pole z szerokoscia OKNA (odeszlo 09-01 i slusznie) - dochodzi drugi suwak obok "Rozmiaru calosci":
# szerokosc UKLADU w px CSS (`baseW`), a okno dalej liczy swoja szerokosc samo (baseW x scale x DPI).
print("\n--- szerokosc ukladu: drugi suwak, a nie powrot pola z pikselami ---")
check("domyslna szerokosc ukladu to 400 - tyle, ile nakladka miala od zawsze",
      rf.OVERLAY_WIN_DEFAULTS.get("baseW") == 400)
check("sanityzator zna baseW i przycina do 240..1200",
      rf._sanitize_overlay_win({"baseW": 5000})["baseW"] == 1200
      and rf._sanitize_overlay_win({"baseW": 10})["baseW"] == 240
      and rf._sanitize_overlay_win({"baseW": 600})["baseW"] == 600)
check("...a smiecie zostawia bez zmian zamiast wywracac okno",
      rf._sanitize_overlay_win({"baseW": "abc"})["baseW"] == 400
      and rf._sanitize_overlay_win({})["baseW"] == 400)
check("szerokosc okna liczy sie z baseW, a nie ze stalej",
      "function ovlAutoWidth(scale,dpr,baseW)" in _ovl
      and "ovlBaseW(baseW)*z*(dpr||1)" in _ovl
      and "ovlAutoWidth((OVL.cfg&&OVL.cfg.scale)||100,dpr,OVL.cfg&&OVL.cfg.baseW)" in _ovl)
check("suwak stoi w edytorze (zakladka Wyglad) obok Rozmiaru calosci i zapisuje baseW",
      'id="ovmWidth"' in _look and _look.index('id="ovmScale"') < _look.index('id="ovmWidth"')
      and 'ovmSend(w.wid, { baseW: +e.target.value })' in _editor
      and '_ovmSet("ovmWidth", bw)' in _editor)
check("...i w szufladzie samego okna (parytet), z tym samym kluczem",
      'id="ovlWidth"' in _ovl and "ovlSave({baseW:+e.target.value})" in _ovl
      and 'document.getElementById("ovlWidth"); if(wd&&document.activeElement!==wd)wd.value=bw' in _ovl)
check("okno kola go nie dostaje - jego bok liczy karta Kolo wyboru",
      'document.getElementById("ovmWidthRow")' in _editor
      and 'wrow.style.display = w.wheel ? "none" : ""' in _editor)
check("zdanie o wielkosci okna mowi o obu suwakach, w obu miejscach i po angielsku",
      "szerokość idzie za „Szerokością” i „Rozmiarem całości”" in _ovl
      and "szerokość idzie za „Szerokością” i „Rozmiarem całości”" in _editor
      and "the width follows “Width” and “Whole overlay”" in _ovl
      and "szerokość idzie za „Rozmiarem całości”, wysokość" not in _ovl
      and "szerokość idzie za „Rozmiarem całości”, wysokość" not in _editor)

# ---- POSWIATA PADA NIE JEST SCINANA (2026-09-07) ------------------------------------------
# Zgloszenie: "jak kontroler dotyka od lewej do prawej ramki, albo od dolu - to jego obrys lekko
# wychodzi poza okno i wydaje sie uciety". Rysunek pada ma w panelu overflow:hidden i pudelko bez
# bocznych marginesow; nad gra przy duzym padzie poswiata nie miala sie gdzie narysowac.
_ovcss = _read("css", "15-overlay.css")
# ---- POLA X/Y I MAPKA EKRANOW (2026-09-07) --------------------------------------------------
# Zgloszenie: "nie widac wartosci wprowadzonej, tylko pojedyncze cyfry (...) nie widac podgladu
# ruchu w czasie rzeczywistym okna". Pole kurczyl suwak z flex:1; a miniatura pokazuje JAK okno
# wyglada, nie GDZIE stoi - stad mapka monitorow z prostokatem okna, rysowana z suwaka, nie z echa.
print("\n--- pola polozenia nie kurcza sie, a mapka pokazuje dokad idzie okno ---")
check("pole liczbowe ma sztywna szerokosc na piec cyfr ze znakiem",
      ".ovm-num-sm{width:84px;min-width:84px;flex:0 0 84px" in _css and ".ovm-num{flex:0 0 auto}" in _css)
check("mapka stoi pod suwakami polozenia i rysuje monitory z tej samej przestrzeni co x/y",
      'id="ovmMap"' in _cfg and "function _ovmMapDraw(c)" in _editor
      and "OVL.state.screens" in _editor.split("function _ovmMapDraw")[0].split("function _ovmPosLive")[0] + _editor.split("function _ovmMapDraw")[1][:600]
      and "ovm-map-win" in _editor and "ovm-map-scr" in _editor)
check("...i idzie za palcem: rysowana z suwaka przed echem serwera, a przy kole schowana",
      "_ovmMapDraw(Object.assign({}, w.cfg" in _editor and "_ovmMapDraw(w.wheel ? null : c);" in _editor)

print("\n--- poswiata wokol pada ma miejsce ---")
check("pudelko pada dostaje marginesy z bokow i od dolu - TYLKO nad gra",
      "html.rf-ovl .ov-col .ov-padbox{padding:7px 8px 8px}" in _ovcss)
check("...a obcinanie schodzi, bo poza pudelko wychodzi wylacznie poswiata",
      "html.rf-ovl .ov-col .ov-pad{overflow:visible}" in _ovcss)
check("panel zostaje przy swoim (rysunek dalej przyciety w kolumnie ustawien)",
      "aspect-ratio:750/630;overflow:hidden" in _read("css", "14b-gamepad.css"))

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
