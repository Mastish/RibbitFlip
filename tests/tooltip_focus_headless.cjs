// DYMKI PRZY FOKUSIE Z KLAWIATURY (WCAG 1.4.13).
//
// Uruchomienie (git-bash, z katalogu repo):
//   NODE_PATH="$(npm root -g)" node tests/tooltip_focus_headless.cjs [url]
//     url — instancja panelu, domyślnie http://127.0.0.1:8813/ (symulacja, kapsel „Triki 1”)
//
// Wymaga: działającej instancji panelu i globalnego @playwright/test (NODE_PATH). NIE jest wpięty
// w zestaw testów py (tests/test_*.py), bo potrzebuje żywej instancji — to samodzielny skrypt.
// Kod wyjścia: 0 = wszystko PASS, 1 = przynajmniej jeden FAIL, 2 = instancja niedostępna.
//
// Co sprawdza: fokus z klawiatury pokazuje ten sam dymek, co najechanie myszą (dla przycisków-ikon
// pigułki kapsla jest on JEDYNĄ nazwą, jaką ma przycisk), Tab przenosi dymek na kolejny przycisk,
// sam modyfikator go nie chowa, Escape chowa — i nadal dochodzi do dialogu pod spodem (regresja
// 5.1/5.2), pole tekstowe dymka nie dostaje, a ruch myszą nie przestawia dymka spod fokusa.
// Przy okazji: 5.10 — regiony aria-live bąbla czaszki istnieją PUSTE zaraz po wczytaniu strony
// (to da się sprawdzić tylko na świeżej stronie, dlatego stoi tutaj, a nie w ux_walk_harness).
// NIC nie zapisuje: klikany jest wyłącznie „Edytuj" pigułki (okno zamykane Escape), POST /ui-lang
// panelu jest przechwycony lokalnie, każdy inny POST = FAIL.
//
// Styl asercji: check(name, cond, detail) → „PASS name” / „FAIL name — detail”, jak w tests/*.py.
const { chromium } = require("@playwright/test");
const URL = process.argv.slice(2).find(a => /^https?:\/\//.test(a)) || "http://127.0.0.1:8813/";
const LANG = process.argv.includes("--en") ? "en" : "pl";
let nPass = 0, nFail = 0;
function check(name, cond, detail) {
  if (cond) { nPass++; console.log("PASS " + name); }
  else { nFail++; console.log("FAIL " + name + (detail !== undefined ? " — " + String(detail).slice(0, 300) : "")); }
  return !!cond;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const tip = (page) => page.evaluate(() => {
  const t = document.getElementById("rf-tip");
  return t ? { disp: t.style.display, txt: (t.textContent || "").replace(/\s+/g, " ").trim(), left: t.style.left, top: t.style.top }
           : { disp: "brak", txt: "", left: "", top: "" };
});
const act = (page) => page.evaluate(() => { const a = document.activeElement;
  return a ? { id: a.id, cls: String(a.className || ""), al: a.getAttribute("aria-label") || "" } : null; });

(async () => {
  try { const r = await fetch(URL.replace(/\/?$/, "/health")); if (!r.ok) throw new Error(String(r.status)); }
  catch (e) { console.error("Instancja niedostępna: " + URL + " (" + e.message + ") — uruchom panel na tym porcie"); process.exit(2); }
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // `tourOffered`: jednorazowe zaproszenie do przewodnika (rf-39p, UX 261120) mówi przez region
  // alert przy pierwszym otwarciu w świeżej przeglądarce; ten test mierzy regiony bez niego.
  await ctx.addInitScript(l => { localStorage.setItem("ribbitflip.lang", l); localStorage.setItem("ribbitflip.tourOffered", "1"); }, LANG);
  const errs = [], posts = [];
  await ctx.route(/\/ui-lang$/, r => r.request().method() === "POST"
    ? r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, lang: LANG }) }) : r.continue());
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

  // (0) 5.10 — regiony odczytu powstają PUSTE, zanim jakakolwiek notka się pojawi
  const live0 = await page.evaluate(() => {
    const p = document.getElementById("rfNoteLive"), a = document.getElementById("rfNoteLiveAlert");
    return { p: !!p, a: !!a, pTxt: p ? p.textContent : null, aTxt: a ? a.textContent : null,
             pRole: p && p.getAttribute("role"), aRole: a && a.getAttribute("role") };
  });
  check("5.10 (0) #rfNoteLive i #rfNoteLiveAlert istnieją zaraz po wczytaniu i są puste",
    live0.p && live0.a && live0.pTxt === "" && live0.aTxt === "" && live0.pRole === "status" && live0.aRole === "alert",
    JSON.stringify(live0));

  // (1) fokus na przycisku-ikonie pigułki kapsla pokazuje dymek
  const first = await page.evaluate(() => {
    const b = document.querySelector(".rf-rcol .devpill .dp-act.dp-sleep") || document.querySelector(".rf-rcol .devpill .dp-act[data-rftip]");
    if (!b) return null; b.focus(); return { cls: b.className, al: b.getAttribute("aria-label") || "" };
  });
  if (!first) { console.error("Brak pigułki kapsla w prawej kolumnie — nie ma czego sprawdzać"); process.exit(2); }
  await sleep(200);
  let t = await tip(page);
  check("5.6 (1) fokus na „Uśpij” pokazuje dymek", t.disp === "block", JSON.stringify(t));
  check("5.6 (1) ...z tekstem równym nazwie dostępnej przycisku", t.txt === first.al.replace(/\s+/g, " ").trim(),
    JSON.stringify({ tip: t.txt, al: first.al }));

  // (2) Tab przenosi fokus na kolejną ikonę i dymek idzie razem z nim
  await page.keyboard.press("Tab"); await sleep(200);
  const a2 = await act(page); t = await tip(page);
  check("5.6 (2) Tab → kolejny przycisk pigułki", /dp-act/.test(a2.cls || ""), JSON.stringify(a2));
  check("5.6 (2) ...dymek nadal widoczny i mówi o NOWYM przycisku",
    t.disp === "block" && t.txt === (a2.al || "").replace(/\s+/g, " ").trim(), JSON.stringify({ t, a2 }));

  // (3) sam modyfikator nie chowa dymka, ruch myszą go nie przestawia
  const pos = { left: t.left, top: t.top };
  await page.keyboard.press("Shift"); await sleep(150);
  check("5.6 (3) Shift nie chowa dymka", (await tip(page)).disp === "block", JSON.stringify(await tip(page)));
  // Ruch myszy podajemy syntetycznie (page.mouse.move przejechałby po innych przyciskach z dymkiem,
  // a najechanie na NOWY przycisk ma prawo przejąć dymek — tu chodzi o sam ruch nad niczym).
  await page.evaluate(() => document.dispatchEvent(new MouseEvent("mousemove",
    { clientX: 320, clientY: 320, bubbles: true })));
  await sleep(200);
  t = await tip(page);
  check("5.6 (3) ruch myszą o 300 px nie przestawia dymka spod fokusa",
    t.disp === "block" && t.left === pos.left && t.top === pos.top,
    JSON.stringify({ pos, now: { disp: t.disp, left: t.left, top: t.top } }));

  // (4) klawisz, który coś robi, chowa dymek
  await page.keyboard.press("Escape"); await sleep(200);
  check("5.6 (4) Escape chowa dymek", (await tip(page)).disp === "none", JSON.stringify(await tip(page)));

  // (5) pole tekstowe z podpowiedzią NIE dostaje dymka (przykryłby to, co człowiek pisze)
  await page.evaluate(() => document.querySelector('button.tab-btn[data-tab="konfiguracje"]')?.click()); await sleep(600);
  await page.evaluate(() => document.getElementById("setupExe").focus()); await sleep(250);
  check("5.6 (5) #setupExe (pole z 200-znakową podpowiedzią) bez dymka", (await tip(page)).disp !== "block",
    JSON.stringify(await tip(page)));
  await page.evaluate(() => document.activeElement.blur());

  // (6) REGRESJA: Escape w oknie „Edytuj kapsel" nadal zamyka okno, choć keydown chowa też dymek
  await page.evaluate(() => document.querySelector('button.tab-btn[data-tab="mapowanie"]')?.click()); await sleep(400);
  const opened = await page.evaluate(() => {
    const p = document.querySelector(".rf-rcol .devpill[data-dev] .dp-edit"); if (!p) return false; p.click(); return true;
  });
  if (opened) {
    await sleep(500);
    await page.keyboard.press("Tab"); await sleep(150);
    const inDlg = await page.evaluate(() => !!(document.activeElement.closest && document.activeElement.closest("#devEdit")));
    check("5.6 (6) fokus krąży w oknie kapsla (dymek go nie wypycha)", inDlg, JSON.stringify(await act(page)));
    await page.keyboard.press("Escape"); await sleep(500);
    check("5.6 (6) Escape nadal zamyka okno „Edytuj kapsel” (dymek nie zjada klawisza)",
      await page.evaluate(() => getComputedStyle(document.getElementById("devEdit")).display === "none"));
  } else console.log("INFO 5.6 (6) pominięte — brak pigułki kapsla");

  check("5.6 0 błędów konsoli/strony", errs.length === 0, errs.join(" | "));
  check("5.6 0 POST do serwera (poza przechwyconym /ui-lang)", posts.length === 0, posts.join(" | "));
  await browser.close();
  console.log("\n" + nPass + " passed, " + nFail + " failed");
  process.exit(nFail ? 1 : 0);
})();
