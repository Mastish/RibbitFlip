// RAMKA PODGLĄDU JEDZIE ZE STRONĄ, a skaner ma jechać razem z nią.
//
// Objaw: „przy scrollowaniu ten preview window nie działa prawidłowo,
// najeżdża poza swoje okno". Przyczyna siedziała w modelu, nie w arkuszu stylów: `obszar`,
// `punkt` i historia cofania są zapisane w tym samym układzie współrzędnych co `ekran` (w karcie:
// piksele okna przeglądarki), a `ustawEkran` podmieniał sam `ekran` i zostawiał resztę tam, gdzie
// ramka BYŁA. Zmierzone przed poprawką w żywym panelu: przewinięcie strony o 174 px zostawiało
// zapalone pole 51 px NAD ramką podglądu.
//
// Test sprawdza ZACHOWANIE na prawdziwym modelu (bez atrapy DOM-u, bez kopii logiki):
// przesuwamy i skalujemy ramkę w środku przejazdu i pytamy, gdzie skaner rysuje.
// Uruchamiane przez tests/test_scan_model.py. Wynik: JSON {checks:[[nazwa, ok, szczegół]]}.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const RFS = require(path.join(ROOT, "web", "js", "rf-50-scan-model.js"));

const checks = [];
const ck = (nazwa, ok, szczegol = "") => checks.push([nazwa, !!ok, String(szczegol)]);
const blisko = (a, b, tol = 0.001) => Math.abs(a - b) <= tol;
const EKRAN = { x: 100, y: 200, w: 800, h: 600 };

function silnik(nadpisz) {
  const u = Object.assign({}, RFS.DOMYSLNE, {
    tryb: "cwiartki", siatka: [2, 2], czasBloku: 1000, poziomyMax: 4,
    opoznienieStartu: 0, wyprzedzenie: 0, progKoncaBloku: 1, poCwiartkach: "klik",
    blokadaPoWyborze: 0, odbicie: 0, czasPrzytrzymania: 0,
  }, nadpisz || {});
  const s = new RFS.Silnik({ ustawienia: u, ekran: Object.assign({}, EKRAN), cele: [] });
  s.start(0);
  s.krok(1);                       // odliczanie → biegnie
  return s;
}
// Wybór pola: naciśnięcie + puszczenie w zadanej chwili.
function wybierz(s, t) { s.potwierdz(t); s.puszczenie(t + 5); return t; }

// --- 1. PRZEWINIĘCIE STRONY W ŚRODKU PRZEJAZDU ----------------------------------------------
{
  const s = silnik();
  wybierz(s, 1500);                                  // drugie pole kratki 2×2
  const przed = Object.assign({}, s.obszar);
  const dy = -174;                                   // dokładnie tyle, ile w zgłoszeniu
  s.ustawEkran({ x: EKRAN.x, y: EKRAN.y + dy, w: EKRAN.w, h: EKRAN.h });
  ck("przewinięcie: wybrany obszar jedzie razem z ramką",
     blisko(s.obszar.y, przed.y + dy) && blisko(s.obszar.x, przed.x),
     JSON.stringify({ przed: przed.y, po: s.obszar.y, oczekiwane: przed.y + dy }));
  ck("przewinięcie: rozmiar obszaru się nie zmienia",
     blisko(s.obszar.w, przed.w) && blisko(s.obszar.h, przed.h),
     s.obszar.w + "×" + s.obszar.h);
  ck("przewinięcie: obszar zostaje WEWNĄTRZ ramki",
     s.obszar.y >= EKRAN.y + dy - 0.001 && s.obszar.y + s.obszar.h <= EKRAN.y + dy + EKRAN.h + 0.001,
     JSON.stringify(s.obszar));
  const st = s.krok(1600);
  ck("przewinięcie: zapalone pola też są w nowej ramce",
     st.bloki.every(b => b.y >= EKRAN.y + dy - 0.001 && b.y + b.h <= EKRAN.y + dy + EKRAN.h + 0.001),
     JSON.stringify(st.bloki[0]));
}

// --- 2. TA SAMA RAMKA = ZERO RUCHU (pętla klatek woła `ustawEkran` co klatkę) ----------------
{
  const s = silnik();
  wybierz(s, 1500);
  const przed = JSON.stringify(s.obszar);
  for (let i = 0; i < 60; i++) s.ustawEkran({ x: EKRAN.x, y: EKRAN.y, w: EKRAN.w, h: EKRAN.h });
  ck("sześćdziesiąt klatek bez ruchu ramki nic nie przesuwa", JSON.stringify(s.obszar) === przed,
     przed + " → " + JSON.stringify(s.obszar));
}

// --- 3. ZMIANA ROZMIARU RAMKI: punkt trzyma swój UŁAMEK -------------------------------------
{
  const s = silnik();
  wybierz(s, 1500);
  const przed = Object.assign({}, s.obszar);
  const uPrzed = (przed.x - EKRAN.x) / EKRAN.w, vPrzed = (przed.y - EKRAN.y) / EKRAN.h;
  const nowy = { x: 0, y: 0, w: EKRAN.w / 2, h: EKRAN.h * 2 };
  s.ustawEkran(nowy);
  ck("zmiana rozmiaru: obszar trzyma swój ułamek ramki",
     blisko((s.obszar.x - nowy.x) / nowy.w, uPrzed, 1e-9) &&
     blisko((s.obszar.y - nowy.y) / nowy.h, vPrzed, 1e-9),
     JSON.stringify({ u: (s.obszar.x - nowy.x) / nowy.w, v: (s.obszar.y - nowy.y) / nowy.h }));
  ck("zmiana rozmiaru: obszar skaluje się razem z ramką",
     blisko(s.obszar.w, przed.w / 2) && blisko(s.obszar.h, przed.h * 2),
     s.obszar.w + "×" + s.obszar.h);
}

// --- 4. WSKAZANY PUNKT też jedzie z ramką ----------------------------------------------------
{
  const s = silnik({ tryb: "pasy", kolejnosc: "Y", przebiegi: 1, ruch: "plynny",
                     predkosc: 400, dociaganie: 0, menuAkcji: true });
  wybierz(s, 1200);                                  // jedna oś → od razu punkt i menu akcji
  ck("punkt powstał", !!s.punkt, JSON.stringify(s.punkt));
  const przed = Object.assign({}, s.punkt);
  s.ustawEkran({ x: EKRAN.x, y: EKRAN.y - 300, w: EKRAN.w, h: EKRAN.h });
  ck("punkt jedzie z ramką", blisko(s.punkt.y, przed.y - 300) && blisko(s.punkt.x, przed.x),
     przed.y + " → " + s.punkt.y);
  ck("…razem z pozycją sprzed dociągnięcia",
     !!s.punkt.surowy && blisko(s.punkt.surowy.y, przed.surowy.y - 300),
     JSON.stringify(s.punkt.surowy));
}

// --- 5. COFANIE po przewinięciu wraca do ramki, w której JEST --------------------------------
{
  const s = silnik();
  wybierz(s, 1500);
  wybierz(s, 2600);                                  // drugi poziom
  s.ustawEkran({ x: EKRAN.x + 40, y: EKRAN.y - 220, w: EKRAN.w, h: EKRAN.h });
  s.cofnij(3000);
  const st = s.krok(3100);
  const R = { x: EKRAN.x + 40, y: EKRAN.y - 220, w: EKRAN.w, h: EKRAN.h };
  ck("cofnięcie oddaje obszar przeliczony na nową ramkę",
     st.bloki.length > 0 && st.bloki.every(b =>
       b.x >= R.x - 0.001 && b.x + b.w <= R.x + R.w + 0.001 &&
       b.y >= R.y - 0.001 && b.y + b.h <= R.y + R.h + 0.001),
     JSON.stringify(st.bloki[0]));
}

process.stdout.write(JSON.stringify({ checks }));
