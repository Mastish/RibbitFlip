// GRANICA UKŁADU OKIEN, SPRAWDZONA PO STRONIE PANELU.
//
// Serwer pilnuje swojej połowy (test_overlay_layouts.py), ale „zmienione" liczy PRZEGLĄDARKA — i to
// tam jest najkruchsze założenie całej tej funkcji: odcisk musi liczyć DOKŁADNIE te pola, które
// układ niesie. Jedno pole za dużo (a `open` jest tu kandydatem numer jeden, bo zmienia się przy
// każdym przełączniku) i ekran jest „zmieniony" od chwili wczytania, czyli ostrzeżenie świeci
// zawsze i po tygodniu nikt go nie czyta.
//
// Bez przeglądarki i bez serwera: moduł panelu (rf-49f) jest samowystarczalnym plikiem, więc
// wystarczy go uruchomić w `vm` z podstawionymi globalami, których dotyka.
//
// Wywoływane z tests/test_overlay_layouts.py: argv[2] = {cur, layout, defaults} (obie strony prosto
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

const clone = (o) => JSON.parse(JSON.stringify(o));
// „Co stoi na ekranie" w kształcie, w jakim przysyła to serwer: {wid: {config}}.
const asState = (wins) => {
  const out = {};
  for (const wid of Object.keys(wins)) out[wid] = { win: wid, dev: wid.split("~")[0], config: wins[wid] };
  return out;
};

// Globale, których dotyka rf-49f. Wszystkie martwe: ten harness liczy odciski, niczego nie wysyła.
const ctx = {
  I18N_EN: {}, console,
  state: { devices: { d0: { meta: { dev: "d0", name: "Triki 1" } } } },
  OVL: { state: { windows: asState(clone(D.cur || {})), defaults: D.defaults || null, layoutName: "Stream" } },
  _gl: (pl) => pl, rfToast: () => {}, rfCfgIdCreate: () => ({}),
  ovlPost: () => Promise.resolve(null), ovlPanelSync: null,
  fetch: () => Promise.resolve({ json: () => ({}) }),
  document: { getElementById: () => null, querySelector: () => null },
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(REPO, "web/js/rf-49f-overlay-layouts.js"), "utf8"), ctx);
// `const`/`let` z modułu nie ląduje na obiekcie kontekstu — trzeba je odczytać wyrażeniem.
const G = (n) => vm.runInContext(n, ctx);
const A = G("OVL_LAYOUT_ADAPTER");
const fp = ctx.overlayLayoutFingerprint;
const cur = clone(D.cur || {});
const lay = clone(D.layout || {});

// 1. Ekran zaraz po zapisaniu swojego układu NIE MOŻE być „zmieniony". To jest cała funkcja.
ck("odcisk ekranu == odcisk jego własnego układu", fp(cur) === fp(lay.windows),
   fp(cur) + "  vs  " + fp(lay.windows));
ck("…i tak samo widzi to adapter (obie strony przez komponent)",
   A.fingerprintCurrent() === A.fingerprintPreset(lay));

// 2. Ta sama treść w innej kolejności kluczy to ten sam układ: kolejność w słowniku jest
//    przypadkiem historii (kto kiedy dodał okno), a nie treścią.
const rev = {};
for (const wid of Object.keys(lay.windows).reverse()) rev[wid] = lay.windows[wid];
ck("kolejność okien w słowniku nie zmienia odcisku", fp(rev) === fp(lay.windows));

// 3. `open` NIE WCHODZI DO ODCISKU. Układ mówi, jak okna wyglądają i gdzie stoją, a nie czy są
//    na ekranie — inaczej każde włączenie nakładki zapalałoby „zmienione".
const wid0 = Object.keys(lay.windows)[0];
const opened = clone(lay.windows);
opened[wid0].open = !opened[wid0].open;
ck("otwarcie/zamknięcie okna nie jest zmianą układu", fp(opened) === fp(lay.windows));

// 4. …a realna zmiana rozstawienia musi być widoczna od razu.
// Wartości są liczone WZGLĘDEM tego, co układ ma teraz — wpisana na sztywno „dark" trafiłaby
// w układ, który już jest ciemny, i test przeszedłby na porównaniu czegoś z samym sobą.
const w0 = lay.windows[Object.keys(lay.windows)[0]];
for (const [nm, patch] of [["inne miejsce", { x: (+w0.x || 0) + 999 }],
                           ["inny motyw", { theme: w0.theme === "dark" ? "felt" : "dark" }],
                           ["inna nazwa okna", { label: (w0.label || "") + " 2" }],
                           ["inny rozmiar", { w: (+w0.w || 0) + 321 }],
                           ["inna przezroczystość", { opacity: w0.opacity === 44 ? 45 : 44 }],
                           ["przepuszcza kliknięcia", { clickThrough: !w0.clickThrough }],
                           // Pasek okna (2026-09-03). Należy do układu z tego samego powodu, co
                           // wiersz wyżej: „Stream" to okna oddane widzom, bez uchwytu i ⚙,
                           // a „Trening" to okna, którymi się w trakcie rusza ręką.
                           ["pasek okna", { winBar: w0.winBar === false }]]) {
  const o = clone(lay.windows);
  Object.assign(o[wid0], patch);
  ck(nm + " = zmienione", fp(o) !== fp(lay.windows), JSON.stringify(patch));
}
{
  const o = clone(lay.windows);
  o[wid0].show = Object.assign({}, o[wid0].show, { pad: !o[wid0].show.pad });
  ck("inna zawartość okna = zmienione", fp(o) !== fp(lay.windows));
  const p = clone(lay.windows);
  p[wid0].scaleParts = Object.assign({}, p[wid0].scaleParts, { pose: 175 });
  ck("inna skala części = zmienione", fp(p) !== fp(lay.windows));
}

// 5. „Jeszcze nigdzie nie postawione" (null) to NIE jest lewy górny róg ekranu (0).
ck("x=null i x=0 to dwie różne odpowiedzi",
   fp({ d0: { x: null } }) !== fp({ d0: { x: 0 } }));

// 6. OKNO KOŁA JEST NIEWIDOCZNE DLA ODCISKU. Serwer i tak go nie przysyła, ale panel liczy z tego,
//    co przyszło — a okno chodzące za kursorem przesuwa się przy każdym otwarciu koła, więc
//    wpuszczone do odcisku robiłoby „zmienione" po każdym naciśnięciu przycisku.
{
  const withWheel = asState(clone(cur));
  withWheel["d0~kolo"] = { win: "d0~kolo", dev: "d0",
                           config: { x: 12, y: 34, theme: "bare", followCursor: true } };
  const before = A.fingerprintCurrent();
  ctx.OVL.state.windows = withWheel;
  ck("okno koła przy kursorze nie liczy się do odcisku", A.fingerprintCurrent() === before);
  ctx.OVL.state.windows = asState(clone(cur));
}

// 7. Nie wiemy, co stoi na ekranie -> pasek MILCZY. `null` z obu odcisków, a nie zgadywanie.
{
  const keep = ctx.OVL.state;
  ctx.OVL.state = null;
  ck("bez stanu nakładek odcisk mówi „nie wiem”, a nie „zmienione”",
     A.fingerprintCurrent() === null && A.fingerprintPreset(lay) === null);
  ctx.OVL.state = keep;
}

// 8. Nazwa układu czytana jest ze stanu nakładek (jedno źródło z przyciskami obok).
ck("nazwa układu pochodzi ze stanu nakładek", A.getCfgName() === "Stream", A.getCfgName());
ck("„Skopiuj na…” nie istnieje — ekran jest jeden",
   typeof A.copyTo !== "function" && A.listOtherDevs().length === 0);

// 9. Zdanie w oknie z pytaniem liczy RÓŻNICĘ, a nie zawsze to samo: bez tego „wczytaj układ” jest
//    skokiem w ciemno, a to jedyne działanie, które potrafi USUNĄĆ okno razem z jego ustawieniami.
{
  const want = clone(lay);
  delete want.windows[Object.keys(want.windows)[0]];        // jedno okno mniej => jedno do usunięcia
  const txt = A.describePreset(want);
  ck("opis mówi, ile okien zniknie", /do usunięcia/.test(txt), txt);
  const more = clone(lay);
  more.windows["d0~7"] = clone(more.windows[wid0]);
  ck("…i ile powstanie", /do utworzenia/.test(A.describePreset(more)), A.describePreset(more));
  const moved = clone(lay);
  moved.windows[wid0].x = 1234;
  ck("…i ile się przestawi", /do przestawienia/.test(A.describePreset(moved)), A.describePreset(moved));
  const away = clone(lay);
  away.windows["d9~2"] = clone(away.windows[wid0]);
  ck("…i o kapslu, którego teraz nie ma", /pominięte/.test(A.describePreset(away)),
     A.describePreset(away));
}
ck("opis tego, co zostaje, mówi wprost, że nic się nie otworzy",
   /nie otworzą się same/.test(A.describeKeeps()), A.describeKeeps());

console.log(JSON.stringify({checks}));
