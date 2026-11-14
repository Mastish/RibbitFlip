// FOKUS W DIALOGACH rfModal.
//
// Uruchomienie (git-bash, z katalogu repo):
//   NODE_PATH="$(npm root -g)" node tests/modal_focus_harness.cjs [url]
//     url — instancja panelu, domyślnie http://127.0.0.1:8813/ (symulacja, kapsel „Triki 1”)
//
// Wymaga: działającej instancji panelu i globalnego @playwright/test (NODE_PATH). NIE jest wpięty
// w zestaw testów py (tests/test_*.py), bo potrzebuje żywej instancji — to samodzielny skrypt.
// Kod wyjścia: 0 = wszystko PASS, 1 = przynajmniej jeden FAIL, 2 = instancja niedostępna.
//
// Co sprawdza: rfModal (Uwaga / Potwierdź / pytanie o nazwę) zabiera fokus do karty, NIE pozwala mu
// wyjść Tabem w tło i ODDAJE go temu, kto dialog otworzył. Dialogi są czystym DOM-em (rf-06-modals.js)
// — skrypt woła je z konsoli strony, NIC nie zapisuje na serwerze (0 POST poza tymi, które panel
// wysyła sam przy starcie: /ui-lang).
//
// Styl asercji: check(name, cond, detail) → „PASS name” / „FAIL name — detail”, jak w tests/*.py.
const { chromium } = require("@playwright/test");
const URL = process.argv.slice(2).find(a => /^https?:\/\//.test(a)) || "http://127.0.0.1:8813/";
let nPass = 0, nFail = 0;
function check(name, cond, detail) {
  if (cond) { nPass++; console.log("PASS " + name); }
  else { nFail++; console.log("FAIL " + name + (detail !== undefined ? " — " + String(detail).slice(0, 300) : "")); }
  return !!cond;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
// Punkt startowy: „Nowy wyzwalacz”, a na pustym Mapowaniu (pasek schowany, UX 261120) pierwszy
// kafel wyboru ruchu. Oba są zwykłym przyciskiem karty, o to tu chodzi.
const focusStart = (page) => page.evaluate(() => {
  const a = document.getElementById("addRule");
  (a && a.offsetParent ? a : document.querySelector("#trigStart [data-tile]"))?.focus();
});
const isStart = (a) => !!a && (a.id === "addRule" || /rf-pick/.test(a.cls || ""));
const active = (page) => page.evaluate(() => {
  const a = document.activeElement;
  return a ? { id: a.id, cls: a.className, tag: a.tagName, inCard: !!(a.closest && a.closest(".rfm-card")) } : null;
});

(async () => {
  try { const r = await fetch(URL.replace(/\/?$/, "/health")); if (!r.ok) throw new Error(String(r.status)); }
  catch (e) { console.error("Instancja niedostępna: " + URL + " (" + e.message + ") — uruchom panel na tym porcie"); process.exit(2); }
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => localStorage.setItem("ribbitflip.lang", "pl"));
  // Bez pierwszego pytania i zaproszenia do przewodnika (UX 261120 L23, D8): bąble czaszki nie wchodzą w fokus.
  await ctx.addInitScript(() => { localStorage.setItem("ribbitflip.firstAsk", "juz"); localStorage.setItem("ribbitflip.tourOffered", "1"); });
  const errs = [], posts = [];
  // Żaden scenariusz nie klika niczego, co zapisuje — ale POST-y liczymy, bo Settings/ jest wspólne.
  await ctx.route(/\/ui-lang$/, r => r.request().method() === "POST"
    ? r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true,"lang":"pl"}' }) : r.continue());
  // Dwa POST-y panel wysyła SAM, bez klikania, i to rozmyślnie — oba nie są zapisem z testowanej interakcji:
  //   /scan-preset/seed {…,"restore":false,"sync":true} — przy budowie karty skanera (rf-50j
  //     `loadScanPresets`: zestawy z aplikacji nadążają za wersją, raz na start strony),
  //   /device?dev=… {"cap":"…"} — kapsel bez wylosowanego kapsla dostaje go przy pierwszym spotkaniu
  //     (rf-08 `_ensureCap`), czyli na świeżej kopii Settings/.
  //   /ui-active {"dev":…} — panel mówi serwerowi, który kapsel ma teraz aktywny (rf-11, pamięć
  //     serwera na czas sesji, nic nie trafia do Settings/).
  // Odpowiadamy lokalnie (lista z GET /scan-presets; {ok:true}), żeby nie dotykały Settings/ instancji.
  const panelSelf = r => (/\/scan-preset\/seed$/.test(r.url()) && /"restore":false,"sync":true/.test(r.postData() || ""))
    || (/\/device\?dev=[^&]+$/.test(r.url()) && /^\{"cap":"[^"]*"\}$/.test(r.postData() || ""))
    || /\/ui-active$/.test(r.url());
  await ctx.route(/\/(scan-preset\/seed|device\?dev=[^&]+|ui-active)$/, async route => {
    const r = route.request();
    if (r.method() !== "POST" || !panelSelf(r)) return route.continue();
    let st = {};
    if (/seed$/.test(r.url())) try { st = await (await ctx.request.get(URL.replace(/\/?$/, "/scan-presets"))).json(); } catch (e) { }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, added: 0, updated: 0, ...st }) });
  });
  const page = await ctx.newPage();
  page.on("console", m => { if (m.type() === "error") errs.push(m.text().slice(0, 200)); });
  page.on("pageerror", e => errs.push(String(e).slice(0, 200)));
  page.on("request", r => { if (r.method() === "POST" && !/\/ui-lang$/.test(r.url()) && !panelSelf(r)) posts.push(r.url()); });
  await page.goto(URL, { waitUntil: "load" }); await sleep(1500);   // NIGDY networkidle (SSE /stream)
  await page.evaluate(() => document.querySelector('button.tab-btn[data-tab="mapowanie"]')?.click());
  await sleep(500);

  // --- 1. rfAlert: Tab krąży w karcie, Escape oddaje fokus nadawcy ---------------------------
  await focusStart(page);
  check("5.1 punkt startowy: fokus na przycisku startu", isStart(await active(page)), JSON.stringify(await active(page)));
  await page.evaluate(() => { window._t5 = rfAlert("Test dostępności"); });
  await sleep(300);
  check("5.1 rfAlert: fokus wszedł do .rfm-card", (await active(page))?.inCard === true, JSON.stringify(await active(page)));
  let out = [];
  for (let i = 0; i < 6; i++) { await page.keyboard.press("Tab"); await sleep(60); out.push((await active(page))?.inCard); }
  check("5.1 rfAlert: 6× Tab nie wychodzi z karty", out.every(Boolean), JSON.stringify(out));
  await page.keyboard.press("Escape"); await sleep(400);
  check("5.1 rfAlert: Escape zamyka i oddaje fokus przyciskowi startu", isStart(await active(page)), JSON.stringify(await active(page)));
  check("5.1 rfAlert: karta zniknęła z DOM", await page.evaluate(() => !document.querySelector(".rfm-card")));

  // --- 2. rfModal z polem: Enter zatwierdza, fokus wraca -------------------------------------
  await focusStart(page);
  await page.evaluate(() => { window._t5 = rfModal({ title: "Nazwa", input: { value: "abc" } }); });
  await sleep(300);
  check("5.1 rfModal(input): fokus w polu .rfm-in", (await active(page))?.cls?.includes("rfm-in") === true, JSON.stringify(await active(page)));
  await page.keyboard.press("Enter"); await sleep(400);
  check("5.1 rfModal(input): Enter → obietnica „abc”", (await page.evaluate(() => window._t5)) === "abc", await page.evaluate(() => window._t5));
  check("5.1 rfModal(input): fokus wrócił na przycisk startu", isStart(await active(page)), JSON.stringify(await active(page)));

  // --- 3. pusta nazwa: wyszarzony przycisk główny pomijany w cyklu Tab ------------------------
  await focusStart(page);
  await page.evaluate(() => { window._t5 = rfModal({ title: "Nazwa", input: { value: "" }, actions: [{ label: "Anuluj", value: false, variant: "ghost" }, { label: "Zapisz", value: true, variant: "primary" }] }); });
  await sleep(300);
  const prim = await page.evaluate(() => { const b = document.querySelector(".rfm-card .rfm-btn.primary"); return b ? b.disabled : null; });
  check("5.1 rfModal(pusta nazwa): przycisk główny wyszarzony", prim === true, String(prim));
  await page.evaluate(() => document.querySelector(".rfm-card .rfm-in")?.focus());
  await page.keyboard.press("Shift+Tab"); await sleep(120);
  const back1 = await active(page);
  check("5.1 rfModal(pusta nazwa): Shift+Tab z pola → Anuluj (disabled pominięty)",
    back1?.inCard === true && /ghost/.test(back1.cls || ""), JSON.stringify(back1));
  await page.keyboard.press("Escape"); await sleep(400);
  check("5.1 rfModal(pusta nazwa): Escape → null", (await page.evaluate(() => window._t5)) === null, JSON.stringify(await page.evaluate(() => window._t5)));
  check("5.1 rfModal(pusta nazwa): fokus wrócił na przycisk startu", isStart(await active(page)), JSON.stringify(await active(page)));

  // --- 4. dialog otwarty bez nadawcy nie kradnie fokusa po zamknięciu -------------------------
  await page.evaluate(() => { document.activeElement && document.activeElement.blur(); window._t5 = rfAlert("Bez nadawcy"); });
  await sleep(300); await page.keyboard.press("Escape"); await sleep(400);
  check("5.1 bez nadawcy: po Escape fokus na body (nic nie porwane)",
    await page.evaluate(() => document.activeElement === document.body || !document.activeElement), JSON.stringify(await active(page)));

  check("5.1 0 console.error / pageerror", errs.length === 0, errs.slice(0, 3).join(" | "));
  check("5.1 0 POST do serwera", posts.length === 0, posts.join(" | "));
  await ctx.close(); await browser.close();
  console.log(`TOTAL PASS=${nPass} FAIL=${nFail}`);
  process.exit(nFail ? 1 : 0);
})();
