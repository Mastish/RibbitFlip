"use strict";
// ===================== capsule identity: which one is which, and did it connect? =====================
// With one capsule none of this is needed. With four, two questions come up constantly and the pills
// answered neither: "which pill is the capsule I'm holding?" and "did the one I wanted just connect?".
//
//  1. devActivityPing / devIdentifyPing — give a capsule a shake (or press its centre) and ITS pill
//     lights up. The app cannot know which object on your desk you meant, but it can answer when you
//     ask with the object itself. No BLE traffic: it rides on samples that already arrive.
//  2. devAnnounceConn — every connect/disconnect is said out loud BY NAME, for every slot, not only
//     the one on screen. Previously a capsule connecting in the background changed a ring colour and
//     nothing else, which is exactly the "I don't know whether it connected" complaint.
//  3. devBlinkLed — the hardware answer: blink that capsule's own LED.
//  4. devStateWord — the pill's state written out as a word instead of encoded in a hue.

// ---- the two switches, in one place --------------------------------------------------------------
// Every consumer asks through these instead of reading meta.muted itself, so "what does mute
// actually stop?" has exactly one answer and adding a third state later touches one file.
//   devSoundOff — no sound from this capsule: the pads and the synth ignore it.
//   devOutOff   — nothing at all from this capsule: keys, mouse, pad, MIDI, OSC (and sound, since
//                 devSoundOff also returns true for it).
function devSoundOff(D){return !!(D&&D.meta&&(D.meta.muted||D.meta.paused));}
function devOutOff(D){return !!(D&&D.meta&&D.meta.paused);}

// A deliberate shake, in the units pose.spin uses (calibrated |gyro| in raw LSB, 131 LSB ≈ 1°/s).
// 12000 ≈ 92°/s: well above a nudge or a capsule breathing on the table, and well above the
// simulation's synthetic waveform (it peaks around 6000), so simulated slots don't flicker by themselves.
const DEV_SHAKE_SPIN=12000;
const DEV_PING_MS=480;          // how long a pill stays lit
const DEV_PING_GAP=420;         // ...and the shortest gap between two lights on the same pill

const _devPingTs=Object.create(null);   // dev -> last ping (ms), throttling
const _devPingTid=Object.create(null);  // dev -> pending "turn it off" timer

// Motion energy from a sample. Cheap on purpose: this runs at the sample rate for every slot.
function devActivityPing(dev,spin){
  if(!(spin>DEV_SHAKE_SPIN))return;
  devIdentifyPing(dev);
}
// Light up ONE pill. Also called for a press of the capsule's centre button, which is the way to
// identify a capsule that is lying flat and cannot be shaken (mounted on something, in a case).
function devIdentifyPing(dev){
  const now=(typeof performance!=="undefined"?performance.now():Date.now());
  if(now-(_devPingTs[dev]||0)<DEV_PING_GAP)return;
  _devPingTs[dev]=now;
  const pill=document.querySelector('.devpill[data-dev="'+(window.CSS&&CSS.escape?CSS.escape(dev):dev)+'"]');
  if(!pill)return;
  pill.classList.remove("dp-live"); void pill.offsetWidth;   // restart the animation on a quick re-shake
  pill.classList.add("dp-live");
  if(_devPingTid[dev])clearTimeout(_devPingTid[dev]);
  _devPingTid[dev]=setTimeout(()=>{_devPingTid[dev]=0;pill.classList.remove("dp-live");},DEV_PING_MS);
}

// ---- "did it connect?" — announced for every slot, by name -------------------------------------
function _devOnline(c){return c==="connected"||c==="sim";}
function devAnnounceConn(D,conn){
  const prev=D._connPrev; D._connPrev=conn;
  if(!prev||prev==="init")return;          // start-up: the pills are being drawn anyway, no noise
  if(typeof rfSkullNote!=="function")return;
  // The capsule being paired has a whole screen of its own saying this, in more detail. A note
  // popping up behind that modal would just be the same news twice.
  if(typeof _pairTarget!=="undefined"&&_pairTarget&&D.meta&&_pairTarget===D.meta.dev)return;
  const nm=(D.meta&&(D.meta.label||D.meta.name||D.meta.dev))||"Triki";
  if(_devOnline(conn)&&!_devOnline(prev)){
    rfSkullNote(_gl(nm+" jest połączony.",nm+" is connected."));
  }else if(_devOnline(prev)&&conn==="disconnected"){
    // "parked" is deliberate (you clicked Sleep), so it is not announced — only a link that dropped.
    rfSkullNote(_gl(nm+" się rozłączył.",nm+" dropped the connection."),{tone:"danger",ms:3200});
  }
}

// ---- the hardware answer: blink the capsule's own LED -------------------------------------------
function devBlinkLed(dev){
  devIdentifyPing(dev);                    // the pill answers straight away, the LED follows
  return fetch("/identify?dev="+encodeURIComponent(dev),
      {method:"POST",headers:{"Content-Type":"application/json"},body:"{}"})
    .then(r=>r.ok?r.json():null)
    .then(j=>{
      if(j&&j.sent)return true;
      if(typeof rfSkullNote==="function")
        rfSkullNote(_gl("W symulacji nie ma diody do mrugania. Podłącz prawdziwy kapsel.",
                        "There is no LED to blink in simulation. Connect a real capsule."),{ms:3400});
      return false;
    })
    .catch(()=>false);
}

// ---- state as a word, not a hue ------------------------------------------------------------------
// The pill used to say everything with colour: a pink ring meant pairing, a coloured ring meant
// connected, a dimmed pill meant unpaired. Four pills side by side then look the same at a glance.
// Anything that is NOT "connected and working" now says so in words; connected shows nothing extra,
// because that is the quiet default you don't need to read.
function devStateWord(D){
  if(!D)return "";
  if(D.meta&&D.meta.paused)return "wstrzymany";
  // Same hold, different author — and the word says so, because the two are undone in different
  // places: this one lifts itself the moment you pick the capsule up, the one above waits for a
  // click in „Moduły". A person told only „wstrzymany" would go looking for that switch.
  if(D.meta&&D.meta.autoPaused)return "wstrzymany (bezczynność)";
  const c=D.conn;
  if(c==="pairing")return "parowanie";
  if(c==="parked")return "uśpiony";
  if(c==="scanning"||c==="init")return "szukam";
  if(D.meta&&D.meta.bound===false&&(c==="idle"||c==="disconnected"))return "niesparowany";
  if(c==="disconnected")return "rozłączony";
  return "";   // connected / sim
}
