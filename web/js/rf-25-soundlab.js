"use strict";
// ===== sound editor, sound lab and effects pads =====
// The custom-sound editor and its preview bus (shown by the oscilloscope lamp and the curve panels), the looping step
// sequencer that plays through that bus, and the effects pads that steer a play pad's bus.

// ===================== CUSTOM SOUND EDITOR (build → name → emoji → save) =====================
// `stay`: the line waits for the cause to go away instead of the 2.6 s timer (an empty name: until a name is typed)
function _seMsg(t,ok,stay){const e=document.getElementById("seMsg");if(!e)return;e.textContent=t;
  e.style.color=ok===false?"var(--bad)":"var(--ok)";clearTimeout(e._t);
  if(!stay)e._t=setTimeout(()=>{e.textContent="";},2600);}
// "Zapisz brzmienie" / "Zapisz zmiany": only the words change, the felt save icon in front of them stays
function _seSaveLabel(t){const sb=document.getElementById("seSave");if(!sb)return;
  const n=sb.childNodes&&sb.childNodes.length?[...sb.childNodes].reverse().find(x=>x.nodeType===3):null;
  if(n)n.nodeValue=t;else sb.textContent=t;}
// a list action through the unsaved-changes gate of rf-25d (no gate without it: a harness, an older page)
function _seGo(fn){if(typeof SoundRack!=="undefined"&&SoundRack.guard)SoundRack.guard(fn);else fn();}
// read the editor form → a patch object using the same param vocabulary as _mkVoice
function readEditorPatch(){
  const g=id=>document.getElementById(id),num=(id,d)=>{const el=g(id);const v=el?+el.value:NaN;return isFinite(v)?v:d;};
  const chk=id=>{const el=g(id);return !!(el&&el.checked);};
  const val=(id,d)=>{const el=g(id);return el?el.value:d;};
  const legato=(g("seType")&&g("seType").value)!=="pluck";
  const p={legato,wave:val("seWave","sawtooth"),
    oct:num("seOct",0),det:num("seDet",0),
    att:num("seAtt",12)/1000,
    fMin:num("seFMin",260),fMax:Math.max(num("seFMin",260)+50,num("seFMax",7800)),
    q:num("seQ",6),lvl:Math.max(.02,Math.min(.85,num("seLvl",42)/100)),
    sus:num("seSus",100)/100,
    filt:val("seFilt","lowpass"),
    // explicit bools so unchecking can turn OFF a flag merged in from the edited source patch
    sub:chk("seSub"),croak:chk("seCroak"),noise:chk("seNoise")};
  if(legato){p.rel=num("seRel",180)/1000;p.glide=num("seGlide",40)/1000;}   // always persist (0 must round-trip faithfully)
  p.dec=num("seDec",340)/1000;                                              // pluck decay AND legato decay-to-sustain
  if(p.croak)p.am=num("seAm",29);
  const fsw=num("seFSwell",0)/100;if(fsw>0)p.fSwell=fsw;                     // 0..200 (%) → 0..2 s brass swell
  if(chk("seOsc2")){p.osc2=true;p.osc2wave=val("seOsc2Wave","sawtooth");
    p.osc2semi=num("seOsc2Semi",0);p.osc2det=num("seOsc2Det",0);p.osc2mix=num("seOsc2Mix",50)/100;}
  const fenv=num("seFEnv",0)/100;if(fenv!==0){p.fEnv=fenv;p.fEnvT=num("seFEnvT",200)/1000;}   // ±100 % → ±1, time ms→s
  const drv=num("seDrive",0)/100;if(drv>0)p.drive=drv;
  if(window.SoundEditors)SoundEditors.readInto(p);   // wave "custom" → its 64 samples `wt`, the bands, the bends (rf-25e)
  if(window.PadSampler)PadSampler.readInto(p);       // the sound's own sample: `smp` + its tuning and loop (rf-25f)
  return p;
}
// ===================== SOUND LAB — persistent preview bus =====================
//  One workbench instrument (id "__lab__"). Used by Test (arpeggio), press-and-hold, continuous preview and the loop
//  sequencer. Disposed when the editor collapses (and on every labStopAll). The lamp (rf-25c) and the curve panels
//  (rf-25e) read its sound through ONE AnalyserNode on its master, PadPlate's b._plateAn, which goes with the bus.
const LAB_ID="__lab__";
function labInst(){if(!XPAD._lab)XPAD._lab={id:LAB_ID,sound:LAB_ID,vol:82,echo:false,glideMode:"smooth",vib:false,fx:{bright:1,hp:0,tremolo:0}};return XPAD._lab;}
function labPatch(){return sanitizePatch(readEditorPatch())||{wave:"sine",fMin:200,fMax:6000,q:1,lvl:.4,att:.02,legato:true,rel:.2};}
function labEnsure(){
  if(!PadAudio.ensure())return null;PadAudio.resume();
  const inst=labInst();
  XPAD.customSounds[LAB_ID]={name:"lab",emoji:"",patch:labPatch()};
  PadAudio.bus(inst);   // the lamp (rf-25c, PadPlate._feat) and the panels (rf-25e) tap this bus — no analyser here
  return inst;
}
function labSyncPatch(){if(XPAD.customSounds[LAB_ID])XPAD.customSounds[LAB_ID].patch=labPatch();}
// a param changed while editing → refresh the lab patch. Continuous mode re-gates on its own interval;
// a held note is restarted (debounced) so the change is audible while you keep it pressed.
function labParamChanged(){
  if(!XPAD._lab||!XPAD.customSounds[LAB_ID])return;   // lab not started → nothing sounding yet
  labSyncPatch();
  if(!XPAD._labHold)return;
  clearTimeout(XPAD._labRestartT);
  XPAD._labRestartT=setTimeout(()=>{if(XPAD._labHold){PadAudio.gateOff(XPAD._lab,"hold");PadAudio.gateOn(XPAD._lab,"hold",62,.62);}},90);
}
function labArp(){
  const inst=labEnsure();if(!inst)return;labSyncPatch();
  if(XPAD._labArpT)for(const t of XPAD._labArpT)clearTimeout(t);XPAD._labArpT=[];
  const notes=[60,64,67,72];let i=0;
  const step=()=>{if(i>=notes.length){PadAudio.gateOff(inst,"arp");return;}
    PadAudio.gateOn(inst,"arp",notes[i],.62);i++;XPAD._labArpT.push(setTimeout(step,230));};
  step();
}
function labHoldOn(){const inst=labEnsure();if(!inst)return;XPAD._labHold=true;PadAudio.gateOn(inst,"hold",62,.62);}
function labHoldOff(){XPAD._labHold=false;if(XPAD._lab)PadAudio.gateOff(XPAD._lab,"hold");}
// continuous preview = re-trigger the note on a steady interval, so it keeps sounding for ANY patch
// (a legato tone re-attacks; a pluck re-plucks) and always reflects the latest params.
function labContinuous(on){XPAD._labCont=!!on;
  if(XPAD._labContT){clearInterval(XPAD._labContT);XPAD._labContT=null;}
  if(on){const inst=labEnsure();if(!inst)return;
    const hit=()=>{labSyncPatch();PadAudio.gateOn(inst,"cont",62,.6);};
    hit();XPAD._labContT=setInterval(hit,700);}
  else if(XPAD._lab)PadAudio.gateOff(XPAD._lab,"cont");}
function labStopAll(){   // editor collapsed → silence everything + free the lab bus
  XPAD._labCont=false;XPAD._labHold=false;
  if(XPAD._labContT){clearInterval(XPAD._labContT);XPAD._labContT=null;}
  if(XPAD._labArpT){for(const t of XPAD._labArpT)clearTimeout(t);XPAD._labArpT=[];}
  clearTimeout(XPAD._labRestartT);
  seqStop();
  if(XPAD._lab&&PadAudio.buses[LAB_ID])PadAudio.disposeBus(LAB_ID);
  if(XPAD.customSounds[LAB_ID])delete XPAD.customSounds[LAB_ID];
  XPAD._lab=null;
  const c=document.getElementById("seCont");if(c)c.classList.remove("on");
  if(window.SoundScreens)SoundScreens.sleep();   // dark LEDs and a wiped glass (the GL context stays until the editor folds)
  if(window.SoundEditors)SoundEditors.sleep();   // the curve panels end a drag; their live layers fade out
}
// the lab's screens (called each frame from padLoop while anything sounds): the lamp (rf-25c) and the curve panels
// (rf-25e). Each renders at most once per display frame and draws itself on demand when the loop idles.
function labDraw(){
  if(window.SoundScreens)SoundScreens.draw();
  if(window.SoundEditors)SoundEditors.draw();
}
function _slugifySound(name){
  let base=String(name||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
  if(!base)base="brzmienie";base="custom-"+base;
  let slug=base,k=2;while(PAD_PATCH[slug]||XPAD.customSounds[slug]){slug=base+"-"+(k++);}   // unique — never clobber an existing custom sound
  return slug;
}
// ---- manage: add / edit (in place) / delete ----
function _seSyncLabels(){
  const g=id=>document.getElementById(id),set=(vid,val)=>{const v=g(vid);if(v)v.textContent=val;};
  const box=g("soundEditor");if(!box)return;
  ["seDet:seDetV","seAtt:seAttV","seRel:seRelV","seDec:seDecV","seSus:seSusV","seGlide:seGlideV","seFMin:seFMinV","seFMax:seFMaxV","seQ:seQV","seLvl:seLvlV",
   "seAm:seAmV","seFSwell:seFSwellV","seOsc2Semi:seOsc2SemiV","seOsc2Det:seOsc2DetV","seOsc2Mix:seOsc2MixV","seFEnv:seFEnvV","seFEnvT:seFEnvTV","seDrive:seDriveV"]
    .forEach(pair=>{const[a,b]=pair.split(":");const el=g(a);if(el)set(b,el.value);});
  const pluck=g("seType")&&g("seType").value==="pluck";
  const rel=box.querySelector(".se-rel"),sus=box.querySelector(".se-sus");
  if(rel)rel.hidden=pluck;      // Zwolnienie: legato only
  if(sus)sus.hidden=pluck;      // Podtrzymanie: legato only
  const croak=g("seCroak")&&g("seCroak").checked,noise=g("seNoise")&&g("seNoise").checked,osc2=g("seOsc2")&&g("seOsc2").checked;
  const am=box.querySelector(".se-am");if(am)am.hidden=!croak;
  box.querySelectorAll(".se-osc2-detail").forEach(el=>el.hidden=!osc2);
  box.classList.toggle("se-is-noise",!!noise);
  if(window.PadSampler)PadSampler.sync();   // the sample card: labels, the loop fields, the waveform (rf-25f)
  if(window.KnobUI)KnobUI.syncAll();   // CSS dims the osc/filter sections and shows the "noise replaces them" note
}
function _setFormFromPatch(name,emoji,patch){
  const g=id=>document.getElementById(id),set=(id,v)=>{const el=g(id);if(el&&v!=null)el.value=v;},chk=(id,b)=>{const el=g(id);if(el)el.checked=!!b;};
  const p=patch||{};
  set("seName",name||"");set("seEmoji",emoji||"🎛");
  set("seType",p.legato===false?"pluck":"legato");set("seWave",p.wave||"sawtooth");
  set("seFilt",p.filt||"lowpass");
  set("seOct",String(p.oct==null?0:p.oct));set("seDet",String(p.det==null?0:Math.round(p.det)));
  chk("seSub",p.sub);chk("seCroak",p.croak);chk("seNoise",p.noise);
  set("seAtt",String(Math.round((p.att==null?.012:p.att)*1000)));
  set("seRel",String(Math.round((p.rel==null?.18:p.rel)*1000)));
  set("seDec",String(Math.round((p.dec==null?.34:p.dec)*1000)));
  set("seSus",String(Math.round((p.sus==null?1:p.sus)*100)));
  set("seGlide",String(Math.round((p.glide==null?.04:p.glide)*1000)));
  set("seFMin",String(Math.round(p.fMin==null?260:p.fMin)));set("seFMax",String(Math.round(p.fMax==null?7800:p.fMax)));
  set("seQ",String(p.q==null?6:p.q));set("seLvl",String(Math.round((p.lvl==null?.42:p.lvl)*100)));
  set("seAm",String(Math.round(p.am==null?29:p.am)));
  set("seFSwell",String(Math.round((p.fSwell==null?0:p.fSwell)*100)));
  chk("seOsc2",p.osc2);set("seOsc2Wave",p.osc2wave||"sawtooth");
  set("seOsc2Semi",String(p.osc2semi==null?0:Math.round(p.osc2semi)));set("seOsc2Det",String(p.osc2det==null?0:Math.round(p.osc2det)));
  set("seOsc2Mix",String(Math.round((p.osc2mix==null?.5:p.osc2mix)*100)));
  set("seFEnv",String(Math.round((p.fEnv==null?0:p.fEnv)*100)));
  set("seFEnvT",String(Math.round((p.fEnvT==null?.2:p.fEnvT)*1000)));
  set("seDrive",String(Math.round((p.drive==null?0:p.drive)*100)));
  _seSyncLabels();
  if(window.SoundEditors)SoundEditors.load(p);   // the curve panels show this sound's own wave, bands and bends (or none)
  if(window.PadSampler)PadSampler.setForm(p);    // the sample card: this sound's recording, its note and its loop (rf-25f)
}
// live re-patch: pads currently using this sound id get their voices gated off so the new patch takes effect on the next note
function livePatchPadsUsing(id){for(const p of XPAD.pads)if(p.sound===id){PadAudio.gateOffPad(p);p.act={};}}
function _seEditReset(){   // clear both edit-target flags + restore the "new sound" affordances
  XPAD._editingSlug=null;XPAD._editingBase=null;XPAD._editSrcPatch=null;
  _seSaveLabel("Zapisz brzmienie");
  const ce=document.getElementById("seCancelEdit");if(ce)ce.hidden=true;
  const rb=document.getElementById("seResetBase");if(rb)rb.hidden=true;
}
// shared entry: load a sound (base or custom) into the editor form + stash the source patch for merge-preserve
function _seBeginEdit(kind,id,name,emoji,patch,msg){
  if(kind==="base"){XPAD._editingBase=id;XPAD._editingSlug=null;}
  else{XPAD._editingSlug=id;XPAD._editingBase=null;}
  XPAD._editSrcPatch=Object.assign({},patch||{});   // merge-preserve: flags the form can't express survive a re-save
  _setFormFromPatch(name,emoji,patch);
  _seSaveLabel("Zapisz zmiany");
  const ce=document.getElementById("seCancelEdit");if(ce)ce.hidden=false;
  const rb=document.getElementById("seResetBase");if(rb)rb.hidden=!(kind==="base"&&XPAD.baseOverrides&&HAS(XPAD.baseOverrides,id));
  renderSoundList();labParamChanged();
  const box=document.getElementById("soundEditor");if(box)box.open=true;
  const nm=document.getElementById("seName");if(nm)nm.focus();
  _seMsg(msg);
}
function loadSoundIntoEditor(slug){
  const c=XPAD.customSounds[slug];if(!c)return;
  _seBeginEdit("custom",slug,c.name,c.emoji,c.patch,"Edytujesz „"+c.name+"”");
}
function loadBaseIntoEditor(id){
  if(!HAS(PAD_PATCH,id))return;
  const m=soundMeta(id);
  _seBeginEdit("base",id,m.name,m.emoji,padPatchFor(id),"Edytujesz brzmienie bazowe „"+m.name+"”");   // override patch if any, else the frozen default
}
function cancelEdit(){
  _seEditReset();
  const nm=document.getElementById("seName");if(nm)nm.value="";
  renderSoundList();
}
// Osierocone próbki: pliki w Library/Probki/, do których nie ma już brzmienia (nagranie, którego nikt nie zapisał,
// usunięte brzmienie, przywrócone bazowe). Sprzątane z RĄK CZŁOWIEKA — przy zapisie i przy usunięciu — nigdy przy
// starcie: zaraz po starcie stan syntezatora może jeszcze dojeżdżać z serwera i lista „żywych" byłaby niepełna.
function _smpSweep(){try{if(window.PadSampler)PadSampler.sweep();}catch(e){}}
function saveCustomSound(){
  const nameEl=document.getElementById("seName"),emEl=document.getElementById("seEmoji");
  const name=(nameEl&&nameEl.value||"").trim();
  if(!name){   // "Zapisz" stays live and says what it needs: the field gets the focus and the line stays until a name comes
    if(nameEl){try{nameEl.focus();}catch(e){}
      if(!nameEl._needName&&typeof nameEl.addEventListener==="function"){nameEl._needName=true;nameEl.addEventListener("input",function clr(){if(!nameEl.value.trim())return;
        nameEl.removeEventListener("input",clr);nameEl._needName=false;const m=document.getElementById("seMsg");if(m)m.textContent="";});}}
    _seMsg("Najpierw nazwij brzmienie.",false,true);return false;}
  const emoji=(emEl&&emEl.value||"").trim()||"🎛";
  // merge-preserve: form values over the loaded source patch, so any flag the form can't express still survives
  const patch=sanitizePatch(Object.assign({},XPAD._editSrcPatch||{},readEditorPatch()));
  if(XPAD._editingBase&&HAS(PAD_PATCH,XPAD._editingBase)){   // ---- override of a base sound ----
    const id=XPAD._editingBase;
    XPAD.baseOverrides[id]={name,emoji,patch};
    livePatchPadsUsing(id);
    padSave();refreshSoundDropdowns();renderSoundList();
    const rb=document.getElementById("seResetBase");if(rb)rb.hidden=false;
    _smpSweep();_seMsg("Zapisano zmiany brzmienia bazowego „"+name+"”");
    return;
  }
  const editing=XPAD._editingSlug&&XPAD.customSounds[XPAD._editingSlug];
  if(editing){
    const slug=XPAD._editingSlug;
    XPAD.customSounds[slug]={name,emoji,patch};
    livePatchPadsUsing(slug);
    padSave();refreshSoundDropdowns();cancelEdit();
    _smpSweep();_seMsg("Zapisano zmiany w „"+name+"”");
  }else{
    const slug=_slugifySound(name);
    XPAD.customSounds[slug]={name,emoji,patch};
    padSave();refreshSoundDropdowns();renderSoundList();
    if(nameEl)nameEl.value="";
    _smpSweep();_seMsg("Zapisano brzmienie „"+name+"”");
  }
}
// Removing a sound (and resetting a changed base one) can be undone for the app's one undo time (rfUndo, rf-06):
// the entry and the pads that played it are put back and saved. Its recording stays on the disk for that time
// (PadSampler.hold): the orphan sweep after a save would otherwise delete the WAV under the undo.
function _seHoldSample(patch){if(patch&&patch.smp&&window.PadSampler&&PadSampler.hold)PadSampler.hold(patch.smp);}
function _seUndo(o){if(typeof window.rfUndo==="function")window.rfUndo(o);else{o.run();_seMsg(o.msg);}}
function resetBaseSound(id){
  if(!XPAD.baseOverrides||!HAS(XPAD.baseOverrides,id))return;
  const nm=PAD_BASE_META[id]?PAD_BASE_META[id].name:soundMeta(id).name,ov=XPAD.baseOverrides[id];
  _seHoldSample(ov&&ov.patch);
  _seUndo({msg:_gl("Przywrócono domyślne brzmienie „"+nm+"”","Reset “"+nm+"” to its default sound"),clone:false,
    take:()=>ov,
    run:()=>{delete XPAD.baseOverrides[id];livePatchPadsUsing(id);
      if(XPAD._editingBase===id)cancelEdit();
      padSave();refreshSoundDropdowns();renderSoundList();_smpSweep();},
    restore:o=>{XPAD.baseOverrides[id]=o;livePatchPadsUsing(id);padSave();refreshSoundDropdowns();renderSoundList();}});
}
function deleteCustomSound(slug){
  if(!XPAD.customSounds[slug])return;
  const c=XPAD.customSounds[slug],nm=c.name||slug;
  const users=XPAD.pads.filter(p=>p.sound===slug).map(p=>p.id);
  _seHoldSample(c.patch);
  _seUndo({msg:_gl("Usunięto brzmienie „"+nm+"”","Deleted the sound “"+nm+"”"),clone:false,
    take:()=>c,
    run:()=>{delete XPAD.customSounds[slug];
      for(const p of XPAD.pads)if(p.sound===slug){p.sound="ribbit";PadAudio.gateOffPad(p);p.act={};}   // fall back to ribbit
      if(XPAD._editingSlug===slug)cancelEdit();
      padSave();refreshSoundDropdowns();renderSoundList();_smpSweep();},
    restore:e=>{XPAD.customSounds[slug]=e;
      for(const p of XPAD.pads)if(users.includes(p.id)&&p.sound==="ribbit"){p.sound=slug;PadAudio.gateOffPad(p);p.act={};}
      padSave();refreshSoundDropdowns();renderSoundList();}});
}
// fork any sound (base or custom) into a new editable custom copy, then open it for editing
function duplicateSound(kind,id){
  const m=soundMeta(id),patch=sanitizePatch(Object.assign({},padPatchFor(id)));if(!patch)return;
  const nm=(m.name+" (kopia)").slice(0,24),slug=_slugifySound(nm);
  XPAD.customSounds[slug]={name:nm,emoji:m.emoji,patch};
  padSave();refreshSoundDropdowns();
  loadSoundIntoEditor(slug);
  _seMsg("Skopiowano do „"+nm+"”");
}
// ---- dice: "Zaskocz mnie" (scope "all") and one dice per module (scopes "osc" | "filter" | "env" | "char") ----
// Fills the form with a random, PLAYABLE patch: musical ranges, not the sliders' full span; values land on the
// sliders' own steps, so the form shows exactly what was rolled. Nothing is saved (Test, then Zapisz).
// "all" rolls EVERY module, the custom wave, the equaliser bands and the envelope bends included (until 2026-10-02
// it kept a drawn wave and the bands; one button for everything is its job now). A module scope rolls only its
// own fields and takes the rest from the form as it stands — readEditorPatch, which also carries the panels' wave,
// bands and bends (SoundEditors.readInto), so nothing outside the module moves.
// RND_KEYS is the source of what a module owns: randomizePatch clears exactly those fields before the module's roller
// (RND_ROLL) runs, and a roller only SETS fields (the harness holds each roller to its RND_KEYS list, both ways). A
// field belongs to the card its control sits in: the filter swell ("Rozświetlenie") is a slider of the Filtr card.
// The volume never rolls; the name stays; a new emoji only with "all". The result goes through sanitizePatch, so the
// form, the panels (SoundEditors.load in _setFormFromPatch) and a later save all see one valid patch.
// Anything else as the scope (e.g. the Event of a bare click listener) means "all". Returns the patch (or null).
const RND_SCOPES=["all","osc","filter","env","char"];
const RND_KEYS={osc:["wave","wt","oct","det","sub","osc2","osc2wave","osc2semi","osc2det","osc2mix"],
  filter:["filt","fMin","fMax","q","fEnv","fEnvT","fSwell","eq"],
  env:["legato","att","dec","sus","rel","glide","envC"],
  char:["drive","croak","am","noise"]};
const RND_MSG={osc:"Wylosowano: Oscylatory",filter:"Wylosowano: Filtr",env:"Wylosowano: Obwiednia",char:"Wylosowano: Charakter"};
const _rnd=(a,b)=>a+Math.random()*(b-a),_rndPick=a=>a[Math.floor(Math.random()*a.length)],_rndIf=x=>Math.random()<x;
// a random custom wave (64 samples, DC out, peak 1, 3 places). Half the time a harmonic series a_k = r_k / k^p
// (p .6–1.6, 6–16 harmonics, a third of them odd only) through SoundScreens.fromHarmonics; otherwise a smooth random
// curve: 3–5 low harmonics (1..8) with random phases, summed here because fromHarmonics has no phases. The fundamental
// is always the strongest-or-near term, so the played note stays the heard pitch.
function _rndWave(){
  if(_rndIf(.5)){
    const n=Math.round(_rnd(6,16)),pw=_rnd(.6,1.6),odd=_rndIf(.3),a=[];
    for(let k=1;k<=n;k++)a.push(odd&&k%2===0?0:(k===1?1:_rnd(.25,1))/Math.pow(k,pw));
    return Array.from(SoundScreens.fromHarmonics(a),v=>Math.round(v*1000)/1000||0);
  }
  const ks=[1],m=Math.round(_rnd(3,5));
  while(ks.length<m){const k=2+Math.floor(Math.random()*7);if(!ks.includes(k))ks.push(k);}
  const amp=ks.map((k,i)=>i?_rnd(.15,.7)/Math.sqrt(k):_rnd(.7,1)),ph=ks.map(()=>_rnd(0,2*Math.PI)),o=[];
  for(let n=0;n<64;n++){let s=0;for(let i=0;i<ks.length;i++)s+=amp[i]*Math.sin(2*Math.PI*ks[i]*n/64+ph[i]);o.push(s);}
  const mean=o.reduce((s,v)=>s+v,0)/64;let pk=0;for(let n=0;n<64;n++){o[n]-=mean;pk=Math.max(pk,Math.abs(o[n]));}
  return o.map(v=>Math.round((pk>1e-9?v/pk:0)*1000)/1000||0);
}
// The rollers get a patch with their module's fields already cleared (randomizePatch) and only set fields.
// Oscylatory: wave (a custom one 35 % of the time, only with the curve panels and their maths loaded), octave, unison, sub, 2nd oscillator
function _rndOsc(p){
  if(window.SoundEditors&&window.SoundScreens&&_rndIf(.35)){p.wave="custom";p.wt=_rndWave();}
  else p.wave=_rndPick(["sawtooth","square","triangle","sine"]);
  p.oct=_rndPick([-1,0,0,1]);p.det=_rndIf(.5)?0:Math.round(_rnd(3,22));p.sub=_rndIf(.3);
  if(_rndIf(.5)){p.osc2=true;p.osc2wave=_rndPick(["sawtooth","square","triangle","sine"]);
    p.osc2semi=_rndPick([-12,-5,0,7,12]);p.osc2det=Math.round(_rnd(-15,15));p.osc2mix=Math.round(_rnd(25,70))/100;}
}
// Filtr: type, cutoff range, resonance, filter envelope, the brass filter swell (20 %, .1–.6 s; its slider
// „Rozświetlenie” is in this card) and 0–3 equaliser bands (none half the time; f log-random 80 Hz–8 kHz, ±2–10 dB,
// Q .5–4). An empty list clears the screen's bands (sanitizePatch drops it from the patch).
function _rndFilter(p){
  p.filt=_rndPick(["lowpass","lowpass","highpass","bandpass","notch"]);
  p.fMin=Math.round(_rnd(12,60))*10;p.fMax=Math.round(_rnd(22,90))*100;p.q=Math.round(_rnd(6,90))/10;
  if(_rndIf(.45)){p.fEnv=Math.round(_rnd(-80,90))/100;p.fEnvT=Math.round(_rnd(10,160))*5/1000;}
  if(_rndIf(.2))p.fSwell=Math.round(_rnd(2,12))*5/100;
  p.eq=[];
  if(_rndIf(.5)){const n=1+Math.floor(Math.random()*3);
    for(let i=0;i<n;i++)p.eq.push({f:Math.round(80*Math.pow(100,Math.random())),
      g:Math.round((_rndIf(.5)?-1:1)*_rnd(2,10)*10)/10,q:Math.round(_rnd(.5,4)*100)/100});
    p.eq.sort((a,b)=>a.f-b.f);}
}
// Obwiednia: legato or plucked, ADSR, glide, and the bends — each 60 % of the time somewhere in ±.8, else 0 (the
// release one only for legato, a plucked voice has no release; release and glide are legato-only like the form's)
function _rndEnv(p){
  const legato=_rndIf(.6);p.legato=legato;
  p.att=Math.round(legato?_rnd(5,250):_rnd(2,20))/1000;
  p.dec=Math.round(_rnd(10,90))*10/1000;p.sus=Math.round(_rnd(40,100))/100;
  if(legato){p.rel=Math.round(_rnd(8,70))*10/1000;p.glide=Math.round(_rnd(0,24))*5/1000;}
  const bend=()=>_rndIf(.6)?Math.round(_rnd(-.8,.8)*100)/100||0:0;
  p.envC=[bend(),bend(),legato?bend():0];
}
// Charakter: drive (35 %), the frog croak (12 %, AM 8–40 Hz), noise (3 %)
function _rndChar(p){
  if(_rndIf(.35))p.drive=Math.round(_rnd(15,70))/100;
  p.croak=_rndIf(.12);if(p.croak)p.am=Math.round(_rnd(8,40));
  p.noise=_rndIf(.03);
}
const RND_ROLL={osc:_rndOsc,filter:_rndFilter,env:_rndEnv,char:_rndChar};
function randomizePatch(scope){
  scope=RND_SCOPES.includes(scope)?scope:"all";
  const all=scope==="all",cur=readEditorPatch();
  const lvEl=document.getElementById("seLvl"),lvRaw=lvEl?lvEl.value:null;
  const p=all?{}:Object.assign({},cur);
  for(const s in RND_KEYS)if(all||scope===s){for(const k of RND_KEYS[s])delete p[k];RND_ROLL[s](p);}
  p.lvl=cur.lvl;   // randomizing must not change the volume — keep the current level
  const out=sanitizePatch(p);if(!out)return null;
  const nmEl=document.getElementById("seName"),emEl=document.getElementById("seEmoji");
  const emoji=all?_rndPick(["🎛","🌈","🔥","🌊","👾","🛸","✨","🎲","🌀","💫"]):((emEl&&emEl.value)||"🎛");
  _setFormFromPatch(nmEl&&nmEl.value||"",emoji,out);
  // the knob stays where it was: above 85 the form reads .85 anyway (readEditorPatch), so writing it back would move it
  if(lvEl&&lvRaw!=null&&lvEl.value!==lvRaw){lvEl.value=lvRaw;const lb=document.getElementById("seLvlV");if(lb)lb.textContent=lvRaw;
    if(window.KnobUI)KnobUI.syncAll();}
  labParamChanged();
  _seMsg(all?"Wylosowano brzmienie. Dostrój je i zapisz.":RND_MSG[scope]);
  return out;
}
// selectable library list: base + custom together, click a row to load it into the editor (replaces the old pills)
function renderSoundList(){
  const wrap=document.getElementById("seList");if(!wrap)return;
  wrap.setAttribute("role","listbox");wrap.setAttribute("aria-label","Biblioteka brzmień");
  const rows=PAD_SOUND_LIST.map(s=>({kind:"base",id:s[0]}))
    .concat(Object.keys(XPAD.customSounds||{}).filter(k=>k.slice(0,2)!=="__").map(k=>({kind:"custom",id:k})));
  const editingId=XPAD._editingBase||XPAD._editingSlug;
  wrap.innerHTML="";
  for(const r of rows){
    const m=soundMeta(r.id),over=(r.kind==="base"&&m.overridden);
    const row=document.createElement("div");
    row.className="se-row"+(r.id===editingId?" editing":"");
    row.setAttribute("role","option");row.dataset.kind=r.kind;row.dataset.id=r.id;
    row.setAttribute("aria-selected",r.id===editingId?"true":"false");row.tabIndex=-1;
    const badge=r.kind==="base"
      ?(over?'<span class="se-row-badge se-b-over">zmienione</span>':'<span class="se-row-badge se-b-base">bazowe</span>')
      :'<span class="se-row-badge se-b-custom">własne</span>';
    row.innerHTML=`<span class="se-row-emoji" aria-hidden="true">${esc(m.emoji)}</span>`+
      `<span class="se-row-name" translate="no" data-noi18n>${esc(m.name)}</span>`+badge+
      `<span class="se-row-acts">`+
        `<button type="button" class="se-edit" title="Edytuj" aria-label="${_gl('Edytuj','Edit')} ${esc(m.name)}"><span class="rfic spray-ic sm" aria-hidden="true"></span></button>`+
        `<button type="button" class="se-dup" title="Duplikuj do własnego brzmienia" aria-label="${_gl('Duplikuj','Duplicate')} ${esc(m.name)}">⧉</button>`+
        (r.kind==="custom"
          ?`<button type="button" class="se-del" title="Usuń brzmienie" aria-label="${_gl('Usuń','Delete')} ${esc(m.name)}">✕</button>`
          :(over?`<button type="button" class="se-reset" title="Przywróć domyślny" aria-label="Przywróć domyślny ${esc(m.name)}">↺</button>`:``))+
      `</span>`;
    const load=()=>_seGo(()=>{r.kind==="base"?loadBaseIntoEditor(r.id):loadSoundIntoEditor(r.id);});
    row.addEventListener("click",e=>{if(e.target.closest(".se-row-acts"))return;load();});
    row.querySelector(".se-edit").onclick=e=>{e.stopPropagation();load();};
    row.querySelector(".se-dup").onclick=e=>{e.stopPropagation();_seGo(()=>duplicateSound(r.kind,r.id));};
    const del=row.querySelector(".se-del");if(del)del.onclick=e=>{e.stopPropagation();deleteCustomSound(r.id);};
    const rst=row.querySelector(".se-reset");if(rst)rst.onclick=e=>{e.stopPropagation();resetBaseSound(r.id);};
    wrap.appendChild(row);
  }
  _seListBindKeys(wrap);
}
// keyboard nav for the selectable list (roving highlight; Enter loads, Delete removes a custom / resets a base).
// Only the rows on screen count: a row the search or the kind chip hides (`hidden`) is never highlighted, loaded or
// deleted, not even the one being edited. Enter / Delete on a focused key inside a row belong to that key.
// (rf-25d answers these keys first in a capture listener, the same way; this one serves a list without it.)
function _seListBindKeys(wrap){
  if(wrap._keyBound)return;wrap._keyBound=true;wrap.tabIndex=0;
  wrap.addEventListener("keydown",e=>{
    if((e.key==="Enter"||e.key==="Delete"||e.key==="Backspace")&&e.target!==wrap)return;
    const rows=[...wrap.querySelectorAll(".se-row")].filter(r=>!r.hidden);if(!rows.length)return;
    let i=rows.findIndex(r=>r.classList.contains("kb-focus"));
    if(i<0)i=rows.findIndex(r=>r.classList.contains("editing"));
    const focus=j=>{j=Math.max(0,Math.min(rows.length-1,j));rows.forEach(r=>r.classList.remove("kb-focus"));
      rows[j].classList.add("kb-focus");try{rows[j].scrollIntoView({block:"nearest"});}catch(_){}};
    if(e.key==="ArrowDown"){e.preventDefault();focus(i<0?0:i+1);}
    else if(e.key==="ArrowUp"){e.preventDefault();focus(i<0?rows.length-1:i-1);}
    else if(e.key==="Home"){e.preventDefault();focus(0);}
    else if(e.key==="End"){e.preventDefault();focus(rows.length-1);}
    else if(e.key==="Enter"){if(i>=0){e.preventDefault();rows[i].click();}}
    else if(e.key==="Delete"||e.key==="Backspace"){if(i>=0){e.preventDefault();
      const del=rows[i].querySelector(".se-del"),rst=rows[i].querySelector(".se-reset");
      if(del)del.click();else if(rst)rst.click();}}
  });
}
// rebuild every sound dropdown after the custom-sound list changes
function refreshSoundDropdowns(){
  renderPlayPads();   // each pad card rebuilds its sound select (preserving p.sound)
}
// ---- looping step sequencer (draw notes on a grid, loop through the lab bus) ----
const SEQ_STEPS=16;
function seqRows(){const notes=padNotes({base:60,oct:1});return notes.slice().reverse();}   // one octave of the current scale, high on top
// ---- note-segment model: each note is {note(pitch), start(step), len}. A single-step note is
//   len 1 (a SEPARATE note, re-attacked); a multi-step note is ONE LONG held note (sustained). ----
function seqEnsure(){if(!XPAD._seq)XPAD._seq={bpm:120,swing:0,playing:false,pos:-1,notes:[],sounding:{},_t:null,_pid:null,_drag:null};return XPAD._seq;}
function _seqEnd(nt){return Math.min(nt.start+nt.len-1,SEQ_STEPS-1);}
function _seqNoteAt(pitch,step){return XPAD._seq.notes.find(nt=>nt.note===pitch&&step>=nt.start&&step<=_seqEnd(nt))||null;}
// drop notes on `row` overlapping [from,to] (except `keep`) — so a new note replaces what it covers
function _seqClearRange(row,from,to,keep){XPAD._seq.notes=XPAD._seq.notes.filter(nt=>
  nt===keep||nt.note!==row||_seqEnd(nt)<from||nt.start>to);}
function renderSeqGrid(){
  const grid=document.getElementById("seqGrid");if(!grid)return;
  const rows=seqRows();seqEnsure();
  grid.style.setProperty("--steps",SEQ_STEPS);grid.innerHTML="";
  for(const note of rows){
    const row=document.createElement("div");row.className="seq-row";
    // a piano key turned sideways + the note name, the way synth piano rolls draw it (owner, 2026-09-30).
    // Press and hold the key to hear the note; it goes down on its own while the loop plays that note.
    const lbl=document.createElement("span");lbl.className="seq-note-lbl";
    const sharp=[1,3,6,8,10].includes(((note%12)+12)%12);
    lbl.innerHTML=`<button type="button" class="seq-key${sharp?" sharp":""}" data-note="${note}" aria-label="${miNoteName(note)}" title="${_gl("Przytrzymaj, żeby usłyszeć nutę","Hold to hear the note")}"></button><span class="seq-key-name">${miNoteName(note)}</span>`;
    _seqBindKey(lbl.firstChild,note);row.appendChild(lbl);
    for(let st=0;st<SEQ_STEPS;st++){
      const cell=document.createElement("button");cell.type="button";
      cell.className="seq-cell"+(st%4===0?" beat":"");
      cell.dataset.note=note;cell.dataset.step=st;cell.setAttribute("aria-label",miNoteName(note)+" krok "+(st+1));
      row.appendChild(cell);
    }
    grid.appendChild(row);
  }
  _seqBindPaint(grid);_seqRefresh();
}
// paint cell on/off + segment shape (single / start / mid / end) from the notes model — no DOM rebuild
function _seqRefresh(){
  const grid=document.getElementById("seqGrid");if(!grid)return;const s=XPAD._seq;
  const map={};
  for(const nt of s.notes){const end=_seqEnd(nt),single=nt.start===end,m=map[nt.note]||(map[nt.note]={});
    for(let st=nt.start;st<=end;st++)m[st]=single?"single":(st===nt.start?"start":(st===end?"end":"mid"));}
  grid.querySelectorAll(".seq-cell").forEach(c=>{
    const role=map[+c.dataset.note]&&map[+c.dataset.note][+c.dataset.step];
    c.classList.toggle("on",!!role);
    c.classList.toggle("seg-single",role==="single");c.classList.toggle("seg-start",role==="start");
    c.classList.toggle("seg-mid",role==="mid");c.classList.toggle("seg-end",role==="end");
  });
  seqPaintPlayhead();
}
// draw: press an EMPTY cell → new 1-step (separate) note; DRAG horizontally → one LONG (held) note.
//       press a FILLED cell → erase that note (drag to erase more).
function _seqBindPaint(grid){
  const cellAt=(x,y)=>{const el=document.elementFromPoint(x,y);return el&&el.closest?el.closest(".seq-cell"):null;};
  grid.onpointerdown=e=>{const cell=e.target&&e.target.closest&&e.target.closest(".seq-cell");if(!cell)return;
    if(e.pointerType==="mouse"&&e.button!==0)return;e.preventDefault();
    const s=XPAD._seq,p=+cell.dataset.note,st=+cell.dataset.step,hit=_seqNoteAt(p,st);
    if(hit){s.notes=s.notes.filter(n=>n!==hit);s._drag={mode:"erase"};}          // press a note → erase
    else{const nt={note:p,start:st,len:1};s.notes.push(nt);s._drag={mode:"draw",note:nt,row:p,anchor:st};}  // else new note
    _seqRefresh();
    s._pid=e.pointerId;try{grid.setPointerCapture(e.pointerId);}catch(err){}};
  grid.onpointermove=e=>{const s=XPAD._seq;if(s._pid!==e.pointerId||!s._drag)return;
    const cell=cellAt(e.clientX,e.clientY);if(!cell)return;
    const p=+cell.dataset.note,st=+cell.dataset.step;
    if(s._drag.mode==="erase"){const hit=_seqNoteAt(p,st);if(hit){s.notes=s.notes.filter(n=>n!==hit);_seqRefresh();}return;}
    if(p!==s._drag.row)return;   // a note keeps its pitch (anchor row); horizontal drag sets its length
    const from=Math.min(s._drag.anchor,st),to=Math.max(s._drag.anchor,st);
    s._drag.note.start=from;s._drag.note.len=to-from+1;
    _seqClearRange(s._drag.row,from,to,s._drag.note);   // this long note overrides what it covers
    _seqRefresh();};
  const end=e=>{const s=XPAD._seq;if(s._pid!==e.pointerId)return;s._pid=null;s._drag=null;};
  grid.onpointerup=end;grid.onpointercancel=end;grid.onlostpointercapture=end;
  grid.oncontextmenu=e=>e.preventDefault();
}
function seqPaintPlayhead(){
  const grid=document.getElementById("seqGrid");if(!grid)return;const s=XPAD._seq;
  grid.querySelectorAll(".seq-cell").forEach(c=>c.classList.toggle("playhead",!!(s&&s.playing&&+c.dataset.step===s.pos)));
  // the keyboard plays along: a key is down while the loop sounds its note (or a finger holds it)
  grid.querySelectorAll(".seq-key").forEach(k=>k.classList.toggle("down",!!(k._held||(s&&s.sounding&&s.sounding[+k.dataset.note]))));
}
// a key held down = that note sounding on the lab instrument, released = note off
function _seqBindKey(key,note){
  const off=()=>{if(!key._held)return;key._held=false;const inst=XPAD._lab;if(inst)PadAudio.gateOff(inst,"key:"+note);seqPaintPlayhead();};
  key.addEventListener("pointerdown",e=>{if(e.pointerType==="mouse"&&e.button!==0)return;e.preventDefault();
    const inst=labEnsure();if(!inst)return;labSyncPatch();PadAudio.resume();
    key._held=true;PadAudio.gateOn(inst,"key:"+note,note,.62);try{key.setPointerCapture(e.pointerId);}catch(err){}seqPaintPlayhead();});
  key.addEventListener("pointerup",off);key.addEventListener("pointercancel",off);key.addEventListener("lostpointercapture",off);
  key.addEventListener("contextmenu",e=>e.preventDefault());
}
function seqPlay(){
  const s=seqEnsure();if(s.playing){seqStop();return;}
  const inst=labEnsure();if(!inst)return;labSyncPatch();
  s.playing=true;s.pos=-1;s.sounding={};
  const btn=document.getElementById("seqPlay");if(btn){btn.classList.add("on");btn.textContent=_gl("⏹ Zatrzymaj","⏹ Stop");}
  const tick=()=>{
    if(!s.playing)return;
    s.pos=(s.pos+1)%SEQ_STEPS;labSyncPatch();
    // which note (if any) covers each pitch at this step
    const cover={};for(const nt of s.notes)if(nt.start<=s.pos&&s.pos<=_seqEnd(nt))cover[nt.note]=nt;
    const pitches=new Set();for(const k in cover)pitches.add(+k);for(const k in s.sounding)pitches.add(+k);
    for(const pitch of pitches){const cur=cover[pitch],snd=s.sounding[pitch];
      if(cur){   // new note (different segment) → re-attack; same segment continuing → hold (sustain)
        if(!snd||snd.ref!==cur){if(snd)PadAudio.gateOff(inst,"seq:"+pitch);PadAudio.gateOn(inst,"seq:"+pitch,pitch,.62);s.sounding[pitch]={ref:cur};}}
      else if(snd){PadAudio.gateOff(inst,"seq:"+pitch);delete s.sounding[pitch];}
    }
    seqPaintPlayhead();
    if(!s.playing)return;
    // classic 16th swing (shuffle): even step→odd gap stretched, odd→even compressed.
    // Read bpm+swing live so changes apply from the next step. swing=0 → base every step (identical to before).
    const base=60000/s.bpm/4;
    const sw=Math.max(0,Math.min(60,+s.swing||0))/100;
    const factor=(s.pos%2===0)?(1+sw):(1-sw);
    s._t=setTimeout(tick,Math.max(60,base*factor));   // 16th notes (swing-shifted)
  };
  tick();
}
function seqStop(){
  const s=XPAD._seq;if(!s)return;s.playing=false;s.pos=-1;
  if(s._t){clearTimeout(s._t);s._t=null;}
  if(XPAD._lab&&PadAudio.buses[LAB_ID]){const bus=PadAudio.buses[LAB_ID];for(const src of Object.keys(bus.voices))if(src.slice(0,4)==="seq:")PadAudio.gateOff(XPAD._lab,src);}
  s.sounding={};
  const btn=document.getElementById("seqPlay");if(btn){btn.classList.remove("on");btn.textContent=_gl("▶ Zapętl","▶ Loop");}
  seqPaintPlayhead();
}
function seqClear(){const s=seqEnsure();s.notes=[];_seqRefresh();}
function seqSetBpm(b){const s=seqEnsure();s.bpm=Math.max(40,Math.min(240,+b||120));}   // read live in tick → no restart, applies from next step
function seqSetSwing(v){const s=seqEnsure();s.swing=Math.max(0,Math.min(60,+v||0));}     // % delay of off-beat 16ths; read live in tick
function initSoundEditor(){
  const g=id=>document.getElementById(id);
  const box=g("soundEditor");if(!box)return;
  // param inputs: live value label + rel/dec toggle + live lab update
  const paramV={seDet:"seDetV",seAtt:"seAttV",seRel:"seRelV",seDec:"seDecV",seSus:"seSusV",seGlide:"seGlideV",seFMin:"seFMinV",seFMax:"seFMaxV",seQ:"seQV",seLvl:"seLvlV",
    seAm:"seAmV",seFSwell:"seFSwellV",seOsc2Semi:"seOsc2SemiV",seOsc2Det:"seOsc2DetV",seOsc2Mix:"seOsc2MixV",seFEnv:"seFEnvV",seFEnvT:"seFEnvTV",seDrive:"seDriveV"};
  for(const id in paramV){const el=g(id);if(el)el.addEventListener("input",()=>{const v=g(paramV[id]);if(v)v.textContent=el.value;labParamChanged();});}
  for(const id of ["seType","seWave","seOct","seFilt","seOsc2Wave"]){const el=g(id);if(el)el.addEventListener("change",()=>{if(id==="seType")_seSyncLabels();labParamChanged();});}
  for(const id of ["seSub","seCroak","seNoise","seOsc2"]){const el=g(id);if(el)el.addEventListener("change",()=>{_seSyncLabels();labParamChanged();});}
  // the sample card's own fields (rf-25f): the note and the loop are patch values like any other knob
  for(const id of ["seSmpRoot","seSmpFrom","seSmpTo"]){const el=g(id);if(el)el.addEventListener("input",()=>{_seSyncLabels();labParamChanged();});}
  {const el=g("seSmpLoop");if(el)el.addEventListener("change",()=>{_seSyncLabels();labParamChanged();});}
  _seSyncLabels();
  // preview: arpeggio / press-hold / continuous
  const tb=g("seTest");if(tb)tb.addEventListener("click",labArp);
  const hb=g("seHold");
  if(hb){const dn=e=>{e.preventDefault();hb.classList.add("pressed");labHoldOn();};
    const up=()=>{hb.classList.remove("pressed");labHoldOff();};
    hb.addEventListener("pointerdown",dn);hb.addEventListener("pointerup",up);
    hb.addEventListener("pointerleave",up);hb.addEventListener("pointercancel",up);}
  const cb=g("seCont");if(cb)cb.addEventListener("click",()=>{const on=!XPAD._labCont;cb.classList.toggle("on",on);labContinuous(on);});
  // save / edit / randomize / reset-base
  const sb=g("seSave");if(sb)sb.addEventListener("click",saveCustomSound);
  const ce=g("seCancelEdit");if(ce)ce.addEventListener("click",cancelEdit);
  const rndB=g("seRandom");if(rndB)rndB.addEventListener("click",()=>randomizePatch("all"));
  const rbB=g("seResetBase");if(rbB)rbB.addEventListener("click",()=>{if(XPAD._editingBase)resetBaseSound(XPAD._editingBase);});
  // sequencer
  seqEnsure();renderSeqGrid();
  const sp=g("seqPlay");if(sp)sp.addEventListener("click",seqPlay);
  const scl=g("seqClear");if(scl)scl.addEventListener("click",seqClear);
  const sbpm=g("seqBpm");if(sbpm)sbpm.addEventListener("input",()=>{const v=g("seqBpmV");if(v)v.textContent=sbpm.value;seqSetBpm(+sbpm.value);});
  const sswing=g("seqSwing");if(sswing)sswing.addEventListener("input",()=>{const v=g("seqSwingV");if(v)v.textContent=sswing.value;seqSetSwing(+sswing.value);});
  // collapse → silence + free the lab; open → refresh grid (scale may have changed). Guard: nested section <details> must not trigger this.
  box.addEventListener("toggle",e=>{if(e.target!==box)return;if(box.open)renderSeqGrid();else labStopAll();});
  renderSoundList();
  if(window.SoundScreens)SoundScreens.init();   // the oscilloscope above the rack (rf-25c): a visualisation only
  if(window.SoundEditors)SoundEditors.init();   // the curve panels in the module cards (rf-25e): wave, equaliser, envelope
  if(window.SoundRack)SoundRack.init();         // the rack layout (rf-25d): sound bar, library column, module cards
  if(window.PadSampler)PadSampler.init();       // the sample card (rf-25f): microphone, file, waveform, note and loop
}
// options listing the play pads (for a fx-pad TARGET select) — which instrument's bus it steers
function padTargetOptions(sel){
  const play=XPAD.pads.map((p,i)=>
    `<option value="${p.id}"${p.id===sel?" selected":""}>${esc(p.name||("Pad "+(i+1)))}</option>`).join("");
  const seq=(XPAD.seqPads||[]);
  if(!seq.length)return play;   // no programmed pad → the select looks exactly as it always did
  return `<optgroup label="Pady grające">${play}</optgroup><optgroup label="Pady zaprogramowane">`+
    seq.map(p=>`<option value="${p.id}"${p.id===sel?" selected":""}>${esc(p.name)}</option>`).join("")+`</optgroup>`;}
function renderFxPads(){
  const wrap=document.getElementById("fxPads");if(!wrap)return;
  wrap.innerHTML="";
  const sec=document.getElementById("fxPadsSec");if(sec)sec.hidden=!XPAD.fxPads.length;   // empty section = not shown
  const devs=padDevList();
  const opts=sel=>Object.keys(FX_PARAMS).map(k=>`<option value="${k}"${k===sel?" selected":""}>${FX_PARAMS[k]}</option>`).join("");
  for(const p of XPAD.fxPads){
    if(!p.target||!(XPAD.pads.some(x=>x.id===p.target)||(XPAD.seqPads||[]).some(x=>x.id===p.target)))p.target=XPAD.pads[0].id;
    const card=document.createElement("div");card.className="fxpad";card.dataset.id=p.id;
    // THE TARGET FIELD IS ALWAYS THERE, even with a single play pad. It used to appear only from
    // the second pad on, so the usual screen (one pad) showed a card that steers "some" instrument
    // without ever saying which — while the guide names this exact field. With one pad the select
    // has one option and answers the question by standing there with that pad's name in it.
    card.innerHTML=`<button class="fxpad-rm" type="button" title="Usuń ten pad efektów" aria-label="Usuń">✕</button>`+
      `<div class="fxpad-sec-lbl">Steruje padem grającym</div>`+
      `<label class="fxpad-target" title="Którym padem grającym steruje ten pad efektów"><span class="bic bic-star" aria-hidden="true"></span><select class="fx-target" aria-label="Którym padem grającym steruje ten pad efektów">${padTargetOptions(p.target)}</select></label>`+
      `<div class="fxpad-sec-lbl">Efekt na osiach</div>`+
      `<div class="fxpad-h"><label class="fxpad-xy"><span class="fx-ax">X</span><select class="fx-xp">${opts(p.xp)}</select></label>`+
      `<label class="fxpad-xy"><span class="fx-ax">Y</span><select class="fx-yp">${opts(p.yp)}</select></label></div>`+
      `<div class="fxpad-look"><label class="fxpad-plate" title="Tło pada efektów — reaguje na dźwięk pada, którym ten pad steruje"><span>Tło</span><select class="fx-plate" aria-label="Tło pada efektów">${padPlateOptionsHTML(p.plate)}</select></label>`+
      `<button class="btn sm fx-sv${p.scaleView!==false?" on":""}" type="button" role="switch" aria-checked="${p.scaleView!==false}" title="Pokaż albo schowaj siatkę i opisy osi na tym padzie">Skala</button></div>`+
      `<div class="fxpad-cw"><canvas class="fxpad-cv"></canvas></div>`+
      `<label class="fxpad-drag" title="Drag — jak ospale albo żwawo efekt goni wskazane miejsce">🖱 Drag dotyku<input class="fx-dragr" type="range" min="0" max="100" step="1" value="${p.drag==null?40:p.drag}"></label>`+
      `<div class="fxpad-caps"></div>`;
    const tsel=card.querySelector(".fx-target");if(tsel)tsel.onchange=e=>{p.target=e.target.value;padSave();};
    card.querySelector(".fx-xp").onchange=e=>{p.xp=e.target.value;padSave();};
    card.querySelector(".fx-yp").onchange=e=>{p.yp=e.target.value;padSave();};
    card.querySelector(".fx-dragr").oninput=e=>{p.drag=+e.target.value||0;padSave();};
    card.querySelector(".fx-plate").onchange=e=>{p.plate=e.target.value;padSave();if(window._padWake)window._padWake();};
    {const sv=card.querySelector(".fx-sv");sv.onclick=()=>{p.scaleView=p.scaleView===false;
      sv.classList.toggle("on",p.scaleView);sv.setAttribute("aria-checked",String(p.scaleView));padSave();};}
    card.querySelector(".fxpad-rm").onclick=()=>{const i=XPAD.fxPads.indexOf(p);
      _seUndo({msg:_gl("Usunięto pad efektów","Deleted the effects pad"),clone:false,take:()=>p,
        run:()=>{XPAD.fxPads=XPAD.fxPads.filter(x=>x!==p);renderFxPads();padSave();},
        restore:q=>{if(XPAD.fxPads.includes(q))return;q.ptr=null;q._pid=null;
          XPAD.fxPads.splice(Math.min(i<0?XPAD.fxPads.length:i,XPAD.fxPads.length),0,q);renderFxPads();padSave();}});};
    _renderFxCapsule(p,card.querySelector(".fxpad-caps"),devs);   // ONE capsule per fx pad (single select)
    _fxBindPointer(card.querySelector(".fxpad-cv"),p);
    wrap.appendChild(card);
  }
}
function addFxPad(){
  const np={id:"fx"+(++XPAD._fxSeq),xp:"echo",yp:"bright",target:XPAD.pads[0].id,
    capsel:"",dev:{},drag:40,plate:"staw",scaleView:true,ptr:null,cur:{x:.5,y:.5},_pid:null,_dstamp:{}};
  XPAD.fxPads.push(np);
  renderFxPads();padSave();
  const wrap=document.getElementById("fxPads");
  const card=wrap&&wrap.querySelector('.fxpad[data-id="'+np.id+'"]');
  if(card&&window.rfPopNew)window.rfPopNew(card);   // ONLY the freshly added fx pad animates
}
// ONE capsule per effects pad: a select for which capsule steers it (or touch), + that capsule's axes/range/drag
function _renderFxCapsule(fp,wrap,devs){
  wrap.innerHTML='<div class="cap-h">Kapsel sterujący (jeden naraz)</div>';
  if(!devs.length){wrap.insertAdjacentHTML("beforeend",'<span class="hint">Brak połączonych kapsli. Steruj palcem na padzie.</span>');return;}
  if(fp.capsel&&!devs.some(d=>d.id===fp.capsel))fp.capsel="";   // selected capsule gone
  const sel=document.createElement("label");sel.className="cap-fld cap-sel";
  sel.innerHTML='<span>Kapsel</span><select class="fxcap-sel"><option value="">tylko palec</option>'+
    devs.map(d=>`<option value="${d.id}"${fp.capsel===d.id?" selected":""}>${esc(d.name)}</option>`).join("")+'</select><span class="fxcap-prevwrap" aria-hidden="true"></span>';
  wrap.appendChild(sel);
  const axWrap=document.createElement("div");wrap.appendChild(axWrap);
  const renderAx=()=>{
    if(!fp.capsel){axWrap.className="";axWrap.innerHTML='<span class="hint">Steruj efektem palcem na padzie.</span>';return;}
    const cfg=padDevCfg(fp.dev,fp.capsel,true);
    axWrap.className="cap-grid";
    axWrap.innerHTML=
      `<label class="cap-fld"><span>Oś X</span><select class="cap-axx">${padAxisOptionsHTML(cfg.axX)}</select></label>`+
      `<label class="cap-fld"><span>Oś Y</span><select class="cap-axy">${padAxisOptionsHTML(cfg.axY)}</select></label>`+
      `<label class="cap-fld"><span>Zakres ±<b class="cap-rangev">${cfg.range}</b>°</span><input class="cap-range" type="range" min="15" max="180" step="5" value="${cfg.range}"></label>`+
      `<label class="cap-fld"><span>🖱 Drag</span><input class="cap-drag" type="range" min="0" max="100" value="${cfg.drag}"></label>`+
      padInvCurRowHTML(cfg);
    const q=s=>axWrap.querySelector(s);
    q(".cap-axx").onchange=e=>{cfg.axX=e.target.value;padSave();};
    q(".cap-axy").onchange=e=>{cfg.axY=e.target.value;padSave();};
    q(".cap-range").oninput=e=>{cfg.range=+e.target.value||45;const v=q(".cap-rangev");if(v)v.textContent=String(cfg.range);padSave();};
    q(".cap-drag").oninput=e=>{cfg.drag=+e.target.value||0;padSave();};
    wirePadInvCur(cfg,q);
  };
  const _fxPrev=sel.querySelector(".fxcap-prevwrap"); const _fxSetPrev=()=>{if(_fxPrev)_fxPrev.innerHTML=fp.capsel?capImgSpan(fp.capsel,20):"";}; _fxSetPrev();
  sel.querySelector(".fxcap-sel").onchange=e=>{fp.capsel=e.target.value||"";padSave();_fxSetPrev();renderAx();};
  renderAx();
}
function _fxBindPointer(cv,p){
  if(!cv)return;
  p._cv=cv;p._pid=null;p.ptr=null;   // fresh canvas after a rebuild → clear any stale capture/frozen touch
  const xy=e=>{const r=cv.getBoundingClientRect();
    return {x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),
            y:Math.max(0,Math.min(1,1-(e.clientY-r.top)/r.height))};};
  cv.addEventListener("contextmenu",e=>e.preventDefault());
  cv.addEventListener("pointerdown",e=>{if(e.pointerType==="mouse"&&e.button!==0)return;if(p._pid!=null)return;
    p._pid=e.pointerId;try{cv.setPointerCapture(e.pointerId);}catch(err){}PadAudio.resume();p.ptr=xy(e);_padWake();e.preventDefault();});   // wake loop from idle NOW
  cv.addEventListener("pointermove",e=>{if(p._pid!==e.pointerId||!p.ptr)return;p.ptr=xy(e);});
  const up=e=>{if(p._pid!==e.pointerId)return;p._pid=null;p.ptr=null;};
  cv.addEventListener("pointerup",up);cv.addEventListener("pointercancel",up);
  cv.addEventListener("lostpointercapture",up);   // some browsers only fire this on node removal
}
// neutral/base value (per instrument) for each effect param when NO fx pad is driving it — so an
// effects pad is a LIVE control (release → the effect returns to that pad's manual setting), and echo
// respects the pad's Echo toggle. Prevents the "stuck muffled" trap. bright/hp/tremolo = pad's manual base.
function _fxBaseVal(inst,k){
  if(k==="echo")return inst.echo?.714:0;
  // switched-off effect → its transparent value (padFxVal); switched on → the pad's manual level
  if(k==="bright"||k==="hp"||k==="tremolo")return padFxVal(inst,k);
  if(k==="delay")return .41;
  if(k==="fb")return .447;
  if(k==="pan")return .5;   // 0.5 = centre
  return 0;                 // reverb / drive / wah → transparent
}
function fxTick(){
  if(!XPAD.enabled)return;
  const nowP=performance.now(),driven={};   // driven[padId] = {param:1,…}
  const dtF=_fxFrameDt(nowP);               // frame time for dt-based glide
  for(const p of XPAD.fxPads){
    const tgt=synthInstById(p.target);if(!tgt){p._active=false;continue;}
    let src=p.ptr,pickedDrag=null;   // touch → pad.drag; capsule → that capsule's own drag
    if(!src&&p.capsel){   // no touch → the ONE selected capsule (single per fx pad) maps pose through its axes/range
      const id=p.capsel,cfg=p.dev[id],D=(state.devices||{})[id];
      if(cfg&&D&&!devSoundOff(D)){
        const aid=state.activeDeviceId,pose=(id===aid&&state.pose)?state.pose:D.poseLive;
        if(!p._dstamp)p._dstamp={};const st=p._dstamp[id]||(p._dstamp[id]={ref:null,at:0});
        if(pose&&pose!==st.ref){st.ref=pose;st.at=nowP;}
        if(pose&&nowP-st.at<900){const raw=(id===aid)?state.last:null;src=padPoseXY(cfg,pose,raw);pickedDrag=cfg.drag;}
      }
    }
    if(src){const df=dragFactorDt(pickedDrag==null?p.drag:pickedDrag,dtF);p.cur.x+=(src.x-p.cur.x)*df;p.cur.y+=(src.y-p.cur.y)*df;p._active=true;
      // the cursor still moves over a switched-off effect, but setFxParam clamps it to the transparent
      // value (bypass wins) — the pad stays visually live and becomes audible again the moment it's on
      PadAudio.setFxParam(tgt,p.xp,p.cur.x);PadAudio.setFxParam(tgt,p.yp,p.cur.y);
      const d=driven[tgt.id]||(driven[tgt.id]={});d[p.xp]=1;d[p.yp]=1;}
    else p._active=false;
  }
  // per play-pad bus: any effect NOT driven this frame returns to that pad's base (manual setting)
  for(const inst of XPAD.pads.concat(XPAD.seqPads||[])){const d=driven[inst.id]||{};
    for(const k in FX_PARAMS)if(!d[k])PadAudio.setFxParam(inst,k,_fxBaseVal(inst,k));}
}
// fx-pad cursor artwork (lily pad) + keyboard support for the felt on/off toggles
