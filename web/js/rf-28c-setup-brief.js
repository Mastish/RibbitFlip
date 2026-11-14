"use strict";
// ==================================================================================================
//  CO TEN ZESTAW ROBI — opis autora, instrukcja użytkowania, role kapsli i sterowanie ruchem
//
//  Podgląd importu (rf-28 `rfSafetyModal`) wypisywał do 13.09 WYŁĄCZNIE reguły, czyli przyciski
//  i gesty: opis zestawu nie wypisywał wszystkiego i nie miał
//  instrukcji użytkowania.
//
//  I tak było. Zestaw pod grę na padzie składa się w większości NIE z reguł, tylko ze strojenia
//  ruchu — „Exo One (1 kapsel)" ma jedną regułę (nurkowanie) i cały lot w konfiguracji drążka.
//  Okno pokazywało więc jedną linijkę nad przyciskiem „Dalej" i milczało o tym:
//    • czym ten zestaw jest (pole `description` leżało w pliku i nie docierało do nikogo),
//    • jak go użyć (pola na to nie było wcale — patrz `howto` i `setup_about` w monitorze),
//    • co robi który kapsel (`role.name` / `role.note` widać było dopiero w oknie ról, PO decyzji),
//    • co zestaw robi z ruchem (`setup_motion_facts` — nie istniało).
//
//  Zasada dla całego pliku: serwer przysyła FAKTY, zdanie składa panel. Tak samo jak przy
//  `setup_requirements` i z tego samego powodu — panel jest dwujęzyczny, a plik zestawu nie.
//  Wyjątek świadomy: `description` i `howto` to słowa AUTORA i zostają w jego języku; tłumaczymy
//  nagłówki wokół nich, nigdy cudzy tekst.
//
// Ładowany po rf-28 (tylko dodaje funkcje, nic nie wywołuje) i czytany przez `rfSafetyModal`
//  oraz szufladę Biblioteki (rf-39i2) — jedno źródło zdań dla obu miejsc, żeby opis zestawu przed
//  wczytaniem i po zapisaniu go do Biblioteki nie rozjechał się na dwie różne wersje.
// ==================================================================================================

function _rfbEsc(s) {
  return (typeof miEsc === "function") ? miEsc(s) : String(s == null ? "" : s);
}
function _rfbT(pl, en) {
  return (typeof _gl === "function") ? _gl(pl, en) : pl;
}
// Liczba po polsku ma przecinek, a mnożnik czułości to zawsze dwie cyfry po przecinku („0,60×").
// W angielskim panelu zostaje kropka — to ta sama liczba, nie ten sam zapis.
function _rfbNum(v) {
  const n = Number(v);
  if (!isFinite(n)) return "";
  const s = n.toFixed(2);
  return (typeof _lang !== "undefined" && _lang === "en") ? s : s.replace(".", ",");
}

// ---------------------------------------------------------------------------------------------
//  STEROWANIE RUCHEM jednym zdaniem, z faktów `setup_motion_facts`.
//  Zwraca "" dla pliku bez sekcji ruchu — zestaw złożony z samych reguł jest normalny, a pusta
//  linijka pod rolą czytałaby się jak brakująca dana.
// ---------------------------------------------------------------------------------------------
function rfMotionText(m) {
  if (!m || typeof m !== "object") return "";
  const mode = String(m.mode || "");
  // KAPSEL, KTÓRY JEST TYLKO PRZYCISKIEM — sprawdzane PRZED trybem, bo od 13.09 zaparkować da się
  // też krzyżak (pole `padPark`; wcześniej istniała tylko sztuczka z czułością, a ta działała
  // wyłącznie na drążku). Zdanie mówi o SKUTKU, nie o sposobie: „wyzerowany liczbami" było prawdą
  // tylko dla starych paczek i po wejściu pola zaczęłoby kłamać przy połowie plików.
  if (m.parked)
    return _rfbT("Sam przycisk i gesty. Ruch tego kapsla stoi, przechył nic nie wysyła.",
                 "Button and gestures only — this capsule's motion is parked, tilting sends nothing.");
  if (mode === "stick") {
    if (m.target === "keys")
      return _rfbT("Przechył kapsla wciska klawisze kierunku (WSAD).",
                   "Tilting the capsule presses the direction keys (WSAD).");
    if (m.target === "touchpad")
      return _rfbT("Przechył kapsla prowadzi palec po gładziku pada.",
                   "Tilting the capsule moves a finger across the pad's touchpad.");
    const side = (m.which === "right")
      ? _rfbT("Przechył kapsla prowadzi PRAWY drążek pada", "Tilting the capsule drives the pad's RIGHT stick")
      : _rfbT("Przechył kapsla prowadzi LEWY drążek pada", "Tilting the capsule drives the pad's LEFT stick");
    const sx = Number(m.sensX), sy = Number(m.sensY);
    let cut = "";
    // Przycięta oś to najczęstsza rzecz, którą autor STROI świadomie (kamera: szybko na boki,
    // wolno w pionie) i najtrudniejsza do odgadnięcia z ręki — stąd osobne zdanie z liczbą.
    if (isFinite(sx) && isFinite(sy) && Math.abs(sx - sy) > 0.005) {
      cut = (sy < sx)
        ? _rfbT(", pion przycięty do " + _rfbNum(sy) + "×", ", vertical trimmed to " + _rfbNum(sy) + "×")
        : _rfbT(", poziom przycięty do " + _rfbNum(sx) + "×", ", horizontal trimmed to " + _rfbNum(sx) + "×");
    } else if (isFinite(sx) && Math.abs(sx - 1) > 0.005) {
      cut = _rfbT(", czułość " + _rfbNum(sx) + "×", ", sensitivity " + _rfbNum(sx) + "×");
    }
    return side + cut + ".";
  }
  if (mode === "dpad") {
    const dirs = m.diagonal ? _rfbT("osiem kierunków, z ukosami", "eight directions, diagonals included")
                            : _rfbT("cztery kierunki", "four directions");
    return (m.target === "pad")
      ? _rfbT("Przechył kapsla włącza krzyżak pada (" + dirs + ").",
              "Tilting the capsule works the pad's d-pad (" + dirs + ").")
      : _rfbT("Przechył kapsla wciska klawisze strzałek (" + dirs + ").",
              "Tilting the capsule presses the arrow keys (" + dirs + ").");
  }
  if (mode === "mouse")
    return _rfbT("Przechył kapsla prowadzi kursor myszy.", "Tilting the capsule moves the mouse cursor.");
  return "";
}

// „Ten sam pad, co poprzedni kapsel" — sens paczki dwukapslowej, którego nie widać w żadnej regule.
// `padShare` niesie SLOT AUTORA (np. „d0"), a po przypisaniu ról to już nie jest slot czytelnika —
// dlatego zdanie mówi o wspólnym padzie, nigdy o numerze.
function rfMotionShareText(m) {
  if (!m || !m.share || m.share === "own") return "";
  return _rfbT("Wspólny pad z pierwszym kapslem: gra widzi jednego gracza, nie dwa pady.",
               "Shares the pad with the first capsule — the game sees one player, not two pads.");
}

// ---------------------------------------------------------------------------------------------
//  ROLA KAPSLA — nagłówek sekcji w podglądzie. Do 13.09 stała tu sama nazwa kapsla z CUDZEJ
//  maszyny („Lot"), czyli etykieta, która nikomu nic nie mówi. Rola to słowo autora o tym, co ta
//  ręka ma robić („Lot i nurkowanie (jedna ręka)"), a notka roli to jedyne miejsce, w którym pisze,
//  jak jej użyć. Oba leżały w pliku i oba pokazywały się dopiero w oknie ról — czyli PO tym, jak
//  człowiek zdecydował, że wczytuje.
// ---------------------------------------------------------------------------------------------
function rfRoleHeadHtml(sec) {
  if (!sec || typeof sec !== "object") return "";
  const role = (sec.role && typeof sec.role === "object") ? sec.role : {};
  const name = String(role.name || sec.devName || "").trim();
  const note = String(role.note || "").trim();
  const mv = rfMotionText(sec.motion);
  const sh = rfMotionShareText(sec.motion);
  if (!name && !note && !mv) return "";
  let h = '<div class="ts-role">';
  if (name) h += '<div class="ts-role-n"><span class="ts-role-ic" aria-hidden="true">🎮</span>' + _rfbEsc(name) + '</div>';
  if (note) h += '<div class="ts-role-d">' + _rfbEsc(note) + '</div>';
  if (mv) h += '<div class="ts-role-m">' + _rfbEsc(mv) + '</div>';
  if (sh) h += '<div class="ts-role-m">' + _rfbEsc(sh) + '</div>';
  return h + '</div>';
}

// ---------------------------------------------------------------------------------------------
//  O TYM ZESTAWIE — opis autora + instrukcja użytkowania (`description` + `howto` z koperty).
//  Pusty napis, gdy plik nie niesie ani jednego, ani drugiego: nagłówek nad niczym czyta się jak
//  brakujące dane, a zestaw ułożony ręcznie i nigdy nieopisany jest zupełnie normalny.
// ---------------------------------------------------------------------------------------------
function rfSetupAboutHtml(a) {
  const desc = String((a && a.description) || "").trim();
  const steps = (a && Array.isArray(a.howto)) ? a.howto.filter(function (s) { return String(s || "").trim(); }) : [];
  if (!desc && !steps.length) return "";
  let h = '<div class="ts-about">';
  if (desc) {
    h += '<div class="ts-about-h">' + _rfbEsc(_rfbT("Co to jest", "What this is")) + '</div>' +
         '<div class="ts-about-d">' + _rfbEsc(desc) + '</div>';
  }
  if (steps.length) {
    h += '<div class="ts-about-h ts-about-h2">' + _rfbEsc(_rfbT("Jak tego używać", "How to use it")) + '</div>' +
         '<ol class="ts-howto">' +
         steps.map(function (s) { return '<li>' + _rfbEsc(String(s).trim()) + '</li>'; }).join("") +
         '</ol>';
  }
  return h + '</div>';
}
