"use strict";
// ===== bottle-cap avatars =====
// Purely cosmetic device identity (a nod to the puck's shape). Served from /web/assets so
// the images ship inside the packaged exe alongside the rest of the static bundle.
const CAP_IMG={"1":"/web/assets/caps/1-96.png","2":"/web/assets/caps/2-96.png","3":"/web/assets/caps/3-96.png","4":"/web/assets/caps/4-96.png","5":"/web/assets/caps/5-96.png","6":"/web/assets/caps/6-96.png","7":"/web/assets/caps/7-96.png","8":"/web/assets/caps/8-96.png","9":"/web/assets/caps/9-96.png"};
// The 96 px artwork is sized for the pill (26-30 px) and the mini badges. Anywhere the capsule is
// shown BIG — the device editor and the pairing result — it was being blown up to 110-124 px, which
// on a 2x screen means a 96 px source stretched over ~250 device pixels: soft edges, mushy label.
// These are fetched only by those two places, one at a time, so the extra weight never touches the
// panel's first paint.
const CAP_IMG_HI={"1":"/web/assets/caps/1-256.png","2":"/web/assets/caps/2-256.png","3":"/web/assets/caps/3-256.png","4":"/web/assets/caps/4-256.png","5":"/web/assets/caps/5-256.png","6":"/web/assets/caps/6-256.png","7":"/web/assets/caps/7-256.png","8":"/web/assets/caps/8-256.png","9":"/web/assets/caps/9-256.png"};
const CAP_IDS=Object.keys(CAP_IMG);
// KAPSEL 2D = KAPSEL 3D (2026-11-20, prośba właściciela: „powiąż kapsel z preview z kapslem w 3d”).
// Każda grafika kapsla ma swój skin modelu 3D (rf-14d, web/assets/kapsel/skiny/<skin>.glb) i obie
// pokazują ten sam kapsel: grafiki 1–9 są wygenerowane z renderów tych skinów. Numery zostają, bo
// zapisuje je serwer (meta.cap) i czytają je gry RibbitBeat; zmiana wyglądu = zmiana meta.cap.
const CAP_SKIN={"1":"strzalki","2":"zaba","3":"punk","4":"czaszka","5":"piorun","6":"irokez","7":"czaszka_cwieki","8":"strzalki_cmyk","9":"szew"};
// Big artwork for a cap id, falling back to the small one if a 256 px file is ever missing.
function capImgBig(cap){return (cap&&(CAP_IMG_HI[cap]||CAP_IMG[cap]))||"";}
// Mini capsule badge for any UI that names a device (pads, fx, overview, copy-axes picker).
// Falls back to a coloured dot when the device has no cap assigned or an invalid colour.
function capImgSpan(devId,size){
  const D=(typeof state!=="undefined"&&state.devices)?state.devices[devId]:null;
  const meta=(D&&D.meta)||{};
  const cap=meta.cap&&CAP_IMG[meta.cap];
  const sz=size||20;
  if(cap)return '<span class="cap-mini" style="width:'+sz+'px;height:'+sz+'px;background-image:url('+cap+')" aria-hidden="true"></span>';
  const col=/^#[0-9a-fA-F]{6}$/.test(meta.color||"")?meta.color:"#8aa0b5";
  return '<span class="cap-mini cap-mini-dot" style="width:'+Math.round(sz*0.55)+'px;height:'+Math.round(sz*0.55)+'px;background:'+col+'" aria-hidden="true"></span>';
}
