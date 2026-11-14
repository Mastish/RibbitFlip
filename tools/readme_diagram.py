# DIAGRAM „JAK TO DZIAŁA" DO README — statyczna wersja diagramu ze strony projektu
# (docs/index.html, sekcja #jak): kapsel → RibbitFlip → moduły, w filcu i ze ściegiem.
#
#   py tools/readme_diagram.py        → docs/assets/jak-to-dziala-pl.png, how-it-works-en.png
#
# Na stronie opis modułu pojawia się po najechaniu; README jest obrazkiem, więc opis stoi przy
# każdym module na stałe. Kolumny „czym możesz sterować" tu nie ma — celowo, to ma być schemat,
# a nie lista programów. Ikonki, kolory linii (.c1–.c8) i fonty są te same co na stronie.
# Rysuje Chrome albo Edge bez okna (skala 2×, przezroczyste rogi). Tylko Windows — narzędzie autora.
import os
import subprocess
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = "file:///" + os.path.join(ROOT, "docs", "assets").replace("\\", "/")
# Pierwsza przeglądarka, która jest na dysku. Chrome przed Edge: Edge bez okna potrafi zakończyć się
# po 0 s bez zrzutu (złapane 2026-09-28 w trakcie jego aktualizacji), Chrome z tymi flagami działa.
EDGE = next((p for p in (r"C:\Program Files\Google\Chrome\Application\chrome.exe",
                         r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe") if os.path.exists(p)),
            r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe")

# ikonka, kolor linii, (tytuł, opis) PL, (tytuł, opis) EN
MODULY = [
    ("keyboard", "#ec1a83", ("Klawiatura i mysz", "przechył albo klik naciska klawisz lub klika"),
     ("Keyboard & mouse", "a tilt or a click presses a key or clicks")),
    ("radialmenu", "#8a52d9", ("Koło wyboru", "do 16 akcji pod jednym ruchem kapsla"),
     ("Selection wheel", "up to 16 actions under one capsule move")),
    ("celownik", "#1f93c9", ("Skaner ekranu", "cały komputer obsłużony jednym sygnałem"),
     ("Screen scanner", "the whole computer with a single signal")),
    ("controller", "#eaa32b", ("Gamepad", "kapsel udaje pad Xbox, DualShock albo Wii"),
     ("Gamepad", "the capsule acts as an Xbox, DualShock or Wii pad")),
    ("midi", "#6cb33f", ("MIDI", "nuty i pokrętła w programie muzycznym"),
     ("MIDI", "notes and knobs in your music software")),
    ("osc", "#a6d861", ("OSC", "wizualizacje, światła, VRChat, Arduino"),
     ("OSC", "visuals, lighting, VRChat, Arduino")),
    ("rest", "#d83a5c", ("Usługi sieciowe", "Discord, Home Assistant, OBS Studio…"),
     ("Network services", "Discord, Home Assistant, OBS Studio…")),
    ("synth", "#2f9e57", ("Syntezator", "kapsel gra w przeglądarce jak instrument"),
     ("Synth", "the capsule plays in the browser like an instrument")),
    # Gra dołączona do projektu (diagram „Jak to działa” pokazuje też RibbitBeat);
    # dziewiąty wiersz zmieścił się w tej samej wysokości obrazka przez węższe karty (KH 62 → 56, GAP 12 → 9).
    ("ribbitbeat", "#1fb3a3", ("RibbitBeat", "dołączona gra rytmiczna: wypróbuj kapsel od razu"),
     ("RibbitBeat", "a bundled rhythm game: try the capsule right away")),
]
TEKSTY = {
    "pl": dict(plik="jak-to-dziala-pl.png", kapsel="kapsel Triki", panel="panel w Twojej przeglądarce",
               kolumna="co może robić kapsel", stop="Alt + R + F zatrzymuje wszystko naraz"),
    "en": dict(plik="how-it-works-en.png", kapsel="Triki capsule", panel="a panel in your browser",
               kolumna="what the capsule can do", stop="Alt + R + F stops everything at once"),
}

W, KX, KW, KH, GAP, TOP = 1100, 620, 440, 56, 9, 64           # płótno i kolumna modułów (9 kart na 714 px)
RFX, RFW, RFH = 258, 232, 112                                  # łatka RibbitFlip
DOL = 74                                                       # pod ostatnią kartą: miejsce na linię „Alt + R + F"


def html(jez):
    t = TEKSTY[jez]
    h = TOP + len(MODULY) * (KH + GAP) - GAP + DOL
    cy = TOP + (len(MODULY) * (KH + GAP) - GAP) / 2
    x0 = RFX + RFW
    linie, karty = [], []
    for i, (ikona, kolor, pl, en) in enumerate(MODULY):
        tytul, opis = pl if jez == "pl" else en
        y = TOP + i * (KH + GAP)
        yc = y + KH / 2
        mx = (x0 + KX) / 2
        linie.append('<path d="M%d %.1f C%.1f %.1f %.1f %.1f %d %.1f" stroke="%s"/>' % (x0, cy, mx, cy, mx, yc, KX, yc, kolor))
        karty.append('<div class="karta" style="top:%dpx"><img src="%s/icons/%s.png"><div><b>%s</b><span>%s</span></div></div>'
                     % (y, A, ikona, tytul, opis))
    return """<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:'Baloo 2';font-weight:500 800;src:url(%(A)s/fonts/baloo2-latin.woff2) format('woff2');unicode-range:U+0000-00FF,U+2000-206F}
@font-face{font-family:'Baloo 2';font-weight:500 800;src:url(%(A)s/fonts/baloo2-latin-ext.woff2) format('woff2');unicode-range:U+0100-02BA}
@font-face{font-family:'Nunito';font-weight:400 800;src:url(%(A)s/fonts/nunito-latin.woff2) format('woff2');unicode-range:U+0000-00FF,U+2000-206F}
@font-face{font-family:'Nunito';font-weight:400 800;src:url(%(A)s/fonts/nunito-latin-ext.woff2) format('woff2');unicode-range:U+0100-02BA}
@font-face{font-family:'JetBrains Mono';font-weight:400 700;src:url(%(A)s/fonts/jetbrains-mono-latin.woff2) format('woff2');unicode-range:U+0000-00FF,U+2000-206F}
@font-face{font-family:'JetBrains Mono';font-weight:400 700;src:url(%(A)s/fonts/jetbrains-mono-latin-ext.woff2) format('woff2');unicode-range:U+0100-02BA}
html,body{margin:0;background:transparent}
.plotno{position:relative;width:%(W)dpx;height:%(H)dpx;margin:6px 8px 14px;border-radius:22px;
  background:#efe9dd;background-image:linear-gradient(rgba(239,233,221,.55),rgba(239,233,221,.55)),url(%(A)s/felt.png);
  box-shadow:0 6px 0 rgba(0,0,0,.22);font-family:Nunito,sans-serif;color:#211f1d}
.plotno::after{content:"";position:absolute;inset:7px;border-radius:16px;border:2px dashed #cdbf9f;pointer-events:none}
svg{position:absolute;inset:0}
.lnk{fill:none;stroke-width:3.5;stroke-linecap:round;stroke-dasharray:7 7}
.wv{fill:none;stroke:#ec1a83;stroke-width:5;stroke-linecap:round;opacity:.4}
.latka{position:absolute;border-radius:14px;background:#faf6ee;
  background-image:linear-gradient(rgba(255,255,255,.55),rgba(255,255,255,.55)),url(%(A)s/felt.png);box-shadow:0 4px 0 rgba(0,0,0,.14)}
.latka::after{content:"";position:absolute;inset:4px;border-radius:10px;border:1.5px dashed #d8cdb8}
.karta{position:absolute;left:%(KX)dpx;width:%(KW)dpx;height:%(KH)dpx;display:flex;align-items:center;gap:13px;padding:0 16px;box-sizing:border-box;
  border-radius:14px;background:#faf6ee;background-image:linear-gradient(rgba(255,255,255,.55),rgba(255,255,255,.55)),url(%(A)s/felt.png);box-shadow:0 4px 0 rgba(0,0,0,.14)}
.karta::after{content:"";position:absolute;inset:4px;border-radius:10px;border:1.5px dashed #d8cdb8}
.karta img{width:38px;height:38px;flex:none}
.karta b{display:block;font-family:'Baloo 2';font-weight:700;font-size:18px;line-height:1.1}
.karta span{display:block;font-size:13.5px;color:#524c3e;line-height:1.25;margin-top:2px}
.rf{left:%(RFX)dpx;top:%(RFY)dpx;width:%(RFW)dpx;height:%(RFH)dpx;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px}
.rf .znak{display:flex;align-items:center;gap:8px;font-family:'Baloo 2';font-weight:800;font-size:30px;line-height:1}
.rf .znak img{width:42px;height:42px}
.rf .znak i{font-style:normal;color:#ec1a83}
.mono{font-family:'JetBrains Mono',monospace;font-size:12px;color:#524c3e}
.kapsel{position:absolute;left:44px;top:%(KAPY)dpx;width:150px;text-align:center}
.kapsel img{width:118px;height:118px;display:block;margin:0 auto 8px;filter:drop-shadow(0 4px 3px rgba(0,0,0,.25))}
.kapsel b{display:block;font-family:'Baloo 2';font-weight:700;font-size:19px;line-height:1.1}
.kol{position:absolute;left:%(KX)dpx;top:30px;width:%(KW)dpx;text-align:center}
.stop{position:absolute;left:0;right:0;bottom:24px;text-align:center}
.stop b{font-family:'JetBrains Mono';font-weight:700;color:#211f1d}
</style>
<div class="plotno">
  <svg width="%(W)d" height="%(H)d">
    <path class="wv" d="M205 %(W1a)s Q222 %(CY)s 205 %(W1b)s"/>
    <path class="wv" d="M222 %(W2a)s Q246 %(CY)s 222 %(W2b)s"/>
    <g class="lnk">%(LINIE)s</g>
  </svg>
  <div class="kapsel"><img src="%(A)s/icons/cap.png"><b>%(KAPSEL)s</b><span class="mono">BLE</span></div>
  <div class="latka rf"><div class="znak"><img src="%(A)s/icons/logo.png"><span>Ribbit<i>Flip</i></span></div><div class="mono">%(PANEL)s</div></div>
  <div class="kol mono">%(KOLUMNA)s</div>
  %(KARTY)s
  <div class="stop mono">⏻ <b>%(STOP)s</b></div>
</div>""" % dict(A=A, W=W, H=h, KX=KX, KW=KW, KH=KH, RFX=RFX, RFW=RFW, RFH=RFH, RFY=cy - RFH / 2,
                 KAPY=cy - 80, CY="%.1f" % cy, W1a="%.1f" % (cy - 34), W1b="%.1f" % (cy + 34),
                 W2a="%.1f" % (cy - 52), W2b="%.1f" % (cy + 52), LINIE="".join(linie), KARTY="".join(karty),
                 KAPSEL=t["kapsel"], PANEL=t["panel"], KOLUMNA=t["kolumna"], STOP=t["stop"])


def main():
    from PIL import Image
    with tempfile.TemporaryDirectory() as profil:
        for jez, t in TEKSTY.items():
            strona = os.path.join(profil, "d.html")
            with open(strona, "w", encoding="utf-8") as f:
                f.write(html(jez))
            cel = os.path.join(ROOT, "docs", "assets", t["plik"])
            for _ in range(3):   # Edge bez okna bywa kapryśny: raz na kilka uruchomień nie zapisuje zrzutu
                subprocess.run([EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files",
                                "--default-background-color=00000000", "--force-device-scale-factor=2",
                                "--window-size=1140,800", "--user-data-dir=" + profil,
                                "--screenshot=" + cel, "file:///" + strona.replace("\\", "/")],
                               capture_output=True, timeout=90)
                if os.path.exists(cel):
                    break
            im = Image.open(cel).convert("RGBA")
            # przycinamy po kanale alfa (prawie przezroczyste piksele tła nie liczą się jako treść),
            # a zapisujemy z paletą 256 kolorów: filc to kilka odcieni beżu, a plik chudnie ~5×
            l, tp, r, b = im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
            im = im.crop((max(0, l - 2), max(0, tp - 2), r + 2, b + 2))
            im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG).save(cel, optimize=True)
            print("  %s (%dx%d)" % (t["plik"], im.width, im.height))


if __name__ == "__main__":
    main()
