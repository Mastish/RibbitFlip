// FOKUS I ESCAPE W EDYTORZE WYZWALACZA.
//
// Uruchomienie (git-bash, z katalogu repo):
//   NODE_PATH="$(npm root -g)" node tests/rule_editor_focus_harness.cjs [url]
//     url — instancja panelu, domyślnie http://127.0.0.1:8813/ (symulacja, kapsel „Triki 1”)
//
// Wymaga: działającej instancji panelu i globalnego @playwright/test (NODE_PATH). NIE jest wpięty
// w zestaw testów py (tests/test_*.py), bo potrzebuje żywej instancji — to samodzielny skrypt.
// Kod wyjścia: 0 = wszystko PASS, 1 = przynajmniej jeden FAIL, 2 = instancja niedostępna.
//
// Co sprawdza: „Nowy wyzwalacz” wprowadza fokus do pierwszego pola, Escape zamyka TYLKO nietknięty
// szkic (przy zmianach mówi o Anuluj/Zapisz), Escape podczas „⌨ Naciśnij klawisz…” nadal mapuje
// klawisz „esc”, a „Anuluj” oddaje fokus przyciskowi, który edytor otworzył — także na Kontrolerze.
// NIC nie zapisuje: „Zapisz” nie jest klikany, każdy scenariusz kończy Escape albo „Anuluj”.
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
// Przycisk startu Mapowania (UX 261120): kafel ruchu nie ma id, więc odpowiadamy jego atrybutem
// danych; drzwi „Ustaw ręcznie” mają id `trigDoorManual`.
const activeId = (page) => page.evaluate(() => { const a = document.activeElement; if (!a) return null;
  return a.id || (a.dataset && (a.dataset.gnew ? "gnew:" + a.dataset.gnew : a.dataset.tile ? "tile:" + a.dataset.tile : "")) || a.tagName; });
// Wybór ruchu jest pustym stanem listy, a przy regułach otwiera go „Nowy wyzwalacz” (P-G1-05).
const showStart = (page) => page.evaluate(() => { if (!document.querySelector("#trigStart")) document.getElementById("addRule")?.click(); });
const backOk = (id) => id === "addRule" || id === "trigDoorManual";
const edOpen = (page) => page.evaluate(() => getComputedStyle(document.getElementById("ruleEditor")).display);

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
  page.on("request", r => { if (r.method() === "POST" && !/\/ui-lang$/.test(r.url()) && !panelSelf(r)) posts.push(r.url() + " " + (r.postData() || "").slice(0, 60)); });
  await page.goto(URL, { waitUntil: "load" }); await sleep(1500);   // NIGDY networkidle (SSE /stream)
  await page.evaluate(() => document.querySelector('button.tab-btn[data-tab="mapowanie"]')?.click());
  await sleep(500);

  // (1) fokus wchodzi do edytora: „Ustaw ręcznie” → Nazwa; kafel ruchu → „Naciśnij klawisz…”
  await showStart(page); await sleep(300);
  await page.evaluate(() => { const b = document.querySelector('#trigStart [data-tile="lean-left"]'); b.focus(); b.click(); });
  await sleep(600);
  check("5.4 (1) kafel „Pochyl w lewo” → fokus na #edCap", (await activeId(page)) === "edCap", await activeId(page));
  await page.keyboard.press("Escape"); await sleep(400);
  check("5.4 (1) Escape na czystym szkicu z kafla zamyka edytor", (await edOpen(page)) === "none", await edOpen(page));
  await showStart(page); await sleep(300);
  await page.evaluate(() => { const b = document.querySelector('#trigStart [data-gnew="advanced"]'); b.focus(); b.click(); });
  await sleep(500);
  check("5.4 (1) „Ustaw ręcznie” → fokus na #edLabel", (await activeId(page)) === "edLabel", await activeId(page));

  // (2) Escape bez zmian zamyka i oddaje fokus
  await page.keyboard.press("Escape"); await sleep(400);
  check("5.4 (2) Escape na czystym szkicu zamyka edytor", (await edOpen(page)) === "none", await edOpen(page));
  check("5.4 (2) Escape oddaje fokus drzwiom albo #addRule", backOk(await activeId(page)), await activeId(page));

  // (3) Escape po zmianie NIE zamyka — mówi, co robić
  await showStart(page); await sleep(300);
  await page.evaluate(() => document.querySelector('#trigStart [data-gnew="advanced"]').click()); await sleep(500);
  await page.fill("#edLabel", "x"); await page.evaluate(() => document.getElementById("edLabel").dispatchEvent(new Event("input", { bubbles: true })));
  await sleep(150);
  await page.keyboard.press("Escape"); await sleep(400);
  check("5.4 (3) Escape na zmienionym szkicu NIE zamyka", (await edOpen(page)) === "block", await edOpen(page));
  // Komunikat edytora stoi w jego przyklejonej stopce (#edMsg, F-G1-06), nie w pasku nad listą.
  const msg = await page.$eval("#edMsg", e => (e.textContent || "").trim()).catch(() => "");
  check("5.4 (3) #edMsg mówi „Niezapisane zmiany — użyj Anuluj lub Zapisz”", /Niezapisane zmiany/.test(msg), msg);

  // (4) Escape podczas „⌨ Naciśnij klawisz…” mapuje klawisz esc, edytor zostaje
  await page.evaluate(() => document.getElementById("edCap")?.click()); await sleep(250);
  await page.keyboard.press("Escape"); await sleep(300);
  check("5.4 (4) Escape w trybie nauki klawisza → state._draft.keySpec === „esc”",
    (await page.evaluate(() => state._draft && state._draft.keySpec)) === "esc",
    await page.evaluate(() => state._draft && state._draft.keySpec));
  check("5.4 (4) edytor nadal otwarty", (await edOpen(page)) === "block", await edOpen(page));
  check("5.4 (4) #edCap wrócił do „⌨ Naciśnij klawisz…”",
    /Naciśnij klawisz/.test(await page.$eval("#edCap", e => e.textContent).catch(() => "")),
    await page.$eval("#edCap", e => e.textContent).catch(() => ""));

  // (5) „Anuluj” oddaje fokus
  await page.evaluate(() => document.getElementById("edCancel").click()); await sleep(400);
  check("5.4 (5) Anuluj → fokus drzwiom albo #addRule", backOk(await activeId(page)), await activeId(page));

  // (6) Kontroler: ten sam przebieg na #padRuleAdd
  await page.evaluate(() => document.querySelector('button.tab-btn[data-tab="kontroler"]')?.click()); await sleep(700);
  const hasAdd = await page.evaluate(() => { const b = document.getElementById("padRuleAdd"); return !!(b && b.offsetParent); });
  if (!hasAdd) console.log("INFO 5.4 (6) pominięte — #padRuleAdd niewidoczny (nie wybrano części pada)");
  else {
    await page.evaluate(() => { document.getElementById("padRuleAdd").focus(); document.getElementById("padRuleAdd").click(); });
    await sleep(600);
    check("5.4 (6) Kontroler: „Nowy wyzwalacz” → fokus na #edLabel", (await activeId(page)) === "edLabel", await activeId(page));
    await page.evaluate(() => document.getElementById("edCancel").click()); await sleep(400);
    check("5.4 (6) Kontroler: Anuluj → fokus na #padRuleAdd", (await activeId(page)) === "padRuleAdd", await activeId(page));
  }

  check("5.4 0 console.error / pageerror", errs.length === 0, errs.slice(0, 3).join(" | "));
  check("5.4 0 POST do serwera", posts.length === 0, posts.join(" | "));
  await ctx.close(); await browser.close();
  console.log(`TOTAL PASS=${nPass} FAIL=${nFail}`);
  process.exit(nFail ? 1 : 0);
})();
