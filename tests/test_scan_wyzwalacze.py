"""SKANER - OKIENKO WYZWALACZY NAD PULPITEM I ZRZUT BEZ NAKLADKI (2026-09-22).

Dwa wymagania, oba o oknie nad pulpitem:

  1. "do skanera nad pulpitem - trzeba dodac mozliwosc juz z tamtego miejsca edytowania tego,
     co na tym screenie [sekcja »Czym sterujesz skanerem« z karty] (...) przycisk testu wyslania
     sygnalu, zeby od razu zasymulowac i podejrzec jak ta akcja dziala".
  2. "robienie screena jak nakladka jest nad pulpitem - to screen ma byc zrobiony bez tej
     nakladki".

Czego pilnuje ten plik, po kolei:

  A. ZRZUT BEZ NAKLADKI (`ScanOverlay.zrzut_ukryj` / `zrzut_pokaz`) - kolejnosc wywolan Win32 na
     atrapie okna: schowaj -> pauza -> (zdjecie) -> pokaz, flaga `zrzut` podniesiona tylko na ten
     czas, i zdjeta TAKZE gdy Windows odmowi. Bez flagi watek pilnujacy pozycji stawia okno
     z powrotem w srodku robienia zdjecia (`_ustaw_okno` niesie SWP_SHOWWINDOW).
  B. `zrzut_monitora` z podstawionym Pillow - chowa PRZED zdjeciem, pokazuje PO, a gdy okna nie
     dalo sie schowac (stoi, ale nie znamy jeszcze uchwytu) mowi o tym w `uwaga`.
  C. OKIENKO WYZWALACZY (rf-50p) - straznicy statyczni, ktorych nie da sie sprawdzic inaczej niz
     czytajac plik: proba NIGDY nie klika, panel ozywa tylko w trybie `edycja`, reguly buduje
     funkcja karty (jedno zrodlo prawdy), a nazwy wielkosci sa lustrem `FILTER_METRICS`.
  D. Kolejnosc skryptow w `skaner-nakladka.html` - rf-50p po rf-50h i rf-50m, bo pyta ich o silnik
     i o prostokat ekranu glownego.

Bez znakow spoza ASCII w print() - konsola cp1250.
"""
import os
import re
import sys
import types

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import ribbitflip_monitor as rf   # noqa: E402

KORZEN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_passed = 0
_failed = 0
_skipped = 0


def check(name, cond, detail=""):
    global _passed, _failed
    if cond:
        _passed += 1
    else:
        _failed += 1
        print("FAIL  %s%s" % (name, ("  -> " + str(detail)) if detail else ""))


def skip(name, why):
    global _skipped
    _skipped += 1
    print("SKIP  %s  (%s)" % (name, why))


def zrodlo(*czesci):
    with open(os.path.join(KORZEN, *czesci), "r", encoding="utf-8") as f:
        return f.read()


# =================================================================================================
#  A. ZRZUT BEZ NAKLADKI - kolejnosc i flaga
# =================================================================================================
class AtrapaOkna(rf.ScanOverlay):
    """Prawdziwa klasa, podmienione tylko te dwa miejsca, w ktorych mowi Windows i zegar.

    Tak wlasnie ma byc: sprawdzamy DECYZJE (co i w jakiej kolejnosci), a nie ctypes."""

    def __init__(self, otwarte=True, hwnd=4321, tryb="edycja"):
        rf.ScanOverlay.__init__(self)
        self.hwnd = hwnd
        self.tryb = tryb
        self._otwarte = otwarte
        self.slad = []
        self.rzuc = False

    def is_open(self):
        return self._otwarte

    def _win_show(self, hwnd, co):
        if self.rzuc:
            raise OSError("Windows odmowil")
        self.slad.append((int(hwnd), co))

    def _pauza(self, sekundy):
        self.slad.append(("pauza", round(float(sekundy), 3)))


print("- zrzut bez nakladki: chowanie okna")
o = AtrapaOkna()
h = o.zrzut_ukryj()
check("zrzut_ukryj zwraca uchwyt okna", h == 4321, h)
check("najpierw SW_HIDE, potem pauza na przemalowanie pulpitu",
      o.slad == [(4321, "schowaj"), ("pauza", 0.08)], o.slad)
check("flaga zrzutu podniesiona (watek pozycji ma zamilknac)", o.zrzut is True)
o.zrzut_pokaz(h)
check("edytor wraca ZE skupieniem (bierze mysz i Esc)", o.slad[-1] == (4321, "aktywuj"), o.slad)
check("flaga zrzutu zdjeta po pokazaniu", o.zrzut is False)

o2 = AtrapaOkna(tryb="skan")
o2.zrzut_pokaz(o2.zrzut_ukryj())
check("skaner i podglad wracaja BEZ skupienia (nie zabieraja go grze)",
      o2.slad[-1] == (4321, "pokaz"), o2.slad)

print("- zrzut bez nakladki: przypadki, w ktorych nie ma czego chowac")
o3 = AtrapaOkna(otwarte=False)
check("zamkniete okno: zero i ani jednego wywolania", o3.zrzut_ukryj() == 0 and o3.slad == [], o3.slad)
check("zamkniete okno: flaga nietknieta", o3.zrzut is False)

o4 = AtrapaOkna(hwnd=0)          # okno stoi, ale watek stylujacy jeszcze go nie znalazl
check("okno bez uchwytu: zero (wolajacy ma o tym POWIEDZIEC, patrz B)",
      o4.zrzut_ukryj() == 0 and o4.slad == [], o4.slad)
check("okno bez uchwytu: flaga nie zostaje podniesiona", o4.zrzut is False)

o5 = AtrapaOkna()
o5.rzuc = True
check("odmowa Windowsa: zero", o5.zrzut_ukryj() == 0)
check("odmowa Windowsa: flaga ZDJETA (inaczej okno zamarza w nieruchomosci)", o5.zrzut is False)

o6 = AtrapaOkna()
o6.zrzut_ukryj()
o6.rzuc = True                   # nie udalo sie pokazac - flaga i tak musi zejsc
o6.zrzut_pokaz(4321)
check("odmowa przy pokazywaniu: flaga i tak zdjeta", o6.zrzut is False)

o7 = AtrapaOkna()
o7.zrzut_pokaz(0)
check("zrzut_pokaz(0) niczego nie wola", o7.slad == [], o7.slad)

# Watek pilnujacy pozycji MUSI czytac te flage. Grep, bo petla `_watek_okna` nie daje sie
# uruchomic bez prawdziwego okna - a to wlasnie ona przywracala nakladke w srodku zdjecia.
src_monitor = zrodlo("ribbitflip_monitor.py")
petla = src_monitor[src_monitor.find("nast_gora = 0.0"):]
petla = petla[:petla.find("def _ustaw_okno")]
print("- zrzut bez nakladki: watek pozycji milczy na czas zdjecia")
check("petla czyta flage zrzutu", "robi_zrzut" in petla)
check("poprawka pozycji (SWP_SHOWWINDOW) wstrzymana", "if robi_zrzut:\n                        trzeba = False" in petla)
check("pomiar widoku NIE jest konsumowany w trakcie zrzutu",
      "if not robi_zrzut:\n                        self.widok_nowy = False" in petla)
check("wypchniecie na wierzch tez czeka", "if teraz >= nast_gora and not robi_zrzut:" in petla)


# =================================================================================================
#  B. zrzut_monitora - chowa przed zdjeciem, pokazuje po, i mowi, gdy sie nie udalo
# =================================================================================================
class AtrapaObrazu:
    """Rozmiar podstawiamy pod PRAWDZIWY tryb monitora - inaczej `zrzut_monitora` slusznie
    doklada swoja druga uwage ("zrzut ma X, a monitor pracuje w Y") i zagluszylaby te, o ktora
    w tym tescie chodzi."""
    width = 1920
    height = 1080


class AtrapaOverlayGlobalna:
    """Podstawiana pod globalne SCAN_OVERLAY na czas testu `zrzut_monitora`."""

    def __init__(self, otwarte, hwnd):
        self.otwarte = otwarte
        self.hwnd = hwnd
        self.slad = []

    def is_open(self):
        return self.otwarte

    def zrzut_ukryj(self):
        self.slad.append("schowaj")
        return self.hwnd if (self.otwarte and self.hwnd) else 0

    def zrzut_pokaz(self, hwnd):
        self.slad.append("pokaz:%s" % int(hwnd or 0))


def podstaw_pillow(slad):
    """Fałszywe `PIL.ImageGrab` - zdjecie ekranu w tescie nie moze byc prawdziwe."""
    pil = types.ModuleType("PIL")
    grab_mod = types.ModuleType("PIL.ImageGrab")

    def grab(bbox=None, all_screens=False):
        slad.append("grab")
        return AtrapaObrazu()

    grab_mod.grab = grab
    pil.ImageGrab = grab_mod
    return pil, grab_mod


print("- zrzut_monitora: nakladka schodzi przed zdjeciem i wraca po nim")
rect = None
try:
    stary_ctx = rf._dpi_per_monitor_enter()
    try:
        rect = rf._monitor_do_zrzutu("glowny")
    finally:
        rf._cursor_space_exit(stary_ctx)
except Exception:
    rect = None

if not rect:
    skip("zrzut_monitora", "brak ukladu monitorow (nie-Windows albo brak ekranu)")
else:
    stare_pil = sys.modules.get("PIL")
    stare_grab = sys.modules.get("PIL.ImageGrab")
    stary_overlay = rf.SCAN_OVERLAY
    _pw, _ph = rf.display_pixels(rect[0])
    if _pw > 0 and _ph > 0:
        AtrapaObrazu.width, AtrapaObrazu.height = int(_pw), int(_ph)
    else:
        AtrapaObrazu.width, AtrapaObrazu.height = rect[3] - rect[1], rect[4] - rect[2]
    try:
        slad = []
        pil, grab_mod = podstaw_pillow(slad)
        sys.modules["PIL"] = pil
        sys.modules["PIL.ImageGrab"] = grab_mod

        # (1) okno stoi i da sie je schowac
        fake = AtrapaOverlayGlobalna(True, 777)
        rf.SCAN_OVERLAY = fake
        im, info, blad = rf.zrzut_monitora("glowny")
        check("zrzut sie udal", im is not None and not blad, blad)
        check("kolejnosc: schowaj -> zdjecie -> pokaz",
              fake.slad[0] == "schowaj" and slad == ["grab"] and "pokaz:777" in fake.slad, (fake.slad, slad))
        check("nic nie doklada uwagi, gdy okno grzecznie zeszlo", not info.get("uwaga"), info)

        # (2) okno stoi, ale nie znamy uchwytu - zdjecie WYJDZIE z nakladka
        slad[:] = []
        fake2 = AtrapaOverlayGlobalna(True, 0)
        rf.SCAN_OVERLAY = fake2
        im2, info2, blad2 = rf.zrzut_monitora("glowny")
        check("zrzut mimo wszystko powstaje", im2 is not None and not blad2, blad2)
        uwaga2 = info2.get("uwaga") or ""
        check("uwaga mowi, ze okno zostalo na obrazie",
              "jeszcze widoczne" in uwaga2 and "obrysy" in uwaga2, uwaga2)

        # (3) okna nie ma - ani slowa o nakladce
        slad[:] = []
        fake3 = AtrapaOverlayGlobalna(False, 0)
        rf.SCAN_OVERLAY = fake3
        im3, info3, blad3 = rf.zrzut_monitora("glowny")
        check("bez okna nie ma o czym mowic", im3 is not None and not info3.get("uwaga"), info3)
    finally:
        rf.SCAN_OVERLAY = stary_overlay
        for nazwa, modul in (("PIL", stare_pil), ("PIL.ImageGrab", stare_grab)):
            if modul is None:
                sys.modules.pop(nazwa, None)
            else:
                sys.modules[nazwa] = modul


# =================================================================================================
#  C. OKIENKO WYZWALACZY (rf-50p) - straznicy statyczni
# =================================================================================================
src_p = zrodlo("web", "js", "rf-50p-scan-overlay-wyzwalacze.js")
src_h = zrodlo("web", "js", "rf-50h-scan-overlay.js")
src_i = zrodlo("web", "js", "rf-50i-scan-signals.js")
src_10 = zrodlo("web", "js", "rf-10-triggers-model.js")
src_html = zrodlo("web", "skaner-nakladka.html")

print("- okienko wyzwalaczy: proba niczego nie klika")
# NAJWAZNIEJSZY TEST W TYM PLIKU. Okno nad pulpitem klika NAPRAWDE tylko w trybie `skan`,
# przy wlaczonym module - to jest cala zgoda czlowieka na przejecie ekranu. Proba ma pokazac
# przejazd paska i slad, a nie nacisnac przycisk w cudzej aplikacji.
check("rf-50p nie wola /test-key", "/test-key" not in src_p)
check("rf-50p nie sklada speca myszy", "mouse:" not in src_p)
check("rf-50p wysyla sygnal trasa /scan/sygnal", "/scan/sygnal" in src_p)
check("proba w rf-50h nie klika (klikNaprawde tylko przy !PODGLAD)",
      re.search(r"if \(!PODGLAD\) klikNaprawde\(dane\);\s*\n\s*else if \(proba\) pokazProbe\(dane\);", src_h) is not None)
check("pokazProbe rysuje slad i nie wysyla klawisza",
      "function pokazProbe" in src_h
      and "wyslij(" not in src_h[src_h.find("function pokazProbe"):src_h.find("function wyslij")])
check("bramka podgladu przepuszcza sygnaly TYLKO w probie",
      "if (PODGLAD && !proba) return;" in src_h)
check("wylaczenie proby przerywa przejazd i sprzata slady",
      "silnik.przerwij()" in src_h and "scena.wyczyscSlady()" in src_h)

print("- okienko wyzwalaczy: gdzie zyje i czym buduje reguly")
check("ozywa wylacznie przy ?edycja=1",
      'if (par.get("edycja") !== "1") return;' in src_p)
check("regule buduje funkcja karty, nie wlasny ksztalt",
      "_skanNowaRegula(spec, z.rule" in src_p)
check("brak wlasnego katalogu gotowcow (czyta SKAN_ZRODLA_WLASNE / _skanZrodla)",
      "SKAN_ZRODLA_WLASNE" in src_p and "key: \"tilt-right\"" not in src_p)
check("zapis regul idzie ze SWIEZEJ listy (read-modify-write)",
      "function zapiszReguly" in src_p and src_p.count('fetch("/rules?dev=') >= 3)
check("okienko chowa sie razem z edytorem (oczko oddaje mysz pulpitowi)",
      "body.sk-ed-ukryty .wy-okno { display: none; }" in src_html)

print("- okienko wyzwalaczy: nazwy wielkosci sa lustrem Mapowania")
# `FILTER_METRICS` w rf-10 to [klucz, nazwa, jednostka, min, max]. Rf-50p ma wlasna kopie NAZW
# (tamten plik liczy przy starcie kolory kanalow, wiec w oknie bez panelu wstaje martwy), a taka
# kopia rozjezdza sie po cichu - raz juz "Pochylenie" znaczylo w niej `pitch` zamiast `tilt`.
blok = src_10[src_10.find("const FILTER_METRICS=["):]
blok = blok[:blok.find("];")]          # sam slownik, bez sasiednich tablic kanalow (RE_NAME)
metryki = dict((m.group(1), (m.group(2), m.group(3)))
               for m in re.finditer(r'\["(\w+)","([^"]+)","([^"]*)",', blok))
check("odczytano slownik FILTER_METRICS", len(metryki) == 5, sorted(metryki))
lustro = dict((m.group(1), (m.group(2), m.group(3)))
              for m in re.finditer(r'(\w+): \{ nazwa: "([^"]+)", jedn: "([^"]*)" \}', src_p))
check("lustro ma tyle samo pozycji", len(lustro) == len(metryki), sorted(lustro))
for klucz, para in sorted(metryki.items()):
    check("nazwa i jednostka zgodne: %s" % klucz, lustro.get(klucz) == para,
          (para, lustro.get(klucz)))

print("- znacznik proby staje tam, gdzie skaner by kliknal")
# ⚠️ REGRESJA ZE ZRZUTU WLASCICIELA (22.09): znacznik „tutaj by kliknal" lezal kilkaset pikseli
# obok. `Scena.slad` zapamietuje punkt jako UŁAMEK podanego prostokata, a potem KAZDA KLATKA
# przestawia go prostokatem OBSZARU (`rysuj`). Ulamek policzony od pulpitu, przylozony do obszaru,
# przesuwa kropke tym mocniej, im wezszy obszar. Zmierzone po naprawie: obszar {x:102, w:1159}
# na pulpicie 1707, punkt 105 px -> znacznik 105 px (przed naprawa wypadloby 173 px).
for nazwa, wzor in (("proba rysuje slad obszarem", r"scena\.slad\(wynik\.punkt, RFScan\.nazwaAkcji\(wynik\.akcja\), ekran\(\)\)"),):
    check(nazwa, len(re.findall(wzor, src_h)) == 2, len(re.findall(wzor, src_h)))
check("ani jeden slad nie dostaje juz pulpitu", "slad(wynik.punkt, RFScan.nazwaAkcji(wynik.akcja), e)" not in src_h)
# ...a KLIK ma dalej liczyc sie od pulpitu: to dwie rozne rzeczy i pomylenie ich w druga strone
# dalby skaner, ktory rysuje dobrze, a klika obok.
check("klik nadal liczy procenty od pulpitu",
      # Od 26.09 przez `procentPulpitu` (okno na jednym z kilku monitorow doklada przesuniecie
      # swojego ekranu) — ale nadal z PULPITU (`pelne()`), nie z obszaru (`ekran()`).
      re.search(r"const pr = RFScan\.procentPulpitu\(wynik\.punkt, ekrany, pelne\(\)\);\s*\n\s*const px = pr\.x, py = pr\.y;", src_h) is not None)

print("- ustawienia skanera: te same pokretla, co w karcie")
check("okno wczytuje panel pol karty", "rf-50b-scan-fields.js" in src_html)
check("rf-50p buduje pola przez RFScan.Panel", "new RFScan.Panel(host" in src_p)
check("rf-50p nie ma wlasnych definicji pokretel",
      "typ: 'suwak'" not in src_p and 'typ: "suwak"' not in src_p and "'sk-suwak'" not in src_p)
check("podzial konfiguracji idzie kluczami modelu, nie wlasna lista",
      "Object.keys(RFScan.WYGLAD_DOM" in src_p and "kolorY" not in src_p)
check("zapis pokretel ma opoznienie i znacznik wyscigu",
      "zapisTimer = setTimeout" in src_p and "if (nr !== zapisNr) return;" in src_p)
check("odpowiedz serwera nie wchodzi w trakcie wlasnego zapisu", "if (!zapisTimer) {" in src_p)
check("zestaw zachowuje obszar narysowany mysza",
      "OBSZAR_KLUCZE" in src_p and "pola.zastosujZestaw(kod)" in src_p)
check("uklad monitorow trafia do modelu (pola obszaru go czytaja)",
      "RFScan.ustawEkrany(j)" in src_p)

print("- okno staje na USTAWIENIACH, nie na wyzwalaczach")
# Zakladki ustawienia i wyzwalacze zamienione miejscami, domyslnie aktywne sa
# ustawienia po wlaczeniu. Nad pulpitem wraca sie po pokretla; wyzwalacz dobiera sie raz.
check("zakladka domyslna to ustawienia", 'let zakladka = "ustawienia";' in src_p)
if 'id = "wyZakUst"' in src_p and 'id = "wyZakWyz"' in src_p:
    check("Ustawienia stoja PRZED Wyzwalaczami",
          src_p.index('id = "wyZakUst"') < src_p.index('id = "wyZakWyz"'))
check("tytul okienka chodzi za zakladka (zwiniete pokazuje sam tytul)",
      "function ustawTytul" in src_p and "Ustawienia skanera" in src_p)
check("przycisk w pasku nazywa sie Ustawienia",
      '⚙ Ustawienia</button>' in zrodlo("web", "js", "rf-50m-scan-overlay-edit.js")
      and 'id="edUst"' in zrodlo("web", "js", "rf-50m-scan-overlay-edit.js"))
check("nigdzie nie zostalo stare id przycisku", "edWyzw" not in zrodlo("web", "js", "rf-50m-scan-overlay-edit.js"))

print("- okienko wyzwalaczy: trzy role przychodza z karty")
role = re.findall(r'spec: "(scan:\w+)"', src_i)
check("karta ma dokladnie trzy role", role == ["scan:sygnal", "scan:cofnij", "scan:stop"], role)
check("rf-50p nie deklaruje wlasnych rol", 'spec: "scan:' not in src_p)
check("rf-50p czyta role z SKAN_SYGNALY", "SKAN_SYGNALY" in src_p)


# =================================================================================================
#  D. Kolejnosc ladowania w stronie nakladki
# =================================================================================================
print("- strona nakladki: kolejnosc skryptow")
kolejnosc = re.findall(r'<script src="/web/js/([^"]+)"></script>', src_html)
for plik in ("rf-12c-gesture-presets.js", "rf-50i-scan-signals.js", "rf-50b-scan-fields.js",
             "rf-50p-scan-overlay-wyzwalacze.js"):
    check("wczytany: %s" % plik, plik in kolejnosc, kolejnosc)
if "rf-50p-scan-overlay-wyzwalacze.js" in kolejnosc:
    i_p = kolejnosc.index("rf-50p-scan-overlay-wyzwalacze.js")
    check("rf-50p po rf-50h (pyta go o silnik i strumien)",
          i_p > kolejnosc.index("rf-50h-scan-overlay.js"), kolejnosc)
    check("rf-50p po rf-50m (pyta go o prostokat ekranu glownego)",
          i_p > kolejnosc.index("rf-50m-scan-overlay-edit.js"), kolejnosc)
    check("rf-50p po katalogu karty (rf-50i)",
          i_p > kolejnosc.index("rf-50i-scan-signals.js"), kolejnosc)
    check("rf-50p po polach karty (rf-50b)",
          i_p > kolejnosc.index("rf-50b-scan-fields.js"), kolejnosc)

# =================================================================================================
#  E. SCENA NAD PULPITEM — nie zaslaniac i dac sie zobaczyc na jasnym oknie gry
# =================================================================================================
src_c = zrodlo("web", "js", "rf-50c-scan-scene.js")
src_model = zrodlo("web", "js", "rf-50-scan-model.js")

print("- radar: silnik nie wola juz funkcji, ktorej nie ma")
# ⚠️ `trojkat` NIE ISTNIAL NIGDZIE. Drugi etap radaru rzucal ReferenceError przy kazdej klatce -
# stad zgloszenie „radar nie pokazuje kropki". Straz na wypadek, gdyby ktos wrocil do tamtej nazwy.
# Sama NAZWA zostaje w komentarzu (opisuje, co tu bylo) - szukamy WYWOLANIA, nie wzmianki.
check("nigdzie nie ma wywolania trojkat(...)",
      all(not re.search(r"[?:=(]\s*trojkat\(", zrodlo("web", "js", p)) for p in
          ("rf-50-scan-model.js", "rf-50c-scan-scene.js", "rf-50h-scan-overlay.js")))
check("radar jedzie tym samym przelotem, co pasek",
      "przelot(el, czas, self.u.pauzaNaKrancach" in src_model)

print("- scena wie, ze lezy na cudzej pracy")
check("Scena ma tryb nadPulpitem", "this.nadPulpitem = function" in src_c)
check("okno nad pulpitem go wlacza", "scena.nadPulpitem(true)" in src_h)
# ZASLANIANIE: pole cwiartek przy siatce 2x2 to CWIARTKA EKRANU. Wypelnienie zaslania dokladnie to,
# w co czlowiek celuje - nad pulpitem zostaje sama ramka.
check("pola cwiartek bez wypelnienia nad pulpitem",
      re.search(r"if \(nadPulpitem\) \{[\s\S]{0,1400}?d\.style\.background = 'transparent';[\s\S]{0,200}?\} else \{",
                src_c) is not None)
check("nieaktywne pole ma PELNY kolor, nie polprzezroczysta biel",
      "d.style.borderColor = aktywny ? KOLORY.blok : '#4a7f96';" in src_c)
check("promien radaru bez gradientu do przezroczystosci nad pulpitem",
      "w.promien.style.background = nadPulpitem ? KOLORY.radar" in src_c)
check("pasek dostaje obrys (cieni w tym oknie nie ma)",
      "w.pasmo.style.outline = nadPulpitem ? '2px solid ' + kolor : '';" in src_c)
check("srodek radaru istnieje (promien nie wychodzi znikad)", "sc-radar-srodek" in src_c and "sc-radar-srodek" in src_html)
for regula in ("#scena.sc-nad .sc-kres", "#scena.sc-nad .sc-punkt", "#scena.sc-nad .sc-slad",
               "#scena.sc-nad .sc-kropka"):
    check("ciemna obwodka dla znaku: %s" % regula.split(".")[-1], regula in src_html)

print("- okno a pulpit: rysujemy w widoku, zapisujemy i klikamy w pulpicie")
# Objaw: czasem grafika nie jest dobrze doskalowana do okna (albo
# okno do grafiki). Scena liczy w pikselach PULPITU, a element DOM dostaje je jako piksele CSS
# WIDOKU - zwykle to jedno i to samo (kiosk przy jednym monitorze), czasem nie. Zmierzone na
# oknie 1024x768 przy pulpicie 1707x1067: przeciagniecie ramki 100,100 -> 500,400 zapisywalo sie
# jako 5,9..29,3 % zamiast 9,8..48,8 % ekranu. Po naprawie zapis zgadza sie co do dziesiatej.
src_m = zrodlo("web", "js", "rf-50m-scan-overlay-edit.js")
check("nakladka zna swoj widok i skale", "function widok()" in src_h and "function skala()" in src_h)
check("scena doskalowuje sie do okna", "function doskalujScene" in src_h
      and "korzenScena.style.transform = zapis;" in src_h)
check("prog 5 %, zeby nie ruszac znanego pasa kilkunastu pikseli", "const SKALA_PROG = 0.05;" in src_h)
check("skala sprawdzana w kazdej klatce", re.search(r"function klatka\(t\) \{[\s\S]{0,400}?doskalujScene\(\);", src_h) is not None)
check("edytor obszaru liczy ramke WIDOKIEM, nie pulpitem",
      "if (N().widok) return N().widok();" in src_m)
check("edytor dowiaduje sie o zmianie skali", "poSkali:" in src_m and "poSkali" in src_h)
check("rozjazd widac w pasku (chip skali)", "function pokazSkale" in src_m and 'id="edSkala"' in src_m
      and ".sk-ed-skala" in src_html)

print("- sygnal probny takze w pasku na dole")
check("pasek ma przycisk sygnalu", 'id="edSygnal"' in zrodlo("web", "js", "rf-50m-scan-overlay-edit.js"))
check("pasek ma koniec proby", 'id="edKoniecProby"' in zrodlo("web", "js", "rf-50m-scan-overlay-edit.js"))
check("koniec proby pokazuje sie sam w trakcie proby",
      "body.rf-proba .sk-ed-btn-koniec { display: inline-block; }" in src_html)
check("przycisk paska jedzie przez to samo API, co okienko",
      'W.sygnal("sygnal")' in zrodlo("web", "js", "rf-50m-scan-overlay-edit.js"))
check("proba jest bursztynowa w OBU miejscach (jeden jezyk koloru)",
      ".sk-ed-btn-proba { background: #eaa32b" in src_html and ".wy-btn-proba { background: #eaa32b" in src_html
      and "wy-btn wy-btn-proba" in src_p)

print("- kontrast w okienku (liczby, nie oko)")
check("nazwy zestawow maja wlasny kolor (przycisk nie dziedziczy)",
      "#wyOkno .ui-zestaw { padding: 7px 9px; border-radius: 9px; color: #efe9dd; }" in src_html)
check("roz odczytow podniesiony na ciemnym tle", "--pink: #ff6fb5;" in src_html)
check("stopka i opis zestawow powyzej progu 4,5:1", "color: #8d97a3" in src_html)

print("- radar na sucho (harness node)")
import subprocess   # noqa: E402
harness = os.path.join(os.path.dirname(os.path.abspath(__file__)), "scan_radar_harness.cjs")
try:
    p = subprocess.run(["node", harness], capture_output=True, text=True, timeout=60)
    ostatnia = [l for l in (p.stdout or "").strip().splitlines() if "passed" in l]
    check("radar przejezdza oba etapy bez wyjatku (node)", p.returncode == 0,
          (p.returncode, ostatnia[-1] if ostatnia else (p.stderr or "")[:200]))
    if ostatnia:
        print("    " + ostatnia[-1])
except FileNotFoundError:
    skip("harness radaru", "brak node")
except Exception as e:
    skip("harness radaru", str(e))

print("")
print("%d passed, %d failed%s" % (_passed, _failed, (", %d skipped" % _skipped) if _skipped else ""))
sys.exit(1 if _failed else 0)
