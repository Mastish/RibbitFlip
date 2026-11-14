/* nuty-gl.js: taśmy nut RibbitBeata na GPU (eksperyment 2026-10-17, za flagą ?nutyGL=1, domyślnie wyłączone).
 *
 * Po co: pomiar 10-17 (headless d3d11, 2560×1600 przy skali 150 %) pokazał, że rysujTor to ok. 70 % pracy wątku GPU
 * przeglądarki w klatce (bez niego 2,4–3,4 zamiast 7–10 ms GPU na klatkę). Nuty od 10-04/10-10 są już bitmapami
 * (sprajtNuty, bitmapaMinionej), ale każda klatka to kilkadziesiąt drawImage na płótnie 2D 1,5×, każde przez potok Skii.
 * Tu te same bitmapy (ten sam rysunek, więc ten sam wygląd) leżą w atlasie tekstur WebGL2 i rysują się jednym draw callem.
 *
 * Warstwy (od spodu): #glTlo → #tlo → #glFx → #scenaPod (2D: to, co w rysujTor leży POD taśmami: kreski taktowe, granice
 * stylu nut, scena płonąca, zjazdy, strzałki skoku, duchy nut) → #glNuty (WebGL2: bitmapy taśm) → #scena (2D: nuta na linii
 * „teraz”, płonące taśmy, naklejki ocen, ślady, żaby, ogień). Nuty aktywne i płonące zostają w 2D, bo zmieniają się co klatkę,
 * więc ogień dalej wyrasta z głowy żaby i z nut, nigdy z klawiszy.
 *
 * Klatka: NutyGL.klatka() (czyści #scenaPod i kolejkę; false = GL niedostępny, gra rysuje po staremu), NutyGL.klip(x,y,w,h,r)
 * (zaokrąglona karta toru), NutyGL.obraz(b, x, y, w, h) (b = obiekt bitmapy {cv, cw, ch}: tożsamość obiektu = wersja treści),
 * NutyGL.rysuj() na końcu. Rozgrzanie programu i atlasu: NutyGL.rozgrzej(scena) na ekranie wczytywania.
 */
(function () {
  "use strict";
  var glob = typeof window !== "undefined" ? window : globalThis;
  var AW = 4096, AH = 2048, WARSTWY = 3, ODSTEP = 2;   // atlas: 3 warstwy 4096×2048 (96 MB), 2 px odstępu między bitmapami
  var F = 16, MAKS = 2000;                            // floatów na instancję, instancji na klatkę
  var VS = "#version 300 es\n" +
    "layout(location=0) in vec4 aDst; layout(location=1) in vec4 aUv; layout(location=2) in vec4 aKlip; layout(location=3) in vec4 aInne;\n" +
    "uniform vec2 uWym; out vec2 vUv; flat out float vWar; out vec2 vPos; flat out vec4 vKlip; flat out vec2 vInne;\n" +
    "void main(){ vec2 q=vec2(gl_VertexID&1, gl_VertexID>>1); vec2 p=aDst.xy+q*aDst.zw; vPos=p; vUv=aUv.xy+q*aUv.zw;\n" +
    "  vWar=aInne.x; vInne=aInne.yz; vKlip=aKlip; gl_Position=vec4(p.x/uWym.x*2.0-1.0, 1.0-p.y/uWym.y*2.0, 0.0, 1.0); }";
  var FS = "#version 300 es\nprecision highp float; precision highp sampler2DArray;\n" +
    "uniform sampler2DArray uTex; uniform float uDpr; in vec2 vUv; flat in float vWar; in vec2 vPos; flat in vec4 vKlip; flat in vec2 vInne; out vec4 o;\n" +
    "void main(){ vec4 c=texture(uTex, vec3(vUv, vWar)); float r=vInne.y; vec2 h=vKlip.zw*0.5, s=vPos-(vKlip.xy+h);\n" +
    "  float d=length(max(abs(s)-(h-r),0.0))-r; float k=clamp(0.5-d*uDpr,0.0,1.0); o=c*(k*vInne.x); }";

  var S = { cv: null, pod: null, cp: null, gl: null, prog: null, vao: null, vbo: null, tex: null, u: {}, dziala: false, blad: null,
    W: 0, H: 0, dpr: 1, dane: new Float32Array(F * MAKS), n: 0, klip: [0, 0, 1e5, 1e5, 0],
    mapa: new WeakMap(), gen: [], polki: [], warstwa: 0, stat: { quady: 0, wgrane: 0, px: 0, czyszczenia: 0, zaDuze: 0, klatki: 0 } };

  function program(gl) {
    function sh(t, z) { var s = gl.createShader(t); gl.shaderSource(s, z); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
    var p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }
  function czyscWarstwe(w) { S.gen[w] = (S.gen[w] || 0) + 1; S.polki[w] = []; S.stat.czyszczenia++; }
  // Płótna obok #scena (pod nią) przy pierwszym użyciu; rozmiar jak #scena (ukladGry).
  function start(scena) {
    if (S.gl || S.blad) return S.dziala;
    try {
      var rodzic = scena && scena.parentNode; if (!rodzic) throw new Error("brak #scena");
      var pod = document.createElement("canvas"); pod.id = "scenaPod"; pod.className = "plotno";
      var cv = document.createElement("canvas"); cv.id = "glNuty"; cv.className = "plotno";
      var gl = cv.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: "high-performance" });
      if (!gl) throw new Error("brak WebGL2");
      rodzic.insertBefore(pod, scena); rodzic.insertBefore(cv, scena);
      S.cv = cv; S.pod = pod; S.cp = pod.getContext("2d"); S.gl = gl;
      S.prog = program(gl);
      S.u.wym = gl.getUniformLocation(S.prog, "uWym"); S.u.dpr = gl.getUniformLocation(S.prog, "uDpr"); S.u.tex = gl.getUniformLocation(S.prog, "uTex");
      S.vao = gl.createVertexArray(); gl.bindVertexArray(S.vao);
      S.vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, S.vbo); gl.bufferData(gl.ARRAY_BUFFER, S.dane.byteLength, gl.DYNAMIC_DRAW);
      for (var a = 0; a < 4; a++) { gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 4, gl.FLOAT, false, F * 4, a * 16); gl.vertexAttribDivisor(a, 1); }
      S.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D_ARRAY, S.tex);
      gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, AW, AH, WARSTWY);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);   // płótno 2D jest premultiplikowane: bez konwersji przy wgraniu
      for (var w = 0; w < WARSTWY; w++) czyscWarstwe(w);
      S.stat.czyszczenia = 0;
      cv.addEventListener("webglcontextlost", function (e) { e.preventDefault(); S.dziala = false; S.blad = "utrata kontekstu"; pod.style.display = "none"; });
      S.dziala = true;
    } catch (e) { S.blad = String(e && e.message || e); S.dziala = false; if (S.pod && S.pod.parentNode) S.pod.parentNode.removeChild(S.pod); console.warn("RibbitBeat: nuty GPU wyłączone:", S.blad); }
    return S.dziala;
  }
  function uklad(W, H, dpr) {
    if (!S.dziala) return;
    S.W = W; S.H = H; S.dpr = dpr;
    var dw = Math.round(W * dpr), dh = Math.round(H * dpr);
    if (S.cv.width !== dw || S.cv.height !== dh) { S.cv.width = dw; S.cv.height = dh; }
    if (S.pod.width !== dw || S.pod.height !== dh) { S.pod.width = dw; S.pod.height = dh; }
    for (var w = 0; w < WARSTWY; w++) czyscWarstwe(w);   // bitmapy nut mają rozmiar w px układu (ukladGry zeruje t.sprajty)
  }
  // Półkowy przydział w warstwie: półka = wiersz o wysokości bitmapy zaokrąglonej w górę do 8 px. Pełna warstwa = następna
  // w kółku czyści się w całości (nuty z niej już dawno zjechały; widoczne wgrają się ponownie przy następnym użyciu).
  function przydziel(w, h) {
    var hh = Math.ceil((h + ODSTEP) / 8) * 8, ww = w + ODSTEP;
    if (ww > AW || hh > AH) return null;
    for (var proba = 0; proba < 2; proba++) {
      var war = S.warstwa, P = S.polki[war], y = 0;
      for (var i = 0; i < P.length; i++) { var p = P[i]; if (p.h === hh && p.x + ww <= AW) { var x = p.x; p.x += ww; return { x: x, y: p.y, war: war }; } y = p.y + p.h; }
      if (y + hh <= AH) { P.push({ y: y, h: hh, x: ww }); return { x: 0, y: y, war: war }; }
      S.warstwa = (war + 1) % WARSTWY; czyscWarstwe(S.warstwa);
    }
    return null;
  }
  function wpis(b) {
    var e = S.mapa.get(b);
    if (e && S.gen[e.war] === e.gen) return e;
    var cv = b.cv, gl = S.gl, m = przydziel(cv.width, cv.height);
    if (!m) { S.stat.zaDuze++; return null; }
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, S.tex);
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, m.x, m.y, m.war, cv.width, cv.height, 1, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    S.stat.wgrane++; S.stat.px += cv.width * cv.height;
    e = { war: m.war, gen: S.gen[m.war], u: (m.x + .5) / AW, v: (m.y + .5) / AH, uw: (cv.width - 1) / AW, vh: (cv.height - 1) / AH };
    S.mapa.set(b, e);
    return e;
  }
  var api = {
    get wlaczone() { return S.dziala; },
    get pod() { return S.cp; },
    start: start, uklad: uklad,
    klatka: function () {
      if (!S.dziala) return false;
      S.n = 0; S.klip = [0, 0, 1e5, 1e5, 0]; S.stat.klatki++;
      var c = S.cp; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, S.pod.width, S.pod.height); c.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
      return true;
    },
    klip: function (x, y, w, h, r) { S.klip = [x, y, w, h, r || 0]; },
    // false = nie weszło (za duża bitmapa albo pełna kolejka): wołający rysuje ją po staremu
    obraz: function (b, x, y, w, h, alfa) {
      if (!S.dziala || S.n >= MAKS) return false;
      var e = wpis(b); if (!e) return false;
      var d = S.dane, o = S.n * F, k = S.klip;
      d[o] = x; d[o + 1] = y; d[o + 2] = w; d[o + 3] = h;
      d[o + 4] = e.u; d[o + 5] = e.v; d[o + 6] = e.uw; d[o + 7] = e.vh;
      d[o + 8] = k[0]; d[o + 9] = k[1]; d[o + 10] = k[2]; d[o + 11] = k[3];
      d[o + 12] = e.war; d[o + 13] = alfa == null ? 1 : alfa; d[o + 14] = k[4]; d[o + 15] = 0;
      S.n++; S.stat.quady++;
      return true;
    },
    rysuj: function () {
      if (!S.dziala) return;
      var gl = S.gl;
      gl.viewport(0, 0, S.cv.width, S.cv.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      if (!S.n) return;
      gl.useProgram(S.prog); gl.bindVertexArray(S.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, S.vbo); gl.bufferSubData(gl.ARRAY_BUFFER, 0, S.dane, 0, S.n * F);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, S.tex); gl.uniform1i(S.u.tex, 0);
      gl.uniform2f(S.u.wym, S.W, S.H); gl.uniform1f(S.u.dpr, S.dpr);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, S.n);
    },
    // Ekran wczytywania: kontekst, program (link na wątku GPU) i pierwsze wgranie do atlasu poza piosenką. Rysuje jedną
    // niewidoczną instancję, żeby sterownik złożył potok przed pierwszą nutą, potem czyści płótno.
    rozgrzej: function (scena) {
      if (!start(scena)) return false;
      var t = document.createElement("canvas"); t.width = 8; t.height = 8; var c = t.getContext("2d"); c.fillStyle = "#fff"; c.fillRect(0, 0, 8, 8);
      var W0 = S.W, H0 = S.H, d0 = S.dpr; if (!S.W) { S.W = 8; S.H = 8; S.dpr = 1; }
      api.klatka(); api.obraz({ cv: t }, 0, 0, 1, 1, 0.001); api.rysuj(); S.n = 0; api.rysuj();
      S.W = W0; S.H = H0; S.dpr = d0; czyscWarstwe(S.warstwa); S.stat.czyszczenia = 0; S.stat.wgrane = 0; S.stat.px = 0; S.stat.quady = 0; S.stat.klatki = 0;
      try { S.gl.finish(); } catch (e) {}
      return true;
    },
    stat: function () { var s = S.stat, k = Math.max(1, s.klatki); return { dziala: S.dziala, blad: S.blad, quadyNaKl: +(s.quady / k).toFixed(1), wgrane: s.wgrane, MPx: +(s.px / 1e6).toFixed(1), czyszczenia: s.czyszczenia, zaDuze: s.zaDuze }; }
  };
  glob.NutyGL = api;
})();
