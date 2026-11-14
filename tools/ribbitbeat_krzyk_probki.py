# Próbki instrumentu „Krzyk” z prawdziwych nagrań (RibbitBeat, 10-19): paczka „Aargh! (male screams)” z OpenGameArt
# (aargh.zip, 8 krzyków OGG; Helmut Scream i Male_Thijs_loud_scream na CC-BY 3.0, human male scream multi na CC0; autorzy w
# docs/CREDITS.md). Skrypt zamienia każdy krzyk na próbkę dla gry: przycina ciszę, znajduje najbardziej ustabilizowany odcinek
# (stałe f0 i głośność), wybiera pętlę o długości całkowitej liczby okresów (najlepsze dopasowanie fali początku i końca),
# miesza koniec pętli z materiałem sprzed jej początku (równa moc, 30 ms), zapisuje strój próbki (średnie f0 pętli jako półton
# MIDI) i wyrównuje głośność: pętlę do −18 dBFS, a ATAK do wspólnego poziomu całej ósemki (patrz `wyrownaj_ataki`).
# Wynik: web/assets/krzyk/krzyk-N.wav (PCM16 mono 32 kHz) + krzyk.json.
# Gra (js/glos.js, receptura `krzyk`) gra od początku próbki, potem zapętla odcinek, dopóki trzymasz nutę, i zmienia szybkość
# odtwarzania do wysokości nuty (pitch shift).
#
#   py -I -X utf8 tools/ribbitbeat_krzyk_probki.py --zip ŚCIEŻKA\aargh.zip [--probne]   ← pełne przeliczenie z paczki
#   py -I -X utf8 tools/ribbitbeat_krzyk_probki.py --wyrownaj                           ← samo wyrównanie gotowych próbek
#
# Drugi tryb istnieje, bo `aargh.zip` nie leży w repozytorium: wyrównanie działa na tym, co jest w web/assets/krzyk/,
# i daje ten sam wynik, co pełne przeliczenie (to ta sama funkcja). Tryb jest idempotentny — drugie uruchomienie
# niczego już nie zmienia.
import json, math, os, sys, tempfile, wave, zipfile
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 32000
CROSS_S = 0.03
HOP = 256
PETLA_DB = -18.0     # głośność zapętlonego odcinka (trzymana nuta)
RAMPA_S = 0.06       # przejście z głośności ataku na głośność pętli, przed strefą zszycia
SZCZYT_MAKS = 0.98

def wczytaj(sciezka):
    import soundfile as sf
    from scipy.signal import resample_poly
    x, sr = sf.read(sciezka)
    if x.ndim > 1: x = x.mean(1)
    x = np.clip(x, -1, 1)
    if sr != SR:
        g = math.gcd(sr, SR); x = resample_poly(x, SR // g, sr // g)
    return x.astype(np.float64)

def przytnij(x):
    """Wyrzuca ciszę z początku (próg −40 dB od szczytu) i ogon po ostatnim głośnym miejscu."""
    a = np.abs(x); pr = a.max() * .01
    idx = np.where(a > pr)[0]
    lead = max(0, idx[0] - int(.005 * SR))
    return x[lead:idx[-1] + 1], lead

# Ustabilizowane odcinki wybrane ręcznie po spektrogramach (sekundy od początku oryginału, przed przycięciem ciszy): automat
# (pyin) mylił oktawy przy krzykach, bo formant przy 800 Hz bywa głośniejszy niż podstawa.
ODCINKI = {0: (.31, .62), 1: (.40, .60), 2: (.20, .62), 3: (.29, .58), 4: (.15, .46), 5: (.30, .56), 6: (.70, 1.00), 7: (.26, .56)}
FMIN, FMAX = 150, 520   # zakres podstawy męskiego krzyku; węższy niż pyin domyślnie, żeby nie łapać formantów

def f0_odcinka(x, od, do_):
    import librosa
    f0 = librosa.pyin(x[max(0, od - 1024):do_ + 1024], fmin=FMIN, fmax=FMAX, sr=SR, frame_length=2048, hop_length=HOP)[0]
    f0 = f0[~np.isnan(f0)]
    return float(np.exp(np.log(f0).mean())) if len(f0) else 340.0

def najlepsza_petla(x, od, do_, hz):
    """Pętla [s, s+L): początek w pierwszej połowie odcinka, L z całkowitej liczby okresów (hz = średnie f0), maksymalna zgodność
    fali na początku i na końcu (korelacja okna 15 ms). Zwraca (s, e)."""
    T = SR / hz; W = int(.015 * SR); best = (-2, od, od + int(8 * T))
    s0 = od + int(.02 * SR); s1 = od + max(int(.03 * SR), (do_ - od) // 3)
    for s in range(s0, max(s0 + 1, s1), 40):
        seg = x[s:s + W]; ns = np.linalg.norm(seg) + 1e-9
        for k in range(4, 160):
            L = int(round(k * T))
            if L < int(.16 * SR) or s + L + W > do_: continue
            c = float(seg @ x[s + L:s + L + W]) / (ns * (np.linalg.norm(x[s + L:s + L + W]) + 1e-9))
            if c > best[0]: best = (c, s, s + L)
    return best[1], best[2], best[0]

def zrob(x, nr):
    x, lead = przytnij(x)
    x = x / (np.abs(x).max() + 1e-9) * .9
    od, do_ = (max(int(.05 * SR), int(v * SR) - lead) for v in ODCINKI[nr])
    hz = f0_odcinka(x, od, do_)
    s, e, kor = najlepsza_petla(x, od, do_, hz)
    X = int(CROSS_S * SR)
    if s - X < 0: e = e + (X - s); s = X
    out = zszyj(x[:e].copy(), s, e)
    hz = f0_odcinka(x, s, e)
    root = 69 + 12 * math.log2(hz / 440.0)
    # Głośności (pętla, atak) i zszycie szwu robi `wyrownaj_ataki` na całej ósemce naraz — atak ma wspólny
    # poziom, więc nie da się go policzyć, patrząc na jedną próbkę.
    return {"s": out, "root": round(root, 3), "petla": (s / SR, e / SR), "hz": hz, "kor": kor, "dl": len(out) / SR}

def rms(x):
    return math.sqrt(float((np.asarray(x, dtype=np.float64) ** 2).mean())) if len(x) else 0.0


def pcm16(x):
    """Float → PCM16. Mnożnik 32768 i ZAOKRĄGLENIE, bo wtedy zapis jest dokładnym odwrotnieniem odczytu
    (`/32768`). Przy `*32767` z obcięciem każde przejście przez plik przesuwało głośne próbki o jeden bit,
    więc samo wczytanie i zapisanie ósemki zmieniało ją — i `--wyrownaj` nie był idempotentny."""
    return np.clip(np.round(np.asarray(x, dtype=np.float64) * 32768.0), -32768, 32767).astype("<i2")


def sekundy(v, w_dol):
    """Czas pętli do manifestu, zaokrąglony tak, żeby po odczytaniu NIE WYPADŁ POZA PLIK: początek w górę,
    koniec w dół. Cztery miejsca po przecinku to przy 32 kHz jakieś trzy próbki niepewności — dość, żeby
    `round(koniec * SR)` wyszło za ostatnią próbką i przeglądarka musiała po cichu przycinać `loopEnd`
    (tak było do 10-21 w trzech z ośmiu krzyków). Strata to najwyżej trzy próbki ogona pętli, czyli nic
    wobec 960-próbkowego zszycia."""
    return (math.floor(v * 1e4) if w_dol else math.ceil(v * 1e4)) / 1e4


def zszyj(out, s, e):
    """Koniec pętli przechodzi w to, co leży PRZED jej początkiem (równa moc, CROSS_S), więc skok z końca
    na początek nie jest cięciem w połowie fali. Wołane PO zmianie głośności, bo inaczej zszyty ogon
    niósłby głośność ataku, a pętla — swoją, i na szwie byłby słyszalny stopień."""
    X = min(int(CROSS_S * SR), s, (e - s) // 2)
    if X <= 0:
        return out
    w = np.sin(np.linspace(0, np.pi / 2, X)); w0 = np.cos(np.linspace(0, np.pi / 2, X))
    out[e - X:e] = out[e - X:e] * w0 + out[s - X:s] * w
    return out


def wyrownaj_ataki(lista):
    """JEDNA GŁOŚNOŚĆ DLA OŚMIU KRZYKÓW.

    Do 10-20 wyrównywany był tylko ZAPĘTLONY ODCINEK (wszystkie do −18 dBFS), a atak zostawał taki, jaki
    wyszedł z nagrania. Ponieważ silnik gra próbki NA ZMIANĘ (`wybierzProbke`), a atak to pierwsze 200–400 ms
    każdej nuty, instrument skakał na głośności z nuty na nutę: zmierzone 10,8 dB rozrzutu na nucie 300 ms
    (od −21,9 do −11,1 dBFS). To jest to, co słychać jako „krzyk brzmi raz tak, raz tak”.

    Teraz obie części mają wspólny poziom: pętla −18 dBFS, atak — ŚREDNIĄ GEOMETRYCZNĄ dotychczasowych ataków.
    Średnia, a nie okrągła liczba, bo zadanie brzmi „zdejmij rozrzut”, a nie „zrób instrument głośniejszym”:
    cała ósemka zostaje tam, gdzie była, i receptura (`glosnosc`) nie wymaga przestrajania.

    Między jedną a drugą głośnością jest RAMPA_S płynnego przejścia, które kończy się PRZED strefą zszycia.
    To nie jest kosmetyka, tylko powód, dla którego ta funkcja NIE MUSI zszywać szwu od nowa: ogon pętli
    i materiał, z którego jest zszyty (`x[s-X:s]`), dostają TEN SAM mnożnik, więc gotowe zszycie przechodzi
    przez zmianę głośności nienaruszone. Dzięki temu całość jest zwykłym mnożeniem i jest idempotentna —
    drugie uruchomienie nie zmienia ani jednego bajtu.

    Na końcu wspólny zapas na szczyt: jeden mnożnik dla całej ósemki, żeby rozrzut nie wrócił tylnymi drzwiami."""
    cel_p = 10 ** (PETLA_DB / 20)
    # Głośność ataku mierzona TYLKO na odcinku, który dostanie mnożnik ataku (przed rampą i przed zszyciem).
    # Gdyby mierzyć całe `x[:s]`, w pomiarze siedziałby kawałek już przeskalowany do głośności pętli — i drugie
    # uruchomienie narzędzia liczyłoby inny mnożnik niż pierwsze (zmierzone: 754 LSB różnicy, nie zaokrąglenie).
    kr = []
    for k in lista:
        x = np.asarray(k["s"], dtype=np.float64)
        n = len(x)
        s = min(n - 1, int(round(k["petla"][0] * SR)))
        e = min(n, int(round(k["petla"][1] * SR)))
        X = min(int(CROSS_S * SR), s, (e - s) // 2)
        R = min(int(RAMPA_S * SR), max(0, s - X))
        plask = max(1, s - X - R)
        kr.append((x, n, s, e, X, R, plask, max(rms(x[:plask]), 1e-9)))
    cel_a = float(np.exp(np.log([c[7] for c in kr]).mean()))
    for k, (x, n, s, e, X, R, plask, ra) in zip(lista, kr):
        gA = cel_a / ra
        gP = cel_p / max(rms(x[s:e]), 1e-9)
        if abs(gA - 1) < 1e-3 and abs(gP - 1) < 1e-3:
            continue      # już wyrównana: mnożenie przez 1,0000x zmieniłoby tylko ostatni bit PCM16
        g = np.full(n, gP)
        g[:plask] = gA
        if R > 0:
            g[plask:s - X] = gA + (gP - gA) * (0.5 - 0.5 * np.cos(np.linspace(0, np.pi, s - X - plask)))
        k["s"] = x * g
        k["petla"] = (s / SR, e / SR)
    zapas = min(SZCZYT_MAKS / max(float(np.abs(k["s"]).max()), 1e-9) for k in lista)
    if zapas < 1:                                        # jeden mnożnik na całą ósemkę: rozrzut ma nie wrócić
        for k in lista:
            k["s"] = k["s"] * zapas
        print("zapas na szczyt: wszystkie próbki ściszone o %.1f dB" % (-20 * math.log10(zapas)))
    return lista


def zapisz(lista, dst):
    os.makedirs(dst, exist_ok=True)
    for f in os.listdir(dst):
        if f.startswith("krzyk-") and f.endswith(".wav"): os.remove(os.path.join(dst, f))
    meta = []
    for i, k in enumerate(lista, 1):
        pl = f"krzyk-{i}.wav"
        with wave.open(os.path.join(dst, pl), "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
            w.writeframes(pcm16(k["s"]).tobytes())
        meta.append({"plik": pl, "nazwa": k["nazwa"], "root": k["root"], "petla": [sekundy(k["petla"][0], False), sekundy(k["petla"][1], True)]})
    meta.sort(key=lambda m: m["root"])
    json.dump({"sr": SR, "probki": meta}, open(os.path.join(dst, "krzyk.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("zapisano", len(meta), "próbek →", dst, sum(os.path.getsize(os.path.join(dst, x)) for x in os.listdir(dst)) // 1024, "KB")

ASSETY = os.path.join(HERE, "..", "web", "assets", "krzyk")


def wczytaj_gotowe(dst):
    """Gotowe próbki z web/assets/krzyk/ + ich manifest — wejście dla trybu `--wyrownaj`.
    Kolejność jak w manifeście, ale KAŻDA próbka pamięta swój plik, żeby wyrównanie nie przenumerowało ósemki."""
    man = json.load(open(os.path.join(dst, "krzyk.json"), encoding="utf-8"))
    lista = []
    for m in man["probki"]:
        with wave.open(os.path.join(dst, m["plik"]), "rb") as w:
            if w.getnchannels() != 1 or w.getsampwidth() != 2 or w.getframerate() != SR:
                raise SystemExit("%s: oczekiwany PCM16 mono %d Hz" % (m["plik"], SR))
            d = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float64) / 32768.0
        lista.append({"s": d, "root": m["root"], "petla": tuple(m["petla"]), "nazwa": m["nazwa"], "plik": m["plik"]})
    return lista


def zapisz_w_miejscu(lista, dst):
    """Zapis dla `--wyrownaj`: każda próbka wraca pod SWOJĄ nazwę pliku, numeracja i stroje bez zmian."""
    for k in lista:
        with wave.open(os.path.join(dst, k["plik"]), "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
            w.writeframes(pcm16(k["s"]).tobytes())
    meta = [{"plik": k["plik"], "nazwa": k["nazwa"], "root": k["root"],
             "petla": [sekundy(k["petla"][0], False), sekundy(k["petla"][1], True)]} for k in lista]
    meta.sort(key=lambda m: m["root"])
    json.dump({"sr": SR, "probki": meta}, open(os.path.join(dst, "krzyk.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    print("wyrównano %d próbek → %s" % (len(meta), os.path.normpath(dst)))


def raport(lista):
    """Co słychać: głośność nuty 300 ms (atak + kawałek pętli) i samej pętli, dla każdej próbki."""
    print("%-12s %9s %9s %7s" % ("plik", "nuta300", "pętla", "szczyt"))
    n300 = []
    for k in lista:
        n = len(k["s"]); s = min(n - 1, int(round(k["petla"][0] * SR))); e = min(n, int(round(k["petla"][1] * SR)))
        ile = int(SR * .3); buf = list(k["s"][:min(e, ile)]); pet = k["s"][s:e]
        while len(buf) < ile and len(pet):
            buf.extend(pet[:ile - len(buf)])
        db = lambda v: 20 * math.log10(max(v, 1e-9))
        n300.append(db(rms(buf)))
        print("%-12s %8.1f  %8.1f  %6.2f" % (k.get("plik", k["nazwa"]), n300[-1], db(rms(k["s"][s:e])),
                                             float(np.abs(k["s"]).max())))
    print("rozrzut nuty 300 ms: %.1f dB" % (max(n300) - min(n300)))


if __name__ == "__main__":
    if "--wyrownaj" in sys.argv:
        dst = ASSETY
        lista = wczytaj_gotowe(dst)
        print("PRZED:"); raport(lista)
        wyrownaj_ataki(lista)
        print("PO:"); raport(lista)
        zapisz_w_miejscu(lista, dst)
        sys.exit(0)
    zp = sys.argv[sys.argv.index("--zip") + 1]
    dst = os.path.join(HERE, "_probne_krzyk") if "--probne" in sys.argv else ASSETY
    with tempfile.TemporaryDirectory() as tmp, zipfile.ZipFile(zp) as z:
        z.extractall(tmp)
        lista = []
        for i in range(8):
            k = zrob(wczytaj(os.path.join(tmp, f"aargh{i}.ogg")), i); k["nazwa"] = f"aargh{i}"
            print(f"aargh{i}: dl {k['dl']:.2f}s pętla {k['petla'][0]:.2f}-{k['petla'][1]:.2f} ({(k['petla'][1]-k['petla'][0])*1000:.0f} ms, zgodność {k['kor']:.2f}) f0 {k['hz']:.0f} Hz root {k['root']}")
            lista.append(k)
    wyrownaj_ataki(lista)   # głośność ataku jest wspólna dla ósemki, więc liczy się ją dopiero tutaj
    raport(lista)
    zapisz(lista, dst)
