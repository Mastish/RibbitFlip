# Skąd brać gotowe definicje REST API / Where to find ready-made REST API definitions

**[Polski](#polski)** · [English](#english)

---

## Polski

Stan rozpoznania: 2026-08-05, uzupełniony 2026-08-26 (Twitch, OBS Studio). Wniosek naczelny
z researchu: **uniwersalne „miejsce z gotowymi API" dla profilu RibbitFlipa nie istnieje.**
Katalogi specyfikacji pokrywają duże korporacyjne API (często nieaktualne), a typowe cele pucka —
webhooki i urządzenia lokalne — najlepiej obsługują **wbudowane paczki akcji** (karta „Instrukcja
konfiguracji" w każdej z 16 paczek), bo ich wartością jest instrukcja „gdzie kliknąć u dostawcy",
której żadna specyfikacja nie da.

### Katalogi specyfikacji (do własnych poszukiwań)

| Źródło | Co daje | Dostęp | Licencja | Uwagi |
|---|---|---|---|---|
| [APIs.guru](https://apis.guru) | ~2500 specyfikacji OpenAPI | bez klucza, `https://api.apis.guru/v2/list.json` | CC0 | pokrywa ~5 z 22 dostawców istotnych dla RibbitFlipa; Slack i Telegram w wersjach z 2021 |
| [Postman Public API Network](https://www.postman.com/explore) | kolekcje Postman v2.1 | wymaga konta do eksportu | per-kolekcja | największy katalog, ale bez gwarancji jakości |
| [SwaggerHub](https://app.swaggerhub.com/search) | OpenAPI od społeczności | rejestracja | per-projekt | dużo mirrorów nieoficjalnych |
| [public-apis (GitHub)](https://github.com/public-apis/public-apis) | katalog LINKÓW do API | otwarty | MIT (sam katalog) | nie zawiera specyfikacji — tylko drogowskaz |

### Oficjalne specyfikacje dostawców istotnych dla RibbitFlipa

| Dostawca | Specyfikacja | Licencja | Czy warto |
|---|---|---|---|
| Discord | [discord/discord-api-spec](https://github.com/discord/discord-api-spec) (OpenAPI 3.1) | MIT | 242 operacje — do webhooka wystarczy wbudowana paczka |
| Slack | [slackapi/slack-api-specs](https://github.com/slackapi/slack-api-specs) | MIT | nieaktualizowana od 2021 |
| Spotify | [sonallux/spotify-web-api](https://github.com/sonallux/spotify-web-api) (nieoficjalna, generowana z doc) | MIT | sensowna, jeśli budujesz sterowanie odtwarzaczem |
| Gotify | w repozytorium serwera ([gotify/server](https://github.com/gotify/server), `docs/spec.json`) | MIT | tak — self-hosted powiadomienia |
| Home Assistant | brak OpenAPI (REST opisany w [dokumentacji](https://developers.home-assistant.io/docs/api/rest/)) | — | wbudowana paczka wystarcza |
| ntfy / IFTTT / WLED / Shelly / Tasmota / Hue | brak pełnych OpenAPI albo opisują inną część usługi | — | webhook/URL — paczka albo 1 pole adresu |
| Twitch | społecznościowy `twitch-api-swagger` | **brak pliku LICENSE** | ⚠ NIE dołączać do aplikacji — paczka `twitch` napisana RĘCZNIE z [dokumentacji](https://dev.twitch.tv/docs/api/reference) |
| OBS Studio | to nie jest REST: [obs-websocket 5](https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md) (WebSocket + JSON) | GPL-2.0 (dokumentacja protokołu) | tak — z tego opisu powstał klient `ObsClient` i paczka `obs`; nazwy żądań czytane z `protocol.md`, nie z cudzego kodu |

### Zasady bezpieczeństwa (obowiązują niezależnie od źródła)

1. **RibbitFlip nie pobiera definicji z sieci** — offline-first (`connect-src 'self'`); adres
   specyfikacji byłby wektorem SSRF do Twojej sieci lokalnej. Import wyłącznie z pliku,
   przez modal z analizą ryzyka (obcy host, nagłówki autoryzacji, `{{secret.*}}`, `{{var.*}}`).
2. Paczka akcji **nigdy nie niesie poświadczeń** — sejf i `credId` konfigurowany po imporcie.
3. Poświadczenie z sejfu jest **zakresowane do hosta adresu bazowego API** — akcja
   prowadząca na inny host wysyła się bez niego (z ostrzeżeniem).
4. Specyfikację obcego autorstwa traktuj jak każdy plik z internetu: przeczytaj ostrzeżenia
   modalu importu; decyzja należy do Ciebie.

### Dlaczego nie ma wbudowanego importera OpenAPI (na dziś)

Rozważony i odłożony (decyzja z 2026-08-05): 3–5 dni pracy, a odblokowuje wyłącznie API
firmowe/własne z plikiem OpenAPI — których w żadnym katalogu i tak nie ma. Trzy z czterech
najpopularniejszych specyfikacji (Discord 1,18 MB, Slack 1,24 MB) przekraczają limit paczki
1 MB, mają tysiące `$ref` i wymagałyby kreatora wyboru operacji. Gdy scenariusz „mam własne
API z OpenAPI" stanie się realny — punkt zaczepienia: `restPackFromOpenApi(spec, selection)`
zwracająca obiekt w formacie paczki (dalsza ścieżka — modal, analiza, merge — już istnieje).

---

## English

Research as of 2026-08-05, extended on 2026-08-26 (Twitch, OBS Studio). The main finding: **there
is no universal "place with ready-made APIs" that fits what RibbitFlip does.** Specification
catalogues cover large corporate APIs (often out of date), while the puck's typical targets,
webhooks and local devices, are best served by the **built-in action packs** (the "Instrukcja
konfiguracji" card in each of the 16 packs). Their value is the "where to click at the provider"
walkthrough, which no specification can give you.

### Specification catalogues (for your own searching)

| Source | What it gives you | Access | Licence | Notes |
|---|---|---|---|---|
| [APIs.guru](https://apis.guru) | ~2500 OpenAPI specifications | no key, `https://api.apis.guru/v2/list.json` | CC0 | covers ~5 of the 22 providers that matter for RibbitFlip; Slack and Telegram in 2021 versions |
| [Postman Public API Network](https://www.postman.com/explore) | Postman v2.1 collections | an account is needed to export | per collection | the largest catalogue, but no quality guarantee |
| [SwaggerHub](https://app.swaggerhub.com/search) | community OpenAPI | sign-up | per project | many unofficial mirrors |
| [public-apis (GitHub)](https://github.com/public-apis/public-apis) | a catalogue of LINKS to APIs | open | MIT (the catalogue itself) | holds no specifications, it only points the way |

### Official specifications from providers that matter for RibbitFlip

| Provider | Specification | Licence | Worth it? |
|---|---|---|---|
| Discord | [discord/discord-api-spec](https://github.com/discord/discord-api-spec) (OpenAPI 3.1) | MIT | 242 operations; for a webhook the built-in pack is enough |
| Slack | [slackapi/slack-api-specs](https://github.com/slackapi/slack-api-specs) | MIT | not updated since 2021 |
| Spotify | [sonallux/spotify-web-api](https://github.com/sonallux/spotify-web-api) (unofficial, generated from the docs) | MIT | sensible if you are building player controls |
| Gotify | in the server repository ([gotify/server](https://github.com/gotify/server), `docs/spec.json`) | MIT | yes, self-hosted notifications |
| Home Assistant | no OpenAPI (REST described in the [documentation](https://developers.home-assistant.io/docs/api/rest/)) | — | the built-in pack is enough |
| ntfy / IFTTT / WLED / Shelly / Tasmota / Hue | no full OpenAPI, or it describes a different part of the service | — | webhook/URL: a pack or a single address field |
| Twitch | community `twitch-api-swagger` | **no LICENSE file** | ⚠ do NOT bundle with the app; the `twitch` pack was written BY HAND from the [documentation](https://dev.twitch.tv/docs/api/reference) |
| OBS Studio | not REST: [obs-websocket 5](https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md) (WebSocket + JSON) | GPL-2.0 (protocol documentation) | yes; the `ObsClient` client and the `obs` pack were built from this description, with request names read from `protocol.md`, not from someone else's code |

### Security rules (they apply whatever the source)

1. **RibbitFlip does not download definitions from the network.** It is offline-first
   (`connect-src 'self'`); a specification URL would be an SSRF vector into your local network.
   Import only from a file, through the dialog with its risk analysis (foreign host,
   authorisation headers, `{{secret.*}}`, `{{var.*}}`).
2. An action pack **never carries credentials**. The vault and `credId` are set up after import.
3. A credential from the vault is **scoped to the host of the API base URL**. An action that
   points at a different host is sent without it (with a warning).
4. Treat a specification written by someone else like any file from the internet: read the
   import dialog's warnings; the decision is yours.

### Why there is no built-in OpenAPI importer (for now)

Considered and postponed (decision of 2026-08-05): 3–5 days of work, and it would only unlock
company or in-house APIs that come with an OpenAPI file, which are not in any catalogue anyway.
Three of the four most popular specifications (Discord 1.18 MB, Slack 1.24 MB) exceed the 1 MB
pack limit, contain thousands of `$ref`s and would need a wizard for choosing operations. When the
"I have my own API with OpenAPI" scenario becomes real, the starting point is
`restPackFromOpenApi(spec, selection)`, returning an object in the pack format (the rest of the
path, i.e. the dialog, analysis and merge, already exists).
