"use strict";
// ===================== KLIK BEZ KLIKANIA (dwell) =====================
// Trzecia część karty „Mysz". Kursor prowadzony kapslem, który przystanie na chwilę w jednym
// miejscu, klika sam; następny klik dopiero wtedy, gdy kursor opuści promień spokoju.
//
// PO CO TO JEST: prowadzenie kursora i wciśnięcie przycisku to dwie różne sprawności. Kapsel daje
// pierwszą każdemu, kto potrafi poruszyć ręką — bez tej sekcji taki kursor dojeżdża wszędzie i
// niczego nie otwiera. To ułatwienie dostępności, a przy okazji wygoda, gdy ręce są zajęte albo
// kapsel jest trzymany jak wskaźnik do prezentacji.
//
// DLACZEGO OSOBNY PLIK: rf-31 ma ponad 700 linii, czyli powyżej miękkiego limitu z reguły
// organizacji JS, a rf-31b (obszar kursora) to zupełnie inny temat. Nowa funkcja idzie do
// własnego modułu.
//
// GDZIE MIESZKA LOGIKA: w silniku (AirMouse._dwell_tick w ribbitflip_monitor.py). Tutaj są
// wyłącznie pokrętła i zdanie, które tłumaczy, co ustawiono — przeglądarka nie odlicza niczego
// sama, bo klik i tak musi przejść przez bramkę „Uzbrojone" po stronie serwera.

// Suwak czasu chodzi w milisekundach, bo tak trzyma to silnik, ale człowiek myśli sekundami —
// „0,9 s" czyta się od razu, „900" wymaga rachunku. Przecinek, nie kropka: to polski panel.
function _mDwellSec(ms){
  const v=Math.max(0,+ms||0)/1000;
  const s=(v<10?v.toFixed(1):v.toFixed(0));
  return (_lang==="en"?s:s.replace(".",","))+" s";
}

// Podpisy suwaków, stan segmentu „Rodzaj kliknięcia" i zdanie pod pudełkiem. Zdanie (z uczciwym
// warunkiem: klika tylko wtedy, gdy kapsel prowadzi kursor i sterowanie jest włączone) składa
// rf-31e razem z linią gotowości, bo oba liczą się z tych samych stanów.
function mDwellSync(){
  const $=id=>document.getElementById(id),m=state.mouse;
  const ms=$("mDwellMsv");if(ms)ms.textContent=_mDwellSec(m.dwellMs);
  const rd=$("mDwellRadv");if(rd)rd.textContent=Math.round(+m.dwellRadius||0)+" px";
  const sg=$("mDwellClickSeg");
  if(sg)for(const b of sg.querySelectorAll("button")){const on=(b.dataset.v===(m.dwellClick||"left"));
    b.classList.toggle("on",on);b.setAttribute("aria-pressed",on?"true":"false");}
  if(typeof mMouseCondSync==="function")mMouseCondSync();
}

// --- podpięcia ---------------------------------------------------------------------------------
// Fabryki `chk` / `rng` / `selStr` z rf-31 są lokalne dla initMouse(), więc nie ma ich w tym
// zasięgu — poniżej ten sam wzorzec, trzy linijki, zamiast eksportowania czegokolwiek na globalny
// obiekt tylko po to, żeby wywołać je raz.
function initMouseDwell(){
  const $=id=>document.getElementById(id),m=()=>state.mouse;
  {const e=$("mDwellOn");if(e)e.onchange=()=>{m().dwellOn=e.checked;mFill();commitMouse();};}
  {const e=$("mDwellMs");if(e)e.oninput=()=>{m().dwellMs=+e.value;mDwellSync();commitMouse();};}
  {const e=$("mDwellRad");if(e)e.oninput=()=>{m().dwellRadius=+e.value;mDwellSync();commitMouse();};}
  // Rodzaj kliknięcia: segment zamiast listy (cztery krótkie słowa mieszczą się w rzędzie).
  {const sg=$("mDwellClickSeg");
   if(sg)for(const b of sg.querySelectorAll("button"))
     b.onclick=()=>{m().dwellClick=b.dataset.v;mDwellSync();commitMouse();};}
  mDwellSync();
}

// --- pierścień postępu na podglądzie ------------------------------------------------------------
// Rysowany wokół kropki kursora przez rf-31 (i przez ten sam kod w nakładkach), z danych, które
// silnik i tak wysyła w pakiecie „mouse": dwOn + dw (0..1). Osobna funkcja, bo to jedyny kawałek
// tej funkcji, który musi być wołany z pętli klatek cudzego pliku.
function drawDwellRing(ctx,x,y,S,p){
  if(!p||!p.dwOn)return;
  const v=Math.max(0,Math.min(1,+p.dw||0));
  if(v<=0.02)return;                     // pusty pierścień to tylko szum przy kursorze
  const r=13*S;
  ctx.save();
  ctx.lineCap="round";
  ctx.globalAlpha=0.30;ctx.strokeStyle=cv('--line');ctx.lineWidth=2.6*S;
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();
  ctx.globalAlpha=1;ctx.strokeStyle=cv('--ok');ctx.lineWidth=2.6*S;
  ctx.beginPath();ctx.arc(x,y,r,-Math.PI/2,-Math.PI/2+v*Math.PI*2);ctx.stroke();
  ctx.restore();
}
