// RIBBITBEAT: zakryty przycisk „Studio instrumentów” w menu — wymaganie:
// „studio instrumentów w menu niech będzie od początku widoczne ale zakryte i z informacją »Graj więcej aby odblokować«
// 🙂 takie czarne holo połyskujące”.
//
// Uruchomienie (git-bash, z katalogu repo):
//   node tests/gry_studio_menu.mjs [--zrzut plik.png]
// Wołane też z tests/test_gry_studio_menu.py. Wymaga globalnego @playwright/test, jak tests/gry_wybor_planszy.mjs; bez
// niego kończy się linią {"pominiete": "..."} i test py to pomija. Serwer statyczny jest w tym procesie (port 0), więc po
// końcu nic nie zostaje.
//
// Co sprawdza w prawdziwej przeglądarce: świeży profil = przycisk widoczny, .zakryte, aria-disabled, podpis z kłódką,
// czarny filc, klik nic nie otwiera; po odblokowaniu (ZC.postepy.odblokujWszystko + Studio.odswiez) = .holo, podpis
// schowany, klik otwiera Studio; ?odblokuj=1 = od razu .holo. Ostatnia linia wyjścia: JSON {checks:[[nazwa, ok, szczegół], …]}.
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
const zrzutI = process.argv.indexOf("--zrzut");
const ZRZUT = zrzutI > 0 ? process.argv[zrzutI + 1] : "";

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
const [vw, vh] = (process.env.RB_VIEWPORT || "1600x880").split("x").map(Number);   // np. RB_VIEWPORT=1280x720 do zrzutu wąskiego ekranu
const kontekst = await przegladarka.newContext({ viewport: { width: vw, height: vh } });
const strona = await kontekst.newPage();
const bledy = [];
strona.on("pageerror", e => bledy.push(String(e)));
strona.on("console", m => { if (m.type() === "error" && !/vibrate/i.test(m.text())) bledy.push(m.text()); });

const ewal = (fn, ...a) => strona.evaluate(fn, ...a);
const spij = ms => strona.waitForTimeout(ms);

// Menu gotowe: gra wczytana, konto gościa wybrane (okno „Kto gra na tym komputerze?” zamknięte). Wołane po każdym goto.
async function menu() {
  await strona.waitForFunction(() => typeof ZC !== "undefined" && ZC.dev && ZC.dev.S && typeof Postepy !== "undefined" && typeof Studio !== "undefined" && (typeof Wczytywanie === "undefined" || Wczytywanie.gotowe),   // zasłona wczytywania zeszła
    null, { timeout: 30000 });
  await spij(600);
  await ewal(() => {
    const b = [...document.querySelectorAll("#kontoOkno button")].find(x => /Graj jako|Play as/.test(x.textContent));
    if (b) b.click();
    localStorage.setItem("ribbitbeat.jakGrac", "1");
  });
  await spij(500);
}
const stan = () => ewal(() => {
  const b = document.getElementById("btnStudio"), p = b && b.querySelector(".st-menu-podpis"), kl = b && b.querySelector(".st-menu-klodka");
  const cs = b && getComputedStyle(b);
  return b ? { hidden: b.hidden, widoczny: b.offsetHeight > 0, holo: b.classList.contains("holo"), zakryte: b.classList.contains("zakryte"),
    ariaDisabled: b.getAttribute("aria-disabled"), tekst: b.textContent.replace(/\s+/g, " ").trim(),
    podpisWidoczny: !!(p && p.offsetHeight > 0), klodka: !!(kl && kl.querySelector("svg, img, .ikona-filc")),
    tlo: cs.backgroundColor, kursor: cs.cursor, ikona: !!b.querySelector(".sti"), ekran: document.getElementById("lobby").dataset.ekran } : null;
});
const kliknij = () => ewal(() => { document.getElementById("btnStudio").click(); });
const ekran = () => ewal(() => document.getElementById("lobby").dataset.ekran);

try {
  // ---- 1. świeży profil: widoczne, zakryte, z podpisem; klik nic nie robi -------------------------------------
  await strona.goto("http://127.0.0.1:" + port + "/gry/?zywe=0&dev=1", { waitUntil: "domcontentloaded" });
  await menu();
  const z = await stan();
  ck("świeży profil: przycisk Studia jest w menu od początku (nie `hidden`, ma wysokość)", z && !z.hidden && z.widoczny, JSON.stringify(z));
  ck("świeży profil: przycisk zakryty — klasa .zakryte, bez .holo, aria-disabled", z && z.zakryte && !z.holo && z.ariaDisabled === "true", JSON.stringify(z));
  // Zakryty przycisk nie zdradza nazwy — zamiast niej „???”, jak zakryte kafle instrumentów i skinów
  ck("świeży profil: zamiast nazwy „???”, pod spodem „Graj więcej, aby odblokować” z kłódką",
     z && /\?\?\?/.test(z.tekst) && !/Studio instrumentów/.test(z.tekst) && /Graj więcej, aby odblokować/.test(z.tekst) && z.podpisWidoczny && z.klodka,
     z && z.tekst + " | kłódka " + z.klodka);
  // kursor zostaje grą: piankowa rękawica jest wskaźnikiem całego menu (10-20), także nad zakrytym przyciskiem
  ck("świeży profil: czarny filc (#141414) i ikona sekretu na miejscu",
     z && z.tlo === "rgb(20, 20, 20)" && z.ikona, z && z.tlo + " / ikona " + z.ikona);
  if (ZRZUT) { await spij(2000); await strona.screenshot({ path: ZRZUT }); }   // 2 s: logo i scena kończą animację wejścia
  await kliknij();
  await spij(400);
  ck("świeży profil: klik w zakryty przycisk niczego nie otwiera (menu zostaje)", (await ekran()) === "menu", await ekran());

  // ---- 2. odblokowanie w locie: ten sam przycisk staje się holo i otwiera Studio ------------------------------
  await ewal(() => { ZC.postepy.odblokujWszystko(true); Studio.odswiez(); });
  await spij(400);
  const o = await stan();
  ck("po odblokowaniu: ten sam przycisk ma .holo bez .zakryte, aria-disabled=false, schowany podpis i nazwę zamiast „???”",
     o && o.holo && !o.zakryte && o.ariaDisabled === "false" && !o.podpisWidoczny && o.widoczny && /Studio instrumentów/.test(o.tekst) && !/\?\?\?/.test(o.tekst),
     JSON.stringify(o));
  await kliknij();
  await strona.waitForFunction(() => document.getElementById("lobby").dataset.ekran === "studioEkran", null, { timeout: 10000 }).catch(() => {});
  ck("po odblokowaniu: klik otwiera Studio instrumentów", (await ekran()) === "studioEkran", await ekran());

  // ---- 3. ?odblokuj=1 od startu: holo od razu ---------------------------------------------------------------------
  await strona.goto("http://127.0.0.1:" + port + "/gry/?zywe=0&dev=1&odblokuj=1", { waitUntil: "domcontentloaded" });
  await menu();
  const u = await stan();
  ck("?odblokuj=1: przycisk od razu holo, widoczny, bez podpisu", u && u.holo && !u.zakryte && !u.hidden && !u.podpisWidoczny, JSON.stringify(u));

  ck("strona gry bez błędów w konsoli przez cały test", bledy.length === 0, bledy.slice(0, 3).join(" | "));
} catch (e) {
  ck("test zakrytego Studia przechodzi bez wyjątku", false, e && e.stack);
} finally {
  await przegladarka.close();
  serwer.close();
}
console.log(JSON.stringify({ checks }));
