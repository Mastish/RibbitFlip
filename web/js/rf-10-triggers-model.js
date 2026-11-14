"use strict";
// ===================== TRIGGERS: threshold -> any key =====================
// Trigger vocabulary (sources, metrics, quick-key catalogue), the label formatters used by
// every trigger list, the SSE handlers for rule/trigger events and the shared drag-to-reorder
// helper (also used by the MIDI mapping list). Rules themselves live server-side; localStorage
// only mirrors them so the list can render before the first stream packet arrives.
const TRIG_LS="ribbitflip.rules.v1";
// RE_NAME is a KEY, not a caption: channel index -> the property name a sample object uses
// (state.last.ax is CH0) and the CSS colour variable of that channel. It must keep this order.
// RE_LABEL is what a PERSON reads, and it says something different because the keys are
// historical: CH0-2 are the gyroscope and CH3-5 the accelerometer, measured on a real puck
// (flat and still: ~-2065 LSB on CH5, one g at 2048 LSB/g). See the AXES note in rf-02-state.js.
// Never use RE_LABEL to look a value up, and never print RE_NAME.
const RE_NAME=["ax","ay","az","gx","gy","gz"];
const RE_LABEL=["gx","gy","gz","ax","ay","az"];
const CHCOL=i=>cv('--'+RE_NAME[i]);
// Orientation filter metrics (quaternion, computed server-side) as the trigger SOURCE.
// [key, label, unit, slider min, slider max]
const FILTER_METRICS=[
  ["tilt","Pochylenie","°",0,180],
  ["twist","Obrót (twist)","°/s",-720,720],
  // pitch/roll = lean of ONE axis away from level, ±90 = that axis fully vertical. Not ±180:
  // the filter folds past vertical instead of flipping by 180° (see PoseFilter in the monitor),
  // and "how far past vertical" is what Pochylenie/tilt 0–180 answers. The range also drives
  // FNORM, so the "3D filter — axes" scope shows a true % of full lean.
  ["pitch","Przechył przód/tył","°",-90,90],
  ["roll","Przechył w bok","°",-90,90],
  // spin is NOT an angle: it is |gyro| motion energy in raw calibrated LSB (131 LSB = 1 °/s),
  // never negative and deliberately NOT scaled by the axis gain — a shake has to mean the same
  // thing however sensitive somebody made their tilt. Hence "LSB" as the unit: printing "°/s"
  // would invite thresholds a hundred times too small. 30000 ≈ 230 °/s as the slider ceiling,
  // just under what the gyroscope can report at all (±250 °/s per axis).
  ["spin","Wirowanie (|żyro|)","LSB",0,30000],
];
const FMETA=Object.fromEntries(FILTER_METRICS.map(m=>[m[0],{label:m[1],unit:m[2],min:m[3],max:m[4]}]));
// Oscilloscope series for "3D Filter — axes" — orientation filter output (state.poseBuf).
const FSCOPE=[
  {k:"tilt",label:"Pochylenie",unit:"°"},
  {k:"pitch",label:"Pitch",unit:"°"},
  {k:"roll",label:"Roll",unit:"°"},
  {k:"twist",label:"Obrót",unit:"°/s"},
  {k:"spin",label:"Wirowanie",unit:"LSB"},
];
const FCOLOR={tilt:cv('--az'),pitch:cv('--ax'),roll:cv('--ay'),twist:cv('--gx'),spin:cv('--gz')};
// Wirowanie starts HIDDEN on the oscilloscope. It is a condition source first and a curve second,
// and its scale (0..30000 LSB) is nothing like the angles' — switched on by default it would
// simply be a fifth line squashing the four everybody already reads. Click its chip to show it.
const FVIS={tilt:true,pitch:true,roll:true,twist:true,spin:false};
const FLABEL=Object.fromEntries(FSCOPE.map(s=>[s.k,s]));   // lookup k->{label,unit} (no per-frame allocation in hover)
// Full deflection (=100%) per metric → shared % scale, so °/s (twist) doesn't dominate over ° (tilt/pitch/roll).
const FNORM=Object.fromEntries(FSCOPE.map(s=>[s.k,Math.max(Math.abs(FMETA[s.k].min),Math.abs(FMETA[s.k].max))||1]));
// ŚWIADOME „BEZ KLAWISZA" vs „JESZCZE NIE WYBRAŁEM" — dlaczego to są DWIE różne rzeczy, a nie
// dwa razy pusty `keySpec`. Pierwsza pozycja listy („— szybki wybór —") ma wartość pustą i znaczy
// „nic jeszcze nie wskazałem"; edytor na tej podstawie odmawia zapisu, bo reguła ze strzałką
// wciśniętą przez przypadek to był realny błąd (patrz `_openEditorNow`). Reguła-wyzwalacz to coś
// przeciwnego: człowiek WIE, że nic nie ma zostać naciśnięte, bo oprze się na niej wyzwalacz
// w module „Usługi sieciowe" albo warunek „Wyzwalacz" w innej regule.
//
// DECYZJA: rozróżnia je OSOBNE POLE `noAction: true` w regule, a nie wartownik w `keySpec`.
// Wartość „none" poniżej jest wyłącznie tokenem tej listy rozwijanej (i aliasem, który serwer
// przyjmuje z cudzego pliku) — do reguły NIGDY nie trafia: zapisuje się `keySpec:""` + `noAction`.
// Powody, dla których wartownik w `keySpec` przegrał:
//   * `""` już dziś znaczy „nic nie wysyłaj" w silniku (`sent` w `_do_action` wymaga niepustego
//     `spec`), więc pole-flaga nie otwiera ŻADNEJ nowej drogi do wyjścia; wartownik otwierałby —
//     musiałby go znać emiter, klasyfikator bezpieczeństwa importu, opis reguły, `specIsPad`,
//     `specIsLayer`, `specIsScan` i parser makr. Pominięcie jednego miejsca = albo wciśnięty
//     nieznany klawisz, albo podgląd przed importem, który kłamie.
//   * Zgodność w obie strony: zestaw z `noAction` otwarty w starszej wersji gubi pole i zostaje
//     nieszkodliwa reguła bez akcji. Zestaw z `keySpec:"none"` otwarty w starszej wersji to
//     „klawisz o nazwie none" — wyjątek w logu i takiż wpis w podglądzie bezpieczeństwa.
//   * `noAction` to zapis INTENCJI (boolean), a intencja jest dokładnie tym, co odróżnia te dwa
//     stany; `keySpec` opisuje CO nacisnąć, a tu nie ma czego.
// Serwer trzyma tę samą umowę: `sanitize_rules` przyjmuje alias, kasuje `keySpec` i utrzymuje
// `noAction` prawdziwe tylko wtedy, gdy nie ma ani klawisza, ani makra (samoleczenie).
const NOACT_SPEC="none";
// Powtarzanie akcji, która niczego nie naciska, i tak coś kosztuje — regułę „ciągłą" słucha
// odbiorca po drugiej stronie (Usługi sieciowe). 10 ms = 100 żądań na sekundę, więc reguła bez
// klawisza dostaje własną podłogę odstępu. Ta sama liczba stoi w `sanitize_rules` na serwerze.
const NOACT_MIN_IV=200;
const QUICKKEYS=[
  ["","— szybki wybór —"],
  [NOACT_SPEC,"— bez klawisza (tylko wyzwalacz) —"],
  ["media_play_pause","⏯ Play / Pauza"],["media_volume_up","🔊 Głośność +"],["media_volume_down","🔉 Głośność −"],
  ["media_volume_mute","🔇 Wycisz"],["media_next","⏭ Następny"],["media_previous","⏮ Poprzedni"],
  ["right","→ Strzałka w prawo"],["left","← Strzałka w lewo"],["up","↑ Strzałka w górę"],["down","↓ Strzałka w dół"],
  ["space","␣ Spacja"],["enter","⏎ Enter"],["esc","⎋ Esc"],["pageup","PgUp"],["pagedown","PgDn"],
  ["ctrl+right","Ctrl+→"],["ctrl+left","Ctrl+←"],["ctrl+c","Ctrl+C"],["ctrl+v","Ctrl+V"],
  ["alt+tab","Alt+Tab (przełącz okno)"],["cmd","⊞ Win"],
  ["mouse:left","🖱 Klik lewy"],["mouse:right","🖱 Klik prawy"],["mouse:middle","🖱 Klik środkowy"],
  ["mouse:double","🖱 Dwuklik"],["mouse:scrollup","🖱 Scroll ↑"],["mouse:scrolldown","🖱 Scroll ↓"],
  ["mouse:moveup","🖱 Kursor ↑"],["mouse:movedown","🖱 Kursor ↓"],["mouse:moveleft","🖱 Kursor ←"],["mouse:moveright","🖱 Kursor →"],
  // Buttons of the virtual Xbox pad (needs vgamepad + ViGEmBus, same as the stick and the
  // controller d-pad in Motion control). Every one of them is a `pad:` spec, so they travel
  // through mappings, macros and the Test button exactly like a key does.
  ["pad:a","🎮 Pad: A"],["pad:b","🎮 Pad: B"],["pad:x","🎮 Pad: X"],["pad:y","🎮 Pad: Y"],
  ["pad:lb","🎮 Pad: LB (górny lewy)"],["pad:rb","🎮 Pad: RB (górny prawy)"],
  ["pad:lt","🎮 Pad: LT (spust lewy)"],["pad:rt","🎮 Pad: RT (spust prawy)"],
  ["pad:up","🎮 Pad: krzyżak ↑"],["pad:down","🎮 Pad: krzyżak ↓"],
  ["pad:left","🎮 Pad: krzyżak ←"],["pad:right","🎮 Pad: krzyżak →"],
  ["pad:ls","🎮 Pad: klik lewym drążkiem (L3)"],["pad:rs","🎮 Pad: klik prawym drążkiem (R3)"],
  ["pad:start","🎮 Pad: Start"],["pad:back","🎮 Pad: Back"],["pad:guide","🎮 Pad: Guide (Xbox)"],
  // WARSTWY — jedyna akcja, która nigdzie nie wychodzi: nie naciska klawisza ani przycisku, tylko
  // przestawia, KTÓRE wyzwalacze tego kapsla nasłuchują. Dlatego działa też przy wyłączonej grupie
  // Mapowanie i w podglądzie — inaczej wyjście z warstwy bywałoby nieosiągalne z jej wnętrza.
  ["layer:1","🗂 Przełącz na warstwę 1"],["layer:2","🗂 Przełącz na warstwę 2"],
  ["layer:3","🗂 Przełącz na warstwę 3"],["layer:4","🗂 Przełącz na warstwę 4"],
  ["layer:next","🗂 Następna warstwa"],
  ["layer:hold:2","🗂 Warstwa 2, póki trzymasz"],
  // SKANER EKRANU — druga (po warstwach) akcja, która nigdzie nie wychodzi: nie naciska klawisza,
  // tylko mówi modułowi Skaner „teraz". To jest CAŁE wejście tego modułu: `scan:sygnal` zatrzymuje
  // pasek, `scan:cofnij` cofa o krok. Przy przechyle kapsla warto obie mieć pod ręką — jedna
  // reguła na przycisk, druga na przechył w bok — bo cofanie jest tam, gdzie skanowanie przestaje
  // być męczące. `scan:stop` przechodzi ZAWSZE, nawet przy wyłączonym module: awaryjne
  // zatrzymanie nie może zależeć od tego, co ktoś wcześniej wyłączył.
  ["scan:sygnal","🎯 Skaner: sygnał (zatrzymaj / wybierz)"],
  ["scan:cofnij","🎯 Skaner: cofnij o krok"],
  ["scan:stop","🎯 Skaner: zatrzymaj"],
  // SEKCJE — jedyny `scan:`, który coś w module ZMIENIA: przełącza, który z zapisanych skanerów
  // jest aktywny, i pokazuje go. Cztery na liście, choć moduł przyjmuje 1..8: lista szybkiego
  // wyboru ma być listą, a nie spisem wszystkiego, co da się wpisać. Piątą i dalsze wpisuje się
  // ręcznie — panel skanera podpowiada dokładny zapis pod nazwą sekcji.
  // NASTĘPNY W GRUPIE STOI PIERWSZY, bo przy kapslu jest najczęściej tym, czego się szuka:
  // jeden gest przechodzi po skanerach BIEŻĄCEJ grupy (ekranu), zamiast jednej reguły na każdy.
  ["scan:sekcja=nast","🎯 Skaner: następny skaner w grupie"],
  ["scan:sekcja=1","🎯 Skaner: pokaż sekcję 1"],
  ["scan:sekcja=2","🎯 Skaner: pokaż sekcję 2"],
  ["scan:sekcja=3","🎯 Skaner: pokaż sekcję 3"],
  ["scan:sekcja=4","🎯 Skaner: pokaż sekcję 4"],
];
// Is this action a controller button? Same question the server asks (spec_is_pad) — the panel
// needs it to warn about a missing driver before the mapping silently reports "nie wysłano".
function specIsPad(spec){return /^pad:/i.test(String(spec||"").trim());}
// …and is it a layer switch? Same question as spec_is_layer server-side. A rule that switches
// layers is NOT a controller mapping, so it belongs in the Mapowanie list, not in the Kontroler
// tab — hence a separate predicate rather than folding it into the pad split.
function specIsLayer(spec){return /^layer:/i.test(String(spec||"").trim());}
// …i czy to sygnał skanera (spec_is_scan po stronie serwera). Tak samo jak warstwa: nie jest to
// mapowanie kontrolera, więc zostaje na liście Mapowania, a nie w zakładce Kontroler.
function specIsScan(spec){return /^scan:/i.test(String(spec||"").trim());}
// MODUŁ WYŁĄCZONY PRZY STARCIE (--disable / --only, rf-00b). Przycisk pada bez Kontrolera i sygnał
// skanera bez Skanera NIC nie robią w tym uruchomieniu: serwer gasi je w silniku reguł (`pad_on`,
// `scan_on`), a zakładki tych modułów nie ma. Edytor nie proponuje więc takich akcji, a reguła,
// która już je ma, dostaje plakietkę. Reguły NIE kasujemy: wróci do pracy po restarcie bez parametru.
// Zwraca id modułu ("kontroler", "skaner") albo "" — akcja działa.
function specModOff(spec){
  if(typeof rfModOn!=="function")return "";
  if(specIsPad(spec)&&!rfModOn("kontroler"))return "kontroler";
  if(specIsScan(spec)&&!rfModOn("skaner"))return "skaner";
  return "";
}
// To samo dla całej reguły: pojedyncza akcja albo którykolwiek krok makra (`down pad:rt` też).
function ruleModOff(r){
  if(!r)return "";
  const m=specModOff(r.keySpec);if(m)return m;
  const seq=String(r.sequence||"");
  if(seq&&typeof rfModOn==="function"){
    if(!rfModOn("kontroler")&&/(^|[\s;])pad:/i.test(seq))return "kontroler";
    if(!rfModOn("skaner")&&/(^|[\s;])scan:/i.test(seq))return "skaner";
  }
  return "";
}
// Nazwa modułu w bieżącym języku (serwer wstrzykuje obie, RIBBITFLIP_MODULES.names).
function rfModName(id){
  const n=((window.RIBBITFLIP_MODULES||{}).names||{})[id]||[id,id];
  return _gl(n[0],n[1]);
}
// Lista szybkiego wyboru bez akcji wyłączonych modułów. Akcja, którą reguła JUŻ ma, zostaje na
// liście (inaczej lista pokazałaby „— szybki wybór —" i udawała, że nic nie jest wybrane), ale
// z dopiskiem, czemu teraz nie działa.
function quickKeysOn(sel){
  const out=[];
  for(const q of QUICKKEYS){
    if(!specModOff(q[0])){out.push(q);continue;}
    if(q[0]&&q[0]===sel)out.push([q[0],q[1]+_gl(" (moduł wyłączony przy starcie)"," (module switched off at start)")]);
  }
  return out;
}
// Plakietka na wierszu reguły (Mapowanie). Pusta, gdy moduł działa.
function ruleModOffTagHtml(r){
  const m=ruleModOff(r);
  if(!m)return "";
  const t=_gl("Ta reguła używa modułu „"+rfModName(m)+"”, który wyłączono przy starcie aplikacji. Zostaje zapisana i zadziała po uruchomieniu aplikacji bez parametru --disable / --only.",
              "This rule uses the "+rfModName(m)+" module, which was switched off when the app started. It stays saved and works again once the app starts without --disable / --only.");
  return `<span class="rmodoff" data-noi18n title="${esc(t)}">${esc(_gl("moduł wyłączony przy starcie","module switched off at start"))}</span>`;
}
// Czy ten zapis akcji to świadome „bez klawisza"? Tylko token listy rozwijanej i aliasy, które
// serwer przyjmuje z cudzego pliku (`spec_is_noaction` po tamtej stronie). Pusty NAPIS tu NIE
// wchodzi — pusty znaczy „jeszcze nie wybrano" i ma prawo blokować zapis.
function specIsNoAction(spec){const s=String(spec||"").trim().toLowerCase();
  return s===NOACT_SPEC||s==="brak"||s==="-"||s==="—";}
// Czy TA REGUŁA nic nie naciska. Flaga liczy się wyłącznie przy pustej akcji: dopisanie klawisza
// albo makra wygrywa z flagą bez pytania, więc żadna droga (przechwyt klawisza, punkt na ekranie,
// nagrany gest, import) nie musi o niej wiedzieć, żeby jej nie zostawić w sprzeczności z akcją.
function ruleNoAction(r){if(!r)return false;
  if(String(r.sequence||"").trim())return false;
  const ks=String(r.keySpec||"").trim();
  return ks?specIsNoAction(ks):!!r.noAction;}
// „layer:2" -> {kind:"set",n:2} · „layer:next" -> {kind:"next"} · „layer:hold:3" -> {kind:"hold",n:3}
function parseLayerSpec(spec){
  const s=String(spec||"").trim().toLowerCase();
  if(!/^layer:/.test(s))return null;
  let rest=s.slice(6).trim();
  if(rest==="next")return {kind:"next",n:0};
  let hold=false;
  if(rest.startsWith("hold:")){hold=true;rest=rest.slice(5).trim();}
  if(!/^[1-4]$/.test(rest))return null;
  return {kind:hold?"hold":"set",n:+rest};
}
const KEYLABEL=Object.fromEntries(QUICKKEYS.filter(q=>q[0]).map(q=>[q[0],q[1]]));
const JSKEY={"ArrowRight":"right","ArrowLeft":"left","ArrowUp":"up","ArrowDown":"down"," ":"space",
  "Enter":"enter","Escape":"esc","Tab":"tab","Backspace":"backspace","Delete":"delete",
  "Home":"home","End":"end","PageUp":"page_up","PageDown":"page_down","Insert":"insert"};

function esc(s){return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function ruleColor(r){const s=r.source||{};
  return s.kind==="axis"?CHCOL(s.channel):s.kind==="filter"?cv('--gz'):s.kind==="gesture"?cv('--pink'):cv('--c-skip');}
// trigger name by id (for the "trigger" source) — scans rules of all slots + editor draft
function ruleRefLabel(refId){
  if(!refId)return "—";
  if(state._draft&&state._draft.id===refId)return state._draft.label||"(ten wyzwalacz)";
  for(const D of Object.values(state.devices||{})){
    const r=(D.rules||[]).find(x=>x.id===refId); if(r)return r.label||ruleSrcLabel(r)||refId;}
  const r=(state.rules||[]).find(x=>x.id===refId); if(r)return r.label||ruleSrcLabel(r)||refId;
  return "⚠ usunięty";   // ref to a nonexistent rule (condition counts as false)
}
function ruleSrcLabel(r){const s=r.source||{};
  // A RECORDED gesture (rf-12d/e) has no axis and no threshold to print: its name is the hand
  // icon plus what the movement looks like — the description the person typed — so an unnamed
  // gesture rule is still told apart from the next one on the list and on the cheat sheet.
  if(s.kind==="gesture")return "✋ "+(String(s.desc||"").trim()||_gl("Nagrany gest","Recorded gesture"));
  if(s.kind==="trigger")return "⟶ "+ruleRefLabel(s.ref);
  if(s.kind==="button")return s.any?"przycisk":`B${s.byte}·bit${s.bit}`;
  if(s.kind==="filter")return "🧭 "+((FMETA[s.metric]||{}).label||s.metric||"filtr");
  return `CH${s.channel} (${RE_LABEL[s.channel]||"?"})`;}
// fragment of a single condition's description (with NEGATE) — c has {source,abs,cmp,threshold,thresholdHi,neg}
function condFrag(c){const s=c.source||{};let base;
  // The condition line of a recorded gesture says what the engine actually holds — how many
  // recordings and how alike a movement has to be — while the description travels in the
  // rule's name (ruleSrcLabel), so the two lines never repeat each other.
  if(s.kind==="gesture"){const n=(s.takes||[]).length;
    const thr=(typeof gestParamsOf==="function")?Math.round(gestParamsOf(s).threshold):null;
    base="✋ "+_gl("gest","gesture")+(n?" · "+_gl(n+" nagr.",n+" rec.")+(thr!=null?" · ≥ "+thr+" %":""):" ("+_gl("bez nagrania","no recording")+")");}
  else if(s.kind==="trigger")base="⟶ "+ruleRefLabel(s.ref);
  else if(s.kind==="button")base=(s.any?"przycisk":`B${s.byte}·bit${s.bit}`)+"=1";
  else{const unit=s.kind==="filter"?((FMETA[s.metric]||{}).unit||""):"",u=unit?(" "+unit):"";
    const lhs=c.abs?"|"+ruleSrcLabel(c)+"|":ruleSrcLabel(c);
    if(c.cmp==="in"||c.cmp==="out"){const hi=(c.thresholdHi!=null?c.thresholdHi:c.threshold),a=Math.min(c.threshold,hi),b=Math.max(c.threshold,hi);
      base=`${lhs} ${c.cmp==="in"?"w":"poza"} ${a}..${b}${u}`;}
    else base=`${lhs} ${c.cmp} ${c.threshold}${u}`;}
  return (c.neg?"NIE ":"")+base;}
function ruleCondLabel(r){
  const main=condFrag({source:r.source,abs:r.abs,cmp:r.cmp,threshold:r.threshold,thresholdHi:r.thresholdHi,neg:r.neg});
  const extras=(r.extraConditions||[]);
  if(!extras.length)return main;
  let out=main;
  for(const c of extras)out+=` ${c.op==="or"?"LUB":"ORAZ"} ${condFrag(c)}`;
  return out;}
// ONE name for a key/action across the whole UI: the friendly label from QUICKKEYS when the spec is
// one of them ("right" -> "→ Strzałka w prawo"), and the raw spec otherwise, because an arbitrary
// key ("ctrl+alt+f1", "w") IS its own name. Translated here rather than left to the i18n walker, so
// the text is right the moment it is painted — the trigger log paints one row per fire and a row
// that flashes Polish for a tick before turning English reads like a glitch.
function keyLabel(spec){
  if(spec==null||spec==="")return "";
  // A click at a point has coordinates in its name, so no dictionary can hold it — it is composed
  // in the current language on the spot (rf-12b), like the rest of this function does.
  if(typeof ptSpecLabel==="function"){const p=ptSpecLabel(spec);if(p)return p;}
  const pl=KEYLABEL[spec]||spec;
  return (typeof _lang!=="undefined"&&_lang==="en"&&I18N_EN[pl]!=null)?I18N_EN[pl]:pl;
}
function ruleKeyLabel(r){
  if(r.sequence)return "⛓ "+seqPreview(r.sequence);
  // Reguła bez klawisza musi się przedstawić SAMA. Nienazwana reguła ma w tytule swoje ŹRÓDŁO
  // (`ruleSrcLabel`), a w tej rubryce stoi akcja — pusta dawała gołe „⌨ —", czyli wiersz, po
  // którym nie da się poznać, czy ktoś zapomniał akcji, czy tak to sobie wymyślił.
  if(ruleNoAction(r))return "🔗 "+_gl("bez klawisza — wyzwalacz","no key — trigger only");
  // A layer switch under a keyboard icon reads as a typo — it presses nothing. Hand-typed forms
  // („layer:hold:4") are not in the quick-pick list, so their name is composed here.
  if(specIsLayer(r.keySpec)){
    const p=parseLayerSpec(r.keySpec);
    if(!p)return "🗂 "+_gl("nieprawidłowa warstwa","invalid layer");
    if(p.kind==="next")return "🗂 "+_gl("następna warstwa","next layer");
    if(p.kind==="hold")return "🗂 "+_gl("warstwa "+p.n+", póki trzymasz","layer "+p.n+" while held");
    return "🗂 "+_gl("warstwa "+p.n,"layer "+p.n);
  }
  const lab=keyLabel(r.keySpec)||"—";
  // A controller button under a keyboard icon reads as a typo. The quick-pick labels already
  // carry 🎮; a hand-typed `pad:cross` does not, so it gets one here.
  if(specIsPad(r.keySpec))return (/^🎮/.test(lab)?"":"🎮 ")+lab;
  if(/^🖱/.test(lab))return lab;   // same reason: a mouse label already says what it is
  return "⌨ "+lab;}
function ruleBehLabel(r){
  if(r.behavior==="hold")return _gl("przytrzymaj","hold");
  if(r.behavior==="multi")return `${r.crossings}× ${_gl("w","in")} ${r.windowMs} ms`;
  // „dokładnie" jest tu całą różnicą wobec `multi` i musi być widoczne na liście — inaczej dwie
  // reguły na tym samym przycisku wyglądają na tę samą regułę wpisaną dwa razy.
  if(r.behavior==="taps")return `${_gl("dokładnie","exactly")} ${Math.max(1,r.crossings||1)}× ${_gl("w","in")} ${r.windowMs} ms`;
  if(r.behavior==="continuous")return `${_gl("ciągłe · co","continuous · every")} ${r.intervalMs} ms`;
  if(r.behavior==="dwell")return `${_gl("po","after")} ${r.dwellMs!=null?r.dwellMs:500} ms ${_gl("spełnienia","held")}`;
  if(r.behavior==="latch")return _gl("przełącznik","latch");   // the app already calls the OSC toggle a Latch/Przełącznik — same idea, same word
  return _gl("jednorazowo","once");}
function curVal(r){const s=r.source||{};
  // A gesture has no live value — the cell shows how alike the LAST movement was ("84 %", rf-12d).
  if(s.kind==="gesture")return (typeof gestLastSim==="function")?gestLastSim(r):null;
  if(s.kind==="trigger"){const rt=state.rt&&state.rt[s.ref];return rt?(rt.active?1:0):0;}
  if(s.kind==="button"){const sp=state.statusPkt;if(!sp)return null;
    if(s.any)return (sp.bytes&&[1,2,3,4].some(i=>sp.bytes[i]))?1:0;   // any bit set in bytes 1..4 of the status packet
    return ((sp.bytes[s.byte]||0)>>s.bit)&1;}
  if(s.kind==="filter"){const p=state.pose;if(!p)return null;let v=p[s.metric];if(v==null)return null;return r.abs?Math.abs(v):v;}
  // A tuned channel is compared SERVER-SIDE against its tuned value, so the live readout next to
  // the threshold has to show that one too — otherwise the preview says "not yet" while the rule
  // has already fired. Falls back to the raw value when nothing is tuned (the usual case).
  const _src=state.lastSh||state.last;
  let v=_src[RE_NAME[s.channel]]; if(v==null)return null; return r.abs?Math.abs(v):v;}

// --- WARSTWY MAPOWAŃ ---------------------------------------------------------------------
// Jeden kapsel, kilka kompletów wyzwalaczy. Reguła ma pole `layer`: 0 = „Zawsze" (działa
// w każdej warstwie i tak ma każda reguła napisana, zanim warstwy powstały), 1..4 = nasłuchuje
// tylko w tej jednej. Warstwa aktywna należy do serwera — tu jest wyłącznie jej odbicie.

// Czy ta reguła jest teraz UŚPIONA, bo należy do innej warstwy? Reguła-shift („layer:hold:N")
// nigdy nie jest: klawisz, który znika w chwili, gdy przełączy warstwę, nie miałby jak puścić.
function ruleOffLayer(r){
  const lay=+(r&&r.layer||0);
  if(!lay||lay===(state.activeLayer||1))return false;
  const p=parseLayerSpec(r.keySpec);
  return !(p&&p.kind==="hold");
}
// Plakietka „W2" przy regule przypisanej do warstwy. Reguły „Zawsze" nie dostają nic — plakietka
// przy każdym wierszu przestałaby cokolwiek znaczyć.
function ruleLayerTagHtml(r){
  const lay=+(r&&r.layer||0);
  if(!lay)return "";
  const cur=state.activeLayer||1;
  const p=parseLayerSpec(r.keySpec),shift=!!(p&&p.kind==="hold");
  const off=ruleOffLayer(r);
  const t=shift?_gl("Przełącznik warstwy — działa w każdej warstwie, żeby zawsze dało się wrócić.",
                    "A layer shift — it works in every layer, so there is always a way back.")
    :off?_gl("Ta reguła należy do warstwy "+lay+", a aktywna jest "+cur+" — teraz nie działa.",
             "This rule belongs to layer "+lay+", and layer "+cur+" is active — it is dormant now.")
    :_gl("Ta reguła należy do warstwy "+lay+", która jest teraz aktywna.",
         "This rule belongs to layer "+lay+", which is the active one.");
  return `<span class="rlayer${off?" off":""}" title="${esc(t)}">W${lay}</span>`;
}
// Pasek „Warstwa: 1 2 3 4" nad listą. Widoczny TYLKO wtedy, gdy jakakolwiek reguła używa warstw —
// rząd przycisków, który u większości ludzi nic nie robi, zaprasza do kliknięcia i nic nie tłumaczy.
function trigLayersRender(){
  const box=document.getElementById("trigLayers"),btns=document.getElementById("trigLayerBtns");
  if(!box||!btns)return;
  const used=new Set();
  for(const r of (state.rules||[])){const l=+(r.layer||0);if(l>=1&&l<=4)used.add(l);}
  if(!used.size){box.hidden=true;btns.textContent="";return;}
  box.hidden=false;
  const cur=state.activeLayer||1;
  btns.textContent="";
  for(let n=1;n<=4;n++){
    const b=document.createElement("button");
    b.type="button";
    b.className="triglayer"+(n===cur?" on":"")+(used.has(n)?"":" empty");
    b.textContent=String(n);
    b.setAttribute("aria-pressed",n===cur?"true":"false");
    b.title=used.has(n)?_gl("Przełącz na warstwę "+n,"Switch to layer "+n)
      :_gl("Warstwa "+n+" — nie ma tu jeszcze żadnego wyzwalacza",
           "Layer "+n+" — no trigger lives here yet");
    b.onclick=()=>trigSetLayer(n);
    btns.appendChild(b);
  }
}
function trigSetLayer(n){
  n=Math.max(1,Math.min(4,+n||1));
  const prev=state.activeLayer||1;
  if(n===prev)return;
  state.activeLayer=n;   // optymistycznie — serwer potwierdzi w najbliższej paczce `trig`
  renderRules();
  fetch("/layer",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({layer:n})}).then(r=>r.json())
    .then(j=>{if(j&&j.layer){state.activeLayer=+j.layer||1;renderRules();
      flashTrigMsg(_gl("Warstwa "+state.activeLayer,"Layer "+state.activeLayer));}})
    .catch(()=>{state.activeLayer=prev;renderRules();
      flashTrigMsg(_gl("Offline — warstwa bez zmian","Offline — layer unchanged"));});
}
// Wspólne dla obu zdarzeń ze strumienia: warstwa przyszła z serwera i różni się od pokazywanej.
function _layerFromEvent(m){
  if(m==null||m.activeLayer==null)return false;
  const n=Math.max(1,Math.min(4,+m.activeLayer||1));
  if(n===(state.activeLayer||1))return false;
  state.activeLayer=n;
  return true;
}

// --- receiving from the stream ---
function onRules(m){
  // 'armed' is global, so it is deliberately not read from this per-slot event
  if(state.editing)return;               // don't overwrite the list being edited
  _layerFromEvent(m);
  state.rules=Array.isArray(m.rules)?m.rules:[];
  try{localStorage.setItem(TRIG_LS,JSON.stringify(state.rules));}catch{}
  renderRules();
}
function onTrig(m){   // only DOM of the active slot — rt state is set by routeEvent (conds/overSince)
  // A layer switch can come from a RULE (the capsule's own button), not only from the strip in the
  // panel — so the list has to be repainted when the number changes, not merely when it is clicked.
  if(_layerFromEvent(m)){renderRules();return;}
  for(const it of (m.st||[])){const id=it[0];
    const row=document.getElementById("rule-"+id);if(row)row.classList.toggle("active",!!it[1]);
    const fe=document.getElementById("rfires-"+id);if(fe)fe.textContent=it[2];
  }
}
function onTrigFire(m){
  const row=document.getElementById("rule-"+m.id);
  if(row){row.classList.add("fire");setTimeout(()=>row.classList.remove("fire"),200);}
  const led=document.getElementById("rled-"+m.id);   // dot flashes on every trigger
  if(led){led.classList.add("fired");setTimeout(()=>led.classList.remove("fired"),280);}
  const log=document.getElementById("trigLog");if(!log)return;
  // `label` is the rule's OWN name and is empty when it has none — then the friendly, translated
  // key name stands in for it (the column used to print the raw spec, which is why a Polish UI
  // said "right"). Older servers substituted the spec into `label`; the second test keeps those
  // from printing it twice.
  const kl=keyLabel(m.key);
  const named=!!(m.label&&m.label!==m.key);
  const nm=named?m.label:(kl||m.key||"");
  const r=document.createElement("div");r.className="ev";
  r.innerHTML=`<span class="t">${m.ts.toFixed(2)}s</span><span>${m.sent?"⌨":'<span class="bic bic-eye" aria-hidden="true"></span>'}</span>`+
    `<span>${esc(nm)}</span><span style="color:var(--dim)">${esc(named?kl:"")}</span>`;   // an unnamed rule is already ITS key — do not print it twice
  log.prepend(r);while(log.children.length>40)log.removeChild(log.lastChild);
}

// --- rule list ---
// ============ DRAG & DROP: reordering mappings with FLIP animation ============
//  Reusable for the trigger list (.rule-wrap) and MIDI mappings (.mi-row). Whole-card
//  draggable, but start on a button/input is cancelled (click works normally).
//  FLIP: measures positions before reordering, after insertBefore animates via transform =
//  smooth "shift" of neighbors. Respects prefers-reduced-motion.
function _dragAfter(items,x,y){
  let best=null,bestD=Infinity,after=false;
  for(const c of items){
    const b=c.getBoundingClientRect(),cx=b.left+b.width/2,cy=b.top+b.height/2;
    const d=Math.hypot(x-cx,y-cy);
    if(d<bestD){bestD=d;best=c;after=(y>cy+b.height*0.15)||(Math.abs(y-cy)<=b.height*0.6&&x>cx);}
  }
  return {ref:best,after};
}
function _flipReorder(container,itemSel,mutate){
  const items=[...container.querySelectorAll(itemSel)];
  const first=new Map();items.forEach(el=>first.set(el,el.getBoundingClientRect()));
  mutate();
  const reduce=matchMedia("(prefers-reduced-motion:reduce)").matches;
  items.forEach(el=>{
    if(el.classList.contains("dragging"))return;
    const a=first.get(el);if(!a)return;const b=el.getBoundingClientRect();
    const dx=a.left-b.left,dy=a.top-b.top;
    if((dx||dy)&&!reduce){
      el.style.transition="none";el.style.transform=`translate(${dx}px,${dy}px)`;
      requestAnimationFrame(()=>{el.style.transition="transform .22s cubic-bezier(.2,.7,.2,1)"/* = --rf-ez-snap */;el.style.transform="";});
      setTimeout(()=>{el.style.transition="";},260);
    }
  });
}
function enableDragReorder(container,itemSel,onCommit){
  if(!container)return;
  // Drag state and callback KEPT ON THE CONTAINER (not in the closure) — 'dragover' listener
  // bound once, while 'dragstart' is attached on every re-render; they must share THE SAME reference.
  container._dndCommit=onCommit;
  container._dndSel=itemSel;
  container.querySelectorAll(itemSel).forEach(el=>{
    el.setAttribute("draggable","true");
    el.addEventListener("dragstart",e=>{
      if(e.target.closest("button,input,select,textarea,a")){e.preventDefault();return;}
      container._dragEl=el;e.dataTransfer.effectAllowed="move";
      try{e.dataTransfer.setData("text/plain",el.dataset.id||"");}catch(_){}
      requestAnimationFrame(()=>el.classList.add("dragging"));   // rAF: gives the browser time to create the ghost without .dragging
    });
    el.addEventListener("dragend",()=>{
      const d=container._dragEl;if(d)d.classList.remove("dragging");
      const ids=[...container.querySelectorAll(container._dndSel)].map(x=>x.dataset.id);
      container._dragEl=null;
      if(typeof container._dndCommit==="function")container._dndCommit(ids);
    });
  });
  if(container._dndBound)return; container._dndBound=true;   // container listener once (survives re-render)
  container.addEventListener("dragover",e=>{
    const dragEl=container._dragEl;if(!dragEl)return;
    e.preventDefault();e.dataTransfer.dropEffect="move";
    const items=[...container.querySelectorAll(container._dndSel+":not(.dragging)")];
    if(!items.length)return;
    const {ref,after}=_dragAfter(items,e.clientX,e.clientY);
    const target=after?(ref?ref.nextElementSibling:null):ref;
    if(target===dragEl||dragEl.nextElementSibling===target)return;   // no position change
    _flipReorder(container,container._dndSel,()=>container.insertBefore(dragEl,target));
  });
}
function _reorderByIds(arr,ids){
  const byId={};arr.forEach(x=>{if(x&&x.id!=null)byId[x.id]=x;});
  const nu=[],seen=new Set();
  ids.forEach(id=>{if(byId[id]&&!seen.has(id)){nu.push(byId[id]);seen.add(id);}});
  arr.forEach(x=>{if(x&&!seen.has(x.id)){nu.push(x);seen.add(x.id);}});   // safety: add missing ones
  const changed=nu.length!==arr.length||nu.some((x,i)=>x!==arr[i]);
  return {arr:nu,changed};
}
function commitRuleOrder(ids){
  const r=_reorderByIds(state.rules,ids);state.rules=r.arr;
  if(r.changed)commitRules();
}
function commitMidiOrder(ids){
  const r=_reorderByIds(state.midi.mappings||[],ids);state.midi.mappings=r.arr;
  if(r.changed){renderMidiList();commitMidi();}
}

// USUNIĘCIE REGUŁY MA DROGĘ POWROTNĄ. Wszędzie indziej kasowanie albo pyta (preset w bibliotece,
// wycinek koła), albo daje „Cofnij" (import — rf-29). Ta jedna kasowała od razu i bez śladu, a stoi
// tuż obok „Edytuj" — jedno chybione kliknięcie kosztowało wieczór pisania reguł.
// Bąbelek, a nie okno z pytaniem: reguły kasuje się seriami, więc potwierdzenie przy każdej uczy
// klikać „tak" bez czytania. Migawka niesie DOKŁADNIE tę regułę i miejsce, w którym stała, więc
// cofnięcie oddaje listę taką, jaka była, a nie regułę doklejoną na końcu.
function ruleDeleteWithUndo(r){
  const i=state.rules.findIndex(x=>x.id===r.id);
  if(i<0)return;
  const snap=JSON.parse(JSON.stringify(state.rules[i]));
  state.rules.splice(i,1);
  // Edytor otwarty nad tą regułą zostałby oknem bez przedmiotu, a jego „Zapisz" przywróciłby ją
  // po cichu — czyli cofnąłby kasowanie bez pytania.
  if(state.editing===snap.id&&typeof closeEditor==="function")try{closeEditor();}catch(e){}
  commitRules();
  const nm=String(snap.label||ruleSrcLabel(snap)||"");
  // „Cofnij" przez wspólny `rfUndo` (rf-06): ten sam bąbel i te same 25 s co w każdym module.
  if(typeof rfUndo!=="function")return;
  rfUndo({msg:_gl("Usunięto regułę „"+nm+"”","Deleted the rule “"+nm+"”"),take:()=>snap,clone:false,
    restore:function(s){
      if(state.rules.some(x=>x.id===s.id))return;   // zapisana z powrotem w międzyczasie
      state.rules.splice(Math.min(i,state.rules.length),0,s);
      commitRules();
    }});
}
// One row of a rule list, complete with its buttons. Extracted so the pad-button list in the
// Kontroler tab (rf-43) is literally the same row as the one in Mapowanie — a second implementation
// would drift, and these two lists show the SAME rule objects.
function _ruleRow(r){
    const col=ruleColor(r),rt=state.rt[r.id]||{active:0,fires:0};
    const wrap=document.createElement("div");wrap.className="rule-wrap";wrap.dataset.id=r.id;
    const d=document.createElement("div");
    // A rule of another layer is dimmed rather than hidden: hiding it would make a list that
    // silently loses rows when a layer switches, and „gdzie się podział mój wyzwalacz?" is a
    // worse question than „dlaczego ten jest przygaszony?". The plaque answers the second one.
    const off=ruleOffLayer(r);
    d.className="rule"+(rt.active?" active":"")+(r.enabled?"":" disabled")+(off?" rule-offlayer":"")+(ruleModOff(r)?" rule-modoff":"");
    d.id="rule-"+r.id;d.style.setProperty("--rcol",col);
    // ŹRÓDŁO W SKRÓCIE (.rsub) PISZEMY RAZ. `ruleCondLabel` sam zaczyna od nazwy źródła (patrz
    // `condFrag`), więc wiersz brzmiał „🧭 Wirowanie (|żyro|) · 🧭 Wirowanie (|żyro|) > 12000 LSB
    // · jednorazowo" — ta sama nazwa dwa razy pod rząd, w linijce, która ma streszczać regułę.
    d.innerHTML=`<span class="led" id="rled-${r.id}"></span>
      <div class="rmain">
        <div class="rtop"><b>${esc(r.label||ruleSrcLabel(r))}</b>
          ${ruleLayerTagHtml(r)}
          ${ruleModOffTagHtml(r)}
          <span class="rkey">${esc(ruleKeyLabel(r))}</span></div>
        <div class="rsub">${esc(ruleCondLabel(r))} · ${esc(ruleBehLabel(r))}</div>
      </div>
      <div class="rstat"><span class="rcur" id="rcur-${r.id}">—</span>
        <span class="rseq" id="rseq-${r.id}"></span>
        <span class="rfires num" id="rfires-${r.id}">${rt.fires||0}</span></div>
      <div class="ract">
        <button class="btn sm" data-a="toggle" title="${r.enabled?"Wyłącz":"Włącz"}">${r.enabled?"⏸":"▶"}</button>
        <button class="btn sm" data-a="test" title="Testuj klawisz">⌨</button>
        <button class="btn sm" data-a="edit" title="Edytuj" aria-label="Edytuj"><span class="rfic spray-ic sm" aria-hidden="true"></span></button>
        <button class="btn sm" data-a="del" title="Usuń" aria-label="Usuń"><span class="bic bic-bin" aria-hidden="true"></span></button></div>`;
    d.querySelector('[data-a=toggle]').onclick=()=>{r.enabled=!r.enabled;commitRules();};
    d.querySelector('[data-a=test]').onclick=()=>testRule(r);
    d.querySelector('[data-a=edit]').onclick=()=>openEditor(r);
    d.querySelector('[data-a=del]').onclick=()=>ruleDeleteWithUndo(r);
    wrap.appendChild(d);
    const ex=progRowHtml(state.activeDeviceId,r)+(state.detailView?detailHtml(state.activeDeviceId,r):"");
    if(ex){const w=document.createElement("div");w.className="tr-extra";w.innerHTML=ex;wrap.appendChild(w);}
    return wrap;
}
// KAFLE STARTU MAPOWANIA (UX 261120, P-G1-01 + P-G1-05). Jeden rysunek na dwa miejsca: pusty stan
// listy i panel nad listą, który otwiera „Nowy wyzwalacz”, gdy reguły już są (`state._tilesOpen`).
// Dane i ikony są w rf-12c (TRIG_TILES, TRIG_TILE_ICON), otwarcie edytora w rf-12 (`trigTileNew`).
// Kafel to filcowy `.pad-add-tile` z wariantem `.rf-pick` (bez „+ ”, 03-triggers.css). Nazwa kafla
// idzie przez `_gl`, nie przez słownik: „Pochyl do przodu” ma w nakładce inne znaczenie (rf-41).
function trigTileIconHtml(t){
  const ic=(typeof TRIG_TILE_ICON!=="undefined"&&TRIG_TILE_ICON[t.ico])||{};
  if(ic.cap&&typeof capImgSpan==="function")
    return `<span class="pat-ic pat-cap" aria-hidden="true">${capImgSpan(state.activeDeviceId||"d0",30)}</span>`;
  return `<img class="pat-ic" src="${esc(ic.src||"")}" alt="" style="--rot:${+ic.rot||0}deg">`;
}
function trigStartHtml(panel){
  if(typeof TRIG_TILES==="undefined")return "";
  const tiles=TRIG_TILES.map(t=>`<button type="button" class="pad-add-tile rf-pick" data-tile="${esc(t.key)}">`
    +trigTileIconHtml(t)+`<span class="pat-txt"><b data-noi18n>${esc(_gl(t.label,t.en))}</b><span>${esc(t.desc)}</span></span></button>`).join("");
  return `<div class="trig-start${panel?" is-panel":""}" id="trigStart">
    <h3 class="trig-start-h">Co ma zrobić kapsel?</h3>
    <p class="trig-start-sub">Wybierz ruch. Resztę ustawisz za chwilę.</p>
    <div class="rf-picks">${tiles}</div>
    <div class="trig-start-doors">
      <button type="button" class="btn sm" id="trigDoorGest" data-gnew="simple">Nagraj własny gest</button>
      <button type="button" class="btn sm" id="trigDoorManual" data-gnew="advanced">Ustaw ręcznie</button>
      <span class="hint">Siłę, czas i klawisz zmienisz potem.</span></div></div>`;
}
// Wybór kafla albo drzwi zamyka panel: po zapisie lista wraca bez niego.
function trigStartWire(root){
  const shut=()=>{state._tilesOpen=false;const p=root.querySelector("#trigStart.is-panel");if(p)p.remove();};
  root.querySelectorAll("#trigStart [data-tile]").forEach(b=>b.onclick=()=>{
    shut();
    if(typeof trigTileNew==="function")trigTileNew(b.dataset.tile);
  });
  root.querySelectorAll("#trigStart [data-gnew]").forEach(b=>b.onclick=()=>{
    shut();
    if(typeof gestNewRule==="function")gestNewRule(b.dataset.gnew);
  });
}
// „Nowy wyzwalacz” przy niepustej liście: ten sam wybór ruchu nad listą (drugie kliknięcie chowa).
function trigStartToggle(){
  state._tilesOpen=!state._tilesOpen;
  renderRules();
  const s=document.getElementById("trigStart");
  if(s)try{s.scrollIntoView({block:"nearest",behavior:"smooth"});const f=s.querySelector("[data-tile]");if(f)f.focus({preventScroll:true});}catch(e){}
}
// Mapowanie's list — everything EXCEPT the pad-button rules, which have their own home in the
// Kontroler tab next to the drawing of the pad they press. One array, two views: a rule moved by
// changing its action from `a` to `pad:a` simply appears in the other list on the next render.
function renderRules(){
  // Sekcja „Przycisk kapsla klika myszą" (rf-31d) NIE ma własnego stanu — czyta te reguły. Więc
  // ilekroć lista się zmienia (edycja w Mapowaniu, wczytany zestaw, przełączenie kapsla), ma się
  // dowiedzieć: inaczej checkbox w karcie Mysz pokazywałby stan sprzed tej zmiany.
  if(typeof mbtnSync==="function")try{mbtnSync();}catch(e){}
  // Bez Kontrolera (wyłączony przy starcie) jego zakładki nie ma, więc reguły przycisków pada
  // zostają TUTAJ, z plakietką „moduł wyłączony przy starcie" — inaczej znikałyby z każdego widoku.
  const padTab=(typeof rfModOn!=="function")||rfModOn("kontroler");
  const pads=padTab?state.rules.filter(r=>specIsPad(r.keySpec)):[];
  const rest=padTab?state.rules.filter(r=>!specIsPad(r.keySpec)):state.rules.slice();
  trigLayersRender();   // „Warstwa: 1 2 3 4" — hides itself when no rule uses layers
  const list=document.getElementById("rulesList");
  if(list){
    // Karta wie, czy ma reguły: pusty moduł chowa pasek „Nowy wyzwalacz” (kafle niżej robią to
    // samo) i dziennik bez wpisów, a otwarty edytor (`is-editing`, rf-12) chowa start (03-triggers).
    const card=document.getElementById("trigCard");
    if(card)card.classList.toggle("rules-none",!rest.length);
    if(!rest.length){
      // PUSTY STAN = WYBÓR RUCHU (UX 261120, P-G1-01). Pierwsze pytanie nowej osoby to „co ma zrobić
      // kapsel”, więc odpowiedź stoi tu jako sześć kafli z gotowym ruchem, a dwie pozostałe drogi
      // („Nagraj własny gest”, „Ustaw ręcznie”) jako zwykłe przyciski pod siatką.
      // ŚLEPY ZAUŁEK PO WCZYTANIU ZESTAWU: zestaw pod grę na padzie składa się z reguł `pad:`, a te
      // idą na ekran Kontroler, więc pusta lista mówi ILE ich jest i prowadzi tam jednym kliknięciem.
      list.innerHTML=(pads.length?`<div class="rules-empty rules-padnote"><b>`
          +_gl(`Ten kapsel ma mapowania przycisków kontrolera (`+pads.length+`). Są na ekranie Kontroler.`,
               `This capsule has controller button mappings (`+pads.length+`). They live on the Controller screen.`)+`</b>`
          +`<div class="rules-empty-doors"><button type="button" class="btn primary" data-gopad="1">`
          +_gl("Pokaż ekran Kontroler","Show the Controller screen")+`</button></div></div>`:``)
        +trigStartHtml();
      trigStartWire(list);
      list.querySelectorAll("[data-gopad]").forEach(b=>b.onclick=()=>{
        if(typeof setTabById==="function")setTabById("kontroler");
      });
    }else{
      list.innerHTML=state._tilesOpen?trigStartHtml(true):"";
      if(state._tilesOpen)trigStartWire(list);
      list.insertAdjacentHTML("beforeend", detailToggleHtml());
      for(const r of rest)list.appendChild(_ruleRow(r));
    }
  }
  // The other view. Guarded by name: rf-43 loads after this file and the list may not exist yet
  // (or at all, in the overlay window).
  if(typeof padRulesRender==="function")try{padRulesRender(pads);}catch(e){}
  // And the THIRD view: the mappings of the one pad part currently open in the Kontroler tab. It is
  // a filter over the same array, so it goes stale for exactly the same reasons the list above does
  // — a rule saved, deleted or re-aimed at another button.
  if(typeof padPartSync==="function")try{padPartSync();}catch(e){}
  // The bar that says WHICH configuration this capsule carries, and whether it is still the saved
  // one (rf-49b). Hooked here rather than into every caller: this function already runs on every
  // edit, every capsule switch and every packet of rules, which is exactly when the answer changes.
  if(typeof trigCfgSync==="function")try{trigCfgSync();}catch(e){}
  void 0/* drag-reorder is off for this list — the drag handle was removed */;
}

