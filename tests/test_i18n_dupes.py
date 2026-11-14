# HIGIENA SŁOWNIKA I18N: zdublowane klucze. Uruchom: py tests/test_i18n_dupes.py
#
# `I18N_EN` w web/js/rf-01-i18n.js to jeden literał obiektu z ~2300 parami PL→EN. Literał obiektu
# w JS przyjmuje ten sam klucz dwa razy bez słowa — wygrywa OSTATNI. Dlatego „Sposób" przez długi
# czas brzmiał „Way", choć pierwsza (i zamierzona) para mówiła „How", a rfModal pokazywał „Remove"
# na przycisku, który w Mapowaniu i Bibliotekach znaczy „Delete". Nikt tego nie widzi w kodzie:
# obie pary wyglądają na poprawne, a różnicę widać dopiero w przeglądarce i tylko w EN.
#
# Ten plik czyta literał JAKO TEKST (nie ewaluuje go — ewaluacja zgubiłaby duplikaty), wycina
# komentarze i zbiera klucze z numerami linii. Twarda asercja: 0 kluczy z RÓŻNĄ wartością EN.
# Duplikaty z identyczną wartością też są błędem (plan 2.5: 0 duplikatów) — nieszkodliwe dla panelu,
# ale każda para to miejsce, w którym ktoś kiedyś poprawi jedno z dwóch brzmień i dostanie kolizję.
#
# Druga warstwa: słowniki modułowe RF_*_I18N (rf-39b, rf-41, rf-44, rf-49k…) są scalane do
# globalnego I18N_EN przez Object.assign, więc para „Usuń":"Remove" w słowniku nakładki przykrywała
# WSZYSTKIE przyciski „Usuń" panelu, a „Wielkość":"Size" z nakładki podpisywała metrykę MIDI. Tu:
# ŻADEN słownik modułowy nie może przykrywać klucza rf-01 inną wartością (twarda asercja, 0 kolizji).
# Gdy jedno polskie słowo ma dwa znaczenia, moduł podaje EN jawnie przez _gl(pl,en) albo — w statycznym
# szablonie — atrybutem data-i18n-en na elemencie (walker rf-01 honoruje go w obie strony).
#
# Nic tu nie potrzebuje serwera ani przeglądarki.
import io
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JS_DIR = os.path.join(ROOT, "web", "js")
I18N = os.path.join(JS_DIR, "rf-01-i18n.js")

# Konsola Windows bez UTF-8 (cp1250) wywraca print() na znakach spoza strony kodowej (klucze
# z emoji, „⚙"); wypisujemy z zamianą zamiast padać — liczy się PASS/FAIL, nie glify.
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
        print("FAIL  %s%s" % (name, ("  -- " + str(detail)[:400]) if detail else ""))


def read(p):
    with io.open(p, "r", encoding="utf-8") as f:
        return f.read()


def strip_comments(src):
    """Usuwa komentarze // i /* */ POZA literałami napisowymi (cudzysłów, apostrof, backtick);
    zachowuje znaki nowej linii, żeby numery linii się zgadzały."""
    out = []
    i, n = 0, len(src)
    while i < n:
        c = src[i]
        if c in ('"', "'", "`"):
            q = c
            out.append(c)
            i += 1
            while i < n and src[i] != q:
                if src[i] == "\\" and i + 1 < n:
                    out.append(src[i:i + 2])
                    i += 2
                    continue
                out.append(src[i])
                i += 1
            if i < n:
                out.append(q)
                i += 1
            continue
        if src.startswith("//", i):
            while i < n and src[i] != "\n":
                i += 1
            continue
        if src.startswith("/*", i):
            j = src.find("*/", i + 2)
            j = n if j < 0 else j + 2
            out.append("\n" * src.count("\n", i, j))
            i = j
            continue
        out.append(c)
        i += 1
    return "".join(out)


PAIR_RE = re.compile(r'"((?:[^"\\]|\\.)*)"\s*:\s*(?:"((?:[^"\\]|\\.)*)")?')


def literal_pairs(src, start_re, end_re=r"^\};?\s*$"):
    """Pary (klucz, wartość|None, linia) z literału obiektu zaczynającego się w linii pasującej
    do start_re i kończącego pierwszą linią pasującą do end_re."""
    lines = src.split("\n")
    start = next((i for i, l in enumerate(lines) if re.search(start_re, l)), None)
    if start is None:
        return None
    end = next((i for i in range(start + 1, len(lines)) if re.match(end_re, lines[i])), len(lines))
    body = "\n".join(lines[start + 1:end])
    clean = strip_comments(body)
    pairs = []
    for m in PAIR_RE.finditer(clean):
        line = start + 2 + clean.count("\n", 0, m.start())
        pairs.append((m.group(1), m.group(2), line))
    return pairs


src = read(I18N)
pairs = literal_pairs(src, r"^const I18N_EN=\{")
check("rf-01: literał I18N_EN znaleziony i ma > 2000 par", pairs is not None and len(pairs) > 2000,
      None if pairs is None else len(pairs))
pairs = pairs or []

first = {}
conflicts = []
same = []
for k, v, line in pairs:
    if k in first:
        v0, l0 = first[k]
        (conflicts if v0 != v else same).append((k, l0, v0, line, v))
    else:
        first[k] = (v, line)

for k, l0, v0, l1, v1 in conflicts:
    print("  DUP %r  L%d: %r  <->  L%d: %r" % (k, l0, v0, l1, v1))
check("rf-01: 0 zdublowanych kluczy I18N_EN z RÓŻNĄ wartością EN (ostatni wygrywa po cichu)",
      len(conflicts) == 0, "%d kolizji: %s" % (len(conflicts), ", ".join(repr(c[0]) for c in conflicts[:12])))
for k, l0, v0, l1, v1 in same:
    print("  SAME %r  L%d and L%d: %r" % (k, l0, l1, v0))
check("rf-01: 0 zdublowanych kluczy I18N_EN z identyczną wartością (plan 2.5: 0 duplikatów)",
      len(same) == 0, "%d: %s" % (len(same), ", ".join(repr(c[0]) for c in same[:40])))

# Zwycięzcy rozstrzygnięć (efektywna wartość = ostatnia w literale, tak jak widzi to JS).
effective = {}
for k, v, line in pairs:
    effective[k] = v
for k, want in [("Sposób", "How"), ("Usuń", "Delete"), ("Przycisk kapsla", "Capsule button"),
                ("Martwa strefa", "Dead zone"), ("Klawisz dla kierunku GÓRA", "Key for UP"),
                ("Klawisz dla kierunku DÓŁ", "Key for DOWN"), ("Klawisz dla kierunku LEWO", "Key for LEFT"),
                ("Klawisz dla kierunku PRAWO", "Key for RIGHT"), ("Kroki oddziel", "Separate steps with a"),
                ("Wyślij testowy komunikat teraz — bez ruszania kapslem", "Send a test message now — without moving the capsule"),
                ("Przester", "Overdrive")]:
    check("rf-01: %r -> %r" % (k, want), effective.get(k) == want, effective.get(k))

# Pary dodane w tej samej iteracji (2.1 notka o touchpadzie, 2.3 placeholder, 2.4 panel „Kapsle").
for k, want in [("Pochylenie kapsla = miejsce na panelu.", "The capsule's tilt = a spot on the touchpad."),
                ("panelu, nie palec.", "of the pad, not the finger."),
                ("dla programu/gry", "for the program/game"),
                ("Kapsle", "Capsules"),
                ("kliknij kapsel, żeby ustawić jego osie", "click a capsule to set its axes"),
                ("✎ Edytujesz:", "✎ Editing:")]:
    check("rf-01: %r -> %r" % (k, want), effective.get(k) == want, effective.get(k))

# „Przester" jako parametr efektu (nie brzmienie) idzie przez _gl w rf-19; „Usuń" = „Remove" tam,
# gdzie coś tylko schodzi z listy, podawane jawnie.
rf19 = read(os.path.join(JS_DIR, "rf-19-pad-model2.js"))
check('rf-19: etykieta parametru „Przester" składana przez _gl("Przester","Drive") (2×: FX_PARAMS i PAD_Y_TARGETS)',
      rf19.count('_gl("Przester","Drive")') == 2, rf19.count('_gl("Przester","Drive")'))
check('rf-19: FX_PARAMS.drive nie jest stałym napisem „Przester"', 'drive:"Przester"' not in rf19)
rf11 = read(os.path.join(JS_DIR, "rf-11-devices-ui.js"))
check('rf-11: okno „Usunąć kapsel?" podaje confirmLabel:_gl("Usuń","Remove") (2×)',
      rf11.count('confirmLabel:_gl("Usuń","Remove")') == 2, rf11.count('confirmLabel:_gl("Usuń","Remove")'))

# Warstwa 2: słowniki modułowe scalane do I18N_EN (Object.assign) — kolizje z rf-01.
overrides = []
for fn in sorted(os.listdir(JS_DIR)):
    if not (fn.startswith("rf-") and fn.endswith(".js")) or fn == "rf-01-i18n.js":
        continue
    fsrc = read(os.path.join(JS_DIR, fn))
    for m in re.finditer(r"^\s*const (RF_[A-Z0-9_]*I18N[A-Z0-9_]*)\s*=\s*\{", fsrc, re.M):
        mp = literal_pairs(fsrc, r"^\s*const %s\s*=\s*\{" % re.escape(m.group(1)), r"^\s*\}\s*[;)]?\s*$")
        for k, v, line in (mp or []):
            if k in effective and effective[k] != v:
                overrides.append((fn, m.group(1), k, v, effective[k], line))
usun = [o for o in overrides if o[2] == "Usuń"]
check('słowniki modułowe: żaden nie przykrywa „Usuń" inną wartością (był „Remove" w rf-41 i rf-44)',
      not usun, "; ".join("%s:%d %r" % (o[0], o[5], o[3]) for o in usun))
for fn, name, k, v, v0, line in overrides[:40]:
    print("  OVERRIDE %s:%d %s %r -> %r (rf-01: %r)" % (fn, line, name, k, v, v0))
check("słowniki modułowe: 0 kluczy rf-01 przykrytych inną wartością (Object.assign do I18N_EN — ostatni wygrywa dla CAŁEGO panelu)",
      not overrides, "%d: %s" % (len(overrides), ", ".join("%s %r" % (o[0], o[2]) for o in overrides[:8])))
# Rozstrzygnięcia tej rundy: rf-01 przejął brzmienie rodziny konfiguracji („Save the changes", „changed",
# „Save the preset"); „Wielkość" = „Metric" (lista metryk MIDI/OSC: Tilt/Rotation/Pitch/Roll — jak „Metryka"
# w edytorze wyzwalaczy; „Quantity" czytało się jak liczba), a nakładka mówi „Size" atrybutem;
# „Tonika" = „Root note" (to, co panel pokazywał, gdy słownik rf-49k jeszcze przykrywał rf-01).
for k, want in [("Wielkość", "Metric"), ("Tonika", "Root note"), ("zmienione", "changed"), ("Zapisz zmiany", "Save the changes"),
                ("Zapisz preset", "Save the preset"), ("8. Koło wyboru", "8. The selection wheel"),
                ("Tak wygląda Twój wątek po opublikowaniu.", "This is what your thread looks like once published.")]:
    check("rf-01: %r -> %r" % (k, want), effective.get(k) == want, effective.get(k))
for fn in ["rf-41-overlay.js", "rf-41c-overlay-editor.js"]:
    check('%s: „Wielkość" nakładki podpisane data-i18n-en="Size" (nie parą w słowniku)' % fn,
          'data-i18n-en="Size">Wielkość<' in read(os.path.join(JS_DIR, fn)))
check('rf-01: walker honoruje data-i18n-en na rodzicu węzła', "getAttribute('data-i18n-en')" in src)
# Synth: przełączenie języka bez przeładowania przerysowuje pady (padRelang z setLang; bez padSave)
rf24 = read(os.path.join(JS_DIR, "rf-24-gate-ui.js"))
check("rf-24: padRelang() woła renderPlayPads + renderFxPads bez padSave()",
      "function padRelang(){" in rf24 and "padSave" not in rf24.split("function padRelang(){", 1)[1].split("}\n", 1)[0].replace("\r", ""))
check("rf-01: setLang woła padRelang()", 'if(typeof padRelang==="function")padRelang();' in src)

# ---------------------------------------------------------------------------
#  Martwe klucze (2.7): pary, których polski tekst nie występuje NIGDZIE poza słownikiem — ani w
#  HTML/JS panelu, ani w monitor.py (serwer też składa zdania, które walker tłumaczy), ani w testach.
#  Zdjęte z rf-01; tu pilnujemy, żeby nie wróciły i żeby korpus nadal ich nie potrzebował
#  (gdyby ktoś przywrócił napis w DOM, brak pary = polski węzeł w EN — walk-harness go policzy).
# ---------------------------------------------------------------------------
print("\n--- martwe klucze (2.7) ----------------------------------------------")
DEAD = ["Zakres OSC (min–max)", "Wszystkie mapowania (podgląd)", "Kontroler MIDI / OSC", "Czyj kapsel edytujesz?",
        "Wielkość okienka", "Zestawy startowe", "Presety wyzwalaczy:", "▶ Włącz mysz", "▶ Włącz gałkę",
        "▶ Włącz krzyżak", "⏹ Wyłącz", "Wybierz, czym steruje ruch kapsla", "Ruch kapsla → kursor Windows",
        "Wyjdź z pełnego ekranu (Esc)", "Schodkowa (4 progi)", "Zestaw konfiguracji (setup)", "Skokowe przejścia",
        "Usuń wybrany zestaw z biblioteki"]
corpus = []
for dp, dn, fns in os.walk(os.path.join(ROOT, "web")):
    for fn in fns:
        if fn != "rf-01-i18n.js" and re.search(r"\.(js|html|css)$", fn):
            corpus.append(read(os.path.join(dp, fn)))
corpus.append(read(os.path.join(ROOT, "ribbitflip_monitor.py")))
for fn in os.listdir(os.path.join(ROOT, "tests")):
    # ux_walk_harness.cjs powtarza tę listę (sprawdza to samo w przeglądarce) — to nie jest użycie
    if fn not in (os.path.basename(__file__), "ux_walk_harness.cjs") and re.search(r"\.(py|mjs|cjs|js)$", fn):
        corpus.append(read(os.path.join(ROOT, "tests", fn)))
corpus = "\n".join(corpus)
back = [k for k in DEAD if k in effective]
check("rf-01: %d martwych kluczy nie wróciło do I18N_EN" % len(DEAD), not back, back)
alive = [k for k in DEAD if k in corpus]
check("web/ + monitor.py + tests/: żaden ze zdjętych napisów nie jest już w użyciu (grep -F = 0)", not alive, alive)
# żywi sąsiedzi, których 2.7 miało NIE ruszać
for k in ["Schodkowa", "⊓⊓ Skokowe", "▶ Włącz", "Kontroler MIDI", "Usuń"]:
    check("rf-01: sąsiad %r został" % k, k in effective, "brak")

# ---------------------------------------------------------------------------
#  Harnessy node (bez serwera i przeglądarki, rf-01 w `vm`):
#   - i18n_server_errors_harness.mjs — każde polskie zdanie błędu z monitor.py ma klucz/wzorzec (2.6),
#   - i18n_spelling_harness.mjs — pisownia brytyjska i „capsule” (nie puck/cap) po stronie EN (2.8, 2.9).
#  Wynik = ostatnia linia JSON {checks:[…]}, liczony tutaj, żeby podsumowanie było jedno.
# ---------------------------------------------------------------------------
for hn in ["i18n_server_errors_harness.mjs", "i18n_spelling_harness.mjs"]:
    print("\n--- %s ------------------------------------------------" % hn)
    harness = os.path.join(ROOT, "tests", hn)
    try:
        p = subprocess.run(["node", harness], capture_output=True, text=True, encoding="utf-8", timeout=120)
        lines = (p.stdout or "").strip().splitlines()
        out = json.loads(lines[-1]) if lines else None
    except (OSError, ValueError, IndexError, subprocess.SubprocessError) as e:  # noqa: BLE001
        p, out = None, None
        print("POMINIETO  %s (Node): %s" % (hn, e))
    if out is None and p is not None:
        check("%s wystartował" % hn, False, (p.stderr or p.stdout or "")[-400:])
    for nm, ok_, detail in (out or {}).get("checks", []):
        check(nm, ok_, detail)

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
