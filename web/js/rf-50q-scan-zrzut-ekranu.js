/* SKANER — „📸 ZRZUT EKRANU" W KARCIE: zdjęcie WYBRANEGO monitora prosto na nową planszę.

   Przechwytywanie ekranu dla skanera z wyborem monitora. Do tej pory planszę dawało się zrobić skrótem Alt+R+cyfra (monitor
   ustawiony raz na zawsze w jego sekcji) albo wgrać z pliku. Ten przycisk rozwija listę monitorów
   — ten sam opis, co wszędzie w skanerze („2. DISPLAY2 · 1920×1080") — i fotografuje ten, który
   wskażesz. Plansza pamięta swój ekran, więc okno nad pulpitem wie potem, gdzie skaner pracuje.

   ⚠️ EKRAN, NA KTÓRYM STOI PANEL, FOTOGRAFUJE SIĘ Z OPÓŹNIENIEM. Zdjęcie od razu pokazałoby sam
   panel, a nie grę — więc przy nim jest 3 sekundy na przejście do gry (a przy jednym monitorze
   to jedyna pozycja). Który to ekran, zgadujemy ze środka okna przeglądarki: Chromium podaje
   `screenX/Y` w swoich pikselach DIP, a monitory są w przestrzeni kursora — przy różnych
   powiększeniach to bywa niedokładne, więc to tylko podpowiedź, nie blokada.

   Serwer: trasa `/scan/zrzut-ekranu` (`scan_zrzut_ekranu` w ribbitflip_monitor.py). Wynik przychodzi
   tą samą drogą, co po skrócie — zdarzeniem `scan_zrzut` — i tam (rf-50o `rfOnScanZrzut`) panel
   otwiera nową planszę z kursorem w polu nazwy. Tutaj jest tylko wybór i prośba. */
const RF_ZRZUT_EKRANU_I18N = {
  "📸 Zrzut ekranu ▾": "📸 Screenshot ▾",
  "Zrób zdjęcie wybranego ekranu i dodaj je jako nową planszę. Ekran, na którym stoi ten panel, fotografuje się po 3 sekundach, żeby był czas na przejście do gry.":
    "Take a picture of the screen you pick and add it as a new view. The screen this panel is on is taken after 3 seconds, so you have time to switch to the game.",
};
try { Object.assign(I18N_EN, RF_ZRZUT_EKRANU_I18N); } catch (e) { }

(function (global) {
  'use strict';

  const T = function (pl, en) { return (typeof _gl === "function") ? _gl(pl, en) : pl; };
  const OPOZNIENIE_S = 3;          // tyle sekund na przejście do gry, gdy fotografujemy ekran panelu
  let menu = null;

  function _dev() { return (typeof _scanDev === "function") ? _scanDev() : "d0"; }
  function _toast(tekst, opcje) { if (typeof rfToast === "function") rfToast(tekst, opcje || {}); }

  /* Na którym monitorze stoi ten panel — środek okna przeglądarki w przestrzeni ekranów. */
  function _ekranPanelu(lista) {
    const x = (global.screenX || 0) + (global.outerWidth || global.innerWidth || 0) / 2;
    const y = (global.screenY || 0) + (global.outerHeight || global.innerHeight || 0) / 2;
    const tu = lista.filter(function (s) {
      return s && x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h;
    })[0];
    return tu ? tu.name : (lista.length === 1 ? lista[0].name : "");
  }

  function zamknijMenu() {
    if (!menu) return;
    menu.remove();
    menu = null;
    const b = document.getElementById("scanZrzutEkranu");
    if (b) b.setAttribute("aria-expanded", "false");
    document.removeEventListener("mousedown", _pozaMenu, true);
    document.removeEventListener("keydown", _klawiszMenu, true);
  }
  function _pozaMenu(ev) {
    const b = document.getElementById("scanZrzutEkranu");
    if (menu && !menu.contains(ev.target) && ev.target !== b) zamknijMenu();
  }
  function _klawiszMenu(ev) {
    if (!menu) return;
    const pozycje = Array.prototype.slice.call(menu.querySelectorAll("button"));
    const i = pozycje.indexOf(document.activeElement);
    if (ev.key === "Escape") {
      ev.preventDefault();
      zamknijMenu();
      const b = document.getElementById("scanZrzutEkranu");
      if (b) b.focus();
    } else if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      ev.preventDefault();
      const n = pozycje.length;
      if (!n) return;
      const nast = ev.key === "ArrowDown" ? (i + 1 + n) % n : (i - 1 + n) % n;
      pozycje[nast].focus();
    }
  }

  function zrob(ekran, opoznienie) {
    zamknijMenu();
    fetch("/scan/zrzut-ekranu?dev=" + encodeURIComponent(_dev()), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monitor: ekran.name, zrodlo: "panel", opoznienie: opoznienie })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !j.ok) {
        _toast(T("Nie udało się zrobić zrzutu: ", "Could not take the screenshot: ")
          + ((j && j.error) || ""), { tone: "danger" });
        return;
      }
      // Zdjęcie z opóźnieniem jeszcze nie powstało — mówimy, ile jest czasu i co z nim zrobić.
      // Gotowe zdjęcie ogłasza zdarzenie `scan_zrzut` (rf-50o), więc tu nie ma czego dodawać.
      if (j.zaplanowany) {
        _toast(T("Zdjęcie ekranu ", "Picture of screen ") + RFScan.opisEkranu(ekran, ekran.i)
          + T(" za " + OPOZNIENIE_S + " s. Przejdź teraz do gry.",
              " in " + OPOZNIENIE_S + " s. Switch to the game now."), { ms: (OPOZNIENIE_S + 1) * 1000 });
      }
    }).catch(function () {
      _toast(T("Nie udało się zrobić zrzutu.", "Could not take the screenshot."), { tone: "danger" });
    });
  }

  function otworzMenu() {
    const b = document.getElementById("scanZrzutEkranu");
    if (!b) return;
    if (menu) { zamknijMenu(); return; }
    fetch("/screens?dev=" + encodeURIComponent(_dev())).then(function (r) { return r.json(); })
      .then(function (j) {
        const lista = (j && Array.isArray(j.screens)) ? j.screens.filter(Boolean) : [];
        if (!lista.length) {
          _toast(T("Nie udało się odczytać monitorów.", "Could not read the monitors."), { tone: "danger" });
          return;
        }
        const panel = _ekranPanelu(lista);
        menu = document.createElement("div");
        menu.className = "sk-zrz-menu";
        menu.setAttribute("role", "menu");
        menu.setAttribute("aria-label", T("Który ekran sfotografować", "Which screen to take"));
        const glowa = document.createElement("div");
        glowa.className = "sk-zrz-menu-glowa";
        glowa.textContent = T("Który ekran sfotografować?", "Which screen to take?");
        menu.appendChild(glowa);
        lista.forEach(function (s, i) {
          const tuPanel = (s.name === panel);
          const p = document.createElement("button");
          p.type = "button";
          p.className = "sk-zrz-menu-poz";
          p.setAttribute("role", "menuitem");
          const opis = document.createElement("span");
          opis.textContent = RFScan.opisEkranu(s, i);
          p.appendChild(opis);
          if (tuPanel) {
            const dop = document.createElement("small");
            dop.textContent = T("tu stoi panel, zdjęcie za " + OPOZNIENIE_S + " s",
                                "this panel is here, picture in " + OPOZNIENIE_S + " s");
            p.appendChild(dop);
          }
          p.addEventListener("click", function () { zrob(s, tuPanel ? OPOZNIENIE_S : 0); });
          menu.appendChild(p);
        });
        const r = b.getBoundingClientRect();
        menu.style.left = Math.round(Math.max(8, Math.min(r.left, global.innerWidth - 300))) + "px";
        menu.style.top = Math.round(r.bottom + 6) + "px";
        document.body.appendChild(menu);
        b.setAttribute("aria-expanded", "true");
        document.addEventListener("mousedown", _pozaMenu, true);
        document.addEventListener("keydown", _klawiszMenu, true);
        const pierwsza = menu.querySelector("button");
        if (pierwsza) pierwsza.focus();
      }).catch(function () {
        _toast(T("Nie udało się odczytać monitorów.", "Could not read the monitors."), { tone: "danger" });
      });
  }

  /* Przycisk powstaje razem z kartą (rf-50d), a karta — przy pierwszym wejściu w zakładkę. Łapiemy
     go więc delegacją na dokumencie zamiast szukać elementu, którego jeszcze może nie być. */
  document.addEventListener("click", function (ev) {
    const b = ev.target && ev.target.closest ? ev.target.closest("#scanZrzutEkranu") : null;
    if (!b) return;
    ev.preventDefault();
    otworzMenu();
  });
  global.scanZrzutEkranuMenu = { otworz: otworzMenu, zamknij: zamknijMenu };
})(window);
