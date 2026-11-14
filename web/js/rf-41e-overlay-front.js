"use strict";
// ============================ PRZÓD KAPSLA (rf-41e, 2026-09-29) ============================
// PO CO: kapsel jest okrągły, a przechył (pitch/roll) liczy się względem osi X czujnika, której z
// zewnątrz nie widać. Użytkownik nie wie, w którą stronę pochylić „do przodu". Ten element pokazuje
// to w nakładce, nad grą: gdzie jest przód — fabryczny (oś czujnika) albo WŁASNY, ustawiony przez
// człowieka (np. „tam, gdzie logo”) — i czy kapsel właśnie w niego mierzy.
//
// JAK WYGLĄDA: kropla wody. Kontur = promienie od środka połączone gładką krzywą, na nich animowane
// sinusoidy (3./5./9. harmoniczna). Zły kierunek → kropla faluje; im bliżej celu, tym gładziej;
// w tolerancji → prawie idealne koło, zielone, spokojnie oddycha (i po 2 s przygasa, żeby nie
// przeszkadzać). Adhezja: kontur wybrzusza się ku przodowi (zadzior), sięga ku celowi na godzinie 12,
// a na płasko spływa w stronę pochylenia.
//
// DWA WIDOKI, BEZ PRZEŁĄCZANIA: kapsel pionowo (trzymany jak kierownica, przyciskiem do siebie) =
// widok z przodu, przód ma trafić na 12; kapsel płasko = widok z góry, pochylenie do przodu ma
// trafić w wycinek. Ta sama reguła „mierzy w przód” co w prototypie diody, z histerezą 4°.
//
// DANE: kwaternion filtra (`D.poseLive.quat`, ten sam, który rysuje kulę orientacji) → wektor „w górę”
// w układzie kapsla, wzór jak `_q_up_body` w ribbitflip_monitor.py. Kąt przodu: GET /front (plik
// ribbitflip_front.json kapsla). Przechyłu ani mapowań element NIE zmienia — tylko je pokazuje.
//
// DWA MIEJSCA, JEDEN WIDOK (2026-09-29, druga tura): kropla stoi w nakładce (blok „przód kapsla”)
// i w prawej kolumnie panelu (kafel pod wykresami, rf-34c). Oba czytają TE SAME ustawienia kapsla
// (czułość, próg, stopnie, wycinek, przygaszanie — `sanitize_front` w ribbitflip_monitor.py) i oba
// rozwijają TEN SAM komponent ustawień (`frontSettingsHtml` niżej). Zapis w jednym miejscu wraca
// zdarzeniem `front` do panelu i do każdego okna nakładki. Okno trzyma tylko „czy” i „jak duże”.

const FRONT_HIST = 4;          // zapas histerezy (°): zapala przy progu, gaśnie 4° dalej
const FRONT_FADE_S = 2;        // po tylu sekundach w celu element przygasa…
const FRONT_FADE_TO = 0.35;    // …do tej jasności

// Ustawienia przodu kapsla (lustro FRONT_DEFAULTS w ribbitflip_monitor.py). Zmiany przychodzą
// zdarzeniem `front` (rf-08 → frontOnEvent); pytanie HTTP to tylko pierwszy odczyt i siatka
// bezpieczeństwa co 10 s, gdyby zdarzenie gdzieś zginęło.
const FRONT_DEF = { deg: 0, how: "fabryczny", tol: 12, min: 15, num: true, tolShow: true, fade: true, led: false };
const _frontAsk = {};
function frontOf(D) {
  const dev = D.meta.dev, t = performance.now();
  if (!(_frontAsk[dev] > t - 10000)) {
    _frontAsk[dev] = t;
    fetch("/front?dev=" + encodeURIComponent(dev)).then(r => r.json())
      .then(f => { if (f && typeof f.deg === "number") D.front = Object.assign({}, FRONT_DEF, f); }).catch(() => {});
  }
  return D.front || FRONT_DEF;
}
// Zdarzenie `front` z serwera: ktoś (panel, inne okno) zmienił przód albo wygląd tego kapsla.
function frontOnEvent(dev, m) {
  const D = state.devices[dev]; if (!D) return;
  D.front = Object.assign({}, FRONT_DEF, m); delete D.front.t; delete D.front.dev; delete D.front.ts;
  _frontAsk[dev] = performance.now();
  frontSettingsSyncAll();
}

// Świat „w górę” widziany z kapsla (lustro `_q_up_body`).
function frontUp(q) {
  const w = q[0], x = q[1], y = q[2], z = q[3];
  return [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)];
}
const _fNorm180 = a => ((a + 540) % 360) - 180;
const _FD = 180 / Math.PI;

// Wszystko, co element wie o położeniu kapsla, w stopniach. F = kierunek przodu w płaszczyźnie tarczy.
function frontGeom(q, deg) {
  const u = frontUp(q), Fx = Math.cos(deg / _FD), Fy = Math.sin(deg / _FD);
  const tilt = Math.acos(Math.max(-1, Math.min(1, u[2]))) * _FD;
  const pion = Math.abs(u[2]) < 0.5;
  // kąt przodu na tarczy, zgodnie z zegarem od 12 (kapsel trzymany przyciskiem do siebie)
  const beta = _fNorm180(Math.atan2(u[1], u[0]) * _FD - deg);
  const a = x => Math.asin(Math.max(-1, Math.min(1, x))) * _FD;
  const pf = { f: a(-(u[0] * Fx + u[1] * Fy)), r: a(-(u[0] * Fy - u[1] * Fx)) };   // + = przód / prawa w dół
  const kier = Math.abs(_fNorm180(Math.atan2(-u[1], -u[0]) * _FD - deg));          // kierunek pochylenia od przodu
  return { u, tilt, pion, beta, pf, kier };
}
function frontAims(g, tol, min, bylo) {
  const t = tol + (bylo ? FRONT_HIST : 0);
  if (g.pion) return Math.abs(g.beta) <= t;
  if (g.tilt < min - (bylo ? FRONT_HIST : 0)) return false;
  return g.kier <= t;
}

// ------------------------------------------------------------------ rysowanie jednego płótna
function drawFront(c, D, opt) {
  const ff = fit(c); if (!ff || !ff.w || !ff.h) return;
  const { ctx, w, h } = ff; ctx.clearRect(0, 0, w, h);
  const q = D.poseLive && Array.isArray(D.poseLive.quat) && D.poseLive.quat.length === 4 ? D.poseLive.quat : null;
  const S = c._fr || (c._fr = { q: null, rot: 0, harm: 0, alfa: 1, celOd: 0, mierzy: false, t: performance.now(), kx: 0, ky: 0 });
  const now = performance.now(), dt = Math.min(0.1, (now - S.t) / 1000); S.t = now;
  const kk = k => 1 - Math.pow(1 - k, dt * 60);            // wygładzanie w czasie, nie w klatkach
  const W = Math.min(w, h), CX = w / 2, CY = h / 2 + W * 0.03, R = W * 0.3;
  const dark = document.documentElement.dataset.theme !== "felt";
  if (!q) {
    ctx.strokeStyle = dark ? "rgba(255,248,236,.35)" : "rgba(33,31,29,.25)"; ctx.lineWidth = 2;
    ctx.setLineDash([5, 6]); ctx.beginPath(); ctx.arc(CX, CY, R, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    return;
  }
  S.q = S.q ? qnlerp(S.q, q, kk(0.3)) : q.slice();
  const fr = frontOf(D), g = frontGeom(S.q, fr.deg);
  S.mierzy = frontAims(g, opt.tol, opt.min, S.mierzy);
  // czas w celu liczony od znacznika wejścia, nie sumą kroków klatek (te bywają przycinane)
  S.celOd = S.mierzy ? (S.celOd || now) : 0;
  const przygas = opt.fade && S.celOd && (now - S.celOd) / 1000 > FRONT_FADE_S;
  S.alfa += ((przygas ? FRONT_FADE_TO : 1) - S.alfa) * kk(S.mierzy ? 0.05 : 0.25);

  // harmonia: 1 = spokojne koło, 0 = falująca kropla
  let cel, guzy;
  if (g.pion) {
    S.rot += _fNorm180(g.beta - S.rot) * kk(0.2);
    cel = S.mierzy ? 1 : 0.8 * Math.pow(Math.max(0, Math.min(1, 1 - (Math.abs(g.beta) - opt.tol) / 150)), 1.6);
    const blisko = Math.pow(Math.max(0, 1 - Math.abs(g.beta) / 100), 2);
    guzy = [{ a: S.rot, amp: W * (0.025 + 0.015 * S.harm), w: 0.26 }, { a: 0, amp: W * 0.05 * blisko, w: 0.34 }];
  } else {
    S.rot += _fNorm180(0 - S.rot) * kk(0.15);
    cel = S.mierzy ? 1 : 0.15;
    const nach = Math.min(1, Math.hypot(g.pf.f, g.pf.r) / 40);
    // kierunek pochylenia na ekranie, w stopniach „zgodnie z zegarem od 12”
    guzy = nach > 0.05 ? [{ a: Math.atan2(g.pf.r, g.pf.f) * _FD, amp: W * 0.065 * nach, w: 0.55 }] : [];
  }
  S.harm += (cel - S.harm) * kk(0.08);

  ctx.save(); ctx.globalAlpha = S.alfa; ctx.translate(CX, CY);
  const tt = now / 1000, d = 1 - S.harm, N = 96, pts = [];
  const faza = g.pion ? S.rot / _FD : 0;
  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2, l = th - faza;         // th: kąt ekranu od 12, zgodnie z zegarem
    let r = R * (1 + d * (0.055 * Math.sin(3 * l + tt * 1.3) + 0.035 * Math.sin(5 * l - tt * 1.9) + 0.02 * Math.sin(9 * l + tt * 2.7))
                   + 0.012 * Math.sin(4 * l - tt * 0.9));
    for (const gz of guzy) { const dd = _fNorm180(th * _FD - gz.a) / _FD; r += gz.amp * Math.exp(-((dd / gz.w) ** 2)); }
    pts.push([Math.sin(th) * r, -Math.cos(th) * r]);
  }
  const rNa = a => { const x = (((a % 360) + 360) % 360) / 360 * N, i = Math.floor(x) % N, j = (i + 1) % N, t = x - Math.floor(x);
    return Math.hypot(...pts[i]) * (1 - t) + Math.hypot(...pts[j]) * t; };
  const ksztalt = sk => {                                  // gładki zamknięty kontur przez środki odcinków
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const a = pts[i % N], b = pts[(i + 1) % N], mx = (a[0] + b[0]) / 2 * sk, my = (a[1] + b[1]) / 2 * sk;
      if (i === 0) ctx.moveTo(mx, my); else ctx.quadraticCurveTo(a[0] * sk, a[1] * sk, mx, my);
    }
    ctx.closePath();
  };
  const ziel = Math.pow(Math.max(0, Math.min(1, (S.harm - 0.6) / 0.4)), 1.5);
  const mix = (a, b) => a.map((v, i) => v + (b[i] - v) * ziel);
  const rgba = (c4) => `rgba(${Math.round(c4[0])},${Math.round(c4[1])},${Math.round(c4[2])},${c4[3].toFixed(3)})`;
  // Czytelność nad grą: w „filcu” grafitowy obrys na kremie; w ciemnym / samym rysowaniu kremowy
  // obrys z poświatą w kolorze wybranej „obwódki” okna (ciemna / jasna / kolor kapsla / brak).
  const obrys = dark ? mix([255, 248, 236, 1], [166, 216, 97, 1]) : mix([33, 31, 29, 1], [70, 120, 31, 1]);
  const wyp = dark ? mix([250, 246, 238, 0.18], [166, 216, 97, 0.38]) : mix([255, 255, 255, 0.55], [166, 216, 97, 0.45]);
  const ol = (typeof OVL !== "undefined" && OVL.cfg && OVL.cfg.outline) || "dark";
  const halo = !dark || ol === "none" ? null : ol === "light" ? "rgba(255,255,255,.75)"
    : ol === "dcol" ? (D.meta.color || "#8aa0b5") : "rgba(0,0,0,.6)";
  // „SAMA TREŚĆ” (_holeBg, rf-09): tło okna jest WYCINANE kolorem kluczowym, więc nad grą nie ma
  // półprzezroczystości — piksel jest albo wycięty, albo pełny, a wypełnienie z alfą wychodzi jako
  // ciemny krążek. W tym motywie kropla jest więc samym konturem (grę widać przez środek), tolerancja
  // liniami zamiast wycinka, a poświata jednym pełnym pierścieniem.
  const hole = typeof _holeBg === "function" && _holeBg();
  if (S.mierzy && hole) {
    ctx.strokeStyle = "#a6d861"; ctx.lineWidth = Math.max(2, W / 70);
    ctx.beginPath(); ctx.arc(0, 0, R * 1.18 + Math.sin(tt * 2.5) * W * 0.006, 0, 7); ctx.stroke();
  } else if (S.mierzy) {                                   // spokojna poświata w celu
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = `rgba(166,216,97,${(0.22 - i * 0.05 + Math.sin(tt * 2.5) * 0.03).toFixed(3)})`;
      ctx.lineWidth = W / 40 + i * W / 36; ctx.beginPath(); ctx.arc(0, 0, R + W * 0.02, 0, 7); ctx.stroke();
    }
  }
  if (halo) { ctx.shadowColor = halo; ctx.shadowBlur = W / 28; }
  ksztalt(1); if (!hole) { ctx.fillStyle = rgba(wyp); ctx.fill(); }
  ctx.strokeStyle = rgba(obrys); ctx.lineWidth = Math.max(2, W / 65); ctx.lineJoin = "round"; ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = Math.max(1.5, W / 90); ctx.lineCap = "round";   // połysk wody
  ctx.beginPath(); for (let i = 83; i <= 91; i++) { const p = pts[i]; if (i === 83) ctx.moveTo(p[0] * 0.8, p[1] * 0.8); else ctx.lineTo(p[0] * 0.8, p[1] * 0.8); } ctx.stroke();

  // tolerancja: przezroczysty wycinek wokół 12 (pionowo) / wachlarz od progu pochylenia (płasko)
  if (opt.tolShow) {
    const t = opt.tol / _FD, a = -Math.PI / 2, rOut = g.pion ? R * 1.3 : R * 0.95;
    const rIn = g.pion ? 0 : Math.min(rOut - 2, opt.min * (R * 0.8) / 60);
    ctx.beginPath(); ctx.arc(0, 0, rOut, a - t, a + t); ctx.arc(0, 0, rIn, a + t, a - t, true); ctx.closePath();
    if (hole) {
      ctx.strokeStyle = S.mierzy ? "#a6d861" : "rgba(166,216,97,.85)"; ctx.lineWidth = Math.max(1.5, W / 110);
      ctx.setLineDash([W / 40, W / 50]); ctx.stroke(); ctx.setLineDash([]);
    } else { ctx.fillStyle = `rgba(166,216,97,${S.mierzy ? 0.36 : 0.2})`; ctx.fill(); }
  }
  // przód: zadzior przyklejony do konturu (pionowo) albo stały u góry (płasko)
  {
    const th = g.pion ? S.rot : 0, r0 = rNa(th) - 3, hh = W * 0.08, b = W * 0.035;
    ctx.save(); ctx.rotate(th / _FD);
    ctx.beginPath(); ctx.moveTo(-b, -r0); ctx.lineTo(0, -r0 - hh); ctx.lineTo(b, -r0); ctx.closePath();
    ctx.fillStyle = S.mierzy ? "#6cb33f" : "#ec1a83"; ctx.fill();
    ctx.strokeStyle = "#211f1d"; ctx.lineWidth = Math.max(1.5, W / 110); ctx.lineJoin = "round"; ctx.stroke();
    ctx.restore();
  }
  if (g.pion) {
    if (halo) { ctx.shadowColor = halo; ctx.shadowBlur = W / 30; }
    ctx.strokeStyle = S.mierzy ? "#a6d861" : rgba(obrys); ctx.lineWidth = Math.max(2, W / 60); ctx.lineCap = "round";   // cel na 12
    ctx.beginPath(); ctx.moveTo(0, -R * 1.34); ctx.lineTo(0, -R * 1.5); ctx.stroke(); ctx.shadowBlur = 0;
    if (opt.num && !S.mierzy) {
      ctx.font = Math.round(W * 0.13) + "px " + (cv("--rebel") || "sans-serif");
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
      ctx.lineWidth = W / 45; ctx.strokeStyle = dark ? "#211f1d" : "#faf6ee"; ctx.strokeText(Math.round(Math.abs(g.beta)) + "°", 0, 0);
      ctx.fillStyle = dark ? "#fff8ec" : "#211f1d"; ctx.fillText(Math.round(Math.abs(g.beta)) + "°", 0, 0);
    }
  } else {
    const sk = (R * 0.8) / 60, lim = v => Math.max(-60, Math.min(60, v));
    S.kx += (lim(g.pf.r) * sk - S.kx) * kk(0.25); S.ky += (-lim(g.pf.f) * sk - S.ky) * kk(0.25);
    ctx.beginPath(); ctx.arc(S.kx, S.ky, W * 0.045, 0, 7);
    ctx.fillStyle = S.mierzy ? "#6cb33f" : "#a6d861"; ctx.fill();
    ctx.strokeStyle = "#211f1d"; ctx.lineWidth = Math.max(1.5, W / 110); ctx.stroke();
  }
  ctx.restore();
}

// Wołane z pętli klatek (rf-12), obok kuli orientacji. W panelu element nie istnieje (CSS go chowa),
// więc `offsetParent` odsiewa go bez kosztu.
// Wygląd kropli z ustawień KAPSLA — to samo dla nakładki i prawej kolumny.
function frontOpt(D) {
  const f = frontOf(D);
  return { tol: f.tol, min: f.min, num: f.num !== false, tolShow: f.tolShow !== false, fade: f.fade !== false };
}
function drawFrontAll(root) {
  root.querySelectorAll(".ov-front").forEach(c => {
    if (!c.offsetParent) return;
    const D = state.devices[c.dataset.dev]; if (!D) return;
    try { drawFront(c, D, frontOpt(D)); }
    catch (e) { if (!c._ferr) { c._ferr = 1; console.error("[przód kapsla " + D.meta.dev + "]", e); } }
  });
}

// ------------------------------------------------------------------ ustawianie przodu (edytor)
// Dwie drogi, ten sam wynik — kąt przodu na tarczy:
//   • „pochyl”:    kapsel płasko, pochyl w stronę, która ma być przodem, i przytrzymaj 1,2 s;
//                  krawędź, która poszła w dół, staje się przodem;
//   • „kierownica”: kapsel pionowo, przyciskiem do siebie; to, co jest u góry, staje się przodem.
function frontUpOf(dev) {
  const D = state.devices[dev];
  const q = D && D.poseLive && Array.isArray(D.poseLive.quat) && D.poseLive.quat.length === 4 ? D.poseLive.quat : null;
  return q ? frontUp(q) : null;
}
function frontSave(dev, body) {
  return fetch("/front?dev=" + encodeURIComponent(dev), {
    method: "POST", headers: { "Content-Type": "application/json", "X-RibbitFlip-Token": window.RIBBITFLIP_TOKEN || "" },
    body: JSON.stringify(body),
  }).then(r => r.json()).then(f => {
    const D = state.devices[dev];
    if (D && f && f.ok) { D.front = Object.assign({}, FRONT_DEF, f); delete D.front.ok; _frontAsk[dev] = performance.now(); }
    return f;
  });
}
// Kierownica: od razu, jeśli kapsel stoi pionowo. Zwraca obietnicę z komunikatem błędu albo wynikiem.
function frontCaptureWheel(dev) {
  const u = frontUpOf(dev);
  if (!u) return Promise.resolve({ error: _cvT("Kapsel nie przesyła orientacji. Podłącz go i spróbuj jeszcze raz.") });
  if (Math.abs(u[2]) >= 0.5) return Promise.resolve({ error: _cvT("Postaw kapsel pionowo, przyciskiem do siebie, i obróć tak, żeby przód był u góry.") });
  return frontSave(dev, { deg: Math.atan2(u[1], u[0]) * _FD, how: "kierownica" });
}
// Pochylenie: czeka, aż kapsel będzie pochylony 18–75° w jedną stronę przez 1,2 s (max 20 s).
// `onTick(postep 0..1, tekst)` pozwala przyciskowi mówić, co się dzieje.
function frontCaptureTilt(dev, onTick) {
  return new Promise(res => {
    let od = 0, kier = null; const start = performance.now();
    const iv = setInterval(() => {
      const u = frontUpOf(dev), t = performance.now();
      if (t - start > 20000) { clearInterval(iv); res({ error: _cvT("Nie złapałem pochylenia. Spróbuj jeszcze raz: pochyl do przodu i przytrzymaj.") }); return; }
      if (!u) { onTick && onTick(0, _cvT("brak orientacji")); return; }
      const tilt = Math.acos(Math.max(-1, Math.min(1, u[2]))) * _FD;
      if (tilt < 18 || tilt > 75) { od = 0; kier = null; onTick && onTick(0, tilt < 18 ? _cvT("pochyl mocniej") : _cvT("za mocno")); return; }
      const k = Math.atan2(-u[1], -u[0]) * _FD;
      if (kier === null || Math.abs(_fNorm180(k - kier)) > 5) { kier = k; od = t; }
      const p = Math.min(1, (t - od) / 1200);
      onTick && onTick(p, _cvT("trzymaj…"));
      if (p >= 1) { clearInterval(iv); frontSave(dev, { deg: k, how: "pochylenie" }).then(res); }
    }, 60);
  });
}

// ============================ WSPÓLNY KOMPONENT USTAWIEŃ ============================
// Jeden HTML, jedna synchronizacja, jedna obsługa zdarzeń — w edytorze nakładki (rf-41c, blok
// „przód kapsla”) i w rozwinięciu kafla w prawej kolumnie (rf-34c). Kapsel wskazuje najbliższy
// przodek z `data-fs-dev` albo funkcja `getDev` podana przy podpięciu, więc ten sam kod obsługuje
// oba miejsca bez gałęzi. `where`: "ovl" | "rail" — różnią się tylko ostatnim wierszem, który mówi,
// gdzie jeszcze ten widok stoi (w panelu: przełącznik „pokaż w nakładce”).
function frontSettingsHtml(where) {
  const link = where === "rail"
    ? `<div class="fs-row fs-link"><span class="fs-link-t" data-fs="link">—</span>` +
        `<button type="button" class="btn xs fs-link-btn" data-fs="linkBtn" hidden></button></div>`
    : `<div class="fs-note">Te same ustawienia są w prawej kolumnie panelu, pod podglądem na żywo: zmiana tu jest zmianą tam.</div>`;
  // KOLEJNOŚĆ (2026-09-30: przyciski stoją tuż pod wizualizacją po kliknięciu opcji,
  // a nie gdzieś niżej): najpierw to, po co się tu klika — stan przodu i trzy przyciski, tuż pod
  // kroplą, żeby przy „Pochyl do przodu” widzieć jednocześnie przycisk i rysunek. Potem dioda
  // (sposób na przód bez ekranu), strojenie, a na końcu zdanie „po co” i powiązanie z nakładką.
  return `<div class="fs" data-fs-where="${where}">` +
    `<div class="fs-row"><span class="fs-l">Przód</span><span class="fs-stat" data-fs="stat">—</span></div>` +
    `<div class="fs-btns">` +
      `<button type="button" class="btn xs" data-fs="tilt" ` +
        `title="Połóż kapsel płasko, pochyl w stronę, która ma być przodem, i przytrzymaj chwilę">Pochyl do przodu</button>` +
      `<button type="button" class="btn xs" data-fs="wheel" ` +
        `title="Trzymaj kapsel pionowo jak kierownicę, przyciskiem do siebie: to, co jest u góry, zostanie przodem">Kierownica</button>` +
      `<button type="button" class="btn xs" data-fs="reset" title="Wróć do przodu fabrycznego (oś czujnika)">Fabryczny</button>` +
    `</div>` +
    // DIODA — osobny, wyraźny wiersz, a nie jeden z drobiazgów wyglądu: to jest sposób, żeby wiedzieć,
    // gdzie jest przód, BEZ patrzenia na ekran. Liczy serwer (FrontLed), więc działa także przy
    // zamkniętym panelu. Lampka obok mówi, czy dioda świeci w tej chwili (zdarzenie `led`, rf-08).
    `<div class="fs-row fs-led"><label class="fs-chk" ` +
        `title="Dioda kapsla zapala się, gdy przód jest u góry (kapsel pionowo) albo gdy pochylasz go do przodu. Działa bez patrzenia na ekran, także przy zamkniętym panelu.">` +
        `<input type="checkbox" data-fs="led"> Świeć LED, gdy kapsel mierzy w przód</label>` +
      `<span class="fs-lamp" data-fs="lamp" aria-hidden="true"></span></div>` +
    `<div class="fs-row fs-sl"><span class="fs-l">Czułość</span>` +
      `<input type="range" class="fs-rng" data-fs="tol" min="3" max="45" step="1" ` +
        `title="O ile stopni przód może uciec od celu, żeby kierunek był jeszcze dobry">` +
      `<span class="fs-v" data-fs="tolV">±12°</span></div>` +
    `<div class="fs-row fs-sl"><span class="fs-l">Na płasko od</span>` +
      `<input type="range" class="fs-rng" data-fs="min" min="5" max="45" step="1" ` +
        `title="Kapsel na płasko: od jakiego pochylenia liczy się „do przodu”">` +
      `<span class="fs-v" data-fs="minV">15°</span></div>` +
    `<div class="fs-chks">` +
      `<label class="fs-chk"><input type="checkbox" data-fs="num"> stopnie do celu</label>` +
      `<label class="fs-chk"><input type="checkbox" data-fs="tolShow"> wycinek tolerancji</label>` +
      `<label class="fs-chk"><input type="checkbox" data-fs="fade"> przygaszaj w celu</label>` +
    `</div>` +
    `<div class="fs-why">Kapsel jest okrągły, więc nie widać, gdzie ma przód. Ta kropla to pokazuje: ` +
      `przód fabryczny albo taki, który ustawisz sam (np. tam, gdzie logo). Gdy kapsel mierzy w przód, ` +
      `kropla się uspokaja i zielenieje.</div>` + link + `</div>`;
}
function _fsDev(fs) {
  const h = fs.closest("[data-fs-dev]");
  if (h && h.dataset.fsDev) return h.dataset.fsDev;
  const w = fs.closest("[data-fs-wired]");
  return w && typeof w._fsGetDev === "function" ? (w._fsGetDev() || "") : "";
}
function _fsQ(root, k) { return root.querySelector('[data-fs="' + k + '"]'); }
// Okna nakładki TEGO kapsla (bez okienka koła przy kursorze — ono pokazuje tylko koło).
function _fsWins(dev) {
  const W = (typeof OVL !== "undefined" && OVL.state && OVL.state.windows) || {};
  return Object.keys(W).map(k => W[k]).filter(w => w && w.dev === dev && String(w.win || "").indexOf("~kolo") < 0);
}
function frontSettingsSync(fs, dev) {
  if (!fs || !dev) return;
  const D = state.devices[dev]; if (!D) return;
  const f = frontOf(D);
  const st = _fsQ(fs, "stat");
  if (st && !fs._fsBusy) {
    const txt = f.how === "fabryczny" || !f.deg ? _cvT("fabryczny (oś czujnika)")
      : _cvT("własny") + ", " + Math.round(Math.abs(f.deg)) + "° " + (f.deg > 0 ? _cvT("w lewo od fabrycznego") : _cvT("w prawo od fabrycznego"));
    if (st.textContent !== txt) st.textContent = txt;
  }
  for (const k of ["tol", "min"]) {
    const r = _fsQ(fs, k), live = r && document.activeElement === r;
    if (r && !live && +r.value !== f[k]) r.value = f[k];
    const v = _fsQ(fs, k + "V"); if (v) v.textContent = (k === "tol" ? "±" : "") + (live ? r.value : f[k]) + "°";
  }
  for (const k of ["num", "tolShow", "fade"]) { const c = _fsQ(fs, k); if (c && document.activeElement !== c) c.checked = f[k] !== false; }
  { const c = _fsQ(fs, "led"); if (c && document.activeElement !== c) c.checked = !!f.led; }
  { const l = _fsQ(fs, "lamp"); if (l) { const on = !!(f.led && D.led && D.led.on); l.classList.toggle("on", on); l.hidden = !f.led; } }
  // POWIĄZANIE Z NAKŁADKĄ (tylko prawa kolumna): czy ten widok stoi też nad grą, i przełącznik.
  const lt = _fsQ(fs, "link"), lb = _fsQ(fs, "linkBtn");
  if (lt && lb) {
    const wins = _fsWins(dev), on = wins.filter(w => w.config && w.config.show && w.config.show.front);
    let txt;
    if (!wins.length) { txt = _cvT("Nakładkę dla tego kapsla tworzysz na ekranie „Nakładka”."); lb.hidden = true; }
    else {
      txt = on.length ? _cvT("Pokazany w nakładce") + (wins.length > 1 ? " (" + on.length + "/" + wins.length + ")" : "") : _cvT("W nakładce ukryty");
      lb.hidden = false;
      const bt = on.length ? _cvT("Ukryj w nakładce") : _cvT("Pokaż w nakładce");
      if (lb.textContent !== bt) lb.textContent = bt;
      lb.dataset.on = on.length ? "1" : "";
    }
    if (lt.textContent !== txt) lt.textContent = txt;
  }
}
// Wszystkie komponenty na stronie — po zdarzeniu `front` z serwera i po zapisie.
function frontSettingsSyncAll() {
  document.querySelectorAll(".fs").forEach(fs => { const dev = _fsDev(fs); if (dev) frontSettingsSync(fs, dev); });
}
// Podpięcie zdarzeń: raz na pojemnik (delegacja), więc przebudowa HTML w środku niczego nie gubi.
function frontSettingsWire(host, getDev) {
  if (!host || host._fsWired) return;
  // `document` (edytor nakładki, rf-41c) nie ma setAttribute — znacznik potrzebny tylko pojemnikom z getDev
  host._fsWired = 1; if (host.setAttribute) host.setAttribute("data-fs-wired", "1");
  if (getDev) host._fsGetDev = getDev;
  const fsOf = e => e.target.closest && e.target.closest(".fs");
  host.addEventListener("input", e => {
    const r = e.target.closest(".fs-rng"), fs = fsOf(e); if (!r || !fs) return;
    const D = state.devices[_fsDev(fs)]; if (!D) return;
    // podgląd od razu (kropla przerysowuje się w najbliższej klatce), zapis dopiero po puszczeniu
    D.front = Object.assign({}, frontOf(D), { [r.dataset.fs]: +r.value });
    const v = r.parentNode.querySelector(".fs-v"); if (v) v.textContent = (r.dataset.fs === "tol" ? "±" : "") + r.value + "°";
  });
  host.addEventListener("change", e => {
    const fs = fsOf(e); if (!fs) return;
    const dev = _fsDev(fs); if (!dev) return;
    const r = e.target.closest(".fs-rng");
    if (r) { frontSave(dev, { [r.dataset.fs]: +r.value }); return; }
    const c = e.target.closest(".fs-chk input");
    if (c) frontSave(dev, { [c.dataset.fs]: !!c.checked });
  });
  host.addEventListener("click", e => {
    const b = e.target.closest(".fs button[data-fs]"); if (!b) return;
    const fs = b.closest(".fs"), dev = _fsDev(fs); if (!dev) return;
    e.stopPropagation();
    if (b.dataset.fs === "linkBtn") {
      const wins = _fsWins(dev); if (!wins.length || typeof ovmSend !== "function") return;
      const want = !b.dataset.on;
      // Pokaż = w pierwszym oknie kapsla (drugie i dalsze włączasz w edytorze okna); ukryj = we wszystkich.
      for (const w of (want ? wins.slice(0, 1) : wins)) ovmSend(w.win, { show: { front: want } }, true);
      setTimeout(() => frontSettingsSync(fs, dev), 900);
      return;
    }
    _frontAct(b, dev, fs);
  });
}
function _frontAct(btn, dev, fs) {
  if (fs._fsBusy) return;
  const lbl = btn.textContent;
  const done = f => {
    fs._fsBusy = false; btn.disabled = false; btn.textContent = lbl;
    if (f && f.error) { if (typeof rfToast === "function") rfToast(f.error, { tone: "danger", ms: 5000 }); return; }
    if (f && f.ok) {
      frontSettingsSyncAll();
      if (typeof rfToast === "function") rfToast(f.how === "fabryczny" && !f.deg ? _cvT("Przywrócono przód fabryczny") : _cvT("Przód kapsla ustawiony"), { ms: 3000 });
    }
  };
  if (btn.dataset.fs === "reset") { frontSave(dev, { reset: true }).then(done); return; }
  if (btn.dataset.fs === "wheel") { frontCaptureWheel(dev).then(done); return; }
  fs._fsBusy = true; btn.disabled = true;
  frontCaptureTilt(dev, (pr, t) => { btn.textContent = t + (pr > 0 ? " " + Math.round(pr * 100) + "%" : ""); }).then(done);
}

// ============================ KAFEL W PRAWEJ KOLUMNIE (rf-34c) ============================
// Nagłówek rozwija kroplę i ustawienia (idą za wybranym kapslem). Zwinięty = sam nagłówek (L23).
function _frontActiveDev() { return (typeof state !== "undefined" && state.activeDeviceId) || ""; }
function frontRailTile() {
  const mk = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
  const box = mk("div", "rf-mini rf-mini-front");
  const head = mk("button", "rf-front-head");
  head.type = "button"; head.title = "Pokaż lub schowaj ustawienia przodu";
  head.appendChild(mk("span", "", "Przód kapsla"));
  head.appendChild(mk("span", "rf-front-chev"));
  box.appendChild(head);
  const c = mk("canvas", "rf-front-cv"); c.id = "rfMiniFront"; c.setAttribute("aria-hidden", "true");
  box.appendChild(c);
  const body = mk("div", "rf-front-body"); body.innerHTML = frontSettingsHtml("rail"); box.appendChild(body);
  const K = "ribbitflip.fold.przod";
  const set = (open, save) => {
    c.hidden = body.hidden = !open; head.setAttribute("aria-expanded", open);
    box.classList.toggle("open", open);
    if (open) frontSettingsSync(body.querySelector(".fs"), _frontActiveDev());
    if (save) try { localStorage[K] = open ? 1 : 0; } catch (e) { }
  };
  head.addEventListener("click", () => set(body.hidden, 1));
  frontSettingsWire(box, _frontActiveDev);
  let o = 0; try { o = localStorage[K] == 1; } catch (e) { }
  c.hidden = body.hidden = true; head.setAttribute("aria-expanded", false);
  if (o) setTimeout(() => set(true), 0);
  return box;
}
let _frontRailSync = 0;
function frontRailDraw(now) {
  const c = document.getElementById("rfMiniFront");
  if (!c || !c.offsetParent) return;
  const D = state.devices[_frontActiveDev()]; if (!D) return;
  try { drawFront(c, D, frontOpt(D)); } catch (e) { if (!c._ferr) { c._ferr = 1; console.error("[przód kapsla, panel]", e); } }
  // rozwinięte ustawienia idą za kapslem wybranym w panelu i za zmianą okien nakładki — rzadko
  const body = c.parentNode.querySelector(".rf-front-body");
  if (body && !body.hidden && now - _frontRailSync > 500) { _frontRailSync = now; frontSettingsSync(body.querySelector(".fs"), D.meta.dev); }
}
