// OKNO WYMIANY: ZDANIE „NAJPIERW ZAPISZ PRESET" MUSI PAŚĆ TAM, GDZIE STOI CZŁOWIEK.
//
// Zgłoszenie (13.09): „w presecie — przycisk wymiana nic nie aktywuje". Zmierzone na
// żywej 8770: przycisk „Wymiana" w stopce listy presetów otwierał okno poprawnie, ale pierwszy
// wiersz („Podziel się tym: …") w module BEZ zapisanego presetu zamykał okno i pisał wyjaśnienie
// przez `flashTrigMsg`, czyli do `#trigMsg`. Ten element stoi w panelu „Konfiguracja" Mapowania,
// a przycisk, który go wywołał — w panelu „Biblioteka", i to w KAŻDYM module. Nieaktywny panel ma
// `display:none`, więc zdanie lądowało w niewidocznym polu: okno znikało i nie działo się NIC.
//
// Dlaczego to nie było widać: gałąź komunikatu znała trzy rodzaje (`trig`, `axis`, `pack`), a od
// 31.08 rodzaje dokłada REJESTR (rf-49-kinds) — mysz, skaner, MIDI/OSC, usługi, koło, syntezator
// wpadały do gałęzi `trig` i pisały w ciemno. Sześć modułów na dziewięć.
//
// Ten harness sprawdza WYNIK, nie kształt kodu: dla każdego rodzaju z `PDC_KINDS`, przy pustej
// bibliotece, ktoś MUSI usłyszeć zdanie — i to ktoś widoczny. Rodzaje bierze z prawdziwego
// rejestru, więc rodzaj dopisany jutro jest sprawdzony razem z resztą.
//
// Bez przeglądarki i bez serwera: rf-49-kinds i rf-39l to samowystarczalne pliki, więc jadą w `vm`
// z najmniejszym DOM-em, jakiego ta ścieżka naprawdę dotyka (samo `getElementById`).
//
// Wywoływane z tests/test_share_hub_message.py; na wyjściu JSON {checks:[[nazwa, ok, szczegół], …]}.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const checks = [];
const ck = (name, ok, detail) => checks.push([name, !!ok, detail === undefined ? "" : String(detail)]);

// ---------------------------------------------------------------------------
//  NAJMNIEJSZY DOM + GŁOŚNIKI, KTÓRE LICZYMY
// ---------------------------------------------------------------------------
// `offsetParent === null` jest tu DOKŁADNIE tym, co znaczy w przeglądarce: element w panelu
// z `display:none`. Na tym stoi cała poprawka, więc fałszywka musi umieć oba stany.
const NODES = Object.create(null);
const mkNode = (id, visible) => (NODES[id] = {
  id, offsetParent: visible ? {} : null, textContent: "", className: "",
  classList: { add() {}, remove() {}, contains: () => false },
  focus() { this._focused = true; }, _focused: false,
});

const said = { flash: [], skull: [], toast: [] };
const resetSaid = () => { said.flash = []; said.skull = []; said.toast = []; };

const ctx = {
  console,
  state: { devices: {}, rules: [], trigPresets: [], activeDeviceId: "d0" },
  RF_FORUM_URL: "https://example.invalid/forum",
  RF_INVITE_SHARE: "https://example.invalid/invite",
  RF_SHOWCASE_URL: "https://example.invalid/showcase",
  RF_SHOWCASE_NAME: "#pochwal-sie",
  _gl: (pl /* , en */) => pl,
  flashTrigMsg: (t) => said.flash.push(String(t)),
  rfSkullSay: (t) => said.skull.push(String(t)),
  rfToast: (t) => said.toast.push(String(t)),
  document: {
    getElementById: (id) => NODES[id] || null,
    createElement: () => ({
      className: "", textContent: "", style: {}, children: [],
      setAttribute() {}, appendChild() {}, addEventListener() {}, querySelectorAll: () => [],
    }),
    addEventListener() {}, body: { appendChild() {} },
  },
};
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);

const run = (rel) => vm.runInContext(fs.readFileSync(path.join(REPO, rel), "utf8"), ctx, { filename: rel });
let bootErr = "";
try {
  run("web/js/rf-49-kinds.js");
  run("web/js/rf-39l-share-hub.js");
} catch (e) { bootErr = String((e && e.stack) || e); }
ck("okno wymiany wstaje z prawdziwym rejestrem rodzajów", !bootErr, bootErr.slice(0, 400));
if (bootErr) { console.log(JSON.stringify({ checks })); process.exit(0); }

// Adapter modułu podstawiamy dopiero TERAZ: rejestr sięga po prawdziwe przestrzenie nazw modułów,
// których w `vm` nie ma, a nas interesuje jedno — „biblioteka jest pusta".
ctx.rfKindAdapter = () => ({ listPresets: () => [], getCfgName: () => "", findPreset: () => null });

const kinds = vm.runInContext("Object.keys(PDC_KINDS)", ctx);
const fromRegistry = vm.runInContext(
  "Object.keys(RF_KINDS).filter(id => RF_KINDS[id].share && RF_KINDS[id].shareId)" +
  ".map(id => RF_KINDS[id].shareId)", ctx);

ck("rejestr dokłada swoje rodzaje do okna wymiany",
   fromRegistry.every(id => kinds.indexOf(id) >= 0),
   "rejestr: " + fromRegistry.join(",") + " · okno: " + kinds.join(","));
// Gdyby okno znało tylko pięć rodzajów pisanych ręcznie, poniższa pętla sprawdziłaby pięć z
// jedenastu i przegapiła dokładnie te, na których błąd wyszedł.
ck("…więc sprawdzamy więcej rodzajów niż pięć pisanych ręcznie", kinds.length >= 10,
   "rodzajów: " + kinds.length);

// „Zestaw" nie ma pustej biblioteki — JEST bieżącą konfiguracją, więc ta gałąź go nie dotyczy.
const EMPTYABLE = kinds.filter(k => k !== "setup");

// ---------------------------------------------------------------------------
//  1. PANEL, W KTÓRYM `#trigMsg` JEST NIEWIDOCZNY (lista presetów w dowolnym module)
// ---------------------------------------------------------------------------
mkNode("trigMsg", false);
const mute = [];
for (const k of EMPTYABLE) {
  resetSaid();
  let threw = "";
  try { vm.runInContext("_pdcShare(" + JSON.stringify(k) + ", {})", ctx); }
  catch (e) { threw = String((e && e.message) || e); }
  const heard = said.skull.length + said.toast.length;
  if (threw || !heard || said.flash.length) mute.push(k + (threw ? (" (wyjątek: " + threw + ")") : ""));
}
ck("przy ukrytym #trigMsg KAŻDY rodzaj mówi tam, gdzie widać", !mute.length,
   mute.length ? ("milczą: " + mute.join(", ")) : "");

// Osobno, bo to jest TEN błąd: zdanie nie może iść do pola, którego nie widać.
resetSaid();
vm.runInContext('_pdcShare("mouse", {})', ctx);
ck("preset myszy nie pisze już do niewidocznego pola Mapowania",
   said.flash.length === 0 && said.skull.length === 1, JSON.stringify(said));
ck("…i mówi zdanie, które wskazuje przycisk stojący obok",
   /Zapisz obecne jako/.test(said.skull[0] || ""), said.skull[0] || "");

// ---------------------------------------------------------------------------
//  2. PANEL, W KTÓRYM `#trigMsg` WIDAĆ (hub Mapowania) — zdanie zostaje NA MIEJSCU
// ---------------------------------------------------------------------------
// Komunikat pod listą reguł jest lepszy od wyskakującej dymki, kiedy człowiek na niego patrzy.
// Poprawka nie ma prawa tego zabrać — inaczej naprawiłaby jedno miejsce, psując drugie.
mkNode("trigMsg", true);
resetSaid();
vm.runInContext('_pdcShare("trig", {})', ctx);
ck("przy widocznym #trigMsg zdanie zostaje pod listą reguł",
   said.flash.length === 1 && said.skull.length === 0 && said.toast.length === 0,
   JSON.stringify(said));

// ---------------------------------------------------------------------------
//  3. GAŁĄŹ NIE MOŻE ZNÓW ROZPOZNAWAĆ RODZAJÓW PO NAZWIE
// ---------------------------------------------------------------------------
// To właśnie `kind === "pack"` obok `flashTrigMsg` było kształtem błędu: lista nazw, która nie
// rosła razem z rejestrem. Jeden głośnik, wybierany po tym, co widać.
const src = fs.readFileSync(path.join(REPO, "web/js/rf-39l-share-hub.js"), "utf8");
const body = src.slice(src.indexOf("function _pdcShare("), src.indexOf("function _pdcItem("));
ck("wybór głośnika nie zależy już od nazwy rodzaju",
   !/kind\s*===\s*"pack"[^\n]*rfToast/.test(body) && /_pdcSay\(/.test(body));
ck("…a sam głośnik pyta DOM, czy pole komunikatu widać",
   /function _pdcSay/.test(src) && /getElementById\("trigMsg"\)/.test(src) && /offsetParent/.test(src));

console.log(JSON.stringify({ checks }));
