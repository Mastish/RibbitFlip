"""Ikony filcowe w panelu przez kolorowy font (2026-10-15): tools/ikony_filc_font.py składa
web/assets/fonts/ribbitflip-felt.woff2 (CBDT) z mapy tools/ikony_filc_mapa.json i wpisuje blok @font-face
do css/01-assets-tokens.css. Test pilnuje, żeby mapa, font i CSS się nie rozjechały."""
import io
import json
import os
import re
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WYNIK = {"ok": 0, "zle": 0}


def check(nazwa, warunek, info=""):
    if warunek:
        WYNIK["ok"] += 1
        print("PASS ", nazwa)
    else:
        WYNIK["zle"] += 1
        print("FAIL ", nazwa, "  ", info)


mapa = json.load(open(os.path.join(REPO, "tools", "ikony_filc_mapa.json"), encoding="utf-8"))
ikony = os.path.join(REPO, "web", "assets", "icons")
pliki = {z: os.path.join(ikony, *c.partition("@")[0].split("/")) + (".webp" if c.startswith("gry/") else ".png") for z, c in mapa.items()}
check("mapa: każdy znak wskazuje istniejącą ikonę (%d znaków)" % len(mapa), all(os.path.exists(p) for p in pliki.values()),
      [z for z, p in pliki.items() if not os.path.exists(p)])
check("mapa: same pojedyncze znaki, bez strzałek tekstowych, × i kropek stanu",
      all(len(z) == 1 for z in mapa) and not set(mapa) & set("←→↑↓⬇⬆×●○"), [z for z in mapa if len(z) != 1])

font_p = os.path.join(REPO, "web", "assets", "fonts", "ribbitflip-felt.woff2")
check("font istnieje i ma rozsądny rozmiar (< 400 KB)", os.path.exists(font_p) and os.path.getsize(font_p) < 400 * 1024,
      os.path.getsize(font_p) if os.path.exists(font_p) else None)
try:
    from fontTools.ttLib import TTFont
    f = TTFont(font_p)
    cmap = f.getBestCmap()
    check("font: CBDT/CBLC (kolorowe bitmapy) i każdy znak mapy w cmap",
          "CBDT" in f and "CBLC" in f and all(ord(z) in cmap for z in mapa), [z for z in mapa if ord(z) not in cmap])
    check("font: WOFF2 bez transformacji glyf (z transformacją Chromium odrzuca plik)",
          f.flavor == "woff2" and not [k for k, v in f.reader.tables.items() if getattr(v, "transformed", False)],
          [k for k, v in f.reader.tables.items() if getattr(v, "transformed", False)])
except ImportError:
    print("SKIP  font: brak fontTools")

css = open(os.path.join(REPO, "web", "css", "01-assets-tokens.css"), encoding="utf-8").read()
a, b = css.index("/* FELT-ICON-FONT:START"), css.index("/* FELT-ICON-FONT:END */")
blok, przed = css[a:b], css[:a]
zestawy = set(re.findall(r"@font-face\{font-family:'([^']+)';font-style:([a-z]+);font-weight:([0-9 ]+);", przed))
filc = set(re.findall(r"@font-face\{font-family:'([^']+)';font-style:([a-z]+);font-weight:([0-9 ]+);[^}]*ribbitflip-felt\.woff2", blok))
check("CSS: twarz filcowa dla każdego zestawu deskryptorów rodzin panelu (%d)" % len(zestawy),
      zestawy and zestawy == filc, sorted(zestawy ^ filc))
zakresy = set(re.findall(r"unicode-range:([^}]+)\}", blok))
oczek = ",".join("U+%04X" % ord(z) for z in sorted(mapa, key=ord)) + ",U+FE0F"
check("CSS: unicode-range = znaki z mapy + FE0F (blok aktualny po zmianie mapy)", zakresy == {oczek}, list(zakresy)[:1])

src = open(os.path.join(REPO, "ribbitflip_monitor.py"), encoding="utf-8").read()
check("serwer: .woff2 i .webp na liście typów statycznych", '".woff2": "font/woff2"' in src and '".webp":  "image/webp"' in src)

# Mysz chodzi (10-15): 6 klatek chodu, wczytane w rf-30, rysowane przez _drawMouseWalker we wszystkich podglądach myszy
try:
    from PIL import Image
    kl = [os.path.join(REPO, "web", "assets", "pad", "mysz-chod-%d.png" % i) for i in range(1, 5)]
    check("mysz: 4 klatki chodu (krótkie nóżki) 128×128 z przezroczystością",
          all(os.path.exists(k) and Image.open(k).size == (128, 128) and Image.open(k).mode == "RGBA" for k in kl))
except ImportError:
    print("SKIP  mysz: brak Pillow")
js = lambda n: open(os.path.join(REPO, "web", "js", n), encoding="utf-8").read()
check("mysz: rf-30 wczytuje klatki; podgląd prędkości, szkic i obszar wskazywania rysują chodzącą mysz",
      "mysz-chod-" in js("rf-30-asset-mouse.js") and js("rf-31-mouse-ui.js").count("_drawMouseWalker(ctx,ex,ey") == 2
      and "_drawMouseWalker(ctx" in js("rf-31b-mouse-area.js") and "_drawCursorImg(ctx,_mouseCurImg" not in js("rf-31b-mouse-area.js"))

print("\n%d passed, %d failed" % (WYNIK["ok"], WYNIK["zle"]))
sys.exit(1 if WYNIK["zle"] else 0)
