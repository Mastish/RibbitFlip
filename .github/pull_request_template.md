<!--
PL: Dzięki za pull request! Zasady są w .github/CONTRIBUTING.md. Pisz po polsku albo po angielsku.
EN: Thanks for the pull request! The rules are in .github/CONTRIBUTING.md. Write in Polish or English.
-->

## Co zmienia ten PR / What this PR changes

<!-- PL: jedno, dwa zdania; jedna zmiana na PR. EN: one or two sentences; one change per PR. -->

Powiązane zgłoszenie / Related issue: #

## Jak to sprawdzić / How to check it

<!-- PL: kroki w panelu albo w grze, sprzęt czy --simulate. EN: steps in the panel or the game, hardware or --simulate. -->

## Lista kontrolna / Checklist

- [ ] `py -m py_compile ribbitflip_monitor.py ribbitflip_audio.py ribbitflip_mcp.py`
- [ ] `for f in web/js/*.js; do node --check "$f"; done`
- [ ] Cały folder `tests/` przechodzi / The whole `tests/` folder passes
- [ ] Panel z `--simulate` ładuje się bez błędów w konsoli / The panel with `--simulate` loads with no console errors
- [ ] Zmiana widoczna dla użytkownika ma jeden wpis w `CHANGELOG.md` pod `## [Unreleased]` / A user-visible change has one line in `CHANGELOG.md` under `## [Unreleased]`
- [ ] Dokumentacja poprawiona w obu językach / Documentation updated in both languages
- [ ] Nowa trasa zmieniająca stan jest w `do_POST`; zmiany `STATIC_DIRS`, `STATIC_TYPES`, `DIAG_GLOBAL_FILES` przejrzane drugi raz / A new state-changing route is in `do_POST`; changes to `STATIC_DIRS`, `STATIC_TYPES`, `DIAG_GLOBAL_FILES` reviewed twice
- [ ] Bez grafik chronionych znakami towarowymi / No trademarked assets
- [ ] Zmiana w interfejsie nie pogarsza dostępności (kontrast, ograniczony ruch, etykiety) / A UI change does not make accessibility worse (contrast, reduced motion, labels)
