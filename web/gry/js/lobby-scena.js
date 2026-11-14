"use strict";
// ===== RibbitBeat: ekrany przed grą „Kurtka” (skejterskie menu × filc; 2026-10-09 wieczór) =====
// Wygląd: gry.css, blok „KURTKA”. Menu (splash) zostaje bez zmian.
// 1 Piosenka i 2 Rozgrywka to wnętrze kurtki maskotki (czarny filc, naszywki, nity, jedna różowa gwiazda).
// Ten moduł nie dotyka logiki lobby w zabi-chor.js ani biblioteka.js; dokłada warstwę prezentacji:
//  · wejście ekranu: po zmianie `data-ekran` (ustawia je pokazLobby) nowy ekran dostaje klasę .wejscie,
//  · kursor = wybór: fokus na wierszu utworu (strzałki, pad, Tab) od razu wybiera ten utwór (wybierzPiosenkeId),
//  · paski statystyk partii w #wybranaStaty (sześć czynników trudności tr.czynniki 0–10 i ocena),
//  · gwiazdę z różowego filcu w prawym górnym rogu każdej bandy (jedyny rekwizyt),
//  · CZARNY PASEK „DODAJ UTWORY” nad kolumnami kroku 1 (10-20): zwinięty mówi, ile jest paczek i utworów,
//    rozwinięty odsłania panel Pakietów (paczki, adres, plik, licencje). Jeden przełącznik, aria-expanded,
//    Esc zwija; treść panelu buduje biblioteka.js przez Pakiety,
//  · „slam”: tytuł wybranej piosenki w kroku 1 wjeżdża przy każdej zmianie, „Śpiewamy!” po odblokowaniu.
// Utwory są wprost w kroku „1 Piosenka”: osobnego ekranu Utwory nie ma, a karuzela
// cover-flow ustąpiła miejsca zwartej liście wierszy z Utworów — wybór utworu to dziś zwykła lista, więc
// strzałki, kółko i przeciąganie obsługuje nawigacja lobby i przewijanie listy, nie ten moduł.
// Gdy czegoś brakuje (harness Node, stary HTML), moduł milczy.
const LobbyScena=(function(){
  const el=id=>document.getElementById(id);
  const S_RUCH=()=>!(window.matchMedia&&matchMedia("(prefers-reduced-motion:reduce)").matches);
  const zglos=n=>{try{if(typeof DzwiekiUI!=="undefined"&&DzwiekiUI.zglos)DzwiekiUI.zglos(n);}catch(e){}};
  // napisy: {pl,en} przez RBJezyk.wybierz (js/jezyk.js; język wybierany raz przy starcie, zmiana przeładowuje
  // stronę); bez RBJezyk (harness Node) zawsze polski
  function tl(v){
    if(v==null)return "";if(typeof v==="string")return v;
    try{if(typeof RBJezyk!=="undefined"&&RBJezyk&&RBJezyk.wybierz)return RBJezyk.wybierz(v);}catch(e){}
    return v.pl;
  }
  const EN=()=>{try{return typeof RBJezyk!=="undefined"&&!!RBJezyk&&!!RBJezyk.en;}catch(e){return false;}};
  const CZYNNIKI=[["ruch",{pl:"Skoki",en:"Jumps"}],["gestosc",{pl:"Gęstość",en:"Density"}],["precyzja",{pl:"Precyzja",en:"Precision"}],
    ["rytm",{pl:"Rytm",en:"Rhythm"}],["zygzaki",{pl:"Zygzaki",en:"Zigzags"}],["dlugosc",{pl:"Długość",en:"Length"}]];
  let lobby=null,ostatniEkran=null;

  // klasę zdejmujemy po czasie, ponowne dodanie restartuje animację CSS
  function slam(e,klasa,ms){
    if(!e||!S_RUCH())return;
    e.classList.remove(klasa);void e.offsetWidth;e.classList.add(klasa);
    clearTimeout(e._slamT);e._slamT=setTimeout(()=>e.classList.remove(klasa),ms);
  }

  function poZmianieEkranu(){
    const nazwa=lobby.dataset.ekran;
    if(nazwa===ostatniEkran)return;
    const pierwszy=ostatniEkran===null;ostatniEkran=nazwa;
    // szukajka: fraza czyszczona przy wejściu do menu
    if(nazwa==="menu"&&typeof Biblioteka!=="undefined"&&Biblioteka.szukaj)Biblioteka.szukaj("");
    if(nazwa==="menu")rozwinDodaj(false,false);   // krok 1 zawsze wita zakładką „Wybierz utwór”
    if(nazwa==="konfiguracja"){G.pierwszy=true;setTimeout(()=>poGraczach([]),0);}   // po wejściu tylko pomiar kart graczy
    // kaskada wejścia: przy zasłonie odpala ją przejscie() (gdy zasłona zjeżdża), bez zasłony od razu
    if(!pierwszy&&nazwa!=="menu"&&!R.trwa)wejscieEkranu(el(nazwa));
  }
  // fokus wiersza = wybór (tylko na ekranie z listą; klik w wiersz już wybiera, więc tu tylko klawiatura i pad)
  function poFokusie(e){
    if(!e.target.classList||!e.target.classList.contains("bkarta-wybor"))return;
    const k=e.target.closest(".bkarta");if(!k||!k.dataset.id||k.classList.contains("wybrana")||k.classList.contains("szkielet"))return;
    if(lobby.dataset.ekran!=="wybor")return;
    // koło utworów: etykieta wskakuje od razu, a piosenkę (plakat po prawej) zatwierdza zatwierdzKolo, gdy koło stanie
    if(typeof wskazNaKole==="function"&&wskazNaKole(k,true))return;
    if(typeof wybierzPiosenkeId==="function")wybierzPiosenkeId(k.dataset.id);
  }
  // paski statystyk: 10 kwadratów na czynnik (pełne bursztynowe, od 7 w górę ciemniejszy bursztyn), na dole ocena i poziom
  function statystyki(){
    const box=el("wybrana");if(!box)return;
    let st=el("wybranaStaty");
    if(!st){st=document.createElement("div");st.id="wybranaStaty";st.className="wybrana-staty";st.setAttribute("aria-label",tl({pl:"Statystyki partii",en:"Part stats"}));}
    st.replaceChildren();
    let p=null,tr=null;
    // §18: paski dotyczą partii wybranej chipem w panelu odsłuchu (Biblioteka.podgladPartii().partia), metka mówi której
    let ip=0;try{const pp=typeof Biblioteka!=="undefined"&&Biblioteka.podgladPartii&&Biblioteka.podgladPartii();ip=pp&&Number.isInteger(pp.partia)?pp.partia:0;}catch(e){}
    try{p=typeof piosenka==="function"?piosenka():null;if(p&&ip>=p.partie.length)ip=0;tr=p&&typeof trudnoscPartiiW==="function"?trudnoscPartiiW(p,ip):null;}catch(e){tr=null;}
    if(!tr||!tr.czynniki){st.remove();return;}
    statystyki.partia=(p&&p.id)+":"+ip;
    try{if(typeof nazwaPartii==="function"){const mp=document.createElement("span");mp.className="staty-partia";
      mp.textContent=tl(TL.partia)+nazwaPartii(p.partie[ip]);st.append(mp);}}catch(e){}
    for(const [k,etl] of CZYNNIKI){const et=tl(etl);
      const v=Math.max(0,Math.min(10,Math.round(+tr.czynniki[k]||0)));
      const e=document.createElement("span");e.className="staty-et";e.textContent=et;
      const pasek=document.createElement("span");pasek.className="staty-pasek";pasek.setAttribute("role","img");
      pasek.setAttribute("aria-label",et+": "+v+tl({pl:" na 10",en:" out of 10"}));pasek.title=(typeof T!=="undefined"&&T["czynnik_"+k])||et;
      for(let i=1;i<=10;i++){const q=document.createElement("i");if(i<=v)q.className=v>=7&&i>=7?"pelny mocny":"pelny";pasek.append(q);}
      st.append(e,pasek);
    }
    const suma=document.createElement("span");suma.className="staty-suma";
    const b=document.createElement("b");b.textContent=typeof fmtOcena==="function"?fmtOcena(tr.ocena):String(tr.ocena);
    // skala i słowo poziomu w osobnych spanach (ten sam tekst co dotąd): pieczątka w kroku 1 pokazuje samo słowo (gry-piosenka.css)
    const skala=document.createElement("span");skala.className="staty-skala";skala.textContent=" / 10 · ";
    const poz=document.createElement("span");poz.className="staty-poziom";poz.textContent=(typeof T!=="undefined"&&T["trudnosc_"+tr.poziom])||tr.poziom||"";
    suma.append(b,skala,poz);
    try{   // §17: jedyna informacja ze zdania o trudności, której nie ma w paskach (ZC_BOT_NA_POZIOM i T z zabi-chor.js)
      const bot=typeof ZC_BOT_NA_POZIOM!=="undefined"&&ZC_BOT_NA_POZIOM[tr.poziom],nb=bot&&typeof T!=="undefined"&&T["poziom_bota_"+bot];
      if(nb){const m=document.createElement("span");m.className="staty-bot";m.textContent=tl(TL.bot)+nb;suma.append(m);}
    }catch(e){}
    st.append(suma);
    if(!st.parentNode){const opis=box.querySelector(".wybrana-opis")||box.querySelector(".wybrana-tytul");if(opis)opis.after(st);else box.append(st);}
  }
  // tytuł wybranej piosenki (krok 1) wjeżdża przy każdej zmianie piosenki (rysujWybrana przebudowuje #wybrana)
  let ostatniTytul=null;
  function tytulWybranej(){
    const t=document.querySelector("#wybrana .wybrana-tytul");if(!t)return;
    const tekst=t.textContent;
    // rysujWybrana potrafi przebudować kartę dwa razy po jednym wyborze: nowy węzeł w trakcie stampu dostaje go dalej
    if(tekst===ostatniTytul){if(performance.now()-tytulWybranej.t<200&&!t.classList.contains("slam")){t.classList.add("slam");setTimeout(()=>t.classList.remove("slam"),200);}return;}
    const bylo=ostatniTytul;ostatniTytul=tekst;
    if(bylo!==null){slam(t,"slam",200);tytulWybranej.t=performance.now();}
  }
  tytulWybranej.t=-1e9;

  // gwiazda z różowego filcu w prawym górnym rogu bandy (jedyny rekwizyt ekranów roboczych, gry.css „KURTKA”)
  const GWIAZDA=[[50,0],[61,35],[98,35],[68,57],[79,91],[50,70],[21,91],[32,57],[2,35],[39,35]];
  function przyszyjGwiazdy(){
    const scieg=GWIAZDA.map(([x,y])=>(50+(x-50)*.7).toFixed(1)+","+(53+(y-53)*.7).toFixed(1)).join(" ");
    for(const g of lobby.querySelectorAll(".lobby-ekran:not(.menu)>.ekran-gora")){
      if(g.querySelector(".kurtka-gwiazda"))continue;
      const s=document.createElement("span");s.className="kurtka-gwiazda";s.setAttribute("aria-hidden","true");
      s.innerHTML='<svg viewBox="0 0 100 100" focusable="false"><polygon points="'+scieg+'"/></svg>';
      g.append(s);
    }
  }

  // ===== LISTA UTWORÓW (10-20) =====
  // Lista jest zwykłą listą wierszy z biblioteka.js: pozycjami, przewijaniem i strzałkami zajmuje się nawigacja
  // lobby (zabi-chor.js) oraz przeglądarka. Tutaj zostają tylko trzy rzeczy, których lista sama nie zrobi:
  // lista bieżącej zakładki (dla szukajki i podsłuchu), kaskada wierszy przy wejściu i „drugi klik = Dalej”.
  // listy biblioteki: Wszystkie, Wbudowane i lista w panelu „Moje”
  function listyBiblioteki(){
    const f=el("blista-folder"),lf=f&&f.querySelector(":scope>ul.biblio-lista");
    return [el("blista-wszystkie"),el("blista-wbudowane"),lf].filter(Boolean);
  }
  // lista widocznej zakładki (liczy się też w menu, żeby fokus z pokazLobby trafił w widoczny wiersz)
  function listaFiltra(){
    for(const l of listyBiblioteki()){
      if(l.hidden)continue;
      const panel=l.parentElement&&l.parentElement.classList.contains("biblio-panel")?l.parentElement:null;
      if(panel&&panel.hidden)continue;
      return l;
    }
    return null;
  }
  const kartyListy=l=>[...l.children].filter(li=>li.classList.contains("bkarta")&&!li.hidden);   // ukryte szukajką się nie liczą
  const wybieralna=li=>!!li.dataset.id&&!li.classList.contains("szkielet");

  // „Śpiewamy!”: po odblokowaniu krótki slam (120 ms)
  function obserwujStart(){
    const b=el("btnStart");if(!b)return;
    let byl=b.disabled;
    new MutationObserver(()=>{const teraz=b.disabled;if(byl&&!teraz&&lobby.dataset.ekran==="konfiguracja")slam(b,"slam",140);byl=teraz;})
      .observe(b,{attributes:true,attributeFilter:["disabled"]});
  }

  // ===== ZAKŁADKI KROKU 1: „WYBIERZ UTWÓR” ALBO „WGRAJ WŁASNY” (11-19; wcześniej czarny pasek „Dodaj utwory”) =====
  // Dwie równorzędne zakładki nad kolumnami. Pierwsza to biblioteka z kartą piosenki, druga to jedno miejsce na
  // wszystko, co przynosi nowe utwory: plik, adres, paczki do pobrania i licencje (panel buduje Pakiety,
  // biblioteka.js → zbudujDodajUtwory). Zakładka „Wgraj własny” świeci, dopóki nie jest wybrana (gry.css, blok
  // „ZAKŁADKI KROKU 1”), i niesie linię stanu paczek („3 paczki · 531 utworów · pobrano 1 z 3”). Po dodaniu
  // własnego utworu gra sama wraca na „Wybierz utwór”, bo nowy utwór jest już wybrany na liście.
  // Teksty elementów z data-tl. Dług: przenieść do słownika T w zabi-chor.js.
  const TL={paczkiWszystkie:{pl:"Masz wszystkie paczki",en:"You have every pack"},paczkiSprawdzam:{pl:"Sprawdzam paczki…",en:"Checking packs…"},
    paczkiPobrano:{pl:"pobrano {n} z {p}",en:"{n} of {p} downloaded"},paczkiTrwa:{pl:"pobieram…",en:"downloading…"},
    paczkiPoza:{pl:"Paczki pobierzesz w aplikacji RibbitFlip.",en:"Packs download inside the RibbitFlip app."},
    zakWybierz:{pl:"Wybierz utwór",en:"Pick a song"},zakWybierzOpis:{pl:"{n} w bibliotece gry",en:"{n} in the game library"},
    zakAlbo:{pl:"albo",en:"or"},
    zakWgraj:{pl:"Wgraj własny",en:"Add your own"},
    zakWgrajOpis:{pl:"Plik .mid, adres albo gotowa paczka",en:"A .mid file, a link or a ready-made pack"},
    zrodloAria:{pl:"Skąd wziąć utwór",en:"Where the song comes from"},
    wlasneUpusc:{pl:"Pliki .mid albo cały folder upuść gdziekolwiek w oknie. Plik albo adres wklej skrótem Ctrl+V.",en:"Drop .mid files or a whole folder anywhere on the window. Paste a file or an address with Ctrl+V."},
    dodano:{pl:"Dodano: {t}",en:"Added: {t}"},bibTytul:{pl:"Twoja biblioteka",en:"Your library"},
    // runda 5: podsłuch i scoreboard kroku 1
    psGrupa:{pl:"Podsłuch utworu",en:"Song preview"},psGraj:{pl:"Posłuchaj",en:"Listen"},psStop:{pl:"Stop",en:"Stop"},
    psAuto:{pl:"Auto",en:"Auto"},psAutoOpis:{pl:"Odtwarzaj automatycznie",en:"Autoplay"},psSkad:{pl:"Skąd grać",en:"Where to start"},
    psOdPoczatku:{pl:"Od początku",en:"From the start"},psOdSrodka:{pl:"Od środka",en:"From the middle"},
    psKliknij:{pl:"Kliknij, żeby włączyć dźwięk",en:"Click to enable sound"},
    tablicaTytul:{pl:"Najlepsi w tej piosence",en:"Best in this song"},tablicaPelna:{pl:"Pełna tablica",en:"Full leaderboard"},
    bot:{pl:"bot: ",en:"bot: "},partia:{pl:"Partia: ",en:"Part: "},
    zakTablica:{pl:"Tablica wyników",en:"Leaderboard"},zakUstawienia:{pl:"Ustawienia piosenki",en:"Song settings"},tempo:{pl:"tempo {n}",en:"{n} BPM"}};
  // liczebniki: polskie trzy formy, angielskie dwie
  const LICZ={paczka:{pl:[" paczka"," paczki"," paczek"],en:[" pack"," packs"]},utwor:{pl:[" utwór"," utwory"," utworów"],en:[" song"," songs"]}};
  function licz(n,k){const f=LICZ[k];if(EN())return n===1?f.en[0]:f.en[1];return odm(n,f.pl[0],f.pl[1],f.pl[2]);}
  // wpis słownika: zwykły napis (polski) albo {pl,en}; język z <html lang> (wersję angielską robi osobna sesja)
  const odm=(n,a,b,c)=>n===1?a:(n%10>=2&&n%10<=4&&(n%100<12||n%100>14))?b:c;
  const wstaw=(t,z)=>t.replace(/\{(\w+)\}/g,(_,k)=>z[k]!=null?z[k]:"");
  const span=(kl,t)=>{const e=document.createElement("span");e.className=kl;if(t!=null)e.textContent=t;return e;};
  function wypelnijTL(){
    for(const e of document.querySelectorAll("[data-tl]"))if(TL[e.dataset.tl]!=null)e.textContent=tl(TL[e.dataset.tl]);
    for(const e of document.querySelectorAll("[data-tl-aria]"))if(TL[e.dataset.tlAria]!=null)e.setAttribute("aria-label",tl(TL[e.dataset.tlAria]));
  }
  const DD={otwarty:false};   // otwarty = wybrana zakładka „Wgraj własny”
  // linia stanu na zakładce „Wgraj własny”: liczby paczek na żywo z Pakiety.stan(); filcowe kwadraty = paczki (pełny = pobrana,
  // kreskowany = pobiera się). Ta sama treść jest etykietą przycisku dla czytnika ekranu.
  let ostatniStanPaczek="";
  function paskiDodaj(){
    const box=el("dodajStan"),btn=el("btnDodajUtwory");
    if(!box||!btn||typeof Pakiety==="undefined"||!Pakiety.stan)return;
    const s=Pakiety.stan(),klucz=JSON.stringify([s.dostepne,s.paczki,s.utwory,s.pobrane,s.trwa]);
    if(klucz===ostatniStanPaczek)return;ostatniStanPaczek=klucz;
    box.replaceChildren();
    const komplet=!!s.dostepne&&s.paczki>0&&s.pobrane>=s.paczki;
    btn.classList.toggle("komplet",komplet);
    const opisy=[];
    if(s.dostepne===null){const t=tl(TL.paczkiSprawdzam);opisy.push(t);box.append(span("dodaj-nota",t));}
    else if(!s.dostepne||!s.paczki){const t=(typeof T!=="undefined"&&T.pakTylkoWAplikacji)||tl(TL.paczkiPoza);opisy.push(t);box.append(span("dodaj-nota",t));}
    else{
      const liczby=span("dodaj-liczby");
      liczby.append(document.createElement("b"),span("",licz(s.paczki,"paczka")+" · "),document.createElement("b"),span("",licz(s.utwory,"utwor")));
      liczby.children[0].textContent=String(s.paczki);liczby.children[2].textContent=String(s.utwory);
      opisy.push(s.paczki+licz(s.paczki,"paczka")+", "+s.utwory+licz(s.utwory,"utwor"));
      const postep=span("kafel-postep");postep.setAttribute("aria-hidden","true");
      for(let i=0;i<s.paczki;i++){const q=document.createElement("i");if(i<s.pobrane)q.className="pelny";else if(i<s.pobrane+s.trwa.length)q.className="trwa";postep.append(q);}
      const stan=komplet?tl(TL.paczkiWszystkie):wstaw(tl(TL.paczkiPobrano),{n:s.pobrane,p:s.paczki})+(s.trwa.length?" · "+tl(TL.paczkiTrwa):"");
      opisy.push(stan);
      box.append(liczby,postep,span(komplet?"dodaj-komplet":"dodaj-pobrano",stan));
    }
    btn.setAttribute("aria-label",tl(TL.zakWgraj)+". "+tl(TL.zakWgrajOpis)+" · "+opisy.join(" · "));
  }
  // przełączenie zakładek: on = „Wgraj własny”. aria-selected na zakładkach, [hidden] na panelu, klasa .wgraj na
  // ekranie chowa kolumny biblioteki i karty piosenki; `odUzytkownika` dokłada fokus (na wyborze pliku albo z powrotem
  // na zakładce) i świeży stan paczek z serwera
  function rozwinDodaj(on,odUzytkownika){
    const btn=el("btnDodajUtwory"),lista=el("btnWybierzUtwor"),panel=el("dodajPanel"),ekran=el("wybor");if(!btn||!panel)return;
    const zmiana=DD.otwarty!==!!on;
    DD.otwarty=!!on;
    panel.hidden=!on;
    btn.setAttribute("aria-selected",String(!!on));
    if(lista)lista.setAttribute("aria-selected",String(!on));
    if(ekran)ekran.classList.toggle("wgraj",!!on);
    if(!on){if(odUzytkownika&&zmiana&&lista)lista.focus({preventScroll:true});return;}
    if(typeof Pakiety!=="undefined"&&Pakiety.odswiez)Pakiety.odswiez();
    if(odUzytkownika)fokusNaWgraj();
  }
  // czy zakładka zjada „wstecz” (Esc, Back pada, przycisk „Wstecz”): wsteczLobby w zabi-chor.js pyta o to pierwsze;
  // z „Wgraj własny” wstecz prowadzi na „Wybierz utwór”, dopiero stamtąd do menu
  function zamknijDodaj(){
    if(!DD.otwarty)return false;
    rozwinDodaj(false,true);return true;
  }
  // fokus na wyborze pliku z dysku (pierwsza rzecz w panelu), a gdy go nie ma, na pierwszym przycisku panelu
  function fokusNaWgraj(){
    const panel=el("dodajPanel");if(!panel)return;
    const a=document.activeElement;
    if(a&&a!==document.body&&a.isConnected&&a.id!=="btnDodajUtwory")return;   // użytkownik poszedł już dalej
    const b=panel.querySelector(".pk-plik-strefa")||panel.querySelector("button:not([hidden]),input:not([hidden])");
    if(b&&b.getClientRects().length)b.focus({preventScroll:true});
  }
  // po dodaniu własnego pliku: powrót na „Wybierz utwór” (nowy utwór jest tam już wybrany) i przez 2 s naszywka
  // „Dodano: tytuł” na zakładkach; obok tego liczba utworów w nagłówku biblioteki i na zakładce
  const znane=new Set();let tStartu=0,tDodano=0;
  function poZmianieBiblioteki(){
    const B=typeof Biblioteka!=="undefined"&&Biblioteka._B;if(!B||!B.wpisy)return;
    const n=B.wpisy.size,l=el("bibLiczba");
    if(l)l.textContent=" · "+n+licz(n,"utwor");
    const zo=el("zakWybierzOpis");if(zo)zo.textContent=wstaw(tl(TL.zakWybierzOpis),{n:n+licz(n,"utwor")});
    const nowe=[];
    for(const [id,w] of B.wpisy)if(!znane.has(id)){znane.add(id);if(w.rodzaj!=="wbudowana"&&w.rodzaj!=="pakiet")nowe.push(w);}
    const d=el("kafelDodano");
    if(nowe.length&&d&&lobby.dataset.ekran==="wybor"&&performance.now()-tStartu>2500){
      d.textContent=wstaw(tl(TL.dodano),{t:nowe.map(w=>w.zr&&w.zr.tytul||w.id).join(", ")});d.hidden=false;
      slam(d,"slam",300);clearTimeout(tDodano);tDodano=setTimeout(()=>{d.hidden=true;},2000);
      if(DD.otwarty)rozwinDodaj(false,false);
    }
  }
  function startDodaj(){
    wypelnijTL();tStartu=performance.now();poZmianieBiblioteki();paskiDodaj();
    const btn=el("btnDodajUtwory"),lista=el("btnWybierzUtwor");
    if(btn)btn.addEventListener("click",()=>rozwinDodaj(true,true));
    if(lista)lista.addEventListener("click",()=>rozwinDodaj(false,true));
    const pk=el("bibPaczki");
    if(pk)new MutationObserver(paskiDodaj).observe(pk,{childList:true,subtree:true});
  }

  // ===== RUNDA 2: RUCH według 12 zasad animacji (orkiestracja; reguły w gry.css, blok „RUCH (runda 2)”) =====
  // Mapa zasad → miejsca w kodzie:
  //  1 squash & stretch: gry.css (:active przycisków, szukajka, kSlam karty, kWpada gracza), 2 anticipation: zasłona
  //  (ekran cofa się, przycisk zapada), „Śpiewamy!” (zapadnięcie 120 ms przed startGry),
  //  3 staging: zasłona z nazwą ekranu, przygaszenie kolumn bez fokusu, 4 pose-to-pose: trzy pozy przejścia
  //  (wyjście, zasłona ze stopem, wejście), 5 follow-through: kaskada wejścia (--wi, --wr), kolejne wiersze listy
  //  wchodzą co 25 ms, 6 slow in/out: EWEJ/EWYJ/EPOP, 7 arcs: napis zasłony, ♥, karta gracza, 8 secondary action:
  //  gwiazda drga przy wejściu, ścieg biegnie po wybranym wierszu, 9 timing: stałe poniżej, 10 exaggeration: napis
  //  zasłony 1,6 → 1, slam „Śpiewamy!” 1,15 → 1, flip metki GOTOWE!, 11 solid drawing: twarde cienie,
  //  12 appeal: materiał (filc, nić, nity) i kolory z §1.
  const EWEJ="cubic-bezier(.2,.8,.2,1)",EWYJ="cubic-bezier(.4,0,.8,.2)",EPOP="cubic-bezier(.34,1.3,.5,1)";
  const CZAS_BAZA={antycypacja:80,zakladka:20,zaslonaWjazd:160,stop:60,zaslonaWyjazd:240},CZAS=Object.assign({},CZAS_BAZA);
  // tempo przejścia: 1 = zwykłe; próba ekranów pod zasłoną startu (zabi-chor.js: probaEkranow) przechodzi ekrany w połowie czasu
  const tempoPrzejscia=f=>{const m=Math.max(.25,Math.min(1,+f||1));for(const k in CZAS_BAZA)CZAS[k]=Math.round(CZAS_BAZA[k]*m);};   // zakładka: zasłona rusza 20 ms przed końcem cofnięcia (overlapping action)
  const NAZWA_EKRANU={menu:{pl:"Menu",en:"Menu"},wybor:{pl:"Piosenka",en:"Song"},konfiguracja:{pl:"Rozgrywka",en:"Game"}};   // TL zasłony
  const RANGA={menu:0,wybor:1,konfiguracja:2};
  const R={trwa:false,oczekuje:null,blokada:false,zaslona:null,napis:null};
  const czekaj=ms=>new Promise(r=>setTimeout(r,ms));
  function zaslona(){
    if(R.zaslona&&R.zaslona.isConnected)return R.zaslona;
    const z=document.createElement("div");z.id="zaslona";z.className="zaslona";z.setAttribute("aria-hidden","true");   // stała warstwa poza ekranem (runda 3)
    const n=document.createElement("span");n.className="zaslona-napis";z.append(n);
    lobby.append(z);R.zaslona=z;R.napis=n;return z;
  }
  // kaskada wejścia: banda 0 ms, kolumny i kafle co 40 ms od 40 ms, wiersze listy od 120 ms co 25 ms (najwyżej 12)
  function wejscieEkranu(ekran){
    if(!ekran||!S_RUCH())return;
    const kolumny=[...ekran.querySelectorAll(":scope>.ekran-tresc>*,:scope>.lobby-dol")];
    kolumny.forEach((k,i)=>k.style.setProperty("--wi",String(i)));
    kaskadaWierszy(ekran);
    ekran.classList.remove("wejscie");void ekran.offsetWidth;ekran.classList.add("wejscie");
    clearTimeout(wejscieEkranu.t);wejscieEkranu.t=setTimeout(()=>ekran.classList.remove("wejscie"),720);
    const t=ekran.querySelector("#wybrana .wybrana-tytul");if(t)slam(t,"slam",200);
  }
  // wiersze listy w Utworach wchodzą po kolei (wejście ekranu, zmiana zakładki i sortowania)
  function kaskadaWierszy(ekran){
    if(!S_RUCH()||!ekran||ekran.id!=="wybor")return;
    const l=[...ekran.querySelectorAll(".biblio-lista")].find(x=>!x.closest("[hidden]"));if(!l)return;
    for(const li of l.querySelectorAll(":scope>.kw"))li.classList.remove("kw");
    let i=0;
    for(const li of l.children){if(li.hidden||!li.classList.contains("bkarta"))continue;if(i>=12)break;li.style.setProperty("--wr",String(i++));li.classList.add("kw");}
    l.classList.remove("kaskada");void l.offsetWidth;l.classList.add("kaskada");
    clearTimeout(l._kaskT);l._kaskT=setTimeout(()=>{l.classList.remove("kaskada");for(const li of l.querySelectorAll(":scope>.kw"))li.classList.remove("kw");},560);
  }
  // staging: kolumna z fokusem w pełnym kontraście, reszta 90 % przez 300 ms
  function przygas(ekran){
    if(!ekran||!S_RUCH())return;
    const a=document.activeElement,kol=[...ekran.querySelectorAll(":scope>.ekran-tresc>*")];
    const z=kol.find(k=>a&&k.contains(a));
    for(const k of kol)if(k!==z)slam(k,"przygas",300);
  }
  // owinięcie globalnego pokazLobby (deklaracja funkcji w klasycznym skrypcie = zapisywalna własność window, więc
  // przechodzą tędy też wywołania z zabi-chor.js: Esc, pad, „Wstecz”, dwuklik, wybierzIGraj, ZC.lobby)
  function owinPokazLobby(){
    const orig=window.pokazLobby;
    if(typeof orig!=="function"||orig.__kurtka)return;
    const owiniete=function(nazwa){
      const teraz=typeof S!=="undefined"?S.lobbyEkran:null;
      const mozna=S_RUCH()&&typeof S!=="undefined"&&S.ekran==="lobby"&&!lobby.hidden&&RANGA[nazwa]!=null&&nazwa!==teraz&&RANGA[teraz]!=null;
      if(R.trwa){if(nazwa!==teraz)R.oczekuje=nazwa;return;}   // drugie wywołanie w trakcie: tylko ostatnie, po bieżącym
      if(!mozna)return orig.apply(this,arguments);
      przejscie(orig,nazwa,teraz);
    };
    owiniete.__kurtka=true;
    try{window.pokazLobby=owiniete;}catch(e){}
  }
  // pomiar: performance.measure wokół orig(nazwa) i od kliknięcia do zdjęcia zasłony; LobbyScena.pomiar()
  const POMIARY=[];
  function zapiszPomiar(co,nazwa,od){
    const ms=performance.now()-od;POMIARY.push({co,nazwa,ms:+ms.toFixed(1),t:+od.toFixed(0)});if(POMIARY.length>200)POMIARY.shift();
    try{performance.measure("kurtka:"+co+":"+nazwa,{start:od,end:od+ms});}catch(e){}
  }
  async function przejscie(orig,nazwa,teraz){
    R.trwa=true;
    const przod=RANGA[nazwa]>=RANGA[teraz],kier=przod?1:-1;
    const stary=el(teraz),z=zaslona(),a=document.activeElement,t0=performance.now();
    // harmonogram liczony od kliknięcia (zegar, nie koniec animacji): klatki potrafią się spóźnić, pozy nie
    const doChwili=ms=>czekaj(Math.max(0,ms-(performance.now()-t0)));
    try{
      // poza 1, wyjście (anticipation): ekran cofa się, wciśnięty przycisk zapada się o 2 px
      const cof=stary?stary.animate([{scale:"1"},{scale:".985"}],{duration:CZAS.antycypacja,easing:EWYJ,fill:"forwards"}):null;
      const zap=a&&a!==document.body&&a.tagName==="BUTTON"?a.animate([{translate:"0 0"},{translate:"0 2px"}],{duration:70,easing:EWYJ,fill:"forwards"}):null;
      const T1=CZAS.antycypacja-CZAS.zakladka;await doChwili(T1);
      // poza 2, zasłona: wjeżdża (do przodu z lewej, wstecz z prawej), nazwa ekranu wbita po łuku z przerysowaniem
      R.napis.textContent=tl(NAZWA_EKRANU[nazwa]);z.classList.add("w-ruchu");R.blokada=true;
      const wjazd=z.animate([{transform:"translateX("+(-kier*135)+"vw)"},{transform:"translateX(0)"}],{duration:CZAS.zaslonaWjazd,easing:EWEJ,fill:"forwards"});
      R.napis.animate([{transform:"translate("+(-kier*60)+"px,40px) rotate(-4deg) scale(1.6)",opacity:0},
        {transform:"translate("+(kier*4)+"px,-4px) rotate(-1deg) scale(.97)",opacity:1,offset:.72},
        {transform:"translate(0,0) rotate(-1deg) scale(1)",opacity:1}],{duration:CZAS.zaslonaWjazd+CZAS.stop,easing:EPOP,fill:"forwards"});
      // ekran zmienia się pod zasłoną już przy 75 % wjazdu (przy tej krzywej zasłona kryje wtedy całe okno): ciężkie
      // rysowanie nowego ekranu zbiega się z dojazdem zasłony (animacja transform jedzie na kompozytorze)
      // przy połowie wjazdu docelowy ekran liczy styl i układ (krycie 0,001, jak w rozgrzewce), żeby orig(nazwa)
      // i jego fokus nie wymuszały pełnego układu świeżo odkrytego ekranu w jednym zadaniu
      await doChwili(T1+CZAS.zaslonaWjazd*.4);
      const cel=el(nazwa);if(cel&&cel.hidden&&nazwa!=="menu"){cel.inert=true;cel.classList.add("rozgrzewka");}
      await doChwili(T1+CZAS.zaslonaWjazd*.75);
      if(cel){cel.classList.remove("rozgrzewka");cel.inert=false;}
      if(cof)cof.cancel();if(zap)zap.cancel();
      // Rozgrywka: pokazLobby i tak zdejmuje fokus (klawisze należą do graczy); blur PRZED orig, bo w środku orig
      // wymusza pełny styl i układ świeżo odkrytego ekranu (pomiar: ~8 ms z ~17 ms orig)
      if(nazwa==="konfiguracja"){const f=document.activeElement;if(f&&f!==document.body&&f.blur)f.blur();}
      R.wPrzejsciu=true;
      const tO=performance.now();try{orig(nazwa);}finally{R.wPrzejsciu=false;R.czasOrig=performance.now()-tO;zapiszPomiar("orig",nazwa,tO);}
      await doChwili(T1+CZAS.zaslonaWjazd+CZAS.stop);
      R.blokada=false;
      // poza 3, wejście: zasłona zjeżdża dalej, a pod nią kaskada nowego ekranu
      const nowy=el(typeof S!=="undefined"?S.lobbyEkran:nazwa);
      wejscieEkranu(nowy);przygas(nowy);
      const wyjazd=z.animate([{transform:"translateX(0)"},{transform:"translateX("+(kier*135)+"vw)"}],{duration:CZAS.zaslonaWyjazd,easing:EWYJ,fill:"forwards"});
      await doChwili(T1+CZAS.zaslonaWjazd+CZAS.stop+CZAS.zaslonaWyjazd);
    }catch(e){if(typeof S!=="undefined"&&S.lobbyEkran!==nazwa)try{orig(nazwa);}catch(e2){}}
    finally{
      z.classList.remove("w-ruchu");for(const an of z.getAnimations())an.cancel();zapiszPomiar("zaslona",nazwa,t0);
      R.blokada=false;R.trwa=false;
      if(G.poZaslonie){G.poZaslonie=false;requestAnimationFrame(()=>poGraczach([]));}
      const dalej=R.oczekuje;R.oczekuje=null;
      if(dalej&&typeof S!=="undefined"&&dalej!==S.lobbyEkran)window.pokazLobby(dalej);
    }
  }
  // podczas zasłony strzałki, Enter i Esc nic nie robią (najwyżej czas wjazdu i stopu, 220 ms)
  function blokadaKlawiszy(e){
    if(!R.blokada)return;
    if(/^(Arrow(Up|Down|Left|Right)|Enter|NumpadEnter|Escape)$/.test(e.key)){e.preventDefault();e.stopPropagation();}
  }
  // gracze (Rozgrywka): nowy wpada po łuku, usunięty unosi się i znika, sąsiedzi dosuwają się (FLIP),
  // zmiana gotowości obraca metkę; pomiar prostokątów raz na przebudowę siatki (rysujGraczy)
  const G={rect:new Map(),gotowy:new Map(),pierwszy:true};
  function poGraczach(ms){
    const siatka=el("siatkaGraczy");if(!siatka)return;
    // w trakcie zasłony bez pomiarów (getBoundingClientRect wymusza układ ekranu pod zasłoną); pomiar po zejściu
    if(R.trwa){G.pierwszy=true;G.poZaslonie=true;return;}
    const widac=!!siatka.getClientRects().length&&lobby.dataset.ekran==="konfiguracja";
    const karty=[...siatka.querySelectorAll(":scope>.gracz[data-id]")];
    const nowe=new Map(karty.map(k=>[k.dataset.id,k.getBoundingClientRect()]));
    if(widac&&S_RUCH()&&!G.pierwszy){   // pierwszy pomiar po wejściu na ekran tylko mierzy
      for(const k of karty){
        const id=k.dataset.id,stara=G.rect.get(id),r=nowe.get(id);
        if(!stara){k.classList.add("wpada");setTimeout(()=>k.classList.remove("wpada"),300);continue;}
        const dx=stara.left-r.left,dy=stara.top-r.top;
        if(Math.abs(dx)+Math.abs(dy)>1)k.animate([{translate:dx+"px "+dy+"px"},{translate:"0 0"}],{duration:200,easing:EWEJ});
        const got=k.classList.contains("gotowy");
        if(G.gotowy.has(id)&&G.gotowy.get(id)!==got){const m=k.querySelector(".gracz-gotowy");if(m)slam(m,"flip",260);}
      }
      // usunięci: ten sam węzeł wraca na chwilę jako duch w starym miejscu, unosi się i znika (160 ms)
      const kol=siatka.parentElement,kr=kol.getBoundingClientRect();
      for(const m of ms)for(const n of m.removedNodes){
        if(!n.classList||!n.classList.contains("gracz")||nowe.has(n.dataset.id))continue;
        const r=G.rect.get(n.dataset.id);if(!r)continue;
        n.classList.add("duch");n.style.left=(r.left-kr.left)+"px";n.style.top=(r.top-kr.top)+"px";n.style.width=r.width+"px";n.style.height=r.height+"px";
        kol.append(n);n.animate([{translate:"0 0",opacity:1},{translate:"0 -16px",opacity:0}],{duration:160,easing:EWYJ,fill:"forwards"}).finished.then(()=>n.remove(),()=>n.remove());
      }
    }
    G.rect=widac?nowe:new Map();if(widac)G.pierwszy=false;
    G.gotowy=new Map(karty.map(k=>[k.dataset.id,k.classList.contains("gotowy")]));
  }
  // „Śpiewamy!”: zapadnięcie 120 ms przed startem gry (Glos.odblokuj zostaje w geście kliknięcia)
  function owinStart(){
    const b=el("btnStart");if(!b||typeof b.onclick!=="function"||b.onclick.__kurtka)return;
    const o=b.onclick;
    const f=function(e){
      if(!S_RUCH()||b.disabled)return o.call(this,e);
      try{if(typeof Glos!=="undefined"&&Glos.odblokuj)Glos.odblokuj();}catch(x){}
      b.classList.add("zapada");
      setTimeout(()=>{b.classList.remove("zapada");o.call(b,e);},120);
    };
    f.__kurtka=true;b.onclick=f;
  }
  function startRuch(){
    zaslona();owinPokazLobby();owinStart();
    document.addEventListener("keydown",blokadaKlawiszy,true);
    const s=el("siatkaGraczy");if(s)new MutationObserver(poGraczach).observe(s,{childList:true});
    poGraczach([]);
  }

  // ===== RUNDA 3: rozgrzewka po starcie, pierwsze przejście bez zacięcia =====
  // Pomiar PRZED (skrypt poza repozytorium): pierwsze menu → Zagraj miało klatkę 180–200 ms, a orig(nazwa)
  // 60–93 ms; z tego ~52 ms to rysujRolke × 27 (Biblioteka.osadz przerysowuje miniatury WSZYSTKICH kart przy każdym
  // osadzeniu, także gdy nic się nie zmieniło), reszta to pierwszy styl/układ ekranu i raster zasłony. Środki:
  //  · pamięć rolek: owinięta globalna rysujRolke (jak pokazLobby wyżej; biblioteka.js nietknięta) nie rysuje
  //    ponownie miniatury, której dane, ekran i rozmiar okna się nie zmieniły, a w trakcie orig(nazwa) i rozgrzewki
  //    odkłada rysowanie i dorabia je partiami po 4 na klatkę (pod zasłoną); wiersze niewidoczne (ukryte szukajką)
  //    czekają, aż się pokażą,
  //  · zasłona żyje od startu jako stała warstwa poza ekranem; w rozgrzewce raz rasteryzuje się w docelowym miejscu
  //    z każdą nazwą ekranu (krycie 0,001, niewidoczne), fonty Titan One i Baloo 2 doczytane z góry,
  //  · rozgrzewka ekranów w bezczynności: #wybor i #konfiguracja po 2 klatki z klasą .rozgrzewka (CSS
  //    pokazuje je mimo [hidden] z kryciem 0, inert = bez fokusu), BEZ zmiany S.lobbyEkran, data-ekran i atrybutu
  //    hidden; biblioteka zostaje w gnieździe kroku 1, miniatury narysowane, statystyki gotowe,
  //  · tło kurtki (#lobby::before) istnieje od startu z kryciem 0 pod menu (gry.css).
  // Pomiar PO i tabela: raport rundy 3.
  const RG={pamiec:true,odlozone:new Set(),petla:0,trwa:false,zrobiona:false,uzytkownik:false,wymus:false};
  const kluczRolki=cv=>{const e=cv.closest(".lobby-ekran");return (e?e.id:"")+"|"+innerWidth+"x"+innerHeight+"|"+(window.devicePixelRatio||1);};
  function owinRolki(){
    const orig=window.rysujRolke;
    if(typeof orig!=="function"||orig.__kurtka)return;
    const f=function(cv,w,o){
      // podgląd z głowicą, szuflada (duża rolka) i inne płótna: zawsze od razu, a pamięć karty kasujemy
      if(o||!cv||!w||!cv.classList||!cv.classList.contains("bkarta-rolka")||!RG.pamiec){if(cv)cv.__rk=null;return orig.apply(this,arguments);}
      const li=cv.closest(".bkarta"),k=kluczRolki(cv),c=cv.__rk;
      if(!RG.wymus&&c&&c.w===w&&c.pelna===w.pelna&&c.par===w.par&&c.k===k)return null;   // nic się nie zmieniło
      if(R.wPrzejsciu||RG.trwa||(li&&li.hidden)||cv.closest("[hidden]:not(.rozgrzewka)")){
        cv.__rkW=w;RG.odlozone.add(cv);planujRolki();return null;
      }
      RG.odlozone.delete(cv);
      const wynik=orig.apply(this,arguments);cv.__rk={w,pelna:w.pelna,par:w.par,k};return wynik;
    };
    f.__kurtka=true;f.__orig=orig;
    try{window.rysujRolke=f;}catch(e){}
  }
  // podgląd partii (ppRysuj, 5–15 ms) rysowany w orig(nazwa) przy każdym osadzeniu biblioteki: w trakcie orig odkładany
  // na następną klatkę pod zasłoną (raz, zbiorczo); niewidoczny podgląd czeka, aż ekran z nim się pokaże
  function owinPodglad(){
    const orig=window.ppRysuj;
    if(typeof orig!=="function"||orig.__kurtka)return;
    let czeka=false;
    const f=function(){
      if(!R.wPrzejsciu)return orig.apply(this,arguments);
      if(czeka)return;czeka=true;
      let klatki=0;   // dwie klatki po orig: osobno od pierwszego układu nowego ekranu
      requestAnimationFrame(function kolejna(){
        if(R.wPrzejsciu||++klatki<3){requestAnimationFrame(kolejna);return;}
        czeka=false;const pp=el("podgladPartii");if(pp&&pp.closest("[hidden]:not(.rozgrzewka)"))return;
        try{window.ppRysuj();}catch(e){}
      });
    };
    f.__kurtka=true;f.__orig=orig;
    try{window.ppRysuj=f;}catch(e){}
  }
  // odłożone miniatury: po 4 na klatkę, tylko widoczne (reszta czeka na pokazanie: zmiana ekranu woła znowu)
  function planujRolki(){if(!RG.petla)RG.petla=requestAnimationFrame(dorysujOdlozone);}
  function dorysujOdlozone(){
    RG.petla=0;if(R.wPrzejsciu||RG.trwa){planujRolki();return;}
    let n=0;
    for(const cv of [...RG.odlozone]){
      if(!cv.isConnected){RG.odlozone.delete(cv);continue;}
      const li=cv.closest(".bkarta");
      if((li&&li.hidden)||cv.closest("[hidden]:not(.rozgrzewka)"))continue;
      RG.odlozone.delete(cv);
      try{window.rysujRolke(cv,cv.__rkW);}catch(e){}
      if(++n>=4){planujRolki();return;}
    }
  }
  const klatka=()=>new Promise(r=>requestAnimationFrame(()=>r()));
  // rysuje do `ile` odłożonych miniatur leżących w ekranie e (widocznych w nim); zwraca, czy coś jeszcze czeka
  function rysujWidoczne(e,ile){
    const byl=RG.trwa;RG.trwa=false;let n=0,zostalo=false;
    try{
      for(const cv of [...RG.odlozone]){
        if(!cv.isConnected){RG.odlozone.delete(cv);continue;}
        if(!e.contains(cv))continue;
        const li=cv.closest(".bkarta");
        if((li&&li.hidden)||cv.closest(".biblio-lista[hidden],.biblio-panel[hidden]"))continue;
        if(n>=ile){zostalo=true;break;}
        RG.odlozone.delete(cv);n++;try{window.rysujRolke(cv,cv.__rkW);}catch(x){}
      }
    }finally{RG.trwa=byl;}
    return zostalo;
  }
  const zniechcony=()=>RG.uzytkownik||R.trwa||(typeof S!=="undefined"&&(S.ekran!=="lobby"||S.lobbyEkran!=="menu"));
  async function rozgrzewka(){
    if(RG.zrobiona||RG.trwa)return;
    if(zniechcony()){RG.zrobiona=true;return;}   // użytkownik już działa: nic nie rozgrzewamy
    RG.trwa="rozgrzewka";const a=document.activeElement;const t0=performance.now();
    const ekrany=["wybor","konfiguracja"].map(el).filter(Boolean);
    try{
      // fonty bandy, napisu zasłony i kart
      try{if(document.fonts&&document.fonts.load)await Promise.all(['400 120px "Titan One"','400 40px "Titan One"','800 15px "Baloo 2"','700 13px "Nunito"']
        .map(f=>document.fonts.load(f,"PIOSENKAROZGRYWKAUTWORYMENUąęłńśżź")));}catch(e){}
      // zasłona: raster w docelowym miejscu z każdą nazwą ekranu (po jednej klatce), potem z powrotem poza ekran
      // menu jako osobna warstwa (jak w antycypacji przejścia: scale) raz przed pierwszym kliknięciem; tożsamościowa
      // animacja, nic się nie rusza, a pierwszy raster warstwy menu i programy GPU powstają teraz, nie pod kliknięciem
      const menu=el("menu");const am=menu&&S_RUCH()?menu.animate([{scale:"1"},{scale:"1"}],{duration:120}):null;
      const z=zaslona();z.classList.add("rozgrzewka");
      for(const n of Object.keys(NAZWA_EKRANU)){if(zniechcony())break;R.napis.textContent=tl(NAZWA_EKRANU[n]);await klatka();}
      z.classList.remove("rozgrzewka");if(am)am.cancel();
      // ekrany: po 2 klatki, kolejno; biblioteka zostaje w gnieździe kroku 1 (pokazLobby i tak ją przenosi)
      for(const e of ekrany){
        if(zniechcony())break;
        e.inert=true;e.classList.add("rozgrzewka");RG.trwa=e.id;
        if(typeof Biblioteka!=="undefined"&&Biblioteka.osadz){
          const g=n=>e.querySelector('[data-gniazdo="'+n+'"]');
          if(g("biblioteka")||g("podglad"))Biblioteka.osadz(g("biblioteka"),g("podglad"));
        }
        if(e.id==="wybor"){ostatniStanPaczek="";paskiDodaj();poZmianieBiblioteki();statystyki();tytulWybranej();}
        await klatka();
        for(let i=0;i<14&&!zniechcony();i++){if(!rysujWidoczne(e,4))break;await klatka();}   // po 4 miniatury na klatkę
        await klatka();
        e.classList.remove("rozgrzewka");e.inert=false;
      }
    }finally{
      for(const e of ekrany){e.classList.remove("rozgrzewka");e.inert=false;}
      if(R.zaslona)R.zaslona.classList.remove("rozgrzewka");
      RG.trwa=false;RG.zrobiona=true;planujRolki();
      if(a&&a.isConnected&&a!==document.body&&(!document.activeElement||document.activeElement===document.body))a.focus({preventScroll:true});   // tylko zgubiony fokus (inert); nie odbieramy go oknu, które otworzyło się w trakcie (A-01)
      RG.czas=Math.round(performance.now()-t0);
    }
  }
  function planujRozgrzewke(){
    // pierwszy gest użytkownika przed rozgrzewką = bez rozgrzewki (nie dokładamy pracy pod jego kliknięcie)
    const gest=()=>{RG.uzytkownik=true;};
    document.addEventListener("pointerdown",gest,{capture:true,once:true});
    document.addEventListener("keydown",gest,{capture:true,once:true});
    const ric=window.requestIdleCallback||(f=>setTimeout(f,120));
    ric(()=>{document.removeEventListener("pointerdown",gest,true);document.removeEventListener("keydown",gest,true);rozgrzewka();},{timeout:1500});
  }

  // ===== RUNDA 4: menu „Kickflip” (kompozycja w gry.css, sekcja menu; tu tylko zachowanie) =====
  //  · paralaksa: wskaźnik nad menu ustawia JEDNĄ parę zmiennych --px/--py (−1…1) na .menu-tlo (raz na klatkę),
  //    warstwy wycinanek przesuwają się o 4 i 14 px; pad: Wejscie nie wystawia gałki publicznie, więc tylko wskaźnik,
  //  · podskok naklejki przy „Zagraj” (anticipation przed zasłoną z §10),
  //  · .po-wejsciu: po pierwszym wyjściu z menu kolejne powroty mają krótkie wejście (300 ms) bez ponownego nalepiania,
  //  · .statyczne: grafika „wydajność” = bez dryfu, kołysania i paralaksy (jak ograniczony ruch),
  //  · taśma stanu miga RAZ, gdy dochodzi nowy czekający kapsel.
  const MN={px:0,py:0,klatka:0,kapsli:0};
  function startMenu(){
    const menu=el("menu"),tlo=menu&&menu.querySelector(".menu-tlo");if(!menu)return;
    const statyczne=()=>!S_RUCH()||(typeof S!=="undefined"&&S.ust&&S.ust.grafika==="wydajnosc");
    if(tlo)menu.addEventListener("pointermove",e=>{
      if(statyczne()||lobby.dataset.ekran!=="menu")return;
      MN.px=Math.max(-1,Math.min(1,(e.clientX/innerWidth)*2-1));MN.py=Math.max(-1,Math.min(1,(e.clientY/innerHeight)*2-1));
      if(!MN.klatka)MN.klatka=requestAnimationFrame(()=>{MN.klatka=0;tlo.style.setProperty("--px",MN.px.toFixed(3));tlo.style.setProperty("--py",MN.py.toFixed(3));});
    },{passive:true});
    const zagraj=el("btnZagraj"),nakl=el("naklejka");
    if(zagraj&&nakl)zagraj.addEventListener("click",()=>{if(!statyczne())slam(nakl,"podskok",320);},true);
    const odswiez=()=>{
      menu.classList.toggle("statyczne",statyczne());
      if(lobby.dataset.ekran!=="menu")menu.classList.add("po-wejsciu");   // menu jest wtedy ukryte: bez powtórki wejścia
    };
    new MutationObserver(odswiez).observe(lobby,{attributes:true,attributeFilter:["data-ekran"]});odswiez();
    const czek=el("czekajace"),dol=menu.querySelector(".menu-dol");
    if(czek&&dol)new MutationObserver(()=>{
      const n=czek.querySelectorAll(".czekajacy").length;
      if(n>MN.kapsli&&lobby.dataset.ekran==="menu")slam(dol,"mig",520);
      MN.kapsli=n;
    }).observe(czek,{childList:true});
  }

  // ===== RUNDA 5: podsłuch, stacja odsłuchu w kroku 1, scoreboard, decyzje §16 =====
  //  · PODSŁUCH: jeden odtwarzacz (Biblioteka.podsluch w biblioteka.js); tu pasek UI (▶ Posłuchaj / ■ Stop,
  //    „Odtwarzaj automatycznie”, „Od początku | Od środka”, taśma postępu i czas), automat po 350 ms spokoju
  //    po zmianie wyboru i po wejściu na ekran listy, stop przy zmianie wyboru na inny utwór, przy wyjściu z ekranów
  //    listy i przy ukryciu wybranej karty przez szukajkę; Spacja = Posłuchaj/Stop na ekranach listy,
  //  · krok 1: pasek siedzi w szufladzie pod kartą środkową (gniazdo podglądu w index.html, wygląd w gry.css),
  //    scoreboard = #wybranaTop z rysujWybrana (3 wiersze) dosypany do 6 z Tablica.top(p,6), metka „bot: …”,
  //  · §16.4: klik albo pad A w kartę środkową, która już jest wybrana = Dalej,
  //  · §16.2: taśma stanu w menu tylko wtedy, gdy czeka kapsel albo kapsle są połączone.
  const PS={t:0,bar:null,el:{},czeka:false};
  // Błąd: po kliknięciu autoplay wybrany utwór leciał dwa razy z przesunięciem, bo data-ekran lobby zostaje „wybor”
  // także w trakcie piosenki, więc odsłuch zaplanowany przy zmianie piosenki (planujAuto, 350 ms) ruszał już w grze.
  // Lista jest „na wierzchu” tylko na ekranie lobby gry (S.ekran).
  const naLiscie=()=>!!lobby&&lobby.dataset.ekran==="wybor"&&(typeof S==="undefined"||S.ekran==="lobby");
  const PD=()=>typeof Biblioteka!=="undefined"&&Biblioteka.podsluch?Biblioteka.podsluch:null;
  const aktualna=()=>{try{return typeof piosenka==="function"?piosenka():null;}catch(e){return null;}};
  const fmtSek=s=>{s=Math.max(0,Math.round(s||0));return Math.floor(s/60)+":"+String(s%60).padStart(2,"0");};
  const dzwiekGotowy=()=>{try{return typeof Glos!=="undefined"&&Glos.gotowy&&Glos.gotowy();}catch(e){return false;}};
  // §18: JEDEN panel odsłuchu. W kroku 1 jedynym przyciskiem odtwarzania jest „Posłuchaj” panelu podglądu partii
  // (.pp-graj); tu tylko ustawienia wspólne dla obu ekranów: Auto i Od początku | Od środka (w kroku 1 dopięte do
  // rzędu sterowania panelu, w Utworach w nagłówku biblioteki, gdzie ▶ wiersza jest jedynym odtwarzaniem).
  function zbudujPasek(){
    const p=document.createElement("div");p.className="podsluch";p.setAttribute("role","group");
    p.setAttribute("aria-label",tl(TL.psGrupa));
    p.innerHTML='<button class="ps-auto" type="button" role="switch"><span class="ps-kolyska" aria-hidden="true"></span><span class="ps-auto-et"></span></button>'+
      '<span class="ps-od" role="radiogroup"><button type="button" role="radio" data-od="poczatek"></button><button type="button" role="radio" data-od="srodek"></button></span>'+
      '<span class="ps-tempo" hidden></span><span class="ps-podpowiedz" hidden></span>';
    const q=s=>p.querySelector(s);
    PS.el={tempo:q(".ps-tempo"),auto:q(".ps-auto"),od:[...p.querySelectorAll(".ps-od button")],pod:q(".ps-podpowiedz")};
    q(".ps-auto-et").textContent=tl(TL.psAuto);PS.el.auto.title=tl(TL.psAutoOpis);PS.el.auto.setAttribute("aria-label",tl(TL.psAutoOpis));
    PS.el.od[0].textContent=tl(TL.psOdPoczatku);PS.el.od[1].textContent=tl(TL.psOdSrodka);
    q(".ps-od").setAttribute("aria-label",tl(TL.psSkad));
    PS.el.pod.textContent=tl(TL.psKliknij);
    PS.el.auto.addEventListener("click",()=>{const d=PD();if(!d)return;const u=d.ustaw({auto:!d.ustawienia().auto});
      if(u.auto)planujAuto(0);else clearTimeout(PS.t);rysujPasek();});
    for(const b of PS.el.od)b.addEventListener("click",()=>{const d=PD();if(!d)return;d.ustaw({od:b.dataset.od});
      if(lobby.dataset.ekran==="wybor")ustawGlowice(true);   // głowica panelu na nowe miejsce startu (gra: restart stamtąd)
      else{const s=d.stan(),a=aktualna();if(s.gra&&/^p:/.test(s.klucz||"")&&a)d.graj(s.id,{od:b.dataset.od});}
      rysujPasek();});
    PS.bar=p;return p;
  }
  function rysujPasek(){
    const d=PD(),E=PS.el;if(!d||!PS.bar)return;
    const u=d.ustawienia();
    E.auto.setAttribute("aria-checked",String(u.auto));
    for(const b of E.od)b.setAttribute("aria-checked",String(b.dataset.od===u.od));
    E.pod.hidden=!(PS.czeka&&!dzwiekGotowy());
    // runda 6: podsłuch gra w tempie z ustawień; ≠ 100 % = metka „tempo 150 %” (jedyne miejsce w kroku 1)
    const tp=typeof S!=="undefined"&&S.ust?Math.round(+S.ust.tempo||100):100;
    E.tempo.hidden=tp===100;if(tp!==100)E.tempo.textContent=typeof tt==="function"?tt("tempoMetka",{n:tp}):"tempo "+tp+"%";
  }
  const ppStan=()=>{try{return Biblioteka.podgladPartii();}catch(e){return null;}};
  // krok 1: głowica panelu odsłuchu = miejsce startu (od początku albo od środka); przy nowej piosence zawsze,
  // przy zmianie ustawienia na żądanie (force); ręcznie klikniętego taktu w tej samej piosence nie ruszamy
  function ustawGlowice(force){
    const a=aktualna(),d=PD();if(!a||!d||typeof Biblioteka==="undefined"||!Biblioteka.ppSkocz)return;
    if(!force&&PS.glowicaDla===a.id)return;
    try{if(Biblioteka._B&&Biblioteka._B.pp&&Biblioteka._B.pp.piosenka!==a.id&&typeof window.ppRysuj==="function")window.ppRysuj();}catch(e){}
    const od=d.od(a,d.ustawienia().od),m=a.metrum||4;
    try{Biblioteka.ppSkocz(Math.round(od/m)+1);}catch(e){}
    PS.glowicaDla=a.id;
  }
  // §21: żaden dźwięk podsłuchu bez widocznej karty (albo panelu), do której należy
  const widocznyEl=e=>!!e&&e.isConnected&&!e.hidden&&e.getClientRects().length>0;
  function sprzataj(){
    if(!lobby||R.wPrzejsciu||R.trwa)return;
    const d=PD();if(!d)return;const s=d.stan();if(!s.gra||!s.id)return;
    let ok;
    if(/^pp:/.test(s.klucz))ok=widocznyEl(el("podgladPartii"));
    else if(/^o:/.test(s.klucz))ok=!!document.querySelector("#szuflada:not([hidden])");
    else{const BB=Biblioteka._B,li=BB&&BB.karty&&BB.karty.get(s.id);ok=widocznyEl(li);}
    if(!ok)d.stop();
  }
  let tSprzataj=0;const planujSprzatanie=()=>{if(!tSprzataj)tSprzataj=requestAnimationFrame(()=>{tSprzataj=0;sprzataj();});};
  function przelaczPodsluch(){
    const d=PD();if(!d)return;
    if(d.stan().gra){d.stop();return;}
    ustawGlowice(false);if(Biblioteka.ppPrzelacz)Biblioteka.ppPrzelacz();
  }
  // automat: 350 ms spokoju po zmianie wyboru (przeskakiwanie po liście nie strzela dźwiękiem co wiersz)
  function planujAuto(ms){
    clearTimeout(PS.t);PS.czeka=false;
    const d=PD();if(!d||!naLiscie()||!d.ustawienia().auto)return;
    PS.t=setTimeout(function sprobuj(){
      if(!naLiscie())return;
      if(R.trwa){PS.t=setTimeout(sprobuj,100);return;}
      const a=aktualna(),s=d.stan();if(!a)return;
      if(s.gra)return;   // coś już gra (użytkownik sam uruchomił): nie przerywamy
      // §21: bez widocznego panelu podglądu (rozwinięty pasek „Dodaj utwory”, okno nad ekranem) automat milczy
      if(!widocznyEl(el("podgladPartii")))return;
      if(!dzwiekGotowy()){PS.czeka=true;rysujPasek();return;}   // przeglądarka czeka na gest: podpowiedź zamiast dźwięku
      ustawGlowice(false);if(Biblioteka.ppPrzelacz&&!(ppStan()||{}).gra)Biblioteka.ppPrzelacz();
    },ms==null?350:ms);
  }
  // zmiana wybranej piosenki: inny utwór gra → cisza od razu; potem automat
  function poWyborzePiosenki(){
    const d=PD(),a=aktualna();if(!d)return;
    const s=d.stan();
    if(s.gra&&s.id&&a&&s.id!==a.id)d.stop();
    if(lobby&&lobby.dataset.ekran==="wybor"&&!R.wPrzejsciu)ustawGlowice(false);
    if(naLiscie())planujAuto();
  }
  function owinWybor(){
    const o=window.wybierzPiosenke;
    if(typeof o!=="function"||o.__kurtka)return;
    const f=function(){const r=o.apply(this,arguments);try{poWyborzePiosenki();}catch(e){}return r;};
    f.__kurtka=true;try{window.wybierzPiosenke=f;}catch(e){}
  }
  // „Auto” i „Od początku | Od środka” stoją w rzędzie sterowania panelu podglądu (krok 1)
  function osadzPasek(){
    if(!PS.bar)return;
    const cel=document.querySelector("#wybor #podgladPartii .pp-dol");
    if(cel&&PS.bar.parentNode!==cel)cel.append(PS.bar);
  }
  function poEkraniePodsluch(){
    const d=PD();
    if(!naLiscie()){clearTimeout(PS.t);if(d&&d.stan().gra)d.stop();return;}
    osadzPasek();rysujPasek();
    // głowica panelu na miejsce startu po zejściu zasłony (ppRysuj w trakcie przejścia jest odkładany)
    if(lobby.dataset.ekran==="wybor")requestAnimationFrame(function po(){if(lobby.dataset.ekran!=="wybor")return;
      if(R.trwa||R.wPrzejsciu){setTimeout(po,60);return;}ustawGlowice(false);});
    planujAuto();
  }
  // Spacja = Posłuchaj/Stop na ekranach listy (poza polami tekstowymi i oknami nad lobby); keyup też, żeby
  // fokus na przycisku nie „kliknął” go Spacją
  function spacja(e){
    if(e.code!=="Space"||e.ctrlKey||e.altKey||e.metaKey||!naLiscie()||R.blokada)return;
    if(typeof S!=="undefined"&&S.ekran!=="lobby")return;
    const a=document.activeElement;
    if(a&&(a.tagName==="INPUT"||a.tagName==="TEXTAREA"||a.tagName==="SELECT"||a.isContentEditable))return;
    if(["tablica","okno","wyborGracza"].some(i=>{const x=el(i);return x&&!x.hidden;}))return;
    e.preventDefault();e.stopPropagation();
    if(e.type==="keydown"&&!e.repeat){try{if(typeof Glos!=="undefined")Glos.odblokuj();}catch(x){}przelaczPodsluch();}
  }
  // §16.4: klik (także pad A i Enter przez a.click()) w wiersz, który JUŻ jest wybrany = Dalej. Pierwsze
  // kliknięcie wybiera i pokazuje podgląd, drugie przechodzi do Rozgrywki — dwa kroki jednym palcem.
  function klikWybranej(e){
    if(e.defaultPrevented||!lobby||lobby.dataset.ekran!=="wybor"||e.detail>1)return;
    const b=e.target&&e.target.closest?e.target.closest(".bkarta-wybor"):null;if(!b)return;
    const li=b.closest(".bkarta");if(!li||!li.classList.contains("wybrana"))return;
    // myszą liczy się stan z chwili wciśnięcia: fokus przy wciśnięciu sam wybiera wiersz (poFokusie), a to nie Dalej
    if(e.detail>0&&PS.wcisnietyWybrany!==li)return;
    setTimeout(()=>{const d=el("btnDalej");if(d&&lobby.dataset.ekran==="wybor"&&!R.trwa)d.click();},0);
  }
  // scoreboard: rysujWybrana wypisuje 3 najlepszych; dosypujemy do 6 z tych samych danych (Tablica.top), pusty stan
  // dostaje trzy puste wiersze-ściegi
  function dosypTablice(){
    const ol=el("wybranaTop"),a=aktualna();if(!ol||!a||typeof Tablica==="undefined"||!Tablica.top)return;
    if(ol.querySelector(".wybrana-top-pusto")){
      if(!ol.querySelector(".wybrana-top-szew"))for(let i=0;i<3;i++){const li=document.createElement("li");li.className="wybrana-top-szew";li.setAttribute("aria-hidden","true");ol.append(li);}
      return;
    }
    const juz=ol.querySelectorAll(".wybrana-top-wiersz").length;if(juz>=6)return;
    const top=Tablica.top(a,6);if(top.length<=juz)return;
    for(const w of top.slice(juz)){
      const li=document.createElement("li");li.className="wybrana-top-wiersz";li.style.setProperty("--kolor",w.kolor||"#6cb33f");
      const m=document.createElement("b");m.className="wybrana-top-miejsce";m.textContent=String(w.miejsce);
      const k=span("wybrana-top-kto",w.kto);
      const pk=typeof fmtLiczba==="function"?fmtLiczba(w.punkty):String(w.punkty);
      const wy=span("wybrana-top-wynik",typeof tt==="function"?tt("topWiersz",{punkty:pk,precyzja:Math.round(w.precyzja)}):pk+" · "+Math.round(w.precyzja)+"%");
      li.append(m,k,wy);ol.append(li);
    }
  }
  // §16.2: taśma stanu w menu tylko, gdy coś się dzieje (czeka kapsel albo trwa łączność z kapslami)
  function tasmaMenu(){
    const dol=document.querySelector("#menu .menu-dol");if(!dol)return;
    const cz=el("czekajace"),zy=el("zywiStan");
    const cos=(cz&&!cz.hidden)||(zy&&!zy.hidden);
    dol.classList.toggle("pusta",!cos);
  }
  // 10-20: „Ustawienia piosenki” to wysuwana szuflada (⚙ na wierszu albo w karcie wybranej piosenki); prawa
  // kolumna pokazuje za to tablicę wyników bez przełączania. Zmiany w szufladzie (tempo, fragment, ścieżki)
  // przeliczają paski statystyk.
  function poUstawieniach(){setTimeout(statystyki,0);}
  function startUstawien(){
    const sz=el("szuflada");
    if(sz)for(const ev of ["change","pointerup","click"])sz.addEventListener(ev,poUstawieniach);
  }

  function startPodsluch(){
    zbudujPasek();owinWybor();
    addEventListener("rb-podsluch",()=>{if(PS.czeka&&dzwiekGotowy())PS.czeka=false;rysujPasek();});
    document.addEventListener("keydown",spacja,true);document.addEventListener("keyup",spacja,true);
    document.addEventListener("click",klikWybranej,true);
    // „Posłuchaj” panelu w kroku 1: nowa piosenka startuje od miejsca z ustawień (od początku / od środka)
    document.addEventListener("click",e=>{const b=e.target&&e.target.closest?e.target.closest("#wybor .pp-graj"):null;
      if(b&&!(ppStan()||{}).gra)ustawGlowice(false);},true);
    document.addEventListener("pointerdown",e=>{const li=e.target&&e.target.closest?e.target.closest(".bkarta"):null;
      PS.wcisnietyWybrany=li&&li.classList.contains("wybrana")?li:null;},true);
    // gest użytkownika budzi dźwięk: automat, który czekał, rusza
    document.addEventListener("pointerdown",()=>{if(PS.czeka)setTimeout(()=>{if(PS.czeka&&dzwiekGotowy())planujAuto(0);},60);},true);
    new MutationObserver(poEkraniePodsluch).observe(lobby,{attributes:true,attributeFilter:["data-ekran"]});
    const ol=el("wybranaTop");if(ol)new MutationObserver(dosypTablice).observe(ol,{childList:true});
    for(const i of ["czekajace","zywiStan"]){const x=el(i);if(x)new MutationObserver(tasmaMenu).observe(x,{attributes:true,attributeFilter:["hidden"]});}
    const pp=el("podgladPartii");
    if(pp)new MutationObserver(()=>{const a=aktualna(),s=ppStan();if(a&&s&&statystyki.partia!==a.id+":"+s.partia)statystyki();})
      .observe(pp,{subtree:true,attributes:true,attributeFilter:["aria-selected","aria-checked","class"]});
    document.addEventListener("click",()=>setTimeout(()=>{const a=aktualna(),s=ppStan();if(a&&s&&lobby.dataset.ekran==="wybor"&&statystyki.partia!==a.id+":"+s.partia)statystyki();},0));
    tasmaMenu();dosypTablice();poEkraniePodsluch();
  }

  // zmiany w bibliotece (nowe wiersze, zakładka, szukajka, ♥): kaskada wejścia wierszy, cisza po schowaniu
  // wiersza, który właśnie grał, i odświeżenie licznika „Twoja biblioteka · N utworów”
  function obserwujBiblioteke(){
    const bib=el("biblioteka");if(!bib)return;
    new MutationObserver(ms=>{
      const listy=listyBiblioteki();
      const wazna=m=>m.type==="childList"?(m.target===bib||listy.includes(m.target)):
        m.attributeName==="hidden"?(listy.includes(m.target)||m.target.classList.contains("biblio-panel")||m.target.classList.contains("bkarta")):
        m.target.classList.contains("bkarta-wybor");   // aria-pressed = wybrana piosenka (odswiezKarte)
      // szukajka: wiersze zwijają się i rozwijają po kolei (overlapping action, co 25 ms, najwyżej 12)
      {let n=0;
        for(const m of ms)if(m.attributeName==="hidden"&&m.target.classList.contains("bkarta"))m.target.style.setProperty("--szi",String(Math.min(n++,12)));}
      for(const m of ms)if(m.attributeName==="aria-pressed"&&m.target.classList.contains("bkarta-ulub")&&m.target.getAttribute("aria-pressed")==="true"&&
        m.oldValue!=="true")slam(m.target,"lubie",300);
      if(lobby.dataset.ekran==="wybor"&&ms.some(m=>(m.type==="childList"&&listy.includes(m.target)&&m.addedNodes.length)||
        (m.attributeName==="hidden"&&(listy.includes(m.target)||m.target.classList.contains("biblio-panel")))))kaskadaWierszy(el("wybor"));
      {const d=typeof Biblioteka!=="undefined"&&Biblioteka.podsluch,st=d&&d.stan();   // §15: wiersz schowany przez szukajkę = cisza
        if(st&&st.gra&&st.id&&/^p:/.test(st.klucz||"")&&ms.some(m=>m.attributeName==="hidden"&&m.target.hidden&&m.target.dataset&&m.target.dataset.id===st.id))d.stop();}
      if(ms.some(wazna))poZmianieBiblioteki();
      planujSprzatanie();
    }).observe(bib,{subtree:true,childList:true,attributes:true,attributeOldValue:true,attributeFilter:["hidden","aria-pressed"]});
  }

  function start(){
    lobby=el("lobby");if(!lobby)return;
    owinRolki();owinPodglad();
    startDodaj();startRuch();startMenu();
    przyszyjGwiazdy();
    new MutationObserver(poZmianieEkranu).observe(lobby,{attributes:true,attributeFilter:["data-ekran"]});
    lobby.addEventListener("focusin",poFokusie);
    const w=el("wybrana");
    if(w){let t=0;new MutationObserver(ms=>{   // własne wstawienie #wybranaStaty nie przebudowuje pasków
      if(ms.every(m=>[...m.addedNodes,...m.removedNodes].every(n=>n.id==="wybranaStaty")))return;
      tytulWybranej();clearTimeout(t);t=setTimeout(statystyki,0);}).observe(w,{childList:true});statystyki();tytulWybranej();}
    obserwujBiblioteke();obserwujStart();
    poZmianieEkranu();
    planujRozgrzewke();
    startUstawien();
    startPodsluch();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(start,0));
  else setTimeout(start,0);   // po ZC.init z końca index.html (ten skrypt stoi przed nim)
  return {statystyki,CZYNNIKI,zamknijDodaj,rozwinDodaj:on=>rozwinDodaj(on,false),
    dodaj:()=>({otwarty:DD.otwarty,stan:(el("dodajStan")||{}).textContent||""}),
    lista:()=>{const l=listaFiltra();const k=l?kartyListy(l).filter(wybieralna):[];
      return {lista:l?(l.id||"blista-folder"):null,n:k.length,ids:k.map(li=>li.dataset.id)};},
    pomiar:()=>POMIARY.slice(),tempo:tempoPrzejscia,przejscie:()=>({czasOrig:R.czasOrig,trwa:R.trwa,oczekuje:R.oczekuje,zaslona:!!R.zaslona&&R.zaslona.classList.contains("w-ruchu")}),rozgrzewka:()=>({zrobiona:RG.zrobiona,czas:RG.czas,odlozone:RG.odlozone.size})};
})();
if(typeof window!=="undefined")window.LobbyScena=LobbyScena;
