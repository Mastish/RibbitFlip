"use strict";
// ===== RIBBITBEAT: awatary żab do kont (2026-10-19, grafiki 10-20) =====
// Awatary żab do „Kto gra?”, inne niż żaby dostępne do śpiewania: filcowe żaby jak ta z irokezem z RibbitFlip,
// w różnych stylach punkowych (głównie fryzury i akcesoria), w ujęciu 3/4 zamiast frontu, w stylu i z poziomem
// detali wzorcowej naszywki.
//
// GRAFIKI: dziesięć filcowych naszywek z generatora (Codex image_generation), pliki w
// web/assets/frog/awatary/<id>.webp, 192×192 z alfą. Powstały tak jak grafiki motywów, skryptami poza repozytorium:
//   prompty_awatary.py   zlecenia (blok stylu marki + opis fryzury każdej żaby)
//   generuj_awatary.py   Codex CLI z TRZEMA referencjami: ref/logo.png, ref/styl_ikony.png
//                        i ref/awatar_wzor.png, czyli zdjęciem wzorcowej naszywki
//   obrobka_awatary.py   klucz magenty → alfa, przycięcie, kwadrat 192 px, zapis .webp
// Każda to ta sama żaba co w logo, w ujęciu 3/4, z czarną obwódką naszywki, kremowym ściegiem i kraftowymi oczami;
// różni je FRYZURA albo AKCESORIUM (irokez, kolce liberty, dredy, grzywka, czub, chusta, czapka, okulary,
// kolczatka, agrafka). Nowy awatar = nowy wpis w prompty_awatary.py, generacja, obróbka i id na liście niżej.
//
// DLACZEGO OSOBNY ZESTAW: skiny do śpiewania to żabie głowy motywów (web/assets/motywy/<motyw>/glowa-*.webp,
// zaba-*.webp) i klatki śpiewu (web/assets/frog/sing-*.png): gracz zdobywa je na kole nagród. Awatar konta nie może
// być żadną z tych rzeczy: wybór konta nie ma udawać nagrody ani pokazywać z góry, co jest do zdobycia. Dlatego ta
// dziesiątka ma własny katalog, własne id (żadne nie jest id motywu) i nic nie odblokowuje.
//
// API: window.Awatary = {LISTA, ID, KATALOG, czy(id), dla(klucz, id), domyslny(klucz), nazwa(id), plik(id),
//   obraz(id, o?), element(id, o?), wybor(o)}; `obraz` daje gotowy znacznik <img> (jak ikonaFilc w zabi-chor.js),
// `wybor` buduje grupę radio (klawiatura i pad jak przy palecie kolorów). Napisy po polsku i angielsku są
// w słowniku T (zabi-chor.js: awatary, awatarEt…), więc moduł sam ich nie trzyma; bez T woła po id.
// Zapis: id awatara leży w profilu konta (postepy.js, pole `awatar` obok `kolor`), nie w osobnym kluczu.
const Awatary=(function(){
  // Ścieżka względna, tak jak ZC_IKONY_GRY w zabi-chor.js: gra chodzi pod /gry/ i pod /web/gry/.
  const KATALOG="../assets/frog/awatary/";
  const LISTA=[
    {id:"irokez"},      // żaba z logo: różowy irokez z kolców i czarnymi kolcami warstwy spodniej
    {id:"liberty"},     // długie musztardowe kolce liberty
    {id:"dredy"},       // czarne dredy owinięte kremową nicią
    {id:"grzywka"},     // sprana grzywka na jedno oko
    {id:"czub"},        // czarny czub zaczesany do góry
    {id:"chusta"},      // różowa chusta w grochy, spod niej limonkowe kosmyki
    {id:"czapka"},      // musztardowa czapka z pomponem
    {id:"okulary"},     // ciemne okulary i krótkie sprane kolce
    {id:"kolczatka"},   // łysa głowa, kolczatka z ćwiekami
    {id:"agrafka"}];    // limonkowa grzywa i agrafka wpięta przy policzku
  const ID=LISTA.map(a=>a.id),MAPA=new Map(LISTA.map(a=>[a.id,a]));

  // ---- wybór i domyślny awatar ----
  const czy=id=>MAPA.has(id);
  // Stary zapis (konto założone przed awatarami) nie ma pola `awatar`: domyślny liczy się z klucza profilu (FNV-1a),
  // więc każde konto dostaje swoją żabę, zawsze tę samą, i nikt nie widzi pustego kwadratu.
  function skrot(t){
    const s=String(t==null?"":t);let h=2166136261;
    for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}
    return h>>>0;
  }
  const domyslny=klucz=>ID[skrot(klucz)%ID.length];
  const dla=(klucz,id)=>czy(id)?id:domyslny(klucz);   // nieznane id (ręczna zmiana zapisu, import z nowszej wersji) = domyślny
  const nazwa=id=>{
    try{if(typeof T!=="undefined"&&T.awatary&&T.awatary[id])return T.awatary[id];}catch(e){}
    return id;
  };
  const plik=id=>KATALOG+(czy(id)?id:ID[0])+".webp";

  // ---- do DOM ----
  // obraz(id, {rozmiar, klasa}) = gotowy znacznik (jak ikonaFilc w zabi-chor.js: insertAdjacentHTML), zawsze
  // aria-hidden: nazwę awatara niesie aria-label przycisku albo tekst obok.
  function obraz(id,o){
    o=o||{};const r=o.rozmiar;
    return '<img class="'+(o.klasa||"awatar")+'" src="'+plik(id)+'"'+(r?' width="'+r+'" height="'+r+'"':"")+
      ' alt="" aria-hidden="true" draggable="false" decoding="async">';
  }
  // element(id, o) = ten sam znacznik jako element (do prepend/append tam, gdzie nie ma gdzie wstawić znacznika)
  function element(id,o){
    const d=document.createElement("div");d.innerHTML=obraz(id,o);return d.firstElementChild;
  }
  // Grupa radio z awatarami (konta.js: „Nowe konto” i zmiana awatara; profile.js: podokno awatara). Klawiatura i pad
  // chodzą po niej jak po palecie kolorów: zwykłe przyciski w oknie, strzałki przez nawigujLobby, Enter i Spacja klikają.
  function wybor(o){
    o=o||{};let wybrany=czy(o.wybrany)?o.wybrany:domyslny(o.klucz);
    const grupa=document.createElement("div");grupa.className="profil-paleta awatar-paleta";
    grupa.setAttribute("role","radiogroup");
    grupa.setAttribute("aria-label",o.etykieta||nazwaEt());
    const odswiez=()=>{for(const b of grupa.children)b.setAttribute("aria-checked",String(b.dataset.awatar===wybrany));};
    for(const a of LISTA){
      const b=document.createElement("button");b.type="button";b.className="profil-kolor-opcja awatar-opcja";
      b.setAttribute("role","radio");b.dataset.awatar=a.id;
      b.setAttribute("aria-label",nazwa(a.id));b.title=nazwa(a.id);
      b.innerHTML=obraz(a.id);
      if(a.id===wybrany)b.dataset.start="1";
      b.onclick=()=>{wybrany=a.id;odswiez();if(o.naZmiane)o.naZmiane(a.id,b);};
      grupa.append(b);
    }
    odswiez();
    return grupa;
  }
  function nazwaEt(){try{if(typeof T!=="undefined"&&T.awatarEt)return T.awatarEt;}catch(e){}return "Awatar";}

  return {LISTA,ID,KATALOG,czy,dla,domyslny,nazwa,plik,obraz,element,wybor};
})();
if(typeof window!=="undefined")window.Awatary=Awatary;
