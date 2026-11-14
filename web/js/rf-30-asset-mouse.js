"use strict";
// Preloads the felt arrow + cursor sprites drawn on the motion-control previews
// (mouse scope, analog-stick pad, d-pad rosette).
const _arrowImg=new Image();_arrowImg.src="/web/assets/pad/arrow.png";
const _mouseCurImg=new Image();_mouseCurImg.src="/web/assets/pad/cursor-mouse.png";
const _stickCurImg=new Image();_stickCurImg.src="/web/assets/icons/mstick.png";
// Walk cycle of the same felt mouse (2026-10-15): four frames facing right with the sticker's own short
// stubby legs (a cartoon pitter-patter: step, feet together, other step, feet together), registered on the
// torso so only the little feet, arms and tail move; drawn by _drawMouseWalker (rf-31).
const _mouseWalkImgs=[1,2,3,4].map(i=>{const im=new Image();im.src="/web/assets/pad/mysz-chod-"+i+".png";return im;});
