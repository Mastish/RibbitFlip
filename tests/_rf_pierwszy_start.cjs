// WSPÓLNY POMOCNIK HARNESSÓW: panel bez „pierwszego uruchomienia”.
//
// Harness otwiera panel w czystej przeglądarce, a czysta przeglądarka to dla panelu pierwszy start:
// czaszka pyta „Do czego chcesz używać RibbitFlipa?” (rf-48b) i zaprasza do przewodnika (rf-39p).
// Oba bąble stoją w rogu, zasłaniają zrzuty i przechwytują kliknięcia, a pytanie po odpowiedzi
// chowałoby moduły pod „Więcej modułów”. Pomocnik udaje osobę, która już odpowiedziała: ustawia
// `ribbitflip.firstAsk` i `ribbitflip.tourOffered` przed wczytaniem strony. Nic nie trafia do serwera.
//
// Użycie (kontekst albo strona, także jako obietnica):
//   const { rfBezPierwszegoStartu } = require("./_rf_pierwszy_start.cjs");          // .cjs
//   const { rfBezPierwszegoStartu } = wymagaj("./_rf_pierwszy_start.cjs");          // .mjs z createRequire
//   const ctx = await rfBezPierwszegoStartu(browser.newContext({ viewport }));
"use strict";
function rfPierwszyStartInit() {
  try {
    localStorage.setItem("ribbitflip.firstAsk", "juz");
    localStorage.setItem("ribbitflip.tourOffered", "1");
  } catch (e) { /* strona bez localStorage (about:blank) */ }
}
async function rfBezPierwszegoStartu(target) {
  const t = await target;
  await t.addInitScript(rfPierwszyStartInit);
  return t;
}
module.exports = { rfBezPierwszegoStartu, rfPierwszyStartInit };
