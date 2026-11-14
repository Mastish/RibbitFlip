"use strict";
/* ===== foam-hand pointer =====
   Custom cursor images exposed as CSS custom properties on :root; the stylesheets pick the
   right one per element state. Every URL carries an explicit hotspot ("x y" after the url),
   because browsers otherwise default to the image's top-left corner. */
const RF_CUR_IDLE ="/web/assets/cursor/hand-idle-36.png";
const RF_CUR_HOVER="/web/assets/cursor/hand-hover-36.png";
const RF_CUR_PRESS="/web/assets/cursor/hand-press-36.png";
const RF_CUR_GRAB ="/web/assets/cursor/hand-grab-36.png";
const RF_CUR_WRITE="/web/assets/cursor/hand-write-36.png";
// "hot" = the pointing finger ringed with a 1 px pink outline (--pink). It marks ONE thing:
// hovering something you can click. No other state uses it — pressing shows the plain
// finger-down pose, and grab-able controls (knob / slider) keep the plain open hand.
const RF_CUR_CLICK   ="/web/assets/cursor/hand-idle-hot-38.png";
(function(){
  var _a=function(){var r=document.documentElement.style;
    r.setProperty("--rf-cur","url("+RF_CUR_IDLE+") 15 3, auto");        // hotspot ON the fingertip
    r.setProperty("--rf-cur-hover","url("+RF_CUR_HOVER+") 15 3, auto");   // shared anchor -> no jump between states
    r.setProperty("--rf-cur-press","url("+RF_CUR_PRESS+") 15 3, auto");   // finger presses straight down in place
    r.setProperty("--rf-cur-grab","url("+RF_CUR_GRAB+") 15 9, auto");     // fist grips just below the same point
    r.setProperty("--rf-cur-write","url("+RF_CUR_WRITE+") 2 8, auto");    // hand with marker, hotspot at the nib
    r.setProperty("--rf-cur-click","url("+RF_CUR_CLICK+") 16 4, auto");    // ring: canvas padded +1px -> hotspot +1
    document.documentElement.classList.add("rf-cursor");};
  if(document.body)_a(); else document.addEventListener("DOMContentLoaded",_a);})();
