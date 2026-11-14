"use strict";
/* SKANER EKRANU — ZRZUT PLANSZY SKRÓTEM KLAWISZOWYM (Alt+R+1…9).

   SKĄD TO SIĘ WZIĘŁO: zrzuty do skanera skrótem (ALT+R+1 do ALT+R+9). Każdy zrzut całego ekranu
   od razu trafia do skanera, z możliwością konfiguracji, a zaraz po zrzucie da się narysować
   na nim strefy albo przypisać do niego istniejące.

   CO TO ZMIENIA W OBSŁUDZE. Do 21.09 planszę robiło się w trzech ruchach i dwóch programach:
   zrzut narzędziem systemowym, zapis pliku, powrót do panelu, „Wgraj planszę…". Każdy z nich
   wymagał wyjścia z gry, a widok, o który chodziło, bywa widoczny tylko w trakcie rozgrywki.
   Teraz jest jeden ruch, wykonalny spod gry: prefiks plus cyfra.

   CYFRA TO NUMER PLANSZY i na tym stoi całe zachowanie:
     • plansza N już jest -> PODMIENIA SIĘ jej obraz, a nazwa i przypisane skanery ZOSTAJĄ.
       To jest droga „przypisz istniejące": poprawiony zrzut tego samego widoku nie rozpina
       obrysów, które ktoś na nim wyrysował,
     • planszy N jeszcze nie ma -> DOPISUJE SIĘ na końcu spisu (plansze nie mają dziur), a nazwę
       dostaje po tytule okna, które było na wierzchu, czyli po nazwie gry.

   CO ROBI TA SEKCJA, A CZEGO NIE ROBI. Sam skrót żyje w serwerze i musi tam żyć: strona widzi
   klawisze wyłącznie wtedy, gdy ma skupienie, a cały sens tego skrótu polega na naciśnięciu go
   spod gry (hak `ZRZUTKEY` w ribbitflip_monitor.py). Tutaj jest USTAWIANIE — włącznik, klawisze,
   monitor, kapsel — plus reakcja na zdarzenie `scan_zrzut`: przerysowanie karty i jedno zdanie
   o tym, co dalej zrobić z nową planszą.

   DOMYŚLNIE WYŁĄCZONY, odwrotnie niż stop awaryjny i zamknięcie okna skanera. Tamte dwa nic nie
   zapisują; ten na jedno naciśnięcie robi plik na dysku i zmienia konfigurację skanera.

   Osobny plik, bo to własny temat z własnym stanem — i bo reguła organizacji JS każe dzielić przy
   500 liniach, a rf-50d ma ich tysiąc z okładem. Ładowany PO rf-50n, przed init.js karty. */
/* Polski jest tu pisany wprost, angielski bierze się z par niżej — ten sam kontrakt, co
   w rf-39b-guides.js i rf-39j-hotkey.js: słownik modułowy scalany do globalnego `I18N_EN`
   PRZED `initI18n()`. Napisy składane w locie (pigułka stanu, werdykt, treść powiadomień) idą
   przez `_gl(pl, en)` i par tutaj nie potrzebują.
   ⚠️ Żadna para nie może przykrywać klucza z rf-01 INNĄ wartością — pilnuje tego
   `tests/test_i18n_dupes.py`. Dlatego nie ma tu „Zapisz" ani „Anuluj": one już są. */
const RF_SKROT_I18N = {
  "📸 Zrzut planszy skrótem": "📸 Screenshot to a view with a hotkey",
  "Naciskasz skrót podczas gry, a RibbitFlip robi zdjęcie całego ekranu i wstawia je jako planszę o tym numerze. Nazwę planszy wpiszesz od razu po zdjęciu, a obszar wyznaczysz myszą: w podglądzie karty albo uchwytami na żywym ekranie. Wybierasz to niżej.": "You press the shortcut while playing, RibbitFlip takes a picture of the whole screen and puts it in as the view with that number. You name the view right after the shot, and you set the area with the mouse: in the card preview, or by handles on the live screen. You pick which below.",
  "Skrót": "Shortcut",
  "Włącz albo wyłącz robienie zrzutów skrótem klawiszowym": "Switch taking screenshots with a hotkey on or off",
  "Klawisze": "Keys",
  "Zmień klawisze": "Change the keys",
  "Domyślne": "Default",
  "Który monitor ma trafić na zrzut": "Which monitor goes into the screenshot",
  "Po zrzucie": "Right after the shot",
  "Co zrobić zaraz po zrzucie": "What to do right after the shot",
  "Nic": "Nothing",
  "Zrzut trafia na planszę i tyle. Panel i okno zostają tam, gdzie były, dostajesz tylko powiadomienie.": "The screenshot goes into the view and that is all. The panel and the window stay where they were, you only get a notification.",
  "Panel wychodzi na wierzch z otwartą planszą: obszar rysujesz myszą po obrazku w podglądzie.": "The panel comes to the front with that view open: you draw the area with the mouse across the picture in the preview.",
  "Nad pulpitem staje okno ustawiania obszaru: uchwytami ciągniesz ramkę po żywym oknie gry, a Gotowe albo Esc zamyka.": "The area editor stands over the desktop: you drag the frame by its handles across the live game window, and Gotowe or Esc closes it.",
  "Zrzuty do": "Screenshots go to",
  "Ustaw na ten kapsel": "Use this capsule",
  "Wysyłaj zrzuty do kapsla, którego ustawienia masz teraz na ekranie.": "Send the screenshots to the capsule whose settings are on the screen now.",
  "Cyfra to numer planszy: jeśli taka plansza już jest, podmienia się sam obraz, a jej nazwa i przypisane skanery zostają. Jeśli jeszcze jej nie ma, dopisuje się na końcu spisu i bierze nazwę z okna gry. „Po zrzucie” decyduje, czy od razu zabierasz się za obszar i gdzie: w podglądzie karty czy uchwytami na żywym ekranie. Okno skanera nad pulpitem chowa się na czas zdjęcia, więc na planszy go nie widać, a prawy Alt (AltGr) nigdy nie uruchamia skrótu.": "The digit is the view number: if that view is already there, only its picture is replaced and its name and assigned scanners stay. If it is not there yet, it is added at the end of the list and takes its name from the game window. “Right after the shot” decides whether you get to the area straight away and where: in the card preview or by handles on the live screen. The scanner's window over the desktop hides itself for the shot, so it is not in the picture, and the right Alt (AltGr) never fires the shortcut.",
};
try { Object.assign(I18N_EN, RF_SKROT_I18N); } catch (e) { }

(function (global) {
  'use strict';

  const T = function (pl, en) { return (typeof _gl === "function") ? _gl(pl, en) : pl; };
  const ESC = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  // Stan przyjeżdża z `/hotkey` (podklucz `zrzut`) i wraca z każdego zapisu. Trzymamy go w całości,
  // bo sekcja pokazuje i USTAWIENIE (włącznik, klawisze), i WERDYKT maszyny o nim (czy hak wstał).
  const S = { cfg: null, chwytam: false, kandydat: null, held: [], swiezy: true, sprawdzony: "" };

  function _dev() {
    return (typeof _scanDev === "function") ? _scanDev()
      : ((typeof state !== "undefined" && state.activeDeviceId) || "d0");
  }

  /* Nazwa klawisza tak, jak ją pisze karta stopu awaryjnego (rf-39j `_hkLabel`). Wołana po nazwie,
     nie skopiowana: jedno miejsce wie, że `page_up` to „PgUp" — druga lista rozjechałaby się przy
     pierwszym dołożonym klawiszu. Zapas na wypadek, gdyby tamtego pliku nie było (harness). */
  function _label(t) {
    if (typeof _hkLabel === "function") return _hkLabel(t);
    t = String(t || "");
    return t.length === 1 ? t.toUpperCase() : (t.charAt(0).toUpperCase() + t.slice(1));
  }
  function _token(e) {
    if (typeof _hkToken === "function") return _hkToken(e);
    return null;
  }
  function _isMod(t) {
    if (typeof _hkIsMod === "function") return _hkIsMod(t);
    return t === "ctrl" || t === "alt" || t === "shift" || t === "win" || t === "altgr";
  }
  function _errText(code) {
    // Kody serwera, nie zdania — aplikacja jest dwujęzyczna i składa własne słowa (ten sam
    // kontrakt, co `hotkey_check`). Dwa kody są nasze własne, reszta jedzie przez rf-39j.
    if (code === "collision")
      return T("Te klawisze są już zajęte przez inny skrót RibbitFlipa. Wybierz inne.",
        "These keys are already taken by another RibbitFlip shortcut. Pick different ones.");
    if (code === "cyfra")
      return T("Cyfry nie podawaj, dokleja się sama (1…9 to numer planszy). Naciśnij same modyfikatory i literę.",
        "Do not press a digit, it is added for you (1…9 is the view number). Press the modifiers and a letter.");
    if (typeof _hkErrText === "function") return _hkErrText(code);
    return String(code || "");
  }
  function _warnText(w) {
    if (typeof _hkWarnText === "function") return _hkWarnText(w);
    return String((w && w.code) || "");
  }

  // ------------------------------------------------------------------------------------------
  //  MARKUP SEKCJI — wołany z szablonu karty (rf-50d), zwijany jak dziennik kliknięć
  // ------------------------------------------------------------------------------------------
  global.scanZrzutSkrotHtml = function () {
    // ZWINIĘTA NA STARCIE (UX 261120, D12; od 22.09 stała rozwinięta), ale nagłówek mówi drogę
    // wprost: stan skrótu, klawisze i „Ustaw". Dzięki temu widać, że da się zrobić planszę spod
    // gry, a 300 px ustawień nie stoi przed polami skanera. Otwarcie pamięta `rfFold`
    // (scanSkrotInit), więc kto ją rozwinął, ten ją taką zastaje.
    return '<details class="cardfold inset sk-skrot" id="scanSkrot">' +
      // WYBÓR EKRANU NA WIERZCHU (2026-09-26): ekran, który trafi na
      // zdjęcie, stoi w samym nagłówku sekcji — widać go także wtedy, gdy sekcja jest zwinięta.
      '<summary><span class="sk-skrot-tytul">📸 Zrzut planszy skrótem</span>' +
        '<span class="sk-skrot-stan" id="skrotSumStan" data-noi18n></span>' +
        '<span class="hk-combo sk-skrot-klawisze" id="skrotSumKlawisze" aria-hidden="true"></span>' +
        '<span class="sk-skrot-sum-ekran" id="skrotSumEkran" data-noi18n></span>' +
        // Przycisk w nagłówku nie przełącza `details` sam (jest kontrolką w kontrolce), więc
        // rozwija go scanSkrotInit. Poza kolejnością Tab: tam stoi już całe `summary`.
        '<button type="button" class="btn xs sk-skrot-ustaw" id="skrotUstaw" tabindex="-1">Ustaw</button></summary>' +
      '<div class="sk-skrot-body">' +
        '<p class="sk-skrot-lead">Naciskasz skrót podczas gry, a RibbitFlip robi zdjęcie całego ekranu i wstawia je jako planszę o ' +
          'tym numerze. Nazwę planszy wpiszesz od razu po zdjęciu, a obszar wyznaczysz myszą: w podglądzie ' +
          'karty albo uchwytami na żywym ekranie. Wybierasz to niżej.</p>' +
        '<div class="sk-pl-rzad">' +
          '<span class="sk-pl-lbl">Skrót</span>' +
          '<div class="rf-toggle" id="skrotEnable" role="switch" aria-checked="false" tabindex="0"' +
            ' title="Włącz albo wyłącz robienie zrzutów skrótem klawiszowym">' +
            '<span class="rf-tg-lbl off">Wył.</span><span class="rf-tg-knob"></span>' +
            '<span class="rf-tg-lbl on">Wł.</span></div>' +
          '<span class="ra-pill" id="skrotPill"></span>' +
          '<span class="setupmsg" id="skrotMsg" role="status" aria-live="polite"></span>' +
        '</div>' +
        '<div class="setup-note sk-skrot-why" id="skrotWhy" data-noi18n hidden></div>' +
        '<div class="sk-pl-rzad">' +
          '<span class="sk-pl-lbl">Ekran</span>' +
          '<select id="skrotMonitor" class="sk-skrot-sel"' +
            ' aria-label="Który monitor ma trafić na zrzut"></select>' +
        '</div>' +
        '<div class="sk-pl-rzad">' +
          '<span class="sk-pl-lbl">Klawisze</span>' +
          '<span class="hk-combo" id="skrotCombo" aria-live="polite"></span>' +
          '<button type="button" class="btn sm sk-pl-btn" id="skrotZmien">Zmień klawisze</button>' +
          '<button type="button" class="btn sm ghost sk-pl-btn" id="skrotDomyslny">Domyślne</button>' +
          '<button type="button" class="btn sm sk-pl-btn" id="skrotZapisz" style="display:none">Zapisz</button>' +
          '<button type="button" class="btn sm ghost sk-pl-btn" id="skrotAnuluj" style="display:none">Anuluj</button>' +
        '</div>' +
        '<div class="hk-verdict" id="skrotWerdykt"></div>' +
        /* CO ZARAZ PO ZRZUCIE. Ten sam segment, co „Gdzie jest skaner" u góry karty, i te same
           dwa słowa w dwóch ostatnich pigułkach — bo to jest dokładnie to samo pytanie: gdzie
           chcesz teraz ustawiać obszar. „Nic" jest trzecią odpowiedzią, dla kogoś, kto robi serię
           zrzutów pod rząd i zajmie się nimi później. */
        '<div class="sk-pl-rzad">' +
          '<span class="sk-pl-lbl">Po zrzucie</span>' +
          '<div class="sk-segment sk-segment-sm" id="skrotPo" role="group"' +
            ' aria-label="Co zrobić zaraz po zrzucie">' +
            '<button type="button" class="sk-seg" data-po="nic"' +
              ' title="Zrzut trafia na planszę i tyle. Panel i okno zostają tam, gdzie były, dostajesz tylko powiadomienie.">Nic</button>' +
            '<button type="button" class="sk-seg" data-po="panel"' +
              ' title="Panel wychodzi na wierzch z otwartą planszą: obszar rysujesz myszą po obrazku w podglądzie.">W podglądzie</button>' +
            '<button type="button" class="sk-seg" data-po="pulpit"' +
              ' title="Nad pulpitem staje okno ustawiania obszaru: uchwytami ciągniesz ramkę po żywym oknie gry, a Gotowe albo Esc zamyka.">Na pulpicie</button>' +
          '</div>' +
        '</div>' +
        '<div class="sk-pl-rzad">' +
          '<span class="sk-pl-lbl">Zrzuty do</span>' +
          '<span class="sk-skrot-kapsel" id="skrotKapsel" data-noi18n></span>' +
          '<button type="button" class="btn sm ghost sk-pl-btn" id="skrotTenKapsel"' +
            ' title="Wysyłaj zrzuty do kapsla, którego ustawienia masz teraz na ekranie.">Ustaw na ten kapsel</button>' +
        '</div>' +
        '<div class="setup-note">Cyfra to numer planszy: jeśli taka plansza już jest, podmienia ' +
          'się sam obraz, a jej nazwa i przypisane skanery zostają. Jeśli jeszcze jej nie ma, ' +
          'dopisuje się na końcu spisu i bierze nazwę z okna gry. „Po zrzucie” decyduje, czy od ' +
          'razu zabierasz się za obszar i gdzie: w podglądzie karty czy uchwytami na żywym ' +
          'ekranie. Okno skanera nad pulpitem chowa się na czas zdjęcia, więc na planszy go nie ' +
          'widać, a prawy Alt (AltGr) nigdy nie uruchamia skrótu.</div>' +
      '</div>' +
    '</details>';
  };

  // ------------------------------------------------------------------------------------------
  //  WCZYTANIE I ZAPIS
  // ------------------------------------------------------------------------------------------
  /* Stan bierzemy z `/hotkey`, bo tam mieszkają wszystkie trzy skróty aplikacji. Odpowiedź niesie
     przy okazji spis monitorów i spis kapsli — jedno żądanie zamiast trzech, a karta i tak pyta
     o ten adres, żeby wypisać skrót zamykający okno nad pulpitem. */
  global.scanSkrotPobierz = function () {
    return fetch("/hotkey").then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.ok && j.zrzut) { S.cfg = j.zrzut; global.scanSkrotRysuj(); }
      return j;
    }).catch(function () { return null; });
  };

  function _zapisz(body) {
    return fetch("/hotkey/zrzut", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !j.ok) {
        _werdykt({ ok: false, error: (j && j.error) || "empty", badToken: j && j.badToken });
        _mignij(T("Nie udało się zapisać skrótu", "Could not save the shortcut"));
        return null;
      }
      // Odpowiedź niesie stan po zapisie, ale BEZ spisu monitorów i kapsli (te są w `/hotkey`).
      // Scalamy, zamiast podmieniać, żeby wybór w selekcie nie został pusty po pierwszym zapisie.
      S.cfg = Object.assign({}, S.cfg || {}, j);
      _koniecChwytania();
      _mignij(T("Zapisano", "Saved"));
      return j;
    }).catch(function () {
      _mignij(T("Nie udało się zapisać skrótu", "Could not save the shortcut"));
      return null;
    });
  }

  function _mignij(tekst) {
    const e = document.getElementById("skrotMsg");
    if (!e) return;
    e.textContent = tekst;
    clearTimeout(e._t);
    e._t = setTimeout(function () { e.textContent = ""; }, 3000);
  }

  // ------------------------------------------------------------------------------------------
  //  RYSOWANIE
  // ------------------------------------------------------------------------------------------
  /* Klawisze rysowane jako KLAWIATURA, nie jako napis „alt+r+1…9": ten sam kształt, którego uczy
     karta stopu awaryjnego i powiadomienie o włączonym module. Końcówka jest JEDNYM klawiszem
     z podpisem „1…9", bo dziewięć osobnych kapsli sugerowałoby, że trzeba nacisnąć wszystkie. */
  function _chipy(prefiks, finals) {
    const czesci = String(prefiks || "").split("+").filter(Boolean)
      .map(function (t) { return '<kbd class="hk-key">' + ESC(_label(t)) + '</kbd>'; });
    if (finals && finals.length)
      czesci.push('<kbd class="hk-key hk-key-zakres">' + ESC(finals[0] + "…" + finals[finals.length - 1]) + '</kbd>');
    return czesci.join('<span class="hk-plus">+</span>');
  }

  function _nazwaKapsla(id) {
    const lista = (S.cfg && S.cfg.devices) || [];
    const d = lista.filter(function (x) { return x && x.id === id; })[0];
    if (d) return d.label || d.name || d.id;
    // Zapas: kapsel, o którym `/hotkey` nie wie (dołożony po odpowiedzi) — pytamy panel.
    const D = (typeof state === "object" && state.devices) ? state.devices[id] : null;
    const m = (D && D.meta) || {};
    return m.label || m.name || id || "";
  }

  function _rysujMonitory() {
    const sel = document.getElementById("skrotMonitor");
    if (!sel) return;
    const ekrany = (S.cfg && S.cfg.screens) || [];
    const wybrany = (S.cfg && S.cfg.monitor) || "kursor";
    const poz = [["kursor", T("Ten, na którym jest kursor", "The one the cursor is on")],
                 ["glowny", T("Główny", "The primary one")]];
    ekrany.forEach(function (s, i) {
      if (!s || !s.name) return;
      // „2. DISPLAY2 · 1920×1080 (główny)" — ten sam opis, co przy przycisku „📸 Zrzut ekranu"
      // w karcie. Prawdziwe piksele (`pw`/`ph`), nie kursorowe: zrzut jest plikiem o tylu pikselach.
      poz.push([s.name, RFScan.opisEkranu(s, i)]);
    });
    // Monitor zapisany w ustawieniach, którego dziś nie ma (przepięty kabel) — pokazujemy go
    // zamiast po cichu przestawiać wybór: to, że kabla nie ma teraz, nie znaczy, że nie wróci.
    if (wybrany && !poz.some(function (p) { return p[0] === wybrany; }))
      poz.push([wybrany, wybrany.replace(/^\\\\\.\\/, "") + T("  (niepodłączony)", "  (not connected)")]);
    const sum = document.getElementById("skrotSumEkran");
    if (sum) {
      const wpis = poz.filter(function (p) { return p[0] === wybrany; })[0];
      const krotko = { kursor: T("ten z kursorem", "the one with the cursor"), glowny: T("główny", "the main one") };
      sum.textContent = wpis ? " · " + T("ekran: ", "screen: ") + (krotko[wybrany] || wpis[1].replace(/^\d+\.\s*/, "")) : "";
    }
    const odcisk = JSON.stringify([poz, wybrany]);
    if (sel._odcisk !== odcisk) {
      sel._odcisk = odcisk;
      sel.innerHTML = "";
      poz.forEach(function (p) {
        const o = document.createElement("option");
        o.value = p[0];
        o.textContent = p[1];
        o.setAttribute("data-noi18n", "");
        sel.appendChild(o);
      });
    }
    sel.value = wybrany;
  }

  function _werdykt(chk) {
    const box = document.getElementById("skrotWerdykt");
    if (!box) return;
    box.innerHTML = "";
    if (!chk) return;
    if (!chk.ok) {
      const d = document.createElement("div");
      d.className = "hk-bad";
      d.textContent = "⛔ " + _errText(chk.error) + (chk.badToken ? " (" + chk.badToken + ")" : "");
      box.appendChild(d);
      return;
    }
    const warns = chk.warnings || [];
    if (!warns.length) {
      const d = document.createElement("div");
      d.className = "hk-ok";
      d.textContent = "✅ " + T("Wolne klawisze, nic innego ich nie używa.",
        "Free keys, nothing else uses them.");
      box.appendChild(d);
      return;
    }
    warns.forEach(function (w) {
      const d = document.createElement("div");
      d.className = "hk-warn";
      d.textContent = "⚠ " + _warnText(w) + ((w.keys && w.keys.length) ? " (" + w.keys.join(", ") + ")" : "");
      box.appendChild(d);
    });
  }

  global.scanSkrotRysuj = function () {
    const c = S.cfg;
    if (!c) return;
    const sek = document.getElementById("scanSkrot");
    if (!sek) return;
    const combo = document.getElementById("skrotCombo");
    if (combo)
      combo.innerHTML = S.chwytam
        ? (S.kandydat ? _chipy(S.kandydat, c.finals) :
          '<span class="hk-capturing">' + ESC(T("Naciśnij klawisze…", "Press the keys…")) + '</span>')
        : _chipy(c.combo, c.finals);
    /* ⚠️ „NIEDOSTĘPNY" TO NIE TO SAMO, CO „WYŁĄCZONY", i ta jedna linijka o tym rozstrzyga.
       `available` znaczy „hak jest w tej chwili założony", a wyłączony skrót haka nie zakłada —
       więc branie `!available` za niedostępność wygasiłoby WŁĄCZNIK skrótu, który jest fabrycznie
       wyłączony, czyli zamknęłoby tę funkcję na zawsze. Naprawdę niedostępna jest kopia z `blocked`
       (uruchomiona z --allow-multi: taka nigdy nie przejmuje haków, patrz `PanicHotkey._start`)
       oraz skrót WŁĄCZONY, któremu hak mimo to nie wstał. */
    const martwy = !!c.blocked || (!!c.enabled && !c.available);
    const tg = document.getElementById("skrotEnable");
    if (tg) {
      const dziala = !!(c.enabled && c.available);
      tg.classList.toggle("on", dziala);
      tg.setAttribute("aria-checked", dziala ? "true" : "false");
      // `.dis` = wygaszony i nieklikalny, ale WIDOCZNY — ta sama klasa, co przy stopie awaryjnym.
      tg.classList.toggle("dis", martwy);
      tg.setAttribute("aria-disabled", martwy ? "true" : "false");
      tg.tabIndex = martwy ? -1 : 0;
    }
    const why = document.getElementById("skrotWhy");
    if (why) {
      why.hidden = !martwy;
      why.textContent = martwy
        ? (T("Skrót nie działa w tej kopii aplikacji: ", "The shortcut does not work in this copy of the app: ")
          + (c.reason || c.blocked
            || T("hak klawiaturowy nie wstał.", "the keyboard hook never went up.")))
        : "";
    }
    const pill = document.getElementById("skrotPill");
    if (pill) {
      const ok = c.enabled && c.available;
      pill.textContent = ok ? T("Działa", "Working")
        : (c.enabled ? T("Niedostępny", "Unavailable") : T("Wyłączony", "Off"));
      pill.className = "ra-pill" + (ok ? " ok" : (c.enabled ? " bad" : ""));
      pill.title = (!c.available && c.reason) ? c.reason : "";
    }
    // Podsumowanie w zwiniętym nagłówku: ten sam stan małymi literami i te same klawisze.
    const sumStan = document.getElementById("skrotSumStan");
    if (sumStan) {
      const ok = c.enabled && c.available;
      sumStan.textContent = ok ? T("działa", "working")
        : (c.enabled ? T("niedostępny", "unavailable") : T("wyłączony", "off"));
      sumStan.className = "sk-skrot-stan" + (ok ? " ok" : (c.enabled ? " bad" : ""));
    }
    const sumKl = document.getElementById("skrotSumKlawisze");
    if (sumKl) sumKl.innerHTML = _chipy(c.combo, c.finals);
    const kap = document.getElementById("skrotKapsel");
    if (kap) {
      const id = c.dev || c.defaultDev || _dev();
      kap.textContent = _nazwaKapsla(id) + (c.dev ? "" : T("  (domyślny)", "  (the default one)"));
    }
    const ten = document.getElementById("skrotTenKapsel");
    if (ten) ten.disabled = (c.dev === _dev());
    const po = document.getElementById("skrotPo");
    if (po) {
      // Fabrycznie „Na pulpicie" (22.09) — ta sama wartość, co `ZRZUT_PO_DEFAULT` po stronie
      // serwera. Konfiguracja z serwera ma to pole zawsze; `||` jest na wypadek starej odpowiedzi.
      const wybrany = c.poZrzucie || "pulpit";
      const b = po.querySelectorAll("[data-po]");
      for (let i = 0; i < b.length; i++) {
        const ten = b[i].getAttribute("data-po") === wybrany;
        // ⚠️ Trzeci argument `classList.toggle` MUSI być prawdziwym `true`/`false` — `undefined`
        // PRZEŁĄCZA klasę zamiast ją zgasić (ta sama pułapka, co w segmencie „Gdzie jest skaner").
        b[i].classList.toggle("sk-seg-wybrany", ten);
        b[i].setAttribute("aria-pressed", ten ? "true" : "false");
      }
    }
    _rysujMonitory();
  };

  // Sekcja składa swoje napisy z kodów serwera przy RYSOWANIU (pigułka, werdykt), więc chodzący
  // po DOM-ie tłumacz ich nie ruszy — tak samo jak przy karcie stopu awaryjnego (`hkRelang`).
  global.scanSkrotRelang = function () { try { global.scanSkrotRysuj(); } catch (e) { } };

  // ------------------------------------------------------------------------------------------
  //  PRZECHWYTYWANIE KLAWISZY (tylko PREFIKS — cyfra jest stała)
  // ------------------------------------------------------------------------------------------
  /* Ta sama mechanika, co w rf-39j: klawisze zbierają się, gdy IDĄ W DÓŁ, a zestaw zamyka pierwsze
     puszczenie. Różnica jest jedna i wynika z kształtu tego skrótu: łapiemy PREFIKS, a cyfra jest
     doklejana przez serwer. Dlatego cyfry w trakcie przechwytywania po prostu ignorujemy — inaczej
     „Alt+R+1" zapisałoby się jako prefiks i skrót brzmiałby Alt+R+1+1…9. */
  function _klawiszDol(e) {
    if (!S.chwytam) return;
    e.preventDefault(); e.stopPropagation();
    if (e.code === "Escape") { _koniecChwytania(); return; }
    const t = _token(e);
    if (!t) return;
    if (/^[0-9]$/.test(t)) {
      _werdykt({ ok: false, error: "cyfra" });
      return;
    }
    if (S.swiezy) { S.held = []; S.kandydat = null; S.swiezy = false; }
    if (S.held.indexOf(t) < 0 && S.held.length < 3) S.held.push(t);
    const mods = S.held.filter(_isMod), keys = S.held.filter(function (x) { return !_isMod(x); });
    S.kandydat = mods.concat(keys).join("+");
    global.scanSkrotRysuj();
  }

  function _klawiszGora(e) {
    if (!S.chwytam) return;
    e.preventDefault(); e.stopPropagation();
    S.swiezy = true;
    if (!S.kandydat || S.sprawdzony === S.kandydat) return;
    S.sprawdzony = S.kandydat;
    if (!String(S.kandydat).split("+").some(_isMod)) {
      _werdykt({ ok: false, error: "nomod" });
      const b0 = document.getElementById("skrotZapisz");
      if (b0) b0.disabled = true;
      return;
    }
    // Pytamy serwer o werdykt PRZED zapisem — to on wie, co system już zajął. Wysyłamy prefiks
    // Z CYFRĄ, bo to jest kombinacja, którą człowiek naprawdę naciśnie.
    const finals = (S.cfg && S.cfg.finals) || ["1"];
    fetch("/hotkey/check", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ combo: S.kandydat + "+" + finals[0] })
    }).then(function (r) { return r.json(); }).then(function (j) {
      const chk = (j && j.check) || null;
      _werdykt(chk);
      const b = document.getElementById("skrotZapisz");
      if (b) b.disabled = !(chk && chk.ok);
    }).catch(function () { });
  }

  function _zacznijChwytanie() {
    if (S.chwytam) return;
    S.chwytam = true; S.held = []; S.kandydat = null; S.swiezy = true; S.sprawdzony = "";
    ["skrotZmien", "skrotDomyslny"].forEach(function (id) {
      const e = document.getElementById(id); if (e) e.style.display = "none";
    });
    ["skrotZapisz", "skrotAnuluj"].forEach(function (id) {
      const e = document.getElementById(id); if (e) e.style.display = "";
    });
    const z = document.getElementById("skrotZapisz");
    if (z) z.disabled = true;
    _mignij(T("Naciśnij klawisze bez cyfry i puść. Cyfra 1…9 dokleja się sama.",
      "Press the keys without a digit and let them go. The digit 1…9 is added for you."));
    global.scanSkrotRysuj();
    window.addEventListener("keydown", _klawiszDol, true);
    window.addEventListener("keyup", _klawiszGora, true);
  }

  function _koniecChwytania() {
    S.chwytam = false; S.held = []; S.kandydat = null; S.swiezy = true; S.sprawdzony = "";
    window.removeEventListener("keydown", _klawiszDol, true);
    window.removeEventListener("keyup", _klawiszGora, true);
    ["skrotZmien", "skrotDomyslny"].forEach(function (id) {
      const e = document.getElementById(id); if (e) e.style.display = "";
    });
    ["skrotZapisz", "skrotAnuluj"].forEach(function (id) {
      const e = document.getElementById(id); if (e) e.style.display = "none";
    });
    _werdykt(null);
    global.scanSkrotRysuj();
  }

  // ------------------------------------------------------------------------------------------
  //  PODPIĘCIE
  // ------------------------------------------------------------------------------------------
  global.scanSkrotInit = function () {
    const sek = document.getElementById("scanSkrot");
    if (!sek || sek._gotowe) return;
    sek._gotowe = true;
    if (typeof rfFold === "function") rfFold(sek, "skaner.zrzut-skrot");
    const ustaw = document.getElementById("skrotUstaw");
    if (ustaw) ustaw.addEventListener("click", function (ev) {
      ev.preventDefault();
      sek.open = true;
      const pierwszy = document.getElementById("skrotEnable");
      if (pierwszy && pierwszy.focus) try { pierwszy.focus({ preventScroll: true }); } catch (e) { }
    });
    const wl = document.getElementById("skrotEnable");
    if (wl) wl.addEventListener("click", function () {
      if (!S.cfg) return;
      // Odmawiamy TYLKO w kopii testowej (--allow-multi). Wyłączony skrót nie ma założonego haka
      // i to jest normalny stan, a nie powód, żeby nie dać go włączyć (patrz `martwy` wyżej).
      if (S.cfg.blocked) {
        _mignij(T("Nie ma czego włączyć, bo w tej kopii aplikacji jest niedostępny.",
          "Nothing to switch on: the shortcut is unavailable in this copy."));
        return;
      }
      _zapisz({ enabled: !S.cfg.enabled }).then(global.scanSkrotRysuj);
    });
    const zm = document.getElementById("skrotZmien");
    if (zm) zm.addEventListener("click", _zacznijChwytanie);
    const dom = document.getElementById("skrotDomyslny");
    if (dom) dom.addEventListener("click", function () {
      _zapisz({ combo: (S.cfg && S.cfg.default) || "alt+r" }).then(global.scanSkrotRysuj);
    });
    const zap = document.getElementById("skrotZapisz");
    if (zap) zap.addEventListener("click", function () {
      if (S.kandydat) _zapisz({ combo: S.kandydat }).then(global.scanSkrotRysuj);
    });
    const anu = document.getElementById("skrotAnuluj");
    if (anu) anu.addEventListener("click", _koniecChwytania);
    const mon = document.getElementById("skrotMonitor");
    if (mon) mon.addEventListener("change", function () {
      _zapisz({ monitor: this.value }).then(global.scanSkrotRysuj);
    });
    const po = document.getElementById("skrotPo");
    if (po) po.addEventListener("click", function (ev) {
      const b = ev.target.closest("[data-po]");
      if (!b) return;
      const chce = b.getAttribute("data-po");
      if (S.cfg && S.cfg.poZrzucie === chce) return;
      _zapisz({ poZrzucie: chce }).then(global.scanSkrotRysuj);
    });
    const ten = document.getElementById("skrotTenKapsel");
    if (ten) ten.addEventListener("click", function () {
      _zapisz({ dev: _dev() }).then(global.scanSkrotRysuj);
    });
    global.scanSkrotPobierz();
  };

  // Przełączono kapsel w prawej kolumnie — napis „Zrzuty do" i przycisk obok zależą od tego,
  // czyje ustawienia są na ekranie, więc muszą się przerysować. Wołane z `scanCfgArrived`.
  global.scanSkrotSync = function () { try { global.scanSkrotRysuj(); } catch (e) { } };

  // ------------------------------------------------------------------------------------------
  //  ZDARZENIA ZE STRUMIENIA
  // ------------------------------------------------------------------------------------------
  /* USTAWIENIA ZMIENIŁY SIĘ GDZIE INDZIEJ (drugie okno panelu). Czytamy całość od nowa, a nie
     łatamy kopii: zdarzenie niesie ustawienie, a sekcja pokazuje też werdykt maszyny o nim. */
  global.rfOnHotkeyZrzut = function () { try { global.scanSkrotPobierz(); } catch (e) { } };

  /* ZRZUT WŁAŚNIE SIĘ ZROBIŁ — najważniejsze wejście w tym pliku.

     ⚠️ TO NIE JEST `scan_cfg`. Tamto zdarzenie leci przy KAŻDYM zapisie pokrętła z tej karty,
     więc przerysowywanie z niego karty byłoby pętlą cofającą suwaki pod palcem (słucha go tylko
     okno nad pulpitem, rf-50h). `scan_zrzut` przychodzi dokładnie raz na zrzut i niesie numer
     planszy, więc jest jedynym, po którym wolno kartę odświeżyć. */
  global.rfOnScanZrzut = function (m) {
    if (!m) return;
    if (!m.ok) {
      if (typeof rfToast === "function")
        rfToast(T("Nie udało się zrobić zrzutu: ", "Could not take the screenshot: ")
          + (m.error || ""), { tone: "danger" });
      return;
    }
    const n = parseInt(m.n, 10) || 1;
    const rozmiar = (m.w > 0 && m.h > 0) ? (" (" + m.w + "×" + m.h + ")") : "";
    // Zrzut trafił do INNEGO kapsla, niż ten oglądany. Nie przełączamy kapsla za człowieka —
    // mówimy, gdzie plansza wylądowała, i zostawiamy decyzję jemu.
    if (m.dev && m.dev !== _dev()) {
      if (typeof rfToast === "function")
        rfToast(T("Zrzut trafił do kapsla ", "The screenshot went to capsule ") + _nazwaKapsla(m.dev)
          + T(" jako Plansza ", " as view ") + n + rozmiar + ".", { ms: 6000 });
      return;
    }
    // CO DALEJ, DECYDUJE USTAWIENIE „PO ZRZUCIE" — a nieść je musi zdarzenie, nie nasza kopia
    // konfiguracji: skrót mógł zostać naciśnięty w chwili, gdy ta karta w ogóle nie była otwarta.
    const po = m.poZrzucie || "pulpit";
    fetch("/scan?dev=" + encodeURIComponent(m.dev || _dev()))
      .then(function (r) { return r.json(); })
      .then(function (cfg) {
        // Jedno wejście przerysowujące kartę z pełnej konfiguracji — razem z paskiem plansz
        // i chipami „Pracuje na planszach" (rf-50k woła rf-50n `scanZrzutyChipy`). Robimy to
        // w KAŻDYM z trzech trybów: karta, która akurat jest otwarta, ma pokazywać prawdę.
        if (typeof scanCfgArrived === "function") scanCfgArrived(cfg);
        if (po === "panel") {
          // Zakładka Skaner na wierzch: skrót naciska się spod gry, więc panel bywa otwarty na
          // czymś zupełnie innym. Klikamy istniejący przycisk nawigacji zamiast pisać własne
          // przełączanie (ten sam wzorzec, co `_skanDoMapowania` w rf-50i).
          try {
            const b = document.querySelector('[data-tab="skaner"]');
            if (b && !b.classList.contains("active")) b.click();
          } catch (e) { }
          try {
            const st = document.getElementById("scanStage") || document.getElementById("scanZrzuty");
            if (st && st.scrollIntoView) st.scrollIntoView({ block: "nearest", behavior: "smooth" });
          } catch (e) { }
          /* KURSOR OD RAZU W NAZWIE PLANSZY (21.09). Planszę da się nazwać
             zaraz po zrobieniu zrzutu, np. „Menu główne”.

             Nowa plansza nazywa się tytułem okna gry, a to bywa „Sol Cesto - poziom 3" albo coś
             gorszego; człowiek i tak wie lepiej, co właśnie sfotografował. Zaznaczamy całą treść,
             więc wpisanie „Menu główne" ją podmienia, a Enter zatwierdza (rf-50n). Nie zakładamy
             tu nowego pola: to jest pole „Wybrana" z paska plansz, czyli to samo, którym nazywa
             się każdą inną planszę.

             ⚠️ PO PRZEŁĄCZENIU ZAKŁADKI, NIE PRZED: kliknięcie przycisku nawigacji zabiera fokus
             na ten przycisk, więc ustawienie fokusu wcześniej byłoby natychmiast cofnięte. Stąd
             `setTimeout(0)` — po bieżącej turze zdarzeń, gdy zakładka jest już narysowana. */
          // ⚠️ TYLKO PRZY NOWEJ PLANSZY. Przy podmianie obrazu nazwa jest już nadana ręką
          // człowieka, a zaznaczona treść w polu znaczy, że jedno naciśnięcie klawisza ją kasuje.
          if (m.nowa !== false) setTimeout(function () {
            try {
              const nz = document.getElementById("scanZrzutNazwa");
              if (nz && !nz.disabled) { nz.focus(); nz.select(); }
            } catch (e) { }
          }, 0);
        }
        if (po === "pulpit") {
          /* SEGMENT „GDZIE JEST SKANER" MA PRZESKOCZYĆ OD RAZU. Okno otworzył SERWER, a karta
             pyta o jego stan dopiero co 5 sekund (`_sktloStanOkna` w rf-50l) — przez ten czas
             pokazywałaby „W symulacji" nad stojącym oknem edycji, czyli kłamała. `scan_okno`
             tędy nie pomoże: rf-50l obsługuje z niego wyłącznie zamknięcie. */
          try { if (typeof _sktloStanOkna === "function") _sktloStanOkna(); } catch (e) { }
        }
        if (typeof rfToast !== "function") return;
        const co = (m.nowa === false)
          ? T("Obraz planszy ", "The image of view ") + n + T(" podmieniony", " has been replaced") + rozmiar
          : T("Plansza ", "View ") + n + T(" ze zrzutu", " from the screenshot") + rozmiar;
        const okno = m.okno || {};
        if (po === "pulpit") {
          // Pracujący skaner nad pulpitem jest JEDYNYM przypadkiem, w którym „na pulpicie" nie
          // zrobiło tego, o co prosi ustawienie — więc mówimy wprost, co zrobić, żeby zrobiło.
          if (okno.pracuje) {
            rfToast(co + T(". Skaner pracuje nad pulpitem, więc okno ustawiania obszaru nie stanęło — zamknij skaner i wróć do planszy.",
              ". The scanner is working over the desktop, so the area editor did not open: close the scanner and come back to the view."),
              { tone: "danger", ms: 8000 });
          } else if (okno.error) {
            rfToast(co + T(". Nie udało się otworzyć okna nad pulpitem: ",
              ". Could not open the window over the desktop: ") + okno.error, { tone: "danger", ms: 8000 });
          } else {
            rfToast(co + T(". Okno ustawiania obszaru stoi nad pulpitem: uchwytami ciągniesz ramkę po oknie gry, a Gotowe albo Esc zamyka.",
              ". The area editor is standing over the desktop: drag the frame by its handles across the game window, and Gotowe or Esc closes it."),
              { ms: 8000 });
          }
          return;
        }
        if (po === "nic") {
          // Krótko: człowiek nie prosił o zajmowanie się tym teraz, więc nie tłumaczymy mu,
          // co mógłby zrobić. Powiadomienie systemowe powiedziało to samo, gdy był w grze.
          rfToast(co + ".", { ms: 4000 });
          return;
        }
        rfToast(co + (m.nowa === false
          ? T(". Skanery zostały na miejscu.", ". The scanners stayed where they were.")
          // Nazwa z tytułu okna gry jest tylko podpowiedzią, a kursor stoi już w tym polu (wyżej),
          // więc zdanie mówi po kolei, co da się zrobić jednym ruchem: nazwij, Enter, obszar.
          : T(". Nadaj jej nazwę, np. „Menu główne”, i naciśnij Enter. Potem przeciągnij po obrazku, żeby wyznaczyć obszar, albo zaznacz skanery, które mają na niej pracować.",
              ". Give it a name, say “Main menu”, and press Enter. Then drag across the picture to set the area, or tick the scanners that should work on it.")),
          { ms: 9000 });
      }).catch(function () { });
  };
})(window);
