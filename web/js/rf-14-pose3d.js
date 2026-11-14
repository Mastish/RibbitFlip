"use strict";
// ===================== 3D PUCK ORIENTATION (quaternion filter + preview widgets) =====================
// 6-axis IMU without a magnetometer: tilt (pitch/roll) is OBSERVABLE from gravity,
// direction (yaw) is NOT — that's why yaw is "relative" (Recenter button) and does not drift
// thanks to subtracting gyroscope bias at rest. Orientation: Mahony filter on a quaternion —
// we integrate the ENTIRE gyroscope vector (no gimbal lock / axis jumps), and the accelerometer
// only pulls in the tilt. Working on a quaternion also avoids the antipodal singularity that
// Euler-angle bookkeeping hits when the puck is turned upside down.
const POSE={
  q:[1,0,0,0],                 // quaternion body->world (w,x,y,z)
  gbias:[0,0,0],               // gyroscope bias (LSB) — learned when stationary
  gmagEMA:0, seeded:false, smooth:true, lastTs:null,
  // WHOSE axis config is loaded here. The Sensor tab shows one capsule at a time and this object is
  // a single one, so without knowing whose settings it holds, an edit made straight after switching
  // capsules writes the PREVIOUS capsule's whole calibration onto the new one. null = still loading;
  // nothing may be saved until it names a capsule (see pushPoseConfig in rf-33).
  dev:null,
  tiltDeg:0, twistDps:0,       // smoothed values for readout
  camPitch:0.95,
  // AXIS CALIBRATION — per filter axis: [source channel CH0-5, sign +1/-1].
  // acc = [pitch(front/back), roll(left/right), puck axis]; gyr = [pitch-rate, roll-rate, twist].
  // All-positive accel = the owner's real capsules (default since 2026-08-20); the ⚙ pose panel can override.
  cal:{acc:[[3,1],[4,1],[5,1]], gyr:[[0,1],[1,1],[2,1]]},
  resp:0.34,                   // filter sensitivity: 0=smooth/slow .. 1=sharp/fast (Kp + EMA strength)
  gain:1.0,                    // "tilt acceleration": multiplier for 3D axis metrics (server-side, tilt/twist/pitch/roll)
  smoothLvl:1.0,               // preview smoothing level (0=raw, 1=very smooth); used when smooth=ON
  mirror:false,                // optional left/right flip; user override in the pose ⚙ panel
  // Which lean axes REPORT the opposite sign. Held here only so the ⚙ panel can edit and persist it —
  // the inversion itself happens server-side in PoseFilter.pose(), so every consumer (triggers, stick,
  // d-pad, mouse, MIDI/OSC, pads, the axes scope) flips together. The preview below is deliberately
  // left alone: the ball shows where the capsule really is, whatever the axes report.
  inv:{pitch:false,roll:false},
  // PER-AXIS TUNING (opt-in, identity by default) — smoothing, trim, dead zone, range and curve for
  // each axis on its own. Mirrors POSE_AXIS_* on the server, which is where the shaping actually
  // happens (one place = the scope, triggers, stick, d-pad, mouse, MIDI/OSC and pad gates all agree).
  // Held here so the ⚙ panel can edit and persist it; `full` per axis = tilt 180, twist 720, lean 90.
  axes:{tilt:{on:false,smooth:'ema',smoothMs:0,zero:0,dead:0,inHi:180,outHi:180,expo:1},
        twist:{on:false,smooth:'ema',smoothMs:0,zero:0,dead:0,inHi:720,outHi:720,expo:1},
        pitch:{on:false,smooth:'ema',smoothMs:0,zero:0,dead:0,inHi:90,outHi:90,expo:1},
        roll:{on:false,smooth:'ema',smoothMs:0,zero:0,dead:0,inHi:90,outHi:90,expo:1}},
  // THE SAME CHAIN ON THE SIX RAW CHANNELS (accelerometer + gyroscope), because a bare channel is a
  // source in its own right — triggers, MIDI/OSC, stick/d-pad/mouse and pad gates can all read one.
  // Shaped server-side in PoseFilter.shape_channels; `full` = 32768, the int16 span the whole app
  // already uses for a raw channel. Filled in by poseChansAll() on the first read.
  chans:{},
  view2d:false,                // orientation preview: false=3D ball, true=2D inclinometer (tilt+rotation)
  mode:'mahony',               // preview orientation source: filter | accel | gyro | mahony (mahony = the owner's working default)
  qGyro:[1,0,0,0], qGyroSeeded:false,   // quaternion for GYRO mode (dead-reckoning from the entire gyroscope)
  qMahony:[1,0,0,0], qMahonySeeded:false,// quaternion for MAHONY mode (reference complementary filter)
  GYRO_LSB:131,                // LSB per deg/s, assuming a ±250 dps MPU6050-class part (unverified for this unit)
  ACC_MIN:120, ACC_MAX:20000,  // dead zone: discard junk/missing data (scale ~2048 LSB/g)
  IMPACT:600,                  // freeze tilt pull-in when linear acceleration is large
  STILL_GYRO:900, STILL_ACC:220, // "stationary" thresholds for bias learning
  Kp:2.2,                      // gain for pulling tilt toward the accelerometer
};
const DEG2RAD=Math.PI/180;
const v_cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const v_norm=v=>{const l=Math.hypot(v[0],v[1],v[2])||1;return [v[0]/l,v[1]/l,v[2]/l];};
const m_v=(m,v)=>[m[0]*v[0]+m[1]*v[1]+m[2]*v[2],m[3]*v[0]+m[4]*v[1]+m[5]*v[2],m[6]*v[0]+m[7]*v[1]+m[8]*v[2]];
function m_m(a,b){const o=new Array(9);for(let r=0;r<3;r++)for(let c=0;c<3;c++)o[r*3+c]=a[r*3]*b[c]+a[r*3+1]*b[3+c]+a[r*3+2]*b[6+c];return o;}
function m_rotAxis(ax,ang){const a=v_norm(ax),c=Math.cos(ang),s=Math.sin(ang),t=1-c,x=a[0],y=a[1],z=a[2];
  return [t*x*x+c,t*x*y-s*z,t*x*z+s*y, t*x*y+s*z,t*y*y+c,t*y*z-s*x, t*x*z-s*y,t*y*z+s*x,t*z*z+c];}
const m_rotX=a=>{const c=Math.cos(a),s=Math.sin(a);return [1,0,0, 0,c,-s, 0,s,c];};
function m_shortArc(f,t){f=v_norm(f);t=v_norm(t);let d=Math.max(-1,Math.min(1,f[0]*t[0]+f[1]*t[1]+f[2]*t[2]));
  if(d>0.9999)return [1,0,0,0,1,0,0,0,1];
  if(d<-0.9999){const ref=Math.abs(f[0])<0.9?[1,0,0]:[0,1,0];return m_rotAxis(v_norm(v_cross(f,ref)),Math.PI);}
  return m_rotAxis(v_cross(f,t),Math.acos(d));}
// 3x3 rotation matrix (row-major) from the body->world quaternion
function poseMatrix(q){const w=q[0],x=q[1],y=q[2],z=q[3];
  return [1-2*(y*y+z*z), 2*(x*y-w*z),   2*(x*z+w*y),
          2*(x*y+w*z),   1-2*(x*x+z*z), 2*(y*z-w*x),
          2*(x*z-w*y),   2*(y*z+w*x),   1-2*(x*x+y*y)];}
// ===== JEDNA KONWENCJA WIDOKU KULI — dla dużej karty I dla każdej miniatury ======================
// `POSE_E` mapuje osie ziemi na osie rysunku (Z-up → Y-up) i jest zestrojona z podglądem 2D oraz
// z pitch/roll liczonym po stronie serwera: pose-X = CH3 (przód-tył), pose-Y = CH4 (lewo-prawo).
// det=+1, czyli to obrót, a nie odbicie: zwrot obrotu (twist) zostaje taki, jak w rzeczywistości.
//
// ⚠️ DLACZEGO TO STOI OSOBNO. Do 2026-08-30 tę macierz miały DWIE kopie: ta i własna w
// `drawMiniPose` (rf-12), zapisana jako `[1,0,0, 0,0,1, 0,-1,0]`. Obie kładły oś kapsla (+Z) w to
// samo miejsce, więc kule wyglądały podobnie i nikt tego nie łapał — ale osie X i Y były w nich
// obrócone względem siebie o 90°, przez co ta sama orientacja dawała południk zerowy (złota linia
// pokazująca OBRÓT) w dwóch różnych miejscach, więc orientacja
// 3D na czujniku i w prawym menu się nie pokrywała. Jedna funkcja zamiast dwóch stałych to jedyny
// sposób, żeby to się nie rozjechało po raz drugi.
const POSE_E=[0,-1,0, 0,0,1, -1,0,0];
function poseViewMatrix(R){ return m_m(m_rotX(POSE.camPitch),m_m(POSE_E,R)); }
function poseMirrorX(){ return POSE.mirror?-1:1; }   // lustro z panelu ⚙ osi — dotyczy każdego rysunku kuli

// orientation interpolation (normalized lerp, shortest path) — smooths the preview refresh
//  up to 60 fps despite the pv stream at ~12 Hz (eliminates "stepping"/stutter in rotation).
function qnlerp(a,b,t){let d=a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3];const s=d<0?-1:1;
  const r=[a[0]+(s*b[0]-a[0])*t,a[1]+(s*b[1]-a[1])*t,a[2]+(s*b[2]-a[2])*t,a[3]+(s*b[3]-a[3])*t];
  const n=Math.hypot(r[0],r[1],r[2],r[3])||1;return [r[0]/n,r[1]/n,r[2]/n,r[3]/n];}
// shortest quaternion rotating vector a->b
function quatFromTo(a,b){a=v_norm(a);b=v_norm(b);
  const d=a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  if(d>0.999999)return [1,0,0,0];
  if(d<-0.999999){const ax=Math.abs(a[0])<0.9?[1,0,0]:[0,1,0];const c=v_norm(v_cross(a,ax));return [0,c[0],c[1],c[2]];}
  const c=v_cross(a,b),s=Math.sqrt((1+d)*2),inv=1/s,q=[s*0.5,c[0]*inv,c[1]*inv,c[2]*inv];
  const n=Math.hypot(q[0],q[1],q[2],q[3])||1;return [q[0]/n,q[1]/n,q[2]/n,q[3]/n];}
// "Recenter": recompute orientation from current gravity (zeroes yaw)
function poseRecenter(){POSE.twistAngle=0;POSE.upS=null;POSE.qGyroSeeded=false;POSE.qMahonySeeded=false;
  POSE.spinPhase=0;POSE.angVelDps=0;}   // recenter: zero twist + refresh "up" + reseed modes + zero the rotation indicator
// ORIENTATION PREVIEW — DIRECTLY from sensors (responsive, no lag):
//  • TILT: directly from the gravity vector (accelerometer) — instant, ZERO integration/lag.
//  • TWIST (rotation around the puck axis): the only thing not observable from accel -> we integrate the gyro projection onto the gravity axis.
// The Mahony filter is deliberately NOT on this path: its Kp pull adds visible lag. It stays
// available as an explicit preview mode (POSE.mode==='mahony') for comparison.
function poseUpdate(){
  const B=VB(), L=B.last, ts=B.nowTs;   // 3D orientation follows the VIEWED capsule
  const C=POSE.cal, ch=i=>(L[RE_NAME[i]]||0);
  const ax=C.acc[0][1]*ch(C.acc[0][0]), ay=C.acc[1][1]*ch(C.acc[1][0]), az=C.acc[2][1]*ch(C.acc[2][0]); // "up" vector (=-gravity)
  const gx=C.gyr[0][1]*ch(C.gyr[0][0]), gy=C.gyr[1][1]*ch(C.gyr[1][0]), gz=C.gyr[2][1]*ch(C.gyr[2][0]); // gyro
  const amag=Math.hypot(ax,ay,az);
  let dt=(POSE.lastTs==null)?0:ts-POSE.lastTs; POSE.lastTs=ts;
  if(!(dt>=0&&dt<0.2))dt=0;
  if(amag<POSE.ACC_MIN||amag>POSE.ACC_MAX)return;                              // dead zone: hold the last orientation
  const up=[ax/amag,ay/amag,az/amag];
  const _resp=POSE.resp==null?0.34:POSE.resp;
  const aUp=POSE.smooth?Math.max(0.04,1-(POSE.smoothLvl==null?1.0:POSE.smoothLvl)):1;   // "smooth": ON=EMA per smoothing level, OFF=raw
  if(!POSE.upS)POSE.upS=up.slice();
  else{for(let i=0;i<3;i++)POSE.upS[i]=POSE.upS[i]*(1-aUp)+up[i]*aUp;
    const n=Math.hypot(POSE.upS[0],POSE.upS[1],POSE.upS[2])||1;POSE.upS[0]/=n;POSE.upS[1]/=n;POSE.upS[2]/=n;}
  // gyro bias — learn only when stationary
  const gm=POSE.gmagEMA||amag,accdev=Math.abs(amag-gm);POSE.gmagEMA=gm+0.1*(amag-gm);
  if(Math.hypot(gx,gy,gz)<POSE.STILL_GYRO&&accdev<POSE.STILL_ACC){
    POSE.gbias[0]+=0.02*(gx-POSE.gbias[0]);POSE.gbias[1]+=0.02*(gy-POSE.gbias[1]);POSE.gbias[2]+=0.02*(gz-POSE.gbias[2]);}
  // twist = gyro projection (bias-free) onto the gravity axis (upS) -> °/s; we integrate the puck's rotation angle
  const u=POSE.upS;
  const twist=((gx-POSE.gbias[0])*u[0]+(gy-POSE.gbias[1])*u[1]+(gz-POSE.gbias[2])*u[2])/POSE.GYRO_LSB;
  if(POSE.twistAngle==null)POSE.twistAngle=0;
  if(dt>0)POSE.twistAngle+=twist*DEG2RAD*dt;
  const _aW=0.10+_resp*0.4;
  POSE.twistDps=POSE.smooth?POSE.twistDps*(1-_aW)+twist*_aW:twist;
  // |gyro| (°/s) — total angular velocity for the "rot/s" indicator (rotation animation)
  const gmagDps=Math.hypot(gx-POSE.gbias[0],gy-POSE.gbias[1],gz-POSE.gbias[2])/POSE.GYRO_LSB;
  POSE.angVelDps=(POSE.angVelDps==null)?gmagDps:POSE.angVelDps*0.8+gmagDps*0.2;   // EMA — smooth indicator
  POSE.tiltDeg=Math.acos(Math.max(-1,Math.min(1,u[2])))/DEG2RAD;              // tilt DIRECTLY (no lag)
  // GYRO MODE (user-selectable): pure integration of the ENTIRE gyroscope — shows raw
  // rotation straight from the gyro (spin+tilt), but drifts (no accel correction). Seed from current gravity.
  if(!POSE.qGyroSeeded){POSE.qGyro=quatFromTo(u,[0,0,1]);POSE.qGyroSeeded=true;}
  else if(dt>0){
    const wx=(gx-POSE.gbias[0])/POSE.GYRO_LSB*DEG2RAD,wy=(gy-POSE.gbias[1])/POSE.GYRO_LSB*DEG2RAD,wz=(gz-POSE.gbias[2])/POSE.GYRO_LSB*DEG2RAD;
    const q=POSE.qGyro,qw=q[0],qx=q[1],qy=q[2],qz=q[3];
    q[0]+=0.5*dt*(-qx*wx-qy*wy-qz*wz);q[1]+=0.5*dt*(qw*wx+qy*wz-qz*wy);q[2]+=0.5*dt*(qw*wy-qx*wz+qz*wx);q[3]+=0.5*dt*(qw*wz+qx*wy-qy*wx);
    const n=Math.hypot(q[0],q[1],q[2],q[3])||1;q[0]/=n;q[1]/=n;q[2]/=n;q[3]/=n;
  }
  // MAHONY MODE (selectable, preview): complementary filter — gyroscope integration
  // + accelerometer correction (Kp pulls toward "up"). Stable, but with lag (Kp).
  if(!POSE.qMahonySeeded){POSE.qMahony=quatFromTo(up,[0,0,1]);POSE.qMahonySeeded=true;}
  else if(dt>0){
    const Kp=0.8+_resp*4.2, q=POSE.qMahony;
    const vx=2*(q[1]*q[3]-q[0]*q[2]),vy=2*(q[0]*q[1]+q[2]*q[3]),vz=q[0]*q[0]-q[1]*q[1]-q[2]*q[2]+q[3]*q[3]; // est. "up" in body frame
    const ex=up[1]*vz-up[2]*vy, ey=up[2]*vx-up[0]*vz, ez=up[0]*vy-up[1]*vx;                                  // error = up_meas × v_est
    let wx=(gx-POSE.gbias[0])/POSE.GYRO_LSB*DEG2RAD+Kp*ex, wy=(gy-POSE.gbias[1])/POSE.GYRO_LSB*DEG2RAD+Kp*ey, wz=(gz-POSE.gbias[2])/POSE.GYRO_LSB*DEG2RAD+Kp*ez;
    const qw=q[0],qx=q[1],qy=q[2],qz=q[3];
    q[0]+=0.5*dt*(-qx*wx-qy*wy-qz*wz);q[1]+=0.5*dt*(qw*wx+qy*wz-qz*wy);q[2]+=0.5*dt*(qw*wy-qx*wz+qz*wx);q[3]+=0.5*dt*(qw*wz+qx*wy-qy*wx);
    const n=Math.hypot(q[0],q[1],q[2],q[3])||1;q[0]/=n;q[1]/=n;q[2]/=n;q[3]/=n;
  }
}
// 2D PREVIEW ("either/or" alternative to the 3D sphere) — inclinometer based on the filter:
//  • BUBBLE = direction + magnitude of TILT (projection of the "up" vector upS; center = level, edge = 90°),
//  • NEEDLE = ROTATION of the puck around its own axis (integrated twistAngle), 30/60/90° rings = scale.
function drawPose2D(ctx,w,h){
  const cx=w/2, cy=h/2, R=Math.min(w,h)*0.40, mx=POSE.mirror?-1:1;
  const u=POSE.upS||[0,0,1];
  // tilt scale rings (30/60/90°)
  ctx.lineWidth=1; ctx.textAlign="center"; ctx.textBaseline="middle";
  for(const deg of [30,60,90]){const rr=R*deg/90;
    ctx.strokeStyle=cv('--line'); ctx.globalAlpha=deg===90?0.85:0.35;
    ctx.beginPath(); ctx.arc(cx,cy,rr,0,7); ctx.stroke();
    ctx.globalAlpha=0.5; ctx.fillStyle=cv('--dim'); ctx.font="9px "+cv('--mono');
    ctx.fillText(deg+"°", cx+rr*0.71, cy-rr*0.71);}
  ctx.globalAlpha=1;
  // ===== X / Y REFERENCE AXES — shared vocabulary, oriented like the 3D ball at rest (X up = front, Y left = left) =====
  const COLX=cv('--ax'), COLY=cv('--gy');                       // X=pink · Y=green (same colors as the 3D labels)
  ctx.lineWidth=1.4; ctx.globalAlpha=0.5;
  ctx.strokeStyle=COLX; ctx.beginPath(); ctx.moveTo(cx,cy-R); ctx.lineTo(cx,cy+R); ctx.stroke();   // vertical  = X (front–back)
  ctx.strokeStyle=COLY; ctx.beginPath(); ctx.moveTo(cx-R,cy); ctx.lineTo(cx+R,cy); ctx.stroke();   // horizontal = Y (left–right)
  ctx.globalAlpha=1; ctx.font="700 10px "+cv('--mono'); ctx.textBaseline="middle";
  ctx.fillStyle=COLX; ctx.textAlign="center";
  ctx.fillText("X", cx, cy-R-17); ctx.fillText("−X", cx, cy+R+18);          // X = front (up) · −X = back (down)
  ctx.fillStyle=COLY;
  ctx.fillText("Y", cx-R-14, cy-9); ctx.fillText("−Y", cx+R+14, cy-9);      // Y = left · −Y = right
  ctx.globalAlpha=0.7; ctx.fillStyle=cv('--dim'); ctx.font="9px "+cv('--sans');
  ctx.fillText(_cvT("przód"),cx,cy-R-6); ctx.fillText(_cvT("tył"),cx,cy+R+7);
  ctx.fillText("L",cx-R-14,cy+9); ctx.fillText("P",cx+R+14,cy+9);
  ctx.textAlign="center"; ctx.globalAlpha=1;
  // ROTATION NEEDLE (twist around the puck axis) — rotates like a hand
  const ta=(POSE.twistAngle||0)*mx;
  ctx.save(); ctx.translate(cx,cy); ctx.rotate(-ta);
  ctx.strokeStyle=cv('--ax'); ctx.globalAlpha=0.9; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(0,R*0.18); ctx.lineTo(0,-R*0.9); ctx.stroke();
  ctx.fillStyle=cv('--ax'); ctx.beginPath(); ctx.moveTo(0,-R*0.9); ctx.lineTo(-5,-R*0.76); ctx.lineTo(5,-R*0.76); ctx.closePath(); ctx.fill();
  ctx.restore(); ctx.globalAlpha=1;
  // tilt BUBBLE: position = projection of "up" onto the plane (center=level, edge=90°)
  const bx=cx+mx*u[1]*R, by=cy+u[0]*R, tiltN=Math.min(1,(POSE.tiltDeg||0)/90);   // front/back sign aligned to 3D + server
  ctx.strokeStyle=cv('--az'); ctx.globalAlpha=0.45; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(bx,by); ctx.stroke(); ctx.globalAlpha=1;
  ctx.fillStyle=cv('--az'); ctx.beginPath(); ctx.arc(bx,by,6+4*tiltN,0,7); ctx.fill();
  ctx.strokeStyle="rgba(0,0,0,.3)"; ctx.lineWidth=1; ctx.stroke();
  ctx.fillStyle=cv('--dim'); ctx.beginPath(); ctx.arc(cx,cy,2.5,0,7); ctx.fill();
}
const _pn=v=>{const r=Math.round(v||0);return r===0?0:r;};   // no "-0" in the readout
// PODPISY POD KULĄ, PISANE TYLKO WTEDY, GDY SIĘ ZMIENIŁY.
// `innerHTML=` to za każdym razem sparsowanie kawałka HTML-a i zbudowanie węzłów od nowa, a te dwa
// napisy szły tak 60 razy na sekundę, przez cały czas spędzony w zakładce Czujnik — także wtedy,
// gdy kapsel leżał nieruchomo i tekst wychodził co do znaku ten sam (wartości są zaokrąglane do
// stopni, więc powtarzają się przez większość klatek, a podpis trybu jest praktycznie stały).
// Zmierzone na miejscu: samo to odpowiadało za 47% wszystkich przeliczeń stylów tej zakładki
// (5414 → 2871 w 10 s). Porównanie ze stringiem jest dużo tańsze niż parser HTML-a.
// Dymek pod skrócony podpis trybu (patrz `o.short`). Ta sama zasada, co w `_poseSet`: ruszamy DOM
// tylko wtedy, gdy napis naprawdę się zmienił — atrybut przepisywany 30 razy na sekundę budziłby
// obserwatora walkera i18n bez żadnego pożytku.
function _poseTip(id,txt){
  const e=document.getElementById(id); if(!e)return;
  if(e._rfTip===txt)return;
  e._rfTip=txt;
  if(txt)e.setAttribute("data-rftip",txt); else e.removeAttribute("data-rftip");
}
function _poseSet(id,html){
  const e=document.getElementById(id); if(!e)return;
  if(e._rfLast===html)return;                    // ten sam napis co poprzednio — nie ruszamy DOM-u
  e._rfLast=html; e.innerHTML=html;
}
// UCHWYTY OSI SĄ WŁASNOŚCIĄ PŁÓTNA, NIE APLIKACJI (2026-08-30, etap 9).
// Sześć liter osi to jednocześnie sześć uchwytów do chwytania (rf-14b), a ich współrzędne są
// EKRANOWE — liczone względem tego płótna, na którym zostały narysowane. Dopóki pełną kulę rysowała
// jedna karta, jedno globalne `POSE.axisHit` wystarczało. Od etapu 9 kul jest DWIE: duża
// (w zakładce Czujnik albo w pływającym okienku) i powiększona miniatura w prawej kolumnie, i obie
// stoją na ekranie JEDNOCZEŚNIE — bo tryb ręczny wynosi dużą kartę do okienka nad aplikacją
// (rf-14c `vpFloat`). Jedna zmienna dla obu znaczyłaby, że ta, która rysuje się jako druga w klatce,
// nadpisuje uchwyty pierwszej: klik w literę „Z" na dużej kuli celowałby w punkt policzony dla
// miniatury, czyli w losowe miejsce. Rozstrzygnięcie: hity wiszą na `canvas._poseHits`, więc uchwyt
// należy do obrazka, w który człowiek FAKTYCZNIE celuje — a `vpAxisAt` czyta je z płótna, które
// dostało zdarzenie wskaźnika. `POSE.axisHit` zostaje mirrorem DUŻEJ karty (zgodność wstecz dla
// wywołań `vpAxisAt` bez płótna), a nie źródłem prawdy.
function _poseHits(c,primary,hits){ c._poseHits=hits; if(primary)POSE.axisHit=hits; }
// PŁÓTNO W PARAMETRZE (2026-08-30, etap 9). Wołanie BEZ argumentów jest DOKŁADNIE tym, czym było:
// duża karta `#pose3d`, krok filtra, podpisy w `#pose3dInfo`/`#pose3dAxis`, odczyt w `#pcalLive`
// i publikacja uchwytów do `POSE.axisHit`. Tak leci jedyne wywołanie z pętli klatek (rf-09).
// Z argumentem rysuje tę samą kulę na innym płótnie — po to, żeby powiększona miniatura w prawej
// kolumnie NIE była drugą implementacją tej samej sfery (siatka południków, uchwyty osi, wskaźnik
// obrotów, plakietka diody, odczyty i podpis trybu to razem ~140 linii, których nie wolno mieć
// w dwóch egzemplarzach — rozjechałyby się przy pierwszej poprawce).
//   • `o.filter:false` — NIE rób kroku filtra. Miniatura rysuje się w tej samej klatce co duża
//     karta i ZAWSZE PO NIEJ (rf-09: `drawPose3D()` … potem `rfRcolMini.frame()`), więc filtr jest
//     już policzony. Drugi krok w tej samej klatce podwoiłby wygładzanie EMA (`upS`, `twistDps`,
//     `angVelDps`) — całki są bezpieczne, bo `dt` liczy się z czasu PRÓBKI i za drugim razem wyszłoby
//     zero, ale EMA nie pyta o `dt` i cicho przyspieszyłoby wygładzanie dużej karty.
//   • `o.info` / `o.axis` — id elementów na podpisy. Miniatura ma własne, bo dwa obrazki nie mogą
//     pisać do jednego napisu.
//   • odczyt `#pcalLive` pisze WYŁĄCZNIE wywołanie główne: to podpis karty „Osie 3D",
//     której egzemplarz jest jeden.
//   • `o.short:true` — podpis trybu SAMĄ NAZWĄ, bez drugiego wiersza z objaśnieniem, a całość
//     w dymku. Duża karta ma na ten podpis 430 px i stoi on w rogu nad pustym tłem; kafel w prawej
//     kolumnie ma 242 px, a poniżej 1280 px zaledwie 168 px — i tam dwuwierszowy podpis
//     („tryb: MAHONY" + „filtr komplementarny", razem 98 px) wchodził pod podpis kafla
//     („Orientacja 3D", 68 px), więc tekst w prawym górnym rogu był przycięty. Skracamy WYŁĄCZNIE tam, gdzie brakuje miejsca; duża karta zostaje bez zmian.
function drawPose3D(c,o){
  o=o||{};
  const primary=(c==null);
  c=c||document.getElementById("pose3d");if(!c)return;
  const idInfo=o.info||"pose3dInfo", idAxis=o.axis||"pose3dAxis";
  if(o.filter!==false)poseUpdate();               // filter step (also works when the widget is hidden in another tab)
  // POSE.drawnQ = the orientation ON SCREEN as a quaternion. Computed HERE, before the size check
  // and before the 2D-view branch, because it is READ FROM OUTSIDE this widget and must not depend
  // on whether this particular canvas happens to be visible:
  //   • rf-14b (manual control) turns "up on screen" into the capsule's own frame with it,
  //   • rf-34c draws the right column's mini puck from it.
  // Until 2026-08-29 the assignment sat below `if(!w||!h)return`, which was harmless only because
  // this card was permanently on screen in the right column. Once the card moved into the Sensor
  // tab, every other tab left drawnQ frozen at its last value (or undefined at boot) and the mini
  // puck showed "brak orientacji" while the capsule was plainly moving. The 2D view had the same
  // hole even when visible — it returns before this point.
  let R;
  let _loadScaleF=1;
  const _qz=a=>[Math.cos((a||0)/2),0,0,Math.sin((a||0)/2)];
  const _qmul=(a,b)=>[a[0]*b[0]-a[1]*b[1]-a[2]*b[2]-a[3]*b[3],
                      a[0]*b[1]+a[1]*b[0]+a[2]*b[3]-a[3]*b[2],
                      a[0]*b[2]-a[1]*b[3]+a[2]*b[0]+a[3]*b[1],
                      a[0]*b[3]+a[1]*b[2]-a[2]*b[1]+a[3]*b[0]];
  if(VB().scanning)_poseHits(c,primary,null);   // searching animation: nothing to grab
  if(VB().scanning){ POSE.drawnQ=POSE.loadQ||[1,0,0,0]; const _ch=loadingChoreo(_now()); _loadScaleF=_ch.scaleF; R=poseMatrix(POSE.drawnQ); }  // searching: looped choreography (rotation from the accumulated quaternion — smooth across cycles)
  else if(POSE.mode==='gyro'){ POSE.drawnQ=POSE.qGyro||[1,0,0,0]; R=poseMatrix(POSE.drawnQ); }           // raw GYRO (spin+tilt, drifts)
  else if(POSE.mode==='mahony'){ POSE.drawnQ=POSE.qMahony||[1,0,0,0]; R=poseMatrix(POSE.drawnQ); }       // preview Mahony complementary filter
  else if(POSE.mode==='accel'){ POSE.drawnQ=quatFromTo(POSE.upS||[0,0,1],[0,0,1]); R=poseMatrix(POSE.drawnQ); }  // CH3-5 ONLY: tilt alone (no rotation)
  else{ const up=POSE.upS||[0,0,1];                                            // FILTER: tilt from accel + twist from gyro
    POSE.drawnQ=_qmul(quatFromTo(up,[0,0,1]),_qz(POSE.twistAngle||0));
    R=m_m(poseMatrix(quatFromTo(up,[0,0,1])),m_rotAxis([0,0,1],POSE.twistAngle||0)); }
  const {ctx,w,h}=fit(c);
  if(!w||!h)return;                               // hidden — we don't draw it, but the filter still computes
  ctx.clearRect(0,0,w,h);
  if(POSE.view2d&&!VB().scanning){               // 2D VIEW (either/or) — inclinometer based on the filter
    _poseHits(c,primary,null);                  // no 3D handles in this view (see rf-14b)
    drawPose2D(ctx,w,h); drawRevSpinner(ctx,w,h); drawLedBadge(ctx,w,h);
    _poseSet(idInfo,
      `<span class="pm">pochylenie <b>${_pn(POSE.tiltDeg)}°</b></span> · <span class="pm">obrót <b>${_pn(POSE.twistDps)}</b> °/s</span> · <span class="pm">prędkość <b>${_pn(POSE.angVelDps)}</b> °/s</span>`);
    if(o.short){ _poseSet(idAxis,_gl("widok 2D","2D view")); _poseTip(idAxis,_gl("widok 2D — inklinometr (pochylenie) + obrót","2D view — inclinometer (tilt) + rotation")); }
    else _poseSet(idAxis,`<span style="color:var(--dim)">widok 2D — inklinometr (pochylenie) + obrót</span>`);
    if(primary){const _pcl=document.getElementById("pcalLive"); if(_pcl)_pcl.textContent=`tilt ${POSE.tiltDeg.toFixed(0)}° · twist ${POSE.twistDps.toFixed(0)}°/s`;}
    return;
  }
  // "is anything arriving" = the magnitude of the GRAVITY vector, read through the axis calibration.
  // It used to hypot CH0-2 — the GYROSCOPE — against an accelerometer threshold, so a capsule
  // lying perfectly still (gyro ≈ 0) reported "no data" while its data was streaming in. Visible
  // with a real puck at rest and constant while driving the simulated one by hand.
  const L=VB().last, _pc=POSE.cal,
        gmag=Math.hypot(L[RE_NAME[_pc.acc[0][0]]]||0,L[RE_NAME[_pc.acc[1][0]]]||0,L[RE_NAME[_pc.acc[2][0]]]||0);
  // orientation matrix per selected MODE + camera + (earth Z-up -> render Y-up)
  // `R` i `POSE.drawnQ` policzone na górze funkcji — patrz komentarz tam.
  const C=poseViewMatrix(R);
  const cx=w/2,cy=h/2,scale=Math.min(w,h)*0.40*_loadScaleF;   // scale ≤0.98 while searching (puck stays within the outline)
  const mx=POSE.mirror?-1:1;
  const P=v=>{const p=m_v(C,v);return {x:cx+mx*p[0]*scale,y:cy-p[1]*scale,z:p[2]};};
  // KAPSEL zamiast kuli (rf-14d) — ta sama macierz, litery osi i uchwyty rysują się niżej bez zmian.
  // Skin = grafika pokazywanego kapsla (rf-14d `kapselSkinOf`), więc 3D i pigułka mówią to samo.
  if(typeof syncPoseSkin==='function')syncPoseSkin();
  if(!(typeof poseBallIsCap==='function'&&poseBallIsCap()&&KAPSEL3D.draw(ctx,cx,cy,scale,C,mx,kapselSkinOf(kapselViewDev())))){
  // ===== ORIENTATION SPHERE =====  pole(+Z)=puck axis, equator=cyan, zero meridian=gold (shows rotation)
  const gr=ctx.createRadialGradient(cx-scale*0.35,cy-scale*0.35,scale*0.15,cx,cy,scale*1.15);
  gr.addColorStop(0,'#fdfaf2');gr.addColorStop(1,'#e6dcc6');
  ctx.fillStyle=gr;ctx.beginPath();ctx.arc(cx,cy,scale,0,7);ctx.fill();
  ctx.strokeStyle=cv('--line');ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(cx,cy,scale,0,7);ctx.stroke();
  const curve=(pts,colF,colB,lw)=>{const pr=pts.map(P);ctx.lineWidth=lw;   // BATCH: 2 stroke()/curve (back→front) instead of per-segment
    ctx.strokeStyle=colB;ctx.globalAlpha=0.20;ctx.beginPath();
    for(let i=1;i<pr.length;i++){const a=pr[i-1],b=pr[i];if(!(a.z>=-0.03&&b.z>=-0.03)){ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);}}
    ctx.stroke();
    ctx.strokeStyle=colF;ctx.globalAlpha=0.95;ctx.beginPath();
    for(let i=1;i<pr.length;i++){const a=pr[i-1],b=pr[i];if(a.z>=-0.03&&b.z>=-0.03){ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);}}
    ctx.stroke();ctx.globalAlpha=1;};
  const merid=d=>{const f=d*DEG2RAD,a=[];for(let i=0;i<=40;i++){const t=(-90+180*i/40)*DEG2RAD;a.push([Math.cos(t)*Math.cos(f),Math.cos(t)*Math.sin(f),Math.sin(t)]);}return a;};
  const paral=d=>{const t=d*DEG2RAD,a=[];for(let i=0;i<=48;i++){const f=360*i/48*DEG2RAD;a.push([Math.cos(t)*Math.cos(f),Math.cos(t)*Math.sin(f),Math.sin(t)]);}return a;};
  for(const lat of [-60,-30,0,30,60]) curve(paral(lat), lat===0?cv('--gx'):'#98876a','#c1b498', lat===0?2.4:1.35);   // parallels (equator cyan) — darker mesh reads the rotation on cream
  for(let lon=0;lon<360;lon+=30) curve(merid(lon), lon===0?cv('--az'):'#98876a','#c1b498', lon===0?2.8:1.35);       // meridians (zero one gold)
  const pole=P([0,0,1]),pb=P([0,0,-1]);
  ctx.fillStyle='#a89a7d';ctx.globalAlpha=pb.z>0?0.45:0.9;ctx.beginPath();ctx.arc(pb.x,pb.y,scale*0.045,0,7);ctx.fill();   // bottom of axis (−Z)
  ctx.fillStyle=cv('--az');ctx.globalAlpha=pole.z>0?1:0.4;ctx.beginPath();ctx.arc(pole.x,pole.y,scale*0.08,0,7);ctx.fill(); // top of axis (puck axis)
  ctx.globalAlpha=1;
  const fr=P([1,0,0]);ctx.fillStyle=cv('--ax');ctx.globalAlpha=fr.z>0?1:0.35;   // "front" marker — clearly shows rotation/twist
  ctx.beginPath();ctx.arc(fr.x,fr.y,scale*0.06,0,7);ctx.fill();ctx.globalAlpha=1;
  }
  // ===== AXIS REFERENCE LABELS (X/−X, Y/−Y, Z/−Z) — a shared vocabulary for talking about directions =====
  {
    const COLX=cv('--ax'), COLY=cv('--gy'), COLZ=cv('--az');   // X=pink · Y=green · Z=gold (= puck axis)
    ctx.textAlign="center";ctx.textBaseline="middle";
    // The six endpoints double as HANDLES for manual control (rf-14b): grab one and turn the
    // capsule about that axis. Their screen positions are published here rather than recomputed
    // there, so the grab can never drift from what is drawn.
    const hits=[];
    // Podświetlenie też jest per płótno (patrz `_poseHits`): najazd na literę „Y" w miniaturze
    // ma zapalić kółko W MINIATURZE, a nie na drugiej kuli po drugiej stronie ekranu.
    const hotK=(c._poseHot!==undefined)?c._poseHot:POSE.axisHot;
    const axLbl=(v,txt,col,dot)=>{
      const q=P(v), front=q.z>=-0.02;                          // behind the sphere → dim
      let dx=q.x-cx, dy=q.y-cy; const dl=Math.hypot(dx,dy)||1;   // push the letter just OUTSIDE the endpoint, radially
      const lx=q.x+dx/dl*scale*0.17, ly=q.y+dy/dl*scale*0.17;
      // `v` = the capsule's own axis this letter names, `z` = whether it points at the viewer.
      // Manual control (rf-14b) turns the capsule about v in its OWN frame — see the note there
      // for why that, and not the direction the letter is drawn at, is what keeps the two aligned.
      hits.push({k:txt,v,x:lx,y:ly,z:q.z,r:Math.max(15,scale*0.19)});
      if(hotK===txt){                                          // hovered / held: a ring you can aim at
        ctx.globalAlpha=front?0.9:0.5;ctx.strokeStyle=col;ctx.lineWidth=2;
        ctx.beginPath();ctx.arc(lx,ly,Math.max(11,scale*0.13),0,7);ctx.stroke();
        ctx.globalAlpha=0.16;ctx.fillStyle=col;ctx.fill();
      }
      if(dot){ ctx.globalAlpha=front?0.95:0.4;ctx.fillStyle=col;
        ctx.beginPath();ctx.arc(q.x,q.y,scale*0.03,0,7);ctx.fill(); }
      ctx.globalAlpha=front?1:0.42;
      ctx.font="800 "+Math.max(11,Math.round(scale*0.14))+"px "+cv('--mono');
      ctx.lineJoin="round";ctx.lineWidth=Math.max(2.4,scale*0.03);ctx.strokeStyle="rgba(253,250,242,.92)";
      ctx.strokeText(txt,lx,ly);                                // cream halo → letters stay legible over the mesh
      ctx.fillStyle=col;ctx.fillText(txt,lx,ly);
    };
    axLbl([0,0,1],"Z",COLZ,false); axLbl([0,0,-1],"−Z",COLZ,false);   // Z endpoints already carry markers (pole + bottom dot)
    axLbl([1,0,0],"X",COLX,false);                                    // +X already carries the front marker
    axLbl([-1,0,0],"−X",COLX,true);
    axLbl([0,1,0],"Y",COLY,true); axLbl([0,-1,0],"−Y",COLY,true);
    ctx.globalAlpha=1;
    _poseHits(c,primary,hits);                                // handles for manual control
  }
  if(state.scanning){
    // (no pulsing ring — the shrink+spin choreography alone conveys "energy", nothing exceeds the outline)
    const parked=state.parked;
    // LIVE disconnect (not searching, not asleep) — said in the readout line, and only there:
    // the greyed-out sphere with the snapped-thread picture over it looked worse than the plain
    // sentence and told the user nothing the sentence does not.
    const lost=(state.connKind==="off" && !parked && !(state.cfg&&state.cfg.simulate));
    _poseSet(idInfo,lost
      ?`<b style="color:var(--bad)">brak połączenia z kapslem</b>`
      :(parked
        ?`<b style="color:var(--warn)"><span class="bic bic-zzz" aria-hidden="true"></span>uśpiony</b>`:`<b style="color:var(--az)">○ szukam urządzenia…</b>`));
    if(o.short){ _poseSet(idAxis,``); _poseTip(idAxis,""); }   // to samo mówi wiersz odczytu — nie dublujemy na 168 px
    else _poseSet(idAxis,lost?``:`<span style="color:var(--dim)">${parked?"oszczędzanie baterii":"łączę z kapslem"}</span>`);
    if(primary){const _pcl=document.getElementById("pcalLive");if(_pcl)_pcl.textContent=lost?"rozłączono":(parked?"uśpiony":"szukam…");}
    return;
  }
  drawRevSpinner(ctx,w,h);                        // "rot/s" indicator (bottom right corner)
  drawLedBadge(ctx,w,h);                          // capsule's light (bottom left corner)
  _poseSet(idInfo,
    `<span class="pm">${_gl("pochylenie","tilt")} <b>${_pn(POSE.tiltDeg)}°</b></span> · <span class="pm">${_gl("obrót","rotation")} <b>${_pn(POSE.twistDps)}</b> °/s</span> · <span class="pm">${_gl("prędkość","speed")} <b>${_pn(POSE.angVelDps)}</b> °/s</span>`);
  if(primary){const _pcl=document.getElementById("pcalLive");
    if(_pcl){const _pt=`tilt ${POSE.tiltDeg.toFixed(0)}° · twist ${POSE.twistDps.toFixed(0)}°/s`;
      if(_pcl._rfLast!==_pt){_pcl._rfLast=_pt;_pcl.textContent=_pt;}}}   // ten sam powód, co przy _poseSet
  // Nazwa trybu i jego objaśnienie ROZDZIELONE (2026-08-30, etap 10) — bo w wąskim kaflu pokazujemy
  // samą nazwę, a objaśnienie idzie do dymka. Wcześniej oba były sklejone w jednym literale i nie
  // dało się wziąć samej nazwy bez cięcia stringa.
  const _mNm=POSE.mode==='gyro'?_gl("tryb: ŻYRO","mode: GYRO")
            :POSE.mode==='accel'?_gl("tryb: AKCEL","mode: ACCEL")
            :POSE.mode==='mahony'?_gl("tryb: Standardowy (zalecany)","mode: Standard (recommended)")   // D19: domyślny tryb
            :_gl("tryb: FILTR","mode: FILTER");
  const _mDs=POSE.mode==='gyro'?_gl("dryfuje","drifts")
            :POSE.mode==='accel'?_gl("tylko pochylenie","tilt only")
            :POSE.mode==='mahony'?_gl("filtr komplementarny","complementary filter")
            :_gl("yaw względny","relative yaw");
  const _brak=gmag<=POSE.ACC_MIN;
  if(o.short){
    _poseSet(idAxis,_brak?_gl("brak danych","no data"):_mNm);
    _poseTip(idAxis,_brak?"":(_mNm+" — "+_mDs));
  }else{
    _poseSet(idAxis,_brak?_gl("brak danych","no data")
      :`${_mNm}<br><span style="color:var(--dim)">${_mDs}</span>`);
  }
}

// Rotation speed indicator "°/s": a spinning wheel in the bottom right corner of the 3D sphere.
// The wheel spins EXACTLY at the device's angular velocity (degrees/sec, 1:1) — fast
// spin the puck = the wheel spins fast. At rest = it stands still. Direction = sign of rotation (twist).
// Active rotation -> gold comet with glow and pulse. Respects prefers-reduced-motion.
const _rmQuery = (window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null);
function _prefersReducedMotion(){ return !!(_rmQuery && _rmQuery.matches); }
function drawRevSpinner(ctx,w,h){
  const reduce=_prefersReducedMotion();
  const now=(typeof performance!=='undefined'?performance.now():Date.now());
  const dtMs=(POSE.spinTs==null)?0:Math.min(80,now-POSE.spinTs); POSE.spinTs=now;
  const dps=POSE.angVelDps||0;                                // angular velocity °/s
  const active=dps>3;                                         // > 3°/s = "rotation active"
  const mx=POSE.mirror?-1:1;
  const dir=((POSE.twistDps||0)>=0?-1:1)*mx;                  // wheel spin matches the 3D model + 2D needle (raw twist sign is inverted for the wheel), mirror-aware
  // rotation phase increases by dps°/s -> wheel rotates 1:1 with the device's actual speed
  if(!reduce) POSE.spinPhase=((POSE.spinPhase||0)+dir*dps*DEG2RAD*dtMs/1000)%(2*Math.PI);
  const ph=POSE.spinPhase||0;
  const r=Math.max(15,Math.min(28,Math.min(w,h)*0.12));
  const cx=w-r-13, cy=h-r-16;
  const gold=cv('--az')||'#ffd23f', cyan=cv('--gx')||'#27e0c4', dim=cv('--dim')||'#5b637a';
  const pulse=(active&&!reduce)?(1+0.06*Math.sin(now/140)):1;
  const rr=r*pulse;
  ctx.save();
  // base ring + markers (dial)
  ctx.globalAlpha=active?0.5:0.32;ctx.strokeStyle=active?gold:dim;ctx.lineWidth=1.4;
  ctx.beginPath();ctx.arc(cx,cy,rr,0,7);ctx.stroke();
  ctx.globalAlpha=active?0.4:0.22;ctx.strokeStyle=dim;ctx.lineWidth=1;
  for(let i=0;i<12;i++){const a=i/12*2*Math.PI,c=Math.cos(a),s=Math.sin(a);
    ctx.beginPath();ctx.moveTo(cx+c*rr*0.86,cy+s*rr*0.86);ctx.lineTo(cx+c*rr*0.97,cy+s*rr*0.97);ctx.stroke();}
  ctx.lineCap='round';
  if(reduce){
    // reduced-motion: no rotation — static arc with length proportional to speed
    const frac=Math.max(0.04,Math.min(1,dps/360));
    ctx.globalAlpha=active?0.9:0.4;ctx.strokeStyle=active?gold:dim;ctx.lineWidth=2.6;
    ctx.beginPath();ctx.arc(cx,cy,rr,-Math.PI/2,-Math.PI/2+dir*frac*2*Math.PI);ctx.stroke();
  }else{
    // comet — tail with a fading glow; longer when faster
    const tail=active?(0.7+Math.min(1.6,dps/180)*0.8):0.0, segs=18;
    for(let i=0;i<segs;i++){const f=i/segs;
      const a0=ph-dir*f*tail, a1=ph-dir*(f+1/segs)*tail;
      ctx.globalAlpha=(active?0.92:0.0)*(1-f);
      ctx.strokeStyle=i<segs*0.4?gold:cyan;ctx.lineWidth=2.6*(1-f*0.6);
      ctx.beginPath();ctx.moveTo(cx+Math.cos(a0)*rr,cy+Math.sin(a0)*rr);
      ctx.lineTo(cx+Math.cos(a1)*rr,cy+Math.sin(a1)*rr);ctx.stroke();}
    ctx.globalAlpha=1;
    if(active){ctx.shadowColor=gold;ctx.shadowBlur=10;}
    ctx.fillStyle=active?gold:dim;ctx.beginPath();ctx.arc(cx+Math.cos(ph)*rr,cy+Math.sin(ph)*rr,active?3.6:2.4,0,7);ctx.fill();
    ctx.shadowBlur=0;
  }
  // °/s number in the center + label
  ctx.globalAlpha=1;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle=active?gold:dim;ctx.font='700 '+Math.round(r*0.50)+'px '+(cv('--mono')||'monospace');
  ctx.fillText(Math.round(dps),cx,cy-1);
  ctx.fillStyle=dim;ctx.font=Math.round(r*0.30)+'px '+(cv('--sans')||'sans-serif');
  ctx.fillText('°/s',cx,cy+r*0.55);
  ctx.restore();
}

// The capsule's own light, bottom LEFT — the mirror of the rotation wheel opposite it, and sized
// off the same radius so the two corners weigh the same. A lamp, not a word: a filled bulb with
// rays when the light is on, a hollow outline when it is off.
//
// Three states, because there are three: lit, dark, and NOT KNOWN. The app only ever writes to
// that characteristic and never reads it back, so before the first command of a session the
// honest answer is "no idea" — drawn as a faint dashed ring rather than a confident "off", which
// would be a guess dressed up as a reading. In simulation the ring stays dashed for the same
// reason: the state is real, the lamp is not.
//
// A flash lasts 300 ms by default and a blink far less, which at 60 fps is a frame or two of
// gold nobody would catch. Hence the afterglow: a change leaves the badge bright for a moment
// and fades, so a wink still registers without the badge ever lying about the current state.
function drawLedBadge(ctx,w,h){
  const D=(typeof state!=="undefined"&&state.devices)
    ? state.devices[POSE.dev||state.viewDev||state.activeDeviceId||"d0"] : null;
  const led=D&&D.led;
  const on=!!(led&&led.on), known=!!led, sim=!!(led&&led.sim);
  const now=(typeof performance!=='undefined'?performance.now():Date.now());
  const since=led&&led.at?(now-led.at):1e9;
  const glow=_prefersReducedMotion()?0:Math.max(0,1-since/600);   // afterglow of the last change
  const r=Math.max(15,Math.min(28,Math.min(w,h)*0.12));
  const cx=r+13, cy=h-r-16;                                       // mirrors drawRevSpinner
  const gold=cv('--az')||'#ffd23f', dim=cv('--dim')||'#5b637a';
  const col=on?gold:dim;
  ctx.save();
  // the housing: solid when the state is known, dashed while it is a guess we refuse to make
  ctx.globalAlpha=on?(0.55+0.35*glow):(known?0.3:0.18);
  ctx.strokeStyle=col;ctx.lineWidth=1.4;
  if(!known||sim)ctx.setLineDash([3,3]);
  ctx.beginPath();ctx.arc(cx,cy,r,0,7);ctx.stroke();ctx.setLineDash([]);
  // the bulb
  const br=r*0.34;
  if(on){
    ctx.globalAlpha=1;ctx.shadowColor=gold;ctx.shadowBlur=8+10*glow;
    ctx.fillStyle=gold;ctx.beginPath();ctx.arc(cx,cy-r*0.16,br,0,7);ctx.fill();
    ctx.shadowBlur=0;
    ctx.globalAlpha=0.75+0.25*glow;ctx.strokeStyle=gold;ctx.lineWidth=1.6;ctx.lineCap='round';
    for(let i=0;i<6;i++){const a=(i/6)*2*Math.PI-Math.PI/2;         // rays, only when it is lit
      const r0=br*1.5,r1=br*(2.05+0.25*glow);
      ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*r0,cy-r*0.16+Math.sin(a)*r0);
      ctx.lineTo(cx+Math.cos(a)*r1,cy-r*0.16+Math.sin(a)*r1);ctx.stroke();}
  }else{
    ctx.globalAlpha=known?0.5:0.3;ctx.strokeStyle=dim;ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(cx,cy-r*0.16,br,0,7);ctx.stroke();
  }
  // the label, in the place "°/s" sits on the other side
  ctx.globalAlpha=1;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle=on?gold:dim;ctx.font=Math.round(r*0.30)+'px '+(cv('--sans')||'sans-serif');
  ctx.fillText('LED',cx,cy+r*0.55);
  ctx.restore();
}

