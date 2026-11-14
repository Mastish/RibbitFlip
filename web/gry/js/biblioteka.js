"use strict";
// ===== ŻABI CHÓR: biblioteka piosenek =====
// Ekran „Zagraj: 1 Piosenka” (10-20: osobnego ekranu „Utwory” już nie ma, wszystko jest w kroku 1): piosenki wbudowane
// i „Moje” — JEDNO miejsce na wszystko, co gracz sam przyniósł: pliki z folderu, przeciągnięte, z adresu, ze
// schowka ORAZ utwory z pobranych paczek MIDI (pakiety.js). Do tego podgląd („Posłuchaj”) i szuflada „Ustawienia
// piosenki”. Wyszukiwarki bitmidi.com już nie ma (handoff pakietów MIDI, 2026-10-03: ryzyko praw autorskich).
// Każdy wpis niesie obiekt `licencja` (licencjaWpisu w pakiety.js), a karta pokazuje jego plakietkę. Napisy biorą się ze słownika T (zabi-chor.js),
// pomocniki DOM (h, el, tt, toast) i stan gry (S) też stamtąd: ten plik ładuje się po zabi-chor.js.
//
// FOLDER. Ta sama konwencja co w Keyboard Trenerze (ten sam autor): wskazany folder (np. „Scarborough
// Fair” na pulpicie) ma podfolder `piosenki/` z plikami .mid, więc trener i gra mają jedną bibliotekę.
// Gra dopisuje tam piosenki przeciągnięte na okno i pobrane z adresu, a parametry piosenek zapisuje
// w `dane/zabi-chor.json`. Pliku trenera `dane/keyboard-trener.json` nie czyta i nie pisze. Uchwyt
// folderu leży w IndexedDB (baza `zabi-chor`, klucz `dir`), bo przeglądarka przechowuje go tylko tam.
// Bez File System Access API (osadzona przeglądarka, Firefox) przyciski folderu znikają, reszta działa.
//
// PLIKI W CAŁOŚCI. Każdy plik MIDI zostaje w przeglądarce w całości (jak `b64` w trenerze), więc po zmianie
// analizatora piosenki przeliczają się same przy następnym wczytaniu. Bajty leżą w IndexedDB (magazyn
// `pliki`), a nie w localStorage: pod /web/gry/ gra ma to samo pochodzenie co panel RibbitFlip, a kilkadziesiąt
// plików w base64 zjadłoby panelowi jego kilka megabajtów localStorage. W localStorage zostaje spis piosenek
// i parametry (małe).
//
// RUCH. Wczytywanie to pasek-taśma („Wczytuję 3 z 12…”) i karty-szkielety, które zamieniają się w karty
// z przesunięciem w czasie; błąd to papierowa karteczka; szuflada wjeżdża z boku. 150–250 ms, bez odbić
// i bez migania; prefers-reduced-motion wyłącza animacje (gry.css).
//
// ZAKŁADKA „MOJE” TO JEDNO MIEJSCE: „Moje” scalone z „Paczki”, żeby gracz miał gotowy start i w jednym miejscu
// utwory zaimportowane w dowolny sposób. Osobna zakładka „Paczki” pokazywała utwory pobranej paczki
// jako wiersze drugiej kategorii: bez ♥, bez szuflady, poza licznikami „Wszystkie” i „Moje”, i stawały się
// piosenkami dopiero po kliknięciu. Dziś paczki stoją w „Moich” jako kafle do pobrania (headstart), a każdy
// pobrany utwór wchodzi do biblioteki sam, kolejką z taśmą postępu (Pakiety.doBiblioteki), i jest zwykłą kartą.
//
// ULUBIONE I SORTOWANIE (10-03, runda 3). ♥ na karcie przypina utwór (localStorage `ribbitflip.zabiChor.ulubione`,
// {wersja, ids}; nie w folderze, bo to upodobanie gracza). Zakładki: Wszystkie (domyślna), Wbudowane, Moje;
// obok segment „Sortuj” (S.ust.sortowanie: alfabet | ostatnio | najnowsze | ulubione | trudnosc, sortujUtwory). „Ostatnio grane”
// czyta `ribbitflip.zabiChor.ostatnioGrane` (id → czas ISO, zapis w zakonczGre przez Biblioteka.zagrano).
// Karta jest jedna na utwór (B.karty), więc zakładka „Wszystkie” POŻYCZA karty z ich list, a ulozKarty() je oddaje.
//
// USUWANIE (10-18, D-11). Karta własnego utworu (B.moje: przeciągnięty, z adresu, ze schowka, z folderu) ma kosz; wbudowane
// i utwory z paczek go nie mają. Pytanie w oknie gry (bibPytanie → pkOkno z pakiety.js, jak usuwanie paczki). Wyniki
// z tablicy (klucz midi:sha256:…), parametry i rekord zostają, więc ten sam plik dodany jeszcze raz wraca razem z nimi.
// Plik w folderze piosenki/ kasuje tylko osobne, drugie pytanie; zostawiony trafia do B.pominiete (spis), żeby skan
// folderu go nie przywrócił, a znika stamtąd, gdy pliku w folderze już nie ma albo ktoś doda go jeszcze raz.

const ZC_BIBLIO={KLUCZ:"ribbitflip.zabiChor.biblioteka",WERSJA:1,BAZA:"zabi-chor",PLIK_DANYCH:"zabi-chor.json",
  ZAPIS_MS:1500,STAGGER_MS:50,KLUCZ_ULUBIONE:"ribbitflip.zabiChor.ulubione",KLUCZ_OSTATNIO:"ribbitflip.zabiChor.ostatnioGrane",
  SORTOWANIA:["alfabet","trudnosc","ostatnio","najnowsze","ulubione"]};
const B={wpisy:new Map(),moje:[],parametry:{},filtr:"wbudowane",karty:new Map(),listy:{},dir:null,dirOk:false,
  pp:{partia:0,glowica:0,zPodkladem:true,gracz:null,piosenka:null,mysz:null,duzy:false,przesun:0,cel:0,reczny:0,
    ciag:null,mapaCiag:null,jedzie:false,przeciagniete:false,numery:[]},
  dirPlikow:0,skanuje:false,ladowanie:0,podglad:null,szuflada:null,zapisT:0,zbudowana:false,ulubione:[],filtr:"wszystkie",
  piosenkiPakietow:[],   // id wpisów z pakietów piosenek z audio (pakiet-piosenki.js), karty w „Moje”
  zPaczek:[],   // id wpisów z pobranych paczek MIDI (pakiety.js), też karty w „Moje”
  pominiete:[]};   // usunięte z biblioteki, a zostawione w folderze: {id, plik, hash (SHA-256), folder}; skan ich nie wczytuje
// Wszystko, co stoi w zakładce „Moje”: własne pliki, utwory paczek piosenek z audio i utwory paczek MIDI.
const mojeId=()=>B.moje.map(x=>x.id).concat(B.piosenkiPakietow,B.zPaczek);

// ---------------------------------------------------------------------------------------------
// CZYSTE FUNKCJE (testy: tests/gry_zabi_chor_harness.mjs)
// Ulubione: lista id bez powtórzeń; przełączenie dopisuje na koniec albo usuwa (nowa tablica, wejście bez zmian).
function przelaczUlubione(lista,id){
  const l=[];for(const x of Array.isArray(lista)?lista:[])if(typeof x==="string"&&x&&!l.includes(x))l.push(x);
  if(typeof id!=="string"||!id)return l;
  return l.includes(id)?l.filter(x=>x!==id):l.concat(id);
}
// Ulubione na górę, reszta w dotychczasowej kolejności (sortowanie stabilne, wejście bez zmian). `klucz` wyciąga id
// z pozycji (domyślnie: napis to id, obiekt ma pole id); pozycja bez id nie jest ulubiona.
function sortujZUlubionymi(wpisy,ulubione,klucz){
  const u=new Set(Array.isArray(ulubione)?ulubione:[]);
  const id=typeof klucz==="function"?klucz:(w=>typeof w==="string"?w:(w&&w.id));
  return (Array.isArray(wpisy)?wpisy:[]).map((w,i)=>({w,i,ul:u.has(id(w))?1:0}))
    .sort((a,b)=>(b.ul-a.ul)||(a.i-b.i)).map(x=>x.w);
}
// Sortowanie utworów (runda 3): wpisy {id, tytul, dodano (ms albo brak), kolejnosc (wbudowane)}.
//   alfabet   tytuł po polsku (localeCompare „pl”, bez wielkości liter),
//   ostatnio  czas ostatniej gry malejąco (`ostatnioGrane`: id → ISO), nigdy niegrane na końcu alfabetycznie,
//   najnowsze czas dodania malejąco, bez czasu (wbudowane) na końcu w kolejności listy,
//   ulubione  ulubione na górze, w obu grupach alfabetycznie,
//   trudnosc  od najłatwiejszych do najtrudniejszych (pole `trudnosc` = ocena melodii 0–10), bez oceny na końcu.
// Remis zawsze alfabetycznie (potem id), więc wynik nie zależy od kolejności wejścia. Wejście bez zmian.
function sortujUtwory(wpisy,tryb,o){
  o=o||{};const ul=new Set(Array.isArray(o.ulubione)?o.ulubione:[]),og=o.ostatnioGrane&&typeof o.ostatnioGrane==="object"?o.ostatnioGrane:{};
  const alfa=(a,b)=>String(a.tytul||"").localeCompare(String(b.tytul||""),"pl",{sensitivity:"base"})||(String(a.id)<String(b.id)?-1:String(a.id)>String(b.id)?1:0);
  let cmp=alfa;
  if(tryb==="ulubione")cmp=(a,b)=>((ul.has(b.id)?1:0)-(ul.has(a.id)?1:0))||alfa(a,b);
  else if(tryb==="ostatnio")cmp=(a,b)=>{const x=String(og[a.id]||""),y=String(og[b.id]||"");
    if(x!==y){if(!x)return 1;if(!y)return -1;return x<y?1:-1;}return alfa(a,b);};
  else if(tryb==="najnowsze")cmp=(a,b)=>{const x=+a.dodano||0,y=+b.dodano||0;if(x!==y)return y-x;
    if(!x&&Number.isFinite(a.kolejnosc)&&Number.isFinite(b.kolejnosc)&&a.kolejnosc!==b.kolejnosc)return a.kolejnosc-b.kolejnosc;return alfa(a,b);};
  else if(tryb==="trudnosc")cmp=(a,b)=>{const x=Number.isFinite(a.trudnosc)?a.trudnosc:Infinity,y=Number.isFinite(b.trudnosc)?b.trudnosc:Infinity;
    return x!==y?x-y:alfa(a,b);};
  return (Array.isArray(wpisy)?wpisy:[]).filter(w=>w&&w.id!=null).slice().sort(cmp);
}
// Zapis ulubionych z localStorage: {wersja:1, ids:[…]}; cokolwiek innego (stary, zepsuty, obcy zapis) = pusta lista.
function odczytajUlubione(tekst){
  try{const z=JSON.parse(tekst||"null");return z&&z.wersja===1&&Array.isArray(z.ids)?przelaczUlubione(z.ids,null):[];}
  catch(e){return [];}
}
// Usunięty utwór (10-18, D-11): wybór i fokus idą na sąsiada z listy, którą widać: następny, a za ostatnim poprzedni.
// Brak utworu na liście albo jedyny na liście = null (wtedy pierwszy utwór gry).
function sasiedniUtwor(ids,id){
  const l=Array.isArray(ids)?ids:[],i=l.indexOf(id);
  if(i<0)return null;
  return i+1<l.length?l[i+1]:i>0?l[i-1]:null;
}
function tytulZNazwyPliku(nazwa){
  return String(nazwa||"MIDI").replace(/\.(mid|midi)$/i,"").replace(/_+/g," ").trim()||"MIDI";
}
// Id piosenki z pliku: znormalizowana nazwa (jak w parseMidiFile) i 6 znaków skrótu bajtów (jak w
// zrodloZPliku). Bez bajtów sama nazwa, czyli id sprzed rundy 3b (takie przenosimy przy wczytaniu).
function idZNazwyPliku(nazwa,buf){
  const id="midi-"+tytulZNazwyPliku(nazwa).toLowerCase().replace(/[^a-z0-9ąćęłńóśźż]+/g,"-").slice(0,40);
  return buf?id+"-"+skrotBajtow(buf):id;
}
// Nazwa do zapisu w piosenki/: bez ścieżek i znaków, których Windows nie przyjmie, zawsze z .mid.
function nazwaPlikuDoZapisu(nazwa){
  let n=String(nazwa||"").replace(/[\\/:*?\x22<>|\u0000-\u001f]+/g," ").replace(/\s+/g," ").trim().slice(0,80)||"piosenka";
  if(!/\.midi?$/i.test(n))n+=".mid";
  return n;
}
// Parametry piosenek: mapa id → parametry z chwilą zmiany. Przy scalaniu z plikiem w folderze wygrywa nowszy.
function zapiszParametryWpisu(mapa,id,par,teraz){
  const m=Object.assign({},mapa||{}),p=Object.assign({},par||{});delete p.zmieniono;
  m[id]=Object.assign(p,{zmieniono:teraz||Date.now()});
  return m;
}
function scalParametry(lokalne,zFolderu){
  const out=Object.assign({},lokalne||{});
  for(const id of Object.keys(zFolderu||{})){
    const f=zFolderu[id];if(!f||typeof f!=="object")continue;
    const l=out[id];if(!l||(+f.zmieniono||0)>(+l.zmieniono||0))out[id]=Object.assign({},f);
  }
  return out;
}
function daneDoFolderu(mapa){return {gra:"zabi-chor",wersja:ZC_BIBLIO.WERSJA,parametry:mapa||{}};}
// Podgląd partii (prawa kolumna lobby): takt, w którym partia wchodzi (od 1), takt pod kliknięciem
// w rolkę, zakres nut i dłuższe pauzy (od 2 taktów), które na rolce da się kliknąć.
function taktWejscia(nuty,metrum){return nuty&&nuty.length?Math.floor(nuty[0].t/metrum+1e-9)+1:null;}
function klikNaTakt(x,szer,pad,koniec,metrum){
  const b=(x-pad)/Math.max(1,szer-2*pad)*Math.max(1e-9,koniec),takty=Math.max(1,Math.ceil(koniec/metrum-1e-9));
  return Math.max(1,Math.min(takty,Math.floor(b/metrum+1e-9)+1));
}
function zakresPartii(nuty){
  if(!nuty||!nuty.length)return null;
  let lo=Infinity,hi=-Infinity;for(const n of nuty){if(n.m<lo)lo=n.m;if(n.m>hi)hi=n.m;}
  return {lo,hi,tekst:noteName(lo)+"–"+noteName(hi)};
}
function pauzyPartii(nuty,metrum,koniec){
  const out=[],min=2*metrum;
  for(let i=1;i<nuty.length;i++){const od=nuty[i-1].t+nuty[i-1].d,doB=nuty[i].t;if(doB-od>=min-1e-9)out.push({od,do:doB});}
  if(nuty.length){const ost=nuty[nuty.length-1],od=ost.t+ost.d;if(koniec-od>=min-1e-9)out.push({od,do:koniec});}
  return out;
}
// Notka pod wyborem partii na karcie gracza: „wchodzi w takcie 9 · 42 nuty · zakres G3–E5” (takt piosenki,
// także przy fragmencie).
function notkaPartii(partia,metrum,frag){
  if(!partia||!partia.nuty.length)return "";
  const n=partia.nuty.length,z=zakresPartii(partia.nuty);
  return tt("notkaPartii",{takt:taktPiosenki(taktWejscia(partia.nuty,metrum),frag),nuty:n+" "+odmiana(n,T.nuta1,T.nuta2,T.nuta5),zakres:z.tekst});
}
// Takt rolki (od 1, z powtórkami fragmentu) → takt piosenki: fragment 3–5 ×2 to na rolce 6 taktów,
// a w piosence 3 4 5 3 4 5.
function taktPiosenki(k,frag){
  if(!frag||frag.caly)return k;
  const dl=Math.max(1,frag.do-frag.od+1);
  return frag.od+((Math.max(1,k)-1)%dl);
}
// Geometria rolki podglądu partii. Mały widok: cała piosenka w szerokości. Powiększony: co najmniej
// ZC_PP_TAKT_MIN px na takt (docelowo ZC_PP_PX_CWIERC px na ćwierćnutę), chyba że piosenka i tak mieści
// się w szerokości prawie tak gęsto (wtedy bez przewijania). Zwraca px na ćwierćnutę, pełną szerokość
// treści i największe przesunięcie przewijania.
const ZC_PP_TAKT_MIN=16,ZC_PP_PX_CWIERC=8,ZC_PP_PAD=4;
function geometriaRolki(szer,koniec,metrum,duza){
  const pad=ZC_PP_PAD,k=Math.max(1e-9,koniec);
  let px=Math.max(1,szer-2*pad)/k;
  if(duza){const cel=Math.max(ZC_PP_TAKT_MIN/metrum,ZC_PP_PX_CWIERC);if(px<cel*.75||px*metrum<ZC_PP_TAKT_MIN)px=cel;}
  const pelna=2*pad+k*px;
  return {pad,px,naTakt:px*metrum,pelna,maks:Math.max(0,pelna-szer)};
}
// Numery taktów na rolce: takty piosenki (przy powtórce fragmentu znowu od jego początku), na początku
// każdego przejścia i co krok taktów (1, 2, 4, 8…), tak żeby napisy się nie stykały. [{k: takt rolki od 0, n}]
function numeryTaktow(takty,naTakt,szerNumeru,frag){
  const odstep=Math.max(szerNumeru+6,22),dl=frag&&!frag.caly?Math.max(1,frag.do-frag.od+1):0,out=[];
  let krok=1;while(krok*naTakt<odstep&&krok<4096)krok*=2;
  let ost=-Infinity;
  for(let k=0;k<takty;k++){
    const n=taktPiosenki(k+1,frag),start=dl?k%dl===0:k===0;
    if(!start&&(n-1)%krok)continue;
    if((k-ost)*naTakt<odstep)continue;
    out.push({k,n});ost=k;
  }
  return out;
}
// Kolor piosenki (miniatura rolki, pasek karty): jeden z czterech akcentów torów, stały dla id.
function akcentPiosenki(id){
  let x=0;for(const c of String(id||""))x=(x*31+c.charCodeAt(0))>>>0;
  return ZC_TORY_STYL[x%ZC_TORY_STYL.length].akcent;
}

// ---------------------------------------------------------------------------------------------
// FOLDER (File System Access). Funkcje biorą uchwyt argumentem, więc test podstawia atrapę.
async function listaMidiWFolderze(dir){
  const sd=await dir.getDirectoryHandle("piosenki",{create:true}),out=[];
  for await(const [nazwa,uch] of sd.entries())if(uch.kind==="file"&&/\.midi?$/i.test(nazwa))out.push({nazwa,uch});
  return out.sort((a,b)=>a.nazwa.localeCompare(b.nazwa,"pl"));
}
async function czytajDaneGry(dir){
  try{
    const dd=await dir.getDirectoryHandle("dane",{create:true});
    const fh=await dd.getFileHandle(ZC_BIBLIO.PLIK_DANYCH);
    const j=JSON.parse(await (await fh.getFile()).text());
    return j&&typeof j==="object"?j:null;
  }catch(e){return null;}
}
async function zapiszDaneGry(dir,dane){
  const dd=await dir.getDirectoryHandle("dane",{create:true});
  const fh=await dd.getFileHandle(ZC_BIBLIO.PLIK_DANYCH,{create:true});
  const w=await fh.createWritable();await w.write(JSON.stringify(dane,null,1));await w.close();
}
// Zapis do piosenki/: ten sam plik pod tą nazwą już jest = nic nie piszemy; inny plik pod tą nazwą (np. trenera
// albo druga piosenka o podobnej nazwie) zostaje nietknięty, a nasz dostaje „ (2)”, „ (3)”…
// `wynik.nowy` mówi, czy w folderze przybył plik.
async function zapiszMidiWFolderze(dir,nazwa,buf,wynik){
  const n0=nazwaPlikuDoZapisu(nazwa),sd=await dir.getDirectoryHandle("piosenki",{create:true});
  const skrot=skrotBajtow(buf),kropka=n0.lastIndexOf(".");
  for(let i=1;i<100;i++){
    const n=i===1?n0:n0.slice(0,kropka)+" ("+i+")"+n0.slice(kropka);
    let fh=null;try{fh=await sd.getFileHandle(n);}catch(e){fh=null;}
    if(fh){
      let jest=null;try{jest=await (await fh.getFile()).arrayBuffer();}catch(e){}
      if(jest&&jest.byteLength===buf.byteLength&&skrotBajtow(jest)===skrot){if(wynik)wynik.nowy=false;return n;}
      continue;
    }
    fh=await sd.getFileHandle(n,{create:true});const w=await fh.createWritable();await w.write(buf);await w.close();
    if(wynik)wynik.nowy=true;
    return n;
  }
  throw new Error("piosenki/: brak wolnej nazwy dla "+n0);
}
// 10-18 (D-11): czy w piosenki/ leży ten sam plik (SHA-256 bajtów jak zr.hash w zrodloZPliku). Inny plik pod tą nazwą
// (podmieniony, z trenera) daje false, więc usunMidiZFolderu go nie tknie.
async function plikWFolderze(dir,nazwa,hash){
  try{const sd=await dir.getDirectoryHandle("piosenki"),fh=await sd.getFileHandle(nazwa);
    return sha256Hex(await (await fh.getFile()).arrayBuffer())===hash;}
  catch(e){return false;}
}
async function usunMidiZFolderu(dir,nazwa,hash){
  if(!await plikWFolderze(dir,nazwa,hash))return false;
  await (await dir.getDirectoryHandle("piosenki")).removeEntry(nazwa);
  return true;
}
const fsObslugiwany=()=>typeof window.showDirectoryPicker==="function";

// ---------------------------------------------------------------------------------------------
// INDEXEDDB (uchwyt folderu i bajty plików) I LOCALSTORAGE (spis i parametry)
function bibIdb(){
  return new Promise((ok,zle)=>{
    // wersja 2: magazyn `wyniki` na tablicę wyników RibbitBeat (tablica.js)
    // wersja 3: magazyn `probki` na bajty własnych próbek dźwięku ze Studia instrumentów (studio-probki.js).
    //   Osobny magazyn, nie `pliki`: tam leżą MIDI biblioteki, a sprzątanie osieroconych próbek czyta WSZYSTKIE
    //   klucze swojego magazynu (bibIdbKeys) i usuwa te, do których nie ma już instrumentu.
    const r=indexedDB.open(ZC_BIBLIO.BAZA,3);
    r.onupgradeneeded=()=>{const db=r.result;
      if(!db.objectStoreNames.contains("kv"))db.createObjectStore("kv");
      if(!db.objectStoreNames.contains("pliki"))db.createObjectStore("pliki");
      if(!db.objectStoreNames.contains("wyniki"))db.createObjectStore("wyniki");
      if(!db.objectStoreNames.contains("probki"))db.createObjectStore("probki");};
    r.onsuccess=()=>ok(r.result);r.onerror=()=>zle(r.error);
  });
}
async function bibIdbGet(sklep,k){
  try{const db=await bibIdb();return await new Promise(ok=>{const q=db.transaction(sklep).objectStore(sklep).get(k);
    q.onsuccess=()=>ok(q.result);q.onerror=()=>ok(null);});}catch(e){return null;}
}
async function bibIdbSet(sklep,k,v){
  try{const db=await bibIdb();await new Promise(ok=>{const tx=db.transaction(sklep,"readwrite");tx.objectStore(sklep).put(v,k);
    tx.oncomplete=ok;tx.onerror=ok;tx.onabort=ok;});}catch(e){}
}
async function bibIdbDel(sklep,k){
  try{const db=await bibIdb();await new Promise(ok=>{const tx=db.transaction(sklep,"readwrite");tx.objectStore(sklep).delete(k);
    tx.oncomplete=ok;tx.onerror=ok;tx.onabort=ok;});}catch(e){}
}
// Wszystkie klucze magazynu. Potrzebne tylko sprzątaniu próbek Studia: nagranie zapisuje się od razu (żeby przeżyło
// przeładowanie zanim ktoś kliknie „Zapisz”), więc bez tego osierocone bajty zostawałyby w bazie na zawsze.
async function bibIdbKeys(sklep){
  try{const db=await bibIdb();return await new Promise(ok=>{const q=db.transaction(sklep).objectStore(sklep).getAllKeys();
    q.onsuccess=()=>ok(Array.isArray(q.result)?q.result:[]);q.onerror=()=>ok([]);});}catch(e){return [];}
}
function wczytajSpis(){
  try{
    const z=JSON.parse(localStorage.getItem(ZC_BIBLIO.KLUCZ)||"null");
    if(z&&z.wersja===ZC_BIBLIO.WERSJA){
      B.moje=Array.isArray(z.piosenki)?z.piosenki.filter(x=>x&&typeof x.id==="string"):[];
      B.parametry=z.parametry&&typeof z.parametry==="object"?z.parametry:{};
      B.pp.duzy=!!(z.podglad&&z.podglad.duzy);
      B.pominiete=Array.isArray(z.pominiete)?z.pominiete.filter(u=>u&&typeof u.plik==="string"&&typeof u.hash==="string"&&typeof u.folder==="string"):[];
    }
  }catch(e){}
}
function wczytajUlubione(){try{B.ulubione=odczytajUlubione(localStorage.getItem(ZC_BIBLIO.KLUCZ_ULUBIONE));}catch(e){B.ulubione=[];}}
function zapiszUlubione(){try{localStorage.setItem(ZC_BIBLIO.KLUCZ_ULUBIONE,JSON.stringify({wersja:1,ids:B.ulubione}));}catch(e){}}
function ostatnioGrane(){try{const z=JSON.parse(localStorage.getItem(ZC_BIBLIO.KLUCZ_OSTATNIO)||"{}");return z&&typeof z==="object"&&!Array.isArray(z)?z:{};}catch(e){return {};}}
// Koniec piosenki (zakonczGre): utwór wskakuje na szczyt „Ostatnio grane”.
function bibZagrano(id){
  if(!id)return;const z=ostatnioGrane();z[id]=new Date().toISOString();
  try{localStorage.setItem(ZC_BIBLIO.KLUCZ_OSTATNIO,JSON.stringify(z));}catch(e){}
  ulozKarty();
}
const trybSortowania=()=>ZC_BIBLIO.SORTOWANIA.includes(S.ust.sortowanie)?S.ust.sortowanie:"alfabet";
// Wpis do sortowania: tytuł, czas dodania (moje: spis, pakiety: chwila otwarcia), kolejność wbudowanych.
function wpisDoSortu(id){
  const w=B.wpisy.get(id);if(!w)return null;
  const x=B.moje.find(y=>y.id===id),i=BUILTIN.findIndex(d=>d.id===id);
  // trudność melodii (ta sama liczba, co na grzbiecie naszywki) tylko wtedy, gdy po niej sortujemy; liczona raz na piosenkę
  let tr=null;if(trybSortowania()==="trudnosc")try{const t=trudnoscPartiiW(w.gra,0);tr=t?t.ocena:null;}catch(e){}
  return {id,tytul:w.zr.tytul,dodano:x?x.dodano:w.dodano||null,kolejnosc:i>=0?i:null,trudnosc:tr};
}
const posortowaneId=ids=>sortujUtwory(ids.map(wpisDoSortu).filter(Boolean),trybSortowania(),{ulubione:B.ulubione,ostatnioGrane:ostatnioGrane()}).map(w=>w.id);
function zapiszSpis(){
  try{localStorage.setItem(ZC_BIBLIO.KLUCZ,JSON.stringify({wersja:ZC_BIBLIO.WERSJA,piosenki:B.moje,parametry:B.parametry,
    podglad:{duzy:B.pp.duzy},pominiete:B.pominiete}));}catch(e){}
}
function zapiszDoFolderuPozniej(){
  if(!B.dir||!B.dirOk)return;
  clearTimeout(B.zapisT);
  B.zapisT=setTimeout(()=>{zapiszDaneGry(B.dir,daneDoFolderu(B.parametry)).catch(e=>console.warn("zabi-chor.json",e));},ZC_BIBLIO.ZAPIS_MS);
}

// ---------------------------------------------------------------------------------------------
// WPISY: źródło piosenki + parametry → dwa modele: pełna piosenka (do miniatury i szuflady) i ta do gry
// (fragment, powtórzenia, tempo). S.piosenki trzyma modele do gry, w kolejności: wbudowane, potem moje.
function zbudujWpis(w){
  const par=poprawParametry(w.zr,B.parametry[w.id]);
  w.par=par;
  w.pelna=piosenkaZeZrodla(w.zr,Object.assign({},par,{od:1,do:w.zr.takty,powtorz:1}));
  w.gra=(par.od===1&&par.do===w.zr.takty&&par.powtorz===1)?w.pelna:piosenkaZeZrodla(w.zr,par);
  // licencja: wbudowane = domena publiczna, pakiet = z manifestu (ustawia bibDodajZPakietu), reszta = plik użytkownika
  if(!w.licencja)w.licencja=licencjaWpisu(w.rodzaj,null,w.adres);
  w.gra.licencja=w.pelna.licencja=w.licencja;
  return w;
}
function zarejestruj(w){
  const i=S.piosenki.findIndex(p=>p.id===w.id);
  if(i>=0)S.piosenki[i]=w.gra;else S.piosenki.push(w.gra);
}
function dodajZBufora(buf,nazwa,rodzaj,adres){
  const zr=zrodloZPliku(buf,nazwa),stary=B.wpisy.get(zr.id),x0=B.moje.find(x=>x.id===zr.id);
  const w=zbudujWpis({id:zr.id,rodzaj:stary?stary.rodzaj:rodzaj,plik:nazwaPlikuDoZapisu(nazwa),tytul:zr.tytul,zr,
    adres:adres||(x0&&x0.adres)||(stary&&stary.adres)||""});
  B.wpisy.set(w.id,w);
  if(!x0)B.moje.push(Object.assign({id:w.id,tytul:w.tytul,plik:w.plik,rodzaj:w.rodzaj,dodano:Date.now()},w.adres?{adres:w.adres}:{}));
  if(B.pominiete.some(u=>u.id===w.id))B.pominiete=B.pominiete.filter(u=>u.id!==w.id);   // D-11: dodany jeszcze raz, skan znów go czyta
  zarejestruj(w);
  // piosenka wybrana przed przeładowaniem; id sprzed rundy 3b (bez skrótu bajtów, np. z ?piosenka=) też pasuje
  if(S.czekaNaId&&(S.czekaNaId===w.id||S.czekaNaId===w.id.slice(0,-7))){
    S.czekaNaId=null;wybierzPiosenkeId(w.id);if(B.zbudowana&&B.filtr==="wbudowane")ustawFiltr("folder",true);}
  return w;
}
async function utrwalPlik(w,buf,doFolderu){
  await bibIdbSet("pliki",w.id,{id:w.id,plik:w.plik,dane:buf});
  zapiszSpis();
  if(doFolderu&&B.dir&&B.dirOk){
    try{const wyn={};w.plik=await zapiszMidiWFolderze(B.dir,w.plik,buf,wyn);
      const x=B.moje.find(y=>y.id===w.id);if(x)x.plik=w.plik;   // pod tą nazwą skan folderu pozna plik bez czytania
      zapiszSpis();if(wyn.nowy)B.dirPlikow++;pasekFolderu();}
    catch(e){console.warn("zapis do piosenki/",e);}
  }
}
// Przeciągnięty plik, plik z adresu (rodzaj „adres”) i ZC.wczytajMidi: od razu w grze, w tle do IndexedDB i do folderu.
function bibDodajPlik(buf,nazwa,rodzaj,adres){
  // ten sam plik (nazwa i bajty) już jest: nic nie dublujemy, a komunikat mówi to wprost (w.powtorka)
  const jest=B.wpisy.get(idZNazwyPliku(nazwa,buf));
  if(jest){jest.powtorka=true;return jest;}
  const w=dodajZBufora(buf,nazwa,rodzaj||"upuszczona",adres);w.powtorka=false;
  zapiszSpis();
  wstawKarte(w,true);
  utrwalPlik(w,buf.slice(0),true);
  return w;
}
// Utwór z pobranej paczki MIDI (pakiety.js): bajty z dysku użytkownika, tytuł i kompozytor z manifestu, licencja
// z manifestu. Nie trafia do IndexedDB ani do folderu (leży w katalogu paczki), ale poza tym jest zwykłym wpisem:
// karta stoi w „Moich” obok własnych plików, liczy się w „Wszystkie” i ma ♥, podgląd, szufladę i tablicę wyników.
function bibDodajZPakietu(buf,s){
  const zr=zrodloZPliku(buf,s.plik||s.id);
  if(s.title)zr.tytul=s.title;
  zr.opis=s.composer||"";
  const jest=B.wpisy.get(zr.id);
  if(jest)return jest;
  const w=zbudujWpis({id:zr.id,rodzaj:"pakiet",plik:s.plik||s.id,tytul:zr.tytul,zr,licencja:licencjaWpisu("pakiet",s),
    pakiet:{pack:s.pakiet,song:s.id}});
  B.wpisy.set(w.id,w);
  if(!B.zPaczek.includes(w.id))B.zPaczek.push(w.id);
  zarejestruj(w);
  if(S.czekaNaId&&S.czekaNaId===w.id){S.czekaNaId=null;wybierzPiosenkeId(w.id);}
  return w;
}
// „Usuń paczkę” (pakiety.js): jej utwory znikają z biblioteki razem z plikami. Ulubione i wyniki z tablicy zostają
// pod swoimi kluczami, więc po ponownym pobraniu paczki wracają z utworami.
function bibUsunPaczke(pack){
  let wybranaZnikla=false;
  for(const [id,w] of [...B.wpisy]){
    if(!w.pakiet||w.pakiet.pack!==pack)continue;
    if(podsluchStan().id===id)zatrzymajPodglad();
    if(B.szuflada&&B.szuflada.id===id)zamknijSzuflade();
    if(piosenka()&&piosenka().id===id)wybranaZnikla=true;
    const li=B.karty.get(id);if(li)li.remove();
    B.wpisy.delete(id);B.karty.delete(id);
    B.zPaczek=B.zPaczek.filter(x=>x!==id);
    const i=S.piosenki.findIndex(p=>p.id===id);
    if(i>=0){S.piosenki.splice(i,1);if(i<S.idx)S.idx--;}
  }
  S.idx=Math.max(0,Math.min(S.idx,S.piosenki.length-1));
  ulozKarty();odswiezLiczniki();pustyFolder();
  if(wybranaZnikla)wybierzPiosenke(S.idx);
}
// Pakiet piosenki z audio (pakiet-piosenki.js, faza 3 konwertera): MIDI z pakietu zwykłą drogą zrodloZPliku (partie,
// trudność i wybór melodii jak dla przeciągniętego pliku), tytuł z manifestu, licencja „plik użytkownika”. Karta stoi
// w „Moje”, ale wpis nie trafia do IndexedDB ani do folderu: pakiet leży w katalogu Piosenki aplikacji.
function bibDodajZPiosenki(buf,d){
  const zr=zrodloZPliku(buf,d.slug+".mid");
  zr.tytul=String(d.manifest.tytul||d.slug);zr.opis="";
  const jest=B.wpisy.get(zr.id);
  if(jest)return jest;
  const w=zbudujWpis({id:zr.id,rodzaj:d.audio?"piosenka":"piosenka_midi",plik:d.slug+".mid",tytul:zr.tytul,zr,
    piosenka:{slug:d.slug},dodano:Date.parse(d.manifest.utworzono||"")||null});
  B.wpisy.set(w.id,w);
  if(!B.piosenkiPakietow.includes(w.id))B.piosenkiPakietow.push(w.id);
  PakietPiosenki.powiaz(w.id,d,zr);   // mapa czasu i układy, zanim piosenka da się wybrać
  zarejestruj(w);
  if(S.czekaNaId&&S.czekaNaId===w.id){S.czekaNaId=null;wybierzPiosenkeId(w.id);}
  return w;
}
// Lista pakietów piosenek z serwera aplikacji; poza aplikacją (brak /gry/api/) pusta, więc w „Moje” nic nie przybywa.
async function wczytajPiosenkiPakietow(){
  if(typeof PakietPiosenki==="undefined")return;
  const lista=await PakietPiosenki.lista();
  await kolejka(lista.map(x=>({id:"pakiet-piosenki:"+x.slug,tytul:x.tytul||x.slug,
    wykonaj:async()=>{
      if(x.blad)throw new Error(x.blad);
      const d=await PakietPiosenki.wczytaj(x.slug);
      return bibDodajZPiosenki(d.midi,d);
    }})));
}
// Zmiana parametru w szufladzie: zapis, nowe modele, odświeżenie karty i szuflady; wybrana piosenka
// dostaje nowe partie od razu (gracz z partią, której już nie ma, wraca do melodii).
function ustawParametry(id,zmiany){
  const w=B.wpisy.get(id);if(!w)return;
  const par=poprawParametry(w.zr,Object.assign({},w.par,zmiany));
  B.parametry=zapiszParametryWpisu(B.parametry,id,par);
  zapiszSpis();zapiszDoFolderuPozniej();
  const gra=podsluchStan();   // §22: ustawienia działają od razu na grany podsłuch tej piosenki
  odbuduj(w);
  if(gra.gra&&gra.id===id)podsluchWznow(gra);
}
function przywrocDomyslne(id){
  const w=B.wpisy.get(id);if(!w)return;
  const m=Object.assign({},B.parametry);delete m[id];B.parametry=m;
  zapiszSpis();zapiszDoFolderuPozniej();
  const gra=podsluchStan();
  odbuduj(w);
  if(gra.gra&&gra.id===id)podsluchWznow(gra);
}
function odbuduj(w){
  const gralo=B.podglad&&B.podglad.klucz==="p:"+w.id;
  if(gralo)zatrzymajPodglad();
  zbudujWpis(w);zarejestruj(w);
  if(piosenka()&&piosenka().id===w.id){for(const g of S.gracze)if(g.partia>=w.gra.partie.length)g.partia=0;rysujGraczy();ppRysuj();}
  odswiezKarte(w.id);
  if(B.szuflada&&B.szuflada.id===w.id)wypelnijSzuflade();
}

// ---------------------------------------------------------------------------------------------
// WCZYTYWANIE: kolejka zadań z taśmą postępu, szkieletami i kartami wchodzącymi po kolei
function tasma(i,n,etykieta){
  const t=B.el.tasma;if(!t)return;
  if(n<=0){t.classList.add("znika");clearTimeout(t._ukryj);t._ukryj=setTimeout(()=>{t.hidden=true;t.classList.remove("znika");},250);return;}
  clearTimeout(t._ukryj);t.hidden=false;t.classList.remove("znika");
  t.style.setProperty("--postep",(n?i/n:0).toFixed(3));
  t.querySelector(".tasma-napis").textContent=tt(etykieta||"wczytuje",{i,n});
}
async function kolejka(zadania,etykieta){
  if(!zadania.length)return;
  B.ladowanie++;
  const lista=B.listy.folder,miejsca=new Map();
  for(const z of zadania){
    if(B.karty.has(z.id))continue;
    const s=h("li","bkarta szkielet");s.setAttribute("aria-hidden","true");
    s.append(h("span","szkielet-rolka"),h("span","szkielet-tekst",z.tytul||""));
    lista.append(s);miejsca.set(z.id,s);
  }
  odswiezLiczniki();pustyFolder();
  let i=0,wejscie=0;
  for(const z of zadania){
    // 10-19: odczyt i rozbiór jednego MIDI potrafi zająć ćwierć sekundy, a utworów z paczki bywa kilkaset.
    // W grze i na odliczaniu kolejka czeka: zacinający się wątek rozsypałby rytm, a karty mogą poczekać.
    while(S.ekran==="gra"||S.ekran==="odliczanie")await new Promise(r=>setTimeout(r,400));
    i++;tasma(i,zadania.length,etykieta);
    const miejsce=miejsca.get(z.id);
    try{
      const w=await z.wykonaj();
      if(!w||w.powtorkaPliku){   // ten sam plik co wpis, który już jest: karteczka (albo nic) zamiast drugiej karty
        if(w){const nota=karteczka(w.powtorkaPliku);nota.classList.add("powtorka");
          if(miejsce&&miejsce.parentNode)miejsce.replaceWith(nota);else lista.append(nota);}
        else if(miejsce)miejsce.remove();
        continue;
      }
      const li=kartaWpisu(w);li.style.setProperty("--i",String(wejscie++%10));
      li.classList.remove("wchodzi");void li.offsetWidth;li.classList.add("wchodzi");
      if(miejsce&&miejsce.parentNode)miejsce.replaceWith(li);else if(!li.parentNode)lista.append(li);
      odswiezLiczniki();   // kolejka utworów z paczek bywa długa: liczniki zakładek rosną w jej trakcie, nie na końcu
    }catch(e){
      const nota=karteczka(tt("biblioBladPliku",{tytul:z.tytul||z.id,powod:(e&&e.message)||e}));
      if(miejsce&&miejsce.parentNode)miejsce.replaceWith(nota);else lista.append(nota);
      if(z.porazka)z.porazka();
    }
    await new Promise(r=>setTimeout(r,0));   // taśma i karty rysują się między plikami
  }
  tasma(0,0);
  B.ladowanie--;
  zapiszSpis();ulozKarty();odswiezLiczniki();pustyFolder();
}
async function wczytajZapisane(){
  const pozycje=B.moje.slice();
  await kolejka(pozycje.map(x=>({id:x.id,tytul:x.tytul,
    wykonaj:async()=>{
      const r=await bibIdbGet("pliki",x.id);
      if(!r||!r.dane)throw new Error(T.biblioBrakPliku);
      const w=dodajZBufora(r.dane,r.plik||x.plik||x.tytul,x.rodzaj);
      if(w.id!==x.id)await przeniesWpis(x,w,r);   // zapis sprzed rundy 3b: id bez skrótu bajtów
      return w;
    },
    porazka:()=>{B.moje=B.moje.filter(y=>y.id!==x.id);}})));
}
// Wpis zapisany pod starym id (sama nazwa) dostaje id z nazwą i skrótem bajtów: to samo miejsce w spisie,
// jego parametry, rekord i bajty w IndexedDB pod nowym kluczem.
async function przeniesWpis(x,w,r){
  B.moje=B.moje.filter(y=>y.id!==w.id);   // dodajZBufora dopisał nowy wpis na końcu
  const i=B.moje.indexOf(x);if(i>=0)B.moje[i]=Object.assign({},x,{id:w.id});
  if(B.parametry[x.id]&&!B.parametry[w.id]){
    const m=Object.assign({},B.parametry,{[w.id]:B.parametry[x.id]});delete m[x.id];B.parametry=m;
    zbudujWpis(w);zarejestruj(w);
  }
  if(S.rekordy&&S.rekordy[x.id]!=null&&S.rekordy[w.id]==null){S.rekordy[w.id]=S.rekordy[x.id];delete S.rekordy[x.id];zapiszUstawienia();}
  await bibIdbSet("pliki",w.id,Object.assign({},r,{id:w.id}));
  await bibIdbDel("pliki",x.id);
  zapiszSpis();zapiszDoFolderuPozniej();
}
async function skanujFolder(){
  if(!B.dir||!B.dirOk||B.skanuje)return;
  B.skanuje=true;pasekFolderu();
  try{
    const dane=await czytajDaneGry(B.dir);
    if(dane&&dane.parametry&&typeof dane.parametry==="object"){
      const przed=JSON.stringify(B.parametry);
      B.parametry=scalParametry(B.parametry,dane.parametry);
      if(JSON.stringify(B.parametry)!==przed){zapiszSpis();for(const w of B.wpisy.values())odbuduj(w);}
    }
    if(typeof Tablica!=="undefined")Tablica.zFolderu(B.dir).catch(e=>console.warn("tablica w folderze",e));
    const pliki=await listaMidiWFolderze(B.dir);
    B.dirPlikow=pliki.length;
    // znane pliki rozpoznajemy po nazwie w folderze (bez czytania); reszta: id = nazwa + skrót bajtów, więc
    // różne pliki o podobnych nazwach to dwa wpisy, a ten sam plik pod drugą nazwą dostaje karteczkę
    const znane=new Set(B.moje.filter(x=>B.wpisy.has(x.id)).map(x=>x.plik));
    // D-11: plik usunięty z biblioteki, a zostawiony w folderze (ta sama nazwa i te same bajty), skan pomija; wpis
    // o pliku, którego w tym folderze już nie ma (albo pod tą nazwą leży dziś inny), znika z B.pominiete
    const folder=B.dir.name,nazwy=new Set(pliki.map(p=>p.nazwa)),ile=B.pominiete.length,nowe=[];
    B.pominiete=B.pominiete.filter(u=>u.folder!==folder||nazwy.has(u.plik));
    for(const p of pliki){
      if(znane.has(p.nazwa))continue;
      const u=B.pominiete.find(x=>x.folder===folder&&x.plik===p.nazwa);
      if(u){let ten=false;try{ten=sha256Hex(await (await p.uch.getFile()).arrayBuffer())===u.hash;}catch(e){}
        if(ten)continue;B.pominiete=B.pominiete.filter(x=>x!==u);}
      nowe.push(p);
    }
    if(B.pominiete.length!==ile)zapiszSpis();
    for(const n of B.listy.folder.querySelectorAll(".karteczka.powtorka"))n.remove();
    B.skanuje=false;pasekFolderu();
    await kolejka(nowe.map(p=>({id:"plik:"+p.nazwa,tytul:tytulZNazwyPliku(p.nazwa),
      wykonaj:async()=>{
        const buf=await (await p.uch.getFile()).arrayBuffer(),jest=B.wpisy.get(idZNazwyPliku(p.nazwa,buf));
        if(jest){const x=B.moje.find(y=>y.id===jest.id);
          return x&&x.plik===p.nazwa?null:{powtorkaPliku:tt("biblioPowtorka",{plik:p.nazwa,jest:(x&&x.plik)||jest.zr.tytul})};}
        const w=dodajZBufora(buf,p.nazwa,"folder");w.plik=p.nazwa;
        const x=B.moje.find(y=>y.id===w.id);if(x)x.plik=p.nazwa;
        await utrwalPlik(w,buf.slice(0),false);
        return w;
      }})));
  }catch(e){console.warn("folder",e);toast(T.folderBladOdczytu,true);}
  B.skanuje=false;pasekFolderu();
}
async function initFolder(){
  if(!fsObslugiwany()){pasekFolderu();return;}
  B.dir=await bibIdbGet("kv","dir");
  if(B.dir&&typeof B.dir.queryPermission==="function"){
    try{B.dirOk=(await B.dir.queryPermission({mode:"readwrite"}))==="granted";}catch(e){B.dirOk=false;}
  }else B.dir=null;
  pasekFolderu();
  if(B.dirOk)await skanujFolder();
}
async function wskazFolder(){
  try{
    const d=await window.showDirectoryPicker({id:"zabi-chor",mode:"readwrite"});
    B.dir=d;B.dirOk=true;await bibIdbSet("kv","dir",d);
    pasekFolderu();await skanujFolder();
    // piosenki przeciągnięte wcześniej trafiają też do nowego folderu
    for(const x of B.moje){const r=await bibIdbGet("pliki",x.id);if(r&&r.dane&&x.rodzaj!=="folder"){
      try{x.plik=await zapiszMidiWFolderze(B.dir,x.plik||x.tytul,r.dane);}catch(e){}}}
    zapiszSpis();zapiszDoFolderuPozniej();
  }catch(e){if(!e||e.name!=="AbortError")toast(T.folderBlad,true);}
  pasekFolderu();
}
async function nadajDostep(){
  try{B.dirOk=(await B.dir.requestPermission({mode:"readwrite"}))==="granted";}catch(e){B.dirOk=false;}
  pasekFolderu();
  if(B.dirOk)skanujFolder();
}

// ---------------------------------------------------------------------------------------------
// MINIATURA ROLKI: nuty pełnej piosenki, melodia w kolorze piosenki, reszta w kraftowym brązie,
// poza fragmentem przygaszone; głowica podglądu jako różowa nić jak linia „teraz” w grze.
function rysujRolke(cv,w,o){
  o=o||{};
  const szer=cv.clientWidth||+cv.dataset.szer||88,wys=cv.clientHeight||+cv.dataset.wys||40,d=Math.min(2,window.devicePixelRatio||1);
  if(cv.width!==Math.round(szer*d)||cv.height!==Math.round(wys*d)){cv.width=Math.round(szer*d);cv.height=Math.round(wys*d);}
  const c=cv.getContext("2d");c.setTransform(d,0,0,d,0,0);c.clearRect(0,0,szer,wys);
  c.fillStyle="#f4e8d0";c.beginPath();c.roundRect(0,0,szer,wys,6);c.fill();
  const p=w&&w.pelna;
  if(!p){   // brak nut (np. karta przed wczytaniem pliku): pusta pięciolinia
    c.strokeStyle="rgba(120,90,40,.22)";c.lineWidth=1;c.setLineDash([3,3]);
    for(let k=1;k<=4;k++){const y=Math.round(wys*k/5)+.5;c.beginPath();c.moveTo(5,y);c.lineTo(szer-5,y);c.stroke();}
    c.setLineDash([]);return null;
  }
  const koniec=Math.max(1,p.koniec),pad=3;
  let lo=Infinity,hi=-Infinity;for(const x of p.partie)if(x.nuty.length){lo=Math.min(lo,x.lo);hi=Math.max(hi,x.hi);}
  if(!Number.isFinite(lo)){lo=60;hi=72;}
  lo-=1;hi+=1;
  const X=t=>pad+t/koniec*(szer-2*pad),Y=m=>wys-pad-(m-lo)/Math.max(1,hi-lo)*(wys-2*pad);
  const rh=o.duza?Math.max(3,Math.min(7,(wys-2*pad)/Math.max(6,hi-lo)*1.1)):Math.max(2,Math.min(3.4,(wys-2*pad)/Math.max(6,hi-lo)*1.1));
  // takty (tylko w dużej rolce szuflady)
  if(o.duza){c.fillStyle="rgba(120,90,40,.16)";for(let k=1;k*p.metrum<koniec;k++){const x=Math.round(X(k*p.metrum))+.5;c.fillRect(x,pad,1,wys-2*pad);}}
  const akcent=akcentPiosenki(w.id);
  for(let i=p.partie.length-1;i>=0;i--){
    const x=p.partie[i];c.fillStyle=i===0?akcent:x.rola==="akompaniament"?"rgba(87,80,63,.62)":"rgba(120,90,40,.45)";
    for(const n of x.nuty){const x0=X(n.t),x1=Math.max(x0+1.4,X(n.t+n.d)-.6);c.fillRect(x0,Y(n.m)-rh/2,x1-x0,rh);}
  }
  // fragment: poza nim papier przygaszony, krawędzie jak naklejona taśma
  const par=w.par;
  if(par&&!(par.od===1&&par.do===w.zr.takty)){
    const xa=X((par.od-1)*p.metrum),xb=X(par.do*p.metrum);
    c.fillStyle="rgba(239,233,221,.72)";c.fillRect(0,0,xa,wys);c.fillRect(xb,0,szer-xb,wys);
    c.fillStyle="rgba(234,163,43,.85)";c.fillRect(xa-1,0,2,wys);c.fillRect(xb-1,0,2,wys);
  }
  let glowicaY=null,zabaY=null;
  if(o.glowica!=null){
    const x=X(Math.max(0,Math.min(koniec,o.glowica)));
    c.strokeStyle="#ec1a83";c.lineWidth=o.duza?2.5:1.8;c.setLineDash(o.duza?[6,4]:[3,2]);
    c.beginPath();c.moveTo(x,1);c.lineTo(x,wys-1);c.stroke();c.setLineDash([]);
    const n=nutaPod(p.partie[0].nuty,o.glowica);
    if(n){glowicaY=Y(n.m);c.fillStyle="#211f1d";c.beginPath();c.arc(x,glowicaY,o.duza?4:2.6,0,Math.PI*2);c.fill();}
    // kropka głowicy pojawia się tylko nad brzmiącą nutą, ale żaba ma gdzie siedzieć także w pauzie
    const nz=n||nutaDoTeraz(p.partie[0].nuty,o.glowica);
    zabaY=nz?Y(nz.m):null;
    if(o.podswietl){   // „Oryginał”: nuty pod głowicą świecą
      c.fillStyle="rgba(236,26,131,.85)";
      for(const x2 of p.partie)for(const m of x2.nuty)if(m.t<=o.glowica&&m.t+m.d>o.glowica){const x0=X(m.t),x1=Math.max(x0+2,X(m.t+m.d));c.fillRect(x0,Y(m.m)-rh,x1-x0,rh*2);}
    }
    return {x,y:glowicaY,yZaby:zabaY,lo,hi};
  }
  return null;
}
function nutaPod(nuty,b){let lo=0,hi=nuty.length-1;while(lo<=hi){const m=(lo+hi)>>1;if(nuty[m].t+nuty[m].d<=b)lo=m+1;else hi=m-1;}
  const n=nuty[lo];return n&&n.t<=b?n:null;}
// Głowa żaby nie wraca do środkowej pozycji, tylko zostaje na ostatniej nucie: ostatnia nuta, która
// już się ZACZĘŁA — w pauzie ta sama, co przed chwilą brzmiała. `nutaPod` mówi, czy w tej chwili coś brzmi (czy
// żaba otwiera pysk), a to mówi, NA JAKIEJ WYSOKOŚCI ma siedzieć: w pauzie zostaje na ostatnim dźwięku zamiast
// spadać na środek rolki. Przed pierwszą nutą null, czyli środek jak dotąd.
function nutaDoTeraz(nuty,b){let lo=0,hi=nuty.length-1;while(lo<=hi){const m=(lo+hi)>>1;if(nuty[m].t<=b)lo=m+1;else hi=m-1;}
  return nuty[lo-1]||null;}

// ---------------------------------------------------------------------------------------------
// PODGLĄD: melodia głosem żaby wybranym w lobby na tle reszty partii; „Oryginał” = cały plik instrumentem
function zatrzymajPodglad(){
  const P=B.podglad;if(!P)return;
  if(/^pp:/.test(P.klucz))B.pp.glowica=Math.max(0,P.od+(P.h.teraz()-P.start)/P.spb);
  B.podglad=null;clearInterval(P.timer);cancelAnimationFrame(P.raf);
  try{P.h.zatrzymaj();}catch(e){}
  if(P.koniec)try{P.koniec();}catch(e){}
  podsluchZglos();   // runda 5: paski UI i przyciski ▶ odświeżają się po zdarzeniu rb-podsluch
}
function grajPodglad(o){
  zatrzymajPodglad();
  if(typeof Glos!=="undefined"&&Glos.stopProbka)Glos.stopProbka();   // nigdy dwa dźwięki naraz: próbka instrumentu milknie
  const hd=Glos.podglad();if(!hd){toast(T.podgladBezDzwieku);return false;}
  const spb=60/Math.max(10,o.tempo),start=hd.teraz()+.12;
  const mel=o.melodia||[],pod=(o.podklad||[]).slice().sort((a,b)=>a.t-b.t);
  let lo=Infinity,hi=-Infinity;for(const n of mel){lo=Math.min(lo,n.m);hi=Math.max(hi,n.m);}
  const poz=m=>Number.isFinite(lo)&&hi>lo?(m-lo)/(hi-lo):.5;
  const glos=mel.length?hd.glos(S.ust.glos):null;
  const per=(o.perkusja||[]).slice().sort((a,b)=>a.t-b.t);   // 11-19: perkusja z pliku (silnik MIDI inny niż „Jeden instrument”)
  const P={klucz:o.klucz,h:hd,start,spb,im:0,ip:0,ib:0,koniecBeat:o.koniecBeat,koniec:o.koniec,poz,mel,od:o.od||0,zgl:0};
  const planuj=()=>{
    const teraz=hd.teraz(),hor=teraz+.4;
    while(P.im<mel.length&&start+mel[P.im].t*spb<hor){
      const n=mel[P.im++],t0=start+n.t*spb,t1=start+(n.t+n.d)*spb;
      if(t0<teraz-.05)continue;   // karta w tle zgubiła takt: nuta przepada, nie gra z opóźnieniem
      glos.ustaw(n.m,.35+.5*poz(n.m),0,t0);glos.spiewaj(true,t0);glos.spiewaj(false,Math.max(t0+.06,t1-.04));
    }
    while(P.ip<pod.length&&start+pod[P.ip].t*spb<hor){
      const n=pod[P.ip++],t0=start+n.t*spb;
      if(t0<teraz-.05)continue;
      hd.nuta(barwaPodkladu(S.ust.instrument,n.m,n.p),n.m,t0-teraz,Math.max(.1,n.d*spb*.95),poziomPodkladu(n.poziom,n.m,n.p));   // 11-19: barwa według silnika MIDI
    }
    while(P.ib<per.length&&start+per[P.ib].t*spb<hor){
      const n=per[P.ib++],t0=start+n.t*spb;
      if(t0<teraz-.05)continue;
      hd.bebny(n.typ,t0-teraz,ZC_PERKUSJA_POZIOM*(.45+.55*n.v));
    }
  };
  planuj();P.timer=setInterval(planuj,40);
  const klatka=()=>{
    if(B.podglad!==P)return;
    const beat=(hd.teraz()-start)/spb;
    if(beat>P.koniecBeat+.6){zatrzymajPodglad();return;}
    if(o.naKlatke)try{o.naKlatke(beat,P);}catch(e){console.warn(e);}
    const t=performance.now();if(t-P.zgl>=250){P.zgl=t;podsluchZglos();}   // postęp dla pasków UI co 250 ms
    P.raf=requestAnimationFrame(klatka);
  };
  P.raf=requestAnimationFrame(klatka);
  B.podglad=P;
  podsluchZglos();
  return true;
}
// Czas gry (z fragmentem i powtórzeniami) → czas pełnej piosenki na miniaturze
function czasPelny(w,beat){
  const par=w.par;if(!par||(par.od===1&&par.do===w.zr.takty&&par.powtorz===1))return beat;
  const ile=(par.do-par.od+1)*w.zr.metrum;
  return (par.od-1)*w.zr.metrum+Math.max(0,Math.min(ile-1e-6,beat-Math.floor(beat/ile)*ile));
}
// Karta ▶ i podsłuch: melodia + podkład od beatu `od` (brak = z ustawień podsłuchu: od początku albo od środka).
function przelaczPodglad(id,od){
  if(B.podglad&&B.podglad.klucz==="p:"+id){zatrzymajPodglad();return;}
  const w=B.wpisy.get(id);if(!w)return;
  const p=w.gra,pod=[];
  if(od==null)od=podsluchOd(p,podsluchUstawienia().od);
  od=Math.max(0,Math.min(+od||0,p.koniec-1));
  const zOd=n=>n.t>=od-1e-6;
  for(let i=1;i<p.partie.length;i++)for(const n of p.partie[i].nuty)if(zOd(n))pod.push({m:n.m,t:n.t-od,d:n.d,p:p.partie[i].program});
  for(const n of (p.tlo||[]))if(zOd(n))pod.push({m:n.m,t:n.t-od,d:n.d,poziom:.55,p:n.p});
  const mel=p.partie[0].nuty.filter(zOd).map(n=>({m:n.m,t:n.t-od,d:n.d}));
  const ok=grajPodglad({klucz:"p:"+id,melodia:mel,podklad:pod,perkusja:perkusjaPodgladu(p,od),tempo:p.tempo*S.ust.tempo/100,koniecBeat:p.koniec-od,od,
    naKlatke:(b,P)=>{
      const beat=od+b,tp=czasPelny(w,beat);
      animujKarte(id,tp,P,nutaPod(p.partie[0].nuty,beat));
      if(B.szuflada&&B.szuflada.id===id)rysujRolke(B.el.szRolka,w,{duza:true,glowica:tp});
    },
    koniec:()=>{odswiezKarte(id);if(B.szuflada&&B.szuflada.id===id){rysujRolke(B.el.szRolka,w,{duza:true});odswiezPrzyciskiSzuflady();}}});
  if(ok){odswiezKarte(id);if(B.szuflada&&B.szuflada.id===id)odswiezPrzyciskiSzuflady();}
}
// Perkusja z pliku dla podglądu od beatu `od` (pusta przy silniku „Jeden instrument” i w utworze bez perkusji).
function perkusjaPodgladu(p,od){
  if(!silnikGraPerkusje()||!p||!p.perkusja||!p.perkusja.length)return [];
  return p.perkusja.filter(n=>n.t>=od-1e-6).map(n=>({t:n.t-od,typ:n.typ,v:n.v}));
}
function oryginalNuty(zr){
  const A=zr&&zr.w&&zr.w._all;if(!A||!A.all)return null;
  const pod=A.all.map(n=>({m:n.m,t:n.s/A.tpq-(A.origin||0),d:Math.max(.05,(n.e-n.s)/A.tpq),poziom:Math.min(1,.45+(n.v||80)/254),p:n.pr}));
  let koniec=0;for(const n of pod)koniec=Math.max(koniec,n.t+n.d);
  // „Oryginał” to cały plik: przy silniku MIDI innym niż „Jeden instrument” także jego perkusja
  const per=silnikGraPerkusje()?perkusjaPiosenki(zr).map(n=>({t:n.t,typ:n.typ,v:n.v})):[];
  return {pod,per,koniec,tempo:60000000/A.usq};
}
function przelaczOryginal(id){
  if(B.podglad&&B.podglad.klucz==="o:"+id){zatrzymajPodglad();return;}
  const w=B.wpisy.get(id),o=w&&oryginalNuty(w.zr);if(!o)return;
  const ok=grajPodglad({klucz:"o:"+id,podklad:o.pod,perkusja:o.per,tempo:o.tempo,koniecBeat:o.koniec,
    naKlatke:beat=>{if(B.szuflada&&B.szuflada.id===id)rysujRolke(B.el.szRolka,w,{duza:true,glowica:beat,podswietl:true});
      animujKarte(id,beat,null,null);},
    koniec:()=>{odswiezKarte(id);if(B.szuflada&&B.szuflada.id===id){rysujRolke(B.el.szRolka,w,{duza:true});odswiezPrzyciskiSzuflady();}}});
  if(ok&&B.szuflada&&B.szuflada.id===id)odswiezPrzyciskiSzuflady();
}
// PODSŁUCH (runda 5 „Kurtka”): JEDEN odtwarzacz dla karty ▶, „Posłuchaj partii”, oryginału z szuflady
// i automatycznego podsłuchu w lobby (lobby-scena.js). Wyłączność daje grajPodglad: każdy start najpierw woła
// zatrzymajPodglad. Ustawienia (auto, od początku / od środka) w localStorage; zdarzenie window „rb-podsluch”
// (detail = stan) przy starcie, stopie i co 250 ms gry, żeby paski i przyciski nie rozjeżdżały się z dźwiękiem.
const PODSLUCH_KLUCZ="ribbitflip.zabiChor.podsluch";
function podsluchUstawienia(){
  const d={auto:true,od:"srodek"};   // decyzja §16.6: domyślnie automatycznie i od środka
  try{const z=JSON.parse(localStorage.getItem(PODSLUCH_KLUCZ)||"null");
    if(z&&typeof z==="object"){if(typeof z.auto==="boolean")d.auto=z.auto;if(z.od==="poczatek"||z.od==="srodek")d.od=z.od;}}catch(e){}
  return d;
}
// „Od środka” = początek taktu najbliższego 50 % utworu, nie wcześniej niż takt 2 i nie później niż 8 taktów przed
// końcem; utwór krótszy niż 12 taktów zaczyna od taktu 2. Wynik w beatach (ćwierćnutach) gry.
function podsluchOd(p,tryb){
  if(!p||tryb!=="srodek")return 0;
  const m=p.metrum||4,takty=Math.max(1,Math.ceil(p.koniec/m-1e-9));
  if(takty<12)return takty>1?m:0;
  const t=Math.max(1,Math.min(takty-8,Math.round(p.koniec*.5/m)));
  return t*m;
}
function podsluchStan(){
  const P=B.podglad;
  if(!P)return {id:null,klucz:null,gra:false,od:0,beat:null,koniec:null,spb:null};
  const k=P.klucz,id=/^(p|o):/.test(k)?k.slice(2):/^pp:/.test(k)?k.split(":")[1]:null;
  return {id,klucz:k,gra:true,od:P.od||0,beat:+((P.od||0)+Math.max(0,(P.h.teraz()-P.start)/P.spb)).toFixed(3),
    koniec:+((P.od||0)+P.koniecBeat).toFixed(3),spb:P.spb};
}
function podsluchZglos(){
  if(typeof window==="undefined"||typeof CustomEvent!=="function")return;
  try{window.dispatchEvent(new CustomEvent("rb-podsluch",{detail:podsluchStan()}));}catch(e){}
}
// wznowienie po przebudowie: ta sama piosenka i rodzaj odsłuchu, ta sama pozycja (beat), przycięta do nowej długości
function podsluchWznow(s){
  if(!s||!s.klucz)return;
  const w=s.id&&B.wpisy.get(s.id);if(!w)return;
  const beat=Math.max(0,Math.min(+s.beat||0,w.gra.koniec-1));
  if(B.podglad)zatrzymajPodglad();
  if(/^p:/.test(s.klucz))przelaczPodglad(s.id,Math.floor(beat));
  else if(/^pp:/.test(s.klucz)){if(ppPiosenka()&&ppPiosenka().id===s.id){B.pp.glowica=beat;ppGraj();}}
  else if(/^o:/.test(s.klucz))przelaczOryginal(s.id);   // oryginał pliku nie zależy od ustawień: od początku jak dotąd
}
const podsluch={
  graj(id,o){
    o=o||{};const w=B.wpisy.get(id);if(!w)return false;
    let od=o.od;
    if(od==null||od==="srodek"||od==="poczatek")od=podsluchOd(w.gra,od==null?podsluchUstawienia().od:od);
    if(B.podglad&&B.podglad.klucz==="p:"+id)zatrzymajPodglad();   // od nowa, nie przełącznik
    przelaczPodglad(id,od);
    return !!B.podglad&&B.podglad.klucz==="p:"+id;
  },
  stop(){zatrzymajPodglad();},   // bezpieczne, gdy nic nie gra
  // §22: przebudowa granego podsłuchu po zmianie ustawień: stop + start od tej samej pozycji (przyciętej do nowej
  // długości); zatrzymany zostaje zatrzymany. `debounce` = 200 ms spokoju po ostatnim wywołaniu (suwaki).
  przebuduj(o){
    o=o||{};const s=podsluchStan();if(!s.gra)return false;
    if(!o.debounce){podsluchWznow(s);return true;}
    clearTimeout(podsluch._t);podsluch._t=setTimeout(()=>{const t=podsluchStan();if(t.gra)podsluchWznow(t);},200);return true;
  },
  stan:podsluchStan,
  ustawienia:podsluchUstawienia,
  ustaw(z){
    const d=Object.assign(podsluchUstawienia(),z||{});
    try{localStorage.setItem(PODSLUCH_KLUCZ,JSON.stringify({auto:!!d.auto,od:d.od==="poczatek"?"poczatek":"srodek"}));}catch(e){}
    podsluchZglos();return podsluchUstawienia();
  },
  od:podsluchOd};
// Mała żaba na karcie: jedzie głowicą po rolce, kiwa się i otwiera pysk tym szerzej, im wyżej śpiewa.
function animujKarte(id,beat,P,nuta){
  const li=B.karty.get(id);if(!li)return;
  const w=B.wpisy.get(id),cv=li.querySelector(".bkarta-rolka"),zaba=li.querySelector(".bkarta-zaba");
  const g=rysujRolke(cv,w,{glowica:beat});
  if(!zaba)return;
  if(!g){zaba.hidden=true;return;}
  zaba.hidden=false;
  const spiewa=!!(nuta&&P),klatka=spiewa?Math.max(1,Math.min(4,1+Math.floor(P.poz(nuta.m)*3.99))):0;
  if(zaba.dataset.k!==String(klatka)){zaba.src=ZC_ZASOBY.zaby[klatka];zaba.dataset.k=String(klatka);}
  const kiw=Math.sin(performance.now()/1000*(spiewa?9:3))*(spiewa?9:4);
  const y=g.yZaby!=null?g.yZaby:(g.y!=null?g.y:(cv.clientHeight||40)/2);
  zaba.style.transform="translate("+(g.x-11).toFixed(1)+"px,"+(y-15).toFixed(1)+"px) rotate("+kiw.toFixed(1)+"deg)";
}

// ---------------------------------------------------------------------------------------------
// WIDOK: filtry, pasek folderu, taśma postępu, trzy listy (przełączane bez przebudowy)
function zbudujWidok(){
  const box=el("biblioteka");if(!box)return;
  box.replaceChildren();B.el={};B.karty.clear();
  const filtry=h("div","biblio-filtry");filtry.setAttribute("role","tablist");filtry.setAttribute("aria-label",T.biblioFiltry);
  for(const [k,et] of [["wszystkie",T.biblioWszystkie],["wbudowane",T.biblioWbudowane],["folder",T.biblioMoje]]){
    const b=h("button","biblio-filtr");b.type="button";b.dataset.f=k;b.id="bfiltr-"+k;
    b.setAttribute("role","tab");b.setAttribute("aria-controls","blista-"+k);
    b.append(h("span","biblio-filtr-et",et),h("span","biblio-licznik",""));
    b.onclick=()=>ustawFiltr(k);
    filtry.append(b);
  }
  // „Sortuj” obok zakładek: ten sam wybór w Utworach i w kroku 1 (S.ust.sortowanie, zapamiętany w ustawieniach)
  const sort=h("div","segment biblio-sort");sort.setAttribute("role","radiogroup");sort.setAttribute("aria-label",T.sortuj);
  for(const v of ZC_BIBLIO.SORTOWANIA){const b=h("button","segment-opcja",T["sort_"+v]);b.type="button";b.dataset.v=v;b.setAttribute("role","radio");
    b.onclick=()=>ustawSortowanie(v);sort.append(b);}
  // 10-18 (Z-58): roving tabindex jak w zakładkach (jeden Tab na grupę, odswiezSortowanie), ← → zmieniają zaznaczenie;
  // na brzegu strzałka zostaje nawigacji lobby (wyjście z grupy), ↑ ↓ też
  sort.addEventListener("keydown",e=>{
    if(e.key!=="ArrowLeft"&&e.key!=="ArrowRight"||e.ctrlKey||e.altKey||e.metaKey)return;
    const o=[...sort.children],i=o.indexOf(document.activeElement),j=i+(e.key==="ArrowRight"?1:-1);
    if(i<0||j<0||j>=o.length)return;
    e.preventDefault();ustawSortowanie(o[j].dataset.v);o[j].focus({preventScroll:true});
  });
  const gora=h("div","biblio-gora");gora.append(filtry,h("span","biblio-sort-et",T.sortuj),sort,zbudujSzukajke());
  const tasmaEl=h("div","tasma-postep");tasmaEl.hidden=true;tasmaEl.setAttribute("role","status");
  tasmaEl.append(h("span","tasma-wypelnienie"),h("span","tasma-napis",""));
  const widoki=h("div","biblio-widoki");
  // Wbudowane
  const lW=h("ul","biblio-lista");lW.id="blista-wbudowane";lW.setAttribute("role","tabpanel");lW.setAttribute("aria-labelledby","bfiltr-wbudowane");
  // Moje: paczki do pobrania, import z adresu i pliku, pasek folderu i JEDNA lista (folder, przeciągnięte,
  // z adresu, ze schowka i utwory pobranych paczek)
  const pF=h("div","biblio-panel");pF.id="blista-folder";pF.setAttribute("role","tabpanel");pF.setAttribute("aria-labelledby","bfiltr-folder");
  const pasekF=h("div","biblio-pasek");const lF=h("ul","biblio-lista");const pusty=h("p","biblio-nota biblio-pusty",T.folderPusty);pusty.hidden=true;
  pF.append(pasekF,lF,pusty);
  // 10-20: paczki i import nie stoją już nad listą „Moich”, tylko w panelu czarnego paska „Dodaj utwory”
  // (jedno miejsce na wszystko, co przynosi nowe utwory); zakładka „Moje” to sam folder i lista.
  zbudujDodajUtwory();
  // Wszystkie: karty pożyczone z pozostałych list (ulozKarty): wbudowane i wszystko moje
  const lA=h("ul","biblio-lista");lA.id="blista-wszystkie";lA.setAttribute("role","tabpanel");lA.setAttribute("aria-labelledby","bfiltr-wszystkie");
  widoki.append(B.el.szuk.brak,lA,lW,pF);
  box.append(gora,tasmaEl,widoki);
  Object.assign(B.el,{filtry,sort,tasma:tasmaEl,pasekF,pusty});
  B.listy={wbudowane:lW,folder:lF,wszystkie:lA};
  for(const def of BUILTIN){const w=B.wpisy.get(def.id);if(w)lW.append(kartaWpisu(w));}
  zbudujSzuflade();
  ustawFiltr(B.filtr,true);odswiezSortowanie();
  pasekFolderu();odswiezLiczniki();
  B.zbudowana=true;
}
// Panel zakładki „Wgraj własny” (krok 1): wybór pliku, import z adresu i paczki do pobrania. Oba moduły
// Pakietów wstawiają się na POCZĄTEK pojemnika, więc kolejność wywołań jest odwrotna do widocznej: na górze
// „Dodaj własne utwory” (to obiecuje nazwa zakładki), pod nimi paczki. Bez pojemnika (stary HTML, harness) nic
// się nie dzieje.
function zbudujDodajUtwory(){
  const panel=el("dodajPanel"),cel=panel&&panel.querySelector(".dodaj-tresc");
  if(!cel||typeof Pakiety==="undefined")return;
  Pakiety.zbuduj(cel,{plaskie:true});
  Pakiety.zbudujImportUrl(cel);
}
function ustawFiltr(k,cicho){
  if(k==="pakiety")k="folder";   // 10-19: osobnej zakładki „Paczki” już nie ma, paczki stoją w „Moich”
  B.filtr=k;
  if(!["wszystkie","wbudowane","folder"].includes(k))k=B.filtr="wszystkie";   // „Szukaj”, „Ulubione” i „Paczki” już nie ma
  for(const b of B.el.filtry.children){const on=b.dataset.f===k;b.setAttribute("aria-selected",String(on));b.tabIndex=on?0:-1;}
  for(const [f,elm] of [["wszystkie",B.listy.wszystkie],["wbudowane",B.listy.wbudowane],["folder",el("blista-folder")]])elm.hidden=f!==k;
  if(!cicho&&k==="folder")Pakiety.odswiez();
  ulozKarty();pustyFolder();
  if(typeof wysrodkujWybrana==="function")wysrodkujWybrana(false);   // koło utworów: wybrany na środku także po zmianie zakładki
}
// Gdzie mieszka karta: wbudowane albo „Moje” (własne pliki i utwory paczek stoją na jednej liście).
function domKarty(w){
  if(!w)return null;
  return w.rodzaj==="wbudowana"?B.listy.wbudowane:B.listy.folder;
}
// Rozkład kart: w zakładce „Wszystkie” wszystkie karty (wbudowane i moje) w wybranym sortowaniu, w pozostałych
// każda karta na swojej liście, też w wybranym sortowaniu.
function ulozKarty(){
  const L=B.listy;if(!L||!L.wszystkie)return;
  const fokus=document.activeElement,lA=L.wszystkie;
  if(B.filtr==="wszystkie"){
    const karty=posortowaneId([...B.wpisy.keys()]).map(id=>kartaWpisu(B.wpisy.get(id)));
    if(lA.children.length!==karty.length||!naPoczatku(lA,karty))lA.replaceChildren(...karty);
  }else{
    for(const [k,kanon] of [["wbudowane",BUILTIN.map(d=>d.id)],["folder",mojeId()]]){
      const lista=L[k];
      const karty=posortowaneId(kanon).map(id=>B.karty.get(id)).filter(li=>li&&(li.parentNode===lista||li.parentNode===lA));
      // w „Moich” szkielety i karteczki zostają pod kartami; bez zmiany kolejności nic się nie rusza (przeniesiona
      // karta odtworzyłaby animację wejścia)
      if(!naPoczatku(lista,karty))lista.prepend(...karty);
    }
    lA.replaceChildren();
  }
  if(fokus&&fokus.isConnected&&document.activeElement!==fokus)fokus.focus({preventScroll:true});   // przeniesiona karta gubi fokus
  zastosujSzukanie();   // szukajka (runda 2): nowe i przeniesione karty dostają stan frazy, licznik liczy bieżącą zakładkę
}
function ustawSortowanie(v){
  if(!ZC_BIBLIO.SORTOWANIA.includes(v))return;
  ustaw("sortowanie",v);odswiezSortowanie();ulozKarty();
  if(typeof wysrodkujWybrana==="function")wysrodkujWybrana(false);
}
function odswiezSortowanie(){
  if(!B.el||!B.el.sort)return;
  for(const b of B.el.sort.children){const on=b.dataset.v===trybSortowania();b.setAttribute("aria-checked",String(on));b.tabIndex=on?0:-1;}
}
function naPoczatku(lista,karty){const d=lista.children;return karty.every((li,i)=>d[i]===li);}
// ♥ na karcie: przełącza, zapisuje i przestawia listy. 10-18 (B-02): przy sortowaniu „Ulubione” lista przestawia się
// dopiero 600 ms po ostatnim ♥ i po zejściu kursora z karty, bo inaczej drugi klik dwukliku trafiał w kartę, która
// wjechała pod kursor.
let bibUlubTimer=0;
function bibPrzelaczUlubione(id){
  if(!B.wpisy.has(id))return false;
  B.ulubione=przelaczUlubione(B.ulubione,id);zapiszUlubione();
  odswiezKarte(id);odswiezLiczniki();
  if(trybSortowania()!=="ulubione")ulozKarty();
  else{
    clearTimeout(bibUlubTimer);
    bibUlubTimer=setTimeout(()=>{
      const li=B.karty.get(id),przestaw=()=>ulozKarty();
      if(li&&li.isConnected&&li.matches(":hover"))li.addEventListener("pointerleave",przestaw,{once:true});else przestaw();
    },600);
  }
  return B.ulubione.includes(id);
}
function odswiezLiczniki(){
  if(!B.el||!B.el.filtry)return;
  const n={wszystkie:B.wpisy.size,wbudowane:BUILTIN.length,folder:mojeId().length};
  for(const b of B.el.filtry.children){const l=b.querySelector(".biblio-licznik");const v=n[b.dataset.f];l.textContent=v?String(v):"";}
}
function pustyFolder(){if(B.el&&B.el.pusty)B.el.pusty.hidden=!!(mojeId().length||B.ladowanie);}
function pasekFolderu(){
  const box=B.el&&B.el.pasekF;if(!box)return;
  box.replaceChildren();
  const przycisk=(et,fn,glowny)=>{const b=h("button","przycisk maly"+(glowny?" glowny":""),et);b.type="button";b.onclick=fn;return b;};
  if(!fsObslugiwany()){box.append(h("p","biblio-nota",T.folderNieobslugiwany));return;}
  if(!B.dir){box.append(h("p","biblio-nota",T.folderBrak),przycisk(T.folderWskaz,wskazFolder,true));return;}
  if(!B.dirOk){box.append(h("p","biblio-nota",tt("folderBezDostepu",{nazwa:B.dir.name})),przycisk(T.folderDostep,nadajDostep,true));return;}
  const stan=h("span","biblio-folder",tt("folderStan",{nazwa:B.dir.name,n:B.dirPlikow+" "+odmiana(B.dirPlikow,T.piosenka1,T.piosenka2,T.piosenka5)}));
  const odsw=przycisk(B.skanuje?T.folderCzyta:T.folderOdswiez,skanujFolder);odsw.disabled=B.skanuje;
  box.append(stan,odsw,przycisk(T.folderZmien,wskazFolder));
}
function karteczka(tekst){const li=h("li","karteczka");li.setAttribute("role","note");li.append(h("span","",tekst));return li;}

// Karta piosenki: przycisk wyboru (rolka + tytuł + opis) i dwa przyciski obok: podgląd i szuflada.
function kartaWpisu(w){
  let li=B.karty.get(w.id);
  if(!li){
    li=h("li","bkarta");li.dataset.id=w.id;li.style.setProperty("--akcent",akcentPiosenki(w.id));
    const wyb=h("button","bkarta-wybor");wyb.type="button";
    const rolkaBox=h("span","bkarta-rolkabox");
    const cv=h("canvas","bkarta-rolka");cv.setAttribute("aria-hidden","true");cv.dataset.szer="80";cv.dataset.wys="40";
    const zaba=h("img","bkarta-zaba");zaba.alt="";zaba.hidden=true;zaba.src=ZC_ZASOBY.zaby[0];zaba.dataset.k="0";
    rolkaBox.append(cv,zaba);
    const tekst=h("span","bkarta-tekst");tekst.append(h("span","bkarta-tytul",""),h("span","bkarta-meta",""));
    wyb.append(rolkaBox,tekst);
    wyb.onclick=()=>wybierzPiosenkeId(w.id);
    wyb.ondblclick=()=>{if(S.lobbyEkran==="wybor")pokazLobby("konfiguracja");};   // krok 1: dwuklik = Dalej
    const ulub=h("button","przycisk maly bkarta-ulub");ulub.type="button";ulub.innerHTML=ikonaFilc("app/heart","ikona-filc bkarta-ikona");   // 10-15: filc
    ulub.onclick=()=>bibPrzelaczUlubione(w.id);
    const wybierz=h("button","przycisk maly glowny bkarta-wybierz",T.wybierz);wybierz.type="button";
    wybierz.onclick=()=>wybierzIGraj(w.id);
    const akcje=h("span","bkarta-akcje");
    const graj=h("button","przycisk maly bkarta-graj");graj.type="button";
    graj.onclick=()=>{Glos.odblokuj();przelaczPodglad(w.id);};
    const ust=h("button","przycisk maly bkarta-ust");ust.type="button";ust.innerHTML=ikonaFilc("app/gear2","ikona-filc bkarta-ikona");
    ust.onclick=()=>otworzSzuflade(w.id,ust);
    const wyn=h("button","przycisk maly bkarta-wyniki");wyn.type="button";wyn.innerHTML=piktogram("puchar");
    wyn.onclick=()=>Tablica.otworz(w.gra);
    akcje.append(graj,ust,wyn);
    // 10-18 (D-11): kosz tylko na karcie własnego utworu (B.moje); wbudowane i utwory z paczek go nie mają
    if(bibWlasny(w.id)){const usun=h("button","przycisk maly bkarta-usun");usun.type="button";
      usun.innerHTML=ikonaFilc("app/bin","ikona-filc bkarta-ikona");usun.onclick=()=>bibUsunPytaj(w.id);akcje.append(usun);}
    akcje.append(wybierz);
    li.append(wyb,ulub,akcje);
    B.karty.set(w.id,li);
  }
  odswiezKarte(w.id);
  return li;
}
function wstawKarte(w,animuj){
  const li=kartaWpisu(w);
  if(!li.parentNode){B.listy.folder.append(li);ulozKarty();}
  if(animuj){li.style.setProperty("--i","0");li.classList.remove("wchodzi");void li.offsetWidth;li.classList.add("wchodzi");}
  odswiezLiczniki();pustyFolder();
}
function opisZrodla(w){
  if(w.rodzaj==="wbudowana")return w.zr.opis||T.zrodloWbudowana;
  return T["zrodlo_"+w.rodzaj]||T.zPlikuMidi;
}
function odswiezKarte(id){
  const li=B.karty.get(id),w=B.wpisy.get(id);if(!li||!w)return;
  const p=w.gra,wyb=li.querySelector(".bkarta-wybor");
  li.querySelector(".bkarta-tytul").textContent=w.zr.tytul;
  li.title=w.zr.tytul+(w.zr.opis?" · "+w.zr.opis:"");
  const sek=p.koniec*60/p.tempo;
  // wbudowane: sam czas i partie (zakładka mówi, skąd są), opis w dymku; z pliku: najpierw skąd
  let meta=tt(w.rodzaj==="wbudowana"?"biblioMetaKrotko":"biblioMeta",{zrodlo:opisZrodla(w),czas:fmtCzas(sek),partie:liczbaPartii(p.partie.length)});
  if(!p.fragment.caly)meta+=" · "+tt("biblioFragment",{od:p.fragment.od,do:p.fragment.do})+(p.fragment.powtorz>1?tt("biblioPowtorz",{n:p.fragment.powtorz}):"");
  li.querySelector(".bkarta-meta").textContent=meta;
  // krótka wersja (sam czas i partie) dla naszywki w kroku „1 Piosenka”; skąd jest utwór, mówi tam plakat po prawej
  li.querySelector(".bkarta-meta").dataset.krotko=tt("biblioMetaKrotko",{czas:fmtCzas(sek),partie:liczbaPartii(p.partie.length)});
  // krok „1 Piosenka”: dużą etykietą jest utwór wskazany na kole, także zanim koło stanie i zatwierdzi go jako piosenkę
  const wybrana=(typeof idNaKole==="function"?idNaKole():(piosenka()?piosenka().id:null))===id;
  wyb.setAttribute("aria-pressed",String(wybrana));li.classList.toggle("wybrana",wybrana);
  const gra=!!B.podglad&&B.podglad.klucz==="p:"+id,graj=li.querySelector(".bkarta-graj");
  if(gra)graj.textContent=T.stop;else if(!graj.querySelector("img"))graj.innerHTML=ikonaFilc("graj","ikona-filc bkarta-ikona");
  graj.setAttribute("aria-label",gra?T.stop:tt("posluchajAria",{tytul:w.zr.tytul}));
  graj.title=gra?T.stop:T.posluchaj;
  graj.classList.toggle("gra",gra);li.classList.toggle("gra",gra||(!!B.podglad&&B.podglad.klucz==="o:"+id));
  const ust=li.querySelector(".bkarta-ust");ust.setAttribute("aria-label",tt("ustawieniaAria",{tytul:w.zr.tytul}));ust.title=T.ustawieniaPiosenki;
  const wyn=li.querySelector(".bkarta-wyniki");wyn.setAttribute("aria-label",tt("tablicaAria",{tytul:w.zr.tytul}));wyn.title=T.tablica;
  const usun=li.querySelector(".bkarta-usun");if(usun){usun.setAttribute("aria-label",tt("biblioUsunAria",{tytul:w.zr.tytul}));usun.title=T.biblioUsun;}
  const ulub=li.querySelector(".bkarta-ulub"),jestUl=B.ulubione.includes(id);
  ulub.setAttribute("aria-pressed",String(jestUl));li.classList.toggle("ulubiona",jestUl);
  ulub.title=tt(jestUl?"ulubioneUsun":"ulubioneDodaj",{tytul:w.zr.tytul});ulub.setAttribute("aria-label",ulub.title);
  li.querySelector(".bkarta-wybierz").setAttribute("aria-label",tt("wybierzAria",{tytul:w.zr.tytul}));
  // trudność melodii (partia 0) przy obecnym tempie: znaczek przed tytułem karty
  // trudność melodii przy obecnym tempie przed czasem i partiami (tytuł zostaje w całej szerokości karty)
  // utwór z kilkoma partiami: pod liczbą melodii zakres „od–do” wszystkich partii (data-zakres, rysuje arkusz)
  const znTr=znaczekTrudnosci(trudnoscPartiiW(p,0),"maly"),zk=zakresTrudnosci(p);
  if(zk){znTr.dataset.zakres=zk.tekst;znTr.title+=tt("trudnoscZakres",{od:zk.od,do:zk.do});znTr.setAttribute("aria-label",znTr.title);}
  li.querySelector(".bkarta-meta").prepend(znTr,
    znaczekLicencji(w.licencja,()=>Pakiety.szczegoly(w.licencja,w.zr.tytul)));
  if(!gra&&!(B.podglad&&B.podglad.klucz==="o:"+id)){li.querySelector(".bkarta-zaba").hidden=true;rysujRolke(li.querySelector(".bkarta-rolka"),w);}
  if(B.fraza)szukajKarta(li,w);   // szukajka (runda 2): podświetlenie dopasowania i ukrycie wracają po odświeżeniu
}
function bibOdswiez(){for(const id of B.karty.keys())odswiezKarte(id);ppRysuj();}

// ---------------------------------------------------------------------------------------------
// USUWANIE WŁASNEGO UTWORU (10-18, D-11; zasady na górze pliku)
function bibWlasny(id){return B.moje.some(x=>x.id===id);}
// Pytanie w oknie gry (pkOkno z pakiety.js, wzór: pkUsun): „nie” z fokusem na starcie, „tak” różowe; Esc, × i Back pada
// działają jak „nie”, a krzyżak i A chodzą po przyciskach okna (#okno jest na liście nakładek lobby).
function bibPytanie(tytul,tekst,etTak,etNie,naTak){
  const tak=h("button","przycisk maly glowny bib-pytanie-tak",etTak);tak.type="button";
  const nie=h("button","przycisk maly bib-pytanie-nie",etNie);nie.type="button";
  nie.onclick=pkZamknijOkno;
  tak.onclick=()=>{tak.disabled=nie.disabled=true;pkZamknijOkno();naTak();};
  const rzad=h("div","okno-przyciski");rzad.style.cssText="display:flex;gap:10px;justify-content:flex-end;margin-top:14px";
  rzad.append(nie,tak);
  pkOkno(tytul,[h("p","okno-wstep",tekst),rzad]);
  nie.focus({preventScroll:true});
}
function bibUsunPytaj(id){
  const w=B.wpisy.get(id);if(!w||!bibWlasny(id))return;
  bibPytanie(T.biblioUsunTytul,tt("biblioUsunPytanie",{tytul:w.zr.tytul}),T.biblioUsunTak,T.biblioUsunNie,()=>bibUsun(id));
}
// Utwór znika z B.moje i spisu, z B.wpisy razem z kartą, z S.piosenki, ulubionych, „Ostatnio grane” i z IndexedDB (`pliki`).
// Wybrany przechodzi na sąsiada z listy, którą widać; fokus idzie na sąsiada zawsze. Plik w folderze: drugie pytanie.
async function bibUsun(id){
  const w=B.wpisy.get(id),x=B.moje.find(y=>y.id===id);if(!w||!x)return;
  if(podsluchStan().id===id)zatrzymajPodglad();
  if(B.szuflada&&B.szuflada.id===id)zamknijSzuflade();
  const li=B.karty.get(id),lista=li&&li.parentNode,wybrana=!!piosenka()&&piosenka().id===id;
  const sasiad=sasiedniUtwor(lista?[...lista.children].filter(k=>k.classList.contains("bkarta")&&!k.hidden&&k.dataset.id).map(k=>k.dataset.id)
    :posortowaneId([...B.wpisy.keys()]),id);
  B.moje=B.moje.filter(y=>y.id!==id);B.wpisy.delete(id);B.karty.delete(id);if(li)li.remove();
  const i=S.piosenki.findIndex(p=>p.id===id);
  if(i>=0){S.piosenki.splice(i,1);if(i<S.idx)S.idx--;S.idx=Math.max(0,Math.min(S.idx,S.piosenki.length-1));}
  if(S.czekaNaId===id)S.czekaNaId=null;
  if(B.ulubione.includes(id)){B.ulubione=B.ulubione.filter(u=>u!==id);zapiszUlubione();}
  const og=ostatnioGrane();if(id in og){delete og[id];try{localStorage.setItem(ZC_BIBLIO.KLUCZ_OSTATNIO,JSON.stringify(og));}catch(e){}}
  zapiszSpis();ulozKarty();odswiezLiczniki();pustyFolder();
  if(wybrana){const j=sasiad?S.piosenki.findIndex(p=>p.id===sasiad):-1;wybierzPiosenke(j>=0?j:S.idx);}
  // fokus na tę samą kontrolkę sąsiada (kosz, a bez kosza ♥), nie na główny przycisk karty: w Utworach fokus na nim
  // wybiera utwór (lobby-scena.js), a niewybrany usunięty nie zmienia wyboru; pusta zakładka = jej przycisk
  const cel=sasiad&&B.karty.get(sasiad),wyb=cel&&(cel.querySelector(".bkarta-usun")||cel.querySelector(".bkarta-ulub"));
  const fokus=wyb&&wyb.getClientRects().length?wyb:B.el&&B.el.filtry&&B.el.filtry.querySelector('[aria-selected="true"]');
  if(fokus)fokus.focus({preventScroll:true});
  toast(tt("biblioUsuniety",{tytul:w.zr.tytul}));
  await bibIdbDel("pliki",id);
  // plik w folderze (piosenki/): bez dostępu nie da się sprawdzić, więc skan i tak go pominie; z dostępem pytamy osobno
  if(!B.dir)return;
  const u={id,plik:x.plik,hash:w.zr.hash,folder:B.dir.name};
  if(B.dirOk&&!await plikWFolderze(B.dir,u.plik,u.hash))return;   // tego pliku w folderze nie ma (albo pod tą nazwą leży inny)
  B.pominiete=B.pominiete.filter(y=>!(y.folder===u.folder&&y.plik===u.plik)).concat(u);zapiszSpis();
  if(B.dirOk)bibUsunPlikPytaj(u);
}
function bibUsunPlikPytaj(u){
  bibPytanie(T.biblioUsunPlikTytul,tt("biblioUsunPlikPytanie",{plik:u.plik,folder:u.folder}),T.biblioUsunPlikTak,T.biblioUsunPlikNie,async()=>{
    let ok=false;try{ok=!!B.dir&&B.dirOk&&await usunMidiZFolderu(B.dir,u.plik,u.hash);}catch(e){console.warn("piosenki/",e);}
    if(!ok){toast(tt("biblioUsunPlikBlad",{plik:u.plik}),true);return;}
    B.pominiete=B.pominiete.filter(y=>y!==u);zapiszSpis();
    B.dirPlikow=Math.max(0,B.dirPlikow-1);pasekFolderu();
    toast(tt("biblioUsunietyPlik",{plik:u.plik}));
  });
}

// ---------------------------------------------------------------------------------------------
// SZUFLADA „USTAWIENIA PIOSENKI”: żywa rolka (melodia, podkład, fragment), wybór ścieżek jak w trenerze
function zbudujSzuflade(){
  const kol=document.querySelector(".lobby-kolumny");if(!kol||el("szuflada"))return;
  const tlo=h("div","szuflada-tlo");tlo.hidden=true;tlo.onclick=()=>zamknijSzuflade();
  const sz=h("aside","szuflada karta");sz.id="szuflada";sz.hidden=true;
  sz.setAttribute("role","dialog");sz.setAttribute("aria-modal","false");sz.setAttribute("aria-labelledby","szTytul");
  const glowa=h("div","sz-glowa");
  const tyt=h("h2","sz-tytul");tyt.id="szTytul";
  const zamknij=h("button","przycisk maly sz-zamknij","×");zamknij.type="button";zamknij.setAttribute("aria-label",T.szZamknij);zamknij.onclick=()=>zamknijSzuflade();
  glowa.append(tyt,zamknij);
  const rolka=h("canvas","sz-rolka");rolka.dataset.szer="600";rolka.dataset.wys="118";
  rolka.setAttribute("role","img");
  const info=h("p","sz-info","");
  const pola=h("div","sz-pola");
  const pole=(etykieta,kontrolka,klasa)=>{const d=h("label","sz-pole"+(klasa?" "+klasa:""));d.append(h("span","sz-etykieta",etykieta),kontrolka);return d;};
  // nowa melodia = podkład znowu „reszta partii” (inaczej został by np. uproszczony bas pod prawdziwą ścieżką)
  const melodia=h("select","lista");melodia.onchange=()=>ustawParametry(B.szuflada.id,{melodia:+melodia.value,podklad:ZC_PODKLAD.AUTO});
  const podklad=h("select","lista");podklad.onchange=()=>ustawParametry(B.szuflada.id,{podklad:+podklad.value});
  const podzial=h("select","lista");podzial.onchange=()=>ustawParametry(B.szuflada.id,{podzial:+podzial.value});
  const od=h("input","sz-liczba");od.type="number";od.min="1";od.onchange=()=>ustawParametry(B.szuflada.id,{od:+od.value});
  const doT=h("input","sz-liczba");doT.type="number";doT.min="1";doT.onchange=()=>ustawParametry(B.szuflada.id,{do:+doT.value});
  const cala=h("button","przycisk maly",T.szCala);cala.type="button";
  cala.onclick=()=>{const w=B.wpisy.get(B.szuflada.id);ustawParametry(w.id,{od:1,do:w.zr.takty});};
  const frag=h("span","sz-fragment");frag.append(h("span","",T.szOdTaktu),od,h("span","",T.szDoTaktu),doT,cala);
  const powtorz=h("div","segment sz-powtorz");powtorz.setAttribute("role","radiogroup");powtorz.setAttribute("aria-label",T.szPowtorz);
  for(const n of ZC_POWTORZ){const b=h("button","segment-opcja",n+"×");b.type="button";b.dataset.v=String(n);b.setAttribute("role","radio");
    b.onclick=()=>ustawParametry(B.szuflada.id,{powtorz:n});powtorz.append(b);}
  const tempo=h("input","suwak");tempo.type="range";tempo.min="30";tempo.max="200";tempo.step="1";
  const tempoOut=h("output","ust-wartosc","");
  // runda 6b: podczas przeciągania grany podsłuch tej piosenki przebudowuje się na żywo (200 ms spokoju, tylko w pamięci);
  // zapis ustawienia nadal przy puszczeniu (onchange → ustawParametry)
  tempo.oninput=()=>{tempoOut.textContent=tempo.value;clearTimeout(tempo._t);
    tempo._t=setTimeout(()=>{const id=B.szuflada&&B.szuflada.id,s=podsluchStan(),w=id&&B.wpisy.get(id);if(!w||!s.gra||s.id!==id)return;
      B.parametry=zapiszParametryWpisu(B.parametry,id,poprawParametry(w.zr,Object.assign({},w.par,{tempo:+tempo.value})));
      zbudujWpis(w);zarejestruj(w);podsluchWznow(s);},200);};
  tempo.onchange=()=>{ustawParametry(B.szuflada.id,{tempo:+tempo.value});tempo.blur();};
  const tempoReset=h("button","przycisk maly",T.szTempoReset);tempoReset.type="button";
  // „Jak w pliku” = prawdziwe tempo pliku (suwak sięga 200), a nie tempo startowe przycięte do 140
  tempoReset.onclick=()=>{const w=B.wpisy.get(B.szuflada.id),tp=Math.round(w.zr.tempoPliku);
    ustawParametry(w.id,{tempo:tp===Math.round(w.zr.tempo)?null:Math.max(30,Math.min(200,tp))});};
  const tempoBox=h("span","sz-tempo");tempoBox.append(tempo,tempoOut,tempoReset);
  const pMel=pole(T.szMelodia,melodia),pPod=pole(T.szPodklad,podklad),pPodz=pole(T.szPodzial,podzial,"sz-waskie");
  const pFrag=pole(T.szFragment,frag,"sz-szerokie"),pPowt=pole(T.szPowtorz,powtorz),pTempo=pole(T.szTempo,tempoBox,"sz-szerokie");
  pFrag.querySelector(".sz-etykieta").append(h("span","sz-podpowiedz"," · "+T.szZaznacz));
  pola.append(pMel,pPod,pPodz,pFrag,pPowt,pTempo);
  const dol=h("div","sz-przyciski");
  const graj=h("button","przycisk glowny",T.posluchaj);graj.type="button";graj.onclick=()=>{Glos.odblokuj();przelaczPodglad(B.szuflada.id);};
  const oryg=h("button","przycisk",T.szOryginal);oryg.type="button";oryg.title=T.szOryginalOpis;oryg.onclick=()=>{Glos.odblokuj();przelaczOryginal(B.szuflada.id);};
  const dom=h("button","przycisk maly sz-domyslne",T.szDomyslne);dom.type="button";dom.onclick=()=>przywrocDomyslne(B.szuflada.id);
  dol.append(graj,oryg,dom);
  sz.append(glowa,rolka,info,pola,dol);
  kol.append(tlo,sz);
  // zaznaczanie fragmentu przeciąganiem po rolce
  let ciag=null;
  const takt=e=>{const w=B.wpisy.get(B.szuflada.id),r=rolka.getBoundingClientRect(),pad=3;
    const t=(e.clientX-r.left-pad)/Math.max(1,r.width-2*pad)*Math.max(1,w.pelna.koniec);
    return Math.max(1,Math.min(w.zr.takty,Math.floor(t/w.zr.metrum)+1));};
  rolka.addEventListener("pointerdown",e=>{if(!B.szuflada)return;ciag={a:takt(e)};rolka.setPointerCapture(e.pointerId);});
  rolka.addEventListener("pointermove",e=>{if(!ciag)return;const b=takt(e),w=B.wpisy.get(B.szuflada.id);
    w.par=Object.assign({},w.par,{od:Math.min(ciag.a,b),do:Math.max(ciag.a,b)});rysujRolke(rolka,w,{duza:true});});
  rolka.addEventListener("pointerup",e=>{if(!ciag)return;const b=takt(e),a=ciag.a;ciag=null;ustawParametry(B.szuflada.id,{od:Math.min(a,b),do:Math.max(a,b)});});
  rolka.addEventListener("pointercancel",()=>{if(!ciag)return;ciag=null;const w=B.wpisy.get(B.szuflada.id);zbudujWpis(w);rysujRolke(rolka,w,{duza:true});});
  Object.assign(B.el,{szTlo:tlo,sz,szTytul:tyt,szRolka:rolka,szInfo:info,szMelodia:melodia,szPodklad:podklad,szPodzial:podzial,
    szPodzialPole:pPodz,szOd:od,szDo:doT,szPowtorz:powtorz,szTempo:tempo,szTempoOut:tempoOut,szTempoReset:tempoReset,szGraj:graj,szOryg:oryg,szMelPole:pMel});
}
function otworzSzuflade(id,zrodlo){
  const w=B.wpisy.get(id);if(!w)return;
  B.szuflada={id,zrodlo:zrodlo||null};
  wypelnijSzuflade();
  const sz=B.el.sz;sz.hidden=false;B.el.szTlo.hidden=false;
  sz.classList.remove("otwarta");void sz.offsetWidth;sz.classList.add("otwarta");
  rysujRolke(B.el.szRolka,w,{duza:true});
  (B.el.szMelodia.disabled?B.el.szOd:B.el.szMelodia).focus({preventScroll:true});
}
function zamknijSzuflade(){
  if(!B.szuflada)return;
  const zr=B.szuflada.zrodlo;B.szuflada=null;
  if(B.podglad&&/^o:/.test(B.podglad.klucz))zatrzymajPodglad();
  B.el.sz.hidden=true;B.el.szTlo.hidden=true;B.el.sz.classList.remove("otwarta");
  if(zr&&zr.isConnected)zr.focus({preventScroll:true});
}
function wypelnijSzuflade(){
  const s=B.szuflada,w=s&&B.wpisy.get(s.id);if(!w)return;
  const E=B.el,par=w.par,zr=w.zr;
  E.szTytul.textContent=tt("ustawieniaPiosenkiDla",{tytul:zr.tytul});
  const opcje=(sel,lista,wartosc)=>{sel.replaceChildren();for(const [v,et] of lista){const o=h("option","",et);o.value=String(v);sel.append(o);}sel.value=String(wartosc);};
  const sciezki=zr.sciezki.map((x,i)=>[i,x.etykieta]).filter(([i])=>zr.sciezki[i].nuty.length);
  // etykiety ścieżek z podziału po zmianie punktu podziału mówią o nowym punkcie (jak w trenerze)
  const nowe=zr.podzial&&par.podzial!=null&&par.podzial!==zr.podzial.at?podzielPonownie(zr,par.podzial):null;
  const et=(i,e)=>nowe&&i===zr.podzial.ri?nowe.etR:nowe&&i===zr.podzial.li?nowe.etL:e;
  const melodie=sciezki.filter(([i])=>zr.sciezki[i].rodzaj!=="wszystkie"||i===par.melodia);
  opcje(E.szMelodia,melodie.map(([i,e])=>[i,et(i,e)]),par.melodia);
  E.szMelodia.disabled=melodie.length<2;
  const auto=domyslnyPodklad(zr,par.melodia);
  const autoEt=auto>=0?tt("szPodkladAuto",{co:et(auto,zr.sciezki[auto].etykieta)}):T.szPodkladResztaGlosow;
  opcje(E.szPodklad,[[ZC_PODKLAD.AUTO,autoEt],[ZC_PODKLAD.BRAK,T.szBezPodkladu]]
    .concat(sciezki.filter(([i])=>i!==par.melodia).map(([i,e])=>[i,et(i,e)])),par.podklad);
  const podkladTeraz=par.podklad===ZC_PODKLAD.AUTO?auto:par.podklad;
  const sp=zr.podzial,uzywa=sp&&sp.method!=="voices"&&[par.melodia,podkladTeraz].some(i=>i>=0&&zr.sciezki[i]&&zr.sciezki[i].rodzaj==="podzial");
  E.szPodzialPole.hidden=!uzywa;
  if(uzywa){const l=[];for(let m=48;m<=72;m++)l.push([m,noteName(m)+(m===60?" "+T.szSrodkoweC:"")]);opcje(E.szPodzial,l,par.podzial);}
  E.szOd.max=String(zr.takty);E.szDo.max=String(zr.takty);E.szOd.value=String(par.od);E.szDo.value=String(par.do);
  for(const b of E.szPowtorz.children)b.setAttribute("aria-checked",String(+b.dataset.v===par.powtorz));
  const t=par.tempo||zr.tempo;E.szTempo.value=String(t);E.szTempoOut.textContent=String(t);
  E.szTempo.setAttribute("aria-label",T.szTempo);
  const p=w.gra;
  // tempo startowe przycięte do zakresu gry (30–140) mówi o sobie wprost; „Jak w pliku” daje prawdziwe
  const tp=Math.round(zr.tempoPliku),ts=Math.round(zr.tempo);
  let info=tt("szInfo",{melodia:p.partie[0].nuty.length,partie:liczbaPartii(p.partie.length),od:par.od,do:par.do,takty:zr.takty})+" · "+
    (par.tempo==null&&ts!==tp?tt("szTempoStart",{plik:tp,gra:ts})+(ts<tp?T.szTempoKapsel:""):tt("szTempoPliku",{n:tp}));
  E.szTempoReset.title=tt("szTempoPliku",{n:tp});
  // zdanie analizatora tylko wtedy, gdy melodia albo podkład naprawdę pochodzą z uproszczenia albo podziału
  const rodzaje=[par.melodia,podkladTeraz].filter(i=>i>=0&&zr.sciezki[i]).map(i=>zr.sciezki[i].rodzaj);
  if(zr.w&&zr.w.reduced&&rodzaje.includes("uproszczenie"))info+=" · "+tt("szUproszczenie",{powod:zr.w.reduced.why});
  else if(zr.podzial&&zr.podzial.why&&rodzaje.includes("podzial"))info+=" · "+tt("szPodzialInfo",{powod:zr.podzial.why});
  E.szInfo.textContent=info;
  E.szRolka.setAttribute("aria-label",T.szZaznacz);E.szRolka.title=T.szZaznacz;
  E.szOryg.hidden=!(zr.w&&zr.w._all);
  rysujRolke(E.szRolka,w,{duza:true});
  odswiezPrzyciskiSzuflady();
}
function odswiezPrzyciskiSzuflady(){
  const s=B.szuflada;if(!s||!B.el.szGraj)return;
  const P=B.podglad;
  B.el.szGraj.textContent=P&&P.klucz==="p:"+s.id?T.stop:T.posluchaj;
  B.el.szOryg.textContent=P&&P.klucz==="o:"+s.id?T.stop:T.szOryginal;
}

// ---------------------------------------------------------------------------------------------
// PODGLĄD PARTII (prawa kolumna lobby, pod kartami graczy): rolka wybranej partii, reszta partii blado
// w tle, głowica, chipy partii; „▶ Posłuchaj partii” gra ją głosem żab z lobby od głowicy (z cichym
// podkładem reszty albo bez). Klik w rolkę = początek tego taktu; naklejka „wchodzi w takcie N” i dłuższe
// pauzy też są do kliknięcia. Klawiatura tylko z fokusem na rolce: ←/→ o takt, P gra; Spacji i Entera
// nie ruszamy, bo w lobby dołączają graczy z klawiatury.
// Dwa widoki. Mały: cała piosenka w szerokości rolki. Powiększony (klik w tytuł albo „Powiększ”; Esc,
// „Zwiń” i ponowny klik zwijają; stan w localStorage): panel na wysokość kolumny, karty graczy jako paski
// (kapsel, imię, partia), rolka co najmniej ZC_PP_TAKT_MIN px na takt, przewijana kółkiem, przeciąganiem
// i paskiem całości nad rolką, a w czasie odsłuchu jadąca za głowicą. W obu widokach ten sam klikNaTakt
// (w powiększonym z przesunięciem przewijania) i numery taktów piosenki: przy fragmencie od jego
// pierwszego taktu, przy powtórce znowu od niego.
const ppGra=()=>!!B.podglad&&/^pp:/.test(B.podglad.klucz);
const ppMaloRuchu=()=>!!(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches);
function ppPiosenka(){return piosenka();}
function ppPartia(){const p=ppPiosenka();if(!p)return null;if(B.pp.partia>=p.partie.length)B.pp.partia=0;return p.partie[B.pp.partia];}
function ppNowaPiosenka(){
  const p=ppPiosenka();if(!p||B.pp.piosenka===p.id)return;
  if(ppGra())zatrzymajPodglad();
  ppWyborZamknij(false);
  B.pp.piosenka=p.id;B.pp.glowica=0;B.pp.przesun=B.pp.cel=0;
  const zap=B.parametry[p.id];
  B.pp.partia=zap&&Number.isInteger(zap.podglad)&&zap.podglad<p.partie.length?zap.podglad:0;
}
function bibPokazPartie(idx,graczId){
  const p=ppPiosenka();if(!p)return;
  ppNowaPiosenka();
  idx=Math.max(0,Math.min(p.partie.length-1,idx|0));
  const zmiana=idx!==B.pp.partia;
  B.pp.partia=idx;B.pp.gracz=graczId||null;
  if(zmiana){
    const grala=ppGra();
    if(grala)zatrzymajPodglad();
    // ostatnio podglądana partia zapamiętana per piosenka razem z parametrami (bez przebudowy modeli)
    B.parametry=zapiszParametryWpisu(B.parametry,p.id,Object.assign({},B.parametry[p.id]||{},{podglad:idx}));
    zapiszSpis();zapiszDoFolderuPozniej();
    if(grala)ppGraj();
  }
  ppRysuj();
}
// WIELE PARTII: powyżej ZC_PP_CHIPY_MAX partii (albo gdy chipy nie mieszczą się w nagłówku) pasek chipów
// ustępuje jednemu przyciskowi z bieżącą partią (nazwa, trudność, kto śpiewa, „7 partii ▾”) i rozwijanej
// liście wszystkich partii z notką „wchodzi w takcie · nuty · zakres”. Lista leży w <body>, żeby nie
// przycinał jej panel ani kolumna; otwiera się pod przyciskiem, a gdy tam brakuje miejsca, nad nim.
// Strzałki chodzą po liście, Enter wybiera, Esc zamyka i oddaje fokus przyciskowi. Klawisze idą ze
// stopPropagation: w kroku Rozgrywka nie dołączają graczy z klawiatury ani nie cofają ekranu.
const ZC_PP_KROPKI_MAX=12;   // tyle kropek ścieżek mieści przycisk wyboru partii, reszta jako „+n”
const ZC_PP_CHIPY_MAX=0;   // zawsze rozwijana lista, jak przy wyborze piosenki; było 3 (chipy do 3 partii)
const ppWyborOtwarty=()=>!!(B.el&&B.el.ppWyborLista&&!B.el.ppWyborLista.hidden);
function ppKtoSpiewa(i){
  const kto=S.gracze.filter(g=>g.partia===i).map(g=>g.nazwa);
  return {kto,tekst:!kto.length?"":kto.length<=3?tt("ppSpiewa",{kto:kto.join(", ")}):tt("ppSpiewaWiecej",{kto:kto.slice(0,2).join(", "),n:kto.length-2})};
}
function ppWyborZbuduj(){
  const E=B.el,p=ppPiosenka();if(!E||!E.ppWybor||!p)return;
  const i0=B.pp.partia,x=ppPartia(),prz=E.ppWyborPrzycisk,ks=ppKtoSpiewa(i0);
  prz.replaceChildren(h("span","pp-wybor-nazwa",nazwaPartii(x)),znaczekTrudnosci(trudnoscPartiiW(p,i0),"maly"));
  if(ks.tekst)prz.append(h("span","pp-kto",ks.tekst));
  // ścieżki utworu: po kropce na partię w jej kolorze, bieżąca większa. Od razu widać, ile ich jest i którą słychać,
  // a przy więcej niż jednej przycisk zaprasza pulsowaniem (klasa .wiele, gry-piosenka.css)
  const sc=h("span","pp-sciezki");sc.setAttribute("aria-hidden","true");
  p.partie.slice(0,ZC_PP_KROPKI_MAX).forEach((y,i)=>{const k=h("i",i===i0?"tu":"");
    k.style.setProperty("--akcent",ZC_TORY_STYL[i%ZC_TORY_STYL.length].akcent);k.style.setProperty("--i",String(i));sc.append(k);});
  if(p.partie.length>ZC_PP_KROPKI_MAX)sc.append(h("b",i0>=ZC_PP_KROPKI_MAX?"tu":"","+"+(p.partie.length-ZC_PP_KROPKI_MAX)));
  prz.append(sc,h("span","pp-wybor-ile",liczbaPartii(p.partie.length)));
  prz.classList.toggle("wiele",p.partie.length>1);
  for(const b of E.ppWyborStrz||[])b.disabled=p.partie.length<2;   // jedna partia: strzałki nie mają dokąd iść
  prz.style.setProperty("--akcent",ZC_TORY_STYL[i0%ZC_TORY_STYL.length].akcent);
  prz.title=(ks.kto.length?ks.kto.join(", ")+" · ":"")+T.ppWyborOpis;
  prz.setAttribute("aria-label",tt("ppWyborAria",{nazwa:nazwaPartii(x),n:i0+1,z:p.partie.length}));
  const L=E.ppWyborLista;L.replaceChildren();
  p.partie.forEach((y,i)=>{
    const o=h("button","pp-opcja");o.type="button";o.setAttribute("role","option");o.setAttribute("aria-selected",String(i===i0));o.tabIndex=-1;
    o.style.setProperty("--akcent",ZC_TORY_STYL[i%ZC_TORY_STYL.length].akcent);
    o.append(h("span","pp-opcja-kropka"),h("span","pp-opcja-nazwa",nazwaPartii(y)),znaczekTrudnosci(trudnoscPartiiW(p,i),"maly"));
    const notka=[notkaPartii(y,p.metrum,p.fragment),ppKtoSpiewa(i).tekst].filter(Boolean).join(" · ");
    if(notka)o.append(h("span","pp-opcja-notka",notka));
    o.onclick=()=>{ppWyborZamknij(true);bibPokazPartie(i,null);};
    L.append(o);
  });
}
// Położenie listy: szerokość co najmniej przycisku, w oknie; w dół, gdy się mieści albo gdy pod jest więcej miejsca niż nad.
function ppWyborUloz(){
  const E=B.el,L=E&&E.ppWyborLista,prz=E&&E.ppWyborPrzycisk;if(!L||L.hidden)return;
  const r=prz.getBoundingClientRect(),vw=innerWidth,vh=innerHeight,m=8;
  L.style.width=Math.min(Math.max(r.width,280),vw-2*m)+"px";
  L.style.left=Math.max(m,Math.min(vw-m-L.offsetWidth,r.left))+"px";
  L.style.maxHeight="";
  const h0=L.offsetHeight,pod=vh-r.bottom-4-m,nad=r.top-4-m;
  if(h0<=pod||pod>=nad){L.style.top=(r.bottom+4)+"px";L.style.maxHeight=Math.max(80,pod)+"px";L.classList.remove("w-gore");}
  else{const hh=Math.min(h0,Math.max(80,nad));L.style.maxHeight=hh+"px";L.style.top=(r.top-4-hh)+"px";L.classList.add("w-gore");}
}
function ppWyborOtworz(){
  const E=B.el;if(!E||!E.ppWybor||E.ppWybor.hidden||ppWyborOtwarty())return;
  ppWyborZbuduj();
  const L=E.ppWyborLista;L.hidden=false;E.ppWyborPrzycisk.setAttribute("aria-expanded","true");
  ppWyborUloz();
  const akt=L.querySelector('[aria-selected="true"]')||L.firstElementChild;
  if(akt){akt.focus({preventScroll:true});akt.scrollIntoView({block:"nearest"});}
  B.pp.wyborPoza=e=>{if(!L.contains(e.target)&&!E.ppWyborPrzycisk.contains(e.target))ppWyborZamknij(false);};
  B.pp.wyborUloz=e=>{if(!e||e.target!==L)ppWyborUloz();};
  addEventListener("pointerdown",B.pp.wyborPoza,true);
  addEventListener("resize",B.pp.wyborUloz);addEventListener("scroll",B.pp.wyborUloz,true);
}
function ppWyborZamknij(fokus){
  const E=B.el;if(!ppWyborOtwarty())return;
  E.ppWyborLista.hidden=true;E.ppWyborPrzycisk.setAttribute("aria-expanded","false");
  removeEventListener("pointerdown",B.pp.wyborPoza,true);
  removeEventListener("resize",B.pp.wyborUloz);removeEventListener("scroll",B.pp.wyborUloz,true);
  if(fokus)E.ppWyborPrzycisk.focus({preventScroll:true});
}
function zbudujPodgladPartii(){
  const box=el("podgladPartii");if(!box||box.dataset.gotowy)return;
  box.dataset.gotowy="1";box.replaceChildren();
  const glowa=h("div","pp-glowa");
  const tytul=h("button","pp-tytul",T.ppTytul);tytul.type="button";tytul.id="ppTytul";tytul.onclick=()=>ppRozwin();
  const chipy=h("div","pp-chipy");chipy.setAttribute("role","tablist");chipy.setAttribute("aria-label",T.ppPartie);
  const powieksz=h("button","przycisk maly pp-powieksz",T.ppPowieksz);powieksz.type="button";
  powieksz.setAttribute("aria-controls","podgladPartii");powieksz.onclick=()=>ppRozwin();
  // wiele partii: przycisk bieżącej partii zamiast chipów + lista w <body> (ppWyborOtworz)
  const wybor=h("div","pp-wybor");wybor.hidden=true;
  const wyborPrz=h("button","pp-wybor-przycisk");wyborPrz.type="button";wyborPrz.id="ppWybor";
  wyborPrz.setAttribute("aria-haspopup","listbox");wyborPrz.setAttribute("aria-expanded","false");wyborPrz.setAttribute("aria-controls","ppWyborLista");
  const wyborLista=h("div","pp-wybor-lista");wyborLista.id="ppWyborLista";wyborLista.hidden=true;
  wyborLista.setAttribute("role","listbox");wyborLista.setAttribute("aria-labelledby","ppWybor");
  // strzałki po bokach przycisku (11-19): poprzednia i następna partia bez rozwijania listy, w kółko
  const wybL=h("button","pp-wybor-strz","‹"),wybP=h("button","pp-wybor-strz","›");
  for(const [b,k,t] of [[wybL,-1,T.ppPartiaPoprzednia],[wybP,1,T.ppPartiaNastepna]]){
    b.type="button";b.title=t;b.setAttribute("aria-label",t);
    b.onclick=()=>{const p=ppPiosenka(),n=p?p.partie.length:0;if(n<2)return;ppWyborZamknij(false);bibPokazPartie(((B.pp.partia+k)%n+n)%n,null);};
  }
  B.el.ppWyborStrz=[wybL,wybP];
  wybor.append(wybL,wyborPrz,wybP);document.body.append(wyborLista);
  wyborPrz.onclick=()=>{if(ppWyborOtwarty())ppWyborZamknij(true);else ppWyborOtworz();};
  wyborPrz.addEventListener("keydown",e=>{
    if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();e.stopPropagation();ppWyborOtworz();}
    else if(e.key==="Enter"||e.key===" ")e.stopPropagation();   // natywny klik otwiera; nie dołącza gracza z klawiatury
    else if(e.key==="Escape"&&ppWyborOtwarty()){e.preventDefault();e.stopPropagation();ppWyborZamknij(true);}
  });
  wyborLista.addEventListener("keydown",e=>{
    const ops=[...wyborLista.children],i=ops.indexOf(document.activeElement);
    const idz=k=>{e.preventDefault();e.stopPropagation();const o=ops[(k+ops.length)%ops.length];if(o){o.focus({preventScroll:true});o.scrollIntoView({block:"nearest"});}};
    if(e.key==="ArrowDown")idz(i+1);else if(e.key==="ArrowUp")idz(i-1);else if(e.key==="Home")idz(0);else if(e.key==="End")idz(ops.length-1);
    else if(e.key==="Escape"){e.preventDefault();e.stopPropagation();ppWyborZamknij(true);}
    else if(e.key==="Tab")ppWyborZamknij(true);   // fokus wraca na przycisk i Tab idzie dalej jak zwykle
    else if(e.key==="Enter"||e.key===" ")e.stopPropagation();   // natywny klik opcji wybiera partię
  });
  glowa.append(tytul,chipy,wybor,powieksz);
  const rolkaBox=h("div","pp-rolkabox");
  // pasek całości (tylko w powiększonym widoku): cała piosenka, okno kadru i głowica
  const mapa=h("canvas","pp-mapa");mapa.title=T.ppMapa;mapa.setAttribute("aria-hidden","true");
  const cv=h("canvas","pp-rolka");cv.tabIndex=0;
  const zaba=h("img","pp-zaba");zaba.alt="";zaba.hidden=true;zaba.src=ZC_ZASOBY.zaby[0];zaba.dataset.k="0";
  const wejscie=h("button","pp-wejscie");wejscie.type="button";wejscie.hidden=true;
  const takt=h("span","pp-takt");takt.hidden=true;takt.setAttribute("aria-hidden","true");
  rolkaBox.append(mapa,cv,zaba,wejscie,takt);
  const dol=h("div","pp-dol");
  const graj=h("button","przycisk maly glowny pp-graj",T.ppPosluchaj);graj.type="button";
  graj.onclick=()=>{Glos.odblokuj();ppPrzelacz();};
  const przel=h("button","przel");przel.type="button";przel.setAttribute("role","switch");przel.append(h("span","przel-galka"));
  przel.id="ppPodklad";
  przel.onclick=()=>{B.pp.zPodkladem=!B.pp.zPodkladem;przel.setAttribute("aria-checked",String(B.pp.zPodkladem));
    if(ppGra()){zatrzymajPodglad();ppGraj();}};
  const etP=h("label","pp-podklad",T.ppZPodkladem);etP.htmlFor="ppPodklad";
  const info=h("span","pp-info","");
  const wiersz=h("span","pp-przel");wiersz.append(przel,etP);
  // instrument żaby w podglądzie (krok „1 Piosenka”): strzałki zmieniają głos, którym żaba śpiewa melodię
  const instr=h("span","pp-instr");instr.setAttribute("role","group");instr.setAttribute("aria-label",T.ppInstrument);
  const iL=h("button","pp-instr-strz","‹"),iP=h("button","pp-instr-strz","›"),iOb=h("span","pp-instr-obraz"),iNz=h("span","pp-instr-nazwa","");
  iL.type="button";iP.type="button";iL.setAttribute("aria-label",T.ppInstrumentPoprzedni);iP.setAttribute("aria-label",T.ppInstrumentNastepny);
  iL.title=T.ppInstrumentPoprzedni;iP.title=T.ppInstrumentNastepny;iOb.setAttribute("aria-hidden","true");iNz.setAttribute("aria-live","polite");
  iL.onclick=()=>ppZmienInstrument(-1);iP.onclick=()=>ppZmienInstrument(1);
  const iSr=h("span","pp-instr-srodek");iSr.append(iOb,iNz);instr.append(iL,iSr,iP);
  B.el.ppInstr={box:instr,obraz:iOb,nazwa:iNz,lewo:iL,prawo:iP,v:null};
  // silnik MIDI: charakter podkładu (zestaw brzmień basu, środka i góry), te same strzałki co przy instrumencie żaby
  const sil=h("span","pp-instr pp-silnik");sil.setAttribute("role","group");sil.setAttribute("aria-label",T.ppSilnik);
  const sL=h("button","pp-instr-strz","‹"),sP=h("button","pp-instr-strz","›"),sOb=h("span","pp-instr-obraz","MIDI"),sNz=h("span","pp-instr-nazwa","");
  sL.type="button";sP.type="button";sL.setAttribute("aria-label",T.ppSilnikPoprzedni);sP.setAttribute("aria-label",T.ppSilnikNastepny);
  sL.title=T.ppSilnikPoprzedni;sP.title=T.ppSilnikNastepny;sOb.setAttribute("aria-hidden","true");sNz.setAttribute("aria-live","polite");
  sL.onclick=()=>ppZmienSilnik(-1);sP.onclick=()=>ppZmienSilnik(1);
  const sSr=h("span","pp-instr-srodek");sSr.append(sOb,sNz);sil.append(sL,sSr,sP);
  B.el.ppSilnik={box:sil,nazwa:sNz,v:null};
  dol.append(graj,wiersz,instr,sil,info);
  // mały widok: rolka i przyciski obok siebie (karty graczy mieszczą się nad panelem);
  // powiększony: przyciski pod rolką, rolka na całą szerokość panelu
  const srodek=h("div","pp-srodek");srodek.append(rolkaBox,dol);
  box.append(glowa,srodek);
  // takt pod wskaźnikiem: ten sam klikNaTakt w obu widokach, w powiększonym z przesunięciem przewijania
  const taktRolki=e=>{const r=cv.getBoundingClientRect(),g=ppGeo();return g?klikNaTakt(e.clientX-r.left+g.przesun,g.pelna,g.pad,g.koniec,g.metrum):1;};
  const taktMapy=e=>{const r=mapa.getBoundingClientRect(),p=ppPiosenka();return klikNaTakt(e.clientX-r.left,r.width,ZC_PP_PAD,Math.max(1,p.koniec),p.metrum);};
  // dymek „takt N”: w małym widoku nad rolką (CSS), w powiększonym przy wskaźniku na rolce albo nad paskiem całości
  const pokazTakt=(n,x,y)=>{
    const p=ppPiosenka();takt.hidden=false;takt.textContent=tt("ppTakt",{n:taktPiosenki(n,p.fragment)});
    takt.style.left=Math.max(0,Math.min((rolkaBox.clientWidth||520)-60,x+8))+"px";
    takt.style.top=y==null?"":y+"px";
  };
  // klik w rolkę: początek taktu (w pauzie: koniec pauzy, czyli powrót partii); najechanie: numer taktu
  cv.addEventListener("click",e=>{
    if(B.pp.przeciagniete)return;   // to było przewijanie przeciąganiem, nie klik
    const p=ppPiosenka(),g=ppGeo();if(!p||!g)return;
    const r=cv.getBoundingClientRect(),b=(e.clientX-r.left+g.przesun-g.pad)/g.px;
    const pz=pauzyPartii(ppPartia().nuty,p.metrum,p.koniec).find(x=>b>=x.od&&b<x.do);
    if(pz&&pz.do<p.koniec-1e-6){ppSkocz(Math.floor(pz.do/p.metrum+1e-9)+1);return;}
    ppSkocz(taktRolki(e),true);
  });
  // powiększony widok: przeciągnięcie rolki przewija ją (klik bez ruchu nadal ustawia głowicę)
  cv.addEventListener("pointerdown",e=>{if(B.pp.duzy&&e.button===0)B.pp.ciag={id:e.pointerId,x0:e.clientX,p0:B.pp.przesun,ruszyl:false};});
  cv.addEventListener("pointermove",e=>{
    const c=B.pp.ciag;
    if(c&&c.id===e.pointerId){
      if(!c.ruszyl&&Math.abs(e.clientX-c.x0)>4){c.ruszyl=true;try{cv.setPointerCapture(e.pointerId);}catch(x){}cv.classList.add("ciagnie");}
      if(c.ruszyl){ppPrzewin(c.p0-(e.clientX-c.x0));takt.hidden=true;return;}
    }
    if(!ppPiosenka())return;
    const r=cv.getBoundingClientRect();
    pokazTakt(taktRolki(e),e.clientX-r.left,B.pp.duzy?cv.offsetTop+Math.max(2,e.clientY-r.top-28):null);
  });
  const pusc=e=>{
    const c=B.pp.ciag;if(!c||c.id!==e.pointerId)return;
    B.pp.ciag=null;cv.classList.remove("ciagnie");
    if(c.ruszyl&&e.type==="pointerup"){B.pp.przeciagniete=true;setTimeout(()=>{B.pp.przeciagniete=false;},0);}
  };
  cv.addEventListener("pointerup",pusc);cv.addEventListener("pointercancel",pusc);
  cv.addEventListener("pointerleave",()=>{if(!B.pp.ciag)takt.hidden=true;});
  cv.addEventListener("keydown",e=>{
    const p=ppPiosenka();if(!p)return;
    if(e.key==="ArrowRight"||e.key==="ArrowLeft"){
      e.preventDefault();e.stopPropagation();
      const teraz=Math.floor(ppGlowica()/p.metrum+1e-9)+1;ppSkocz(teraz+(e.key==="ArrowRight"?1:-1));
    }else if(e.key==="p"||e.key==="P"){e.preventDefault();e.stopPropagation();Glos.odblokuj();ppPrzelacz();}
  });
  // kółko (i przesuw dwoma palcami) przewija powiększoną rolkę w poziomie
  rolkaBox.addEventListener("wheel",e=>{
    if(!B.pp.duzy)return;
    const g=ppGeo();if(!g||g.maks<=0)return;
    const d=(Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY)*(e.deltaMode===1?16:e.deltaMode===2?g.szer:1);
    if(!d)return;
    e.preventDefault();ppPrzewin(B.pp.przesun+d);
  },{passive:false});
  // pasek całości: klik = skok do taktu, przeciąganie = przewijanie kadru
  mapa.addEventListener("pointerdown",e=>{
    if(e.button!==0)return;e.preventDefault();
    try{mapa.setPointerCapture(e.pointerId);}catch(x){}
    B.pp.mapaCiag={id:e.pointerId,x0:e.clientX,ruszyl:false};
  });
  mapa.addEventListener("pointermove",e=>{
    const p=ppPiosenka();if(!p)return;
    const r=mapa.getBoundingClientRect(),c=B.pp.mapaCiag;
    if(c&&c.id===e.pointerId){
      if(!c.ruszyl&&Math.abs(e.clientX-c.x0)>3)c.ruszyl=true;
      if(c.ruszyl){
        const g=ppGeo(),b=(e.clientX-r.left-ZC_PP_PAD)/Math.max(1,r.width-2*ZC_PP_PAD)*Math.max(1,p.koniec);
        ppPrzewin(g.pad+b*g.px-g.szer/2);takt.hidden=true;return;
      }
    }
    pokazTakt(taktMapy(e),e.clientX-r.left,mapa.offsetTop-22);
  });
  mapa.addEventListener("pointerup",e=>{
    const c=B.pp.mapaCiag;if(!c||c.id!==e.pointerId)return;
    B.pp.mapaCiag=null;
    if(!c.ruszyl)ppSkocz(taktMapy(e));
  });
  mapa.addEventListener("pointercancel",()=>{B.pp.mapaCiag=null;});
  mapa.addEventListener("pointerleave",()=>{if(!B.pp.mapaCiag)takt.hidden=true;});
  wejscie.onclick=()=>{const p=ppPiosenka(),t=taktWejscia(ppPartia().nuty,p.metrum);if(t)ppSkocz(t);};
  Object.assign(B.el,{pp:box,ppKol:box.closest(".kol-gracze"),ppNaglowek:tytul,ppPowieksz:powieksz,ppChipy:chipy,ppWybor:wybor,ppWyborPrzycisk:wyborPrz,ppWyborLista:wyborLista,ppBox:rolkaBox,
    ppMapa:mapa,ppRolka:cv,ppZaba:zaba,ppWejscie:wejscie,ppTakt:takt,ppGraj:graj,ppPrzel:przel,ppInfo:info});
  ppUstawKlasy(false);
  // płótna rysują się od nowa, gdy zmieni się ich rozmiar (okno, liczba graczy, rozwinięcie panelu)
  if(typeof ResizeObserver==="function"){
    let raf=0;new ResizeObserver(()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>ppOdswiezWidok());}).observe(rolkaBox);
  }
  addEventListener("resize",()=>ppRysuj());
}
// Powiększenie panelu: bez argumentu przełącza. Karty graczy zwijają się do pasków (CSS na kolumnie).
function ppRozwin(on){
  on=on==null?!B.pp.duzy:!!on;
  if(on===B.pp.duzy||!B.el||!B.el.pp)return;
  B.pp.duzy=on;B.pp.reczny=0;B.pp.ciag=null;B.pp.mapaCiag=null;
  ppUstawKlasy(true);
  zapiszSpis();
  B.pp.przesun=B.pp.cel=0;
  ppPokaz(ppGlowica(),true);   // głowica w kadrze od razu po rozwinięciu
  ppRysuj();
}
function ppUstawKlasy(animuj){
  const E=B.el,box=E&&E.pp;if(!box)return;
  const on=B.pp.duzy,kol=E.ppKol=box.closest(".kol-gracze");   // podgląd wędruje między krokiem 1 i 2 (bibOsadz)
  box.classList.toggle("rozwiniety",on);if(kol)kol.classList.toggle("pp-rozwiniety",on);
  if(kol&&typeof dopasujSiatkeGraczy==="function")dopasujSiatkeGraczy();   // 10-15: po zwinięciu podgląd znów może się nie mieścić przy 3+ graczach
  E.ppPowieksz.textContent=on?T.ppZwin:T.ppPowieksz;
  E.ppPowieksz.title=on?T.ppZwinOpis:T.ppPowiekszOpis;
  for(const b of [E.ppNaglowek,E.ppPowieksz])b.setAttribute("aria-expanded",String(on));
  if(animuj&&kol&&!ppMaloRuchu()){
    kol.classList.remove("pp-wjazd");void kol.offsetWidth;kol.classList.add("pp-wjazd");
    clearTimeout(B.pp.wjazdT);B.pp.wjazdT=setTimeout(()=>kol.classList.remove("pp-wjazd"),320);
  }
}
// Geometria rolki w bieżącym widoku (px na ćwierćnutę, pełna szerokość, przesunięcie przewijania).
function ppGeo(){
  const cv=B.el&&B.el.ppRolka,p=ppPiosenka();if(!cv||!p)return null;
  const szer=cv.clientWidth||520,koniec=Math.max(1,p.koniec),g=geometriaRolki(szer,koniec,p.metrum,B.pp.duzy);
  B.pp.przesun=B.pp.duzy?Math.max(0,Math.min(g.maks,B.pp.przesun||0)):0;
  return Object.assign(g,{szer,przesun:B.pp.przesun,koniec,metrum:p.metrum});
}
// Ręczne przewinięcie (kółko, przeciąganie, pasek całości): przez chwilę widok nie jedzie za głowicą.
function ppPrzewin(x){
  const g=ppGeo();if(!g)return;
  B.pp.przesun=B.pp.cel=Math.max(0,Math.min(g.maks,x));B.pp.reczny=performance.now();
  if(!ppGra())ppOdswiezWidok();   // grający podgląd rysuje się w swojej klatce
}
// Głowica w kadrze: poza pasem 6–85% szerokości widok jedzie tak, żeby stała na 30% (płynnie albo od razu).
function ppPokaz(beat,natychmiast){
  if(!B.pp.duzy)return;
  const g=ppGeo();if(!g||g.maks<=0)return;
  const x=g.pad+beat*g.px;
  if(x>=g.przesun+g.szer*.06&&x<=g.przesun+g.szer*.85)return;
  const cel=Math.max(0,Math.min(g.maks,x-g.szer*.3));
  if(natychmiast||ppMaloRuchu()){B.pp.przesun=B.pp.cel=cel;return;}
  ppJedz(cel);
}
// Płynny przejazd kadru (bez grającego podglądu): co klatkę piąta część drogi, koniec poniżej pół piksela.
function ppJedz(cel){
  B.pp.cel=cel;
  if(B.pp.jedzie)return;
  B.pp.jedzie=true;
  const krok=()=>{
    if(!B.pp.duzy||ppGra()){B.pp.jedzie=false;return;}
    const d=B.pp.cel-B.pp.przesun;
    if(Math.abs(d)<.5)B.pp.przesun=B.pp.cel;else B.pp.przesun+=d*.2;
    ppOdswiezWidok();
    if(B.pp.przesun===B.pp.cel){B.pp.jedzie=false;return;}
    requestAnimationFrame(krok);
  };
  requestAnimationFrame(krok);
}
// W czasie odsłuchu głowica dochodzi do 40% szerokości i dalej stoi, a nuty jadą (po ręcznym przewinięciu
// kadr czeka 1,5 s); głowica, która wyskoczyła w lewo poza kadr, wraca na 20%.
function ppJedzZaGlowica(beat){
  const g=ppGeo();if(!g||g.maks<=0||performance.now()-(B.pp.reczny||0)<1500)return;
  const x=g.pad+beat*g.px-g.przesun;
  let cel=g.przesun;
  if(x>g.szer*.4)cel=g.przesun+x-g.szer*.4;
  else if(x<g.szer*.04)cel=g.przesun+x-g.szer*.2;
  cel=Math.max(0,Math.min(g.maks,cel));
  const d=cel-g.przesun;
  B.pp.przesun=ppMaloRuchu()||Math.abs(d)<.3?cel:g.przesun+d*.22;
  B.pp.cel=B.pp.przesun;
}
function ppGlowica(){
  const P=B.podglad;
  if(P&&/^pp:/.test(P.klucz))return P.od+(P.h.teraz()-P.start)/P.spb;
  return B.pp.glowica;
}
// Skok do taktu rolki (od 1). Klik w widoczny takt nie przewija; strzałki, naklejka, pauza i pasek całości tak.
function ppSkocz(takt,bezPrzewijania){
  const p=ppPiosenka();if(!p)return;
  const takty=Math.max(1,Math.ceil(p.koniec/p.metrum-1e-9));
  takt=Math.max(1,Math.min(takty,takt));
  const grala=ppGra();
  if(grala)zatrzymajPodglad();
  B.pp.glowica=(takt-1)*p.metrum;B.pp.reczny=0;
  if(!bezPrzewijania&&!grala)ppPokaz(B.pp.glowica);
  if(grala)ppGraj();else ppRysuj();
}
function ppPrzelacz(){if(ppGra()){zatrzymajPodglad();ppRysuj();}else ppGraj();}
// Instrument żaby w podglądzie = „Instrument nowego gracza” z ustawień (S.ust.glos), bo tym głosem podgląd śpiewa
// melodię (grajPodglad). Strzałki chodzą po instrumentach zdobytych przez kogokolwiek na tym komputerze, tak jak lista
// w ustawieniach. Grający podgląd wznawia się nowym brzmieniem w tym samym miejscu, stojący daje krótką próbkę.
function ppInstrumenty(){
  const baza=Glos.INSTRUMENTY_GRACZA;let ma=null;
  try{ma=typeof instrumentyZdobyteGdziekolwiek==="function"?instrumentyZdobyteGdziekolwiek():null;}catch(e){}
  const L=baza.filter(v=>!ma||ma.has(v)||v===S.ust.glos);
  return L.length?L:baza.slice(0,1);
}
function ppRysujInstrument(){
  const E=B.el&&B.el.ppInstr;if(!E)return;
  const L=ppInstrumenty(),v=L.includes(S.ust.glos)?S.ust.glos:L[0],klucz=v+"|"+L.length;
  if(E.v===klucz)return;E.v=klucz;
  const nz=(T.instrumentyGracza&&T.instrumentyGracza[v])||v;
  try{obrazInstrumentu(E.obraz,v);}catch(e){E.obraz.replaceChildren();}
  E.nazwa.textContent=nz;E.box.title=tt("ppInstrumentOpis",{nazwa:nz});
  E.lewo.disabled=E.prawo.disabled=L.length<2;
}
// Silnik MIDI w podglądzie (S.ust.silnikMidi, ta sama lista co w ustawieniach kroku 2): grający podgląd wznawia się
// nowym brzmieniem w tym samym miejscu, stojący gra krótką próbkę zestawu (bas, akord środka, nuta góry).
function ppRysujSilnik(){
  const E=B.el&&B.el.ppSilnik;if(!E)return;
  const v=ZC_SILNIKI_MIDI.hasOwnProperty(S.ust.silnikMidi)?S.ust.silnikMidi:"jeden";
  if(E.v===v)return;E.v=v;
  const nz=(T.silnikiMidi&&T.silnikiMidi[v])||v;
  E.nazwa.textContent=nz;E.box.title=tt("ppSilnikOpis",{nazwa:nz});
}
function ppZmienSilnik(kier){
  const L=Object.keys(ZC_SILNIKI_MIDI),n=L.length;
  const v=L[((Math.max(0,L.indexOf(S.ust.silnikMidi))+kier)%n+n)%n];
  ustaw("silnikMidi",v);ppRysujSilnik();
  try{odswiezUstawienia();}catch(e){}
  try{Glos.odblokuj();}catch(e){}
  if(ppGra()){zatrzymajPodglad();ppGraj();return;}
  try{if(Glos.stopProbka)Glos.stopProbka();
    const b=S.ust.instrument;
    for(const [m,za,d] of [[43,0,.5],[60,.16,.42],[64,.16,.42],[67,.16,.42],[79,.42,.6]])Glos.nuta(barwaPodkladu(b,m),m,za,d,false,poziomPodkladu(.9,m));}catch(e){}
}
function ppZmienInstrument(kier){
  const L=ppInstrumenty(),n=L.length;if(n<2)return;
  const v=L[((Math.max(0,L.indexOf(S.ust.glos))+kier)%n+n)%n];
  ustaw("glos",v);ppRysujInstrument();
  try{odswiezUstawienia();}catch(e){}   // lista „Instrument nowego gracza” w ustawieniach pokazuje ten sam wybór
  try{Glos.odblokuj();}catch(e){}
  if(ppGra()){zatrzymajPodglad();ppGraj();}else{try{Glos.probka(v);}catch(e){}}
}
function ppGraj(){
  const p=ppPiosenka(),x=ppPartia();if(!p||!x)return;
  if(B.pp.glowica>=p.koniec-1e-6)B.pp.glowica=0;
  const od=B.pp.glowica,mel=x.nuty.filter(n=>n.t>=od-1e-6).map(n=>({m:n.m,t:n.t-od,d:n.d})),pod=[];
  if(B.pp.zPodkladem){
    p.partie.forEach((y,i)=>{if(i===B.pp.partia)return;for(const n of y.nuty)if(n.t>=od-1e-6)pod.push({m:n.m,t:n.t-od,d:n.d,poziom:.4,p:y.program});});
    for(const n of (p.tlo||[]))if(n.t>=od-1e-6)pod.push({m:n.m,t:n.t-od,d:n.d,poziom:.3,p:n.p});
  }
  const klucz="pp:"+p.id+":"+B.pp.partia;
  const ok=grajPodglad({klucz,melodia:mel,podklad:pod,perkusja:B.pp.zPodkladem?perkusjaPodgladu(p,od):[],tempo:p.tempo*S.ust.tempo/100,koniecBeat:p.koniec-od,
    naKlatke:(beat,P)=>ppKlatka(od+beat,P,nutaPod(x.nuty,od+beat)),
    koniec:()=>{ppRysuj();odswiezKarte(p.id);}});
  if(ok){B.podglad.od=od;B.pp.cel=B.pp.przesun;ppRysuj();}
}
function ppKlatka(beat,P,nuta){
  const p=ppPiosenka();if(!p)return;
  if(B.pp.duzy)ppJedzZaGlowica(beat);
  const g=ppRysujRolke(beat);
  ppRysujMape(beat);ppNaklejka(g);
  if(B.el.ppInfo)B.el.ppInfo.textContent=ppTekstInfo(beat,p);
  const z=B.el.ppZaba;if(!z||!g)return;
  const widac=g.x>=-6&&g.x<=g.szer+6;
  z.hidden=!widac;if(!widac)return;
  const spiewa=!!nuta,klatka=spiewa?Math.max(1,Math.min(4,1+Math.floor(P.poz(nuta.m)*3.99))):0;
  if(z.dataset.k!==String(klatka)){z.src=ZC_ZASOBY.zaby[klatka];z.dataset.k=String(klatka);}
  const kiw=Math.sin(performance.now()/1000*(spiewa?9:3))*(spiewa?9:4),oy=B.el.ppRolka.offsetTop;
  z.style.transform="translate("+(g.x-14).toFixed(1)+"px,"+(g.y-20+oy).toFixed(1)+"px) rotate("+kiw.toFixed(1)+"deg)";
}
// „takt 5 z 32”; przy fragmencie takty piosenki: „takt 3 z 5”, z powtórką „takt 3 z 5 · 2×”.
function ppTekstInfo(beat,p){
  const fr=p.fragment,takty=Math.max(1,Math.ceil(p.koniec/p.metrum-1e-9));
  const n=taktPiosenki(Math.min(takty,Math.floor(Math.max(0,beat)/p.metrum+1e-9)+1),fr);
  if(!fr||fr.caly)return tt("ppInfo",{n,z:takty});
  return fr.powtorz>1?tt("ppInfoPowtorz",{n,z:fr.do,r:fr.powtorz}):tt("ppInfo",{n,z:fr.do});
}
// Rolka partii: kreska co takt (mocniejsza co 4 takty piosenki, podwójna tam, gdzie fragment zaczyna się
// od nowa), numery taktów piosenki bez stykania się, reszta partii blado, wybrana w kolorze swojego toru,
// pauzy od 2 taktów przygaszone i obrysowane, głowica jak różowa nić linii „teraz”. Rysuje tylko to, co
// widać (powiększona rolka bywa kilka razy szersza od kadru).
function ppRysujRolke(glowica){
  const cv=B.el&&B.el.ppRolka,p=ppPiosenka(),g=ppGeo();if(!cv||!p||!g)return null;
  const szer=g.szer,wys=cv.clientHeight||80,d=Math.min(2,window.devicePixelRatio||1);
  if(cv.width!==Math.round(szer*d)||cv.height!==Math.round(wys*d)){cv.width=Math.round(szer*d);cv.height=Math.round(wys*d);}
  const c=cv.getContext("2d");c.setTransform(d,0,0,d,0,0);c.clearRect(0,0,szer,wys);
  c.fillStyle="#f4e8d0";c.beginPath();c.roundRect(0,0,szer,wys,8);c.fill();
  const duzy=B.pp.duzy,x0=ppPartia(),koniec=g.koniec,pad=g.pad,gora=duzy?17:13,fr=p.fragment;
  let lo=Infinity,hi=-Infinity;for(const y of p.partie)if(y.nuty.length){lo=Math.min(lo,y.lo);hi=Math.max(hi,y.hi);}
  if(!Number.isFinite(lo)){lo=60;hi=72;}lo-=1;hi+=1;
  const X=t=>pad+t*g.px-g.przesun,Y=m=>wys-pad-(m-lo)/Math.max(1,hi-lo)*(wys-pad-gora);
  const rh=Math.max(2.4,Math.min(duzy?9:5,(wys-gora-pad)/Math.max(8,hi-lo)*1.2));
  const t0=(g.przesun-pad)/g.px-1,t1=(g.przesun+szer-pad)/g.px+1;   // widoczne ćwierćnuty, z zapasem
  // pauzy wybranej partii
  for(const z of pauzyPartii(x0.nuty,p.metrum,p.koniec)){
    if(z.do<t0||z.od>t1)continue;
    c.fillStyle="rgba(33,31,29,.06)";c.fillRect(X(z.od),gora,X(z.do)-X(z.od),wys-gora-pad);
    c.strokeStyle="rgba(120,90,40,.35)";c.setLineDash([3,3]);c.strokeRect(X(z.od)+.5,gora+.5,X(z.do)-X(z.od)-1,wys-gora-pad-1);c.setLineDash([]);
  }
  const takty=Math.max(1,Math.ceil(koniec/p.metrum-1e-9)),dl=fr&&!fr.caly?Math.max(1,fr.do-fr.od+1):0;
  for(let k=Math.max(0,Math.floor(t0/p.metrum));k*p.metrum<koniec&&k*p.metrum<=t1;k++){
    const n=taktPiosenki(k+1,fr),powrot=dl>0&&k>0&&k%dl===0,mocna=powrot||(n-1)%4===0,x=Math.round(X(k*p.metrum))+.5;
    c.fillStyle=powrot?"rgba(33,31,29,.5)":mocna?"rgba(87,80,63,.42)":"rgba(120,90,40,.16)";
    c.fillRect(x,mocna?2:gora,1,wys-(mocna?2:gora)-pad);
    if(powrot)c.fillRect(x-3,gora,1,wys-gora-pad);
  }
  // numery krojem Nunito: kropkowane zero JetBrains Mono w 9–10 px czyta się jak ósemka („20” jak „28”)
  c.font=(duzy?"800 11px":"800 9.5px")+" Nunito,sans-serif";c.textBaseline="top";
  const szerNum=c.measureText(String(dl?fr.do:takty)).width+4;
  c.fillStyle="rgba(87,80,63,.85)";B.pp.numery=[];
  for(const q of numeryTaktow(takty,g.px*p.metrum,szerNum,fr)){
    const x=Math.round(X(q.k*p.metrum))+.5;if(x<-szerNum-4||x>szer)continue;
    const s=String(q.n);c.fillText(s,x+3,2);B.pp.numery.push({n:q.n,k:q.k,x:+(x+3).toFixed(1),szer:+c.measureText(s).width.toFixed(1)});
  }
  p.partie.forEach((y,i)=>{if(i===B.pp.partia)return;c.fillStyle="rgba(120,90,40,.28)";
    for(const n of y.nuty){if(n.t+n.d<t0||n.t>t1)continue;const a=X(n.t),b=Math.max(a+1.2,X(n.t+n.d)-.6);c.fillRect(a,Y(n.m)-rh/2,b-a,rh*.8);}});
  const akcent=ZC_TORY_STYL[B.pp.partia%ZC_TORY_STYL.length].akcent;
  c.fillStyle=akcent;c.strokeStyle="rgba(33,31,29,.55)";c.lineWidth=.8;
  for(const n of x0.nuty){if(n.t+n.d<t0||n.t>t1)continue;const a=X(n.t),b=Math.max(a+2,X(n.t+n.d)-.8);c.fillRect(a,Y(n.m)-rh/2,b-a,rh);c.strokeRect(a,Y(n.m)-rh/2,b-a,rh);}
  const gl=glowica!=null?glowica:B.pp.glowica,xg=X(Math.max(0,Math.min(koniec,gl)));
  c.strokeStyle="#ec1a83";c.lineWidth=2.2;c.setLineDash([6,4]);c.beginPath();c.moveTo(xg,gora-2);c.lineTo(xg,wys-2);c.stroke();c.setLineDash([]);
  // w pauzie żaba zostaje na ostatniej nucie, która brzmiała (środek tylko przed pierwszą nutą partii)
  const n=nutaPod(x0.nuty,gl)||nutaDoTeraz(x0.nuty,gl);
  return {x:xg,y:n?Y(n.m):(gora+wys)/2,X,szer};
}
// Pasek całości nad powiększoną rolką: cała piosenka w szerokości paska, okno kadru i głowica.
function ppRysujMape(glowica){
  const cv=B.el&&B.el.ppMapa,p=ppPiosenka();if(!cv||!p||!B.pp.duzy)return;
  const g=ppGeo();if(!g)return;
  const szer=cv.clientWidth||g.szer,wys=cv.clientHeight||20,d=Math.min(2,window.devicePixelRatio||1);
  if(cv.width!==Math.round(szer*d)||cv.height!==Math.round(wys*d)){cv.width=Math.round(szer*d);cv.height=Math.round(wys*d);}
  const c=cv.getContext("2d");c.setTransform(d,0,0,d,0,0);c.clearRect(0,0,szer,wys);
  c.fillStyle="#efe0c2";c.beginPath();c.roundRect(0,0,szer,wys,6);c.fill();
  const pad=ZC_PP_PAD,koniec=g.koniec,Xm=t=>pad+t/koniec*(szer-2*pad);
  let lo=Infinity,hi=-Infinity;for(const y of p.partie)if(y.nuty.length){lo=Math.min(lo,y.lo);hi=Math.max(hi,y.hi);}
  if(!Number.isFinite(lo)){lo=60;hi=72;}
  const Ym=m=>wys-4-(m-lo)/Math.max(1,hi-lo)*(wys-8);
  const a=Math.max(1,Xm((g.przesun-g.pad)/g.px)),b=Math.min(szer-1,Xm((g.przesun+g.szer-g.pad)/g.px));
  if(g.maks>0){c.fillStyle="rgba(255,255,255,.7)";c.beginPath();c.roundRect(a,1,Math.max(4,b-a),wys-2,4);c.fill();}
  c.fillStyle="rgba(120,90,40,.32)";
  p.partie.forEach((y,i)=>{if(i===B.pp.partia)return;for(const n of y.nuty)c.fillRect(Xm(n.t),Ym(n.m)-.5,Math.max(.8,Xm(n.t+n.d)-Xm(n.t)),1);});
  c.fillStyle=ZC_TORY_STYL[B.pp.partia%ZC_TORY_STYL.length].akcent;
  for(const n of ppPartia().nuty)c.fillRect(Xm(n.t),Ym(n.m)-1,Math.max(1.2,Xm(n.t+n.d)-Xm(n.t)),2);
  if(g.maks>0){c.strokeStyle="rgba(33,31,29,.7)";c.lineWidth=1.5;c.beginPath();c.roundRect(a,1,Math.max(4,b-a),wys-2,4);c.stroke();}
  const gl=glowica!=null?glowica:B.pp.glowica;
  c.fillStyle="#ec1a83";c.fillRect(Xm(Math.max(0,Math.min(koniec,gl)))-1,1,2,wys-2);
}
// Naklejka „wchodzi w takcie N” (gdy partia zaczyna się później niż w pierwszym takcie rolki). W powiększonym
// widoku wejście poza kadrem przykleja ją do brzegu ze strzałką; klik i tak przenosi do wejścia.
function ppNaklejka(g){
  const E=B.el,p=ppPiosenka(),x=ppPartia();if(!E||!E.ppWejscie||!p||!x)return;
  const t=taktWejscia(x.nuty,p.metrum),w=E.ppWejscie;
  w.hidden=!(t&&t>1&&g);if(w.hidden)return;
  const n=taktPiosenki(t,p.fragment),xx=g.X((t-1)*p.metrum);
  let tekst=tt("ppWejscie",{n}),lewo=xx+6;
  if(B.pp.duzy&&xx>g.szer-30){tekst=tt("ppWejscieDalej",{n});lewo=Infinity;}
  else if(B.pp.duzy&&xx<0){tekst=tt("ppWejscieWczesniej",{n});lewo=6;}
  if(w.textContent!==tekst){w.textContent=tekst;B.pp.szerNaklejki=w.offsetWidth||140;}
  const sw=B.pp.szerNaklejki||w.offsetWidth||140;
  w.style.left=Math.max(2,Math.min(g.szer-sw-4,lewo))+"px";
}
// Rolka, pasek całości i naklejka bez przebudowy chipów (przewijanie, zmiana rozmiaru)
function ppOdswiezWidok(){
  const p=ppPiosenka();if(!B.el||!B.el.pp||!p)return;
  const graP=ppGra(),gl=graP?ppGlowica():null;
  const g=ppRysujRolke(gl);ppRysujMape(gl);ppNaklejka(g);
  if(!graP){B.el.ppZaba.hidden=true;B.el.ppInfo.textContent=ppTekstInfo(B.pp.glowica,p);}
}
function ppRysuj(){
  const box=B.el&&B.el.pp,p=ppPiosenka();if(!box||!p)return;
  ppNowaPiosenka();ppRysujInstrument();ppRysujSilnik();
  const x=ppPartia(),E=B.el;
  // chipy partii; aktywny mówi, kto ją śpiewa, i zawsze jest w kadrze paska chipów
  E.ppChipy.replaceChildren();
  let akt=null;
  p.partie.forEach((y,i)=>{
    const ch=h("button","pp-chip");ch.type="button";ch.setAttribute("role","tab");ch.setAttribute("aria-selected",String(i===B.pp.partia));
    ch.style.setProperty("--akcent",ZC_TORY_STYL[i%ZC_TORY_STYL.length].akcent);
    ch.append(h("span","pp-chip-nazwa",nazwaPartii(y)),znaczekTrudnosci(trudnoscPartiiW(p,i),"maly"));
    if(i===B.pp.partia){
      const kto=S.gracze.filter(g=>g.partia===i).map(g=>g.nazwa);
      if(kto.length)ch.append(h("span","pp-kto",kto.length<=3?tt("ppSpiewa",{kto:kto.join(", ")})
        :tt("ppSpiewaWiecej",{kto:kto.slice(0,2).join(", "),n:kto.length-2})));
      ch.title=kto.join(", ");akt=ch;
    }
    ch.onclick=()=>bibPokazPartie(i,null);
    E.ppChipy.append(ch);
  });
  // chipy tylko, gdy jest ich mało i mieszczą się w nagłówku (pomiar przy pokazanym pasku; schowany panel
  // ma szerokość 0 i wtedy decyduje sama liczba partii); inaczej przycisk bieżącej partii z rozwijaną listą
  const ch=E.ppChipy;ch.hidden=false;E.ppWybor.hidden=true;
  const wiele=p.partie.length>ZC_PP_CHIPY_MAX||(ch.clientWidth>0&&ch.scrollWidth>ch.clientWidth+1);
  ch.hidden=wiele;E.ppWybor.hidden=!wiele;
  if(wiele){ppWyborZbuduj();if(ppWyborOtwarty())ppWyborUloz();}
  else{ppWyborZamknij(false);
    if(akt){const a=akt.getBoundingClientRect(),b=ch.getBoundingClientRect();
      if(a.left<b.left)ch.scrollLeft-=b.left-a.left+4;else if(a.right>b.right)ch.scrollLeft+=a.right-b.right+4;}}
  const graP=ppGra();
  E.ppGraj.textContent=graP?T.stop:T.ppPosluchaj;E.ppGraj.classList.toggle("gra",graP);
  E.ppPrzel.setAttribute("aria-checked",String(B.pp.zPodkladem));
  E.ppRolka.setAttribute("aria-label",tt("ppRolkaAria",{nazwa:nazwaPartii(x)}));
  // paski (i karty) graczy, którzy śpiewają podglądaną partię
  for(const k of document.querySelectorAll("#siatkaGraczy .gracz")){
    const g=S.gracze.find(y=>y.id===k.dataset.id);k.classList.toggle("spiewa-podglad",!!g&&g.partia===B.pp.partia);
  }
  ppOdswiezWidok();
}

// ---------------------------------------------------------------------------------------------
// EKRANY LOBBY: biblioteka, szuflada i podgląd partii to jedne elementy przenoszone do gniazd widocznego ekranu
// (pokazLobby w zabi-chor.js). Szuflada jedzie z biblioteką (nakrywa jej kolumnę), podgląd zdejmuje klasę
// „karty graczy jako paski” ze starej kolumny. Po przeniesieniu karty i rolki rysują się w nowym rozmiarze.
function bibOsadz(gdzieBib,gdziePodglad){
  const bib=el("biblioteka");
  if(gdzieBib&&bib&&bib.parentNode!==gdzieBib){
    if(B.szuflada)zamknijSzuflade();
    gdzieBib.append(bib);
    const kol=gdzieBib.closest(".lobby-kolumny");
    if(kol&&B.el&&B.el.sz&&B.el.sz.parentNode!==kol)kol.append(B.el.szTlo,B.el.sz);
  }
  const pp=el("podgladPartii");
  if(gdziePodglad&&pp&&pp.parentNode!==gdziePodglad){
    const stara=pp.closest(".kol-gracze");if(stara)stara.classList.remove("pp-rozwiniety","pp-wjazd");
    gdziePodglad.append(pp);ppUstawKlasy(false);
  }
  if(gdzieBib||gdziePodglad)bibOdswiez();
}

// ---------------------------------------------------------------------------------------------
// SZUKAJKA (runda 2 „Kurtka”): jedno pole nad listami (przenoszone razem z biblioteką między Utworami
// i krokiem 1), dopasowanie na żywo bez wielkości liter i znaków diakrytycznych, wiele słów = wszystkie muszą pasować
// (tytuł, opis/kompozytor, źródło; bez wewnętrznego id, którego nie widać). Niepasujące karty dostają atrybut hidden, dopasowanie w tytule <mark>.
// W zakładce Pakiety ta sama fraza steruje Pakiety.szukaj (własne pole pakietów chowa wtedy gry.css).
// Teksty lokalnie (dług: przenieść do T w zabi-chor.js, gdy będzie wolny).
const SZ_TEKST={pole:"Szukaj utworu…",aria:"Szukaj utworu w bibliotece",licznik:"{n} z {z}",brak:"Nic nie pasuje do „{q}”",
  wyczysc:"Wyczyść",czysc:"Wyczyść szukanie"};
// wersja angielska (js/jezyk.js): te same klucze
if(typeof RBJezyk!=="undefined"&&RBJezyk.en)Object.assign(SZ_TEKST,{pole:"Search songs…",aria:"Search the song library",
  licznik:"{n} of {z}",brak:"Nothing matches “{q}”",wyczysc:"Clear",czysc:"Clear search"});
const SZ_CACHE=new WeakMap();
function normSzuk(t){return String(t||"").normalize("NFD").replace(/\p{M}/gu,"").toLowerCase();}
function slowaSzuk(){return normSzuk(B.fraza).split(/\s+/).filter(Boolean);}
function tekstSzuk(w){
  const klucz=w.zr.tytul+"|"+(w.zr.opis||"")+"|"+w.rodzaj;let c=SZ_CACHE.get(w);
  if(!c||c.klucz!==klucz){c={klucz,t:normSzuk([w.zr.tytul,w.zr.opis,opisZrodla(w)].filter(Boolean).join(" "))};SZ_CACHE.set(w,c);}
  return c.t;
}
function zbudujSzukajke(){
  if(B.fraza==null)B.fraza="";
  const box=h("div","szuk");box.setAttribute("role","search");
  const pole=h("input","szuk-pole");pole.type="text";pole.id="bszukaj";pole.placeholder=SZ_TEKST.pole;pole.setAttribute("aria-label",SZ_TEKST.aria);
  pole.autocomplete="off";pole.spellcheck=false;pole.value=B.fraza;pole.setAttribute("aria-keyshortcuts","/");
  const licz=h("span","szuk-licznik","");licz.setAttribute("aria-live","polite");
  const x=h("button","szuk-wyczysc","×");x.type="button";x.title=SZ_TEKST.czysc;x.setAttribute("aria-label",SZ_TEKST.czysc);x.hidden=!B.fraza;
  pole.addEventListener("input",()=>bibSzukaj(pole.value));
  // Esc czyści i oddaje fokus liście; Enter i strzałka w dół przechodzą do listy (stopPropagation: Esc nie cofa ekranu)
  pole.addEventListener("keydown",e=>{
    if(e.key==="Escape"){e.preventDefault();e.stopPropagation();bibSzukaj("");fokusNaListe();}
    else if(e.key==="Enter"||e.key==="ArrowDown"){e.preventDefault();e.stopPropagation();fokusNaListe();}
  });
  x.onclick=()=>{bibSzukaj("");pole.focus();};
  box.append(h("span","szuk-lupa"),pole,licz,x);
  const brak=h("div","szuk-brak");brak.hidden=true;brak.setAttribute("role","note");
  const brakT=h("span","szuk-brak-tekst",""),brakB=h("button","przycisk maly",SZ_TEKST.wyczysc);brakB.type="button";
  brakB.onclick=()=>{bibSzukaj("");pole.focus();};
  brak.append(brakT,brakB);
  B.el.szuk={box,pole,licz,x,brak,brakT};
  return box;
}
function bibSzukaj(q){
  q=String(q==null?"":q);
  if(B.el&&B.el.szuk&&B.el.szuk.pole.value!==q)B.el.szuk.pole.value=q;
  if(q===B.fraza)return;
  B.fraza=q;zastosujSzukanie();
}
function listaFiltru(){
  return B.filtr==="folder"?B.listy.folder:B.filtr==="wbudowane"?B.listy.wbudowane:B.listy.wszystkie;
}
function fokusNaListe(){
  const l=listaFiltru();if(!l)return;
  const p=piosenka(),wyb=p&&l.querySelector('.bkarta[data-id="'+CSS.escape(p.id)+'"]:not([hidden]) .bkarta-wybor');
  const cel=wyb||l.querySelector(".bkarta:not([hidden]):not(.szkielet) .bkarta-wybor")||l.querySelector("li:not([hidden]) button");
  if(cel){cel.focus({preventScroll:true});
    if(typeof przewinDoFokusu==="function")przewinDoFokusu(cel,false);else cel.scrollIntoView({block:"nearest"});}
}
function szukajKarta(li,w,slowa){
  slowa=slowa||slowaSzuk();
  const pasuje=!slowa.length||slowa.every(s=>tekstSzuk(w).includes(s));
  if(li.hidden===pasuje)li.hidden=!pasuje;
  oznaczTytul(li.querySelector(".bkarta-tytul"),w.zr.tytul,slowa);
}
// podświetlenie w tytule: mapa znaków znormalizowanych na pozycje w oryginale (NFD i usunięcie znaków łączących
// potrafią zmienić długość), zakresy złączone, tytuł zawsze odtwarzany z w.zr.tytul
function oznaczTytul(e,tytul,slowa){
  if(!e)return;
  if(!slowa.length){if(e.firstElementChild||e.textContent!==tytul)e.textContent=tytul;return;}
  let norm="";const mapa=[];
  for(let i=0;i<tytul.length;){const ch=String.fromCodePoint(tytul.codePointAt(i)),n=normSzuk(ch);
    for(let j=0;j<n.length;j++){norm+=n[j];mapa.push(i);}i+=ch.length;}
  mapa.push(tytul.length);
  const z=[];
  for(const s of slowa){let o=norm.indexOf(s);while(o>=0){z.push([mapa[o],mapa[o+s.length]]);o=norm.indexOf(s,o+s.length);}}
  if(!z.length){e.textContent=tytul;return;}
  z.sort((a,b)=>a[0]-b[0]);
  const zl=[z[0].slice()];for(const [a,b] of z.slice(1)){const o=zl[zl.length-1];if(a<=o[1])o[1]=Math.max(o[1],b);else zl.push([a,b]);}
  const czesci=[];let i=0;
  for(const [a,b] of zl){if(a>i)czesci.push(tytul.slice(i,a));czesci.push(h("mark","szuk-mark",tytul.slice(a,b)));i=b;}
  if(i<tytul.length)czesci.push(tytul.slice(i));
  e.replaceChildren(...czesci);
}
function zastosujSzukanie(){
  if(!B.el||!B.el.szuk)return;
  const slowa=slowaSzuk();
  for(const [id,li] of B.karty){const w=B.wpisy.get(id);if(w)szukajKarta(li,w,slowa);}
  liczSzukanie(slowa);
}
function liczSzukanie(slowa){
  const sz=B.el&&B.el.szuk;if(!sz)return;
  slowa=slowa||slowaSzuk();
  sz.x.hidden=!B.fraza;sz.box.classList.toggle("aktywna",!!slowa.length);
  const l=listaFiltru();let n=0,z=0;
  if(l){for(const li of l.children)if(li.classList.contains("bkarta")&&!li.classList.contains("szkielet")){z++;if(!li.hidden)n++;}}
  sz.licz.textContent=slowa.length?SZ_TEKST.licznik.replace("{n}",n).replace("{z}",z):"";
  const brak=!!slowa.length&&!n&&z>0;
  sz.brakT.textContent=SZ_TEKST.brak.replace("{q}",B.fraza.trim());
  if(sz.brak.hidden===brak)sz.brak.hidden=!brak;
}

// ---------------------------------------------------------------------------------------------
// START: wbudowane od razu (S.piosenki gotowe przed lobby), zapisane z IndexedDB i folder w tle
function bibPrzygotuj(){
  wczytajSpis();wczytajUlubione();
  for(const def of BUILTIN){
    const zr=zrodloZNotacji(def),w=zbudujWpis({id:def.id,rodzaj:"wbudowana",tytul:def.title,zr});
    B.wpisy.set(w.id,w);
  }
  S.piosenki=BUILTIN.map(d=>B.wpisy.get(d.id).gra);
}
function bibStart(){
  zbudujWidok();zbudujPodgladPartii();ppRysuj();
  // „/”: fokus na szukajce z dowolnego miejsca lobby, w którym widać bibliotekę (poza polami tekstowymi)
  addEventListener("keydown",e=>{
    if(e.key!=="/"||e.ctrlKey||e.altKey||e.metaKey||S.ekran!=="lobby"||!B.el||!B.el.szuk)return;
    const a=document.activeElement;if(a&&(a.tagName==="INPUT"||a.tagName==="TEXTAREA"||a.tagName==="SELECT"||a.isContentEditable))return;
    const pole=B.el.szuk.pole;if(!pole.getClientRects().length)return;
    e.preventDefault();pole.focus();pole.select();
  });
  if(typeof Tablica!=="undefined")Tablica.wczytaj();
  // Esc w lobby: najpierw szuflada, potem powiększony podgląd partii
  addEventListener("keydown",e=>{
    if(e.key!=="Escape"||S.ekran!=="lobby")return;
    if(B.szuflada){e.preventDefault();zamknijSzuflade();}
    else if(B.pp.duzy){e.preventDefault();ppRozwin(false);}
  });
  if(typeof indexedDB==="undefined"){initFolder();wczytajPiosenkiPakietow().catch(e=>console.warn(e));Pakiety.doBiblioteki();return;}
  (async()=>{
    try{await wczytajZapisane();}catch(e){console.warn(e);}
    try{await wczytajPiosenkiPakietow();}catch(e){console.warn(e);}   // pakiety piosenek z audio (pakiet-piosenki.js)
    try{await initFolder();}catch(e){console.warn(e);}
    // utwory pobranych paczek na końcu: jest ich najwięcej, a wczytują się tą samą kolejką co pliki z folderu
    try{await Pakiety.doBiblioteki();}catch(e){console.warn(e);}
  })();
}
const Biblioteka={przygotuj:bibPrzygotuj,start:bibStart,dodajPlik:bibDodajPlik,dodajZPakietu:bibDodajZPakietu,odswiez:bibOdswiez,
  pokazPartie:bibPokazPartie,podgladPartii:()=>({partia:B.pp.partia,glowica:+ppGlowica().toFixed(3),zPodkladem:B.pp.zPodkladem,
    gracz:B.pp.gracz,gra:ppGra(),duzy:B.pp.duzy,przesun:+B.pp.przesun.toFixed(1)}),ppSkocz,ppPrzelacz,ppRozwin,
  geometriaPodgladu:()=>{const g=ppGeo();return g&&{szer:g.szer,pelna:+g.pelna.toFixed(2),naTakt:+g.naTakt.toFixed(3),px:g.px,pad:g.pad,
    przesun:g.przesun,maks:+g.maks.toFixed(2),numery:(B.pp.numery||[]).slice()};},
  zatrzymajPodglad,zamknijSzuflade,otworzSzuflade,ustawParametry,przelaczPodglad,przelaczOryginal,ustawFiltr,podsluch,
  osadz:bibOsadz,przelaczUlubione:bibPrzelaczUlubione,ulubione:()=>B.ulubione.slice(),zagrano:bibZagrano,ustawSortowanie,
  usun:bibUsunPytaj,   // 10-18 (D-11): pytanie o usunięcie własnego utworu (to samo co kosz na karcie)
  kolejnosc:()=>[...listaFiltru().querySelectorAll(".bkarta")].map(li=>li.dataset.id),
  skanujFolder,wpis:id=>B.wpisy.get(id),szukaj:bibSzukaj,fraza:()=>B.fraza||"",stan:()=>({filtr:B.filtr,moje:B.moje.map(x=>x.id),ladowanie:B.ladowanie,dir:B.dir?B.dir.name:null,
    dirOk:B.dirOk,folderPlikow:B.dirPlikow,szuflada:B.szuflada?B.szuflada.id:null,podglad:B.podglad?B.podglad.klucz:null,
    ulubione:B.ulubione.slice(),pominiete:B.pominiete.map(u=>Object.assign({},u)),
    parametry:Object.assign({},B.parametry)}),
  // 10-20: lista partii w podglądzie to osobne okienko w <body>, więc pad i kapsel („wstecz” w nawigujLobby) muszą mieć czym je zamknąć
  zamknijWybor:()=>ppWyborZamknij(true),
  _B:B};
