"use strict";
// ==================================================================================================
//  NIEZAPISANE ZMIANY WIDAĆ Z NAWIGACJI
//
//  SKĄD TO SIĘ WZIĘŁO: moduł z niezapisanymi zmianami ma to pokazywać wizualnie,
//  żeby użytkownik wiedział.
//
//  CZEGO BRAKOWAŁO. Model zapisu w tej aplikacji jest dwuwarstwowy i to jest jego zaleta: NA KAPSLU
//  zapisuje się samo (pokręciłeś — działa), a W BIBLIOTECE dopiero po „Zapisz zmiany". Cena jest
//  taka, że „mam tu zmiany, których nie ma w zapisanej konfiguracji" to prawdziwy, osobny stan —
//  i do dziś mówił o nim WYŁĄCZNIE blok tekstu na górze zakładki tego jednego modułu. Żeby się
//  dowiedzieć, że pół godziny kręcenia w MIDI wisi na włosku, trzeba było do MIDI wejść.
//
//  KROPKA JEST W NAWIGACJI, czyli w jedynym miejscu, które widać ZAWSZE i z każdego modułu. Druga,
//  ta sama, siada na zakładce „Konfiguracja" wewnątrz modułu — bo kiedy już się w nim jest, pytanie
//  brzmi „w której z trzech zakładek to siedzi".
//
//  DWA STANY, NIE JEDEN:
//    • `is-dirty` (bursztyn) — kapsel nosi NAZWANĄ konfigurację i ma w niej zmiany. Wszystko działa,
//      ale biblioteka o nich nie wie.
//    • `is-gone`  (czerwień) — kapsel nosi nazwę, której NIE MA już na liście. Ustawienia istnieją
//      tylko na nim; nie ma dokąd ich przywrócić, dopóki się ich nie zapisze z powrotem.
//
//  CZEGO KROPKA NIE OZNACZA: konfiguracji BEZ NAZWY. To jest stan startowy każdej świeżej instalacji,
//  więc ostrzeżenie przy ośmiu modułach naraz pierwszego dnia nauczyłoby tylko tego, że te kropki
//  nic nie znaczą. O braku nazwy mówi blok stanu w module, i to jest właściwe miejsce.
//
//  ZAKRES JEST TAKI SAM, CO CAŁEJ NAWIGACJI: chodzi o kapsel, który jest teraz wybrany do edycji —
//  dokładnie tak, jak zielona kropka „moduł włączony" obok. Przełączenie kapsla przerysowuje jedno
//  i drugie (`renderDeviceSelector` → `paintAll` w rf-49j).
//
//  Ładowany PO rf-49j (dopisuje do jego przestrzeni `window._rfpc`), a wołany z jego `$.paint`.
// ==================================================================================================

(function (global) {

  const $ = global._rfpc = global._rfpc || {};

  /* CO MA POWIEDZIEĆ KROPKA. Ma być zrozumiała dla użytkownika
     końcowego, a nie kryptyczna.

     Stało tu „Ta konfiguracja zniknęła z listy — ustawienia są tylko na kapslu": zdanie prawdziwe
     i bezużyteczne. Nie mówiło KTÓRA konfiguracja (żadnej nazwy), CO to za lista (słowo, którego
     w panelu nie ma — jest zakładka „Biblioteka"), ani CZY coś się zepsuło. Człowiek widzi
     czerwony pierścień przy module i nie wie, czy właśnie stracił godzinę pracy.

     Każdy z tych dwóch napisów mówi teraz trzy rzeczy, w tej kolejności:
       1. czy coś przepadło (nie — ustawienia działają i są zapisane),
       2. czego brakuje, NAZWANE po imieniu, które człowiek sam nadał,
       3. który przycisk to załatwia i gdzie stoi.
     Przycisk jest wskazany dokładnie tam, gdzie naprawdę jest: u góry zakładki „Konfiguracja"
     stoi zdanie o stanie, a pod nim „Zapisz zmiany" albo „Zapisz z powrotem…" (rf-49j3
     `paintCfgState`). Ten sam znacznik wisi zresztą na tej zakładce, więc droga jest jedno
     kliknięcie długa.

     ⚠️ Napis jest SKŁADANY z nazwą, więc nie ma jak trafić do słownika i18n — dlatego powstaje
     przez `_gl()` w chwili rysowania, a nie jako klucz. Przełącznik języka przerysowuje moduły
     (`rfpcRelang` → `$.paintAll` → `$.paint` → `dirtyMark`), więc obie wersje wracają same. */
  const TXT = {
    dirty: ['{0} działają, ale w Bibliotece jest starsza wersja zapisu „{1}”. Zrówna ją z tym, co masz teraz, przycisk „Zapisz zmiany” u góry Konfiguracji.',
            '{0} work, but the Library still holds an older version of “{1}”. The “Save the changes” button at the top of Configuration brings it up to date.'],
    gone:  ['{0} działają i nic nie przepadło. W Bibliotece nie ma już zapisu „{1}”, czyli kopii, do której dałoby się wrócić — zrobi ją „Zapisz z powrotem…” u góry Konfiguracji.',
            '{0} work and nothing is lost. The Library no longer has a copy named “{1}” to come back to — “Save it back…” at the top of Configuration makes one.'],
    // KTO TO NOSI. Dwa moduły (Usługi sieciowe, syntezator) nie mają konfiguracji per kapsel —
    // `perDev: false` w MODS — więc zdanie o kapslu byłoby tam po prostu nieprawdziwe.
    naKapslu: ["Ustawienia na kapslu", "The settings on the capsule"],
    wProgramie: ["Ustawienia programu", "The program’s settings"],
  };
  function _t(pair) { return (typeof _gl === "function") ? _gl(pair[0], pair[1]) : pair[0]; }
  function _tf(pair) {
    let s = _t(pair);
    for (let i = 1; i < arguments.length; i++) s = s.split("{" + (i - 1) + "}").join(arguments[i]);
    return s;
  }

  // Znacznik jest `<i>`, a nie `<span>`, i to nie jest kaprys: CAŁA aplikacja szuka napisu pozycji
  // nawigacji zapytaniem `span:not(.rfic):not(.tab-dot):not(.tab-emoji)` (rf-34b `paintOuts`,
  // rf-49j `modLabel`, rf-48 `rfTabsList`), a arkusz nadaje takiemu `<span>` szerokość etykiety.
  // Dołożenie tam drugiego `<span>` znaczyłoby dopisywanie wyjątku w czterech miejscach naraz.
  function _mark(host, where) {
    let m = host.querySelector(":scope > .rf-dirty");
    if (m) return m;
    m = document.createElement("i");
    m.className = "rf-dirty";
    m.setAttribute("role", "img");
    if (where && where.parentNode === host) host.insertBefore(m, where);
    else host.appendChild(m);
    return m;
  }
  function _set(host, kind, txt, before) {
    if (!host) return;
    const has = host.querySelector(":scope > .rf-dirty");
    if (!kind) { if (has) has.remove(); host.classList.remove("has-dirty"); return; }
    const m = has || _mark(host, before);
    m.classList.toggle("is-gone", kind === "gone");
    // `title` przechodzi przez warstwę dymków (rf-05 przenosi go na `data-rftip`), a `aria-label`
    // jest tym, co usłyszy czytnik ekranu — kropka bez niego byłaby informacją tylko dla oczu.
    // `data-noi18n`: zdanie jest złożone z nazwy, którą nadał człowiek, więc walker ma je zostawić
    // w spokoju — tak samo, jak zdanie o stanie nad przyciskami (rf-49j3 `paintCfgState`).
    // `title` wystarczy NADAĆ: rf-05 obserwuje ten atrybut i sam przepisze go na `data-rftip`,
    // także przy zmianie na istniejącym już znaczniku.
    if (m.getAttribute("aria-label") !== txt) {
      m.setAttribute("aria-label", txt);
      m.title = txt;
      m.setAttribute("data-noi18n", "");
    }
    host.classList.add("has-dirty");
  }

  // Jedyne wejście: woła je `$.paint(I)` w rf-49j, czyli dokładnie wtedy, gdy moduł przelicza swój
  // stan. Osobny nasłuch byłby drugim źródłem tej samej odpowiedzi — a takie dwa zawsze w końcu
  // mówią co innego (patrz „Co wychodzi z tego kapsla" w rf-34b, zbudowane na tej samej zasadzie).
  $.dirtyMark = function (I) {
    let kind = "", txt = "";
    try {
      const st = $.stateOf(I);
      if (st.name && !st.known) kind = "gone";
      else if (st.dirty) kind = "dirty";
      if (kind) {
        const kto = _t(I.spec.perDev === false ? TXT.wProgramie : TXT.naKapslu);
        txt = _tf(TXT[kind], kto, st.name);
      }
    } catch (e) { }

    // 1. pozycja w nawigacji — widoczna z każdego innego modułu
    const nav = document.querySelector('.tab-btn[data-tab="' + I.spec.tab + '"]');
    if (nav) _set(nav, kind, txt, nav.querySelector(".tab-dot"));

    // 2. zakładka „Konfiguracja" tego modułu — kiedy już się w nim jest, to ona odpowiada na
    //    pytanie „w której zakładce to siedzi"
    if (I.tabBtn && I.tabBtn.cfg) _set(I.tabBtn.cfg, kind, txt, null);
  };
})(window);
