// RIBBITBEAT: utwory z pobranych paczek są kartami w zakładce „Moje”.
//
// Uruchomienie (git-bash, z katalogu repo):
//   node tests/gry_paczki_biblioteka.mjs
// Wołane też z tests/test_gry_zabi_chor.py. Wymaga globalnego @playwright/test, jak tests/gry_zabi_chor_dzwiek.mjs;
// bez niego kończy się linią {"pominiete": "..."} i test py to pomija.
//
// Co robi: stawia serwer plików web/ na wolnym porcie i UDAJE trasy /gry/api/ paczek (ribbitflip_songpacks.py)
// na trzech wygenerowanych tutaj plikach MIDI, w dwóch paczkach: „testowa-a” jest pobrana od początku,
// „testowa-b” pobiera się dopiero w trakcie testu. Strona gry nie wie, że serwer jest udawany, więc sprawdzamy
// dokładnie to, co robi przeglądarka u gracza:
//   1. zakładki biblioteki to Wszystkie / Wbudowane / Moje — osobnej „Paczki” nie ma,
//   2. utwory pobranej paczki wchodzą do biblioteki SAME, jako zwykłe karty w „Moich” (bez klikania wiersza),
//      i liczą się w „Moich” i we „Wszystkich”,
//   3. szukajka biblioteki znajduje utwór z paczki po tytule i po kompozytorze,
//   4. „Pobierz paczkę” kończy się kartami nowych utworów, bez przeładowania strony,
//   5. „Usuń paczkę” zabiera jej karty z biblioteki, a utwory drugiej paczki zostają,
//   6. sekcja paczek jest zwinięta, gdy coś już jest pobrane, i rozwija się kliknięciem.
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

// ---- generator SMF: format 0, jedna ścieżka, `ile` ćwierćnut gamy od C4 ----------------------------------------
function midi(ile) {
  const b = [];
  const u32 = n => b.push((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
  const u16 = n => b.push((n >>> 8) & 255, n & 255);
  const sciezka = [];
  const zdarzenie = (dt, ...bajty) => { sciezka.push(dt, ...bajty); };
  zdarzenie(0, 0xFF, 0x51, 3, 0x07, 0xA1, 0x20);                 // 120 BPM
  zdarzenie(0, 0xFF, 0x58, 4, 4, 2, 24, 8);                      // 4/4
  for (let i = 0; i < ile; i++) { zdarzenie(0, 0x90, 60 + (i % 8), 100); zdarzenie(96, 0x80, 60 + (i % 8), 0); }
  zdarzenie(0, 0xFF, 0x2F, 0);
  b.push(0x4D, 0x54, 0x68, 0x64); u32(6); u16(0); u16(1); u16(96);
  b.push(0x4D, 0x54, 0x72, 0x6B); u32(sciezka.length);
  b.push(...sciezka);
  return Buffer.from(b);
}

// ---- udawane paczki (kontrakt ribbitflip_songpacks.py) ----------------------------------------------------------
const UTWORY = {
  "testowa-a": [
    { id: "zabia-gama.mid", title: "Żabia gama testowa", composer: "Kumkowski, Jan", license: "cc0-1.0",
      license_url: "https://creativecommons.org/publicdomain/zero/1.0/", source_url: "https://example.org/a", plik: "zabia-gama.mid" },
    { id: "stawowy-walc.mid", title: "Stawowy walc", composer: "Rzekotka, Anna", license: "cc-by-4.0", midi_author: "Testowy Autor",
      license_url: "https://creativecommons.org/licenses/by/4.0/", source_url: "https://example.org/b", plik: "stawowy-walc.mid" },
  ],
  "testowa-b": [
    { id: "trzcinowy-marsz.mid", title: "Trzcinowy marsz", composer: "Kumkowski, Jan", license: "cc0-1.0",
      license_url: "https://creativecommons.org/publicdomain/zero/1.0/", source_url: "https://example.org/c", plik: "trzcinowy-marsz.mid" },
  ],
};
const BAJTY = { "zabia-gama.mid": midi(16), "stawowy-walc.mid": midi(24), "trzcinowy-marsz.mid": midi(20) };
const zainstalowane = { "testowa-a": true, "testowa-b": false };
const zadania = {};

function stanPaczek() {
  return Object.keys(UTWORY).map(id => ({
    pack_id: id, name: "Paczka " + id, name_en: "Pack " + id, description: "Paczka testowa.", description_en: "Test pack.",
    license_summary: "CC0 i CC BY", license_summary_en: "CC0 and CC BY", dataset: "test/test", revision: "main",
    songs_total: UTWORY[id].length, songs_installed: zainstalowane[id] ? UTWORY[id].length : 0,
    download_bytes: 1024 * 1024, size_bytes: 4096, zadanie: null, katalog: "C:\\\\test\\\\" + id,
  }));
}

const TYPY = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ico": "image/x-icon", ".mid": "audio/midi" };

function json(res, obj) {
  const b = Buffer.from(JSON.stringify(obj), "utf-8");
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Content-Length": b.length });
  res.end(b);
}

const serwer = http.createServer((req, res) => {
  const u = new URL(req.url, "http://127.0.0.1");
  const sciezka = decodeURIComponent(u.pathname);
  if (sciezka.startsWith("/gry/api/")) {
    const trasa = sciezka.slice("/gry/api/".length);
    if (trasa === "pakiety") return json(res, { ok: true, pakiety: stanPaczek(), katalog: "C:\\\\test" });
    if (trasa === "pakiety/utwory") {
      const p = u.searchParams.get("pack");
      return json(res, { ok: true, utwory: zainstalowane[p] ? UTWORY[p] : [] });
    }
    if (trasa === "pakiety/plik") {
      const dane = BAJTY[u.searchParams.get("song")];
      if (!dane) { res.writeHead(404, { "Content-Type": "application/json" }); return res.end('{"ok":false,"error":"brak"}'); }
      res.writeHead(200, { "Content-Type": "audio/midi", "Content-Length": dane.length });
      return res.end(dane);
    }
    if (trasa === "zadanie") {
      const z = zadania[u.searchParams.get("id")];
      return json(res, { ok: !!z, zadanie: z || null });
    }
    if (trasa === "pakiety/pobierz" || trasa === "pakiety/usun") {
      let cialo = "";
      req.on("data", k => { cialo += k; });
      req.on("end", () => {
        const d = JSON.parse(cialo || "{}");
        if (trasa === "pakiety/usun") { zainstalowane[d.pack] = false; return json(res, { ok: true }); }
        const z = { id: "z" + Object.keys(zadania).length, typ: "pakiet", stan: "trwa", bajty: 0, bajtyRazem: 1024,
          utwory: 0, utworyRazem: UTWORY[d.pack].length, blad: null, uwagi: [], pack_id: d.pack };
        zadania[z.id] = z;
        setTimeout(() => { zainstalowane[d.pack] = true; Object.assign(z, { stan: "gotowe", bajty: 1024, utwory: UTWORY[d.pack].length }); }, 300);
        return json(res, { ok: true, zadanie: z });
      });
      return;
    }
    return json(res, { ok: false, error: "nieznana trasa" });
  }
  const plik = path.normalize(path.join(WEB, sciezka.endsWith("/") ? sciezka + "index.html" : sciezka));
  if (!plik.startsWith(WEB) || !fs.existsSync(plik) || fs.statSync(plik).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": TYPY[path.extname(plik)] || "application/octet-stream", "Cache-Control": "no-store" });
  fs.createReadStream(plik).pipe(res);
});
await new Promise(ok => serwer.listen(0, "127.0.0.1", ok));
const port = serwer.address().port;

const przegladarka = await chromium.launch();
const strona = await (await przegladarka.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
const bledy = [];
strona.on("pageerror", e => bledy.push(String(e)));
strona.on("console", m => { if (m.type() === "error") bledy.push(m.text()); });
strona.on("response", r => { if (r.status() >= 400) bledy.push("HTTP " + r.status() + " " + r.url()); });

// kolejka utworów z paczek rusza po wczytaniu własnych plików, więc samo `ladowanie === 0` bywa za wcześnie:
// czekamy na zapowiedzianą liczbę kart z paczek, a dopiero potem na pustą kolejkę
const spokoj = async ile => {
  await strona.waitForFunction(() => typeof Biblioteka !== "undefined" && Biblioteka._B.zbudowana, null, { timeout: 30000 });
  if (ile != null) await strona.waitForFunction(n => Biblioteka._B.zPaczek.length === n, ile, { timeout: 30000 });
  await strona.waitForFunction(() => !Biblioteka._B.ladowanie, null, { timeout: 30000 });
};
const stan = () => strona.evaluate(() => {
  const B = Biblioteka._B;
  const lista = document.querySelector("#blista-folder .biblio-lista");
  return {
    zakladki: [...document.querySelectorAll(".biblio-filtr")].map(b => b.dataset.f),
    etykiety: [...document.querySelectorAll(".biblio-filtr .biblio-filtr-et")].map(b => b.textContent),
    liczniki: [...document.querySelectorAll(".biblio-filtr")].map(b => b.querySelector(".biblio-licznik").textContent),
    wpisy: B.wpisy.size, zPaczek: B.zPaczek.length, moje: B.moje.length,
    tytulyPaczek: B.zPaczek.map(id => B.wpisy.get(id).zr.tytul).sort(),
    rodzaje: [...new Set(B.zPaczek.map(id => B.wpisy.get(id).rodzaj))],
    wLiscieMoich: B.zPaczek.filter(id => {
      const li = B.karty.get(id);
      return li && li.parentNode === lista;
    }).length,
    gotoweDoGry: B.zPaczek.filter(id => { const w = B.wpisy.get(id); return !!(w && w.gra && w.gra.partie.length); }).length,
    wybrana: ZC.stan().piosenka && ZC.stan().piosenka.id,
    paczki: Pakiety.stan(),
    dodaj: LobbyScena.dodaj(),
  };
});

try {
  await strona.goto("http://127.0.0.1:" + port + "/gry/?zywe=0", { waitUntil: "domcontentloaded" });
  await strona.waitForFunction(() => typeof Wczytywanie === "undefined" || Wczytywanie.gotowe, null, { timeout: 30000 });   // zasłona wczytywania zeszła
  await spokoj(2);
  await strona.evaluate(() => ZC.lobby("wybor"));   // biblioteka jest widoczna dopiero w kroku 1 „Piosenka”
  let s = await stan();

  ck("zakładki biblioteki: Wszystkie, Wbudowane, Moje — osobnej „Paczki” już nie ma",
     JSON.stringify(s.zakladki) === '["wszystkie","wbudowane","folder"]', s.zakladki.join(","));
  ck("utwory pobranej paczki wchodzą do biblioteki same, bez klikania wiersza",
     s.zPaczek === 2 && JSON.stringify(s.tytulyPaczek) === '["Stawowy walc","Żabia gama testowa"]', s.tytulyPaczek.join(" | "));
  ck("każdy z nich jest wpisem rodzaju „pakiet” i gotową piosenką do gry",
     JSON.stringify(s.rodzaje) === '["pakiet"]' && s.gotoweDoGry === 2, [s.rodzaje.join(","), s.gotoweDoGry]);
  ck("liczniki: „Moje” liczy utwory z paczek, „Wszystkie” też",
     s.liczniki[2] === "2" && s.liczniki[0] === String(s.wpisy), s.liczniki.join("/") + " przy " + s.wpisy + " wpisach");
  ck("krok 1 wita zakładką „Wybierz utwór”, „Wgraj własny” czeka obok",
     s.dodaj.otwarty === false && await strona.evaluate(() =>
       document.getElementById("btnWybierzUtwor").getAttribute("aria-selected") === "true" &&
       document.getElementById("btnDodajUtwory").getAttribute("aria-selected") === "false" &&
       document.getElementById("dodajPanel").hidden), JSON.stringify(s.dodaj));
  // ekran wchodzi za zasłoną przejścia, więc animacje zakładki ruszają chwilę po ZC.lobby("wybor")
  const animacjeZakladki = () => strona.evaluate(() => document.getElementById("btnDodajUtwory").getAnimations({ subtree: true })
    .map(a => a.animationName).sort().join(","));
  await strona.waitForFunction(() => document.getElementById("btnDodajUtwory").getAnimations({ subtree: true }).length >= 3,
    null, { timeout: 5000 }).catch(() => {});
  ck("niewybrana zakładka „Wgraj własny” zaprasza ruchem (poświata, błysk, plus)",
     await animacjeZakladki() === "kWgrajBlysk,kWgrajPlus,kWgrajPoswiata", await animacjeZakladki());

  // dalej pracujemy w zakładce „Moje”: to tam stoją wszystkie utwory gracza (paczki od 10-20 w pasku „Dodaj utwory”)
  await strona.evaluate(() => Biblioteka.ustawFiltr("folder"));
  s = await stan();
  ck("ich karty stoją na liście zakładki „Moje”", s.wLiscieMoich === 2, s.wLiscieMoich);

  // ---- szukajka biblioteki obejmuje utwory z paczek -------------------------------------------------------------
  const szukaj = async q => strona.evaluate(async fraza => {
    Biblioteka.ustawFiltr("folder");
    Biblioteka.szukaj(fraza);
    await new Promise(r => setTimeout(r, 120));
    const lista = document.querySelector("#blista-folder .biblio-lista");
    return [...lista.children].filter(li => li.classList.contains("bkarta") && !li.hidden)
      .map(li => Biblioteka.wpis(li.dataset.id).zr.tytul);
  }, q);
  ck("szukajka biblioteki znajduje utwór z paczki po tytule",
     JSON.stringify(await szukaj("walc")) === '["Stawowy walc"]', JSON.stringify(await szukaj("walc")));
  ck("szukajka biblioteki znajduje utwory z paczki po kompozytorze (opis karty)",
     JSON.stringify(await szukaj("rzekotka")) === '["Stawowy walc"]', JSON.stringify(await szukaj("rzekotka")));
  await strona.evaluate(() => Biblioteka.szukaj(""));

  // ---- zakładka „Wgraj własny” (11-19; wcześniej pasek „Dodaj utwory”): plik, adres i paczki w jej panelu ----------
  await strona.click("#btnDodajUtwory");
  await strona.waitForTimeout(400);
  const rozw = await strona.evaluate(() => ({ stan: LobbyScena.dodaj().otwarty,
    kart: document.querySelectorAll("#bibPaczki .pk-karta").length,
    aria: document.getElementById("btnDodajUtwory").getAttribute("aria-selected"),
    lista: document.getElementById("btnWybierzUtwor").getAttribute("aria-selected"),
    panel: !document.getElementById("dodajPanel").hidden,
    kolumny: [...document.querySelectorAll("#wybor .kol-piosenki,#wybor .kol-wybrana")].map(k => getComputedStyle(k).display).join(","),
    animacje: document.getElementById("btnDodajUtwory").getAnimations({ subtree: true }).length,
    plikNadPaczkami: !!(document.querySelector("#dodajPanel .pk-plik-strefa").compareDocumentPosition(
      document.getElementById("bibPaczki")) & Node.DOCUMENT_POSITION_FOLLOWING),
    naglowekPaczek: !!document.querySelector("#bibPaczki .pk-paczki-naglowek"),
    url: !!document.getElementById("pkUrlPole") }));
  ck("kliknięcie „Wgraj własny” wybiera zakładkę: kafel każdej paczki, pole adresu i wybór pliku w jednym miejscu",
     rozw.stan === true && rozw.kart === 2 && rozw.aria === "true" && rozw.lista === "false" && rozw.panel && rozw.url, JSON.stringify(rozw));
  ck("wybrana zakładka „Wgraj własny” zastępuje kolumny biblioteki i przestaje migać",
     rozw.kolumny === "none,none" && rozw.animacje === 0, JSON.stringify(rozw));
  ck("w zakładce najpierw własny plik, pod nim gotowe paczki z własnym nagłówkiem",
     rozw.plikNadPaczkami && rozw.naglowekPaczek, JSON.stringify(rozw));
  ck("panel zakładki leży w kroku 1 (nie w zakładce „Moje” biblioteki)",
     await strona.evaluate(() => !!document.querySelector("#wybor .dodaj-pasek #dodajPanel #bibPaczki")), "dodajPanel");

  // ---- pobranie drugiej paczki ---------------------------------------------------------------------------------
  await strona.click('#bibPaczki .pk-karta[data-pack="testowa-b"] .pk-pobierz');
  await spokoj(3);
  s = await stan();
  ck("„Pobierz paczkę”: jej utwór jest w bibliotece od razu, bez przeładowania strony",
     s.zPaczek === 3 && s.tytulyPaczek.includes("Trzcinowy marsz"), s.tytulyPaczek.join(" | "));
  ck("po pobraniu liczniki rosną: „Moje” 3, „Wszystkie” = liczba wpisów",
     s.liczniki[2] === "3" && s.liczniki[0] === String(s.wpisy), s.liczniki.join("/"));
  ck("karty nowej paczki też stoją na liście „Moje”", s.wLiscieMoich === 3, s.wLiscieMoich);

  // ---- usunięcie paczki ----------------------------------------------------------------------------------------
  await strona.evaluate(() => {
    const k = document.querySelector('#bibPaczki .pk-karta[data-pack="testowa-a"] .pk-usun');
    k.click();
    document.querySelector(".pk-usun-tak").click();
  });
  await spokoj(1);
  s = await stan();
  ck("„Usuń paczkę” zabiera z biblioteki jej utwory, a drugiej paczki nie rusza",
     s.zPaczek === 1 && JSON.stringify(s.tytulyPaczek) === '["Trzcinowy marsz"]', s.tytulyPaczek.join(" | "));
  ck("po usunięciu wybrana piosenka nadal istnieje w bibliotece",
     await strona.evaluate(() => !!Biblioteka._B.wpisy.get(ZC.stan().piosenka.id)), s.wybrana);
  // ---- 10-20: zakładka „Wgraj własny” i szuflada zamykają się „wstecz”, a ekran pod nimi zostaje ---------------
  const esc = () => strona.evaluate(() => document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
  await esc();
  await strona.waitForTimeout(400);
  ck("Esc wraca z „Wgraj własny” na „Wybierz utwór”, a nie cofa z kroku 1",
     await strona.evaluate(() => !LobbyScena.dodaj().otwarty && S.lobbyEkran === "wybor" &&
       document.getElementById("btnWybierzUtwor").getAttribute("aria-selected") === "true" &&
       getComputedStyle(document.querySelector("#wybor .kol-piosenki")).display !== "none"),
     await strona.evaluate(() => S.lobbyEkran + "/" + LobbyScena.dodaj().otwarty));

  await strona.evaluate(() => document.querySelector("#blista-folder .bkarta .bkarta-ust").click());
  await strona.waitForTimeout(400);
  ck("⚙ na wierszu wysuwa szufladę „Ustawienia piosenki” przy prawej krawędzi",
     await strona.evaluate(() => {
       const sz = document.getElementById("szuflada");
       if (sz.hidden) return false;
       const r = sz.getBoundingClientRect();
       return Math.abs(r.right - document.querySelector("#wybor .lobby-kolumny").getBoundingClientRect().right) < 4;
     }), "szuflada");
  await esc();
  await strona.waitForTimeout(400);
  ck("Esc zamyka szufladę, a nie cofa z kroku 1",
     await strona.evaluate(() => document.getElementById("szuflada").hidden && S.lobbyEkran === "wybor"),
     await strona.evaluate(() => S.lobbyEkran));

  ck("strona bez błędów w konsoli przez cały przebieg", bledy.length === 0, bledy.slice(0, 3).join(" | "));
} catch (e) {
  ck("przebieg paczek w bibliotece kończy się bez wyjątku", false, (e && e.message) || String(e));
} finally {
  await przegladarka.close();
  serwer.close();
}
console.log(JSON.stringify({ checks }));
