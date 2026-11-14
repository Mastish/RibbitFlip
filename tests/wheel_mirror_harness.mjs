// HARNESS DO KONTRAKTU „silnik ↔ lustro" (patrz tests/test_wheel_mirror.py).
//
// Puszcza scenariusze ręki przez PRAWDZIWĄ scenę podglądu w zakładce „Koło wyboru" i wypisuje na
// stdout jeden wiersz JSON-a: co scena wybrała i ile razy koło stanęło. Porównanie z silnikiem
// robi test w Pythonie — tutaj nie ma ani jednej asercji, żeby nie było dwóch miejsc, w których
// zapada ta sama decyzja.
//
// DLACZEGO PRAWDZIWA PRZEGLĄDARKA, a nie sam moduł: lustro jest wplecione w DOM (mierzy pojemnik,
// czyta konfigurację z panelu, rysuje SVG). Uruchomienie go „na sucho" wymagałoby wyciągnięcia
// logiki do osobnego modułu — czyli refaktoru, którego celowo nie robimy. Bez
// przeglądarki ten kontrakt sprawdzałby atrapę, a nie kod, który naprawdę chodzi u ludzi.
//
// Uruchomienie: node tests/wheel_mirror_harness.mjs <port> '<json scenariuszy>'
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { rfBezPierwszegoStartu } = require("./_rf_pierwszy_start.cjs");   // bez pytania i zaproszenia pierwszego startu

const PORT = process.argv[2] || "8793";
const SCEN = JSON.parse(process.argv[3] || "[]");

// Playwright bierzemy z globalnej instalacji npm — repo nie ma package.json i nie ma dostać go
// dla jednego testu. Ścieżkę da się nadpisać zmienną, gdyby npm mieszkał gdzie indziej.
const PW = process.env.RF_PLAYWRIGHT
  || (process.env.APPDATA ? process.env.APPDATA + "/npm/node_modules/@playwright/test" : "@playwright/test");
const { chromium } = require(PW);

const b = await chromium.launch({ headless: true });
const pg = await rfBezPierwszegoStartu(b.newPage({ viewport: { width: 1680, height: 1000 } }));
await pg.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "domcontentloaded" });
await pg.waitForTimeout(2500);
// ⚠️ POZIOMEGO PASKA ZAKŁADEK NIE MA OD 2026-08-29 (przebudowa na trzy kolumny: nawigacja stoi
// pionowo w lewej kolumnie). Ten harness klikał `.tabbar [data-tab="kolo"]`, czyli nic — i to był
// błąd, który MILCZY: zakładka zostaje `display:none`, pojemnik sceny ma 0×0, promień wychodzi 0,
// więc każdy „ruch myszy" ląduje w tym samym punkcie i scena nigdy nie otwiera koła. Test
// zgłaszał to jako pięć rozjazdów silnika z lustrem (zmierzone 2026-09-02: picks [] vs [0],
// opens 0 vs 1) — czyli szukał usterki w kole, której tam nie było.
// Wejście idzie więc udokumentowaną drogą (`setTabById`), a gdyby jej kiedyś zabrakło — przez
// przycisk nawigacji, gdziekolwiek stoi.
// ⚠️ ŚWIEŻA KOPIA Settings/ (16.10) nie ma ani jednego wycinka, a koło poniżej dwóch wycinków nie
// rysuje sceny (rf-46d3 „KOŁA JESZCZE NIE MA") — #whPreview zostawał 0×0 i harness czekał 15 s na
// wymiar, którego nie będzie, a test_wheel_mirror.py zgłaszał cztery pominięcia. Wtedy kładziemy te
// same cztery wycinki, na których biegnie silnik w teście (SL4), i oddajemy pustą listę na końcu.
await pg.evaluate(() => {
  const sl = (state.wheel && state.wheel.slices) || [];
  if (sl.length >= 2) return;
  window.__wmKeepSlices = JSON.parse(JSON.stringify(sl));
  state.wheel.slices = [{ label: "Góra", spec: "up" }, { label: "Prawo", spec: "right" },
                        { label: "Dół", spec: "down" }, { label: "Lewo", spec: "left" }];
});
await pg.evaluate(() => {
  if (typeof window.setTabById === "function") { window.setTabById("kolo"); return; }
  document.querySelector('[data-tab="kolo"]')?.click();
});
// Podstawione wycinki trzeba jeszcze przerysować: scena odsłania się w `whSync`, nie przy wejściu.
await pg.evaluate(() => { if (window.__wmKeepSlices && typeof whSync === "function") whSync(); });
// …a potem CZEKAMY NA WYMIAR, zamiast na okrągłą liczbę milisekund. Scena rysuje się z rozmiaru
// pojemnika, więc dopóki go nie ma, nie ma czego prowadzić myszą.
await pg.waitForFunction(() => {
  const h = document.getElementById("whPreview");
  return !!h && h.getBoundingClientRect().width > 40;
}, null, { timeout: 15000 });
await pg.waitForTimeout(600);

const out = await pg.evaluate(async (scen) => {
  const res = {};
  const sc = document.getElementById("whScene");
  const host = document.getElementById("whPreview");
  const S = state.wheelStage;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  // ⚠️ TEN TEST PISZE DO KONFIGURACJI KOŁA (przestawia sposób sterowania i czas), a ta jest
  // zapisywana na dysk. Bierzemy więc kopię PRZED i oddajemy ją na końcu — także wtedy, gdy coś
  // po drodze wybuchnie. Test, który zostawia człowiekowi inny tryb koła, niż zastał, jest
  // gorszy od braku testu.
  const KEEP = { confirm: state.wheel.confirm, confirmMs: state.wheel.confirmMs };
  const labels = (state.wheel.slices || []).map(x => String(x.label || ""));

  for (const s of scen) {
    // Czysty start: koło zamknięte, kursor poza sceną (co ROZBRAJA próg — tak jak ręka, która
    // jeszcze nie powiedziała „stoję prosto").
    state.wheel.confirm = s.mode;
    state.wheel.confirmMs = s.confirmMs;
    whSync(); commitWheel();
    await sleep(350);
    whStageClose();
    sc.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
    await sleep(250);
    S.log.length = 0;

    let opens = 0, was = S.open;
    const watch = setInterval(() => { if (S.open && !was) opens++; was = S.open; }, 16);

    const r = host.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    // Promień, o którym scena myśli — ten sam, którym liczy wskazanie. Bez niego `mag` z
    // scenariusza znaczyłby co innego tu, a co innego w silniku.
    const R = _whStageR(host, { look: state.wheel.look });

    for (const [ms, mag, ang] of s.steps) {
      const a = ang * Math.PI / 180;
      const x = cx + mag * R * Math.sin(a), y = cy - mag * R * Math.cos(a);
      const t0 = Date.now();
      // Ruch myszy powtarzany co ~20 ms: prawdziwa ręka też nie teleportuje się raz na krok, a
      // scena liczy wskazanie ze zdarzeń, nie z zegara.
      while (Date.now() - t0 < ms) {
        sc.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: x, clientY: y }));
        await sleep(20);
      }
    }
    clearInterval(watch);
    // NUMER WYCINKA, nie jego nazwa. Scena chodzi po kole, które ten człowiek ma naprawdę
    // ustawione (test niczego mu nie podmienia), więc jedyne, co da się porównać z silnikiem
    // biegnącym na własnych czterech wycinkach, to KTÓRY po kolei został wybrany. Dziennik trzyma
    // wpisy od najnowszego, a kontrakt porównuje kolejność wysyłki — stąd odwrócenie.
    res[s.name] = { picks: S.log.slice().reverse().map(e => labels.indexOf(e.p)), opens };
  }
  state.wheel.confirm = KEEP.confirm; state.wheel.confirmMs = KEEP.confirmMs;
  if (window.__wmKeepSlices) { state.wheel.slices = window.__wmKeepSlices; delete window.__wmKeepSlices; }
  whSync(); commitWheel();
  await sleep(300);
  return res;
}, SCEN);

console.log(JSON.stringify(out));
await b.close();
