"use strict";
// ===================== MAPPING EDITOR — ready-made gestures =====================
// DATA ONLY: the six entries behind "Wybierz z domyślnych…" at the top of the rule editor.
// No logic lives here; rf-12 reads this table, lays the fields over the draft rule and never
// writes back to it.
//
// What a preset IS: the WHEN of a rule (source · comparison · threshold · behaviour and its own
// timing). What it deliberately is NOT: the WHAT. keySpec and sequence are never touched, because
// the action is the one thing only the person at the keyboard can know — a preset that guessed it
// would quietly overwrite a key somebody had just picked.
//
// Entry shape:
//   key    — stable id, used as the <option> value (never shown)
//   label  — Polish name; also lands in the rule's own "Etykieta" field when that is still empty
//   desc   — one Polish sentence, shown under the select as a hint
//   rule   — the fields to lay over the draft: source (copied, never shared), abs, cmp,
//            threshold, thresholdHi and behavior + whatever that behaviour needs
//            (dwellMs · crossings · windowMs)
//
// THRESHOLDS AND THE SENSOR'S CEILING. The gyroscope is ±250 °/s (131 LSB per °/s, int16), so a
// turn threshold above ~220 is a gesture no hand can perform — the rule would simply never fire,
// and nothing on screen would say why. Every number below is chosen with that ceiling in mind:
//   · twist ±200 °/s — a brisk, deliberate flick, still 20% short of the ceiling
//   · spin 12000 LSB ≈ 92 °/s — the same number the capsule-identification shake uses (rf-11b),
//     which is well above a nudge or a capsule breathing on the table
// Note that `spin` is raw calibrated LSB and is NOT scaled by the axis gain: a shake means the
// same thing however sensitive somebody made their tilt.
//
// DIRECTION OF THE TURN. With the default calibration positive twist is counter-clockwise seen
// from above, i.e. a turn to the LEFT — the shipped "Media - pokrętło głośności" setup reads the
// same way (turning right lives on negative twist there). So the labels below sit on the signs
// that match the hardware, not the other way round.
//
// This file must load BEFORE the module that consumes it: GESTURE_PRESETS is a top-level `const`,
// shared through the global lexical environment rather than window.
const GESTURE_PRESETS=[
  {
    key:"shake",
    label:"Potrząśnięcie",
    desc:"Strzela raz przy energicznym potrząśnięciu kapslem.",
    rule:{source:{kind:"filter",metric:"spin"},abs:false,cmp:">",threshold:12000,
          thresholdHi:null,behavior:"once"},
  },
  {
    key:"upsidedown",
    label:"Odwrócenie do góry dnem",
    desc:"Działa, gdy kapsel jest odwrócony dnem do góry przez chwilę.",
    rule:{source:{kind:"filter",metric:"tilt"},abs:false,cmp:">",threshold:155,
          thresholdHi:null,behavior:"dwell",dwellMs:400},
  },
  {
    key:"turn-right",
    label:"Szybki obrót w prawo",
    desc:"Strzela raz przy szybkim obrocie kapsla w prawo.",
    rule:{source:{kind:"filter",metric:"twist"},abs:false,cmp:"<",threshold:-200,
          thresholdHi:null,behavior:"once"},
  },
  {
    key:"turn-left",
    label:"Szybki obrót w lewo",
    desc:"Strzela raz przy szybkim obrocie kapsla w lewo.",
    rule:{source:{kind:"filter",metric:"twist"},abs:false,cmp:">",threshold:200,
          thresholdHi:null,behavior:"once"},
  },
  {
    key:"double-click",
    label:"Podwójne kliknięcie przycisku",
    desc:"Dwa kliknięcia przycisku kapsla w niecałą sekundę.",
    // holdMs 150, nie domyślne 250: warunek zostaje spełniony przez tyle czasu po kliknięciu, więc
    // przy 250 ms dwa szybkie kliknięcia zlewają się w jedno przekroczenie i reguła nigdy nie liczy
    // drugiego. 150 ms rozdziela kliknięcia oddalone o 0,15–0,6 s, czyli tak, jak klika człowiek.
    rule:{source:{kind:"button",any:true,holdMs:150},abs:false,cmp:">",threshold:0,
          thresholdHi:null,behavior:"multi",crossings:2,windowMs:600},
  },
  {
    key:"long-press",
    label:"Długie przytrzymanie przycisku",
    desc:"Działa dopiero po przytrzymaniu przycisku kapsla przez 0,6 s.",
    // „Po odczekaniu" (dwell), NIE „Jednorazowo": jednorazowa reguła odpala w chwili naciśnięcia,
    // więc krótkie kliknięcie byłoby nie do odróżnienia od przytrzymania. holdMs zostaje domyślne —
    // to ono decyduje, jak długo po kliknięciu przycisk jeszcze „liczy się" jako wciśnięty, a
    // wydłużone do 0,6 s sprawiłoby, że samo kliknięcie wypełniłoby czas odczekania.
    rule:{source:{kind:"button",any:true,holdMs:250},abs:false,cmp:">",threshold:0,
          thresholdHi:null,behavior:"dwell",dwellMs:600},
  },
];

// ===================== MAPPING START — the six tiles of an empty Mapping =====================
// „Co ma zrobić kapsel?" (UX 261120, P-G1-01). DATA ONLY, like the list above: rf-10 draws the
// tiles from it, rf-12 (`trigTileNew`) lays `rule` over a new draft and opens the editor. A
// separate list on purpose: GESTURE_PRESETS also feeds the Scanner's signal dropdown, and a lean
// that HOLDS a key is not a signal.
//
// SIGNS. Left `roll < -25`, right `roll > 25`, forward `pitch < -25`, back `pitch > 25`: the same
// convention as the shipped setup „Media - cztery strony" and the Scanner's lean signals. Grip and
// the Sensor's axis flip can still turn this round for one person, which is why a direction tile
// opens the editor on a live „lean now" step with „U mnie to druga strona" (F-G1-07).
//
// „Kliknięcie przycisku" is `once`, not `taps`: a counted tap waits out its window before it fires,
// and 0,35 s of delay on a jump key is the first thing a player notices.
//
// Entry: key (stable id), label/desc (Polish, shown and translated through I18N_EN), en (the
// English label, written into the new rule's name when the panel is in English), dir (direction words for the live step:
// [toward, away] in PL and EN; null = no step), ico (a key of TRIG_TILE_ICON), rule (as above).
const TRIG_TILES=[
  {key:"lean-left",label:"Pochyl w lewo",desc:"Trzyma klawisz, dopóki kapsel jest pochylony w lewo.",
    en:"Lean left",
    dir:{pl:["w lewo","w prawo"],en:["left","right"]},ico:"left",
    rule:{source:{kind:"filter",metric:"roll"},abs:false,cmp:"<",threshold:-25,thresholdHi:null,behavior:"hold"}},
  {key:"lean-right",label:"Pochyl w prawo",desc:"Trzyma klawisz, dopóki kapsel jest pochylony w prawo.",
    en:"Lean right",
    dir:{pl:["w prawo","w lewo"],en:["right","left"]},ico:"right",
    rule:{source:{kind:"filter",metric:"roll"},abs:false,cmp:">",threshold:25,thresholdHi:null,behavior:"hold"}},
  {key:"lean-fwd",label:"Pochyl do przodu",desc:"Trzyma klawisz, dopóki kapsel jest pochylony do przodu.",
    en:"Lean forward",
    dir:{pl:["do przodu","do tyłu"],en:["forward","back"]},ico:"fwd",
    rule:{source:{kind:"filter",metric:"pitch"},abs:false,cmp:"<",threshold:-25,thresholdHi:null,behavior:"hold"}},
  {key:"lean-back",label:"Pochyl do tyłu",desc:"Trzyma klawisz, dopóki kapsel jest pochylony do tyłu.",
    en:"Lean back",
    dir:{pl:["do tyłu","do przodu"],en:["back","forward"]},ico:"back",
    rule:{source:{kind:"filter",metric:"pitch"},abs:false,cmp:">",threshold:25,thresholdHi:null,behavior:"hold"}},
  {key:"turn-any",label:"Obróć kapsel",desc:"Naciska klawisz przy szybkim obrocie.",
    en:"Turn the capsule",
    dir:null,ico:"turn",
    rule:{source:{kind:"filter",metric:"twist"},abs:true,cmp:">",threshold:200,thresholdHi:null,behavior:"once"}},
  {key:"click-once",label:"Kliknięcie przycisku",desc:"Jedno kliknięcie przycisku kapsla naciska klawisz raz.",
    en:"Button click",
    dir:null,ico:"click",
    rule:{source:{kind:"button",any:true,holdMs:250},abs:false,cmp:">",threshold:0,thresholdHi:null,behavior:"once"}},
];
// THE ONE PLACE TO SWAP TILE ICONS (D14). There are no felt direction arrows yet, so the four
// leans borrow the fold chevron `rozwin.png` turned by `rot` (degrees, the chevron points right).
// When the drawn arrows land, point `src` at them and set `rot` to 0. `cap:true` = the picture
// of the capsule being edited (capImgSpan), because the click happens on that capsule.
const TRIG_TILE_ICON={
  left: {src:"/web/assets/icons/rozwin.png",rot:180},
  right:{src:"/web/assets/icons/rozwin.png",rot:0},
  fwd:  {src:"/web/assets/icons/rozwin.png",rot:-90},
  back: {src:"/web/assets/icons/rozwin.png",rot:90},
  turn: {src:"/web/assets/icons/odswiez.png",rot:0},
  click:{cap:true},
};
