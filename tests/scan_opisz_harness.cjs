/* SKANER — OPIS KONFIGURACJI Z TABLICY PÓL, NA SUCHO (2026-10-02).

   Po co: od 02.10 opis presetu skanera w Bibliotece ma być POCHODNĄ tablicy pól
   karty (`RFScan.POLA`, rf-50b) i modelu, żeby nowe pokrętło, tryb albo akcja pojawiały się tam bez
   dopisywania czegokolwiek. Ten harness jest strażnikiem tej obietnicy:
     1. każde pole widoczne w karcie (ta sama reguła `gdy`) ma w `opisz` wpis z niepustym tekstem,
        i dotyczy to też pokrętła dopisanego do tablicy w locie;
     2. `roznice` daje jedną różnicę z etykietą karty i jednostką — i ŻADNEJ dla pokrętła, które
        w porównywanym trybie nic nie robi;
     3. `naglowek` zaczyna od sposobu wskazywania;
     4. `kosztWyboru` — cztery konfiguracje policzone ręcznie.

   Model i pola dają się wczytać w Node (`module.exports` na końcu plików) bez DOM-u.
   Uruchomienie: `node tests/scan_opisz_harness.cjs` (odpala go też `tests/test_scan.py`).
*/
const path = require('path');
const JS = path.join(__dirname, '..', 'web', 'js');
require(path.join(JS, 'rf-50-scan-model.js'));
require(path.join(JS, 'rf-50b-scan-fields.js'));
const NS = require(path.join(JS, 'rf-50b2-scan-opis.js'));

let ok = 0, zle = 0;
function sprawdz(nazwa, warunek, dodatek) {
  if (warunek) { ok++; console.log('  OK   ' + nazwa); }
  else { zle++; console.log('  ZLE  ' + nazwa + (dodatek !== undefined ? '  -> ' + JSON.stringify(dodatek) : '')); }
}

function widoczne(cfg) {
  const u = Object.assign({}, NS.DOMYSLNE, cfg), w = Object.assign({}, NS.WYGLAD_DOM, cfg);
  // Gotowe kształty to przyciski wpisujące cztery liczby, nie ustawienie — liczby opisuje pole „od–do".
  return NS.POLA.filter(function (p) { return !p.sek && p.typ !== 'ksztalty' && (!p.gdy || p.gdy(u, w)); });
}
function wpisy(cfg) {
  const out = [];
  NS.opisz(cfg).forEach(function (s) { s.pola.forEach(function (p) { out.push(p); }); });
  return out;
}
function pokrycie(nazwa, cfg) {
  const brak = [];
  const W = wpisy(cfg);
  widoczne(cfg).forEach(function (p) {
    const e = W.find(function (x) { return x.k === p.k && x.typ === p.typ; });
    if (!e || !String(e.tekst || '').trim()) brak.push(p.k + '/' + p.typ);
  });
  sprawdz(nazwa + ': każde widoczne pole ma wpis z tekstem (' + widoczne(cfg).length + ')', brak.length === 0, brak);
  const nadmiar = W.filter(function (e) {
    return !widoczne(cfg).some(function (p) { return p.k === e.k && p.typ === e.typ; });
  }).map(function (e) { return e.k; });
  sprawdz(nazwa + ': i żadnego pola, którego karta nie pokazuje', nadmiar.length === 0, nadmiar);
}

// --- 1. strażnik „nowe pokrętło pojawia się samo" --------------------------------------------
console.log('- opisz: pokrycie tablicy pól');
pokrycie('pasy (domyślne)', {});
pokrycie('pasy płynne, menu akcji, dźwięk', { ruch: 'plynny', menuAkcji: true, dzwiek: true });
pokrycie('ćwiartki', { tryb: 'cwiartki' });
pokrycie('ćwiartki z paskami i jednym poziomem', { tryb: 'cwiartki', poCwiartkach: 'paski', poziomyMax: 1 });
pokrycie('radar', { tryb: 'radar' });
pokrycie('własny prostokąt na ekranie', { obszar: 'wlasny', obszarX1: 22, obszarX2: 81 });
{
  const W = wpisy({ obszar: 'wlasny', obszarX1: 22, obszarX2: 81, obszarY1: 66.7, obszarY2: 100 });
  const od = W.find(function (e) { return e.k === 'obszarX1'; });
  sprawdz('„od–do" mówi parą z jednostką', od && od.tekst === '22–81 %', od && od.tekst);
  const segm = wpisy({ tryb: 'cwiartki', poziomyMax: 1 }).filter(function (e) { return e.k === 'poziomyMax'; });
  sprawdz('„Po wybraniu pola" mówi zdaniem z `czytaj`, bez suwaka przy jednym poziomie',
    segm.length === 1 && segm[0].tekst === 'Kończ na nim', segm.map(function (e) { return e.tekst; }));
  const kol = wpisy({}).find(function (e) { return e.k === 'kolorY'; });
  sprawdz('kolor niesie próbkę', kol && /^#[0-9A-F]{6}$/.test(kol.kolor) && kol.tekst === kol.kolor, kol);
  const ost = NS.opisz({});
  sprawdz('sekcja wyglądu jest ostatnia i ma flagę', ost.length && ost[ost.length - 1].wyglad === true,
    ost.map(function (s) { return s.sek + (s.wyglad ? '*' : ''); }));
  sprawdz('pola wyglądu z innych sekcji trafiają do sekcji wyglądu',
    ost[ost.length - 1].pola.some(function (p) { return p.k === 'pokrycieY'; })
    && !ost[0].pola.some(function (p) { return p.k === 'pokrycieY'; }));
  sprawdz('domyślna konfiguracja: wszystko oznaczone jako domyślne',
    wpisy({}).every(function (e) { return e.domyslna; }), wpisy({}).filter(function (e) { return !e.domyslna; }).map(function (e) { return e.k; }));
}
{
  // Pokrętło dopisane do tablicy w locie — tak, jak dopisze je kiedyś ktoś w rf-50b.
  NS.DOMYSLNE.testowe = 5;
  const P = { k: 'testowe', typ: 'suwak', nazwa: 'Pokrętło z przyszłości', min: 0, max: 10, krok: 1, jed: 'ms' };
  NS.POLA.splice(2, 0, P);
  const e = wpisy({ testowe: 7 }).find(function (x) { return x.k === 'testowe'; });
  sprawdz('nowe pokrętło w tablicy pojawia się w opisie samo', e && e.tekst === '7 ms' && !e.domyslna, e);
  const r = NS.roznice({}, { testowe: 7 });
  sprawdz('...i w różnicach', r.length === 1 && r[0].nazwa === 'Pokrętło z przyszłości', r);
  NS.POLA.splice(NS.POLA.indexOf(P), 1);
  delete NS.DOMYSLNE.testowe;
}

// --- 2. różnice ----------------------------------------------------------------------------
console.log('- roznice');
{
  // ⚠️ Domyślny ruch to SKOKOWY (zestaw „Ostrożny"), a prędkość paska działa tylko w płynnym — więc
  // porównanie z czystymi domyślnymi nie ma czego pokazać. To jest reguła, nie usterka: różnica
  // pokrętła, które po wczytaniu nic nie robi, nie jest różnicą, którą ktoś poczuje.
  sprawdz('prędkość przy ruchu skokowym nie jest różnicą', NS.roznice(NS.DOMYSLNE, { predkosc: 420 }).length === 0,
    NS.roznice(NS.DOMYSLNE, { predkosc: 420 }));
  const a = Object.assign({}, NS.DOMYSLNE, { ruch: 'plynny' });
  const r = NS.roznice(a, { ruch: 'plynny', predkosc: 420 });
  sprawdz('jedna zmieniona prędkość = jedna różnica', r.length === 1, r);
  sprawdz('...z etykietą karty', r[0] && r[0].nazwa === 'Prędkość paska', r[0]);
  sprawdz('...i tekstami z jednostką', r[0] && r[0].od === '700 px/s' && r[0].do === '420 px/s', r[0]);
  sprawdz('struktura (plansze, nazwa) nie jest różnicą',
    NS.roznice({}, { configName: 'X', zrzuty: [{ plik: 'a.jpg' }], szablonW: 800 }).length === 0);
  sprawdz('ten sam kolor zapisany innymi literami nie jest różnicą',
    NS.roznice({ kolorY: '#EC1A83' }, { kolorY: '#ec1a83' }).length === 0);
  const s = NS.rozniceKonfiguracji({ sekcje: [{ tryb: 'pasy' }] },
    { sekcje: [{ tryb: 'pasy' }, { tryb: 'radar', nazwa: 'Menu' }] });
  sprawdz('skaner, którego kapsel nie ma, to „nowy skaner"', s.length === 1 && s[0].nowy && s[0].nr === 2, s);
}

// --- 3. nagłówek ---------------------------------------------------------------------------
console.log('- naglowek');
{
  const n = NS.naglowek({ tryb: 'cwiartki', siatka: [4, 4] });
  sprawdz('ćwiartki 4 × 4 zaczynają się od „Ćwiartki"', n[0] === 'Ćwiartki' && n[1] === '4 × 4', n);
  const m = NS.naglowek({ tryb: 'cwiartki', siatka: [4, 4], cwiartkiKolejnosc: 'wiersze', poziomyMax: 1, poCwiartkach: 'paski' });
  sprawdz('najwyżej cztery chipy', m.length === 4, m);
  sprawdz('domyślne wybory nie dają chipów', NS.naglowek({}).join('|') === 'Pasy', NS.naglowek({}));
  // Dymek chipa: pytanie, na które chip odpowiada (nazwa pola) i opis z tablicy.
  const d = NS.naglowekPola({ tryb: 'cwiartki', poziomyMax: 1 });
  const kon = d.find(function (c) { return c.tekst === 'Kończ na nim'; });
  sprawdz('chip niesie nazwę i opis pola do dymka',
    d[0].nazwa === 'Sposób wskazywania' && d[0].opis.length > 20 && kon && kon.nazwa === 'Po wybraniu pola' && kon.opis.length > 20, d);
}

// --- 4. koszt wyboru -----------------------------------------------------------------------
console.log('- kosztWyboru');
{
  const E = { w: 1920, h: 1080 };
  const P = [
    // pasy Y-X, 2 przebiegi: 2 osie × 2 = 4
    ['pasy domyślne', {}, 4],
    // jedna oś, jeden przebieg, menu akcji: 1 × 1 + 1 = 2
    ['pasy jedna oś + menu', { kolejnosc: 'Y', przebiegi: 1, menuAkcji: true }, 2],
    // ćwiartki 2×2 „każde pole osobno": 1080 → 540 → 270 → 135 → 67,5 = 4 poziomy × 1 = 4
    ['ćwiartki 2×2 kratka', { tryb: 'cwiartki', siatka: [2, 2], cwiartkiKolejnosc: 'kratka', poziomyMax: 4, progKoncaBloku: 90 }, 4],
    // ćwiartki 4×4 wierszami, 2 poziomy (1080 → 270 → 67,5), paski w ostatnim polu: 2 × 2 + 2 = 6
    ['ćwiartki 4×4 wiersze + paski', { tryb: 'cwiartki', siatka: [4, 4], cwiartkiKolejnosc: 'wiersze', poziomyMax: 2,
      progKoncaBloku: 90, poCwiartkach: 'paski' }, 6]
  ];
  P.forEach(function (x) {
    const k = NS.kosztWyboru(x[1], E);
    sprawdz(x[0] + ': ' + x[2] + ' sygnałów', k.sygnaly === x[2], k);
    sprawdz(x[0] + ': sekundy = szacujCzas', Math.abs(k.sekundy - NS.szacujCzas(x[1], E)) < 1e-9, k);
  });
  sprawdz('radar z menu: 2 + 1', NS.kosztWyboru({ tryb: 'radar', menuAkcji: true }, E).sygnaly === 3);
}

console.log('\n' + ok + ' passed, ' + zle + ' failed');
process.exit(zle ? 1 : 0);
