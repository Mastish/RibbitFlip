"use strict";
// ===== RIBBITBEAT: paczki MIDI, import z adresu i ze schowka, licencje i atrybucja =====
// Paczki muzyki MIDI, które użytkownik pobiera jednym kliknięciem z Hugging Face (handoff „Pakiety MIDI i licencje
// w Ribbit Beat”, 2026-10-03). Pobiera SERWER aplikacji (ribbitflip_songpacks.py, trasy /gry/api/), bo tylko on
// zapisze zwykłe pliki .mid, pack.json i ATTRIBUTION.txt w katalogu użytkownika, a strona gry łączy się wyłącznie
// z nim (CSP bez wyjątków).
//
// WSZYSTKO W „MOICH”. Ten plik buduje w zakładce „Moje” trzy rzeczy: kafle paczek
// do pobrania (headstart), kafel importu z wklejonego adresu i kafel własnego pliku. Utworów paczki NIE pokazuje
// już osobną listą wierszy: po pobraniu każdy utwór wchodzi do biblioteki jak plik z folderu (pkDoBiblioteki →
// kolejka z biblioteka.js: taśma postępu, karty-szkielety, karteczka przy błędzie) i dalej jest zwykłą kartą
// z ♥, podglądem, szufladą i tablicą wyników. „Usuń paczkę” zabiera pliki i te karty (bibUsunPaczke).
//
// Licencje: każdy wpis biblioteki niesie obiekt `licencja` (wbudowane = domena publiczna, własne = plik użytkownika,
// paczki = z manifestu), a utwór na licencji CC BY / BY-SA ma widoczną atrybucję w panelu szczegółów, w HUD od
// odliczania do końca piosenki, na wynikach i na ekranie „Autorzy i licencje”.
// Ten plik ładuje się po biblioteka.js i korzysta z jego stanu (B, bibDodajPlik, ustawFiltr, kolejka) oraz ze słownika T.

const ZC_PAK={ODPYTYWANIE_MS:250,
  IMSLP:"https://imslp.org",ZBIORY:[["TiMauzi/imslp-midi-cc0-1.0","https://huggingface.co/datasets/TiMauzi/imslp-midi-cc0-1.0"],
    ["TiMauzi/imslp-midi-by-sa","https://huggingface.co/datasets/TiMauzi/imslp-midi-by-sa"]]};
const ZC_LICENCJE={
  "public-domain":{nazwa:"Domena publiczna",krotko:"PD",url:"https://creativecommons.org/publicdomain/mark/1.0/"},
  "cc0-1.0":{nazwa:"CC0 1.0",krotko:"CC0",url:"https://creativecommons.org/publicdomain/zero/1.0/"},
  "cc-by-3.0":{nazwa:"CC BY 3.0",krotko:"CC BY 3.0",url:"https://creativecommons.org/licenses/by/3.0/",atrybucja:true},
  "cc-by-4.0":{nazwa:"CC BY 4.0",krotko:"CC BY 4.0",url:"https://creativecommons.org/licenses/by/4.0/",atrybucja:true},
  "cc-by-sa-3.0":{nazwa:"CC BY-SA 3.0",krotko:"CC BY-SA 3.0",url:"https://creativecommons.org/licenses/by-sa/3.0/",atrybucja:true},
  "cc-by-sa-4.0":{nazwa:"CC BY-SA 4.0",krotko:"CC BY-SA 4.0",url:"https://creativecommons.org/licenses/by-sa/4.0/",atrybucja:true}};
// wersja angielska (js/jezyk.js): jedyna polska nazwa licencji; reszta to nazwy CC, takie same w obu językach
if(typeof RBJezyk!=="undefined"&&RBJezyk.en)ZC_LICENCJE["public-domain"].nazwa=T.licWbudowana;
// wBib: klucze „paczka/utwór” już wczytane do biblioteki (nie wczytujemy ich drugi raz); doBib: kolejka w biegu
const PK={dostepne:null,pakiety:[],utwory:{},zadania:new Map(),odpyt:0,el:null,url:null,wBib:new Set(),doBib:null,
  rozwiniete:false,pierwszeKarty:false};

// ---------------------------------------------------------------------------------------------
// CZYSTE FUNKCJE (testy: tests/gry_zabi_chor_harness.mjs)
// Obiekt licencji wpisu biblioteki. rodzaj: "wbudowana" | "pakiet" | inne (plik użytkownika: folder, przeciągnięty, adres).
function licencjaWpisu(rodzaj,utwor,adres){
  if(rodzaj==="wbudowana")return {typ:"pd",id:"public-domain",nazwa:T.licWbudowana,krotko:"PD",url:ZC_LICENCJE["public-domain"].url};
  if(rodzaj==="pakiet"&&utwor){
    const L=ZC_LICENCJE[utwor.license]||{nazwa:utwor.license||"?",krotko:utwor.license||"?"};
    return {typ:"pakiet",id:utwor.license,nazwa:L.nazwa,krotko:L.krotko,url:utwor.license_url||L.url||"",atrybucja:!!L.atrybucja,
      tytul:utwor.title||"",kompozytor:utwor.composer||"",autorMidi:utwor.midi_author||"",zrodlo:utwor.source_url||"",
      strona:utwor.metadata_url||"",pakiet:utwor.pakiet||""};
  }
  return {typ:"uzytkownik",id:"uzytkownik",nazwa:T.licUzytkownik,krotko:T.licUzytkownikKrotko,url:"",zrodlo:adres||""};
}
// Jedna linia atrybucji: „tytuł – kompozytor · licencja · MIDI: autor” (HUD, ekran ładowania i wyników).
function liniaAtrybucji(tytul,lic){
  if(!lic)return tytul||"";
  const czesci=[(lic.tytul||tytul||"")+(lic.kompozytor?" – "+lic.kompozytor:""),lic.nazwa];
  if(lic.autorMidi)czesci.push(tt("licMidiAutor",{kto:lic.autorMidi}));
  return czesci.filter(Boolean).join(" · ");
}
// „{n} utworów” w napisach z T: polska odmiana po liczbie (1 utwór, 443 utwory, 60 utworów)
function ttUtwory(klucz,zm){
  // wersja angielska (js/jezyk-en.js pisze „{n} songs”): tylko 1 ma liczbę pojedynczą
  return tt(klucz,zm).replace(/(\d+) utworów/g,(c,n)=>n+" "+odmiana(+n,"utwór","utwory","utworów")).replace(/(^|\D)1 songs\b/g,"$11 song");
}
function fmtMB(bajty){
  const mb=(+bajty||0)/1048576,loc=typeof RBJezyk!=="undefined"?RBJezyk.loc:"pl-PL";   // język liczb jak język gry
  return mb<.1?(loc==="pl-PL"?"<0,1 MB":"<0.1 MB"):mb.toLocaleString(loc,{maximumFractionDigits:mb<10?1:0})+" MB";
}
// Tekst ze schowka: adres pliku do pobrania (http/https, bez spacji) albo null.
function adresZeSchowka(tekst){
  const t=String(tekst||"").trim();
  return /^https?:\/\/[^\s<>\x22\x27]+$/i.test(t)&&t.length<=500?t:null;   // \x22 \x27: cudzysłowy, nie w adresie
}
// 10-18 (B-10): nazwa, opis i skrót licencji paczki w języku gry (serwer wysyła name_en, description_en, license_summary_en)
const pkEN=()=>typeof RBJezyk!=="undefined"&&!!RBJezyk.en;
function pkNazwa(p){return (pkEN()&&p.name_en)||p.name||p.pack_id;}
function pkOpis(p){return (pkEN()&&p.description_en)||p.description||"";}
function pkLicSkrot(p){return (pkEN()&&p.license_summary_en)||p.license_summary||"";}

// ---------------------------------------------------------------------------------------------
// SERWER (token sesji jak w panelu; poza aplikacją tras nie ma i zakładka mówi to wprost)
async function pkApi(sciezka,cialo){
  const o=cialo?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(cialo)}:{};
  if(cialo&&window.RIBBITFLIP_TOKEN)o.headers["X-RibbitFlip-Token"]=window.RIBBITFLIP_TOKEN;
  const r=await fetch("/gry/api/"+sciezka,o);
  const typ=r.headers.get("Content-Type")||"";
  if(!typ.includes("json")){if(!r.ok)throw Object.assign(new Error("HTTP "+r.status),{status:r.status});return r;}
  const j=await r.json();
  if(!r.ok||j.ok===false)throw Object.assign(new Error(j.error||("HTTP "+r.status)),{status:r.status});
  return j;
}
async function pkSprawdz(){
  try{const j=await pkApi("pakiety");PK.dostepne=true;PK.pakiety=j.pakiety||[];}
  catch(e){PK.dostepne=false;PK.pakiety=[];}
  return PK.dostepne;
}

// ---------------------------------------------------------------------------------------------
// SEKCJA „PACZKI”: kafle paczek do pobrania. Od 10-20 mieszka w panelu czarnego paska „Dodaj utwory” (krok 1),
// który sam się zwija i rozwija, więc buduje się PŁASKO: bez własnego przycisku-przełącznika i zawsze otwarta
// (`o.plaskie`). Stan („3 paczki · 531 utworów · pobrano 1 z 3”) wpisuje wtedy pasek, nie ta sekcja.
function pkZbuduj(panel,o){
  o=o||{};
  const box=h("div","pk-paczki");box.id="bibPaczki";
  const przel=o.plaskie?null:h("button","pk-paczki-przel");
  if(przel){przel.type="button";przel.append(h("b","pk-paczki-tytul",T.pakTytul),h("span","pk-paczki-stan",""));}
  const tresc=h("div","pk-paczki-tresc");
  const karty=h("div","pk-karty");
  const licencje=h("button","przycisk maly pk-licencje",T.licEkran);licencje.type="button";licencje.onclick=()=>pkEkranLicencji();
  tresc.append(h("p","biblio-nota pk-nota",T.pakNota),karty,licencje);
  if(przel){przel.onclick=()=>pkRozwin(tresc.hidden);box.append(przel,tresc);}
  else box.append(h("h3","kafel-tytul pk-paczki-naglowek",T.pakGotoweTytul),tresc);   // zakładka „Wgraj własny”: paczki pod własnymi plikami, z własnym nagłówkiem
  panel.prepend(box);
  PK.el={panel,box,karty,przel,tresc};
  pkRozwin(!!o.plaskie);   // płaska: zawsze otwarta; z przełącznikiem pkRysujKarty rozwinie, jeśli nic nie jest pobrane
  pkOdswiez();
}
function pkRozwin(otwarte){
  if(!PK.el)return;
  if(!PK.el.przel)otwarte=true;   // płaska sekcja w panelu paska: zwija ją sam pasek
  PK.rozwiniete=!!otwarte;
  PK.el.tresc.hidden=!otwarte;
  if(PK.el.przel)PK.el.przel.setAttribute("aria-expanded",String(!!otwarte));
  PK.el.box.classList.toggle("otwarte",!!otwarte);
}
// „Pokaż paczki” (dziś: otwarcie panelu paska „Dodaj utwory”): rozwinięcie i przewinięcie do kafli
// (fokus dokłada lobby-scena.js)
function pkPokazPaczki(){
  if(!PK.el)return;
  pkRozwin(true);
  PK.el.box.scrollIntoView({block:"nearest"});
}
async function pkOdswiez(){
  if(!PK.el)return;
  await pkSprawdz();
  if(!PK.dostepne){
    PK.el.karty.replaceChildren(h("p","biblio-nota",T.pakTylkoWAplikacji));
    if(PK.el.przel)PK.el.przel.querySelector(".pk-paczki-stan").textContent="";
    odswiezLiczniki();return;
  }
  for(const p of PK.pakiety)if(p.songs_installed>0)await pkWczytajListe(p.pack_id);
  pkRysujKarty();odswiezLiczniki();
  for(const p of PK.pakiety)if(p.zadanie&&p.zadanie.stan==="trwa")pkSledz(p.pack_id,p.zadanie.id);
  pkDoBiblioteki();
}
async function pkWczytajListe(pid){
  try{const j=await pkApi("pakiety/utwory?pack="+encodeURIComponent(pid));PK.utwory[pid]=(j.utwory||[]).map(s=>Object.assign(s,{pakiet:pid}));}
  catch(e){PK.utwory[pid]=PK.utwory[pid]||[];}   // chwilowy błąd serwera nie kasuje listy, którą już mamy
}
function pkLicznik(){let n=0;for(const k in PK.utwory)n+=PK.utwory[k].length;return n;}
// Utwory pobranych paczek → karty biblioteki. Jedna kolejka naraz (ta sama, która wczytuje pliki z folderu:
// taśma „Wczytuję N z M”, karty-szkielety z tytułami od razu, karteczka przy pliku, którego nie da się wczytać).
// Wołają ją: start gry (bibStart), koniec pobierania paczki (pkSledz) i wejście na zakładkę „Moje” (pkOdswiez).
function pkDoBiblioteki(){
  PK.doBib=(PK.doBib||Promise.resolve()).then(pkWczytajPaczkiDoBiblioteki).catch(e=>console.warn("paczki do biblioteki",e));
  return PK.doBib;
}
async function pkWczytajPaczkiDoBiblioteki(){
  if(PK.dostepne===null)await pkSprawdz();
  if(!PK.dostepne)return;
  for(const p of PK.pakiety)if(p.songs_installed>0&&!PK.utwory[p.pack_id])await pkWczytajListe(p.pack_id);
  const zadania=[];
  for(const p of PK.pakiety)for(const s of PK.utwory[p.pack_id]||[]){
    const k=s.pakiet+"/"+s.id;
    if(PK.wBib.has(k))continue;
    zadania.push({id:"paczka:"+k,tytul:s.title||s.id,wykonaj:()=>pkOtworz(s)});
  }
  if(zadania.length)await kolejka(zadania,"pakWczytuje");
}
function pkRysujKarty(){
  // linia stanu przy zwiniętej sekcji; pierwsze rysowanie zwija ją, jeśli jakaś paczka już jest na dysku
  const pobrane=PK.pakiety.filter(p=>p.songs_total>0&&p.songs_installed>=p.songs_total).length;
  const mam=PK.pakiety.reduce((n,p)=>n+(p.songs_installed||0),0);
  if(PK.el.przel)PK.el.przel.querySelector(".pk-paczki-stan").textContent=mam
    ?ttUtwory("pakStanGotowe",{p:pobrane,n:PK.pakiety.length,u:mam})
    :ttUtwory("pakStanBrak",{u:PK.pakiety.reduce((n,p)=>n+(p.songs_total||0),0)});
  if(!PK.pierwszeKarty){PK.pierwszeKarty=true;if(PK.el.przel)pkRozwin(!mam);}
  const box=PK.el.karty;box.replaceChildren();
  for(const p of PK.pakiety){
    const z=PK.zadania.get(p.pack_id)||p.zadanie;
    const k=h("div","pk-karta");k.dataset.pack=p.pack_id;
    const glowa=h("div","pk-glowa");
    glowa.append(h("b","pk-nazwa",pkNazwa(p)),h("span","pk-lic",pkLicSkrot(p)));
    const opis=h("p","pk-opis",pkOpis(p)+" "+ttUtwory("pakRozmiar",{n:p.songs_total,mb:fmtMB(p.download_bytes)}));
    opis.dataset.utwory=String(p.songs_total||0);   // duża liczba na okładce paczki (gry-piosenka.css)
    const akcje=h("div","pk-akcje");
    const trwa=z&&z.stan==="trwa";
    if(trwa){
      const pasek=h("div","pk-pasek");pasek.setAttribute("role","progressbar");
      const wyp=h("span","pk-pasek-wyp");pasek.append(wyp);
      const fr=z.bajtyRazem?Math.min(1,z.bajty/z.bajtyRazem):0;wyp.style.transform="scaleX("+fr.toFixed(3)+")";
      pasek.setAttribute("aria-valuenow",String(Math.round(100*fr)));pasek.setAttribute("aria-valuemin","0");pasek.setAttribute("aria-valuemax","100");
      const napis=h("span","pk-pasek-napis",tt("pakPostep",{u:z.utwory,n:z.utworyRazem,mb:fmtMB(z.bajty),razem:fmtMB(z.bajtyRazem)}));
      const anuluj=h("button","przycisk maly",T.pakAnuluj);anuluj.type="button";
      anuluj.onclick=async()=>{anuluj.disabled=true;try{await pkApi("zadanie/anuluj",{id:z.id});}catch(e){}};
      akcje.append(pasek,napis,anuluj);
    }else{
      const pelny=p.songs_installed>=p.songs_total&&p.songs_total>0;
      if(!pelny){
        const et=p.songs_installed?tt("pakPobierzBrakujace",{n:p.songs_total-p.songs_installed}):
          tt("pakPobierz",{nazwa:pkNazwa(p),mb:fmtMB(p.download_bytes)});   // 10-18 (Z-102): napis z T i RB_EN.T
        const b=h("button","przycisk maly glowny pk-pobierz",et);b.type="button";b.title=T.pakPobierzOpis;
        // krótki napis pod okładką („Pobierz · 29 MB”); pełny zostaje tekstem przycisku dla czytników i starego układu
        if(!p.songs_installed&&T.pakPobierzKrotko)b.dataset.krotko=tt("pakPobierzKrotko",{mb:fmtMB(p.download_bytes)});
        b.onclick=()=>pkPobierz(p.pack_id,b);akcje.append(b);
      }else akcje.append(h("span","pk-stan",ttUtwory("pakZainstalowany",{n:p.songs_installed})));
      if(p.songs_installed){
        const u=h("button","przycisk maly pk-usun",T.pakUsun);u.type="button";u.onclick=()=>pkUsun(p);akcje.append(u);
      }
      if(z&&z.stan==="blad")k.append(h("p","pk-blad",z.blad||T.pakBlad));
      else if(z&&z.stan==="anulowane")k.append(h("p","pk-uwaga",T.pakAnulowane));
    }
    k.prepend(glowa,opis);k.append(akcje);
    box.append(k);
  }
}
// 10-18 (Z-64): przycisk wyłączony od kliknięcia do odpowiedzi serwera (dwuklik wysyłał dwa POST)
async function pkPobierz(pid,przycisk){
  if(przycisk){if(przycisk.disabled)return;przycisk.disabled=true;}
  try{const j=await pkApi("pakiety/pobierz",{pack:pid});pkSledz(pid,j.zadanie.id);if(PK.el)pkRysujKarty();}
  catch(e){toast(tt("pakBladStartu",{powod:e.message}),true);if(przycisk)przycisk.disabled=false;}
}
// 10-18 (Z-59): pytanie w oknie gry (pkOkno) zamiast systemowego confirm(): Esc, × i „Anuluj” = nie usuwaj; działa
// z klawiatury i z pada (#okno jest na liście nakładek lobby). Fokus startuje na „Anuluj”.
function pkUsun(p){
  const tak=h("button","przycisk maly glowny pk-usun-tak",T.pakUsun);tak.type="button";
  const nie=h("button","przycisk maly pk-usun-nie",T.pakAnuluj);nie.type="button";
  nie.onclick=pkZamknijOkno;
  tak.onclick=()=>{tak.disabled=nie.disabled=true;pkZamknijOkno();pkUsunTeraz(p);};
  const rzad=h("div","okno-przyciski");rzad.style.cssText="display:flex;gap:10px;justify-content:flex-end;margin-top:14px";
  rzad.append(nie,tak);
  pkOkno(T.pakUsun,[h("p","okno-wstep",ttUtwory("pakUsunPytanie",{nazwa:pkNazwa(p),n:p.songs_installed})),rzad]);
  nie.focus({preventScroll:true});
}
async function pkUsunTeraz(p){
  try{await pkApi("pakiety/usun",{pack:p.pack_id});}catch(e){toast(e.message,true);}
  delete PK.utwory[p.pack_id];
  for(const k of [...PK.wBib])if(k.startsWith(p.pack_id+"/"))PK.wBib.delete(k);
  bibUsunPaczke(p.pack_id);   // karty utworów tej paczki znikają z „Moich” i z „Wszystkich”
  pkOdswiez();
}
// Odpytywanie postępu zadań (pobieranie paczki): co 250 ms, karta paczki przerysowuje pasek. Koniec pobierania =
// świeża lista utworów i kolejka, która wstawia je do biblioteki jako karty.
function pkSledz(pid,zid){
  PK.zadania.set(pid,{id:zid,stan:"trwa",bajty:0,bajtyRazem:0,utwory:0,utworyRazem:0});
  if(PK.odpyt)return;
  PK.odpyt=setInterval(async()=>{
    let trwa=0;
    for(const [p,z] of PK.zadania){
      if(z.stan!=="trwa")continue;
      try{const j=await pkApi("zadanie?id="+encodeURIComponent(z.id));PK.zadania.set(p,j.zadanie);
        if(j.zadanie.stan==="trwa")trwa++;
        else{await pkSprawdz();await pkWczytajListe(p);odswiezLiczniki();pkDoBiblioteki();
          if(j.zadanie.stan==="gotowe")toast(ttUtwory("pakGotowe",{n:j.zadanie.utwory}));
          else if(j.zadanie.stan==="blad")toast(j.zadanie.blad||T.pakBlad,true);}
      }catch(e){z.stan="blad";z.blad=T.pakBrakSerwera;}
    }
    if(PK.el)pkRysujKarty();
    if(!trwa){clearInterval(PK.odpyt);PK.odpyt=0;}
  },ZC_PAK.ODPYTYWANIE_MS);
}
// Utwór z paczki → wpis biblioteki (bajty z dysku użytkownika przez serwer, parsowanie jak każdego MIDI).
// Woła ją kolejka pkWczytajPaczkiDoBiblioteki, więc błąd leci wyjątkiem: kolejka pokaże karteczkę przy utworze.
async function pkOtworz(s){
  const k=s.pakiet+"/"+s.id;
  if(PK.wBib.has(k))return null;
  const r=await pkApi("pakiety/plik?pack="+encodeURIComponent(s.pakiet)+"&song="+encodeURIComponent(s.id));
  const w=bibDodajZPakietu(await r.arrayBuffer(),s);
  PK.wBib.add(k);
  return w;
}

// ---------------------------------------------------------------------------------------------
// „DODAJ WŁASNE UTWORY” W ZAKŁADCE „MOJE”: dwa kafle obok siebie: import z wklejonego adresu (pasek postępu)
// i własny plik (przeciągnij i upuść albo wybór z dysku). Upuszczenie obsługuje okno (zabi-chor.js), tu tylko
// wybór z dysku.
function pkZbudujKafelPliku(){
  const box=h("div","pk-url pk-plik");box.setAttribute("role","group");box.setAttribute("aria-label",T.plikTytul);
  const wej=h("input","");wej.type="file";wej.accept=".mid,.midi,audio/midi,audio/x-midi";wej.multiple=true;wej.hidden=true;wej.tabIndex=-1;
  wej.onchange=()=>{const pliki=[...wej.files];wej.value="";wczytajPliki(pliki);};   // jeden albo wiele naraz (zabi-chor.js)
  // 11-19: cały folder naraz: przeglądarka oddaje wszystkie pliki z jego drzewa, wczytajPliki bierze z nich same MIDI
  const fol=h("input","");fol.type="file";fol.multiple=true;fol.webkitdirectory=true;fol.hidden=true;fol.tabIndex=-1;
  fol.onchange=()=>{const pliki=[...fol.files];fol.value="";wczytajPliki(pliki,{folder:true});};
  const bfol=h("button","przycisk maly pk-plik-folder",T.plikFolder);bfol.type="button";bfol.onclick=()=>fol.click();
  const strefa=h("button","pk-plik-strefa");strefa.type="button";strefa.onclick=()=>wej.click();
  strefa.append(h("span","pk-plik-ikona"),h("b","",T.plikPole),h("small","",T.plikWybierz));
  strefa.firstChild.setAttribute("aria-hidden","true");
  box.append(h("span","pk-url-et",T.plikTytul),strefa,bfol,h("p","biblio-nota pk-url-nota",T.plikNota),wej,fol);
  return box;
}
function pkZbudujImportUrl(panel){
  const box=h("form","pk-url");box.setAttribute("aria-label",T.urlTytul);
  box.noValidate=true;   // 10-18 (B-08): bez dymka przeglądarki w jej języku; adres sprawdza adresZeSchowka i toast gry
  const et=h("label","pk-url-et",T.urlTytul);et.htmlFor="pkUrlPole";
  const pole=h("input","biblio-pole");pole.id="pkUrlPole";pole.type="url";pole.placeholder=T.urlPole;pole.autocomplete="off";pole.spellcheck=false;
  const b=h("button","przycisk maly glowny",T.urlPobierz);b.type="submit";
  const pasek=h("div","pk-pasek pk-url-pasek");pasek.hidden=true;pasek.setAttribute("role","progressbar");
  pasek.append(h("span","pk-pasek-wyp"),h("span","pk-pasek-napis",""));
  const nota=h("p","biblio-nota pk-url-nota",T.urlNota);
  const wiersz=h("div","pk-url-wiersz");wiersz.append(pole,b);
  box.append(et,wiersz,pasek,nota);
  box.onsubmit=e=>{e.preventDefault();const a=adresZeSchowka(pole.value);if(!a){toast(T.urlZly,true);return;}pkImportujAdres(a);};
  const dodaj=h("div","pk-dodaj");dodaj.append(box,pkZbudujKafelPliku());
  // nagłówek jak w kafelu „Dodaj własne utwory” (zakładka Utwory): od razu widać, że własne pliki da się wgrać
  const gora=h("div","pk-dodaj-gora");gora.append(h("h3","kafel-tytul kafel-wlasne-tytul",T.folderDodajTytul),h("p","kafel-opis",T.folderDodajOpis));
  panel.prepend(dodaj);panel.prepend(gora);
  PK.url={box,pole,b,pasek};
}
async function pkImportujAdres(adres){
  if(S.ekran!=="lobby"){toast(T.najpierwSkoncz);return;}
  if(!PK.url)return;
  const U=PK.url;
  if(B.filtr!=="folder")ustawFiltr("folder",true);
  U.pole.value=adres;U.b.disabled=true;U.pasek.hidden=false;
  const wyp=U.pasek.querySelector(".pk-pasek-wyp"),napis=U.pasek.querySelector(".pk-pasek-napis");
  const ustawPasek=(fr,txt)=>{wyp.style.transform="scaleX("+Math.max(0,Math.min(1,fr)).toFixed(3)+")";napis.textContent=txt;
    U.pasek.setAttribute("aria-valuenow",String(Math.round(100*fr)));};
  ustawPasek(0,T.urlLacze);
  try{
    const j=await pkApi("import-url",{url:adres});let z=j.zadanie;
    while(z.stan==="trwa"){
      await new Promise(r=>setTimeout(r,ZC_PAK.ODPYTYWANIE_MS));
      z=(await pkApi("zadanie?id="+encodeURIComponent(z.id))).zadanie;
      ustawPasek(z.bajtyRazem?z.bajty/z.bajtyRazem:.5,z.bajtyRazem?tt("urlPostep",{kb:Math.round(z.bajty/1024),razem:Math.round(z.bajtyRazem/1024)})
        :tt("urlPostepBez",{kb:Math.round(z.bajty/1024)}));
    }
    if(z.stan!=="gotowe")throw new Error(z.blad||T.urlBlad);
    const r=await pkApi("import-url/wynik?id="+encodeURIComponent(z.id));
    const nazwa=decodeURIComponent(r.headers.get("X-Nazwa-Pliku")||"piosenka.mid");
    ustawPasek(1,T.urlWczytuje);
    const w=bibDodajPlik(await r.arrayBuffer(),nazwa,"adres",adres);
    wybierzPiosenkeId(w.id);
    toast(w.powtorka?tt("biblioJuzJest",{tytul:w.gra.tytul}):tt("dodanoMidi",{tytul:w.gra.tytul,partie:liczbaPartii(w.gra.partie.length)}));
    U.pole.value="";
  }catch(e){
    toast(e.status===404&&!PK.dostepne?T.pakTylkoWAplikacji:tt("urlBladPowod",{powod:e.message}),true);
  }finally{
    U.b.disabled=false;setTimeout(()=>{U.pasek.hidden=true;},900);
  }
}
// Ctrl+V w lobby: plik ze schowka (np. skopiowany w Eksploratorze) albo adres pliku MIDI. W polach tekstowych
// wklejanie działa zwyczajnie.
function pkWklejanie(e){
  if(S.ekran!=="lobby")return;
  const cel=e.target;if(cel&&(cel.tagName==="INPUT"||cel.tagName==="TEXTAREA"||cel.isContentEditable))return;
  const dt=e.clipboardData;if(!dt)return;
  const pliki=[...(dt.files||[])];   // 10-18 (B-07): wszystkie pliki ze schowka, po kolei jak w kaflu „Dodaj swój plik”
  if(pliki.length){e.preventDefault();(async()=>{for(const f of pliki)await wczytajPlik(f);})();return;}
  const adres=adresZeSchowka(dt.getData("text"));
  if(adres){e.preventDefault();pkImportujAdres(adres);}
}

// ---------------------------------------------------------------------------------------------
// LICENCJE: plakietka, panel szczegółów, ekran „Autorzy i licencje”
function znaczekLicencji(lic,naKlik){
  const b=h("button","licencja-znaczek",lic?lic.krotko:"?");b.type="button";
  b.dataset.typ=lic?lic.typ:"";
  b.title=lic?(lic.nazwa+(lic.atrybucja?" · "+T.licWymagaAtrybucji:"")):"";
  b.setAttribute("aria-label",T.licSzczegoly+": "+(lic?lic.nazwa:""));
  b.onclick=e=>{e.stopPropagation();if(naKlik)naKlik();};
  return b;
}
function link(tekst,url){
  if(!url)return document.createTextNode(tekst);
  const a=h("a","licencja-link",tekst);a.href=url;a.target="_blank";a.rel="noopener noreferrer";return a;
}
let pkPowrot=null;   // 10-15: przycisk, który otworzył okno; po zamknięciu wraca na niego fokus (Esc z licencji gubił miejsce)
function pkOkno(tytul,tresc){
  const box=el("okno");
  if(box.hidden)pkPowrot=document.activeElement;
  box.replaceChildren();
  const karta=h("div","karta tablica-karta okno-karta");karta.setAttribute("role","dialog");karta.setAttribute("aria-modal","true");
  const glowa=h("header","tablica-glowa");const t=h("h2","tablica-tytul okno-tytul",tytul);
  t.id="pkOknoTytul";karta.setAttribute("aria-labelledby",t.id);   // 10-18 (B-09): tytuł = nazwa dialogu
  const od=performance.now();   // wzorzec 4: klik w tło przez 300 ms od otwarcia nie zamyka (dwuklik otwierającego)
  const zam=h("button","gracz-usun tablica-zamknij","×");zam.type="button";zam.setAttribute("aria-label",T.oknoZamknij);zam.title=T.oknoZamknij;
  zam.onclick=pkZamknijOkno;glowa.append(t,zam);
  const cialo=h("div","okno-cialo");cialo.append(...tresc);
  karta.append(glowa,cialo);box.append(karta);box.hidden=false;
  box.onpointerdown=e=>{if(e.target===box&&performance.now()-od>300)pkZamknijOkno();};
  zam.focus({preventScroll:true});
}
function pkZamknijOkno(){const box=el("okno");if(box)box.hidden=true;const b=pkPowrot;pkPowrot=null;if(b&&b.isConnected&&b.focus)b.focus({preventScroll:true});}
function wierszAtrybucji(lic,tytul){
  const d=h("div","atrybucja");
  d.append(h("b","atrybucja-tytul",(lic.tytul||tytul||"")+(lic.kompozytor?" – "+lic.kompozytor:"")));
  const l=h("p","atrybucja-linia");l.append(T.licLicencja+": ",link(lic.nazwa,lic.url));d.append(l);
  if(lic.autorMidi)d.append(h("p","atrybucja-linia",T.licAutorPliku+": "+lic.autorMidi));
  if(lic.zrodlo){const z=h("p","atrybucja-linia");z.append(T.licZrodlo+": ",link(lic.typ==="pakiet"?T.licStronaPliku:lic.zrodlo,lic.zrodlo));d.append(z);}
  if(lic.strona){const z=h("p","atrybucja-linia");z.append(T.licStronaUtworu+": ",link(T.licImslp,lic.strona));d.append(z);}
  if(lic.atrybucja)d.append(h("p","atrybucja-linia atrybucja-zmiany",T.licZmiany));
  if(lic.typ==="uzytkownik")d.append(h("p","atrybucja-linia",T.licUzytkownikOpis));
  if(lic.typ==="pd")d.append(h("p","atrybucja-linia",T.licWbudowanaOpis));
  return d;
}
function pkSzczegoly(lic,tytul){pkOkno(T.licSzczegoly,[wierszAtrybucji(lic,tytul)]);}
async function pkEkranLicencji(){
  await pkSprawdz();
  const tresc=[];
  const pod=h("p","okno-wstep");pod.append(T.licPodziekowanie," ",link("IMSLP",ZC_PAK.IMSLP),". "+T.licZbiory+" ");
  ZC_PAK.ZBIORY.forEach(([n,u],i)=>{pod.append(link(n,u));pod.append(i?".":", ");});
  tresc.push(pod,h("p","okno-wstep",T.licZasada));
  for(const p of PK.pakiety){
    if(!PK.utwory[p.pack_id]&&p.songs_installed)await pkWczytajListe(p.pack_id);
    const lista=PK.utwory[p.pack_id]||[];if(!lista.length)continue;
    tresc.push(h("h3","okno-sekcja",ttUtwory("licSekcjaPakiet",{nazwa:pkNazwa(p),n:lista.length})));
    for(const s of lista)tresc.push(wierszAtrybucji(licencjaWpisu("pakiet",s),s.title));
  }
  tresc.push(h("h3","okno-sekcja",T.licSekcjaWbudowane));
  for(const def of BUILTIN)tresc.push(wierszAtrybucji(licencjaWpisu("wbudowana"),def.title));
  // twórca muzyki z menu głównego (js/menu-koncert.js, zbudujBufor; bez pliku i bez cudzych melodii)
  {const L=(pl,en)=>typeof RBJezyk!=="undefined"&&RBJezyk.wybierz?RBJezyk.wybierz(pl,en):pl;
    tresc.push(h("h3","okno-sekcja",L("Muzyka menu","Menu music")),
      h("p","atrybucja-linia",L("Ska-punkowy loop 96 BPM grający w menu głównym to utwór autorski RibbitBeat: gra składa go na żywo w kodzie z syntezowanych dźwięków, bez nagrań i bez cudzych melodii. Skomponowany z pomocą Codexa (OpenAI) dla RibbitBeat, na tej samej licencji co gra.",
        "The 96 BPM ska-punk loop in the main menu is an original RibbitBeat piece: the game builds it live in code from synthesized sounds, with no recordings and no borrowed melodies. Composed with the help of Codex (OpenAI) for RibbitBeat, under the same license as the game.")));}
  const moje=B.moje.length;
  if(moje){tresc.push(h("h3","okno-sekcja",tt("licSekcjaMoje",{n:moje})),h("p","atrybucja-linia",T.licUzytkownikOpis));}
  if(PK.dostepne===false)tresc.push(h("p","biblio-nota",T.pakTylkoWAplikacji));
  pkOkno(T.licEkran,tresc);
}

addEventListener("paste",pkWklejanie);
// Esc zamyka okno szczegółów i „Autorzy i licencje” (przed innymi skrótami lobby i wyników)
// 10-18 (B-09): Tab i Shift+Tab krążą w karcie okna (aria-modal), fokus spoza okna wraca do niego
addEventListener("keydown",e=>{const o=el("okno");if(!o||o.hidden)return;e.stopImmediatePropagation();
  if(e.key==="Escape"){e.preventDefault();pkZamknijOkno();return;}
  if(e.key!=="Tab")return;
  const karta=o.querySelector(".okno-karta");if(!karta)return;
  const f=[...karta.querySelectorAll("button,a[href],input,select,textarea,[tabindex]:not([tabindex='-1'])")]
    .filter(x=>!x.disabled&&x.getClientRects().length);
  if(!f.length)return;
  const i=f.indexOf(document.activeElement);
  if(i<0||(e.shiftKey&&i===0)||(!e.shiftKey&&i===f.length-1)){e.preventDefault();f[e.shiftKey?f.length-1:0].focus({preventScroll:true});}
},true);

const Pakiety={zbuduj:pkZbuduj,odswiez:pkOdswiez,zbudujImportUrl:pkZbudujImportUrl,importujAdres:pkImportujAdres,
  doBiblioteki:pkDoBiblioteki,pokazPaczki:pkPokazPaczki,rozwin:pkRozwin,
  licznik:pkLicznik,szczegoly:pkSzczegoly,ekranLicencji:pkEkranLicencji,otworz:pkOtworz,_PK:PK,
  // paczki/utwory/pobrane (runda 2 „Kurtka”, kafel „Pobierz paczki” w Utworach): ile paczek jest, ile mają utworów
  // razem i ile paczek pobrano w całości; trwa = id paczek, które właśnie się pobierają
  stan:()=>({dostepne:PK.dostepne,pakiety:PK.pakiety.map(p=>({id:p.pack_id,zainstalowane:p.songs_installed,razem:p.songs_total})),
    utworow:pkLicznik(),wBibliotece:PK.wBib.size,rozwiniete:PK.rozwiniete,okno:!!(el("okno")&&!el("okno").hidden),
    paczki:PK.pakiety.length,utwory:PK.pakiety.reduce((n,p)=>n+(p.songs_total||0),0),
    pobrane:PK.pakiety.filter(p=>p.songs_total>0&&p.songs_installed>=p.songs_total).length,
    trwa:PK.pakiety.filter(p=>{const z=PK.zadania.get(p.pack_id)||p.zadanie;return !!(z&&z.stan==="trwa");}).map(p=>p.pack_id)})};
