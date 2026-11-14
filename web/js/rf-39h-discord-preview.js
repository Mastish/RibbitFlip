"use strict";
// ================== WHAT THE POST WILL LOOK LIKE ON THE FORUM ==================
// The composer hands over Discord-flavoured markdown, and markdown is exactly the kind of text
// that looks fine in a textarea and wrong once posted: a stray asterisk, a heading that never
// renders, a line break that vanishes. So the last step of the wizard shows the post the way the
// forum will show it, and the person clicks "publish" already knowing what they are publishing.
//
// The card wears DISCORD's colours on purpose, not the app's felt. It is a picture of somewhere
// else; dressing it like the surrounding panel would make it read as one more form to fill in.
// No logos are used — an initial in a circle is enough to say "this is a post by you".

// Only the markdown the composer actually emits: bold, inline code, line breaks. Escaping runs
// FIRST, so anything the author typed stays text and cannot become markup.
function _rfdMd(txt) {
  return miEsc(String(txt || ""))
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/\n/g, "<br>");
}

function _rfdInitial(name) {
  const s = String(name || "").trim();
  return s ? s[0].toUpperCase() : "🐸";
}

function _rfdClock() {
  try {
    return new Date().toLocaleTimeString(undefined, {hour: "2-digit", minute: "2-digit"});
  } catch (e) { return ""; }
}

// post: {title, body} · tags: ["🎮 Granie", …] · opts: {author, file}
function rfDiscordPreview(post, tags, opts) {
  const o = opts || {};
  const who = String(o.author || "").trim() || _gl("Ty", "You");
  const pills = (tags || []).map(function (t) {
    return '<span class="dc-tag">' + miEsc(t) + "</span>";
  }).join("");
  const file = o.file
    ? '<div class="dc-file"><span class="dc-fic" aria-hidden="true"></span>' +
      '<span class="dc-fname">' + miEsc(o.file) + "</span>" +
      '<span class="dc-fnote">' + miEsc(_gl("załącznik", "attachment")) + "</span></div>"
    : "";
  return '<div class="dc-post">' +
    '<div class="dc-thread"><div class="dc-title">' + miEsc(post.title) + "</div>" +
    (pills ? '<div class="dc-tags">' + pills + "</div>" : "") + "</div>" +
    '<div class="dc-msg"><div class="dc-av" aria-hidden="true">' + miEsc(_rfdInitial(who)) + "</div>" +
    '<div class="dc-mid"><div class="dc-head"><span class="dc-user">' + miEsc(who) + "</span>" +
    '<span class="dc-ts">' + miEsc(_gl("dzisiaj o ", "today at ") + _rfdClock()) + "</span></div>" +
    '<div class="dc-body">' + _rfdMd(post.body) + "</div>" + file +
    "</div></div></div>";
}

window.rfDiscordPreview = rfDiscordPreview;
