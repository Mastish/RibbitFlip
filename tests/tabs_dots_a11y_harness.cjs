// STAN MODUŁU W NAWIGACJI NIE TYLKO KOLOREM (dostępność).
//
// Uruchomienie (git-bash, z katalogu repo):
//   NODE_PATH="$(npm root -g)" node tests/tabs_dots_a11y_harness.cjs [url]
//     url — instancja panelu, domyślnie http://127.0.0.1:8813/ (symulacja, kapsel „Triki 1”)
//
// Wymaga: działającej instancji panelu i globalnego @playwright/test (NODE_PATH). NIE jest wpięty
// w zestaw testów py (tests/test_*.py), bo potrzebuje żywej instancji — to samodzielny skrypt.
// Kod wyjścia: 0 = wszystko PASS, 1 = przynajmniej jeden FAIL, 2 = instancja niedostępna.
//
// Co sprawdza: kropka stanu przy pozycji nawigacji ma odpowiednik w OPISIE przycisku
// (aria-describedby → węzeł w `#rf-tipdesc`), a nie tylko w kolorze i dymku pod myszą; opis zmienia
// się razem ze stanem grupy i tłumaczy się na EN; nazwa pozycji zostaje samą etykietą (WCAG 2.5.3).
// NIC nie zapisuje na serwerze: stan grupy przestawiamy LOKALNIE (state.trigEnabled + updateTabDots)
// i przywracamy — przełącznik modułu NIE jest klikany.
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
// Opis dostępny = sklejone teksty węzłów z aria-describedby (tak liczą go czytniki ekranu).
const descOf = (page, tab) => page.evaluate(t => {
  const b = document.querySelector(`button.tab-btn[data-tab="${t}"]`); if (!b) return null;
  return (b.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean)
    .map(id => { const n = document.getElementById(id); return n ? n.textContent.trim() : ""; }).join(" ").trim();
}, tab);
const nameOf = (page, tab) => page.evaluate(t => {
  const b = document.querySelector(`button.tab-btn[data-tab="${t}"]`); if (!b) return null;
  return b.getAttribute("aria-label") || (b.textContent || "").replace(/\s+/g, " ").trim();
}, tab);

(async () => {
  try { const r = await fetch(URL.replace(/\/?$/, "/health")); if (!r.ok) throw new Error(String(r.status)); }
  catch (e) { console.error("Instancja niedostępna: " + URL + " (" + e.message + ") — uruchom panel na tym porcie"); process.exit(2); }
  const browser = await chromium.launch({ headless: true });
  for (const lang of ["pl", "en"]) {
    const en = lang === "en";
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(l => localStorage.setItem("ribbitflip.lang", l), lang);
    // Bez pierwszego pytania i zaproszenia do przewodnika (UX 261120 L23, D8): bąble czaszki nie wchodzą w pomiar.
    await ctx.addInitScript(() => { localStorage.setItem("ribbitflip.firstAsk", "juz"); localStorage.setItem("ribbitflip.tourOffered", "1"); });
    const errs = [], posts = [];
    await ctx.route(/\/ui-lang$/, r => r.request().method() === "POST"
      ? r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' }) : r.continue());
    // Dwa POST-y panel wysyła SAM, bez klikania, i to rozmyślnie — oba nie są zapisem z testowanej interakcji:
    //   /scan-preset/seed {…,"restore":false,"sync":true} — przy budowie karty skanera (rf-50j
    //     `loadScanPresets`: zestawy z aplikacji nadążają za wersją, raz na start strony),
    //   /device?dev=… {"cap":"…"} — kapsel bez wylosowanego kapsla dostaje go przy pierwszym spotkaniu
    //     (rf-08 `_ensureCap`), czyli na świeżej kopii Settings/.
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
    const L = `[${lang}] 5.5 `;

    const capsRe = en ? /(On|Off) for the selected capsule/ : /(Włączony|Wyłączony) na wybranym kapslu/;
    check(L + "„Mapowanie” ma opis o stanie na wybranym kapslu", capsRe.test(await descOf(page, "mapowanie")), await descOf(page, "mapowanie"));
    check(L + "nazwa „Mapowanie” zostaje samą etykietą (opis nie wszedł do nazwy)",
      !capsRe.test(await nameOf(page, "mapowanie")), await nameOf(page, "mapowanie"));

    // Lokalny flip stanu grupy — samo rysowanie, bez POST i bez klikania przełącznika.
    const before = await descOf(page, "mapowanie");
    await page.evaluate(() => { window.__rf55 = state.trigEnabled; state.trigEnabled = !state.trigEnabled; updateTabDots(); });
    await sleep(300);
    const after = await descOf(page, "mapowanie");
    check(L + "przeciwny stan grupy → przeciwny opis", capsRe.test(after) && after !== before, before + " → " + after);
    await page.evaluate(() => { state.trigEnabled = window.__rf55; updateTabDots(); });
    await sleep(300);
    check(L + "opis wrócił do stanu sprzed pomiaru", (await descOf(page, "mapowanie")) === before, await descOf(page, "mapowanie"));

    const rest = await descOf(page, "restapi");
    const sharedRe = en ? /(On|Off), shared by every capsule/ : /(Włączony|Wyłączony), wspólny dla wszystkich kapsli/;
    check(L + "„Usługi”: opis mówi „wspólny dla wszystkich kapsli”", sharedRe.test(rest), rest);
    check(L + "„Usługi”: opis zachował istniejący dymek rf-05 (dwa zdania, nie jedno)",
      rest.length > (en ? 40 : 40) && !sharedRe.test(rest.replace(sharedRe, "")), rest);

    // UX 261120 (F-G0-04): Skaner ma jeden włącznik na całą aplikację, więc mówi „wspólny”, jak Usługi.
    check(L + "„Skaner”: opis mówi „wspólny dla wszystkich kapsli”", sharedRe.test(await descOf(page, "skaner")), await descOf(page, "skaner"));
    // UX 261120 (F-G0-03): przy wstrzymanym sterowaniu włączony moduł nie świeci jak działający.
    // Sam `state.armed` podmieniony lokalnie (bez setArmed, więc bez POST).
    const heldRe = en ? /On, but control is paused/ : /Włączony, ale sterowanie jest wstrzymane/;
    const held = await page.evaluate(() => { window.__rfA = state.armed; window.__rfT = state.trigEnabled;
      state.trigEnabled = true; state.armed = false; updateTabDots();
      const d = document.querySelector('.tab-btn[data-tab="mapowanie"] .tab-dot');
      const r = { cls: d.className, row: !!document.querySelector("#rfOuts .rf-out-held") };
      state.armed = window.__rfA; state.trigEnabled = window.__rfT; updateTabDots(); return r; });
    check(L + "wstrzymane sterowanie: kropka `held`, a karta stanu mówi „nic nie wychodzi”",
      /(^| )held( |$)/.test(held.cls) && held.row, JSON.stringify(held));
    await page.evaluate(() => { state.trigEnabled = true; state.armed = false; updateTabDots(); });
    await sleep(200);
    const heldDesc = await descOf(page, "mapowanie");
    await page.evaluate(() => { state.armed = window.__rfA; state.trigEnabled = window.__rfT; updateTabDots(); });
    await sleep(200);
    check(L + "wstrzymane sterowanie: opis kropki mówi dlaczego", heldRe.test(heldDesc), heldDesc);

    check(L + "0 console.error / pageerror", errs.length === 0, errs.slice(0, 3).join(" | "));
    check(L + "0 POST do serwera", posts.length === 0, posts.join(" | "));
    await ctx.close();
  }
  await browser.close();
  console.log(`TOTAL PASS=${nPass} FAIL=${nFail}`);
  process.exit(nFail ? 1 : 0);
})();
