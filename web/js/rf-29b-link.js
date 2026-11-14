"use strict";
// ======================= LOAD SOMEBODY ELSE'S FILE — ONE DOOR =======================
// Getting somebody's setup used to mean: leave the app → open the forum → download → find the
// file → import. Four hops for one JSON. Pasting the link to the attachment collapses that into
// one, and nothing else about the import changes: the file still goes through the same safety
// preview, still snapshots the current configuration first, still lands as "safe only" unless
// the risk is knowingly accepted.
//
// This window now offers BOTH ways in, because "did you save it to disk first?" was never a
// question worth asking the person: a file from disk and a pasted link end up in exactly the same
// place. (A dropped file is the third way, and it needs no control here — the overlay listens on
// the whole window, this one included, so the intro simply says so.)
//
// The download itself is done by the local server (/setup/fetch): the page's CSP allows
// connections to this server only, and the server is where the allowlist of places we fetch
// from lives. Everything below is about saying the useful thing when the link is not the one
// we can use — a bare "error" would send the person back to the forum to ask why.

// The button below says "Open #zestawy", so it opens #zestawy — the forum channel itself, not the
// server's front door. The address AND the channel name come from rf-00-core, which loads before
// everything else, so this file keeps no copy of either.
const RFL_HOWTO = RF_FORUM_URL;

let _rflBack = null;
let _rflPrevFocus = null;

function rfLinkClose() {
  const back = _rflBack;
  if (!back) return;
  _rflBack = null;
  document.removeEventListener("keydown", back._onKey, true);
  back.classList.add("out");
  setTimeout(function () { try { back.remove(); } catch (e) {} }, 160);
  try { if (_rflPrevFocus && _rflPrevFocus.focus) _rflPrevFocus.focus(); } catch (e) {}
  _rflPrevFocus = null;
}

// A GitHub page link points at HTML; the file itself is one host away. Rewriting it is safe
// (same repo, same path) and saves explaining the difference between "blob" and "raw".
function _rflNormalize(url) {
  const m = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/(?:blob|raw)\/(.+)$/i.exec(url);
  return m ? "https://raw.githubusercontent.com/" + m[1] + "/" + m[2] : url;
}

// What to say when the link cannot work. Each answer names the next move — that is the whole
// point of checking before fetching.
function _rflLocalProblem(url) {
  if (/^https?:\/\/(?:\w+\.)?discord(?:app)?\.com\/channels\//i.test(url)) {
    return _gl("To odnośnik do wiadomości, nie do pliku. Na Discordzie najedź na załączony plik .json, kliknij go prawym przyciskiem i wybierz „Kopiuj odnośnik do pliku”.",
               "That is a link to a message, not to the file. On Discord, right-click the attached .json and choose “Copy link”.");
  }
  if (/^https:\/\/gist\.github\.com\//i.test(url)) {
    return _gl("To strona gista. Kliknij na niej „Raw” i skopiuj adres, który się otworzy.",
               "That is the gist page. Click “Raw” on it and copy the address that opens.");
  }
  if (!/^https:\/\//i.test(url)) {
    return _gl("Wklej pełny adres zaczynający się od https://.",
               "Paste the full address, starting with https://.");
  }
  return null;
}

// Server-side refusals, in the same voice.
function _rflServerProblem(res) {
  const c = (res && res.code) || "net";
  if (c === "expired" && !(res && res.status)) {
    return _gl("Ten odnośnik już wygasł: adresy z Discorda żyją kilka godzin. Skopiuj go z posta jeszcze raz.",
               "That link has expired: Discord addresses live for a few hours. Copy it from the post again.");
  }
  if (c === "expired") {
    return _gl("Nie udało się pobrać pliku (HTTP " + res.status + "). Odnośnik z Discorda mógł wygasnąć albo pliku już tam nie ma. Skopiuj go z posta jeszcze raz albo pobierz plik ręcznie i upuść go na panel.",
               "Could not fetch the file (HTTP " + res.status + "). The Discord link may have expired, or the file is no longer there. Copy it from the post again, or download the file by hand and drop it onto the panel.");
  }
  if (c === "host") {
    return _gl("Umiem pobierać pliki z załączników Discorda i z GitHuba. Z innego miejsca pobierz plik na dysk i wybierz go przyciskiem w tym oknie.",
               "I can fetch files from Discord attachments and from GitHub. From anywhere else, download the file and pick it with the button in this window.");
  }
  if (c === "notjson") return _gl("Pod tym adresem nie ma pliku JSON.", "There is no JSON file at that address.");
  if (c === "toobig") return _gl("Ten plik jest o wiele za duży jak na zestaw.", "That file is far too big for a setup.");
  if (c === "scheme") return _gl("Tylko adresy https.", "Only https addresses.");
  if (c === "badurl") return _gl("To nie wygląda na adres.", "That does not look like an address.");
  if (c === "http") {
    return _gl("Nie udało się pobrać pliku (HTTP " + (res.status || "?") + "). Sprawdź odnośnik albo pobierz plik ręcznie i upuść go na panel.",
               "Could not fetch the file (HTTP " + (res.status || "?") + "). Check the link, or download the file by hand and drop it onto the panel.");
  }
  const why = (res && res.why) || _gl("brak połączenia", "no connection");
  return _gl("Nie udało się pobrać pliku (" + why + "). Sprawdź połączenie albo pobierz plik ręcznie i upuść go na panel.",
             "Could not fetch the file (" + why + "). Check your connection, or download the file by hand and drop it onto the panel.");
}

// What the window SAYS, per place it was opened from. Only the wording lives here: what actually
// happens to the bytes is decided by sniffing their contents (_rfDropDispatch), and that stays the
// one decision-maker — hence every note saying out loud that a file of a different kind still
// arrives as that kind. The notes name no source on purpose: the same sentence has to be true for
// a file from disk, a pasted link and a dropped file alike. The one exception is a REST pack, which
// cannot be sniffed into place because it lands INSIDE one application; opened from that
// application's card, this window knows which, so it hands the bytes straight to its review modal.
const RFL_COPY = {
  setup: {t: ["Wczytaj plik lub odnośnik", "Load a file or link"],
          ph: "https://cdn.discordapp.com/attachments/…/zestaw.json",
          note: ["Plik przejdzie przez podgląd bezpieczeństwa, a poprzednia konfiguracja zostanie zapamiętana do cofnięcia.",
                 "The file goes through the safety preview, and your current configuration is remembered so the import can be undone."]},
  trig: {t: ["Wczytaj preset od kogoś", "Load a preset from somebody"],
         ph: "https://cdn.discordapp.com/attachments/…/ribbitflip-profile-….json",
         note: ["Preset podmieni same wyzwalacze i nie ruszy osi, myszy ani MIDI. Rozpoznaję plik po zawartości: jeśli okaże się całym zestawem, wczytam go jako zestaw. Tak czy tak: podgląd bezpieczeństwa i możliwość cofnięcia.",
                "A preset replaces the triggers only and leaves the axes, the mouse and MIDI alone. I recognise a file by its contents: if it turns out to be a whole setup, it arrives as a setup. Either way: the safety preview, and it can be undone."]},
  axis: {t: ["Wczytaj preset osi 3D od kogoś", "Load a 3D axis preset from somebody"],
         ph: "https://cdn.discordapp.com/attachments/…/ribbitflip-pose-….json",
         note: ["Preset osi zmienia strojenie kapsla, którego masz teraz wybranego do edycji: kanały, filtr, czułość, odwrócenie i tor sygnału. Obecne osie zapiszę wcześniej jako preset, żeby dało się do nich wrócić. Nie ma tu podglądu bezpieczeństwa, bo preset osi nie niesie żadnych klawiszy ani makr.",
                "An axis preset changes the tuning of the capsule you currently have picked for editing: channels, filter, sensitivity, inversion and the signal chain. I will save your current axes as a preset first, so you can go back to them. There is no safety preview here, because an axis preset carries no keystrokes and no macros."]},
  pack: {t: ["Wczytaj paczkę akcji od kogoś", "Load an action pack from somebody"],
         ph: "https://cdn.discordapp.com/attachments/…/ribbitflip-akcje-….json",
         note: ["Paczka wejdzie do tej aplikacji REST, z przeglądem każdej akcji przed dodaniem: ruch przy oznaczonej akcji przychodzi wyłączony, a poświadczenia zostają Twoje.",
                "The pack goes into this REST application, with every action shown before it is added: a movement attached to a flagged action arrives switched off, and the credentials stay yours."]}
};
// …i rodzaje, które własnych zdań nie mają — z rejestru (rf-49-kinds), nigdy NAD istniejącymi.
// Do 2026-08-31 stały tu cztery pozycje, a rodzajów było jedenaście: okno otwarte dla presetu
// myszy mówiło o zestawie, bo `RFL_COPY[o.kind]` nie istniał i wybór spadał na „setup".
(function () {
  const R = (typeof RF_KINDS !== "undefined") ? RF_KINDS : (window.RF_KINDS || {});
  for (const id in R) {
    const K = R[id];
    if (!K.importable || !K.shareId || RFL_COPY[K.shareId]) continue;
    RFL_COPY[K.shareId] = {
      t: ["Wczytaj plik lub odnośnik: " + K.pl.one, "Load a file or link: " + K.en.one],
      ph: "https://cdn.discordapp.com/attachments/…/" + K.file + "….json",
      // Zdanie „co ten plik zrobi" bierzemy z rejestru, bo to TO SAMO zdanie, które stoi nad listą
      // w Bibliotece i w kreatorze posta. Do niego dokładamy jedno o drodze, którą plik pójdzie.
      note: [K.explain[0] + " Zanim cokolwiek się zmieni, pokażę, co ten plik niesie, i odłożę go w bibliotece pod wolną nazwą; nic nie nadpiszę.",
             K.explain[1] + " Before anything changes I show what the file carries, and it lands in your library under a free name; nothing is overwritten."]
    };
  }
})();

// opts (optional): {kind: "setup"|"trig"|"axis"|"pack", api: <REST application, for "pack">}.
function rfLinkOpen(opts) {
  if (_rflBack) return;
  const o = opts || {};
  const kind = RFL_COPY[o.kind] ? o.kind : "setup";
  const C = RFL_COPY[kind];
  const api = (kind === "pack") ? o.api : null;
  const _t = function (pair) { return (pair[1] == null) ? pair[0] : _gl(pair[0], pair[1]); };
  _rflPrevFocus = document.activeElement;

  const back = document.createElement("div");
  back.className = "rfk-back rfl-back"; back.setAttribute("role", "presentation");
  const card = document.createElement("div");
  card.className = "rfk-card rfl-card";
  card.setAttribute("role", "dialog"); card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-label", _t(C.t));

  const head = document.createElement("div"); head.className = "rfk-head";
  const h = document.createElement("h3"); h.className = "rfk-title";
  h.textContent = _t(C.t);
  const x = document.createElement("button"); x.type = "button"; x.className = "rfk-x";
  x.setAttribute("aria-label", "Zamknij"); x.textContent = "×";
  x.addEventListener("click", rfLinkClose);
  head.appendChild(h); head.appendChild(x);

  const body = document.createElement("div"); body.className = "rfl-body";
  const intro = document.createElement("p"); intro.className = "rfs-intro";
  intro.textContent = _gl("Wybierz plik .json z dysku albo wklej odnośnik do pliku z posta. Możesz też po prostu upuścić plik na okno aplikacji.",
                          "Pick the .json from disk, or paste the link to the file from a post. You can also simply drop the file onto the app window.");
  body.appendChild(intro);

  // Disk first: it is the one route that needs no server, no allowlist and no address that expires.
  // The input is built here and dies with the window, so a cancelled pick leaves nothing behind.
  const pickRow = document.createElement("div"); pickRow.className = "rfs-row";
  const pick = document.createElement("button"); pick.type = "button"; pick.className = "btn sm";
  pick.textContent = _gl("Wybierz plik z dysku", "Pick a file from disk");
  const fileInp = document.createElement("input");
  fileInp.type = "file"; fileInp.accept = "application/json,.json";
  fileInp.style.display = "none"; fileInp.tabIndex = -1;
  fileInp.setAttribute("aria-hidden", "true");
  pick.addEventListener("click", function () { try { fileInp.value = ""; fileInp.click(); } catch (e) {} });
  pickRow.appendChild(pick); pickRow.appendChild(fileInp);
  body.appendChild(pickRow);

  const orLab = document.createElement("p"); orLab.className = "rfs-intro";
  orLab.textContent = _gl("albo wklej odnośnik:", "or paste a link:");
  body.appendChild(orLab);

  const row = document.createElement("div"); row.className = "rfs-row";
  const lab = document.createElement("label"); lab.className = "rfs-lab";
  lab.textContent = "Adres pliku";
  const field = document.createElement("input");
  field.className = "rfs-field"; field.type = "url"; field.spellcheck = false;
  field.placeholder = C.ph;
  lab.appendChild(field); row.appendChild(lab);
  const go = document.createElement("button"); go.type = "button"; go.className = "btn sm primary rfl-go";
  go.textContent = "Wczytaj";
  row.appendChild(go);
  body.appendChild(row);

  const msg = document.createElement("p"); msg.className = "rfl-msg"; msg.setAttribute("role", "status");
  msg.setAttribute("aria-live", "polite");
  body.appendChild(msg);

  const note = document.createElement("p"); note.className = "rfs-hint-add rfl-note";
  note.textContent = _t(C.note);
  body.appendChild(note);

  const foot = document.createElement("div"); foot.className = "rfk-foot";
  const fnote = document.createElement("span"); fnote.className = "rfk-note";
  fnote.textContent = "Pobieram tylko z załączników Discorda i z GitHuba.";
  const out = document.createElement("a"); out.className = "rfk-out";
  out.href = RFL_HOWTO; out.target = "_blank"; out.rel = "noopener noreferrer";
  // Composed from the channel name, so `data-noi18n` + `_gl` rather than a dictionary key: a key
  // like „Otwórz #zestawy ↗" stops matching the day the channel is renamed, and the label would
  // quietly stay Polish. This window is rebuilt on every open, so there is nothing to repaint.
  out.setAttribute("data-noi18n", "");
  out.textContent = _gl("Otwórz ", "Open ") + RF_FORUM_NAME + " ↗";
  foot.appendChild(fnote); foot.appendChild(out);

  const say = function (t, bad) {
    msg.textContent = t || "";
    msg.classList.toggle("bad", !!bad);
  };

  // A pack lands INSIDE one REST application, so when this window knows which one (it was opened
  // from that card), the bytes go straight to that module's review. Everything else goes to the
  // sniffer, exactly as a dropped file does — nothing is parsed here, because a second reader is a
  // second set of rules to keep in step, and this window is a door, not a reader.
  const packText = function () {
    return api ? ((window.RESTAPI && window.RESTAPI.importPackText) || null) : null;
  };
  fileInp.addEventListener("change", function () {
    const f = fileInp.files && fileInp.files[0];
    fileInp.value = "";
    if (!f) return;
    const fn = packText();
    if (fn) {
      const fr = new FileReader();
      const oops = function () { say(_gl("Nie udało się odczytać pliku.", "Could not read the file."), true); };
      fr.onerror = oops;
      fr.onload = function () { rfLinkClose(); fn(api, String(fr.result == null ? "" : fr.result)); };
      try { fr.readAsText(f); } catch (e) { oops(); }
      return;
    }
    rfLinkClose();
    // No application in hand (or the REST module not loaded): the sniffer route knows a pack when
    // it sees one and asks which application should take it, so this still leads somewhere.
    if (typeof _rfDropDispatch === "function") _rfDropDispatch(f);
  });

  let busy = false;
  const submit = function () {
    if (busy) return;
    const raw = (field.value || "").trim();
    if (!raw) { say(_gl("Wklej adres pliku.", "Paste the file address."), true); field.focus(); return; }
    const url = _rflNormalize(raw);
    const local = _rflLocalProblem(url);
    if (local) { say(local, true); return; }
    busy = true; go.disabled = true;
    say(_gl("Pobieram…", "Downloading…"), false);
    fetch("/setup/fetch", {method: "POST", headers: {"Content-Type": "application/json"},
                           body: JSON.stringify({url: url})})
      .then(function (r) { return r.json(); })
      .then(function (res) {
        busy = false; go.disabled = false;
        if (!res || !res.ok) { say(_rflServerProblem(res), true); return; }
        // A pack goes to the REST application this window was opened from — "which application" is
        // not written in the file, so only this window can answer it. Same review modal as a file
        // import, reached through the module's own entry point. Without an application in hand the
        // bytes fall through to the ordinary route below, which asks the question instead of
        // refusing the file.
        const packFn = packText();
        if (packFn) {
          rfLinkClose();
          packFn(api, JSON.stringify(res.envelope));
          return;
        }
        // Hand the bytes to the ordinary import path as if they had been dropped from disk:
        // one code path means the link route can never quietly skip a check the file route does.
        const name = (res.envelope && res.envelope.name ? String(res.envelope.name) : "z-linku") + ".json";
        let file;
        try {
          file = new File([JSON.stringify(res.envelope)], name, {type: "application/json"});
        } catch (e) {                       // older engines: File constructor missing
          file = new Blob([JSON.stringify(res.envelope)], {type: "application/json"});
          file.name = name;
        }
        try { if (window.rfSetImportOrigin) window.rfSetImportOrigin(url); } catch (e) {}
        rfLinkClose();
        _rfDropDispatch(file);
      })
      .catch(function () {
        busy = false; go.disabled = false;
        say(_gl("Serwer nieosiągalny.", "Server unreachable."), true);
      });
  };
  go.addEventListener("click", submit);
  field.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); submit(); } });

  card.appendChild(head); card.appendChild(body); card.appendChild(foot);
  back.appendChild(card);
  back.addEventListener("mousedown", function (e) { if (e.target === back) rfLinkClose(); });
  back._onKey = function (e) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); rfLinkClose(); return; }
    if (e.key !== "Tab") return;
    const f = Array.prototype.filter.call(
      card.querySelectorAll('a[href],button:not([disabled]),input,textarea'),
      function (el) { return el.offsetParent !== null; });
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener("keydown", back._onKey, true);
  document.body.appendChild(back);
  _rflBack = back;
  try { if (typeof applyLang === "function") applyLang(back); } catch (e) {}
  setTimeout(function () { try { field.focus(); } catch (e) {} }, 30);
}

// There is no initLinkImport() any more. This window used to hang off one button in the "Plik
// zestawu:" strip ("Import z linku"), and that strip is gone: taking a file from somebody is now
// offered where the question comes up — the exchange row at the top of the Library tab, the
// exchange window at every save bar, an empty drawer in the library — and all three of them call
// rfLinkOpen() directly. Nothing to wire at boot, so nothing is wired.

window.rfLinkOpen = rfLinkOpen;
window.rfLinkClose = rfLinkClose;
