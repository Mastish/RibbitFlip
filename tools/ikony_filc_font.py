# KOLOROWY FONT Z IKON FILCOWYCH (2026-10-15). Panel ma w napisach ok. 1 300 glifów w roli ikon (⏸ ▶ ⚙ 🎮 ⚠ …),
# często w kluczach słownika PL→EN (rf-01-i18n.js), więc podmiana na <span> psułaby tłumaczenia i porównania tekstu.
# Zamiast tego ten skrypt składa font CBDT/CBLC (kolorowe bitmapy, jak emoji Google), w którym każdy znak z mapy
# rysuje się jako ikona filcowa, a css/01-assets-tokens.css dopina go do rodzin panelu z unicode-range tylko na te
# znaki (blok między znacznikami FELT-ICON-FONT). Tekst, słownik i logika zostają bez zmian.
# Mapa: tools/ikony_filc_mapa.json {"⏸": "pauza", "▾": "rozwin@90", "▶": "gry/graj"}: plik z web/assets/icons
# (PNG; „gry/…” = WebP gry), opcjonalnie obrót w stopniach. Celowo POZA mapą: strzałki w tekście (← → ⬇ ⬆), × (znak
# mnożenia), ● ○ (kropki stanu barwione kolorem CSS), symbole DS4 i treści użytkownika.
# Użycie: py -I tools/ikony_filc_font.py   (zapisuje web/assets/fonts/ribbitflip-felt.woff2 i blok CSS)
import io, json, os, sys
from PIL import Image
from fontTools.fontBuilder import FontBuilder
from fontTools.ttLib import newTable
from fontTools.ttLib.tables import C_B_D_T_, BitmapGlyphMetrics
from fontTools.ttLib.tables.E_B_L_C_ import BitmapSizeTable, SbitLineMetrics, Strike, eblc_index_sub_table_1
from fontTools.pens.ttGlyphPen import TTGlyphPen

UPEM, PPEM, PX = 2048, 61, 72        # strike 61 ppem, obraz 72 px (proporcje Noto Color Emoji 109/128); ostre do ok. 36 px tekstu
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IKONY = os.path.join(REPO, "web", "assets", "icons")
WYJ = os.path.join(REPO, "web", "assets", "fonts", "ribbitflip-felt.woff2")
CSS = os.path.join(REPO, "web", "css", "01-assets-tokens.css")
RODZINY = ("Baloo 2", "Nunito", "JetBrains Mono", "Titan One")
ZR = json.load(open(os.path.join(REPO, "tools", "ikony_filc_mapa.json"), encoding="utf-8"))
mapa = {}
for znak, cel in ZR.items():
    if znak.startswith("_"): continue
    nazwa, _, obrot = cel.partition("@")
    p = os.path.join(IKONY, *nazwa.split("/")) + (".webp" if nazwa.startswith("gry/") else ".png")
    if not os.path.exists(p): sys.exit("brak pliku ikony: " + p)
    mapa[znak] = (p, int(obrot or 0))
znaki = sorted(mapa, key=lambda c: ord(c[0]))
glyphs = [".notdef", "vs16"] + ["ik%04X" % ord(c[0]) for c in znaki]
cmap = {0xFE0F: "vs16"}
for c in znaki: cmap[ord(c[0])] = "ik%04X" % ord(c[0])
adv = int(UPEM * PX / PPEM)   # szerokość = wysokość obrazu w jednostkach
fb = FontBuilder(UPEM, isTTF=True)
fb.setupGlyphOrder(glyphs)
fb.setupCharacterMap(cmap)
pusty = TTGlyphPen(None).glyph()
fb.setupGlyf({g: pusty for g in glyphs})
asc, desc = int(UPEM * .95), int(UPEM * .25)
fb.setupHorizontalMetrics({g: (0 if g == "vs16" else adv, 0) for g in glyphs})
fb.setupHorizontalHeader(ascent=asc, descent=-desc)
fb.setupNameTable({"familyName": "RibbitFlip Felt Icons", "styleName": "Regular"})
fb.setupOS2(sTypoAscender=asc, sTypoDescender=-desc, usWinAscent=asc, usWinDescent=desc)
fb.setupPost()
font = fb.font
# CBDT: format 17 (małe metryki + PNG), jeden strike; przeglądarka skaluje go do rozmiaru tekstu
cbdt = newTable("CBDT"); cbdt.version = 3.0; strike = {}
for c in znaki:
    g = "ik%04X" % ord(c[0])
    p, obrot = mapa[c]
    im = Image.open(p).convert("RGBA")
    if obrot: im = im.rotate(-obrot, expand=True)   # ▾ i ▴ = szewron ▸ obrócony
    bb = im.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox()
    if bb: im = im.crop(bb)
    w = int(PX * .90); im.thumbnail((w, w), Image.LANCZOS)   # 5 % marginesu z każdej strony, jak emoji
    kw = Image.new("RGBA", (PX, PX), (0, 0, 0, 0)); kw.alpha_composite(im, ((PX - im.width) // 2, (PX - im.height) // 2))
    buf = io.BytesIO(); kw.quantize(256, method=Image.Quantize.FASTOCTREE).save(buf, "PNG", optimize=True)   # PNG8 z alfą: ok. 3× mniej
    m = BitmapGlyphMetrics.SmallGlyphMetrics()
    m.height, m.width, m.BearingX, m.BearingY, m.Advance = PX, PX, 0, int(PX * .80), PX
    b = C_B_D_T_.cbdt_bitmap_format_17(b"", font); b.metrics = m; b.imageData = buf.getvalue()
    strike[g] = b
cbdt.strikeData = [strike]
cblc = newTable("CBLC"); cblc.version = 3.0
st = BitmapSizeTable()
for n in ("hori", "vert"):
    lm = SbitLineMetrics(); lm.ascender, lm.descender, lm.widthMax = int(PX * .80), -int(PX * .20), PX
    for k in ("caretSlopeNumerator", "caretSlopeDenominator", "caretOffset", "minOriginSB", "minAdvanceSB", "maxBeforeBL", "minAfterBL", "pad1", "pad2"): setattr(lm, k, 0)
    lm.caretSlopeNumerator = 0 if n == "vert" else 1
    setattr(st, n, lm)
st.colorRef = 0; st.ppemX = st.ppemY = PPEM; st.bitDepth = 32; st.flags = 1
gl = ["ik%04X" % ord(c[0]) for c in znaki]
st.startGlyphIndex = font.getGlyphID(gl[0]); st.endGlyphIndex = font.getGlyphID(gl[-1])
sub = eblc_index_sub_table_1(b"", font); sub.indexFormat = 1; sub.imageFormat = 17
sub.names = gl; sub.firstGlyphIndex = st.startGlyphIndex; sub.lastGlyphIndex = st.endGlyphIndex
st.indexSubTables = [sub]
s = Strike(); s.bitmapSizeTable = st; s.indexSubTables = [sub]; cblc.strikes = [s]
font["CBDT"] = cbdt; font["CBLC"] = cblc
# WOFF2 BEZ transformacji glyf/loca: domyślna transformacja pustych konturów daje plik, który Chromium odrzuca
# (font się nie ładuje, zostają systemowe emoji); sam TTF i WOFF2 bez transformacji działają.
from fontTools.ttLib import woff2
buf = io.BytesIO(); font.save(buf); buf.seek(0)
woff2.compress(buf, WYJ, transform_tables=set())
zakres = ",".join("U+%04X" % ord(c[0]) for c in znaki) + ",U+FE0F"   # FE0F (wariant emoji) = pusty znak bez szerokości
NL = chr(10)
css = open(CSS, encoding="utf-8").read()
# Twarz dla KAŻDEGO zestawu deskryptorów, który panel już deklaruje (rodzina, styl, waga): przeglądarka składa twarze
# po unicode-range tylko w obrębie tych samych deskryptorów; jedna twarz „100 900” obok „500 800” przegrywała dopasowanie.
import re
przed = css[:css.index("/* FELT-ICON-FONT:START")]
zestawy = sorted(set(re.findall(r"@font-face\{font-family:'([^']+)';font-style:([a-z]+);font-weight:([0-9 ]+);", przed)))
blok = "".join("@font-face{font-family:'%s';font-style:%s;font-weight:%s;font-display:block;"
               "src:url(/web/assets/fonts/ribbitflip-felt.woff2) format('woff2');unicode-range:%s}" % (r, st_, w, zakres) + NL
               for r, st_, w in zestawy if r in RODZINY)
a, b = "/* FELT-ICON-FONT:START", "/* FELT-ICON-FONT:END */"
i, j = css.index(a), css.index(b)
css = css[:css.index("*/", i) + 2] + NL + blok + css[j:]
open(CSS, "w", encoding="utf-8", newline=NL).write(css)
print("font:", os.path.relpath(WYJ, REPO), len(znaki), "znaków,", os.path.getsize(WYJ) // 1024, "KB; blok CSS:", blok.count("@font-face"), "twarzy")
