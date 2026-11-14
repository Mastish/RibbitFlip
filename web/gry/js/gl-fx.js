/* gl-fx.js: silnik efektów gry RibbitBeat. WebGL2 z awaryjnym trybem canvas 2D.
 *
 * Warstwy (od spodu): #glTlo (WebGL2: program tła, bufor 0,5 × px CSS, najwyżej 960×540) → #tlo (2D: karty torów)
 * → #glFx (WebGL2: prymitywy światła, bufor min(dpr; 1,5) × px CSS) → #scena (2D: nuty, żaby, dymki) → HUD.
 * Prymitywy leżą więc nad kartami, ale pod nutami i żabami: światło „zza sceny” niczego czytelnego nie zasłania.
 *
 * Klatka: FX.klatka(st, c2d) na początku rysowania sceny, potem dowolne prymitywy, na końcu FX.rysuj().
 * Współrzędne zawsze w px CSS (0,0 = lewy górny róg, jak canvas 2D), niezależnie od dpr.
 * Kolory: "#rrggbb", "#rgb", "r,g,b", "rgb(…)"/"rgba(…)" albo [r,g,b] / [r,g,b,a] w skali 0–255 (a: 0..1).
 * Kolejność na #glFx: najpierw wszystko w blendzie normal (w kolejności emisji), potem wszystko w add (dodawanie
 * jest przemienne, więc kolejność między add nie ma znaczenia), na końcu błysk. Daje to najwyżej 5 draw calli na
 * klatkę bez względu na to, jak moduły przeplatają blendy; nowy draw call przy każdej zmianie blendu w kolejności
 * emisji przy czterech modułach efektów łatwo przekraczał limit 8.
 * Tryb 2D (brak WebGL2, ?gl=0, opcje.gl===false, błąd GL, utrata kontekstu): te same wywołania rysują od razu na c2d
 * z FX.klatka (save/restore, „lighter” dla add); bez c2d nic nie robią. FX.wlacz(false) wycisza wszystko.
 * Poza kontraktem planu (opcjonalne, wstecznie zgodne): FX.klip(x,y,w,h,r) przycina kolejne prymitywy klatki do
 * prostokąta karty (w GL nie działa clip płótna 2D), luk i pierscien przyjmują blend jako ostatni argument
 * (domyślnie add), wstega przyjmuje też [[x,y]], płaską tablicę i grubość per punkt {x,y,g}.
 */
(function () {
  "use strict";
  var glob = (typeof window !== "undefined") ? window : (typeof globalThis !== "undefined" ? globalThis : this);

  // ============================================================================================ stałe i drobiazgi
  var PI = Math.PI, TAU = PI * 2;
  var LIMIT_SPRITE = 4000, LIMIT_WIERZ = 20000;          // na klatkę (tryb GL); nadmiar pomijany i liczony w stat
  var LIMIT_SPRITE_2D = 1500, LIMIT_PKT_2D = 4000;       // tryb 2D: każdy sprite to osobne drawImage na CPU
  var KSZTALTY = ["kolo", "iskra", "gwiazda", "pasek", "kwadrat", "kropla"];
  var K_BLASK = 6, K_PELNY = 7;                          // kształty liczone w shaderze (bez kafla atlasu)
  var KAFEL = 64;                                        // bok kafla atlasu w tekselach
  var MAKS_PODGLADOW = 2;
  var F_SPR = 11, F_WIERZ = 13;                          // floaty na instancję sprite’a i na wierzchołek wstęgi
  var MAKS_KLIPOW = 16;                                  // różnych prostokątów przycięcia w jednej klatce
  var ATRYBUTY_GL = { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: "high-performance",
    preserveDrawingBuffer: false, depth: false, stencil: false };

  var ostrzezone = {};
  // Każdy rodzaj problemu ostrzega raz: błąd w pętli klatki nie może zalać konsoli 60 wpisami na sekundę.
  function ostrzez(klucz, tekst, x) {
    if (ostrzezone[klucz]) return;
    ostrzezone[klucz] = true;
    try { if (typeof console !== "undefined") console.warn("gl-fx: " + tekst, x === undefined ? "" : x); } catch (e) { /* brak konsoli */ }
  }
  function zegar() { return (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now(); }
  function num(v, dom) { return typeof v === "number" && v === v && v !== Infinity && v !== -Infinity ? v : dom; }
  function przytnij(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ulamek(v) { return v - Math.floor(v); }
  function indeksKsztaltu(k) {
    if (typeof k === "number") return przytnij(k | 0, 0, 5);
    var i = KSZTALTY.indexOf(k);
    return i < 0 ? 0 : i;
  }

  // ============================================================================================ kolory
  // Kolor → {r,g,b,a (0..1), klucz "R,G,B"}. Napisy parsowane raz (pamięć podręczna), bo moduły podają ten sam
  // napis co klatkę dla setek cząstek. Tablice trafiają do jednego obiektu roboczego: wołający kopiuje wartości od
  // razu, więc nie powstaje śmieć na każdą cząstkę.
  var pamiecKolorow = new Map();
  var kolTab = { r: 1, g: 1, b: 1, a: 1, klucz: "255,255,255" };
  var BIALY = { r: 1, g: 1, b: 1, a: 1, klucz: "255,255,255" };
  function zKanalow(r, g, b, a, cel) {
    var R = przytnij(Math.round(r), 0, 255), G = przytnij(Math.round(g), 0, 255), B = przytnij(Math.round(b), 0, 255);
    cel = cel || {};
    cel.r = R / 255; cel.g = G / 255; cel.b = B / 255; cel.a = przytnij(num(a, 1), 0, 1); cel.klucz = R + "," + G + "," + B;
    return cel;
  }
  function kolor(k) {
    if (Array.isArray(k) || (k && typeof k === "object" && typeof k.length === "number"))
      return zKanalow(num(+k[0], 255), num(+k[1], 255), num(+k[2], 255), k.length > 3 ? +k[3] : 1, kolTab);
    if (typeof k === "number") return zKanalow((k >> 16) & 255, (k >> 8) & 255, k & 255, 1, kolTab);
    var s = typeof k === "string" ? k : "", w = pamiecKolorow.get(s);
    if (w) return w;
    w = parsujKolor(s.trim());
    if (!w) { ostrzez("kolor|" + s, "nieznany kolor, rysuję biały", s); w = BIALY; }
    if (pamiecKolorow.size > 600) pamiecKolorow.clear();
    pamiecKolorow.set(s, w);
    return w;
  }
  function parsujKolor(s) {
    var m;
    if ((m = /^#([0-9a-f]{3})$/i.exec(s))) {
      var n3 = parseInt(m[1], 16);
      return zKanalow(((n3 >> 8) & 15) * 17, ((n3 >> 4) & 15) * 17, (n3 & 15) * 17, 1);
    }
    if ((m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(s))) {
      var n6 = parseInt(m[1], 16);
      return zKanalow((n6 >> 16) & 255, (n6 >> 8) & 255, n6 & 255, m[2] ? parseInt(m[2], 16) / 255 : 1);
    }
    if ((m = /^rgba?\(([^)]*)\)$/i.exec(s))) s = m[1];
    var cz = s.split(/[\s,\/]+/).filter(function (x) { return x !== ""; });
    if (cz.length >= 3 && cz.length <= 4) {
      var v = cz.map(Number);
      if (v.every(function (x) { return x === x; })) return zKanalow(v[0], v[1], v[2], cz.length > 3 ? v[3] : 1);
    }
    return null;
  }
  // Kolor do uniformu vec3/vec4 (0..1): napis koloru albo tablica liczb podana wprost.
  function wektorKoloru(k, dl) {
    if (typeof k === "string") { var c = kolor(k); return dl === 4 ? [c.r, c.g, c.b, c.a] : [c.r, c.g, c.b]; }
    return k;
  }

  // ============================================================================================ szum dla łuków
  // Deterministyczny (ziarno → zawsze ten sam zygzak): moduł decyduje, kiedy błyskawica „przeskakuje” (nowe ziarno),
  // więc migotanie nie przekracza 8 Hz tylko dlatego, że gra rysuje 60 klatek na sekundę.
  function los(z, i) { var v = Math.sin(z * 12.9898 + i * 78.233) * 43758.5453; return v - Math.floor(v); }
  function szum1(z, x) {
    var i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return los(z, i) * (1 - u) + los(z, i + 1) * u;
  }

  // ============================================================================================ kształty sprite’ów
  // Jedna definicja kształtu dla atlasu GPU i dla pamięci sprite’ów trybu 2D, żeby oba tryby wyglądały tak samo.
  // (u, v) w −1..1 (środek 0), wynik: wyj[0] = krycie 0..1, wyj[1] = „rdzeń” 0..1 (domieszka bieli, rozżarzenie).
  var wyj = [0, 0];
  function gladko(a, b, x) { var t = przytnij((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function ramie(x, y) { var w = 0.2 * Math.pow(Math.max(0, 1 - x), 1.6) + 0.012; return 1 - gladko(w * 0.35, w, y); }
  function punktKsztaltu(k, u, v) {
    var d = Math.sqrt(u * u + v * v), a = 0, g = 0, au = Math.abs(u), av = Math.abs(v);
    if (k === 0) {                         // kolo: plama Gaussa, brzeg wygaszony przed krawędzią kafla (bez kwadratu)
      a = Math.exp(-d * d * 3.2) * (1 - gladko(0.72, 1, d));
    } else if (k === 1) {                  // iskra: ostra jasna kropka z poświatą
      var rdzen = 1 - gladko(0.17, 0.25, d);
      var posw = (0.7 * Math.exp(-d * d * 9) + 0.3 * Math.exp(-d * 3.5)) * (1 - gladko(0.6, 1, d));
      a = Math.min(1, rdzen + posw); g = rdzen * 0.85;
    } else if (k === 2) {                  // gwiazda: cztery ramiona zwężane ku końcom + świecący środek
      a = Math.max(ramie(au, av), ramie(av, au), Math.exp(-d * d * 14) * 0.9) * (1 - gladko(0.88, 1, d));
      g = Math.exp(-d * d * 40) * 0.8;
    } else if (k === 3) {                  // pasek: poziomy prostokąt 2:1 (konfetti, wióry), ostre brzegi
      a = (au <= 0.92 && av <= 0.42) ? 1 : 0;
    } else if (k === 4) {                  // kwadrat: ostry, z marginesem na mipmapy
      a = (au <= 0.92 && av <= 0.92) ? 1 : 0;
    } else {                               // kropla: elipsa 0,8 × 1,2 (w kaflu 0,61 × 0,92)
      var ex = u / 0.61, ey = v / 0.92;
      a = (ex * ex + ey * ey <= 1) ? 1 : 0;
    }
    wyj[0] = a; wyj[1] = g;
    return wyj;
  }
  // Kafel N×N: krycie w R, rdzeń w G (RGBA8), ss×ss podpróbek na teksel, więc ostre brzegi mają wygładzenie.
  function wypelnijKafel(k, N, dane, przes, ss) {
    for (var j = 0; j < N; j++) for (var i = 0; i < N; i++) {
      var a = 0, g = 0;
      for (var sy = 0; sy < ss; sy++) for (var sx = 0; sx < ss; sx++) {
        var w = punktKsztaltu(k, ((i + (sx + 0.5) / ss) / N) * 2 - 1, ((j + (sy + 0.5) / ss) / N) * 2 - 1);
        a += w[0]; g += w[1];
      }
      var o = przes + (j * N + i) * 4, q = ss * ss;
      dane[o] = Math.round(a / q * 255); dane[o + 1] = Math.round(g / q * 255); dane[o + 2] = 0; dane[o + 3] = 255;
    }
  }

  // ============================================================================================ shadery prymitywów
  // Sprite: instancja = (x, y, sx, sy) + (obrót, kształt) + kolor (r, g, b, a) bez premnożenia; quad −1..1 obracany
  // w px CSS. Kształty 0–5 z atlasu (tekstura warstwowa: kafel na warstwę, mipmapy bez przeciekania sąsiadów),
  // 6 = blask (eliptyczny gradient liczony w shaderze, bez pasmowania przy dużych promieniach), 7 = pełny (błysk).
  var VS_SPRITE = [
    "#version 300 es",
    "layout(location=0) in vec2 a_rog;",
    "layout(location=1) in vec4 a_pozRozm;",
    "layout(location=2) in vec3 a_obrKsz;",
    "layout(location=3) in vec4 a_kolor;",
    "uniform vec4 u_ortho;",
    "out vec2 v_uv; out float v_ksz; out vec4 v_kolor; out vec2 v_px; flat out float v_klip;",
    "void main(){",
    "  float c = cos(a_obrKsz.x), s = sin(a_obrKsz.x);",
    "  vec2 l = a_rog * a_pozRozm.zw;",
    "  vec2 p = a_pozRozm.xy + vec2(c * l.x - s * l.y, s * l.x + c * l.y);",
    "  gl_Position = vec4(p * u_ortho.xy + u_ortho.zw, 0.0, 1.0);",
    "  v_uv = a_rog; v_ksz = a_obrKsz.y; v_kolor = a_kolor; v_px = p; v_klip = a_obrKsz.z;",
    "}"].join("\n");
  // Przycięcie (FX.klip): prostokąt z zaokrąglonymi rogami z tablicy uniformów, indeks w instancji / wierzchołku
  // (0 = bez przycięcia). Maska liczona w px CSS z wygładzeniem 1 px, więc paczki zostają bez zmian (scissor
  // wymagałby osobnego draw calla na każdy prostokąt).
  var KLIP_GLSL = [
    "uniform vec4 u_klipy[16];",
    "uniform float u_klipR[16];",
    "float maskaKlipu(vec2 p, float k){",
    "  int i = int(k + 0.5) - 1;",
    "  if (i < 0) return 1.0;",
    "  vec4 R = u_klipy[i]; float r = u_klipR[i]; vec2 pol = R.zw * 0.5;",
    "  vec2 q = abs(p - R.xy - pol) - pol + r;",
    "  return clamp(0.5 - (length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r), 0.0, 1.0);",
    "}"].join("\n");
  var FS_SPRITE = [
    "#version 300 es",
    "precision highp float;",
    "precision mediump sampler2DArray;",
    "uniform sampler2DArray u_atlas;",
    KLIP_GLSL,
    "in vec2 v_uv; in float v_ksz; in vec4 v_kolor; in vec2 v_px; flat in float v_klip;",
    "out vec4 o_kolor;",
    "void main(){",
    "  vec3 k = v_kolor.rgb; float a;",
    "  if (v_ksz < 5.5) {",
    "    vec4 t = texture(u_atlas, vec3(v_uv * 0.5 + 0.5, v_ksz));",
    "    a = t.r; k = mix(k, vec3(1.0), t.g);",
    "  } else if (v_ksz < 6.5) {",
    "    float d = length(v_uv);",
    "    a = pow(max(1.0 - d, 0.0), 1.35);",   // profil jak blask() gry: 1 w środku, ~0,45 w 0,45 promienia, 0 na brzegu
    "  } else { a = 1.0; }",
    "  a *= v_kolor.a * maskaKlipu(v_px, v_klip);",
    "  o_kolor = vec4(k * a, a);",
    "}"].join("\n");

  // Trójkąty (wstęgi, łuki, pierścienie): wierzchołek = pozycja, kolor, współrzędne lokalne i parametry.
  //  par.x = 0: wstęga; lok.x w poprzek (±1 na brzegu geometrii), lok.y wzdłuż tylko w kapslu końca (0..1), więc
  //         length(lok) daje półkolisty kapsel bez dodatkowej geometrii; par = (0, połowa szer. geometrii px,
  //         połowa szer. wstęgi px, miękkość 0 = ostra krawędź z wygładzeniem 1 px … 1 = profil poświaty).
  //  par.x = 1: pierścień; lok = przesunięcie od środka w px, par = (1, promień, połowa grubości, miękkość px).
  var VS_TROJ = [
    "#version 300 es",
    "layout(location=0) in vec2 a_poz;",
    "layout(location=1) in vec4 a_kolor;",
    "layout(location=2) in vec2 a_lok;",
    "layout(location=3) in vec4 a_par;",
    "layout(location=4) in float a_klip;",
    "uniform vec4 u_ortho;",
    "out vec4 v_kolor; out vec2 v_lok; out vec4 v_par; out vec2 v_px; flat out float v_klip;",
    "void main(){",
    "  v_kolor = a_kolor; v_lok = a_lok; v_par = a_par; v_px = a_poz; v_klip = a_klip;",
    "  gl_Position = vec4(a_poz * u_ortho.xy + u_ortho.zw, 0.0, 1.0);",
    "}"].join("\n");
  var FS_TROJ = [
    "#version 300 es",
    "precision highp float;",
    KLIP_GLSL,
    "in vec4 v_kolor; in vec2 v_lok; in vec4 v_par; in vec2 v_px; flat in float v_klip;",
    "out vec4 o_kolor;",
    "void main(){",
    "  float a;",
    "  if (v_par.x < 0.5) {",
    "    float d = length(v_lok);",
    "    float ostra = clamp(v_par.z - d * v_par.y + 0.5, 0.0, 1.0) * min(1.0, v_par.z * 2.0);",
    "    float t = clamp(1.0 - d, 0.0, 1.0);",
    "    a = mix(ostra, t, v_par.w);",           // miękki profil liniowy: szczyt na osi, poświata widoczna na całej szerokości
    "  } else {",
    "    float sd = abs(length(v_lok) - v_par.y) - v_par.z;",
    "    float m = max(v_par.w, 0.75);",
    "    a = (1.0 - smoothstep(-0.5 * m, 0.5 * m, sd)) * min(1.0, v_par.z * 2.0);",
    "  }",
    "  a *= v_kolor.a * maskaKlipu(v_px, v_klip);",
    "  o_kolor = vec4(v_kolor.rgb * a, a);",
    "}"].join("\n");

  // ============================================================================================ programy tła
  // Pełnoekranowy trójkąt z gl_VertexID (bez bufora wierzchołków). uv: 0..1, y w dół jak w canvas 2D.
  var VS_TLO = [
    "#version 300 es",
    "out vec2 v_uv;",
    "void main(){",
    "  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));",
    "  v_uv = vec2(p.x, 1.0 - p.y);",
    "  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);",
    "}"].join("\n");
  // Prolog programu tła: uniformy wspólne i biblioteka. Ciało modułu definiuje vec4 tlo(vec2 uv, vec2 px), zwraca kolor
  // BEZ premnożenia (rgb 0..1, a 0..1); main() premnaża. Ciało może deklarować własne uniformy (FX.tlo.rysuj, „dod”).
  var PROLOG_TLA = [
    "#version 300 es",
    "precision highp float;",
    // Komentarze opisujące uniformy są w JS, nie w GLSL: źródło shadera trzymamy w ASCII (patrz asciiGLSL).
    "uniform vec2 u_rozdz;",          // rozmiar sceny w px CSS
    "uniform float u_czas;",          // sekundy
    "uniform float u_beat;",          // ćwierćnuty od startu (ciągłe)
    "uniform float u_faza;",          // 0..1 w obrębie ćwierćnuty
    "uniform float u_og;",            // poziom ognia 0..3
    "uniform float u_zar;",           // wygładzony ogień 0..3
    "uniform float u_moc;",           // stopień / 20
    "uniform vec3 u_kolorA;",         // kolory 0..1 (domyślnie: st.kolor, st.kolorB albo akcent, st.akcent)
    "uniform vec3 u_kolorB;",
    "uniform vec3 u_akcent;",
    "uniform float u_impuls;",        // 1 przy progu kombo (co 4) albo wzroście ognia, gaśnie w ~0,4 s
    "uniform vec4 u_tory[8];",        // karty torów: x, y, w, h w px CSS
    "uniform int u_liczbaTorow;",
    "uniform vec2 u_widownia;",       // y, h pasa widowni w px CSS
    "in vec2 v_uv;",
    "out vec4 o_kolor;",
    "#define PI 3.14159265",
    "#define TAU 6.28318531",
    "float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }",
    "vec2 hash22(vec2 p){ vec3 a = fract(p.xyx * vec3(123.34, 234.34, 345.65)); a += dot(a, a + 34.45); return fract(vec2(a.x * a.y, a.y * a.z)); }",
    "float szum(vec2 p){ vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);",   // value noise 0..1
    "  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y); }",
    "vec3 _perm(vec3 x){ return mod(((x * 34.0) + 1.0) * x, 289.0); }",
    "float simplex(vec2 v){",                                                               // simplex 2D (Gustavson, McEwan), −1..1
    "  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);",
    "  vec2 i = floor(v + dot(v, C.yy)); vec2 x0 = v - i + dot(i, C.xx);",
    "  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);",
    "  vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1; i = mod(i, 289.0);",
    "  vec3 p = _perm(_perm(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));",
    "  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0); m = m * m; m = m * m;",
    "  vec3 x = 2.0 * fract(p * C.www) - 1.0; vec3 h = abs(x) - 0.5; vec3 a0 = x - floor(x + 0.5);",
    "  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);",
    "  vec3 g; g.x = a0.x * x0.x + h.x * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw;",
    "  return 130.0 * dot(m, g); }",
    "float fbm(vec2 p, int oktawy){ float s = 0.0, a = 0.5, n = 0.0; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);",  // 0..1, oktawy ≤ 6
    "  for (int i = 0; i < 6; i++){ if (i >= oktawy) break; s += a * szum(p); n += a; p = m * p + 17.3; a *= 0.5; }",
    "  return n > 0.0 ? s / n : 0.0; }",
    "vec2 voronoi(vec2 p){ vec2 n = floor(p), f = fract(p); float md = 8.0; vec2 id = vec2(0.0);",  // (odległość F1, ziarno komórki)
    "  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){ vec2 g = vec2(float(i), float(j)); vec2 r = g + hash22(n + g) - f;",
    "    float d = dot(r, r); if (d < md){ md = d; id = n + g; } }",
    "  return vec2(sqrt(md), hash21(id)); }",
    "vec3 hsv2rgb(vec3 c){ vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0); return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y); }",
    "mat2 obrot(float a){ float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }",
    "float gladko(float x){ x = clamp(x, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }",
    "float pas(float a, float b, float m, float x){ return smoothstep(a - m, a + m, x) - smoothstep(b - m, b + m, x); }",
    "float sdProstokat(vec2 p, vec2 pol, float r){ vec2 q = abs(p) - pol + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }",
    "float sdKarty(vec2 px){ float d = 1e5;",                                                 // < 0 wewnątrz karty toru
    "  for (int i = 0; i < 8; i++){ if (i >= u_liczbaTorow) break; vec4 t = u_tory[i];",
    "    d = min(d, sdProstokat(px - (t.xy + t.zw * 0.5), t.zw * 0.5, 16.0)); }",
    "  return d; }",
    "float wKartach(vec2 px){ return 1.0 - smoothstep(-1.0, 1.0, sdKarty(px)); }",
    ""].join("\n");
  var EPILOG_TLA = [
    "",
    "void main(){",
    "  vec4 k = tlo(v_uv, v_uv * u_rozdz);",
    "  float a = clamp(k.a, 0.0, 1.0);",
    "  o_kolor = vec4(clamp(k.rgb, 0.0, 1.0) * a, a);",
    "}"].join("\n");
  var LINIE_PROLOGU = PROLOG_TLA.split("\n").length - 1;
  var UNIFORMY_STD = ["u_rozdz", "u_czas", "u_beat", "u_faza", "u_og", "u_zar", "u_moc", "u_kolorA", "u_kolorB", "u_akcent",
    "u_impuls", "u_tory", "u_liczbaTorow", "u_widownia"];

  // Zarejestrowane źródła programów tła (wspólne dla gry i podglądów): id → {zrodlo, wersja}.
  var REJESTR_TLA = new Map();
  var RENDERERY = [];                     // żywe konteksty z rolą tła (gra + podglądy), kompilują nowe programy

  // Źródło GLSL w ASCII: znaki spoza ASCII (polskie komentarze w ciele modułu) zamieniane na spacje. GLSL ES
  // dopuszcza UTF-8 tylko w komentarzach, a nie każda implementacja WebGL to respektuje; poza komentarzem taki znak
  // i tak byłby błędem składni, więc zamiana niczego nie psuje.
  function asciiGLSL(s) { return String(s).replace(/[^\x00-\x7F]/g, " "); }
  // Log kompilacji z numerami linii przeliczonymi na linie ciała modułu (prolog ma LINIE_PROLOGU linii).
  function logCiala(log) {
    return String(log || "").replace(/(ERROR|WARNING): 0:(\d+):/g, function (_, typ, n) {
      return typ + ": linia ciała " + (parseInt(n, 10) - LINIE_PROLOGU) + ":";
    });
  }

  // ============================================================================================ narzędzia GL
  function jestWebGL2(gl) {
    // Atrapa płótna w testach Node zwraca dowolny obiekt z getContext; prawdziwy kontekst rozpoznajemy po klasie.
    return !!gl && typeof WebGL2RenderingContext === "function" && gl instanceof WebGL2RenderingContext;
  }
  function shader(gl, typ, zrodlo, nazwa) {
    var s = gl.createShader(typ);
    gl.shaderSource(s, asciiGLSL(zrodlo));
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost())
      throw new Error("shader " + nazwa + ": " + gl.getShaderInfoLog(s));
    return s;
  }
  function program(gl, vs, fs, nazwa) {
    var p = gl.createProgram(), a = shader(gl, gl.VERTEX_SHADER, vs, nazwa + "/vs"), b = shader(gl, gl.FRAGMENT_SHADER, fs, nazwa + "/fs");
    gl.attachShader(p, a); gl.attachShader(p, b); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error("program " + nazwa + ": " + gl.getProgramInfoLog(p));
    gl.deleteShader(a); gl.deleteShader(b);
    return p;
  }
  function zbierzUniformy(gl, p) {
    var m = new Map(), n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) || 0;
    for (var i = 0; i < n; i++) {
      var inf = gl.getActiveUniform(p, i);
      if (inf) m.set(inf.name.replace(/\[0\]$/, ""), { loc: gl.getUniformLocation(p, inf.name), typ: inf.type, rozmiar: inf.size });
    }
    return m;
  }
  // Wartość uniformu do tablicy o długości będącej wielokrotnością n (vec2/3/4, także tablice): liczba powielana,
  // napis = kolor, za krótka tablica dopełniana zerami. Zła długość dałaby błąd GL INVALID_VALUE w każdej klatce.
  function wektor(v, n) {
    if (typeof v === "string") return wektorKoloru(v, n);
    if (typeof v === "number") return n === 2 ? [v, v] : n === 3 ? [v, v, v] : [v, v, v, v];
    if (!v || typeof v.length !== "number") return null;
    if (v.length >= n && v.length % n === 0) return v;
    var dl = Math.max(n, v.length - v.length % n), w = new Array(dl);
    for (var i = 0; i < dl; i++) w[i] = num(+v[i], 0);
    return w;
  }
  function ustawUniform(gl, u, v) {
    if (v === undefined || v === null || !u.loc) return;
    if (typeof v === "boolean") v = v ? 1 : 0;
    var L = u.loc, t = u.typ, w;
    if (t === gl.FLOAT) { if (typeof v === "number") gl.uniform1f(L, v); else if ((w = wektor(v, 1))) gl.uniform1fv(L, w); }
    else if (t === gl.FLOAT_VEC2) { if ((w = wektor(v, 2))) gl.uniform2fv(L, w); }
    else if (t === gl.FLOAT_VEC3) { if ((w = wektor(v, 3))) gl.uniform3fv(L, w); }
    else if (t === gl.FLOAT_VEC4) { if ((w = wektor(v, 4))) gl.uniform4fv(L, w); }
    else if (t === gl.INT || t === gl.BOOL) { if (typeof v === "number") gl.uniform1i(L, v | 0); }
    else if (typeof v === "number") gl.uniform1f(L, v);   // inne typy: tylko liczba, reszta pomijana bez błędu
  }

  // Dane atlasu (6 kafli 64×64, RGBA8) liczone raz na stronę: gra, podglądy i odbudowa po utracie kontekstu biorą tę
  // samą tablicę.
  var daneAtlasu = null;
  function atlas() {
    if (!daneAtlasu) {
      daneAtlasu = new Uint8Array(KAFEL * KAFEL * 4 * KSZTALTY.length);
      for (var k = 0; k < KSZTALTY.length; k++) wypelnijKafel(k, KAFEL, daneAtlasu, k * KAFEL * KAFEL * 4, 4);
    }
    return daneAtlasu;
  }

  // ============================================================================================ renderer
  // Renderer = jeden kontekst WebGL2 na jednym płótnie. Rola fx: programy sprite’ów i trójkątów, atlas, bufory.
  // Rola tlo: programy tła z REJESTR_TLA. Gra ma dwa renderery (#glTlo i #glFx, bo to dwa płótna na różnych
  // warstwach DOM), podgląd ma jeden z obiema rolami.
  function utworzRenderer(cv, rolaFx, rolaTlo, limSpr, limWierz) {
    var r = { cv: cv, gl: null, fx: rolaFx, tlo: rolaTlo, gotowy: false, utracony: false, zepsuty: false, zwolniony: false,
      programyTla: new Map(), ext: null, czyszczenie: -1, brudne: false, limSpr: limSpr, limWierz: limWierz };

    function utrata(e) {
      if (r.zwolniony) return;
      if (e && e.preventDefault) e.preventDefault();         // bez tego przeglądarka nie odda kontekstu
      r.utracony = true; r.gotowy = false; r.programyTla = new Map(); r.brudne = false;
    }
    function odzyskanie() {
      if (r.zwolniony) return;
      r.utracony = false;
      try { zbuduj(); } catch (e) { r.zepsuty = true; ostrzez("odbudowa", "odbudowa po utracie kontekstu nieudana, tryb 2D", e && e.message); }
    }

    function zbuduj() {
      var gl = r.gl;
      r.gotowy = false; r.programyTla = new Map(); r.czyszczenie = -1; r.brudne = false;
      r.ext = gl.getExtension("KHR_parallel_shader_compile");
      if (r.fx) {
        r.pSprite = program(gl, VS_SPRITE, FS_SPRITE, "sprite");
        r.uSprite = { ortho: gl.getUniformLocation(r.pSprite, "u_ortho"), atlas: gl.getUniformLocation(r.pSprite, "u_atlas"),
          klipy: gl.getUniformLocation(r.pSprite, "u_klipy"), klipR: gl.getUniformLocation(r.pSprite, "u_klipR") };
        gl.useProgram(r.pSprite); gl.uniform1i(r.uSprite.atlas, 0);
        r.pTroj = program(gl, VS_TROJ, FS_TROJ, "troj");
        r.uTroj = { ortho: gl.getUniformLocation(r.pTroj, "u_ortho"),
          klipy: gl.getUniformLocation(r.pTroj, "u_klipy"), klipR: gl.getUniformLocation(r.pTroj, "u_klipR") };
        // Atlas jako tekstura warstwowa: każdy kształt ma własną warstwę, więc mipmapy małych iskier nie łapią
        // brzegów sąsiedniego kafla (w zwykłym atlasie 6×1 przeciekałyby na poziomach 8×8 i mniejszych).
        r.atlas = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, r.atlas);
        gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, KAFEL, KAFEL, KSZTALTY.length, 0, gl.RGBA, gl.UNSIGNED_BYTE, atlas());
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
        // Sprite’y: rogi quada (statyczne) + jeden VBO instancji (dynamiczny, osierocany co klatkę).
        r.vaoSprite = gl.createVertexArray();
        gl.bindVertexArray(r.vaoSprite);
        r.vboRogi = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, r.vboRogi);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        r.rozmInst = (r.limSpr + 1) * F_SPR * 4;                  // +1: instancja błysku
        r.vboInst = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, r.vboInst);
        gl.bufferData(gl.ARRAY_BUFFER, r.rozmInst, gl.DYNAMIC_DRAW);
        for (var a = 1; a <= 3; a++) { gl.enableVertexAttribArray(a); gl.vertexAttribDivisor(a, 1); }
        wskaznikiSprite(gl, 0);
        // Trójkąty: jeden dynamiczny VBO wierzchołków + bufor indeksów (wspólne wierzchołki wstęg).
        r.vaoTroj = gl.createVertexArray();
        gl.bindVertexArray(r.vaoTroj);
        r.rozmTroj = r.limWierz * F_WIERZ * 4;
        r.vboTroj = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, r.vboTroj);
        gl.bufferData(gl.ARRAY_BUFFER, r.rozmTroj, gl.DYNAMIC_DRAW);
        for (var b = 0; b <= 4; b++) gl.enableVertexAttribArray(b);
        wskaznikiTroj(gl, 0);
        r.rozmIdx = r.limWierz * 3 * 2;
        r.iboTroj = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, r.iboTroj);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, r.rozmIdx, gl.DYNAMIC_DRAW);
        gl.bindVertexArray(null);
      }
      if (r.tlo) {
        r.vsTlo = shader(gl, gl.VERTEX_SHADER, VS_TLO, "tlo/vs");
        r.vaoPusty = gl.createVertexArray();
        REJESTR_TLA.forEach(function (w, id) { kompilujTlo(id, false); });
        // Bez KHR_parallel_shader_compile nie da się zapytać „czy już?” bez czekania, więc czekamy teraz, przy
        // starcie, a nie w pierwszej klatce, która użyje programu.
        if (!r.ext) r.programyTla.forEach(function (e) { sprawdzTlo(e, true); });
      }
      r.gotowy = true;
    }
    function wskaznikiSprite(gl, baza) {
      var s = F_SPR * 4;
      gl.vertexAttribPointer(1, 4, gl.FLOAT, false, s, baza);         // x, y, sx, sy
      gl.vertexAttribPointer(2, 3, gl.FLOAT, false, s, baza + 16);    // obrót, kształt, klip
      gl.vertexAttribPointer(3, 4, gl.FLOAT, false, s, baza + 28);    // r, g, b, a
    }
    function wskaznikiTroj(gl, baza) {
      var s = F_WIERZ * 4;
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, s, baza);
      gl.vertexAttribPointer(1, 4, gl.FLOAT, false, s, baza + 8);
      gl.vertexAttribPointer(2, 2, gl.FLOAT, false, s, baza + 24);
      gl.vertexAttribPointer(3, 4, gl.FLOAT, false, s, baza + 32);
      gl.vertexAttribPointer(4, 1, gl.FLOAT, false, s, baza + 48);    // klip
    }

    // ---- programy tła: kompilacja zlecana od razu, wynik sprawdzany bez czekania (rozszerzenie równoległej
    // kompilacji), więc rejestracja 20 programów nie zatrzymuje gry na sumę ich czasów kompilacji.
    function kompilujTlo(id, czekaj) {
      var wpis = REJESTR_TLA.get(id), gl = r.gl;
      if (!wpis || !gl || !r.tlo || r.utracony) return null;
      var e = r.programyTla.get(id);
      if (e && e.wersja === wpis.wersja) { if (czekaj) sprawdzTlo(e, true); return e; }
      if (e) { try { gl.deleteProgram(e.prog); gl.deleteShader(e.fs); } catch (x) { /* kontekst mógł zniknąć */ } }
      var fs = gl.createShader(gl.FRAGMENT_SHADER);
      // ciało nie może mieć własnego #version ani precyzji (są w prologu); zabłąkany #version byłby błędem składni
      var cialo = wpis.zrodlo.replace(/^\s*#version[^\n]*\n/, "\n");
      gl.shaderSource(fs, asciiGLSL(PROLOG_TLA + cialo + EPILOG_TLA));
      gl.compileShader(fs);
      var p = gl.createProgram();
      gl.attachShader(p, r.vsTlo); gl.attachShader(p, fs); gl.linkProgram(p);
      e = { id: id, wersja: wpis.wersja, prog: p, fs: fs, stan: "kompiluje", unif: null };
      r.programyTla.set(id, e);
      if (czekaj) sprawdzTlo(e, true);
      return e;
    }
    function sprawdzTlo(e, czekaj) {
      if (!e) return false;
      if (e.stan !== "kompiluje") return e.stan === "ok";
      var gl = r.gl;
      if (!gl || gl.isContextLost()) return false;
      if (!czekaj && r.ext && !gl.getProgramParameter(e.prog, r.ext.COMPLETION_STATUS_KHR)) return false;
      if (gl.getProgramParameter(e.prog, gl.LINK_STATUS)) {
        e.stan = "ok"; e.unif = zbierzUniformy(gl, e.prog);
        return true;
      }
      if (gl.isContextLost()) return false;
      e.stan = "zly";                       // zepsuty program nie jest już kompilowany ani sprawdzany co klatkę
      ostrzez("tlo|" + e.id + "|" + e.wersja, "program tła „" + e.id + "” nie kompiluje się (prolog: " + LINIE_PROLOGU +
        " linii): " + logCiala(gl.getShaderInfoLog(e.fs)) + " " + (gl.getProgramInfoLog(e.prog) || ""));
      return false;
    }
    function programTla(id) {
      var e = r.programyTla.get(id);
      var wpis = REJESTR_TLA.get(id);
      if (!wpis) return null;
      if (!e || e.wersja !== wpis.wersja) e = kompilujTlo(id, false);
      return sprawdzTlo(e, !r.ext) ? e : null;
    }
    function liczbaTlaOk() { var n = 0; r.programyTla.forEach(function (e) { if (e.stan === "ok") n++; }); return n; }

    function przygotujCel(wyczysc, nrKlatki) {
      var gl = r.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, r.cv.width, r.cv.height);
      if (wyczysc) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); r.czyszczenie = nrKlatki; }
    }
    function rysujTlo(e, U, dod, nrKlatki) {
      var gl = r.gl;
      przygotujCel(r.czyszczenie !== nrKlatki, nrKlatki);
      gl.useProgram(e.prog);
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      for (var i = 0; i < UNIFORMY_STD.length; i++) { var u = e.unif.get(UNIFORMY_STD[i]); if (u) ustawUniform(gl, u, U[UNIFORMY_STD[i]]); }
      if (dod) for (var k in dod) if (Object.prototype.hasOwnProperty.call(dod, k)) { var u2 = e.unif.get(k); if (u2) ustawUniform(gl, u2, dod[k]); }
      gl.bindVertexArray(r.vaoPusty);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
      r.brudne = true;
    }

    // ---- partia prymitywów: normal (trójkąty, sprite’y), add (trójkąty, sprite’y), błysk; najwyżej 5 draw calli.
    function blendNormal(gl) { gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); }
    // Add dokłada światło do koloru i NIE zmienia alfy płótna: kompozytor przeglądarki składa premnożone płótno jako
    // kolor + tło × (1 − alfa), więc przy alfie 0 światło dodaje się do kart pod spodem zamiast je zasłaniać.
    function blendAdd(gl) { gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE); }
    function rysujPartie(P, W, H, nrKlatki) {
      var gl = r.gl, dc = 0;
      var nS0 = P.nSpr[0], nS1 = P.nSpr[1], nW0 = P.nW[0], nW1 = P.nW[1], nI0 = P.nI[0], nI1 = P.nI[1], jestBlysk = P.blyskA > 0.001;
      var wyczysc = r.czyszczenie !== nrKlatki;
      przygotujCel(wyczysc, nrKlatki);
      if (!(nS0 + nS1 + nI0 + nI1) && !jestBlysk) { if (wyczysc) r.brudne = false; return 0; }
      gl.enable(gl.BLEND);
      var ox = 2 / W, oy = -2 / H;
      if (nI0 + nI1) {
        gl.bindVertexArray(r.vaoTroj);
        gl.bindBuffer(gl.ARRAY_BUFFER, r.vboTroj);
        gl.bufferData(gl.ARRAY_BUFFER, r.rozmTroj, gl.DYNAMIC_DRAW);   // osierocenie: GPU nie czeka na poprzednią klatkę
        if (nW0) gl.bufferSubData(gl.ARRAY_BUFFER, 0, P.troj[0], 0, nW0 * F_WIERZ);
        if (nW1) gl.bufferSubData(gl.ARRAY_BUFFER, nW0 * F_WIERZ * 4, P.troj[1], 0, nW1 * F_WIERZ);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, r.rozmIdx, gl.DYNAMIC_DRAW);
        if (nI0) gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, P.idx[0], 0, nI0);
        if (nI1) gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, nI0 * 2, P.idx[1], 0, nI1);
      }
      if (nS0 + nS1 || jestBlysk) {
        gl.bindVertexArray(r.vaoSprite);
        gl.bindBuffer(gl.ARRAY_BUFFER, r.vboInst);
        gl.bufferData(gl.ARRAY_BUFFER, r.rozmInst, gl.DYNAMIC_DRAW);
        if (nS0) gl.bufferSubData(gl.ARRAY_BUFFER, 0, P.spr[0], 0, nS0 * F_SPR);
        if (nS1) gl.bufferSubData(gl.ARRAY_BUFFER, nS0 * F_SPR * 4, P.spr[1], 0, nS1 * F_SPR);
        if (jestBlysk) {
          var a = Math.min(0.25, P.blyskA), q = P.blyskInst;
          q[0] = W / 2; q[1] = H / 2; q[2] = W / 2 + 2; q[3] = H / 2 + 2; q[4] = 0; q[5] = K_PELNY; q[6] = 0;   // błysk bez przycięcia
          q[7] = P.blyskR / P.blyskA; q[8] = P.blyskG / P.blyskA; q[9] = P.blyskB / P.blyskA; q[10] = a;
          gl.bufferSubData(gl.ARRAY_BUFFER, (nS0 + nS1) * F_SPR * 4, q);
        }
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, r.atlas);
      }
      var klipy = P.nKlip > 0, klipTroj = false, klipSpr = false;   // prostokąty przycięcia raz na program i klatkę
      function troj(baza, ile, odIdx) {
        gl.bindVertexArray(r.vaoTroj); gl.bindBuffer(gl.ARRAY_BUFFER, r.vboTroj); wskaznikiTroj(gl, baza);
        gl.useProgram(r.pTroj); gl.uniform4f(r.uTroj.ortho, ox, oy, -1, 1);
        if (klipy && !klipTroj) { gl.uniform4fv(r.uTroj.klipy, P.klipy); gl.uniform1fv(r.uTroj.klipR, P.klipyR); klipTroj = true; }
        gl.drawElements(gl.TRIANGLES, ile, gl.UNSIGNED_SHORT, odIdx * 2); dc++;
      }
      function spr(baza, ile) {
        gl.bindVertexArray(r.vaoSprite); gl.bindBuffer(gl.ARRAY_BUFFER, r.vboInst); wskaznikiSprite(gl, baza);
        gl.useProgram(r.pSprite); gl.uniform4f(r.uSprite.ortho, ox, oy, -1, 1);
        if (klipy && !klipSpr) { gl.uniform4fv(r.uSprite.klipy, P.klipy); gl.uniform1fv(r.uSprite.klipR, P.klipyR); klipSpr = true; }
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, ile); dc++;
      }
      blendNormal(gl);
      if (nI0) troj(0, nI0, 0);
      if (nS0) spr(0, nS0);
      blendAdd(gl);
      if (nI1) troj(nW0 * F_WIERZ * 4, nI1, nI0);
      if (nS1) spr(nS0 * F_SPR * 4, nS1);
      if (jestBlysk) { blendNormal(gl); spr((nS0 + nS1) * F_SPR * 4, 1); }
      gl.bindVertexArray(null);
      r.brudne = true;
      return dc;
    }
    function wyczysc() {
      if (!r.gl || r.gl.isContextLost()) return;
      przygotujCel(true, r.czyszczenie);
      r.brudne = false;
    }

    r.utworz = function () {
      var gl = null;
      try { gl = cv.getContext("webgl2", ATRYBUTY_GL); } catch (e) { gl = null; }
      if (!jestWebGL2(gl)) return false;
      r.gl = gl;
      try {
        zbuduj();
      } catch (e) {
        ostrzez("budowa", "nie udało się zbudować zasobów WebGL2, tryb 2D", e && e.message);
        r.zwolnij();
        return false;
      }
      cv.addEventListener("webglcontextlost", utrata, false);
      cv.addEventListener("webglcontextrestored", odzyskanie, false);
      if (r.tlo) RENDERERY.push(r);
      return true;
    };
    r.dziala = function () { return !!r.gl && r.gotowy && !r.utracony && !r.zepsuty && !r.zwolniony && !r.gl.isContextLost(); };
    r.zwolnij = function () {
      if (r.zwolniony) return;
      r.zwolniony = true; r.gotowy = false;
      var i = RENDERERY.indexOf(r);
      if (i >= 0) RENDERERY.splice(i, 1);
      try { cv.removeEventListener("webglcontextlost", utrata, false); cv.removeEventListener("webglcontextrestored", odzyskanie, false); } catch (e) { /* atrapa */ }
      var gl = r.gl;
      if (gl && !gl.isContextLost()) {
        try {
          r.programyTla.forEach(function (e) { gl.deleteProgram(e.prog); gl.deleteShader(e.fs); });
          [r.vboRogi, r.vboInst, r.vboTroj, r.iboTroj].forEach(function (b) { if (b) gl.deleteBuffer(b); });
          [r.vaoSprite, r.vaoTroj, r.vaoPusty].forEach(function (v) { if (v) gl.deleteVertexArray(v); });
          if (r.atlas) gl.deleteTexture(r.atlas);
          if (r.pSprite) gl.deleteProgram(r.pSprite);
          if (r.pTroj) gl.deleteProgram(r.pTroj);
          if (r.vsTlo) gl.deleteShader(r.vsTlo);
          var ext = gl.getExtension("WEBGL_lose_context");
          if (ext) ext.loseContext();                 // pamięć GPU wraca od razu, nie przy sprzątaniu śmieci
        } catch (e) { /* zwalnianie nie może rzucić */ }
      }
      r.programyTla = new Map(); r.gl = null;
    };
    r.kompilujTlo = kompilujTlo; r.sprawdzTlo = sprawdzTlo; r.programTla = programTla; r.liczbaTlaOk = liczbaTlaOk;
    r.rysujTlo = rysujTlo; r.rysujPartie = rysujPartie; r.wyczysc = wyczysc;
    return r;
  }

  // ============================================================================================ punkty wstęg
  // Robocze tablice punktów (wspólne, wypełniane tuż przed emisją): x, y, połowa szerokości, długość narastająca.
  var MAKS_PKT = 1024;
  var px_ = new Float32Array(MAKS_PKT), py_ = new Float32Array(MAKS_PKT), ph_ = new Float32Array(MAKS_PKT), pd_ = new Float32Array(MAKS_PKT);
  // Przyjmuje [{x,y,g?}], [[x,y,g?]] albo płaską tablicę [x0,y0,x1,y1,…]; g = pełna szerokość w punkcie.
  // Pomija punkty niepoprawne i zdublowane (zerowy odcinek nie ma kierunku, więc i normalnej); ponad 1024 punkty
  // przerzedza równomiernie, zachowując pierwszy i ostatni.
  function wczytajPunkty(punkty, hwDom) {
    if (!punkty || typeof punkty.length !== "number") return 0;
    var plaska = typeof punkty[0] === "number", ile = plaska ? (punkty.length >> 1) : punkty.length;
    if (ile < 2) return 0;
    var krok = ile > MAKS_PKT ? (ile - 1) / (MAKS_PKT - 1) : 1, n = 0, ostX = NaN, ostY = NaN;
    for (var j = 0; ; j++) {
      var i = krok === 1 ? j : Math.round(j * krok);
      if (i >= ile || n >= MAKS_PKT) break;
      var x, y, g;
      if (plaska) { x = punkty[2 * i]; y = punkty[2 * i + 1]; g = undefined; }
      else {
        var p = punkty[i];
        if (!p) continue;
        if (typeof p.x === "number") { x = p.x; y = p.y; g = p.g; } else { x = p[0]; y = p[1]; g = p[2]; }
      }
      if (typeof x !== "number" || typeof y !== "number" || x !== x || y !== y || !isFinite(x) || !isFinite(y)) continue;
      if (n > 0 && Math.abs(x - ostX) < 0.05 && Math.abs(y - ostY) < 0.05) continue;
      px_[n] = x; py_[n] = y; ph_[n] = (typeof g === "number" && g >= 0 && isFinite(g)) ? Math.max(0.05, g / 2) : hwDom;
      ostX = x; ostY = y; n++;
    }
    pd_[0] = 0;
    for (var k = 1; k < n; k++) { var dx = px_[k] - px_[k - 1], dy = py_[k] - py_[k - 1]; pd_[k] = pd_[k - 1] + Math.sqrt(dx * dx + dy * dy); }
    return n;
  }
  // Zygzak błyskawicy do tablic roboczych: obwiednia sinus (końce dokładnie w punktach), na niej powolne wygięcie
  // (szum 1D, 35 %) i ostre skoki na każdym wierzchołku (los, 65 %: postrzępienie odróżnia piorun od zwykłej
  // falującej linii), oba z ziarna, więc ten sam łuk przy tym samym ziarnie.
  function punktyLuku(x0, y0, x1, y1, seg, z, amp) {
    var dx = x1 - x0, dy = y1 - y0, L = Math.sqrt(dx * dx + dy * dy);
    if (L < 0.5) return 0;
    var nx = -dy / L, ny = dx / L;
    for (var i = 0; i <= seg; i++) {
      var t = i / seg, off = 0;
      if (i > 0 && i < seg) off = amp * Math.sin(PI * t) * (0.35 * (szum1(z, t * 2.5) * 2 - 1) + 0.65 * (los(z + 0.37, i) * 2 - 1));
      px_[i] = x0 + dx * t + nx * off; py_[i] = y0 + dy * t + ny * off;
    }
    // Drobne postrzępienie: środek każdego odcinka przesunięty w poprzek o ≤ 28 % jego długości (jeden poziom
    // przesuwania punktu środkowego). Punkty główne trafiają na indeksy parzyste, od końca, żeby nie nadpisać źródeł.
    for (var j = seg; j >= 0; j--) { px_[2 * j] = px_[j]; py_[2 * j] = py_[j]; }
    for (var m = 0; m < seg; m++) {
      var ax = px_[2 * m], ay = py_[2 * m], bx = px_[2 * m + 2], by = py_[2 * m + 2], ex = bx - ax, ey = by - ay;
      var w = 0.28 * (los(z + 1.7, m) * 2 - 1);
      px_[2 * m + 1] = (ax + bx) / 2 - ey * w; py_[2 * m + 1] = (ay + by) / 2 + ex * w;
    }
    var n = 2 * seg + 1;
    pd_[0] = 0;
    for (var k = 1; k < n; k++) { var ex = px_[k] - px_[k - 1], ey = py_[k] - py_[k - 1]; pd_[k] = pd_[k - 1] + Math.sqrt(ex * ex + ey * ey); }
    return n;
  }

  // ============================================================================================ tryb 2D
  // Sprite’y trybu 2D: małe płótno na kształt i kolor (te same funkcje kształtu co atlas GPU), najwyżej 200 wpisów;
  // przy przepełnieniu wypada najstarszy. Bez ImageData (testy Node na atrapie) zostaje arc / fillRect.
  var pamiec2d = new Map(), ROZM_2D = 32;
  // Ile nowych obrazków wolno policzyć w jednej klatce (≈0,2 ms każdy). Kolory zmieniane płynnie co cząstkę
  // przepełniałyby pamięć co klatkę; ponad budżet sprite rysuje się zastępczo przez arc / fillRect.
  var budzetObrazow = 12;
  function wpisz2d(klucz, cv) {
    if (pamiec2d.size >= 200) pamiec2d.delete(pamiec2d.keys().next().value);
    pamiec2d.set(klucz, cv);
    return cv;
  }
  function obraz2d(k, c) {
    var klucz = k + "|" + c.klucz, cv = pamiec2d.get(klucz);
    if (cv !== undefined) return cv;
    if (budzetObrazow <= 0) return null;
    budzetObrazow--;
    cv = null;
    try {
      if (typeof document !== "undefined" && typeof ImageData === "function") {
        var N = ROZM_2D, el = document.createElement("canvas");
        el.width = N; el.height = N;
        var x = el.getContext("2d"), img = x && x.createImageData ? x.createImageData(N, N) : null;
        if (img && img.data && img.data.length === N * N * 4) {
          var d = img.data, R = c.r * 255, G = c.g * 255, B = c.b * 255;
          for (var j = 0; j < N; j++) for (var i = 0; i < N; i++) {
            var a = 0, g = 0;
            for (var s = 0; s < 4; s++) {
              var u = ((i + (s & 1 ? 0.75 : 0.25)) / N) * 2 - 1, v = ((j + (s & 2 ? 0.75 : 0.25)) / N) * 2 - 1;
              if (k === K_BLASK) { var dd = Math.sqrt(u * u + v * v); a += Math.pow(Math.max(0, 1 - dd), 1.35); }
              else { var w = punktKsztaltu(k, u, v); a += w[0]; g += w[1]; }
            }
            a /= 4; g /= 4;
            var o = (j * N + i) * 4;
            d[o] = R + (255 - R) * g; d[o + 1] = G + (255 - G) * g; d[o + 2] = B + (255 - B) * g; d[o + 3] = a * 255;
          }
          x.putImageData(img, 0, 0);
          cv = el;
        }
      }
    } catch (e) { cv = null; }
    return wpisz2d(klucz, cv);
  }
  function css(c) { return "rgb(" + c.klucz + ")"; }
  function sprite2d(cx, x, y, r, c, a, obr, k, add) {
    cx.save();
    cx.globalCompositeOperation = add ? "lighter" : "source-over";
    cx.globalAlpha = a;
    var img = (k === 3 || k === 4) ? null : obraz2d(k, c);   // pasek i kwadrat: ostre fillRect, taniej i wyraźniej
    if (img) {
      if (obr && k !== 0 && k !== 1) { cx.translate(x, y); cx.rotate(obr); cx.drawImage(img, -r, -r, 2 * r, 2 * r); }
      else cx.drawImage(img, x - r, y - r, 2 * r, 2 * r);
    } else {
      cx.fillStyle = css(c);
      if (k === 3 || k === 4) {
        var w = r * 0.92, h = k === 3 ? r * 0.42 : w;
        if (obr) { cx.translate(x, y); cx.rotate(obr); cx.fillRect(-w, -h, 2 * w, 2 * h); }
        else cx.fillRect(x - w, y - h, 2 * w, 2 * h);
      } else if (k === 5) { cx.beginPath(); cx.ellipse(x, y, r * 0.61, r * 0.92, obr || 0, 0, TAU); cx.fill(); }
      else { cx.beginPath(); cx.arc(x, y, r * (k === 0 ? 0.55 : 0.4), 0, TAU); cx.fill(); }
    }
    cx.restore();
  }
  function blask2d(cx, x, y, rx, ry, c, a, add) {
    cx.save();
    cx.globalCompositeOperation = add ? "lighter" : "source-over";
    cx.globalAlpha = a;
    var img = obraz2d(K_BLASK, c);
    if (img) cx.drawImage(img, x - rx, y - ry, 2 * rx, 2 * ry);
    else if (typeof cx.createRadialGradient === "function") {
      cx.translate(x, y); cx.scale(1, ry / Math.max(0.01, rx));
      var gr = cx.createRadialGradient(0, 0, 0, 0, 0, rx);
      gr.addColorStop(0, "rgba(" + c.klucz + ",1)"); gr.addColorStop(0.45, "rgba(" + c.klucz + ",0.45)");
      gr.addColorStop(0.75, "rgba(" + c.klucz + ",0.15)"); gr.addColorStop(1, "rgba(" + c.klucz + ",0)");
      cx.fillStyle = gr; cx.fillRect(-rx, -rx, 2 * rx, 2 * rx);
    } else { cx.fillStyle = css(c); cx.beginPath(); cx.arc(x, y, Math.min(rx, ry) * 0.5, 0, TAU); cx.fill(); }
    cx.restore();
  }
  function pierscien2d(cx, x, y, r, hz, m, c, a, add) {
    cx.save();
    cx.globalCompositeOperation = add ? "lighter" : "source-over";
    cx.strokeStyle = css(c);
    var r0 = Math.max(0, r - hz - m * 0.5), r1 = r + hz + m * 0.5;
    if (m > 1.5 && r1 > r0 + 0.5 && typeof cx.createRadialGradient === "function") {
      // profil jak SDF w shaderze: brzegi miękkie na szerokości m, środek pełny
      var g = cx.createRadialGradient(x, y, r0, x, y, r1), sz = r1 - r0, w = Math.min(0.5, m / sz);
      var pelny = "rgba(" + c.klucz + ",1)", pusty = "rgba(" + c.klucz + ",0)";
      g.addColorStop(0, pusty); g.addColorStop(w, pelny); g.addColorStop(1 - w, pelny); g.addColorStop(1, pusty);
      cx.globalAlpha = a; cx.fillStyle = g;
      cx.beginPath(); cx.arc(x, y, r1, 0, TAU); if (r0 > 0) cx.arc(x, y, r0, 0, TAU, true); cx.fill();
    } else {
      cx.globalAlpha = a; cx.lineWidth = Math.max(0.5, 2 * hz);
      cx.beginPath(); cx.arc(x, y, r, 0, TAU); cx.stroke();
    }
    cx.restore();
  }
  // Polilinia z tablic roboczych (n punktów). Alfa wzdłuż: gradient liniowy dla 2–3 punktów (lasery), trzy odcinki
  // o średniej alfie dla dłuższych (przybliżenie; dokładny przebieg daje tryb GL).
  function polilinia2d(cx, n, szer, c, a0, a1, add) {
    cx.save();
    cx.globalCompositeOperation = add ? "lighter" : "source-over";
    cx.lineWidth = Math.max(0.5, szer); cx.lineCap = "round"; cx.lineJoin = "round";
    var i, k;
    if (n < 4) {
      if (typeof cx.createLinearGradient === "function" && Math.abs(a1 - a0) > 0.01) {
        var gr = cx.createLinearGradient(px_[0], py_[0], px_[n - 1], py_[n - 1]);
        gr.addColorStop(0, "rgba(" + c.klucz + "," + a0.toFixed(3) + ")"); gr.addColorStop(1, "rgba(" + c.klucz + "," + a1.toFixed(3) + ")");
        cx.strokeStyle = gr; cx.globalAlpha = 1;
      } else { cx.strokeStyle = css(c); cx.globalAlpha = (a0 + a1) / 2; }
      cx.beginPath(); cx.moveTo(px_[0], py_[0]);
      for (i = 1; i < n; i++) cx.lineTo(px_[i], py_[i]);
      cx.stroke();
    } else {
      cx.strokeStyle = css(c); cx.lineCap = "butt";   // okrągłe końce kawałków nakładałyby się na złączach
      for (k = 0; k < 3; k++) {
        var i0 = Math.floor(k * (n - 1) / 3), i1 = Math.floor((k + 1) * (n - 1) / 3);
        if (i1 <= i0) continue;
        cx.globalAlpha = a0 + (a1 - a0) * (k + 0.5) / 3;
        cx.beginPath(); cx.moveTo(px_[i0], py_[i0]);
        for (i = i0 + 1; i <= i1; i++) cx.lineTo(px_[i], py_[i]);
        cx.stroke();
      }
    }
    cx.restore();
  }

  // ============================================================================================ partia klatki
  // Bufory jednej klatki: sprite’y i trójkąty w dwóch kubełkach (0 = normal, 1 = add) + akumulowany błysk.
  function nowaPartia(limSpr, limWierz) {
    return { limSpr: limSpr, limWierz: limWierz,
      spr: [new Float32Array(limSpr * F_SPR), new Float32Array(limSpr * F_SPR)], nSpr: [0, 0],
      troj: [new Float32Array(limWierz * F_WIERZ), new Float32Array(limWierz * F_WIERZ)], nW: [0, 0],
      idx: [new Uint16Array(limWierz * 3), new Uint16Array(limWierz * 3)], nI: [0, 0],
      blyskR: 0, blyskG: 0, blyskB: 0, blyskA: 0, blyskInst: new Float32Array(F_SPR),
      klipy: new Float32Array(MAKS_KLIPOW * 4), klipyR: new Float32Array(MAKS_KLIPOW), nKlip: 0 };
  }
  function zerujPartie(P) {
    P.nSpr[0] = P.nSpr[1] = 0; P.nW[0] = P.nW[1] = 0; P.nI[0] = P.nI[1] = 0; P.nKlip = 0;
    P.blyskR = P.blyskG = P.blyskB = P.blyskA = 0;
  }
  function wierzcholek(V, o, x, y, c, a, lx, ly, pol, hw, miek, kl) {
    V[o] = x; V[o + 1] = y; V[o + 2] = c.r; V[o + 3] = c.g; V[o + 4] = c.b; V[o + 5] = a;
    V[o + 6] = lx; V[o + 7] = ly; V[o + 8] = 0; V[o + 9] = pol; V[o + 10] = hw; V[o + 11] = miek; V[o + 12] = kl;
  }
  function liczniki() { return { sprites: 0, blaski: 0, wstegi: 0, luki: 0, pierscienie: 0, blyski: 0, tla: 0, inst: 0, wierz: 0, pkt: 0, pominiete: 0 }; }
  function skonczona(v) { return typeof v === "number" && isFinite(v); }
  var kolJasny = { r: 1, g: 1, b: 1, a: 1, klucz: "255,255,255" };
  var podgladyGL = 0;

  // ============================================================================================ silnik (instancja API)
  // Jedna instancja = jeden zestaw płócien. Gra: #glTlo + #glFx w #gra. Podgląd (okno „Scena”): jedno płótno cv z obiema
  // rolami. Ten sam kod API dla obu, różnią się tylko startem i limitami.
  function utworzSilnik(cvPodgladu, opcjePodgladu) {
    var podglad = !!cvPodgladu;
    var S = {
      wystartowany: false, gl: false, wlaczony: true, zwolniony: false, liczonyPodglad: false,
      W: 0, H: 0, dpr: 1, nr: 0, tryb: "2d", c2d: null, wlasny2d: null,
      rTlo: null, rFx: null, cvTlo: null, cvFx: null, P: null,
      impuls: 0, ostOg: 0, ostKombo: 0, ostCzas: -1,
      klipAkt: 0, klipR: null, klipObj: { x: 0, y: 0, w: 0, h: 0, r: 0 },   // FX.klip: indeks dla GPU (0 = brak) i prostokąt
      U: { u_rozdz: [1, 1], u_czas: 0, u_beat: 0, u_faza: 0, u_og: 0, u_zar: 0, u_moc: 0,
        u_kolorA: [0.925, 0.102, 0.514], u_kolorB: [0.651, 0.847, 0.38], u_akcent: [0.925, 0.102, 0.514],
        u_impuls: 0, u_tory: new Float32Array(32), u_liczbaTorow: 0, u_widownia: [0, 0] },
      L: liczniki(), ost: null
    };

    function aktywny() { return S.wlaczony && !S.zwolniony; }
    function glDziala() {
      if (!S.gl || S.zwolniony || !S.rFx || !S.rFx.dziala()) return false;
      return S.rTlo === S.rFx || (!!S.rTlo && S.rTlo.dziala());
    }
    function bladGL(gdzie, e) {
      ostrzez("gl|" + gdzie, "błąd WebGL (" + gdzie + "), dalej tryb 2D", e && e.message);
      S.gl = false; S.tryb = "2d";
      [S.cvTlo, S.cvFx].forEach(function (cv) { if (cv && cv.style && cv !== cvPodgladu) cv.style.display = "none"; });
    }
    function parametrBezGL() {
      try { return typeof location !== "undefined" && /[?&]gl=0(&|$)/.test(location.search || ""); } catch (e) { return false; }
    }

    // ---------------------------------------------------------------------------------------- start
    function przygotujPlotno(cv, id) {
      cv.id = id; cv.className = "plotno";
      if (cv.style) cv.style.pointerEvents = "none";
      if (cv.setAttribute) cv.setAttribute("aria-hidden", "true");
    }
    // #glTlo przed #tlo (pod kartami), #glFx między #tlo a #scena (nad kartami, pod nutami).
    function wstawPlotna(graEl, cvT, cvF) {
      var gra = graEl || (document.getElementById ? document.getElementById("gra") : null);
      if (!gra || typeof gra.insertBefore !== "function") return;
      var tlo = gra.querySelector ? gra.querySelector("#tlo") : null, scena = gra.querySelector ? gra.querySelector("#scena") : null;
      if (tlo && tlo.parentNode) tlo.parentNode.insertBefore(cvT, tlo); else gra.insertBefore(cvT, gra.firstChild || null);
      if (scena && scena.parentNode) scena.parentNode.insertBefore(cvF, scena);
      else if (tlo && tlo.parentNode) tlo.parentNode.insertBefore(cvF, tlo.nextSibling);
      else gra.appendChild(cvF);
    }
    function startGry(graEl) {
      if (typeof document === "undefined" || typeof document.createElement !== "function") return false;
      var cvT = document.createElement("canvas"), cvF = document.createElement("canvas");
      var rT = utworzRenderer(cvT, false, true, 0, 0), rF = utworzRenderer(cvF, true, false, LIMIT_SPRITE, LIMIT_WIERZ);
      if (!rT.utworz()) return false;
      if (!rF.utworz()) { rT.zwolnij(); return false; }
      przygotujPlotno(cvT, "glTlo"); przygotujPlotno(cvF, "glFx");
      wstawPlotna(graEl, cvT, cvF);
      S.rTlo = rT; S.rFx = rF; S.cvTlo = cvT; S.cvFx = cvF;
      S.P = nowaPartia(LIMIT_SPRITE, LIMIT_WIERZ);
      S.gl = true;
      var W = S.W, H = S.H, d = S.dpr;
      if (!(W > 0 && H > 0)) {   // gra i tak woła FX.uklad przy każdym układzie; to tylko rozmiar startowy
        W = (graEl && graEl.clientWidth) || glob.innerWidth || 1280; H = (graEl && graEl.clientHeight) || glob.innerHeight || 720;
        d = Math.min(2, glob.devicePixelRatio || 1);
      }
      uklad(W, H, d);
      return true;
    }
    function startPodgladu() {
      if (!cvPodgladu || typeof cvPodgladu.getContext !== "function") return false;
      if (podgladyGL >= MAKS_PODGLADOW) return false;          // trzeci podgląd naraz rysuje w trybie 2D
      // Opcjonalne drugie płótno na tło (opcje.cvTlo): ta sama kolejność warstw co w grze (tło pod 2D, prymitywy nad).
      var cvT = opcjePodgladu && opcjePodgladu.cvTlo && typeof opcjePodgladu.cvTlo.getContext === "function" ? opcjePodgladu.cvTlo : null;
      var r = utworzRenderer(cvPodgladu, true, !cvT, 1000, 6000), rT = r;
      if (!r.utworz()) return false;
      if (cvT) { rT = utworzRenderer(cvT, false, true, 0, 0); if (!rT.utworz()) { r.zwolnij(); return false; } }
      podgladyGL++; S.liczonyPodglad = true;
      S.rTlo = rT; S.rFx = r; S.cvTlo = cvT || cvPodgladu; S.cvFx = cvPodgladu;
      S.P = nowaPartia(1000, 6000);
      S.gl = true;
      if (!(S.W > 0)) { S.W = cvPodgladu.width || 300; S.H = cvPodgladu.height || 150; S.U.u_rozdz[0] = S.W; S.U.u_rozdz[1] = S.H; }
      return true;
    }
    // Gra: start(graEl, opcje). Podgląd: start(opcje). Wielokrotne wywołanie nic nie zmienia.
    function start(graEl, opcje) {
      if (S.zwolniony) return false;
      if (S.wystartowany) return glDziala();
      S.wystartowany = true;
      if (podglad) opcje = graEl;
      opcje = opcje || {};
      if (opcje.gl !== false && !parametrBezGL()) {
        try { S.gl = podglad ? startPodgladu() : startGry(graEl); }
        catch (e) { ostrzez("start", "WebGL2 nie wystartował, tryb 2D", e && e.message); S.gl = false; }
      }
      if (!S.gl && podglad) {
        try { var c = cvPodgladu.getContext("2d"); if (c && typeof c.save === "function") S.wlasny2d = c; } catch (e) { S.wlasny2d = null; }
      }
      S.tryb = S.gl ? "gl" : "2d";
      return S.gl;
    }

    // ---------------------------------------------------------------------------------------- układ i klatka
    function ustawRozmiar(cv, w, h) {
      w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
      var zmiana = cv.width !== w || cv.height !== h;
      if (cv.width !== w) cv.width = w;
      if (cv.height !== h) cv.height = h;
      return zmiana;
    }
    function uklad(W, H, dpr) {
      W = num(+W, 0); H = num(+H, 0);
      if (!(W > 0 && H > 0)) return;
      dpr = num(+dpr, S.dpr || 1);
      if (!(dpr > 0)) dpr = 1;
      S.W = W; S.H = H; S.dpr = dpr;
      S.U.u_rozdz[0] = W; S.U.u_rozdz[1] = H;
      if (S.P) zerujPartie(S.P);
      if (!S.gl || S.zwolniony) return;
      try {
        // #glFx ostre jak scena, ale najwyżej 1,5 × px CSS (wypełnianie pikseli to główny koszt GPU przy dpr 2);
        // #glTlo w połowie rozdzielczości: tło proceduralne jest miękkie, a to 4× mniej pikseli do policzenia.
        if (ustawRozmiar(S.cvFx, W * Math.min(dpr, 1.5), H * Math.min(dpr, 1.5)) && S.rFx) S.rFx.brudne = false;
        if (S.cvTlo !== S.cvFx) {
          var sT = podglad ? Math.min(dpr, 1.5) : Math.min(0.5, 960 / W, 540 / H);   // podgląd jest mały: pełna ostrość
          if (ustawRozmiar(S.cvTlo, W * sT, H * sT) && S.rTlo) S.rTlo.brudne = false;
        }
      } catch (e) { bladGL("uklad", e); }
    }
    function doKoloru(cel, k, dom) {
      var c = kolor(k === undefined || k === null || k === "" ? dom : k);
      cel[0] = c.r; cel[1] = c.g; cel[2] = c.b;
    }
    function uniformy(st) {
      var U = S.U, t = num(st.teraz, -1);
      var czas = num(st.ts, t >= 0 ? t / 1000 : zegar() / 1000);
      var dt = S.ostCzas >= 0 ? przytnij(czas - S.ostCzas, 0, 0.1) : 0;   // pauza karty nie gasi impulsu skokiem
      S.ostCzas = czas;
      U.u_czas = czas;
      U.u_beat = num(st.beat, 0);
      U.u_faza = ulamek(num(st.faza, U.u_beat));
      var og = num(st.og, 0), kombo = num(st.kombo, 0);
      S.impuls *= Math.exp(-dt / 0.35);
      if (og > S.ostOg || (kombo > S.ostKombo && kombo > 0 && kombo % 4 === 0)) S.impuls = 1;
      if (typeof st.impuls === "number") S.impuls = Math.max(S.impuls, przytnij(st.impuls, 0, 1));
      S.ostOg = og; S.ostKombo = kombo;
      U.u_impuls = S.impuls; U.u_og = og; U.u_zar = num(st.zar, og); U.u_moc = num(st.moc, 0);
      doKoloru(U.u_kolorA, st.kolorA || st.kolor, "#ec1a83");
      doKoloru(U.u_kolorB, st.kolorB || st.akcent, "#a6d861");
      doKoloru(U.u_akcent, st.akcent || st.kolor, "#ec1a83");
      var T = U.u_tory, n = 0, tory = st.tory;
      if (tory && tory.length) for (var i = 0; i < tory.length && n < 8; i++) {
        var p = tory[i];
        if (!p) continue;
        T[n * 4] = num(p.x, 0); T[n * 4 + 1] = num(p.y, 0); T[n * 4 + 2] = num(p.w, 0); T[n * 4 + 3] = num(p.h, 0); n++;
      }
      U.u_liczbaTorow = n;
      var wd = st.widownia;
      U.u_widownia[0] = wd ? num(wd.y, 0) : 0; U.u_widownia[1] = wd ? num(wd.h, 0) : 0;
    }
    function wyczyscWlasny2d() {
      var c = S.wlasny2d, cv = cvPodgladu;
      try { var sk = S.W > 0 ? cv.width / S.W : 1; c.setTransform(sk, 0, 0, sk, 0, 0); c.clearRect(0, 0, S.W || cv.width, S.H || cv.height); }
      catch (e) { /* atrapa */ }
    }
    function klatka(st, c2d) {
      if (S.zwolniony) return;
      if (podglad && !S.wystartowany) start();
      S.nr++;
      st = st && typeof st === "object" ? st : {};
      var W = num(st.W, 0), H = num(st.H, 0), d = num(st.dpr, S.dpr);
      if (W > 0 && H > 0 && (W !== S.W || H !== S.H || d !== S.dpr)) uklad(W, H, d);
      S.L = liczniki();
      if (S.P) zerujPartie(S.P);
      budzetObrazow = 12;
      S.klipAkt = 0; S.klipR = null;                       // przycięcie żyje najwyżej do końca klatki
      S.tryb = glDziala() ? "gl" : "2d";
      S.c2d = (c2d && typeof c2d.save === "function") ? c2d : null;
      if (!S.c2d && S.tryb === "2d" && S.wlasny2d && S.wlaczony) { S.c2d = S.wlasny2d; wyczyscWlasny2d(); }
      uniformy(st);
    }
    function migawka(dc, ms) {
      var L = S.L;
      return { gl: false, tryb: S.wlaczony ? S.tryb : "wylaczony", sprites: L.sprites, blaski: L.blaski, wstegi: L.wstegi, luki: L.luki,
        pierscienie: L.pierscienie, blyski: L.blyski, tla: L.tla, wierzcholki: L.wierz, pominiete: L.pominiete,
        drawCalls: dc, programyTla: 0, ms: ms };
    }
    S.ost = migawka(0, 0);
    function rysuj() {
      var t0 = zegar(), dc = 0;
      if (!S.zwolniony && S.wlaczony && S.tryb === "gl" && S.P && glDziala()) {
        var P = S.P, r = S.rFx, tresc = P.nSpr[0] + P.nSpr[1] + P.nI[0] + P.nI[1] + (P.blyskA > 0.001 ? 1 : 0);
        // pusta klatka po pustej klatce nie dotyka GPU (płótno bez zmian nie jest ponownie składane)
        if (tresc || (r.brudne && r.czyszczenie !== S.nr)) {
          try { dc = r.rysujPartie(P, S.W || 1, S.H || 1, S.nr); } catch (e) { bladGL("rysuj", e); }
        }
      }
      if (S.P) zerujPartie(S.P);
      S.ost = migawka(dc, zegar() - t0);
    }
    function stat() {
      var s = {}, k;
      for (k in S.ost) s[k] = S.ost[k];
      s.gl = glDziala();
      s.programyTla = (s.gl && S.rTlo) ? S.rTlo.liczbaTlaOk() : 0;
      return s;
    }
    function wlacz(tak) {
      tak = arguments.length ? !!tak : true;
      if (S.wlaczony === tak) return;
      S.wlaczony = tak;
      if (S.P) zerujPartie(S.P);
      if (!S.gl) return;
      try {
        if (!tak) {
          if (S.rFx && S.rFx.dziala()) S.rFx.wyczysc();
          if (S.rTlo && S.rTlo !== S.rFx && S.rTlo.dziala()) S.rTlo.wyczysc();
        }
        if (!podglad) [S.cvTlo, S.cvFx].forEach(function (cv) { if (cv && cv.style) cv.style.visibility = tak ? "" : "hidden"; });
      } catch (e) { bladGL("wlacz", e); }
    }

    // ---------------------------------------------------------------------------------------- tło
    function tloRysuj(id, dod) {
      if (!aktywny() || !S.gl || !glDziala()) return false;
      try {
        var r = S.rTlo, e = r.programTla(id);
        if (!e) return false;
        r.rysujTlo(e, S.U, dod, S.nr);
        S.L.tla++;
        return true;
      } catch (err) { bladGL("tlo", err); return false; }
    }
    function tloWylacz() {
      if (!S.gl || !S.rTlo || !S.rTlo.dziala()) return;
      try { S.rTlo.wyczysc(); } catch (e) { bladGL("tlo", e); }
    }
    function tloGotowy(id) {
      if (!S.gl || !glDziala()) return false;
      try { return !!S.rTlo.programTla(id); } catch (e) { return false; }
    }

    // ---------------------------------------------------------------------------------------- emisja GL
    function emitujInst(b, x, y, sx, sy, o, k, c, a) {
      var P = S.P;
      if (S.L.inst >= P.limSpr) { S.L.pominiete++; return false; }
      var arr = P.spr[b], i = P.nSpr[b] * F_SPR;
      arr[i] = x; arr[i + 1] = y; arr[i + 2] = sx; arr[i + 3] = sy; arr[i + 4] = o; arr[i + 5] = k; arr[i + 6] = S.klipAkt;
      arr[i + 7] = c.r; arr[i + 8] = c.g; arr[i + 9] = c.b; arr[i + 10] = a;
      P.nSpr[b]++; S.L.inst++;
      return true;
    }
    function emitujPierscien(b, x, y, r, hz, m, R, c, a) {
      var P = S.P;
      if (S.L.wierz + 4 > P.limWierz) { S.L.pominiete++; return false; }
      var V = P.troj[b], v0 = P.nW[b], o = v0 * F_WIERZ, I = P.idx[b], io = P.nI[b];
      for (var j = 0; j < 4; j++) {
        var lx = (j & 1) ? R : -R, ly = (j & 2) ? R : -R;
        V[o] = x + lx; V[o + 1] = y + ly; V[o + 2] = c.r; V[o + 3] = c.g; V[o + 4] = c.b; V[o + 5] = a;
        V[o + 6] = lx; V[o + 7] = ly; V[o + 8] = 1; V[o + 9] = r; V[o + 10] = hz; V[o + 11] = m; V[o + 12] = S.klipAkt;
        o += F_WIERZ;
      }
      I[io] = v0; I[io + 1] = v0 + 1; I[io + 2] = v0 + 2; I[io + 3] = v0 + 2; I[io + 4] = v0 + 1; I[io + 5] = v0 + 3;
      P.nW[b] += 4; P.nI[b] += 6; S.L.wierz += 4;
      return true;
    }
    // Wstęga z tablic roboczych (n punktów): wierzchołki wspólne dla sąsiednich segmentów (łączenie mitrą z limitem
    // ~2,9 × szerokości), więc nie ma szczelin ani podwójnego krycia na złączach; nakładane segmenty w blendzie add
    // świeciłyby jaśniejszą kropką na każdym złączu. Końce: półkoliste kapsle z dwóch dodatkowych wierzchołków.
    function emitujWstege(b, n, pad, miek, c, a0, a1, skala) {
      var P = S.P, potrzeba = 2 * n + 4;
      if (S.L.wierz + potrzeba > P.limWierz) { S.L.pominiete++; return false; }
      var V = P.troj[b], I = P.idx[b], v0 = P.nW[b], o = v0 * F_WIERZ, io = P.nI[b], cal = pd_[n - 1] || 1, kl = S.klipAkt;
      var i, hw, pol, nx, ny, dl;
      for (i = 0; i < n; i++) {
        hw = ph_[i] * skala; pol = hw + pad;
        var i0 = i > 0 ? i - 1 : 0, i1 = i < n - 1 ? i + 1 : n - 1;
        var ax = px_[i] - px_[i0], ay = py_[i] - py_[i0], bx = px_[i1] - px_[i], by = py_[i1] - py_[i];
        if (i === 0) { ax = bx; ay = by; } else if (i === n - 1) { bx = ax; by = ay; }
        var la = Math.sqrt(ax * ax + ay * ay) || 1, lb = Math.sqrt(bx * bx + by * by) || 1;
        var n0x = -ay / la, n0y = ax / la, n1x = -by / lb, n1y = bx / lb, mx = n0x + n1x, my = n0y + n1y, ml = Math.sqrt(mx * mx + my * my);
        if (ml < 1e-3) { nx = n0x; ny = n0y; dl = pol; }
        else { nx = mx / ml; ny = my / ml; dl = pol / Math.max(nx * n0x + ny * n0y, 0.35); }
        var a = a0 + (a1 - a0) * (pd_[i] / cal);
        wierzcholek(V, o, px_[i] + nx * dl, py_[i] + ny * dl, c, a, 1, 0, pol, hw, miek, kl); o += F_WIERZ;
        wierzcholek(V, o, px_[i] - nx * dl, py_[i] - ny * dl, c, a, -1, 0, pol, hw, miek, kl); o += F_WIERZ;
      }
      // kapsle: kierunek i normalna na końcach
      var dx = px_[1] - px_[0], dy = py_[1] - py_[0], l = Math.sqrt(dx * dx + dy * dy) || 1;
      dx /= l; dy /= l; hw = ph_[0] * skala; pol = hw + pad;
      wierzcholek(V, o, px_[0] - dx * pol - dy * pol, py_[0] - dy * pol + dx * pol, c, a0, 1, 1, pol, hw, miek, kl); o += F_WIERZ;
      wierzcholek(V, o, px_[0] - dx * pol + dy * pol, py_[0] - dy * pol - dx * pol, c, a0, -1, 1, pol, hw, miek, kl); o += F_WIERZ;
      var k = n - 1;
      dx = px_[k] - px_[k - 1]; dy = py_[k] - py_[k - 1]; l = Math.sqrt(dx * dx + dy * dy) || 1;
      dx /= l; dy /= l; hw = ph_[k] * skala; pol = hw + pad;
      wierzcholek(V, o, px_[k] + dx * pol - dy * pol, py_[k] + dy * pol + dx * pol, c, a1, 1, 1, pol, hw, miek, kl); o += F_WIERZ;
      wierzcholek(V, o, px_[k] + dx * pol + dy * pol, py_[k] + dy * pol - dx * pol, c, a1, -1, 1, pol, hw, miek, kl);
      for (i = 0; i < n - 1; i++) {
        var q = v0 + 2 * i;
        I[io++] = q; I[io++] = q + 1; I[io++] = q + 2; I[io++] = q + 2; I[io++] = q + 1; I[io++] = q + 3;
      }
      var s = v0 + 2 * n, e = s + 2, L = v0 + 2 * n - 2;
      I[io++] = s; I[io++] = s + 1; I[io++] = v0; I[io++] = v0; I[io++] = s + 1; I[io++] = v0 + 1;
      I[io++] = L; I[io++] = L + 1; I[io++] = e; I[io++] = e; I[io++] = L + 1; I[io++] = e + 1;
      P.nW[b] += potrzeba; P.nI[b] = io; S.L.wierz += potrzeba;
      return true;
    }

    // ---------------------------------------------------------------------------------------- przycięcie
    // FX.klip(x, y, w, h, r=0): kolejne prymitywy tej klatki rysują się tylko wewnątrz prostokąta (r = zaokrąglenie
    // rogów, karta toru ma 16). FX.klip() wyłącza; FX.klatka zeruje. Błysku nie dotyczy. W GL maska w shaderze,
    // w 2D clip ścieżką tylko dla prymitywów przecinających brzeg (w całości poza = pominięte, w całości wewnątrz =
    // bez kosztu przycinania).
    function klip(x, y, w, h, r) {
      S.klipAkt = 0; S.klipR = null;
      if (x === undefined || x === null || x === false) return;
      x = num(x, NaN); y = num(y, NaN); w = num(w, 0); h = num(h, 0);
      if (!(x === x && y === y && w > 0 && h > 0)) return;
      r = przytnij(num(r, 0), 0, Math.min(w, h) / 2);
      var k = S.klipObj;
      k.x = x; k.y = y; k.w = w; k.h = h; k.r = r; S.klipR = k;
      var P = S.P;
      if (!P || S.tryb !== "gl") return;
      var fx = Math.fround(x), fy = Math.fround(y), fw = Math.fround(w), fh = Math.fround(h), fr = Math.fround(r), i;
      for (i = 0; i < P.nKlip; i++) {
        var o = i * 4;
        if (P.klipy[o] === fx && P.klipy[o + 1] === fy && P.klipy[o + 2] === fw && P.klipy[o + 3] === fh && P.klipyR[i] === fr) { S.klipAkt = i + 1; return; }
      }
      if (P.nKlip >= MAKS_KLIPOW) { ostrzez("klipy", "ponad " + MAKS_KLIPOW + " prostokątów przycięcia w klatce; kolejne tną tylko całe prymitywy"); return; }
      i = P.nKlip++;
      P.klipy[i * 4] = x; P.klipy[i * 4 + 1] = y; P.klipy[i * 4 + 2] = w; P.klipy[i * 4 + 3] = h; P.klipyR[i] = r;
      S.klipAkt = i + 1;
    }
    // Czy prostokąt leży w całości poza ekranem albo poza aktywnym przycięciem (wtedy prymityw nie zużywa limitu).
    function pozaProst(x0, y0, x1, y1) {
      if (S.W > 0 && (x1 < 0 || y1 < 0 || x0 > S.W || y0 > S.H)) return true;
      var k = S.klipR;
      return !!k && (x1 < k.x || y1 < k.y || x0 > k.x + k.w || y0 > k.y + k.h);
    }
    function poza(x, y, rx, ry) { return pozaProst(x - rx, y - ry, x + rx, y + ry); }
    // Tryb 2D: clip ścieżką przycięcia, gdy prymityw przecina jej brzeg; zwraca true, jeśli trzeba potem restore().
    function klip2d(x0, y0, x1, y1) {
      var k = S.klipR;
      if (!k) return false;
      var m = k.r * 0.3;                                  // narożnik zaokrąglony: wnętrze bezpieczne od 0,3·r
      if (x0 >= k.x + m && y0 >= k.y + m && x1 <= k.x + k.w - m && y1 <= k.y + k.h - m) return false;
      var cx = S.c2d;
      cx.save(); cx.beginPath();
      if (k.r > 0 && typeof cx.roundRect === "function") cx.roundRect(k.x, k.y, k.w, k.h, k.r); else cx.rect(k.x, k.y, k.w, k.h);
      cx.clip();
      return true;
    }
    // Obwiednia punktów roboczych (n) poszerzona o margines.
    var ob = [0, 0, 0, 0];
    function obwiednia(n, marg) {
      var x0 = px_[0], y0 = py_[0], x1 = x0, y1 = y0;
      for (var i = 1; i < n; i++) {
        var x = px_[i], y = py_[i];
        if (x < x0) x0 = x; else if (x > x1) x1 = x;
        if (y < y0) y0 = y; else if (y > y1) y1 = y;
      }
      ob[0] = x0 - marg; ob[1] = y0 - marg; ob[2] = x1 + marg; ob[3] = y1 + marg;
      return ob;
    }

    // ---------------------------------------------------------------------------------------- prymitywy
    function sprite(x, y, rozm, kol, alfa, obrot, ksztalt, blend) {
      if (!aktywny()) return;
      var a = num(alfa, 1), r = num(rozm, 0);
      if (!(a > 0.002) || !(r > 0.05) || !skonczona(x) || !skonczona(y) || poza(x, y, r * 1.42, r * 1.42)) return;
      var c = kolor(kol), k = indeksKsztaltu(ksztalt), add = blend !== "normal", o = num(obrot, 0);
      a = Math.min(1, a) * c.a;
      if (S.tryb === "gl" && S.P) { if (emitujInst(add ? 1 : 0, x, y, r, r, o, k, c, a)) S.L.sprites++; }
      else if (S.c2d) {
        if (S.L.sprites + S.L.blaski >= LIMIT_SPRITE_2D) { S.L.pominiete++; return; }
        var kl = klip2d(x - r * 1.42, y - r * 1.42, x + r * 1.42, y + r * 1.42);
        sprite2d(S.c2d, x, y, r, c, a, o, k, add); S.L.sprites++;
        if (kl) S.c2d.restore();
      }
    }
    function blask(x, y, rx, ry, kol, alfa, blend) {
      if (!aktywny()) return;
      var a = num(alfa, 1);
      rx = num(rx, 0); ry = num(ry, rx);
      if (!(a > 0.002) || !(rx > 0.05) || !(ry > 0.05) || !skonczona(x) || !skonczona(y) || poza(x, y, rx, ry)) return;
      var c = kolor(kol), add = blend !== "normal";
      a = Math.min(1, a) * c.a;
      if (S.tryb === "gl" && S.P) { if (emitujInst(add ? 1 : 0, x, y, rx, ry, 0, K_BLASK, c, a)) S.L.blaski++; }
      else if (S.c2d) {
        if (S.L.sprites + S.L.blaski >= LIMIT_SPRITE_2D) { S.L.pominiete++; return; }
        var kl = klip2d(x - rx, y - ry, x + rx, y + ry);
        blask2d(S.c2d, x, y, rx, ry, c, a, add); S.L.blaski++;
        if (kl) S.c2d.restore();
      }
    }
    // blend: "add" (domyślnie, światło nad ciemnym) albo "normal" (nad jasną kartą, gdzie add bieleje).
    function pierscien(x, y, r, grubosc, kol, alfa, miekkosc, blend) {
      if (!aktywny()) return;
      var a = num(alfa, 1);
      r = Math.max(0, num(r, 0));
      var hz = Math.max(0.05, num(grubosc, 2) / 2), m = Math.max(0, num(miekkosc, 1)), R = r + hz + m + 1.5;
      if (!(a > 0.002) || !skonczona(x) || !skonczona(y) || poza(x, y, R, R)) return;
      var c = kolor(kol), add = blend !== "normal";
      a = Math.min(1, a) * c.a;
      if (S.tryb === "gl" && S.P) { if (emitujPierscien(add ? 1 : 0, x, y, r, hz, m, R, c, a)) S.L.pierscienie++; }
      else if (S.c2d) {
        var kl = klip2d(x - R, y - R, x + R, y + R);
        pierscien2d(S.c2d, x, y, r, hz, m, c, a, add); S.L.pierscienie++;
        if (kl) S.c2d.restore();
      }
    }
    function wstega(punkty, grubosc, kol, alfa0, alfa1, blend) {
      if (!aktywny()) return;
      var a0 = przytnij(num(alfa0, 1), 0, 1), a1 = przytnij(num(alfa1, a0), 0, 1);
      if (a0 <= 0.002 && a1 <= 0.002) return;
      var hw = Math.max(0.05, num(grubosc, 2) / 2), n = wczytajPunkty(punkty, hw);
      if (n < 2) return;
      var hmax = 0, i;
      for (i = 0; i < n; i++) if (ph_[i] > hmax) hmax = ph_[i];
      var b = obwiednia(n, hmax + 1);
      if (pozaProst(b[0], b[1], b[2], b[3])) return;
      var c = kolor(kol), add = blend !== "normal";
      a0 *= c.a; a1 *= c.a;
      if (S.tryb === "gl" && S.P) { if (emitujWstege(add ? 1 : 0, n, 1, 0, c, a0, a1, 1)) S.L.wstegi++; }
      else if (S.c2d) {
        if (S.L.pkt + n > LIMIT_PKT_2D) { S.L.pominiete++; return; }
        var sr = 0;
        for (i = 0; i < n; i++) sr += ph_[i];
        var kl = klip2d(b[0], b[1], b[2], b[3]);
        S.L.pkt += n; polilinia2d(S.c2d, n, 2 * sr / n, c, a0, a1, add); S.L.wstegi++;
        if (kl) S.c2d.restore();
      }
    }
    // blend "normal": rdzeń w pełnym kolorze (rozjaśnienie ku bieli znika na papierze), poświaty jak w add. Biały
    // gorący środek nad kartą: drugi luk z tym samym ziarnem, cieńszy, biały, w add (ten sam zygzak).
    function luk(x0, y0, x1, y1, grubosc, kol, alfa, ziarno, amplituda, segmenty, blend) {
      if (!aktywny()) return;
      var a = przytnij(num(alfa, 1), 0, 1);
      if (a <= 0.002 || !skonczona(x0) || !skonczona(y0) || !skonczona(x1) || !skonczona(y1)) return;
      var seg = przytnij(Math.round(num(segmenty, 12)), 2, 64);
      var n = punktyLuku(x0, y0, x1, y1, seg, num(ziarno, 0), num(amplituda, 0));
      if (n < 2) return;
      var g = Math.max(0.3, num(grubosc, 2)), c = kolor(kol), aa = a * c.a, add = blend !== "normal";
      var b = obwiednia(n, g * 4 + 1);
      if (pozaProst(b[0], b[1], b[2], b[3])) return;
      for (var i = 0; i < n; i++) ph_[i] = g / 2;
      // rdzeń: w add kolor rozjaśniony ku bieli (gorący środek wyładowania), w normal pełny kolor
      var jas = add ? 0.75 : 0;
      kolJasny.r = c.r + (1 - c.r) * jas; kolJasny.g = c.g + (1 - c.g) * jas; kolJasny.b = c.b + (1 - c.b) * jas;
      // Trzy warstwy: szeroka aura (× 8, alfa × 0,12), poświata z kontraktu (× 3, alfa × 0,35) i rdzeń. Sama poświata
      // × 3 przy cienkim łuku to 2 px światła po bokach rdzenia: na zrzutach łuk czytał się jak zwykła łamana.
      if (S.tryb === "gl" && S.P) {
        if (S.L.wierz + 3 * (2 * n + 4) > S.P.limWierz) { S.L.pominiete++; return; }
        var kub = add ? 1 : 0;
        emitujWstege(kub, n, 0, 1, c, aa * 0.12, aa * 0.12, 8);
        emitujWstege(kub, n, 0, 1, c, aa * 0.35, aa * 0.35, 3);
        emitujWstege(kub, n, 1, 0.2, kolJasny, aa, aa, 1);
        S.L.luki++;
      } else if (S.c2d) {
        if (S.L.pkt + 2 * n > LIMIT_PKT_2D) { S.L.pominiete++; return; }
        kolJasny.klucz = Math.round(kolJasny.r * 255) + "," + Math.round(kolJasny.g * 255) + "," + Math.round(kolJasny.b * 255);
        var kl = klip2d(b[0], b[1], b[2], b[3]);
        S.L.pkt += 2 * n;
        polilinia2d(S.c2d, n, g * 3, c, aa * 0.35, aa * 0.35, add);   // tryb 2D: bez szerokiej aury (koszt wypełniania)
        polilinia2d(S.c2d, n, g, kolJasny, aa, aa, add);
        S.L.luki++;
        if (kl) S.c2d.restore();
      }
    }
    // Błysk całego ekranu: blend normal (rozjaśnia ciemne tło, a jasnej karty nie przepala), alfa przycięta do 0,25;
    // kilka błysków w klatce składa się w jeden (alfa „over”), więc to zawsze jeden draw call.
    function blysk(kol, alfa) {
      if (!aktywny()) return;
      var c = kolor(kol), a = przytnij(num(alfa, 0), 0, 0.25) * c.a;
      if (!(a > 0.002)) return;
      if (S.tryb === "gl" && S.P) {
        var P = S.P;
        P.blyskR = c.r * a + P.blyskR * (1 - a); P.blyskG = c.g * a + P.blyskG * (1 - a); P.blyskB = c.b * a + P.blyskB * (1 - a);
        P.blyskA = a + P.blyskA * (1 - a);
        S.L.blyski++;
      } else if (S.c2d) {
        var cx = S.c2d, cv = cx.canvas, W = S.W || (cv && cv.width) || 4096, H = S.H || (cv && cv.height) || 4096;
        cx.save(); cx.globalCompositeOperation = "source-over"; cx.globalAlpha = a; cx.fillStyle = css(c);
        cx.fillRect(0, 0, W, H); cx.restore();
        S.L.blyski++;
      }
    }

    // ---------------------------------------------------------------------------------------- zwolnienie i diagnostyka
    function zwolnij() {
      if (S.zwolniony) return;
      S.zwolniony = true;
      if (S.rFx) S.rFx.zwolnij();
      if (S.rTlo && S.rTlo !== S.rFx) S.rTlo.zwolnij();
      if (S.liczonyPodglad) { podgladyGL--; S.liczonyPodglad = false; }
      S.P = null; S.gl = false; S.rFx = S.rTlo = null; S.wlasny2d = null; S.c2d = null; S.tryb = "2d";
    }
    function diag() {
      var tla = {};
      if (S.rTlo) S.rTlo.programyTla.forEach(function (e, id) { tla[id] = e.stan; });
      return { tryb: S.tryb, gl: glDziala(), wlaczony: S.wlaczony, W: S.W, H: S.H, dpr: S.dpr,
        sprite: !!(S.rFx && S.rFx.pSprite), troj: !!(S.rFx && S.rFx.pTroj), tla: tla,
        rownolegla: !!(S.rTlo && S.rTlo.ext), plotna: S.cvFx ? [S.cvTlo.width, S.cvTlo.height, S.cvFx.width, S.cvFx.height] : null };
    }

    var api = {
      start: start, gotowy: glDziala, wlacz: wlacz, uklad: uklad, klatka: klatka, rysuj: rysuj,
      sprite: sprite, blask: blask, pierscien: pierscien, luk: luk, wstega: wstega, blysk: blysk, klip: klip,
      tlo: { zarejestruj: zarejestrujTlo, rysuj: tloRysuj, wylacz: tloWylacz, gotowy: tloGotowy },
      stat: stat
    };
    if (podglad) api.zwolnij = zwolnij;
    return { api: api, S: S, diag: diag };
  }

  // ============================================================================================ rejestr programów tła
  // Przed FX.start: źródło zapamiętane, kompilacja przy starcie (zwrot true = przyjęte). Po starcie z WebGL2:
  // kompilacja od razu i zwrot wyniku (rejestracja leży poza klatką, np. w rozgrzej()). W trybie 2D: false.
  // Ponowna rejestracja tego samego źródła nic nie robi; zmienione źródło = nowa wersja programu.
  function zarejestrujTlo(id, glsl) {
    if (typeof id !== "string" || !id || typeof glsl !== "string" || !glsl) {
      ostrzez("rej|" + id, "FX.tlo.zarejestruj potrzebuje id i źródła GLSL", id);
      return false;
    }
    var stary = REJESTR_TLA.get(id);
    if (!stary || stary.zrodlo !== glsl) REJESTR_TLA.set(id, { zrodlo: glsl, wersja: stary ? stary.wersja + 1 : 1 });
    var S = glowny.S;
    if (!S.wystartowany) return true;
    var wynik = false;
    for (var i = 0; i < RENDERERY.length; i++) {
      var r = RENDERERY[i];
      if (!r.dziala()) continue;
      // Z KHR_parallel_shader_compile gra też NIE czeka (10-04: czekanie na program tła zamrażało start piosenki na
      // ~0,9 s na Intelu): wynik true = przyjęte (gotowe albo jeszcze się kompiluje), false = błąd kompilacji.
      // Gotowość sprawdza FX.tlo.gotowy(id) bez czekania. Bez rozszerzenia jak dotąd: czekamy tu, poza klatką.
      var czekaj = r === S.rTlo && !r.ext;
      var e = r.kompilujTlo(id, czekaj);
      if (r === S.rTlo) wynik = r.sprawdzTlo(e, czekaj) || !!(e && e.stan === "kompiluje");
    }
    return wynik;
  }

  // ============================================================================================ eksport
  var glowny = utworzSilnik(null), G = glowny.api;
  // Cel globalnych wywołań rysujących. Moduły efektów wołają FX.sprite(…) w swoich fx(st); żeby ten sam kod rysował
  // w podglądzie okna „Scena”, między p.klatka() a p.rysuj() podglądu globalne FX.* trafiają do podglądu.
  // FX.klatka gry zawsze przywraca cel na grę, więc przerwana klatka podglądu nie przejmie następnej klatki gry.
  var cel = G;
  var FX = {
    start: G.start, gotowy: G.gotowy, wlacz: G.wlacz, uklad: G.uklad, stat: G.stat,
    klatka: function (st, c2d) { cel = G; G.klatka(st, c2d); },
    rysuj: function () { cel = G; G.rysuj(); },
    sprite: function (x, y, rozm, kol, alfa, obrot, ksztalt, blend) { cel.sprite(x, y, rozm, kol, alfa, obrot, ksztalt, blend); },
    blask: function (x, y, rx, ry, kol, alfa, blend) { cel.blask(x, y, rx, ry, kol, alfa, blend); },
    pierscien: function (x, y, r, grubosc, kol, alfa, miekkosc, blend) { cel.pierscien(x, y, r, grubosc, kol, alfa, miekkosc, blend); },
    luk: function (x0, y0, x1, y1, grubosc, kol, alfa, ziarno, amplituda, segmenty, blend) { cel.luk(x0, y0, x1, y1, grubosc, kol, alfa, ziarno, amplituda, segmenty, blend); },
    wstega: function (punkty, grubosc, kol, alfa0, alfa1, blend) { cel.wstega(punkty, grubosc, kol, alfa0, alfa1, blend); },
    blysk: function (kol, alfa) { cel.blysk(kol, alfa); },
    klip: function (x, y, w, h, r) { cel.klip(x, y, w, h, r); },
    tlo: {
      zarejestruj: zarejestrujTlo,
      rysuj: function (id, dod) { return cel.tlo.rysuj(id, dod); },
      wylacz: function () { cel.tlo.wylacz(); },
      gotowy: G.tlo.gotowy
    }
  };
  // Podgląd: FX.podglad(cv, rysuj | {rysuj, cvTlo}) → osobna instancja na małym płótnie (okno „Scena”). Najwyżej 2 naraz
  // z WebGL2, kolejne rysują w trybie 2D. p.ramka(st, c2d) = p.klatka + rysuj(p, st) + p.rysuj (w try/finally).
  FX.podglad = function (cv, x) {
    var opcje = (x && typeof x === "object") ? x : {}, wywolanie = typeof x === "function" ? x : (typeof opcje.rysuj === "function" ? opcje.rysuj : null);
    // bez płótna: podgląd tylko w trybie 2D na c2d z klatka (nigdy instancja gry z płótnami w #gra)
    var inst = utworzSilnik(cv && typeof cv === "object" ? cv : {}, opcje), p = inst.api, klatkaP = p.klatka, rysujP = p.rysuj, zwolnijP = p.zwolnij;
    p.klatka = function (st, c2d) { klatkaP(st, c2d); if (!inst.S.zwolniony) cel = p; };
    p.rysuj = function () { if (cel === p) cel = G; rysujP(); };
    p.zwolnij = function () { if (cel === p) cel = G; zwolnijP(); };
    p.ramka = function (st, c2d) {
      p.klatka(st, c2d);
      try { if (wywolanie) wywolanie(p, st); }
      catch (e) { ostrzez("podglad|ramka", "wyjątek w rysowaniu podglądu", e && e.message); }
      finally { p.rysuj(); }
    };
    return p;
  };
  FX.KSZTALTY = KSZTALTY.slice();
  // Tylko do testów i smoke: konteksty i stan wewnętrzny.
  Object.defineProperty(FX, "_gl", { get: function () { var r = glowny.S.rFx; return r ? r.gl : null; } });
  Object.defineProperty(FX, "_glTlo", { get: function () { var r = glowny.S.rTlo; return r ? r.gl : null; } });
  FX._diag = glowny.diag;
  glob.FX = FX;
})();
