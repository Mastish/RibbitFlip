# Próbki instrumentów RibbitBeat z PRAWDZIWYCH NAGRAŃ (2026-10-21). Część istniejących instrumentów dostaje sample
# z otwartych plików audio (bez dodawania nowych instrumentów).
#
# Źródło: VSCO 2 Community Edition (Versilian Studios, Sam Gossner), https://github.com/sgossner/VSCO-2-CE, licencja CC0 1.0
# (plik LICENSE w repozytorium, kopia w third_party_licenses/vsco2-ce-LICENSE.txt). Z każdego nagrania zostaje w grze ok. 1 s:
# atak + zapętlony odcinek, mono 22 050 Hz, PCM16, ok. 40–70 kB. Jeden instrument = 3–4 STREFY (po jednej nucie co 7–12
# półtonów); silnik gry (js/glos.js) bierze do nuty najbliższą strefę i przestraja ją `playbackRate` (manifest `strefy: true`).
#
# Co robi z jednym nagraniem (`zrob`):
#   1. mono, przepróbkowanie do 22 050 Hz, odcięcie ciszy z przodu (1 % szczytu, 5 ms zapasu),
#   2. strój: szczyt uśrednionego widma w paśmie ±8 półtonów wokół nuty nominalnej z nazwy pliku (szerokie pasmo myli oktawy
#      przy bogatych widmach), a potem kontrola: wynik ma leżeć w 1 półtonie od nominału, inaczej skrypt staje (to łapie też
#      złe założenie o konwencji oktaw w nazwach VSCO: C3 = 60),
#   3. pętla: początek w oknie `start` po ataku, długość z przedziału `petla` (każda liczba próbek — strój dryfuje, więc
#      wielokrotność okresu po pół sekundzie mija się z fazą), maksymalna zgodność fali na obu końcach (okno 30 ms, korelacja
#      jednym splotem FFT) × równość głośności obu końców × spokój głośności w środku (bez szwu i bez „pompowania”),
#   4. plik = od początku do końca pętli; szew: koniec pętli przechodzi w to, co leży przed jej początkiem (równa moc, 40 ms;
#      pianino 120 ms, sekcje smyczków 80 ms, bo dudnienie wielu strun nie daje dwóm oknom fali zgodzić się do końca),
#   5. głośność: zapętlony odcinek do `petla_db` (−18 dBFS; pianino −20 i atak okiełznany do 12 dB nad pętlą, bo młoteczek
#      leży 30 dB nad ogonem), ze wspólnym zapasem na szczyt 0,98 dla całego zestawu, żeby strefy jednego instrumentu
#      nie różniły się głośnością.
# Wynik: web/assets/<instrument>/<instrument>-N.wav + <instrument>.json ({sr, strefy, zrodlo, probki:[{plik, nazwa, nuta, root,
# petla}]}, posortowane po stroju) + ZRODLA.md (skąd każdy plik). Pilnuje tego tests/test_gry_probki_instrumentow.py.
#
#   py -I -X utf8 tools/ribbitbeat_probki_instrumentow.py --pobierz <katalog> [--tylko flet,trabka]
#       ← pobiera pliki z ZESTAWY (TYLKO po zatwierdzeniu listy plików; każdy pomija, jeśli już leży)
#   py -I -X utf8 tools/ribbitbeat_probki_instrumentow.py --zbuduj <katalog> [--tylko flet,trabka] [--probne]
#       ← buduje web/assets/<instrument>/ z pobranych plików (--probne: do tools/_probne_probki/)
#   py -I -X utf8 tools/ribbitbeat_probki_instrumentow.py --raport
#       ← co leży w web/assets/: rozmiary, stroje, długości pętli, głośności
import json
import math
import os
import sys
import tempfile
import urllib.parse
import urllib.request
import wave

import numpy as np

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
ASSETY = os.path.join(REPO, "web", "assets")
SR = 22050
ZSZYCIE_S = 0.04          # szew pętli: równa moc, 40 ms
SZCZYT_MAKS = 0.98
WEJSCIE_S = 0.002         # zjazd od zera na starcie pliku (po odcięciu ciszy)
OKNO_S = 0.03             # okno zgodności fali na końcach pętli
ADRES = "https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/"
ZRODLO = {"nazwa": "VSCO 2 Community Edition", "autor": "Versilian Studios LLC (Sam Gossner)",
          "adres": "https://github.com/sgossner/VSCO-2-CE", "licencja": "CC0-1.0"}

# Konwencja nazw VSCO: C3 = środkowe C = MIDI 60 (zakresy instrumentów to potwierdzają: flet od C3, wiolonczela od C1).
# `okt` = o ile oktaw próbka gra OBOK nuty śpiewanej (to samo, co `okt` receptury oscylatorów; w glos.js `probkaOkt`), więc
# strefy leżą w zakresie nuta śpiewana + 12·okt: śpiewane 55–84 → flet 67–96, wiolonczela 43–72, tuba 31–60.
# `start` = okno początku pętli (s od początku nagrania po odcięciu ciszy), `petla` = długość pętli (s).
ZESTAWY = {
    "trabka": dict(okt=0, katalog="Brass/Trumpet/sus", start=(.3, 1.4), petla=(.35, .7), petla_db=-18,
                   pliki=[("Sum_SHTrumpet_sus_C3_v3_rr1.wav", 60), ("Sum_SHTrumpet_sus_G3_v3_rr1.wav", 67),
                          ("Sum_SHTrumpet_sus_D4_v3_rr1.wav", 74)]),
    "flet": dict(okt=1, katalog="Woodwinds/Flute/susNV", start=(.3, 1.4), petla=(.35, .7), petla_db=-18,
                 pliki=[("LDFlute_susNV_A3_v3_1.wav", 69), ("LDFlute_susNV_E4_v3_1.wav", 76), ("LDFlute_susNV_C5_v2_1.wav", 84)]),
    "smyczki": dict(okt=0, katalog="Strings/Violin Section/susVib", start=(.5, 1.6), petla=(.6, 1.0), petla_db=-18, zszycie=.08,
                    pliki=[("VlnEns_susVib_B2_v2.wav", 59), ("VlnEns_susVib_A3_v2.wav", 69), ("VlnEns_susVib_G4_v2.wav", 79)]),
    "wiolonczela": dict(okt=-1, katalog="Strings/Cello Section/susvib", start=(.5, 1.6), petla=(.6, 1.0), petla_db=-18, zszycie=.08,
                        pliki=[("susvib_D2_v3_1.wav", 50), ("susvib_A2_v3_1.wav", 57), ("susvib_E3_v3_1.wav", 64)]),
    "piano": dict(okt=0, katalog="Keys/Upright Nr1", start=(.6, 1.6), petla=(.4, .8), petla_db=-20, zszycie=.12, atak_nad=12,
                  pliki=[("UR1_C3_mf_RR1.wav", 60), ("UR1_G3_mf_RR1.wav", 67), ("UR1_C4_mf_RR1.wav", 72), ("UR1_G4_mf_RR1.wav", 79)]),
    "organy": dict(okt=0, katalog="Keys/Organ/Loud", start=(.4, 1.6), petla=(.4, .8), petla_db=-18,
                   pliki=[("Rode_Man3Open_25.wav", 60), ("Rode_Man3Open_34.wav", 69), ("Rode_Man3Open_43.wav", 78)]),
    "oboj": dict(okt=0, katalog="Woodwinds/Oboe/Sus", start=(.3, 1.4), petla=(.35, .7), petla_db=-18,
                 pliki=[("Oboe_Sus_D3_v3_Main.wav", 62), ("Oboe_Sus_A#3_v3_Main.wav", 70), ("Oboe_Sus_F4_v3_Main.wav", 77)]),
    "klarnet": dict(okt=0, katalog="Woodwinds/Clarinet/susLong", start=(.3, 1.4), petla=(.35, .7), petla_db=-18,
                    pliki=[("DCClar_susLong_D3_v2_rr1_sum.wav", 62), ("DCClar_susLong_A#3_v2_rr1_sum.wav", 70),
                           ("DCClar_susLong_F4_v2_rr1_sum.wav", 77)]),
    "puzon": dict(okt=-1, katalog="Brass/Tenor Trombone/sus", start=(.3, 1.4), petla=(.35, .7), petla_db=-18,
                  pliki=[("tenortbn_sus_F2_v2_1.wav", 53), ("tenortbn_sus_C3_v2_1.wav", 60), ("tenortbn_sus_F3_v2_1.wav", 65)]),
    "tuba": dict(okt=-2, katalog="Brass/Tuba/sus", start=(.3, 1.4), petla=(.4, .8), petla_db=-18,
                 pliki=[("Tuba3_sus_A#0_v2_rr1_Mid.wav", 34), ("Tuba3_sus_F1_v2_rr1_Mid.wav", 41), ("Tuba3_sus_D2_v2_rr1_Mid.wav", 50)]),
}
PLIKI_REPO = ["LICENSE", "README.md"]   # tekst licencji i podziękowania autora, pobierane razem z nagraniami


def hz_z_midi(m):
    return 440.0 * 2 ** ((m - 69) / 12.0)


def midi_z_hz(f):
    return 69 + 12 * math.log2(f / 440.0)


def rms(x):
    x = np.asarray(x, dtype=np.float64)
    return math.sqrt(float((x * x).mean())) if len(x) else 0.0


def db(v):
    return 20 * math.log10(max(v, 1e-9))


# ---- pobieranie (po zatwierdzeniu listy) -------------------------------------------------------------------------
def pobierz(dst, tylko):
    os.makedirs(dst, exist_ok=True)
    zadania = [(p, os.path.join(dst, p)) for p in PLIKI_REPO]
    for inst, z in ZESTAWY.items():
        if tylko and inst not in tylko:
            continue
        for plik, _ in z["pliki"]:
            zadania.append((z["katalog"] + "/" + plik, os.path.join(dst, inst, plik)))
    for sciezka, cel in zadania:
        if os.path.isfile(cel) and os.path.getsize(cel) > 0:
            print("jest     ", sciezka)
            continue
        os.makedirs(os.path.dirname(cel), exist_ok=True)
        adres = ADRES + urllib.parse.quote(sciezka)
        with urllib.request.urlopen(adres, timeout=120) as r, open(cel + ".part", "wb") as f:
            while True:
                b = r.read(1 << 16)
                if not b:
                    break
                f.write(b)
        os.replace(cel + ".part", cel)
        print("pobrano  %-70s %6.2f MB" % (sciezka, os.path.getsize(cel) / 1e6))


# ---- obróbka jednego nagrania -----------------------------------------------------------------------------------
def wczytaj(sciezka):
    import soundfile as sf
    from scipy.signal import resample_poly
    x, sr = sf.read(sciezka, dtype="float64", always_2d=True)
    x = x.mean(1)
    if sr != SR:
        g = math.gcd(int(sr), SR)
        x = resample_poly(x, SR // g, int(sr) // g)
    return np.clip(x, -1, 1)


def przytnij(x):
    """Cisza z przodu: od pierwszej próbki powyżej 1 % szczytu, z 5 ms zapasu. Ogon zostaje (ucina go koniec pętli)."""
    a = np.abs(x)
    idx = np.where(a > a.max() * .01)[0]
    od = max(0, int(idx[0]) - int(.005 * SR))
    return x[od:]


def stroj(x, od, do_, nuta):
    """Strój odcinka [od, do_) jako półton MIDI: szczyt UŚREDNIONEGO WIDMA (okna Hanna 16 384 próbek, co pół okna) w paśmie
    ±8 półtonów od nuty nominalnej, dociągnięty parabolą przez trzy biny. Pasmo wyklucza oktawę obok (12 półtonów): przy
    widmie z mocnym drugim alikwotem (obój, trąbka, niskie dęte) detektory okresu tam wskakują, a pyin przy pianinie G4
    utknął na granicy pasma. W ±8 półtonach najgłośniejszy prążek to podstawa. Zwraca (root, ile okien)."""
    nom = hz_z_midi(nuta)
    N = 16384
    seg = x[od:do_]
    if len(seg) < N:
        seg = np.pad(seg, (0, N - len(seg)))
    okno = np.hanning(N)
    widmo = np.zeros(N // 2 + 1)
    n = 0
    for i in range(0, len(seg) - N + 1, N // 2):
        widmo += np.abs(np.fft.rfft(seg[i:i + N] * okno))
        n += 1
    if not n:
        return None, 0
    f = np.fft.rfftfreq(N, 1.0 / SR)
    lo, hi = int(np.searchsorted(f, nom / 1.6)), int(np.searchsorted(f, nom * 1.6))
    k = lo + int(np.argmax(widmo[lo:hi]))
    a, b, c = widmo[k - 1], widmo[k], widmo[k + 1]
    p = .5 * (a - c) / (a - 2 * b + c) if (a - 2 * b + c) != 0 else 0.0
    return midi_z_hz((k + p) * SR / N), n


def obwiednia(x, hop=256):
    n = len(x) // hop
    return np.sqrt((x[:n * hop].reshape(n, hop) ** 2).mean(1)), hop


def najlepsza_petla(x, start, petla):
    """Pętla [s, e): s w oknie `start`, długość z przedziału `petla` — KAŻDA całkowita liczba próbek, nie tylko wielokrotność
    okresu (strój dryfuje o kilka centów, więc po pół sekundy wielokrotność okresu mija się z fazą o cały okres: tak wyszły
    pętle fletu o zgodności 0,0). Korelację okna 30 ms z początku pętli ze WSZYSTKIMI możliwymi końcami liczy jeden splot FFT.
    Ocena kandydata = zgodność fali × równość głośności obu końców × spokój głośności w środku. Zwraca (s, e, ocena)."""
    from scipy.signal import fftconvolve
    W = int(OKNO_S * SR)
    env, hop = obwiednia(x)
    s0, s1 = int(start[0] * SR), int(start[1] * SR)
    Lmin, Lmax = int(petla[0] * SR), int(petla[1] * SR)
    c2 = np.concatenate([[0.0], np.cumsum(x * x)])
    best = (-9, s0, s0 + Lmin)
    krok = max(1, int(.002 * SR))
    for s in range(s0, max(s0 + 1, s1), krok):
        seg = x[s:s + W]
        ns = np.linalg.norm(seg) + 1e-9
        a, b = s + Lmin, min(len(x) - W, s + Lmax)
        if b <= a:
            break
        kor = fftconvolve(x[a:b + W], seg[::-1], mode="valid")          # kor[j] = seg · x[a+j : a+j+W]
        en = np.sqrt(np.maximum(c2[a + W:b + W + 1] - c2[a:b + 1], 1e-12))
        c = kor / (ns * en)
        ra = rms(x[s:s + W * 4])
        for j in np.argsort(c)[-6:]:                                     # kilku najlepszych kandydatów na koniec
            e = a + int(j)
            rb = rms(x[e - W * 4:e])
            rown = min(ra, rb) / (max(ra, rb) + 1e-9)
            ob = env[s // hop:e // hop]
            spokoj = 1 - min(.5, float(ob.std() / (ob.mean() + 1e-9)))
            ocena = float(c[j]) * rown * spokoj
            if ocena > best[0]:
                best = (ocena, s, e)
    return best[1], best[2], best[0]


def zszyj(out, s, e, zszycie):
    """Koniec pętli przechodzi w to, co leży PRZED jej początkiem (równa moc, `zszycie` s): skok z końca na początek nie
    jest cięciem w połowie fali. Ten sam pomysł, co w tools/ribbitbeat_krzyk_probki.py; pianino i sekcje smyczków dostają
    dłuższe zszycie (dudnienie trzech strun / wielu grających), bo tam żadne dwa okna fali nie zgadzają się do końca."""
    X = min(int(zszycie * SR), s, (e - s) // 2)
    if X <= 0:
        return out
    w = np.sin(np.linspace(0, np.pi / 2, X))
    w0 = np.cos(np.linspace(0, np.pi / 2, X))
    out[e - X:e] = out[e - X:e] * w0 + out[s - X:s] * w
    return out


def zrob(sciezka, nuta, z):
    x = przytnij(wczytaj(sciezka))
    hz0 = hz_z_midi(nuta)
    # strój z przybliżonego środka okna pętli: tu nagranie jest już ustabilizowane
    a, b = int(z["start"][0] * SR), min(len(x), int((z["start"][1] + z["petla"][1]) * SR))
    root, ramek = stroj(x, a, b, nuta)
    if root is None or abs(root - nuta) > 1.0:
        raise SystemExit("%s: strój %s nie leży w 1 półtonie od nominału %d (ramek z f0: %d) — sprawdź nazwę pliku / konwencję oktaw"
                         % (os.path.basename(sciezka), "brak" if root is None else "%.2f" % root, nuta, ramek))
    s, e, ocena = najlepsza_petla(x, z["start"], z["petla"])
    root2, _ = stroj(x, s, e, nuta)          # strój dokładnie tej pętli, którą będzie słyszał gracz
    if root2 is not None and abs(root2 - nuta) <= 1.0:
        root = root2
    out = x[:e].copy()
    out = zszyj(out, s, e, z.get("zszycie", ZSZYCIE_S))
    n_in = int(WEJSCIE_S * SR)
    out[:n_in] *= np.linspace(0, 1, n_in)
    return {"s": out, "root": round(root, 3), "petla": (s, e), "ocena": ocena, "nuta": nuta, "hz": hz0}


def okielznaj_atak(x, s, X, cel, nad_db):
    """Atak nie głośniej niż `nad_db` nad pętlą (RMS okna 20 ms, wzmocnienie wygładzone 30 ms): młoteczek pianina leży
    ok. 30 dB nad zapętlonym ogonem, więc bez tego zestaw musiał zjechać o 8,6 dB (zapas na szczyt), a trzymana nuta
    ginęła pod podkładem. Od `s − X − 60 ms` w prawo wzmocnienie jest dokładnie 1: pętla i materiał jej zszycia nietknięte."""
    n = len(x)
    W = int(.02 * SR)
    c2 = np.concatenate([[0.0], np.cumsum(x * x)])
    lok = np.sqrt(np.maximum(c2[W:] - c2[:-W], 0) / W)
    g = np.minimum(1.0, cel * 10 ** (nad_db / 20) / np.maximum(lok, 1e-9))
    g = np.concatenate([g, np.full(W, g[-1])])[:n]
    gran = max(0, s - X - int(.06 * SR))
    g[gran:] = 1.0
    K = int(.03 * SR)
    g = np.convolve(g, np.ones(K) / K, mode="same")
    g[max(0, s - X):] = 1.0
    return x * g


def wyrownaj(lista, z):
    """Pętla każdej strefy do `petla_db`, atak okiełznany (`atak_nad`, jeśli zestaw go ma), potem JEDEN wspólny zapas na
    szczyt dla całego zestawu (żeby strefy jednego instrumentu były równie głośne; różnice wyrównuje się tu, a nie
    `glosnosc` w recepturze)."""
    cel = 10 ** (z["petla_db"] / 20)
    for k in lista:
        s, e = k["petla"]
        k["s"] = k["s"] * (cel / max(rms(k["s"][s:e]), 1e-9))
        if z.get("atak_nad") is not None:
            k["s"] = okielznaj_atak(k["s"], s, int(z.get("zszycie", ZSZYCIE_S) * SR), cel, z["atak_nad"])
    zapas = min(SZCZYT_MAKS / max(float(np.abs(k["s"]).max()), 1e-9) for k in lista)
    if zapas < 1:
        for k in lista:
            k["s"] = k["s"] * zapas
        print("   zapas na szczyt: zestaw ściszony o %.1f dB (atak nad pętlą)" % (-db(zapas)))
    return lista


def pcm16(x):
    return np.clip(np.round(np.asarray(x, dtype=np.float64) * 32768.0), -32768, 32767).astype("<i2")


def sekundy(v, w_dol):
    """Czas pętli do manifestu: początek w górę, koniec w dół (4 miejsca), żeby po odczytaniu nie wypadł poza plik."""
    return (math.floor(v * 1e4) if w_dol else math.ceil(v * 1e4)) / 1e4


def zapisz(inst, z, lista, dst):
    kat = os.path.join(dst, inst)
    os.makedirs(kat, exist_ok=True)
    for f in os.listdir(kat):
        if f.startswith(inst + "-") and f.endswith(".wav"):
            os.remove(os.path.join(kat, f))
    lista.sort(key=lambda k: k["root"])
    meta = []
    for i, k in enumerate(lista, 1):
        pl = "%s-%d.wav" % (inst, i)
        with wave.open(os.path.join(kat, pl), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(pcm16(k["s"]).tobytes())
        s, e = k["petla"]
        meta.append({"plik": pl, "nazwa": k["nazwa"], "nuta": k["nuta"], "root": k["root"],
                     "petla": [sekundy(s / SR, False), sekundy(e / SR, True)]})
    man = {"sr": SR, "strefy": True, "zrodlo": dict(ZRODLO, katalog=z["katalog"]), "probki": meta}
    with open(os.path.join(kat, inst + ".json"), "w", encoding="utf-8") as f:
        json.dump(man, f, ensure_ascii=False, indent=1)
    with open(os.path.join(kat, "ZRODLA.md"), "w", encoding="utf-8") as f:
        f.write("# Próbki instrumentu „%s” (RibbitBeat)\n\n" % inst)
        f.write("Pliki `%s-N.wav` (PCM16 mono %d Hz) i opis stref w `%s.json` (`nuta` = nuta nominalna nagrania, `root` = zmierzony "
                "strój jako półton MIDI, `petla` = zapętlony odcinek w sekundach; `strefy: true` = gra najbliższą próbkę).\n\n" % (inst, SR, inst))
        f.write("**Źródło: %s** (%s), %s, katalog `%s`, licencja **%s** (kopia: `third_party_licenses/vsco2-ce-LICENSE.txt`).\n\n"
                % (ZRODLO["nazwa"], ZRODLO["autor"], ZRODLO["adres"], z["katalog"], ZRODLO["licencja"]))
        f.write("| plik w grze | nagranie źródłowe | nuta |\n| --- | --- | --- |\n")
        for m in meta:
            f.write("| `%s` | [`%s`](%s) | %d |\n" % (m["plik"], m["nazwa"], ADRES + urllib.parse.quote(z["katalog"] + "/" + m["nazwa"]), m["nuta"]))
        f.write("\nNagrania zostały zmienione: mono, przepróbkowane do %d Hz, przycięte do ok. 1–2 s (atak + odcinek pętli), z zapętlonym "
                "odcinkiem zszytym na końcu z początkiem (równa moc, %d ms) i wyrównaną głośnością pętli (%d dBFS). "
                "Skrypt: `tools/ribbitbeat_probki_instrumentow.py --zbuduj`.\n" % (SR, int(z.get("zszycie", ZSZYCIE_S) * 1000), z["petla_db"]))
    razem = sum(os.path.getsize(os.path.join(kat, m["plik"])) for m in meta)
    print("   zapisano %d stref → %s (%d kB)" % (len(meta), os.path.relpath(kat, REPO), razem // 1024))


def zbuduj(src, tylko, probne):
    dst = os.path.join(tempfile.gettempdir(), "rb-probki-probne") if probne else ASSETY   # --probne: nic nie ląduje w repo
    if probne:
        print("próbny zapis do", dst)
    for inst, z in ZESTAWY.items():
        if tylko and inst not in tylko:
            continue
        print(inst)
        lista = []
        for plik, nuta in z["pliki"]:
            sciezka = os.path.join(src, inst, plik)
            if not os.path.isfile(sciezka):
                raise SystemExit("brak pliku %s (najpierw --pobierz, po zatwierdzeniu listy plików)" % sciezka)
            k = zrob(sciezka, nuta, z)
            k["nazwa"] = plik
            s, e = k["petla"]
            print("   %-38s nuta %3d strój %7.2f  pętla %.2f–%.2f s (%3.0f ms, zgodność %.2f)  plik %.2f s"
                  % (plik, nuta, k["root"], s / SR, e / SR, (e - s) * 1000 / SR, k["ocena"], len(k["s"]) / SR))
            lista.append(k)
        wyrownaj(lista, z)
        zapisz(inst, z, lista, dst)


def raport():
    for inst in ZESTAWY:
        kat = os.path.join(ASSETY, inst)
        if not os.path.isdir(kat):
            continue
        man = json.load(open(os.path.join(kat, inst + ".json"), encoding="utf-8"))
        print("%s (sr %d, strefy %s)" % (inst, man["sr"], man.get("strefy")))
        for m in man["probki"]:
            with wave.open(os.path.join(kat, m["plik"]), "rb") as w:
                d = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float64) / 32768.0
            s, e = int(round(m["petla"][0] * SR)), int(round(m["petla"][1] * SR))
            print("   %-16s %6d B  nuta %3d root %7.2f  pętla %.3f–%.3f (%3.0f ms)  pętla %6.1f dBFS  szczyt %.2f"
                  % (m["plik"], os.path.getsize(os.path.join(kat, m["plik"])), m["nuta"], m["root"], m["petla"][0], m["petla"][1],
                     (e - s) * 1000 / SR, db(rms(d[s:e])), float(np.abs(d).max())))


if __name__ == "__main__":
    arg = sys.argv[1:]
    tylko = set(arg[arg.index("--tylko") + 1].split(",")) if "--tylko" in arg else None
    if "--pobierz" in arg:
        pobierz(arg[arg.index("--pobierz") + 1], tylko)
    elif "--zbuduj" in arg:
        zbuduj(arg[arg.index("--zbuduj") + 1], tylko, "--probne" in arg)
    elif "--raport" in arg:
        raport()
    else:
        print(__doc__ or open(__file__, encoding="utf-8").read().split("import json")[0])
