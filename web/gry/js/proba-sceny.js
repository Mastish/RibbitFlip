"use strict";
// ===== RIBBITBEAT: próba generalna sceny przed piosenką (2026-10-17) =====
// Objaw: „każda piosenka na początku się zacina przed uderzeniem w pierwszą nutę (albo w momencie uderzenia);
// przed odpaleniem piosenki WSZYSTKIE jej elementy powinny być w pamięci”. Ślad wydajności Chrome:
// grafika z sieci jest już wczytana, bitmapy też, ale przeglądarka kompiluje programy GPU (D3DCompile + ProgramD3D::link)
// dopiero przy PIERWSZYM narysowaniu danego rodzaju rzeczy NA PRAWDZIWYM płótnie sceny: 65 kompilacji i link 29 ms przy
// pierwszej nucie, potem po kilka przy ogniu 1, 2, 3. Rozgrzewka na małym płótnie (przecwiczEfekty) tego nie łapie, bo
// Skia wybiera inne programy zależnie od rozmiaru ścieżek i płótna.
//
// Sztuczka: w pierwszej klatce odliczania (zegar gry jeszcze stoi, S.zegarStoi) scena rysuje się kilka razy na
// prawdziwych płótnach w udawanych stanach piosenki: nuta na linii z trafieniem, minione nuty z ocenami, spinaczami
// i wypełnieniem, ślady śpiewu, dymki, lecące punkty, pieczątki, ogień 0–3 z iskrami i dymem. Po każdym stanie płótno
// jest wysyłane na GPU (drawImage na płótno 1×1), więc programy kompilują się teraz. Potem cały stan wraca co do pola,
// a ta sama klatka rysuje zwykłe odliczanie: na ekranie nic z próby nie widać. ?proba=0 = bez próby (porównanie).
const ProbaSceny=(function(){
  let pom=null;
  // wysyła nagrane rysowanie płótna na GPU teraz (zrzut płótna jako źródło drawImage), bez odczytu pikseli do JS
  function wyslij(){
    try{
      if(!pom){pom=document.createElement("canvas");pom.width=pom.height=1;}
      const c=pom.getContext("2d");
      for(const cv of [R.scena,R.tlo])if(cv&&cv.width)c.drawImage(cv,0,0,1,1);
    }catch(e){}
  }
  // Próba z części (11-18): przygotuj() zapamiętuje stan gry i zwraca trzy kroki: stan(og, teraz) rysuje jeden
  // udawany stan ognia, cyfry() rozmiary cyfr odliczania, koniec() przywraca wszystko co do pola. wykonaj() robi
  // wszystko naraz, kawalek() jeden krok na wywołanie (zasłona wczytywania utworu woła go co klatkę, żeby cała próba
  // nie spadała na jedną klatkę). Bez koniec() gra zostaje w udawanym stanie, więc każda droga kończy się nim.
  function przygotuj(teraz){
    const G=S.gra;if(!G||!R.tory||!R.tory.length||typeof rysujScene!=="function")return null;
    // chwila próby: w trzeciej nucie pierwszego toru (są już nuty minione), 40 % jej długości
    const N0=R.tory[0].tor.def.nuty,nr=Math.min(2,N0.length-1);if(nr<0)return null;
    const b=N0[nr].t+N0[nr].d*.4;
    const t0=performance.now(),zapis=[];
    const zachowaj=(o,pola)=>{if(!o)return;const z={};for(const k of pola)z[k]=o[k];zapis.push([o,z]);};
    zachowaj(G,["beat","ogien","blyskTeraz","popupy","loty","stemple","fala"]);
    zachowaj(R,["iskry","dym","naklejkiOcen","sprajtyBudzet","ostRys","zarWid","st","doIskier","doDymu","dtIskier"]);
    for(const L of R.tory){const t=L.tor;
      zachowaj(t,["ogien","zar","spal","oceny","blysk","ptrRys","wJednymGlosie"]);
      for(const g of t.gracze)zachowaj(g,["ogien","kombo","naNucie","idxPod","spiewa","halo","polton","poz","klik","wypel","wyniki","slad","rechot","potrzas","gada","_komboPop"]);}
    let stany=0,zamknieta=false;
    function stan(og,teraz){
      try{
        G.beat=b;G.ogien=og;G.blyskTeraz=og===0?1:0;G.popupy=[];G.loty=[];G.stemple=[];R.iskry=[];R.dym=[];
        for(const L of R.tory){
          const t=L.tor,nuty=t.def.nuty;
          t.ogien=og;t.zar=og;t.spal={};t.oceny=[];t.blysk=og===0?2:0;t.ptrRys=0;
          let ia=-1;const minione=[];
          for(let i=0;i<nuty.length&&nuty[i].t<=b;i++){if(nuty[i].t+nuty[i].d>b)ia=i;else minione.push(i);}
          const ost=minione.slice(-3);
          for(const [k,j] of ost.entries()){
            t.oceny[j]={ocena:["czysto","dobrze","prawie"][k%3],ile:t.gracze.length,srednia:.9,wibrato:k===0};
            if(og>=1)t.spal[j]=og;
          }
          if(ia>=0&&og>=1)t.spal[ia]=og;
          for(const g of t.gracze){
            g.ogien=og;g.kombo=[0,12,30,60][og];g._komboPop=g.kombo;g.klik={};g.wypel={};g.wyniki=[];g.potrzas=og===0?1:0;g.gada=false;
            for(const [k,j] of ost.entries()){const n=nuty[j];
              g.wyniki[j]={ocena:t.oceny[j].ocena,punkty:100,mnoznik:1,wynik:.9,wibrato:k===0};
              g.klik[j]={w:"idealnie",wp:30,z:k?"dobrze":"idealnie",zp:20,wpkt:k===1?50:0,wpktOc:k===1?(og%2?"idealnie":"dobrze"):undefined};
              g.wypel[j]=[{od:n.t,do:n.t+n.d*.5,k:0},{od:n.t+n.d*.5,do:n.t+n.d*.8,k:1},{od:n.t+n.d*.8,do:n.t+n.d,k:2}];}
            const n=ia>=0?nuty[ia]:nuty[Math.min(nuty.length-1,ost.length?ost[ost.length-1]:0)];
            g.idxPod=ia;g.naNucie=ia>=0;g.spiewa=true;g.halo=1;g.polton=n.m;g.rechot=0;
            if(ia>=0){g.wypel[ia]=[{od:n.t,do:b,k:0}];g.klik[ia]={w:"dobrze",wp:10};}
            g.slad=[];for(let k=0;k<=60;k++)g.slad.push({b:b-3+k*.05,s:n.m+Math.sin(k*.4)*1.5,sp:k%17!==0});
          }
          // dymki, lecące punkty i pieczątki „w punkt” (bitmapy są gotowe, tu chodzi o pierwsze ich narysowanie)
          const g=t.gracze[0];if(!g)continue;
          if(typeof popup==="function"){popup(g,tt("komboPopup",{n:16}),"kombo",16);popup(g,T.wibrato,"wibrato");popup(g,T.ocena_falsz,"falsz");
            popup(g,tt("klikPopup",{n:8}),"klik",8);popup(g,T.wJednymGlosie,"chor");}
          for(const [k,j] of ost.entries()){
            G.loty.push({g,tor:t,punkty:120,mnoznik:2,ocena:t.oceny[j].ocena,od:teraz-150*k,nr:k});
            G.stemple.push({g,tor:t,idx:j,oc:k%2?"idealnie":"dobrze",seria:k+1,pkt:50,od:teraz-100*k});
          }
        }
        // dwie klatki na stan: w drugiej lecą już iskry i dym z pierwszej
        for(let k=0;k<2;k++){R.ostRys=teraz+k*16-16;R.dtIskier=.05;rysujScene(teraz+k*16);stany++;}
        wyslij();
      }catch(e){console.warn("RibbitBeat: próba sceny",e);}
    }
    function cyfry(){
      // cyfry odliczania rosną i maleją co klatkę (rysujOdliczanie: font r·1,15 px), a każdy nowy rozmiar to nowe glify:
      // wszystkie rozmiary raz, prawie przezroczyście (zwykła klatka zaraz czyści płótno)
      try{const c=R.cs,top=R.tory[0].y,bot=R.widownia.y,r0=Math.min(78,(bot-top)*.2);
        c.save();c.setTransform(R.dpr,0,0,R.dpr,0,0);c.globalAlpha=.004;c.fillStyle="#faf6ee";c.textAlign="center";c.textBaseline="middle";
        for(let px=Math.round(r0*1.15)-1;px<=Math.round(r0*1.12*1.15)+1;px++){c.font="400 "+px+"px 'Titan One','Baloo 2',sans-serif";c.fillText("1234",R.W/2,R.H/2);}
        c.restore();wyslij();}catch(e){}
    }
    function koniec(bezHud){
      if(zamknieta)return ProbaSceny.raport;zamknieta=true;
      for(const [o,z] of zapis)Object.assign(o,z);
      // bitmapy minionych taśm z udawanymi trafieniami nie mogą wrócić w prawdziwej piosence
      for(const L of R.tory){const t=L.tor;if(t.minione){for(const mb of t.minione.values())if(typeof oddajPlotno==="function")oddajPlotno(mb.cv);t.minione.clear();}}
      // HUD podskakuje na starcie piosenki (graKrok, animate translateY): przeglądarka wydziela go wtedy na osobną warstwę
      // i rasteryzuje od nowa, co w śladzie dawało połowę kompilacji przy pierwszej nucie. Ta sama animacja bez ruchu
      // (translateY 0 → 0) tutaj robi to samo pod stojącym zegarem; na ekranie nic się nie rusza.
      if(!bezHud)try{const hud=document.getElementById("hud");if(hud&&hud.animate)hud.animate([{transform:"translateY(0)"},{transform:"translateY(0)"}],{duration:400});}catch(e){}
      const ms=performance.now()-t0;
      ProbaSceny.raport={ms:Math.round(ms),stany};
      return ProbaSceny.raport;
    }
    return {stan,cyfry,koniec};
  }
  function wykonaj(teraz){
    const P=przygotuj(teraz);if(!P)return null;
    try{for(const og of [0,1,2,3])P.stan(og,teraz);P.cyfry();}catch(e){console.warn("RibbitBeat: próba sceny",e);}
    return P.koniec();
  }
  // Jeden kawałek próby na klatkę (zasłona wczytywania utworu): nr 0–3 = stan ognia, 4 = cyfry odliczania. Udawany stan
  // żyje tylko wewnątrz tego wywołania: gra wraca do prawdziwego stanu, zanim cokolwiek innego go przeczyta
  // (samouczek śledzi takt co 30 ms i przy stanie zostawionym między klatkami pokazywał swój krok za wcześnie).
  function kawalek(teraz,nr){
    const P=przygotuj(teraz);if(!P)return false;
    try{if(nr<4)P.stan(nr,teraz);else P.cyfry();}catch(e){console.warn("RibbitBeat: próba sceny",e);}
    P.koniec(nr<4);
    return true;
  }
  return {wykonaj,kawalek,raport:null};
})();
if(typeof window!=="undefined")window.ProbaSceny=ProbaSceny;
