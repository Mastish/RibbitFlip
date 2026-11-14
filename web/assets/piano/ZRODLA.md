# Próbki instrumentu „piano” (RibbitBeat)

Pliki `piano-N.wav` (PCM16 mono 22050 Hz) i opis stref w `piano.json` (`nuta` = nuta nominalna nagrania, `root` = zmierzony strój jako półton MIDI, `petla` = zapętlony odcinek w sekundach; `strefy: true` = gra najbliższą próbkę).

**Źródło: VSCO 2 Community Edition** (Versilian Studios LLC (Sam Gossner)), https://github.com/sgossner/VSCO-2-CE, katalog `Keys/Upright Nr1`, licencja **CC0-1.0** (kopia: `third_party_licenses/vsco2-ce-LICENSE.txt`).

| plik w grze | nagranie źródłowe | nuta |
| --- | --- | --- |
| `piano-1.wav` | [`UR1_C3_mf_RR1.wav`](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/Keys/Upright%20Nr1/UR1_C3_mf_RR1.wav) | 60 |
| `piano-2.wav` | [`UR1_G3_mf_RR1.wav`](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/Keys/Upright%20Nr1/UR1_G3_mf_RR1.wav) | 67 |
| `piano-3.wav` | [`UR1_C4_mf_RR1.wav`](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/Keys/Upright%20Nr1/UR1_C4_mf_RR1.wav) | 72 |
| `piano-4.wav` | [`UR1_G4_mf_RR1.wav`](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/Keys/Upright%20Nr1/UR1_G4_mf_RR1.wav) | 79 |

Nagrania zostały zmienione: mono, przepróbkowane do 22050 Hz, przycięte do ok. 1–2 s (atak + odcinek pętli), z zapętlonym odcinkiem zszytym na końcu z początkiem (równa moc, 120 ms) i wyrównaną głośnością pętli (-20 dBFS). Skrypt: `tools/ribbitbeat_probki_instrumentow.py --zbuduj`.
