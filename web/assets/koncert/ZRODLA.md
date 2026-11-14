# Grafiki sceny koncertowej menu RibbitBeat

Używa ich `web/gry/js/menu-koncert.js` (styl: `web/gry/gry-menu-koncert.css`).

| Plik | Co to | Źródło |
| --- | --- | --- |
| `scena.webp` | tło sceny: kurtyny, kratownica, kabel z oprawkami, ceglana ściana, podłoga | `stage-clean.png` z podglądu Codexa (1672×941) |
| `kolumna.webp` | kolumna z filcu ze wzmacniaczem, pusty front | `cabinet.png` (Codex), zmniejszone do 768 px szerokości |
| `membrana.webp` | membrana głośnika | `membrane.png` (Codex), 420 px |
| `lampa.webp` | filcowa żarówka z oprawką i przewodem | `lamp.png` (Codex), 200 px |
| `lampki-wczytywanie.webp` | ta sama żarówka w trzech kolorach obok siebie (róż, bursztyn, zieleń), 600×197; girlanda ekranu wczytywania (`web/gry/index.html`) | `lampa.webp` przebarwiona skryptem `tools/ribbitbeat_lampki_wczytywanie.py` |

Wszystkie cztery wygenerował 2026-10-18 wbudowany generator obrazów Codexa na podstawie wcześniejszej sceny
`scena-dark.webp` (prompty w `GENERATED-ASSETS.md` podglądu Codexa „koncert”). Bez zdjęć, logotypów i cudzych
materiałów. PNG z kanałem alfa przekonwertowane do WebP (jakość 84) skryptem Pillow, bez zmian treści.

Punkty zawieszenia lamp w `menu-koncert.js` (`LAMPY_SZEROKO`, `LAMPY_WASKO`) są w pikselach `scena.webp`
(1672×941). Po podmianie tła trzeba je odczytać na nowo.

## Muzyka menu

| Plik | Co to | Źródło |
| --- | --- | --- |
| `dub-riot.mid` | „Dub Riot”, 128 BPM, 16 taktów = 30 s, 6 ścieżek GM (bas, chopy, power chordy, riff, dubowe echo, perkusja) | utwór autora projektu z 2026-10-19 (`Dub_Riot_30s_128BPM.mid`), skopiowany bez zmian |

Plik audio nie istnieje: `menu-koncert.js` czyta MIDI (`czytajMidi`) i renderuje go w tle syntezą (`renderUtworu`,
48 kHz). Gdy MIDI się nie wczyta, gra zapasowy syntezowany loop 96 BPM (`zbudujBufor`).
