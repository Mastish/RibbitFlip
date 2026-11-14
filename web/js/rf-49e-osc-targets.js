"use strict";
// ============================================================================
//  URZĄDZENIA OSC — rejestr nazwanych celów (host + port), tworzony przez człowieka
//
//  OSC miało JEDEN adres na całą aplikację i było to prawdą dokładnie tak długo, jak długo „OSC"
//  znaczyło „odbiornik". Przestało nią być przy pierwszym zestawie, który steruje lampą na ESP32
//  i tabletem z TouchOSC naraz: to są dwie maszyny pod dwoma adresami, a mapowanie musi umieć
//  powiedzieć, do której mówi. Użytkownik tworzy więc NAZWANE urządzenia („Lampa ESP32",
//  „Tablet TouchOSC", „Resolume"), a każde mapowanie OSC wybiera jedno z nich.
//
//  CEL DOMYŚLNY NIE JEST POZYCJĄ TEJ LISTY — i to jest decyzja, nie pominięcie. To wciąż host
//  i port z pól obok, czyli adres, do którego mówi każde mapowanie napisane, zanim urządzenia
//  powstały. Gdyby był wierszem, natychmiast pojawiłoby się pytanie, którego nikt nie chce
//  usłyszeć: co się dzieje po usunięciu OSTATNIEGO. Tak zaś usunięcie dowolnego urządzenia ma
//  dokąd przenieść mapowania, a stare konfiguracje nie wymagają przepisywania przy pierwszym
//  odczycie. W liście stoi za to jako pierwszy wiersz „Cel domyślny", bo człowiek ma widzieć
//  komplet adresów w jednym miejscu.
//
//  Mechanika jest ta sama, co przy wirtualnych kontrolerach (rf-44): jedno wejście POST
//  /osc-targets z polem `action`, KAŻDA odpowiedź niesie CAŁY rejestr (lista przerysowuje się
//  z odpowiedzi, nie ze zgadywania), a serwer rozgłasza go zdarzeniem `osctargets`, bo drugi
//  otwarty panel pokazuje te same urządzenia.
//
//  Po rf-16 (state.midi, renderMidiList, edytor mapowania) i po rf-34 (karta „Kontroler OSC"
//  powstaje dopiero w initTabs). Osobny plik, a nie dopisek do rf-16: tamten ma już ponad
//  dziewięćset linii, a to jest osobny temat — rejestr urządzeń, nie lista mapowań.
// ============================================================================

state.oscTargets = [];        // [{id,name,host,port}] — lustro rejestru z serwera
state.oscTargetMax = 16;      // sufit z serwera (OscEmitter.TARGET_MAX); nie zgadujemy go tutaj
state._oscDevEdit = null;     // {id|null, name, host, port} — wiersz w trybie edycji / nowy

function oscTargetsList() { return Array.isArray(state.oscTargets) ? state.oscTargets : []; }
function oscTargetById(tid) {
  if (!tid) return null;
  return oscTargetsList().find(function (t) { return t.id === tid; }) || null;
}
// JAK SIĘ TO URZĄDZENIE NAZYWA na ekranie. Urządzenie bez nazwy pokazuje swój adres, a nie puste
// miejsce: nazwa jest opcjonalna, adres nigdy — więc to on jest tożsamością ostatniej instancji.
function oscTargetName(tid) {
  const t = oscTargetById(tid);
  if (!t) return "";
  return t.name || (t.host + ":" + t.port);
}
function oscTargetAddr(t) { return (t ? (t.host + ":" + t.port) : ""); }
// Ile mapowań mówi do tego urządzenia — liczone przez SERWER, we wszystkich kapslach. Panel trzyma
// mapowania wyłącznie tego kapsla, który jest edytowany, więc policzone tutaj zdanie „usuwasz coś,
// z czym rozmawiają trzy mapowania" mówiłoby o jednym kapslu i zaniżało to, co się zaraz stanie.
function oscTargetUses(t) { return Math.max(0, +(t && t.uses) || 0); }
// Odmiana po polsku. Ten sam pomocnik, którym pasek zestawów mapowań liczy swoje („5 mapowań"),
// bo to jest dokładnie ta sama rzecz liczona w tym samym oknie z pytaniem o zgodę.
function oscTargetCount(n) {
  return (typeof _midiCfgCount === "function") ? _midiCfgCount(n) : (n + " ×");
}
function oscTargetDefaultAddr() {
  const e = state.midiEnv || {};
  return (e.oscHost || "127.0.0.1") + ":" + (e.oscPort || 9000);
}

// ---------------------------------------------------------------------------
//  DOES THIS ADDRESS MEAN ANYTHING
// ---------------------------------------------------------------------------
// The server accepts ANY non-empty text as a host — `sanitize_targets` only checks that something
// is there (and that the port fits 1..65535). That is the right call ON THE SERVER: it is not its
// business to guess which name will resolve on somebody else's network. But a panel that takes
// „nie-ma-takiego host!!" without a word is not saving an address, it is saving silence — and
// silence on the other end looks exactly like a switched-off group. Hence the gate HERE: it lets
// through the three shapes that can work at all, and names the problem when it does not.
function _oscHostOk(h) {
  h = String(h == null ? "" : h).trim();
  if (!h || h.length > 120) return false;
  // An IPv6 literal — with the brackets a URL would need, or without them.
  if (h.charAt(0) === "[" && h.charAt(h.length - 1) === "]") h = h.slice(1, -1);
  if (h.indexOf(":") >= 0) {
    return /^[0-9A-Fa-f:.]+$/.test(h) && (h.match(/:/g) || []).length >= 2;
  }
  // Digits and dots alone can ONLY be an IPv4 literal: „192.168.0" is not shorthand, it is an
  // address that does not exist, and nobody uses a host name made of nothing but digits.
  if (/^[0-9.]+$/.test(h)) {
    const p = h.split(".");
    return p.length === 4 && p.every(function (x) {
      return x.length >= 1 && x.length <= 3 && /^\d+$/.test(x) && +x <= 255;
    });
  }
  // A host name: labels of letters, digits and hyphens separated by dots (a trailing dot, i.e. an
  // absolute name, is legal). A space, a slash or an exclamation mark falls out here.
  return /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.?$/.test(h);
}
// null = the address is fine; otherwise {field, msg} — WHICH field and what is wrong with it. The
// default-target row in rf-16 (initMidi/oscApply) uses it too: same address, different place.
function oscAddrProblem(host, port) {
  if (!String(host == null ? "" : host).trim()) {
    return {field: "host", msg: _gl("Podaj adres odbiornika (nazwę hosta albo numer IP).",
                                    "Type the receiver's address (a host name or an IP number).")};
  }
  if (!_oscHostOk(host)) {
    return {field: "host", msg: _gl("To nie wygląda na adres: użyj numeru IP (np. 192.168.0.50) albo nazwy hosta — bez spacji i znaków specjalnych.",
                                    "That does not look like an address: use an IP number (e.g. 192.168.0.50) or a host name — no spaces, no special characters.")};
  }
  const p = parseInt(String(port == null ? "" : port).trim(), 10);
  if (!(p >= 1 && p <= 65535)) {
    return {field: "port", msg: _gl("Port musi być liczbą od 1 do 65535.",
                                    "The port has to be a number from 1 to 65535.")};
  }
  return null;
}
// Etykieta urządzenia w wierszu listy mapowań („Lampa ESP32 · /ribbitflip/led"). Cel domyślny
// milczy: przy jednym urządzeniu dopisek przy każdym wierszu byłby samym szumem.
function oscTargetTag(m) {
  const nm = oscTargetName(m && m.oscTarget);
  return nm ? (nm + " · ") : "";
}

// ---------------------------------------------------------------------------
//  DANE
// ---------------------------------------------------------------------------
// Jedno wejście dla wszystkich trzech dróg, którymi rejestr przyjeżdża: GET /midi (rf-16,
// przy starcie i przełączeniu kapsla), odpowiedź na POST /osc-targets i rozgłoszenie po SSE.
function oscTargetsTake(m) {
  if (!m) return;
  if (Array.isArray(m.oscTargets)) state.oscTargets = m.oscTargets;
  if (m.oscTargetMax) state.oscTargetMax = +m.oscTargetMax || state.oscTargetMax;
  if (m.oscHost != null || m.oscPort != null) {
    state.midiEnv = Object.assign(state.midiEnv || {},
      m.oscHost != null ? {oscHost: m.oscHost} : {},
      m.oscPort != null ? {oscPort: m.oscPort} : {});
  }
  oscTargetsRender();
}
// Zdarzenie `osctargets` (rf-08): ktoś w innym oknie dodał, przemianował, przeniósł albo usunął
// urządzenie. Poza samą listą trzeba odświeżyć DWA miejsca, w których nazwa urządzenia jest już
// narysowana: wiersze mapowań i otwarty edytor.
function onOscTargets(m) {
  oscTargetsTake(m || {});
  // Usunięte urządzenie: serwer przestawił mapowania na cel domyślny i zapisał to u siebie, więc
  // szkic otwartego edytora (kopia wiersza sprzed zmiany) musi pójść tą samą drogą — inaczej
  // zapisanie go przywróciłoby identyfikator, którego już nie ma.
  if (state._midiDraft && state._midiDraft.oscTarget && !oscTargetById(state._midiDraft.oscTarget)) {
    state._midiDraft.oscTarget = "";
  }
  try { if (typeof renderMidiList === "function") renderMidiList(); } catch (e) { /* karta jeszcze nie stoi */ }
  oscTargetsSyncEditor();
}
function _oscTargetsPost(body) {
  return fetch("/osc-targets", {method: "POST", headers: {"Content-Type": "application/json"},
                                body: JSON.stringify(body)})
    .then(function (r) { return r.json(); })
    .then(function (m) {
      if (m && Array.isArray(m.oscTargets)) oscTargetsTake(m);
      if (m && m.ok === false && m.error && typeof rfToast === "function") rfToast(m.error, {tone: "danger"});
      return m;
    })
    .catch(function () {
      if (typeof rfToast === "function") rfToast(_gl("Serwer nieosiągalny", "Server unreachable"), {tone: "danger"});
      return null;
    });
}

// ---------------------------------------------------------------------------
//  SEKCJA „URZĄDZENIA OSC" W KARCIE
// ---------------------------------------------------------------------------
function _oscDevEsc(s) {
  return (typeof miEsc === "function") ? miEsc(s) : String(s == null ? "" : s);
}
// Wiersz w trybie edycji — trzy pola naraz (nazwa, host, port), bo to są trzy odpowiedzi na jedno
// pytanie („czym jest to urządzenie i gdzie stoi") i rozbicie ich na dwa okna zamieniłoby jedną
// poprawkę literówki w porcie w wyprawę. Ten sam kształt służy DODAWANIU: nowy wiersz to po prostu
// edycja czegoś, co jeszcze nie ma identyfikatora.
function _oscDevEditHtml(e) {
  const isNew = !e.id;
  return '<div class="osc-dev is-edit">' +
    '<input type="text" id="oscDevName" class="osc-dev-in nm" maxlength="40" value="' + _oscDevEsc(e.name) +
      '" placeholder="' + _gl("np. Lampa ESP32", "e.g. ESP32 lamp") + '" aria-label="' +
      _gl("Nazwa odbiornika", "Receiver name") + '">' +
    // `data-for` mówi, CZYJ to wiersz — patrz _oscDevRead: przejście z edycji jednego odbiornika
    // wprost w edycję drugiego zastałoby jeszcze stare pola w drzewie.
    '<input type="text" id="oscDevHost" class="osc-dev-in host" maxlength="120" data-for="' +
      _oscDevEsc(e.id || "") + '" value="' + _oscDevEsc(e.host) +
      '" placeholder="192.168.0.50" aria-label="' + _gl("Adres (host)", "Address (host)") + '">' +
    '<input type="number" id="oscDevPort" class="osc-dev-in port" min="1" max="65535" value="' +
      _oscDevEsc(String(e.port) === "" || e.port == null ? 9000 : e.port) + '" aria-label="Port">' +
    '<button class="btn xs primary" data-act="save">' + _gl("Zapisz", "Save") + '</button>' +
    '<button class="btn xs" data-act="cancel">' + _gl("Anuluj", "Cancel") + '</button>' +
    (isNew ? "" : '<button class="btn xs" data-act="del" title="' + _gl("Usuń odbiornik", "Remove receiver") +
      '"><span class="bic bic-bin" aria-hidden="true"></span></button>') +
    // Room for the reason a save was refused — IN the row, next to the fields it is about. A toast
    // over the screen fades by itself and talks about something no longer in view.
    '<div class="osc-dev-err" id="oscDevErr" role="alert">' + _oscDevEsc(e.err || "") + '</div>' +
    '</div>';
}
function oscTargetsRender() {
  const box = document.getElementById("oscDevices");
  if (!box) return;
  const list = oscTargetsList(), max = state.oscTargetMax || 16, ed = state._oscDevEdit;
  // Wpisane, ale jeszcze niezapisane wartości wracają do stanu PRZED przerysowaniem. Rejestr
  // potrafi przyjechać z drugiego okna w trakcie pisania, a wtedy wiersz odbudowałby się z tego,
  // co było w chwili wejścia w edycję — czyli po cichu skasowałby to, co ktoś właśnie wpisał.
  if (ed) {
    const typed = _oscDevRead();
    if (typed && typed.forId === (ed.id || "")) {
      ed.name = typed.name; ed.host = typed.host; ed.port = typed.port;
    }
  }
  const rows = [
    // Cel domyślny — pierwszy wiersz, bez ✎ i bez ✕. Zmienia się go polami obok, i to zdanie
    // stoi w wierszu, żeby nikt nie szukał przycisku, którego tu nie ma.
    '<div class="osc-dev is-default">' +
      '<span class="osc-dev-nm">' + _gl("Cel domyślny", "Default receiver") + '</span>' +
      '<code class="osc-dev-adr">' + _oscDevEsc(oscTargetDefaultAddr()) + '</code>' +
      '<span class="osc-dev-note">' + _gl("zmieniasz go polami obok", "change it in the fields alongside") + '</span>' +
    '</div>'
  ];
  list.forEach(function (t) {
    if (ed && ed.id === t.id) { rows.push(_oscDevEditHtml(ed)); return; }
    const u = oscTargetUses(t);
    rows.push('<div class="osc-dev" data-id="' + _oscDevEsc(t.id) + '">' +
      '<span class="osc-dev-nm">' + _oscDevEsc(t.name || _gl("(bez nazwy)", "(unnamed)")) + '</span>' +
      '<code class="osc-dev-adr">' + _oscDevEsc(oscTargetAddr(t)) + '</code>' +
      '<span class="osc-dev-note">' + (u ? _oscDevEsc(oscTargetCount(u))
        : _gl("nikt tu nie mówi", "nothing talks here")) + '</span>' +
      '<button class="btn xs" data-act="edit" data-id="' + _oscDevEsc(t.id) + '" title="' +
        _gl("Zmień nazwę i adres", "Change the name and the address") + '">' +
        '<span class="rfic spray-ic sm" aria-hidden="true"></span></button>' +
      '<button class="btn xs" data-act="del" data-id="' + _oscDevEsc(t.id) + '" title="' +
        _gl("Usuń odbiornik", "Remove receiver") + '"><span class="bic bic-bin" aria-hidden="true"></span></button>' +
    '</div>');
  });
  if (ed && !ed.id) rows.push(_oscDevEditHtml(ed));
  const full = list.length >= max;
  // „RECEIVERS", not „DEVICES". In this app a device is the CAPSULE — „ruch urządzenia" appears in
  // half the sentences on this screen — so a second meaning of the same word two cards down costs
  // something on every read. The counter now says WHAT it counts: the default target is a visible
  // row of this list and still did not count towards „0 / 16", which read like a fault.
  const html =
    '<div class="mi-group-h">' + _gl("📡 Odbiorniki OSC", "📡 OSC receivers") +
      '<span class="osc-dev-sh">' + _gl("wspólne dla wszystkich kapsli", "shared by every capsule") + '</span>' +
      '<span class="osc-dev-count">' + _gl("dodane odbiorniki: ", "receivers added: ") +
      list.length + " / " + max + '</span></div>' +
    '<div class="osc-dev-list">' + rows.join("") + '</div>' +
    (ed ? "" :
      '<div class="osc-dev-bar"><button class="btn sm" id="oscDevAdd"' + (full ? " disabled" : "") + '>' +
      '<span class="bic bic-plus" aria-hidden="true"></span>' +
      _gl("Dodaj odbiornik OSC", "Add OSC receiver") + '</button>' +
      '<span class="hint">' + (full
        ? _gl("Lista jest pełna. Usuń któryś odbiornik, żeby zrobić miejsce.",
              "The list is full. Remove one to make room.")
        : _gl("Każde mapowanie OSC wybiera, do którego z nich mówi.",
              "Every OSC mapping picks which one it talks to.")) + '</span></div>');
  if (box._html === html) return;      // tanie: przerysowanie w trakcie pisania zabrałoby kursor
  box._html = html;
  box.innerHTML = html;
  try { if (typeof applyLang === "function") applyLang(box); } catch (e) { /* i18n jeszcze nie wstało */ }
  _oscDevWire(box);
}
function _oscDevWire(box) {
  const add = box.querySelector("#oscDevAdd");
  if (add) add.onclick = function () {
    // Nowe urządzenie startuje z portem celu domyślnego, bo w dziewięciu przypadkach na dziesięć
    // to jest ten sam port na innej maszynie. Adres zostaje pusty — to jedyna rzecz, której NIKT
    // za użytkownika nie zgadnie, a serwer i tak odmówiłby zapisu bez niego.
    state._oscDevEdit = {id: null, name: "", host: "", port: ((state.midiEnv || {}).oscPort || 9000)};
    oscTargetsRender();
    const f = document.getElementById("oscDevName");
    if (f) setTimeout(function () { try { f.focus(); } catch (e) { /* pole zniknęło */ } }, 10);
  };
  box.querySelectorAll(".osc-dev button[data-act]").forEach(function (b) {
    const act = b.dataset.act, id = b.dataset.id;
    b.onclick = function () {
      if (act === "edit") {
        const t = oscTargetById(id);
        if (!t) return;
        state._oscDevEdit = {id: t.id, name: t.name, host: t.host, port: t.port};
        oscTargetsRender();
        const f = document.getElementById("oscDevName");
        if (f) setTimeout(function () { try { f.focus(); f.select(); } catch (e) { /* pole zniknęło */ } }, 10);
      } else if (act === "cancel") {
        state._oscDevEdit = null;
        oscTargetsRender();
      } else if (act === "save") {
        _oscDevSave();
      } else if (act === "del") {
        _oscDevDelete(id || (state._oscDevEdit && state._oscDevEdit.id));
      }
    };
  });
  const keys = function (e) {
    e.stopPropagation();
    if (e.key === "Enter") { e.preventDefault(); _oscDevSave(); }
    else if (e.key === "Escape") { e.preventDefault(); state._oscDevEdit = null; oscTargetsRender(); }
  };
  box.querySelectorAll(".osc-dev-in").forEach(function (i) {
    i.onkeydown = keys;
    // Editing a field clears the complaint AT ONCE, in place — without a redraw, which would take
    // the caret away mid-address. The state follows the DOM, so the next paint will not revive it.
    i.oninput = function () {
      const box2 = document.getElementById("oscDevErr");
      if (box2 && box2.textContent) {
        box2.textContent = "";
        if (state._oscDevEdit) state._oscDevEdit.err = "";
      }
    };
  });
}
// Co stoi TERAZ w polach otwartego wiersza, razem z tym, czyj ten wiersz jest (`forId`). Bez tej
// tożsamości przejście z edycji jednego odbiornika w edycję drugiego przepisałoby wartości starego
// wiersza do nowego — pola z poprzedniej edycji są w drzewie aż do przerysowania.
//
// ⚠️ THE PORT COMES BACK AS TYPED — raw text, with no clamping to 1..65535. The clamp used to sit
// here and was the reason „99999" saved without a word as 65535: the field turned a mistake into a
// different number before anyone could notice it. oscAddrProblem() in _oscDevSave judges it now —
// one place instead of two that did not agree anyway.
function _oscDevRead() {
  const g = function (id) { return document.getElementById(id); };
  const h = g("oscDevHost");
  if (!h) return null;
  return {forId: String((h.dataset && h.dataset.for) || ""),
          name: (g("oscDevName").value || "").slice(0, 40),
          host: (h.value || "").trim().slice(0, 120),
          port: (g("oscDevPort").value || "").trim()};
}
function _oscDevSave() {
  const ed = state._oscDevEdit, v = _oscDevRead();
  if (!ed || !v) return;
  // A REFUSAL SAYS WHAT IT IS ABOUT AND STAYS ON SCREEN. The reason lands in the row (`ed.err`), so
  // it survives a redraw and can be read together with the field it talks about — unlike a toast,
  // which fades on its own.
  const bad = oscAddrProblem(v.host, v.port);
  if (bad) {
    ed.name = v.name; ed.host = v.host; ed.port = v.port; ed.err = bad.msg;
    oscTargetsRender();
    const f = document.getElementById(bad.field === "port" ? "oscDevPort" : "oscDevHost");
    if (f) setTimeout(function () { try { f.focus(); f.select(); } catch (e) { /* pole zniknęło */ } }, 10);
    return;
  }
  ed.err = "";
  const port = parseInt(v.port, 10);
  if (!ed.id) {
    _oscTargetsPost({action: "create", name: v.name, host: v.host, port: port}).then(function (m) {
      if (m && m.ok) {
        state._oscDevEdit = null;
        oscTargetsRender();
        oscTargetsSyncEditor();
        if (typeof rfToast === "function") {
          rfToast(_gl("Odbiornik gotowy. Wybierz go w mapowaniu OSC, żeby tam mówiło.",
                      "The receiver is ready. Pick it in an OSC mapping to make it talk there."));
        }
      }
    });
    return;
  }
  // Nazwa i adres to dwie osobne akcje serwera (jedna niczego nie przenosi, druga przenosi cały
  // ruch pod inny adres), więc lecą osobno i tylko wtedy, gdy naprawdę się zmieniły.
  const cur = oscTargetById(ed.id) || {name: "", host: "", port: 0};
  const jobs = [];
  if (v.name !== (cur.name || "")) jobs.push({action: "rename", id: ed.id, name: v.name});
  if (v.host !== cur.host || port !== +cur.port) {
    jobs.push({action: "edit", id: ed.id, host: v.host, port: port});
  }
  const run = function (i) {
    if (i >= jobs.length) {
      state._oscDevEdit = null;
      oscTargetsRender();
      oscTargetsSyncEditor();
      try { if (typeof renderMidiList === "function") renderMidiList(); } catch (e) { /* karta nie stoi */ }
      return;
    }
    _oscTargetsPost(jobs[i]).then(function (m) { if (m && m.ok) run(i + 1); });
  };
  run(0);
}
function _oscDevDelete(tid) {
  const t = oscTargetById(tid);
  if (!t) return;
  const nm = t.name || oscTargetAddr(t);
  const n = oscTargetUses(t);       // ze WSZYSTKICH kapsli — patrz oscTargetUses
  const msg = _gl(
    "Usunąć „" + nm + "”? " + (n ? oscTargetCount(n) + " przejdzie" : "Mapowania, które tam mówiły, przejdą") +
      " na cel domyślny (" + oscTargetDefaultAddr() + "). Zanim odbiornik zniknie, dostanie jeszcze " +
      "wartości parkowania, żeby nie zostało z zapaloną lampą albo wykręconym serwem.",
    "Remove “" + nm + "”? " + (n ? oscTargetCount(n) + " will move" : "The mappings that talked to it move") +
      " to the default receiver (" + oscTargetDefaultAddr() + "). Before it goes, it gets its parking " +
      "values, so nothing is left with a lamp on or a servo wound up.");
  const go = function () {
    _oscTargetsPost({action: "delete", id: tid}).then(function (m) {
      if (!m || !m.ok) return;
      state._oscDevEdit = null;
      // Kopia w panelu musi pójść za serwerem od razu, nie dopiero po rozgłoszeniu: wiersze
      // mapowań i otwarty edytor pokazywałyby przez chwilę odbiornik, którego już nie ma.
      ((state.midi || {}).mappings || []).forEach(function (mm) {
        if (mm.oscTarget === tid) mm.oscTarget = "";
      });
      if (state._midiDraft && state._midiDraft.oscTarget === tid) state._midiDraft.oscTarget = "";
      oscTargetsRender();
      oscTargetsSyncEditor();
      try { if (typeof renderMidiList === "function") renderMidiList(); } catch (e) { /* karta nie stoi */ }
      if (typeof rfToast === "function" && m.moved) {
        rfToast(_gl("Usunięto „" + nm + "”. Mapowań przeniesionych na cel domyślny: " + m.moved + ".",
                    "“" + nm + "” removed. Mappings moved to the default receiver: " + m.moved + "."));
      }
    });
  };
  if (typeof rfConfirm === "function") {
    rfConfirm(msg, {title: _gl("Usuń odbiornik OSC", "Remove the OSC receiver"), tone: "danger",
                    confirmLabel: _gl("Usuń", "Remove")}).then(function (ok) { if (ok) go(); });
  } else go();
}

// ---------------------------------------------------------------------------
//  WYBÓR ODBIORNIKA W EDYTORZE MAPOWANIA
// ---------------------------------------------------------------------------
// Wołane z rf-16 (miOscOutHtml / wireMidiEditor / testMidiMap) przez `typeof`, więc panel bez tego
// pliku po prostu nie pokaże wyboru i wszystko pojedzie na cel domyślny — tak, jak działało wcześniej.
function oscTargetFieldHtml(m) {
  const cur = String((m && m.oscTarget) || "");
  const opts = ['<option value=""' + (cur ? "" : " selected") + '>' +
    _gl("Cel domyślny", "Default receiver") + " (" + oscTargetDefaultAddr() + ")</option>"];
  oscTargetsList().forEach(function (t) {
    opts.push('<option value="' + _oscDevEsc(t.id) + '"' + (cur === t.id ? " selected" : "") + ">" +
      _oscDevEsc((t.name || _gl("(bez nazwy)", "(unnamed)")) + " — " + oscTargetAddr(t)) + "</option>");
  });
  // Odbiornik z presetu, którego ta maszyna nie zna, ZOSTAJE w polu jako osobna pozycja. Silnik
  // i tak zagra na cel domyślny (podmienia to przy kompilacji), ale ciche wyczyszczenie wyboru
  // skasowałoby decyzję autora zestawu przy pierwszym otwarciu edytora.
  if (cur && !oscTargetById(cur)) {
    opts.push('<option value="' + _oscDevEsc(cur) + '" selected>' +
      _gl("nieznany odbiornik ", "unknown receiver ") + _oscDevEsc(cur) +
      _gl(" — gra na cel domyślny", " — plays on the default one") + "</option>");
  }
  return '<label class="fld" id="mieOscTargetW">' + _gl("Odbiornik", "Receiver") +
    '<select id="mieOscTarget">' + opts.join("") + "</select></label>";
}
function oscTargetFieldRead(m) {
  const sel = document.getElementById("mieOscTarget");
  if (sel && m) m.oscTarget = String(sel.value || "");
}
// Rejestr zmienił się przy OTWARTYM edytorze. Lista opcji przerysowuje się w miejscu, ale nie
// wtedy, gdy pole jest właśnie w rękach użytkownika — podmiana pod rozwiniętą listą zamknęłaby ją
// i zabrała fokus w środku wyboru.
function oscTargetsSyncEditor() {
  const sel = document.getElementById("mieOscTarget");
  if (!sel || document.activeElement === sel) return;
  const m = state._midiDraft;
  if (!m) return;
  const host = document.createElement("div");
  host.innerHTML = oscTargetFieldHtml(m);
  const fresh = host.querySelector("select");
  if (fresh) sel.innerHTML = fresh.innerHTML;
}

// ---------------------------------------------------------------------------
//  PODPIĘCIE
// ---------------------------------------------------------------------------
// Sekcja mieszka w #oscTarget, czyli w tym samym pasku, w którym stoi cel domyślny — pod nim,
// bo tak czyta się to zdanie: „adres domyślny, a oto reszta maszyn". Wołane PO initTabs (karta
// „Kontroler OSC" powstaje dopiero tam, rf-34) i po initMidi, które przywozi pierwszy rejestr
// razem z konfiguracją kapsla.
function initOscTargets() {
  const wrap = document.getElementById("oscTarget");
  if (!wrap || document.getElementById("oscDevices")) return;
  const box = document.createElement("div");
  box.className = "mi-group osc-devs";
  box.id = "oscDevices";
  wrap.appendChild(box);
  // Sam cel domyślny, dopóki nie przyjedzie rejestr. Bez własnego zapytania: rejestr wchodzi tą
  // samą odpowiedzią, co konfiguracja kapsla (miFetchState w rf-16), więc drugie GET /midi na
  // starcie byłoby tym samym pytaniem zadanym dwa razy.
  oscTargetsRender();
}
