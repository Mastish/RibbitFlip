// FOKUS W OKNIE „EDYTUJ KAPSEL” (#devEdit).
//
// Uruchomienie (git-bash, z katalogu repo):
//   NODE_PATH="$(npm root -g)" node tests/devedit_focus_harness.cjs [url]
//     url — instancja panelu, domyślnie http://127.0.0.1:8813/ (symulacja, kapsel „Triki 1”)
//
// Wymaga: działającej instancji panelu i globalnego @playwright/test (NODE_PATH). NIE jest wpięty
// w zestaw testów py (statyczny odczyt źródła robi tests/devices_hub_harness.mjs) — to samodzielny
// skrypt. Kod wyjścia: 0 = wszystko PASS, 1 = przynajmniej jeden FAIL, 2 = instancja niedostępna.
//
// Co sprawdza: okno jest dialogiem (role/aria-modal/aria-labelledby), fokus wchodzi do pola nazwy,
// Tab krąży wewnątrz, Escape zamyka i oddaje fokus ołówkowi pigułki. NIC nie zapisuje: „Zapisz”,
// „Usuń kapsel” i przełączniki NIE są klikane, okno zamykamy wyłącznie Escape/Anuluj.
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
const activeId = (page) => page.evaluate(() => {
  const a = document.activeElement; if (!a) return null;
  return a.id || (a.className && String(a.className).split(" ").filter(Boolean).join(".")) || a.tagName;
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

  const dev = await page.evaluate(() => { const p = document.querySelector(".rf-rcol .devpill[data-dev]"); return p ? p.dataset.dev : null; });
  if (!check("5.2 jest pigułka kapsla w prawej kolumnie", !!dev, String(dev))) {
    console.log(`TOTAL PASS=${nPass} FAIL=${nFail}`); await browser.close(); process.exit(1);
  }
  // Otwarcie klawiaturą: fokus na ołówku pigułki + Enter — dokładnie tak, jak zrobi to użytkownik.
  await page.evaluate(d => document.querySelector(`.rf-rcol .devpill[data-dev="${d}"] .dp-edit`).focus(), dev);
  await page.keyboard.press("Enter"); await sleep(500);

  check("5.2 #devEdit ma [role=dialog][aria-modal=true][aria-labelledby=deTitle] i #deTitle",
    await page.evaluate(() => !!document.querySelector('#devEdit [role="dialog"][aria-modal="true"][aria-labelledby="deTitle"]') && !!document.getElementById("deTitle")));
  check("5.2 fokus wszedł do #deName", (await activeId(page)) === "deName", await activeId(page));

  const seq = [];
  for (let i = 0; i < 6; i++) { await page.keyboard.press("Tab"); await sleep(80); seq.push(await activeId(page)); }
  check("5.2 Tab: deColor → deLabel → deForget → deCancel → deSave → z powrotem deName",
    JSON.stringify(seq) === JSON.stringify(["deColor", "deLabel", "deForget", "deCancel", "deSave", "deName"]), JSON.stringify(seq));
  await page.keyboard.press("Shift+Tab"); await sleep(80);
  check("5.2 Shift+Tab z #deName zawija na #deSave", (await activeId(page)) === "deSave", await activeId(page));

  await page.keyboard.press("Escape"); await sleep(400);
  check("5.2 Escape chowa okno (display:none)",
    await page.evaluate(() => getComputedStyle(document.getElementById("devEdit")).display === "none"));
  check("5.2 Escape oddaje fokus ołówkowi tej samej pigułki",
    await page.evaluate(d => document.activeElement === document.querySelector(`.rf-rcol .devpill[data-dev="${d}"] .dp-edit`), dev), await activeId(page));

  // Anuluj — druga droga wyjścia, ta sama zasada.
  await page.evaluate(d => document.querySelector(`.rf-rcol .devpill[data-dev="${d}"] .dp-edit`).click(), dev);
  await sleep(400);
  await page.evaluate(() => document.getElementById("deCancel").click()); await sleep(400);
  check("5.2 Anuluj też oddaje fokus ołówkowi pigułki",
    await page.evaluate(d => document.activeElement === document.querySelector(`.rf-rcol .devpill[data-dev="${d}"] .dp-edit`), dev), await activeId(page));

  check("5.2 0 console.error / pageerror", errs.length === 0, errs.slice(0, 3).join(" | "));
  check("5.2 0 POST do serwera", posts.length === 0, posts.join(" | "));
  await ctx.close(); await browser.close();
  console.log(`TOTAL PASS=${nPass} FAIL=${nFail}`);
  process.exit(nFail ? 1 : 0);
})();
