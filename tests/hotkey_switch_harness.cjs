/* STOP AWARYJNY — WŁĄCZNIK MUSI DAĆ SIĘ WŁĄCZYĆ Z POWROTEM (karta „Stop awaryjny", zakładka
   „Konfiguracja", rf-39j).

   Uruchomienie (git-bash, z katalogu repo): instancja TESTOWA na 8790, potem

     py ribbitflip_monitor.py --simulate --allow-multi --no-open --port 8790 &
     node tests/hotkey_switch_harness.cjs

   Adres można podmienić przez RF_URL. Domyślnie 8790 — NIE 8770, bo tam zwykle działa aplikacja używana na co dzień.

   ⚠️ NIC NIE ZAPISUJE NA SERWERZE. Kopia z `--allow-multi` zawsze raportuje `blocked`, więc prawdziwy
   stan „wyłączony, ale nie zablokowany" trzeba PODSTAWIĆ do `_hkState` i przerysować kartę; kliknięcia
   idą w zaślepiony `window.fetch`, który niczego nie wysyła. Na końcu stan wraca z `GET /hotkey`,
   żeby nie zostawić karty z fikcją.

   Czego pilnuje: `available` znaczy „hak jest teraz założony", a nie „skrót da się mieć. Wyłączony
   skrót haka nie ma z definicji, więc wygaszanie włącznika po `!available` zamykało tę funkcję na
   zawsze. Martwa jest kopia z `blocked` oraz skrót WŁĄCZONY, któremu hak nie wstał — i tylko one.

   Styl asercji jak w pozostałych harnessach: „OK / ZLE" + „N passed, M failed" na końcu.
   Kod wyjścia: 0 = wszystko przeszło, 1 = choć jeden ZLE, 2 = instancja niedostępna. */
const path = require("path");
const { chromium } = require(path.join(process.env.APPDATA || "", "npm", "node_modules", "@playwright/test"));
const { rfBezPierwszegoStartu } = require("./_rf_pierwszy_start.cjs");

const BAZA = process.env.RF_URL || "http://127.0.0.1:8790/";
let ok = 0, zle = 0;
const bledy = [];
function sprawdz(nazwa, warunek, dodatek) {
  if (warunek) { ok++; console.log("  OK   " + nazwa); }
  else { zle++; console.log("  ZLE  " + nazwa + (dodatek !== undefined ? "  -> " + JSON.stringify(dodatek) : "")); }
}

// Odczyt karty jednym zamachem — dokładnie to, co widzi człowiek.
const KARTA = () => {
  const tg = document.getElementById("hkEnable");
  const why = document.getElementById("hkWhy");
  const pill = document.getElementById("hkPill");
  return {
    dis: tg.classList.contains("dis"),
    on: tg.classList.contains("on"),
    aria: tg.getAttribute("aria-disabled"),
    tab: tg.tabIndex,
    whyHidden: !!why.hidden,
    why: (why.textContent || "").trim(),
    pill: (pill.textContent || "").trim(),
  };
};

// Podstawienie stanu + przerysowanie. Serwer nie jest o nic pytany.
const PODSTAW = (s) => { _hkState = s; _hkRender(); return null; };

// Klik w zaślepionym fetchu: zwraca, co karta PRÓBOWAŁA wysłać, i nie wysyła tego naprawdę.
const KLIK_SUCHY = (uzyjKlikniecia) => {
  const zadania = [];
  const oryginal = window.fetch;
  window.fetch = function (u, o) {
    zadania.push({ url: String(u), metoda: (o && o.method) || "GET", body: (o && o.body) || "" });
    return Promise.reject(new Error("stub"));
  };
  try {
    if (uzyjKlikniecia) document.getElementById("hkEnable").click();
    else _hkToggle();
  } finally { window.fetch = oryginal; }
  return { zadania, komunikat: (document.getElementById("hkMsg").textContent || "").trim() };
};

(async () => {
  try {
    const r = await fetch(BAZA.replace(/\/?$/, "/") + "health");
    if (!r.ok) throw new Error(String(r.status));
  } catch (e) {
    console.error("Instancja niedostepna: " + BAZA + " (" + e.message + ") — uruchom panel na tym porcie");
    process.exit(2);
  }

  const przegladarka = await chromium.launch({ headless: true });
  const kontekst = await rfBezPierwszegoStartu(przegladarka.newContext({ viewport: { width: 1440, height: 900 } }));
  const strona = await kontekst.newPage();
  strona.on("console", (m) => { if (m.type() === "error") bledy.push(m.text()); });
  strona.on("pageerror", (e) => bledy.push(String(e)));

  await strona.goto(BAZA, { waitUntil: "domcontentloaded" });
  await strona.waitForSelector("#hkEnable", { state: "attached", timeout: 15000 });
  // Karta siedzi w zakładce „Konfiguracja" — bez jej otwarcia przełącznik jest niewidoczny i
  // Playwright nie kliknie w niego naprawdę.
  // Od UX 261120 przełącznik stoi w zwijaku „Skrót awaryjny” (piętro 2), więc go otwieramy.
  await strona.evaluate(() => {
    const b = document.querySelector('button.tab-btn[data-tab="ustawienia"]');
    if (b) b.click();
    const f = document.getElementById("hkFold");
    if (f) f.open = true;
  });
  await strona.waitForSelector("#hkEnable", { state: "visible", timeout: 10000 });
  await strona.waitForTimeout(600);

  console.log("\n- kopia testowa (--allow-multi): tu wygaszenie jest SŁUSZNE");
  const stanSerwera = await strona.evaluate(() => fetch("/hotkey").then((r) => r.json()));
  sprawdz("serwer melduje `blocked` (to kopia testowa)", !!stanSerwera.blocked, stanSerwera.blocked);
  const zablokowana = await strona.evaluate(KARTA);
  sprawdz("przelacznik wygaszony", zablokowana.dis === true && zablokowana.aria === "true", zablokowana);
  sprawdz("powod widoczny i cytuje `blocked`",
    zablokowana.whyHidden === false && zablokowana.why.includes(stanSerwera.blocked), zablokowana.why);
  const suchyKlik = await strona.evaluate(KLIK_SUCHY, true);
  sprawdz("klik nie wysyla niczego", suchyKlik.zadania.length === 0, suchyKlik.zadania);
  sprawdz("...i mowi dlaczego",
    suchyKlik.komunikat === "Nie ma czego włączyć: skrót jest w tej kopii niedostępny.", suchyKlik.komunikat);

  console.log("\n- skrot WYLACZONY (nie zablokowany): musi dac sie wlaczyc");
  const wylaczony = await strona.evaluate(PODSTAW, {
    enabled: false, combo: "alt+r+f", available: false, reason: "", blocked: "",
    check: null, fires: 0, seen: 0, default: "alt+r+f", finals: [],
  }).then(() => strona.evaluate(KARTA));
  sprawdz("przelacznik klikalny", wylaczony.dis === false && wylaczony.aria === "false", wylaczony);
  sprawdz("...i osiagalny z klawiatury", wylaczony.tab === 0, wylaczony.tab);
  sprawdz("zaden powod sie nie tlumaczy, bo nie ma z czego", wylaczony.whyHidden === true, wylaczony.why);
  sprawdz("pigulka mowi „Wylaczony”", wylaczony.pill === "Wyłączony", wylaczony.pill);
  const wlaczanie = await strona.evaluate(KLIK_SUCHY, true);
  sprawdz("klik wysyla DOKLADNIE jedno zadanie wlaczajace",
    wlaczanie.zadania.length === 1 && /\/hotkey$/.test(wlaczanie.zadania[0].url)
    && wlaczanie.zadania[0].metoda === "POST"
    && JSON.parse(wlaczanie.zadania[0].body || "{}").enabled === true, wlaczanie.zadania);

  console.log("\n- skrot WLACZONY, ale hak nie wstal: wygaszony z powodem");
  const bezHaka = await strona.evaluate(PODSTAW, {
    enabled: true, combo: "alt+r+f", available: false, reason: "pynput niedostępny", blocked: "",
    check: null, fires: 0, seen: 0, default: "alt+r+f", finals: [],
  }).then(() => strona.evaluate(KARTA));
  sprawdz("przelacznik wygaszony", bezHaka.dis === true && bezHaka.aria === "true", bezHaka);
  sprawdz("powod z serwera trafia na ekran",
    bezHaka.whyHidden === false && bezHaka.why.includes("pynput niedostępny"), bezHaka.why);
  sprawdz("pigulka mowi „Niedostepny”", bezHaka.pill === "Niedostępny", bezHaka.pill);

  console.log("\n- skrot dziala");
  const dziala = await strona.evaluate(PODSTAW, {
    enabled: true, combo: "alt+r+f", available: true, reason: "", blocked: "",
    check: null, fires: 0, seen: 0, default: "alt+r+f", finals: [],
  }).then(() => strona.evaluate(KARTA));
  sprawdz("przelacznik zapalony i klikalny", dziala.on === true && dziala.dis === false, dziala);
  sprawdz("pigulka mowi „Dziala”", dziala.pill === "Działa", dziala.pill);

  // Sprzatanie: karta wraca do prawdy o tej instancji.
  const wrocil = await strona.evaluate(() =>
    fetch("/hotkey").then((r) => r.json()).then((j) => { _hkState = j; _hkRender(); return !!j.blocked; }));
  sprawdz("karta wrocila do stanu realnego", wrocil === true && (await strona.evaluate(KARTA)).dis === true);

  console.log("\n- konsola");
  sprawdz("zero bledow w konsoli", bledy.length === 0, bledy.slice(0, 6));

  await przegladarka.close();
  console.log("\n%d passed, %d failed", ok, zle);
  process.exit(zle ? 1 : 0);
})();
