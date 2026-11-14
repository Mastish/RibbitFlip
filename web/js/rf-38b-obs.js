"use strict";
// ============ Uslugi sieciowe — the OBS Studio card (obs-websocket 5) ============
// One card, one connection, for the whole application. It does three things and nothing else:
// it says where OBS is, it opens the socket, and it signs the challenge with the password from
// the vault. Sending happens where every other action is sent from — an application in the list
// below, with transport "ws" (see restBuildRequest in rf-36).
//
// WHY THE SOCKET IS NOT HERE. The panel is served with `connect-src 'self'`, so this page cannot
// open ws://127.0.0.1:4455 at all — the browser refuses before OBS ever hears about it. The socket
// is therefore held by the RibbitFlip server (ObsClient in ribbitflip_monitor.py) and driven from
// here through four ordinary POSTs: /obs/connect, /obs/identify, /obs/send, /obs/disconnect.
//
// WHY THE PASSWORD STILL DOES NOT LEAVE THIS BROWSER. obs-websocket does not take a password. It
// sends a challenge and a salt, and takes a digest that proves you know the password:
//
//     authentication = base64(sha256( base64(sha256(password + salt)) + challenge ))
//
// That is computed HERE, with crypto.subtle, from the vault entry — and only the result is posted.
// The same formula is written into tests/test_obs_ws.py, where a dummy OBS computes it with
// hashlib and refuses anything else; if the two ever drift apart, that test is where it shows.
// The state of the link is asked ON DEMAND — when the tab is opened and after every button in
// the card — and never polled: an idle panel has no reason to keep asking a question whose answer
// only changes when somebody does something, here or in OBS.
let _raObsBusy = false;             // one connect/disconnect at a time — the buttons are disabled meanwhile
let _raObsState = null;             // last answer from GET /obs/state

function _raObsT(pl, en) { try { if (typeof _gl === "function") return _gl(pl, en); } catch (e) {} return pl; }
function _raObsStr(v, max) { const s = (v == null) ? "" : String(v); return max ? s.slice(0, max) : s; }
function _raObsCfg() {
  try {
    if (!window.RESTAPI || !RESTAPI.cfg) return null;
    RESTAPI.cfg.settings = RESTAPI.cfg.settings || {};
    if (!RESTAPI.cfg.settings.obs || typeof RESTAPI.cfg.settings.obs !== "object")
      RESTAPI.cfg.settings.obs = { host: "127.0.0.1", port: 4455, credId: "" };
    return RESTAPI.cfg.settings.obs;
  } catch (e) { return null; }
}
function _raObsSave() { try { if (typeof restSave === "function") restSave(); } catch (e) {} }
function _raObsSay(msg) { try { if (typeof rfSkullSay === "function") rfSkullSay(msg, { tone: "danger" }); } catch (e) {} }
function _raObsToast(msg, tone) { try { if (typeof rfToast === "function") rfToast(msg, tone ? { tone: tone } : undefined); } catch (e) {} }

// ---------- the digest ----------
async function _raObsDigest(password, salt, challenge) {
  const sub = (window.crypto && window.crypto.subtle) || null;
  if (!sub) throw new Error(_raObsT("Ta przeglądarka nie ma crypto.subtle — otwórz panel przez http://127.0.0.1:…",
                                    "This browser has no crypto.subtle — open the panel via http://127.0.0.1:…"));
  const enc = new TextEncoder();
  const b64 = function (buf) {
    const b = new Uint8Array(buf); let s = "";
    for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s);
  };
  const secret = b64(await sub.digest("SHA-256", enc.encode(String(password) + String(salt))));
  return b64(await sub.digest("SHA-256", enc.encode(secret + String(challenge))));
}

// What the user READS when a connection fails. The server answers with a `code` as well as a
// sentence, and the code is what gets phrased here: that file writes Polish without diacritics
// (it is a console file) and this text is read in a card, not in a console. An unknown code falls
// back to the server's own sentence rather than to silence.
function _raObsWhy(r) {
  const c = _raObsStr(r && r.code, 32);
  const raw = _raObsStr(r && r.error, 300);
  switch (c) {
    case "bad-port":
      return _raObsT("Port musi być liczbą od 1 do 65535.", "The port must be a number between 1 and 65535.");
    case "public-host":
      return _raObsT("Ten adres jest publiczny. RibbitFlip łączy się z OBS-em tylko na tym komputerze albo w sieci lokalnej.",
                     "That address is public. RibbitFlip only connects to OBS on this machine or on your local network.");
    case "bad-host-name":
      return _raObsT("Wpisz adres IP, nie nazwę — na przykład 127.0.0.1 albo 192.168.0.12.",
                     "Enter an IP address, not a name — for example 127.0.0.1 or 192.168.0.12.");
    case "refused-tcp":
      return _raObsT("OBS odrzucił połączenie. Włącz w nim Narzędzia → Ustawienia serwera WebSocket i sprawdź port.",
                     "OBS refused the connection. Switch on Tools → WebSocket Server Settings there and check the port.");
    case "timeout":
      return _raObsT("OBS nie odpowiada pod tym adresem. Czy serwer WebSocket jest włączony?",
                     "OBS is not answering at that address. Is the WebSocket server switched on?");
    case "unreachable":
      return _raObsT("Nie mogę się połączyć z tym adresem.", "I cannot reach that address.");
    case "not-obs":
    case "handshake":
      return _raObsT("Pod tym adresem nie ma serwera obs-websocket 5. Sprawdź port (domyślnie 4455) i wersję OBS-a (28 lub nowsza).",
                     "There is no obs-websocket 5 server at that address. Check the port (4455 by default) and the OBS version (28 or newer).");
    case "refused":
      return _raObsT("OBS odrzucił połączenie — sprawdź hasło serwera WebSocket.",
                     "OBS refused the connection — check the WebSocket server password.");
    case "no-identified":
      return _raObsT("OBS nie potwierdził połączenia.", "OBS did not confirm the connection.");
    case "expired":
      return _raObsT("Minął czas na podanie hasła — kliknij „Połącz” jeszcze raz.",
                     "The time to give the password ran out — press “Connect” again.");
    case "no-link":
      return _raObsT("Nie ma otwartego połączenia — kliknij „Połącz”.",
                     "There is no open connection — press “Connect”.");
    case "link-lost":
      return _raObsT("Połączenie z OBS zostało zerwane.", "The connection to OBS was lost.");
    default:
      return raw || _raObsT("Nie udało się połączyć z OBS.", "Could not connect to OBS.");
  }
}

// ---------- the card ----------
// LOOKUP ONLY — deliberately. Everything except restObsInit() can run before the tab has been
// built (the tab bar restores the remembered tab at startup, and that fires restObsRefresh),
// and a lookup that CREATED the card would put it wherever the panel happened to be at that
// moment: straight onto #tab-restapi, above the .ra-wrap that _raBuildUI appends a moment later.
// The card then sits outside the column with every other card, and nothing errors out to say so.
function _raObsBox() {
  const root = (window.RESTAPI && RESTAPI.root) || document.getElementById("tab-restapi");
  if (!root) return null;
  const card = root.querySelector("#raObsCard");
  return card ? card.querySelector("#raObsBody") : null;
}

// The one place that BUILDS it, called from initRest — after _raBuildUI, so .ra-wrap is there.
function _raObsMakeBox() {
  const root = (window.RESTAPI && RESTAPI.root) || document.getElementById("tab-restapi");
  if (!root) return null;
  const wrap = root.querySelector(".ra-wrap");
  if (!wrap) return null;                       // too early — restObsInit will be called again
  let card = root.querySelector("#raObsCard");
  if (card) return card.querySelector("#raObsBody");
  // PIĘTRO 2 (UX 261120 L4c): połączenie z OBS ustawia się raz, więc to zwijak w karcie aplikacji
  // (#raTier2 z rf-35). W nagłówku stoi stan i adres, więc zwinięty nie chowa „rozłączono” ani błędu.
  card = document.createElement("details");
  card.className = "cardfold inset ra-fold";
  card.id = "raObsCard";
  card.innerHTML =
    '<summary>OBS Studio</summary>' +
    '<div class="cardfold-body"><p class="hint ra-fold-hint">połączenie przez obs-websocket, jedno na całą aplikację</p>' +
    '<div class="ra-body" id="raObsBody"></div></div>';
  const slot = wrap.querySelector("#raTier2");
  const apis = wrap.querySelector("#raApisCard");
  if (slot) slot.insertBefore(card, slot.firstChild);
  else if (apis && apis.parentNode === wrap) wrap.insertBefore(card, apis.nextSibling);
  else wrap.appendChild(card);
  try {
    if (typeof rfTier === "function") _raObsSync = rfTier(card, "uslugi.obs", { sum: _raObsSum, changed: _raObsChanged });
  } catch (e) { }
  return card.querySelector("#raObsBody");
}
let _raObsSync = null;
// Nagłówek zwijaka: stan połączenia (z pigułki, bez emoji) i adres; błąd ostatniej próby wygrywa.
function _raObsSum() {
  const st = _raObsState || {}, c = _raObsCfg() || {};
  const pill = document.getElementById("raObsPill");
  let state = pill ? pill.textContent.replace(/^[^\p{L}]+/u, "") : "";
  if (!st.identified && st.lastError) state = _raObsT("błąd połączenia", "connection error");
  return state + " · " + (_raObsStr(c.host) || "127.0.0.1") + ":" + (parseInt(c.port, 10) || 4455);
}
function _raObsChanged() {
  const c = _raObsCfg() || {};
  return ((_raObsStr(c.host) || "127.0.0.1") !== "127.0.0.1" ? 1 : 0) +
         ((parseInt(c.port, 10) || 4455) !== 4455 ? 1 : 0) + (c.credId ? 1 : 0);
}

function restObsInit() {
  const box = _raObsMakeBox();
  if (!box) return;
  box.innerHTML =
    '<div class="ra-lead">Steruj OBS-em ruchem kapsla: przełącz scenę, włącz nagrywanie, zapisz powtórkę. ' +
      'Najpierw w OBS otwórz <b>Narzędzia → Ustawienia serwera WebSocket</b> i włącz serwer, potem połącz się tutaj. ' +
      'Hasło trzymaj w sejfie: do OBS-a jedzie wyłącznie podpis, nigdy samo hasło.</div>' +
    '<div class="ra-grid">' +
      '<label class="ra-fld"><span>Adres OBS-a</span><input type="text" class="ra-obs-host ra-mono" maxlength="80" placeholder="127.0.0.1"></label>' +
      '<label class="ra-fld"><span>Port</span><input type="number" class="ra-obs-port" min="1" max="65535" step="1"></label>' +
      '<label class="ra-fld ra-wide"><span>Hasło z sejfu</span><select class="ra-obs-cred"></select></label>' +
    '</div>' +
    '<div class="ra-set-bar">' +
      '<span class="ra-pill" id="raObsPill"></span>' +
      '<button type="button" class="btn sm ra-obs-go" title="Otwórz połączenie z OBS Studio"><span class="bic bic-connect" aria-hidden="true"></span>Połącz</button>' +
      '<button type="button" class="btn sm ra-obs-off" title="Zamknij połączenie z OBS Studio">Rozłącz</button>' +
      '<span class="ra-set-note" id="raObsNote"></span>' +
    '</div>';
  const q = function (s) { return box.querySelector(s); };
  const cfg = _raObsCfg() || { host: "127.0.0.1", port: 4455, credId: "" };

  const h = q(".ra-obs-host");
  h.value = _raObsStr(cfg.host) || "127.0.0.1";
  h.addEventListener("change", function () {
    const c = _raObsCfg(); if (!c) return;
    c.host = _raObsStr(h.value, 80).trim() || "127.0.0.1";
    h.value = c.host; _raObsSave();
  });
  const p = q(".ra-obs-port");
  p.value = parseInt(cfg.port, 10) || 4455;
  p.addEventListener("change", function () {
    const c = _raObsCfg(); if (!c) return;
    let n = parseInt(p.value, 10);
    if (!isFinite(n) || n < 1 || n > 65535) n = 4455;
    c.port = n; p.value = n; _raObsSave();
  });
  const cs = q(".ra-obs-cred");
  cs.addEventListener("change", function () {
    const c = _raObsCfg(); if (!c) return;
    c.credId = _raObsStr(cs.value, 40); _raObsSave();
  });
  q(".ra-obs-go").addEventListener("click", function () { _raObsConnect(); });
  q(".ra-obs-off").addEventListener("click", function () { _raObsDisconnect(); });
  _raObsFillCreds();
  restObsRefresh();
}

// The credential picker lists ONLY `obspass` entries — a Bearer token is not an OBS password, and
// offering it here would be offering a mistake. A locked vault has no list to give, which is a
// sentence rather than an empty box.
function _raObsFillCreds() {
  const box = _raObsBox();
  if (!box) return;
  const sel = box.querySelector(".ra-obs-cred");
  if (!sel) return;
  const cfg = _raObsCfg() || {};
  let list = [];
  try { if (typeof restCredList === "function") list = restCredList() || []; } catch (e) { list = []; }
  const mine = list.filter(function (c) { return c && c.kind === "obspass"; });
  sel.innerHTML = "";
  const none = document.createElement("option");
  none.value = "";
  none.textContent = _raObsT("— bez hasła (serwer WebSocket bez uwierzytelniania) —",
                             "— no password (WebSocket server without authentication) —");
  sel.appendChild(none);
  for (const c of mine) {
    const o = document.createElement("option");
    o.value = c.id;
    o.textContent = (c.name || c.id) + " · " + c.id;
    sel.appendChild(o);
  }
  const want = _raObsStr(cfg.credId, 40);
  // A saved id that is not in the list (vault locked, or the entry was deleted) is kept rather
  // than silently reset to "no password" — resetting it would look like the setting never stuck.
  if (want && !mine.some(function (c) { return c.id === want; })) {
    const o = document.createElement("option");
    o.value = want;
    o.textContent = want + " " + _raObsT("(sejf zamknięty albo poświadczenie usunięte)",
                                         "(vault locked, or the credential is gone)");
    sel.appendChild(o);
  }
  sel.value = want || "";
}

function _raObsSetBusy(on) {
  _raObsBusy = !!on;
  const box = _raObsBox();
  if (!box) return;
  const g = box.querySelector(".ra-obs-go"), o = box.querySelector(".ra-obs-off");
  if (g) g.disabled = _raObsBusy;
  if (o) o.disabled = _raObsBusy;
}

function _raObsPaint(note) {
  const box = _raObsBox();
  if (!box) return;
  const pill = box.querySelector("#raObsPill");
  const st = _raObsState || {};
  if (pill) {
    let txt, cls = "";
    if (_raObsBusy) { txt = _raObsT("⏳ Łączę…", "⏳ Connecting…"); }
    else if (st.identified) {
      txt = _raObsT("🟢 Połączono", "🟢 Connected") +
            (st.obsVersion ? (" · OBS " + st.obsVersion) : "");
      cls = "ok";
    } else if (st.connected) { txt = _raObsT("🟡 Czeka na hasło", "🟡 Waiting for the password"); cls = "warn"; }
    else { txt = _raObsT("⚪ Rozłączono", "⚪ Disconnected"); }
    pill.textContent = txt;
    pill.className = "ra-pill" + (cls ? (" " + cls) : "");
  }
  const n = box.querySelector("#raObsNote");
  if (n) {
    if (note) n.textContent = note;
    else if (st.identified)
      n.textContent = _raObsT("Akcje aplikacji OBS z listy wyżej idą tym połączeniem.",
                              "The actions of an OBS application in the list above travel over this connection.");
    else if (st.lastError) n.textContent = st.lastError;
    else
      n.textContent = _raObsT("Połączenie nie wraca samo po restarcie OBS-a ani aplikacji. Kliknij „Połącz”.",
                              "The connection does not come back by itself after OBS or the app restarts. Press “Connect”.");
  }
  try { if (_raObsSync) _raObsSync(); } catch (e) { }
  const off = box.querySelector(".ra-obs-off");
  if (off) off.hidden = !(st.connected || st.identified);
  const go = box.querySelector(".ra-obs-go");
  // PNG .bic-connect + plain verb (no 🔌/🔄 emoji) — the same look as every other button of this
  // module and of the panel; _raBtnLabel lives in rf-35, the fallback keeps the verb alone.
  if (go) {
    const lab = st.identified ? _raObsT("Połącz ponownie", "Reconnect") : _raObsT("Połącz", "Connect");
    if (typeof _raBtnLabel === "function") _raBtnLabel(go, lab, "bic-connect"); else go.textContent = lab;
  }
}

// Asked when the tab is opened and after every button here. NOT polled: an idle panel has no
// reason to keep asking a question whose answer only changes when somebody does something.
function restObsRefresh() {
  const box = _raObsBox();
  if (!box) return Promise.resolve(null);
  _raObsFillCreds();
  return fetch("/obs/state").then(function (r) { return r.json(); }).then(function (j) {
    _raObsState = (j && j.ok === true) ? j : null;
    _raObsPaint();
    return _raObsState;
  }).catch(function () { _raObsPaint(); return null; });
}

function _raObsPost(path, body) {
  return fetch(path, { method: "POST", headers: { "Content-Type": "application/json" },
                       body: JSON.stringify(body || {}) })
    .then(function (r) { return r.json().catch(function () { return null; }); });
}

async function _raObsConnect() {
  if (_raObsBusy) return;
  const cfg = _raObsCfg();
  if (!cfg) { _raObsSay(_raObsT("Moduł Usługi sieciowe nie jest jeszcze gotowy.",
                                "The Network services module is not ready yet.")); return; }
  _raObsSetBusy(true);
  _raObsPaint(_raObsT("Otwieram połączenie…", "Opening the connection…"));
  try {
    const r = await _raObsPost("/obs/connect", { host: cfg.host, port: cfg.port });
    if (!r || r.ok !== true) {
      _raObsState = null;
      const why = _raObsWhy(r);
      _raObsSetBusy(false); _raObsPaint(why); _raObsSay(why);
      return;
    }
    if (r.needAuth !== true) {                       // no password on the OBS side — already done
      _raObsSetBusy(false);
      await restObsRefresh();
      _raObsToast(_raObsT("Połączono z OBS Studio.", "Connected to OBS Studio."), "ok");
      return;
    }
    // OBS wants proof of the password. Everything below happens in this browser.
    if (!cfg.credId) {
      await _raObsPost("/obs/disconnect", {});
      _raObsState = null; _raObsSetBusy(false);
      const why = _raObsT("OBS ma ustawione hasło serwera WebSocket. Dodaj je do sejfu jako „Hasło OBS (WebSocket)” i wybierz tutaj.",
                          "OBS has a WebSocket server password set. Add it to the vault as “OBS password (WebSocket)” and pick it here.");
      _raObsPaint(why); _raObsSay(why);
      return;
    }
    let cred = null;
    try { if (typeof restGetCred === "function") cred = restGetCred(cfg.credId); } catch (e) { cred = null; }
    const pass = cred && cred.fields ? _raObsStr(cred.fields.password) : "";
    if (!cred || !pass) {
      await _raObsPost("/obs/disconnect", {});
      _raObsState = null; _raObsSetBusy(false);
      const why = cred
        ? _raObsT("Wybrane poświadczenie nie ma wpisanego hasła.", "The selected credential has no password in it.")
        : _raObsT("Sejf jest zamknięty — odblokuj go, żeby połączyć się z OBS.",
                  "The vault is locked — unlock it to connect to OBS.");
      _raObsPaint(why); _raObsSay(why);
      return;
    }
    let digest = "";
    try { digest = await _raObsDigest(pass, r.salt, r.challenge); }
    catch (e) {
      await _raObsPost("/obs/disconnect", {});
      _raObsState = null; _raObsSetBusy(false);
      const why = (e && e.message) || _raObsT("Nie udało się podpisać hasła.", "Could not sign the password.");
      _raObsPaint(why); _raObsSay(why);
      return;
    }
    const r2 = await _raObsPost("/obs/identify", { authentication: digest });
    _raObsSetBusy(false);
    if (!r2 || r2.ok !== true) {
      _raObsState = null;
      const why = _raObsWhy(r2);
      _raObsPaint(why); _raObsSay(why);
      return;
    }
    await restObsRefresh();
    _raObsToast(_raObsT("Połączono z OBS Studio.", "Connected to OBS Studio."), "ok");
  } catch (e) {
    _raObsSetBusy(false);
    _raObsPaint(_raObsT("Nie udało się porozmawiać z serwerem RibbitFlip.",
                        "Could not reach the RibbitFlip server."));
  } finally {
    _raObsSetBusy(false);
  }
}

function _raObsDisconnect() {
  if (_raObsBusy) return;
  _raObsSetBusy(true);
  _raObsPost("/obs/disconnect", {}).then(function () {
    _raObsSetBusy(false);
    return restObsRefresh();
  }).catch(function () { _raObsSetBusy(false); _raObsPaint(); });
}

// The pill, the note, the two buttons and the credential picker are composed with _raObsT() when
// they are PAINTED, so without this they keep the language they were painted in — a green
// „Połączono" sitting in an otherwise English tab. Same contract as miRelang / hkRelang / rfLibRelang.
function restObsRelang() {
  if (!document.getElementById("raObsCard")) return;
  try { _raObsFillCreds(); } catch (e) {}
  try { _raObsPaint(); } catch (e) {}
}

try {
  if (window.RESTAPI) {
    window.RESTAPI.obsRefresh = restObsRefresh;
    window.RESTAPI.obsState = function () { return _raObsState; };
  }
} catch (e) {}
