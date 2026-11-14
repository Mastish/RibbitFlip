// RibbitBeat: próbki gracza (web/gry/js/studio-probki.js + tor próbek w glos.js i studio.js) — czyste funkcje w Node.
//
// Funkcje i stałe są WYCINANE z plików gry po nazwie (jak gry_zabi_chor_harness.mjs), więc test pilnuje prawdziwego
// kodu, a nie jego kopii. Nie ma tu przeglądarki, więc nie ma mikrofonu ani IndexedDB — sprawdzane jest to, co i tak
// decyduje o brzmieniu: format WAV w obie strony, przycięcie ciszy, wykrycie stroju, tablica próbek w silniku
// (podmiana unieważnia bufory) i receptura, którą Studio podaje silnikowi.
// Wywoływane z tests/test_gry_probki.py. Na wyjściu ostatnia linia to JSON {checks:[[nazwa, ok, szczegół], …]}.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const GRY = path.join(REPO, "web", "gry", "js");
const checks = [];
const ck = (name, ok, detail) => checks.push([name, !!ok, detail === undefined ? "" : String(detail)]);
const zrodlo = {};
// probki-audio.js jest wspólny dla panelu i gry, ale leży w katalogu GRY: tylko web/gry i web/assets
// trafiają do RibbitBeat.exe (RibbitBeat.spec) i tylko te dwa katalogi wystawia serwer gry (DOZWOLONE).
const czytaj = f => (zrodlo[f] = zrodlo[f] || fs.readFileSync(path.join(GRY, f), "utf8"));

// Koniec wyrażenia: liczy nawiasy (), [], {} z pominięciem napisów i komentarzy (kopia z gry_zabi_chor_harness.mjs).
function domknij(src, od, naSredniku) {
  let d = 0, q = null;
  for (let k = od; k < src.length; k++) {
    const c = src[k];
    if (q) { if (c === "\\") { k++; continue; } if (c === q) q = null; continue; }
    if (c === "'" || c === '"' || c === "`") { q = c; continue; }
    if (c === "/" && src[k + 1] === "/") { k = src.indexOf("\n", k); continue; }
    if (c === "/" && src[k + 1] === "*") { k = src.indexOf("*/", k) + 1; continue; }
    if (c === "(" || c === "[" || c === "{") d++;
    else if (c === ")" || c === "]" || c === "}") { d--; if (d === 0 && !naSredniku) return k + 1; }
    else if (c === ";" && d === 0 && naSredniku) return k + 1;
  }
  throw new Error("niedomknięte wyrażenie od " + od);
}
function funkcja(plik, nazwa) {
  const src = czytaj(plik), i = src.indexOf("function " + nazwa + "(");
  if (i < 0) throw new Error(nazwa + " nie ma w " + plik);
  const od = src.slice(Math.max(0, i - 6), i) === "async " ? i - 6 : i;
  return src.slice(od, domknij(src, src.indexOf("{", src.indexOf(")", i)), false));
}
function stala(plik, nazwa) {
  const src = czytaj(plik), i = src.indexOf("const " + nazwa + "=");
  if (i < 0) throw new Error(nazwa + " nie ma w " + plik);
  return src.slice(i, domknij(src, i, true)).replace(/^const /, "var ");
}

const ctx = { console, Math, Number, JSON, Array, Object, Map, Set, String, DataView, ArrayBuffer, Uint8Array,
  Float32Array, Int16Array, WeakMap, Error, Infinity, isFinite, parseFloat, parseInt };
vm.createContext(ctx);
const run = kod => vm.runInContext(kod, ctx);

// ---- atrapy: w Node nie ma okna, przeglądarkowego base64 ani silnika dźwięku ----------------------
run(`var window=undefined,document=undefined,btoa=null,atob=null,fetch=undefined;
  var Glos={parsujWav:null},E=null;
  var L=function(pl){return pl;},RBJezyk=undefined;`);

try {
  // ---- glos.js: parser WAV i tablica próbek ------------------------------------------------------
  run(funkcja("glos.js", "parsujWav"));
  run(stala("glos.js", "PROBKI"));
  for (const f of ["ustawProbki", "usunProbki", "probkiDla", "probkiStan"]) run(funkcja("glos.js", f));
  run("Glos.parsujWav=parsujWav;");

  // ---- probki-audio.js: wspólna obróbka dźwięku panelu i gry -------------------------------------
  run(stala("probki-audio.js", "SR"));        // SR, MAKS_SEK, MIN_PROBEK jednym ciągiem
  run(stala("probki-audio.js", "SZCZYT"));
  run(stala("probki-audio.js", "ZJAZD"));     // ZJAZD, ZAPAS, MIN_PETLA, MAKS_ZLEP, MIN_WYCINEK
  for (const f of ["doWav", "zWav", "szczyt", "normalizuj", "granice", "wytnij", "wycinek", "wykryjRoot"])
    run(funkcja("probki-audio.js", f));

  // ---- studio-probki.js: nazwa zestawu w silniku (nastawy → odcisk) ------------------------------
  // Prawdziwe funkcje, nie kopia: po nazwie zestawu silnik trzyma bufory, a Studio liczy, które jeszcze żyją.
  for (const s of ["nazwaZestawu", "domyslna"]) run(stala("studio-probki.js", s));
  for (const f of ["odcisk", "nazwaEdycji"]) run(funkcja("studio-probki.js", f));
  run(`var StudioProbki={nazwaZestawu:nazwaZestawu,nazwaEdycji:nazwaEdycji,
    zarejestrujEdycje:function(id,e){return nazwaEdycji(id,e);}};`);   // bez bajtów: nazwa wraca, nic się nie rejestruje

  // ---- studio.js: parametry formularza → receptura -------------------------------------------------
  for (const s of ["DOMYSLNE", "ZAKRESY", "FALE", "WYBORY", "OBRAZ_BOK", "maProbke", "probkaSek"]) run(stala("studio.js", s));
  for (const f of ["obrazOk", "probkaOk", "edycjaProbki", "wycinekProbki", "swiezy", "migruj", "recepta", "oczysc"])
    run(funkcja("studio.js", f));

  // ============ 1. WAV PCM16 mono w obie strony ====================================================
  const sr = 32000;
  run(`var _n=Math.round(${sr}*0.3), _d=new Float32Array(_n);
    for(var i=0;i<_n;i++)_d[i]=Math.sin(2*Math.PI*440*i/${sr})*0.8;
    var _ab=doWav({dane:_d,sr:${sr}}), _w=parsujWav(_ab);`);
  ck("WAV: nagłówek ma 44 bajty, dane PCM16", run("_ab.byteLength===44+_n*2"), run("_ab.byteLength"));
  ck("WAV: częstotliwość i długość wracają z parsera gry", run("_w&&_w.sr===" + sr + "&&_w.dane.length===_n"),
    run("JSON.stringify(_w?{sr:_w.sr,len:_w.dane.length}:null)"));
  ck("WAV: próbki wracają z błędem najwyżej jednego kroku PCM16",
    run("(function(){var m=0;for(var i=0;i<_n;i++)m=Math.max(m,Math.abs(_w.dane[i]-_d[i]));return m<1/32767*1.5;})()"),
    run("(function(){var m=0;for(var i=0;i<_n;i++)m=Math.max(m,Math.abs(_w.dane[i]-_d[i]));return m;})()"));
  ck("WAV: wartości poza −1..1 są obcinane, nie zawijane",
    run(`(function(){var d=new Float32Array([2,-2,0]),w=parsujWav(doWav({dane:d,sr:${sr}}));
      return w.dane[0]>0.99&&w.dane[1]<-0.99;})()`));
  // Dwa parsery z rozmysłem: glos.js czyta próbki z web/assets/ sam (pomiar dźwięku gry ładuje go w izolacji),
  // a panel nie ładuje glos.js wcale. Ten test jest po to, żeby nie zaczęły czytać inaczej.
  ck("WAV: parser wspólny (probki-audio.js) i parser gry (glos.js) czytają te same bajty tak samo",
    run(`(function(){var a=zWav(_ab),b=parsujWav(_ab);
      if(!a||!b||a.sr!==b.sr||a.dane.length!==b.dane.length)return false;
      for(var i=0;i<a.dane.length;i++)if(a.dane[i]!==b.dane[i])return false;return true;})()`));
  ck("WAV: śmieci zamiast nagłówka nie udają próbki",
    run("zWav(new ArrayBuffer(0))===null&&zWav(new Uint8Array([1,2,3,4,5,6,7,8,9,10,11,12,13,14]).buffer)===null"));

  // ============ 2. bajty: pełna skala i granice ciszy ==============================================
  // 10-20: bajty są święte. Zapis idzie na pełną skalę (PCM16 ma 16 bitów na całość, więc cicho nagrana
  // próbka zapisana „jak jest” traciłaby rozdzielczość bezpowrotnie), a CISZA Z BRZEGÓW NIE JEST CIĘTA —
  // wraca jako para indeksów na znaczniki wycinka, które człowiek może przesunąć z powrotem.
  // Dźwięk 0,2 s w ciszy 0,25 s z każdej strony, nagrany cicho (szczyt 0,25).
  run(`var _cisza=Math.round(${sr}*0.25), _dzw=Math.round(${sr}*0.2);
    var _z=new Float32Array(_cisza*2+_dzw);
    for(var i=0;i<_dzw;i++)_z[_cisza+i]=Math.sin(2*Math.PI*220*i/${sr})*0.25;
    var _n2=normalizuj(_z,${sr}), _gr=granice(_z,${sr});`);
  ck("bajty: zapis idzie na pełną skalę (szczyt 0,9), żeby PCM16 nie tracił rozdzielczości",
    run("_n2&&Math.abs(szczyt(_n2.dane,0,_n2.dane.length)-0.9)<0.02"),
    run("_n2?szczyt(_n2.dane,0,_n2.dane.length):'null'"));
  ck("bajty: szczyt ORYGINAŁU wraca osobno (z niego liczy się poziom „zostaw jak jest”)",
    run("_n2&&Math.abs(_n2.szczyt-0.25)<0.01"), run("_n2?_n2.szczyt:'null'"));
  ck("bajty: długość zostaje nietknięta (cisza to sprawa znaczników, nie bajtów)",
    run("_n2&&_n2.dane.length===_z.length"), run("_n2?_n2.dane.length+'/'+_z.length:'null'"));
  ck("bajty: sama cisza zwraca null (nie ma czego zapisać)",
    run(`normalizuj(new Float32Array(1000),${sr})===null`));
  ck("bajty: za krótki dźwięk zwraca null",
    run(`(function(){var d=new Float32Array(500);d[250]=0.9;return normalizuj(d,${sr})===null;})()`));
  ck("granice ciszy: znaczniki trafiają na dźwięk z zapasem, a nie na całość",
    run("_gr&&_gr.od>_cisza*0.6&&_gr.od<=_cisza&&_gr.koniec>=_cisza+_dzw&&_gr.koniec<_z.length-_cisza*0.6"),
    run("_gr?_gr.od+'..'+_gr.koniec+' z '+_z.length:'null'"));
  ck("granice ciszy: w samej ciszy nie ma czego zaznaczyć", run(`granice(new Float32Array(${sr}),${sr})===null`));

  // ============ 2b. wycinek, poziom, kierunek i zlepek pętli =======================================
  // Jedno miejsce, w którym nastawy człowieka zamieniają się w próbki do zagrania: pomyłka tutaj znaczy
  // instrument grający nie ten kawałek, który pokazuje przebieg.
  run(`var _dl=${sr}, _p=new Float32Array(_dl);
    for(var i=0;i<_dl;i++)_p[i]=Math.sin(2*Math.PI*100*i/${sr})*0.8;   // 1 s, 100 Hz, szczyt 0,8
    var _pr={dane:_p,sr:${sr}};
    var _calosc=wytnij(_pr,{}), _pol=wytnij(_pr,{od:0.25,koniec:0.75});`);
  ck("wycinek: bez nastaw wraca cała próbka", run("_calosc&&_calosc.dane.length===_dl&&_calosc.petla===null"),
    run("_calosc?_calosc.dane.length:'null'"));
  ck("wycinek: od 0,25 s do 0,75 s to połowa długości", run("Math.abs(_pol.dane.length-_dl/2)<=2"), run("_pol.dane.length"));
  ck("wycinek: `koniec` mniejszy od `od` znaczy „do końca”, nie bufor zerowej długości",
    run("wytnij(_pr,{od:0.5,koniec:0.1}).dane.length===Math.round(_dl*0.5)"),
    run("wytnij(_pr,{od:0.5,koniec:0.1}).dane.length"));
  ck("wycinek: znaczniki zjechane na siebie (poniżej 2 ms) biorą całość, nie nic",
    run("wytnij(_pr,{od:0.5,koniec:0.5001}).dane.length===_dl"), run("wytnij(_pr,{od:0.5,koniec:0.5001}).dane.length"));
  ck("wycinek: brzegi zjeżdżają do zera (cięcie w połowie fali to trzask na starcie nuty)",
    run("Math.abs(_pol.dane[0])<0.02&&Math.abs(_pol.dane[_pol.dane.length-1])<0.02"),
    run("[_pol.dane[0],_pol.dane[_pol.dane.length-1]].join(' ')"));
  ck("poziom: 0,5× ścisza o połowę, 1,5× podbija (bez obcinania do ±1 — o resztę dba tor dźwięku)",
    run(`(function(){var a=wytnij(_pr,{poziom:0.5}),b=wytnij(_pr,{poziom:1.5});
      return Math.abs(szczyt(a.dane,0,a.dane.length)-0.4)<0.02&&Math.abs(szczyt(b.dane,0,b.dane.length)-1.2)<0.02;})()`),
    run(`(function(){var a=wytnij(_pr,{poziom:0.5}),b=wytnij(_pr,{poziom:1.5});
      return szczyt(a.dane,0,a.dane.length)+' / '+szczyt(b.dane,0,b.dane.length);})()`));
  run(`var _ramp=new Float32Array(_dl);for(var i=0;i<_dl;i++)_ramp[i]=i/_dl*0.8+0.1;
    var _w=wytnij({dane:_ramp,sr:${sr}},{wstecz:true});`);
  ck("wstecz: próbka rosnąca wychodzi malejąca",
    run("_w.dane[Math.round(_dl*0.2)]>_w.dane[Math.round(_dl*0.8)]"),
    run("[_w.dane[Math.round(_dl*0.2)],_w.dane[Math.round(_dl*0.8)]].join(' ')"));
  ck("wstecz: pętla jest odbita razem z dźwiękiem (koniec staje się początkiem)",
    run(`(function(){var r=wytnij(_pr,{wstecz:true,petla:[0.1,0.3]});
      return r.petla&&Math.abs(r.petla[0]-0.7)<0.01&&Math.abs(r.petla[1]-0.9)<0.01;})()`),
    run(`JSON.stringify(wytnij(_pr,{wstecz:true,petla:[0.1,0.3]}).petla)`));
  ck("pętla: liczona względem WYCINKA, bo to on jest buforem silnika",
    run(`(function(){var r=wytnij(_pr,{od:0.2,koniec:0.8,petla:[0.3,0.5]});
      return r.petla&&Math.abs(r.petla[0]-0.1)<0.01&&Math.abs(r.petla[1]-0.3)<0.01;})()`),
    run(`JSON.stringify(wytnij(_pr,{od:0.2,koniec:0.8,petla:[0.3,0.5]}).petla)`));
  ck("pętla: krótsza niż 5 ms nie jest pętlą (źródło kręciłoby się na trzasku)",
    run("wytnij(_pr,{petla:[0.5,0.502]}).petla===null"), run(`JSON.stringify(wytnij(_pr,{petla:[0.5,0.502]}).petla)`));
  ck("pętla: bez pętli zjeżdża też KONIEC bufora, z pętlą już nie (tam zjazd ściszałby pętlę)",
    run("wytnij(_pr,{}).dane[_dl-1]===0&&wytnij(_pr,{petla:[0.2,0.8]}).dane[_dl-1]===_p[_dl-1]"),
    run("[wytnij(_pr,{}).dane[_dl-1],wytnij(_pr,{petla:[0.2,0.8]}).dane[_dl-1],_p[_dl-1]].join(' ')"));
  // Zlepek: po nim próbka na końcu pętli ma być prawie równa tej przed jej początkiem, więc skok z końca
  // na początek jest ciągły. Mierzymy sam skok: |out[ib-1] − out[ia]| bez zlepka i ze zlepkiem.
  run(`var _sk=function(zlep){
      var r=wytnij(_pr,{petla:[0.1703,0.6411],zlep:zlep});
      var ia=Math.round(r.petla[0]*${sr}),ib=Math.round(r.petla[1]*${sr});
      return Math.abs(r.dane[ib-1]-r.dane[ia]);};
    var _bezZlep=_sk(0), _zeZlep=_sk(0.02);`);
  ck("zlepek: szew pętli po zlepieniu skacze wyraźnie mniej niż bez niego",
    run("_zeZlep<_bezZlep*0.25"), "bez: " + run("_bezZlep") + " ze: " + run("_zeZlep"));
  ck("zlepek: nie dotyka tego, co PRZED początkiem pętli (wejście nuty zostaje jak było)",
    run(`(function(){var a=wytnij(_pr,{petla:[0.2,0.8],zlep:0}),b=wytnij(_pr,{petla:[0.2,0.8],zlep:0.02});
      var ia=Math.round(0.2*${sr});
      for(var i=0;i<ia;i++)if(Math.abs(a.dane[i]-b.dane[i])>1e-6)return false;
      return true;})()`));
  ck("zlepek: dłuższy niż początek pętli albo niż jej połowa jest przycinany, nie czyta spod zera",
    run(`(function(){var r=wytnij(_pr,{petla:[0.004,0.02],zlep:0.2});return !!r&&r.dane.length===_dl;})()`));
  ck("przytnij na stałe: z bajtów zostaje sam wycinek",
    run(`(function(){var t=wycinek(_pr,{od:0.25,koniec:0.75});
      return t&&Math.abs(t.dane.length-_dl/2)<=2&&t.sr===${sr};})()`),
    run(`(function(){var t=wycinek(_pr,{od:0.25,koniec:0.75});return t?t.dane.length:null;})()`));
  ck("przytnij na stałe: wycinek równy całości to null (nie ma czego przycinać)",
    run("wycinek(_pr,{})===null&&wycinek(_pr,{od:0,koniec:1})===null"));
  ck("przytnij na stałe: wycinek krótszy niż 600 próbek to null (zostałby trzask)",
    run("wycinek(_pr,{od:0.5,koniec:0.505})===null"));

  // ============ 3. wykrycie stroju =================================================================
  const nuty = [[110, 45], [220, 57], [440, 69], [880, 81]];
  for (const [hz, midi] of nuty) {
    const r = run(`(function(){var n=Math.round(${sr}*0.4),d=new Float32Array(n);
      for(var i=0;i<n;i++)d[i]=(((i*${hz}/${sr})%1)*2-1)*0.6;
      return wykryjRoot(d,${sr});})()`);
    ck("strój: piła " + hz + " Hz → półton " + midi, r !== null && Math.abs(r - midi) < 0.6, r);
  }
  ck("strój: szum nie ma wysokości → null",
    run(`(function(){var n=Math.round(${sr}*0.4),d=new Float32Array(n),x=12345;
      for(var i=0;i<n;i++){x=(Math.imul(x,1103515245)+12345)>>>0;d[i]=((x>>>8)/8388608-1)*0.6;}
      return wykryjRoot(d,${sr});})()`) === null);
  ck("strój: cisza → null", run(`wykryjRoot(new Float32Array(Math.round(${sr}*0.3)),${sr})===null`));

  // ============ 4. tablica próbek w silniku ========================================================
  run(`var _kt=function(){return {createBuffer:function(ch,len,s){var d=new Float32Array(len);
      return {length:len,sampleRate:s,copyToChannel:function(src){d.set(src);},dane:d};}};};
    var _c1=_kt(),_c2=_kt();
    ustawProbki("u-test",[{sr:${sr},dane:new Float32Array(100),root:60,petla:null}]);`);
  ck("silnik: zestaw gracza trafia do tej samej tablicy co próbki z web/assets",
    run("probkiStan()['u-test'] && probkiStan()['u-test'].ile===1"), run("JSON.stringify(probkiStan())"));
  ck("silnik: bufory liczą się osobno dla każdego kontekstu",
    run("probkiDla(_c1,'u-test')!==probkiDla(_c2,'u-test')&&probkiDla(_c1,'u-test')[0].buf.length===100"));
  ck("silnik: drugie pytanie o ten sam kontekst nie liczy buforów od nowa",
    run("probkiDla(_c1,'u-test')===probkiDla(_c1,'u-test')"));
  run(`var _stare=probkiDla(_c1,"u-test");
    ustawProbki("u-test",[{sr:${sr},dane:new Float32Array(250),root:72,petla:[0.1,0.2]}]);`);
  ck("silnik: podmiana próbki (ponowne nagranie) unieważnia stare bufory",
    run("probkiDla(_c1,'u-test')!==_stare&&probkiDla(_c1,'u-test')[0].buf.length===250"),
    run("probkiDla(_c1,'u-test')[0].buf.length"));
  ck("silnik: `wersja` rośnie przy podmianie", run("probkiStan()['u-test'].wersja===2"), run("probkiStan()['u-test'].wersja"));
  ck("silnik: pusta lista nie zostawia martwego wpisu",
    run("ustawProbki('u-puste',[])===false&&!probkiStan()['u-puste']"));
  ck("silnik: usunięcie znika z tablicy i z pytania o bufory",
    run("(usunProbki('u-test'),probkiDla(_c1,'u-test')===null&&!probkiStan()['u-test'])"));
  // 10-20: każda nastawa wycinka to osobna nazwa zestawu, więc nazwy PRZYCHODZĄ I ODCHODZĄ. Usunięcie musi
  // oddać też AudioBuffery — i to nie tylko dla pamięci: po usunięciu `wersja` startuje od 1, więc zestaw
  // o tej samej nazwie trafiłby na klucz „nazwa#1” zostawiony przez poprzednika i zagrałby JEGO dźwiękiem.
  ck("silnik: zestaw o tej samej nazwie po usunięciu nie dziedziczy buforów poprzednika",
    run(`(function(){
      ustawProbki("u-ciete",[{sr:${sr},dane:new Float32Array(400),root:60,petla:null}]);
      if(probkiDla(_c1,"u-ciete")[0].buf.length!==400)return false;
      usunProbki("u-ciete");
      ustawProbki("u-ciete",[{sr:${sr},dane:new Float32Array(900),root:60,petla:null}]);
      return probkiStan()["u-ciete"].wersja===1&&probkiDla(_c1,"u-ciete")[0].buf.length===900;})()`),
    run(`(function(){var l=probkiDla(_c1,"u-ciete");return l?l[0].buf.length:"null";})()`));

  // ============ 5. receptura ze Studia =============================================================
  // 10-20: receptura niesie TYLKO to, co nie dotyka bajtów — strój z dostrojeniem wtopionym w półtony albo
  // „nie przestrajaj”. Wycinek, poziom, kierunek i pętla ze zlepkiem siedzą w BAJTACH zestawu, więc widać je
  // po nazwie (`probki`), a nie po osobnych kluczach.
  run(`var _bez=recepta({}),
      _raz=recepta({probka:{id:"s-abc123",sr:${sr},dl:${sr},zrodlo:"plik"},probkaRoot:64,probkaPetla:false}),
      _cent=recepta({probka:{id:"s-abc123",sr:${sr},dl:${sr},zrodlo:"plik"},probkaRoot:48.5,probkaCent:-25}),
      _staly=recepta({probka:{id:"s-abc123",sr:${sr},dl:${sr},zrodlo:"plik"},probkaRoot:64,probkaStaly:true}),
      _wyc=recepta({probka:{id:"s-abc123",sr:${sr},dl:${sr},zrodlo:"plik"},probkaStart:25,probkaKoniec:75});`);
  ck("receptura: instrument bez próbki nie dostaje ani jednego nowego klucza",
    run("!('probki' in _bez)&&!('probkaRoot' in _bez)&&!('probkaPetla' in _bez)&&!('probkaStaly' in _bez)"),
    run("JSON.stringify(_bez)"));
  ck("receptura: nastawy domyślne = goły „u-<id>”, czyli to samo, co instrumenty sprzed tej zmiany",
    run("_raz.probki==='u-s-abc123'"), run("_raz.probki"));
  ck("receptura: pętli NIE MA w recepturze (jest w bajtach, razem ze zlepkiem szwu)",
    run("!('probkaPetla' in _raz)&&_raz.probkaRoot===64"), run("JSON.stringify([_raz.probkaRoot,_raz.probkaPetla])"));
  ck("receptura: dostrojenie w centach wtapia się w strój (silnik zna tylko ułamkowe półtony)",
    run("Math.abs(_cent.probkaRoot-48.25)<1e-9"), run("_cent.probkaRoot"));
  ck("receptura: „nie przestrajaj” zamiast stroju, nie obok niego",
    run("_staly.probkaStaly===true&&!('probkaRoot' in _staly)"), run("JSON.stringify(_staly)"));
  ck("receptura: wycinek zmienia NAZWĘ zestawu (dwa instrumenty na tych samych bajtach nie dzielą buforów)",
    run("_wyc.probki!==_raz.probki&&_wyc.probki.indexOf('u-s-abc123-')===0"), run("_wyc.probki"));
  ck("receptura: ta sama nastawa daje tę samą nazwę przy każdym uruchomieniu (odcisk, nie licznik)",
    run(`recepta({probka:{id:"s-abc123",sr:${sr},dl:${sr}},probkaStart:25,probkaKoniec:75}).probki===_wyc.probki`));
  ck("nastawy: wycinek liczony z procentów nagrania, a „do końca” zostaje zerem",
    run(`(function(){var e=edycjaProbki({probka:{id:"s-a",sr:${sr},dl:${sr*2}},probkaStart:25,probkaKoniec:100});
      return Math.abs(e.od-0.5)<1e-6&&e.koniec===0;})()`),
    run(`JSON.stringify(edycjaProbki({probka:{id:"s-a",sr:${sr},dl:${sr*2}},probkaStart:25,probkaKoniec:100}))`));
  ck("nastawy: pętla i zlepek wchodzą tylko przy zapętleniu, w sekundach",
    run(`(function(){var q={probka:{id:"s-a",sr:${sr},dl:${sr*2}},probkaPetla:true,probkaOd:25,probkaDo:75,probkaZlep:20};
      var e=edycjaProbki(q),b=edycjaProbki(Object.assign({},q,{probkaPetla:false}));
      return e.petla&&Math.abs(e.petla[0]-0.5)<1e-3&&Math.abs(e.petla[1]-1.5)<1e-3
        &&Math.abs(e.zlep-0.02)<1e-6&&b.petla===null&&b.zlep===0;})()`),
    run(`JSON.stringify(edycjaProbki({probka:{id:"s-a",sr:${sr},dl:${sr*2}},probkaPetla:true,probkaOd:25,probkaDo:75,probkaZlep:20}))`));
  ck("nastawy: koniec pętli przed jej początkiem jest prostowany, nie wysyłany do silnika",
    run(`(function(){var e=edycjaProbki({probka:{id:"s-a",sr:${sr},dl:${sr}},probkaPetla:true,probkaOd:80,probkaDo:10});
      return e.petla&&e.petla[1]>e.petla[0];})()`),
    run(`JSON.stringify(edycjaProbki({probka:{id:"s-a",sr:${sr},dl:${sr}},probkaPetla:true,probkaOd:80,probkaDo:10}).petla)`));
  ck("nastawy: poziom w procentach wychodzi mnożnikiem", run(`(function(){
      return edycjaProbki({probka:{id:"s-a",sr:${sr},dl:${sr}},probkaPoziom:150}).poziom===1.5
        &&edycjaProbki({probka:{id:"s-a",sr:${sr},dl:${sr}}}).poziom===1;})()`));
  ck("nastawy: wycinek w sekundach rozwija „do końca” na długość nagrania",
    run(`(function(){var w=wycinekProbki({probka:{id:"s-a",sr:${sr},dl:${sr*2}},probkaStart:25,probkaKoniec:100});
      return Math.abs(w.a-0.5)<1e-6&&Math.abs(w.b-2)<1e-6&&Math.abs(w.sek-2)<1e-6;})()`),
    run(`JSON.stringify(wycinekProbki({probka:{id:"s-a",sr:${sr},dl:${sr*2}},probkaStart:25,probkaKoniec:100}))`));
  ck("receptura: próbka ma własne wyrównanie głośności (szczyt 0,9, nie fala)",
    run("Math.abs(_raz.glosnosc-1.25)<1e-9&&Math.abs(_bez.glosnosc-1)<1e-9"),
    run("JSON.stringify([_raz.glosnosc,_bez.glosnosc])"));
  ck("receptura: wąski filtr podbija próbkę tak samo jak falę",
    run(`Math.abs(recepta({filtr:"bandpass",probka:{id:"s-a",sr:${sr},dl:100},probkaRoot:60}).glosnosc-1.25*2.4)<1e-9`));

  // ============ 6. zapis, kopia i plik =============================================================
  run(`var _p1=swiezy({probka:{id:"s-kopia1",sr:${sr},dl:5000,zrodlo:"mikrofon"}}),_p2=swiezy(_p1);`);
  ck("zapis: `probka` jest kopiowana, nie współdzielona (kopia instrumentu nie rusza pierwowzoru)",
    run("_p1.probka!==_p2.probka&&_p1.probka.id===_p2.probka.id"));
  ck("zapis: nie-próbka (zły id, brak długości) nie przechodzi przez swiezy()",
    run(`swiezy({probka:{id:"../zly",sr:${sr},dl:10}}).probka===null&&swiezy({probka:{id:"s-ok",sr:${sr}}}).probka===null
      &&swiezy({probka:"s-ok"}).probka===null&&swiezy({probka:[1,2]}).probka===null`));
  ck("plik: próbka z pliku przechodzi przez oczysc(), a nieznane źródło staje się „plik”",
    run(`(function(){var q=oczysc({probka:{id:"s-zpliku",sr:${sr},dl:1234,zrodlo:"gdzies"}});
      return q.probka&&q.probka.id==="s-zpliku"&&q.probka.dl===1234&&q.probka.zrodlo==="plik";})()`),
    run(`JSON.stringify(oczysc({probka:{id:"s-zpliku",sr:${sr},dl:1234,zrodlo:"gdzies"}}).probka)`));
  ck("plik: podrobiona próbka (id ze ścieżką, ujemna długość) jest odrzucana",
    run(`oczysc({probka:{id:"s-a/../b",sr:${sr},dl:10}}).probka===null
      &&oczysc({probka:{id:"s-ab",sr:${sr},dl:-5}}).probka===null`),
    run(`JSON.stringify([oczysc({probka:{id:"s-a/../b",sr:${sr},dl:10}}).probka,oczysc({probka:{id:"s-ab",sr:${sr},dl:-5}}).probka])`));
  ck("plik: strój i procenty pętli są przycinane do zakresów pokręteł",
    run(`(function(){var q=oczysc({probkaRoot:999,probkaOd:-50,probkaDo:500});
      return q.probkaRoot===ZAKRESY.probkaRoot[1]&&q.probkaOd===ZAKRESY.probkaOd[0]&&q.probkaDo===ZAKRESY.probkaDo[1];})()`),
    run(`JSON.stringify(oczysc({probkaRoot:999,probkaOd:-50,probkaDo:500}))`));
} catch (e) {
  ck("harness nie wywalił się", false, (e && e.stack ? e.stack : String(e)).slice(0, 600));
}
console.log(JSON.stringify({ checks }));
