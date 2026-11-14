"use strict";
// ======================= XY PAD — live 2D motion preview + local sounds =======================
//  Kaoss-style XY surface inside the MIDI/OSC card: X = note pitch (quantized to the
//  group scale), Y = timbre/brightness. Every connected device gets its OWN cursor
//  (device color) and its OWN voice — two pucks = two players on one pad. The active
//  slot updates at ~50 Hz (SSE `s`), other slots at ~12 Hz (`pv`). Touch/mouse plays
//  directly (source "ptr"). Sound is browser-local WebAudio — independent of MIDI/OSC
//  outputs and the master arm switch (it is a preview toy, it never leaves the browser).
//  The whole pad sits behind an explicit enable toggle (#padEnable, OFF by default).
const PAD_PCS={chromatic:[0,1,2,3,4,5,6,7,8,9,10,11],major:[0,2,4,5,7,9,11],minor:[0,2,3,5,7,8,10],
  harmonic_minor:[0,2,3,5,7,8,11],pentatonic_major:[0,2,4,7,9],pentatonic_minor:[0,3,5,7,10],
  blues:[0,3,5,6,7,10],dorian:[0,2,3,5,7,9,10],phrygian:[0,1,3,5,7,8,10],lydian:[0,2,4,6,7,9,11],
  mixolydian:[0,2,4,5,7,9,10],whole_tone:[0,2,4,6,8,10]};   // mirrors backend SCALES
const PAD_AXES=[["roll","Roll (lewo/prawo)"],["pitch","Pitch (przód/tył)"],
  ["tilt","Pochylenie (0–90°)"],["twist","Obrót (°/s)"],
  // raw controller channels, numbered as in the MIDI/OSC mapping: ch0-2 read the packet's a[]
  // fields, ch3-5 the g[] fields. Those wire names are historical and say the opposite of the
  // truth — ch0-2 are the gyroscope, ch3-5 the accelerometer, measured on a real puck. The AXES
  // note in rf-02-state.js explains why the names were left alone and only the labels corrected.
  ["ch0","CH0 · żyro X"],["ch1","CH1 · żyro Y"],["ch2","CH2 · żyro Z"],
  ["ch3","CH3 · akcel X"],["ch4","CH4 · akcel Y"],["ch5","CH5 · akcel Z"]];
const PAD_SOUND_LIST=[["ribbit","🐸 Ribbit"],["lead","🎹 Syntezator"],["chip","👾 Chip 8-bit"],["pluck","🪕 Struna"],
  ["brass","🎺 Trąbka"],["pad","🌫 Przestrzeń"],["bass","Bas"],
  ["organ","🪗 Organy"],["whistle","😗 Gwizd"],["marimba","🔔 Marimba"],["strings","🎻 Smyczki"],["wobble","🛸 Wobble"],
  ["bell","🛎 Dzwon"],["acid","🧪 Kwas"],["epiano","🎼 Pianino elektryczne"],["choir","🎤 Chórek"],
  ["musicbox","🧸 Pozytywka"],["cosmos","🛰 Kosmos"],["drive","🤘 Przester"],["siren","🚨 Syrena"],
  ["clarinet","🎷 Klarnet"],["robot","🤖 Robot"],
  ["pulsar","🔆 Pulsar"],["hammond","⛪ Hammond"],["vocoder","🗣 Wokoder"],["radio","📻 Radio"],
  ["cello","🦢 Wiolonczela"],["tide","🌊 Przypływ"],["kalimba","🪘 Kalimba"],["glass","🥂 Szkło"],
  ["drop","💧 Kropla"],["bassgtr","🎸 Gitara basowa"],["bubble","🫧 Bańka"],["toad","🪷 Ropucha"],
  ["fx","🌪 Szum"]];
// EN labels for the composed live scale tag (the exact-match i18n layer cannot translate
// runtime-composed strings, so padDraw builds them language-aware itself)
const PAD_SCALE_EN={chromatic:"chromatic",major:"major",minor:"minor",harmonic_minor:"harmonic minor",
  pentatonic_major:"major pentatonic",pentatonic_minor:"minor pentatonic",blues:"blues",dorian:"dorian",
  phrygian:"phrygian",lydian:"lydian",mixolydian:"mixolydian",whole_tone:"whole tone"};
// legato = mono voice with glide; otherwise each note retriggers a fresh voice.
// fSwell = brass-style filter attack (cutoff swells open after note start).
const PAD_PATCH={
  // 🐸 frog croak: a buzzy AM-modulated saw through a vocal band-pass (formant). Y opens the
  // "mouth" (formant brightness); the square AM LFO gives the rolling „rrr" ribbit. Legato-held.
  ribbit:{croak:!0,legato:true,wave:"sawtooth",oct:-1,att:.02,rel:.13,fMin:430,fMax:1750,q:6,lvl:.52,am:29},
  lead:{legato:true,glide:.045,wave:"sawtooth",att:.012,rel:.18,fMin:260,fMax:7800,q:6,lvl:.42},
  chip:{legato:true,glide:0,wave:"square",att:.005,rel:.07,fMin:700,fMax:6200,q:1.5,lvl:.26},
  pluck:{legato:false,wave:"triangle",att:.003,dec:.34,fMin:600,fMax:8200,q:2.5,lvl:.6},
  brass:{legato:true,glide:.03,wave:"sawtooth",att:.055,rel:.22,fMin:250,fMax:3800,q:1.6,lvl:.5,fSwell:.12},
  pad:{legato:true,glide:.09,wave:"sawtooth",det:11,att:.32,rel:.85,fMin:170,fMax:2600,q:1.2,lvl:.3},
  bass:{legato:true,glide:.03,wave:"triangle",oct:-1,sub:!0,att:.012,rel:.16,fMin:110,fMax:1400,q:4,lvl:.55},
  organ:{legato:true,glide:.015,wave:"sine",sub:!0,att:.015,rel:.11,fMin:500,fMax:6500,q:.6,lvl:.34},
  whistle:{legato:true,glide:.07,wave:"sine",att:.05,rel:.16,fMin:900,fMax:9500,q:3.5,lvl:.3},
  marimba:{legato:false,wave:"sine",att:.002,dec:.5,fMin:800,fMax:9000,q:4,lvl:.62},
  strings:{legato:true,glide:.05,wave:"sawtooth",det:8,att:.28,rel:.7,fMin:200,fMax:4200,q:1.3,lvl:.3},
  wobble:{legato:true,glide:.04,wave:"sawtooth",att:.02,rel:.2,fMin:120,fMax:3200,q:9,lvl:.4},
  // 10 sounds added 2026-08-20 — each leans on a DIFFERENT engine feature so they stay distinct:
  // bell/musicbox = inharmonic osc2 partials, acid = filter envelope + drive, epiano = octave osc2 layer,
  // choir = band-pass formant, cosmos = downward filter sweep on a detuned sub layer, drive = heavy soft-clip,
  // siren = extreme portamento, clarinet = soft sustained square (odd harmonics), robot = quint layer + drive.
  bell:{legato:false,wave:"sine",att:.002,dec:1.1,fMin:900,fMax:9500,q:1.2,lvl:.5,osc2:true,osc2wave:"sine",osc2semi:14,osc2det:6,osc2mix:.4},
  acid:{legato:true,glide:.02,wave:"sawtooth",att:.008,rel:.14,fMin:90,fMax:5200,q:13,lvl:.36,fEnv:.9,fEnvT:.18,drive:.35},
  epiano:{legato:false,wave:"triangle",att:.004,dec:.9,fMin:420,fMax:5200,q:.8,lvl:.5,osc2:true,osc2wave:"sine",osc2semi:12,osc2mix:.35},
  choir:{legato:true,glide:.06,wave:"sawtooth",det:6,att:.24,rel:.6,filt:"bandpass",fMin:480,fMax:1900,q:2.2,lvl:.34},
  musicbox:{legato:false,wave:"sine",oct:1,att:.002,dec:.7,fMin:1500,fMax:9800,q:1.5,lvl:.42,osc2:true,osc2wave:"sine",osc2semi:19,osc2mix:.22},
  cosmos:{legato:true,glide:.05,wave:"square",att:.03,rel:.4,fMin:200,fMax:4800,q:7,lvl:.3,osc2:true,osc2wave:"square",osc2semi:-12,osc2det:30,osc2mix:.5,fEnv:-.6,fEnvT:.5},
  drive:{legato:true,glide:.02,wave:"sawtooth",oct:-1,att:.01,rel:.15,fMin:140,fMax:2600,q:2,lvl:.34,drive:.8},
  siren:{legato:true,glide:.3,wave:"sine",att:.04,rel:.3,fMin:600,fMax:7000,q:5,lvl:.4},
  clarinet:{legato:true,glide:.02,wave:"square",att:.04,rel:.15,fMin:380,fMax:3600,q:1.1,lvl:.4,sus:.85},
  robot:{legato:false,wave:"square",att:.003,dec:.22,fMin:500,fMax:5600,q:6,lvl:.4,osc2:true,osc2wave:"square",osc2semi:7,osc2mix:.6,drive:.3},
  // 12 sounds added 2026-10-02 — each leans on a NEW engine feature (custom wave `wt` / equaliser `eq` / envelope bends
  // `envC`, see sanitizePatch in rf-20) so they stay distinct from the 23 above. Every value is already what sanitizePatch
  // stores (f whole Hz, g 1 place, q 2, bends 2, wt 3) and sits on the editor sliders' steps and ranges, so loading one
  // into the editor reads back the same numbers (tests/sound_library_harness.mjs (b)/(b2)). The `wt` literals
  // are plain data computed offline with the rf-25c helpers (rf-25c loads after this file): DC removed, peak 1.
  // pulsar = 25 % pulse (16 of 64 samples, one SoundScreens.smooth pass) + a 6 ct detuned pair whose beating sweeps it
  // like PWM, punchy attack and decay bends; hammond = drawbars 16'·8'·5⅓'·4'·2⅔'·2' (fromHarmonics: harmonics 1,2,3,4,6,8
  // at 1/.8/.5/.4/.25/.15) + a 2.4 kHz dip; vocoder = 12.5 % pulse (8 of 64) through two narrow vowel "a" formants;
  // radio = phone band after drive; cello = saw an octave down, slow-start bow bend + 250 Hz body; tide = slowest swell
  // (attack bend .9 on the 500 ms slider maximum) + filter swell + long release; kalimba = fromHarmonics 1,2,4 (1/.35/.15)
  // under a sharp decay bend; glass = harmonics 7,9,11,13 (.6/1/.5/.3) over a faint fundamental (.25) that keeps the
  // played note audible; drop = triangle an octave up whose resonant cutoff chirps UP (negative filter env) — a pure
  // sine would ignore both filter and equaliser; bassgtr = plucked saw + sub an octave down, 90 Hz boost, 2.5 kHz cut;
  // bubble = a half-period sin² hump (zero the other half, smooth ×2) with a slower upward chirp; toad = the croak at a
  // slow 14 Hz roll two octaves down with 300/900 Hz formants.
  pulsar:{legato:true,glide:0,wave:"custom",det:6,att:.006,dec:.18,sus:.7,rel:.12,fMin:500,fMax:6000,q:1.5,lvl:.3,envC:[-.3,-.5,0],
    wt:[.667,1,1,1,1,1,1,1,1,1,1,1,1,1,1,.667,0,-.333,-.333,-.333,-.333,-.333,-.333,-.333,-.333,-.333,-.333,-.333,-.333,-.333,-.333,-.333,-.333,-.333,-.333,-.333,-.333,-.333,-.333,-.333,-.333,-.333,-.333,-.333,-.333,-.333,-.333,-.333,-.333,-.333,-.333,-.333,-.333,-.333,-.333,-.333,-.333,-.333,-.333,-.333,-.333,-.333,-.333,0]},
  hammond:{legato:true,glide:0,wave:"custom",att:.012,rel:.1,fMin:600,fMax:7000,q:.7,lvl:.36,eq:[{f:2400,g:-5,q:1}],
    wt:[0,.401,.726,.927,1,.98,.917,.855,.811,.774,.724,.646,.541,.43,.337,.278,.252,.242,.232,.214,.196,.192,.211,.241,.257,.227,.136,-.004,-.15,-.246,-.25,-.156,0,.156,.25,.246,.15,.004,-.136,-.227,-.257,-.241,-.211,-.192,-.196,-.214,-.232,-.242,-.252,-.278,-.337,-.43,-.541,-.646,-.724,-.774,-.811,-.855,-.917,-.98,-1,-.927,-.726,-.401]},
  vocoder:{legato:true,glide:.03,wave:"custom",att:.02,rel:.15,fMin:300,fMax:5000,q:1,lvl:.32,eq:[{f:700,g:12,q:6},{f:1200,g:9,q:6},{f:3000,g:-10,q:1}],
    wt:[1,1,1,1,1,1,1,1,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143,-.143]},
  radio:{legato:true,glide:.03,wave:"sawtooth",att:.01,rel:.15,fMin:1200,fMax:6000,q:1,lvl:.4,drive:.3,eq:[{f:120,g:-18,q:.8},{f:1800,g:9,q:1.5},{f:5000,g:-18,q:.8}]},
  cello:{legato:true,glide:.04,wave:"sawtooth",oct:-1,det:5,att:.12,dec:.3,sus:.85,rel:.35,fMin:180,fMax:3200,q:1.2,lvl:.38,eq:[{f:250,g:6,q:1.2},{f:4000,g:-6,q:1}],envC:[.6,0,.2]},
  tide:{legato:true,glide:.1,wave:"sawtooth",det:14,att:.5,dec:1.2,sus:.7,rel:1.4,fSwell:1,fMin:150,fMax:1800,q:1,lvl:.32,eq:[{f:320,g:4,q:.7}],envC:[.9,0,-.3]},
  kalimba:{legato:false,wave:"custom",att:.002,dec:.9,fMin:900,fMax:7000,q:1.2,lvl:.5,eq:[{f:1500,g:5,q:1.2}],envC:[0,-.6,0],
    wt:[0,.211,.411,.589,.737,.851,.93,.978,.998,1,.99,.977,.965,.956,.953,.95,.944,.93,.9,.851,.78,.689,.58,.46,.337,.221,.119,.039,-.014,-.04,-.042,-.026,0,.026,.042,.04,.014,-.039,-.119,-.221,-.337,-.46,-.58,-.689,-.78,-.851,-.9,-.93,-.944,-.95,-.953,-.956,-.965,-.977,-.99,-1,-.998,-.978,-.93,-.851,-.737,-.589,-.411,-.211]},
  glass:{legato:false,wave:"custom",att:.002,dec:1.4,fMin:1500,fMax:9000,q:2,lvl:.35,envC:[0,-.7,0],
    wt:[0,.866,1,.379,-.362,-.623,-.363,.038,.273,.327,.302,.221,.076,-.043,-.018,.123,.205,.123,-.018,-.043,.076,.221,.302,.327,.273,.038,-.363,-.623,-.362,.379,1,.866,0,-.866,-1,-.379,.362,.623,.363,-.038,-.273,-.327,-.302,-.221,-.076,.043,.018,-.123,-.205,-.123,.018,.043,-.076,-.221,-.302,-.327,-.273,-.038,.363,.623,.362,-.379,-1,-.866]},
  drop:{legato:false,wave:"triangle",oct:1,att:.002,dec:.22,fMin:500,fMax:3500,q:12,lvl:.4,fEnv:-.7,fEnvT:.05,eq:[{f:4000,g:6,q:2}],envC:[0,-.9,0]},
  bassgtr:{legato:false,wave:"sawtooth",oct:-1,sub:!0,att:.003,dec:.7,fMin:90,fMax:1800,q:2,lvl:.45,fEnv:.3,fEnvT:.1,eq:[{f:90,g:6,q:1},{f:2500,g:-10,q:1}],envC:[0,-.5,0]},
  bubble:{legato:false,wave:"custom",att:.004,dec:.4,fMin:700,fMax:6000,q:6,lvl:.45,fEnv:-.5,fEnvT:.15,eq:[{f:2000,g:7,q:2.5}],envC:[0,-.4,0],
    wt:[-.331,-.313,-.275,-.213,-.131,-.031,.084,.208,.337,.467,.591,.706,.806,.889,.95,.987,1,.987,.95,.889,.806,.706,.591,.467,.337,.208,.084,-.031,-.131,-.213,-.275,-.313,-.331,-.337,-.337,-.337,-.337,-.337,-.337,-.337,-.337,-.337,-.337,-.337,-.337,-.337,-.337,-.337,-.337,-.337,-.337,-.337,-.337,-.337,-.337,-.337,-.337,-.337,-.337,-.337,-.337,-.337,-.337,-.337]},
  toad:{croak:!0,legato:true,wave:"sawtooth",oct:-2,att:.03,rel:.2,fMin:260,fMax:1100,q:5,lvl:.5,am:14,eq:[{f:300,g:6,q:2},{f:900,g:5,q:3},{f:3000,g:-8,q:1}]},
  fx:{noise:!0,lvl:.5}};
// pristine built-in defaults — base edits go to XPAD.baseOverrides, PAD_PATCH is NEVER mutated. Frozen deep: the
// 2026-10-02 sounds carry arrays and band objects (wt, eq, envC), which a shallow freeze would leave writable.
try{const fz=o=>{for(const v of Object.values(o))if(v&&typeof v==="object")fz(v);return Object.freeze(o);};
  Object.values(PAD_PATCH).forEach(fz);Object.freeze(PAD_PATCH);}catch(e){}
// split emoji/name for the 35 base sounds — used by the editor form + selectable library list (avoids grapheme-splitting PAD_SOUND_LIST labels at runtime)
const PAD_BASE_META={ribbit:{emoji:"🐸",name:"Ribbit"},lead:{emoji:"🎹",name:"Syntezator"},chip:{emoji:"👾",name:"Chip 8-bit"},pluck:{emoji:"🪕",name:"Struna"},brass:{emoji:"🎺",name:"Trąbka"},pad:{emoji:"🌫",name:"Przestrzeń"},bass:{emoji:"🎚",name:"Bas"},organ:{emoji:"🪗",name:"Organy"},whistle:{emoji:"😗",name:"Gwizd"},marimba:{emoji:"🔔",name:"Marimba"},strings:{emoji:"🎻",name:"Smyczki"},wobble:{emoji:"🛸",name:"Wobble"},
  bell:{emoji:"🛎",name:"Dzwon"},acid:{emoji:"🧪",name:"Kwas"},epiano:{emoji:"🎼",name:"Pianino elektryczne"},choir:{emoji:"🎤",name:"Chórek"},musicbox:{emoji:"🧸",name:"Pozytywka"},cosmos:{emoji:"🛰",name:"Kosmos"},drive:{emoji:"🤘",name:"Przester"},siren:{emoji:"🚨",name:"Syrena"},clarinet:{emoji:"🎷",name:"Klarnet"},robot:{emoji:"🤖",name:"Robot"},
  pulsar:{emoji:"🔆",name:"Pulsar"},hammond:{emoji:"⛪",name:"Hammond"},vocoder:{emoji:"🗣",name:"Wokoder"},radio:{emoji:"📻",name:"Radio"},cello:{emoji:"🦢",name:"Wiolonczela"},tide:{emoji:"🌊",name:"Przypływ"},
  kalimba:{emoji:"🪘",name:"Kalimba"},glass:{emoji:"🥂",name:"Szkło"},drop:{emoji:"💧",name:"Kropla"},bassgtr:{emoji:"🎸",name:"Gitara basowa"},bubble:{emoji:"🫧",name:"Bańka"},toad:{emoji:"🪷",name:"Ropucha"},
  fx:{emoji:"🌪",name:"Szum"}};
