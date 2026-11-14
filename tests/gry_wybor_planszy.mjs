// RIBBITBEAT: kto wybiera planszę i jak wygląda jej wybór — wymaganie:
// „przy wybieraniu planszy niech będzie awatar gracza wybierającego. i same plansze sortuj wg jakości.
// pozwól też pominąć losowanie […] jeśli użytkownik wybierze planszę. może dodaj tam »wybierz losową«
// albo »wybierają wszyscy«”.
//
// Uruchomienie (git-bash, z katalogu repo):
//   node tests/gry_wybor_planszy.mjs
// Wołane też z tests/test_gry_wybor_planszy.py. Wymaga globalnego @playwright/test, jak tests/gry_sterowanie_menu.mjs;
// bez niego kończy się linią {"pominiete": "..."} i test py to pomija.
//
// Czyste funkcje (planPlanszy, planszeWgJakosci) pilnuje tests/gry_zabi_chor_harness.mjs. Tutaj chodzi o to, czego
// w Node nie widać: trzy opcje w pasku „Plansza”, okno po „Śpiewamy!” (kafle wg rzadkości, awatar wybierającego),
// losowanie bez wybierania i start bez okna, gdy plansza jest wskazana palcem.
// Ostatnia linia wyjścia: JSON {checks:[[nazwa, ok, szczegół], …]}.
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
const kontekst = await przegladarka.newContext({ viewport: { width: 1440, height: 900 } });
const strona = await kontekst.newPage();
const bledy = [];
strona.on("pageerror", e => bledy.push(String(e)));
strona.on("console", m => { if (m.type() === "error" && !/vibrate/i.test(m.text())) bledy.push(m.text()); });

const ewal = (fn, ...a) => strona.evaluate(fn, ...a);
const spij = ms => strona.waitForTimeout(ms);

// Lobby gotowe do grania: konto gościa, wszystkie plansze zdobyte (inaczej okno się nie pokazuje), gracz przy myszy,
// krok „Rozgrywka”. Wołane po każdym przeładowaniu strony.
async function lobby() {
  await strona.waitForFunction(() => typeof ZC !== "undefined" && ZC.dev && ZC.dev.S && typeof Postepy !== "undefined" && (typeof Wczytywanie === "undefined" || Wczytywanie.gotowe), null, { timeout: 30000 });   // zasłona wczytywania zeszła
  await spij(600);
  await ewal(() => {
    const b = [...document.querySelectorAll("#kontoOkno button")].find(x => /Graj jako|Play as/.test(x.textContent));
    if (b) b.click();
    localStorage.setItem("ribbitbeat.jakGrac", "1");   // samouczek przy pierwszym „Zagraj” pytałby o siebie
  });
  await spij(600);
  await ewal(() => { ZC.postepy.odblokujWszystko(true); ZC.dolacz("mysz"); ZC.lobby("wybor"); });
  await spij(500);
  await ewal(() => ZC.lobby("konfiguracja"));
  await spij(700);
}
const tryb = () => ewal(() => ZC.dev.S.ust.planszaTryb);
const ustawTryb = t => ewal(t => { document.querySelector('#scenaWspolna .plansza-tryb-opcja[data-tryb="' + t + '"]').click(); }, t);
const start = () => ewal(() => { document.getElementById("btnStart").click(); });
const oknoJest = () => ewal(() => !!document.getElementById("losPlanszy"));

try {
  await strona.goto("http://127.0.0.1:" + port + "/gry/?zywe=0&dev=1", { waitUntil: "domcontentloaded" });
  await lobby();

  // ---- 1. pasek „Plansza”: trzy opcje, domyślnie wybierają wszyscy ----------------------------------------------
  const opcje = await ewal(() => [...document.querySelectorAll("#scenaWspolna .plansza-tryb-opcja")]
    .map(b => [b.dataset.tryb, b.textContent.trim(), b.getAttribute("aria-checked"), (b.title || "").length > 10]));
  ck("pasek „Plansza”: trzy opcje „Kto wybiera planszę”, każda z dymkiem, domyślnie „Wybierają wszyscy”",
     opcje.length === 3 && opcje.map(o => o[0]).join(",") === "wszyscy,los,ta" && opcje.every(o => o[1] && o[3]) &&
     opcje[0][2] === "true" && opcje[1][2] === "false" && opcje[2][2] === "false", JSON.stringify(opcje));

  // ---- 2. „Wybierają wszyscy”: okno z kaflami wg jakości i awatarem wybierającego -------------------------------
  await start();
  await strona.waitForSelector("#losPlanszy .wp-kafel", { timeout: 15000 });
  const okno = await ewal(() => {
    const kafle = [...document.querySelectorAll("#losPlanszy .wp-kafel")];
    const li = document.querySelector("#losPlanszy .wp-gracze li");
    const aw = li && li.querySelector("img.wp-awatar"), znacz = document.querySelector("#losPlanszy .wp-znaczek img.wp-awatar");
    return { tytul: document.querySelector(".los-planszy-tytul").textContent,
      rz: kafle.map(k => k.dataset.rz || "brak"), plansz: ZC.postepy.ekipa().odblokowane.length,
      awatarWLiscie: !!(aw && aw.naturalWidth > 0), awatarNaKaflu: !!(znacz && znacz.naturalWidth > 0),
      awatarPlik: aw ? aw.getAttribute("src") : null, kursor: kafle.filter(k => k.classList.contains("kursor")).length };
  });
  const KOLEJNOSC = ["sekretny", "legendarny", "epicki", "rzadki", "zwykly", "brak"];
  const rangi = okno.rz.map(r => KOLEJNOSC.indexOf(r));
  ck("okno wyboru: kafle wszystkich zdobytych plansz stoją wg jakości — od sekretnej do zwykłej",
     okno.rz.length === okno.plansz && okno.rz.length > 5 && rangi.every((r, i) => i === 0 || rangi[i - 1] <= r) &&
     okno.rz[0] !== okno.rz[okno.rz.length - 1], okno.rz.join(","));
  ck("okno wyboru: wybierający ma swojego awatara żaby w liście nad siatką i na kaflu, na którym stoi jego kursor",
     okno.awatarWLiscie && okno.awatarNaKaflu && /assets\/frog\/awatary\//.test(okno.awatarPlik || "") && okno.kursor === 1,
     okno.awatarPlik + " / kursor na " + okno.kursor + " kaflach");

  // klik w kafel wybiera i kończy się startem gry (jeden człowiek = nie ma czego losować)
  await ewal(() => { document.querySelectorAll("#losPlanszy .wp-kafel")[1].click(); });
  await strona.waitForFunction(() => ZC.dev.S.ekran !== "lobby", null, { timeout: 20000 });
  ck("okno wyboru: po wyborze jedynego człowieka gra rusza, a okno znika", !(await oknoJest()), await ewal(() => ZC.dev.S.ekran));

  // ---- 3. „Ta plansza”: bez okna i bez losowania -----------------------------------------------------------------
  await strona.goto("http://127.0.0.1:" + port + "/gry/?zywe=0&dev=1", { waitUntil: "domcontentloaded" });
  await lobby();
  await ustawTryb("ta");
  const zPaska = await ewal(() => ZC.postepy.ekipa().motyw);
  await start();
  await strona.waitForFunction(() => ZC.dev.S.ekran !== "lobby", null, { timeout: 20000 });
  const poTa = await ewal(() => ({ okno: !!document.getElementById("losPlanszy"), plansza: ZC.postepy.ekipa().motyw, ekran: ZC.dev.S.ekran }));
  ck("„Ta plansza”: „Śpiewamy!” nie otwiera okna ani losowania — gramy na planszy z paska",
     !poTa.okno && poTa.plansza === zPaska, JSON.stringify(poTa));

  // ---- 4. „Wybierz losową”: samo losowanie, bez wybierania --------------------------------------------------------
  await strona.goto("http://127.0.0.1:" + port + "/gry/?zywe=0&dev=1", { waitUntil: "domcontentloaded" });
  await lobby();
  ck("tryb planszy pamięta się między grami (zapis ustawień)", (await tryb()) === "ta", await tryb());
  await ustawTryb("los");
  await start();
  await strona.waitForSelector("#losPlanszy", { timeout: 15000 });
  const los = await ewal(() => ({ tytul: document.querySelector(".los-planszy-tytul").textContent,
    kafli: document.querySelectorAll("#losPlanszy .wp-kafel").length,
    listaUkryta: !!document.querySelector("#losPlanszy .wp-gracze").hidden }));
  ck("„Wybierz losową”: okno wchodzi od razu w losowanie — bez siatki kafli i bez listy wybierających",
     los.kafli === 0 && los.listaUkryta && los.tytul.length > 3, JSON.stringify(los));
  await strona.waitForFunction(() => ZC.dev.S.ekran !== "lobby", null, { timeout: 40000 });
  const poLos = await ewal(() => ({ okno: !!document.getElementById("losPlanszy"), plansza: ZC.postepy.ekipa().motyw,
    odblokowane: ZC.postepy.ekipa().odblokowane }));
  ck("„Wybierz losową”: losowanie kończy się planszą ze zdobytych i startem gry",
     !poLos.okno && poLos.odblokowane.includes(poLos.plansza), poLos.plansza);

  // ---- 5. wybór planszy w oknie „Plansza” pomija losowanie --------------------------------------------------------
  await strona.goto("http://127.0.0.1:" + port + "/gry/?zywe=0&dev=1", { waitUntil: "domcontentloaded" });
  await lobby();
  await ustawTryb("wszyscy");
  const wybor = await ewal(() => {
    ZC.otworzSceneWspolna("tlo");
    const kafle = [...document.querySelectorAll("#wyborGracza .scena-kafel:not(.zablokowany)")];
    const cel = kafle[kafle.length - 1]; cel.click();
    return cel.dataset.v;
  });
  await spij(600);
  const poWyborze = await ewal(() => ({ tryb: ZC.dev.S.ust.planszaTryb, motyw: ZC.postepy.ekipa().motyw,
    zaznaczona: (document.querySelector('#scenaWspolna .plansza-tryb-opcja[aria-checked="true"]') || {}).dataset }));
  ck("wskazanie planszy w oknie „Plansza” przestawia pasek na „Ta plansza” — gra jej już nie losuje",
     poWyborze.tryb === "ta" && poWyborze.motyw === wybor && poWyborze.zaznaczona && poWyborze.zaznaczona.tryb === "ta",
     JSON.stringify(poWyborze));
  await ewal(() => { const z = document.querySelector("#wyborGracza .tablica-zamknij"); if (z) z.click(); });
  await spij(300);
  await ustawTryb("wszyscy");
  await start();
  await strona.waitForSelector("#losPlanszy .wp-kafel", { timeout: 15000 });
  ck("po powrocie na „Wybierają wszyscy” okno wyboru znów wchodzi", await oknoJest());

  ck("strona gry bez błędów w konsoli przez cały test", bledy.length === 0, bledy.slice(0, 3).join(" | "));
} catch (e) {
  ck("test okna wyboru planszy przechodzi bez wyjątku", false, e && e.stack);
} finally {
  await przegladarka.close();
  serwer.close();
}
console.log(JSON.stringify({ checks }));
