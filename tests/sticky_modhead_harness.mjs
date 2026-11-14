/* PRZYKLEJONE KOLUMNY MODUŁÓW KONTRA PASEK MODUŁU — w prawdziwej przeglądarce.
   Uruchomienie: instancja testowa aplikacji, potem

     node tests/sticky_modhead_harness.mjs
     RF_URL=http://127.0.0.1:8791/ node tests/sticky_modhead_harness.mjs

   CO TU SIĘ SPRAWDZA. Nad treścią każdego modułu stoją DWA albo TRZY przyklejone paski: pasek
   aplikacji (`--topbar-h`), przy oknie 901–1279 px jeszcze pas kapsli (`--rf-strip-h`) i pasek
   modułu (`.rfpc-head`). Kolumna, która ma stać w oknie — scena koła, podgląd myszy, mapa
   kontrolera, podgląd skanera, blok stały ekranu „Wszystkie" — musi zatrzymać się POD nimi
   wszystkimi. Do 14.09 każda z nich miała tu WŁASNĄ zgadywaną liczbę (46 px w skanerze, 84
   w kontrolerze, 8 w myszy, a scena koła mierzyła pasek zakładek aplikacji, którego po
   przebudowie na trzy kolumny nie ma) i wszystkie były złe: zmierzony pasek modułu ma 75 px,
   więc kolumny parkowały POD nim — o 67, 68 i 144 px za wysoko.

   Dlatego pytamy o PIKSELE, a nie o obecność reguły: `position:sticky` bywa w tym projekcie
   poprawne i bezsilne (patrz `.card{overflow:hidden}` w 26-scan.css), a zgadywana liczba jest
   poprawna składniowo zawsze. Miarą jest dolna krawędź żywego paska modułu.

   ⚠️ Pasków `.rfpc-head` jest kilkanaście — po jednym na moduł i wszystkie zostają w DOM-ie.
   `querySelector` trafia w schowany pasek pierwszego modułu, więc szukamy pierwszego widocznego
   (`offsetParent !== null` i niezerowa wysokość), tak samo jak `_scanGlowaModulu` w rf-50d. */
import { createRequire } from 'module';
import path from 'path';
const wymagaj = createRequire(import.meta.url);
const { rfBezPierwszegoStartu } = wymagaj("./_rf_pierwszy_start.cjs");   // bez pytania i zaproszenia pierwszego startu
const { chromium } = wymagaj(path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@playwright', 'test'));

const ADRES = process.env.RF_URL || 'http://127.0.0.1:8790/';
const ODDECH = 8;          // tyle wolnego zostawia `--rf-sticky-top` pod ostatnim paskiem
let ok = 0, zle = 0;
const bledy = [];
const spij = (ms) => new Promise(r => setTimeout(r, ms));
function sprawdz(nazwa, warunek, dodatek) {
  if (warunek) { ok++; console.log('  OK   ' + nazwa); }
  else { zle++; console.log('  ZLE  ' + nazwa + (dodatek !== undefined ? '  -> ' + JSON.stringify(dodatek) : '')); }
}

// Kolumna, kontener i to, czym była przed 14.09 — ostatnia liczba jest w komunikacie bledu, zeby
// bylo widac, ze test pilnuje konkretnej usterki, a nie dowolnej liczby.
const MODULY = [
  { tab: 'kolo', nazwa: 'Koło wyboru', sel: '.wh-stage', dawniej: 'pasek zakladek aplikacji' },
  { tab: 'mysz', nazwa: 'Mysz', sel: '.mouse-viz', dawniej: 'top:8px' },
  { tab: 'kontroler', nazwa: 'Kontroler', sel: '.pad-left', dawniej: 'top:84px' },
  { tab: 'skaner', nazwa: 'Skaner', sel: '.sk-lewa', dawniej: 'topbar + 46px' },
];

const przegladarka = await chromium.launch();
const page = await (await rfBezPierwszegoStartu(przegladarka.newContext({ viewport: { width: 1366, height: 800 } }))).newPage();
page.on('console', m => { if (m.type() === 'error') bledy.push(m.text()); });
page.on('pageerror', e => bledy.push('pageerror: ' + e.message));
await page.goto(ADRES, { waitUntil: 'domcontentloaded' });
await spij(2500);

// Jeden pomiar dla jednego modulu: gdzie stoi pasek, gdzie parkuje kolumna i czy cokolwiek
// maluje po pasku. `elementFromPoint` pyta o to, co WIDAC — warstwa `fixed` nad paskiem (scena
// skanera, cele treningu) nie jest dzieckiem karty, wiec nie zaslania jej zaden `z-index` karty.
async function zmierz(sel) {
  return page.evaluate(async (s) => {
    const spij2 = (ms) => new Promise(r => setTimeout(r, ms));
    const widoczny = (q) => Array.from(document.querySelectorAll(q))
      .find(n => n.offsetParent !== null && n.getBoundingClientRect().height > 0) || null;
    window.scrollTo(0, 700); await spij2(450);
    const g = widoczny('.rfpc-head');
    const k = widoczny(s);
    if (!g || !k) { window.scrollTo(0, 0); return { brak: !g ? 'pasek modulu' : s }; }
    const gb = g.getBoundingClientRect(), kb = k.getBoundingClientRect();
    const kont = k.parentElement.getBoundingClientRect();
    const sr = document.elementFromPoint(Math.round(gb.left + gb.width / 2), Math.round(gb.top + gb.height / 2));
    const lw = document.elementFromPoint(Math.round(gb.left + 40), Math.round(gb.top + gb.height / 2));
    const w = {
      glowaH: Math.round(gb.height), glowaDol: Math.round(gb.bottom),
      kolTop: parseFloat(getComputedStyle(k).top) || 0,
      kolPoz: getComputedStyle(k).position,
      kolY: Math.round(kb.top), kolDol: Math.round(kb.bottom),
      kontDol: Math.round(kont.bottom),
      wGlowie: !!(sr && sr.closest && sr.closest('.rfpc-head')) && !!(lw && lw.closest && lw.closest('.rfpc-head')),
      naWierzchu: sr ? (sr.id || String(sr.className).slice(0, 30)) : null,
      modhead: getComputedStyle(document.documentElement).getPropertyValue('--rf-modhead-h').trim(),
      strip: getComputedStyle(document.documentElement).getPropertyValue('--rf-strip-h').trim(),
      topbar: getComputedStyle(document.documentElement).getPropertyValue('--topbar-h').trim(),
    };
    window.scrollTo(0, 0); await spij2(200);
    return w;
  }, sel);
}

for (const szer of [1280, 1366]) {
  await page.setViewportSize({ width: szer, height: 800 });
  await spij(500);
  console.log('\n- okno ' + szer + ' px');
  for (const m of MODULY) {
    await page.click('[data-tab="' + m.tab + '"]');
    await spij(900);
    const w = await zmierz(m.sel);
    if (w.brak) { sprawdz(m.nazwa + ': jest co mierzyc', false, w); continue; }
    // 1. GDZIE PARKUJE. To jest sama usterka: `top` kolumny kontra dolna krawedz paska modulu.
    sprawdz(m.nazwa + ': kolumna parkuje POD paskiem modulu (bylo: ' + m.dawniej + ')',
      Math.abs(w.kolTop - (w.glowaDol + ODDECH)) <= 1, w);
    // 2. …I TAK TEZ SIE RYSUJE. Wyjatek jest jeden, jawny i wynika z samej definicji `sticky`:
    //    kolumna stoi w oknie tylko dopoki MIESCI SIE w tym, co zostalo z jej kontenera. Gdy
    //    kontener konczy sie wyzej, niz siegalaby zaparkowana kolumna (`.pad-left` ma 1157 px
    //    przy oknie 800 px), przyklejenie puszcza i kolumna jedzie w gore razem ze strona —
    //    a o to, ze nie widac jej NA pasku, dba punkt 3: pasek jest nieprzezroczysty i lezy nad
    //    trescia karty. To osobna sprawa od zgadywanej wysokosci i osobno ja zglaszamy.
    const wysokosc = w.kolDol - w.kolY;
    const miejsce = w.kontDol - wysokosc;            // najwyzej, jak kontener pozwoli ja zaparkowac
    sprawdz(m.nazwa + ': …i tak sie rysuje (albo kontener nie ma miejsca, zeby ja utrzymac)',
      w.kolY >= w.glowaDol - 1 || miejsce < w.kolTop,
      Object.assign({ wysokosc: wysokosc, miejsce: miejsce }, w));
    // 3. CZY COS PO NIM MALUJE. Warstwy `fixed` (scena skanera, cele treningu) leza poza karta,
    //    wiec zaden `z-index` karty ich nie zatrzyma — musza byc przyciete do dolnej krawedzi paska.
    sprawdz(m.nazwa + ': nic nie maluje po pasku modulu (warstwy fixed przyciete)', w.wGlowie, w);
    // 4. Gdyby pasek mial te 46 px, ktore zgadywal arkusz, test nie sprawdzalby niczego.
    sprawdz(m.nazwa + ': pasek modulu jest wyzszy niz zgadywane 46 px', w.glowaH > 46, w.glowaH);
  }
}

// PAS KAPSLI (901-1279 px) JEST TRZECIM PASKIEM. Przy tej szerokosci prawa kolumna przestaje byc
// kolumna i staje sie przyklejonym pasem nad trescia (20-cols.css) — zmierzone 368 px. Ekran
// „Wszystkie" liczyl kiedys `topbar + pasek zakladek` z pominieciem pasa i przy 1100 px jego blok
// staly parkowal 360 px za wysoko, czyli w calosci pod pasem.
console.log('\n- pas kapsli (okno 1100 px)');
await page.setViewportSize({ width: 1100, height: 800 });
await spij(600);
for (const m of [{ tab: 'wszystkie', nazwa: 'Wszystkie', sel: '.rfpc-shared-l' },
                 { tab: 'mysz', nazwa: 'Mysz', sel: '.mouse-viz' }]) {
  await page.click('[data-tab="' + m.tab + '"]');
  await spij(900);
  const w = await zmierz(m.sel);
  if (w.brak) { sprawdz(m.nazwa + ': jest co mierzyc', false, w); continue; }
  sprawdz(m.nazwa + ': pas kapsli jest policzony w miejscu zatrzymania',
    parseFloat(w.strip) > 40 && Math.abs(w.kolTop - (w.glowaDol + ODDECH)) <= 1, w);
}

// ZMIENNA IDZIE ZA MODULEM. Paski roznych modulow maja rozne wysokosci (ekran „Wszystkie" ma
// wezszy pasek niz moduly z pigulka kapsla), wiec przelaczenie modulu MUSI przeliczyc zmienna —
// robi to ten sam ResizeObserver, ktory pilnuje zawijania paska (rf-40 `rfWatchModHead`).
console.log('\n- zmienna idzie za przelaczeniem modulu');
await page.setViewportSize({ width: 1366, height: 800 });
await spij(500);
const slad = [];
for (const t of ['wszystkie', 'mysz', 'wszystkie']) {
  await page.click('[data-tab="' + t + '"]');
  await spij(800);
  // ⚠️ `offsetHeight`, nie `getBoundingClientRect()` — wejscie w modul jest animowane skalowaniem,
  // a rect podaje pudlo PO przeksztalceniu (79,8 px w polowie animacji zamiast 81 px z ukladu).
  // Tym samym pomiarem posluguje sie `_syncModHeadH` w rf-40 i z tego samego powodu.
  slad.push(await page.evaluate(() => {
    const g = Array.from(document.querySelectorAll('.rfpc-head')).find(n => n.offsetParent !== null && n.offsetHeight > 0);
    return { zmienna: getComputedStyle(document.documentElement).getPropertyValue('--rf-modhead-h').trim(),
             zmierzona: g ? g.offsetHeight + 'px' : null };
  }));
}
sprawdz('po kazdym przelaczeniu zmienna rowna sie zmierzonemu paskowi',
  slad.every(s => s.zmienna === s.zmierzona), slad);
sprawdz('…a paski tych modulow naprawde roznia sie wysokoscia (inaczej test nic nie sprawdza)',
  slad[0].zmienna !== slad[1].zmienna, slad);

console.log('\n- konsola');
sprawdz('zero bledow w konsoli', bledy.length === 0, bledy.slice(0, 6));

await przegladarka.close();
console.log('\n' + ok + ' passed, ' + zle + ' failed');
process.exit(zle ? 1 : 0);
