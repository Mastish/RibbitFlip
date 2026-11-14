// ===== UX 261120 L1: mechanizm pięter =====
// Trzy piętra widoczności (spec „mniej naraz”): 1 na co dzień (karta, jedna akcja `.rf-cta`),
// 2 „Ustawiasz raz” (zwinięty `details.cardfold` z bieżącymi wartościami w nagłówku),
// 3 „Dla dociekliwych” (`details.cardfold.adv`, jeden na ekran, na dole).
//
// rfTier(details, klucz, opcje) robi z istniejącego zwijaka piętro 2 albo 3:
//   · podsumowanie w nagłówku (`.cardfold-sum`): `sum()` modułu albo liczone z kontrolek w środku
//     (etykieta + wartość, skrót do ok. 60 znaków; kontrolki z `data-sum`, jeśli są, inaczej wszystkie
//     widoczne);
//   · licznik „zmienione: N” (`.cardfold-chg`, musztarda), gdy wartości różnią się od domyślnych:
//     `changed()` modułu albo porównanie kontrolek z `def()` (po id), `data-def` lub domyślnymi
//     z HTML (`data-def=""` = atrybut value/checked/selected);
//   · „Przywróć domyślne” w środku, tylko gdy moduł poda `reset()`, zawsze przez rfUndo;
//   · pamięć otwarcia przez rfFold (klucz `ribbitflip.fold.<klucz>`), preferencja
//     „Rozwijaj wszystkie ustawienia” (`ribbitflip.foldAll`).
// Zwinięty zwijak ze zmianami NIE otwiera się sam. Przy pierwszym wejściu w sesji licznik tylko
// mignie (`.rf-tier-ping`), żeby schowana zmiana nie umknęła.
(function () {
  "use strict";
  const T = function (pl, en) { return (typeof _lang !== "undefined" && _lang === "en") ? en : pl; };
  const LS_ALL = "ribbitflip.foldAll";
  const SUM_MAX = 60;
  const TIERS = new Set();

  function foldAllOn() { try { return localStorage.getItem(LS_ALL) === "1"; } catch (e) { return false; } }
  window.rfFoldAllOn = foldAllOn;

  // ---------- kontrolki w zwijaku ----------
  const CTRL = "input:not([type=hidden]):not([type=button]):not([type=submit]):not([type=file]),select,textarea,.seg,[role=switch]";
  function bodyOf(det) { return det.querySelector(":scope>.cardfold-body") || det; }
  // Widoczna = żaden przodek do zwijaka nie ma display:none ani hidden. Zamknięty <details> nie
  // zmienia `display` dzieci, więc liczy się też to, co schowane tylko zwinięciem.
  function shown(el, det) {
    for (let n = el; n && n !== det; n = n.parentElement) {
      if (n.hidden) return false;
      if (n.style && n.style.display === "none") return false;
      if (getComputedStyle(n).display === "none") return false;
    }
    return true;
  }
  function controls(det) {
    const out = [];
    for (const el of bodyOf(det).querySelectorAll(CTRL)) {
      if (el.closest(".cardfold-foot")) continue;
      const inner = el.closest("details.cardfold");
      if (inner && inner !== det) continue;               // zagnieżdżony zwijak ma własny nagłówek
      if (el.matches("input,select,textarea") && el.closest(".seg")) continue;
      if (!shown(el, det)) continue;
      out.push(el);
    }
    return out;
  }
  function valueOf(el) {
    if (el.classList.contains("seg")) { const b = el.querySelector("button.on"); return b ? (b.dataset.v != null ? b.dataset.v : b.textContent.trim()) : ""; }
    if (el.getAttribute("role") === "switch") return el.getAttribute("aria-checked") === "true";
    if (el.type === "checkbox" || el.type === "radio") return !!el.checked;
    return el.value;
  }
  function htmlDefault(el) {
    if (el.type === "checkbox" || el.type === "radio") return !!el.defaultChecked;
    if (el.tagName === "SELECT") { const o = Array.from(el.options).find(function (x) { return x.defaultSelected; }) || el.options[0]; return o ? o.value : ""; }
    if ("defaultValue" in el) return el.defaultValue;
    return undefined;
  }
  function defOf(el, defs) {
    if (defs && el.id && Object.prototype.hasOwnProperty.call(defs, el.id)) return defs[el.id];
    if (el.hasAttribute("data-def")) { const v = el.getAttribute("data-def"); return v === "" ? htmlDefault(el) : v; }
    return undefined;
  }
  function same(a, b) {
    if (typeof a === "boolean" || typeof b === "boolean") {
      const bo = function (v) { return v === true || v === 1 || /^(1|true|on|yes)$/i.test(String(v)); };
      return bo(a) === bo(b);
    }
    const na = parseFloat(a), nb = parseFloat(b);
    if (String(a).trim() !== "" && String(b).trim() !== "" && isFinite(a) && isFinite(b)) return Math.abs(na - nb) < 1e-9;
    return String(a) === String(b);
  }

  // ---------- etykieta i wartość do podsumowania ----------
  const SKIP_TX = "input,select,textarea,small,.vnum,.seg,.mscale-ends,.cardfold-sum,.cardfold-chg,button,.rfic,.ra-ic";
  function ownText(node) {
    let s = "";
    for (const c of node.childNodes) {
      if (c.nodeType === 3) s += c.nodeValue;
      else if (c.nodeType === 1 && !c.matches(SKIP_TX)) s += ownText(c);
    }
    return s;
  }
  function tidyLabel(s) {
    return String(s || "").replace(/\s+/g, " ").replace(/\s*\([^)]*\)/g, "").replace(/[:·—–-]\s*$/, "").trim();
  }
  function labelOf(el) {
    let s = el.getAttribute("aria-label") || "";
    if (!s && el.id) { const l = document.querySelector('label[for="' + el.id + '"]'); if (l) s = ownText(l); }
    if (!s) { const l = el.closest("label,.fld"); if (l) s = ownText(l.querySelector(".rf-swrow-tx") || l); }
    return tidyLabel(s);
  }
  function shownValue(el) {
    if (el.classList.contains("seg")) { const b = el.querySelector("button.on"); return b ? b.textContent.trim() : ""; }
    const v = valueOf(el);
    if (typeof v === "boolean") return v ? T("tak", "yes") : T("nie", "no");
    if (el.tagName === "SELECT") {
      const o = el.options[el.selectedIndex];
      return o ? tidyLabel(o.textContent.replace(/^[^\p{L}\p{N}]+/u, "")) : "";
    }
    const host = el.closest("label,.fld,.mscale") || el.parentElement;
    const vn = host && host.querySelector(".vnum");
    if (vn && vn.textContent.trim() && vn.textContent.trim() !== "—") return vn.textContent.trim();
    let s = String(v);
    if (T("pl", "en") === "pl") s = s.replace(".", ",");
    return s;
  }
  function autoSum(det) {
    let list = controls(det);
    const marked = list.filter(function (el) { return el.hasAttribute("data-sum"); });
    if (marked.length) list = marked;
    const parts = [];
    for (const el of list) {
      const lb = labelOf(el), v = shownValue(el);
      if (!lb && !v) continue;
      const word = (el.tagName === "SELECT" || el.classList.contains("seg") || typeof valueOf(el) === "boolean") ? lb + ": " + v : (lb + " " + v).trim();
      parts.push(parts.length ? word.charAt(0).toLowerCase() + word.slice(1) : word);
    }
    return clip(parts.join(" · "));
  }
  function clip(s) {
    s = String(s || "");
    if (s.length <= SUM_MAX) return s;
    const cut = s.slice(0, SUM_MAX), at = cut.lastIndexOf(" · ");
    return (at > 20 ? cut.slice(0, at) : cut.replace(/\s+\S*$/, "")) + " …";
  }
  function autoChanged(det, defs) {
    let n = 0;
    for (const el of controls(det)) {
      const d = defOf(el, defs);
      if (d === undefined) continue;
      if (!same(valueOf(el), d)) n++;
    }
    return n;
  }
  function titleOf(det) {
    const sm = det.querySelector(":scope>summary");
    return sm ? tidyLabel(ownText(sm)) : "";
  }

  // ---------- migawka do „Cofnij”, gdy moduł nie podał własnej ----------
  function autoTake(det) {
    return controls(det).map(function (el) { return { el: el, v: valueOf(el) }; });
  }
  function autoRestore(snap) {
    for (const s of snap || []) {
      const el = s.el;
      if (!el || !el.isConnected) continue;
      if (el.classList.contains("seg")) {
        const b = Array.from(el.querySelectorAll("button")).find(function (x) { return (x.dataset.v != null ? x.dataset.v : x.textContent.trim()) === s.v; });
        if (b && !b.classList.contains("on")) b.click();
        continue;
      }
      if (el.getAttribute("role") === "switch") { if ((el.getAttribute("aria-checked") === "true") !== !!s.v) el.click(); continue; }
      if (el.type === "checkbox" || el.type === "radio") el.checked = !!s.v; else el.value = s.v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  // ---------- nagłówek: podsumowanie + licznik; stopka z „Przywróć domyślne” ----------
  function span(sm, cls) {
    let s = sm.querySelector(":scope>." + cls);
    if (!s) { s = document.createElement("span"); s.className = cls; s.setAttribute("data-noi18n", ""); sm.appendChild(s); }
    return s;
  }
  function paint(det) {
    const t = det._rfTier; if (!t) return 0;
    const o = t.opt, sm = det.querySelector(":scope>summary");
    if (!sm) return 0;
    let n = 0;
    try { n = (typeof o.changed === "function") ? (+o.changed() || 0) : autoChanged(det, (typeof o.def === "function") ? o.def() : null); } catch (e) { n = 0; }
    if (!t.adv) {
      let s = "";
      try { s = (typeof o.sum === "function") ? clip(o.sum()) : autoSum(det); } catch (e) { s = ""; }
      const ss = span(sm, "cardfold-sum");
      if (ss.textContent !== s) ss.textContent = s;
      ss.hidden = !s;
    }
    // Licznik stoi zaraz za nazwą, przed wartościami: przy wąskiej karcie to wartości się zawijają.
    const chg = span(sm, "cardfold-chg");
    const ss0 = sm.querySelector(":scope>.cardfold-sum");
    if (ss0 && chg.nextSibling !== ss0) sm.insertBefore(chg, ss0);
    const ct = n > 0 ? T("zmienione: ", "changed: ") + n : "";
    if (chg.textContent !== ct) chg.textContent = ct;
    chg.hidden = !(n > 0);
    det.classList.toggle("is-changed", n > 0);
    if (t.btn) {
      const tx = T("Przywróć domyślne", "Restore defaults");
      if (t.btn.textContent !== tx) t.btn.textContent = tx;
      t.btn.disabled = !(n > 0);
      // Dymek tylko przy zmianie treści: rf-05 przenosi `title` do `data-rftip`, więc stałe
      // przypisanie co 1,5 s budziłoby go bez potrzeby.
      const tip = n > 0 ? T("Ustawia wartości z tego bloku na domyślne. Da się cofnąć.", "Sets the values in this block back to the defaults. You can undo it.")
                        : T("Wszystko tutaj ma wartości domyślne", "Everything here is at the defaults");
      if (t.btn._tip !== tip) { t.btn._tip = tip; t.btn.title = tip; if (t.btn.hasAttribute("data-rftip")) t.btn.setAttribute("data-rftip", tip); }
    }
    t.n = n;
    return n;
  }
  function doReset(det) {
    const t = det._rfTier; if (!t || typeof t.opt.reset !== "function") return;
    const o = t.opt, own = typeof o.take === "function" && typeof o.restore === "function";
    const name = titleOf(det);
    const run = function () { o.reset(); paint(det); };
    if (typeof window.rfUndo !== "function") { run(); return; }
    window.rfUndo({
      msg: T("Przywrócono domyślne: ", "Defaults restored: ") + name,
      take: own ? o.take : function () { return autoTake(det); },
      clone: own ? undefined : false,
      run: run,
      restore: function (s) { (own ? o.restore : autoRestore)(s); paint(det); }
    });
  }

  // Pierwsze wejście na ekran w tej sesji: zwijak zostaje zwinięty, licznik raz miga.
  const _io = (typeof IntersectionObserver === "function") ? new IntersectionObserver(function (ents) {
    for (const e of ents) {
      if (!e.isIntersecting) continue;
      const det = e.target.parentElement, t = det && det._rfTier;
      _io.unobserve(e.target);
      if (!t) continue;
      const k = "ribbitflip.tierSeen." + t.key;
      let seen = false; try { seen = sessionStorage.getItem(k) === "1"; sessionStorage.setItem(k, "1"); } catch (er) { }
      if (seen || det.open || !(paint(det) > 0)) continue;
      det.classList.add("rf-tier-ping");
      setTimeout(function () { det.classList.remove("rf-tier-ping"); }, 2400);
    }
  }) : null;

  window.rfTier = function (det, key, opt) {
    opt = opt || {};
    if (!det) { const f = function () { return 0; }; f.count = f; return f; }
    const adv = !!opt.adv || det.classList.contains("adv");
    if (adv) det.classList.add("adv");
    if (!det._rfTier) {
      det._rfTier = { key: String(key || det.id || "bez-klucza"), opt: opt, adv: adv, btn: null, n: 0 };
      if (typeof window.rfFold === "function") window.rfFold(det, det._rfTier.key);
      else if (foldAllOn()) det.open = true;
      det.addEventListener("input", function () { schedule(det); });
      det.addEventListener("change", function () { schedule(det); });
      det.addEventListener("click", function (e) { if (e.target.closest(".seg button,[role=switch]")) schedule(det); });
      det.addEventListener("toggle", function () { paint(det); });
      const sm = det.querySelector(":scope>summary");
      if (sm && _io) _io.observe(sm);
      TIERS.add(det);
    } else {
      det._rfTier.opt = opt; det._rfTier.adv = adv;
    }
    const t = det._rfTier;
    if (typeof opt.reset === "function" && !t.btn) {
      const foot = document.createElement("div"); foot.className = "cardfold-foot";
      const b = document.createElement("button"); b.type = "button"; b.className = "btn sm cardfold-reset";
      b.setAttribute("data-noi18n", "");
      b.addEventListener("click", function (e) { e.preventDefault(); doReset(det); });
      foot.appendChild(b); bodyOf(det).appendChild(foot); t.btn = b;
    }
    paint(det);
    const sync = function () { return paint(det); };
    sync.count = function () { return t.n; };
    return sync;
  };
  function schedule(det) {
    if (det._rfTierRaf) return;
    det._rfTierRaf = requestAnimationFrame(function () { det._rfTierRaf = 0; paint(det); });
  }

  // Wszystkie: przelicz zarejestrowane (np. po wczytaniu konfiguracji z serwera).
  window.rfTier.sync = function () { TIERS.forEach(function (d) { if (d.isConnected) paint(d); }); };
  window.rfTier.foldAll = foldAllOn;
  // Dla modułów, które liczą „zmienione” ze swojego stanu: czy kontrolka jest widoczna w zwijaku
  // (nie licząc samego zwinięcia) i porównanie wartości jak w liczniku automatycznym.
  window.rfTier.shown = function (el, det) { return !!el && shown(el, det || el.closest("details.cardfold")); };
  window.rfTier.same = same;
  window.rfTier.setFoldAll = function (on) {
    try { localStorage.setItem(LS_ALL, on ? "1" : "0"); } catch (e) { }
    for (const d of document.querySelectorAll("details.cardfold")) {
      if (on) { if (!d.open) { d._rfAllOpened = true; d.open = true; } d._rfAllDone = true; continue; }
      // Wyłączenie wraca do zapamiętanego układu: rfFold ma stan w localStorage, resztę
      // otworzyła ta preferencja, więc ją zamyka.
      let v = null; try { v = d._rfFoldLS ? localStorage.getItem(d._rfFoldLS) : null; } catch (e) { }
      if (v === "1" || v === "0") d.open = (v === "1");
      else if (d._rfAllOpened) d.open = false;
      d._rfAllOpened = false; d._rfAllDone = false;
    }
  };
  // Pomiar piętra 1 dla ekranu (`root` = panel zakładki): akcje `.rf-cta`, wszystkie różowe
  // przyciski i kontrolki w pierwszym widoku. Zamknięte zwijaki się nie liczą.
  // L4e: Chrome trzyma treść zamkniętego <details> w układzie (content-visibility), więc
  // offsetParent i prostokąt jej kontrolek są niezerowe. Liczy się tylko nagłówek zamkniętego zwijaka.
  function folded(el) {
    for (let d = el.closest("details:not([open])"); d; d = d.parentElement && d.parentElement.closest("details:not([open])")) {
      const sm = d.querySelector(":scope>summary");
      if (!(sm && sm.contains(el))) return true;
    }
    return false;
  }
  window.rfTier.audit = function (root) {
    root = root || document.body;
    const vis = function (el) { if (!el.offsetParent && getComputedStyle(el).position !== "fixed") return false; if (folded(el)) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const all = Array.from(root.querySelectorAll("button,input:not([type=hidden]),select,textarea,a[href],summary,[role=switch],[role=button]")).filter(vis);
    const top = root.getBoundingClientRect().top;
    const first = all.filter(function (el) { const r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > Math.max(0, top); });
    const folds = Array.from(root.querySelectorAll("details.cardfold")).map(function (d) {
      const t = d._rfTier;
      return { id: d.id || "", key: t ? t.key : "", title: titleOf(d), adv: d.classList.contains("adv"), open: d.open,
        changed: t ? t.n : null, sum: ((d.querySelector(":scope>summary>.cardfold-sum") || {}).textContent || "") };
    });
    return { cta: all.filter(function (el) { return el.classList.contains("rf-cta"); }).length,
      pink: all.filter(function (el) { return el.matches("button.btn.primary,button.btn.rf-cta,a.btn.primary"); }).length,
      firstView: first.length, folds: folds };
  };

  // Odświeżanie: echo konfiguracji z serwera wpisuje wartości bez zdarzeń, więc co 1,5 s
  // przeliczamy widoczne zwijaki; przy „Rozwijaj wszystkie” otwieramy też nowe zwijaki
  // narysowane po starcie (raz każdy, potem decyduje człowiek).
  setInterval(function () {
    TIERS.forEach(function (d) {
      if (!d.isConnected) { d._rfTierMiss = (d._rfTierMiss || 0) + 1; if (d._rfTierMiss > 20) TIERS.delete(d); return; }
      d._rfTierMiss = 0;
      if (d.offsetParent !== null) paint(d);
    });
    if (foldAllOn()) for (const d of document.querySelectorAll("details.cardfold")) {
      if (d._rfAllDone) continue;
      d._rfAllDone = true;
      if (!d.open) { d._rfAllOpened = true; d.open = true; }
    }
  }, 1500);
  // Zmiana języka: setLang ustawia <html lang>, a etykiety kontrolek tłumaczy walker przed nami.
  try {
    new MutationObserver(function () { window.rfTier.sync(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  } catch (e) { }

  // ---------- Ustawienia › Wygląd panelu: „Rozwijaj wszystkie ustawienia” ----------
  window.initFoldPrefCard = function () {
    const panel = document.getElementById("tab-ustawienia");
    if (!panel || document.getElementById("uiLookCard")) return;
    const card = document.createElement("div"); card.className = "card"; card.id = "uiLookCard";
    card.innerHTML =
      '<div class="head"><h2><span class="rfic hd-ic hd-ic-eye" aria-hidden="true"></span>Wygląd panelu</h2></div>' +
      '<div class="ui-look-body">' +
        '<label class="rf-swrow"><input type="checkbox" class="rf-swi" id="foldAllOn">' +
          '<span class="rf-swrow-tx">Rozwijaj wszystkie ustawienia' +
          '<small>Zwinięte bloki ustawień startują otwarte. Niczego nie dodaje ani nie wyłącza.</small></span></label>' +
      '</div>';
    panel.appendChild(card);
    const sw = card.querySelector("#foldAllOn");
    sw.checked = foldAllOn();
    sw.addEventListener("change", function () { window.rfTier.setFoldAll(sw.checked); });
  };
})();
// (koniec sekcji L1)
