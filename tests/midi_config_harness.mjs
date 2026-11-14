// GRANICA PRESETU MIDI/OSC, SPRAWDZONA PO STRONIE PANELU.
//
// Serwer pilnuje swojej połowy (test_midi_config.py), ale „zmienione" liczy PRZEGLĄDARKA — i to
// tam jest najkruchsze założenie całej tej funkcji: odcisk musi liczyć DOKŁADNIE te pola, które
// preset niesie. Jedno pole za dużo i każdy kapsel jest „zmieniony" od chwili wczytania, czyli
// ostrzeżenie świeci zawsze i po tygodniu nikt go nie czyta. Jedno za mało i zmiana, którą ktoś
// właśnie zrobił, znika po cichu przy „Zapisz zmiany".
//
// Mapowanie ma ponad sześćdziesiąt pól, więc lista w panelu jest wypisana z ręki — i to ONA jest
// tu głównym podejrzanym. Sprawdzenie 3 porównuje ją z tym, co REALNIE zwraca `_sanitize_map`
// silnika (klucze przychodzą z Pythona), bo każde nowe pole mapowania dodane kiedykolwiek
// w przyszłości musi trafić także tutaj — a nic poza tym testem by o tym nie przypomniało.
//
// Bez przeglądarki i bez serwera: moduł panelu (rf-49d) jest samowystarczalnym plikiem, więc
// wystarczy go uruchomić w `vm` z podstawionymi globalami, których dotyka.
//
// Wywoływane z tests/test_midi_config.py: argv[2] = {cfg, preset, mapKeys, skip} (wszystko prosto
// z silnika), na wyjściu JSON {checks:[[nazwa, ok, szczegół], …]} — liczy je python, żeby
// podsumowanie było jedno.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const D = JSON.parse(process.argv[2] || "{}");
const checks = [];
const ck = (name, ok, detail) => checks.push([name, !!ok, detail === undefined ? "" : String(detail)]);

// Globale, których dotyka rf-49d. Wszystkie martwe: ten harness liczy odciski, niczego nie wysyła.
const ctx = {state: {midi: D.cfg, midiPresets: [], devices: {}, activeDeviceId: "d0", midiDev: "d0",
                     midiEditing: null},
             console, _gl: (pl) => pl, _lang: "pl", rfToast: () => {}, devEntry: () => ({}),
             onMidiCfg: () => {}, closeMidiEditor: () => {}, rfCfgIdCreate: () => ({}),
             performance: {now: () => 0}, fetch: () => Promise.resolve({json: () => ({})})};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(REPO, "web/js/rf-49d-midi-config.js"), "utf8"), ctx);
// `const`/`let` z modułu nie ląduje na obiekcie kontekstu — trzeba je odczytać wyrażeniem.
const G = (n) => vm.runInContext(n, ctx);
const SKIP = G("MIDI_CFG_SKIP");
const FIELDS = G("MIDI_CFG_MAP_FIELDS");
const A = G("MIDI_CFG_ADAPTER");
const fp = ctx.midiCfgFingerprint;

// Preset z jedną zmianą w pierwszym mapowaniu — najczęstsza operacja w tym pliku.
const withMap = (patch) => {
  const o = JSON.parse(JSON.stringify(D.preset));
  o.mappings[0] = Object.assign({}, o.mappings[0], patch);
  return o;
};

// 1. Kapsel zaraz po zapisaniu swojego zestawu NIE MOŻE być „zmieniony". To jest cała funkcja.
const cur = fp(D.cfg);
ck("odcisk kapsla == odcisk jego własnego presetu", cur === fp(D.preset));

// 2. Ta sama granica po obu stronach — najpierw dosłownie ta sama LISTA (rozjazd tutaj jest cichy:
//    front przestałby liczyć pole, którego preset i tak nie niesie, albo odwrotnie).
ck("granica panelu == granica serwera (ta sama lista)",
   JSON.stringify(SKIP.slice().sort()) === JSON.stringify((D.skip || []).slice().sort()),
   SKIP + " vs " + D.skip);
ck("…i preset naprawdę żadnego z nich nie niesie",
   SKIP.every((k) => !(k in D.preset)), SKIP.filter((k) => k in D.preset).join(","));
for (const k of SKIP) {
  const other = Object.assign({}, D.preset);
  const v = D.cfg[k];
  other[k] = (typeof v === "boolean") ? !v : (typeof v === "number") ? v + 7 : "INNE";
  ck("zostaje przy kapslu, więc poza odciskiem: " + k, cur === fp(other));
}

// 3. LISTA PÓL MAPOWANIA == to, co zwraca silnik (minus `id`). Bez tego nowe pole mapowania
//    wchodzi do presetu i wypada z odcisku — czyli znika po cichu przy „Zapisz zmiany".
const want = (D.mapKeys || []).filter((k) => k !== "id").sort();
const have = FIELDS.slice().sort();
ck("panel liczy DOKŁADNIE pola mapowania z silnika (minus id)",
   JSON.stringify(want) === JSON.stringify(have),
   "brakuje: [" + want.filter((k) => have.indexOf(k) < 0) + "] nadmiar: ["
   + have.filter((k) => want.indexOf(k) < 0) + "]");
ck("…i `id` NIE jest jednym z nich", FIELDS.indexOf("id") < 0);

// 4. `id` poza odciskiem, bo silnik NADAJE go mapowaniu, które go nie ma — a listę presetów
//    sanityzuje przy każdym pobraniu, więc inne id przy każdym odczycie znaczyłoby „zmienione"
//    na wieki.
ck("inne id mapowania to nie zmiana", cur === fp(withMap({id: "m999999"})));

// 5. …a realna zmiana zestawu musi być widoczna od razu.
ck("inny numer CC = zmienione", cur !== fp(withMap({cc: 42})));
ck("inny adres OSC = zmienione", cur !== fp(withMap({addr: "/gdzie/indziej"})));
ck("inny próg = zmienione", cur !== fp(withMap({threshold: 61.5})));
ck("inny profil odbiornika = zmienione", cur !== fp(withMap({oscProfile: "unit"})));
ck("wyłączone mapowanie = zmienione", cur !== fp(withMap({enabled: false})));
ck("inny kształt krzywej = zmienione", cur !== fp(withMap({curveBez: [0.1, 0.2, 0.3, 0.4]})));
ck("martwe pole, które preset NIESIE, też się liczy", cur !== fp(withMap({oscGroup: "inna"})));
ck("inna skala = zmienione", cur !== fp(Object.assign({}, D.preset, {scale: "dorian"})),
   D.preset.scale);
ck("inny dźwięk podstawowy = zmienione", cur !== fp(Object.assign({}, D.preset, {scaleRoot: 7})));
// Usunięcie/dodanie mapowania i przestawienie kolejności — kolejność widać w panelu, więc jest treścią.
const shorter = JSON.parse(JSON.stringify(D.preset)); shorter.mappings.pop();
ck("mniej mapowań = zmienione", cur !== fp(shorter));
const swapped = JSON.parse(JSON.stringify(D.preset));
swapped.mappings.reverse();
ck("przestawiona kolejność = zmienione", cur !== fp(swapped), swapped.mappings.length);
// `null` (brak bariery) to co innego niż 0 — to są dwie różne konfiguracje.
ck("brak bariery to co innego niz bariera na zerze",
   fp(withMap({hardLo: null})) !== fp(withMap({hardLo: 0})));

// 6. Liczba wpisana w pole formularza jest TEKSTEM, a ta sama liczba z serwera przychodzi liczbą.
//    Bez wspólnej drogi kapsel byłby „zmieniony" po samym dotknięciu suwaka i powrocie na miejsce.
ck("„61.5” z pola == 61.5 z serwera",
   fp(withMap({threshold: "61.5"})) === fp(withMap({threshold: 61.5})));
ck("5000.000000000001 == 5000",
   fp(withMap({threshold: 5000})) === fp(withMap({threshold: 5000.000000000001})));

// 7. Kopia na inny kapsel niesie zestaw i NIC z tego, co zostaje przy kapslu-celu.
const body = G("_midiCfgBehaviour")();
ck("kopia na inny kapsel nie niesie nic z granicy",
   SKIP.every((k) => !(k in body)), SKIP.filter((k) => k in body).join(","));
ck("…ale niesie mapowania i skalę",
   body.mappings.length === D.cfg.mappings.length && body.scale === D.cfg.scale
   && body.scaleRoot === D.cfg.scaleRoot, JSON.stringify(Object.keys(body)));

// 8. Zdanie, którym okna opisują zestaw, mówi coś o TYM konkretnym (a nie zawsze to samo) i po
//    polsku — „5 mapowanie" w oknie pytającym o zgodę na zastąpienie czyjejś pracy czyta się
//    jak usterka.
const what = A.describeCurrent();
ck("opis mówi, ile mapowań i jak dzielą się na wyjścia", /MIDI/.test(what) && /OSC/.test(what), what);
ck("…z polską odmianą", / mapowania| mapowań| mapowanie/.test(what), what);
ck("…a opis presetu czyta z presetu, nie z kapsla",
   A.describePreset({config: {mappings: []}}) === "brak mapowań",
   A.describePreset({config: {mappings: []}}));

// 9. Kolejność przycisków edytora inline (rf-16): Anuluj PRZED akcją główną, Test wyjścia na końcu —
//    ta sama kolejność co rfModal/rfConfirm. Sprawdzane po źródle (harness nie ma DOM): kolejność
//    id w bloku .mie-actions musi być mieCancel, mieSave, mieClone, mieTest.
//    „Skopiuj jako mapowanie OSC/MIDI" (mieClone) stoi PRZY zapisie, bo tworzy mapowanie — próba
//    na sucho zostaje ostatnia. Przycisk pojawia się tylko przy ISTNIEJĄCYM mapowaniu, więc w DOM
//    nowego bywa go brak (ux_walk sprawdza obie postacie); tu czytamy źródło, gdzie jest zawsze.
const rf16 = fs.readFileSync(path.join(REPO, "web/js/rf-16-midi.js"), "utf8");
const mieBlock = /class="mie-actions">([\s\S]*?)<span class="mie-preview"/.exec(rf16);
const mieIds = mieBlock ? [...mieBlock[1].matchAll(/<button[^>]*\bid="(mie\w+)"/g)].map((m) => m[1]) : [];
ck("edytor MIDI/OSC: Anuluj przed akcją główną, Test wyjścia na końcu",
   mieIds.join(",") === "mieCancel,mieSave,mieClone,mieTest", mieIds.join(","));

// 10. ROZDZIAŁ PROTOKOŁÓW W EDYTORZE. Protokół wybiera ZAKŁADKA, nie rozwijak „Cel": w MIDI zostaje
//     wybór rodzaju komunikatu, w OSC nie ma czego wybierać. Bez tych asercji „OSC" wróciłoby do
//     listy celów przy pierwszej okazji — kiedyś już tam było i przenosiło edytowane mapowanie na
//     sąsiedni ekran, czego rozwijak nie ma jak zapowiedzieć.
const destsSrc = /const MI_DESTS_MIDI=\[([\s\S]*?)\];/.exec(rf16);
ck("lista celów MIDI istnieje i nie zna OSC",
   !!destsSrc && !/"osc"/.test(destsSrc[1]) && !/\bMI_DESTS\b(?!_MIDI)/.test(rf16),
   destsSrc ? destsSrc[1].replace(/\s+/g, " ").trim() : "brak MI_DESTS_MIDI");
ck("rozwijak celu karmi się wyłącznie listą MIDI",
   /id="mieDest">\$\{MI_DESTS_MIDI\.map/.test(rf16));
ck("handler celu nie przyjmuje już wartości osc",
   /m\.dest=\["cc","cc14","pitchbend","aftertouch","program","note"\]\.indexOf/.test(rf16));
ck("edytor OSC pokazuje cel jako stałą etykietę, bez rozwijaka",
   /id="mieDestOsc"/.test(rf16) && (rf16.match(/id="mieDest"/g) || []).length === 1);
// Kopia niesie POŁOWĘ WEJŚCIOWĄ i tylko ją — numer CC nie znaczy nic dla OSC, adres nic dla MIDI.
const keepSrc = /const MI_CLONE_KEEP=\[([\s\S]*?)\];/.exec(rf16);
const keep = keepSrc ? [...keepSrc[1].matchAll(/"(\w+)"/g)].map((m) => m[1]) : [];
const OUT_ONLY = ["cc", "outLo", "outHi", "prog", "midiCh", "note", "loNote", "hiNote", "velocity",
                  "velSource", "noteLatch", "addr", "oscTarget", "oscType", "oscProfile",
                  "outLoF", "outHiF", "oscEdge", "pulseMs", "safeOnDisarm", "id", "name", "dest"];
ck("kopia na drugi protokół bierze tylko pola wejścia",
   keep.length > 0 && OUT_ONLY.every((k) => !keep.includes(k)),
   keep.join(","));
ck("…i przycisk kopii stoi tylko przy istniejącym mapowaniu",
   /\$\{state\._midiEditIsNew\?"":`<button class="btn" id="mieClone"/.test(rf16));
console.log(JSON.stringify({checks}));
