"use strict";
// ==================================================================================================
// „POMOC I SPOŁECZNOŚĆ” W PASKU GÓRNYM (UX 261120 L23, decyzja L-D3)
//
// „Strona projektu” i „Discord” wychodzą z aplikacji i niczym nie sterują, a stały na pasku obok
// stanu sterowania jako dwa jasne przyciski. Teraz to jeden przycisk z filcowym okienkiem, w którym
// stoją oba odnośniki. Na wierzchu paska zostają: stan sterowania, LIVE/Symulacja, Przewodnik i język.
//
// ODNOŚNIKI SĄ PRZENOSZONE, NIE ODTWARZANE: `#siteLink` i `#discordLink` z HTML trafiają do okienka
// z tymi samymi id, adresami (Discord wpisuje rf-34 z RF_INVITE_HEADER) i nazwami dostępnymi.
// Wzorzec ujawniania (przycisk z `aria-expanded` + grupa odnośników), nie `role=menu`: w środku są
// zwykłe odnośniki, a menu wymagałoby obsługi strzałek, której człowiek od odnośników nie oczekuje.
// Esc i klik obok zamykają; po wyborze odnośnika okienko też się zamyka.
//
// KOLEJNOŚĆ STARTU: PO initTour, bo rf-39p wstawia „Przewodnik” przed `#siteLink`, kiedy ten stoi
// jeszcze w pasku. Przycisk staje w miejscu `#siteLink`, czyli między Przewodnikiem a językiem.
// Napisy składa `_gl` (pasek ma `data-noi18n` na przycisku i okienku), więc zmiana języka
// przerysowuje je przez obserwatora `lang` na <html>.
// ==================================================================================================
(function (global) {
  const T = (pl, en) => (typeof global._gl === "function" ? global._gl(pl, en) : pl);
  let _btn = null, _pop = null;

  function _paint() {
    if (!_btn) return;
    const lbl = T("Pomoc i społeczność", "Help and community");
    const l = _btn.querySelector(".btn-lbl");
    if (l && l.textContent !== lbl) l.textContent = lbl;
    const tip = T("Pomoc i społeczność: strona projektu i serwer Discord",
                  "Help and community: the project page and the Discord server");
    _btn.setAttribute("aria-label", tip);
    if (_btn.dataset.tip !== tip) { _btn.dataset.tip = tip; _btn.title = tip; }
  }

  function _set(open, focus) {
    if (!_btn || !_pop) return;
    _pop.hidden = !open;
    _btn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open && focus) { const a = _pop.querySelector("a"); if (a) try { a.focus(); } catch (e) { } }
  }

  function initHelpMenu() {
    if (typeof IS_OVERVIEW !== "undefined" && IS_OVERVIEW) return;
    if (document.documentElement.classList.contains("rf-ovl")) return;
    const hdr = document.querySelector("header");
    const site = document.getElementById("siteLink"), dsc = document.getElementById("discordLink");
    if (!hdr || !site || !dsc || document.getElementById("helpBtn")) return;

    const wrap = document.createElement("div");
    wrap.className = "rf-help"; wrap.id = "helpWrap";
    _btn = document.createElement("button");
    _btn.type = "button"; _btn.id = "helpBtn"; _btn.className = "btn rf-help-btn";
    _btn.setAttribute("aria-haspopup", "true");
    _btn.setAttribute("aria-controls", "helpPop");
    _btn.setAttribute("aria-expanded", "false");
    _btn.setAttribute("data-noi18n", "");
    _btn.innerHTML = '<span class="bic bic-site" aria-hidden="true"></span><span class="btn-lbl"></span>' +
                     '<span class="rf-help-chev" aria-hidden="true"></span>';
    _pop = document.createElement("div");
    _pop.className = "rf-help-pop"; _pop.id = "helpPop"; _pop.hidden = true;
    _pop.setAttribute("role", "group");
    _pop.setAttribute("aria-labelledby", "helpBtn");
    hdr.insertBefore(wrap, site);
    wrap.appendChild(_btn);
    wrap.appendChild(_pop);
    _pop.appendChild(site);
    _pop.appendChild(dsc);
    _paint();

    _btn.addEventListener("click", () => _set(_pop.hidden, false));
    _pop.addEventListener("click", e => { if (e.target.closest && e.target.closest("a")) _set(false); });
    wrap.addEventListener("keydown", e => {
      if (e.key !== "Escape" || _pop.hidden) return;
      e.preventDefault(); e.stopPropagation();
      _set(false); try { _btn.focus(); } catch (err) { }
    });
    document.addEventListener("pointerdown", e => {
      if (!_pop.hidden && !wrap.contains(e.target)) _set(false);
    }, true);
    // Fokus wychodzi z okienka klawiszem Tab: okienko się zamyka, żeby nie wisiało nad treścią.
    wrap.addEventListener("focusout", e => {
      if (!_pop.hidden && e.relatedTarget && !wrap.contains(e.relatedTarget)) _set(false);
    });
    try {
      new MutationObserver(_paint).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    } catch (e) { }
  }

  global.initHelpMenu = initHelpMenu;
})(window);
