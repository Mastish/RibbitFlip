// efekty-tlo.js: tor „Tło” w progresji RibbitBeat. Jedenaście stopni sceny za kartami torów, od kraftu po czarną
// dziurę. Klasyczny skrypt z jednym globalem: EfektyTlo = {DRABINKA, reset}.
//
// Każdy stopień ma jedną cechę charakterystyczną (pole `cecha`) i nie przejmuje cech sąsiadów: stopnie NIE są
// kumulatywne (wyższy to inna scena, a nie niższy z dodatkową warstwą). Epoka daje tylko bazę: paletę, półmrok,
// funkcje wspólne. Wygląd stopnia wybiera jego id (klucz wyglądu), a nie numer w drabince, więc kolejność
// i numeracja drabinki mogą się zmieniać bez ruszania scen:
//   Pracownia (1):  kraft z CSS,
//   Scena (2–3):    teatralne kotary w ciepłym świetle; ciemny klub z kulą sypiącą plamkami światła,
//   Miasto (4–5):   panorama drapaczy z oknami; burza z ulewą i błyskawicami nad ciemnym horyzontem,
//   Natura (6–8):   liście i świetliki dżungli; morze z kaustykami; wulkan nad polem lawy,
//   Kosmos (9–11):  duże planety z pierścieniami; gwiazdy w smugach skoku; dysk i soczewka czarnej dziury.
// Stopnie 2–11 to programy GLSL na #glTlo: „#define ST_<ID>” + biblioteka wspólna + źródło epoki; preprocesor
// zostawia w programie tylko warstwy tego stopnia. Każdy ma też wariant 2D (rysuj2d) na wypadek braku WebGL2,
// ?gl=0 i grafiki uproszczonej (wtedy spokojny: te same sylwetki i ta sama cecha, bez ruchu, z buforów).
// Gra rysuje tło raz na układ (obraz statyczny), a karty zakrywają środek ekranu: cecha każdego stopnia musi być
// czytelna w jednej nieruchomej klatce i w ramie sceny (boczne kolumny i pasy wokół kart), także przy ogniu 0.
//
// Czytelność ma pierwszeństwo przed efektem: karta przepuszcza do 20 % tła, więc pod kartami scena jest
// o 35 % ciemniejsza, a drobne jasne wzory (gwiazdy, deszcz, okna) gasną tam do 25 %; nad kartami tylko
// prymitywy GPU z alfą ≤ 0,25 (nad papierem w blendzie normal, bo add bieleje).
// Ruch jest spokojny: rytm daje miękki puls ćwierćnuty (exp), żadne światło nie miga szybciej niż 2 Hz, a jedyny
// skok jasności (piorun) jest pojedynczy i gaśnie w ułamku sekundy.
const EfektyTlo=(function(){
  "use strict";
  const PI=Math.PI,TAU=2*PI;
  const ROZ="#ec1a83",LIM="#a6d861",ZIEL="#6cb33f",BURSZ="#eaa32b",ZOLTY="#ffd84a",NIEB="#294aa8",PAPIER="#faf6ee";
  const NEON="#4470ff";   // błękit marki rozjaśniony do światła neonu: sam #294aa8 na czerni nocnego miasta ginie
  const CHLOD="#9fb4ff";  // zimne światło burzy (chmury i błyskawice), bez różu miasta

  // ===================================================================================== drobiazgi
  const przytnij=(v,a,b)=>v<a?a:v>b?b:v;
  const gladko=t=>{t=przytnij(t,0,1);return t*t*(3-2*t);};
  const los=k=>{const v=Math.sin(k*12.9898+78.233)*43758.5453;return v-Math.floor(v);};   // 0..1, powtarzalne
  const szum1d=x=>{const i=Math.floor(x),f=x-i,u=f*f*(3-2*f);return los(i)*(1-u)+los(i+1)*u;};
  const ulamek=x=>x-Math.floor(x);
  const RGB=new Map();
  function rgb(hex){
    let v=RGB.get(hex);if(v)return v;
    const s=String(hex||"").replace("#",""),n=s.length===3?parseInt(s.split("").map(z=>z+z).join(""),16):parseInt(s.slice(0,6),16);
    v=Number.isFinite(n)?[(n>>16)&255,(n>>8)&255,n&255]:[236,26,131];
    RGB.set(hex,v);return v;
  }
  const rgbaS=(hex,a)=>{const v=rgb(hex);return "rgba("+v[0]+","+v[1]+","+v[2]+","+przytnij(+a||0,0,1).toFixed(3)+")";};
  function mieszajS(a,b,t,alfa){const x=rgb(a),y=rgb(b);t=przytnij(t,0,1);
    return "rgba("+Math.round(x[0]+(y[0]-x[0])*t)+","+Math.round(x[1]+(y[1]-x[1])*t)+","+Math.round(x[2]+(y[2]-x[2])*t)+","+przytnij(alfa,0,1).toFixed(3)+")";}
  const ogien=st=>przytnij((+st.zar||0)/3,0,1);
  const pulsB=st=>st.bezRuchu||st.spokoj?0:Math.exp(-ulamek(+st.faza||0)*4.5);
  // Błąd modułu poza hakami gry (rejestracja programu): jeden wpis konsoli na miejsce. Wyjątki w hakach łapie gra
  // (hakStopnia), a błąd kompilacji GLSL wypisuje silnik.
  const BLEDY=new Set();
  function bladRaz(klucz,opis,e){if(BLEDY.has(klucz))return;BLEDY.add(klucz);try{console.error("RibbitBeat: tło "+opis,e);}catch(x){/* brak konsoli */}}

  // ===================================================================================== stan modułu
  // Wspólny dla stopni (gra rysuje jeden stopień tła naraz). Zegary są własne: t płynie wolniej na finale, a droga
  // to ćwierćnuty przemnożone przez tempo ognia (ruch w rytmie piosenki bez skoków przy zmianie ognia). Oba się
  // zawijają, żeby float32 w shaderze nie tracił precyzji po godzinie grania.
  const M={st:null,dt:0,akum:0,kr:0,t:0,droga:0,final:0,otw:0,kombo:0,og:0,prog:0,nowe:0,imp:0,impT:9,impS:0,
    zd:99,zdS:0,zdP:[.5,.3,0],dd:0,piorun:null,czm:new Map(),fx:[],warp:[]};
  function krok(st,def){
    if(!st||st===M.st)return;
    M.st=st;
    const dt=przytnij(+st.dt||0,0,.1);M.dt=dt;
    // stały krok fizyki cząstek: liczba kroków 1/60 s w tej klatce (wspólna dla wszystkich list)
    M.akum=Math.min(.1,M.akum+dt);M.kr=0;while(M.akum>=1/60&&M.kr<6){M.akum-=1/60;M.kr++;}
    M.final+=((st.wyniki?1:0)-M.final)*(1-Math.exp(-dt/.9));
    const zw=st.bezRuchu?0:1-.6*M.final,o=ogien(st);
    M.t=(M.t+dt*zw)%1800;
    M.dd=dt*przytnij(+st.bpm||120,30,260)/60*(1+.5*o)*zw;M.droga=(M.droga+M.dd)%8192;
    const beat=+st.beat||0,k=Math.max(0,Math.floor(+st.kombo||0)),og=Math.floor(+st.og||0);
    // próg kombo: co 4 (impuls 0,6), co 12 (1,0); wzrost ognia też liczy się jako próg
    let prog=0;
    if(k>M.kombo){
      if(Math.floor(k/12)>Math.floor(M.kombo/12))prog=2;else if(Math.floor(k/4)>Math.floor(M.kombo/4))prog=1;
      M.nowe=k-M.kombo;
    }else M.nowe=0;
    if(!prog&&og>M.og)prog=1;
    M.kombo=k;M.og=og;M.prog=prog;
    if(prog){M.impS=prog===2?1:.6;M.impT=0;}
    M.impT+=dt;const f=Math.max(0,1-M.impT/.6);M.imp=st.bezRuchu||st.spokoj?0:M.impS*f*f;
    // kotary (stopień „kurtyna”): zasunięte przed odliczaniem, rozsuwają się w jego ostatnich taktach, na finale wracają
    const cel=st.wyniki?.3:gladko((beat+4)/3.5);
    M.otw+=(cel-M.otw)*(1-Math.exp(-dt/(st.wyniki?1.4:.35)));
    M.zd+=dt;
    if(def&&def.zdarzenia&&!st.spokoj&&!st.bezRuchu)def.zdarzenia(def,st,prog);
  }
  function reset(){
    // Gra woła przy każdym układzie (start piosenki, zmiana okna lub układu torów): px i bufory się zmieniają.
    // Kotara i zegary zostają, żeby zmiana rozmiaru okna nie zasuwała sceny.
    BUF.clear();M.czm.clear();M.fx.length=0;M.warp.length=0;M.st=null;M.akum=0;
    M.piorun=null;M.zd=99;M.imp=0;M.impT=9;
  }

  // ===================================================================================== GLSL: biblioteka wspólna
  // Ciało programu dla silnika (gl-fx.js dokłada prolog z uniformami u_*, szumem i sdKarty oraz main()). Nazwy
  // z prologu (hash21, hash22, szum, fbm, voronoi, obrot, gladko, pas, sdKarty, wKartach, PI, TAU) są tu tylko
  // używane, nigdy definiowane. Współrzędne: px w px CSS (y w dół), P = px / wysokość (y 0..1, x 0..asp),
  // pr = P × 720 (piksele odniesienia 720p, więc rozmiary drobin są te same w 1080p i w małym podglądzie).
  const GLSL_WSPOLNE=`
uniform float u_t;
uniform float u_droga;
uniform float u_bpm;
uniform float u_final;
uniform float u_otw;
uniform float u_zd;
uniform float u_zdS;
uniform vec3 u_zdP;
uniform vec3 u_kolorC;
uniform vec4 u_karty;
const vec3 K_ROZ = vec3(0.925, 0.102, 0.514);
const vec3 K_LIM = vec3(0.651, 0.847, 0.380);
const vec3 K_ZIEL = vec3(0.424, 0.702, 0.247);
const vec3 K_BURSZ = vec3(0.918, 0.639, 0.169);
const vec3 K_ZOLTY = vec3(1.000, 0.847, 0.290);
const vec3 K_NIEB = vec3(0.161, 0.290, 0.659);
const vec3 K_NEON = vec3(0.267, 0.439, 1.000);
const vec3 K_PAPIER = vec3(0.980, 0.965, 0.933);
// miękki puls ćwierćnuty (1 na uderzeniu, gaśnie w ułamku beatu) i ogień 0..1
float tlPuls(){ return exp(-u_faza * 4.5); }
float tlOg(){ return clamp(u_zar / 3.0, 0.0, 1.0); }
float tlWnetrze(float dk){ return 1.0 - smoothstep(-3.0, 3.0, dk); }
// obszar kart w jedn. wysokości ekranu: x lewy, y górny, z prawy, w dolny brzeg; poza nim jest rama sceny (boki,
// pas między HUD-em a kartami, pas nad widownią), w której scena jest widoczna w całości
vec4 tlKarty(){ return u_karty / u_rozdz.y; }
// poświata krawędzi kart: światło sceny wychodzące zza kart (tylko na zewnątrz, gaśnie z odległością)
float tlObrys(float dk, float zasieg){ return exp(-max(dk, 0.0) / zasieg) * smoothstep(-4.0, 0.5, dk); }
vec3 tlPaleta(float x){
  x = fract(x) * 4.0;
  if (x < 1.0) return mix(u_kolorA, u_kolorB, gladko(x));
  if (x < 2.0) return mix(u_kolorB, u_kolorC, gladko(x - 1.0));
  if (x < 3.0) return mix(u_kolorC, u_akcent, gladko(x - 2.0));
  return mix(u_akcent, u_kolorA, gladko(x - 3.0));
}
// wyjście: finał jaśniejszy i spokojniejszy, miękkie tonowanie (światła się nie przepalają), pod kartami o 35 %
// ciemniej (czytelność nut przy prześwicie), ditheringu tyle, żeby gradienty nie robiły pasów
vec4 tlKoniec(vec3 c, vec2 px, float k){
  c = max(c, vec3(0.0));
  c = mix(c, c * 1.3 + vec3(0.030, 0.026, 0.030), u_final * 0.85);
  c = vec3(1.0) - exp(-c * 1.3);
  c *= 1.0 - 0.35 * k;
  c += (hash21(floor(px * 0.5)) - 0.5) * (1.2 / 255.0);
  return vec4(c, 1.0);
}
`;

  // ===================================================================================== GLSL: Scena (kurtyna, dyskoteka)
  const GLSL_SALA=`
// tło: ciemna scena teatru, w głębi aksamitny horyzont w szerokich fałdach, na dole deski sceny (za widownią)
// ze spoinami zbiegającymi się w głąb
vec3 salaBaza(vec2 P, float asp){
  vec3 c = mix(vec3(0.058, 0.036, 0.038), vec3(0.140, 0.074, 0.062), smoothstep(0.05, 0.90, P.y));
  float fal = sin(P.x * 11.0 + 1.8 * sin(P.x * 1.7 + 0.4));
  c *= 0.74 + 0.40 * (0.5 + 0.5 * fal) * (0.45 + 0.55 * P.y);
  vec2 v = vec2((P.x / asp - 0.5) * 1.5, (P.y - 0.55) * 1.3);
  c *= 1.0 - 0.38 * dot(v, v);
  if (P.y > 0.895){
    float g = P.y - 0.90;
    float xs = (P.x - asp * 0.5) / (max(g, 0.0) + 0.06) * 0.9;
    float t = fract(xs);
    float spoina = 1.0 - smoothstep(0.0, 0.07, min(t, 1.0 - t));
    vec3 deski = vec3(0.17, 0.095, 0.055) * (0.78 + 0.22 * szum(vec2(xs * 3.0, g * 40.0))) * (1.0 - 0.45 * spoina);
    c = mix(c, deski, smoothstep(0.898, 0.906, P.y));
  }
  return c;
}
#ifdef ST_KURTYNA
// stożek światła zza lewego górnego rogu: maska kąta i spadek z odległością (przechodzi przez lewy górny róg ramy)
float salaStozek(vec2 P, float asp, float og){
  vec2 zr = vec2(-0.06 * asp, -0.16);
  vec2 os = normalize(vec2(0.62 * asp, 1.02) - zr);
  vec2 v = P - zr;
  float d = length(v);
  float c = dot(v, os) / max(d, 1e-4);
  float pol = 0.20 + 0.035 * og;
  return smoothstep(cos(pol * 1.35), cos(pol * 0.55), c) * exp(-d * 0.5);
}
// aksamitne kotary: fałdy gęstsze przy krawędzi ekranu (zebrany materiał), połysk na grzbietach, kołysanie,
// które próg kombo na chwilę rozbuja; otwarcie u_otw (0 zasunięte, 1 otwarte). Otwarta kotara wypełnia ok. 4/5
// bocznej kolumny ramy, więc między nią a kartą zostaje pas oświetlonej sceny.
vec3 salaKurtyny(vec3 c, vec2 P, float asp, float og, float sw, vec4 Kr){
  float xl = P.x;
  float xr = asp - P.x;
  float bliz = min(xl, xr);
  float otwarta = max(0.82 * min(Kr.x, asp - Kr.z), 0.06);
  float szer = mix(0.5 * asp + 0.03, otwarta, u_otw);
  float kol = (sin(u_t * 0.8 + P.y * 2.6) * 0.006 + u_impuls * 0.014 * sin(P.y * 7.0 - u_t * 6.0)) * (0.3 + P.y);
  float s = (bliz + kol) / szer;
  if (s >= 1.0) return c * (1.0 - 0.55 * exp(-(s - 1.0) * 9.0));
  float strona = xl < xr ? 0.0 : 7.0;
  float fz = s * 4.5 + 0.7 * sin(s * 2.0 + P.y * 1.3) + 0.9 * szum(vec2(s * 2.5 + strona, P.y * 1.2));
  float f = sin(fz * 6.2831853);
  float cien = 0.5 + 0.5 * f;
  float bl = pow(max(f, 0.0), 3.0);
  vec3 kv = mix(vec3(0.070, 0.006, 0.028), vec3(0.44, 0.036, 0.170), cien * cien) + vec3(0.95, 0.30, 0.50) * bl * 0.20;
  kv *= (0.55 + 0.55 * smoothstep(0.15, 1.0, P.y) + 0.6 * sw) * (1.0 + 0.35 * og);
  kv += vec3(0.9, 0.45, 0.25) * smoothstep(0.86, 1.0, s) * (0.10 + 0.25 * og);
  return mix(c, kv, 1.0 - smoothstep(0.985, 1.0, s));
}
// lambrekin: festony wiszą w pasie ramy między HUD-em a kartami; dolny brzeg ze złotą frędzlą kończy się tuż nad kartami
vec3 salaLambrekin(vec3 c, vec2 P, float asp, float og, float yK){
  float x = P.x / asp * 9.0 + 0.5;
  float fe = 1.0 - pow(abs(fract(x) - 0.5) * 2.0, 2.0);
  float dol = yK - 0.006 - 0.024 * (1.0 - fe);
  if (P.y > dol + 0.012) return c;
  float f = sin((dol - P.y) * 170.0 + fract(x) * 2.5);
  vec3 kv = mix(vec3(0.10, 0.010, 0.040), vec3(0.46, 0.042, 0.175), 0.5 + 0.5 * f) * (0.8 + 0.5 * og);
  kv += vec3(0.9, 0.30, 0.45) * pow(0.5 + 0.5 * f, 6.0) * 0.12;
  float fr = smoothstep(dol - 0.004, dol + 0.002, P.y);
  kv = mix(kv, K_ZOLTY * (0.6 + 0.45 * og) * (0.75 + 0.25 * sin(P.x * 650.0)), fr);
  return mix(c, kv, 1.0 - smoothstep(dol + 0.008, dol + 0.012, P.y));
}
#endif
#ifdef ST_DYSKOTEKA
// kula dyskotekowa wisi w pasie ramy nad środkiem kart; kropki światła w siatce kąt × log(promień) (rosną z
// odległością jak plamy na ścianach), obracają się z kulą, kolory przechodzą płynnie przez paletę w rytm. Plamki
// są duże i gęste, z jasnością bazową bez ognia, bo to jedyne światło klubu (widać je w bocznych kolumnach ramy).
vec2 salaKula(float asp, vec4 Kr){ return vec2(asp * 0.5, Kr.y - 0.022); }
vec3 salaDisko(vec2 P, vec2 B, float og, float puls){
  vec2 v = P - B;
  float r = length(v);
  float th = atan(v.x, v.y);
  vec2 q = vec2(th * 7.0 + u_t * (0.22 + 0.25 * og), log(max(r, 0.02)) * 6.5);
  vec2 id = floor(q);
  vec2 f = fract(q) - 0.5;
  float h = hash21(id + vec2(0.0, 11.0));
  float rr = 0.30 + 0.12 * h;
  float sp = (1.0 - smoothstep(rr * 0.55, rr, length(f))) * step(0.22, h);
  return tlPaleta(h + u_beat * 0.0625) * sp * (0.60 + 0.40 * puls + 0.35 * og) * smoothstep(0.06, 0.25, r);
}
// sama kula: lustrzane płytki (siatka szerokość × długość), każda błyska z rzadka (gładko, wolniej niż 2 Hz), linka
vec3 salaKulaRys(vec3 c, vec2 P, vec2 B, float og, float puls){
  float R = 0.022;
  vec2 d = (P - B) / R;
  float l = length(d);
  if (abs(P.x - B.x) < 0.0012 && P.y < B.y - R) c = mix(c, vec3(0.30, 0.28, 0.30), 0.7);
  if (l > 3.0) return c;
  if (l < 1.0){
    vec3 n = vec3(d, sqrt(1.0 - l * l));
    vec2 q = vec2((atan(n.x, n.z) + u_t * (0.6 + 0.6 * og)) * 6.0, asin(clamp(n.y, -1.0, 1.0)) * 6.0);
    vec2 f = fract(q);
    float h = hash21(floor(q));
    float pl = smoothstep(0.0, 0.14, f.x) * smoothstep(0.0, 0.14, f.y) * (1.0 - smoothstep(0.86, 1.0, f.x)) * (1.0 - smoothstep(0.86, 1.0, f.y));
    float bl = pow(0.5 + 0.5 * sin(u_t * (1.2 + h * 2.0) + h * 40.0), 12.0);
    vec3 kol = vec3(0.34, 0.32, 0.38) * (0.35 + 0.65 * n.z) * pl + tlPaleta(h + u_beat * 0.0625) * bl * pl * (1.2 + puls);
    return mix(c, kol, 1.0 - smoothstep(0.94, 1.0, l));
  }
  return c + vec3(1.0, 0.95, 0.88) * exp(-(l - 1.0) * 2.5) * 0.16 * (0.6 + 0.4 * puls);
}
#endif
vec4 tlo(vec2 uv, vec2 px){
  float asp = u_rozdz.x / u_rozdz.y;
  vec2 P = px / u_rozdz.y;
  vec4 Kr = tlKarty();
  float dk = sdKarty(px);
  float k = tlWnetrze(dk);
  float spok = 1.0 - 0.75 * k;
  float og = tlOg();
  float puls = tlPuls();
  vec3 c = salaBaza(P, asp);
#ifdef ST_KURTYNA
  float mg = fbm(P * vec2(2.4, 3.2) + vec2(-u_t * 0.022, u_t * 0.010), 2);
  vec3 kolS = mix(vec3(1.0, 0.80, 0.50), vec3(1.0, 0.68, 0.24), og);
  float sw = salaStozek(P, asp, og) * (0.35 + 0.95 * mg) * (0.62 + 0.30 * og + 0.10 * puls + 0.35 * u_impuls);
  c += kolS * sw;
  c = salaKurtyny(c, P, asp, og, sw, Kr);
  c = salaLambrekin(c, P, asp, og, Kr.y);
  c += kolS * tlObrys(dk, 22.0) * (0.06 + 0.25 * min(sw, 1.5) + 0.10 * og);
#endif
#ifdef ST_DYSKOTEKA
  // klub, nie teatr: ściany i deski przygaszone i chłodniejsze, bez stożka światła, żeby plamki były jedynym światłem
  c *= vec3(0.50, 0.42, 0.70);
  vec2 B = salaKula(asp, Kr);
  c += salaDisko(P, B, og, puls) * spok;
  c = salaKulaRys(c, P, B, og, puls);
  c += tlPaleta(P.x * 0.4 + u_beat * 0.0625) * tlObrys(dk, 22.0) * (0.10 + 0.12 * og + 0.06 * puls);
#endif
  return tlKoniec(c, px, k);
}
`;

  // ===================================================================================== GLSL: Miasto (miasto, burza)
  // Pion: niebo nad linią ulicy MI_UL, poniżej mokry asfalt, w którym odbija się górna scena (ta sama funkcja
  // próbkowana lustrzanie, z falowaniem kałuży). Miasto: panorama z oknami i wieżowce ramy. Burza: zimne niebo,
  // ciężkie chmury, dwie stałe błyskawice w bocznych kolumnach ramy (tło jest statyczne, więc piorun progu kombo
  // sam by w nim nie wystąpił), niska ciemna linia dachów bez świateł i ukośna ulewa.
  const GLSL_MIASTO=`
const float MI_UL = 0.865;
#ifdef ST_MIASTO
vec3 miastoNiebo(vec2 P){
  vec3 c = mix(vec3(0.016, 0.020, 0.064), vec3(0.115, 0.036, 0.125), smoothstep(0.0, MI_UL, P.y));
  return c + vec3(0.34, 0.08, 0.24) * exp(-max(MI_UL - P.y, 0.0) * 6.0) * 0.34;
}
// budynek warstwy w punkcie x (px): (wysokość nad ulicą w jedn. ekranu, x w budynku 0..1, id, jest 0..1);
// szer = szerokość budynku w px, baz = wysokość korpusu (bez uskoku i iglicy: tam nie ma okien)
vec4 miastoBud(float x, float w0, float hMin, float hMax, float ziarno, out float szer, out float baz){
  float cx = floor(x / w0);
  float h = hash21(vec2(cx, ziarno));
  float wys = hMin + (hMax - hMin) * h * h;
  if (hash21(vec2(cx, ziarno + 5.3)) > 0.86) wys = hMax * 1.2;
  baz = wys;
  float lx = fract(x / w0);
  float m = 0.05 + 0.10 * hash21(vec2(cx, ziarno + 9.1));
  szer = w0 * (1.0 - 2.0 * m);
  float lb = (lx - m) / (1.0 - 2.0 * m);
  float h2 = hash21(vec2(cx, ziarno + 17.0));
  float sr = abs(lb - 0.5);
  if (h2 > 0.45 && sr < 0.30) wys *= 1.09;
  if (h2 > 0.80 && sr < 0.035) wys *= 1.32;
  float jest = smoothstep(-0.03, 0.0, lb) * (1.0 - smoothstep(1.0, 1.03, lb));
  return vec4(wys, lb, cx, jest);
}
// okna: każde zmienia stan najwyżej co 4 ćwierćnuty, każde w innej chwili, więc miasto „oddycha” w rytm bez migania
float miastoOkna(vec2 lp, float szer, float wys, float id, float ziarno, float gest){
  if (lp.x < 3.0 || lp.x > szer - 3.0 || lp.y < 6.0 || lp.y > wys - 6.0) return 0.0;
  vec2 q = lp / vec2(7.0, 11.0);
  vec2 ci = floor(q);
  vec2 f = fract(q);
  float o = smoothstep(0.14, 0.28, f.x) * (1.0 - smoothstep(0.72, 0.86, f.x)) * smoothstep(0.18, 0.32, f.y) * (1.0 - smoothstep(0.68, 0.82, f.y));
  float h = hash21(ci + vec2(id * 13.1, ziarno));
  float zm = floor(u_beat * 0.25 + h * 8.0);
  return o * step(1.0 - gest, hash21(ci + vec2(zm * 1.37, id + ziarno))) * (0.5 + 0.5 * h);
}
// wieżowce ramy: po jednym w bocznych kolumnach ramy, najbliższy plan (nie przesuwają się). Korpus do 0,30 wys.,
// dwa uskoki korony, iglica do 0,13 z czerwonym światłem. q = px względem środka podstawy (y w górę od ulicy).
float miastoWiezaSyl(vec2 q, float sz){
  float yK = MI_UL * 720.0;
  float h0 = yK - 0.300 * 720.0;
  float h1 = yK - 0.255 * 720.0;
  float h2 = yK - 0.222 * 720.0;
  float h3 = yK - 0.130 * 720.0;
  float d = sdProstokat(q - vec2(0.0, h0 * 0.5), vec2(sz * 0.5, h0 * 0.5), 1.0);
  d = min(d, sdProstokat(q - vec2(0.0, (h0 + h1) * 0.5), vec2(sz * 0.375, (h1 - h0) * 0.5 + 0.5), 1.0));
  d = min(d, sdProstokat(q - vec2(0.0, (h1 + h2) * 0.5), vec2(sz * 0.25, (h2 - h1) * 0.5 + 0.5), 1.0));
  return min(d, sdProstokat(q - vec2(0.0, (h2 + h3) * 0.5), vec2(max(sz * 0.03, 1.2), (h3 - h2) * 0.5), 0.5));
}
// fasada podświetlona od ulicy, okna (zmiana stanu najwyżej co 4 ćwierćnuty), neon na krawędzi od strony kart
// (strona = +1: wieża lewa, krawędź prawa), przy ogniu obrys korony w kolorze partii, czerwone światło iglicy
vec3 miastoWieza(vec3 c, vec2 pr, float xs, float sz, float strona, float id, float og, float puls, bool odbicie){
  float yK = MI_UL * 720.0;
  vec2 q = vec2(pr.x - xs, yK - pr.y);
  if (q.y < -2.0 || abs(q.x) > sz * 0.5 + 30.0) return c;
  float h0 = yK - 0.300 * 720.0;
  float d = miastoWiezaSyl(q, sz);
  float w = 1.0 - smoothstep(-0.8, 0.8, d);
  vec3 kN = strona > 0.0 ? u_kolorA : u_kolorB;
  float xe = q.x * strona;
  // poświata neonu krawędzi na niebie obok wieży
  c += kN * exp(-abs(xe - sz * 0.5) * 0.12) * 0.16 * (1.0 - w) * step(q.y, h0) * step(0.0, q.y) * (0.7 + 0.3 * puls);
  vec3 kb = vec3(0.016, 0.014, 0.036) + vec3(0.14, 0.05, 0.12) * exp(-q.y * 0.010);
  if (!odbicie && q.y > 6.0 && q.y < h0 - 6.0 && abs(q.x) < sz * 0.5 - 3.0){
    vec2 g = (q + vec2(sz * 0.5, 0.0)) / vec2(6.0, 9.0);
    vec2 ci = floor(g);
    vec2 f = fract(g);
    float o = smoothstep(0.15, 0.30, f.x) * (1.0 - smoothstep(0.70, 0.85, f.x)) * smoothstep(0.20, 0.35, f.y) * (1.0 - smoothstep(0.65, 0.80, f.y));
    float h = hash21(ci + id * 7.0);
    float zap = step(0.45, hash21(ci + vec2(floor(u_beat * 0.25 + h * 8.0) * 1.37, id)));
    vec3 ko = h < 0.10 ? u_kolorA : (h < 0.18 ? u_kolorB : mix(K_ZOLTY, K_PAPIER, 0.3));
    kb += ko * o * zap * (0.55 + 0.45 * h) * 1.1;
  }
  kb += kN * exp(-pow(xe - (sz * 0.5 - 1.5), 2.0) * 0.5) * step(q.y, h0) * (0.7 + 0.3 * puls) * 1.2;
  c = mix(c, kb, w);
  c += u_akcent * exp(-d * d * 0.6) * step(h0 - 2.0, q.y) * smoothstep(0.15, 0.6, og) * (0.9 + 0.4 * puls);
  vec2 dl = q - vec2(0.0, yK - 0.13 * 720.0);
  c += vec3(1.0, 0.15, 0.2) * (exp(-dot(dl, dl) * 0.25) * 1.5 + exp(-length(dl) * 0.12) * 0.25) * (0.5 + 0.5 * sin(u_t * 3.0 + id));
  return c;
}
// górna scena w punkcie (pr): niebo, poświata neonów w powietrzu, dalsze budynki we mgle, bliższe budynki (fasady
// podświetlone od ulicy, krawędzie z neonowym rąbkiem, okna, neony dachów, iglice), wieżowce ramy. Dla odbicia
// w kałuży (odbicie = true) bez okien dalszej warstwy (taniej, i tak się rozmywa).
vec3 miastoGora(vec2 pr, float og, float puls, float spok, bool odbicie){
  vec2 P = pr / 720.0;
  vec3 c = miastoNiebo(P);
  c += mix(u_kolorA, u_kolorB, szum(P * vec2(1.4, 2.2) + vec2(u_t * 0.03, 0.0))) * 0.040 * (1.0 + og);
  float yUl = MI_UL * 720.0;
  float nad = yUl - pr.y;
  float szD, bazD;
  vec4 bd = miastoBud(pr.x + u_droga * 3.0, 44.0, 0.10, 0.36, 3.0, szD, bazD);
  float wd = bd.w * smoothstep(-1.0, 1.0, bd.x * 720.0 - nad) * step(0.0, nad);
  vec3 kd = mix(c, vec3(0.060, 0.045, 0.120), 0.78);
  if (!odbicie) kd += mix(K_ZOLTY, K_PAPIER, 0.4) * miastoOkna(vec2(bd.y * szD, nad), szD, bazD * 720.0, bd.z, 3.0, 0.38) * 0.32 * spok;
  c = mix(c, kd, wd);
  float szB, bazB;
  vec4 bb = miastoBud(pr.x + u_droga * 8.0, 78.0, 0.16, 0.58, 7.0, szB, bazB);
  float hb = bb.x * 720.0;
  float wb = bb.w * smoothstep(-1.0, 1.0, hb - nad) * step(0.0, nad);
  float hk = hash21(vec2(bb.z, 4.4));
  vec3 kOk = hk < 0.12 ? u_kolorA : (hk < 0.22 ? u_kolorB : mix(K_ZOLTY, K_PAPIER, 0.25 + 0.5 * hash21(vec2(bb.z, 6.6))));
  vec3 kb = vec3(0.014, 0.012, 0.034) + c * 0.08 + vec3(0.16, 0.05, 0.12) * exp(-nad * 0.012);
  float brzeg = exp(-bb.y * szB * 0.35) + exp(-(1.0 - bb.y) * szB * 0.35);
  kb += mix(u_kolorA, u_kolorB, step(0.5, hk)) * brzeg * 0.10;
  kb += kOk * miastoOkna(vec2(bb.y * szB, nad), szB, bazB * 720.0, bb.z, 7.0, 0.44 + 0.10 * og) * 1.05 * spok;
  c = mix(c, kb, wb);
  // neony na dachach: zapalają się z ogniem, w kolorach miasta i partii
  float naDachu = step(0.45, hash21(vec2(bb.z, 2.2))) * bb.w;
  float dy = nad - bazB * 720.0 - 7.0;
  float neonD = (exp(-dy * dy * 0.30) + exp(-abs(dy) * 0.14) * 0.40) * smoothstep(0.06, 0.16, bb.y) * (1.0 - smoothstep(0.84, 0.94, bb.y));
  vec3 kN = hash21(vec2(bb.z, 8.8)) < 0.5 ? u_akcent : u_kolorB;
  c += kN * neonD * naDachu * smoothstep(0.12, 0.6, og) * (0.85 + 0.4 * puls) * step(0.0, nad);
  // światło na szczycie iglicy: czerwone, oddycha (pół herca)
  vec2 dl = vec2((bb.y - 0.5) * szB, nad - hb - 3.0);
  c += vec3(1.0, 0.15, 0.2) * exp(-dot(dl, dl) * 0.12) * step(0.80, hash21(vec2(bb.z, 24.0))) * (0.5 + 0.5 * sin(u_t * 3.0 + bb.z)) * 1.4;
  // wieżowce ramy: w środku bocznych kolumn, szerokość ok. 4/5 kolumny
  vec4 Kr = tlKarty();
  float asp = u_rozdz.x / u_rozdz.y;
  float kl = Kr.x * 720.0;
  float kp = (asp - Kr.z) * 720.0;
  c = miastoWieza(c, pr, 0.5 * kl, 0.78 * kl, 1.0, 1.0, og, puls, odbicie);
  c = miastoWieza(c, pr, Kr.z * 720.0 + 0.5 * kp, 0.78 * kp, -1.0, 2.0, og, puls, odbicie);
  return c;
}
#endif
#ifdef ST_BURZA
// piorun: łamana z dwóch skal szumu od chmur do punktu zp.xy (x w jedn. wysokości, y = koniec), z jednym
// odgałęzieniem w stronę kier; z = jasność (stała dla błyskawic ramy, gasnąca dla pioruna progu kombo)
float burzaPiorun(vec2 P, vec3 zp, float z, float kier){
  if (z <= 0.0 || P.y > zp.y + 0.01) return 0.0;
  float x = zp.x + (szum(vec2(P.y * 9.0, zp.z)) - 0.5) * 0.10 + (szum(vec2(P.y * 34.0, zp.z + 4.0)) - 0.5) * 0.025;
  float d = abs(P.x - x) * 720.0;
  float y0 = zp.y * 0.45;
  float xg = x + kier * (P.y - y0) * 0.45 + (szum(vec2(P.y * 30.0, zp.z + 9.0)) - 0.5) * 0.02;
  float dg = abs(P.x - xg) * 720.0 + step(P.y, y0) * 1e3 + step(y0 + 0.16, P.y) * 1e3;
  return (exp(-d * d * 0.25) * 1.5 + exp(-d * 0.10) * 0.40 + exp(-dg * dg * 0.4) * 0.8 + exp(-dg * 0.2) * 0.15) * z * smoothstep(0.02, 0.10, P.y);
}
// ulewa: gęste ukośne krople (kąt z wiatrem), płyną w czasie rzeczywistym, nie w tempie
float burzaUlewa(vec2 pr, float og){
  vec2 q = vec2(pr.x + pr.y * (0.22 + 0.14 * og), pr.y);
  float cx = floor(q.x / 6.0);
  float h = hash21(vec2(cx, 2.2));
  float dx = abs(q.x - (cx + 0.5) * 6.0 + (h - 0.5) * 3.0);
  float y = q.y / 720.0 - u_t * (1.25 + 0.5 * h) - h * 13.0;
  float cy = floor(y / 0.09);
  float fy = fract(y / 0.09);
  float kr = smoothstep(0.0, 0.45, fy) * (1.0 - smoothstep(0.45, 0.5, fy)) * step(0.38, hash21(vec2(cx, cy)));
  return kr * exp(-dx * dx * 0.6);
}
vec3 miastoGora(vec2 pr, float og, float puls, float spok, bool odbicie){
  vec2 P = pr / 720.0;
  float asp = u_rozdz.x / u_rozdz.y;
  vec4 Kr = tlKarty();
  vec3 c = mix(vec3(0.018, 0.022, 0.044), vec3(0.075, 0.082, 0.125), smoothstep(0.0, MI_UL, P.y));
  // błyskawice ramy: bliższa w prawej kolumnie bije w ziemię, dalsza w lewej gaśnie nad dachami
  vec3 b1 = vec3(0.5 * (Kr.z + asp), MI_UL, 3.7);
  vec3 b2 = vec3(max(0.5 * Kr.x, 0.05), 0.60, 11.3);
  float zl = u_zd < 0.5 ? exp(-u_zd * 6.0) * u_zdS : 0.0;
  float bl = 0.30 * exp(-abs(P.x - b1.x) * 6.0) + 0.16 * exp(-abs(P.x - b2.x) * 8.0) + exp(-u_zd * 12.0) * u_zdS;
  // chmury (fbm 3 oktawy, wiatr rośnie z ogniem) schodzą nisko, od środka podświetlone błyskawicami
  float n = fbm(P * vec2(2.0, 3.4) + vec2(u_t * (0.012 + 0.02 * og), 0.0), 3);
  float gora = 1.0 - smoothstep(0.35, 0.80, P.y);
  float g = smoothstep(0.28, 0.66, n) * gora;
  vec3 kc = mix(vec3(0.030, 0.034, 0.060), vec3(0.15, 0.15, 0.22), smoothstep(0.45, 0.95, n));
  kc += vec3(0.70, 0.78, 1.0) * bl * (0.30 + 1.0 * n);
  c = mix(c, kc, g * 0.95) + vec3(0.55, 0.62, 0.9) * bl * 0.20 * gora;
  c += vec3(0.85, 0.90, 1.0) * (burzaPiorun(P, b1, 0.80, -1.0) + burzaPiorun(P, b2, 0.45, 1.0) + burzaPiorun(P, vec3(u_zdP.x * asp, u_zdP.y, u_zdP.z), zl, 1.0));
  // niska linia płaskich dachów bez jednego światła: horyzont, w który biją pioruny (zasłania koniec bliższego)
  float nad = MI_UL * 720.0 - pr.y;
  float h = (0.025 + 0.06 * pow(hash21(vec2(floor(pr.x / 34.0), 5.5)), 2.0)) * 720.0;
  return mix(c, vec3(0.010, 0.011, 0.020), smoothstep(-1.0, 1.0, h - nad) * step(0.0, nad));
}
#endif
vec4 tlo(vec2 uv, vec2 px){
  float asp = u_rozdz.x / u_rozdz.y;
  vec2 P = px / u_rozdz.y;
  vec2 pr = P * 720.0;
  float dk = sdKarty(px);
  float k = tlWnetrze(dk);
  float spok = 1.0 - 0.75 * k;
  float og = tlOg();
  float puls = tlPuls();
  float yUl = MI_UL * 720.0;
#ifdef ST_BURZA
  vec3 kKal = vec3(0.07, 0.09, 0.17);
#else
  vec3 kKal = vec3(0.22, 0.06, 0.17);
#endif
  vec3 c;
  if (pr.y <= yUl) c = miastoGora(pr, og, puls, spok, false);
  else {
    // kałuża: lustro względem linii ulicy, falowanie niskiej częstotliwości (bez zygzaków na pionowych światłach)
    float g = pr.y - yUl;
    float fal = sin(pr.y * 0.11 + u_t * 1.4) * 1.0 + sin(pr.y * 0.05 - u_t * 0.9 + pr.x * 0.01) * 1.6;
    vec3 odb = miastoGora(vec2(pr.x + fal, yUl - g * 1.25 - 2.0), og, puls, spok, true);
    c = vec3(0.012, 0.011, 0.026) + odb * (0.55 - 0.25 * smoothstep(0.0, 90.0, g));
    c += kKal * exp(-g * 0.05) * 0.16;
  }
#ifdef ST_BURZA
  c += vec3(0.50, 0.58, 0.80) * burzaUlewa(pr, og) * (0.30 + 0.12 * og) * spok;
#endif
  vec3 kr = mix(u_kolorA, u_kolorB, 0.5 + 0.5 * sin(P.y * 3.0 + u_t * 0.3));
  c += kr * tlObrys(dk, 18.0) * (0.10 + 0.12 * og + 0.10 * puls);
  return tlKoniec(c, px, k);
}
`;

  // ===================================================================================== GLSL: Natura (dżungla, ocean, wulkan)
  // Dżungla: księżyc, mgła, korony drzew w dwóch planach, staw na dole; liście bananowca obramowują ekran (to one
  // najczęściej widać w marginesach), a świetliki pulsują co dwie ćwierćnuty. Ocean: ten sam księżyc, ale zamiast
  // koron morze z horyzontem na 0,43 wysokości (fale z trzech sinusoid w perspektywie, ścieżka księżyca), na dole
  // płycizna z kaustykami; bez liści i świetlików. Wulkan: czerwone niebo w popiele, bez księżyca, stożek z lawą
  // w prawej kolumnie ramy i pole zastygłej lawy ze świecącymi szczelinami w perspektywie.
  const GLSL_NATURA=`
const float NA_HOR = 0.43;
#if defined(ST_DZUNGLA) || defined(ST_OCEAN)
// księżyc w lewej kolumnie ramy (jedn. wysokości ekranu), żeby był widoczny obok kart, a nie pod nimi
vec2 naturaKs(float asp){ vec4 Kr = tlKarty(); return vec2(max(0.5 * Kr.x, 0.05), 0.27); }
// niebo tropikalnej nocy: księżyc z poświatą i promieniami w mgle (szum po kącie, wolno się zmienia)
vec3 naturaNiebo(vec2 P, float asp){
  vec3 c = mix(vec3(0.014, 0.050, 0.046), vec3(0.050, 0.140, 0.112), smoothstep(0.0, 0.9, P.y));
  vec2 v = P - naturaKs(asp);
  float d = length(v);
  c += vec3(0.50, 0.74, 0.64) * exp(-d * 4.2) * 0.40;
  float pr = szum(vec2(atan(v.y, v.x) * 7.0, u_t * 0.04));
  c += vec3(0.45, 0.65, 0.58) * smoothstep(0.45, 0.95, pr) * exp(-d * 1.6) * 0.16 * smoothstep(0.04, 0.12, d);
  c += vec3(0.86, 0.95, 0.88) * (1.0 - smoothstep(0.034, 0.040, d));
  return c;
}
// linia koron drzew: najwyższy z trzech sąsiednich półokręgów (wysokość w jedn. ekranu nad bazą)
float naturaKorony(float x, float skala, float ziarno){
  float cx = floor(x / skala);
  float y = 0.0;
  for (int i = -1; i <= 1; i++){
    float cc = cx + float(i);
    float h = hash21(vec2(cc, ziarno));
    float xc = (cc + 0.5 + (h - 0.5) * 0.7) * skala;
    float r = skala * (0.6 + 0.55 * h);
    float dx = (x - xc) / r;
    if (abs(dx) < 1.0) y = max(y, r * sqrt(1.0 - dx * dx) * (0.75 + 0.5 * hash21(vec2(cc, ziarno + 2.0))));
  }
  return y;
}
#endif
#ifdef ST_DZUNGLA
const vec4 NA_LA[9] = vec4[9](
  vec4(-0.01, 0.12, 0.38, 0.44), vec4(-0.01, 0.52, -0.12, 0.36), vec4(0.00, 1.03, -0.95, 0.50),
  vec4(1.01, 0.22, 2.84, 0.42), vec4(1.01, 0.64, 3.34, 0.34), vec4(1.00, 1.03, 4.09, 0.52),
  vec4(0.30, -0.02, 1.25, 0.30), vec4(0.72, -0.02, 1.92, 0.28), vec4(0.56, 1.04, -1.70, 0.24));
const vec2 NA_LB[9] = vec2[9](
  vec2(0.075, 0.18), vec2(0.060, -0.10), vec2(0.085, 0.20),
  vec2(0.072, -0.18), vec2(0.058, 0.12), vec2(0.085, -0.20),
  vec2(0.055, 0.10), vec2(0.052, -0.12), vec2(0.045, 0.15));
// liść bananowca: oś od nasady b pod kątem kat, długość dl, szerokość sz, zgięcie zg; nacięcia od brzegu.
// Zwraca (maska, żyłki, brzeg).
vec3 naturaLisc(vec2 P, vec2 b, float kat, float dl, float sz, float zg){
  vec2 d = P - b;
  float cs = cos(kat);
  float sn = sin(kat);
  vec2 q = vec2(d.x * cs + d.y * sn, -d.x * sn + d.y * cs);
  float u = q.x / dl;
  if (u < 0.0 || u > 1.0) return vec3(0.0);
  float v = q.y - zg * dl * u * u;
  float w = sz * pow(sin(3.14159 * pow(u, 0.7)), 0.85) + 0.002;
  float av = abs(v);
  float m = 1.0 - smoothstep(w - 0.003, w + 0.002, av);
  float sc = smoothstep(0.93, 0.99, sin(u * 21.0 + av / sz * 2.2 + zg * 5.0)) * smoothstep(0.35, 0.75, av / w);
  m *= 1.0 - sc;
  float zy = (1.0 - smoothstep(0.0012, 0.0040, av)) + smoothstep(0.80, 1.0, sin((u * 30.0 - av / sz * 4.0) * 3.14159)) * 0.35;
  return vec3(m, zy * m, m * smoothstep(0.55, 1.0, av / w));
}
vec3 naturaLiscie(vec3 c, vec2 P, float asp, float og, vec3 swiatlo){
  for (int i = 0; i < 9; i++){
    vec4 a = NA_LA[i];
    vec2 b = NA_LB[i];
    float fi = float(i);
    float kat = a.z + 0.035 * sin(u_t * 0.55 + fi * 1.7) + 0.05 * og * sin(u_t * 1.7 + fi * 2.3);
    vec3 l = naturaLisc(P, vec2(a.x * asp, a.y), kat, a.w, b.x, b.y);
    if (l.x <= 0.0) continue;
    vec3 kl = mix(vec3(0.012, 0.042, 0.020), vec3(0.050, 0.130, 0.060), 0.30 + 0.70 * l.y);
    kl += swiatlo * l.z * 0.26;
    c = mix(c, kl, l.x);
  }
  return c;
}
// świetliki w tle: pulsują co dwie ćwierćnuty (każdy w swojej fazie), przy ogniu gęściej
float naturaSwietlik(vec2 pr, float skala, float ziarno, float gest){
  vec2 q = pr / skala + vec2(sin(u_t * 0.13 + ziarno) * 0.8, -u_t * 0.035) + ziarno * 9.0;
  vec2 id = floor(q);
  vec2 f = fract(q) - 0.5;
  vec2 h = hash22(id + ziarno * 3.0);
  if (h.x > gest) return 0.0;
  vec2 o = (h - 0.5) * 0.5 + 0.2 * vec2(sin(u_t * 0.7 + h.y * 9.0), cos(u_t * 0.55 + h.x * 7.0));
  float d = length(f - o) * skala;
  float mig = 0.25 + 0.75 * pow(0.5 + 0.5 * sin(u_beat * 3.14159 + h.y * 6.28), 3.0);
  return (exp(-d * d * 0.16) * 1.3 + exp(-d * 0.22) * 0.30) * mig;
}
#endif
#ifdef ST_OCEAN
// morze w perspektywie: trzy sinusoidy w czasie, przy horyzoncie wygaszone (inaczej aliasing), ścieżka księżyca
// z iskrzeniem na grzbietach fal, grzywy przy brzegu
vec3 naturaMorze(vec2 P, float asp, float og, vec3 niebo){
  float g = max(P.y - NA_HOR, 0.0015);
  float z = 0.05 / g;
  vec2 w = vec2((P.x - asp * 0.5) * z, z);
  float t = u_t * (1.0 + 0.5 * og);
  float h = 0.5 * sin(dot(w, vec2(1.1, 2.3)) + t * 0.9) + 0.3 * sin(dot(w, vec2(-2.4, 3.1)) + t * 1.3) + 0.18 * sin(dot(w, vec2(3.7, 5.9)) + t * 2.1);
  float blisko = smoothstep(0.0, 0.06, g);
  vec3 woda = mix(vec3(0.030, 0.120, 0.140), vec3(0.010, 0.045, 0.065), smoothstep(0.0, 0.45, g));
  woda += niebo * 0.40 * exp(-g * 8.0);
  woda *= 0.80 + 0.40 * h * blisko;
  float kol = exp(-abs(P.x - naturaKs(asp).x) * (3.0 + 2.5 / (g + 0.05)));
  woda += vec3(0.80, 0.94, 0.86) * pow(max(h, 0.0), 4.0) * kol * blisko * 2.2;
  woda += vec3(0.30, 0.45, 0.42) * smoothstep(0.55, 0.95, h) * smoothstep(0.25, 0.5, g) * 0.25;
  return woda;
}
// kaustyki płycizny: dwie warstwy Voronoi (jasne brzegi komórek), dryfują w różne strony
float naturaKaustyki(vec2 pr){
  vec2 q = pr * 0.020 + vec2(u_t * 0.15, u_t * 0.09);
  float a = voronoi(q).x;
  float b = voronoi(q * 1.7 + vec2(3.1, -u_t * 0.2)).x;
  return pow(a, 2.5) * 1.3 + pow(b, 3.0) * 0.6;
}
#endif
#ifdef ST_WULKAN
// krater w prawej kolumnie ramy: stożek schodzi pod karty, a krater, dym i erupcja są widoczne w ramie
float naturaWx(float asp){ vec4 Kr = tlKarty(); return min(0.5 * (Kr.z + asp), asp - 0.05); }
const float NA_WH = 0.25;
// niebo w popiele: od ciemnego brązu do czerwonej łuny nad horyzontem, smugi popiołu (fbm 2 oktawy)
vec3 wulkanNiebo(vec2 P){
  vec3 c = mix(vec3(0.030, 0.012, 0.014), vec3(0.20, 0.055, 0.030), smoothstep(0.0, NA_HOR, P.y));
  float n = fbm(P * vec2(2.2, 4.0) + vec2(u_t * 0.010, 0.0), 2);
  c = mix(c, vec3(0.055, 0.030, 0.028), smoothstep(0.45, 0.80, n) * 0.70 * (1.0 - smoothstep(0.25, NA_HOR, P.y)));
  return c + vec3(0.90, 0.30, 0.08) * exp(-max(NA_HOR - P.y, 0.0) * 9.0) * 0.35;
}
// pole zastygłej lawy w perspektywie: bazalt w płytach (Voronoi), w szczelinach między płytami płynna lawa, przez
// którą co ćwierćnutę przechodzi jaśniejsza fala; przy horyzoncie płyty giną w czerwonym dymie
vec3 wulkanPole(vec2 P, float asp, float og, float puls){
  float g = max(P.y - NA_HOR, 0.0015);
  float z = 0.05 / g;
  vec2 v = voronoi(vec2((P.x - asp * 0.5) * z, z) * 1.4);
  float blisko = smoothstep(0.0, 0.08, g);
  float sz = smoothstep(0.32, 0.56, v.x) * blisko;
  float fala = 0.65 + 0.35 * sin(z * 2.0 - u_droga * 1.5707963 + v.y * 6.2831853);
  vec3 c = vec3(0.034, 0.020, 0.018) * (0.7 + 0.6 * fract(v.y * 7.13));
  c += mix(K_BURSZ, K_ZOLTY, sz * sz) * sz * (0.50 + 0.25 * puls + 0.35 * og) * fala * 1.3;
  c += vec3(0.30, 0.07, 0.02) * smoothstep(0.15, 0.45, v.x) * blisko * 0.35;
  return mix(c, vec3(0.30, 0.09, 0.04), exp(-g * 25.0) * 0.7);
}
// wulkan: stożek na horyzoncie, z krateru spływa pięć strug lawy (pulsują w rytm: jasna fala płynie w dół co
// ćwierćnutę), na lawie ciemna skorupa (fbm 2 oktawy), nad kraterem łuna i smuga dymu podświetlona od spodu;
// erupcja (u_zd = sekundy od progu kombo) rozpala krater i niebo
vec3 naturaWulkan(vec3 c, vec2 P, float asp, float og, float puls, out float zar){
  float xc = naturaWx(asp);
  float dx = abs(P.x - xc) / 0.42;
  float szczyt = NA_HOR - NA_WH * 0.86;
  float top = max(NA_HOR - NA_WH * pow(max(1.0 - dx, 0.0), 1.25), szczyt);
  float erup = exp(-u_zd * 1.2) * u_zdS;
  float dkr = length((P - vec2(xc, szczyt)) * vec2(1.0, 1.6));
  zar = exp(-dkr * 9.0) * (0.60 + 0.45 * puls + 0.4 * og) + erup * exp(-dkr * 4.0) * 1.5;
  if (dx < 1.0 && P.y > top && P.y < NA_HOR + 0.002){
    float d = P.y - szczyt;
    float a = (P.x - xc) / (d + 0.015);
    float rz = 0.0, posw = 0.0;
    for (int i = 0; i < 5; i++){
      float fi = float(i);
      float ak = -1.35 + 0.68 * fi + 0.16 * sin(fi * 3.1);
      float aw = a + 0.22 * sin(d * 36.0 + fi * 2.0 + u_t * 0.25) * smoothstep(0.0, 0.08, d);
      float sz = (0.004 + 0.007 * (1.0 - d / NA_WH)) / (d + 0.015);
      float dl = 0.10 + 0.14 * fract(sin(fi * 12.9) * 43.7);
      float e = (aw - ak) / sz;
      float konc = 1.0 - smoothstep(dl - 0.04, dl, d);
      rz = max(rz, exp(-e * e) * konc);
      posw = max(posw, exp(-e * e * 0.06) * konc);
    }
    float fala = 0.55 + 0.45 * sin(d * 70.0 - u_droga * 6.2831853 * 0.5);
    float skora = smoothstep(0.35, 0.75, fbm(vec2(P.x * 14.0, P.y * 9.0) + vec2(0.0, -u_t * 0.06), 2));
    vec3 lawa = mix(K_BURSZ, K_ZOLTY, rz * rz) * rz * (1.0 - 0.55 * skora) * (0.55 + 0.45 * fala * (0.6 + 0.4 * puls) + 0.35 * og + 0.6 * erup);
    vec3 skala = vec3(0.026, 0.018, 0.020) + vec3(0.30, 0.07, 0.03) * posw * (0.5 + 0.3 * og);
    return skala + lawa * 1.6 + vec3(0.6, 0.18, 0.05) * exp(-(P.y - top) * 22.0) * 0.30 + vec3(1.0, 0.6, 0.2) * exp(-dkr * 22.0) * 0.8;
  }
  if (P.y < top){
    float n = fbm(vec2((P.x - xc) * 3.0, P.y * 2.0 + u_t * 0.05) + vec2(u_t * 0.02, 0.0), 2);
    float wys = szczyt - P.y;
    float smuga = exp(-abs(P.x - xc - wys * 0.4) * 6.0) * smoothstep(-0.03, 0.03, wys) * (1.0 - smoothstep(0.0, 0.35, wys));
    c = mix(c, vec3(0.07, 0.04, 0.04) + vec3(0.6, 0.20, 0.06) * zar * 0.6, smuga * smoothstep(0.35, 0.7, n) * 0.85);
    c += vec3(1.0, 0.45, 0.12) * zar * 0.38;
  }
  return c;
}
// żarzące drobiny unoszące się znad krateru
float naturaZar(vec2 pr, float gest){
  vec2 q = pr / 26.0 + vec2(sin(u_t * 0.3) * 0.5, u_t * 0.55);
  vec2 id = floor(q);
  vec2 f = fract(q) - 0.5;
  vec2 h = hash22(id + 7.7);
  if (h.x > gest) return 0.0;
  float d = length(f - (h - 0.5) * 0.6) * 26.0;
  return exp(-d * d * 0.30) * (0.5 + 0.5 * sin(u_t * 1.3 + h.y * 20.0));
}
#endif
vec4 tlo(vec2 uv, vec2 px){
  float asp = u_rozdz.x / u_rozdz.y;
  vec2 P = px / u_rozdz.y;
  vec2 pr = P * 720.0;
  float dk = sdKarty(px);
  float k = tlWnetrze(dk);
  float spok = 1.0 - 0.75 * k;
  float og = tlOg();
  float puls = tlPuls();
  vec3 c;
  vec3 kr = K_LIM;
#ifdef ST_DZUNGLA
  vec3 kSw = mix(K_LIM, K_ZOLTY, 0.35);
  c = naturaNiebo(P, asp);
  float mg = fbm(P * vec2(1.6, 4.0) + vec2(u_t * 0.012, 0.0), 2);
  c += vec3(0.32, 0.46, 0.42) * smoothstep(0.40, 0.85, mg) * 0.26;
  // dalsze korony (jasne od mgły) i bliższe (ciemne), pod nimi gęstwina
  float k1 = 0.60 - naturaKorony(P.x + u_t * 0.002, 0.07, 1.0);
  c = mix(c, vec3(0.040, 0.100, 0.082) + vec3(0.25, 0.35, 0.33) * mg * 0.15, smoothstep(k1 - 0.003, k1 + 0.003, P.y));
  float k2 = 0.74 - naturaKorony(P.x + u_t * 0.004, 0.11, 2.0);
  c = mix(c, vec3(0.010, 0.034, 0.022), smoothstep(k2 - 0.003, k2 + 0.003, P.y));
  c += kSw * (naturaSwietlik(pr, 46.0, 1.0, 0.30 + 0.35 * og) * 0.7 + naturaSwietlik(pr, 74.0, 2.0, 0.26 + 0.3 * og)) * spok;
  // staw na dole: ciemna woda z odbiciem nieba i świetlików, zmarszczki
  if (P.y > 0.90){
    float g = P.y - 0.90;
    float fal = sin(P.y * 300.0 + u_t * 1.6) * 0.004;
    vec2 Pm = vec2(P.x + fal, 0.90 - g * 2.0);
    vec3 odb = naturaNiebo(Pm, asp) * 0.40 + kSw * naturaSwietlik(Pm * 720.0, 46.0, 1.0, 0.30 + 0.35 * og) * 0.40;
    c = mix(vec3(0.006, 0.022, 0.020) + odb, c, 0.12);
  }
  c = naturaLiscie(c, P, asp, og, vec3(0.50, 0.80, 0.60));
#endif
#ifdef ST_OCEAN
  vec3 niebo = naturaNiebo(P, asp);
  c = niebo;
  if (P.y > NA_HOR) {
    c = naturaMorze(P, asp, og, niebo);
    float ple = smoothstep(0.80, 0.95, P.y);
    float kw = max(ple, k * 0.6);
    if (kw > 0.01) c += vec3(0.30, 0.68, 0.62) * naturaKaustyki(pr) * kw * (0.14 + 0.08 * og) * (1.0 - 0.6 * k);
    // przypływ przy ogniu: pas piany wędruje w górę i z powrotem
    float yp = 0.905 - 0.045 * og * (0.5 + 0.5 * sin(u_t * 0.8)) + 0.006 * sin(P.x * 22.0 + u_t * 2.0);
    float pn = (1.0 - smoothstep(0.0, 0.010, abs(P.y - yp))) * (0.4 + 0.6 * szum(vec2(P.x * 40.0, u_t * 0.8)));
    c += vec3(0.75, 0.90, 0.86) * pn * (0.10 + 0.50 * og) * spok;
  } else {
    float mg = fbm(P * vec2(1.6, 4.0) + vec2(u_t * 0.012, 0.0), 2);
    c += vec3(0.32, 0.46, 0.42) * smoothstep(0.40, 0.85, mg) * 0.24;
    // wyspa na horyzoncie po lewej
    float wy = naturaKorony(P.x, 0.05, 4.0) * 0.55 * (1.0 - smoothstep(0.30 * asp, 0.48 * asp, P.x));
    c = mix(c, vec3(0.016, 0.046, 0.034), smoothstep(NA_HOR - wy - 0.004, NA_HOR - wy, P.y));
  }
#endif
#ifdef ST_WULKAN
  c = wulkanNiebo(P);
  if (P.y > NA_HOR) c = wulkanPole(P, asp, og, puls);
  float zar = 0.0;
  c = naturaWulkan(c, P, asp, og, puls, zar);
  if (P.y > NA_HOR) c += vec3(1.0, 0.45, 0.12) * zar * 0.7 * exp(-abs(P.x - naturaWx(asp)) * 6.0) * exp(-(P.y - NA_HOR) * 3.0) * (0.6 + 0.4 * sin(P.y * 260.0 - u_t * 3.0));
  c += vec3(1.0, 0.55, 0.15) * naturaZar(pr, 0.35 + 0.35 * og) * exp(-abs(P.x - naturaWx(asp)) * 2.2) * (1.0 - smoothstep(0.05, 0.55, P.y)) * spok;
  kr = mix(K_BURSZ, vec3(1.0, 0.55, 0.18), clamp(zar, 0.0, 1.0) * 0.7);
#endif
  c += kr * tlObrys(dk, 18.0) * (0.08 + 0.10 * og + 0.08 * puls);
  return tlKoniec(c, px, k);
}
`;

  // ===================================================================================== GLSL: Kosmos (planety, nadświetlna, dziura)
  // Wspólna baza: granatowa noc i gwiazdy w trzech planach. Planety: duże tarcze z pierścieniami w obu kolumnach
  // ramy (wychodzą zza kart), trzecia przepływa za kartami. Nadświetlna: gwiazdy przygaszone, zamiast nich smugi
  // zbiegające się do środka i niebieski tunel na brzegach (smugi są też bez ognia, bo tło jest statyczne).
  // Dziura: cała scena próbkowana w soczewce (zniekształca się tylko tło, karty nie), szeroki rozżarzony dysk
  // przecina ramę po bokach, nad nim horyzont zdarzeń, pierścień fotonowy i spirale wciągane do środka.
  const GLSL_KOSMOS=`
const float KO_RS = 0.10;
vec3 kosmosBaza(vec2 P){
  return mix(vec3(0.006, 0.008, 0.030), vec3(0.022, 0.012, 0.052), smoothstep(0.0, 1.0, P.y));
}
// jedna warstwa gwiazd: przesuw w lewo z tempem (paralaksa: bliższe szybciej), mruganie wolniejsze niż 1 Hz
vec3 kosmosGwiazdy(vec2 pr, float skala, float pred, float ziarno, float jas){
  vec2 q = pr / skala + vec2(u_droga * pred, 0.0) + ziarno * 13.0;
  vec2 id = floor(q);
  vec2 f = fract(q) - 0.5;
  vec2 h = hash22(id + ziarno * 7.0);
  float d = length(f - (h - 0.5) * 0.7) * skala;
  float r = 0.9 + 1.4 * h.y * h.y;
  float mig = 0.65 + 0.35 * sin(u_t * (0.8 + 1.6 * h.x) + h.y * 40.0);
  float b = exp(-d * d / (r * r)) * mig * step(0.28, h.x);
  b += exp(-d * 0.35) * 0.06 * step(0.93, h.y);
  return mix(vec3(0.72, 0.80, 1.0), vec3(1.0, 0.90, 0.72), h.x) * b * jas;
}
#ifdef ST_PLANETY
// planeta: kula oświetlona z lewej góry, pasy szerokości, atmosfera na brzegu; pierścień rysowany w dwóch połowach
// (tylna pod tarczą, przednia nad nią). swiec: planeta lidera świeci przy ogniu kolorem partii.
vec3 kosmosPlaneta(vec3 c, vec2 P, vec2 S, float r, float h, vec3 k1, vec3 k2, float swiec){
  vec2 d = (P - S) / r;
  float l2 = dot(d, d);
  if (l2 > 9.0) return c;
  float pier = step(0.45, h);
  float nach = 0.30 + 0.20 * h;
  vec2 dr = obrot(0.35 - 0.6 * h) * d;
  float rr = length(vec2(dr.x, dr.y / nach));
  float ring = smoothstep(1.32, 1.40, rr) * (1.0 - smoothstep(2.0, 2.15, rr)) * pier;
  vec3 kp = mix(k1, k2, 0.4) * (0.55 + 0.35 * sin(rr * 38.0)) * 0.75;
  if (dr.y < 0.0) c = mix(c, kp, ring * 0.8);
  vec3 ks = mix(k2, u_akcent, swiec);
  if (l2 < 1.0){
    vec3 n = vec3(d, sqrt(1.0 - l2));
    float dif = max(dot(n, normalize(vec3(-0.6, -0.5, 0.62))), 0.0);
    float lat = d.y * 2.6 + (szum(vec2(d.y * 5.0 + h * 9.0, d.x * 1.2 + u_t * 0.01)) - 0.5) * 0.8;
    vec3 pw = mix(k1, k2, 0.5 + 0.35 * sin(lat * 3.2 + h * 6.0));
    vec3 kol = pw * (0.03 + 1.15 * pow(dif, 0.8));
    kol += ks * pow(1.0 - n.z, 2.5) * (0.45 + 1.6 * swiec);
    c = mix(c, kol, 1.0 - smoothstep(0.97, 1.0, sqrt(l2)));
  } else {
    c += ks * exp(-(sqrt(l2) - 1.0) * 9.0) * (0.22 + 0.9 * swiec);
  }
  if (dr.y >= 0.0) c = mix(c, kp, ring * 0.9);
  return c;
}
// jedna planeta przepływa za kartami z prawej w lewo (jak nuty), dwie duże wiszą w bocznych kolumnach ramy na
// różnych wysokościach: tarcza ok. 1,2 szerokości kolumny, więc planeta wychodzi zza kart i z pierścieniem
// przecina ramę (lewa to planeta lidera: przy ogniu świeci kolorem partii); każda ma księżyc
vec3 kosmosPlanety(vec3 c, vec2 P, float asp, float og){
  vec4 Kr = tlKarty();
  float faza = u_droga * 0.0045;
  float cyk = floor(faza);
  float h = hash21(vec2(cyk, 3.7));
  float r = 0.07 + 0.10 * h;
  vec2 S = vec2(mix(asp + r * 2.6, -r * 2.6, fract(faza)), 0.16 + 0.68 * hash21(vec2(cyk + 2.0, 1.0)));
  c = kosmosPlaneta(c, P, S, r, h, mix(tlPaleta(h * 3.1), vec3(0.42, 0.40, 0.38), 0.30) * 0.80, mix(tlPaleta(h * 3.1 + 0.33), vec3(0.50, 0.48, 0.46), 0.20), 0.0);
  for (int i = 0; i < 2; i++){
    float fi = float(i);
    float kol = i == 0 ? Kr.x : asp - Kr.z;
    float rr = min(0.62 * max(kol, 0.06), 0.15);
    vec2 Sp = vec2(i == 0 ? 0.5 * Kr.x : 0.5 * (Kr.z + asp), (i == 0 ? 0.36 : 0.62) + 0.06 * sin(u_t * 0.012 + fi * 2.4));
    float hh = i == 0 ? 0.72 : 0.55;
    vec3 k1 = mix(tlPaleta(hh * 3.1), vec3(0.42, 0.40, 0.38), 0.20) * 0.85;
    vec3 k2 = mix(tlPaleta(hh * 3.1 + 0.33), vec3(0.50, 0.48, 0.46), 0.15);
    float a = u_t * 0.25 + fi * 3.0;
    vec2 Sk = Sp + vec2(cos(a), sin(a) * 0.35) * rr * 2.3;
    if (sin(a) < 0.0) c = kosmosPlaneta(c, P, Sk, rr * 0.24, 0.1, k2, k1, 0.0);
    c = kosmosPlaneta(c, P, Sp, rr, hh, k1, k2, i == 0 ? og : 0.0);
    if (sin(a) >= 0.0) c = kosmosPlaneta(c, P, Sk, rr * 0.24, 0.1, k2, k1, 0.0);
  }
  return c;
}
#endif
#ifdef ST_NADSWIETLNA
// skok nadświetlny: gwiazdy w siatce kąt × log(promień) uciekają od środka jako długie smugi z jasnym czołem;
// długość i prędkość rosną z ogniem, ale już bez ognia to smugi, a nie punkty
vec3 kosmosWarp(vec2 C, float og){
  float r = length(C);
  float ka = atan(C.y, C.x) * 120.0 / 6.2831853;
  float ia = floor(ka);
  float h = hash21(vec2(ia, 3.3));
  float da = (fract(ka) - 0.5 - (h - 0.5) * 0.5) * (6.2831853 / 120.0) * r * 720.0;
  float v = log(r + 0.02) * 1.6 - u_droga * (0.10 + 0.30 * og) + h * 5.0;
  float cy = floor(v);
  float f = fract(v);
  float dl = 0.35 + 0.30 * og;
  float sm = smoothstep(0.0, dl, f) * (1.0 - smoothstep(dl, dl + 0.02, f)) * step(0.40, hash21(vec2(ia, cy)));
  vec3 kol = mix(vec3(0.70, 0.80, 1.0), mix(u_akcent, K_PAPIER, 0.4), h * 0.5);
  return kol * sm * exp(-da * da * 0.35) * smoothstep(0.03, 0.25, r) * (0.9 + 0.6 * og);
}
#endif
#ifdef ST_DZIURA
// soczewkowanie: obraz tła przesunięty od środka (źródło bliżej dziury niż obraz), tylko dla tła
vec2 kosmosSoczewka(vec2 C){
  float r = max(length(C), 1e-4);
  return C - C / r * (KO_RS * KO_RS * 1.5 / max(r, KO_RS * 0.6));
}
// dysk akrecyjny widziany pod kątem: wzór obraca się w rytm, lewa strona jaśniejsza (zbliża się do nas); sięga
// 16 promieni horyzontu, więc jego rozżarzone skrzydła przecinają obie boczne kolumny ramy
vec3 kosmosDysk(vec2 C, float og, float puls){
  vec2 d = vec2(C.x, C.y / 0.22);
  float r = length(d) / KO_RS;
  if (r < 1.4 || r > 16.0) return vec3(0.0);
  float a = atan(d.y, d.x) - u_droga * 0.35;
  float n = szum(vec2(cos(a), sin(a)) * 2.5 + vec2(r * 1.3, 0.0));
  float pasy = 0.70 + 0.30 * sin(r * 4.0 - u_droga * 0.8 + n * 4.0);
  float jas = smoothstep(1.4, 1.8, r) * (1.0 - smoothstep(10.0, 16.0, r)) * pow(1.8 / r, 0.4) * (0.5 + 0.8 * n) * pasy;
  jas *= 1.0 + 0.7 * (-C.x / (length(C) + 1e-4));
  vec3 kol = mix(K_ZOLTY * 1.2 + vec3(0.2), mix(K_BURSZ, K_ROZ, smoothstep(2.5, 7.0, r)), smoothstep(1.5, 3.5, r));
  return kol * jas * (0.8 + 0.4 * puls + 0.5 * og);
}
#endif
vec3 kosmosScena(vec2 P, vec2 C, vec2 pr, float asp, float og, float puls, float spok){
  vec3 c = kosmosBaza(P);
  vec3 gw = kosmosGwiazdy(pr, 22.0, 0.010, 1.0, 0.55) + kosmosGwiazdy(pr, 38.0, 0.025, 2.0, 0.85) + kosmosGwiazdy(pr, 64.0, 0.05, 3.0, 1.15);
#ifdef ST_NADSWIETLNA
  float r = length(C);
  c += vec3(0.10, 0.16, 0.45) * smoothstep(0.25, 1.0, r) * 0.55 + vec3(0.55, 0.65, 1.0) * exp(-r * 5.0) * 0.25;
  c += gw * 0.30 * spok;
  c += kosmosWarp(C, og) * spok;
#else
  c += gw * spok;
#endif
#ifdef ST_PLANETY
  c = kosmosPlanety(c, P, asp, og);
#endif
  return c;
}
vec4 tlo(vec2 uv, vec2 px){
  float asp = u_rozdz.x / u_rozdz.y;
  vec2 P = px / u_rozdz.y;
  vec2 C = P - vec2(asp * 0.5, 0.5);
  float dk = sdKarty(px);
  float k = tlWnetrze(dk);
  float spok = 1.0 - 0.75 * k;
  float og = tlOg();
  float puls = tlPuls();
  vec3 c;
#ifdef ST_DZIURA
  vec2 Cs = kosmosSoczewka(C);
  vec2 Ps = Cs + vec2(asp * 0.5, 0.5);
  c = kosmosScena(Ps, Cs, Ps * 720.0, asp, og, puls, spok);
  float r = length(C);
  c += mix(K_BURSZ, K_ROZ, 0.4) * exp(-r * 2.2) * 0.18;
  vec3 dysk = kosmosDysk(C, og, puls);
  if (C.y < 0.0) c += dysk;
  c *= smoothstep(KO_RS * 0.95, KO_RS * 1.05, r);
  float rn = r / KO_RS;
  float gora = -C.y / (r + 1e-4);
  float luk = smoothstep(1.15, 1.35, rn) * exp(-(rn - 1.3) * 0.55) * (0.20 + 0.80 * smoothstep(-0.2, 0.95, gora)) * 1.3;
  luk *= 0.75 + 0.25 * szum(vec2(atan(C.y, C.x) * 3.0 - u_droga * 0.35, rn * 1.5));
  c += mix(mix(K_ZOLTY, K_ROZ, 0.35), K_ROZ, smoothstep(1.4, 3.6, rn)) * luk * (0.75 + 0.3 * puls + 0.3 * og);
  c += vec3(1.0, 0.92, 0.80) * exp(-abs(r - KO_RS * 1.06) / (KO_RS * 0.025)) * 0.9;
  if (C.y >= 0.0) c += dysk;
  // spirale wciągane do środka (przy ogniu jaśniejsze)
  float sp = atan(C.y, C.x) + log(r + 0.01) * 1.7 + u_droga * 0.5;
  c += mix(u_akcent, K_PAPIER, 0.3) * pow(0.5 + 0.5 * sin(sp * 2.0), 10.0) * exp(-r * 3.5) * smoothstep(KO_RS, KO_RS * 2.2, r) * (0.35 + 0.55 * smoothstep(0.2, 0.9, og));
#else
  c = kosmosScena(P, C, P * 720.0, asp, og, puls, spok);
#endif
  vec3 kr = mix(K_LIM, u_akcent, 0.5 + 0.5 * sin(P.x * 2.0 + u_t * 0.2));
  c += kr * tlObrys(dk, 20.0) * (0.06 + 0.10 * og + 0.08 * puls);
  return tlKoniec(c, px, k);
}
`;

  // Źródło programu stopnia: definicja stopnia dla preprocesora (ST_<ID>), biblioteka wspólna, źródło epoki.
  const GLSL_EPOKI={sala:GLSL_SALA,miasto:GLSL_MIASTO,natura:GLSL_NATURA,kosmos:GLSL_KOSMOS};
  const zrodloGLSL=def=>"#define ST_"+def.id.toUpperCase()+" 1\n"+GLSL_WSPOLNE+GLSL_EPOKI[def.ep];

  // ===================================================================================== programy GL i uniformy
  // Rejestracja w rozgrzej() (przed piosenką, po FX.start: silnik kompiluje od razu i zwraca wynik) albo leniwie
  // przy pierwszym rysowaniu. Program, który się nie skompilował (silnik wypisał log raz), oznaczamy jako zły:
  // wpis przestaje wtedy zgłaszać `shader`, więc gra rysuje rysuj2d (getter w wpis()).
  // Rejestracja przed startem silnika gry (np. podgląd w oknie „Scena” w lobby) tylko zapamiętuje źródło, więc po
  // starcie rejestrujemy jeszcze raz (silnik kompiluje wtedy od razu i czeka na wynik); rozgrzej() wymusza to zawsze.
  function zarejestruj(def,wymus){
    const p=def.prog;
    if(p.zly)return false;
    if(typeof FX==="undefined"||!FX||!FX.tlo||typeof FX.tlo.zarejestruj!=="function")return false;
    const gl=typeof FX.gotowy==="function"&&!!FX.gotowy();
    if(p.rej&&(p.rejGl||!gl)&&!wymus)return true;
    p.rej=true;p.rejGl=gl;
    let ok=false;
    try{ok=!!FX.tlo.zarejestruj(p.id,zrodloGLSL(def));}
    catch(e){p.zly=true;bladRaz("rej|"+def.id,"(rejestracja programu „"+def.id+"”)",e);return false;}
    if(!ok&&gl)p.zly=true;
    return ok;
  }
  // obszar kart (prostokąt obejmujący wszystkie karty, px CSS): od niego zależy rama sceny; bez kart domyślna rama
  const KARTY=[0,0,0,0];
  function obszarKart(st){
    const T=st.tory||[],W=st.W||1280,H=st.H||720;
    if(!T.length){KARTY[0]=.07*W;KARTY[1]=.15*H;KARTY[2]=.93*W;KARTY[3]=.90*H;return KARTY;}
    let a=1e9,b=1e9,c=-1e9,d=-1e9;
    for(const t of T){if(t.x<a)a=t.x;if(t.y<b)b=t.y;if(t.x+t.w>c)c=t.x+t.w;if(t.y+t.h>d)d=t.y+t.h;}
    KARTY[0]=a;KARTY[1]=b;KARTY[2]=c;KARTY[3]=d;return KARTY;
  }
  function uniformyGL(def,st){
    const p=def.prog;
    zarejestruj(def,false);
    krok(st,def);
    // program zarejestrowany w działającym silniku, który przez 2 s nie jest gotowy: zły, gra przejdzie na rysuj2d.
    // Liczymy tylko, gdy główny silnik ma WebGL2 (w lobby nie wystartował, a podgląd rysuje własną instancją).
    if(p.rejGl&&!p.zly&&typeof FX!=="undefined"&&FX&&FX.tlo&&typeof FX.tlo.gotowy==="function"&&typeof FX.gotowy==="function"&&FX.gotowy()){
      if(FX.tlo.gotowy(p.id))p.brak=0;else if(++p.brak>120)p.zly=true;
    }
    const U=def.U;
    U.u_t=M.t;U.u_droga=M.droga;U.u_bpm=+st.bpm||120;U.u_final=M.final;U.u_otw=M.otw;U.u_impuls=M.imp;
    U.u_zd=M.zd;U.u_zdS=M.zdS;U.u_zdP=M.zdP;U.u_karty=obszarKart(st);
    U.u_kolorA=def.kol[0];U.u_kolorB=def.kol[1];U.u_kolorC=def.kol[2];
    return U;
  }

  // ===================================================================================== zdarzenia stopni
  // Piorun (burza): każdy próg kombo; co 12 (albo przy pełnym ogniu) mocny, z łukiem GPU nad kartami.
  function piorun(st,prog){
    const W=st.W||1280,H=st.H||720,x=.30+.62*Math.random(),y=.30+.22*Math.random(),z=Math.random()*100;
    M.zd=0;M.zdS=prog===2?1:.55;M.zdP=[x,y,z];
    const pts=[],seg=14;   // łamana dla trybu 2D (ta sama droga co w shaderze: szum po wysokości)
    for(let i=0;i<=seg;i++){const t=i/seg,yy=t*y;pts.push(x*W+((szum1d(yy*9+z)-.5)*.10+(szum1d(yy*34+z+4)-.5)*.025)*H,yy*H);}
    M.piorun={x:x*W,y:y*H,ziarno:Math.floor(z*1000),gpu:prog===2||M.og>=3,pts};
  }
  // Erupcja (wulkan): fontanna iskier GPU z krateru, mocniejsza co 12.
  function erupcja(st,prog){
    M.zd=0;M.zdS=prog===2?1:.6;
    const W=st.W||1280,H=st.H||720,kr=krater(W,H,obszarKart(st)),x0=kr.x,y0=kr.y,ile=Math.round((prog===2?110:50)*(st.gl?1:.5));
    for(let i=0;i<ile&&M.fx.length<200;i++){
      const a=-PI/2+(Math.random()-.5)*.9,v=(.45+.55*Math.random())*H*(prog===2?1.25:.95);
      M.fx.push({x:x0+(Math.random()-.5)*14,y:y0,vx:Math.cos(a)*v,vy:Math.sin(a)*v,wiek:0,zycie:1.1+Math.random()*1.3,r:1.6+Math.random()*2.6,k:Math.random()});
    }
  }
  const ZDARZENIA={
    burza:(def,st,prog)=>{if(prog&&!st.bezRuchu)piorun(st,prog);},
    wulkan:(def,st,prog)=>{if(prog&&!st.bezRuchu)erupcja(st,prog);}
  };

  // ===================================================================================== 2D: bufory i cząstki
  // Wariant 2D rysuje się pod promieniami i kartami na #tlo (c = R.ct z transformacją dpr, współrzędne w px CSS),
  // gdy WebGL2 w tej klatce nie rysuje. Duże warstwy powstają raz na układ w buforach o obniżonej rozdzielczości
  // (tło 2D jest miękkie, a pełnoekranowe płótna w dpr 2 zjadałyby pamięć), w klatce zostają drawImage i kilkadziesiąt
  // cząstek na stałym kroku. Wariant spokojny (st.spokoj) to te same bufory bez ruchu: cecha stopnia (plamki,
  // deszcz, fale, smugi) ma wtedy własny nieruchomy bufor, żeby obraz bez ruchu nie tracił sygnatury.
  const BUF=new Map();
  function nowePlotno(w,h){const cv=document.createElement("canvas");cv.width=Math.max(1,Math.round(w));cv.height=Math.max(1,Math.round(h));return cv;}
  function buf(klucz,w,h,sk,rysuj){
    let b=BUF.get(klucz);if(b)return b;
    const cv=nowePlotno(w*sk,h*sk),x=cv.getContext("2d");
    x.setTransform(sk,0,0,sk,0,0);rysuj(x,w,h);
    b={cv,w,h};BUF.set(klucz,b);return b;
  }
  function gradPion(x,w,h,stopy){const g=x.createLinearGradient(0,0,0,h);for(const s of stopy)g.addColorStop(s[0],s[1]);x.fillStyle=g;x.fillRect(0,0,w,h);}
  function winieta(x,w,h,a){const g=x.createRadialGradient(w/2,h*.55,h*.25,w/2,h*.55,Math.max(w,h)*.75);
    g.addColorStop(0,"rgba(0,0,0,0)");g.addColorStop(1,"rgba(0,0,0,"+a+")");x.fillStyle=g;x.fillRect(0,0,w,h);}
  function poswiata(x,cx,cy,r,kol,a){const g=x.createRadialGradient(cx,cy,0,cx,cy,r);
    g.addColorStop(0,rgbaS(kol,a));g.addColorStop(.4,rgbaS(kol,a*.35));g.addColorStop(1,rgbaS(kol,0));x.fillStyle=g;x.fillRect(cx-r,cy-r,2*r,2*r);}
  const plama=kol=>buf("plama|"+kol,32,32,1,x=>poswiata(x,16,16,16,kol,1));
  // plamka kuli dyskotekowej: pełne koło z miękkim brzegiem (plama z poświaty jest za blada jak na jedyne światło klubu)
  function plamka(x,cx,cy,r,kol,a){const g=x.createRadialGradient(cx,cy,0,cx,cy,r);
    g.addColorStop(0,rgbaS(kol,a));g.addColorStop(.6,rgbaS(kol,a*.8));g.addColorStop(1,rgbaS(kol,0));x.fillStyle=g;x.fillRect(cx-r,cy-r,2*r,2*r);}
  const plamkaB=kol=>buf("plamka|"+kol,32,32,1,x=>plamka(x,16,16,16,kol,1));
  function czastki(nazwa,klucz,n,nowa){
    let e=M.czm.get(nazwa);
    if(!e||e.klucz!==klucz){e={klucz,lista:[]};for(let i=0;i<n;i++)e.lista.push(nowa(i));M.czm.set(nazwa,e);}
    return e.lista;
  }
  const paleta4=(def,st,x)=>[def.kol[0],def.kol[1],def.kol[2],st.akcent||ROZ][Math.floor(ulamek(x)*4)&3];
  const OBRYS=[[26,.05],[14,.08],[6,.12]];
  // pod kartami: poświata krawędzi (trzy obrysy zamiast shadowBlur) i przyciemnienie o 35 % (prześwit)
  function podKartami(c,st,kol,moc){
    const T=st.tory||[];if(!T.length)return;
    c.globalAlpha=1;
    if(kol&&moc>0){
      c.globalCompositeOperation="lighter";
      for(const o of OBRYS){c.lineWidth=o[0];c.strokeStyle=rgbaS(kol,o[1]*moc);c.beginPath();for(const t of T)c.roundRect(t.x,t.y,t.w,t.h,16);c.stroke();}
    }
    c.globalCompositeOperation="source-over";
    c.fillStyle="rgba(0,0,0,.35)";c.beginPath();for(const t of T)c.roundRect(t.x,t.y,t.w,t.h,16);c.fill();
  }

  // ---- Scena (kurtyna, dyskoteka) ----
  // kotara: fałdy z gradientu poziomego (te same wzory co w shaderze), z cieniem rzucanym na scenę po prawej
  const kotara=(w,h)=>buf("kotara|"+Math.round(w)+"x"+h,w+40,h,.5,(x,ww,hh)=>{
    const g=x.createLinearGradient(0,0,w,0);
    for(let i=0;i<=56;i++){
      const s=i/56,f=Math.sin((s*7+.9*Math.sin(s*2))*TAU),ci=.5+.5*f,sh=Math.pow(Math.max(f,0),7)*.28;
      g.addColorStop(s,"rgb("+Math.round((22+80*ci+255*sh)*.9)+","+Math.round((2+7*ci+89*sh)*.9)+","+Math.round((9+32*ci+140*sh)*.9)+")");
    }
    x.fillStyle=g;x.fillRect(0,0,w,hh);
    gradPion(x,w,hh,[[0,"rgba(0,0,0,.55)"],[.45,"rgba(0,0,0,.12)"],[1,"rgba(255,140,80,.10)"]]);
    x.fillStyle="rgba(255,150,90,.22)";x.fillRect(w-3,0,3,hh);
    const s=x.createLinearGradient(w,0,w+40,0);s.addColorStop(0,"rgba(0,0,0,.5)");s.addColorStop(1,"rgba(0,0,0,0)");x.fillStyle=s;x.fillRect(w,0,40,hh);
  });
  const lambrekin=(W,H)=>buf("lambrekin|"+W+"x"+H,W,.1*H,.5,(x,w,h)=>{
    const n=7,sw=w/n;
    for(let i=0;i<n;i++){
      const x0=i*sw,g=x.createLinearGradient(0,0,0,.85*h);g.addColorStop(0,"#1a0209");g.addColorStop(.6,"#5e0723");g.addColorStop(1,"#2a030f");
      x.fillStyle=g;x.beginPath();x.moveTo(x0,0);x.lineTo(x0+sw,0);x.lineTo(x0+sw,.5*h);x.quadraticCurveTo(x0+sw/2,1.15*h,x0,.5*h);x.closePath();x.fill();
      x.strokeStyle="rgba(255,216,74,.7)";x.lineWidth=2;x.beginPath();x.moveTo(x0+sw,.5*h);x.quadraticCurveTo(x0+sw/2,1.15*h,x0,.5*h);x.stroke();
    }
  });
  // stożek światła z lewej góry (ciepły, miękki): ten sam kształt co salaStozek w shaderze
  const STOZEK=(W,H)=>{const sx=-.06*W,sy=-.16*H;return {sx,sy,kat:Math.atan2(1.02*H-sy,.62*W-sx)};};
  const stozek2d=(W,H)=>buf("sala-stozek|"+W+"x"+H,W,H,.25,x=>{
    const z=STOZEK(W,H),R=Math.hypot(W,H)*1.15;
    for(const s of [[.30,.10],[.22,.16],[.15,.22]]){
      const g=x.createRadialGradient(z.sx,z.sy,0,z.sx,z.sy,R);
      g.addColorStop(0,"rgba(255,214,140,"+s[1]+")");g.addColorStop(.55,"rgba(255,190,110,"+(s[1]*.45).toFixed(3)+")");g.addColorStop(1,"rgba(255,180,100,0)");
      x.fillStyle=g;x.beginPath();x.moveTo(z.sx,z.sy);x.arc(z.sx,z.sy,R,z.kat-s[0],z.kat+s[0]);x.closePath();x.fill();
    }
  });
  // plamki kuli dyskotekowej: pozycja plamki z kąta wokół kuli i odległości (rosną z odległością jak w shaderze)
  const diskoPoz=(W,ky,th,r)=>[W/2+Math.sin(th)*r,ky+Math.cos(th)*r];
  // nieruchome pole plamek (wariant spokojny i pierwsza klatka statycznego tła): jeden bufor na układ i paletę
  const diskoPole=(W,H,ky,kol)=>buf("disko-pole|"+W+"x"+H+"|"+Math.round(ky)+"|"+kol.join(),W,H,.5,x=>{
    for(let i=0;i<120;i++){
      const th=(los(i*3.1+.4)-.5)*PI*1.15,r=(.14+los(i*7.7+.2)*1.15)*H,p=diskoPoz(W,ky,th,r),s=5+r*.05;
      if(p[1]<-s||p[0]<-s||p[0]>W+s)continue;
      plamka(x,p[0],p[1],s,kol[i%kol.length],.9);
    }
  });
  function sala2d(def,c,st){
    const W=st.W,H=st.H,o=ogien(st),p=pulsB(st),ruch=!st.spokoj,kl=W+"x"+H,K=obszarKart(st),disko=def.id==="dyskoteka";
    c.drawImage(buf("sala|"+def.id+"|"+kl,W,H,.5,(x,w,h)=>{
      gradPion(x,w,h,disko?[[0,"#07050c"],[.72,"#120a1c"],[1,"#1c1018"]]:[[0,"#0c0908"],[.72,"#1d130f"],[1,"#2f1a10"]]);
      const g=x.createLinearGradient(0,0,w,0),k=Math.max(8,Math.round(w/46));
      for(let i=0;i<=k;i++)g.addColorStop(i/k,i%2?"rgba(0,0,0,0)":"rgba(0,0,0,.30)");
      x.fillStyle=g;x.fillRect(0,0,w,h);winieta(x,w,h,.6);
    }).cv,0,0,W,H);
    if(!disko){   // kurtyna: ciepły stożek, kotary (otwarte: ok. 4/5 kolumny ramy) i lambrekin w pasie nad kartami
      c.globalCompositeOperation="lighter";
      c.globalAlpha=przytnij(.55+.3*o+.12*p+.35*M.imp,0,1);
      c.drawImage(stozek2d(W,H).cv,0,0,W,H);
      c.globalCompositeOperation="source-over";c.globalAlpha=1;
      const kw=W*.5+.03*H,kb=kotara(kw,H),szer=(1-M.otw)*kw+M.otw*Math.max(.82*Math.min(K[0],W-K[2]),.06*H),dw=(szer+2)*(kw+40)/kw,kol=ruch?Math.sin(M.t*.8)*2.5:0;
      c.drawImage(kb.cv,kol-2,0,dw,H);
      c.save();c.translate(W,0);c.scale(-1,1);c.drawImage(kb.cv,-kol-2,0,dw,H);c.restore();
      c.drawImage(lambrekin(W,H).cv,0,K[1]-.010*H-.1*H,W,.1*H);
      return;
    }
    // dyskoteka: plamki krążą wokół kuli nad środkiem (w spokoju nieruchome pole z bufora), potem sama kula
    const kx=W/2,ky=K[1]-.022*H,r=.022*H;
    c.globalCompositeOperation="lighter";
    if(ruch){
      const dz=czastki("disko",kl,90,i=>({th:(los(i*3.1+.4)-.5)*PI*1.15,r:(.14+los(i*7.7+.2)*1.15)*H,h:los(i*5.3)}));
      const w=(.22+.25*o)/7,b=(+st.beat||0)*.0625;
      c.globalAlpha=przytnij(.55+.35*p+.3*o,0,1);
      for(const q of dz){
        q.th+=w*M.kr/60;if(q.th>PI*.58)q.th-=PI*1.16;
        const pp=diskoPoz(W,ky,q.th,q.r),s=5+q.r*.05;
        if(pp[1]<-s||pp[0]<-s||pp[0]>W+s)continue;
        c.drawImage(plamkaB(paleta4(def,st,q.h+b)).cv,pp[0]-s,pp[1]-s,2*s,2*s);
      }
    }else{c.globalAlpha=.85;c.drawImage(diskoPole(W,H,ky,[def.kol[0],def.kol[1],def.kol[2],st.akcent||ROZ]).cv,0,0,W,H);}
    c.globalCompositeOperation="source-over";c.globalAlpha=1;
    c.strokeStyle="rgba(80,72,80,.8)";c.lineWidth=1;c.beginPath();c.moveTo(kx,0);c.lineTo(kx,ky-r);c.stroke();
    const g=c.createRadialGradient(kx-r*.3,ky-r*.3,r*.1,kx,ky,r);g.addColorStop(0,"#d8d4dc");g.addColorStop(.6,"#6a6470");g.addColorStop(1,"#26222a");
    c.fillStyle=g;c.beginPath();c.arc(kx,ky,r,0,TAU);c.fill();
    c.globalCompositeOperation="lighter";c.globalAlpha=.5+.4*p;c.drawImage(plama("#fff4e0").cv,kx-2.4*r,ky-2.4*r,4.8*r,4.8*r);
    c.globalCompositeOperation="source-over";c.globalAlpha=1;
  }

  // ---- Miasto (miasto, burza) ----
  // panorama: kafel szerokości ekranu (budynki na równych komórkach, więc kafel łączy się bez szwu), okna zapalone na stałe
  function panorama(W,H,dalsza){
    const yUl=.865*H,w0=(dalsza?44:78)*H/720,k=Math.max(4,Math.round(W/w0)),bw=W/k,s=H/720;
    return buf("panorama|"+(dalsza?1:2)+"|"+W+"x"+H,W,yUl,.5,(x,w,h)=>{
      for(let i=0;i<k;i++){
        const r=los(i*7.3+(dalsza?3:7)),wys=(dalsza?(.10+.24*r*r):(.16+.40*r*r))*H*(los(i*3.1+(dalsza?5:9))>.86?1.2:1);
        const m=bw*(.05+.10*los(i*9.1+(dalsza?1:2))),x0=i*bw+m,ww=bw-2*m;
        x.fillStyle=dalsza?"#0e0d22":"#05050b";x.fillRect(x0,h-wys,ww,wys);
        for(let yy=h-wys+8*s;yy<h-6*s;yy+=12*s)for(let xx=x0+3*s;xx<x0+ww-6*s;xx+=8*s){
          const q=los(xx*.37+yy*1.91+i*5.3);if(q>(dalsza?.35:.42))continue;
          x.fillStyle=q<.04?ROZ:q<.08?NEON:(dalsza?"rgba(255,216,74,.32)":"rgba(255,226,150,.85)");
          x.fillRect(xx+1.3*s,yy+2.5*s,4*s,5.5*s);
        }
      }
    });
  }
  function panorama2d(c,W,H,dalsza,przes){
    const b=panorama(W,H,dalsza),yUl=.865*H,off=((przes%W)+W)%W;
    c.drawImage(b.cv,-off,0,W,yUl);c.drawImage(b.cv,W-off,0,W,yUl);
  }
  // wieżowiec ramy w 2D: korpus z oknami, dwa uskoki korony, iglica; krawędź od strony kart z neonem
  const wieza2d=(sz,H,strona)=>buf("wieza|"+Math.round(sz)+"|"+H+"|"+strona,sz+8,.865*H,1,(x,w,h)=>{
    const s=H/720,cx=w/2,h0=h-.30*H,h1=h-.255*H,h2=h-.222*H,h3=h-.13*H;
    const g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,"#06060f");g.addColorStop(1,"#1c0c22");
    x.fillStyle=g;x.fillRect(cx-sz/2,h0,sz,h-h0);x.fillRect(cx-sz*.375,h1,sz*.75,h0-h1+1);x.fillRect(cx-sz*.25,h2,sz*.5,h1-h2+1);x.fillRect(cx-Math.max(sz*.03,1.2),h3,2*Math.max(sz*.03,1.2),h2-h3+1);
    for(let yy=h0+6*s;yy<h-6*s;yy+=9*s)for(let xx=cx-sz/2+3*s;xx<cx+sz/2-5*s;xx+=6*s){
      const q=los(xx*.71+yy*1.37+strona*5);if(q>.5)continue;
      x.fillStyle=q<.05?ROZ:q<.09?NEON:"rgba(255,226,150,.85)";x.fillRect(xx+1,yy+2,3*s,4.5*s);
    }
    x.fillStyle=strona>0?ROZ:NEON;x.fillRect(strona>0?cx+sz/2-2:cx-sz/2,h0,2,h-h0);
    x.fillStyle="#ff2a3a";x.beginPath();x.arc(cx,h3,2*s,0,TAU);x.fill();
  });
  // burza: chmury (miękkie plamy w zimnych szarościach, kafel poziomy) i niska linia dachów bez świateł
  const chmury2d=(W,H)=>buf("chmury|"+W+"x"+H,W,.75*H,.25,(x,w,h)=>{
    for(let i=0;i<80;i++){
      const cx=los(i*3.3)*w,cy=(.05+.75*los(i*7.7))*h*(.6+.4*los(i*1.1)),r=(.08+.12*los(i*5.5))*h*2.2;
      for(const dx of [-w,0,w])poswiata(x,cx+dx,cy,r,i%3?"#1b1f33":"#2b3048",.85);
    }
  });
  const dachy2d=(W,H)=>buf("dachy|"+W+"x"+H,W,H,.5,(x,w,h)=>{
    const yUl=.865*h,bw=34*h/720;x.fillStyle="#04050a";
    for(let i=0;i*bw<w;i++){const hh=(.025+.06*Math.pow(los(i*5.5+1.7),2))*h;x.fillRect(i*bw,yUl-hh,bw+1,hh);}
  });
  // nieruchoma ulewa (wariant spokojny): ukośne kreski w jednym buforze
  const ulewa2d=(W,H)=>buf("ulewa|"+W+"x"+H,W,H,.5,(x,w,h)=>{
    const s=h/720;x.strokeStyle="rgba(150,170,215,.30)";x.lineWidth=1.2;x.beginPath();
    for(let i=0;i<160;i++){const xx=los(i*2.9)*w*1.2,yy=los(i*6.1)*h;x.moveTo(xx,yy);x.lineTo(xx+16*s*.22,yy-16*s);}
    x.stroke();
  });
  // błyskawice ramy (te same miejsca co w shaderze): bliższa w prawej kolumnie do ziemi, dalsza w lewej do 0,6 wys.
  function blyskawice(W,H,K){
    return [{x:.5*(K[2]+W),y:.865*H,z:3.7,a:.80},{x:Math.max(.5*K[0],.05*H),y:.60*H,z:11.3,a:.45}];
  }
  function lamana(c,P,szer,kol,a){
    c.strokeStyle=rgbaS(kol,a);c.lineWidth=szer;c.beginPath();c.moveTo(P[0],P[1]);for(let i=2;i<P.length;i+=2)c.lineTo(P[i],P[i+1]);c.stroke();
  }
  function blyskawica2d(c,b,H){
    const P=[];for(let i=0;i<=14;i++){const yy=.06*H+(b.y-.06*H)*i/14,t=yy/H;P.push(b.x+((szum1d(t*9+b.z)-.5)*.10+(szum1d(t*34+b.z+4)-.5)*.025)*H,yy);}
    c.lineJoin="round";lamana(c,P,7,"#dfe8ff",.18*b.a);lamana(c,P,2.2,"#eef3ff",.9*b.a);
  }
  function miasto2d(def,c,st){
    const W=st.W,H=st.H,o=ogien(st),ruch=!st.spokoj,kl=W+"x"+H,yUl=.865*H,s=H/720,K=obszarKart(st);
    if(def.id!=="burza"){
      c.drawImage(buf("miasto|"+kl,W,H,.5,(x,w,h)=>{
        gradPion(x,w,h,[[0,"#04050f"],[.62,"#160a24"],[.864,"#2c0c2c"],[.866,"#06060d"],[1,"#0b0913"]]);
        const g=x.createLinearGradient(0,.55*h,0,.87*h);g.addColorStop(0,"rgba(236,26,131,0)");g.addColorStop(1,"rgba(236,26,131,.16)");
        x.fillStyle=g;x.fillRect(0,.55*h,w,.32*h);
      }).cv,0,0,W,H);
      panorama2d(c,W,H,true,ruch?M.droga*3*s:0);
      panorama2d(c,W,H,false,ruch?M.droga*8*s:0);
      const kl0=K[0],kp=W-K[2];
      if(kl0>8)c.drawImage(wieza2d(.78*kl0,H,1).cv,.5*kl0-(.78*kl0+8)/2,0);
      if(kp>8)c.drawImage(wieza2d(.78*kp,H,-1).cv,K[2]+.5*kp-(.78*kp+8)/2,0);
      return;
    }
    c.drawImage(buf("burza|"+kl,W,H,.5,(x,w,h)=>{
      gradPion(x,w,h,[[0,"#05060d"],[.62,"#121524"],[.864,"#1d2033"],[.866,"#05060b"],[1,"#0a0c16"]]);
    }).cv,0,0,W,H);
    const b=chmury2d(W,H),off=ruch?(M.t*(6+10*o)*s)%W:0;
    c.globalAlpha=.95;c.drawImage(b.cv,-off,0,W,.75*H);c.drawImage(b.cv,W-off,0,W,.75*H);c.globalAlpha=1;
    c.globalCompositeOperation="lighter";
    const BL=blyskawice(W,H,K);
    for(const q of BL){c.globalAlpha=.5*q.a;c.drawImage(plama(CHLOD).cv,q.x-.18*H,.12*H,.36*H,.5*H);}
    c.globalAlpha=1;for(const q of BL)blyskawica2d(c,q,H);
    if(ruch&&M.piorun&&M.zd<.45){
      const a=Math.exp(-M.zd*6)*M.zdS;
      c.fillStyle=rgbaS("#c8d4ff",.32*Math.exp(-M.zd*14)*M.zdS);c.fillRect(0,0,W,.62*H);
      lamana(c,M.piorun.pts,7,"#dfe8ff",.18*a);lamana(c,M.piorun.pts,2.2,"#dfe8ff",.9*a);
    }
    c.globalCompositeOperation="source-over";
    c.drawImage(dachy2d(W,H).cv,0,0,W,H);
    if(ruch){   // ulewa
      const kr=czastki("ulewa",kl,90,()=>({x:Math.random()*W,y:Math.random()*H,v:(780+Math.random()*320)*s}));
      const sk=.22+.14*o;
      c.strokeStyle="rgba(150,170,215,.30)";c.lineWidth=1.2;c.beginPath();
      for(const q of kr){
        for(let i=0;i<M.kr;i++){q.y+=q.v/60;q.x-=q.v*sk/60;}
        if(q.y>H+20){q.y=-Math.random()*40;q.x=Math.random()*W*1.2;}
        c.moveTo(q.x,q.y);c.lineTo(q.x+16*s*sk,q.y-16*s);
      }
      c.stroke();
    }else c.drawImage(ulewa2d(W,H).cv,0,0,W,H);
  }

  // ---- Natura (dżungla, ocean, wulkan) ----
  const NA_LA=[[-.01,.12,.38,.44],[-.01,.52,-.12,.36],[0,1.03,-.95,.50],[1.01,.22,2.84,.42],[1.01,.64,3.34,.34],[1,1.03,4.09,.52],
    [.30,-.02,1.25,.30],[.72,-.02,1.92,.28],[.56,1.04,-1.70,.24]];
  const NA_LB=[[.075,.18],[.060,-.10],[.085,.20],[.072,-.18],[.058,.12],[.085,-.20],[.055,.10],[.052,-.12],[.045,.15]];
  // liść bananowca w 2D: obrys z krzywych (ta sama nasada, kąt, długość i zgięcie co w shaderze), żyłka środkowa
  function lisc2d(x,W,H,i,cien){
    const a=NA_LA[i],b=NA_LB[i],bx=a[0]*W,by=a[1]*H,L=a[3]*H,sz=b[0]*H,zg=b[1],cs=Math.cos(a[2]),sn=Math.sin(a[2]);
    const pt=(u,v)=>{const vv=v+zg*L*u*u;return [bx+u*L*cs-vv*sn,by+u*L*sn+vv*cs];};
    x.beginPath();let p=pt(0,0);x.moveTo(p[0],p[1]);
    for(let k=1;k<=16;k++){const u=k/16,w=sz*Math.pow(Math.sin(PI*Math.pow(u,.7)),.85);p=pt(u,w);x.lineTo(p[0],p[1]);}
    for(let k=16;k>=0;k--){const u=k/16,w=sz*Math.pow(Math.sin(PI*Math.pow(u,.7)),.85);p=pt(u,-w);x.lineTo(p[0],p[1]);}
    x.closePath();x.fillStyle=cien?"rgb(24,80,38)":"#04140a";x.fill();
    if(cien)return;
    x.strokeStyle="rgba(120,200,140,.20)";x.lineWidth=1.5;x.stroke();
    x.strokeStyle="rgba(90,150,100,.35)";x.lineWidth=1.2;x.beginPath();p=pt(0,0);x.moveTo(p[0],p[1]);for(let k=1;k<=12;k++){p=pt(k/12,0);x.lineTo(p[0],p[1]);}x.stroke();
  }
  function korony2d(x,w,h,baza,skala,ziarno,kol){
    x.fillStyle=kol;x.beginPath();x.moveTo(0,h);
    for(let i=-1;i*skala<w+skala;i++){const r=skala*(.6+.55*los(i+ziarno*31)),xc=(i+.5)*skala;x.moveTo(xc+r,h);x.arc(xc,baza*h,r,0,PI,true);x.lineTo(xc-r,h);}
    x.fill();x.fillRect(0,baza*h,w,h-baza*h);
  }
  // pole lawy w 2D: ciemny bazalt, szczeliny jako poszarpane linie w perspektywie (gęściej przy horyzoncie)
  function poleLawy2d(x,w,h,hor){
    const g=x.createLinearGradient(0,hor,0,h);g.addColorStop(0,"#4a1608");g.addColorStop(.08,"#1a0a07");g.addColorStop(1,"#0c0605");
    x.fillStyle=g;x.fillRect(0,hor,w,h-hor);
    const s=h/720;
    for(const l of [[5,"rgba(234,120,30,.18)"],[1.6,"rgba(255,190,70,.75)"]]){
      x.strokeStyle=l[1];x.lineWidth=l[0]*s;x.beginPath();
      for(let r=0;r<12;r++){const t=(r+1)/13,y0=hor+Math.pow(t,1.7)*(h-hor),dy=(2+22*t)*s,krok=(14+60*t)*s;
        x.moveTo(0,y0);for(let xx=krok;xx<=w+krok;xx+=krok)x.lineTo(xx,y0+(los(xx*.013+r*7.1)-.5)*dy);}
      for(let i=0;i<70;i++){const t=los(i*3.3),y0=hor+Math.pow(t,1.7)*(h-hor),xx=los(i*5.7)*w,l2=(4+50*t)*s;
        x.moveTo(xx,y0);x.lineTo(xx+(los(i*9.1)-.5)*l2,y0+l2*.7);}
      x.stroke();
    }
  }
  function natura2d(def,c,st){
    const W=st.W,H=st.H,o=ogien(st),p=pulsB(st),ruch=!st.spokoj,kl=W+"x"+H,hor=.43*H,id=def.id;
    const K=obszarKart(st),ks=ksiezyc(W,H,K),kr=krater(W,H,K);
    c.drawImage(buf("natura|"+id+"|"+kl+"|"+Math.round(K[0])+"|"+Math.round(K[2]),W,H,.5,(x,w,h)=>{
      if(id==="wulkan"){
        gradPion(x,w,h,[[0,"#0c0405"],[.30,"#260b08"],[.43,"#5a1a0a"],[1,"#0c0605"]]);
        for(let i=0;i<22;i++){const cx=los(i*4.3)*w,cy=(.05+.3*los(i*8.9))*h,r=(.06+.1*los(i*2.1))*w;poswiata(x,cx,cy,r,"#120808",.6);}
        poleLawy2d(x,w,h,hor);
        const xc=kr.x,hw=.42*h,top=hor-.25*h*.86;
        const g2=x.createLinearGradient(0,top,0,hor);g2.addColorStop(0,"#2a1310");g2.addColorStop(1,"#070505");
        x.fillStyle=g2;x.beginPath();x.moveTo(xc-hw,hor);x.quadraticCurveTo(xc-.12*h,top+.02*h,xc-.035*h,top);x.lineTo(xc+.035*h,top);x.quadraticCurveTo(xc+.12*h,top+.02*h,xc+hw,hor);x.closePath();x.fill();
        x.strokeStyle="rgba(234,163,43,.55)";x.lineWidth=2;
        for(let i=0;i<7;i++){const x1=xc+(los(i*2.3)-.5)*.06*h;x.beginPath();x.moveTo(x1,top+2);x.quadraticCurveTo(x1+(los(i*5.1)-.5)*.1*h,top+.1*h,x1+(los(i*7.7)-.5)*.25*h,hor-.01*h);x.stroke();}
        return;
      }
      gradPion(x,w,h,[[0,"#020a08"],[1,"#071a12"]]);
      poswiata(x,ks.x,ks.y,.35*h,"#9fd8bd",.35);
      x.fillStyle="#d8eadc";x.beginPath();x.arc(ks.x,ks.y,.037*h,0,TAU);x.fill();
      if(id==="dzungla"){
        korony2d(x,w,h,.60,.07*h,1,"#0a2219");korony2d(x,w,h,.74,.11*h,2,"#03100a");
        gradPion(x,w,h,[[0,"rgba(0,0,0,0)"],[.899,"rgba(0,0,0,0)"],[.9,"rgba(2,12,10,.92)"],[1,"rgba(6,24,20,.92)"]]);
        for(let i=0;i<9;i++)lisc2d(x,w,h,i);
      }else{
        const g=x.createLinearGradient(0,hor,0,h);g.addColorStop(0,"#0b3a40");g.addColorStop(.25,"#06222a");g.addColorStop(1,"#030f14");
        x.fillStyle=g;x.fillRect(0,hor,w,h-hor);
        x.fillStyle="rgba(200,235,220,.18)";for(let i=0;i<40;i++){const yy=hor+(i/40)*(h-hor)*.9,ww=(.02+.1*i/40)*w;x.fillRect(ks.x-ww/2+(los(i)-.5)*ww,yy,ww*.5,1.5);}
        x.save();x.beginPath();x.rect(0,0,.45*w,hor);x.clip();korony2d(x,w,hor+.04*h,.95,.05*h,4,"#03140d");x.restore();
      }
    }).cv,0,0,W,H);
    if(id!=="wulkan"){   // mgła: miękkie pasy przesuwane powoli
      const mg=buf("mgla|"+kl,W,.5*H,.25,(x,w,h)=>{for(let i=0;i<26;i++){const cx=los(i*4.1)*w,cy=(.3+.6*los(i*9.3))*h,r=(.1+.12*los(i*2.7))*w;for(const dx of [-w,0,w])poswiata(x,cx+dx,cy,r,"#9fc4b4",.10);}});
      const off=ruch?(M.t*5*(H/720))%W:0;c.globalAlpha=.8;c.drawImage(mg.cv,-off,.12*H,W,.5*H);c.drawImage(mg.cv,W-off,.12*H,W,.5*H);c.globalAlpha=1;
    }
    if(id==="ocean"){   // fale: kilka grzbietów w perspektywie, łapią światło księżyca (w spokoju nieruchome)
      const t=ruch?M.t:0;
      c.strokeStyle="rgba(170,225,215,.18)";c.lineWidth=1.2;c.beginPath();
      for(let i=0;i<9;i++){
        const g=Math.pow((i+1)/10,1.6)*(H-hor),y0=hor+g,amp=1+g*.02,f=.004+.02/(1+g*.05);
        c.moveTo(0,y0);for(let xx=0;xx<=W;xx+=24)c.lineTo(xx,y0+Math.sin(xx*f+t*(1+.5*o)*(1.3+i*.1)+i)*amp);
      }
      c.stroke();
    }
    if(id==="wulkan"){   // krater pulsuje w rytm, przy erupcji rozpala niebo
      const xc=kr.x,yc=kr.y,erup=Math.exp(-M.zd*1.2)*M.zdS;
      c.globalCompositeOperation="lighter";c.globalAlpha=przytnij(.45+.35*p+.3*o+.7*erup,0,1);
      c.drawImage(plama(BURSZ).cv,xc-.14*H,yc-.10*H,.28*H,.2*H);
      c.globalAlpha=przytnij(.25+.6*erup,0,1);c.drawImage(plama("#ff5a2a").cv,xc-.35*H,yc-.35*H,.7*H,.6*H);
      c.globalCompositeOperation="source-over";c.globalAlpha=1;
    }
  }

  // ---- Kosmos (planety, nadświetlna, dziura) ----
  const gwiazdy2d=(W,H,nr)=>buf("gwiazdy|"+nr+"|"+W+"x"+H,W,H,1,(x,w,h)=>{
    const ile=nr===1?260:90;
    for(let i=0;i<ile;i++){
      const gx=los(i*1.37+nr*9)*w,gy=los(i*7.91+nr*3)*h,r=(nr===1?.6:1)+(nr===1?.7:1.2)*los(i*3.3+nr);
      x.fillStyle=los(i*5.5)>.5?"rgba(225,232,255,"+(.45+.5*los(i*2.2))+")":"rgba(255,236,200,"+(.45+.5*los(i*2.9))+")";
      x.beginPath();x.arc(gx,gy,r,0,TAU);x.fill();
    }
  });
  function planeta2d(H,i,k1,k2){
    return buf("planeta|"+i+"|"+H+"|"+k1+k2,.6*H,.6*H,.5,(x,w,h)=>{
      const r=.1*h,cx=w/2,cy=h/2,pier=i!==2;
      const ring=(przod)=>{x.save();x.translate(cx,cy);x.rotate(.35-.3*i);x.scale(1,.38);x.strokeStyle=rgbaS(k1,.55);x.lineWidth=r*.55;
        x.beginPath();x.arc(0,0,r*1.72,przod?0:PI,przod?PI:TAU);x.stroke();x.restore();};
      poswiata(x,cx,cy,r*1.5,k2,.35);
      if(pier)ring(false);
      const g=x.createRadialGradient(cx-r*.45,cy-r*.4,r*.1,cx,cy,r);g.addColorStop(0,k2);g.addColorStop(.7,k1);g.addColorStop(1,"#050510");
      x.fillStyle=g;x.beginPath();x.arc(cx,cy,r,0,TAU);x.fill();
      x.save();x.beginPath();x.arc(cx,cy,r,0,TAU);x.clip();x.fillStyle="rgba(0,0,0,.18)";for(let j=-3;j<=3;j++)x.fillRect(cx-r,cy+j*r*.27,2*r,r*.1);x.restore();
      if(pier)ring(true);
    });
  }
  // tunel skoku: niebieski brzeg ekranu, jaśniejszy środek
  const tunel2d=(W,H)=>buf("tunel|"+W+"x"+H,W,H,.25,(x,w,h)=>{
    const g=x.createRadialGradient(w/2,h/2,.1*h,w/2,h/2,.75*Math.hypot(w,h));
    g.addColorStop(0,"rgba(140,165,255,.16)");g.addColorStop(.25,"rgba(40,60,170,0)");g.addColorStop(1,"rgba(40,70,200,.55)");
    x.fillStyle=g;x.fillRect(0,0,w,h);
  });
  // dziura: dysk (pochylony, sięga 14 promieni horyzontu, więc przecina boczne kolumny ramy), łuki soczewki nad nim
  const dziura2d=H=>buf("dziura|"+H,3.0*H,1.0*H,.5,(x,w,h)=>{
    const cx=w/2,cy=h/2,rs=.10*H,R=rs*14;
    const g=x.createRadialGradient(0,0,rs*1.4,0,0,R);g.addColorStop(0,"rgba(255,236,160,.95)");g.addColorStop(.12,"rgba(234,163,43,.80)");g.addColorStop(.45,"rgba(236,26,131,.40)");g.addColorStop(1,"rgba(236,26,131,0)");
    poswiata(x,cx,cy,.9*H,BURSZ,.22);
    x.save();x.translate(cx,cy);x.scale(1,.22);x.fillStyle=g;x.beginPath();x.arc(0,0,R,0,TAU);x.arc(0,0,rs*1.4,0,TAU,true);x.fill();x.restore();
    for(const l of [[1.32,.55,.22],[2.1,.30,.5],[3.2,.16,.7]]){x.strokeStyle="rgba(255,190,150,"+l[1]+")";x.lineWidth=rs*l[2];x.beginPath();x.arc(cx,cy,rs*l[0],PI*1.06,PI*1.94);x.stroke();}
    x.fillStyle="#000";x.beginPath();x.arc(cx,cy,rs,0,TAU);x.fill();
    x.strokeStyle="rgba(255,240,215,.9)";x.lineWidth=1.6;x.beginPath();x.arc(cx,cy,rs*1.06,0,TAU);x.stroke();
    x.save();x.translate(cx,cy);x.scale(1,.22);x.fillStyle=g;x.beginPath();x.arc(0,0,R,0,PI);x.arc(0,0,rs*1.4,PI,0,true);x.fill();x.restore();
  });
  function kosmos2d(def,c,st){
    const W=st.W,H=st.H,o=ogien(st),ruch=!st.spokoj,kl=W+"x"+H,cx=W/2,cy=H/2,s=H/720,id=def.id;
    c.drawImage(buf("kosmos|"+kl,W,H,.25,(x,w,h)=>gradPion(x,w,h,[[0,"#02020a"],[1,"#070414"]])).cv,0,0,W,H);
    c.globalCompositeOperation="lighter";
    if(id==="nadswietlna"){c.globalAlpha=1;c.drawImage(tunel2d(W,H).cv,0,0,W,H);}
    const jg=id==="nadswietlna"?.35:1;
    for(const nr of [1,2]){
      const b=gwiazdy2d(W,H,nr),off=ruch?(M.droga*(nr===1?.012:.04)*H)%W:0;
      c.globalAlpha=przytnij(jg*(nr===1?.75:1),0,1);c.drawImage(b.cv,-off,0,W,H);c.drawImage(b.cv,W-off,0,W,H);
    }
    if(id==="nadswietlna"){   // smugi od środka (bez ognia też smugi, przy ogniu dłuższe; w spokoju nieruchome)
      const d=ruch?M.droga:0;
      c.globalAlpha=1;c.strokeStyle=rgbaS("#d4dfff",.65+.3*o);c.lineWidth=1.8*Math.max(1,s);c.beginPath();
      for(let i=0;i<120;i++){
        const a=los(i*2.17)*TAU,v=ulamek(los(i*5.3)+d*(.10+.30*o)*.35),r0=(.06+Math.pow(v,1.3)*.9)*.62*W,l=(.08+.12*o)*W*(.3+v);
        c.moveTo(cx+Math.cos(a)*r0,cy+Math.sin(a)*r0);c.lineTo(cx+Math.cos(a)*(r0+l),cy+Math.sin(a)*(r0+l));
      }
      c.stroke();
    }
    c.globalCompositeOperation="source-over";c.globalAlpha=1;
    if(id==="planety"){
      const K=obszarKart(st);
      for(let i=0;i<3;i++){
        let x,y,r;
        if(i<2){const pl=planetaRamy(i,W,H,K);x=pl.x;y=pl.y;r=pl.r;}
        else{const f=ulamek(M.droga*.0045);r=(.07+.10*los(3.7))*H;x=W+r*2.6-(W+r*5.2)*f;y=(.16+.68*los(5.1))*H;}
        const k1=paleta4(def,st,i*.27),k2=paleta4(def,st,i*.27+.33),b=planeta2d(H,i,k1,k2),sk=r/(.1*.6*H);
        c.drawImage(b.cv,x-.3*H*sk,y-.3*H*sk,.6*H*sk,.6*H*sk);
        if(i===0&&o>.2){c.globalCompositeOperation="lighter";c.globalAlpha=.5*o;c.drawImage(plama(st.akcent||ROZ).cv,x-r*1.6,y-r*1.6,r*3.2,r*3.2);c.globalCompositeOperation="source-over";c.globalAlpha=1;}
      }
    }
    if(id==="dziura"){
      c.drawImage(dziura2d(H).cv,cx-1.5*H,cy-.5*H,3.0*H,1.0*H);
      if(ruch){c.globalCompositeOperation="lighter";
        for(let i=0;i<9;i++){const a=M.droga*.35*1.2+i*TAU/9,rr=(.10*(2.4+3*(i%3)))*H;c.globalAlpha=.5;c.drawImage(plama(ZOLTY).cv,cx+Math.cos(a)*rr-5,cy+Math.sin(a)*rr*.22-5,10,10);}}
    }
    c.globalCompositeOperation="source-over";c.globalAlpha=1;
  }
  const R2D={sala:sala2d,miasto:miasto2d,natura:natura2d,kosmos:kosmos2d};
  function rysuj2d(def,c,st){
    krok(st,def);
    if(!(st.W>0&&st.H>0))return;
    c.globalCompositeOperation="source-over";c.globalAlpha=1;
    R2D[def.ep](def,c,st);
    podKartami(c,st,def.obrys,st.spokoj?.6:.7+.5*ogien(st));
  }

  // ===================================================================================== na kartach: światło sceny
  // Karty stoją na scenie, więc pada na nie jej światło; stopnie 2–6 mają karty kryjące i bez tego scenę widać
  // tylko w ramie. Mapa światła ma 1/8 rozdzielczości ekranu (z natury miękka i tania) i powstaje co klatkę:
  // półmrok sceny, wycięcia tam, gdzie świeci (stożek, księżyc), barwne plamy, cienie liści. Rozciągnięta na ekran
  // i przycięta do kart leży nad papierem, pod nutami i żabami. Granice czytelności i kremowej karty: półmrok ≤ 0,08
  // w barwie sceny (nie szarość), barwa ≤ 0,06, błysk ≤ 0,15 (piorun: pojedynczy, gaśnie w ćwierć sekundy).
  // Wariant spokojny: ta sama mapa bez ruchu.
  const MAPA={cv:null,x:null,w:0,h:0};
  function mapaSwiatla(W,H){
    const w=Math.max(8,Math.ceil(W/8)),h=Math.max(8,Math.ceil(H/8));
    if(!MAPA.cv||MAPA.w!==w||MAPA.h!==h){MAPA.cv=nowePlotno(w,h);MAPA.x=MAPA.cv.getContext("2d");MAPA.w=w;MAPA.h=h;}
    const x=MAPA.x;
    x.setTransform(w/W,0,0,h/H,0,0);x.globalCompositeOperation="source-over";x.globalAlpha=1;x.clearRect(0,0,W,H);
    return x;
  }
  // białe maski świateł (alfa ≈ 1 w osi) do wycinania półmroku
  const maskaStozka=(W,H)=>buf("maska-stozek|"+W+"x"+H,W,H,.125,x=>{
    const z=STOZEK(W,H),R=Math.hypot(W,H)*1.2;
    for(const s of [[.30,.30],[.22,.35],[.14,.45]]){
      const g=x.createRadialGradient(z.sx,z.sy,0,z.sx,z.sy,R);g.addColorStop(0,"rgba(255,255,255,"+s[1]+")");g.addColorStop(1,"rgba(255,255,255,"+(s[1]*.4).toFixed(3)+")");
      x.fillStyle=g;x.beginPath();x.moveTo(z.sx,z.sy);x.arc(z.sx,z.sy,R,z.kat-s[0],z.kat+s[0]);x.closePath();x.fill();
    }
  });
  const cienieLisci=(W,H)=>buf("cienie-lisci|"+W+"x"+H,W,H,.125,x=>{for(let i=0;i<9;i++)lisc2d(x,W,H,i,true);});
  function gradPlama(x,cx,cy,r,kol,a){const g=x.createRadialGradient(cx,cy,0,cx,cy,r);g.addColorStop(0,rgbaS(kol,a));g.addColorStop(1,rgbaS(kol,0));x.fillStyle=g;x.fillRect(cx-r,cy-r,2*r,2*r);}
  // księżyc (dżungla, ocean) w lewej kolumnie ramy, krater wulkanu w prawej; planety w obu kolumnach: px CSS.
  // Planety ramy: tarcza ok. 1,2 szerokości kolumny (wychodzi zza kart), lewa wyżej, prawa niżej (jak w shaderze).
  const ksiezyc=(W,H,K)=>({x:Math.max(.5*K[0],.05*H),y:.27*H});
  const krater=(W,H,K)=>({x:Math.min(.5*(K[2]+W),W-.05*H),y:(.43-.25*.86)*H});
  function planetaRamy(i,W,H,K){
    const lew=i===0,szer=lew?K[0]:W-K[2],r=Math.min(.62*Math.max(szer,.06*H),.15*H);
    return {x:lew?.5*K[0]:.5*(K[2]+W),y:((lew?.36:.62)+.06*Math.sin(M.t*.012+(lew?0:2.4)))*H,r};
  }
  const SWIATLO={
    sala(def,x,st){
      const W=st.W,H=st.H,o=ogien(st),p=pulsB(st),ruch=!st.spokoj,K=obszarKart(st);
      if(def.id==="kurtyna"){
        x.fillStyle="rgba(120,62,24,.08)";x.fillRect(0,0,W,H);   // ciepły półmrok sceny, nie szarość
        x.globalCompositeOperation="destination-out";x.globalAlpha=.95;x.drawImage(maskaStozka(W,H).cv,0,0,W,H);
        x.globalCompositeOperation="source-over";x.globalAlpha=przytnij(.07+.03*o+.02*p+.03*M.imp,0,.13);
        x.drawImage(stozek2d(W,H).cv,0,0,W,H);x.globalAlpha=1;
        // kotary rzucają na karty bordowy cień od boków, szerszy, gdy są zasunięte
        const kw=((1-M.otw)*(W*.5+.03*H)+M.otw*Math.max(.82*K[0],.06*H))*1.6;
        for(const pr of [0,1]){
          const g=x.createLinearGradient(pr?W:0,0,pr?W-kw:kw,0);g.addColorStop(0,"rgba(130,20,55,.07)");g.addColorStop(1,"rgba(130,20,55,0)");
          x.fillStyle=g;x.fillRect(pr?W-kw:0,0,kw,H);
        }
        return;
      }
      x.fillStyle="rgba(60,30,90,.08)";x.fillRect(0,0,W,H);   // fioletowy półmrok klubu
      // plamki kuli wędrują też po kartach
      const L=czastki("disko-karty",W+"x"+H,20,()=>({th:(Math.random()-.5)*PI*1.1,r:(.2+Math.random())*H,h:Math.random()}));
      const w=(.22+.25*o)/7,b=(+st.beat||0)*.0625,ky=K[1]-.022*H;
      x.globalAlpha=przytnij(.045+.015*p+.015*o,0,.06);
      for(const q of L){
        if(ruch){q.th+=w*M.kr/60;if(q.th>PI*.55)q.th-=PI*1.1;}
        const pp=diskoPoz(W,ky,q.th,q.r),s=6+q.r*.035;
        x.drawImage(plama(paleta4(def,st,q.h+b)).cv,pp[0]-s,pp[1]-s,2*s,2*s);
      }
      x.globalAlpha=1;
    },
    miasto(def,x,st){
      const W=st.W,H=st.H,p=pulsB(st),o=ogien(st),ruch=!st.spokoj;
      if(def.id==="burza"){
        x.fillStyle="rgba(50,60,110,.08)";x.fillRect(0,0,W,H);   // zimny półmrok burzy
        const b=blyskawice(W,H,obszarKart(st))[0];gradPlama(x,b.x,.45*H,.9*H,"#c8d4ff",.05);   // poświata bliższej błyskawicy
        if(ruch&&M.piorun&&M.zd<.5){x.fillStyle=rgbaS("#dbe4ff",.15*Math.exp(-M.zd*9)*M.zdS);x.fillRect(0,0,W,H);}
        return;
      }
      x.fillStyle="rgba(120,40,110,.07)";x.fillRect(0,0,W,H);   // fioletowy półmrok nocnego miasta
      const a=.045*(.7+.3*p)*(1+.3*o);   // neony z boków każdej karty: róż z lewej, błękit z prawej, oddychają w rytm
      for(const t of st.tory||[]){
        const s=Math.min(80,t.w*.14);
        let g=x.createLinearGradient(t.x,0,t.x+s,0);g.addColorStop(0,rgbaS(ROZ,a));g.addColorStop(1,rgbaS(ROZ,0));x.fillStyle=g;x.fillRect(t.x,t.y,s,t.h);
        g=x.createLinearGradient(t.x+t.w,0,t.x+t.w-s,0);g.addColorStop(0,rgbaS(NEON,a));g.addColorStop(1,rgbaS(NEON,0));x.fillStyle=g;x.fillRect(t.x+t.w-s,t.y,s,t.h);
      }
    },
    natura(def,x,st){
      const W=st.W,H=st.H,o=ogien(st),p=pulsB(st),ruch=!st.spokoj,K=obszarKart(st);
      if(def.id==="wulkan"){
        x.fillStyle="rgba(110,40,20,.07)";x.fillRect(0,0,W,H);   // czerwony półmrok popiołu
        const e=Math.exp(-M.zd*1.2)*M.zdS,kr=krater(W,H,K);   // łuna lawy od strony wulkanu, pulsuje w rytm, erupcja rozpala
        gradPlama(x,kr.x,kr.y,.9*H,"#ff8a2a",przytnij(.035+.012*p+.013*o+.09*e,0,.15));
        const g=x.createLinearGradient(0,H,0,.5*H);g.addColorStop(0,"rgba(255,120,40,.05)");g.addColorStop(1,"rgba(255,120,40,0)");x.fillStyle=g;x.fillRect(0,.5*H,W,.5*H);
        return;
      }
      const ks=ksiezyc(W,H,K);
      x.fillStyle=def.id==="ocean"?"rgba(30,90,100,.07)":"rgba(40,100,50,.07)";x.fillRect(0,0,W,H);   // turkusowy albo zielony półmrok
      x.globalCompositeOperation="destination-out";gradPlama(x,ks.x,ks.y,1.1*H,"#ffffff",.75);
      x.globalCompositeOperation="source-over";gradPlama(x,ks.x,ks.y,1.1*H,"#d8f0d0",.04);
      if(def.id==="dzungla"){   // cienie liści z ramy sceny (zielone, nie czarne), przesunięte od księżyca i kołysane wiatrem
        const dx=ruch?Math.sin(M.t*.55)*5+o*Math.sin(M.t*1.7)*5:0,dy=ruch?Math.cos(M.t*.4)*3:0;
        x.globalAlpha=.08;x.drawImage(cienieLisci(W,H).cv,.04*W+dx,.06*H+dy,W*1.07,H*1.07);x.globalAlpha=1;
      }
    },
    kosmos(def,x,st){
      const W=st.W,H=st.H,o=ogien(st),p=pulsB(st),K=obszarKart(st);
      x.fillStyle="rgba(70,40,130,.06)";x.fillRect(0,0,W,H);   // fioletowy półmrok kosmosu
      if(def.id==="planety"){   // odblask obu planet ramy, planeta lidera przy ogniu w kolorze partii
        for(let i=0;i<2;i++){const pl=planetaRamy(i,W,H,K);gradPlama(x,pl.x,pl.y,.55*H,def.kol[i?2:1],.04);}
        if(o>.05){const pl=planetaRamy(0,W,H,K);gradPlama(x,pl.x,pl.y,.5*H,st.akcent||ROZ,.06*o);}
      }else if(def.id==="nadswietlna")gradPlama(x,W/2,H/2,.8*H,"#c8d6ff",.04+.04*o);
      else{
        gradPlama(x,W/2,H/2,.34*H,"#3a1a5a",.08);
        x.save();x.translate(W/2,H/2);x.scale(1,.25);gradPlama(x,0,0,.9*H,BURSZ,.05*(.8+.2*p));x.restore();
      }
    }
  };
  function swiatloKart(def,c,st){
    const T=st.tory||[];if(!T.length||!(st.W>0&&st.H>0))return;
    const x=mapaSwiatla(st.W,st.H);
    SWIATLO[def.ep](def,x,st);
    c.save();c.beginPath();for(const t of T)c.roundRect(t.x,t.y,t.w,t.h,16);c.clip();
    c.globalAlpha=1;c.globalCompositeOperation="source-over";c.imageSmoothingEnabled=true;
    c.drawImage(MAPA.cv,0,0,st.W,st.H);
    c.restore();
  }

  // ===================================================================================== na kartach: ścieg w rytm
  // Stopnie 2–11 mają `scieg:false`, więc bufor kart nie rysuje statycznego ściegu, a ten rysuje się na #tlo nad
  // kartami (pod nutami): kreska przesuwa się o jeden takt wzoru (7 + 5 px) na ćwierćnutę. W spokoju nici ma kolor
  // lnu, z ogniem toru przechodzi w akcent partii, grubieje i dostaje miękką poświatę.
  function sciegKart(c,st){
    const T=st.tory||[];if(!T.length)return;
    const RT=(typeof R!=="undefined"&&R&&Array.isArray(R.tory)&&R.tory.length===T.length)?R.tory:null;
    c.globalAlpha=1;c.globalCompositeOperation="source-over";
    c.setLineDash([7,5]);c.lineDashOffset=st.spokoj||st.bezRuchu?0:-ulamek(+st.faza||0)*12;
    for(let i=0;i<T.length;i++){
      const t=T[i],tor=RT&&RT[i]?RT[i].tor:null;
      const ak=(tor&&tor.styl&&tor.styl.akcent)||st.akcent||ROZ;
      const z=przytnij(((tor?+tor.zar:+st.zar)||0)/3,0,1);
      if(z>.02){
        c.setLineDash([]);c.lineWidth=5;c.strokeStyle=rgbaS(ak,.16*z);
        c.beginPath();c.roundRect(t.x+6,t.y+6,t.w-12,t.h-12,11);c.stroke();c.setLineDash([7,5]);
      }
      c.lineWidth=1.6+.8*z;c.strokeStyle=mieszajS("#7a6a52",ak,z,.5+.4*z);
      c.beginPath();c.roundRect(t.x+6,t.y+6,t.w-12,t.h-12,11);c.stroke();
    }
    c.setLineDash([]);c.lineDashOffset=0;
  }
  function nadKartami(def,c,st){krok(st,def);swiatloKart(def,c,st);sciegKart(c,st);}

  // ===================================================================================== fx: prymitywy GPU nad kartami
  // Z WebGL2 leżą na #glFx (nad kartami, pod nutami), w trybie 2D silnik rysuje je od razu na #scena przed torami.
  // Nad kartą: blend normal i alfa ≤ 0,25 (add nad papierem bieleje i nic nie wnosi); nad ciemną sceną: add.
  // Gra rysuje tło statycznie i haka `fx` nie woła; woła go podgląd stopnia w oknie „Scena”.
  function wKarcie(st,x,y){const T=st.tory||[];for(const t of T)if(x>=t.x&&x<=t.x+t.w&&y>=t.y&&y<=t.y+t.h)return true;return false;}
  function fxPiorun(st){
    const p=M.piorun;if(!p||!p.gpu||M.zd>.4)return;
    const a=.24*Math.exp(-M.zd*5);
    FX.luk(p.x+(szum1d(p.ziarno)-.5)*30,0,p.x,p.y,2.2,"#e3ebff",a,p.ziarno,Math.max(14,.035*st.H),14);
    if(M.zd<.04)FX.blysk("#c9d6ff",.12);
  }
  // świetliki (dżungla): błądzą (przyspieszenie z gładkiego szumu, tłumienie), przy ogniu zlatują się do linii śpiewu
  function fxSwietliki(st){
    const W=st.W,H=st.H,o=ogien(st),max=st.gl?72:36;
    const L=czastki("swietliki",W+"x"+H+"|"+max,max,()=>({x:Math.random()*W,y:(.15+.8*Math.random())*H,vx:0,vy:0,f:Math.random()*TAU,z:Math.random()}));
    const T=st.tory||[],ile=Math.round(max*(.45+.55*o)),h=1/60,tl=Math.exp(-1.6*h);
    for(let s=0;s<M.kr;s++)for(let i=0;i<ile;i++){
      const q=L[i];
      let ax=(szum1d(q.f*7.1+M.t*.35)-.5)*70,ay=(szum1d(q.f*3.3+M.t*.31+9)-.5)*60;
      if(o>.15&&T.length){const t=T[i%T.length];ax+=(t.teraz-q.x)*1.1*o;ay+=(t.y+t.h*(.2+.6*q.z)-q.y)*1.1*o;}
      q.vx=(q.vx+ax*h)*tl;q.vy=(q.vy+ay*h)*tl;q.x+=q.vx*h;q.y+=q.vy*h;
      if(q.x<-20)q.x=W+20;else if(q.x>W+20)q.x=-20;
      if(q.y<-20)q.y=H*.9;else if(q.y>H+20)q.y=H*.2;
    }
    const b=+st.beat||0;
    for(let i=0;i<ile;i++){
      const q=L[i],mig=Math.pow(.5+.5*Math.sin(b*PI+q.f),3),r=(4+3*q.z)*(1+.35*o);
      if(wKarcie(st,q.x,q.y))FX.sprite(q.x,q.y,r,ZIEL,.06+.16*mig,0,"kolo","normal");
      else FX.sprite(q.x,q.y,r*1.7,LIM,.22+.68*mig,0,"kolo","add");
    }
  }
  // iskry erupcji (wulkan): grawitacja i opór powietrza
  function fxCzastki(st){
    const L=M.fx;if(!L.length)return;
    const h=1/60,g=st.H*1.1;
    for(let s=0;s<M.kr;s++)for(const q of L){q.wiek+=h;q.vy+=g*h;q.vx*=Math.exp(-.3*h);q.x+=q.vx*h;q.y+=q.vy*h;}
    let j=0;for(let i=0;i<L.length;i++)if(L[i].wiek<L[i].zycie)L[j++]=L[i];L.length=j;
    for(const q of L){
      const f=q.wiek/q.zycie,a=(1-f)*(1-f)*Math.min(1,q.wiek*12),kol=q.k<.5?BURSZ:q.k<.85?ZOLTY:ROZ;
      if(wKarcie(st,q.x,q.y))FX.sprite(q.x,q.y,q.r*1.3,BURSZ,Math.min(.24,.3*a),0,"iskra","normal");
      else FX.sprite(q.x,q.y,q.r*1.9,kol,.95*a,0,"iskra","add");
    }
  }
  // skok nadświetlny nad kartami: smugi od środka, alfa ≤ 0,2 przy pełnym ogniu
  function fxWarp(st){
    const o=ogien(st);if(o<.08)return;
    const W=st.W,H=st.H,cx=W/2,cy=H/2,L=M.warp,max=st.gl?48:24,R=Math.hypot(W,H)*.55,h=1/60;
    while(L.length<max)L.push({a:Math.random()*TAU,r:Math.random()*R,v:.6+Math.random()*.8});
    for(let s=0;s<M.kr;s++)for(const q of L){q.r+=q.v*R*(.25+.9*o)*h*(1+q.r/R*2);if(q.r>R){q.r=R*.05*Math.random();q.a=Math.random()*TAU;}}
    for(const q of L){
      const dl=(.04+.30*o)*q.r,ca=Math.cos(q.a),sa=Math.sin(q.a);
      FX.wstega([cx+ca*(q.r-dl),cy+sa*(q.r-dl),cx+ca*q.r,cy+sa*q.r],1.4,"#c6d3ff",0,.2*o*Math.min(1,q.r/(R*.25)),"normal");
    }
  }
  const FX_STOPNI={burza:fxPiorun,dzungla:fxSwietliki,wulkan:fxCzastki,nadswietlna:fxWarp};
  function fxStopnia(def,st){
    krok(st,def);
    if(st.spokoj||typeof FX==="undefined"||!FX||typeof FX.sprite!=="function")return;
    const f=FX_STOPNI[def.id];if(f)f(st);
  }
  // Rozgrzewka przed piosenką: z WebGL2 kompilacja programu (nigdy w klatce kombo), zawsze bufory mapy światła na
  // kartach, a bez WebGL2 także bufory 2D sceny, żeby pierwsza klatka nie budowała panoram, chmur i liści.
  function rozgrzej(def,st){
    if(!st)return;
    if(st.gl)zarejestruj(def,true);
    if(!(st.W>0&&st.H>0))return;
    // bufory mapy światła na kartach (potrzebne w obu trybach), a bez WebGL2 także warstwy 2D sceny
    if(st.tory&&st.tory.length)SWIATLO[def.ep](def,mapaSwiatla(st.W,st.H),st);
    if(!st.gl){const cv=nowePlotno(4,4),x=cv.getContext("2d");if(x)R2D[def.ep](def,x,st);}
  }

  // ===================================================================================== drabinka
  const progStopnia=n=>n<=1?0:Math.round(30*Math.pow(n-1,1.7));
  // prześwit kart według wyglądu (bez zmian względem dawnej drabinki): sala, miasto i dżungla kryjące (kremowy
  // kraft), od oceanu karty lekko przepuszczają scenę; resztę pokazuje rama dookoła kart (recenzja 10-04: przy 0,20
  // karty szarzały)
  const PRZESWIT={ocean:.04,wulkan:.05,planety:.09,nadswietlna:.10,dziura:.11};
  // rama sceny (gra zwęża karty, gdy wpis tła ją ma): kotary, kula i planety chcą szerszych kolumn bocznych
  const RAMA={kurtyna:{bok:.09},dyskoteka:{bok:.09},planety:{bok:.09}};
  // paleta stopnia (u_kolorA/B/C w shaderze, kolory 2D) i poświata krawędzi kart: domyślnie z epoki, burza zimna,
  // wulkan w lawie, planety w ciepło-zimnej parze tarcz
  const PALETA={sala:[ZOLTY,ROZ,LIM],miasto:[ROZ,NEON,ZOLTY],natura:[LIM,ZIEL,ZOLTY],kosmos:[ROZ,NEON,ZOLTY],
    burza:[CHLOD,NEON,PAPIER],wulkan:[BURSZ,ROZ,ZOLTY],planety:[BURSZ,NEON,ROZ]};
  const OBRYS_KOL={sala:"#ffcf80",miasto:ROZ,natura:LIM,kosmos:LIM,dyskoteka:ROZ,burza:CHLOD,wulkan:BURSZ};
  // kolory promieni i światła ognia pod kartami (zlozTlo): na ciemnych scenach słabsze i w barwach sceny, żeby
  // promienie wyglądały jak światło sceny, a nie jak zasłona na niej
  const T_TLO={
    kurtyna:{promienie:[["236,26,131",.14],["255,216,74",.12]],swiatlo:["230,120,90","150,30,80"]},
    dyskoteka:{promienie:[["236,26,131",.17],["166,216,97",.14]],swiatlo:["200,70,150","90,130,60"]},
    miasto:{promienie:[["236,26,131",.10],["68,112,255",.10]],swiatlo:["150,40,120","40,60,160"]},
    burza:{promienie:[["170,190,255",.09],["120,90,200",.08]],swiatlo:["100,110,190","40,50,140"]},
    dzungla:{promienie:[["166,216,97",.10],["108,179,63",.09]],swiatlo:["90,150,80","30,80,50"]},
    ocean:{promienie:[["120,200,230",.09],["166,216,97",.08]],swiatlo:["60,140,150","25,60,110"]},
    wulkan:{promienie:[["234,163,43",.13],["236,26,131",.11]],swiatlo:["230,110,40","140,30,30"]},
    planety:{promienie:[["200,215,255",.07],["255,216,74",.07]],swiatlo:["90,80,170","150,90,40"]},
    nadswietlna:{promienie:[["170,200,255",.09],["250,246,238",.06]],swiatlo:["100,120,200","40,60,160"]},
    dziura:{promienie:[["255,216,74",.08],["236,26,131",.08]],swiatlo:["200,120,70","140,30,100"]}
  };
  // Numer `n` ustala kolejność i próg; wygląd (shader, 2D, światło na kartach, prześwit, rama, paleta) wybiera id.
  function wpis(n,id,nazwa,cecha,opis,ep,zFx){
    const def={n,id,ep,U:{},prog:{id:"tlo-"+id,rej:false,rejGl:false,zly:false,brak:0},zdarzenia:ZDARZENIA[id]||null,
      obrys:OBRYS_KOL[id]||OBRYS_KOL[ep],kol:PALETA[id]||PALETA[ep]};
    const shader={id:def.prog.id,uniformy:st=>uniformyGL(def,st)};
    const w={stopien:n,id,nazwa,cecha,opis,prog:progStopnia(n),przeswit:PRZESWIT[id]||0,rama:RAMA[id]||true,scieg:false,tlo:T_TLO[id],
      rysuj2d:(c,st)=>rysuj2d(def,c,st),nadKartami:(c,st)=>nadKartami(def,c,st),rozgrzej:st=>rozgrzej(def,st)};
    if(zFx)w.fx=st=>fxStopnia(def,st);
    // Program, który się nie skompilował, znika z wpisu: gra rysuje wtedy rysuj2d zamiast pustego płótna GL.
    Object.defineProperty(w,"shader",{enumerable:true,get:()=>def.prog.zly?null:shader});
    return w;
  }
  const DRABINKA=[
    {stopien:1,id:"kraft",nazwa:"Kraft",cecha:"filc i kraft",opis:"Filc i kraft jak dotąd, a przy ogniu promienie i ciepłe światło pod torami.",prog:0,przeswit:0},
    wpis(2,"kurtyna","Kurtyna","teatralne kotary","Aksamitne kotary w ciepłym świetle sceny rozsuwają się na start i zasuwają po finale.","sala",false),
    wpis(3,"dyskoteka","Kula dyskotekowa","plamki światła","W ciemnym klubie kula dyskotekowa sypie po ścianach kolorowymi plamkami, które w rytm zmieniają barwę.","sala",false),
    wpis(4,"miasto","Miasto nocą","panorama drapaczy","Panorama drapaczy chmur z oknami mrugającymi w rytm i wieżowcami po bokach sceny, a przy ogniu neony na dachach.","miasto",false),
    wpis(5,"burza","Burza","ulewa i pioruny","Ciężkie chmury nad ciemnym horyzontem, ukośna ulewa i błyskawice, a próg kombo dokłada uderzenie pioruna.","miasto",true),
    wpis(6,"dzungla","Dżungla nocą","liście i świetliki","Liście bananowca w półmroku i świetliki, które przy ogniu zlatują się do linii śpiewu: tu mieszkają żaby.","natura",true),
    wpis(7,"ocean","Ocean","fale i kaustyki","Nocne morze z falami, ścieżką księżyca i kaustykami na płyciźnie, a przy ogniu przypływ i piana.","natura",false),
    wpis(8,"wulkan","Wulkan","lawa na horyzoncie","Wulkan pulsuje lawą w rytm nad polem zastygłej lawy w czerwonym dymie, a próg kombo wywołuje erupcję.","natura",true),
    wpis(9,"planety","Planety","planety z pierścieniami","Duże planety z pierścieniami i księżycami wiszą tuż za kartami, a przy ogniu planeta lidera świeci kolorem partii.","kosmos",false),
    wpis(10,"nadswietlna","Nadświetlna","gwiazdy w smugach","Gwiazdy rozciągnięte w smugi zbiegają się do środka sceny jak w skoku nadświetlnym, a przy ogniu są dłuższe i szybsze.","kosmos",true),
    wpis(11,"dziura","Czarna dziura","zakrzywione światło","Czarna dziura na środku sceny zakrzywia światło gwiazd, a jej rozżarzony dysk przecina scenę i wiruje w rytm.","kosmos",false)
  ];

  return {DRABINKA,reset};
})();
