// KRATKA SKANERA: „każde pole osobno" vs „wierszami / kolumnami".
//
// Model skanera (`rf-50-scan-model.js`) nie dotyka przeglądarki i sam się eksportuje, więc da się
// go uruchomić TAK JAK JEST — bez atrapy DOM-u, bez kopii logiki w teście. To jest różnica między
// „test sprawdza, czy kod wygląda poprawnie" a „test przejeżdża kratkę i patrzy, co się zapala".
//
// Uruchamiane przez tests/test_scan_model.py. Wynik: JSON {checks:[[nazwa, ok, szczegół]]}.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const RFS = require(path.join(ROOT, "web", "js", "rf-50-scan-model.js"));

const checks = [];
const ck = (nazwa, ok, szczegol = "") => checks.push([nazwa, !!ok, String(szczegol)]);
const EKRAN = { x: 0, y: 0, w: 1600, h: 800 };

function silnik(nadpisz) {
  const u = Object.assign({}, RFS.DOMYSLNE, {
    tryb: "cwiartki", siatka: [4, 4], czasBloku: 1000,
    opoznienieStartu: 0, wyprzedzenie: 0, poziomyMax: 1,
    progKoncaBloku: 1,          // próg wielkości ma NIE kończyć przebiegu za nas
    poCwiartkach: "klik",
  }, nadpisz || {});
  const s = new RFS.Silnik({ ustawienia: u, ekran: EKRAN, cele: [] });
  s.start(0);
  s.krok(1);                    // odliczanie → biegnie
  return s;
}
// Potwierdzenie DOKŁADNIE na polu o indeksie `i`: pozycja liczy się z czasu od `t0`.
const wTrakcie = (s, i) => s.t0 + i * 1000 + 500;

// --- 1. BEZ REGRESJI: „każde pole osobno" dalej daje pełną kratkę ---------------------------
{
  const s = silnik({ cwiartkiKolejnosc: "kratka" });
  const st = s.krok(wTrakcie(s, 0));
  ck("kratka: 4×4 zapala 16 pól", st.bloki.length === 16, st.bloki.length);
  ck("kratka: pole jest ćwiartką ćwiartki",
     st.bloki[0].w === 400 && st.bloki[0].h === 200, JSON.stringify(st.bloki[0]));
}

// --- 2. WIERSZAMI: faza pierwsza to cztery pasy na całą szerokość ---------------------------
{
  const s = silnik({ cwiartkiKolejnosc: "wiersze" });
  const st = s.krok(wTrakcie(s, 0));
  ck("wierszami: zapala 4 wiersze, nie 16 pól", st.bloki.length === 4, st.bloki.length);
  ck("wierszami: wiersz jest na całą szerokość",
     st.bloki.every(b => b.w === EKRAN.w && b.h === 200), JSON.stringify(st.bloki[0]));
  ck("wierszami: opis mówi o wierszu", /wierszu/.test(st.opis || ""), st.opis);

  // wybieramy DRUGI wiersz
  s.potwierdz(wTrakcie(s, 1));
  const st2 = s.krok(s.t0 + 500);
  ck("wierszami: po wyborze wiersza zapalają się jego pola", st2.bloki.length === 4, st2.bloki.length);
  ck("wierszami: pole leży w wybranym wierszu",
     st2.bloki.every(b => b.y === 200 && b.h === 200 && b.w === 400), JSON.stringify(st2.bloki[0]));
  ck("wierszami: opis przeszedł na pole", /polu/.test(st2.opis || ""), st2.opis);
  ck("wierszami: wybór wiersza to PÓŁ poziomu (etap nadal 0)", s.etap === 0, s.etap);

  // wybieramy TRZECIE pole w tym wierszu → przy poziomyMax 1 to koniec
  s.potwierdz(wTrakcie(s, 2));
  ck("wierszami: po polu poziom się domyka (etap 1)", s.etap === 1, s.etap);
  ck("wierszami: przy zawężaniu raz skaner kończy klikiem", s.faza !== "biegnie", s.faza);
  const p = s.punkt || {};
  ck("wierszami: klik pada w wybrane pole",
     p.x > 800 && p.x < 1200 && p.y > 200 && p.y < 400, JSON.stringify(p));
}

// --- 3. GŁĘBOKOŚĆ: „zawężaj 2 razy" robi drugą parę wiersz+pole ------------------------------
{
  const s = silnik({ cwiartkiKolejnosc: "wiersze", poziomyMax: 2 });
  s.potwierdz(wTrakcie(s, 0));          // wiersz 1
  s.potwierdz(wTrakcie(s, 0));          // pole 1 → koniec poziomu 1
  ck("głębokość 2: po pierwszej parze skaner jedzie dalej", s.faza === "biegnie", s.faza);
  const st = s.krok(s.t0 + 100);
  ck("głębokość 2: drugi poziom znowu zaczyna od wierszy", st.bloki.length === 4, st.bloki.length);
  ck("głębokość 2: i to WEWNĄTRZ wybranego pola",
     st.bloki[0].w === 400 && st.bloki[0].h === 50, JSON.stringify(st.bloki[0]));
  s.potwierdz(wTrakcie(s, 0));
  s.potwierdz(wTrakcie(s, 0));
  ck("głębokość 2: dopiero druga para kończy", s.etap === 2 && s.faza !== "biegnie", s.faza + "/" + s.etap);
}

// --- 4. KOLUMNAMI: to samo w drugą stronę ----------------------------------------------------
{
  const s = silnik({ cwiartkiKolejnosc: "kolumny" });
  const st = s.krok(wTrakcie(s, 0));
  ck("kolumnami: zapala 4 kolumny na całą wysokość",
     st.bloki.length === 4 && st.bloki.every(b => b.h === EKRAN.h && b.w === 400), st.bloki.length);
  s.potwierdz(wTrakcie(s, 1));
  const st2 = s.krok(s.t0 + 500);
  ck("kolumnami: potem pola wybranej kolumny",
     st2.bloki.every(b => b.x === 400 && b.w === 400 && b.h === 200), JSON.stringify(st2.bloki[0]));
}

// --- 5. COFANIE wraca z pól do wierszy -------------------------------------------------------
{
  const s = silnik({ cwiartkiKolejnosc: "wiersze" });
  s.potwierdz(wTrakcie(s, 2));                       // wiersz 3
  ck("cofanie: jesteśmy w fazie pól", s.fazaKolumn === true, s.fazaKolumn);
  s.cofnij(s.t0 + 10);
  ck("cofanie: wracamy do wyboru wiersza", s.fazaKolumn === false, s.fazaKolumn);
  const st = s.krok(s.t0 + 100);
  ck("cofanie: i znowu widać 4 wiersze na całą szerokość",
     st.bloki.length === 4 && st.bloki[0].w === EKRAN.w, JSON.stringify(st.bloki[0]));
}

// --- 6. SZACOWANY CZAS zna nową drogę --------------------------------------------------------
{
  const u = Object.assign({}, RFS.DOMYSLNE, { tryb: "cwiartki", siatka: [4, 4], poziomyMax: 1, progKoncaBloku: 1 });
  const kratka = RFS.szacujCzas(Object.assign({}, u, { cwiartkiKolejnosc: "kratka" }), EKRAN);
  const wiersze = RFS.szacujCzas(Object.assign({}, u, { cwiartkiKolejnosc: "wiersze" }), EKRAN);
  ck("szacowany czas: wierszami wychodzi krócej niż kratką", wiersze < kratka, kratka + " → " + wiersze);
}

// --- 7. „W OSTATNIM POLU → DOJEDŹ PASKAMI": pasek MUSI JECHAĆ -------------------------------
// Błąd: „dojedź paskami” nie animowało pasków. Grubość paska jest
// w pikselach całego ekranu (170 / 200), a ostatnie pole ma ich kilkadziesiąt — pasek zajmował
// więc CAŁE pole, `krokow` schodziło do 1 i stał w miejscu, pulsując jak na postoju.
// Test mierzy RUCH: ile różnych pozycji pasek zajmuje przez dwa pełne przejazdy.
{
  const s = silnik({ poCwiartkach: "paski", cwiartkiKolejnosc: "kratka", siatka: [4, 4],
                     ruch: "skokowy", czasKroku: 200, kierunek: "jeden", pauzaNaKrancach: 0,
                     przebiegi: 1, kolejnosc: "Y-X", nawroty: 0 });
  s.potwierdz(wTrakcie(s, 0));                       // pierwsze pole → przechodzimy na paski
  ck("paski w polu: skaner nie kończy klikiem, tylko jedzie dalej",
     s.fazaPasow === true && s.faza === "biegnie", s.faza + "/" + s.fazaPasow);
  const pole = { w: s.obszar.w, h: s.obszar.h };
  const pozycje = new Set();
  let st = null;
  let pasmo = null;
  for (let dt = 0; dt <= 2000; dt += 50) {
    st = s.krok(s.t0 + dt);
    if (st.pasmo) { pozycje.add(st.pasmo.od); pasmo = st.pasmo; }
  }
  ck("paski w polu: pasek zmienia pozycję (nie stoi w miejscu)", pozycje.size >= 3,
     "pozycji: " + pozycje.size + " w polu " + JSON.stringify(pole));
  ck("paski w polu: pasek jest cieńszy niż pole, więc ma po czym jechać",
     pasmo && pasmo.grubosc <= pole.h / 2.9, pasmo && pasmo.grubosc + " / " + pole.h);
  ck("paski w polu: nie wyjeżdża poza pole",
     !!pasmo && [...pozycje].every(p => p >= s.obszar.y - 1 && p + pasmo.grubosc <= s.obszar.y + pole.h + 1),
     JSON.stringify([...pozycje]));
}

// --- 8. WĄSKI WŁASNY PROSTOKĄT w trybie „pasy" — ta sama usterka, inne wejście ---------------
// Ten sam sufit grubości ratuje „dolny pas" (obszar niższy niż pasmoY 170): bez niego pasek
// zajmował cały wycinek i skanowanie po Y nic nie wybierało.
{
  const u = Object.assign({}, RFS.DOMYSLNE, { tryb: "pasy", ruch: "skokowy", czasKroku: 200,
    kierunek: "jeden", pauzaNaKrancach: 0, opoznienieStartu: 0, przebiegi: 1, kolejnosc: "Y" });
  u.nawroty = 0;
  const s = new RFS.Silnik({ ustawienia: u, ekran: { x: 0, y: 900, w: 1600, h: 120 }, cele: [] });
  s.start(0); s.krok(1);
  const pozycje = new Set();
  for (let dt = 0; dt <= 1200; dt += 50) { const st = s.krok(s.t0 + dt); if (st.pasmo) pozycje.add(st.pasmo.od); }
  ck("wąski pas ekranu: pasek też jedzie, a nie wypełnia go w całości", pozycje.size >= 3,
     "pozycji: " + pozycje.size);
}

process.stdout.write(JSON.stringify({ checks }));
