"use strict";
// ===================== KAPSEL 3D — the capsule itself instead of the orientation ball =====================
// The orientation preview can show a model of the capsule (felt cap with four arrows on top, felt
// electronics underneath) instead of the gridded ball. Same matrix as the ball (`poseViewMatrix` +
// `poseMirrorX`), so the axis letters, the grab handles and the mini puck stay exactly where they
// were — only the picture under them changes.
//
// No 3D library: the model is a small GLB (web/assets/kapsel/kapsel.glb, ~3.6k triangles) and this
// file is a ~150-line WebGL renderer for it. One hidden WebGL canvas is shared by every preview on
// the page; each call renders into it and copies the result onto the caller's 2D canvas, so the
// ball's drawing code (letters, LED, spinner) keeps working on top unchanged. If WebGL or the file
// is not there, `draw` returns false and the caller draws the ball as before.
//
// Model frame (Blender → glTF Y-up export) → capsule frame (+Z = puck axis = top of the cap,
// +X = front): b = (−gz, −gx, gy). The cyan arrow on top therefore points at +X, the front marker.
// The model is built by a Blender script kept outside the repository.
//
// SKINS (2026-11-19). Besides the classic model there are felt skins in web/assets/kapsel/skiny/,
// one GLB each (same capsule, own top print, felt underside, base colour only, because this
// renderer reads nothing else).
// SKIN = GRAFIKA KAPSLA (2026-11-20). Skin nie jest już wyborem przeglądarki: wynika z grafiki
// kapsla urządzenia (meta.cap → CAP_SKIN w rf-03), więc podgląd 3D pokazuje ten sam kapsel, co
// pigułka w lewym górnym rogu. Modele trzymamy osobno na skin (ściąga się tylko ten, który ktoś
// pokazuje), bo ściąga z wieloma kapslami rysuje kilka różnych naraz. Kapsel bez grafiki = klasyczny.
const KAPSEL3D = (() => {
  const URL_KLASYCZNY = "/web/assets/kapsel/kapsel.glb";
  const urlGlb = s => s ? "/web/assets/kapsel/skiny/" + s + ".glb" : URL_KLASYCZNY;
  const MM = 1 / 16;              // cap radius 15 mm (+ crimp) → fits the ball's unit radius
  const EXT = 1.05;               // rendered square = ball diameter × EXT
  let gl = null, cvs = null, prog = null, loc = null;
  // Stan modelu na skin: idle | loading | ready | fail | missing (brak pliku → klasyczny).
  const models = {};
  const M = k => models[k] || (models[k] = { st: "idle", parts: [], failAt: 0, tries: 0 });
  let last = "", ctxLost = false;   // `last`: skin ostatniego rysowania (dla `state`)
  // PORAŻKA NIE JEST NA ZAWSZE. Model ściąga się przy pierwszym rysowaniu; jeśli serwer akurat
  // wstawał (przełącznik LIVE / Symulacja uruchamia aplikację od nowa, panel czeka ~1 s), fetch
  // padał, stan zostawał „fail" i do przeładowania strony wybór „Kapsel" pokazywał kulę bez słowa.
  // Teraz kolejna próba idzie po 3 s, najwyżej 20 razy (brak WebGL zatrzymuje próby od razu).
  let noGl = false, u32 = null;
  // UTRATA KONTEKSTU WebGL (uśpienie, reset sterownika, gra na pełnym ekranie). Bez obsługi `st`
  // zostawał „ready”, a na płótno szedł pusty obraz aż do przeładowania strony. Teraz: utrata =
  // stan „lost” (podgląd rysuje kulę), `preventDefault` prosi przeglądarkę o przywrócenie, a po
  // `webglcontextrestored` program, bufory i tekstury powstają od nowa na tym samym kontekście.
  // Gdy przywrócenie nie przychodzi, po RESTORE_WAIT_MS zakładamy nowe płótno i kontekst.
  const RESTORE_WAIT_MS = 5000;
  let lostAt = 0, gen = 0;          // `gen` rośnie przy każdej utracie: spóźnione wczytanie się nie liczy
  // Kontekst padł albo wstał: bufory i tekstury wszystkich modeli są martwe, każdy ściąga się od nowa.
  function dropGpu() { prog = null; loc = null; gen++;
    for (const k in models) { const m = models[k]; m.parts = []; if (m.st !== "missing") m.st = "idle"; m.tries = 0; } }
  function newContext() {
    cvs = document.createElement("canvas"); cvs.width = cvs.height = 256;
    const c = cvs;
    c.addEventListener("webglcontextlost", function (e) {
      e.preventDefault();
      if (c !== cvs) return;          // stare płótno po założeniu nowego: nic nie robimy
      ctxLost = true; lostAt = Date.now(); dropGpu();
    }, false);
    c.addEventListener("webglcontextrestored", function () {
      if (c !== cvs) return;
      dropGpu(); ctxLost = false;   // następne rysowanie odtworzy program i bufory
    }, false);
    gl = c.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: true, preserveDrawingBuffer: false });
  }
  const lost = () => !!(gl && gl.isContextLost && gl.isContextLost());

  const VS = `attribute vec3 aP; attribute vec3 aN; attribute vec2 aT;
uniform mat3 uC; uniform float uMx; uniform float uExt;
varying vec3 vN; varying vec2 vT;
void main(){ vec3 b = vec3(-aP.z, -aP.x, aP.y) * ${MM.toFixed(6)};
  vec3 p = uC * b; vec3 n = uC * vec3(-aN.z, -aN.x, aN.y);
  vN = vec3(n.x * uMx, n.y, n.z); vT = aT;
  gl_Position = vec4(uMx * p.x / uExt, p.y / uExt, -p.z / uExt * 0.5, 1.0); }`;
  const FS = `precision mediump float; varying vec3 vN; varying vec2 vT;
uniform sampler2D uTex; uniform vec4 uCol; uniform float uHasTex; uniform float uCut;
void main(){ vec3 n = normalize(vN); if(n.z < 0.0) n = -n;            // double-sided
  vec3 L = normalize(vec3(-0.45, 0.6, 0.75));
  float d = max(dot(n, L), 0.0);
  vec4 c = uHasTex > 0.5 ? texture2D(uTex, vT) * uCol : uCol;   // glTF: factor × texture
  if (c.a < uCut) discard;                                       // alphaMode MASK (nadruk)
  gl_FragColor = vec4(c.rgb * (0.42 + 0.68 * d), 1.0); }`;

  function sh(t, src) { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }

  async function load(sk) {
    const md = M(sk);
    md.st = "loading";
    const g0 = gen;
    try {
      if (!prog) {                  // kontekst i shadery raz; ponowna próba ściąga tylko plik
        if (!gl) newContext();      // po przywróceniu kontekstu płótno i `gl` zostają te same
        if (!gl) { noGl = true; throw new Error("no webgl"); }
        u32 = gl.getExtension("OES_element_index_uint");
        prog = gl.createProgram();
        gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { if (!lost()) noGl = true; throw new Error(gl.getProgramInfoLog(prog)); }
        loc = { aP: gl.getAttribLocation(prog, "aP"), aN: gl.getAttribLocation(prog, "aN"), aT: gl.getAttribLocation(prog, "aT"),
                uC: gl.getUniformLocation(prog, "uC"), uMx: gl.getUniformLocation(prog, "uMx"), uExt: gl.getUniformLocation(prog, "uExt"),
                uTex: gl.getUniformLocation(prog, "uTex"), uCol: gl.getUniformLocation(prog, "uCol"), uHasTex: gl.getUniformLocation(prog, "uHasTex"),
                uCut: gl.getUniformLocation(prog, "uCut") };
      }

      // ---- GLB: 12-byte header, JSON chunk, BIN chunk ----
      const res = await fetch(urlGlb(sk));
      if (!res.ok) throw new Error("HTTP " + res.status);
      const ab = await res.arrayBuffer();
      const dv = new DataView(ab);
      if (dv.getUint32(0, true) !== 0x46546C67) throw new Error("not a GLB");
      const jl = dv.getUint32(12, true);
      const J = JSON.parse(new TextDecoder().decode(new Uint8Array(ab, 20, jl)));
      const binOff = 20 + jl + 8;
      const view = i => { const v = J.bufferViews[i]; return { off: binOff + (v.byteOffset || 0), len: v.byteLength }; };
      const acc = i => { const a = J.accessors[i], v = view(a.bufferView), n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
        const T = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }[a.componentType];
        return new T(ab, v.off + (a.byteOffset || 0), a.count * n); };
      const texCache = {};
      const texOf = async ti => {
        if (texCache[ti]) return texCache[ti];
        const T = J.textures[ti], src = T.source != null ? T.source : ((T.extensions || {}).EXT_texture_webp || {}).source;
        const img = J.images[src], v = view(img.bufferView);
        let bmp = await createImageBitmap(new Blob([new Uint8Array(ab, v.off, v.len)], { type: img.mimeType }));
        // WebGL1 builds mipmaps only for power-of-two sizes; anything else would sample black.
        const pot = n => 1 << Math.round(Math.log2(Math.max(1, n)));
        if (pot(bmp.width) !== bmp.width || pot(bmp.height) !== bmp.height) {
          const c2 = document.createElement("canvas"); c2.width = Math.min(2048, pot(bmp.width)); c2.height = Math.min(2048, pot(bmp.height));
          c2.getContext("2d").drawImage(bmp, 0, 0, c2.width, c2.height); bmp = c2;
        }
        const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bmp);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        return (texCache[ti] = t);
      };
      const buf = (data, target) => { const b = gl.createBuffer(); gl.bindBuffer(target, b); gl.bufferData(target, data, gl.STATIC_DRAW); return b; };
      const nowe = [];              // składane osobno: wczytywanie unieważnione w trakcie nie miesza się z nowym modelem
      for (const node of J.nodes) {
        if (node.mesh == null) continue;
        for (const pr of J.meshes[node.mesh].primitives) {
          const A = pr.attributes, idx = acc(pr.indices);
          if (idx instanceof Uint32Array && !u32) throw new Error("no uint32 indices");
          const m = J.materials && pr.material != null ? J.materials[pr.material] : null, pbr = (m && m.pbrMetallicRoughness) || {};
          let pos = acc(A.POSITION);
          if (node.translation) { const t = node.translation; pos = pos.slice(); for (let i = 0; i < pos.length; i += 3) { pos[i] += t[0]; pos[i + 1] += t[1]; pos[i + 2] += t[2]; } }
          nowe.push({ pos: buf(pos, gl.ARRAY_BUFFER), nrm: buf(acc(A.NORMAL), gl.ARRAY_BUFFER),
                       uv: A.TEXCOORD_0 != null ? buf(acc(A.TEXCOORD_0), gl.ARRAY_BUFFER) : null,
                       idx: buf(idx, gl.ELEMENT_ARRAY_BUFFER), n: idx.length,
                       type: idx instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT,
                       tex: pbr.baseColorTexture ? await texOf(pbr.baseColorTexture.index) : null,
                       col: pbr.baseColorFactor || [1, 1, 1, 1],
                       cut: m && m.alphaMode === "MASK" ? (m.alphaCutoff != null ? m.alphaCutoff : 0.5) : -1 });
        }
      }
      if (lost()) throw new Error("context lost");   // utrata w trakcie wczytywania: bufory są puste
      if (g0 !== gen) return;       // kontekst padł i wstał w trakcie albo zmiana skinu: stan ustawiły już zdarzenia
      md.parts = nowe; md.st = "ready";
    } catch (e) {
      if (g0 !== gen) return;      // w międzyczasie zmiana skinu albo utrata kontekstu: ten wynik się nie liczy
      // skin, którego pliku nie ma (np. usunięty w nowszej wersji): wracamy do klasycznego modelu
      if (sk && /HTTP 404/.test(String(e && e.message))) { md.st = "missing"; return; }
      if (lost()) { if (!ctxLost) lostAt = Date.now(); ctxLost = true; dropGpu(); return; }
      md.st = "fail"; md.failAt = Date.now(); md.tries++; md.parts = [];
      if (!loc) noGl = true;        // WebGL albo shadery nie wstały: kolejna próba nic nie zmieni
      try { console.warn("[kapsel3d]", e); } catch (_) {} }
  }

  // Draws the capsule centred at (cx,cy) with the ball's radius `scale` and view matrix C
  // (row-major 3×3 from poseViewMatrix). Returns false while the model is not available —
  // the caller then draws the ball.
  // `skin` = nazwa skinu (CAP_SKIN), pusty albo nieznany = klasyczny model.
  function draw(ctx, cx, cy, scale, C, mx, skin) {
    let sk = typeof skin === "string" && /^[a-z_]+$/.test(skin) ? skin : "";
    if (sk && M(sk).st === "missing") sk = "";
    last = sk;
    if (!ctxLost && gl && lost()) { ctxLost = true; lostAt = Date.now(); dropGpu(); }
    if (ctxLost && Date.now() - lostAt > RESTORE_WAIT_MS) { gl = null; cvs = null; dropGpu(); ctxLost = false; }
    if (ctxLost) return false;
    const md = M(sk);
    if (md.st === "idle" || (md.st === "fail" && !noGl && md.tries < 20 && Date.now() - md.failAt > 3000)) load(sk);
    if (md.st !== "ready") return false;
    // PŁYNNOŚĆ (2026-11-17). Na ekranie stoją zwykle dwa podglądy naraz (karta Czujnik i miniatura
    // w prawej kolumnie), każdy innej wielkości, a płótno WebGL jest jedno. Wcześniej każde
    // rysowanie ustawiało mu rozmiar pod siebie, czyli dwa razy na klatkę przeglądarka zakładała
    // nowy bufor: zmierzone 8,5 ms na rysunek zamiast 3,5 ms, razem więcej niż cała klatka 60 Hz.
    // Teraz płótno tylko rośnie (w krokach po 128 px) i każdy podgląd rysuje się w jego lewym
    // dolnym rogu (tam WebGL ma początek układu), skąd `drawImage` bierze tylko ten kwadrat.
    // Gęstość ograniczona do 2×: więcej na tej wielkości obrazka i tak nie widać.
    // `preserveDrawingBuffer: false` wystarcza, bo kopia idzie w tym samym zadaniu co rysowanie.
    const dpr = Math.min(2, window.devicePixelRatio || 1), half = scale * EXT;
    const S = Math.max(32, Math.min(2048, Math.round(half * 2 * dpr)));
    if (cvs.width < S) { cvs.width = cvs.height = Math.min(2048, Math.ceil(S / 128) * 128); }
    gl.viewport(0, 0, S, S);
    // KRESKI NAD KAPSLEM I PO PRAWEJ (zgłoszenie właściciela, 2026-11-19: „często robi w podglądzie kapsla
    // takie dziwne ramki”). Czyszczony był tylko kwadrat S×S, więc reszta wspólnego płótna trzymała
    // obraz DRUGIEGO, większego podglądu. `drawImage` niżej skaluje wycinek (S to zaokrąglenie,
    // a gęstość ekranu bywa 1,25 albo 1,5), a przy skalowaniu wygładzanie sięga o piksel poza wycinek:
    // w górę i w prawo, bo kwadrat stoi w lewym dolnym rogu. Stąd cienka kreska z cudzego kapsla nad
    // obrazkiem i z jego prawej strony, raz mocniejsza, raz słabsza, zależnie od ułamka piksela.
    // Dlatego czyścimy CAŁE płótno (to jedno szybkie czyszczenie, nie zmiana rozmiaru), a nożyce
    // wracają dopiero na samo rysowanie.
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.SCISSOR_TEST); gl.scissor(0, 0, S, S);
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    gl.useProgram(prog);
    gl.uniformMatrix3fv(loc.uC, false, [C[0], C[3], C[6], C[1], C[4], C[7], C[2], C[5], C[8]]);
    gl.uniform1f(loc.uMx, mx); gl.uniform1f(loc.uExt, EXT); gl.uniform1i(loc.uTex, 0);
    for (const p of md.parts) {
      gl.bindBuffer(gl.ARRAY_BUFFER, p.pos); gl.enableVertexAttribArray(loc.aP); gl.vertexAttribPointer(loc.aP, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, p.nrm); gl.enableVertexAttribArray(loc.aN); gl.vertexAttribPointer(loc.aN, 3, gl.FLOAT, false, 0, 0);
      if (p.uv && loc.aT >= 0) { gl.bindBuffer(gl.ARRAY_BUFFER, p.uv); gl.enableVertexAttribArray(loc.aT); gl.vertexAttribPointer(loc.aT, 2, gl.FLOAT, false, 0, 0); }
      else if (loc.aT >= 0) { gl.disableVertexAttribArray(loc.aT); gl.vertexAttrib2f(loc.aT, 0, 0); }
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, p.tex);
      gl.uniform1f(loc.uHasTex, p.tex ? 1 : 0); gl.uniform4fv(loc.uCol, p.col); gl.uniform1f(loc.uCut, p.cut);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, p.idx); gl.drawElements(gl.TRIANGLES, p.n, p.type, 0);
    }
    ctx.drawImage(cvs, 0, cvs.height - S, S, S, cx - half, cy - half, half * 2, half * 2);
    return true;
  }
  return { draw, get state() { return ctxLost ? "lost" : M(last).st; } };
})();

// WHICH PICTURE: "kula" (the gridded ball, default) or "kapsel". In the panel it is a per-browser
// choice (localStorage, like the 2D/3D one); an overlay window runs in its own browser profile, so
// there it is a setting of the window (`ball` in the overlay config, rf-41) and is read from there.
POSE.ball = (() => { try { return localStorage.getItem("ribbitflip.poseBall") === "kapsel" ? "kapsel" : "kula"; } catch (e) { return "kula"; } })();
function poseBallIsCap() {
  if (typeof RF_OVL !== "undefined" && RF_OVL && typeof OVL !== "undefined" && OVL.cfg) return OVL.cfg.ball === "kapsel";
  return POSE.ball === "kapsel";
}
function setPoseBall(v) {
  POSE.ball = v === "kapsel" ? "kapsel" : "kula";
  try { localStorage.setItem("ribbitflip.poseBall", POSE.ball); } catch (e) {}
  const sel = document.getElementById("poseBall"); if (sel) sel.value = POSE.ball;
  _poseSkinShown = null; if (typeof syncPoseSkin === "function") syncPoseSkin();
  if (typeof renderOverview === "function") renderOverview();
}
// WYGLĄD KAPSLA = GRAFIKA KAPSLA URZĄDZENIA (2026-11-20). Lista obok Kula/Kapsel zmienia meta.cap
// pokazywanego kapsla, czyli jednocześnie grafikę w pigułce (lewy górny róg, edytor, ściąga) i skin
// modelu 3D. Wartości listy to numery grafik z rf-03 (CAP_IMG), nazwy — skiny z CAP_SKIN.
const KAPSEL_SKINY = [["1", "Strzałki"], ["2", "Żaba"], ["3", "Punk"], ["4", "Czaszka"], ["5", "Piorun"],
  ["6", "Irokez"], ["7", "Czaszka z ćwiekami"], ["8", "Osie"], ["9", "Szew"]];
// Kapsel pokazywany w karcie Czujnik (ten sam wybór, co VB() w rf-02).
function kapselViewDev() {
  if (typeof state === "undefined") return null;
  return ((typeof devKnownId === "function") ? devKnownId(state.viewDev) : null) || state.viewDev || state.activeDeviceId || null;
}
// Skin modelu 3D dla kapsla `dev`: z jego grafiki; bez grafiki (albo nieznany numer) = klasyczny.
function kapselSkinOf(dev) {
  const D = dev && typeof state !== "undefined" && state.devices ? state.devices[dev] : null;
  const cap = D && D.meta ? String(D.meta.cap || "") : "";
  return (typeof CAP_SKIN !== "undefined" && CAP_SKIN[cap]) || "";
}
function setPoseSkin(v) {
  const dev = kapselViewDev(), D = dev && state.devices ? state.devices[dev] : null;
  if (!D || !D.meta || typeof CAP_IMG === "undefined" || !CAP_IMG[v] || String(D.meta.cap || "") === v) return;
  D.meta.cap = v;
  if (typeof renderDeviceSelector === "function") renderDeviceSelector();
  if (typeof renderOverview === "function") renderOverview();
  fetch("/device?dev=" + encodeURIComponent(dev), { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cap: v }) }).catch(() => {});
}
// Lista idzie za pokazywanym kapslem: przełączenie kapsla albo zmiana jego grafiki gdzie indziej
// (drugie okno, przydział przy parowaniu) ustawia ją sama. Wołane z rysowania karty, więc DOM
// dotykamy tylko przy zmianie.
let _poseSkinShown = null;
function syncPoseSkin() {
  const sk = document.getElementById("poseSkin"); if (!sk) return;
  const dev = kapselViewDev(), D = dev && state.devices ? state.devices[dev] : null;
  const cap = D && D.meta ? String(D.meta.cap || "") : "";
  const key = (POSE.ball === "kapsel" ? "k" : "b") + cap;
  if (key === _poseSkinShown) return;
  _poseSkinShown = key;
  sk.value = cap; sk.hidden = POSE.ball !== "kapsel";
}
(() => {
  const sel = document.getElementById("poseBall");
  if (sel) { sel.value = POSE.ball; sel.addEventListener("change", e => setPoseBall(e.target.value)); }
  const sk = document.getElementById("poseSkin");
  if (sk) {
    sk.textContent = "";
    for (const [v, t] of KAPSEL_SKINY) sk.add(new Option(t, v));
    sk.hidden = POSE.ball !== "kapsel";
    sk.addEventListener("change", e => setPoseSkin(e.target.value));
    syncPoseSkin();
  }
})();
