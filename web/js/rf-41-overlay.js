"use strict";
// ============================================================================
//  THE OVERLAYS — one floating cheat sheet PER CAPSULE, on top of the game.
//
//  Same page, two roles. Opened with ?overlay=1&dev=<slot> this file turns the cheat sheet into a
//  small floating panel showing THAT capsule: it strips the chrome, adds the bar the overlay needs
//  (how big, how see-through, which look, what to show) and reports back the one thing only a page
//  can measure. Opened normally, it is the row of buttons in the cheat-sheet card that starts them
//  — plus the way OUT of "clicks pass through", which by definition cannot live in the overlay.
//
//  One window per capsule, not one for all of them, because that is how they are used: the capsule
//  you are steering with wants its orientation ball where it can be glanced at mid-game, and the
//  one in your other hand wants its trigger list somewhere else entirely. Each window therefore
//  carries its own position, size, scale, transparency, look and switches.
//
//  What this file deliberately does NOT do: draw anything of its own. Every widget in there — the
//  orientation ball, the stick/d-pad/mouse preview, the rule rows with their LEDs and the
//  activation graphs — is the panel's code, running off the same live stream. That is the whole
//  point of reusing this view: an improvement to a widget shows up in the overlay for free.
//
//  The windows themselves are made by the server (OverlayManager in ribbitflip_monitor.py). A web
//  page cannot put itself above other programs, fade itself, or let a click through to whatever is
//  behind it — those are properties of an operating-system window. This side asks; that side does.
// ============================================================================
const RF_OVL_I18N={
 "Nakładka":"Overlay",
 "Nakładki":"Overlays",
 "Nakładka nad grą":"Overlay over the game",
 "Małe okienko z tym kapslem, przypięte NAD grą — do grania i na stream. Możesz mieć ich kilka na jeden kapsel: każde ma własne miejsce, rozmiar i zawartość.":"A small window with this capsule, pinned ABOVE the game — for playing and for streaming. You can have several for one capsule: each with its own place, size and contents.",
 // Several windows for one capsule: naming them, making one more, taking one away.
 "Nazwa tej nakładki":"This overlay's name",
 "np. drążek, klikanie":"e.g. stick, clicks",
 "Po co ta nazwa: gdy kapsel ma kilka nakładek, to ona je rozróżnia — w pasku, w panelu i w menu przy zegarku":"What the name is for: when a capsule has several overlays, this is what tells them apart — on the bar, in the panel and in the tray menu",
 "Nowa nakładka":"New overlay",
 "Kolejne okienko tego kapsla — z własnym miejscem i własną zawartością":"One more window for this capsule — with its own place and its own contents",
 "Usuń tę nakładkę":"Remove this overlay",
 "Usunąć nakładkę „%s”? Jej miejsce, rozmiar i ustawienia przepadną.":"Remove the overlay “%s”? Its place, size and settings will be gone.",
 // „Usuń" NIE ma tu pary: ten słownik jest scalany do globalnego I18N_EN (Object.assign niżej), więc
 // lokalne „Usuń"→„Remove" przykrywało wszystkie przyciski „Usuń" panelu (Mapowanie, Biblioteki), które
 // znaczą „Delete". Przycisk okna potwierdzenia dostaje „Remove" jawnie przez _gl() przy rfConfirm.
 "Anuluj":"Cancel",
 "Pokaż nad grą":"Show over the game",
 "Schowaj":"Hide",
 "Pokaż nad grą małe okienko z tym kapslem":"Show a small window with this capsule over the game",
 "Zamknij okienko nad grą":"Close the little window over the game",
 // …and the same switch on the capsule itself, in "Twoje urządzenia" (.dp-ovl, rf-11).
 "Pokaż ten kapsel nad grą — małe okienko na wierzchu, do grania i na stream.":"Show this capsule over the game — a small window on top, for playing and for streaming.",
 "Schowaj okienko tego kapsla znad gry.":"Take this capsule's little window off the game.",
 "Nakładka na wierzchu — ":"Overlay on top — ",
 "Zamknij nakładkę":"Close the overlay",
 "Przeciągnij, aby przesunąć nakładkę":"Drag to move the overlay",
 "Ustawienia nakładki":"Overlay settings",
 "Pokaż:":"Show:",
 "Wygląd:":"Look:",
 "Jasny":"Light",
 "Ciemny":"Dark",
 "Kremowa karta jak w panelu":"A cream card, like the panel",
 "Ciemna karta — lepsza nad jasną grą":"A dark card — better over a bright game",
 "Sama treść":"Content only",
 "Bez karty: nad grą zostaje kula, strzałki i napisy":"No card: the ball, the arrows and the letters, over the game",
 "Neon":"Neon",
 "Szkło":"Glass",
 "Ciemna karta w barwach neonu — do ciemnych gier":"A dark card in neon colours — for dark games",
 "Jasna, chłodna karta — do jasnych gier":"A bright, cool card — for bright games",
 "tło":"background",
 "Rozmiar":"Size",
 "Przezroczystość":"Transparency",
 "Dopasuj okno do zawartości":"Fit the window to its contents",
 "Dopasuj":"Fit",
 "Przepuszczaj kliknięcia":"Pass clicks through",
 "Kliknięcia trafiają do gry, nie do nakładki. Ten pasek zostaje klikalny, więc możesz to tu wyłączyć.":"Clicks reach the game, not the overlay. This bar stays clickable, so you can switch it off right here.",
 "przepuszcza kliknięcia":"is passing clicks through",
 "nagłówek":"header",
 "orientacja":"orientation",
 "ruch":"motion",
 "wyzwalacze":"triggers",
 "wykres":"graph",
 "opis":"description",
 "liczniki":"counters",
 "naciśnięcia":"presses",
 "kontroler":"controller",
 "Naciśnięcia przycisku kapsla: kropka świeci, gdy trzymasz, liczba to długość naciśnięcia, paski to ostatnie 6 sekund":"The capsule button's presses: the dot lights up while you hold it, the figure is how long the press is, the bars are the last 6 seconds",
 "Brak połączenia z RibbitFlip — suwaki i przełączniki nie zadziałają.":"No connection to RibbitFlip — the sliders and switches will not do anything.",
 "Nie udało się przypiąć tego okna na wierzchu — zamknij nakładkę i otwórz ją ponownie.":"This window could not be pinned on top — close the overlay and open it again.",
 "To okno jest na wierzchu, nad grą i nad innymi oknami. Kliknij, żeby je odpiąć.":"This window is on top — above the game and above other windows. Click to unpin it.",
 "To okno NIE jest trzymane na wierzchu, inne okna mogą je zasłonić. Kliknij, żeby je przypiąć.":"This window is NOT being kept on top — other windows can cover it. Click to pin it.",
 "Miało być na wierzchu, ale się nie udało. Inne okna mogą je zasłonić. Kliknij, żeby przestać próbować.":"It was meant to be on top and is not — other windows can cover it. Click to stop trying.",
 "Trzymaj na wierzchu":"Keep on top",
 // PASEK OKNA — przełącznik, który sam siebie chowa (2026-09-03): uchwyt nakładki da się wyłączyć,
 // a wtedy pozycję edytuje się wyłącznie przez stronę. Stąd drugie zdanie: z tej strony da się go tylko wyłączyć.
 "Pasek okna (uchwyt do przesuwania i ⚙)":"Window bar (drag handle and ⚙)",
 "Bez paska tego okna nie przesuniesz ani nie ustawisz stąd — wszystko robi się wtedy na ekranie „Nakładka” w panelu. Z powrotem włączysz go tylko tam.":
   "With no bar this window cannot be moved or set up from here — it is all done on the “Overlay” screen in the panel. That is also the only place it can be switched back on.",
 // The drawer, reorganised: three named sections instead of one wall of controls.
 "Elementy":"Parts",
 "Wygląd":"Look",
 "Okno":"Window",
 "Obrys:":"Outline:",
 "Kula":"Ball",
 "Kula z siatką osi":"The ball with the axis grid",
 "Model kapsla — strzałka cyjan to przód":"A model of the capsule — the cyan arrow is the front",
 "najedź na wiersz — element mignie w nakładce":"hover a row — the part lights up in the overlay",
 "Pokaż lub ukryj:":"Show or hide:",
 "Rozmiar tego elementu — mnoży się z rozmiarem całości":"This part's size — multiplies with the whole overlay's",
 "w wierszu reguły:":"inside each rule row:",
 "Jasna karta":"Light card",
 "Ciemna karta":"Dark card",
 "Przyciemnione tło pod treścią":"A dimmed backdrop behind the content",
 // Podpowiedź pod suwakiem przezroczystości — od 2026-08-31 mówi o TLE, bo suwak wreszcie tło
 // przygasza (patrz „PRZEZROCZYSTOŚĆ DOTYCZY TŁA" w ovlApply). Stara para została w słowniku:
 // czyta ją każdy zapisany zrzut i każda starsza strona, a usunięcie jej niczego nie naprawia.
 "Bez tła przygasa sama treść; z tłem przygasa całe okno.":"With no backdrop the content itself dims; with the backdrop the whole window fades.",
 "Przygasza całe okienko razem z jego tłem.":"It fades the whole little window, backdrop and all.",
 "Przygasza treść okna; tło jest wycięte, więc grę widać zawsze.":
   "Dims the window's content; the background is cut away, so the game always shows through.",
 // Drobiazgi wewnątrz bloków (2026-09-01) — i trzy nazwy, które przy tej okazji doprecyzowano:
 // „wykres" na „wykres aktywacji", „opis" na „opis reguły", „liczniki" na „liczniki odpaleń".
 // W płaskiej liście trzynastu pozycji jedno słowo wystarczało; pod blokiem, do którego należą,
 // ma się czytać od razu, czego dotyczą.
 "etykieta kapsla":"the capsule's own label",
 "stan połączenia":"connection status",
 "liczby (nachylenie, obrót)":"figures (tilt and twist)",
 "długość naciśnięcia":"how long it was held",
 "paski ostatnich sekund":"the last few seconds as bars",
 "spis wycinków":"the list of slices",
 "kto na nim gra":"who plays on it",
 // PRZÓD KAPSLA (rf-41e, 2026-09-29): blok nakładki, jego drobiazgi i rozwinięcie w edytorze.
 "przód kapsla":"capsule front",
 "stopnie do celu":"degrees to go",
 "wycinek tolerancji":"tolerance wedge",
 "przygaszaj w celu":"dim when on target",
 "Przód kapsla: kropla uspokaja się i zielenieje, gdy kapsel mierzy w przód":"Capsule front: the drop calms down and turns green when the capsule points forward",
 "Kapsel jest okrągły, więc nie widać, gdzie ma przód. Ta kropla to pokazuje: przód fabryczny albo taki, który ustawisz sam (np. tam, gdzie logo). Gdy kapsel mierzy w przód, kropla się uspokaja i zielenieje.":
   "The capsule is round, so you cannot see where its front is. This drop shows it: the factory front or one you set yourself (for example where the logo is). When the capsule points forward, the drop calms down and turns green.",
 "Czułość":"Sensitivity",
 "O ile stopni przód może uciec od celu, żeby kierunek był jeszcze dobry":"How many degrees the front may drift from the target and still count as the right direction",
 "Na płasko od":"Flat, from",
 "Kapsel na płasko: od jakiego pochylenia liczy się „do przodu”":"Capsule lying flat: how far it has to tip before it counts as “forward”",
 "Przód kapsla":"Capsule front",
 "Połóż kapsel płasko, pochyl w stronę, która ma być przodem, i przytrzymaj chwilę":"Lay the capsule flat, tip it towards the side that should be the front and hold it for a moment",
 "Kierownica":"Steering wheel",
 "Trzymaj kapsel pionowo jak kierownicę, przyciskiem do siebie: to, co jest u góry, zostanie przodem":"Hold the capsule upright like a steering wheel, button facing you: whatever is at the top becomes the front",
 "Fabryczny":"Factory",
 "Wróć do przodu fabrycznego (oś czujnika)":"Go back to the factory front (the sensor axis)",
 "fabryczny (oś czujnika)":"factory (the sensor axis)",
 "własny":"your own",
 "w lewo od fabrycznego":"left of the factory front",
 "w prawo od fabrycznego":"right of the factory front",
 "Przywrócono przód fabryczny":"Factory front restored",
 "Przód kapsla ustawiony":"Capsule front set",
 "Kapsel nie przesyła orientacji. Podłącz go i spróbuj jeszcze raz.":"The capsule is not sending its orientation. Connect it and try again.",
 "Postaw kapsel pionowo, przyciskiem do siebie, i obróć tak, żeby przód był u góry.":"Stand the capsule upright, button facing you, and turn it so the front is at the top.",
 "Nie złapałem pochylenia. Spróbuj jeszcze raz: pochyl do przodu i przytrzymaj.":"No tip was caught. Try again: tip it forward and hold it.",
 "pochyl mocniej":"tip it further",
 "za mocno":"too far",
 "trzymaj…":"hold it…",
 // Druga tura (2026-09-29): ten sam komponent w prawej kolumnie panelu i powiązanie z nakładką.
 "Przód":"Front",
 "Te same ustawienia są w prawej kolumnie panelu, pod podglądem na żywo: zmiana tu jest zmianą tam.":
   "The same settings are in the panel's right-hand column, under the live preview: a change here is a change there.",
 "Nakładkę dla tego kapsla tworzysz na ekranie „Nakładka”.":"You create an overlay for this capsule on the “Overlay” screen.",
 "Pokazany w nakładce":"Shown in the overlay",
 "W nakładce ukryty":"Hidden in the overlay",
 "Pokaż w nakładce":"Show in the overlay",
 "Ukryj w nakładce":"Hide in the overlay",
 "Pokaż lub schowaj ustawienia przodu":"Show or hide the front settings",
 "Świeć LED, gdy kapsel mierzy w przód":"Light the LED when the capsule points forward",
 "Dioda kapsla zapala się, gdy przód jest u góry (kapsel pionowo) albo gdy pochylasz go do przodu. Działa bez patrzenia na ekran, także przy zamkniętym panelu.":
   "The capsule's LED lights up when the front is at the top (capsule upright) or when you tip it forward. Works without looking at the screen, even with the panel closed.",
 "wykres aktywacji":"activation graph",
 "opis reguły":"the rule's description",
 "liczniki odpaleń":"firing counters",
 "Szczegóły każdego elementu — i kolejność — ustawisz w panelu, na ekranie „Nakładka”.":
   "Each part's details — and the order — are set in the panel, on the “Overlay” screen.",
 "Rozmiar całości":"Whole overlay",
 "Okno dopasowuje się samo: szerokość idzie za „Szerokością” i „Rozmiarem całości”, wysokość za tym, co w nim włączone.":
   "The window fits itself: the width follows “Width” and “Whole overlay”, the height follows whatever is switched on in it.",
 "Ile miejsca w poziomie ma treść. Wąsko — opisy reguł się zawijają; szeroko — rysunki dostają powietrze. Wysokość okno dobiera samo.":
   "How much room the content gets side to side. Narrow — the rule descriptions wrap; wide — the drawings get air. The window picks its own height.",
 // Proporcje i wielkość w liczbach — te same napisy w szufladzie ⚙ i w karcie w panelu.
 "Proporcje:":"Proportions:",
 "Szerokość":"Width",
 "Wysokość":"Height",
 "Kwadrat — pod koło wyboru i pod samą kulę orientacji":"A square — for the wheel and for the orientation ball on its own",
 "Szerzej niż wyżej — pod nagłówek z kilkoma wierszami reguł":"Wider than tall — for a header with a few rule rows",
 "Wyżej niż szerzej — pod długą listę wyzwalaczy przy krawędzi ekranu":"Taller than wide — for a long trigger list down the edge of the screen",
 "Pasek — pod sam nagłówek albo pod wykres aktywacji":"A strip — for the header alone or for the activation graph",
 "Słupek — pod kolumnę przy boku ekranu, obok gry":"A column — for the side of the screen, next to the game",
 // Obrys (OVL_OUTLINES niżej w tym pliku). Etykiety „Ciemny"/„Jasny" mają pary w rf-01; te dwie
 // i wszystkie cztery podpowiedzi nie miały żadnych, a stoją w atrybucie `title` i w `_cvT()`.
 "Kapsla":"Capsule",
 "Brak":"None",
 "Czarna poświata — czytelne nad jasną grą":"A black glow — readable over a bright game",
 "Biała poświata — czytelne nad ciemną grą":"A white glow — readable over a dark game",
 "Poświata w kolorze tego kapsla":"A glow in this capsule's colour",
 "Bez poświaty — najczyściej, ale nad jasną grą bywa nieczytelne":
   "No glow — the cleanest, but over a bright game it can be hard to read",
};
try{Object.assign(I18N_EN,RF_OVL_I18N);}catch(e){}

// THE MARK FOR "OVERLAY", wherever the feature turns up: the cheat-sheet header and every capsule
// in "Twoje urządzenia". Two panes with the front one lifted off the back. Since 2026-10-15 the felt
// overlay.png like the rest of the panel (was a stroked SVG); the capsule colour that the SVG took from
// the button now sits in a small stitched dot on the corner (.ovl-ic-filc::after, --dcol).
const OVL_ICON='<span class="ovl-ic-filc" aria-hidden="true"></span>';

// "Keep this window above everything." A drawing pin, with a line through it when it is not — and
// it is not a decoration: the app MEASURES the window's topmost bit every couple of seconds and
// puts it back when it has been lost, and this is what that measurement looks like. Without it, an
// overlay that had fallen behind a window looked exactly like an overlay that was never pinned.
// It is also a SWITCH. It was a lamp for a while, shaped exactly like the cog and the ✕ next to it,
// which is a button as far as anyone using it is concerned — clicked, nothing happened, and there
// was no way to stop the window covering everything short of closing it.
const OVL_PIN_ICON='<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" '+
  'stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'+
  '<path d="M5.6 2.2h4.8l-0.9 3 2.4 2.5H4.1l2.4-2.5z"/><path d="M8 7.7v5.9"/>'+
  '<path class="ovl-pin-slash" d="M2.2 13.8 13.8 2.2"/></svg>';

// The eye on every part's row: one glyph for "shown", the same glyph struck through for "hidden".
// Drawn like the pin — a slash that is simply not displayed while the part is on — so the two
// states are unmistakably the same switch, not two different buttons.
const OVL_EYE_ICON='<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" '+
  'stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">'+
  '<path d="M1.8 8c1.6-2.9 3.7-4.3 6.2-4.3S12.6 5.1 14.2 8c-1.6 2.9-3.7 4.3-6.2 4.3S3.4 10.9 1.8 8z"/>'+
  '<circle cx="8" cy="8" r="1.9"/>'+
  '<path class="ovl-eye-slash" d="M2.6 13.4 13.4 2.6"/></svg>';

// WHERE EACH PART LIVES on the cheat sheet — hovering its row in the drawer lights the real thing
// up. The labels are one word each ("opis", "liczniki"), and a word is not a picture: the only
// honest answer to "which one is that?" is to point at it.
const OVL_PART_SEL={head:".ov-head",pose:".ov-pose",front:".ov-front",note:".ov-note",motion:".ov-mouse",press:".ov-press",
  pad:".ov-padbox",rules:".ov-rules",graph:".tr-detail",cond:".ov-cond",fires:".ov-fires",
  midi:".ov-midi",wheel:".ov-wheel","pad.who":".ov-pad-who"};

const RF_OVL=/[?&]overlay=1/.test(location.search);
// The class is also set by a one-liner in <head>, before the first paint — repeated here so the
// file works even if that line is ever lost, at the cost of a flash of the full panel.
if(RF_OVL)document.documentElement.classList.add("rf-ovl");
// WHOSE overlay this window is, and WHICH of that capsule's overlays it is. Two different things
// since a capsule may have several: `dev` decides what the cheat sheet shows (one capsule's column)
// and `win` decides whose settings this window reads and writes. They are the same string for a
// capsule's first window — that is what makes every setting saved before today still belong to it.
const RF_OVL_DEV=(function(){try{return new URLSearchParams(location.search).get("dev")||"";}catch(e){return "";}})();
const RF_OVL_WIN=(function(){try{return new URLSearchParams(location.search).get("win")||RF_OVL_DEV;}catch(e){return RF_OVL_DEV;}})();
// KOŁO PRZY KURSORZE — okno jednego rodzaju, otwierane przez aplikację z „&wheel=1" (patrz
// OverlayWindow.open). To wciąż ta sama ściąga i ten sam rysunek koła; różnica jest w OPRAWIE:
// takie okno nie dostaje paska, narożnika ani zębatki, bo miejsce wyznacza mu kursor, a rozmiar
// i wygląd ustawia się w karcie „Koło wyboru". Gdyby pasek tu został, siedziałby dokładnie pod
// wskaźnikiem i — jako jedyny kawałek okna, który zostaje klikalny przy przepuszczaniu kliknięć —
// zjadałby kliknięcie zatwierdzające wybór. Klasa idzie na <html>, resztę robi 15-overlay.css.
const RF_OVL_WHEEL=RF_OVL&&/[?&]wheel=1/.test(location.search);
if(RF_OVL_WHEEL)document.documentElement.classList.add("rf-ovl-wheel");
// ŻYWA MINIATURA W PANELU (2026-09-01). Ta sama strona, w tej samej roli, tylko w ramce na ekranie
// „Nakładka" zamiast nad grą — po to, żeby podgląd nie był RYSUNKIEM nakładki obok prawdziwej
// nakładki, czyli drugim miejscem z prawem do rozjechania się (ten projekt zaliczył to już przy
// dwóch listach wyglądów, patrz RF_LOOKS niżej).
//
// Trzy rzeczy, którymi miniatura różni się od okna, i każda wynika z tego, że ona NIGDZIE NIE STOI:
//   • nie ma paska ani szuflady ⚙ — konfiguracja jest obok, w karcie panelu,
//   • nie mierzy i nie melduje geometrii (`chrome`, `grab`): w ramce `outerHeight-innerHeight`
//     to zero, a wysłane zero kazałoby serwerowi liczyć ramkę prawdziwego okna od nowa,
//   • przygasza treść SAMA. Nad grą przezroczystość robi Windows (alfa warstwowa okna), a tutaj
//     nie ma okna — bez tej jednej emulacji suwak byłby w podglądzie martwy. ⚠️ Emulacja żyje
//     WYŁĄCZNIE tu: w prawdziwym oknie strona nie przygasza niczego i to jest cała poprawka
//     z 2026-08-31 (patrz komentarz w `ovlApply`).
const RF_OVL_PREVIEW=RF_OVL&&/[?&]preview=1/.test(location.search);
if(RF_OVL_PREVIEW)document.documentElement.classList.add("rf-ovl-preview");

// WHAT ONE OVERLAY IS CALLED, wherever it is listed. The mirror of overlay_window_title() in
// ribbitflip_monitor.py — the tray builds its rows there, this side builds the panel's buttons and
// each window's own bar, and the two must not disagree about what a window is called.
// A capsule with one unnamed overlay is simply the capsule; past that, the owner's name for the
// window wins, and an unnamed one falls back to its number.
function ovlWinTitle(capName,label,index,total){
  capName=capName||""; label=(label||"").trim();
  if(label)return capName?(capName+" · "+label):label;
  if((total||1)<=1)return capName;
  return capName+" · "+((index|0)+1);
}

// Which parts of the capsule's card can be switched on and off. `key` matches the `show` block the
// server stores, `cls` the class that hides it.
//
// DWA POZIOMY, JEDNA LISTA (2026-09-01). Pozycja z `parent` to nie jest kolejny element ściągi,
// tylko DROBIAZG WEWNĄTRZ jednego z nich — liczba pod kulą, paski pod kropką naciśnięcia, opis
// w wierszu reguły. Do tego dnia stały w edytorze w jednym rzędzie z „orientacją" i „kontrolerem",
// więc lista miała trzynaście jednakowych pozycji i nie dało się z niej wyczytać, co do czego
// należy. Jedno pole `parent` robi z niej drzewo, a cała maszyneria klas (`ovlColumns` niżej)
// zostaje bez zmiany: drobiazg chowa się swoją klasą tak samo, jak blok.
//
// `draw:true` znaczy „tego nie da się schować stylem" — rysuje to płótno, więc flaga jedzie do
// funkcji rysującej (patrz `drawMiniPose` w rf-12).
const OVL_PARTS=[
  // `bg` is the odd one out: it does not hide a part, it puts the window's own background BACK.
  // Off by default — a tinted rectangle around the content is a frame, and the whole point of an
  // overlay is not having one. On, for anyone who needs the contrast over bright footage.
  {key:"bg",    label:"tło",        cls:"ovl-bg", invert:true},
  {key:"head",  label:"nagłówek",   cls:"ovl-no-head"},
  {key:"head.label", label:"etykieta kapsla", cls:"ovl-no-headlabel", parent:"head"},
  {key:"head.conn",  label:"stan połączenia", cls:"ovl-no-headconn",  parent:"head"},
  {key:"pose",  label:"orientacja", cls:"ovl-no-pose"},
  {key:"pose.num",   label:"liczby (nachylenie, obrót)", parent:"pose", draw:true},
  // PRZÓD KAPSLA (rf-41e, 2026-09-29). Kapsel jest okrągły i nie widać, gdzie ma przód — ta kropla
  // to pokazuje (przód fabryczny albo własny, ustawiony w edytorze) i uspokaja się, gdy kapsel
  // mierzy w przód. Wyłączona domyślnie: narzędzie do nauczenia się kapsla, nie stały element ściągi.
  // Bez drobiazgów okna: wygląd kropli należy do KAPSLA (ten sam widok stoi w prawej kolumnie panelu).
  {key:"front", label:"przód kapsla", cls:"ovl-no-front"},
  // NOTATKA GRACZA (2026-11-21): klawiszologia albo ściąga napisana przez człowieka (`cfg.note`,
  // edytor na ekranie „Nakładka”). Wyłączona domyślnie: pusta notatka nie ma czego pokazać.
  {key:"note",  label:"notatka gracza", cls:"ovl-no-note"},
  {key:"motion",label:"ruch",       cls:"ovl-no-motion"},
  // The capsule's button, live: a lamp, how long it has been held, and the last six seconds as
  // bars. Off by default like the graph — it earns its room only for someone tuning a "hold for
  // 600 ms" trigger, and that is exactly who asks for it.
  {key:"press", label:"naciśnięcia", cls:"ovl-no-press"},
  {key:"press.val",  label:"długość naciśnięcia", cls:"ovl-no-pressval",  parent:"press"},
  {key:"press.lane", label:"paski ostatnich sekund", cls:"ovl-no-presslane", parent:"press"},
  // The virtual controller (rf-42). Off by default, and for a plainer reason than the two above:
  // the drawing is the biggest thing in the column, and someone whose set never touches the pad
  // would be handed a grey rectangle. Worth every pixel to anyone who does map it.
  {key:"pad",   label:"kontroler",  cls:"ovl-no-pad"},
  // KTO NA NIM GRA — wiersz chipów pod rysunkiem pada (2026-09-11). Rysuje się sam dopiero, gdy
  // w kontroler wpięte są co najmniej dwa kapsle: przy jednym chip mówiłby „tylko ja", czyli nic.
  {key:"pad.who", label:"kto na nim gra", cls:"ovl-no-padwho", parent:"pad"},
  // Koło wyboru (rf-46). ON by default, unlike the graph and the pad: it costs no room at all
  // until somebody holds the button down, and in the moment it DOES appear it is the one thing on
  // the card that has to be visible — the choice is being made right then.
  {key:"wheel", label:"koło wyboru", cls:"ovl-no-wheel"},
  {key:"wheel.list", label:"spis wycinków", cls:"ovl-no-wheellist", parent:"wheel"},
  {key:"rules", label:"wyzwalacze", cls:"ovl-no-rules"},
  // Trzy drobiazgi listy reguł. Do 2026-09-01 stały w edytorze OBOK niej, jako równorzędne pozycje
  // — a „wykres" bez „wyzwalaczy" nie ma czego rysować, bo jest wierszem w ich liście.
  {key:"graph", label:"wykres aktywacji", cls:"ovl-no-graph", parent:"rules"},
  {key:"cond",  label:"opis reguły",      cls:"ovl-no-cond",  parent:"rules"},
  {key:"fires", label:"liczniki odpaleń", cls:"ovl-no-fires", parent:"rules"},
  {key:"midi",  label:"MIDI",       cls:"ovl-no-midi"},
];
// BLOKI, czyli to, co da się przestawiać i czemu można zmienić rozmiar — lustro OVERLAY_ORDER_KEYS
// w ribbitflip_monitor.py. Liczone z listy wyżej, żeby część dołożona tam pojawiła się i tutaj.
const OVL_BLOCKS=OVL_PARTS.filter(p=>!p.parent&&p.key!=="bg");
// Drobiazgi danego bloku (puste, gdy blok żadnych nie ma).
function ovlSubParts(key){return OVL_PARTS.filter(p=>p.parent===key);}
// KOLEJNOŚĆ BLOKÓW W TYM OKNIE. Zapisany porządek niesie tylko to, co człowiek przestawił — reszta
// dochodzi w kolejności kanonicznej, na swoje naturalne miejsce. Dzięki temu część dołożona
// w przyszłości nie wypada na koniec u kogoś, kto raz coś przeciągnął.
function ovlOrderOf(cfg){
  const want=(cfg&&Array.isArray(cfg.order))?cfg.order:[];
  const all=OVL_BLOCKS.map(p=>p.key);
  const out=want.filter(k=>all.indexOf(k)>=0);
  for(const k of all)if(out.indexOf(k)<0)out.push(k);
  return out;
}
// WYGLĄD NALEŻY DO OKNA — i to jest cała reguła, z której wynika reszta tego bloku.
//
// Każde okno nakładki ma swój `theme` i ustawia się go tam, gdzie to okno się konfiguruje: zwykłe
// w swojej szufladzie ⚙, okienko koła w karcie koła (bo to jedyne miejsce, w którym ono dla
// człowieka istnieje — z list nakładek jest świadomie wyjęte). Nic się nie przeprowadza i nic nie
// ma dwóch przełączników.
//
// ⚠️ ALE LISTA WYGLĄDÓW JEST JEDNA. Do 2026-08-27 były DWIE — ta i WH_CUR_LOOKS w rf-46b — i już
// się rozjechały: ta sama wartość „felt" nazywała się tu „Jasna karta", a tam „Jasny", a dwa nowe
// wyglądy z makiety (Neon, Szkło) miała tylko jedna z nich. Kanon jest więc tutaj (nakładkę ładują
// OBIE strony: panel i strona nakładki), a karta koła bierze z niego kody i etykiety, dokładając
// wyłącznie WŁASNĄ podpowiedź — bo to jedyne, co naprawdę zależy od powierzchni: w zwykłej
// nakładce „Sama treść" zostawia kulę, strzałki i napisy, a w okienku koła samo koło.
const RF_LOOKS=[
  {k:"felt",  label:"Jasny"},
  {k:"dark",  label:"Ciemny"},
  {k:"bare",  label:"Sama treść"},
  // Dwa ostatnie przeniesione z makiety, na której koło było projektowane
  // (poza repozytorium).
  {k:"neon",  label:"Neon"},
  {k:"glass", label:"Szkło"},
];
// Wygląd dotyczy KARTY — tło samego okna jest wycięte w każdym z nich, więc żaden nie stawia
// prostokąta wokół treści.
const OVL_HINTS={
  felt:"Kremowa karta jak w panelu",
  dark:"Ciemna karta — lepsza nad jasną grą",
  bare:"Bez karty: nad grą zostaje kula, strzałki i napisy",
  neon:"Ciemna karta w barwach neonu — do ciemnych gier",
  // ⚠️ Nad grą tło okna jest WYCIĘTE, więc półprzezroczysta karta zmieszałaby się z kolorem dziury
  // i cięcie zjadłoby ją razem z nim. Szkło jest tu więc jasną, chłodną kartą — rozmycie widać
  // tylko tam, gdzie jest co rozmywać (podgląd w panelu).
  glass:"Jasna, chłodna karta — do jasnych gier",
};
const OVL_THEMES=RF_LOOKS.map(l=>({k:l.k, label:l.label, hint:OVL_HINTS[l.k]||""}));
// …i te same wyglądy opisane dla OKIENKA KOŁA. Jedna lista kodów (RF_LOOKS), dwa zestawy
// podpowiedzi — bo podpowiedź jest jedyną rzeczą, która naprawdę zależy od tego, co w oknie stoi:
// w zwykłej nakładce „Sama treść" zostawia kulę, strzałki i napisy, a w okienku koła samo koło.
// Do 2026-08-31 ten zestaw mieszkał w karcie koła (WH_LOOK_HINTS w rf-46b) i rysował własne
// przyciski; po przeniesieniu wyboru stylu do ustawień nakładki stoi tam, gdzie się go używa.
const OVL_WHEEL_HINTS={
  felt:"Kremowa karta jak w panelu",
  dark:"Ciemna karta — lepsza nad jasną grą",
  bare:"Bez karty: nad grą zostaje samo koło",
  neon:"Prawie czarne wycinki, świecące krawędzie — do ciemnych gier",
  glass:"Matowa szyba: jasne półprzezroczyste wycinki, miękki cień",
};
const OVL_WHEEL_THEMES=RF_LOOKS.map(l=>({k:l.k, label:l.label, hint:OVL_WHEEL_HINTS[l.k]||""}));
// PROPORCJE OKNA — jedna lista dla obu miejsc, w których się je ustawia (szuflada ⚙ w nakładce
// i karta „Nakładki nad grą" w panelu). Nie zastępują pól szerokości i wysokości: przeliczają
// wysokość z szerokości, bo tak brzmi prośba („niech to będzie kwadrat / pasek 16:9"), a potem
// obie liczby dalej wolno poprawić ręcznie. `null` = „dowolne", czyli stan po ręcznej zmianie.
const OVL_RATIOS=[
  {k:"1:1",  w:1,  h:1,  hint:"Kwadrat — pod koło wyboru i pod samą kulę orientacji"},
  {k:"4:3",  w:4,  h:3,  hint:"Szerzej niż wyżej — pod nagłówek z kilkoma wierszami reguł"},
  {k:"3:4",  w:3,  h:4,  hint:"Wyżej niż szerzej — pod długą listę wyzwalaczy przy krawędzi ekranu"},
  {k:"16:9", w:16, h:9,  hint:"Pasek — pod sam nagłówek albo pod wykres aktywacji"},
  {k:"9:16", w:9,  h:16, hint:"Słupek — pod kolumnę przy boku ekranu, obok gry"},
];
// SZEROKOŚĆ OKNA — SKĄD SIĘ BIERZE (2026-09-01). Nie z ciągnięcia rogu i nie z pola liczbowego,
// tylko z „Rozmiaru całości": okno jest tej szerokości, co jego treść przy tym powiększeniu.
//
// Ta liczba jest szerokością UKŁADU, w pikselach CSS przed powiększeniem — układ kolumny jest przy
// każdym „Rozmiarze" ten sam, a zmienia się tylko to, jak duży. Dzięki temu zdanie „zrób to
// większe" znaczy dokładnie jedno: większe litery, większe rysunki, szersze okno, ten sam obraz.
// 400 nie jest wzięte z sufitu — to szerokość, którą nakładka miała od zawsze (`OVERLAY_WIN_DEFAULTS`
// w ribbitflip_monitor.py), więc przy 100% nic nikomu nie skacze.
const OVL_BASE_W=400;
// …A OD 2026-09-07 TA SZEROKOŚĆ UKŁADU JEST USTAWIENIEM (`baseW`). Dwa suwaki, dwa pytania: „Rozmiar całości" = jak DUŻE
// ma być wszystko (litery, rysunki, okno — naraz), „Szerokość" = ile MIEJSCA w poziomie ma treść
// (wąsko → opisy reguł zawijają się, szeroko → pad i kula dostają powietrze). Okno dalej nie ma pola
// z liczbą pikseli: szerokość okna to iloczyn tych dwóch i skalowania ekranu, liczony tu.
const OVL_BASE_W_MIN=240, OVL_BASE_W_MAX=1200;
function ovlBaseW(v){return Math.max(OVL_BASE_W_MIN,Math.min(OVL_BASE_W_MAX,Math.round(+v||OVL_BASE_W)));}
// Ile okno ma mieć przy danym „Rozmiarze całości" i „Szerokości", w pikselach OKNA (fizycznych).
function ovlAutoWidth(scale,dpr,baseW){
  const z=Math.max(60,Math.min(200,+scale||100))/100;
  return Math.max(180,Math.min(4000,Math.round(ovlBaseW(baseW)*z*(dpr||1))));
}

// Która proporcja opisuje TE dwie liczby (albo "" — żadna). Tolerancja 1,5%: okno bywa dopasowane
// do zawartości co do piksela, a wtedy 400×301 nadal JEST „4:3" dla oka i dla decyzji.
// ⚠️ Od 2026-09-01 to jest już tylko NAZWA tego, co wyszło — proporcji nie da się wybrać, bo
// wielkość okna jest wynikiem ustawień, a nie ustawieniem. `OVL_RATIOS` niżej zostaje jako tablica
// nazw dla tej funkcji (galeria pisze „1:1" pod kafelkiem), a nie jako lista przycisków.
function ovlRatioOf(w,h){
  w=+w||0; h=+h||0;
  if(w<=0||h<=0)return "";
  for(const r of OVL_RATIOS){if(Math.abs((w/h)-(r.w/r.h))/(r.w/r.h)<=0.015)return r.k;}
  return "";
}
// THE OUTLINE, and only in "content only" — the other two looks have a card to read against.
// With the card gone the letters and the drawings sit on the game itself, and what separates them
// from it is a halo drawn AWAY from the hole colour (which is why it survives the cut). Which
// colour reads best depends on what is being played, so it is a choice rather than a constant —
// including "none", for anyone who would rather have the picture clean than legible.
// EACH PART'S OWN SIZE. The window-wide slider zooms the lot, which is the wrong knob for what
// people actually want out of a cheat sheet over a game: the orientation ball big enough to read
// without looking away, and the trigger list small enough to still fit under it. These multiply
// with the window scale rather than replacing it, so "make the whole thing a bit bigger" still
// works afterwards. Only the blocks: `cond` and `fires` are words inside a rule row and follow it.
// NOTATKA GRACZA: tekst z `cfg.note` tego okna, jedna linijka = jedna rzecz. Linijka w kształcie
// „Przycisk: skok” (albo z „=”, „→”, „ - ”) rysuje się z lewą częścią w ramce klawisza, żeby ściąga
// czytała się jak klawiszologia, a nie jak akapit. Zwykła linijka zostaje zwykłym tekstem.
function ovlNoteHtml(txt){
  if(txt===undefined)txt=(typeof OVL!=="undefined"&&OVL.cfg&&OVL.cfg.note)||"";
  const e=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const rows=String(txt||"").split(/\r?\n/).map(l=>l.trim()).filter(Boolean).slice(0,14);
  if(!rows.length)return "";
  return rows.map(l=>{
    const m=l.match(/^(.{1,28}?)\s*(?::|=|→|->|\s-\s|\s–\s|\s—\s)\s*(.+)$/);
    return m?`<div class="ov-note-row"><span class="ov-note-k">${e(m[1])}</span><span class="ov-note-v">${e(m[2])}</span></div>`
            :`<div class="ov-note-row"><span class="ov-note-v">${e(l)}</span></div>`;
  }).join("");
}
const OVL_SCALE_PARTS=[
  {key:"head",  label:"nagłówek"},
  {key:"pose",  label:"orientacja"},
  {key:"front", label:"przód kapsla"},
  {key:"note",  label:"notatka gracza"},
  {key:"motion",label:"ruch"},
  {key:"press", label:"naciśnięcia"},
  {key:"pad",   label:"kontroler"},
  {key:"wheel", label:"koło wyboru"},
  {key:"rules", label:"wyzwalacze"},
  {key:"graph", label:"wykres"},
  {key:"midi",  label:"MIDI"},
];
const OVL_OUTLINES=[
  {k:"dark",  label:"Ciemny", hint:"Czarna poświata — czytelne nad jasną grą"},
  {k:"light", label:"Jasny",  hint:"Biała poświata — czytelne nad ciemną grą"},
  {k:"dcol",  label:"Kapsla", hint:"Poświata w kolorze tego kapsla"},
  {k:"none",  label:"Brak",   hint:"Bez poświaty — najczyściej, ale nad jasną grą bywa nieczytelne"},
];
const OVL={cfg:null, state:null, _saveT:null, _sent:"", _bar:-1, _dragging:false,
           _dirty:false, _online:true};

// The app does not use native tooltips: rf-05 strips every [title] into [data-rftip] and mirrors it
// to aria-label ONCE, when it first sees the element. Assigning .title later therefore updates
// nothing a user can see, and leaves a screen reader reading the first version for ever. So a
// tooltip that CHANGES is written in the converted form directly.
function ovlTip(el,text){
  if(!el)return;
  el.setAttribute("data-rftip",text);
  el.setAttribute("aria-label",text);
  el.removeAttribute("title");
}

// Both of these answer null when the app is not there. That used to be swallowed in silence, and
// silence is the worst possible answer here: the size slider is the ONLY control that works without
// the server (it is plain CSS zoom), so a dropped connection looks exactly like "the transparency
// slider is broken and the browser frame will not go away". Now the overlay says so.
// With a window id: that one window (`j.window`) — what an overlay asks for. Without: everything
// there is (`j.windows`), which is what the panel draws its buttons from.
function ovlGet(win){
  return fetch("/overlay"+(win?("?win="+encodeURIComponent(win)):""))
    .then(r=>r.json()).then(j=>(ovlOnline(true),j)).catch(()=>(ovlOnline(false),null));
}
function ovlPost(body){
  return fetch("/overlay",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify(body)}).then(r=>r.json()).then(j=>(ovlOnline(true),j)).catch(()=>(ovlOnline(false),null));
}
function ovlOnline(ok){
  if(OVL._online===ok)return;
  OVL._online=ok;
  const bar=document.getElementById("ovlBar"); if(bar)bar.classList.toggle("ovl-offline",!ok);
  const n=document.getElementById("ovlOffNote"); if(n)n.style.display=ok?"none":"";
  if(typeof ovlNotes==="function")try{ovlNotes();ovlReportGrab();}catch(e){}
}

// ---------------------------------------------------------------------------
//  ROLE 1 — inside an overlay window (one capsule)
// ---------------------------------------------------------------------------
if(RF_OVL){
  // READ-ONLY, and enforced rather than promised. This window runs the whole panel's code, which
  // saves things: the axis calibration, the motion config, the UI language. A second window doing
  // that in the background is how one capsule's settings end up written over another's — it has
  // happened here before, and with one window PER CAPSULE there are now several of them. So every
  // request that is not a plain read is refused at the door, with the single exception of /overlay,
  // which is how this window is steered at all.
  //
  // It resolves with a normal-looking answer instead of rejecting: a caller awaiting a POST it will
  // never get is a hung promise, and there are dozens of them in the panel's code.
  const _ovlFetch=window.fetch.bind(window);
  window.fetch=function(url,opts){
    const m=(((opts||{}).method||"GET")+"").toUpperCase();
    const u=(typeof url==="string")?url:"";
    if(m!=="GET"&&m!=="HEAD"&&u.split("?")[0]!=="/overlay"){
      try{console.debug("[nakładka] pominięto zapis:",m,u);}catch(e){}
      return Promise.resolve(new Response('{"ok":false,"overlay":true}',
        {status:200,headers:{"Content-Type":"application/json"}}));
    }
    return _ovlFetch(url,opts);
  };

  // The window's title is how the server finds THIS window among every other one open on the
  // machine — it hunts for the one-off marker it put in the address. Without it there is no way to
  // tell our window from the user's browser (or from the other capsule's overlay), and nothing can
  // be made to float.
  try{
    const mk=new URLSearchParams(location.search).get("mark")||"";
    document.title="RibbitFlip"+(mk?(" · "+mk):"");
  }catch(e){}

  // Every request this window makes names ITSELF, not its capsule: with two overlays of the same
  // capsule open, `dev` alone would have both of them writing over one set of settings — the exact
  // trap the read-only wrapper above was put in for. `dev` still travels for the one action that is
  // about the capsule rather than about this window ("give me one more").
  // Miniatura w panelu NIE PISZE NIC. Cały ten plik jest napisany tak, że okno steruje sobą samo,
  // a w podglądzie każde takie „sterowanie" byłoby ustawieniem, o które nikt nie prosił: zmierzoną
  // ramką ramki, pozycją paska, którego nie ma. Odcięcie jest w JEDNYM miejscu, bo wszystkie
  // zapisy tego okna i tak przechodzą tędy.
  function ovlSend(body){
    if(RF_OVL_PREVIEW)return Promise.resolve({ok:false,preview:true});
    return ovlPost(Object.assign({win:RF_OVL_WIN,dev:RF_OVL_DEV},body));
  }

  // ---- applying the configuration ----------------------------------------
  function ovlApply(cfg){
    if(!cfg)return;
    OVL.cfg=cfg;
    // FIRST, BECAUSE EVERYTHING BELOW WRITES INTO IT. The bar is a setting like any other now
    // (`winBar`), so it is put up or taken down here rather than once at load — and the rest of
    // this function then fills in whichever controls exist. Every read below is already guarded
    // with `if(el)`, which is what makes a missing bar an ordinary state instead of a crash.
    ovlBarSync(cfg.winBar!==false);
    {const nh=ovlNoteHtml(cfg.note||""); for(const n of document.querySelectorAll(".ov-note"))if(n.innerHTML!==nh)n.innerHTML=nh;}
    document.documentElement.setAttribute("data-theme",cfg.theme||"bare");
    document.documentElement.classList.toggle("ovl-bg",!!(cfg.show&&cfg.show.bg));
    for(const b of document.querySelectorAll(".ovl-theme"))b.classList.toggle("on",b.dataset.theme===(cfg.theme||"bare"));
    // The outline only exists where there is no card, so its row only exists there too — a control
    // that cannot do anything is worse than no control (see the transparency slider below).
    const outl=cfg.outline||"dark";
    document.documentElement.setAttribute("data-outline",outl);
    // JEDYNE MIEJSCE, W KTÓRYM TOKENY MOTYWU SIĘ ZMIENIAJĄ. `data-theme` i `data-outline`
    // przestawiają --line/--dim/--muted/--ink/--panel/--bg2 (15-overlay.css), a `cv()`
    // (rf-00) pamięta odczytane wartości — bez tego czyszczenia ściąga rysowałaby się
    // kolorami poprzedniego wyglądu.
    // WHY: cv() is memoized; this is the one place the palette underneath it changes.
    if(typeof cvReset==="function")cvReset();
    for(const b of document.querySelectorAll(".ovl-outline"))b.classList.toggle("on",b.dataset.outline===outl);
    for(const b of document.querySelectorAll(".ovl-ball"))b.classList.toggle("on",b.dataset.ball===(cfg.ball||"kula"));
    {const row=document.getElementById("ovlOutlineRow");
     if(row)row.style.display=((cfg.theme||"bare")==="bare"&&!(cfg.show&&cfg.show.bg))?"":"none";}
    // SIZE ZOOMS THE CONTENT, NOT THE BAR. Zooming <body> put the bar inside the zoom, so dragging
    // the size slider moved and resized the slider under the cursor — the value then jumped
    // wherever the pointer happened to land. The bar is chrome; only the cheat sheet scales.
    const host=document.querySelector(".wrap");
    const z=Math.max(60,Math.min(200,+cfg.scale||100))/100;
    if(host)host.style.zoom=z; else document.body.style.zoom=z;
    // `zoom` nie rusza `clientWidth`, więc ResizeObserver z rf-09 o tej zmianie nie wie, a bez
    // przemierzenia płótna zostają w rozdzielczości sprzed zmiany (przy 200 % kula robi się miękka).
    if(typeof fitZoomSync==="function")requestAnimationFrame(fitZoomSync);
    const sc=document.getElementById("ovlScale"); if(sc&&document.activeElement!==sc)sc.value=cfg.scale;
    const op=document.getElementById("ovlOpacity");
    const scv=document.getElementById("ovlScaleV"); if(scv)scv.textContent=cfg.scale+"%";
    // SZEROKOŚĆ UKŁADU — drugi suwak obok „Rozmiaru". Sam nie rusza oknem: zmienia liczbę, którą
    // `ovlMeasure` weźmie do szerokości, a `ovlAutoFit` (wołany po `ovlApply`) dosyła ją oknu.
    {const bw=ovlBaseW(cfg.baseW);
     const wd=document.getElementById("ovlWidth"); if(wd&&document.activeElement!==wd)wd.value=bw;
     const wdv=document.getElementById("ovlWidthV"); if(wdv)wdv.textContent=bw+" px";}
    // PRZEZROCZYSTOŚĆ ROBI WINDOWS, A NIE STRONA (2026-08-31, po zgłoszeniu „przezroczystość nie
    // działa; w jednej ze starszych wersji na bank działała dobrze").
    //
    // Działała — bo tamta wersja (08-23) przy ruchu suwakiem WŁĄCZAŁA tło i okno gasło prawdziwą
    // alfą warstwową. Potem tło przestało się włączać samo (słusznie: to wyglądało na skok w inny
    // tryb), a w zamian przygaszała strona: `opacity` na całej treści. Nad grą to nie jest
    // przezroczystość, tylko MIESZANIE z kolorem dziury — treść po prostu ciemniała.
    //
    // Zmierzone tego samego dnia na żywym oknie: `LWA_COLORKEY | LWA_ALPHA` działają NARAZ —
    // wycięte tło zostaje wycięte przy każdej alfie, a to, co narysowane, gaśnie liniowo (liczby
    // w `_apply` w ribbitflip_monitor.py). Cała ta obudowa jest więc niepotrzebna: suwak jedzie
    // wprost do okna, a strona nie przygasza NICZEGO. Ani `.wrap`, ani karty — bo każde takie
    // przygaszenie dokładałoby się do alfy okna i 50% dawałoby 25%.
    const hasBg=!!(cfg.show&&cfg.show.bg);
    const effOp=Math.max(20,Math.min(100,+cfg.opacity||100));
    // …CHYBA ŻE TO MINIATURA W PANELU — tam nie ma okna, więc nie ma czemu wysłać alfy i suwak
    // byłby jedyną kontrolką bez skutku. Przygaszamy więc stronę, ale TYLKO tutaj: w prawdziwym
    // oknie ta sama linia zeruje `opacity`, bo przygaszenie strony dokładałoby się do alfy okna
    // i 50% dawałoby 25% (pomiar z 2026-08-31).
    if(host)host.style.opacity=RF_OVL_PREVIEW?String(effOp/100):"";
    if(op&&document.activeElement!==op)op.value=effOp;
    const opv=document.getElementById("ovlOpacityV");
    if(opv)opv.textContent=effOp+"%";
    // Jedno zdanie o tym, co suwak robi — i o tym, czego NIE rusza: wycięte tło zostaje wycięte,
    // więc dookoła treści widać grę tak samo przy 100%, jak przy 20%.
    {const oh=document.getElementById("ovlOpacityHint");
     if(oh)oh.textContent=hasBg
       ? _cvT("Przygasza całe okienko razem z jego tłem.")
       : _cvT("Przygasza treść okna; tło jest wycięte, więc grę widać zawsze.");}
    // EVERY PART'S OWN SIZE — as custom properties on the root, which the stylesheet turns into a
    // zoom on each block (see 15-overlay.css). Written even when the drawer is hidden: the sliders
    // are just a way of setting these, and hiding them must not stop them applying.
    {const sp=cfg.scaleParts||{}, root=document.documentElement;
     for(const p of OVL_SCALE_PARTS){
       const v=Math.max(40,Math.min(250,+sp[p.key]||100));
       root.style.setProperty("--sc-"+p.key,(v/100).toFixed(2));
       const sl=document.querySelector('.ovl-pscale[data-part="'+p.key+'"]');
       if(sl&&document.activeElement!==sl)sl.value=v;
       const lb=document.querySelector('[data-val="'+p.key+'"]');
       if(lb)lb.textContent=v+"%";
     }}
    {const tk=document.getElementById("ovlBgTick");
     if(tk&&document.activeElement!==tk)tk.checked=hasBg;}
    {const tk=document.getElementById("ovlBarTick");
     if(tk&&document.activeElement!==tk)tk.checked=(cfg.winBar!==false);}
    // WIELKOŚĆ — ODCZYT, NIE USTAWIENIE. Skąd się bierze, mówi zdanie pod spodem: szerokość
    // z „Rozmiaru całości", wysokość z tego, co w oknie stoi (patrz `ovlAutoFit`).
    {const w=Math.round(+cfg.w||0), h=Math.round(+cfg.h||0);
     const dpr=window.devicePixelRatio||1;
     const v=document.getElementById("ovlWhV");
     if(v)v.textContent=(w&&h)?(Math.round(w/dpr)+" × "+Math.round(h/dpr)+" px"):"—";
     const nt=document.getElementById("ovlWhNote");
     if(nt)nt.textContent=_cvT("Okno dopasowuje się samo: szerokość idzie za „Szerokością” i „Rozmiarem całości”, wysokość za tym, co w nim włączone.");}
    // Never while it is being typed in: the heartbeat re-reads the settings every two seconds, and
    // a field rewritten under the cursor is a field you cannot finish a word in.
    {const nm=document.getElementById("ovlLabel");
     if(nm&&document.activeElement!==nm)nm.value=cfg.label||"";}
    const th=document.getElementById("ovlThru"); if(th)th.classList.toggle("on",!!cfg.clickThrough);
    ovlNotes();                     // the drawer opens below whatever is showing; so does the strip
    OVL._pin=null; ovlPinState(!!OVL._pinMeasured);   // "asked for" just changed — redraw the pin
    // Switching clicks through leaves the drawer standing open over the game — and with the content
    // no longer taking the mouse, nothing can close it: no click lands in it, no pointer ever
    // leaves it. So it is put away at the moment the switch goes on. Only on the CHANGE: this runs
    // on every poll, and closing it every time would make the drawer impossible to keep open, which
    // is exactly where the switch back lives.
    const thru=!!cfg.clickThrough;
    {const b=document.getElementById("ovlBar"); if(b)b.classList.toggle("ovl-thru",thru);}
    if(thru!==OVL._thru){OVL._thru=thru; if(thru)ovlSetOpen(false);}
    // The activation graphs are the panel's "Szczegóły" view — one global switch there, so it
    // follows this window's own choice (this window shows exactly one capsule).
    const wantGraph=!!(cfg.show&&cfg.show.graph);
    if(typeof state!=="undefined"&&!!state.detailView!==wantGraph&&typeof setDetailView==="function"){
      setDetailView(wantGraph);            // re-renders the rows with (or without) the canvases
    }
    for(const c of document.querySelectorAll(".ovl-chip[data-part],.ovl-eye[data-part]")){
      const on=!!(cfg.show&&cfg.show[c.dataset.part]);
      c.classList.toggle("on",on);
      if(c.classList.contains("ovl-eye"))c.setAttribute("aria-pressed",on?"true":"false");
    }
    // The whole row dims with its part, so the list reads as what the overlay is currently made of.
    for(const r of document.querySelectorAll(".ovl-el[data-part]"))
      r.classList.toggle("off",!(cfg.show&&cfg.show[r.dataset.part]));
    ovlColumns();
    // Ustawienia wlasnie zmienily to, co w oknie stoi i jak duze — wiec zmienily tez wielkosc
    // samego okna. Z opoznieniem, bo suwak „Rozmiar calosci" leci kilkadziesiat razy na sekunde.
    ovlAutoFit();
  }
  // KOLEJNOŚĆ BLOKÓW W KOLUMNIE (2026-09-01). Kolumna jest w nakładce pudełkiem `flex`
  // (15-overlay.css), więc przestawianie to nadanie każdemu dziecku `order`.
  //
  // ⚠️ NIE KAŻDE DZIECKO KOLUMNY JEST BLOKIEM. Obok kuli stoi uchwyt do zmiany jej wysokości, pod
  // rysunkiem koła spis wycinków, a rysunek pada ma własną obudowę — i to wszystko ma jechać RAZEM
  // ze swoim blokiem. Dlatego nie przypisujemy porządku „blokom", tylko idziemy po dzieciach
  // w kolejności, w jakiej stoją: element rozpoznany zaczyna nową grupę, a każdy nierozpoznany
  // dokleja się do poprzedniej. Bez tego uchwyt kuli zostawałby na miejscu, gdy kula odjeżdża.
  const OVL_ORDER_SEL={head:".ov-head", pose:".ov-pose", front:".ov-front", note:".ov-note", motion:".ov-mouse", press:".ov-press",
    pad:".ov-padbox", wheel:".ov-wheel", rules:".ov-rules", midi:".ov-midi"};
  function ovlOrderCol(col){
    const ord=ovlOrderOf(OVL.cfg);
    let cur=0, sub=0, touched=false;
    for(const el of col.children){
      let hit="";
      for(const k in OVL_ORDER_SEL){if(el.matches&&el.matches(OVL_ORDER_SEL[k])){hit=k;break;}}
      if(hit){const i=ord.indexOf(hit); cur=(i<0?ord.length:i)*100+100; sub=0; touched=true;}
      else sub++;
      const v=String(cur+sub);
      if(el.style.order!==v)el.style.order=v;
    }
    // Kolumna, w której nie rozpoznaliśmy ANI JEDNEGO bloku, to kolumna jeszcze niezbudowana —
    // zostawiamy ją w spokoju, zamiast układać ją od zera w kolejności przypadkowej.
    if(!touched)for(const el of col.children)el.style.order="";
  }

  // KTÓRY KONTROLER POKAZUJE TO OKNO (2026-09-11). Zapisany w oknie identyfikator pada jest
  // ETYKIETĄ — mówi „zrobiono je dla Kontrolera N" — a nie przynależnością: samo okno dalej należy do
  // kapsla. Kiedy tego kontrolera już nie ma w rejestrze, wracamy do pada, w który wpięty jest
  // kapsel: okno pokazujące nieistniejącego pada nie pokazywałoby niczego, a tak pokazuje prawdę.
  function ovlPadOwner(){
    const want=(OVL.cfg&&OVL.cfg.pad)||"";
    if(want&&typeof padById==="function"&&padById(want))return want;
    return (typeof gpvPadId==="function")?gpvPadId(RF_OVL_DEV):"";
  }
  // CZYJ WKŁAD WIDAĆ. Domyślnie cały kontroler; „own" to zachowanie sprzed 2026-09-11, zostawione
  // dla kogoś, kto świadomie chce w oknie tylko swój kapsel. Przy kontrolerze z jednym kapslem obie
  // odpowiedzi znaczą to samo, więc edytor tego wyboru wtedy nie pokazuje.
  function ovlPadScope(){return (OVL.cfg&&OVL.cfg.padScope==="own")?"own":"all";}
  // …i przekazanie tego rysunkowi. `data-pad` na widgecie jest JEDYNYM przełącznikiem między
  // malowaniem jednego kapsla a scalonym (gpvPaintMerged w rf-42) — ustawiane tutaj, więc panel,
  // który tego atrybutu nigdy nie stawia, zachowuje się dokładnie jak wcześniej.
  function ovlPadBox(col){
    const box=col.querySelector(".ov-padbox"); if(!box)return;
    const pid=(ovlPadScope()==="all")?ovlPadOwner():"";
    // Wpięty pojedynczo? Scalanie i tak da ten sam obraz, ale przez rejestr padów — a ten w oknie
    // nakładki bywa jeszcze pusty przez pierwsze sekundy. Zostawiamy wtedy ścieżkę kapsla.
    const mem=(pid&&typeof padMembers==="function")?padMembers(pid):[];
    const want=(mem.length>1)?pid:"";
    if((box.dataset.pad||"")!==want){
      if(want)box.dataset.pad=want; else delete box.dataset.pad;
      // Kasujemy podręczne odciski, bo obie ścieżki liczą klucz `_st` inaczej (scalona dokłada
      // kolor). Bez tego pierwsza klatka po przełączeniu nic by nie przemalowała.
      box._numV=null; box._whoV=null; box._sk=null; box._st=null;
      for(const b in (box._m||{})){const el=box._m[b]; if(el){el._st=null;el.style.removeProperty("--dcol");}}
      const who=box.querySelector(".ov-pad-who"); if(who&&!want)who.innerHTML="";
    }
  }

  // This window is ONE capsule's: every other column goes, and the switches apply to what is left.
  function ovlColumns(){
    // NO CONFIG YET MEANS SHOW EVERYTHING, not hide everything. This runs on every re-render of the
    // cheat sheet, which happens before the first read of the settings has landed — and reading
    // "off" out of an empty object switched every part off, `card` included, leaving a window with
    // nothing in it. An overlay that is briefly too full is a great deal better than one that looks
    // broken.
    const sh=(OVL.cfg&&OVL.cfg.show)||null;
    for(const col of document.querySelectorAll("#overviewWrap .ov-col")){
      const tag=col.querySelector("[data-dev]");
      const dev=tag?tag.dataset.dev:"";
      const mine=(!RF_OVL_DEV||dev===RF_OVL_DEV);
      col.style.display=mine?"":"none";
      if(!mine)continue;
      for(const p of OVL_PARTS){if(!p.invert&&p.cls)col.classList.toggle(p.cls,sh?!sh[p.key]:false);}
      ovlPadBox(col);
      ovlOrderCol(col);
    }
    // The capsule's name belongs in the bar when its own header is switched off — otherwise a
    // second overlay is an unlabelled twin of the first. And with several overlays of the SAME
    // capsule the name alone stops being an answer, so this window's own name goes next to it:
    // "Triki 1 · drążek" and "Triki 1 · klikanie" are two windows, "Triki 1" twice is a riddle.
    const t=document.getElementById("ovlWho");
    if(t){const D=(typeof state!=="undefined"&&state.devices)?state.devices[RF_OVL_DEV]:null;
      const cap=(D&&D.meta&&D.meta.name)||RF_OVL_DEV||"";
      const lab=((OVL.cfg&&OVL.cfg.label)||"").trim();
      // OKNO ZROBIONE DLA KONTROLERA MÓWI O KONTROLERZE (2026-09-11). Samo w sobie należy dalej do
      // kapsla — i tak też jest wymienione w zasobniku i w panelu, bo tam idzie LISTA OKIEN — ale
      // na własnym pasku ma nazwać to, co pokazuje. „Triki 5" nad rysunkiem, na którym świecą
      // przyciski Triki 3, byłoby podpisem pod cudzym zdjęciem.
      const pid=((OVL.cfg&&OVL.cfg.pad)||"");
      const ctl=(pid&&typeof padById==="function"&&padById(pid)&&typeof padLabel==="function")?padLabel(pid):"";
      t.textContent=ctl?ctl:(lab?(cap+" · "+lab):cap);
      // The capsule's colour goes on the ROOT, not just the name tag: every accent in this window's
      // own chrome — the drawer's switches and sliders, the corner grip, the resize frame — follows
      // it, so a green capsule's overlay is green everywhere and never wears another one's yellow.
      // The content column is unaffected: it sets its own --dcol inline, which wins.
      if(D&&D.meta&&D.meta.color){t.style.setProperty("--dcol",D.meta.color);
        document.documentElement.style.setProperty("--dcol",D.meta.color);}}
    // …i pasek wraca na szczyt ściągi. Tu, bo to jedyne miejsce wołane PO każdym odrysowaniu
    // (patrz podmiana `renderOverview` niżej) — a przy pierwszym uruchomieniu karty jeszcze nie
    // ma, więc pasek czeka w `body`. Bez zmiany rodzica nic nie robi.
    ovlBarMount();
  }

  // Saving is debounced: a slider dragged across its range would otherwise be a POST per pixel, and
  // every one of them writes the settings file.
  function ovlSave(patch,now){
    if(!OVL.cfg)return;      // the first read has not landed yet: a one-key config would hide the rest
    // `show` is merged from the OLD value, which has to be read BEFORE the top-level assign — that
    // assign replaces cfg.show wholesale with the one-key patch, and merging afterwards would be
    // merging the patch with itself. (It did: one chip click left `show` holding that single key,
    // every other part read as undefined, and the overlay went blank a piece at a time.)
    const show=patch.show?Object.assign({},(OVL.cfg&&OVL.cfg.show)||{},patch.show):null;
    // Same trap, same fix, for the per-part sizes: one slider sends one key, and a top-level assign
    // would leave `scaleParts` holding only that key — every other part reading as undefined.
    const sp=patch.scaleParts?Object.assign({},(OVL.cfg&&OVL.cfg.scaleParts)||{},patch.scaleParts):null;
    OVL.cfg=Object.assign({},OVL.cfg,patch);
    if(show)OVL.cfg.show=show;
    if(sp)OVL.cfg.scaleParts=sp;
    ovlApply(OVL.cfg);
    OVL._dirty=true;                       // the poll must not overwrite what is not yet sent
    clearTimeout(OVL._saveT);
    const send=()=>{
      OVL._sent=JSON.stringify(OVL.cfg);
      ovlSend({act:"config",config:OVL.cfg}).then(()=>{OVL._dirty=false;});
    };
    if(now)send(); else OVL._saveT=setTimeout(send,220);
  }

  // The drawer opens on a CLICK of the cog and stays open — never on hover, and never on focus.
  // Hover is right for a menu and wrong for anything you drag: leave the panel by two pixels
  // mid-gesture and the control under your hand is gone. Focus was worse — clicking the cog focuses
  // the cog, so the click meant to CLOSE the drawer did nothing visible, and it then vanished by
  // itself later when something else took the focus.
  function ovlSetOpen(on){
    const bar=document.getElementById("ovlBar"),more=document.getElementById("ovlMore");
    if(!bar||!more)return;
    bar.classList.toggle("ovl-open",on);
    more.classList.toggle("on",on);
    more.setAttribute("aria-expanded",on?"true":"false");
    ovlReportGrab();               // the drawer is part of what must keep receiving the mouse
  }
  // HOW MUCH OF THIS WINDOW HAS TO KEEP RECEIVING THE MOUSE.
  // "Pass clicks through" is a property of the whole window: with it on, every pixel is a hole —
  // including the switch that turns it off, which is how that setting used to be a one-way door.
  // The app therefore keeps the overlay's own strip solid, and only the page can say how tall that
  // strip is: the bar, or the bar and the settings drawer while that is open.
  function ovlReportGrab(){
    // No bar, nothing to keep clickable — and nothing to report. The early return is enough: the
    // server refuses a zero anyway (see set_grab) and answers `in_grab` from `winBar` itself, so
    // the last figure this window sent while it still had a bar cannot outlive it.
    const bar=document.getElementById("ovlBar"); if(!bar)return;
    const more=document.getElementById("ovlMorePanel");
    const box=((bar.classList.contains("ovl-open")&&more)?more:bar).getBoundingClientRect();
    // …plus whatever the bar is saying underneath itself. A note is text, but it sits between the
    // bar and the game, and a strip of hole in the middle of the overlay's own chrome is a place
    // where reaching for the bar clicks into the game instead.
    let bottom=box.bottom;
    for(const id of ["ovlOffNote","ovlPinNote","ovlSayNote"]){
      const n=document.getElementById(id);
      if(n&&n.style.display!=="none")bottom=Math.max(bottom,n.getBoundingClientRect().bottom);
    }
    const px=Math.round(Math.max(8,bottom+4)*(window.devicePixelRatio||1));
    if(px===OVL._grab)return;      // unchanged: no request. This is polled, and it rarely moves.
    OVL._grab=px;
    ovlSend({act:"grab",grab:px});
  }

  // The pin: what was ASKED for (cfg.onTop) and what the app MEASURED on the window (`on`). The two
  // differ in exactly one case worth shouting about — asked for and not achieved — and that is the
  // only one drawn in red. Deliberately unpinned is not a fault, so it is not.
  function ovlPinState(on){
    const p=document.getElementById("ovlPin"); if(!p)return;
    OVL._pinMeasured=!!on;         // kept so a change of "asked for" can redraw without a fresh poll
    const want=!(OVL.cfg&&OVL.cfg.onTop===false);
    const sig=on+"|"+want;
    if(OVL._pin===sig)return;
    OVL._pin=sig;
    p.classList.toggle("is-free",!want);
    p.classList.toggle("is-off",want&&!on);
    p.setAttribute("aria-pressed",want?"true":"false");
    ovlTip(p,!want?_cvT("To okno NIE jest trzymane na wierzchu, inne okna mogą je zasłonić. Kliknij, żeby je przypiąć.")
                  :(on?_cvT("To okno jest na wierzchu, nad grą i nad innymi oknami. Kliknij, żeby je odpiąć.")
                      :_cvT("Miało być na wierzchu, ale się nie udało. Inne okna mogą je zasłonić. Kliknij, żeby przestać próbować.")));
  }

  // HOW FAR DOWN THE BAR IS CURRENTLY TALKING. The notes are siblings of the bar, so the settings
  // drawer — a child of it, hung off `top:100%` — used to open straight over them: reach for the
  // switch a warning is telling you about and the warning disappears behind the drawer you opened
  // to obey it. Measured rather than assumed, because there are three of them and any combination
  // can be up. Also the number the app needs for the strip that stays clickable (ovlReportGrab).
  // SOMETHING WENT WRONG AND THIS WINDOW HAS TO SAY SO. There is no toast here — the panel's notes
  // come out of the skull in the corner, which this window hides — so an answer like "this capsule
  // already has as many overlays as it can have" would otherwise be swallowed in silence. Same
  // strip as the other two notes, and it goes away by itself: nothing in an overlay should need
  // dismissing mid-game.
  function ovlSay(text,ms){
    const n=document.getElementById("ovlSayNote"); if(!n)return;
    n.textContent=text||"";
    n.style.display=text?"":"none";
    clearTimeout(OVL._sayT);
    ovlNotes(); ovlReportGrab();
    if(text)OVL._sayT=setTimeout(()=>{n.style.display="none";ovlNotes();ovlReportGrab();},ms||6000);
  }

  function ovlNotes(){
    const bar=document.getElementById("ovlBar"); if(!bar)return 0;
    const base=bar.getBoundingClientRect().bottom;
    let bottom=base;
    for(const id of ["ovlOffNote","ovlPinNote","ovlSayNote"]){
      const n=document.getElementById(id);
      if(n&&n.style.display!=="none")bottom=Math.max(bottom,n.getBoundingClientRect().bottom);
    }
    const px=Math.max(0,Math.round(bottom-base));
    bar.style.setProperty("--ovl-notes",px+"px");
    return px;
  }

  function ovlBar(){
    const bar=document.createElement("div");
    bar.className="ovl-bar"; bar.id="ovlBar";
    // The visible strip is only a grip, whose capsule this is, and a way in and out. EVERY setting —
    // including the two sliders — lives behind the cog, which pins the drawer open: a slider in a
    // panel that closes when the pointer wanders is a slider you lose halfway through a drag.
    bar.innerHTML=
      `<span class="ovl-grip" id="ovlGrip" title="${_gl("Przeciągnij, aby przesunąć nakładkę","Drag to move the overlay")}">⠿</span>`+
      `<span class="ovl-who" id="ovlWho"></span>`+
      `<span class="ovl-spacer"></span>`+
      `<button class="ovl-pin" id="ovlPin" aria-pressed="true">${OVL_PIN_ICON}</button>`+
      `<button class="ovl-btn" id="ovlMore" title="${_gl("Ustawienia nakładki","Overlay settings")}">⚙</button>`+
      `<button class="ovl-btn ovl-x" id="ovlClose" title="${_gl("Zamknij nakładkę","Close the overlay")}">✕</button>`+
      ovlDrawer();
    ovlBarMount(bar);
    return bar;
  }

  // GDZIE STOI PASEK: NA SZCZYCIE ZAWARTOŚCI, nie nad nią (2026-09-09).
  //
  // Pasek okna stoi u szczytu zawartości i wygląda tak samo jak jej wiersze. Do tej pory pasek był pierwszym dzieckiem `body`, czyli
  // osobną pigułką stojącą w marginesie okna, z przerwą między nim a pierwszym blokiem ściągi.
  // Teraz jest PIERWSZYM WIERSZEM karty: ta sama szerokość, to samo wcięcie co bloki, a pod spodem
  // ta sama kreska (`--stitch`), którą bloki dzielą się między sobą. Kształt robi 15-overlay.css;
  // tutaj jest tylko miejsce w drzewie.
  //
  // ⚠️ KARTA, A NIE KOLUMNA. Kusi, żeby wsadzić pasek do `.ov-col`, bo to tam stoją bloki, obok
  // których ma się wyrównać. Nie wolno: `renderOverview` (rf-11) przy KAŻDYM odrysowaniu robi
  // `wrap.innerHTML=""`, więc pasek zniknąłby razem z kolumnami — a z nim otwarta pod ręką
  // szuflada, wszystkie nasłuchy i pomiar klikalnego paska. `#overviewCard` buduje się raz (rf-34)
  // i odrysowanie ściągi go nie rusza.
  //
  // Wołane także z `ovlColumns`, czyli po każdym odrysowaniu i po każdym `ovlApply`: pasek powstaje
  // ZANIM panel się zbuduje (niesie komunikat „brak połączenia z RibbitFlip", jedyną odpowiedź,
  // jaką to okno ma na nieudane odpytanie), więc pierwszy raz ląduje w `body` i dopiero stamtąd
  // przenosi się na kartę. Ten sam wyjątek trzyma go na miejscu, gdyby karta kiedyś powstała
  // od nowa.
  function ovlBarMount(bar){
    bar=bar||document.getElementById("ovlBar"); if(!bar)return;
    const host=document.getElementById("overviewCard")||document.body;
    if(bar.parentElement===host&&bar.previousElementSibling===null)return;   // już stoi na swoim
    host.insertBefore(bar,host.firstChild);
    // Paski komunikatów są RODZEŃSTWEM paska, nie jego dziećmi (patrz `ovlBarWire`), więc same by
    // za nim nie poszły — zostałyby wiszące nad kartą, oderwane od paska, którego dotyczą.
    let after=bar;
    for(const id of ["ovlOffNote","ovlPinNote","ovlSayNote"]){
      const n=document.getElementById(id); if(!n)continue;
      after.insertAdjacentElement("afterend",n); after=n;
    }
  }

  // PASEK JEST USTAWIENIEM, NIE STAŁYM ELEMENTEM STRONY (2026-09-03). Wyłączony `winBar` znaczy:
  // tego okna nie da się ani chwycić, ani otworzyć w nim szuflady — więc paska po prostu NIE MA
  // w drzewie. Nie `display:none`: schowany pasek dalej stałby w układzie (jest `sticky`, patrz
  // `ovlMeasure`), dalej łapałby zdarzenia i dalej meldowałby swoją wysokość jako klikalny pasek
  // przy przepuszczaniu kliknięć. Usunięty nie robi żadnej z tych trzech rzeczy.
  //
  // Buduje się z powrotem tak samo, jak przy starcie — ten sam `ovlBar()` i te same nasłuchy —
  // bo stan paska mieszka w configu, a nie w elemencie: `ovlApply` przepisuje go do świeżych
  // kontrolek zaraz po tej linii.
  function ovlBarSync(want){
    // Okno KOŁA nie ma paska niezależnie od ustawienia i nigdy go nie dostanie — jego miejsce
    // wyznacza kursor, a klikalny pasek pod wskaźnikiem zjadałby kliknięcie zatwierdzające wybór
    // (patrz RF_OVL_WHEEL wyżej i `in_grab` w ribbitflip_monitor.py). Warunek stoi TUTAJ, a nie
    // w wołających, bo woła to i start strony, i każde `ovlApply`.
    if(RF_OVL_WHEEL)want=false;
    const have=document.getElementById("ovlBar");
    if(!!have===!!want)return;
    if(want){
      const bar=ovlBar();
      if(!RF_OVL_PREVIEW)ovlBarWire(bar);
      // Świeży pasek nie wie, że aplikacja właśnie milczy — a to jedyny stan, który ten pasek
      // niesie SAM z siebie, a nie z configu (config przy braku aplikacji nie przychodzi).
      if(!OVL._online){bar.classList.add("ovl-offline");
        const n=document.getElementById("ovlOffNote"); if(n)n.style.display="";}
      return;
    }
    // Razem z paskiem odchodzą jego paski komunikatów: są jego rodzeństwem w DOM, a nie dziećmi
    // (patrz `ovlBarWire`), więc same by po nim zostały — trzy puste linijki nad ściągą.
    for(const id of ["ovlOffNote","ovlPinNote","ovlSayNote"]){
      const n=document.getElementById(id); if(n)n.remove();
    }
    have.remove();
    // Serwer trzyma ostatnią zgłoszoną wysokość klikalnego paska; bez paska nie ma czego trzymać
    // solidnego, a niewidzialny prostokąt zjadający kliknięcia nad grą byłby najgorszą możliwą
    // pamiątką. Zerujemy u siebie, żeby ponowne włączenie paska wysłało pomiar od nowa; serwer
    // domyka to po swojej stronie (`in_grab` odpowiada „nie" dla okna bez paska).
    OVL._grab=0;
  }

  // THE DRAWER, in three named sections instead of one wall of thirty controls.
  //   Elementy — ONE row per part: the eye that shows or hides it and the slider that sizes it,
  //              side by side. They used to be two controls a screen apart (a chip in "Pokaż" and a
  //              slider in a grid below), which meant finding the same thing twice; and the row is
  //              also where "which one is 'opis'?" gets answered — hovering it lights the real part
  //              up on the cheat sheet itself (see the mouseover handler in ovlBar).
  //   Wygląd  — what it looks like: the three looks as little PICTURES rather than three words, the
  //             outline (only in "content only"), the backdrop, and transparency with its one
  //             Windows caveat written under it in plain text instead of buried in a tooltip.
  //   Okno    — things about the window itself: overall size, fit, clicks passing through.
  // Gone entirely: "ukryj suwaki skali" — a control for hiding controls is the symptom of the wall
  // this replaces, and with the sliders folded into the rows there is nothing left to hide.
  function ovlDrawer(){
    // One row per part. `sub` indents it: the graph lives INSIDE the rule list, and the row saying
    // so reads faster than any label could.
    const elRow=(key,label,sub)=>
      `<div class="ovl-el${sub?" ovl-el-sub":""}" data-part="${key}">`+
        `<button class="ovl-eye on" data-part="${key}" aria-pressed="true" title="${_cvT("Pokaż lub ukryj:")} ${_cvT(label)}">${OVL_EYE_ICON}</button>`+
        `<span class="ovl-el-lbl">${_cvT(label)}</span>`+
        `<input type="range" class="ovl-pscale" data-part="${key}" min="40" max="250" step="5" title="${_cvT("Rozmiar tego elementu — mnoży się z rozmiarem całości")}">`+
        `<span class="ovl-val" data-val="${key}">100%</span></div>`;
    return `<div class="ovl-more" id="ovlMorePanel">`+
      `<div class="ovl-sec"><span>${_cvT("Elementy")}</span><i></i><em>${_cvT("najedź na wiersz — element mignie w nakładce")}</em></div>`+
      // JEDEN WIERSZ NA BLOK — i tylko na blok. Drobiazgi (opis reguły, liczby pod kulą, paski
      // naciśnięć) mają swoje miejsce w edytorze w panelu, pod blokiem, do którego należą; tutaj
      // byłyby czternastym jednakowym wierszem w pasku szerokim na jedną kolumnę. Lista jest
      // liczona z kanonu (OVL_BLOCKS), więc część dołożona tam pojawia się i tu.
      `<div class="ovl-els" id="ovlEls">`+
        OVL_BLOCKS.map(p=>elRow(p.key,p.label)).join("")+
      `</div>`+
      `<div class="ovl-hint">${_cvT("Szczegóły każdego elementu — i kolejność — ustawisz w panelu, na ekranie „Nakładka”.")}</div>`+
      `<div class="ovl-sec"><span>${_cvT("Wygląd")}</span><i></i></div>`+
      `<div class="ovl-themes" id="ovlThemeRow">`+
        OVL_THEMES.map(t=>`<button class="ovl-theme" data-theme="${t.k}" title="${_cvT(t.hint)}">`+
          `<span class="ovl-thumb ovl-thumb-${t.k}" aria-hidden="true"><b></b><b></b><b></b></span>`+
          `<span class="ovl-th-lbl">${_cvT(t.label)}</span></button>`).join("")+
      `</div>`+
      // Only shown in "content only": in the other two looks there is a card behind the letters
      // and nothing for an outline to do.
      `<div class="ovl-row" id="ovlOutlineRow"><span class="ovl-lbl">${_cvT("Obrys:")}</span>`+
        OVL_OUTLINES.map(o=>`<button class="ovl-pill ovl-outline" data-outline="${o.k}" title="${_cvT(o.hint)}">${_cvT(o.label)}</button>`).join("")+
      `</div>`+
      // KULA ALBO KAPSEL (rf-14d). Ustawienie okna, nie przeglądarki: nakładka ma własny profil,
      // więc wybór z panelu by tu nie dojechał.
      `<div class="ovl-row" id="ovlBallRow"><span class="ovl-lbl">${_cvT("Orientacja:")}</span>`+
        `<button class="ovl-pill ovl-ball" data-ball="kula" title="${_cvT("Kula z siatką osi")}">${_cvT("Kula")}</button>`+
        `<button class="ovl-pill ovl-ball" data-ball="kapsel" title="${_cvT("Model kapsla — strzałka cyjan to przód")}">${_cvT("Kapsel")}</button>`+
      `</div>`+
      `<label class="ovl-tick"><input type="checkbox" id="ovlBgTick"> ${_cvT("Przyciemnione tło pod treścią")}</label>`+
      `<div class="ovl-row ovl-slrow" id="ovlOpacityRow"><span class="ovl-fl">${_cvT("Przezroczystość")}</span>`+
        `<input type="range" id="ovlOpacity" min="20" max="100" step="1">`+
        `<span class="ovl-val" id="ovlOpacityV">90%</span></div>`+
      // Treść tej podpowiedzi zależy od wyglądu i od tła, więc wpisuje ją `ovlApply` przy każdym
      // rysowaniu — tu zostaje pusty element (patrz „PRZEZROCZYSTOŚĆ DOTYCZY TŁA" tamże).
      `<div class="ovl-hint" id="ovlOpacityHint"></div>`+
      `<div class="ovl-sec"><span>${_cvT("Okno")}</span><i></i></div>`+
      // THE NAME. It only matters once a capsule has more than one overlay — and then it matters in
      // three places at once (this bar, the panel's buttons, the tray menu), which is why it is a
      // setting of the window rather than a note to self. Left blank, a window is called by its
      // number, and that is a perfectly good answer for anyone who never wanted to name it.
      `<div class="ovl-row ovl-namerow"><span class="ovl-fl">${_cvT("Nazwa tej nakładki")}</span>`+
        `<input type="text" id="ovlLabel" maxlength="24" placeholder="${_cvT("np. drążek, klikanie")}" `+
          `title="${_cvT("Po co ta nazwa: gdy kapsel ma kilka nakładek, to ona je rozróżnia — w pasku, w panelu i w menu przy zegarku")}"></div>`+
      `<div class="ovl-row ovl-slrow"><span class="ovl-fl">${_cvT("Rozmiar całości")}</span>`+
        `<input type="range" id="ovlScale" min="60" max="200" step="5">`+
        `<span class="ovl-val" id="ovlScaleV">100%</span></div>`+
      // SZEROKOŚĆ UKŁADU (2026-09-07) — nie szerokość okna w pikselach (tej nadal nie ma, patrz niżej),
      // tylko ile miejsca w poziomie dostaje treść; okno liczy z tego swoją szerokość samo.
      `<div class="ovl-row ovl-slrow"><span class="ovl-fl">${_cvT("Szerokość")}</span>`+
        `<input type="range" id="ovlWidth" min="${OVL_BASE_W_MIN}" max="${OVL_BASE_W_MAX}" step="10" `+
          `title="${_cvT("Ile miejsca w poziomie ma treść. Wąsko — opisy reguł się zawijają; szeroko — rysunki dostają powietrze. Wysokość okno dobiera samo.")}">`+
        `<span class="ovl-val" id="ovlWidthV">400 px</span></div>`+
      // WIELKOŚĆ JEST WYNIKIEM, NIE USTAWIENIEM (2026-09-01): wysokość i szerokość dopasowują się
      // automatycznie do parametrów, więc uchwyt w prawym dolnym rogu odpada. Stały tu proporcje, dwa pola liczbowe i przycisk „Dopasuj do zawartości" — trzy
      // sposoby na tę samą rzecz, z których każdy dawał okno większe niż to, co w nim stoi. A nad
      // grą nadmiarowe okno nie jest niewidoczne, tylko NIEKLIKALNE: tło jest wycięte, więc pustego
      // marginesu nie widać, ale mysz w niego wpada. Zostaje sam odczyt.
      // data-i18n-en: „Wielkość" is „Metric" in the shared dictionary (MIDI metric) — here it is a window's size;
      // the walker honours the attribute in both directions, a composed _gl() would not (drawer is built once)
      `<div class="ovl-row ovl-wh"><span class="ovl-fl" data-i18n-en="Size">Wielkość</span>`+
        `<span class="ovl-val ovl-whv" id="ovlWhV">—</span></div>`+
      `<div class="ovl-hint" id="ovlWhNote"></div>`+
      `<div class="ovl-row">`+
        `<button class="ovl-btn" id="ovlThru" title="${_cvT("Kliknięcia trafiają do gry, nie do nakładki. Ten pasek zostaje klikalny, więc możesz to tu wyłączyć.")}">🖱 ${_cvT("Przepuszczaj kliknięcia")}</button>`+
      `</div>`+
      // THE BAR ITSELF, as a switch — and the only one in this drawer that takes the drawer away
      // with it. Ticked off, this window loses its whole strip: nothing to grab, no cog, no pin, no
      // ✕, and no piece of it that keeps catching the mouse while clicks pass through. That is the
      // point of it over a game. It is a one-way door FROM HERE on purpose (there is nothing left
      // to click afterwards), so the sentence under it says where the way back is instead of the
      // switch pretending it can be undone.
      `<label class="ovl-tick"><input type="checkbox" id="ovlBarTick"> ${_cvT("Pasek okna (uchwyt do przesuwania i ⚙)")}</label>`+
      `<div class="ovl-hint">${_cvT("Bez paska tego okna nie przesuniesz ani nie ustawisz stąd — wszystko robi się wtedy na ekranie „Nakładka” w panelu. Z powrotem włączysz go tylko tam.")}</div>`+
      // ONE MORE WINDOW FOR THIS CAPSULE, from inside the window it will be a sibling of. This is
      // where the thought happens: you are looking at an overlay carrying six parts, you want the
      // stick over on the left and the trigger list where it is, and what you need is a second
      // window to move the stick into. It opens as a copy of this one — so you TAKE AWAY what does
      // not belong in it rather than build it up from nothing — and it appears offset, not on top
      // of this one, or nothing would look like it had happened.
      `<div class="ovl-row"><button class="ovl-btn ovl-add-btn" id="ovlAdd" `+
        `title="${_cvT("Kolejne okienko tego kapsla — z własnym miejscem i własną zawartością")}">`+
        `＋ ${_cvT("Nowa nakładka")}</button></div>`+
    `</div>`;
  }

  function ovlBarWire(bar){
    const off=document.createElement("div");
    off.className="ovl-note ovl-bad"; off.id="ovlOffNote"; off.style.display="none";
    off.textContent=_gl("Brak połączenia z RibbitFlip — suwaki i przełączniki nie zadziałają.",
                        "No connection to RibbitFlip — the sliders and switches will not do anything.");
    bar.insertAdjacentElement("afterend",off);

    const pin=document.createElement("div");
    pin.className="ovl-note ovl-bad"; pin.id="ovlPinNote"; pin.style.display="none";
    pin.textContent=_gl("Nie udało się przypiąć tego okna na wierzchu — zamknij nakładkę i otwórz ją ponownie.",
                        "This window could not be pinned on top — close the overlay and open it again.");
    off.insertAdjacentElement("afterend",pin);

    // …and the strip this window answers on (see ovlSay). Empty and hidden until it has something
    // to report.
    const say=document.createElement("div");
    say.className="ovl-note ovl-bad"; say.id="ovlSayNote"; say.style.display="none";
    pin.insertAdjacentElement("afterend",say);

    // NO NOTE FOR "clicks pass through". It used to say so in a yellow strip across the top, which
    // is a paragraph of text in a window whose whole point is to be glanced at — and it repeated
    // what the bar already shows: while clicks are going to the game the bar keeps its yellow edge
    // and stops fading, and the switch that undoes it is one hover away, in the drawer it came from.
    // NIE MA TU JUŻ ROGU DO CIĄGNIĘCIA. Stał w prawym dolnym rogu i zmieniał obie liczby naraz;
    // od 2026-09-01 okno mierzy się samo (patrz `ovlAutoFit`), więc nie ma czego ciągnąć — a róg,
    // który zmienia coś, co zaraz wróci na swoje, byłby gorszy niż jego brak. Razem z nim odeszła
    // ramka pokazywana w trakcie ciągnięcia i pasek z liczbami pod kursorem.

    // One listener for every switch and pill in the drawer — the eye, the two word-chips, the look
    // thumbnails and the outline pills all carry their answer in a data attribute.
    const moreP=document.getElementById("ovlMorePanel");
    moreP.addEventListener("click",e=>{
      const sw=e.target.closest(".ovl-eye,.ovl-chip");
      if(sw){ovlSave({show:{[sw.dataset.part]:!((OVL.cfg&&OVL.cfg.show)||{})[sw.dataset.part]}});return;}
      const th=e.target.closest(".ovl-theme");
      if(th){ovlSave({theme:th.dataset.theme},true);return;}
      const ou=e.target.closest(".ovl-outline");
      if(ou){ovlSave({outline:ou.dataset.outline},true);return;}
      const bl=e.target.closest(".ovl-ball");
      if(bl){ovlSave({ball:bl.dataset.ball},true);return;}
    });
    // Per-part size. Debounced like the window scale (the default path in ovlSave): this is CSS on
    // this page, so it is live under the finger; only the settings file waits.
    moreP.addEventListener("input",e=>{
      const r=e.target.closest(".ovl-pscale"); if(!r)return;
      ovlSave({scaleParts:{[r.dataset.part]:+r.value}});
    });
    // POINTING instead of explaining: hovering anything with a part on it lights the real part up on
    // the cheat sheet. The labels are single words, and no word tells you which box "opis" is —
    // the flash of the actual element does. Cleared when the pointer moves on (mouseover fires on
    // the next target, including a target with no part) and when it leaves the drawer altogether.
    let hl=null;
    const light=(part,on)=>{
      const sel=OVL_PART_SEL[part]; if(!sel)return;
      for(const el of document.querySelectorAll("#overviewWrap .ov-col "+sel))
        el.classList.toggle("ovl-hl",on);
    };
    moreP.addEventListener("mouseover",e=>{
      const t=e.target.closest("[data-part]"), p=t?t.dataset.part:null;
      if(p===hl)return;
      if(hl)light(hl,false);
      hl=p;
      if(hl)light(hl,true);
    });
    moreP.addEventListener("mouseleave",()=>{if(hl){light(hl,false);hl=null;}});
    // The backdrop, by name, in "Wygląd" — it used to be a chip called "tło" hidden among the parts,
    // which is not where anyone looks for what is behind the content.
    document.getElementById("ovlBgTick").addEventListener("change",e=>
      ovlSave({show:{bg:!!e.target.checked}},true));
    // Sent at once, like every other switch — and this one takes the drawer down with it, because
    // `ovlApply` runs on the way through and the bar this drawer hangs off stops existing.
    document.getElementById("ovlBarTick").addEventListener("change",e=>
      ovlSave({winBar:!!e.target.checked},true));
    document.getElementById("ovlScale").addEventListener("input",e=>ovlSave({scale:+e.target.value}));
    document.getElementById("ovlWidth").addEventListener("input",e=>ovlSave({baseW:+e.target.value}));
    // Below 100 % this dims whatever the overlay is currently made of: with the backdrop on, the
    // whole window fades (LWA_ALPHA); with it off, the page darkens the content itself (see
    // ovlApply). It no longer drags the backdrop in with it — dimming what is there must not
    // switch the overlay into another look.
    document.getElementById("ovlOpacity").addEventListener("input",e=>ovlSave({opacity:+e.target.value}));
    document.getElementById("ovlThru").addEventListener("click",()=>
      ovlSave({clickThrough:!(OVL.cfg&&OVL.cfg.clickThrough)},true));
    // Sent straight away rather than debounced: this one moves a window in front of (or behind)
    // whatever the person is looking at, and a fifth of a second of nothing reads as a dead button.
    document.getElementById("ovlPin").addEventListener("click",()=>
      ovlSave({onTop:(OVL.cfg&&OVL.cfg.onTop===false)},true));
    document.getElementById("ovlClose").addEventListener("click",()=>ovlSend({act:"close"}));
    // The name is typed, so it saves on the debounce like a dragged slider — a request per
    // keystroke would be a settings file written per letter. `ovlApply` never writes back into a
    // field somebody is typing in (it checks document.activeElement), so the two cannot fight.
    document.getElementById("ovlLabel").addEventListener("input",e=>
      ovlSave({label:(e.target.value||"").slice(0,24)}));
    document.getElementById("ovlAdd").addEventListener("click",e=>{
      const b=e.currentTarget; b.disabled=true;
      // `dev`, not `win`: this asks the CAPSULE for one more window. The drawer closes because the
      // new window opens over this one, and a drawer left standing open under it reads as the click
      // having done nothing here.
      ovlSend({act:"add"}).then(x=>{
        b.disabled=false;
        if(x&&x.ok===false&&x.error)ovlSay(x.error);
        else ovlSetOpen(false);
      });
    });
    const more=document.getElementById("ovlMore");
    ovlSetOpen(false);
    more.addEventListener("click",e=>{e.stopPropagation();ovlSetOpen(!bar.classList.contains("ovl-open"));});
    // NA DOKUMENCIE, WIĘC TYLKO RAZ. Pasek bywa teraz stawiany i zdejmowany w trakcie życia strony
    // (patrz `ovlBarSync`), a nasłuch dokumentu przeżywa swój pasek — dopisywany przy każdym
    // odbudowaniu rósłby o jeden komplet na każde przełączenie.
    if(!ovlBarWire._esc){
      ovlBarWire._esc=true;
      document.addEventListener("keydown",e=>{if(e.key==="Escape")ovlSetOpen(false);});
    }
    ovlDrag(bar);
    ovlReportGrab();
  }

  // ---- OKNO MIERZY SIĘ SAMO (2026-09-01) ---------------------------------
  //
  // Wielkość okna nie jest sterowana samym oknem, tylko z edytora nakładki: wysokość i szerokość
  // dopasowują się automatycznie do parametrów, więc uchwyt w prawym dolnym rogu odpada. Stąd trzy rzeczy, w tej kolejności:
  //
  //   SZEROKOŚĆ jest wyliczana, nie mierzona — `ovlAutoWidth` z „Rozmiaru całości". Zmierzyć jej
  //   się NIE DA i to nie jest przeoczenie: kolumna ściągi nie ma własnej szerokości, tylko wypełnia
  //   okno (grid `minmax(0,1fr)`), więc pomiar zwracałby dokładnie tę szerokość, którą okno już ma.
  //   Sprawdzone: przy `width:max-content` kolumna rozjeżdża się do ~700 px, bo wtedy nie zawija się
  //   ANI JEDEN opis reguły — a okno na całą szerokość opisów to nie jest „dopasowane do treści".
  //
  //   WYSOKOŚĆ jest mierzona — z karty ściągi, a nie z `documentElement.scrollHeight`. To drugie
  //   nigdy nie schodzi poniżej wysokości okna, więc okno umiałoby tylko rosnąć; karta ma wysokość
  //   swojej treści i dzięki temu zwijanie działa tak samo, jak rozwijanie.
  //
  //   ZERO PĘTLI. Zmiana wysokości okna nie zmienia wysokości treści (szerokość zostaje ta sama),
  //   więc następny pomiar daje tę samą liczbę i wysyłka się kończy. Próg 2 px zabezpiecza przed
  //   drganiem na zaokrągleniach przy skalowaniu ekranu innym niż 100%.
  function ovlMeasure(){
    const card=document.getElementById("overviewCard");
    if(!card)return null;
    // ⚠️ `bottom`, NIE `height` (poprawka 2026-09-01, zgłoszenie: „wysokość nakładki jest krótsza
    // o pasek górny menu i na dole nie starczy"). Pasek nakładki stał wtedy W UKŁADZIE nad kartą
    // i zabierał swoje kilkanaście pikseli — a wysokość samej karty o nim nic nie wiedziała. Okno
    // wychodziło więc dokładnie o pasek za niskie i ucinało dół ściągi.
    // Od 2026-09-09 pasek jest PIERWSZYM WIERSZEM karty (patrz `ovlBarMount`), więc karta liczy go
    // już w swojej wysokości. `bottom` zostaje mimo to i nie jest to zaniedbanie: liczy od górnej
    // krawędzi widoku, więc obejmuje także wszystko, co karta ma nad sobą — dziś nic, ale gdyby
    // kiedyś doszło, wysokość okna nie zacznie po cichu ucinać dołu ściągi po raz drugi.
    // `bottom` to odległość od górnej krawędzi widoku do dolnej krawędzi karty, czyli wszystko,
    // co nad grą ma się zmieścić. Strona nakładki nie przewija się (`overflow:hidden`), więc ta
    // odległość nie zależy od położenia przewinięcia.
    const hCss=card.getBoundingClientRect().bottom;
    if(!(hCss>0))return null;                    // jeszcze się nie narysowało — nie zgadujemy
    const dpr=window.devicePixelRatio||1;
    return {w:ovlAutoWidth((OVL.cfg&&OVL.cfg.scale)||100,dpr,OVL.cfg&&OVL.cfg.baseW),
            h:Math.max(120,Math.min(4000,Math.round(hCss*dpr)+2))};
  }
  let _ovlFitT=null;
  function ovlAutoFit(now){
    if(RF_OVL_PREVIEW)return;                    // patrz wyżej
    if(RF_OVL_WHEEL)return;                      // bok okna koła liczy karta „Koło wyboru"
    clearTimeout(_ovlFitT);
    const go=()=>{
      _ovlFitT=null;
      if(!OVL.cfg||OVL._dragging)return;
      const m=ovlMeasure(); if(!m)return;
      const cw=Math.round(+OVL.cfg.w||0), ch=Math.round(+OVL.cfg.h||0);
      if(Math.abs(m.w-cw)<=2&&Math.abs(m.h-ch)<=2)return;
      OVL.cfg.w=m.w; OVL.cfg.h=m.h;
      // Dwie drogi, jak przy dawnym ciągnięciu rogu: `size` rusza oknem od razu, `config` zapisuje
      // to do pliku (z opóźnieniem, bo przy suwaku „Rozmiar całości" leci tego kilkadziesiąt).
      ovlSend({act:"size",w:m.w,h:m.h});
      ovlSave({w:m.w,h:m.h});
      // Odczyt „Wielkość" w szufladzie przepisujemy TUTAJ, a nie przez `ovlApply` — tamto woła
      // z powrotem `ovlAutoFit` i robiłoby się kółko (ucichłoby po jednym obrocie, ale kółko).
      {const dpr=window.devicePixelRatio||1, v=document.getElementById("ovlWhV");
       if(v)v.textContent=Math.round(m.w/dpr)+" × "+Math.round(m.h/dpr)+" px";}
    };
    if(now)go(); else _ovlFitT=setTimeout(go,140);
  }
  // Treść zmienia wysokość z trzech powodów: przestawiono ustawienia (ovlApply), przyszły nowe
  // reguły (renderOverview) albo coś w środku urosło samo — na przykład koło wyboru, które pojawia
  // się na czas wybierania. Pierwsze dwa mają swoje miejsca, trzecie łapie obserwator.
  function ovlWatchSize(){
    if(typeof ResizeObserver!=="function")return;
    const card=document.getElementById("overviewCard"); if(!card)return;
    if(ovlWatchSize._ro)ovlWatchSize._ro.disconnect();
    ovlWatchSize._ro=new ResizeObserver(()=>ovlAutoFit());
    ovlWatchSize._ro.observe(card);
  }

  // Moving the window: the page hands over a DIFFERENCE, in physical pixels, and the server moves
  // the window by exactly that. A difference rather than a destination because the page's screenX
  // and the server's window rectangle need not be in the same coordinate space (display scaling),
  // but a difference is the same difference in both.
  //
  // The handle is the WHOLE bar. Anything you can operate on it is excluded first — a title bar you
  // can only grab by one glyph is a title bar you keep missing, and a button that starts a drag is
  // a button that does not click.
  function ovlDrag(bar){
    let last=null, pend=null, raf=0;
    const flush=()=>{raf=0; if(!pend)return; const p=pend; pend=null; ovlSend({act:"nudge",dx:p.x,dy:p.y});};
    bar.addEventListener("pointerdown",e=>{
      if(e.button!=null&&e.button!==0)return;
      if(e.target.closest&&e.target.closest("button,input,select,label,.ovl-more"))return;
      last={x:e.screenX,y:e.screenY};
      OVL._dragging=true;
      bar.classList.add("ovl-dragging");
      try{bar.setPointerCapture(e.pointerId);}catch(_){}
      e.preventDefault();
    });
    bar.addEventListener("pointermove",e=>{
      if(!last)return;
      const dpr=window.devicePixelRatio||1;
      const dx=Math.round((e.screenX-last.x)*dpr), dy=Math.round((e.screenY-last.y)*dpr);
      if(!dx&&!dy)return;
      last={x:e.screenX,y:e.screenY};
      pend=pend?{x:pend.x+dx,y:pend.y+dy}:{x:dx,y:dy};
      if(!raf)raf=requestAnimationFrame(flush);
    });
    const end=()=>{if(!last)return;last=null;OVL._dragging=false;bar.classList.remove("ovl-dragging");flush();};
    bar.addEventListener("pointerup",end);
    bar.addEventListener("pointercancel",end);
    bar.addEventListener("lostpointercapture",end);
  }

  // How tall is the browser's own title bar? Nobody here can guess it — it depends on the browser,
  // the theme and the display scaling — but the page can measure it, and the server clips exactly
  // that much away. This is what makes the overlay frameless, so it is retried until the server
  // confirms it got the number: one dropped request used to mean living with the browser's frame
  // for the rest of the session, with nothing on screen to say why.
  // How tall is the browser's own title bar? Two failure modes had to be closed at once, because
  // fixing either one alone brings the other back:
  //   • re-measuring on every resize fed a loop — the height decides where the window starts, so a
  //     new reading moved the window, which fired another resize ("the frame sometimes jumps");
  //   • measuring exactly once locked in whatever the browser happened to report mid-resize, and a
  //     window that thinks its title bar is 183 px tall clips 183 px of the cheat sheet away.
  // So: a reading counts only once it has been seen TWICE in a row, and only if it is a plausible
  // title bar in the first place. After that the question is closed until the display scaling
  // changes — which is the only thing that legitimately changes the answer.
  const OVL_BAR_MIN=8, OVL_BAR_MAX=120;    // CSS px; ~24–48 in practice, 120 covers any theme/DPI
  function ovlReportChrome(force){
    const dpr=window.devicePixelRatio||1;
    if(OVL._dpr!==dpr){OVL._bar=-1;OVL._cand=null;OVL._dpr=dpr;}   // rescaled: ask again
    if(!force&&OVL._bar>0)return;
    const css=window.outerHeight-window.innerHeight;
    if(!(css>=OVL_BAR_MIN&&css<=OVL_BAR_MAX)){OVL._cand=null;return;}
    if(OVL._cand!==css){OVL._cand=css;return;}                     // first sighting — wait for a second
    const bar=Math.round(css*dpr);
    if(bar===OVL._bar)return;
    OVL._bar=bar;
    ovlSend({act:"chrome",bar:bar});
  }

  window.addEventListener("load",function(){
    // One hook into the cheat sheet's own code, and an addition rather than a change: after a
    // re-render, drop every other capsule's column and re-apply this one's switches.
    // (Drawing the motion widget while motion control is off is the cheat sheet's own job now — it
    // checks for html.rf-ovl, see updateDetail in rf-12.)
    if(typeof renderOverview==="function"){
      const _ro=renderOverview;
      renderOverview=function(){const r=_ro.apply(this,arguments);try{ovlColumns();ovlAutoFit();}catch(e){}return r;};
    }
    // DRUGI HAK, z tego samego powodu i w tym samym stylu: wpięcie kapsla w inny kontroler nie
    // przerysowuje ściągi (zmieniają się PADY, nie reguły), a od 2026-09-11 decyduje o tym, czy
    // rysunek pada jest scalony. Bez tego drugi kapsel dołączony przy otwartej nakładce pojawiałby
    // się na niej dopiero przy najbliższej zmianie reguł.
    // ⚠️ Wpinamy się w `_padsTake`, a NIE w `onPads`: zdarzenie SSE to tylko jedna z trzech dróg,
    // którymi rejestr padów tu dociera. Pozostałe dwie — odpytanie przy starcie (`padsFetch`,
    // czyli PIERWSZE, co to okno w ogóle wie o kontrolerach) i odpowiedź na zapis (`_padsPost`) —
    // wołają je z pominięciem `onPads`.
    if(typeof _padsTake==="function"){
      const _pt=_padsTake;
      _padsTake=function(){const r=_pt.apply(this,arguments);try{ovlColumns();ovlAutoFit();}catch(e){}return r;};
    }
    // …but the wheel window gets none of that chrome (see RF_OVL_WHEEL). Everything below still
    // runs: the settings are read and applied the same way, and the title-bar measurement in
    // particular MUST stay — it is what makes the window frameless, bar or no bar.
    // PASEK JEST TAKŻE W MINIATURZE — ale martwy. Powstaje (bo nad grą naprawdę tam stoi i zabiera
    // swoje kilkanaście pikseli u góry; bez niego podgląd byłby o tyle „pustszy na dole" od okna),
    // a nie dostaje NASŁUCHÓW: chwytanie, przesuwanie i szuflada to sterowanie oknem, a miniatura
    // niczym nie steruje — konfiguracja stoi obok niej, w karcie panelu.
    // Pasek stawiamy OD RAZU, zanim przyjdą ustawienia — bo niesie także komunikat „brak połączenia
    // z RibbitFlip", czyli jedyną odpowiedź, jaką to okno ma na nieudane odpytanie. Gdy odpowiedź
    // przyjdzie i powie `winBar:false`, `ovlApply` go zdejmie (patrz `ovlBarSync`); mignięcie trwa
    // tyle, co jedno żądanie do 127.0.0.1.
    ovlBarSync(true);
    ovlGet(RF_OVL_WIN).then(s=>{if(s&&s.window){if(s.window.config)ovlApply(s.window.config);
      ovlPinState(!!s.window.hwnd&&!!s.window.top);}ovlColumns();
      // Dopiero teraz jest co mierzyć — i dopiero teraz wiadomo, jaki jest „Rozmiar całości".
      ovlWatchSize(); ovlAutoFit();});
    // WEJŚCIE DLA PANELU: „przeczytaj ustawienia TERAZ". Bez niego miniatura dowiadywałaby się
    // o ruchu suwaka z własnego odpytania co 2 s, a prośba brzmiała „aktualizuje na bieżąco".
    // Panel i miniatura są tego samego pochodzenia, więc panel woła to wprost (rf-41d) — nie ma
    // po co zakładać kanału wiadomości dla dwóch stron, które widzą swoje obiekty.
    if(RF_OVL_PREVIEW){
      window.rfOvlPreviewRefresh=function(){
        return ovlGet(RF_OVL_WIN).then(s=>{
          if(s&&s.window&&s.window.config)ovlApply(s.window.config);
          return true;
        });
      };
      // Podświetlenie części z edytora w panelu („najedź na wiersz — element mignie w nakładce”).
      // Panel nie ma jak nazwać elementu wewnątrz miniatury po swojemu — kanon selektorów
      // (OVL_PART_SEL) jest po TEJ stronie, więc i zapalanie zostaje po tej stronie.
      window.rfOvlPreviewHighlight=function(part,on){
        const sel=OVL_PART_SEL[part]; if(!sel)return;
        for(const el of document.querySelectorAll("#overviewWrap .ov-col "+sel))
          el.classList.toggle("ovl-hl",!!on);
      };
      // Wolne odpytanie mimo wszystko: ustawienia tego okna umie zmienić także szuflada ⚙ jego
      // PRAWDZIWEGO okna i menu przy zegarku, a miniatura ma pokazywać stan, nie ostatnią rzecz,
      // którą kliknięto w panelu. Rzadziej niż w oknie (3 s zamiast 2), bo tu nikt nie czeka
      // z myszą na ekranie — od tego jest `rfOvlPreviewRefresh`.
      setInterval(()=>{
        ovlGet(RF_OVL_WIN).then(s=>{
          if(!s||!s.window||!s.window.config)return;
          const j=JSON.stringify(s.window.config);
          if(j!==JSON.stringify(OVL.cfg))ovlApply(s.window.config);
        });
      },3000);
      return;                      // dalej są już same pomiary geometrii okna
    }
    // Sampled every 600 ms until a reading repeats and is accepted; then it stops asking. The
    // resize listener only exists for a change of display scaling — the size of the window itself
    // does not change how tall its title bar is.
    ovlReportChrome();
    OVL._barPoll=setInterval(()=>{
      ovlReportChrome();
      if(OVL._bar>0)clearInterval(OVL._barPoll);
    },600);
    window.addEventListener("resize",()=>{clearTimeout(OVL._rt);
      OVL._rt=setTimeout(()=>{ovlReportChrome();ovlReportGrab();},250);});
    // Heartbeat. It re-reads the settings (they can also be changed from the panel and the tray),
    // proves the app is still there, and re-sends the title-bar height if the server does not have
    // it. Never while the user is holding one of our own controls: a poll that overwrites what a
    // hand is doing is how a slider ends up fighting the person dragging it.
    setInterval(()=>{
      if(OVL._dragging||OVL._dirty)return;
      const a=document.activeElement;
      if(a&&a.closest&&a.closest("#ovlBar"))return;
      ovlReportGrab();                                       // no request unless the strip moved
      ovlGet(RF_OVL_WIN).then(s=>{
        if(!s||!s.window)return;
        if(!s.window.bar&&OVL._bar>0)ovlReportChrome(true);   // the frame is still on: ask again
        if(!s.window.grab&&OVL._grab>0){OVL._grab=0;ovlReportGrab();}   // it never arrived: again
        // "The app has this overlay running but no handle on the window" means it never found us —
        // and an unpinned window is one that sits behind things, does not fade and still wears the
        // browser's frame. Say so: guessing that from the symptoms is how a whole evening goes.
        ovlPinState(!!s.window.hwnd&&!!s.window.top);
        // …and only when it was ASKED for. Unpinned on purpose is not a failure, and a red banner
        // saying so would be the overlay complaining about being told what to do.
        const wantTop=!(s.window.config&&s.window.config.onTop===false);
        const pn=document.getElementById("ovlPinNote");
        if(pn){const bad=wantTop&&(!s.window.hwnd||!s.window.top)&&performance.now()>12000;
          const now=bad?"":"none";
          if(pn.style.display!==now){pn.style.display=now;ovlNotes();ovlReportGrab();}}
        const cfg=s.window.config; if(!cfg)return;
        const j=JSON.stringify(cfg);
        if(j!==JSON.stringify(OVL.cfg)&&j!==OVL._sent)ovlApply(cfg);
      });
    },2000);
  });
}

// ---------------------------------------------------------------------------
//  ROLE 2 — in the panel: every overlay there is, and the way out of "clicks pass through"
// ---------------------------------------------------------------------------
if(!RF_OVL){
  // The same switch also sits on every capsule in "Twoje urządzenia" (.dp-ovl, rf-11): "show this
  // one above the game" is a thought you have about A CAPSULE, and the cheat sheet's header is a
  // screen away from where you are looking at it. Three helpers, so that button needs to know
  // nothing about this file.
  function ovlIsAvail(){return !OVL.state||OVL.state.avail!==false;}
  // A CAPSULE's switch, and a capsule can have several windows: it reads as "on" while any of them
  // is up, and pressing it puts all of them away. A switch that leaves one of two overlays on the
  // screen is not a switch.
  function ovlIsRunning(dev){
    const w=(OVL.state&&OVL.state.windows)||{};
    return Object.keys(w).some(k=>w[k]&&w[k].running&&(w[k].dev||k)===dev);
  }
  // This capsule's windows, in the order the server keeps them (oldest first) — the same order the
  // tray lists them in and the same one their numbers come from.
  function ovlWinsOf(dev){
    const s=OVL.state||{}, w=s.windows||{};
    const ord=(s.order||[]).filter(k=>w[k]);
    for(const k of Object.keys(w))if(ord.indexOf(k)<0)ord.push(k);
    return ord.filter(k=>(w[k].dev||k)===dev);
  }
  function ovlToggleFor(dev){
    if(!ovlIsAvail()){
      if(typeof rfToast==="function")rfToast((OVL.state&&OVL.state.reason)||"",{tone:"danger",ms:5000});
      return;
    }
    ovlPost({act:"toggle",dev:dev}).then(x=>{
      if(x&&x.error&&typeof rfToast==="function")rfToast(x.error,{tone:"danger",ms:5000});
      ovlPanelSync(x);
    });
  }
  // Published by hand, and it has to be. The file is strict mode, so a `function` declared inside
  // this block is BLOCK-scoped: the capsule pills (rf-11) would look for it on the global object
  // and quietly find nothing — the button would exist, be clickable and do absolutely nothing.
  window.ovlIsAvail=ovlIsAvail;
  window.ovlIsRunning=ovlIsRunning;
  window.ovlToggleFor=ovlToggleFor;
  // …i to samo dla karty „Nakładki nad grą" (rf-41b): ona pyta o okna jednego kapsla i o to, jak
  // się nazywają, a obie odpowiedzi muszą być TE SAME, co na przyciskach obok. Publikowane ręcznie
  // z tego samego powodu, co trzy linijki wyżej — `function` w bloku nie trafia na `window`.
  window.ovlWinsOf=ovlWinsOf;
  // …i to samo dla paska nazwanych układów okien (rf-49f): każda jego prośba wraca ze świeżym
  // stanem nakładek, a przerysowanie przycisków tym stanem jest robotą TEJ funkcji. Bez tego
  // okno utworzone albo skasowane przez wczytanie układu wisiałoby w przyciskach do najbliższego
  // odpytania (4 s), co wygląda dokładnie jak zawieszenie.
  window.ovlPanelSync=ovlPanelSync;

  function ovlPanelSync(st){
    const host=document.getElementById("ovlBtns"); if(!host)return;
    const s=st||OVL.state; if(!s)return;
    OVL.state=s;
    // Pasek nazwanych układów okien (rf-49f) czyta „co stoi na ekranie" z tego samego stanu, więc
    // odświeża się dokładnie wtedy, co przyciski. Nakładki nie mają zdarzenia w strumieniu — ta
    // funkcja JEST ich jedynym wejściem stanu do panelu.
    if(typeof ovlLayoutSync==="function")try{ovlLayoutSync();}catch(e){}
    // …i karta zarządzania oknami (rf-41b) — z tego samego, jedynego wejścia stanu.
    if(typeof ovmSync==="function")try{ovmSync();}catch(e){}
    const caps=Object.values((typeof state!=="undefined"&&state.devices)||{})
      .sort((a,b)=>(a.meta.slot||0)-(b.meta.slot||0));
    const wins=s.windows||{};
    // The capsule pills carry the same switch, so they have to hear about an overlay opened or shut
    // anywhere else: the header here, the tray icon, the overlay's own ✕, or a window that died.
    const runSig=Object.keys(wins).filter(d=>wins[d]&&wins[d].running).sort().join(",")+"|"+(s.avail?1:0);
    if(OVL._runSig!==runSig){
      OVL._runSig=runSig;
      if(typeof renderDeviceSelector==="function")try{renderDeviceSelector();}catch(e){}
    }
    // ONE BUTTON PER WINDOW, grouped by capsule, plus the ＋ that makes one more. A capsule that has
    // never had an overlay still shows one button — the window it stands for is created the first
    // time it is pressed, which is how this looked before there could be several and how a fresh
    // install has to keep looking.
    const groups=caps.map(d=>{
      const dev=d.meta.dev, mine=ovlWinsOf(dev);
      return {dev:dev, name:d.meta.name||dev, color:d.meta.color||"#8aa0b5",
              wins:mine.length?mine:[dev], real:mine.length};
    });
    // Rebuild only when the LIST changes — which now means the windows too, not just the capsules:
    // a window added, removed or renamed anywhere else (the tray, an overlay's own drawer) has to
    // land here without waiting for a capsule to be paired.
    const sig=groups.map(g=>g.dev+":"+g.name+"["+g.wins.map(w=>w+"/"+((wins[w]||{}).label||"")).join(",")+"]")
      .join("|")+"|"+s.avail;
    if(host._sig!==sig){
      host._sig=sig;
      // The button used to be "🗗 Triki 1" and a tooltip — a glyph and a name, which says neither
      // what it does nor whether it is doing it. It carries the mark, the window (in the capsule's
      // own colour, as everywhere else) and what will happen when it is pressed. The ✕ next to it
      // appears only where there is something to remove: a capsule's only overlay is switched off,
      // never thrown away, or the switch itself would be a thing you first have to re-create.
      host.innerHTML=groups.map(g=>
        `<span class="ovl-cap" data-dev="${esc(g.dev)}" style="--dcol:${esc(g.color)}">`+
        g.wins.map(w=>
          `<span class="ovl-win">`+
            `<button class="btn sm ovl-open-btn" data-win="${esc(w)}" data-dev="${esc(g.dev)}">`+
              `<span class="ovl-btn-ic" aria-hidden="true">${OVL_ICON}</span>`+
              `<span class="ovl-btn-nm"></span><span class="ovl-btn-act"></span><span class="ovl-btn-note" hidden></span></button>`+
            (g.wins.length>1?`<button class="ovl-del" data-win="${esc(w)}" data-dev="${esc(g.dev)}" `+
              `title="${_cvT("Usuń tę nakładkę")}" aria-label="${_cvT("Usuń tę nakładkę")}">✕</button>`:"")+
          `</span>`).join("")+
        // „Dołóż okno" z napisem i filcowym plusem (UX 261120 B5b): goły znak ＋ 22 px był celem
        // za małym i spoza fontu filcowego.
        `<button type="button" class="btn sm ovl-add" data-dev="${esc(g.dev)}" `+
          `title="${_cvT("Kolejne okienko tego kapsla — z własnym miejscem i własną zawartością")}" `+
          `aria-label="${_cvT("Dołóż okno")}: ${esc(g.name)}"><span class="bic bic-plus" aria-hidden="true"></span>Dołóż okno</button>`+
        `</span>`).join("");
      host.onclick=e=>{
        const add=e.target.closest(".ovl-add");
        if(add){
          add.disabled=true;
          ovlPost({act:"add",dev:add.dataset.dev}).then(x=>{add.disabled=false;
            if(x&&x.error&&typeof rfToast==="function")rfToast(x.error,{tone:"danger",ms:5000});
            ovlPanelSync(x);});
          return;
        }
        const del=e.target.closest(".ovl-del");
        if(del){
          // Asked about, because it is the one button here that loses something: where this window
          // sat, how big it was and what was in it. Closing does none of that and is one button to
          // the left.
          const w=(OVL.state&&OVL.state.windows&&OVL.state.windows[del.dataset.win])||{};
          const D=(state.devices||{})[del.dataset.dev];
          const nm=ovlWinTitle((D&&D.meta&&D.meta.name)||del.dataset.dev,w.label,
                               ovlWinsOf(del.dataset.dev).indexOf(del.dataset.win),
                               ovlWinsOf(del.dataset.dev).length);
          const ask=(typeof rfConfirm==="function")
            ? rfConfirm(_cvT("Usunąć nakładkę „%s”? Jej miejsce, rozmiar i ustawienia przepadną.").replace("%s",nm),
                        {tone:"danger",confirmLabel:_gl("Usuń","Remove"),cancelLabel:_cvT("Anuluj")})   // „Remove": okno schodzi z listy; słownikowe „Usuń" = „Delete"
            : Promise.resolve(true);
          ask.then(go=>{
            if(!go)return;
            ovlPost({act:"remove",win:del.dataset.win}).then(x=>{
              if(x&&x.error&&typeof rfToast==="function")rfToast(x.error,{tone:"danger",ms:5000});
              ovlPanelSync(x);});
          });
          return;
        }
        const b=e.target.closest(".ovl-open-btn"); if(!b)return;
        // „Zostaw nad grą": okno otworzył ekran Nakładki na podgląd. Kliknięcie niczego nie zamyka,
        // tylko zdejmuje z okna znacznik podglądu (rf-41d), więc zostaje po wyjściu z ekranu.
        if(b.dataset.mode==="keep"&&typeof ovgKeep==="function"){ovgKeep(b.dataset.win);return;}
        // Każde inne przełączenie stąd jest świadome: okno przestaje być „podglądem" (F-G6-01).
        if(typeof ovgRelease==="function")ovgRelease(b.dataset.win);
        b.disabled=true;
        // Named by WINDOW: with two overlays of one capsule, "toggle the capsule" would open or
        // close both of them from a button that shows one.
        ovlPost({act:"toggle",win:b.dataset.win,dev:b.dataset.dev}).then(x=>{b.disabled=false;
          if(x&&x.error&&typeof rfToast==="function")rfToast(x.error,{tone:"danger",ms:5000});
          ovlPanelSync(x);});
      };
    }
    for(const g of groups){
      for(const b of host.querySelectorAll('.ovl-open-btn[data-dev="'+CSS.escape(g.dev)+'"]')){
        const w=wins[b.dataset.win]||{}, on=!!w.running;
        const nm=ovlWinTitle(g.name,w.label,g.wins.indexOf(b.dataset.win),g.wins.length);
        // TRZY STANY, ZAWSZE CZYNNOŚĆ (UX 261120 B5b, P-G6-10): „Pokaż nad grą" / „Zostaw nad grą"
        // (okno otwarte na podgląd) / „Schowaj". Stan niesie zielona kropka (`is-up`), nie róż:
        // różowy `button.btn.on` w tej aplikacji znaczy „naciśnij mnie".
        const mode=(typeof ovgWinMode==="function")?ovgWinMode(b.dataset.win,on):(on?"hide":"show");
        b.dataset.mode=mode;
        b.classList.remove("on");
        b.classList.toggle("is-up",on);
        b.setAttribute("aria-pressed",on?"true":"false");
        b.disabled=!s.avail;
        const nmEl=b.querySelector(".ovl-btn-nm"), actEl=b.querySelector(".ovl-btn-act");
        if(nmEl&&nmEl.textContent!==nm)nmEl.textContent=nm;
        // Written in Polish and translated by the walker, with the Polish kept in data-pl — the same
        // trick the capsule's state word uses, and for the same reason. Writing the ALREADY translated
        // string instead leaves the walker nothing to put back: it never saw a Polish original for
        // this node, so switching the language back left the button reading "Show over the game".
        const act=mode==="keep"?"Zostaw nad grą":mode==="hide"?"Schowaj":"Pokaż nad grą";
        if(actEl&&actEl.getAttribute("data-pl")!==act){
          actEl.setAttribute("data-pl",act);
          actEl.textContent=act;
          if(typeof applyLang==="function"){try{applyLang(actEl);}catch(e){}}
        }
        const noteEl=b.querySelector(".ovl-btn-note");
        if(noteEl){
          noteEl.hidden=(mode!=="keep");
          if(mode==="keep"&&noteEl.getAttribute("data-pl")!=="teraz tylko podgląd"){
            noteEl.setAttribute("data-pl","teraz tylko podgląd");
            noteEl.textContent="teraz tylko podgląd";
            if(typeof applyLang==="function"){try{applyLang(noteEl);}catch(e){}}
          }
        }
        ovlTip(b, s.avail?((mode==="keep"?_cvT("To okno jest otwarte tylko na czas ustawiania. Kliknij, żeby zostało nad grą także po wyjściu z tego ekranu.")
                            :mode==="hide"?_cvT("Zamknij okienko nad grą")
                            :_cvT("Pokaż nad grą małe okienko z tym kapslem"))+": "+nm)
                         :(s.reason||""));
      }
      const plus=host.querySelector('.ovl-add[data-dev="'+CSS.escape(g.dev)+'"]');
      if(plus)plus.disabled=!s.avail;
    }
    // The one control that must NOT live only in the overlay: with clicks passing through, that
    // window cannot be clicked at all — including its own switch. So the panel keeps a visible way
    // back for each window, and so does the tray icon.
    let warn=document.getElementById("ovlThruWarn");
    const thru=Object.keys(wins).filter(w=>wins[w]&&wins[w].running&&wins[w].config&&wins[w].config.clickThrough);
    if(thru.length&&!warn){
      warn=document.createElement("span");
      warn.id="ovlThruWarn"; warn.className="ovl-panel-warn";
      host.insertAdjacentElement("afterend",warn);
    }else if(!thru.length&&warn){warn.remove();warn=null;}
    if(warn){
      const names=thru.map(w=>{
        const dev=(wins[w]||{}).dev||w, D=(state.devices||{})[dev], mine=ovlWinsOf(dev);
        return ovlWinTitle((D&&D.meta&&D.meta.name)||dev,(wins[w]||{}).label,mine.indexOf(w),mine.length);
      }).join(", ");
      warn.innerHTML=`<span>${esc(names)} — ${_gl("przepuszcza kliknięcia","is passing clicks through")}</span>`+
        `<button class="btn xs" id="ovlThruOff">${_gl("Wyłącz","Switch off")}</button>`;
      warn.querySelector("#ovlThruOff").onclick=()=>{
        Promise.all(thru.map(w=>ovlPost({act:"config",win:w,config:{clickThrough:false}})))
          .then(()=>ovlGet().then(ovlPanelSync));
      };
    }
  }
  window.addEventListener("load",function(){
    if(!document.getElementById("ovlBtns"))return;
    // The mark next to the strip, wherever whoever built it wants one. Since 2026-08-31 the strip
    // lives in the "Nakładki nad grą" card (rf-41b), whose title carries the mark instead — so this
    // usually finds nothing, and that is not a failure: the element is optional, the strip is not.
    {const gi=document.getElementById("ovlGroupIc"); if(gi)gi.innerHTML=OVL_ICON;}
    ovlGet().then(ovlPanelSync);
    // The overlays can also be opened, closed and set to pass clicks through from the overlays
    // themselves and from the tray, so the panel asks rather than assumes. No "only while visible"
    // guard: the browser already throttles timers in a hidden tab, and skipping the poll there is
    // how the panel ends up showing yesterday's answer the moment somebody switches back to it.
    setInterval(()=>ovlGet().then(ovlPanelSync),4000);
    document.addEventListener("visibilitychange",()=>{if(!document.hidden)ovlGet().then(ovlPanelSync);});
  });
}
