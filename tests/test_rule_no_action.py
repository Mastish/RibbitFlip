# Reguła Mapowania, która NIC NIE NACISKA. Uruchom: py tests/test_rule_no_action.py
#
# PO CO TAKA REGUŁA W OGÓLE ISTNIEJE. Żeby coś innego mogło się na niej oprzeć: wyzwalacz
# w module „Usługi sieciowe” albo warunek „Wyzwalacz” w innej regule. Dzięki temu odbiorca dostaje
# do dyspozycji PEŁNY słownik Mapowania — przycisk kapsla, nagrany gest, pięć warunków z ORAZ/LUB,
# warstwy — zamiast własnego, uboższego zestawu wyzwalaczy. Silnik przyjmował ją od zawsze (pusty
# `keySpec` daje `sent=False`, a zdarzenie `tf` i tak leci); blokada stała wyłącznie w edytorze.
#
# CZEGO TEN PLIK PILNUJE — czterech rzeczy, z których każda psuje się po cichu:
#
#   1. ROZRÓŻNIENIA „jeszcze nie wybrałem” od „świadomie nic”. Oba mają pusty `keySpec`, więc bez
#      osobnego pola `noAction` są nierozróżnialne — a od tego zależy, czy edytor ma odmówić
#      zapisu. Wartownik w samym `keySpec` odpadł, bo musiałby go znać emiter, klasyfikator
#      bezpieczeństwa importu, opis reguły i parser makr; słowo („none”, „brak”) jest przyjmowane
#      WYŁĄCZNIE na wejściu i natychmiast zamieniane na pustkę + flagę.
#   2. FLAGA JEST SAMOLECZĄCA. Reguła nie ma prawa twierdzić, że nic nie naciska, i naciskać —
#      klawisz albo makro zawsze wygrywa z flagą, więc żadna ścieżka wypełniająca akcję
#      (przechwyt klawisza, punkt na ekranie, nagrany gest, import) nie musi o flagce wiedzieć.
#   3. ZACHOWANIE „PRZYTRZYMAJ” NIE ZALEWA ODBIORCY. `spec_is_holdable` na pustej akcji zwracało
#      fałsz, więc „hold” spadał do gałęzi POWTARZANIA co `intervalMs` (domyślnie 100 ms). Dla
#      reguły, która nic nie naciska, powtarzanie nie ma czego powtórzyć po stronie systemu, ale
#      liczy zadziałania i mieli pętlę dziesięć razy na sekundę — a po drugiej stronie stoi
#      odbiorca. Decyzja: pusta akcja LICZY SIĘ jako „da się trzymać”, i to na SERWERZE, bo
#      `keySpec` pusty wjeżdża też z cudzego zestawu i z ręcznie poprawionego rules.json, gdzie
#      walidacja panelu nie sięga. Powtarzanie zostaje tam, gdzie o nie poproszono — w „Ciągłym”,
#      z własną podłogą odstępu.
#   4. CZŁOWIEK WIDZI, CZYM TO JEST. Nienazwana reguła bez klawisza miała w rubryce akcji gołe
#      „⌨ —”, a w opisie (tym samym, który czyta się PRZED importem cudzego zestawu) — „(brak
#      akcji)”, czyli opis niedokończonej roboty zamiast opisu zamiaru.
#
# Nic tu nie potrzebuje serwera HTTP ani przeglądarki i nic nie dotyka prawdziwego Settings/:
# silnik jest sterowany wprost, a panel czytany jako tekst źródłowy.
import io
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import ribbitflip_monitor as rf  # noqa: E402

# Konsola Windows bez UTF-8 (cp1250) wywraca print() na polskich znakach i emoji — wypisujemy
# z zamianą zamiast padać; liczy się PASS/FAIL, nie glify.
try:
    sys.stdout.reconfigure(errors="replace")
except Exception:
    pass

_passed = 0
_failed = 0


def check(name, cond, detail=""):
    global _passed, _failed
    if cond:
        _passed += 1
        print("PASS  %s" % name)
    else:
        _failed += 1
        print("FAIL  %s%s" % (name, ("   [%s]" % detail) if detail else ""))


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read(*parts):
    with io.open(os.path.join(ROOT, *parts), "r", encoding="utf-8") as f:
        return f.read()


MODEL = read("web", "js", "rf-10-triggers-model.js")
EDITOR = read("web", "js", "rf-12-preview-editor.js")
I18N = read("web", "js", "rf-01-i18n.js")
CFGFP = read("web", "js", "rf-49b-trig-config.js")


class Bus:
    """Szyna zdarzeń, która tylko zapamiętuje — `tf` to jedyny ślad, po którym cokolwiek
    na zewnątrz (panel, dziennik wyzwoleń, odbiorca) poznaje, że reguła zadziałała."""

    def __init__(self):
        self.events = []

    def now(self):
        return 0.0

    def publish(self, ev):
        self.events.append(ev)

    def tf(self, rid):
        return [e for e in self.events if e.get("t") == "tf" and e.get("id") == rid]


class Emitter:
    """Zapisuje, co POSZŁOBY do systemu, i nie naciska niczego."""

    def __init__(self):
        self.taps = []
        self.downs = []
        self.ups = []

    def tap(self, spec):
        self.taps.append(spec)

    def down(self, spec):
        self.downs.append(spec)

    def up(self, spec):
        self.ups.append(spec)


TILT_RULE = {"id": "wyz", "source": {"kind": "filter", "metric": "tilt"},
             "cmp": ">", "threshold": 30}


def run_tilt(r, ticks=30, dt=0.02):
    """Warunek spełniony przez `ticks` taktów silnika, z realnym odstępem — bo gałąź powtarzania
    mierzy czas zegarem, a nie liczbą taktów. Zwraca (stan reguły, szyna, emiter).

    Pozycja przychodzi PRZED KAŻDYM taktem, jak z prawdziwego czujnika. Silnik uznaje pozycję
    starszą niż 0,6 s za brak danych (warunek gaśnie), a 30 × sleep(0,02) na Windowsie, gdzie
    zegar usypiania ma ziarno ~15,6 ms, potrafi trwać 0,6–0,9 s — jedna pozycja na cały przebieg
    dawała więc losowe „over=False” w d5 (zależne od obciążenia maszyny, nie od Settings/)."""
    b, em = Bus(), Emitter()
    t = rf.TriggerEngine(b, emitter=em, armed=True)
    t.set_rules(rf.sanitize_rules([r]))
    t.on_pose({"tilt": 0.0, "twist": 0.0, "pitch": 0.0, "roll": 0.0})
    t.tick()
    for _ in range(ticks):
        t.on_pose({"tilt": 45.0, "twist": 0.0, "pitch": 0.0, "roll": 0.0})
        t.tick()
        time.sleep(dt)
    return t._rt[r["id"]], b, em


def rule(**kw):
    r = dict(TILT_RULE)
    r.update(kw)
    return r


# -- a. serwer: wartownik na wejsciu, flaga w srodku ----------------------------------------
check("a1. spec_is_noaction zna slowa, ktorymi czlowiek i cudzy plik mowia BEZ KLAWISZA",
      all(rf.spec_is_noaction(w) for w in ("none", "NONE", " brak ", "-")))
check("a2. PUSTY zapis to NIE jest wartownik - pusty znaczy JESZCZE NIE WYBRANO",
      not rf.spec_is_noaction("") and not rf.spec_is_noaction(None))
check("a3. zwykly klawisz nie jest brany za wartownika",
      not rf.spec_is_noaction("space") and not rf.spec_is_noaction("pad:a"))

_a = rf.sanitize_rules([rule(keySpec="none")])[0]
check("a4. wartownik NIE zostaje w regule - zamienia sie w pusta akcje",
      _a["keySpec"] == "", repr(_a["keySpec"]))
check("a5. ...i zostawia po sobie zapis intencji (noAction)", _a["noAction"] is True)

_b = rf.sanitize_rules([rule(noAction=True)])[0]
check("a6. sama flaga wystarczy (tak zapisuje edytor)",
      _b["noAction"] is True and _b["keySpec"] == "")

_c = rf.sanitize_rules([rule(keySpec="")])[0]
check("a7. pusta akcja BEZ flagi zostaje JESZCZE NIE WYBRANO, a nie wyzwalaczem",
      _c["noAction"] is False and _c["keySpec"] == "")

# -- b. flaga jest samoleczaca: nie da sie nic nie naciskac i naciskac ----------------------
_d = rf.sanitize_rules([rule(noAction=True, keySpec="right")])[0]
check("b1. prawdziwy klawisz wygrywa z flaga - i NIE ginie po drodze",
      _d["keySpec"] == "right" and _d["noAction"] is False, repr(_d["keySpec"]))
_e = rf.sanitize_rules([rule(noAction=True, sequence="space; 100ms; enter")])[0]
check("b2. makro tez wygrywa z flaga",
      _e["noAction"] is False and _e["sequence"].startswith("space"))
check("b3. rule_no_action odpowiada tak samo jak sanityzator (jedna definicja dla calej apki)",
      rf.rule_no_action(_a) and rf.rule_no_action(_b)
      and not rf.rule_no_action(_c) and not rf.rule_no_action(_d) and not rf.rule_no_action(_e))

# -- c. regula bez akcji przechodzi sanityzator i nie ginie z listy -------------------------
_lst = rf.sanitize_rules([rule(id="r1", noAction=True), rule(id="r2", keySpec="space")])
check("c1. regula bez akcji nie jest odrzucana", len(_lst) == 2, str(len(_lst)))
check("c2. noAction jest polem KAZDEJ reguly (inaczej odcisk konfiguracji porownywalby brak "
      "pola z false i kazdy kapsel bylby ZMIENIONY)",
      all("noAction" in r for r in _lst))
check("c3. regula z klawiszem ma flage falszywa, nie brakujaca", _lst[1]["noAction"] is False)

# -- d. PRZYTRZYMAJ nie zalewa odbiorcy ------------------------------------------------------
check("d1. pusta akcja liczy sie jako DA SIE TRZYMAC (inaczej hold spada do powtarzania)",
      rf.spec_is_holdable("") is True)
check("d2. ...a reszta odpowiedzi tej funkcji sie nie zmienila",
      rf.spec_is_holdable("space") is True
      and rf.spec_is_holdable("mouse:scrollup") is False
      and rf.spec_is_holdable("layer:2") is False
      and rf.spec_is_holdable("layer:hold:2") is True)

_rt_hold, _bus_hold, _em_hold = run_tilt(rule(behavior="hold", noAction=True))
check("d3. przytrzymanie daje DOKLADNIE JEDNO zadzialanie, nie dziesiec na sekunde",
      _rt_hold["fires"] == 1, "fires=%s" % _rt_hold["fires"])
check("d4. ...i dokladnie jedno zdarzenie na zewnatrz", len(_bus_hold.tf("wyz")) == 1,
      str(len(_bus_hold.tf("wyz"))))
check("d5. ...a regula ZOSTAJE aktywna przez caly czas spelnienia warunku (to czyta warunek "
      "Wyzwalacz w innej regule)", _rt_hold["over"] is True)

# Dowod, ze d3 nie jest artefaktem "petla sie nie krecila": ten sam przebieg, ta sama liczba
# taktow, tylko zachowanie Ciagle i prawdziwy klawisz (wiec bez podlogi odstepu). Tyle wlasnie
# zadzialan mial WCZESNIEJ hold bez klawisza - spadal do tej samej galezi powtarzania.
_rt_cont, _bus_cont, _ = run_tilt(rule(behavior="continuous", keySpec="space", intervalMs=10))
check("d6. petla naprawde sie krecila - Ciagle w tym samym przebiegu powtarza kilkadziesiat razy",
      _rt_cont["fires"] > 10, "fires=%s" % _rt_cont["fires"])

# -- e. CIAGLE bez klawisza ma rozsadna podloge odstepu --------------------------------------
check("e1. podloga jest nazwana, a nie wpisana w srodek wyrazenia",
      isinstance(rf.NOACTION_MIN_INTERVAL_MS, int) and rf.NOACTION_MIN_INTERVAL_MS >= 100,
      str(getattr(rf, "NOACTION_MIN_INTERVAL_MS", None)))
_f = rf.sanitize_rules([rule(noAction=True, behavior="continuous", intervalMs=10)])[0]
check("e2. odstep reguly bez klawisza nie schodzi ponizej podlogi",
      _f["intervalMs"] == rf.NOACTION_MIN_INTERVAL_MS, str(_f["intervalMs"]))
_g = rf.sanitize_rules([rule(keySpec="", behavior="continuous", intervalMs=10)])[0]
check("e3. ...liczona z PUSTEJ AKCJI, nie z flagi - cudzy plik bez noAction powtarza tak samo",
      _g["intervalMs"] == rf.NOACTION_MIN_INTERVAL_MS, str(_g["intervalMs"]))
_h = rf.sanitize_rules([rule(keySpec="space", behavior="continuous", intervalMs=10)])[0]
check("e4. regula Z klawiszem zachowuje swoje 10 ms (szybkie powtarzanie w grach)",
      _h["intervalMs"] == 10, str(_h["intervalMs"]))

# -- f. do systemu naprawde nic nie wychodzi -------------------------------------------------
_bus_last = None
for _beh in ("once", "hold", "continuous", "dwell", "latch"):
    _rt, _bus_last, _em = run_tilt(rule(id="cisza", behavior=_beh, noAction=True, dwellMs=50),
                                   ticks=12, dt=0.02)
    check("f. %s bez klawisza: nic nie poszlo do systemu" % _beh,
          not _em.taps and not _em.downs and not _em.ups,
          "taps=%s downs=%s ups=%s" % (_em.taps, _em.downs, _em.ups))
_tf = [e for e in _bus_last.events if e.get("t") == "tf"]
check("f6. ...ale zdarzenie na zewnatrz JEST (bez niego regula bylaby bezuzyteczna)",
      len(_tf) >= 1 and _tf[0].get("sent") is False, str(_tf[:1]))

# -- g. opis dla czlowieka (serwer) ----------------------------------------------------------
_desc = rf._describe_rule(rf.sanitize_rules([rule(noAction=True)])[0])
check("g1. opis mowi wprost BEZ KLAWISZA, a nie (brak akcji)",
      "bez klawisza" in _desc and "brak akcji" not in _desc, _desc)
check("g2. ...i nazywa rzecz po imieniu: to wyzwalacz", "wyzwalacz" in _desc, _desc)
check("g3. pusta akcja BEZ flagi dalej wyglada na niedokonczona robote",
      "(brak akcji)" in rf._describe_rule(rf.sanitize_rules([rule()])[0]))
_cls = rf._classify_rule(rf.sanitize_rules([rule(noAction=True)])[0])
check("g4. podglad bezpieczenstwa importu nie wymienia zadnego klawisza",
      _cls["keys"] == [] and _cls["level"] == "safe", str(_cls))
check("g5. ...i niesie ten sam opis, co lista", "bez klawisza" in _cls["desc"], _cls["desc"])

_eng = rf.TriggerEngine(Bus(), emitter=Emitter(), armed=True)
_nlab = _eng._notify_label(rf.sanitize_rules([rule(noAction=True)])[0])
check("g6. powiadomienie systemowe nie podpisuje sie wewnetrznym identyfikatorem reguly",
      rf._nw("noaction") in _nlab, _nlab)

# -- h. panel: pozycja na liscie akcji -------------------------------------------------------
_qk = re.search(r'const QUICKKEYS=\[(.*?)\n\];', MODEL, re.S)
check("h1. QUICKKEYS dalej jest jedna lista", bool(_qk))
_qk_body = _qk.group(1) if _qk else ""
_opt = re.search(r'\[NOACT_SPEC,"([^"]+)"\]', _qk_body)
check("h2. lista akcji ma jawna pozycje BEZ KLAWISZA", bool(_opt), _qk_body[:120])
NOACT_LABEL = _opt.group(1) if _opt else ""
check("h3. pozycja stoi obok szybkiego wyboru, a nie na koncu listy klawiszy",
      bool(_opt) and _qk_body.index("NOACT_SPEC") < _qk_body.index("media_play_pause"))
check("h4. wartownik panelu i serwera to ten sam napis",
      ('const NOACT_SPEC="%s";' % rf.NOACTION_SPEC) in MODEL, rf.NOACTION_SPEC)
check("h5. podloga odstepu w panelu rowna sie serwerowej (dwie liczby rozjezdzaja sie ciszej "
      "niz jedna)",
      ("const NOACT_MIN_IV=%d;" % rf.NOACTION_MIN_INTERVAL_MS) in MODEL)

# -- i. panel: zapis, etykieta, test ---------------------------------------------------------
check("i1. edytor odmawia zapisu tylko wtedy, gdy akcji NIE WYBRANO - swiadome bez klawisza "
      "przechodzi", "if(!d.keySpec&&!d.noAction)" in EDITOR)
_sel = re.search(r'if\(specIsNoAction\(v\)\)\{([^}]*)\}', EDITOR)
check("i2. wybor z listy zapisuje FLAGE, a token (none) zostaje w panelu",
      bool(_sel) and "d.noAction=true" in _sel.group(1) and 'd.keySpec=""' in _sel.group(1),
      _sel.group(1) if _sel else "brak galezi")
check("i3. wpisany klawisz gasi flage (regula nie moze naciskac i twierdzic, ze nie naciska)",
      "if(d.keySpec)d.noAction=false;" in EDITOR)
check("i4. nowa regula rodzi sie ze stanem JESZCZE NIE WYBRALEM", "noAction:false" in EDITOR)
check("i5. ruleNoAction jest w modelu, wiec licza go wszystkie listy naraz (Mapowanie, "
      "Kontroler, sciaga, opis presetu)", "function ruleNoAction(r)" in MODEL)
check("i6. rubryka akcji nie pokazuje golego mysnika",
      'if(ruleNoAction(r))return "\U0001F517 "+_gl("bez klawisza — wyzwalacz"' in MODEL)
check("i7. przycisk Testuj nie udaje, ze czegos brakuje",
      "ruleNoAction(r))" in EDITOR and "flashTrigMsg(_gl(" in EDITOR)

# -- j. panel: dwujezycznosc i odcisk konfiguracji -------------------------------------------
# Napis bez pary w I18N_EN zostaje po polsku w wersji angielskiej i ZADEN inny test tego nie lapie.
_PL_TEXTS = [NOACT_LABEL] + re.findall(r'class="fld col2 ednoactnote"[^>]*>([^<]+)<', EDITOR)
check("j1. znaleziono napisy, ktore doszly z ta zmiana", len(_PL_TEXTS) >= 4, str(len(_PL_TEXTS)))
for _t in _PL_TEXTS:
    check("j. para EN dla: %s..." % _t[:44], ('"%s":"' % _t) in I18N)
check("j2. noAction wchodzi do odcisku listy wyzwalaczy (bez tego BEZ KLAWISZA i JESZCZE NIE "
      "WYBRANO bylyby dla paska ta sama konfiguracja)",
      '"noAction"' in CFGFP and "TRIG_CFG_FIELDS" in CFGFP)
check("j3. ...jako znormalizowany boolean - presety zapisane przed ta zmiana nie maja tego pola "
      "i nie wolno ich przez to uznac za zmienione",
      'k === "noAction" ? !!o[k] : o[k]' in CFGFP)

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
