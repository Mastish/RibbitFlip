"use strict";
// ===== SoundRack: the sound editor laid out as a rack (Synth › Brzmienia, stage E4a, 2026-10-02) =====
// The layout lives in the dashboard HTML and css/30: a sound bar on top (emoji, name, kind badge, "unsaved changes",
// the volume knob, the actions with "Nowe brzmienie" and "⧉ Duplikuj"), the library in a left column (search, kind
// chips, the list with a ▶ quick listen on every row) and the instrument on the right (the round scope over the rack: four module
// cards one under another, the test loop folded under them). The scope is a visualisation only; the curve editors
// (wave, equaliser, envelope) are flat panels inside the cards (rf-25e, stage E6), in the `.se-sec-editor` boxes.
// This file adds only the behaviour that layout needs:
//   • the kind badge #seKind (new / base / custom / changed) and the dot #seDirty ("niezapisane zmiany");
//   • search by name (case and Polish diacritics ignored) and kind chips with counts, by `hidden` on the rows;
//   • the quick listen: the arpeggio of the Test key, played with ANOTHER sound's patch on the lab bus, so the scope
//     and the level meter show it with no code of their own, then the lab gets the form's patch back;
//   • 🎲 on a module card rolls only that module (randomizePatch(scope), rf-25);
//   • Ctrl+S inside the open editor saves (once per press, not on key repeat).
// rf-25 stays the owner of the editor state, and its code is not edited: the functions below are WRAPPED. Top-level
// function declarations of a classic script are writable globals and every caller looks the name up at call time
// (rf-25 itself, rf-49g scenes), so a wrapper is seen everywhere. The two buttons that rf-25 bound by reference
// (#seSave → saveCustomSound, #seCancelEdit → cancelEdit) are re-bound to the wrappers with that same reference.
// The "unsaved" reference is the FORM right after a load, a save or a reset, not the raw source patch: the older
// base sounds hold values between the knobs' steps or past their ranges, the form rounds them while loading, and a
// comparison with the source would light the dot before the first touch. Both sides go through sanitizePatch with
// the source merged under the form (exactly what saveCustomSound would store), and the keys are sorted.
// Must load in node `vm` with no DOM (tests/sound_rack_harness.mjs): document is touched only inside functions, and
// the pure helpers (stable, isDirty, kindOf, fold, rowKind, filterRows, counts, previewGuard) live on the object.

const SoundRack={
  KINDS:["all","base","custom","over"],
  // the badge words stay Polish in the DOM: the i18n walker translates them (and restores them on the way back)
  KIND_PL:{new:"nowe",base:"bazowe",over:"zmienione",custom:"własne"},
  PREV_SRC:"prev:arp",   // the quick listen's own voice source on the lab bus (Test plays "arp", the loop "seq:…")
  PREV_NOTES:[60,64,67,72],PREV_STEP:230,PREV_TAIL:400,
  _q:"",_kind:"all",_ref:null,_prev:null,_t:0,_inited:false,

  // ---------------- pure helpers ----------------
  // JSON with sorted keys at every level (eq bands are objects too), so the key order of two patches never matters
  stable(v){
    if(Array.isArray(v))return "["+v.map(x=>this.stable(x)).join(",")+"]";
    if(v&&typeof v==="object")return "{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+this.stable(v[k])).join(",")+"}";
    const s=JSON.stringify(v);return s===undefined?"null":s;},
  _san(p){return typeof sanitizePatch==="function"?sanitizePatch(p):(p||null);},
  // two patches differ once sanitizePatch is through with both (the custom wave, the bands and the bends included)
  isDirty(a,b){const sa=this._san(a),sb=this._san(b);if(!sa&&!sb)return false;return this.stable(sa)!==this.stable(sb);},
  // what is in the editor: a new sound, a base sound (changed = it has a saved override), or a custom one
  kindOf(x){
    x=x||{};
    if(x._editingBase){const ov=x.baseOverrides,id=x._editingBase;
      const o=ov&&Object.prototype.hasOwnProperty.call(ov,id)?ov[id]:null;
      return o&&(o.patch||o.name||o.emoji)?"over":"base";}   // the same test as soundMeta().overridden (rf-23)
    return x._editingSlug?"custom":"new";},
  // search key: lower case without diacritics. NFD splits ą ć ę ń ó ś ź ż, but „ł” is a letter of its own, not
  // l + a mark, so it is mapped by hand
  fold(s){return String(s==null?"":s).replace(/ł/g,"l").replace(/Ł/g,"L").normalize("NFD").replace(/\p{M}/gu,"").toLowerCase().trim();},
  // a row's chip: base, changed (a base sound with an override) or custom — the same word as the row's badge
  rowKind(listKind,overridden){return listKind==="base"?(overridden?"over":"base"):"custom";},
  // rows [{k, name}] → the rows left by the search and the chip ("all", empty or unknown = every kind)
  filterRows(rows,query,kind){
    const q=this.fold(query),any=!kind||kind==="all"||!this.KINDS.includes(kind);
    return (rows||[]).filter(r=>(any||r.k===kind)&&(!q||this.fold(r.name).includes(q)));},
  // the chips' numbers: rows that match the search, per kind (the chip itself does not narrow its own count)
  counts(rows,query){
    const n={all:0,base:0,custom:0,over:0};
    for(const r of this.filterRows(rows,query,"all")){n.all++;if(r.k in n)n[r.k]++;}
    return n;},
  // a kind chip hides while it filters nothing: none of that kind, or every sound is of that kind (L4a: "Bazowe 35"
  // next to "Wszystkie 35" on a fresh library). "Wszystkie" goes too when it is on and no other chip is left.
  // The chip that is on always stays.
  chipHidden(kind,n,on){
    const all=n&&n.all,useful=k=>((n&&n[k])>0)&&(all==null||n[k]<all);
    if(kind==="all")return on==="all"&&!this.KINDS.some(k=>k!=="all"&&useful(k));
    return kind!==on&&!useful(kind);},
  // why a quick listen must not start now: a held note, the continuous preview or the test loop rewrite the lab
  // patch every few hundred ms (the loop at every step), so the listen would play the form's sound, not the row's
  previewGuard(x){x=x||{};if(x._labHold)return "hold";if(x._labCont)return "cont";if(x._seq&&x._seq.playing)return "seq";return null;},

  // ---------------- DOM ----------------
  _el(id){return typeof document!=="undefined"?document.getElementById(id):null;},
  _box(){return this._el("soundEditor");},
  _form(){return Object.assign({},(typeof XPAD!=="undefined"&&XPAD._editSrcPatch)||{},readEditorPatch());},
  _texts(){const n=this._el("seName"),e=this._el("seEmoji");
    return {name:n?String(n.value||"").trim():"",emoji:e?String(e.value||"").trim():""};},
  // the reference for "unsaved": the form as it stands (taken after a load, a save, a reset and "+ Nowe")
  snapshot(){
    if(typeof readEditorPatch!=="function")return;
    const t=this._texts();this._ref={patch:this._san(this._form()),name:t.name,emoji:t.emoji};
    this._check();},
  _later(){clearTimeout(this._t);this._t=setTimeout(()=>this._check(),150);},
  _check(){
    clearTimeout(this._t);
    const ref=this._ref;let d=false;
    if(ref&&typeof readEditorPatch==="function"){const t=this._texts();
      d=this.isDirty(this._form(),ref.patch)||t.name!==ref.name||t.emoji!==ref.emoji;}
    this.dirty=d;
    const dot=this._el("seDirty");if(dot&&dot.hidden===d)dot.hidden=!d;
    const bar=this._box()&&this._box().querySelector(".se-bar");if(bar)bar.classList.toggle("dirty",d);
    return d;},
  // badge + "⧉ Duplikuj" follow the edit target (cheap; called after every list render too)
  _syncBar(){
    if(typeof XPAD==="undefined")return;
    const k=this.kindOf(XPAD),el=this._el("seKind");
    if(el){if(el.dataset.kind!==k){el.dataset.kind=k;el.textContent=this.KIND_PL[k];}
      const id=XPAD._editingBase||XPAD._editingSlug;
      const tip=k==="new"?"Nowe brzmienie, jeszcze nie zapisane":(typeof soundMeta==="function"?soundMeta(id).name:String(id));
      if(el._tip!==tip){el._tip=tip;el.setAttribute("title",tip);}}   // rf-05 turns it into the in-theme tooltip
    const dup=this._el("seDup");if(dup)dup.disabled=!(XPAD._editingBase||XPAD._editingSlug);},
  sync(){this._syncBar();this._check();},

  // ---- library column ----
  _rows(){
    const wrap=this._el("seList");if(!wrap)return [];
    return [...wrap.querySelectorAll(".se-row")].map(el=>{const id=el.dataset.id,m=soundMeta(id);
      return {el,id,k:this.rowKind(el.dataset.kind,m.overridden),name:m.name};});},
  // called after every renderSoundList: the ▶ key on each row, the playing mark, the filter and the bar
  decorate(){
    const wrap=this._el("seList");if(!wrap)return;
    for(const row of wrap.querySelectorAll(".se-row")){
      if(row.querySelector(".se-play"))continue;
      const acts=row.querySelector(".se-row-acts");if(!acts)continue;
      const id=row.dataset.id,kind=row.dataset.kind,on=!!this._prev&&this._prev.id===id;
      const b=document.createElement("button");b.type="button";b.className="se-play";b.textContent="▶";
      b.setAttribute("title","Posłuchaj bez wczytywania");
      b.setAttribute("aria-label",this._playLabel(id));
      b.setAttribute("aria-pressed",on?"true":"false");   // a toggle from the start (▶ on the playing row stops it)
      b.addEventListener("click",e=>{e.stopPropagation();this.preview(kind,id);});
      acts.insertBefore(b,acts.firstChild);
      if(on)row.classList.add("playing");
    }
    this.applyFilter();this._syncBar();},
  // "Posłuchaj Trąbka": composed with the sound's name, so the walker cannot translate it — _gl() here and again on a
  // language switch (_relang)
  _playLabel(id){return _gl("Posłuchaj","Listen to")+" "+soundMeta(id).name;},
  _relang(){
    const wrap=this._el("seList");if(!wrap)return;
    wrap.querySelectorAll(".se-row").forEach(r=>{const b=r.querySelector(".se-play");if(b)b.setAttribute("aria-label",this._playLabel(r.dataset.id));});},
  applyFilter(){
    const rows=this._rows(),vis=new Set(this.filterRows(rows,this._q,this._kind));
    for(const r of rows){const h=!vis.has(r);if(r.el.hidden!==h)r.el.hidden=h;if(h)r.el.classList.remove("kb-focus");}
    const n=this.counts(rows,this._q),box=this._el("seFilter");
    // a kind the library has none of ("Własne 0", "Zmienione 0") hides its chip, so the chips fit one row and the
    // list gets the room; counted without the search, so the chips do not jump while typing
    const tot=this.counts(rows,"");
    if(box)box.querySelectorAll(".se-chip").forEach(c=>{const k=c.dataset.kind,s=c.querySelector(".se-chip-n");if(s)s.textContent=String(n[k]||0);
      const h=this.chipHidden(k,tot,this._kind);if(c.hidden!==h)c.hidden=h;});
    const empty=this._el("seLibEmpty");if(empty)empty.hidden=vis.size>0||!rows.length;
    const ln=this._el("seLibN");if(ln)ln.textContent="("+rows.length+")";
    if(typeof SoundScreens!=="undefined"&&SoundScreens._fit)SoundScreens._fit();},   // the library's fixed rows may have changed
  setKind(kind){
    this._kind=this.KINDS.includes(kind)?kind:"all";
    const box=this._el("seFilter");
    if(box)box.querySelectorAll(".se-chip").forEach(c=>{const on=c.dataset.kind===this._kind;
      c.classList.toggle("on",on);c.setAttribute("aria-pressed",on?"true":"false");});
    this.applyFilter();},
  // the list's keys work on the VISIBLE rows only: the arrows walk them, and Enter (load) / Delete / Backspace
  // (remove a custom sound, reset a changed base one) act on the highlighted row, or on the row being edited, only
  // while the search and the chip leave it on screen — a row the filter hides cannot be loaded or deleted from the
  // keyboard. This capture listener answers all seven keys first and stops the event (rf-25 _seListBindKeys skips
  // hidden rows too, for a list without this file). Enter / Delete / Backspace count only on the list itself: on a
  // focused key inside a row (▶, ✕…) they belong to that key.
  _listKeys(e){
    const mv=["ArrowDown","ArrowUp","Home","End"].includes(e.key),act=["Enter","Delete","Backspace"].includes(e.key);
    if(!mv&&!act)return;
    const wrap=this._el("seList");if(!wrap||(act&&e.target!==wrap))return;
    const rows=[...wrap.querySelectorAll(".se-row")].filter(r=>!r.hidden);
    e.stopImmediatePropagation();
    let i=rows.findIndex(r=>r.classList.contains("kb-focus"));if(i<0)i=rows.findIndex(r=>r.classList.contains("editing"));
    if(act){if(i<0)return;e.preventDefault();const r=rows[i];
      if(e.key==="Enter"){r.click();return;}
      const del=r.querySelector(".se-del"),rst=r.querySelector(".se-reset");if(del)del.click();else if(rst)rst.click();return;}
    e.preventDefault();if(!rows.length)return;
    let j=e.key==="ArrowDown"?(i<0?0:i+1):e.key==="ArrowUp"?(i<0?rows.length-1:i-1):e.key==="Home"?0:rows.length-1;
    j=Math.max(0,Math.min(rows.length-1,j));
    wrap.querySelectorAll(".se-row.kb-focus").forEach(r=>r.classList.remove("kb-focus"));
    rows[j].classList.add("kb-focus");try{rows[j].scrollIntoView({block:"nearest"});}catch(_){}},
  // THE UNSAVED-CHANGES GATE. Loading another sound into the form (a row, its pencil, "⧉" on a row, "Nowe brzmienie",
  // "Duplikuj") replaces the form, so with changes in it the move asks first. Switching tabs does not ask: the form
  // stays as it is. "Zapisz i przejdź" saves through the same wrapper as the bar's button; a sound without a name
  // cannot be saved, so for it the main answer is "Wróć i nazwij". Esc and the backdrop mean "Zostań".
  guard(fn){
    if(!this._check()||typeof rfModal!=="function"){fn();return;}
    const t=this._texts(),nameless=!t.name;
    rfModal({icon:"⚠️",
      title:nameless?_gl("Nowe brzmienie nie jest zapisane","The new sound isn't saved")
        :_gl("Zmiany w brzmieniu „"+t.name+"” nie są zapisane","Changes to “"+t.name+"” aren't saved"),
      message:_gl("Jeśli przejdziesz dalej bez zapisu, te zmiany przepadną.","If you go on without saving, these changes are lost."),
      actions:[{label:_gl("Zostań","Stay"),value:false,variant:"ghost"},
        {label:_gl("Porzuć zmiany","Discard changes"),value:"drop",variant:"ghost"},
        nameless?{label:_gl("Wróć i nazwij","Go back and name it"),value:"name",variant:"primary"}
          :{label:_gl("Zapisz i przejdź","Save and continue"),value:"save",variant:"primary"}]})
    .then(v=>{
      if(v==="drop"){fn();return;}
      if(v==="save"){saveCustomSound();if(!this._check())fn();return;}
      if(v==="name"){const nm=this._el("seName");if(nm)try{nm.focus();}catch(e){}}});},
  // "Nowe brzmienie": out of any edit, the form back to its defaults (an empty patch = every default of _setFormFromPatch)
  newSound(){
    this.stopPreview();
    cancelEdit();
    _setFormFromPatch("","🎛",{});
    if(typeof labParamChanged==="function")labParamChanged();
    this.snapshot();this._syncBar();
    const nm=this._el("seName");if(nm)nm.focus();
    _seMsg(_gl("Nowe brzmienie: ustaw je, nazwij i zapisz","New sound: shape it, name it and save it"));},
  // "Nowe brzmienie" in the pads' header (owner, 2026-11-19: "I need a clear button in Synth that lets me add a new
  // instrument; I wrote this and cannot remember how to get in there"). The editor lives on the module's Sounds tab,
  // which is one of four small icons: the button switches to it, opens the library and starts a blank sound. A sound
  // with unsaved changes is NOT thrown away: the editor is shown as it stands, with a word on what to do.
  openNew(){const box=this._box();if(!box)return;
    if(typeof rfRevealPane==="function")rfRevealPane(box);
    box.open=true;
    if(this.dirty)_seMsg(_gl("To brzmienie ma niezapisane zmiany: zapisz je albo kliknij „Nowe brzmienie”","This sound has unsaved changes: save it or click “New sound”"),false);
    else this.newSound();
    try{box.scrollIntoView({block:"start",behavior:(typeof _prefersReducedMotion==="function"&&_prefersReducedMotion())?"auto":"smooth"});}catch(e){}
    const nm=this._el("seName");if(nm)try{nm.focus({preventScroll:true});}catch(e){}},
  // "⧉ Duplikuj": the sound being edited, as stored (duplicateSound copies the saved patch, not the form)
  duplicateCurrent(){
    if(typeof XPAD==="undefined")return;
    const id=XPAD._editingBase||XPAD._editingSlug;if(!id)return;
    duplicateSound(XPAD._editingBase?"base":"custom",id);},

  // ---- quick listen ----
  _markPlaying(id){
    const wrap=this._el("seList");if(!wrap)return;
    wrap.querySelectorAll(".se-row").forEach(r=>{const on=!!id&&r.dataset.id===id;r.classList.toggle("playing",on);
      const b=r.querySelector(".se-play");if(b)b.setAttribute("aria-pressed",on?"true":"false");});},
  preview(kind,id){
    if(typeof XPAD==="undefined"||typeof PadAudio==="undefined")return false;
    if(this._prev&&this._prev.id===id){this.stopPreview();return false;}   // ▶ on the row that plays = stop
    const why=this.previewGuard(XPAD);
    if(why){_seMsg(why==="hold"?_gl("Najpierw puść „Przytrzymaj”","Release “Hold” first")
      :why==="cont"?_gl("Najpierw wyłącz „Podgląd ciągły”","Turn off “Continuous preview” first")
      :_gl("Najpierw zatrzymaj pętlę testową","Stop the test loop first"),false);return false;}
    this.stopPreview(true);
    const inst=labEnsure();if(!inst)return false;
    const lab=XPAD.customSounds[LAB_ID],p=this._san(Object.assign({},padPatchFor(id)));
    if(!lab||!p){labSyncPatch();return false;}
    lab.patch=p;   // every note below is a NEW voice, and a voice keeps the patch it was born with
    const pv={id,kind,T:[]},notes=this.PREV_NOTES;let i=0;
    this._prev=pv;this._markPlaying(id);
    const step=()=>{
      if(this._prev!==pv)return;
      if(XPAD._lab!==inst){this.stopPreview(true);return;}   // the editor folded: rf-25 freed the lab bus
      if(i>=notes.length){PadAudio.gateOff(inst,this.PREV_SRC);
        pv.T.push(setTimeout(()=>{if(this._prev===pv)this.stopPreview();},this.PREV_TAIL));return;}
      PadAudio.gateOn(inst,this.PREV_SRC,notes[i],.62);i++;pv.T.push(setTimeout(step,this.PREV_STEP));};
    step();
    return true;},
  // keepPatch: the lab patch is not given back (the caller sets one at once, or the bus is already gone)
  stopPreview(keepPatch){
    const pv=this._prev;if(!pv)return;
    this._prev=null;for(const t of pv.T)clearTimeout(t);
    if(typeof XPAD!=="undefined"&&XPAD._lab&&PadAudio.buses&&PadAudio.buses[LAB_ID])PadAudio.gateOff(XPAD._lab,this.PREV_SRC);
    if(!keepPatch&&typeof labSyncPatch==="function")labSyncPatch();
    this._markPlaying(null);},

  // ---------------- wiring ----------------
  _wrap(){
    const self=this;
    const oReset=_seEditReset;_seEditReset=function(){const r=oReset.apply(this,arguments);self.snapshot();self._syncBar();return r;};
    const oBegin=_seBeginEdit;_seBeginEdit=function(){const r=oBegin.apply(this,arguments);self.snapshot();self._syncBar();return r;};
    const oCancel=cancelEdit;cancelEdit=function(){const r=oCancel.apply(this,arguments);self.snapshot();self._syncBar();return r;};
    // an empty name = no save (rf-25 says so in #seMsg) → the reference stays and the dot with it
    const oSave=saveCustomSound;saveCustomSound=function(){
      const ok=!!self._texts().name;const r=oSave.apply(this,arguments);
      if(ok)self.snapshot();else self._check();self._syncBar();return r;};
    const oList=renderSoundList;renderSoundList=function(){const r=oList.apply(this,arguments);try{self.decorate();}catch(e){}return r;};
    // every edit reaches the lab through here (knobs, selects, the screen's drawing, the dice): re-check the dot, and
    // stop a quick listen, because the original has just put the form's patch back on the lab bus
    const oParam=labParamChanged;labParamChanged=function(){const r=oParam.apply(this,arguments);self.stopPreview(true);self._later();return r;};
    const sb=this._el("seSave");if(sb){sb.removeEventListener("click",oSave);sb.addEventListener("click",()=>saveCustomSound());}
    const ce=this._el("seCancelEdit");if(ce){ce.removeEventListener("click",oCancel);ce.addEventListener("click",()=>cancelEdit());}
  },
  // ===== UX 261120 L4a: piętra Brzmień (rfTier, rf-28d) =====
  // „Kształt brzmienia” (oscylatory, filtr, obwiednia) to piętro 2: w nagłówku źródło, filtr i atak.
  // „Zaawansowane” (próbka, charakter, pętla testowa) to piętro 3; licznik mówi, ile z nich gra w tym
  // brzmieniu (próbka, przester, rechot, szum), żeby zwinięty blok nie chował tego, co słychać.
  // Bez „Przywróć domyślne”: to są nastawy jednego brzmienia, a nie ustawienia modułu. Brzmienie
  // ma własne „Nowe brzmienie” i „Przywróć domyślny” (bazowe).
  _tiers(box){
    if(typeof rfTier!=="function")return;
    const g=id=>this._el(id),val=id=>{const e=g(id);return e?e.value:"";},
      txt=id=>{const e=g(id),o=e&&e.options?e.options[e.selectedIndex]:null;return o?String(o.textContent).trim():"";},
      gl=(pl,en)=>typeof _gl==="function"?_gl(pl,en):pl,
      hz=v=>{v=+v||0;return v>=1000?String(Math.round(v/100)/10).replace(".",gl(",","."))+" kHz":v+" Hz";};
    const shape=g("seShapeFold"),adv=g("seAdvFold");
    if(shape)rfTier(shape,"synth.brzmienie.ksztalt",{sum:()=>{
      const src=box.classList.contains("se-is-noise")?gl("szum","noise"):box.classList.contains("se-is-smp")?gl("próbka","sample"):txt("seWave").toLowerCase();
      return src+" · "+gl("filtr ","filter ")+hz(val("seFMin"))+"–"+hz(val("seFMax"))+" · "+gl("atak ","attack ")+val("seAtt")+" ms";}});
    if(adv){
      rfTier(adv,"synth.brzmienie.zaawansowane",{adv:true,changed:()=>{
        const on=id=>{const e=g(id);return !!(e&&e.checked);};
        return (val("seSmpId")?1:0)+((+val("seDrive")||0)>0?1:0)+(on("seCroak")?1:0)+(on("seNoise")?1:0);}});
      // pętla gra tylko wtedy, gdy ją widać: zwinięte „Zaawansowane” zatrzymuje ją jak jej własny zwijak
      adv.addEventListener("toggle",()=>{if(!adv.open&&XPAD._seq&&XPAD._seq.playing&&typeof seqStop==="function")seqStop();});
    }
  },
  init(){
    if(this._inited)return;
    const box=this._box();if(!box||typeof renderSoundList!=="function")return;
    this._inited=true;
    this._wrap();
    const g=id=>this._el(id);
    // the bar: the dot follows every edit; Ctrl+S anywhere inside the OPEN editor saves (an empty name: focus the
    // field). The folded editor keeps its summary focusable, so it checks `open`; a held key saves once (the repeats
    // are only kept from the browser's own "save page")
    box.addEventListener("input",e=>{if(!e.target.closest(".se-lib,.se-seq-sec"))this._later();});
    box.addEventListener("change",e=>{if(!e.target.closest(".se-lib,.se-seq-sec"))this._later();});
    box.addEventListener("keydown",e=>{
      if(!box.open||!(e.ctrlKey||e.metaKey)||e.altKey||e.shiftKey||String(e.key).toLowerCase()!=="s")return;
      e.preventDefault();if(e.repeat)return;const nm=g("seName");
      if(nm&&nm.value.trim()){const s=g("seSave");if(s)s.click();}
      else saveCustomSound();});   // an empty name: rf-25 focuses the field and keeps "Najpierw nazwij brzmienie." up
    const bar=box.querySelector(".se-bar");
    if(bar&&typeof ResizeObserver==="function"){   // the library column parks under the bar: its height, measured
      try{new ResizeObserver(()=>box.style.setProperty("--se-bar-h",bar.offsetHeight+"px")).observe(bar);}catch(e){}}
    // the library column
    const q=g("seSearch");
    if(q){q.addEventListener("input",()=>{this._q=q.value;this.applyFilter();});
      q.addEventListener("keydown",e=>{if(e.key==="Escape"&&q.value){e.preventDefault();e.stopPropagation();q.value="";this._q="";this.applyFilter();}});}
    const fl=g("seFilter");if(fl)fl.querySelectorAll(".se-chip").forEach(c=>c.addEventListener("click",()=>this.setKind(c.dataset.kind)));
    const nb=g("seNew");if(nb)nb.addEventListener("click",()=>this.guard(()=>this.newSound()));
    const pn=g("padNewSound");if(pn)pn.addEventListener("click",()=>this.openNew());
    const db=g("seDup");if(db)db.addEventListener("click",()=>this.guard(()=>this.duplicateCurrent()));
    const lt=g("seLibToggle"),lib=lt&&lt.closest(".se-lib");
    if(lt&&lib)lt.addEventListener("click",()=>{const on=!lib.classList.contains("open");lib.classList.toggle("open",on);lt.setAttribute("aria-expanded",on?"true":"false");});
    const list=g("seList");if(list)list.addEventListener("keydown",e=>this._listKeys(e),true);
    // the rack: the dice in a card's summary must neither fold the card (click) nor reach the summary (Enter / Space,
    // whose keydown is prevented, so the browser makes no click of it and the roll happens once)
    box.querySelectorAll(".se-sec-tools button[data-rnd]").forEach(b=>{
      const act=e=>{e.preventDefault();e.stopPropagation();randomizePatch(b.dataset.rnd);};
      b.addEventListener("click",act);
      b.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" ")act(e);});
      b.addEventListener("keyup",e=>{if(e.key===" "){e.preventDefault();e.stopPropagation();}});});
    // a quick listen gives way to anything else that plays on the lab bus, and stops when the editor folds
    const stop=()=>this.stopPreview();
    for(const [id,ev] of [["seTest","click"],["seHold","pointerdown"],["seCont","click"],["seqPlay","click"],["seqGrid","pointerdown"]]){
      const el=g(id);if(el)el.addEventListener(ev,stop,true);}
    box.addEventListener("toggle",e=>{if(e.target===box&&!box.open)this.stopPreview(true);});
    // the test loop folded = stopped (its ⏹ key is inside the fold)
    const seqSec=box.querySelector(".se-seq-sec");
    if(seqSec)seqSec.addEventListener("toggle",()=>{if(!seqSec.open&&XPAD._seq&&XPAD._seq.playing&&typeof seqStop==="function")seqStop();});
    this._tiers(box);
    // a language switch (rf-01 setLang writes <html lang>): the ▶ labels carry the sound's name, re-compose them
    if(typeof MutationObserver==="function"&&document.documentElement){
      try{this._mo=new MutationObserver(()=>this._relang());this._mo.observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});}catch(e){}}
    this.decorate();this.snapshot();this._syncBar();
  },
};
if(typeof window!=="undefined")window.SoundRack=SoundRack;
