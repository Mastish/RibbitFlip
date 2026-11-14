# Próbki instrumentu „Krzyk” (RibbitBeat)

Osiem krótkich krzyków (`krzyk-1.wav` … `krzyk-8.wav`, PCM 16 bit mono, 32 000 Hz) i opis pętli w `krzyk.json`
(`root` = strój próbki jako półton MIDI, `petla` = początek i koniec zapętlonego odcinka w sekundach).

**Źródło: paczka „Aargh! (male screams)” z OpenGameArt**, https://opengameart.org/content/aargh-male-screams (`aargh.zip`, 8 plików OGG).
Autorzy i licencje: **Helmut Scream** (creativeheroes, http://freesound.org/people/creativeheroes/sounds/84353/, CC BY 3.0),
**Male_Thijs_loud_scream** (thanvannispen, http://freesound.org/people/thanvannispen/sounds/9432/, CC BY 3.0) i
**human male scream multi** (JohnsonBrandEditing, http://freesound.org/people/JohnsonBrandEditing/sounds/173944/, CC0 1.0).
Licencja CC BY 3.0: https://creativecommons.org/licenses/by/3.0/. Pełny opis: `third_party_licenses/README.md` i `docs/CREDITS.md`.
Nagrania zostały zmienione: przycięte, zmniejszone do 32 kHz mono, wyrównane głośnościowo, z odcinkiem pętli (do 260 ms) i
zszyciem końca z początkiem. Przetwarzanie: `tools/ribbitbeat_krzyk_probki.py --zip ŚCIEŻKA\aargh.zip` (odcinki ustabilizowane
wybrane ręcznie po spektrogramach, tabela `ODCINKI` w skrypcie).

Wyrównanie głośności obejmuje **i pętlę, i atak** (2026-10-21). Do 10-20 równana była tylko pętla (wszystkie do −18 dBFS),
a atak zostawał taki, jaki wyszedł z nagrania — a że gra sięga po ósemkę na zmianę, instrument skakał na głośności z nuty
na nutę (10,8 dB rozrzutu na nucie 300 ms). Teraz atak dostaje wspólny poziom (średnia geometryczna dotychczasowych),
z płynnym przejściem do głośności pętli przed strefą zszycia. Gotowe próbki wyrównuje
`tools/ribbitbeat_krzyk_probki.py --wyrownaj` — nie potrzebuje paczki źródłowej, robi to samo, co pełne przeliczenie,
i jest idempotentny. Gra (`js/glos.js`, receptura `krzyk`) gra próbkę od początku,
zapętla jej odcinek, dopóki trzymasz nutę, i zmienia szybkość odtwarzania do wysokości nuty (pitch shift razem z formantami).

Wcześniejsza wersja Krzyku (własna synteza formantowa) brzmiała nienaturalnie i została zastąpiona; kopia w `_backups/261019-krzyk-kukielki/synteza/`.
