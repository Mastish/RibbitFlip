"use strict";
// ============ PRZYCISK KAPSLA KLIKA MYSZĄ (gesty puknięć) ============================
// Czwarta część karty „Mysz". Jeden przycisk kapsla obsługuje cztery przyciski myszy:
//   puknij           → lewy
//   puknij dwa razy  → dwuklik
//   puknij trzy razy → środkowy
//   przytrzymaj      → prawy
//
// PO CO TO JEST: kapsel prowadzi kursor ruchem, ale samo dojechanie do celu jeszcze niczego nie
// otwiera. „Klik bez klikania" (rf-31c) rozwiązuje to bezruchem i jest odpowiedzią dla rąk, które
// przycisku nie naciskają wcale — a dla tych, które naciskają, jednego przycisku było za mało na
// cztery akcje. Stąd szybkie przypisanie kliknięć do konkretnych przycisków: klik, dwuklik,
// trzy szybkie, a prawy klik to przytrzymanie przez ustawiony czas.
//
// ⭐ TA SEKCJA NIE MA WŁASNEGO STANU. Włącznik pisze CZTERY ZWYKŁE REGUŁY do listy Mapowania i stąd
// je czyta. Nie ma więc drugiego magazynu, który mógłby się rozjechać z pierwszym; reguły widać
// tam, gdzie widać wszystkie inne, da się je poprawić (inny przycisk, inne czasy, dodatkowy
// warunek) i jadą w zestawie razem z resztą. Cena: sekcja pokazuje „zmienione przez Ciebie",
// gdy ktoś je przerobi, zamiast udawać, że nadal są fabryczne.
//
// ⚠️ DLACZEGO NOWE ZACHOWANIE `taps`, A NIE ISTNIEJĄCE `multi`: `multi` strzela w chwili, w której
// doliczy N, więc „1 puknięcie" wysyłałoby lewy przycisk przy PIERWSZYM naciśnięciu dwukliku.
// `taps` decyduje na końcu okna i tylko przy dokładnie N puknięciach — kosztem opóźnienia
// pojedynczego klika o długość okna. Ta sama umowa, co przy dwukliku myszy w każdym systemie.

const MBTN_IDS = ["mbtn-tap1", "mbtn-tap2", "mbtn-tap3", "mbtn-hold"];
const MBTN_WIN_DEF = 400, MBTN_HOLD_DEF = 600;
// Źródło: „dowolny przycisk kapsla" — ten sam kształt, którym posługuje się edytor reguł, gdy
// ktoś wybierze przycisk bez uczenia się konkretnego bitu.
const MBTN_SRC = { kind: "button", any: true, byte: 1, bit: 0, holdMs: 120 };

function _mbtnRules() {
  const by = {};
  for (const r of (state.rules || [])) if (MBTN_IDS.includes(r.id)) by[r.id] = r;
  return by;
}

// Czy zestaw stoi w komplecie i jest włączony. Cztery reguły to jedna funkcja — brak którejś
// znaczy „wyłączone", bo połowa gestów to nie jest ta funkcja, o którą prosił człowiek.
function mbtnOn() {
  const by = _mbtnRules();
  return MBTN_IDS.every(id => by[id] && by[id].enabled !== false);
}

function _mbtnTimes() {
  const by = _mbtnRules();
  return {
    win: Math.max(200, Math.min(1200, +(by["mbtn-tap1"] || {}).windowMs || MBTN_WIN_DEF)),
    hold: Math.max(250, Math.min(3000, +(by["mbtn-hold"] || {}).dwellMs || MBTN_HOLD_DEF)),
  };
}

// Czy ktoś przerobił zestaw po swojemu. Sprawdzamy TYLKO to, co ta sekcja obiecuje: akcje i to,
// że gesty stoją na przycisku. Zmieniony czas nie jest przeróbką — czasy są tutaj do ustawiania.
function _mbtnCustom() {
  const by = _mbtnRules();
  const want = { "mbtn-tap1": "mouse:left", "mbtn-tap2": "mouse:double",
                 "mbtn-tap3": "mouse:middle", "mbtn-hold": "mouse:right" };
  return MBTN_IDS.some(id => {
    const r = by[id];
    if (!r) return false;
    return String(r.keySpec || "") !== want[id] || (r.source || {}).kind !== "button";
  });
}

function _mbtnMake(win, hold) {
  const mk = (id, label, spec, extra) => Object.assign({
    id: id, label: label, enabled: true, source: Object.assign({}, MBTN_SRC),
    abs: false, cmp: ">", threshold: 0, thresholdHi: null, neg: false,
    extraConditions: [], match: "all", layer: 0, keySpec: spec, sequence: "",
    glow: true, windowMs: win, crossings: 1, dwellMs: hold, intervalMs: 100,
  }, extra || {});
  // Nazwy w języku panelu z chwili utworzenia (16.10): to zwykłe reguły w Mapowaniu, więc człowiek
  // z angielskim panelem dostawał listę po polsku. Reguły rozpoznajemy po `id`, nie po nazwie,
  // więc przełączenie języka później niczego nie psuje — nazwa jest już jego, jak każda inna.
  return [
    mk("mbtn-tap1", _gl("Puknięcie → lewy przycisk", "Tap → left button"), "mouse:left", { behavior: "taps", crossings: 1 }),
    mk("mbtn-tap2", _gl("Dwa puknięcia → dwuklik", "Two taps → double-click"), "mouse:double", { behavior: "taps", crossings: 2 }),
    mk("mbtn-tap3", _gl("Trzy puknięcia → środkowy", "Three taps → middle button"), "mouse:middle", { behavior: "taps", crossings: 3 }),
    mk("mbtn-hold", _gl("Przytrzymanie → prawy przycisk", "Hold → right button"), "mouse:right", { behavior: "dwell" }),
  ];
}

// Włączenie DOPISUJE brakujące i budzi wyłączone; wyłączenie tylko gasi. Kasowania nie ma celowo:
// ktoś, kto przerobił regułę pod siebie, straciłby swoją pracę przez jedno kliknięcie w checkbox,
// a wyłączona reguła mówi to samo („nic nie wysyła") i da się ją obejrzeć.
function mbtnApply(on, win, hold) {
  if (!Array.isArray(state.rules)) state.rules = [];
  const by = _mbtnRules();
  if (on) {
    const fresh = _mbtnMake(win, hold);
    for (const nw of fresh) {
      const old = by[nw.id];
      if (!old) { state.rules.push(nw); continue; }
      old.enabled = true;
      old.windowMs = win;
      if (old.behavior === "dwell") old.dwellMs = hold;
      // Zachowanie i akcję zostawiamy TAKIE, JAKIE SĄ: jeśli ktoś przestawił ten gest na inny
      // przycisk myszy, włącznik nie ma prawa mu tego cofnąć.
      if (!old.behavior) old.behavior = nw.behavior;
      if (!old.keySpec) old.keySpec = nw.keySpec;
    }
  } else {
    for (const id of MBTN_IDS) if (by[id]) by[id].enabled = false;
  }
  if (typeof commitRules === "function") commitRules();
  mbtnSync();
}

function mbtnSync() {
  const $ = id => document.getElementById(id);
  const on = mbtnOn(), t = _mbtnTimes();
  const sw = $("mBtnClicksOn"); if (sw && document.activeElement !== sw) sw.checked = on;
  const w = $("mBtnClicksWin"); if (w && document.activeElement !== w) w.value = t.win;
  const h = $("mBtnClicksHold"); if (h && document.activeElement !== h) h.value = t.hold;
  _mbtnLabels(t.win, t.hold);
  // Zdanie pod pudełkiem (rf-31e) mówi to, czego liczby same nie powiedzą: że pojedynczy klik
  // SPÓŹNIA SIĘ o okno. To nie usterka, tylko cena za dwuklik na tym samym przycisku. Gdy moduł
  // Mapowanie albo sterowanie jest wyłączone, zamiast tego stoi warunek z przyciskiem.
  if (typeof mMouseCondSync === "function") mMouseCondSync();
}
// Czasy w sekundach, choć reguły trzymają milisekundy: „0,40 s" czyta się od razu.
function _mbtnLabels(win, hold) {
  const $ = id => document.getElementById(id);
  const sec = (ms) => (_lang === "en" ? (ms / 1000).toFixed(2)
                                      : (ms / 1000).toFixed(2).replace(".", ",")) + " s";
  const wv = $("mBtnClicksWinv"); if (wv) wv.textContent = sec(win);
  const hv = $("mBtnClicksHoldv"); if (hv) hv.textContent = sec(hold);
}

function initMouseBtnClicks() {
  const $ = id => document.getElementById(id);
  {
    const e = $("mBtnClicksOn");
    if (e) e.onchange = () => { const t = _mbtnTimes(); mbtnApply(e.checked, t.win, t.hold); };
  }
  // Suwaki zapisują reguły na `change` (po puszczeniu), nie na `input`: każdy krok drogi suwaka
  // byłby osobnym zapisem czterech reguł. Podpis w sekundach nadąża na bieżąco.
  {
    const e = $("mBtnClicksWin");
    if (e) e.oninput = () => _mbtnLabels(+e.value, _mbtnTimes().hold);
    if (e) e.onchange = () => {
      const v = Math.max(200, Math.min(1200, Math.round(+e.value || MBTN_WIN_DEF)));
      e.value = v;
      if (mbtnOn()) mbtnApply(true, v, _mbtnTimes().hold); else mbtnSync();
    };
  }
  {
    const e = $("mBtnClicksHold");
    if (e) e.oninput = () => _mbtnLabels(_mbtnTimes().win, +e.value);
    if (e) e.onchange = () => {
      const v = Math.max(250, Math.min(3000, Math.round(+e.value || MBTN_HOLD_DEF)));
      e.value = v;
      if (mbtnOn()) mbtnApply(true, _mbtnTimes().win, v); else mbtnSync();
    };
  }
  mbtnSync();
}
