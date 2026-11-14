# PRZYCISKI W NAGŁÓWKU README — filcowe łatki jak na stronie projektu (docs/index.html, .btn).
#
#   py tools/readme_buttons.py        → docs/assets/buttons/*.png
#
# GitHub wycina z README style CSS i nie wczytuje fontów w SVG, więc przycisk to obrazek w linku.
# Rysuje go przeglądarka (Edge bez okna) tym samym CSS-em co strona projektu: tekstura filcu,
# kreskowany ścieg 4 px od krawędzi, twardy cień, font Baloo 2 i filcowa ikonka z docs/assets.
# Tło przezroczyste, skala 2× (ostre na ekranach HiDPI), potem PIL przycina do treści.
# Tylko Windows (Chrome albo Edge) — to narzędzie autora, nie część aplikacji.
import os
import subprocess
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "assets", "buttons")
ASSETS = "file:///" + os.path.join(ROOT, "docs", "assets").replace("\\", "/")
# Pierwsza przeglądarka, która jest na dysku. Chrome przed Edge: Edge bez okna potrafi zakończyć się
# po 0 s bez zrzutu (złapane 2026-09-28 w trakcie jego aktualizacji), Chrome z tymi flagami działa.
EDGE = next((p for p in (r"C:\Program Files\Google\Chrome\Application\chrome.exe",
                         r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe") if os.path.exists(p)),
            r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe")

# plik, napis, rodzaj (klasa CSS), ikonka (względem docs/assets)
BUTTONS = [
    ("pobierz", "Pobierz .exe", "pri", "../../assets/ribbitflip_head.png"),
    ("download", "Download .exe", "pri", "../../assets/ribbitflip_head.png"),
    ("strona", "Strona projektu", "", "icons/planet.png"),
    ("project-page", "Project page", "", "icons/planet.png"),
    ("discord", "Discord", "", "icons/discord.png"),
    ("polski-aktywny", "Polski", "sm on", ""),
    ("polski", "Polski", "sm", ""),
    ("english-aktywny", "English", "sm on", ""),
    ("english", "English", "sm", ""),
]

CSS = """
@font-face{font-family:'Baloo 2';font-weight:500 800;src:url(%(a)s/fonts/baloo2-latin.woff2) format('woff2');unicode-range:U+0000-00FF,U+2000-206F}
@font-face{font-family:'Baloo 2';font-weight:500 800;src:url(%(a)s/fonts/baloo2-latin-ext.woff2) format('woff2');unicode-range:U+0100-02BA}
:root{--felt-tex:url(%(a)s/felt.png);--felt-ink:#211f1d;--pink-btn:#d81678;--pink-d:#a4105c;
  --felt-tex-soft:linear-gradient(rgba(255,255,255,.52),rgba(255,255,255,.52)),var(--felt-tex)}
html,body{margin:0;background:transparent}
body{padding:6px 8px 12px}
.btn{position:relative;display:inline-flex;align-items:center;gap:9px;border-radius:12px;white-space:nowrap;
  background:#f4efe4;background-image:var(--felt-tex-soft);color:var(--felt-ink);
  padding:9px 18px 9px 16px;font-family:'Baloo 2',sans-serif;font-weight:700;font-size:17px;line-height:1.25;
  box-shadow:0 4px 0 rgba(0,0,0,.28)}
.btn::after{content:"";position:absolute;inset:4px;border-radius:8px;border:1.5px dashed var(--rf-stitch,#bcab8d)}
.btn img{width:26px;height:26px;margin:-3px 0}
.btn.pri{background:var(--pink-btn);background-image:var(--felt-tex);color:#fff;box-shadow:0 4px 0 var(--pink-d);--rf-stitch:rgba(255,255,255,.5)}
.btn.sm{padding:6px 14px;font-size:15px}
.btn.on{background:#2b2825;background-image:linear-gradient(rgba(33,31,29,.55),rgba(33,31,29,.55)),var(--felt-tex);
  color:#fff8ec;box-shadow:0 4px 0 #000;--rf-stitch:rgba(255,248,236,.45)}
"""


def render(tekst, klasa, ikona, cel, profil):
    img = '<img src="%s/%s">' % (ASSETS, ikona) if ikona else ""
    html = '<!doctype html><meta charset="utf-8"><style>%s</style><span class="btn %s">%s%s</span>' % (
        CSS % {"a": ASSETS}, klasa, img, tekst)
    strona = os.path.join(profil, "b.html")
    with open(strona, "w", encoding="utf-8") as f:
        f.write(html)
    subprocess.run([EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files",
                    "--default-background-color=00000000", "--force-device-scale-factor=2",
                    "--virtual-time-budget=4000", "--window-size=420,90", "--user-data-dir=" + profil,
                    "--screenshot=" + cel, "file:///" + strona.replace("\\", "/")],
                   capture_output=True, timeout=90)
    from PIL import Image
    im = Image.open(cel).convert("RGBA")
    l, t, r, b = im.getbbox()
    im.crop((max(0, l - 2), max(0, t - 2), r + 2, b + 2)).save(cel, optimize=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    with tempfile.TemporaryDirectory() as profil:
        for plik, tekst, klasa, ikona in BUTTONS:
            render(tekst, klasa, ikona, os.path.join(OUT, plik + ".png"), profil)
            print("  " + plik + ".png")
    print("%d przycisków -> %s" % (len(BUTTONS), os.path.relpath(OUT, ROOT)))


if __name__ == "__main__":
    main()
