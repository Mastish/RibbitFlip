/* Turns the sound-editor's <input type=range> sliders into rotary knobs.
   The range element stays the single source of truth (hidden, aria-hidden, not focusable): the knob
   and the number box only write to it and re-read it, so code that syncs the sliders keeps working.
   Self-contained IIFE — nothing here is shared with the classic-script globals. */
(function(){
'use strict';
// Knob cap artwork per editor section, resolved from the section's <summary> text.
var KNOB_SKINS={master:'--knob-6',osc:'--knob-8',filter:'--knob-11',env:'--knob-2',char:'--knob-4'};
function fmtFor(step){var dec=(String(step).split('.')[1]||'').length;return function(v){var n=+(+v).toFixed(dec);return String(n);};}
var KnobUI={
  _done:(typeof WeakSet!=='undefined')?new WeakSet():null,
  _seen:function(r){if(this._done){if(this._done.has(r))return true;this._done.add(r);return false;}if(r._knob)return true;return false;},
  init:function(){
    var box=document.getElementById('soundEditor');if(!box)return;
    var rs=box.querySelectorAll('.se-fld > input[type=range]');
    for(var i=0;i<rs.length;i++)this._wrap(rs[i]);
    this.syncAll();
  },
  _skinFor:function(range){
    var sec=range.closest?range.closest('.se-sec'):null,key='master';
    if(sec){var s=sec.querySelector(':scope > summary'),t=s?s.textContent:'';
      if(/oscylator|oscillator/i.test(t))key='osc';
      else if(/filtr|filter/i.test(t))key='filter';
      else if(/obwiednia|envelope/i.test(t))key='env';
      else if(/charakter|character/i.test(t))key='char';}
    return KNOB_SKINS[key]||KNOB_SKINS.master;
  },
  _wrap:function(range){
    if(this._seen(range))return;
    var label=range.closest('.se-fld');if(!label)return;
    label.classList.add('se-knob-fld');
    var a=parseFloat(range.min),b=parseFloat(range.max),step=parseFloat(range.step)||1;
    if(!isFinite(a))a=0;if(!isFinite(b))b=100;
    var fmt=fmtFor(range.step||'1');
    // parse the label span -> clean name + unit; keep the <b id=…V> readout (hidden) because other
    // code still writes the current value into it
    var span=label.querySelector(':scope > span'),name='',unit='',bEl=null;
    if(span){
      bEl=span.querySelector('b');
      var kids=Array.prototype.slice.call(span.childNodes);
      var bi=bEl?kids.indexOf(bEl):-1;
      name=kids.slice(0,bi<0?kids.length:bi).map(function(n){return n.textContent;}).join('').replace(/\s+/g,' ').trim();
      unit=(bi<0)?'':kids.slice(bi+1).map(function(n){return n.textContent;}).join('').replace(/\s+/g,' ').trim();
      while(span.firstChild)span.removeChild(span.firstChild);
      span.appendChild(document.createTextNode(name));
      if(bEl){bEl.style.display='none';span.appendChild(bEl);}
    }
    range.classList.add('knob-model');range.tabIndex=-1;range.setAttribute('aria-hidden','true');
    var skin=this._skinFor(range);
    var knob=document.createElement('div');
    knob.className='knob';knob.tabIndex=0;knob.setAttribute('role','slider');
    knob.setAttribute('aria-label',name||range.id||'wartość');
    knob.setAttribute('aria-valuemin',fmt(a));knob.setAttribute('aria-valuemax',fmt(b));
    // The big label over the cap is the CURRENT VALUE — the one thing a hand on a knob is looking
    // for. It used to be the arithmetic middle of min..max, a number that never moves and that
    // nobody asked for: GŁOŚNOŚĆ read "53" (the middle of 5..100) while the sound played at 42.
    // The middle is gone rather than moved down: min and max already frame the range, and a third
    // number on that 76 px row would land on the cap. _rotate() keeps this in step with aria-valuenow.
    knob.innerHTML=
      '<span class="knob-mark knob-val"></span>'+
      '<span class="knob-mark knob-min">'+fmt(a)+'</span>'+
      '<span class="knob-mark knob-max">'+fmt(b)+'</span>'+
      '<span class="knob-dial"><span class="knob-cap" style="background-image:var('+skin+')"></span></span>';
    var entry=document.createElement('div');entry.className='knob-entry';
    var num=document.createElement('input');num.type='number';num.className='knob-num';
    num.min=range.min;num.max=range.max;num.step=range.step;num.value=fmt(range.value);
    num.setAttribute('inputmode','decimal');var _nm=name||range.id;if(typeof _lang!=="undefined"&&_lang==="en"&&typeof I18N_EN!=="undefined"&&I18N_EN[_nm]!=null)_nm=I18N_EN[_nm];num.setAttribute('aria-label',_nm+_gl(' — wartość',' — value'));
    entry.appendChild(num);
    if(unit){var us=document.createElement('span');us.className='knob-unit';us.textContent=unit;entry.appendChild(us);}
    label.insertBefore(knob,range);
    label.insertBefore(entry,range);
    range._knob={knob:knob,cap:knob.querySelector('.knob-cap'),val:knob.querySelector('.knob-val'),
                 num:num,a:a,b:b,fmt:fmt};
    var self=this;
    // `typing` = the number box is mid-edit, so the knob must not rewrite what is being typed.
    // It replaces a test on document.activeElement, which was wrong here for a reason easy to miss:
    // the whole control lives inside a <label>, so a click ANYWHERE in it — the dial included —
    // moves focus to the label's first labelable child, which is this very input. After one drag the
    // box counted as "focused", and from then on it silently kept the value it had while the dial
    // and the readout above it moved on.
    var typing=false;
    function setVal(v){if(!isFinite(v))return;typing=false;   // a turn of the dial IS the new value
      range.value=String(v);range.dispatchEvent(new Event('input',{bubbles:true}));}
    // vertical drag — Shift stretches the travel (560px vs 175px per full range) for fine tuning
    var drag=null;
    knob.addEventListener('pointerdown',function(e){
      if(e.button!=null&&e.button!==0)return;
      try{knob.setPointerCapture(e.pointerId);}catch(_){}
      knob.classList.add('dragging');drag={y:e.clientY,v:parseFloat(range.value)};e.preventDefault();});
    knob.addEventListener('pointermove',function(e){
      if(!drag)return;var range_span=b-a,px=(e.shiftKey?560:175);
      setVal(drag.v+((drag.y-e.clientY)/px)*range_span);});
    function endDrag(){if(!drag)return;drag=null;knob.classList.remove('dragging');}
    knob.addEventListener('pointerup',endDrag);knob.addEventListener('pointercancel',endDrag);
    knob.addEventListener('lostpointercapture',endDrag);
    // wheel
    knob.addEventListener('wheel',function(e){e.preventDefault();
      var d=(e.deltaY<0?1:-1)*step*(e.ctrlKey?10:1);setVal(parseFloat(range.value)+d);},{passive:false});
    // keyboard
    knob.addEventListener('keydown',function(e){
      var k=e.key,v=parseFloat(range.value),big=step*10;
      if(k==='ArrowUp'||k==='ArrowRight')v+=step;
      else if(k==='ArrowDown'||k==='ArrowLeft')v-=step;
      else if(k==='PageUp')v+=big;else if(k==='PageDown')v-=big;
      else if(k==='Home')v=a;else if(k==='End')v=b;else return;
      e.preventDefault();setVal(v);});
    // dblclick = reset to the HTML default value
    knob.addEventListener('dblclick',function(e){e.preventDefault();
      var d=range.getAttribute('value');if(d!=null&&d!=='')setVal(parseFloat(d));});
    // manual number entry
    num.addEventListener('input',function(){typing=true;var v=parseFloat(num.value);
      if(isFinite(v)){range.value=String(v);range.dispatchEvent(new Event('input',{bubbles:true}));}});
    num.addEventListener('change',function(){typing=false;self.syncOne(range);});
    num.addEventListener('blur',function(){typing=false;});
    num.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();num.blur();}});
    // keep the dial + number box in step with the range value, whoever changed it
    range.addEventListener('input',function(){self._rotate(range);
      if(!typing)num.value=range._knob.fmt(range.value);});
  },
  _rotate:function(range){var k=range._knob;if(!k)return;var a=k.a,b=k.b;
    var t=(b>a)?(parseFloat(range.value)-a)/(b-a):0;t=Math.max(0,Math.min(1,t));
    var ang=-135+t*270;k.cap.style.transform='rotate('+ang+'deg)';
    var txt=k.fmt(range.value);
    if(k.val&&k.val.textContent!==txt)k.val.textContent=txt;   // the label over the cap IS aria-valuenow
    k.knob.setAttribute('aria-valuenow',txt);
    k.knob.setAttribute('aria-valuetext',txt);},
  syncOne:function(range){var k=range._knob;if(!k)return;this._rotate(range);
    if(document.activeElement!==k.num)k.num.value=k.fmt(range.value);},
  syncAll:function(){var box=document.getElementById('soundEditor');if(!box)return;var self=this;
    var rs=box.querySelectorAll('.se-fld > input[type=range]');
    for(var i=0;i<rs.length;i++){if(rs[i]._knob)self.syncOne(rs[i]);}}
};
window.KnobUI=KnobUI;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){KnobUI.init();});
else KnobUI.init();
})();
