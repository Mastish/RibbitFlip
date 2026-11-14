# Próbki instrumentu „trabka” (RibbitBeat)

Pliki `trabka-N.wav` (PCM16 mono 22050 Hz) i opis stref w `trabka.json` (`nuta` = nuta nominalna nagrania, `root` = zmierzony strój jako półton MIDI, `petla` = zapętlony odcinek w sekundach; `strefy: true` = gra najbliższą próbkę).

**Źródło: VSCO 2 Community Edition** (Versilian Studios LLC (Sam Gossner)), https://github.com/sgossner/VSCO-2-CE, katalog `Brass/Trumpet/sus`, licencja **CC0-1.0** (kopia: `third_party_licenses/vsco2-ce-LICENSE.txt`).

| plik w grze | nagranie źródłowe | nuta |
| --- | --- | --- |
| `trabka-1.wav` | [`Sum_SHTrumpet_sus_C3_v3_rr1.wav`](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/Brass/Trumpet/sus/Sum_SHTrumpet_sus_C3_v3_rr1.wav) | 60 |
| `trabka-2.wav` | [`Sum_SHTrumpet_sus_G3_v3_rr1.wav`](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/Brass/Trumpet/sus/Sum_SHTrumpet_sus_G3_v3_rr1.wav) | 67 |
| `trabka-3.wav` | [`Sum_SHTrumpet_sus_D4_v3_rr1.wav`](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/Brass/Trumpet/sus/Sum_SHTrumpet_sus_D4_v3_rr1.wav) | 74 |

Nagrania zostały zmienione: mono, przepróbkowane do 22050 Hz, przycięte do ok. 1–2 s (atak + odcinek pętli), z zapętlonym odcinkiem zszytym na końcu z początkiem (równa moc, 40 ms) i wyrównaną głośnością pętli (-18 dBFS). Skrypt: `tools/ribbitbeat_probki_instrumentow.py --zbuduj`.
