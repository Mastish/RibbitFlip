/* SKANER — RADAR NA SUCHO, BEZ PRZEGLĄDARKI (2026-09-22).

   Po co ten plik istnieje: drugi etap radaru (wybór ODLEGŁOŚCI) wołał `trojkat(u)` — funkcję,
   której nie ma w całym projekcie. Każda klatka rzucała więc `ReferenceError`, scena przestawała
   się rysować, kropka nigdy się nie pokazywała, a sygnał wyboru odległości wywracał się, zanim
   doszedł do kliknięcia. Błąd wyszedł w ręcznym użyciu („radar nie pokazuje kropki"), nie w teście — bo testy
   skanera sprawdzały serwer i wygląd, a silnik w trybie radaru nie był uruchamiany NIGDZIE.

   Model daje się wczytać w Node (`module.exports` na końcu rf-50-scan-model.js) i niczego nie
   potrzebuje od DOM-u — więc radar da się przejechać od startu do kliknięcia w kilkunastu liniach.

   Uruchomienie: `node tests/scan_radar_harness.cjs` (odpala go też `tests/test_scan_wyzwalacze.py`).
*/
const path = require('path');
const RFScan = require(path.join(__dirname, '..', 'web', 'js', 'rf-50-scan-model.js'));

let ok = 0, zle = 0;
function sprawdz(nazwa, warunek, dodatek) {
  if (warunek) { ok++; console.log('  OK   ' + nazwa); }
  else { zle++; console.log('  ZLE  ' + nazwa + (dodatek !== undefined ? '  -> ' + JSON.stringify(dodatek) : '')); }
}

const EKRAN = { x: 0, y: 0, w: 1600, h: 900 };

function silnik(nadpisz) {
  const u = Object.assign({}, RFScan.DOMYSLNE, { tryb: 'radar', opoznienieStartu: 0 }, nadpisz || {});
  const zdarzenia = [];
  const s = new RFScan.Silnik({
    ustawienia: u, ekran: EKRAN, cele: [],
    naZdarzenie: function (rodzaj, dane) { zdarzenia.push([rodzaj, dane]); }
  });
  return { s: s, u: u, zdarzenia: zdarzenia };
}

// --- 1. Etap kierunku: promień się kręci, kropki jeszcze nie ma -------------------------------
console.log('- radar: etap kierunku');
{
  const { s } = silnik();
  let t = 1000, blad = null, katy = [];
  s.sygnal(t, true); s.puszczenie(t + 1);          // pierwszy sygnał rusza przejazd
  for (let i = 0; i < 40; i++) {
    t += 16;
    try { const st = s.krok(t); if (st.radar) katy.push(st.radar.kat); } catch (e) { blad = String(e); break; }
  }
  sprawdz('ani jednego wyjątku', blad === null, blad);
  sprawdz('promień ma stan przez cały czas', katy.length > 30, katy.length);
  sprawdz('kąt rośnie (promień się kręci)', katy[katy.length - 1] > katy[0], [katy[0], katy[katy.length - 1]]);
  sprawdz('w etapie kierunku nie ma jeszcze kropki', s.krok(t).radar.r === null);
}

// --- 2. Etap odległości: TO TU BYŁ WYJĄTEK ----------------------------------------------------
console.log('- radar: etap odleglosci (tu byl ReferenceError)');
{
  const { s } = silnik({ kierunek: 'wahadlo', predkoscPromienia: 600, pauzaNaKrancach: 0 });
  let t = 1000, blad = null;
  s.sygnal(t, true); s.puszczenie(t + 1);
  for (let i = 0; i < 30; i++) { t += 16; s.krok(t); }
  s.sygnal(t, true); s.puszczenie(t + 1);          // wybór kierunku → etap odległości
  const promienie = [];
  for (let i = 0; i < 120; i++) {
    t += 16;
    try { const st = s.krok(t); if (st.radar) promienie.push(st.radar.r); } catch (e) { blad = String(e); break; }
  }
  sprawdz('ani jednego wyjątku', blad === null, blad);
  sprawdz('kropka MA promień (to ona jest wyborem odległości)',
    promienie.length > 100 && promienie.every(function (r) { return typeof r === 'number' && isFinite(r); }),
    promienie.slice(0, 3));
  sprawdz('promień zaczyna od środka', promienie[0] < 40, promienie[0]);
  sprawdz('promień rośnie', Math.max.apply(null, promienie) > 200, Math.max.apply(null, promienie));
  const maxR = Math.sqrt(EKRAN.w * EKRAN.w + EKRAN.h * EKRAN.h) / 2;
  sprawdz('promień nie wychodzi poza obszar', Math.max.apply(null, promienie) <= maxR + 1, [Math.max.apply(null, promienie), maxR]);
  // ZAWRACANIE: to była cała treść brakującej funkcji — przy `wahadlo` kropka ma wrócić do środka.
  const szczyt = promienie.indexOf(Math.max.apply(null, promienie));
  sprawdz('przy zawracaniu kropka wraca do środka',
    szczyt < promienie.length - 5 && promienie[promienie.length - 1] < Math.max.apply(null, promienie) * 0.9,
    [szczyt, promienie.length, promienie[promienie.length - 1]]);
}

// --- 3. Drugi sygnał kończy się AKCJĄ, a punkt leży w obszarze ---------------------------------
console.log('- radar: sygnal odleglosci konczy sie klikiem');
{
  const { s, zdarzenia } = silnik({ kierunek: 'jeden', predkoscPromienia: 600, dociaganie: 0 });
  let t = 1000, blad = null;
  s.sygnal(t, true); s.puszczenie(t + 1);
  for (let i = 0; i < 30; i++) { t += 16; s.krok(t); }
  s.sygnal(t, true); s.puszczenie(t + 1);
  for (let i = 0; i < 40; i++) { t += 16; s.krok(t); }
  try { s.sygnal(t, true); s.puszczenie(t + 1); } catch (e) { blad = String(e); }
  sprawdz('sygnał odległości nie rzuca', blad === null, blad);
  const akcja = zdarzenia.filter(function (z) { return z[0] === 'akcja'; })[0];
  sprawdz('padła akcja', !!akcja, zdarzenia.map(function (z) { return z[0]; }));
  if (akcja) {
    const p = akcja[1].punkt;
    sprawdz('punkt jest liczbą', typeof p.x === 'number' && isFinite(p.x) && typeof p.y === 'number' && isFinite(p.y), p);
    sprawdz('punkt leży w obszarze',
      p.x >= EKRAN.x - 1 && p.x <= EKRAN.x + EKRAN.w + 1 && p.y >= EKRAN.y - 1 && p.y <= EKRAN.y + EKRAN.h + 1, p);
  }
}

// --- 4. Postój na krańcu, którego radar nigdy nie miał ----------------------------------------
console.log('- radar: postoj na krancu (z przelot, tak jak pasek)');
{
  const { s } = silnik({ kierunek: 'wahadlo', predkoscPromienia: 4000, pauzaNaKrancach: 400 });
  let t = 1000;
  s.sygnal(t, true); s.puszczenie(t + 1);
  for (let i = 0; i < 20; i++) { t += 16; s.krok(t); }
  s.sygnal(t, true); s.puszczenie(t + 1);
  let stoiKiedys = false;
  for (let i = 0; i < 120; i++) { t += 16; const st = s.krok(t); if (st.radar && st.radar.stoi) stoiKiedys = true; }
  sprawdz('kropka staje na krańcu, zanim zawróci', stoiKiedys);
}

console.log('');
console.log(ok + ' passed, ' + zle + ' failed');
process.exit(zle ? 1 : 0);
