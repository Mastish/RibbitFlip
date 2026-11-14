// GRANICA SCENY SYNTEZATORA, SPRAWDZONA PO STRONIE PANELU.
//
// Serwer pilnuje swojej połowy (test_synth_store.py), ale całą treść sceny — i całe „zmienione" —
// liczy PRZEGLĄDARKA, bo to w niej mieszka model syntezatora. Tu jest więc najkruchsze założenie
// tej funkcji: odcisk musi liczyć DOKŁADNIE to, co scena niesie. Jedno pole za dużo (`enabled` jest
// kandydatem numer jeden, bo zmienia się przy każdym włączeniu padów) i syntezator jest „zmieniony"
// od chwili wczytania, czyli ostrzeżenie świeci zawsze i po tygodniu nikt go nie czyta. Jedno pole
// za mało i scena wczytuje się cicho inna, niż była zapisana.
//
// Bez przeglądarki i bez serwera: model padów (rf-17/rf-19/rf-20) i adapter (rf-49g) to zwykłe
// pliki, więc wystarczy uruchomić je w `vm` z podstawionymi globalami, których dotykają. Model
// jest PRAWDZIWY, nie udawany — inaczej sprawdzalibyśmy własną atrapę.
//
// Wywoływane z tests/test_synth_store.py; na wyjściu JSON {checks:[[nazwa, ok, szczegół], …]} —
// liczy je python, żeby podsumowanie było jedno.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const checks = [];
const ck = (name, ok, detail) => checks.push([name, !!ok, detail === undefined ? "" : String(detail)]);
const clone = (o) => JSON.parse(JSON.stringify(o));

// Globale, których dotykają wczytywane pliki. Wszystkie martwe: ten harness liczy odciski i wpuszcza
// stany w model, niczego nie wysyła i niczego nie rysuje.
const ctx = {
  I18N_EN: {}, console,
  state: { midi: { scale: "chromatic", scaleRoot: 0 }, devices: {} },
  _gl: (pl) => pl,
  rfToast: () => {}, rfConfirm: () => Promise.resolve(false), rfModal: () => Promise.resolve(""),
  rfCfgIdCreate: () => ({ barHtml: () => "", wire: () => {}, sync: () => {} }),
  esc: (s) => String(s),
  fetch: () => Promise.resolve({ json: () => ({}) }),
  document: { getElementById: () => null, querySelector: () => null },
  location: { search: "" },
};
vm.createContext(ctx);
for (const f of ["web/js/rf-17-pad-model.js", "web/js/rf-19-pad-model2.js",
                 "web/js/rf-20-gate-model.js", "web/js/rf-20b-synth-store.js",
                 "web/js/rf-49g-synth-scenes.js"]) {
  vm.runInContext(fs.readFileSync(path.join(REPO, f), "utf8"), ctx);
}
// `const`/`let` z modułu nie ląduje na obiekcie kontekstu — trzeba je odczytać wyrażeniem.
const G = (n) => vm.runInContext(n, ctx);
const call = (expr) => vm.runInContext(expr, ctx);
const XPAD = G("XPAD");
const padState = G("padState");
const padApplyState = G("padApplyState");
const fp = G("synthSceneFingerprint");
const sceneState = G("synthSceneState");

// Stan wyjściowy: dwa pady o różnych brzmieniach, kapsel przypisany do pierwszego, jedno własne
// brzmienie. Tyle wystarczy, żeby każde z pól, o które tu chodzi, miało niepustą wartość.
const SEED = {
  _v: 5, enabled: true, configName: "Ambient pad",
  pads: [
    { id: "p1", name: "Bas", sound: "bass", vol: 70, base: 48, oct: 2,
      dev: { d0: { on: true, axX: "roll", axY: "pitch", range: 45, drag: 30 } } },
    { id: "p2", name: "Struna", sound: "pluck", vol: 55, base: 60, oct: 2, dev: {} }
  ],
  customSounds: { moja: { name: "Moja", emoji: "🎛", patch: { wave: "square", att: 0.02 } },
                  druga: { name: "Druga", emoji: "🎚", patch: { wave: "sine", att: 0.05 } } },
  baseOverrides: {},
  fxPads: []
};

// Stan przepuszczony przez PRAWDZIWY model — dokładnie to, co zapisuje `padSave` i co widzi pasek.
function through(raw) {
  padApplyState(clone(raw));
  return padState();
}

const base = through(SEED);

// 1. TO SAMO ZNACZY TO SAMO. Syntezator zaraz po zapisaniu swojej sceny NIE MOŻE być „zmieniony" —
//    to jest cała ta funkcja.
ck("odcisk stanu == odcisk jego własnej sceny", fp(base) === fp(sceneStateOf(base)),
   fp(base).slice(0, 120));
function sceneStateOf(st) {                    // to, co poleciałoby na serwer jako scena
  const o = {}; Object.keys(st).forEach(k => { if (k !== "enabled" && k !== "configName") o[k] = st[k]; });
  return o;
}
ck("dwa przebiegi tego samego stanu dają ten sam odcisk", fp(through(SEED)) === fp(base));

// 2. PRZEŁĄCZNIK I NAZWA NIE SĄ TREŚCIĄ. Gdyby były, włączenie padów albo zapisanie sceny pod inną
//    nazwą zapalałoby „zmienione" natychmiast po wczytaniu.
{
  const off = clone(base); off.enabled = !base.enabled;
  ck("`enabled` nie zmienia odcisku", fp(off) === fp(base));
  const named = clone(base); named.configName = "Zupełnie inna nazwa";
  ck("`configName` nie zmienia odcisku", fp(named) === fp(base));
  const older = clone(base); older._v = 4;
  ck("numer formatu (`_v`) nie zmienia odcisku", fp(older) === fp(base));
}

// 3. …ALE WSZYSTKO, CO SŁYCHAĆ, ZMIENIA. Cztery piętra modelu: pad, jego brzmienie, mapa kapsla
//    i własne brzmienie z biblioteki.
{
  const other = clone(SEED); other.pads[0].sound = "organ";
  ck("inne brzmienie pada zmienia odcisk", fp(through(other)) !== fp(base));

  const more = clone(SEED); more.pads.push({ id: "p3", name: "Trzeci", sound: "chip", dev: {} });
  ck("dodany pad zmienia odcisk", fp(through(more)) !== fp(base));

  const axes = clone(SEED); axes.pads[0].dev.d0.axY = "twist";
  ck("inna oś w mapie kapsla zmienia odcisk", fp(through(axes)) !== fp(base));

  const range = clone(SEED); range.pads[0].dev.d0.range = 90;
  ck("inny zakres w mapie kapsla zmienia odcisk", fp(through(range)) !== fp(base));

  const drop = clone(SEED); drop.pads[0].dev = {};
  ck("zdjęty kapsel z pada zmienia odcisk", fp(through(drop)) !== fp(base));

  const snd = clone(SEED); snd.customSounds.moja.patch.wave = "sawtooth";
  ck("zmienione własne brzmienie zmienia odcisk", fp(through(snd)) !== fp(base));

  const vol = clone(SEED); vol.pads[0].vol = 71;
  ck("inna głośność pada zmienia odcisk", fp(through(vol)) !== fp(base));
}

// 4. KOLEJNOŚĆ KLUCZY W SŁOWNIKU TO PRZYPADEK HISTORII, NIE TREŚĆ. `customSounds` i mapy `dev` są
//    słownikami: kto kiedy dodał brzmienie, decyduje o kolejności kluczy i o niczym więcej.
{
  const rev = clone(SEED);
  rev.customSounds = { druga: SEED.customSounds.druga, moja: SEED.customSounds.moja };
  ck("kolejność kluczy w customSounds nie zmienia odcisku", fp(through(rev)) === fp(base),
     fp(through(rev)).slice(0, 80) + " vs " + fp(base).slice(0, 80));
}

// 5. LICZBA ZAPISANA DWA RAZY TO TA SAMA LICZBA. Suwak potrafi oddać 0.07000000000000001, a to jest
//    ta sama jasność — bez toFixed dotknięcie suwaka i powrót na miejsce zapalałoby „zmienione".
{
  const a = { pads: [{ fx: { bright: 0.07 } }] };
  const b = { pads: [{ fx: { bright: 0.07000000000000001 } }] };
  ck("drobiazg zmiennoprzecinkowy nie zmienia odcisku", fp(a) === fp(b), fp(a) + " vs " + fp(b));
  // …ale realna różnica na suwaku (1 punkt na sto) MUSI być widoczna.
  ck("realny ruch suwaka zmienia odcisk", fp(a) !== fp({ pads: [{ fx: { bright: 0.08 } }] }));
}

// 6. SCENA NIE NIESIE PRZEŁĄCZNIKA ANI WŁASNEJ NAZWY, ale NIESIE numer formatu (żeby dało się ją
//    kiedyś zmigrować) i mapy kapsli (bo to one mówią, przez które osie kapsel prowadzi instrument).
{
  padApplyState(clone(SEED));
  const sc = sceneState();
  ck("scena bez `enabled`", !("enabled" in sc));
  ck("scena bez `configName`", !("configName" in sc));
  ck("scena z numerem formatu", sc._v === 5);
  ck("scena niesie mapy kapsli", !!(sc.pads && sc.pads[0] && sc.pads[0].dev && sc.pads[0].dev.d0));
  ck("scena niesie własne brzmienia", Object.keys(sc.customSounds || {}).length === 2);
  // Wycinanie robi PŁYTKĄ kopię — żywy stan nie ma prawa stracić pola przy okazji zapisu sceny.
  ck("wycięcie nie okalecza żywego stanu", padState().configName === "Ambient pad"
     && typeof padState().enabled === "boolean");
}

// 7. WCZYTANIE SCENY NIE RUSZA PRZEŁĄCZNIKA. To jest ta sama zasada, co „konfiguracja nie niesie
//    przełączników": scena mówi, JAK syntezator gra, a nie CZY wolno mu zabrzmieć. Zgubione —
//    wczytanie „Perkusji" gra komuś w słuchawkach w środku rozmowy.
{
  padApplyState(clone(SEED));                       // SEED ma enabled:true
  const sc = sceneState();                           // …a scena go nie niesie
  XPAD.enabled = false;                              // człowiek wyłączył pady
  padApplyState(clone(sc));
  ck("scena bez `enabled` zostawia wyłączone pady wyłączonymi", XPAD.enabled === false);
  XPAD.enabled = true;                               // …i tak samo w drugą stronę
  padApplyState(clone(sc));
  ck("scena bez `enabled` zostawia włączone pady włączonymi", XPAD.enabled === true);
  // Stan, który O PRZEŁĄCZNIKU MÓWI (zapis własny, import zestawu), dalej go ustawia.
  padApplyState(Object.assign({}, clone(sc), { enabled: false }));
  ck("stan z `enabled` nadal przestawia przełącznik", XPAD.enabled === false);
}

// 8. WCZYTANIE SCENY ZDEJMUJE STARĄ NAZWĘ. Scena jej nie niesie, więc `padApplyState` musi wyczyścić
//    pole — nazwę nadaje z powrotem adapter (rf-49g), już tę właściwą. Bez tego syntezator nosiłby
//    nazwę sceny, której nie gra.
{
  padApplyState(clone(SEED));
  ck("stan z nazwą nadaje nazwę", XPAD.configName === "Ambient pad");
  padApplyState(clone(sceneState()));
  ck("scena (bez nazwy) zdejmuje starą nazwę", XPAD.configName === "");
  padApplyState({ configName: "  Dwie   spacje  \n i nowa linia  " });
  ck("nazwa przycięta do jednej linii", XPAD.configName === "Dwie spacje i nowa linia",
     JSON.stringify(XPAD.configName));
  padApplyState({ configName: "x".repeat(90) });
  ck("nazwa przycięta do 40 znaków", XPAD.configName.length === 40);
  padApplyState({ configName: 123 });
  ck("liczba w polu nazwy znaczy pusto", XPAD.configName === "");
}

// 9. KTO MA PRAWO ZAPISYWAĆ. Ta sama strona chodzi w trzech rolach i wszystkie trzy uruchamiają
//    `initPad` — dwa okna piszące naraz to jedno nadpisujące drugie.
{
  const mode = (search) => { ctx.location = { search }; return call("synthMirrorAllowed()"); };
  ck("zwykły panel zapisuje", mode("") === true);
  ck("zwykły panel z innym pytaniem w adresie też zapisuje", mode("?second=1") === true);
  ck("okno nakładki NIE zapisuje", mode("?overlay=1&dev=d0") === false);
  ck("ściąga w osobnym oknie NIE zapisuje", mode("?view=overview") === false);
  ctx.location = { search: "" };
}

// 10. JEDEN RZECZOWNIK NAD PRZYCISKIEM I NA NIM. Zdanie bloku stanu (words.noName) mówi „zapisz go jako
//     scenę", więc przycisk pod nim mówi „Utwórz scenę" — a nie „Utwórz preset" wpisane na sztywno.
//     Napis bierze rf-49j3 z `words.createBtn` adaptera; tu sprawdzamy słownik i to, że rf-49j3 go czyta.
{
  const A = G("SYNTH_SCENE_ADAPTER");
  const w = (A.words || {}).createBtn;
  ck("scena: words.createBtn = „Utwórz scenę” / „Create a scene”",
     Array.isArray(w) && w[0] === "Utwórz scenę" && w[1] === "Create a scene", JSON.stringify(w));
  ck("scena: words.noName mówi „jako scenę”", /jako scenę/.test(((A.words || {}).noName || [""])[0]));
  const j3 = fs.readFileSync(path.join(REPO, "web/js/rf-49j3-detail.js"), "utf8");
  ck("rf-49j3: przycisk bloku stanu czyta _cfgW(A, \"createBtn\")", /_cfgW\(A, "createBtn"\)/.test(j3));
  const cfgid = fs.readFileSync(path.join(REPO, "web/js/rf-49-cfgid.js"), "utf8");
  ck("rf-49: domyślny createBtn = „Utwórz preset”", /createBtn: \["Utwórz preset", "Create a preset"\]/.test(cfgid));
}

// 11. PANEL „KAPSLE" NA PADZIE I DWA ZNACZENIA „PRZESTER". Nagłówek panelu kapsli (rf-23) i jego
//     podpowiedź nie miały par w słowniku, więc w EN stały po polsku. „Przester" ma w słowniku JEDNĄ
//     parę — brzmienie „Overdrive"; ten sam wyraz jako parametr efektu (pokrętło / oś Y) brzmi „Drive"
//     i jest składany przez _gl() w rf-19 w chwili ODCZYTU (getter), bo _gl mieszka w rf-24, które
//     ładuje się później. Tu: słownik ma pary, a model podaje etykietę zgodnie z językiem.
{
  const i18nSrc = fs.readFileSync(path.join(REPO, "web/js/rf-01-i18n.js"), "utf8");
  const ictx = { window: {}, document: { addEventListener: () => {}, documentElement: {} },
                 localStorage: { getItem: () => null, setItem: () => {} }, navigator: {}, MutationObserver: function () {},
                 location: { search: "" }, console };
  vm.createContext(ictx);
  let I18N = null;
  try { vm.runInContext(i18nSrc.replace(/^"use strict";/, ""), ictx); I18N = vm.runInContext("I18N_EN", ictx); } catch (e) { ck("rf-01 wczytany w vm", false, e.message); }
  I18N = I18N || {};
  // (nazwy sprawdzeń bez „→” i innych znaków spoza cp1250: test_synth_store.py drukuje je print()-em)
  ck("słownik: „Kapsle” = „Capsules”", I18N["Kapsle"] === "Capsules", I18N["Kapsle"]);
  ck("słownik: podpowiedź panelu kapsli ma parę", I18N["kliknij kapsel, żeby ustawić jego osie"] === "click a capsule to set its axes",
     I18N["kliknij kapsel, żeby ustawić jego osie"]);
  ck("słownik: „Przester” = brzmienie „Overdrive” (jedna para)", I18N["Przester"] === "Overdrive", I18N["Przester"]);
  const FX = G("FX_PARAMS"), META = G("PAD_Y_META");
  ck("model (PL): FX_PARAMS.drive = „Przester”", FX.drive === "Przester", FX.drive);
  ck("model (PL): PAD_Y_META.drive.label = „Przester”", META.drive.label === "Przester", META.drive.label);
  ctx._gl = (pl, en) => en;   // udajemy EN — etykieta ma powstać przy odczycie, nie przy ładowaniu pliku
  ck("model (EN): FX_PARAMS.drive = „Drive”, nie „Overdrive”", FX.drive === "Drive", FX.drive);
  ck("model (EN): PAD_Y_META.drive.label = „Drive”", META.drive.label === "Drive", META.drive.label);
  ck("model: FX_PARAMS nadal wylicza „drive” (Object.keys / for-in)", Object.keys(FX).includes("drive") && "drive" in FX);
  ctx._gl = (pl) => pl;
}

process.stdout.write(JSON.stringify({ checks }) + "\n");
