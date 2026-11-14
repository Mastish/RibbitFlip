// KASETY ZESTAWÓW — sprawdzenie w żywym panelu (rf-28e, 2026-11-22).
//
// Uruchomienie (git-bash, z katalogu repo, przy DZIAŁAJĄCEJ instancji w symulacji):
//   NODE_PATH="$(npm root -g)" node tests/kasety_harness.mjs [url] [--shots KATALOG]
//     url      — instancja panelu, domyślnie http://127.0.0.1:8813/ (symulacja z zamkniętymi wyjściami)
//     --shots  — katalog na zrzuty (domyślnie bez zrzutów)
//
// Wymaga globalnego @playwright/test (NODE_PATH albo RF_PLAYWRIGHT), przeglądarka bez okna. NIE jest
// wpięty w tests/test_*.py, bo potrzebuje żywego serwera. Kod wyjścia: 0 = PASS, 1 = FAIL, 2 = brak panelu.
//
// Co sprawdza, po kolei, tak jak człowiek przechodzi przez moduł:
//   1. nawigacja i pasek zakładek Zestawów mają ikonę kasety,
//   2. każdy zestaw na liście Biblioteki jest kasetą (zestawy z aplikacji mają swoje numery),
//   3. podgląd zestawu: duża kaseta, opis od twórcy i „Co robi" z regułami z pliku,
//   4. wybór kasety przy zapisie: przycisk, okienko z 8 kasetami, wybór 5 → zapis → plik ma `cassette: 5`,
//      a nadpisanie bez ruszania wyboru zostawia kasetę zapisanej wersji,
//   5. stary plik bez pola: na liście i w podglądzie kaseta 1, nie „uszkodzony"; import starego pliku
//      i pliku z kasetą 7 pokazuje w oknie importu właściwą kasetę,
//   6. wczytanie zestawu z Biblioteki → po przeładowaniu gra scena: kaseta wsuwa się, szpule się kręcą,
//      „Wczytane", warstwa nie łapie myszy i znika sama,
//   7. `prefers-reduced-motion`: scena bez ruchu.
// Po sobie sprząta: usuwa zapisane zestawy testowe i plik starego zestawu z Library/Setups.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { rfBezPierwszegoStartu } = require("./_rf_pierwszy_start.cjs");

const argv = process.argv.slice(2);
const flagVal = (n, d) => { const i = argv.indexOf(n); return (i >= 0 && argv[i + 1]) ? argv[i + 1] : d; };
const URL = argv.find(a => /^https?:\/\//.test(a)) || "http://127.0.0.1:8813/";
const SHOTS = flagVal("--shots", "");
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SETUPS = path.join(ROOT, "Library", "Setups");
const PW = process.env.RF_PLAYWRIGHT
  || (process.env.APPDATA ? process.env.APPDATA + "/npm/node_modules/@playwright/test" : "@playwright/test");
const { chromium } = require(PW);

let nPass = 0, nFail = 0;
function check(name, cond, detail) {
  if (cond) { nPass++; console.log("PASS " + name); }
  else { nFail++; console.log("FAIL " + name + (detail !== undefined ? " — " + String(detail).slice(0, 300) : "")); }
  return !!cond;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function shot(page, name, opts) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot(Object.assign({ path: path.join(SHOTS, name + ".png") }, opts || {}));
}
async function clipOf(page, sel, pad) {
  const b = await page.locator(sel).first().boundingBox();
  if (!b) return undefined;
  const p = pad || 0;
  return { x: Math.max(0, b.x - p), y: Math.max(0, b.y - p), width: b.width + 2 * p, height: b.height + 2 * p };
}

try { const r = await fetch(URL + "library"); if (!r.ok) throw new Error(r.status); }
catch (e) { console.log("Brak panelu pod " + URL + " (" + e + ")"); process.exit(2); }

const T_SAVE = "Kaseta test 5";
const T_OLD = "Stary bez kasety";
const OLD = { app: "ribbitflip", kind: "setup", version: 1, appVersion: "1.0.0", name: T_OLD,
  description: "Plik zapisany przed kasetami: nie ma pola cassette.", forApp: "Test", author: "harness", rev: 1,
  config: { rules: [{ id: "r1", label: "Skok", enabled: true, source: { kind: "button" }, op: ">=", value: 1,
    keySpec: "space", behavior: "tap" }], trigEnabled: true } };
const rm = n => { try { fs.unlinkSync(path.join(SETUPS, n + ".json")); } catch (e) { } };

const browser = await chromium.launch();
try {
  fs.mkdirSync(SETUPS, { recursive: true });
  fs.writeFileSync(path.join(SETUPS, T_OLD + ".json"), JSON.stringify(OLD, null, 2), "utf-8");
  rm(T_SAVE);

  const ctx = await rfBezPierwszegoStartu(browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }));
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push(String(e)));
  await page.goto(URL);
  await page.waitForSelector('.tab-btn[data-tab="konfiguracje"]');
  await page.click('.tab-btn[data-tab="konfiguracje"]');
  await page.waitForSelector('.lib-row[data-kind="setup"] .lib-kaseta');
  await sleep(600);

  // 1. ikona
  const icons = await page.evaluate(() => ({
    nav: getComputedStyle(document.querySelector('.tab-btn[data-tab="konfiguracje"] .rfic')).backgroundImage,
    pill: (function () { const i = document.querySelector('#tab-konfiguracje .rfpc-tab-ic.is-main'); return i ? getComputedStyle(i).backgroundImage : ""; })(),
  }));
  check("nawigacja: ikona kasety", /icons\/kaseta\.png/.test(icons.nav), icons.nav);
  check("pasek zakładek Zestawów: ikona kasety", /icons\/kaseta\.png/.test(icons.pill), icons.pill);

  // 2. lista
  const rows = await page.evaluate(() => [...document.querySelectorAll('.lib-row[data-kind="setup"]')].map(r => {
    const im = r.querySelector("img.lib-kaseta");
    return { name: r.dataset.name, src: im && im.getAttribute("src"), ok: !!(im && im.naturalWidth > 0), alt: im && im.alt };
  }));
  check("każdy zestaw na liście jest kasetą", rows.length >= 5 && rows.every(r => r.src && r.ok), JSON.stringify(rows));
  const byName = n => rows.find(r => r.name === n) || {};
  check("„Media - cztery strony” = kaseta 3", /kasety\/3-160\.png$/.test(byName("Media - cztery strony").src || ""), byName("Media - cztery strony").src);
  check("„Pad na jeden kapsel (start)” = kaseta 8", /kasety\/8-160\.png$/.test(byName("Pad na jeden kapsel (start)").src || ""));
  check("stary plik bez pola = kaseta 1", /kasety\/1-160\.png$/.test(byName(T_OLD).src || ""), byName(T_OLD).src);
  check("kaseta ma nazwę dla czytnika", /^Kaseta 3: /.test(byName("Media - cztery strony").alt || ""), byName("Media - cztery strony").alt);
  await shot(page, "1-nawigacja-i-lista", { clip: { x: 0, y: 40, width: 1080, height: 860 } });

  // 3. podgląd
  await page.click('.lib-row[data-kind="setup"][data-name="Media - cztery strony"]');
  await page.waitForSelector("#libDetail .kas-hero img.kas-hero-img");
  await page.waitForSelector("#libDetail .kas-co .lib-rule", { timeout: 8000 }).catch(() => {});
  const det = await page.evaluate(() => {
    const d = document.getElementById("libDetail");
    return { hero: d.querySelector(".kas-hero-img").getAttribute("src"), h: d.querySelector(".kas-hero-h").textContent,
             desc: d.querySelector(".kas-hero .lib-ddesc").textContent, rules: d.querySelectorAll(".kas-co .lib-rule").length,
             co: d.querySelector(".kas-co .lib-sec").textContent,
             n1: (d.querySelector(".kas-co .kas-rule-n") || {}).textContent, d1: (d.querySelector(".kas-co .kas-rule-d") || {}).textContent,
             btn: !!d.querySelector(".kas-hero-btn") };
  });
  check("podgląd: duża kaseta 3", /kasety\/3-360\.png$/.test(det.hero), det.hero);
  check("podgląd: opis od twórcy", det.h === "Opis od twórcy" && det.desc.length > 20, det.h + " | " + det.desc);
  check("podgląd: „Co robi” z regułami z pliku", det.co === "Co robi" && det.rules === 5, det.co + " " + det.rules);
  check("„Co robi”: nazwa reguły od autora na górze, warunek → akcja pod nią",
        det.n1 === "Następny utwór (przechył w prawo)" && /→/.test(det.d1 || ""), JSON.stringify([det.n1, det.d1]));
  check("zestaw z aplikacji: kaseta nie jest przyciskiem zmiany", det.btn === false);
  await page.hover("#libDetail .kas-hero-fig");
  await sleep(500);
  const spin = await page.evaluate(() => [...document.querySelectorAll("#libDetail .kas-hero .kas-reel")].map(r => getComputedStyle(r).animationName));
  check("najechanie na dużą kasetę kręci szpulami", spin.length === 2 && spin.every(a => a === "kas-spin-loop"), JSON.stringify(spin));
  await page.mouse.move(5, 5);
  await page.locator("#libDetail").scrollIntoViewIfNeeded();
  await shot(page, "2-podglad-zestawu", { clip: await clipOf(page, "#libDetail", 8) });

  await page.click('.lib-row[data-kind="setup"][data-name="' + T_OLD + '"]');
  await page.waitForSelector("#libDetail .kas-hero img.kas-hero-img");
  const oldDet = await page.evaluate(() => ({ src: document.querySelector("#libDetail .kas-hero-img").getAttribute("src"),
    bad: !!document.querySelector("#libDetail .lib-ctx.bad") }));
  check("podgląd starego pliku: kaseta 1, plik czytelny", /kasety\/1-360\.png$/.test(oldDet.src) && !oldDet.bad, JSON.stringify(oldDet));

  // 4. wybór kasety przy zapisie
  await page.locator("#setupSaveRow").scrollIntoViewIfNeeded();
  check("pasek zapisu: przycisk Kaseta", await page.locator("#setupKasetaBtn").isVisible());
  const btnBox = await page.locator("#setupKasetaBtn").boundingBox();
  const saveBox = await page.locator("#setupSave").boundingBox();
  check("przycisk kasety tej samej wysokości co Zapisz zestaw", btnBox && saveBox && Math.abs(btnBox.height - saveBox.height) <= 1,
        JSON.stringify([btnBox && btnBox.height, saveBox && saveBox.height]));
  // Przycisk kasety nie może zepchnąć „Wymiany" do drugiego wiersza przy oknie 1100 px (przed nim mieściła się).
  await page.setViewportSize({ width: 1100, height: 900 });
  await sleep(300);
  const row1100 = await page.evaluate(() => ["setupName", "setupKasetaBtn", "setupSave", "setupShare"].map(id => {
    const r = document.getElementById(id).getBoundingClientRect(); return Math.round(r.top + r.height / 2); }));
  check("1100 px: nazwa, kaseta, zapis i Wymiana w jednym wierszu", Math.max(...row1100) - Math.min(...row1100) <= 2, JSON.stringify(row1100));
  await page.setViewportSize({ width: 1440, height: 900 });
  await sleep(300);
  await page.locator("#setupSaveRow").scrollIntoViewIfNeeded();
  await page.click("#setupKasetaBtn");
  await page.waitForSelector(".kas-pop .kas-opt");
  const pop = await page.evaluate(() => ({ n: document.querySelectorAll(".kas-pop .kas-opt").length,
    on: document.querySelector(".kas-pop .kas-opt.on") && document.querySelector(".kas-pop .kas-opt.on").dataset.k,
    radio: document.querySelector(".kas-pop .kas-grid").getAttribute("role") }));
  // PODPOWIEDŹ: nowa nazwa (pole puste) = kaseta najrzadziej używana na liście, remis = niższy numer.
  const hint = (() => { const c = {}; for (let k = 1; k <= 8; k++) c[k] = 0;
    rows.forEach(r => { const m = /kasety\/(\d)-160/.exec(r.src || ""); if (m) c[+m[1]]++; });
    let b = 1; for (let k = 1; k <= 8; k++) if (c[k] < c[b]) b = k; return String(b); })();
  check("okienko: 8 kaset, radiogroup, zaznaczona podpowiedź (najrzadsza: " + hint + ")",
        pop.n === 8 && pop.radio === "radiogroup" && pop.on === hint, JSON.stringify(pop));
  await page.hover('.kas-pop .kas-opt[data-k="5"]');
  await sleep(250);
  {
    const a = await clipOf(page, ".kas-pop", 10), b = await clipOf(page, "#setupKasetaBtn", 10);
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
    await shot(page, "3-wybor-kasety", { clip: { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y } });
  }
  await page.click('.kas-pop .kas-opt[data-k="5"]');
  await page.waitForSelector(".kas-pop", { state: "detached" });
  const picked = await page.evaluate(() => ({ v: document.getElementById("setupCassette").value,
    t: document.getElementById("setupCassette").getAttribute("data-touched"),
    img: document.querySelector("#setupKasetaBtn img").getAttribute("src") }));
  check("wybór 5: pole i miniatura w przycisku", picked.v === "5" && picked.t === "1" && /5-160/.test(picked.img), JSON.stringify(picked));
  await page.fill("#setupName", T_SAVE);
  await page.click("#setupSave");
  await page.waitForFunction(n => [...document.querySelectorAll('.lib-row[data-kind="setup"]')].some(r => r.dataset.name === n), T_SAVE, { timeout: 8000 });
  let item = await (await fetch(URL + "library/item?kind=setup&name=" + encodeURIComponent(T_SAVE))).json();
  check("zapisany plik ma cassette: 5", item.ok && item.item.cassette === 5, JSON.stringify(item.item && item.item.cassette));
  const disk = JSON.parse(fs.readFileSync(path.join(SETUPS, T_SAVE + ".json"), "utf-8"));
  check("plik na dysku ma cassette: 5", disk.cassette === 5, disk.cassette);
  const newRow = await page.evaluate(n => { const r = [...document.querySelectorAll('.lib-row[data-kind="setup"]')].find(x => x.dataset.name === n);
    return r && r.querySelector("img.lib-kaseta").getAttribute("src"); }, T_SAVE);
  check("nowy zestaw na liście z kasetą 5", /kasety\/5-160\.png$/.test(newRow || ""), newRow);

  // kreator posta: ta sama siatka, to samo pole (bliźniak przycisku z paska)
  await page.evaluate(() => rfShareOpen({ kind: "setup" }));
  await page.waitForSelector(".rfs-card .kas-rfs .kas-opt");
  const wiz = await page.evaluate(() => ({ n: document.querySelectorAll(".rfs-card .kas-rfs .kas-opt").length,
    on: (document.querySelector(".rfs-card .kas-rfs .kas-opt.on") || {}).dataset.k,
    vis: !document.querySelector(".rfs-card .kas-rfs").hidden }));
  check("kreator posta: 8 kaset, zaznaczona ta z paska (5)", wiz.n === 8 && wiz.on === "5" && wiz.vis, JSON.stringify(wiz));
  await page.click('.rfs-card .kas-rfs .kas-opt[data-k="2"]');
  const twin = await page.evaluate(() => ({ v: document.getElementById("setupCassette").value,
    img: document.querySelector("#setupKasetaBtn img").getAttribute("src") }));
  check("wybór w kreatorze przestawia pasek zapisu", twin.v === "2" && /2-160/.test(twin.img), JSON.stringify(twin));
  await page.locator(".rfs-card .kas-rfs").scrollIntoViewIfNeeded();
  await shot(page, "3b-kreator-posta", { clip: await clipOf(page, ".rfs-card", 0) });
  await page.evaluate(() => rfShareClose());
  await page.waitForSelector(".rfs-card", { state: "detached" });
  await page.evaluate(() => rfKasetaUstaw(5, true));

  // po angielsku: przycisk, nagłówek podglądu i nazwy kaset
  await page.evaluate(() => setLang("en", false));
  await sleep(400);
  const en = await page.evaluate(() => ({ btn: document.querySelector("#setupKasetaBtn").getAttribute("aria-label"),
    h: (document.querySelector("#libDetail .kas-hero-h") || {}).textContent,
    co: (document.querySelector("#libDetail .kas-co .lib-sec") || {}).textContent,
    alt: (document.querySelector(".lib-row .lib-kaseta") || {}).alt }));
  check("EN: przycisk kasety, nagłówki podglądu", /^Setup cassette: Cassette \d: /.test(en.btn) && en.h === "Creator's description" && en.co === "What it does", JSON.stringify(en));
  await page.locator("#libDetail").scrollIntoViewIfNeeded();
  await shot(page, "2b-podglad-en", { clip: await clipOf(page, "#libDetail", 8) });
  await page.evaluate(() => setLang("pl", false));
  await sleep(300);

  // nadpisanie bez ruszania wyboru (po przeładowaniu pole stoi na domyślnej, nietknięte)
  await page.reload();
  await page.waitForSelector("#setupKasetaBtn");
  await page.click('.tab-btn[data-tab="konfiguracje"]');
  await page.fill("#setupName", T_SAVE);
  const hintOld = await page.evaluate(() => ({ v: document.getElementById("setupCassette").value,
    t: document.getElementById("setupCassette").getAttribute("data-touched") }));
  check("nazwa istniejącego zestawu w pasku pokazuje jego kasetę (5)", hintOld.v === "5" && !hintOld.t, JSON.stringify(hintOld));
  await page.click("#setupSave");
  await page.getByRole("button", { name: "Nadpisz" }).click();
  await sleep(900);
  item = await (await fetch(URL + "library/item?kind=setup&name=" + encodeURIComponent(T_SAVE))).json();
  check("nadpisanie bez wyboru zostawia kasetę 5", item.item && item.item.cassette === 5, item.item && item.item.cassette);

  // zmiana kasety zapisanego zestawu z panelu opisu (bez ponownego zapisu)
  await page.click('.lib-row[data-kind="setup"][data-name="' + T_SAVE + '"]');
  await page.waitForSelector("#libDetail .kas-hero-btn");
  const before = fs.readFileSync(path.join(SETUPS, T_SAVE + ".json"), "utf-8");
  await page.hover("#libDetail .kas-hero-btn");
  await sleep(350);
  await shot(page, "2c-zmien-kasete-najechanie", { clip: await clipOf(page, "#libDetail .kas-hero", 12) });
  await page.click("#libDetail .kas-hero-btn");
  await page.waitForSelector(".kas-pop .kas-opt");
  const pop2 = await page.evaluate(() => ({ h: document.querySelector(".kas-pop .kas-pop-h").textContent,
    on: (document.querySelector(".kas-pop .kas-opt.on") || {}).dataset.k }));
  check("okienko zmiany: tytuł i zaznaczona obecna kaseta (5)", pop2.h === "Zmień kasetę zestawu" && pop2.on === "5", JSON.stringify(pop2));
  const fieldBefore = await page.evaluate(() => document.getElementById("setupCassette").value);
  await page.click('.kas-pop .kas-opt[data-k="6"]');
  await page.waitForFunction(n => { const r = [...document.querySelectorAll('.lib-row[data-kind="setup"]')].find(x => x.dataset.name === n);
    return r && /kasety\/6-160/.test(r.querySelector("img.lib-kaseta").getAttribute("src")); }, T_SAVE, { timeout: 8000 });
  item = await (await fetch(URL + "library/item?kind=setup&name=" + encodeURIComponent(T_SAVE))).json();
  check("zmiana z podglądu: plik ma kasetę 6", item.item && item.item.cassette === 6, item.item && item.item.cassette);
  const after = JSON.parse(fs.readFileSync(path.join(SETUPS, T_SAVE + ".json"), "utf-8"));
  const b0 = JSON.parse(before); delete b0.cassette; delete after.cassette;
  check("zmiana z podglądu: reszta pliku bez zmian", JSON.stringify(b0) === JSON.stringify(after));
  // W pasku stoi nazwa tego zestawu, a wybór jest nietknięty — przycisk pokazuje więc jego NOWĄ kasetę
  // (zapis pod tą nazwą i tak by ją zachował). Wcześniej stała tam stara: fieldBefore.
  const fieldAfter = await page.evaluate(() => ({ v: document.getElementById("setupCassette").value,
    img: document.querySelector("#setupKasetaBtn img").getAttribute("src") }));
  check("pasek zapisu z nazwą tego zestawu pokazuje jego nową kasetę (" + fieldBefore + " → 6)",
        fieldBefore === "5" && fieldAfter.v === "6" && /6-160/.test(fieldAfter.img), JSON.stringify(fieldAfter));
  await page.waitForSelector("#libDetail .kas-hero-new", { timeout: 3000 }).catch(() => {});
  check("nowa kaseta w podglądzie wyskakuje", !!(await page.$("#libDetail .kas-hero-new")));
  await sleep(700);
  await shot(page, "2d-po-zmianie-kasety", { clip: await clipOf(page, "#libDetail .kas-hero", 12) });

  // 5. import starego pliku i pliku z kasetą 7 — okno importu
  for (const [obj, want, nm] of [[OLD, 1, "4-import-stary-plik"], [Object.assign({}, OLD, { name: "Z kasetą 7", cassette: 7 }), 7, "4b-import-kaseta-7"]]) {
    await page.evaluate(o => setupImport(new File([JSON.stringify(o)], "zestaw.json", { type: "application/json" })), obj);
    await page.waitForSelector("#rfSafe .ts-kasabout img");
    const src = await page.locator("#rfSafe .ts-kasabout img").getAttribute("src");
    check("okno importu: kaseta " + want, new RegExp("kasety/" + want + "-360\\.png$").test(src), src);
    if (want === 1) await shot(page, nm, { clip: await clipOf(page, "#rfSafe .ts-box", 6) });
    await page.click("#tsCancel");
    await page.waitForSelector("#rfSafe", { state: "detached" });
  }

  // 6. wczytanie z Biblioteki → scena po przeładowaniu
  await page.click('.lib-row[data-kind="setup"][data-name="' + T_SAVE + '"]');
  await page.waitForSelector("#libDetail .kas-hero");
  await page.getByRole("button", { name: "Wczytaj zestaw" }).click();
  const go = page.getByRole("button", { name: /^Wczytaj( bez zapisywania)?$/ });
  await go.first().click();
  await page.waitForEvent("load", { timeout: 10000 });
  await page.waitForSelector(".kas-load", { timeout: 6000 });
  const t0 = Date.now();
  const frames = [];
  for (const at of [90, 330, 560, 900, 1250, 1600]) {
    await sleep(Math.max(0, at - (Date.now() - t0)));
    const f = await page.evaluate(() => {
      const L = document.querySelector(".kas-load"); if (!L) return null;
      const reel = L.querySelector(".kas-reel"), tape = L.querySelector(".kas-tape"), done = L.querySelector(".kas-done");
      return { reel: getComputedStyle(reel).transform, tape: getComputedStyle(tape).transform,
               done: +getComputedStyle(done).opacity, pe: getComputedStyle(L).pointerEvents,
               src: L.querySelector(".kas-tape-img").getAttribute("src"), name: (L.querySelector(".kas-name") || {}).textContent };
    });
    frames.push(f);
    const clip = await clipOf(page, ".kas-load", 24);
    if (clip) await shot(page, "5-scena-" + String(at).padStart(4, "0") + "ms", { clip });
  }
  check("scena po wczytaniu: kaseta tego zestawu (6)", frames[0] && /kasety\/6-360/.test(frames[0].src), frames[0] && frames[0].src);
  check("scena: nazwa zestawu", frames[0] && frames[0].name === T_SAVE, frames[0] && frames[0].name);
  check("scena nie łapie myszy", frames.every(f => !f || f.pe === "none"));
  check("kaseta wsuwa się (ruch w poziomie, potem spoczynek)",
        frames[0] && frames[0].tape !== "none" && frames[4] && (frames[4].tape === "none" || /matrix\(1, 0, 0, 1, 0, 0\)/.test(frames[4].tape)),
        JSON.stringify(frames.map(f => f && f.tape)));
  check("szpule się kręcą", frames[3] && frames[4] && frames[3].reel !== frames[4].reel && frames[3].reel !== "none",
        JSON.stringify(frames.map(f => f && f.reel)));
  check("„Wczytane” widać", frames[5] && frames[5].done > 0.95, frames[5] && frames[5].done);
  await sleep(2300 - (Date.now() - t0));
  check("scena znika sama", !(await page.$(".kas-load")));
  const toast = await page.evaluate(() => document.body.innerText.includes("Wczytano zestaw „" + "Kaseta test 5" + "”"));
  check("dymek „Wczytano zestaw” obok sceny (cofnięcie bez zmian)", toast);
  check("bez błędów JS na stronie", errs.length === 0, errs.join(" | "));
  await ctx.close();

  // 7. ograniczony ruch
  const ctx2 = await rfBezPierwszegoStartu(browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" }));
  const p2 = await ctx2.newPage();
  await p2.goto(URL);
  await p2.waitForSelector("#setupKasetaBtn", { state: "attached" });
  await p2.evaluate(() => rfKasetaGraj(4, "Ograniczony ruch"));
  await p2.waitForSelector(".kas-load");
  await sleep(500);
  const rm2 = await p2.evaluate(() => { const L = document.querySelector(".kas-load");
    return { still: L.classList.contains("kas-still"), tape: getComputedStyle(L.querySelector(".kas-tape")).animationName,
             reel: getComputedStyle(L.querySelector(".kas-reel")).animationName, done: +getComputedStyle(L.querySelector(".kas-done")).opacity }; });
  check("ograniczony ruch: kaseta stoi, szpule stoją, napis od razu", rm2.still && rm2.tape === "none" && rm2.reel === "none" && rm2.done === 1, JSON.stringify(rm2));
  await shot(p2, "6-ograniczony-ruch", { clip: await clipOf(p2, ".kas-load", 24) });
  await ctx2.close();
} catch (e) {
  check("przebieg bez wyjątku", false, e && e.stack);
} finally {
  await browser.close();
  rm(T_SAVE); rm(T_OLD);
  // kopia „przed wczytaniem", jeśli bramka ją zrobiła, też jest śmieciem po teście
  try { for (const f of fs.readdirSync(SETUPS)) if (/^Przed Kaseta test/.test(f)) fs.unlinkSync(path.join(SETUPS, f)); } catch (e) { }
}
console.log("\n" + nPass + " passed, " + nFail + " failed");
process.exit(nFail ? 1 : 0);
