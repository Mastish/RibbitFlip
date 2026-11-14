// RIBBITBEAT: sterowanie menu kapslem i padem, kursor z żabią łapką (web/gry/js/kursor-lapka.js).
//
// Uruchomienie (git-bash, z katalogu repo):
//   node tests/gry_kursor_lapka.mjs
// Wołane też z tests/test_gry_kursor_lapka.py. Wymaga globalnego @playwright/test, jak tests/gry_sterowanie_menu.mjs;
// bez niego kończy się linią {"pominiete": "..."} i test py to pomija.
// Zrzuty ekranu do oceny wyglądu: ustaw zmienną ZRZUTY na katalog (np. ZRZUTY=C:/tmp/lapka node tests/…).
//
// Sterowanie udajemy jak w teście sterowania menu: pad to podmieniony navigator.getGamepads, kapsel to prawdziwe
// zdarzenia strumienia aplikacji podane do Wejscie.obsluzZdarzenie. Sprawdzamy to, co widzi gracz:
//   1. łapka to jedyny tryb: w stopce nie ma przełącznika, dawny zapis „Skoki” z localStorage nie działa,
//   2. przechył kapsla ustawia łapkę w punkcie ekranu, a fokus nie skacze,
//   3. naciśnięcie kapsla klika to, co pod czubkiem palca (przycisk menu, zakładka, wiersz utworu),
//   4. przytrzymanie kapsla cofa jak dotąd,
//   5. łapka przy dolnej krawędzi listy ją przewija,
//   6. lewa gałka pada prowadzi łapkę pada, A klika pod nią, krzyżak dalej skacze fokusem,
//   7. w kroku Rozgrywka łapka kapsla zostaje i klika „Gotowe” na karcie gracza,
//   8. po powrocie do menu łapka kapsla wraca.
// Ostatnia linia wyjścia: JSON {checks:[[nazwa, ok, szczegół], …]}.
import { createRequire } from "module";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WEB = path.join(REPO, "web");
const ZRZUTY = process.env.ZRZUTY || "";
const wymagaj = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = wymagaj(path.join(process.env.APPDATA || "", "npm", "node_modules", "@playwright", "test")));
} catch (e) {
  console.log(JSON.stringify({ pominiete: "brak globalnego @playwright/test (" + (e.code || e.message) + ")" }));
  process.exit(0);
}

const checks = [];
const ck = (nazwa, ok, szczegol) => checks.push([nazwa, !!ok, szczegol === undefined ? "" : String(szczegol)]);

const TYPY = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ico": "image/x-icon", ".mid": "audio/midi", ".wav": "audio/wav" };

const serwer = http.createServer((req, res) => {
  const sciezka = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname);
  if (sciezka.startsWith("/gry/api/")) {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    return res.end('{"ok":true,"pakiety":[],"katalog":""}');
  }
  const plik = path.normalize(path.join(WEB, sciezka.endsWith("/") ? sciezka + "index.html" : sciezka));
  if (!plik.startsWith(WEB) || !fs.existsSync(plik) || fs.statSync(plik).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": TYPY[path.extname(plik)] || "application/octet-stream", "Cache-Control": "no-store" });
  fs.createReadStream(plik).pipe(res);
});
await new Promise(ok => serwer.listen(0, "127.0.0.1", ok));
const port = serwer.address().port;

const przegladarka = await chromium.launch();
const kontekst = await przegladarka.newContext({ viewport: { width: 1400, height: 900 } });
const strona = await kontekst.newPage();
const bledy = [];
strona.on("pageerror", e => bledy.push(String(e)));
strona.on("console", m => { if (m.type() === "error") bledy.push(m.text()); });

// ---- atrapy sterowania w stronie -------------------------------------------------------------------------------
const PRZYBORNIK = () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const pad = { buttons: new Array(17).fill(false), axes: [0, 0, 0, 0] };
  navigator.getGamepads = () => [{ index: 0, id: "Test Pad (STANDARD GAMEPAD)", connected: true, mapping: "standard",
    buttons: pad.buttons.map(v => ({ pressed: !!v, value: v ? 1 : 0, touched: !!v })), axes: pad.axes.slice(), timestamp: performance.now() }];
  const DEV = "T1", ID = "kapsel-" + DEV;
  const kapsel = m => Wejscie.obsluzZdarzenie(Object.assign({ dev: DEV }, m));
  const srodek = sel => { const e = typeof sel === "string" ? document.querySelector(sel) : sel, r = e.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  const lapka = id => KursorLapka.stan().kursory.find(k => k.id === id) || null;
  window.__T = {
    ID, sleep, srodek, lapka,
    podlaczKapsel() { kapsel({ t: "devmeta", slot: 0, name: "Kapsel testowy", color: "#2aa198", cap: "1" }); },
    poza(pitch, roll) { kapsel({ t: "s", pose: { pitch: pitch || 0, roll: roll || 0, twist: 0 } }); },
    przycisk(dol) { kapsel({ t: "b", bytes: [0, dol ? 1 : 0, 0, 0, 0] }); },
    async kapKlik() { this.przycisk(true); await sleep(160); this.przycisk(false); await sleep(260); },
    async kapTrzymaj(ms) { this.przycisk(true); await sleep(ms || 900); this.przycisk(false); await sleep(260); },
    // kapsel wskazuje punkt ekranu: przechył wyliczony odwrotnie do KursorLapka.pozaNaEkran, nadawany przez `ms`
    async kapWskaz(x, y, ms) {
      const C = KursorLapka.C, roll = (x - innerWidth / 2) / (innerWidth / 2) * C.ZAKRES_X, pitch = (y - innerHeight / 2) / (innerHeight / 2) * C.ZAKRES_Y;
      for (let t = 0; t < (ms || 600); t += 30) { this.poza(pitch, roll); await sleep(30); }
    },
    async kapWskazElement(sel, ms) { const s = srodek(sel); await this.kapWskaz(s.x, s.y, ms); return s; },
    // pad prowadzi swoją łapkę gałką do punktu (pętla: wychylenie w stronę celu, aż będzie blisko)
    async padDo(x, y) {
      for (let i = 0; i < 400; i++) {
        const k = lapka("pad-0"), px = k && k.widac ? k.x : innerWidth / 2, py = k && k.widac ? k.y : innerHeight / 2;
        const dx = x - px, dy = y - py, d = Math.hypot(dx, dy);
        if (k && k.widac && d < 8) break;
        const sila = d > 160 ? 1 : d > 40 ? .55 : .32;
        pad.axes[0] = d ? dx / d * sila : 0; pad.axes[1] = d ? dy / d * sila : 0;
        await sleep(16);
      }
      pad.axes[0] = 0; pad.axes[1] = 0; await sleep(120);
      return lapka("pad-0");
    },
    async padPrzycisk(i) { pad.buttons[i] = true; await sleep(140); pad.buttons[i] = false; await sleep(200); },
    async padKrzyzak(i) { pad.buttons[i] = true; await sleep(140); pad.buttons[i] = false; await sleep(160); },
    fokus() { const a = document.activeElement; return !a || a === document.body ? "—" : (a.id || String(a.className || "").split(" ")[0] || a.tagName); },
    stan() { return { ekran: ZC.dev.S.ekran, lobby: ZC.dev.S.lobbyEkran, fokus: this.fokus(), gracze: ZC.dev.S.gracze.map(g => g.id),
      piosenka: (ZC.stan().piosenka || {}).id, tryb: KursorLapka.tryb(), kursory: KursorLapka.stan().kursory,
      nad: [...document.querySelectorAll(".lapka-nad")].map(e => e.id || String(e.className).split(" ")[0]),
      html: document.documentElement.classList.contains("ster-kursor") }; },
  };
};

const ewal = (fn, ...a) => strona.evaluate(fn, ...a);
const stan = () => ewal(() => __T.stan());
let nrZrzutu = 0;
const zrzut = async nazwa => { if (ZRZUTY) await strona.screenshot({ path: path.join(ZRZUTY, String(++nrZrzutu).padStart(2, "0") + "-" + nazwa + ".png") }); };

try {
  // dawny wybór „Skoki” zapisany przed 11-20: gra ma go zignorować i skasować
  await strona.addInitScript(() => { try { if (!sessionStorage.getItem("__lapkaRaz")) { sessionStorage.setItem("__lapkaRaz", "1"); localStorage.setItem("ribbitflip.zabiChor.sterowanieMenu", "fokus"); } } catch (e) {} });
  await strona.goto("http://127.0.0.1:" + port + "/gry/?zywe=0&dev=1", { waitUntil: "domcontentloaded" });
  await strona.waitForFunction(() => typeof ZC !== "undefined" && ZC.dev && ZC.dev.S && typeof Wejscie !== "undefined" &&
    typeof KursorLapka !== "undefined" && (typeof Wczytywanie === "undefined" || Wczytywanie.gotowe), null, { timeout: 30000 });
  await ewal(PRZYBORNIK);
  await strona.waitForTimeout(600);
  await ewal(() => { const b = [...document.querySelectorAll("#kontoOkno button")].find(x => /Gość|Guest/.test(x.textContent)); if (b) b.click(); });
  await strona.waitForTimeout(700);

  // ---- 1. łapka jedynym trybem ----------------------------------------------------------------------------------
  let s = await stan();
  ck("stopka menu nie ma już przełącznika „Sterowanie”", await ewal(() => !document.getElementById("menuSterowanie")));
  ck("gra od startu steruje łapką, choć localStorage pamiętał „Skoki”",
     s.tryb === "kursor" && s.html && await ewal(() => localStorage.getItem("ribbitflip.zabiChor.sterowanieMenu")) === null, JSON.stringify(s));

  await ewal(() => { __T.podlaczKapsel(); __T.poza(0, 0); });
  await strona.waitForTimeout(250);
  await ewal(() => __T.kapKlik());   // pierwsze naciśnięcie dołącza kapsel do chóru
  s = await stan();
  ck("kapsel dołączył (dalej prowadzi menu)", s.gracze.length === 1 && s.lobby === "menu", JSON.stringify(s.gracze));

  // ---- 2. kapsel wskazuje punkt -----------------------------------------------------------------------------------
  const fokusPrzed = s.fokus;
  const cel = await ewal(() => __T.kapWskazElement("#btnZagraj"));
  s = await stan();
  const k1 = s.kursory.find(k => k.id === "kapsel-T1");
  ck("przechył kapsla stawia łapkę w punkcie ekranu (środek „Zagraj”)",
     k1 && k1.widac && Math.hypot(k1.x - cel.x, k1.y - cel.y) < 6, JSON.stringify([k1, cel]));
  ck("element pod łapką jest podświetlony", s.nad.join(",") === "btnZagraj", s.nad.join(","));
  ck("w trybie łapki przechył nie przesuwa fokusu", s.fokus === fokusPrzed, fokusPrzed + " → " + s.fokus);
  const wyglad = await ewal(() => { const e = document.querySelector(".lapka.widac"), nr = e && e.querySelector(".lapka-nr");
    if (!e || !nr) return null;
    const widoczne = [...e.querySelectorAll("img.lapka-rys")].filter(i => getComputedStyle(i).display !== "none");
    const im = widoczne[0], q = im && im.getBoundingClientRect(), k = KursorLapka.stan().kursory[0], P = KursorLapka.POZY.najazd;
    return { zdarzenia: getComputedStyle(e).pointerEvents, numer: nr.textContent, tlo: getComputedStyle(nr).backgroundColor,
      poz: widoczne.length, plik: im ? im.getAttribute("src").split("/").pop() : "", wczytany: !!im && im.naturalWidth === P.bok, bok: q ? Math.round(q.width) : 0,
      // punkt czuły rysunku (jak we wskaźniku myszy) stoi w punkcie kliknięcia
      czubek: q ? Math.hypot(q.left + P.punkt[0] - k.x, q.top + P.punkt[1] - k.y) : 99,
      mysz: getComputedStyle(document.getElementById("btnJakGrac")).cursor }; });
  ck("łapka to wskaźnik gry: nad przyciskiem jedna poza „najazd” (hand-idle-hot-38.png), w rozmiarze wskaźnika myszy",
     wyglad && wyglad.poz === 1 && wyglad.plik === "hand-idle-hot-38.png" && wyglad.wczytany && wyglad.bok === 38, JSON.stringify(wyglad));
  ck("łapka nie łapie kliknięć, a punkt czuły rysunku stoi w punkcie kliknięcia", wyglad && wyglad.zdarzenia === "none" && wyglad.czubek < 1.5, JSON.stringify(wyglad));
  ck("łapka ma numerek gracza na kółku w kolorze jego kapsla", wyglad && wyglad.numer === "1" && wyglad.tlo === "rgb(42, 161, 152)", JSON.stringify(wyglad));
  ck("wskaźnik myszy zostaje ten sam co zawsze (rysunki z assets/cursor)", wyglad && /assets\/cursor\/hand-idle-36\.png/.test(wyglad.mysz), wyglad && wyglad.mysz.slice(0, 90));
  await zrzut("menu-lapka");

  // ---- 3. kliknięcie kapslem --------------------------------------------------------------------------------------
  await ewal(() => __T.kapKlik());
  // pierwsze „Zagraj” na tym komputerze pyta o samouczek: to okno też obsługujemy łapką
  await strona.waitForFunction(() => ZC.dev.S.lobbyEkran !== "menu" || !!document.querySelector("#smPytanie:not([hidden])"), null, { timeout: 4000 }).catch(() => {});
  const pytanie = await ewal(() => !!document.querySelector("#smPytanie:not([hidden])"));
  ck("naciśnięcie kapsla klika to, co pod łapką: „Zagraj” otwiera krok Piosenka albo pytanie o samouczek",
     pytanie || (await stan()).lobby === "wybor", (await stan()).lobby);
  if (pytanie) {
    await ewal(async () => { const b = document.querySelector("#smPytanie .sm-pytanie-nie");
      await __T.kapWskazElement(b); await __T.kapKlik(); });
    await strona.waitForFunction(() => ZC.dev.S.lobbyEkran === "wybor", null, { timeout: 4000 }).catch(() => {});
    ck("łapka klika też w oknie nad menu („Od razu do piosenek”)", (await stan()).lobby === "wybor" && await ewal(() => !document.querySelector("#smPytanie:not([hidden])")),
       (await stan()).lobby);
  }
  await strona.waitForTimeout(900);

  await ewal(() => __T.kapWskazElement("#btnDodajUtwory"));
  await ewal(() => __T.kapKlik());
  await strona.waitForTimeout(300);
  ck("łapka wybiera zakładkę „Wgraj własny”", await ewal(() => LobbyScena.dodaj().otwarty));
  await zrzut("wgraj-wlasny-lapka");

  // ---- 4. przytrzymanie cofa --------------------------------------------------------------------------------------
  await ewal(() => __T.kapTrzymaj(900));
  await strona.waitForTimeout(300);
  s = await stan();
  ck("przytrzymanie kapsla cofa jak dotąd: z „Wgraj własny” na „Wybierz utwór”",
     s.lobby === "wybor" && !(await ewal(() => LobbyScena.dodaj().otwarty)), s.lobby);

  // wiersz utworu: niewybrany, ze środka widocznej części listy (z dala od krawędzi, przy których łapka przewija)
  const wiersz = await ewal(async () => {
    const lista = [...document.querySelectorAll("#wybor .bkarta")].filter(li => !li.hidden && li.getClientRects().length);
    let p = lista[0].parentElement;
    while (p && p !== document.body && !(p.scrollHeight > p.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(p).overflowY))) p = p.parentElement;
    const o = (p && p !== document.body ? p : document.getElementById("wybor")).getBoundingClientRect(), sr = (o.top + o.bottom) / 2;
    const odl = li => { const r = li.getBoundingClientRect(); return Math.abs((r.top + r.bottom) / 2 - sr); };
    const li = lista.filter(x => !x.classList.contains("wybrana")).sort((a, b) => odl(a) - odl(b))[0], b = li.querySelector(".bkarta-wybor");
    const r = b.getBoundingClientRect();
    await __T.kapWskaz(r.left + Math.min(160, r.width / 2), r.top + r.height / 2);
    await __T.kapKlik();
    return li.dataset.id;
  });
  await strona.waitForTimeout(300);
  s = await stan();
  ck("łapka wybiera utwór kliknięciem w jego wiersz", s.piosenka === wiersz && s.lobby === "wybor", wiersz + " / " + s.piosenka + " / " + s.lobby);
  await zrzut("lista-lapka");

  // ---- 5. przewijanie listy przy krawędzi -------------------------------------------------------------------------
  const przewin = await ewal(async () => {
    let p = null;
    for (let n = document.querySelector("#wybor .bkarta"); n && n !== document.body; n = n.parentElement)
      if (n.scrollHeight > n.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(n).overflowY)) { p = n; break; }
    if (!p) return { brak: true };
    p.scrollTop = 0;
    const r = p.getBoundingClientRect(), przed = p.scrollTop;
    await __T.kapWskaz(r.left + 200, r.bottom - 6, 900);
    return { przed, po: p.scrollTop, maks: p.scrollHeight - p.clientHeight };
  });
  ck("łapka przy dolnej krawędzi listy przewija ją w dół", przewin.brak || przewin.po > przewin.przed + 40, JSON.stringify(przewin));

  // ---- 6. pad -----------------------------------------------------------------------------------------------------
  await ewal(() => __T.poza(0, 0));
  const fokusPrzedPadem = (await stan()).fokus;
  const pd = await ewal(async () => { const c = __T.srodek("#btnDalej"); const k = await __T.padDo(c.x, c.y); return { k, c }; });
  s = await stan();
  ck("lewa gałka pada prowadzi łapkę pada do celu", pd.k && pd.k.widac && Math.hypot(pd.k.x - pd.c.x, pd.k.y - pd.c.y) < 12, JSON.stringify(pd));
  ck("gałka w trybie łapki nie przesuwa fokusu", s.fokus === fokusPrzedPadem, fokusPrzedPadem + " → " + s.fokus);
  ck("na ekranie są dwie łapki: kapsla i pada, każda ze swoim numerkiem", s.kursory.filter(k => k.widac).length === 2 &&
     s.kursory.map(k => k.numer).join(",") === "1,2" && s.kursory[0].kolor !== s.kursory[1].kolor, JSON.stringify(s.kursory));
  await zrzut("dwie-lapki");
  await ewal(() => __T.padKrzyzak(13));
  ck("krzyżak pada dalej skacze fokusem", (await stan()).fokus !== fokusPrzedPadem, fokusPrzedPadem + " → " + (await stan()).fokus);
  await ewal(() => __T.padPrzycisk(0));
  await strona.waitForFunction(() => ZC.dev.S.lobbyEkran === "konfiguracja", null, { timeout: 4000 }).catch(() => {});
  s = await stan();
  ck("A na padzie klika to, co pod łapką pada: „Dalej” otwiera krok Rozgrywka", s.lobby === "konfiguracja", s.lobby);

  // ---- 7. krok Rozgrywka: łapka zostaje (11-20, jak pilot Wii U) ---------------------------------------------------
  await ewal(async () => { for (let t = 0; t < 1300; t += 30) { __T.poza(4, 6); await __T.sleep(30); } });
  s = await stan();
  ck("w kroku Rozgrywka łapka kapsla zostaje",
     s.kursory.find(k => k.id === "kapsel-T1").widac, JSON.stringify(s.kursory));
  ck("…i karta kapsla nie dostaje ramki pola (kapsel klika, nie chodzi po polach)",
     await ewal(() => !document.querySelector('#siatkaGraczy .gracz[data-id="kapsel-T1"] .pole-kapsla')));
  await ewal(() => __T.kapWskazElement('#siatkaGraczy .gracz[data-id="kapsel-T1"] .gracz-gotowy', 400));
  await ewal(() => __T.kapKlik());
  await strona.waitForTimeout(300);
  ck("łapka klika „Gotowe” na karcie gracza",
     await ewal(() => !!(ZC.dev.S.gracze.find(g => g.id === "kapsel-T1") || {}).gotowy));
  await ewal(() => __T.kapTrzymaj());
  ck("przytrzymanie kapsla u gotowego otwiera jego kartę jak dotąd",
     await ewal(() => !(ZC.dev.S.gracze.find(g => g.id === "kapsel-T1") || {}).gotowy && ZC.dev.S.lobbyEkran === "konfiguracja"));

  // ---- 8. powrót do menu ------------------------------------------------------------------------------------------
  await ewal(() => { ZC.lobby("menu"); });
  await strona.waitForTimeout(900);
  await ewal(() => __T.kapWskazElement("#btnJakGrac", 400));
  ck("po powrocie do menu łapka kapsla znów jest", (await stan()).kursory.find(k => k.id === "kapsel-T1").widac);
  ck("żadnego błędu w konsoli strony", bledy.length === 0, bledy.slice(0, 3).join(" | "));
} catch (e) {
  ck("test kursora-łapki dochodzi do końca", false, String(e && e.stack || e));
} finally {
  await przegladarka.close().catch(() => {});
  serwer.close();
}
console.log(JSON.stringify({ checks }));
