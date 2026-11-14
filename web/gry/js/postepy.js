// Postępy graczy RibbitBeat, wersja 3 („Sława”): profile per gracz,
// sława zbierana w czterech torach sceny (widownia, streak, tło, klawisze), osiągnięcia w kategoriach.
// Od 10-09 (motywy.js): stopień = MOTYW (8-bit, Halloween, Komiks…), cztery drabinki mają tę samą listę.
// Od wersji 3 (każdy dostosowuje siebie i planszę, bez zasypywania wszystkich nagrodami) odblokowania
// idą DWIEMA warstwami:
//   • PLANSZA (tory widownia, tło, klawisze = jeden motyw dla całej gry) odblokowuje się z puli EKIPY: `ekipa.slawa` to
//     suma sławy wszystkich ludzi grających na tym komputerze (rośnie z każdą grą każdego profilu, nie maleje, nie zależy
//     od tego, kto akurat siedzi w składzie). Osiągnięcie ze skrótem do toru planszy otwiera motyw planszy WSZYSTKIM
//     (`ekipa.motywy`). Wybór planszy (`ekipa.wybor`: "auto" = najwyższy odblokowany) też jest jeden, wspólny.
//   • EFEKT (tor streak, efekt za głową żaby) odblokowuje każdy sobie z własnej puli (suma czterech torów profilu) albo
//     skrótem z osiągnięcia; wybór w `wybor.streak` profilu. EFEKTY_Z_PULI_EKIPY=true przestawia także efekty na pulę
//     ekipy (alternatywa: całość z jednej puli, do odwrócenia jedną stałą).
// Progi te same dla obu warstw (progI), więc w kilka osób plansza rośnie szybciej niż efekty, a solo równo.
// Ładowany PRZED zabi-chor.js, PO efekty.js i modułach efekty-*.js (drabinki czyta z nich w chwili wywołania).
//
// Profil = nazwa gracza ze składu „kto jest kim” (bez wpisanej nazwy: „Gość”); boty nie zbierają. Zapis w
// localStorage["ribbitflip.zabiChor.postepy"]:
//   {wersja:5, profile:{[klucz]:{nazwa, liczniki, osiagniecia:{[id]:dataISO},
//     slawa:{widownia, streak, tlo, klawisze},                 // sumy, nie maleją
//     wybor:{widownia:"auto"|id, streak:…, tlo:…, klawisze:…}, ostatnio, los?, zachowane?}},   // od wersji 3 gra czyta tylko wybor.streak
//    kapsle:{…}, ekipa:{slawa, motywy:{[id motywu]:dataISO}, wybor:"auto"|id, wszystko:null|dataISO,
//      los:{uzyte, wygrane:[{t,id,r,p}], bezE, bezL, bonus}, gry}}   // wersja 5 (10-17, WSPOLNE): jedno koło nagród ekipy
//   wersja 6 (10-18, SCENY_Z_KOLA): sceny tylko z koła (jak skiny), sceny otwarte dawniej progami zapisane w ekipa.motywy
//   wersje 7, 8, 9 i 10 (10-19): nowa krzywa losowań (LOS_*), `los.uzyte` przeliczone tak, że wolnych losowań jest tyle samo (naKrzywa)
// Zapis nieznanej, nowszej wersji (np. po powrocie do starszego RibbitBeat.exe) jest tylko do odczytu: gra rusza z pustym
// stanem w pamięci, ale zapisz() niczego nie pisze (10-18, E-04). Przed pierwszym nadpisaniem zapisu starszej wersji jego
// surowa kopia trafia raz pod KLUCZ+".kopia-v<wersja>".
// klucz = nazwa małymi literami, więc „Oczko” i „oczko” to ten sam profil. Zapis wersji 1 przelicza się przy odczycie
// (migruj): sława z liczników i za zdobyte osiągnięcia, wybór stylu zostaje (id stylów 1–13 są stopniami drabinek);
// wersja 2 dostaje `ekipa` z profili (suma sławy, motywy ze skrótów planszy już zdobytych). Wersja 4 (10-15) = nowa
// krzywa progów; starsze zapisy zachowują odblokowania (profil.zachowane, ekipa.motywy).
// `ekipa.wszystko` (data) = wszystkie motywy planszy i efekty do wyboru dla każdego na tym komputerze (odblokujWszystko;
// w grze ustawia je js/menu-dodatki.js). Osiągnięć to nie dotyka: je dalej trzeba zdobyć.
//
// Motyw jest odblokowany, gdy pula dojdzie do progu progI(miejsce), ALBO gdy skrót z osiągnięcia go otworzył
// (odblokowanie bywa więc nieciągłe). Pierwszy jest zawsze. „Auto” = najwyższy odblokowany. Warunki osiągnięć i sława
// za grę są czystymi funkcjami (liczniki, wynik gry), więc test liczy je w Node.
//
// Zarządzanie profilami (10-10, okno „Profile” w js/profile.js): profil ma też `przypiety` (true = nigdy nie znika sam),
// `kolor` (ulubiony kolor gracza, #rrggbb albo null), opcjonalny `awatar` (10-19: id żabiego awatara konta z js/awatary.js;
// bez pola okno liczy awatar z klucza profilu, więc stary zapis nie potrzebuje nowej WERSJI), `utworzony` (ms) i opcjonalne `ust` (płaskie ustawienia gry i język
// profilu: ustawienia / zapiszUstawienia; ten plik je przechowuje, nie czyta). Obok profili zapis trzyma `kapsle:{[id kapsla]:
// klucz profilu}`: kapsel pamięta ostatni profil i przy następnym dołączeniu od razu gra jako on. Limit profili (200)
// usuwa po cichu WYŁĄCZNIE profile bez postępu (zero gier, sławy i osiągnięć), nieprzypięte, bez kapsla, nie Gościa;
// profil z postępem znika tylko na życzenie gracza (usun). Eksport i import: plik JSON z formatem FORMAT_PLIKU.
const Postepy=(function(){
  "use strict";
  const KLUCZ="ribbitflip.zabiChor.postepy",WERSJA=11,MAKS_PROFILI=200,GOSC="Gość";
  const FORMAT_PLIKU="ribbitbeat-profile",MAKS_IMPORT=5e6;   // znaki pliku importu
  const TORY=["widownia","streak","tlo","klawisze"],MAKS_STOPIEN=31,PRESTIZ_CO=1500;   // MAKS_STOPIEN = liczba motywów (10-10: 15 po rundzie 3, 10-16: 20 po rundzie 4, 10-17: 30 po rundzie 5, 10-19: 31 z Kukiełkami)
  // Dwie warstwy odblokowań (10-10): plansza = tory wspólne z puli ekipy, efekt = tor gracza z jego puli.
  const TORY_PLANSZY=["widownia","tlo","klawisze"],TOR_GRACZA="streak",TOR_PLANSZY="tlo";   // TOR_PLANSZY: drabinka, po której liczy się plansza (wszystkie są równe)
  // Progresja jest zbierana wspólnie: skiny i tła odblokowuje cała ekipa, nie każda osoba osobno.
  // WSPOLNE = jedna pula (ekipa.slawa), jedne losowania na kole (ekipa.los) i wspólne odblokowania instrumentów, skinów, teł i Studia.
  // Wybór (jaki skin, jaki instrument) zostaje per gracz; osiągnięcia i liczniki dalej per profil. false = stary podział (do odwrócenia).
  const WSPOLNE=true;
  const EFEKTY_Z_PULI_EKIPY=WSPOLNE;   // true = także efekty z puli ekipy (wariant „całość z jednej puli”, do odwrócenia)
  // Skiny i sceny odblokowują się wraz z postępem, ale w sposób kontrolowany i pojedynczo (albo efekt,
  // albo scena, nie oba naraz): przy kole ekipy sceny przychodzą
  // WYŁĄCZNIE z koła, jak skiny. Progi sławy niczego już same nie otwierają (pierwsza scena jest zawsze), wylosowana scena
  // zużywa losowanie jak instrument i skin, a poziomów jest tyle, ile rzeczy do wylosowania (PROGI_LOS). Skróty z osiągnięć
  // zostają osobną nagrodą. Zapis wersji 6 zachowuje sceny otwarte progami (naWersje6). false = stary model (do odwrócenia).
  const SCENY_Z_KOLA=WSPOLNE;
  // Mnożnik ekipy za liczbę ludzi w piosence (nie „2 graczy = ×2”, tylko lekka nagroda za każdego kolejnego):
  // do puli idzie ŚREDNIA sława graczy tej piosenki razy mnożnik, więc w kilka osób postęp jest szybszy, ale z malejącym
  // przyrostem (+25 %, +15 %, +10 %), a od czterech osób już stały. Granie w kilka osób nie skraca drogi kilkukrotnie.
  const MNOZNIK_GRACZY=[1,1,1.25,1.4,1.5];
  const mnoznikGraczy=n=>MNOZNIK_GRACZY[Math.max(1,Math.min(MNOZNIK_GRACZY.length-1,n|0))];
  // Sława za piosenkę rośnie z jej długością (10-17, kalibracja „komplet w 3–5 h”): czas jednej rundy to piosenka plus ok. 40 s
  // (wybór, wyniki, koło), więc mnożnik = (długość + 40) / (60 + 40), w granicach 0,5–3. Minuta grania daje wtedy podobnie dużo
  // sławy przy krótkich piosenkach wbudowanych i długich z pakietów, a najkrótsza piosenka puszczana w kółko nie skraca drogi.
  // Mnożnik jest częścią podstawy wkładu do puli ekipy (poGrze), nie plakietką „×0,7”, bo kara za krótką piosenkę zniechęca,
  // a nic nie wnosi; sława profilu (statystyka) i tabela slawaZaGre zostają bez niego.
  const DLUGOSC_WZOR=60,DLUGOSC_NARZUT=40,DLUGOSC_MIN=.5,DLUGOSC_MAKS=3;
  const mnoznikDlugosci=sek=>{const s=+sek;if(!(s>0))return 1;return Math.max(DLUGOSC_MIN,Math.min(DLUGOSC_MAKS,(s+DLUGOSC_NARZUT)/(DLUGOSC_WZOR+DLUGOSC_NARZUT)));};
  const naPlanszy=tor=>TORY_PLANSZY.includes(tor);
  // Sława za osiągnięcie (do toru jego skrótu) według poziomu 1–5.
  const SLAWA_ZA_OSIAGNIECIE={1:40,2:90,3:180,4:320,5:500};
  // Nagrodami są tylko skórki i instrumenty, wszystko z koła: osiągnięcia wyłączone.
  // Gra ich nie przyznaje (sprawdz), więc nie dają sławy ani skrótów do skinów i scen; zdobyte wcześniej zostają w zapisie,
  // a rzeczy, które kiedyś otworzyły, są w wygranych koła ekipy. Lista OSIAGNIECIA zostaje (migracje starych zapisów).
  let OSIAGNIECIA_AKTYWNE=false;   // testy mechaniki włączają je przez ustawOsiagniecia(true)
  // Mnożniki sławy za grę: pierwsza piosenka dnia i seria dni (dzień lokalny, jak seria w licznikach).
  const MNOZNIK_DNIA=2,MNOZNIK_SERII=1.1,SERIA_OD=3;
  const KATEGORIE=[
    {id:"celnosc",nazwa:"Celność"},{id:"kombo",nazwa:"Kombo"},{id:"wytrwalosc",nazwa:"Wytrwałość"},
    {id:"towarzystwo",nazwa:"Towarzystwo"},{id:"repertuar",nazwa:"Repertuar"},{id:"styl",nazwa:"Styl"},{id:"kapsel",nazwa:"Kapsel"}];
  const MIN_NUT=20;   // sława, celność i „jednym tchem” liczą się od piosenki z co najmniej tylu nutami (nie z krótkiego fragmentu)
  const ile=o=>Object.keys(o||{}).length;
  const licznik=(cel,wartosc)=>({cel,wartosc});   // pasek postępu osiągnięcia: wartość z liczników / cel

  // Progi motywów (10-09), wspólne dla torów, w sławie z puli: 2: 57 · 3: 138 · 4: 243 · 5: 372 · 6: 525 · 7: 702 · 8: 903
  // · 9: 1128. Solo piosenka daje ok. 70–110 sławy razem (pierwsza dnia ×2), więc pierwsza piosenka odblokowuje 1–2
  // motywy, a ostatni przychodzi po ok. 10–12 piosenkach: zabawa na popołudnie, nie na tygodnie (celowo).
  // 10-10: 15 motywów, krzywa łagodniejsza (było 45i+12i², ostatni 1128 przy 9): ostatni próg 32·14+3,5·14² = 1134, więc
  // całość nadal w jedno popołudnie (ok. 12–14 piosenek solo), a pierwsze motywy po 1–2 piosenkach.
  // Cel: 80 % odblokowań po ok. 40 utworach, ostatnie 20 % przy ok. 70, żeby postęp dawał satysfakcję: progi z tabeli,
  // skalibrowane symulacją 80 piosenek solo z wbudowanej listy (skrypt symulacji poza repozytorium, ok. 100–140 sławy na
  // piosenkę z osiągnięciami). Rytm: motyw 2 po pierwszej piosence, potem po 3, 5, 8, 11, 15, 19, 24, 29, 34 i 40
  // (12 z 15 = 80 %), a trzy ostatnie to „mistrzowskie” po ok. 49, 59 i 70. Odstępy rosną łagodnie (120 → 1300), więc
  // każdy następny motyw jest trochę dalej, ale nigdy skokiem. Strojenie: przeciętny gracz 12 motywów po ok. 40–45
  // piosenkach, dobry po ok. 38; z osiągnięciami-skrótami czasem szybciej. Skróty z osiągnięć dalej otwierają motywy wcześniej.
  // Zapisy sprzed tej krzywej (wersja ≤ 3) zachowują to, co miały odblokowane (zachowajStareProgi).
  // 10-16 (runda 4, 20 motywów): ta sama krzywa rozpięta na 20 progów, żeby 80 % nadal przychodziło po ok. 40
  // piosenkach (motyw 16 przy 3950, jak dotąd motyw 12), a całość po ok. 70 (motyw 20 przy 7600, jak dotąd 15).
  // Odstępy dalej nie maleją (100 → 430, potem cztery „mistrzowskie” 800–1000), a każdy z pierwszych 15 progów jest
  // niższy niż w krzywej 10-15, więc zapis wersji 4 niczego nie traci i nie potrzebuje migracji. Nowe motywy stoją na
  // końcu drabinki (16–20); wcześniej otwierają je skróty z pięciu osiągnięć planszy (piraci, western, disco, cyrk, tiki).
  // Symulacja 80 piosenek: przeciętny 16 z 20 po 41, 20 po 78; dobry 16 po 35, 20 po 58.
  // 10-17 (runda 5, 29 motywów): ta sama zasada: 80 % (motyw 23) przy 3950, całość (motyw 29) przy 7600; pierwsze 23 progi to
  // krzywa 10-16 rozpięta na 23 miejsca (odstępy 75 → 275, nigdy w dół), potem sześć „mistrzowskich” po 500–700. Każdy z 20 dawnych progów
  // jest niższy niż w krzywej 10-16, więc zapis wersji 4 niczego nie traci. Instrumenty na drodze (PROGI_INSTRUMENTOW) rozłożone
  // na 28 odstępów (3, potem na przemian 2 i 1), żeby między efektami zawsze coś było.
  // 10-17 wieczór: motyw 30 (Einstein) dołożony na końcu przy 8300 (+700, jak poprzednie „mistrzowskie”).
  // Odblokowanie wszystkiego ma zająć 3–5 godzin, nie jeden wieczór: krzywa z CZASU, nie z liczby piosenek.
  // Symulacja (skrypt poza repozytorium: piosenki wbudowane i z pakietów, narzut 45 s, 12 s na losowanie) dawała przy
  // krzywej z rana komplet po 1,4 h solo i 0,9 h w czwórkę. Nowa krzywa: odstęp motywu k = 2,5 min + 0,49 min·(k−1) grania
  // przeciętnego gracza solo (ok. 2600 sławy na godzinę na starcie; z wprawą rośnie), więc pierwsze nagrody przychodzą co chwilę (pierwsza piosenka daje kilka
  // losowań), a ostatnie co ok. 15 min. Zasady jak u wydawców gier: szybki start (haczyk w pierwszych 10 minutach), rosnące, ale
  // przewidywalne odstępy bez ściany, 80 % rzeczy przed ostatnią jedną trzecią czasu, gwarancje epickiej i legendarnej (litość),
  // dzienny bonus ×2 jako „wypoczęta sława”. Stałe dobrane symulacją poza repozytorium.
  const PROGI=[0,300,670,1090,1570,2120,2710,3380,4090,4870,5710,6600,7560,8580,9650,10790,11980,13230,14540,15910,17340,18830,20370,21990,23640,25370,27160,29000,30900,32860,34880];
  const progI=i=>{i=+i||0;if(i<=0)return 0;const n=PROGI.length-1;return i<=n?PROGI[i]:PROGI[n]+(i-n)*1300;};
  const progIStary=i=>{i=+i||0;return i<=0?0:Math.round(32*i+3.5*i*i);},STARE_MAKS=15;   // krzywa do 10-15 (wersja zapisu ≤ 3, 15 motywów)
  const prog=k=>progI((+k||1)-1);
  // Najwyższy stopień 1–MAKS_STOPIEN, którego próg mieści się w sławie (bez patrzenia na drabinkę).
  function poziomSlawy(s){s=+s||0;let k=1;while(k<MAKS_STOPIEN&&prog(k+1)<=s)k++;return k;}
  // Gwiazdki prestiżu po ostatnim motywie: jedna co PRESTIZ_CO sławy ponad jego próg.
  // 10-17: co 1500 (było 500), bo krzywa „3–5 h” daje ok. 6000 sławy na godzinę: gwiazdka co ok. kwadrans grania po komplecie
  const prestizZ=s=>Math.max(0,Math.floor(((+s||0)-prog(MAKS_STOPIEN))/PRESTIZ_CO));

  // Katalog. warunek(l, w): l = liczniki profilu PO tej grze, w = wynik tej gry (wynikGracza). Kolejność w kategorii
  // = rosnąca trudność, poziom 1–5 = sława za zdobycie. nagroda = {tor: id motywu}: sława za zdobycie idzie do toru,
  // a skrót odblokowuje motyw na wszystkich torach (10-09).
  const OSIAGNIECIA=[
    // Celność
    {kategoria:"celnosc",id:"czyste-100",poziom:1,nazwa:"Setka czystych",opis:"Zaśpiewaj łącznie 100 nut na „Czysto”.",
      warunek:l=>l.czyste>=100,prog:licznik(100,l=>l.czyste),nagroda:{klawisze:"8bit"}},
    {kategoria:"celnosc",id:"celnosc-80",poziom:2,nazwa:"Celne ucho",opis:"Zaśpiewaj piosenkę z precyzją co najmniej 80 %.",
      warunek:(l,w)=>w.nut>=MIN_NUT&&w.precyzja>=80,prog:licznik(80,l=>l.najPrecyzja),nagroda:{streak:"komiks"}},
    {kategoria:"celnosc",id:"pudlo-0",poziom:2,nazwa:"Bez pudła",opis:"Zaśpiewaj partię z co najmniej 30 nutami bez ani jednego Pudła.",
      warunek:(l,w)=>w.nut>=30&&w.pudlo===0,nagroda:{klawisze:"szkicownik"}},
    {kategoria:"celnosc",id:"celnosc-czysto",poziom:3,nazwa:"Bez wpadki",opis:"Zaśpiewaj partię z co najmniej 40 nutami bez ani jednego Fałszu i Pudła.",
      warunek:(l,w)=>w.nut>=40&&w.falsz===0&&w.pudlo===0,nagroda:{streak:"podwodny"}},
    {kategoria:"celnosc",id:"czyste-1000",poziom:3,nazwa:"Tysiąc czystych",opis:"Zaśpiewaj łącznie 1000 nut na „Czysto”.",
      warunek:l=>l.czyste>=1000,prog:licznik(1000,l=>l.czyste),nagroda:{klawisze:"koncert"}},
    {kategoria:"celnosc",id:"celnosc-90",poziom:4,nazwa:"Snajper",opis:"Zaśpiewaj trudną partię (trudność co najmniej 4,5) z precyzją co najmniej 90 %.",
      warunek:(l,w)=>w.nut>=MIN_NUT&&w.trudnosc>=4.5&&w.precyzja>=90,nagroda:{streak:"synthwave"}},
    {kategoria:"celnosc",id:"celnosc-95",poziom:4,nazwa:"Jak z nut",opis:"Zaśpiewaj partię z co najmniej 40 nutami z precyzją co najmniej 95 %.",
      warunek:(l,w)=>w.nut>=40&&w.precyzja>=95,nagroda:{klawisze:"kosmos"}},
    {kategoria:"celnosc",id:"celnosc-100",poziom:5,nazwa:"Perfekcja",opis:"Zaśpiewaj partię z co najmniej 30 nutami z precyzją 100 %.",
      warunek:(l,w)=>w.nut>=30&&w.precyzja>=100,nagroda:{klawisze:"sashiko"}},
    // 10-17 (runda 5): skrót do nowego motywu
    {kategoria:"celnosc",id:"czyste-2500",poziom:5,nazwa:"Złote gardło",opis:"Zaśpiewaj łącznie 2500 nut czysto.",
      warunek:l=>l.czyste>=2500,prog:licznik(2500,l=>l.czyste),nagroda:{klawisze:"zloto"}},
    {kategoria:"celnosc",id:"celnosc-98",poziom:5,nazwa:"Jak żywa",opis:"Zaśpiewaj partię z co najmniej 60 nutami z precyzją co najmniej 98 %.",
      warunek:(l,w)=>w.nut>=60&&w.precyzja>=98,nagroda:{streak:"prawdziwy"}},
    // Kombo
    {kategoria:"kombo",id:"kombo-25",poziom:1,nazwa:"Rozgrzewka",opis:"Złap kombo 25 nut w jednej piosence.",
      warunek:(l,w)=>w.maxKombo>=25,prog:licznik(25,l=>l.najKombo),nagroda:{streak:"8bit"}},
    {kategoria:"kombo",id:"kombo-50",poziom:3,nazwa:"W ogniu",opis:"Złap kombo 50 nut w jednej piosence.",
      warunek:(l,w)=>w.maxKombo>=50,prog:licznik(50,l=>l.najKombo),nagroda:{streak:"koncert"}},
    {kategoria:"kombo",id:"kombo-100",poziom:4,nazwa:"Setka",opis:"Złap kombo 100 nut w jednej piosence.",
      warunek:(l,w)=>w.maxKombo>=100,prog:licznik(100,l=>l.najKombo),nagroda:{streak:"synthwave"}},
    {kategoria:"kombo",id:"kombo-150",poziom:5,nazwa:"Sto pięćdziesiąt",opis:"Złap kombo 150 nut w jednej piosence.",
      warunek:(l,w)=>w.maxKombo>=150,prog:licznik(150,l=>l.najKombo),nagroda:{streak:"kosmos"}},
    {kategoria:"kombo",id:"kombo-200",poziom:5,nazwa:"Dwie setki",opis:"Złap kombo 200 nut w jednej piosence.",
      warunek:(l,w)=>w.maxKombo>=200,prog:licznik(200,l=>l.najKombo),nagroda:{streak:"skatepark"}},
    {kategoria:"kombo",id:"kombo-cala",poziom:5,nazwa:"Jednym tchem",opis:"Zaśpiewaj całą trudną partię (trudność co najmniej 4,5, co najmniej 60 nut) na jednym kombo.",
      warunek:(l,w)=>w.nut>=60&&w.trudnosc>=4.5&&w.maxKombo>=w.nut,nagroda:{streak:"kosmos"}},
    // 10-17 (runda 5): skrót do nowego motywu
    {kategoria:"kombo",id:"kombo-300",poziom:5,nazwa:"Odlot",opis:"Złap kombo 300 nut w jednej piosence.",
      warunek:(l,w)=>w.maxKombo>=300,prog:licznik(300,l=>l.najKombo),nagroda:{streak:"muchomor"}},
    // Wytrwałość
    {kategoria:"wytrwalosc",id:"gry-5",poziom:1,nazwa:"Pierwsze koncerty",opis:"Zaśpiewaj 5 piosenek do końca.",
      warunek:l=>l.gry>=5,prog:licznik(5,l=>l.gry),nagroda:{widownia:"komiks"}},
    {kategoria:"wytrwalosc",id:"gry-25",poziom:2,nazwa:"Trasa koncertowa",opis:"Zaśpiewaj 25 piosenek do końca.",
      warunek:l=>l.gry>=25,prog:licznik(25,l=>l.gry),nagroda:{widownia:"koncert"}},
    {kategoria:"wytrwalosc",id:"dni-3",poziom:3,nazwa:"Codzienna próba",opis:"Graj trzy dni z rzędu.",
      warunek:l=>l.dni.naj>=3,prog:licznik(3,l=>l.dni.naj),nagroda:{widownia:"podwodny"}},
    {kategoria:"wytrwalosc",id:"gry-100",poziom:4,nazwa:"Weteran sceny",opis:"Zaśpiewaj 100 piosenek do końca.",
      warunek:l=>l.gry>=100,prog:licznik(100,l=>l.gry),nagroda:{widownia:"piraci"}},
    {kategoria:"wytrwalosc",id:"dni-7",poziom:4,nazwa:"Tydzień z rzędu",opis:"Graj siedem dni z rzędu.",
      warunek:l=>l.dni.naj>=7,prog:licznik(7,l=>l.dni.naj),nagroda:{widownia:"kosmos"}},
    {kategoria:"wytrwalosc",id:"dni-14",poziom:5,nazwa:"Dwa tygodnie",opis:"Graj czternaście dni z rzędu.",
      warunek:l=>l.dni.naj>=14,prog:licznik(14,l=>l.dni.naj),nagroda:{widownia:"sweter"}},
    // 10-17 (runda 5): skrót do nowego motywu
    {kategoria:"wytrwalosc",id:"gry-200",poziom:5,nazwa:"Gruba ryba",opis:"Zaśpiewaj 200 piosenek do końca.",
      warunek:l=>l.gry>=200,prog:licznik(200,l=>l.gry),nagroda:{tlo:"gielda"}},
    {kategoria:"wytrwalosc",id:"dni-21",poziom:5,nazwa:"Olimpijczyk",opis:"Graj dwadzieścia jeden dni z rzędu.",
      warunek:l=>l.dni.naj>=21,prog:licznik(21,l=>l.dni.naj),nagroda:{widownia:"olimp"}},
    // Towarzystwo
    {kategoria:"towarzystwo",id:"razem-2",poziom:1,nazwa:"Duet",opis:"Zaśpiewaj piosenkę w co najmniej dwie żaby (bot też się liczy).",
      warunek:(l,w)=>w.liczbaGraczy>=2,nagroda:{widownia:"komiks"}},
    {kategoria:"towarzystwo",id:"razem-4",poziom:2,nazwa:"Kapela",opis:"Zaśpiewaj piosenkę w co najmniej cztery żaby.",
      warunek:(l,w)=>w.liczbaGraczy>=4,nagroda:{widownia:"koncert"}},
    {kategoria:"towarzystwo",id:"razem-6",poziom:3,nazwa:"Pełna sala",opis:"Zaśpiewaj piosenkę w co najmniej sześć żab.",
      warunek:(l,w)=>w.liczbaGraczy>=6,nagroda:{widownia:"synthwave"}},
    {kategoria:"towarzystwo",id:"razem-chor",poziom:3,nazwa:"W jednym głosie",opis:"Zdobądź premię chóru: cały tor czysto na tej samej nucie.",
      warunek:(l,w)=>w.premiaChoru>0,nagroda:{widownia:"tiki"}},
    {kategoria:"towarzystwo",id:"razem-8",poziom:4,nazwa:"Ósemka",opis:"Zaśpiewaj piosenkę w osiem żab.",
      warunek:(l,w)=>w.liczbaGraczy>=8,nagroda:{widownia:"garaz"}},
    {kategoria:"towarzystwo",id:"razem-mistrz",poziom:4,nazwa:"Pogromca Mistrza",opis:"Wygraj na punkty z botem na poziomie Mistrz.",
      warunek:(l,w)=>!!w.wygralZMistrzem,nagroda:{widownia:"western"}},
    // Repertuar
    {kategoria:"repertuar",id:"pakiet-1",poziom:1,nazwa:"Z paczki",opis:"Zaśpiewaj do końca utwór z paczki MIDI.",
      warunek:(l,w)=>!!w.pakiet&&w.nut>=MIN_NUT,nagroda:{tlo:"8bit"}},
    {kategoria:"repertuar",id:"utwory-10",poziom:2,nazwa:"Szeroki repertuar",opis:"Zaśpiewaj do końca 10 różnych utworów.",
      warunek:l=>ile(l.utwory)>=10,prog:licznik(10,l=>ile(l.utwory)),nagroda:{widownia:"szkicownik"}},
    {kategoria:"repertuar",id:"dlugi-3min",poziom:2,nazwa:"Maraton",opis:"Zaśpiewaj do końca utwór, który trwa co najmniej 3 minuty.",
      warunek:(l,w)=>w.dlugoscSek>=180,nagroda:{streak:"podwodny"}},
    {kategoria:"repertuar",id:"utwory-25",poziom:3,nazwa:"Kolekcjoner",opis:"Zaśpiewaj do końca 25 różnych utworów.",
      warunek:l=>ile(l.utwory)>=25,prog:licznik(25,l=>ile(l.utwory)),nagroda:{tlo:"synthwave"}},
    {kategoria:"repertuar",id:"pakiety-3",poziom:3,nazwa:"Trzy paczki",opis:"Zaśpiewaj do końca utwory z trzech różnych paczek MIDI.",
      warunek:l=>ile(l.pakiety)>=3,prog:licznik(3,l=>ile(l.pakiety)),nagroda:{tlo:"szkicownik"}},
    {kategoria:"repertuar",id:"utwory-50",poziom:4,nazwa:"Melomaniak",opis:"Zaśpiewaj do końca 50 różnych utworów.",
      warunek:l=>ile(l.utwory)>=50,prog:licznik(50,l=>ile(l.utwory)),nagroda:{tlo:"wycinanka"}},
    // 10-17 (runda 5): skrót do nowego motywu
    {kategoria:"repertuar",id:"utwory-75",poziom:4,nazwa:"Pełna karta dań",opis:"Zaśpiewaj do końca 75 różnych utworów.",
      warunek:l=>ile(l.utwory)>=75,prog:licznik(75,l=>ile(l.utwory)),nagroda:{widownia:"kuchnia"}},
    {kategoria:"repertuar",id:"trudna-7",poziom:5,nazwa:"Ekstremalna partia",opis:"Ukończ partię o trudności co najmniej 7 z wynikiem 3 gwiazdek albo lepszym.",
      warunek:(l,w)=>w.trudnosc>=7&&w.gwiazdki>=3,nagroda:{widownia:"koncert"}},
    {kategoria:"repertuar",id:"trudna-9",poziom:5,nazwa:"Dziewiątka",opis:"Ukończ partię o trudności co najmniej 9.",
      warunek:(l,w)=>w.nut>=MIN_NUT&&w.trudnosc>=9,nagroda:{tlo:"kosmos"}},
    // 10-17 (runda 5): skrót do nowego motywu
    {kategoria:"repertuar",id:"utwory-100",poziom:5,nazwa:"Doktorat",opis:"Zaśpiewaj do końca 100 różnych utworów.",
      warunek:l=>ile(l.utwory)>=100,prog:licznik(100,l=>ile(l.utwory)),nagroda:{tlo:"einstein"}},
    // Styl
    {kategoria:"styl",id:"nocny",poziom:1,nazwa:"Nocny marek",opis:"Zaśpiewaj piosenkę między północą a piątą rano.",
      warunek:(l,w)=>nocna(w),nagroda:{klawisze:"halloween"}},
    {kategoria:"styl",id:"klik-20",poziom:2,nazwa:"W rytm",opis:"Zbierz 20 premii za klik w rytm w jednej piosence.",
      warunek:(l,w)=>w.klikiWRytm>=20,prog:licznik(20,l=>l.najKlik),nagroda:{streak:"8bit"}},
    {kategoria:"styl",id:"wibrato-10",poziom:2,nazwa:"Wibrato",opis:"Zaśpiewaj z wibratem 10 nut w jednej piosence.",
      warunek:(l,w)=>w.wibrata>=10,nagroda:{klawisze:"staw"}},
    {kategoria:"styl",id:"instrumenty-13",poziom:3,nazwa:"Orkiestra jednej żaby",opis:"Zaśpiewaj do końca na każdym z 13 instrumentów.",
      warunek:l=>ile(l.instrumenty)>=13,prog:licznik(13,l=>ile(l.instrumenty)),nagroda:{widownia:"cyrk"}},
    {kategoria:"styl",id:"plynny-4",poziom:3,nazwa:"Po łuku",opis:"Zdobądź 4 gwiazdki w trybie Płynnym.",
      warunek:(l,w)=>w.tryb==="plynny"&&w.gwiazdki>=4,nagroda:{streak:"synthwave"}},
    {kategoria:"styl",id:"klik-40",poziom:3,nazwa:"Metronom",opis:"Zbierz 40 premii za klik w rytm w jednej piosence.",
      warunek:(l,w)=>w.klikiWRytm>=40,prog:licznik(40,l=>l.najKlik),nagroda:{klawisze:"komiks"}},
    // 10-17 (runda 5): skrót do nowego motywu
    {kategoria:"styl",id:"wibrato-25",poziom:3,nazwa:"Zaklęcie",opis:"Zaśpiewaj z wibratem 25 nut w jednej piosence.",
      warunek:(l,w)=>w.wibrata>=25,nagroda:{streak:"voodoo"}},
    {kategoria:"styl",id:"bez-ruchu-4",poziom:4,nazwa:"Bez taryfy ulgowej",opis:"Zdobądź 4 gwiazdki z wyłączonym czasem na ruch w partii o trudności co najmniej 3.",
      warunek:(l,w)=>(w.czasNaRuch===false||w.czasNaRuch===0)&&w.trudnosc>=3&&w.gwiazdki>=4,nagroda:{streak:"szkicownik"}},
    // 10-17 (runda 5): skrót do nowego motywu
    {kategoria:"styl",id:"plynny-5",poziom:4,nazwa:"Szach i mat",opis:"Zdobądź 5 gwiazdek w trybie Płynnym.",
      warunek:(l,w)=>w.tryb==="plynny"&&w.gwiazdki>=5,nagroda:{klawisze:"szachy"}},
    {kategoria:"styl",id:"instrumenty-26",poziom:4,nazwa:"Pudełko kredek",opis:"Zaśpiewaj do końca na 26 różnych instrumentach.",
      warunek:l=>ile(l.instrumenty)>=26,prog:licznik(26,l=>ile(l.instrumenty)),nagroda:{widownia:"kredki"}},
    {kategoria:"styl",id:"krzyk-1",poziom:4,nazwa:"Wrzask na scenie",opis:"Zaśpiewaj do końca piosenkę na instrumencie Krzyk.",
      warunek:l=>!!(l.instrumenty&&l.instrumenty.krzyk),nagroda:{tlo:"kukielki"}},
    // Kapsel
    {kategoria:"kapsel",id:"kapsel-1",poziom:1,nazwa:"Kapsel w dłoń",opis:"Zaśpiewaj piosenkę do końca, sterując kapslem.",
      warunek:(l,w)=>!!w.kapsel,prog:licznik(1,l=>l.kapselGry),nagroda:{streak:"8bit"}},
    {kategoria:"kapsel",id:"kapsel-4",poziom:4,nazwa:"Mistrz kapsla",opis:"Zdobądź 4 gwiazdki, sterując kapslem.",
      warunek:(l,w)=>!!w.kapsel&&w.gwiazdki>=4,nagroda:{widownia:"disco"}}];
  const MAPA=new Map(OSIAGNIECIA.map(o=>[o.id,o]));
  // Wersja angielska (js/jezyk.js, js/jezyk-en.js): nazwy kategorii i osiągnięć po id; id, warunki i nagrody bez zmian.
  if(typeof RBJezyk!=="undefined"&&RBJezyk.en&&typeof RB_EN!=="undefined"){
    for(const k of KATEGORIE)if(RB_EN.kategorie&&RB_EN.kategorie[k.id])k.nazwa=RB_EN.kategorie[k.id];
    for(const o of OSIAGNIECIA){const e=RB_EN.osiagniecia&&RB_EN.osiagniecia[o.id];if(e){o.nazwa=e[0];o.opis=e[1];}}
  }
  // Tor, do którego osiągnięcie daje skrót (i sławę): pierwszy z TORY w jego nagrodzie.
  const torNagrody=o=>(o&&o.nagroda&&TORY.find(t=>o.nagroda[t]))||null;

  // ---- drabinki ----
  // Drabinka toru = lista wpisów {stopien, id, nazwa, …} od stopnia 1. W przeglądarce to ta sama funkcja co w grze
  // (global `drabinka` z zabi-chor.js, wczytany po tym pliku, więc sprawdzamy go dopiero w chwili wywołania). W Node
  // (test) i zanim gra się wczyta liczymy ją tą samą regułą: moduł toru (efekty-*.js) z niepustą DRABINKA, a bez niego
  // widownia i streak = katalog efekty.js (stopień = miejsce w katalogu), tło i klawisze = jeden stopień (kraft, papier).
  const ZAPAS={tlo:{stopien:1,id:"kraft",nazwa:"Kraft"},klawisze:{stopien:1,id:"papier",nazwa:"Papier"}};
  function modulToru(tor){
    if(tor==="widownia")return typeof EfektyWidownia!=="undefined"?EfektyWidownia:null;
    if(tor==="streak")return typeof EfektyStreak!=="undefined"?EfektyStreak:null;
    if(tor==="tlo")return typeof EfektyTlo!=="undefined"?EfektyTlo:null;
    if(tor==="klawisze")return typeof EfektyKlawisze!=="undefined"?EfektyKlawisze:null;
    return null;
  }
  function drabinkaToru(tor){
    if(typeof drabinka==="function"){try{const d=drabinka(tor);if(Array.isArray(d))return d;}catch(e){}}
    const m=modulToru(tor);
    if(m&&Array.isArray(m.DRABINKA)&&m.DRABINKA.length)return m.DRABINKA;
    if(tor==="widownia"||tor==="streak"){
      const kat=typeof Efekty==="undefined"?[]:tor==="widownia"?Efekty.WIDOWNIE:Efekty.STREAKI;
      return kat.map((w,i)=>Object.assign({},w,{stopien:i+1}));
    }
    return ZAPAS[tor]?[ZAPAS[tor]]:[];
  }
  const nrStopnia=(w,i)=>+(w&&w.stopien)||i+1;
  function wpisDrabinki(tor,id){return drabinkaToru(tor).find(w=>w&&w.id===id)||null;}
  // Próg sławy stopnia o danym id w drabince toru (nieznane id: 0).
  function progWpisu(tor,id){const d=drabinkaToru(tor),i=d.findIndex(w=>w&&w.id===id);return i<0?0:progI(i);}
  // Stopień ze sławy w drabince toru: najwyższy wpis, którego próg mieści się w sławie (pierwszy zawsze), z progiem
  // jego i następnego wpisu (pasek „1 041 / 1 257”). Bez drabinki: sam numer z progów.
  function poziomZ(slawa,tor){
    const s=+slawa||0,d=drabinkaToru(tor);
    let i=0;while(i+1<d.length&&progI(i+1)<=s)i++;
    const w=d[i]||null,n=w?nrStopnia(w,i):poziomSlawy(s),nast=d[i+1]||null;
    return {stopien:n,wpis:w,od:d.length?progI(i):prog(n),do:nast?progI(i+1):null,nastepny:nast,maks:d.length};
  }

  // ---- liczniki (czyste funkcje) ----
  function nowyLiczniki(){
    return {gry:0,czyste:0,trafione:0,najKombo:0,najPrecyzja:0,najGwiazdki:0,najKlik:0,kapselGry:0,wibrata:0,nocne:0,
      utwory:{},instrumenty:{},pakiety:{},tryby:{},dni:{ost:"",seria:0,naj:0},dzienSlawy:""};
  }
  // Dzień kalendarzowy w czasie lokalnym (YYYY-MM-DD), bo „trzy dni z rzędu” liczy się po północy u gracza.
  function dzienLokalny(d){d=d instanceof Date?d:new Date(d);
    return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
  function dniMiedzy(a,b){const p=s=>{const [y,m,d]=s.split("-").map(Number);return Date.UTC(y,m-1,d);};return Math.round((p(b)-p(a))/864e5);}
  function seriaDni(dni,dzien){
    const d=Object.assign({ost:"",seria:0,naj:0},dni);
    if(d.ost===dzien)return d;
    const roz=d.ost?dniMiedzy(d.ost,dzien):null;
    d.seria=roz===1?d.seria+1:roz!=null&&roz<0?d.seria:1;   // gra „z przeszłości” (zegar cofnięty) nie zrywa serii
    if(roz==null||roz>=0)d.ost=dzien;
    d.naj=Math.max(d.naj||0,d.seria);
    return d;
  }
  // Piosenka nocna: między północą a piątą rano czasu lokalnego (godzina z konfiguracji gry).
  function nocna(w){const g=w&&w.godzina;return typeof g==="number"&&g>=0&&g<5;}
  // Liczniki po jednej zagranej piosence (bez mutacji wejścia).
  function dodajGre(l,w,dzien){
    const n=Object.assign(nowyLiczniki(),JSON.parse(JSON.stringify(l||{})));
    n.gry++;n.czyste+=w.czysto|0;n.trafione+=(w.czysto|0)+(w.dobrze|0);n.wibrata+=w.wibrata|0;
    n.najKombo=Math.max(n.najKombo,w.maxKombo|0);
    if(w.nut>=MIN_NUT)n.najPrecyzja=Math.max(n.najPrecyzja,Math.floor(+w.precyzja||0));
    n.najGwiazdki=Math.max(n.najGwiazdki,w.gwiazdki|0);n.najKlik=Math.max(n.najKlik,w.klikiWRytm|0);
    if(w.kapsel)n.kapselGry++;
    if(nocna(w))n.nocne++;
    if(w.piosenka)n.utwory[String(w.piosenka).slice(0,80)]=1;
    if(w.instrument)n.instrumenty[w.instrument]=1;
    if(w.pakiet&&w.pakietId)n.pakiety[String(w.pakietId).slice(0,80)]=1;
    if(w.tryb)n.tryby[String(w.tryb).slice(0,20)]=1;
    n.dni=seriaDni(n.dni,dzien||dzienLokalny(new Date()));
    return n;
  }
  // Wynik gry jednego gracza w kształcie, który czytają warunki i sława. `r` = wiersz z listy wyników gry (zakonczGre),
  // `gracz` = wpis składu {zrodlo, instrument}, `k` = konfiguracja gry, `wszyscy` = wszystkie wiersze z graczami.
  function wynikGracza(gracz,r,k,wszyscy){
    const oc=r.oceny||{},kl=r.kliki||{};k=k||{};
    const mistrzowie=(wszyscy||[]).filter(x=>x.gracz&&x.gracz.zrodlo==="bot"&&x.gracz.poziom==="mistrz");
    const ludzie=(wszyscy||[]).filter(x=>x.gracz&&x.gracz.zrodlo!=="bot").length;
    const godz=k.godzina==null||k.godzina===""?NaN:+k.godzina;
    return {nut:r.nut|0,czysto:oc.czysto|0,dobrze:oc.dobrze|0,prawie:oc.prawie|0,falsz:oc.falsz|0,pudlo:oc.pudlo|0,
      precyzja:+r.precyzja||0,gwiazdki:r.gwiazdki|0,maxKombo:r.maxKombo|0,punkty:+r.punkty||0,
      premiaChoru:+r.premiaChoru||0,klikiWRytm:(kl.idealnie|0)+(kl.dobrze|0),wibrata:r.wibrata|0,
      trudnosc:r.trudnosc&&Number.isFinite(+r.trudnosc.ocena)?+r.trudnosc.ocena:(+r.trudnosc||0),
      liczbaGraczy:k.liczbaGraczy||(wszyscy||[]).length||1,
      liczbaLudzi:k.liczbaLudzi!=null?+k.liczbaLudzi||0:ludzie||(gracz&&gracz.zrodlo!=="bot"?1:0),
      wygralZMistrzem:mistrzowie.length>0&&mistrzowie.every(x=>(+r.punkty||0)>(+x.r.punkty||0)),
      instrument:gracz&&gracz.instrument||null,kapsel:!!(gracz&&gracz.zrodlo==="kapsel"),
      tryb:k.tryb||"klasyczny",czasNaRuch:k.czasNaRuch===false?0:k.czasNaRuch===true||k.czasNaRuch==null?100:Math.max(0,+k.czasNaRuch||0),
      dlugoscSek:+k.dlugoscSek||0,piosenka:k.piosenka||null,
      pakiet:!!k.pakiet,pakietId:k.pakiet&&k.pakietId?String(k.pakietId):null,
      godzina:Number.isFinite(godz)?godz:null};
  }
  // Nowo spełnione osiągnięcia (bez już zdobytych).
  function sprawdz(l,w,zdobyte){
    const out=[];if(!OSIAGNIECIA_AKTYWNE)return out;
    for(const o of OSIAGNIECIA){if(zdobyte&&zdobyte[o.id])continue;let ok=false;try{ok=!!o.warunek(l,w);}catch(e){}if(ok)out.push(o);}
    return out;
  }

  // ---- sława za grę (czysta funkcja) ----
  // Poziom ognia z najdłuższego kombo: progi gry 4/8/12, jak og w efektach.
  const poziomOgnia=k=>k>=12?3:k>=8?2:k>=4?1:0;
  // w = wynikGracza, l = liczniki profilu PRZED tą grą (nowy utwór i nowy instrument), k = {pierwszaDnia, seria,
  // pakiet?}. Każdy tor rośnie z innego stylu grania: widownia z grania i towarzystwa, streak z kombo, tło
  // z różnorodności repertuaru, klawisze z czystości śpiewu. Fragment krótszy niż MIN_NUT nut nie daje sławy.
  // Mnożniki mnożą się razem, wynik zaokrąglony w górę (z zapasem na błąd zmiennoprzecinkowy: 10 × 1,1 = 11, nie 12).
  function slawaZaGre(w,l,k){
    w=w||{};l=l||{};k=k||{};
    const out={widownia:0,streak:0,tlo:0,klawisze:0,mnoznik:1,mnozniki:[],powody:[]};
    if(!((w.nut|0)>=MIN_NUT))return out;
    if(!((w.czysto|0)+(w.dobrze|0)+(w.prawie|0)))return out;   // 10-15: piosenka bez żadnej trafionej nuty nie daje sławy
    const pw=out.powody,dodaj=(tor,id,ileS)=>{if(ileS>0)pw.push({tor,id,ile:ileS});};
    const gracze=Math.max(1,w.liczbaGraczy|0),minuty=Math.floor((+w.dlugoscSek||0)/60),mk=w.maxKombo|0;
    dodaj("widownia","piosenka",14);
    dodaj("widownia","gracze",3*Math.min(7,gracze-1));
    dodaj("widownia","chor",(+w.premiaChoru||0)>0?8:0);
    dodaj("widownia","minuty",Math.min(12,3*minuty));
    dodaj("widownia","gwiazdki",(w.gwiazdki|0)>=3?5:0);
    dodaj("widownia","ludzie",(w.liczbaLudzi|0)>=2?6:0);
    dodaj("streak","piosenka",4);
    dodaj("streak","kombo",Math.min(60,Math.floor(mk/2)));
    dodaj("streak","ogien",5*poziomOgnia(mk));
    dodaj("streak","calosc",mk>=(w.nut|0)?12:0);
    const utwor=w.piosenka?String(w.piosenka).slice(0,80):null;
    dodaj("tlo","utwor",utwor&&!(l.utwory&&l.utwory[utwor])?16:6);
    dodaj("tlo","instrument",w.instrument&&!(l.instrumenty&&l.instrumenty[w.instrument])?8:0);
    dodaj("tlo","pakiet",w.pakiet||k.pakiet?6:0);
    dodaj("tlo","trudnosc",Math.min(10,Math.floor(+w.trudnosc||0)));
    dodaj("tlo","plynny",w.tryb==="plynny"?4:0);
    dodaj("tlo","dlugi",(+w.dlugoscSek||0)>=180?4:0);
    dodaj("klawisze","precyzja",Math.min(20,Math.floor((+w.precyzja||0)/5)));
    dodaj("klawisze","czysto",Math.min(15,Math.floor((w.czysto|0)/6)));
    dodaj("klawisze","rytm",Math.min(10,Math.floor((w.klikiWRytm|0)/3)));
    dodaj("klawisze","gwiazdki",4*Math.max(0,w.gwiazdki|0));
    dodaj("klawisze","bezBledu",(w.falsz|0)===0&&(w.pudlo|0)===0?6:0);
    if(k.pierwszaDnia)out.mnozniki.push({id:"dzien",x:MNOZNIK_DNIA});
    if((k.seria|0)>=SERIA_OD)out.mnozniki.push({id:"seria",x:MNOZNIK_SERII,dni:k.seria|0});
    out.mnoznik=out.mnozniki.reduce((m,x)=>m*x.x,1);
    for(const t of TORY){const s=pw.reduce((a,p)=>a+(p.tor===t?p.ile:0),0);out[t]=Math.ceil(s*out.mnoznik-1e-9);}
    return out;
  }

  // ---- zapis ----
  let pamiec=null,tylkoOdczyt=false,kopiaSprawdzona=false;   // 10-18: nowsza wersja zapisu = tylko do odczytu; kopia raz na sesję
  const dev={widownia:null,streak:null,tlo:null,klawisze:null,odblokuj:false};
  const nieujemna=v=>{v=+v;return Number.isFinite(v)&&v>0?Math.round(v):0;};
  const tekst40=v=>typeof v==="string"&&v?v.slice(0,40):null;
  // `los` (10-17, WSPOLNE): koło nagród ekipy w formacie profilu (losZ); null = jeszcze nikt nie grał. `gry` = piosenki ekipy.
  function nowaEkipa(){return {slawa:0,motywy:{},wybor:"auto",wszystko:null,los:null,gry:0};}
  function pusty(){return {wersja:WERSJA,profile:{},kapsle:{},ekipa:nowaEkipa()};}
  // Ekipa z zapisu wersji 3 (oczyszczona) albo, gdy jej nie ma (wersja 1 i 2, zepsuty wpis), odtworzona z profili:
  // suma sławy wszystkich profili i motywy planszy ze skrótów osiągnięć, które ktoś już zdobył.
  function ekipaZ(e,profile){
    const n=nowaEkipa();
    if(e&&typeof e==="object"&&!Array.isArray(e)){
      n.slawa=nieujemna(e.slawa);
      if(e.motywy&&typeof e.motywy==="object")for(const [id,d] of Object.entries(e.motywy))if(tekst40(id))n.motywy[tekst40(id)]=String(d||"").slice(0,40);
      n.wybor=tekst40(e.wybor)||"auto";n.wszystko=tekst40(e.wszystko);
      n.los=losZ(e.los);n.gry=nieujemna(e.gry);
      return n;
    }
    for(const p of Object.values(profile||{})){
      n.slawa+=slawaRazem(p.slawa);
      for(const [id,d] of Object.entries(p.osiagniecia||{})){const o=MAPA.get(id),t=torNagrody(o);if(t&&naPlanszy(t)&&!n.motywy[o.nagroda[t]])n.motywy[o.nagroda[t]]=String(d||"").slice(0,40);}
    }
    return n;
  }
  const kolorOk=k=>typeof k==="string"&&/^#[0-9a-f]{6}$/i.test(k)?k.toLowerCase():null;
  // Awatar profilu (10-19, js/awatary.js): samo id z listy awatarów, krótkie i w jednym kształcie (małe litery, cyfry,
  // minus). Ten plik nie zna listy: nieznane id rozwiązuje okno (Awatary.dla), a profil bez pola dostaje awatar
  // policzony z klucza, więc stary zapis nie potrzebuje nowej WERSJI ani przeliczenia (pole jest opcjonalne jak `ust`).
  const awatarOk=a=>typeof a==="string"&&/^[a-z0-9-]{1,24}$/.test(a)?a:null;
  // Ustawienia per profil (`ust`, 10-10: pod „aktywny profil” i język gracza, który dobuduje sesja „Język toggle
  // i konta”): płaski obiekt prostych wartości (tekst do 500 znaków, liczba skończona, prawda/fałsz, null), najwyżej
  // 100 kluczy do 60 znaków. Złe wartości odpadają po cichu (pominiete). Ten plik ich nie czyta, tylko przechowuje.
  const PROSTA=v=>v===null||typeof v==="boolean"||(typeof v==="number"&&Number.isFinite(v))||(typeof v==="string"&&v.length<=500);
  function ustZ(u,pominiete){
    if(!u||typeof u!=="object"||Array.isArray(u))return null;
    const out={};let n=0;
    for(const [k,v] of Object.entries(u)){
      if(n>=100||k.length>60||!PROSTA(v)){if(pominiete)pominiete.push(k);continue;}
      out[k]=v;n++;
    }
    return out;
  }
  // Koło nagród (10-16): {uzyte: ile losowań zużyto, wygrane:[{t:"instrument"|"efekt", id, r:rzadkość, p:poziom}], bezE, bezL: ile
  // losowań bez epickiej i bez legendarnej rzeczy (gwarancje)}. Profil bez `los` jest jeszcze na starych progach.
  // Piąta rzadkość „sekretny”: jedna sekretna rzecz na kategorię (SEKRETY), z niebywale niską szansą (WAGI_RZADKOSCI),
  // na pasku jako czarna holograficzna karta ze znakiem zapytania. Instrumenty: „studio” = odblokowanie Studia dźwięków (nie jest
  // instrumentem, w `wygrane` ma t:"studio"); skiny i sceny: Prawdziwy staw, którego progi sławy NIE otwierają. Sekret nie zużywa
  // losowania (jak scena) i nie jest na drodze poziomów.
  const RZADKOSCI=["zwykly","rzadki","epicki","legendarny","sekretny"];
  const SEKRETY={instrument:"studio",efekt:"prawdziwy",plansza:"prawdziwy"};
  const jestSekret=(k,id)=>SEKRETY[k]===id;
  const sekretGracza=(k,id)=>k==="plansza"?SEKRETY.plansza===id:SEKRETY.efekt===id;   // sekret toru (bez instrumentów)
  // Instrumenty, które gasną po uderzeniu, nie pasują do śpiewu: pięć zastąpionych nowymi na tym samym
  // miejscu drogi i w tej samej rzadkości. Wygrane ze starym id przechodzą na następcę przy wczytaniu (losZ), wybrany
  // instrument w ustawieniach gracza w zabi-chor.js (wczytajUstawienia).
  const ZAMIANY_INSTRUMENTOW={marimba:"bas",musicbox:"hawajska",steeldrum:"duduk",dzwon:"kot",klawesyn:"hammond"};
  function losZ(l){
    if(!l||typeof l!=="object"||Array.isArray(l))return null;
    const w=[];
    for(const x of Array.isArray(l.wygrane)?l.wygrane.slice(0,200):[])
      if(x&&(x.t==="instrument"||x.t==="efekt"||x.t==="studio")&&tekst40(x.id))w.push({t:x.t,id:x.t==="instrument"&&ZAMIANY_INSTRUMENTOW[x.id]||tekst40(x.id),r:RZADKOSCI.includes(x.r)?x.r:"zwykly",p:nieujemna(x.p)});   // 10-17: „studio” też (wcześniej ginęło przy wczytaniu)
    return {uzyte:nieujemna(l.uzyte),wygrane:w,bezE:nieujemna(l.bezE),bezL:nieujemna(l.bezL),bonus:nieujemna(l.bonus)};
  }
  function profilZZapisu(k,p){
    const sl=p.slawa&&typeof p.slawa==="object"?p.slawa:{},wy=p.wybor&&typeof p.wybor==="object"?p.wybor:{},slawa={},wybor={};
    for(const t of TORY){slawa[t]=nieujemna(sl[t]);wybor[t]=typeof wy[t]==="string"&&wy[t]?wy[t].slice(0,40):"auto";}
    const n={nazwa:String(p.nazwa||k).slice(0,18),liczniki:Object.assign(nowyLiczniki(),p.liczniki&&typeof p.liczniki==="object"?p.liczniki:{}),
      osiagniecia:Object.assign({},p.osiagniecia&&typeof p.osiagniecia==="object"?p.osiagniecia:{}),slawa,wybor,ostatnio:+p.ostatnio||0,
      przypiety:p.przypiety===true,kolor:kolorOk(p.kolor),utworzony:nieujemna(p.utworzony)};
    const aw=awatarOk(p.awatar);if(aw)n.awatar=aw;   // pole opcjonalne: bez niego okno pokazuje awatar domyślny dla klucza
    const u=ustZ(p.ust);if(u)n.ust=u;   // pole opcjonalne: profil bez ustawień nie dostaje pustego obiektu
    const zach=zachowaneZ(p.zachowane);if(zach)n.zachowane=zach;   // efekty odblokowane starą krzywą (10-15)
    const los=losZ(p.los);if(los)n.los=los;   // koło nagród (10-16): wylosowane rzeczy i liczniki gwarancji
    return n;
  }
  // `zachowane` (10-15): {[id motywu]:1} = efekty, które profil miał odblokowane przed zmianą krzywej progów; zostają mu
  // na zawsze, choć nowy próg jest wyżej. Najwyżej 60 wpisów, id do 40 znaków.
  function zachowaneZ(z){
    if(!z||typeof z!=="object"||Array.isArray(z))return null;
    const out={};for(const id of Object.keys(z).slice(0,60)){const k=tekst40(id);if(k)out[k]=1;}
    return Object.keys(out).length?out:null;
  }
  // Zmiana krzywej nie zabiera odblokowań: wszystko, co stara krzywa (progIStary) dawała z obecnej sławy, przechodzi do
  // `profil.zachowane` (efekty) i `ekipa.motywy` (plansza, jak skrót). Woła ją migracja i import plików wersji ≤ 3.
  function zachowajStareProgi(profile,ekipa){
    // stara krzywa miała 15 motywów (10-16: drabinka ma 20, a motywy 16–20 nigdy nie stały na starej krzywej)
    const dG=drabinkaToru(TOR_GRACZA).slice(0,STARE_MAKS),dP=drabinkaToru(TOR_PLANSZY).slice(0,STARE_MAKS);
    for(const p of Object.values(profile||{})){
      const s=slawaRazem(p.slawa),z=Object.assign({},p.zachowane);
      dG.forEach((w,i)=>{if(w&&i>0&&progIStary(i)<=s&&progI(i)>s)z[w.id]=1;});
      if(Object.keys(z).length)p.zachowane=z;
    }
    if(ekipa)dP.forEach((w,i)=>{if(w&&i>0&&progIStary(i)<=ekipa.slawa&&progI(i)>ekipa.slawa&&!ekipa.motywy[w.id])ekipa.motywy[w.id]="progi-v3";});
  }
  // Sława profilu z wersji 1: z liczników, które już są, plus sława za zdobyte osiągnięcia.
  function slawaZWersji1(l,osiagniecia){
    const s={widownia:18*(l.gry|0)+4*(l.kapselGry|0),streak:3*(l.najKombo|0)+8*(l.gry|0),
      tlo:14*ile(l.utwory)+8*ile(l.instrumenty)+4*(l.gry|0),
      klawisze:2*(l.najPrecyzja|0)+2*(l.najKlik|0)+8*(l.gry|0)+20*(l.najGwiazdki|0)};
    for(const id of Object.keys(osiagniecia||{})){const o=MAPA.get(id),t=torNagrody(o);if(t)s[t]+=SLAWA_ZA_OSIAGNIECIE[o.poziom]||0;}
    return s;
  }
  // Wersja 5 (10-17, WSPOLNE + krzywa „komplet w 3–5 h”). Nic, co ktokolwiek zdobył, nie ginie:
  //  • pula ekipy przechodzi na nową krzywą tym samym miejscem (ułamek odstępu między progami), więc poziom zostaje,
  //  • motywy planszy otwarte progami wersji 4 trafiają do ekipa.motywy (jak skrót), na wypadek zaokrągleń,
  //  • koło ekipy = suma wygranych wszystkich profili (instrumenty, skiny, Studio), skróty skinów z osiągnięć i `zachowane`;
  //    zużyte losowania = liczba tych rzeczy (najwyżej poziom ekipy), więc wolne losowania to tylko nadwyżka poziomu.
  const PROGI_V4=[0,75,160,255,360,475,600,735,880,1035,1200,1375,1560,1745,1935,2150,2375,2610,2855,3110,3375,3650,3950,4450,5000,5600,6250,6900,7600,8300];
  function przeliczKrzywa(s,z,na){
    s=+s||0;const n=z.length-1;
    if(s>=z[n])return Math.round(na[n]+(s-z[n])*(na[n]/Math.max(1,z[n])));
    let i=0;while(i<n&&z[i+1]<=s)i++;
    const f=(s-z[i])/Math.max(1,z[i+1]-z[i]);return Math.round(na[i]+f*(na[i+1]-na[i]));
  }
  function naWersje5(st){
    const E=st.ekipa,staraPula=E.slawa;
    drabinkaToru(TOR_PLANSZY).forEach((w,i)=>{if(w&&i>0&&i<PROGI_V4.length&&PROGI_V4[i]<=staraPula&&!jestSekret("plansza",w.id)&&!E.motywy[w.id])E.motywy[w.id]="progi-v4";});
    E.slawa=przeliczKrzywa(staraPula,PROGI_V4,PROGI);
    if(!WSPOLNE||E.los)return;
    const profile=Object.values(st.profile||{});
    if(!profile.length)return;
    const w=[],jest=new Set(),dodaj=(t,id,r,pz)=>{const k=t+"|"+id;if(!id||jest.has(k))return;jest.add(k);w.push({t,id,r:r||rzadkosc(t==="studio"?"instrument":t,id),p:pz|0});};
    let bonus=0,gry=0;
    for(const p of profile){
      gry+=(p.liczniki&&p.liczniki.gry)|0;
      if(p.los){for(const x of p.los.wygrane)dodaj(x.t,x.id,x.r,x.p);bonus=Math.max(bonus,p.los.bonus|0);}
      else{const s=przeliczKrzywa(slawaRazem(p.slawa),PROGI_V4,PROGI);for(const n of drogaPelna())if(n.prog<=s)dodaj(n.typ,n.id);}
      for(const id of Object.keys(p.zachowane||{}))dodaj("efekt",id);
      for(const id of Object.keys(p.osiagniecia||{})){const o=MAPA.get(id),t=torNagrody(o);if(t&&!naPlanszy(t))dodaj("efekt",o.nagroda[t]);}
    }
    const rzeczy=w.filter(x=>x.t!=="studio").length;
    E.los={uzyte:Math.min(rzeczy,poziomLosV5(E.slawa)),wygrane:w,bezE:0,bezL:0,bonus};   // poziomy wersji 5; wersja 6 przelicza je w naWersje6
    E.gry=Math.max(E.gry|0,gry);
  }
  // Wersja 6 (10-18, SCENY_Z_KOLA). Nic nie ginie:
  //  • każda scena, którą ekipa ma dziś z progu sławy, trafia na stałe do ekipa.motywy ("progi-v5"), jak skrót,
  //  • wolne losowania zostają te same: zużyte rosną o poziomy, które nowa krzywa (PROGI_LOS) ma ponad starą przy tej puli,
  //  • ale nigdy tak, żeby do końca drogi zabrakło losowań na rzeczy, których ekipa jeszcze nie ma (ostatnie daje dwie).
  function naWersje6(st){
    if(!SCENY_Z_KOLA)return;
    const E=st.ekipa;
    for(const id of odblokowanePlanszyZ(E,false,true))if(!E.motywy[id]&&id!==(drabinkaToru(TOR_PLANSZY)[0]||{}).id)E.motywy[id]="progi-v5";
    const L=E.los;if(!L)return;
    const maI=new Set(L.wygrane.filter(x=>x.t==="instrument").map(x=>x.id));
    const maE=new Set(odblokowaneZ({los:L,osiagniecia:{},zachowane:null},false,E.slawa)[TOR_GRACZA]),maP=new Set(odblokowanePlanszyZ(E,false));
    const brak=(t,k,ma)=>drabinkaToru(t).filter((w,i)=>w&&i>0&&!jestSekret(k,w.id)&&!ma.has(w.id)).length;
    const zostalo=INSTRUMENTY_KOLEJNOSC.filter(i=>i!=="ribbit"&&!maI.has(i)).length+brak(TOR_GRACZA,"efekt",maE)+brak(TOR_PLANSZY,"plansza",maP);
    zachowajWolne(L,poziomLos(E.slawa)-poziomLosV5(E.slawa));
    L.uzyte=Math.max(0,Math.min(L.uzyte,progiLos().length+(L.bonus|0)-zostalo));
  }
  // Zmiana krzywej o `roznica` poziomów przy tej samej puli: zużyte rosną/maleją o tyle, więc wolnych zostaje tyle samo;
  // gdy nowa krzywa daje mniej poziomów, niż ekipa już zużyła, brak idzie do bonusu (10-19: wcześniej ucinało losowanie).
  function zachowajWolne(L,roznica){
    let uz=(L.uzyte|0)+roznica;
    if(uz<0){L.bonus=(L.bonus|0)-uz;uz=0;}
    L.uzyte=uz;
  }
  // Wersje 7 i 8 (za dużo losowań po pierwszej piosence, potem więcej sławy z poziomu na poziom): zmiana krzywej
  // losowań (KRZYWE_LOS[wersja zapisu] = krzywa, z którą zapis powstał). Odblokowane rzeczy zostają, wolne losowania też;
  // dalej liczy już obecna krzywa od obecnej puli. Każda NASTĘPNA zmiana LOS_*: wpis do KRZYWE_LOS + nowa WERSJA.
  function naKrzywa(st,wersja){
    const L=st.ekipa&&st.ekipa.los;if(!L||!KRZYWE_LOS[wersja])return;
    zachowajWolne(L,poziomLos(st.ekipa.slawa)-poziomLosKrzywej(KRZYWE_LOS[wersja],st.ekipa.slawa));
  }
  // Migracja: brak zapisu, zepsuty JSON albo nieznana wersja = pusty stan; wersja 1 przelicza się na 2 (sława
  // z liczników i osiągnięć, wybór widowni i streaka zostaje, reszta „auto”); profil bez którego pola dostaje domyślne.
  const WERSJE=[1,2,3,4,5,6,7,8,9,10,WERSJA];
  function migruj(z){
    if(!z||typeof z!=="object"||!WERSJE.includes(z.wersja)||typeof z.profile!=="object"||!z.profile)return pusty();
    const out=pusty();
    for(const [k,p] of Object.entries(z.profile)){
      if(!p||typeof p!=="object")continue;
      const n=profilZZapisu(k,p);
      if(z.wersja===1)n.slawa=slawaZWersji1(n.liczniki,n.osiagniecia);
      out.profile[k]=n;
    }
    // kapsel → profil: tylko wpisy wskazujące profil, który jest
    const kz=z.kapsle&&typeof z.kapsle==="object"?z.kapsle:{};
    for(const [id,k] of Object.entries(kz))if(typeof k==="string"&&out.profile[k])out.kapsle[String(id).slice(0,80)]=k;
    out.ekipa=ekipaZ(z.wersja>=3?z.ekipa:null,out.profile);
    if(z.wersja<4)zachowajStareProgi(out.profile,out.ekipa);
    if(z.wersja<5)naWersje5(out);
    if(z.wersja<6)naWersje6(out);   // v5 → od razu na obecną krzywą (poziomLos), więc bez naKrzywa
    else if(z.wersja<WERSJA)naKrzywa(out,z.wersja);
    return out;
  }
  function stanZapisu(){
    if(pamiec)return pamiec;
    let z=null;try{z=JSON.parse(localStorage.getItem(KLUCZ)||"null");}catch(e){z=null;}
    // 10-18 (E-04): nowsza wersja zapisu = tylko do odczytu (migruj daje pusty stan, a zapisz() nadpisałby nim postępy)
    tylkoOdczyt=!!(z&&typeof z==="object"&&typeof z.wersja==="number"&&z.wersja>WERSJA);
    return (pamiec=migruj(z));
  }
  // Przed pierwszym nadpisaniem zapisu starszej wersji: jedna surowa kopia na wersję (nie nadpisuje się).
  function kopiaPrzedNadpisaniem(){
    if(kopiaSprawdzona)return;kopiaSprawdzona=true;
    try{
      const surowy=localStorage.getItem(KLUCZ);if(!surowy)return;
      const w=(JSON.parse(surowy)||{}).wersja;
      if(typeof w!=="number"||w>=WERSJA)return;
      const kk=KLUCZ+".kopia-v"+w;if(localStorage.getItem(kk)==null)localStorage.setItem(kk,surowy);
    }catch(e){}
  }
  // Do 10-10 ponad 40 profili znikały po cichu najdawniej grające, także te z postępem. Teraz limit jest wysoki, a sam
  // usuwa tylko profile, które nic nie tracą (doUsunieciaPrzyLimicie): najpierw najdawniej użyte.
  function zapisz(){
    const s=stanZapisu();
    if(tylkoOdczyt)return;
    for(const x of doUsunieciaPrzyLimicie(s,MAKS_PROFILI))delete s.profile[x];
    kopiaPrzedNadpisaniem();
    try{localStorage.setItem(KLUCZ,JSON.stringify(s));}catch(e){}
  }
  const nazwaNorm=n=>{const t=String(n==null?"":n).trim().slice(0,18);return t||GOSC;};
  const kluczProfilu=n=>nazwaNorm(n).toLocaleLowerCase("pl");
  // Nazwa profilu gracza ze składu: wpisana nazwa albo nazwa kapsla; mysz, klawiatura i pad bez nazwy to „Gość”.
  function nazwaProfilu(g){
    if(!g||g.zrodlo==="bot")return null;
    if(g.nazwaWlasna||g.zrodlo==="kapsel")return nazwaNorm(g.nazwa);
    return GOSC;
  }
  function nowyProfil(nazwa){return profilZZapisu("",{nazwa:nazwaNorm(nazwa)});}
  // Profil do odczytu (nie zapisuje się, dopóki nic się w nim nie zmieni).
  function profil(nazwa){
    const s=stanZapisu(),k=kluczProfilu(nazwa);
    return s.profile[k]||nowyProfil(nazwa);
  }
  function profilDoZapisu(nazwa){
    const s=stanZapisu(),k=kluczProfilu(nazwa);
    if(!s.profile[k])s.profile[k]=nowyProfil(nazwa);
    return s.profile[k];
  }
  // ---- do kogo należą odblokowania (WSPOLNE) ----
  // Przy WSPOLNE odblokowania i losowania należą do „profilu ekipy”: pula = ekipa.slawa, koło = ekipa.los (ten sam obiekt, więc
  // zmiany idą prosto do zapisu), bez osiągnięć (skróty efektów trafiają do ekipa.los.wygrane w poGrze). Bez WSPOLNE = profil gracza.
  const nowyLos=E=>({uzyte:0,wygrane:[],bezE:0,bezL:0,bonus:(!(E.gry|0)&&!(+E.slawa>0))?1:0});   // świeża ekipa: jedno losowanie na start
  function profilEkipy(){
    const E=stanZapisu().ekipa;if(!E.los)E.los=nowyLos(E);
    return {nazwa:"ekipa",osiagniecia:{},zachowane:null,slawa:{widownia:E.slawa,streak:0,tlo:0,klawisze:0},los:E.los,liczniki:{gry:E.gry|0},ekipa:true};
  }
  const wlasciciel=nazwa=>WSPOLNE?profilEkipy():profil(nazwa==null?GOSC:nazwa);
  const wlascicielDoZapisu=nazwa=>WSPOLNE?profilEkipy():profilDoZapisu(nazwa==null?GOSC:nazwa);

  // ---- odblokowania i wybór ----
  // Pula sławy profilu: suma czterech torów (10-09, odblokowania motywów liczą się z niej).
  const slawaRazem=sl=>TORY.reduce((a,t)=>a+(+(sl&&sl[t])||0),0);
  // Odblokowane stopnie z profilu ({slawa, osiagniecia}): stopień 1 zawsze, próg puli sławy albo skrót z osiągnięcia
  // (motyw ze skrótu otwiera się na wszystkich torach); `wszystko` (?odblokuj=1) = cała drabinka. Id w kolejności drabinki.
  // Czysta funkcja PROFILU (testy, lista): co profil odblokował sam, z własnej puli i swoich skrótów. Gra czyta z niej
  // tylko tor streak (efekt); tory planszy liczy odblokowanePlanszyZ. `pula` = inna pula zamiast sumy profilu
  // (EFEKTY_Z_PULI_EKIPY).
  function odblokowaneZ(p,wszystko,pula){
    const os=(p&&p.osiagniecia)||{},s=pula!=null?+pula||0:slawaRazem(p&&p.slawa),skroty=new Set(),out={};
    for(const o of OSIAGNIECIA){if(!os[o.id])continue;const t=torNagrody(o);if(t)skroty.add(o.nagroda[t]);}
    for(const id of Object.keys((p&&p.zachowane)||{}))skroty.add(id);   // odblokowane starą krzywą (10-15)
    // 10-16: profil z kołem (`los`) dostaje efekty z losowań, a nie z progów; poziomy dają tylko losowania
    const kolo=!!(p&&p.los),wygr=new Set(kolo?p.los.wygrane.filter(x=>x.t==="efekt").map(x=>x.id):[]);
    for(const t of TORY){
      const d=drabinkaToru(t);
      out[t]=d.filter((w,i)=>w&&((wszystko&&!(oszust()&&sekretGracza(naPlanszy(t)?"plansza":"efekt",w.id)))||i===0||(!kolo&&progI(i)<=s&&!sekretGracza(naPlanszy(t)?"plansza":"efekt",w.id))||skroty.has(w.id)||wygr.has(w.id))).map(w=>w.id);   // sekretu progi nie otwierają (10-17)
    }
    return out;
  }
  // Motywy planszy odblokowane przez ekipę ({slawa, motywy}): pierwszy zawsze, próg puli ekipy albo motyw ze skrótu
  // (osiągnięcie kogokolwiek). Czysta funkcja, id w kolejności drabinki. 10-18 (SCENY_Z_KOLA): bez progów, tylko pierwsza scena,
  // `motywy` (koło, skróty i sceny zachowane z progów przy migracji) i „wszystko”; `zProgow` = stara reguła (migracja).
  function odblokowanePlanszyZ(e,wszystko,zProgow){
    const s=+(e&&e.slawa)||0,m=(e&&e.motywy)||{},progi=zProgow||!SCENY_Z_KOLA;
    return drabinkaToru(TOR_PLANSZY).filter((w,i)=>w&&((wszystko&&!(oszust()&&jestSekret("plansza",w.id)))||i===0||(progi&&progI(i)<=s&&!jestSekret("plansza",w.id))||!!m[w.id])).map(w=>w.id);   // sekret tylko z koła (10-17)
  }
  // ?odblokuj=1 (sesja) albo `ekipa.wszystko` (zapis, ukryty kod) = wszystko do wyboru.
  // 10-19: tryb oszusta (js/tryb-oszusta.js) = wszystko do wyboru do końca sesji, ale bez postępów i losowań.
  const oszust=()=>typeof TrybOszusta!=="undefined"&&TrybOszusta.aktywny;
  const wszystkoOtwarte=()=>dev.odblokuj||oszust()||!!stanZapisu().ekipa.wszystko;
  // 10-16: „zdobyte wszystko” = cała droga gracza (poziom maksymalny, wszystkie efekty i instrumenty) i wszystkie motywy planszy,
  // albo ukryty kod / ?odblokuj=1. Od tego momentu gra daje Studio dźwięków (js/studio.js).
  // Studio dźwięków (10-16): odblokowuje się samo, gdy profil wylosował wszystkie instrumenty (albo ukryty kod / ?odblokuj=1).
  const instrumentyWszystkie=nazwa=>wszystkoOtwarte()||pulaLosowania(nazwa==null?GOSC:nazwa).instrument.length===0;
  // Studio dźwięków otwiera sekretna karta instrumentów (albo ukryty kod / ?odblokuj=1), nie komplet instrumentów.
  // Tryb oszusta otwiera wszystko POZA supersekretami (Studio, „prawdziwy”): te tylko z koła, jak bez trybu.
  const studioOdblokowane=nazwa=>{if(wszystkoOtwarte()&&!oszust())return true;const p=wlasciciel(nazwa);return !!(p&&p.los&&p.los.wygrane.some(x=>x.t==="studio"));};
  const wszystkoZdobyte=nazwa=>{
    if(wszystkoOtwarte()&&!oszust())return true;
    const nm=nazwa==null?GOSC:nazwa,pu=pulaLosowania(nm);
    return nastepnyCel(nm,"efekt")==null&&losowania(nm)===0&&!pu.instrument.length&&!pu.efekt.length&&!pu.plansza.length&&nastepnyCel(null,"plansza")==null;
  };
  const pulaEfektow=p=>EFEKTY_Z_PULI_EKIPY?stanZapisu().ekipa.slawa:slawaRazem(p&&p.slawa);
  // Odblokowania, jak widzi je gra: tor streak z profilu, tory planszy z ekipy (jedna lista na wszystkich trzech).
  function odblokowane(nazwa){
    const p=wlasciciel(nazwa),w=wszystkoOtwarte(),os=odblokowaneZ(p,w,pulaEfektow(p)),pl=odblokowanePlanszyZ(stanZapisu().ekipa,w),out={};
    for(const t of TORY)out[t]=naPlanszy(t)?pl.slice():os[t];
    return out;
  }
  // Najbliższy cel (10-15, wyniki: „następny: X · jeszcze ok. N piosenek”): pierwszy jeszcze zamknięty motyw drabinki
  // (efekt profilu albo plansza ekipy, bez „wszystko”), z progiem i brakującą sławą; null = wszystko zdobyte.
  // Droga gracza (spójne odblokowywanie kolejnych rzeczy: domyślnie tylko ribbit, z każdym kolejnym krokiem
  // po jeden lub dwa). Własna pula profilu otwiera JEDNĄ listę nagród: 19 efektów (drabinka streak od drugiego) i 39
  // instrumentów (ribbit na start). Efekt k ma próg jak dotąd (PROGI[k−1]), a instrumenty stoją między efektami: trzy w
  // pierwszym odstępie, potem po dwa (na 1/3 i 2/3 odstępu), więc nagroda przychodzi mniej więcej co piosenkę, a co
  // trzecia to nowy efekt. Poziom gracza = 1 + liczba nagród z progiem w zasięgu puli (1–59). Skróty z osiągnięć dalej
  // otwierają efekty wcześniej; plansza zostaje osobno (pula ekipy). „Wszystko” (ukryty kod, ?odblokuj=1) otwiera całość,
  // boty i dev mają wszystkie instrumenty (pilnuje tego gra).
  const INSTRUMENTY_KOLEJNOSC=["ribbit","trabka","chor","flet","piano","guitar","smyczki","bas","organy","syntezator",
    "epiano","hawajska","theremin","kazoo","przester","harmonijka","kwak","kot","okaryna","impuls","puzon","szept",
    "trance","klarnet","erhu","wiolonczela","chiptune","wiatr","gwizdek","duduk","tuba","oboj","didgeridoo","dudy",
    "sub","opera","wobble","hammond","robot","wokal","krzyk"];
  // Progi instrumentów: ribbit 0; i-ty (1–39) w odstępie efektów j z udziałem u (pierwszy odstęp 1/4, 2/4, 3/4); od 10-17
  // odstępy j ≥ 1 mają na przemian 2 i 1 instrument (2 przy j % 3 = 1), więc 39 instrumentów wypełnia 28 odstępów do ostatniego motywu (10-19: Krzyk, 40. instrument, wypada w odstępie 29).
  const PROGI_INSTRUMENTOW=(()=>{
    const out={ribbit:0},n=INSTRUMENTY_KOLEJNOSC.length-1;let i=1;
    for(let j=0;i<=n;j++){
      const ile=j===0?3:(j%3===1?2:1),a=progI(j),b=progI(j+1);
      for(let k=1;k<=ile&&i<=n;k++,i++)out[INSTRUMENTY_KOLEJNOSC[i]]=Math.round(a+(b-a)*k/(ile+1));
    }
    return out;
  })();
  const progInstrumentu=id=>id in PROGI_INSTRUMENTOW?PROGI_INSTRUMENTOW[id]:null;
  const instrumentyZ=(pula,wszystko)=>INSTRUMENTY_KOLEJNOSC.filter(i=>wszystko||PROGI_INSTRUMENTOW[i]<=(+pula||0));
  function instrumenty(nazwa){
    const p=wlasciciel(nazwa);
    if(wszystkoOtwarte())return INSTRUMENTY_KOLEJNOSC.slice();
    if(p.los){const m=new Set(p.los.wygrane.filter(x=>x.t==="instrument").map(x=>x.id));return INSTRUMENTY_KOLEJNOSC.filter(i=>i==="ribbit"||m.has(i));}
    return instrumentyZ(pulaEfektow(p),false);
  }
  // instrumenty, które otwiera przejście puli z `przed` do `po` (wyniki: „Nowy instrument”)
  const noweInstrumentyZ=(przed,po)=>{const a=+przed||0,b=+po||0;   // pula przed grą i po niej (liczby)
    return INSTRUMENTY_KOLEJNOSC.filter(i=>PROGI_INSTRUMENTOW[i]>a&&PROGI_INSTRUMENTOW[i]<=b);};
  // Cała droga: [{typ:"efekt"|"instrument", id, nazwa (efekt; instrument nazywa gra), prog}] rosnąco po progu, bez nagród
  // startowych (pierwszy efekt i ribbit).
  function drogaPelna(){
    const d=drabinkaToru(TOR_GRACZA),out=[];
    d.forEach((w,i)=>{if(w&&i>0&&!jestSekret("efekt",w.id))out.push({typ:"efekt",id:w.id,nazwa:w.nazwa,prog:progI(i)});});   // sekret poza drogą (10-17)
    for(const i of INSTRUMENTY_KOLEJNOSC)if(PROGI_INSTRUMENTOW[i]>0)out.push({typ:"instrument",id:i,nazwa:null,prog:PROGI_INSTRUMENTOW[i]});
    return out.sort((a,b)=>a.prog-b.prog||(a.typ==="efekt"?1:-1));
  }
  // 10-16 (koło nagród): poziomów jest o jeden mniej niż rzeczy do zdobycia (58), bo ostatnie losowanie daje od razu dwie.
  // Poziom = jedno losowanie na kole; sama lista rzeczy (drogaPelna) służy do przeniesienia starych profili.
  const drogaV5=()=>drogaPelna().slice(0,-1);
  // 10-18 (SCENY_Z_KOLA): na kole są też sceny; od 10-19 (bez dubla) poziomów jest tyle, ile rzeczy do wylosowania (losowanie
  // startowe jest zapasem): 40 instrumentów + 29 skinów + 29 scen = 98 (10-19: Krzyk i Kukiełki; wcześniej 95, a do 10-19: 94, bo ostatnie dawało dwie). Odstęp poziomu k (w sławie
  // puli ekipy) = max(LOS_MIN, LOS_G0 + LOS_C·k^LOS_Q). Za dużo losowań po pierwszej piosence, potem więcej sławy
  // z poziomu na poziom, potem większe zróżnicowanie przy tej samej sumie: liniowo 276 → 414
  // (wersja 8: 330 → 390, suma ta sama ok. 32,8 tys.; do 10-18:
  // 87 → 1300, co przy pierwszej piosence dnia z ×2 i pierwszymi osiągnięciami dawało 10+ losowań). LOS_MIN = zapas, gdyby
  // krzywa miała kiedyś maleć. Stałe dobrane WYŁĄCZNIE symulacją (skrypt poza repozytorium): po 1. piosence solo 3 losowania
  // (z bonusem startowym), w grupie 5–6; komplet solo 4,1–4,6 h, w czwórkę ok. 3,2 h.
  const LOS_G0=255,LOS_C=0.00003,LOS_Q=3,LOS_MIN=120;   // nieco spłaszczona, komplet ok. 5 godzin, gra bez osiągnięć: 255 → 284, sym.mjs solo przeciętny 4,99 h; wcześniej 330 → 390 (KRZYWE_LOS[10])
  // Krzywe, z którymi powstały starsze zapisy (wersja → [G0, C, Q, MIN]), tylko do migracji (naKrzywa).
  const KRZYWE_LOS={6:[87,.00137,3,0],7:[380,-0.00025,3,120],8:[330,.00007,3,120],9:[275,1.465,1,120],10:[330,.00007,3,120]};
  const rzeczyNaKole=()=>INSTRUMENTY_KOLEJNOSC.length-1+[TOR_GRACZA,TOR_PLANSZY].reduce((a,t)=>a+drabinkaToru(t).filter((w,i)=>w&&i>0&&!jestSekret(t===TOR_PLANSZY?"plansza":"efekt",w.id)).length,0);
  let progiLosPamiec=null;
  // 10-19: krzywa na próbę (strona testu koła, porównanie wariantów): [G0, C, Q, MIN] tylko w pamięci strony, nic nie zapisuje.
  let krzywaProba=null;
  function ustawKrzywaProba(k){krzywaProba=Array.isArray(k)?k.slice(0,4):null;progiLosPamiec=null;}
  function progiLos(){
    const n=Math.max(1,rzeczyNaKole());
    if(progiLosPamiec&&progiLosPamiec.length===n)return progiLosPamiec;
    let s=0;const out=[];
    for(let k=1;k<=n;k++){const K=krzywaProba||[LOS_G0,LOS_C,LOS_Q,LOS_MIN];s+=Math.max(K[3]||0,K[0]+K[1]*Math.pow(k,K[2]));out.push({typ:"los",id:"los",nazwa:null,prog:Math.round(s/5)*5});}
    return (progiLosPamiec=out);
  }
  // Ile poziomów (losowań) daje pula na krzywej [G0, C, Q, MIN] (migracja starszych zapisów).
  function poziomLosKrzywej(k,pula){
    const n=Math.max(1,rzeczyNaKole()),p=+pula||0;let s=0,ile=0;
    for(let i=1;i<=n;i++){s+=Math.max(k[3]||0,k[0]+k[1]*Math.pow(i,k[2]));if(Math.round(s/5)*5<=p)ile++;else break;}
    return ile;
  }
  const poziomLosV6=pula=>poziomLosKrzywej(KRZYWE_LOS[6],pula);
  const droga=()=>SCENY_Z_KOLA?progiLos():drogaV5();
  // ---- koło nagród (po podniesieniu poziomu zamiast konkretnej nagrody losowanie na kole z tego, co zostało;
  // najpierw instrument/tło/efekt, potem rzecz z kategorii; najfajniejsze legendarne, ostatnie daje dwie) ----
  // Rzadkość: z list ułożonych ręcznie w tier liście (instrumenty i motywy), nie z numeru stopnia drabinki.
  const WAGI_RZADKOSCI={zwykly:56,rzadki:28,epicki:12,legendarny:4,sekretny:.3};   // sekretny ≈ 0,3 % losowania (10-17)
  const GWARANCJA_EPICKIEJ=5,GWARANCJA_LEGENDARNEJ=14;   // tyle losowań bez epickiej / legendarnej → następne ją daje
  // Tier lista rzadkości jest ułożona do końca i kolejność jest ustalona: przydział z jej wyników
  // (ręczna ocena poza repozytorium) zamiast
  // dawnych list instrumentów (legendarne robot, theremin, didgeridoo, trance; epickie przester, kot, hammond, chor, opera, wobble;
  // rzadkie duduk, erhu, kazoo, harmonijka, okaryna, dudy, tuba, oboj, impuls, szept, wiatr) i progów po numerze stopnia drabinki
  // (od 26 legendarny, od 20 epicki, od 12 rzadki). Liczby zostają jak były (instrumenty 4 / 6 / 11, motywy 4 / 6 / 8, reszta zwykła),
  // więc wagi, gwarancje i krzywa poziomów (kalibrowana symulacją) się nie zmieniają, zmienia się tylko KTÓRE rzeczy są rzadkie.
  // Skin (efekt) i scena (plansza) tego samego motywu mają jedną rzadkość; rzecz spoza list (np. nowy motyw) jest zwykła.
  // „Od początku” (Ribbit i Filc, poza pulą koła) oraz sekrety (SEKRETY) bez zmian. Listy czyta narzędzie tier listy (`limityZGry`
  // w tierlista.js), więc nazwy i układ stałych zostają.
  const LEGENDARNE_I=["chiptune","kwak","krzyk","robot","syntezator"],EPICKIE_I=["flet","harmonijka","organy","przester","theremin","tuba"],
    RZADKIE_I=["chor","dudy","impuls","kazoo","oboj","okaryna","puzon","smyczki","sub","trance","wiolonczela"];
  const LEGENDARNE_M=["8bit","kredki","szachy","zloto"],EPICKIE_M=["gielda","muchomor","olimp","piraci","podwodny","synthwave"],
    RZADKIE_M=["cyrk","einstein","garaz","kosmos","kukielki","sashiko","skatepark","tiki","voodoo"];
  function rzadkosc(typ,id){
    if(jestSekret(typ,id))return "sekretny";
    const [l,e,r]=typ==="instrument"?[LEGENDARNE_I,EPICKIE_I,RZADKIE_I]:[LEGENDARNE_M,EPICKIE_M,RZADKIE_M];   // skin i scena: te same listy motywów
    return l.includes(id)?"legendarny":e.includes(id)?"epicki":r.includes(id)?"rzadki":"zwykly";
  }
  const poziomLos=s=>droga().filter(n=>n.prog<=(+s||0)).length;   // ile losowań dały poziomy z tej puli
  const poziomLosV5=s=>drogaV5().filter(n=>n.prog<=(+s||0)).length;   // poziomy wersji 5 (bez scen na kole): migracja
  // Stary profil (bez `los`) przechodzi na koło bez straty: wszystko, co dawały progi, zostaje wygrane, losowania zużyte.
  function zalozLos(p){
    if(p.los)return p.los;
    const s=pulaEfektow(p),w=[];
    for(const n of drogaPelna())if(n.prog<=s)w.push({t:n.typ,id:n.id,r:rzadkosc(n.typ,n.id),p:0});
    // bonus: nowy profil (żadnej gry, zero sławy) dostaje jedno losowanie na start, także na scenę (tło)
    p.los={uzyte:Math.min(w.length,poziomLos(s)),wygrane:w,bezE:0,bezL:0,bonus:(!((p.liczniki&&p.liczniki.gry)|0)&&s===0)?1:0};
    return p.los;
  }
  // Ile losowań czeka (poziomy minus zużyte); profil bez koła jeszcze nic nie ma do losowania.
  // Gdy wszystko jest odblokowane, gracz tylko zdobywa poziomy, już bez losowania: przy pustej puli
  // (żadnego instrumentu, skina ani sceny do wylosowania) poziomy dalej rosną, ale losowań nie ma i koło się nie otwiera.
  // 10-18 (D-4, E-02): kategoria z pustą zwykłą pulą zostaje na kole, dopóki jej sekret jest niezdobyty; wtedy daje go na pewno
  // i za darmo (sekret nie zużywa losowania), także gdy poziomy już się skończyły. Wagi sekretu w niepustej kategorii bez zmian.
  const KAT_KOLA=["instrument","efekt","plansza"];
  const naKole=(pu,k)=>pu[k].length>0||!!pu.sekret[k];
  const samSekret=pu=>KAT_KOLA.filter(k=>!pu[k].length&&pu.sekret[k]);
  const wolneZPoziomow=p=>poziomLos(pulaEfektow(p))-p.los.uzyte+(p.los.bonus|0);
  function losowania(nazwa){if(wszystkoOtwarte())return 0;   // 10-19: ?odblokuj=1 / ukryty kod otwierają wszystko, więc koło nie ma czego dać (tryb oszusta jak dotąd)
    const nm=nazwa==null?GOSC:nazwa,p=wlasciciel(nm);if(!p.los)return 0;const pu=pulaLosowania(nm);if(!KAT_KOLA.some(k=>naKole(pu,k)))return 0;return Math.max(0,wolneZPoziomow(p))+samSekret(pu).length;}
  function nicDoLosowania(nazwa){const pu=pulaLosowania(nazwa==null?GOSC:nazwa);return !KAT_KOLA.some(k=>naKole(pu,k));}
  // Po cichu: dopóki nie odblokowano SEKRETY_OD_RZECZY rzeczy (instrumenty, skiny i sceny razem, także ze skrótów
  // osiągnięć), sekretnych kart nie da się wylosować (pula sekretów pusta, więc nie wchodzą ani do zwykłego losowania, ani do
  // gwarancji po wyczerpaniu kategorii). Bez żadnego napisu w grze; testy i narzędzia dev wyłączają to przez ustawProgSekretow(0).
  const SEKRETY_OD_RZECZY=35;let progSekretow=SEKRETY_OD_RZECZY;
  const ustawProgSekretow=n=>{progSekretow=Math.max(0,+n||0);};
  const sekretyZablokowane=zostalo=>progSekretow>0&&rzeczyNaKole()-zostalo<progSekretow;
  // Rzeczy, które jeszcze zostały: instrumenty (bez Ribbita), efekty (bez pierwszego) i tła planszy, których nikt nie ma.
  function pulaLosowania(nazwa){
    const p=wlasciciel(nazwa),e=stanZapisu().ekipa,pula=pulaEfektow(p);
    const maI=new Set(p.los?p.los.wygrane.filter(x=>x.t==="instrument").map(x=>x.id):instrumentyZ(pula,false));
    const odbE=new Set(odblokowaneZ(p,false,pula)[TOR_GRACZA]),odbP=new Set(odblokowanePlanszyZ(e,false));
    const rzecz=(d,odb,k)=>d.filter((w,i)=>w&&i>0&&!odb.has(w.id)&&!jestSekret(k,w.id)).map(w=>w.id);
    // sekrety (10-17): jeszcze niezdobyte, osobno od zwykłej puli; studio = wpis t:"studio" w wygranych profilu
    const maStudio=!!(p.los&&p.los.wygrane.some(x=>x.t==="studio"));
    const zostalo=INSTRUMENTY_KOLEJNOSC.filter(i=>i!=="ribbit"&&!maI.has(i)).length+rzecz(drabinkaToru(TOR_GRACZA),odbE,"efekt").length+rzecz(drabinkaToru(TOR_PLANSZY),odbP,"plansza").length;
    const sekret=sekretyZablokowane(zostalo)?{instrument:null,efekt:null,plansza:null}:{instrument:maStudio?null:SEKRETY.instrument,efekt:odbE.has(SEKRETY.efekt)?null:SEKRETY.efekt,plansza:odbP.has(SEKRETY.plansza)?null:SEKRETY.plansza};
    return {instrument:INSTRUMENTY_KOLEJNOSC.filter(i=>i!=="ribbit"&&!maI.has(i)),efekt:rzecz(drabinkaToru(TOR_GRACZA),odbE,"efekt"),plansza:rzecz(drabinkaToru(TOR_PLANSZY),odbP,"plansza"),sekret};
  }
  function liczbaWgRzadkosci(nazwa){
    const pu=pulaLosowania(nazwa),out={zwykly:0,rzadki:0,epicki:0,legendarny:0,sekretny:0};
    for(const k of ["instrument","efekt","plansza"]){for(const id of pu[k])out[rzadkosc(k,id)]++;if(pu.sekret[k])out.sekretny++;}
    return out;
  }
  const kolejnoscRzeczy=(k,id)=>k==="instrument"?INSTRUMENTY_KOLEJNOSC.indexOf(id):drabinkaToru(k==="plansza"?TOR_PLANSZY:TOR_GRACZA).findIndex(w=>w&&w.id===id);
  function nazwaRzeczy(k,id){
    if(k==="instrument")return null;   // nazwę instrumentu zna gra (T.instrumentyGracza)
    const w=wpisDrabinki(k==="plansza"?TOR_PLANSZY:TOR_GRACZA,id);return w?w.nazwa:id;
  }
  // Kategoria losuje się sama (animacja paska kategorii), przedmiot losuje gracz (przytrzymanie mocy, potem losuj z `kat`). Nic nie zapisuje.
  function losujKategorie(nazwa,o){
    const rng=(o&&o.rng)||Math.random,nm=nazwa==null?GOSC:nazwa,pula=pulaLosowania(nm),p=wlasciciel(nm);
    const kat=!p.los||wolneZPoziomow(p)>0?KAT_KOLA.filter(k=>naKole(pula,k)):samSekret(pula);   // bez losowań z poziomów: tylko sekrety
    if(!kat.length)return null;
    return {kat:o&&o.kat&&kat.includes(o.kat)?o.kat:kat[Math.floor(rng()*kat.length)],kategorie:kat,pula};
  }
  // Wszystkie rzeczy kategorii (także już wygrane): do wypełnienia paska losowania, gdy pozostałych jest mało.
  function wszystkieRzeczy(k){
    return k==="instrument"?INSTRUMENTY_KOLEJNOSC.filter(i=>i!=="ribbit"):drabinkaToru(k==="plansza"?TOR_PLANSZY:TOR_GRACZA).filter((w,i)=>w&&i>0).map(w=>w.id);
  }
  // Jedno losowanie: kategoria (równe szanse spośród niepustych), potem rzadkość (wagi, gwarancje) i rzecz. Zapis od razu, zanim
  // animacja się zacznie. Do 10-18 scena nie zużywała losowania; od SCENY_Z_KOLA zużywa (darmowa zostaje tylko sekretna karta). Gdy
  // po losowaniu zostaje jedna rzecz, dostajesz ją od razu: ostatnie losowanie daje dwie. Zwraca null, gdy nie ma czego losować.
  function losuj(nazwa,o){
    const rng=(o&&o.rng)||Math.random,nm=nazwa==null?GOSC:nazwa,p=wlascicielDoZapisu(nm),l=zalozLos(p),E=stanZapisu().ekipa;
    const pula=pulaLosowania(nm),zPoziomow=wolneZPoziomow(p)>0;
    const kat=zPoziomow?KAT_KOLA.filter(k=>naKole(pula,k)):samSekret(pula);   // 10-18 (D-4): po komplecie zostają same sekrety
    if(!kat.length)return null;
    const k=(o&&o.kat&&kat.includes(o.kat))?o.kat:kat[Math.floor(rng()*kat.length)];
    const wg={zwykly:[],rzadki:[],epicki:[],legendarny:[],sekretny:[]};
    for(const id of pula[k])wg[rzadkosc(k,id)].push(id);
    if(pula.sekret[k])wg.sekretny.push(pula.sekret[k]);   // 10-17: sekretna karta w puli, poza zwykłą listą
    const dost=RZADKOSCI.filter(r=>wg[r].length);let kand=dost;
    const wym=o&&o.rzadkosc&&wg[o.rzadkosc]&&wg[o.rzadkosc].length?o.rzadkosc:null;   // DEV: wymuszona rzadkość
    if(wym)kand=[wym];
    else if(l.bezL>=GWARANCJA_LEGENDARNEJ&&wg.legendarny.length)kand=["legendarny"];
    else if(l.bezE>=GWARANCJA_EPICKIEJ&&(wg.epicki.length||wg.legendarny.length))kand=dost.filter(r=>r==="epicki"||r==="legendarny");
    let x=rng()*kand.reduce((a,r)=>a+WAGI_RZADKOSCI[r],0),r=kand[kand.length-1];
    for(const c of kand){x-=WAGI_RZADKOSCI[c];if(x<0){r=c;break;}}
    const id=wg[r][Math.floor(rng()*wg[r].length)];
    const sekret=r==="sekretny";
    l.bezE=r==="epicki"||r==="legendarny"||sekret?0:l.bezE+1;l.bezL=r==="legendarny"||sekret?0:l.bezL+1;
    const teraz=new Date().toISOString(),poz=poziomLos(pulaEfektow(p));
    const przyznaj=(kk,ii)=>{
      if(kk==="plansza")E.motywy[ii]=teraz;
      else if(kk==="instrument"&&jestSekret(kk,ii))l.wygrane.push({t:"studio",id:ii,r:"sekretny",p:poz});   // sekret instrumentów = Studio dźwięków
      else l.wygrane.push({t:kk,id:ii,r:rzadkosc(kk,ii),p:poz});
    };
    przyznaj(k,id);
    // sekret nie zużywa losowania (10-17); scena od 10-18 (SCENY_Z_KOLA) zużywa je jak instrument i skin
    const darmowa=sekret||(k==="plansza"&&!SCENY_Z_KOLA);
    if(!darmowa){if(l.bonus>0)l.bonus--;else l.uzyte++;}
    // Ostatnie losowanie nie odblokowuje dwóch rzeczy, każda jest losowana osobno: bez dubla;
    // pole `dubel` zostaje w wyniku (zawsze null), bo czyta je nakładka koła.
    const dubel=null;
    zapisz();
    return {kat:k,id,r,nazwa:nazwaRzeczy(k,id),stopien:k==="instrument"?null:nrStopnia(wpisDrabinki(k==="plansza"?TOR_PLANSZY:TOR_GRACZA,id),kolejnoscRzeczy(k,id)),
      pula:pula,kategorie:kat,dubel,bonus:darmowa,sekret,wolne:losowania(nm),gwarancja:{epicka:l.bezE>=GWARANCJA_EPICKIEJ,legendarna:l.bezL>=GWARANCJA_LEGENDARNEJ}};
  }
  // DEV (panel F2, „Nagrody i koło”): przygotowanie profilu do testu koła. Tryby: "wyzeruj" (nic nie wygrane, tła ekipy też),
  // "dodaj" (+n wolnych losowań, brakującą sławę dosypuje na tor streak), "dubel" (zostają dwie rzeczy i dwa losowania; nazwa z czasów dubla),
  // "studio" (zostaje tylko sekret instrumentów, czyli Studio dźwięków, i jedno losowanie). Zapisuje do localStorage, jak zwykła gra.
  function devKolo(nazwa,tryb,n){
    const nm=nazwa==null?GOSC:nazwa,p=wlascicielDoZapisu(nm),l=zalozLos(p),E=stanZapisu().ekipa;
    const wszI=INSTRUMENTY_KOLEJNOSC.filter(i=>i!=="ribbit"),wszE=drabinkaToru(TOR_GRACZA).filter((w,i)=>w&&i>0).map(w=>w.id);
    const wolnych=k=>{   // dosypuje sławy, żeby czekało co najmniej k losowań
      const d=droga(),cel=Math.min(d.length,l.uzyte+Math.max(0,k|0));
      const prog=cel>0?d[cel-1].prog:0,s=slawaRazem(p.slawa);
      if(s<prog){if(p.ekipa)E.slawa+=prog-s;else p.slawa[TOR_GRACZA]=(+p.slawa[TOR_GRACZA]||0)+(prog-s);}   // ekipa: pula wspólna (10-17)
    };
    const wszystkieSceny=()=>{const t=new Date().toISOString();drabinkaToru(TOR_PLANSZY).forEach((w,i)=>{if(w&&i>0&&!E.motywy[w.id])E.motywy[w.id]=t;});};   // także sekretna
    const wygr=(ins,efe)=>ins.map(id=>({t:"instrument",id,r:rzadkosc("instrument",id),p:1})).concat(efe.map(id=>({t:"efekt",id,r:rzadkosc("efekt",id),p:1})));
    if(tryb==="wyzeruj"){l.wygrane=[];l.uzyte=0;l.bezE=0;l.bezL=0;l.bonus=0;E.motywy={};if(p.ekipa)E.slawa=0;}
    else if(tryb==="dodaj"){wolnych(Math.max(0,poziomLos(pulaEfektow(p))-l.uzyte)+Math.max(1,n|0));}
    else if(tryb==="dubel"){   // 10-18 (E-08), 10-19 bez dubla: bez bonusu startowego i bez czekających sekretów zostają dwa losowania na dwie rzeczy
      l.wygrane=wygr(wszI.slice(0,-1),wszE.slice(0,-1)).concat([{t:"studio",id:SEKRETY.instrument,r:"sekretny",p:1}]);l.uzyte=Math.min(l.wygrane.length-1,droga().length-1);l.bonus=0;
      wszystkieSceny();wolnych(2);}
    else if(tryb==="studio"){   // 10-18 (E-08): wszystko zdobyte poza sekretem instrumentów, więc jedyne losowanie daje Studio dźwięków
      l.wygrane=wygr(wszI,wszE);l.bonus=0;l.uzyte=poziomLos(pulaEfektow(p));wszystkieSceny();}
    else if(tryb==="sekret"){l.wygrane=l.wygrane.filter(x=>x.t!=="studio"&&!(x.t==="efekt"&&jestSekret("efekt",x.id)));delete E.motywy[SEKRETY.plansza];wolnych(3);}   // sekrety znów do zdobycia
    zapisz();
    return {wolne:losowania(nm),pula:Object.fromEntries(Object.entries(pulaLosowania(nm)).map(([k,v])=>[k,v.length]))};
  }
  // Poziom gracza z puli: {poziom, maks, od (próg obecnego), do (próg następnego albo null), nastepna (nagroda albo null)}.
  function poziomGraczaZ(pula){
    const d=droga(),s=+pula||0;let n=0;while(n<d.length&&d[n].prog<=s)n++;
    return {poziom:1+n,maks:1+d.length,od:n?d[n-1].prog:0,do:n<d.length?d[n].prog:null,nastepna:n<d.length?d[n]:null};
  }
  function poziomGracza(nazwa){return poziomGraczaZ(pulaEfektow(wlasciciel(nazwa)));}
  // Najbliższy cel (10-15, wyniki: „następny: X · jeszcze ok. N piosenek”). Efekt profilu (10-16): następna nagroda drogi,
  // której profil jeszcze nie ma (efekt otwarty skrótem się pomija), z typem; plansza: pierwszy zamknięty motyw ekipy.
  // Z progiem i brakującą sławą; null = wszystko zdobyte (bez „wszystko”).
  function nastepnyCel(nazwa,tor){
    const plansza=tor==="plansza",t=plansza?TOR_PLANSZY:TOR_GRACZA,d=drabinkaToru(t),p=plansza?null:wlasciciel(nazwa),e=stanZapisu().ekipa;
    const odb=new Set(plansza?odblokowanePlanszyZ(e,false):odblokowaneZ(p,false,pulaEfektow(p))[t]),pula=plansza?e.slawa:pulaEfektow(p);
    if(!plansza){   // 10-16: następna nagroda to następne losowanie na kole (poziom), nie konkretna rzecz
      if(nicDoLosowania(nazwa))return null;   // 10-17: wszystko wylosowane = brak następnej nagrody, same poziomy
      const nast=droga().find(n=>n.prog>pula);
      return nast?{typ:"los",id:"los",nazwa:null,stopien:null,prog:nast.prog,brakuje:Math.max(0,nast.prog-pula)}:null;
    }
    if(SCENY_Z_KOLA)return null;   // 10-18: scena nie ma progu, przychodzi z koła (następna nagroda = następne losowanie)
    for(let i=1;i<d.length;i++){const w=d[i];if(w&&!odb.has(w.id)&&!jestSekret("plansza",w.id))return {typ:"plansza",id:w.id,nazwa:w.nazwa,stopien:nrStopnia(w,i),prog:progI(i),brakuje:Math.max(0,progI(i)-pula)};}
    return null;
  }
  // Najwyższy zdobyty stopień toru (numer; bez „wszystko”). „Auto” wybiera właśnie jego.
  function stopien(nazwa,tor){
    const ids=new Set(naPlanszy(tor)?odblokowanePlanszyZ(stanZapisu().ekipa,false):odblokowaneZ(wlasciciel(nazwa),false,pulaEfektow(wlasciciel(nazwa)))[tor]||[]);let n=0;
    drabinkaToru(tor).forEach((w,i)=>{if(w&&ids.has(w.id))n=Math.max(n,nrStopnia(w,i));});
    return n||1;
  }
  const ostatni=a=>a.length?a[a.length-1]:null;
  // Stopień w użyciu na każdym torze: streak = przypięty w profilu, jeśli nadal odblokowany, inaczej „auto” = najwyższy
  // zdobyty; tory planszy = motyw planszy (ekipa). Bez ?odblokuj=1: parametr pozwala przypiąć każdy stopień, ale nie
  // zmienia sceny profilom, które nic nie wybrały. Parametry adresu ?widownia= ?streak= ?tlo= ?klawisze= ?stopien=
  // rozwiązuje gra (stopienGracza), nie ten plik.
  function wybor(nazwa){
    const p=profil(nazwa),zw=p.wybor||{},w=wszystkoOtwarte(),wl=wlasciciel(nazwa),pula=pulaEfektow(wl);
    const odb=odblokowaneZ(wl,w,pula),zdob=w?odblokowaneZ(wl,false,pula):odb,motyw=ekipa().motyw,out={};
    for(const t of TORY){
      if(naPlanszy(t)){out[t]=motyw;continue;}
      const pin=zw[t];
      out[t]=pin&&pin!=="auto"&&odb[t].includes(pin)?pin:ostatni(zdob[t]);
    }
    return out;
  }
  // Wybór gracza: {streak: id | "auto"}. Zapisuje się tylko odblokowany stopień (przy ?odblokuj=1 każdy, ale bez
  // odblokowania osiągnięć) albo „auto”. Tory planszy pod tym kluczem idą do wybierzMotyw (jeden wybór dla wszystkich).
  function wybierz(nazwa,o){
    const odb=odblokowane(nazwa),p=profilDoZapisu(nazwa);let zm=false;
    for(const t of TORY){
      const v=o&&o[t];if(!v)continue;
      if(naPlanszy(t)){wybierzMotyw(v);continue;}
      if(v==="auto"||odb[t].includes(v)){if(p.wybor[t]!==v){p.wybor[t]=v;zm=true;}}
    }
    if(zm)zapisz();
    return wybor(nazwa);
  }
  // ---- plansza (ekipa) ----
  // Stan planszy: pula ekipy, odblokowane motywy, wybór ("auto" | id), motyw w użyciu, poziom (jak poziomZ), motywy ze
  // skrótów i data `wszystko`. Przy „wszystko” wybór „auto” nadal bierze najwyższy ZDOBYTY motyw (jak w profilu).
  function ekipa(){
    const e=stanZapisu().ekipa,w=wszystkoOtwarte(),odb=odblokowanePlanszyZ(e,w),zdob=w?odblokowanePlanszyZ(e,false):odb;
    const pin=e.wybor||"auto",jestAuto=pin==="auto";
    return {slawa:e.slawa,odblokowane:odb,wybor:pin,jestAuto,motyw:!jestAuto&&odb.includes(pin)?pin:ostatni(zdob),
      poziom:poziomZ(e.slawa,TOR_PLANSZY),motywy:Object.assign({},e.motywy),wszystko:e.wszystko,tor:TOR_PLANSZY,gry:e.gry|0,wspolne:WSPOLNE};
  }
  function wybierzMotyw(v){
    const e=stanZapisu().ekipa;
    if(v==="auto"||odblokowanePlanszyZ(e,wszystkoOtwarte()).includes(v)){if(e.wybor!==v){e.wybor=v;zapisz();}}
    return ekipa();
  }
  // js/menu-dodatki.js: wszystkie motywy planszy i efekty do wyboru na tym komputerze (zapis), bez osiągnięć.
  // odblokujWszystko(false) cofa. Zwraca, ile motywów planszy i efektów aktywnego profilu doszło (do popupu).
  function odblokujWszystko(tak,nazwa){
    const e=stanZapisu().ekipa,bylo=!!e.wszystko,p=wlasciciel(nazwa);
    const przedP=odblokowanePlanszyZ(e,false).length,przedE=odblokowaneZ(p,false,pulaEfektow(p))[TOR_GRACZA].length,n=drabinkaToru(TOR_PLANSZY).length;
    const przedI=instrumentyZ(pulaEfektow(p),false).length;   // 10-16: kod otwiera też wszystkie instrumenty
    e.wszystko=tak===false?null:new Date().toISOString();
    zapisz();
    const nowe=!!e.wszystko&&!bylo;   // drugi raz nic nowego (10-15: przy wyższych progach nie wszystko jest zdobyte)
    return {wszystko:!!e.wszystko,bylo,noweMotywy:nowe?n-przedP:0,noweEfekty:nowe?drabinkaToru(TOR_GRACZA).length-przedE:0,noweInstrumenty:nowe?INSTRUMENTY_KOLEJNOSC.length-przedI:0,motywow:n};
  }
  // Pula ekipy od zera (okno „Profile” / dev): sława ekipy, motywy ze skrótów i wybór; `wszystko` zostaje.
  function wyzerujEkipe(){const e=stanZapisu().ekipa;e.slawa=0;e.motywy={};e.wybor="auto";zapisz();return ekipa();}
  // Prestiż po ostatnim motywie (gwiazdki co PRESTIZ_CO sławy z puli; tor bez znaczenia, zostaje dla zgodności).
  function prestiz(nazwa,tor){return prestizZ(pulaEfektow(wlasciciel(nazwa)));}
  // Postęp osiągnięcia 0..1: zdobyte = 1, liczbowe = wartość/cel, pozostałe 0.
  function postepOsiagniecia(nazwa,id){
    const o=MAPA.get(id);if(!o)return 0;
    const p=profil(nazwa);if(p.osiagniecia[id])return 1;
    if(!o.prog)return 0;
    let v=0;try{v=+o.prog.wartosc(p.liczniki)||0;}catch(e){}
    return Math.max(0,Math.min(1,v/o.prog.cel));
  }
  // Liczby postępu do okna osiągnięć (10-15): {wartosc, cel} z liczników profilu (wartość obcięta do celu) albo null,
  // gdy osiągnięcie nie ma licznika. Data zdobycia jest w `profil(nazwa).osiagniecia[id]` (ISO).
  function licznikOsiagniecia(nazwa,id){
    const o=MAPA.get(id);if(!o||!o.prog)return null;
    let v=0;try{v=+o.prog.wartosc(profil(nazwa).liczniki)||0;}catch(e){}
    return {wartosc:Math.max(0,Math.min(o.prog.cel,Math.floor(v))),cel:o.prog.cel};
  }
  // Osiągnięcie, które jest skrótem do danego stopnia (kłódka i opis warunku w oknie „Scena”).
  function zrodloStylu(tor,id){if(!OSIAGNIECIA_AKTYWNE)return null;return OSIAGNIECIA.find(o=>o.nagroda[tor]===id)||OSIAGNIECIA.find(o=>Object.values(o.nagroda||{}).includes(id))||null;}
  // Skrót osiągnięcia: tor, id, numer i nazwa stopnia (z drabinki, a bez modułu toru z `cel`) oraz sława za zdobycie.
  function skrot(o){
    const tor=torNagrody(o);if(!tor)return null;
    const id=o.nagroda[tor],d=drabinkaToru(tor),i=d.findIndex(w=>w&&w.id===id),c=o.cel||{};
    return {tor,typ:tor,id,stopien:i>=0?nrStopnia(d[i],i):(c.stopien||null),nazwa:i>=0?d[i].nazwa:(c.nazwa||id),
      jest:i>=0,slawa:SLAWA_ZA_OSIAGNIECIE[o.poziom]||0,plansza:naPlanszy(tor)};   // plansza: skrót otwiera motyw planszy wszystkim
  }

  // ---- koniec gry ----
  // Awanse: nowy stopień z puli w tej grze (jeden wpis: najwyższy nowy i skąd). `tor` = "efekt" (pula gracza, drabinka
  // streaka) albo "plansza" (pula ekipy). Skrót z osiągnięcia to nie awans (mówi o nim żeton osiągnięcia), a stopień,
  // którego drabinka nie ma, też nie.
  function awanseZ(przed,po,tor){
    const t=tor==="plansza"?TOR_PLANSZY:TOR_GRACZA,a=poziomZ(przed,t),b=poziomZ(po,t);
    return b.stopien>a.stopien&&b.wpis?[{tor:tor||"efekt",stopien:b.stopien,id:b.wpis.id,nazwa:b.wpis.nazwa,od:a.stopien,nowe:b.stopien-a.stopien}]:[];
  }
  // sklad: [{id, nazwa, nazwaWlasna, zrodlo, instrument, poziom}], wynikiGraczy: wiersze zakonczGre ({id, punkty, oceny, …}),
  // konfiguracja: {piosenka, dlugoscSek, tryb, czasNaRuch, liczbaGraczy, pakiet, pakietId, data?, godzina?}.
  // Zwraca [{id, profil, nowe:[osiągnięcie+skrót], slawa:{przed, po, zyski, zaGre, mnoznik, mnozniki, awanse}, ekipa}] dla
  // każdego człowieka. Dwóch graczy z tym samym profilem (dwóch „Gości”) to jedna gra profilu: liczniki jak dotąd, sława na
  // każdym torze z lepszego wiersza; nowe osiągnięcia i sława idą przy pierwszym z nich (drugi: nowe [], slawa null).
  // `slawa.awanse` = nowe efekty gracza (tor "efekt"). `ekipa` (tylko w pierwszym wierszu z sławą, w innych null) =
  // {przed, po, zysk, awanse:[tor "plansza"], noweMotywy:[id ze skrótów tej gry]}: pula ekipy rośnie o zyski każdego profilu.
  function poGrze(sklad,wynikiGraczy,konfiguracja){
    if(oszust())return [];   // 10-19: tryb oszusta nic nie przyznaje (sława, poziomy, osiągnięcia, liczniki)
    const k=konfiguracja||{},kiedy=new Date(k.data!=null?k.data:Date.now()),dzien=dzienLokalny(kiedy),teraz=kiedy.toISOString();
    const E=stanZapisu().ekipa,ekipaPrzed=E.slawa,noweMotywy=[];
    const wiersze=(wynikiGraczy||[]).map(r=>({r,gracz:(sklad||[]).find(g=>g.id===r.id)||null}));
    const kg=Object.assign({},k,{godzina:k.godzina!=null&&k.godzina!==""?+k.godzina:kiedy.getHours()});
    const grupy=new Map();
    for(const x of wiersze){
      const nazwa=nazwaProfilu(x.gracz);if(!nazwa)continue;
      const kp=kluczProfilu(nazwa);
      if(!grupy.has(kp))grupy.set(kp,{nazwa,wiersze:[]});
      grupy.get(kp).wiersze.push(x);
    }
    const out=[],ludzie=wiersze.filter(x=>nazwaProfilu(x.gracz)).length,wkladyEkipy=[],slawyGraczy=[];
    const gryPrzed=E.gry|0;if(WSPOLNE&&grupy.size)profilEkipy();   // 10-17: koło ekipy powstaje PRZED naliczeniem sławy z tej gry
    for(const [,gr] of grupy){
      const p=profilDoZapisu(gr.nazwa);p.nazwa=nazwaNorm(gr.nazwa);p.ostatnio=Date.now();
      const bylLos=!!p.los;if(!WSPOLNE)zalozLos(p);   // 10-16: stary profil przechodzi na koło PRZED naliczeniem sławy z tej gry
      // kapsel z wybraną nazwą (profilem) pamięta go na następne dołączenie
      for(const x of gr.wiersze){const g=x.gracz;if(g&&g.zrodlo==="kapsel"&&g.nazwaWlasna&&g.id!=null)stanZapisu().kapsle[String(g.id).slice(0,80)]=kluczProfilu(gr.nazwa);}
      const wyniki=gr.wiersze.map(x=>wynikGracza(x.gracz,x.r,kg,wiersze)),l0=p.liczniki;
      // sława: liczniki sprzed gry (nowy utwór, nowy instrument), pierwsza gra dnia z sławą, seria z dzisiejszym dniem
      const pelna=wyniki.some(w=>w.nut>=MIN_NUT);
      const kontekst={pierwszaDnia:pelna&&l0.dzienSlawy!==dzien,seria:seriaDni(l0.dni,dzien).seria};
      const zaGreW=wyniki.map(w=>slawaZaGre(w,l0,kontekst)),zaGre={};
      for(const t of TORY)zaGre[t]=Math.max(0,...zaGreW.map(z=>z[t]));
      let l=l0;
      wyniki.forEach((w,i)=>{l=dodajGre(l,w,dzien);if(i>0){l.gry--;if(nocna(w))l.nocne--;}});   // jedna gra profilu, reszta liczników sumuje się
      if(pelna)l.dzienSlawy=dzien;
      p.liczniki=l;
      const nowe=[];
      for(const w of wyniki)for(const o of sprawdz(l,w,p.osiagniecia)){if(!p.osiagniecia[o.id]){p.osiagniecia[o.id]=teraz;nowe.push(o);}}
      const przed=Object.assign({},p.slawa),zyski=Object.assign({},zaGre);
      for(const o of nowe){const t=torNagrody(o);if(t){zyski[t]+=SLAWA_ZA_OSIAGNIECIE[o.poziom]||0;
        if(naPlanszy(t)&&!E.motywy[o.nagroda[t]]){E.motywy[o.nagroda[t]]=teraz;noweMotywy.push(o.nagroda[t]);}   // skrót planszy: motyw dla wszystkich
        else if(WSPOLNE&&!naPlanszy(t)){const id=o.nagroda[t],L=E.los;   // 10-17: skrót skina też dla całej ekipy
          if(L&&!L.wygrane.some(x=>x.t==="efekt"&&x.id===id))L.wygrane.push({t:"efekt",id,r:rzadkosc("efekt",id),p:0});}}}
      for(const t of TORY)p.slawa[t]=(+przed[t]||0)+zyski[t];
      // wkład do puli ekipy: sława za grę razy mnożnik długości piosenki (część podstawy) plus sława za osiągnięcia
      if(WSPOLNE)wkladyEkipy.push(slawaRazem(zaGre)*mnoznikDlugosci(k.dlugoscSek)+(slawaRazem(zyski)-slawaRazem(zaGre)));
      else E.slawa+=slawaRazem(zyski);   // stary podział: pula ekipy rośnie o zyski każdego profilu
      const slawa={przed,po:Object.assign({},p.slawa),zyski,zaGre,mnoznik:zaGreW.length?zaGreW[0].mnoznik:1,
        mnozniki:zaGreW.length?zaGreW[0].mnozniki:[],awanse:[],noweInstrumenty:[],   // 10-16: nagrody dają losowania na kole, nie konkretne rzeczy
        losowania:null};
      if(!WSPOLNE){const pula=EFEKTY_Z_PULI_EKIPY?[ekipaPrzed,E.slawa]:[slawaRazem(przed),slawaRazem(p.slawa)];
        slawa.losowania=nicDoLosowania(p.nazwa)?{nowe:0,wolne:0}:{nowe:Math.max(0,poziomLos(pula[1])-poziomLos(pula[0]))+((!bylLos&&p.los.bonus)?1:0),wolne:Math.max(0,poziomLos(pula[1])-p.los.uzyte)+(p.los.bonus|0)};}
      slawyGraczy.push(slawa);
      gr.wiersze.forEach((x,i)=>out.push({id:x.r.id,profil:p.nazwa,nowe:i===0?nowe.map(opisNowego):[],slawa:i===0?slawa:null,ekipa:null}));
    }
    if(grupy.size){
      // 10-17 (WSPOLNE): do puli idzie średnia z wkładów profili tej piosenki razy mnożnik za liczbę ludzi (MNOZNIK_GRACZY)
      let mnG=1,wklad=0;
      if(WSPOLNE){mnG=mnoznikGraczy(ludzie);wklad=wkladyEkipy.reduce((a,b)=>a+b,0)/Math.max(1,wkladyEkipy.length);
        E.slawa+=Math.round(wklad*mnG);E.gry=(E.gry|0)+1;
        const L=E.los,los=nicDoLosowania(GOSC)?{nowe:0,wolne:0}:{nowe:Math.max(0,poziomLos(E.slawa)-poziomLos(ekipaPrzed))+((!gryPrzed&&L.bonus>0)?1:0),wolne:losowania(GOSC)};   // 10-18 (E-06): bonus startowy liczy się w 1. grze, choć koło powstało już w menu
        for(const sl of slawyGraczy)sl.losowania=los;}
      const pierwszy=out.find(x=>x.slawa);
      if(pierwszy)pierwszy.ekipa={przed:ekipaPrzed,po:E.slawa,zysk:E.slawa-ekipaPrzed,awanse:SCENY_Z_KOLA?[]:awanseZ(ekipaPrzed,E.slawa,"plansza"),noweMotywy,   // 10-18: scen z progów już nie ma
        wspolne:WSPOLNE,ludzie,mnoznikGraczy:mnG,wklad:Math.round(wklad),losowania:WSPOLNE?slawyGraczy[0].losowania:null};
      zapisz();
    }
    return out;
  }
  function opisNowego(o){
    return {id:o.id,nazwa:o.nazwa,opis:o.opis,kategoria:o.kategoria,poziom:o.poziom,nagroda:skrot(o)};
  }

  // ---- zarządzanie profilami (10-10, okno „Profile”) ----
  // Każda operacja zwraca {ok:true, …} albo {ok:false, powod}: "pusta" (brak nazwy), "zajeta" (nazwa ma już inny
  // profil, także „Gość”), "gosc" (Gościa nie da się przemianować ani usunąć), "brak" (nie ma takiego profilu),
  // "kolor" (zły kolor), "awatar" (złe id awatara), "limit" (nowy profil nie zmieścił się w limicie).
  const KLUCZ_GOSCIA=GOSC.toLocaleLowerCase("pl");
  // Czy profil ma jakikolwiek postęp (gry, sława, osiągnięcia): taki nie znika bez pytania.
  function maPostep(p){return !!p&&(((p.liczniki&&p.liczniki.gry)|0)>0||slawaRazem(p.slawa)>0||ile(p.osiagniecia)>0);}
  // Klucze, które limit może usunąć (czysta funkcja stanu): ponad `limit` profili odchodzą najdawniej użyte spośród
  // pustych, nieprzypiętych, bez kapsla i nie Gościa. Gdy takich brak, zapis zostaje większy niż limit.
  function doUsunieciaPrzyLimicie(s,limit){
    const k=Object.keys(s.profile||{});if(k.length<=limit)return [];
    const kapsli=new Set(Object.values(s.kapsle||{}));
    const wiek=x=>Math.max(+s.profile[x].ostatnio||0,+s.profile[x].utworzony||0);
    const wolne=k.filter(x=>x!==KLUCZ_GOSCIA&&!s.profile[x].przypiety&&!kapsli.has(x)&&!maPostep(s.profile[x])).sort((a,b)=>wiek(a)-wiek(b));
    return wolne.slice(0,k.length-limit);
  }
  const nazwaWpisana=n=>String(n==null?"":n).trim().slice(0,18);
  // Lista do okna: przypięte na górze, potem ostatnio grane, potem alfabetycznie. Gość jest zawsze (bez zapisu: pusty).
  function lista(){
    const s=stanZapisu(),klucze=Object.keys(s.profile),efektowZ=drabinkaToru(TOR_GRACZA).length||MAKS_STOPIEN;
    if(!klucze.includes(KLUCZ_GOSCIA))klucze.push(KLUCZ_GOSCIA);
    const out=klucze.map(k=>{
      const p=s.profile[k]||nowyProfil(GOSC),wl=WSPOLNE?profilEkipy():p,efekty=odblokowaneZ(wl,false,pulaEfektow(wl))[TOR_GRACZA].length;   // efekty własne (bez „wszystko”)
      return {nazwa:p.nazwa,klucz:k,gosc:k===KLUCZ_GOSCIA,zapisany:!!s.profile[k],slawa:slawaRazem(p.slawa),
        efekty,efektyZ:efektowZ,motywy:efekty,motywyZ:efektowZ,osiagniecia:OSIAGNIECIA.filter(o=>p.osiagniecia[o.id]).length,
        osiagnieciaZ:OSIAGNIECIA.length,gry:(p.liczniki&&p.liczniki.gry)|0,ostatnio:+p.ostatnio||0,przypiety:!!p.przypiety,
        kolor:p.kolor||null,awatar:p.awatar||null,postep:maPostep(p),kapsle:Object.keys(s.kapsle).filter(id=>s.kapsle[id]===k)};
    });
    return out.sort((a,b)=>(b.przypiety-a.przypiety)||(b.ostatnio-a.ostatnio)||a.nazwa.localeCompare(b.nazwa,"pl"));
  }
  function utworz(nazwa){
    const t=nazwaWpisana(nazwa);if(!t)return {ok:false,powod:"pusta"};
    const s=stanZapisu(),k=kluczProfilu(t);
    if(k===KLUCZ_GOSCIA||s.profile[k])return {ok:false,powod:"zajeta",nazwa:s.profile[k]?s.profile[k].nazwa:GOSC};
    const p=nowyProfil(t);p.utworzony=Date.now();s.profile[k]=p;zapisz();
    return s.profile[k]?{ok:true,nazwa:p.nazwa,klucz:k}:{ok:false,powod:"limit"};
  }
  // Zmiana nazwy przenosi profil pod nowy klucz (z kapslami); sama zmiana wielkości liter zostaje pod tym samym kluczem.
  function zmienNazwe(stara,nowa){
    const s=stanZapisu(),kS=kluczProfilu(stara);
    if(kS===KLUCZ_GOSCIA)return {ok:false,powod:"gosc"};
    const p=s.profile[kS];if(!p)return {ok:false,powod:"brak"};
    const t=nazwaWpisana(nowa);if(!t)return {ok:false,powod:"pusta"};
    const kN=kluczProfilu(t);
    if(kN!==kS&&(kN===KLUCZ_GOSCIA||s.profile[kN]))return {ok:false,powod:"zajeta"};
    const byla=p.nazwa;
    if(kN!==kS){delete s.profile[kS];s.profile[kN]=p;for(const id of Object.keys(s.kapsle))if(s.kapsle[id]===kS)s.kapsle[id]=kN;}
    p.nazwa=t;zapisz();
    return {ok:true,nazwa:t,klucz:kN,stara:byla,staryKlucz:kS};
  }
  function usun(nazwa){
    const s=stanZapisu(),k=kluczProfilu(nazwa);
    if(k===KLUCZ_GOSCIA)return {ok:false,powod:"gosc"};
    const p=s.profile[k];if(!p)return {ok:false,powod:"brak"};
    delete s.profile[k];for(const id of Object.keys(s.kapsle))if(s.kapsle[id]===k)delete s.kapsle[id];
    zapisz();return {ok:true,nazwa:p.nazwa,klucz:k};
  }
  // Postęp na zero (liczniki, osiągnięcia, sława, wybór motywów); nazwa, kolor, przypięcie i kapsle zostają.
  function wyzeruj(nazwa){
    const s=stanZapisu(),k=kluczProfilu(nazwa),p=s.profile[k];
    if(!p)return k===KLUCZ_GOSCIA?{ok:true,nazwa:GOSC,klucz:k}:{ok:false,powod:"brak"};
    const z=nowyProfil(p.nazwa);
    Object.assign(p,{liczniki:z.liczniki,osiagniecia:{},slawa:z.slawa,wybor:z.wybor});
    zapisz();return {ok:true,nazwa:p.nazwa,klucz:k};
  }
  // Cały postęp na zero (kasowanie w ustawieniach za długim przytrzymaniem czerwonego przycisku):
  // pula, motywy i koło ekipy (nowaEkipa, także kod „wszystko otwarte”), a w każdym profilu liczniki, osiągnięcia, sława,
  // wybory, zachowane efekty i koło. Zostają profile (nazwa, kolor, przypięcie, ustawienia) i przypisania kapsli.
  function wyzerujWszystko(){
    const s=stanZapisu();
    for(const k of Object.keys(s.profile)){const p=s.profile[k],z=nowyProfil(p.nazwa);
      Object.assign(p,{liczniki:z.liczniki,osiagniecia:{},slawa:z.slawa,wybor:z.wybor});delete p.zachowane;delete p.los;}
    s.ekipa=nowaEkipa();zapisz();return {ok:true,profile:Object.keys(s.profile).length};
  }
  // Profil do zmiany ustawień: istniejący albo Gość (jego wolno przypiąć i pokolorować, zanim zagra).
  function profilUstawien(nazwa){
    const s=stanZapisu(),k=kluczProfilu(nazwa);
    if(!s.profile[k]&&k===KLUCZ_GOSCIA)s.profile[k]=nowyProfil(GOSC);
    return s.profile[k]||null;
  }
  function przypnij(nazwa,tak){
    const p=profilUstawien(nazwa);if(!p)return {ok:false,powod:"brak"};
    p.przypiety=tak!==false;zapisz();return {ok:true,nazwa:p.nazwa,przypiety:p.przypiety};
  }
  // ustawienia(nazwa) = kopia ustawień profilu ({} bez ustawień albo bez profilu). zapiszUstawienia(nazwa, obj) scala
  // płytko (klucz z null zostaje jako null), profil musi istnieć (Gość zawsze); zwraca {ok, ust, pominiete:[klucze]}
  // albo {ok:false, powod:"brak" | "ust"}. Ustawień nie rusza wyzeruj, przenosi zmienNazwe, niosą je eksport i import.
  function ustawienia(nazwa){const p=stanZapisu().profile[kluczProfilu(nazwa)];return Object.assign({},p&&p.ust||{});}
  function zapiszUstawienia(nazwa,obj){
    const pominiete=[],u=ustZ(obj,pominiete);if(!u)return {ok:false,powod:"ust"};
    const p=profilUstawien(nazwa);if(!p)return {ok:false,powod:"brak"};
    const razem=ustZ(Object.assign({},p.ust||{},u),pominiete);   // limit 100 kluczy liczy się po scaleniu
    p.ust=razem;zapisz();return {ok:true,ust:Object.assign({},razem),pominiete};
  }
  // kolor(nazwa) = ulubiony kolor albo null; kolor(nazwa, "#rrggbb" | null) ustawia (null = bez koloru).
  function kolor(nazwa,k){
    if(arguments.length<2){const p=stanZapisu().profile[kluczProfilu(nazwa)];return p&&p.kolor||null;}
    const v=k==null||k===""?null:kolorOk(k);if(k!=null&&k!==""&&!v)return {ok:false,powod:"kolor"};
    const p=profilUstawien(nazwa);if(!p)return {ok:false,powod:"brak"};
    p.kolor=v;zapisz();return {ok:true,nazwa:p.nazwa,kolor:v};
  }
  // awatar(nazwa) = id awatara konta albo null (wtedy okno bierze domyślny dla klucza); awatar(nazwa, "id" | null) ustawia.
  function awatar(nazwa,a){
    if(arguments.length<2){const p=stanZapisu().profile[kluczProfilu(nazwa)];return p&&p.awatar||null;}
    const v=a==null||a===""?null:awatarOk(a);if(a!=null&&a!==""&&!v)return {ok:false,powod:"awatar"};
    const p=profilUstawien(nazwa);if(!p)return {ok:false,powod:"brak"};
    if(v)p.awatar=v;else delete p.awatar;
    zapisz();return {ok:true,nazwa:p.nazwa,awatar:v};
  }
  // Kapsel → profil. kapsel(id) = nazwa profilu, który kapsel pamięta (albo null); przypiszKapsel(id, nazwa) zapamiętuje
  // (profilu jeszcze nie ma: powstaje pusty), przypiszKapsel(id, null) albo Gość = zapomnij.
  function kapsel(id){
    if(id==null)return null;
    const s=stanZapisu(),k=s.kapsle[String(id)];
    return k&&s.profile[k]?s.profile[k].nazwa:null;
  }
  function przypiszKapsel(id,nazwa){
    if(id==null)return null;
    const s=stanZapisu(),kid=String(id).slice(0,80),t=nazwaWpisana(nazwa);
    if(!t||kluczProfilu(t)===KLUCZ_GOSCIA){if(s.kapsle[kid]){delete s.kapsle[kid];zapisz();}return null;}
    const k=kluczProfilu(t);
    if(!s.profile[k]){s.profile[k]=nowyProfil(t);s.profile[k].utworzony=Date.now();}
    if(s.kapsle[kid]!==k){s.kapsle[kid]=k;zapisz();}
    return s.profile[k].nazwa;
  }
  // Skład zapisany w localStorage (zabi-chor.js, zapiszSklad: {wersja:1, gracze:[{nazwa?…}]}) po zmianie nazwy profilu:
  // wpisy z nazwą starego profilu dostają nową, a przy `nowa` = null (profil usunięty) tracą nazwę. Czysta funkcja.
  function skladPoZmianie(zapis,stara,nowa){
    if(!zapis||typeof zapis!=="object"||!Array.isArray(zapis.gracze))return zapis;
    const kS=kluczProfilu(stara);
    return Object.assign({},zapis,{gracze:zapis.gracze.map(x=>{
      if(!x||typeof x.nazwa!=="string"||kluczProfilu(x.nazwa)!==kS)return x;
      const y=Object.assign({},x);if(nowa==null)delete y.nazwa;else y.nazwa=nazwaWpisana(nowa)||y.nazwa;return y;})});
  }

  // ---- eksport i import ----
  function eksport(){
    const s=stanZapisu();
    return JSON.stringify({format:FORMAT_PLIKU,wersja:WERSJA,eksport:new Date().toISOString(),profile:s.profile,kapsle:s.kapsle,ekipa:s.ekipa},null,1);
  }
  const DZIEN=/^\d{4}-\d{2}-\d{2}$/;
  // Liczniki z obcego pliku: tylko znane pola, liczby nieujemne, mapy jako {klucz:1} (klucze do 80 znaków).
  function oczyscLiczniki(l){
    const w=nowyLiczniki(),z=l&&typeof l==="object"?l:{};
    for(const k of Object.keys(w)){
      const v=z[k];
      if(typeof w[k]==="number")w[k]=nieujemna(v);
      else if(k==="dni"){const d=v&&typeof v==="object"?v:{};w.dni={ost:DZIEN.test(d.ost)?d.ost:"",seria:nieujemna(d.seria),naj:nieujemna(d.naj)};}
      else if(k==="dzienSlawy")w[k]=DZIEN.test(v)?v:"";
      else if(v&&typeof v==="object"&&!Array.isArray(v)){const o={};for(const x of Object.keys(v).slice(0,2000))o[String(x).slice(0,80)]=1;w[k]=o;}
    }
    return w;
  }
  function profilZPliku(k,p,wersja){
    const n=profilZZapisu(k,p);
    n.nazwa=nazwaNorm(n.nazwa);n.liczniki=oczyscLiczniki(p.liczniki);
    const os={};for(const id of Object.keys(n.osiagniecia))if(MAPA.has(id))os[id]=String(n.osiagniecia[id]).slice(0,40);
    n.osiagniecia=os;
    if(wersja===1)n.slawa=slawaZWersji1(n.liczniki,n.osiagniecia);
    return n;
  }
  // Który z dwóch profili o tej samej nazwie zostaje przy scalaniu: większa pula sławy, potem więcej gier, potem świeższy.
  const lepszy=(a,b)=>(slawaRazem(a.slawa)-slawaRazem(b.slawa))||((a.liczniki.gry|0)-(b.liczniki.gry|0))||((+a.ostatnio||0)-(+b.ostatnio||0));
  // dane: tekst JSON albo obiekt (plik z eksportu albo surowy zapis wersji 1 i 2). tryb "scal": profile z pliku
  // dochodzą, przy tej samej nazwie zostaje lepszy (przypięcie i kolor się sumują); "zastap": obecne profile i kapsle
  // znikają. Raport: {ok, tryb, dodane:[nazwy], zastapione, pominiete, odrzucone (zepsute i powtórzone wpisy), razem,
  // blad: null | "rozmiar" | "json" | "format" | "pusty"}. Przy błędzie zapis zostaje bez zmian.
  function importuj(dane,tryb){
    tryb=tryb==="zastap"?"zastap":"scal";
    const r={ok:false,tryb,dodane:[],zastapione:[],pominiete:[],odrzucone:0,razem:0,blad:null};
    let z=dane;
    if(typeof z==="string"){
      if(z.length>MAKS_IMPORT){r.blad="rozmiar";return r;}
      try{z=JSON.parse(z.trim());}catch(e){r.blad="json";return r;}   // trim zdejmuje też BOM (plik z Notatnika)
    }
    if(!z||typeof z!=="object"||Array.isArray(z)||!z.profile||typeof z.profile!=="object"||Array.isArray(z.profile)||
       !WERSJE.includes(z.wersja)||(z.format!=null&&z.format!==FORMAT_PLIKU)){r.blad="format";return r;}
    const wej=new Map();
    for(const [k,p] of Object.entries(z.profile)){
      if(!p||typeof p!=="object"||Array.isArray(p)){r.odrzucone++;continue;}
      const n=profilZPliku(k,p,z.wersja),kl=kluczProfilu(n.nazwa);
      if(wej.has(kl)){r.odrzucone++;continue;}
      wej.set(kl,{n,k});
    }
    if(!wej.size){r.blad="pusty";return r;}
    const s=stanZapisu();
    if(tryb==="zastap"){s.profile={};s.kapsle={};}
    // ekipa: z pliku wersji 3 (oczyszczona) albo odtworzona z profili pliku; „zastąp” bierze ją całą, „scal” łączy motywy
    // ze skrótów, a sławę ekipy podnosi do sumy scalonych profili (dwa importy tego samego pliku nic nie dublują);
    // wybór i „wszystko” zostają lokalne
    const profilePliku=Object.fromEntries([...wej.values()].map(({n,k})=>[k,n]));
    const ePliku=ekipaZ(z.wersja>=3?z.ekipa:null,profilePliku);
    // 10-18 (E-03): plik starszej wersji przechodzi tę samą migrację co zapis z localStorage (migruj): stare progi
    // (wersja ≤ 3), potem wersja 5 (pula na nowej krzywej, wygrane profili na wspólnym kole ekipy)
    if(z.wersja<4)zachowajStareProgi(profilePliku,ePliku);
    if(z.wersja<5)naWersje5({profile:profilePliku,ekipa:ePliku});
    if(z.wersja<6)naWersje6({profile:profilePliku,ekipa:ePliku});   // 10-18: sceny z progów zostają (jak w migruj)
    else if(z.wersja<WERSJA)naKrzywa({profile:profilePliku,ekipa:ePliku},z.wersja);   // 10-19: krzywa losowań, wolne zostają
    if(tryb==="zastap")s.ekipa=ePliku;
    else for(const [id,d] of Object.entries(ePliku.motywy))if(!s.ekipa.motywy[id])s.ekipa.motywy[id]=d;
    const zPliku={};   // klucz w pliku → klucz po imporcie (kapsle z pliku wskazują klucze pliku)
    for(const [kl,{n,k}] of wej){
      zPliku[k]=kl;
      const stary=s.profile[kl];
      if(!stary){s.profile[kl]=n;r.dodane.push(n.nazwa);continue;}
      const [zostaje,drugi]=lepszy(n,stary)>0?[n,stary]:[stary,n];
      zostaje.przypiety=zostaje.przypiety||drugi.przypiety;zostaje.kolor=zostaje.kolor||drugi.kolor;
      if(!zostaje.awatar&&drugi.awatar)zostaje.awatar=drugi.awatar;   // awatar sumuje się jak kolor
      if(!zostaje.ust&&drugi.ust)zostaje.ust=drugi.ust;
      zostaje.utworzony=Math.min(...[zostaje.utworzony,drugi.utworzony].filter(x=>x>0),Date.now());
      s.profile[kl]=zostaje;(zostaje===n?r.zastapione:r.pominiete).push(zostaje.nazwa);
    }
    const kz=z.kapsle&&typeof z.kapsle==="object"&&!Array.isArray(z.kapsle)?z.kapsle:{};
    for(const [id,k] of Object.entries(kz)){
      const kl=typeof k==="string"?zPliku[k]:null,kid=String(id).slice(0,80);
      if(kl&&s.profile[kl]&&(tryb==="zastap"||!s.kapsle[kid]))s.kapsle[kid]=kl;
    }
    if(tryb!=="zastap")s.ekipa.slawa=Math.max(s.ekipa.slawa,Object.values(s.profile).reduce((a,p)=>a+slawaRazem(p.slawa),0));
    zapisz();
    r.ok=true;r.razem=Object.keys(s.profile).length;
    return r;
  }

  // Parametry deweloperskie z adresu: gra przekazuje tu rozwiązane id stopni (?widownia= ?streak= ?tlo= ?klawisze=,
  // tylko do wglądu: wymusza je sama w stopienGracza) i ?odblokuj=1, który odblokowuje wszystko w tej sesji
  // (nic nie zapisuje: wybór zablokowanego stopnia wraca do „auto” po przeładowaniu bez parametru).
  function ustawDev(o){o=o||{};for(const t of TORY)dev[t]=o[t]||null;dev.odblokuj=!!o.odblokuj;}
  // Tylko do testów i harnessu: zapomnij stan w pamięci (następny odczyt idzie z localStorage).
  function przeladuj(){pamiec=null;tylkoOdczyt=false;kopiaSprawdzona=false;}

  return {ustawProgSekretow,ZAMIANY_INSTRUMENTOW,WSPOLNE,profilEkipy,MNOZNIK_GRACZY,mnoznikGraczy,mnoznikDlugosci,PROGI_V4,przeliczKrzywa,PROGI,progIStary,nastepnyCel,INSTRUMENTY_KOLEJNOSC,PROGI_INSTRUMENTOW,progInstrumentu,instrumentyZ,instrumenty,noweInstrumentyZ,droga,drogaV5,progiLos,poziomLosV5,poziomLosV6,poziomLosKrzywej,KRZYWE_LOS,ustawKrzywaProba,get krzywaLos(){return krzywaProba||[LOS_G0,LOS_C,LOS_Q,LOS_MIN];},SCENY_Z_KOLA,poziomGraczaZ,poziomGracza,KLUCZ,WERSJA,GOSC,KATEGORIE,OSIAGNIECIA,get OSIAGNIECIA_AKTYWNE(){return OSIAGNIECIA_AKTYWNE;},ustawOsiagniecia:t=>{OSIAGNIECIA_AKTYWNE=!!t;},MIN_NUT,TORY,TORY_PLANSZY,TOR_GRACZA,TOR_PLANSZY,EFEKTY_Z_PULI_EKIPY,MAKS_STOPIEN,PRESTIZ_CO,SLAWA_ZA_OSIAGNIECIE,
    MNOZNIK_DNIA,MNOZNIK_SERII,SERIA_OD,MAKS_PROFILI,FORMAT_PLIKU,
    lista,utworz,zmienNazwe,usun,wyzeruj,przypnij,kolor,awatar,ustawienia,zapiszUstawienia,kapsel,przypiszKapsel,skladPoZmianie,eksport,importuj,
    maPostep,doUsunieciaPrzyLimicie,
    ekipa,wybierzMotyw,odblokujWszystko,wyzerujEkipe,wyzerujWszystko,odblokowanePlanszyZ,ekipaZ,naPlanszy,
    nowyLiczniki,dodajGre,wynikGracza,sprawdz,seriaDni,dzienLokalny,migruj,odblokowaneZ,slawaZaGre,slawaZWersji1,
    prog,progI,progWpisu,slawaRazem,poziomSlawy,poziomZ,prestizZ,drabinka:drabinkaToru,wpis:wpisDrabinki,torNagrody,skrot,
    nazwaProfilu,kluczProfilu,profil,odblokowane,stopien,wybierz,wybor,prestiz,postepOsiagniecia,licznikOsiagniecia,zrodloStylu,poGrze,
    losujKategorie,wszystkieRzeczy,devKolo,instrumentyWszystkie,studioOdblokowane,SEKRETY,drogaPelna,wszystkoZdobyte,wszystkoOtwarte,losowania,nicDoLosowania,losuj,pulaLosowania,liczbaWgRzadkosci,rzadkosc,RZADKOSCI,WAGI_RZADKOSCI,GWARANCJA_EPICKIEJ,GWARANCJA_LEGENDARNEJ,ustawDev,przeladuj,get dev(){return Object.assign({},dev);},get tylkoOdczyt(){stanZapisu();return tylkoOdczyt;}};
})();
