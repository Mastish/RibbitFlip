# Próbki instrumentu „wiolonczela” (RibbitBeat)

Pliki `wiolonczela-N.wav` (PCM16 mono 22050 Hz) i opis stref w `wiolonczela.json` (`nuta` = nuta nominalna nagrania, `root` = zmierzony strój jako półton MIDI, `petla` = zapętlony odcinek w sekundach; `strefy: true` = gra najbliższą próbkę).

**Źródło: VSCO 2 Community Edition** (Versilian Studios LLC (Sam Gossner)), https://github.com/sgossner/VSCO-2-CE, katalog `Strings/Cello Section/susvib`, licencja **CC0-1.0** (kopia: `third_party_licenses/vsco2-ce-LICENSE.txt`).

| plik w grze | nagranie źródłowe | nuta |
| --- | --- | --- |
| `wiolonczela-1.wav` | [`susvib_D2_v3_1.wav`](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/Strings/Cello%20Section/susvib/susvib_D2_v3_1.wav) | 50 |
| `wiolonczela-2.wav` | [`susvib_A2_v3_1.wav`](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/Strings/Cello%20Section/susvib/susvib_A2_v3_1.wav) | 57 |
| `wiolonczela-3.wav` | [`susvib_E3_v3_1.wav`](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/Strings/Cello%20Section/susvib/susvib_E3_v3_1.wav) | 64 |

Nagrania zostały zmienione: mono, przepróbkowane do 22050 Hz, przycięte do ok. 1–2 s (atak + odcinek pętli), z zapętlonym odcinkiem zszytym na końcu z początkiem (równa moc, 80 ms) i wyrównaną głośnością pętli (-18 dBFS). Skrypt: `tools/ribbitbeat_probki_instrumentow.py --zbuduj`.
