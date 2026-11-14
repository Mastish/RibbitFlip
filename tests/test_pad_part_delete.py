"""Mapowanie przycisku pada da sie usunac tam, gdzie sie je robi (2026-09-08).

Zgloszenie: "w warunkach kontrolera nie ma mozliwosci usuniecia warunku (...) powinno dac
sie kasowac wyzwalacze tak samo jak sie je dodaje". Wiersz w panelu czesci (rf-43 `_padPartRuleRow`)
mial tylko olowek; reguly `pad:` nie stoja na ekranie Mapowanie, wiec kosza nie bylo NIGDZIE.
Sprawdzamy statycznie: kosz w obu wierszach (wlasny i cudzy kapsel), ta sama sciezka co Mapowanie
(ruleDeleteWithUndo = dymek z Cofnij), cudzy = najpierw przelaczenie kapsla. Bez znakow spoza ASCII
w print() - konsola cp1250.
"""
import os
import sys

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
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


def _read(*parts):
    with open(os.path.join(_ROOT, *parts), "r", encoding="utf-8") as f:
        return f.read()


_f43 = _read("web", "js", "rf-43-controller-ui.js")
_f10 = _read("web", "js", "rf-10-triggers-model.js")
_css = _read("web", "css", "14c-controller.css")
_own = _f43.split("function _padPartRuleRow")[1].split("function _padForeignRuleRow")[0]
_for = _f43.split("function _padForeignRuleRow")[1].split("function _padForeignRuleDelete")[0]

print("\n--- kosz obok olowka, w obu wierszach ---")
check("wiersz wlasnego kapsla ma kosz", 'data-a="del"' in _own and "bic-bin" in _own)
check("...i kasuje TA SAMA sciezka, co ekran Mapowanie (dymek z Cofnij)",
      "ruleDeleteWithUndo(r)" in _own and "function ruleDeleteWithUndo" in _f10
      and "Cofnij" in _f10.split("function ruleDeleteWithUndo")[1][:1200])
check("olowek zostal i dalej otwiera edytor", 'data-a="edit"' in _own and "openEditor(r)" in _own)
check("wiersz cudzego kapsla tez ma kosz", 'data-a="del"' in _for and "_padForeignRuleDelete(dev,r)" in _for)
check("...ktory najpierw przelacza na tamten kapsel, jak olowek",
      "function _padForeignRuleDelete(dev,r)" in _f43
      and "switchDevice(dev)" in _f43.split("function _padForeignRuleDelete")[1][:400]
      and "state.activeDeviceId===dev" in _f43.split("function _padForeignRuleDelete")[1][:900])
check("...i nie kasuje z listy poprzedniego kapsla ani nie czeka w nieskonczonosc",
      "(state.rules||[]).some(x=>x.id===r.id)" in _f43 and "Date.now()-t0>4000" in _f43)
check("tytul kosza mowi, ze przelaczy kapsel (jak olowek)",
      "Usuń (przełączy na kapsel " in _for and "Delete (switches to capsule " in _for)
check("przyciski stoja w jednym pojemniku, zeby nie rozjezdzaly wiersza",
      'class="pp-rule-act"' in _own and 'class="pp-rule-act"' in _for and ".pp-rule-act{" in _css)

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
