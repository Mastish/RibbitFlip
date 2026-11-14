"use strict";
// ===== singing-frog cursor frames =====
// Indexed by mouth openness 0..4 (0 = closed/quiet, 4 = wide open); the XY pad picks the frame
// from the Y position. Served from /web/assets so they ship inside the packaged exe.
const PAD_FROG_SRC=[
"/web/assets/frog/sing-0-96.png",
"/web/assets/frog/sing-1-96.png",
"/web/assets/frog/sing-2-96.png",
"/web/assets/frog/sing-3-96.png",
"/web/assets/frog/sing-4-96.png"
];
// Muted capsule = a frog with its mouth taped shut. Used INSTEAD of the 0..4 mouth frames, so a
// silenced capsule is obvious at a glance on a pad crowded with singing ones.
const PAD_FROG_SILENT_SRC="/web/assets/frog/sing-silent-96.png";
