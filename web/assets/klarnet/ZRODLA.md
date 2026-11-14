# Próbki instrumentu „klarnet” (RibbitBeat)

Pliki `klarnet-N.wav` (PCM16 mono 22050 Hz) i opis stref w `klarnet.json` (`nuta` = nuta nominalna nagrania, `root` = zmierzony strój jako półton MIDI, `petla` = zapętlony odcinek w sekundach; `strefy: true` = gra najbliższą próbkę).

**Źródło: VSCO 2 Community Edition** (Versilian Studios LLC (Sam Gossner)), https://github.com/sgossner/VSCO-2-CE, katalog `Woodwinds/Clarinet/susLong`, licencja **CC0-1.0** (kopia: `third_party_licenses/vsco2-ce-LICENSE.txt`).

| plik w grze | nagranie źródłowe | nuta |
| --- | --- | --- |
| `klarnet-1.wav` | [`DCClar_susLong_D3_v2_rr1_sum.wav`](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/Woodwinds/Clarinet/susLong/DCClar_susLong_D3_v2_rr1_sum.wav) | 62 |
| `klarnet-2.wav` | [`DCClar_susLong_A#3_v2_rr1_sum.wav`](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/Woodwinds/Clarinet/susLong/DCClar_susLong_A%233_v2_rr1_sum.wav) | 70 |
| `klarnet-3.wav` | [`DCClar_susLong_F4_v2_rr1_sum.wav`](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/Woodwinds/Clarinet/susLong/DCClar_susLong_F4_v2_rr1_sum.wav) | 77 |

Nagrania zostały zmienione: mono, przepróbkowane do 22050 Hz, przycięte do ok. 1–2 s (atak + odcinek pętli), z zapętlonym odcinkiem zszytym na końcu z początkiem (równa moc, 40 ms) i wyrównaną głośnością pętli (-18 dBFS). Skrypt: `tools/ribbitbeat_probki_instrumentow.py --zbuduj`.
