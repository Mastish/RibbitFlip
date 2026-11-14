# Próbki instrumentu „tuba” (RibbitBeat)

Pliki `tuba-N.wav` (PCM16 mono 22050 Hz) i opis stref w `tuba.json` (`nuta` = nuta nominalna nagrania, `root` = zmierzony strój jako półton MIDI, `petla` = zapętlony odcinek w sekundach; `strefy: true` = gra najbliższą próbkę).

**Źródło: VSCO 2 Community Edition** (Versilian Studios LLC (Sam Gossner)), https://github.com/sgossner/VSCO-2-CE, katalog `Brass/Tuba/sus`, licencja **CC0-1.0** (kopia: `third_party_licenses/vsco2-ce-LICENSE.txt`).

| plik w grze | nagranie źródłowe | nuta |
| --- | --- | --- |
| `tuba-1.wav` | [`Tuba3_sus_A#0_v2_rr1_Mid.wav`](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/Brass/Tuba/sus/Tuba3_sus_A%230_v2_rr1_Mid.wav) | 34 |
| `tuba-2.wav` | [`Tuba3_sus_F1_v2_rr1_Mid.wav`](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/Brass/Tuba/sus/Tuba3_sus_F1_v2_rr1_Mid.wav) | 41 |
| `tuba-3.wav` | [`Tuba3_sus_D2_v2_rr1_Mid.wav`](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/Brass/Tuba/sus/Tuba3_sus_D2_v2_rr1_Mid.wav) | 50 |

Nagrania zostały zmienione: mono, przepróbkowane do 22050 Hz, przycięte do ok. 1–2 s (atak + odcinek pętli), z zapętlonym odcinkiem zszytym na końcu z początkiem (równa moc, 40 ms) i wyrównaną głośnością pętli (-18 dBFS). Skrypt: `tools/ribbitbeat_probki_instrumentow.py --zbuduj`.
