# Próbki instrumentu „puzon” (RibbitBeat)

Pliki `puzon-N.wav` (PCM16 mono 22050 Hz) i opis stref w `puzon.json` (`nuta` = nuta nominalna nagrania, `root` = zmierzony strój jako półton MIDI, `petla` = zapętlony odcinek w sekundach; `strefy: true` = gra najbliższą próbkę).

**Źródło: VSCO 2 Community Edition** (Versilian Studios LLC (Sam Gossner)), https://github.com/sgossner/VSCO-2-CE, katalog `Brass/Tenor Trombone/sus`, licencja **CC0-1.0** (kopia: `third_party_licenses/vsco2-ce-LICENSE.txt`).

| plik w grze | nagranie źródłowe | nuta |
| --- | --- | --- |
| `puzon-1.wav` | [`tenortbn_sus_F2_v2_1.wav`](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/Brass/Tenor%20Trombone/sus/tenortbn_sus_F2_v2_1.wav) | 53 |
| `puzon-2.wav` | [`tenortbn_sus_C3_v2_1.wav`](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/Brass/Tenor%20Trombone/sus/tenortbn_sus_C3_v2_1.wav) | 60 |
| `puzon-3.wav` | [`tenortbn_sus_F3_v2_1.wav`](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/Brass/Tenor%20Trombone/sus/tenortbn_sus_F3_v2_1.wav) | 65 |

Nagrania zostały zmienione: mono, przepróbkowane do 22050 Hz, przycięte do ok. 1–2 s (atak + odcinek pętli), z zapętlonym odcinkiem zszytym na końcu z początkiem (równa moc, 40 ms) i wyrównaną głośnością pętli (-18 dBFS). Skrypt: `tools/ribbitbeat_probki_instrumentow.py --zbuduj`.
