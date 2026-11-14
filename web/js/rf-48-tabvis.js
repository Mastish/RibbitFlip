"use strict";
// ===== „Widoczność" — chowanie zakładek na pasku ==============================================
// The tab bar grew to eleven buttons, and most rigs use four of them. This is the fold that lets
// somebody who never touches MIDI, OSC or the Synth stop looking at them — WITHOUT switching
// anything off. That distinction is the whole design: hiding is about the bar, not about the
// engines. A hidden MIDI tab still sends MIDI, and the sentence under the row says so, because
// the alternative reading ("I hid it, so it stopped") is the one that costs somebody an evening.
//
// Shape borrowed wholesale from „Moduły" (rf-45-devmods.js): a pill with a chevron that folds out
// a row of icon + name + rf-toggle. Deliberately the same drawing for the same KIND of question
// ("what is on my rig, and do I want it"), so the second one needs no learning. The difference is
// the axis: „Moduły" is per capsule (a matrix), this is per window (one row) — the tab bar belongs
// to the panel, not to a puck.
//
// Where the list lives: on the SERVER (Settings/ribbitflip_ui.json → hiddenTabs), not in
// localStorage, because the panel is opened from the tray, from a second window and from a phone
// on the same machine, and "my tab bar" should be the same bar in all of them. Only the fold's
// own open/closed state is local — that is about this window, and nothing else.
//
// Nothing in this subtree is translated by the i18n walker (data-noi18n): the row is composed with
// _gl() while painting, so a language switch redraws it through tvRelang(). The tab NAMES are read
// live off the buttons (rfTabsList), which means they are whatever the walker has already made of
// them — the row can never disagree with the bar it controls.

const TV_LSKEY = "ribbitflip.tabvis.open";
const TV_SAVE_MS = 300;          // one POST per burst of clicks, not one per click

let _tvHidden = [];              // source of truth in the browser; the server has the copy on disk
let _tvOpen = false;
let _tvSaveTid = 0;
let _tvSaving = false;           // a POST is in flight — the next one waits for it (no overtaking)
let _tvDirty = false;

function _tvL(pl, en) { return (typeof _gl === "function") ? _gl(pl, en) : pl; }
function _tvEsc(s) { return (typeof esc === "function") ? esc(s) : String(s == null ? "" : s); }
function _tvToast(msg) { try { if (typeof rfToast === "function") rfToast(msg, { tone: "danger" }); } catch (e) { } }
function _tvTabs() { try { return (window.rfTabsList && window.rfTabsList()) || []; } catch (e) { return []; } }
// The server stores ids without knowing what a tab is (deliberately — see sanitize_hidden_tabs),
// so the filtering of ids this build has never heard of happens HERE, where the list actually
// lives. Also drops the anchor, which a hand-edited file could name and which must never fold.
// Anything dropped stops counting on the pill too: a badge saying „2" over a row with one switch
// off would be the same kind of lie the badge exists to prevent.
function _tvKnown(list) {
  const ok = Object.create(null);
  for (const t of _tvTabs()) if (!t.anchor) ok[t.id] = true;
  const out = [];
  for (const id of (list || [])) if (ok[id] && out.indexOf(id) < 0) out.push(id);
  return out;
}

// ---- the sentence under the row --------------------------------------------------------------
// Said in full every time rather than hidden behind a tooltip: it is the one thing about this
// control that is not obvious from looking at it.
function tvNote() {
  // UX 261120 (P-G0-12): lista do odhaczania zamiast przełączników, które wyglądały jak włączniki
  // modułów. Zdanie mówi to, czego z samej listy nie widać: schowanie nie wyłącza modułu.
  // UX 261120 L23: schowane pozycje nie znikają, tylko czekają pod „Więcej modułów” (rf-34b).
  return _tvL("Schowane pozycje są pod „Więcej modułów”. Schowany moduł dalej działa, wyłączasz go jego włącznikiem.",
              "Hidden entries wait under “More modules”. A hidden module keeps working; turn it off with its own switch.");
}
function tvAnchorTip() {
  return _tvL("Mapowanie zostaje zawsze. To zakładka, na którą wraca panel, kiedy schowasz tę oglądaną.",
              "Mapping always stays. It is the tab the panel falls back to when you hide the one you are looking at.");
}
function tvBtnTip() {
  return _tvL("Schowaj pozycje, których nie używasz. Nawigacja robi się krótsza, moduły działają dalej.",
              "Hide the entries you do not use. The navigation gets shorter; the modules keep working.");
}

// ---- writing ---------------------------------------------------------------------------------
// Debounced, and serialised: clicking four switches in two seconds is ONE save, and a save never
// overtakes the one before it. Both matter more than they look — the panel is opened in several
// windows at once, and two overlapping writes of the same file are how one of them loses.
function _tvFlush(keepalive) {
  clearTimeout(_tvSaveTid); _tvSaveTid = 0;
  if (_tvSaving) { _tvDirty = true; return; }
  _tvSaving = true; _tvDirty = false;
  const body = JSON.stringify({ hidden: _tvHidden.slice() });
  const opt = { method: "POST", headers: { "Content-Type": "application/json" }, body: body };
  if (keepalive) opt.keepalive = true;      // leaving the page: let the browser finish this one
  fetch("/ui-tabs", opt)
    .then(r => r.json()).catch(() => null)
    .then(r => {
      _tvSaving = false;
      if (!r || r.ok !== true) {
        _tvToast(_tvL("Nie udało się zapisać widoczności zakładek.",
                      "Could not save which tabs are hidden."));
        return;
      }
      if (_tvDirty) _tvFlush(false);        // something changed while we were writing
    });
}
function _tvSaveSoon() {
  clearTimeout(_tvSaveTid);
  _tvSaveTid = setTimeout(() => _tvFlush(false), TV_SAVE_MS);
}

// ---- toggling --------------------------------------------------------------------------------
function tvSetHidden(id, hide) {
  id = String(id || "");
  if (!id || id === (window.rfTabsAnchor || "mapowanie")) return;   // the anchor cannot be folded
  const at = _tvHidden.indexOf(id);
  if (hide && at < 0) _tvHidden.push(id);
  else if (!hide && at >= 0) _tvHidden.splice(at, 1);
  else return;                                                      // already there — no POST
  try { if (window.rfTabsApplyVisibility) window.rfTabsApplyVisibility(_tvHidden); } catch (e) { }
  tvPaint();
  _tvSaveSoon();
}

// CAŁA LISTA NARAZ (UX 261120 L23): pierwsze pytanie „Do czego chcesz używać RibbitFlipa?” (rf-48b)
// ustawia widoczność jednym zapisem, a nie dziesięcioma kliknięciami przez `tvSetHidden`.
// Ta sama droga co klik: pasek przez rfTabsApplyVisibility, zapis na serwer z opóźnieniem.
window.rfTabVisSet = function (list) {
  _tvHidden = _tvKnown((list || []).map(String));
  try { if (window.rfTabsApplyVisibility) window.rfTabsApplyVisibility(_tvHidden); } catch (e) { }
  tvPaint();
  _tvSaveSoon();
};
window.rfTabVisHidden = function () { return _tvHidden.slice(); };

// ---- markup ----------------------------------------------------------------------------------
function tvCellLabel(t) {
  return t.label + " · " + (t.hidden ? _tvL("ukryta", "hidden") : _tvL("widoczna", "shown"));
}
// FILCOWE POLE WYBORU, NIE PRZEŁĄCZNIK (UX 261120, P-G0-12). Dźwignia `rf-toggle` pod nazwą „MIDI”
// czytała się jak włącznik MIDI. Pole wyboru (`cbon`/`cboff`, globalny styl w 10-icons-controls.css)
// to lista do odhaczania: „pokaż w nawigacji”. Zaznaczone = pozycja stoi w nawigacji.
function _tvCell(t) {
  const on = !t.hidden;
  const lock = !!t.anchor;
  const lab = lock ? (t.label + " · " + _tvL("zawsze widoczna", "always shown")) : tvCellLabel(t);
  const ic = t.png ? `<span class="rfic tv-ic tab-ic-${_tvEsc(t.png)}" aria-hidden="true"></span>`
                   : `<span class="tv-ic tv-ic-txt" aria-hidden="true">${_tvEsc(t.emoji || "")}</span>`;
  return `<label class="tv-cell${lock ? " tv-lock" : ""}${t.hidden ? " tv-off" : ""}"` +
         ` title="${_tvEsc(lock ? tvAnchorTip() : lab)}">` + ic +
         `<span class="tv-name">${_tvEsc(t.label)}</span>` +
         `<input type="checkbox" class="tv-tg tv-cb${lock ? " tv-tg-lock" : ""}"` +
         (on ? " checked" : "") + (lock ? " disabled" : "") +
         // Nazwa dostępna to sama nazwa pozycji: stan niesie `checked`, a „ukryta/widoczna” w nazwie
         // czytnik mówiłby obok „zaznaczone” drugi raz.
         ` data-tab="${_tvEsc(t.id)}" aria-label="${_tvEsc(lock ? lab : t.label)}"></label>`;
}
// KOLEJNOŚĆ I PODZIAŁ JAK W NAWIGACJI. Wiersz szedł surową kolejnością z TABS, więc mówił
// „…Synth, Nakładka, Czujnik, Połączenie, Zestawy, Konfiguracja" — czyli inaczej niż lista,
// którą steruje („Moduł", potem „Reszta": Zestawy · Konfiguracja · Nakładka · Czujnik ·
// Połączenie). Szukanie pozycji w spisie ułożonym inaczej niż oryginał jest pracą, której ten
// spis miał oszczędzić. Nagłówki są te same, co w nawigacji (rf-34b `sect`), z tego samego powodu:
// od 2026-10-03 trzy, bo między „Modułem" a „Resztą" stoi „Wypróbuj" (Synth, `grp:"play"`).
function _tvGroups() {
  const tabs = _tvTabs();
  const by = g => tabs.filter(t => t.grp === g).sort((a, b) => (a.ord || 99) - (b.ord || 99));
  // Pozycja z nieznaną sekcją (starszy panel) nie może wypaść z listy: ląduje w „Narzędziach”.
  const known = ["top", "mod", "play", "tools", "app"];
  const other = tabs.filter(t => known.indexOf(t.grp) < 0);
  // Ta sama kolejność i te same nagłówki, co w nawigacji (rf-34b): Zestawy nad sekcjami,
  // Ustawienia pod nimi, oba bez własnego nagłówka.
  return [["", by("top")], [_tvL("Moduły", "Modules"), by("mod")], [_tvL("Wypróbuj", "Try it out"), by("play")],
          [_tvL("Narzędzia", "Tools"), by("tools").concat(other)], ["", by("app")]];
}
function tvBuild(box) {
  let h = `<div class="tv-head">${_tvEsc(_tvL("Pokaż w nawigacji", "Show in navigation"))}</div>`;
  for (const [name, list] of _tvGroups()) {
    if (!list.length) continue;
    if (name) h += `<div class="tv-grp">${_tvEsc(name)}</div>`;
    h += `<div class="tv-row">`;
    for (const t of list) h += _tvCell(t);
    h += "</div>";
  }
  h += `<div class="tv-note">${_tvEsc(tvNote())}</div>`;
  box.innerHTML = h;
}

// The pill LIGHTS UP while anything is folded away. Without it a short bar looks like the app it
// came with, and „gdzie się podział MIDI?" has no answer anywhere on screen. The count is on the
// button rather than in a tooltip for the same reason.
function tvPaintBtn() {
  const btn = document.getElementById("tabVisBtn"); if (!btn) return;
  const n = _tvHidden.length;
  btn.classList.toggle("on", n > 0);
  btn.setAttribute("aria-expanded", _tvOpen ? "true" : "false");
  const cnt = btn.querySelector(".tv-cnt");
  if (cnt) { cnt.textContent = n > 0 ? String(n) : ""; cnt.style.display = n > 0 ? "" : "none"; }
  btn.title = n > 0
    ? (_tvL("Ukrytych zakładek: ", "Tabs hidden: ") + n + ". " + tvBtnTip())
    : tvBtnTip();
  // Icon-only button — the accessible name must not depend on the (absent) label text.
  btn.setAttribute("aria-label", _tvL("Widoczność modułów", "Module visibility"));
}
function tvPaint() {
  tvPaintBtn();
  const wrap = document.getElementById("tabVisWrap"); if (!wrap) return;
  // `display` is NOT set here any more — the three classes in 16-devmods.css own it, because the
  // fold has to stay laid out for the length of the closing slide and this function runs at the
  // START of it. Painting the row while it retracts is pointless anyway: it is on its way out.
  if (!_tvOpen) return;                     // folded away costs nothing, same as „Moduły"
  const box = document.getElementById("tabVisBox"); if (!box) return;
  // The row is rebuilt whole on every change (ten cells — cheaper than diffing them), which
  // throws away the element the keyboard was standing on. Somebody switching tabs off with
  // Space would be dropped back to the top of the document after the first one, so the focus
  // is put back on the same switch. Ids are [a-z0-9-] (the server guarantees it), no escaping.
  const cur = document.activeElement;
  const was = (cur && cur.closest) ? cur.closest(".tv-tg") : null;
  const keep = was ? was.getAttribute("data-tab") : null;
  tvBuild(box);
  if (keep) {
    const back = box.querySelector('.tv-tg[data-tab="' + keep + '"]');
    if (back && back.focus) try { back.focus(); } catch (e) { }
  }
}
// Language switch: the row is _gl() at paint time AND its names are read off the buttons, which
// applyLang() has just rewritten. Both reasons need a real rebuild, not a walker pass.
function tvRelang() { tvPaint(); }

// ---- where the fold hangs ----------------------------------------------------------------------
// „Under the bar" is not a document position — the bar is sticky, so it is a WINDOW position: the
// bar's own `top` from the stylesheet plus however tall it happens to be. Asked of the DOM rather
// than written down, because the bar wraps to a second row on a narrow window and the two skins
// give it different offsets. Exactly the measurement behind `--rf-sticky-top` (22-modtabs.css), for
// exactly the same reason — one bar shorter, because the fold hangs ABOVE the module bar.
function _tvSyncTop() {
  const bar = document.querySelector(".tabbar");
  const wrap = document.getElementById("tabVisWrap");
  if (!wrap) return;
  if (!bar) {
    // UKŁAD TRZECH KOLUMN (2026-08-29): poziomego paska zakładek nie ma — nawigacja stoi pionowo
    // w lewej kolumnie, a szuflada „Widoczność" mieszka na górze środkowej. Lepki jest wtedy sam
    // nagłówek, więc to jego wysokość mówi, gdzie szuflada ma się zatrzymać.
    const hd = document.querySelector("header");
    const h = hd ? (hd.getBoundingClientRect().height || hd.offsetHeight) : 0;
    wrap.style.setProperty("--tv-top", Math.ceil(h + 8) + "px");
    return;
  }
  let top = 0;
  try { top = parseFloat(getComputedStyle(bar).top) || 0; } catch (e) { top = 0; }
  // `getBoundingClientRect().height` and ceil, not `offsetHeight` and round: the bar is 82.44 px
  // tall here, offsetHeight says 82, and the half pixel it drops is the bar's bottom edge sitting
  // ON the fold. Rounding UP always leaves the fold below the bar, never a hair under it.
  const h = bar.getBoundingClientRect().height || bar.offsetHeight;
  wrap.style.setProperty("--tv-top", Math.ceil(top + h) + "px");
}

// ---- open / close ----------------------------------------------------------------------------
// `byUser` = szufladę otworzył albo zamknął CZŁOWIEK (przycisk, Escape), a nie odtworzenie stanu
// z localStorage przy starcie ani przerysowanie po zmianie języka. Tylko wtedy przenosimy fokus:
// fałda leży na górze #rfMain, czyli w DOM ZA całą nawigacją (decyzja o miejscu — komentarz przy
// `foldHost` niżej zostaje: przenosimy fokus, nie DOM), więc bez tego do pierwszego przełącznika
// jest kilkanaście naciśnięć Tab, a po zamknięciu fokus zostaje w znikniętym pudełku.
// WHY: the fold sits at the top of #rfMain, after the whole navigation in DOM order; moving the
// focus (not the DOM) is what makes it reachable, and closing must hand the focus back to the eye.
function tvSetOpen(open, byUser) {
  const _wasIn = byUser && _tvFocusInBox();
  _tvOpen = !!open;
  try { localStorage.setItem(TV_LSKEY, _tvOpen ? "1" : "0"); } catch (e) { }
  // The offset FIRST: the fold is about to slide out to `--tv-top`, and reading the bar after the
  // slide has started would measure it mid-move.
  _tvSyncTop();
  // Then the CONTENT, and only then the slide. The other order looks right and is not: the row is
  // built inside tvPaint(), so a slide started before it would animate an empty box to its 21 px of
  // padding, finish, and let the switches appear in a jump afterwards.
  tvPaint();
  // Shared with „Moduły" (rf-45) — same gesture, same three states, one implementation in rf-00.
  rfFoldSetOpen(document.getElementById("tabVisWrap"), _tvOpen);
  if (!byUser) return;
  try {
    if (_tvOpen) {
      // Powtórka w następnej klatce: pudełko przechodzi z `display:none` na `grid` w tym samym
      // zadaniu, w którym wołamy focus(), a wtedy Chromium potrafi uznać przełącznik za
      // „nierysowany" i focus() przepada BEZ BŁĘDU (zmierzone w iteracji 5, porcja 1).
      const _go = () => {
        const first = document.querySelector('#tabVisBox .tv-tg:not([disabled])');
        if (first && first.focus && document.activeElement !== first) { try { first.focus(); } catch (e) { } }
      };
      _go(); requestAnimationFrame(_go);
    } else if (_wasIn) {
      const btn = document.getElementById("tabVisBtn");
      if (btn && btn.focus) btn.focus();
    }
  } catch (e) { }
}
// Czy fokus stoi w szufladzie — pytamy PRZED zamknięciem, bo po nim pudełko jest już poza układem.
function _tvFocusInBox() {
  const box = document.getElementById("tabVisBox"), a = document.activeElement;
  return !!(box && a && box.contains(a));
}

// ---- build + wire ----------------------------------------------------------------------------
function initTabVis() {
  // GDZIE STOI PRZYCISK. Do 2026-08-28 był na końcu poziomego paska zakładek. Pasek zniknął wraz
  // z przebudową na trzy kolumny, więc przycisk stoi teraz w nagłówku „Nawigacja" (#rfNavBar) —
  // przy tej samej liście, którą włącza i wyłącza. `.tabbar` zostaje jako droga odwrotu dla
  // każdego układu, który by ten pasek jeszcze miał.
  const bar = document.getElementById("rfNavBar") || document.querySelector(".tabbar");
  if (!bar || document.getElementById("tabVisBtn")) return;
  try { _tvOpen = (localStorage.getItem(TV_LSKEY) === "1"); } catch (e) { }

  // The list the bar was ALREADY built from (rf-34 read the same injected global). Copied rather
  // than re-fetched: a GET here would race the bar and could only ever confirm what it already
  // did. The fetch below is the fallback for a page that was served without the injection.
  try { _tvHidden = _tvKnown((window.RIBBITFLIP_HIDDEN_TABS || []).map(String)); } catch (e) { _tvHidden = []; }
  const injected = (typeof window.RIBBITFLIP_HIDDEN_TABS !== "undefined");

  const btn = document.createElement("button");
  btn.type = "button"; btn.className = "btn sm tv-btn"; btn.id = "tabVisBtn";
  btn.setAttribute("aria-expanded", _tvOpen ? "true" : "false");
  btn.setAttribute("aria-controls", "tabVisBox");
  btn.setAttribute("data-noi18n", "");      // composed with _gl(); tvRelang redraws it
  // Icon-only on purpose: the same eye silhouette as the overlay part-toggles, with the
  // slash shown while anything is hidden — one visual language for "part of the view is off".
  // Own copy instead of OVL_EYE_ICON: that one's slash is display-scoped under .ovl-eye.
  btn.innerHTML = '<span class="tv-chev" aria-hidden="true"></span>' +
                  '<span class="tv-eye" aria-hidden="true"><svg viewBox="0 0 16 16" focusable="false" fill="none" ' +
                  'stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' +
                  '<path d="M1.8 8c1.6-2.9 3.7-4.3 6.2-4.3S12.6 5.1 14.2 8c-1.6 2.9-3.7 4.3-6.2 4.3S3.4 10.9 1.8 8z"/>' +
                  '<circle cx="8" cy="8" r="1.9"/>' +
                  '<path class="tv-eye-slash" d="M2.6 13.4 13.4 2.6"/></svg></span>' +
                  '<span class="tv-cnt" aria-hidden="true"></span>';
  // KOLEJNOŚĆ W DOM = KOLEJNOŚĆ NA EKRANIE. Arkusz ustawiał oba sterowniki nagłówka `order`-em
  // (oko przed zwijaniem panelu), a w DOM oko szło jako ostatnie — więc tabulator odwiedzał je
  // w odwrotnej kolejności niż ta, którą widać, i „następny" prowadził w lewo. Wstawiamy przycisk
  // tam, gdzie naprawdę stoi, zamiast przestawiać sam obrazek (reguły `order` w 20-cols.css
  // odeszły razem z tym). `.tabbar` — droga odwrotu bez sterownika zwijania — dostaje go na końcu,
  // czyli tak jak przedtem.
  const _ptog = bar.querySelector(".rf-ptog");
  if (_ptog) bar.insertBefore(btn, _ptog); else bar.appendChild(btn);

  const wrap = document.createElement("div");
  // Restored open from localStorage arrives at 1fr straight away — both classes at once, no rAF.
  // A page that slides its own furniture out on load looks like it is still loading.
  wrap.className = "tv-wrap" + (_tvOpen ? " on open" : ""); wrap.id = "tabVisWrap";
  wrap.setAttribute("data-noi18n", "");
  const box = document.createElement("div");
  box.className = "tv-box"; box.id = "tabVisBox";
  wrap.appendChild(box);
  // Szuflada idzie na górę ŚRODKOWEJ kolumny, a nie pod przycisk: lewa ma 206 px, a wiersz
  // dwunastu przełączników z nazwami zakładek potrzebuje szerokości. Wysunięta stoi dokładnie tam,
  // gdzie i tak patrzy się na skutek jej przełączników — nad treścią. Przy układzie z paskiem
  // zakładek (droga odwrotu) zostaje po staremu, tuż pod nim.
  const foldHost = document.getElementById("rfMain");
  if (foldHost) foldHost.insertAdjacentElement("afterbegin", wrap);
  else bar.insertAdjacentElement("afterend", wrap);
  _tvSyncTop();
  // Two boxes move this number and neither of them announces it. The BAR changes height on its own
  // (tiles wrap on a narrow window, and hiding a tab from this very fold can drop a whole row); the
  // HEADER changes `--topbar-h`, which is what the bar's own `top` is calculated from (rf-40
  // `_syncTopbarH`) — including once more after the fonts settle, with no resize event anywhere.
  // Left stale, the fold would either overlap the bar or float below it, so the offset follows the
  // boxes rather than an event.
  try {
    if (window.ResizeObserver) {
      new ResizeObserver(_tvSyncTop).observe(bar);
      const hd = document.querySelector("header");
      if (hd) new ResizeObserver(_tvSyncTop).observe(hd);
    }
  } catch (e) { }
  window.addEventListener("resize", _tvSyncTop);

  btn.addEventListener("click", () => tvSetOpen(!_tvOpen, true));

  // ONE delegated listener: the row is rebuilt on every change and on every language switch, so
  // per-cell handlers would have to be re-attached each time.
  const hit = e => {
    const tg = e.target.closest && e.target.closest(".tv-tg");
    if (!tg || tg.classList.contains("tv-tg-lock")) return null;
    const id = tg.getAttribute("data-tab");
    return id ? { tg, id } : null;
  };
  // Pole wyboru samo zmienia `checked` (klik, Spacja, klik w podpis `<label>`), więc słuchamy
  // `change` i czytamy stan z pola: zaznaczone = widoczne.
  box.addEventListener("change", e => {
    const h = hit(e); if (!h) return;
    tvSetHidden(h.id, !h.tg.checked);
  });
  box.addEventListener("keydown", e => {
    // Escape zamyka szufladę i oddaje fokus oku — jak każde inne okienko w panelu. `stopPropagation`,
    // żeby to samo naciśnięcie nie zamknęło przy okazji czegoś pod spodem.
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); tvSetOpen(false, true); return; }
  });

  // A pending save must survive closing the window — the debounce is 300 ms, and a click on the
  // last switch followed immediately by Alt+F4 is a real sequence.
  const flushNow = () => { if (_tvSaveTid || _tvDirty) _tvFlush(true); };
  window.addEventListener("pagehide", flushNow);
  document.addEventListener("visibilitychange", () => { if (document.hidden) flushNow(); });

  // Fallback only: a page served without the injected global (an older server, a cached HTML).
  // Applied through the same door as a click, so the bar and the row can never drift apart.
  if (!injected) {
    fetch("/ui-tabs").then(r => r.json()).catch(() => null).then(r => {
      if (!r || !Array.isArray(r.hidden)) return;
      _tvHidden = _tvKnown(r.hidden.map(String));
      try { if (window.rfTabsApplyVisibility) window.rfTabsApplyVisibility(_tvHidden); } catch (e) { }
      tvPaint();
    });
  }
  tvPaint();
}
