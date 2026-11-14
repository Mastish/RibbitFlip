// GRANICA KONFIGURACJI OSI 3D, SPRAWDZONA PO STRONIE PANELU.
//
// Serwer pilnuje swojej połowy (test_pose_config.py), ale „zmienione" liczy PRZEGLĄDARKA — i to
// tam jest najkruchsze założenie całej tej funkcji: odcisk musi liczyć DOKŁADNIE te pola, które
// preset niesie. Jedno pole za dużo i każdy kapsel jest „zmieniony" od chwili wczytania, czyli
// ostrzeżenie świeci zawsze i po tygodniu nikt go nie czyta. Jedno za mało — i różnica znika po
// cichu przy „Zapisz zmiany".
//
// Bez przeglądarki i bez serwera: moduł panelu (rf-49h) jest samowystarczalnym plikiem, więc
// wystarczy go uruchomić w `vm` z podstawionymi globalami, których dotyka.
//
// Wywoływane z tests/test_pose_config.py: argv[2] = {cfg, preset} (obie strony prosto z serwera:
// `cfg` to konfiguracja kapsla po zapisie, `preset` to treść presetu z /pose-presets), na wyjściu
// JSON {checks:[[nazwa, ok, szczegół], …]} — liczy je python, żeby podsumowanie było jedno.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const D = JSON.parse(process.argv[2] || "{}");
const checks = [];
const ck = (name, ok, detail) => checks.push([name, !!ok, detail === undefined ? "" : String(detail)]);

// Globale, których dotyka rf-49h. Wszystkie martwe: ten harness liczy odciski i składa zdania,
// niczego nie wysyła.
const ctx = {
  console, state: { devices: {}, activeDeviceId: "d0", viewDev: "d0", posePresets: [] },
  POSE: { dev: "d0" }, poseViewDev: () => "d0", poseCfgObj: () => D.cfg,
  applyPoseConfig: () => {}, loadPosePresetList: () => {}, devEntry: () => ({}),
  _gl: (pl) => pl, _lang: "pl", rfToast: () => {}, rfCfgIdCreate: () => ({}),
  fetch: () => Promise.resolve({ json: () => ({}) }), document: { getElementById: () => null },
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(REPO, "web/js/rf-49h-pose-config.js"), "utf8"), ctx);
// `const`/`let` z modułu nie ląduje na obiekcie kontekstu — trzeba je odczytać wyrażeniem.
const G = (n) => vm.runInContext(n, ctx);
const A = G("POSE_CFG_ADAPTER");
const fp = ctx.poseCfgFingerprint;
const AXIS_KEYS = G("POSE_CFG_AXIS_KEYS");
const CHAN_KEYS = G("POSE_CFG_CHAN_KEYS");
const CHAIN_FIELDS = G("POSE_CFG_CHAIN_FIELDS");

// Kopia z podmienionym polem — bez ruszania oryginału, bo obie strony porównania są współdzielone.
const clone = (o) => JSON.parse(JSON.stringify(o));
function withAxis(base, family, key, field, value) {
  const c = clone(base);
  c[family] = c[family] || {};
  c[family][key] = Object.assign({}, c[family][key] || {}, { [field]: value });
  return c;
}

// 1. Kapsel zaraz po zapisaniu swojej konfiguracji NIE MOŻE być „zmieniony". To jest cała funkcja.
const cur = fp(D.cfg);
ck("odcisk kapsla == odcisk jego własnego presetu", cur === fp(D.preset),
   cur === fp(D.preset) ? "" : cur + "  vs  " + fp(D.preset));
ck("ten sam obiekt policzony dwa razy daje to samo", fp(D.cfg) === fp(clone(D.cfg)));

// 2. Nazwa stoi na WIERZCHU, nie w treści — jej zmiana nie jest zmianą osi.
ck("configName nie wchodzi do odcisku",
   cur === fp(Object.assign(clone(D.preset), { configName: "Zupełnie inna" })));
ck("…i preset zapisany na dysku jej nie niesie", !("configName" in D.preset),
   Object.keys(D.preset).join(","));

// 3. Realna zmiana musi być widoczna od razu — pole po polu, bo każde z nich preset NIESIE.
ck("inna czułość filtra = zmienione", cur !== fp(Object.assign(clone(D.preset), { resp: 0.7 })));
ck("inne wygładzanie podglądu = zmienione", cur !== fp(Object.assign(clone(D.preset), { smoothLvl: 0.2 })));
ck("inne wychylenie (gain) = zmienione", cur !== fp(Object.assign(clone(D.preset), { gain: 2.5 })));
// Wartości logiczne odwracamy względem tego, co jest w presecie — wpisana na sztywno „prawda"
// przechodziłaby przez test, gdyby preset i tak ją miał, i sprawdzała wtedy tyle, co nic.
ck("lustro = zmienione", cur !== fp(Object.assign(clone(D.preset), { mirror: !D.preset.mirror })));
ck("inny tryb podglądu = zmienione", cur !== fp(Object.assign(clone(D.preset), { mode: "gyro" })));
ck("odwrócony przechył = zmienione",
   cur !== fp(Object.assign(clone(D.preset), {
     inv: { pitch: !(D.preset.inv || {}).pitch, roll: !!(D.preset.inv || {}).roll } })));

// 4. KALIBRACJA WCHODZI DO ODCISKU — decyzja opisana w nagłówku rf-49h. Preset ją niesie i nakłada,
//    więc pominięcie jej w odcisku kasowałoby ją po cichu przy „Zapisz zmiany".
const calCh = clone(D.preset);
calCh.cal.acc[0][0] = (calCh.cal.acc[0][0] + 1) % 6;
ck("inny kanał w mapie = zmienione", cur !== fp(calCh));
const calSg = clone(D.preset);
calSg.cal.gyr[2][1] = -calSg.cal.gyr[2][1];
ck("odwrócony znak osi = zmienione", cur !== fp(calSg));

// 5. Łańcuchy strojenia: cztery osie filtra i sześć surowych kanałów, każde pole osobno. To jest ta
//    część konfiguracji, której nikt nie przejrzy wzrokiem — i właśnie dlatego musi się liczyć.
const probe = { on: true, smooth: "adapt", smoothMs: 120, zero: 3, dead: 5, inHi: 42, outHi: 17, expo: 1.6 };
for (const k of AXIS_KEYS) {
  ck("oś filtra liczy się do odcisku: " + k,
     cur !== fp(withAxis(D.preset, "axes", k, "zero", 7)));
}
for (const k of CHAN_KEYS) {
  ck("kanał liczy się do odcisku: " + k,
     cur !== fp(withAxis(D.preset, "chans", k, "dead", 900)));
}
for (const f of CHAIN_FIELDS) {
  ck("pole łańcucha liczy się do odcisku: " + f,
     cur !== fp(withAxis(D.preset, "axes", "tilt", f, probe[f])),
     f + "=" + probe[f]);
}

// 6. Ta sama liczba z pola formularza (TEKST) i z serwera (liczba) to ta sama konfiguracja. Bez
//    wspólnej drogi kapsel byłby „zmieniony" po samym dotknięciu suwaka i powrocie na miejsce.
ck("„0.34” z pola == 0.34 z serwera",
   fp({ resp: "0.34" }) === fp({ resp: 0.34 }));
ck("0.34000000000000004 == 0.34",
   fp({ resp: 0.34 }) === fp({ resp: 0.34000000000000004 }));
ck("„adapt” zostaje tekstem, nie liczbą",
   fp(withAxis(D.preset, "axes", "tilt", "smooth", "adapt")) !== cur);

// 7. Struktura odcisku zgadza się z tym, co preset NIESIE: każdy klucz treści presetu musi mieć
//    wpływ na odcisk (poza `configName`, którego preset nie ma). Test odwrotny do punktu 3 — łapie
//    pole DOŁOŻONE do presetu po stronie serwera, o którym panel nie wie.
const ignored = [];
for (const k of Object.keys(D.preset)) {
  const v = D.preset[k];
  let other;
  if (typeof v === "boolean") other = Object.assign(clone(D.preset), { [k]: !v });
  else if (typeof v === "number") other = Object.assign(clone(D.preset), { [k]: v + 7 });
  else if (typeof v === "string") other = Object.assign(clone(D.preset), { [k]: v + "X" });
  else continue;                                     // słowniki sprawdzone punkt po punkcie wyżej
  if (fp(other) === cur) ignored.push(k);
}
ck("żadne pole presetu nie jest pomijane przez odcisk", ignored.length === 0, ignored.join(","));

// 8. Zdanie, którym okna opisują konfigurację, mówi coś o TEJ konkretnej (a nie zawsze to samo).
const desc = A.describeCurrent();
ck("opis mówi o czułości i mapie kanałów", /czułość/.test(desc) && /akcel CH/.test(desc), desc);
ck("…i opis presetu czyta z presetu, nie z kapsla",
   A.describePreset({ config: Object.assign(clone(D.preset), { gain: 3.5 }) }).indexOf("×3,50") > 0,
   A.describePreset({ config: Object.assign(clone(D.preset), { gain: 3.5 }) }));
// Odmiana liczebnika liczona od konfiguracji, w której NIC nie jest dostrojone — „5 oś" w oknie
// pytającym o zgodę na zastąpienie czyjejś pracy czyta się jak usterka i odbiera oknu powagę.
const bare = clone(D.preset);
for (const k of AXIS_KEYS) if (bare.axes && bare.axes[k]) bare.axes[k].on = false;
for (const k of CHAN_KEYS) if (bare.chans && bare.chans[k]) bare.chans[k].on = false;
ck("bez strojenia opis o nim milczy", A.describePreset({ config: bare }).indexOf("dostrojon") < 0,
   A.describePreset({ config: bare }));
ck("jedna dostrojona oś to „1 dostrojona oś”",
   A.describePreset({ config: withAxis(bare, "axes", "tilt", "on", true) }).indexOf("1 dostrojona oś") > 0,
   A.describePreset({ config: withAxis(bare, "axes", "tilt", "on", true) }));
ck("dwie to „2 dostrojone osie”",
   A.describePreset({ config: withAxis(withAxis(bare, "axes", "tilt", "on", true), "axes", "roll", "on", true) })
     .indexOf("2 dostrojone osie") > 0);
ck("pięć to „5 dostrojonych osi”",
   A.describePreset({ config: CHAN_KEYS.slice(0, 5).reduce((c, k) => withAxis(c, "chans", k, "on", true), bare) })
     .indexOf("5 dostrojonych osi") > 0);

console.log(JSON.stringify({ checks }));
