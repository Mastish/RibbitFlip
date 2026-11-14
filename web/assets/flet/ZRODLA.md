# Próbki instrumentu „flet” (RibbitBeat)

Pliki `flet-N.wav` (PCM16 mono 22050 Hz) i opis stref w `flet.json` (`nuta` = nuta nominalna nagrania, `root` = zmierzony strój jako półton MIDI, `petla` = zapętlony odcinek w sekundach; `strefy: true` = gra najbliższą próbkę).

**Źródło: VSCO 2 Community Edition** (Versilian Studios LLC (Sam Gossner)), https://github.com/sgossner/VSCO-2-CE, katalog `Woodwinds/Flute/susNV`, licencja **CC0-1.0** (kopia: `third_party_licenses/vsco2-ce-LICENSE.txt`).

| plik w grze | nagranie źródłowe | nuta |
| --- | --- | --- |
| `flet-1.wav` | [`LDFlute_susNV_A3_v3_1.wav`](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/Woodwinds/Flute/susNV/LDFlute_susNV_A3_v3_1.wav) | 69 |
| `flet-2.wav` | [`LDFlute_susNV_E4_v3_1.wav`](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/Woodwinds/Flute/susNV/LDFlute_susNV_E4_v3_1.wav) | 76 |
| `flet-3.wav` | [`LDFlute_susNV_C5_v2_1.wav`](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/Woodwinds/Flute/susNV/LDFlute_susNV_C5_v2_1.wav) | 84 |

Nagrania zostały zmienione: mono, przepróbkowane do 22050 Hz, przycięte do ok. 1–2 s (atak + odcinek pętli), z zapętlonym odcinkiem zszytym na końcu z początkiem (równa moc, 40 ms) i wyrównaną głośnością pętli (-18 dBFS). Skrypt: `tools/ribbitbeat_probki_instrumentow.py --zbuduj`.
