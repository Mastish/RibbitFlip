"use strict";
// ==================================================================================================
//  WŁASNY PASEK PRZEWIJANIA DLA DWÓCH KOLUMN
//
//  SKĄD TO SIĘ WZIĘŁO: przewijanie prawego menu działało źle, a nad paskiem
//  był dalej zwykły kursor.
//
//  DLACZEGO NIE DA SIĘ INACZEJ. Kursor nad NATYWNYM paskiem maluje przeglądarka i CSS go nie
//  dotyka — sprawdzone dwiema turami: ustawienie `cursor` na `::-webkit-scrollbar-thumb` zmienia
//  wartość w `getComputedStyle`, a na ekranie dalej stoi systemowy grot. Przeciąganie paska nie
//  wysyła też ŻADNYCH zdarzeń do DOM-u, więc nie da się tego obejść nawet JS-em. Jedyną drogą do
//  filcowej łapki jest własny element — i o to jest ta zmiana.
//
//  CO DOKŁADNIE ROBI. Dla lewej nawigacji (`#rfRail`) i prawej kolumny (`#rfRcol`) chowa pasek
//  systemowy i rysuje własny: tor przy prawej krawędzi, kciuk o wysokości proporcjonalnej do tego,
//  ile treści widać. Kciuk ma pozy uchwytu wartości — otwarta dłoń pod kursorem, zaciśnięta przy
//  ciągnięciu — czyli to samo, co suwak, gałka i kula orientacji (10-icons-controls.css).
//
//  ZASADY, KTÓRE TRZYMAJĄ TO W CAŁOŚCI:
//
//  1. PASEK JEST DZIECKIEM PRZYKLEJONYM (`position:sticky`) WEWNĄTRZ SCROLLERA, o zerowej
//     wysokości. To jedyny układ, w którym element nie jedzie razem z treścią, a jednocześnie nie
//     wymaga liczenia położenia kolumny na ekranie: element bezwzględny w scrollerze przewija się
//     razem z zawartością (jego blokiem zawierającym jest pudełko dopełnienia, które się przewija),
//     a `sticky` przykleja go do okna przewijania. Zero pikseli w układzie, bo `height:0`.
//
//  2. NIE ZASTĘPUJEMY PRZEWIJANIA, TYLKO JEGO OBRAZEK. Kółko, klawiatura, dotyk i `scrollIntoView`
//     dalej robią swoje — chowamy wyłącznie rysunek paska. Gdyby ten plik nie doszedł, kolumny
//     przewijają się dalej, tylko bez naszego kciuka: `scrollbar-width` chowa pasek WYŁĄCZNIE
//     wtedy, gdy `rfRailScroll` zdąży dołożyć klasę `rf-sb-host` (patrz 20-cols.css).
//
//  3. KCIUK JEST OZDOBĄ DLA CZYTNIKA EKRANU (`aria-hidden`). Prawdziwym sterowaniem jest sam
//     scroller: ma fokus, `Page Up/Down`, strzałki i kółko. Dorabianie tu `role="scrollbar"`
//     znaczyłoby drugą, równoległą drogę do tej samej wartości — a czytnik i tak ogłasza już
//     przewijanie kontenera.
//
//  4. PONIŻEJ 1280 px NIE MA NAS WCALE. Prawa kolumna zmienia się wtedy w POZIOMY pas i jest
//     siatką (`display:grid` z nazwanymi obszarami, 20-cols.css) — dziecko bez przypisanego
//     obszaru rozpychałoby jej układ. Tam wraca pasek systemowy: brzydszy kursor jest mniejszym
//     złem niż rozjechana kolumna.
// ==================================================================================================

(function (global) {

  const HOSTS = ["rfRail", "rfRcol"];
  const MIN_TH = 28;                 // najkrótszy kciuk, jaki da się jeszcze złapać myszą

  function build(id) {
    const host = document.getElementById(id);
    if (!host || host._rfSb) return null;

    const sb = document.createElement("div"); sb.className = "rf-sb";
    sb.setAttribute("aria-hidden", "true");
    const track = document.createElement("div"); track.className = "rf-sb-track";
    const th = document.createElement("i"); th.className = "rf-sb-th";
    track.appendChild(th); sb.appendChild(track);
    // PIERWSZE dziecko: `sticky` przykleja się liczone od GÓRY bloku zawierającego, więc pasek
    // wstawiony na końcu startowałby dopiero pod całą treścią i pojawiał się przy samym dole.
    host.insertBefore(sb, host.firstChild);
    host.classList.add("rf-sb-host");
    host._rfSb = { sb, track, th };

    let drag = null;                 // {y0, top0, span}

    function metrics() {
      const view = host.clientHeight, total = host.scrollHeight;
      return { view, total, over: total - view };
    }
    function paint() {
      const m = metrics();
      // Nie ma czego przewijać — pasek znika, zamiast stać jako kciuk na całą wysokość.
      if (m.over <= 1 || m.view <= 0) { sb.classList.remove("on"); return; }
      sb.classList.add("on");
      track.style.height = m.view + "px";
      const tr = m.view;
      const h = Math.max(MIN_TH, Math.round(tr * (m.view / m.total)));
      const top = Math.round((tr - h) * (host.scrollTop / m.over));
      th.style.height = h + "px";
      th.style.transform = "translateY(" + top + "px)";
    }
    // Przy PRZEWIJANIU nie przeliczamy wszystkiego od nowa co zdarzenie — zbieramy do najbliższej
    // klatki. `scroll` potrafi lecieć gęściej niż klatki, a każdy przebieg czyta `scrollHeight`,
    // czyli wymusza przeliczenie układu.
    let pend = 0;
    function soon() { if (pend) return; pend = requestAnimationFrame(() => { pend = 0; paint(); }); }

    host.addEventListener("scroll", soon, { passive: true });
    global.addEventListener("resize", soon);
    // Treść tych kolumn zmienia wysokość bez żadnego zdarzenia (dochodzi kapsel, rozwija się
    // podgląd, zwija się panel), więc pytamy o to obserwatorem, a nie zgadujemy z zegara.
    if (typeof ResizeObserver === "function") {
      const ro = new ResizeObserver(soon);
      ro.observe(host);
      for (const ch of host.children) if (ch !== sb) ro.observe(ch);
      host._rfSbRo = ro;
    }

    // ---- ciągnięcie kciuka ----------------------------------------------------------------------
    // `setPointerCapture` jest tu konieczne, a nie wygodne: ręka wyjeżdża poza 10-pikselowy kciuk
    // przy pierwszym szarpnięciu i bez przechwycenia zdarzenia lecą już do elementu pod spodem.
    th.addEventListener("pointerdown", e => {
      const m = metrics(); if (m.over <= 1) return;
      const h = th.getBoundingClientRect().height;
      drag = { y0: e.clientY, top0: host.scrollTop, span: Math.max(1, m.view - h), over: m.over };
      th.classList.add("drag");
      document.documentElement.classList.add("rf-sb-dragging");
      try { th.setPointerCapture(e.pointerId); } catch (_) { }
      e.preventDefault();                    // bez tego zaczyna się zaznaczanie tekstu obok
    });
    th.addEventListener("pointermove", e => {
      if (!drag) return;
      host.scrollTop = drag.top0 + (e.clientY - drag.y0) * (drag.over / drag.span);
    });
    const end = e => {
      if (!drag) return;
      drag = null;
      th.classList.remove("drag");
      document.documentElement.classList.remove("rf-sb-dragging");
      try { if (e && e.pointerId != null) th.releasePointerCapture(e.pointerId); } catch (_) { }
    };
    th.addEventListener("pointerup", end);
    th.addEventListener("pointercancel", end);

    // Klik w TOR (poza kciukiem) = skok o stronę w tę stronę, w którą się kliknęło. Tak zachowuje
    // się pasek systemowy i nie ma powodu, żeby nasz zachowywał się inaczej.
    track.addEventListener("pointerdown", e => {
      if (e.target === th) return;
      const r = th.getBoundingClientRect();
      host.scrollBy({ top: (e.clientY < r.top ? -1 : 1) * host.clientHeight * 0.9, behavior: "smooth" });
    });

    paint();
    return host._rfSb;
  }

  function initRailScroll() {
    // Ściąga `?view=overview` nie ma tych kolumn (13-dialogs-overview.css chowa je całkiem).
    try { if (document.body.classList.contains("overview-only")) return; } catch (e) { }
    for (const id of HOSTS) { try { build(id); } catch (e) { console.error("[rfsb] " + id, e); } }
  }

  global.initRailScroll = initRailScroll;
  // Wołane po zwinięciu/rozwinięciu panelu: szerokość i wysokość jadą wtedy przejściem CSS, więc
  // pojedyncze przeliczenie w chwili kliknięcia pokazałoby stan sprzed ruchu.
  global.rfRailScrollSync = function () {
    for (const id of HOSTS) {
      const h = document.getElementById(id);
      if (h && h._rfSb) { try { h.dispatchEvent(new Event("scroll")); } catch (e) { } }
    }
  };
})(window);
