// GRANICA PROFILU MYSZY, SPRAWDZONA PO STRONIE PANELU.
//
// Serwer pilnuje swojej połowy (test_mouse_config.py), ale „zmienione" liczy PRZEGLĄDARKA — i to
// tam jest najkruchsze założenie całej tej funkcji: odcisk musi liczyć DOKŁADNIE te pola, które
// profil niesie. Jedno pole za dużo i każdy kapsel jest „zmieniony" od chwili wczytania, czyli
// ostrzeżenie świeci zawsze i po tygodniu nikt go nie czyta.
//
// Bez przeglądarki i bez serwera: moduł panelu (rf-49c) jest samowystarczalnym plikiem, więc
// wystarczy go uruchomić w `vm` z podstawionymi globalami, których dotyka. MOUSE_KEYS czytamy
// z rf-15 — to JEST lista, z której panel odbudowuje state.mouse, i porównanie ma sens tylko
// wtedy, gdy obie strony biorą ją z tego samego miejsca.
//
// Wywoływane z tests/test_mouse_config.py: argv[2] = {cfg, preset} (obie strony prosto z silnika),
// na wyjściu JSON {checks:[[nazwa, ok, szczegół], …]} — liczy je python, żeby podsumowanie było jedno.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const D = JSON.parse(process.argv[2] || "{}");
const checks = [];
const ck = (name, ok, detail) => checks.push([name, !!ok, detail === undefined ? "" : String(detail)]);

const rf15 = fs.readFileSync(path.join(REPO, "web/js/rf-15-motionmode.js"), "utf8");
const m = /const MOUSE_KEYS=\[([\s\S]*?)\];/.exec(rf15);
if (!m) {
  console.log(JSON.stringify({checks: [["MOUSE_KEYS znalezione w rf-15", false, "brak listy"]]}));
  process.exit(0);
}
const MOUSE_KEYS = new Function("return [" + m[1] + "]")();

// Globale, których dotyka rf-49c. Wszystkie martwe: ten harness liczy odciski, niczego nie wysyła.
const ctx = {MOUSE_KEYS, state: {mouse: D.cfg, devices: {}, activeDeviceId: "d0"}, console,
             _gl: (pl) => pl, rfToast: () => {}, devEntry: () => ({}), onMouseCfg: () => {},
             rfCfgIdCreate: () => ({}), fetch: () => Promise.resolve({json: () => ({})})};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(REPO, "web/js/rf-49c-mouse-config.js"), "utf8"), ctx);
// `const`/`let` z modułu nie ląduje na obiekcie kontekstu — trzeba je odczytać wyrażeniem.
const G = (n) => vm.runInContext(n, ctx);
const SKIP = G("MOUSE_CFG_SKIP");
const A = G("MOUSE_CFG_ADAPTER");
const fp = ctx.mouseCfgFingerprint;

// 1. Kapsel zaraz po zapisaniu swojego profilu NIE MOŻE być „zmieniony". To jest cała funkcja.
const cur = fp(D.cfg);
ck("odcisk kapsla == odcisk jego własnego profilu", cur === fp(D.preset));

// 2. Ta sama granica po obu stronach: pole, które ZOSTAJE przy kapslu, nie ma prawa liczyć się
//    do odcisku — inaczej podłączenie kapsla do innego pada zapalałoby „zmienione".
ck("granica panelu == granica serwera", SKIP.every((k) => !(k in D.preset)),
   SKIP.filter((k) => k in D.preset).join(","));
for (const k of SKIP) {
  const other = Object.assign({}, D.preset);
  const v = D.cfg[k];
  other[k] = (typeof v === "boolean") ? !v : (typeof v === "number") ? v + 7 : "INNE";
  ck("zostaje przy kapslu, więc poza odciskiem: " + k, cur === fp(other));
}

// 3. …a realna zmiana zachowania musi być widoczna od razu.
ck("inna czułość = zmienione", cur !== fp(Object.assign({}, D.preset, {sensX: 0.12})));
ck("inny tryb = zmienione", cur !== fp(Object.assign({}, D.preset, {mode: "dpad"})));
ck("wyłączony dwell = zmienione", cur !== fp(Object.assign({}, D.preset, {dwellOn: false})));

// 4. Liczba wpisana w pole formularza jest TEKSTEM, a ta sama liczba z serwera przychodzi liczbą.
//    Bez wspólnej drogi kapsel byłby „zmieniony" po samym dotknięciu suwaka i powrocie na miejsce.
ck("„0.11” z pola == 0.11 z serwera", cur === fp(Object.assign({}, D.preset, {sensX: "0.11"})));
ck("30.000000000004 == 30", fp({maxStep: 30}) === fp({maxStep: 30.000000000004}));

// 5. Kopia na inny kapsel niesie zachowanie i NIC z tego, co zostaje przy kapslu-celu.
const body = G("_mouseCfgBehaviour")();
ck("kopia na inny kapsel nie niesie nic z granicy",
   SKIP.every((k) => !(k in body)), SKIP.filter((k) => k in body).join(","));
ck("…ale niesie zachowanie", body.sensX === D.cfg.sensX && body.mode === D.cfg.mode);

// 6. Zdanie, którym okna opisują konfigurację, mówi coś o tej konkretnej (a nie zawsze to samo).
ck("opis mówi, dokąd idzie ruch", /drążek/.test(A.describeCurrent()), A.describeCurrent());
ck("…i opis profilu czyta z profilu, nie z kapsla",
   A.describePreset({config: Object.assign({}, D.preset, {mode: "mouse", mouseSource: "axis"})})
     .indexOf("kursor") === 0);

// 7. Wiersz pod „Kalibruj” przy wyłączonym sterowaniu: chip #mState mówi już „○ wyłączony”, więc
//    zdanie obok NIE powtarza „wyłączone”, tylko mówi, GDZIE jest przełącznik (On w nagłówku karty).
ck("rf-15: zdanie „wyłączone — włącz sterowanie (…)” nie wraca", !/_gl\("wyłączone — włącz/.test(rf15));
ck("rf-15: zdanie mówi o przełączniku On w nagłówku karty", /włącz przełącznikiem On w nagłówku karty/.test(rf15));

// 8. Przycisk bloku stanu w Konfiguracji NADAL mówi „Utwórz preset”: adapter myszy nie podmienia
//    `words.createBtn`, więc rf-49j3 bierze domyślny rzeczownik z rf-49 (scena i układ mają własny).
ck("mysz: adapter nie nadpisuje words.createBtn (zostaje „Utwórz preset”)", !(A.words && A.words.createBtn));
ck("rf-49: domyślny createBtn = „Utwórz preset”",
   /createBtn: \["Utwórz preset", "Create a preset"\]/.test(fs.readFileSync(path.join(REPO, "web/js/rf-49-cfgid.js"), "utf8")));
console.log(JSON.stringify({checks}));
