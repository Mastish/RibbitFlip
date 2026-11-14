"use strict";
// ===== SIMULATION OUTPUT GATE — "the fake capsule sends real input" ====================
// The simulation drives keyboard, mouse and pad for real (see build_config / Device.__init__ in
// ribbitflip_monitor.py), which is what makes it a trigger test bench without hardware. The user
// has to be told — but at the moment it MATTERS, not as a greeting nobody reads: the warning is
// attached to the act of switching an output group ON, and the group only goes on if it is
// confirmed. Cancel leaves everything off.
//
// Asked ONCE per browser tab session: the first group that gets switched on unlocks the rest,
// so testing several groups is not a click-through gauntlet. Cancel does NOT unlock — the next
// attempt asks again. Switching a group OFF is never gated.
//
// The unlock also un-mutes REST triggers (rf-37), which have no group switch of their own and
// would otherwise call real services off synthetic motion the moment the panel opened.
// PARY DLA ZDAŃ, KTÓRE POJAWIAJĄ SIĘ TYLKO W SYMULACJI (patrz `_simCards`). Wpisywane do DOM-u po
// polsku i tłumaczone zwykłym walkerem, jak reszta panelu — dzięki temu przełączenie języka działa
// na nich bez własnego `relang`.
try{ Object.assign(I18N_EN, {
  "strumień syntetyczny — symulacja": "synthetic stream — simulation",
  "Pakiet statusu 0x21 (5 bajtów). W symulacji te ramki układa aplikacja — nie ma urządzenia, które mogłoby je wysłać. Znaczenie bajtów nieudokumentowane; B0 to nagłówek.":
    "The 0x21 status packet (5 bytes). In simulation these frames are composed by the app — there is no device that could send them. The meaning of the bytes is undocumented; B0 is the header.",
  "W symulacji komendy nie są wysyłane — nie ma do czego. Przyciski zostają czynne, a wynik powie „○ symulacja”.":
    // The quoted prefix is what the EN result line really starts with (the "○ symulacja (brak
    // urządzenia): …" pattern in rf-01 rewrites it) — a note that quotes the Polish word sends the
    // reader looking for text that never appears in English mode.
    "In simulation the commands are not sent — there is nothing to send them to. The buttons stay usable and the result line says “○ simulation (no device)”.",
  "Symulacja: ruch tego kapsla generuje aplikacja — nie ma czym potrząsnąć. „Steruj ręcznie” pod kulą pozwala poruszać nim samemu.":
    "Simulation: the app generates the motion of this capsule — there is nothing to shake. “Take control” under the ball lets you move it yourself.",
}); }catch(e){}

(function(){
  var KEY = "rf.simgate.unlocked";
  var unlocked = false, asking = false, startupDone = false, isSim = false, sendKeys = true;
  try{ unlocked = sessionStorage.getItem(KEY) === "1"; }catch(e){}

  // `state` lives in a module scope, NOT on window — reading state.cfg from here silently yields
  // undefined and the gate would wave everything through. The mode is therefore taken from the cfg
  // packet handed to rfSimStartup() on every /stream cfg event.
  function simMode(){ return isSim; }

  // May anything leave the app right now? Modules WITHOUT their own group switch ask this.
  window.rfSimOutputsAllowed = function(){ return !simMode() || unlocked; };

  // Wrap a group switch: rfSimConfirmOn(turningOn, applyFn, groupKey).
  // Off → always applied. On, outside simulation or already unlocked → applied. Otherwise: ask.
  //
  // Every switch-on also reminds the user of the emergency stop (rf-39j). This is the one place
  // that knows an output just started reaching the system, and that is exactly when the way out is
  // worth knowing — afterwards the mouse may already be running away from the panel. `groupKey`
  // ("mapping" | "motion" | "midi" | "osc") only names the group; the wording and the current
  // key combination come from rf-39j, because the combination is the user's to change.
  window.rfSimConfirmOn = function(want, apply, groupKey){
    var remind = function(){ if(want && typeof rfHotkeyReminder === "function") rfHotkeyReminder(groupKey); };
    if(!want || !simMode() || unlocked || typeof rfModal !== "function"){ apply(); remind(); return; }
    if(asking) return;                       // a second click while the dialog is open changes nothing
    asking = true;
    var g = (typeof _gl === "function") ? _gl : function(pl){ return pl; };
    rfModal({
      title: g("Włączyć wyjście w symulacji?", "Switch this output on in simulation?"),
      // TWO DIFFERENT TRUTHS, and the app knows which one it is in. Started with --no-keys, the
      // keyboard and the mouse are blocked for the whole run — saying "klawisze i mysz lecą do
      // systemu" there is a warning about something that cannot happen, right under a footer
      // reading "podgląd (--no-keys)". The pad, MIDI, OSC and the REST services still go out,
      // which is the half that DOES need saying.
      message: sendKeys ? g(
        "To tryb do testowania wyzwalaczy bez kapsla. Ruch jest udawany, ale wyjścia już nie — "
        + "klawisze, mysz, pad, MIDI i OSC lecą do systemu tak samo jak z prawdziwego Triki.\n\n"
        + "Symulacja rusza się bez przerwy, więc od tej chwili wyzwalacze będą wciskać klawisze "
        + "w oknie, które masz na wierzchu. Wyłączysz je tym samym przełącznikiem.",
        "This is the mode for testing triggers without a capsule. The motion is fake, the outputs "
        + "are not — keys, mouse, pad, MIDI and OSC reach the system exactly as they would from a "
        + "real Triki.\n\n"
        + "The simulation never stops moving, so from now on triggers will type into whatever "
        + "window is in front. The same switch turns them back off.") : g(
        "To tryb do testowania wyzwalaczy bez kapsla. Ruch jest udawany, a aplikacja działa "
        + "z opcją --no-keys, więc klawiatura i mysz są w tym uruchomieniu zablokowane — nic nie "
        + "zostanie wpisane do okna, które masz na wierzchu.\n\n"
        + "Reszta wyjść działa normalnie: wirtualny pad, MIDI, OSC i usługi sieciowe (REST) "
        + "wychodzą naprawdę. Symulacja rusza się bez przerwy, więc będą wychodzić w kółko, "
        + "dopóki nie wyłączysz ich tym samym przełącznikiem.",
        "This is the mode for testing triggers without a capsule. The motion is fake, and the app "
        + "is running with --no-keys, so the keyboard and the mouse are blocked for this run — "
        + "nothing will be typed into the window in front of you.\n\n"
        + "The other outputs work normally: the virtual pad, MIDI, OSC and the network services "
        + "(REST) really do go out. The simulation never stops moving, so they will keep going "
        + "out until you turn them off with the same switch."),
      icon: '<span class="rfm-frogtile rfm-warntile"></span>',
      tone: "sim simnote",
      actions: [{ label: g("Anuluj","Cancel"), value: false, variant: "ghost" },
                { label: g("Rozumiem, włącz","Got it, switch on"), value: true, variant: "primary" }]
    }).then(function(ok){
      asking = false;
      if(!ok) return;                        // Cancel / Esc / click-away → nothing is switched on
      unlocked = true;
      try{ sessionStorage.setItem(KEY,"1"); }catch(e){}
      apply();
      // ONE note, not two: the skull is a singleton, so a second toast would wipe the first
      // before anybody read it. The unlock news and the way out travel together.
      if(typeof rfToast === "function")
        rfToast((sendKeys ? g("Wyjścia symulacji odblokowane, klawisze lecą do aktywnego okna.",
                              "Simulation outputs unlocked, keys go to the active window.")
                          : g("Wyjścia symulacji odblokowane. Klawiatura i mysz są zablokowane (--no-keys); pad, MIDI, OSC i usługi wychodzą.",
                              "Simulation outputs unlocked. The keyboard and mouse are blocked (--no-keys); the pad, MIDI, OSC and services do go out."))
                // rfHotkeyLine() leaves the combination out of the sentence and rfHotkeyKeys()
                // hands it over as keycaps under it — same shape as every other note that names
                // the way out. Both guarded: this file also runs in the cheat-sheet window.
                + " " + (typeof rfHotkeyLine === "function" ? rfHotkeyLine() : ""),
                {tone:"danger", ms:7000,
                 keys:(typeof rfHotkeyKeys === "function" ? rfHotkeyKeys() : null)});
    });
  };

  // CO NAPRAWDĘ PŁYNIE, GDY KAPSLA NIE MA. Cztery zdania na ekranach „Czujnik" i „Połączenie"
  // oraz w hubie kapsli były pisane pod prawdziwe urządzenie i w symulacji mówiły nieprawdę:
  // strumień hex reklamował się jako „dowód, że dane są prawdziwe" (tu dowodzi czegoś
  // odwrotnego), karta statusu kazała nacisnąć urządzenie, którego nie ma, karta komend milczała
  // o tym, że nic nie wychodzi (dowiadywało się tego dopiero po kliknięciu, z linii wyniku),
  // a podpowiedź nad pigułkami kazała POTRZĄSNĄĆ kapslem — czyli zrobić jedyną rzecz, której w
  // symulacji zrobić się nie da; jest to pierwsze zdanie, jakie widzi ktoś, kto uruchomił
  // aplikację bez sprzętu. Zamiast niego mówimy, skąd bierze się ruch i czym go przejąć.
  // Pisane po polsku i zgłaszane walkerowi (`applyLang`), a nie składane z `_gl`: podmiana
  // `textContent` tworzy NOWY węzeł tekstowy, więc walker nie ma zapamiętanego starego oryginału
  // i przełączanie języka działa na nich tak samo jak na markupie.
  function _simCards(){
    if(!isSim) return;
    var put = function(el, txt){
      if(!el || el._simSaid) return;
      el._simSaid = 1;
      el.textContent = txt;
      try{ if(typeof applyLang === "function") applyLang(el); }catch(e){}
    };
    put(document.getElementById("feedHint"), "strumień syntetyczny — symulacja");
    // Hub kapsli w prawej kolumnie (rf-34:~134) — jest na KAŻDYM ekranie, więc to zdanie wita
    // pierwsze uruchomienie. `.rf-rcol` najpierw, bo ten sam markup stoi też w okienku nakładki.
    // DŁUGOŚĆ JEST CZĘŚCIĄ TEGO ZDANIA. Podpowiedź stoi na górze prawej kolumny, która ma tu 245 px
    // szerokości i przesuwa w dół WSZYSTKO, co pod nią (kula, pas naciśnięć, trzy przebiegi z ich
    // legendami). Pierwsza wersja miała cztery wiersze zamiast dwóch i przy 1440×900 wypychała
    // legendy „KANAŁY 0–2 / 3–5" poniżej krawędzi okna na każdym ekranie. Ta mówi to samo w trzech.
    put(document.querySelector(".rf-rcol .devices-hint") || document.querySelector(".devices-hint"),
        "Symulacja: ruch tego kapsla generuje aplikacja — nie ma czym potrząsnąć. "
        + "„Steruj ręcznie” pod kulą pozwala poruszać nim samemu.");
    put(document.getElementById("stNote"),
        "Pakiet statusu 0x21 (5 bajtów). W symulacji te ramki układa aplikacja — nie ma urządzenia, "
        + "które mogłoby je wysłać. Znaczenie bajtów nieudokumentowane; B0 to nagłówek.");
    var c = document.getElementById("cmdSimNote");
    if(c){
      // Przyciski zostają czynne — to jest poligon i wypada dać go dotknąć. Zmienia się tylko to,
      // że karta mówi o wyniku ZAWCZASU.
      c.hidden = false;
      put(c, "W symulacji komendy nie są wysyłane — nie ma do czego. Przyciski zostają czynne, a wynik powie „○ symulacja”.");
    }
  }

  // Runs on the first cfg packet. The server already brings up its three output groups switched
  // off in simulation; the pads live only in the browser, so they are silenced here — in memory,
  // WITHOUT padSave(), so the user's saved preference survives for the real mode.
  window.rfSimStartup = function(cfg){
    isSim = !!(cfg && cfg.simulate);        // every cfg packet — also after a mode switch + reload
    // …and whether the keyboard and the mouse can leave the app at all. Same field the footer
    // builds "podgląd (--no-keys)" from (rf-08), read here for the same reason the mode is: this
    // file cannot see `state`. The warning below is a promise about what will happen, and with
    // --no-keys half of that promise is not true.
    if(cfg && cfg.sendKeys != null) sendKeys = !!cfg.sendKeys;
    _simCards();                            // tanie i idempotentne — karty mogą dojść po pierwszym cfg
    if(startupDone || !isSim) return;
    startupDone = true;
    _silencePads(6);                        // XPAD is a top-level const: reachable by name, NOT on window
  };

  // The pads restore `enabled` from localStorage, so in simulation they can come up playing on
  // synthetic motion. Silenced WITHOUT padSave() — the saved preference belongs to the real mode.
  // Retried a few times: the cfg packet can beat initPad to it, and a missed window means audio.
  function _silencePads(tries){
    var ok = false;
    try{
      if(typeof XPAD !== "undefined" && XPAD && typeof XPAD.enabled === "boolean"){
        ok = true;
        if(XPAD.enabled){
          XPAD.enabled = false;
          if(typeof PadAudio !== "undefined" && PadAudio.gateOffAll) PadAudio.gateOffAll();
          if(typeof padReflect === "function") padReflect();
          if(window.updateTabDots) updateTabDots();
        }
      }
    }catch(e){}
    if(!ok && tries > 0) setTimeout(function(){ _silencePads(tries - 1); }, 400);
  }
})();
