# Notatka gracza w nakładce (2026-11-21): klawiszologia napisana przez człowieka dla jednego okna.
# Uruchom: py tests/test_overlay_note.py
import os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import ribbitflip_monitor as rf  # noqa: E402

ok = bad = 0
def check(name, cond, detail=""):
    global ok, bad
    if cond: ok += 1; print("PASS  " + name)
    else: bad += 1; print("FAIL  %s   %s" % (name, detail))

d = rf.OVERLAY_WIN_DEFAULTS
check("domyślnie pusta notatka", d.get("note") == "")
check("blok domyślnie wyłączony", d["show"].get("note") is False)
check("blok ma rozmiar i miejsce w kolejności", d["scaleParts"].get("note") == 100 and "note" in rf.OVERLAY_ORDER_KEYS)
c = rf._sanitize_overlay_win({"note": "A: skok\r\nB: kucnij\r\n" + "x" * 120})
check("CRLF zamienione na nowe linie", c["note"].split("\n")[:2] == ["A: skok", "B: kucnij"], repr(c["note"][:30]))
check("linijka przycięta do 80 znaków", all(len(l) <= 80 for l in c["note"].split("\n")))
c = rf._sanitize_overlay_win({"note": "\n".join("l%d" % i for i in range(30))})
check("najwyżej 14 linijek", len(c["note"].split("\n")) == 14)
c = rf._sanitize_overlay_win({"note": None})
check("None to pusta notatka", c["note"] == "")
check("stary plik bez klucza dostaje pustą", rf._sanitize_overlay_win({}).get("note") == "")

js = open(os.path.join(ROOT, "web", "js", "rf-41-overlay.js"), encoding="utf-8").read()
check("rf-41: część „note” i renderer", '{key:"note"' in js and "function ovlNoteHtml" in js)
card = open(os.path.join(ROOT, "web", "js", "rf-11-devices-ui.js"), encoding="utf-8").read()
check("rf-11: karta ma miejsce na notatkę", 'class="ov-note"' in card)
ed = open(os.path.join(ROOT, "web", "js", "rf-41c-overlay-editor.js"), encoding="utf-8").read()
check("rf-41c: pole notatki zapisuje `note`", 'id="ovmNote"' in ed and "{ note:" in ed)
css = open(os.path.join(ROOT, "web", "css", "15-overlay.css"), encoding="utf-8").read()
check("15-overlay: notatka tylko w nakładce", ".ov-note{display:none}" in css and "ovl-no-note .ov-note" in css)
print("\n%d passed, %d failed" % (ok, bad))
sys.exit(1 if bad else 0)
