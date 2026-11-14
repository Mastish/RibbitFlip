"use strict";
// ===== PadSampler: własna próbka brzmienia (Synth › Biblioteka dźwięków › Próbka, 2026-10-19) =====
// Samplowanie audio (nagranie albo dogranie), to samo w studiu gry i w RibbitFlip.
// Brzmienie może zamiast oscylatorów grać NAGRANIE: z mikrofonu albo
// z pliku na dysku (także upuszczonego na kartę). Nuta rozciąga je w górę i w dół, filtr, obwiednia i efekty
// działają jak zwykle, bo próbka wchodzi dokładnie tam, gdzie wchodziłyby oscylatory (rf-21 `_mkVoice`).
//
// 2026-10-20: użytkownik dostał większą
// kontrolę nad próbką: nagranie przestało być czymś, co się bierze takie, jakie wyszło. Karta ma teraz WYCINEK (start
// i koniec, przeciągane po przebiegu), poziom, dostrojenie w centach, grę wstecz, zlepek szwu pętli, „nie
// przestrajaj”, wybór mikrofonu z podsłuchem i odliczaniem oraz zapis próbki do pliku WAV. Wszystko to są
// NASTAWY W BRZMIENIU, nie zmiany bajtów: da się je cofnąć, a kopia brzmienia ma własne, choć dzieli te
// same bajty. Jedyne, co rusza bajty, to „Przytnij na stałe” — i to pod wyraźnym przyciskiem.
//
// OBRÓBKA DŹWIĘKU JEST WSPÓLNA Z GRĄ: js/probki-audio.js (`ProbkiAudio`) — nagrywanie, dekodowanie, granice
// ciszy, wycinek z poziomem i zlepkiem, wykrycie stroju i format WAV. Jeden plik, dwa programy, żeby
// samplowanie w panelu i w Studiu instrumentów RibbitBeat brzmiało tak samo. Tu zostaje to, co w panelu
// jest inne:
//
//   • MAGAZYN: `Library/Probki/<id>.wav` na serwerze (trasy /synth-probki, /synth-probka). Patch niesie sam
//     identyfikator, bo stan syntezatora ma 500 kB limitu, a jedna próbka to kilkaset kB; w `Library/`, bo to
//     zbiór, który człowiek kopiuje i przenosi, a nie żywy stan aplikacji. Bajty dojeżdżają PO starcie panelu,
//     więc do tego czasu (i gdy pliku nie ma) brzmienie gra głosem zastępczym z oscylatorów — tak samo, jak
//     instrument Krzyk w grze przed wczytaniem swoich WAV-ów.
//   • WSZYSTKIE NASTAWY SĄ W PATCHU (`smpRoot`, `smpCent`, `smpOd`, `smpDo`, `smpPoziom`, `smpWstecz`,
//     `smpLoop`, `smpZlep`, `smpStaly`), nie przy bajtach: duplikat brzmienia dzieli jedne bajty i ma własne
//     ustawienia, a pliku nie trzeba kopiować.
//   • AudioBuffer liczony leniwie, osobno dla każdego kontekstu, a w kluczu siedzi numer wersji bajtów ORAZ
//     odcisk nastaw — ten sam plik z innym wycinkiem to inny bufor, a ponowne nagranie pod tym samym id musi
//     unieważnić to, co stoi w pamięci podręcznej.
//
// Ładowany PO rf-25 (opakowuje `readEditorPatch`, `_setFormFromPatch` i `_seSyncLabels` przez wywołania, które
// tamten plik już robi) i PO js/probki-audio.js.
const PadSampler={
  _mem:new Map(),           // id → {dane:Float32Array, sr, v} — BAJTY, zawsze całe nagranie
  _bufs:new WeakMap(),      // AudioContext → {klucze:{…}, kolejka:[…]} — bufory „do grania” (wycinek już w nich jest)
  _ids:[],                  // co leży na serwerze
  _listed:false,            // …i czy w ogóle zdążyliśmy go o to zapytać (patrz `sweep`)
  _ready:null,_inited:false,
  _urz:[],_mon:false,
  MAX_BUF:6,                // ile wariantów nastaw trzyma kontekst: kręcenie pokrętłem robi nowy bufor za każdym razem
  A(){return typeof ProbkiAudio!=="undefined"?ProbkiAudio:null;},

  // ---------------- magazyn ----------------
  _json(url,body){
    const o=body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:undefined;
    return fetch(url,o).then(r=>r.json()).catch(()=>null);   // brak serwera = brak próbek, nie wywalony panel
  },
  get(id){return this._mem.get(id)||null;},
  has(id){return this._mem.has(id);},
  // patch → nastawy dla ProbkiAudio.wytnij. Jedno miejsce, w którym klucze patcha zamieniają się w sekundy,
  // więc pad, odsłuch, przebieg i zapis do pliku liczą wycinek dokładnie tak samo.
  edycja(p){
    p=p||{};
    return {od:+p.smpOd||0,koniec:+p.smpDo||0,poziom:p.smpPoziom==null?1:+p.smpPoziom,
      wstecz:p.smpWstecz===true,zlep:+p.smpZlep||0,
      petla:(Array.isArray(p.smpLoop)&&p.smpLoop.length===2)?[+p.smpLoop[0],+p.smpLoop[1]]:null};
  },
  _odcisk(e){return [e.od,e.koniec,e.poziom,e.wstecz?1:0,e.zlep,e.petla?e.petla[0]+":"+e.petla[1]:""].join("|");},
  // Bufor do grania dla tego patcha i tego kontekstu: bajty przepuszczone przez `wytnij`, więc wycinek, poziom,
  // kierunek i zlepek szwu są już w nich. Wraca też pętla — PRZELICZONA NA TEN BUFOR, bo wycinek przesuwa zero.
  // Pamięć podręczna ma sufit (MAX_BUF na kontekst) i wyrzuca najdawniej używany: kręcenie pokrętłem wycinka
  // robi nowy bufor przy każdym ruchu, a 12-sekundowa próbka to 1,5 MB w AudioBufferze.
  graj(ctx,p){
    const A=this.A(),id=p&&p.smp,s=id?this._mem.get(id):null;
    if(!A||!s||!ctx||!s.dane.length)return null;
    let m=this._bufs.get(ctx);if(!m){m={k:{},q:[]};this._bufs.set(ctx,m);}
    const e=this.edycja(p),klucz=id+"#"+s.v+"#"+this._odcisk(e);
    if(!m.k[klucz]){
      const w=A.wytnij(s,e);if(!w||!w.dane.length)return null;
      let buf=null;
      try{buf=ctx.createBuffer(1,w.dane.length,w.sr);buf.copyToChannel(w.dane,0);}catch(err){return null;}
      m.k[klucz]={buf,petla:w.petla};m.q.push(klucz);
      while(m.q.length>this.MAX_BUF){const stary=m.q.shift();if(stary!==klucz)delete m.k[stary];}
    }else{const i=m.q.indexOf(klucz);if(i>=0){m.q.splice(i,1);m.q.push(klucz);}}
    return m.k[klucz];
  },
  _put(id,prob){
    const old=this._mem.get(id);
    this._mem.set(id,{dane:prob.dane,sr:prob.sr,v:(old?old.v:0)+1});
    if(!this._ids.includes(id))this._ids.push(id);
  },
  load(id){
    const A=this.A();if(!A||!id||this._mem.has(id))return Promise.resolve(this.get(id));
    return fetch("/synth-probka?id="+encodeURIComponent(id))
      .then(r=>r.ok?r.arrayBuffer():null).then(ab=>{
        const w=ab?A.zWav(ab):null;
        if(w&&w.dane.length)this._put(id,w);
        return this.get(id);
      }).catch(()=>null);
  },
  // identyfikatory próbek, do których jest jeszcze brzmienie (własne, nadpisane bazowe albo to w formularzu)
  // Próbka usuniętego brzmienia czeka na dysku tyle, ile trwa „Cofnij” (25 s, rfUndo w rf-06), a dopiero potem
  // sprzątanie ją zabiera: zapis innego brzmienia w tym czasie woła `sweep`, który skasowałby plik spod cofnięcia.
  _held:new Set(),HOLD_MS:25500,
  hold(id){if(!id)return;this._held.add(id);clearTimeout(this._holdT);
    this._holdT=setTimeout(()=>{this._held.clear();this.sweep();},this.HOLD_MS);},
  used(){
    const s=new Set(this._held);
    try{
      for(const k in (XPAD.customSounds||{})){const p=XPAD.customSounds[k];if(p&&p.patch&&p.patch.smp)s.add(p.patch.smp);}
      for(const k in (XPAD.baseOverrides||{})){const o=XPAD.baseOverrides[k];if(o&&o.patch&&o.patch.smp)s.add(o.patch.smp);}
      const el=document.getElementById("seSmpId");if(el&&el.value)s.add(el.value);
      if(XPAD._editSrcPatch&&XPAD._editSrcPatch.smp)s.add(XPAD._editSrcPatch.smp);
    }catch(e){}
    return [...s];
  },
  // Start panelu: lista z serwera i bajty tych próbek, których szukają brzmienia. Sprzątanie osieroconych
  // plików NIE jedzie stąd: zaraz po starcie stan syntezatora może jeszcze dojeżdżać (rf-20b `padLoadAsync`),
  // a sprzątanie na niepełnej liście skasowałoby próbkę brzmienia, którego panel jeszcze nie wczytał.
  ensure(){
    if(this._ready)return this._ready;
    this._ready=this._json("/synth-probki").then(j=>{
      if(j&&Array.isArray(j.ids)){this._ids=j.ids.slice();this._listed=true;}
      return Promise.all(this.used().filter(id=>this._ids.includes(id)).map(id=>this.load(id)));
    }).then(()=>{this.sync();return true;},()=>true);
    return this._ready;
  },
  save(id,prob){
    const A=this.A();if(!A)return Promise.resolve(false);
    this._put(id,prob);
    return this._json("/synth-probka",{id,wav:A.b64(A.doWav(prob))}).then(j=>{
      if(j&&Array.isArray(j.ids))this._ids=j.ids.slice();
      return !!(j&&j.ok);
    });
  },
  drop(id){
    this._mem.delete(id);this._ids=this._ids.filter(x=>x!==id);
    return this._json("/synth-probka/delete",{id}).then(()=>true);
  },
  // Sieroty: pliki, do których nie ma już brzmienia (nagranie bez zapisu, usunięte brzmienie). Wołane z rąk
  // człowieka (zapis, usunięcie brzmienia), nigdy przy starcie — patrz `ensure`.
  // PUSTA lista jest poprawną odpowiedzią („żadne brzmienie nie ma próbki"), ale tylko wtedy, gdy wiemy, co w ogóle
  // leży na serwerze. Zanim się tego dowiemy, sprzątanie jest odmową: lista byłaby zgadywana, a serwer skasowałby
  // po niej pliki, które jeszcze mają właściciela.
  sweep(){
    if(!this._listed)return Promise.resolve(0);
    return this._json("/synth-probka/delete",{keep:this.used()}).then(j=>{
      if(j&&Array.isArray(j.ids))this._ids=j.ids.slice();
      return true;
    });
  },

  // ---------------- formularz ----------------
  _el(id){return typeof document!=="undefined"?document.getElementById(id):null;},
  _v(id,d){const e=this._el(id);const n=e?+e.value:NaN;return isFinite(n)?n:d;},
  _set(id,v){const e=this._el(id);if(e)e.value=String(v);},
  _chk(id){const e=this._el(id);return !!(e&&e.checked);},
  _ustawChk(id,on){const e=this._el(id);if(e)e.checked=!!on;},
  id(){const e=this._el("seSmpId");return e?String(e.value||""):"";},
  // Długość CAŁYCH bajtów w sekundach. Procenty na pokrętłach liczą się od niej, bo przebieg pokazuje całe
  // nagranie — wycinek jest na nim zacieniowaniem, nie nowym układem współrzędnych.
  sek(){const n=this._v("seSmpLen",0),sr=this._v("seSmpSr",32000);return sr>0?n/sr:0;},
  _pct(id,d){return Math.max(0,Math.min(100,this._v(id,d)));},
  // formularz → patch (woła readEditorPatch w rf-25, jak SoundEditors.readInto)
  readInto(p){
    const id=this.id();if(!id)return p;
    p.smp=id;p.smpSr=this._v("seSmpSr",32000);p.smpLen=this._v("seSmpLen",0);
    p.smpRoot=this._v("seSmpRoot",60);
    const cent=Math.round(this._v("seSmpCent",0));if(cent)p.smpCent=cent;
    const sek=this.sek();
    // wycinek: tylko to, co coś znaczy — start od zera i koniec na końcu to brak klucza (patrz sanitizePatch)
    const a=Math.min(this._pct("seSmpStart",0),99.5),b=Math.max(a+.5,this._pct("seSmpEnd",100));
    if(sek>0){
      if(a>0)p.smpOd=+(a/100*sek).toFixed(4);
      if(b<100)p.smpDo=+(b/100*sek).toFixed(4);
    }
    const poz=Math.round(this._v("seSmpLvl",1)*100)/100;if(poz!==1)p.smpPoziom=poz;
    if(this._chk("seSmpRev"))p.smpWstecz=true;
    if(this._chk("seSmpFix"))p.smpStaly=true;
    if(this._chk("seSmpLoop")&&sek>0){
      const od=Math.max(0,Math.min(99.5,this._pct("seSmpFrom",10))),do_=Math.max(od+.5,Math.min(100,this._pct("seSmpTo",60)));
      p.smpLoop=[+(od/100*sek).toFixed(4),+(do_/100*sek).toFixed(4)];
      const zl=Math.round(this._v("seSmpGlue",20));if(zl>0)p.smpZlep=+(zl/1000).toFixed(4);
    }
    return p;
  },
  // patch → formularz (woła _setFormFromPatch w rf-25)
  setForm(p){
    p=p||{};
    const id=typeof p.smp==="string"?p.smp:"";
    this._set("seSmpId",id);this._set("seSmpSr",p.smpSr==null?32000:p.smpSr);this._set("seSmpLen",p.smpLen==null?0:p.smpLen);
    this._set("seSmpRoot",p.smpRoot==null?60:p.smpRoot);
    this._set("seSmpCent",p.smpCent==null?0:p.smpCent);
    this._set("seSmpLvl",p.smpPoziom==null?1:p.smpPoziom);
    this._ustawChk("seSmpRev",p.smpWstecz===true);this._ustawChk("seSmpFix",p.smpStaly===true);
    const sek=this.sek();
    const naPct=(v,d)=>sek>0&&Number.isFinite(+v)?Math.max(0,Math.min(100,Math.round(+v/sek*1000)/10)):d;
    this._set("seSmpStart",p.smpOd==null?0:naPct(p.smpOd,0));
    this._set("seSmpEnd",p.smpDo==null?100:naPct(p.smpDo,100));
    const loop=Array.isArray(p.smpLoop)&&p.smpLoop.length===2&&sek>0;
    this._ustawChk("seSmpLoop",loop);
    this._set("seSmpFrom",loop?naPct(p.smpLoop[0],10):10);
    this._set("seSmpTo",loop?naPct(p.smpLoop[1],60):60);
    this._set("seSmpGlue",loop?Math.round((+p.smpZlep||0)*1000):20);
    if(id&&!this._mem.has(id))this.load(id).then(()=>this.sync());
    this.sync();
    // Suwaki są pokrętłami (rf-knob): wartość wpisana tu „za ich plecami” nie obróciłaby tarczy. `_setFormFromPatch`
    // woła `_seSyncLabels` (czyli KnobUI.syncAll) PRZED nami, więc tarcze trzeba odświeżyć jeszcze raz — inaczej
    // karta pokazuje pętlę poprzedniego brzmienia, a przebieg tę właściwą.
    if(window.KnobUI)KnobUI.syncAll();
  },
  // widoczność, podpisy i przebieg (woła _seSyncLabels w rf-25, po każdej zmianie suwaka)
  sync(){
    const box=this._el("soundEditor");if(!box)return;
    const id=this.id(),dane=id?this.get(id):null,loop=this._chk("seSmpLoop"),staly=this._chk("seSmpFix");
    for(const [a,b] of [["seSmpRoot","seSmpRootV"],["seSmpCent","seSmpCentV"],["seSmpStart","seSmpStartV"],
      ["seSmpEnd","seSmpEndV"],["seSmpFrom","seSmpFromV"],["seSmpTo","seSmpToV"],["seSmpGlue","seSmpGlueV"]]){
      const el=this._el(a),out=this._el(b);if(el&&out)out.textContent=el.value;}
    const lv=this._el("seSmpLvlV");if(lv)lv.textContent=(+this._v("seSmpLvl",1)).toFixed(2);
    const nutaEl=this._el("seSmpNote");if(nutaEl)nutaEl.textContent=this.nazwaNuty(Math.round(this._v("seSmpRoot",60)));
    const pokaz=(sel,on)=>box.querySelectorAll(sel).forEach(e=>{e.hidden=!on;});
    pokaz(".se-smp-have",!!id);pokaz(".se-smp-none",!id);pokaz(".se-smp-loop",!!id&&loop);
    pokaz(".se-smp-tune",!!id&&!staly);   // „nie przestrajaj” wyłącza strój: nuta nie rusza tempa, więc nie ma co stroić
    for(const b of ["seSmpPlay","seSmpDetect","seSmpTrim","seSmpBake","seSmpSave","seSmpDel"]){const e=this._el(b);if(e)e.disabled=!dane;}
    const st=this._el("seSmpInfo");
    if(st)st.textContent=!id?"":(dane?this._opis():_gl("Wczytuję próbkę…","Loading the sample…"));
    box.classList.toggle("se-is-smp",!!id);   // CSS przygasza kartę oscylatorów: z próbką fale nie grają
    this.draw();
  },
  // Wiersz stanu mówi to, czego nie widać na pokrętłach: skąd próbka, ile trwa CAŁA, ile trwa WYCINEK (bo to
  // on gra) i którą nutę słychać — albo że nic nie przestraja.
  // sekundy po ludzku: krótki wycinek w milisekundach, bo „0,0 s” wygląda jak awaria, a nie jak 15 ms
  _czas(s){return s<1?Math.round(s*1000)+" ms":(Math.round(s*10)/10).toFixed(1)+" s";},
  _opis(){
    const sek=this.sek(),w=this._wycinek(),staly=this._chk("seSmpFix");
    const dl=Math.abs(w.b-w.a-sek)<.05?this._czas(sek):this._czas(w.b-w.a)+" "+_gl("z","of")+" "+this._czas(sek);
    const nuta=staly?_gl("bez przestrajania","no re-tuning")
      :_gl("nuta","note")+" "+this.nazwaNuty(Math.round(this._v("seSmpRoot",60)))+this._centy();
    return this._zrodlo()+" · "+dl+" · "+nuta+(this._chk("seSmpRev")?" · "+_gl("wstecz","reversed"):"");
  },
  _centy(){const c=Math.round(this._v("seSmpCent",0));return c?(c>0?" +":" ")+c+" ct":"";},
  // wycinek w sekundach (a, b) — prosto z pokręteł, bez patcha
  _wycinek(){
    const sek=this.sek();if(!(sek>0))return {a:0,b:0};
    const a=Math.min(this._pct("seSmpStart",0),99.5)/100*sek,b=Math.max(a+.001,this._pct("seSmpEnd",100)/100*sek);
    return {a,b:Math.min(sek,b)};
  },
  _zrodlo(){const e=this._el("seSmpSrc");return e&&e.value==="mic"?_gl("nagranie","recording"):_gl("plik","file");},
  NUTY:["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"],
  nazwaNuty(m){return this.NUTY[((m%12)+12)%12]+(Math.floor(m/12)-1);},

  // ---------------- przebieg na kanwie ----------------
  // Obwiednia min–max na kolumnę piksela, poziom widać na wysokości fali, a wycinek i pętla są NA przebiegu,
  // nie pod nim: głośna próbka zamalowuje całą kanwę, więc zacieniowane jest to, co NIE zagra — wtedy widać,
  // który kawałek zostanie, kiedy trzymasz nutę. Cztery znaczniki (start, koniec, pętla od, pętla do) mają
  // uchwyty u góry i dają się przeciągać; który jest który, mówi kolor (wycinek biały, pętla bursztynowa).
  MARK:{start:"#e9ecf2",koniec:"#e9ecf2",od:"#e8b23a",do:"#e8b23a"},
  draw(){
    const k=this._el("seSmpWave");if(!k||k.hidden)return;
    const id=this.id(),s=id?this.get(id):null;
    const sz=Math.max(1,Math.min(3,window.devicePixelRatio||1));
    const szer=Math.max(80,Math.round(k.clientWidth||320)),wys=Math.max(40,Math.round(k.clientHeight||80));
    if(k.width!==Math.round(szer*sz)||k.height!==Math.round(wys*sz)){k.width=Math.round(szer*sz);k.height=Math.round(wys*sz);}
    const c=k.getContext("2d");if(!c)return;
    c.setTransform(sz,0,0,sz,0,0);c.clearRect(0,0,szer,wys);
    const tlo=getComputedStyle(k).getPropertyValue("--smp-bg").trim()||"#15171c";
    c.fillStyle=tlo;c.fillRect(0,0,szer,wys);
    if(!s||!s.dane.length){c.setTransform(1,0,0,1,0,0);return;}
    const d=s.dane,n=d.length,sr2=wys/2,sek=this.sek(),poz=Math.max(.1,this._v("seSmpLvl",1));
    c.strokeStyle="rgba(255,255,255,.16)";c.lineWidth=1;c.beginPath();c.moveTo(0,sr2);c.lineTo(szer,sr2);c.stroke();
    c.fillStyle=getComputedStyle(k).getPropertyValue("--smp-fg").trim()||"#5ad1c0";
    for(let x=0;x<szer;x++){
      const a=Math.floor(x*n/szer),b=Math.max(a+1,Math.floor((x+1)*n/szer));
      let lo=1,hi=-1;for(let i=a;i<b&&i<n;i++){const v=d[i];if(v<lo)lo=v;if(v>hi)hi=v;}
      if(hi<lo)continue;
      const y1=sr2-Math.max(-1,Math.min(1,hi*poz))*sr2*.92,y2=sr2-Math.max(-1,Math.min(1,lo*poz))*sr2*.92;
      c.fillRect(x,y1,1,Math.max(1,y2-y1));
    }
    if(!(sek>0)){c.setTransform(1,0,0,1,0,0);return;}
    const px=t=>Math.max(0,Math.min(szer,t/sek*szer));
    const w=this._wycinek();
    // poza wycinkiem: mocny cień, bo to się NIE odtworzy
    c.fillStyle="rgba(10,12,16,.72)";
    c.fillRect(0,0,px(w.a),wys);c.fillRect(px(w.b),0,szer-px(w.b),wys);
    const znaki=[["start",w.a],["koniec",w.b]];
    if(this._chk("seSmpLoop")){
      const p=this._petla();
      c.fillStyle="rgba(232,178,58,.14)";c.fillRect(px(p.a),0,px(p.b)-px(p.a),wys);
      const ak=getComputedStyle(k).getPropertyValue("--smp-loop").trim()||"#e8b23a";
      c.fillStyle=ak;c.fillRect(px(p.a),0,px(p.b)-px(p.a),3);c.fillRect(px(p.a),wys-3,px(p.b)-px(p.a),3);
      znaki.push(["od",p.a],["do",p.b]);
    }
    for(const [kt,t] of znaki){
      const x=Math.max(1,Math.min(szer-1,px(t)));
      c.strokeStyle=this.MARK[kt];c.lineWidth=2;c.beginPath();c.moveTo(x,0);c.lineTo(x,wys);c.stroke();
      c.fillStyle=this.MARK[kt];                       // uchwyt: trójkąt u góry, żeby było co złapać myszą
      c.beginPath();c.moveTo(x-5,0);c.lineTo(x+5,0);c.lineTo(x,8);c.closePath();c.fill();
    }
    if(this._chk("seSmpRev")){                         // strzałka „gra wstecz”, bo przebieg zostaje normalny
      c.fillStyle="rgba(255,255,255,.55)";c.font="700 10px system-ui,sans-serif";c.textAlign="right";
      c.fillText("◀ "+_gl("wstecz","reversed"),szer-6,wys-7);c.textAlign="left";
    }
    c.setTransform(1,0,0,1,0,0);
  },
  // pętla w sekundach, przycięta do wycinka: znacznik pętli poza wycinkiem nic nie znaczy
  _petla(){
    const w=this._wycinek(),sek=this.sek();
    let a=this._pct("seSmpFrom",10)/100*sek,b=this._pct("seSmpTo",60)/100*sek;
    a=Math.max(w.a,Math.min(w.b,a));b=Math.max(a,Math.min(w.b,b));
    return {a,b};
  },
  // Przeciąganie znaczników: łapiemy najbliższy w promieniu 12 px. Kolejność sprawdzania zaczyna się od pętli,
  // bo jej znaczniki leżą W ŚRODKU wycinka i inaczej nie dałoby się ich złapać tam, gdzie stykają się z jego
  // brzegiem. Każdy znacznik pilnuje swoich sąsiadów, więc nie da się przeciągnąć końca przed początek.
  _znacz(x,szer){
    const sek=this.sek();if(!(sek>0))return null;
    const w=this._wycinek(),lista=[];
    if(this._chk("seSmpLoop")){const p=this._petla();lista.push(["seSmpFrom",p.a],["seSmpTo",p.b]);}
    lista.push(["seSmpStart",w.a],["seSmpEnd",w.b]);
    let naj=null,najD=13;
    for(const [pole,t] of lista){const d=Math.abs(t/sek*szer-x);if(d<najD){najD=d;naj=pole;}}
    return naj;
  },
  // Najmniejszy odstęp między znacznikami, liczony W CZASIE, nie w procentach: 0,5 % trzysekundowego nagrania
  // to 15 ms, czyli mniej niż MIN_PROBEK — wycinek dałby trzask, a wiersz stanu „0,0 s”.
  _luka(){
    const A=this.A(),sek=this.sek();
    return (A&&sek>0)?Math.max(.5,Math.ceil(A.MIN_PROBEK/A.SR/sek*1000)/10):.5;
  },
  _ciagnij(pole,x,szer){
    const sek=this.sek();if(!(sek>0))return;
    let pct=Math.max(0,Math.min(100,Math.round(x/szer*1000)/10));
    const g=(id,d)=>this._pct(id,d),m=this._luka();
    if(pole==="seSmpStart")pct=Math.min(pct,g("seSmpEnd",100)-m);
    else if(pole==="seSmpEnd")pct=Math.max(pct,g("seSmpStart",0)+m);
    else if(pole==="seSmpFrom")pct=Math.max(g("seSmpStart",0),Math.min(pct,Math.min(g("seSmpTo",60)-m,g("seSmpEnd",100)-m)));
    else if(pole==="seSmpTo")pct=Math.min(g("seSmpEnd",100),Math.max(pct,Math.max(g("seSmpFrom",10)+m,g("seSmpStart",0)+m)));
    this._set(pole,Math.max(0,Math.min(100,Math.round(pct*10)/10)));
    if(window.KnobUI)KnobUI.syncAll();
    if(typeof _seSyncLabels==="function")_seSyncLabels();
    if(typeof labParamChanged==="function")labParamChanged();
  },

  // ---------------- wejścia: mikrofon i plik ----------------
  BLAD:{zgoda:["Nie ma zgody na mikrofon. Pozwól na niego w przeglądarce i kliknij „Nagraj” jeszcze raz.",
               "No microphone permission. Allow it in the browser and click “Record” again."],
        brak:["Nie widzę tego mikrofonu. Wybierz inny z listy albo podłącz go i spróbuj znowu.",
              "I can't see that microphone. Pick another one from the list, or plug it in and try again."],
        zajetymik:["Mikrofon jest zajęty przez inny program. Zamknij go i spróbuj znowu.",
                   "Another program is using the microphone. Close it and try again."],
        nieobslugiwane:["Ta przeglądarka nie umie nagrywać. Wczytaj dźwięk z pliku.","This browser can't record. Load a sound from a file instead."],
        zajete:["Chwila — mikrofon jest już otwarty.","One moment — the microphone is already open."],
        krotkie:["Za krótkie nagranie. Potrzymaj przycisk chwilę dłużej.","The recording is too short. Hold the button a moment longer."],
        cisza:["W tym nagraniu jest sama cisza.","There is nothing but silence in this recording."],
        format:["Nie umiem odczytać tego dźwięku. Spróbuj plikiem WAV, MP3, OGG albo M4A.","I can't read this sound. Try a WAV, MP3, OGG or M4A file."],
        duzy:["Ten plik jest za duży.","This file is too big."],
        blad:["Nie udało się przygotować próbki.","Couldn't prepare the sample."]},
  _blad(k){const b=this.BLAD[k]||this.BLAD.blad;_seMsg(_gl(b[0],b[1]),false);},
  ctx(){try{return PadAudio.ensure()?(PadAudio.resume(),PadAudio.ctx):null;}catch(e){return null;}},
  // Nowa próbka ZAWSZE dostaje nowy id: stare bajty mogą jeszcze należeć do zapisanej wersji tego brzmienia
  // (anulowana edycja ma do czego wrócić) albo do jego duplikatu. Osierocone pliki sprząta `sweep()` przy zapisie.
  //
  // BAJTY IDĄ NA PEŁNĄ SKALĘ (`normalizuj`), ale to NIE jest decyzja o głośności: o niej mówi pokrętło poziomu,
  // które dostaje 1,00× przy „Wyrównaj poziom” i szczyt oryginału przy „zostaw jak jest”. Nagranie zrobione
  // cicho zostaje więc ciche, jeśli ktoś tak chce, a mimo to nie traci rozdzielczości w PCM16.
  przyjmij(w,zMikrofonu){
    const A=this.A();if(!A)return;
    const t=w&&w.dane?A.normalizuj(w.dane,w.sr):null;
    if(!t){this._blad("cisza");return;}
    const id=A.nowyId(),dl=t.dane.length/t.sr;
    this._set("seSmpId",id);this._set("seSmpSr",t.sr);this._set("seSmpLen",t.dane.length);
    this._set("seSmpSrc",zMikrofonu?"mic":"file");
    // Wycinek: nagranie z mikrofonu dostaje granice ciszy (między kliknięciem a wzięciem oddechu zawsze coś jest),
    // plik z dysku całość — tam cisza na początku może być częścią dźwięku. W obu wypadkach to ZNACZNIKI,
    // więc „Przytnij ciszę” da się cofnąć, przeciągając je z powrotem na brzegi.
    let a=0,b=dl;
    if(zMikrofonu){const g=A.granice(t.dane,t.sr);if(g){a=g.od/t.sr;b=g.koniec/t.sr;}}
    this._set("seSmpStart",Math.round(a/dl*1000)/10);this._set("seSmpEnd",Math.round(b/dl*1000)/10);
    this._set("seSmpLvl",this._chk("seSmpNorm")?1:Math.max(.1,Math.min(2,Math.round(t.szczyt/A.SZCZYT*100)/100)));
    this._ustawChk("seSmpLoop",false);this._ustawChk("seSmpRev",false);this._ustawChk("seSmpFix",false);
    this._set("seSmpFrom",10);this._set("seSmpTo",60);this._set("seSmpGlue",20);this._set("seSmpCent",0);
    const r=A.wykryjRoot(t.dane.subarray(Math.round(a*t.sr),Math.round(b*t.sr)),t.sr);
    this._set("seSmpRoot",r==null?60:Math.max(24,Math.min(96,Math.round(r*2)/2)));
    // Strój trafia na pół tonu, a resztę odchyłki bierze dostrojenie: inaczej próbka nagrana „pomiędzy”
    // grałaby fałszywie z resztą, a człowiek nie ma jak tego dosunąć pokrętłem stroju co 50 centów.
    if(r!=null){const c=Math.round((r-Math.max(24,Math.min(96,Math.round(r*2)/2)))*100);
      this._set("seSmpCent",Math.max(-50,Math.min(50,c)));}
    // Filtr prosto z fabryki przykrywa nagranie kołdrą. Otwieramy go TYLKO wtedy, gdy nikt go jeszcze nie ruszał.
    let otwarty=false;
    const fmin=this._el("seFMin"),fmax=this._el("seFMax"),q=this._el("seQ");
    if(fmin&&fmax&&q&&+fmin.value===260&&+fmax.value===7800&&+q.value===6){
      fmin.value="200";fmax.value="12000";q.value="0.5";otwarty=true;}
    for(const b2 of ["seNoise","seCroak"]){const e=this._el(b2);if(e&&e.checked)e.checked=false;}   // próbka zastępuje oscylatory
    this.save(id,t).then(ok=>{if(!ok)_seMsg(_gl("Próbki nie udało się zapisać na dysku.","Couldn't save the sample to disk."),false);});
    if(typeof _seSyncLabels==="function")_seSyncLabels();
    if(typeof labParamChanged==="function")labParamChanged();
    if(typeof SoundRack!=="undefined")SoundRack.sync();
    _seMsg(otwarty?_gl("Próbka gotowa. Filtr otwarty na pełno, żeby brzmiała jak nagranie.",
                       "Sample ready. The filter is wide open so it sounds like the recording.")
                 :_gl("Próbka gotowa. Przeciągnij znaczniki na przebiegu, żeby wybrać kawałek.",
                      "Sample ready. Drag the markers on the waveform to pick the piece you want."));
    this.odsluchaj();
  },
  usun(){
    const id=this.id();if(!id)return;
    this._set("seSmpId","");this._set("seSmpLen",0);
    if(typeof _seSyncLabels==="function")_seSyncLabels();
    if(typeof labParamChanged==="function")labParamChanged();
    if(typeof SoundRack!=="undefined")SoundRack.sync();
    _seMsg(_gl("Próbka usunięta. Brzmienie wraca do fal.","Sample removed. The sound goes back to waves."));
  },
  // „Przytnij ciszę” NIE RUSZA BAJTÓW (do 2026-10-20 ruszało): przesuwa znaczniki wycinka na granice ciszy,
  // więc da się to cofnąć ręką, a brzmienie zapisane z poprzednim wycinkiem dalej gra swoje.
  przytnij(){
    const A=this.A(),id=this.id(),s=id?this.get(id):null;if(!A||!s)return;
    const g=A.granice(s.dane,s.sr),dl=s.dane.length/s.sr;
    if(!g){this._blad("cisza");return;}
    this._set("seSmpStart",Math.round(g.od/s.sr/dl*1000)/10);
    this._set("seSmpEnd",Math.round(g.koniec/s.sr/dl*1000)/10);
    if(window.KnobUI)KnobUI.syncAll();
    if(typeof _seSyncLabels==="function")_seSyncLabels();
    if(typeof labParamChanged==="function")labParamChanged();
    _seMsg(_gl("Znaczniki stoją na granicach ciszy. Bajty zostały całe.","The markers sit at the edges of the silence. The bytes are untouched."));
  },
  // „Przytnij na stałe”: z pliku zostaje SAM WYCINEK, więc 12-sekundowe nagranie, z którego grają dwie sekundy,
  // przestaje ważyć 768 kB. Poziom, kierunek i zlepek zostają nastawami; pętla jest przeliczana na nowe zero.
  przytnijNaStale(){
    const A=this.A(),id=this.id(),s=id?this.get(id):null;if(!A||!s)return;
    const w=this._wycinek(),loop=this._chk("seSmpLoop")?this._petla():null;
    const t=A.wycinek(s,{od:w.a,koniec:w.b});
    if(!t){_seMsg(_gl("Wycinek to całe nagranie — nie ma czego przycinać.","The piece is the whole recording — there is nothing to trim."),false);return;}
    const nid=A.nowyId(),dl=t.dane.length/t.sr;
    this._set("seSmpId",nid);this._set("seSmpSr",t.sr);this._set("seSmpLen",t.dane.length);
    this._set("seSmpStart",0);this._set("seSmpEnd",100);
    if(loop){
      this._set("seSmpFrom",Math.max(0,Math.min(99.5,Math.round((loop.a-w.a)/dl*1000)/10)));
      this._set("seSmpTo",Math.max(.5,Math.min(100,Math.round((loop.b-w.a)/dl*1000)/10)));
    }
    this.save(nid,t);
    if(window.KnobUI)KnobUI.syncAll();
    if(typeof _seSyncLabels==="function")_seSyncLabels();
    if(typeof labParamChanged==="function")labParamChanged();
    _seMsg(_gl("Przycięte na stałe: ","Trimmed for good: ")+this._czas(dl)+".");
  },
  // Zapis do pliku: TO, CO SŁYCHAĆ — wycinek z poziomem, kierunkiem i zlepkiem, a nie całe bajty. Człowiek
  // zapisuje próbkę, żeby ją komuś dać albo wziąć do innego programu, i spodziewa się tego, co gra pad.
  zapiszPlik(){
    const A=this.A(),id=this.id(),s=id?this.get(id):null;if(!A||!s)return;
    const w=A.wytnij(s,this.edycja(this.readInto({})));
    if(!w||!w.dane.length){this._blad("blad");return;}
    try{
      const url=URL.createObjectURL(new Blob([A.doWav(w)],{type:"audio/wav"})),a=document.createElement("a");
      a.href=url;a.download="probka-"+id+".wav";a.hidden=true;document.body.append(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),5000);
      _seMsg(_gl("Próbka zapisana jako plik WAV.","The sample has been saved as a WAV file."));
    }catch(e){this._blad("blad");}
  },
  wykryj(){
    const A=this.A(),id=this.id(),s=id?this.get(id):null;if(!A||!s)return;
    const w=this._wycinek();   // z WYCINKA, nie z całości: wykrywa się strój tego, co gra
    const r=A.wykryjRoot(s.dane.subarray(Math.round(w.a*s.sr),Math.round(w.b*s.sr)),s.sr);
    if(r==null){_seMsg(_gl("Nie słyszę tu wysokości. Ustaw nutę suwakiem.","I can't hear a pitch here. Set the note with the slider."),false);return;}
    const pol=Math.max(24,Math.min(96,Math.round(r*2)/2));
    this._set("seSmpRoot",pol);this._set("seSmpCent",Math.max(-50,Math.min(50,Math.round((r-pol)*100))));
    if(window.KnobUI)KnobUI.syncAll();
    if(typeof _seSyncLabels==="function")_seSyncLabels();
    if(typeof labParamChanged==="function")labParamChanged();
    _seMsg(_gl("Wykryta nuta: ","Detected note: ")+this.nazwaNuty(Math.round(this._v("seSmpRoot",60)))+this._centy()+".");
  },
  // Odsłuch = strój próbki zagrany brzmieniem (z filtrem i obwiednią), nie suche bajty: ma być słychać to,
  // co usłyszy pad. Idzie szyną laba, jak „Testuj”, więc widać go na lampie i na wskaźniku poziomu.
  odsluchaj(){
    const inst=(typeof labEnsure==="function")?labEnsure():null;if(!inst)return;
    if(typeof labSyncPatch==="function")labSyncPatch();
    const m=this._chk("seSmpFix")?60:Math.round(this._v("seSmpRoot",60));
    PadAudio.gateOff(inst,"smp");
    PadAudio.gateOn(inst,"smp",m,.62);
    const w=this._wycinek();
    clearTimeout(this._odT);
    this._odT=setTimeout(()=>{try{PadAudio.gateOff(inst,"smp");}catch(e){}},Math.min(3200,Math.max(700,Math.round((w.b-w.a)*1000)+300)));
  },

  // ---------------- mikrofon: lista, podsłuch, odliczanie ----------------
  // Nazwy mikrofonów są puste, dopóki przeglądarka nie dostała zgody (reguła prywatności, nie błąd), więc
  // do tego czasu lista podpisuje je „Mikrofon 1, 2…”. Po pierwszym nagraniu pytamy jeszcze raz i podpisy
  // robią się prawdziwe.
  listaUrzadzen(){
    const A=this.A(),sel=this._el("seSmpDev");if(!A||!sel)return Promise.resolve([]);
    return A.urzadzenia().then(l=>{
      this._urz=l;
      const byl=sel.value;
      sel.replaceChildren();
      const dom=document.createElement("option");dom.value="";dom.textContent=_gl("Mikrofon domyślny","Default microphone");
      sel.append(dom);
      l.forEach((d,i)=>{const o=document.createElement("option");o.value=d.id;
        o.textContent=d.nazwa||(_gl("Mikrofon ","Microphone ")+(i+1));sel.append(o);});
      sel.value=l.some(d=>d.id===byl)?byl:"";
      sel.hidden=l.length<2&&!byl;   // jeden mikrofon w komputerze: lista nie ma czego wybierać
      return l;
    });
  },
  _urzadzenie(){const e=this._el("seSmpDev");return e?String(e.value||""):"";},
  podsluch(){
    const A=this.A();if(!A)return;
    if(this._mon||A.podsluchuje()){A.stopPodsluch();this._monWidok(false);return;}
    const ac=this.ctx();if(!ac){this._blad("blad");return;}
    this._monWidok(true);
    A.podsluch(ac,{
      poziom:lv=>this._vu(lv),
      start:()=>{_seMsg(_gl("Podsłuch włączony. Powiedz coś i sprawdź, czy wskaźnik dochodzi do dwóch trzecich.",
                            "Monitoring is on. Say something and check the meter reaches about two thirds."));
        this.listaUrzadzen();},
      blad:k=>{this._monWidok(false);this._blad(k);}},this._urzadzenie());
  },
  _monWidok(on){
    this._mon=!!on;
    const b=this._el("seSmpMon"),bar=this._el("seSmpBar"),akc=this._el("seSmpActs"),t=this._el("seSmpTime");
    if(b){b.classList.toggle("on",!!on);b.setAttribute("aria-pressed",on?"true":"false");}
    if(!on&&!(this.A()&&this.A().nagrywa())){if(bar)bar.hidden=true;if(akc)akc.hidden=false;this._vu(0);}
    else if(on){if(bar)bar.hidden=false;if(akc)akc.hidden=false;if(t)t.textContent=_gl("Podsłuch","Monitoring");}
  },
  _vu(lv){const vu=this._el("seSmpVu");if(vu&&vu.firstElementChild)vu.firstElementChild.style.width=Math.round(Math.min(1,lv)*100)+"%";},
  nagraj(){
    const A=this.A();if(!A)return;
    if(A.nagrywa()){A.stop();return;}
    if(!A.obslugiwane()){this._blad("nieobslugiwane");return;}
    const ac=this.ctx();if(!ac){this._blad("blad");return;}
    if(typeof labStopAll==="function"&&XPAD._labCont)labContinuous(false);
    this._mon=false;
    this._pasek(true,0,0);
    A.nagraj(ac,{
      odliczanie:n=>this._pasekTekst(n>0?_gl("Nagrywam za… ","Recording in… ")+n:_gl("Teraz!","Now!")),
      poziom:(lv,sek)=>this._pasek(true,lv,sek),
      koniec:w=>{this._pasek(false,0,0);this.listaUrzadzen();this.przyjmij(w,true);},
      blad:k=>{this._pasek(false,0,0);this._blad(k);}},
      {urzadzenie:this._urzadzenie(),odliczanie:this._chk("seSmpCount")?3:0});
  },
  _pasek(on,lv,sek){
    const box=this._el("soundEditor");if(!box)return;
    const bar=this._el("seSmpBar"),akc=this._el("seSmpActs");
    if(bar)bar.hidden=!on;if(akc)akc.hidden=on;
    if(on){this._pasekTekst(_gl("Nagrywam… ","Recording… ")+(Math.round(sek*10)/10).toFixed(1)+" s");this._vu(lv);}
    else this._vu(0);
  },
  _pasekTekst(s){const t=this._el("seSmpTime");if(t)t.textContent=s;},
  zPliku(f){
    const A=this.A();if(!A||!f)return;
    const ac=this.ctx();if(!ac){this._blad("blad");return;}
    _seMsg(_gl("Wczytuję próbkę…","Loading the sample…"));
    A.zPliku(f,ac).then(w=>this.przyjmij(w,false),k=>this._blad(typeof k==="string"?k:"blad"));
  },
  // mikrofon gaśnie razem z edytorem: niezamknięta ścieżka to zapalona dioda po zwinięciu Biblioteki dźwięków
  stopMic(){const A=this.A();if(A){A.zamknij();}this._mon=false;this._pasek(false,0,0);this._monWidok(false);},

  // ---------------- montaż ----------------
  init(){
    if(this._inited)return;
    const box=this._el("soundEditor");if(!box||!this._el("seSmpRec"))return;
    this._inited=true;
    const g=id=>this._el(id);
    g("seSmpRec").addEventListener("click",()=>this.nagraj());
    const stopB=g("seSmpStop");if(stopB)stopB.addEventListener("click",()=>{const A=this.A();if(A){if(A.nagrywa())A.stop();else{A.stopPodsluch();this._monWidok(false);}}});
    const pick=g("seSmpPick"),fileB=g("seSmpFile");
    if(fileB&&pick){fileB.addEventListener("click",()=>pick.click());
      pick.addEventListener("change",()=>{const f=pick.files&&pick.files[0];pick.value="";if(f)this.zPliku(f);});}
    const b=(id,fn)=>{const e=g(id);if(e)e.addEventListener("click",fn);};
    b("seSmpPlay",()=>this.odsluchaj());b("seSmpDetect",()=>this.wykryj());
    b("seSmpTrim",()=>this.przytnij());b("seSmpBake",()=>this.przytnijNaStale());
    b("seSmpSave",()=>this.zapiszPlik());b("seSmpDel",()=>this.usun());
    b("seSmpMon",()=>this.podsluch());
    const dev=g("seSmpDev");if(dev)dev.addEventListener("change",()=>{if(this._mon){this.A().stopPodsluch();this._monWidok(false);}});
    // Zapętlenie: świeża pętla staje W ŚRODKU WYCINKA, nie na 10–60 % całego nagrania, i od razu dostaje 20 ms
    // zlepka — zapętlony kawałek bez zlepka klika raz na obrót, a nikt nie szuka tego pokrętła sam.
    const loop=g("seSmpLoop");
    if(loop)loop.addEventListener("change",()=>{
      if(loop.checked){
        const w=this._wycinek(),sek=this.sek(),p=this._petla();
        if(!(sek>0))return;
        if(!(p.b-p.a>.01)||p.a<=w.a+1e-6||p.b>=w.b-1e-6){
          this._set("seSmpFrom",Math.round((w.a+(w.b-w.a)*.25)/sek*1000)/10);
          this._set("seSmpTo",Math.round((w.a+(w.b-w.a)*.75)/sek*1000)/10);
        }
        if(!(this._v("seSmpGlue",0)>0))this._set("seSmpGlue",20);
        if(window.KnobUI)KnobUI.syncAll();
      }
      if(typeof _seSyncLabels==="function")_seSyncLabels();
      if(typeof labParamChanged==="function")labParamChanged();
    });
    // przeciąganie znaczników po przebiegu
    const k=g("seSmpWave");
    if(k){
      let ciag=null;
      const xz=e=>{const r=k.getBoundingClientRect();return {x:e.clientX-r.left,szer:Math.max(1,r.width)};};
      k.addEventListener("pointerdown",e=>{
        if(e.button!=null&&e.button!==0)return;
        const {x,szer}=xz(e),pole=this._znacz(x,szer);
        if(!pole)return;
        ciag=pole;try{k.setPointerCapture(e.pointerId);}catch(x2){}
        k.classList.add("drag");e.preventDefault();this._ciagnij(pole,x,szer);
      });
      k.addEventListener("pointermove",e=>{
        const {x,szer}=xz(e);
        if(!ciag){k.style.cursor=this._znacz(x,szer)?"ew-resize":"default";return;}
        this._ciagnij(ciag,x,szer);
      });
      const koniec=()=>{if(ciag){ciag=null;k.classList.remove("drag");if(typeof labParamChanged==="function")labParamChanged();}};
      for(const ev of ["pointerup","pointercancel","lostpointercapture"])k.addEventListener(ev,koniec);
    }
    // upuszczenie dźwięku na kartę
    const karta=box.querySelector('.se-sec[data-module="smp"]');
    if(karta){let we=0;
      karta.addEventListener("dragenter",e=>{if(e.dataTransfer&&[...e.dataTransfer.types].includes("Files")){e.preventDefault();we++;karta.classList.add("drop");}});
      karta.addEventListener("dragover",e=>{if(e.dataTransfer&&[...e.dataTransfer.types].includes("Files")){e.preventDefault();e.dataTransfer.dropEffect="copy";}});
      karta.addEventListener("dragleave",()=>{if(--we<=0){we=0;karta.classList.remove("drop");}});
      karta.addEventListener("drop",e=>{e.preventDefault();we=0;karta.classList.remove("drop");
        const f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0];if(f)this.zPliku(f);});}
    // zwinięcie Biblioteki dźwięków gasi mikrofon (labStopAll robi to samo z resztą dźwięku)
    box.addEventListener("toggle",e=>{if(e.target===box&&!box.open)this.stopMic();});
    if(typeof ResizeObserver==="function"){try{new ResizeObserver(()=>this.draw()).observe(box);}catch(e){}}
    const A=this.A();if(A)A.naZmianeUrzadzen(()=>this.listaUrzadzen());
    this.listaUrzadzen();
    this.ensure();
  },
};
if(typeof window!=="undefined")window.PadSampler=PadSampler;
