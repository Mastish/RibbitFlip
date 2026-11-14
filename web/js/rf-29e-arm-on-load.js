"use strict";
// ==================================================================================================
//  WŁĄCZ OD RAZU PO WCZYTANIU — decyzja człowieka, zapamiętana; plik nadal niczego nie uzbraja
//
//  Zestaw niesie KONFIGURACJĘ, nigdy uzbrojenie (apply_setup, tests/test_setup_switches.py). Do
//  13.09 jedynym miejscem, w którym człowiek dowiadywał się, że wczytany zestaw ma u autora
//  włączone Mapowanie i Sterowanie ruchem, był dymek PO wczytaniu: 20 sekund, łatwo przegapić,
//  a po jego zniknięciu zestaw „nie działa" bez śladu dlaczego. Dlatego przy
//  wczytaniu można od razu zaznaczyć aktywację elementów, które powinny być włączone.
//
//  Dwie rzeczy, w tej kolejności:
//    1. PRZED wczytaniem widać, co autor miał włączone — w oknie importu (rf-28) i w opisie zestawu
//       w Bibliotece (rf-39i2). Serwer czyta to z samego pliku (`setup_wants_on`), więc zdanie pada,
//       zanim cokolwiek się zmieni.
//    2. Pole „Wczytaj i od razu aktywuj zestaw" — zaznaczone raz, pamiętane (localStorage), to samo w oknie
//       importu i w Bibliotece. Zaznaczenie JEST tym „jednym świadomym kliknięciem" z zasady: plik
//       dalej nic nie włącza, włącza człowiek, który to pole zaznaczył. Odznaczone = dotychczasowy
//       dymek „Włącz teraz" po przeładowaniu, bez zmian.
//
//  Co się włącza: WYŁĄCZNIE to, co serwer zwrócił w `switchesKeptBy` po wczytaniu — grupy, które
//  plik miał włączone, a ten komputer ma wyłączone (`_switches_to_arm`). Nie „wszystko z pliku":
//  grupę, którą autor miał wyłączoną, a Ty włączoną, zestaw zostawia w spokoju, jak dotąd.
//
//  W symulacji z zablokowanymi wyjściami (rf-39f) pole NIE włącza niczego po cichu: wyjścia są tam
//  prawdziwe i każde włączenie przechodzi przez pytanie. Zostaje dymek z przyciskiem, który to
//  pytanie zadaje — i osobne zdanie, dlaczego „od razu" tym razem nie zadziałało.
//
//  Ładowany po rf-29 (jego „Włącz teraz" woła rfArmSwitches stąd w chwili kliknięcia, nie przy
//  ładowaniu) i przed rf-39i (Biblioteka czyta rfArmPref przy wczytywaniu).
// ==================================================================================================

const RF_ARM_KEY = "ribbitflip.load.armNow";

function rfArmPref() {
  try { return localStorage.getItem(RF_ARM_KEY) === "1"; } catch (e) { return false; }
}
function rfArmPrefSet(v) {
  try { localStorage.setItem(RF_ARM_KEY, v ? "1" : "0"); } catch (e) { }
}

// Nazwa grupy w języku panelu; klucze serwera (rules/mouse/midi/osc) zna rf-39j.
function rfArmGroupName(k) {
  const n = (typeof rfGroupName === "function") ? rfGroupName(k) : "";
  return n || String(k || "");
}

// „Toczenie (Mapowanie, Mysz i kontroler), Skok (Mapowanie)" — pogrupowane PO KAPSLU, bo tak
// człowiek to potem sprawdza: idzie do jednego kapsla, potem do następnego. Lista bez nazw
// (jeden kapsel) to samo „Mapowanie, Mysz i kontroler". Przyjmuje też płaską listę kluczy.
function rfArmList(by) {
  const out = [];
  (Array.isArray(by) ? by : []).forEach(function (it) {
    if (typeof it === "string") { const n = rfArmGroupName(it); if (n) out.push(n); return; }
    const gs = ((it && it.groups) || []).map(rfArmGroupName).filter(Boolean);
    if (!gs.length) return;
    out.push(it.name ? (it.name + " (" + gs.join(", ") + ")") : gs.join(", "));
  });
  return out.join(", ");
}

// Z odpowiedzi /setup/analyze (jeden kapsel: `wantsOn`) albo /bundle/analyze (`devices[].wantsOn`
// z nazwą ROLI, bo to rola jest słowem autora, nie numer slotu): [{name, groups}] tego, co autor
// miał włączone. Pusta lista = plik nie ma nic włączonego i nie ma o czym mówić.
function rfArmWantsBy(a) {
  if (!a || typeof a !== "object") return [];
  if (Array.isArray(a.devices)) {
    return a.devices.map(function (d) {
      return { name: String((d && d.role && d.role.name) || (d && d.devName) || ""),
               groups: (d && Array.isArray(d.wantsOn)) ? d.wantsOn : [] };
    }).filter(function (x) { return x.groups.length; });
  }
  return (Array.isArray(a.wantsOn) && a.wantsOn.length) ? [{ name: "", groups: a.wantsOn }] : [];
}

// Ramka do okna importu (rf-28): pole „Wczytaj i od razu aktywuj zestaw" + co dokładnie się włączy.
// Bursztyn, nie czerwień — wyjście się włączy, ale na wyraźne życzenie; czerwień w tym oknie znaczy
// „to może narobić szkód". Pusta (""), gdy plik nie ma nic włączonego.
//
// KOLEJNOŚĆ JEST TREŚCIĄ. Do 13.09 ramka zaczynała się nagłówkiem „CO AUTOR MIAŁ WŁĄCZONE", a pole
// stało pod nim jako dopisek — czyli całość czytała się jak ciekawostka o obcej osobie, a nie jak
// przełącznik, który sprawia, że zestaw zaczyna działać. Pole „aktywuj zestaw po
// wczytaniu” TAM BYŁO, ale w tej formie nie dało się go rozpoznać.
// Teraz najpierw czynność (pole), potem co konkretnie się włączy, na końcu co będzie bez tego.
//
// Pole celowo zostaje ODZNACZONE na starcie: pierwsze zaznaczenie jest
// świadome, a odpowiedź pamiętana, więc kolejne wczytania startują już z niej. Zasada „plik nigdy
// nie uzbraja wyjść, uzbraja człowiek" zostaje nienaruszona — zaznaczenie JEST tym człowiekiem.
function rfArmBoxHtml(a) {
  const by = rfArmWantsBy(a);
  if (!by.length) return "";
  const esc = (typeof miEsc === "function") ? miEsc : function (s) { return String(s); };
  return '<div class="ts-arm"><div class="ts-arm-h">' +
    esc(_gl("Aktywacja po wczytaniu", "Switching it on after loading")) + '</div>' +
    '<label class="ts-ack ts-arm-ack"><input type="checkbox" id="tsArm"' + (rfArmPref() ? ' checked' : '') + '> ' +
    esc(_gl("Wczytaj i od razu aktywuj zestaw", "Load the setup and switch it on right away")) + '</label>' +
    '<div class="ts-arm-l">' +
    esc(_gl("Włączy to, czego zestaw potrzebuje, a Ty masz teraz wyłączone: ",
            "Switches on what the setup needs and you have off right now: ") + rfArmList(by)) + '</div>' +
    '<div class="ts-arm-n">' +
    esc(_gl("Bez zaznaczenia zestaw wczyta się z włącznikami tak, jak są, a po wczytaniu dostaniesz dymek z przyciskiem „Włącz teraz”.",
            "Left unticked, the setup loads with the switches as they are, and after loading you get a note with a “Switch on now” button.")) +
    '</div></div>';
}
// Odczyt pola z okna importu, PRZED zamknięciem okna. Zapamiętuje odpowiedź, żeby następny import
// i Biblioteka zaczynały od niej.
function rfArmTakeChoice() {
  const c = document.getElementById("tsArm");
  if (!c) return false;
  rfArmPrefSet(!!c.checked);
  return !!c.checked;
}

// SAME POST-y. Jedno miejsce dla przycisku „Włącz teraz" (rf-29) i pola „od razu po wczytaniu":
// oba włączają przełącznik tą samą drogą, więc nie mogą się rozjechać. Po kolei, nie równolegle:
// cztery małe żądania najwyżej, a awaria zatrzymuje się na tym, które padło, zamiast pół-uzbroić
// zestaw za zielonym dymkiem. Zwraca {done, left} w kształcie wejścia (per kapsel), żeby dymek po
// przeładowaniu umiał powiedzieć, co poszło, a co zostało do kliknięcia.
async function rfArmSwitches(by) {
  const done = [], left = [];
  for (const it of (Array.isArray(by) ? by : [])) {
    const q = "?dev=" + encodeURIComponent((it && it.dev) || "");
    const ok = [], bad = [];
    for (const g of ((it && it.groups) || [])) {
      let url = null, body = null;
      if (g === "rules") { url = "/trig-enable" + q; body = { enabled: true }; }
      else if (g === "mouse") { url = "/airmouse" + q; body = { enabled: true }; }
      else if (g === "scan") {
        // SKANER — i NIE gołym `{enabled:true}`, choć endpoint takie przyjmie. `ScanModule.sanitize`
        // buduje konfigurację od `dict(DEFAULTS)` i nakłada TYLKO przysłane klucze, więc pakiet
        // z jednym polem ODESŁAŁBY wszystkie dwadzieścia kilka pokręteł do fabrycznych — pasma,
        // prędkości, siatkę, obszar — sekundę po tym, jak zestaw je wczytał. Endpoint chroni sam
        // spis sekcji (bo pokrętła zapisują się z opóźnieniem), ale reszty nie. Więc jak przy MIDI:
        // najpierw czytamy stan, potem zmieniamy jedną rzecz.
        let cur = {};
        try { cur = await fetch("/scan" + q).then(function (r) { return r.json(); }) || {}; } catch (e) { }
        delete cur.ok;              // odpowiedź niesie kopertę `{ok:true, ...cfg}`; `ok` nie jest polem konfiguracji
        url = "/scan" + q;
        body = Object.assign({}, cur, { enabled: true });
      }
      else if (g === "midi" || g === "osc") {
        // MIDI i OSC dzielą jeden obiekt konfiguracji, a set_config traktuje samotne `enabled` jak
        // „stary wspólny włącznik" — więc najpierw czytamy stan i zmieniamy tylko chcianą połowę.
        // Włączenie MIDI nie może włączyć OSC razem z nim. GET /midi zagnieżdża konfigurację slotu
        // pod `slot` (góra niesie środowisko portów, tak samo czyta to rf-45); `||cur` na wypadek,
        // gdyby endpoint kiedyś odpowiadał płasko.
        let cur = {};
        try { cur = await fetch("/midi" + q).then(function (r) { return r.json(); }) || {}; cur = cur.slot || cur; } catch (e) { }
        url = "/midi" + q;
        body = { enabled: (g === "midi") ? true : !!cur.enabled, oscEnabled: (g === "osc") ? true : !!cur.oscEnabled };
      }
      // GRUPA, KTÓREJ TA FUNKCJA NIE ZNA, IDZIE DO „zostało do włączenia" — nie do kosza.
      // Do 14.09 stało tu `continue`, czyli ciche pominięcie: serwer nauczył się nowej grupy
      // (skaner, 13.09), a pole „Wczytaj i od razu aktywuj zestaw" wypisywało ją w tym, co włączy,
      // po czym jej nie włączało I NIC NIE MÓWIŁO. Teraz trafia do `bad`, więc po przeładowaniu
      // stoi w dymku z przyciskiem „Włącz teraz" — obietnica pola zostaje dotrzymana albo
      // widocznie niedotrzymana, nigdy po cichu.
      if (!url) { bad.push(g); continue; }
      let r = null;
      try {
        r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } catch (e) { }
      ((r && r.ok) ? ok : bad).push(g);
    }
    if (ok.length) done.push({ dev: it.dev, name: it.name, groups: ok });
    if (bad.length) left.push({ dev: it.dev, name: it.name, groups: bad });
  }
  return { done: done, left: left };
}

// PO UDANYM WCZYTANIU (import z pliku, paczka na kilka kapsli, zestaw z Biblioteki). Jeśli człowiek
// zaznaczył pole, włącza to, co serwer wskazał; potem zapisuje w localStorage, co ma powiedzieć
// dymek po przeładowaniu (strona zaraz się przeładuje, więc zdanie musi to przeżyć):
//   ribbitflip.undo.switchesBy — zostało do włączenia (dotychczasowy dymek z „Włącz teraz"),
//   ribbitflip.undo.armed      — włączone od razu (zielony dymek + przypomnienie o stopie),
//   ribbitflip.undo.armSim     — pole było zaznaczone, ale symulacja trzyma wyjścia pod kluczem,
//   ribbitflip.undo.switches   — lista zbiorcza TYLKO dla serwera, który nie zna `switchesKeptBy`
//                                (ten zna i przysyła ją zawsze, choćby pustą — wtedy zbiorcza jest
//                                pusta, bo mogłaby wymienić grupę, którą autor miał WYŁĄCZONĄ).
async function rfArmAfterLoad(res, arm) {
  const r = res || {};
  const by = Array.isArray(r.switchesKeptBy) ? r.switchesKeptBy : [];
  const allowed = (typeof rfSimOutputsAllowed !== "function") || rfSimOutputsAllowed();
  let done = [], left = by;
  if (arm && by.length && allowed) {
    const out = await rfArmSwitches(by);
    done = out.done; left = out.left;
  }
  const skippedSim = !!(arm && by.length && !allowed);
  try {
    localStorage.setItem("ribbitflip.undo.switches",
      JSON.stringify(Array.isArray(r.switchesKeptBy) ? [] : (r.switchesKept || [])));
    localStorage.setItem("ribbitflip.undo.switchesBy", JSON.stringify(left));
    // Części zestawu dla modułów wyłączonych przy starcie: zdanie w dymku po przeładowaniu (rf-29).
    if (Array.isArray(r.modulesOff) && r.modulesOff.length)
      localStorage.setItem("ribbitflip.undo.modsOff", JSON.stringify(r.modulesOff));
    else localStorage.removeItem("ribbitflip.undo.modsOff");
    if (done.length) localStorage.setItem("ribbitflip.undo.armed", JSON.stringify(done));
    else localStorage.removeItem("ribbitflip.undo.armed");
    if (skippedSim) localStorage.setItem("ribbitflip.undo.armSim", "1");
    else localStorage.removeItem("ribbitflip.undo.armSim");
  } catch (e) { }
  return { done: done, left: left, skippedSim: skippedSim };
}
function _rfArmedTake() {
  let a = null, sim = false;
  try { a = JSON.parse(localStorage.getItem("ribbitflip.undo.armed") || "[]"); } catch (e) { }
  try { sim = localStorage.getItem("ribbitflip.undo.armSim") === "1"; } catch (e) { }
  try { localStorage.removeItem("ribbitflip.undo.armed"); localStorage.removeItem("ribbitflip.undo.armSim"); } catch (e) { }
  return { done: Array.isArray(a) ? a : [], sim: sim };
}
// Dymek po przeładowaniu. Zielony, bo to wynik zamierzonej decyzji, nie ostrzeżenie — a zaraz po nim
// to samo przypomnienie o stopie awaryjnym, które dostaje każdy ręcznie przestawiony włącznik
// (rf-39j): wyjście właśnie zaczęło docierać do systemu i to jest moment, w którym droga ucieczki
// jest warta poznania. Zdanie o symulacji stoi obok dymka z „Włącz teraz", który zadaje pytanie.
function rfArmedAnnounce(info) {
  if (!info || typeof rfToast !== "function") return;
  if (info.done && info.done.length) {
    const list = rfArmList(info.done);
    if (list) rfToast(_gl("Włączone od razu po wczytaniu: " + list + ".",
                          "Switched on right after loading: " + list + "."), { tone: "ok", ms: 12000 });
    const grp = ((info.done[0] && info.done[0].groups) || [])[0] || "rules";
    if (typeof rfHotkeyReminder === "function") setTimeout(function () { rfHotkeyReminder(grp); }, 400);
  }
  if (info.sim)
    rfToast(_gl("W symulacji nic nie włączam samo, bo wyjścia są prawdziwe. Włącz przyciskiem w dymku obok, przejdzie przez pytanie.",
                "In simulation nothing switches on by itself, because the outputs are real. Use the button in the note next to this one; it asks first."),
            { ms: 12000 });
}
