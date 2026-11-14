"use strict";
// ============= KOŁO WYBORU — SCENA PODGLĄDU: WSKAZYWANIE I DZIENNIK =============
// Gdzie celuje ręka i co z tego wyszło. Dwa tematy, bo to dwie połowy jednego zdania: najpierw
// scena musi wiedzieć, w co kursor mierzy, a potem zapisać, co zostało wybrane.
//
// WSKAZYWANIE LICZY SIĘ Z MATEMATYKI, nie ze zdarzeń na kształtach SVG — między innymi dlatego,
// że kursor ZA kołem nadal ma wskazywać jego zewnętrzny wycinek (prawo Fittsa), a element tam
// się kończy. Lustro _hit_band / _hit_in_band z RadialMenu: pochylenie kapsla i ruch myszy to
// ta sama para (długość, kierunek), więc podgląd celuje dokładnie tak, jak celuje ręka.
//
// Po rf-46d (czyta jego `state.wheelStage`, `_whStageR` i `_whClampOff`) i przed rf-46d3, który
// z tego korzysta przy otwieraniu koła i przy zatwierdzaniu wyboru.

// KIERUNEK I DŁUGOŚĆ WSKAZÓWKI w trybie myszy — z FAKTYCZNEGO położenia kursora, a nie ze środka
// wskazanego wycinka. Wskazówka ma być linią, która idzie za ręką (tak jest w prototypie); dosunięta
// do środka wycinka przeskakiwała skokami co jeden wycinek i to właśnie było widać jako „źle się
// animuje". Zwraca kąt ZNORMALIZOWANY — ciągłość robi z niego rysunek (whUnwrapDeg w rf-46a).
function _whStageAim(host, st) {
  const S = state.wheelStage;
  if (!host || !host.clientWidth) return null;
  const R = Math.max(1, _whStageR(host, st));
  const ox = S.held ? _whClampOff(host, st, S.ox, true) : 0;
  const oy = S.held ? _whClampOff(host, st, S.oy, false) : 0;
  const dx = S.px - (host.clientWidth / 2 + ox), dy = S.py - (host.clientHeight / 2 + oy);
  const d = Math.hypot(dx, dy);
  if (d < 1) return { ang: 0, mag: 0 };
  // Poza kołem wskazówka dobija do krawędzi i tam zostaje: kursor DALEJ wskazuje zewnętrzny
  // wycinek (prawo Fittsa), więc kreska nie ma prawa zniknąć ani wyjechać poza tarczę.
  return { ang: ((Math.atan2(dx, -dy) * 180 / Math.PI) % 360 + 360) % 360,
           mag: Math.min(1, d / R) };
}

// ------------------------------------------------------------------------------------------
//  WSKAZYWANIE — kąt i odległość, nigdy zdarzenia na elementach
// ------------------------------------------------------------------------------------------
// Lustro _hit_band / _hit_in_band z RadialMenu: pochylenie kapsla i ruch myszy to ta sama para
// (długość, kierunek), więc podgląd celuje dokładnie tak, jak celuje ręka. Liczone z matematyki,
// a nie ze zdarzeń na kształtach SVG — także dlatego, że kursor ZA kołem nadal ma wskazywać jego
// zewnętrzny wycinek (prawo Fittsa), a element tam się kończy.
function _whAngDiff(a, b) { return ((a - b + 180) % 360 + 360) % 360 - 180; }

function _whStageHit(host, st, x, y) {
  const R = _whStageR(host, st);
  const S = state.wheelStage;
  const ox = S.held ? _whClampOff(host, st, S.ox, true) : 0;
  const oy = S.held ? _whClampOff(host, st, S.oy, false) : 0;
  const dx = x - (host.clientWidth / 2 + ox), dy = y - (host.clientHeight / 2 + oy);
  const d = Math.hypot(dx, dy) / Math.max(1, R);
  const geom = st.geom || [[0.34, 1]], bands = st.bands || [];
  if (!bands.length || d < geom[0][0]) return null;            // martwa strefa albo pusty pakiet
  // Ostatnia obręcz nie ma górnej granicy.
  let b = geom.length - 1;
  for (let i = 0; i < geom.length - 1; i++) {
    if (d <= geom[i][1] + (geom[i + 1][0] - geom[i][1]) / 2) { b = i; break; }
  }
  const ang = ((Math.atan2(dx, -dy) * 180 / Math.PI) % 360 + 360) % 360;
  // Pudło w łuku spada na obręcz niżej: kąt wskazuje wtedy na koło główne, więc da się „przejechać"
  // łukiem na innego rodzica bez wracania do środka.
  while (b >= 0) {
    const bd = bands[b] || {}, n = Math.max(1, (bd.items || []).length);
    if (bd.full === false) {
      const a0 = +bd.a0 || 0, a1 = (bd.a1 == null ? 360 : +bd.a1);
      const total = a1 - a0, step = total / n, pc = (a0 + a1) / 2;
      const dd = _whAngDiff(ang, ((pc % 360) + 360) % 360);
      if (Math.abs(dd) <= total / 2)
        return { band: b, idx: Math.max(0, Math.min(n - 1, Math.round((dd + total / 2 - step / 2) / step))) };
    } else {
      return { band: b, idx: Math.round(ang / (360 / n)) % n };
    }
    b--;
  }
  return null;
}

// DZIENNIK. Mówi wprost, że to podgląd — w zdaniu pod sceną i przy każdym wpisie. Człowiek, który
// właśnie „wybrał apteczkę", ma prawo zapytać, czy coś poszło do gry; odpowiedź musi być na ekranie.
//
// `note` to DOPISEK przy wpisie, dziś jeden: „empty" dla pustego pola. Bez niego dziennik
// pokazywałby wybór pustego pola dokładnie tak samo, jak wybór apteczki — a to są dwie różne
// rzeczy i różnica jest w tym, czy cokolwiek poszło. Trzymamy ZNACZNIK, nie gotowe zdanie:
// przełączenie języka przerysowuje dziennik (whStageRelang), a wpis zapisany po polsku zostałby
// wtedy po polsku na zawsze.
function whStageLog(path, note) {
  const S = state.wheelStage;
  const d = new Date();
  const t = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0")
    + ":" + String(d.getSeconds()).padStart(2, "0");
  S.log.unshift({ t: t, p: path.join(" ▸ "), n: note || "" });
  if (S.log.length > WH_LOG_MAX) S.log.length = WH_LOG_MAX;
  whStageLogPaint();
}
function whStageLogPaint() {
  const box = document.getElementById("whLogList"); if (!box) return;
  const e = (typeof esc === "function") ? esc : (s => String(s));
  const S = state.wheelStage;
  const nt = (n) => (n === "empty") ? _wheelT("nic nie wysłano", "nothing sent") : "";
  box.innerHTML = S.log.length
    ? S.log.map(r => `<li${r.n ? ' class="is-empty"' : ""}><span class="wh-log-t">${r.t}</span>`
      + `<span class="wh-log-p">${e(r.p)}</span>`
      + (nt(r.n) ? `<span class="wh-log-n">${e(nt(r.n))}</span>` : "") + `</li>`).join("")
    : `<li class="wh-log-none">${_wheelT("jeszcze nic nie wybrano", "nothing picked yet")}</li>`;
}
