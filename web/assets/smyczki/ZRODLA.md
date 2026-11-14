# Próbki instrumentu „smyczki” (RibbitBeat)

Pliki `smyczki-N.wav` (PCM16 mono 22050 Hz) i opis stref w `smyczki.json` (`nuta` = nuta nominalna nagrania, `root` = zmierzony strój jako półton MIDI, `petla` = zapętlony odcinek w sekundach; `strefy: true` = gra najbliższą próbkę).

**Źródło: VSCO 2 Community Edition** (Versilian Studios LLC (Sam Gossner)), https://github.com/sgossner/VSCO-2-CE, katalog `Strings/Violin Section/susVib`, licencja **CC0-1.0** (kopia: `third_party_licenses/vsco2-ce-LICENSE.txt`).

| plik w grze | nagranie źródłowe | nuta |
| --- | --- | --- |
| `smyczki-1.wav` | [`VlnEns_susVib_B2_v2.wav`](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/Strings/Violin%20Section/susVib/VlnEns_susVib_B2_v2.wav) | 59 |
| `smyczki-2.wav` | [`VlnEns_susVib_A3_v2.wav`](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/Strings/Violin%20Section/susVib/VlnEns_susVib_A3_v2.wav) | 69 |
| `smyczki-3.wav` | [`VlnEns_susVib_G4_v2.wav`](https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/Strings/Violin%20Section/susVib/VlnEns_susVib_G4_v2.wav) | 79 |

Nagrania zostały zmienione: mono, przepróbkowane do 22050 Hz, przycięte do ok. 1–2 s (atak + odcinek pętli), z zapętlonym odcinkiem zszytym na końcu z początkiem (równa moc, 80 ms) i wyrównaną głośnością pętli (-18 dBFS). Skrypt: `tools/ribbitbeat_probki_instrumentow.py --zbuduj`.
