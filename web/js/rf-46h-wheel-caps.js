"use strict";
// ============================================================================
//  HUB KAPSLI W ZAKŁADCE „KOŁO WYBORU" — czyje koło ustawiasz i co mają pozostałe
//
//  SKĄD TO SIĘ WZIĘŁO. Koło jest ustawiane PER KAPSEL, a karta pokazywała zawsze
//  dokładnie jedno — tego kapsla, który akurat był podświetlony w „Urządzeniach
//  Triki" na samej górze strony. Nic na tej zakładce o tym nie mówiło, więc
//  koło zrobione „dla Triki 3" potrafiło zapisać się Triki 5 (zgłoszone
//  2026-08-28), a na pytanie „co mają pozostałe kapsle" nie było gdzie spojrzeć.
//
//  ODPOWIEDŹ JEST TA SAMA, CO W ZAKŁADCE „KONTROLER" i celowo wygląda tak samo:
//  pas kafli na górze, jeden kafel na kapsel, a pod nim nagłówek nazywający ten
//  jeden, który się właśnie ustawia. Różnica wynika z tego, czym te dwie rzeczy
//  są: kontroler jest bytem wspólnym (kilka kapsli gra na jednym padzie), więc
//  tam kafel to PAD z kapslami w środku. Koło niczego nie dzieli — każdy kapsel
//  ma swoje własne — więc tutaj kafel to KAPSEL, a w nim jego koło.
//
//  KAFEL POKAZUJE KOŁO, NIE OPISUJE GO. Rysunek jest tym samym rendererem, co
//  scena, nakładka i ściąga (wheelIdleState + wheelSvgInto), tylko mały. Spis
//  nazw wycinków odpowiadałby na pytanie „co tam jest", a pytanie na tym pasie
//  brzmi „które z tych kół to to, o którym myślę" — a na nie odpowiada kształt.
//
//  CO TEN PLIK ROBI, A CZEGO NIE. Przełącza edytowany kapsel (klik w kafel albo
//  wybór z listy), włącza i wyłącza koło każdego kapsla i nazywa ten edytowany.
//  Nie edytuje wycinków — od tego jest cała reszta karty pod spodem.
//
//  PO rf-46g (bierze z niego wheelIdleState i _whListMode) i przed rf-40-boot.
// ============================================================================

const RF_WHEELCAPS_I18N = {
  "Kapsle i ich koła": "Capsules and their wheels",
  "kliknij kapsel, żeby ustawiać jego koło": "click a capsule to edit its wheel",
  "Ustawiaj koło kapsla": "Edit the wheel of capsule",
  "Który kapsel ustawiasz": "Which capsule you are editing",
  "ustawiasz teraz": "now editing",
  "Kliknij, aby ustawiać koło tego kapsla": "Click to edit this capsule's wheel",
  "koło wyłączone": "wheel switched off",
  "bez wycinków": "no slices",
  "Dodaj wycinki, zanim włączysz koło": "Add slices before switching the wheel on",
  "Włącz albo wyłącz koło tego kapsla": "Switch this capsule's wheel on or off",
  "wycinek": "slice", "wycinki": "slices", "wycinków": "slices",
};
try { Object.assign(I18N_EN, RF_WHEELCAPS_I18N); } catch (e) { /* i18n jeszcze nie ma — trudno */ }

// Ile pikseli ma koło na kaflu. Poniżej WHEEL_SMALL_PX (rf-46a) rysunek sam zdejmuje z siebie
// ozdobniki i zostawia kształt z nazwami — dokładnie to, co ma tu być widać.
const WH_CAPS_MINI_PX = 128;

// ------------------------------------------------------------------------------------------
//  UKŁAD
// ------------------------------------------------------------------------------------------
// Dwa nagłówki, jak w „Kontrolerze": pierwszy nad pasem („co mają kapsle"), drugi nad kartą
// („który ustawiasz"). Bez tego drugiego pas i karta czytają się jak jedna sekcja i pytanie
// „czyje to teraz ustawienia" znów nie ma odpowiedzi w chwili, w której pas zjedzie do góry.
function wheelCapsHtml() {
  return `<div class="head sub wh-caps-head" id="whCapsHead"><h2>Kapsle i ich koła</h2>
      <select id="whCapsPick" class="wh-caps-pick" title="Który kapsel ustawiasz"
        aria-label="Który kapsel ustawiasz"></select>
      <span class="hint">kliknij kapsel, żeby ustawiać jego koło</span></div>
    <div class="wh-caps" id="whCapsList"></div>`;
  // Paska „Konfiguracja koła: Triki 1” nie ma od UX 261120 (L4e, jak w Skanerze): chip kapsla
  // w nagłówku modułu mówi to samo, a pasek był kolejnym pasem nad sceną.

  // PASEK „Konfiguracja: [nazwa] [zmienione] Zapisz zmiany · Zapisz jako… · Przywróć · Skopiuj na…"
  // STAŁ TUTAJ DO 2026-09-02 (audyt UX #25). Był z czasów, gdy koło jako jedyny moduł miało własną
  // obsługę nazwanych konfiguracji — a odkąd moduł ma wspólną ramkę trzech zakładek (rf-49m), na
  // jednym ekranie stały CZTERY miejsca zapisu i DWA identyczne przyciski „Zapisz zmiany" naraz.
  // Wszystko, co pasek oferował, jest dziś dokładnie raz gdzie indziej i tą samą drogą, co
  // w pozostałych siedmiu modułach:
  //   nazwa i „zmienione"  → pierwsza linia Konfiguracji (blok stanu, rf-49j3)
  //   Zapisz zmiany · Przywróć → przyciski tego bloku (rfCfgIdSaveChanges / rfCfgIdRevert)
  //   Zapisz jako…         → „+ Zapisz obecne jako…" w stopce Biblioteki (rfCfgIdSaveAsNew)
  //   lista konfiguracji   → lista Biblioteki
  //   Skopiuj na…          → „Wczytaj na…" przy pozycji w Bibliotece (adapter.applyPresetOn)
  // Funkcje paska (wheelCfgBarHtml, wheelCfgBarSync, whInitCfgBar i cztery akcje) zniknęły razem
  // z nim; TOŻSAMOŚĆ konfiguracji (whCfgState, whCfgFingerprint, whCfgSetName, whCfgFollowRename)
  // została w rf-46j, bo czytają ją pas kafli, Biblioteka i kropka „zmienione" w nawigacji.
}

function _whCapsT(pl, en) { return (typeof _gl === "function") ? _gl(pl, en) : pl; }

// Kapsle w kolejności slotów — tej samej, w której stoją pigułki u góry strony i kolumny ściągi.
// Trzy różne kolejności tych samych pięciu rzeczy to trzy różne odpowiedzi na „który to drugi".
function _whCapsDevs() {
  return Object.values(state.devices || {})
    .sort((a, b) => ((a.meta || {}).slot || 0) - ((b.meta || {}).slot || 0));
}

function _whCapsName(D) { return ((D.meta || {}).label || (D.meta || {}).name || (D.meta || {}).dev || "?"); }

// Ile wycinków ma koło tego kapsla. Konfiguracja WSZYSTKICH kapsli przychodzi rozgłoszeniem
// `wheel_cfg` (rf-08 → D.wheelCfg), więc pas nie musi o nią pytać po kolei — i dlatego w ogóle
// może pokazać koła, których nikt nie edytuje.
function _whCapsCfg(D) {
  // Kapsel edytowany ma świeższą prawdę w karcie niż w ostatnim pakiecie: suwak przesunięty przed
  // sekundą jeszcze nie wrócił z serwera, a kafel ma pokazywać to, co człowiek właśnie zrobił.
  if (D && D.meta && D.meta.dev === state.wheelDev && state.wheel) return state.wheel;
  return (D && D.wheelCfg) || null;
}

// ILE WYCINKÓW — jedno zdanie w całym module (`whCountLabel` w rf-46b, audyt UX #31, 2026-09-02).
// Kafel liczył sam pierwszy pierścień („4 wycinki"), a kafel presetu i Biblioteka sumę z podmenu
// („7 wycinków") — dwie prawdziwe liczby o jednym kole, na jednym ekranie, obok siebie.
function _whCapsCount(list) {
  const l = Array.isArray(list) ? list : [];
  return (typeof whCountLabel === "function") ? whCountLabel(l) : (l.length + "");
}

// ------------------------------------------------------------------------------------------
//  PAS KAFLI
// ------------------------------------------------------------------------------------------
// PAS TYLKO PRZY DWÓCH I WIĘCEJ KAPSLACH (UX 261120, P-G1-09). Przy jednym kafel powtarza to, co
// mówi chip kapsla w nagłówku modułu, a jego przełącznik to ten sam przełącznik co w nagłówku.
function _whCapsShow(devs) {
  const many = devs.length > 1;
  const h = document.getElementById("whCapsHead"), b = document.getElementById("whCapsList");
  if (h) h.hidden = !many;
  if (b) b.hidden = !many;
}
// Co kafel pokazuje o samym kapslu: nazwa, kolor, obrazek. Nazwa przychodzi z `meta` dopiero po
// pierwszym pakiecie, a kafel narysowany wcześniej mówił „d0” do końca sesji (F-G1-01), bo tanie
// odświeżenie przestawiało tylko klasy. Zmiana tego odcisku = pełne przerysowanie kafla.
function _whCapsLook(D) {
  const m = (D && D.meta) || {};
  return _whCapsName(D || {}) + "|" + (m.color || "") + "|" + (m.cap || "");
}
function wheelCapsRender() {
  const box = document.getElementById("whCapsList");
  if (!box) return;                                   // nakładka/ściąga — karty koła tam nie ma
  const devs = _whCapsDevs();
  _whCapsShow(devs);
  box.innerHTML = "";
  for (const D of devs) {
    const dev = (D.meta || {}).dev;
    const W = _whCapsCfg(D);
    const sl = (W && Array.isArray(W.slices)) ? W.slices : [];
    const active = (dev === (state.activeDeviceId || "d0"));
    const on = !!(W && W.enabled);

    const t = document.createElement("div");
    t.className = "wh-caps-tile" + (active ? " active" : "") + (on ? "" : " off");
    t.dataset.dev = dev;
    t.dataset.look = _whCapsLook(D);
    t.setAttribute("role", "button");
    t.tabIndex = 0;
    t.title = _whCapsT("Kliknij, aby ustawiać koło tego kapsla", "Click to edit this capsule's wheel");
    t.style.setProperty("--dcol", ((D.meta || {}).color) || "#8aa0b5");

    const head = document.createElement("div");
    head.className = "wh-caps-th";
    head.innerHTML = (typeof capImgSpan === "function" ? capImgSpan(dev, 18) : "")
      + "<b>" + esc(_whCapsName(D)) + "</b>"
      + (active ? '<span class="wh-caps-badge">' + esc(_whCapsT("ustawiasz teraz", "now editing")) + "</span>" : "");
    t.appendChild(head);

    // RYSUNEK ALBO ZDANIE, NIGDY PUSTE MIEJSCE. Kapsel bez wycinków jest tu równie ważny jak ten
    // z kołem — to on jest odpowiedzią na „czemu nic się nie dzieje", więc mówi o sobie wprost.
    const mini = document.createElement("div");
    mini.className = "wh-caps-mini";
    if (sl.length >= WHEEL_MIN_SLICES) {
      mini.dataset.dev = dev;
    } else {
      mini.classList.add("empty");
      mini.textContent = _whCapsT("bez wycinków", "no slices");
    }
    t.appendChild(mini);

    // CO TEN KAPSEL MA NA SOBIE — nazwa konfiguracji i to, czy jest jeszcze taka, jak zapisana
    // (rf-46j). To jest odpowiedź na „które kapsle mają Multimedia", której w aplikacji nie było.
    const cfg = document.createElement("div");
    cfg.className = "wh-caps-cfg";
    t.appendChild(cfg);

    const foot = document.createElement("div");
    foot.className = "wh-caps-tf";
    const mode = document.createElement("span");
    mode.className = "wh-caps-mode";
    mode.textContent = (W && typeof _whListMode === "function") ? _whListMode(W.confirm) : "—";
    const cnt = document.createElement("span");
    cnt.className = "wh-caps-cnt";
    cnt.textContent = _whCapsCount(sl);
    foot.appendChild(mode);
    foot.appendChild(cnt);
    t.appendChild(foot);

    t.appendChild(_whCapsSwitch(dev, W, sl.length));

    // ⚠️ UCHWYT NIE MOŻE PAMIĘTAĆ, KTO BYŁ EDYTOWANY W CHWILI RYSOWANIA. Kafle są przerysowywane
    // rzadko — tanie odświeżenie (wheelCapsSync) przestawia same klasy i teksty, a domknięcie
    // zostaje to samo. Warunek `!active` zapisany tutaj zamrażał więc odpowiedź sprzed przełączenia:
    // kafel kapsla, który BYŁ edytowany przy pierwszym rysowaniu (czyli pierwszy w pasie), po
    // przejściu na inny kapsel przestawał reagować na klik — jego domknięcie nadal uważało, że
    // jest edytowany. Zgłoszone: „klikanie na 1 nie działa".
    // Własnego warunku nie potrzeba: switchDevice sam wychodzi, gdy trafi na kapsel już aktywny.
    const open = () => { if (typeof switchDevice === "function") switchDevice(dev); };
    t.onclick = e => { if (e.target && e.target.closest && e.target.closest(".rf-toggle")) return; open(); };
    t.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } };
    box.appendChild(t);
  }
  _whCapsPickRender(devs);
  _whCapsCfgSync();
  wheelCapsDraw(true);
}

// PODPIS KONFIGURACJI na każdym kaflu. Osobno od reszty, bo zmienia się z dwóch stron naraz:
// przy edycji koła (wtedy dochodzi „zmienione") i przy zmianach w bibliotece konfiguracji.
function _whCapsCfgSync() {
  const box = document.getElementById("whCapsList"); if (!box) return;
  if (typeof whCfgState !== "function") return;      // rf-46j nieobecny (nakładka) — nie ma o czym
  box.querySelectorAll(".wh-caps-tile").forEach(t => {
    const line = t.querySelector(".wh-caps-cfg"); if (!line) return;
    const st = whCfgState(_whCapsCfg(state.devices[t.dataset.dev] || {}));
    // Koło ułożone ręcznie NIE dostaje etykiety „bez nazwy" — puste miejsce mówi to samo, a nie
    // wygląda jak brakująca dana. Etykieta pojawia się dopiero, gdy jest co nazwać.
    const txt = st.name || "";
    const mark = !st.name ? "" : (!st.known ? "?" : (st.dirty ? "•" : ""));
    const html = txt
      ? '<b>' + esc(txt) + "</b>"
        + (mark ? '<i class="' + (st.known ? "is-dirty" : "is-gone") + '" title="'
          + esc(st.known ? _whCapsT("zmienione — różni się od zapisanej wersji",
            "changed — it differs from the saved version")
            : _whCapsT("tej konfiguracji nie ma już na liście",
              "this configuration is no longer on the list")) + '">' + mark + "</i>" : "")
      : "";
    if (line.innerHTML !== html) line.innerHTML = html;
  });
}

// Jedno miejsce na „ten przełącznik jest nieczynny", bo pytają o nie dwie drogi: budowa kafla
// i tanie odświeżenie (wheelCapsSync). Dwie kopie tej reguły rozjechałyby się przy pierwszej
// poprawce — a rozjazd byłby niewidoczny: myszą działa, klawiaturą i czytnikiem nie.
function _whCapsSwDis(sw, few) {
  sw.tabIndex = few ? -1 : 0;
  if (few) sw.setAttribute("aria-disabled", "true");
  else sw.removeAttribute("aria-disabled");
}

// Przełącznik koła TEGO kapsla. Ten sam, co w pasku modułu — i to jest cel: tam włącza się koło,
// które się właśnie ustawia, a tutaj każde inne, bez przełączania się na nie. Oba piszą to samo
// (POST /wheel), więc rozjechać się nie mogą; wracają rozgłoszeniem do wszystkich okien.
function _whCapsSwitch(dev, W, n) {
  const on = !!(W && W.enabled);
  const few = n < WHEEL_MIN_SLICES;
  const sw = document.createElement("div");
  sw.className = "rf-toggle wh-caps-sw" + (few ? " dis" : "");
  sw.setAttribute("role", "switch");
  sw.setAttribute("aria-checked", on ? "true" : "false");
  sw.setAttribute("aria-label", _whCapsT("Włącz albo wyłącz koło tego kapsla",
    "Switch this capsule's wheel on or off") + " — " + dev);
  // NIECZYNNY PRZEŁĄCZNIK MUSI TO POWIEDZIEĆ CZYTNIKOWI EKRANU, nie tylko kolorem (audyt UX #36).
  // `role="switch"` na zwykłym <div> nie ma atrybutu `disabled`, więc bez `aria-disabled` czytnik
  // ogłaszał go jako sprawny — a on nie reagował. Wypadnięcie z kolejności tabulacji dokłada do
  // tego drugą połowę: klawiatura nie zatrzymuje się na czymś, co nic nie robi.
  _whCapsSwDis(sw, few);
  // SILNIK ODMAWIA WŁĄCZENIA KOŁA BEZ WYCINKÓW (RadialMenu.MIN_SLICES, POST /wheel), więc
  // przełącznik nie udaje, że się da: mówi, czego brakuje, zamiast odbić się o serwer i wrócić.
  sw.title = few ? _whCapsT("Dodaj wycinki, zanim włączysz koło", "Add slices before switching the wheel on")
    : _whCapsT("Włącz albo wyłącz koło tego kapsla", "Switch this capsule's wheel on or off");
  sw.classList.toggle("on", on);
  sw.innerHTML = '<span class="rf-tg-lbl off">Wył.</span><span class="rf-tg-knob"></span>'
    + '<span class="rf-tg-lbl on">Wł.</span>';
  // ⚠️ TA SAMA ZASADA, CO PRZY KLIKU W KAFEL: uchwyt czyta stan W CHWILI KLIKNIĘCIA, a nie ten
  // z chwili rysowania. Kafle bywają odświeżane bez przebudowy (wheelCapsSync przestawia klasy),
  // więc domknięcie z zapamiętanym `on` po pierwszym przełączeniu wysyłałoby w kółko tę samą
  // wartość, a przełącznik wyglądałby na zepsuty co drugie kliknięcie.
  const flip = () => {
    const cur = _whCapsCfg(state.devices[dev] || {});
    const cnt = (cur && Array.isArray(cur.slices)) ? cur.slices.length : 0;
    if (cnt < WHEEL_MIN_SLICES) return;                 // wycinki mogły zniknąć od czasu rysowania
    whCapsSetEnabled(dev, !(cur && cur.enabled));
  };
  sw.onclick = e => { e.stopPropagation(); flip(); };
  sw.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); flip(); } };
  return sw;
}

// Włączenie koła dowolnego kapsla. Dla edytowanego idzie tą samą drogą co przełącznik w nagłówku
// (karta musi zobaczyć swoją własną zmianę natychmiast, a nie dopiero z rozgłoszenia), dla
// pozostałych POST-em wyłącznie z polem `enabled` — serwer dokłada resztę z tego, co ma zapisane.
function whCapsSetEnabled(dev, want) {
  const apply = () => {
    if (dev === state.wheelDev && state.wheel) {
      state.wheel.enabled = !!want;
      if (typeof whSync === "function") whSync();
      if (typeof postWheel === "function") postWheel();
      wheelCapsSync();
      return;
    }
    fetch("/wheel?dev=" + encodeURIComponent(dev), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !!want })
    }).then(r => r.json()).then(m => {
      const D = state.devices[dev];
      if (D && m && !m.error) { D.wheelCfg = m; wheelCapsRender(); }
      if (m && m.error && typeof whToast === "function") whToast(m.error, true);
    }).catch(() => { /* rozgłoszenie i tak poprawi kafel przy najbliższej zmianie */ });
  };
  // W symulacji pierwsze włączenie wyjścia potwierdza się dialogiem (rf-39f): koło wysyła naprawdę,
  // niezależnie od tego, z którego miejsca zostało włączone.
  if (want && typeof rfSimConfirmOn === "function") rfSimConfirmOn(true, apply, "wheel");
  else apply();
}

// Lista rozwijana obok nagłówka. Robi to samo, co klik w kafel, i jest tu z dwóch powodów: przy
// pięciu kapslach pas bywa szerszy niż okno, a wybór z listy jest jedyną drogą dla kogoś, kto nie
// celuje myszą w kafel.
function _whCapsPickRender(devs) {
  const s = document.getElementById("whCapsPick");
  if (!s) return;
  const cur = state.activeDeviceId || "d0";
  const html = devs.map(D => {
    const dev = (D.meta || {}).dev;
    const W = _whCapsCfg(D);
    const sl = (W && Array.isArray(W.slices)) ? W.slices : [];
    const tail = (sl.length < WHEEL_MIN_SLICES) ? _whCapsT("bez wycinków", "no slices")
      : (_whCapsCount(sl) + ((W && W.enabled) ? "" : " · " + _whCapsT("koło wyłączone", "wheel switched off")));
    return '<option value="' + esc(dev) + '">' + esc(_whCapsName(D)) + " — " + esc(tail) + "</option>";
  }).join("");
  if (s._html !== html) { s.innerHTML = html; s._html = html; }
  if (s.value !== cur) s.value = cur;
  if (!s._wired) {
    s._wired = true;
    s.onchange = () => { if (s.value && s.value !== state.activeDeviceId && typeof switchDevice === "function") switchDevice(s.value); };
  }
}


// ------------------------------------------------------------------------------------------
//  MAŁE KOŁA NA KAFLACH
// ------------------------------------------------------------------------------------------
// Rysowane TYM SAMYM rendererem co wszędzie indziej i tylko wtedy, gdy jest po co: pakiet
// spoczynkowy niesie własny podpis (rf-46g), więc przerysowanie zdarza się przy zmianie
// konfiguracji, a nie przy każdym wejściu w zakładkę. `force` mówi „pojemniki są nowe" —
// po przebudowie pasa podpisy trzeba policzyć od zera.
function wheelCapsDraw(force) {
  const box = document.getElementById("whCapsList");
  if (!box || !box.offsetParent) return;              // zakładka schowana: rysunek bez wymiaru
  box.querySelectorAll(".wh-caps-mini[data-dev]").forEach(host => {
    const D = state.devices[host.dataset.dev];
    if (!D) return;
    const st = (typeof wheelIdleState === "function") ? wheelIdleState({ wheelCfg: _whCapsCfg(D) }) : null;
    if (!st) { host.innerHTML = ""; host._sig = ""; return; }
    const sig = st.sig + "|" + host.clientWidth;
    if (!force && host._sig === sig) return;
    host._sig = sig;
    try { wheelSvgInto(host, st, null, { size: WH_CAPS_MINI_PX }); }
    catch (e) { if (!host._werr) { host._werr = 1; console.error("[pas kapsli " + host.dataset.dev + "]", e); } }
  });
}

// Tanie odświeżenie: to, co zmienia się przy przełączeniu kapsla i przy zmianie jego ustawień.
// Pełną przebudowę (wheelCapsRender) robi dopiero dołożenie albo zniknięcie kapsla.
function wheelCapsSync() {
  const box = document.getElementById("whCapsList");
  if (!box) return;
  const devs = _whCapsDevs();
  if (box.querySelectorAll(".wh-caps-tile").length !== devs.length) { wheelCapsRender(); return; }
  _whCapsShow(devs);
  for (const t of box.querySelectorAll(".wh-caps-tile")) {
    if (t.dataset.look !== _whCapsLook(state.devices[t.dataset.dev])) { wheelCapsRender(); return; }
  }
  const cur = state.activeDeviceId || "d0";
  box.querySelectorAll(".wh-caps-tile").forEach(t => {
    const D = state.devices[t.dataset.dev];
    const W = _whCapsCfg(D || {});
    const sl = (W && Array.isArray(W.slices)) ? W.slices : [];
    const active = (t.dataset.dev === cur);
    t.classList.toggle("active", active);
    t.classList.toggle("off", !(W && W.enabled));
    const b = t.querySelector(".wh-caps-badge");
    if (active && !b) {
      const s = document.createElement("span");
      s.className = "wh-caps-badge";
      s.textContent = _whCapsT("ustawiasz teraz", "now editing");
      t.querySelector(".wh-caps-th").appendChild(s);
    } else if (!active && b) b.remove();
    const md = t.querySelector(".wh-caps-mode");
    if (md && W && typeof _whListMode === "function") md.textContent = _whListMode(W.confirm);
    const cn = t.querySelector(".wh-caps-cnt");
    if (cn) cn.textContent = _whCapsCount(sl);
    const sw = t.querySelector(".wh-caps-sw");
    if (sw) {
      const on = !!(W && W.enabled), few = sl.length < WHEEL_MIN_SLICES;
      sw.classList.toggle("on", on);
      sw.classList.toggle("dis", few);
      sw.setAttribute("aria-checked", on ? "true" : "false");
      // Klawiatura i czytnik ekranu mają wiedzieć to samo, co oko — jedna reguła, jedno miejsce.
      _whCapsSwDis(sw, few);
      sw.title = few
        ? _whCapsT("Dodaj wycinki, zanim włączysz koło", "Add slices before switching the wheel on")
        : _whCapsT("Włącz albo wyłącz koło tego kapsla", "Switch this capsule's wheel on or off");
    }
    const mini = t.querySelector(".wh-caps-mini");
    if (mini) {
      const has = sl.length >= WHEEL_MIN_SLICES;
      // Kafel, któremu wycinki właśnie przybyły albo zniknęły, zmienia rodzaj zawartości —
      // to jedyna zmiana, której nie da się dopisać w miejscu, więc idzie przez pełną przebudowę.
      if (has !== !!mini.dataset.dev) { wheelCapsRender(); return; }
    }
  });
  _whCapsPickRender(devs);
  _whCapsCfgSync();
  wheelCapsDraw(false);
}

// NAZWA I KOLOR KAPSLA PRZYCHODZĄ PÓŹNIEJ niż pierwszy rysunek pasa (`devmeta` z serwera), a pas
// nie miał na to haczyka (F-G1-01: kafel mówił „d0” z zapasową ramką). Zmiana kapsla i jego meta
// zawsze kończą się `renderDeviceSelector`, więc tu się podpinamy, jak lista wyjść (rf-34b), i
// zbieramy wywołania do jednej klatki. Tanie odświeżenie samo decyduje, czy trzeba przerysować.
(function () {
  if (typeof window.renderDeviceSelector !== "function") return;
  const prev = window.renderDeviceSelector;
  let pend = 0;
  window.renderDeviceSelector = function () {
    const r = prev.apply(this, arguments);
    if (!pend) pend = requestAnimationFrame(() => { pend = 0; try { wheelCapsSync(); } catch (e) { } });
    return r;
  };
})();
