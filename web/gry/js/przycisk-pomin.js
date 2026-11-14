// Wspólny przycisk „Pomiń” (gra i koło nagród; ładowany przed zabi-chor.js, nagrody.js i jak-grac.js).
// Przycisk „Pomiń” jednego wyglądu w całej grze (10-17): filcowa naklejka .przycisk.pomin z ikoną przewijania (gry.css).
function przyciskPomin(tekst,klasa){
  const b=document.createElement("button");b.type="button";b.className="przycisk pomin"+(klasa?" "+klasa:"");
  b.append(document.createTextNode(tekst));
  b.insertAdjacentHTML("beforeend",'<svg class="pomin-ikona" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 5.5l8.5 6.5L3 18.5z"/><path d="M12 5.5l8.5 6.5-8.5 6.5z"/></svg>');
  return b;
}
