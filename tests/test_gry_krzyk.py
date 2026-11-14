# RibbitBeat: próbki instrumentu „Krzyk” (web/assets/krzyk/) — 2026-10-21.
# Run: py tests/test_gry_krzyk.py
#
# Krzyk jest jedynym instrumentem gry zrobionym z NAGRAŃ, a nie z oscylatorów, i jedynym, w którym o brzmieniu
# decydują pliki, a nie kod. Testy kodu nie mają tu czego pilnować — pilnują więc samych plików.
#
# Co sprawdza i dlaczego akurat to:
#  1. FORMAT: PCM16 mono 32 kHz, zgodnie z manifestem. Inny format = parser gry (`parsujWav`) przeczyta śmieci.
#  2. PĘTLA MIEŚCI SIĘ W PLIKU. Koniec pętli zapisany w manifeście jest zaokrąglony do 0,1 ms; gdy wypadnie
#     choćby o próbkę za ostatnią próbką, przeglądarka po cichu podmienia `loopEnd` na własny. Do 10-21 tak
#     było w trzech z ośmiu krzyków.
#  3. JEDNA GŁOŚNOŚĆ NA OSIEM KRZYKÓW. Silnik gra
#     próbki NA ZMIANĘ (`wybierzProbke` w glos.js), więc nierówna głośność słychać jako instrument skaczący
#     z nuty na nutę. Przed poprawką rozrzut na nucie 300 ms wynosił 10,8 dB. Mierzymy tak, jak to brzmi:
#     nuta = atak od zera + pętla powtarzana do 300 ms, oraz sama pętla (nuta trzymana).
#  4. STROJE: w paśmie męskiego krzyku i wzajemnie blisko siebie. Gdyby któraś próbka miała strój o oktawę
#     obok, instrument grałby co którąś nutę o oktawę nie tam.
# Bez zależności: WAV czytany modułem `wave`, reszta to czysty Python.
import json
import math
import os
import struct
import sys
import wave

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KAT = os.path.join(REPO, "web", "assets", "krzyk")

# Granice z zapasem wobec zmierzonego stanu po poprawce (rozrzut 1,7 dB, stroje 61,4–67,5): test ma łapać
# powrót usterki, a nie piszczeć przy każdym przeliczeniu próbek.
MAKS_ROZRZUT_NUTY = 3.0      # dB, nuta 300 ms
MAKS_ROZRZUT_PETLI = 1.0     # dB, nuta trzymana
ROOT_MIN, ROOT_MAX = 52.0, 76.0
MAKS_ROZPIETOSC_ROOT = 12.0  # półtonów między najniższą a najwyższą próbką

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

_passed = 0
_failed = 0


def check(name, cond, detail=""):
    global _passed, _failed
    if cond:
        _passed += 1
        print("PASS  %s" % name)
    else:
        _failed += 1
        print("FAIL  %s   %s" % (name, detail))


def db(v):
    return 20 * math.log10(max(v, 1e-9))


def rms(d):
    return math.sqrt(sum(v * v for v in d) / len(d)) if d else 0.0


def main():
    man = json.load(open(os.path.join(KAT, "krzyk.json"), encoding="utf-8"))
    sr = man["sr"]
    probki = man["probki"]
    check("manifest: osiem próbek i częstotliwość 32 kHz", len(probki) == 8 and sr == 32000,
          "%d próbek, %d Hz" % (len(probki), sr))

    pliki = sorted(f for f in os.listdir(KAT) if f.endswith(".wav"))
    check("manifest opisuje dokładnie te pliki, które leżą w katalogu",
          sorted(m["plik"] for m in probki) == pliki, "%s vs %s" % (sorted(m["plik"] for m in probki), pliki))

    n300, npetli, roots = [], [], []
    for m in probki:
        sciezka = os.path.join(KAT, m["plik"])
        with wave.open(sciezka, "rb") as w:
            kan, szer, czest, n = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
            d = [v / 32768.0 for v in struct.unpack("<%dh" % n, w.readframes(n))]
        check("%s: PCM16 mono %d Hz" % (m["plik"], sr), kan == 1 and szer == 2 and czest == sr,
              "kanały %d, bajty/próbkę %d, %d Hz" % (kan, szer, czest))

        od, do_ = m["petla"]
        s, e = int(round(od * sr)), int(round(do_ * sr))
        check("%s: pętla mieści się w pliku (przeglądarka nie musi poprawiać `loopEnd`)" % m["plik"],
              0 <= s < e <= n, "pętla %d..%d, plik %d próbek" % (s, e, n))
        s, e = max(0, min(s, n - 1)), max(1, min(e, n))
        check("%s: pętla trwa co najmniej 100 ms (krótsza słychać jako warkot)" % m["plik"],
              (e - s) / sr >= 0.1, "%.0f ms" % ((e - s) * 1000.0 / sr))

        pet = d[s:e]
        npetli.append(db(rms(pet)))
        # nuta 300 ms tak, jak gra ją silnik: od początku próbki, potem pętla w kółko
        ile = int(sr * 0.3)
        buf = d[:min(e, ile)]
        while len(buf) < ile and pet:
            buf.extend(pet[:ile - len(buf)])
        n300.append(db(rms(buf)))

        szczyt = max(abs(v) for v in d)
        check("%s: zapas na szczyt (nic nie jest obcięte)" % m["plik"], szczyt <= 0.985, "szczyt %.3f" % szczyt)
        roots.append(m["root"])

    rozrzut = max(n300) - min(n300)
    check("osiem krzyków gra tak samo głośno na krótkiej nucie (≤ %.1f dB)" % MAKS_ROZRZUT_NUTY,
          rozrzut <= MAKS_ROZRZUT_NUTY, "rozrzut %.1f dB (od %.1f do %.1f dBFS)" % (rozrzut, min(n300), max(n300)))
    rozrzut_p = max(npetli) - min(npetli)
    check("…i tak samo głośno na nucie trzymanej (≤ %.1f dB)" % MAKS_ROZRZUT_PETLI,
          rozrzut_p <= MAKS_ROZRZUT_PETLI, "rozrzut %.1f dB" % rozrzut_p)

    check("stroje w paśmie męskiego krzyku", all(ROOT_MIN <= r <= ROOT_MAX for r in roots), str(roots))
    check("stroje blisko siebie (żadna próbka nie wypada o oktawę obok)",
          max(roots) - min(roots) <= MAKS_ROZPIETOSC_ROOT, "rozpiętość %.2f półtonu" % (max(roots) - min(roots)))
    check("manifest uporządkowany po stroju (gra wybiera próbkę najbliższą nucie)",
          roots == sorted(roots), str(roots))

    glos = open(os.path.join(REPO, "web", "gry", "js", "glos.js"), encoding="utf-8").read()
    check("glos.js przycina `loopEnd` do długości bufora", "Math.min(pet[1],p.buf.duration)" in glos)


if __name__ == "__main__":
    main()
    print("\n%d passed, %d failed" % (_passed, _failed))
    sys.exit(1 if _failed else 0)
