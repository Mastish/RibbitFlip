"use strict";
// ============ KOŁO WYBORU — OKNA PYTAJĄCE I WYMIANA PRESETÓW ============
// Dwie rzeczy, które obsługują KAŻDĄ decyzję koła wymagającą pytania: sama oprawa okien (rfk-*)
// oraz kreator posta na forum #zestawy dla presetu koła.
//
// PO CO OSOBNY PLIK: rf-46e opisuje, CZYM jest preset i co się z nim dzieje w aplikacji; tutaj
// jest wyłącznie to, jak o to zapytać człowieka i jak wynieść preset na zewnątrz. Granica
// tematyczna, nie arytmetyczna — ta sama, co przy podziale sceny na rf-46d / d2 / d3.
//
// DLACZEGO KOŁO MA WŁASNY KREATOR POSTA, A NIE UŻYWA rfShareOpen (rf-39f):
//   • kreator zestawów prowadzi przez TRZY kroki i pilnuje rzeczy, których preset koła nie ma —
//     zakresu sekcji pliku, wymagań poza aplikacją (ViGEmBus, loopMIDI), ról kapsli, wyboru
//     presetu z Biblioteki. Preset koła nie mieszka w Bibliotece, tylko w Settings, i nie wymaga
//     niczego poza aplikacją;
//   • preset koła jest MAŁY i mieści się w bloku kodu w treści posta, więc nie potrzebuje
//     załącznika — a cały ostatni krok tamtego kreatora jest o załączniku.
// Bierzemy z tamtego kreatora to, co jest wspólne i musi zostać wspólne: kształt treści posta oraz
// listę zastosowań do zaznaczenia (RFS_DOMAINS w rf-39g). Same NAZWY tagów i adres forum idą prosto
// z rf-00-core (RF_FORUM_TAGS, RF_FORUM_URL) — jeden słownik na całą aplikację, bo żyje na cudzym
// serwerze i przy pierwszej zmianie nazwy dwie kopie rozjeżdżają się po cichu.
const WH_TAG_MOD = RF_TAG_WHEEL;      // 🎡 Koło wyboru — tag istnieje wyłącznie na #zestawy
// Ile znaków mieści post na Discordzie. Liczba stoi w rf-00-core razem z resztą faktów o cudzym
// serwerze, bo ten sam limit obowiązuje kreator zestawów (rf-39f) — dwie kopie rozjechałyby się
// po cichu. Preset z szesnastoma wycinkami i podmenu potrafi się w nim nie zmieścić, a wtedy
// klient Discorda NIE ucina treści: zamienia cały wpis w załącznik message.txt, więc czytający
// dostaje plik tekstowy zamiast opisu i presetu w bloku kodu. Dlatego okno mówi, żeby dołożyć
// preset jako plik i zostawić w treści sam opis.
const WH_POST_MAX = RF_FORUM_BODY_MAX;

// ------------------------------------------------------------------------------------------
//  OKNA (rfk-*): pytanie, pole na JSON, pole na nazwę
// ------------------------------------------------------------------------------------------
// Ta sama oprawa i ta sama umowa klawiatury, co reszta okien wymiany w aplikacji: Escape zamyka,
// tło jest wyjściem, a po zamknięciu wraca ognisko na to, co je otworzyło.
let _whDlgClose = null;
function _whDlg(title, build) {
  try { if (_whDlgClose) _whDlgClose(); } catch (e) {}
  const prev = document.activeElement;
  const back = document.createElement("div");
  back.className = "rfk-back";
  back.setAttribute("role", "presentation");
  const card = document.createElement("div");
  card.className = "rfk-card wh-dlg";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-label", title);
  const head = document.createElement("div"); head.className = "rfk-head";
  const h = document.createElement("h3"); h.className = "rfk-title"; h.textContent = title;
  const x = document.createElement("button"); x.type = "button"; x.className = "rfk-x";
  x.setAttribute("aria-label", _wheelT("Zamknij", "Close")); x.textContent = "×";
  head.appendChild(h); head.appendChild(x);
  const body = document.createElement("div"); body.className = "wh-dlg-body";
  const foot = document.createElement("div"); foot.className = "rfk-foot";
  let onKey = null;
  const close = () => {
    if (_whDlgClose === close) _whDlgClose = null;
    if (onKey) document.removeEventListener("keydown", onKey, true);
    back.classList.add("out");
    setTimeout(() => { try { back.remove(); } catch (e) {} }, 160);
    try { if (prev && prev.focus) prev.focus(); } catch (e) {}
  };
  x.addEventListener("click", close);
  back.addEventListener("mousedown", (e) => { if (e.target === back) close(); });
  onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
  document.addEventListener("keydown", onKey, true);
  card.appendChild(head); card.appendChild(body); card.appendChild(foot);
  back.appendChild(card);
  document.body.appendChild(back);
  _whDlgClose = close;
  build(body, foot, close);
  return close;
}

function _whBtn(label, cls, fn) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn sm" + (cls ? " " + cls : "");
  b.textContent = label;
  b.addEventListener("click", fn);
  return b;
}

// Pytanie przed nadpisaniem. Zawsze mówi, CO zniknie i CO zostaje — „na pewno?" bez treści zmusza
// do zgadywania, a zgadywanie przy nadpisywaniu listy kończy się jednym sposobem.
function _whAsk(title, text, okLabel, onOk) {
  _whDlg(title, (body, foot, close) => {
    const p = document.createElement("p");
    p.className = "wh-dlg-note";
    p.textContent = text;
    body.appendChild(p);
    foot.appendChild(_whBtn(_wheelT("Anuluj", "Cancel"), "", close));
    const sp = document.createElement("span"); sp.style.flex = "1"; foot.appendChild(sp);
    foot.appendChild(_whBtn(okLabel, "primary", () => { close(); onOk(); }));
  });
}

function _whJsonDlg(title, text, importing) {
  _whDlg(title, (body, foot, close) => {
    const ta = document.createElement("textarea");
    ta.className = "wh-dlg-ta";
    ta.spellcheck = false;
    ta.value = text;
    ta.setAttribute("aria-label", title);
    body.appendChild(ta);
    const err = document.createElement("div");
    err.className = "wh-dlg-err";
    body.appendChild(err);
    if (importing) {
      foot.appendChild(_whBtn(_wheelT("Anuluj", "Cancel"), "", close));
      const sp = document.createElement("span"); sp.style.flex = "1"; foot.appendChild(sp);
      foot.appendChild(_whBtn(_wheelT("Wczytaj", "Load"), "primary", () => {
        const raw = _whPickJson(ta.value);
        if (!raw) { err.textContent = _wheelT("Pole jest puste.", "The field is empty."); return; }
        _whImport(raw, (msg) => { if (msg) err.textContent = msg; else close(); });
      }));
    } else {
      foot.appendChild(_whCopyBtn(() => ta.value, err));
      const sp = document.createElement("span"); sp.style.flex = "1"; foot.appendChild(sp);
      foot.appendChild(_whBtn(_wheelT("Zamknij", "Close"), "primary", close));
    }
    setTimeout(() => { try { ta.focus(); } catch (e) {} }, 30);
  });
}

// WKLEJONY POST ZAMIAST GOŁEGO JSON-a. Człowiek, który bierze preset z forum, kopiuje CAŁY wpis
// razem z opisem i blokiem ```json — i jest to najzwyklejsza rzecz pod słońcem. Zamiast kazać mu
// wycinać nawiasy, wyciągamy blok kodu sami; gdy go nie ma, bierzemy tekst od pierwszego „{" do
// ostatniego „}". Nic tu nie parsuje JSON-a: to robi _whImport, żeby błąd składni miał jedno
// miejsce i jedno brzmienie.
function _whPickJson(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(s);
  if (fence && fence[1].trim()) return fence[1].trim();
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  return (a >= 0 && b > a) ? s.slice(a, b + 1) : s;
}

// Kopiowanie ze ZAPASOWĄ DROGĄ — obowiązkowo: bez zgody na schowek `writeText` odrzuca obietnicę,
// a przycisk, po którym nic się nie dzieje i nic nie mówi, jest gorszy niż jego brak.
function _whCopyBtn(getText, note, label) {
  return _whBtn(label || _wheelT("Kopiuj", "Copy"), "", () => {
    const txt = getText();
    const done = (ok) => {
      if (!note) return;
      note.classList.toggle("bad", !ok);
      note.textContent = ok ? _wheelT("Skopiowano do schowka.", "Copied to the clipboard.")
        : _wheelT("Nie udało się skopiować — zaznacz tekst i naciśnij Ctrl+C.",
          "Could not copy — select the text and press Ctrl+C.");
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(() => done(true), () => done(false));
    } else done(false);
  });
}

// OKNO „NAZWA I KATEGORIA". Kategoria jest polem z podpowiedziami (datalist), a nie listą do
// wyboru: lista zamknięta zmusza do wciśnięcia własnego porządku w cudze szufladki, a puste pole
// bez podpowiedzi kończy się piętnastoma kategoriami po jednym presecie.
function _whNameDlg(o) {
  _whDlg(o.title, (body, foot, close) => {
    if (o.note) {
      const p = document.createElement("p"); p.className = "wh-dlg-note"; p.textContent = o.note;
      body.appendChild(p);
    }
    const mk = (labelTx, val, ph, list) => {
      const row = document.createElement("label"); row.className = "wh-dlg-row";
      const sp = document.createElement("span"); sp.className = "wh-dlg-fl"; sp.textContent = labelTx;
      const inp = document.createElement("input");
      inp.type = "text"; inp.className = "wh-dlg-in"; inp.value = val || ""; inp.placeholder = ph || "";
      if (list) inp.setAttribute("list", list);
      row.appendChild(sp); row.appendChild(inp); body.appendChild(row);
      return inp;
    };
    const nm = mk(_wheelT("Nazwa", "Name"), o.name, _wheelT("np. Elden Ring", "e.g. Elden Ring"));
    nm.maxLength = 40;
    const dl = document.createElement("datalist");
    dl.id = "whCatList";
    dl.innerHTML = (typeof whPresetCats === "function" ? whPresetCats() : [])
      .map(c => `<option value="${(typeof esc === "function" ? esc : String)(c)}"></option>`).join("");
    body.appendChild(dl);
    const ct = mk(_wheelT("Kategoria", "Category"), o.cat,
      _wheelT("np. Gry", "e.g. Games"), "whCatList");
    ct.maxLength = 24;
    const err = document.createElement("div"); err.className = "wh-dlg-err"; body.appendChild(err);
    const go = () => {
      const name = nm.value.trim();
      if (!name) { err.textContent = _wheelT("Podaj nazwę.", "Give it a name."); nm.focus(); return; }
      o.onOk(name, ct.value.trim(), (msg) => { err.textContent = msg; }, close);
    };
    nm.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); go(); } });
    ct.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); go(); } });
    foot.appendChild(_whBtn(_wheelT("Anuluj", "Cancel"), "", close));
    const sp = document.createElement("span"); sp.style.flex = "1"; foot.appendChild(sp);
    foot.appendChild(_whBtn(o.ok, "primary", go));
    setTimeout(() => { try { nm.focus(); nm.select(); } catch (e) {} }, 30);
  });
}

// ------------------------------------------------------------------------------------------
//  WYMIANA PRESETÓW NA FORUM #zestawy
// ------------------------------------------------------------------------------------------
// JEDNO OZNACZONE MIEJSCE, a nie „gdzieś w internecie": forum ma tag „🎡 Koło wyboru", więc cudze
// koła da się znaleźć jednym filtrem, zamiast czytać wszystkie wątki. Kreator przygotowuje wpis
// tak, żeby zostało wyłącznie wklejenie: tytuł osobno, treść osobno, tagi do odklikania wypisane
// z emoji dokładnie tak, jak wyglądają na forum.
function whPresetShare(p) {
  if (!p || !p.config) return;
  // Dziedziny (jedna, czasem dwie) wybiera człowiek — aplikacja nie wie, czy to koło jest do
  // grania, czy do majsterkowania. Moduł jest jeden i nie podlega dyskusji, bo wynika z pliku.
  const picked = [];
  _whDlg(_wheelT("Podziel się presetem koła", "Share this wheel preset"), (body, foot, close) => {
    const intro = document.createElement("p");
    intro.className = "wh-dlg-note";
    intro.textContent = _wheelT(
      "Wpis powstaje tutaj, a publikujesz go sam ze swojego konta — wtedy odpowiedzi trafiają do Ciebie. Zaznacz, do czego to koło jest, skopiuj tytuł i treść, a potem otwórz forum.",
      "The post is prepared here and you publish it yourself, from your own account — that way the replies reach you. Tick what this wheel is for, copy the title and the body, then open the forum.");
    body.appendChild(intro);

    const tagLab = document.createElement("div");
    tagLab.className = "wh-dlg-fl2";
    tagLab.textContent = _wheelT("Tagi do zaznaczenia na forum:", "Tags to tick on the forum:");
    body.appendChild(tagLab);
    const row = document.createElement("div"); row.className = "wh-dlg-chips"; body.appendChild(row);
    // Tag modułu stoi pierwszy i jest WŁĄCZONY NA STAŁE: to on decyduje, czy ktoś w ogóle znajdzie
    // ten wpis, szukając kół. Reszta to dziedziny z listy forum (rf-39g), do odklikania.
    const fixed = document.createElement("span");
    fixed.className = "wh-dlg-chip is-fixed";
    fixed.textContent = _whTagLabel(WH_TAG_MOD);
    fixed.title = _wheelT("Ten tag jest zawsze — po nim znajduje się presety kół",
      "This tag is always on — it is how wheel presets are found");
    row.appendChild(fixed);
    const doms = (typeof RFS_DOMAINS !== "undefined" && RFS_DOMAINS) ? RFS_DOMAINS : [];
    doms.forEach(d => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "wh-dlg-chip";
      b.textContent = (d.e + " " + d.n).trim();
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", () => {
        const i = picked.indexOf(d.n);
        if (i >= 0) picked.splice(i, 1); else picked.push(d.n);
        b.classList.toggle("on", i < 0);
        b.setAttribute("aria-pressed", i < 0 ? "true" : "false");
        redraw();
      });
      row.appendChild(b);
    });

    const why = document.createElement("textarea");
    why.className = "wh-dlg-why";
    why.rows = 2;
    why.placeholder = _wheelT("Dwa zdania od siebie: do czego to koło jest i jak się nim gra (opcjonalnie).",
      "A couple of sentences of your own: what this wheel is for and how it plays (optional).");
    why.addEventListener("input", redraw);
    body.appendChild(why);

    const tLab = document.createElement("div");
    tLab.className = "wh-dlg-fl2"; tLab.textContent = _wheelT("Tytuł wątku:", "Thread title:");
    body.appendChild(tLab);
    const tIn = document.createElement("input");
    tIn.type = "text"; tIn.className = "wh-dlg-in"; tIn.readOnly = true;
    body.appendChild(tIn);

    const bLab = document.createElement("div");
    bLab.className = "wh-dlg-fl2"; bLab.textContent = _wheelT("Treść wpisu:", "Post body:");
    body.appendChild(bLab);
    const ta = document.createElement("textarea");
    ta.className = "wh-dlg-ta"; ta.spellcheck = false; ta.readOnly = true;
    ta.setAttribute("aria-label", _wheelT("Treść wpisu", "Post body"));
    body.appendChild(ta);
    const err = document.createElement("div"); err.className = "wh-dlg-err"; body.appendChild(err);

    function redraw() {
      const post = whPresetPost(p, picked, why.value.trim());
      tIn.value = post.title;
      ta.value = post.body;
      // DŁUGOŚĆ POSTA to jedyna rzecz, która potrafi zepsuć ten wpis po cichu: powyżej limitu klient
      // Discorda zamienia wklejoną treść w załącznik message.txt, więc czytający dostaje plik
      // tekstowy zamiast opisu i presetu w bloku kodu — i nigdy się nie dowie, czemu nie wchodzi.
      if (post.body.length > WH_POST_MAX) {
        err.classList.add("bad");
        err.textContent = _wheelT(
          "Wpis ma " + post.body.length + " znaków, a Discord przyjmuje " + WH_POST_MAX
          + ". Skróć opis albo dołącz preset jako plik (przycisk niżej) i zostaw w treści sam opis.",
          "The post is " + post.body.length + " characters and Discord accepts " + WH_POST_MAX
          + ". Shorten the description, or attach the preset as a file (the button below) and leave only the description in the body.");
      } else { err.classList.remove("bad"); err.textContent = ""; }
    }
    redraw();

    foot.appendChild(_whCopyBtn(() => tIn.value, err, _wheelT("Kopiuj tytuł", "Copy the title")));
    foot.appendChild(_whCopyBtn(() => ta.value, err, _wheelT("Kopiuj treść", "Copy the body")));
    foot.appendChild(_whBtn(_wheelT("Pobierz plik", "Download the file"), "",
      () => whPresetDownload(p)));
    const sp = document.createElement("span"); sp.style.flex = "1"; foot.appendChild(sp);
    // TE SAME SŁOWA, CO W KROKU „PODGLĄD" KREATORA ZESTAWÓW (rf-39f): nazwa kanału w etykiecie, bo
    // „forum" nie mówi, DOKĄD się wychodzi, a forów jest na tym serwerze cztery — i zaraz pod
    // przyciskiem to samo zdanie o zaproszeniu, bo odnośnik do kanału nie prowadzi donikąd u kogoś,
    // kto na serwerze jeszcze nie jest. Okna zostają dwoma oknami; wspólne są słowa.
    foot.appendChild(_whBtn(_wheelT("Otwórz " + RF_FORUM_NAME + " ↗", "Open " + RF_FORUM_NAME + " ↗"),
      "primary", () => {
      try { window.open(RF_FORUM_URL, "_blank", "noopener"); } catch (e) {}
    }));
    // `.rfs-hint-add` jest `flex:1 0 100%`, więc w stopce (flex z zawijaniem) siada własnym wierszem
    // POD przyciskami — dokładnie tam, gdzie stoi w kreatorze.
    const join = document.createElement("p");
    join.className = "rfs-hint-add"; join.style.margin = "2px 0 0";
    join.appendChild(document.createTextNode(
      _wheelT("Nie jesteś jeszcze na serwerze? ", "Not on the server yet? ")));
    const jLink = document.createElement("a");
    jLink.href = RF_INVITE_SHARE; jLink.target = "_blank"; jLink.rel = "noopener noreferrer";
    jLink.className = "rfs-invite";
    jLink.textContent = _wheelT("Dołącz zaproszeniem ↗", "Join with the invite ↗");
    join.appendChild(jLink);
    foot.appendChild(join);
  });
}

// Tag z emoji tak, jak wygląda na forum. Emoji bierzemy z jednej, wspólnej mapy w rf-39g — dwie
// listy tagów w jednej aplikacji rozjechałyby się przy pierwszej zmianie na serwerze.
function _whTagLabel(n) {
  const e = (typeof rfPostTagEmoji === "function") ? rfPostTagEmoji(n) : "";
  return (e + " " + n).trim();
}

// TREŚĆ WPISU. Kształt przepisany z kreatora zestawów (rfPostCompose w rf-39g): najpierw słowa
// autora, potem oznaczone wiersze z faktami, na końcu jak to wczytać. Różnica jest jedna i wynika
// z wielkości pliku — preset jedzie W TREŚCI, w bloku kodu, więc czytający nie musi niczego
// pobierać.
function whPresetPost(p, picked, why) {
  const cfg = p.config || {};
  const L = [];
  if (why) { L.push(why); L.push(""); }
  if (p.category) L.push(_wheelT("🎯 **Do czego:** ", "🎯 **What for:** ") + p.category);
  const doms = (picked || []).map(_whTagLabel);
  if (doms.length) L.push(_wheelT("🏷️ **Zastosowanie:** ", "🏷️ **Use:** ") + doms.join(" · "));
  L.push(_wheelT("🧩 **Moduły:** ", "🧩 **Modules:** ") + _whTagLabel(WH_TAG_MOD));
  L.push(_wheelT("🍰 **Koło:** ", "🍰 **The wheel:** ") + _whPresetLine(cfg));
  L.push(_wheelT(
    "ℹ️ **Po wczytaniu:** akcje wycinków to zwykłe skróty klawiszowe — sprawdź je u siebie, bo w Twojej grze mogą znaczyć co innego.",
    "ℹ️ **After loading:** the slices' actions are ordinary keyboard shortcuts — check them on your side, they may mean something else in your game."));
  L.push("");
  L.push(_wheelT(
    "📎 Preset jest w bloku niżej. Wczytasz go w RibbitFlip: moduł „Koło wyboru”, zakładka „Konfiguracja”, sekcja „Zapis”, przycisk „Importuj JSON” — wyląduje w zakładce „Biblioteka”.",
    "📎 The preset is in the block below. Load it in RibbitFlip: the “Koło wyboru” tab, the “Zapis” section, the “Importuj JSON” button — it lands in “My presets”."));
  L.push("```json");
  // Ta sama koperta, co w pliku do pobrania: kto skopiuje blok do pliku i upuści go na okno,
  // ma trafić tą samą drogą, co ten, kto pobrał załącznik. Bez `kind` trafiał w gałąź zestawu.
  L.push(JSON.stringify(whPresetEnvelope(p), null, 1));
  L.push("```");
  return { title: _wheelT("Preset koła: ", "Wheel preset: ") + (p.name || "?"), body: L.join("\n") };
}

// Jedno zdanie o samym kole — te fakty, po których widać, czy warto wchodzić w wątek: ile
// wycinków, jak się je wybiera, czy ma podmenu i jak duże jest na ekranie.
// ⚠️ Ta forma („4 wycinki (+3 w podmenu)") jest od 2026-09-02 formą CAŁEGO modułu: składa ją
// `whCountLabel` w rf-46b i mówi nią też pas kafli, okna z pytaniem i Biblioteka (audyt UX #31).
// Wcześniej stała tutaj własna kopia, a przy okazji jedyna — i po angielsku zostawała po polsku,
// bo `_whWycinki` odmienia wyłącznie po polsku.
function _whPresetLine(cfg) {
  const n = _whPresetCount(cfg.slices || []);
  const top = (cfg.slices || []).length;
  const m = WHEEL_MODES.filter(x => x[0] === (cfg.confirm || "release"))[0];
  const parts = [whCountLabel(cfg.slices || [])];
  if (m) parts.push(_wheelT(m[1], m[2]));
  const sub = WHEEL_SUB.filter(x => x[0] === cfg.submenuMode)[0];
  if (sub && n > top) parts.push(_wheelT(sub[1], sub[2]));
  parts.push(Math.round(wheelLook(cfg.look).size) + " px");
  return parts.join(" · ");
}

// KOPERTA. Do 2026-08-31 preset koła wychodził z aplikacji jako goły `{name, category, config}` —
// bez `app` i bez `kind`. Skutek zmierzony tego dnia: plik pobrany z aplikacji upuszczony z powrotem
// na jej okno wpadał w gałąź ZESTAWU (bo ma `config`), przechodził podgląd bezpieczeństwa, który
// mówił „bezpieczne, 0 reguł", i kończył komunikatem „Pusty lub nieznany zestaw". Jedyną drogą
// powrotu było wklejenie treści w zakładce koła — o czym wiedział ten, kto doczytał post do końca.
// Koperta jest tym, po czym sniffer rozpoznaje rodzaj (rf-49-kinds `env`), więc jej brak był
// wyłączeniem koła ze wspólnych drzwi. Kolejność kluczy: `app` i `kind` PRZED treścią, tak jak
// w każdej innej kopercie tej aplikacji.
function whPresetEnvelope(p) {
  return Object.assign({
    app: "ribbitflip", kind: "wheel-preset",
    appVersion: (typeof window !== "undefined" && window.RIBBITFLIP_VERSION) || ""
  }, p || {});
}

// Preset jako plik — dla kół, które nie mieszczą się w treści posta, i dla każdego, kto woli
// załącznik. Nazwa pliku w tej samej rodzinie, co reszta plików aplikacji („ribbitflip-…").
function whPresetDownload(p) {
  try {
    const base = (typeof rfSetupFileBase === "function") ? rfSetupFileBase(p.name || "kolo")
      : String(p.name || "kolo").replace(/[^\w-]+/g, "-").toLowerCase();
    const blob = new Blob([JSON.stringify(whPresetEnvelope(p), null, 2)],
      { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = "ribbitflip-kolo-" + base + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => { URL.revokeObjectURL(url); }, 1500);
    whToast(_wheelT("Pobrano preset: " + p.name, "Preset downloaded: " + p.name));
  } catch (e) {
    whToast(_wheelT("Nie udało się zapisać pliku.", "Could not write the file."), true);
  }
}
