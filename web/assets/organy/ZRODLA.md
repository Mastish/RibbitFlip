# Próbki instrumentu „organy” (RibbitBeat)

Pliki `organy-N.wav` (PCM16 mono 22050 Hz) i opis stref w `organy.json` (`nuta` = nuta nominalna nagrania, `root` = zmierzony strój jako półton MIDI, `petla` = zapętlony odcinek w sekundach; `strefy: true` = gra najbliższą próbkę).

**Źródło: VSCO 2 Community Edition** (Versilian Studios LLC (Sam Gossner)), https://github.com/sgossner/VSCO-2-CE, katalog `Keys/Organ/Loud`, licencja **CC0-1.0** (kopia: `third_party_licenses/vsco2-ce-LICENSE.txt`).

| plik w grze | nagranie źródłowe | nuta |
| --- | --- | --- |
| `organy-1.wav` | [`Rode_Man3Open_25.wav`](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/Keys/Organ/Loud/Rode_Man3Open_25.wav) | 60 |
| `organy-2.wav` | [`Rode_Man3Open_34.wav`](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/Keys/Organ/Loud/Rode_Man3Open_34.wav) | 69 |
| `organy-3.wav` | [`Rode_Man3Open_43.wav`](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/Keys/Organ/Loud/Rode_Man3Open_43.wav) | 78 |

Nagrania zostały zmienione: mono, przepróbkowane do 22050 Hz, przycięte do ok. 1–2 s (atak + odcinek pętli), z zapętlonym odcinkiem zszytym na końcu z początkiem (równa moc, 40 ms) i wyrównaną głośnością pętli (-18 dBFS). Skrypt: `tools/ribbitbeat_probki_instrumentow.py --zbuduj`.
