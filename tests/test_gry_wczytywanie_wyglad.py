# -*- coding: utf-8 -*-
"""RIBBITBEAT: WYGLĄD PANELI WCZYTYWANIA (2026-11-19).

Ekran wczytywania aplikacji (index.html) i zasłona utworu (zabi-chor.js: pokazZasloneUtworu) mają wygląd sceny:
ciemny filc ze ściegiem, girlanda bujanych lamp z menu, promienie za żabą, korektor i pasek jak naszywka. Mają też
zostać LEKKIE, bo pod nimi trwa ciężka praca: tło to gradienty CSS, pliki są dwa (żaba i jeden plik z trzema kolorami
lampy), a rusza się wyłącznie transform i krycie
(kompozytor), więc animacja nie zależy od zajętego wątku JS. Test pilnuje tej lekkości i tego, żeby oba panele
miały tę samą budowę.

Statycznie, bez przeglądarki.

Uruchomienie: py tests/test_gry_wczytywanie_wyglad.py
"""
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GRY = os.path.join(ROOT, "web", "gry")

passed = failed = 0


def ok(cond, msg):
    global passed, failed
    if cond:
        passed += 1
    else:
        failed += 1
        print("FAIL  %s" % msg)


def czytaj(*czesci):
    return io.open(os.path.join(GRY, *czesci), encoding="utf-8").read()


html = czytaj("index.html")
styl = re.search(r"<style>\s*html\.wczytuje\{.*?</style>", html, re.S)
ok(styl is not None, "index.html ma własny blok stylu ekranu wczytywania (działa przed gry.css)")
styl = styl.group(0) if styl else ""
css = czytaj("gry.css")
a = css.find("/* Zasłona wczytywania utworu")
utwor = css[a:css.find(".toast{", a)] if a >= 0 else ""
ok(bool(utwor), "gry.css ma blok zasłony utworu")

# lekkość: pliki są dwa (żaba i lampy girlandy), reszta to gradienty
ok(re.findall(r"url\(", styl + utwor) == [], "panele wczytywania nie ładują żadnych plików z CSS (same gradienty)")
panel = re.search(r'<div id="wczytywanie".*?\n</div>', html, re.S)
panel = panel.group(0) if panel else ""
ok(set(re.findall(r'src="([^"]+)"', panel)) == {"../assets/frog/mascot-beat.webp", "../assets/koncert/lampki-wczytywanie.webp"},
   "ekran wczytywania ładuje tylko żabę i jeden plik lamp")
ok(os.path.getsize(os.path.join(ROOT, "web", "assets", "koncert", "lampki-wczytywanie.webp")) < 40000, "plik lamp girlandy jest mały (< 40 kB)")

# girlanda: 12 lamp w trzech kolorach na kablu, bujanie i poświata w CSS; zasłona utworu bierze jej kopię
ok(len(re.findall(r'class="wcz-lampa k[012]"', panel)) == 12 and all('class="wcz-lampa k%d"' % k in panel for k in range(3)), "girlanda ma 12 lamp w trzech kolorach")
ok('class="wcz-kabel"' in panel and "::after" not in styl, "lampy wiszą na kablu (bez dawnej girlandy z gradientów w ::after)")
ok("animation:wczBuja" in styl and "wczSwiatlo" in styl, "lampy bujają się i świecą")
ok(".wcz-lampa,.wcz-lampa>i{animation:none}" in styl.replace(".wcz-pasek>i::before,", ""), "ograniczony ruch zatrzymuje też lampy")

# lekkość: klatki kluczowe ruszają wyłącznie transform i opacity
klatki = re.findall(r"@keyframes\s+(wcz\w+)\{((?:[^{}]*\{[^{}]*\})+)\}", styl + utwor)
ok(len(klatki) >= 5, "panele mają swoje animacje (%d)" % len(klatki))
for nazwa, cialo in klatki:
    wlasciwosci = set(re.findall(r"([a-z-]+)\s*:", " ".join(re.findall(r"\{([^{}]*)\}", cialo))))
    wlasciwosci.discard("animation-timing-function")   # krzywa odcinka, nie animowana właściwość
    ok(wlasciwosci <= {"transform", "opacity"}, "@keyframes %s rusza tylko transform i krycie (jest: %s)" % (nazwa, ", ".join(sorted(wlasciwosci))))
ok("filter" not in styl and "backdrop" not in styl and "box-shadow" not in styl, "ekran wczytywania bez filtrów, rozmyć i cieni (drogie przy animacji)")
ok("opacity:.999" in styl, "zasłona ma krycie .999 (menu pod nią rasteryzuje się w trakcie wczytywania)")
ok("prefers-reduced-motion:reduce" in styl, "ograniczony ruch wyłącza animacje ekranu wczytywania")

# żaba pulsuje w rytm muzyki (jak naklejka w menu), nie skacze; tempo to zmienna --wt, zasłona utworu bierze je z piosenki
ok("animation:wczPuls calc(var(--wt) * 4)" in styl and "wczSkok" not in styl, "żaba pulsuje taktami muzyki menu (wczPuls), skoku nie ma")
ok("--wt:.46875s" in styl, "ćwierćnuta ekranu wczytywania = 128 BPM (utwór menu)")
ok("calc(var(--wt) * 3)" in styl, "błyski lamp idą tą samą ćwierćnutą co puls żaby")
ok(".wcz-utwor .wcz-zaba,.wcz-utwor .wcz-cien{animation-name:wczPulsTakt;animation-duration:var(--wt)}" in utwor, "zasłona utworu pulsuje co ćwierćnutę piosenki")
ok("a.startTime=0" in czytaj("js", "wczytywanie.js"), "puls startuje od zera osi czasu strony (ta sama faza co zegar menu)")

# pasek: przesunięcie, nie rozciąganie (paski zostają równe), w obu panelach
ok('"translateX("' in czytaj("js", "wczytywanie.js") and "scaleX(" not in czytaj("js", "wczytywanie.js"), "pasek ekranu wczytywania przesuwa się przez translateX")
gra = czytaj("js", "zabi-chor.js")
f = re.search(r"function postepZaslony\(f\)\{(.*?)\n\}", gra, re.S)
ok(f is not None and '"translateX("' in f.group(1), "pasek zasłony utworu przesuwa się przez translateX")

# ta sama budowa obu paneli
for klasa in ("wcz-scena", "wcz-promienie", "wcz-zaba", "wcz-cien", "wcz-rytm", "wcz-pasek"):
    ok('class="%s"' % klasa in panel, "ekran wczytywania ma .%s" % klasa)
p = re.search(r"function pokazZasloneUtworu\(p\)\{(.*?)\n\}", gra, re.S)
cialo = p.group(1) if p else ""
ok("Wczytywanie.girlanda()" in cialo and "girlanda," in czytaj("js", "wczytywanie.js"), "zasłona utworu ma kopię girlandy z ekranu wczytywania")
for klasa in ("wcz-scena", "wcz-promienie", "wcz-zaba", "wcz-cien", "wcz-rytm", "wcz-pasek", "wcz-pod", "wcz-tytul", "wcz-meta"):
    ok('"%s"' % klasa in cialo, "zasłona utworu ma .%s" % klasa)
rytm = re.search(r'<div class="wcz-rytm">(.*?)</div>', panel)
ok(rytm is not None and rytm.group(1).count("<i></i>") == 9 and "i<9" in cialo, "korektor ma po 9 słupków w obu panelach")

print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
