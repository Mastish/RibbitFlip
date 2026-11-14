# -*- coding: utf-8 -*-
"""RIBBITBEAT: WYGLĄD KROKU „1 PIOSENKA” (2026-11-19).

Krok wyboru utworu wygląda jak gra, a nie jak aplikacja: filcowa scena z menu w tle, utwory jako naszywki
z grzbietem trudności, wybrany utwór jako duża etykieta, plakat z pieczątką, ściąga sterowania i „Dalej” na krawędzi
sceny. Całość to osobny arkusz gry-piosenka.css, który tylko przebiera istniejącą budowę strony.

Test pilnuje trzech rzeczy: arkusz jest podpięty i nie rusza panelu „Wgraj własny”, ruch zostaje lekki (bez
animowania wysokości i układu), a kapsel dalej ma czego się trzymać (ściąga w plakietkach, trzymany przechył
nie wypada z listy).

Statycznie, bez przeglądarki.

Uruchomienie: py tests/test_gry_piosenka_wyglad.py
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
css = czytaj("gry-piosenka.css")
js = czytaj("js", "zabi-chor.js")
scena = czytaj("js", "lobby-scena.js")
bez_komentarzy = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
reguly = [r.strip() for r in re.findall(r"([^{}]+)\{[^{}]*\}", bez_komentarzy)]

ok('<link rel="stylesheet" href="gry-piosenka.css">' in html, "index.html ładuje gry-piosenka.css")
ok(html.index("gry-piosenka.css") > html.index('href="gry.css"'), "arkusz kroku Piosenka stoi po gry.css (ma wygrać kolejnością)")

# zasięg: tylko krok 1 w widoku listy; panel „Wgraj własny” i inne ekrany zostają po staremu
poza = [r for r in reguly if not r.startswith("@") and not re.match(r"^(from|to|[\d.]+%)", r)
        and "#wybor" not in r and '.lobby:is([data-ekran="wybor"],[data-ekran="konfiguracja"])' not in r]
ok(not poza, "każda reguła siedzi pod #wybor albo pod tłem kroków Zagraj: %s" % poza[:3])
tlo = [r for r in reguly if r.startswith('.lobby:is(')]
ok(len(tlo) == 2, "krok Rozgrywka dostaje od tego arkusza samo tło i rampę, nic z układu: %s" % tlo)
bez_widoku = [r for r in reguly if "#wybor" in r and "#wybor:not(.wgraj)" not in r and "#wybor.wgraj" not in r
              and ".lista-podpowiedz" not in r]
ok(not bez_widoku, "każda reguła mówi, którego widoku dotyczy (lista albo „Wgraj własny”): %s" % bez_widoku[:3])

# scena z menu, ta sama grafika (już wczytana przez zasoby menu), ścieżka względna
ok("url(../assets/koncert/scena.webp)" in css, "tło kroku to scena z menu głównego")
ok("/web/assets/" not in css, "ścieżki względne, nie /web/assets/")
ok("koncert/scena.webp" in czytaj("js", "zasoby-menu.js"), "grafika sceny jest na liście zasobów menu (bez dodatkowego pobierania)")
ok("--rampa" in css and "/ .818" in css, "podłoga sceny jest dopasowana do rampy (81,8% wysokości grafiki)")

# lekkość: rusza się tylko translate / scale / rotate / opacity
przejscia = re.findall(r"transition:([^;}]+)", bez_komentarzy)
ok(przejscia and all(not re.search(r"\b(height|width|margin|padding|top|left|all)\b", p) for p in przejscia),
   "przejścia nie animują układu: %s" % przejscia)
ok("@keyframes piosWejscie{from{opacity:0}}" in css, "wejście naszywki to samo krycie")
ok(".bkarta[hidden]{display:none!important}" in css, "wiersz odfiltrowany szukaniem znika bez animowania wysokości")
ok(not re.search(r"(?<![-\w])transform\s*:\s*(?!none)", bez_komentarzy),
   "osobne translate / scale / rotate zamiast transform (nie gryzą się z najazdem i wciśnięciem)")
ok("filter:blur" not in css and "backdrop-filter" not in css, "bez rozmycia")

# trzy stopnie bliskości wybranego + stan bez wybranego
ok(css.count(":has(+ .bkarta") >= 3, "naszywki nad wybranym maleją stopniami (:has)")
ok(":not(:has(>.bkarta.wybrana))>.bkarta" in css, "lista bez wybranego utworu nie jest przygaszona")
ok(":has(.szuk.aktywna)" in css, "lista przefiltrowana szukaniem nie jest przygaszona")

# kapsel
ok('className="podp"' in js and 'createElement("kbd")' in js, "ściąga sterowania składa się z plakietek gestów")
ok(re.search(r'wybranaPodpowiedzKapsel:"Przód i tył: [^"]*Naciśnij: [^"]*Przytrzymaj: ', js), "ściąga kapsla to pary „gest: skutek”")
ok("powt:true" in js and "o&&o.powt" in js, "trzymany przechył nie wypada z listy do „Dalej”")
ok("scroll-margin-block" in css, "wybrany wiersz trzyma odstęp od krawędzi listy")
ok("kWgraj" not in css and "animation:none" not in bez_komentarzy.split("piosWejscie")[0],
   "zaproszenie na „Wgraj własny” (poświata, błysk, plus) nie jest wyłączone")

# pieczątka trudności: skala i słowo poziomu w osobnych spanach, pięć poziomów w kolorze
ok('className="staty-skala"' in scena and 'className="staty-poziom"' in scena, "suma trudności ma osobne spany skali i poziomu")
for poziom in ("srednia", "trudna", "bardzoTrudna", "ekstremalna"):
    ok('data-poziom="%s"' % poziom in css, "pieczątka ma kolor poziomu %s" % poziom)

# koło utworów: skala naszywki zależy od miejsca na liście, liczy ją kompozytor (animacja spięta z przewijaniem)
ok("@supports (animation-timeline:view())" in css and "animation-timeline:view(block)" in css,
   "koło utworów to animacja spięta z przewijaniem, z zapasowym wyglądem dla przeglądarki bez niej")
kolo = css[css.index("@keyframes piosKolo{"):css.index("@keyframes piosKoloWybrana{")]
ok(set(re.findall(r"([a-z-]+):", kolo)) <= {"opacity", "scale", "translate"}, "koło rusza tylko kryciem, skalą i przesunięciem")
# wybrany zawsze na środku: cel przewinięcia liczy JS z układu (wysrodkujNaLiscie), arkusz dostaje wysokość listy w --kh
ok("function wysrodkujNaLiscie" in js and "offsetTop" in js[js.index("function wysrodkujNaLiscie"):js.index("function listaKola")]
   and 'setProperty("--kh"' in js and "var(--kh) * .5" in css, "wybrany utwór stoi na środku listy (cel z układu, wysokość listy w --kh)")
ok(not re.search(r"\{[^}]*container-type:size", css) and not re.search(r"\dcqh", css),
   "koło nie używa jednostek kontenera (z nimi każdy krok koła przeliczał styl całej biblioteki)")
zapas = css[css.index("@supports not (animation-timeline:view()){"):css.index("#wybor:not(.wgraj) .biblio-lista>.bkarta:is(:hover,:focus-within,.gra){opacity:1}")]
ok(":has(+ .bkarta.wybrana)" in zapas and ":has(+ .bkarta.wybrana)" not in css.replace(zapas, ""),
   "reguły „sąsiad wybranego” z :has() są tylko zapasem dla przeglądarki bez view timeline")
# zapadki: etykieta wskakuje od razu, piosenkę (plakat po prawej) zatwierdza się, gdy koło stanie
ok("function wskazNaKole" in js and "function zatwierdzKolo" in js and "ZATWIERDZ_MS" in js, "koło ma zapadki: wskazanie od razu, zatwierdzenie piosenki po zatrzymaniu")
ok("if(kolKandydatId)zatwierdzKolo();" in js[js.index("function pokazLobby(nazwa){"):js.index("function pokazLobby(nazwa){") + 400],
   "zmiana ekranu zatwierdza utwór wskazany na kole")
ok("wskazNaKole(k,true)" in io.open(os.path.join(GRY, "js", "lobby-scena.js"), encoding="utf-8").read(), "fokus wiersza wskazuje go na kole (zamiast od razu przebudowywać plakat)")
ok("idNaKole()" in io.open(os.path.join(GRY, "js", "biblioteka.js"), encoding="utf-8").read(), "duża etykieta to utwór wskazany na kole, także przed zatwierdzeniem")
ok('addEventListener("wheel",kolkoNaKole,{passive:false})' in js, "kółko myszy idzie po zapadkach (jeden ząbek = jeden wiersz)")
ok("scrollbar-width:none" in css and ".biblio-lista::-webkit-scrollbar{display:none}" in css, "lista nie pokazuje paska przewijania")
# ramka fokusu na całej etykiecie, nie na samym przycisku z tytułem
ok(".bkarta-wybor:is(:focus,:focus-visible){outline:none}" in css and ".bkarta.wybrana:has(.bkarta-wybor:focus-visible)" in css,
   "ramka fokusu obejmuje całą etykietę wybranego (z grzbietem), przycisk w środku jej nie rysuje")
ok(".bkarta.wybrana{animation:piosKoloWybrana" in css, "wybrana etykieta przesuwa się razem z sąsiadkami (nie nachodzi na nie)")

# mniej szumu na naszywce: bez miniatury i bez „Wybierz”, w opisie sam czas i partie
ok(":is(.bkarta-rolkabox,.bkarta-wybierz){display:none}" in css, "naszywka nie ma miniatury rolki ani przycisku „Wybierz”")
ok('dataset.krotko=tt("biblioMetaKrotko"' in czytaj("js", "biblioteka.js") and ".bkarta-meta[data-krotko]::after" in css,
   "opis naszywki to sam czas i liczba partii")

# pasek liter: span (nie button), tylko przy sortowaniu alfabetycznym, odświeżany raz na klatkę
ok("function odswiezIndeksListy" in js and 'h("span","",c)' in js and ".lista-indeks>span.tu" in css, "pasek liter przy liście istnieje i podświetla bieżącą literę")
# koło liter: duża litera na wysokości środka listy (obok wybranego), sąsiednie maleją z odległością
ok("function pozycjaLitery" in js and "s.dataset.d=" in js and 'setProperty("--p"' in js and '.lista-indeks>span[data-d="1"]' in css
   and "translate:0 calc(var(--p,0) * var(--krok))" in css, "koło liter: duża litera obok wybranego, mniejsze nad nią i pod nią")
ok("box.style.height=" in js, "koło liter ma wysokość listy, więc duża litera stoi na jej środku")
ok('tryb==="alfabet"||stopnie' in js and 'stopnie=tryb==="trudnosc"' in js
   and "requestAnimationFrame" in js[js.index("function zaplanujIndeksListy"):js.index("function odswiezIndeksListy")],
   "koło liter działa przy sortowaniu alfabetycznym (litery) i po trudności (stopnie), raz na klatkę")

# sortowanie od najłatwiejszych (2026-11-19)
bib = czytaj("js", "biblioteka.js")
ok('"trudnosc"' in bib[bib.index("SORTOWANIA:["):bib.index("SORTOWANIA:[") + 90] and 'tryb==="trudnosc"' in bib and "sort_trudnosc:" in js
   and "sort_trudnosc:" in czytaj("js", "jezyk-en.js"), "jest sortowanie „Od najłatwiejszych” (PL i EN)")
# ścieżki w wyborze partii: kropki w kolorach partii i pulsowanie w kroku 1
ok('h("span","pp-sciezki")' in bib and 'classList.toggle("wiele"' in bib and ".pp-sciezki>i.tu" in czytaj("gry.css"),
   "przycisk wyboru partii pokazuje ścieżki utworu kropkami, bieżąca wyróżniona")
ok("@keyframes ppZaproszenie" in css and "@keyframes ppSciezka" in css and '.pp-wybor-przycisk.wiele[aria-expanded="true"]::after' in css,
   "wybór partii pulsuje, dopóki lista partii nie jest rozwinięta")
pulsy = "".join(css[css.index("@keyframes " + n + "{"):css.index("}}", css.index("@keyframes " + n + "{"))] for n in ("ppZaproszenie", "ppSciezka", "ppSciezkaTu"))
ok(set(re.findall(r"([a-z-]+):", pulsy)) <= {"opacity", "scale"}, "pulsowanie rusza tylko kryciem i skalą")
# instrument żaby w podglądzie
ok("function ppZmienInstrument" in bib and 'ustaw("glos",v)' in bib and "ppInstrument:" in js and "ppInstrument:" in czytaj("js", "jezyk-en.js")
   and "#wybor:not(.wgraj) .pp-instr{display:inline-flex" in css and ".pp-instr{display:none}" in czytaj("gry.css"),
   "podgląd ma przełącznik instrumentu żaby (tylko w kroku 1)")
# silnik MIDI (2026-11-19): zestawy brzmień podkładu, przełącznik w podglądzie i lista w ustawieniach kroku 2
glos = czytaj("js", "glos.js")
silniki = re.search(r"const ZC_SILNIKI_MIDI=\{(.*?)\};", js, re.S).group(1)
barwy = set(re.findall(r'(?:bas|srodek|gora):"([a-z]+)"', silniki))
stare = {"epiano", "organ", "guitar", "flute", "strings", "marimba", "musicbox", "chip", "synth"}
ok(len(barwy) >= 12 and all(("case '%s':" % b) in glos for b in barwy - {"piano"}), "każda barwa zestawów silnika MIDI ma swoją recepturę w voice(): %s" % sorted(barwy - stare))
ok("jeden:null" in silniki and 'silnikMidi:"jeden"' in js, "domyślny silnik to „Jeden instrument”, czyli brzmienie jak dotąd")
nazwy_pl = re.search(r"silnikiMidi:\{(.*?)\}", js).group(1)
nazwy_en = re.search(r"silnikiMidi:\{(.*?)\}", czytaj("js", "jezyk-en.js")).group(1)
klucze = set(re.findall(r"(\w+):(?:null|\{)", silniki)) - {"ciszej"}
ok(klucze == set(re.findall(r"(\w+):\"", nazwy_pl)) == set(re.findall(r"(\w+):\"", nazwy_en)), "każdy silnik MIDI ma nazwę po polsku i po angielsku: %s" % sorted(klucze))
ok("barwaPodkladu(instr,n.m,pr)" in js and "barwaPodkladu(S.ust.instrument,n.m,n.p)" in bib and "poziomPodkladu(" in bib,
   "gra i podgląd biorą barwę nuty podkładu z silnika MIDI (z instrumentem nuty z pliku)")
# „Jak w pliku”: parser zapamiętuje instrument ścieżki i perkusję, gra tłumaczy General MIDI na swoje barwy
pios = czytaj("js", "piosenki.js")
ok("ty===0xC0){const pg=" in pios and "prog:progOf(ti,+ch)" in pios and "perk:perkGry" in pios and "program:t.prog==null?null:t.prog" in pios,
   "parser MIDI zapamiętuje instrument ścieżki (program change) i uderzenia perkusji z kanału 10")
ok("function perkusjaPiosenki" in pios and "function fragmentPerkusji" in pios and "partie,tlo,perkusja," in pios and "program:programSc(s)" in pios,
   "piosenka niesie instrument każdej partii i listę uderzeń perkusji (także przy fragmencie)")
ok("plik:{plik:true}" in silniki and "function barwaGM" in js and 'if(s.plik)return program==null?instr:barwaGM(program);' in js,
   "silnik „Jak w pliku” gra instrumentem z pliku, a bez tej informacji zwykłym instrumentem podkładu")
ok("silnikGraPerkusje()?(p.perkusja||[]):[]" in js and "Glos.bebny(n.typ,za(n.t),ZC_PERKUSJA_POZIOM" in js and "hd.bebny(n.typ" in bib
   and "bebny(typ,za,poziom){if(zywy)bebny(typ,za,poziom,szyna);}" in glos, "perkusja z pliku gra w grze i w podglądzie (na szynie podglądu, żeby „Stop” ją uciszał)")
for skrypt in ("tests/gry_zabi_chor_harness.mjs", "tests/ribbitbeat_konwerter_harness.mjs", "tools/ribbitbeat_kalibracja.mjs", "tools/ribbitbeat_pomoce.mjs"):
    t = io.open(os.path.join(ROOT, *skrypt.split("/")), encoding="utf-8").read()
    ok('"perkusjaPiosenki"' in t and '"ZC_GM_PERKUSJA"' in t, "%s zna funkcje perkusji (wycina piosenki.js po nazwach)" % skrypt)
ok('{k:"silnikMidi",grupa:"dzwiek",typ:"lista"' in js and '"silnikMidi"' in czytaj("js", "konta.js") and "function ppZmienSilnik" in bib,
   "silnik MIDI zmienia się w podglądzie kroku 1 i na liście ustawień kroku 2, zapisuje się z kontem")
# plakat bez przewijania: rolka oddaje miejsce, pusta tablica się nie przewija
ok(".pp-rolkabox{flex:0 1 clamp(60px" in css and ".wybrana-tablica:has(.wybrana-top-pusto){flex:none;overflow:visible}" in css,
   "na plakacie kurczy się rolka podglądu, a nie tablica pod nią")
# zakres trudności „od–do” przy kilku partiach
ok("function zakresTrudnosci" in js and "dataset.zakres=" in bib and ".trudnosc[data-zakres]::after{content:attr(data-zakres)" in css
   and 'h("span","wybrana-zakres"' in js, "utwór z kilkoma partiami pokazuje zakres trudności na grzbiecie i na plakacie")
# strzałki zmiany partii po bokach przycisku wyboru (bez rozwijania listy)
ok('h("button","pp-wybor-strz","‹")' in bib and "wybor.append(wybL,wyborPrz,wybP)" in bib and ".pp-wybor-strz{" in czytaj("gry.css")
   and "ppPartiaPoprzednia:" in js and "ppPartiaPoprzednia:" in czytaj("js", "jezyk-en.js"), "przy wyborze partii są strzałki poprzednia / następna (PL i EN)")
# przyciski pod rolką nie skaczą: stały wiersz brzmienia, stała szerokość przycisku odtwarzania i licznika taktów
ok('.pp-dol::after{content:"";order:5;flex:0 0 100%' in css and ".pp-dol .pp-instr{order:10;display:flex;flex:1 1 0;min-width:0}" in css
   and ".pp-dol .pp-graj{min-width:11em" in css and ".pp-dol .pp-info{order:12;flex:none" in css,
   "instrument żaby i silnik MIDI mają własny stały wiersz, długa nazwa nie przepycha sąsiadów")
# lilie wodne w paskach trudności: gotowa filcowa grafika z pada efektów Syntha, nie rysunek z kodu
ok(".staty-pasek i{background:url(../assets/pad/lilypad.png) center/contain no-repeat" in css
   and os.path.isfile(os.path.join(ROOT, "web", "assets", "pad", "lilypad.png")), "paski trudności to lilie wodne z assets/pad/lilypad.png")

# „Wgraj własny”: półka z okładkami, wrzutnia, wiele plików i cały folder
pak = czytaj("js", "pakiety.js")
en = czytaj("js", "jezyk-en.js")
ok("#wybor.wgraj .pk-karta::after" in css and "#wybor.wgraj .pk-plik-ikona" in css, "paczki są okładkami z płytą, własny plik kasetą")
ok("opis.dataset.utwory" in pak and "b.dataset.krotko" in pak, "okładka ma dużą liczbę utworów i krótki napis pobierania")
ok("fol.webkitdirectory=true" in pak and "wczytajPliki(pliki,{folder:true})" in pak, "wrzutnia ma wybór całego folderu")
ok("async function wczytajPliki" in js and "async function plikiMidiZWpisow" in js and "webkitGetAsEntry" in js,
   "wiele plików naraz i upuszczony folder idą jedną drogą z bilansem na końcu")
for klucz in ("plikFolder", "folderBezMidi", "importByly", "importZle", "pakPobierzKrotko"):
    ok(klucz + ":" in js and klucz + ":" in en, "napis %s jest po polsku i po angielsku" % klucz)

print("%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
