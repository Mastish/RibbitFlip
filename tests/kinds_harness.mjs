// REJESTR RODZAJÓW I WSPÓLNY IMPORT — SPRAWDZONE PO STRONIE PANELU.
//
// Serwer pilnuje swojej połowy (test_kinds_contract.py), ale to panel decyduje, DOKĄD trafi
// upuszczony plik. Trzy rzeczy muszą być prawdziwe, a żadnej z nich nie widać w teście serwera:
//
//  1. KAŻDA KOPERTA MA SWÓJ RODZAJ. `rfKindByEnv("rest-preset")` musi coś zwrócić — brak wpisu
//     znaczy, że plik wpadnie w gałąź zestawu i skończy komunikatem „Pusty lub nieznany zestaw".
//     Dokładnie to zdarzyło się 2026-08-31 presetowi usług i presetowi koła.
//  2. NIC SIĘ NIE NADPISUJE. `_rfpiFreeName` musi omijać nazwy zajęte — także wtedy, gdy różnią
//     się wyłącznie wielkością liter albo liczbą spacji (serwer zwija jedno i drugie, więc
//     porównanie „na oko" uznałoby wolną nazwę za zajętą i odwrotnie).
//  3. LICZEBNIK PO POLSKU. „2 aplikacji" to zdanie, po którym widać maszynowe tłumaczenie.
//
// Bez przeglądarki i bez serwera: rf-49-kinds i rf-29d to samowystarczalne pliki, więc wystarczy
// uruchomić je w `vm` z najmniejszymi możliwymi globalami. Wywoływane z tests/test_kinds_contract.py;
// na wyjściu JSON {checks:[[nazwa, ok, szczegół], …]}, liczone po stronie Pythona, żeby
// podsumowanie testu było jedno.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const checks = [];
const ck = (name, ok, detail) => checks.push([name, !!ok, detail === undefined ? "" : String(detail)]);

const ctx = {
  window: {}, I18N_EN: {}, console,
  _gl: (pl, en) => pl,                       // panel po polsku — tu chodzi o polskie formy
  fetch: () => Promise.reject(new Error("brak sieci w harnessie")),
  rfToast: () => {},
  rfCfgIdKey: (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().toLowerCase()
};
ctx.window.window = ctx.window;
vm.createContext(ctx);
for (const f of ["web/js/rf-49-kinds.js", "web/js/rf-29d-preset-import.js"]) {
  try {
    vm.runInContext(fs.readFileSync(path.join(REPO, f), "utf8"), ctx, { filename: f });
  } catch (e) {
    ck("plik " + f + " wykonuje się bez błędu", false, String(e && e.message));
  }
}

// ---------------------------------------------------------------------------
//  1. każda koperta ma swój rodzaj
// ---------------------------------------------------------------------------
const ENVELOPES = ["setup", "bundle", "profile", "pose-preset", "mouse-preset",
                   "midi-preset", "rest-preset", "wheel-preset", "rest-actions"];
for (const e of ENVELOPES) {
  const K = ctx.rfKindByEnv ? ctx.rfKindByEnv(e) : null;
  ck("koperta „" + e + "” ma rodzaj w rejestrze", !!K, K ? K.id : "BRAK");
}
ck("nieznana koperta nie zmyśla rodzaju", ctx.rfKindByEnv("cos-obcego") === null);
ck("pusta koperta nie zmyśla rodzaju", ctx.rfKindByEnv("") === null && ctx.rfKindByEnv(null) === null);

// ---------------------------------------------------------------------------
//  2. każdy rodzaj jest opisany do końca
// ---------------------------------------------------------------------------
// ⚠️ `const` na górnym poziomie skryptu NIE staje się właściwością kontekstu `vm` (tak samo, jak
// nie staje się właściwością `window` w przeglądarce — ta sama pułapka, przez którą `window.state`
// jest w tym projekcie zawsze `undefined`). Deklaracje `function` owszem, i dlatego `rfKindByEnv`
// wyżej działa. Rejestr czytamy więc z `window`, na które plik wystawia go jawnie.
const K = ctx.RF_KINDS || ctx.window.RF_KINDS || {};
ck("rejestr nie jest pusty", Object.keys(K).length >= 10, Object.keys(K).length);
for (const id of Object.keys(K)) {
  const k = K[id];
  ck("„" + id + "”: nazwa PL w trzech formach",
    !!(k.pl && k.pl.one && k.pl.many && k.pl.prefix !== undefined), JSON.stringify(k.pl));
  ck("„" + id + "”: nazwa EN w trzech formach",
    !!(k.en && k.en.one && k.en.many && k.en.prefix !== undefined), JSON.stringify(k.en));
  ck("„" + id + "”: przedrostek pliku z rodziny ribbitflip-",
    /^ribbitflip-/.test(String(k.file || "")), k.file);
  ck("„" + id + "”: id wpisane w pozycję", k.id === id, k.id);
  if (k.importable) {
    ck("„" + id + "”: importowalny rodzaj ma drogę wejścia", !!k.dropVia, String(k.dropVia));
  }
  if (k.api && k.api.list) {
    ck("„" + id + "”: lista ma klucz odpowiedzi", !!k.api.listKey, String(k.api.listKey));
  }
}

// Presety modułów muszą mieć adapter po nazwie i klucz opisu — bez nich Biblioteka pokaże
// pozycję, której nie umie ani opisać, ani wczytać.
for (const id of (ctx.RF_KIND_PRESETS || ctx.window.RF_KIND_PRESETS || [])) {
  const k = K[id];
  ck("preset modułu „" + id + "”: ma klucz adaptera", !!(k && k.key), k && k.key);
  ck("preset modułu „" + id + "”: ma zakładkę", !!(k && k.tab), k && k.tab);
}

// ---------------------------------------------------------------------------
//  3. wolna nazwa: nic się nie nadpisuje
// ---------------------------------------------------------------------------
const free = ctx._rfpiFreeName;
if (typeof free !== "function") {
  ck("_rfpiFreeName istnieje", false, "brak funkcji");
} else {
  ck("wolna nazwa zostaje bez zmian", free("Precyzja", []) === "Precyzja", free("Precyzja", []));
  ck("zajęta nazwa dostaje (2)",
    free("Precyzja", [{ name: "Precyzja" }]) === "Precyzja (2)",
    free("Precyzja", [{ name: "Precyzja" }]));
  ck("dwie zajęte dają (3)",
    free("Precyzja", [{ name: "Precyzja" }, { name: "Precyzja (2)" }]) === "Precyzja (3)",
    free("Precyzja", [{ name: "Precyzja" }, { name: "Precyzja (2)" }]));
  // Wielkość liter i biały znak: serwer zwija jedno i drugie (rfCfgIdKey / _safe_profile_name),
  // więc „precyzja" i „Precyzja  " to TA SAMA nazwa i nie wolno na nią nadpisać.
  ck("inna wielkość liter to ta sama nazwa",
    free("Precyzja", [{ name: "PRECYZJA" }]) === "Precyzja (2)",
    free("Precyzja", [{ name: "PRECYZJA" }]));
  ck("podwójna spacja to ta sama nazwa",
    free("kamera + strzelanie", [{ name: "kamera +  strzelanie" }]) === "kamera + strzelanie (2)",
    free("kamera + strzelanie", [{ name: "kamera +  strzelanie" }]));
  ck("lista samych napisów też działa",
    free("Okna", ["Okna"]) === "Okna (2)", free("Okna", ["Okna"]));
  ck("pusta nazwa dostaje zastępczą", String(free("", [])).length > 0, free("", []));
}

// ---------------------------------------------------------------------------
//  4. liczebnik po polsku
// ---------------------------------------------------------------------------
const pl = ctx.rfPl;
if (typeof pl !== "function") {
  ck("rfPl istnieje", false, "brak funkcji");
} else {
  const f = (n) => pl(n, "aplikacja", "aplikacje", "aplikacji", "application", "applications");
  ck("1 aplikacja", f(1) === "aplikacja", f(1));
  ck("2 aplikacje", f(2) === "aplikacje", f(2));
  ck("5 aplikacji", f(5) === "aplikacji", f(5));
  ck("0 aplikacji", f(0) === "aplikacji", f(0));
  // Nastki są wyjątkiem od reguły ostatniej cyfry — 12, 13, 14 biorą formę „aplikacji".
  ck("12 aplikacji (nastka)", f(12) === "aplikacji", f(12));
  ck("22 aplikacje", f(22) === "aplikacje", f(22));
  ck("112 aplikacji (nastka w setce)", f(112) === "aplikacji", f(112));
}

process.stdout.write(JSON.stringify({ checks }) + "\n");
