# Wyzwalacze w module „Uslugi sieciowe” — slownik warunku zrownany z Mapowaniem.
# Uruchom: py tests/test_rest_triggers.py   (potrzebuje `node` — silnik jest w JS)
#
# ZGLOSZENIE, KTORE TO ZRODZILO (2026-09-12): „w rest api wyzwalacze powinno dac sie konfigurowac
# jak w mapowaniu. z jakiegos powodu zrobiles tam inne ustawienia mapowania."
#
# Co bylo: dwa operatory zamiast szesciu, brak |x|, brak NIE, brak zakresu, brak suwaka, brak
# „ustaw na biezaca”, trzy „tryby” zamiast zachowan Mapowania, brak metryki „wirowanie” (mimo ze
# serwer ja liczy i wysyla), etykieta zrodla klamiaca o zakresie pochylenia (0–90 zamiast 0–180).
#
# Test ma DWIE warstwy i obie sa potrzebne:
#   A. KONTRAKT — nowe pole warunku musi przezyc zapis. Sanityzator w panelu jest JEDYNA brama
#      (serwer nie zna ksztaltu wyzwalacza w ogole), a obiekt warunku byl kiedys budowany od zera
#      w SIEDMIU miejscach. Pole dopisane do szesciu z nich ginelo dokladnie w jednym przeplywie.
#   B. SILNIK — asercja „w pliku jest napis taps” nie mowi nic o tym, czy „Dokladnie N punkniec”
#      liczy punkniecia. Scenariusze jada przez prawdziwy `_ra4Step` w node (harness obok).
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

_passed = 0
_failed = 0


def check(name, cond, detail=""):
    global _passed, _failed
    if cond:
        _passed += 1
        print("PASS  %s" % name)
    else:
        _failed += 1
        print("FAIL  %s%s" % (name, ("  [%s]" % detail) if detail else ""))


def src(p):
    return open(os.path.join(ROOT, p), "r", encoding="utf-8").read()


E2 = src("web/js/rf-35-rest-e2.js")      # sanityzator konfiguracji (jedyna brama)
E3 = src("web/js/rf-36-rest-e3.js")      # karta aplikacji, dziennik, sciezka krokow
E4 = src("web/js/rf-37-rest-e4.js")      # model + UI + silnik wyzwalaczy
M10 = src("web/js/rf-10-triggers-model.js")  # WSPOLNY slownik wielkosci (od 12.09 zrodlo dla RA4_SRC)
E5 = src("web/js/rf-39-rest-e5.js")      # paczki akcji (eksport / podglad / scalanie)
CSS = src("web/css/12-rest-api.css")

# ── A. kontrakt: jeden spis pol warunku ────────────────────────────────────────────────────
check("a1. istnieje JEDEN spis pol warunku ruchu (_raSanMotion)", "function _raSanMotion(" in E2)
check("a2. sanityzator zrodla wola ten spis, zamiast przepisywac pola",
      "_raSanMotion(s)" in E2.split("function _raSanSrc(")[1][:400])
check("a3. domyslny wyzwalacz idzie przez ten sam spis", "_ra4NewMotionSrc(" in E4)
check("a4. naprawa runtime idzie przez ten sam spis",
      "_ra4Motion(s)" in E4.split("function _ra4Fix(")[1][:900])
check("a5. przelacznik rodzaju zrodla NIE ma juz wlasnego literalu",
      "_ra4NewMotionSrc(t.src.dev)" in E4
      and 'source:"pose.tilt",cmp:">",threshold:30,mode:"cross"' not in E4)
check("a6. wszystkie trzy przeplywy paczki akcji (eksport, podglad importu, scalanie) ida "
      "przez _ra5Motion",
      E5.count("_ra5Motion(") >= 4, "trafien: %d" % E5.count("_ra5Motion("))
check("a7. _ra5Motion deleguje do jedynego spisu pol", "_raSanMotion(s)" in E5)

# ── A2. kontrakt: nazwa wyzwalacza ─────────────────────────────────────────────────────────
check("b1. sanityzator przepuszcza nazwe wyzwalacza", "label:_raStr(t.label,60)" in E2)
check("b2. nowy wyzwalacz ma to pole", 'label:""' in E4)
check("b3. naprawa runtime tez", "t.label=_ra4Str(t.label,60)" in E4)
check("b4. nazwa jedzie w paczce akcji (eksport, podglad, scalanie)",
      E5.count("label:_ra5Str") >= 3, "trafien: %d" % E5.count("label:_ra5Str"))
check("b5. nazwa przechodzi przez brame antywyciekowa eksportu — inaczej wklejony 'na probe' "
      "token wyjechalby w pliku mimo obietnicy 'bez tokenow i hasel'",
      "_ra5Leaks(t.label)" in E5)
check("b6. wlasna nazwa wygrywa z automatycznym opisem warunku",
      "const own=_ra4Str(t.label,60).trim();" in E4)

# ── A3. kontrakt: zrodla, operatory, zachowania ────────────────────────────────────────────
check("c1. metryka „wirowanie” jest na biale liscie configu", '"pose.spin"' in E2)
# ⚠️ ASERCJE c2 i c4 PYTAJA TERAZ TAM, GDZIE MIESZKA PRAWDA. Do 12.09 szukaly literalu w rf-37,
# bo tam stala recznie przepisana kopia slownika. Kopii juz nie ma — nazwy, jednostki i zakresy
# przychodza z `FILTER_METRICS` — wiec pytanie o literal w rf-37 sprawdzaloby nieistnienie kopii,
# a nie istnienie metryki. Zgodnosc listy UI z lista sanityzatora pilnuje rest_triggers_harness.mjs
# (`zrodla` vs `zrodlaUI`), ktory od 12.09 dostaje PRAWDZIWE `FILTER_METRICS` wyciete z rf-10.
check("c2. ...i na liscie w UI (przez wspolny slownik, nie przez wlasna kopie)",
      '"spin"' in M10 and '"spin"' in E4.split("RA4_POSE_ORDER=")[1][:120])
check("c3. szesc operatorow, tak jak w karcie warunku Mapowania",
      all(('"%s"' % c) in E2 for c in (">", "<", ">=", "<=", "in", "out")))
# Etykieta zrodla jest w tablicy RA4_SRC, a nie w komentarzu — porownujemy WIERSZ tablicy,
# inaczej asercja trafia we wlasne wyjasnienie, dlaczego stara etykieta byla nieprawda.
_TILT = [l for l in M10.splitlines() if l.strip().startswith('["tilt"')]
check("c4. etykieta pochylenia NIE klamie juz o zakresie i suwak siega 180 (serwer: POSE_AXIS_FULL)",
      len(_TILT) == 1 and "0-90" not in _TILT[0] and "0,180]" in _TILT[0],
      (_TILT[0].strip() if _TILT else "brak wiersza"))
check("c5. zachowania nazwane slowami Mapowania",
      all(w in E4 for w in ("Jednorazowo", "Ciągłe", "Po odczekaniu",
                            "X razy w czasie", "Dokładnie N puknięć")))
check("c6. stare nazwy trybu sa tlumaczone w JEDNYM miejscu",
      "RA_MODE_OLD" in E2 and "function _raMode(" in E2)

# ── A4. UI: to, czego brakowalo wzgledem Mapowania ─────────────────────────────────────────
check("d1. suwak progu", "ra-t-range" in E4 and ".ra-cond-slider" in CSS)
check("d2. przycisk „ustaw na biezaca wartosc”", "ra-t-setlo" in E4)
check("d3. ...ktory bierze REALNY odczyt, a nie przepisany tekst",
      "live&&live.val" in E4 and "rec.val=v;" in E4)
check("d4. |x| i NIE", "ra-t-abs" in E4 and "ra-t-neg" in E4)
check("d5. pole „Do (y)” tylko przy zakresie", "ra-tf-hi" in E4 and 'q(".ra-tf-hi").hidden=!rng' in E4)
check("d6. zmiana operatora NIE przerysowuje calej karty (fokus zostaje pod kursorem)",
      "_ra4Body(api,t,box,row)" not in E4.split('sc.addEventListener("change"')[1][:400])

# ── A5. sciezka „Akcja > Wyzwalacz > Test” ─────────────────────────────────────────────────
check("e1. wiersz wyzwalacza ma przycisk proby — tego kroku wczesniej NIE BYLO",
      "ra-t-test" in E4)
check("e2. proba idzie ta sama funkcja co silnik (_ra4Fire), a nie skrotem przez restRunAction — "
      "inaczej test swiecilby na zielono przy niedzialajacym wyzwalaczu",
      "{test:true}" in E4 and "restRunAction" not in E4.split('tb.addEventListener("click"')[1][:900])
check("e3. bramka symulacji NIE konczy sie juz cichym return",
      "_ra4MuteNote(api.id,trig.id,\"sim\")" in E4)
check("e4. ...i mowi o sobie czlowiekowi", "_ra4SimSaid" in E4)
check("e5. rachunek bramek istnieje", "function _ra4WhyRows(" in E4)
# OKNO ZNAKOW ZAMIENIONE NA CALE CIALO FUNKCJI. Asercja liczyla wystapienia w pierwszych
# 2600 znakach `restRenderTriggers` — czyli czerwienila sie od DOPISANIA KOMENTARZA, ktore
# przesuwa trzecie wystapienie poza okno. Test ma pilnowac, ze rachunek bramek stoi na wszystkich
# trzech wyjsciach z tej funkcji (brak akcji / brak wyzwalacza / lista), a nie tego, ile znakow
# zajmuje kod nad nimi.
_MARKER = '\nfunction '
_e6 = E4.split("function restRenderTriggers(")[1]
if _MARKER in _e6:
    _e6 = _e6[:_e6.index(_MARKER)]
check("e6. rachunek pokazuje sie TAKZE przy pustych stanach — nowy uzytkownik jest tym, "
      "ktory najbardziej go potrzebuje",
      _e6.count("_ra4WhyEl(api)") >= 3, _e6.count("_ra4WhyEl(api)"))
check("e7. rachunek odswieza sie sam, a nie po podpieciu do jednego z czterech miejsc, "
      "ktore zmieniaja wlacznik modulu",
      "_ra4WhyArm" in E4 and "setInterval" in E4.split("function _ra4WhyArm(")[1][:400])
# Osobny pasek krokow (`RA3_PATH` / `.ra-way-step`, 12.09) ZNIKNAL 13.09: prowadzil w te same trzy
# miejsca, co pod-zakladki pod nim — dwa rzedy przyciskow o tym samym znaczeniu. Kolejnosc niosa
# teraz same zakladki, rozdzielone strzalka „›". Test pilnuje, ze nie wroci drugi rzad.
check("e8. droga niesie sama zakladka: strzalki miedzy nimi, bez osobnego paska krokow",
      "ra-st-sep" in E3 and "RA3_PATH" not in E3 and "ra-way" not in E3)
# ── JEDNO ZRODLO SLOWNIKA (12.09) ──────────────────────────────────────────────────────────────
# `RA4_SRC` bylo TRZECIA recznie przepisana kopia tego samego slownika (rf-10 dla Mapowania,
# rf-35 dla sanityzatora, rf-37 dla karty) i kopie realnie sie rozjezdzaly: „Wirowanie" istnialo
# w Mapowaniu, a w Uslugach bylo nieosiagalne; „Pochylenie (0-90 st.)" mowilo nieprawde, bo serwer
# liczy 0..180. Teraz nazwy, jednostki i zakresy przychodza z `FILTER_METRICS`.
check("e11. slownik zrodel ruchu wyprowadzony z FILTER_METRICS, a nie przepisany trzeci raz",
      "FILTER_METRICS" in E4 and "RA4_POSE_ORDER" in E4)
check("e12. ...i nie ma juz recznie wpisanych zakresow metryk filtra",
      '"pose.tilt","Pochylenie"' not in E4 and '"pose.spin","Wirowanie' not in E4)
# Kanaly CH0-CH5 NIE sa wielkosciami filtra orientacji i w `FILTER_METRICS` ich nie ma ani nie
# bedzie — zostaja wypisane lokalnie i to jest poprawne.
check("e13. kanaly CH0-CH5 zostaja lokalne (nie ma ich w slowniku filtra)",
      '"ch0"' in E4 and "akcel Z" in E4)
# e8b i e9 pilnowaly paska krokow: nazwy jego klasy (`ra-path-step` vs `ra-way-step`) oraz tego,
# skad liczyl sie krok „Test". Pasek zniknal 13.09 razem z cala ta logika — zostaje e8 wyzej, ktore
# pilnuje, ze nie wroci drugi rzad przyciskow. Dziennik nadal oznacza wpisy z dysku (`_hist`), ale
# uzywa tego juz tylko wyszarzenie wiersza, a to sprawdza test dziennika.
check("e10. licznik „xN” jest wypelniany przy rysowaniu wiersza, a nie dopiero przy pierwszym "
      "zadzialaniu", '_ra4Fires.get(_ra4Key(api.id,t.id))||0' in E4)

# ── A6. dostepnosc i konwencje projektu ────────────────────────────────────────────────────
check("f1. wiersze rachunku niosa tresc takze dla czytnika ekranu, nie sam kolor",
      'li.setAttribute("aria-label"' in E4)
check("f2. suwaki maja nazwe dostepna", 'setAttribute("aria-label"' in E4.split("const syncRange=")[1][:700])
check("f3. jednozdaniowe title nie koncza sie kropka (pilnuje tego test_ui_tabs)",
      'title="Ustaw na bieżącą wartość"' in E4)
# Arkusz ma kilka blokow prefers-reduced-motion (jeden na rodzine komponentow) — szukamy TEGO,
# ktory dotyczy wiersza wyzwalacza.
_RM = [b for b in CSS.split("@media (prefers-reduced-motion:reduce){") if ".ra-trig," in b]
check("f4. nowe style respektuja prefers-reduced-motion",
      bool(_RM) and ".ra-t-flag label{" in _RM[0][:400], "blokow: %d" % len(_RM))
check("f5. wiersz wyzwalacza nie dostal wlasnego sciegu (scieg nosi karta i przycisk)",
      "dashed var(--stitch)" not in CSS.split(".ra-t-flag{")[1][:900])

# ── B. silnik: prawdziwe wartosci przez prawdziwy _ra4Step ─────────────────────────────────
try:
    out = subprocess.run(["node", os.path.join(ROOT, "tests", "rest_triggers_harness.mjs")],
                         capture_output=True, text=True, timeout=120, encoding="utf-8")
    w = json.loads(out.stdout.strip().splitlines()[-1]) if out.returncode == 0 else None
except Exception as e:                                   # noqa: BLE001
    w = None
    print("      (harness nie wystartowal: %s)" % e)

if w is None:
    check("g0. harness silnika wystartowal", False, "brak wyniku z node")
else:
    o = w["operatory"]
    check("g1. szesc operatorow liczy to, co obiecuje",
          all(o[k] == [True, False] for k in ("gt", "lt", "ge", "le", "in", "out")), json.dumps(o))
    check("g2. zakres podany 'na odwrot' znaczy to samo", o["inOdwrocony"] is True)
    check("g3. |x| — „w ktorakolwiek strone” dziala na wartosci ujemnej", w["abs"] == [True, False])
    check("g4. NIE odwraca warunek", w["neg"] == [True, False])
    check("g5. Jednorazowo: raz na epizod, choc warunek trwa 3 s", w["once"] == 1, str(w["once"]))
    check("g6. Ciagle: powtarza, ale nie czesciej niz min. odstep",
          5 <= w["continuous"] <= 14, str(w["continuous"]))
    check("g7. Po odczekaniu: odpala dopiero po uplywie czasu utrzymania",
          w["dwell"]["ile"] == 1 and w["dwell"]["pierwszy"] >= 1.0, json.dumps(w["dwell"]))
    check("g8. Po odczekaniu: przerwany warunek NIE odpala", w["dwellPrzerwany"] == 0)
    check("g9. X razy w czasie: trzy punkniecia w oknie = jedno wyslanie", w["multi3"] == 1)
    check("g10. X razy w czasie: dwa punkniecia z trzech = cisza", w["multi2z3"] == 0)
    check("g11. Dokladnie N punkniec: odpala PO zamknieciu okna",
          w["taps2"]["ile"] == 1 and w["taps2"]["poOknie"] is True, json.dumps(w["taps2"]))
    check("g12. Dokladnie N punkniec: trzy to nie dwa (caly sens tego zachowania)",
          w["taps3gdy2"] == 0)
    check("g13. histereza: drganie na progu nie produkuje wysylki za wysylka", w["drganie"] == 1)
    check("g14. ...ale prawdziwy powrot i ponowne przekroczenie to DWA epizody",
          w["dwaEpizody"] == 2)
    check("g15. histereza trzyma stan tak samo przy NIE (znak luzu odwrocony)",
          w["drganieNeg"] == 1, str(w["drganieNeg"]))
    check("g16. stare nazwy trybu migruja, zamiast cicho wracac do „Jednorazowo”",
          w["migracja"] == {"cross": "once", "while": "continuous", "nieznane": "once"},
          json.dumps(w["migracja"]))
    check("g17. spis pol warunku jest kompletny",
          w["pola"] == sorted(["source", "cmp", "threshold", "thresholdHi", "abs", "neg",
                               "mode", "dwellMs", "crossings", "windowMs"]), json.dumps(w["pola"]))
    check("g18. lista zrodel w configu i w UI to TA SAMA lista — rozjazd znaczylby zrodlo, "
          "ktorego nie da sie zapisac", w["zrodla"] == w["zrodlaUI"])
    check("g19. gorna granica istnieje TYLKO przy zakresie (tak jak po stronie serwera)",
          w["zakresKasowany"] is None and w["zakresTrzymany"] == 99 and w["progBezZakresu"] == 10,
          json.dumps([w["zakresKasowany"], w["zakresTrzymany"], w["progBezZakresu"]]))

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
