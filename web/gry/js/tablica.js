"use strict";
// ===== RIBBITBEAT: tablica wyników =====
// Każda dokończona piosenka zapisuje po jednym wierszu na gracza (ludzie i boty) pod kluczem UTWORU:
//   piosenka wbudowana  "wbud:<id>",
//   plik MIDI           "midi:sha256:<64 znaki>", skrót SHA-256 bajtów pliku (sha256Hex w piosenki.js;
//                       klucz po skrócie pliku przyda się też pod ewentualny globalny ranking piosenek).
//                       Ten sam plik ma ten sam klucz pod każdą nazwą i na każdym komputerze, a pakiety podają ten skrót
//                       w manifeście (`sha256`). Do 10-18 kluczem była nazwa pliku i rozmiar ("midi:<nazwa>:<bajty>",
//                       kluczZNazwy): takie wiersze przechodzą pod skrót, gdy gra pierwszy raz zobaczy plik (tbKlucz).
// Wiersz pamięta partię z jej trudnością (trudnoscPartii w chwili gry) i KONFIGURACJĘ: tempo, tryb śpiewu, pomoc
// w trafianiu, zakres przechyłu i fragment piosenki. Ranking „na tablicy” porównuje tylko wiersze tej samej partii
// i konfiguracji (w innej konfiguracji to inna konkurencja); widok tablicy filtruje po partii, trudności,
// konfiguracji i graczach.
// Zapis: IndexedDB (baza `zabi-chor`, magazyn `wyniki`, klucz utworu), a gdy biblioteka ma wskazany folder,
// także `dane/ribbitbeat-wyniki.json` obok parametrów piosenek: tablica przeżyje czyszczenie przeglądarki i jest
// wspólna dla gry w aplikacji (/web/gry/) i w harnessie. Przy wczytaniu wiersze z obu miejsc się sumują (po id).
// Ten plik ładuje się po biblioteka.js i korzysta z jego pomocników (bibIdbGet/Set, B.dir) oraz ze słownika T.

const ZC_TABLICA={MAKS:400,NAJLEPSZE:10,PLIK:"ribbitbeat-wyniki.json",WERSJA:2,ZAPIS_MS:1500};   // wersja 2 (10-18): klucze MIDI po SHA-256
const TB={utwory:new Map(),gotowa:false,el:null,otwarta:false,klucz:null,nowe:new Set(),zapisT:0,
  filtr:{partia:"",poziom:"",konf:"",kto:"wszyscy",wg:"punkty"}};

// ---------------------------------------------------------------------------------------------
// CZYSTE FUNKCJE (testy: tests/gry_zabi_chor_harness.mjs)
function nazwaDoKlucza(nazwa){
  return String(nazwa||"").replace(/\.(mid|midi)$/i,"").replace(/\s*\(\d+\)\s*$/,"").replace(/_+/g," ").replace(/\s+/g," ")
    .trim().toLowerCase();
}
// Klucz sprzed 10-18: nazwa pliku i rozmiar. Zostaje dla piosenki bez skrótu i do przeniesienia starych wierszy.
function kluczZNazwy(p){
  return "midi:"+nazwaDoKlucza(p.plik||p.tytul)+":"+(Math.max(0,+p.rozmiar||0));
}
function kluczUtworu(p){
  if(!p)return null;
  if(p.zrodlo!=="midi")return "wbud:"+p.id;
  return /^[0-9a-f]{64}$/.test(p.hash||"")?"midi:sha256:"+p.hash:kluczZNazwy(p);
}
// Wiersze spod klucza „nazwa + rozmiar” przechodzą pod skrót pliku i scalają się z tymi, które już tam są (po id).
// Zwraca stary klucz, gdy coś przeniosła, inaczej null. Dwa różne pliki o tej samej nazwie i rozmiarze miały do 10-18
// jedną tablicę: jej wiersze dostaje plik, który gra zobaczy pierwszy.
function przeniesStaryKlucz(utwory,p){
  const nowy=kluczUtworu(p);
  if(!nowy||!nowy.startsWith("midi:sha256:"))return null;
  const stary=kluczZNazwy(p),u=utwory.get(stary);
  if(!u||!Array.isArray(u.wpisy))return null;
  const cel=utwory.get(nowy);
  utwory.set(nowy,Object.assign({},u,cel||{},{klucz:nowy,hash:p.hash,wpisy:scalWpisy(cel?cel.wpisy:[],u.wpisy)}));
  utwory.delete(stary);
  return stary;
}
// Konfiguracja, w której grano: wszystko, co zmienia trudność albo punkty, a nie jest samą partią. `osobno`: gracze
// tej samej partii na osobnych torach (ustawienie „tory”), czyli bez premii „W jednym głosie!”; brak pola w starych
// wierszach = wspólny tor, jak grano przed tym ustawieniem. `plynny`: tryb nut płynny (zjazdy między nutami); podpis `|g`
// jest ten sam, który do 10-03 nosił eksperyment „płynne przejścia”.
// Czas na ruch w konfiguracji: procent 0–150 (stary zapis true = 100, false/brak = 0). Wiersze sprzed 10-05 mają
// `ruch:true` i podpis `|r`, dlatego 100 % zostaje przy `|r`, a inne wartości dostają `|r<procent>`.
function procentRuchuTablicy(v){
  if(v===true)return 100;
  const n=Math.round((+v||0)/25)*25;
  return Math.max(0,Math.min(150,n));
}
// Pomoce (10-18): `pomoc` to poziom przyciągania 0–4 (stare wiersze: true = 1, false = 0, podpis „m”/„b” bez zmian),
// `podpowiedz` i `klawDoNuty` (ten tylko gracz na klawiaturze, dopisuje go konfiguracjaGracza) tylko włączone, `mnPomocy` tylko ≠ 1.
// Mnożnik w podpisie (`|a58`) oddziela nowe wiersze z pomocami od starych, liczonych bez niego, a przy zmianie kalibracji
// mnożników sam zakłada nową konkurencję. Domyślne ustawienia (×1) mają podpis taki jak przed 10-18.
function pomocTablicy(v){
  if(v===true)return 1;
  if(v===false||v==null)return 0;
  const n=Math.round(+v);return Number.isFinite(n)?Math.max(0,Math.min(4,n)):1;
}
function konfiguracjaGry(ust,p,mnPomocy){
  const f=(p&&p.fragment)||{caly:true};
  return {tempo:+ust.tempo||100,bpm:Math.round((p?p.tempo:100)*(+ust.tempo||100)/100),latwy:!!ust.spiewaSama,
    pomoc:pomocTablicy(ust.przyciaganie),zakres:+ust.zakres||40,caly:f.caly!==false,od:f.od||1,do:f.do||1,powtorz:f.powtorz||1,
    osobno:ust.tory==="osobno",plynny:ust.tryb==="plynny",ruch:procentRuchuTablicy(ust.czasNaRuch),
    // plik ze zmianami tempa gra od 10-18 w prawdziwym czasie (mapa tempa w parserze): inne nuty niż wcześniej pod tym samym
    // skrótem pliku, więc osobna konkurencja `|mt`; brak pola w starych wierszach = dawne jedno tempo
    ...(p&&p.tempoZmienne?{mapa:true}:{}),
    ...(ust.podpowiedz?{podpowiedz:true}:{}),
    ...(Number.isFinite(+mnPomocy)&&+mnPomocy>0&&+mnPomocy!==1?{mnPomocy:+mnPomocy}:{})};
}
// Konfiguracja wiersza gracza (10-18 wieczór, pomoce osobno dla każdego gracza): wspólne ustawienia piosenki (`ust`)
// z pomocami TEGO gracza ({przyciaganie, spiewaSama, klawDoNuty}; null = jak w `ust`) i jego mnożnikiem pomocy. Skok do
// nuty liczy się tylko graczowi na klawiaturze (`klaw`). Gracz bez własnych pomocy ma podpis taki jak dotąd.
function konfiguracjaGracza(ust,p,pomoce,klaw,mnPomocy){
  const u=Object.assign({},ust||{});
  if(pomoce&&typeof pomoce==="object"){u.przyciaganie=pomoce.przyciaganie;u.spiewaSama=!!pomoce.spiewaSama;u.klawDoNuty=!!pomoce.klawDoNuty;}
  const k=konfiguracjaGry(u,p,mnPomocy);
  if(klaw&&u.klawDoNuty)k.klawDoNuty=true;
  return k;
}
// Tory, na których naprawdę grano: „osobno” tylko wtedy, gdy każdy tor miał najwyżej jednego gracza. Przy ustawieniu
// „osobno” i więcej niż 4 graczach gra łączy partie we wspólne tory z premią „W jednym głosie!” (podzialNaToryOsobno →
// podzialNaTory), więc to wynik chóru i do tej konkurencji trafia (10-18, test D-05).
function toryWGrze(ust,tory){
  return ust&&ust.tory==="osobno"&&(tory||[]).every(t=>!t||!t.gracze||t.gracze.length<=1)?"osobno":"chor";
}
function podpisKonfiguracji(k){
  if(!k)return "";
  const pm=pomocTablicy(k.pomoc);
  return "t"+k.tempo+"|"+(k.latwy?"l":"p")+"|"+(pm===1?"m":pm?"m"+pm:"b")+"|z"+k.zakres+(k.caly?"":"|f"+k.od+"-"+k.do+"x"+k.powtorz)+
    (k.osobno?"|o":"")+(k.plynny?"|g":"")+(k.ruch?"|r"+(procentRuchuTablicy(k.ruch)===100?"":procentRuchuTablicy(k.ruch)):"")+   // czas na ruch zmienia maksimum o 1–8 %: osobna konkurencja
    (k.mapa?"|mt":"")+(k.podpowiedz?"|h":"")+(k.klawDoNuty?"|k":"")+(k.mnPomocy&&k.mnPomocy!==1?"|a"+Math.round(k.mnPomocy*100):"");
}
function opisKonfiguracji(k){
  if(!k)return "";
  const pm=pomocTablicy(k.pomoc);
  const cz=[tt("konfTempo",{n:k.tempo}),k.latwy?T.konfLatwy:T.konfPelny,
    pm===1?T.konfPomoc:pm?tt("konfPrzyciaganie",{poziom:String(T["przyciaganie_"+pm]||pm).toLocaleLowerCase()}):T.konfBezPomocy];
  if(k.podpowiedz)cz.push(T.konfPodpowiedz);
  if(k.klawDoNuty)cz.push(T.konfKlawDoNuty);
  if(k.zakres!==40)cz.push(tt("konfZakres",{n:k.zakres}));
  if(!k.caly)cz.push(tt("konfFragment",{od:k.od,do:k.do})+(k.powtorz>1?tt("konfPowtorz",{n:k.powtorz}):""));
  if(k.osobno)cz.push(T.konfOsobno);
  if(k.plynny)cz.push(T.konfPlynny||"tryb płynny");
  if(k.ruch)cz.push(tt("konfZRuchem",{n:procentRuchuTablicy(k.ruch)}));
  if(k.mapa)cz.push(T.konfTempoZPliku||"tempo z pliku");
  if(k.mnPomocy&&k.mnPomocy!==1)cz.push(tt("konfPomoce",{m:typeof fmtMn==="function"?fmtMn(k.mnPomocy):String(k.mnPomocy)}));
  return cz.join(" · ");
}
// Wiersz tablicy z wyniku gracza (r: wiersz rankingu z zakonczGre).
function wpisTablicy(r,g,partiaNazwa,tr,konf,teraz){
  return {id:(+teraz).toString(36)+"-"+String(g.id).replace(/[^a-z0-9-]/gi,""),kiedy:+teraz,kto:String(g.nazwa||g.id).slice(0,32),
    zrodlo:g.zrodlo,poziomBota:g.zrodlo==="bot"?(g.poziom||null):undefined,kolor:g.kolor,kapsel:g.obrazekKapsla||"",
    partia:partiaNazwa,partiaNr:r.partia,trudnosc:tr?tr.ocena:null,poziom:tr?tr.poziom:null,
    konf,konfId:podpisKonfiguracji(konf),punkty:Math.round(r.punkty),precyzja:+(+r.precyzja||0).toFixed(1),
    celnosc:+(+r.celnosc||0).toFixed(1),trafione:r.trafione|0,nut:r.nut|0,maxKombo:r.maxKombo|0,gwiazdki:r.gwiazdki|0};
}
function porownajWpisy(wg){
  if(wg==="precyzja")return (a,b)=>(b.precyzja-a.precyzja)||(b.celnosc-a.celnosc)||(b.punkty-a.punkty)||(a.kiedy-b.kiedy);
  return (a,b)=>(b.punkty-a.punkty)||(b.precyzja-a.precyzja)||(a.kiedy-b.kiedy);
}
// Boty nie pokazują się w tabeli wyników: tablica to wyniki ludzi. Boty nie dostają wierszy
// (tbZapiszGre), a stare wiersze botów nie wchodzą do żadnego widoku, miejsca ani podglądu i wypadają z zapisu przy
// najbliższym utrwaleniu utworu (tbBezBotow przy wczytaniu).
function ludzkiWpis(w){return !!w&&w.zrodlo!=="bot";}
function filtrujWpisy(wpisy,f){
  f=f||{};
  return (wpisy||[]).filter(w=>ludzkiWpis(w)&&(!f.partia||w.partia===f.partia)&&(!f.poziom||w.poziom===f.poziom)&&
    (!f.konf||w.konfId===f.konf));
}
// Miejsce wiersza wśród wierszy ludzi tej samej partii i konfiguracji (1 = najlepszy), w kategorii `wg`.
function miejsceWpisu(wpisy,wpis,wg){
  const grupa=(wpisy||[]).filter(w=>ludzkiWpis(w)&&w.partia===wpis.partia&&w.konfId===wpis.konfId).sort(porownajWpisy(wg));
  const i=grupa.findIndex(w=>w.id===wpis.id);
  return i<0?null:i+1;
}
// Podgląd tablicy przy wybranej piosence (runda 3): `n` najlepszych wierszy po punktach (remis: precyzja, potem
// wcześniejszy), z miejscem; wiersze bez liczby punktów pomija. Wejście bez zmian.
function topWpisy(wpisy,n){
  const l=(Array.isArray(wpisy)?wpisy:[]).filter(w=>ludzkiWpis(w)&&Number.isFinite(+w.punkty));
  l.sort((a,b)=>(b.punkty-a.punkty)||((+b.precyzja||0)-(+a.precyzja||0))||((+a.kiedy||0)-(+b.kiedy||0)));
  return l.slice(0,Math.max(0,n|0)).map((w,i)=>({miejsce:i+1,kto:w.kto,punkty:+w.punkty,precyzja:+w.precyzja||0,kolor:w.kolor||"",zrodlo:w.zrodlo||""}));
}
// Najlepszy wcześniejszy wynik ludzi w tej samej partii i konfiguracji (naklejka „Twój rekord” solisty). `kto` (10-15,
// przejście kolekcjonera: „Twój rekord” pokazywał wynik innej osoby z tego komputera) = tylko wpisy tej samej nazwy.
function rekordZTablicy(wpisy,partia,konfId,przed,kto){
  let naj=null;const k=kto==null?null:String(kto).toLocaleLowerCase("pl");
  for(const w of wpisy||[])if(w.zrodlo!=="bot"&&w.partia===partia&&w.konfId===konfId&&w.kiedy<przed&&
    (k==null||String(w.kto||"").toLocaleLowerCase("pl")===k)&&(!naj||w.punkty>naj.punkty))naj=w;
  return naj;
}
// Suma dwóch zapisów jednego utworu (przeglądarka + folder): wiersze po id, bez dubli.
function scalWpisy(a,b){
  const m=new Map();
  for(const w of [...(a||[]),...(b||[])])if(w&&typeof w.id==="string"&&!m.has(w.id))m.set(w.id,w);
  return [...m.values()].sort((x,y)=>x.kiedy-y.kiedy);
}
// Przycięcie do `maks` wierszy: zostają najlepsi (NAJLEPSZE w punktach i w precyzji w każdej parze partia +
// konfiguracja), a z reszty najnowsze. Najstarsze przeciętne wyniki odchodzą pierwsze.
function przytnijWpisy(wpisy,maks,najlepsze){
  if(!wpisy||wpisy.length<=maks)return wpisy||[];
  const grupy=new Map(),zostaw=new Set();
  for(const w of wpisy){const k=w.partia+"\u0000"+w.konfId;if(!grupy.has(k))grupy.set(k,[]);grupy.get(k).push(w);}
  for(const g of grupy.values())for(const wg of ["punkty","precyzja"])g.slice().sort(porownajWpisy(wg)).slice(0,najlepsze).forEach(w=>zostaw.add(w.id));
  const reszta=wpisy.filter(w=>!zostaw.has(w.id)).sort((x,y)=>y.kiedy-x.kiedy).slice(0,Math.max(0,maks-zostaw.size));
  reszta.forEach(w=>zostaw.add(w.id));
  return wpisy.filter(w=>zostaw.has(w.id));
}
function kiedyTekst(ms,teraz){
  const d=new Date(ms),t=new Date(teraz||Date.now()),godz=d.toLocaleTimeString(typeof RBJezyk!=="undefined"?RBJezyk.loc:"pl-PL",{hour:"2-digit",minute:"2-digit"});
  const dzien=x=>new Date(x.getFullYear(),x.getMonth(),x.getDate()).getTime();
  const roznica=Math.round((dzien(t)-dzien(d))/864e5);
  if(roznica===0)return T.dzisiaj+" "+godz;
  if(roznica===1)return T.wczoraj+" "+godz;
  return d.toLocaleDateString(typeof RBJezyk!=="undefined"?RBJezyk.loc:"pl-PL",{day:"numeric",month:"short"})+(d.getFullYear()!==t.getFullYear()?" "+d.getFullYear():"")+" "+godz;
}

// ---------------------------------------------------------------------------------------------
// ZAPIS: IndexedDB + plik w folderze biblioteki
function utworTablicy(klucz,p){
  let u=TB.utwory.get(klucz);
  if(!u){u={klucz,tytul:p?p.tytul:klucz,plik:p&&p.plik||"",rozmiar:p&&p.rozmiar||0,hash:p&&p.hash||"",wpisy:[]};TB.utwory.set(klucz,u);}
  else if(p){u.tytul=p.tytul;if(p.plik)u.plik=p.plik;if(p.rozmiar)u.rozmiar=p.rozmiar;if(p.hash)u.hash=p.hash;}
  return u;
}
// Klucz utworu dla zapisu i odczytu. Po drodze przenosi wiersze spod klucza „nazwa + rozmiar” (raz; potem to tylko
// jedno sprawdzenie w Mapie), a zmianę utrwala w tle: nowy klucz do IndexedDB i folderu, stary znika z obu.
function tbKlucz(p){
  const k=kluczUtworu(p);
  // przed końcem tbWczytaj nie: zapis spisu z połowy wczytanej tablicy zgubiłby resztę; przeniesie to tbPrzeniesZnane
  if(!TB.gotowa)return k;
  const stary=przeniesStaryKlucz(TB.utwory,p);
  if(stary)(async()=>{await bibIdbDel("wyniki",stary);await tbUtrwal(k);})().catch(e=>console.warn("tablica wyników",e));
  return k;
}
// Wszystkie znane piosenki naraz: po wczytaniu tablicy z IndexedDB i po scaleniu z plikiem folderu (tam też mogą
// leżeć stare klucze). Piosenki z pakietów otwierane później przechodzą w tbKlucz przy pierwszym użyciu.
function tbPrzeniesZnane(){
  if(typeof S==="undefined"||!Array.isArray(S.piosenki))return;
  for(const p of S.piosenki)if(p&&p.zrodlo==="midi")tbKlucz(p);
}
async function tbWczytaj(){
  if(typeof indexedDB!=="undefined"){
    try{
      const lista=await bibIdbGet("wyniki","*spis");
      for(const k of Array.isArray(lista)?lista:[]){
        const u=await bibIdbGet("wyniki",k);
        if(u&&Array.isArray(u.wpisy)){const jest=TB.utwory.get(k);
          TB.utwory.set(k,Object.assign({},u,{wpisy:scalWpisy(jest?jest.wpisy:[],u.wpisy).filter(ludzkiWpis)}));}   // stare wiersze botów odpadają
      }
    }catch(e){console.warn("tablica wyników",e);}
  }
  TB.gotowa=true;
  tbPrzeniesZnane();
  if(TB.otwarta)tbRysuj();
  if(typeof rysujWybrana==="function"&&S.ekran==="lobby")rysujWybrana();   // podgląd 3 najlepszych w kroku 1
}
async function tbUtrwal(klucz){
  const u=TB.utwory.get(klucz);if(!u)return;
  await bibIdbSet("wyniki",klucz,u);
  await bibIdbSet("wyniki","*spis",[...TB.utwory.keys()]);
  tbDoFolderuPozniej();
}
function tbDoFolderuPozniej(){
  if(typeof B==="undefined"||!B.dir||!B.dirOk)return;
  clearTimeout(TB.zapisT);
  TB.zapisT=setTimeout(()=>{tbZapiszFolder(B.dir).catch(e=>console.warn(ZC_TABLICA.PLIK,e));},ZC_TABLICA.ZAPIS_MS);
}
async function tbZapiszFolder(dir){
  const dd=await dir.getDirectoryHandle("dane",{create:true});
  const fh=await dd.getFileHandle(ZC_TABLICA.PLIK,{create:true});
  const w=await fh.createWritable();
  await w.write(JSON.stringify({gra:"ribbitbeat",wersja:ZC_TABLICA.WERSJA,utwory:Object.fromEntries(TB.utwory)},null,1));
  await w.close();
}
// Folder biblioteki wskazany albo odczytany: wiersze z pliku dochodzą do tablicy, a suma wraca do obu miejsc.
async function tbZFolderu(dir){
  let j=null;
  try{const dd=await dir.getDirectoryHandle("dane",{create:true});const fh=await dd.getFileHandle(ZC_TABLICA.PLIK);
    j=JSON.parse(await (await fh.getFile()).text());}catch(e){j=null;}
  const zPliku=j&&j.utwory&&typeof j.utwory==="object"?j.utwory:{};
  let zmiana=false;
  for(const k of Object.keys(zPliku)){
    const f=zPliku[k];if(!f||!Array.isArray(f.wpisy))continue;
    const u=utworTablicy(k,null),przed=u.wpisy.length;
    if(!u.tytul||u.tytul===k)Object.assign(u,{tytul:f.tytul||k,plik:f.plik||"",rozmiar:f.rozmiar||0,hash:f.hash||""});
    u.wpisy=przytnijWpisy(scalWpisy(u.wpisy,f.wpisy).filter(ludzkiWpis),ZC_TABLICA.MAKS,ZC_TABLICA.NAJLEPSZE);
    if(u.wpisy.length!==przed){zmiana=true;await bibIdbSet("wyniki",k,u);}
  }
  if(zmiana)await bibIdbSet("wyniki","*spis",[...TB.utwory.keys()]);
  tbPrzeniesZnane();   // plik folderu z wersji 1 ma klucze „nazwa + rozmiar”
  try{await tbZapiszFolder(dir);}catch(e){console.warn(ZC_TABLICA.PLIK,e);}
  if(TB.otwarta)tbRysuj();
}
// Koniec piosenki: wiersze wszystkich graczy. Zwraca {id gracza → {wpis, miejsce:{punkty, precyzja}}} od razu
// (tablica żyje w pamięci), a zapis na dysk idzie w tle.
function tbZapiszGre(gra,lista){
  const p=gra.piosenka,klucz=tbKlucz(p);if(!klucz)return {};
  const u=utworTablicy(klucz,p),teraz=Date.now(),out={};
  const ust=Object.assign({},S.ust,{tory:toryWGrze(S.ust,gra.tory)});
  TB.nowe=new Set();
  lista.forEach((r,i)=>{
    const g=S.gracze.find(x=>x.id===r.id);if(!g||g.zrodlo==="bot")return;   // boty nie trafiają do tablicy (10-18)
    const tor=gra.tory.find(t=>t.partia===r.partia);
    // 10-18 wieczór: każdy wiersz ma konfigurację z pomocy SWOJEGO gracza (ustalonych na starcie piosenki, g.pomoceGry) i jego
    // mnożnik; „Skok do nuty” tylko na klawiaturze. Wcześniej (10-18) różnił się tylko skok do nuty, reszta szła z ustawień gry.
    const kg=konfiguracjaGracza(ust,p,g.pomoceGry||null,g.zrodlo==="ws"||g.zrodlo==="strzalki",g.mnPomocy!=null?g.mnPomocy:gra.mnPomocy);
    const w=wpisTablicy(r,g,nazwaPartii(p.partie[r.partia]),tor&&tor.trudnosc,kg,teraz+i);
    const rekord=rekordZTablicy(u.wpisy,w.partia,w.konfId,w.kiedy,w.kto);
    u.wpisy.push(w);TB.nowe.add(w.id);
    out[r.id]={wpis:w,rekord};
  });
  u.wpisy=przytnijWpisy(u.wpisy,ZC_TABLICA.MAKS,ZC_TABLICA.NAJLEPSZE);
  for(const id in out){const w=out[id].wpis;
    out[id].miejsce={punkty:miejsceWpisu(u.wpisy,w,"punkty"),precyzja:miejsceWpisu(u.wpisy,w,"precyzja")};}
  tbUtrwal(klucz);
  return out;
}

// ---------------------------------------------------------------------------------------------
// WIDOK: okno nad lobby albo nad wynikami
function tbZbuduj(){
  if(TB.el)return TB.el;
  const box=el("tablica"),karta=h("div","karta tablica-karta");
  karta.setAttribute("role","dialog");karta.setAttribute("aria-modal","true");karta.setAttribute("aria-labelledby","tablicaTytul");
  const glowa=h("header","tablica-glowa");
  const tyt=h("h2","tablica-tytul",T.tablica);tyt.id="tablicaTytul";
  const utwor=h("select","lista tablica-utwor");utwor.setAttribute("aria-label",T.naglPiosenka);
  utwor.onchange=()=>{TB.klucz=utwor.value;TB.filtr.partia=TB.filtr.konf=TB.filtr.poziom="";tbRysuj();};
  const zamknij=h("button","gracz-usun tablica-zamknij","×");zamknij.type="button";zamknij.title=T.tablicaZamknij;
  zamknij.setAttribute("aria-label",T.tablicaZamknij);zamknij.onclick=tbZamknij;
  glowa.append(tyt,utwor,zamknij);
  const plik=h("p","tablica-plik","");
  const filtry=h("div","tablica-filtry");
  const lista=(k,etykieta)=>{const l=h("label","tablica-filtr");const s=h("select","lista");s.dataset.k=k;
    s.onchange=()=>{TB.filtr[k]=s.value;tbRysuj();};l.append(h("span","",etykieta),s);return l;};
  const segment=(k,opcje,etykieta)=>{const w=h("div","tablica-filtr");const seg=h("div","segment");seg.setAttribute("role","radiogroup");
    seg.setAttribute("aria-label",etykieta);seg.dataset.k=k;
    for(const [v,napis] of opcje){const b=h("button","segment-opcja",napis);b.type="button";b.dataset.v=v;b.setAttribute("role","radio");
      b.onclick=()=>{TB.filtr[k]=v;tbRysuj();};seg.append(b);}
    w.append(h("span","",etykieta),seg);return w;};
  // bez segmentu „Kto” (z botami / ludzie): od 10-18 tablica pokazuje tylko ludzi
  filtry.append(lista("partia",T.tablicaPartia),lista("poziom",T.tablicaTrudnosc),lista("konf",T.tablicaKonfiguracja),
    segment("wg",[["punkty",T.kategoria_punkty],["precyzja",T.kategoria_precyzja]],T.tablicaSortuj));
  const tabela=h("div","tablica-tabela");tabela.setAttribute("role","table");
  const pusto=h("p","tablica-pusto","");
  karta.append(glowa,plik,filtry,tabela,pusto);
  box.append(karta);
  // klik w tło zamyka, ale tylko cały (wciśnięcie i puszczenie na tle) i nie w pierwszych 300 ms: drugi klik dwukliku
  // „Tablica wyników” trafiał w tło świeżo otwartego okna i od razu je zamykał (10-18, test D-07)
  box.addEventListener("pointerdown",e=>{TB.tloDol=e.target===box&&performance.now()-(TB.odOtwarcia||0)>300;});
  box.addEventListener("pointerup",e=>{if(TB.tloDol&&e.target===box)tbZamknij();TB.tloDol=false;});
  // klawisze pod otwartym oknem nie dochodzą do gry (Spacja na wynikach to „jeszcze raz”, W/S dołącza gracza);
  // domyślne zachowanie list i przycisków zostaje, Esc zamyka okno, Tab krąży w oknie, a strzałki na segmencie
  // („Kto”, „Sortuj”) zmieniają zaznaczenie jak zakładki biblioteki (10-18)
  addEventListener("keydown",e=>{if(!TB.otwarta)return;e.stopImmediatePropagation();
    if(e.key==="Escape"){e.preventDefault();tbZamknij();return;}
    if(e.key==="Tab"){tbTab(e);return;}
    const b=document.activeElement;
    if(/^Arrow(Left|Right|Up|Down)$/.test(e.key)&&b&&b.classList.contains("segment-opcja")&&karta.contains(b)){
      e.preventDefault();const seg=b.parentElement,opcje=[...seg.children],i=opcje.indexOf(b);
      const n=opcje[(i+(/Left|Up/.test(e.key)?-1:1)+opcje.length)%opcje.length];
      TB.filtr[seg.dataset.k]=n.dataset.v;tbRysuj();n.focus({preventScroll:true});}},true);
  TB.el={box,karta,utwor,plik,filtry,tabela,pusto};
  return TB.el;
}
// Pułapka Tab (wzorzec okna Profile): z ostatniego elementu na pierwszy i z powrotem, fokus spoza okna wraca do niego.
function tbTab(e){
  const K=TB.el.karta,lista=[...K.querySelectorAll("button,select,[tabindex]")]
    .filter(x=>!x.disabled&&x.tabIndex>=0&&x.offsetParent!==null);
  if(!lista.length)return;
  const i=lista.indexOf(document.activeElement);
  if(i<0||(e.shiftKey&&i===0)||(!e.shiftKey&&i===lista.length-1)){
    e.preventDefault();lista[i<0?0:(e.shiftKey?lista.length-1:0)].focus({preventScroll:true});}
}
function tbOtworz(p,opcje){
  const E=tbZbuduj();
  TB.klucz=tbKlucz(p||piosenka());
  if(TB.klucz)utworTablicy(TB.klucz,p||piosenka());
  const {nowe,powrot,...filtr}=opcje||{};   // nowe: podświetl wiersze tej gry (otwarcie z wyników); powrot: fokus po zamknięciu (menu)
  TB.powrot=powrot||document.activeElement||null;   // 10-15: bez `powrot` fokus wraca tam, skąd otwarto (np. puchar na karcie)
  TB.filtr=Object.assign({partia:"",poziom:"",konf:"",kto:"wszyscy",wg:TB.filtr.wg||"punkty"},filtr);
  if(!nowe)TB.nowe=new Set();
  TB.otwarta=true;E.box.hidden=false;TB.odOtwarcia=performance.now();TB.tloDol=false;
  tbRysuj();
  E.utwor.focus({preventScroll:true});
}
function tbZamknij(){
  if(!TB.el||!TB.otwarta)return;
  TB.otwarta=false;TB.el.box.hidden=true;
  const b=S.ekran==="wyniki"?el("btnTablica"):TB.powrot;if(b&&b.isConnected)b.focus({preventScroll:true});
}
function tbRysuj(){
  const E=TB.el;if(!E)return;
  // lista utworów: z wynikami (od ostatnio granego) i bieżąca piosenka, nawet bez wyników
  const utwory=[...TB.utwory.values()].filter(u=>u.wpisy.length||u.klucz===TB.klucz)
    .sort((a,b)=>(b.wpisy.length?b.wpisy[b.wpisy.length-1].kiedy:0)-(a.wpisy.length?a.wpisy[a.wpisy.length-1].kiedy:0));
  E.utwor.replaceChildren(...utwory.map(u=>{const o=h("option","",u.tytul+(u.wpisy.length?" ("+u.wpisy.length+")":""));o.value=u.klucz;return o;}));
  E.utwor.value=TB.klucz||"";
  const u=TB.utwory.get(TB.klucz)||{wpisy:[],klucz:TB.klucz,tytul:""};
  E.plik.textContent=(u.klucz||"").startsWith("midi:")?tt("tablicaPlik",{plik:u.plik||u.tytul,rozmiar:fmtLiczba(u.rozmiar||0)}):T.tablicaWbudowana;
  E.plik.title=u.hash?"SHA-256 "+u.hash:"";   // odcisk pliku = klucz tablicy (ten sam plik pod inną nazwą ma te same wyniki)
  // filtry: tylko wartości, które w tym utworze naprawdę są
  const wszystkie=u.wpisy;
  const opcje=(k,wartosci,napis)=>{const s=E.filtry.querySelector('select[data-k="'+k+'"]');
    const o0=h("option","",T.tablicaWszystkie);o0.value="";
    s.replaceChildren(o0,...wartosci.map(v=>{const o=h("option","",napis(v));o.value=v;return o;}));
    if(!wartosci.includes(TB.filtr[k]))TB.filtr[k]="";s.value=TB.filtr[k];s.disabled=wartosci.length<1;};
  const unik=f=>[...new Set(wszystkie.map(f).filter(v=>v!=null&&v!==""))];
  opcje("partia",unik(w=>w.partia),v=>v);
  const kolejnosc=ZC_TRUDNOSC.POZIOMY.map(p=>p.k);
  opcje("poziom",unik(w=>w.poziom).sort((a,b)=>kolejnosc.indexOf(a)-kolejnosc.indexOf(b)),v=>T["trudnosc_"+v]||v);
  const opisy=new Map(wszystkie.map(w=>[w.konfId,opisKonfiguracji(w.konf)]));
  opcje("konf",unik(w=>w.konfId),v=>opisy.get(v)||v);
  // segmenty: jeden przystanek Taba na grupę (zaznaczona opcja), strzałki przestawiają (keydown w tbZbuduj)
  for(const seg of E.filtry.querySelectorAll(".segment"))for(const b of seg.children){const t=TB.filtr[seg.dataset.k]===b.dataset.v;
    b.setAttribute("aria-checked",String(t));b.tabIndex=t?0:-1;}
  // tabela
  const wg=TB.filtr.wg,wiersze=filtrujWpisy(wszystkie,TB.filtr).sort(porownajWpisy(wg));
  const K=T.tablicaKol,glowa=h("div","tb-wiersz tb-glowa");glowa.setAttribute("role","row");
  for(const k of ["miejsce","kto","partia","konf","punkty","precyzja","kombo","kiedy"]){
    const c=h("span","tb-"+k+(k===wg?" tb-wg":""),K[k]);c.setAttribute("role","columnheader");glowa.append(c);}
  const teraz=Date.now();
  E.tabela.replaceChildren(glowa,...wiersze.slice(0,200).map((w,i)=>{
    const r=h("div","tb-wiersz"+(TB.nowe.has(w.id)?" nowy":"")+(w.zrodlo==="bot"?" bot":""));r.setAttribute("role","row");
    r.style.setProperty("--kolor",w.kolor||"#6cb33f");
    const kto=h("span","tb-kto");
    // wiersz bez obrazka kapsla (stare albo zaimportowane wiersze): kółko w kolorze gracza zamiast zepsutego obrazka
    const kap=w.kapsel?h("img","tb-kapsel"):h("span","tb-kapsel tb-kapsel-brak");
    if(w.kapsel){kap.src=w.kapsel;kap.alt="";}else kap.setAttribute("aria-hidden","true");
    const podpis=h("span","tb-podpis");podpis.append(h("b","",w.kto),h("small","",w.zrodlo==="bot"?
      T.zrodlo_bot+(w.poziomBota?" · "+(T["poziom_bota_"+w.poziomBota]||""):""):(T["zrodlo_"+w.zrodlo]||"")));
    kto.append(kap,podpis);
    const partia=h("span","tb-partia");partia.append(h("span","tb-partia-nazwa",w.partia||""));
    if(w.trudnosc!=null)partia.append(znaczekTrudnosci({ocena:w.trudnosc,poziom:w.poziom||poziomTrudnosci(w.trudnosc),glowne:[]},"maly"));
    const komorki=[h("span","tb-miejsce",String(i+1)),kto,partia,h("span","tb-konf",opisKonfiguracji(w.konf)),
      h("span","tb-punkty",fmtLiczba(w.punkty)),
      (()=>{const c=h("span","tb-precyzja");c.append(h("b","",Math.round(w.precyzja)+"%"),h("small","",tt("trafionych",{t:w.trafione,n:w.nut})));
        c.title=T.kolCelnosc+": "+Math.round(w.celnosc)+"%";return c;})(),
      h("span","tb-kombo",String(w.maxKombo)),h("span","tb-kiedy",kiedyTekst(w.kiedy,teraz))];
    for(const c of komorki)c.setAttribute("role","cell");
    r.append(...komorki);
    return r;
  }));
  E.pusto.hidden=!!wiersze.length;
  E.pusto.textContent=wszystkie.length?T.tablicaPustaFiltr:T.tablicaPusta;
  const nowy=E.tabela.querySelector(".tb-wiersz.nowy");if(nowy)nowy.scrollIntoView({block:"nearest"});
}

const Tablica={wczytaj:tbWczytaj,zapiszGre:tbZapiszGre,otworz:tbOtworz,zamknij:tbZamknij,zFolderu:tbZFolderu,
  top:(p,n)=>{const k=p&&tbKlucz(p),u=k&&TB.utwory.get(k);return topWpisy(u?u.wpisy:[],n);},klucz:kluczUtworu,
  utwor:k=>TB.utwory.get(k)||null,stan:()=>({gotowa:TB.gotowa,otwarta:TB.otwarta,klucz:TB.klucz,filtr:Object.assign({},TB.filtr),
    utworow:TB.utwory.size,wierszy:TB.el?TB.el.tabela.querySelectorAll(".tb-wiersz:not(.tb-glowa)").length:0}),_TB:TB};
