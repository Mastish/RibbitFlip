"use strict";
// ===== ŻABI CHÓR: piosenki =====
// Dwie drogi do piosenki, jeden model gry na końcu:
//   · notacja tekstowa: melodie z domeny publicznej wbudowane w grę (BUILTIN: 19, chwytliwe na początku listy;
//     14 z pakietu „Skoczne” i 5 spokojniejszych, zestaw z 2026-11-11),
//   · plik MIDI upuszczony na okno (parseMidiFile, SMF 0 i 1).
// Model gry (czytają go zabi-chor.js i testy):
//   Piosenka {id, tytul, opis, metrum, tempo, zrodlo:"wbudowana"|"midi", plik, rozmiar (MIDI: nazwa pliku i bajty,
//             klucz tablicy wyników), partie:[Partia], tlo:[nuty], koniec,
//             fragment:{od,do,powtorz,taktow}}
//   Partia   {rola:"melodia"|"akompaniament"|"glos", nazwaSciezki, numerSciezki, nuty:[{m,t,d}], lo, hi, srednia}
// t i d liczone w ĆWIERĆNUTACH od początku piosenki, m = numer nuty MIDI (60 = C4), metrum = ćwierćnuty
// w takcie, tempo = ćwierćnuty na minutę, koniec = koniec najpóźniejszej nuty. Partia 0 to zawsze melodia.
//
// Bloki „przeniesione z Keyboard Trenera (ten sam autor)” to kopie 1:1 z pliku
// Desktop/Scarborough Fair/Keyboard_Trener.html: nuty i piosenki ze stanu 2026-10-02 16:55,
// parser z analizatorem partii ze stanu 20:32 tego dnia. Jedyne zmiany w nich są oznaczone „[Żabi chór]”.
// Na końcu pliku: źródło piosenki (lista ścieżek do wyboru) i jej parametry (szuflada „Ustawienia
// piosenki”: melodia, podkład, punkt podziału, fragment, powtórzenia, tempo).
// Komunikaty błędów parsera zostały w jego kodzie; gra pokazuje je w ramce z własnego słownika T.

// ---------------------------------------------------------------------------------------------
// Nazwy nut i odczyt tokenu „E4” → numer MIDI.
// Przeniesione z Keyboard Trenera (ten sam autor).
const NN=["C","Cis","D","Dis","E","F","Fis","G","Gis","A","B","H"];
// wersja angielska gry (js/jezyk.js): nazwy angielskie w miejscu (polskie B = A#, polskie H = B); noteName też czyta NN
if(typeof RBJezyk!=="undefined"&&RBJezyk.en)NN.splice(0,12,"C","C#","D","D#","E","F","F#","G","G#","A","A#","B");
const nameOf=m=>NN[((m%12)+12)%12];
const isBlack=m=>[1,3,6,8,10].includes(((m%12)+12)%12);
function midiOf(tok){const r=/^([A-G])(#|b)?(-?\d)$/.exec(tok);if(!r)throw new Error('Zła nuta: '+tok);return 12*(+r[3]+1)+{C:0,D:2,E:4,F:5,G:7,A:9,B:11}[r[1]]+(r[2]==='#'?1:r[2]==='b'?-1:0)}

// ---------------------------------------------------------------------------------------------
// Wbudowane piosenki (domena publiczna) w notacji „Nuta+oktawa/ćwierćnuty[/palec]”, R = pauza,
// | = kreska taktowa, `left` = akompaniament. Trzecie pole (palec) gra pomija.
// Przeniesione z Keyboard Trenera (ten sam autor).
// ================= songs (public domain) =================
// token: Note+octave/beats[/finger]  (B = H natural, Bb = B flat); R = rest; bars separated by |
const BUILTIN=[
 // [RibbitBeat 2026-11-11] Zestaw na start po instalacji: najbardziej chwytliwe na początku listy; dziecięce melodie z trenera
 // (Panie Janie, Wlazł kotek, Mary Had a Little Lamb, Hot Cross Buns) i Yankee Doodle usunięte; nowe: The Liberty Bell,
 // Eine kleine Nachtmusik i Dla Elizy przepisane z MIDI Mutopia Project (domena publiczna), Jarabe Tapatío z zapisu w Wikipedii.
 // Pakiet „Skoczne” (2026-10-09): opis zaczyna się od „Skoczne · ”, bo biblioteka pokazuje sub jako opis karty. Utwory w 2/4
 // i 3/8 zapisane z wartościami ×2 (ósemka = ćwierćnuta), tempo pod grę. Źródło każdego utworu stoi w jego polu sub.
 {id:'hava-nagila',title:'Hava Nagila',sub:'Skoczne · melodia ludowa, opr. A. Z. Idelsohn (1918)',beats:4,bpl:4,tempo:112,hue:[0.35,0.6,1],defHands:'both',
  left:"D3/2 A2/2 | D3/2 A2/2 | C3/2 G2/2 | D3/1 C3/1 D3/2 | D3/2 A2/2 | D3/2 A2/2 | C3/2 G2/2 | D3/1 C3/1 D3/2 | D3/2 A2/2 | C3/2 G2/2 | C3/2 G2/2 | D3/1 C3/1 D3/2 | D3/2 A2/2 | C3/2 G2/2 | C3/2 G2/2 | D3/1 C3/1 D3/2 | G2/2 D3/2 | G2/2 D3/2 | G2/2 D3/2 | G2/2 D3/2 | C3/2 G2/2 | C3/2 G2/2 | D3/1 R/1 D3/1 R/1 | D3/2 A2/2 | G2/3 R/1",
  src:"D4/1 D4/1.5 F#4/.5 Eb4/.5 D4/.5 | F#4/1 F#4/1.5 A4/.5 G4/.5 F#4/.5 | G4/1 G4/1.5 Bb4/.5 A4/.5 G4/.5 | F#4/1 Eb4/.25 D4/.25 Eb4/.5 D4/2 | D4/1 D4/1.5 F#4/.5 Eb4/.5 D4/.5 | F#4/1 F#4/1.5 A4/.5 G4/.5 F#4/.5 | G4/1 G4/1.5 Bb4/.5 A4/.5 G4/.5 | F#4/1 Eb4/.25 D4/.25 Eb4/.5 D4/2 | F#4/.5 F#4/1 Eb4/.5 D4/.5 D4/.5 D4/1 | Eb4/.5 Eb4/1 D4/.5 C4/.5 C4/.5 C4/1 | C4/1 Eb4/.75 D4/.25 C4/.5 C4/.5 G4/1 | F#4/1 Eb4/.25 D4/.25 Eb4/.5 D4/2 | F#4/.5 F#4/1 Eb4/.5 D4/.5 D4/.5 D4/1 | Eb4/.5 Eb4/1 D4/.5 C4/.5 C4/.5 C4/1 | C4/1 Eb4/.75 D4/.25 C4/.5 C4/.5 G4/1 | F#4/1 Eb4/.25 D4/.25 Eb4/.5 D4/2 | G4/2 G4/2 | G4/1 G4/1 G4/1 G4/1 | G4/.5 G4/.5 Bb4/.75 A4/.25 G4/.5 Bb4/.5 A4/.5 G4/.5 | G4/.5 G4/.5 Bb4/.75 A4/.25 G4/.5 Bb4/.5 A4/.5 G4/.5 | A4/.5 A4/.5 C5/.75 Bb4/.25 A4/.5 C5/.5 Bb4/.5 A4/.5 | A4/.5 A4/.5 C5/.75 Bb4/.25 A4/.5 C5/.5 Bb4/.5 A4/.5 | A4/.5 A4/.5 D5/1 D4/.5 D4/.5 D5/1 | R/.5 D4/.5 D4/.5 D4/.5 Bb4/.5 A4/.5 G4/.5 F#4/.5 | G4/3 R/1"},
 {id:'korobeiniki',title:'Korobeiniki',sub:'Skoczne · rosyjska melodia ludowa',beats:4,bpl:4,tempo:132,hue:[0.95,0.35,0.3],defHands:'both',
  left:"E2/2 B2/2 | A2/2 E3/2 | E2/2 B2/2 | A2/2 A2/2 | D3/2 A2/2 | A2/2 E3/2 | E2/2 B2/2 | A2/2 A2/2 | D3/2 A2/2 | A2/2 E3/2 | E2/2 B2/2 | A2/2 A2/2 | E2/2 B2/2 | A2/2 E3/2 | E2/2 B2/2 | A2/2 A2/2 | D3/2 A2/2 | A2/2 E3/2 | E2/2 B2/2 | A2/2 A2/2 | D3/2 A2/2 | A2/2 E3/2 | E2/2 B2/2 | A2/4",
  src:"E4/1.5 G#4/.5 B4/1 G#4/.5 E4/.5 | A4/1.5 C5/.5 E5/1 D5/.5 C5/.5 | B4/1.5 C5/.5 D5/1 E5/1 | C5/1 A4/1 A4/2 | F5/1.5 G5/.5 A5/1 G5/.5 F5/.5 | E5/1.5 F5/.5 E5/1 D5/.5 C5/.5 | B4/1.5 C5/.5 D5/1 E5/1 | C5/1 A4/1 A4/2 | F5/1.5 G5/.5 A5/1 G5/.5 F5/.5 | E5/1.5 F5/.5 E5/1 D5/.5 C5/.5 | B4/1.5 C5/.5 D5/1 E5/1 | C5/1 A4/1 A4/2 | E4/1.5 G#4/.5 B4/1 G#4/.5 E4/.5 | A4/1.5 C5/.5 E5/1 D5/.5 C5/.5 | B4/1.5 C5/.5 D5/1 E5/1 | C5/1 A4/1 A4/2 | F5/1.5 G5/.5 A5/1 G5/.5 F5/.5 | E5/1.5 F5/.5 E5/1 D5/.5 C5/.5 | B4/1.5 C5/.5 D5/1 E5/1 | C5/1 A4/1 A4/2 | F5/1.5 G5/.5 A5/1 G5/.5 F5/.5 | E5/1.5 F5/.5 E5/1 D5/.5 C5/.5 | B4/1.5 C5/.5 D5/1 E5/1 | C5/1 A4/1 A4/2"},
 {id:'grota',title:'W grocie Króla Gór',sub:'Skoczne · E. Grieg, Peer Gynt (1875) · źródło: Mutopia Project, domena publiczna',beats:4,bpl:4,tempo:136,hue:[0.45,0.3,0.85],defHands:'both',
  left:"B2/2 F#3/2 | B2/2 F#3/2 | B2/2 F#3/2 | B2/2 F#3/2 | B2/2 F#3/2 | B2/2 F#3/2 | D3/2 A3/2 | D3/2 A3/2 | B2/1 F#3/1 B2/1 F#3/1 | B2/1 F#3/1 B2/1 F#3/1 | B2/1 F#3/1 B2/1 F#3/1 | D3/1 A3/1 D3/1 A3/1 | F#2/1 C#3/1 F#2/1 C#3/1 | D3/2 F#2/2 | F#2/1 C#3/1 F#2/1 C#3/1 | D3/2 F#2/2 | B2/4",
  src:"B3/1 C#4/1 D4/1 E4/1 | F#4/1 D4/1 F#4/2 | F4/1 C#4/1 F4/2 | E4/1 C4/1 E4/2 | B3/1 C#4/1 D4/1 E4/1 | F#4/1 D4/1 F#4/1 B4/1 | A4/1 F#4/1 D4/1 F#4/1 | A4/4 | B3/.5 C#4/.5 D4/.5 E4/.5 F#4/.5 D4/.5 F#4/1 | F4/.5 C#4/.5 F4/1 E4/.5 C4/.5 E4/1 | B3/.5 C#4/.5 D4/.5 E4/.5 F#4/.5 D4/.5 F#4/.5 B4/.5 | A4/.5 F#4/.5 D4/.5 F#4/.5 A4/2 | F#4/.5 G#4/.5 A#4/.5 B4/.5 C#5/.5 A#4/.5 C#5/1 | D5/.5 A#4/.5 D5/1 C#5/.5 A#4/.5 C#5/1 | F#4/.5 G#4/.5 A#4/.5 B4/.5 C#5/.5 A#4/.5 C#5/1 | D5/.5 A#4/.5 D5/1 C#5/2 | B4/4"},
 {id:'kankan',title:'Kankan',sub:'Skoczne · J. Offenbach, Galop piekielny (1858)',beats:4,bpl:4,tempo:176,hue:[1,0.3,0.55],defHands:'both',
  left:"C3/2 G2/2 | G2/2 D3/2 | C3/2 G2/2 | C3/2 F2/2 | G2/2 D3/2 | G2/2 D3/2 | C3/2 G2/2 | G2/2 G2/2 | C3/2 G2/2 | G2/2 D3/2 | C3/2 G2/2 | C3/2 F2/2 | G2/2 D3/2 | G2/2 D3/2 | C3/2 G2/2 | C3/4",
  src:"C4/4 | D4/1 F4/1 E4/1 D4/1 | G4/2 G4/2 | G4/1 A4/1 E4/1 F4/1 | D4/2 D4/2 | D4/1 F4/1 E4/1 D4/1 | C4/1 C5/1 B4/1 A4/1 | G4/1 F4/1 E4/1 D4/1 | C4/4 | D4/1 F4/1 E4/1 D4/1 | G4/2 G4/2 | G4/1 A4/1 E4/1 F4/1 | D4/2 D4/2 | D4/1 F4/1 E4/1 D4/1 | C4/1 G4/1 D4/1 E4/1 | C4/4"},
 {id:'liberty',title:'The Liberty Bell',sub:'Skoczne · J. P. Sousa, marsz (1893) · źródło: Mutopia Project, domena publiczna',beats:3,bpl:4,tempo:150,hue:[0.12,0.7,1],defHands:'both',
  left:"R/3 | F2/1.5 F3/1.5 | F2/1.5 F3/1.5 | E2/1.5 G2/1.5 | E2/1.5 C2/1.5 | C2/1.5 Bb3/1.5 | G2/1.5 C3/1.5 | F2/1.5 A2/1.5 | F2/1.5 D2/1.5 | F2/1.5 F3/1.5 | F2/1.5 F3/1.5 | D2/1.5 F2/1.5 | D2/1.5 B2/1.5 | G2/1.5 E3/1.5 | G2/1.5 F3/1.5 | C2/1.5 C2/1.5 | C2/1.5 C3/1.5 | F2/1.5 F3/1.5 | F2/1.5 F3/1.5 | E2/1.5 G2/1.5 | E2/1.5 C2/1.5 | C2/1.5 Bb3/1.5 | G2/1.5 C3/1.5 | F2/1.5 A2/1.5 | F2/1.5 D2/1.5 | F2/1.5 F3/1.5 | F2/1.5 F3/1.5 | D2/1.5 F2/1.5 | D2/1.5 B2/1.5 | G2/1.5 E3/1.5 | G2/1.5 F3/1.5 | C2/1.5 C2/1.5 | C2/3 | F3/1.5 C3/1.5 | F3/1.5 A2/1.5 | Bb2/1.5 C3/1.5 | F2/3",
  src:"R/2.5 C5/0.5 | A4/1 A4/0.5 A4/0.5 G#4/0.5 A4/0.5 | F5/1 C5/0.5 C5/1 A4/0.5 | Bb4/1 Bb4/0.5 Bb4/1 C5/0.5 | D5/2.5 Bb4/0.5 | G4/1 G4/0.5 G4/0.5 F#4/0.5 G4/0.5 | E5/1 D5/0.5 D5/1 Bb4/0.5 | A4/1 A4/0.5 A4/1 Bb4/0.5 | C5/2.5 C5/0.5 | A4/1 A4/0.5 A4/0.5 G#4/0.5 A4/0.5 | A5/1 F5/0.5 F5/1 C5/0.5 | B4/1 G5/0.5 G5/1 G5/0.5 | G5/2.5 F5/0.5 | E5/1 G5/0.5 G5/0.5 F#5/0.5 G5/0.5 | D5/1 G5/0.5 G5/0.5 F#5/0.5 G5/0.5 | C5/1 B4/0.5 C5/1 B4/0.5 | C5/1.5 C5/1.5 | A4/1 A4/0.5 A4/0.5 G#4/0.5 A4/0.5 | F5/1 C5/0.5 C5/1 A4/0.5 | Bb4/1 Bb4/0.5 Bb4/1 C5/0.5 | D5/2.5 Bb4/0.5 | G4/1 G4/0.5 G4/0.5 F#4/0.5 G4/0.5 | E5/1 D5/0.5 D5/1 Bb4/0.5 | A4/1 A4/0.5 A4/1 Bb4/0.5 | C5/2.5 C5/0.5 | A4/1 A4/0.5 A4/0.5 G#4/0.5 A4/0.5 | A5/1 F5/0.5 F5/1 C5/0.5 | B4/1 G5/0.5 G5/1 G5/0.5 | G5/2.5 F5/0.5 | E5/1 G5/0.5 G5/0.5 F#5/0.5 G5/0.5 | D5/1 G5/0.5 G5/0.5 F#5/0.5 G5/0.5 | C5/1 B4/0.5 C5/1 B4/0.5 | C5/1.5 Bb4/1.5 | A4/0.5 G#4/0.5 A4/0.5 D5/1 C5/0.5 | A4/1.5 F4/1.5 | D4/1.5 G4/1.5 | F4/3"},
 {id:'turecki',title:'Marsz turecki',sub:'Skoczne · W. A. Mozart, Rondo alla turca (ok. 1783)',beats:4,bpl:4,tempo:116,hue:[0.3,0.75,0.95],defHands:'both',
  left:"R/4 | A2/2 E3/2 | A2/2 E3/2 | A2/2 E3/2 | A2/2 E3/2 | E2/2 B2/2 | E2/2 B2/2 | E2/2 B2/2 | E2/2 C3/2 | C3/2 G2/2 | G2/2 G2/2 | C3/2 G2/2 | G2/2 E2/2 | A2/2 E3/2 | A2/2 E3/2 | A2/2 E3/2 | A2/2 E3/2 | A2/2 E2/2 | F2/2 D2/2 | E2/4 | A2/4",
  src:"R/2 B4/.5 A4/.5 G#4/.5 A4/.5 | C5/1 R/1 D5/.5 C5/.5 B4/.5 C5/.5 | E5/1 R/1 F5/.5 E5/.5 D#5/.5 E5/.5 | B5/.5 A5/.5 G#5/.5 A5/.5 B5/.5 A5/.5 G#5/.5 A5/.5 | C6/2 A5/1 C6/1 | B5/1 A5/1 G5/1 A5/1 | B5/1 A5/1 G5/1 A5/1 | B5/1 A5/1 G5/1 F#5/1 | E5/2 E5/1 F5/1 | G5/1 G5/1 A5/.5 G5/.5 F5/.5 E5/.5 | D5/2 E5/1 F5/1 | G5/1 G5/1 A5/.5 G5/.5 F5/.5 E5/.5 | D5/2 B4/.5 A4/.5 G#4/.5 A4/.5 | C5/1 R/1 D5/.5 C5/.5 B4/.5 C5/.5 | E5/1 R/1 F5/.5 E5/.5 D#5/.5 E5/.5 | B5/.5 A5/.5 G#5/.5 A5/.5 B5/.5 A5/.5 G#5/.5 A5/.5 | C6/2 A5/1 B5/1 | C6/1 B5/1 A5/1 G#5/1 | A5/1 E5/1 F5/1 D5/1 | C5/2 B4/1.5 A4/.5 | A4/4"},
 {id:'entertainer',title:'The Entertainer',sub:'Skoczne · S. Joplin, 1902 · źródło: Mutopia Project, domena publiczna',beats:4,bpl:4,tempo:140,hue:[0.85,0.6,0.35],defHands:'both',
  left:"R/4 | C3/2 G2/2 | F2/2 E2/2 | G2/2 G2/2 | C3/2 E3/2 | C3/2 G2/2 | F2/2 Eb2/2 | D2/2 D3/2 | G2/4 | C3/2 G2/2 | F2/2 E2/2 | G2/2 G2/2 | C3/2 G2/2 | C3/2 Bb2/2 | A2/2 Ab2/2 | G2/2 G2/2 | C3/4",
  src:"R/3 D4/.5 D#4/.5 | E4/.5 C5/1 E4/.5 C5/1 E4/.5 C5/.5 | C5/2.5 C5/.5 D5/.5 D#5/.5 | E5/.5 C5/.5 D5/.5 E5/1 B4/.5 D5/1 | C5/3 D4/.5 D#4/.5 | E4/.5 C5/1 E4/.5 C5/1 E4/.5 C5/.5 | C5/3 A4/.5 G4/.5 | F#4/.5 A4/.5 C5/.5 E5/1 D5/.5 C5/.5 A4/.5 | D5/3 D4/.5 D#4/.5 | E4/.5 C5/1 E4/.5 C5/1 E4/.5 C5/.5 | C5/2.5 C5/.5 D5/.5 D#5/.5 | E5/.5 C5/.5 D5/.5 E5/1 B4/.5 D5/1 | C5/3 C5/.5 D5/.5 | E5/.5 C5/.5 D5/.5 E5/1 C5/.5 D5/.5 C5/.5 | E5/.5 C5/.5 D5/.5 E5/1 C5/.5 D5/.5 C5/.5 | E5/.5 C5/.5 D5/.5 E5/1 B4/.5 D5/1 | C5/4"},
 {id:'jarabe',title:'Jarabe Tapatío',sub:'Skoczne · meksykański taniec ludowy (taniec z kapeluszem)',beats:3,bpl:4,tempo:144,hue:[0.55,0.75,0.6],defHands:'both',
  left:"R/3 | A2/1.5 E3/1.5 | A2/1.5 E3/1.5 | E2/1.5 B2/1.5 | E2/1.5 B2/1.5 | E2/1.5 B2/1.5 | E2/1.5 B2/1.5 | E2/1.5 B2/1.5 | A2/1.5 E3/1.5 | A2/1.5 E3/1.5 | A2/1.5 E3/1.5 | E2/1.5 B2/1.5 | E2/1.5 B2/1.5 | E2/1.5 B2/1.5 | E2/1.5 B2/1.5 | E2/1.5 B2/1.5 | A2/1.5 E3/1.5 | A2/1.5 E3/1.5 | A2/1.5 E3/1.5 | E2/1.5 B2/1.5 | E2/1.5 B2/1.5 | E2/1.5 B2/1.5 | E2/1.5 B2/1.5 | E2/1.5 B2/1.5 | A2/3",
  src:"R/2 E5/0.5 D#5/0.5 | E5/0.5 C#5/0.5 C5/0.5 C#5/0.5 A4/0.5 G#4/0.5 | A4/0.5 E4/1 R/0.5 C#4/0.5 D4/0.5 | E4/0.5 F#4/0.5 G#4/0.5 A4/0.5 B4/0.5 C#5/0.5 | D5/0.5 B4/1 R/0.5 D5/0.5 C#5/0.5 | D5/0.5 B4/0.5 A#4/0.5 B4/0.5 G#4/0.5 G4/0.5 | G#4/0.5 E4/1 R/0.5 E5/0.5 D#5/0.5 | E5/0.5 F#5/0.5 E5/0.5 D5/0.5 C#5/0.5 B4/0.5 | A4/0.5 R/1.5 E5/0.5 D#5/0.5 | E5/0.5 C#5/0.5 C5/0.5 C#5/0.5 A4/0.5 G#4/0.5 | A4/0.5 E4/1 R/0.5 C#4/0.5 D4/0.5 | E4/0.5 F#4/0.5 G#4/0.5 A4/0.5 B4/0.5 C#5/0.5 | D5/0.5 B4/1 R/0.5 D5/0.5 C#5/0.5 | D5/0.5 B4/0.5 A#4/0.5 B4/0.5 G#4/0.5 G4/0.5 | G#4/0.5 E4/1 R/0.5 E5/0.5 D#5/0.5 | E5/0.5 F#5/0.5 E5/0.5 D5/0.5 C#5/0.5 B4/0.5 | A4/0.5 R/1.5 E5/0.5 D#5/0.5 | E5/0.5 C#5/0.5 C5/0.5 C#5/0.5 A4/0.5 G#4/0.5 | A4/0.5 E4/1 R/0.5 C#4/0.5 D4/0.5 | E4/0.5 F#4/0.5 G#4/0.5 A4/0.5 B4/0.5 C#5/0.5 | D5/0.5 B4/1 R/0.5 D5/0.5 C#5/0.5 | D5/0.5 B4/0.5 A#4/0.5 B4/0.5 G#4/0.5 G4/0.5 | G#4/0.5 E4/1 R/0.5 E5/0.5 D#5/0.5 | E5/0.5 F#5/0.5 E5/0.5 D5/0.5 C#5/0.5 B4/0.5 | A4/0.5 R/2.5"},
 {id:'marynarz',title:'Drunken Sailor',sub:'Skoczne · szanta tradycyjna',beats:4,bpl:4,tempo:144,hue:[0.25,0.55,1],defHands:'both',
  left:"D3/2 A2/2 | D3/2 A2/2 | C3/2 G2/2 | C3/2 G2/2 | D3/2 A2/2 | D3/2 A2/2 | C3/2 A2/2 | D3/4 | D3/2 A2/2 | D3/2 A2/2 | C3/2 G2/2 | C3/2 G2/2 | D3/2 A2/2 | D3/2 A2/2 | C3/2 A2/2 | D3/4",
  src:"A4/1 A4/.5 A4/.5 A4/1 A4/.5 A4/.5 | A4/1 D4/1 F4/1 A4/1 | G4/1 G4/.5 G4/.5 G4/1 G4/.5 G4/.5 | G4/1 C4/1 E4/1 G4/1 | A4/1 A4/.5 A4/.5 A4/1 A4/.5 A4/.5 | A4/1 B4/1 C5/1 D5/1 | C5/1 A4/1 G4/1 E4/1 | D4/2 D4/2 | A4/2 A4/1.5 A4/.5 | A4/1 D4/1 F4/1 A4/1 | G4/2 G4/1.5 G4/.5 | G4/1 C4/1 E4/1 G4/1 | A4/2 A4/1.5 A4/.5 | A4/1 B4/1 C5/1 D5/1 | C5/1 A4/1 G4/1 E4/1 | D4/2 D4/2"},
 {id:'cucaracha',title:'La Cucaracha',sub:'Skoczne · meksykańska melodia ludowa',beats:3,bpl:4,tempo:132,hue:[1,0.6,0.2],defHands:'both',
  left:"R/3 | F2/1 C3/2 | F2/1 C3/2 | C3/1 G2/2 | C3/1 G2/2 | C3/1 G2/2 | C3/1 G2/2 | C3/1 G2/2 | F2/1 C3/2 | F2/1 C3/2 | F2/1 C3/2 | F2/1 C3/2 | C3/1 G2/2 | C3/1 G2/2 | C3/1 G2/2 | C3/1 G2/2 | F2/1 C3/2 | F2/1 C3/2 | F2/1 C3/2 | C3/1 G2/2 | C3/1 G2/2 | C3/1 G2/2 | C3/1 G2/2 | C3/1 G2/2 | F2/3",
  src:"R/1.5 C4/.5 C4/.5 C4/.5 | F4/1 A4/.5 C4/.5 C4/.5 C4/.5 | F4/1 A4/2 | F4/.5 F4/.5 E4/.5 E4/.5 D4/.5 D4/.5 | C4/1.5 C4/.5 C4/.5 C4/.5 | E4/1 G4/.5 C4/.5 C4/.5 C4/.5 | E4/1 G4/2 | C5/.5 D5/.5 C5/.5 Bb4/.5 A4/.5 G4/.5 | F4/3 | C4/.5 C4/.5 F4/.5 F4/.5 A4/.5 A4/.5 | C5/1 A4/2 | C5/.5 D5/.5 C5/.5 Bb4/.5 A4/.5 C5/.5 | Bb4/1 G4/2 | C4/.5 C4/.5 E4/.5 E4/.5 G4/.5 G4/.5 | Bb4/1 G4/2 | C5/.5 D5/.5 C5/.5 Bb4/.5 A4/.5 G4/.5 | A4/1 F4/.5 C4/.5 C4/.5 C4/.5 | F4/1 A4/.5 C4/.5 C4/.5 C4/.5 | F4/1 A4/2 | F4/.5 F4/.5 E4/.5 E4/.5 D4/.5 D4/.5 | C4/1.5 C4/.5 C4/.5 C4/.5 | E4/1 G4/.5 C4/.5 C4/.5 C4/.5 | E4/1 G4/2 | C5/.5 D5/.5 C5/.5 Bb4/.5 A4/.5 G4/.5 | F4/3"},
 {id:'nachtmusik',title:'Eine kleine Nachtmusik',sub:'Skoczne · W. A. Mozart (1787) · źródło: Mutopia Project, domena publiczna',beats:4,bpl:4,tempo:132,hue:[0.75,0.45,1],defHands:'both',
  left:"G2/2 D3/2 | G2/2 B2/2 | D3/2 F#2/2 | D3/2 A2/2 | G2/2 D3/2 | D3/2 A2/2 | G2/2 D3/2 | D3/2 A2/2 | G2/2 B2/2 | D3/2 A2/2 | G2/2 D3/2 | G2/2 B2/2 | D3/2 F#2/2 | D3/2 A2/2 | G2/2 D3/2 | D3/2 A2/2 | G2/2 D3/2 | D3/2 A2/2 | G2/2 B2/2 | D3/2 A2/2 | G2/4",
  src:"G4/1.5 D4/0.5 G4/1.5 D4/0.5 | G4/0.5 D4/0.5 G4/0.5 B4/0.5 D5/2 | C5/1.5 A4/0.5 C5/1.5 A4/0.5 | C5/0.5 A4/0.5 F#4/0.5 A4/0.5 D4/2 | G4/1 G4/1.5 B4/0.5 A4/0.5 G4/0.5 | A4/0.5 F#4/0.5 F#4/1.5 A4/0.5 C5/0.5 F#4/0.5 | A4/0.5 G4/0.5 G4/1.5 B4/0.5 A4/0.5 G4/0.5 | A4/0.5 F#4/0.5 F#4/1.5 A4/0.5 C5/0.5 F#4/0.5 | G4/0.5 G4/0.5 F#4/0.5 E4/0.25 F#4/0.25 G4/0.5 G4/0.5 A4/0.5 G4/0.25 A4/0.25 | B4/0.5 B4/0.5 C5/0.5 B4/0.25 C5/0.25 D5/2 | G4/1.5 D4/0.5 G4/1.5 D4/0.5 | G4/0.5 D4/0.5 G4/0.5 B4/0.5 D5/2 | C5/1.5 A4/0.5 C5/1.5 A4/0.5 | C5/0.5 A4/0.5 F#4/0.5 A4/0.5 D4/2 | G4/1 G4/1.5 B4/0.5 A4/0.5 G4/0.5 | A4/0.5 F#4/0.5 F#4/1.5 A4/0.5 C5/0.5 F#4/0.5 | A4/0.5 G4/0.5 G4/1.5 B4/0.5 A4/0.5 G4/0.5 | A4/0.5 F#4/0.5 F#4/1.5 A4/0.5 C5/0.5 F#4/0.5 | G4/0.5 G4/0.5 F#4/0.5 E4/0.25 F#4/0.25 G4/0.5 G4/0.5 A4/0.5 G4/0.25 A4/0.25 | B4/0.5 B4/0.5 C5/0.5 B4/0.25 C5/0.25 D5/2 | G4/4"},
 {id:'saints',title:'When the Saints Go Marching In',sub:'Skoczne · spiritual tradycyjny',beats:4,bpl:4,tempo:160,hue:[0.95,0.75,0.3],defHands:'both',
  left:"C3/4 | C3/2 G2/2 | C3/4 | C3/2 G2/2 | C3/4 | C3/2 G2/2 | C3/2 G2/2 | G2/2 D3/2 | G2/4 | C3/2 G2/2 | C3/2 Bb2/2 | F2/2 C3/2 | C3/2 G2/2 | C3/2 G2/2 | G2/2 D3/2 | C3/4 | C3/4 | C3/2 G2/2 | C3/4 | C3/2 G2/2 | C3/4 | C3/2 G2/2 | C3/2 G2/2 | G2/2 D3/2 | G2/4 | C3/2 G2/2 | C3/2 Bb2/2 | F2/2 C3/2 | C3/2 G2/2 | C3/2 G2/2 | G2/2 D3/2 | C3/4",
  src:"R/1 C4/1 E4/1 F4/1 | G4/4 | R/1 C4/1 E4/1 F4/1 | G4/4 | R/1 C4/1 E4/1 F4/1 | G4/2 E4/2 | C4/2 E4/2 | D4/4 | R/1 E4/1 E4/1 D4/1 | C4/4 | E4/2 G4/2 | G4/1 F4/3 | R/2 E4/1 F4/1 | G4/2 E4/2 | C4/2 D4/2 | C4/4 | R/1 C4/1 E4/1 F4/1 | G4/4 | R/1 C4/1 E4/1 F4/1 | G4/4 | R/1 C4/1 E4/1 F4/1 | G4/2 E4/2 | C4/2 E4/2 | D4/4 | R/1 E4/1 E4/1 D4/1 | C4/4 | E4/2 G4/2 | G4/1 F4/3 | R/2 E4/1 F4/1 | G4/2 E4/2 | C4/2 D4/2 | C4/4"},
 {id:'funiculi',title:'Funiculì, funiculà',sub:'Skoczne · L. Denza, 1880 (refren)',beats:3,bpl:4,tempo:140,hue:[0.4,0.85,0.6],defHands:'both',
  left:"Bb2/1.5 F2/1.5 | Bb2/1.5 F2/1.5 | Bb2/1.5 F2/1.5 | Bb2/3 | Bb2/1.5 F2/1.5 | Bb2/1.5 F2/1.5 | Bb2/1.5 F2/1.5 | Eb3/3 | D3/3 | C3/3 | B2/3 | C3/3 | Ab2/3 | Bb2/3 | Bb2/3 | Eb3/3 | Bb2/1.5 F2/1.5 | Bb2/1.5 F2/1.5 | Bb2/1.5 F2/1.5 | Bb2/3 | Bb2/1.5 F2/1.5 | Bb2/1.5 F2/1.5 | Bb2/1.5 F2/1.5 | Eb3/3 | D3/3 | C3/3 | B2/3 | C3/3 | Ab2/3 | Bb2/3 | Bb2/3 | Eb3/3",
  src:"D5/1.5 C5/.5 R/1 | D5/1.5 C5/.5 R/1 | Eb5/1 D5/.5 C5/1 Eb5/.5 | D5/2.5 R/.5 | D5/1.5 C5/.5 R/1 | D5/1.5 C5/.5 R/1 | Eb5/1 D5/.5 C5/1 Eb5/.5 | Bb4/.5 R/.5 G4/.5 G4/1 G4/.5 | G4/1 G4/.5 G4/1 G4/.5 | G4/1 G4/.5 G4/1 G4/.5 | G4/1 G4/.5 G4/1 G4/.5 | Eb5/3 | F5/1 Eb5/.5 C5/1 Eb5/.5 | Bb4/.5 R/.5 G4/.5 G4/1 Ab4/.5 | Bb4/1 Ab4/.5 G4/1 F4/.5 | Eb4/1 R/2 | D5/1.5 C5/.5 R/1 | D5/1.5 C5/.5 R/1 | Eb5/1 D5/.5 C5/1 Eb5/.5 | D5/2.5 R/.5 | D5/1.5 C5/.5 R/1 | D5/1.5 C5/.5 R/1 | Eb5/1 D5/.5 C5/1 Eb5/.5 | Bb4/.5 R/.5 G4/.5 G4/1 G4/.5 | G4/1 G4/.5 G4/1 G4/.5 | G4/1 G4/.5 G4/1 G4/.5 | G4/1 G4/.5 G4/1 G4/.5 | Eb5/3 | F5/1 Eb5/.5 C5/1 Eb5/.5 | Bb4/.5 R/.5 G4/.5 G4/1 Ab4/.5 | Bb4/1 Ab4/.5 G4/1 F4/.5 | Eb4/1 R/2"},
 {id:'gwiazdy',title:'The Stars and Stripes Forever (trio)',sub:'Skoczne · J. P. Sousa, 1896 · źródło: Mutopia Project, domena publiczna',beats:4,bpl:4,tempo:110,hue:[0.3,0.45,1],defHands:'both',
  left:"R/3 Eb3/1 | Ab2/1 Eb3/1 Ab2/1 Eb3/1 | Ab2/1 Eb3/1 Ab2/1 Eb3/1 | Ab2/1 Eb3/1 Ab2/1 Eb3/1 | Bb2/1 Eb3/1 Bb2/1 Eb3/1 | Bb2/1 Eb3/1 Bb2/1 Eb3/1 | Bb2/1 Eb3/1 Bb2/1 Eb3/1 | Ab2/1 Ab3/1 Db3/1 Ab3/1 | Eb3/1 Bb2/1 G2/1 Eb3/1 | Ab2/1 Eb3/1 Ab2/1 Eb3/1 | Ab2/1 Eb3/1 Ab2/1 Eb3/1 | G2/1 C3/1 G2/1 C3/1 | F3/1 C3/1 F3/1 C3/1 | E3/1 Ab3/1 E3/1 Ab3/1 | Eb3/1 Ab2/1 C3/1 Eb3/1 | C3/1 Eb3/1 Ab2/1 Eb3/1 | Eb3/2 Ab2/2",
  src:"R/3 Eb5/1 | Eb5/1 Db5/.5 C5/.5 C5/1 B4/.5 C5/.5 | C5/3 B4/.5 C5/.5 | C5/1 B4/.5 C5/.5 Eb5/1 C5/.75 Eb5/.25 | Db5/2 Bb4/1 Bb4/1 | Bb4/1 A4/.5 Bb4/.5 Bb4/1 A4/.5 Bb4/.5 | Db5/3 C5/.5 Bb4/.5 | C5/.5 Eb5/1.5 F5/1.5 F5/.5 | Bb4/3 Eb5/1 | Eb5/1 Db5/.5 C5/.5 C5/1 B4/.5 C5/.5 | C5/3 B4/.5 C5/.5 | C5/1 B4/.5 C5/.5 Db5/.5 C5/.5 Bb4/.75 G5/.25 | Bb4/2 Ab4/1 Ab4/1 | Ab4/1 G4/.5 Ab4/.5 B4/1 Bb4/.5 Ab4/.5 | Ab4/2.5 Ab4/.5 Bb4/.5 C5/.5 | Eb5/.5 Ab4/.5 Bb4/.5 C5/.5 Eb5/.5 Eb4/.5 F4/.5 C5/.5 | Bb4/2 Ab4/2"},
 {id:'elise',title:'Dla Elizy',sub:'L. van Beethoven (1810) · źródło: Mutopia Project, domena publiczna',beats:3,bpl:4,tempo:116,hue:[0.6,0.35,0.95],defHands:'both',
  left:"R/3 | R/2 A2/1 | A2/2 E2/1 | E2/2 A2/1 | A2/3 | R/2 A2/1 | A2/2 E2/1 | E2/2 A2/1 | A2/3 | C3/3 | G2/3 | A2/3 | E2/3 | E2/3 | R/3 | R/1 A2/2 | A2/1 E2/2 | E2/1 A2/2 | A2/3 | R/1 A2/2 | A2/1 E2/2 | E2/1 A2/2",
  src:"R/1 E5/0.5 D#5/0.5 E5/0.5 D#5/0.5 | E5/0.5 B4/0.5 D5/0.5 C5/0.5 A4/1 | R/0.5 C4/0.5 E4/0.5 A4/0.5 B4/1 | R/0.5 E4/0.5 G#4/0.5 B4/0.5 C5/1 | R/0.5 E4/0.5 E5/0.5 D#5/0.5 E5/0.5 D#5/0.5 | E5/0.5 B4/0.5 D5/0.5 C5/0.5 A4/1 | R/0.5 C4/0.5 E4/0.5 A4/0.5 B4/1 | R/0.5 E4/0.5 C5/0.5 B4/0.5 A4/1 | R/2.5 B4/0.5 | C5/0.5 D5/0.5 E5/1.5 G4/0.5 | F5/0.5 E5/0.5 D5/1.5 F4/0.5 | E5/0.5 D5/0.5 C5/1.5 E4/0.5 | D5/0.5 C5/0.5 B4/1.5 E4/0.5 | B4/1 R/2 | E5/0.5 D#5/0.5 E5/0.5 D#5/0.5 E5/0.5 B4/0.5 | D5/0.5 C5/0.5 A4/1.5 C4/0.5 | E4/0.5 A4/0.5 B4/1.5 E4/0.5 | G#4/0.5 B4/0.5 C5/1.5 E4/0.5 | E5/0.5 D#5/0.5 E5/0.5 D#5/0.5 E5/0.5 B4/0.5 | D5/0.5 C5/0.5 A4/1.5 C4/0.5 | E4/0.5 A4/0.5 B4/1.5 E4/0.5 | C5/0.5 B4/0.5 A4/2"},
 {id:'oda',title:'Oda do radości',sub:'L. van Beethoven',beats:4,bpl:4,tempo:80,hue:[.62,.42,1],defHands:'both',
  left:"C3/4 | G2/4 | C3/4 | G2/2 G2/2 | C3/4 | G2/4 | C3/4 | G2/2 C3/2 | G2/4 | G2/2 C3/2 | G2/2 C3/2 | C3/2 G2/2 | C3/4 | G2/4 | C3/4 | G2/2 C3/2",
  src:"E4/1 E4/1 F4/1 G4/1 | G4/1 F4/1 E4/1 D4/1 | C4/1 C4/1 D4/1 E4/1 | E4/1.5 D4/.5 D4/2 | E4/1 E4/1 F4/1 G4/1 | G4/1 F4/1 E4/1 D4/1 | C4/1 C4/1 D4/1 E4/1 | D4/1.5 C4/.5 C4/2 | D4/1 D4/1 E4/1 C4/1 | D4/1 E4/.5 F4/.5 E4/1 C4/1 | D4/1 E4/.5 F4/.5 E4/1 D4/1 | C4/1 D4/1 G3/2 | E4/1 E4/1 F4/1 G4/1 | G4/1 F4/1 E4/1 D4/1 | C4/1 C4/1 D4/1 E4/1 | D4/1.5 C4/.5 C4/2"},
 {id:'jingle',title:'Jingle Bells (refren)',sub:'J. Pierpont, 1857',beats:4,bpl:4,tempo:100,hue:[.9,.3,.45],
  src:"E4/1 E4/1 E4/2 | E4/1 E4/1 E4/2 | E4/1 G4/1 C4/1.5 D4/.5 | E4/4 | F4/1 F4/1 F4/1.5 F4/.5 | F4/1 E4/1 E4/1 E4/.5 E4/.5 | E4/1 D4/1 D4/1 E4/1 | D4/2 G4/2 | E4/1 E4/1 E4/2 | E4/1 E4/1 E4/2 | E4/1 G4/1 C4/1.5 D4/.5 | E4/4 | F4/1 F4/1 F4/1.5 F4/.5 | F4/1 E4/1 E4/1 E4/.5 E4/.5 | G4/1 G4/1 F4/1 D4/1 | C4/4"},
 {id:'scarborough',title:'Scarborough Fair',sub:'ballada angielska, z podręcznika',beats:3,bpl:4,tempo:70,hue:[.36,.47,1],
  left:"D3/3 | D3/3 | C3/3 | D3/3 | D3/3 | D3/3 | G2/3 | D3/3 | D3/3 | C3/3 | F2/3 | C3/3 | D3/3 | Bb2/3 | A2/3 | D3/3",
  src:"D4/2/1 D4/1/1 | A4/2/5 A4/1/5 | E4/1.5/2 F4/.5/3 E4/1/2 | D4/3/1 | R/1 A4/1/2 C5/1/4 | D5/2/5 C5/1/4 | A4/1/2 B4/1/3 G4/1/1 | A4/3/2 | D5/2/5 D5/1/5 | C5/2/4 A4/1/2 | A4/1/4 G4/1/3 F4/1/2 | E4/3/1 | D4/2/1 A4/1/5 | G4/2/4 F4/1/3 | E4/1/3 D4/1/2 C4/1/1 | D4/3/2"},
 {id:'gwiazdka',title:'Mrugaj, mrugaj, gwiazdko',sub:'melodia tradycyjna',beats:4,bpl:4,tempo:90,hue:[1,.8,.3],defHands:'both',
  left:"C3/4 | F2/2 C3/2 | F2/2 C3/2 | G2/2 C3/2 | C3/2 G2/2 | C3/2 G2/2 | C3/2 G2/2 | C3/2 G2/2 | C3/4 | F2/2 C3/2 | F2/2 C3/2 | G2/2 C3/2",
  src:"C4/1 C4/1 G4/1 G4/1 | A4/1 A4/1 G4/2 | F4/1 F4/1 E4/1 E4/1 | D4/1 D4/1 C4/2 | G4/1 G4/1 F4/1 F4/1 | E4/1 E4/1 D4/2 | G4/1 G4/1 F4/1 F4/1 | E4/1 E4/1 D4/2 | C4/1 C4/1 G4/1 G4/1 | A4/1 A4/1 G4/2 | F4/1 F4/1 E4/1 E4/1 | D4/1 D4/1 C4/2"}
];
// Wersja angielska gry (js/jezyk.js): tytuły i podtytuły wbudowanych piosenek z RB_EN.piosenki (po id). Podmiana w miejscu,
// bo BUILTIN czytają biblioteka, licencje i karty; klucz tablicy wyników to id („wbud:<id>”), więc wyniki się nie rozjeżdżają.
if(typeof RBJezyk!=="undefined"&&RBJezyk.en&&typeof RB_EN!=="undefined"&&RB_EN.piosenki)
  for(const d of BUILTIN){const e=RB_EN.piosenki[d.id];if(e){if(e[0])d.title=e[0];if(e[1])d.sub=e[1];}}
function parseBars(src,beats){const notes=[];src.split('|').forEach((bar,bi)=>{let bt=bi*beats;bar.trim().split(/\s+/).forEach(tok=>{if(!tok)return;const [n,d,f]=tok.split('/');const dd=+d;if(n!=='R')notes.push({m:midiOf(n),d:dd,f:f?+f:0,t:bt});bt+=dd})});return notes}

// ---------------------------------------------------------------------------------------------
// Parser plików MIDI (SMF 0/1) i ANALIZATOR PARTII: każda ścieżka × kanał (bez perkusji) jako partia,
// jeden głos na partię, a do tego to, co trener robi z plikiem na dwie ręce: podział jednej ścieżki
// (metody „wg wysokości”, „dwa głosy”, „frazami”, z przeszukiwaniem wiązkowym kosztów) i uproszczenie
// gęstych albo wielopartiowych plików na melodię i bas (test grywalności, przerzedzanie rytmiczne).
// Przeniesione z Keyboard Trenera (ten sam autor), stan z 2026-10-02 20:32 (linie 520–675 trenera).
// Zmiany względem trenera oznaczone „[Żabi chór]”; to, co trener robił w wersji z 16:00 osobno dla gry
// (wspólny początek partii, oktawy z pliku), trener ma już sam (`origin`, `shift`).
// ================= MIDI file parser (melody = highest voice) =================
// one voice out of a raw note list (highest for the right hand, lowest for the left), quantised to 16ths, moved into a playable octave
const noteName=m=>NN[m%12]+(Math.floor(m/12)-1);
// [RibbitBeat] `mapa` (mapaTempa): rytm kwantowany w tickach pliku, potem czas i długość przeliczone na prawdziwy czas w tempie gry
function midiMelody(raw,low,tpq,bpb,shift,origin,mapa){const q=tpq/4;const byStart={};raw.forEach(n=>{const s=Math.round(n.s/q)*q;const len=Math.max(q,Math.round((n.e-n.s)/q)*q);if(!byStart[s]||(low?n.m<byStart[s].m:n.m>byStart[s].m))byStart[s]={m:n.m,s,len}});
  const starts=Object.keys(byStart).map(Number).sort((a,b)=>a-b);if(!starts.length)return {notes:[],nBars:1};const first=origin!==undefined?origin:Math.floor(starts[0]/tpq/bpb)*bpb;
  const g0=mapa?tickGry(mapa,first*tpq):0;
  let notes=starts.map((s,i)=>{const x=byStart[s],next=i<starts.length-1?starts[i+1]:s+x.len;const d=Math.max(.25,Math.min(x.len,next-s)/tpq);
    if(mapa){const gs=tickGry(mapa,s);return {m:x.m,t:+((gs-g0)/tpq).toFixed(3),d:+((tickGry(mapa,s+d*tpq)-gs)/tpq).toFixed(3),f:0}}
    return {m:x.m,t:+(s/tpq-first).toFixed(3),d:+d.toFixed(3),f:0}}).filter(n=>n.t<512*bpb);
  if(!notes.length)return {notes:[],nBars:1};
  // [RibbitBeat 10-19] zakres pętlą, nie `Math.min(...nuty)`: dwie tablice na partię mniej, a plik z dziesiątkami
  // tysięcy nut nie wpada w limit argumentów (ten sam wynik: minimum i maksimum tych samych liczb)
  let lo=Infinity,hi=-Infinity;for(const n of notes){if(n.m<lo)lo=n.m;if(n.m>hi)hi=n.m}const mn=low?36:48,mx=low?72:96;let sh=0;if(shift!==undefined)sh=shift;else{while(lo+sh<mn)sh+=12;while(hi+sh>mx&&lo+sh-12>=mn)sh-=12}notes.forEach(n=>n.m+=sh);
  return {notes,nBars:Math.ceil((notes[notes.length-1].t+notes[notes.length-1].d)/bpb-1e-6)}}
// one track for both hands: look at the music and decide whether and how to divide it
//  'voices'  — chords/two voices at once: top of each chord → right hand, bottom → left hand, single notes follow the nearer hand
//  'gap'     — two registers with a clear gap between them: everything above the gap → right, below → left
//  'phrases' — a single melody that wanders over a wide range: low phrases → left, high phrases → right (switch only on a clear jump)
//  null      — a narrow single line: one hand is enough
function analyseSplit(raw,tpq){if(!raw||raw.length<16)return null;const q=Math.max(1,tpq/8);
  const groups={};raw.forEach(n=>{const k=Math.round(n.s/q);(groups[k]=groups[k]||[]).push(n)});const gs=Object.values(groups);
  const poly=gs.filter(g=>g.length>=2&&Math.max(...g.map(n=>n.m))-Math.min(...g.map(n=>n.m))>=5).length/gs.length;
  const ps=raw.map(n=>n.m).sort((a,b)=>a-b);const span=ps[ps.length-1]-ps[0];const med=ps[ps.length>>1];
  const cnt={};raw.forEach(n=>cnt[n.m]=(cnt[n.m]||0)+1);const up=Object.keys(cnt).map(Number).sort((a,b)=>a-b);
  let gapAt=60,gap=0;for(let i=1;i<up.length;i++){const a=up[i-1],b=up[i];if(b<48||a>72)continue;if(b-a>gap){gap=b-a;gapAt=Math.round((a+b)/2)}}
  const share=at=>{const lo=raw.filter(n=>n.m<at).length;return Math.min(lo,raw.length-lo)/raw.length};
  if(gap>=4&&share(gapAt)>=.15)return {method:'gap',at:gapAt,why:'dwa rejestry z przerwą '+gap+' półtonów'};
  if(poly>=.25){let at=60;let best=0;for(let c=50;c<=70;c++){const sh=share(c);if(sh>best){best=sh;at=c}}return {method:'voices',at,why:Math.round(poly*100)+'% akordów: góra prawa, dół lewa'}}
  if(span>=14&&share(med)>=.2)return {method:'phrases',at:med,why:'melodia na '+span+' półtonach: niskie frazy lewa, wysokie prawa'};
  return null}
// hand assignment by cost (beam search over note groups): no crossing, each hand within an octave, small movements,
// melodic lines stay in one hand, right hand prefers the upper register and the left the lower one
// [RibbitBeat 2026-10-19] Ten sam wynik, mniej pracy: paczka 471 utworów stawała się kartami przez ~90 s, a
// 92% tego czasu siedziało tutaj. Kolejność i wartości dodawanych kar są co do bitu te same (klucz tablicy
// wyników zależy od nuty, więc inny podział rąk = inny utwór), zmienia się tylko to, ile razy je liczymy:
//   · ścieżka stanu to lista wiążąca, nie `path.concat(j)` — kopiowanie całej ścieżki przy każdym stanie
//     i każdym podziale dawało O(grupy²) kopii (dla 12 tys. nut: setki milionów),
//   · podział czytamy z indeksów grupy (dwa `slice` na stan × podział zniknęły),
//   · grupa sortuje się raz (nie w pętli i jeszcze raz przy odczycie wyniku),
//   · kary, które zależą tylko od grupy (rozstaw, rejestr i głos nuty, skrzyżowanie w grupie, wspólna
//     ręka), liczymy raz na grupę i dodajemy całej wiązce — w tych samych miejscach sumy, co dotąd.
function assignHandsBeam(raw,at,tpq,opts){const q=Math.max(1,tpq/8);const o=Object.assign({beam:12,regW:.5,moveW:.6,jumpW:1.2,crossW:3,switchW:2.5,shareW:2,voiceW:0},opts||{});
  const grupy=new Map();raw.forEach(n=>{const k=Math.round(n.s/q);const g=grupy.get(k);if(g)g.push(n);else grupy.set(k,[n])});
  const keys=[...grupy.keys()].sort((a,b)=>a-b);const G=keys.map(k=>grupy.get(k).sort((a,b)=>a.m-b.m));
  let maxK=0;for(const g of G)if(g.length>maxK)maxK=g.length;
  // kary jednej grupy, po podziale j (0…K) albo po nucie (rejestr i głos)
  const kRozL=new Float64Array(maxK+1),kRozR=new Float64Array(maxK+1),kKrzyz=new Float64Array(maxK+1),kRazem=new Float64Array(maxK+1);
  const kRegR=new Float64Array(maxK),kGloR=new Float64Array(maxK),kRegL=new Float64Array(maxK),kGloL=new Float64Array(maxK);
  const ileR=new Int32Array(maxK+2),ileL=new Int32Array(maxK+2);   // niezerowe kary nut w sufiksie / prefiksie
  let states=[{cost:0,lastR:null,lastL:null,lastHand:null,lastPitch:null,wezel:null}];
  for(let gi=0;gi<G.length;gi++){const g=G[gi],K=g.length,next=[];
    const spanG=g[K-1].m-g[0].m;
    for(let j=0;j<=K;j++){const spL=j>0?g[j-1].m-g[0].m:0,spR=j<K?g[K-1].m-g[j].m:0;
      kRozL[j]=spL>12?40+(spL-12)*4:0;kRozR[j]=spR>12?40+(spR-12)*4:0;
      kKrzyz[j]=j>0&&j<K&&g[j].m<=g[j-1].m?(g[j-1].m-g[j].m+1)*o.crossW*3:0;
      kRazem[j]=K>=2&&spanG>=10&&(j===0||j===K)?o.shareW:0}
    ileR[K]=0;ileL[0]=0;
    for(let x=K-1;x>=0;x--){const m=g[x].m;kRegR[x]=m<at-3?(at-3-m)*o.regW:0;kGloR[x]=g[x].vc==='B'?o.voiceW:0;
      ileR[x]=ileR[x+1]+(kRegR[x]?1:0)+(kGloR[x]?1:0)}
    for(let x=0;x<K;x++){const m=g[x].m;kRegL[x]=m>at+3?(m-at-3)*o.regW:0;kGloL[x]=g[x].vc==='T'?o.voiceW:0;
      ileL[x+1]=ileL[x]+(kRegL[x]?1:0)+(kGloL[x]?1:0)}
    for(let si=0;si<states.length;si++){const st=states[si];
      for(let j=0;j<=K;j++){let c=st.cost;
        if(kRozL[j])c+=kRozL[j];if(kRozR[j])c+=kRozR[j];
        const cR=j<K?(g[j].m+g[K-1].m)/2:null,cL=j>0?(g[0].m+g[j-1].m)/2:null;
        // moving a hand costs only beyond its reach (a 4th around where it was); the first entry counts half
        if(cR!==null){const ref=st.lastR!==null?st.lastR:at+6,w=st.lastR!==null?1:.5;const d=Math.max(0,Math.abs(cR-ref)-5);c+=(d*o.moveW+(d>7?(d-7)*o.jumpW:0))*w}
        if(cL!==null){const ref=st.lastL!==null?st.lastL:at-6,w=st.lastL!==null?1:.5;const d=Math.max(0,Math.abs(cL-ref)-5);c+=(d*o.moveW+(d>7?(d-7)*o.jumpW:0))*w}
        if(ileR[j])for(let x=j;x<K;x++){if(kRegR[x])c+=kRegR[x];if(kGloR[x])c+=kGloR[x]}
        if(ileL[j])for(let x=0;x<j;x++){if(kRegL[x])c+=kRegL[x];if(kGloL[x])c+=kGloL[x]}
        if(kKrzyz[j])c+=kKrzyz[j];
        const lowR=j<K?g[j].m:null,highL=j>0?g[j-1].m:null;
        if(lowR!==null&&highL===null&&st.lastL!==null&&lowR<st.lastL)c+=(st.lastL-lowR)*o.crossW;
        if(highL!==null&&lowR===null&&st.lastR!==null&&highL>st.lastR)c+=(highL-st.lastR)*o.crossW;
        let lh=st.lastHand,lp=st.lastPitch;if(K===1){const h=j===0?'R':'L';if(lh&&lh!==h&&lp!==null&&Math.abs(g[0].m-lp)<=12)c+=o.switchW*(Math.abs(g[0].m-lp)<=5?1:.7);lh=h;lp=g[0].m}
        if(kRazem[j])c+=kRazem[j];
        next.push({cost:c,lastR:cR!==null?cR:st.lastR,lastL:cL!==null?cL:st.lastL,lastHand:lh,lastPitch:lp,wezel:{j,pop:st.wezel}})}}
    next.sort((a,b)=>a.cost-b.cost);states=next.length>o.beam?next.slice(0,o.beam):next}
  const hi=[],lo=[];const jj=new Int32Array(G.length);
  {let w=states[0].wezel;for(let i=G.length-1;i>=0;i--){jj[i]=w.j;w=w.pop}}
  for(let i=0;i<G.length;i++){const g=G[i],j=jj[i];for(let x=0;x<g.length;x++)(x<j?lo:hi).push(g[x])}
  return {hi,lo}}
function splitHands(raw,method,at,tpq){
  if(method==='voices'||method==='phrases')return assignHandsBeam(raw,at,tpq,method==='phrases'?{switchW:4,regW:.35}:{});const q=Math.max(1,tpq/8);const hi=[],lo=[];const groups={};raw.forEach(n=>{const k=Math.round(n.s/q);(groups[k]=groups[k]||[]).push(n)});
  const keys=Object.keys(groups).map(Number).sort((a,b)=>a-b);let lastR=at+7,lastL=at-7,hand=null,lastEnd=-1;
  keys.forEach(k=>{const g=groups[k].slice().sort((a,b)=>a.m-b.m);const gap=g[0].s-lastEnd;lastEnd=Math.max(...g.map(n=>n.e));
    if(method==='voices'){if(g.length>=2&&g[g.length-1].m-g[0].m>=5){const mid=(g[0].m+g[g.length-1].m)/2;g.forEach((n,i)=>{if(i===g.length-1||(i>0&&n.m>=mid)){hi.push(n);lastR=n.m}else{lo.push(n);lastL=n.m}})}
      else{g.forEach(n=>{const dR=Math.abs(n.m-lastR),dL=Math.abs(n.m-lastL);if(dR<=dL+2){hi.push(n);lastR=n.m}else{lo.push(n);lastL=n.m}})}}
    else if(method==='phrases'){g.forEach(n=>{if(hand===null||gap>q*4)hand=n.m>=at?'R':'L';else if(n.m>=at+3)hand='R';else if(n.m<at-3)hand='L';(hand==='R'?hi:lo).push(n)})}
    else{g.forEach(n=>(n.m>=at?hi:lo).push(n))}});
  return {hi,lo}}
const METHOD_NAME={gap:'wg wysokości',voices:'dwa głosy',phrases:'frazami'};
function splitLabel(h,sp){const m=sp.method;const where=m==='voices'?(h==='R'?'góra akordów':'dół akordów'):m==='phrases'?(h==='R'?'wysokie frazy':'niskie frazy'):(h==='R'?'od '+noteName(sp.at):'poniżej '+noteName(sp.at));return (h==='R'?'✋ Prawa ręka':'Lewa ręka')+' ('+METHOD_NAME[m]+': '+where+')'}
// a playable two-hand reduction of a dense or many-part file (duets, "4 hands", black-MIDI showpieces):
// melody = the top line, bass = the bottom line, both thinned to what a child can play at the song's tempo, strong beats kept first
function reduceForTwoHands(all,tpq,bpb,usq,maxMel,maxBass,melGrid){const q=tpq/4,barT=tpq*bpb,barSec=barT*usq/1e6/tpq;melGrid=melGrid||q;
  const slots={};all.forEach(n=>{const k=Math.round(n.s/q);(slots[k]=slots[k]||[]).push(n)});
  const bars={};Object.keys(slots).map(Number).forEach(k=>{const b=Math.floor(k*q/barT);(bars[b]=bars[b]||[]).push(k)});
  const pick=(allowed,prefer,chooser,minGrid)=>{const out=[];Object.values(bars).forEach(ks=>{ks.sort((a,b)=>a-b);let grid=minGrid;
      for(const g of [q,q*2,q*4,q*8]){if(g<minGrid)continue;grid=g;const n=new Set(ks.map(k=>Math.floor(k*q/g))).size;if(n<=allowed||g===q*8)break}
      const wins={};ks.forEach(k=>{const w=Math.floor(k*q/grid);(wins[w]=wins[w]||[]).push(...slots[k])});
      Object.keys(wins).map(Number).sort((a,b)=>a-b).forEach(w=>{const n=chooser(wins[w]);if(n)out.push(Object.assign({},n,{s:Math.max(n.s,w*grid)}))})});return out};
  // voice-aware: the highest note wins unless it is a leap away from where the melody was while a nearer note exists (then the melody stays in its voice)
  let prevTop=null,prevTopT=-1e9,prevBot=null,prevBotT=-1e9;
  const top=g=>{let best=null,bs=-1e9;g.forEach(n=>{const sc=n.m-(prevTop===null?0:Math.max(0,Math.abs(n.m-prevTop)-7)*2.2);if(sc>bs){bs=sc;best=n}});
    // a window whose highest note sits far under the melody while the melody was just playing = accompaniment, the melody rests here
    if(prevTop!==null&&best.m<prevTop-7&&best.s-prevTopT<barT)return null;prevTop=best.m;prevTopT=best.s;return best};
  const bot=g=>{let best=null,bs=-1e9;g.forEach(n=>{const sc=-n.m-(prevBot===null?0:Math.max(0,Math.abs(n.m-prevBot)-7)*2.5);if(sc>bs){bs=sc;best=n}});
    if(prevBot!==null&&best.m>prevBot+9&&best.s-prevBotT<barT)return null;prevBot=best.m;prevBotT=best.s;return best};
  const hi=pick(Math.max(2,Math.round(maxMel*bpb)),null,top,melGrid);
  const lo=pick(Math.max(1,Math.round(maxBass*bpb)),null,bot,q*2);
  // drop bass notes that double the melody at the same moment, keep the bass below the melody
  // the melody note sounding at a given moment (melody notes last until the next one)
  const hs=hi.slice().sort((a,b)=>a.s-b.s);const melAt=t=>{let m;for(const n of hs){if(n.s<=t+q/2)m=n.m;else break}return m};
  // reduced lines are played legato: each note lasts until the next one (at most two beats)
  const sustain=arr=>arr.sort((a,b)=>a.s-b.s).map((n,i)=>{const nx=arr[i+1];const e=Math.max(n.e,Math.min(nx?nx.s:n.s+2*tpq,n.s+2*tpq));return Object.assign({},n,{e})});
  return {hi:sustain(hi),lo:sustain(lo.filter(n=>{const m=melAt(n.s);return m===undefined||n.m<m-3}))}}
function densityOf(ns,tpq,usq){if(ns.length<2)return 0;let t0=Infinity,t1=-Infinity;for(const n of ns){if(n.s<t0)t0=n.s;if(n.e>t1)t1=n.e}   // [RibbitBeat 10-19] pętlą, nie spread (jak w midiMelody)
  const sec=(t1-t0)*usq/1e6/tpq;const on=new Set(ns.map(n=>Math.round(n.s/(tpq/8)))).size;return sec>0?on/sec:0}
function autoSplit(raw){const cnt={};raw.forEach(n=>cnt[n.m]=(cnt[n.m]||0)+1);const ps=Object.keys(cnt).map(Number).sort((a,b)=>a-b);
  let best=60,bestGap=0;for(let i=1;i<ps.length;i++){const a=ps[i-1],b=ps[i];if(b<50||a>69)continue;const gap=b-a;if(gap>bestGap||(gap===bestGap&&Math.abs((a+b)/2-60)<Math.abs(best-60))){bestGap=gap;best=Math.round((a+b)/2)}}
  return bestGap>=2?best:60}
const b64=buf=>{let t='';new Uint8Array(buf).forEach(c=>t+=String.fromCharCode(c));return btoa(t)};const unb64=t=>Uint8Array.from(atob(t),c=>c.charCodeAt(0)).buffer;
// [Żabi chór] `opt.forGame`: partie zostają w oktawach z pliku (shift 0), a każda ścieżka niesie
// nazwę, numer, kanał i rodzaj (podział rąk, uproszczenie, wszystkie razem), których potrzebuje gra.
function parseMidiFile(buf,title,opt){
 try{   // [RibbitBeat] każdy odczyt poza plikiem (RangeError z DataView) = jeden zrozumiały komunikat, nie wyjątek z kodu
  const d=new DataView(buf);let p=0;const u32=()=>{const v=d.getUint32(p);p+=4;return v},u16=()=>{const v=d.getUint16(p);p+=2;return v},u8=()=>d.getUint8(p++);
  const vlq=()=>{let v=0,b;do{b=u8();v=(v<<7)|(b&0x7f)}while(b&0x80);return v};
  if(d.byteLength<14||u32()!==0x4D546864)throw new Error('To nie jest plik MIDI');const hl=u32();const fmt=u16(),ntr=u16(),div=u16();p=8+hl;
  if(div&0x8000)throw new Error('Nieobsługiwany format czasu SMPTE');const tpq=div;
  // tempa: wszystkie zdarzenia 0x51 ze wszystkich ścieżek (mapa tempa); `usq` = pierwsze, tempo gry jak dotąd
  let num=4,den=4,tsSet=false,usq=500000,tempoSet=false,uciety=false;const tracks=[],names=[],tempa=[];
  // [RibbitBeat 11-19] instrumenty z pliku: pierwsza zmiana programu (0xC0) na kanale w ścieżce, a gdy ścieżka jej nie ma,
  // pierwsza na tym kanale w całym pliku. Gra tłumaczy numer General MIDI na swoją barwę (silnik MIDI „Jak w pliku”).
  const progs=[],progAll={};
  for(let t=0;t<ntr&&p<d.byteLength;t++){
    if(p+8>d.byteLength){uciety=true;break}
    if(u32()!==0x4D54726B){break}const len=u32();if(p+len>d.byteLength)uciety=true;const end=Math.min(p+len,d.byteLength);let tick=0,rs=0,tname='';const on={},notes=[],prog={};
    try{while(p<end){tick+=vlq();let st=d.getUint8(p);if(st&0x80){p++;rs=st}else st=rs;
      const ty=st&0xf0,ch=st&15;
      if(st===0xFF){const mt=u8(),ml=vlq();if(mt===0x58&&!tsSet){num=d.getUint8(p);den=Math.pow(2,d.getUint8(p+1));tsSet=true}if(mt===0x51&&ml>=3){const v=(d.getUint8(p)<<16)|(d.getUint8(p+1)<<8)|d.getUint8(p+2);if(v>0){tempa.push({tick,usq:v});if(!tempoSet){usq=v;tempoSet=true}}}if(mt===0x03&&!tname){let t2='';for(let j=0;j<ml;j++)t2+=String.fromCharCode(d.getUint8(p+j));tname=t2.trim()}p+=ml;continue}
      if(st===0xF0||st===0xF7){p+=vlq();continue}
      if(ty===0x90||ty===0x80){const n=u8(),v=u8();const k=ch+':'+n;
        if(ty===0x90&&v>0){on[k]={n,s:tick,ch,v}}else if(on[k]){notes.push({m:n,s:on[k].s,e:tick,ch,v:on[k].v});delete on[k]}}
      else if(ty===0xA0||ty===0xB0||ty===0xE0){p+=2}
      else if(ty===0xC0){const pg=d.getUint8(p)&127;if(prog[ch]==null)prog[ch]=pg;if(progAll[ch]==null)progAll[ch]=pg;p+=1}
      else if(ty===0xD0){p+=1}else{p+=1}
    }}catch(e){if(!e||e.name!=='RangeError')throw e;uciety=true}   // plik ucięty w środku zdarzenia: nuty do tego miejsca zostają
    p=end;tracks.push(notes);names.push(tname);progs.push(prog);if(uciety)break;
  }
  if(uciety&&!tracks.some(ns=>ns.length))throw new Error('Plik MIDI jest uszkodzony albo niekompletny');
  const mapa=mapaTempa(tempa,usq);   // null = jedno tempo (nuty jak dotąd, bez przeliczania)
  // every track × channel (without drums) becomes a selectable part; melody = highest voice
  const bpb=num*4/den,q=tpq/4;const parts=[];const all=[];
  const perk=[],progOf=(ti,ch)=>progs[ti]&&progs[ti][ch]!=null?progs[ti][ch]:(progAll[ch]!=null?progAll[ch]:null);   // [RibbitBeat 11-19]
  tracks.forEach((ns,ti)=>{const byCh={};ns.forEach(n=>{if(n.ch===9){perk.push(n);return}const pg=progOf(ti,n.ch);if(pg!=null)n.pr=pg;(byCh[n.ch]=byCh[n.ch]||[]).push(n);all.push(n)});
    Object.entries(byCh).forEach(([ch,list])=>{if(list.length<4)return;const nm=(names[ti]||'').toLowerCase();
      // hand detection: track name, or Casio lesson convention (channel 4 = right hand, 3 = left hand)
      let hand=/right|\brh\b|r\.h\.|treble|melod|prawa|sopran|vocal|lead/.test(nm)?'R':/left|\blh\b|l\.h\.|bass|lewa|accomp/.test(nm)?'L':+ch===3?'R':+ch===2?'L':'';
      parts.push({hand,label:(hand==='R'?'✋ Prawa ręka · ':hand==='L'?'Lewa ręka · ':'')+'Ścieżka '+(ti+1)+(names[ti]?' „'+names[ti].slice(0,22)+'”':'')+' · kanał '+(+ch+1),raw:list,name:names[ti]||'',track:ti,ch:+ch,prog:progOf(ti,+ch)})})});   // [Żabi chór] name/track/ch; [RibbitBeat 11-19] prog
  const realN=parts.length;
  // how playable is a one-hand line for a child: share of moments where the hand would have to cover more than an octave within one beat,
  // or leap more than an octave between neighbouring notes
  const awkward=(raw)=>{if(raw.length<8)return 0;const ns=raw.slice().sort((a,b)=>a.s-b.s);let bad=0;const beat=tpq;
    for(let i=1;i<ns.length;i++){if(Math.abs(ns[i].m-ns[i-1].m)>12&&ns[i].s-ns[i-1].s<beat){bad++;continue}
      let lo=ns[i].m,hi=ns[i].m;for(let j=i-1;j>=0&&ns[i].s-ns[j].s<beat;j--){lo=Math.min(lo,ns[j].m);hi=Math.max(hi,ns[j].m)}if(hi-lo>14)bad++}
    return bad/ns.length};
  const dens=densityOf(all,tpq,usq);const partDens=Math.max(0,...parts.map(p=>densityOf(p.raw,tpq,usq)));const chans=new Set(all.map(n=>n.ch)).size;
  let needReduce=all.length>=24&&(realN>=3||dens>7||partDens>6||(realN===2&&chans>=2&&dens>5)),reduceWhy=needReduce?(realN+' partii, '+Math.round(dens*10)/10+' nut/s'):'';
  // one part holding both hands: let the analyser decide whether and how to divide it (the user can still change hands or the split point)
  let split=null;{const big=parts.slice().sort((a,b)=>b.raw.length-a.raw.length)[0];
    if(big){const an=analyseSplit(big.raw,tpq);if(an){const {hi,lo}=splitHands(big.raw,an.method,an.at,tpq);
      if(hi.length>=8&&lo.length>=8){const src=big.label.replace(/^.*?Ścieżka/,'ścieżki');split={raw:big.raw,at:an.at,method:an.method,why:an.why,src};
        parts.unshift({hand:'L',label:splitLabel('L',split),raw:lo,split:'L'});parts.unshift({hand:'R',label:splitLabel('R',split),raw:hi,split:'R'});
        // a split that still asks one hand to leap around (arpeggiated accompaniment, wide broken chords) is not something a child can play
        const aw=Math.max(awkward(hi),awkward(lo));if(!needReduce&&aw>.18){needReduce=true;reduceWhy='rozłożone akordy / skoki ('+Math.round(aw*100)+'% nut)'}}}
    // a plain one-hand track that itself leaps a lot also gets the simplified version
    else if(big&&!needReduce&&awkward(big.raw)>.18){needReduce=true;reduceWhy='skoki ponad oktawę ('+Math.round(awkward(big.raw)*100)+'% nut)'}}}
  // many parts, an unplayably dense file, or an unplayable split: a two-hand reduction of everything together (melody line + bass line)
  let reduced=null;if(needReduce){
      const arp=/rozłożone|skoki/.test(reduceWhy);let {hi,lo}=reduceForTwoHands(all,tpq,bpb,usq,arp?1.5:3,arp?.75:1,arp?tpq:tpq/4);
      // the thinned top and bottom lines go through the same cost-based hand assignment (no crossing, lines stay in one hand)
      {const q=tpq/4,seen=new Set(),pool=[];hi.map(n=>Object.assign({},n,{vc:'T'})).concat(lo.map(n=>Object.assign({},n,{vc:'B'}))).forEach(n=>{const k=Math.round(n.s/q)+':'+n.m;if(seen.has(k))return;seen.add(k);pool.push(n)});
        if(pool.length>=16){const at=autoSplit(pool);const asg=assignHandsBeam(pool,at,tpq,{regW:.45,switchW:3,voiceW:3});if(asg.hi.length>=8&&asg.lo.length>=4){hi=asg.hi;lo=asg.lo}}}
      if(hi.length>=8){reduced={tracks:realN,dens:Math.round(dens*10)/10,why:reduceWhy};
        parts.unshift({hand:'L',label:'Lewa ręka (uproszczony bas'+(realN>1?' ze wszystkich '+realN+' partii':'')+')',raw:lo,reduced:'L'});
        parts.unshift({hand:'R',label:'✋ Prawa ręka (uproszczona melodia'+(realN>1?' ze wszystkich '+realN+' partii':'')+')',raw:hi,reduced:'R'})}}
  if(!parts.length&&!all.length&&tracks.some(ns=>ns.some(n=>n.ch===9)))throw new Error('Ten plik ma tylko perkusję, a żaby śpiewają melodię');
  if(!parts.length)throw new Error('Nie znalazłem melodii w tym pliku');
  if(realN>1)parts.push({hand:'',label:'Wszystkie ścieżki razem',raw:all,all:true});   // [Żabi chór] all
  const commonShift=(lists)=>{let lo=Infinity,hi=-Infinity;for(const l of lists)for(const n of l){if(n.m<lo)lo=n.m;if(n.m>hi)hi=n.m}if(lo===Infinity)return 0;
    let sh=0;while(lo+sh<36)sh+=12;while(hi+sh>96&&lo+sh-12>=36)sh-=12;return sh};
  let s0=Infinity;for(const n of all)if(n.s<s0)s0=n.s;
  const origin=Math.floor(s0/tpq/bpb)*bpb; // one time origin for every part of the song
  const melody=(raw,low,sh)=>midiMelody(raw,low,tpq,bpb,(opt&&opt.forGame)?0:sh,origin,mapa);   // [Żabi chór] w grze bez przenoszenia oktaw
  const pairShift={};{const pr=parts.find(p=>p.split==='R'),pl=parts.find(p=>p.split==='L');if(pr&&pl)pairShift.split=commonShift([pr.raw,pl.raw]);
    const rr=parts.find(p=>p.reduced==='R'),rl=parts.find(p=>p.reduced==='L');if(rr&&rl)pairShift.reduced=commonShift([rr.raw,rl.raw])}
  const tr=parts.map(p=>{const mm=melody(p.raw,p.hand==='L',p.split?pairShift.split:p.reduced?pairShift.reduced:undefined);return {label:p.label+' · '+mm.notes.length+' nut',hand:p.hand,notes:mm.notes,nBars:mm.nBars,
    name:p.name||'',track:p.track,ch:p.ch,split:p.split||'',reduced:p.reduced||'',all:!!p.all /* [Żabi chór] pola dla gry */,
    prog:p.prog==null?null:p.prog /* [RibbitBeat 11-19] program General MIDI ścieżki albo null */}});
  let bi=0;tr.forEach((t,i)=>{if(i<tr.length-(realN>1?1:0)&&t.notes.length>tr[bi].notes.length)bi=i});
  let ri=parts.findIndex(p=>p.reduced==='R');if(ri<0)ri=parts.findIndex(p=>p.hand==='R'&&!p.split);if(ri<0)ri=parts.findIndex(p=>p.hand==='R');if(ri>=0)bi=ri;
  let li=parts.findIndex(p=>p.reduced==='L');if(li<0)li=parts.findIndex(p=>p.hand==='L'&&!p.split);if(li<0)li=parts.findIndex(p=>p.hand==='L');if(li>=0&&!parts[li].raw.length)li=-1;
  const sR=parts.findIndex(p=>p.split==='R'),sL=parts.findIndex(p=>p.split==='L');
  const bpm=Math.max(20,Math.min(600,Math.round(60000000/usq)));
  const res={id:'midi-'+title.toLowerCase().replace(/[^a-z0-9ąćęłńóśźż]+/g,'-').slice(0,40),title,sub:reduced?'z pliku MIDI · uproszczone na 2 ręce ('+reduced.why+')':'z pliku MIDI',beats:bpb,bpl:4,tempo:bpm,hue:[.3,.85,.95],tracks:tr,trackIdx:bi,lIdx:li,notes:tr[bi].notes,nBars:tr[bi].nBars,kind:'midi',pv:8,reduced,defHands:li>=0?'both':'R',split:split?{raw:split.raw,at:split.at,method:split.method,why:split.why,src:split.src,tpq,bpb,origin,ri:sR,li:sL,mapa}:null};
  // [RibbitBeat] przy kilku tempach `all` (tło, oryginał w szufladzie) ma ticki „gry”: prawdziwy czas w tempie pierwszym; origin w tych samych tickach
  const allGry=mapa?all.map(n=>Object.assign({},n,{s:tickGry(mapa,n.s),e:tickGry(mapa,n.e)})):all,originGry=mapa?tickGry(mapa,origin*tpq)/tpq:origin;
  res.tempoZmienne=!!mapa;   // [RibbitBeat] nuty z mapy tempa: inny przebieg niż przed 10-18, osobna konkurencja w tablicy wyników
  const perkGry=perk.map(n=>({m:n.m,s:mapa?tickGry(mapa,n.s):n.s,v:n.v}));   // [RibbitBeat 11-19] perkusja (kanał 10) w tickach gry
  Object.defineProperty(res,'_all',{value:{all:allGry,tpq,usq,parts,origin:originGry,bpb,mapa /* [Żabi chór] origin, bpb */,perk:perkGry},enumerable:false});return res;
 }catch(e){if(e&&e.name==='RangeError')throw new Error('Plik MIDI jest uszkodzony albo niekompletny');throw e}
}
// [RibbitBeat] Mapa tempa: zdarzenia 0x51 (tick, µs na ćwierćnutę) → odcinki [tick, tick gry, współczynnik], gdzie tick gry
// to prawdziwy czas zapisany w tickach przy tempie `usq` (tempie gry). Tempo sprzed pierwszego zdarzenia = tempo pierwszego.
// Plik z jednym tempem daje null, więc jego nuty liczą się dokładnie tak jak przed mapą. Różnica poniżej 1% względem
// bieżącego odcinka to to samo tempo (zaokrąglenia eksportu), a powolne ritardando i tak wychodzi, bo porównujemy z odcinkiem.
function mapaTempa(tempa,usq){
  const ts=tempa.slice().sort((a,b)=>a.tick-b.tick),odc=[],takieSamo=(a,b)=>Math.abs(a-b)<.01*b;
  for(const z of ts){const o=odc[odc.length-1];
    if(!o){odc.push({tick:0,usq:z.usq});continue}
    if(z.tick===o.tick){o.usq=z.usq;continue}   // dwa tempa w tej samej chwili: obowiązuje późniejsze
    if(takieSamo(z.usq,o.usq))continue;
    odc.push({tick:z.tick,usq:z.usq})}
  if(odc.length<2&&(!odc.length||takieSamo(odc[0].usq,usq)))return null;
  let g=0;return odc.map((o,i)=>{if(i)g+=(o.tick-odc[i-1].tick)*odc[i-1].usq/usq;return [o.tick,g,o.usq/usq]});
}
function tickGry(mapa,tick){
  if(!mapa)return tick;let a=0,b=mapa.length-1;while(a<b){const c=(a+b+1)>>1;if(mapa[c][0]<=tick)a=c;else b=c-1}
  return mapa[a][1]+(tick-mapa[a][0])*mapa[a][2];
}


// ---------------------------------------------------------------------------------------------
// MODEL GRY

// Ile ćwierćnut ma każdy takt zapisu. Test pilnuje, że wbudowane piosenki trzymają swoje metrum:
// takt za krótki albo za długi przesuwa całą resztę piosenki względem akompaniamentu.
function sumyTaktow(src){
  return String(src).split("|").map(bar=>bar.trim().split(/\s+/).filter(Boolean)
    .reduce((s,tok)=>s+(+tok.split("/")[1]||0),0));
}
// Partia gry z listy nut: nuty posortowane po czasie, bez pól trenera (palce), plus zakres i średnia
// wysokość. Średnia układa tory od najwyższego głosu u góry, zakres wyznacza rzędy toru i mapowanie
// przechyłu (najniższa nuta −2 półtony … najwyższa +2 półtony).
function opiszPartie(p){
  const nuty=(p.nuty||[]).map(n=>({m:+n.m,t:+n.t,d:+n.d}))
    .filter(n=>Number.isFinite(n.m)&&Number.isFinite(n.t)&&n.d>0).sort((a,b)=>a.t-b.t);
  let lo=Infinity,hi=-Infinity,suma=0;
  for(const n of nuty){if(n.m<lo)lo=n.m;if(n.m>hi)hi=n.m;suma+=n.m;}
  if(!nuty.length){lo=60;hi=60;}
  return {rola:p.rola||"glos",nazwaSciezki:p.nazwaSciezki||"",numerSciezki:p.numerSciezki||0,
    nuty,lo,hi,srednia:nuty.length?suma/nuty.length:60};
}
function domknijPiosenke(s){
  let koniec=0;
  for(const p of s.partie)for(const n of p.nuty)koniec=Math.max(koniec,n.t+n.d);
  for(const n of (s.tlo||[]))koniec=Math.max(koniec,n.t+n.d);
  s.koniec=koniec;
  return s;
}
// ---------------------------------------------------------------------------------------------
// ŹRÓDŁO PIOSENKI I JEJ PARAMETRY
// Źródło to wszystko, z czego da się zbudować piosenkę: lista ścieżek do wyboru (te same, co listy
// „Prawa” i „Lewa” w trenerze), metrum, tempo i liczba taktów. Parametry (szuflada „Ustawienia
// piosenki”) mówią, co z tego zbudować:
//   Zrodlo {id, tytul, opis, metrum, tempo, tempoPliku, takty, rodzaj:"wbudowana"|"midi",
//           sciezki:[Sciezka], domMelodia, domPodklad, podzial:{at,method,raw,tpq,bpb,origin,ri,li}|null, w}
//   Sciezka {etykieta, nuty:[{m,t,d}], reka:"R"|"L"|"", rodzaj:"sciezka"|"podzial"|"uproszczenie"|"wszystkie",
//            strona:"R"|"L"|"", nazwa, numer, surowe (nuty z pliku w tickach, tylko MIDI)}
//   Parametry {melodia, podklad, podzial (punkt podziału rąk), od, do (takty od 1), powtorz (1–5),
//              tempo (ćwierćnuty na minutę albo null = z pliku)}
//   podklad: ZC_PODKLAD.AUTO (-1) = reszta partii (druga ręka podziału albo uproszczenia, przy
//   prawdziwej ścieżce pozostałe ścieżki jako głosy chóru), ZC_PODKLAD.BRAK (-2) = sama melodia,
//   liczba ≥ 0 = ta ścieżka gra akompaniament.
// Dla gry melodia to ścieżka, którą trener dałby prawej ręce, a podkład to reszta partii: przy melodii
// z podziału lewa ręka, przy uproszczeniu uproszczony bas, przy melodii z prawdziwej ścieżki pozostałe
// ścieżki (to one są głosami chóru, a te, których nikt nie śpiewa, gra instrument).
const ZC_TEMPO_GRY={MIN:30,MAX:140};   // tempo pliku poza tym zakresem gra startuje w najbliższym (do zmiany w szufladzie)
const ZC_POWTORZ=[1,2,3,5];
const ZC_PODKLAD={AUTO:-1,BRAK:-2};

// Wbudowana piosenka trenera: melodia i (jeśli jest) akompaniament z lewej ręki.
function zrodloZNotacji(def){
  const nuty=src=>parseBars(src,def.beats).map(n=>({m:n.m,t:n.t,d:n.d}));
  const sciezki=[{etykieta:T.sciezkaMelodia,nuty:nuty(def.src),reka:"R",rodzaj:"sciezka",strona:"",nazwa:"",numer:0}];
  if(def.left)sciezki.push({etykieta:T.sciezkaAkomp,nuty:nuty(def.left),reka:"L",rodzaj:"sciezka",strona:"",nazwa:"",numer:0});
  return {id:def.id,tytul:def.title,opis:def.sub||"",metrum:def.beats,tempo:def.tempo,tempoPliku:def.tempo,
    takty:String(def.src).split("|").length,rodzaj:"wbudowana",sciezki,domMelodia:0,domPodklad:def.left?1:-1,podzial:null,w:null};
}
// Czy linia z pliku da się zaśpiewać jednym głosem: najwyżej 15% chwil z dwiema nutami naraz (akordy).
function jednoglosowa(raw,tpq){
  if(!raw||raw.length<2)return true;
  const q=Math.max(1,tpq/8),grupy=new Map();
  for(const n of raw){const k=Math.round(n.s/q);grupy.set(k,(grupy.get(k)||0)+1);}
  let akordy=0;for(const v of grupy.values())if(v>=2)akordy++;
  return akordy/grupy.size<=.15;
}
// Wynik parseMidiFile → źródło. Domyślna melodia, w tej kolejności:
//  1) ścieżka rozpoznana po nazwie jako prawa ręka/melodia (sopran, vocal, lead…), jeśli jest jednogłosowa:
//     plik chóralny zostaje głosami chóru (gdyby wziąć uproszczenie, alt i tenor nie miałyby torów),
//  2) uproszczona melodia trenera (gęsty albo wielopartiowy plik),
//  3) prawa ręka z podziału jednej ścieżki,
//  4) najwyżej śpiewająca ze ścieżek, które mają choć ćwierć nut najbogatszej (trzynutowy dzwonek nie
//     zostaje melodią tylko dlatego, że stoi najwyżej).
function zrodloZMidi(w){
  const A=w._all||{},czesci=A.parts||[];
  // prawdziwa ścieżka bez „✋ Prawa ręka · ” z przodu: w chórze ręce nic nie znaczą, a konwencja kanałów
  // Casio (kanał 4 = prawa) podpisywała tak np. bas; ścieżki z podziału i uproszczenia zostają jak w trenerze
  const bezReki=t=>t.split||t.reduced||t.all?t.label:String(t.label).replace(/^(✋ Prawa ręka|Lewa ręka) · /,"");
  const sciezki=w.tracks.map((t,i)=>({etykieta:bezReki(t),nuty:t.notes.map(n=>({m:n.m,t:n.t,d:n.d})),reka:t.hand||"",
    rodzaj:t.all?"wszystkie":t.reduced?"uproszczenie":t.split?"podzial":"sciezka",strona:t.reduced||t.split||"",
    nazwa:t.name||"",numer:(t.track|0)+1,surowe:czesci[i]?czesci[i].raw:null,program:t.prog==null?null:t.prog}));
  const znajdz=f=>sciezki.findIndex(f);
  const prawdziwe=sciezki.map((s,i)=>i).filter(i=>sciezki[i].rodzaj==="sciezka"&&sciezki[i].nuty.length);
  let mi=znajdz(s=>s.rodzaj==="sciezka"&&s.reka==="R"&&s.nuty.length&&jednoglosowa(s.surowe,A.tpq||480));
  if(mi<0)mi=znajdz(s=>s.rodzaj==="uproszczenie"&&s.strona==="R"&&s.nuty.length);
  if(mi<0)mi=znajdz(s=>s.rodzaj==="podzial"&&s.strona==="R"&&s.nuty.length);
  if(mi<0&&prawdziwe.length){
    const maxN=Math.max(...prawdziwe.map(i=>sciezki[i].nuty.length)),dosc=i=>sciezki[i].nuty.length*4>=maxN;
    const sr=i=>sciezki[i].nuty.reduce((s,n)=>s+n.m,0)/sciezki[i].nuty.length;
    mi=prawdziwe[0];for(const i of prawdziwe)if(dosc(i)&&(!dosc(mi)||sr(i)>sr(mi)))mi=i;
  }
  if(mi<0)mi=znajdz(s=>s.nuty.length&&s.rodzaj!=="wszystkie");   // „wszystkie razem” to podkład, nie partia
  if(mi<0)mi=znajdz(s=>s.nuty.length);
  if(mi<0)throw new Error("Nie znalazłem melodii w tym pliku");
  const m=sciezki[mi];
  const li=m.rodzaj==="uproszczenie"||m.rodzaj==="podzial"?znajdz(s=>s.rodzaj===m.rodzaj&&s.strona==="L"&&s.nuty.length):-1;
  let koniec=0;for(const s of sciezki)for(const n of s.nuty)koniec=Math.max(koniec,n.t+n.d);
  return {id:w.id,tytul:w.title,opis:"",metrum:w.beats,tempoPliku:w.tempo,
    tempo:Math.max(ZC_TEMPO_GRY.MIN,Math.min(ZC_TEMPO_GRY.MAX,w.tempo)),
    takty:Math.max(1,Math.ceil(koniec/w.beats-1e-6)),rodzaj:"midi",sciezki,domMelodia:mi,domPodklad:li,podzial:w.split||null,w};
}
// Bajty pliku → źródło. Nazwa pliku bez rozszerzenia zostaje tytułem; id to nazwa i skrót bajtów, więc
// „Cztery_glosy.mid” i „cztery-glosy.mid” o różnej treści są dwiema piosenkami, a ten sam plik zawsze jedną.
function zrodloZPliku(buf,nazwaPliku){
  const tytul=String(nazwaPliku||"MIDI").replace(/\.(mid|midi)$/i,"").replace(/_+/g," ").trim()||"MIDI",skrot=skrotBajtow(buf);
  const zr=zrodloZMidi(parseMidiFile(buf,tytul,{forGame:true}));
  zr.id+="-"+skrot;
  // SHA-256 bajtów: klucz tablicy wyników RibbitBeat (ten sam plik = ten sam skrót pod każdą nazwą i na każdym
  // komputerze); nazwa i rozmiar zostają do opisu i do przeniesienia wierszy sprzed 10-18 (kluczZNazwy w tablica.js)
  zr.plik=String(nazwaPliku||"");zr.rozmiar=(buf&&buf.byteLength)|0;zr.hash=sha256Hex(buf||new Uint8Array(0));
  return zr;
}
// Skrót bajtów pliku: FNV-1a (32 bity) jako 6 znaków base36.
function skrotBajtow(buf){
  const b=buf instanceof Uint8Array?buf:new Uint8Array(buf);let h=0x811c9dc5;
  for(let i=0;i<b.length;i++){h^=b[i];h=Math.imul(h,0x01000193);}
  return ("00000"+(h>>>0).toString(36)).slice(-6);
}
// SHA-256 (FIPS 180-4) bajtów pliku jako 64 znaki szesnastkowo. Synchronicznie i bez crypto.subtle, bo ten działa tylko
// w bezpiecznym kontekście (gra bywa otwierana z adresu w sieci lokalnej), a klucz tablicy wyników jest potrzebny od razu.
// Ten sam skrót podają manifesty pakietów (`sha256`) i `sha256sum`, więc wyniki da się kiedyś zebrać w jeden ranking.
function sha256Hex(buf){
  const K=sha256Hex.K||(sha256Hex.K=new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,
    0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,
    0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]));
  const b=buf instanceof Uint8Array?buf:new Uint8Array(buf),n=b.length,dl=Math.ceil((n+9)/64)*64;
  const m=new Uint8Array(dl);m.set(b);m[n]=0x80;   // dopełnienie: bit 1, zera, długość w bitach na 64 bitach
  const dv=new DataView(m.buffer);dv.setUint32(dl-8,Math.floor(n/0x20000000));dv.setUint32(dl-4,(n*8)>>>0);
  const H=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]),W=new Uint32Array(64);
  for(let o=0;o<dl;o+=64){
    for(let i=0;i<16;i++)W[i]=dv.getUint32(o+i*4);
    for(let i=16;i<64;i++){const x=W[i-15],y=W[i-2];
      W[i]=W[i-16]+(((x>>>7)|(x<<25))^((x>>>18)|(x<<14))^(x>>>3))+W[i-7]+(((y>>>17)|(y<<15))^((y>>>19)|(y<<13))^(y>>>10));}
    let a=H[0],c1=H[1],c2=H[2],d=H[3],e=H[4],f=H[5],g=H[6],h=H[7];
    for(let i=0;i<64;i++){
      const t1=(h+(((e>>>6)|(e<<26))^((e>>>11)|(e<<21))^((e>>>25)|(e<<7)))+((e&f)^(~e&g))+K[i]+W[i])|0;
      const t2=((((a>>>2)|(a<<30))^((a>>>13)|(a<<19))^((a>>>22)|(a<<10)))+((a&c1)^(a&c2)^(c1&c2)))|0;
      h=g;g=f;f=e;e=(d+t1)|0;d=c2;c2=c1;c1=a;a=(t1+t2)|0;
    }
    H[0]+=a;H[1]+=c1;H[2]+=c2;H[3]+=d;H[4]+=e;H[5]+=f;H[6]+=g;H[7]+=h;
  }
  let s="";for(let i=0;i<8;i++)s+=("0000000"+H[i].toString(16)).slice(-8);
  return s;
}
function parametryDomyslne(zr){
  return {melodia:zr.domMelodia,podklad:ZC_PODKLAD.AUTO,podzial:zr.podzial?zr.podzial.at:null,od:1,do:zr.takty,powtorz:1,tempo:null};
}
// „Reszta partii” dla wybranej melodii: druga ręka tego samego podziału albo uproszczenia, przy wbudowanej
// piosence druga ścieżka; przy prawdziwej ścieżce MIDI nic (-1), bo resztą są pozostałe ścieżki-głosy.
function domyslnyPodklad(zr,mi){
  const m=zr.sciezki[mi];if(!m)return -1;
  if(zr.rodzaj==="wbudowana")return zr.sciezki.length>1?(mi===0?1:0):-1;
  if(m.rodzaj==="uproszczenie"||m.rodzaj==="podzial"){
    const druga=m.strona==="R"?"L":"R";
    return zr.sciezki.findIndex(s=>s.rodzaj===m.rodzaj&&s.strona===druga&&s.nuty.length);
  }
  return -1;
}
// Parametry z zapisu (localStorage, plik w folderze, szuflada) przycięte do tego, co ma TA piosenka:
// zapis sprzed zmiany analizatora może wskazywać ścieżkę, której już nie ma.
function poprawParametry(zr,par){
  const p=Object.assign(parametryDomyslne(zr),par||{}),n=zr.sciezki.length,cal=v=>Math.round(+v);
  // melodia to ścieżka do śpiewania: „wszystkie ścieżki razem” trener podaje jako rękę, w chórze jest tylko podkładem
  const mel=Number.isInteger(cal(p.melodia))&&cal(p.melodia)>=0&&cal(p.melodia)<n?zr.sciezki[cal(p.melodia)]:null;
  if(!(mel&&mel.nuty.length&&(mel.rodzaj!=="wszystkie"||zr.sciezki[zr.domMelodia]===mel)))p.melodia=zr.domMelodia;
  else p.melodia=cal(p.melodia);
  p.podklad=Number.isFinite(+p.podklad)&&p.podklad!==null?cal(p.podklad):ZC_PODKLAD.AUTO;
  if(p.podklad<ZC_PODKLAD.BRAK||p.podklad>=n||p.podklad===p.melodia)p.podklad=ZC_PODKLAD.AUTO;
  p.podzial=zr.podzial?Math.max(36,Math.min(84,Number.isFinite(+p.podzial)&&p.podzial!==null?cal(p.podzial):zr.podzial.at)):null;
  p.od=Math.max(1,Math.min(zr.takty,Number.isFinite(+p.od)?cal(p.od):1));
  p.do=Math.max(p.od,Math.min(zr.takty,Number.isFinite(+p.do)?cal(p.do):zr.takty));
  p.powtorz=ZC_POWTORZ.includes(cal(p.powtorz))?cal(p.powtorz):1;
  p.tempo=p.tempo==null||p.tempo===""||!Number.isFinite(+p.tempo)?null:Math.max(30,Math.min(200,cal(p.tempo)));
  return p;
}
// Nowy punkt podziału rąk (lista „Podział od …” w trenerze): ta sama metoda, co wybrał analizator,
// inna granica. Zwraca nuty i etykiety obu rąk albo null, gdy piosenka nie ma podziału.
function podzielPonownie(zr,at){
  const sp=zr.podzial;if(!sp||!sp.raw)return null;
  const {hi,lo}=splitHands(sp.raw,sp.method||"gap",at,sp.tpq);
  const R=midiMelody(hi,false,sp.tpq,sp.bpb,0,sp.origin,sp.mapa),L=midiMelody(lo,true,sp.tpq,sp.bpb,0,sp.origin,sp.mapa);
  const s={method:sp.method||"gap",at};
  return {R:R.notes.map(n=>({m:n.m,t:n.t,d:n.d})),L:L.notes.map(n=>({m:n.m,t:n.t,d:n.d})),
    etR:splitLabel("R",s)+" · "+R.notes.length+" nut",etL:splitLabel("L",s)+" · "+L.notes.length+" nut"};
}
// Tło: nuty pliku, których nie śpiewa żadna partia (środek akordów, reszta aranżacji przy uproszczeniu).
// Gra je instrument, ciszej; najwyżej trzy nuty w jednej szesnastce (najniższa, środkowa, najwyższa),
// żeby gęsty plik nie zamienił podkładu w ścianę dźwięku.
function tloPiosenki(zr,partie){
  const A=zr.w&&zr.w._all;if(!A||!A.all||!A.all.length)return [];
  const q=.25,zajete=new Set();
  for(const p of partie)for(const n of p.nuty){const k=Math.round(n.t/q);zajete.add(n.m+"@"+(k-1));zajete.add(n.m+"@"+k);zajete.add(n.m+"@"+(k+1));}
  const sloty=new Map();
  for(const r of A.all){
    const t=r.s/A.tpq-(A.origin||0);if(t<-1e-6)continue;
    const k=Math.round(t/q);if(zajete.has(r.m+"@"+k))continue;
    if(!sloty.has(k))sloty.set(k,[]);
    const nt={m:r.m,t:+(A.mapa?t:k*q).toFixed(3),/* kilka temp: prawdziwy czas */d:+Math.max(q,(r.e-r.s)/A.tpq).toFixed(3)};
    if(r.pr!=null)nt.p=r.pr;   // 11-19: instrument nuty z pliku (silnik MIDI „Jak w pliku”)
    sloty.get(k).push(nt);
  }
  const out=[];
  for(const ns of sloty.values()){
    ns.sort((a,b)=>a.m-b.m);
    const bez=ns.filter((n,i)=>i===0||n.m!==ns[i-1].m);
    out.push(...(bez.length<=3?bez:[bez[0],bez[bez.length>>1],bez[bez.length-1]]));
  }
  return out.sort((a,b)=>a.t-b.t||a.m-b.m);
}
// Fragment piosenki od ćwierćnuty `od` przez `ile` ćwierćnut, powtórzony `razy` razy, czas od zera.
function fragmentNut(nuty,od,ile,razy){
  const kawalek=[];
  for(const n of nuty){
    if(n.t<od-1e-6||n.t>=od+ile-1e-6)continue;
    const x={m:n.m,t:+(n.t-od).toFixed(3),d:+Math.min(n.d,od+ile-n.t).toFixed(3)};
    if(n.p!=null)x.p=n.p;   // 11-19: instrument nuty tła zostaje przy fragmencie
    kawalek.push(x);
  }
  const out=[];
  for(let k=0;k<Math.max(1,razy|0);k++)for(const n of kawalek){const x={m:n.m,t:+(n.t+k*ile).toFixed(3),d:n.d};if(n.p!=null)x.p=n.p;out.push(x);}
  return out;
}
// PERKUSJA Z PLIKU (11-19): uderzenia z kanału 10 jako [{t (ćwierćnuty), typ (litera bębna z Glos.bebny), v (0–1)}].
// Zestaw General MIDI sprowadzony do ośmiu bębnów gry: k kopniak, s werbel, r rim, c klaśnięcie, h hi-hat, o otwarty
// hi-hat, t tom, x talerz. Przeszkadzajki bez odpowiednika (trójkąt, gwizdek, guiro …) są pomijane.
const ZC_GM_PERKUSJA={35:"k",36:"k",37:"r",38:"s",39:"c",40:"s",41:"t",42:"h",43:"t",44:"h",45:"t",46:"o",47:"t",48:"t",49:"x",50:"t",
  51:"h",52:"x",53:"h",54:"h",55:"x",56:"r",57:"x",59:"h",69:"h",70:"h",75:"r",76:"r",77:"r",82:"h"};
function perkusjaPiosenki(zr){
  const A=zr.w&&zr.w._all;if(!A||!A.perk||!A.perk.length)return [];
  const out=[];
  for(const r of A.perk){
    const typ=ZC_GM_PERKUSJA[r.m],t=r.s/A.tpq-(A.origin||0);if(!typ||t<-1e-6)continue;
    out.push({t:+t.toFixed(3),typ,v:+Math.max(.1,Math.min(1,(r.v||90)/127)).toFixed(2)});
  }
  return out.sort((a,b)=>a.t-b.t);
}
function fragmentPerkusji(perk,od,ile,razy){
  const kawalek=perk.filter(n=>n.t>=od-1e-6&&n.t<od+ile-1e-6),out=[];
  for(let k=0;k<Math.max(1,razy|0);k++)for(const n of kawalek)out.push({t:+(n.t-od+k*ile).toFixed(3),typ:n.typ,v:n.v});
  return out;
}
// Źródło + parametry → piosenka do gry (model z nagłówka pliku). Partie: melodia, podkład (jeśli jest)
// i prawdziwe ścieżki, których nie zużyły melodia ani podkład, od najwyżej śpiewającej.
function piosenkaZeZrodla(zr,par){
  const p=poprawParametry(zr,par);
  const sc=zr.sciezki.map(s=>Object.assign({},s));
  if(zr.podzial&&p.podzial!=null&&p.podzial!==zr.podzial.at){
    const nowe=podzielPonownie(zr,p.podzial);
    if(nowe){
      if(sc[zr.podzial.ri])Object.assign(sc[zr.podzial.ri],{nuty:nowe.R,etykieta:nowe.etR});
      if(sc[zr.podzial.li])Object.assign(sc[zr.podzial.li],{nuty:nowe.L,etykieta:nowe.etL});
    }
  }
  const mi=p.melodia,bez=p.podklad===ZC_PODKLAD.BRAK,li=bez?-1:p.podklad===ZC_PODKLAD.AUTO?domyslnyPodklad(zr,mi):p.podklad,mel=sc[mi];
  // 11-19: program General MIDI partii (instrument z pliku): własny ścieżki, przy podziale rąk program ścieżki źródłowej,
  // przy uproszczeniu i „wszystkich razem” brak (null = gra bierze zwykły instrument podkładu)
  const programSc=s=>{
    if(s.program!=null)return s.program;
    if(s.rodzaj==="podzial"&&zr.podzial){const z=sc.find(x=>x.rodzaj==="sciezka"&&x.surowe&&x.surowe===zr.podzial.raw);if(z&&z.program!=null)return z.program;}
    return null;
  };
  const partia=(s,rola)=>Object.assign(opiszPartie({rola,nazwaSciezki:s.nazwa||"",numerSciezki:s.numer||0,nuty:s.nuty}),
    {reka:s.strona||s.reka||"",program:programSc(s)});
  const melodia=partia(mel,"melodia");
  const reszta=[];
  if(li>=0&&li!==mi&&sc[li]&&sc[li].nuty.length)reszta.push(partia(sc[li],"akompaniament"));
  // ścieżki zużyte przez melodię i podkład: ta sama ścieżka, źródło podziału, wszystkie przy uproszczeniu
  const zuzyte=new Set();let wszystkie=false;
  for(const i of [mi,li]){
    if(i<0)continue;const s=sc[i];
    if(s.rodzaj==="sciezka")zuzyte.add(i);
    else if(s.rodzaj==="podzial"){if(zr.podzial)sc.forEach((x,j)=>{if(x.rodzaj==="sciezka"&&x.surowe&&x.surowe===zr.podzial.raw)zuzyte.add(j);});}
    else wszystkie=true;
  }
  if(!wszystkie&&!bez)sc.forEach((s,i)=>{if(s.rodzaj==="sciezka"&&!zuzyte.has(i)&&s.nuty.length)reszta.push(partia(s,"glos"));});
  reszta.sort((a,b)=>b.srednia-a.srednia);
  let partie=[melodia,...reszta],tlo=bez?[]:tloPiosenki(zr,partie),perkusja=bez?[]:perkusjaPiosenki(zr);
  const pelny=p.od===1&&p.do===zr.takty&&p.powtorz===1;
  if(!pelny){
    const od=(p.od-1)*zr.metrum,ile=(p.do-p.od+1)*zr.metrum;
    partie=partie.map(x=>Object.assign(opiszPartie({rola:x.rola,nazwaSciezki:x.nazwaSciezki,numerSciezki:x.numerSciezki,
      nuty:fragmentNut(x.nuty,od,ile,p.powtorz)}),{reka:x.reka,program:x.program}));
    tlo=fragmentNut(tlo,od,ile,p.powtorz);perkusja=fragmentPerkusji(perkusja,od,ile,p.powtorz);
    // partia bez nuty we fragmencie nie jest partią do śpiewania (melodia zostaje zawsze, nawet pusta)
    partie=partie.filter((x,i)=>i===0||x.nuty.length);
  }
  return domknijPiosenke({id:zr.id,tytul:zr.tytul,opis:zr.opis,metrum:zr.metrum,tempo:p.tempo||zr.tempo,
    zrodlo:zr.rodzaj==="wbudowana"?"wbudowana":"midi",plik:zr.plik||"",rozmiar:zr.rozmiar||0,hash:zr.hash||"",
    tempoZmienne:!!(zr.w&&zr.w.tempoZmienne),partie,tlo,perkusja,
    fragment:{od:p.od,do:p.do,powtorz:p.powtorz,taktow:zr.takty,caly:pelny}});
}
function piosenkaZNotacji(def){return piosenkaZeZrodla(zrodloZNotacji(def));}
function wbudowanePiosenki(){return BUILTIN.map(piosenkaZNotacji);}
function piosenkaZMidi(w){return piosenkaZeZrodla(zrodloZMidi(w));}
function piosenkaZPliku(buf,nazwaPliku){return piosenkaZeZrodla(zrodloZPliku(buf,nazwaPliku));}
