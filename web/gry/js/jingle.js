"use strict";
// RibbitBeat: jingle zakończeń (2026-10-16). Dwa zastosowania jednego pliku:
//  • koniec piosenki i objawienie sceny (tła) albo efektu z koła nagród: krótki UTWÓR w stylu motywu (nie jeden instrument, tylko
//    kilka ścieżek: melodia, akordy, bas i perkusja syntezowana), np. tiki = hawajski chill z ukulele i marimbą, skatepark = punkowy
//    jungiel z mocnymi akordami i szybką perkusją; każdy jingiel to krótki utwór w stylu muzycznym pasującym do motywu,
//  • sygnały rzadkości nagrody (zwykły, rzadki, epicki, legendarny): cztery osobne, rosnące w rozmachu sztychy (`rzadkosc`).
// Wpis: {bpm, trk:[{i: instrument z glos.js voice() (synth, chip, organ, strings, flute, guitar, marimba, musicbox, epiano, piano),
//   n:[[midi, start w ćwierćnutach, długość, głośność 0..1], …]}], b:[[typ perkusji k s h o t c x r, start, głośność], …]}.
// Motyw bez wpisu (nowy, z innej sesji) = dotychczasowa fanfara. Dodanie motywu = jedna linia tutaj. Czysta synteza: zero plików i licencji.
// 10-17 (runda 5): cudze melodie tylko z domeny publicznej (tarantella neapolitańska, epitafium Seikilosa); „If I Were a Rich Man”
// (1964) jest chroniony prawem autorskim, więc Złoto dostało własny frejlechs w tym samym duchu.
window.Jingle=(function(){
  // ---- pomocnicy zapisu ----
  const mel=(m,t0,krok,v,d)=>m.map((x,i)=>x==null?null:[x,t0+i*krok,d==null?krok*.92:d,v==null?.9:v]).filter(Boolean);   // równe kroki, null = pauza
  const akord=(ms,t,d,v,rozst)=>ms.map((x,i)=>[x,t+i*(rozst||0),d,v==null?.7:v]);                                      // akord z lekkim strumem
  const powt=(f,ile,krok)=>{const o=[];for(let k=0;k<ile;k++)o.push(...f(k*krok,k));return o;};                          // powtórz wzór
  const bity=(wz,t0,krok,v)=>{const o=[];[...wz].forEach((c,i)=>{if(c!==".")o.push([c,t0+i*krok,v==null?1:v]);});return o;};   // „k.s.k.ss” → perkusja
  const J={
    // spokojnie i ciepło: kołysanka na pozytywce i pianinie (walc)
    filc:{bpm:104,trk:[
      {i:"musicbox",n:mel([79,84,83,79,81,84,88],0,.5,.9)},
      {i:"piano",n:[...akord([48,64,67,72],0,1.4,.55,.04),...akord([43,62,67,71],1.5,1.4,.55,.04),...akord([48,64,67,72],3,2.6,.6,.05)]},
      {i:"strings",n:akord([60,64,67],3,2.6,.35)}],b:[]},
    // chiptune: wąskie arpeggio w górę, bas i werbel w stylu NES
    "8bit":{bpm:172,trk:[
      {i:"chip",n:[...mel([72,76,79,84,79,84,88,91,96],0,.25,.9),...mel([96,91,96],2.25,.25,.9),[96,3,1.2,1]]},
      {i:"chip",n:powt(t=>mel([48,48,55,55],t,.5,.5),2,2)}],
      b:[...bity("k.hhs.hhk.hhs.hh",0,.25,.8),["x",3,.5]]},
    // upiorny walc: organy w molu, dzwon i tom, kwaśny akord na końcu
    halloween:{bpm:96,trk:[
      {i:"organ",n:[...mel([69,72,76,75,74,72,69,null,64,65,64,62],0,.5,.7),...akord([57,60,64],3.5,2.5,.7)]},
      {i:"strings",n:[...akord([45,52,57],0,1.5,.5),...akord([44,51,56],1.5,1.5,.5),...akord([45,52,57,60],3.5,2.5,.6)]},
      {i:"marimba",n:[[33,0,2,.9],[33,3.5,2.5,.9]]}],b:bity("t.....t.t...c...",0,.5,.9)},
    // komiksowe „ta-da-da-DAAA”: blachy big bandu, rolka werbla i talerz
    komiks:{bpm:152,trk:[
      {i:"synth",n:[...mel([67,67,72],0,.33,.9),...akord([72,76,79,84],1,1.6,.9,.015)]},
      {i:"organ",n:[...akord([60,64,67],1,1.6,.6),...mel([55,57,59,60],0,.25,.5)]}],
      b:[...bity("ssssssss",.2,.1,.5),["x",1,1],["k",1,1],["s",1,.8]]},
    // bulgoczące marimby i miękkie flety pod wodą
    podwodny:{bpm:116,trk:[
      {i:"marimba",n:mel([72,79,76,84,81,88,84,91,88,96,null,91],0,.25,.85)},
      {i:"flute",n:[[76,0,2,.5],[79,2,2.5,.55]]},
      {i:"epiano",n:[...akord([55,62,67],0,1.5,.5,.03),...akord([57,64,69],1.5,1.5,.5,.03),...akord([60,67,72],3,2,.55,.03)]}],
      b:bity("h..h.h..h.h.o...",0,.25,.5)},
    // rockowy hymn: mocne akordy gitary, kopniak i werbel, talerz
    koncert:{bpm:132,trk:[
      {i:"guitar",n:[...akord([40,47,52,59],0,.5,.9,.012),...akord([40,47,52,59],.5,.5,.8,.012),...akord([43,50,55,62],1,.5,.9,.012),...akord([45,52,57,64],1.5,.5,.9,.012),...akord([40,47,52,59,64],2.25,2.6,1,.015)]},
      {i:"guitar",n:mel([64,67,69,71,74,71,74,76],0,.25,.7,.22)},
      {i:"organ",n:akord([52,59,64],2.25,2.6,.4)}],
      b:[...bity("k.skk.s.k.s.k.s.",0,.25,1),["x",2.25,1],["k",2.25,1],["s",2.25,.9]]},
    // lata 80.: arpeggio syntezatora, bas z bramką, bębny z pogłosem
    synthwave:{bpm:112,trk:[
      {i:"synth",n:powt(t=>mel([57,60,64,69,64,60,64,69],t,.25,.7,.2),2,2)},
      {i:"synth",n:[[33,0,1.8,.8],[33,2,1.8,.8],[36,4,1.5,.8]]},
      {i:"strings",n:akord([57,64,69,72],0,4,.4,.05)}],
      b:[...bity("k.sk.s.kk.sk.s.k",0,.25,.9),["x",4,.6]]},
    // jazzujące pianino i kontrabas na szczotkach
    szkicownik:{bpm:128,trk:[
      {i:"piano",n:[...akord([50,57,62,65],0,.8,.6,.01),...akord([43,55,59,65],1,.8,.6,.01),...akord([48,55,59,64,67],2.2,2.2,.7,.01)]},
      {i:"guitar",n:mel([38,41,43,45,43,41,36,null],0,.5,.6,.4)},
      {i:"flute",n:mel([72,74,77,76,72,null,67],.5,.5,.5)}],b:bity("h.h.h.hhh.h.h.h.",0,.25,.5)},
    // kosmiczny dryf: pad smyczków, iskry dzwonków, brak perkusji
    kosmos:{bpm:78,trk:[
      {i:"strings",n:[...akord([48,55,59,62],0,2.5,.5,.1),...akord([50,57,60,64],2.5,3,.5,.1)]},
      {i:"musicbox",n:mel([96,100,103,108,103,100,96,103],.5,.4,.45,.8)},
      {i:"flute",n:[[79,0,2,.4],[86,2,3,.45]]},{i:"organ",n:[[36,0,5.5,.4]]}],b:[]},
    // bagienny blues z rechotem żab
    staw:{bpm:94,trk:[
      {i:"marimba",n:mel([43,43,50,48,43,50,52,50],0,.5,.9)},
      {i:"epiano",n:[...akord([55,59,62],0,1.4,.5),...akord([55,60,64],2,1.4,.5),...akord([55,59,62,65],3.5,2,.55)]},
      {i:"flute",n:mel([74,76,79,76,74,null,71],1,.5,.5)}],b:bity("k...s..hk.k.s...",0,.25,.7),fx:[["rechot",.25],["rechot",2.25],["rribbit",3.5]]},
    // punkowy jungiel: szybkie akordy mocy, werbel na dwa, talerze
    skatepark:{bpm:196,trk:[
      {i:"guitar",n:[...powt(t=>[...akord([45,52,57],t,.25,1,.01),...akord([45,52,57],t+.5,.25,.9,.01),...akord([50,57,62],t+1,.25,1,.01),...akord([52,59,64],t+1.5,.25,1,.01)],2,2),...akord([45,52,57,64],4,1.6,1,.012)]},
      {i:"guitar",n:mel([69,69,71,72,69,null,76],.25,.5,.6,.2)},
      {i:"synth",n:[[33,0,.45,.8],[33,.5,.45,.8],[38,1,.45,.8],[40,1.5,.45,.8],[33,2,.45,.8],[33,2.5,.45,.8],[38,3,.45,.8],[40,3.5,.45,.8],[33,4,1.6,.9]]}],
      b:[...bity("k.sk.sk.k.sk.sk.",0,.25,1),["x",0,.9],["x",4,1],["k",4,1],["s",4,1]],fx:[["rechot",0]]},
    // blues-rockowy shuffle z organami i riffem
    garaz:{bpm:120,trk:[
      {i:"organ",n:[...akord([52,59,64],0,1.8,.55),...akord([57,64,69],2,1.8,.55),...akord([52,59,64],4,1.6,.6)]},
      {i:"guitar",n:mel([40,43,45,46,45,43,40,null],0,.5,.9,.4)},
      {i:"guitar",n:mel([64,67,64,62,64,null,59],2,.5,.7)}],b:bity("k..s.kk.s..k.s..",0,.33,.9)},
    // polka z oom-pa: smyczki prowadzą, organy na przednutach
    wycinanka:{bpm:136,trk:[
      {i:"strings",n:mel([72,76,79,76,74,77,81,77,72,null,67],0,.5,.8)},
      {i:"organ",n:powt(t=>[...akord([60,64,67],t+.5,.4,.45),...akord([60,64,67],t+1.5,.4,.45)],3,2)},
      {i:"guitar",n:mel([48,43,48,43,55,43,48],0,1,.7,.7)},{i:"flute",n:mel([88,91,88,null,84],3,.5,.5)}],b:bity("k.s.k.s.k.s.k.s.",0,.5,.8)},
    // przytulne smyczki, dzwoneczki, kołysanie
    sweter:{bpm:86,trk:[
      {i:"strings",n:[...akord([60,64,67,72],0,2.5,.6,.06),...akord([57,64,69,72],2.5,2.5,.6,.06),...akord([55,62,67,71],5,3,.65,.06)]},
      {i:"piano",n:mel([72,76,79,76,81,79,76,72],.5,.5,.6)},{i:"musicbox",n:mel([96,null,100,null,103],4,.5,.4)}],b:[]},
    // knajpa sushi (10-18, motyw „Sushi”, id sashiko; własna melodia w japońskiej skali yo): szarpany shamisen, flet jak
    // shakuhachi, bas, taiko z obręczą i dzwoneczek na koniec jak przy podaniu talerzyka
    sashiko:{bpm:138,trk:[
      {i:"guitar",n:[...mel([62,62,69,67,69,71,74,71,74,76,74,71,69,null,67,69],0,.25,.85,.18),...akord([62,69,74],4,1.6,.85,.03)]},
      {i:"flute",n:[[74,0,.9,.4],[76,1,.9,.45],[79,2,.9,.5],[81,3,.8,.5],[86,4,1.8,.6]]},
      {i:"synth",n:[[38,0,.4,.6],[45,1,.4,.55],[38,2,.4,.6],[45,3,.4,.55],[38,4,1.5,.7]]},
      {i:"musicbox",n:[[93,4.02,1.3,.35]]}],
      b:[...bity("t.r.t.rrt.r.t.r.",0,.25,.85),["t",4,1],["k",4,.9],["c",4,.6]]},
    // szanta w rytmie 6/8: akordeon, skrzypce, tupanie i klaskanie
    piraci:{bpm:144,trk:[
      {i:"strings",n:mel([62,69,69,71,69,67,66,64,62,null,62],0,.5,.85)},
      {i:"organ",n:powt(t=>[...akord([50,57,62],t,.4,.5),...akord([50,57,62],t+1.5,.4,.5)],3,3)},
      {i:"guitar",n:mel([38,45,38,45,38,45],0,1.5,.8,.4)}],b:bity("k..c.ck..c.ck..c.c",0,.5,.9)},
    // spaghetti western: dudniąca gitara, gwizd i galop
    western:{bpm:116,trk:[
      {i:"guitar",n:mel([40,43,40,47,45,43,40,null,35],0,.5,.95,.45)},
      {i:"flute",n:[[76,0,1.5,.55],[79,1.5,.5,.55],[83,2,.5,.6],[81,2.5,.5,.6],[79,3,2.4,.65]]},
      {i:"organ",n:akord([52,56,59],0,5.4,.3)}],b:bity("k.kkk.kkk.kkk.kk",0,.25,.7).concat([["s",2,.6],["s",4,.9],["x",4,.5]])},
    // klasyczne disco: cztery na czterech, hi-haty, bas w oktawach i smyczki
    disco:{bpm:124,trk:[
      {i:"synth",n:powt(t=>mel([36,48,36,48,38,50,38,50],t,.25,.9,.2),2,2)},
      {i:"epiano",n:[...akord([60,64,67,71],.5,.25,.65),...akord([60,64,67,71],1.5,.25,.65),...akord([62,65,69,72],2.5,.25,.65),...akord([64,67,71,74],3.5,.4,.7)]},
      {i:"strings",n:[...mel([79,81,83],0,.5,.7),...akord([72,76,79,83],3,1.6,.7,.02)]}],b:[...bity("k.hok.hok.hok.ho",0,.25,.9),["c",1,.7],["c",3,.7]]},
    // cyrkowy kalliope: marsz oom-pa, rolka werbla i dzwonki
    cyrk:{bpm:164,trk:[
      {i:"organ",n:mel([79,78,79,76,72,67,72,76,79,null,84],0,.25,.7)},
      {i:"organ",n:powt(t=>[[48,t,.4,.6],[55,t+.5,.4,.45],[43,t+1,.4,.6],[55,t+1.5,.4,.45]],2,2)},
      {i:"musicbox",n:mel([96,100,103,108],3,.25,.6)}],b:[...bity("k.s.k.s.",0,.5,.8),...bity("ssssssss",3,.1,.55),["x",4,.8]]},
    // hawajski chill: ukulele, marimba w stylu slack key, miękki bas i szejker
    tiki:{bpm:92,trk:[
      {i:"guitar",n:[...powt(t=>[...akord([65,69,72,76],t,.4,.55,.02),...akord([65,69,72,76],t+.75,.3,.45,.02),...akord([65,69,72,76],t+1.5,.4,.5,.02)],1,0),
        ...akord([70,74,77,81],2,.4,.55,.02),...akord([70,74,77,81],2.75,.3,.45,.02),...akord([72,76,79,82],4,.5,.55,.02),...akord([72,76,79,82],4.75,.3,.45,.02),...akord([65,69,72,76],6,2.4,.6,.03)]},
      {i:"marimba",n:mel([77,81,84,81,79,77,null,76,79,83,81,77],0,.5,.85,.5)},
      {i:"epiano",n:[[41,0,1.8,.55],[46,2,1.8,.55],[48,4,1.8,.55],[41,6,2.4,.6]]},
      {i:"flute",n:[[89,6,2.4,.35]]}],b:bity("h.hh.hh.h.hh.hh.h.hh.hh.",0,.33,.35).concat([["k",0,.45],["k",3,.4],["k",6,.45]])},
    // ---- runda 5 (10-17) ----
    // tarantella neapolitańska (tradycyjna, domena publiczna): mandolina, akordeon, bas i tamburyn w 6/8
    kuchnia:{bpm:184,trk:[
      {i:"guitar",n:mel([76,76,76,76,77,76,74,74,74,74,76,74,72,72,72,72,74,72,71,71,71,71,72,71],0,.5,.9,.42)},
      {i:"guitar",n:[[69,12,.5,.9],[72,12.5,.5,.9],[76,13,.5,.95],[81,13.5,1.5,1]]},
      {i:"organ",n:[...powt(t=>akord([57,64,69],t,1.3,.45,.01),2,1.5),...powt(t=>akord([56,59,62,64],3+t,1.3,.45,.01),2,1.5),
        ...powt(t=>akord([57,64,69],6+t,1.3,.45,.01),2,1.5),...powt(t=>akord([56,59,62,64],9+t,1.3,.45,.01),2,1.5),...akord([57,60,64,69],13.5,1.5,.55,.02)]},
      {i:"synth",n:[[45,0,.4,.6],[40,1.5,.4,.6],[45,3,.4,.6],[40,4.5,.4,.6],[45,6,.4,.6],[40,7.5,.4,.6],[45,9,.4,.6],[40,10.5,.4,.6],[45,12,.4,.6],[45,13.5,1.5,.7]]}],
      b:[...bity("c.hc.hc.hc.hc.hc.hc.hc.hc.h",0,.5,.45),["k",0,.6],["k",3,.6],["k",6,.6],["k",9,.6],["k",12,.6],["k",13.5,.9],["x",13.5,.5]]},
    // królewska fanfara: trąbki w D-dur z kropkowanym rytmem, klawesyn, smyczki i kotły
    szachy:{bpm:112,trk:[
      {i:"synth",n:[[62,0,.5,.85],[62,.5,.25,.8],[62,.75,.25,.8],[66,1,.5,.85],[69,1.5,.5,.9],[74,2,1.4,.95],[71,3.5,.25,.8],[69,3.75,.25,.8],[66,4,.5,.85],[62,4.5,.5,.85],[74,5,2,1]]},
      {i:"synth",n:[...akord([66,69,74,78],2,1.4,.5,.01),...akord([62,66,69,74,78],5,2,.6,.012)]},
      {i:"epiano",n:[...mel([50,54,57,62,66,69,74,78],0,.25,.5,.5),...mel([55,59,62,67,71,74],3.5,.25,.45,.5),...mel([50,54,57,62,66,69,74,78],5,.25,.5,.9)]},
      {i:"strings",n:[...akord([50,57,62,66],0,3.4,.4,.03),...akord([43,55,59,62],3.5,1.4,.4,.03),...akord([50,57,62,66,74],5,2,.5,.03)]}],
      b:[["t",0,.9],["t",.75,.7],["t",1.5,.8],["t",2,1],["t",3.5,.6],["t",4,.7],["t",4.5,.7],...bity("tttttttt",5,.12,.6),["k",5,1],["x",5,.9],["x",6.5,.5]]},
    // voodoo: bębny tom-tom, pentatoniczna zaśpiewka marimby, dron organów, wrzask fletu i rechoty z bagna
    voodoo:{bpm:108,trk:[
      {i:"marimba",n:mel([64,67,69,70,69,67,64,null,62,64,67,64],0,.5,.85)},
      {i:"organ",n:[[40,0,6.8,.45],[47,0,6.8,.3],[46,5.5,1.3,.4]]},
      {i:"flute",n:[[88,3,.5,.4],[86,3.5,.5,.4],[79,4,1.5,.45]]},
      {i:"synth",n:[[40,5.5,.9,.7],[46,6,.5,.6],[40,6.5,.5,.8]]}],
      b:[...bity("t.t.tt.t.t.tt.t.t.tt",0,.33,.9),...bity("h.h.h.h.h.h.h.h.h.h.h.h.h.",0,.25,.25),["k",0,.9],["k",2,.8],["k",4,.9],["t",6.5,1],["x",6.5,.4]],
      fx:[["rechot",1],["rechot",4.5],["rribbit",6]]},
    // giełda: kasa fiskalna (dzwonek i szuflada), potem swingujący bas, epiano i wesoły riff, na koniec trzy brzęknięcia monet
    gielda:{bpm:132,trk:[
      {i:"musicbox",n:[[96,0,.3,.9],[103,.08,.5,.9],[103,6,.3,.8],[108,6.15,.3,.8],[115,6.3,.8,.85]]},
      {i:"guitar",n:mel([41,45,48,50,53,50,48,45],1.5,.5,.8,.4)},
      {i:"epiano",n:[...akord([65,69,72,74],1.5,.3,.6),...akord([65,69,72,74],2.5,.3,.6),...akord([58,62,65,70],3.5,.3,.6),...akord([60,64,67,70],4.5,.3,.6),...akord([65,69,72,77],5.5,1.4,.7,.02)]},
      {i:"chip",n:[[77,1.5,.4,.55],[77,2,.4,.55],[79,2.5,.4,.55],[81,3,.6,.6],[84,3.75,.25,.6],[81,4,.4,.55],[79,4.5,.4,.55],[77,5,.4,.55],[81,5.5,1.4,.6]]}],
      b:[["r",0,1],["r",.08,.8],["k",.5,.8],["c",.55,.7],["s",.62,.6],...bity("h.hh.hh.hh.hh.h",1.5,.33,.45),["k",1.5,.8],["s",2.5,.6],["k",3.5,.8],["s",4.5,.6],["k",5.5,.9],["r",6,.9],["r",6.15,.9],["r",6.3,1]]},
    // psychodeliczny rock: ciężki riff gitary w dorycko-miksolidyjskim E, organy jak z lat 60., dron syntezatora i tomy
    muchomor:{bpm:116,trk:[
      {i:"guitar",n:[...mel([40,40,43,45,46,45,43,40],0,.5,1,.45),[40,4,.5,1],[50,4.5,.5,.9],[48,5,.5,.9],[47,5.5,.5,.9],[45,6,2,1]]},
      {i:"organ",n:[...akord([52,59,64,67],0,2,.5,.02),...akord([55,59,62,67],2,1,.5,.02),...akord([57,61,64],3,1,.5,.02),...akord([52,59,64,67],4,1.5,.5,.02),...akord([50,57,62],5.5,.5,.5,.02),...akord([52,56,59,62,67],6,2,.6,.03)]},
      {i:"synth",n:[[64,0,8,.22],...mel([76,78,79,78,76,74,76,null],4,.5,.5)]},
      {i:"flute",n:[[88,6,.6,.4],[86,6.5,.6,.4],[83,7,1,.45]]}],
      b:[...bity("k.s.k.s.k.s.k.s.",0,.5,.9),...bity("h.h.h.h.h.h.h.h.h.h.h.h.",0,.25,.35),...bity("tttt",7,.25,.8),["x",6,.7],["x",8,.9]]},
    // klezmerski frejlechs (własny, w skali D freygish): klarnet prowadzi, akordeon oom-pa, bas, klaskanie
    zloto:{bpm:150,trk:[
      {i:"synth",n:[...mel([62,63,66,67,69,null,70,69,67,66,63,62],0,.5,.85),[62,6,.25,.8],[66,6.25,.25,.8],[69,6.5,.25,.85],[74,6.75,1.25,.95]]},
      {i:"strings",n:mel([58,60,62,63,66,null,67,66,63,62,60,58],0,.5,.4)},
      {i:"guitar",n:[[38,0,.4,.8],[33,1,.4,.7],[38,2,.4,.8],[33,3,.4,.7],[43,4,.4,.8],[38,5,.4,.7],[38,6,.4,.8],[38,6.75,1.25,.9]]},
      {i:"organ",n:[...akord([62,66,69],.5,.4,.45),...akord([62,66,69],1.5,.4,.45),...akord([62,66,69],2.5,.4,.45),...akord([67,70,74],3.5,.4,.45),...akord([67,70,74],4.5,.4,.45),...akord([62,66,69],5.5,.4,.45),...akord([62,66,69,74],6.75,1.25,.6,.02)]}],
      b:[...bity("k.s.k.s.k.s.k.s.",0,.5,.8),...bity("h.h.h.h.h.h.h.",0,.5,.35),["c",4,.7],["c",6,.7],["c",6.75,.9],["x",6.75,.5]]},
    // epitafium Seikilosa (I–II w. n.e., najstarsza zachowana pieśń): aulos, kitara, dron i bębenek
    olimp:{bpm:120,trk:[
      {i:"flute",n:[[73,0,.9,.6],[73,1,.4,.55],[76,1.5,.9,.6],[74,2.5,.4,.55],[76,3,.4,.6],[71,3.5,.4,.55],[73,4,1.4,.6],[71,5.5,.4,.55],[69,6,1.9,.6]]},
      {i:"guitar",n:[...powt(t=>mel([45,52,57,61,57,52],t,.5,.55,.45),2,3),...mel([45,52,57,61],6,.5,.55,.45)]},
      {i:"strings",n:[[45,0,8,.3],[52,0,8,.22]]},
      {i:"musicbox",n:[[81,6,.4,.4],[85,6.3,.4,.4],[88,6.6,1.2,.45]]}],
      b:[["t",0,.5],["t",1.5,.4],["t",3,.5],["t",4.5,.4],["t",6,.5],["h",.75,.3],["h",2.25,.3],["h",3.75,.3],["h",5.25,.3],["h",6.75,.3]]},
    // niedbała dziecięca melodyjka: flet prosty nie w rytm i z fałszywą nutą, kazoo z lekkim spóźnieniem, zabawkowy bębenek
    kredki:{bpm:118,trk:[
      {i:"flute",n:[[64,0,.45,.7],[64,.55,.4,.7],[65,1.05,.45,.7],[67,1.5,.9,.7],[67,2.45,.4,.7],[66,2.9,.45,.7],[64,3.55,.4,.7],[62,4,.45,.7],[60,4.6,.4,.7],[60,5.05,.4,.7],[62,5.5,.45,.7],[64,6,.9,.7],[62,7.1,.9,.7]]},
      {i:"chip",n:[[64,.08,.4,.4],[64,.63,.35,.4],[66,1.13,.4,.4],[67,1.58,.8,.4],[67,2.53,.35,.4],[66,2.98,.4,.4],[63,3.63,.35,.4],[62,4.08,.4,.4],[60,4.68,.35,.4],[60,5.13,.35,.4],[62,5.58,.4,.4],[64,6.08,.8,.4],[62,7.18,.8,.4]]},
      {i:"marimba",n:[[84,2,.2,.5],[79,2.3,.2,.5],[88,6.5,.3,.5],[91,7.6,.3,.5]]}],
      b:[["k",0,.7],["s",.6,.6],["k",1,.7],["s",1.55,.6],["k",2.05,.7],["s",2.5,.6],["k",3,.7],["s",3.5,.6],["k",4.1,.7],["s",4.6,.6],["k",5,.7],["s",5.55,.6],["k",6,.7],["r",1.5,.6],["r",6,.7],["x",8,.6]],
      fx:[["rribbit",7.2]]},
    // dźwięki natury: wiatr, świerszcze, krople wody, ptak i prawdziwe żaby; bez melodii
    prawdziwy:{bpm:80,trk:[
      {i:"strings",n:[[45,0,8,.15],[52,0,8,.12]]},
      {i:"musicbox",n:powt(t=>[[108,t,.07,.2],[108,t+.12,.07,.2],[108,t+.24,.07,.2]],8,1)},
      {i:"marimba",n:[[96,1.7,.3,.35],[100,3.9,.3,.3],[93,6.4,.3,.35]]},
      {i:"flute",n:[...mel([91,93,91,93,91],2.2,.1,.3,.09),[88,6.8,.5,.3]]}],
      b:[["x",0,.35],["x",4,.3],["o",2,.15],["o",6,.15]],
      fx:[["rechot",.2],["kum",1],["kum",1.5],["rechot",2.5],["kum",3.2],["kum",4],["rribbit",5],["kum",6.2],["rechot",7]]},
    // Einstein grał Mozarta na skrzypcach: początek „Eine kleine Nachtmusik” (1787, domena publiczna), smyczki, bas i klawesyn
    einstein:{bpm:138,trk:[
      {i:"strings",n:[[67,0,.45,.8],[62,.75,.3,.7],[67,1,.45,.8],[62,1.75,.3,.7],[67,2,.3,.8],[62,2.5,.3,.75],[67,3,.3,.8],[71,3.5,.3,.8],[74,4,1,.9],
        [72,5.5,.45,.8],[69,6.25,.3,.7],[72,6.5,.45,.8],[69,7.25,.3,.7],[72,7.5,.3,.8],[69,8,.3,.75],[66,8.5,.3,.8],[69,9,.3,.8],[62,9.5,1.4,.9]]},
      {i:"guitar",n:[[43,0,.45,.6],[38,.75,.3,.5],[43,1,.45,.6],[38,1.75,.3,.5],[43,2,.3,.6],[38,2.5,.3,.5],[43,3,.3,.6],[47,3.5,.3,.6],[50,4,1,.7],
        [48,5.5,.45,.6],[45,6.25,.3,.5],[48,6.5,.45,.6],[45,7.25,.3,.5],[48,7.5,.3,.6],[45,8,.3,.5],[42,8.5,.3,.6],[45,9,.3,.6],[38,9.5,1.4,.7]]},
      {i:"epiano",n:[...akord([55,59,62],4,.9,.4,.02),...akord([57,60,66],8.5,.4,.35,.02),...akord([50,54,57,62],9.5,1.4,.5,.02)]},
      {i:"musicbox",n:[[86,9.5,.3,.4],[91,9.8,.3,.4],[98,10.1,.8,.45]]}],b:[]},
    // Kukiełki (10-19): własny wodewilowy oom-pah w C-dur (pianino, flet, marimba i werbel), bez cudzej melodii; na końcu „ta-da” z talerzem
    kukielki:{bpm:150,trk:[
      {i:"flute",n:[...mel([72,76,79,76,81,79,76,72,74,77,81,77,79,null,79,83],0,.5,.85),[84,8,1.6,.9]]},
      {i:"piano",n:[...powt(t=>[[48,t,.4,.7],...akord([60,64,67],t+1,.4,.5,.01),[48,t+2,.4,.7],...akord([60,64,67],t+3,.4,.5,.01)],1,0),
        [41,4,.4,.7],...akord([57,60,65],5,.4,.5,.01),[43,6,.4,.7],...akord([59,62,65,67],7,.4,.5,.01),...akord([48,60,64,67,72],8,1.6,.75,.02)]},
      {i:"marimba",n:mel([96,100,103,108],7.5,.125,.5,.1)}],b:[...bity("k.s.k.s.k.s.k.s.",0,.5,.7),["x",8,.9],["k",8,.8]]}
  };
  // ---- sygnały rzadkości nagrody: cztery różne sztychy, im rzadsza, tym dłuższa i bogatsza ----
  const R={
    // zwykły: dwie szybkie nuty marimby „bip-bap”
    zwykly:{bpm:150,trk:[{i:"marimba",n:[[72,0,.3,.8],[79,.4,.5,.85]]}],b:[["h",0,.4]]},
    // rzadki: ćwierćnutowe arpeggio w górę na pozytywce z iskierką
    rzadki:{bpm:150,trk:[{i:"musicbox",n:mel([72,76,79,84],0,.25,.85,.6)},{i:"piano",n:akord([60,64,67],.75,.9,.5,.01)}],b:[["h",0,.5],["h",.5,.4],["c",.75,.5]]},
    // epicki: pianino i smyczki w pełnym akordzie z biegnikiem i werblem
    epicki:{bpm:140,trk:[{i:"synth",n:mel([60,64,67,72,76,79],0,.17,.8,.28)},{i:"strings",n:akord([60,64,67,72],1,1.4,.7,.02)},
      {i:"piano",n:akord([48,60,64,67,72],1,1.4,.75,.01)}],b:[...bity("ssssss",0,.17,.5),["k",1,1],["x",1,.7]]},
    // legendarny: pełny hymn: trąbki, smyczki, tympany i talerz, na końcu dzwonki
    legendarny:{bpm:126,trk:[{i:"synth",n:[...mel([60,67,72,76,79],0,.2,.85,.3),...akord([72,76,79,84],1,2.2,.95,.015)]},
      {i:"strings",n:[...akord([48,60,64,67],1,2.8,.75,.02),...mel([84,88,91,96],2.4,.25,.6)]},{i:"organ",n:akord([36,48,52,55,60],1,2.8,.6,.01)},
      {i:"musicbox",n:mel([96,100,103,108,103,108],2.2,.2,.55)}],
      b:[["t",0,.8],["t",.25,.7],["t",.5,.9],["k",1,1],["s",1,.9],["x",1,1],["t",1.5,.7],["t",2,.8],["c",2.2,.6]]}
  };
  // ---- odtwarzanie ----
  const dlugosc=w=>{const s=60/w.bpm;let m=0;for(const t of w.trk)for(const n of t.n)m=Math.max(m,n[1]+n[2]);for(const b of w.b||[])m=Math.max(m,b[1]+.4);return m*s+.4;};
  function zagraj(w,za0){
    if(!w||typeof Glos==="undefined"||!Glos.gotowy||!Glos.gotowy())return false;
    const s=60/w.bpm,za=(za0==null?.06:za0);
    for(const t of w.trk)for(const [m,st,d,v] of t.n)Glos.nuta(t.i,m,za+st*s,Math.max(.1,d*s),false,Math.min(1,v==null?.8:v));
    if(Glos.bebny)for(const [typ,st,v] of w.b||[])if(v>0)Glos.bebny(typ,za+st*s,v);
    for(const [f,st] of w.fx||[])try{Glos[f]&&Glos[f](za+st*s);}catch(e){}
    return true;
  }
  // Gra jingiel motywu `id`; false = brak wpisu (wołający gra wtedy zwykłą fanfarę) albo dźwięk jeszcze nieobudzony.
  function graj(id){return zagraj(J[id]);}
  // Sygnał rzadkości (zwykly | rzadki | epicki | legendarny); zwraca czas trwania w sekundach (0, gdy nie zagrał).
  function rzadkosc(r){const w=R[r]||R.zwykly;return zagraj(w)?dlugosc(w):0;}
  return {graj,ma:id=>!!J[id],lista:()=>Object.keys(J),J,R,rzadkosc,dlugosc:id=>J[id]?dlugosc(J[id]):0};
})();
