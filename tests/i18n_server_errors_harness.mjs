// KOMUNIKATY BŁĘDÓW Z SERWERA MAJĄ ANGIELSKIE BRZMIENIE — SPRAWDZONE PO STRONIE PANELU.
//
// ribbitflip_monitor.py odpowiada po polsku ({"ok": False, "error": "…"}, _err("…"),
// ValueError("…") w ObsLink) i NIE zna języka panelu — to panel tłumaczy te zdania w chwili,
// gdy lądują w toaście, w #cmdResult albo na karcie OBS (słownik I18N_EN + I18N_EN_PATTERNS
// w web/js/rf-01-i18n.js). Serwer nigdy nie jest tu zmieniany; ten skrypt pilnuje, żeby KAŻDE
// polskie zdanie, które serwer potrafi wysłać, miało po stronie panelu klucz albo wzorzec.
//
// Bez przeglądarki i bez serwera: rf-01-i18n.js wykonuje się w `vm` z najmniejszymi możliwymi
// globalami (localStorage → "en", żeby `_lang` było angielskie), literały wyciąga regex
// z monitor.py, a %d/%s podstawia się liczbą/tekstem, tak jak robi to serwer. Wywoływany
// z tests/test_i18n_dupes.py; na wyjściu JSON {checks:[[nazwa, ok, szczegół], …]} w ostatniej
// linii, liczony po stronie Pythona. Można też uruchomić samodzielnie:
//   node tests/i18n_server_errors_harness.mjs   (drukuje PASS/FAIL i JSON)
//
// ALLOW: zdania, których panel nie pokaże (odpowiedzi tylko dla wywołań spoza panelu — MCP,
// curl, drugi proces) — trzymane tu z powodem, żeby nie udawały tłumaczenia.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const checks = [];
const ck = (name, ok, detail) => checks.push([name, !!ok, detail === undefined ? "" : String(detail)]);

// --- rf-01 w vm ------------------------------------------------------------------------------
const ctx = {
  console,
  window: {},
  navigator: { languages: ["en-US"], language: "en-US" },
  localStorage: { getItem: () => "en", setItem() {} },
  fetch: () => Promise.reject(new Error("brak sieci w harnessie")),
};
ctx.window.window = ctx.window;
ctx.globalThis = ctx;
vm.createContext(ctx);
let RF = null;
try {
  const src = fs.readFileSync(path.join(REPO, "web/js/rf-01-i18n.js"), "utf8");
  // `const` na górnym poziomie skryptu nie staje się właściwością kontekstu — eksport jawny.
  vm.runInContext(src + "\n;globalThis.__RF={I18N_EN,I18N_EN_PATTERNS,_i18nTry,_i18nT,_lang};", ctx, { filename: "rf-01-i18n.js" });
  RF = ctx.__RF;
} catch (e) {
  ck("rf-01-i18n.js wykonuje się w vm", false, String(e && e.message));
}
ck("rf-01: _lang = en w harnessie", RF && RF._lang === "en", RF && RF._lang);

// --- literały z monitor.py -------------------------------------------------------------------
const py = fs.readFileSync(path.join(REPO, "ribbitflip_monitor.py"), "utf8");
const STR = `"(?:[^"\\\\\\n]|\\\\.)*"`;                       // jeden literał w cudzysłowie
const SEQ = `(${STR}(?:\\s*\\n?\\s*${STR})*)`;                // literały sklejone przez sąsiedztwo
const FORMS = [
  [new RegExp(`"error":\\s*${SEQ}`, "g"), "error"],
  [new RegExp(`\\b_err\\(\\s*${SEQ}`, "g"), "_err"],
  [new RegExp(`\\bValueError\\(\\s*${SEQ}`, "g"), "ValueError"],
  [new RegExp(`\\b_fail\\(\\s*${SEQ}`, "g"), "_fail"],
];
const unq = s => JSON.parse(s.replace(/\\'/g, "'"));          // literały py są zgodne z JSON w tym pliku
const PL = /[ąćęłńóśźż]/i;
const PLWORD = /\b(brak|nie|jest|musi|zbyt|za|tylko|pusta|pusty|nieznany|nieznana|błąd|dozwolone|niedozwolon\w*|urządzeni\w*|konfiguracj\w*|komenda|nagłów\w*)\b/i;
const found = new Map();                                       // zdanie → {line, form}
for (const [re, form] of FORMS) {
  let m;
  while ((m = re.exec(py))) {
    const lits = m[1].match(new RegExp(STR, "g")) || [];
    let s;
    try { s = lits.map(unq).join(""); } catch (e) { continue; }
    if (!s.trim()) continue;
    if (!(PL.test(s) || PLWORD.test(s))) continue;              // nie-polskie (nazwy pól, kody) pomijamy
    const line = py.slice(0, m.index).split("\n").length;
    // sklejenie z wartością: `"… : " + k` — serwer dokleja tekst, my doklejamy „x”
    const after = py.slice(m.index + m[0].length, m.index + m[0].length + 12);
    if (/^\s*\+/.test(after) || /[:\s]$/.test(s)) s = s + "x";
    if (!found.has(s)) found.set(s, { line, form });
  }
}
ck("monitor.py: znaleziono ≥ 60 polskich zdań błędów", found.size >= 60, found.size);

// %d → 7, %s → x (jak serwer przy formatowaniu); %r → 'x'
const fill = s => s.replace(/%d/g, "7").replace(/%s/g, "x").replace(/%r/g, "'x'").replace(/%%/g, "%");

// Zdania nieosiągalne z panelu (odpowiedź tylko dla wywołań spoza niego) — nie potrzebują klucza.
const ALLOW = new Map([
  ["Transfer-Encoding nieobsługiwane — użyj Content-Length", "warstwa HTTP: fetch() panelu zawsze wysyła Content-Length; dostaje to tylko ręczny klient"],
  ["brak kapsla (dev) w żądaniu", "POST /overlay: panel zawsze podaje dev (rf-41d); tylko ręczne żądanie"],
  ["brak okna (win) w żądaniu", "POST /overlay act=remove: panel zawsze podaje win; tylko ręczne żądanie"],
  ["brak okna (win) ani kapsla (dev)", "POST /overlay: panel zawsze podaje jedno z nich; tylko ręczne żądanie"],
  ["nieznana akcja nakładki: %s", "POST /overlay: panel wysyła tylko znane act; tylko ręczne żądanie"],
  ["Brak entries[]", "POST dziennika REST: panel zawsze wysyła entries[]; tylko ręczne żądanie"],
  ["Nieznana akcja: %s", "POST /pads: panel wysyła tylko znane act; tylko ręczne żądanie"],
  ["modul '%s' jest podstawowy i nie da sie go wylaczyc (podstawowe: %s) / '%s' is a core module and cannot be switched off",
   "--disable/--only: komunikat konsoli przed startem serwera, PL i EN w jednym zdaniu; panel go nie pokazuje"],
  ["nieznany modul '%s'; poprawne nazwy: %s / unknown module '%s'; valid names: %s",
   "--disable/--only: komunikat konsoli przed startem serwera, PL i EN w jednym zdaniu; panel go nie pokazuje"],
]);

let missing = [];
for (const [s, where] of found) {
  const z = fill(s);
  const en = RF ? RF._i18nTry(z) : z;
  const ok = en !== z && !PL.test(en);
  if (!ok && ALLOW.has(s)) { ck(`ALLOW ${where.form}:${where.line} ${s.slice(0, 60)} — ${ALLOW.get(s)}`, true); continue; }
  ck(`${where.form}:${where.line} „${s.slice(0, 70)}” → EN`, ok, ok ? en.slice(0, 70) : "BRAK klucza/wzorca (" + en.slice(0, 60) + ")");
  if (!ok) missing.push(s);
}
ck("monitor.py: 0 zdań błędów bez angielskiego brzmienia (poza ALLOW)", missing.length === 0, missing.length + ": " + missing.slice(0, 6).join(" | "));

// Wzorce z 2.6 (rf-01) — próbki z liczbą / adresem, tak jak składa je serwer
const SAMPLES = [
  ["Windows pokazuje grze najwyżej 4 kontrolery", "Windows shows a game at most 4 controllers"],
  ["Więcej niż 8 urządzeń OSC nie da się dodać. Usuń któreś, żeby zrobić miejsce.", "More than 8 OSC devices cannot be added. Remove one to make room."],
  ["Serwer pod tym adresem nie mówi WebSocketem (HTTP/1.1 404 Not Found)", "The server at this address does not speak WebSocket (HTTP/1.1 404 Not Found)"],
  ["Niedozwolony nagłówek: host", "Header not allowed: host"],
  ["Ramka z OBS jest zbyt duża (123456 B)", "The frame from OBS is too large (123456 B)"],
  ["○ symulacja (brak urządzenia): 201000 — symulacja — brak urządzenia (komenda nie wysłana)", "○ simulation (no device): 201000 — simulation — no device (command not sent)"],
  ["✕ błąd: 201000 — brak połączenia", "✕ error: 201000 — no connection"],
  ["✕ Nieprawidłowy hex (użyj par bajtów, np. 20 10 00)", "✕ Invalid hex (use byte pairs, e.g. 20 10 00)"],
  ["✕ serwer nieosiągalny", "✕ server unreachable"],
  ["Port musi być z zakresu 1024-65535", "Port must be in the 1024-65535 range"],
];
for (const [pl, want] of SAMPLES) {
  const got = RF ? RF._i18nTry(pl) : pl;
  ck(`wzorzec: „${pl.slice(0, 50)}” → „${want.slice(0, 50)}”`, got === want, got);
}

// --- wynik -------------------------------------------------------------------------------------
let nf = 0;
for (const [n, ok, d] of checks) { if (!ok) nf++; console.log((ok ? "PASS  " : "FAIL  ") + n + (ok || !d ? "" : "  -- " + d)); }
console.log(JSON.stringify({ checks }));
process.exitCode = nf ? 1 : 0;
