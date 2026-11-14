"use strict";
// ===== RIBBITBEAT: pakiety piosenek z audio (faza 3 konwertera audio → MIDI) =====
// Pakiet piosenki (kontrakt „Format pakietu piosenki v1”) to folder
// zapisany przez Testownik: piosenka.mid, manifest.json z mapą czasu nagrania, nuty.json, miks.json i audio
// (oryginał i stemy). Serwer aplikacji podaje go trasami /gry/api/piosenki* (ribbitflip_piosenki.py).
//
// Co robi ten plik:
//  · lista pakietów i wczytanie pakietu (MIDI idzie zwykłą drogą zrodloZPliku w biblioteka.js, więc partie,
//    trudność i wybór melodii działają jak dla pliku przeciągniętego na okno),
//  · MAPA CZASU: tick MIDI ↔ sekunda nagrania (interpolacja po uderzenia_s, ćwierćnuta = `wspolczynnik` uderzeń),
//  · układy miksu (wbudowane + własne z miks.json) i ich składanie z tym, co pakiet naprawdę ma,
//  · odtwarzacz stemów Web Audio i ZEGAR: gra liczy czas w ćwierćnutach stałego tempa, nagranie płynie w swoich
//    sekundach. Gdy audio gra i zgadza się z grą (różnica do 60 ms), to ono prowadzi: krok czasu gry wynika z pozycji
//    nagrania przeliczonej mapą czasu (rubato nagrania nie rozjeżdża nut i dźwięku, wysokość się nie zmienia).
//    Większa różnica (start, pauza, przewinięcie, powtórka fragmentu) = przeskok nagrania na pozycję gry.
//  · wybór układu w lobby (krok Rozgrywka) z zapamiętaniem przez POST piosenki/miks.
// Napisy w słowniku T (zabi-chor.js), pomocniki DOM (h, el, tt, toast) i stan S też stamtąd. Style: wstrzyknięty
// <style> z klasami .pp-miks* (gry.css należy do innej sesji; .pp-* bez „miks” to podgląd partii w biblioteka.js).

const ZC_PP={DRYF_S:.06,START_ZA_S:.03,WYGASZ_S:.03,POZIOM:.8,RATE_MIN:.25,RATE_MAX:4};
// Suwak „Podkład” z ustawień gry (Glos.mnoznik, 10-10) mnoży też nagranie pakietu; zmiana w trakcie działa od razu.
const mnPodkladu=()=>typeof Glos!=="undefined"&&Glos.mnoznik?Glos.mnoznik("podklad"):1;
const PP_AUDIO=["oryginal","vocals","drums","bass","other"];
const PP_STEMY=["vocals","drums","bass","other"];
const PP_MIDI=["midi_vocal","midi_bass","midi_chords","midi_drums"];
// Wbudowane układy miksu (kontrakt v1). melodia_gracza: „spiew” = gracz śpiewa melodię, ścieżka MIDI Vocal milczy;
// „instrument” = melodię gra instrument żaby (jak w zwykłej piosence). Tor gracza i jego głos działają jak dotąd.
const PP_UKLADY=[
  {id:"karaoke",melodia_gracza:"spiew",
    zrodla:{oryginal:0,vocals:0,drums:1,bass:1,other:1,midi_vocal:0,midi_bass:0,midi_chords:0,midi_drums:0}},
  {id:"zabi_wokal",melodia_gracza:"instrument",
    zrodla:{oryginal:0,vocals:0,drums:1,bass:1,other:1,midi_vocal:1,midi_bass:0,midi_chords:0,midi_drums:0}},
  {id:"oryginal_w_tle",melodia_gracza:"instrument",
    zrodla:{oryginal:.3,vocals:0,drums:0,bass:0,other:0,midi_vocal:1,midi_bass:1,midi_chords:1,midi_drums:1}},
  {id:"czysty_ribbitbeat",melodia_gracza:"instrument",
    zrodla:{oryginal:0,vocals:0,drums:0,bass:0,other:0,midi_vocal:1,midi_bass:1,midi_chords:1,midi_drums:1}}];
const PP={dostepne:null,lista:[],wpisy:new Map(),odtw:null,odtwG:null,aktywny:null,styl:false};

// ---------------------------------------------------------------------------------------------
// CZYSTE FUNKCJE (testy: tests/gry_pakiety_harness.mjs wycina je po nazwie)
function ppOkresMediany(ud){
  const d=[];for(let i=1;i<ud.length;i++){const x=ud[i]-ud[i-1];if(x>0)d.push(x);}
  if(!d.length)return .5;
  d.sort((a,b)=>a-b);const n=d.length;
  return n%2?d[n>>1]:(d[n/2-1]+d[n/2])/2;
}
// Sekunda nagrania → ułamkowy indeks uderzenia: wewnątrz interpolacja liniowa, poza siatką ekstrapolacja medianą okresu
// (ta sama matematyka co siatka.py konwertera: czas_na_uderzenie / uderzenie_na_czas).
function ppCzasNaUderzenie(t,ud,okres){
  const ost=ud.length-1;
  if(t<=ud[0])return (t-ud[0])/okres;
  if(t>=ud[ost])return ost+(t-ud[ost])/okres;
  let lo=0,hi=ost;while(hi-lo>1){const m=(lo+hi)>>1;if(ud[m]<=t)lo=m;else hi=m;}
  const a=ud[lo],b=ud[lo+1];return b>a?lo+(t-a)/(b-a):lo;
}
function ppUderzenieNaCzas(u,ud,okres){
  const ost=ud.length-1;
  if(u<=0)return ud[0]+u*okres;
  if(u>=ost)return ud[ost]+(u-ost)*okres;
  const i=Math.floor(u),a=ud[i],b=ud[i+1];return a+(u-i)*(b-a);
}
// manifest.mapa_czasu → mapa {ud, tpq, k, u0, okres}. Tick `start_tick` leży w sekundzie `start_s` (domyślnie tick 0
// na pierwszym uderzeniu); `poczatek_u` z konwertera (indeks uderzenia ticku 0), jeśli jest, wygrywa jako dokładny.
function ppMapa(mc){
  if(!mc||!Array.isArray(mc.uderzenia_s))throw new Error("brak mapy czasu");
  const ud=mc.uderzenia_s.map(Number).filter(Number.isFinite);
  if(ud.length<2)throw new Error("mapa czasu: za mało uderzeń");
  for(let i=1;i<ud.length;i++)if(!(ud[i]>ud[i-1]))throw new Error("mapa czasu: uderzenia nie rosną");
  const tpq=+mc.tpq>0?+mc.tpq:480,k=+mc.wspolczynnik>0?+mc.wspolczynnik:1,okres=ppOkresMediany(ud);
  let u0;
  if(mc.poczatek_u!=null&&Number.isFinite(+mc.poczatek_u))u0=+mc.poczatek_u;
  else{
    const st=Number.isFinite(+mc.start_tick)?+mc.start_tick:0,ss=mc.start_s!=null&&Number.isFinite(+mc.start_s)?+mc.start_s:ud[0];
    u0=ppCzasNaUderzenie(ss,ud,okres)-st/tpq*k;
  }
  return {ud,tpq,k,u0,okres};
}
function ppTickNaSekundy(mapa,tick){return ppUderzenieNaCzas(mapa.u0+tick/mapa.tpq*mapa.k,mapa.ud,mapa.okres);}
function ppSekundyNaTick(mapa,s){return (ppCzasNaUderzenie(s,mapa.ud,mapa.okres)-mapa.u0)/mapa.k*mapa.tpq;}
// Ćwierćnuta gry (od początku fragmentu, z powtórkami) → ćwierćnuta utworu i numer powtórki; i odwrotnie.
function ppPozycja(beat,frag,metrum){
  if(!frag||frag.caly)return {q:beat,powt:0};
  const od=(frag.od-1)*metrum,ile=Math.max(metrum,(frag.do-frag.od+1)*metrum),razy=Math.max(1,frag.powtorz|0);
  const powt=beat<0?0:Math.min(razy-1,Math.floor(beat/ile));
  return {q:od+beat-powt*ile,powt};
}
function ppBeat(q,powt,frag,metrum){
  if(!frag||frag.caly)return q;
  const od=(frag.od-1)*metrum,ile=Math.max(metrum,(frag.do-frag.od+1)*metrum);
  return q-od+powt*ile;
}
// Głośność źródła w układzie: 0–1 (kontrakt v1, jak suwaki Testownika); większe wartości z pliku przycinane do 1.
const ppGlosnosc=v=>v!=null&&Number.isFinite(+v)?Math.max(0,Math.min(1,+v)):0;
// Wbudowane + własne z miks.json (własny o id wbudowanego zastępuje go). Każdy układ ma komplet źródeł.
function ppUklady(miks){
  const pelny=u=>{const z={};for(const k of PP_AUDIO.concat(PP_MIDI))z[k]=ppGlosnosc(u.zrodla&&u.zrodla[k]);return z;};
  const out=PP_UKLADY.map(u=>({id:u.id,nazwa:"",wbudowany:true,zrodla:pelny(u),melodia_gracza:u.melodia_gracza}));
  for(const u of miks&&Array.isArray(miks.uklady)?miks.uklady:[]){
    if(!u||typeof u.id!=="string"||!/^[a-z0-9_-]{1,40}$/.test(u.id)||!u.zrodla||typeof u.zrodla!=="object")continue;
    // Wpis o id wbudowanego (Testownik zapisuje wbudowane do miks.json) zostaje „wbudowany”: nazwa i opis ze słownika,
    // a głośności z pliku, żeby zmiana suwaków w Testowniku była widoczna w grze.
    const wb=u.wbudowany===true||PP_UKLADY.some(b=>b.id===u.id);
    const x={id:u.id,nazwa:wb?"":String(u.nazwa||u.id).slice(0,60),wbudowany:wb,zrodla:pelny(u),
      melodia_gracza:u.melodia_gracza==="instrument"?"instrument":"spiew"};
    const i=out.findIndex(y=>y.id===x.id);if(i>=0)out[i]=x;else out.push(x);
  }
  return out;
}
// Układ startowy: zapamiętany w miks.json, potem domyślny z manifestu, potem karaoke.
function ppDomyslnyUklad(uklady,miks,manifest){
  for(const c of [miks&&miks.uklad_domyslny,manifest&&manifest.uklad_domyslny,"karaoke"])
    if(c&&uklady.some(u=>u.id===c))return c;
  return uklady.length?uklady[0].id:"karaoke";
}
// Układ + to, co pakiet ma (dostepne: {oryginal, vocals, …} → bool) = głośności do grania. Brak pliku nie gubi dźwięku:
//  · brak WSZYSTKICH stemów: oryginał dostaje swoją głośność + średnią głośność stemów (oryginał = suma stemów),
//  · brak oryginału przy obecnych stemach: każdy obecny stem dostaje głośność oryginału,
// zawsze w granicach 0–1. MIDI: 0–1 z układu.
function ppZlozUklad(uklad,dostepne){
  const z=(uklad&&uklad.zrodla)||{},d=dostepne||{},g=k=>ppGlosnosc(z[k]);
  const audio={};for(const k of PP_AUDIO)audio[k]=d[k]?g(k):0;
  const stemy=PP_STEMY.filter(k=>d[k]);
  if(d.oryginal&&!stemy.length)audio.oryginal=Math.min(1,g("oryginal")+PP_STEMY.reduce((s,k)=>s+g(k),0)/PP_STEMY.length);
  if(!d.oryginal&&stemy.length)for(const k of stemy)audio[k]=Math.min(1,audio[k]+g("oryginal"));
  const midi={};for(const k of PP_MIDI)midi[k]=g(k);
  return {audio,midi,melodia_gracza:uklad&&uklad.melodia_gracza==="instrument"?"instrument":"spiew"};
}
// Nazwa ścieżki MIDI → źródło układu (konwerter pisze Vocal, Bass, Chords; perkusja na kanale 10 gra i tak pomija).
function ppKluczSciezki(nazwa){
  const n=String(nazwa||"").toLowerCase();
  if(/vocal|lead|melod|sopran|wokal|spiew|śpiew/.test(n))return "midi_vocal";
  if(/bass|\bbas\b/.test(n))return "midi_bass";
  if(/drum|perk/.test(n))return "midi_drums";
  return "midi_chords";
}
// Tempo gry → szybkość nagrania (playbackRate): nagranie w swoim tempie, gdy gra idzie tempem zapisu MIDI.
function ppRate(bpmGry,tempoPliku){
  const r=+tempoPliku>0?bpmGry/tempoPliku:1;
  return Math.max(ZC_PP.RATE_MIN,Math.min(ZC_PP.RATE_MAX,Number.isFinite(r)?r:1));
}

// ---------------------------------------------------------------------------------------------
// SERWER (token sesji jak w pakiety.js; poza aplikacją tras nie ma i lista jest pusta)
async function ppApi(sciezka,cialo){
  const o=cialo?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(cialo)}:{};
  if(cialo&&window.RIBBITFLIP_TOKEN)o.headers["X-RibbitFlip-Token"]=window.RIBBITFLIP_TOKEN;
  const r=await fetch("/gry/api/"+sciezka,o);
  const typ=r.headers.get("Content-Type")||"";
  if(!typ.includes("json")){if(!r.ok)throw Object.assign(new Error("HTTP "+r.status),{status:r.status});return r;}
  const j=await r.json();
  if(!r.ok||j.ok===false)throw Object.assign(new Error(j.error||("HTTP "+r.status)),{status:r.status});
  return j;
}
const ppQ=slug=>"slug="+encodeURIComponent(slug);
// Błąd pakietu → zdanie po polsku dla gracza; surowy tekst (JSON, dekoder, serwer) idzie tylko do console.warn.
function ppOpisBledu(e,plik){
  const surowy=String((e&&e.message)||e||""),st=e&&e.status,nazwa=e&&e.name;
  console.warn("RibbitBeat: pakiet piosenki, "+plik+":",surowy);
  const zm={plik};
  if(nazwa==="EncodingError"||/decode|dekod/i.test(surowy))return tt("ppBladDekodowania",zm);
  if(st===403)return tt("ppBladDostep",zm);
  if(st>=500)return tt("ppBladSerwera",zm);
  if(st===404||/Brak pliku|Nie ma takiej|nie ma takiego/i.test(surowy))return tt("ppBladBrak",zm);
  if(nazwa==="SyntaxError"||/JSON|Expecting|Unexpected token|Unterminated/i.test(surowy))return tt("ppBladJson",zm);
  if(nazwa==="TypeError"&&/fetch|network/i.test(surowy))return tt("ppBladSiec",zm);
  if(st===422||/manifest|wersja|slug|mapa_czasu|tempo\.|sciezki|licencja/i.test(surowy))return tt("ppBladManifest",zm);
  return tt("ppBladInny",zm);
}
async function ppLista(){
  try{const j=await ppApi("piosenki");PP.dostepne=true;PP.lista=Array.isArray(j.piosenki)?j.piosenki:[];}
  catch(e){PP.dostepne=false;PP.lista=[];}
  for(const x of PP.lista)if(x&&x.blad)x.blad=ppOpisBledu(new Error(x.blad),x.slug);   // na karteczce w „Moje”
  return PP.lista.slice();
}
// Manifest, miks i bajty MIDI pakietu. Wpis do biblioteki robi biblioteka.js (bibDodajZPiosenki), potem ppPowiaz.
async function ppWczytaj(slug){
  let j,midi;
  try{
    j=await ppApi("piosenki/manifest?"+ppQ(slug));
    midi=await (await ppApi("piosenki/midi?"+ppQ(slug))).arrayBuffer();
  }catch(e){throw new Error(ppOpisBledu(e,slug));}
  const m=j.manifest,a=m.audio||{},st=a.stemy||{};
  const dostepne={oryginal:!!a.oryginal};for(const k of PP_STEMY)dostepne[k]=!!st[k];
  return {slug,manifest:m,miks:j.miks||null,midi,dostepne,audio:PP_AUDIO.some(k=>dostepne[k])};
}
// Wpis biblioteki (id gry) ↔ pakiet: mapa czasu, początek utworu w ćwierćnutach (origin parsera), tempo zapisu.
function ppPowiaz(id,d,zr){
  const A=(zr&&zr.w&&zr.w._all)||{};
  const t=d.manifest.tempo||{};
  const uklady=ppUklady(d.miks);
  const P={id,slug:d.slug,manifest:d.manifest,miks:d.miks,dostepne:d.dostepne,audio:d.audio,
    mapa:ppMapa(d.manifest.mapa_czasu),origin:+A.origin||0,
    tempoPliku:+t.zapisane_bpm>0?+t.zapisane_bpm:(zr&&zr.tempoPliku)||120,
    uklady,wybor:ppDomyslnyUklad(uklady,d.miks,d.manifest),bufory:{},laduje:{},postep:{},bledy:{},pominiete:{}};
  P.sek=q=>ppTickNaSekundy(P.mapa,(q+P.origin)*P.mapa.tpq);
  P.q=s=>ppSekundyNaTick(P.mapa,s)/P.mapa.tpq-P.origin;
  P.tickNaSekundy=t=>ppTickNaSekundy(P.mapa,t);
  P.sekundyNaTick=s=>ppSekundyNaTick(P.mapa,s);
  P.uklad=()=>P.uklady.find(u=>u.id===P.wybor)||P.uklady[0];
  PP.wpisy.set(id,P);
  return P;
}

// ---------------------------------------------------------------------------------------------
// AUDIO: leniwe wczytanie (fetch + decodeAudioData) tylko źródeł słyszalnych w wybranym układzie
function ppPotrzebne(P){
  const g=ppZlozUklad(P.uklad(),P.dostepne).audio;
  return PP_AUDIO.filter(k=>g[k]>0);
}
// Gotowe = każde słyszalne źródło wczytane albo świadomie pominięte („Graj bez tego źródła”).
function ppGotowe(P){return ppPotrzebne(P).every(k=>P.bufory[k]||P.pominiete[k]);}
// Słyszalne w układzie źródła, które się nie wczytały i gracz ich jeszcze nie pominął: blokują start.
function ppBrakujace(P){return ppPotrzebne(P).filter(k=>P.bledy[k]&&!P.pominiete[k]&&!P.bufory[k]);}
function ppNazwaPliku(P,k){
  const a=P.manifest.audio||{},sc=k==="oryginal"?a.oryginal:(a.stemy||{})[k];
  return String(sc||k).split("/").pop();
}
async function ppPobierzPlik(P,k){
  const r=await ppApi("piosenki/audio?"+ppQ(P.slug)+"&plik="+k);
  const n=+(r.headers.get("Content-Length")||0);
  let bajty;
  if(r.body&&r.body.getReader&&n>0){
    const czytnik=r.body.getReader(),kawalki=[];let ile=0;
    for(;;){const {done,value}=await czytnik.read();if(done)break;kawalki.push(value);ile+=value.length;P.postep[k]=Math.min(1,ile/n);ppOdswiezStan();}
    bajty=new Uint8Array(ile);let o=0;for(const c of kawalki){bajty.set(c,o);o+=c.length;}
    bajty=bajty.buffer;
  }else bajty=await r.arrayBuffer();
  P.postep[k]=1;
  const ctx=Glos.kontekst();if(!ctx)throw new Error("brak Web Audio");
  if(!bajty.byteLength)throw Object.assign(new Error("decode: pusty plik"),{name:"EncodingError"});
  return await ctx.decodeAudioData(bajty);
}
// Zwalnia nagrania innych piosenek (zdekodowany stem 4 min to ~90 MB pamięci).
function ppZwolnijInne(id){
  for(const P of PP.wpisy.values())if(P.id!==id&&Object.keys(P.bufory).length){P.bufory={};P.postep={};}
}
function ppWczytajAudio(id){
  const P=PP.wpisy.get(id);if(!P||!P.audio)return Promise.resolve(false);
  ppZwolnijInne(id);
  // plik z błędem nie wraca do kolejki: błąd zostaje przy NIM (inny wczytany plik go nie kasuje)
  const brak=ppPotrzebne(P).filter(k=>!P.bufory[k]&&!P.laduje[k]&&!P.bledy[k]);
  for(const k of brak){
    P.laduje[k]=ppPobierzPlik(P,k).then(b=>{P.bufory[k]=b;delete P.bledy[k];},e=>{P.bledy[k]=ppOpisBledu(e,ppNazwaPliku(P,k));})
      .finally(()=>{delete P.laduje[k];ppOdswiezStan();});
  }
  ppOdswiezStan();
  return Promise.all(Object.values(P.laduje)).then(()=>ppGotowe(P));
}

// Odtwarzacz: jedno AudioBufferSourceNode na źródło, wspólny start i wspólna szybkość. pozycja(t) = s0 + (t − t0)·rate.
function ppOdtwarzacz(ctx,cel){
  let zrodla=[],glowny=null,t0=0,s0=0,rate=1,gra=false,dlugosc=0;
  const stop=()=>{
    if(!gra&&!zrodla.length)return;
    const t=ctx.currentTime,g=glowny,z=zrodla;
    if(g){g.gain.cancelScheduledValues(t);g.gain.setTargetAtTime(0,t,ZC_PP.WYGASZ_S/3);}
    for(const x of z){try{x.src.stop(t+ZC_PP.WYGASZ_S*2);}catch(e){}}
    setTimeout(()=>{for(const x of z){try{x.src.disconnect();x.gn.disconnect();}catch(e){}}try{g&&g.disconnect();}catch(e){}},300);
    zrodla=[];glowny=null;gra=false;
  };
  if(typeof Glos!=="undefined"&&Glos.poGlosnosci)Glos.poGlosnosci(()=>{if(glowny)glowny.gain.setTargetAtTime(ZC_PP.POZIOM*mnPodkladu(),ctx.currentTime,.02);});
  return {
    start(pozS,bufory,glosnosci,r){
      stop();
      rate=r||1;const teraz=ctx.currentTime+ZC_PP.START_ZA_S;
      glowny=ctx.createGain();glowny.gain.value=ZC_PP.POZIOM*mnPodkladu();glowny.connect(cel);
      dlugosc=0;
      for(const k of Object.keys(bufory)){
        const buf=bufory[k],g=glosnosci[k]||0;if(!buf||!(g>0))continue;
        dlugosc=Math.max(dlugosc,buf.duration);
        if(pozS>=buf.duration)continue;
        const src=ctx.createBufferSource();src.buffer=buf;src.playbackRate.value=rate;
        const gn=ctx.createGain();gn.gain.value=g;src.connect(gn);gn.connect(glowny);
        src.start(pozS<0?teraz+(-pozS)/rate:teraz,Math.max(0,pozS));
        zrodla.push({k,src,gn});
      }
      t0=teraz;s0=pozS;gra=true;
      return t0;
    },
    stop,
    pozycja(t){return s0+((t==null?ctx.currentTime:t)-t0)*rate;},
    ustawGlosnosci(gl){const t=ctx.currentTime;for(const x of zrodla)x.gn.gain.setTargetAtTime(gl[x.k]||0,t,.02);},
    get gra(){return gra;},get dlugosc(){return dlugosc;},get rate(){return rate;}};
}
function ppZatrzymaj(){if(PP.odtw)PP.odtw.stop();PP.odtwG=null;}

// ---------------------------------------------------------------------------------------------
// ZEGAR GRY (wołany z krok() w zabi-chor.js): zwraca krok czasu gry w sekundach. Bez pakietu z audio nic nie zmienia.
function ppPakietGry(G){return G&&G.piosenka?PP.wpisy.get(G.piosenka.id)||null:null;}
function ppZegar(G,dt,wGrze,wymuszony){
  const P=ppPakietGry(G);
  if(!P||!P.audio||!wGrze||wymuszony){if(PP.odtw&&PP.odtw.gra)ppZatrzymaj();return dt;}
  const ctx=typeof Glos!=="undefined"?Glos.kontekstUI():null;
  if(!ctx||ctx.state!=="running")return dt;   // bez gestu użytkownika dźwięku nie ma, gra idzie swoim zegarem
  if(!ppGotowe(P)){if(!ppBrakujace(P).length)ppWczytajAudio(P.id);return dt;}   // nagranie jeszcze się wczytuje: dołączy w biegu
  const spb=60/G.bpm,fr=G.piosenka.fragment,m=G.metrum,rate=ppRate(G.bpm,P.tempoPliku);
  const cel=G.beat+dt/spb,poz=ppPozycja(cel,fr,m),sCel=P.sek(poz.q);
  if(!PP.odtw)PP.odtw=ppOdtwarzacz(ctx,(Glos.celUI&&Glos.celUI())||ctx.destination);
  const O=PP.odtw,start=powod=>{
    const gl=ppZlozUklad(P.uklad(),P.dostepne).audio,t0=O.start(sCel,P.bufory,gl,rate);PP.odtwG=G;
    console.info("RibbitBeat: audio pakietu "+powod+": "+sCel.toFixed(3)+" s nagrania (ćwierćnuta "+cel.toFixed(2)+
      ") o "+t0.toFixed(3)+" s zegara audio, szybkość "+rate.toFixed(3));
  };
  if(!O.gra||PP.odtwG!==G){start("start");return dt;}
  const pos=O.pozycja(ctx.currentTime);
  if(sCel>=O.dlugosc&&pos>=O.dlugosc)return dt;   // nagranie się skończyło: dalej (koniec piosenki) zegar gry
  const bA=ppBeat(P.q(pos),poz.powt,fr,m),blad=(bA-cel)*spb;
  if(Math.abs(blad)>ZC_PP.DRYF_S){start("przeskok o "+Math.round(blad*1000)+" ms");return dt;}
  return Math.max(0,(bA-G.beat)*spb);
}
// „Za ile sekund” zagrać nutę w ćwierćnucie b (planujDzwieki): przy grającym nagraniu przez mapę czasu, żeby nuty
// MIDI trafiały w rubato nagrania; w innej powtórce fragmentu i bez nagrania liniowo, jak dotąd. null = bez zmian.
function ppZa(G,spb){
  const P=ppPakietGry(G);if(!P||!P.audio||!PP.odtw||!PP.odtw.gra||PP.odtwG!==G)return null;
  const fr=G.piosenka.fragment,m=G.metrum,rate=PP.odtw.rate,a=ppPozycja(G.beat,fr,m),sA=P.sek(a.q);
  return b=>{const x=ppPozycja(b,fr,m);return x.powt===a.powt?(P.sek(x.q)-sA)/rate:(b-G.beat)*spb;};
}
// Głośności ścieżek MIDI z układu dla podkładu gry (raz na grę): 0 = nuta nieplanowana, pośrednie = ciszej.
// Partie śpiewane przez graczy nie są podkładem, więc ich to nie dotyczy. Tło (środek akordów) idzie z midi_chords.
function ppPodklad(G){
  if(!G||G._ppPodklad)return;G._ppPodklad=true;
  const P=ppPakietGry(G);if(!P||!P.audio)return;
  const midi=ppZlozUklad(P.uklad(),P.dostepne).midi;
  for(const pk of G.podklad){
    let k="midi_chords";
    if(pk.nuty!==G.piosenka.tlo){const p=G.piosenka.partie.find(x=>x.nuty===pk.nuty);if(p)k=ppKluczSciezki(p.nazwaSciezki);}
    const g=Math.min(1,midi[k]),baza=pk.poziom==null?1:pk.poziom;
    pk.poziom=g>0?baza*g:0;
  }
}

// ---------------------------------------------------------------------------------------------
// LOBBY: „Układ miksu” w kroku Rozgrywka (kolumna Ustawienia), tylko dla piosenki z pakietu z audio
function ppStyl(){
  if(PP.styl)return;PP.styl=true;
  const s=document.createElement("style");s.id="ppMiksStyl";
  s.textContent=".pp-miks{display:grid;grid-template-columns:1fr;row-gap:4px;margin:0 0 10px;padding:8px 10px;border-radius:12px;"+
    "background:var(--panel2,#f5eede);border:2px dashed var(--stitch,#d8cdb8)}"+
    ".pp-miks[hidden]{display:none}"+
    ".pp-miks-gora{display:flex;align-items:center;gap:8px;flex-wrap:wrap}"+
    ".pp-miks-plakietka{font:700 11px/1 var(--sans,system-ui);padding:3px 7px;border-radius:999px;background:var(--green-d,#46781f);color:#fff}"+
    ".pp-miks .lista{grid-column:1/-1}"+
    ".pp-miks-opis{margin:0;font:500 12px/1.35 var(--sans,system-ui);color:var(--muted,#524c3e)}"+
    ".pp-miks-uwaga{margin:0;font:600 12px/1.35 var(--sans,system-ui);color:var(--warn-ink,#8a5f0a)}"+
    ".pp-miks-stan{margin:0;font:500 11.5px/1.3 var(--sans,system-ui);color:var(--dim,#57503f)}"+
    ".pp-miks-stan.blad{color:var(--pink-d,#a4105c);font-weight:700}"+
    ".pp-miks-bladbox{display:flex;gap:8px;flex-wrap:wrap}.pp-miks-bladbox[hidden]{display:none}";
  document.head.append(s);
}
const ppTxt=(k,zm)=>typeof T!=="undefined"&&T[k]!=null?(zm?tt(k,zm):T[k]):k;
function ppNazwaUkladu(u){return u.wbudowany?ppTxt("ppNazwa_"+u.id):tt("ppWlasny",{nazwa:u.nazwa});}
function ppOpisUkladu(u,P){
  if(u.wbudowany)return ppTxt("ppOpis_"+u.id)+" "+ppTxt("ppMelodia_"+u.melodia_gracza);
  const gl=ppZlozUklad(u,P.dostepne),czesci=[];
  for(const k of PP_AUDIO)if(gl.audio[k]>0)czesci.push(ppTxt("ppZrodlo_"+k)+" "+Math.round(gl.audio[k]*100)+"%");
  for(const k of PP_MIDI)if(gl.midi[k]>0)czesci.push(ppTxt("ppZrodlo_"+k)+" "+Math.round(gl.midi[k]*100)+"%");
  return tt("ppOpisWlasny",{zrodla:czesci.join(", ")||"0%"})+" "+ppTxt("ppMelodia_"+u.melodia_gracza);
}
function ppPudelko(){
  let box=el("ppMiks");if(box)return box;
  const ust=el("ustawienia");if(!ust||!ust.parentNode)return null;
  ppStyl();
  box=h("div","pp-miks ust ust-lista");box.id="ppMiks";box.hidden=true;
  const gora=h("div","pp-miks-gora");
  const et=h("label","ust-etykieta",ppTxt("ppUklad"));et.htmlFor="ppMiksUklad";
  gora.title=ppTxt("pomocUkladyMiksu");   // pomoc: dwa zdania o układach miksu (T.pomocUkladyMiksu)
  gora.append(et,h("span","pp-miks-plakietka",ppTxt("zrodlo_piosenka")));
  const s=h("select","lista");s.id="ppMiksUklad";
  s.onchange=()=>{ppWybierz(PP.aktywny,s.value,true);s.blur();};
  // błąd pliku słyszalnego w układzie: dwie drogi, a start do tego czasu stoi (ppBlokadaStartu)
  const bladBox=h("div","pp-miks-bladbox");bladBox.hidden=true;
  const bez=h("button","przycisk maly",ppTxt("ppGrajBez"));bez.type="button";bez.id="ppMiksBez";
  bez.onclick=()=>ppPominBrakujace(PP.aktywny);
  const zmien=h("button","przycisk maly",ppTxt("ppZmienUklad"));zmien.type="button";
  zmien.onclick=()=>{const x=el("ppMiksUklad");if(x){x.focus();if(x.showPicker)try{x.showPicker();}catch(e){}}};
  bladBox.append(bez,zmien);
  box.append(gora,s,h("p","pp-miks-opis",""),h("p","pp-miks-uwaga",""),h("p","pp-miks-stan",""),bladBox);
  box.querySelector(".pp-miks-stan").setAttribute("role","status");
  ust.parentNode.insertBefore(box,ust);
  // tempo z suwaka zmienia szybkość nagrania: ostrzeżenie odświeża się przy każdym ruchu suwaka
  ust.addEventListener("input",()=>ppOdswiezOpis());
  return box;
}
function ppOsadzMiks(p){
  const box=ppPudelko();if(!box)return;
  const P=p?PP.wpisy.get(p.id):null;
  PP.aktywny=P&&P.audio?P.id:null;
  box.hidden=!PP.aktywny;
  if(!PP.aktywny)return;
  const s=el("ppMiksUklad");s.replaceChildren();
  for(const u of P.uklady){const o=h("option","",ppNazwaUkladu(u));o.value=u.id;s.append(o);}
  s.value=P.wybor;
  ppOdswiezOpis();
  ppWczytajAudio(P.id);
}
function ppOdswiezOpis(){
  const box=el("ppMiks"),P=PP.aktywny&&PP.wpisy.get(PP.aktywny);if(!box||!P)return;
  const u=P.uklad(),p=typeof piosenka==="function"?piosenka():null;
  let opis=ppOpisUkladu(u,P);
  if(!PP_STEMY.some(k=>P.dostepne[k]))opis+=" "+ppTxt("ppBrakStemow");
  box.querySelector(".pp-miks-opis").textContent=opis;
  const bpm=p&&typeof S!=="undefined"?p.tempo*S.ust.tempo/100:P.tempoPliku;
  const r=ppRate(bpm,P.tempoPliku),uw=box.querySelector(".pp-miks-uwaga");
  uw.textContent=Math.abs(r-1)>.005&&ppPotrzebne(P).length?ppTxt("ppTempoUwaga"):"";uw.hidden=!uw.textContent;
  ppOdswiezStan();
}
function ppOdswiezStan(){
  const box=el("ppMiks"),P=PP.aktywny&&PP.wpisy.get(PP.aktywny);if(!box||!P)return;
  const st=box.querySelector(".pp-miks-stan"),pot=ppPotrzebne(P),brak=ppBrakujace(P);
  st.classList.toggle("blad",brak.length>0);
  box.querySelector(".pp-miks-bladbox").hidden=!brak.length;
  if(brak.length)st.textContent=tt("ppAudioBlad",{powod:brak.map(k=>P.bledy[k]).join(" ")});
  else if(!pot.length)st.textContent="";
  else if(ppGotowe(P))st.textContent=ppTxt("ppAudioGotowe");
  else{const pr=pot.reduce((s,k)=>s+(P.bufory[k]?1:(P.postep[k]||0)),0)/pot.length;
    st.textContent=tt("ppAudioWczytuje",{procent:Math.round(pr*100)});}
  st.hidden=!st.textContent;
}
// „Graj bez tego źródła”: pliki z błędem w tym układzie milkną, reszta gra; start znów dozwolony.
function ppPominBrakujace(id){
  const P=PP.wpisy.get(id);if(!P)return;
  for(const k of ppBrakujace(P))P.pominiete[k]=true;
  ppOdswiezStan();
}
// Tekst blokady startu (przycisk startu w kroku Rozgrywka) albo null: słyszalny plik się nie wczytał i nie jest pominięty.
function ppBlokadaStartu(p){
  const P=p?PP.wpisy.get(p.id):null;if(!P||!P.audio)return null;
  const brak=ppBrakujace(P);
  return brak.length?tt("ppStartBlokada",{plik:brak.map(k=>ppNazwaPliku(P,k)).join(", ")}):null;
}
// Wybór układu: od razu w grze (głośności grającego nagrania), zapis w miks.json pakietu (POST piosenki/miks).
function ppWybierz(id,uklad,zapisz){
  const P=PP.wpisy.get(id);if(!P||!P.uklady.some(u=>u.id===uklad))return false;
  P.wybor=uklad;
  if(PP.odtw&&PP.odtw.gra&&PP.odtwG&&PP.odtwG.piosenka.id===id)PP.odtw.ustawGlosnosci(ppZlozUklad(P.uklad(),P.dostepne).audio);
  ppOdswiezOpis();ppWczytajAudio(id);
  if(zapisz)ppApi("piosenki/miks",{slug:P.slug,uklad_domyslny:uklad})
    .then(j=>{P.miks=j.miks||P.miks;},e=>{if(typeof toast==="function")toast(tt("ppZapisBlad",{powod:e.message}),true);});
  return true;
}

const PakietPiosenki={lista:ppLista,wczytaj:ppWczytaj,powiaz:ppPowiaz,wczytajAudio:ppWczytajAudio,
  zegar:ppZegar,za:ppZa,podklad:ppPodklad,zatrzymaj:ppZatrzymaj,osadzMiks:ppOsadzMiks,wybierz:ppWybierz,
  blokadaStartu:ppBlokadaStartu,pominBrakujace:ppPominBrakujace,opisBledu:ppOpisBledu,
  pakiet:id=>PP.wpisy.get(id)||null,
  // odtwarzacz w języku ćwierćnut gry: start(ćwierćnuta) liczy pozycję nagrania z mapy czasu pakietu
  odtwarzacz:id=>{const P=PP.wpisy.get(id);if(!P)return null;
    return {start:(beat,bpm)=>{const ctx=Glos.odblokuj();if(!ctx)return null;if(!PP.odtw)PP.odtw=ppOdtwarzacz(ctx,(Glos.celUI&&Glos.celUI())||ctx.destination);
        return PP.odtw.start(P.sek(beat),P.bufory,ppZlozUklad(P.uklad(),P.dostepne).audio,ppRate(bpm||P.tempoPliku,P.tempoPliku));},
      stop:ppZatrzymaj,ustawGlosnosci:u=>PP.odtw&&PP.odtw.ustawGlosnosci(ppZlozUklad(u||P.uklad(),P.dostepne).audio)};},
  stan:()=>({dostepne:PP.dostepne,lista:PP.lista.map(x=>x.slug),aktywny:PP.aktywny,
    gra:!!(PP.odtw&&PP.odtw.gra),pozycja:PP.odtw&&PP.odtw.gra?+PP.odtw.pozycja().toFixed(3):null,
    wpisy:[...PP.wpisy.values()].map(P=>({id:P.id,slug:P.slug,wybor:P.wybor,gotowe:ppGotowe(P),bufory:Object.keys(P.bufory),bledy:Object.assign({},P.bledy),pominiete:Object.keys(P.pominiete)}))}),
  _PP:PP};
