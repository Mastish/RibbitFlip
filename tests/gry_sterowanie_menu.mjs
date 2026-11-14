// RIBBITBEAT: sterowanie (pad i KAPSEL) działa w każdym menu gry. To istotne, bo gra
// jest przede wszystkim demonstracją kapsla w kontekście gry.
//
// Uruchomienie (git-bash, z katalogu repo):
//   node tests/gry_sterowanie_menu.mjs
// Wołane też z tests/test_gry_sterowanie_menu.py. Wymaga globalnego @playwright/test, jak tests/gry_paczki_biblioteka.mjs;
// bez niego kończy się linią {"pominiete": "..."} i test py to pomija.
//
// Jak udajemy sterowanie: pad to podmieniony navigator.getGamepads (ta sama atrapa co w teście pada), a kapsel to
// prawdziwe zdarzenia strumienia aplikacji podane do Wejscie.obsluzZdarzenie ("devmeta" = kapsel na slocie,
// "s" = poza 50 Hz, "b" = pakiet statusu z bitem przycisku). Strona nie wie, że nikt nie trzyma kapsla:
// przechył, naciśnięcie i przytrzymanie liczy ten sam kod, co u gracza.
//
// Co sprawdzamy w każdym menu: czy przechył RUSZA FOKUS, czy naciśnięcie KLIKA to, co ma fokus, i czy
// przytrzymanie COFA. Ostatnia linia wyjścia: JSON {checks:[[nazwa, ok, szczegół], …]}.
import { createRequire } from "module";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WEB = path.join(REPO, "web");
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
  if (sciezka.startsWith("/gry/api/")) {   // paczki MIDI: tu nieużywane, ale strona o nie pyta
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
  const KRZYZAK = { gora: 12, dol: 13, lewo: 14, prawo: 15 };
  const DEV = "T1", ID = "kapsel-" + DEV;
  const kapsel = m => Wejscie.obsluzZdarzenie(Object.assign({ dev: DEV }, m));
  window.__T = {
    ID,
    sleep,
    // ---- pad ----
    async padKier(k) { pad.buttons[KRZYZAK[k]] = true; await sleep(140); pad.buttons[KRZYZAK[k]] = false; await sleep(140); },
    async padPrzycisk(i) { pad.buttons[i] = true; await sleep(140); pad.buttons[i] = false; await sleep(160); },
    // ---- kapsel (strumień aplikacji) ----
    podlaczKapsel() { kapsel({ t: "devmeta", slot: 0, name: "Kapsel testowy", color: "#2aa198", cap: "1" }); },
    poza(pitch, roll) { kapsel({ t: "s", pose: { pitch: pitch || 0, roll: roll || 0, twist: 0 } }); },
    przycisk(dol) { kapsel({ t: "b", bytes: [0, dol ? 1 : 0, 0, 0, 0] }); },
    async kapKier(k) {   // przechył poza próg pilota (18°) i z powrotem na środek
      this.poza(k === "gora" ? -32 : k === "dol" ? 32 : 0, k === "lewo" ? -32 : k === "prawo" ? 32 : 0);
      await sleep(240); this.poza(0, 0); await sleep(180);
    },
    async kapKlik() { this.przycisk(true); await sleep(160); this.przycisk(false); await sleep(220); },
    async kapTrzymaj(ms) { this.przycisk(true); await sleep(ms || 900); this.przycisk(false); await sleep(220); },
    // ---- odczyt stanu ----
    fokus() { const a = document.activeElement; return !a || a === document.body ? "—"
      : (a.id || String(a.className || "").split(" ")[0] || a.tagName) + "|" + (a.textContent || "").trim().replace(/\s+/g, " ").slice(0, 24); },
    wOknie(id) { const o = document.getElementById(id), a = document.activeElement; return !!(o && a && o.contains(a)); },
    widoczne(id) { const e = document.getElementById(id); return !!(e && !e.hidden && e.getClientRects().length); },
    stan() { return { ekran: ZC.dev.S.ekran, lobby: ZC.dev.S.lobbyEkran, pauza: !!ZC.dev.S.pauza, fokus: this.fokus(),
      gracze: ZC.dev.S.gracze.map(g => g.id), piosenka: (ZC.stan().piosenka || {}).id }; },
  };
};

const ewal = (fn, ...a) => strona.evaluate(fn, ...a);
const stan = () => ewal(() => __T.stan());
const fokus = () => ewal(() => __T.fokus());

try {
  await strona.goto("http://127.0.0.1:" + port + "/gry/?zywe=0&dev=1", { waitUntil: "domcontentloaded" });
  await strona.waitForFunction(() => typeof ZC !== "undefined" && ZC.dev && ZC.dev.S && typeof Wejscie !== "undefined" && (typeof Wczytywanie === "undefined" || Wczytywanie.gotowe), null, { timeout: 30000 });   // zasłona wczytywania zeszła
  await ewal(PRZYBORNIK);
  // 11-20: gracz ma w menu już tylko łapkę (tests/gry_kursor_lapka.mjs). Tu sprawdzamy ścieżkę skoków fokusu
  // kapslem (krokPilotow / nawigujLobby), którą test włącza sobie sam: te same skoki robi klawiatura i krzyżak pada.
  await ewal(() => KursorLapka.ustaw("fokus"));
  await strona.waitForTimeout(600);

  // ---- 1. okno „Kto gra na tym komputerze” (nakładka nad menu) --------------------------------------------------
  const kontoJest = await ewal(() => __T.widoczne("kontoOkno"));
  if (kontoJest) {
    const przed = await fokus();
    await ewal(() => __T.padKier("dol"));
    const po = await fokus(), wOknie = await ewal(() => __T.wOknie("kontoOkno"));
    ck("okno kont: pad przesuwa fokus i zostaje w oknie", po !== przed && wOknie, przed + " → " + po);
    await ewal(() => { const b = [...document.querySelectorAll("#kontoOkno button")].find(x => /Gość|Guest/.test(x.textContent)); if (b) b.click(); });
    await strona.waitForTimeout(700);
  }
  ck("menu główne startuje z fokusem na „Zagraj”", (await fokus()).startsWith("btnZagraj"), await fokus());

  // ---- 2. menu główne: pad i kapsel -----------------------------------------------------------------------------
  let przed = await fokus();
  await ewal(() => __T.padKier("dol"));
  ck("menu: krzyżak pada przesuwa fokus", (await fokus()) !== przed, przed + " → " + (await fokus()));

  await ewal(() => { __T.podlaczKapsel(); __T.poza(0, 0); });
  await strona.waitForTimeout(250);
  const przedDolaczeniem = await stan();
  await ewal(() => __T.kapKlik());
  const poDolaczeniu = await stan();
  ck("kapsel dołącza do chóru pierwszym naciśnięciem w menu",
     !przedDolaczeniem.gracze.length && poDolaczeniu.gracze.length === 1, poDolaczeniu.gracze.join(","));
  ck("to naciśnięcie nie klika przycisku z fokusem (zużyte na dołączenie)",
     poDolaczeniu.lobby === "menu" && poDolaczeniu.fokus === przedDolaczeniem.fokus, poDolaczeniu.lobby + " / " + poDolaczeniu.fokus);

  przed = await fokus();
  await ewal(() => __T.kapKier("gora"));
  ck("menu: przechył kapsla przesuwa fokus", (await fokus()) !== przed, przed + " → " + (await fokus()));

  // 10-20: osobnego ekranu „Utwory” nie ma — z menu prowadzi do biblioteki samo „Zagraj” (krok 1 Piosenka).
  // Samouczek przy pierwszym „Zagraj” pytałby o siebie zamiast przejść dalej, więc w teście jest już widziany.
  await ewal(() => { localStorage.setItem("ribbitbeat.jakGrac", "1"); document.getElementById("btnZagraj").focus(); });
  await ewal(() => __T.kapKlik());
  await strona.waitForTimeout(900);
  ck("menu: naciśnięcie kapsla klika przycisk z fokusem („Zagraj”)", (await stan()).lobby === "wybor", (await stan()).lobby);

  przed = await fokus();
  await ewal(() => __T.kapKier("dol"));
  ck("krok 1: przechył kapsla chodzi po wierszach utworów", (await fokus()) !== przed, przed + " → " + (await fokus()));

  // 11-19: przyciski utworu (ulubione, posłuchaj, ustawienia, tablica, Wybierz) widać tylko w wybranym wierszu, kapsel
  // chodzi po nich przechyłem w bok, ściąga nad listą mówi językiem kapsla, a długi przechył przewija listę skokami
  const wiersze = () => ewal(() => {
    const rz = [...document.querySelectorAll("#wybor .biblio-lista .bkarta")].filter(k => k.getClientRects().length);
    const a = document.activeElement, k = a && a.closest ? a.closest(".bkarta") : null, sk = document.getElementById("listaSkok");
    return { ile: rz.length, zPrzyciskami: rz.filter(x => x.querySelector(".bkarta-akcje").checkVisibility({ visibilityProperty: true })).length, nr: k ? rz.indexOf(k) : -1,
      klasa: a ? String(a.className) : "", wybrany: !!(k && k.classList.contains("wybrana")), sciaga: (document.querySelector(".lista-podpowiedz") || {}).textContent || "", skok: sk && !sk.hidden ? sk.textContent : "" };
  });
  let w1 = await wiersze();
  ck("krok 1: przyciski utworu ma tylko wybrany wiersz (ten z fokusem)", w1.zPrzyciskami === 1 && w1.wybrany, JSON.stringify(w1));
  ck("krok 1: ściąga nad listą mówi o przechyle i przycisku, nie o klikaniu", /Przód i tył|Forward and back/.test(w1.sciaga), w1.sciaga);
  await ewal(() => __T.kapKier("prawo"));
  const wBok = await wiersze();
  ck("krok 1: przechył w bok wchodzi na przyciski tego samego wiersza", /bkarta-(ulub|graj|ust|wyniki)/.test(wBok.klasa) && wBok.nr === w1.nr, wBok.klasa);
  await ewal(() => { const l = [...document.querySelectorAll("#wybor .biblio-lista")].find(x => x.getClientRects().length); l.querySelector(".bkarta .bkarta-wybor").focus(); });
  await strona.waitForTimeout(300);
  await ewal(() => { __T.poza(32, 0); });
  await strona.waitForTimeout(2000);   // 0,35 s + 8 powtórzeń co 0,14 s po jednym wierszu, potem skoki
  const wSkoku = await wiersze();
  await ewal(() => { __T.poza(0, 0); });
  await strona.waitForTimeout(300);
  ck("krok 1: długi przechył przewija skokami i pokazuje literę z miejscem na liście",
     wSkoku.ile < 16 || (wSkoku.nr >= 12 && /\d+ \/ \d+/.test(wSkoku.skok)), JSON.stringify(wSkoku));

  await ewal(() => __T.kapTrzymaj(900));
  await strona.waitForTimeout(900);
  ck("krok 1: przytrzymanie kapsla cofa do menu", (await stan()).lobby === "menu", (await stan()).lobby);

  // ---- 3. okna nad ekranem lobby --------------------------------------------------------------------------------
  // Każde okno gry musi być w nakladkaLobby(): to ona mówi padowi i kapslowi, po czym chodzić i co zamyka „wstecz”.
  await ewal(() => { ZC.lobby("wybor"); });
  await strona.waitForTimeout(900);
  for (const [nazwa, klucz, id] of [
    ["tablica wyników", "tablica", "tablica"],
    ["okno licencji utworów", "licencje", "okno"],
    ["okno pomocy gracza", "pomoce", "wyborGracza"],
    ["okno „Dodaj gracza”", "gracz", "wyborGracza"],
  ]) {
    await ewal(k => {
      if (k === "tablica") document.getElementById("btnWybranaTablica").click();
      else if (k === "licencje") Pakiety.ekranLicencji();
      else if (k === "pomoce") ZC.otworzPomoce(__T.ID);
      else ZC.otworzWyborGracza({});
    }, klucz);
    await strona.waitForTimeout(1500);   // okno licencji dobudowuje listę po odpowiedzi serwera i wraca fokusem na ×
    if (!(await ewal(i => __T.widoczne(i), id))) { ck(nazwa + ": otwiera się w teście", false, id); continue; }
    const f0 = await fokus();
    let f1 = f0;
    for (const k of ["dol", "prawo", "dol"]) { if (f1 !== f0) break; await ewal(kier => __T.kapKier(kier), k); f1 = await fokus(); }
    ck(nazwa + ": przechył kapsla chodzi po oknie, a nie po ekranie pod nim",
       (await ewal(i => __T.wOknie(i), id)) && f1 !== f0, f0 + " → " + f1);
    await ewal(() => __T.kapTrzymaj(900));
    await strona.waitForTimeout(700);
    ck(nazwa + ": przytrzymanie kapsla zamyka okno", !(await ewal(i => __T.widoczne(i), id)), await fokus());
  }

  // lista partii w podglądzie utworu: rozwijane okienko w <body> (biblioteka.js), nie miało swojego sterowania
  const jestWybor = await ewal(() => { const b = document.getElementById("ppWybor");
    if (!b || b.hidden || !b.getClientRects().length) return false; b.focus(); return true; });
  if (jestWybor) {
    await ewal(() => __T.kapKlik());
    await strona.waitForTimeout(500);
    const otwarta = await ewal(() => __T.widoczne("ppWyborLista"));
    const f0 = await fokus();
    await ewal(() => __T.kapKier("dol"));
    ck("lista partii: naciśnięcie kapsla rozwija ją, a przechył chodzi po partiach",
       otwarta && (await ewal(() => __T.wOknie("ppWyborLista"))) && (await fokus()) !== f0, otwarta + " / " + f0 + " → " + (await fokus()));
    await ewal(() => __T.kapTrzymaj(900));
    await strona.waitForTimeout(500);
    ck("lista partii: przytrzymanie kapsla ją zamyka", !(await ewal(() => __T.widoczne("ppWyborLista"))), await fokus());
  } else ck("lista partii: podgląd ma wybór partii do sprawdzenia", false, "brak #ppWybor na ekranie wyboru");

  // ---- 3b. krok Rozgrywka: kapsel chodzi po polach swojej karty (11-19) -------------------------------------------
  // Przód/tył wybiera pole (Partia, Skin, Instrument, Pomoce, Poziom gry), w bok zmienia wartość, przycisk = gotowe,
  // przytrzymanie u gotowego = jeszcze nie, u niegotowego = powrót do kroku Piosenka. Do 11-19 kapsel zmieniał tylko
  // partię i instrument, a z Rozgrywki nie dało się nim cofnąć ani wybrać poziomu gry.
  await ewal(() => { ZC.lobby("wybor"); });
  await strona.waitForTimeout(700);
  await ewal(() => { ZC.lobby("konfiguracja"); });
  await strona.waitForTimeout(700);
  const pole = () => ewal(() => {
    const S = ZC.dev.S, g = S.gracze.find(x => x.id === __T.ID) || {}, r = document.querySelectorAll("#konfiguracja .pole-kapsla");
    const p = document.querySelector('#ustawienia .ust-preset[aria-checked="true"]');
    return { ramek: r.length, klasa: r.length ? String(r[0].className) : "", gotowy: !!g.gotowy, lobby: S.lobbyEkran, ekran: S.ekran,
      preset: p ? p.dataset.preset : "", znaczek: !document.getElementById("fokusKapsel").hidden };
  });
  let pk = await pole();
  ck("Rozgrywka: kapsel ma jedną ramkę na polu swojej karty, znaczek z menu schowany", pk.ramek === 1 && !pk.znaczek && !/ust-presety/.test(pk.klasa), JSON.stringify(pk));
  const pierwszePole = pk.klasa;
  for (let i = 0; i < 5 && !/ust-presety/.test(pk.klasa); i++) { await ewal(() => __T.kapKier("dol")); pk = await pole(); }
  ck("Rozgrywka: przechył w tył przechodzi przez pola aż do „Poziomu gry”", /ust-presety/.test(pk.klasa) && pk.ramek === 1, pk.klasa);
  const presetPrzed = pk.preset;
  await ewal(() => __T.kapKier(document.querySelector('#ustawienia .ust-preset[aria-checked="true"]').dataset.preset === "mistrz" ? "lewo" : "prawo"));
  await strona.waitForTimeout(300);
  pk = await pole();
  ck("Rozgrywka: przechył w bok na „Poziomie gry” zmienia zestaw", pk.preset && pk.preset !== presetPrzed, presetPrzed + " → " + pk.preset);
  await ewal(k => { ZC.dev.zastosujPreset ? ZC.dev.zastosujPreset(k) : document.querySelector('#ustawienia .ust-preset[data-preset="' + k + '"]').click(); }, presetPrzed);
  await strona.waitForTimeout(300);
  for (let i = 0; i < 5; i++) await ewal(() => __T.kapKier("gora"));
  pk = await pole();
  ck("Rozgrywka: przechył w przód wraca na pierwsze pole", pk.klasa === pierwszePole, pk.klasa);
  await ewal(() => __T.kapKlik());
  pk = await pole();
  ck("Rozgrywka: naciśnięcie = gotowe, ramka znika", pk.gotowy && pk.ramek === 0, JSON.stringify(pk));
  await ewal(() => __T.kapTrzymaj(800));
  pk = await pole();
  ck("Rozgrywka: przytrzymanie u gotowego = jeszcze nie (zostajemy w Rozgrywce)", !pk.gotowy && pk.lobby === "konfiguracja" && pk.ekran === "lobby" && pk.ramek === 1, JSON.stringify(pk));
  await ewal(() => __T.kapTrzymaj(800));
  await strona.waitForTimeout(900);
  ck("Rozgrywka: przytrzymanie u niegotowego cofa do kroku Piosenka", (await stan()).lobby === "wybor", (await stan()).lobby);

  // ---- 4. pauza -------------------------------------------------------------------------------------------------
  await ewal(() => { ZC.lobby("wybor"); });
  await strona.waitForTimeout(600);
  await ewal(() => { ZC.lobby("konfiguracja"); });
  await strona.waitForTimeout(600);
  await ewal(() => { const b = document.getElementById("btnStart"); if (b) b.click(); });
  await strona.waitForFunction(() => ZC.dev.S.ekran === "odliczanie" || ZC.dev.S.ekran === "gra", null, { timeout: 15000 });
  await strona.waitForTimeout(600);
  await ewal(() => ZC.pauza(true));
  await strona.waitForTimeout(500);
  ck("pauza wchodzi z fokusem na „Wróć”", (await fokus()).startsWith("btnWroc"), await fokus());

  przed = await fokus();
  await ewal(() => __T.padKier("dol"));
  ck("pauza: krzyżak pada chodzi po przyciskach", (await fokus()) !== przed, przed + " → " + (await fokus()));

  przed = await fokus();
  await ewal(() => __T.kapKier("dol"));
  ck("pauza: przechył kapsla chodzi po przyciskach", (await fokus()) !== przed, przed + " → " + (await fokus()));

  await ewal(() => { document.getElementById("btnWroc").focus(); });
  await ewal(() => __T.kapKlik());
  await strona.waitForTimeout(400);
  ck("pauza: naciśnięcie kapsla klika „Wróć” i gra wraca do piosenki", !(await stan()).pauza, JSON.stringify(await stan()));

  // ---- 5. wyniki ------------------------------------------------------------------------------------------------
  await ewal(() => { ZC.dev.koniec(); });
  await strona.waitForFunction(() => ZC.dev.S.ekran === "wyniki", null, { timeout: 20000 });
  await strona.waitForTimeout(2600);   // ochrona 2 s po wejściu na wyniki

  przed = await fokus();
  await ewal(() => __T.kapKier("dol"));
  let poPionie = await fokus();
  if (poPionie === przed) { await ewal(() => __T.kapKier("prawo")); poPionie = await fokus(); }
  ck("wyniki: przechył kapsla chodzi po przyciskach karty", poPionie !== przed, przed + " → " + poPionie);

  const naWynikach = await ewal(() => !!document.getElementById("btnInnaPiosenka"));
  if (naWynikach) {
    await ewal(() => { document.getElementById("btnInnaPiosenka").focus(); });
    await ewal(() => __T.kapKlik());
    await strona.waitForTimeout(1200);
    const s = await stan();
    ck("wyniki: naciśnięcie kapsla klika przycisk z fokusem („Inna piosenka”), a nie gra od nowa",
       s.ekran === "lobby", s.ekran + " / " + s.lobby);
  }

  // ---- 6. wejście na wyniki z TRZYMANYM kapslem nie przeskakuje ekranu -------------------------------------------
  await ewal(() => { ZC.lobby("konfiguracja"); });
  await strona.waitForTimeout(500);
  await ewal(() => { const b = document.getElementById("btnStart"); if (b) b.click(); });
  await strona.waitForFunction(() => ZC.dev.S.ekran === "odliczanie" || ZC.dev.S.ekran === "gra", null, { timeout: 15000 });
  await ewal(() => { __T.przycisk(true); });   // gracz trzyma kapsel na ostatniej nucie
  await strona.waitForTimeout(300);
  await ewal(() => { ZC.dev.koniec(); });
  await strona.waitForFunction(() => ZC.dev.S.ekran === "wyniki", null, { timeout: 20000 });
  await strona.waitForTimeout(1400);   // dłużej niż przytrzymanie pilota (0,6 s)
  const poTrzymaniu = await stan();
  await ewal(() => { __T.przycisk(false); });
  await strona.waitForTimeout(400);
  ck("wyniki: kapsel trzymany od ostatniej nuty nie zamyka ekranu wyników",
     poTrzymaniu.ekran === "wyniki" && (await stan()).ekran === "wyniki", poTrzymaniu.ekran + " → " + (await stan()).ekran);

  // ---- 7. koło nagród -------------------------------------------------------------------------------------------
  // Dźwignia nabiera mocy, DOPÓKI przycisk jest trzymany; dla kapsla to samo przytrzymanie było „wstecz”, więc koło
  // zamykało się w trakcie ładowania (10-20). Teraz przycisk w kole należy do dźwigni, a nie do pilota.
  await ewal(() => { if (ZC.dev.S.ekran !== "lobby") document.getElementById("btnInnaPiosenka").click(); });
  await strona.waitForTimeout(1200);
  const losowania = await ewal(() => { try { return Postepy.losowania(Postepy.GOSC); } catch (e) { return 0; } });
  if (losowania > 0) {
    await ewal(() => Nagrody.odbierz(Postepy.GOSC));
    await strona.waitForTimeout(1200);
    ck("koło nagród otwiera się z menu", await ewal(() => !!Nagrody.otwarte), "losowań: " + losowania);
    await ewal(() => { __T.przycisk(true); });
    await strona.waitForTimeout(1200);   // dwa razy dłużej niż przytrzymanie pilota
    const wTrakcie = await ewal(() => ({ otwarte: !!Nagrody.otwarte, laduje: !!document.querySelector(".kolo-dzw.laduje") }));
    await ewal(() => { __T.przycisk(false); });
    await strona.waitForTimeout(900);
    const poPuszczeniu = await ewal(() => ({ otwarte: !!Nagrody.otwarte, laduje: !!document.querySelector(".kolo-dzw.laduje") }));
    ck("koło nagród: przytrzymanie kapsla nabija dźwignię i NIE zamyka okna", wTrakcie.otwarte && wTrakcie.laduje, JSON.stringify(wTrakcie));
    ck("koło nagród: puszczenie kapsla wystrzeliwuje dźwignię (koniec ładowania, okno stoi)",
       poPuszczeniu.otwarte && !poPuszczeniu.laduje, JSON.stringify(poPuszczeniu));
    await ewal(() => Nagrody.zamknij());
    await strona.waitForTimeout(600);
  } else ck("koło nagród: profil ma losowanie do odebrania", false, "losowań: " + losowania);

  // ---- 8. samouczek „Jak grać” ----------------------------------------------------------------------------------
  // Dymek zatrzymuje grę i czeka na „Dalej”. Pad umiał to od 10-16 (A i B), kapsel — dopiero od 10-20.
  await ewal(() => { ZC.lobby("menu"); });
  await strona.waitForTimeout(500);
  const ruszyl = await ewal(() => JakGrac.otworz({}));
  if (ruszyl) {
    await strona.waitForFunction(() => JakGrac.dymek, null, { timeout: 30000 }).catch(() => {});
    const dymek = await ewal(() => !!JakGrac.dymek);
    if (dymek) {
      const krok0 = await ewal(() => JakGrac.krok);
      await ewal(() => __T.kapKlik());
      await strona.waitForTimeout(500);
      ck("samouczek: naciśnięcie kapsla przewija dymek dalej", (await ewal(() => JakGrac.krok)) > krok0,
         krok0 + " → " + (await ewal(() => JakGrac.krok)));
      await strona.waitForFunction(() => JakGrac.dymek, null, { timeout: 30000 }).catch(() => {});
      await ewal(() => __T.kapTrzymaj(900));
      await strona.waitForTimeout(1500);
      ck("samouczek: przytrzymanie kapsla kończy naukę", !(await ewal(() => JakGrac.aktywny)), "aktywny: " + (await ewal(() => JakGrac.aktywny)));
      await ewal(() => { try { JakGrac.zakoncz(false); } catch (e) {} });
    } else ck("samouczek: dymek pojawia się w teście", false, "brak dymka");
  } else ck("samouczek: uruchamia się w teście", false, "JakGrac.otworz zwróciło false");

  // ---- 9. okna, których sterowanie dotąd nie widziało -----------------------------------------------------------
  // „Zgłoś błąd” (js/zglos-blad.js) i karta trybu oszusta (js/menu-dodatki.js) powstają dopiero przy otwarciu i do
  // 10-20 nie było ich w nakladkaLobby(): krzyżak jeździł wtedy po menu POD oknem, a A klikało przycisk za nim.
  // Na końcu testu, bo tryb oszusta zmienia postępy profilu (chowa „Odbierz nagrody”).
  await ewal(() => { ZC.lobby("menu"); });
  await strona.waitForTimeout(700);
  for (const [nazwa, id] of [["Zgłoś błąd", "zglosBlad"], ["karta trybu oszusta", "menuDodatek"]]) {
    await ewal(k => { if (k === "zglosBlad") ZglosBlad.otworz(); else ZC.dodatek.odpal(); }, id);
    await strona.waitForTimeout(700);
    if (!(await ewal(i => __T.widoczne(i), id))) { ck("okno „" + nazwa + "” otwiera się w teście", false, id); continue; }
    await ewal(() => __T.padKier("dol"));
    await ewal(() => __T.padKier("prawo"));
    ck("okno „" + nazwa + "”: krzyżak pada zostaje w oknie, nie ucieka do menu pod spodem",
       await ewal(i => __T.wOknie(i), id), await fokus());
    await ewal(() => __T.kapTrzymaj(900));
    await strona.waitForTimeout(600);
    ck("okno „" + nazwa + "”: przytrzymanie kapsla zamyka okno", !(await ewal(i => __T.widoczne(i), id)), await fokus());
  }

  // ---- 9. krok Rozgrywka klawiaturą i padem: te same pola karty co kapsel (11-19) --------------------------------
  // Do 11-19 góra/dół zmieniało instrument, a bok partię; skin, pomoce i poziom gry wymagały myszy.
  await ewal(() => { ZC.lobby("wybor"); });
  await strona.waitForTimeout(700);
  await ewal(() => { ZC.lobby("konfiguracja"); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); });
  await strona.waitForTimeout(700);
  const klawisz = async k => { await strona.keyboard.down(k); await strona.waitForTimeout(110); await strona.keyboard.up(k); await strona.waitForTimeout(260); };
  const karta = zrodlo => ewal(z => {
    const S = ZC.dev.S, g = S.gracze.find(x => x.zrodlo === z); if (!g) return { jest: false };
    const r = [...document.querySelectorAll("#konfiguracja .pole-kapsla")].find(e => (e.dataset.poleKapsla || "").includes(g.nazwa));
    const p = document.querySelector('#ustawienia .ust-preset[aria-checked="true"]');
    return { jest: true, ramka: r ? String(r.className) : "", gotowy: !!g.gotowy, preset: p ? p.dataset.preset : "" };
  }, zrodlo);
  await klawisz("Enter");
  await strona.waitForTimeout(400);
  let kk = await karta("strzalki");
  ck("Rozgrywka: gracz strzałek dołącza Enterem i ma ramkę na polu karty", kk.jest && /pole-kapsla/.test(kk.ramka) && !/ust-presety/.test(kk.ramka), JSON.stringify(kk));
  for (let i = 0; i < 5 && !/ust-presety/.test(kk.ramka); i++) { await klawisz("ArrowDown"); kk = await karta("strzalki"); }
  ck("Rozgrywka: strzałka w dół przechodzi po polach aż do „Poziomu gry”", /ust-presety/.test(kk.ramka), kk.ramka);
  const presetK = kk.preset;
  await klawisz(presetK === "mistrz" ? "ArrowLeft" : "ArrowRight");
  await strona.waitForTimeout(300);
  kk = await karta("strzalki");
  ck("Rozgrywka: strzałka w bok zmienia zestaw poziomu gry", kk.preset && kk.preset !== presetK, presetK + " → " + kk.preset);
  await ewal(k => { document.querySelector('#ustawienia .ust-preset[data-preset="' + k + '"]').click(); }, presetK);
  await strona.waitForTimeout(300);
  await klawisz("Enter");
  kk = await karta("strzalki");
  ck("Rozgrywka: Enter = gotowe, ramka znika", kk.gotowy && !kk.ramka, JSON.stringify(kk));
  await klawisz("Enter");
  await ewal(() => __T.padPrzycisk(0));
  await strona.waitForTimeout(400);
  let kp = await karta("pad");
  const ramkaPada = kp.ramka;
  await ewal(() => __T.padKier("dol"));
  kp = await karta("pad");
  ck("Rozgrywka: pad dołącza przyciskiem A, a krzyżak w dół przenosi ramkę na następne pole", kp.jest && /pole-kapsla/.test(ramkaPada) && kp.ramka !== ramkaPada && /pole-kapsla/.test(kp.ramka), ramkaPada + " → " + kp.ramka);

  ck("żadnego błędu w konsoli strony", bledy.length === 0, bledy.slice(0, 3).join(" | "));
} catch (e) {
  ck("test sterowania w menu dochodzi do końca", false, String(e && e.stack || e));
} finally {
  await przegladarka.close().catch(() => {});
  serwer.close();
}
console.log(JSON.stringify({ checks }));
