"use strict";
// ===== RIBBITBEAT (dawniej „Żabi chór”): lobby, tor, punktacja, HUD, wyniki =====
// Nazwy plików, klucze zapisu (ribbitflip.zabiChor…), baza IndexedDB `zabi-chor` i plik `dane/zabi-chor.json`
// zostają po staremu, żeby zapisane piosenki, parametry i ustawienia nie przepadły po zmianie nazwy.
// Gra rytmiczna z żabami i kapslami: nuty lecą z prawej do lewej, przechył kapsla
// w przód i w tył ustawia wysokość, przycisk sprawia, że żaba śpiewa. Plik ma pięć części:
//   1. słownik T (wszystkie napisy dla ludzi, później pójdzie do i18n aplikacji),
//   2. CZYSTE funkcje: mapowanie przechyłu, punktacja, chór, tory (testy wycinają je po nazwie i liczą w Node),
//   3. lobby (DOM): piosenki, ustawienia, gracze, start,
//   4. gra: krok symulacji, dźwięk, rysowanie toru na dwóch płótnach (tło statyczne + scena),
//   5. wyniki i API `window.ZC` dla harnessu (stan, przewijanie czasu, start).
// Czas gry liczony jest w ĆWIERĆNUTACH (jak nuty w piosenki.js), zegar to performance.now(), który
// harness w index.html umie przesuwać (ZC.ff), więc każda klatka liczy się tak samo w trybie
// przewijania i na żywo.

// =============================================================================================
// 1. SŁOWNIK
const T={
  tytulGry:"RibbitBeat",tytulRibbit:"Ribbit",tytulBeat:"Beat",
  podtytul:"Przechylaj kapsel, trzymaj przycisk i śpiewaj razem z żabami.",
  naglPiosenka:"Piosenka",
  naglUstawienia:"Ustawienia",
  naglGracze:"Skład",
  liczbaGraczy:"{n} z 8",
  // ekrany przed grą (10-03, „UI jak w grze”): menu i Zagraj = 1 Piosenka (z biblioteką) i 2 Rozgrywka
  menuNawigacja:"Menu gry",menuZagraj:"Zagraj",
  menuKlawisze:"Strzałki wybierają, Enter zatwierdza, Esc wraca. Pad: krzyżak, A i B. Kapsel dołącza przyciskiem, potem przechyłem prowadzi łapkę, a naciśnięciem klika.",
  menuEkranWlacz:"{F11} pełny ekran. Wyjdziesz w każdej chwili tym samym klawiszem.",menuEkranWyjdz:"Grasz na pełnym ekranie. {F11} w każdej chwili wraca do okna.",menuEkranTytul:"Kliknij albo naciśnij F11",
  licKarteczkaTytul:"Autorzy i licencje",licKarteczka:"Melodie, paczki MIDI, fonty i grafiki: kto je zrobił i na jakich zasadach. Licencję jednego utworu otworzysz plakietką na jego karcie.",
  wstecz:"Wstecz",wsteczOpis:"Wstecz (Esc)",
  krokiAria:"Kroki przed grą",krokPiosenka:"Piosenka",krokRozgrywka:"Rozgrywka",
  wybranaPiosenka:"Wybrana piosenka",dalej:"Dalej",zmienPiosenke:"zmień",
  wybranaMeta:"{czas} · {partie} · {tempo} uderzeń na minutę",
  wybranaPodpowiedz:"Kliknięcie wiersza wybiera utwór. Drugie kliknięcie wybranego przechodzi do Rozgrywki.",
  wybranaPodpowiedzKapsel:"Przód i tył: wybierz utwór. W bok: przyciski utworu. Naciśnij: dalej. Przytrzymaj: wstecz.",
  wybierz:"Wybierz",wybierzAria:"Wybierz i przejdź do rozgrywki: {tytul}",
  biblioWszystkie:"Wszystkie",sortuj:"Sortuj",sort_alfabet:"Alfabetycznie",sort_ostatnio:"Ostatnio grane",
  sort_najnowsze:"Najnowsze",sort_ulubione:"Ulubione",sort_trudnosc:"Od najłatwiejszych",
  tablicaTejPiosenki:"Tablica wyników tej piosenki",topPusto:"Nikt jeszcze tego nie zaśpiewał. Możesz być pierwszy.",
  topWiersz:"{punkty} pkt · {precyzja}%",
  biblioUlubione:"Ulubione",ulubioneDodaj:"Dodaj do ulubionych: {tytul}",ulubioneUsun:"Usuń z ulubionych: {tytul}",
  biblioUsun:"Usuń z biblioteki",biblioUsunAria:"Usuń z biblioteki: {tytul}",biblioUsunTytul:"Usunąć utwór?",
  biblioUsunPytanie:"„{tytul}” zniknie z biblioteki. Wyniki na tablicy zostaną i wrócą, gdy dodasz ten sam plik jeszcze raz.",
  biblioUsunTak:"Usuń utwór",biblioUsunNie:"Anuluj",biblioUsuniety:"Usunięto „{tytul}” z biblioteki.",
  biblioUsunPlikTytul:"Usunąć też plik z dysku?",biblioUsunPlikTak:"Usuń plik",biblioUsunPlikNie:"Zostaw plik",
  biblioUsunPlikPytanie:"Plik „{plik}” leży też w folderze „{folder}”. Usunięcia z dysku nie da się cofnąć. Jeśli go zostawisz, gra go pominie.",
  biblioUsunietyPlik:"Usunięto plik „{plik}” z folderu.",biblioUsunPlikBlad:"Nie udało się usunąć pliku „{plik}”. Zostaje w folderze, a gra go pominie.",
  jakDodacTytul:"Jak dodać utwór",
  jakDodacUpusc:"Upuść plik .mid w dowolnym miejscu okna.",
  jakDodacDysk:"Wybierz plik .mid z dysku.",jakDodacDyskPrzycisk:"Wybierz plik",
  jakDodacAdres:"Wklej adres pliku .mid albo sam plik skrótem Ctrl+V.",jakDodacAdresPrzycisk:"Dodaj z adresu",
  jakDodacPakiet:"Pobierz paczkę muzyki klasycznej razem z autorami i licencjami.",jakDodacPakietPrzycisk:"Pobierz",
  upuscMidi:"Upuść plik .mid w dowolnym miejscu okna albo",
  biblioFiltry:"Skąd piosenki",
  biblioWbudowane:"Wbudowane",biblioMoje:"Moje",
  zrodloWbudowana:"wbudowana",zrodlo_folder:"z folderu",zrodlo_upuszczona:"własny plik",zrodlo_adres:"z adresu",
  zrodlo_pakiet:"z paczki",
  biblioMeta:"{zrodlo} · {czas} · {partie}",
  biblioMetaKrotko:"{czas} · {partie}",
  biblioFragment:"takty {od}–{do}",
  biblioPowtorz:" ×{n}",
  piosenka1:"piosenka",piosenka2:"piosenki",piosenka5:"piosenek",
  posluchaj:"▶ Posłuchaj",stop:"■ Stop",
  posluchajAria:"Posłuchaj: {tytul}",
  ustawieniaPiosenki:"Ustawienia piosenki",
  ustawieniaAria:"Ustawienia piosenki: {tytul}",
  ustawieniaPiosenkiDla:"Ustawienia piosenki: {tytul}",
  podgladBezDzwieku:"Przeglądarka jeszcze nie pozwala grać. Kliknij jeszcze raz.",
  wczytuje:"Wczytuję {i} z {n}…",
  biblioBladPliku:"Nie udało się wczytać „{tytul}”: {powod}",
  biblioBrakPliku:"pliku nie ma już w przeglądarce",
  biblioJuzJest:"„{tytul}” już jest w bibliotece (ten sam plik), wybieram go",
  biblioPowtorka:"„{plik}” to ten sam plik co „{jest}”, pokazuję go raz",
  folderBrak:"Masz folder z plikami .mid? Wskaż go: gra wczyta pliki z jego podfolderu „piosenki” i dopisze tam nowe.",
  folderWskaz:"Wskaż folder",folderZmien:"Zmień folder",folderOdswiez:"Odśwież",folderCzyta:"Czytam…",
  folderDostep:"Nadaj dostęp",
  folderStan:"Folder „{nazwa}” · {n}",
  folderBezDostepu:"Folder „{nazwa}”: przeglądarka prosi o ponowną zgodę na odczyt.",
  folderNieobslugiwany:"Ta przeglądarka nie daje stronom dostępu do folderów. Piosenki przeciągnięte na okno zostają w przeglądarce.",
  folderPusty:"Nie ma tu jeszcze piosenek. Przeciągnij plik .mid na okno, wybierz go z dysku, wklej jego adres powyżej albo naciśnij Ctrl+V z plikiem lub adresem w schowku.",
  folderBlad:"Nie udało się wybrać folderu.",
  folderBladOdczytu:"Nie udało się odczytać folderu z piosenkami.",
  // import z adresu (pakiety.js; pobiera serwer aplikacji)
  urlTytul:"Dodaj piosenkę z adresu",urlPole:"https://… adres pliku .mid",urlPobierz:"Pobierz",
  urlNota:"Wklej adres samego pliku MIDI (zwykle kończy się na .mid). Pobiera go aplikacja na Twoim komputerze. Używaj plików, do których masz prawo.",
  folderDodajTytul:"Dodaj własne utwory",folderDodajOpis:"Masz plik .mid? Dodaj go z dysku albo wklej adres. Gra zapamięta go w Twojej bibliotece i zagrasz nim jak każdym innym utworem.",
  plikTytul:"Dodaj swoje pliki MIDI",plikPole:"Upuść pliki .mid albo cały folder",plikWybierz:"albo kliknij i wybierz pliki z dysku",plikFolder:"Wybierz cały folder",
  folderBezMidi:"W tym folderze nie ma plików MIDI (.mid albo .midi).",importByly:"Już było w bibliotece: {n}.",importZle:"Nie udało się wczytać: {n}.",
  plikNota:"Pliki albo folder możesz też upuścić w dowolnym miejscu okna. Plik albo adres wkleisz skrótem Ctrl+V w całym lobby.",
  urlZly:"To nie wygląda na adres pliku (http albo https).",urlLacze:"Łączę…",urlPostep:"{kb} z {razem} KB",
  urlPostepBez:"{kb} KB",urlWczytuje:"Wczytuję…",urlBlad:"Nie udało się pobrać pliku.",urlBladPowod:"Nie udało się pobrać pliku: {powod}",
  // pakiety MIDI z Hugging Face (pakiety.js, handoff „Pakiety MIDI i licencje w Ribbit Beat”)
  pakNota:"Paczki muzyki klasycznej z IMSLP do pobrania jednym kliknięciem prosto z Hugging Face. RibbitFlip nie przechowuje tych plików: aplikacja pobiera je na Twoje żądanie i zapisuje bez zmian na Twoim komputerze, razem z informacją o autorach i licencjach.",
  pakTytul:"Paczki utworów",pakGotoweTytul:"Gotowe paczki",
  pakStanBrak:"Do pobrania: {u} utworów",pakStanGotowe:"Pobrane paczki: {p} z {n} · {u} utworów",
  pakWczytuje:"Dodaję utwory z paczek: {i} z {n}…",
  pakTylkoWAplikacji:"Paczki i pobieranie z adresu działają w aplikacji RibbitFlip (przycisk RibbitBeat pod Synthem). W testowej wersji gry ich nie ma.",
  pakRozmiar:"{n} utworów, pobranie ok. {mb}.",pakPobierz:"Pobierz paczkę „{nazwa}” ({mb})",pakPobierzKrotko:"Pobierz · {mb}",
  pakPobierzOpis:"Pobiera pliki MIDI z Hugging Face do katalogu danych użytkownika. Możesz przerwać i dokończyć później.",
  pakPobierzBrakujace:"Pobierz brakujące ({n})",pakPostep:"{u} z {n} utworów · {mb} z {razem}",
  pakAnuluj:"Anuluj",pakUsun:"Usuń paczkę",pakUsunPytanie:"Usunąć paczkę „{nazwa}” ({n} utworów) z dysku? Możesz go pobrać ponownie.",
  pakZainstalowany:"Pobrana: {n} utworów",pakBlad:"Pobieranie się nie udało.",
  pakAnulowane:"Pobieranie przerwane. Pobrane utwory zostają, resztę dokończysz przyciskiem obok.",
  pakGotowe:"Paczka gotowa: {n} utworów.",pakBrakSerwera:"Brak połączenia z aplikacją.",
  pakBladStartu:"Nie udało się zacząć pobierania: {powod}",pakBladPliku:"Nie udało się wczytać „{tytul}”: {powod}",
  // licencje i atrybucja
  licWbudowana:"Domena publiczna",licUzytkownik:"Plik użytkownika",licUzytkownikKrotko:"Twój plik",licMidiAutor:"MIDI: {kto}",
  licWymagaAtrybucji:"wymaga podania autora",licSzczegoly:"Autor i licencja",licLicencja:"Licencja",licAutorPliku:"Autor pliku MIDI",
  licZrodlo:"Źródło",licStronaPliku:"strona pliku na IMSLP",licStronaUtworu:"Utwór",licImslp:"strona utworu na IMSLP",
  licZmiany:"Zmiany: mapa rytmu wygenerowana automatycznie z pliku MIDI przez RibbitBeat.",
  licUzytkownikOpis:"Plik dodany przez Ciebie. Zadbaj o to, żeby wolno Ci go używać.",
  licWbudowanaOpis:"Melodia w domenie publicznej, zapisana nutami w RibbitBeat.",
  licEkran:"Autorzy i licencje",licPodziekowanie:"Pliki MIDI w paczkach pochodzą z",
  licZbiory:"Dziękujemy też za zbiory na Hugging Face przygotowane przez TiMauzi (Tim Sockel):",
  licZasada:"RibbitFlip nie hostuje muzyki. Pliki pobiera Twoja aplikacja wprost z Hugging Face i zapisuje bez zmian, a mapy rytmu powstają na Twoim komputerze i nigdzie ich nie publikujemy.",
  licSekcjaPakiet:"{nazwa}: {n} utworów",licSekcjaWbudowane:"Piosenki wbudowane",licSekcjaMoje:"Twoje pliki ({n})",
  oknoZamknij:"Zamknij (Esc)",licBrakAtrybucji:"Ten utwór wymaga podania autora i licencji, a nie mam tych danych. Pobierz paczkę jeszcze raz.",
  szZamknij:"Zamknij ustawienia piosenki",
  szMelodia:"Melodia (śpiewa chór)",
  szPodklad:"Podkład (gra instrument)",
  szBezPodkladu:"Bez podkładu (sama melodia)",
  szPodkladAuto:"Reszta partii: {co}",
  szPodkladResztaGlosow:"Reszta partii: pozostałe ścieżki jako głosy chóru",
  szPodzial:"Podział rąk od",
  szSrodkoweC:"(środkowe C)",
  szFragment:"Fragment do ćwiczenia",
  szOdTaktu:"od taktu",szDoTaktu:"do",
  szCala:"Cała piosenka",
  szPowtorz:"Powtórz fragment",
  szTempo:"Tempo utworu (ćwierćnuty na minutę)",
  szTempoReset:"Jak w pliku",
  szTempoPliku:"tempo z pliku {n}",
  szTempoStart:"tempo z pliku {plik}, gra startuje w {gra}",
  szTempoKapsel:" (najszybciej dla kapsla)",
  szOryginal:"▶ Oryginał",
  szOryginalOpis:"Cały plik MIDI tak, jak jest: wszystkie ścieżki, bez upraszczania",
  szDomyslne:"Przywróć domyślne",
  szInfo:"{melodia} nut melodii · {partie} · takty {od}–{do} z {takty}",
  szUproszczenie:"analizator uprościł plik do melodii i basu: {powod}",
  szPodzialInfo:"analizator podzielił ścieżkę na ręce: {powod}",
  szZaznacz:"Przeciągnij po rolce, żeby zaznaczyć fragment",
  ppTytul:"Podgląd partii",
  ppPartie:"Partie piosenki",
  ppSpiewa:"śpiewa: {kto}",
  ppSpiewaWiecej:"śpiewa: {kto} i {n} innych",
  ppPosluchaj:"▶ Posłuchaj partii",
  ppZPodkladem:"z podkładem",
  ppPartiaPoprzednia:"Poprzednia partia",ppPartiaNastepna:"Następna partia",
  ppInstrument:"Instrument żaby w podglądzie",ppInstrumentPoprzedni:"Poprzedni instrument",ppInstrumentNastepny:"Następny instrument",
  ppInstrumentOpis:"Żaba w podglądzie śpiewa: {nazwa}. Tym instrumentem zaczyna też nowy gracz.",
  ppWejscie:"wchodzi w takcie {n}",
  ppTakt:"takt {n}",
  ppInfo:"takt {n} z {z}",
  ppRolkaAria:"Nuty partii {nazwa}. Kliknij takt, żeby tam przeskoczyć. Strzałki w lewo i w prawo przesuwają o takt, P gra albo zatrzymuje.",
  ppPowieksz:"Powiększ",ppZwin:"Zwiń",
  ppPowiekszOpis:"Powiększ podgląd: wysoka rolka z przewijaniem, karty graczy zwiną się do pasków",
  ppZwinOpis:"Zwiń podgląd i wróć do kart graczy (Esc)",
  ppWyborOpis:"Zmień podglądaną partię: strzałki wybierają, Enter zatwierdza, Esc zamyka",
  ppWyborAria:"Partia {n} z {z}: {nazwa}. Rozwiń, żeby wybrać inną.",
  ppMapa:"Cała piosenka: kliknij, żeby przeskoczyć do taktu, albo przeciągnij, żeby przewinąć",
  ppInfoPowtorz:"takt {n} z {z} · {r}×",
  ppWejscieDalej:"wchodzi w takcie {n} →",
  ppWejscieWczesniej:"← wchodzi w takcie {n}",
  notkaPartii:"wchodzi w takcie {takt} · {nuty} · zakres {zakres}",
  nuta1:"nuta",nuta2:"nuty",nuta5:"nut",
  sciezkaMelodia:"Melodia",
  sciezkaAkomp:"Akompaniament (lewa ręka)",
  wybierzPlik:"wybierz go z dysku",
  zPlikuMidi:"z pliku MIDI",
  metaPiosenki:"tempo {tempo} · {partie} · {czas}",
  partia1:"partia",partia2:"partie",partia5:"partii",
  ustGlos:"Głos żab",glos_trabka:"Trąbka",glos_ribbit:"Ribbit",glos_chor:"Chór",
  spiewaSama_nie:"Przyciskiem",spiewaSama_tak:"Sama",
  ustSpiewaSama:"Żaba śpiewa sama",
  ustSpiewaSamaOpis:"Dla gości: śpiew włącza się sam, kiedy pod linią jest nuta. Sterujesz tylko wysokością.",
  ustTempo:"Tempo",
  ustTempoOpis:"Wolniej jest łatwiej, ale za mniej punktów, a szybciej trudniej i za więcej: mnożnik widać obok procentu.",
  ustOpoznienie:"Opóźnienie kapsli",
  ustOpoznienieOpis:"Tyle radio kapsla spóźnia ruch. Mysz, klawiatura i roboty-żaby grają bez opóźnienia.",
  ustZakres:"Zakres przechyłu",
  ustKlawiatura:"Klawiatura",klawiatura_plynnie:"Płynnie",klawiatura_szybko:"Szybko",klawiatura_donuty:"Do nuty",
  ustKlawiaturaOpis:"Jak ↑/↓ i W/S prowadzą żabę. Płynnie: jak suwak, z rozpędem. Szybko: dwa razy szybciej. Skok prosto na nutę włączysz w Pomocach.",
  ustZakresOpis:"Tyle stopni w przód i w tył obejmuje całą partię.",
  ustPrzyciaganie:"Przyciąganie do nut",
  ustPrzyciaganieOpis:"Blisko nuty żaba sama dociąga głos. Im mocniej i z dalsza przyciąga, tym łatwiej, ale za mniej punktów: „Z daleka” łapie nutę nawet z czterech półtonów, a „Wyłączone” daje drobną premię.",
  przyciaganieWartosc:"{poziom} · punkty ×{m}",
  przyciaganie_0:"Wyłączone",przyciaganie_1:"Delikatne",przyciaganie_2:"Średnie",przyciaganie_3:"Mocne",przyciaganie_4:"Z daleka",
  ustKlawDoNuty:"Skok do nuty na klawiaturze",
  ustKlawDoNutyOpis:"Krótkie naciśnięcie ↑/↓ albo W/S przeskakuje od razu na najbliższą nadchodzącą nutę w tę stronę, a przytrzymanie jedzie dalej. Zmniejsza punkty tylko graczom na klawiaturze.",
  ustOdwroc:"Odwróć przód i tył",
  ustOdwrocOpis:"Zamienia kierunki przechyłu kapsla: przód działa jak tył, a tył jak przód.",
  ustSilnikMidi:"Silnik MIDI",
  ustSilnikMidiOpis:"Charakter podkładu. „Jeden instrument” gra wszystko wybranym instrumentem podkładu, „Jak w pliku” daje ścieżkom instrumenty zapisane w pliku MIDI, a zestawy dają osobne brzmienie basowi, środkowi i górze. Poza „Jednym instrumentem” gra też perkusja z pliku.",
  silnikiMidi:{jeden:"Jeden instrument",plik:"Jak w pliku",zespol:"Zespół",orkiestra:"Orkiestra",deta:"Orkiestra dęta",chip:"Konsola 8-bit",pozytywka:"Pozytywka",synty:"Syntezatory"},
  ppSilnik:"Silnik MIDI: charakter podkładu",ppSilnikPoprzedni:"Poprzedni silnik MIDI",ppSilnikNastepny:"Następny silnik MIDI",
  ppSilnikOpis:"Silnik MIDI: {nazwa}. Zmienia brzmienie podkładu w podglądzie i w grze.",
  ustPodklad:"Podkład",
  ustPodkladOpis:"Ten instrument gra partie, których nikt nie śpiewa. Gdy żaba śpiewa tym samym, podkład bierze inny.",
  ustPodpowiedz:"Cicha podpowiedź melodii",
  ustPodpowiedzOpis:"Flet cicho gra nuty z torów, więc łatwiej trafić w dźwięk.",
  celLosowanie:"losowanie nagrody",
  ustAnimacjaPostepu:"Animacja postępu",
  ustAnimacjaPostepuOpis:"Po piosence pokazuje liczenie sławy, nowe nagrody i następną. Wyłącz, jeśli wolisz od razu zobaczyć wyniki.",
  ustPelnyEkran:"Pełny ekran",
  ustPelnyEkranOpis:"Gra na całym ekranie, bez paska przeglądarki. Esc albo ten przełącznik wraca do okna.",
  ustPokazJak:"Pokaż jak",
  ustPokazJakOpis:"W pierwszej piosence od otwarcia gry żaba-duch pokazuje, jak śpiewać.",
  // „Poziom gry”, grupy ustawień i mnożniki punktów (10-18)
  grPoziom:"Poziom gry",
  grPoziomOpis:"Gotowe zestawy pomocy i trudności, z mnożnikiem punktów na każdym kaflu. Każdą opcję możesz potem zmienić niżej.",
  mnSumaOpis:"Mnożnik punktów tej konfiguracji: tempo × czas na ruch × pomoce. Procent i gwiazdki liczą się zawsze z samego śpiewu.",
  preset_luz:"Na luzie",
  preset_luzOpis:"Dla dzieci i gości: żaba śpiewa sama, mocno przyciąga głos do nut, gra cicha podpowiedź i jest więcej czasu na skoki. Punkty są mniejsze, gwiazdki przychodzą łatwiej.",
  preset_normalny:"Normalny",
  preset_normalnyOpis:"Gra tak, jak jest pomyślana: śpiewasz przyciskiem, a żaba delikatnie dociąga głos do nuty. Punkty bez zmian.",
  preset_wyzwanie:"Wyzwanie",
  preset_wyzwanieOpis:"Bez żadnych pomocy i z połową czasu na dalekie skoki. Każda nuta jest warta więcej punktów.",
  preset_mistrz:"Mistrz",
  preset_mistrzOpis:"Bez pomocy, bez dodatkowego czasu na skoki i w tempie 125%. Najwięcej punktów za każdą nutę.",
  preset_wlasne:"Własne",
  preset_wlasneOpis:"Twoje własne połączenie opcji z grup poniżej. Kafel je zapamiętuje, więc po wypróbowaniu zestawu wrócisz do nich jednym kliknięciem.",
  grTrudnosc:"Trudność",
  grTrudnoscOpis:"Szybsze tempo i mniej czasu na skoki to trudniejsza gra, więc każda nuta jest warta więcej punktów.",
  grPomoce:"Pomoce",
  grPomoceOpis:"Ułatwiają granie dzieciom, gościom i każdemu, komu sterowanie sprawia kłopot. Każda zmniejsza punkty mniej więcej o tyle, ile dokłada, więc nie daje przewagi w wynikach. Tu ustawiasz je wszystkim, a na karcie gracza każdy może mieć własne.",
  grSterowanie:"Sterowanie",
  grSterowanieOpis:"Dopasowanie do ręki, kapsla i klawiatury. Punktów nie zmienia.",
  grEkran:"Ekran i tory",
  grEkranOpis:"Jak dzielicie ekran i tory. Punktów nie zmienia, a w „Chórze” można zdobyć premię za śpiew w jednym głosie.",
  grDzwiek:"Dźwięk",
  grDzwiekOpis:"Głośność, instrumenty i efekty. Punktów nie zmienia.",
  grGrafika:"Grafika",
  grGrafikaOpis:"Jakość obrazu na tym komputerze. Punktów nie zmienia.",
  mnPunkty:"punkty ×{m}",mnKlawiatura:"na klawiaturze ×{m}",mnPoWlaczeniu:"po włączeniu ×{m}",
  mnBezWplywu:"bez wpływu na punkty",mnBezMnoznika:"bez mnożnika",punktyKlawiatura:"tylko klawiatura",
  pomoceZeton:"pomoce ×{m}",pomoceMnoznik:"pomoce ×{m}",
  // 10-18 wieczór: pomoce gracza (kafel „Pomoce” w karcie, okno „Pomoce: …”)
  kartaPomoce:"Pomoce",kartaPomoceDymek:"Pomoce: {opis} ({skad}). Punkty tego gracza ×{m}. Kliknij, żeby ustawić pomoce tylko temu graczowi.",
  pomoceSkad_gra:"jak w ustawieniach",pomoceSkad_wlasne:"własne",
  pomoceTytul:"Pomoce: {nazwa}",
  pomoceWstep:"Pomoce ułatwiają śpiewanie temu graczowi i zmniejszają jego punkty, więc wspólny ranking zostaje uczciwy. Pozostali grają ze swoimi pomocami.",
  pomoceProfil:"Wybór zapamięta profil {nazwa}.",
  pomoceGosc:"Gość: wybór zostaje w tym składzie. Żeby profil go zapamiętał, wpisz imię na karcie gracza.",
  pomoceTryb:"Pomoce gracza",pomoceTryb_gra:"Jak w ustawieniach",pomoceTryb_wlasne:"Własne",
  pomoceTrybOpis_gra:"Gracz ma pomoce z kolumny Ustawienia: {opis}. Kliknij pomoc niżej, a dostanie własne.",
  pomoceTrybOpis_wlasne:"Gracz ma własne pomoce, a zmiany w kolumnie Ustawienia go nie dotyczą.",
  klawDoNuty_nie:"Zwykły ruch",klawDoNuty_tak:"Skok do nuty",
  pomocePunkty:"Punkty tego gracza ×{m}",pomoceSklad:"pomoce ×{p} · tempo i czas na ruch ×{t}",
  pomocePodpowiedz:"Podpowiedź melodii słyszą wszyscy, więc włącza się ją w kolumnie Ustawienia (×{m} każdemu).",
  wiecejUstawien:"Więcej ustawień",
  opisWiecej:"Pokaż albo schowaj cały opis",
  mniejUstawien:"Mniej ustawień",
  instrumenty:{piano:"Pianino",epiano:"Pianino elektryczne",organ:"Organy",guitar:"Gitara",flute:"Flet",
    strings:"Smyczki",marimba:"Marimba",musicbox:"Pozytywka",chip:"8-bit",synth:"Syntezator"},
  dolaczMysz:"Kliknij tutaj, żeby dołączyć myszą",
  dodajBota:"Dodaj bota",dodajGracza:"Dodaj gracza",
  wyborTytul:"Kto dołącza?",wyborZamienTytul:"Kto zamiast: {nazwa}?",wyborCzlowiek:"Człowiek",wyborBot:"Bot",wyborKapsel:"Kapsel",
  wyborZajete:"już śpiewa",wyborPad:"Pad {n}",wyborBrakPada:"Naciśnij na padzie dowolny przycisk, wtedy się tu pojawi.",
  wyborBrakKapsli:"Żaden kapsel nie czeka. Włącz kapsel w aplikacji RibbitFlip i naciśnij jego przycisk.",
  graczNazwa:"Imię gracza",graczKolor:"Zmień kolor",graczWLewo:"Przesuń w lewo",graczWPrawo:"Przesuń w prawo",
  graczZmienZrodlo:"Zmień, kto steruje",dolacza:"Dołącza: {nazwa}",
  jakDolaczyc:"Dołączasz przyciskiem kapsla albo pada, Spacją (gracz W/S), Enterem (gracz strzałek) albo kliknięciem.",
  zrodlo_mysz:"mysz",zrodlo_ws:"klawiatura W/S",zrodlo_strzalki:"klawiatura, strzałki",zrodlo_bot:"bot",
  zrodlo_kapsel:"kapsel",zrodlo_pad:"pad",
  pomoc_mysz:"Wysokość myszą, śpiew lewym przyciskiem, wibrato szybkim ruchem w lewo i w prawo.",
  pomoc_ws:"W/S wysokość, Spacja śpiew, Q i E na przemian wibrato, lewy Shift wolniej i dokładniej. Przed piosenką W/S wybiera pole karty, A/D je zmienia, Spacja: gotowe.",
  pomoc_strzalki:"↑/↓ wysokość, Enter śpiew, . i / na przemian wibrato, prawy Shift wolniej i dokładniej. Przed piosenką ↑/↓ wybiera pole karty, ←/→ je zmienia, Enter: gotowe.",
  pomoc_bot:"Śpiewa to, co mu wybierzesz.",
  pomoc_pad:"Lewa gałka: wyżej i niżej. Przed piosenką krzyżak: góra i dół wybiera pole karty, w bok je zmienia, A: gotowe. A, B, bumpery albo spusty: śpiew. Prawa gałka: wibrato. Start: pauza.",
  pomoc_kapsel:"Przód i tył: wybierz pole. W bok: zmień. Przycisk: gotowe. Przytrzymaj: wróć do piosenek.",
  pomocKarty_kapsel:"Przód i tył: wybierz pole. W bok: zmień. Przycisk: gotowe. Przytrzymaj: wróć do piosenek.",
  pomocKartyGotowy_kapsel:"Gotowe, czekasz na resztę. Przytrzymaj przycisk, żeby jeszcze coś zmienić.",
  pomocKarty_ws:"W i S: wybierz pole. A i D: zmień. Spacja: gotowe. Esc: wróć do piosenek.",
  pomocKartyGotowy_ws:"Gotowe, czekasz na resztę. Spacja jeszcze raz, żeby coś zmienić.",
  pomocKarty_strzalki:"Strzałki góra i dół: wybierz pole. Lewo i prawo: zmień. Enter: gotowe. Esc: wróć do piosenek.",
  pomocKartyGotowy_strzalki:"Gotowe, czekasz na resztę. Enter jeszcze raz, żeby coś zmienić.",
  pomocKarty_pad:"Krzyżak góra i dół: wybierz pole. W bok: zmień. A: gotowe. Back: wróć do piosenek.",
  pomocKartyGotowy_pad:"Gotowe, czekasz na resztę. A jeszcze raz, żeby coś zmienić.",
  gotowe:"✓ Gotowe!",potwierdz:"Gotowe?",potwierdzKapsel:"Naciśnij: gotowe",
  potwierdz_ws:"Spacja: gotowe",potwierdz_strzalki:"Enter: gotowe",potwierdz_pad:"A: gotowe",
  startGotowi:"Gotowi: {n} z {z}",
  poleKapsla:"Pole, które teraz ustawia: {kto}",
  poprzedniaPartia:"Poprzednia partia",nastepnaPartia:"Następna partia",
  usunGracza:"Usuń ze składu",
  czekaja:"Kapsle czekają na przycisk:",
  brakRuchu:"nie rusza się",
  komplet:"Skład ma komplet 8 żab.",
  start:"Śpiewamy!",
  startZa:"Start za {n}…",
  brakGraczy:"Najpierw ktoś musi dołączyć",
  kliknijDzwiek:"Kliknij gdziekolwiek, żeby włączyć dźwięk i zacząć",
  partiaMelodia:"Chór (melodia)",
  partiaAkomp:"Basy (akompaniament)",
  partiaSciezka:"Ścieżka {n}",
  partiaNazwana:"„{nazwa}”",
  zaDuzoTorow:"Najwyżej 4 tory naraz: {kto} śpiewa z melodią.",
  wczytujeUtwor:"Wczytuję utwór",
  odchrzakujemy:"Odchrząkujemy…",
  uwaga:"Uwaga!",
  start_kapsel_pelny:"Przechylaj kapsel: wyżej i niżej.\nTrzymaj przycisk, żeby śpiewać",
  start_kapsel_latwy:"Przechylaj kapsel, żaba śpiewa sama",
  start_mysz_pelny:"Mysz w górę i w dół: wyżej i niżej.\nTrzymaj lewy przycisk, żeby śpiewać",
  start_mysz_latwy:"Mysz w górę i w dół, żaba śpiewa sama",
  start_ws_pelny:"W i S: wyżej i niżej.\nTrzymaj Spację, żeby śpiewać",
  start_ws_latwy:"W i S: wyżej i niżej, żaba śpiewa sama",
  start_strzalki_pelny:"↑ i ↓: wyżej i niżej.\nTrzymaj Enter, żeby śpiewać",
  start_strzalki_latwy:"↑ i ↓: wyżej i niżej, żaba śpiewa sama",
  start_pad_pelny:"Lewa gałka: wyżej i niżej.\nTrzymaj A albo spust, żeby śpiewać",
  start_pad_latwy:"Lewa gałka: wyżej i niżej, żaba śpiewa sama",
  escWyjscie:"Esc: pauza",
  dzwiekWylaczony:"Kliknij, żeby włączyć dźwięk",
  // samouczek „Jak grać” (js/jak-grac.js, 10-16): liczby zgodne z ZC_PUNKTY (wibrato ≥ 2 ćwierćnuty, ×1,25; „w punkt” 100 ms)
  nagrodyOdbierz:"Odbierz nagrody",nagrodyOdbierzAria:"Odbierz nagrody: czeka {n} {l}",nagrodyLos:["losowanie","losowania","losowań"],
  menuJakGrac:"Jak grać",sm_etykieta:"Jak grać",sm_dalej:"Dalej",sm_pomin:"Pomiń",
  sm_pytanieTytul:"Pierwszy raz w RibbitBeat?",sm_pytanieOpis:"Samouczek pokaże to na krótkiej piosence z botem: gra zatrzyma się przy każdej ważnej rzeczy i ją objaśni. Możesz go też włączyć później przyciskiem „Jak grać” w menu.",
  sm_pytanieTak:"Pokaż, jak grać",sm_pytanieNie:"Od razu do piosenek",sm_pytanieZamknij:"Zamknij i wróć do menu",nowyInstrument:"nowy instrument: {nazwa}",instrumentyOdblokowane:"Ekipa ma {n} z {z} instrumentów. Kolejne losujecie na kole nagród: każdy wspólny poziom to jedno losowanie.",slawaPoziom:"Poziom {n}",celInstrument:"{nazwa} (instrument)",drogaTytul:"Wspólna droga",drogaLicznik:"poziom {n} z {z}",drogaWstep:"Nagrody zbieracie całą ekipą. Każdy wspólny poziom to jedno losowanie na kole: najpierw kategoria (instrument, skin albo scena), potem nagroda z niej. Im rzadsza, tym trudniej ją wylosować. Ostatnie losowanie daje dwie rzeczy naraz. Niewylosowane nagrody czekają pod kłódką.",
  drogaWolne:"Czeka losowań: {n}",rzadkosc:{zwykly:"Zwykły",rzadki:"Rzadki",epicki:"Epicki",legendarny:"Legendarny",sekretny:"Sekretny"},drogaPoziom:"poziom {n}",drogaBrakuje:"jeszcze {n} sławy",drogaEfekt:"skin",drogaInstrument:"instrument",drogaPosluchaj:"Posłuchaj: {nazwa}",sm_zakoncz:"Zakończ samouczek",sm_zagraj:"Zagraj",
  sm_linia:["Żaba śpiewa przy różowej linii","Nuty jadą z prawej. Kiedy nuta dojeżdża do linii, ustaw żabę na jej wysokości: myszą w górę i w dół, W/S, strzałkami, lewą gałką pada albo przechyłem kapsla. Shift spowalnia ruch."],
  sm_spiew:["Trzymaj śpiew, póki trwa nuta","Przycisk śpiewu: lewy przycisk myszy, Spacja, Enter, A na padzie albo przycisk kapsla. Puść w przerwie. Im bliżej środka taśmy, tym lepsza ocena przy nucie. Naciśnij na początku i puść na końcu nuty (do 100 ms), a dostaniesz „w punkt”."],
  sm_wibrato:["Wibrato na długiej nucie","Ta nuta ma falisty koniec. W jej drugiej połowie zrób wibrato: szybko ruszaj myszą w lewo i w prawo, stukaj na przemian Q i E (albo . i /), wychyl prawą gałkę pada albo bujaj kapslem na boki. Taka nuta liczy się ×1,25."],
  sm_hud:["Punkty, mnożnik i gwiazdki","Tu widać Twój wynik. Co 4 nuty bez fałszu mnożnik rośnie, a kreski pod nim pokazują, ile brakuje. Pasek pod punktami prowadzi do następnej gwiazdki, a długie kombo zapala ogień na torze."],
  sm_fraza:["Złota fraza","Świecące nuty to fraza z premią: zaśpiewaj każdą z nich co najmniej na „dobrze”, a dostaniesz dodatkowe punkty."],
  sm_koniec:["Teraz Ty!","Esc zatrzymuje piosenkę, a po „Wróć” gra odlicza 3, 2, 1, żeby każdy zdążył ustawić żabę. Wybierz piosenkę i dołącz swoim klawiszem albo przyciskiem."],
  pauza:"Pauza",wroc:"Wróć",wznowienieNota:"Ustaw żabę na torze, zaraz gramy dalej",odNowa:"Od nowa",wyjdz:"Wyjdź",
  pauzaPodpowiedz:"Wróć: Esc albo Start · Od nowa: R · Wyjdź: Q albo Back · Przycisk wybiera krzyżak pada albo przechył kapsla, klika A albo naciśnięcie",
  ocena_czysto:"Czysto!",ocena_dobrze:"Dobrze",ocena_prawie:"Prawie",ocena_falsz:"Fałsz",ocena_pudlo:"Pudło",
  komboPopup:"Kombo {n}!",
  klikPopup:"W rytm ×{n}!",
  wPunktLot:"W PUNKT",wPunktIdealnie:"IDEALNIE",
  sekcjaPopup:"Świecąca fraza!",sekcjaCzysta:"Czysta świecąca fraza!",
  premiaKlik:"w rytm i w punkt +{n}",
  scalonyPopup:"{tekst} ×{n}",
  komboHud:"kombo {n}",hudZerwane:"zerwane!",hudLider:"lider",hudDoGwiazdki:"Do następnej gwiazdki",hudMiejsce:"Miejsce {n}",hudStrata:"Strata do lidera: {n}",
  wJednymGlosie:"W jednym głosie!",
  wibrato:"Wibrato!",
  kum:"kum",
  duchTak:"Tak!",
  koniecNaklejka:"Koniec!",hudGwiazdki:"Gwiazdki dotąd: {n} z 5",
  gwiazdkiDymek:"Gwiazdki liczą się z czystości śpiewu, nie z liczby trafionych nut.",
  koniecTytul:"Brawo, chórze!",koniecTytulSolo:"Brawo!",koniecTytulCisza:"Cisza na scenie",
  koniecPodtytul:"{tytul} · chór zdobył {procent}% możliwych punktów",
  koniecPodtytulSolo:"{tytul} · {procent}% możliwych punktów",
  koniecPodtytulChor:"{tytul} · chór zdobył {procent}% możliwych punktów · premia za śpiew w jednym głosie: +{n} pkt",
  // rozbicie wyniku pod nazwą gracza (rozbicieWyniku) i dymek „skąd punkty” na liczbie punktów
  rozb_czysto:"czysto",rozb_dobrze:"dobrze",rozb_prawie:"prawie",rozb_falsz:"fałsz",rozb_pudlo:"pudło",
  rozb_wibrato:"wibrato",rozb_klik:"w rytm",rozb_wpunkt:"w punkt",
  rozbicieOpis:"Nuty: {czysto} czysto, {dobrze} dobrze, {prawie} prawie, {falsz} fałsz, {pudlo} pudło. Wibrato ×{wibrato}, w rytm ×{klik}, w punkt ×{wpunkt} (najdłuższa seria {seria}).",
  punktySkad:"Skąd punkty: za nuty {nuty} (z mnożnikiem kombo i wibratem) · premia za czystą piosenkę {premia} · w jednym głosie {chor} · w rytm i w punkt {klik}",
  kolPunkty:"punkty",kolCelnosc:"celność",kolKombo:"kombo",kolPrecyzja:"precyzja",
  trafionych:"trafione {t} z {n} nut",
  rankingWg:"Ranking:",kategoria_punkty:"Punkty",kategoria_precyzja:"Precyzja",
  lider_punkty:"1. w punktach",lider_precyzja:"1. w precyzji",
  miejsceNaTablicy:"#{n} na tablicy",miejsceNaTablicyOpis:"miejsce na tablicy wyników tej piosenki w tej samej partii i konfiguracji",
  // poziom trudności bota (wejscie.js POZIOMY_BOTOW) i partii (ZC_TRUDNOSC)
  poziomBota:"Poziom",poziomBotaZmien:"Zmień poziom bota",poziomBotaWlasny:"luz {n}",
  poziomBotaTytul:"Poziom: {nazwa}",poziomBotaWstep:"Wybierz robo-żabę: im więcej czipów, tym lepiej śpiewa.",poziomBotaOtworz:"Kliknij, żeby wybrać poziom z obrazków.",
  wyborRobo:"Robo-żaba",wyborRoboOpis:"Bot, poziom {poziom}. Zmienisz go na karcie.",instrumentyBotWstep:"Robo-żaba gra każdym instrumentem. Kliknij, żeby go wybrać.",etykietaBota:"bot {poziom}",
  poziom_bota_latwy:"Łatwy",poziom_bota_sredni:"Średni",poziom_bota_trudny:"Trudny",poziom_bota_mistrz:"Mistrz",
  poziomBotaOpis_latwy:"Spóźnia się, fałszuje i nie nadąża za skokami.",
  poziomBotaOpis_sredni:"Trafia łatwe i średnie partie, gubi się na szybkich skokach.",
  poziomBotaOpis_trudny:"Czyta nuty z wyprzedzeniem, rzadko fałszuje.",
  poziomBotaOpis_mistrz:"Prawie bez błędów. Zgubi tylko partie ekstremalne.",
  trudnosc_latwa:"łatwa",trudnosc_srednia:"średnia",trudnosc_trudna:"trudna",trudnosc_bardzoTrudna:"bardzo trudna",
  trudnosc_ekstremalna:"ekstremalna",
  trudnoscZnaczek:"{ocena}",
  trudnoscOpis:"Trudność {ocena}/10: {poziom}.",trudnoscDlaczego:" Najwięcej waży: {co}.",
  trudnoscBot:" Na miarę bota: {bot}.",trudnoscBotNikt:" Nie zagra jej nawet bot Mistrz.",
  trudnoscTempo:" Przy tempie {tempo} ćwierćnut na minutę.",
  trudnoscZakres:" Partie tego utworu: od {od} do {do}.",wybranaZakres:"partie {od}–{do}",
  czynnik_ruch:"skoki bez czasu na ruch",czynnik_gestosc:"dużo zmian nut na sekundę",czynnik_precyzja:"szeroki zakres, czyli mały cel",
  czynnik_rytm:"nieregularny rytm",czynnik_zygzaki:"zygzaki w górę i w dół",czynnik_dlugosc:"długa partia",
  premia:"z premią {n} za czystą piosenkę",
  premiaChoru:"chór +{n}",
  nagrodaCzysty:"Najczystszy głos",
  nagrodaKombo:"Największe kombo",
  nagrodaFalsz:"Król fałszu",
  nagrodaGadula:"Największa gaduła",
  nagrodaCzystyWartosc:"{n}% celności",
  nagrodaKomboWartosc:"{n} nut z rzędu",
  nagrodaFalszWartosc:"fałsz × {n}",
  nagrodaGadulaWartosc:"{n} s rechotu",
  nagrodaAplauz:"Największy aplauz",
  nagrodaAplauzWartosc:"{n}% wszystkich braw",
  tablica:"Tablica wyników",tablicaKrotko:"Wyniki",tablicaAria:"Tablica wyników: {tytul}",
  tablicaPusta:"Jeszcze nikt tu nie śpiewał. Zagraj, a wynik zapisze się sam.",
  tablicaPustaFiltr:"Żaden wynik nie pasuje do tych filtrów.",
  tablicaPartia:"Partia",tablicaTrudnosc:"Trudność",tablicaKonfiguracja:"Konfiguracja",tablicaKto:"Kto",
  tablicaWszystkie:"wszystkie",tablicaLudzie:"ludzie",tablicaBoty:"z botami",
  tablicaSortuj:"Sortuj:",tablicaZamknij:"Zamknij tablicę wyników (Esc)",
  tablicaPlik:"plik „{plik}”, {rozmiar} B",tablicaWbudowana:"piosenka wbudowana",
  tablicaWynikow:"{n} wyników",tablicaGrano:"grano {n} razy",
  tablicaKol:{miejsce:"#",kto:"kto",partia:"partia",trudnosc:"trudność",konf:"konfiguracja",punkty:"punkty",precyzja:"precyzja",kombo:"kombo",kiedy:"kiedy"},
  konfTempo:"tempo {n}%",konfPelny:"śpiew przyciskiem",konfLatwy:"żaba śpiewa sama",konfPomoc:"przyciąganie delikatne",konfBezPomocy:"bez przyciągania",
  konfPrzyciaganie:"przyciąganie {poziom}",konfPodpowiedz:"podpowiedź melodii",konfKlawDoNuty:"skok do nuty",konfPomoce:"pomoce ×{m}",
  konfFragment:"takty {od}–{do}",konfPowtorz:" ×{n}",konfZakres:"zakres {n}°",konfOsobno:"każdy na swoim torze",konfTempoZPliku:"tempo z pliku",
  dzisiaj:"dziś",wczoraj:"wczoraj",
  rekordTytul:"Twój rekord",
  rekordWartosc:"{n} pkt",
  rekordNowy:"Nowy rekord!",
  rekordDzis:"dziś {n} pkt",
  jeszczeRaz:"Jeszcze raz",
  innaPiosenka:"Inna piosenka",
  wynikiPodpowiedz:"Spacja albo Enter: jeszcze raz. Esc albo Back na padzie: inna piosenka. Przycisk wybiera krzyżak pada albo przechył kapsla, klika A albo naciśnięcie.",
  aplauzPodpowiedz:"Brawa dla chóru! Kręć kapslem, machaj myszą albo stukaj w klawisze.",
  aplauzPodpowiedzSolo:"Brawa dla solisty! Kręć kapslem, machaj myszą albo stukaj w klawisze.",
  aplauzPodpowiedzOsobno:"Brawa dla wszystkich! Kręć kapslem, machaj myszą albo stukaj w klawisze.",
  dodanoMidi:"Dodano „{tytul}”: {partie}.",
  dodanoWiele:"Dodano {n} {utwory}.",utwor1:"utwór",utwor2:"utwory",utwor5:"utworów",
  bladMidi:"Nie udało się wczytać pliku: {powod}",
  tylkoMidi:"To nie wygląda na plik MIDI (.mid albo .midi).",
  upuscTutaj:"Upuść plik MIDI, a dodam go do piosenek",
  najpierwSkoncz:"Plik MIDI dodasz po piosence.",
  zywiRozlaczeni:"Brak połączenia z aplikacją RibbitFlip, ponawiam…",
  boty:["Kumak","Rzekotka","Ropuszka","Grzebiuszka","Rechotek","Kumcia","Plusk","Moczarka"],
  ustCzasNaRuch:"Czas na ruch",czasNaRuchWartosc:"{n}% · punkty ×{m}",
  tempoWartosc:"{n}% · punkty ×{m}",tempoZeton:"tempo {n}% · ×{m}",tempoMnoznik:"tempo ×{m}",tempoMetka:"tempo {n}%",
  ustCzasNaRuchOpis:"Ile czasu dostajesz na przesunięcie żaby przy dalekim skoku: nuta kończy się wcześniej o tyle, a prawdziwą długość pokazuje blady duch taśmy. Mniej czasu to trudniej, ale każda nuta jest warta więcej punktów: 0% daje ×1,25, 100% to zwykłe punkty, 150% ×0,9. Dźwięk się nie zmienia.",
  trudnoscZRuchem:" Z czasem na ruch {n}%.",konfZRuchem:"czas na ruch {n}%",
  ustTryb:"Tryb nut",tryb_klasyczny:"Schodki",tryb_plynny:"Płynny",
  ustTrybOpis:"Płynny: dłuższa nuta, która przechodzi od razu w sąsiednią, zjeżdża do niej po łuku, a punkty liczą się po drodze. Nie każda nuta zjeżdża: krótkie i dalekie zostają skokami. Schodki: każda nuta osobno, między nutami nagły skok. Przy każdej zmianie wysokości, także o jeden półton, dostajesz chwilę na przejście: koniec nuty przed skokiem i początek następnej nie obniżają punktów (ile, ustawiasz w „Czasie na ruch”).",
  konfPlynny:"tryb płynny",
  ustStylGrafik:"Styl grafik",stylGrafik_ilustracja:"Ilustracja",stylGrafik_naszywka:"Naszywka",
  ustStylGrafikOpis:"Ilustracja: sceny i postacie namalowane w filcu. Naszywka: wszystko jak wycięte naszywki z ikon RibbitFlip (10 pierwszych motywów).",
  ustGrafika:"Grafika",grafika_pelna:"Pełna",grafika_uproszczona:"Uproszczona",grafika_wydajnosc:"Wydajność",
  ustGrafikaOpis:"Uproszczona: bez ognia, dymu i iskier. Wydajność: do tego bez sceny w tle, bez efektów i w niższej rozdzielczości, dla najsłabszego komputera. Twój wybór tutaj kasuje obniżkę z „Auto-jakości”.",
  ustAutoJakosc:"Auto-jakość",ustAutoJakoscOpis:"Gdy klatki nie nadążają, gra obniża grafikę o stopień, ale dopiero od następnej piosenki, żeby w trakcie grania nic się nie zmieniało. Zapamiętuje to na tym ekranie; wybór „Grafiki” kasuje obniżkę.",
  wynikiJakosc:"Klatki nie nadążały. Od następnej piosenki: {co}. Przywrócisz w Ustawieniach → Więcej ustawień → Grafika.",
  jakosc_1:"niższa rozdzielczość",jakosc_2:"bez ognia, dymu i iskier",jakosc_3:"tryb wydajności",
  ustKlatki:"Klatki",klatki_60:"60",klatki_120:"120",klatki_0:"Bez limitu",
  ustKlatkiOpis:"Równe tempo obrazu. 60 wystarcza i jest najpłynniejsze na słabszym komputerze; „Bez limitu” rysuje tyle, ile da monitor.",
  // układ ekranu i instrument gracza (2026-10-03)
  ustUklad:"Podział ekranu",uklad_auto:"Auto",uklad_pasy:"Pasy",uklad_kolumny:"Kolumny",uklad_siatka:"Siatka",
  ustUkladOpis:"„Auto” dobiera układ do liczby torów: 2 tory jeden nad drugim, 3 wysokie kolumny, 4 siatka 2×2.",
  ustTory:"Tory",tory_osobno:"Każdy swój",tory_chor:"Chór",
  toryUwagaWspolny:"Przy więcej niż {n} graczach gracie jak w chórze: ta sama partia śpiewa na jednym torze.",
  ustToryOpis:"„Każdy swój”: każdy gracz ma własny tor, także przy tej samej partii (do 4 graczy). „Chór”: ta sama partia śpiewa razem na jednym torze i zbiera premię za śpiew w jednym głosie.",
  ustGlosDomyslny:"Instrument nowego gracza",
  ustGlosDomyslnyOpis:"Tym instrumentem zaczyna każdy, kto dołącza. Swój zmienisz potem na karcie gracza.",
  instrumentGracza:"Instrument",poprzedniInstrument:"Poprzedni instrument",nastepnyInstrument:"Następny instrument",odsluchInstrumentu:"Posłuchaj instrumentu",
  // przełącznik w oknie gracza (10-21 wieczór, 10-22: osobno dla każdego instrumentu): jak instrument przechodzi między nutami
  przejsciaTytul:"Przejścia między nutami",przejsciaTytulInstr:"Przejścia między nutami: {instrument}",
  przejscia_auto:"Domyślnie",przejscia_plynne:"Płynnie",przejscia_skok:"Skokowo",
  przejsciaTryb_plynne:"płynnie",przejsciaTryb_skok:"skokowo",
  przejsciaOpis_auto:"{instrument}: domyślnie {tryb}, czyli najlepsze brzmienie tego instrumentu.",
  przejsciaOpis_plynne:"{instrument}: wysokość płynie za śpiewem bez przerw, jak suwak puzonu. Inne instrumenty zostają po swojemu.",
  przejsciaOpis_skok:"{instrument}: staje na nutach piosenki i wchodzi na każdą z nowym atakiem. Inne instrumenty zostają po swojemu.",
  przejsciaDymek_auto:"Każdy instrument domyślnie gra tak, jak brzmi najlepiej: pianino i Krzyk skokowo, a puzon i theremin płynnie.",
  przejsciaKafel:"Przejścia między nutami: {tryb}.",
  instrumentyGracza:{trabka:"Trąbka",ribbit:"Ribbit",chor:"Chór",smyczki:"Smyczki",flet:"Flet",organy:"Organy",
    syntezator:"Syntezator",theremin:"Theremin",piano:"Pianino",epiano:"Pianino elektryczne",guitar:"Gitara",
    bas:"Gitara basowa",hawajska:"Gitara hawajska",
    kazoo:"Kazoo",przester:"Gitara z przesterem",harmonijka:"Harmonijka",kwak:"Kwak wah-wah",kot:"Kot miau",okaryna:"Okaryna",impuls:"Impuls",puzon:"Puzon",szept:"Szept",trance:"Trance",klarnet:"Klarnet",erhu:"Erhu",wiolonczela:"Wiolonczela",chiptune:"Chiptune",wiatr:"Gwiżdżący wiatr",gwizdek:"Gwizdek",duduk:"Duduk",tuba:"Tuba",oboj:"Obój",didgeridoo:"Didgeridoo",dudy:"Dudy",sub:"Sub",opera:"Śpiew operowy",wobble:"Wobble",hammond:"Organy Hammonda",robot:"Robot",wokal:"Wokal „ooo”",krzyk:"Krzyk"},
  graczMysz:"Mysz",graczWS:"W/S",graczStrzalki:"Strzałki",graczPad:"Pad",
  // scena gracza: style widowni i streaka, osiągnięcia (postepy.js, efekty.js; 2026-10-03)
  scenaWidownia:"Widownia",scenaStreak:"Skin",scenaMotyw:"Motyw",scenaOsiagniecia:"Osiągnięcia",scenaTytul:"Skin: {nazwa}",
  scenaWstep:"Wybierz widownię na dole ekranu i swój skin. Nowe style losujecie na kole nagród.",
  scenaGosc:"Grasz jako Gość. Nagrody zbieracie wspólnie, a wpisana nazwa zapamięta wybrany skin.",
  scenaWidowniaOpis:"Na scenie widać widownię pierwszego gracza w składzie, a skin każdy ma swój.",
  scenaZablokowane:"Zablokowane",scenaOdblokuje:"odblokowuje {co}",scenaPrestiz:"Prestiż {n} z 5",
  scenaLicznik:"{n} z {z}",scenaWarunek:"Zdobądź osiągnięcie „{nazwa}”: {opis}",scenaPrzycisk:"Skin",
  osiagLiczby:"{n} / {z}",osiagZdobyte:"zdobyte {data}",
  nagrodaStreak:"{nazwa} · skin",nagrodaPlansza:"{nazwa} · scena",noweOsiagniecie:"Nowe osiągnięcie: {nazwa}",
  noweOsiagnieciaWiecej:"i jeszcze {n}",
  noweOsiagnieciaRazem:"{n} {osiagniec}",osiagniecie1:"nowe osiągnięcie",osiagniecie2:"nowe osiągnięcia",osiagniecie5:"nowych osiągnięć",
  ustDzwiekiUI:"Dźwięki menu",dzwiekiUI_tak:"Wł.",dzwiekiUI_nie:"Wył.",
  ustDzwiekiUIOpis:"Krótkie punkowe odgłosy przy klikaniu, przewijaniu i wynikach. Śpiew i podkład grają niezależnie.",
  ustDzwiekiUIGlosnosc:"Głośność dźwięków menu",
  ustDzwiekiUIGlosnoscOpis:"Tylko odgłosy menu, wyników i okien.",
  ustGlosnosc:"Głośność",ustGlosnoscOpis:"Cała gra: śpiew żab, podkład, efekty i dźwięki menu.",
  ustGlosnoscPodklad:"Głośność podkładu",ustGlosnoscZaby:"Głośność żab",ustGlosnoscEfekty:"Głośność efektów",
  ustGlosnoscPodkladOpis:"Tylko partie, których nikt nie śpiewa, i nagranie piosenki z audio.",
  ustGlosnoscZabyOpis:"Tylko śpiew żab graczy i botów.",
  ustGlosnoscEfektyOpis:"Tylko odgłosy gry: metronom, rechot przy fałszu, kombo, fanfara i koło nagród.",
  ustPoglos:"Pogłos",ustPoglosOpis:"Żaby śpiewają jak w dużej sali. Działa na każdy instrument, także własny ze Studia.",
  ustEcho:"Echo",ustEchoOpis:"Każdy dźwięk wraca kilka razy coraz ciszej, jak w górach.",
  // język gry (js/jezyk.js, 2026-10-10); etykieta w obu językach, żeby znalazł ją ktoś, kto nie czyta bieżącego
  ustJezyk:"Język · Language",jezyk_pl:"Polski",jezyk_en:"English",gosc:"Gość",
  ustJezykOpis:"Gra mówi po polsku albo po angielsku. Zmiana przeładowuje grę.",
  // pakiety piosenek z audio (pakiet-piosenki.js, faza 3 konwertera audio → MIDI)
  zrodlo_piosenka:"paczka z audio",zrodlo_piosenka_midi:"paczka piosenki",
  ppUklad:"Układ miksu",ppWlasny:"{nazwa} (własny)",
  ppNazwa_karaoke:"Karaoke",ppNazwa_zabi_wokal:"Żabi wokal",ppNazwa_oryginal_w_tle:"Oryginał w tle",ppNazwa_czysty_ribbitbeat:"Czysty RibbitBeat",
  ppOpis_karaoke:"Nagranie bez wokalu, ścieżki MIDI milczą.",
  ppOpis_zabi_wokal:"Nagranie bez wokalu, a melodię wokalu grają żaby.",
  ppOpis_oryginal_w_tle:"Cały oryginał cicho w tle, a na nim wszystkie ścieżki MIDI.",
  ppOpis_czysty_ribbitbeat:"Bez nagrania: same ścieżki MIDI, jak w zwykłej piosence.",
  ppOpisWlasny:"Własny układ z Testownika: {zrodla}.",
  ppMelodia_spiew:"Melodię śpiewasz Ty.",ppMelodia_instrument:"Melodię grasz instrumentem żaby.",
  ppZrodlo_oryginal:"oryginał",ppZrodlo_vocals:"wokal",ppZrodlo_drums:"perkusja",ppZrodlo_bass:"bas",ppZrodlo_other:"reszta",
  ppZrodlo_midi_vocal:"MIDI wokal",ppZrodlo_midi_bass:"MIDI bas",ppZrodlo_midi_chords:"MIDI akordy",ppZrodlo_midi_drums:"MIDI perkusja",
  ppBrakStemow:"Paczka nie ma rozdzielonych ścieżek, więc gra cały oryginał.",
  ppTempoUwaga:"Tempo inne niż w nagraniu: nagranie przyspieszy albo zwolni i zabrzmi wyżej albo niżej.",
  ppAudioWczytuje:"Wczytuję nagranie… {procent}%",ppAudioGotowe:"Nagranie gotowe.",ppAudioBlad:"{powod} Zagraj bez tego źródła albo zmień układ miksu.",
  ppZapisBlad:"Nie zapisałem układu miksu: {powod}",
  pomocUkladyMiksu:"Piosenka z paczki z audio gra prawdziwe nagranie razem z nutami. Układ miksu mówi, które ścieżki nagrania i MIDI słychać oraz czy melodię śpiewasz sam, czy grają ją żaby.",
  // Sława: cztery tory sceny, drabinki 10–11 stopni (od 10-05), blok na wynikach, Discord (postepy.js v2, plan progresji §6–7; 2026-10-04)
  scenaTlo:"Tło",scenaKlawisze:"Klawisze",scenaEfekt:"Skin",scenaPlansza:"Plansza",
  scenaWstepSlawa:"Każdy skin wygląda zupełnie inaczej. Kolejne losujecie razem na kole nagród.",
  scenaWlascicielOpis:"Skin (przebranie żaby, ślad i iskry) wybierasz sam spośród odblokowanych przez całą ekipę. Planszę (tło, widownię i klawisze), którą widzą wszyscy, wybiera się w pasku „Plansza” nad kartami.",
  // plansza (10-10): jeden motyw dla całej gry z puli ekipy, czyli sławy wszystkich grających na tym komputerze
  planszaTytul:"Plansza (wspólna dla wszystkich)",
  planszaOpis:"Plansza to jeden motyw: tło, widownia i klawisze naraz. Kolejne sceny losuje cała ekipa na kole nagród, czyli wszyscy, którzy grają na tym komputerze.",
  ekranTor:"Tor {nr} z {n}",ekranZ:"z: {kto}",ekranSam:"sam na torze",ekranPrzeniesiony:"śpiewa z partią {partia} (za dużo partii)",
  ekranCaly:"cały ekran",ekranGora:"u góry",ekranDol:"na dole",ekranSrodek:"w środku",ekranLewo:"po lewej",ekranPrawo:"po prawej",
  ekranLG:"lewy górny róg",ekranPG:"prawy górny róg",ekranLD:"lewy dolny róg",ekranPD:"prawy dolny róg",
  // 10-17 wieczór: okno wyboru planszy po „Śpiewamy!” i losowanie przy różnych wyborach
  losPlanszyWynik:"Gramy na:",wpTytul:"Wybierz planszę!",wpOpis:"Każdy wybiera swoją: w bok przesuwasz kursor, swoim przyciskiem śpiewu wybierasz. Mysz klika. Gdy wybierzecie różne, gra wylosuje.",
  wpWybiera:"wybiera",wpLosujemy:"Różne plansze: losujemy!",wpZgodnie:"Wszyscy chcą tej samej!",wpWroc:"Wróć (Esc)",
  wpSter_ws:"A/D, Spacja",wpSter_strzalki:"←/→, Enter",wpSter_pad:"w bok, przycisk",wpSter_kapsel:"przechył, przycisk",wpSter_mysz:"klik",
  wpLosTytul:"Losujemy planszę!",wpLosOpis:"Nikt nie wybiera: gra bierze planszę ze wszystkich zdobytych.",
  // 10-21: kto wybiera planszę (trzy opcje w pasku „Plansza” i zdanie paska dla każdej z nich)
  planszaTrybEt:"Kto wybiera planszę",
  planszaTryb_wszyscy:"Wybierają wszyscy",planszaTryb_los:"Wybierz losową",planszaTryb_ta:"Ta plansza",
  planszaTrybOpis_wszyscy:"Po „Śpiewamy!” każdy wybiera swoją planszę, a przy różnych wyborach gra wylosuje.",
  planszaTrybOpis_los:"Po „Śpiewamy!” gra sama wylosuje planszę ze wszystkich zdobytych.",
  planszaTrybOpis_ta:"Gramy na planszy z tego paska: bez wybierania i bez losowania.",
  planszaZobacz:"Zobacz planszę",
  kasujTytul:"Kasowanie postępu",kasujUwaga:"Uwaga!",kasujOpis:"Ten przycisk usuwa CAŁY postęp na tym komputerze: sławę ekipy, plansze, skiny i instrumenty z koła wszystkich profili. Profile, ustawienia i własne instrumenty ze Studia zostają. Tego nie da się cofnąć.",
  kasujPrzytrzymaj:"Przytrzymaj 3 s, żeby wykasować postęp",kasujTrzymaj:"Trzymaj jeszcze {s} s…",kasujGotowe:"Postęp wykasowany. Gracie od zera.",
  planszaMini:"Plansza: {nazwa}",planszaOtworz:"Kliknij, żeby zobaczyć wszystkie motywy i podgląd",
  planszaSlawaDymek:"Sława ekipy: {ile}. Do motywu {n} brakuje {brak}.",scenaPlanszaSlawa:"sława ekipy: {ile}",
  planszaLosDymek:"Sława ekipy: {ile}. Do następnego losowania na kole brakuje {brak}.",
  scenaNaglowek:"{nazwa} · motyw {n} z {z}",scenaSlawaPasek:"{ile} / {prog}",
  scenaSlawaDymek:"Sława: {ile}. Do motywu {n} brakuje {brak}.",scenaSlawaSuma:"Sława: {ile}.",
  scenaSlawaPrestiz:"Sława: {ile}. Gwiazdki prestiżu: {n}, kolejna co {co} sławy.",
  scenaAuto:"Auto: zawsze najwyższy",
  kartaEfekt:"Skin",kartaKlawisze:"Klawisze",kartaAuto:"Auto",kartaScenaOtworz:"Kliknij, żeby zobaczyć wszystkie skiny i podgląd",
  kartaPoprzedni:"{tor}: poprzedni",kartaNastepny:"{tor}: następny",
  nieodkryte:"???",nieodkryteOpis:"Jeszcze nieodkryte. Zobaczysz, co to jest, gdy to zdobędziesz.",scenaNieodkryte:"Jeszcze nieodkryte",
  scenaNieodkryteOpis:"Jak wygląda, zobaczysz dopiero po zdobyciu.",kartaTloWspolne:"Tło jest wspólne dla wszystkich graczy.",
  kartaInstrumentOtworz:"Kliknij, żeby wybrać instrument z obrazków.",instrumentyTytul:"Instrumenty: {nazwa}",
  instrumentyWstep:"Kliknij instrument, żeby nim grać.",instrumentWybierz:"Graj na: {nazwa}",
  instrumentNieodkryty:"Tego instrumentu jeszcze nie macie. Kolejne losujecie na kole nagród.",instrumentyDoOdkrycia:"🔒 jeszcze {n} do odkrycia",
  scenaAutoOpis:"Włączone: gra sama bierze najwyższy odblokowany motyw. Kliknięty kafel przypina motyw na stałe.",
  scenaProg:"próg {n} sławy",scenaAlboOsiagniecie:"albo osiągnięcie „{nazwa}”",scenaKafelOpis:"Stopień {n}: {nazwa}",
  scenaZablokowanyProg:"Zablokowany: potrzeba {prog} sławy, masz {ile}.",
  scenaZKola:"z koła nagród",scenaZablokowanyKolo:"Jeszcze nieodkryty: wylosujecie go na kole nagród.",
  scenaZablokowanyKoloOs:"Jeszcze nieodkryty: wylosujecie go na kole nagród albo otworzy go osiągnięcie „{os}”: {opis}",
  scenaZablokowanyPlansza:"Zablokowany: ekipa potrzebuje {prog} sławy, ma {ile}.",
  scenaZablokowanyPlanszaOs:"Zablokowany: ekipa potrzebuje {prog} sławy (ma {ile}) albo ktoś zdobędzie osiągnięcie „{os}”: {opis}",
  scenaZablokowanyOs:"Zablokowany: potrzeba {prog} sławy (masz {ile}) albo osiągnięcia „{os}”: {opis}",
  scenaPodglad:"Podgląd na żywo",scenaPodgladTytul:"{nazwa} · motyw {n}",scenaWUzyciu:"W użyciu",scenaDoWyboru:"Do wyboru",
  scenaNagrodaSlawa:"+{n} sławy",scenaSkrotEfekt:"odblokowuje: {nazwa} · skin",scenaSkrotPlansza:"odblokowuje: {nazwa} · scena",
  paraSkin:"{nazwa} · skin",paraScena:"{nazwa} · scena",rodzajSkin:"skin",rodzajScena:"scena",
  slawaTytul:"Sława",slawaTor:"{tor} {n}",slawaMotyw:"Motyw {n}: {nazwa}",slawaEfekt:"Skin {n}: {nazwa}",slawaZysk:"+{n}",slawaDzien:"×{x} pierwsza gra dnia",slawaSeria:"×{x} seria {n} dni",
  slawaPlanszaNota:"pula ekipy: sława wszystkich, którzy grają na tym komputerze",
  slawaWspolny:"Wspólny postęp",slawaGraczy:"×{x} za {n} graczy",
  slawaWspolnaNota:"nagrody zbieracie razem: losowania i odblokowania są dla całej ekipy",
  slawaCel:"następny: {nazwa} · jeszcze ok. {n} {piosenek}",
  slawaOpis:"{tor}: motyw {n}, sława {ile}, w tej grze +{zysk}",slawaWiecej:"i jeszcze {n}",
  slawaFragment:"Fragment krótszy niż {n} nut: tym razem bez sławy.",
  slawaBezTrafien:"Bez trafionej nuty nie ma sławy.",
  awansTytul:"Awans",awansEfekt:"Nowy skin",awansEfektNr:"skin {n} z {z}",awansPlansza:"Nowa scena",awansMotywNr:"motyw {n} z {z}",
  awansPlanszaOpis:"Ekipa odblokowała dla wszystkich: {nazwa} · scena (motyw {n}).",
  awansWiecej:"i jeszcze {n}",awansOpis:"{kto}: {tor} wchodzi na motyw {n}, „{nazwa}”.",
  discordDymek:"Serwer RibbitFlip: #pomoc, #pochwal-się, #zestawy, #pomysły",
  discordMenuAria:"Discord: serwer RibbitFlip, otwiera się w przeglądarce",
  discordPochwal:"Pochwal się na Discordzie ↗",
  discordPochwalDymek:"Kanał #pochwal-się na serwerze RibbitFlip. Wklej tam skopiowany wynik.",
  kopiujWynik:"Kopiuj wynik",kopiujWynikDymek:"Kopiuje do schowka jedną linię z wynikiem, na przykład do wklejenia na Discordzie.",
  kopiujSzablon:"RibbitBeat · „{tytul}” · {kto} · {punkty} pkt · {gwiazdki}★ · trafione {procent} % · kombo {kombo}",
  skopiowano:"Skopiowano!",kopiujBlad:"Nie udało się skopiować wyniku: przeglądarka nie dała dostępu do schowka.",
  // pakiety piosenek z audio: błędy wczytania po polsku i blokada startu (pakiet-piosenki.js, poprawki po odbiorze)
  ppGrajBez:"Graj bez tego źródła",ppZmienUklad:"Zmień układ",ppStartBlokada:"Brakuje nagrania: {plik}",
  ppBladDekodowania:"Nie udało się odczytać pliku audio: {plik}.",ppBladBrak:"Brak pliku w pakiecie: {plik}.",
  ppBladDostep:"Aplikacja nie wpuściła gry do paczki ({plik}). Odśwież stronę gry.",
  ppBladSerwera:"Aplikacja nie odczytała pliku {plik}. Spróbuj ponownie po ponownym uruchomieniu RibbitFlipa.",
  ppBladJson:"Plik paczki jest uszkodzony: {plik}.",ppBladSiec:"Brak połączenia z aplikacją RibbitFlip ({plik}).",
  ppBladManifest:"Paczka {plik} ma niepoprawny opis (manifest). Zapisz go ponownie w Testowniku.",
  ppBladInny:"Nie udało się wczytać paczki: {plik}.",
  // zarządzanie profilami graczy (js/profile.js, okno „Profile”, 10-10); menuProfile = etykieta przycisku w menu głównym
  menuProfile:"Profile",menuProfileOpis:"Profile graczy: sława, skiny i ustawienia",
  profTytul:"Profile",profWstep:"Profil pamięta sławę, skiny i ustawienia gry. Konto to profil, którym grasz na tym komputerze (znacznik „grasz teraz”). Profil znika tylko wtedy, gdy go usuniesz. Jedyny wyjątek: przy ponad 200 profilach gra sprząta puste i nieprzypięte.",
  profNowy:"Nowy profil",profEksport:"Eksport",profEksportOpis:"Zapisuje do pliku JSON wszystkie profile i postępy planszy. Tablica wyników, własne utwory i ulubione zostają w tej przeglądarce.",
  profEksportBez:"Plik nie zawiera tablicy wyników, własnych utworów ani ulubionych: zostają w tej przeglądarce (tablicę i utwory zachowuje też wskazany folder biblioteki).",
  profOsiag:"Skin",profOsiagOpis:"Skin profilu: wybór i podgląd",profKolorEt:"Ulubiony kolor",
  profGraszTeraz:"grasz teraz",profGraszTerazOpis:"Aktywne konto na tym komputerze (zmienisz je plakietką „Grasz jako” w menu)",
  profImport:"Import",profImportOpis:"Wczytuje profile z pliku JSON zapisanego eksportem.",profLista:"Lista profili",
  profStatSlawa:"sława {n}",profStatMotywy:"skiny {n}/{z}",profStatOsiag:"osiągnięcia {n}/{z}",profStatGry:"gry: {n}",
  profOstatnio:"ostatnio {data}",profNigdy:"jeszcze bez gry",profGoscOpis:"dla graczy bez wpisanej nazwy",
  profPrzypiety:"Przypięty",profKapsel:"Kapsel",profKapselOpis:"Kapsel pamięta ten profil i przy dołączeniu od razu gra jako on.",
  profZmienNazwe:"Zmień nazwę",profKolor:"Kolor",profPrzypnij:"Przypnij",profOdepnij:"Odepnij",profWyzeruj:"Wyzeruj",profUsun:"Usuń",
  profAkcjaAria:"{akcja}: {nazwa}",profGoscBlokada:"Gościa nie da się przemianować ani usunąć.",
  profNowyTytul:"Nowy profil",profZmienTytul:"Nowa nazwa dla profilu {nazwa}",profNazwaEt:"Nazwa (najwyżej 18 znaków)",
  profZapisz:"Zapisz",profAnuluj:"Anuluj",
  profBladPusta:"Wpisz nazwę.",profBladZajeta:"Profil o tej nazwie już jest.",profBladGosc:"Gościa nie da się przemianować ani usunąć.",
  profBladBrak:"Tego profilu już nie ma.",profBladLimit:"Za dużo profili. Usuń któryś, zanim dodasz nowy.",profBladKolor:"Nieznany kolor.",
  profKolorTytul:"Ulubiony kolor: {nazwa}",profKolorOpis:"Gracz, który wybierze ten profil, dostanie ten kolor w składzie.",
  profKolorNr:"Kolor {n}",profKolorBrak:"Bez koloru",
  // awatary żab do kont (10-19, js/awatary.js): osobny zestaw, nie skiny do śpiewania
  profAwatar:"Awatar",awatarEt:"Awatar żaby",
  awatarOpis:"Ta żaba stanie przy nazwie konta. To osobny zestaw, nie skiny do śpiewania.",
  awatarTytul:"Awatar konta {nazwa}",awatarZmieniony:"Nowy awatar konta {nazwa}.",profBladAwatar:"Nieznany awatar.",
  awatary:{irokez:"Różowy irokez",liberty:"Kolce liberty",dredy:"Dredy",grzywka:"Grzywka na oko",
    czub:"Czarny czub",chusta:"Chusta w grochy",czapka:"Czapka z pomponem",okulary:"Ciemne okulary",
    kolczatka:"Kolczatka i ćwieki",agrafka:"Agrafka w uchu"},
  profWyzerujTytul:"Wyzerować postępy?",profWyzerujPytanie:"Profil „{nazwa}” straci sławę i motywy. Nazwa, kolor i przypięcie zostaną. Tego nie da się cofnąć.",
  profWyzerujTak:"Wyzeruj postępy",
  profUsunTytul:"Usunąć profil?",profUsunPytanie:"Profil „{nazwa}” zniknie razem ze sławą i motywami. Tego nie da się cofnąć.",
  profUsunTak:"Usuń profil",
  profUtworzono:"Dodano profil {nazwa}.",profNowaNazwa:"Profil nazywa się teraz {nazwa}.",profUsunieto:"Usunięto profil {nazwa}.",
  profWyzerowano:"Postępy profilu {nazwa} są wyzerowane.",profPrzypieto:"Przypięto profil {nazwa}.",profOdpieto:"Odpięto profil {nazwa}.",
  profKolorZmieniony:"Nowy kolor profilu {nazwa}.",profEksportGotowy:"Zapisano plik {plik}.",profEksportBlad:"Nie udało się zapisać pliku.",
  profImportTytul:"Import profili",profImportPlik:"Plik {plik}: profili w środku {n}.",
  profScal:"Scal",profScalOpis:"Dopisuje profile z pliku. Gdy nazwa się powtarza, zostaje profil z większą sławą.",
  profZastap:"Zastąp wszystko",profZastapOpis:"Usuwa obecne profile i wczytuje te z pliku. Tego nie da się cofnąć.",
  profRaportTytul:"Import gotowy",profRaportDodane:"Nowe profile: {n}",profRaportZastapione:"Zastąpione lepszymi z pliku: {n}",
  profRaportPominiete:"Zostały obecne (większy postęp): {n}",profRaportOdrzucone:"Pominięte uszkodzone wpisy: {n}",
  profRaportRazem:"Profili po imporcie: {n}",profOk:"OK",
  profImportBladJson:"To nie jest poprawny plik JSON.",profImportBladFormat:"To nie jest plik profili RibbitBeat.",
  profImportBladPusty:"W pliku nie ma żadnego poprawnego profilu.",profImportBladRozmiar:"Plik jest za duży.",
  profImportBladOdczyt:"Nie udało się odczytać pliku.",
  profWybierzTytul:"Kto gra?",profWybierzOpis:"Wybierz profil dla gracza {nazwa}. Sława i motywy z tej gry trafią do niego.",
  profTeraz:"teraz",profZarzadzaj:"Zarządzaj profilami",profTylkoLobby:"Profile otwierają się tylko w menu i lobby.",
  graczProfil:"Profil: {nazwa}. Kliknij, żeby wybrać inny."};
// Wersja angielska (js/jezyk.js wybiera język, js/jezyk-en.js niesie napisy): klucze RB_EN.T nadpisują polskie
// W MIEJSCU, więc cała gra czyta T jak dotąd. Polski słownik wyżej zostaje źródłem kluczy (test_gry_jezyk.py).
if(typeof RBJezyk!=="undefined"&&RBJezyk.en&&typeof RB_EN!=="undefined"&&RB_EN.T)Object.assign(T,RB_EN.T);
// Język liczb (separator dziesiętny i grupy tysięcy) zgodny z językiem gry.
const ZC_LOC=typeof RBJezyk!=="undefined"?RBJezyk.loc:"pl-PL";
function tt(klucz,zm){
  let s=String(T[klucz]==null?klucz:T[klucz]);
  // {powod}: komunikat z parsera MIDI, analizatora albo serwera, po polsku; RBJezyk.blad tłumaczy znane na angielski
  if(zm)for(const k in zm)s=s.split("{"+k+"}").join(String(k==="powod"&&typeof RBJezyk!=="undefined"?RBJezyk.blad(zm[k]):zm[k]));
  return s;
}
// Polska odmiana po liczbie: 1 partia, 2–4 partie, 5–21 partii, 22 partie…
function odmiana(n,f1,f2,f5){
  n=Math.abs(Math.trunc(n));
  if(n===1)return f1;
  const d=n%10,s=n%100;
  return (d>=2&&d<=4&&(s<12||s>14))?f2:f5;
}
const liczbaPartii=n=>n+" "+odmiana(n,T.partia1,T.partia2,T.partia5);

// =============================================================================================
// 2. CZYSTE FUNKCJE (bez DOM i bez stanu gry; tests/gry_zabi_chor_harness.mjs wycina je po nazwie)
//
// Punktacja:
//   celność klatki = clamp(1 − (|Δ półtonów| − 0,5) / 2, 0, 1): pełna w ±0,5 półtonu, zero przy ±2,5,
//   wynik nuty = średnia celności po CAŁYM czasie trwania nuty (bez śpiewu = 0) × 100,
//   oceny: ≥85 Czysto!, ≥60 Dobrze, ≥30 Prawie, niżej Fałsz; nuta bez jednej klatki śpiewu = Pudło,
//   kombo rośnie od nut ≥60, zeruje się na fałszu i pudle, „Prawie” go nie rusza,
//   mnożnik = min(4, 1 + ⌊kombo/4⌋) liczony już z tą nutą,
//   punkty = wynik × mnożnik × (0,6 + 0,4 × min(długość w ćwierćnutach, 4)),
//   premia za piosenkę bez nuty poniżej 60: 10% maksimum bez premii,
//   gwiazdki 1–5 od progów procentu maksimum.
// Dodatki chóru i kapsla:
//   „W jednym głosie!”: wszystkie żaby toru (co najmniej dwie) zamknęły nutę na „Czysto” → każda +50% punktów nuty,
//   wibrato: nuta ≥ 2 ćwierćnut, obrót kapsla ≥ 150°/s przez ≥ 40% jej drugiej połowy → punkty nuty ×1,25.
const ZC_PUNKTY={PELNA:.5,ZERO:2.5,CZYSTO:85,DOBRZE:60,PRAWIE:30,KOMBO_CO:4,MNOZNIK_MAKS:4,DLUGOSC_MAKS:4,
  PREMIA:.1,GWIAZDKI:[25,45,65,85],CHOR:.5,WIB_DLUGOSC:2,WIB_PROG:150,WIB_UDZIAL:.4,WIB_MNOZNIK:1.25};
const ZC_MAKS_TOROW=4,ZC_MAKS_GRACZY=8;
// Domyślny tryb śpiewu: false = pełny (śpiew przyciskiem), true = „żaba śpiewa sama”.
const DOMYSLNIE_SPIEWA_SAMA=false;
// Przyciąganie do nut (do 10-18 „Pomoc w trafianiu”): bliżej niż ZASIEG półtonu od nuty odchyłka maleje o SILA.
// Przyciąganie do nut także z daleka: suwak 0–4, POZIOMY[n] = {zasieg, sila, pas}; poziom 1 „Delikatne” to dawna
// pomoc co do bitu (ZASIEG/SILA zostają dla kalibracji i testów), od 2 w górę `pas` półtonu za zasięgiem, w którym
// przyciąganie słabnie do zera, więc żaba nie przeskakuje o kilka półtonów, kiedy wjeżdża w zasięg.
const ZC_POMOC={ZASIEG:.8,SILA:.5,POZIOMY:[null,{zasieg:.8,sila:.5,pas:0},{zasieg:1.5,sila:.65,pas:.5},
  {zasieg:2.5,sila:.8,pas:.75},{zasieg:4,sila:.95,pas:1}]};
// „Jesteś na nucie”: |Δ| ≤ 0,5 półtonu, czyli tam, gdzie celność klatki jest pełna.
const ZC_NA_NUCIE=.5;
// „Kum” w pauzie (recenzja 2): pierwszy od razu, potem co 0,5 s, po 2 s ciągłego gadania co 0,7 s
// (0,5 zamiast 0,45 z recenzji: z pierwszym „kum” od razu 0,45 dawało 5 „kum” w 2 s, czyli 2,5/s > 2,2/s).
const ZC_KUM={CO:.5,WOLNO:.7,ZMECZENIE:2};
// Aplauz kapslem na wynikach (recenzja 2): 5 s zbierania. Obrót kapsla poniżej PROG °/s to drżenie ręki,
// nie brawa; ruch myszy (px) i klawisze liczą się jako „stopnie obrotu”; obrót i mysz najwyżej MAKS °/s
// na gracza (dwa obroty na sekundę: szarpanie myszą nie przebije kapsla); PELNY °/s wszystkich razem to
// widownia na pełnych obrotach; NAGRODA (ćwierć obrotu) to minimum do „Największego aplauzu”.
const ZC_APLAUZ={SEK:5,PROG:30,MYSZ:.3,KLAWISZ:40,MAKS:720,PELNY:900,NAGRODA:90};
const ZC_DUCH_ALFA=.45;   // żaba-duch „Pokaż jak”

// Przechył → wysokość. ±zakres stopni rozpięte liniowo na [najniższa−2, najwyższa+2] półtonów partii,
// bez kwantyzacji (glissando jak w puzonie), z ucięciem na krańcach. UJEMNY pitch = wysoko, bo
// w aplikacji dodatni pitch spycha kursor w dół (padPoseXY w rf-22) i gra trzyma się tej konwencji.
function stopnieNaPolton(stopnie,zakres,lo,hi){
  const R=Math.max(1,+zakres||40),x=Math.max(-1,Math.min(1,(+stopnie||0)/R));
  const dol=lo-2,gora=hi+2;
  return dol+(gora-dol)*(1-x)/2;
}
// Odwrotność: półton → stopnie (boty, automat myszy w smoke).
function poltonNaStopnie(polton,zakres,lo,hi){
  const R=Math.max(1,+zakres||40),dol=lo-2,gora=hi+2;
  return Math.max(-R,Math.min(R,(1-2*(polton-dol)/(gora-dol))*R));
}
// Wygładzanie wykładnicze niezależne od liczby klatek: `tau` = stała czasowa w sekundach.
function wygladzEMA(poprzednia,cel,dt,tau){
  if(!(tau>0)||!Number.isFinite(poprzednia))return cel;
  return poprzednia+(cel-poprzednia)*(1-Math.exp(-Math.max(0,dt)/tau));
}
// Magnes: bliżej niż `zasieg` półtonu od nuty docelowej odchyłka maleje o `sila` (0..1). `pas` (półtony, opcjonalny,
// 10-18): za zasięgiem przyciąganie słabnie liniowo do zera, ciągle i rosnąco; bez pasa jak do 10-18.
function przyciagnijDoNuty(polton,cel,zasieg,sila,pas){
  if(cel==null)return polton;
  const d=polton-cel,a=Math.abs(d);
  if(a<zasieg)return cel+d*(1-sila);
  if(pas>0&&a<zasieg+pas){const w=zasieg*(1-sila)+(a-zasieg)/pas*(pas+zasieg*sila);return cel+(d<0?-w:w);}
  return polton;
}
// Poziom przyciągania 0–4 z ustawień; zapis sprzed 10-18 to przełącznik (true = 1 „Delikatne”, false = 0).
function poziomPrzyciagania(v){
  if(v===true)return 1;
  if(v===false||v==null)return 0;
  const n=Math.round(+v);
  return Number.isFinite(n)?Math.max(0,Math.min(ZC_POMOC.POZIOMY.length-1,n)):1;
}
// Opóźnienie wejścia gracza w ms. Kapsel nadaje przez radio (BLE) i jego ruch dochodzi ok. 150 ms po
// fakcie, więc czas gracza z kapslem przesuwa się o suwak „Opóźnienie kapsli”; mysz i klawiatura są
// natychmiast (0).
// Ślad bota Mistrz nie pasował do granego utworu, więc bot ma 0. Dotąd liczył się
// jak kapsel, „żeby nie miał nad nim przewagi”, tyle że przewagi i tak nie miał: robo-żaba celuje o te same
// 150 ms do przodu (celBota), więc w PUNKTACJI opóźnienie znosiło się co do klatki. Zostawało za to w RYSUNKU
// i w DŹWIĘKU, bo ślad, wypełnienie taśmy i śpiew szły po zegarze gry, a ocena po czasie gracza: żaba trzymała
// nutę idealnie, ale swój ślad rysowała o 150 ms (przy szybkim utworze o jedną trzecią ćwierćnuty) za nutą
// i tyle samo spóźniała się ze śpiewem. Bot nie nadaje przez radio — nie ma czego nadrabiać.
// Tego samego dnia ślad i wypełnienie taśmy KAŻDEGO gracza przeszły na jego czas (dopiszSlad, dopiszWypelnienie),
// więc u kapsla, gdzie te 150 ms jest prawdziwe, rysunek też leży na ocenianych nutach. Na żywo zostaje śpiew.
function offGracza(zrodlo,ust){
  return zrodlo==="kapsel"?(+(ust&&ust.opoznienie)||0):0;
}
function celnoscKlatki(dPolton){
  return Math.max(0,Math.min(1,1-(Math.abs(dPolton)-ZC_PUNKTY.PELNA)/(ZC_PUNKTY.ZERO-ZC_PUNKTY.PELNA)));
}
// Wysokość rechotu w pauzie: półtony przechyłu od środka zakresu partii, ucięte do ±18.
function wysokoscRechotu(polton,lo,hi){
  if(!Number.isFinite(+polton))return 0;   // brak wysokości = środek partii
  const d=+polton-((+lo||0)+(+hi||0))/2;
  return Math.max(-18,Math.min(18,Number.isFinite(d)?d:0));
}
// SKŁAD (runda 3): zapis do localStorage `ribbitflip.zabiChor.sklad` i odtworzenie przy wejściu do kroku 2.
// Zapis: źródło, id (kapsel, pad), nazwa i kolor tylko zmienione ręcznie, poziom bota, partia; najwyżej 8.
function zapiszSklad(gracze){
  const l=[];
  for(const g of Array.isArray(gracze)?gracze:[]){
    if(!g||typeof g.zrodlo!=="string"||l.length>=8)continue;
    const x={zrodlo:g.zrodlo,partia:Math.max(0,g.partia|0)};
    if(g.zrodlo==="kapsel"||g.zrodlo==="pad")x.id=String(g.id);
    if(g.zrodlo==="bot")x.poziom=g.poziom||null;
    if(g.nazwaWlasna&&g.nazwa)x.nazwa=String(g.nazwa).slice(0,18);
    if(g.kolorWlasny&&g.kolor)x.kolor=g.kolor;
    // 10-18 wieczór: własne pomoce gościa (bez imienia, nie kapsel) trzyma skład; gracza z profilem pamięta profil
    if(g.pomoce&&typeof g.pomoce==="object"&&!g.nazwaWlasna&&g.zrodlo!=="kapsel"&&g.zrodlo!=="bot")x.pomoce=pomoceZ(g.pomoce);
    l.push(x);
  }
  return {wersja:1,gracze:l};
}
// Odtworzenie: kogo da się dołączyć teraz. `dostepne` = {kapsle:[id], pady:[id], zajete:[id już w chórze]}.
// Kapsel i pad tylko podłączone, każde źródło (poza botami) raz, najwyżej `maks` (8) graczy razem z zajętymi;
// reszta trafia do `pominiete` z powodem (brak, zajete, limit).
function odtworzSklad(zapis,dostepne,maks){
  const d=dostepne||{},kapsle=new Set(d.kapsle||[]),pady=new Set(d.pady||[]),zajete=new Set(d.zajete||[]);
  const lim=(maks>0?maks:8)-zajete.size,gracze=[],pominiete=[];
  const lista=zapis&&zapis.wersja===1&&Array.isArray(zapis.gracze)?zapis.gracze:[];
  for(const x of lista){
    if(!x||typeof x.zrodlo!=="string")continue;
    let id=null;
    if(x.zrodlo==="mysz"||x.zrodlo==="ws"||x.zrodlo==="strzalki")id=x.zrodlo;
    else if(x.zrodlo==="kapsel"||x.zrodlo==="pad"){id=String(x.id||"");if(!(x.zrodlo==="kapsel"?kapsle:pady).has(id)){pominiete.push({zrodlo:x.zrodlo,id,powod:"brak"});continue;}}
    else if(x.zrodlo!=="bot")continue;
    if(id&&zajete.has(id)){pominiete.push({zrodlo:x.zrodlo,id,powod:"zajete"});continue;}
    if(gracze.length>=lim){pominiete.push({zrodlo:x.zrodlo,id,powod:"limit"});continue;}
    if(id)zajete.add(id);
    gracze.push({zrodlo:x.zrodlo,id,poziom:x.zrodlo==="bot"?(["latwy","sredni","trudny","mistrz"].includes(x.poziom)?x.poziom:"sredni"):null,
      nazwa:typeof x.nazwa==="string"&&x.nazwa.trim()?x.nazwa.trim().slice(0,18):null,
      kolor:/^#[0-9a-f]{6}$/i.test(String(x.kolor||""))?x.kolor:null,partia:Math.max(0,x.partia|0),
      pomoce:x.zrodlo!=="bot"&&x.pomoce&&typeof x.pomoce==="object"&&!Array.isArray(x.pomoce)?pomoceZ(x.pomoce):null});
  }
  return {gracze,pominiete};
}
// PILOT (runda 3): kapsel steruje fokusem jak pad. Przechył przód/tył = góra/dół, w bok = lewo/prawo: próg PROG°,
// wyjście z kierunku dopiero poniżej PROG−HISTEREZA° (martwa strefa), pierwszy krok od razu, potem powtarzanie po
// POWTORZ_PO s co POWTORZ_CO s. Przycisk: puszczony przed TRZYMAJ s = ok, trzymany TRZYMAJ s = wstecz (od razu,
// puszczenie potem już nic nie robi). `blokada`: naciśnięcie zużyte na dołączenie, jego puszczenie nie jest „ok”.
const ZC_PILOT={PROG:18,HISTEREZA:6,POWTORZ_PO:.35,POWTORZ_CO:.14,TRZYMAJ:.6};
function krokPilota(stan,poza,dt){
  const s=Object.assign({kier:null,czas:0,nast:0,wcisniety:false,trzyma:0,wstecz:false,blokada:false},stan||{});
  const z={gora:false,dol:false,lewo:false,prawo:false,ok:false,wstecz:false};
  const p=+(poza&&poza.pitch)||0,r=+(poza&&poza.roll)||0,ap=Math.abs(p),ar=Math.abs(r);
  const kp=p<0?"gora":"dol",kr=r<0?"lewo":"prawo";
  const prog=k=>s.kier===k?ZC_PILOT.PROG-ZC_PILOT.HISTEREZA:ZC_PILOT.PROG;
  const pion=ap>=prog(kp),poziom=ar>=prog(kr);
  const kier=pion&&poziom?(ap>=ar?kp:kr):pion?kp:poziom?kr:null;
  dt=Math.max(0,+dt||0);
  if(kier!==s.kier){s.kier=kier;s.czas=0;if(kier){z[kier]=true;s.nast=ZC_PILOT.POWTORZ_PO;}}
  else if(kier){s.czas+=dt;if(s.czas>=s.nast){z[kier]=true;s.nast+=ZC_PILOT.POWTORZ_CO;}}
  if(poza&&poza.przycisk){
    if(!s.wcisniety){s.wcisniety=true;s.trzyma=0;s.wstecz=false;}
    else s.trzyma+=dt;
    if(!s.blokada&&!s.wstecz&&s.trzyma>=ZC_PILOT.TRZYMAJ){s.wstecz=true;z.wstecz=true;}
  }else if(s.wcisniety){
    s.wcisniety=false;
    if(!s.blokada&&!s.wstecz)z.ok=true;
    s.blokada=false;s.wstecz=false;s.trzyma=0;
  }
  return {stan:s,zdarzenia:z};
}
// Klasa klatki śpiewu do wypełniania taśmy (runda 1, 10-03): 0 = na nucie (|Δ| ≤ 0,5, pełna celność, limonka),
// 1 = strefa „Prawie” (celność klatki ≥ progu oceny „Prawie”, bursztyn), 2 = poza (róż).
function klasaKlatki(dPolton){
  const a=celnoscKlatki(dPolton);
  return a>=1?0:a>=ZC_PUNKTY.PRAWIE/100?1:2;
}
// Lecące punkty: f = 0..1 życia (0,7 s) → przesunięcie w górę (px, wyhamowuje), alfa (gaśnie w drugiej połowie)
// i skala (krótkie „wskoczenie” 0,85 → 1 w pierwszych 15%). Ruch jednostronny, bez odbicia.
function lotPunktow(f,wysokosc){
  f=Math.max(0,Math.min(1,+f||0));const h=wysokosc>0?wysokosc:40;
  return {dy:-h*(1-(1-f)*(1-f)),alfa:f<.5?1:1-(f-.5)/.5,skala:.85+.15*Math.min(1,f/.15)};
}
// PIKTOGRAMY: ikony ustawień w kroku Rozgrywka, pucharu i okien gry. Od 10-15 filcowe (jak ikony RibbitFlipa):
// obrazki WebP 96×96 w web/assets/icons/gry, wygenerowane w stylu arkusza ikon panelu (filc, ścieg, obrys tuszem);
// wcześniej rysowane wektorowo (runda 3). Zwraca napis <img>, więc testuje się bez DOM. `wariant`: opcja segmentu,
// wartość suwaka albo instrument; suwaki mają kilka stopni (głośnik 0–3 fale, metronom, fale opóźnienia, luka ruchu).
const ZC_PIKTOGRAMY_UST={uklad:["auto","pasy","kolumny","siatka"],tory:["osobno","chor"],tryb:["klasyczny","plynny"],
  spiewaSama:[false,true],czasNaRuch:[0,50,100,150],grafika:["pelna","uproszczona","wydajnosc"],stylGrafik:["ilustracja","naszywka"],klatki:[60,120,0],autoJakosc:[true,false],glos:["trabka","ribbit","chor","smyczki","flet","organy","syntezator",
  "theremin","piano","epiano","guitar","bas","hawajska"],tempo:[50,100,200],opoznienie:[-100,150,300],zakres:[20,60],
  przyciaganie:[0,1,4],pokazJak:[true],odwroc:[true],klawiatura:["plynnie","szybko"],klawDoNuty:[true],instrument:["piano","guitar","flute","synth"],silnikMidi:["jeden","zespol","deta","chip"],podpowiedz:[true],
  dzwiekiUI:[true,false],pelnyEkran:[true],animacjaPostepu:[true],dzwiekiUIGlosnosc:[0,.3,.6,1],jezyk:["pl","en"],
  glosnosc:[0,.3,.6,1],glosnoscPodklad:[0,.3,.6,1],glosnoscZaby:[0,.3,.6,1],glosnoscEfekty:[0,.3,.6,1],poglos:[0,1],echo:[0,1]};
const ZC_IKONY_GRY="../assets/icons/gry/";
const ZC_IKONY_APP="../assets/icons/";
function plikPiktogramu(nazwa,wariant){
  const v=wariant,n=+v,jest=Number.isFinite(n);
  switch(nazwa){
    case "uklad":return "uklad-"+(["pasy","kolumny","siatka"].includes(v)?v:"auto");
    case "tory":return v==="chor"?"tory-chor":"tory-osobno";
    case "tryb":return v==="plynny"?"tryb-plynny":"tryb-klasyczny";
    case "spiewaSama":return v?"spiewa-tak":"spiewa-nie";
    case "stylGrafik":return v==="naszywka"?"styl-naszywka":"styl-ilustracja";
    case "grafika":return "grafika-"+(v==="wydajnosc"||v==="uproszczona"?v:"pelna");
    case "glos":case "instrument":
      if(/^w-/.test(String(v)))return "instr-syntezator";   // własny instrument ze Studia nie ma własnej ikony
      if(typeof Glos!=="undefined"&&Glos.jestInstrument&&Glos.jestInstrument(v))return "instr-"+v;   // 10-16: ikona każdego instrumentu
      return /^(trabka|flet|flute|ribbit|chor)$/.test(v)?"instr-dety":/^(smyczki|guitar)$/.test(v)?"instr-strunowy":
        /^(syntezator|theremin|synth)$/.test(v)?"instr-elektroniczny":"instr-klawisz";
    case "silnikMidi":return /^(zespol|orkiestra)$/.test(v)?"instr-strunowy":v==="deta"?"instr-dety":/^(chip|synty)$/.test(v)?"instr-syntezator":"instr-klawisz";
    case "tempo":{const t=jest?n:100;return t<85?"tempo-wolno":t<=130?"tempo-normalnie":"tempo-szybko";}
    case "opoznienie":{const t=jest?n:150;return "opoznienie-"+(t<=0?1:t<200?2:3);}
    case "czasNaRuch":{const pr=procentRuchu(v);return !pr?"ruch-0":pr<=75?"ruch-malo":"ruch-duzo";}
    case "zakres":return "zakres";
    case "pelnyEkran":return "uklad-auto";
    case "animacjaPostepu":return "puchar";
    case "przyciaganie":return "przyciaganie";
    case "pokazJak":return "pokaz-jak";
    case "odwroc":return "odwroc";
    case "klawiatura":return v==="donuty"?"klaw-do-nuty":v==="szybko"?"klaw-szybko":"klaw-plynnie";
    case "klawDoNuty":return "klaw-do-nuty";   // 10-18: „Skok do nuty” jako pomoc (wcześniej trzeci tryb klawiatury)
    case "podpowiedz":return "podpowiedz";
    case "dzwiekiUI":case "dzwiekiUIGlosnosc":case "glosnosc":case "glosnoscPodklad":case "glosnoscZaby":case "glosnoscEfekty":{
      const g=nazwa==="dzwiekiUI"?(v===false?0:.6):(jest?n:.6);
      return "glosnik-"+(g<=0?0:g<.35?1:g<.75?2:3);}
    case "poglos":return "poglos";   // 10-17: filcowa sala z falami dźwięku
    case "echo":return "echo";       // 10-17: góry z coraz mniejszymi nutkami
    case "klatki":return n===60?"klatki-60":n===120?"klatki-120":"klatki-bez";
    case "autoJakosc":return v===false?"grafika-pelna":"klatki-60";   // 10-17: włączona = pilnuje płynności, wyłączona = pełny obraz bez względu na klatki
    case "jezyk":return v==="en"?"jezyk-en":"jezyk-pl";
    case "puchar":return "puchar";
  }
  return null;
}
// Ikona filcowa jako napis <img> (dekoracja: opis niesie przycisk albo etykieta obok). `plik` = nazwa z
// web/assets/icons/gry, albo z „app/” ikona panelu RibbitFlipa (web/assets/icons, PNG).
function ikonaFilc(plik,klasa){
  const src=plik.startsWith("app/")?ZC_IKONY_APP+plik.slice(4)+".png":ZC_IKONY_GRY+plik+".webp";
  return '<img class="'+(klasa||"ikona-filc")+'" src="'+src+'" alt="" aria-hidden="true" draggable="false" decoding="async">';
}
function piktogram(nazwa,wariant){return ikonaFilc(plikPiktogramu(nazwa,wariant)||"puchar","piktogram");}
// Pierwsze zdanie opisu (pod opcją); pełny opis idzie do `title`.
function pierwszeZdanie(tekst){
  const t=String(tekst||"").trim(),m=/^(.+?[.!?])(\s|$)/.exec(t);
  return m?m[1]:t;
}
// Opis w Ustawieniach (11-19): widać pierwsze zdanie, a przycisk „?” rozwija resztę w miejscu. Wcześniej reszta była
// tylko w dymku `title`, którego nie zobaczy nikt bez myszy, a opisy grup stały w całości (do trzech linii każdy).
function opisZwijany(klasa,tekst){
  const pelny=String(tekst||"").trim(),krotki=pierwszeZdanie(pelny),p=h("p",klasa),t=h("span","opis-tekst",krotki);
  p.append(t);p.title=pelny;
  if(krotki.length<pelny.length){
    const b=h("button","opis-wiecej","?");b.type="button";b.setAttribute("aria-expanded","false");b.setAttribute("aria-label",T.opisWiecej);b.title=T.opisWiecej;
    b.onclick=e=>{e.stopPropagation();const r=b.getAttribute("aria-expanded")!=="true";b.setAttribute("aria-expanded",String(r));t.textContent=r?pelny:krotki;};
    p.append(" ",b);
  }
  return p;
}
// Nabijanie wyniku na karcie wyników: f = 0..1 czasu (900 ms) → wartość z wyhamowaniem (ease-out, sześcian),
// zaokrąglona, na końcu dokładnie v.
function nabijWartosc(v,f){
  f=Math.max(0,Math.min(1,+f||0));v=+v||0;
  return f>=1?v:Math.round(v*(1-Math.pow(1-f,3)));
}
// Gwiazdki w HUD na żywo (runda 2, ujednolicone w rundzie 4): TA SAMA droga co wyniki (procentSpiewu względem
// maks.razem i gwiazdki), tylko maksimum i premia za czystą piosenkę (`premiaCzysta`: maks.premia, gdy wszystkie
// zamknięte nuty są co najmniej „Dobrze”, inaczej 0) liczone proporcjonalnie do zamkniętych nut; po ostatniej
// nucie wynik jest identyczny z wierszem wyników. Przed `od` zamkniętymi nutami 0 (procent na początku skacze).
function gwiazdkiNaZywo(punkty,premiaChoru,premiaKlik,maksRazem,premiaCzysta,zamkniete,nut,od){
  const p=procentNaZywo(punkty,premiaChoru,premiaKlik,maksRazem,premiaCzysta,zamkniete,nut,od);
  if(p<0)return 0;
  let n=1;for(const prog of ZC_PUNKTY.GWIAZDKI)if(p>=prog)n++;
  return n;
}
// Czystość śpiewu na żywo w procentach (0–100), z której liczą się gwiazdki w HUD; -1 przed `od` zamkniętymi nutami.
function procentNaZywo(punkty,premiaChoru,premiaKlik,maksRazem,premiaCzysta,zamkniete,nut,od){
  if(!(zamkniete>=(od||8))||!(nut>0)||!(maksRazem>0))return -1;
  const u=Math.min(1,zamkniete/nut);
  return Math.max(0,Math.min(100,100*((+punkty||0)+(+premiaCzysta||0)*u-(+premiaChoru||0)-(+premiaKlik||0))/(maksRazem*u)));
}
// Pasek „do następnej gwiazdki” w żetonie HUD: 0..1 między progiem gwiazdki już zdobytej a następnej (1 = komplet).
function postepGwiazdki(procent){
  if(!(procent>=0))return 0;
  const pr=ZC_PUNKTY.GWIAZDKI;let i=0;while(i<pr.length&&procent>=pr[i])i++;
  if(i>=pr.length)return 1;
  const od=i?pr[i-1]:0;
  return Math.max(0,Math.min(1,(procent-od)/(pr[i]-od)));
}
function wynikNuty(sumaAcc,dlugosc){return dlugosc>0?Math.max(0,Math.min(100,100*sumaAcc/dlugosc)):0;}
function ocenaNuty(wynik,spiewal){
  if(!spiewal)return "pudlo";
  if(wynik>=ZC_PUNKTY.CZYSTO)return "czysto";
  if(wynik>=ZC_PUNKTY.DOBRZE)return "dobrze";
  if(wynik>=ZC_PUNKTY.PRAWIE)return "prawie";
  return "falsz";
}
function nastepneKombo(kombo,ocena){
  if(ocena==="czysto"||ocena==="dobrze")return kombo+1;
  if(ocena==="falsz"||ocena==="pudlo")return 0;
  return kombo;
}
function mnoznikKombo(kombo){
  return Math.min(ZC_PUNKTY.MNOZNIK_MAKS,1+Math.floor(Math.max(0,kombo)/ZC_PUNKTY.KOMBO_CO));
}
function punktyZaNute(wynik,mnoznik,dlugosc){
  return Math.round(wynik*mnoznik*(.6+.4*Math.min(Math.max(0,dlugosc),ZC_PUNKTY.DLUGOSC_MAKS)));
}
// Jedna zamknięta nuta: ocena, kombo po niej, mnożnik (już z nią), punkty i to, czy wibrato się liczy.
// `mr`: mnożnik czasu na ruch (mnoznikRuchu, domyślnie 1), ten sam w maksimum partii.
function rozliczNute(kombo,wynik,spiewal,dlugosc,wibrato,mr){
  const ocena=ocenaNuty(wynik,spiewal),noweKombo=nastepneKombo(kombo,ocena),mnoznik=mnoznikKombo(noweKombo);
  const wib=!!(wibrato&&spiewal);
  const punkty=Math.round(punktyZaNute(spiewal?wynik:0,mnoznik,dlugosc)*(wib?ZC_PUNKTY.WIB_MNOZNIK:1)*(mr>0?mr:1));
  return {ocena,kombo:noweKombo,mnoznik,punkty,wibrato:wib};
}
// „W jednym głosie!”: kiedy WSZYSTKIE żaby toru (co najmniej dwie) zamkną tę samą nutę na „Czysto”, każda
// dostaje premię równą temu ułamkowi punktów tej nuty. Zwraca 0 albo ZC_PUNKTY.CHOR (0,5).
function premiaChoru(oceny){
  return (oceny.length>=2&&oceny.every(o=>o==="czysto"))?ZC_PUNKTY.CHOR:0;
}
// Maksimum partii liczone z góry TĄ SAMĄ drogą co w grze (każda nuta na 100) plus premia za czystą
// piosenkę. Premia „W jednym głosie!” i klik w rytm zostają POZA maksimum: to nagrody za grę razem i za
// kapsel, więc procent i gwiazdki liczą się z punktów za sam śpiew (procentSpiewu), a te dodatki wchodzą
// tylko do punktów, rankingu i tablicy. Wibrato siedzi w punktach nuty (×1,25), więc podnosi procent, ale
// ucina się na 100. Do 10-03 klik i chór też podnosiły procent: bot z pudłem i 20 „Dobrze” miał 96 % i
// 5 gwiazdek, bo klik w rytm dokłada do 30 % punktów nuty.
function maksimumPunktow(nuty,mr){
  let kombo=0,suma=0;
  for(const n of nuty){const r=rozliczNute(kombo,100,true,n.d,false,mr);kombo=r.kombo;suma+=r.punkty;}
  const premia=Math.round(suma*ZC_PUNKTY.PREMIA);
  return {bezPremii:suma,premia,razem:suma+premia};
}
// Premia za czystą piosenkę: żadna nuta poniżej „Dobrze” (Prawie, Fałsz i Pudło ją zabierają).
function premiaKoncowa(oceny,maks){
  const zle=(oceny.prawie||0)+(oceny.falsz||0)+(oceny.pudlo||0),dobre=(oceny.czysto||0)+(oceny.dobrze||0);
  return (zle===0&&dobre>0)?maks.premia:0;
}
// Procent maksimum z samego śpiewu: punkty bez premii chóru i kliku w rytm, ucięte na 100.
function procentSpiewu(punkty,premiaChoru,premiaKlik,maks){
  if(!(maks>0))return 0;
  return Math.max(0,Math.min(100,100*((+punkty||0)-(+premiaChoru||0)-(+premiaKlik||0))/maks));
}
function gwiazdki(procent){
  let n=1;
  for(const p of ZC_PUNKTY.GWIAZDKI)if(procent>=p)n++;
  return n;
}
// Indeks nuty, pod którą jest chwila `b` (t ≤ b < t+d), albo −1. Nuty posortowane po t.
function indeksNutyPod(nuty,b){
  let lo=0,hi=nuty.length-1,k=-1;
  while(lo<=hi){const m=(lo+hi)>>1;if(nuty[m].t<=b){k=m;lo=m+1;}else hi=m-1;}
  return (k>=0&&b<nuty[k].t+nuty[k].d)?k:-1;
}
// Pierwsza nuta zaczynająca się później niż `b`, albo −1.
function indeksNastepnej(nuty,b){
  let lo=0,hi=nuty.length-1,k=-1;
  while(lo<=hi){const m=(lo+hi)>>1;if(nuty[m].t>b){k=m;hi=m-1;}else lo=m+1;}
  return k;
}
// Czy chwila `b` wypada w prawdziwej pauzie: pod linią nie ma nuty, przerwa między nutami trwa co
// najmniej ćwierćnutę, minęło 0,15 ćwierćnuty od końca poprzedniej, a do następnej zostało więcej niż
// 0,3 (wcześniejsze wciśnięcie to przygotowanie do śpiewu, nie gadanie). Odliczanie przed pierwszą nutą
// i czas po ostatniej to też pauza.
function wPauzie(nuty,b){
  if(indeksNutyPod(nuty,b)>=0)return false;
  const j=indeksNastepnej(nuty,b),nast=j>=0?nuty[j].t:Infinity;
  const pop=j>0?nuty[j-1]:(j<0&&nuty.length?nuty[nuty.length-1]:null);
  const koniecPop=pop?pop.t+pop.d:-Infinity;
  return nast-koniecPop>=1&&b>=koniecPop+.15&&b<=nast-.3;
}
// ---- Tryb nut: klasyczny (schodki) albo płynny (zjazdy między nutami) ----------------
// Zjazd (slide) nie jest cechą zapisaną przy nucie, tylko wynikiem reguły `dodajPrzejscia`: dostaje go
// nie każde legato, tylko dłuższa nuta przechodząca od razu w sąsiednią, a reszta to zwykłe skoki.
// Nuta ze zjazdem niesie `p` = {od, do}:
// od ułamka `od` swojej długości jej wysokość sunie z `m` do `do` (wysokość następnej nuty) po krzywej S
// (łagodny start i dojazd), a nie po prostej. Wszystko, co porównuje śpiew z nutą (celność klatki,
// pomoc w trafianiu, „na nucie”, cel bota, żaba-duch), pyta o cel w chwili `b`, nie o `m`.
function celNuty(n,b){
  if(!n.p)return n.m;
  const t0=n.t+n.d*n.p.od;if(b<=t0)return n.m;
  const u=Math.min(1,(b-t0)/Math.max(1e-9,n.d*(1-n.p.od)));
  return n.m+(n.p.do-n.m)*u*u*(3-2*u);
}
// Nuty piosenki, na których głos „skokowo” może stanąć w chwili `b` (glos.js `ustaw`, piąty argument; przejścia
// muszą obsługiwać nuty grane w grze): na nucie ona sama, a w jej zjeździe (`p`, tryb płynny) także nuta docelowa, więc zjazd
// E→G to jeden krok E→G, a nie atak na każdym półtonie po drodze; w przerwie krótszej niż ćwierćnuta poprzednia i następna
// (przejazd między nimi). Śpiew dalej niż ¾ półtonu od tych nut głos gra jako własny półton, więc fałsz dalej słychać.
// `out` = tablica gracza używana w kółko (gra woła to co klatkę). Czysta funkcja: harness liczy ją w Node.
function nutyGlosu(nuty,idx,b,out){
  out.length=0;
  if(idx>=0){const n=nuty[idx];out.push(n.m);if(n.p&&b>=n.t+n.d*n.p.od)out.push(n.p.do);return out;}
  const j=indeksNastepnej(nuty,b);
  if(j>0){const a=nuty[j-1],z=nuty[j];if(z.t-(a.t+a.d)<=1)out.push(a.p?a.p.do:a.m,z.m);}
  return out;
}
// Zjazd (płynna zmiana kończy nutę nieco wcześniej i w to miejsce wkłada płynne przesunięcie; przy
// przerwie między nutami bez zjazdu; zbite, następujące po sobie nuty są lepiej zorganizowane): KAŻDA nuta, po której
// następna zaczyna się od razu (przerwa ≤ MAKS_PRZERWA ćwierćnuty) na innej wysokości, kończy się zjazdem do następnej.
// Zjazd zajmuje koniec nuty: UDZIAL jej długości, nie mniej niż MIN_DL i nie więcej niż MAKS_DL ćwierćnuty, a nigdy więcej
// niż MAKS_CZESC nuty (pierwsza połowa zostaje płaska, żeby było widać, gdzie nuta się zaczyna). Przerwa = zwykły skok.
// Dawne ograniczenia (tylko nuty ≥ 1 ćwierćnuty, co druga w gamie, bez zjazdu w ozdobnik i przy skoku > 7 półtonów)
// zostawiały w zbitych frazach schodki przemieszane ze zjazdami. Długości i starty nut bez zmian, więc okna kliku jak dotąd.
const ZC_PRZEJSCIA={MAKS_PRZERWA:.1,MIN_INTERWAL:1,MAKS_INTERWAL:24,UDZIAL:.35,MIN_DL:.125,MAKS_DL:1,MAKS_CZESC:.5};
function dodajPrzejscia(nuty,o){
  o=Object.assign({},ZC_PRZEJSCIA,o||{});
  const out=[];
  for(let i=0;i<nuty.length;i++){
    const n=nuty[i],nx=nuty[i+1];
    if(!nx||n.p){out.push(n);continue;}
    const przerwa=nx.t-(n.t+n.d),int=Math.abs(nx.m-n.m);
    if(przerwa>o.MAKS_PRZERWA||przerwa<-1e-6||int<o.MIN_INTERWAL||int>o.MAKS_INTERWAL||!(n.d>0)){out.push(n);continue;}
    const dl=Math.min(n.d*o.MAKS_CZESC,Math.max(o.MIN_DL,Math.min(o.MAKS_DL,n.d*o.UDZIAL)));
    out.push(Object.assign({},n,{p:{od:1-dl/n.d,do:nx.m}}));
  }
  return out;
}
function zakresNut(nuty){
  let lo=Infinity,hi=-Infinity,suma=0;
  for(const n of nuty){const a=Math.min(n.m,n.p?n.p.do:n.m),b=Math.max(n.m,n.p?n.p.do:n.m);if(a<lo)lo=a;if(b>hi)hi=b;suma+=n.m;}
  if(!nuty.length){lo=60;hi=60;}
  return {lo,hi,srednia:nuty.length?suma/nuty.length:60};
}
// Partia do gry po ustawieniach: w trybie klasycznym oryginał (ten sam obiekt), w płynnym kopia z nutami po
// `dodajPrzejscia`, zakresem (rampa liczy się do zakresu) i `oryginal`. Używa jej startGry (tory), trudność
// w lobby i tablica wyników (płynny to inna konkurencja).
// CZAS NA RUCH (runda 4): przy dalekim skoku bez przerwy gracz nie zdąży przesunąć żaby, więc okno punktowania
// nuty A kończy się wcześniej (a gdy A jest za krótka, nuta B zaczyna się później). Potrzebny czas ruchu MT to TEN
// SAM model co w klasyfikatorze trudności (cechyPartii: prawo Fittsa ZC_TRUDNOSC.FITTS_A + FITTS_B·log2(|interwał|+1)),
// ucięty na MT_MAKS. Brakujący czas (MT − przerwa) zabiera się z końca A (najwyżej A_MAKS długości, A nie krótsza
// niż MIN_D ćwierćnuty), resztę z początku B (najwyżej B_MAKS). Interwał < MIN_INTERWAL i nuta ze zjazdem (`p`,
// tryb płynny) bez zmian. Nuta pamięta oryginał w t0/d0 (rysowanie ducha; podkład, podpowiedź i dźwięk grają
// pełne nuty). Wejście bez zmian. W luce nie ma punktów ani kary: po prostu nie ma tam okna żadnej nuty.
// SKALA (10-05): ustawienie „Czas na ruch” to procent 0–150 tego modelu (100 = model jak wyżej, 0 = bez czasu).
// Skala mnoży potrzebny czas MT (z sufitem), a powyżej 100 % także limity cięcia A i B, żeby dodatkowy czas
// miał skąd się wziąć. Mniej czasu = więcej punktów za każdą nutę (mnoznikRuchu), więcej czasu = mniej.
const ZC_RUCH={MIN_INTERWAL:3,MT_MAKS:.45,A_MAKS:.4,B_MAKS:.3,MIN_D:.125,MAKS_PROCENT:150,KROK:25};
// Procent czasu na ruch z ustawień: liczba 0–150 (krok 25), stary zapis true/false = 100/0.
function procentRuchu(v){
  if(v===true)return 100;
  if(v===false||v==null)return 0;
  const n=Math.round((+v||0)/ZC_RUCH.KROK)*ZC_RUCH.KROK;
  return Math.max(0,Math.min(ZC_RUCH.MAKS_PROCENT,n));
}
// Mnożnik punktów nuty za czas na ruch: 0 % → ×1,25, 100 % → ×1, 150 % → ×0,9 (liniowo w obu połówkach).
// Mnoży też maksimum partii, więc procent i gwiazdki się nie zmieniają: zmieniają się punkty i tablica.
function mnoznikRuchu(v){
  const p=procentRuchu(v);
  return Math.round((p<=100?1+(100-p)/400:1-(p-100)/500)*1e4)/1e4;
}
// Tempo gry z ustawień (do 200 %, wpływa na punktację): 50–200 %, krok 5.
// Mnożnik punktów nuty: 50 % → ×0,55, 75 % → ×0,78, 100 % → ×1,00, 150 % → ×1,35, 200 % → ×1,70 (liniowo w obu
// połówkach: poniżej 100 nachylenie 0,009/% (decyzja 10-10 runda 6b: wolne tempo nie może dawać więcej punktów),
// powyżej 0,007/%; do 0,01). Mnoży też maksimum partii (jak mnoznikRuchu), więc procent i gwiazdki dalej mówią tylko o śpiewie.
const ZC_TEMPO={MIN:50,MAKS:200,KROK:5};
function procentTempa(v){const n=Math.round((+v||100)/ZC_TEMPO.KROK)*ZC_TEMPO.KROK;return Math.max(ZC_TEMPO.MIN,Math.min(ZC_TEMPO.MAKS,n));}
function mnoznikTempa(v){
  const p=procentTempa(v);
  return Math.round((p<=100?1-(100-p)*.009:1+(p-100)*.007)*100)/100;
}
// POMOCE (opcje dostępności z uczciwym przeliczeniem punktów dla każdej kontrolki): każda pomoc mnoży punkty nuty, premie za klik i „w punkt” oraz maksimum partii, tak jak tempo i czas na ruch,
// więc procent i gwiazdki dalej liczą się z samego śpiewu, a zmieniają się punkty, ranking w grze i tablica.
// Mnożnik = odwrotność zysku punktów, który pomoc daje słabszym graczom: symulacja botów Łatwy i Średni na 39 partiach
// wbudowanych piosenek, 3 ziarna, punktacja tej gry (tools/ribbitbeat_pomoce.mjs, 10-18), średnia geometryczna
// obu poziomów. Silnym graczom pomoc prawie nic nie dodaje, więc tracą na niej punkty i nie mają po co jej włączać.
// Odniesienie ×1 = ustawienia domyślne (przyciąganie „Delikatne”, śpiew przyciskiem), dlatego wyłączone przyciąganie
// dostaje drobną premię. `klawDoNuty` liczy się tylko graczom na klawiaturze. Podpowiedzi melodii bot nie słyszy:
// ×0,95 to ocena, nie pomiar. „Pokaż jak” znika po dwóch taktach pierwszej piosenki, więc nie zmienia punktów.
// Zysk z pomiaru (Łatwy / Średni, boty po kalibracji D-9 z 10-18): przyciąganie 0 ×0,972/×0,977, 2 ×1,288/×1,195,
// 3 ×1,926/×1,492, 4 ×2,612/×1,665, sama ×1,413/×1,106, klawiatura „do nuty” (ręka bez rozstroju i drżenia) ×1,501/×1,307.
// Pomoce mnożą się; przy kilku naraz iloczyn odbiega od zmierzonego zysku zestawu o mniej niż 11 % (Mocne + sama: ×0,47
// zamiast ×0,44). Po zmianie punktacji albo botów: `node tools/ribbitbeat_pomoce.mjs` pokazuje propozycję obok tych liczb.
const ZC_MN_POMOCY={przyciaganie:[1.03,1,.81,.59,.48],spiewaSama:.8,klawDoNuty:.71,podpowiedz:.95};
const klawiaturowy=zrodlo=>zrodlo==="ws"||zrodlo==="strzalki";
function mnoznikPomocy(ust,klaw){
  const u=ust||{},M=ZC_MN_POMOCY;
  let m=M.przyciaganie[poziomPrzyciagania(u.przyciaganie)];
  if(u.spiewaSama)m*=M.spiewaSama;
  if(u.podpowiedz)m*=M.podpowiedz;
  if(klaw&&u.klawDoNuty)m*=M.klawDoNuty;
  return Math.round(m*100)/100;
}
// Mnożnik punktów całej konfiguracji (czas na ruch × tempo × pomoce), ten sam co G.mnPunktow / g.mnPunktow w grze.
function mnoznikPunktowUst(ust,klaw){
  return Math.round(mnoznikRuchu(ust.czasNaRuch)*mnoznikTempa(ust.tempo)*mnoznikPomocy(ust,klaw)*1e4)/1e4;
}
// POMOCE GRACZA (10-18 wieczór, zlecenie: w jednej grze dziecko gra z pomocami, a dorosły bez, i ranking zostaje uczciwy):
// przyciąganie, „śpiewa sama” i skok do nuty ustawia się też osobno na karcie gracza (okno „Pomoce”). g.pomoce = null
// (jak w ustawieniach gry, S.ust; tak grają też boty) albo własny wybór {przyciaganie 0–4, spiewaSama, klawDoNuty}.
// Podpowiedź melodii słyszą wszyscy, więc zostaje wspólna (S.ust.podpowiedz) i wchodzi do mnożnika każdego gracza.
// Mnożnik gracza liczy mnoznikPomocy z jego pomocy (te same ZC_MN_POMOCY), a procent i gwiazdki dalej z samego śpiewu.
function pomoceZ(u){
  u=u||{};
  return {przyciaganie:poziomPrzyciagania(u.przyciaganie),spiewaSama:!!u.spiewaSama,klawDoNuty:!!u.klawDoNuty};
}
function pomoceGraczaZ(wlasne,ust){return pomoceZ(wlasne&&typeof wlasne==="object"?wlasne:ust);}
// Ustawienia, z którymi gra gracz: wspólne (tempo, czas na ruch, podpowiedź) i jego pomoce; do mnożnika i do tablicy.
function ustGracza(ust,wlasne){return Object.assign({},ust,pomoceGraczaZ(wlasne,ust));}
// Wybór gracza w profilu (Postepy.ustawienia: płaskie klucze obok ustawień konta, bez nowej wersji zapisu):
// pomocPrzyciaganie 0–4, pomocSpiewaSama, pomocKlawDoNuty; null albo brak = jak w ustawieniach gry. Stary przełącznik
// przyciągania (true/false sprzed poziomów) czyta się jak poziom 1/0, tekst jak liczbę.
function pomoceDoProfilu(p){
  const w=p&&typeof p==="object"?pomoceZ(p):null;
  return {pomocPrzyciaganie:w?w.przyciaganie:null,pomocSpiewaSama:w?w.spiewaSama:null,pomocKlawDoNuty:w?w.klawDoNuty:null};
}
function pomoceZProfilu(u){
  if(!u||typeof u!=="object"||u.pomocPrzyciaganie==null)return null;
  return pomoceZ({przyciaganie:u.pomocPrzyciaganie,spiewaSama:u.pomocSpiewaSama,klawDoNuty:u.pomocKlawDoNuty});
}
// Krótki opis pomocy (dymek kafla, okno „Pomoce”): „przyciąganie mocne · żaba śpiewa sama · skok do nuty”.
function opisPomocy(p,klaw){
  const pm=p.przyciaganie;
  const cz=[pm===1?T.konfPomoc:pm?tt("konfPrzyciaganie",{poziom:String(T["przyciaganie_"+pm]||pm).toLocaleLowerCase()}):T.konfBezPomocy,
    p.spiewaSama?T.konfLatwy:T.konfPelny];
  if(klaw&&p.klawDoNuty)cz.push(T.konfKlawDoNuty);
  return cz.join(" · ");
}
// POZIOMY GRY (10-18): gotowe zestawy kontrolek, które zmieniają trudność albo punkty. Zestaw jest wybrany, kiedy
// wszystkie jego klucze mają te wartości; każda inna kombinacja to „Własne” (ostatnia zapamiętana w S.ust.presetWlasny).
const ZC_KLUCZE_PRESETU=["przyciaganie","spiewaSama","klawDoNuty","podpowiedz","pokazJak","czasNaRuch","tempo"];
const ZC_PRESETY=[
  {k:"luz",ikona:"spiewa-tak",ust:{przyciaganie:3,spiewaSama:true,klawDoNuty:true,podpowiedz:true,pokazJak:true,czasNaRuch:150,tempo:100}},
  {k:"normalny",ikona:"graj",ust:{przyciaganie:1,spiewaSama:false,klawDoNuty:false,podpowiedz:false,pokazJak:true,czasNaRuch:100,tempo:100}},
  {k:"wyzwanie",ikona:"ruch-malo",ust:{przyciaganie:0,spiewaSama:false,klawDoNuty:false,podpowiedz:false,pokazJak:false,czasNaRuch:50,tempo:100}},
  {k:"mistrz",ikona:"puchar",ust:{przyciaganie:0,spiewaSama:false,klawDoNuty:false,podpowiedz:false,pokazJak:false,czasNaRuch:0,tempo:125}}];
function presetUstawien(ust){
  const u=ust||{},rowne=(a,b)=>a===b||(typeof a==="number"&&typeof b==="number"&&Math.abs(a-b)<1e-9);
  for(const p of ZC_PRESETY)if(ZC_KLUCZE_PRESETU.every(k=>rowne(p.ust[k],k==="przyciaganie"?poziomPrzyciagania(u[k]):u[k])))return p.k;
  return null;
}
function dodajCzasNaRuch(nuty,sPerBeat,o){
  o=Object.assign({},ZC_RUCH,o||{});
  const sk=o.skala==null?1:Math.max(0,+o.skala||0),luz=Math.max(1,sk);
  if(!(sk>0))return (Array.isArray(nuty)?nuty:[]).map(n=>Object.assign({},n));
  const s=Math.max(1e-3,+sPerBeat||.5),out=(Array.isArray(nuty)?nuty:[]).map(n=>Object.assign({},n));
  const aMaks=Math.min(.6,o.A_MAKS*luz),bMaks=Math.min(.45,o.B_MAKS*luz);
  for(let i=0;i<out.length-1;i++){
    const a=out[i],b=out[i+1],J=Math.abs(b.m-a.m);
    if(a.p||J<o.MIN_INTERWAL)continue;
    const mt=sk*Math.min(o.MT_MAKS,ZC_TRUDNOSC.FITTS_A+ZC_TRUDNOSC.FITTS_B*Math.log2(J+1));
    let brak=(mt-(b.t-(a.t+a.d))*s)/s;   // w ćwierćnutach
    if(brak<=1e-9)continue;
    const zA=Math.min(brak,Math.max(0,Math.min(a.d*aMaks,a.d-o.MIN_D)));
    if(zA>1e-9){if(a.t0==null){a.t0=a.t;a.d0=a.d;}a.d-=zA;brak-=zA;}
    if(brak>1e-9){
      const zB=Math.min(brak,Math.max(0,Math.min(b.d*bMaks,b.d-o.MIN_D)));
      if(zB>1e-9){if(b.t0==null){b.t0=b.t;b.d0=b.d;}b.t+=zB;b.d-=zB;}
    }
  }
  return out;
}
// Partia do gry: tryb płynny (zjazdy) i czas na ruch (ust.czasNaRuch: procent 0–150, potrzebne tempo `bpm`).
function przygotujPartie(x,ust,bpm){
  if(!x||!ust)return x;
  let nuty=x.nuty,zmiana=false;
  if(ust.tryb==="plynny"){const n2=dodajPrzejscia(nuty);if(n2.some(n=>n.p)){nuty=n2;zmiana=true;}}
  const pr=procentRuchu(ust.czasNaRuch);
  // W schodkach liczenie punktów bierze poprawkę na przejście: w schodkach czas na przejście dostaje KAŻDA zmiana
  // wysokości (od 1 półtonu), w płynnym jak dotąd tylko dalekie skoki (bliskie zjeżdżają po łuku)
  if(pr>0&&bpm>0){const n3=dodajCzasNaRuch(nuty,60/bpm,ust.tryb==="plynny"?{skala:pr/100}:{skala:pr/100,MIN_INTERWAL:1});if(n3.some(n=>n.d0!=null)){nuty=n3;zmiana=true;}}
  if(!zmiana)return x;
  return Object.assign({},x,{nuty},zakresNut(nuty),{oryginal:x});
}
// Rozlicza jedną klatkę gracza: odcinek [b0, b1] JEGO czasu (w ćwierćnutach, już po opóźnieniu
// wejścia) na nutach partii od indeksu `i`. Celność dolicza się tylko za część klatki, która leży na
// nucie, więc wynik nie zależy od liczby klatek na sekundę. `wib` = kapsel kręci się teraz dość szybko
// na wibrato; liczy się tylko w drugiej połowie długich nut. Nuta, której koniec minął, zostaje
// zamknięta i wraca w `zamkniete`. `ak` = akumulator bieżącej nuty {sumaAcc, spiewal, wib}.
function klatkaNaNutach(nuty,i,ak,b0,b1,spiewa,polton,wib){
  const zamkniete=[];
  while(i<nuty.length){
    const n=nuty[i],ns=n.t,ne=n.t+n.d;
    if(ns>=b1)break;
    const nakladka=Math.min(b1,ne)-Math.max(b0,ns);
    if(nakladka>0&&spiewa){
      ak.sumaAcc+=celnoscKlatki(polton-celNuty(n,(Math.max(b0,ns)+Math.min(b1,ne))/2))*nakladka;ak.spiewal=true;
      if(wib&&n.d>=ZC_PUNKTY.WIB_DLUGOSC){
        const wDrugiej=Math.min(b1,ne)-Math.max(b0,ns+n.d/2);
        if(wDrugiej>0)ak.wib=(ak.wib||0)+wDrugiej;
      }
    }
    if(b1<ne)break;
    const wibrato=n.d>=ZC_PUNKTY.WIB_DLUGOSC&&(ak.wib||0)>=ZC_PUNKTY.WIB_UDZIAL*n.d/2;
    zamkniete.push({idx:i,wynik:wynikNuty(ak.sumaAcc,n.d),spiewal:ak.spiewal,wibrato});
    ak.sumaAcc=0;ak.spiewal=false;ak.wib=0;i++;
  }
  return {i,zamkniete};
}
// Celność gracza w %: średnia wyników wszystkich nut partii (pudło = 0).
function celnoscGracza(wyniki,liczbaNut){
  if(!liczbaNut)return 0;
  let s=0;
  for(let i=0;i<liczbaNut;i++)s+=(wyniki[i]&&wyniki[i].wynik)||0;
  return s/liczbaNut;
}
// Tory: jeden na każdą WYBRANĄ partię, najwyżej `maks`. Gracze tej samej partii dzielą tor.
// Gdy wybranych partii jest więcej, tor dostają najliczniejsze (remis: niższy indeks, czyli melodia
// pierwsza), a reszta śpiewa z melodią (albo z najliczniejszą, jeśli melodii nikt nie wybrał).
// Tory od najwyższej partii u góry, jak głosy w chórze. Partie bez śpiewaka idą do podkładu.
//   wybory: [{id, partia}] w kolejności dołączenia, partie: [{srednia}] (indeks 0 = melodia)
function podzialNaTory(wybory,partie,maks){
  const ok=p=>Number.isInteger(p)&&p>=0&&p<partie.length;
  const czyste=wybory.map(w=>({id:w.id,partia:ok(w.partia)?w.partia:0}));
  const ile=new Map();
  for(const w of czyste)ile.set(w.partia,(ile.get(w.partia)||0)+1);
  const kolejnosc=[...ile.keys()].sort((a,b)=>(ile.get(b)-ile.get(a))||(a-b));
  const zTorem=new Set(kolejnosc.slice(0,Math.max(1,maks)));
  const przyjmuje=zTorem.has(0)?0:kolejnosc[0];
  const tory=new Map(),przeniesieni=[];
  for(const w of czyste){
    let p=w.partia;
    if(!zTorem.has(p)){p=przyjmuje;przeniesieni.push(w.id);}
    if(!tory.has(p))tory.set(p,[]);
    tory.get(p).push(w.id);
  }
  const lista=[...tory.entries()].map(([partia,gracze])=>({partia,gracze}))
    .sort((a,b)=>(partie[b.partia].srednia-partie[a.partia].srednia)||(a.partia-b.partia));
  const bezSpiewu=partie.map((_,i)=>i).filter(i=>!tory.has(i));
  return {tory:lista,przeniesieni,bezSpiewu};
}
// Rząd chóru na jednym torze: lider siedzi na linii „teraz”, reszta w lewo, w pasie przeszłości szerokim
// na `pas` px. Żaba maleje przy ≥ 3 (×0,85) i ≥ 5 (×0,7) śpiewakach, a jeśli rząd i tak się nie mieści,
// maleje dalej, aż krok wyniesie co najmniej 0,8 żaby (najwyżej 1,05: żaby nie stoją osobno jak na apelu).
function ukladChoru(n,zaba,pas){
  if(n<2)return {zaba,krok:0};
  let z=zaba*(n>=5?.7:n>=3?.85:1);
  z=Math.min(z,pas/(.8*(n-1)+.5));
  const krok=Math.max(.8*z,Math.min(1.05*z,(pas-z/2)/(n-1)));
  return {zaba:z,krok};
}
// Tryb „każdy swój” (2026-10-03): każdy gracz dostaje własny tor, także przy tej samej partii, o ile graczy
// jest najwyżej `maks`; przy większej liczbie wraca podział chórem (podzialNaTory). Kolejność torów jak
// w chórze (najwyższa partia u góry), przy tej samej partii kolejność dołączenia.
function podzialNaToryOsobno(wybory,partie,maks){
  if(wybory.length>maks)return podzialNaTory(wybory,partie,maks);
  const ok=p=>Number.isInteger(p)&&p>=0&&p<partie.length;
  const lista=wybory.map((w,i)=>({partia:ok(w.partia)?w.partia:0,gracze:[w.id],i}))
    .sort((a,b)=>(partie[b.partia].srednia-partie[a.partia].srednia)||(a.partia-b.partia)||(a.i-b.i))
    .map(({partia,gracze})=>({partia,gracze}));
  const zajete=new Set(lista.map(t=>t.partia));
  return {tory:lista,przeniesieni:[],bezSpiewu:partie.map((_,i)=>i).filter(i=>!zajete.has(i))};
}
// Podział obszaru gry na `n` torów. uklad: auto | pasy | kolumny | siatka. „auto”: 1–2 tory pasy, 3 kolumny,
// 4 siatka 2×2. Siatka przy 3 torach: dwa u góry, jeden szeroki na dole; przy 2 to pasy. Zwraca prostokąty
// w kolejności torów (siatka czyta się wierszami: lewy górny, prawy górny, lewy dolny, prawy dolny).
function ukladSiatki(n,uklad,obszar,odst){
  const {x,y,w,h}=obszar;
  if(n<=1)return [{x,y,w,h}];
  const tryb=uklad==="pasy"||uklad==="kolumny"||uklad==="siatka"?uklad:(n===2?"pasy":n===3?"kolumny":"siatka");
  const r=(rx,ry,rw,rh)=>({x:Math.round(rx),y:Math.round(ry),w:Math.round(rw),h:Math.round(rh)});
  if(tryb==="kolumny"){
    const cw=(w-odst*(n-1))/n;
    return Array.from({length:n},(_,i)=>r(x+i*(cw+odst),y,cw,h));
  }
  if(tryb==="siatka"&&n>=3){
    const rh=(h-odst)/2,cw=(w-odst)/2,out=[];
    for(let i=0;i<n;i++){
      const wiersz=Math.floor(i/2),kol=i%2,ostatniSam=i===n-1&&kol===0;
      out.push(r(x+kol*(cw+odst),y+wiersz*(rh+odst),ostatniSam?w:cw,rh));
    }
    return out;
  }
  const rh=(h-odst*(n-1))/n;
  return Array.from({length:n},(_,i)=>r(x,y+i*(rh+odst),w,rh));
}
// Podkład nie gra tym samym instrumentem co któryś gracz (zlewałby się z nim): wtedy bierze pierwszy wolny.
// Nazwy instrumentów gracza i podkładu różnią się tylko przy czterech brzmieniach (organy ↔ organ itd.).
const ZC_INSTR_NA_PODKLAD={organy:"organ",flet:"flute",smyczki:"strings",syntezator:"synth"};
const ZC_PODKLAD_ZAPAS=["piano","epiano","marimba","organ","strings","guitar","musicbox","synth","flute","chip"];
// SILNIK MIDI (11-19): charakter podkładu. „jeden” = jak dotąd, wszystkie partie jednym „Instrumentem podkładu”.
// Pozostałe to zestawy trzech barw: nuta poniżej ZC_SILNIK_BAS gra barwą basu, od ZC_SILNIK_GORA barwą góry,
// reszta środkiem (jak dzielona klawiatura), więc nawet jedna ścieżka akompaniamentu brzmi jak mały zespół.
// Barwy buduje voice() w glos.js. Podpowiedź nut (flet) i głosy żab zostają bez zmian. Nowy zestaw = wpis tutaj
// i nazwa w T.silnikiMidi (PL i EN).
// „plik” = „Jak w pliku”: każda ścieżka gra barwą najbliższą instrumentowi zapisanemu w pliku MIDI (program
// General MIDI → barwaGM), a ścieżka bez tej informacji (utwory wbudowane, uproszczenia) zwykłym instrumentem podkładu.
// Każdy silnik poza „jeden” gra też perkusję z pliku (kanał 10, p.perkusja), jeśli plik ją ma.
const ZC_SILNIKI_MIDI={jeden:null,plik:{plik:true},
  zespol:{bas:"bass",srodek:"epiano",gora:"guitar"},orkiestra:{bas:"cello",srodek:"strings",gora:"flute"},
  deta:{bas:"tuba",srodek:"brass",gora:"flute"},chip:{bas:"tribass",srodek:"pulse",gora:"chip"},
  pozytywka:{bas:"marimba",srodek:"musicbox",gora:"bells"},synty:{bas:"synbass",srodek:"pad",gora:"synth"}};
const ZC_SILNIK_BAS=50,ZC_SILNIK_GORA=74;   // numery nut MIDI: poniżej D3 bas, od D5 góra
const rolaWSilniku=m=>m<ZC_SILNIK_BAS?"bas":m>=ZC_SILNIK_GORA?"gora":"srodek";
// Przyciszenie barw, które w voice() są wyraźnie głośniejsze od reszty (dawne barwy podkładu różnią się nawet o 9 dB).
// Działa tylko w silnikach innych niż „jeden”: tam barwy mają grać równo obok siebie, a „Jeden instrument” ma
// brzmieć jak dotąd. Pomiar: C:/tmp/rb-start-261118/barwy.js.
const ZC_BARWA_CISZEJ={epiano:.5,guitar:.65,flute:.7,musicbox:.55};
const ZC_PERKUSJA_POZIOM=.5;   // perkusja z pliku względem pełnego poziomu Glos.bebny (strojonego pod dżingle)
// Program General MIDI (0–127) → barwa voice(). Rodziny po osiem programów, wyjątki w środku rodzin osobno.
function barwaGM(pr){
  pr=pr|0;
  if(pr<4)return "piano";if(pr<6||pr===7||pr===11)return "epiano";if(pr===6)return "guitar";
  if(pr===10)return "musicbox";if(pr===12||pr===13)return "marimba";if(pr<16)return pr===15?"guitar":"bells";
  if(pr<24)return "organ";if(pr<32)return "guitar";if(pr<40)return pr>=38?"synbass":"bass";
  if(pr<48)return pr<42?"strings":pr<44?"cello":pr===44?"strings":pr===47?"bass":"guitar";
  if(pr<56)return pr<52?"strings":pr===55?"brass":"pad";
  if(pr<64)return pr===58?"tuba":"brass";
  if(pr<72)return pr<68?"brass":pr===70?"cello":"flute";
  if(pr<80)return "flute";if(pr<88)return pr===80?"chip":"synth";if(pr<104)return "pad";
  if(pr<112)return pr===108?"marimba":pr===109?"organ":pr===110?"strings":pr===111?"flute":"guitar";
  if(pr<120)return pr===112?"bells":"marimba";
  return "pad";
}
const silnikGraPerkusje=()=>!!ZC_SILNIKI_MIDI[S.ust.silnikMidi];
// `program` = instrument nuty albo partii z pliku (null, gdy plik go nie podaje)
function barwaPodkladu(instr,m,program){
  const s=ZC_SILNIKI_MIDI[S.ust.silnikMidi];
  if(!s)return instr;
  if(s.plik)return program==null?instr:barwaGM(program);
  return s[rolaWSilniku(m)];
}
// poziom nuty podkładu po przyciszeniu głośnej barwy (bez silnika bez zmian; `poziom` może być pusty = pełny)
function poziomPodkladu(poziom,m,program){
  if(!ZC_SILNIKI_MIDI[S.ust.silnikMidi])return poziom;
  const c=ZC_BARWA_CISZEJ[barwaPodkladu("",m,program)];
  return c==null?poziom:(poziom==null?1:poziom)*c;
}
function instrumentPodkladu(wybrany,instrumentyGraczy){
  const zajete=new Set(instrumentyGraczy.map(i=>ZC_INSTR_NA_PODKLAD[i]||i));
  if(!zajete.has(wybrany))return wybrany;
  return ZC_PODKLAD_ZAPAS.find(i=>!zajete.has(i))||wybrany;
}
// Dymek do scalenia: ostatni dymek tego samego toru i rodzaju, powstały najwyżej `okno` ms temu, albo null.
function znajdzDoScalenia(dymki,tor,rodzaj,teraz,okno){
  for(let i=dymki.length-1;i>=0;i--){
    const d=dymki[i];
    if(d.tor===tor&&d.rodzaj===rodzaj&&teraz-d.od<=okno)return d;
  }
  return null;
}
// Klucz naklejki z instrukcją na start (M1) dla źródła gracza i trybu śpiewu; bot nie potrzebuje instrukcji.
function kluczPodpowiedzi(zrodlo,latwy){
  if(zrodlo!=="mysz"&&zrodlo!=="ws"&&zrodlo!=="strzalki"&&zrodlo!=="kapsel"&&zrodlo!=="pad")return null;
  return "start_"+zrodlo+(latwy?"_latwy":"_pelny");
}
// Ranking w jednej z dwóch kategorii. „punkty”: punkty, przy remisie precyzja. „precyzja”: odsetek trafionych
// nut, przy remisie celność (średni wynik nuty), potem punkty. Punkty zależą od długości partii i kombo, więc
// porównują graczy tej samej partii; precyzja jest w procentach, więc porównuje też różne partie i piosenki.
function rankingGraczy(lista,wg){
  if(wg==="precyzja")return lista.slice().sort((a,b)=>((b.precyzja||0)-(a.precyzja||0))||(b.celnosc-a.celnosc)||(b.punkty-a.punkty));
  return lista.slice().sort((a,b)=>(b.punkty-a.punkty)||((b.precyzja||0)-(a.precyzja||0))||(b.celnosc-a.celnosc));
}
// ---- KLIK: premia za trafne naciśnięcie i puszczenie przycisku ----
// Przycisk nie musi klikać każdej nuty: w legato można go trzymać przez granicę nut, a w trybie „Żaba śpiewa sama”
// w ogóle nie trzeba go dotykać. Kto jednak NACIŚNIE go na początku nuty albo PUŚCI na jej końcu, gra „w rytm” i za
// każdą z tych dwóch krawędzi dostaje osobną premię: do 50 ms od chwili nuty „idealnie” (15% punktów, jakie ta nuta
// daje zaśpiewana czysto przy obecnym mnożniku), do 100 ms „dobrze” (7%). Krawędź dalej niż 150 ms od początku
// i od końca każdej nuty nie należy do żadnej nuty. Liczy się PIERWSZA krawędź w oknie nuty, więc szybkie klepanie
// nic nie daje. Czas jest czasem gracza (z korektą opóźnienia kapsla), premia wymaga nuty zaśpiewanej co najmniej
// na „Prawie” (klikanie w rytm z fałszem nie popłaca) i, jak chór, jest poza maksimum punktów i poza procentem
// (procentSpiewu), więc gwiazdki dalej mówią o samym śpiewie. Seria trafnych krawędzi (pudło w oknie ją zeruje) co 8 daje dymek.
// W PUNKT (10-05): nuta, w której OBIE krawędzie trafiły w okno (naciśnięcie na początku i puszczenie na końcu, każda
// najwyżej 100 ms od chwili nuty), jest „w punkt”: osobna, wyraźna premia (20 % punktów nuty zaśpiewanej czysto, 30 %,
// gdy obie krawędzie „idealnie”) mnożona przez serię nut w punkt z rzędu (+5 % za każdą kolejną, najwyżej ×1,5), stempel
// na torze, spinacz nad taśmą, dzwonek rosnący z serią i licznik w HUD. Seria to kolejne nuty partii: nuta zamknięta
// bez trafnego naciśnięcia albo krawędź „obok” ją zeruje. Premia jest jak klik poza maksimum i procentem.
const ZC_KLIK={OKNO:.15,IDEALNIE:.05,DOBRZE:.1,PREMIA:{idealnie:.15,dobrze:.07},SERIA:8,
  OCENY_Z_PREMIA:["czysto","dobrze","prawie"],WPUNKT:{idealnie:.3,dobrze:.2},WPUNKT_SERIA:.05,WPUNKT_SERIA_MAKS:10};
// Premia „w punkt” (bez mnożnika czasu na ruch): `oc` = "idealnie" (obie krawędzie idealnie) | "dobrze", `seria` ≥ 1.
function premiaWPunkt(oc,seria,mnoznik,dlugosc){
  const u=ZC_KLIK.WPUNKT[oc];if(!u)return 0;
  const s=Math.max(1,seria|0),f=1+ZC_KLIK.WPUNKT_SERIA*Math.min(ZC_KLIK.WPUNKT_SERIA_MAKS,s-1);
  return Math.round(punktyZaNute(100,mnoznik,dlugosc)*u*f);
}
// Ocena „w punkt” z ocen obu krawędzi nuty: obie idealnie → "idealnie", obie co najmniej dobrze → "dobrze", inaczej null.
function ocenaWPunkt(w,z){
  const ok=o=>o==="idealnie"||o==="dobrze";
  return ok(w)&&ok(z)?(w==="idealnie"&&z==="idealnie"?"idealnie":"dobrze"):null;
}
function ocenaKliku(dtSek){
  const a=Math.abs(+dtSek);
  return !(a<=ZC_KLIK.OKNO)?null:a<=ZC_KLIK.IDEALNIE?"idealnie":a<=ZC_KLIK.DOBRZE?"dobrze":"obok";
}
// Krawędź przycisku w chwili `b` (ćwierćnuty, czas gracza): nuta, której początek („wejscie”) albo koniec
// („zejscie”) leży najbliżej, o ile najwyżej OKNO s od `b`. Zwraca {idx, dt} (dt w s, dodatnie = za późno) albo null.
// W legato koniec jednej nuty to początek następnej: puszczenie trafia w zejście tej, naciśnięcie w wejście tamtej.
function dopasujKlik(nuty,b,sPerBeat,rodzaj){
  const s=Math.max(1e-3,+sPerBeat||.5),okno=ZC_KLIK.OKNO/s,zejscie=rodzaj==="zejscie";
  let k=indeksNastepnej(nuty,b+okno);k=k<0?nuty.length-1:k-1;
  let naj=null;
  for(let n=0;k>=0&&n<64;k--,n++){
    const x=nuty[k];
    if(!zejscie&&x.t<b-okno)break;
    const dt=(b-(zejscie?x.t+x.d:x.t))*s;
    if(Math.abs(dt)<=ZC_KLIK.OKNO&&(!naj||Math.abs(dt)<Math.abs(naj.dt)))naj={idx:k,dt};
  }
  return naj;
}
// ŚWIECĄCE FRAZY: 2–6 świecących sekcji na piosenkę, zależnie od długości, za idealne
// zagranie bonusowe punkty, nuty w takiej sekcji połyskują. Partia dostaje ok. jedną frazę na SEK_NA s (MIN–MAKS),
// każda to NUT_MIN–NUT_MAKS kolejnych nut; w każdej z N równych części partii fraza startuje na nucie po najdłuższej
// pauzie (początek frazy muzycznej), blisko środka części. Bez losowania: ta sama partia = te same frazy. Gracz, który
// zamknie WSZYSTKIE nuty frazy co najmniej na „Dobrze”, dostaje PREMIA × punkty tych nut (wszystkie „Czysto”:
// PREMIA_CZYSTO). Premia jest, jak „w punkt”, poza maksimum i procentem (wchodzi do premiaKlik), więc gwiazdki dalej
// mówią o samym śpiewie. Pierwsza nuta poniżej „Dobrze” gasi frazę temu graczowi (połysk znika, gdy zgaśnie wszystkim).
const ZC_SEKCJE={SEK_NA:40,MIN:2,MAKS:6,NUT_MIN:3,NUT_MAKS:8,PREMIA:.5,PREMIA_CZYSTO:.75};
function sekcjeBonusowe(nuty,sPerBeat){
  const n=nuty.length,Z=ZC_SEKCJE;if(n<2*Z.NUT_MIN)return [];
  const dl=(nuty[n-1].t+nuty[n-1].d-nuty[0].t)*Math.max(1e-3,+sPerBeat||.5);
  const N=Math.max(1,Math.min(Math.max(Z.MIN,Math.min(Z.MAKS,Math.round(dl/Z.SEK_NA))),Math.floor(n/(2*Z.NUT_MIN))));
  const K=Math.max(Z.NUT_MIN,Math.min(Z.NUT_MAKS,Math.round(n/N/5)));
  const out=[];
  for(let s=0;s<N;s++){
    const a=Math.floor(s*n/N),b=Math.floor((s+1)*n/N),sr=(a+b-K)/2;
    let naj=Math.max(0,Math.min(a,n-K)),wart=-Infinity;
    for(let i=Math.max(1,a);i<=b-K;i++){
      const pauza=nuty[i].t-(nuty[i-1].t+nuty[i-1].d),w=pauza-.02*Math.abs(i-sr);
      if(w>wart){wart=w;naj=i;}
    }
    const od=Math.max(naj,out.length?out[out.length-1].do+2:0);if(od+K-1>=n)break;
    out.push({od,do:od+K-1});
  }
  return out;
}
// Nuta zamknięta przez gracza: stan jego frazy, a na ostatniej nucie wypłata premii (dymek, „+N”, dzwonek).
function rozliczSekcje(g,tor,idx,r,teraz){
  const s=tor.sekcjaNuty?tor.sekcjaNuty.get(idx):undefined;if(s==null)return;
  const sek=tor.sekcje[s],st=g.sekcjeStan[s]||(g.sekcjeStan[s]={ok:true,czysto:true,suma:0});
  if(!ZC_TRAFIONE.includes(r.ocena))st.ok=false;
  if(r.ocena!=="czysto")st.czysto=false;
  st.suma+=r.punkty;
  if(idx!==sek.do||!st.ok)return;
  const pkt=Math.round(st.suma*(st.czysto?ZC_SEKCJE.PREMIA_CZYSTO:ZC_SEKCJE.PREMIA));
  st.premia=pkt;g.punkty+=pkt;g.premiaKlik+=pkt;g.sekcjeZdobyte++;
  popup(g,T[st.czysto?"sekcjaCzysta":"sekcjaPopup"],"sekcja",50);   // tekst stały (10-10, płynność): bitmapa z przygotujBufory, nie z klatki trafienia; liczbę niesie „+N”
  const G=S.gra;G.loty.push({g,tor,punkty:pkt,mnoznik:1,ocena:"sekcja",kolor:ZC_DYMKI_KOLOR.sekcja,od:teraz,nr:g.zamknieteNut+2});
  if(G.loty.length>32)G.loty.shift();
  try{Glos.gwiazdka(st.czysto?5:4);Glos.gwiazdka(st.czysto?5:4,.09);}catch(e){}
}
// Fraza wciąż „świeci” na torze, dopóki choć jeden gracz jej nie zgasił.
const sekcjaSwieci=(tor,s)=>tor.gracze.some(g=>!(g.sekcjeStan[s]&&g.sekcjeStan[s].ok===false));
function premiaKliku(ocena,mnoznik,dlugosc,mr){
  const u=ZC_KLIK.PREMIA[ocena];
  return u?Math.round(punktyZaNute(100,mnoznik,dlugosc)*u*(mr>0?mr:1)):0;
}
// Ogień kombo: 0 nic, 1 iskry (kombo ≥ 4, mnożnik ×2), 2 płomienie (≥ 8, ×3), 3 pożar (≥ 12, ×4). Te same progi co
// mnożnik, więc to, co pali się na torze, mówi, ile punktów jest teraz w grze.
function poziomOgnia(kombo){
  const k=Math.max(0,kombo|0),co=ZC_PUNKTY.KOMBO_CO;
  return k>=3*co?3:k>=2*co?2:k>=co?1:0;
}
// Precyzja: odsetek nut partii trafionych na „Czysto” albo „Dobrze” (trafny strzał). Nuty jeszcze nie zagrane
// liczą się jak pudło, dlatego HUD pokazuje precyzję z nut ZAMKNIĘTYCH (precyzja dotąd), a wynik z całej partii.
const ZC_TRAFIONE=["czysto","dobrze"];
function precyzjaZOcen(oceny,liczbaNut){
  if(!(liczbaNut>0))return 0;
  let t=0;for(const k of ZC_TRAFIONE)t+=(oceny&&oceny[k])||0;
  return 100*t/liczbaNut;
}
// Rozbicie wyniku gracza na ekranie wyników: ile nut na każdą ocenę (zawsze wszystkie pięć, także zera: „0 pudło”
// to też informacja), dodatki z kapsla tylko, gdy były (wibrata, trafne krawędzie „w rytm” = idealnie + dobrze),
// i skąd są punkty: za nuty (z mnożnikiem i wibratem, bo te siedzą w punktach nuty), premia za czystą piosenkę,
// „W jednym głosie!” i klik w rytm. Suma czterech części = punkty gracza, więc tabela się zgadza z HUD-em.
function rozbicieWyniku(r){
  const oc=r.oceny||{},nuty=["czysto","dobrze","prawie","falsz","pudlo"].map(k=>({k,n:Math.max(0,(oc[k]|0))}));
  const kl=r.kliki||{},klik=(kl.idealnie|0)+(kl.dobrze|0),wib=r.wibrata|0;
  const dodatki=[];
  if(wib>0)dodatki.push({k:"wibrato",n:wib});
  if(klik>0)dodatki.push({k:"klik",n:klik});
  if((r.wPunkt|0)>0)dodatki.push({k:"wpunkt",n:r.wPunkt|0});
  const premia=r.premia|0,chor=r.premiaChoru|0,klikP=r.premiaKlik|0,razem=Math.round(+r.punkty||0);
  return {nuty,dodatki,punkty:{nuty:Math.max(0,razem-premia-chor-klikP),premia,chor,klik:klikP,razem}};
}
// Nagrody tylko w towarzystwie (co najmniej dwie żaby): solista nie dostaje nagrody od samego siebie,
// tylko naklejkę z rekordem piosenki (rekordPiosenki). „Król fałszu” i „Największa gaduła” są na wesoło,
// więc tylko wtedy, gdy ktoś naprawdę fałszował albo gadał.
function przyznajNagrody(lista){
  if(lista.length<2)return {czysty:null,kombo:null,falsz:null,gadula:null};
  const naj=(f,remis)=>lista.reduce((a,b)=>(f(b)>f(a)||(f(b)===f(a)&&remis(b)>remis(a)))?b:a);
  const czysty=naj(g=>g.celnosc,g=>g.punkty),kombo=naj(g=>g.maxKombo,g=>g.punkty);
  const falsz=naj(g=>g.falsze,g=>-g.celnosc),gadula=naj(g=>g.gadanie||0,g=>-g.celnosc);
  return {czysty:czysty.id,kombo:kombo.id,falsz:falsz.falsze>0?falsz.id:null,
    gadula:(gadula.gadanie||0)>=1?gadula.id:null};
}
// Rekord solisty na piosenkę: poprzedni rekord z zapisu, nowy, jeśli pobity, i uaktualniona mapa rekordów.
function rekordPiosenki(rekordy,id,punkty){
  const poprzedni=Math.max(0,+((rekordy||{})[id])||0),nowy=punkty>poprzedni;
  const mapa=Object.assign({},rekordy||{});if(nowy)mapa[id]=punkty;
  return {rekord:Math.max(poprzedni,punkty),nowy,poprzedni,rekordy:mapa};
}
// „Kum” w pauzie: stan {ciag, za} = ile trwa ciągłe gadanie i ile zostało do następnego „kum”. Pierwszy od
// razu, potem co ZC_KUM.CO, a po ZC_KUM.ZMECZENIE s gadania co ZC_KUM.WOLNO (żaba się męczy).
function krokKum(k,dt){
  const ciag=k.ciag+dt,za=k.za-dt;
  if(za>1e-9)return {ciag,za,kum:false};
  return {ciag,za:ciag>=ZC_KUM.ZMECZENIE?ZC_KUM.WOLNO:ZC_KUM.CO,kum:true};
}
// Aplauz kapslem: próbki {id, twist (°/s), ruch (px/s myszy), klawisze (naciśnięcia w tej klatce)} dodane
// do sum w „stopniach obrotu”. Zwraca nowe sumy i chwilową głośność widowni 0..1.
function zbierzAplauz(sumy,probki,dt){
  const out=Object.assign({},sumy);let razem=0;
  for(const p of probki){
    const tw=Math.abs(+p.twist||0);
    const ciagly=Math.min(ZC_APLAUZ.MAKS,(tw>=ZC_APLAUZ.PROG?tw:0)+Math.max(0,+p.ruch||0)*ZC_APLAUZ.MYSZ);
    const st=ciagly*dt+Math.max(0,+p.klawisze||0)*ZC_APLAUZ.KLAWISZ;
    out[p.id]=(out[p.id]||0)+st;razem+=st;
  }
  return {sumy:out,glosnosc:dt>0?Math.max(0,Math.min(1,razem/dt/ZC_APLAUZ.PELNY)):0};
}
// „Największy aplauz”: kto zebrał najwięcej (od ćwierć obrotu wzwyż); przy remisie pierwszy z listy.
function najwiekszyAplauz(sumy,ids){
  let kto=null,maks=ZC_APLAUZ.NAGRODA;
  for(const id of ids)if((sumy[id]||0)>maks){maks=sumy[id];kto=id;}
  return kto;
}
// ---- TRUDNOŚĆ PARTII (klasyfikator) ----
// Ocena 1–10 dla jednej partii przy danym tempie i zakresie przechyłu, z rozbiciem na sześć czynników 0–10.
// W tej grze nie liczy się, czy nuta jest czarnym klawiszem: liczy się, ile ruchu ręki wymaga partia i ile
// czasu na ten ruch daje. Czynniki (cechy liczone w cechyPartii, progi w ZC_TRUDNOSC.PROGI):
//   ruch      prawo Fittsa: przejście o J półtonów zajmuje MT = A + B·log2(J+1) s (odległość i szerokość celu
//             są w tych samych stopniach, więc stopnie się skracają). Ruch, który nie zmieści się w pauzie przed
//             nutą, zjada jej początek: strata = (MT − pauza) / długość nuty, a w legato (bez pauzy) dzieli się
//             na koniec poprzedniej i początek tej nuty. Skoki na krótkie nuty bolą najbardziej, ta sama nuta
//             powtórzona nic nie kosztuje, a krok o 1–2 półtony w tę samą stronę co poprzedni (gama, pasaż) to
//             płynny ruch ciągły, nie skok, więc kosztuje BIEG razy mniej,
//   gestosc   zmiany wysokości na sekundę: 70% szczytu (najgęstsze okno 4 s) + 30% średniej z czasu, w którym
//             partia śpiewa; powtórzona nuta liczy się za 0,25 (w legato wystarczy trzymać przycisk),
//   precyzja  ile stopni przechyłu przypada na półton (2·zakres / (rozpiętość + 4)): szeroka partia = mały cel,
//   rytm      odsetek nut nieregularnych: poza siatką szesnastek (triole) 1, szesnastka poza ósemką 0,5,
//             synkopa (nuta z „i” trwająca przez następną miarę) 0,5,
//   zygzaki   zmiany kierunku przy skokach ≥ 3 półtonów, które nie są zwykłym przeskakiwaniem między dwiema
//             nutami (bas „um-pa” jest łatwy, 0-7-2-9-4 już nie),
//   dlugosc   liczba nut (wytrzymałość i utrzymanie kombo).
// Ocena = 1 + 9·tanh((część FIZYCZNA + część POZNAWCZA) / 9):
//   fizyczna  = FIZ.ruch · ruch²/10 + FIZ.precyzja · precyzja. Dopasowana metodą najmniejszych kwadratów do
//             odsetka nut, które gubią boty Średni i Trudny (tools/ribbitbeat_kalibracja.mjs, 109 partii:
//             8 piosenek × 3 tempa + 16 wzorców × 4 tempa). Ruch jest wypukły: drobne kroki
//             prawie nic nie kosztują, a gdy ręka przestaje nadążać, nuty sypią się lawinowo. Gęstość po
//             uwzględnieniu ruchu nie tłumaczy już niczego u botów, więc w fizycznej części jej nie ma,
//   poznawcza = gęstość, rytm, zygzaki i długość z wagami z ręki: bot zna przyszłość i nie musi czytać nut,
//             człowiek musi, więc te czynniki liczą się tylko w tej części.
// Wynik kalibracji (1 ziarno, 2026-10-20, po zatrzasku i limicie prędkości ręki botów): korelacja oceny
// z odsetkiem nut zgubionych przez bota Średniego 0,88, korelacja rang z sumą trzech botów 0,94. Poziomy to
// miejsca, w których „łamie się” kolejny bot (precyzja Łatwy/Średni/Trudny/Mistrz): łatwa < 3 (71/98/100/100%),
// średnia 3–4,5 (35/84/99/100%), trudna 4,5–6 (24/66/93/99%), bardzo trudna 6–7,5 (13/34/74/90%),
// ekstremalna ≥ 7,5 (9/16/53/69%). Czyli: partię łatwą zagra bot Łatwy, średnią Średni, trudną Trudny,
// bardzo trudną Mistrz, a ekstremalnej nie zagra nikt.
const ZC_TRUDNOSC={
  FITTS_A:.05,FITTS_B:.06,BIEG:.55,OKNO:4,POWTORKA:.25,
  // progi: [wartość cechy, czynnik 0–10], liniowo między punktami, poza nimi stała
  PROGI:{
    ruch:[[0,0],[.04,2],[.1,4.5],[.2,7],[.35,9],[.55,10]],  // średnia strata nuty z prawa Fittsa
    gestosc:[[.6,0],[1.2,2],[2,4],[3,6],[4.2,8],[6,10]],     // zmiany wysokości/s
    precyzja:[[7,0],[5,2],[3.6,4.5],[2.6,7],[1.8,10]],       // stopnie na półton (mniej = trudniej)
    rytm:[[0,0],[.1,2.5],[.25,5],[.45,8],[.7,10]],           // odsetek nut nieregularnych
    zygzaki:[[0,0],[.08,2],[.2,5],[.35,8],[.5,10]],          // zmiany kierunku na nutę
    dlugosc:[[20,0],[60,2],[150,4],[300,6],[600,8]]},        // nuty
  FIZ:{ruch:.84,precyzja:.09},
  POZ:{gestosc:.15,rytm:.12,zygzaki:.08,dlugosc:.06},
  POZIOMY:[{k:"latwa",od:0},{k:"srednia",od:3},{k:"trudna",od:4.5},{k:"bardzoTrudna",od:6},{k:"ekstremalna",od:7.5}]};
function skalaProgow(x,progi){
  if(!(progi&&progi.length))return 0;
  const rosnie=progi[progi.length-1][0]>=progi[0][0];
  const p=rosnie?progi:progi.slice().reverse();
  if(x<=p[0][0])return p[0][1];
  for(let i=1;i<p.length;i++)if(x<=p[i][0]){const [x0,y0]=p[i-1],[x1,y1]=p[i];return y0+(y1-y0)*(x-x0)/((x1-x0)||1);}
  return p[p.length-1][1];
}
// Surowe cechy partii (czas w sekundach przy `sPerBeat` sekund na ćwierćnutę). Nuty posortowane po t.
function cechyPartii(nuty,sPerBeat,zakres){
  const n=nuty.length,s=Math.max(1e-3,+sPerBeat||.5),R=Math.max(1,+zakres||40);
  const pusto={nut:n,nps:0,npsSzczyt:0,ruch:0,ruchTrudne:0,stopniNaPolton:2*R/4,rytm:0,zygzaki:0,skokSredni:0,czas:0};
  if(!n)return pusto;
  let lo=Infinity,hi=-Infinity;for(const x of nuty){if(x.m<lo)lo=x.m;if(x.m>hi)hi=x.m;}
  // gęstość: czas „śpiewania” = odstępy między początkami nut, ale dłuższa pauza liczy się najwyżej 2 s;
  // waga nuty: 1 za zmianę wysokości, POWTORKA za tę samą nutę co poprzednia
  let aktywny=0,wazone=0;const waga=[];
  for(let i=0;i<n;i++){
    const ioi=i<n-1?(nuty[i+1].t-nuty[i].t)*s:nuty[i].d*s;aktywny+=Math.min(2,Math.max(.05,ioi));
    waga[i]=i&&nuty[i].m===nuty[i-1].m?ZC_TRUDNOSC.POWTORKA:1;wazone+=waga[i];
  }
  const okno=Math.min(ZC_TRUDNOSC.OKNO,Math.max(1,aktywny));
  let szczyt=0,wOknie=0;
  for(let i=0,j=0;i<n;i++){
    while(j<n&&(nuty[j].t-nuty[i].t)*s<okno){wOknie+=waga[j];j++;}
    szczyt=Math.max(szczyt,wOknie);wOknie-=waga[i];
  }
  // ruch (Fitts), zygzaki
  let strata=0,trudne=0,skoki=0,zwroty=0,poprzedni=0,krok=0;
  for(let i=1;i<n;i++){
    const a=nuty[i-1],b=nuty[i],J=Math.abs(b.m-a.m),znak=Math.sign(b.m-a.m);skoki+=J;
    if(J>0){
      const bieg=J<=2&&znak===krok;   // dalszy ciąg gamy w tę samą stronę
      const mt=(ZC_TRUDNOSC.FITTS_A+ZC_TRUDNOSC.FITTS_B*Math.log2(J+1))*(bieg?ZC_TRUDNOSC.BIEG:1);
      // ruch zaczyna się w pauzie; w legato rozkłada się na koniec poprzedniej i początek tej nuty
      const pauza=Math.max(0,(b.t-(a.t+a.d))*s),T=Math.max(0,mt-pauza);
      const st=Math.max(0,Math.min(1,T/Math.max(.02,(pauza>.02?b.d:a.d+b.d)*s)));
      strata+=st;if(st>=.4)trudne++;
    }
    krok=znak;
    const kier=b.m-a.m>=3?1:b.m-a.m<=-3?-1:0;
    if(kier&&poprzedni&&kier!==poprzedni&&!(i>=2&&b.m===nuty[i-2].m))zwroty++;
    if(kier)poprzedni=kier;
  }
  // rytm: poza siatką szesnastek (triola) 1, szesnastka poza ósemką 0,5, synkopa (na „i”, trwa przez miarę) 0,5
  let nieregularne=0;
  for(const x of nuty){
    const poza=(siatka)=>Math.abs(x.t/siatka-Math.round(x.t/siatka))>.02;
    if(poza(.25))nieregularne+=1;
    else if(poza(.5))nieregularne+=.5;
    else if(poza(1)&&x.d>=1-.02)nieregularne+=.5;
  }
  return {nut:n,nps:wazone/aktywny,npsSzczyt:szczyt/okno,ruch:strata/n,ruchTrudne:trudne/n,stopniNaPolton:2*R/(hi-lo+4),
    rytm:Math.min(1,nieregularne/n),zygzaki:zwroty/n,skokSredni:n>1?skoki/(n-1):0,czas:aktywny};
}
// Ocena trudności: {ocena 1–10 (jedno miejsce po przecinku), poziom, czynniki {ruch,…} 0–10, glowne: dwa
// najmocniejsze czynniki (do podpowiedzi „dlaczego”), cechy}. bpm = ćwierćnuty na minutę W GRZE (z tempem %).
function trudnoscPartii(nuty,bpm,zakres){
  const C=cechyPartii(nuty||[],60/Math.max(1,+bpm||100),zakres),P=ZC_TRUDNOSC.PROGI,FIZ=ZC_TRUDNOSC.FIZ,POZ=ZC_TRUDNOSC.POZ;
  const cz={ruch:skalaProgow(C.ruch,P.ruch),gestosc:skalaProgow(.7*C.npsSzczyt+.3*C.nps,P.gestosc),
    precyzja:skalaProgow(C.stopniNaPolton,P.precyzja),rytm:skalaProgow(C.rytm,P.rytm),
    zygzaki:skalaProgow(C.zygzaki,P.zygzaki),dlugosc:skalaProgow(C.nut,P.dlugosc)};
  // wkład każdego czynnika do oceny (do podpowiedzi „dlaczego”): ruch liczy się z kwadratem
  const wklad={ruch:FIZ.ruch*cz.ruch*cz.ruch/10,precyzja:FIZ.precyzja*cz.precyzja};
  for(const k in POZ)wklad[k]=POZ[k]*cz[k];
  let surowa=0;for(const k in wklad)surowa+=wklad[k];
  // tanh: dół skali prawie liniowy (surowa 3 → ocena 3,9), góra łagodnie dochodzi do 10, więc partie „nie do
  // zagrania” dalej różnią się między sobą
  const ocena=C.nut?Math.max(1,Math.min(10,Math.round((1+9*Math.tanh(surowa/9))*10)/10)):1;
  const glowne=Object.keys(wklad).filter(k=>wklad[k]>=.5).sort((a,b)=>wklad[b]-wklad[a]).slice(0,2);
  return {ocena,poziom:poziomTrudnosci(ocena),czynniki:cz,wklad,glowne,cechy:C};
}
function poziomTrudnosci(ocena){
  let k=ZC_TRUDNOSC.POZIOMY[0].k;
  for(const p of ZC_TRUDNOSC.POZIOMY)if(ocena>=p.od)k=p.k;
  return k;
}

// Żaba-duch „Pokaż jak” (recenzja 2): bot bez luzu stojący na linii „teraz”. Podjeżdża na wysokość nuty pod
// linią (albo najbliższej) i otwiera pysk, kiedy pod linią jest nuta; nie śpiewa na głos i nie ma punktów.
function krokDucha(d,nuty,b,dt){
  const i=indeksNutyPod(nuty,b),j=i>=0?i:indeksNastepnej(nuty,b);
  if(j>=0)d.polton=wygladzEMA(d.polton,celNuty(nuty[j],b),dt,.05);
  d.spiewa=i>=0&&nuty[i].t+nuty[i].d-b>.08;
  return d;
}

// =============================================================================================
// 3. STAN, ZASOBY, POMOCNIKI
const ZC_USTAWIENIA_KLUCZ="ribbitflip.zabiChor",ZC_USTAWIENIA_WERSJA=2;
// Akcent toru: NASYCONY kolor partii (ścieg, pasek na taśmie, taśma trafiona). Taśma to kraft jak
// taśma malarska, bez pasteli (celowo, jak przy tłach Syntha: blady róż odpada).
const ZC_TORY_STYL=[{akcent:"#ec1a83"},{akcent:"#6cb33f"},{akcent:"#eaa32b"},{akcent:"#294aa8"}];
const ZC_KRAFT="#e9d4ae",ZC_KRAFT_BRZEG="#c9ad7c";
const ZC_OCENY_KOLOR={czysto:"#6cb33f",dobrze:"#a6d861",prawie:"#eaa32b",falsz:"#ec1a83",pudlo:"#faf6ee"};
const ZC_WYPEL_KOLOR=["rgba(108,179,63,.92)","rgba(234,163,43,.92)","rgba(236,26,131,.85)"];   // klasaKlatki: na nucie, „Prawie”, poza
const ZC_WPUNKT_KOLOR="#ffd84a";   // „w punkt”: złoto stempla (napis zawsze grafitem)
const ZC_DYMKI_KOLOR={falsz:"#ec1a83",kombo:"#a6d861",chor:"#6cb33f",wibrato:"#eaa32b",kum:"#faf6ee",klik:"#ffd84a",sekcja:"#ffc93c"};
const ZC_ZASOBY={zaby:[0,1,2,3,4].map(i=>"../assets/frog/sing-"+i+"-96.png"),cicha:"../assets/frog/sing-silent-96.png",
  lisc:"../assets/pad/lilypad.png"};
const ZC_SLAD_SEK=2.2;          // jak długo widać ślad śpiewanej wysokości
const ZC_TAKTY_NAPRZOD=2;       // ile taktów widać przed linią „teraz” (2: ćwierćnuta ok. 128 px, ekran żyje)
const ZC_PX_NA_BEAT_MIN=90;     // najmniej px na ćwierćnutę w wąskim torze (kolumny, siatka)
const ZC_LINIA_TERAZ=.22;       // linia „teraz”, ułamek szerokości od lewej
const ZC_SCALANIE_MS=150;       // dymki tego samego rodzaju na torze w tym oknie łączą się w jeden

const S={
  ekran:"lobby",                // lobby | odliczanie | gra | wyniki
  lobbyEkran:"menu",            // który ekran lobby widać: menu | utwory | wybor | konfiguracja (pokazLobby)
  piloty:{},pilot:null,         // kapsle jako pilot (krokPilota): stan per kapsel i kto ostatnio sterował
  skladOdtworzony:false,skladZAdresu:false,odtwarzanie:false,   // zapis i odtworzenie składu (runda 3)
  piosenki:[],idx:0,
  ust:{animacjaPostepu:true,glos:"trabka",spiewaSama:DOMYSLNIE_SPIEWA_SAMA,tempo:100,opoznienie:150,zakres:40,przyciaganie:1,
    odwroc:false,instrument:"piano",silnikMidi:"jeden",podpowiedz:false,pokazJak:true,klawDoNuty:false,presetWlasny:null,   // 10-18: przyciąganie 0–4, „skok do nuty” jako pomoc, ostatnie „Własne”
    poziomBota:"sredni",grafika:"pelna",stylGrafik:"ilustracja",klatki:60,autoJakosc:true,
    uklad:"auto",tory:"osobno",instrumentyGraczy:{},przejsciaGraczy:{},planszaTryb:"wszyscy",   // 10-21: kto wybiera planszę (ZC_PLANSZA_TRYBY); przejsciaGraczy: {gracz:{instrument:"skok"|"plynne"}} (10-22)
    tryb:"plynny",sortowanie:"alfabet",czasNaRuch:100,klawiatura:"szybko",dzwiekiUI:true,dzwiekiUIGlosnosc:.6,glosnosc:1,glosnoscPodklad:1,glosnoscZaby:1,glosnoscEfekty:1,poglos:0,echo:0},            // tryb nut: klasyczny | plynny (zjazdy między nutami)   // uklad: auto|pasy|kolumny|siatka; tory: osobno|chor; instrument per gracz (klucz = id gracza)
   // grafika: pelna | uproszczona (bez ognia, dymu, iskier) | wydajnosc (do tego bez tła stopnia, FX i w 1× dpr); klatki: 60 | 120 | 0 = bez limitu           // poziom, z którym „Dodaj bota” dokłada następnego (ostatnio wybrany)
  wiecejUstawien:false,
  nrGry:0,                      // która piosenka z ludźmi od załadowania strony („Pokaż jak” tylko w pierwszej)
  rekordy:{},                   // rekord solisty na piosenkę (id → punkty), w localStorage
  aplauzRuch:0,aplauzKlawisze:{},ostMysz:null,   // wejście aplauzu na wynikach (mysz w px, klawisze)
  gracze:[],                    // dołączeni: {id, nazwa, kolor, obrazekKapsla, zrodlo, partia, gotowy, …stan gry}
  gra:null,wyniki:null,pauza:false,
  autoStart:null,               // sekundy do startu z ?auto=1
  wszyscyGotowi:null,           // sekundy do startu, gdy wszyscy potwierdzili
  czekaNaDzwiek:false,          // wszyscy gotowi, ale przeglądarka jeszcze nie pozwoliła grać
  ostatnio:0,ostatnioAudio:null,fps:{klatki:0,od:0,wartosc:0,pokaz:false},pomiarJs:null,
  opcje:{}};
const IMG={zaby:[],cicha:null,lisc:null,kapsle:{}};
const R={tlo:null,scena:null,ct:null,cs:null,W:0,H:0,dpr:1,f:1,tory:[],teraz:0,pxNaBeat:0,widownia:{y:0,h:0},
  bufor:new Map(),wersja:0,wzor:null};
let losujGre=Math.random;

const el=id=>document.getElementById(id);
function h(tag,klasa,tekst){
  const e=document.createElement(tag);
  if(klasa)e.className=klasa;
  if(tekst!=null)e.textContent=tekst;
  return e;
}
function rgba(hex,a){
  const m=/^#([0-9a-f]{6})$/i.exec(hex||"");
  const n=m?parseInt(m[1],16):0x6cb33f;
  return "rgba("+((n>>16)&255)+","+((n>>8)&255)+","+(n&255)+","+a+")";
}
// Czytelny kolor napisu na tle w kolorze gracza (grafit na jasnym, papier na ciemnym; nigdy biały na żółtym).
function napisNa(hex){
  const m=/^#([0-9a-f]{6})$/i.exec(hex||"");if(!m)return "#211f1d";
  const n=parseInt(m[1],16),lin=c=>{c/=255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);};
  const L=.2126*lin((n>>16)&255)+.7152*lin((n>>8)&255)+.0722*lin(n&255);
  return L>.22?"#211f1d":"#faf6ee";
}
const fmtLiczba=n=>Math.round(n).toLocaleString(ZC_LOC);
function fmtCzas(sek){sek=Math.max(0,Math.round(sek));return Math.floor(sek/60)+":"+String(sek%60).padStart(2,"0");}
function nazwaPartii(p){
  if(!p)return "";
  if(p.rola==="melodia")return T.partiaMelodia;
  if(p.rola==="akompaniament")return T.partiaAkomp;
  if(p.nazwaSciezki)return tt("partiaNazwana",{nazwa:p.nazwaSciezki.slice(0,20)});
  return tt("partiaSciezka",{n:p.numerSciezki||"?"});
}
const piosenka=()=>S.piosenki[S.idx];
const zrodloGracza=g=>Wejscie.gracz(g.id);

// Obrazek gotowy do rysowania: wczytany i NIE zepsuty. Zepsuty obrazek (404) ma `complete`, ale
// `naturalWidth` 0, a drawImage na nim rzuca wyjątek i zatrzymuje całą pętlę gry.
const obrazGotowy=im=>!!im&&im.complete&&im.naturalWidth>0;
function wczytajObrazki(){
  const zrob=src=>{const im=new Image();im.src=src;return im;};
  IMG.zaby=ZC_ZASOBY.zaby.map(zrob);IMG.cicha=zrob(ZC_ZASOBY.cicha);IMG.lisc=zrob(ZC_ZASOBY.lisc);
  const wszystkie=[...IMG.zaby,IMG.cicha,IMG.lisc];
  return Promise.all(wszystkie.map(im=>im.decode().catch(()=>{})));
}
// Obrazek kapsla do rysowania na płótnie (ten sam plik co w HUD i w lobby), ładowany przy pierwszej potrzebie.
function obrazekKapsla(src){
  if(!src)return null;
  let im=IMG.kapsle[src];
  if(!im){im=IMG.kapsle[src]=new Image();im.src=src;}
  return obrazGotowy(im)?im:null;
}
// Ustawienia w localStorage. Wersja 2 (recenzja 1) zmieniła domyślne „Opóźnienie kapsli” (0 → 150 ms)
// i „Pomoc w trafianiu” (wył. → wł.): zapis ze starszej wersji nie może przykryć nowych domyślnych.
function wczytajUstawienia(){
  try{
    const z=JSON.parse(localStorage.getItem(ZC_USTAWIENIA_KLUCZ)||"null");
    if(!z)return {};
    const ust=Object.assign({},z.ust||{});
    if(z.wersja!==ZC_USTAWIENIA_WERSJA){delete ust.opoznienie;delete ust.przyciaganie;}
    if(ust.tryb==null&&ust.przejscia===true)ust.tryb="plynny";   // eksperyment „płynne przejścia” (10-03) stał się trybem
    if(!z.trybPlynny&&ust.tryb==="klasyczny")ust.tryb="plynny";   // domyślnie płynny, także w starych zapisach; własny wybór schodków po migracji zostaje
    if(typeof ust.czasNaRuch==="boolean")ust.czasNaRuch=ust.czasNaRuch?100:0;
    migrujPomoce(ust);
    // 10-17: instrumenty zastąpione nowymi (Postepy.ZAMIANY_INSTRUMENTOW) przechodzą na następców, także wybrane per gracz
    const zam=typeof Postepy!=="undefined"&&Postepy.ZAMIANY_INSTRUMENTOW||{};
    if(zam[ust.glos])ust.glos=zam[ust.glos];
    if(ust.instrumentyGraczy&&typeof ust.instrumentyGraczy==="object")for(const g of Object.keys(ust.instrumentyGraczy))if(zam[ust.instrumentyGraczy[g]])ust.instrumentyGraczy[g]=zam[ust.instrumentyGraczy[g]];   // do 10-05 przełącznik: z czasem = 100 %, bez = 0 %
    for(const k in S.ust)if(typeof ust[k]===typeof S.ust[k])S.ust[k]=ust[k];
    S.wiecejUstawien=!!z.wiecej;
    if(z.rekordy&&typeof z.rekordy==="object")S.rekordy=z.rekordy;
    return z;
  }catch(e){return {};}
}
// 10-18: „Pomoc w trafianiu” (przełącznik) → „Przyciąganie do nut” 0–4, tryb klawiatury „Do nuty” → osobna pomoc
// „Skok do nuty” przy klawiaturze „Szybko” (w trybie „do nuty” przytrzymanie i tak jechało szybko). Wołają ją też konta (konta.js).
function migrujPomoce(u){
  if(!u||typeof u!=="object")return u;
  if(typeof u.przyciaganie==="boolean")u.przyciaganie=u.przyciaganie?1:0;
  if(u.klawiatura==="donuty"){u.klawiatura="szybko";if(typeof u.klawDoNuty!=="boolean")u.klawDoNuty=true;}
  return u;
}
function zapiszUstawienia(){
  try{localStorage.setItem(ZC_USTAWIENIA_KLUCZ,JSON.stringify({wersja:ZC_USTAWIENIA_WERSJA,trybPlynny:true,ust:S.ust,
    piosenka:S.czekaNaId||(piosenka()||{}).id,wiecej:S.wiecejUstawien,rekordy:S.rekordy}));}catch(e){}
}
let toastCzas=0;
function toast(tekst,blad){
  const t=el("toast");
  t.textContent=tekst;t.classList.toggle("blad",!!blad);t.hidden=false;
  clearTimeout(toastCzas);toastCzas=setTimeout(()=>{t.hidden=true;},blad?6000:3800);
}
function schowajToast(){clearTimeout(toastCzas);el("toast").hidden=true;}
function pokazEkran(nazwa){
  el("lobby").hidden=nazwa!=="lobby";
  el("gra").hidden=nazwa==="lobby";
  el("wyniki").hidden=nazwa!=="wyniki";
  if(nazwa!=="gra")ustawPauze(false);
  if(nazwa!=="wyniki")wyczyscKonfetti();
}

// =============================================================================================
// 4. LOBBY
// Ustawienia opisane danymi, żeby lobby było jednym miejscem do dopisania nowej opcji. `zaawansowane`
// chowają się pod „Więcej ustawień”: na imprezie widać tylko to, co zmienia się przed każdą piosenką
// (10-15: opóźnienie kapsli, grafika i styl grafik też tam, bo ustawia się je raz na komputer).
// Ustawienia pogrupowane i opisane: nad listą „Poziom gry” (gotowe zestawy, ZC_PRESETY), niżej grupy
// w kolejności USTAWIENIA_GRUPY; opcja należy do grupy `grupa`. Grupy „trudnosc” i „pomoce” mają mnożnik punktów w nagłówku,
// a każda ich opcja mówi, ile zmienia punkty: `punkty(v)` = mnożnik dla wartości v albo null = bez wpływu na punkty.
// Pozostałe grupy w opisie mówią, że punktów nie zmieniają. Grupa, której wszystkie opcje są zaawansowane, chowa się razem z nimi.
const USTAWIENIA_GRUPY=[
  {g:"trudnosc",tytul:"grTrudnosc",opis:"grTrudnoscOpis",punkty:()=>Math.round(mnoznikRuchu(S.ust.czasNaRuch)*mnoznikTempa(S.ust.tempo)*1e4)/1e4},
  {g:"pomoce",tytul:"grPomoce",opis:"grPomoceOpis",punkty:()=>mnoznikPomocy(S.ust,false)},
  {g:"sterowanie",tytul:"grSterowanie",opis:"grSterowanieOpis"},
  {g:"ekran",tytul:"grEkran",opis:"grEkranOpis"},
  {g:"dzwiek",tytul:"grDzwiek",opis:"grDzwiekOpis"},
  {g:"grafika",tytul:"grGrafika",opis:"grGrafikaOpis"}];
const USTAWIENIA_UI=[
  {k:"tempo",grupa:"trudnosc",typ:"suwak",etykieta:"ustTempo",min:ZC_TEMPO.MIN,max:ZC_TEMPO.MAKS,krok:ZC_TEMPO.KROK,jedn:"%",opis:"ustTempoOpis",
    fmt:v=>tt("tempoWartosc",{n:procentTempa(v),m:fmtMn(mnoznikTempa(v))})},
  {k:"czasNaRuch",grupa:"trudnosc",typ:"suwak",etykieta:"ustCzasNaRuch",min:0,max:ZC_RUCH.MAKS_PROCENT,krok:ZC_RUCH.KROK,jedn:"%",opis:"ustCzasNaRuchOpis",
    fmt:v=>tt("czasNaRuchWartosc",{n:procentRuchu(v),m:fmtMn(mnoznikRuchu(v))})},
  {k:"tryb",grupa:"trudnosc",typ:"segment",etykieta:"ustTryb",opcje:["plynny","klasyczny"],nazwa:v=>T["tryb_"+v],opis:"ustTrybOpis",punkty:()=>"bez"},
  {k:"przyciaganie",grupa:"pomoce",typ:"suwak",etykieta:"ustPrzyciaganie",min:0,max:ZC_POMOC.POZIOMY.length-1,krok:1,jedn:"",opis:"ustPrzyciaganieOpis",
    norm:poziomPrzyciagania,fmt:v=>tt("przyciaganieWartosc",{poziom:T["przyciaganie_"+poziomPrzyciagania(v)],m:fmtMn(ZC_MN_POMOCY.przyciaganie[poziomPrzyciagania(v)])})},
  {k:"spiewaSama",grupa:"pomoce",typ:"przelacznik",kafle:true,etykieta:"ustSpiewaSama",opis:"ustSpiewaSamaOpis",nazwa:v=>T[v?"spiewaSama_tak":"spiewaSama_nie"],
    punkty:v=>v?ZC_MN_POMOCY.spiewaSama:1},
  {k:"klawDoNuty",grupa:"pomoce",typ:"przelacznik",etykieta:"ustKlawDoNuty",opis:"ustKlawDoNutyOpis",punkty:v=>v?ZC_MN_POMOCY.klawDoNuty:1,punktyKto:"punktyKlawiatura"},
  {k:"podpowiedz",grupa:"pomoce",typ:"przelacznik",etykieta:"ustPodpowiedz",opis:"ustPodpowiedzOpis",punkty:v=>v?ZC_MN_POMOCY.podpowiedz:1},
  {k:"pokazJak",grupa:"pomoce",typ:"przelacznik",etykieta:"ustPokazJak",opis:"ustPokazJakOpis",punkty:()=>null},
  {k:"klawiatura",grupa:"sterowanie",typ:"segment",etykieta:"ustKlawiatura",opcje:["plynnie","szybko"],nazwa:v=>T["klawiatura_"+v],opis:"ustKlawiaturaOpis"},
  {k:"zakres",grupa:"sterowanie",typ:"suwak",etykieta:"ustZakres",min:20,max:60,krok:5,jedn:"°",opis:"ustZakresOpis",zaawansowane:true},
  {k:"odwroc",grupa:"sterowanie",typ:"przelacznik",etykieta:"ustOdwroc",opis:"ustOdwrocOpis",zaawansowane:true},
  {k:"opoznienie",grupa:"sterowanie",typ:"suwak",etykieta:"ustOpoznienie",min:-100,max:300,krok:10,jedn:" ms",opis:"ustOpoznienieOpis",zaawansowane:true},
  {k:"uklad",grupa:"ekran",typ:"segment",etykieta:"ustUklad",opcje:["auto","pasy","kolumny","siatka"],nazwa:v=>T["uklad_"+v],opis:"ustUkladOpis"},
  {k:"tory",grupa:"ekran",typ:"segment",etykieta:"ustTory",opcje:["osobno","chor"],nazwa:v=>T["tory_"+v],opis:"ustToryOpis"},
  {k:"pelnyEkran",grupa:"ekran",typ:"przelacznik",etykieta:"ustPelnyEkran",opis:"ustPelnyEkranOpis"},
  {k:"animacjaPostepu",grupa:"ekran",typ:"przelacznik",etykieta:"ustAnimacjaPostepu",opis:"ustAnimacjaPostepuOpis"},
  {k:"glosnosc",grupa:"dzwiek",typ:"suwak",etykieta:"ustGlosnosc",min:0,max:100,krok:5,jedn:"%",procent:true,opis:"ustGlosnoscOpis"},
  {k:"glos",grupa:"dzwiek",typ:"lista",etykieta:"ustGlosDomyslny",opcje:Glos.INSTRUMENTY_GRACZA,nazwa:v=>T.instrumentyGracza[v]||v,opis:"ustGlosDomyslnyOpis"},
  // efekty instrumentów od razu w ustawieniach gry, nie pod „Więcej”
  {k:"poglos",grupa:"dzwiek",typ:"suwak",etykieta:"ustPoglos",min:0,max:100,krok:5,jedn:"%",procent:true,opis:"ustPoglosOpis"},
  {k:"echo",grupa:"dzwiek",typ:"suwak",etykieta:"ustEcho",min:0,max:100,krok:5,jedn:"%",procent:true,opis:"ustEchoOpis"},
  {k:"silnikMidi",grupa:"dzwiek",typ:"lista",etykieta:"ustSilnikMidi",opcje:Object.keys(ZC_SILNIKI_MIDI),nazwa:v=>T.silnikiMidi[v]||v,opis:"ustSilnikMidiOpis"},
  {k:"instrument",grupa:"dzwiek",typ:"lista",etykieta:"ustPodklad",opcje:Object.keys(T.instrumenty),nazwa:v=>T.instrumenty[v],
    opis:"ustPodkladOpis",zaawansowane:true},
  {k:"glosnoscPodklad",grupa:"dzwiek",typ:"suwak",etykieta:"ustGlosnoscPodklad",min:0,max:100,krok:5,jedn:"%",procent:true,opis:"ustGlosnoscPodkladOpis",zaawansowane:true},
  {k:"glosnoscZaby",grupa:"dzwiek",typ:"suwak",etykieta:"ustGlosnoscZaby",min:0,max:100,krok:5,jedn:"%",procent:true,opis:"ustGlosnoscZabyOpis",zaawansowane:true},
  {k:"glosnoscEfekty",grupa:"dzwiek",typ:"suwak",etykieta:"ustGlosnoscEfekty",min:0,max:100,krok:5,jedn:"%",procent:true,opis:"ustGlosnoscEfektyOpis",zaawansowane:true},
  {k:"dzwiekiUI",grupa:"dzwiek",typ:"przelacznik",kafle:true,opcje:[true,false],etykieta:"ustDzwiekiUI",opis:"ustDzwiekiUIOpis",
    nazwa:v=>T[v?"dzwiekiUI_tak":"dzwiekiUI_nie"],zaawansowane:true},
  {k:"dzwiekiUIGlosnosc",grupa:"dzwiek",typ:"suwak",etykieta:"ustDzwiekiUIGlosnosc",min:0,max:100,krok:5,jedn:"%",procent:true,opis:"ustDzwiekiUIGlosnoscOpis",zaawansowane:true},
  {k:"grafika",grupa:"grafika",typ:"segment",etykieta:"ustGrafika",opcje:["pelna","uproszczona","wydajnosc"],nazwa:v=>T["grafika_"+v],opis:"ustGrafikaOpis",zaawansowane:true},
  {k:"stylGrafik",grupa:"grafika",typ:"segment",etykieta:"ustStylGrafik",opcje:["ilustracja","naszywka"],nazwa:v=>T["stylGrafik_"+v],opis:"ustStylGrafikOpis",zaawansowane:true},
  // język gry nie jest ustawieniem rozgrywki: przełącznik PL/EN siedzi w stopce menu (#menuJezyk, js/jezyk.js, 10-10)
  {k:"klatki",grupa:"grafika",typ:"segment",etykieta:"ustKlatki",opcje:[60,120,0],nazwa:v=>T["klatki_"+v],opis:"ustKlatkiOpis",zaawansowane:true},
  {k:"autoJakosc",grupa:"grafika",typ:"przelacznik",etykieta:"ustAutoJakosc",opis:"ustAutoJakoscOpis",zaawansowane:true}];
// Mnożnik punktów zawsze z dwoma miejscami po przecinku (×1,00, ×0,58), jak przy tempie; fmtMnoznik niżej obcina zera (sława).
const fmtMn=m=>(+m||0).toLocaleString(ZC_LOC,{minimumFractionDigits:2,maximumFractionDigits:2});

// Pełny ekran to stan przeglądarki, nie zapis gry: wymaga gestu (klik w przełącznik) i nie trafia do localStorage.
// Jak w stopce menu: F11 nie zgłasza fullscreenElement, więc liczy się też tryb wyświetlania i okno równe ekranowi.
function czyPelnyEkran(){
  return !!document.fullscreenElement||!!(window.matchMedia&&matchMedia("(display-mode: fullscreen)").matches)||
    (Math.abs(innerWidth-screen.width)<2&&Math.abs(innerHeight-screen.height)<2);
}
function przelaczPelnyEkran(){
  try{
    const p=document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();
    if(p&&p.catch)p.catch(()=>{});
  }catch(e){}
}
document.addEventListener("fullscreenchange",()=>{try{odswiezUstawienia();}catch(e){}});
addEventListener("resize",()=>{try{if(S.ekran==="lobby")odswiezUstawienia();}catch(e){}});
function ustaw(k,v){
  if(k==="pelnyEkran"){przelaczPelnyEkran();return;}
  if(k==="jezyk"){if(typeof RBJezyk!=="undefined")RBJezyk.ustaw(v);return;}   // zapis gry i przeładowanie w nowym języku
  S.ust[k]=v;
  if(ZC_KLUCZE_PRESETU.includes(k)&&!presetUstawien(S.ust))S.ust.presetWlasny=migawkaPresetu(S.ust);   // 10-18: „Własne” w „Poziomie gry”
  if(k==="zakres")Wejscie.ustawZakres(v);
  if(k==="stylGrafik")ustawStylGrafik();
  if(k==="grafika"||k==="autoJakosc")skasujJakoscAuto();   // własny wybór gracza kasuje obniżkę strażnika klatek (także tę czekającą na następną piosenkę)
  if((k==="uklad"||k==="grafika")&&S.gra)ukladGry();   // grafika: rozdzielczość płócien i tło stopnia zależą od trybu
  zapiszUstawienia();
  if(k==="dzwiekiUI"||k==="dzwiekiUIGlosnosc")ustawDzwiekiUI();
  if(/^glosnosc|^poglos$|^echo$/.test(k))ustawGlosnoscGry();
  if(k==="poglos"||k==="echo"){clearTimeout(ustaw.efekt);ustaw.efekt=setTimeout(()=>{try{Glos.probka(S.ust.glos);}catch(e){}},260);}   // słychać od razu, co robi suwak
  // tempo i zakres zmieniają trudność partii: znaczki na kartach graczy i w bibliotece liczą się od nowa
  if((k==="tempo"||k==="zakres"||k==="tryb"||k==="czasNaRuch"||k==="uklad"||k==="tory")&&S.ekran==="lobby"){clearTimeout(ustaw.t);ustaw.t=setTimeout(()=>rysujGraczy(),120);}
}
// „Poziom gry” (10-18): kombinacja spoza zestawów zapamiętuje się jako „Własne” przy każdej zmianie kontrolki, więc kafel
// „Własne” po wypróbowaniu zestawu przywraca dokładnie to, co gracz sobie ułożył. Zestaw wchodzi naraz (bez ustaw() po
// kolei, bo stany pośrednie nadpisałyby „Własne”); kontrolki zestawu nie mają skutków ubocznych poza zapisem i znaczkami trudności.
function migawkaPresetu(u){const o={};for(const k of ZC_KLUCZE_PRESETU)o[k]=k==="przyciaganie"?poziomPrzyciagania(u[k]):u[k];return o;}
function zastosujPreset(id){
  const wzor=id==="wlasne"?S.ust.presetWlasny:(ZC_PRESETY.find(p=>p.k===id)||{}).ust;
  if(!wzor||typeof wzor!=="object")return;
  if(!presetUstawien(S.ust))S.ust.presetWlasny=migawkaPresetu(S.ust);
  for(const k of ZC_KLUCZE_PRESETU)if(typeof wzor[k]===typeof S.ust[k])S.ust[k]=wzor[k];
  zapiszUstawienia();
  if(S.ekran==="lobby"){clearTimeout(ustaw.t);ustaw.t=setTimeout(()=>rysujGraczy(),120);}
  odswiezUstawienia();
}
// Styl grafik motywów (Motywy.ustawWersje): po zmianie grafiki motywów graczy wczytują się od nowa, a w piosence układ
// buduje bufory (fani, żaby) i tło jeszcze raz. Żaba gracza ma wersję w kluczu naklejki (zabaNaklejka).
function ustawStylGrafik(){
  if(typeof Motywy==="undefined"||!Motywy.ustawWersje)return;
  Motywy.ustawWersje(S.ust.stylGrafik);
  try{wczytajGrafikiMotywow();}catch(e){}
  if(S.gra&&R.tory)ukladGry();
}
// Głośności gry (glos.js, 10-10): ogólna na węźle końcowym, podkład / żaby / efekty na swoich szynach.
function ustawGlosnoscGry(){
  if(typeof Glos==="undefined"||!Glos.ustawGlosnosc)return;
  const v=k=>S.ust[k]==null?1:+S.ust[k];
  Glos.ustawGlosnosc({ogolna:v("glosnosc"),podklad:v("glosnoscPodklad"),zaby:v("glosnoscZaby"),efekty:v("glosnoscEfekty")});
  if(Glos.ustawEfekty)Glos.ustawEfekty({poglos:+S.ust.poglos||0,echo:+S.ust.echo||0});   // 10-17: pogłos i echo żab
}
// Dźwięki menu (dzwieki-ui.js, osobny moduł): stan z ustawień po wczytaniu i po każdej zmianie.
// DzwiekiUI to stała skryptu (nie właściwość window), dlatego typeof, a nie window.DzwiekiUI.
function ustawDzwiekiUI(){
  try{if(typeof DzwiekiUI!=="undefined"&&DzwiekiUI&&DzwiekiUI.ustaw)DzwiekiUI.ustaw({wlaczone:!!S.ust.dzwiekiUI,glosnosc:S.ust.dzwiekiUIGlosnosc});}
  catch(e){console.warn("RibbitBeat: dźwięki menu",e);}
}
// Ikona przy opcji bez kafelków (suwak, lista, przełącznik): piktogram z bieżącą wartością (tempo wychyla metronom).
function ikonaUstawienia(u){const sp=h("span","ust-ikona");sp.innerHTML=piktogram(u.k,S.ust[u.k]);return sp;}
// Czerwony przycisk „przytrzymaj, żeby wykasować postęp” z ostrzeżeniem (zbudujUstawienia, w „Więcej ustawień”).
const ZC_KASUJ_MS=3000;
function blokKasowaniaPostepu(){
  const w=h("div","ust ust-kasuj");w.dataset.k="kasujPostep";
  const ost=h("p","kasuj-ostrzezenie");ost.append(h("b","",T.kasujUwaga+" "),T.kasujOpis);
  const b=h("button","kasuj-postep");b.type="button";b.id="btnKasujPostep";
  const pas=h("span","kasuj-pasek"),et=h("span","kasuj-et",T.kasujPrzytrzymaj);b.append(pas,et);
  b.setAttribute("aria-describedby","kasujOstrzezenie");ost.id="kasujOstrzezenie";
  let t0=0,raf=0;
  const stop=()=>{cancelAnimationFrame(raf);raf=0;t0=0;b.style.setProperty("--p","0");b.classList.remove("trzyma");et.textContent=T.kasujPrzytrzymaj;};
  const krok=t=>{const p=Math.min(1,(t-t0)/ZC_KASUJ_MS);b.style.setProperty("--p",p.toFixed(3));
    et.textContent=tt("kasujTrzymaj",{s:Math.max(1,Math.ceil((ZC_KASUJ_MS-(t-t0))/1000))});
    if(p>=1){stop();kasujPostep(klawisz);return;}raf=requestAnimationFrame(krok);};
  let klawisz=false;   // Z-14c: przytrzymanie klawiszem, klawisz wciąż wciśnięty po kasowaniu
  const start=()=>{if(t0)return;t0=performance.now();b.classList.add("trzyma");raf=requestAnimationFrame(krok);};
  b.addEventListener("pointerdown",e=>{if(e.button===0){e.preventDefault();klawisz=false;b.setPointerCapture&&b.setPointerCapture(e.pointerId);start();}});
  for(const ev of ["pointerup","pointercancel","lostpointercapture"])b.addEventListener(ev,stop);
  b.addEventListener("keydown",e=>{if((e.key===" "||e.key==="Enter")){e.preventDefault();e.stopPropagation();if(!e.repeat){klawisz=!t0||klawisz;start();}}});
  b.addEventListener("keyup",e=>{if(e.key===" "||e.key==="Enter"){e.preventDefault();stop();}});
  b.addEventListener("blur",stop);
  b.onclick=e=>e.preventDefault();   // sam klik nic nie kasuje
  w.append(h("span","ust-etykieta",T.kasujTytul),ost,b);
  return w;
}
function kasujPostep(klawisz){
  Postepy.wyzerujWszystko();
  for(const g of S.gracze)g.glosPlanszy=null;
  toast(T.kasujGotowe);
  if(S.ekran==="lobby"){rysujGraczy();zbudujUstawienia();
    // Z-14c (10-18): przycisk kasowania znika z przebudową listy; fokus nie ginie na <body>, tylko idzie na „Mniej ustawień”.
    // Kasowanie klawiszem: Spacja/Enter jest jeszcze wciśnięta, więc powtórzenia i jej puszczenie nie wciskają nowego przycisku
    const p=el("btnWiecej")||document.querySelector("#ustawienia button");
    if(p&&p.offsetParent){
      if(klawisz){const tlum=e=>{if(e.key!==" "&&e.key!=="Enter")return;
          if(e.type==="keyup"){p.removeEventListener("keydown",tlum,true);p.removeEventListener("keyup",tlum,true);}
          if(e.type==="keyup"||e.repeat){e.preventDefault();e.stopPropagation();}};
        p.addEventListener("keydown",tlum,true);p.addEventListener("keyup",tlum,true);}
      p.focus({preventScroll:true});
    }}
}
// „Poziom gry” (10-18): kafle zestawów z mnożnikiem punktów, kafel „Własne” i zdanie o wybranym. Nad grupami ustawień.
function blokPoziomuGry(){
  const s=h("section","ust-poziom");s.setAttribute("aria-labelledby","ustPoziomTytul");
  const glowa=h("div","ust-grupa-glowa"),tyt=h("h3","ust-grupa-tytul",T.grPoziom);tyt.id="ustPoziomTytul";
  const suma=h("span","ust-mn ust-suma");suma.id="ustMnSuma";suma.title=T.mnSumaOpis;
  glowa.append(tyt,suma);
  const kafle=h("div","ust-presety");kafle.setAttribute("role","radiogroup");kafle.setAttribute("aria-labelledby","ustPoziomTytul");
  for(const p of ZC_PRESETY.concat([{k:"wlasne",ikona:"olowek"}])){
    const b=h("button","ust-preset");b.type="button";b.dataset.preset=p.k;b.setAttribute("role","radio");
    b.innerHTML=ikonaFilc(p.ikona,"piktogram");
    b.append(h("span","ust-preset-et",T["preset_"+p.k]),h("span","ust-preset-mn"));
    b.title=T["preset_"+p.k+"Opis"];
    b.onclick=()=>zastosujPreset(p.k);
    kafle.append(b);
  }
  const opis=h("p","ust-grupa-opis ust-preset-opis");opis.id="ustPresetOpis";opis.setAttribute("aria-live","polite");
  s.append(glowa,opisZwijany("ust-grupa-opis",T.grPoziomOpis),kafle,opis);
  return s;
}
// Plakietka „ile to zmienia punkty” przy opcji z `punkty` (trudność i pomoce). Liczba = mnożnik bieżącej wartości;
// przy wyłączonej pomocy plakietka mówi, ile kosztuje jej włączenie; null = bez wpływu na punkty, "bez" = bez mnożnika (tryb nut).
function plakietkaPunktow(b,u,v){
  const m=u.punkty(v);let txt,stan;
  if(m==null){txt=T.mnBezWplywu;stan="bez";}
  else if(m==="bez"){txt=T.mnBezMnoznika;stan="bez";}
  else if(m===1&&u.typ==="przelacznik"){txt=tt("mnPoWlaczeniu",{m:fmtMn(u.punkty(true))});stan="wyl";}
  else{txt=tt("mnPunkty",{m:fmtMn(m)})+(u.punktyKto?" · "+T[u.punktyKto]:"");stan=m<1?"mniej":m>1?"wiecej":"rowno";}
  if(b.textContent!==txt)b.textContent=txt;
  b.dataset.stan=stan;
}
function zbudujUstawienia(){
  const box=el("ustawienia");box.replaceChildren();
  box.append(blokPoziomuGry());
  // grupy (10-18): nagłówek, mnożnik grupy (trudność, pomoce), jedno zdanie opisu; wiersze w kolejności USTAWIENIA_UI
  const grupy={};
  for(const gr of USTAWIENIA_GRUPY){
    const s=h("section","ust-grupa");s.dataset.grupa=gr.g;s.setAttribute("aria-labelledby","ustGr-"+gr.g);
    const glowa=h("div","ust-grupa-glowa"),tyt=h("h3","ust-grupa-tytul",T[gr.tytul]);tyt.id="ustGr-"+gr.g;
    glowa.append(tyt);
    if(gr.punkty){const m=h("span","ust-mn");m.id="ustMnGr-"+gr.g;glowa.append(m);}
    s.append(glowa,opisZwijany("ust-grupa-opis",T[gr.opis]));
    grupy[gr.g]=s;box.append(s);
  }
  for(const u of USTAWIENIA_UI){
    const wiersz=h("div","ust ust-"+u.typ);
    const id="ust-"+u.k;
    // etykieta <label> tylko przy prawdziwej kontrolce; grupa segmentów ma aria-label
    const kafle=u.typ==="segment"||u.kafle;
    let et=h(kafle?"span":"label","ust-etykieta",T[u.etykieta]);if(!kafle)et.htmlFor=id;
    if(!kafle)et.prepend(ikonaUstawienia(u));
    if(u.punkty){   // 10-18: etykieta i plakietka punktów w jednej linii (odswiezUstawienia wpisuje treść)
      const pl=h("span","ust-mn");pl.id="ustMn-"+u.k;const gl=h("div","ust-glowa");gl.append(et,pl);et=gl;
    }
    if(kafle){   // kafelki: piktogram + podpis; wybrany ma ścieg i podskok jak przyciski menu
      const seg=h("div","segment ust-kafle");seg.setAttribute("role","radiogroup");seg.id=id;
      seg.setAttribute("aria-label",T[u.etykieta]);
      for(const v of u.opcje||[false,true]){
        const b=h("button","segment-opcja ust-kafelek");b.type="button";b.dataset.v=String(v);
        b.innerHTML=piktogram(u.k,v);b.append(h("span","ust-kafelek-et",u.nazwa(v)));
        b.setAttribute("role","radio");
        b.onclick=()=>{ustaw(u.k,v);odswiezUstawienia();};
        seg.append(b);
      }
      wiersz.classList.add("ust-segment");
      wiersz.append(et,seg);
    }else if(u.typ==="przelacznik"){
      const b=h("button","przel");b.type="button";b.id=id;b.setAttribute("role","switch");
      b.append(h("span","przel-galka"));
      b.onclick=()=>{ustaw(u.k,!S.ust[u.k]);odswiezUstawienia();};
      wiersz.append(et,b);
    }else if(u.typ==="suwak"){
      const wart=h("output","ust-wartosc");
      const r=h("input","suwak");r.type="range";r.id=id;r.min=u.min;r.max=u.max;r.step=u.krok;
      r.oninput=()=>{const v=u.procent?+r.value/100:+r.value;   // procent: suwak 0–100, w ustawieniach 0..1
        ustaw(u.k,v);wart.textContent=u.fmt?u.fmt(v):(+r.value>0&&u.min<0?"+":"")+r.value+u.jedn;
        const ik=wiersz.querySelector(".ust-ikona");if(ik){ik.innerHTML=piktogram(u.k,v);ik.dataset.w=String(v);}
        if(ZC_KLUCZE_PRESETU.includes(u.k))odswiezPunkty();};   // 10-18: zestaw i mnożniki nadążają za suwakiem
      // 10-18 (C-02): mysz oddaje fokus po puszczeniu (strzałki wracają do gracza), klawiatura zostaje na suwaku:
      // fokusWKontrolce (wejscie.js) traktuje INPUT jako kontrolkę, więc kolejne strzałki zmieniają wartość, nie dołączają gracza
      r.addEventListener("pointerup",()=>r.blur());
      wiersz.append(et,wart,r);
    }else if(u.typ==="lista"){
      const s=h("select","lista");s.id=id;
      // 10-17: instrument nowego gracza tylko spośród zdobytych przez kogokolwiek na tym komputerze; reszta „???” i wyłączona
      const ma=u.k==="glos"?instrumentyZdobyteGdziekolwiek():null;
      let ukryte=0;
      for(const v of u.opcje){if(ma&&!ma.has(v)&&v!==S.ust.glos){ukryte++;continue;}const o=h("option","",u.nazwa(v));o.value=v;s.append(o);}
      if(ukryte){const o=h("option","",tt("instrumentyDoOdkrycia",{n:ukryte}));o.value="";o.disabled=true;s.append(o);}
      s.onchange=()=>{ustaw(u.k,s.value);s.blur();if(u.k==="glos")odsluchajInstrument(s.value);};
      wiersz.append(et,s);
      if(u.k==="glos")wiersz.append(przyciskOdsluchu(()=>odsluchajInstrument(s.value)));   // 10-10: odsłuch głosu domyślnego
    }
    if(u.opis){wiersz.append(opisZwijany("ust-opis",T[u.opis]));wiersz.title=T[u.opis];}
    // 10-18 (Z-51): „Każdy swój” przy więcej niż ZC_MAKS_TOROW graczach gra wspólnym torem; segment mówi to wprost
    if(u.k==="tory"){const uw=h("p","ust-opis ust-tory-uwaga");uw.id="ustToryUwaga";uw.setAttribute("role","status");uw.hidden=true;wiersz.append(uw);}
    wiersz.dataset.k=u.k;
    if(u.zaawansowane)wiersz.classList.add("ust-zaaw");   // 10-18: zaawansowane zostają w swojej grupie, „Więcej ustawień” je odsłania
    (grupy[u.grupa]||box).append(wiersz);
  }
  // Kasowanie postępu stoi za czerwonym przyciskiem z ostrzeżeniem, który trzeba długo przytrzymać: na końcu „Więcej ustawień”, przytrzymanie 3 s myszą albo
  // klawiszem (Spacja/Enter na przycisku); puszczenie wcześniej = nic. Postepy.wyzerujWszystko.
  const kas=blokKasowaniaPostepu();kas.classList.add("ust-zaaw");box.append(kas);
  // 10-15: przełącznik w nagłówku kolumny (jak „Dodaj gracza”): na dole listy leżał poza ekranem (720p y≈1026,
  // 1080p y≈1080); po rozwinięciu lista przewija się do pierwszego odsłoniętego ustawienia
  const stary=el("btnWiecej");if(stary)stary.remove();
  const przel=h("button","przycisk maly ust-wiecej-przelacz");przel.type="button";przel.id="btnWiecej";
  przel.setAttribute("aria-controls","ustawienia");
  przel.onclick=()=>{
    S.wiecejUstawien=!S.wiecejUstawien;zapiszUstawienia();odswiezUstawienia();
    if(S.wiecejUstawien)requestAnimationFrame(()=>{const w=box.querySelector(".ust-zaaw:not([hidden])");if(!w||box.scrollHeight<=box.clientHeight)return;
      box.scrollTo({top:box.scrollTop+w.getBoundingClientRect().top-box.getBoundingClientRect().top-40,behavior:ruchOgraniczony()?"auto":"smooth"});});
  };
  (el("hUst")||box).append(przel);
  odswiezUstawienia();
}
function odswiezUstawienia(){
  for(const u of USTAWIENIA_UI){
    const e=el("ust-"+u.k);if(!e)continue;
    let v=u.k==="jezyk"?(typeof RBJezyk!=="undefined"?RBJezyk.jezyk:"pl"):u.k==="pelnyEkran"?czyPelnyEkran():S.ust[u.k];
    if(u.norm)v=u.norm(v);
    if(u.typ==="segment"||u.kafle)for(const b of e.children)b.setAttribute("aria-checked",String(b.dataset.v===String(v)));
    else if(u.typ==="przelacznik")e.setAttribute("aria-checked",String(!!v));
    else if(u.typ==="suwak"){const sv=u.procent?Math.round(v*100):v;e.value=sv;e.parentNode.querySelector("output").textContent=u.fmt?u.fmt(v):(sv>0&&u.min<0?"+":"")+sv+u.jedn;}
    else if(u.typ==="lista")e.value=v;
    const ik=e.parentNode&&e.parentNode.querySelector(".ust-ikona");   // piktogram z bieżącą wartością
    if(ik&&ik.dataset.w!==String(v)){ik.innerHTML=piktogram(u.k,v);ik.dataset.w=String(v);}
  }
  uwagaTorow();
  odswiezPunkty();
  const przel=el("btnWiecej");
  if(przel){
    przel.textContent=S.wiecejUstawien?T.mniejUstawien:T.wiecejUstawien;
    przel.setAttribute("aria-expanded",String(S.wiecejUstawien));
  }
  // 10-18: zaawansowane w grupach; grupa bez widocznej opcji (Grafika bez „Więcej”) chowa się cała
  const box=el("ustawienia");if(!box)return;
  for(const w of box.querySelectorAll(".ust-zaaw"))w.hidden=!S.wiecejUstawien;
  for(const s of box.querySelectorAll(".ust-grupa"))s.hidden=![...s.querySelectorAll(":scope>.ust")].some(w=>!w.hidden);
}
// Mnożniki punktów (10-18) bez przebudowy listy: zestaw wybrany w „Poziomie gry”, suma, mnożniki grup i plakietki opcji.
function odswiezPunkty(){
  const suma=el("ustMnSuma");if(!suma)return;
  const m=mnoznikPunktowUst(S.ust,false),mk=mnoznikPunktowUst(S.ust,true);
  suma.textContent=tt("mnPunkty",{m:fmtMn(m)})+(mk!==m?" · "+tt("mnKlawiatura",{m:fmtMn(mk)}):"");
  suma.dataset.stan=m<1?"mniej":m>1?"wiecej":"rowno";
  const wybrany=presetUstawien(S.ust),wl=S.ust.presetWlasny&&typeof S.ust.presetWlasny==="object"?S.ust.presetWlasny:null;
  for(const b of document.querySelectorAll("#ustawienia .ust-preset")){
    const k=b.dataset.preset,p=ZC_PRESETY.find(x=>x.k===k),u=p?p.ust:(wybrany?wl:S.ust);
    b.setAttribute("aria-checked",String(k===(wybrany||"wlasne")));
    b.disabled=!p&&!u;
    const mn=b.querySelector(".ust-preset-mn"),txt=u?"×"+fmtMn(mnoznikPunktowUst(Object.assign({},S.ust,u),false)):"";
    if(mn.textContent!==txt)mn.textContent=txt;
  }
  const op=el("ustPresetOpis");if(op){const t=T["preset_"+(wybrany||"wlasne")+"Opis"];if(op.textContent!==t)op.textContent=t;}
  for(const gr of USTAWIENIA_GRUPY)if(gr.punkty){const e=el("ustMnGr-"+gr.g);if(!e)continue;const x=gr.punkty();
    e.textContent="×"+fmtMn(x);e.dataset.stan=x<1?"mniej":x>1?"wiecej":"rowno";}
  for(const u of USTAWIENIA_UI)if(u.punkty){const b=el("ustMn-"+u.k);if(b)plakietkaPunktow(b,u,S.ust[u.k]);}
}
// Z-51 (10-18): podzialNaToryOsobno przy liczbie graczy > ZC_MAKS_TOROW wraca do chóru; zdanie pod segmentem „Tory”
function uwagaTorow(){
  const uw=el("ustToryUwaga");if(!uw)return;
  const pokaz=S.ust.tory==="osobno"&&S.gracze.length>ZC_MAKS_TOROW;
  uw.hidden=!pokaz;if(pokaz)uw.textContent=tt("toryUwagaWspolny",{n:ZC_MAKS_TOROW});
}
// Lista piosenek to biblioteka (biblioteka.js): karty z miniaturą rolki, filtry, folder, bitmidi.
function wybierzPiosenke(i){
  if(i<0||i>=S.piosenki.length)return;
  kolKandydatId=null;clearTimeout(kolZatwierdzCzas);   // piosenka wybrana wprost: koło nie ma już nic do zatwierdzenia
  S.idx=i;S.czekaNaId=null;
  for(const g of S.gracze)if(g.partia>=piosenka().partie.length)g.partia=0;
  zapiszUstawienia();Biblioteka.odswiez();rysujGraczy();rysujWybrana();rysujKonfPiosenke();
  const karta=document.querySelector('.bkarta[data-id="'+CSS.escape(piosenka().id)+'"]');
  if(!karta||!karta.offsetParent)return;
  if(!wysrodkujNaLiscie(karta,true))karta.scrollIntoView({block:"nearest"});   // krok „1 Piosenka”: wybrany zawsze na środku koła
}
function wybierzPiosenkeId(id){const i=S.piosenki.findIndex(p=>p.id===id);if(i>=0)wybierzPiosenke(i);}

// ---- gracze w lobby ----
// Nazwa, kolor, kapsel i źródło kopiowane do gracza przy dołączeniu: kapsel, który zniknie w trakcie
// piosenki, nadal ma imię w HUD i w wynikach (a nie „bot-2”) i dalej liczy się z opóźnieniem kapsla.
function dolacz(id){
  if(S.gracze.some(g=>g.id===id))return null;
  if(S.gracze.length>=ZC_MAKS_GRACZY){toast(T.komplet);return null;}
  const w=Wejscie.gracz(id);if(!w)return null;
  const g={id,nazwa:w.nazwa||id,kolor:w.kolor,obrazekKapsla:w.obrazekKapsla,zrodlo:w.zrodlo,etykieta:w.etykieta||"",
    partia:0,gotowy:w.zrodlo==="bot",rollWolny:true,ziarno:S.gracze.length*1.37+.4,dolaczyl:S.gracze.length,
    poziom:w.poziom||null};
  if(g.zrodlo==="kapsel")profilKapsla(g);
  S.gracze.push(g);
  rysujGraczy();
  return g;
}
// Kapsel pamięta ostatni profil (Postepy.kapsel, 10-10): dołącza od razu jako on i z jego ulubionym kolorem.
function profilKapsla(g){
  let n=null;try{n=Postepy.kapsel(g.id);}catch(e){}
  if(!n)return;
  g.nazwa=n;g.nazwaWlasna=true;
  const k=Postepy.kolor(n);if(k){g.kolor=k;g.kolorWlasny=true;}
}
// Kapsel dołącza przyciskiem na każdym ekranie przed grą: toast i od razu pilot (jego puszczenie nie jest „ok”).
function dolaczKapsel(w){
  const g=dolacz(w.id);if(!g)return null;
  toast(tt("dolacza",{nazwa:g.nazwa}));
  S.piloty[w.id]={stan:{blokada:true,wcisniety:true,trzyma:0}};S.pilot=w.id;
  return g;
}
function odlacz(id){
  S.gracze=S.gracze.filter(g=>g.id!==id);
  rysujGraczy();
}
// ---- skład (runda 3): wybór gracza, zmiana źródła, nazwa, kolor, kolejność, zapis ----
const ZC_SKLAD_KLUCZ="ribbitflip.zabiChor.sklad";
// Discord (plan progresji §7): ogólne zaproszenie do menu i zaproszenie celujące w #pochwal-się do wyników. Panel ma
// własną kopię (RF_INVITE_HEADER, RF_INVITE_SHOWCASE w web/js/rf-00-core.js), bo gra działa też jako osobny EXE bez
// panelu; test pilnuje, że adresy są równe. Zwykłe odnośniki target=_blank, bez fetchów, iframe i webhooków.
const ZC_DISCORD={serwer:"https://discord.gg/tyv2MjjVdb",pochwal:"https://discord.gg/7H2gsjTe3T"};
const ZC_PALETA=["#ec1a83","#6cb33f","#eaa32b","#294aa8","#b8264a","#8e6fe6","#2aa198","#c98a14"];
function zapiszSkladTeraz(){
  if(!S.skladOdtworzony||S.odtwarzanie||S.skladZAdresu)return;
  try{localStorage.setItem(ZC_SKLAD_KLUCZ,JSON.stringify(zapiszSklad(S.gracze)));}catch(e){}
}
// Źródło z wyboru: {rodzaj:"mysz"|"ws"|"strzalki"|"pad"|"bot"|"kapsel", nr (pad), poziom (bot), id (kapsel)} → id źródła albo null.
function zrodloZWyboru(w){
  if(w.rodzaj==="mysz")return "mysz";
  if(w.rodzaj==="ws"||w.rodzaj==="strzalki"){const g=Wejscie.utworzKlawiature(w.rodzaj);return g&&g.id;}
  if(w.rodzaj==="pad"){const g=Wejscie.utworzPad(w.nr);return g&&g.id;}
  if(w.rodzaj==="bot")return Wejscie.dodajBota(w.poziom||poziomBotaZUstawien()).id;
  if(w.rodzaj==="kapsel")return Wejscie.gracz(w.id)?w.id:null;
  return null;
}
// Dodanie albo zamiana „w miejscu” (ta sama pozycja, partia, ręczna nazwa i kolor zostają).
function wybierzGracza(w,zamien){
  const id=zrodloZWyboru(w);zamknijWyborGracza();
  if(!id)return null;
  const stary=zamien&&S.gracze.find(g=>g.id===zamien);
  if(stary&&stary.id===id)return stary;
  const g=dolacz(id);if(!g)return null;
  if(stary){
    const i=S.gracze.indexOf(stary);S.gracze.splice(S.gracze.indexOf(g),1);S.gracze.splice(i,0,g);
    g.partia=stary.partia;
    if(stary.nazwaWlasna){g.nazwa=stary.nazwa;g.nazwaWlasna=true;}
    if(stary.kolorWlasny){g.kolor=stary.kolor;g.kolorWlasny=true;}
    if(stary.pomoce&&stary.zrodlo!=="bot"&&g.zrodlo!=="bot"){g.pomoce=stary.pomoce;g.pomoceProfil=undefined;}   // ta sama osoba, inne sterowanie
    S.gracze=S.gracze.filter(x=>x!==stary);
    if(stary.zrodlo==="bot")Wejscie.usun(stary.id);
    rysujGraczy();
  }
  return g;
}
function zmienNazwe(g,n){
  n=String(n||"").trim().slice(0,18);
  if(!n||n===g.nazwa)return;
  g.nazwa=n;g.nazwaWlasna=true;zapiszSkladTeraz();
  if(g.zrodlo==="kapsel")try{Postepy.przypiszKapsel(g.id,n);}catch(e){}   // kapsel zapamięta ten profil
  // 10-18 wieczór: nowy profil przynosi swoje pomoce (albo przejmuje obecne); karta od nowa tylko, gdy coś się zmieniło
  const przed=JSON.stringify(g.pomoce||null);synchronizujPomoce(g);
  if(JSON.stringify(g.pomoce||null)!==przed&&S.ekran==="lobby")rysujGraczy();
}
function zmienKolor(g){
  const i=ZC_PALETA.indexOf(g.kolor);g.kolor=ZC_PALETA[(i+1)%ZC_PALETA.length];g.kolorWlasny=true;rysujGraczy();
}
function przesunGracza(g,kier){
  const i=S.gracze.indexOf(g),j=i+kier;if(i<0||j<0||j>=S.gracze.length)return;
  S.gracze[i]=S.gracze[j];S.gracze[j]=g;rysujGraczy();
}
// Odtworzenie zapisanego składu przy pierwszym wejściu do kroku 2 (gracze z adresu harnessu wygrywają).
function odtworzSkladTeraz(){
  let zapis=null;try{zapis=JSON.parse(localStorage.getItem(ZC_SKLAD_KLUCZ)||"null");}catch(e){}
  const kapsle=Wejscie.gracze().filter(w=>w.zrodlo==="kapsel").map(w=>w.id);
  const r=odtworzSklad(zapis,{kapsle,pady:Wejscie.pady().map(n=>"pad-"+n),zajete:S.gracze.map(g=>g.id)},ZC_MAKS_GRACZY);
  S.odtwarzanie=true;
  try{
    for(const x of r.gracze){
      const id=zrodloZWyboru({rodzaj:x.zrodlo,nr:x.id?+String(x.id).replace("pad-",""):0,poziom:x.poziom,id:x.id});
      const g=id&&dolacz(id);if(!g)continue;
      if(x.nazwa){g.nazwa=x.nazwa;g.nazwaWlasna=true;}
      if(x.kolor){g.kolor=x.kolor;g.kolorWlasny=true;}
      if(x.pomoce){g.pomoce=x.pomoce;g.pomoceProfil=undefined;}   // gość ze składu (profil, jeśli ma pomoce, wygra w synchronizujPomoce)
      g.partia=Math.min(x.partia,Math.max(0,piosenka().partie.length-1));
    }
  }finally{S.odtwarzanie=false;}
  rysujGraczy();
}
// Okno wyboru: Człowiek (mysz, W/S, strzałki, pady; zajęte wyszarzone), Bot (poziom od razu), Kapsel (czekające).
function otworzWyborGracza(o){
  o=o||{};const box=el("wyborGracza");if(!box)return;
  schowajToast();   // Z-87: toast poprzedniego okna nie zostaje pod nowym
  const stary=o.zamien&&S.gracze.find(g=>g.id===o.zamien);
  const karta=h("div","karta tablica-karta okno-karta wybor-karta");karta.setAttribute("role","dialog");karta.setAttribute("aria-modal","true");
  const glowa=h("header","tablica-glowa");
  const tyt=h("h2","tablica-tytul",stary?tt("wyborZamienTytul",{nazwa:stary.nazwa}):T.wyborTytul);tyt.id="wyborTytul";karta.setAttribute("aria-labelledby","wyborTytul");
  const zam=h("button","gracz-usun tablica-zamknij","×");zam.type="button";zam.setAttribute("aria-label",T.oknoZamknij);zam.title=T.oknoZamknij;
  zam.onclick=()=>zamknijWyborGracza();
  glowa.append(tyt,zam);
  const zajete=new Set(S.gracze.map(g=>g.id));
  const przycisk=(et,opis,w,id,kolor)=>{
    const b=h("button","wybor-opcja");b.type="button";
    if(kolor)b.style.setProperty("--kolor",kolor);
    b.append(h("b","",et));if(opis)b.append(h("span","",opis));
    const zajety=id&&zajete.has(id)&&!(stary&&stary.id===id);
    if(zajety){b.disabled=true;b.append(h("span","wybor-zajete",T.wyborZajete));}
    b.onclick=()=>{Glos.odblokuj();wybierzGracza(w,stary&&stary.id);};
    return b;
  };
  const sekcja=(tytul,...el)=>{const d=h("section","wybor-sekcja");d.append(h("h3","okno-sekcja",tytul));const r=h("div","wybor-rzad");r.append(...el);d.append(r);return d;};
  const ludzie=[przycisk(T.graczMysz,T.pomoc_mysz,{rodzaj:"mysz"},"mysz","#d81678"),
    przycisk(T.graczWS,T.pomoc_ws,{rodzaj:"ws"},"ws","#46781f"),przycisk(T.graczStrzalki,T.pomoc_strzalki,{rodzaj:"strzalki"},"strzalki","#c98a14")];
  const pady=Wejscie.pady();
  for(const n of pady)ludzie.push(przycisk(tt("wyborPad",{n:n+1}),T.pomoc_pad,{rodzaj:"pad",nr:n},"pad-"+n,"#294aa8"));
  if(!pady.length){const b=h("button","wybor-opcja");b.type="button";b.disabled=true;b.append(h("b","",T.graczPad),h("span","",T.wyborBrakPada));ludzie.push(b);}
  // 10-17: jeden przycisk „Robo-żaba” (ostatni poziom); poziom wybiera się potem na karcie bota, kaflem z robo-żabą
  const pb=poziomBotaZUstawien(),bot=przycisk(T.wyborRobo,tt("wyborRoboOpis",{poziom:T["poziom_bota_"+pb]}),{rodzaj:"bot",poziom:pb},null,"#8e6fe6");
  {const im=h("img","wybor-robo");im.src=roboObrazek(pb);im.alt="";bot.classList.add("wybor-opcja-robo");bot.prepend(im);}
  const boty=[bot];
  const kapsle=Wejscie.gracze().filter(w=>w.zrodlo==="kapsel").map(w=>przycisk(w.nazwa,w.etykieta||T.zrodlo_kapsel,{rodzaj:"kapsel",id:w.id},w.id,w.kolor));
  const cialo=h("div","okno-cialo");
  cialo.append(sekcja(T.wyborCzlowiek,...ludzie),sekcja(T.wyborBot,...boty),
    kapsle.length?sekcja(T.wyborKapsel,...kapsle):sekcja(T.wyborKapsel,h("p","biblio-nota",T.wyborBrakKapsli)));
  karta.append(glowa,cialo);box.replaceChildren(karta);box.hidden=false;
  S.wyborZ=o.powrot||document.activeElement;
  const start=o.mysz?ludzie[0]:cialo.querySelector(".wybor-opcja:not(:disabled)");
  if(start)start.focus({preventScroll:true});
}
function zamknijWyborGracza(){
  const box=el("wyborGracza");if(!box||box.hidden)return;
  box.hidden=true;box.replaceChildren();
  const z=S.wyborZ;S.wyborZ=null;
  if(typeof z==="function"){try{z();}catch(e){console.error(e);}return;}   // okno otwarte z Konta albo Profili: powrót do nich
  if(z&&z.isConnected&&z.focus)z.focus({preventScroll:true});
}
function zmienPartie(g,kier){
  const n=piosenka().partie.length;
  g.partia=((g.partia+kier)%n+n)%n;
  g.gotowy=false;
  Biblioteka.pokazPartie(g.partia,g.id);   // podgląd partii pokazuje to, co gracz właśnie wybrał
  rysujGraczy();
}
function przelaczGotowy(g){g.gotowy=!g.gotowy;rysujGraczy();}
// Instrument gracza: zapamiętany dla jego id (kapsel, mysz, pad, bot) albo domyślny z ustawień, ale (10-16) tylko
// spośród odblokowanych przez jego profil (Postepy.instrumenty: na start Ribbit, potem jeden-dwa na stopień sławy).
// Zablokowany wybór = najwyższy odblokowany. Boty śpiewają każdym instrumentem.
function instrumentyGracza(g){
  if(!g||g.zrodlo==="bot"||typeof Postepy==="undefined"||!Postepy.instrumenty)return Glos.INSTRUMENTY_GRACZA;
  const odb=Postepy.instrumenty(Postepy.nazwaProfilu(g));
  const lst=odb.filter(i=>Glos.jestInstrument(i));   // 10-16: w kolejności drogi (Postepy.INSTRUMENTY_KOLEJNOSC)
  // 10-16: własne instrumenty ze Studia dźwięków (js/studio.js) po zdobyciu wszystkiego, na końcu listy
  try{if(typeof Studio!=="undefined"&&Studio.dostepne&&Studio.dostepne())for(const i of Studio.lista())if(Glos.jestInstrument(i))lst.push(i);}catch(e){}
  return lst;
}
// Instrumenty zdobyte przez którykolwiek profil na tym komputerze (lista „Instrument nowego gracza”); null = bez postępów.
function instrumentyZdobyteGdziekolwiek(){
  if(typeof Postepy==="undefined"||!Postepy.instrumenty||!Postepy.lista)return null;
  const out=new Set();
  try{for(const p of Postepy.lista())for(const i of Postepy.instrumenty(p.nazwa))out.add(i);}catch(e){return null;}
  return out;
}
function instrumentGracza(g){
  if(ZC_DEV.instrument&&Glos.jestInstrument(ZC_DEV.instrument))return ZC_DEV.instrument;   // DEV: ten sam instrument wszystkim, bez blokad
  const z=(S.ust.instrumentyGraczy||{})[g.id],L=instrumentyGracza(g);
  if(Glos.jestInstrument(z)&&L.includes(z))return z;
  if(Glos.jestInstrument(S.ust.glos)&&L.includes(S.ust.glos))return S.ust.glos;
  const odb=typeof Postepy!=="undefined"&&Postepy.instrumenty&&g.zrodlo!=="bot"?Postepy.instrumenty(Postepy.nazwaProfilu(g)):null;
  return odb&&odb.length?odb[odb.length-1]:L.includes("ribbit")?"ribbit":L[0]||"trabka";
}
function zmienInstrument(g,kier){
  const L=instrumentyGracza(g),n=L.length,i=Math.max(0,L.indexOf(instrumentGracza(g)));
  const v=L[((i+kier)%n+n)%n];
  S.ust.instrumentyGraczy=Object.assign({},S.ust.instrumentyGraczy,{[g.id]:v});
  zapiszUstawienia();
  odsluchajInstrument(v,przejsciaGracza(g,v));
  rysujGraczy();
}
// Przejścia między nutami (każdy instrument da się przełączyć, jak ma brzmieć; przełącznik jest w oknie konfiguracji
// gracza, a nie na instrumentach, i dla DANEGO instrumentu daje wybór: płynnie, skokowo albo domyślnie): przełącznik mieszka w oknie „Pomoce: <gracz>” (bot: „Poziom: <bot>”),
// ale wybór dotyczy pary (gracz, instrument), czyli instrumentu, który gracz ma teraz. "auto" = domyślnie, jak brzmi najlepiej
// (Glos.domyslnePrzejscia, przydział w glos.js przy Z_PROBEK), "plynne" albo "skok" = ten tryb tylko dla tego instrumentu.
// S.ust.przejsciaGraczy[gracz][instrument] (ten sam klucz gracza co instrumentyGraczy), zapis z ustawieniami gry; brak klucza
// = domyślnie (zapis z porannej wersji 10-22, gdzie pod kluczem gracza leżał sam tryb, czyta się jak „domyślnie”).
// Głos gracza powstaje na starcie piosenki z trybem przejsciaGracza (start gry i ZC.dev.instrument).
const ZC_PRZEJSCIA_GRACZA=["auto","plynne","skok"];
function wyborPrzejscGracza(g,id){
  const w=(S.ust.przejsciaGraczy||{})[g&&g.id],v=w&&typeof w==="object"?w[id||instrumentGracza(g)]:null;
  return v==="plynne"||v==="skok"?v:"auto";
}
function przejsciaGracza(g,id){id=id||instrumentGracza(g);const v=wyborPrzejscGracza(g,id);return v==="auto"?Glos.domyslnePrzejscia(id):v;}
function ustawPrzejsciaGracza(g,v,id){
  id=id||instrumentGracza(g);
  const w=Object.assign({},S.ust.przejsciaGraczy),stare=w[g.id],m=Object.assign({},stare&&typeof stare==="object"?stare:null);
  if(v==="plynne"||v==="skok")m[id]=v;else delete m[id];
  if(Object.keys(m).length)w[g.id]=m;else delete w[g.id];
  S.ust.przejsciaGraczy=w;zapiszUstawienia();
}
// Grupa „Przejścia między nutami” w oknie gracza: te same kafelki co pomoce obok (piktogram, podpis), plakietka „bez mnożnika”
// (to brzmienie; punkty liczą się z wysokości śpiewu, nie z dźwięku), zdanie opisu. Klik zapisuje, odsłuchuje instrument
// gracza w nowym trybie i woła `poZmianie` (okno przerysowuje karty: ikonka trybu na kaflu „Pomoce” / „Poziom”).
function grupaPrzejsc(g,poZmianie){
  const w=h("div","ust ust-segment pomoce-grupa przejscia-grupa");w.dataset.k="przejscia";
  const gl=h("div","ust-glowa"),pl=h("span","ust-mn",T.mnBezMnoznika);pl.dataset.stan="bez";
  const nzI=T.instrumentyGracza[instrumentGracza(g)]||instrumentGracza(g),tyt=tt("przejsciaTytulInstr",{instrument:nzI});
  gl.append(h("span","ust-etykieta",tyt),pl);
  const seg=h("div","segment ust-kafle");seg.setAttribute("role","radiogroup");seg.setAttribute("aria-label",tyt);
  const op=h("p","ust-opis");
  const odswiez=()=>{
    const v=wyborPrzejscGracza(g),id=instrumentGracza(g);
    for(const b of seg.children)b.setAttribute("aria-checked",String(b.dataset.v===v));
    op.textContent=tt("przejsciaOpis_"+v,{instrument:T.instrumentyGracza[id]||id,tryb:T["przejsciaTryb_"+Glos.domyslnePrzejscia(id)]});
  };
  for(const v of ZC_PRZEJSCIA_GRACZA){
    const b=h("button","segment-opcja ust-kafelek");b.type="button";b.dataset.v=v;b.setAttribute("role","radio");
    b.innerHTML=v==="plynne"?piktogram("tryb","plynny"):v==="skok"?piktogram("tryb","klasyczny"):piktogram("instrument",instrumentGracza(g));
    b.append(h("span","ust-kafelek-et",T["przejscia_"+v]));
    b.title=v==="auto"?T.przejsciaDymek_auto:tt("przejsciaOpis_"+v,{instrument:nzI});
    b.onclick=()=>{ustawPrzejsciaGracza(g,v);odswiez();odsluchajInstrument(instrumentGracza(g),przejsciaGracza(g));if(poZmianie)poZmianie();};
    seg.append(b);
  }
  w.append(gl,seg,op);odswiez();
  return {w,seg,odswiez};
}
// Ikonka wymuszonego trybu na kaflu karty (Pomoce u człowieka, Poziom u bota) i zdanie do dymka; "auto" = nic.
function ikonkaPrzejsc(g){const v=wyborPrzejscGracza(g);return v==="auto"?"":ikonaFilc(v==="skok"?"tryb-klasyczny":"tryb-plynny");}
function dymekPrzejsc(g){const v=wyborPrzejscGracza(g);return v==="auto"?"":" "+tt("przejsciaKafel",{tryb:T["przejscia_"+v]});}
// Odsłuch instrumentu (10-10): najpierw cisza po podsłuchu utworu, bo dwa dźwięki naraz to szum, potem fraza z glos.js.
// `przejscia` (10-21 wieczór): tryb przejść gracza, żeby odsłuch brzmiał tak, jak zagra.
function odsluchajInstrument(v,przejscia){
  try{if(typeof Biblioteka!=="undefined"&&Biblioteka.podsluch&&typeof Biblioteka.podsluch.stop==="function")Biblioteka.podsluch.stop();
    else if(typeof zatrzymajPodglad==="function")zatrzymajPodglad();}catch(e){}
  Glos.probka(v,false,przejscia?{przejscia}:undefined);
}
function przyciskOdsluchu(fn){
  const b=h("button","strzalka mala odsluch");b.type="button";b.innerHTML=ikonaFilc("graj","ikona-filc");   // 10-15: filc
  b.title=T.odsluchInstrumentu;b.setAttribute("aria-label",T.odsluchInstrumentu);   // 10-17: podpis wypadł do komentarza
  b.onclick=e=>{e.stopPropagation();fn();b.blur();};
  return b;
}
// Poziom bota strzałkami na jego karcie: Łatwy ↔ Średni ↔ Trudny ↔ Mistrz (bez zawijania: Mistrz to szczyt).
// Wybrany poziom zostaje domyślnym dla następnego „Dodaj bota”.
const ZC_POZIOMY_BOTA=["latwy","sredni","trudny","mistrz"];
function zmienPoziomBota(g,kier){
  const i=ZC_POZIOMY_BOTA.indexOf(g.poziom),j=Math.max(0,Math.min(ZC_POZIOMY_BOTA.length-1,(i<0?1:i)+kier));
  ustawPoziomBotaGracza(g,ZC_POZIOMY_BOTA[j]);
}
function ustawPoziomBotaGracza(g,k){
  if(k===g.poziom)return;
  Wejscie.ustawPoziomBota(g.id,k);g.poziom=k;
  S.ust.poziomBota=k;zapiszUstawienia();
  rysujGraczy();
}
function poziomBotaZUstawien(){return ZC_POZIOMY_BOTA.includes(S.ust.poziomBota)?S.ust.poziomBota:"sredni";}
// Robo-żaba (10-17): przebranie bota = jego poziom (Motywy: robo-latwy … robo-mistrz); bot z własnym luzem (DEV) = Średni.
const roboPrzebranie=k=>"robo-"+(ZC_POZIOMY_BOTA.includes(k)?k:"sredni");
const roboObrazek=(k,klatka)=>"../assets/frog/robo/"+roboPrzebranie(k).slice(5)+"/glowa-"+(klatka||"2")+".webp";
// Obrazek poziomu: głowa robo-żaby i kropki 1–4 (ile „czipów” ma bot), wspólne dla kafla w karcie i okna wyboru.
function obrazPoziomu(box,k){
  const im=h("img","robo-glowa");im.src=roboObrazek(k);im.alt="";im.draggable=false;
  const kr=h("span","robo-kropki"),n=ZC_POZIOMY_BOTA.indexOf(k)+1;
  for(let i=1;i<=ZC_POZIOMY_BOTA.length;i++)kr.append(h("i",i<=n?"pelna":""));
  box.replaceChildren(im,kr);box.dataset.poziom=k||"";
}
// Okno „Poziom bota”: cztery robo-żaby obok siebie, klik = poziom (jak okno instrumentów dla instrumentu).
function otworzWyborPoziomu(g,powrot){
  const box=el("wyborGracza");if(!box)return;
  schowajToast();   // Z-87
  const karta=h("div","karta tablica-karta okno-karta scena-karta instr-karta poziom-karta");karta.setAttribute("role","dialog");karta.setAttribute("aria-modal","true");
  karta.setAttribute("aria-labelledby","poziomTytul");
  const glowa=h("header","tablica-glowa"),tyt=h("h2","tablica-tytul",tt("poziomBotaTytul",{nazwa:g.nazwa}));tyt.id="poziomTytul";
  const zam=h("button","gracz-usun tablica-zamknij","×");zam.type="button";zam.setAttribute("aria-label",T.oknoZamknij);zam.title=T.oknoZamknij;
  zam.onclick=()=>zamknijWyborGracza();
  glowa.append(tyt,zam);
  const cialo=h("div","okno-cialo scena-cialo");
  cialo.append(h("p","okno-wstep",T.poziomBotaWstep));
  const rz=h("div","poziom-siatka");rz.setAttribute("role","radiogroup");rz.setAttribute("aria-label",T.poziomBota);
  const odswiez=()=>{for(const b of rz.children)b.setAttribute("aria-checked",String(b.dataset.v===g.poziom));};
  for(const k of ZC_POZIOMY_BOTA){
    const b=h("button","poziom-kafel");b.type="button";b.dataset.v=k;b.setAttribute("role","radio");
    const ob=h("span","poziom-obraz");obrazPoziomu(ob,k);
    b.append(ob,h("b","poziom-kafel-nazwa",T["poziom_bota_"+k]),h("span","poziom-kafel-opis",T["poziomBotaOpis_"+k]));
    b.setAttribute("aria-label",T["poziom_bota_"+k]+". "+T["poziomBotaOpis_"+k]);
    b.onclick=()=>{
      ustawPoziomBotaGracza(g,k);odswiez();
      if(S.gracze.includes(g)){const n=document.querySelector('.gracz[data-id="'+CSS.escape(g.id)+'"] .kw-glowny[data-typ="poziom"]');if(n)S.wyborZ=n;}
    };
    rz.append(b);
  }
  odswiez();
  // 10-22: przejścia między nutami bota — ta sama grupa co w oknie „Pomoce” człowieka (okno konfiguracji gracza); po kliku
  // karta przerysowuje się (ikonka na kaflu Poziom), a fokus wraca do nowego kafla Poziom
  const przejscia=grupaPrzejsc(g,()=>{if(S.gracze.includes(g)){rysujGraczy();const n=document.querySelector('.gracz[data-id="'+CSS.escape(g.id)+'"] .kw-glowny[data-typ="poziom"]');if(n)S.wyborZ=n;}});
  cialo.append(rz,przejscia.w);karta.append(glowa,cialo);box.replaceChildren(karta);box.hidden=false;
  S.wyborZ=powrot||document.activeElement;
  const cel=rz.querySelector('[aria-checked="true"]')||rz.firstChild;
  if(cel)cel.focus({preventScroll:true});
}
// Karta bota (poziom trudności wybiera się wizualnie przy żabie, tak jak człowiek wybiera swój skin, a nie w osobnym
// menu; botowi też da się wybrać instrument i ścieżkę jak człowiekowi): kafel
// Poziom z robo-żabą w miejscu kafla Skin i ten sam kafel Instrument co u człowieka (bot ma wszystkie instrumenty).
function rzadBota(g){
  const rz=h("div","gracz-kafle gracz-kafle-bot"),i=ZC_POZIOMY_BOTA.indexOf(g.poziom);
  const kp=kafelWyboru("poziom",{etykieta:T.poziomBota,poprzedni:T.poziomBotaZmien+": "+T.poziom_bota_latwy,nastepny:T.poziomBotaZmien+": "+T.poziom_bota_mistrz,
    krok:d=>{zmienPoziomBota(g,d);fokusWKarcie(g,'.kw[data-typ="poziom"] .kw-'+(d<0?"lewo":"prawo"));},
    otworz:b=>otworzWyborPoziomu(g,b)});
  obrazPoziomu(kp.obraz,g.poziom);kp.nz.textContent=nazwaPoziomuBota(g);kp.kw.dataset.poziom=g.poziom||"";
  const kl=kp.kw.querySelector(".kw-lewo"),kpr=kp.kw.querySelector(".kw-prawo");
  if(g.poziom){kl.disabled=i===0;kpr.disabled=i===ZC_POZIOMY_BOTA.length-1;}
  {const opis=T.poziomBota+": "+nazwaPoziomuBota(g)+". "+T.poziomBotaOtworz;kp.b.title=opis;kp.b.setAttribute("aria-label",opis);}
  const id=instrumentGracza(g),nzI=T.instrumentyGracza[id]||id;
  const ki=kafelWyboru("instrument",{etykieta:T.instrumentGracza,poprzedni:T.poprzedniInstrument,nastepny:T.nastepnyInstrument,
    krok:d=>{zmienInstrument(g,d);fokusWKarcie(g,'.kw[data-typ="instrument"] .kw-'+(d<0?"lewo":"prawo"));},
    otworz:b=>otworzWyborInstrumentu(g,b)});
  obrazInstrumentu(ki.obraz,id);ki.nz.textContent=nzI;
  {const opis=T.instrumentGracza+": "+nzI+". "+T.kartaInstrumentOtworz;ki.b.title=opis;ki.b.setAttribute("aria-label",opis);}
  const od=przyciskOdsluchu(()=>odsluchajInstrument(instrumentGracza(g),przejsciaGracza(g)));od.classList.add("kw-odsluch");ki.kw.append(od);
  // 10-22: wymuszony tryb przejść bota (okno „Poziom”) jako ikonka w rogu kafla Poziom i zdanie w jego dymku
  {const ik=ikonkaPrzejsc(g);if(ik){const s=h("span","kw-pomoce-ikony kw-przejscia-ikona");s.innerHTML=ik;kp.obraz.append(s);
    kp.b.title+=dymekPrzejsc(g);kp.b.setAttribute("aria-label",kp.b.title);}}
  rz.append(kp.kw,ki.kw);
  return rz;
}
function nazwaPoziomuBota(g){
  if(g.poziom)return T["poziom_bota_"+g.poziom];
  const w=zrodloGracza(g),luz=w&&w._bot&&w._bot.luz;
  return tt("poziomBotaWlasny",{n:(luz||0).toLocaleString(ZC_LOC,{maximumFractionDigits:2})});
}
// Trudność partii `i` piosenki `p` przy obecnym tempie i zakresie, liczona raz na (piosenka, partia, tempo, zakres).
const ZC_TRUDNOSC_PAMIEC=new WeakMap();
function trudnoscPartiiW(p,i){
  const x=p&&p.partie[i];if(!x)return null;
  const bpm=p.tempo*S.ust.tempo/100,k=i+"|"+bpm+"|"+S.ust.zakres+(S.ust.tryb==="plynny"?"|p":"")+(procentRuchu(S.ust.czasNaRuch)?"|r"+procentRuchu(S.ust.czasNaRuch):"");
  let m=ZC_TRUDNOSC_PAMIEC.get(p);if(!m)ZC_TRUDNOSC_PAMIEC.set(p,m=new Map());
  if(!m.has(k)){const tr=trudnoscPartii(przygotujPartie(x,S.ust,bpm).nuty,bpm,S.ust.zakres);tr.bpm=bpm;tr.ruch=procentRuchu(S.ust.czasNaRuch);m.set(k,tr);}
  return m.get(k);
}
// Zakres trudności wszystkich partii piosenki przy obecnych ustawieniach: {min,max,od,do,tekst} albo null, gdy partia
// jest jedna albo wszystkie wychodzą tak samo (wtedy sama liczba melodii mówi wszystko). Liczby jak na znaczkach
// (jedno miejsce po przecinku); każda partia liczy się raz (pamięć trudnoscPartiiW).
function zakresTrudnosci(p){
  if(!p||!p.partie||p.partie.length<2)return null;
  let min=Infinity,max=-Infinity;
  for(let i=0;i<p.partie.length;i++){const tr=trudnoscPartiiW(p,i);if(!tr)continue;min=Math.min(min,tr.ocena);max=Math.max(max,tr.ocena);}
  if(!Number.isFinite(min))return null;
  const od=fmtOcena(min),d=fmtOcena(max);
  return od===d?null:{min,max,od,do:d,tekst:od+"–"+d};
}
const ZC_BOT_NA_POZIOM={latwa:"latwy",srednia:"sredni",trudna:"trudny",bardzoTrudna:"mistrz",ekstremalna:null};
const fmtOcena=o=>(+o||0).toLocaleString(ZC_LOC,{minimumFractionDigits:1,maximumFractionDigits:1});
function opisTrudnosci(tr){
  if(!tr)return "";
  let s=tt("trudnoscOpis",{ocena:fmtOcena(tr.ocena),poziom:T["trudnosc_"+tr.poziom]});
  if(tr.glowne.length)s+=tt("trudnoscDlaczego",{co:tr.glowne.map(k=>T["czynnik_"+k]).join(", ")});
  const bot=ZC_BOT_NA_POZIOM[tr.poziom];
  s+=bot?tt("trudnoscBot",{bot:T["poziom_bota_"+bot]}):T.trudnoscBotNikt;
  if(tr.bpm)s+=tt("trudnoscTempo",{tempo:Math.round(tr.bpm)});
  if(tr.ruch)s+=tt("trudnoscZRuchem",{n:tr.ruch});
  return s;
}
// Znaczek trudności: liczba w kolorze poziomu (zielony → limonka → bursztyn → róż → grafit), opis w dymku.
function znaczekTrudnosci(tr,klasa){
  const z=h("span","trudnosc"+(klasa?" "+klasa:""),tr?fmtOcena(tr.ocena):"");
  if(tr){z.dataset.poziom=tr.poziom;z.title=opisTrudnosci(tr);z.setAttribute("aria-label",z.title);}
  return z;
}

// Gdzie gracz zagra (każdy ma wiedzieć, co będzie grał, na jakim ekranie i z kim): ten sam podział co startGry (podzialNaTory / podzialNaToryOsobno, ZC_MAKS_TOROW) i ten sam układ
// (ukladSiatki z S.ust.uklad) na umownym ekranie 160×90. Zwraca Map id gracza → {nr, n, rect, wspol (inni na tym torze),
// przeniesiony, partia toru}, prostokąty wszystkich torów i listę torów.
const ZC_EKRAN={W:160,H:90};
function przydzialEkranu(){
  const p=piosenka();if(!p||!S.gracze.length)return null;
  const pod=(S.ust.tory==="chor"?podzialNaTory:podzialNaToryOsobno)(S.gracze.map(g=>({id:g.id,partia:g.partia})),p.partie,ZC_MAKS_TOROW);
  const n=pod.tory.length,pr=ukladSiatki(n,S.ust.uklad,{x:0,y:0,w:ZC_EKRAN.W,h:ZC_EKRAN.H},4),mapa=new Map();
  pod.tory.forEach((t,i)=>{for(const id of t.gracze)mapa.set(id,{nr:i,n,rect:pr[i],partia:t.partia,wspol:t.gracze.filter(x=>x!==id),przeniesiony:pod.przeniesieni.includes(id)});});
  return {mapa,pr,tory:pod.tory};
}
// Miejsce toru słowami: cały ekran / u góry / na dole / w środku / po lewej / po prawej / lewy górny róg…
function miejsceToru(r,n){
  const {W,H}=ZC_EKRAN,pelnaW=r.w>=W-1,pelnaH=r.h>=H-1,gora=r.y<1,dol=r.y+r.h>=H-1,lewo=r.x<1,prawo=r.x+r.w>=W-1;
  if(n<=1||(pelnaW&&pelnaH))return T.ekranCaly;
  if(pelnaW)return gora?T.ekranGora:dol?T.ekranDol:T.ekranSrodek;
  if(pelnaH)return lewo?T.ekranLewo:prawo?T.ekranPrawo:T.ekranSrodek;
  return gora?(lewo?T.ekranLG:T.ekranPG):(lewo?T.ekranLD:T.ekranPD);
}
// Linia „Ekran” w karcie gracza: miniatura podziału ekranu (tor gracza w jego kolorze, reszta szara) i podpis
// „Tor 2 z 3, po prawej · z: Mysz” (sam na torze: „sam”). Notka o partii (takt, nuty, zakres) zostaje po prawej.
function liniaEkranu(g,prz,nota){
  const wiersz=h("div","gracz-ekran");
  const x=prz&&prz.mapa.get(g.id);
  if(x){
    const ns="http://www.w3.org/2000/svg",svg=document.createElementNS(ns,"svg");
    svg.setAttribute("viewBox","-2 -2 "+(ZC_EKRAN.W+4)+" "+(ZC_EKRAN.H+4));svg.setAttribute("class","ekran-mapa");svg.setAttribute("aria-hidden","true");
    prz.pr.forEach((r,i)=>{const p=document.createElementNS(ns,"rect");
      for(const [k,v] of Object.entries({x:r.x,y:r.y,width:r.w,height:r.h,rx:6}))p.setAttribute(k,v);
      p.setAttribute("class",i===x.nr?"ekran-moj":"ekran-inny");if(i===x.nr)p.style.fill=g.kolor||"#ec1a83";svg.append(p);});
    const z=x.wspol.map(id=>(S.gracze.find(o=>o.id===id)||{}).nazwa||"").filter(Boolean);
    const tekst=h("span","ekran-tekst");
    tekst.append(h("b","",tt("ekranTor",{nr:x.nr+1,n:x.n})+(x.n>1?", "+miejsceToru(x.rect,x.n):"")));
    tekst.append(" · "+(z.length?tt("ekranZ",{kto:z.join(", ")}):T.ekranSam));
    if(x.przeniesiony)tekst.append(" · "+tt("ekranPrzeniesiony",{partia:nazwaPartii(piosenka().partie[x.partia])}));
    wiersz.title=tekst.textContent+(nota.textContent?" · "+nota.textContent:"");
    wiersz.append(svg,tekst);
  }
  wiersz.append(nota);
  return wiersz;
}
function kartaGracza(g){
  const w=zrodloGracza(g)||{},prz=kartaGracza.prz||przydzialEkranu();   // rysujGraczy liczy przydział raz dla wszystkich kart
  const k=h("div","gracz"+(g.gotowy?" gotowy":""));k.dataset.id=g.id;k.style.setProperty("--kolor",g.kolor);
  k.style.setProperty("--partia-akcent",ZC_TORY_STYL[g.partia%ZC_TORY_STYL.length].akcent);   // jak chip partii w podglądzie
  const glowa=h("div","gracz-glowa");
  const kap=h("img","gracz-kapsel");kap.src=g.obrazekKapsla||"";kap.alt="";
  const podpis=h("div","gracz-podpis");
  // nazwa: ludzie i kapsle piszą swoją (bot ma imię z listy), Enter albo wyjście z pola zapisuje
  let nazwa;
  if(g.zrodlo==="bot")nazwa=h("b","gracz-nazwa",g.nazwa);
  else{nazwa=h("input","gracz-nazwa gracz-nazwa-pole");nazwa.value=g.nazwa;nazwa.maxLength=18;nazwa.spellcheck=false;
    nazwa.setAttribute("aria-label",T.graczNazwa);nazwa.dataset.id=g.id;
    nazwa.onchange=()=>zmienNazwe(g,nazwa.value);
    nazwa.onkeydown=e=>{if(e.key==="Enter"||e.key==="Escape"){if(e.key==="Escape")nazwa.value=g.nazwa;e.preventDefault();e.stopPropagation();nazwa.blur();}};}
  const zrodlo=h("button","gracz-zrodlo",(g.zrodlo==="kapsel"?(T.zrodlo_kapsel+(g.etykieta?" · "+g.etykieta:"")):T["zrodlo_"+g.zrodlo]||"")+" ▾");
  zrodlo.type="button";zrodlo.title=T.graczZmienZrodlo;zrodlo.onclick=()=>otworzWyborGracza({zamien:g.id,powrot:zrodlo});
  const kolor=h("button","gracz-kolor");kolor.type="button";kolor.title=kolor.ariaLabel=T.graczKolor;kolor.setAttribute("aria-label",T.graczKolor);
  kolor.onclick=()=>zmienKolor(g);
  const i=S.gracze.indexOf(g),wl=h("button","gracz-przesun","‹"),wp=h("button","gracz-przesun","›");
  wl.type=wp.type="button";wl.setAttribute("aria-label",T.graczWLewo);wp.setAttribute("aria-label",T.graczWPrawo);wl.title=T.graczWLewo;wp.title=T.graczWPrawo;
  wl.disabled=i<=0;wp.disabled=i>=S.gracze.length-1;wl.onclick=()=>przesunGracza(g,-1);wp.onclick=()=>przesunGracza(g,1);
  const narz=h("span","gracz-narzedzia");narz.append(zrodlo,kolor,wl,wp);
  // wybór istniejącego profilu (js/profile.js, 10-10): ludzie i kapsle, bot profilu nie ma
  if(g.zrodlo!=="bot"){const pr=h("button","gracz-profil");pr.type="button";pr.dataset.id=g.id;
    pr.innerHTML=ikonaFilc("osoba","ikona-filc ikona-osoba");   // 10-15: filc zamiast wektora
    const opis=tt("graczProfil",{nazwa:pokazProfil(Postepy.nazwaProfilu(g))});pr.title=opis;pr.setAttribute("aria-label",opis);pr.setAttribute("aria-haspopup","dialog");
    pr.onclick=()=>{if(window.ZC&&ZC.profile)ZC.profile.wybierz(g.id,{powrot:pr});};narz.prepend(pr);}
  podpis.append(nazwa,narz);
  g.lobbyCisza=null;
  if(g.zrodlo==="kapsel"){g.lobbyCisza=h("span","gracz-cisza",T.brakRuchu);g.lobbyCisza.hidden=w.swiezy!==false;podpis.append(g.lobbyCisza);}
  const usun=h("button","gracz-usun","×");usun.type="button";usun.title=T.usunGracza;usun.setAttribute("aria-label",T.usunGracza);
  usun.onclick=()=>odlacz(g.id);
  // kapsel, klawiatura i pad czytają na metce, co nacisnąć; przy 5–8 kartach (ciasna siatka) i w wąskim oknie zostaje
  // krótkie „Gotowe?”, żeby metka nie zjadała imienia i podpisu sterowania (oba napisy są w metce, wybiera gry.css po
  // szerokości okna)
  const gotowy=h("button","gracz-gotowy",g.gotowy?T.gotowe:T.potwierdz);gotowy.type="button";
  const coNacisnac=g.zrodlo==="kapsel"?T.potwierdzKapsel:T["potwierdz_"+g.zrodlo];
  if(!g.gotowy&&coNacisnac&&S.gracze.length<=4){
    gotowy.replaceChildren(h("span","gotowy-dlugi",coNacisnac),h("span","gotowy-krotki",T.potwierdz));gotowy.setAttribute("aria-label",coNacisnac);}
  gotowy.setAttribute("aria-pressed",String(g.gotowy));
  gotowy.onclick=()=>przelaczGotowy(g);
  glowa.append(kap,podpis,gotowy,usun);
  const srodek=h("div","gracz-srodek");
  const miernik=h("div","miernik");const zaba=h("img","miernik-zaba");zaba.src=ZC_ZASOBY.zaby[0];zaba.alt="";
  miernik.append(zaba);
  const partia=h("div","gracz-partia");
  const lewo=h("button","strzalka","‹"),prawo=h("button","strzalka","›");
  lewo.type=prawo.type="button";lewo.setAttribute("aria-label",T.poprzedniaPartia);prawo.setAttribute("aria-label",T.nastepnaPartia);
  lewo.onclick=()=>zmienPartie(g,-1);prawo.onclick=()=>zmienPartie(g,1);
  const pNazwa=h("span","partia-nazwa",nazwaPartii(piosenka().partie[g.partia]));pNazwa.title=pNazwa.textContent;
  partia.append(lewo,pNazwa,znaczekTrudnosci(trudnoscPartiiW(piosenka(),g.partia)),prawo);
  srodek.append(miernik,partia);
  // notka o partii: czy jest wygodna bez otwierania podglądu
  const nota=h("p","gracz-nota",notkaPartii(piosenka().partie[g.partia],piosenka().metrum,piosenka().fragment));nota.title=nota.textContent;
  if(g.zrodlo==="bot"){
    // bot (10-17): kafle jak u człowieka, Poziom (robo-żaba) zamiast Skina; do 10-17 wiersze „Instrument” i „Poziom”
    // ze strzałkami. Pod kaflami opis, czego się po nim spodziewać.
    k.classList.add("gracz-bot");
    k.append(glowa,srodek,rzadBota(g),liniaEkranu(g,prz,nota),h("p","gracz-pomoc",g.poziom?T["poziomBotaOpis_"+g.poziom]:T.pomoc_bot));
  }else{
    // ściąga na karcie mówi, jak ustawić kartę (kapsel, klawiatura, pad: pomocKarty_*), a gotowemu, jak się wycofać;
    // jak tym sterowaniem śpiewać, mówi pełny opis w dymku (i okno „Dodaj gracza”). Mysz karty nie ustawia klawiszami.
    const pelna=T["pomoc_"+g.zrodlo]||"",karty=T["pomocKarty_"+g.zrodlo],gotowa=T["pomocKartyGotowy_"+g.zrodlo];
    const sciaga=h("p","gracz-pomoc",(g.gotowy?gotowa:karty)||pelna);if(karty)sciaga.title=pelna;
    k.append(glowa,srodek,rzadSceny(g),liniaEkranu(g,prz,nota),sciaga);   // 10-17: instrument w kaflach
  }
  // klik w kartę (poza przyciskami) = podgląd partii tego gracza
  k.addEventListener("click",e=>{if(!e.target.closest("button"))Biblioteka.pokazPartie(g.partia,g.id);});
  g.lobbyZaba=zaba;
  return k;
}
// ---- scena gracza (2026-10-04, Sława; 10-05: drabinki przycięte do stopni wyraźnie różnych) ----
// ---- cztery tory i osiągnięcia (postepy.js v2, efekty*.js, gl-fx.js) ----
// W karcie człowieka siatka 2×2 miniatur (stopień w użyciu na torze Widownia, Streak, Tło, Klawisze; 64×32 w spoczynku)
// i puchar z licznikiem osiągnięć; każda miniatura otwiera okno „Scena” na swoim torze.
const nazwaToru=tor=>T[{widownia:"scenaWidownia",streak:"scenaStreak",tlo:"scenaTlo",klawisze:"scenaKlawisze",motyw:"scenaMotyw",efekt:"scenaEfekt",plansza:"scenaPlansza"}[tor]]||tor;
// Gracz ma móc skojarzyć, że skin i scena o tej samej nazwie (np. Sushi) to jeden motyw: skin i scena
// motywu to dwie osobne nagrody o tej samej nazwie, więc wszędzie, gdzie gracz je widzi, nazwa motywu idzie z rodzajem: „Sushi · skin”,
// „Sushi · scena”. `rodzaj` = "efekt" | "streak" (skin) albo "plansza" | tor planszy (scena). Używa też nagrody.js.
const scenaRodzaj=r=>r==="plansza"||ZC_TORY_WSPOLNE.includes(r);
const nazwaPary=(rodzaj,nazwa)=>nazwa?tt(scenaRodzaj(rodzaj)?"paraScena":"paraSkin",{nazwa}):"";
const rodzajPary=rodzaj=>scenaRodzaj(rodzaj)?T.rodzajScena:T.rodzajSkin;
// Sława z grupami tysięcy (twarda spacja), także czterocyfrowa („1 041 / 1 257” jak w planie): toLocaleString(ZC_LOC)
// czterech cyfr nie grupuje, a obok siebie stoją liczby cztero- i pięciocyfrowe.
const fmtSlawa=n=>String(Math.max(0,Math.round(+n||0))).replace(/\B(?=(\d{3})+(?!\d))/g,ZC_LOC==="pl-PL"?"\u00a0":",");
const fmtMnoznik=x=>{const s=String(Math.round((+x||0)*100)/100);return ZC_LOC==="pl-PL"?s.replace(".",","):s;};
// Ikony tła/skina i instrumentu są duże i z obrazkiem, bo wybiera się głównie obrazkiem:
// w karcie człowieka trzy duże kafle-obrazki zamiast wierszy ze strzałkami. Skin = głowa żaby w przebraniu motywu
// i ślad efektu za nią; Tło = motyw planszy z tańczącą widownią (wspólny dla wszystkich, ten sam wybór co pasek
// „Plansza”); Instrument = piktogram albo grafika ze Studia, odsłuch i licznik zdobytych. Klik w obrazek otwiera okno
// wyboru (Skin i osiągnięcia, Plansza, Instrumenty), strzałki ‹ › na brzegach obrazka zmieniają od razu (auto + zdobyte).
// Do 10-17 były tu wiersze „Instrument” i „Skin” ze strzałkami i miniaturą 36×18 (10-10). Od 10-17 wieczór w karcie
// zostają dwa kafle (Skin, Instrument); planszę wybiera się we wspólnym panelu nad kartami.
function kafelWyboru(typ,o){
  const kw=h("div","kw");kw.dataset.typ=typ;
  const b=h("button","kw-glowny");b.type="button";b.dataset.typ=typ;b.setAttribute("aria-haspopup","dialog");
  const obraz=h("span","kw-obraz"),podpis=h("span","kw-podpis"),nz=h("b","kw-nazwa");
  podpis.append(h("span","kw-et",o.etykieta),nz);b.append(obraz,podpis);
  const l=h("button","kw-strz kw-lewo","‹"),p=h("button","kw-strz kw-prawo","›");l.type=p.type="button";
  l.setAttribute("aria-label",o.poprzedni);p.setAttribute("aria-label",o.nastepny);l.title=o.poprzedni;p.title=o.nastepny;
  l.onclick=e=>{e.stopPropagation();o.krok(-1,l);};p.onclick=e=>{e.stopPropagation();o.krok(1,p);};
  b.onclick=()=>o.otworz(b);
  kw.append(b,l,p);
  return {kw,b,obraz,nz};
}
// Po przerysowaniu kart (rysujGraczy) fokus wraca na ten sam przycisk w nowej karcie gracza (klawiatura, pad).
function fokusWKarcie(g,sel){
  const n=document.querySelector('.gracz[data-id="'+CSS.escape(g.id)+'"] '+sel);if(n)n.focus({preventScroll:true});
}
function rzadSceny(g){
  const nazwa=Postepy.nazwaProfilu(g),ctx=kontekstProfilu(nazwa),rz=h("div","gracz-kafle");
  // Skin (tor streak profilu)
  const tor=ZC_TORY_GRACZA[0];
  const ks=kafelWyboru(tor,{etykieta:T.kartaEfekt,poprzedni:tt("kartaPoprzedni",{tor:nazwaToru(tor)}),nastepny:tt("kartaNastepny",{tor:nazwaToru(tor)}),
    krok:d=>{const odb=ctx.odb(tor),opcje=["auto"].concat(Postepy.drabinka(tor).filter(w=>w&&odb.includes(w.id)).map(w=>w.id));
      let i=opcje.indexOf(ctx.jestAuto(tor)?"auto":ctx.wyb(tor));if(i<0)i=0;
      ctx.wybierz(tor,opcje[(i+d+opcje.length)%opcje.length]);pokazS();},
    otworz:b=>otworzScene(g,tor,b)});
  const rS={cv:document.createElement("canvas"),typ:"streak",wpis:null,kolor:g.kolor||"#ec1a83"};rS.cv.className="kw-plotno";ks.obraz.append(rS.cv);
  const pokazS=()=>{
    const wpis=Postepy.wpis(tor,ctx.wyb(tor))||Postepy.drabinka(tor)[0]||null,auto=ctx.jestAuto(tor);rS.wpis=wpis;
    ks.nz.textContent=(auto?T.kartaAuto+" · ":"")+(wpis?wpis.nazwa:"");
    const opis=nazwaToru(tor)+": "+(wpis?wpis.nazwa:"")+(auto?" ("+T.kartaAuto+")":"");
    ks.b.title=opis+". "+T.kartaScenaOtworz;ks.b.setAttribute("aria-label",opis+". "+T.kartaScenaOtworz);
    narysujKafel(rS);
  };
  pokazS();kafleRejestruj(rS);
  // Plansza nie ma kafla w karcie: głosy oddaje się we wspólnym panelu „Plansza” nad kartami (rysujSceneWspolna):
  // jedna plansza z tłami dla wszystkich, bo pod kartą gracza wszystko było nieczytelne.
  // Instrument (zdobyte przez profil; własne ze Studia mogą mieć grafikę użytkownika)
  const id=instrumentGracza(g),nzI=T.instrumentyGracza[id]||id;
  const ki=kafelWyboru("instrument",{etykieta:T.instrumentGracza,poprzedni:T.poprzedniInstrument,nastepny:T.nastepnyInstrument,
    krok:d=>{zmienInstrument(g,d);fokusWKarcie(g,'.kw[data-typ="instrument"] .kw-'+(d<0?"lewo":"prawo"));},
    otworz:b=>otworzWyborInstrumentu(g,b)});
  obrazInstrumentu(ki.obraz,id);
  ki.nz.textContent=nzI;
  {const ile=instrumentyGracza(g).length,wsz=Glos.INSTRUMENTY_GRACZA.length;
    const opis=T.instrumentGracza+": "+nzI+". "+(ile<wsz?tt("instrumentyOdblokowane",{n:ile,z:wsz})+" ":"")+T.kartaInstrumentOtworz;
    ki.b.title=opis;ki.b.setAttribute("aria-label",opis);
    if(ile<wsz)ki.nz.previousSibling.append(h("span","kw-licznik"," · "+ile+"/"+wsz));}
  const od=przyciskOdsluchu(()=>odsluchajInstrument(instrumentGracza(g),przejsciaGracza(g)));od.classList.add("kw-odsluch");ki.kw.append(od);
  // Wcześniej był tu puchar z licznikiem osiągnięć profilu; puchary per gracz nie mają sensu, bo wszyscy grają
  // do jednej bramki (wspólna progresja), więc w karcie zostają Skin i Instrument.
  // Trzeci, wąski kafel „Pomoce” z plakietką „punkty ×…” gracza (kafelPomocy).
  rz.append(ks.kw,ki.kw,kafelPomocy(g));rz.classList.add("z-pomocami");
  return rz;
}
// ---- pomoce gracza (10-18 wieczór) ----
// Pomoce idą za profilem gracza: przy zmianie profilu (dołączenie, imię, okno Profile, zmiana konta) wczytują się z nowego
// profilu, także wybór „jak w ustawieniach” (zapisany null). Profil bez żadnego wyboru: gość, który się przedstawia, oddaje
// mu swój obecny wybór, a inna osoba z imieniem zaczyna od ustawień gry. Gość nie zapisuje nic we wspólnym profilu „Gość”
// (dwóch gości w jednej grze miałoby te same pomoce): jego wybór trzyma skład (zapiszSklad).
// g.pomoceProfil = klucz profilu, z którym pomoce gracza są już zgodne (undefined = jeszcze żaden).
const jestGosc=nazwa=>!nazwa||Postepy.kluczProfilu(nazwa)===Postepy.kluczProfilu(Postepy.GOSC);
function synchronizujPomoce(g){
  if(!g||g.zrodlo==="bot"||typeof Postepy==="undefined")return;
  const nazwa=Postepy.nazwaProfilu(g),k=Postepy.kluczProfilu(nazwa||Postepy.GOSC),poprz=g.pomoceProfil;
  if(poprz===k)return;
  g.pomoceProfil=k;
  if(jestGosc(nazwa))return;
  let u=null;try{u=Postepy.ustawienia(nazwa);}catch(e){}
  if(u&&"pomocPrzyciaganie" in u)g.pomoce=pomoceZProfilu(u);
  else if(poprz!==undefined&&poprz!==Postepy.kluczProfilu(Postepy.GOSC))g.pomoce=null;
  else if(g.pomoce)zapiszPomoceGracza(g);
}
// Zapis do profilu gracza (gość: nic). Profilu jeszcze nie ma (imię wpisane przed pierwszą piosenką): powstaje, gdy gracz
// ma własne pomoce, bo to wybór osoby do zapamiętania.
function zapiszPomoceGracza(g){
  const nazwa=Postepy.nazwaProfilu(g);if(jestGosc(nazwa))return false;
  try{
    let r=Postepy.zapiszUstawienia(nazwa,pomoceDoProfilu(g.pomoce));
    if(r&&!r.ok&&r.powod==="brak"&&g.pomoce){Postepy.utworz(nazwa);r=Postepy.zapiszUstawienia(nazwa,pomoceDoProfilu(g.pomoce));}
    return !!(r&&r.ok);
  }catch(e){return false;}
}
// p = null (jak w ustawieniach gry) albo własne pomoce; zapis w profilu i w składzie, karta od nowa.
function ustawPomoceGracza(g,p){
  if(!g||g.zrodlo==="bot")return;
  synchronizujPomoce(g);
  g.pomoce=p&&typeof p==="object"?pomoceZ(p):null;
  zapiszPomoceGracza(g);
  zapiszSkladTeraz();
  if(S.ekran==="lobby"&&S.gracze.includes(g))rysujGraczy();
}
// Pomoce, z którymi gracz zagra, i jego mnożnik punktów (czas na ruch × tempo × pomoce).
// 10-20: pomoce są dla ludzi. Robo-żaba gra bez nich (przyciąganie 0), bo precyzję ma w czipach swojego poziomu
// (zatrzask w POZIOMY_BOTOW), a dotąd brała przyciąganie z ustawień gry: w presecie „Mistrz” (przyciąganie 0) bot
// Mistrz jechał po torze bez cienia trafiania w nuty i mimo to miał 100 %. Tempo i czas na ruch zostają wspólne,
// bo zmieniają sam zapis nut. `spiewaSama` to tryb śpiewu całej gry, więc bota też dotyczy.
const pomoceBota=()=>pomoceZ({przyciaganie:0,spiewaSama:S.ust.spiewaSama,klawDoNuty:false});
const pomoceGracza=g=>g&&g.zrodlo==="bot"?pomoceBota():pomoceGraczaZ(g&&g.pomoce,S.ust);
const mnoznikPunktowGracza=g=>mnoznikPunktowUst(g&&g.zrodlo==="bot"?Object.assign({},S.ust,pomoceBota()):ustGracza(S.ust,g&&g.pomoce),klawiaturowy(g&&g.zrodlo));
const stanMnoznika=m=>m<1?"mniej":m>1?"wiecej":"rowno";
// Kafel „Pomoce” w karcie człowieka: magnes z kropkami poziomu przyciągania, małe ikony „śpiewa sama” i skoku do nuty,
// plakietka „punkty ×…” gracza. Klik otwiera okno „Pomoce”; własne pomoce mają różowy ścieg (gry.css).
function kafelPomocy(g){
  const p=pomoceGracza(g),m=mnoznikPunktowGracza(g),klaw=klawiaturowy(g.zrodlo);
  const kw=h("div","kw kw-pomoce");kw.dataset.typ="pomoce";if(g.pomoce)kw.dataset.wlasne="1";
  const b=h("button","kw-glowny");b.type="button";b.dataset.typ="pomoce";b.setAttribute("aria-haspopup","dialog");
  const obraz=h("span","kw-obraz");obraz.innerHTML=ikonaFilc("przyciaganie","piktogram");
  const kropki=h("span","robo-kropki kw-pomoce-kropki");kropki.setAttribute("aria-hidden","true");
  for(let i=1;i<ZC_POMOC.POZIOMY.length;i++)kropki.append(h("i",i<=p.przyciaganie?"pelna":""));
  obraz.append(kropki);
  // 10-22: wymuszony tryb przejść (grupa „Przejścia między nutami” w oknie) jako trzecia ikonka tej samej kolumny
  const przI=ikonkaPrzejsc(g);
  if(p.spiewaSama||(klaw&&p.klawDoNuty)||przI){const ik=h("span","kw-pomoce-ikony");
    ik.innerHTML=(p.spiewaSama?ikonaFilc("spiewa-tak"):"")+(klaw&&p.klawDoNuty?ikonaFilc("klaw-do-nuty"):"")+przI;obraz.append(ik);}
  const pl=h("span","ust-mn kw-mn",tt("mnPunkty",{m:fmtMn(m)}));pl.dataset.stan=stanMnoznika(m);
  const podpis=h("span","kw-podpis");podpis.append(h("span","kw-et",T.kartaPomoce),pl);
  b.append(obraz,podpis);
  const opis=tt("kartaPomoceDymek",{opis:opisPomocy(p,klaw),skad:T["pomoceSkad_"+(g.pomoce?"wlasne":"gra")],m:fmtMn(m)})+dymekPrzejsc(g);
  b.title=opis;b.setAttribute("aria-label",opis);
  b.onclick=()=>otworzPomoceGracza(g,b);
  kw.append(b);
  return kw;
}
// Okno „Pomoce: <gracz>” (to samo okno co wybór gracza, #wyborGracza: Esc, klik obok, strzałki i pad): skąd pomoce
// (jak w ustawieniach albo własne), przyciąganie 0–4, „śpiewa sama” i skok do nuty (tylko klawiatura), przy każdej opcji
// mnożnik, na dole punkty gracza. Klik w pomoc przy „Jak w ustawieniach” daje własne (reszta z ustawień gry).
function otworzPomoceGracza(g,powrot){
  const box=el("wyborGracza");if(!box||!g||g.zrodlo==="bot")return;
  schowajToast();   // Z-87
  synchronizujPomoce(g);
  const klaw=klawiaturowy(g.zrodlo),M=ZC_MN_POMOCY,nazwa=Postepy.nazwaProfilu(g);
  const karta=h("div","karta tablica-karta okno-karta pomoce-karta");karta.setAttribute("role","dialog");karta.setAttribute("aria-modal","true");
  karta.setAttribute("aria-labelledby","pomoceTytul");
  const glowa=h("header","tablica-glowa"),tyt=h("h2","tablica-tytul",tt("pomoceTytul",{nazwa:g.nazwa}));tyt.id="pomoceTytul";
  const zam=h("button","gracz-usun tablica-zamknij","×");zam.type="button";zam.setAttribute("aria-label",T.oknoZamknij);zam.title=T.oknoZamknij;
  zam.onclick=()=>zamknijWyborGracza();
  glowa.append(tyt,zam);
  const cialo=h("div","okno-cialo pomoce-cialo");
  cialo.append(h("p","okno-wstep",T.pomoceWstep+" "+(jestGosc(nazwa)?T.pomoceGosc:tt("pomoceProfil",{nazwa:pokazProfil(nazwa)}))));
  // grupa jak w kolumnie Ustawienia: etykieta z plakietką, kafelki (piktogram, podpis, mnożnik), zdanie opisu
  const grupa=(k,etykieta,opcje,ikona,nazwaOpcji,mn,wybierz)=>{
    const w=h("div","ust ust-segment pomoce-grupa");w.dataset.k=k;
    const gl=h("div","ust-glowa"),pl=h("span","ust-mn");gl.append(h("span","ust-etykieta",etykieta),pl);
    const seg=h("div","segment ust-kafle");seg.setAttribute("role","radiogroup");seg.setAttribute("aria-label",etykieta);
    for(const v of opcje){
      const b=h("button","segment-opcja ust-kafelek");b.type="button";b.dataset.v=String(v);b.setAttribute("role","radio");
      b.innerHTML=ikona(v);b.append(h("span","ust-kafelek-et",nazwaOpcji(v)));
      if(mn)b.append(h("span","ust-preset-mn","×"+fmtMn(mn(v))));
      b.onclick=()=>{wybierz(v);odswiez();};
      seg.append(b);
    }
    const op=h("p","ust-opis");
    w.append(gl,seg,op);
    return {w,seg,pl,op};
  };
  const zmien=(k,v)=>{const p=pomoceGracza(g);p[k]=v;ustawPomoceGracza(g,p);};
  const tryb=grupa("tryb",T.pomoceTryb,["gra","wlasne"],v=>ikonaFilc(v==="gra"?"reset":"osoba","piktogram"),v=>T["pomoceTryb_"+v],null,
    v=>ustawPomoceGracza(g,v==="gra"?null:pomoceGracza(g)));
  const przyc=grupa("przyciaganie",T.ustPrzyciaganie,ZC_POMOC.POZIOMY.map((x,i)=>i),()=>piktogram("przyciaganie",1),v=>T["przyciaganie_"+v],
    v=>M.przyciaganie[v],v=>zmien("przyciaganie",v));
  const spiew=grupa("spiewaSama",T.ustSpiewaSama,[false,true],v=>piktogram("spiewaSama",v),v=>T[v?"spiewaSama_tak":"spiewaSama_nie"],
    v=>v?M.spiewaSama:1,v=>zmien("spiewaSama",v));
  // skok do nuty tylko przy klawiaturze (innym sterowaniem nic nie robi i nie zmienia punktów)
  const skok=klaw?grupa("klawDoNuty",T.ustKlawDoNuty,[false,true],v=>v?piktogram("klawDoNuty",true):piktogram("klawiatura","szybko"),
    v=>T[v?"klawDoNuty_tak":"klawDoNuty_nie"],v=>v?M.klawDoNuty:1,v=>zmien("klawDoNuty",v)):null;
  przyc.op.textContent=pierwszeZdanie(T.ustPrzyciaganieOpis);przyc.op.title=T.ustPrzyciaganieOpis;
  spiew.op.textContent=pierwszeZdanie(T.ustSpiewaSamaOpis);spiew.op.title=T.ustSpiewaSamaOpis;
  if(skok){skok.op.textContent=pierwszeZdanie(T.ustKlawDoNutyOpis);skok.op.title=T.ustKlawDoNutyOpis;}
  const suma=h("div","pomoce-suma"),sumaMn=h("span","ust-mn ust-suma"),sumaSklad=h("span","pomoce-suma-sklad");
  const podp=h("p","ust-opis pomoce-podpowiedz");
  suma.append(sumaMn,sumaSklad,podp);
  // Przełącznik przejść jest w oknie konfiguracji gracza, a nie na instrumentach: pod sumą punktów, bo nie
  // zmienia punktów; po kliku karta przerysowuje się (ikonka na kaflu), a fokus wraca do nowego kafla „Pomoce” (odswiez niżej)
  const przejscia=grupaPrzejsc(g,()=>{if(S.gracze.includes(g)){rysujGraczy();odswiez();}});
  cialo.append(tryb.w,przyc.w,spiew.w);if(skok)cialo.append(skok.w);cialo.append(suma,przejscia.w);
  const zaznacz=(gr,v)=>{for(const b of gr.seg.children)b.setAttribute("aria-checked",String(b.dataset.v===String(v)));};
  const plakietka=(e,m)=>{e.textContent=tt("mnPunkty",{m:fmtMn(m)});e.dataset.stan=stanMnoznika(m);};
  function odswiez(){
    const p=pomoceGracza(g),wl=!!g.pomoce;
    zaznacz(tryb,wl?"wlasne":"gra");
    tryb.op.textContent=wl?T.pomoceTrybOpis_wlasne:tt("pomoceTrybOpis_gra",{opis:opisPomocy(pomoceZ(S.ust),klaw)});
    zaznacz(przyc,p.przyciaganie);zaznacz(spiew,p.spiewaSama);if(skok)zaznacz(skok,p.klawDoNuty);
    plakietka(przyc.pl,M.przyciaganie[p.przyciaganie]);plakietka(spiew.pl,p.spiewaSama?M.spiewaSama:1);if(skok)plakietka(skok.pl,p.klawDoNuty?M.klawDoNuty:1);
    const m=mnoznikPunktowGracza(g),mp=mnoznikPomocy(ustGracza(S.ust,g.pomoce),klaw);
    sumaMn.textContent=tt("pomocePunkty",{m:fmtMn(m)});sumaMn.dataset.stan=stanMnoznika(m);
    sumaSklad.textContent=tt("pomoceSklad",{p:fmtMn(mp),t:fmtMn(Math.round(mnoznikRuchu(S.ust.czasNaRuch)*mnoznikTempa(S.ust.tempo)*1e4)/1e4)});
    podp.hidden=!S.ust.podpowiedz;if(S.ust.podpowiedz)podp.textContent=tt("pomocePodpowiedz",{m:fmtMn(M.podpowiedz)});
    // karta przerysowała się (ustawPomoceGracza): powrót fokusu do kafla „Pomoce” w nowej karcie
    if(S.wyborZ&&S.wyborZ.isConnected===false){const n=document.querySelector('.gracz[data-id="'+CSS.escape(g.id)+'"] .kw-glowny[data-typ="pomoce"]');if(n)S.wyborZ=n;}
  }
  karta.append(glowa,cialo);box.replaceChildren(karta);box.hidden=false;
  S.wyborZ=powrot||document.activeElement;
  odswiez();
  const cel=tryb.seg.querySelector('[aria-checked="true"]');
  if(cel)cel.focus({preventScroll:true});
}
// Obrazek instrumentu: grafika użytkownika ze Studia (dataURL, gdy Studio.grafika ją ma) albo filcowy piktogram.
function obrazInstrumentu(box,id){
  let gr=null;try{if(window.Studio&&typeof Studio.grafika==="function")gr=Studio.grafika(id);}catch(e){gr=null;}
  if(typeof gr==="string"&&/^data:image\//.test(gr)){const im=h("img","kw-grafika");im.src=gr;im.alt="";box.replaceChildren(im);}
  else box.innerHTML=piktogram("instrument",id);
}
// Płótna kafli Skin i Tło: jedna pętla requestAnimationFrame, 12 klatek na sekundę, tylko w lobby i tylko dla płócien
// w dokumencie (stare karty po rysujGraczy wypadają same); w piosence pętla stoi. Ograniczony ruch = stojąca klatka
// (dorysowana jeszcze dwa razy, bo przebrania i fani wczytują się w tle).
const ZC_KAFLE={lista:new Set(),raf:0,ost:0,FPS:12,dorys:0};
function kafleRejestruj(r){
  ZC_KAFLE.lista.add(r);
  if(!ZC_KAFLE.raf)ZC_KAFLE.raf=requestAnimationFrame(petlaKafli);
  if(ruchOgraniczony()&&!ZC_KAFLE.dorys){ZC_KAFLE.dorys=1;
    const dorysuj=()=>{for(const x of ZC_KAFLE.lista)if(x.cv.isConnected)narysujKafel(x);};
    setTimeout(dorysuj,700);setTimeout(()=>{dorysuj();ZC_KAFLE.dorys=0;},2200);}
}
function petlaKafli(t){
  ZC_KAFLE.raf=0;
  for(const r of ZC_KAFLE.lista)if(!r.cv.isConnected)ZC_KAFLE.lista.delete(r);
  if(!ZC_KAFLE.lista.size||S.ekran!=="lobby")return;
  const ruch=!ruchOgraniczony();
  if(!ruch||t-ZC_KAFLE.ost>=1000/ZC_KAFLE.FPS-3){ZC_KAFLE.ost=t;const teraz=performance.now();
    for(const r of ZC_KAFLE.lista)if(r.cv.getClientRects().length)narysujKafel(r,teraz);}
  if(ruch)ZC_KAFLE.raf=requestAnimationFrame(petlaKafli);
}
function narysujKafel(r,teraz){
  const cv=r.cv,W=Math.round(cv.clientWidth),H=Math.round(cv.clientHeight);if(!W||!H||!r.wpis)return;
  const dpr=Math.min(2,window.devicePixelRatio||1),pw=Math.round(W*dpr),ph=Math.round(H*dpr);
  if(cv.width!==pw||cv.height!==ph){cv.width=pw;cv.height=ph;}
  const c=cv.getContext("2d");c.setTransform(dpr,0,0,dpr,0,0);c.globalAlpha=1;c.globalCompositeOperation="source-over";c.clearRect(0,0,W,H);
  const st=stanPodgladu(W,H,{teraz:teraz==null?performance.now():teraz,wpis:r.wpis,dpr,kolor:r.kolor,akcent:r.kolor,karta:[.1,.08,.8,.36]});
  const stary=R.st,nI=(R.iskry||[]).length,nD=(R.dym||[]).length;R.st=st;
  try{if(r.typ==="streak")rysujKafelSkina(c,W,H,r.wpis,st,r.kolor);else rysujKafelTla(c,W,H,r.wpis,st);}
  catch(e){bladStopnia("kafel|"+r.typ,"kafel wyboru ("+r.typ+")",e);}
  finally{R.st=stary;if(R.iskry&&R.iskry.length>nI)R.iskry.length=nI;if(R.dym&&R.dym.length>nD)R.dym.length=nD;
    c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation="source-over";}
}
// Skin: ciemny filc, fala śladu efektu (hak `slad` stopnia) i duża głowa żaby na jego końcu: przebranie motywu albo
// zwykła żaba z efektem za głową (glowaZaGlowa), jak w podglądzie okna „Skin i osiągnięcia”.
function rysujKafelSkina(c,W,H,w,st,kolor){
  const s=pelnyWpis("streak",w),ts=st.ts;
  c.fillStyle="#2b2825";c.beginPath();c.roundRect(0,0,W,H,Math.min(9,H*.14));c.fill();
  // głowa i ślad między strzałkami kafla (po 24 px z każdej strony zasłaniają strzałki ‹ ›). Głowa jest nieco
  // większa i nieucięta: całe pole rysunku (przebranie = POLE/96 głowy, z koroną i hełmem) mieści się
  // w kaflu z 3 % marginesu, a głowa podskakuje z falą tylko w zapasie, który zostaje. Rysunek przebrania zajmuje
  // najwyżej ~80 % pola sprite'u, wyśrodkowany (zmierzone na glowa-2.webp wszystkich motywów), więc mieści się RYSUNEK
  // (tresc), nie puste pole: głowa o ~20 % większa bez ucięcia. Szerokość: rysunek między strzałkami (po 25 px).
  const pid=typeof Motywy!=="undefined"&&Motywy.maPrzebranie&&Motywy.maPrzebranie(s.motyw||s.id)?s.motyw||s.id:null;
  const pole=pid?Motywy.PRZEBRANIE.POLE/96:1.12,tresc=pid?.82:1,m=H*.03;   // 1,12: zwykła żaba z efektem za głową (glowaZaGlowa) wystaje trochę poza sprite
  const sc=Math.min((H-2*m)/(pole*tresc),(W-50)/(pole*tresc)),pp=sc*pole,pc=pp*tresc,hx=W-25-pc/2,amp=H*.12,y0=H*.54,pts=[],krok=Math.max(1.5,W/80);
  for(let x=Math.min(24,W*.2);x<=hx;x+=krok)pts.push({x,y:y0+Math.sin((x/W)*7-ts*2.4)*amp,sp:true});
  const gy=Math.max(m+pc/2,Math.min(H-m-pc/2,pts[pts.length-1].y));
  hakPodgladu("streak",s,"slad",c,c,{pts,og:3,ts,x0:pts[0].x,xT:hx,dlug:hx-pts[0].x,ziarno:3,pelna:!st.spokoj,emituj:false,kolor});
  const kl=st.bezRuchu?2:2+(Math.floor(st.beat)%2);
  const zp=pid?Motywy.przebranie(pid):null;if(pid&&!zp)Motywy.wczytaj(pid);
  c.save();c.translate(hx,gy);
  if(zp){if(obrazGotowy(zp[1+kl]))c.drawImage(zp[1+kl],-pp/2,-pp/2,pp,pp);}
  else{
    if(!pid&&typeof s.glowa==="function"){try{glowaZaGlowa(c,s,sc,3,ts,3);}catch(e){bladStopnia("kafel|streak|"+s.id,"kafel: streak „"+s.id+"” (glowa)",e);}}
    const img=IMG.zaby[kl];if(obrazGotowy(img))c.drawImage(img,-sc/2,-sc/2,sc,sc);
  }
  c.restore();
}
// Tło: scena motywu (rysuj2d) z kartą toru u góry, a na dole widownia tego samego motywu w ruchu (fani skaczą do
// beatu z zegara), z ciemnym pasem ziemi jak w grze (Motywy.zaslonaStop).
function rysujKafelTla(c,W,H,w,st){
  rysujPodgladTla(c,w,st,false);
  const wid=Postepy.wpis("widownia",w.id),pw=pelnyWpis("widownia",wid||drabinka("widownia")[0]);if(!pw)return;
  const Wd={y:Math.round(H*.5),h:H-Math.round(H*.5)},b=st.beat;
  const sw=Efekty.stan({W,teraz:st.teraz,G:true,fala0:st.teraz-(b%8)*500,wyniki:false,ap:0,faza:b,spiewaja:(b%4)<3.2,
    skok:Math.max(0,1-(b%4)/.6),zar:3,bezRuchu:st.bezRuchu,spokoj:st.spokoj,kolor:st.kolor,akcent:st.akcent,moc:st.moc,gl:false,
    n:Math.max(3,Math.round(W/30))},Wd);
  hakPodgladu("widownia",pw,"rysuj",c,c,Wd,sw);
  if(pw.motyw&&typeof Motywy!=="undefined"&&Motywy.zaslonaStop){try{Motywy.zaslonaStop(c,Wd,sw);}catch(e){}}
}
const ZC_KLODKA=ikonaFilc("klodka","ikona-filc ikona-klodka");   // 10-15: filc zamiast wektora
// Hak stopnia w podglądzie i miniaturze: jak hakStopnia (false = brak haka, wyjątek albo hak zwrócił jawnie false,
// „nie narysowałem”), ale na własnym płótnie (save/restore zamiast transformacji dpr gry) i z wyłączeniem haka po
// pierwszym wyjątku (podgląd woła go 30 razy na sekundę, konsola dostaje jeden wpis).
const ZC_PODGLAD_BLEDY=new Set();
function hakPodgladu(tor,w,nazwa,cs,...a){
  const f=w&&w[nazwa],k=tor+"|"+((w&&w.id)||"")+"|"+nazwa;
  if(typeof f!=="function"||ZC_PODGLAD_BLEDY.has(k))return false;
  if(cs)cs.save();
  try{return f.apply(w,a)!==false;}
  catch(e){ZC_PODGLAD_BLEDY.add(k);bladStopnia("podglad|"+k,"podgląd: "+tor+" „"+((w&&w.id)||"")+"” ("+nazwa+")",e);return false;}
  finally{if(cs)cs.restore();}
}
// Stan klatki dla podglądu i miniatur w kształcie R.st (stanKlatki): jedna karta toru (`karta` = ułamki [x, y, w, h]
// płótna; miniatura tła ma mniejszą, żeby było widać scenę), pas widowni na dole, ogień 3 i kombo 12 (stopień w pełnej
// krasie), beat z zegara (120 ćwierćnut na minutę), kolory właściciela sceny.
function stanPodgladu(W,H,o){
  o=o||{};const teraz=o.teraz!=null?o.teraz:performance.now(),beat=teraz/500,og=o.og!=null?o.og:3,wid=Math.round(H*.2);
  const kf=o.karta||[.12,.1,.76,.62],k={x:Math.round(W*kf[0]),y:Math.round(H*kf[1]),w:Math.round(W*kf[2]),h:Math.round(H*kf[3])};
  k.teraz=Math.round(k.x+k.w*.22);
  return {W,H,dpr:o.dpr||2,teraz,ts:teraz/1000,dt:o.dt||0,beat,faza:beat-Math.floor(beat),bpm:120,og,zar:og,kombo:og?12:0,
    moc:mocStopnia(o.wpis),spokoj:!grafikaPelna(),bezRuchu:ruchOgraniczony(),gl:!!o.gl,wyniki:false,ap:0,
    kolor:o.kolor||"#ec1a83",akcent:o.akcent||"#ec1a83",tory:[k],widownia:{y:H-wid,h:wid}};
}
// Tor-atrapa dla klawiszy (kształt L z ukladGry): pionowa klawiatura przy lewej krawędzi, linia „teraz” z żabą.
// Miniatura (szer. < 100 px) dostaje klawiaturę na prawie całą szerokość: przy 64 px zwykła miałaby 14 px i wszystkie
// stopnie wyglądałyby tak samo.
function atrapaToruKlawiszy(W,H,akcent){
  const mini=W<100,dolN=60,goraN=mini?66:72,rzedy=goraN-dolN+1,gorna=Math.max(2,Math.round(H*.08)),rh=(H-gorna-Math.max(2,Math.round(H*.06)))/rzedy;
  return {tor:{gracze:[],styl:{akcent},zar:3,partia:0,oceny:[]},x:0,y:0,w:W,h:H,teraz:Math.round(W*(mini?.86:.6)),pxNaBeat:40,dolN,goraN,rzedy,rh,gorna,
    zaba:Math.round(H*.42),krokX:0,kx:Math.round(W*.04)+2,kw:mini?Math.round(W*.66):Math.round(Math.max(14,W*.09))};
}
// Karta toru pod klawiszami i tłem: kraft (z prześwitem stopnia tła), rzędy półtonów i różowa linia „teraz”.
function kartaPodgladu(c,k,przeswit,rzedy,P,st){
  const r=Math.min(14,k.h*.18);P=P||ZC_KARTA_DOM;
  c.fillStyle=P.cien;c.beginPath();c.roundRect(k.x,k.y+Math.min(5,k.h*.06),k.w,k.h,r);c.fill();
  c.globalAlpha=1-Math.max(0,Math.min(.2,+przeswit||0));c.fillStyle=P.papier;c.beginPath();c.roundRect(k.x,k.y,k.w,k.h,r);c.fill();c.globalAlpha=1;
  if(typeof P.rysuj==="function"){c.save();c.beginPath();c.roundRect(k.x,k.y,k.w,k.h,r);c.clip();
    try{P.rysuj(c,{x:k.x,y:k.y,w:k.w,h:k.h,teraz:k.teraz,kx:k.x,kw:0,rh:Math.max(3,k.h/14),dolN:60,goraN:72,gorna:k.y,rzedy:13},st||null);}catch(e){}
    c.restore();}
  if(rzedy){for(let s=rzedy.dolN;s<=rzedy.goraN;s++)if(isBlack(s)){c.fillStyle=P.czarne;c.fillRect(k.x,ySemi(rzedy,s)-rzedy.rh/2,k.w,rzedy.rh);}}
  c.strokeStyle=P.nic;c.lineWidth=Math.max(1,k.h/40);c.setLineDash([Math.max(3,k.h/12),Math.max(2,k.h/18)]);
  c.beginPath();c.moveTo(k.teraz,k.y+k.h*.08);c.lineTo(k.teraz,k.y+k.h*.92);c.stroke();c.setLineDash([]);
}
// Tło w podglądzie i miniaturze: stopień maluje scenę (rysuj2d, gdy w tej klatce nie rysuje GL), na niej karta toru
// z prześwitem stopnia i ściegiem, na kartach hak nadKartami. Stopień bez rysowania 2D (kraft) = filc spod gry.
function rysujPodgladTla(c,w,st,glRysuje){
  if(!glRysuje&&!(w&&w.rysuj2d&&hakPodgladu("tlo",w,"rysuj2d",c,c,st))){c.fillStyle="#efe9dd";c.fillRect(0,0,st.W,st.H);}
  const k=st.tory[0],P=paletaKarty(w||null);kartaPodgladu(c,k,w&&w.przeswit,null,P,st);
  if(!(w&&w.scieg===false)){c.strokeStyle=P.scieg||"rgba(236,26,131,.55)";c.lineWidth=Math.max(.8,k.h/50);c.setLineDash([Math.max(3,k.h/10),Math.max(2,k.h/14)]);
    c.beginPath();c.roundRect(k.x+3,k.y+3,k.w-6,k.h-6,Math.min(10,k.h*.14));c.stroke();c.setLineDash([]);}
  if(w&&w.nadKartami)hakPodgladu("tlo",w,"nadKartami",c,c,st);
}
// Statyczna klawiatura stopnia (hak tlo z domyślną rysujKlawiature jako czwartym argumentem; brak haka albo wyjątek
// = domyślna), w karcie toru.
// Paleta karty motywu o danym id (stopień klawiszy i tła motywu mają to samo id): podgląd klawiszy na „swojej” karcie.
function paletaMotywu(id){const w=drabinka("tlo").find(x=>x&&x.id===id);return paletaKarty(w||null);}
function rysujKlawiatureStopnia(c,w,L,st){
  kartaPodgladu(c,{x:L.x,y:L.y,w:L.w,h:L.h,teraz:L.teraz},0,L,paletaMotywu(w&&w.id),st);
  if(!(w&&w.tlo&&hakPodgladu("klawisze",w,"tlo",c,c,L,st,rysujKlawiature)))rysujKlawiature(c,L);
}
// Miniatura stopnia toru (64×32 w spoczynku; okno „Scena” pokazuje ją w 96×48): widownia i streak przez
// Efekty.miniatura (stopnie modułów są w katalogu po rejestracji), tło = rysuj2d wpisu na atrapie stanu klatki,
// klawisze = tlo wpisu na atrapie toru. Brak haka albo wyjątek = filc albo dzisiejsza klawiatura, bez dziury w oknie.
function miniaturaStopnia(cv,tor,wpis){
  if(tor==="widownia"||tor==="streak"){Efekty.miniatura(cv,tor,wpis&&wpis.id);return;}
  const d=2,c=cv.getContext("2d");cv.width=64*d;cv.height=32*d;
  c.setTransform(d,0,0,d,0,0);c.clearRect(0,0,64,32);
  const st=stanPodgladu(64,32,{teraz:1300,wpis,dpr:d,karta:tor==="tlo"?[.22,.3,.56,.4]:null}),stary=R.st;R.st=st;
  try{
    if(tor==="tlo")rysujPodgladTla(c,wpis,st,false);
    else rysujKlawiatureStopnia(c,wpis,atrapaToruKlawiszy(64,32,"#ec1a83"),st);
  }catch(e){bladStopnia("mini|"+tor,"miniatura stopnia ("+tor+")",e);}
  finally{R.st=stary;c.setTransform(d,0,0,d,0,0);c.globalAlpha=1;c.globalCompositeOperation="source-over";}
}
// Podgląd na żywo w oknie „Scena”: kafel z fokusem albo pod myszą, 320×120, ok. 30 klatek na sekundę przez
// requestAnimationFrame i tylko wtedy, gdy okno jest otwarte (płótno w dokumencie): po zamknięciu pętla staje sama
// i oddaje kontekst WebGL silnika (FX.podglad: najwyżej dwa naraz). Warstwy jak w grze: tło GL pod płótnem 2D,
// prymitywy GL nad nim; prymitywy modułów (fx, klatka tła) trafiają do podglądu, bo silnik przekierowuje globalne
// FX.* między ramka.klatka a ramka.rysuj. Grafika uproszczona = wariant spokojny bez GL, ograniczony ruch = jedna
// stojąca klatka. R.st na czas klatki podglądu wskazuje jej stan (moduły czytają go w lobby, gdzie gra nie liczy
// własnego), a cząstki gry dosypane przez haki (R.iskry, R.dym) wracają do stanu sprzed klatki.
const ZC_PODGLAD={W:320,H:120,FPS:30,MELODIA:[64,66,67,69,71,69,67,66]};
// Opis CAŁEGO motywu (okno „Plansza”): z rejestru motywów w języku gry, a bez rejestru opis wpisu toru.
function opisMotywu(w){
  const M=w&&typeof Motywy!=="undefined"&&Motywy.motyw?Motywy.motyw(w.motyw||w.id):null;
  if(!M)return (w&&w.opis)||"";
  const en=typeof RBJezyk!=="undefined"&&RBJezyk.en&&M.en;
  return (en&&M.en.opis)||M.opis||w.opis||"";
}
let ZC_PODGLAD_AKTYWNY=null;
function zwolnijPodglad(){if(ZC_PODGLAD_AKTYWNY)ZC_PODGLAD_AKTYWNY.zwolnij();}
function podgladSceny(g,ctx){
  zwolnijPodglad();
  const W=ZC_PODGLAD.W,H=ZC_PODGLAD.H,dpr=Math.min(2,window.devicePixelRatio||1);
  const el0=h("div","scena-podglad"),plotna=h("div","scena-podglad-plotna");
  const cvT=document.createElement("canvas"),cv=document.createElement("canvas"),cvF=document.createElement("canvas");
  cvT.className="scena-podglad-tlo";cv.className="scena-podglad-2d";cvF.className="scena-podglad-fx";
  for(const x of [cvT,cv,cvF])x.setAttribute("aria-hidden","true");
  cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);plotna.append(cvT,cv,cvF);
  {const z=h("span","scena-podglad-zakryte");z.setAttribute("aria-hidden","true");z.innerHTML=ZC_KLODKA;z.append(h("span","scena-zakryte-znak","?"));plotna.append(z);}
  const opis=h("div","scena-podglad-opis"),tyt=h("b","scena-podglad-tytul"),tekst=h("span","scena-podglad-tekst"),stan=h("span","scena-podglad-stan");
  opis.append(h("span","scena-podglad-et",T.scenaPodglad),tyt,tekst,stan);el0.append(plotna,opis);
  const c=cv.getContext("2d"),kolor=g.kolor||"#ec1a83",akcent=(ZC_TORY_STYL[(g.partia||0)%ZC_TORY_STYL.length]||{}).akcent||kolor;
  const P={tor:null,wpis:null,ost:0,raf:0,klaw:null,L:null,gp:null,tloGL:false,stary:0,rozgrzane:new Set()};
  let fx=null;
  if(grafikaPelna()&&typeof FX!=="undefined"&&FX&&typeof FX.podglad==="function"){
    try{fx=FX.podglad(cvF,{cvTlo:cvT,rysuj:(p,st)=>rysujKlatke(st)});fx.uklad(W,H,dpr);}
    catch(e){bladStopnia("FX|podglad","silnik efektów (podgląd)",e);fx=null;}
  }
  el0.classList.toggle("bez-gl",!fx);
  function gracz(L){
    if(!P.gp){P.gp={id:"podglad",kolor,nrWTorze:0,slad:[],idxPod:0,wib:0,poz:.5,halo:1,kombo:12,maxKombo:12,ogien:3,polton:64,spiewa:true,naNucie:true,tor:L.tor};L.tor.gracze=[P.gp];}
    return P.gp;
  }
  function rysujKlatke(st){
    const w=P.wpis,tor=P.tor;if(!w)return;
    if(fx&&tor!=="tlo"&&P.tloGL){try{FX.tlo.wylacz();}catch(e){}P.tloGL=false;}
    if(tor==="widownia"){
      const Wd={y:Math.round(H*.42),h:H-Math.round(H*.42)},b=st.beat,pw=pelnyWpis("widownia",w);
      c.fillStyle="#efe9dd";c.fillRect(0,0,W,H);
      c.fillStyle="#faf6ee";c.beginPath();c.roundRect(W*.04,-14,W*.92,Wd.y+6,12);c.fill();   // dół karty toru nad widownią
      const sw=Efekty.stan({W,teraz:st.teraz,G:true,fala0:st.teraz-(b%8)*500,wyniki:false,ap:0,faza:b,spiewaja:(b%4)<3.2,
        skok:Math.max(0,1-(b%4)/.6),zar:3,bezRuchu:st.bezRuchu,spokoj:st.spokoj,kolor,akcent,moc:st.moc,gl:st.gl},Wd);
      if(hakPodgladu("widownia",pw,"rysuj",c,c,Wd,sw)&&st.gl&&pw.fx)hakPodgladu("widownia",pw,"fx",null,sw);
    }else if(tor==="streak"){
      const s=pelnyWpis("streak",w),ts=st.ts;
      c.fillStyle="#2b2825";c.beginPath();c.roundRect(0,0,W,H,10);c.fill();
      c.save();c.translate(W*.2,H*.82);c.fillStyle="#e9d4ae";c.fillRect(-W*.15,-H*.06,W*.3,H*.12);
      hakPodgladu("streak",s,"nuty",null,c,W*.3,H*.12,W*.05,3,ts,3,true,1);c.restore();
      const pts=[];for(let x=W*.03;x<=W*.8;x+=2)pts.push({x,y:H*.46+Math.sin(x*.03-ts*2.2)*H*.13,sp:true});
      hakPodgladu("streak",s,"slad",c,c,{pts,og:3,ts,x0:W*.03,xT:W*.8,dlug:W*.77,ziarno:3,pelna:!st.spokoj,emituj:false,kolor});
      const kl=2+(Math.floor(st.beat)%2),pid=typeof Motywy!=="undefined"&&Motywy.maPrzebranie&&Motywy.maPrzebranie(s.motyw||s.id)?s.motyw||s.id:null;
      const zp=pid?Motywy.przebranie(pid):null,sc=H*.5,gy=pts[pts.length-1].y;
      if(pid&&!zp)Motywy.wczytaj(pid);
      c.save();c.translate(W*.86,gy);
      if(zp){const p=sc*Motywy.PRZEBRANIE.POLE/96;if(obrazGotowy(zp[1+kl]))c.drawImage(zp[1+kl],-p/2,-p/2,p,p);}   // 10-16: przebranie zamiast efektu głowy
      else{
        if(!pid&&typeof s.glowa==="function"){try{glowaZaGlowa(c,s,sc,3,ts,3);}catch(e){bladStopnia("podglad|streak|"+s.id,"podgląd: streak „"+s.id+"” (glowa)",e);}}
        const img=IMG.zaby[kl];if(obrazGotowy(img))c.drawImage(img,-sc/2,-sc/2,sc,sc);
      }
      c.restore();
    }else if(tor==="tlo"){
      // jak tloKlatka w grze: hak `klatka` (wołany także bez GL, moduł liczy w nim ruch) albo shader wpisu; false = GL
      // w tej klatce tła nie narysował (np. program jeszcze się kompiluje), więc idzie rysuj2d, a płótno GL czyści się raz
      let gl=false;
      if(w.klatka)gl=hakPodgladu("tlo",w,"klatka",null,st)&&st.gl;
      else if(st.gl&&w.shader&&w.shader.id){try{gl=FX.tlo.rysuj(w.shader.id,typeof w.shader.uniformy==="function"?w.shader.uniformy(st):null)!==false;}
        catch(e){bladStopnia("podglad|tlo|"+w.id+"|shader","podgląd: tło „"+w.id+"” (shader)",e);}}
      if(!gl&&P.tloGL&&fx){try{FX.tlo.wylacz();}catch(e){}}
      P.tloGL=gl;
      rysujPodgladTla(c,w,st,gl);
      if(st.gl&&w.fx)hakPodgladu("tlo",w,"fx",null,st);
    }else{
      const L=P.L||(P.L=atrapaToruKlawiszy(W,H,akcent)),gp=gracz(L),b=st.beat,i=Math.floor(b),M=ZC_PODGLAD.MELODIA;
      gp.polton=M[i%M.length]+(st.bezRuchu?0:Math.sin(st.ts*9)*.15);gp.spiewa=b-i<.8;gp.naNucie=gp.spiewa;gp.poz=gp.spiewa?.6:0;
      if(!P.klaw||P.klaw.id!==w.id){   // klawiatura stopnia raz na wpis (w grze też leży w buforze)
        const b2=document.createElement("canvas");b2.width=cv.width;b2.height=cv.height;
        const c2=b2.getContext("2d");c2.setTransform(dpr,0,0,dpr,0,0);rysujKlawiatureStopnia(c2,w,L,st);P.klaw={id:w.id,cv:b2};
      }
      c.drawImage(P.klaw.cv,0,0,W,H);
      rysujKlawiszeGraczy(c,L);
      hakPodgladu("klawisze",w,"gracz",c,c,L,gp,st);
      const pz=pozycjaZaby(L,gp),img=IMG.zaby[gp.spiewa?2+(i%2):0],s=L.zaba;
      if(obrazGotowy(img))c.drawImage(img,pz.x-s/2,pz.y-s/2,s,s);
      if(st.gl&&w.fx)hakPodgladu("klawisze",w,"fx",null,L,gp,st);
    }
  }
  function klatka(teraz){
    if(!P.wpis)return;
    const gl=!!fx&&grafikaPelna()&&(()=>{try{return !!fx.gotowy();}catch(e){return false;}})();
    const st=stanPodgladu(W,H,{teraz,dt:P.stary?Math.max(0,Math.min(.1,(teraz-P.stary)/1000)):0,wpis:P.wpis,gl,kolor,akcent,dpr});
    P.stary=teraz;
    c.setTransform(dpr,0,0,dpr,0,0);c.globalAlpha=1;c.globalCompositeOperation="source-over";c.clearRect(0,0,W,H);
    const stary=R.st,nI=(R.iskry||[]).length,nD=(R.dym||[]).length;R.st=st;
    try{if(fx)fx.ramka(st,c);else rysujKlatke(st);}
    catch(e){bladStopnia("podglad|klatka","podgląd sceny (klatka)",e);}
    finally{R.st=stary;if(R.iskry&&R.iskry.length>nI)R.iskry.length=nI;if(R.dym&&R.dym.length>nD)R.dym.length=nD;}
  }
  function petla(t){
    if(!cv.isConnected){zwolnij();return;}
    P.raf=requestAnimationFrame(petla);
    if(t-P.ost<1000/ZC_PODGLAD.FPS-3)return;
    P.ost=t;klatka(performance.now());
  }
  // Kafel do podglądu: podpis (tor, stopień, nazwa, opis, czy w użyciu) i nowy stan modułu toru (reset jak przy
  // układzie gry), żeby cząstki poprzedniego stopnia nie przechodziły na następny.
  function pokaz(tor,id,wymus){
    const w=Postepy.wpis(tor,id);if(!w)return;
    if(!wymus&&P.tor===tor&&P.wpis&&P.wpis.id===id)return;
    // 10-17: niezdobyty stopień nie rysuje się w podglądzie (fokus, mysz, klik, skrót z osiągnięcia): zakryta karta
    // z kłódką, tytuł „???” i jedno zdanie, że wygląd zobaczy się po zdobyciu
    const zakryj=!ctx.odb(tor).includes(id);el0.classList.toggle("zakryty",zakryj);
    if(zakryj){
      if(P.tor){const m=modulToru(P.tor);if(m)hakPodgladu(P.tor,m,"reset",null);}
      if(fx&&P.tloGL){try{FX.tlo.wylacz();}catch(e){}P.tloGL=false;}
      P.tor=tor;P.wpis=null;P.klaw=null;
      c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,cv.width,cv.height);
      tyt.textContent=tt("scenaPodgladTytul",{tor:ctx.nazwaToru?ctx.nazwaToru(tor):nazwaToru(tor),n:+w.stopien||1,nazwa:T.nieodkryte});
      tekst.textContent=T.scenaNieodkryteOpis;stan.textContent=T.scenaNieodkryte;stan.dataset.stan="zablokowany";
      el0.dataset.tor=tor;el0.dataset.v=id;return;
    }
    if(P.tor!==tor||!P.wpis||P.wpis.id!==id){const m=modulToru(tor);if(m)hakPodgladu(tor,m,"reset",null);P.klaw=null;}
    P.tor=tor;P.wpis=w;
    // rozgrzej() wpisu raz na podgląd, jak gra przed piosenką: rejestruje program tła i bufory (bez tego GL tła nie ma
    // czego narysować i podgląd zostaje przy rysuj2d)
    if(fx&&grafikaPelna()&&!P.rozgrzane.has(tor+"|"+id)){P.rozgrzane.add(tor+"|"+id);
      hakPodgladu(tor,pelnyWpis(tor,w),"rozgrzej",null,stanPodgladu(W,H,{wpis:w,gl:true,kolor,akcent,dpr}));}
    const n=+w.stopien||1,wyb=ctx.wyb(tor)===id,otw=ctx.odb(tor).includes(id);
    tyt.textContent=tt("scenaPodgladTytul",{tor:ctx.nazwaToru?ctx.nazwaToru(tor):nazwaToru(tor),n,nazwa:nazwaPary(tor,w.nazwa)});tekst.textContent=ctx.plansza?opisMotywu(w):w.opis||"";
    stan.textContent=wyb?T.scenaWUzyciu:otw?T.scenaDoWyboru:T.scenaZablokowane;stan.dataset.stan=wyb?"wybrany":otw?"otwarty":"zablokowany";
    el0.dataset.tor=tor;el0.dataset.v=id;
    if(ruchOgraniczony())klatka(performance.now());   // bez pętli (ograniczony ruch) jedna stojąca klatka; z pętlą rysuje następna klatka
  }
  function zwolnij(){
    cancelAnimationFrame(P.raf);P.raf=0;
    if(fx){try{fx.zwolnij();}catch(e){}fx=null;}
    if(P.tor){const m=modulToru(P.tor);if(m)hakPodgladu(P.tor,m,"reset",null);}
    if(ZC_PODGLAD_AKTYWNY===api)ZC_PODGLAD_AKTYWNY=null;
  }
  function start(){if(!P.raf&&!ruchOgraniczony())P.raf=requestAnimationFrame(petla);}
  const api={el:el0,pokaz,zwolnij,start,get gl(){try{return !!(fx&&fx.gotowy());}catch(e){return false;}}};
  ZC_PODGLAD_AKTYWNY=api;
  return api;
}
// Sekcja toru w oknie „Scena”: nagłówek „Widownia · stopień 7 z 20 · Reflektory” (stopień ze sławy), pasek sławy do
// następnego progu (po 20: suma i gwiazdki prestiżu), przełącznik „Auto: zawsze najwyższy” i drabinka 20 kafli.
// Odblokowany kafel wybiera (przypina) stopień, zablokowany mówi, czego brakuje: próg sławy toru i, gdy jest,
// osiągnięcie-skrót. Fokus i mysz na kaflu przełączają podgląd na żywo.
function sekcjaToruSceny(ctx,tor,pod,poZmianie){
  const d=Postepy.drabinka(tor),sek=h("section","wybor-sekcja scena-sekcja");sek.dataset.sekcja=tor;
  const nt=t=>ctx.nazwaToru?ctx.nazwaToru(t):nazwaToru(t);   // plansza: „Plansza” zamiast nazwy toru
  const glowa=h("div","scena-glowa"),nag=h("h3","okno-sekcja scena-naglowek"),slawa=h("div","scena-slawa"),auto=h("button","scena-auto");
  const pas=h("span","scena-slawa-pasek"),wyp=h("span","scena-slawa-w"),liczby=h("span","scena-slawa-liczby");
  pas.append(wyp);slawa.append(pas,liczby);
  auto.type="button";auto.setAttribute("role","switch");auto.title=T.scenaAutoOpis;
  auto.append(h("span","scena-auto-znak"),h("span","scena-auto-et",T.scenaAuto));
  // 10-18 (E-07): skiny przychodzą tylko z koła nagród ekipy, więc pasek sławy profilu niczego tu nie otwiera; bez paska.
  // 10-18 (Postepy.SCENY_Z_KOLA): sceny też tylko z koła, więc i przy planszy bez paska sławy, progu i paska kafla
  const zKola=!ctx.plansza||!!Postepy.SCENY_Z_KOLA;
  if(!zKola)glowa.append(nag,slawa,auto);else glowa.append(nag,auto);
  const rz=h("div","scena-rzad scena-drabinka");rz.setAttribute("role","radiogroup");rz.setAttribute("aria-label",nt(tor));
  const sl0=ctx.slawa(tor),odb=ctx.odb(tor);
  d.forEach((w,i)=>{
    if(!w)return;
    const n=+w.stopien||i+1,otw=odb.includes(w.id),b=h("button","scena-kafel"+(otw?"":" zablokowany"));b.type="button";
    b.dataset.v=w.id;b.dataset.tor=tor;b.dataset.stopien=String(n);b.setAttribute("role","radio");
    // Niezdobyte są ukryte pod kłódką, bez pokazywania, jak wyglądają: zablokowany kafel = zakryta karta
    // z kłódką i znakiem zapytania, nazwa „???”, ramka w kolorze rzadkości; bez miniatury i bez opisu wyglądu
    if(otw){const cv=document.createElement("canvas");cv.className="scena-miniatura";miniaturaStopnia(cv,tor,w);b.append(cv);}
    else{const z=h("span","scena-zakryte");z.innerHTML=ZC_KLODKA;z.append(h("span","scena-zakryte-znak","?"));b.append(z);
      try{b.dataset.rz=Postepy.rzadkosc(ctx.plansza?"plansza":"efekt",w.id);}catch(e){}}
    const para=nazwaPary(ctx.plansza?"plansza":tor,w.nazwa);   // 10-18: „Sushi · skin” / „Sushi · scena”
    b.append(h("span","scena-nr",String(n)),h("span","scena-kafel-nazwa",otw?para:T.nieodkryte));
    const nazwaKafla=tt("scenaKafelOpis",{n,nazwa:otw?para:T.nieodkryte}),op=otw?(ctx.plansza?opisMotywu(w):w.opis):"";
    if(otw){
      b.title=nazwaKafla+(op?". "+op:"");b.setAttribute("aria-label",nazwaKafla);
      b.onclick=()=>{ctx.wybierz(tor,w.id);odswiez();pod.pokaz(tor,w.id,true);poZmianie();};
    }else{
      const o=Postepy.zrodloStylu(tor,w.id),progN=Postepy.progWpisu(tor,w.id);
      // plansza: skrótem jest osiągnięcie ze skrótem do KTÓREGOKOLWIEK toru planszy (otwiera motyw wszystkim)
      const oP=ctx.plansza?Postepy.OSIAGNIECIA.find(x=>Postepy.TORY_PLANSZY.some(t=>x.nagroda[t]===w.id)):null;
      const oK=ctx.plansza?oP:o;   // osiągnięcie-skrót do tego kafla
      const powod=!zKola?(oP?tt("scenaZablokowanyPlanszaOs",{prog:fmtSlawa(progN),ile:fmtSlawa(sl0),os:oP.nazwa,opis:oP.opis})
          :tt("scenaZablokowanyPlansza",{prog:fmtSlawa(progN),ile:fmtSlawa(sl0)}))
        :oK?tt("scenaZablokowanyKoloOs",{os:oK.nazwa,opis:oK.opis}):T.scenaZablokowanyKolo;   // 10-17: skiny (od 10-18 i sceny) przychodzą z koła nagród, nie z progu sławy
      const war=h("span","scena-warunek");war.append(h("span","scena-warunek-prog",!zKola?tt("scenaProg",{n:fmtSlawa(progN)}):T.scenaZKola));
      if(oK)war.append(h("span","scena-warunek-os",tt("scenaAlboOsiagniecie",{nazwa:oK.nazwa})));
      const pasek=h("span","scena-pasek"),pw=h("span","scena-pasek-w");pw.style.width=Math.round(100*Math.min(1,sl0/Math.max(1,progN)))+"%";pasek.append(pw);
      b.append(war);if(!zKola)b.append(pasek);b.setAttribute("aria-disabled","true");
      b.title=nazwaKafla+". "+powod;b.setAttribute("aria-label",nazwaKafla+". "+powod);
      b.onclick=()=>{pod.pokaz(tor,w.id);toast(powod);};
    }
    b.addEventListener("focus",()=>pod.pokaz(tor,w.id));
    b.addEventListener("pointerenter",()=>pod.pokaz(tor,w.id));
    rz.append(b);
  });
  // mysz zjeżdża z drabinki: podgląd wraca do kafla z fokusem
  rz.addEventListener("pointerleave",()=>{const a=document.activeElement;if(a&&a.classList&&a.classList.contains("scena-kafel"))pod.pokaz(a.dataset.tor,a.dataset.v);});
  function odswiez(){
    const s=ctx.slawa(tor),poz=Postepy.poziomZ(s,tor),wyb=ctx.wyb(tor);
    const jestAuto=ctx.jestAuto(tor),gw=Postepy.prestizZ(s),dwudziesty=poz.nastepny==null&&poz.maks>0;
    // nagłówek = motyw W UŻYCIU (10-15: skrót z osiągnięcia bywa wyżej niż poziom z samej sławy, a nagłówek z sławy
    // podawał wtedy inny motyw niż ten na scenie); pasek niżej dalej liczy sławę do następnego progu
    const dU=Postepy.drabinka(tor),iU=dU.findIndex(w=>w&&w.id===wyb),uzyw=iU>=0?{n:+dU[iU].stopien||iU+1,nazwa:dU[iU].nazwa}:{n:poz.stopien,nazwa:poz.wpis?poz.wpis.nazwa:""};
    nag.textContent=tt("scenaNaglowek",{tor:nt(tor),n:uzyw.n,z:Math.max(1,poz.maks),nazwa:nazwaPary(ctx.plansza?"plansza":tor,uzyw.nazwa)});
    if(ctx.plansza)slawa.dataset.kto=tt("scenaPlanszaSlawa",{ile:fmtSlawa(s)});
    let f=1;
    if(poz.do!=null){f=(s-poz.od)/Math.max(1,poz.do-poz.od);liczby.textContent=tt("scenaSlawaPasek",{ile:fmtSlawa(s),prog:fmtSlawa(poz.do)});
      slawa.title=tt("scenaSlawaDymek",{ile:fmtSlawa(s),n:poz.nastepny?(+poz.nastepny.stopien||poz.stopien+1):poz.stopien+1,brak:fmtSlawa(poz.do-s)});}
    else{
      if(dwudziesty)f=((s-Postepy.prog(Postepy.MAKS_STOPIEN))%Postepy.PRESTIZ_CO)/Postepy.PRESTIZ_CO;   // prog(20) = próg ostatniego stopnia
      liczby.textContent=fmtSlawa(s)+(gw?" · "+(gw<=5?"★".repeat(gw):"★×"+gw):"");
      slawa.title=dwudziesty?tt("scenaSlawaPrestiz",{ile:fmtSlawa(s),n:gw,co:fmtSlawa(Postepy.PRESTIZ_CO)}):tt("scenaSlawaSuma",{ile:fmtSlawa(s)});
    }
    wyp.style.width=Math.round(100*Math.max(0,Math.min(1,f)))+"%";
    auto.setAttribute("aria-checked",String(jestAuto));
    for(const b of rz.children)b.setAttribute("aria-checked",String(b.dataset.v===wyb));
  }
  // przełącznik: włączony = „auto” (najwyższy zdobyty); wyłączenie przypina stopień, który jest teraz w użyciu
  auto.onclick=()=>{
    const jest=ctx.jestAuto(tor),wyb=ctx.wyb(tor);
    ctx.wybierz(tor,jest?wyb:"auto");odswiez();pod.pokaz(tor,ctx.wyb(tor),true);poZmianie();
  };
  odswiez();
  sek.append(glowa,rz);
  return sek;
}
// Osiągnięcia w kategoriach (jak w torze C) z sławą za zdobycie i skrótem: „+180 sławy (Tło) · skrót: Tło 19 · Czarna
// dziura”. Fokus albo klik na osiągnięciu pokazuje jego stopień w podglądzie.
// Droga gracza (10-16): wszystkie nagrody z własnej puli po kolei (instrumenty i efekty) z poziomem, na którym
// przychodzą; zdobyte w kolorze, reszta zakryta kłódką („???”, 10-17). Klik w zdobyty instrument = odsłuch.
function sekcjaDrogi(nazwa){
  const sek=h("section","wybor-sekcja scena-sekcja droga");sek.dataset.sekcja="droga";
  if(typeof Postepy==="undefined"||!Postepy.drogaPelna)return sek;
  const z=Postepy.poziomGracza(nazwa),wolne=Postepy.losowania(nazwa);
  const odbI=new Set(Postepy.instrumenty(nazwa)),odbE=new Set(Postepy.odblokowane(nazwa)[Postepy.TOR_GRACZA]||[]);
  sek.append(h("h3","okno-sekcja",T.drogaTytul+" · "+tt("drogaLicznik",{n:z.poziom,z:z.maks})),h("p","okno-wstep",T.drogaWstep));
  if(wolne>0)sek.append(h("p","okno-wstep droga-wolne",tt("drogaWolne",{n:wolne})));
  const kolej=Postepy.RZADKOSCI.slice().reverse(),lista=h("div","droga-lista");
  // 10-18 (Postepy.SCENY_Z_KOLA): sceny też są na kole, więc też na liście drogi (po skinach tej samej rzadkości)
  const sceny=Postepy.SCENY_Z_KOLA?Postepy.drabinka(Postepy.TOR_PLANSZY).filter((w,i)=>w&&i>0&&w.id!==Postepy.SEKRETY.plansza).map(w=>({typ:"plansza",id:w.id,nazwa:w.nazwa})):[];
  const odbP=new Set(Postepy.ekipa().odblokowane),RODZ={instrument:0,efekt:1,plansza:2};
  const rzeczy=Postepy.drogaPelna().concat(sceny).map(n=>Object.assign({r:Postepy.rzadkosc(n.typ,n.id)},n))
    .sort((x,y)=>kolej.indexOf(x.r)-kolej.indexOf(y.r)||RODZ[x.typ]-RODZ[y.typ]);
  for(const n of rzeczy){
    const ins=n.typ==="instrument",ma=ins?odbI.has(n.id):n.typ==="plansza"?odbP.has(n.id):odbE.has(n.id),nz=ins?(T.instrumentyGracza[n.id]||n.id):nazwaPary(n.typ,n.nazwa);
    // Instrumenty tak samo: niezdobyte = kłódka i „???”, bez obrazka, koloru motywu i odsłuchu
    const el2=h(ins&&ma?"button":"div","droga-poz rz-"+n.r+" "+(ins?"instrument":"efekt")+(ma?" zdobyte":" zakryte"));
    if(!ma){const k=h("span","droga-klodka");k.innerHTML=ZC_KLODKA;el2.append(k);el2.title=T.nieodkryteOpis;}
    else if(ins){el2.type="button";el2.title=tt("drogaPosluchaj",{nazwa:nz});el2.onclick=()=>odsluchajInstrument(n.id);el2.insertAdjacentHTML("beforeend",piktogram("instrument",n.id));}
    else{const w=drabinka(n.typ==="plansza"?Postepy.TOR_PLANSZY:Postepy.TOR_GRACZA).find(x=>x.id===n.id),k=h("span","droga-kolor");k.style.background=(w&&w.kolorMotywu)||"#eaa32b";el2.append(k);}
    el2.append(h("b","",ma?nz:T.nieodkryte),h("span","droga-opis",(ins?T.drogaInstrument:rodzajPary(n.typ))+" · "+T.rzadkosc[n.r]));
    lista.append(el2);
  }
  sek.append(lista);
  return sek;
}
function sekcjaOsiagniecSceny(nazwa,pod){
  const p=Postepy.profil(nazwa),zd=p.osiagniecia,sek=h("section","wybor-sekcja scena-sekcja");sek.dataset.sekcja="osiagniecia";
  const ileZd=Postepy.OSIAGNIECIA.filter(o=>zd[o.id]).length;
  sek.append(h("h3","okno-sekcja",T.scenaOsiagniecia+" · "+tt("scenaLicznik",{n:ileZd,z:Postepy.OSIAGNIECIA.length})));
  for(const kat of Postepy.KATEGORIE){
    const lista=Postepy.OSIAGNIECIA.filter(o=>o.kategoria===kat.id);if(!lista.length)continue;
    const d=h("div","osiag-kat");d.append(h("h4","osiag-kat-tytul",kat.nazwa));
    const ul=h("div","osiag-lista");
    for(const o of lista){
      const sk=Postepy.skrot(o),b=h("button","osiag"+(zd[o.id]?" zdobyte":""));b.type="button";b.dataset.id=o.id;
      // 10-17: nagroda-skrót do rzeczy jeszcze niezdobytej ma nazwę „???”, a podgląd pokazuje zakrytą kartę (pod.pokaz)
      let maSk=false;if(sk)try{maSk=(sk.plansza?Postepy.ekipa().odblokowane:(Postepy.odblokowane(nazwa)[sk.tor]||[])).includes(sk.id);}catch(e){}
      const nag=sk?tt("scenaNagrodaSlawa",{n:fmtSlawa(sk.slawa),tor:nazwaToru(sk.tor)})+" · "+
        tt(sk.plansza?"scenaSkrotPlansza":"scenaSkrotEfekt",{n:sk.stopien||"?",nazwa:maSk?sk.nazwa:T.nieodkryte}):"";
      b.append(h("span","osiag-znak",zd[o.id]?"✓":""),h("b","",o.nazwa),h("span","osiag-opis",o.opis),h("span","osiag-nagroda",nag));
      // 10-15: liczby obok paska („47 / 100”) i data zdobycia (zapis trzyma ją od zawsze, okno jej nie pokazywało)
      if(!zd[o.id]&&o.prog){const pas=h("span","scena-pasek"),wyp=h("span","scena-pasek-w"),rz=h("span","osiag-postep"),lc=Postepy.licznikOsiagniecia(nazwa,o.id);
        wyp.style.width=Math.round(100*Postepy.postepOsiagniecia(nazwa,o.id))+"%";pas.append(wyp);rz.append(pas);
        if(lc)rz.append(h("span","osiag-liczby",tt("osiagLiczby",{n:fmtSlawa(lc.wartosc),z:fmtSlawa(lc.cel)})));
        b.append(rz);}
      const kiedy=zd[o.id]?Date.parse(zd[o.id]):NaN;
      if(kiedy)b.append(h("span","osiag-data",tt("osiagZdobyte",{data:new Date(kiedy).toLocaleDateString(ZC_LOC,{day:"numeric",month:"numeric",year:"numeric"})})));
      b.setAttribute("aria-pressed",String(!!zd[o.id]));
      if(sk&&sk.jest){const pokaz=()=>pod.pokaz(sk.tor,sk.id);b.addEventListener("focus",pokaz);b.onclick=pokaz;}
      ul.append(b);
    }
    d.append(ul);sek.append(d);
  }
  return sek;
}
// Kontekst okna „Scena” (10-05, przebudowa 10-10): skąd sekcja toru bierze sławę, odblokowania i wybór. Profil
// gracza = jego efekt (tor streak) z własnej puli; PLANSZA (widownia, tło, klawisze = jeden motyw) = pula EKIPY w
// postepy.js (`Postepy.ekipa`): suma sławy wszystkich ludzi na tym komputerze, niezależna od tego, kto siedzi w składzie,
// z jednym wspólnym wyborem (przypięty albo „auto” = najwyższy). Do 10-10 plansza była sumą odblokowań ludzi ze składu
// i wybór znikał, gdy ktoś wychodził; stąd były konflikty.
function kontekstProfilu(nazwa){
  return {wspolny:false,
    slawa:()=>Postepy.slawaRazem(Postepy.profil(nazwa).slawa),odb:tor=>Postepy.odblokowane(nazwa)[tor]||[],
    wyb:tor=>Postepy.wybor(nazwa)[tor],jestAuto:tor=>(Postepy.profil(nazwa).wybor[tor]||"auto")==="auto",
    wybierz:(tor,v)=>Postepy.wybierz(nazwa,{[tor]:v})};
}
// Tory planszy (wspólne, jeden motyw z puli ekipy) i tory gracza (własne). ZC_TOR_PLANSZY = drabinka, którą okno
// i pasek pokazują jako „Plansza” (wszystkie drabinki motywów są równe; miniatura tła pokazuje całą scenę).
const ZC_TORY_WSPOLNE=["widownia","tlo","klawisze"],ZC_TORY_GRACZA=["streak"],ZC_TOR_PLANSZY="tlo";
// Kto wybiera planszę (wybór gracza pomija losowanie z poprzedniej planszy; są też „wybierz losową” i „wybierają
// wszyscy”). Tryb stoi w ustawieniach (S.ust.planszaTryb),
// przełącza się w pasku „Plansza” w lobby i decyduje, co robi „Śpiewamy!”:
//   · "wszyscy" (domyślnie) = duże okno wyboru po starcie, przy różnych wyborach losowanie paskiem kart,
//   · "los"              = bez wybierania: gra od razu losuje planszę ze wszystkich zdobytych,
//   · "ta"               = bez okna: gramy na planszy z paska (ta, którą ekipa ma wybraną).
// Kliknięcie konkretnej planszy w oknie „Plansza” samo przestawia tryb na "ta" (wybrał, więc nie ma czego losować).
const ZC_PLANSZA_TRYBY=["wszyscy","los","ta"];
const trybPlanszy=()=>ZC_PLANSZA_TRYBY.includes(S.ust.planszaTryb)?S.ust.planszaTryb:"wszyscy";
function ustawTrybPlanszy(tryb){
  if(!ZC_PLANSZA_TRYBY.includes(tryb)||S.ust.planszaTryb===tryb)return false;
  S.ust.planszaTryb=tryb;zapiszUstawienia();rysujSceneWspolna();
  const b=document.querySelector('#scenaWspolna .plansza-tryb-opcja[data-tryb="'+tryb+'"]');
  if(b)b.focus({preventScroll:true});
  return true;
}
// Profil gościa ma w zapisie stałą nazwę „Gość” (klucz postępów); na ekranie w języku gry.
const pokazProfil=n=>n===Postepy.GOSC?T.gosc:n;
function profileWSkladzie(){
  const out=[];for(const g of S.gracze){const n=Postepy.nazwaProfilu(g);if(n&&!out.includes(n))out.push(n);}
  return out;
}
// Plansza: motywy odblokowane przez ekipę (pula + skróty z osiągnięć kogokolwiek), motyw w użyciu i wybór. Tor bez
// znaczenia (jedna lista dla widowni, tła i klawiszy), zostaje w sygnaturach dla kontekstu okna.
function odblokowaneWspolne(tor){return Postepy.ekipa().odblokowane;}
function wyborWspolny(tor){return Postepy.ekipa().motyw;}
// 10-21: wskazanie konkretnej planszy w oknie „Plansza” to wybór człowieka, więc gra już jej nie losuje — tryb paska
// idzie na "ta". „Auto” (zawsze najwyższa) tryb zostawia: to nadal jedna plansza, tylko wskazana progiem, a nie palcem.
function wybierzWspolny(tor,v){
  Postepy.wybierzMotyw(v||"auto");
  if(v&&v!=="auto"&&trybPlanszy()!=="ta"){S.ust.planszaTryb="ta";zapiszUstawienia();}
}
function kontekstWspolny(){
  return {wspolny:true,plansza:true,slawa:()=>Postepy.ekipa().slawa,odb:odblokowaneWspolne,wyb:wyborWspolny,
    jestAuto:()=>Postepy.ekipa().jestAuto,wybierz:wybierzWspolny,nazwaToru:()=>T.scenaPlansza};
}
// Ostatni wybór planszy gracza (10-17 wieczór): g.glosPlanszy = motyw z puli ekipy, na start ten, który ekipa ma teraz;
// od niego startuje kursor gracza w oknie wyboru planszy (oknoWyboruPlanszy). Żyje w obiekcie gracza do końca sesji.
function glosPlanszy(g){
  const e=Postepy.ekipa();if(!g.glosPlanszy||!e.odblokowane.includes(g.glosPlanszy))g.glosPlanszy=e.motyw;
  return g.glosPlanszy;
}
// Okno „Scena: <profil>” w tym samym oknie co wybór gracza (#wyborGracza: Esc, klik obok, strzałki i pad jak tam):
// podgląd na żywo (przyklejony u góry), sekcje torów gracza (streak, klawisze) i lista osiągnięć. `sekcja` = tor albo
// "osiagniecia". Widownia i tło mają osobne okno: otworzSceneWspolna.
function otworzScene(g,sekcja,powrot){
  const box=el("wyborGracza"),nazwa=Postepy.nazwaProfilu(g);if(!box||!nazwa)return;
  schowajToast();   // Z-87
  const ctx=kontekstProfilu(nazwa);
  const karta=h("div","karta tablica-karta okno-karta scena-karta");karta.setAttribute("role","dialog");karta.setAttribute("aria-modal","true");
  karta.setAttribute("aria-labelledby","scenaTytul");
  const glowa=h("header","tablica-glowa"),tyt=h("h2","tablica-tytul",tt("scenaTytul",{nazwa:pokazProfil(nazwa)}));tyt.id="scenaTytul";
  const zam=h("button","gracz-usun tablica-zamknij","×");zam.type="button";zam.setAttribute("aria-label",T.oknoZamknij);zam.title=T.oknoZamknij;
  zam.onclick=()=>zamknijWyborGracza();
  glowa.append(tyt,zam);
  const cialo=h("div","okno-cialo scena-cialo"),pod=podgladSceny(g,ctx);
  cialo.append(h("p","okno-wstep",T.scenaWstepSlawa+" "+T.scenaWlascicielOpis+(nazwa===Postepy.GOSC?" "+T.scenaGosc:"")),pod.el);
  // po zmianie wyboru karty w lobby rysują się od nowa: powrót fokusu idzie do nowej miniatury tego toru
  const poZmianie=()=>{
    const z=S.wyborZ,typ=z&&z.dataset?z.dataset.typ:null;rysujGraczy();
    if(z&&!z.isConnected){const k=document.querySelector('.gracz[data-id="'+CSS.escape(g.id)+'"]');
      const n=k&&(typ?k.querySelector('.kw-glowny[data-typ="'+typ+'"]'):k.querySelector(".scena-osiag"));if(n)S.wyborZ=n;}
  };
  for(const tor of ZC_TORY_GRACZA)cialo.append(sekcjaToruSceny(ctx,tor,pod,poZmianie));
  cialo.append(sekcjaDrogi(nazwa));if(Postepy.OSIAGNIECIA_AKTYWNE)cialo.append(sekcjaOsiagniecSceny(nazwa,pod));   // 10-19: bez osiągnięć
  karta.append(glowa,cialo);box.replaceChildren(karta);box.hidden=false;
  S.wyborZ=powrot||document.activeElement;
  const torStart=ZC_TORY_GRACZA.includes(sekcja)?sekcja:"streak";
  pod.pokaz(torStart,Postepy.wybor(nazwa)[torStart]);
  const cel=sekcja==="osiagniecia"?cialo.querySelector(".osiag"):
    cialo.querySelector('[data-sekcja="'+torStart+'"] .scena-kafel[aria-checked="true"]')||cialo.querySelector('[data-sekcja="'+torStart+'"] .scena-kafel');
  if(cel){cel.focus({preventScroll:true});if(cel.scrollIntoView)cel.scrollIntoView({block:"nearest"});}
  pod.start();
}
// Efekt i osiągnięcia profilu bez dołączania do składu (10-15: wcześniej lista była tylko z karty gracza w Rozgrywce).
// Wejścia: okno Konto (plakietka w menu) i wiersz w oknie Profile. Gracz-zastępca w kolorze profilu zasila tylko
// podgląd; `powrot` = element albo funkcja (zamknięcie okna otwiera z powrotem okno, z którego przyszło).
function otworzOsiagnieciaProfilu(nazwa,powrot){
  if(typeof S==="undefined"||S.ekran!=="lobby")return false;
  const n=Postepy.profil(nazwa==null?Postepy.GOSC:nazwa).nazwa,gosc=Postepy.kluczProfilu(n)===Postepy.kluczProfilu(Postepy.GOSC);
  const g={id:"profil:"+Postepy.kluczProfilu(n),zrodlo:"mysz",nazwa:n,nazwaWlasna:!gosc,kolor:Postepy.kolor(n)||ZC_PALETA[0],partia:0};
  otworzScene(g,"osiagniecia",powrot);
  return !el("wyborGracza").hidden;
}
// Okno „Instrumenty: <profil>” (10-17, kafel Instrument w karcie gracza): wszystkie instrumenty obrazkami, zdobyte
// najpierw (klik = wybór i odsłuch), potem niezdobyte zakryte kłódką: „???”, bez obrazka, nazwy i odsłuchu, ramka
// w kolorze rzadkości. Własne instrumenty ze Studia są wśród zdobytych (z grafiką użytkownika, gdy ją mają).
function otworzWyborInstrumentu(g,powrot){
  const box=el("wyborGracza");if(!box)return;
  schowajToast();   // Z-87
  const nazwa=Postepy.nazwaProfilu(g)||Postepy.GOSC,L=instrumentyGracza(g),baza=Glos.INSTRUMENTY_GRACZA;
  const kolejnosc=L.concat(baza.filter(i=>!L.includes(i)));
  const karta=h("div","karta tablica-karta okno-karta scena-karta instr-karta");karta.setAttribute("role","dialog");karta.setAttribute("aria-modal","true");
  karta.setAttribute("aria-labelledby","instrTytul");
  const bot=g.zrodlo==="bot";   // 10-17: bot (robo-żaba) gra każdym instrumentem, w tytule jego imię zamiast profilu
  const glowa=h("header","tablica-glowa"),tyt=h("h2","tablica-tytul",tt("instrumentyTytul",{nazwa:bot?g.nazwa:pokazProfil(nazwa)}));tyt.id="instrTytul";
  const zam=h("button","gracz-usun tablica-zamknij","×");zam.type="button";zam.setAttribute("aria-label",T.oknoZamknij);zam.title=T.oknoZamknij;
  zam.onclick=()=>zamknijWyborGracza();
  glowa.append(tyt,zam);
  const cialo=h("div","okno-cialo scena-cialo"),ile=L.filter(i=>baza.includes(i)).length;
  cialo.append(h("p","okno-wstep",bot?T.instrumentyBotWstep:tt("instrumentyOdblokowane",{n:ile,z:baza.length})+" "+T.instrumentyWstep));
  const rz=h("div","instr-siatka");rz.setAttribute("role","radiogroup");rz.setAttribute("aria-label",T.instrumentGracza);
  const odswiez=()=>{const v=instrumentGracza(g);for(const b of rz.children)b.setAttribute("aria-checked",String(b.dataset.v===v));};
  for(const id of kolejnosc){
    const ma=L.includes(id),b=h("button","instr-kafel"+(ma?"":" zablokowany"));b.type="button";b.dataset.v=id;b.setAttribute("role","radio");
    try{if(Postepy.rzadkosc&&baza.includes(id))b.dataset.rz=Postepy.rzadkosc("instrument",id);}catch(e){}
    if(ma){
      const ob=h("span","instr-obraz"),nz=T.instrumentyGracza[id]||id;obrazInstrumentu(ob,id);b.append(ob,h("span","instr-nazwa",nz));
      b.title=tt("instrumentWybierz",{nazwa:nz});b.setAttribute("aria-label",nz);
      b.onclick=()=>{
        S.ust.instrumentyGraczy=Object.assign({},S.ust.instrumentyGraczy,{[g.id]:id});zapiszUstawienia();odsluchajInstrument(id,przejsciaGracza(g,id));odswiez();
        if(S.gracze.includes(g)){rysujGraczy();const n=document.querySelector('.gracz[data-id="'+CSS.escape(g.id)+'"] .kw-glowny[data-typ="instrument"]');if(n)S.wyborZ=n;}
      };
    }else{
      const z=h("span","instr-obraz scena-zakryte");z.innerHTML=ZC_KLODKA;z.append(h("span","scena-zakryte-znak","?"));
      b.append(z,h("span","instr-nazwa",T.nieodkryte));b.setAttribute("aria-disabled","true");
      b.title=T.instrumentNieodkryty;b.setAttribute("aria-label",T.nieodkryte+". "+T.instrumentNieodkryty);
      b.onclick=()=>toast(T.instrumentNieodkryty);
    }
    rz.append(b);
  }
  odswiez();
  cialo.append(rz);karta.append(glowa,cialo);box.replaceChildren(karta);box.hidden=false;
  S.wyborZ=powrot||document.activeElement;
  const cel=rz.querySelector('[aria-checked="true"]')||rz.firstChild;
  if(cel){cel.focus({preventScroll:true});if(cel.scrollIntoView)cel.scrollIntoView({block:"nearest"});}
}
// Okno „Plansza” (10-10; do 10-10 „Scena wspólna”): jedna drabinka motywów planszy (tło + widownia + klawisze naraz) z puli
// ekipy, to samo okno, podgląd i kafle co scena gracza, kontekst wspólny. Podgląd pokazuje tor tła (karta na scenie),
// bo miniatura tła mieści całą scenę; `sekcja` zostaje w sygnaturze dla wywołań z paska.
function otworzSceneWspolna(sekcja,powrot){
  const box=el("wyborGracza");if(!box)return;
  schowajToast();   // Z-87
  const ctx=kontekstWspolny(),wl=wlascicielSceny()||{kolor:"#ec1a83",partia:0},tor=ZC_TOR_PLANSZY;
  const karta=h("div","karta tablica-karta okno-karta scena-karta scena-karta-wspolna");karta.setAttribute("role","dialog");karta.setAttribute("aria-modal","true");
  karta.setAttribute("aria-labelledby","scenaTytul");
  const glowa=h("header","tablica-glowa"),tyt=h("h2","tablica-tytul",T.planszaTytul);tyt.id="scenaTytul";
  const zam=h("button","gracz-usun tablica-zamknij","×");zam.type="button";zam.setAttribute("aria-label",T.oknoZamknij);zam.title=T.oknoZamknij;
  zam.onclick=()=>zamknijWyborGracza();
  glowa.append(tyt,zam);
  const cialo=h("div","okno-cialo scena-cialo"),pod=podgladSceny(wl,ctx);
  cialo.append(h("p","okno-wstep",T.planszaOpis),pod.el);
  // wybór przerysowuje karty i pasek „Plansza”; powrót fokusu do nowego przycisku paska
  const poZmianie=()=>{
    const z=S.wyborZ,kz=z&&z.closest?z.closest(".gracz"):null;rysujGraczy();
    if(z&&!z.isConnected){const n=kz?document.querySelector('.gracz[data-id="'+CSS.escape(kz.dataset.id)+'"] .kw-glowny[data-typ="tlo"]')
      :document.querySelector("#scenaWspolna .plansza-zobacz");if(n)S.wyborZ=n;}
  };
  cialo.append(sekcjaToruSceny(ctx,tor,pod,poZmianie));
  karta.append(glowa,cialo);box.replaceChildren(karta);box.hidden=false;
  S.wyborZ=powrot||document.activeElement;
  pod.pokaz(tor,ctx.wyb(tor));
  const cel=cialo.querySelector('[data-sekcja="'+tor+'"] .scena-kafel[aria-checked="true"]')||cialo.querySelector('[data-sekcja="'+tor+'"] .scena-kafel');
  if(cel){cel.focus({preventScroll:true});if(cel.scrollIntoView)cel.scrollIntoView({block:"nearest"});}
  pod.start();
}
// Pasek „Plansza” w lobby (nad kartami graczy; 10-17 wieczór): jeden niski wiersz. Planszę każdy wybiera po „Śpiewamy!”
// w dużym oknie (oknoWyboruPlanszy), więc tu tylko obecna plansza ekipy, krótka informacja, sława ekipy do następnego
// motywu i „Zobacz plansze” (okno „Plansza”: wszystkie motywy, także niezdobyte; wybór tam = domyślny kursor w oknie).
// Id #scenaWspolna i klasa .scena-wspolna zostają (style, smoke).
function rysujSceneWspolna(){
  const siatka=el("siatkaGraczy");if(!siatka)return;
  let box=el("scenaWspolna");
  if(!box){box=h("div","scena-wspolna plansza");box.id="scenaWspolna";siatka.before(box);}
  // 10-18 (Postepy.SCENY_Z_KOLA): scena nie ma progu, więc pasek liczy sławę ekipy do następnego losowania na kole
  const tor=ZC_TOR_PLANSZY,e=Postepy.ekipa(),zKola=!!Postepy.SCENY_Z_KOLA,poz=zKola?Postepy.poziomGraczaZ(e.slawa):e.poziom,wpis=(e.motyw&&Postepy.wpis(tor,e.motyw))||Postepy.drabinka(tor)[0]||null;
  const im=h("img","plansza-mini");im.alt="";im.draggable=false;if(wpis)im.src=Motywy.sciezka(wpis.id,"tlo.webp");
  im.onerror=()=>{const cv=document.createElement("canvas");cv.className="plansza-mini";miniaturaStopnia(cv,tor,wpis);im.replaceWith(cv);};
  const tryb=trybPlanszy();
  // 10-21: w pasku zostaje sama nazwa planszy — co się stanie po „Śpiewamy!”, mówi wybrana opcja obok (i jej dymek)
  const info=h("p","plansza-glosy");info.append(h("b","",wpis?nazwaPary("plansza",wpis.nazwa):""));
  info.title=T["planszaTrybOpis_"+tryb];
  // 10-21: kto wybiera planszę — trzy opcje w pasku (grupa radio, klawiatura i mysz; w kroku „Rozgrywka” pad należy do graczy)
  const tryby=h("div","plansza-tryb");tryby.setAttribute("role","radiogroup");tryby.setAttribute("aria-label",T.planszaTrybEt);
  for(const t of ZC_PLANSZA_TRYBY){
    const b=h("button","plansza-tryb-opcja",T["planszaTryb_"+t]);b.type="button";b.dataset.tryb=t;
    b.setAttribute("role","radio");b.setAttribute("aria-checked",String(t===tryb));
    b.title=T["planszaTrybOpis_"+t];
    b.onclick=()=>ustawTrybPlanszy(t);
    tryby.append(b);
  }
  const zob=h("button","plansza-zobacz",T.planszaZobacz);zob.type="button";zob.title=T.planszaOtworz;zob.onclick=()=>otworzSceneWspolna(tor,zob);
  const pas=h("span","plansza-pasek"),wyp=h("span","plansza-pasek-w"),liczby=h("span","plansza-liczby");pas.append(wyp);
  const f=poz.do!=null?(e.slawa-poz.od)/Math.max(1,poz.do-poz.od):1;
  wyp.style.width=Math.round(100*Math.max(0,Math.min(1,f)))+"%";
  liczby.textContent=poz.do!=null?tt("scenaSlawaPasek",{ile:fmtSlawa(e.slawa),prog:fmtSlawa(poz.do)}):fmtSlawa(e.slawa);
  pas.title=zKola?(poz.do!=null?tt("planszaLosDymek",{ile:fmtSlawa(e.slawa),brak:fmtSlawa(poz.do-e.slawa)}):tt("scenaPlanszaSlawa",{ile:fmtSlawa(e.slawa)})):
    poz.do!=null?tt("planszaSlawaDymek",{ile:fmtSlawa(e.slawa),n:poz.nastepny?(+poz.nastepny.stopien||poz.stopien+1):poz.stopien+1,brak:fmtSlawa(poz.do-e.slawa)}):tt("scenaPlanszaSlawa",{ile:fmtSlawa(e.slawa)});
  const slawa=h("div","plansza-slawa");slawa.append(pas,liczby);
  box.replaceChildren(h("span","scena-wspolna-et",T.scenaPlansza),im,info,tryby,zob,slawa);
}
function rysujGraczy(){
  try{wczytajGrafikiMotywow();}catch(e){}
  const siatka=el("siatkaGraczy"),a=document.activeElement;
  const pisze=a&&a.classList&&a.classList.contains("gracz-nazwa-pole")?{id:a.dataset.id,wart:a.value,od:a.selectionStart,do:a.selectionEnd}:null;
  siatka.replaceChildren();
  for(const g of S.gracze)synchronizujPomoce(g);   // 10-18 wieczór: profil mógł się zmienić (okno Profile, konto, dołączenie)
  kartaGracza.prz=przydzialEkranu();
  try{for(const g of S.gracze)siatka.append(kartaGracza(g));}finally{kartaGracza.prz=null;}
  uwagaTorow();   // Z-51: liczba graczy zmienia, czy „Każdy swój” gra wspólnym torem
  if(pisze){const p=siatka.querySelector('.gracz-nazwa-pole[data-id="'+CSS.escape(pisze.id)+'"]');
    if(p){p.value=pisze.wart;p.focus({preventScroll:true});try{p.setSelectionRange(pisze.od,pisze.do);}catch(e){}}}
  if(S.gracze.length<ZC_MAKS_GRACZY){   // pusty slot: ten sam wybór, z zaznaczoną myszą
    const b=h("button","dolacz-mysz",S.gracze.some(g=>g.id==="mysz")?T.dodajGracza:T.dolaczMysz);b.type="button";
    b.onclick=()=>{Glos.odblokuj();otworzWyborGracza({mysz:true,powrot:b});};
    siatka.append(b);
  }
  siatka.classList.toggle("ciasna",S.gracze.length>4);   // 5–8 kart: bez linii pomocy, notka o partii zostaje
  dopasujSiatkeGraczy();
  rysujSceneWspolna();
  el("liczbaGraczy").textContent=tt("liczbaGraczy",{n:S.gracze.length});
  el("btnDodajGracza").disabled=S.gracze.length>=ZC_MAKS_GRACZY;
  zapiszSkladTeraz();
  rysujCzekajace();
  odswiezStart();
  pokazPolaKapsli();
  if(typeof Biblioteka!=="undefined"&&el("podgladPartii"))try{Biblioteka.odswiez();}catch(e){}
}
// 10-15: przy 3+ graczach na niskim ekranie (1280×720) druga linia kart chowała się pod podglądem partii. Gdy siatka
// się nie mieści, podgląd zwija się do paska (wybór partii i „Powiększ” zostają, gry.css .pp-zwiniety), a gdy nadal
// brakuje miejsca, karty tracą linię pomocy jak przy 5–8 graczach. Pomiar po ułożeniu; też przy zmianie rozmiaru okna.
function dopasujSiatkeGraczy(){
  const siatka=el("siatkaGraczy"),kol=siatka&&siatka.closest(".kol-gracze");if(!kol)return;
  // siatka zmienia wysokość też bez rysujGraczy (panel „Plansza” nad nią dociąga obrazki, czcionki): wtedy pomiar od nowa
  if(!siatka._obserwator&&typeof ResizeObserver!=="undefined"){let t=0,h0=siatka.clientHeight;
    siatka._obserwator=new ResizeObserver(()=>{const h=siatka.clientHeight;if(Math.abs(h-h0)<2)return;h0=h;clearTimeout(t);
      t=setTimeout(()=>{if(S.ekran==="lobby"&&S.lobbyEkran==="konfiguracja")dopasujSiatkeGraczy();},60);});
    siatka._obserwator.observe(siatka);}
  kol.classList.remove("pp-zwiniety");siatka.classList.toggle("ciasna",S.gracze.length>4);siatka.style.removeProperty("--kw-h-siatka");
  // 11-19: także przy 1–2 graczach. W 1280×720 karta nie mieściła się nad podglądem i ucinało jej dół razem ze ściągą
  // sterowania (jedyne miejsce, gdzie kapsel czyta, co robi przechył i przycisk); teraz podgląd zwija się tak samo jak od 3.
  if(!kol.getClientRects().length||!S.gracze.length||kol.classList.contains("pp-rozwiniety"))return;
  const brak=()=>siatka.scrollHeight>siatka.clientHeight+2;
  if(brak())kol.classList.add("pp-zwiniety");
  // 10-17 wieczór: zanim karty stracą podpisy i obrazki 36 px (ciasna), obrazki kafli maleją po 4 px do 46 px
  if(brak()&&!siatka.classList.contains("ciasna")){const o=siatka.querySelector(".gracz-kafle .kw-obraz");   // --kw-h to clamp(), więc miarą jest obrazek
    let hk=o?Math.floor(o.getBoundingClientRect().height):0;
    while(hk>46&&brak()){hk=Math.max(46,hk-4);siatka.style.setProperty("--kw-h-siatka",hk+"px");}
    if(brak())siatka.style.removeProperty("--kw-h-siatka");}
  if(brak())siatka.classList.add("ciasna");
}
addEventListener("resize",()=>{if(S.ekran==="lobby"&&S.lobbyEkran==="konfiguracja")dopasujSiatkeGraczy();});
// Żywe kapsle, które jeszcze nie dołączyły: widać je i widać, że się ruszają.
function rysujCzekajace(){
  const box=el("czekajace");box.replaceChildren();
  const czekaja=Wejscie.gracze().filter(w=>w.zrodlo==="kapsel"&&!S.gracze.some(g=>g.id===w.id));
  box.hidden=!czekaja.length;
  if(!czekaja.length)return;
  box.append(h("span","czekajace-tytul",T.czekaja));
  for(const w of czekaja){
    const c=h("span","czekajacy");c.style.setProperty("--kolor",w.kolor);c.dataset.id=w.id;
    const kap=h("img","czekajacy-kapsel");kap.src=w.obrazekKapsla;kap.alt="";
    const miernik=h("span","miernik maly"),zaba=h("img","czekajacy-zaba");zaba.src=ZC_ZASOBY.zaby[0];zaba.alt="";
    miernik.append(zaba);
    c.append(kap,h("span","czekajacy-nazwa",w.nazwa),miernik);
    box.append(c);
  }
}
function odswiezStart(){
  const b=el("btnStart"),za=S.autoStart!=null?S.autoStart:S.wszyscyGotowi;
  // pakiet z audio: słyszalny plik się nie wczytał i nie jest pominięty (pakiet-piosenki.js) = start stoi, napis mówi dlaczego
  const blok=typeof PakietPiosenki!=="undefined"&&S.gracze.length?PakietPiosenki.blokadaStartu(piosenka()):null;
  const tekst=!S.gracze.length?T.brakGraczy:blok?blok:(za!=null?tt("startZa",{n:Math.max(1,Math.ceil(za))}):T.start);
  const wyl=!S.gracze.length||!!blok;
  if(b.disabled!==wyl)b.disabled=wyl;
  if(b.textContent!==tekst)b.textContent=tekst;   // co klatkę, więc tylko przy zmianie
  // licznik gotowych obok przycisku (11-19): przy dwóch i więcej ludziach widać z daleka, na kogo czeka start
  let lic=el("startGotowi");
  if(!lic){lic=h("span","start-gotowi");lic.id="startGotowi";lic.setAttribute("aria-live","polite");b.before(lic);}
  const ludzie=S.gracze.filter(g=>g.zrodlo!=="bot"),got=ludzie.filter(g=>g.gotowy).length;
  const licT=ludzie.length>1&&za==null&&!blok?tt("startGotowi",{n:got,z:ludzie.length}):"";
  if(lic.textContent!==licT){lic.textContent=licT;lic.hidden=!licT;lic.dataset.wszyscy=String(got===ludzie.length);}
  const pasek=el("dzwiekLobby");
  if(pasek.hidden===S.czekaNaDzwiek)pasek.hidden=!S.czekaNaDzwiek;
}
// Klatka lobby: żabki w miernikach chodzą za przechyłem, przechył w bok zmienia partię, liczniki startu.
function lobbyKrok(dt){
  const rozgrywka=S.lobbyEkran==="konfiguracja";   // w menu i przy wyborze piosenki nikt nie zmienia partii ani nie startuje
  if(S.wyborPlanszy){krokWyboruPlanszy(dt);return;}   // okno wyboru planszy: sterowanie graczy idzie do niego
  for(const g of S.gracze){
    const w=zrodloGracza(g);if(!w)continue;
    if(rozgrywka&&w.zrodlo!=="mysz"&&w.zrodlo!=="bot"&&w.zrodlo!=="kapsel"){   // przechył w bok z histerezą: jedno wychylenie = jeden krok
      // 11-19: bok (A/D, ←/→, gałka pada) zmienia wybrane pole karty, nie zawsze partię; przy oknie nad ekranem stoi
      if(g.rollWolny&&!g.gotowy&&Math.abs(w.roll)>25){if(!nakladkaLobby())zmienPoleKapsla(g,w.roll>0?1:-1);g.rollWolny=false;}
      else if(Math.abs(w.roll)<12)g.rollWolny=true;
    }
  }
  const zw=Wejscie.stanZywych(),rozlaczeni=zw.wlaczone&&!zw.polaczony,info=el("zywiStan");
  if(info.hidden===rozlaczeni)info.hidden=!rozlaczeni;   // ?zywe=1, a aplikacja nie odpowiada
  const blokPakietu=typeof PakietPiosenki!=="undefined"&&!!PakietPiosenki.blokadaStartu(piosenka());   // brak nagrania pakietu: odliczanie stoi
  if(S.autoStart!=null&&!blokPakietu){S.autoStart-=dt;if(S.autoStart<=0){S.autoStart=null;startGry();return;}}
  const ludzie=S.gracze.filter(g=>g.zrodlo!=="bot");
  const wszyscy=rozgrywka&&ludzie.length>0&&S.gracze.every(g=>g.gotowy);
  // Sam start „wszyscy gotowi” rusza dopiero, gdy przeglądarka pozwoli grać: z samych kapsli (EventSource)
  // nie ma żadnego gestu, a gra bez dźwięku to nie gra. Do tego czasu pasek „kliknij gdziekolwiek”.
  if(wszyscy&&Glos.stan()!=="running"){
    if(!S.czekaNaDzwiek){S.czekaNaDzwiek=true;Glos.odblokuj();}
    S.wszyscyGotowi=null;
  }else S.czekaNaDzwiek=false;
  if(wszyscy&&!S.czekaNaDzwiek&&S.wszyscyGotowi==null)S.wszyscyGotowi=3;
  if(!wszyscy)S.wszyscyGotowi=null;
  if(S.wszyscyGotowi!=null&&!blokPakietu){S.wszyscyGotowi-=dt;if(S.wszyscyGotowi<=0){S.wszyscyGotowi=null;startGry();return;}}
  odswiezStart();
}
// Kapsel jako pilot (najpierw lobby, potem KAŻDE menu). Sterowanie kapslem ma działać w każdym menu gry, bo gra
// jest przede wszystkim demonstracją kapsla w kontekście gry. Wcześniej pilot liczył
// się tylko w kroku lobby, więc w pauzie, na wynikach i w samouczku kapsel nie ruszał fokusu: kto grał samym kapslem,
// nie wracał nim do piosenki ani nie wychodził z wyników — musiał sięgnąć po mysz. Teraz pilot idzie co klatkę,
// dokładnie tam, gdzie pad przestaje śpiewać i nawiguje (menuWlaczone), czyli oba sterowania widzą te same ekrany,
// a zdarzenia kapsla jadą tą samą drogą co pad: nawigujLobby.
// Wyjątki, bo przycisk kapsla znaczy tam co innego:
//   · krok Rozgrywka (bez okna nad nim): kapsel steruje swoją kartą po polach (11-19): przód/tył = wybór pola
//     (Partia, Skin, Instrument, Pomoce, Poziom gry), w bok = zmiana wartości, przycisk = gotowe, przytrzymanie =
//     jeszcze nie, a gdy gracz nie jest gotowy: powrót do kroku Piosenka (polaKapsla, zmienPoleKapsla),
//   · koło nagród: przycisk jedzie wprost do dźwigni (nagrody.js czyta go po trzymaniu), więc pilot go nie bierze —
//     inaczej przytrzymanie „na moc” zamykało okno po 0,6 s, a krótkie naciśnięcie zaczynało ładowanie bez puszczenia,
//   · samouczek: dymek przewija się „ok”, a przytrzymanie kończy naukę (jak A i B pada w jak-grac.js),
//   · okno wyboru planszy: ma własne sterowanie (krokWyboruPlanszy).
// W lobby pilotem jest kapsel, który DOŁĄCZYŁ (pierwsze naciśnięcie dołącza, dolaczKapsel); poza lobby nie ma do
// czego dołączać, więc menu prowadzi każdy podłączony kapsel — jak każdy podłączony pad.
// Pola karty, po których kapsel chodzi w kroku Rozgrywka (11-19). Do 11-19 kapsel zmieniał tylko partię (w bok)
// i instrument (przód/tył), a skin, pomoce i „Poziom gry” wymagały myszy: kto grał samym kapslem, nie wybrał poziomu.
// Kolejność jak na karcie: partia u góry, potem kafle od lewej, na końcu wspólny „Poziom gry” w Ustawieniach.
// g.pole = indeks pola (nie zapisuje się w składzie); partia znika z listy, gdy utwór ma jedną.
// Te same pola ma klawiatura i pad (obsluzWejscie, lobbyKrok): góra/dół wybiera pole, bok je zmienia. Do 11-19 miały
// swój układ (góra/dół = instrument, bok = partia) i tak jak kapsel nie sięgały skina, pomocy ani poziomu gry.
// Mysz i bot pól nie mają: mysz klika, bota ustawia ten, kto go dodał.
// Kapsel z łapką (od 11-20 jedyny tryb gracza) pól nie ma: klika je jak mysz, więc nie dostaje ramki pola.
const maPolaKarty=g=>!!g&&((g.zrodlo==="kapsel"&&!(typeof KursorLapka!=="undefined"&&KursorLapka.aktywny()))||g.zrodlo==="ws"||g.zrodlo==="strzalki"||g.zrodlo==="pad");
function polaKapsla(g){
  const p=piosenka();
  return (p&&p.partie.length>1?["partia"]:[]).concat(["skin","instrument","pomoce","poziom"]);
}
function poleKapsla(g){const L=polaKapsla(g);return L[Math.max(0,Math.min(L.length-1,g.pole|0))];}
function elementPolaKapsla(g,pole){
  if(pole==="poziom")return document.querySelector("#ustawienia .ust-presety");
  const k=document.querySelector('#siatkaGraczy .gracz[data-id="'+CSS.escape(g.id)+'"]');if(!k)return null;
  if(pole==="partia")return k.querySelector(".gracz-partia");
  const kafle=k.querySelectorAll(".gracz-kafle .kw");   // rzadSceny: Skin, Instrument, Pomoce
  return kafle[pole==="skin"?0:pole==="instrument"?1:2]||null;
}
// Ramka w kolorze gracza na polu, które teraz trzyma (kapsel, klawiatura, pad); gotowy gracz ramki nie ma (jego karta
// jest zamknięta).
function pokazPolaKapsli(){
  const ekran=el("konfiguracja");if(!ekran)return;
  for(const e of ekran.querySelectorAll(".pole-kapsla")){e.classList.remove("pole-kapsla");e.style.removeProperty("--kolor-pola");e.style.removeProperty("--kapsel-pola");e.removeAttribute("data-pole-kapsla");}
  if(S.ekran!=="lobby"||S.lobbyEkran!=="konfiguracja")return;
  for(const g of S.gracze){
    if(!maPolaKarty(g)||g.gotowy)continue;
    const e=elementPolaKapsla(g,poleKapsla(g));if(!e)continue;
    e.classList.add("pole-kapsla");e.style.setProperty("--kolor-pola",g.kolor||"#ec1a83");e.dataset.poleKapsla=tt("poleKapsla",{kto:g.nazwa});
    if(g.obrazekKapsla)e.style.setProperty("--kapsel-pola",'url("'+String(g.obrazekKapsla).replace(/["\\\n]/g,"")+'")');
  }
}
function przesunPoleKapsla(g,kier){
  const L=polaKapsla(g),i=Math.max(0,Math.min(L.length-1,g.pole|0)),j=Math.max(0,Math.min(L.length-1,i+kier));
  if(j===i)return;
  g.pole=j;Glos.tik();pokazPolaKapsli();
  const e=elementPolaKapsla(g,L[j]);if(e&&e.scrollIntoView)e.scrollIntoView({block:"nearest",inline:"nearest"});
  if(L[j]==="partia")Biblioteka.pokazPartie(g.partia,g.id);
}
function zmienPoleKapsla(g,kier){
  const pole=poleKapsla(g);
  if(pole==="partia")zmienPartie(g,kier);
  else if(pole==="instrument")zmienInstrument(g,kier);
  else if(pole==="skin"){   // ta sama strzałka co pod myszą: kolejny zdobyty skin albo „auto”
    const e=elementPolaKapsla(g,"skin"),s=e&&e.querySelector(kier<0?".kw-lewo":".kw-prawo");if(s){s.click();Glos.tik();}
  }else if(pole==="pomoce"){   // przyciąganie do nut o stopień; od tej chwili gracz ma własne pomoce (jak w oknie „Pomoce”)
    const p=pomoceGracza(g),v=Math.max(0,Math.min(ZC_POMOC.POZIOMY.length-1,(p.przyciaganie|0)+kier));
    if(v!==(p.przyciaganie|0)){p.przyciaganie=v;ustawPomoceGracza(g,p);Glos.tik();}
  }else if(pole==="poziom"){   // wspólny „Poziom gry”: sąsiedni zestaw, bez zawijania („Własne” tylko, gdy coś pamięta)
    const L=ZC_PRESETY.map(x=>x.k).concat(S.ust.presetWlasny&&typeof S.ust.presetWlasny==="object"?["wlasne"]:[]);
    const teraz=presetUstawien(S.ust)||"wlasne",i=L.indexOf(teraz),j=Math.max(0,Math.min(L.length-1,(i<0?L.length-1:i)+kier));
    if(L[j]!==teraz){zastosujPreset(L[j]);Glos.tik();}
  }
}
let pilotMenuPrzed=false;
function krokPilotow(dt){
  if(S.wyborPlanszy)return;
  const dymek=typeof JakGrac!=="undefined"&&!!JakGrac.dymek;
  const menu=menuWlaczone()||dymek;
  const rozgrywka=S.ekran==="lobby"&&S.lobbyEkran==="konfiguracja"&&!nakladkaLobby();
  const kolo=typeof Nagrody!=="undefined"&&!!Nagrody.otwarte;
  // wejście w menu z TRZYMANYM przyciskiem (koniec piosenki, dołączenie): to naciśnięcie nie jest ani „ok”, ani
  // „wstecz” — inaczej wyniki znikałyby temu, kto po prostu nie puścił kapsla na ostatniej nucie
  if(menu&&!pilotMenuPrzed)for(const w of Wejscie.gracze())
    if(w.zrodlo==="kapsel")S.piloty[w.id]={stan:{blokada:!!w.przycisk,wcisniety:!!w.przycisk,trzyma:0}};
  pilotMenuPrzed=menu;
  // w kroku Rozgrywka kapsel nie prowadzi fokusu, więc jego znaczek nie może wisieć tam, gdzie fokus był przedtem
  if(rozgrywka){const im=el("fokusKapsel");if(im&&!im.hidden)im.hidden=true;}
  if(!menu&&!rozgrywka)return;
  for(const w of Wejscie.gracze()){
    if(w.zrodlo!=="kapsel")continue;
    const g=S.gracze.find(x=>x.id===w.id);
    if(S.ekran==="lobby"&&!g)continue;
    const st=S.piloty[w.id]||(S.piloty[w.id]={stan:{blokada:!!w.przycisk,wcisniety:!!w.przycisk,trzyma:0}});
    const r=krokPilota(st.stan,{pitch:w.pitch,roll:w.roll,przycisk:!!w.przycisk},dt);st.stan=r.stan;
    const z=r.zdarzenia;
    if(kolo){   // dźwignia koła: zbocza przycisku wprost do nagrody.js, pilot nim nie klika i nie zamyka okna
      const dol=!!w.przycisk;
      if(dol!==!!st.kolo){st.kolo=dol;try{Nagrody.przytrzymaj(dol,w.id);}catch(e){}}
      z.ok=false;z.wstecz=false;
    }else if(st.kolo)st.kolo=false;   // koło zamknięte: następne otwarcie zaczyna od czystego zbocza
    // łapka (js/kursor-lapka.js): kapsel prowadzi kursor zamiast skakać fokusem, w menu i od 11-20 także w kroku
    // Rozgrywka (jak pilot Wii U: klika kafle, strzałki i „Gotowe” na swojej karcie); samouczek zostaje przy swoim.
    // Przytrzymanie w Rozgrywce działa jak dotąd: gotowemu otwiera kartę, niegotowego cofa do kroku Piosenka.
    if(!dymek&&typeof KursorLapka!=="undefined"&&KursorLapka.aktywny()){
      if(rozgrywka&&g&&z.wstecz){z.wstecz=false;if(g.gotowy){g.gotowy=false;rysujGraczy();}else wsteczLobby();}
      KursorLapka.krokKapsla(w,z,dt);continue;}
    if(!(z.gora||z.dol||z.lewo||z.prawo||z.ok||z.wstecz))continue;
    if(dymek){
      if(z.ok)JakGrac.dalej();else if(z.wstecz)JakGrac.zakoncz(false);
      continue;
    }
    if(rozgrywka&&g){
      if(g.gotowy){if(z.wstecz){g.gotowy=false;rysujGraczy();}continue;}   // gotowy: karta zamknięta, przytrzymanie ją otwiera
      if(z.gora||z.dol)przesunPoleKapsla(g,z.dol?1:-1);
      if(z.lewo||z.prawo)zmienPoleKapsla(g,z.prawo?1:-1);
      if(z.ok){g.gotowy=true;rysujGraczy();}
      else if(z.wstecz)wsteczLobby();   // nie gotowy: przytrzymanie cofa do kroku Piosenka (jak Esc i Back pada)
      continue;
    }
    S.pilot=w.id;
    // seria = ile razy z rzędu ten sam przechył w przód albo w tył już się powtórzył (krokPilota: czas > 0 to powtórzenie,
    // 0 to nowy przechył); od progu z ZC_SKOK lista utworów przewija się skokami
    if(z.gora||z.dol)st.seria=r.stan.czas>0?(st.seria|0)+1:0;
    const prog=ZC_SKOK.filter(x=>(st.seria|0)>=x.PO).pop(),skok=prog?{skok:prog.WIERSZY,powt:true}:(st.seria|0)>0?{powt:true}:undefined;
    for(const k of ["gora","dol","lewo","prawo","ok","wstecz"])if(z[k])nawigujLobby(k,k==="gora"||k==="dol"?(skok||{pilot:true}):{pilot:true});
    pokazPilota(w);
  }
}
// Kto trzyma pilota: ramka fokusu w kolorze kapsla i jego mały kapsel w rogu fokusowanego elementu.
// 10-20: także w pauzie i na wynikach (#fokusKapsel leży w <body>, nie w lobby), bo i tam kapsel prowadzi.
function pokazPilota(w){
  const b=document.body,img=el("fokusKapsel"),a=document.activeElement;
  b.classList.add("pilot","nawigacja");b.style.setProperty("--pilot",w.kolor||"#6cb33f");
  odswiezPodpowiedzListy();
  if(!img)return;
  if(!a||a===b){img.hidden=true;return;}
  const r=a.getBoundingClientRect();
  if(img.getAttribute("src")!==w.obrazekKapsla)img.src=w.obrazekKapsla;
  img.style.left=Math.round(r.right-12)+"px";img.style.top=Math.round(r.top-12)+"px";img.hidden=false;
}
function schowajPilota(){document.body.classList.remove("pilot");const img=el("fokusKapsel");if(img)img.hidden=true;odswiezPodpowiedzListy();}
// Ściąga nad listą utworów mówi językiem tego, kto prowadzi (11-19): kapslowi o przechyłach i przycisku, reszcie
// o klikaniu. Kapsel z kursorem-łapką klika jak mysz, więc zostaje przy zwykłym napisie.
function odswiezPodpowiedzListy(){
  const kapsel=document.body.classList.contains("pilot")&&!(typeof KursorLapka!=="undefined"&&KursorLapka.aktywny());
  const t=kapsel?T.wybranaPodpowiedzKapsel:T.wybranaPodpowiedz;
  // zdanie „Gest: skutek.” staje się parą [plakietka gestu] skutek (ściąga na krawędzi sceny); zwykłe zdanie zostaje zdaniem
  for(const e of document.querySelectorAll(".lista-podpowiedz,.wybrana-podpowiedz")){
    if(e.dataset.sciaga===t&&e.querySelector(".podp"))continue;
    e.dataset.sciaga=t;e.textContent="";
    for(const z of t.split(/\.\s+|\.$/).filter(Boolean)){
      const i=z.indexOf(": "),s=document.createElement("span");s.className="podp";
      if(i>0){const k=document.createElement("kbd");k.textContent=z.slice(0,i);s.append(k," ",z.slice(i+2));}else s.textContent=z+".";
      e.append(s," ");
    }
  }
}
function rysujLobbyNaZywo(){
  const R0=S.ust.zakres,znak=S.ust.odwroc?-1:1;
  const ustawZabe=(img,w,wys)=>{
    if(!img||!w)return;
    const x=Math.max(-1,Math.min(1,znak*w.pitch/R0));
    const klatka=w.przycisk?Math.min(4,Math.floor((1-x)/2*4.99)):0;
    if(img.dataset.k!==String(klatka)){img.src=ZC_ZASOBY.zaby[klatka];img.dataset.k=String(klatka);}
    img.style.transform="translate(-50%,"+(x*wys).toFixed(1)+"px) rotate("+(w.roll*.6).toFixed(1)+"deg)";
    img.style.opacity=(w.zrodlo==="kapsel"&&!w.swiezy)?".35":"1";
  };
  for(const g of S.gracze){
    const w=zrodloGracza(g);
    ustawZabe(g.lobbyZaba,w,15);
    if(g.lobbyCisza&&w&&g.lobbyCisza.hidden!==!!w.swiezy)g.lobbyCisza.hidden=!!w.swiezy;   // kapsel przestał nadawać ruch
  }
  for(const c of el("czekajace").querySelectorAll(".czekajacy"))ustawZabe(c.querySelector(".czekajacy-zaba"),Wejscie.gracz(c.dataset.id),6);
}
// ---- ekrany lobby: menu, Utwory, Zagraj (1 Piosenka → 2 Rozgrywka) ----
// S.ekran zostaje "lobby" na wszystkich ekranach przed grą (lobbyKrok, kapsle, podgląd, harness); który z nich
// widać, mówi S.lobbyEkran. Biblioteka, podgląd partii i pasek stanu to jedne elementy, przenoszone do gniazd
// [data-gniazdo] widocznego ekranu. Klawiatura i pad nawigują wszędzie poza krokiem Rozgrywka, gdzie należą
// do graczy (dołączanie Spacją, Enterem i padem jak dawniej); Esc i Back padem cofają o ekran.
// Utwory są bezpośrednio w kroku „1. Piosenka”: ekranu „utwory” już nie ma — biblioteka, paczki
// i import mieszkają w kroku 1 (#wybor), więc z menu prowadzi do nich samo „Zagraj”.
const ZC_LOBBY_EKRANY=["menu","wybor","konfiguracja","studioEkran"];
const ZC_LOBBY_WSTECZ={wybor:"menu",konfiguracja:"wybor",studioEkran:"menu"};
const ZC_LOBBY_Z_MENU={wybor:"btnZagraj",konfiguracja:"btnZagraj",studioEkran:"btnStudio"};
// Nieodebrane losowania (kto pominął odbiór nagrody albo komu gra się wysypała przed odbiorem, ma gdzie ją odebrać).
// Losowania czekają w zapisie
// (Postepy.losowania liczy je z poziomu i zużytych), więc przycisk „Odbierz nagrody” z licznikiem stoi w menu i na wynikach,
// dopóki jest co losować, i otwiera samo koło (Nagrody.odbierz). Profil = aktywne konto, bez konta Gość.
function profilNagrod(){try{const n=window.ZC&&ZC.konto&&ZC.konto.aktywny?ZC.konto.aktywny():null;return n||Postepy.GOSC;}catch(e){return Postepy.GOSC;}}
function odswiezNagrodyDoOdbioru(){
  let n=0;try{n=typeof Postepy!=="undefined"&&Postepy.losowania?Postepy.losowania(profilNagrod()):0;}catch(e){n=0;}
  for(const id of ["btnNagrody","btnWynikiNagrody"]){
    const b=el(id);if(!b)continue;b.hidden=!(n>0);if(!(n>0))continue;
    if(!b.querySelector(".nagrody-licznik")){
      b.innerHTML=ikonaFilc("puchar","ikona-filc nagrody-ikona");
      b.append(h("span","nagrody-tekst",T.nagrodyOdbierz),h("b","nagrody-licznik",""));
      b.onclick=()=>{if(typeof Nagrody!=="undefined"&&Nagrody.odbierz)Nagrody.odbierz(profilNagrod());};
    }
    b.querySelector(".nagrody-licznik").textContent=String(n);
    b.setAttribute("aria-label",tt("nagrodyOdbierzAria",{n,l:RBJezykEn()?(n===1?"draw":"draws"):odmiana(n,T.nagrodyLos[0],T.nagrodyLos[1],T.nagrodyLos[2])}));
  }
}
function RBJezykEn(){return typeof RBJezyk!=="undefined"&&!!RBJezyk.en;}
function pokazLobby(nazwa){
  if(!ZC_LOBBY_EKRANY.includes(nazwa))nazwa="menu";
  if(kolKandydatId)zatwierdzKolo();   // koło utworów: wskazany utwór staje się piosenką, zanim ekran się zmieni
  const przed=S.lobbyEkran;S.lobbyEkran=nazwa;
  el("lobby").dataset.ekran=nazwa;
  for(const k of ZC_LOBBY_EKRANY)el(k).hidden=k!==nazwa;
  try{if(typeof Studio!=="undefined"&&Studio.odswiez)Studio.odswiez();}catch(e){}   // przycisk Studia dźwięków: widać po zdobyciu wszystkiego
  try{odswiezNagrodyDoOdbioru();}catch(e){}
  const ekran=el(nazwa),gniazdo=n=>ekran.querySelector('[data-gniazdo="'+n+'"]');
  const stan=gniazdo("stan");if(stan&&el("lobbyStan").parentNode!==stan)stan.append(el("lobbyStan"));
  if(typeof Biblioteka!=="undefined")Biblioteka.osadz(gniazdo("biblioteka"),gniazdo("podglad"));
  if(nazwa!=="konfiguracja"){S.wszyscyGotowi=null;S.czekaNaDzwiek=false;}
  if(nazwa==="wybor")rysujWybrana();
  if(nazwa==="konfiguracja"){
    rysujKonfPiosenke();
    if(!S.skladOdtworzony){S.skladOdtworzony=true;if(!S.skladZAdresu)odtworzSkladTeraz();}
    dopasujSiatkeGraczy();
  }
  if(nazwa==="menu")naklejMaskotke();
  if(nazwa==="studioEkran"&&typeof Studio!=="undefined"&&!Studio.otworz()){pokazLobby("menu");return;}   // bez wylosowanych instrumentów studio się nie otwiera
  if(przed!==nazwa)Glos.tik();
  odswiezStart();
  pokazPolaKapsli();   // karty rysują się przed zmianą ekranu, więc ramka pola kapsla staje dopiero tutaj (i znika poza Rozgrywką)
  if(nazwa==="wybor")zaplanujIndeksListy();
  // fokus: w Rozgrywce nigdzie (klawisze należą do graczy), gdzie indziej na tym, od czego się zaczyna
  const a=document.activeElement;
  if(nazwa==="konfiguracja"){if(a&&a.blur&&a!==document.body)a.blur();return;}
  let cel=null;
  if(nazwa==="menu")cel=el(ZC_LOBBY_Z_MENU[przed]||"btnZagraj");
  else{
    const karta=piosenka()&&ekran.querySelector('.bkarta[data-id="'+CSS.escape(piosenka().id)+'"] .bkarta-wybor');
    cel=karta&&karta.getClientRects().length?karta:ekran.querySelector('.biblio-filtr[aria-selected="true"]');
  }
  if(cel){cel.focus({preventScroll:true});
    // 10-15: lista układa się dopiero w następnych klatkach (i za zasłoną przejścia), więc przewinięcie od razu
    // trafiało w stary układ i karta z fokusem zostawała poza widokiem; przewijamy jeszcze raz po ułożeniu
    const przewin=()=>{if(document.activeElement===cel&&cel.scrollIntoView)przewinDoFokusu(cel,false);};
    przewin();requestAnimationFrame(()=>requestAnimationFrame(przewin));setTimeout(przewin,450);}
  const pil=S.pilot&&document.body.classList.contains("pilot")&&Wejscie.gracz(S.pilot);if(pil)pokazPilota(pil);
}
// „Wstecz” (przycisk, Esc, Back pada) zamyka najpierw to, co otwarte NA ekranie: rozwinięty pasek „Dodaj utwory”,
// potem wysuniętą szufladę „Ustawienia piosenki”. Dopiero gdy nic nie jest otwarte, cofa o ekran. Kolejność jest
// tutaj, a nie w nasłuchach klawisza, bo Esc łapią trzy pliki (ten, biblioteka.js i pakiety.js) i o kolejności
// decydowałoby to, który skrypt wcześniej się wczytał.
function wsteczLobby(){
  if(typeof LobbyScena!=="undefined"&&LobbyScena.zamknijDodaj&&LobbyScena.zamknijDodaj())return true;
  if(typeof Biblioteka!=="undefined"&&Biblioteka.stan().szuflada){Biblioteka.zamknijSzuflade();return true;}
  const k=ZC_LOBBY_WSTECZ[S.lobbyEkran];if(k)pokazLobby(k);return !!k;
}
// „Wybierz” na karcie utworu: ta piosenka i od razu krok Rozgrywka
function wybierzIGraj(id){wybierzPiosenkeId(id);pokazLobby("konfiguracja");}
// Karta wybranej piosenki w kroku 1: tytuł, skąd jest, trudność melodii (z opisem), czas, partie, licencja.
function rysujWybrana(){
  const box=el("wybrana"),p=piosenka();if(!box)return;
  box.replaceChildren();if(!p)return;
  const w=typeof Biblioteka!=="undefined"?Biblioteka.wpis(p.id):null,opis=w&&w.zr&&w.zr.opis;
  const tr=trudnoscPartiiW(p,0);
  const meta=h("p","wybrana-meta");
  meta.append(znaczekTrudnosci(tr));
  if(p.licencja&&typeof znaczekLicencji==="function")meta.append(znaczekLicencji(p.licencja,()=>Pakiety.szczegoly(p.licencja,p.tytul)));
  meta.append(h("span","",tt("wybranaMeta",{czas:fmtCzas(p.koniec*60/p.tempo),partie:liczbaPartii(p.partie.length),tempo:Math.round(p.tempo)})));
  // kilka partii: obok trudności melodii (pieczątka) widać też, od ilu do ilu sięgają pozostałe
  const zk=zakresTrudnosci(p);
  if(zk){const z=h("span","wybrana-zakres",tt("wybranaZakres",{od:zk.od,do:zk.do}));z.title=tt("trudnoscZakres",{od:zk.od,do:zk.do}).trim();meta.append(z);}
  box.append(h("p","wybrana-tytul",p.tytul));
  if(opis)box.append(h("p","wybrana-opis",opis));
  // licencja przy utworze (runda 4): linia atrybucji i przycisk „Licencja” jak na ekranie wyników
  if(p.licencja&&typeof liniaAtrybucji==="function"){
    const at=h("p","wybrana-atrybucja",liniaAtrybucji(p.tytul,p.licencja)+" ");
    const lb=h("button","link-przycisk",T.licLicencja);lb.type="button";lb.onclick=()=>Pakiety.szczegoly(p.licencja,p.tytul);
    at.append(lb);box.append(at);
  }
  box.append(meta);
  if(tr)box.append(h("p","wybrana-trudnosc",opisTrudnosci(tr)));
  box.append(h("p","wybrana-podpowiedz",T.wybranaPodpowiedz));odswiezPodpowiedzListy();   // kapsel czyta swoją wersję ściągi
  // trzy najlepsze wyniki tej piosenki (Tablica.top: wszystkie partie i konfiguracje)
  const ol=el("wybranaTop");if(!ol)return;ol.replaceChildren();
  const top=typeof Tablica!=="undefined"?Tablica.top(p,3):[];
  if(!top.length){ol.append(h("li","wybrana-top-pusto",T.topPusto));return;}
  for(const w of top){
    const li=h("li","wybrana-top-wiersz");li.style.setProperty("--kolor",w.kolor||"#6cb33f");
    li.append(h("b","wybrana-top-miejsce",String(w.miejsce)),h("span","wybrana-top-kto",w.kto),
      h("span","wybrana-top-wynik",tt("topWiersz",{punkty:fmtLiczba(w.punkty),precyzja:Math.round(w.precyzja)})));
    ol.append(li);
  }
}
// Piosenka w nagłówku kroku 2: klik („zmień”) wraca do kroku 1.
function rysujKonfPiosenke(){
  const b=el("konfPiosenka"),p=piosenka();if(!b)return;
  if(typeof PakietPiosenki!=="undefined")PakietPiosenki.osadzMiks(p);   // układ miksu pakietu z audio (krok Rozgrywka)
  b.replaceChildren();if(!p)return;
  b.append(h("span","konf-nuta","♪"),h("b","konf-tytul",p.tytul),znaczekTrudnosci(trudnoscPartiiW(p,0),"maly"),h("span","konf-zmien",T.zmienPiosenke));
  b.title=p.tytul;
}
// Maskotka w menu nalepia się raz na wczytanie strony (powroty do menu jej nie powtarzają);
// prefers-reduced-motion: naklejka po prostu jest (gry.css).
function naklejMaskotke(){
  const n=el("naklejka");if(!n||S.naklejona)return;
  S.naklejona=true;n.classList.add("naklej");
}
// Nawigacja strzałkami i padem po widocznym ekranie (albo otwartym oknie nad nim): najbliższy element w danym
// kierunku, liczony ze środków prostokątów, z karą za zboczenie z osi. Bez fokusu pierwszy ruch wybiera start ekranu.
// Lista okien nad ekranem: KAŻDE okno gry musi tu być, bo to ona mówi padowi i kapslowi, po czym chodzić (fokusowalneLobby)
// i co zamyka „wstecz”. Okno spoza listy zostawiało sterowanie na ekranie POD sobą: krzyżak jeździł po menu, a A klikało
// „Zagraj” za oknem (10-20: tak było ze „Zgłoś błąd” i kartą trybu oszusta).
function nakladkaLobby(){return [el("nagrody"),el("wyborGracza"),el("tablica"),el("okno"),el("profileOkno"),el("kontoOkno"),el("smPytanie"),
  el("zglosBlad"),el("oGrze"),el("menuDodatek"),el("ppWyborLista")].find(x=>x&&!x.hidden)||null;}   // nagrody: js/nagrody.js (koło z menu i nakładka po wynikach, Z-08)   // profileOkno: js/profile.js, kontoOkno: js/konta.js, smPytanie: js/jak-grac.js (pytanie o samouczek), zglosBlad: js/zglos-blad.js, menuDodatek: js/menu-dodatki.js
function fokusowalneLobby(){
  const root=nakladkaLobby()||el(S.lobbyEkran);if(!root)return [];
  return [...root.querySelectorAll("button,select,input:not([type=hidden]),a[href],canvas[tabindex]")]
    .filter(e=>!e.disabled&&e.getClientRects().length&&!e.closest("[hidden]")&&
      // 11-19: przyciski utworu w niewybranych wierszach biblioteki są ukryte przez visibility (gry.css), a takie
      // nie przyjmują fokusu: bez tego fokus z „Dalej” potrafił „wejść” w niewidoczny przycisk i stanąć
      (!e.checkVisibility||e.checkVisibility({visibilityProperty:true})));
}
// Szybkie przewijanie listy utworów kapslem (11-19): przechył trzymany dłużej przestaje iść po jednym wierszu
// (ok. 7 na sekundę: 48 utworów to 7 s, a biblioteka z paczkami ma ich ponad 500) i skacze po kilka, a na środku listy
// widać pierwszą literę tytułu i miejsce na liście. PO = po ilu powtórzeniach przechyłu, potem WIERSZY na powtórzenie.
const ZC_SKOK=[{PO:8,WIERSZY:5},{PO:22,WIERSZY:12}];
// Koło liter z lewej strony listy utworów (11-19): duża litera stoi na wysokości środka listy, czyli obok wybranego
// utworu, a litery nad nią i pod nią maleją z odległością (pozycjaLitery, [data-d] w gry-piosenka.css). Kliknięcie
// litery przewija do jej pierwszego utworu. Tylko przy sortowaniu alfabetycznym i tylko w kroku „1 Piosenka”.
// Litery to span, nie button: kapsel i pad mają własne szybkie przewijanie (ZC_SKOK), więc koło nie dokłada im
// dwudziestu celów fokusu.
// KOŁO UTWORÓW (11-19): wybrany utwór stoi zawsze na środku listy kroku „1 Piosenka”. Cel przewinięcia liczony
// z układu (offsetTop), nie z getBoundingClientRect, bo wiersze są skalowane i przesuwane animacją spiętą
// z przewijaniem (gry-piosenka.css, piosKolo), więc ich prostokąt na ekranie nie jest miejscem w układzie.
// Zwraca false poza kołem (inny ekran, panel „Wgraj własny”), wtedy wołający przewija po staremu.
//
// ZAPADKI: koło wskakuje wiersz po wierszu. Wskazany wiersz od razu staje się dużą etykietą (klasa .wybrana)
// i dojeżdża na środek, ale piosenką dla reszty gry (plakat po prawej, podgląd, Rozgrywka) zostaje dopiero wtedy,
// gdy koło stanie: wskazNaKole zapamiętuje kandydata, zatwierdzKolo wybiera go po ZATWIERDZ_MS bez kolejnego ruchu.
// Dzięki temu szybkie przewijanie nie przebudowuje plakatu przy każdym wierszu. Kto potrzebuje piosenki od razu
// (zmiana ekranu, kliknięcie wiersza), ten zatwierdza sam: pokazLobby woła zatwierdzKolo, a wybierzPiosenke kasuje
// kandydata. Kółko myszy też idzie po zapadkach (kolkoNaKole), a po przeciągnięciu palcem koło dociąga do
// najbliższego wiersza (poPrzewinieciuKola).
const ZC_KOLO={ZATWIERDZ_MS:220,DOJAZD_MS:150,KOLKO_PX:120,GLADZIK_PX:50};
let kolKandydatId=null,kolZatwierdzCzas=0,kolDojazd=null,kolPoZmianie=false,kolKolko=0,kolKolkoCzas=0,kolDotyk=-1e9,kolKlik=null,kolPolknij=-1e9;
let kolListyWcisniecie=-1e9;
function idNaKole(){const p=piosenka();return kolKandydatId||(p?p.id:null);}
// przewinięcie koła: krótki własny dojazd (czas nie zależy od przeglądarki), bez dojazdu przy dalekim skoku
// i ograniczonym ruchu
function kolPrzewin(lista,cel,plynnie){
  if(kolDojazd){cancelAnimationFrame(kolDojazd.raf);kolDojazd=null;}
  const od=lista.scrollTop,droga=cel-od;
  if(Math.abs(droga)<1)return;
  if(!plynnie||Math.abs(droga)>lista.clientHeight*2.5||(ZC_MQ_RUCH&&ZC_MQ_RUCH.matches)){lista.scrollTop=cel;return;}
  const t0=performance.now(),d={raf:0};kolDojazd=d;
  const krok=t=>{
    if(kolDojazd!==d)return;
    const u=Math.max(0,Math.min(1,(t-t0)/ZC_KOLO.DOJAZD_MS));
    lista.scrollTop=od+droga*(1-Math.pow(1-u,3));
    if(u<1)d.raf=requestAnimationFrame(krok);else kolDojazd=null;
  };
  d.raf=requestAnimationFrame(krok);
}
function wysrodkujNaLiscie(karta,plynnie){
  const lista=karta&&karta.closest?karta.closest(".biblio-lista"):null;
  if(!lista||S.lobbyEkran!=="wybor"||!lista.closest("#wybor:not(.wgraj)")||!karta.offsetParent)return false;
  // --kh: wysokość listy dla arkusza (puste pół listy nad pierwszym i pod ostatnim wierszem, przesunięcia koła)
  const kh=lista.clientHeight;if(lista._kh!==kh){lista._kh=kh;lista.style.setProperty("--kh",kh+"px");}
  const y=karta.offsetTop-(karta.offsetParent===lista?0:lista.offsetTop);
  kolPrzewin(lista,Math.max(0,Math.round(y+karta.offsetHeight/2-lista.clientHeight/2)),plynnie);
  return true;
}
function listaKola(){return [...document.querySelectorAll("#wybor:not(.wgraj) .biblio-lista")].find(l=>l.getClientRects().length)||null;}
function wierszeKola(lista){return [...lista.children].filter(k=>k.classList.contains("bkarta")&&!k.hidden&&!k.classList.contains("szkielet"));}
function wysrodkujWybrana(plynnie){
  const lista=listaKola(),karta=lista&&lista.querySelector(".bkarta.wybrana:not([hidden])");
  return !!karta&&wysrodkujNaLiscie(karta,plynnie);
}
function wskazNaKole(karta,plynnie){
  const id=karta&&karta.dataset?karta.dataset.id:null,lista=id?karta.closest(".biblio-lista"):null;
  if(!lista||karta.classList.contains("szkielet")||S.lobbyEkran!=="wybor"||!lista.closest("#wybor:not(.wgraj)")||!karta.offsetParent)return false;
  if(id!==idNaKole()){
    kolKandydatId=id;
    for(const k of document.querySelectorAll("#wybor .bkarta.wybrana"))if(k!==karta){
      k.classList.remove("wybrana");const b=k.querySelector(".bkarta-wybor");if(b)b.setAttribute("aria-pressed","false");}
    karta.classList.add("wybrana");const b=karta.querySelector(".bkarta-wybor");if(b)b.setAttribute("aria-pressed","true");
    if(performance.now()-kolListyWcisniecie<400)Glos.tik();   // klik myszą w wiersz: tyknięcie zapadki (strzałki i kółko tykają u siebie)
  }
  wysrodkujNaLiscie(karta,plynnie);
  clearTimeout(kolZatwierdzCzas);
  if(kolKandydatId)kolZatwierdzCzas=setTimeout(zatwierdzKolo,ZC_KOLO.ZATWIERDZ_MS);
  return true;
}
function zatwierdzKolo(){
  clearTimeout(kolZatwierdzCzas);
  const id=kolKandydatId,p=piosenka();kolKandydatId=null;
  if(id&&(!p||p.id!==id))wybierzPiosenkeId(id);
}
// wiersz stojący najbliżej środka listy (w układzie, bez przesunięć animacji)
function wierszNaSrodku(lista,wiersze){
  const srodek=lista.scrollTop+lista.clientHeight/2,baza=w=>w.offsetTop-(w.offsetParent===lista?0:lista.offsetTop);
  let a=0,b=wiersze.length-1;
  while(a<b){const m=(a+b)>>1;if(baza(wiersze[m])+wiersze[m].offsetHeight<srodek)a=m+1;else b=m;}
  return a;
}
// kółko myszy na kole: jeden ząbek kółka = jeden wiersz; gładzik zbiera drobne ruchy do progu
function kolkoNaKole(e){
  if(S.ekran!=="lobby"||S.lobbyEkran!=="wybor"||e.ctrlKey||!e.deltaY)return;
  const lista=e.target&&e.target.closest?e.target.closest("#wybor:not(.wgraj) .biblio-lista"):null;if(!lista)return;
  const wiersze=wierszeKola(lista);if(!wiersze.length)return;
  e.preventDefault();
  const dy=e.deltaMode===1?e.deltaY*40:e.deltaMode===2?e.deltaY*lista.clientHeight:e.deltaY,teraz=performance.now();
  let n;
  if(Math.abs(dy)>=ZC_KOLO.GLADZIK_PX){n=Math.sign(dy)*Math.max(1,Math.round(Math.abs(dy)/ZC_KOLO.KOLKO_PX));kolKolko=0;}
  else{
    if(teraz-kolKolkoCzas>250||Math.sign(dy)!==Math.sign(kolKolko))kolKolko=0;
    kolKolko+=dy;n=Math.trunc(kolKolko/ZC_KOLO.GLADZIK_PX);kolKolko-=n*ZC_KOLO.GLADZIK_PX;
  }
  kolKolkoCzas=teraz;if(!n)return;
  let i=wiersze.indexOf(lista.querySelector(".bkarta.wybrana"));
  const j=i<0?wierszNaSrodku(lista,wiersze):Math.max(0,Math.min(wiersze.length-1,i+n));
  if(j===i)return;
  // fokus idzie za kołem (strzałki ruszą potem z tego samego wiersza), chyba że ktoś właśnie pisze w szukajce
  const a=document.activeElement,b=wiersze[j].querySelector(".bkarta-wybor");
  if(b&&!(a&&(a.tagName==="INPUT"||a.tagName==="TEXTAREA"||a.isContentEditable)))b.focus({preventScroll:true});
  wskazNaKole(wiersze[j],true);Glos.tik();
}
// po przeciągnięciu listy palcem koło dociąga do najbliższego wiersza i on staje się wskazany
function poPrzewinieciuKola(){
  if(kolDojazd||performance.now()-kolDotyk>4000||S.ekran!=="lobby"||S.lobbyEkran!=="wybor")return;
  const lista=listaKola(),wiersze=lista?wierszeKola(lista):[];if(!wiersze.length)return;
  const w=wiersze[wierszNaSrodku(lista,wiersze)],nowy=!w.classList.contains("wybrana");
  if(wskazNaKole(w,true)&&nowy)Glos.tik();
}
// fokus z nawigacji (strzałki, pad, kapsel): wiersz listy utworów wskakuje na środek koła, reszta jak dotąd
function przewinDoFokusu(e,plynnie){
  const karta=e.classList.contains("bkarta-wybor")?e.closest(".bkarta"):null;
  if(karta&&wskazNaKole(karta,plynnie))return;
  e.scrollIntoView({block:"nearest",inline:"nearest"});
}
// Koło liter: pozycja (w krokach) litery odległej o k od bieżącej. Duża litera potrzebuje więcej miejsca,
// dwie następne trochę więcej niż reszta.
function pozycjaLitery(k){const d=Math.abs(k),p=d<1?0:d<2?1.5:d<3?2.4:3.2+(d-3)*.8;return k<0?-p:p;}
let indeksListyKlatka=0;
function zaplanujIndeksListy(){
  const bib=el("biblioteka");
  if(bib&&!bib._indeks){bib._indeks=true;
    bib.addEventListener("scroll",zaplanujIndeksListy,{capture:true,passive:true});
    // lista zmieniła skład (import paczek, szukanie, sortowanie): wskazany utwór wraca na środek koła
    if(typeof MutationObserver!=="undefined")new MutationObserver(()=>{kolPoZmianie=true;zaplanujIndeksListy();})
      .observe(bib,{childList:true,subtree:true,attributes:true,attributeFilter:["hidden","aria-checked","aria-selected"]});
    addEventListener("resize",()=>{kolPoZmianie=true;zaplanujIndeksListy();},{passive:true});
    bib.addEventListener("wheel",kolkoNaKole,{passive:false});
    bib.addEventListener("touchstart",()=>{kolDotyk=performance.now();},{capture:true,passive:true});
    bib.addEventListener("scrollend",poPrzewinieciuKola,{capture:true,passive:true});
  }
  if(!indeksListyKlatka)indeksListyKlatka=requestAnimationFrame(()=>{indeksListyKlatka=0;
    if(kolPoZmianie){kolPoZmianie=false;if(!kolDojazd)wysrodkujWybrana(false);}
    odswiezIndeksListy();});
}
function odswiezIndeksListy(){
  const kol=document.querySelector("#wybor .kol-piosenki");if(!kol)return;
  let box=el("listaIndeks");
  if(!box){
    box=h("div","lista-indeks");box.id="listaIndeks";box.setAttribute("aria-hidden","true");box.hidden=true;kol.append(box);
    box.addEventListener("click",e=>{
      const s=e.target.closest("span[data-nr]"),w=s&&box._wiersze&&box._wiersze[+s.dataset.nr];
      if(!w)return;
      if(wskazNaKole(w,true))Glos.tik();else w.scrollIntoView({block:"center"});   // litera = skok koła do jej pierwszego utworu
    });
  }
  const lista=[...kol.querySelectorAll(".biblio-lista")].find(l=>l.getClientRects().length);
  // przy sortowaniu alfabetycznym koło pokazuje litery, przy sortowaniu po trudności stopnie (1, 2, 3 …)
  const sort=kol.querySelector('.biblio-sort [aria-checked="true"]'),tryb=sort?sort.dataset.v:"alfabet",stopnie=tryb==="trudnosc";
  const wiersze=lista&&(tryb==="alfabet"||stopnie)?[...lista.children].filter(k=>k.classList.contains("bkarta")&&!k.hidden):[];
  if(wiersze.length<12){box.hidden=true;box._wiersze=null;return;}   // krótka lista mieści się na ekranie, pasek nic nie daje
  const litery=[],litera=stopnie?k=>{const t=k.querySelector(".bkarta-meta>.trudnosc"),n=t?parseInt(t.textContent,10):NaN;return Number.isFinite(n)?String(n):"#";}
    :k=>{const t=k.querySelector(".bkarta-tytul"),c=(t?t.textContent.trim().charAt(0):"").toLocaleUpperCase(ZC_LOC);return /\p{L}/u.test(c)?c:"#";};
  wiersze.forEach((k,i)=>{const c=litera(k);if(!litery.length||litery[litery.length-1][0]!==c)litery.push([c,i]);});
  const klucz=litery.map(x=>x[0]+x[1]).join(" ");
  if(box.dataset.klucz!==klucz){
    box.dataset.klucz=klucz;box._tu=-1;
    box.replaceChildren(...litery.map(([c,i])=>{const s=h("span","",c);s.dataset.nr=String(i);return s;}));
  }
  box._wiersze=wiersze;box.hidden=false;
  // koło liter zajmuje wysokość listy, więc jego środek (duża litera) wypada na wysokości wybranego utworu
  const r=lista.getBoundingClientRect(),kr=kol.getBoundingClientRect(),miejsce=Math.round(r.top-kr.top)+"/"+Math.round(r.height);
  if(box._miejsce!==miejsce){box._miejsce=miejsce;box.style.top=Math.round(r.top-kr.top)+"px";box.style.height=Math.round(r.height)+"px";}
  // bieżąca litera = wiersz na środku listy (szukanie połówkowe po położeniu, kilka odczytów na klatkę)
  const srodek=r.top+r.height/2;let a=0,b=wiersze.length-1;
  while(a<b){const m=(a+b)>>1;if(wiersze[m].getBoundingClientRect().bottom<srodek)a=m+1;else b=m;}
  const c=litera(wiersze[a]),tu=litery.findIndex(x=>x[0]===c);
  if(box._tu===tu)return;
  box._tu=tu;
  [...box.children].forEach((s,i)=>{const k=i-tu;
    s.classList.toggle("tu",k===0);s.dataset.d=String(Math.min(4,Math.abs(k)));s.style.setProperty("--p",String(pozycjaLitery(k)));});
}
let skokListyCzas=0;
function pokazSkokListy(wiersz,nr,ile){
  let box=el("listaSkok");
  if(!box){box=h("div","lista-skok");box.id="listaSkok";box.setAttribute("aria-hidden","true");box.append(h("b",""),h("span",""));document.body.append(box);}
  const karta=wiersz.closest(".bkarta"),tytul=karta&&karta.querySelector(".bkarta-tytul"),lista=wiersz.closest(".biblio-lista");
  const litera=(tytul&&tytul.textContent.trim().charAt(0)||"").toLocaleUpperCase(ZC_LOC);
  box.firstChild.textContent=litera;box.lastChild.textContent=(nr+1)+" / "+ile;
  if(lista){const r=lista.getBoundingClientRect();box.style.left=Math.round(r.left+r.width/2)+"px";box.style.top=Math.round(r.top+r.height/2)+"px";}
  box.hidden=false;clearTimeout(skokListyCzas);skokListyCzas=setTimeout(()=>{box.hidden=true;},900);
}
function nawigujLobby(akcja,o){
  // 10-18 (Z-08): nakładka nagród (koło z menu i po wynikach): A/Start = przytrzymanie jak Spacja (wciśnięcie
  // i puszczenie), Back zamyka (w lobby też B); krzyżak nic nie robi
  if(typeof Nagrody!=="undefined"&&Nagrody.otwarte){
    const ng=el("nagrody"),a=document.activeElement;   // fokus nie zostaje pod nakładką (A nie kliknie „Zagraj” w menu)
    if(ng&&!(a&&ng.contains(a))){const p=ng.querySelector("button:not([disabled])");if(p)p.focus({preventScroll:true});}
    if(akcja==="ok"||akcja==="start")Nagrody.przytrzymaj(true,"pad");
    else if(akcja==="ok-pusc")Nagrody.przytrzymaj(false,"pad");
    else if(akcja==="wstecz"||(akcja==="b"&&S.ekran==="lobby"))Nagrody.zamknij();
    return;
  }
  if(akcja==="ok-pusc")return;
  if(akcja==="b"){if(S.ekran!=="lobby")return;akcja="wstecz";}   // D-5: B poza menu to śpiew, cofa tylko Back
  if(akcja==="start"&&S.ekran==="lobby")akcja="ok";
  // 10-18 (Z-20): Back najpierw zamyka okno nad ekranem (tablica na wynikach, okno w pauzie), dopiero potem cofa ekran
  if(akcja==="wstecz"&&S.ekran!=="lobby"){
    const o=nakladkaLobby();
    if(o){const z=o.querySelector(".tablica-zamknij");if(z)z.click();else if(o.id==="tablica"&&typeof Tablica!=="undefined"&&Tablica.zamknij)Tablica.zamknij();return;}
  }
  // 10-15 (przejście „gospodarz na kanapie”): Back pada w pauzie i na wynikach wraca do wyboru piosenki (jak Q i Esc)
  if(akcja==="wstecz"&&(S.pauza||(S.ekran==="wyniki"&&S.wyniki&&performance.now()-S.wyniki.od>800))){innaPiosenka();return;}
  if(S.ekran!=="lobby"){nawigujPauzeIWyniki(akcja);return;}
  const nakladka=nakladkaLobby();
  if(akcja==="wstecz"){
    // lista partii w podglądzie nie ma krzyżyka (to rozwijane okienko przycisku): „wstecz” ją zamyka, fokus wraca na przycisk
    if(nakladka&&nakladka.id==="ppWyborLista"){if(typeof Biblioteka!=="undefined")Biblioteka.zamknijWybor();return;}
    if(nakladka){const z=nakladka.querySelector(".tablica-zamknij");if(z)z.click();return;}
    if(typeof Biblioteka!=="undefined"&&Biblioteka.stan().szuflada){Biblioteka.zamknijSzuflade();return;}
    wsteczLobby();return;
  }
  if(S.lobbyEkran==="konfiguracja"&&!nakladka)return;   // w Rozgrywce pad należy do graczy
  document.body.classList.add("nawigacja");   // fokus widoczny także po ruchu padem (nie tylko z klawiatury)
  const lista=fokusowalneLobby(),a=document.activeElement;
  if(!lista.length)return;
  if(!lista.includes(a)){
    const start=S.lobbyEkran==="menu"&&!nakladka?el("btnZagraj"):lista[0];
    start.focus({preventScroll:true});przewinDoFokusu(start,false);return;
  }
  if(akcja==="ok"){a.click();return;}
  const r=a.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
  // z karty utworu góra/dół skacze kartami (główny przycisk karty), a nie po jej ♥, ▶, ⚙ i pucharze;
  // w bok idzie przez przyciski karty do sąsiedniej karty
  const karta=a.closest(".bkarta"),pion=akcja==="gora"||akcja==="dol";
  // 10-15 (przejście „gospodarz na kanapie”): w bok z karty — prawo z wiersza skacze do jego „Wybierz”, a w bok chodzi
  // się tylko po przyciskach tego wiersza (wcześniej szerszy wiersz obok wygrywał z przyciskami i „prawo” wspinało
  // się po liście).
  // 11-19: długo trzymany przechył kapsla skacze po kilka wierszy naraz (o.skok z krokPilotow)
  if(karta&&pion&&!nakladka&&o&&o.skok>1){
    const rz=lista.filter(e=>e.classList.contains("bkarta-wybor")),i=rz.indexOf(karta.querySelector(".bkarta-wybor"));
    if(i>=0){
      const j=Math.max(0,Math.min(rz.length-1,i+(akcja==="dol"?o.skok:-o.skok)));
      if(j!==i){rz[j].focus({preventScroll:true});przewinDoFokusu(rz[j],false);Glos.tik();pokazSkokListy(rz[j],j,rz.length);}
      return;
    }
  }
  if(karta&&!pion&&!nakladka){
    const w=akcja==="prawo"&&a.classList.contains("bkarta-wybor")?karta.querySelector(".bkarta-wybierz"):null;
    if(w&&lista.includes(w)){w.focus({preventScroll:true});w.scrollIntoView({block:"nearest",inline:"nearest"});Glos.tik();return;}
  }
  let naj=null,min=Infinity;
  for(const e of lista){
    if(e===a)continue;
    if(karta&&!pion){const k=e.closest(".bkarta");if(k&&k!==karta)continue;}
    if(karta&&pion){const k=e.closest(".bkarta");if(k===karta||(k&&!e.classList.contains("bkarta-wybor")))continue;
      if(!k&&o&&o.powt)continue;}   // trzymany przechył przewija listę i staje na jej końcu; wyjść z listy (np. do „Dalej”) można dopiero nowym ruchem
    const q=e.getBoundingClientRect(),dx=q.left+q.width/2-cx,dy=q.top+q.height/2-cy;
    const [glowna,boczna]=akcja==="dol"?[dy,Math.abs(dx)]:akcja==="gora"?[-dy,Math.abs(dx)]:
      akcja==="prawo"?[dx,Math.abs(dy)]:[-dx,Math.abs(dy)];
    if(glowna<=4)continue;
    const wynik=glowna+boczna*2.5;
    if(wynik<min){min=wynik;naj=e;}
  }
  // pojedynczy ruch strzałką albo krzyżakiem dojeżdża płynnie; trzymany klawisz i kapsel (jego znaczek staje przy
  // wierszu od razu po ruchu) przeskakują bez dojazdu
  if(naj){naj.focus({preventScroll:true});przewinDoFokusu(naj,!(o&&(o.powt||o.pilot)));Glos.tik();}
}
// Czy sterowanie jest teraz „w menu”, czyli nie śpiewa, tylko nawiguje: ekrany lobby bez graczy (menu, Utwory, wybór
// piosenki), każde okno nad nimi (także nad krokiem Rozgrywka), pauza, wyniki i koło nagród. JEDNO miejsce dla pada
// (Wejscie.ustawMenu) i dla kapsla (krokPilotow), żeby oba sterowania nie rozjechały się po ekranach.
function menuWlaczone(){
  return (S.ekran==="lobby"&&(S.lobbyEkran!=="konfiguracja"||!!nakladkaLobby()))||(S.pauza&&!S.wznowienie)||S.ekran==="wyniki"||
    (typeof Nagrody!=="undefined"&&!!Nagrody.otwarte);
}
// 10-18 (Z-52): pad w pauzie i na wynikach (Wejscie.ustawMenu przełącza go tam z gracza na nawigację): krzyżak
// przesuwa fokus po przyciskach (pauza w kółko jak strzałki klawiatury, wyniki geometrycznie), A klika przycisk z fokusem,
// Start w pauzie wznawia, a na wynikach „jeszcze raz”. „Jeszcze raz” i „Inna piosenka” z ochroną 2 s jak Spacja.
function nawigujPauzeIWyniki(akcja){
  const pauza=S.pauza&&!S.wznowienie,wyn=S.ekran==="wyniki"&&!!S.wyniki;
  if(!pauza&&!wyn)return;
  const chroni=()=>wyn&&performance.now()-S.wyniki.od<=2000;
  const okno=nakladkaLobby();   // np. tablica otwarta na wynikach: fokus chodzi po oknie, nie pod nim
  if(akcja==="start"){if(okno)return;if(pauza)ustawPauze(false);else if(!chroni())jeszczeRaz();return;}
  const root=okno||el(pauza?"pauza":"wyniki");if(!root)return;
  const lista=[...root.querySelectorAll("button,a[href]")].filter(e=>!e.disabled&&e.getClientRects().length&&!e.closest("[hidden]"));
  if(!lista.length)return;
  const a=document.activeElement,i=lista.indexOf(a);
  document.body.classList.add("nawigacja");   // fokus widoczny po ruchu padem
  if(akcja==="ok"){
    if(i<0){if(okno)lista[0].focus({preventScroll:true});else if(!chroni())lista[0].click();return;}
    if(chroni()&&(a.id==="btnJeszczeRaz"||a.id==="btnInnaPiosenka"))return;
    a.click();return;
  }
  if(!["gora","dol","lewo","prawo"].includes(akcja))return;
  let cel=null;
  if(i<0)cel=lista[0];
  else if(pauza)cel=lista[(i+(akcja==="lewo"||akcja==="gora"?-1:1)+lista.length)%lista.length];
  else{
    const r=a.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let min=Infinity;
    for(const e of lista){if(e===a)continue;
      const q=e.getBoundingClientRect(),dx=q.left+q.width/2-cx,dy=q.top+q.height/2-cy;
      const [glowna,boczna]=akcja==="dol"?[dy,Math.abs(dx)]:akcja==="gora"?[-dy,Math.abs(dx)]:akcja==="prawo"?[dx,Math.abs(dy)]:[-dx,Math.abs(dy)];
      if(glowna<=4)continue;const w=glowna+boczna*2.5;if(w<min){min=w;cel=e;}}
  }
  if(cel&&cel!==a){cel.focus({preventScroll:true});cel.scrollIntoView({block:"nearest",inline:"nearest"});Glos.tik();}
}
function zbudujLobby(){
  document.title=T.tytulGry+" · RibbitFlip";
  for(const e of document.querySelectorAll("[data-t]"))e.textContent=T[e.dataset.t]!=null?T[e.dataset.t]:e.textContent;
  for(const e of document.querySelectorAll("[data-t-aria]"))if(T[e.dataset.tAria]!=null)e.setAttribute("aria-label",T[e.dataset.tAria]);
  // logo: „Ribbit” tuszem, „Beat” różem marki
  for(const e of document.querySelectorAll("[data-tytul]"))e.replaceChildren(T.tytulRibbit,h("span","beat",T.tytulBeat));
  zbudujUstawienia();Biblioteka.start();rysujGraczy();
  // 10-18 (C-01): straż stanu: drugi klik dwukliku trafia już w odliczanie i nie startuje gry drugi raz
  el("btnStart").onclick=()=>{if(S.ekran!=="lobby")return;Glos.odblokuj();startGry();};
  el("btnLicencje").onclick=()=>Pakiety.ekranLicencji();
  // menu i przejścia między ekranami
  // pierwsze „Zagraj” na tym komputerze najpierw puszcza samouczek „Jak grać” w grze (js/jak-grac.js), a jego koniec prowadzi do wyboru
  el("btnZagraj").onclick=()=>{if(!(window.JakGrac&&JakGrac.przyPierwszejGrze()))pokazLobby("wybor");};
  el("btnJakGrac").onclick=()=>{if(window.JakGrac)JakGrac.otworz({powrot:el("btnJakGrac")});};
  el("btnWybranaTablica").onclick=()=>Tablica.otworz(piosenka(),{powrot:el("btnWybranaTablica")});
  // ⚙ w karcie wybranej piosenki: te same ustawienia co ⚙ na wierszu, wysuwane z prawej krawędzi (biblioteka.js)
  el("btnUstawieniaPiosenki").onclick=()=>{const p=piosenka();if(p)Biblioteka.otworzSzuflade(p.id,el("btnUstawieniaPiosenki"));};
  el("btnDalej").onclick=()=>pokazLobby("konfiguracja");
  for(const b of document.querySelectorAll("#lobby [data-wstecz]")){b.onclick=()=>wsteczLobby();b.title=T.wsteczOpis;}
  for(const b of document.querySelectorAll("#lobby [data-krok]"))b.onclick=()=>pokazLobby(b.dataset.krok);
  // 10-18 (Z-52, Z-08): pad nawiguje też w pauzie, na wynikach i w nakładce nagród (tam nie śpiewa, gra stoi)
  Wejscie.ustawMenu(menuWlaczone,nawigujLobby);
  // „Dodaj bota”: poziom ostatnio wybrany na karcie bota (?luz= z adresu harnessu wygrywa, jak dawniej)
  el("btnDodajGracza").onclick=()=>{Glos.odblokuj();otworzWyborGracza({powrot:el("btnDodajGracza")});};
  // okno wyboru gracza: klawisze pod nim nie dochodzą do gry (Spacja i Enter klikają przyciski okna), Esc zamyka
  addEventListener("keydown",e=>{const o=el("wyborGracza");if(!o||o.hidden)return;e.stopImmediatePropagation();
    if(e.key==="Escape"){e.preventDefault();zamknijWyborGracza();return;}
    const akcja={ArrowUp:"gora",ArrowDown:"dol",ArrowLeft:"lewo",ArrowRight:"prawo"}[e.key];   // strzałki po kaflach okna
    if(akcja&&!e.ctrlKey&&!e.altKey&&!e.metaKey){e.preventDefault();nawigujLobby(akcja);}},true);
  el("wyborGracza").addEventListener("pointerdown",e=>{if(e.target===el("wyborGracza"))zamknijWyborGracza();});
}

// =============================================================================================
// 5. GRA
// Okno wyboru planszy (duże wyskakujące okno ze wszystkimi odblokowanymi planszami; każdy wybiera swoją, a gdy wszyscy
// wybiorą, gra losuje wizualnie). Po „Śpiewamy!” duże
// okno z kaflami wszystkich zdobytych plansz; każdy człowiek ma kursor w swoim kolorze i wybiera SWOIM sterowaniem:
// klawiatura i pad w bok (A/D, ←/→, przechył) = kursor, przycisk śpiewu = wybór (drugi raz: zmiana zdania); kapsel:
// przechył w bok i przycisk (przytrzymanie = cofnij); mysz: najazd i klik. Gdy wybiorą wszyscy: ta sama plansza = start,
// różne = losowanie paskiem kart z kolo.js (szansa planszy ~ liczba wyborów). Esc / „Wróć” zamyka okno i wraca do lobby.
// Bot nie wybiera. Bez okna: skład z adresu (?auto, ?boty: smoke, harness), sami boci, jedna zdobyta plansza, a od 10-21
// także tryb „Ta plansza” z paska (planPlanszy); tryb „Wybierz losową” otwiera to samo okno od razu na losowaniu.
function rozstrzygnijPlansze(){
  const ludzie=S.gracze.filter(g=>g.zrodlo!=="bot");
  const plan=planPlanszy(trybPlanszy(),{ludzi:ludzie.length,plansz:Postepy.ekipa().odblokowane.length,
    zAdresu:!!S.skladZAdresu,kolo:typeof Kolo!=="undefined"});
  if(plan==="ta")return false;
  oknoWyboruPlanszy(ludzie,plan==="los");return true;
}
// Co „Śpiewamy!” robi z planszą. Czysta funkcja (harness): tryb z paska plus warunki, w których nie ma czego pokazać —
// nikt z ludzi w składzie (bot nie wybiera), jedna zdobyta plansza, skład z adresu albo brak kolo.js = gramy tym,
// co ekipa ma wybrane („ta”), bez okna.
function planPlanszy(tryb,o){
  const ludzi=(o&&o.ludzi)|0,plansz=(o&&o.plansz)|0;
  if(!ludzi||plansz<2||(o&&o.zAdresu)||!(o&&o.kolo))return "ta";
  return tryb==="los"?"los":tryb==="ta"?"ta":"wszyscy";
}
// Kolejność kafli w oknie (według jakości): najpierw najrzadsze, w każdej rzadkości
// kolejność drabinki. `rz` daje rzadkość planszy (Postepy.rzadkosc("plansza", id)); plansza spoza listy tierów liczy
// się jak zwykła, więc nic nie wypada z siatki. Czysta funkcja (harness).
const ZC_RZADKOSC_KOLEJNOSC=["sekretny","legendarny","epicki","rzadki","zwykly"];
function planszeWgJakosci(lista,rz){
  const ranga=w=>{const i=ZC_RZADKOSC_KOLEJNOSC.indexOf(rz?rz(w.id):null);return i<0?ZC_RZADKOSC_KOLEJNOSC.length:i;};
  return lista.map((w,i)=>({w,i,r:ranga(w)})).sort((a,b)=>a.r-b.r||a.i-b.i).map(x=>x.w);
}
const rzadkoscPlanszy=id=>{try{return Postepy.rzadkosc("plansza",id);}catch(e){return null;}};
const czekajMs=ms=>new Promise(r=>setTimeout(r,ms));
function oknoWyboruPlanszy(ludzie,samoLosowanie){
  const tor=ZC_TOR_PLANSZY,odb=Postepy.ekipa().odblokowane;
  const lista=planszeWgJakosci(Postepy.drabinka(tor).filter(w=>w&&odb.includes(w.id)),rzadkoscPlanszy);
  const W=S.wyborPlanszy={ludzie,lista,kursor:new Map(),wybor:new Map(),faza:samoLosowanie?"los":"wybor",
    kafle:[],pasek:null,losuj:!!samoLosowanie};
  schowajToast();   // Z-87
  for(const g of ludzie){const i=lista.findIndex(w=>w.id===glosPlanszy(g));W.kursor.set(g.id,i<0?0:i);}
  const ov=h("div","los-planszy wybor-planszy"),panel=h("div","los-planszy-panel wp-panel");ov.id="losPlanszy";
  ov.setAttribute("role","dialog");ov.setAttribute("aria-modal","true");ov.setAttribute("aria-labelledby","losPlanszyTytul");
  const tyt=h("h2","los-planszy-tytul",W.losuj?T.wpLosTytul:T.wpTytul);tyt.id="losPlanszyTytul";
  const opis=h("p","wp-opis",W.losuj?T.wpLosOpis:T.wpOpis),kto=h("ul","wp-gracze"),siatka=h("div","wp-siatka");
  // tryb „Wybierz losową”: nikt nie wybiera, więc siatka kafli zostaje pusta — od razu wjeżdża pasek losowania
  if(!W.losuj)lista.forEach((w,i)=>{
    const k=h("div","wp-kafel");k.dataset.i=String(i);k.dataset.v=w.id;
    const rz=rzadkoscPlanszy(w.id);if(rz)k.dataset.rz=rz;   // 10-21: ramka w kolorze rzadkości, bo kafle idą wg jakości
    const im=h("img","wp-obraz");im.alt="";im.draggable=false;im.decoding="async";im.src=Motywy.sciezka(w.id,"tlo.webp");
    im.onerror=()=>{const cv=document.createElement("canvas");cv.className="wp-obraz";miniaturaStopnia(cv,tor,w);im.replaceWith(cv);};
    k.append(im,h("span","wp-nazwa",nazwaPary("plansza",w.nazwa)),h("span","wp-znaczki"));   // 10-18: „Sushi · scena”
    if(rz&&T.rzadkosc&&T.rzadkosc[rz])k.title=nazwaPary("plansza",w.nazwa)+" · "+T.rzadkosc[rz];
    k.addEventListener("pointerenter",()=>{const m=graczMyszy();if(m&&W.faza==="wybor"&&!W.wybor.has(m.id)){W.kursor.set(m.id,i);odswiezWyborPlanszy();}});
    // klik: gracz myszy, a bez niego pierwszy, kto jeszcze nie wybrał (ktoś przy klawiaturze może pomóc myszą)
    k.addEventListener("click",()=>{if(W.faza!=="wybor")return;const m=graczMyszy()||ludzie.find(g=>!W.wybor.has(g.id));
      if(m){if(W.wybor.has(m.id))W.wybor.delete(m.id);W.kursor.set(m.id,i);zatwierdzWyborPlanszy(m);}});
    siatka.append(k);W.kafle.push(k);
  });
  const los=h("div","wp-los");los.hidden=true;   // tu wjeżdża pasek losowania
  const wynik=h("p","los-planszy-wynik");wynik.setAttribute("aria-live","polite");
  const wroc=h("button","wp-wroc",T.wpWroc);wroc.type="button";wroc.onclick=()=>zamknijWyborPlanszy();
  panel.append(tyt,opis,kto,siatka,los,wynik,wroc);ov.append(panel);document.body.append(ov);
  ov.addEventListener("click",()=>{if(W.faza==="los"&&W.pasek)try{W.pasek.zatrzymajOdRazu();}catch(e){}});   // klik w czasie losowania przyspiesza
  Object.assign(W,{ov,kto,siatka,los,wynik,opis,wroc});
  W.esc=e=>{if(e.key==="Escape"&&S.wyborPlanszy===W&&W.faza==="wybor"){e.preventDefault();e.stopPropagation();zamknijWyborPlanszy();}};
  document.addEventListener("keydown",W.esc,true);
  W.rozmiar=()=>{if(S.wyborPlanszy===W&&W.faza==="wybor")odswiezWyborPlanszy();};addEventListener("resize",W.rozmiar);   // 10-18: siatka bez przewijania
  if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();   // Enter/Spacja graczy nie klikają przycisków lobby
  if(W.losuj){kto.hidden=true;losujWybranaPlansze(W);return;}   // „Wybierz losową”: bez listy graczy i bez siatki, od razu pasek
  odswiezWyborPlanszy();
}
function graczMyszy(){const W=S.wyborPlanszy;return W?W.ludzie.find(g=>g.zrodlo==="mysz")||null:null;}
function zamknijWyborPlanszy(){
  const W=S.wyborPlanszy;if(!W)return;
  document.removeEventListener("keydown",W.esc,true);removeEventListener("resize",W.rozmiar);
  try{if(W.pasek)W.pasek.zniszcz();}catch(e){}
  W.ov.remove();S.wyborPlanszy=null;
  const b=el("btnStart");if(b&&S.ekran==="lobby")b.focus({preventScroll:true});
}
// Awatar żaby z konta gracza (js/awatary.js) do okna wyboru planszy, żeby było widać, kto
// wybiera. Gość i kapsel bez konta mają awatar domyślny dla swojego klucza, bot żadnego (i tak nie wybiera).
function awatarGracza(g){
  if(typeof Awatary==="undefined")return null;
  try{const n=Postepy.nazwaProfilu(g);if(!n)return null;
    return Awatary.dla(Postepy.kluczProfilu(n),Postepy.awatar(n));}catch(e){return null;}
}
// Żeton gracza: awatar w obwódce jego koloru, a bez modułu awatarów sama kropka (jak do 10-21).
function znaczekGracza(g,klasa){
  const id=awatarGracza(g);
  if(!id)return h("i","plansza-kropka");
  const e=Awatary.element(id,{klasa:"awatar "+(klasa||"wp-awatar")});
  return e||h("i","plansza-kropka");
}
// Kursory i wybory na kaflach, lista graczy ze stanem („wybiera: A/D, Spacja” / „✓ Disco”).
function odswiezWyborPlanszy(){
  const W=S.wyborPlanszy;if(!W)return;
  W.kto.replaceChildren(...W.ludzie.map(g=>{   // najpierw lista: jej wysokość (zawijanie) zmienia miejsce na siatkę
    const li=h("li",W.wybor.has(g.id)?"wybral":"");li.style.setProperty("--kolor",g.kolor||"#ec1a83");
    li.append(znaczekGracza(g,"wp-awatar"),h("b","",g.nazwa||""));
    const w=W.wybor.get(g.id),wpis=w&&Postepy.wpis(ZC_TOR_PLANSZY,w);
    li.append(h("span","",w?" ✓ "+(wpis?wpis.nazwa:w):" "+T.wpWybiera+" ("+(T["wpSter_"+g.zrodlo]||T.wpSter_pad)+")"));
    return li;}));
  ukladWyboruPlanszy(W);
  W.kafle.forEach((k,i)=>{
    const tu=W.ludzie.filter(g=>W.wybor.has(g.id)?W.wybor.get(g.id)===W.lista[i].id:W.kursor.get(g.id)===i);
    const z=k.querySelector(".wp-znaczki");z.replaceChildren();z.classList.remove("ciasno");
    for(const g of tu){const ok=W.wybor.has(g.id),p=h("span","wp-znaczek"+(ok?" wybrany":""));p.style.setProperty("--kolor",g.kolor||"#ec1a83");
      p.title=g.nazwa||"";p.append(znaczekGracza(g,"wp-awatar"),h("span","wp-znaczek-imie",(ok?"✓ ":"")+(g.nazwa||"")));z.append(p);}
    // 10-18: gdy imiona nie mieszczą się na obrazku kafla, zostają same kropki w kolorach graczy (imiona są w liście nad siatką)
    if(tu.length>1&&z.offsetHeight>k.firstChild.offsetHeight-4)z.classList.add("ciasno");
    const pierwszy=tu[0];k.classList.toggle("kursor",!!pierwszy);k.classList.toggle("wybrany",tu.some(g=>W.wybor.has(g.id)));
    if(pierwszy)k.style.setProperty("--kolor",pierwszy.kolor||"#ec1a83");else k.style.removeProperty("--kolor");
  });
}
// 10-18: siatka bez przewijania. Dla każdej liczby kolumn liczy największy kafel 16:9 (z paskiem nazwy), przy którym
// wszystkie plansze mieszczą się w oknie (wysokość do 92vh), i bierze najlepszy wariant. Wywoływana przy każdym odświeżeniu
// okna i przy zmianie rozmiaru okna przeglądarki; nic nie liczy w czasie piosenki.
function ukladWyboruPlanszy(W){
  const s=W.siatka,n=W.lista.length;if(!s||s.hidden||!n)return;
  const cs=getComputedStyle(s),pl=parseFloat(cs.paddingLeft)+parseFloat(cs.paddingRight),pt=parseFloat(cs.paddingTop)+parseFloat(cs.paddingBottom);
  const panel=s.parentElement,reszta=panel.offsetHeight-s.offsetHeight;
  const szer=s.clientWidth-pl,wys=Math.max(80,innerHeight*.92-reszta-pt),odst=n>12?8:12;
  let naj=null;
  for(let c=1;c<=n;c++){
    const r=Math.ceil(n/c);let w=Math.min(320,(szer-(c-1)*odst)/c);
    const f=Math.max(12,Math.min(15,w/11)),pasek=f*1.15+14;
    w=Math.min(w,((wys-(r-1)*odst)/r-pasek)*16/9);
    if(!naj||w>naj.w+.5)naj={c,w,f:Math.max(12,Math.min(15,w/11))};
  }
  s.style.setProperty("--wp-kol",String(naj.c));s.style.setProperty("--wp-szer",Math.max(60,Math.floor(naj.w))+"px");
  s.style.setProperty("--wp-odst",odst+"px");s.style.setProperty("--wp-nazwa-f",naj.f.toFixed(1)+"px");
}
// Sterowanie gracza w oknie: kier -1/1 = kursor, "ok" = wybór (drugi raz: zmiana zdania), "wstecz" = cofnij wybór.
function sterujWyboremPlanszy(g,ruch){
  const W=S.wyborPlanszy;if(!W||W.faza!=="wybor"||!W.ludzie.includes(g))return;
  if(ruch==="ok"){zatwierdzWyborPlanszy(g);return;}
  if(ruch==="wstecz"){if(W.wybor.delete(g.id))odswiezWyborPlanszy();return;}
  if(W.wybor.has(g.id))return;
  const n=W.lista.length;W.kursor.set(g.id,((W.kursor.get(g.id)||0)+ruch+n)%n);odswiezWyborPlanszy();
  try{if(Glos.cyk)Glos.cyk(.3,.6);}catch(e){}
}
function zatwierdzWyborPlanszy(g){
  const W=S.wyborPlanszy;if(!W||W.faza!=="wybor")return;
  if(W.wybor.has(g.id))W.wybor.delete(g.id);else W.wybor.set(g.id,W.lista[W.kursor.get(g.id)||0].id);
  odswiezWyborPlanszy();
  if(W.wybor.size===W.ludzie.length){W.faza="czeka";setTimeout(()=>{if(S.wyborPlanszy===W)losujWybranaPlansze(W);},500);}
}
// Klatka lobby przy otwartym oknie: przechył w bok (klawiatura A/D, ←/→, pad) z histerezą = jeden krok kursora;
// kapsel przez krokPilota (w bok, ok, przytrzymanie = wstecz). Partie i „gotowe” w tym czasie stoją.
function krokWyboruPlanszy(dt){
  const W=S.wyborPlanszy;
  for(const g of W.ludzie){
    const w=zrodloGracza(g);if(!w||w.zrodlo==="mysz")continue;
    if(w.zrodlo==="kapsel"){
      const st=S.piloty[w.id]||(S.piloty[w.id]={stan:null});
      const r=krokPilota(st.stan,{pitch:w.pitch,roll:w.roll,przycisk:!!w.przycisk},dt);st.stan=r.stan;const z=r.zdarzenia;
      if(z.lewo||z.prawo)sterujWyboremPlanszy(g,z.prawo?1:-1);
      if(z.ok)sterujWyboremPlanszy(g,"ok");
      if(z.wstecz)sterujWyboremPlanszy(g,"wstecz");
      continue;
    }
    if(g.rollWolny&&Math.abs(w.roll)>25){sterujWyboremPlanszy(g,w.roll>0?1:-1);g.rollWolny=false;}
    else if(Math.abs(w.roll)<12)g.rollWolny=true;
  }
}
async function losujWybranaPlansze(W){
  W.faza="los";W.wroc.hidden=true;
  // tryb „Wybierz losową” (10-21): w losowaniu stoją wszystkie zdobyte plansze, każda z tą samą szansą; przy wyborach
  // graczy — tylko to, co wybrali (szansa planszy ~ liczba głosów).
  const wybory=W.losuj?W.lista.map(w=>w.id):[...W.wybor.values()],rozne=[...new Set(wybory)],tor=ZC_TOR_PLANSZY;
  const nazwa=id=>{const w=Postepy.wpis(tor,id);return w?nazwaPary("plansza",w.nazwa):id;};
  const wygrana=wybory[Math.floor(Math.random()*wybory.length)];
  if(!W.losuj)for(const g of W.ludzie)g.glosPlanszy=W.wybor.get(g.id);   // następne okno startuje z kursorem na ostatnim wyborze
  try{
    if(rozne.length>1){
      W.siatka.hidden=true;W.los.hidden=false;if(!W.losuj)W.opis.textContent=T.wpLosujemy;
      const pasek=W.pasek=Kolo.utworz(W.los);
      const seg=rozne.map(id=>{let rz=null;try{rz=Postepy.rzadkosc("plansza",id);}catch(e){}
        return {id,etykieta:nazwa(id),obraz:Motywy.sciezka(id,"tlo.webp"),obrazKlasa:"tlo",rzadkosc:rz};});
      await pasek.ustawSegmenty(seg);pasek.wejscie();
      await czekajMs(ruchOgraniczony()?150:600);
      await pasek.krec(rozne.indexOf(wygrana),{czas:3600,dystans:30});
    }else W.opis.textContent=T.wpZgodnie;
    W.wynik.replaceChildren(T.losPlanszyWynik+" ",h("b","",nazwa(wygrana)));
    await czekajMs(rozne.length>1?1500:900);
  }catch(e){bladStopnia("losPlanszy","losowanie planszy",e);}
  if(S.wyborPlanszy!==W)return;
  zamknijWyborPlanszy();
  if(S.ekran!=="lobby")return;
  if(wygrana!==Postepy.ekipa().motyw)Postepy.wybierzMotyw(wygrana);
  S.planszaGotowa=true;startGry();
}
// Plan gry: podział graczy na tory i partie gotowe do grania. Bez skutków ubocznych, bo liczy go też lobby, zanim
// ktokolwiek kliknie start (przygotowanie bitmap z wyprzedzeniem, zacznijZawczasu).
function planGry(){
  const p=piosenka();
  const podzial=(S.ust.tory==="chor"?podzialNaTory:podzialNaToryOsobno)(S.gracze.map(g=>({id:g.id,partia:g.partia})),p.partie,ZC_MAKS_TOROW);
  const bpm=p.tempo*S.ust.tempo/100;
  // W rzędzie chóru ludzie siedzą przed botami (lider na linii to człowiek, jeśli jest), dalej kolejność dołączenia.
  const kolejnosc=(a,b)=>((a.zrodlo==="bot")-(b.zrodlo==="bot"))||(a.dolaczyl-b.dolaczyl);
  const tory=podzial.tory.map(t=>({partia:t.partia,def:przygotujPartie(p.partie[t.partia],S.ust,bpm),styl:ZC_TORY_STYL[t.partia%ZC_TORY_STYL.length],
    gracze:t.gracze.map(id=>S.gracze.find(g=>g.id===id)).sort(kolejnosc),oceny:[],ptrRys:0,wJednymGlosie:0,
    trudnosc:trudnoscPartiiW(p,t.partia),ogien:0,iskry:[]}));
  return {p,podzial,bpm,tory};
}
function startGry(bezZaslony){
  if(!S.gracze.length)return;
  const lic0=piosenka()&&piosenka().licencja;
  if(lic0&&lic0.atrybucja&&!(lic0.autorMidi&&lic0.nazwa&&lic0.zrodlo)){toast(T.licBrakAtrybucji,true);return;}
  if(S.wyborPlanszy)return;   // otwarte okno wyboru planszy: start po nim (10-17 wieczór)
  if(!S.planszaGotowa&&rozstrzygnijPlansze())return;
  S.planszaGotowa=false;
  Biblioteka.zatrzymajPodglad();Biblioteka.zamknijSzuflade();
  schowajToast();   // „Dodano…” z lobby nie wisi nad torem
  R.ogienKonf=0;    // konfetti za ogień głów liczy się od nowa (przerwana gra nie przenosi)
  const plan=planGry(),p=plan.p,podzial=plan.podzial;
  if(podzial.przeniesieni.length){
    toast(tt("zaDuzoTorow",{kto:podzial.przeniesieni.map(id=>(S.gracze.find(g=>g.id===id)||{}).nazwa||id).join(", ")}));
  }
  const bpm=plan.bpm,sPerBeat=60/bpm,tory=plan.tory;
  const G=S.gra={piosenka:p,bpm,metrum:p.metrum,beat:-4,tory,
    perkusja:{nuty:silnikGraPerkusje()?(p.perkusja||[]):[],ptr:0},   // 11-19: perkusja z pliku MIDI (silnik inny niż „Jeden instrument”)
    podklad:podzial.bezSpiewu.map(i=>({nuty:p.partie[i].nuty,ptr:0,program:p.partie[i].program}))
      .concat(p.tlo&&p.tlo.length?[{nuty:p.tlo,ptr:0,poziom:.55}]:[]),   // tło: nuty pliku spoza partii, ciszej
    podpowiedz:S.ust.podpowiedz?tory.map(t=>({nuty:t.def.nuty.map(n=>n.d0!=null?Object.assign({},n,{t:n.t0,d:n.d0}):n),ptr:0})):[],
    kliki:[-4,-3,-2,-1],ptrKlik:0,odchrzakniecia:[],popupy:[],loty:[],skokWidowni:0,fala:-1e9,
    ostRechot:-1e9,ostRribbit:-1e9,mnRuchu:mnoznikRuchu(S.ust.czasNaRuch),
    tempoProc:procentTempa(S.ust.tempo),mnTempa:mnoznikTempa(S.ust.tempo),mnPomocy:mnoznikPomocy(S.ust,false),
    przyciaganie:ZC_POMOC.POZIOMY[poziomPrzyciagania(S.ust.przyciaganie)]};
  // runda 6: czas na ruch × tempo, w tych samych czterech miejscach; 10-18: × pomoce. Gracz ma własny g.mnPunktow (jego pomoce
  // z karty albo z ustawień, „Skok do nuty” tylko na klawiaturze); G.mnPunktow i G.przyciaganie = ustawienia gry (boty, zapas)
  G.mnPunktow=Math.round(G.mnRuchu*G.mnTempa*G.mnPomocy*1e4)/1e4;
  for(const g of S.gracze)synchronizujPomoce(g);   // 10-18 wieczór: pomoce z profilu gracza, zanim policzą się mnożniki
  for(const t of tory){   // świecące frazy (10-10): numer frazy dla każdej jej nuty
    t.sekcje=sekcjeBonusowe(t.def.nuty,sPerBeat);t.sekcjaNuty=new Map();
    t.sekcje.forEach((s,k)=>{for(let i=s.od;i<=s.do;i++)t.sekcjaNuty.set(i,k);});
  }
  const skala=Glos.skala(S.gracze.length);
  let nr=0;
  for(const tor of tory)tor.gracze.forEach((g,i)=>{
    const w=zrodloGracza(g);
    g.tor=tor;g.partia=tor.partia;g.nrWTorze=i;
    g.offMs=offGracza(g.zrodlo,S.ust);
    // 10-18 wieczór: pomoce gracza ustalone na całą piosenkę (przyciąganie w krokGracza, śpiew, skok do nuty, tablica)
    // 10-20: u bota w to samo miejsce idzie zatrzask jego poziomu (wejscie.js), czyli jak celnie robo-żaba siada na nucie
    g.pomoceGry=pomoceGracza(g);
    g.przyciaganie=g.zrodlo==="bot"?(w&&w._bot?w._bot.zatrzask:null):ZC_POMOC.POZIOMY[g.pomoceGry.przyciaganie];
    g.mnPomocy=mnoznikPomocy(Object.assign({},S.ust,g.pomoceGry),klawiaturowy(g.zrodlo));
    g.mnPunktow=Math.round(G.mnRuchu*G.mnTempa*g.mnPomocy*1e4)/1e4;
    g.maks=maksimumPunktow(tor.def.nuty,g.mnPunktow);
    Object.assign(g,{deg:(w?w.pitch:0)*(S.ust.odwroc?-1:1),polton:stopnieNaPolton(0,S.ust.zakres,tor.def.lo,tor.def.hi),
      poz:.5,spiewa:false,naNucie:false,idxPod:-1,zaspiewal:false,wib:0,pb:-4-g.offMs/1000/sPerBeat,ptr:0,
      ak:{sumaAcc:0,spiewal:false,wib:0},wyniki:[],kombo:0,maxKombo:0,mnoznik:1,punkty:0,premia:0,premiaChoru:0,
      wibrata:0,gadanie:0,gada:false,kum:{ciag:0,za:0},kumWiek:1,oceny:{czysto:0,dobrze:0,prawie:0,falsz:0,pudlo:0},
      zamknieteNut:0,slad:[],potrzas:0,ogien:0,wypel:{},halo:0,
      klik:{},premiaKlik:0,kliki:{idealnie:0,dobrze:0},seriaKlik:0,wPunkt:0,seriaWPunkt:0,najSeriaWPunkt:0,ostWPunkt:-2,sekcjeStan:{},sekcjeZdobyte:0,przyciskPrzed:!!(w&&w.przycisk)});
    if(g.glos)g.glos.zniszcz();
    g.instrument=instrumentGracza(g);
    g.glos=Glos.glos(g.instrument,skala,++nr,null,{przejscia:przejsciaGracza(g)});
    G.odchrzakniecia.push({b:-4+.25+losujGre()*1.5,przes:(nr%4)*12,g,zagrane:false});
  });
  G.instrPodkladu=instrumentPodkladu(S.ust.instrument,S.gracze.map(g=>g.instrument));
  // „Pokaż jak” (recenzja 2): żaba-duch na każdym torze z człowiekiem, tylko w pierwszej piosence z ludźmi
  // po załadowaniu strony (potem gracze już wiedzą, a duch tylko by zasłaniał; pokaz samych botów się nie liczy)
  const zLudzmi=S.gracze.some(g=>g.zrodlo!=="bot");
  if(zLudzmi)S.nrGry++;
  if(S.ust.pokazJak&&zLudzmi&&S.nrGry===1)for(const t of tory){
    const czlowiek=t.gracze.find(g=>g.zrodlo!=="bot");if(!czlowiek)continue;
    const n0=t.def.nuty[0];
    t.duch={kolor:czlowiek.kolor,polton:n0?n0.m:(t.def.lo+t.def.hi)/2,spiewa:false,alfa:ZC_DUCH_ALFA};
  }
  S.wyniki=null;S.autoStart=null;S.wszyscyGotowi=null;S.czekaNaDzwiek=false;
  G.ogien=0;el("gra").dataset.ogien="0";R.iskry=[];
  przypiszStyle();
  ustawPauze(false,true);   // nowa piosenka (także ZC.start w pauzie) zawsze rusza bez pauzy i bez odliczania wznowienia
  S.ekran="odliczanie";
  schowajPilota();
  pokazEkran("gra");
  if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();
  wczytajJakoscAuto();
  // Zasłona wczytywania utworu (11-18): układ, bitmapy i rozgrzewka idą po kawałku w kolejnych klatkach pod zasłoną
  // (zacznijWczytywanieUtworu), a zegar stoi, aż zasłona zejdzie. Bez niej (?zaslona=0, harness) wszystko od razu, jak dotąd.
  if(bezZaslony!==true&&ZC_DEV.zaslona&&typeof document!=="undefined"){zacznijWczytywanieUtworu();return;}
  S.wczyt=null;schowajZasloneUtworu(true);
  zbudujHud();ukladGry({zachowaj:true});rozgrzejGrafike();
  // Pierwsza klatka gry rasteryzuje na GPU świeże bufory motywu (tło, faktura karty, klawiatura): pomiar 10-09
  // (Intel, 1707×1067 @1,5) 120–220 ms w Halloween, Koncercie, Kosmosie, przy JS startu 22–31 ms; przychodzi w 2.–3.
  // klatce. Zegar gry stoi (krok), aż po co najmniej 3 krokach przyjdzie zwykła klatka (≤ 40 ms), najdłużej 1,5 s:
  // zacięcie wypada przed beatem −4, a odliczanie i pierwszy klik idą od początku równo.
  S.zegarStoi={od:performance.now(),n:0};
  limitNaStart();
}
// ---- bitmapy z wyprzedzeniem, już w lobby (11-18) ----
// Gra sprawdza, jakie grafiki będą potrzebne, i trzyma je gotowe, zanim ktokolwiek kliknie start: w kroku „Rozgrywka”,
// gdy piosenka, skład, ustawienia i okno nie zmieniają się przez ZC_ZAWCZASU.SPOKOJ_MS, liczy plan gry i układ tak samo jak
// startGry (planGry, geometriaUkladu; wysokość HUD mierzy na niewidocznym ekranie gry) i buduje te same bitmapy co zasłona
// (zadaniaBuforow), po kilka na klatkę, żeby lobby zostało płynne. Bitmapy nut zbiera na torach planu.
// Start z tym samym odciskiem układu przejmuje wszystko (ukladGry) i pod zasłoną zostaje tylko rozgrzewka. Każda różnica
// (inna plansza z głosowania, zmiana w ostatniej chwili, inna wysokość HUD) daje inny odcisk: wtedy bitmapy powstają
// pod zasłoną jak bez tego kroku, więc pomyłka przewidywania kosztuje czas, a nie poprawność. ?zawczasu=0 wyłącza.
const ZC_ZAWCZASU={SPOKOJ_MS:700,CO_MS:250,JS_MS:3,NA_MS:1.2};
function kluczZawczasu(){
  const p=piosenka();if(!p)return null;
  const id=w=>w&&w.id||"";
  return JSON.stringify([innerWidth,innerHeight,window.devicePixelRatio||1,p.id,p.tempo,S.ust,document.documentElement.lang||"",
    document.fonts?document.fonts.status:"",ZC_TORY_SCENY.map(t=>id(stopienSceny(t))),
    S.gracze.map(g=>[g.id,g.nazwa,g.kolor,g.zrodlo,g.partia,g.poziom,instrumentGracza(g),id(stopienGracza(g,"streak")),przebranieGracza(g)||""])]);
}
// Dolny brzeg HUD tej gry, zanim ekran gry się pokaże: ekran gry na chwilę niewidoczny zamiast ukryty (zajmuje cały
// ekran pod lobby, więc układ lobby się nie zmienia), pomiar, powrót. Wszystko w jednym zadaniu, bez klatki pomiędzy.
function zmierzHud(G){
  const gra=el("gra"),byl=gra.hidden,wid=gra.style.visibility;
  gra.style.visibility="hidden";gra.hidden=false;
  try{zbudujHud(G);return el("hud").getBoundingClientRect().bottom;}
  finally{gra.hidden=byl;gra.style.visibility=wid;}
}
function zacznijZawczasu(klucz){
  if(!wczytajGrafikiMotywow())return false;   // grafiki motywów jeszcze się wczytują: bitmapy wyszłyby zastępcze
  const plan=planGry();if(!plan.tory.length)return false;
  const G={piosenka:plan.p,bpm:plan.bpm,metrum:plan.p.metrum,beat:-4,tory:plan.tory};
  wczytajJakoscAuto();przypiszStyle();
  const geo=geometriaUkladu(G,zmierzHud(G));
  rozmiarPlocien(geo.W,geo.H,geo.dpr,true);
  R.W=geo.W;R.H=geo.H;R.dpr=geo.dpr;R.f=geo.f;R.tory=geo.tory;R.widownia=geo.widownia;
  const odc=odciskUkladu(G);if(!odc)return false;
  if(odc!==R.odcisk){R.bufor.clear();R.wersja++;R.wzor=null;}
  R.odcisk=odc;
  R.zawczasu={klucz,odcisk:odc,G,zad:zadaniaBuforow(G),i:0};
  return true;
}
function krokZawczasu(teraz){
  if(!ZC_DEV.zawczasu||typeof document==="undefined")return;
  const Z=R.zaw||(R.zaw={klucz:null,od:0,spr:-1e9,ost:null,zly:null});
  const d=Z.ost==null?16.7:Math.max(1,Math.min(34,teraz-Z.ost));Z.ost=teraz;
  if(S.gra||S.ekran!=="lobby"||S.lobbyEkran!=="konfiguracja"||!S.gracze.length||S.wyborPlanszy){Z.klucz=null;return;}
  try{
    if(teraz-Z.spr>=ZC_ZAWCZASU.CO_MS){
      Z.spr=teraz;const k=kluczZawczasu();
      if(k!==Z.klucz){Z.klucz=k;Z.od=teraz;}
      const P=R.zawczasu;
      if(k&&k!==Z.zly&&(!P||P.klucz!==k)&&teraz-Z.od>=ZC_ZAWCZASU.SPOKOJ_MS)zacznijZawczasu(k);
      return;   // ta klatka była od liczenia planu, bitmapy od następnej
    }
    const P=R.zawczasu;
    if(!P||P.klucz!==Z.klucz||P.i>=P.zad.length)return;
    R.swieze=[];
    const t0=performance.now();let ile=Math.max(1,Math.round(d*ZC_ZAWCZASU.NA_MS));
    while(P.i<P.zad.length&&ile>0&&performance.now()-t0<ZC_ZAWCZASU.JS_MS){const k=R.swieze.length;P.zad[P.i++]();if(R.swieze.length>k)ile--;}
    // przeglądarka rysuje płótno spoza strony dopiero, gdy ktoś z niego skorzysta: małe płótno pomocnicze robi to teraz
    if(!R.pomZaw){const cv=document.createElement("canvas");cv.width=cv.height=2;R.pomZaw=cv.getContext("2d");}
    wyslijSwieze(R.pomZaw);
  }catch(e){console.warn("RibbitBeat: bitmapy z wyprzedzeniem",e);Z.zly=Z.klucz;R.zawczasu=null;}
  finally{R.swieze=null;}
}
// ---- zasłona wczytywania utworu (11-18) ----
// Objaw: po „Śpiewamy!” gra zamierała (pomiar: 0,6–0,8 s przy pierwszym utworze, 0,1–0,4 s przy każdym kolejnym). Sam JS
// startu to 35–75 ms; resztę zabierała karta graficzna, która w jednej klatce dostawała kilkaset nowych bitmap, a w
// następnej pierwsze rysowanie sceny. Zegar gry wtedy stał, ale obraz też, bez żadnej informacji dla gracza.
// Teraz jak na starcie aplikacji: startGry ustawia stan gry i pokazuje zasłonę (ta sama żaba i pasek co #wczytywanie),
// a ciężka praca idzie po kawałku w kolejnych klatkach, w tej kolejności:
//   0 zasłona narysowana → 1 HUD i układ → 2 bitmapy po kilka na klatkę → 3 rozgrzewka → 4 scena rysuje się pod zasłoną
//   (przy pierwszej piosence w tym układzie próba generalna, stan po stanie) do kilku równych klatek → zasłona znika
//   i dopiero wtedy rusza zegar z odliczaniem.
// Do etapu 4 scena się nie rysuje (R.tory puste). Zmiana okna albo ustawień w trakcie woła zwykły ukladGry i nic nie psuje,
// bo etap 1 liczy układ jeszcze raz. Wyjście z gry albo nowy start kasuje wczytywanie; przewijanie harnessu kończy je od razu.
const ZC_ZASLONA={MIN_MS:320,MAKS_MS:8000,JS_MS:5,NA_MS:2.5,ZNIKA_MS:220};
function zacznijWczytywanieUtworu(){
  R.tory=[];
  S.zegarStoi={od:performance.now(),n:0,zaslona:true};
  S.wczyt={gra:S.gra,etap:0,n:0,od:performance.now(),ost:null,tory:null,zad:null,i:0,rysuj:false,narys:0,rowne:0,graf:false,proba:null};
  pokazZasloneUtworu(S.gra.piosenka);
}
function pokazZasloneUtworu(p){
  let z=el("wczUtwor");
  if(z&&z._znika){clearTimeout(z._znika);z._znika=null;}
  if(!z){
    z=h("div","wczytywanie wcz-utwor");z.id="wczUtwor";z.setAttribute("role","status");
    // ta sama budowa co ekran wczytywania aplikacji w index.html (girlanda lamp, scena z promieniami, żabą i cieniem;
    // korektor; pasek); girlanda to kopia tej z zasłony startu (Wczytywanie.girlanda)
    const girlanda=typeof Wczytywanie!=="undefined"&&Wczytywanie.girlanda?Wczytywanie.girlanda():null;if(girlanda)z.append(girlanda);
    const zaba=new Image();zaba.className="wcz-zaba";zaba.alt="";zaba.src="../assets/frog/mascot-beat.webp";
    const scena=h("div","wcz-scena");scena.append(h("i","wcz-promienie"),zaba,h("i","wcz-cien"));
    const rytm=h("div","wcz-rytm");for(let i=0;i<9;i++)rytm.append(h("i"));
    const pasek=h("div","wcz-pasek");pasek.append(h("i"));
    const napisy=h("div","wcz-napisy");napisy.append(h("div","wcz-pod"),h("div","wcz-tytul"),h("div","wcz-meta"));
    z.append(scena,napisy,rytm,pasek);
    document.body.append(z);
  }
  z.classList.remove("znika");
  // żaba pulsuje, a lampy błyskają w tempie wczytywanej piosenki: --wt to jedna ćwierćnuta (index.html, gry.css)
  let takt=60/((S.gra&&S.gra.bpm)||(p&&p.tempo)||128);while(takt<.3)takt*=2;while(takt>1.2)takt/=2;
  z.style.setProperty("--wt",takt.toFixed(4)+"s");
  z.querySelector(".wcz-pod").textContent=T.wczytujeUtwor;
  z.querySelector(".wcz-tytul").textContent=p&&p.tytul||"";
  let meta="";
  try{if(p&&p.tempo>0&&p.koniec>0&&p.partie)meta=tt("wybranaMeta",{czas:fmtCzas(p.koniec*60/p.tempo),partie:liczbaPartii(p.partie.length),tempo:Math.round(p.tempo)});}catch(e){}
  z.querySelector(".wcz-meta").textContent=meta;
  postepZaslony(.04);
}
function postepZaslony(f){
  const i=document.querySelector("#wczUtwor .wcz-pasek>i");
  if(i)i.style.transform="translateX("+(-100*(1-Math.max(.04,Math.min(1,f)))).toFixed(1)+"%)";
}
function schowajZasloneUtworu(odRazu){
  const z=typeof document!=="undefined"?el("wczUtwor"):null;if(!z)return;
  if(z._znika)clearTimeout(z._znika);
  if(odRazu){z._znika=null;z.remove();return;}
  z.classList.add("znika");z._znika=setTimeout(()=>{z._znika=null;z.remove();},ZC_ZASLONA.ZNIKA_MS+80);
}
// Przeglądarka odkłada rysowanie na płótnie spoza strony do chwili, gdy ktoś z niego skorzysta, więc bitmapy zbudowane
// pod zasłoną i tak spadały na kartę graficzną naraz, w pierwszej klatce sceny (pomiar: 0,1–0,9 s jednej klatki przy długim
// utworze). Dlatego każda świeża bitmapa rysuje się od razu na płótnie sceny, prawie przezroczysta, w rogu 2×2 px:
// praca karty rozkłada się na klatki wczytywania, a scena i tak czyści się przed pierwszym rysowaniem.
function wyslijSwieze(cel){
  const N=R.swieze;if(!N||!N.length)return;
  const c=cel||R.cs;
  if(c)try{
    c.save();c.setTransform(1,0,0,1,0,0);c.globalAlpha=.004;
    for(const cv of N)if(cv.width&&cv.height)c.drawImage(cv,0,0,2,2);
    c.restore();
  }catch(e){}
  N.length=0;
}
function koniecWczytywaniaUtworu(odRazu){
  S.wczyt=null;R.swieze=null;
  if(S.zegarStoi&&S.zegarStoi.zaslona)S.zegarStoi=null;
  schowajZasloneUtworu(odRazu);
  if(S.gra)limitNaStart();
}
// Resztę wczytywania od razu, w jednym kawałku (przewijanie harnessu, bezpiecznik czasu, błąd kroku).
function dokonczWczytywanieUtworu(){
  const W=S.wczyt;if(!W)return;
  try{
    if(S.gra&&S.gra===W.gra&&(S.ekran==="odliczanie"||S.ekran==="gra")){
      if(W.etap<=1){zbudujHud();ukladGry({zachowaj:true});}
      else if(W.etap===2&&W.zad)for(;W.i<W.zad.length;W.i++)W.zad[W.i]();
      if(W.etap<=3)rozgrzejGrafike();
    }
  }catch(e){console.warn("RibbitBeat: wczytywanie utworu",e);}
  koniecWczytywaniaUtworu(true);
}
function krokWczytywaniaUtworu(teraz){
  const W=S.wczyt;if(!W)return;
  if(!S.gra||S.gra!==W.gra||(S.ekran!=="odliczanie"&&S.ekran!=="gra")){koniecWczytywaniaUtworu(true);return;}
  const d=W.ost==null?16.7:Math.max(1,Math.min(34,teraz-W.ost));W.ost=teraz;W.n++;
  if(performance.now()-W.od>ZC_ZASLONA.MAKS_MS){console.warn("RibbitBeat: wczytywanie utworu przerwane po "+ZC_ZASLONA.MAKS_MS+" ms");dokonczWczytywanieUtworu();return;}
  try{
    if(W.etap===0){if(W.n>=3)W.etap=1;}   // dwie klatki z samą zasłoną: jest już na ekranie, zanim zacznie się praca
    else if(W.etap===1){
      R.swieze=[];
      zbudujHud();ukladGry({zachowaj:true,bezBuforow:true});
      W.tory=R.tory;W.zad=zadaniaBuforow(S.gra);W.i=0;W.etap=2;postepZaslony(.15);
    }else if(W.etap<4&&R.tory!==W.tory){W.etap=1;W.zad=null;   // w trakcie ktoś przeliczył układ (zmiana okna, ustawień): bitmapy od nowa
    }else if(W.etap===2){
      // tempo w zadaniach na milisekundę, nie na klatkę: na ekranie 240 Hz klatek jest cztery razy więcej niż na 60 Hz
      const t0=performance.now();let ile=Math.max(1,Math.round(d*ZC_ZASLONA.NA_MS));
      // do tempa liczy się tylko zadanie, które naprawdę coś zbudowało (bitmapy gotowe z lobby albo z poprzedniej piosenki przelatują)
      while(W.i<W.zad.length&&ile>0&&performance.now()-t0<ZC_ZASLONA.JS_MS){const k=R.swieze.length;W.zad[W.i++]();if(R.swieze.length>k)ile--;}
      wyslijSwieze();
      postepZaslony(.15+.6*(W.zad.length?W.i/W.zad.length:1));
      if(W.i>=W.zad.length){W.zad=null;W.etap=3;}
    }else if(W.etap===3){
      rozgrzejGrafike();W.etap=4;W.rysuj=true;W.narys=0;W.rowne=0;W.odRys=teraz;postepZaslony(.85);
    }else if(W.proba!=null){
      // próba generalna sceny (pierwsza piosenka w tym układzie): jeden kawałek na klatkę, zwykłe rysowanie czeka.
      // Udawany stan gry żyje tylko wewnątrz kawalek(), między klatkami gra ma prawdziwy stan
      W.rysuj=false;
      ProbaSceny.kawalek(teraz,W.proba);
      postepZaslony(.85+.1*Math.min(1,(W.proba+1)/5));
      if(++W.proba>4){W.proba=null;W.rysuj=true;W.narys=0;W.rowne=0;}
    }else{
      // scena rysuje się już pod zasłoną; czekamy na kilka równych klatek
      // (W.narys: klatki narysowane, liczy rysuj(); W.rowne: kolejne odstępy klatek bez zacięcia)
      W.rowne=d<=28?W.rowne+1:0;postepZaslony(.95+.05*Math.min(1,W.narys/4));
      const gotowa=W.narys>=4&&W.rowne>=3&&(W.graf||(W.graf=wczytajGrafikiMotywow()));
      if((gotowa&&performance.now()-W.od>=ZC_ZASLONA.MIN_MS)||teraz-W.odRys>(W.graf?1500:3000)){
        S.wczytRaport={ms:Math.round(performance.now()-W.od),klatek:W.n};
        koniecWczytywaniaUtworu(false);
      }
    }
  }catch(e){console.warn("RibbitBeat: wczytywanie utworu, etap "+W.etap,e);dokonczWczytywanieUtworu();}
}
function limitNaStart(){
  R.straznik=null;
  // 10-17 (pomiar w prawdziwym Chrome na ekranie 240 Hz, Intel, 2560×1600): „bez limitu” w ogniu = karta zajęta w 100 %, 80–150 kl./s
  // nierówno (30–87 % klatek na czas); limit 120 = równe 120 kl./s, 86–94 % na czas, karta 75 %. Strażnik i tak włączał 120 po
  // 8 spóźnionych klatkach, ale dopiero w piosence, czyli po zacięciach na jej początku. Na ekranie > 144 Hz robi to od razu.
  if(!(+S.ust.klatki>0)&&!R.limitAuto&&ZC_DEV.straznik!==false&&S.ust.autoJakosc!==false&&R.klatki&&R.klatki.min>0&&R.klatki.min<7){
    R.limitAuto=120;console.info("RibbitBeat: strażnik klatek: ekran > 144 Hz, „bez limitu” → 120 kl./s od startu piosenki");}
}
// Style na tę piosenkę: stopień streaka każdego gracza (tor rysuje się stopniem swojego lidera); klawisze, widownia
// i tło to jeden motyw planszy z puli ekipy (10-10; wcześniej klawisze gracza, scena właściciela składu). Parametry
// adresu (?widownia= ?streak= ?tlo= ?klawisze= ?stopien=) wymuszają stopień wszystkim, także botom, żeby dało się
// go obejrzeć w meczu botów. S.scena i g.stylStreak/g.stylKlawiszy to wpisy drabinek (obiekty), g.stylWidowni samo id.
// Grafiki motywów (Motywy.wczytaj) ładujemy już w lobby, przy każdej zmianie składu, żeby w piosence nic się nie
// dociągało (dociągnięte tło = ponowne złożenie #tlo = zacięcie). Zwraca, czy wszystkie są już gotowe.
function wczytajGrafikiMotywow(){
  if(typeof Motywy==="undefined"||!Motywy.wczytaj)return true;
  const ids=new Set();
  for(const g of S.gracze)for(const t of ZC_TORY_SCENY){const w=stopienGracza(g,t);if(w&&w.motyw)ids.add(w.motyw);}
  for(const t of ZC_TORY_SCENY){const w=stopienSceny(t);if(w&&w.motyw)ids.add(w.motyw);}
  let ok=true;
  for(const g of S.gracze)if(g.zrodlo==="bot"&&!skinWymuszony()){const r=roboPrzebranie(g.poziom);Motywy.wczytaj(r);if(Motywy.przebranie&&!Motywy.przebranie(r))ok=false;}   // 10-18: przy skinie z adresu bot nosi skin, nie robo-żabę
  for(const id of ids){Motywy.wczytaj(id);const M=Motywy.motyw(id);
    if(M&&Array.isArray(M.zasoby))for(const f of M.zasoby)if(!Motywy.zasob(id,f))ok=false;
    if(M&&M.przebranie&&Motywy.przebranie&&!Motywy.przebranie(id))ok=false;}
  return ok;
}
function wlascicielSceny(){return S.gracze.find(g=>g.zrodlo!=="bot")||null;}
function przypiszStyle(){
  for(const g of S.gracze){
    const w=stopienGracza(g,"widownia");
    g.stylWidowni=w?w.id:null;g.stylStreak=stopienGracza(g,"streak");g.stylKlawiszy=stopienGracza(g,"klawisze");
    g._komboPop=0;   // zerwanie kombo (hak streaka w rysujTor) liczy się od nowa w każdej piosence
  }
  wczytajGrafikiMotywow();
  const wl=wlascicielSceny();
  S.scena={widownia:stopienSceny("widownia"),streak:wl?wl.stylStreak:stopienSceny("streak"),
    tlo:stopienSceny("tlo"),klawisze:stopienSceny("klawisze")};
}
// ---- stopnie sceny (progresja: cztery tory, po 10–11 stopni) ----
// Drabinka toru = lista wpisów {stopien, id, nazwa, …} od stopnia 1. Moduł toru (efekty-widownia.js,
// efekty-streak.js, efekty-tlo.js, efekty-klawisze.js) podaje własną DRABINKA; bez modułu widownia i streak to
// katalog Efekty (stopień = miejsce w katalogu), a tło i klawisze mają jeden stopień: dzisiejszy kraft i papier.
// Moduły są opcjonalne (gra działa bez ich plików), więc każde odwołanie idzie przez `typeof`.
const ZC_TORY_SCENY=["widownia","streak","tlo","klawisze"];
const ZC_STOPIEN_ZAPAS={tlo:{stopien:1,id:"kraft",nazwa:"Kraft"},klawisze:{stopien:1,id:"papier",nazwa:"Papier"}};
function modulToru(tor){
  if(tor==="widownia")return typeof EfektyWidownia!=="undefined"?EfektyWidownia:null;
  if(tor==="streak")return typeof EfektyStreak!=="undefined"?EfektyStreak:null;
  if(tor==="tlo")return typeof EfektyTlo!=="undefined"?EfektyTlo:null;
  if(tor==="klawisze")return typeof EfektyKlawisze!=="undefined"?EfektyKlawisze:null;
  return null;
}
function drabinka(tor){
  const m=modulToru(tor);
  if(m&&Array.isArray(m.DRABINKA)&&m.DRABINKA.length)return m.DRABINKA;
  if(tor==="widownia"||tor==="streak"){
    const kat=typeof Efekty==="undefined"?[]:tor==="widownia"?Efekty.WIDOWNIE:Efekty.STREAKI;
    return kat.map((w,i)=>Object.assign({},w,{stopien:i+1}));
  }
  return ZC_STOPIEN_ZAPAS[tor]?[ZC_STOPIEN_ZAPAS[tor]]:[];
}
// Wpis gotowy do rysowania: stopnie 1–13 widowni i streaka mogą być w module samymi wskaźnikami {stopien, id, nazwa}
// na styl z efekty.js; brakujące rysowanie dobiera się wtedy z katalogu po id (nieznane id = styl domyślny).
function pelnyWpis(tor,w){
  if(!w)return null;
  if(tor==="widownia"&&typeof w.rysuj!=="function")return Object.assign({},Efekty.widownia(w.id),w);
  if(tor==="streak"&&typeof w.glowa!=="function")return Object.assign({},Efekty.streak(w.id),w);
  return w;
}
function wpisToru(tor,id){const w=drabinka(tor).find(x=>x.id===id);return w?pelnyWpis(tor,w):null;}
// Parametry adresu do podglądu stopni (czyta je ZC.init): surowe wartości, rozwiązywane dopiero przy przypisaniu
// stylów, bo moduły drabinek mogą dopisać stopnie. Nic z tego nie trafia do zapisu.
const ZC_DEV={widownia:null,streak:null,tlo:null,klawisze:null,stopien:null,gl:true,moc:null,instrument:null};   // instrument: panel DEV (10-16)
function ustawDevSceny(Q){
  const v=k=>{const x=Q.get(k);return x==null||!x.trim()?null:x.trim();};
  for(const t of ZC_TORY_SCENY)ZC_DEV[t]=v(t);
  ZC_DEV.stopien=v("stopien");
  ZC_DEV.gl=!/^(0|false|nie)$/i.test(v("gl")||"1");
  ZC_DEV.straznik=!/^(0|false|nie)$/i.test(v("straznik")||"1");   // ?straznik=0: bez auto-jakości (pomiary)
  ZC_DEV.nutyGL=/^(1|true|tak)$/i.test(v("nutyGL")||"");   // ?nutyGL=1: taśmy nut w WebGL2 (eksperyment 10-17, js/nuty-gl.js)
  ZC_DEV.iskryGlowy=!/^(0|false|nie)$/i.test(v("iskryGlowy")||"1");   // ?iskryGlowy=0: bez iskier i dymu z głów, w zamian konfetti na wynikach (próba; iskry zostają)
  ZC_DEV.zapas=!/^(0|false|nie)$/i.test(v("zapas")||"1");   // ?zapas=0: bez bitmap całej piosenki przed startem i puli płócien (porównanie 10-17)
  ZC_DEV.probaEkranow=!/^(0|false|nie)$/i.test(v("probaEkranow")||"1");   // ?probaEkranow=0: bez pierwszego otwarcia ekranów pod zasłoną startu (porównanie 11-18)
  ZC_DEV.pliki=!/^(0|false|nie)$/i.test(v("pliki")||"1");   // ?pliki=0: bez wczytywania grafik menu i podmenu pod ekranem startu (porównanie 11-18)
  ZC_DEV.zawczasu=!/^(0|false|nie)$/i.test(v("zawczasu")||"1");   // ?zawczasu=0: bez budowania bitmap w lobby przed startem (porównanie 11-18)
  ZC_DEV.zaslona=!/^(0|false|nie)$/i.test(v("zaslona")||"1");   // ?zaslona=0: start piosenki bez zasłony wczytywania, wszystko w jednej klatce (porównanie 11-18)
  ZC_DEV.proba=!/^(0|false|nie)$/i.test(v("proba")||"1");   // ?proba=0: bez próby generalnej sceny przed odliczaniem (porównanie 10-17, js/proba-sceny.js)
  const m=v("moc");ZC_DEV.moc=m!=null&&Number.isFinite(+m)?Math.max(0,Math.min(1,+m)):null;
}
// Stopień wymuszony z adresu: ?<tor>=<id albo numer 1–20>, a bez niego ?stopien=N; nieznany = brak (zwykły wybór).
function stopienDev(tor){
  const x=ZC_DEV[tor]!=null?ZC_DEV[tor]:ZC_DEV.stopien;if(x==null)return null;
  const d=drabinka(tor),w=/^\d+$/.test(x)?d.find(y=>y.stopien===+x):d.find(y=>y.id===x);
  return w?pelnyWpis(tor,w):null;
}
// Stopień toru dla gracza: parametr adresu (podgląd, wszystkim, także botom), potem wybór z profilu, potem stopień 1.
// To jedyne miejsce, które czyta wybór gracza: etap A1b (Postepy v2, „auto: najwyższy”) podmienia tylko środek.
function stopienGracza(g,tor){
  const dev=stopienDev(tor);if(dev)return dev;
  if(ZC_TORY_WSPOLNE.includes(tor))return stopienSceny(tor);   // 10-10: klawisze, tło i widownia = motyw planszy, nie wybór gracza
  const n=g?Postepy.nazwaProfilu(g):null;
  if(n){
    let id=null;try{id=(Postepy.wybor(n)||{})[tor];}catch(e){}
    const w=id?wpisToru(tor,id):null;if(w)return w;
  }
  return pelnyWpis(tor,drabinka(tor)[0])||ZC_STOPIEN_ZAPAS[tor]||null;
}
// Widownia, tło i klawisze należą do PLANSZY (10-05 scena wspólna; 10-10 także klawisze): motyw z puli ekipy
// (Postepy.ekipa), niezależny od składu; parametr adresu wygrywa jak wszędzie. Pozostałe tory: pierwszy człowiek w składzie.
function stopienSceny(tor){
  if(!ZC_TORY_WSPOLNE.includes(tor))return stopienGracza(wlascicielSceny(),tor);
  const dev=stopienDev(tor);if(dev)return dev;
  const id=wyborWspolny(tor),w=id?wpisToru(tor,id):null;
  return w||pelnyWpis(tor,drabinka(tor)[0])||ZC_STOPIEN_ZAPAS[tor]||null;
}
// Moc stopnia 0..1: stopień/20, a do prób ?moc= (jedna wartość dla wszystkich torów). Moduły wołają ją same dla
// streaka i klawiszy (wpis gracza); st.moc w stanie klatki to moc stopnia tła, widownia dostaje swoją w Efekty.stan.
// Od 10-05 drabinki mają 10–11 stopni, więc moc = stopień / długość drabinki, w której wpis leży (ostatni = 1).
function mocStopnia(w){
  if(ZC_DEV.moc!=null)return ZC_DEV.moc;
  if(w&&w.moc!=null)return +w.moc;   // motywy (10-09): każdy stopień w pełnej krasie, bo nie jest „słabszą wersją” następnego
  const s=w&&+w.stopien>0?+w.stopien:1;let n=20;
  if(w)for(const t of ZC_TORY_SCENY){const d=drabinka(t);if(d.some(x=>x===w||(x&&x.id===w.id&&+x.stopien===s))){n=d.length;break;}}
  return Math.min(1,s/Math.max(1,n));
}
// Klawiatura jest jedna na tor: w chórze wszyscy grają stopniem lidera (jak streak w stylToru).
function wpisKlawiszy(g){
  const lid=(g&&g.tor&&g.tor.gracze&&g.tor.gracze[0])||g;
  return (lid&&lid.stylKlawiszy)||(S.scena&&S.scena.klawisze)||ZC_STOPIEN_ZAPAS.klawisze;
}
const wpisKlawiszyToru=L=>wpisKlawiszy(L.tor.gracze[0]);
// Styl streaka toru = styl lidera (chór: pierwsza żaba). Grafika uproszczona i ograniczony ruch: zawsze domyślny
// ogień (z niego zostaje wtedy tylko to, co tanie: poświata i smuga śladu), jak przed stylami.
function stylToru(L){
  if(!grafikaPelna())return Efekty.STREAKI[0];
  const g=L.tor.gracze[0];return (g&&g.stylStreak)||Efekty.STREAKI[0];
}
// `cel` (10-18, tylko napis): ekran lobby po wyjściu zamiast kroku „Wybierz piosenkę”; „Zabierz mnie tam” z karty Studia (nagrody.js)
// podaje „studioEkran”, żeby z wyników przejść do Studia jedną zasłoną, a nie przez wybór piosenki
function przerwijGre(cel){
  el("gra").dataset.ogien="0";
  for(const g of S.gracze){
    if(g.glos){g.glos.zniszcz();g.glos=null;}
    if(g.zrodlo!=="bot")g.gotowy=false;   // inaczej lobby od razu odliczałoby kolejny start
  }
  S.gra=null;S.wyniki=null;S.ekran="lobby";
  pokazEkran("lobby");rysujGraczy();pokazLobby(typeof cel==="string"?cel:"wybor");
}
// Pauza (Esc w trakcie piosenki): gra stoi, dźwięk wyciszony, przyciski nic nie robią; Esc wraca, Q wychodzi.
// Wznowienie jest po odliczaniu, żeby gracze zdążyli wrócić na tory i ustawić postacie: „Wróć” z pauzy w trakcie piosenki nie rusza od razu, tylko odlicza 3, 2, 1 (ZC_WZNOWIENIE). Zegar gry
// i dźwięk dalej stoją, a żaby już idą za przechyłem (krokWznowienia), więc każdy ustawia się na swojej wysokości.
// Esc w trakcie odliczania wraca do pauzy. `natychmiast` (startGry, koniec odliczania, odliczanie startowe) bez tego.
const ZC_WZNOWIENIE={KROK:800,ILE:3};
function ustawPauze(tak,natychmiast){
  tak=!!tak&&!!S.gra&&(S.ekran==="gra"||S.ekran==="odliczanie");
  if(tak&&S.wznowienie){S.wznowienie=null;pokazWznowienie(null);el("pauza").hidden=false;el("btnWroc").focus({preventScroll:true});return;}
  if(!tak&&S.wznowienie&&!natychmiast)return;   // odliczanie już trwa
  if(!tak&&!natychmiast&&S.pauza&&S.gra&&S.ekran==="gra"){
    const t=performance.now();S.wznowienie={od:t,do:t+ZC_WZNOWIENIE.KROK*ZC_WZNOWIENIE.ILE,n:0};
    el("pauza").hidden=true;if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();
    pokazWznowienie(ZC_WZNOWIENIE.ILE);return;
  }
  if(!tak){S.wznowienie=null;pokazWznowienie(null);}
  if(S.pauza===tak)return;
  S.pauza=tak;S.ostatnioAudio=null;S.ostatnio=performance.now();   // po pauzie czas liczy się od nowa
  el("pauza").hidden=!tak;
  Glos.wycisz(tak);
  if(tak)el("btnWroc").focus({preventScroll:true});
  else if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();
}
// Odliczanie wznowienia: same ruchy żab (bez nut, punktów i dźwięku), cyfra co ZC_WZNOWIENIE.KROK, potem gra rusza.
function krokWznowienia(dt,teraz){
  const W=S.wznowienie,G=S.gra;if(!W||!G)return;
  for(const tor of G.tory)for(const g of tor.gracze){
    const w=zrodloGracza(g),def=tor.def;
    g.deg=wygladzEMA(g.deg,(w?w.pitch:0)*(S.ust.odwroc?-1:1),dt,.06);
    const semi=stopnieNaPolton(g.deg,S.ust.zakres,def.lo,def.hi);
    g.polton=semi;g.poz=Math.max(0,Math.min(1,(semi-(def.lo-2))/(def.hi-def.lo+4)));
  }
  const zostalo=W.do-teraz,n=Math.max(1,Math.ceil(zostalo/ZC_WZNOWIENIE.KROK));
  if(zostalo<=0){S.wznowienie=null;pokazWznowienie(null);ustawPauze(false,true);return;}
  if(n!==W.n){W.n=n;pokazWznowienie(n);}
}
function pokazWznowienie(n){
  let d=el("wznowienie");
  if(n==null){if(d)d.hidden=true;return;}
  if(!d){d=h("div","wznowienie");d.id="wznowienie";d.setAttribute("role","status");d.setAttribute("aria-live","assertive");
    d.append(h("b","wznowienie-cyfra"),h("span","wznowienie-nota",T.wznowienieNota));el("gra").append(d);}
  d.hidden=false;const c=d.firstChild;c.textContent=String(n);
  c.classList.remove("puls");void c.offsetWidth;c.classList.add("puls");   // każda cyfra wskakuje od nowa (animacja skończona)
}
// Cel bota (wywołuje go Wejscie co klatkę): nuta pod JEGO linią albo najbliższa, do której podjeżdża.
// Tryb klawiatury „Do nuty” (gracze nie zdążali na czas dojechać do nuty): naciśnięcie ↑/↓ pyta,
// dokąd skoczyć. Od nuty pod linią przez dwa takty naprzód: pierwsza w czasie nuta, która leży w kierunku klawisza
// (co najmniej 0,4 półtonu dalej). Wynik w jednostkach Wejścia (przechył przed odwróceniem), null = zwykły ruch.
// „Skok do nuty” gracza grającego tą klawiaturą: w piosence z jej startu, poza nią z karty (albo z ustawień gry).
function klawDoNutyZrodla(zrodlo){
  const g=zrodlo!=null&&S.gracze.find(x=>x.id===zrodlo);
  if(!g)return !!S.ust.klawDoNuty;
  return S.gra&&g.pomoceGry?!!g.pomoceGry.klawDoNuty:pomoceGracza(g).klawDoNuty;
}
function celKlawiatury(id,kier,pitch){
  if(!S.gra||S.pauza||(S.ekran!=="gra"&&S.ekran!=="odliczanie"))return null;
  const g=S.gracze.find(x=>x.id===id);if(!g||!g.tor)return null;
  const G=S.gra,def=g.tor.def,sgn=S.ust.odwroc?-1:1;
  const naPitch=m=>poltonNaStopnie(m,S.ust.zakres,def.lo,def.hi)*sgn;
  const prog=.4*Math.abs(naPitch(def.hi)-naPitch(def.lo))/Math.max(1,def.hi-def.lo);
  const b=Math.max(0,G.beat),kon=b+2*G.metrum;
  for(const n of def.nuty){
    if(n.t+n.d<=b)continue;if(n.t>kon)break;
    const p=naPitch(n.m);if((p-pitch)*kier>prog)return p;
  }
  return null;
}
function celBota(w){
  if(!S.gra||S.pauza||(S.ekran!=="gra"&&S.ekran!=="odliczanie"))return null;
  const g=S.gracze.find(x=>x.id===w.id);if(!g||!g.tor)return null;
  const G=S.gra,def=g.tor.def,sPerBeat=60/G.bpm;
  const b=G.beat-(g.offMs/1000+w._bot.opoznienie)/sPerBeat;
  const naStopnie=s=>poltonNaStopnie(s,S.ust.zakres,def.lo,def.hi)*(S.ust.odwroc?-1:1);
  return celBotaNaNutach(def.nuty,b,sPerBeat,naStopnie);
}
// Cel bota na nutach partii w chwili `b` (ćwierćnuty): nuta pod linią i następna (czytanie z wyprzedzeniem).
// Wspólne dla gry i symulacji kalibracyjnej (tools/ribbitbeat_kalibracja.mjs).
function celBotaNaNutach(nuty,b,sPerBeat,naStopnie){
  const i=indeksNutyPod(nuty,b),j=indeksNastepnej(nuty,b);
  const nastepny=j>=0?nuty[j].m:null,nastepnyZa=j>=0?(nuty[j].t-b)*sPerBeat:null;
  if(i>=0){const n=nuty[i];
    return {idx:i,polton:celNuty(n,b),doKonca:(n.t+n.d-b)*sPerBeat,dlugosc:n.d,dlugoscSek:n.d*sPerBeat,postep:(b-n.t)/n.d,
      nastepny,nastepnyZa,naStopnie};}
  return {idx:null,polton:nastepny,doKonca:0,dlugosc:0,postep:0,nastepny,nastepnyZa,naStopnie};
}
function graKrok(dt,czesciowy){
  const G=S.gra,sPerBeat=60/G.bpm,przed=G.beat;
  G.beat+=dt/sPerBeat;
  if(przed<-1&&G.beat>=-1)G.blyskTeraz=3;   // „1”: linia „teraz” błyska limonką
  if(S.ekran==="odliczanie"&&G.beat>=0){
    S.ekran="gra";G.blyskTeraz=3;
    if(!ruchOgraniczony())el("hud").animate([{transform:"translateY(0)"},{transform:"translateY(-6px)",offset:.35},{transform:"translateY(0)"}],{duration:220});
  }
  // koniec piosenki: w 2 ćwierćnutach ciszy naklejka „Koniec!” na torach i fala widowni
  if(G.koniecOd==null&&G.beat>=G.piosenka.koniec){G.koniecOd=performance.now();G.fala=G.koniecOd;}
  for(const tor of G.tory)for(const g of tor.gracze)krokGracza(g,tor,dt,sPerBeat);
  // żaba-duch: w odliczaniu i przez 2 pierwsze takty, dopóki ktoś na torze nie zaśpiewał (jak naklejka M1)
  for(const t of G.tory)if(t.duch){
    krokDucha(t.duch,t.def.nuty,G.beat,dt);
    const widac=G.beat<2*G.metrum&&t.gracze.some(g=>potrzebujePodpowiedzi(g));
    t.duch.alfa=wygladzEMA(t.duch.alfa,widac?ZC_DUCH_ALFA:0,dt,.12);
  }
  let ogien=0;
  for(const t of G.tory){t.ogien=0;for(const g of t.gracze)t.ogien=Math.max(t.ogien,g.ogien||0);ogien=Math.max(ogien,t.ogien);}
  if(G.ogien!==ogien){G.ogien=ogien;el("gra").dataset.ogien=String(ogien);}
  if(!czesciowy)planujDzwieki(G,sPerBeat);   // podkroki nadrabiania (krok) planują dopiero na końcu: „za ile” liczy się od TERAZ
  G.skokWidowni*=Math.exp(-dt/.28);
  if(G.beat>G.piosenka.koniec+2)zakonczGre();
}
// ŚLAD I WYPEŁNIENIE TAŚMY PISZĄ SIĘ W CZASIE GRACZA (`b1` = zegar gry − „Opóźnienie kapsli”), tym samym, w którym
// liczy się ocena. Do 10-20 szły po zegarze gry, a ocena po czasie gracza, więc u kapsla (150 ms) wszystko, co widać,
// stało o jedną trzecią ćwierćnuty obok nut, które ocenia. Pomiar 10-20 (bot Mistrz jako model dobrego gracza,
// Korobeiniki melodia, 132 BPM, cała piosenka, ta sama partia raz z offMs 0, raz 150): punkty i oceny nut identyczne,
// ale ślad leżał na nucie przez 54 % czasu zamiast 95 %, przez 33 % klatek nad INNĄ nutą niż oceniana, a taśma dawała
// się pomalować tylko w 64,5 % (reszta farby wypadała za koniec nuty i ginęła w przycięciu w `rysujTor`). Gorzej:
// kto celował okiem — żaba na nucie przy linii „teraz” — ten grał o te 150 ms za wcześnie i tracił punkty, bo obraz
// uczył czegoś innego, niż liczy punktacja. Ślad kończy się teraz 150 ms przed linią, czyli pod głową żaby
// (37 px przy 132 BPM, głowa sięga ±37 px); dźwięk zostaje na żywo, bo zagrać wstecz się nie da.
function dopiszSlad(sl,b,semi,spiewa,dlugosc){
  if(!sl.length||b-sl[sl.length-1].b>=1/40)sl.push({b,s:semi,sp:spiewa});
  const granica=b-dlugosc;
  while(sl.length&&sl[0].b<granica)sl.shift();
  return sl;
}
// Wypełnienie taśmy nuty: odcinek [b − dB, b] z klasą celności klatki; ciągły odcinek tej
// samej klasy się wydłuża, więc nuta ma ich zwykle kilka. `b` w czasie gracza, więc odcinki leżą w oknie swojej nuty.
function dopiszWypelnienie(sg,b,dB,k){
  const ost=sg[sg.length-1];
  if(ost&&ost.k===k&&b-dB-ost.do<.02)ost.do=b;else sg.push({od:b-dB,do:b,k});
  return sg;
}
function krokGracza(g,tor,dt,sPerBeat){
  const G=S.gra,def=tor.def,w=zrodloGracza(g);
  g.deg=wygladzEMA(g.deg,(w?w.pitch:0)*(S.ust.odwroc?-1:1),dt,.06);
  const b1=G.beat-g.offMs/1000/sPerBeat,idx=indeksNutyPod(def.nuty,b1);
  let semi=stopnieNaPolton(g.deg,S.ust.zakres,def.lo,def.hi);
  // 10-18: poziom „Przyciągania do nut” ustalony na starcie piosenki (ZC_POMOC.POZIOMY); od 10-18 wieczór własny gracza,
  // a od 10-20 u bota to zatrzask jego poziomu (wejscie.js: POZIOMY_BOTOW.zatrzask), nie pomoc z ustawień
  const pp=g.przyciaganie!==undefined?g.przyciaganie:G.przyciaganie;
  if(pp&&idx>=0)semi=przyciagnijDoNuty(semi,celNuty(def.nuty[idx],b1),pp.zasieg,pp.sila,pp.pas);
  g.polton=semi;
  g.poz=Math.max(0,Math.min(1,(semi-(def.lo-2))/(def.hi-def.lo+4)));
  const zyje=!!w&&(w.zrodlo!=="kapsel"||w.swiezy),wcisniety=zyje&&!!w.przycisk;
  if(wcisniety!==g.przyciskPrzed){zarejestrujKlik(g,tor,b1,sPerBeat,wcisniety);g.przyciskPrzed=wcisniety;}
  // Rechot w pauzie (runda 3, dozwolone wygłupy bez punktów i bez kary): przycisk bez nuty pod linią to krótkie
  // „kum” (krokKum: od razu, potem co 0,5 s, po 2 s co 0,7 s), w obu trybach śpiewu. Każde „kum” bierze
  // BIEŻĄCĄ wysokość z przechyłu (półtony od środka partii, ±18), więc rechotem da się grać.
  const gada=wcisniety&&wPauzie(def.nuty,b1);
  g.spiewa=zyje&&!gada&&(spiewaSamaGracza(g)?idx>=0:wcisniety);
  g.gada=gada;
  if(gada){
    const przed=g.gadanie;g.gadanie+=dt;g.kumWiek+=dt;
    const k=krokKum(g.kum,dt);g.kum={ciag:k.ciag,za:k.za};
    if(k.kum){
      Glos.kum(0,(g.nrWTorze%4)*14,wysokoscRechotu(semi,def.lo,def.hi));g.kumWiek=0;g.rechot=1;
      // dymek „kum”: przy jednej żabie zawsze, w chórze najwyżej raz na 2 s na tor (nie zalewa ekranu)
      const teraz=performance.now();
      if(tor.gracze.length===1||teraz-(tor.ostKum||-1e9)>=2000){popup(g,T.kum,"kum");tor.ostKum=teraz;}
    }
  }else{g.kum.ciag=0;g.kum.za=0;}
  g.rechot=Math.max(0,(g.rechot||0)-dt/.25);
  if(g.spiewa&&idx>=0)g.zaspiewal=true;
  g.idxPod=idx;
  g.naNucie=g.spiewa&&idx>=0&&Math.abs(semi-celNuty(def.nuty[idx],b1))<=ZC_NA_NUCIE;
  g.halo=wygladzEMA(g.halo||0,g.naNucie?1:0,dt,.05);   // halo „na nucie” wokół głowy: ~0,15 s, nie miga na granicach nut
  // wypełnienie taśmy klasą celności klatki, w czasie gracza (dopiszWypelnienie)
  if(g.spiewa&&idx>=0)dopiszWypelnienie(g.wypel[idx]||(g.wypel[idx]=[]),b1,dt/sPerBeat,klasaKlatki(semi-celNuty(def.nuty[idx],b1)));
  const wib=!!w&&Math.abs(w.twist||0)>=ZC_PUNKTY.WIB_PROG;
  const r=klatkaNaNutach(def.nuty,g.ptr,g.ak,g.pb,b1,g.spiewa,semi,wib);
  g.ptr=r.i;g.pb=b1;
  for(const z of r.zamkniete)zamknijNute(g,tor,z);
  g.wib=wygladzEMA(g.wib,Math.min(50,Math.abs(w?w.twist:0)/6),dt,.12);
  // nuty piosenki wokół linii: na nich staje głos w trybie „skokowo” (nutyGlosu; płynnie głos ich nie czyta)
  if(g.glos){g.glos.ustaw(semi,.35+.5*g.poz,g.wib,undefined,nutyGlosu(def.nuty,idx,b1,g.nutyGlosu||(g.nutyGlosu=[])));g.glos.spiewaj(g.spiewa);}
  g.potrzas=Math.max(0,g.potrzas-dt*2.5);
  dopiszSlad(g.slad,b1,semi,g.spiewa,ZC_SLAD_SEK/sPerBeat);
}
function zamknijNute(g,tor,z){
  const G=S.gra,n=tor.def.nuty[z.idx],r=rozliczNute(g.kombo,z.wynik,z.spiewal,n.d,z.wibrato,g.mnPunktow||G.mnPunktow),teraz=performance.now();
  g.kombo=r.kombo;g.maxKombo=Math.max(g.maxKombo,r.kombo);g.mnoznik=r.mnoznik;g.punkty+=r.punkty;g.oceny[r.ocena]++;
  g.zamknieteNut++;g.ogien=poziomOgnia(g.kombo);
  g.wyniki[z.idx]={wynik:z.spiewal?z.wynik:0,ocena:r.ocena,punkty:r.punkty,wibrato:r.wibrato,mnoznik:r.mnoznik};
  wyplacKlik(g,tor,z.idx);
  rozliczSekcje(g,tor,z.idx,r,teraz);   // świecąca fraza (10-10)
  // seria „w punkt” pęka na nucie zamkniętej bez trafnego naciśnięcia (o puszczeniu po końcu nuty decyduje wyplacWPunkt:
  // zaczyna serię od 1, gdy poprzednia nuta nie była w punkt)
  {const k=g.klik[z.idx];if(!k||!(k.w==="idealnie"||k.w==="dobrze"))g.seriaWPunkt=0;}
  // naklejka toru: średnia z żab, które już zamknęły tę nutę
  let s=0,ile=0,spiewal=false,wibrato=false;const oceny=[];
  for(const x of tor.gracze){const wx=x.wyniki[z.idx];if(!wx)continue;
    ile++;s+=wx.wynik;oceny.push(wx.ocena);if(wx.ocena!=="pudlo")spiewal=true;if(wx.wibrato)wibrato=true;}
  tor.oceny[z.idx]={ocena:ocenaNuty(s/ile,spiewal),ile,srednia:s/ile,wibrato};
  if(ile===tor.gracze.length&&ile>=2)zamknijNuteChoru(tor,z.idx,oceny,teraz);
  if(r.wibrato){g.wibrata++;popup(g,T.wibrato,"wibrato");}
  // lecące punkty przy żabie (pudło cicho, fałsz ma już dymek, potrząśnięcie i teraz błysk obrzeża toru)
  if(r.ocena!=="pudlo"&&r.ocena!=="falsz"&&r.punkty>0){
    G.loty.push({g,tor,punkty:r.punkty,mnoznik:r.mnoznik,ocena:r.ocena,od:teraz,nr:g.zamknieteNut});
    if(G.loty.length>32)G.loty.shift();
  }
  if(r.ocena==="falsz"){
    g.potrzas=1;popup(g,T.ocena_falsz,"falsz");tor.blysk=2;
    if(teraz-G.ostRechot>220){Glos.rechot();G.ostRechot=teraz;}
  }
  if(r.kombo>0&&r.kombo%ZC_PUNKTY.KOMBO_CO===0){
    G.skokWidowni=1;
    popup(g,tt("komboPopup",{n:r.kombo}),"kombo",r.kombo);
    if(teraz-G.ostRribbit>180){Glos.rribbit();G.ostRribbit=teraz;}
  }
}
// Krawędź przycisku gracza (naciśnięcie albo puszczenie) w jego czasie b1: przypisanie do nuty, ocena pierwszej
// krawędzi w oknie tej nuty i wypłata, gdy nuta jest już zamknięta (puszczenie przychodzi zwykle po jej końcu).
function zarejestrujKlik(g,tor,b1,sPerBeat,wcisniety){
  const m=dopasujKlik(tor.def.nuty,b1,sPerBeat,wcisniety?"wejscie":"zejscie");if(!m)return;
  const k=g.klik[m.idx]||(g.klik[m.idx]={}),pole=wcisniety?"w":"z";
  if(k[pole])return;   // liczy się pierwsza krawędź w oknie nuty
  k[pole]=ocenaKliku(m.dt);k[pole+"dt"]=+m.dt.toFixed(3);
  if(k[pole]==="obok"){g.seriaKlik=0;g.seriaWPunkt=0;}
  wyplacKlik(g,tor,m.idx);
}
function wyplacKlik(g,tor,idx){
  const k=g.klik[idx],wx=g.wyniki[idx];if(!k||!wx||!ZC_KLIK.OCENY_Z_PREMIA.includes(wx.ocena))return;
  const n=tor.def.nuty[idx];
  for(const pole of ["w","z"]){
    const oc=k[pole];if(!ZC_KLIK.PREMIA[oc]||k[pole+"p"])continue;
    const pkt=premiaKliku(oc,wx.mnoznik||1,n.d,g.mnPunktow||(S.gra&&S.gra.mnPunktow));
    k[pole+"p"]=pkt;g.punkty+=pkt;g.premiaKlik+=pkt;g.kliki[oc]++;g.seriaKlik++;
    if(g.seriaKlik%ZC_KLIK.SERIA===0)popup(g,tt("klikPopup",{n:g.seriaKlik}),"klik",g.seriaKlik);
  }
  const wp=ocenaWPunkt(k.w,k.z);
  if(wp&&!k.wpkt)wyplacWPunkt(g,tor,idx,wp,wx,n);   // k.wp to premia za krawędź „w” (pole+"p"), stąd wpkt
}
// Nuta „w punkt”: seria rośnie, gdy poprzednia nuta partii też była w punkt (inaczej zaczyna się od 1), premia idzie do
// punktów i premiaKlik, a na torze zostaje stempel i spinacz (rysujStemple, rysujTor).
function wyplacWPunkt(g,tor,idx,oc,wx,n){
  const G=S.gra,k=g.klik[idx];
  g.seriaWPunkt=g.ostWPunkt===idx-1&&g.seriaWPunkt>0?g.seriaWPunkt+1:1;g.ostWPunkt=idx;
  g.najSeriaWPunkt=Math.max(g.najSeriaWPunkt,g.seriaWPunkt);
  const pkt=Math.round(premiaWPunkt(oc,g.seriaWPunkt,wx.mnoznik||1,n.d)*(g.mnPunktow||(G&&G.mnPunktow)||1));
  k.wpkt=pkt;k.wpktOc=oc;g.punkty+=pkt;g.premiaKlik+=pkt;g.wPunkt++;
  if(!G)return;
  const teraz=performance.now();
  (G.stemple||(G.stemple=[])).push({g,tor,idx,oc,seria:g.seriaWPunkt,pkt,od:teraz});
  if(G.stemple.length>16)G.stemple.shift();
  G.loty.push({g,tor,punkty:pkt,mnoznik:1,ocena:"wpunkt",kolor:ZC_WPUNKT_KOLOR,od:teraz,nr:g.zamknieteNut+1});
  if(G.loty.length>32)G.loty.shift();
  try{Glos.gwiazdka(Math.min(5,1+Math.floor((g.seriaWPunkt-1)/2)));}catch(e){}
}
// Ostatnia żaba toru zamknęła nutę: jeśli wszystkie na „Czysto”, cały chór dostaje premię, widownia
// robi falę, a co czwarta taka nuta z rzędu kończy się akordem trąbek.
function zamknijNuteChoru(tor,idx,oceny,teraz){
  const G=S.gra,premia=premiaChoru(oceny);
  if(!premia){tor.wJednymGlosie=0;return;}
  for(const x of tor.gracze){const b=Math.round(x.wyniki[idx].punkty*premia);x.punkty+=b;x.premiaChoru+=b;}
  tor.wJednymGlosie++;tor.oceny[idx].wJednymGlosie=true;
  popup(tor.gracze[0],T.wJednymGlosie,"chor");
  G.fala=teraz;
  if(tor.wJednymGlosie%4===0)Glos.akord();
}
// Dymki: tego samego rodzaju na tym samym torze w oknie 150 ms łączą się w jeden („Kombo 16! ×3”,
// „Fałsz ×2”), zawsze nad liderem toru; dymki różnych rodzajów układają się jeden nad drugim.
// `waga` wybiera tekst przy scalaniu (wyższe kombo wygrywa).
function popup(g,tekst,rodzaj,waga){
  const G=S.gra,teraz=performance.now(),tor=g.tor;
  const d=znajdzDoScalenia(G.popupy,tor,rodzaj,teraz,ZC_SCALANIE_MS);
  if(d){d.ile++;if((waga||0)>d.waga){d.waga=waga||0;d.tekst=tekst;}return;}
  // miejsce: najniższe wolne wśród żyjących dymków toru, więc nawet gasnący dymek nie wchodzi na nowy;
  // tor ma ich tyle, ile mieści się bez nakładek (miaraDymkow), a gdy wszystkie zajęte, najstarszy
  // (już gasnący) dymek ustępuje miejsca nowemu
  const zywe=G.popupy.filter(p=>p.tor===tor&&teraz-p.od<p.zycie),zajete=new Set(zywe.map(p=>p.stos));
  let stos=0;while(zajete.has(stos))stos++;
  const L=R.tory.find(l=>l.tor===tor),miejsc=L?miaraDymkow(L).miejsc:Infinity;
  if(stos>=miejsc&&zywe.length){
    const naj=zywe.reduce((a,b)=>b.od<a.od?b:a);
    stos=naj.stos;G.popupy.splice(G.popupy.indexOf(naj),1);
  }
  G.popupy.push({tor,tekst,rodzaj,waga:waga||0,ile:1,od:teraz,zycie:1000,stos});
  if(G.popupy.length>24)G.popupy.shift();
}
// Dźwięki z wyprzedzeniem ZC_ZEGAR.WYPRZEDZENIE na zegarze AudioContext. Wskaźniki idą do przodu ZAWSZE, także
// w ciszy (ZC.ff, przeglądarka bez gestu), więc po powrocie dźwięku nic nie wybucha zaległościami.
const ZC_ZEGAR={WYPRZEDZENIE:.4,   // s: nuty zaplanowane na zegarze audio tyle naprzód (zacięcie klatki do 0,4 s bez dziury w dźwięku)
  PODKROK:.05,                      // s: najdłuższy krok symulacji (okna ocen liczą się jak przy 20 fps i lepiej)
  MAKS_NADROBIENIE:.6};             // s: tyle gra nadrabia po jednym zacięciu, nadmiar odpuszcza (karta w tle = pauza)
function planujDzwieki(G,sPerBeat){
  // pakiet z audio: „za ile” przez mapę czasu nagrania, a głośności ścieżek MIDI z układu miksu (pakiet-piosenki.js)
  const pakiet=typeof PakietPiosenki!=="undefined",zaPakietu=pakiet?PakietPiosenki.za(G,sPerBeat):null;
  if(pakiet)PakietPiosenki.podklad(G);
  const horyzont=G.beat+ZC_ZEGAR.WYPRZEDZENIE/sPerBeat,za=zaPakietu||(b=>(b-G.beat)*sPerBeat);
  while(G.ptrKlik<G.kliki.length&&G.kliki[G.ptrKlik]<horyzont){
    const b=G.kliki[G.ptrKlik++];if(za(b)>-.05)Glos.klik(b===-4,za(b));
  }
  for(const o of G.odchrzakniecia)if(!o.zagrane&&o.b<horyzont){o.zagrane=true;if(za(o.b)>-.05)Glos.odchrzakniecie(za(o.b),o.przes);}
  const planuj=(pk,instr,podp)=>{   // pk.poziom: tło piosenki gra ciszej
    while(pk.ptr<pk.nuty.length&&pk.nuty[pk.ptr].t<horyzont){
      const n=pk.nuty[pk.ptr++];
      if(!(za(n.t)>-.05&&pk.poziom!==0))continue;   // 0: ścieżka wyciszona układem miksu
      const pr=n.p!=null?n.p:pk.program;   // 11-19: instrument z pliku: nuty tła niosą własny, partia ma jeden
      Glos.nuta(podp?instr:barwaPodkladu(instr,n.m,pr),n.m,za(n.t),n.d*sPerBeat*.95,podp,podp?pk.poziom:poziomPodkladu(pk.poziom,n.m,pr));
    }
  };
  // perkusja z pliku: tylko gdy gra też podkład z nut (paczka z własnym nagraniem wycisza nuty, więc i bębny)
  const pe=G.perkusja;
  if(pe&&pe.nuty.length){
    const gra=!G.podklad.length||G.podklad.some(pk=>pk.poziom!==0);
    while(pe.ptr<pe.nuty.length&&pe.nuty[pe.ptr].t<horyzont){
      const n=pe.nuty[pe.ptr++];
      if(gra&&za(n.t)>-.05)Glos.bebny(n.typ,za(n.t),ZC_PERKUSJA_POZIOM*(.45+.55*n.v));
    }
  }
  for(const pk of G.podklad)planuj(pk,G.instrPodkladu||S.ust.instrument,false);
  for(const pk of G.podpowiedz)planuj(pk,"flute",true);
}
function zakonczGre(){
  for(const g of S.gracze){if(g.glos){g.glos.zniszcz();g.glos=null;}}
  const lista=S.gracze.map(g=>{
    g.premia=premiaKoncowa(g.oceny,g.maks);g.punkty+=g.premia;
    const celnosc=celnoscGracza(g.wyniki,g.tor.def.nuty.length);
    const procent=procentSpiewu(g.punkty,g.premiaChoru,g.premiaKlik,g.maks.razem);   // gwiazdki mówią o śpiewie
    const nut=g.tor.def.nuty.length;
    return {id:g.id,punkty:g.punkty,premia:g.premia,premiaChoru:g.premiaChoru,celnosc,procent,gwiazdki:gwiazdki(procent),
      maxKombo:g.maxKombo,falsze:g.oceny.falsz,gadanie:g.gadanie,wibrata:g.wibrata,oceny:Object.assign({},g.oceny),
      partia:g.tor.partia,maks:g.maks.razem,precyzja:precyzjaZOcen(g.oceny,nut),premiaKlik:g.premiaKlik||0,
      kliki:Object.assign({},g.kliki),wPunkt:g.wPunkt|0,najSeriaWPunkt:g.najSeriaWPunkt|0,
      trafione:(g.oceny.czysto||0)+(g.oceny.dobrze||0),nut,trudnosc:g.tor.trudnosc};
  });
  const sumaP=lista.reduce((s,x)=>s+x.punkty-(x.premiaChoru||0)-(x.premiaKlik||0),0),sumaM=lista.reduce((s,x)=>s+x.maks,0);
  const procent=sumaM?Math.max(0,Math.min(100,100*sumaP/sumaM)):0;   // chór jak gracz: sam śpiew
  // tablica wyników: wiersz na każdego gracza (tablica.js), miejsce na tablicy w tej partii i konfiguracji
  let tablica={};
  // 10-19: w trybie oszusta (js/tryb-oszusta.js) gra nie trafia na tablicę, a Postepy.poGrze nic nie przyznaje
  const oszust=typeof TrybOszusta!=="undefined"&&TrybOszusta.aktywny;
  if(!oszust)try{tablica=Tablica.zapiszGre(S.gra,lista)||{};}catch(e){console.warn("tablica wyników",e);}
  // postępy ludzi (boty nie zbierają): liczniki, osiągnięcia, sława w czterech torach i awanse; raz na zakończoną
  // piosenkę. Utwór z pakietu MIDI ma licencję typu „pakiet” z id pakietu (licencjaWpisu w pakiety.js): z niego
  // tło dostaje premię za pakiet, a liczniki zbierają różne pakiety; data = chwila końca (dzień i godzina lokalne).
  let osiagniecia=[];
  const licGry=S.gra.piosenka.licencja,zPakietu=!!(licGry&&licGry.typ==="pakiet");
  try{osiagniecia=Postepy.poGrze(S.gracze.map(g=>({id:g.id,nazwa:g.nazwa,nazwaWlasna:!!g.nazwaWlasna,zrodlo:g.zrodlo,
      instrument:g.instrument||instrumentGracza(g),poziom:g.poziom||null})),lista,
    {piosenka:S.gra.piosenka.id,dlugoscSek:S.gra.piosenka.koniec*60/S.gra.bpm,tryb:S.ust.tryb,czasNaRuch:procentRuchu(S.ust.czasNaRuch),
      liczbaGraczy:S.gracze.length,pakiet:zPakietu,pakietId:zPakietu&&licGry.pakiet?String(licGry.pakiet):null,data:Date.now()});}
  catch(e){console.warn("RibbitBeat: postępy",e);}
  // solista: zamiast nagród rekord, czyli najlepszy wcześniejszy wynik ludzi z tablicy w tej samej partii
  // i konfiguracji (inne tempo albo tryb to inna konkurencja)
  let rekord=null;
  // 10-18 (Z-29): bot nie trafia do tablicy, więc jego „rekord” byłby zawsze nowy; solowy bot bez naklejki rekordu
  if(!oszust&&lista.length===1&&(S.gracze.find(g=>g.id===lista[0].id)||{}).zrodlo!=="bot"){
    const t=tablica[lista[0].id],poprzedni=t&&t.rekord?t.rekord.punkty:0,dzis=lista[0].punkty;
    rekord={punkty:Math.max(poprzedni,dzis),nowy:dzis>poprzedni,poprzedni,dzis};
  }
  // aplauz kapslem (recenzja 2): 5 s braw; boty klaszczą po swojemu (los z ziarna gry)
  const boty={};
  for(const g of S.gracze)if(g.zrodlo==="bot")boty[g.id]={amp:60+losujGre()*200,faza:losujGre()*6.28,trwa:2+losujGre()*2.5};
  S.aplauzRuch=0;S.aplauzKlawisze={};
  S.wyniki={ranking:rankingGraczy(lista),lista,wg:"punkty",tablica,nagrody:przyznajNagrody(lista),procent,gwiazdki:gwiazdki(procent),
    od:performance.now(),rekord,osiagniecia,aplauz:{sumy:{},glos:0,koniec:false,nagroda:null,boty,konfetti:[],doKonfetti:0,ostFala:-1e9,
      zOgnia:Math.min(400,Math.round((R.ogienKonf||0)*.35))}};   // konfetti za ogień głów w piosence (rysujZabe), wysypane w 2,5 s
  R.ogienKonf=0;
  S.ekran="wyniki";
  el("gra").dataset.ogien="0";
  try{Biblioteka.zagrano(S.gra.piosenka.id);}catch(e){}
  odswiezHud();
  // 10-16: jingiel motywu planszy (js/jingle.js); motyw bez jingla = dotychczasowa fanfara
  {const t=S.scena&&S.scena.tlo;if(!(typeof Jingle!=="undefined"&&t&&Jingle.graj(t.id)))Glos.fanfara();}
  pokazWyniki();
}

// ---- HUD (DOM nad sceną) ----
function zbudujHud(G){
  G=G||S.gra;
  el("hudPiosenka").textContent=G.piosenka.tytul;
  const lic=G.piosenka.licencja,hl=el("hudLicencja");
  hl.textContent=lic?liniaAtrybucji(G.piosenka.tytul,lic):"";hl.title=hl.textContent;hl.hidden=!lic;
  el("hud").classList.toggle("ciasny",S.gracze.length>5);   // 6–8 żetonów: bez linii „kombo”, węższy tytuł
  el("hud").dataset.graczy=String(S.gracze.length);   // 1–2 graczy: większe punkty i kapsel (gry-oprawa.css)
  const box=el("hudGracze");box.replaceChildren();
  el("hud").classList.add("bez-rankingu");G.hudRanking={t:0};
  for(const tor of G.tory)for(const g of tor.gracze){
    // Żeton: [miejsce][kapsel] imię + 5 gwiazdek / punkty + ostatni zysk / pasek do następnej gwiazdki + strata do lidera
    // | mnożnik w kolorze stopnia, kreski do następnego mnożnika, linijka „kombo N” (przy maksimum) albo „zerwane!”.
    const chip=h("div","hud-gracz");chip.style.setProperty("--kolor",g.kolor);
    const msc=h("b","hud-miejsce","");
    const kap=h("img","hud-kapsel");kap.src=g.obrazekKapsla||"";kap.alt="";
    const tekst=h("div","hud-tekst"),glowka=h("span","hud-glowka"),aw=h("span","hud-awans","▲");aw.hidden=true;
    glowka.append(h("span","hud-nazwa",g.nazwa),aw);
    if(g.zrodlo==="bot"){const pz=h("span","hud-poziom",nazwaPoziomuBota(g));pz.title=tt("etykietaBota",{poziom:nazwaPoziomuBota(g)});glowka.append(pz);}   // 10-17
    const gw=h("span","hud-gwiazdki");for(let i=0;i<5;i++)gw.append(h("span","hud-gwiazdka","★"));
    glowka.append(gw);
    const pk=h("span","hud-punkty","0"),zy=h("span","hud-zysk","");zy.hidden=true;
    const wiersz=h("span","hud-wiersz");wiersz.append(pk,zy);
    const dg=h("span","hud-dogw"),dgW=h("i","hud-dogw-w");dg.append(dgW);dg.title=T.hudDoGwiazdki;
    const str=h("span","hud-strata",""),stopka=h("span","hud-stopka");stopka.append(dg,str);
    tekst.append(glowka,wiersz,stopka);
    const prawa=h("div","hud-seria"),blok=h("span","hud-seria-blok"),mn=h("b","hud-mnoznik","×1"),pipy=h("span","hud-pipy"),kb=h("span","hud-kombo","");
    mn.dataset.m="1";for(let i=0;i<ZC_PUNKTY.KOMBO_CO;i++)pipy.append(h("i","hud-pip"));
    blok.append(mn,pipy,kb);prawa.append(blok);
    chip.append(msc,kap,tekst,prawa);box.append(chip);
    g.hud={chip,pk,zy,mn,pipy,kb,gw,dgW,str,msc,aw,p:-1,m:-1,k:-1,pp:-1,o:-1,g:-1,dg:-1,ms:0,st:null};
  }
  // pasek postępu: kreska co takt (co 4 takty przy dłuższej piosence) i żaba jadąca po pasku
  const pas=el("hudPasek").parentNode,takty=Math.max(1,G.piosenka.koniec/G.metrum),co=takty>32?4:1;
  pas.style.setProperty("--kreska",(100*co/takty).toFixed(4)+"%");
  let zb=pas.querySelector(".hud-postep-zaba");
  if(!zb){zb=h("img","hud-postep-zaba");zb.src=ZC_ZASOBY.zaby[2];zb.alt="";pas.append(zb);}
  zb.style.left="0%";zb.dataset.p="0";
}
// Ostatni zysk obok punktów („+276”): wskakuje przy trafieniu i gaśnie po chwili. Kilka zysków jeden po drugim (klik na
// początku nuty, nuta, klik na końcu) sumuje się w jednej naklejce, a po 1,5 s ciągłego świecenia liczy od nowa.
function pokazZyskHud(d,zysk){
  const teraz=performance.now(),trwa=!d.zy.hidden&&teraz-(d.zyOd||0)<1500;
  if(!trwa){d.zyOd=teraz;d.zySuma=0;}
  d.zySuma+=zysk;d.zy.textContent="+"+fmtLiczba(d.zySuma);d.zy.hidden=false;
  if(!trwa&&!ruchOgraniczony())d.zy.animate([{transform:"rotate(-3deg) translateY(6px) scale(.6)",opacity:0},{transform:"rotate(-3deg)",opacity:1}],{duration:150,easing:"cubic-bezier(.2,.8,.2,1)"});
  clearTimeout(d.zyT);d.zyT=setTimeout(()=>{d.zy.hidden=true;},800);
}
// Ranking na żywo w HUD (2+ graczy): żetony stoją w kolejności punktów, każdy ma numer miejsca, a poza liderem stratę
// do niego. Stratę przepisujemy przy każdej zmianie punktów; kolejność najwyżej co 0,5 s, żeby dwie żaby idące łeb w łeb
// nie przeskakiwały co nutę. Przestawienie to własność `order` i krótki przejazd z dawnego miejsca, bez ruszania drzewa
// DOM (żeton zostaje tym samym elementem dla odswiezHud i samouczka). Przed pierwszym punktem rankingu nie ma.
function odswiezRankingHud(G){
  const gr=S.gracze.filter(g=>g.hud);if(gr.length<2)return;
  if(!gr.some(g=>g.punkty>0))return;
  el("hud").classList.remove("bez-rankingu");
  const rk=G.hudRanking||(G.hudRanking={t:0}),teraz=performance.now();
  if(!rk.t||teraz-rk.t>=500){
    const po=gr.slice().sort((a,b)=>b.punkty-a.punkty||(a.hud.ms||99)-(b.hud.ms||99));
    if(po.some((g,i)=>g.hud.ms!==i+1)){
      rk.t=teraz;
      const ruch=!ruchOgraniczony()&&po.some(g=>g.hud.ms),przed=ruch?po.map(g=>g.hud.chip.getBoundingClientRect().left):null;
      po.forEach((g,i)=>{
        const d=g.hud,ms=i+1;
        if(d.ms&&ms<d.ms){d.aw.hidden=false;clearTimeout(d.awT);d.awT=setTimeout(()=>{d.aw.hidden=true;},1500);}   // ▲ = właśnie wyprzedził
        d.ms=ms;d.chip.style.order=String(ms);d.msc.textContent=String(ms);d.msc.title=tt("hudMiejsce",{n:ms});d.chip.classList.toggle("lider",ms===1);
      });
      if(ruch)po.forEach((g,i)=>{
        const dx=przed[i]-g.hud.chip.getBoundingClientRect().left;
        if(Math.abs(dx)>1)g.hud.chip.animate([{transform:"translateX("+dx+"px)"},{transform:"none"}],{duration:260,easing:"cubic-bezier(.2,.8,.2,1)"});
      });
    }
  }
  const lider=gr.find(g=>g.hud.ms===1)||gr[0];
  for(const g of gr){
    const d=g.hud,strata=Math.max(0,lider.punkty-g.punkty),tx=g===lider?T.hudLider:"−"+fmtLiczba(strata);
    if(d.st!==tx){d.str.textContent=tx;d.str.classList.toggle("lider",g===lider);d.str.title=g===lider?"":tt("hudStrata",{n:fmtLiczba(strata)});d.st=tx;}
  }
}
function odswiezHud(){
  const G=S.gra;if(!G)return;
  let zmiana=false;
  for(const g of S.gracze){
    const d=g.hud;if(!d)continue;
    if(d.p!==g.punkty){
      const zysk=g.punkty-d.p;
      if(d.p>=0&&zysk>0){
        if(!ruchOgraniczony())d.pk.animate([{transform:"translateY(-3px)"},{transform:"none"}],{duration:180});
        pokazZyskHud(d,zysk);
      }
      d.pk.textContent=fmtLiczba(g.punkty);d.p=g.punkty;zmiana=true;
    }
    if(d.m!==g.mnoznik){   // naklejka mnożnika: kolor stopnia z data-m, podskok przy awansie
      if(d.m>=1&&g.mnoznik>d.m&&!ruchOgraniczony())d.mn.animate([{transform:"rotate(-4deg) scale(1.3)"},{transform:"rotate(-4deg)"}],{duration:200,easing:"cubic-bezier(.2,.8,.2,1)"});
      d.mn.textContent="×"+g.mnoznik;d.mn.dataset.m=String(g.mnoznik);d.m=g.mnoznik;
    }
    if(d.k!==g.kombo){
      // kreski: ile trafień z KOMBO_CO do następnego mnożnika; przy maksymalnym mnożniku komplet w złocie
      const maks=g.mnoznik>=ZC_PUNKTY.MNOZNIK_MAKS,pp=maks?ZC_PUNKTY.KOMBO_CO:g.kombo%ZC_PUNKTY.KOMBO_CO;
      if(d.pp!==pp){for(let i=0;i<d.pipy.children.length;i++)d.pipy.children[i].classList.toggle("on",i<pp);d.pp=pp;}
      d.pipy.classList.toggle("maks",maks);
      if(g.kombo===0&&d.k>=2){   // kombo zerwane (fałsz, pudło): napis i różowa obwódka na chwilę, niezależnie od następnych trafień
        clearTimeout(d.kbT);d.zerw=true;d.kb.textContent=T.hudZerwane;d.kb.classList.add("zerwane");d.chip.classList.add("zerwane");
        d.kbT=setTimeout(()=>{d.zerw=false;d.kb.classList.remove("zerwane");d.chip.classList.remove("zerwane");
          d.kb.textContent=g.mnoznik>=ZC_PUNKTY.MNOZNIK_MAKS?tt("komboHud",{n:g.kombo}):"";},900);
      }else if(!d.zerw){
        d.kb.textContent=maks?tt("komboHud",{n:g.kombo}):"";
        if(maks&&g.kombo>d.k&&!ruchOgraniczony())d.kb.animate([{transform:"scale(1)"},{transform:"scale(1.18)",offset:.4},{transform:"scale(1)"}],{duration:160,easing:"linear"});   // tyk
      }
      d.k=g.kombo;
    }
    if(d.o!==g.ogien){d.chip.dataset.ogien=String(g.ogien);d.o=g.ogien;}
    // gwiazdki dotąd (5 miejsc, pełne od lewej) i pasek do następnej; po końcu piosenki (zakonczGre dolicza premię do
    // punktów) gwiazdki prosto z wiersza wyników
    const wW=S.wyniki&&S.wyniki.lista.find(x=>x.id===g.id),premia=wW?0:premiaKoncowa(g.oceny,g.maks),nut=g.tor.def.nuty.length;
    const gw=wW?wW.gwiazdki:gwiazdkiNaZywo(g.punkty,g.premiaChoru,g.premiaKlik,g.maks.razem,premia,g.zamknieteNut,nut,8);
    if(gw!==d.g){
      for(let i=0;i<d.gw.children.length;i++){
        const z=d.gw.children[i],byla=z.classList.contains("pelna");z.classList.toggle("pelna",i<gw);
        if(i<gw&&!byla&&d.g>=0&&!wW&&!ruchOgraniczony())z.animate([{transform:"scale(1.6)",opacity:.4},{transform:"scale(1)",opacity:1}],{duration:200,easing:"cubic-bezier(.2,.8,.2,1)"});
      }
      d.gw.title=gw?tt("hudGwiazdki",{n:gw}):"";d.g=gw;
    }
    // pasek skokami co 2 %: zapis stylu to przemalowanie żetonu
    const dg=wW?(gw>=5?1:d.dg):Math.round(postepGwiazdki(procentNaZywo(g.punkty,g.premiaChoru,g.premiaKlik,g.maks.razem,premia,g.zamknieteNut,nut,8))*50)/50;
    if(dg!==d.dg&&dg>=0){d.dgW.style.transform="scaleX("+dg+")";d.dg=dg;}
  }
  if(zmiana)odswiezRankingHud(G);
  const p=Math.max(0,Math.min(1,G.beat/Math.max(1,G.piosenka.koniec)));
  // pasek i żaba postępu skokami co 0,25 % (10-10, płynność): zapis stylu w każdej klatce to przemalowanie HUD
  // i złożenie ekranu nawet wtedy, gdy zmiana jest mniejsza niż piksel
  const pq=(Math.round(p*400)/400).toFixed(4),pas=el("hudPasek");
  if(pas.dataset.p!==pq){pas.style.transform="scaleX("+pq+")";pas.dataset.p=pq;}
  const zb=document.querySelector(".hud-postep-zaba"),pp=(+pq*100).toFixed(2);
  if(zb&&zb.dataset.p!==pp){zb.style.left=pp+"%";zb.dataset.p=pp;}
  const blok=Glos.zablokowany();
  if(el("hudDzwiek").hidden===blok)el("hudDzwiek").hidden=!blok;
}

// ---- układ i tło statyczne ----
const dprGry=()=>trybWydajny()||(R.autoJakosc||0)>=1?1:Math.min(2,window.devicePixelRatio||1);   // wydajność: 1× (na ekranie 150 % to 2,25 raza mniej pikseli)
// Geometria układu gry G przy danym dolnym brzegu HUD: rozmiary, skala i prostokąty torów. Bez dotykania płócien
// i stanu, bo liczy ją też lobby przed startem (zacznijZawczasu).
function geometriaUkladu(G,hudDol){
  const W=innerWidth,H=innerHeight,dpr=dprGry();
  const f=Math.max(1,Math.min(1.7,H/624));   // skala napisów na płótnie: czytelne z kanapy na 1080 p
  const wid=Math.round(Math.max(54,Math.min(88,H*.09)));
  // rama sceny (pole `rama` stopnia tła): karty torów odsuwają się od brzegów okna i od siebie, żeby scena za nimi
  // była widać także w pasach (1–2 graczy); bez ramy (stopnie 1–2 tła, brak modułu) układ jak dotąd. Linia „teraz”
  // liczy się od dawnego marginesu mx0, więc zostaje w tym samym miejscu karty (ok. 21 % jej szerokości), a nie
  // przesuwa się w lewo o szerszy margines (w siatce wjechałaby na klawiaturę)
  const rama=ramaSceny(),mx0=Math.round(Math.max(14,Math.min(32,W*.016)));
  const mx=rama?Math.round(Math.max(48,Math.min(140,W*(+rama.bok||.07)))):mx0;
  const gora=Math.round(hudDol+8)+(rama?+rama.gora||14:0),dol=H-wid-4-(rama?+rama.dol||10:0);
  const n=G.tory.length,odst=Math.round(Math.max(8,Math.min(16,H*.013)))+(rama?+rama.odstep||6:0);
  const kw=Math.round(Math.max(16,Math.min(30,W*.018)));   // szerokość klawiatury toru
  // Każdy tor ma własny prostokąt (pasy, kolumny albo siatka 2×2), własną linię „teraz” i własną skalę czasu.
  // Pełna szerokość daje dokładnie dawne wartości (linia na 22% okna, 2 takty przed linią); węższy tor
  // pokazuje mniej taktów naprzód, ale nie mniej niż ZC_PX_NA_BEAT_MIN na ćwierćnutę (najwyżej do 1 taktu),
  // bo inaczej krótkie nuty zlewają się w paski.
  const prost=ukladSiatki(n,S.ust.uklad,{x:mx,y:gora,w:W-2*mx,h:dol-gora},odst);
  const tory=G.tory.map((t,i)=>{
    const P=prost[i],y=P.y,wys=P.h,dolN=t.def.lo-2,goraN=t.def.hi+2,rzedy=goraN-dolN+1;
    const teraz=Math.round(P.x+(P.w+2*mx0)*ZC_LINIA_TERAZ-mx0);
    const przed=P.x+P.w-14-teraz,met=G.metrum;
    const pxNaBeat=Math.max(przed/(ZC_TAKTY_NAPRZOD*met),Math.min(ZC_PX_NA_BEAT_MIN,przed/met));
    const padG=Math.round(Math.min(30,Math.max(18,wys*.13))),padD=Math.round(Math.min(10,wys*.05));
    const rh=(wys-padG-padD)/rzedy;
    const zabaBaza=Math.max(30,Math.min(Math.max(70,H*.085),rh*2.4,wys*.42));
    const uk=ukladChoru(t.gracze.length,zabaBaza,teraz-P.x-12-kw-8);   // chór nie siada na klawiaturze
    return {tor:t,x:P.x,y,w:P.w,h:wys,teraz,pxNaBeat,dolN,goraN,rzedy,rh,gorna:y+padG,zaba:uk.zaba,krokX:uk.krok,kx:P.x+9,kw};
  });
  return {W,H,dpr,f,tory,widownia:{y:H-wid,h:wid}};
}
// Trzy płótna pełnoekranowe w rozmiarze układu. `tesame`: przy tym samym rozmiarze zostają, jak są (zmiana width/height
// to nowa pamięć na karcie graficznej, a każde z nich i tak czyści się przed rysowaniem: rysujTlo, zlozTlo, rysujScene).
function rozmiarPlocien(W,H,dpr,tesame){
  R.tloBuf=R.tloBuf||document.createElement("canvas");   // tory i klawiatury raz, na bufor; #tlo składa je z promieniami
  const pw=Math.round(W*dpr),ph=Math.round(H*dpr);
  for(const cv of [R.tlo,R.scena,R.tloBuf])if(!tesame||cv.width!==pw||cv.height!==ph){cv.width=pw;cv.height=ph;}
  R.ctBuf=R.tloBuf.getContext("2d");
}
function ukladGry(o){
  if(!S.gra)return;
  const geo=geometriaUkladu(S.gra,el("hud").getBoundingClientRect().bottom),W=geo.W,H=geo.H,dpr=geo.dpr,tesame=!!(o&&o.zachowaj);
  R.ukladKlucz=[W,H,dpr,S.ust.grafika,S.gra.tory.length].join("#");   // klucz próby generalnej sceny (js/proba-sceny.js): raz na układ w karcie
  rozmiarPlocien(W,H,dpr,tesame);
  R.W=W;R.H=H;R.dpr=dpr;
  if(ZC_DEV.nutyGL&&typeof NutyGL!=="undefined"&&NutyGL.start(R.scena))NutyGL.uklad(W,H,dpr);   // ?nutyGL=1: #scenaPod i #glNuty pod #scena
  R.f=geo.f;R.tory=geo.tory;R.widownia=geo.widownia;
  // Pamięć bitmap między piosenkami (11-18): start piosenki z tym samym odciskiem układu (okno, ustawienia, piosenka,
  // skład, motywy, geometria torów) zostawia bufory i wersję, więc „jeszcze raz” nie buduje wszystkiego od nowa.
  // Każdy inny układ (zmiana okna, ustawień, grafiki) czyści jak dotąd.
  const odc=odciskUkladu(S.gra);
  if(!(tesame&&odc&&odc===R.odcisk)){R.bufor.clear();R.wersja++;R.wzor=null;}
  R.odcisk=odc;
  for(const t of S.gra.tory){t.sprajty=null;t.minione=null;}   // bitmapy nut mają rozmiar w px tego układu
  // bitmapy nut zbudowane z wyprzedzeniem w lobby (zacznijZawczasu) dla dokładnie tego samego układu przechodzą na tory
  // tej gry; przy innym odcisku przepadają i wszystko buduje się pod zasłoną
  const Z=R.zawczasu;R.zawczasu=null;
  if(tesame&&odc&&Z&&Z.odcisk===odc)S.gra.tory.forEach((t,i)=>{const d=Z.G.tory[i];if(d&&d.partia===t.partia&&d.sprajty){t.sprajty=d.sprajty;d.sprajty=null;}});
  // silnik efektów (gl-fx.js): płótna WebGL2 powstają raz, przy pierwszym układzie gry (?gl=0 = tryb 2D), rozmiary
  // przy każdym; cząstki modułów efektów liczą się w px tego układu, więc znikają razem z buforami
  startSilnika();
  fxWolaj("uklad",W,H,dpr);
  for(const t of ZC_TORY_SCENY){const m=modulToru(t);if(m)hakStopnia(t,m,"reset");}
  rysujTlo();
  if(!(o&&o.bezBuforow))przygotujBufory();   // bufory zależą od rozmiaru układu (R.bufor.clear wyżej), więc po każdym układzie od nowa
}
// Odcisk układu: wszystko, od czego zależą bitmapy w R.bufor i pamięci modułów efektów. Ten sam napis = te same bitmapy.
// Liczony z R (po ustawieniu geometrii) i z wartości wyliczanych tak samo w lobby i w grze (partia toru, instrument
// i stopnie gracza z funkcji), a nie z pól, które startGry dopiero ustawia na graczu.
function odciskUkladu(G){
  try{
    const id=w=>w&&w.id||"";
    return JSON.stringify([R.W,R.H,R.dpr,R.f,R.autoJakosc||0,document.documentElement.lang||"",
      document.fonts?document.fonts.status:"",wczytajGrafikiMotywow()?1:0,S.ust,
      G.piosenka&&G.piosenka.id,G.bpm,G.metrum,ZC_TORY_SCENY.map(t=>id(stopienSceny(t))),
      R.tory.map(L=>[L.tor.partia,L.tor.def.lo,L.tor.def.hi,L.tor.def.nuty.length,L.x,L.y,L.w,L.h,L.teraz,L.pxNaBeat,L.rh,L.zaba,L.krokX,L.kw,
        L.tor.gracze.map(g=>[g.id,g.nazwa,g.kolor,g.zrodlo,g.poziom,instrumentGracza(g),
          id(stopienGracza(g,"streak")),id(stopienGracza(g,"klawisze")),id(stopienGracza(g,"widownia")),przebranieGracza(g)||""])])]);
  }catch(e){return null;}
}
const ySemi=(L,s)=>L.gorna+(L.goraN-s+.5)*L.rh;
// Silnik efektów (gl-fx.js) startuje raz. Pomiar 10-09 (GPU Intel, 1707×1067 @1,5, 4 tory): start w klatce „Zagraj”
// (kontekst WebGL2, programy, atlas) dawał zacięcie 76–220 ms na wejściu w odliczanie; ten sam start w menu, w chwili
// bezczynności (startSilnikaWTle z init), zbija je do 30–54 ms. ukladGry woła startSilnika i tak, gdy menu go nie zdążyło.
function startSilnika(){
  if(R.fxStart||typeof FX==="undefined"||!FX)return;
  R.fxStart=true;fxWolaj("start",el("gra"),{gl:ZC_DEV.gl});R.fxPelna=grafikaPelna();fxWolaj("wlacz",R.fxPelna);
}
function startSilnikaWTle(){
  const ric=window.requestIdleCallback||(f=>setTimeout(f,200));
  setTimeout(()=>ric(()=>{if(!R.fxStart&&grafikaPelna())startSilnika();},{timeout:1500}),600);
}
const xBeat=(L,b)=>L.teraz+(b-S.gra.beat)*L.pxNaBeat;
function rysujTlo(){
  const c=R.ctBuf;c.setTransform(R.dpr,0,0,R.dpr,0,0);c.clearRect(0,0,R.W,R.H);
  // stopień tła: prześwit karty (sam prostokąt kraftu, najwyżej 0,5: karta jako szyba nad ilustracją motywu; cień, rzędy, klawiatura i nazwy dźwięków
  // zostają kryjące) oraz `scieg:false`, gdy stopień rysuje ścieg sam co klatkę (hak nadKartami w zlozTlo)
  const sk=R.st=stanKlatki(performance.now()),wt=wpisTla();
  const przeswit=Math.max(0,Math.min(.5,+(wt&&wt.przeswit)||0)),scieg=!(wt&&wt.scieg===false);
  const P=paletaKarty(wt);
  for(const L of R.tory){
    const st=L.tor.styl;
    c.fillStyle=P.cien;c.beginPath();c.roundRect(L.x,L.y+6,L.w,L.h,16);c.fill();   // twardy cień
    c.fillStyle=P.papier;c.globalAlpha=1-przeswit;c.beginPath();c.roundRect(L.x,L.y,L.w,L.h,16);c.fill();c.globalAlpha=1;
    c.save();c.beginPath();c.roundRect(L.x,L.y,L.w,L.h,16);c.clip();
    // faktura karty z motywu (siatka pikseli, kratka, raster): statyczna, raz na układ, pod rzędami i klawiaturą
    if(typeof P.rysuj==="function"){c.save();try{P.rysuj(c,L,sk);}catch(e){bladStopnia("karta|"+(wt&&wt.id),"faktura karty „"+(wt&&wt.id)+"”",e);}c.restore();}
    // rzędy półtonów: czarne klawisze lekko zacienione, kreska pod każdym C
    for(let s=L.dolN;s<=L.goraN;s++){
      const y=ySemi(L,s)-L.rh/2;
      if(isBlack(s)){c.fillStyle=P.czarne;c.fillRect(L.x,y,L.w,L.rh);}
      if(((s%12)+12)%12===0){c.fillStyle=P.liniaC;c.fillRect(L.x,Math.round(y+L.rh)-1,L.w,1);}
    }
    c.fillStyle=P.minione;c.fillRect(L.x,L.y,L.teraz-L.x,L.h);   // co minęło, lekko przygaszone
    // klawiatura: stopień klawiszy toru (lider) rysuje ją sam i dostaje domyślne rysowanie jako czwarty argument;
    // brak haka albo wyjątek w module = domyślna klawiatura
    const wk=wpisKlawiszyToru(L);
    if(!(wk&&wk.tlo&&hakStopnia("klawisze",wk,"tlo",c,L,sk,rysujKlawiature)))rysujKlawiature(c,L);
    // nazwy dźwięków obok klawiatury (wszystkie białe klawisze, gdy jest miejsce; inaczej same C)
    c.font="500 "+Math.max(8,Math.min(11*R.f,L.rh*.8)).toFixed(0)+"px 'JetBrains Mono',monospace";
    c.fillStyle=P.nazwy;c.textBaseline="middle";
    for(let s=L.dolN;s<=L.goraN;s++){
      const pc=((s%12)+12)%12;
      if(isBlack(s)||(L.rh<12&&pc!==0)||L.rh<7)continue;
      c.fillText(nameOf(s)+(pc===0?Math.floor(s/12)-1:""),L.kx+L.kw+7,ySemi(L,s));
    }
    c.restore();
    if(scieg){c.strokeStyle=P.scieg||rgba(st.akcent,.55);c.lineWidth=1.6;c.setLineDash([7,5]);   // ścieg
      c.beginPath();c.roundRect(L.x+6,L.y+6,L.w-12,L.h-12,11);c.stroke();c.setLineDash([]);}
    // linia „teraz”: różowa nić między dwiema szpilkami
    const xt=L.teraz;
    c.strokeStyle=P.nic;c.lineWidth=3;c.setLineDash([9,6]);
    c.beginPath();c.moveTo(xt,L.y+10);c.lineTo(xt,L.y+L.h-10);c.stroke();c.setLineDash([]);
    for(const y of [L.y+9,L.y+L.h-9]){
      c.fillStyle=P.szpilka;c.beginPath();c.arc(xt,y,4.5,0,Math.PI*2);c.fill();
      c.fillStyle=P.szpilkaBlask;c.beginPath();c.arc(xt-1.3,y-1.3,1.4,0,Math.PI*2);c.fill();
    }
  }
  zlozTlo(performance.now());
}
// Promienie i światło sceny przy kombo. Do 10-03 robił to CSS (`.gra::before` 250vmax × 250vmax z gradientem
// stożkowym obracanym animacją): warstwę kilkunastu milionów pikseli przeglądarka rasteryzowała PO RAZ
// PIERWSZY w chwili zapalenia ognia, czyli w klatce, w której gra planuje dźwięk; stąd zacięcie i zgrzyt przy
// pierwszym kombo, a potem obrót ogromnej warstwy co klatkę. Teraz tory leżą w buforze `R.tloBuf`, a #tlo
// składa pod nimi 36 klinów (promienie) i jeden gradient (światło od lewej), tylko dopóki coś się pali.
const ZC_PROMIENIE={ALFA:[0,.22,.48,.8],OBROT:[0,360/28,360/15,360/7],SWIATLO:[0,0,.55,1],   // na poziom ognia 0–3
  KOLORY:[["236,26,131",.55],["234,163,43",.45]],SWIATLO_KOL:["255,216,74","234,163,43"]};   // domyślne; styl streaka sceny może podać własne
// Tło jest STATYCZNE (stałe fps ważniejsze niż ruch sceny):
// #tlo składa się tylko, gdy coś się w nim naprawdę zmieniło (R.tloBrudne: nowy układ, stopień tła gotowy w GL,
// albo jasność promieni/światła ognia przeskoczyła o 1/24), a nie co klatkę. Promienie stoją (bez obrotu), światło
// bez pulsu; jasność wygładza krokPromieni() co klatkę, ale złożenie (pełnoekranowe drawImage + kliny) następuje
// tylko na skokach progu, kilka razy przy zapaleniu i zgaszeniu ognia.
function krokPromieni(teraz){
  const G=S.gra,og=G&&(S.ekran==="gra"||S.ekran==="odliczanie")?(G.ogien||0):0,pelna=grafikaPelna();
  const dt=Math.max(0,Math.min(.1,(teraz-(R.ostTlo||teraz))/1000));R.ostTlo=teraz;
  R.promienie=wygladzEMA(R.promienie||0,pelna?ZC_PROMIENIE.ALFA[og]:0,dt,.7);
  R.swiatlo=wygladzEMA(R.swiatlo||0,pelna?ZC_PROMIENIE.SWIATLO[og]:0,dt,.7);
  const q=v=>v>.004?Math.round(v*24):0,podpis=q(R.promienie)*100+q(R.swiatlo);
  if(podpis!==R.podpisPromieni){R.podpisPromieni=podpis;R.tloBrudne=true;}
}
function zlozTlo(teraz){
  const c=R.ct;if(!R.tloBuf)return;
  R.tloBrudne=false;
  c.setTransform(R.dpr,0,0,R.dpr,0,0);c.clearRect(0,0,R.W,R.H);
  const pelna=grafikaPelna();
  // stopień tła w 2D pod promieniami i kartami, gdy GL tła go nie narysował (R.glTla z tloStatyczne): brak
  // WebGL2, ?gl=0, grafika uproszczona, stopień bez shadera albo program jeszcze się kompiluje (wtedy, gdy będzie
  // gotowy, tloStatyczne podmienia 2D na GL i składa #tlo jeszcze raz)
  const wt=wpisTla(),stk=R.st;
  if(wt&&wt.rysuj2d&&stk&&!R.glTla){c.save();hakStopnia("tlo",wt,"rysuj2d",c,stk);c.restore();}
  if(R.promienie>.004){
    const rr=Math.hypot(R.W,R.H)/2+8,k0=0,d=Math.PI/36;   // klin 5°, okres 20°, nieruchome
    c.save();c.translate(R.W/2,R.H/2);
    const pr=koloryTla("promienie",ZC_PROMIENIE.KOLORY,pelna);
    for(const [nr,kol,al] of [[0,pr[0][0],pr[0][1]],[1,pr[1][0],pr[1][1]]]){
      c.fillStyle="rgba("+kol+","+(al*R.promienie).toFixed(3)+")";c.beginPath();
      for(let i=0;i<18;i++){const a=k0+i*d*4+nr*d;c.moveTo(0,0);c.arc(0,0,rr,a,a+d);c.closePath();}
      c.fill();
    }
    c.restore();
  }
  if(R.swiatlo>.004){
    const rx=R.W*.22,ry=R.H*.55,rad=Math.max(R.W,R.H)*.7;
    const g=c.createRadialGradient(rx,ry,0,rx,ry,rad);
    const sk=koloryTla("swiatlo",ZC_PROMIENIE.SWIATLO_KOL,pelna);
    g.addColorStop(0,"rgba("+sk[0]+","+(.6*R.swiatlo).toFixed(3)+")");g.addColorStop(.35,"rgba("+sk[1]+","+(.28*R.swiatlo).toFixed(3)+")");
    g.addColorStop(.7,"rgba(236,26,131,0)");
    c.fillStyle=g;c.fillRect(0,0,R.W,R.H);
  }
  c.drawImage(R.tloBuf,0,0,R.W,R.H);
  if(wt&&wt.nadKartami&&stk){c.save();hakStopnia("tlo",wt,"nadKartami",c,stk);c.restore();}   // 2D na kartach (np. ścieg), raz na złożenie
}
// Stopień tła w GL rysuje się RAZ na układ (płótno #glTlo trzyma ostatni obraz, dopóki nikt w nim nie rysuje):
// gdy program tła jest gotowy (kompilacja w tle, FX.tlo.gotowy bez czekania), jedno tloKlatka i koniec. Do tego
// czasu (najwyżej 6 s, potem zostaje 2D) #tlo pokazuje wariant 2D stopnia. Sprawdzanie co 10. klatkę, bo każde
// wołanie shadera przed gotowością liczy się w efekty-tlo.js jako „brak” (po 120 program uznany za zły).
function tloStatyczne(w,st,teraz){
  const glMoze=!!st.gl&&!!(w.klatka||(w.shader&&w.shader.id)),T=R.tloStat;
  if(!T||T.w!==w||T.wersja!==R.wersja||T.gl!==glMoze){
    if(R.glTla){const T2=typeof FX!=="undefined"&&FX?FX.tlo:null;if(T2&&typeof T2.wylacz==="function"){try{T2.wylacz();}catch(e){}}}
    R.glTla=false;R.tloBrudne=true;
    R.tloStat={w,wersja:R.wersja,gl:glMoze,gotowe:!glMoze,od:teraz,proby:0};
    return;
  }
  if(T.gotowe)return;
  if(teraz-T.od>6000){T.gotowe=true;return;}   // shader nie zdążył: zostaje wariant 2D
  if((T.proby++)%10)return;
  const T2=typeof FX!=="undefined"&&FX?FX.tlo:null;
  const gotowy=w.klatka||!T2||typeof T2.gotowy!=="function"||T2.gotowy(w.shader.id);
  if(!gotowy){if(!T.zarejestrowany){T.zarejestrowany=true;tloKlatka(w,st);}return;}   // pierwsze wołanie rejestruje program (bez czekania)
  tloKlatka(w,st);
  if(R.glTla){T.gotowe=true;R.tloBrudne=true;}   // GL narysował: #tlo składa się jeszcze raz już bez wariantu 2D
}
// ---- haki stopni i silnik efektów (moduły efekty-*.js, gl-fx.js) ----
// Kolory promieni i światła pod torami: najpierw stopień tła (`tlo:{promienie, swiatlo}`), potem streak sceny, potem domyślne.
function koloryTla(pole,dom,pelna){
  if(!pelna||!S.scena)return dom;
  const a=S.scena.tlo&&S.scena.tlo.tlo,b=S.scena.streak&&S.scena.streak.tlo;
  return (a&&a[pole])||(b&&b[pole])||dom;
}
// Stan klatki dla modułów efektów i silnika: liczony raz na klatkę w rysujScene (i przy układzie w rysujTlo),
// dostępny jako R.st, żeby cztery tory efektów nie liczyły po swojemu beatu, ognia i geometrii (wspólny
// kontrakt torów). faza = ułamek ćwierćnuty 0..1 (na wynikach takt jak brawa widowni),
// og = poziom ognia gry 0–3, zar = jego wygładzenie spod widowni, kombo = najdłuższe kombo w składzie,
// moc = moc stopnia tła, gl = WebGL2 rysuje w tej klatce. `tory` jest wspólne dla klatek jednego układu: tylko do odczytu.
function stanKlatki(teraz){
  const G=S.gra,wyniki=S.ekran==="wyniki",graTrwa=S.ekran==="gra"||S.ekran==="odliczanie",pop=R.st,wl=wlascicielSceny();
  const beat=G&&!wyniki?G.beat:teraz/700;
  if(R.stWersja!==R.wersja||!R.stTory){R.stTory=R.tory.map(L=>({x:L.x,y:L.y,w:L.w,h:L.h,teraz:L.teraz}));R.stWersja=R.wersja;}
  let kombo=0;for(const g of S.gracze)if((g.kombo||0)>kombo)kombo=g.kombo;
  return {W:R.W,H:R.H,dpr:R.dpr,teraz,ts:teraz/1000,dt:pop?Math.max(0,Math.min(.1,(teraz-pop.teraz)/1000)):0,
    beat,faza:beat-Math.floor(beat),bpm:G?G.bpm:120,og:G&&graTrwa?(G.ogien||0):0,zar:wyniki?0:Math.min(3,R.zarWid||0),kombo,
    moc:mocStopnia(wpisTla()),spokoj:!grafikaPelna(),bezRuchu:ruchOgraniczony(),gl:fxGotowy()&&grafikaPelna(),
    wyniki,ap:wyniki&&S.wyniki&&S.wyniki.aplauz?S.wyniki.aplauz.glos:0,
    kolor:wl?wl.kolor:"#ec1a83",akcent:wl&&wl.tor?wl.tor.styl.akcent:"#ec1a83",tory:R.stTory,widownia:R.widownia,
    rama:!!ramaSceny()};
}
// Rama sceny z pola `rama` stopnia tła: true = domyślne odsunięcie kart torów, obiekt = nadpisania
// {bok (ułamek szerokości okna, margines 48–140 px), gora, dol, odstep (px)}; brak = null (układ jak dotąd).
function ramaSceny(){
  const w=wpisTla(),r=w&&w.rama;
  return r?(typeof r==="object"?r:{}):null;
}
// Błędy modułów efektów i silnika: pierwszy z danego miejsca idzie do konsoli (jak w rysujWidownie), kolejne są ciche.
const ZC_BLEDY_STOPNI=new Set();
function bladStopnia(klucz,opis,e){if(ZC_BLEDY_STOPNI.has(klucz))return;ZC_BLEDY_STOPNI.add(klucz);console.error("RibbitBeat: "+opis,e);}
// Hak stopnia z modułu efektów: brak metody = nic (true). Wyjątek modułu nie zatrzymuje klatki gry; płótno 2D
// (pierwszy argument, gdy jest kontekstem) wraca do stanu domyślnego. Wynik false (wyjątek albo hak zwrócił
// jawnie false: „nie narysowałem”) pozwala wołającemu narysować domyślnie (klawiatura, tło 2D).
function hakStopnia(tor,w,nazwa,a,b,c,d){
  const f=w&&w[nazwa];if(typeof f!=="function")return true;
  try{return f.call(w,a,b,c,d)!==false;}
  catch(e){
    bladStopnia(tor+"|"+(w.id||"")+"|"+nazwa,tor+" „"+(w.id||"moduł")+"” ("+nazwa+")",e);
    if(a&&typeof a.setTransform==="function"){a.setTransform(R.dpr,0,0,R.dpr,0,0);a.globalAlpha=1;a.globalCompositeOperation="source-over";}
    return false;
  }
}
// Silnik efektów (gl-fx.js, window.FX) jest opcjonalny: brak pliku, brak WebGL2 albo wyjątek silnika = gra rysuje
// dalej samym 2D.
function fxWolaj(metoda,a,b,c){
  if(typeof FX==="undefined"||!FX||typeof FX[metoda]!=="function")return undefined;
  try{return FX[metoda](a,b,c);}catch(e){bladStopnia("FX|"+metoda,"silnik efektów ("+metoda+")",e);return undefined;}
}
const fxGotowy=()=>!!fxWolaj("gotowy");
// Tło stopnia na płótnie WebGL2 pod kartami: moduł rysuje je w haku `klatka` (FX.tlo.rysuj; zwraca false, gdy
// w tej klatce GL nie narysował, np. program jeszcze się kompiluje), a wpis bez haka, ale z `shader:{id, uniformy(st)}`,
// rysuje gra (FX.tlo.rysuj zwraca false w tej samej sytuacji). `klatka` idzie też bez GL (moduł może liczyć ruch).
// R.glTla = GL tła narysował w tej klatce; inaczej zlozTlo rysuje `rysuj2d`, a płótno GL czyści się raz (FX.tlo.wylacz).
function tloKlatka(w,st){
  const T2=typeof FX!=="undefined"&&FX?FX.tlo:null;let gl=false;
  if(w.klatka)gl=hakStopnia("tlo",w,"klatka",st)&&st.gl;
  else if(st.gl&&w.shader&&w.shader.id&&T2&&typeof T2.rysuj==="function"){
    try{gl=T2.rysuj(w.shader.id,typeof w.shader.uniformy==="function"?w.shader.uniformy(st):null)!==false;}
    catch(e){bladStopnia("tlo|"+w.id+"|shader","tlo „"+w.id+"” (shader)",e);}
  }
  if(R.glTla&&!gl&&T2&&typeof T2.wylacz==="function"){try{T2.wylacz();}catch(e){bladStopnia("FX|tlo.wylacz","silnik efektów (tlo.wylacz)",e);}}
  R.glTla=gl;
}

// Klawiatura toru: pionowy pasek klawiszy przy lewej krawędzi, jeden rząd na półton jak w rolce pianina (czarne
// klawisze jako krótsze ciemne belki). Na scenie podświetla klawisz, który gracz właśnie śpiewa, a przy kombo płonie.
function prostokatKlawisza(L,s){return {x:L.kx,y:ySemi(L,s)-L.rh/2,w:L.kw,h:L.rh};}
function rysujKlawiature(c,L){
  const y0=L.gorna,h=L.rzedy*L.rh;
  c.fillStyle="rgba(120,90,40,.22)";c.beginPath();c.roundRect(L.kx+2,y0+3,L.kw,h,4);c.fill();   // twardy cień
  c.fillStyle="#fffdf6";c.beginPath();c.roundRect(L.kx,y0,L.kw,h,4);c.fill();
  for(let s=L.dolN;s<=L.goraN;s++){
    const k=prostokatKlawisza(L,s);
    if(isBlack(s)){c.fillStyle="#211f1d";c.beginPath();c.roundRect(k.x,k.y+.5,k.w*.62,Math.max(1,k.h-1),[0,2,2,0]);c.fill();}
    else if(isBlack(s+1)||((s%12)+12)%12===4||((s%12)+12)%12===11){   // kreska między białymi klawiszami
      c.fillStyle="rgba(33,31,29,.28)";c.fillRect(k.x,Math.round(k.y)-.5,k.w,1);
    }
  }
  c.strokeStyle="#211f1d";c.lineWidth=1.4;c.beginPath();c.roundRect(L.kx,y0,L.kw,h,4);c.stroke();
}

// ---- bufory płócien (naklejki, żaby z obrysem, etykiety, kapsle) ----
function bufor(klucz,szer,wys,rysuj){
  let b=R.bufor.get(klucz);if(b)return b;
  const cv=document.createElement("canvas"),d=R.dpr;
  cv.width=Math.max(1,Math.ceil(szer*d));cv.height=Math.max(1,Math.ceil(wys*d));
  const c=cv.getContext("2d");c.scale(d,d);rysuj(c);
  b={cv,w:szer,h:wys};R.bufor.set(klucz,b);
  if(R.swieze)R.swieze.push(cv);   // zasłona wczytywania utworu: nowa bitmapa od razu idzie na kartę graficzną (wyslijSwieze)
  return b;
}
// Żaba-naklejka: sylwetka sprite'a wypełniona kolorem kapsla i odbita w 16 kierunkach dookoła
// (płótno nie umie obrysować krawędzi alfy bitmapy; ten sam pomysł co _frogSilhouette w rf-22),
// sprite na wierzchu. Liczona raz na (klatka, kolor, grubość), potem to jedno drawImage na klatkę.
// `przebranie` (opcjonalnie, 10-16): id motywu z przebraniem żaby (Motywy.przebranie: te same klatki pyska w kostiumie
// motywu). Pole klatki przebrania jest większe niż sprite (PRZEBRANIE.POLE jednostek zamiast 96), a środek ten sam, więc
// bufor rośnie, a wołający liczy skalę z `img.w / 96` jak dotąd i głowa zostaje tej samej wielkości. Dopóki grafika
// przebrania się wczytuje albo motyw jej nie ma, rysuje się zwykła żaba z logo.
function zabaNaklejka(klatka,kolor,gruba,przebranie){
  const zp=przebranie&&typeof Motywy!=="undefined"&&Motywy.przebranie?Motywy.przebranie(przebranie):null;
  const img=zp?zp[klatka==="cicha"?0:1+Math.max(0,Math.min(4,klatka|0))]:klatka==="cicha"?IMG.cicha:IMG.zaby[klatka];
  const r=gruba?6:4,pole=zp?Motywy.PRZEBRANIE.POLE:96,rozm=pole+2*7;
  if(!obrazGotowy(img))return null;
  return bufor("z|"+(zp?"p|"+przebranie+"|":"")+klatka+"|"+kolor+"|"+r,rozm,rozm,c=>{
    const sil=document.createElement("canvas");sil.width=pole;sil.height=pole;
    const s=sil.getContext("2d");s.imageSmoothingQuality="high";s.drawImage(img,0,0,pole,pole);s.globalCompositeOperation="source-in";
    s.fillStyle=kolor;s.fillRect(0,0,pole,pole);
    for(let i=0;i<16;i++){const a=i*Math.PI/8;c.drawImage(sil,7+Math.cos(a)*r,7+Math.sin(a)*r,pole,pole);}
    c.imageSmoothingQuality="high";c.drawImage(img,7,7,pole,pole);
  });
}
// Przebranie żaby gracza (10-16): motyw jego efektu (tor streak), o ile ma przebranie. Przebranie zastępuje efekt
// głowy motywu (glowaZaGlowa), iskry, dym i ślad zostają.
// Bot (10-17): zawsze robo-żaba swojego poziomu (Motywy: robo-latwy … robo-mistrz), niezależnie od efektu.
// Podgląd w tier liście robi bot, ale z wybranym skinem: skin wymuszony adresem albo
// panelem DEV (?stopien=, ?streak=: podgląd motywu w tier liście, narzędzie zrzutów) wygrywa z robo-żabą, żeby bot pokazał
// całą konfigurację motywu. Zwykła gra z botami bez zmian (dwa odczyty pól na klatkę).
function skinWymuszony(){return (ZC_DEV.streak!=null||ZC_DEV.stopien!=null)&&!!stopienDev("streak");}
function przebranieGracza(g){
  if(g&&g.zrodlo==="bot"&&!skinWymuszony())return roboPrzebranie(g.poziom);
  const w=g&&g.stylStreak,id=w&&(w.motyw||w.id);
  return id&&typeof Motywy!=="undefined"&&Motywy.maPrzebranie&&Motywy.maPrzebranie(id)?id:null;
}
// Środek głowy w przebraniu (koła wokół głów bywały niewyśrodkowane, np. przy rysunku dziecka głowa jest
// niżej): halo, aura, ogień i pierścienie streaka liczą się od pozycjaZaby, czyli od środka obrazka. Rysunek w przebraniu
// bywa przesunięty w swoim kwadracie, więc obrazek przesuwamy tak, żeby środek jego treści (prostokąt nieprzezroczystych
// pikseli zamkniętego pyska) leżał tam, gdzie u zwykłej żaby. Jedno przesunięcie na przebranie (klatki pyska się nie
// rozjeżdżają), zwykła żaba bez zmian. Wynik: {x, y} w ułamkach kwadratu obrazka oraz pole i rozm naklejki.
const ZC_SRODKI=new Map();
function srodekObrazka(img){
  let w=ZC_SRODKI.get(img);if(w)return w;
  w={x:.5,y:.5};
  try{const N=64,cv=document.createElement("canvas");cv.width=cv.height=N;const c=cv.getContext("2d",{willReadFrequently:true});c.drawImage(img,0,0,N,N);
    const d=c.getImageData(0,0,N,N).data;let x0=N,y0=N,x1=-1,y1=-1;
    for(let y=0;y<N;y++)for(let x=0;x<N;x++)if(d[(y*N+x)*4+3]>25){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
    if(x1>=0)w={x:(x0+x1+1)/2/N,y:(y0+y1+1)/2/N};}catch(e){}
  ZC_SRODKI.set(img,w);return w;
}
function przesuniecieGlowy(przebranie){
  const zp=typeof Motywy!=="undefined"&&Motywy.przebranie?Motywy.przebranie(przebranie):null;
  const img=zp&&zp[0],ref=IMG.cicha;if(!obrazGotowy(img)||!obrazGotowy(ref))return null;
  const a=srodekObrazka(img),b=srodekObrazka(ref),pole=Motywy.PRZEBRANIE.POLE;
  const dx=Math.max(-.25,Math.min(.25,a.x-b.x)),dy=Math.max(-.25,Math.min(.25,a.y-b.y));
  return Math.abs(dx)<.02&&Math.abs(dy)<.02?null:{x:dx,y:dy,pole,rozm:pole+14};
}
// Kapsel gracza przyklejony do żaby w gęstym chórze (≥ 3 na torze): ten sam obrazek co w HUD, z twardym cieniem.
function kapselNaklejka(src,rozm){
  const img=obrazekKapsla(src);if(!img)return null;
  return bufor("k|"+src+"|"+rozm,rozm+3,rozm+4,c=>{
    c.fillStyle="rgba(33,31,29,.35)";c.beginPath();c.arc(rozm/2+1.5,rozm/2+2.5,rozm/2-.5,0,Math.PI*2);c.fill();
    c.drawImage(img,0,0,rozm,rozm);
  });
}
// Blask: miękkie koło w danym kolorze (pod żabą w ogniu, pod widownią), liczone raz na kolor i układ.
function blask(kolor){
  return bufor("blask|"+kolor,96,96,c=>{
    const g=c.createRadialGradient(48,48,0,48,48,48);
    g.addColorStop(0,rgba(kolor,.85));g.addColorStop(.45,rgba(kolor,.38));g.addColorStop(1,rgba(kolor,0));
    c.fillStyle=g;c.fillRect(0,0,96,96);
  });
}
// Błysk: czteroramienna gwiazdka-naklejka (bursztyn z tuszem), migocze nad widownią przy kombo.
function blysk(){
  return bufor("blysk",24,24,c=>{
    c.translate(12,12);c.beginPath();
    for(let i=0;i<8;i++){const r=i%2?3:10.5,a=i*Math.PI/4-Math.PI/2;c.lineTo(Math.cos(a)*r,Math.sin(a)*r);}
    c.closePath();c.fillStyle="#ffd84a";c.fill();c.strokeStyle="#211f1d";c.lineWidth=1.3;c.stroke();
  });
}
// Jeden obiekt MediaQueryList na całą grę: `.matches` jest żywe, a matchMedia() w każdym wywołaniu (kilkadziesiąt
// razy na klatkę) kosztowało ok. 3 % czasu JS klatki (profil 10-04)
const ZC_MQ_RUCH=window.matchMedia?matchMedia("(prefers-reduced-motion: reduce)"):null;
const ruchOgraniczony=()=>!!(ZC_MQ_RUCH&&ZC_MQ_RUCH.matches);
// Pełna grafika = ogień, dym, iskry i miękkie płomienie. „Uproszczona” w ustawieniach albo systemowe
// ograniczenie ruchu zostawia tylko to, co tanie: poświaty i smugę śladu.
// R.autoJakosc: poziom ze strażnika klatek (straznikKlatek): 1 = render 1×, 2 = bez ognia, dymu i iskier, 3 = wydajność
const grafikaPelna=()=>S.ust.grafika!=="uproszczona"&&S.ust.grafika!=="wydajnosc"&&!ruchOgraniczony()&&(R.autoJakosc||0)<2;
// Tryb „wydajność” (10-04): wszystko z uproszczonej, do tego bez tła stopnia (scena za kartami, rama, prześwit),
// bez silnika efektów i płótna w 1× dpr. Gra wygląda jak na stopniu 1 tła, tory i żaby bez zmian.
const trybWydajny=()=>S.ust.grafika==="wydajnosc"||(R.autoJakosc||0)>=3;
// Wpis stopnia tła, który gra RYSUJE (w trybie wydajności żaden; postępy i okno „Scena” czytają S.scena.tlo wprost)
const wpisTla=()=>trybWydajny()?null:(S.scena&&S.scena.tlo)||null;
// Paleta karty toru z motywu (motywy.js, 10-09): papier, cień, rzędy, nazwy dźwięków, kreski taktów, nić „teraz”,
// opcjonalna faktura `rysuj`. Bez modułu motywów albo w trybie Wydajność: kraft jak dotąd.
const ZC_KARTA_DOM={papier:"#faf6ee",cien:"rgba(120,90,40,.13)",czarne:"rgba(33,31,29,.05)",liniaC:"rgba(33,31,29,.12)",
  minione:"rgba(216,205,184,.22)",nazwy:"rgba(87,80,63,.62)",kreski:"rgba(120,90,40,.24)",nic:"#ec1a83",szpilka:"#211f1d",
  szpilkaBlask:"#faf6ee",cienNuty:"rgba(120,90,40,.25)",scieg:null,rysuj:null};
function paletaKarty(w){
  if(w===undefined)w=wpisTla();
  return (w&&w.karta)||ZC_KARTA_DOM;
}
// Szum 1D (0..1, gładki): postrzępiony brzeg spalenizny i migotanie płomieni bez tablic losowych.
function szum1(x){
  const i=Math.floor(x),f=x-i,u=f*f*(3-2*f),h=k=>{const v=Math.sin(k*12.9898+78.233)*43758.5453;return v-Math.floor(v);};
  return h(i)*(1-u)+h(i+1)*u;
}
// Kłąb dymu: miękka szara plama (promień 32), rysowana z alfą i skalą zależną od wieku cząstki.
function dymek(){
  return bufor("dym",64,64,c=>{
    const g=c.createRadialGradient(32,32,0,32,32,32);
    g.addColorStop(0,"rgba(92,88,88,.55)");g.addColorStop(.5,"rgba(92,88,88,.22)");g.addColorStop(1,"rgba(92,88,88,0)");
    c.fillStyle=g;c.fillRect(0,0,64,64);
  });
}
// Język ognia (sprite 48×128, ZC_JEZYKI wariantów o innym wygięciu): u podstawy gęsty i jasny (kremowa żółć),
// wyżej pomarańcz, czubek różowy i przezroczysty; w środku węższy, krótszy, prawie biały rdzeń. Podstawa jest
// najjaśniejszym miejscem, więc płomień wyrasta z tego, na czym stoi, zamiast wisieć nad tym jak łza
// (tak wyglądał poprzedni sprite: jasny środek, przezroczysta podstawa schowana za głową żaby). Rysowany
// trybem „lighter”, więc nakładające się języki rozjaśniają się wzajemnie jak prawdziwy żar.
const ZC_JEZYKI=6,ZC_JEZYK_BAZA=122/128;   // ułamek wysokości sprite'a, na którym leży podstawa języka
// Paleta ognia: domyślna to dawne kolory; style „Niebieski”, „Złoty” i „Piekielny” (efekty.js) podają własną.
const ZC_OGIEN_PAL={baza:["rgba(255,232,150,.92)","rgba(255,190,60,.88)","rgba(255,110,30,.66)","rgba(236,26,131,.28)","rgba(236,26,131,0)"],
  rdzen:["rgba(255,253,235,.95)","rgba(255,226,110,.6)","rgba(255,200,80,0)"],blask:["#ffd84a","#eaa32b"],
  rabek:["255,150,40","255,236,150"],smuga:["236,26,131","234,163,43","255,216,74"]};
function jezykOgnia(k,pal){
  const P=pal||ZC_OGIEN_PAL;
  return bufor("jezyk"+k+(pal?"|"+pal.id:""),48,128,c=>{
    const ph=k*1.9,f=1.1+.25*(k%3),A=7+2*(k%2);
    const ksztalt=(skala,wys)=>{   // kontur: podstawa u dołu (y = 122), czubek u góry, oś wygięta sinusem
      const N=14,pts=[];
      for(let i=0;i<=N;i++){const t=i/N;pts.push([Math.sin(t*Math.PI*f+ph)*A*t*skala,122-t*wys,14*skala*Math.pow(1-t,.65)+(t<1?.6:0)]);}
      c.beginPath();
      pts.forEach(([x,y,w],i)=>i?c.lineTo(24+x-w,y):c.moveTo(24+x-w,y));
      for(let i=N;i>=0;i--){const [x,y,w]=pts[i];c.lineTo(24+x+w,y);}
      c.closePath();
    };
    let g=c.createLinearGradient(0,122,0,8);
    g.addColorStop(0,P.baza[0]);g.addColorStop(.22,P.baza[1]);g.addColorStop(.5,P.baza[2]);
    g.addColorStop(.8,P.baza[3]);g.addColorStop(1,P.baza[4]);
    c.filter="blur(1.4px)";ksztalt(1,114);c.fillStyle=g;c.fill();c.filter="none";
    g=c.createLinearGradient(0,122,0,40);
    g.addColorStop(0,P.rdzen[0]);g.addColorStop(.45,P.rdzen[1]);g.addColorStop(1,P.rdzen[2]);
    ksztalt(.5,78);c.fillStyle=g;c.fill();
  });
}
// Jeden język w punkcie (x, y) = jego podstawa: wysokość hh, pochylony `sk` (czubek ucieka w bok, podstawa stoi).
function rysujJezyk(c,img,x,y,hh,sk,odbity){
  const ww=Math.max(6,hh*.42);
  c.save();c.translate(x,y);c.transform(odbity?-1:1,0,sk,1,0,0);c.drawImage(img,-ww/2,-hh*ZC_JEZYK_BAZA,ww,hh);c.restore();
}
// Kilka języków nad podstawą (x, y): szerokość w, wysokość h; każdy inaczej migocze i chwieje się (ziarno).
// `moc` 0..1. Pod językami żar, bo płomień ma z czegoś wyrastać.
function rysujOgienMiekki(c,x,y,w,h,ts,ziarno,moc,pal){
  if(h<3||moc<=0)return;
  const n=Math.max(1,Math.min(6,Math.round(w/8)));
  c.save();c.globalCompositeOperation="lighter";
  const zw=Math.max(10,w*1.1),zh=Math.max(6,Math.min(h*.4,zw*.5));
  c.globalAlpha=moc*.4;c.drawImage(blask(pal?pal.blask[0]:"#ffd84a").cv,x-zw/2,y-zh*.55,zw,zh);
  for(let j=0;j<n;j++){
    const u=n>1?j/(n-1)-.5:0,fl=.55+.45*szum1(ts*7+ziarno*3.1+j*7.7);
    const hh=h*fl*(1-.3*Math.abs(u)*2),kx=x+u*w+(szum1(ts*4+j*13+ziarno)-.5)*w*.1;
    const sk=(szum1(ts*3+j*4.7+ziarno*1.3)-.5)*.6-.08;   // chwianie, odrobinę w lewo (nuty i wiatr płyną w lewo)
    c.globalAlpha=moc*(.6+.4*fl);
    rysujJezyk(c,jezykOgnia((j+(ziarno|0))%ZC_JEZYKI,pal).cv,kx,y,hh,sk,(j+(ziarno|0))%2===1);
  }
  c.restore();
}
// Ogień głowy żaby: języki zakorzenione w konturze czubka głowy (łuk o promieniu 0,44 sc, podstawa kilka
// procent W głowie), tylny rząd za obrazkiem, a przed nim rząd małych języków i żar na irokezie, żeby głowa
// PŁONĘŁA, a nie miała ognia zawieszonego nad sobą (wcześniej płomień lewitował nad żabą).
function rysujOgienGlowy(c,sc,og,ts,ziarno,przod,pal){
  const r=sc*.44,cy=sc*.02,duzy=og>=3;
  const n=przod?(duzy?5:4):(duzy?9:7),szer=przod?.5:.72,hBaza=przod?(duzy?.42:.3):(duzy?1.15:.78);
  c.save();c.globalCompositeOperation="lighter";
  if(przod){const zw=sc*.8,zh=sc*.34;c.globalAlpha=duzy?.5:.38;c.drawImage(blask(pal?pal.blask[1]:"#eaa32b").cv,-zw/2,cy-r-zh*.45,zw,zh);}
  for(let j=0;j<n;j++){
    const u=n>1?j/(n-1)-.5:0,x=u*szer*sc,yb=cy-Math.sqrt(Math.max(0,r*r-x*x))+sc*(przod?.03:.07);
    const fl=.6+.4*szum1(ts*(przod?9:7)+ziarno*2.3+j*6.1);
    const hh=sc*hBaza*fl*(1-.5*Math.pow(Math.abs(u)*2,1.5));
    const sk=(szum1(ts*3.5+j*4.7+ziarno)-.5)*.5-.1;
    c.globalAlpha=(przod?.6:.95)*(.65+.35*fl);
    rysujJezyk(c,jezykOgnia((j+ziarno)%ZC_JEZYKI,pal).cv,x,yb,hh,sk,(j+ziarno)%2===1);
  }
  c.restore();
}
// Bufory grafiki ognia powstają przy starcie gry, nie w klatce pierwszego kombo (wtedy gra planuje dźwięk).
function rozgrzejGrafike(){
  if(!grafikaPelna())return;
  for(let k=0;k<ZC_JEZYKI;k++)jezykOgnia(k);
  dymek();blysk();for(const k of ["#ec1a83","#eaa32b","#ffd84a"])blask(k);
  if(S.scena&&typeof Efekty!=="undefined")Efekty.rozgrzej(S.scena.widownia.id,[...new Set(S.gracze.map(g=>g.stylStreak&&g.stylStreak.id).filter(Boolean))]);
  // stopnie z modułów drabinek: rozgrzej() każdego wybranego wpisu raz (tło, widownia, klawisze i streaki graczy),
  // np. shadery i bufory, żeby nie powstawały w klatce pierwszego kombo
  if(S.scena){
    const wpisy=new Map([[S.scena.tlo,"tlo"],[S.scena.widownia,"widownia"],[S.scena.klawisze,"klawisze"]]);
    for(const g of S.gracze){if(g.stylStreak)wpisy.set(g.stylStreak,"streak");if(g.stylKlawiszy)wpisy.set(g.stylKlawiszy,"klawisze");}
    for(const [w,tor] of wpisy)if(w)hakStopnia(tor,w,"rozgrzej",R.st);
  }
  przecwiczEfekty();przecwiczHud();
}
// Przećwiczenie ognia (10-10, płynność): bufory to nie wszystko. Przeglądarka kompiluje programy GPU dopiero przy
// PIERWSZYM użyciu danego rodzaju rysowania (mieszanie „lighter”, gumka destination-out, gradient na ścieżce, rozmyty
// cień w HUD), więc pierwsze zapalenie ognia 1, 2 i 3 dawało w świeżej przeglądarce zacięcie 50–120 ms (ślad Chrome:
// ProgramD3D::link w tej klatce), czyli w środku piosenki. Tu każdy efekt ognia rysuje się raz na niewidocznym płótnie
// (w przycięciu jak tor), a pierwsza klatka odliczania kładzie je na scenę z alfą bliską zera: kompilacja wypada wtedy,
// gdy zegar gry jeszcze stoi (S.zegarStoi czeka na zwykłe klatki).
function przecwiczEfekty(){
  if(typeof document==="undefined"||!R.tory.length)return;
  const iskry=R.iskry,dym=R.dym;
  try{
    const cv=document.createElement("canvas"),d=R.dpr,W=384;cv.width=cv.height=Math.ceil(W*d);
    const c=cv.getContext("2d");c.setTransform(d,0,0,d,0,0);
    c.save();c.beginPath();c.roundRect(2,2,W-4,W-4,14);c.clip();
    const style=[...new Set(R.tory.map(L=>stylToru(L)))];
    const pts=[];for(let k=0;k<24;k++)pts.push({x:20+k*12,y:200+Math.sin(k*.6)*20,sp:true});
    for(const sty of style){
      const pal=sty&&sty.paleta||null;
      rysujScenePlonaca(c,{x:0,y:0,w:W,h:W,teraz:W*.3},3,0,sty&&sty.scena);
      for(const og of [1,2,3]){
        if(!sty||sty.id==="ogien")rysujSladPlonacyPkt(c,pts,og,og*.3,0,W,W,og,null,true,false);
        else if(typeof sty.slad==="function")sty.slad(c,{pts,og,ts:og*.3,x0:0,xT:W,dlug:W,ziarno:og,pelna:true,emituj:false,kolor:"#ec1a83"});
        c.save();c.translate(190,120);c.rotate(.1);
        if(typeof sty.nuty==="function")sty.nuty(c,140,22,30,og,og*.3,og,true,1);
        else rysujSpalenizneNuty(c,140,22,30,og,og*.3,og,true,1,pal);
        c.restore();
        c.save();c.translate(260,260);
        if(og>=2)glowaZaGlowa(c,sty,70,og,og*.3,9001);
        rysujOgienGlowy(c,70,og,og*.3,1,false,pal);rysujOgienGlowy(c,70,og,og*.3,1,true,pal);
        c.restore();
      }
      // taśma trafiona na płonącym torze: gradient ognia na ścieżce taśmy
      const wk=sty&&sty.wypelnienie||ZC_WYPEL_OGIEN,g=c.createLinearGradient(0,0,0,22);
      g.addColorStop(0,wk[0]);g.addColorStop(.5,wk[1]);g.addColorStop(1,wk[2]);
      c.save();c.translate(80,60);sciezkaTasmy(c,120,22,1,true,false);c.globalAlpha=.4;c.fillStyle=g;c.fill();c.restore();
    }
    katalogRysowania(c,W);
    // bufory tworzone przy pierwszym ogniu: poświata każdego toru (klucz z układu) i bufor efektu głowy każdej żaby
    // w rozmiarze z zapasem (bufor tylko rośnie), żeby w piosence nic nowego nie powstawało
    for(const L of R.tory){
      rysujScenePlonaca(c,L,3,0,stylToru(L).scena);
      for(const g of L.tor.gracze)glowaZaGlowa(c,stylToru(L),L.zaba*1.4,3,0,g.nrWTorze*7+1);
    }
    // cząstki: dym (szary i barwny), iskry (kropki, gwiazdki), blaski
    c.globalAlpha=.5;c.drawImage(dymek().cv,40,40,30,30);c.drawImage(dymekKoloru("236,26,131").cv,70,40,30,30);
    for(const k of ["#ffd84a","#eaa32b","#ec1a83"])c.drawImage(kropkaIskry(k),100,40,6,6);
    c.drawImage(blysk().cv,120,40,16,16);c.globalAlpha=1;
    c.restore();
    R.rozgrzewka=cv;
  }catch(e){console.warn("RibbitBeat: przećwiczenie ognia",e);}
  R.iskry=iskry;R.dym=dym;   // style mogły coś wyemitować
  if(ZC_BUF_GLOWY)ZC_BUF_GLOWY.delete(9001);
}
// Katalog rodzajów rysowania sceny (ślad Chrome 10-10: kompilacje programów GPU po 3–14 ms rozsiane po pierwszych
// sekundach piosenki, przy pierwszym napisie „+N”, spinaczu, naklejce, kropce gracza…): każdy tryb mieszania używany
// w grze i efektach × wypełnienia, obrysy (okrągłe końce, przerywane), gradienty, wzór, napisy fontami gry, bitmapy
// obrócone i skalowane; raz bez przycięcia i raz w przycięciu toru.
function katalogRysowania(c,W){
  const sp=kropkaIskry("#ec1a83"),wz=wzorTasmy();
  const tryby=["source-over","lighter","destination-out","source-in","source-atop","destination-in","multiply"];
  for(const klip of [false,true]){
    c.save();
    if(klip){c.beginPath();c.roundRect(10,10,W-20,W-20,14);c.clip();}
    for(const tr of tryby)for(const a of [1,.5]){
      c.globalCompositeOperation=tr;c.globalAlpha=a;
      c.fillStyle="#eaa32b";c.fillRect(20,20,30,30);
      c.beginPath();c.arc(70,35,12,0,Math.PI*2);c.fill();
      c.beginPath();c.moveTo(90,20);c.lineTo(130,30);c.lineTo(110,55);c.closePath();c.fill();
      c.beginPath();c.ellipse(150,35,8,14,0,0,Math.PI*2);c.fill();
      const lg=c.createLinearGradient(0,20,0,60);lg.addColorStop(0,"#ffd84a");lg.addColorStop(1,"rgba(236,26,131,0)");
      c.fillStyle=lg;c.beginPath();c.roundRect(170,20,40,30,8);c.fill();
      const rg=c.createRadialGradient(240,35,0,240,35,20);rg.addColorStop(0,"#fff");rg.addColorStop(1,"rgba(0,0,0,0)");
      c.fillStyle=rg;c.fillRect(220,15,40,40);
      if(wz){c.fillStyle=wz;c.fillRect(270,20,30,30);}
      c.strokeStyle="#211f1d";c.lineCap="round";c.lineJoin="round";c.lineWidth=3;
      c.beginPath();c.moveTo(20,80);c.quadraticCurveTo(60,60,100,80);c.bezierCurveTo(120,90,140,70,160,80);c.stroke();
      c.lineCap="butt";c.lineJoin="miter";c.lineWidth=1.5;c.setLineDash([7,5]);c.beginPath();c.moveTo(20,95);c.lineTo(200,95);c.stroke();
      c.beginPath();c.roundRect(210,70,60,30,10);c.stroke();c.setLineDash([]);
      c.strokeStyle="rgba(255,216,74,.45)";c.lineWidth=9;c.beginPath();c.roundRect(214,74,52,22,9);c.stroke();   // obwódka frazy (rysujSekcje)
      c.strokeStyle="#211f1d";c.lineWidth=2;c.beginPath();c.arc(300,80,10,0,Math.PI*2);c.stroke();
      c.strokeStyle=lg;c.lineWidth=6;c.beginPath();c.moveTo(20,110);c.lineTo(200,120);c.stroke();
      c.drawImage(sp,20,130,10,10);
      c.save();c.translate(60,140);c.rotate(.3);c.transform(1,0,-.2,1,0,0);c.drawImage(sp,-8,-8,16,16);c.restore();
      c.drawImage(sp,0,0,12,12,90,130,40,20);
      c.fillStyle="#211f1d";c.textBaseline="middle";c.textAlign="center";
      c.font="400 22px 'Titan One','Baloo 2',sans-serif";c.fillText("+12",170,140);
      c.strokeStyle="#faf6ee";c.lineWidth=4;c.strokeText("+3",220,140);
      c.font="500 11px 'JetBrains Mono',monospace";c.textAlign="left";c.fillText("C4 ×2",250,140);
    }
    c.restore();
  }
  c.globalCompositeOperation="source-over";c.globalAlpha=1;c.setLineDash([]);
}
// Ta sama rozgrzewka już w menu, w chwili bezczynności po wczytaniu strony: wtedy w pierwszej klatce odliczania
// programy są gotowe. Wymuszenie rysowania na GPU: odczyt jednego piksela.
function przecwiczWTle(){
  const ric=window.requestIdleCallback||(f=>setTimeout(f,300));
  setTimeout(()=>ric(przecwiczPlotna,{timeout:3000}),2500);
}
function przecwiczPlotna(){
    if(!grafikaPelna()||R.przecwiczone)return;R.przecwiczone=true;
    try{const cv=document.createElement("canvas"),d=Math.min(2,window.devicePixelRatio||1),W=384;cv.width=cv.height=Math.ceil(W*d);
      const c=cv.getContext("2d");c.setTransform(d,0,0,d,0,0);katalogRysowania(c,W);
      c.save();c.beginPath();c.roundRect(2,2,W-4,W-4,14);c.clip();
      for(const og of [1,2,3]){c.save();c.translate(190,220);rysujSpalenizneNuty(c,140,22,30,og,og*.3,og,true,1,null);c.restore();
        c.save();c.translate(260,300);rysujOgienGlowy(c,70,og,og*.3,1,false,null);rysujOgienGlowy(c,70,og,og*.3,1,true,null);c.restore();
        rysujOgienMiekki(c,100,300,40,60,og*.3,og,1,null);}
      c.restore();
      c.getImageData(0,0,1,1);
    }catch(e){console.warn("RibbitBeat: rozgrzewka w tle",e);}
}
// Bitmapy, które gra dotąd budowała w trakcie piosenki przy pierwszym użyciu (pomiar 10-10: klatki 25–34 ms przy
// pierwszej naklejce żaby z daną klatką pyska, ocenie „dobrze”, dymku „Kombo 24!”): naklejki żab każdego gracza
// (pyszczki 0–4 i cicha, cienki i gruby obrys), naklejki ocen, stałe dymki torów i „Koniec!”. Dymki progów kombo
// i serii „W rytm” mają liczby, więc te buduje z wyprzedzeniem dymkiZWyprzedzeniem w wolnych chwilach pętli.
function przygotujBufory(){for(const f of zadaniaBuforow(S.gra))f();}
// Te same bufory jako lista małych zadań: start piosenki pod zasłoną wykonuje je po kilka na klatkę
// (krokWczytywaniaUtworu), zwykły układ (zmiana okna, ustawień) wszystkie naraz. Kolejność jak dotąd.
function zadaniaBuforow(G){
  const Z=[];
  for(const g of S.gracze)for(const kl of [0,1,2,3,4,"cicha"])for(const gr of [false,true])Z.push(()=>{
    zabaNaklejka(kl,g.kolor,gr);const p=przebranieGracza(g);if(p)zabaNaklejka(kl,g.kolor,gr,p);
  });
  for(const oc of ["czysto","dobrze","prawie","falsz","pudlo"])for(const w of [0,1])Z.push(()=>naklejkaOceny(oc,w));
  for(const L of R.tory)Z.push(()=>{
    const fs=miaraDymkow(L).fs;
    for(const [t,r] of [[T.wibrato,"wibrato"],[T.ocena_falsz,"falsz"],[T.kum,"kum"],[T.wJednymGlosie,"chor"]])
      naklejkaTekstu(t,ZC_DYMKI_KOLOR[r],fs*(r==="kum"?.8:1),undefined,r==="kum");
  });
  Z.push(()=>naklejkaTekstu(T.koniecNaklejka,"#a6d861",Math.round(22*R.f)));
  Z.push(()=>{odblaskSekcji();gwiazdkaSekcji();});   // świecące frazy: bitmapy przed piosenką, nie w klatce
  for(const L of R.tory)Z.push(()=>{const fs=miaraDymkow(L).fs;naklejkaTekstu(T.sekcjaPopup,ZC_DYMKI_KOLOR.sekcja,fs);naklejkaTekstu(T.sekcjaCzysta,ZC_DYMKI_KOLOR.sekcja,fs);});   // dymki świecącej frazy (tekst stały) gotowe przed piosenką
  for(const oc of ["idealnie","dobrze"])for(const s of [1,2])Z.push(()=>bitmapaStempla(oc,s));   // pieczątki „w punkt”: podstawa bez liczby serii (×N dorysowuje rysujStemple)
  Z.push(()=>{if(T.wibrato)naklejkaTekstu(T.wibrato,"#eaa32b",11*R.f);R.dymkiPlan=0;});
  if(ZC_DEV.zapas)sprajtyCalejPiosenki(Z,G);
  return Z;
}
// Cała grafika piosenki ładuje się do pamięci przed startem, żeby gra nie doczytywała w trakcie: bitmapy
// nadjeżdżających nut całej piosenki powstają przed startem (w układzie, czyli pod zasłoną albo odliczaniem), do budżetu
// pikseli ZC_ZAPAS_MPX (ok. 4 B na piksel); co się nie zmieści, dobudowuje jak dotąd sprajtyZWyprzedzeniem. Bitmapy minionych
// taśm zależą od gry (trafienia, ogień), więc ich nie da się zrobić wcześniej: te dostają płótna z puli (wezPlotno), tak samo
// jak bitmapy nut, które dojechały do linii, więc w piosence prawie nie powstają nowe płótna. ?zapas=0 = jak dotąd.
// Dopisuje do listy Z po jednym zadaniu na nutę (wspólny licznik pikseli pilnuje budżetu).
const ZC_ZAPAS_MPX=12,ZC_PULA_MAKS=96;
function sprajtyCalejPiosenki(Z,G){
  if(!G||!R.tory)return;
  const stan={px:0};
  for(const L of R.tory){
    const t=L.tor,nuty=t.def.nuty,nh=Math.max(8,Math.min(30,Math.max(L.rh*.6,Math.min(L.rh*1.15,14))));
    for(let i=t.ptrRys||0;i<nuty.length;i++)Z.push(()=>{
      const n=nuty[i];if(n.t<=G.beat||stan.px>ZC_ZAPAS_MPX*1e6)return;
      const mial=t.sprajty?t.sprajty.get(i):null;   // bitmapa z lobby (zacznijZawczasu): zostaje, nie liczy się jako świeża
      const wCala=Math.max(5,n.d*L.pxNaBeat-3),w=n.p?Math.max(5,Math.min(wCala,wCala*n.p.od)):wCala;
      const katMaks=Math.min(Math.PI/180,Math.asin(Math.min(1,2/Math.max(1,w/2)))),kat=(((i*37)%21)-10)/10*katMaks;
      R.sprajtyBudzet=1;const b=sprajtNuty(L,i,n,w,nh,kat,t.styl);
      if(b){stan.px+=b.cv.width*b.cv.height;if(b!==mial&&R.swieze)R.swieze.push(b.cv);}
    });
  }
}
function wezPlotno(){const P=R.pulaPlocien;return ZC_DEV.zapas&&P&&P.length?P.pop():document.createElement("canvas");}
function oddajPlotno(cv){if(!ZC_DEV.zapas||!cv)return;const P=R.pulaPlocien||(R.pulaPlocien=[]);if(P.length<ZC_PULA_MAKS)P.push(cv);}
// Bitmapy nut z wyprzedzeniem (10-10): nuta dostawała bitmapę w klatce, w której wjeżdżała na tor (do 8 na klatkę),
// co przy gęstych partiach dawało klatki 25–30 ms. Po narysowanej klatce budujemy po kilka bitmap nut, które wjadą
// w ciągu najbliższego taktu, z tymi samymi wymiarami co rysujTor (szerokość, wysokość taśmy, przechył).
function sprajtyZWyprzedzeniem(){
  const G=S.gra;if(!G||(S.ekran!=="gra"&&S.ekran!=="odliczanie"))return;
  let ile=3;
  for(const L of R.tory){
    const t=L.tor,nuty=t.def.nuty,b1=G.beat+(L.x+L.w-L.teraz)/L.pxNaBeat,b2=b1+G.metrum;
    const nh=Math.max(8,Math.min(30,Math.max(L.rh*.6,Math.min(L.rh*1.15,14))));
    for(let i=t.ptrRys;i<nuty.length&&nuty[i].t<=b2;i++){
      const n=nuty[i];if(n.t<=b1)continue;
      if(t.sprajty&&t.sprajty.has(i))continue;
      const wCala=Math.max(5,n.d*L.pxNaBeat-3),w=n.p?Math.max(5,Math.min(wCala,wCala*n.p.od)):wCala;
      const katMaks=Math.min(Math.PI/180,Math.asin(Math.min(1,2/Math.max(1,w/2)))),kat=(((i*37)%21)-10)/10*katMaks;
      R.sprajtyBudzet=1;sprajtNuty(L,i,n,w,nh,kat,t.styl);
      if(--ile<=0)return;
    }
  }
}
// W piosence, zaraz po narysowanej klatce (do następnej jest cały okres ogranicznika, a JS klatki to 1–3 ms): dymek
// NASTĘPNEGO progu kombo i serii „W rytm” każdej żaby, najwyżej jeden na wywołanie, co 0,25 s. requestIdleCallback
// się nie nadaje: na ekranie 240 Hz przerwy między tickami mają ok. 4 ms i wolne okno prawie nie przychodzi.
function dymkiZWyprzedzeniem(teraz){
  if(!S.gra||(S.ekran!=="gra"&&S.ekran!=="odliczanie")||teraz-(R.dymkiPlan||0)<250)return;
  R.dymkiPlan=teraz;
  for(const L of R.tory){const fs=miaraDymkow(L).fs;
    for(const g of L.tor.gracze){
      const nk=(Math.floor((g.kombo||0)/ZC_PUNKTY.KOMBO_CO)+1)*ZC_PUNKTY.KOMBO_CO,ns=(Math.floor((g.seriaKlik||0)/ZC_KLIK.SERIA)+1)*ZC_KLIK.SERIA;
      for(const [t,r] of [[tt("komboPopup",{n:nk}),"kombo"],[tt("klikPopup",{n:ns}),"klik"]]){
        const k="p|"+t+"|"+ZC_DYMKI_KOLOR[r]+"|400 "+Math.round(fs)+"px 'Titan One','Baloo 2',sans-serif";
        if(!R.bufor.has(k)){naklejkaTekstu(t,ZC_DYMKI_KOLOR[r],fs);return;}   // jeden na wywołanie
      }
    }
  }
}
// To samo dla HUD: pełny żeton (kombo, mnożnik, kreski, zysk, gwiazdki, miejsce) w trzech stanach ognia i z kombo
// zerwanym, prawie przezroczysty, na czas odliczania. Pierwsze przemalowanie rozmytego cienia i napisów to też
// kompilacja programów GPU (40 ms w śladzie przy pierwszym kombo).
function przecwiczHud(){
  const box=document.getElementById("hud"),wzor=S.gracze.find(g=>g.hud);if(!box||!wzor)return;
  const el2=[];
  ["1","2","3","z"].forEach((og,k)=>{
    const d=wzor.hud.chip.cloneNode(true);d.classList.add("hud-rozgrzewka");d.dataset.ogien=og==="z"?"0":og;
    const q=s2=>d.querySelector(s2);
    q(".hud-kombo").textContent=og==="z"?T.hudZerwane:tt("komboHud",{n:12});if(og==="z"){q(".hud-kombo").classList.add("zerwane");d.classList.add("zerwane");}
    const mn=q(".hud-mnoznik");mn.textContent=og==="z"?"×1":"×4";mn.dataset.m=og==="z"?"1":"4";
    for(const p of d.querySelectorAll(".hud-pip"))p.classList.add("on");
    const zy=q(".hud-zysk");zy.hidden=false;zy.textContent="+276";
    q(".hud-punkty").textContent=fmtLiczba(12345);q(".hud-miejsce").textContent="1";q(".hud-strata").textContent="−1234";
    for(const z of [...d.querySelectorAll(".hud-gwiazdka")].slice(0,3))z.classList.add("pelna");
    d.style.cssText+=";position:fixed;left:"+(8+k*12)+"px;top:8px;opacity:.02;pointer-events:none;z-index:0";
    box.append(d);el2.push(d);
  });
  setTimeout(()=>{for(const d of el2)d.remove();},1500);
}
// Dym: cząstki w R.dym (współrzędne sceny w px CSS). Rodzą się nad żarem, unoszą się, skręcają i rzedną
// przez 1,5–3 s; wiatr lekko w lewo, bo tak płyną nuty. Limit 220, żeby pożar na 4 torach nie zjadł klatki.
function dodajDym(x,y,ile,sila,kolor){
  if(!grafikaPelna())return;
  const lista=R.dym||(R.dym=[]);
  R.doDymu=(R.doDymu||0)+ile*Math.min(.05,R.dtIskier||.016);
  while(R.doDymu>=1){R.doDymu--;
    if(lista.length>=220)break;
    lista.push({x:x+(Math.random()-.5)*6,y,vx:-14-Math.random()*22,vy:-(22+Math.random()*30)*(.7+.6*sila),
      r:(4+Math.random()*5)*(.8+.6*sila),zycie:1.4+Math.random()*1.2,wiek:0,faza:Math.random()*6.28,kol:kolor||null});
  }
}
function rysujDym(c,dt){
  const lista=R.dym;if(!lista||!lista.length)return;
  for(const p of lista){p.wiek+=dt;p.x+=(p.vx+Math.sin(p.faza+p.wiek*2.1)*18)*dt;p.y+=p.vy*dt;p.vy*=Math.exp(-dt*.6);}
  R.dym=lista.filter(p=>p.wiek<p.zycie);
  const img=dymek().cv;
  for(const p of R.dym){
    const f=p.wiek/p.zycie,r=p.r*(1+2.2*f);
    c.globalAlpha=.42*(1-f)*Math.min(1,f*6);   // dym ma być mgiełką nad żarem, nie chmurą zasłaniającą pyski
    c.drawImage(p.kol?dymekKoloru(p.kol).cv:img,p.x-r,p.y-r,2*r,2*r);
  }
  c.globalAlpha=1;
}
// Dym w kolorze stylu (raca, piekielny ogień): ta sama plama co dymek, barwiona.
function dymekKoloru(kolor){
  return bufor("dym|"+kolor,64,64,c=>{
    const g=c.createRadialGradient(32,32,0,32,32,32);
    g.addColorStop(0,rgba(kolor,.55));g.addColorStop(.5,rgba(kolor,.22));g.addColorStop(1,rgba(kolor,0));
    c.fillStyle=g;c.fillRect(0,0,64,64);
  });
}
// Iskry z punktu (x, y): ta sama lista R.iskry, którą rysuje rysujIskry nad wszystkimi torami. `isk` = iskry stylu
// streaka ({kolory, ksztalt, ruch:"opad"}: krople spadają zamiast lecieć w górę); brak = dawne okrągłe iskry.
function dodajIskry(x,y,ile,duze,isk){
  if(!grafikaPelna())return;
  R.doIskier=(R.doIskier||0)+ile*Math.min(.05,R.dtIskier||.016);
  while(R.doIskier>=1){R.doIskier--;
    if((R.iskry||(R.iskry=[])).length>=260)break;
    const opad=!!(isk&&isk.ruch==="opad");
    // vx ujemne (10-10): iskry zostają za żabą jak pęd powietrza, zamiast lecieć w nadjeżdżające nuty
    R.iskry.push({x:x+(Math.random()-.5)*10,y,vx:opad?(Math.random()-.5)*20:-(10+Math.random()*50),vy:opad?10+Math.random()*30:-(50+Math.random()*90),
      zycie:.45+Math.random()*.6,wiek:0,r:1.6+Math.random()*2.4*(duze?1.4:1),k:isk||null});
  }
}
// Spalenizna nuty w jej układzie (środek 0,0, taśma w×nh): wszystko na lewo od frontu `fx` jest zwęglone
// z postrzępionym brzegiem (jak „Płonący papier”: brzeg spalenizny skacze szumem ±3 px), na froncie żarzy się
// rąbek, a nad nim i wokół taśmy tańczą miękkie płomyki. `poziom` 1–3 to poziom ognia, `ts` sekundy.
function rysujSpalenizneNuty(c,w,nh,fx,poziom,ts,ziarno,aktywna,gasniecie,pal){
  const moc=Math.min(1,poziom/3),x0=-w/2,x1=w/2,gas=gasniecie==null?1:Math.max(0,Math.min(1,gasniecie));
  fx=Math.max(x0,Math.min(x1,fx));
  const szarp=y=>fx+(szum1(y*.35+ziarno*9+ts*.6)-.5)*6+(szum1(y*.9+ziarno*3)-.5)*2;
  // zwęglona część: ciemny brąz przy froncie, prawie czerń dalej; krawędź postrzępiona
  if(fx>x0+1){
    c.save();c.beginPath();c.moveTo(x0-2,-nh/2-2);
    for(let y=-nh/2-2;y<=nh/2+2;y+=3)c.lineTo(Math.min(x1,szarp(y)),y);
    c.lineTo(x0-2,nh/2+2);c.closePath();
    const g=c.createLinearGradient(fx,0,Math.max(x0,fx-Math.max(14,w*.5)),0);
    g.addColorStop(0,"rgba(96,52,26,.6)");g.addColorStop(.35,"rgba(58,36,26,.68)");g.addColorStop(1,"rgba(40,28,22,.72)");
    c.fillStyle=g;c.fill();
    c.restore();
    // żarzący się rąbek: cienka linia na brzegu spalenizny, migocze
    c.save();c.globalCompositeOperation="lighter";
    c.beginPath();for(let y=-nh/2,p=0;y<=nh/2;y+=3,p++){const x=Math.min(x1,szarp(y));if(p)c.lineTo(x,y);else c.moveTo(x,y);}
    const zar=.55+.45*szum1(ts*11+ziarno);
    const rb=(pal||ZC_OGIEN_PAL).rabek;
    c.strokeStyle="rgba("+rb[0]+","+(.9*zar).toFixed(2)+")";c.lineWidth=2.2;c.stroke();
    c.strokeStyle="rgba("+rb[1]+","+(.7*zar).toFixed(2)+")";c.lineWidth=1;c.stroke();
    c.restore();
  }
  // płomyki na froncie (zawsze), przy pożarze także nad resztą taśmy; aktywna nuta pali się wyżej
  if(gas<=0)return;   // miniona nuta: płomyki zgasły, została spalenizna
  const h=nh*(aktywna?1.6:1.1)*(1+.6*moc)*gas;
  rysujOgienMiekki(c,fx,-nh/2+2,Math.max(10,nh*1.2),h,ts,ziarno,(aktywna?.95:.7)*gas,pal);
  if(poziom>=2&&aktywna){
    const dl=x1-fx;
    if(dl>12)rysujOgienMiekki(c,fx+dl*.55,-nh/2+1,Math.min(dl*.8,60),h*.6,ts,ziarno+1,.5*moc,pal);
    rysujOgienMiekki(c,fx-Math.min(16,fx-x0),nh/2-1,Math.max(10,nh),h*.5,ts,ziarno+2,.4*moc,pal);
  }
}

// Faktura taśmy malarskiej: ukośne włókna co 5 px, liczona raz jako wzór i kładziona drugim wypełnieniem.
function wzorTasmy(){
  if(R.wzor)return R.wzor;
  const cv=document.createElement("canvas");cv.width=cv.height=5;
  const c=cv.getContext("2d");
  c.strokeStyle="rgba(120,90,40,.2)";c.lineWidth=1;
  c.beginPath();c.moveTo(0,5);c.lineTo(5,0);c.stroke();
  return (R.wzor=R.cs.createPattern(cv,"repeat"));
}
function naklejkaOceny(ocena,wariant){
  const tekst=T["ocena_"+ocena],fs=Math.round(13*R.f),font="400 "+fs+"px 'Titan One','Baloo 2',sans-serif";
  const m=R.ct;m.font=font;const sz=Math.ceil(m.measureText(tekst).width)+fs+5,wy=fs+11;
  return bufor("o|"+ocena+"|"+wariant+"|"+fs,sz+6,wy+8,c=>{
    c.translate(3,3);
    c.rotate((wariant?2.5:-2.5)*Math.PI/180);
    c.fillStyle="rgba(120,90,40,.25)";c.beginPath();c.roundRect(1,3,sz,wy-2,8);c.fill();
    c.fillStyle=ZC_OCENY_KOLOR[ocena];c.beginPath();c.roundRect(0,0,sz,wy-2,8);c.fill();
    c.strokeStyle="#211f1d";c.lineWidth=1.6;
    if(ocena==="pudlo")c.setLineDash([3,3]);
    c.stroke();c.setLineDash([]);
    c.font=font;c.fillStyle="#211f1d";c.textAlign="center";c.textBaseline="middle";
    c.fillText(tekst,sz/2,(wy-2)/2+1);
  });
}
function etykietaGracza(g){
  let tekst=g.nazwa||g.id;
  if(tekst.length>11)tekst=tekst.slice(0,10)+"…";
  const fs=Math.round(11*R.f),font="800 "+fs+"px Nunito,sans-serif";R.ct.font=font;
  // bot (podpis żaby z poziomem trudności): druga, mniejsza linia „bot Średni”
  const pod=g.zrodlo==="bot"?tt("etykietaBota",{poziom:nazwaPoziomuBota(g)}):"",fp=Math.round(9*R.f),font2="700 "+fp+"px Nunito,sans-serif";
  let sz=Math.ceil(R.ct.measureText(tekst).width)+fs+1;
  if(pod){R.ct.font=font2;sz=Math.max(sz,Math.ceil(R.ct.measureText(pod).width)+fs+1);}
  const wy=fs+8+(pod?fp+2:0);
  return bufor("e|"+g.id+"|"+tekst+"|"+pod+"|"+g.kolor+"|"+fs,sz+2,wy+3,c=>{
    c.fillStyle=g.kolor;c.beginPath();c.roundRect(1,1,sz,wy,6);c.fill();
    c.strokeStyle="#211f1d";c.lineWidth=1.2;c.stroke();
    c.font=font;c.fillStyle=napisNa(g.kolor);c.textAlign="center";c.textBaseline="middle";
    if(!pod){c.fillText(tekst,1+sz/2,1+wy/2+.5);return;}
    c.fillText(tekst,1+sz/2,1+4+fs/2+.5);
    c.font=font2;c.globalAlpha=.85;c.fillText(pod,1+sz/2,1+wy-4-fp/2);c.globalAlpha=1;
  });
}
function etykietaToru(L){
  const tekst=nazwaPartii(L.tor.def),fs=Math.round(12*R.f),font="800 "+fs+"px 'Baloo 2',Nunito,sans-serif";R.ct.font=font;
  const sz=Math.ceil(R.ct.measureText(tekst).width)+22,wy=fs+10;
  return bufor("t|"+L.tor.partia+"|"+R.wersja,sz+4,wy+6,c=>{
    c.translate(2,2);c.rotate(-1.2*Math.PI/180);
    if(napisNa(paletaKarty().papier)!=="#211f1d"){c.fillStyle="rgba(250,246,238,.92)";c.fillRect(0,2,sz,wy);}   // ciemna karta (motywy 10-09)
    c.fillStyle=rgba(L.tor.styl.akcent,.26);c.fillRect(0,2,sz,wy);
    c.fillStyle=rgba("#ffffff",.35);c.fillRect(0,2,sz,wy*.3);
    c.font=font;c.fillStyle="#211f1d";c.textBaseline="middle";c.fillText(tekst,11,2+wy/2+.5);
  });
}
// Naklejka z tekstem (dymki, instrukcja startu). Kilka wierszy rozdziela "\n"; `fs` = rozmiar w px.
function naklejkaTekstu(tekst,tlo,fs,font,bezObrysu){
  fs=Math.round(fs||15*R.f);
  const kroj=font||("400 "+fs+"px 'Titan One','Baloo 2',sans-serif");R.ct.font=kroj;
  const wiersze=String(tekst).split("\n"),lh=Math.round(fs*1.25);
  const sz=Math.ceil(Math.max(...wiersze.map(w=>R.ct.measureText(w).width)))+fs+6,wy=wiersze.length*lh+fs*.55;
  return bufor("p|"+tekst+"|"+tlo+"|"+kroj+(bezObrysu?"|b":""),sz+6,wy+9,c=>{
    c.translate(3,3);
    c.fillStyle="rgba(120,90,40,.28)";c.beginPath();c.roundRect(1,4,sz,wy,9);c.fill();
    c.fillStyle=tlo;c.beginPath();c.roundRect(0,0,sz,wy,9);c.fill();
    if(!bezObrysu){c.strokeStyle="#211f1d";c.lineWidth=1.8;c.stroke();}
    c.font=kroj;c.fillStyle=napisNa(tlo);c.textAlign="center";c.textBaseline="middle";
    wiersze.forEach((w,i)=>c.fillText(w,sz/2,fs*.28+lh*(i+.5)+1));
  });
}

// ---- scena (co klatkę) ----
function rysujScene(teraz){
  const c=R.cs;c.setTransform(R.dpr,0,0,R.dpr,0,0);c.clearRect(0,0,R.W,R.H);
  if(R.rozgrzewka){c.globalAlpha=.004;c.drawImage(R.rozgrzewka,0,0,8,8);c.globalAlpha=1;R.rozgrzewka=null;}   // przecwiczEfekty
  // żar: płynne narastanie (0,35 s) i wygasanie (0,9 s) ognia, tylko do rysowania (czas prawdziwy, nie gry)
  const dtR=Math.max(0,Math.min(.1,((teraz-(R.ostRys||teraz))/1000)));R.ostRys=teraz;
  const G=S.gra,graTrwa=S.ekran==="gra"||S.ekran==="odliczanie";
  for(const L of R.tory){const t=L.tor,cel=graTrwa?(t.ogien||0):0;t.zar=wygladzEMA(t.zar||0,cel,dtR,cel>(t.zar||0)?.35:.9);}
  R.zarWid=wygladzEMA(R.zarWid||0,graTrwa&&G?(G.ogien||0):0,dtR,.5);
  const gr=el("gra"),tryb=S.ust.grafika==="uproszczona"||S.ust.grafika==="wydajnosc"?S.ust.grafika:"pelna";
  if(gr.dataset.grafika!==tryb)gr.dataset.grafika=tryb;   // CSS: promienie i pulsowanie HUD tylko w pełnej
  if(!grafikaPelna()){R.dym=[];R.iskry=[];}   // po przełączeniu na uproszczoną cząstki znikają od razu
  // stan klatki dla modułów efektów (R.st); silnik: tryb (grafika uproszczona i ograniczony ruch = FX wyłączone)
  // i początek klatki (w trybie 2D silnik rysuje prosto na #scena), potem tło stopnia na płótnie GL pod kartami
  const st=R.st=stanKlatki(teraz),fx=S.ekran!=="lobby",wt=wpisTla();
  if(fx){const pel=grafikaPelna();if(R.fxPelna!==pel){R.fxPelna=pel;fxWolaj("wlacz",pel);}fxWolaj("klatka",st,c);}
  if(wt)tloStatyczne(wt,st,teraz);
  else if(R.tloStat){R.tloStat=null;R.glTla=false;R.tloBrudne=true;const T2=typeof FX!=="undefined"&&FX?FX.tlo:null;if(T2&&T2.wylacz)try{T2.wylacz();}catch(e){}}
  krokPromieni(teraz);
  if(R.tloBrudne)zlozTlo(teraz);   // tło statyczne: składa się tylko po zmianie (patrz zlozTlo); hak `fx` tła (ruch nad kartami) wyłączony
  R.naklejkiOcen=[];R.sprajtyBudzet=ZC_SPRAJT_NA_KLATKE;
  R.nutyGL=ZC_DEV.nutyGL&&typeof NutyGL!=="undefined"&&NutyGL.klatka()?NutyGL:null;   // ?nutyGL=1 (js/nuty-gl.js)
  for(const L of R.tory)rysujTor(c,L,teraz);
  if(R.nutyGL)R.nutyGL.rysuj();
  rysujSekcje(c,teraz);   // świecące frazy (10-10): połysk nad nutami, osobno od rysujTor
  rysujDym(c,dtR);
  rysujIskry(c,dtR);
  if(G&&G.blyskTeraz>0){   // błysk linii „teraz” (odliczanie „1” i start): limonka, 3 klatki
    c.strokeStyle="#6cb33f";c.lineWidth=5;c.lineCap="round";
    for(const L of R.tory){c.beginPath();c.moveTo(L.teraz,L.y+6);c.lineTo(L.teraz,L.y+L.h-6);c.stroke();}
    G.blyskTeraz--;
  }
  rysujWidownie(c,teraz);
  rysujStemple(c,teraz);
  rysujLoty(c,teraz);
  rysujPopupy(c,teraz);
  if(G&&G.koniecOd!=null)rysujKoniec(c,teraz);   // na wierzchu: ostatnie „+N” i dymki gasną pod nią
  if(S.ekran==="odliczanie")rysujOdliczanie(c);
  if(S.ekran!=="wyniki")rysujPodpowiedzStartu(c,teraz);   // na samym wierzchu: nie chowa się pod odliczaniem
  if(fx)fxWolaj("rysuj");   // koniec klatki: prymitywy GPU na płótnie nad kartami (w trybie 2D już narysowane)
}
// Kontur taśmy (środek w 0,0): oba końce darte zygzakiem 3 px, każdy inaczej (ziarno z numeru nuty),
// a prawy koniec długiej nuty falisty, bo to na niej robi się wibrato.
// Zjazd (tryb płynny): pas taśmy tej samej grubości (kraft, tusz, akcent partii) po krzywej S z końca płaskiej
// części nuty do początku następnej, tam gdzie stoi jej główka. Rysowany PRZED taśmą nuty, więc taśma
// przykrywa jego początek, a główka następnej nuty jego koniec.
function rysujPrzejscie(c,xa,ya,xb,yb,nh,st,miniona){
  if(xb-xa<4)return;
  const cx=(xa+xb)/2,gr=Math.max(5,nh);
  c.save();c.globalAlpha=miniona?.55:1;c.lineCap="butt";c.lineJoin="round";
  c.beginPath();c.moveTo(xa,ya);c.bezierCurveTo(cx,ya,cx,yb,xb,yb);
  c.strokeStyle="#211f1d";c.lineWidth=gr+2.4;c.stroke();
  c.strokeStyle=ZC_KRAFT;c.lineWidth=gr;c.stroke();
  c.strokeStyle=wzorTasmy();c.stroke();
  c.beginPath();c.moveTo(xa,ya+gr*.3);c.bezierCurveTo(cx,ya+gr*.3,cx,yb+gr*.3,xb,yb+gr*.3);
  c.strokeStyle=st.akcent;c.lineWidth=Math.max(2,gr*.3);c.stroke();
  c.restore();
}
// Czas na ruch: duch pełnej nuty (kraft 35 %, przerywany obrys) pod taśmą i strzałka skoku w luce do następnej.
function rysujDuchaNuty(c,L,n,y,nh,minela){
  const xa=xBeat(L,n.t0),xb=xBeat(L,n.t0+n.d0),h=Math.max(5,nh*.7);
  c.save();c.globalAlpha=minela?.2:.35;c.fillStyle=ZC_KRAFT;c.beginPath();c.roundRect(xa+1,y-h/2,Math.max(3,xb-xa-3),h,3);c.fill();
  c.globalAlpha=minela?.3:.55;c.setLineDash([3,3]);c.strokeStyle="#211f1d";c.lineWidth=1;c.stroke();c.restore();
}
function rysujStrzalkeSkoku(c,L,a,b,akcent,nh){
  const x0=xBeat(L,a.t+a.d),x1=xBeat(L,b.t),ya=ySemi(L,a.m),yb=ySemi(L,b.m);
  if(x1-x0<6)return;
  const x=(x0+x1)/2,gora=yb<ya,dl=Math.min(Math.abs(yb-ya)*.6,Math.max(10,nh*1.2)),ym=(ya+yb)/2;
  c.save();c.strokeStyle=akcent;c.fillStyle=akcent;c.lineWidth=2;c.lineCap="round";
  c.beginPath();c.moveTo(x,ym+(gora?dl/2:-dl/2));c.lineTo(x,ym+(gora?-dl/2:dl/2));c.stroke();
  const t=ym+(gora?-dl/2:dl/2),k=gora?-1:1;
  c.beginPath();c.moveTo(x,t+k*4);c.lineTo(x-4,t-k*1.5);c.lineTo(x+4,t-k*1.5);c.closePath();c.fill();
  c.restore();
}
// `prosty`: prawy koniec równo ucięty (nuta ze zjazdem: taśma przechodzi w rampę, darty brzeg robił tam szew).
function sciezkaTasmy(c,w,h,ziarno,falisty,prosty){
  const x0=-w/2,x1=w/2,y0=-h/2,zz=Math.min(3,w/6),zeby=h<12?2:3;
  const los=k=>((ziarno*37+k*53)%11)/10;   // 0..1, stałe dla nuty
  c.beginPath();
  c.moveTo(x0+zz,y0);c.lineTo(prosty?x1:x1-zz,y0);
  if(prosty)c.lineTo(x1,y0+h);
  else if(falisty){
    for(let k=0;k<zeby*2;k++){
      const ya=y0+h*k/(zeby*2),yb=y0+h*(k+1)/(zeby*2);
      c.quadraticCurveTo(x1+(k%2?-zz*.3:zz*1.4),(ya+yb)/2,x1-zz*(k%2?0:.6),yb);
    }
  }else{
    for(let k=1;k<=zeby*2;k++)c.lineTo(x1-(k%2?0:zz)-los(k)*zz*.5,y0+h*k/(zeby*2));
  }
  c.lineTo(x0+zz,y0+h);
  for(let k=zeby*2-1;k>=0;k--)c.lineTo(x0+(k%2?0:zz)+los(k+7)*zz*.5,y0+h*k/(zeby*2));
  c.closePath();
}
// Bitmapy nut (10-04): taśma nuty, która jeszcze nie dojechała do linii „teraz”, wygląda stale (nieaktywna,
// nieminiona, bez trafień, kliknięć, ocen i ognia), więc rysuje się RAZ do bitmapy, a potem co klatkę tylko
// drawImage. Pomiar 10-04 (pełny ekran, Intel): złożone ścieżki taśm były największym kosztem klatki (bez nut
// 45 → 80 fps). Rysunek to DOKŁADNIE gałąź rysujTor dla takiej nuty: zmiana wyglądu taśmy tam = zmiana tutaj.
// Bitmapa leży w środku nuty (x0+w/2, y), obrócona o ten sam przechył. Najwyżej ZC_SPRAJT_NA_KLATKE nowych bitmap
// na klatkę (start piosenki: kilkadziesiąt nut naraz), reszta w tej klatce rysuje się po staremu (wynik null).
const ZC_SPRAJT_NA_KLATKE=8;
// Styl taśm nut z efekty-nuty.js (10-05): zależy od stopnia klawiszy toru (lidera), np. „Upiorna noc” zmienia materiał
// taśm z postępem piosenki jak platformy w Icy Tower. Brak modułu albo stylu = kraft. Granice „pięter” raz na grę.
function stylNut(L){
  if(typeof EfektyNuty==="undefined"||!EfektyNuty)return null;
  const wk=wpisKlawiszyToru(L);return wk?EfektyNuty.dla(wk.id):null;
}
function graniceNut(sn){
  const G=S.gra;if(!G||!sn)return [];
  if(!G.graniceNut||G.graniceNut.id!==sn.id)G.graniceNut={id:sn.id,b:sn.granice(G.piosenka.koniec,G.metrum)};
  return G.graniceNut.b;
}
// Ciało taśmy (ścieżka taśmy jest na kontekście): kraft z wzorem albo styl nut przycięty do taśmy, potem dodatki poza
// obrysem. Styl rysuje własne ścieżki, więc ścieżka taśmy wraca na kontekst (wołający dalej robi fill/stroke). Zwraca
// kolor obrysu taśmy (styl) albo null (domyślny).
function wypelnijTasme(c,L,i,n,w,nh,falisty,sn){
  if(!sn){c.fillStyle=ZC_KRAFT;c.fill();c.fillStyle=wzorTasmy();c.fill();return null;}
  const o={ep:sn.epoka(n.t,graniceNut(sn)),ziarno:i,akcent:L.tor.styl.akcent};
  try{c.save();c.clip();sn.cialo(c,w,nh,o);c.restore();
    if(sn.poza){c.save();sn.poza(c,w,nh,o);c.restore();}}
  catch(e){bladStopnia("nuty|"+sn.id,"styl nut „"+sn.id+"”",e);}
  sciezkaTasmy(c,w,nh,i,falisty&&!n.p,!!n.p);
  return sn.brzeg(o.ep);
}
// Bitmapa minionej taśmy (rysujTor): klucz = wszystko, co jeszcze może zmienić jej wygląd po minięciu linii.
function kluczMinionej(t,i,plonie,sn,st){
  let s=(plonie?"P"+((t.spal&&t.spal[i])||0):"")+(sn?sn.id:"")+st.akcent;
  for(const g of t.gracze){const k=g.klik[i],sg=g.wypel[i];
    s+="|"+(k?(k.wp?k.w:"-")+(k.zp?k.z:"-")+(k.wpkt?k.wpktOc:""):"")+(sg?sg.length:0);}
  const oc=t.oceny[i];return s+(oc?(oc.wibrato?"W":"o"):"");
}
// Płótno o zapasie na główki, cień, spinacz „w punkt” i dodatki stylu nut; bitmapa z poprzednim kluczem oddaje swoje.
function bitmapaMinionej(M,i,kl,w,nh,sn,stara){
  const rs=Math.max(4,nh*.62),padX=rs+8,padY=Math.max(nh/2,rs)+10+Math.max(3,nh*.22)+Math.ceil(w*.02)+(sn?sn.zapas(nh):0);
  const cw=Math.ceil(w+padX*2),ch=Math.ceil(padY*2),d=R.dpr,W=Math.ceil(cw*d),H=Math.ceil(ch*d);
  const cv=(stara&&stara.cv)||wezPlotno();
  if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H;}
  const c=cv.getContext("2d");c.setTransform(d,0,0,d,0,0);c.clearRect(0,0,cw,ch);
  const b={cv,c,kl,w,nh,cw,ch};M.set(i,b);return b;
}
function sprajtNuty(L,i,n,w,nh,kat,st){
  const K=L.tor.sprajty||(L.tor.sprajty=new Map());
  const b=K.get(i);
  const sn=stylNut(L),sid=sn?sn.id:"";
  // szerokość i przechył liczą się z pozycji przewijania i drgają na ułamkach piksela: porównanie z tolerancją, inaczej
  // część bitmap budowała się od nowa w każdej klatce (pomiar 10-10)
  if(b&&Math.abs(b.w-w)<.5&&b.nh===nh&&b.akcent===st.akcent&&Math.abs(b.kat-kat)<1e-3&&b.sid===sid)return b;
  if(!(R.sprajtyBudzet>0))return null;
  R.sprajtyBudzet--;
  const falisty=n.d>=ZC_PUNKTY.WIB_DLUGOSC,rs=Math.max(4,nh*.62),re=Math.max(3,nh*.45);
  const padX=rs+6,padY=Math.max(nh/2,rs)+6+Math.ceil(w*.02)+(sn?sn.zapas(nh):0);   // główka startu wystaje w lewo, przechył ≤ 1° podnosi końce; dodatki stylu nut
  const cw=Math.ceil(w+padX*2),ch=Math.ceil(padY*2),d=R.dpr;
  const cv=(b&&b.cv)||wezPlotno();cv.width=Math.ceil(cw*d);cv.height=Math.ceil(ch*d);
  const c=cv.getContext("2d");c.setTransform(d,0,0,d,0,0);c.clearRect(0,0,cw,ch);
  c.translate(cw/2,ch/2);c.rotate(kat);
  sciezkaTasmy(c,w,nh,i,falisty&&!n.p,!!n.p);
  c.save();c.translate(3,3);c.fillStyle=paletaKarty().cienNuty;c.fill();c.restore();
  const brz=wypelnijTasme(c,L,i,n,w,nh,falisty,sn);
  c.fillStyle=st.akcent;c.fillRect(-w/2+3,nh/2-Math.max(2,nh*.28),w-6,Math.max(2,nh*.28));
  if(nh>=14){c.fillStyle="rgba(255,255,255,.35)";c.fillRect(-w/2+3,-nh/2+2,w-6,nh*.16);}
  c.strokeStyle=brz||ZC_KRAFT_BRZEG;c.lineWidth=1;c.stroke();
  if(!n.p&&w>=rs+re+6){
    c.fillStyle=ZC_KRAFT;c.strokeStyle="#211f1d";c.lineWidth=1.4;
    c.beginPath();c.arc(w/2,0,re,0,Math.PI*2);c.fill();c.stroke();
    c.strokeStyle=st.akcent;c.lineWidth=Math.max(1.5,re*.4);c.beginPath();c.arc(w/2,0,re*.5,0,Math.PI*2);c.stroke();
  }
  c.fillStyle=st.akcent;c.strokeStyle="#211f1d";c.lineWidth=1.5;
  c.beginPath();c.arc(-w/2,0,rs,0,Math.PI*2);c.fill();c.stroke();
  c.fillStyle="rgba(255,255,255,.45)";c.beginPath();c.arc(-w/2-rs*.3,-rs*.3,rs*.28,0,Math.PI*2);c.fill();
  const nb={cv,w,nh,kat,akcent:st.akcent,cw,ch,sid};K.set(i,nb);return nb;
}
function rysujTor(c,L,teraz){
  const G=S.gra,t=L.tor,st=t.styl,nuty=t.def.nuty,ile=t.gracze.length;
  const b0=G.beat-(L.teraz-L.x)/L.pxNaBeat,b1=G.beat+(L.x+L.w-L.teraz)/L.pxNaBeat;
  const ciasny=L.rh<12||(R.tory.length>=4&&L.w>R.W*.6);   // rzędy półtonów za niskie na naklejki pod taśmą (zawsze na 4 pasach; ćwiartka siatki jest wysoka)
  c.save();c.beginPath();c.roundRect(L.x+2,L.y+2,L.w-4,L.h-4,14);c.clip();
  // ?nutyGL=1: bitmapy taśm idą do NutyGL (#glNuty pod #scena), a to, co leży pod taśmami, na #scenaPod (cp) pod nimi
  const NG=R.nutyGL,cp=NG?NG.pod:c;
  if(NG){NG.klip(L.x+2,L.y+2,L.w-4,L.h-4,14);cp.save();cp.beginPath();cp.roundRect(L.x+2,L.y+2,L.w-4,L.h-4,14);cp.clip();}
  const bitmapa=(b,x,y)=>{if(!NG||!NG.obraz(b,x,y,b.cw,b.ch))c.drawImage(b.cv,x,y,b.cw,b.ch);};
  const zar=t.zar||0,sPerBeat=60/G.bpm,dlugSladu=ZC_SLAD_SEK/sPerBeat*L.pxNaBeat,sty=stylToru(L),sn=stylNut(L);
  if(zar>.03)rysujScenePlonaca(cp,L,zar,teraz,sty.scena);
  // kreski taktowe płyną razem z nutami
  const PK=paletaKarty();
  // 10-17 (pomiar GPU: przerywana kreska przez cały tor kosztowała ok. 15 % pracy karty w klatce): jedna bitmapa kreski na tor,
  // co klatkę tylko drawImage w miejscu każdego taktu; wygląd ten sam (1 px, kreski 3/5 od górnej krawędzi). ?zapas=0 = dawne ścieżki.
  const hK=L.y+L.h-6-(L.gorna-4);
  if(ZC_DEV.zapas&&hK>4){
    const kb=bufor("kreska|"+PK.kreski+"|"+Math.round(hK),2,hK,o=>{o.strokeStyle=PK.kreski;o.lineWidth=1;o.setLineDash([3,5]);o.beginPath();o.moveTo(.5,0);o.lineTo(.5,hK);o.stroke();});
    for(let k=Math.max(0,Math.ceil(b0/G.metrum));k*G.metrum<=b1;k++)cp.drawImage(kb.cv,Math.round(xBeat(L,k*G.metrum)),L.gorna-4,2,hK);
  }else{
  cp.strokeStyle=PK.kreski;cp.lineWidth=1;cp.setLineDash([3,5]);cp.beginPath();
  for(let k=Math.max(0,Math.ceil(b0/G.metrum));k*G.metrum<=b1;k++){
    const x=Math.round(xBeat(L,k*G.metrum))+.5;cp.moveTo(x,L.gorna-4);cp.lineTo(x,L.y+L.h-6);
  }
  cp.stroke();cp.setLineDash([]);}
  if(sn&&sn.znak){   // styl nut z piętrami: kreska granicy w fiolecie i tabliczka z nazwą nowego piętra
    graniceNut(sn).forEach((b,k)=>{
      if(b<b0-2||b>b1+2)return;
      const x=Math.round(xBeat(L,b))+.5;
      cp.save();cp.strokeStyle="rgba(75,42,122,.55)";cp.lineWidth=2;cp.setLineDash([6,4]);cp.beginPath();cp.moveTo(x,L.gorna-4);cp.lineTo(x,L.y+L.h-6);cp.stroke();cp.restore();
      try{sn.znak(cp,x,L.y+4,R.f,k+1);}catch(e){bladStopnia("nuty|znak|"+sn.id,"tabliczka stylu nut",e);}
    });
  }
  // nuty: paski taśmy malarskiej (kraft + nasycony pasek partii)
  while(t.ptrRys<nuty.length&&nuty[t.ptrRys].t+nuty[t.ptrRys].d<b0-1){if(t.minione){const mb=t.minione.get(t.ptrRys);if(mb){oddajPlotno(mb.cv);t.minione.delete(t.ptrRys);}}t.ptrRys++;}
  const nh=Math.max(8,Math.min(30,Math.max(L.rh*.6,Math.min(L.rh*1.15,14))));
  for(let i=t.ptrRys;i<nuty.length&&nuty[i].t<=b1;i++){
    const n=nuty[i],x0=xBeat(L,n.t)+1,x1=xBeat(L,n.t+n.d)-2,wCala=Math.max(5,x1-x0),y=ySemi(L,n.m);
    // przejście: taśma kończy się tam, gdzie zaczyna się rampa, a rampa (pod taśmami) dojeżdża do następnej nuty
    const w=n.p?Math.max(5,Math.min(wCala,wCala*n.p.od)):wCala;
    if(n.p)rysujPrzejscie(cp,x0+w-5,y,x1+3,ySemi(L,n.p.do),nh,st,n.t+n.d<=G.beat);   // zaczyna się pod taśmą, bez szwu
    const nn=nuty[i+1];
    if(nn&&(n.d0!=null||nn.t0!=null)&&Math.abs(nn.m-n.m)>=ZC_RUCH.MIN_INTERWAL)rysujStrzalkeSkoku(cp,L,n,nn,st.akcent,nh);
    // przechył naklejki, stały dla nuty: najwyżej ±1° i najwyżej 2 px różnicy wysokości między końcami taśmy,
    // więc długa nuta leży prawie płasko i nie podpowiada, że trzeba z nią jechać w górę albo w dół
    const katMaks=Math.min(Math.PI/180,Math.asin(Math.min(1,2/Math.max(1,w/2))));
    const kat=(((i*37)%21)-10)/10*katMaks;
    // 10-20: u gracza z kapslem nuta, którą gra wciąż OCENIA, jest już za linią (jego czas to G.beat − offMs), więc
    // „aktywna” to też nuta, którą któraś żaba ma pod swoim zegarem (g.idxPod). Bez tego gasła poświata trafienia na
    // ostatnich 150 ms każdej nuty, nuta krótsza niż 150 ms nie zapalała się nigdy, a wypełnienie dopisywane po
    // minięciu linii zastygało w bitmapie minionej taśmy (klucz nie widzi wydłużenia ostatniego odcinka).
    const minela=n.t+n.d<=G.beat,spiewana=t.gracze.some(g=>g.idxPod===i);
    const aktywna=spiewana||(!minela&&n.t<=G.beat);
    if(n.d0!=null)rysujDuchaNuty(cp,L,n,y,nh,minela);   // czas na ruch: prawdziwa długość nuty, blado i przerywanie
    // nuta nadjeżdżająca (jeszcze nie na linii „teraz”): gotowa bitmapa zamiast ścieżek; po dojechaniu bitmapa znika
    if(n.t>G.beat&&!t.gracze.some(g=>g.klik[i])){const b=sprajtNuty(L,i,n,w,nh,kat,st);if(b){bitmapa(b,x0+w/2-b.cw/2,y-b.ch/2);continue;}}
    else if(t.sprajty&&t.sprajty.has(i)){oddajPlotno(t.sprajty.get(i).cv);t.sprajty.delete(i);}
    let naNucie=0;   // ułamek żab toru, które właśnie śpiewają tę nutę czysto (|Δ| ≤ 0,5)
    if(aktywna)for(const g of t.gracze)if(g.idxPod===i&&g.naNucie)naNucie++;
    naNucie/=ile;
    // nuta zapala się, gdy ktoś śpiewa ją czysto na płonącym torze; raz zapalona pali się do końca (t.spal: poziom)
    const spal=t.spal||(t.spal={});
    if(aktywna&&naNucie>0&&t.ogien>=1)spal[i]=Math.max(spal[i]||0,t.ogien);
    const plonie=!!spal[i]&&grafikaPelna();
    const falisty=n.d>=ZC_PUNKTY.WIB_DLUGOSC,oc=t.oceny[i];
    // Miniona taśma (10-10, płynność): za linią „teraz” nic się na niej już nie zmienia (wypełnienie celnością,
    // kliknięcia, spinacz i zwęglenie zastygają, płomyki gasną po ok. 0,8 s), więc rysuje się RAZ do bitmapy i dalej
    // tylko jedzie w lewo, jak nuty nadjeżdżające (sprajtNuty). Dotąd każda miniona nuta co klatkę budowała od nowa
    // ścieżki, przycięcia i obrysy, co przy ogniu zapychało wątek GPU przeglądarki. Klucz bitmapy obejmuje to, co może
    // dojść tuż po minięciu (puszczenie klawisza, ocena); zmiana klucza = bitmapa od nowa.
    const scena=c;let mb=null,cel=c;
    if(minela&&!spiewana&&!(plonie&&1-(L.teraz-x1)/(dlugSladu*.35)>0)){
      const M=t.minione||(t.minione=new Map()),kl=kluczMinionej(t,i,plonie,sn,st),b0m=M.get(i);
      if(b0m&&b0m.kl===kl&&Math.abs(b0m.w-w)<.5&&b0m.nh===nh)mb=b0m;
      else if(R.sprajtyBudzet>0){R.sprajtyBudzet--;mb=bitmapaMinionej(M,i,kl,w,nh,sn,b0m);cel=mb.c;}
    }
    if(mb&&cel===scena)bitmapa(mb,x0+w/2-mb.cw/2,y-mb.ch/2);
    else{const c=cel;   // scena albo płótno bitmapy minionej taśmy (wtedy od środka bitmapy, nie od (x0 + w/2, y))
    c.save();if(c===scena)c.translate(x0+w/2,y);else c.translate(mb.cw/2,mb.ch/2);c.rotate(kat);
    sciezkaTasmy(c,w,nh,i,falisty&&!n.p,!!n.p);
    c.save();c.translate(3,3);c.fillStyle=PK.cienNuty;c.fill();c.restore();   // cień jak pod naklejkami
    if(minela)c.globalAlpha=.55;   // miniona taśma blednie, zostają na niej wyniki
    const brz=wypelnijTasme(c,L,i,n,w,nh,falisty,sn);
    c.fillStyle=st.akcent;c.fillRect(-w/2+3,nh/2-Math.max(2,nh*.28),w-6,Math.max(2,nh*.28));   // pasek partii
    if(naNucie>0){   // trafiona świeci: akcentem partii, a gdy tor płonie, ogniem (przyciszone: czytelne wypełnienie celnością)
      c.globalAlpha=naNucie*.4;
      if(zar>=1.5){const wk=sty.wypelnienie||ZC_WYPEL_OGIEN,og=c.createLinearGradient(0,-nh/2,0,nh/2);og.addColorStop(0,wk[0]);og.addColorStop(.5,wk[1]);
        og.addColorStop(1,wk[2]);c.fillStyle=og;}
      else c.fillStyle=st.akcent;
      c.fill();c.globalAlpha=1;
    }
    if(nh>=14){c.fillStyle="rgba(255,255,255,.35)";c.fillRect(-w/2+3,-nh/2+2,w-6,nh*.16);}
    c.globalAlpha=1;
    c.strokeStyle=aktywna?"#211f1d":brz||ZC_KRAFT_BRZEG;c.lineWidth=aktywna?(naNucie>0?2.5:1.6):1;c.stroke();
    // wypełnienie celnością (runda 1): zaśpiewana część taśmy przebarwia się klasą klatki
    // (limonka na nucie, bursztyn „Prawie”, róż poza), bez śpiewu zostaje kraft; w chórze każda żaba ma swój
    // rządek. Przycięte do kształtu taśmy, zwykłe wypełnienie (działa też w grafice uproszczonej). Odcinki są
    // w czasie gracza, więc malują nutę od jej początku; `Math.min(o.do,G.beat)` zostaje na ujemne „Opóźnienie
    // kapsli” — nawet wtedy farba nie wyjdzie przed linię „teraz”, na nuty jeszcze niezagrane.
    if(n.t<G.beat){
      const gora=-nh/2+2,wys=nh-4-Math.max(2,nh*.28),rh=wys/ile,sx=x0+w/2;
      let clip=false;
      t.gracze.forEach((g,j)=>{
        const sg=g.wypel[i];if(!sg)return;
        if(!clip){c.save();c.clip();clip=true;}
        for(const o of sg){
          const xa=Math.max(-w/2,xBeat(L,Math.max(o.od,n.t))-sx),xb=Math.min(w/2,xBeat(L,Math.min(o.do,G.beat))-sx);
          if(xb<=xa)continue;
          c.fillStyle=ZC_WYPEL_KOLOR[o.k];c.fillRect(xa,gora+j*rh,xb-xa+.6,rh);
        }
      });
      if(clip)c.restore();
    }
    // główki nuty: pełne kółko na początku (tu zaczynasz śpiewać), pierścień na końcu
    // (tu kończysz). Nuta ze zjazdem nie ma końcowej główki, bo jej linia biegnie dalej, do główki następnej.
    // Klik w rytm wypełnia główkę: limonka = idealnie, bursztyn = dobrze (na torze z chórem najlepsza żaba).
    const rs=Math.max(4,nh*.62),re=Math.max(3,nh*.45),klik={};
    for(const pole of ["w","z"])for(const g of t.gracze){const k=g.klik[i];if(k&&k[pole+"p"]&&klik[pole]!=="idealnie")klik[pole]=k[pole]==="idealnie"?"idealnie":klik[pole]||k[pole];}
    const kolKlik=o=>o==="idealnie"?"#a6d861":"#eaa32b";
    if(minela)c.globalAlpha=.55;
    if(!n.p&&w>=rs+re+6){
      c.fillStyle=klik.z?kolKlik(klik.z):ZC_KRAFT;c.strokeStyle="#211f1d";c.lineWidth=1.4;
      c.beginPath();c.arc(w/2,0,re,0,Math.PI*2);c.fill();c.stroke();
      c.strokeStyle=st.akcent;c.lineWidth=Math.max(1.5,re*.4);c.beginPath();c.arc(w/2,0,re*.5,0,Math.PI*2);c.stroke();
    }
    c.fillStyle=klik.w?kolKlik(klik.w):st.akcent;c.strokeStyle="#211f1d";c.lineWidth=aktywna?2:1.5;
    c.beginPath();c.arc(-w/2,0,rs,0,Math.PI*2);c.fill();c.stroke();
    c.fillStyle="rgba(255,255,255,.45)";c.beginPath();c.arc(-w/2-rs*.3,-rs*.3,rs*.28,0,Math.PI*2);c.fill();
    // spinacz „w punkt”: złota klamra nad taśmą od główki do główki (nuta naciśnięta i puszczona w punkt), zostaje na minionej
    let wp=null;for(const g of t.gracze){const k=g.klik[i];if(k&&k.wpkt&&wp!=="idealnie")wp=k.wpktOc;}
    if(wp){
      const yk=-nh/2-Math.max(3,nh*.22),xa=-w/2,xb=n.p?w/2-2:w/2;
      c.lineCap="round";c.lineJoin="round";c.beginPath();c.moveTo(xa,-nh*.15);c.lineTo(xa,yk);c.lineTo(xb,yk);c.lineTo(xb,-nh*.15);
      c.strokeStyle="#211f1d";c.lineWidth=5;c.stroke();c.strokeStyle=wp==="idealnie"?"#ec1a83":ZC_WPUNKT_KOLOR;c.lineWidth=2.6;c.stroke();
    }
    c.globalAlpha=1;
    // ciasny tor (4 tory): zamiast naklejki „Wibrato!” falisty znaczek 6 px w akcencie na prawym końcu
    // taśmy, w obrębie jej rzędu (naklejka pod taśmą wjeżdżała na sąsiednie rzędy i na żaby)
    if(oc&&oc.wibrato&&ciasny){
      c.beginPath();
      for(let k=0;k<=12;k++){const xx=w/2-15+k,yy=Math.sin(k/12*Math.PI*4)*1.5;if(k)c.lineTo(xx,yy);else c.moveTo(xx,yy);}
      c.lineCap="round";c.lineJoin="round";c.strokeStyle="#211f1d";c.lineWidth=3;c.stroke();
      c.strokeStyle=st.akcent;c.lineWidth=1.6;c.stroke();
    }
    if(plonie){   // ogień wokół nuty: front spalenizny idzie z linią „teraz”, miniona taśma zostaje zwęglona
      const fx=minela?w/2:L.teraz-(x0+w/2),ts=teraz/1000,gas=minela?1-(L.teraz-x1)/(dlugSladu*.35):1;   // po minięciu płomyki gasną w ~0,8 s
      sty.nuty(c,w,nh,fx,spal[i],ts,i,aktywna,gas);
      if(aktywna&&sty.dym!==false)dodajDym(Math.min(x1,L.teraz),y-nh/2,spal[i]>=2?7:3,spal[i]/3,sty.dym||null);
    }
    c.restore();
    if(c!==scena)bitmapa(mb,x0+w/2-mb.cw/2,y-mb.ch/2);}
    if(oc){
      const nk=naklejkaOceny(oc.ocena,i%2);
      // koniec taśmy blisko linii „teraz”: naklejka cofa się za głowę lidera (prawy brzeg przed promieniem żaby)
      const granica=L.teraz-L.zaba*.6-4,blisko=x1>L.teraz-ZC_STREFY.BLISKO_TERAZ;
      if(w>=nk.w*.8){const nx=blisko?Math.min(x1-nk.w+6,granica-nk.w):x1-nk.w+6;c.drawImage(nk.cv,nx,y-nh/2-nk.h+5,nk.w,nk.h);
        if(R.naklejkiOcen&&nx+nk.w>L.x&&nx<L.x+L.w)R.naklejkiOcen.push({x:nx,y:y-nh/2-nk.h+5,w:nk.w,h:nk.h,teraz:L.teraz});}
      else{
        c.fillStyle=ZC_OCENY_KOLOR[oc.ocena];c.strokeStyle="#211f1d";c.lineWidth=1.3;
        c.beginPath();c.arc(blisko?Math.min(x1-2,granica-5):x1-2,y-nh/2-3,4.5,0,Math.PI*2);c.fill();c.stroke();
      }
      if(oc.wibrato&&!ciasny){const wk=naklejkaTekstu(T.wibrato,"#eaa32b",11*R.f);c.drawImage(wk.cv,x1-wk.w+4,y+nh/2-2,wk.w,wk.h);}
      // chór: pod taśmą kropki graczy (kolor gracza, obwódka 2 px w kolorze jego oceny): 8 px na jednym
      // torze, 7 px na średnich, w kilku równych rzędach, gdy nie mieszczą się w szerokości nuty; na ciasnych
      // torach (4 tory) bez kropek, wystarczy słupek średniej w akcencie
      const kd=L.h>=400?8:ciasny?0:7;
      if(kd&&ile>=2&&oc.ile===ile){
        const rzedy=Math.ceil(ile/Math.max(1,Math.floor((w-4+3)/(kd+3)))),wRzedzie=Math.ceil(ile/rzedy);
        t.gracze.forEach((g,j)=>{const wx=g.wyniki[i];if(!wx)return;
          const kx=x0+2+kd/2+(j%wRzedzie)*(kd+3),ky=y+nh/2+3+kd/2+Math.floor(j/wRzedzie)*(kd+3);
          c.fillStyle=g.kolor;c.strokeStyle=ZC_OCENY_KOLOR[wx.ocena];c.lineWidth=2;
          c.beginPath();c.arc(kx,ky,kd/2-1,0,Math.PI*2);c.fill();c.stroke();
          // cienki tusz na zewnątrz: obwódka „Pudło” (kolor papieru) też jest widoczna
          c.strokeStyle="rgba(33,31,29,.6)";c.lineWidth=1;c.beginPath();c.arc(kx,ky,kd/2+.5,0,Math.PI*2);c.stroke();});
      }
    }
  }
  // ślady śpiewu: cienka linia w kolorze gracza, pisana w JEGO czasie (dopiszSlad), więc leży dokładnie na nutach,
  // które ocenia; gaśnie w stronę przeszłości. Kończy się na linii „teraz” gracza bez opóźnienia, a u kapsla o
  // „Opóźnienie kapsli” wcześniej (150 ms = 37 px przy 132 BPM, czyli pod głową żaby) — stąd xT liczone per gracz.
  const dlug=dlugSladu;
  for(const g of t.gracze){
    const sl=g.slad;if(sl.length<2)continue;
    const xT=L.teraz-(g.offMs||0)/1000/sPerBeat*L.pxNaBeat;
    if((g.ogien||0)>=1)rysujSladStylem(c,L,g,sl,dlug,teraz,sty,xT);   // ślad w ogniu (styl lidera toru): smuga żaru, płomyki, dym
    const gr=c.createLinearGradient(xT-dlug,0,xT,0);
    gr.addColorStop(0,rgba(g.kolor,0));gr.addColorStop(1,rgba(g.kolor,.95));
    c.strokeStyle=gr;c.lineWidth=2.6;c.lineJoin="round";c.lineCap="round";c.beginPath();
    let pioro=false;
    for(const p of sl){
      if(!p.sp){pioro=false;continue;}
      const x=xBeat(L,p.b),y=ySemi(L,p.s);
      if(pioro)c.lineTo(x,y);else{c.moveTo(x,y);pioro=true;}
    }
    c.stroke();
  }
  rysujKlawiszeGraczy(c,L);
  // stopień klawiszy toru (lider): 2D co klatkę po klawiszach graczy i prymitywy GPU, osobno dla każdej żaby toru
  const sk=R.st,wk=wpisKlawiszyToru(L);
  if(sk&&wk&&(wk.gracz||wk.fx))for(const g of t.gracze){hakStopnia("klawisze",wk,"gracz",c,L,g,sk);hakStopnia("klawisze",wk,"fx",L,g,sk);}
  // chór od lewej do prawej (lider na linii rysuje się ostatni), potem kapsle albo etykiety na wierzchu
  if(t.duch&&t.duch.alfa>.01)rysujDucha(c,L,t.duch,teraz);   // pod żabami: gracz nakłada swoją żabę na ducha
  for(let j=ile-1;j>=0;j--)rysujZabe(c,L,t.gracze[j],teraz);
  // stopień streaka toru (lider): hak co klatkę po śladzie i żabach (pierścienie, dysk, warp) oraz zerwanie kombo
  // (spadek do 0 z co najmniej 2; poprzednie kombo w g._komboPop, zerowane w przypiszStyle)
  for(const g of t.gracze){
    const k=g.kombo||0;
    if(sk&&sty.tor)hakStopnia("streak",sty,"tor",c,L,g,sk);
    if(sk&&sty.zerwanie&&k===0&&(g._komboPop||0)>=2)hakStopnia("streak",sty,"zerwanie",L,g,sk);
    g._komboPop=k;
  }
  for(const g of t.gracze){if(ile>=3)rysujKapsel(c,L,g);else rysujEtykiete(c,L,g,ile);}
  if(t.duch&&t.duch.alfa>.01&&t.duch.spiewa)rysujZnaczekDucha(c,L,t.duch);
  const et=etykietaToru(L);c.drawImage(et.cv,L.x+12,L.y+4,et.w,et.h);
  c.restore();if(NG)cp.restore();
  // fałsz: obrzeże toru błyska różem przez 2 klatki (ścieg toru), bez nowej naklejki
  if(t.blysk>0){c.strokeStyle="#ec1a83";c.lineWidth=3.5;c.beginPath();c.roundRect(L.x+5,L.y+5,L.w-10,L.h-10,11);c.stroke();t.blysk--;}
}
const ZC_SCENA_KOL=["255,216,74","234,163,43","236,26,131"],ZC_WYPEL_OGIEN=["#ffd84a","#eaa32b","#ec1a83"],ZC_AURA=["#ec1a83","#eaa32b"];
// Tor w ogniu (za nutami): ciepła poświata od linii „teraz” i scena chóru (przeszłość, lewa część toru)
// rozgrzana od dołu. Same płomienie palą się na śladzie za żabą, na jej głowie i wokół nut
// (nie klawisze). `zar` = wygładzony poziom ognia toru 0–3.
// Płynność (10-10): oba gradienty (pełna moc, bez pulsu) leżą w bitmapie toru w 1/4 rozdzielczości, bo są gładkie;
// co klatkę jedno drawImage z alfą = moc × puls zamiast dwóch gradientów na cały tor.
function rysujScenePlonaca(c,L,zar,teraz,kol){
  const f=Math.min(1,zar/3),puls=.85+.15*Math.sin(S.gra.beat*Math.PI*2),K=kol||ZC_SCENA_KOL;
  const b=bufor("scenaPl|"+R.wersja+"|"+L.x+","+L.y+","+L.w+","+L.h+"|"+K.join("/"),L.w/4,L.h/4,o=>{
    o.scale(.25,.25);o.translate(-L.x,-L.y);
    const sr=o.createRadialGradient(L.teraz,L.y+L.h*.55,0,L.teraz,L.y+L.h*.55,Math.max(L.h,L.w*.45));
    sr.addColorStop(0,"rgba("+K[0]+",.26)");sr.addColorStop(.5,"rgba("+K[1]+",.12)");sr.addColorStop(1,"rgba("+K[2]+",0)");
    o.fillStyle=sr;o.fillRect(L.x,L.y,L.w,L.h);
    const dol=o.createLinearGradient(0,L.y+L.h*.35,0,L.y+L.h);
    dol.addColorStop(0,"rgba("+K[2]+",0)");dol.addColorStop(1,"rgba("+K[2]+",.2)");
    o.fillStyle=dol;o.fillRect(L.x,L.y,L.teraz-L.x,L.h);
  });
  c.globalAlpha=f*puls;c.drawImage(b.cv,L.x,L.y,L.w,L.h);c.globalAlpha=1;
}
// Klawisze graczy na klawiaturze toru: klawisz pod śpiewaną wysokością świeci kolorem gracza (mocno, gdy śpiewa).
// Ogień kombo NIE pali klawiszy: płonie ślad za żabą, jej głowa i nuty.
function rysujKlawiszeGraczy(c,L){
  const t=L.tor;
  for(const g of t.gracze){
    const s=Math.max(L.dolN,Math.min(L.goraN,Math.round(g.polton))),k=prostokatKlawisza(L,s);
    c.globalAlpha=g.spiewa?.9:.35;c.fillStyle=g.kolor;c.beginPath();c.roundRect(k.x+1,k.y+.5,k.w-2,Math.max(1,k.h-1),2);c.fill();
    c.globalAlpha=1;
    if(g.spiewa&&g.naNucie){c.strokeStyle="#211f1d";c.lineWidth=1.4;c.stroke();}
  }
}
// Ślad w ogniu: smuga żaru pod linią gracza, a w pełnej grafice płomyki wzdłuż niej (gęściej i wyżej przy
// większym ogniu), dym znad płomyków i iskry z najświeższego końca, czyli zza głowy żaby.
function rysujSladPlonacy(c,L,g,sl,dlug,teraz,xT){
  const x=xT==null?L.teraz:xT;   // koniec śladu tego gracza (u kapsla o „Opóźnienie kapsli” przed linią „teraz”)
  rysujSladPlonacyPkt(c,punktySladu(L,sl),g.ogien||0,teraz/1000,x-dlug,x,dlug,g.nrWTorze*31,null,grafikaPelna(),true);
}
// Punkty śladu na ekranie: jedna tablica i te same obiekty dla danego śladu co klatkę (10-05: sl.map tworzył ok. 176
// obiektów na ślad w każdej klatce = presja GC). Odbiorcy (rysujSladPlonacyPkt, sty.slad w efekty*.js) czytają
// punkty tylko w tej klatce, nie trzymają ich.
const ZC_PUNKTY_SLADU=new WeakMap();
function punktySladu(L,sl){
  let a=ZC_PUNKTY_SLADU.get(sl);if(!a){a=[];ZC_PUNKTY_SLADU.set(sl,a);}
  for(let i=0;i<sl.length;i++){const p=sl[i],o=a[i]||(a[i]={x:0,y:0,sp:false});o.x=xBeat(L,p.b);o.y=ySemi(L,p.s);o.sp=p.sp;}
  a.length=sl.length;return a;
}
// Ślad w ogniu z punktów ekranu (x, y, sp): smuga od x0 do xT, płomyki w pełnej grafice; `pal` = paleta stylu,
// `emituj` = dym z płomyków (miniatura w karcie gracza go nie sypie).
function rysujSladPlonacyPkt(c,pts,og,ts,x0,xT,dlug,ziarno,pal,pelna,emituj){
  const sm=(pal||ZC_OGIEN_PAL).smuga,smuga=c.createLinearGradient(x0,0,xT,0);
  smuga.addColorStop(0,"rgba("+sm[0]+",0)");smuga.addColorStop(.6,"rgba("+sm[1]+","+(og>=2?.45:.3)+")");
  smuga.addColorStop(1,"rgba("+sm[2]+","+(og>=2?.85:.6)+")");
  c.strokeStyle=smuga;c.lineWidth=og>=3?9:og>=2?6:4;c.lineJoin="round";c.lineCap="round";c.beginPath();
  let pi=false;for(const p of pts){if(!p.sp){pi=false;continue;}if(pi)c.lineTo(p.x,p.y);else{c.moveTo(p.x,p.y);pi=true;}}
  c.stroke();
  if(!pelna||og<2)return;
  // płomyki co ~14 px wzdłuż śladu (świeży koniec najwyżej), tylko na odcinkach, gdzie żaba śpiewała
  const krok=og>=3?11:15,hMax=(og>=3?26:16)*Math.min(1.6,R.f);
  let ostX=-1e9,nr=0;
  for(const p of pts){
    if(!p.sp)continue;
    const x=p.x;if(x-ostX<krok||x<x0)continue;ostX=x;nr++;
    const y=p.y,f=Math.max(0,Math.min(1,(x-x0)/dlug)),moc=f*f;
    rysujOgienMiekki(c,x,y+2,krok*1.1,hMax*(.5+.5*moc),ts,nr+ziarno,moc*(og>=3?1:.8),pal);
    if(emituj&&moc>.5&&(nr%3===0))dodajDym(x,y-hMax*.5*moc,og>=3?5:3,moc,pal&&pal.dym);
  }
}
// Ślad toru stylem lidera: domyślny ogień dawną drogą, inne style dostają punkty ekranu i parametry ognia.
function rysujSladStylem(c,L,g,sl,dlug,teraz,sty,xT){
  if(!sty||sty.id==="ogien"){rysujSladPlonacy(c,L,g,sl,dlug,teraz,xT);return;}
  const x=xT==null?L.teraz:xT;
  sty.slad(c,{pts:punktySladu(L,sl),og:g.ogien||0,ts:teraz/1000,x0:x-dlug,xT:x,dlug,ziarno:g.nrWTorze*31,
    pelna:grafikaPelna(),emituj:true,kolor:g.kolor});
}
// Iskry: małe żarzące się kropki lecą w górę i w prawo, z żółci przez bursztyn do różu, i gasną.
// Emitery: głowa żaby (rysujZabe) przez dodajIskry; dym (R.dym) ma własną listę i rysujDym.
// Kropka iskry w danym kolorze (10-10, płynność): 24 px, ostry brzeg; skalowana do promienia iskry. Kolor bierzemy
// z fillStyle już ustawionego przez rysujIskry, więc style streaka z własnymi kolorami działają bez zmian.
function kropkaIskry(kolor){
  return bufor("iskra|"+kolor,24,24,c=>{c.fillStyle=kolor;c.beginPath();c.arc(12,12,11.5,0,Math.PI*2);c.fill();}).cv;
}
function rysujIskry(c,dt){
  R.dtIskier=dt;
  const lista=R.iskry;if(!lista||!lista.length)return;
  const kol=["#ffd84a","#eaa32b","#ec1a83"];
  for(const p of lista){p.wiek+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=40*dt;}
  R.iskry=lista.filter(p=>p.wiek<p.zycie);
  for(const p of R.iskry){
    const f=p.wiek/p.zycie,k=p.k,r=p.r*(1-.5*f),ks=k&&k.ksztalt;
    c.globalAlpha=Math.max(0,1-f);c.fillStyle=(k&&k.kolory||kol)[Math.min(2,Math.floor(f*3))];
    if(!ks||ks==="kolo"){const im=kropkaIskry(c.fillStyle);c.drawImage(im,p.x-r,p.y-r,2*r,2*r);}   // bitmapa: setki kółek na klatkę bez ścieżek
    else if(ks==="kwadrat")c.fillRect(Math.round(p.x-r),Math.round(p.y-r),Math.ceil(2*r),Math.ceil(2*r));
    else if(ks==="pasek"){const sz=2*r*(.3+.7*Math.abs(Math.cos(p.wiek*12+p.x)));c.fillRect(p.x-sz/2,p.y-r*.5,sz,r);}
    else if(ks==="gwiazda"){const s=r*4;c.drawImage(blysk().cv,p.x-s/2,p.y-s/2,s,s);}
    else c.drawImage(kropkaIskry(c.fillStyle),p.x-r*.8,p.y-r*1.2,r*1.6,r*2.4);   // „babel”: kropla (ta sama kropka, rozciągnięta)
  }
  c.globalAlpha=1;
}
// Żaba-duch „Pokaż jak”: półprzezroczysta (alfa 0,45) na linii „teraz”, w kolorze gracza toru; nad nią
// znaczek „Tak!”, kiedy śpiewa nutę pod linią.
const pozycjaDucha=(L,d)=>Math.max(L.y+L.zaba*.42,Math.min(L.y+L.h-L.zaba*.36,ySemi(L,d.polton)));
function rysujDucha(c,L,d,teraz){
  const def=L.tor.def,poz=Math.max(0,Math.min(1,(d.polton-(def.lo-2))/(def.hi-def.lo+4)));
  const img=zabaNaklejka(d.spiewa?Math.min(4,Math.floor(poz*4.999)):0,d.kolor,false);if(!img)return;
  const sc=L.zaba*(d.spiewa?1.1:1)*img.w/96;
  c.save();c.globalAlpha=d.alfa;c.translate(L.teraz,pozycjaDucha(L,d));c.rotate(Math.sin(teraz/1000*2.2)*.06);
  c.drawImage(img.cv,-sc/2,-sc/2,sc,sc);c.restore();
}
function rysujZnaczekDucha(c,L,d){
  const nk=naklejkaTekstu(T.duchTak,"#6cb33f",12*R.f),y=pozycjaDucha(L,d);
  c.save();c.globalAlpha=Math.min(1,d.alfa/ZC_DUCH_ALFA);
  c.drawImage(nk.cv,L.teraz-nk.w+14,Math.max(L.y+2,y-L.zaba*.62-nk.h+4),nk.w,nk.h);c.restore();
}
// Środek żaby gracza: lider na linii „teraz”, reszta chóru w lewo co L.krokX; przy krawędziach toru dociśnięta.
function pozycjaZaby(L,g){
  const s=L.zaba;
  return {x:L.teraz-g.nrWTorze*L.krokX,y:Math.max(L.y+s*.42,Math.min(L.y+L.h-s*.36,ySemi(L,g.polton)))};
}
function rysujZabe(c,L,g,teraz){
  const w=zrodloGracza(g),G=S.gra,s=L.zaba,pz=pozycjaZaby(L,g),x=pz.x,y=pz.y-6*(g.rechot||0);   // rechot: skok 6 px
  const cicha=!w||(w.zrodlo==="kapsel"&&(!w.swiezy||w.wyciszony));
  // gadanie w pauzie: pysk otwiera się na każde „kum”; po 2 s gadania żaba jest zmęczona (półotwarty pysk)
  // rechot: pysk otwarty według wysokości (jak przy śpiewie), między „kum” półotwarty
  let klatka=g.spiewa||(g.rechot||0)>.05?Math.min(4,Math.floor(g.poz*4.999)):g.gada?1:0,puls=1;
  if(S.ekran==="odliczanie"){   // odchrząkiwanie: krótkie otwarcie pyska i podskok
    const o=G.odchrzakniecia.find(o=>o.g===g);
    if(o&&G.beat>=o.b&&G.beat<o.b+.45){klatka=G.beat<o.b+.2?2:1;puls=1.1;}
  }
  const ya=g.spiewa?g.poz:g.poz*.25,ts=teraz/1000,amp=(3+ya*18+ya*ya*26)*Math.PI/180*.55;
  // kołysanie jak w padFrog (rf-22): stałe częstotliwości, z wysokością rośnie tylko amplituda
  let kat=Math.sin(ts*2.2+g.ziarno)*amp
    +Math.sin(ts*5.6+g.ziarno*1.7)*amp*.6*Math.max(0,(ya-.3)/.7)
    +Math.sin(ts*9.4+g.ziarno*2.9)*amp*.5*Math.max(0,(ya-.6)/.4);
  kat+=Math.sin(ts*31)*g.wib*.0015+Math.sin(ts*40)*.22*g.potrzas;   // wibrato z obrotu, otrząśnięcie po fałszu
  // na nucie: grubszy obrys w kolorze gracza i żaba o 15% większa; śpiew obok nuty: 10%
  // śpiewa żaba z logo (5 klatek pyska), nie żaba motywu
  // 10-16: ta sama żaba i te same klatki pyska w przebraniu motywu efektu gracza (hełm, mumia…) zamiast efektu głowy
  const prz=przebranieGracza(g),img=zabaNaklejka(cicha?"cicha":klatka,g.kolor,g.naNucie,prz);
  const sc=s*(g.naNucie?1.15:g.spiewa?1.1:1)*puls*(img?img.w/96:1);
  const og=cicha?0:(g.ogien||0),pelna=grafikaPelna(),sty=stylToru(L),au=sty.aura||ZC_AURA;
  if(og>=2){   // aura żaby w ogniu: róż pod spodem, bursztyn bliżej (kolory stylu), pulsuje w rytm ćwierćnut
    // 10-10: mniejsza, słabsza i cofnięta za żabę (AX), żeby nie zalewała miejsca, gdzie głowa dotyka nuty
    const pk=1+.12*Math.sin(G.beat*Math.PI*2),r1=s*(og>=3?.95:.8)*pk,ax=x-s*ZC_GLOWA_ZA.AX;
    c.globalAlpha=.4;c.drawImage(blask(au[0]).cv,ax-r1,y-r1,2*r1,2*r1);
    c.globalAlpha=.5;c.drawImage(blask(au[1]).cv,ax-r1*.65,y-r1*.65,1.3*r1,1.3*r1);c.globalAlpha=1;
  }
  if(!img){c.fillStyle=g.kolor;c.beginPath();c.arc(x,y,s*.3,0,Math.PI*2);c.fill();return;}
  if(g.halo>.02&&!cicha){   // „na nucie”: cienkie halo w akcencie toru wokół głowy (ogień zostaje dla kombo)
    const rh=s*.5;c.globalAlpha=g.halo;
    c.strokeStyle="#211f1d";c.lineWidth=5;c.beginPath();c.arc(x,y-s*.04,rh,0,Math.PI*2);c.stroke();
    c.strokeStyle=L.tor.styl.akcent;c.lineWidth=3;c.stroke();c.globalAlpha=1;
  }
  c.save();c.translate(x,y);c.rotate(kat);
  if(og>=2&&pelna&&!prz)glowaZaGlowa(c,sty,sc,og,ts,g.nrWTorze*7+1);   // efekt streaka (styl toru) ZA głową, nie nad nią; przebranie go zastępuje
  const off=prz?przesuniecieGlowy(prz):null,ox=off?off.x*sc*off.pole/off.rozm:0,oy=off?off.y*sc*off.pole/off.rozm:0;
  c.drawImage(img.cv,-sc/2-ox,-sc/2-oy,sc,sc);
  c.restore();
  // 10-17: próba „cząstki z głów jako konfetti na końcu” została za flagą ?iskryGlowy=0 (po próbie iskry zostają w piosence);
  // wtedy ogień głowy liczy się tylko do R.ogienKonf, a ekran wyników wysypuje to jako dodatkowe konfetti
  if(og>=1&&pelna&&!ZC_DEV.iskryGlowy)R.ogienKonf=(R.ogienKonf||0)+[0,10,26,55][og]*Math.min(.05,R.dtIskier||.016);
  else if(og>=1&&pelna){   // iskry i dym wychodzą zza głowy (z jej środka), nie z czubka
    dodajIskry(x-sc*.12,y-sc*ZC_GLOWA_ZA.ISKRY,[0,10,26,55][og],og>=3,sty.iskry);   // 10-10: mniej iskier (było 14/40/90)
    if(og>=2&&sty.dym!==false)dodajDym(x-sc*.08,y-sc*ZC_GLOWA_ZA.DYM,og>=3?8:4,og/3,sty.dym||null);
  }
}
// Efekt głowy w kombo jak „unusual” z TF2 (10-05): siedzi ZA głową i ją otacza, zamiast stać nad nią jak irokez.
// Style rysują glowa() od czubka głowy (−0,4 sc) w górę, więc tu podstawa efektu schodzi do środka głowy (DY) i efekt
// lekko maleje (SK); rysuje się tylko tylny przebieg (przod=false), więc nic nie przykrywa pyska. Iskry i dym startują
// z tej samej wysokości. Podgląd w oknie Scena (efekty.js) używa tej samej funkcji przez Efekty.glowaZaGlowa, jeśli jest.
// Efekty były za mocne i zasłaniały kontakt głowy z nutą, więc efekt rysuje się do bufora, a potem gumka
// (gradient radialny w punkcie PRZOD przed pyskiem, promień GUMKA) wymazuje go od strony nadjeżdżających nut. Zostaje
// warkocz z tyłu i korona nad głową, przód głowy jest czysty. SK 1,35 → 1,15, aura cofnięta o AX za żabę.
const ZC_GLOWA_ZA={DY:.5,SK:1.15,ISKRY:.45,DYM:.4,AX:.22,ZASIEG:1.9,PRZOD:[.78,.08],GUMKA:1.25,PRAWO:[.1,.5],ROZDZ:.6};   // ROZDZ: skala bufora efektu (10-10, płynność)   // ISKRY .45 (10-09): iskry rodzą się nad głową, nie na pysku
let ZC_BUF_GLOWY=null;
function glowaZaGlowa(c,sty,sc,og,ts,ziarno){
  if(!sty||typeof sty.glowa!=="function")return;
  const Z=ZC_GLOWA_ZA,t=c.getTransform(),sk=Math.hypot(t.a,t.b)||1,R0=sc*Z.ZASIEG,px=Math.ceil(2*R0*sk);
  if(typeof document==="undefined"||px<4||px>4096){   // bez DOM (testy) albo absurdalny rozmiar: jak dawniej, bez gumki
    c.save();c.translate(0,sc*Z.DY);c.scale(Z.SK,Z.SK);
    try{sty.glowa(c,sc,og,ts,ziarno,false);}finally{c.restore();}
    return;
  }
  // Płynność (10-10): bufor w 0,6 rozdzielczości (efekt jest miękki, a to 2,8 raza mniej pikseli do rasteryzacji co
  // klatkę), osobny bufor na każdą żabę (jeden wspólny, nadpisywany w tej samej klatce, kazał przeglądarce kopiować
  // jego zawartość przed każdym kolejnym rysowaniem) i gumka jako gotowa bitmapa maski zamiast gradientu co klatkę.
  const pq=Math.max(4,Math.ceil(px*ZC_GLOWA_ZA.ROZDZ)),skq=sk*pq/px;
  const B=ZC_BUF_GLOWY||(ZC_BUF_GLOWY=new Map());
  let b=B.get(ziarno);if(!b){b=document.createElement("canvas");B.set(ziarno,b);}
  if(b.width<pq||b.height<pq){b.width=Math.max(b.width,pq);b.height=Math.max(b.height,pq);}
  const o=b.getContext("2d");
  o.setTransform(1,0,0,1,0,0);o.globalCompositeOperation="source-over";o.globalAlpha=1;o.clearRect(0,0,pq,pq);
  o.setTransform(skq,0,0,skq,pq/2,pq/2);
  o.save();o.translate(0,sc*Z.DY);o.scale(Z.SK,Z.SK);
  try{sty.glowa(o,sc,og,ts,ziarno,false);}finally{o.restore();}
  o.setTransform(1,0,0,1,0,0);o.globalCompositeOperation="destination-out";o.drawImage(gumkaGlowy(pq,sc,R0),0,0);
  o.globalCompositeOperation="source-over";
  c.drawImage(b,0,0,pq,pq,-R0,-R0,2*R0,2*R0);
}
// Maska gumki w px bufora (pq × pq, środek bufora = środek głowy): ten sam gradient radialny co dawniej, liczony raz
// na rozmiar bufora i głowy.
let ZC_GUMKA=null;
function gumkaGlowy(pq,sc,R0){
  const k=pq+"|"+sc.toFixed(1);
  if(ZC_GUMKA&&ZC_GUMKA.k===k)return ZC_GUMKA.cv;
  const cv=(ZC_GUMKA&&ZC_GUMKA.cv)||document.createElement("canvas");cv.width=cv.height=pq;
  const o=cv.getContext("2d"),Z=ZC_GLOWA_ZA,s=pq/(2*R0);
  o.setTransform(s,0,0,s,pq/2,pq/2);
  const gx=sc*Z.PRZOD[0],gy=sc*Z.PRZOD[1],gr=o.createRadialGradient(gx,gy,0,gx,gy,sc*Z.GUMKA);
  gr.addColorStop(0,"rgba(0,0,0,1)");gr.addColorStop(.5,"rgba(0,0,0,.92)");gr.addColorStop(.78,"rgba(0,0,0,.45)");gr.addColorStop(1,"rgba(0,0,0,0)");
  o.fillStyle=gr;o.fillRect(-R0,-R0,2*R0,2*R0);
  // Na prawo od żaby nic nie może przysłaniać nut: druga warstwa gumki
  // wymazuje całą prawą stronę na każdej wysokości, miękko od PRAWO[0] do PRAWO[1] (w sc od środka głowy)
  const pr=o.createLinearGradient(sc*Z.PRAWO[0],0,sc*Z.PRAWO[1],0);
  pr.addColorStop(0,"rgba(0,0,0,0)");pr.addColorStop(1,"rgba(0,0,0,1)");
  o.fillStyle=pr;o.fillRect(-R0,-R0,2*R0,2*R0);
  ZC_GUMKA={k,cv};return cv;
}
// Etykieta z nazwą (1–2 żaby na torze): lider ma ją pod sobą, druga żaba po swojej lewej stronie, bo
// etykieta jest szersza niż krok rzędu i nad albo pod żabą wjeżdżała na etykietę lidera.
function rysujEtykiete(c,L,g,ile){
  const {x,y}=pozycjaZaby(L,g),et=etykietaGracza(g);
  let ex=x-et.w/2,ey=y+L.zaba*.46;
  if(ile>1&&g.nrWTorze===1){ex=Math.max(L.x+4,x-L.zaba*.5-et.w-2);ey=y-et.h/2;}
  c.drawImage(et.cv,ex,Math.max(L.y+2,Math.min(L.y+L.h-et.h-2,ey)),et.w,et.h);
}
// Gęsty chór (≥ 3 żaby): zamiast nazwy kapsel gracza 22 px przyklejony pod brodą; nazwa jest w żetonie HUD.
function prostokatKapsla(L,g){
  const {x,y}=pozycjaZaby(L,g),rozm=Math.round(22*Math.min(1.35,Math.max(1,R.H/768)));
  return {x:x-rozm/2,y:Math.min(L.y+L.h-rozm-6,y+L.zaba*.2),rozm};
}
function rysujKapsel(c,L,g){
  const r=prostokatKapsla(L,g),k=kapselNaklejka(g.obrazekKapsla,r.rozm);if(!k)return;
  c.drawImage(k.cv,r.x,r.y,k.w,k.h);
}
// Widownia (pasek na dole): styl właściciela sceny z efekty.js. Domyślny „Żaby” to dawny kod tej funkcji bez zmian.
// Stan sceny liczy się tu raz na klatkę; style dostają go gotowego (Efekty.stan).
function rysujWidownie(c,teraz){
  const Wd=R.widownia,G=S.gra,wyniki=S.ekran==="wyniki",ap=wyniki&&S.wyniki&&S.wyniki.aplauz?S.wyniki.aplauz.glos:0;
  const wl=wlascicielSceny(),styl=(S.scena&&S.scena.widownia)||Efekty.WIDOWNIE[0];
  const st=Efekty.stan({W:R.W,teraz,G:!!G,fala0:G?G.fala:0,wyniki,ap,faza:G&&!wyniki?G.beat:teraz/700,
    spiewaja:!!(G&&!wyniki&&S.gracze.some(g=>g.spiewa)),skok:Math.max(G?G.skokWidowni:0,ap),
    // Po zmianie motywu w trakcie piosenki przy pełnej grafice żabki z tła przestawały skakać:
    // strażnik klatek po zacięciu schodził na poziom 2 (bez ognia, dymu i iskier), a `spokoj` z grafikaPelna()
    // zatrzymywał wtedy całą widownię. Ruch fanów to tanie drawImage, więc stoi tylko przy wybranej przez gracza
    // grafice uproszczonej/wydajności, ograniczonym ruchu albo najniższym poziomie strażnika (3 = wydajność).
    zar:wyniki?0:Math.min(3,R.zarWid||0),bezRuchu:ruchOgraniczony(),
    spokoj:S.ust.grafika==="uproszczona"||S.ust.grafika==="wydajnosc"||ruchOgraniczony()||(R.autoJakosc||0)>=3,
    kolor:wl?wl.kolor:null,akcent:wl&&wl.tor?wl.tor.styl.akcent:null,moc:mocStopnia(styl),gl:!!(R.st&&R.st.gl)},Wd);
  try{styl.rysuj(c,Wd,st);
    // Ucięte doły fanów zasłania ciemny pas ziemi po fanach motywu (motywy.js zaslonaStop)
    if(styl.motyw&&typeof Motywy!=="undefined"&&Motywy.zaslonaStop&&!st.mini)Motywy.zaslonaStop(c,Wd,st);}
  catch(e){
    if(!rysujWidownie.blad){rysujWidownie.blad=true;console.error("RibbitBeat: widownia „"+styl.id+"”",e);}
    c.setTransform(R.dpr,0,0,R.dpr,0,0);c.globalAlpha=1;c.globalCompositeOperation="source-over";
    if(styl.id!==Efekty.WIDOWNIE[0].id)Efekty.WIDOWNIE[0].rysuj(c,Wd,st);   // po id: wpis drabinki bywa kopią stylu z katalogu
    return;
  }
  if(styl.fx)hakStopnia("widownia",styl,"fx",st);   // prymitywy GPU stopnia (fajerwerki, lasery) po rysowaniu 2D
}
// Rozmiar naklejki z tekstem (ten sam wzór co naklejkaTekstu, krój Titan One), bez tworzenia bufora.
function rozmiarNaklejki(tekst,fs){
  fs=Math.round(fs||15*R.f);
  R.ct.font="400 "+fs+"px 'Titan One','Baloo 2',sans-serif";
  const wiersze=String(tekst).split("\n"),lh=Math.round(fs*1.25);
  const sz=Math.ceil(Math.max(...wiersze.map(w=>R.ct.measureText(w).width)))+fs+6;
  return {w:sz+6,h:wiersze.length*lh+fs*.55+9};
}
// Piętra dymków przy liderze stojącym na wysokości y: najpierw nad nim (od najbliższego), potem pod nim;
// każde w całości w torze i żadne na żabie. Tor za ciasny na jedno piętro obok żaby: jedno piętro przy
// dalszej krawędzi toru (zasłoni kawałek żaby, ale nie inny dymek ani sąsiedni tor).
function pietraDymkow(L,dm,y){
  const p=[];
  for(let yy=y-nadGlowaZaby(L)-dm.wys;yy>=L.y+4;yy-=dm.krok)p.push({y:yy,pod:false});   // nad ogniem, nie nad głową
  for(let yy=y+L.zaba*.55;yy+dm.wys<=L.y+L.h-4;yy+=dm.krok)p.push({y:yy,pod:true});
  if(!p.length)p.push(y-L.y>L.y+L.h-y?{y:L.y+4,pod:false}:{y:L.y+L.h-4-dm.wys,pod:true});
  return p;
}
// Miejsca na dymki toru, liczone raz na układ (R.wersja). Napis na torach niższych niż 200 px w skali 0,85.
// Kolumna ma szerokość najszerszego możliwego dymku („W jednym głosie! ×8”), więc dymek nigdy nie wjeżdża
// na sąsiada w rzędzie, a sąsiad nie przeskakuje, kiedy ktoś obok gaśnie. Pięter jest tyle, ile mieści się
// przy KAŻDEJ wysokości lidera; tor niższy niż 3 piętra (cztery tory) ma jedno piętro i dymki idą w prawo.
function miaraDymkow(L){
  if(L.dm&&L.dm.wersja===R.wersja)return L.dm;
  const fs=15*R.f*(L.h<200?.85:1);
  let szer=0,wys=0;
  for(const t of [T.wJednymGlosie,tt("komboPopup",{n:888}),tt("klikPopup",{n:888}),T.wibrato,T.ocena_falsz,T.kum]){
    const r=rozmiarNaklejki(tt("scalonyPopup",{tekst:t,n:8}),fs);szer=Math.max(szer,r.w);wys=Math.max(wys,r.h);
  }
  const dm={wersja:R.wersja,fs,wys,krok:wys+3,kolumna:szer+6,pietra:1,kolumny:1,miejsc:1};
  // lider bez kapsli (1–2 żaby) ma pod sobą etykietę z nazwą: dymki pod nim zaczynają się za jej brzegiem;
  // nad liderem +20 px od linii, czyli obok jego kapsla
  const lider=L.tor.gracze[0],et=lider&&L.tor.gracze.length<=2?etykietaGracza(lider):null;
  dm.xNad=L.teraz+20;dm.xPod=L.teraz+Math.max(20,et?Math.ceil(et.w/2)+6:0);
  dm.kolumny=Math.max(1,Math.floor((L.x+L.w-4-Math.max(dm.xNad,dm.xPod)+6)/dm.kolumna));
  if(L.h>=3*dm.krok){
    let min=Infinity;
    for(let y=L.y+L.zaba*.42;y<=L.y+L.h-L.zaba*.36;y+=.25)min=Math.min(min,pietraDymkow(L,dm,y).length);
    dm.pietra=Number.isFinite(min)?Math.max(1,min):1;
  }
  dm.miejsc=dm.pietra*dm.kolumny;
  return (L.dm=dm);
}
// Gdzie stoją dymki w tej klatce (to samo liczy rysowanie i ZC.geometria): przy liderze toru, od linii
// „teraz” W PRAWO, bo w lewo siedzi rząd chóru z kapslami. Dymek ma stałe miejsce (`stos`): piętro
// (najpierw nad liderem, potem pod nim) i kolumnę w prawo. Na wysokim torze miejsca zapełniają najpierw
// piętra, na niskim (cztery tory) jedno piętro w prawo. Dymek nie pływa, tylko wskakuje i gaśnie
// w ostatnich 40% życia.
function ukladDymkow(teraz){
  // Runda 4: na prawo od linii „teraz” lecą nuty, więc dymki stoją tam tylko na wysokim torze (≥ 220 px)
  // i tylko nad ogniem lidera. Wszystko inne idzie NA LEWO od linii (strefa minionych nut), w rzędzie przy górnej
  // krawędzi toru: najnowszy przy linii (za głową lidera), starsze dalej w lewo, aż do nazwy toru; co się nie
  // mieści, nie jest rysowane (najstarsze gaśnie pierwsze).
  const G=S.gra,out=[];
  G.popupy=G.popupy.filter(p=>teraz-p.od<p.zycie);
  for(const L of R.tory){
    const moje=G.popupy.filter(p=>p.tor===L.tor);if(!moje.length)continue;
    const dm=miaraDymkow(L),{y}=pozycjaZaby(L,L.tor.gracze[0]);
    const nad=L.h>=ZC_STREFY.WYSOKI?pietraDymkow(L,dm,y).filter(p=>!p.pod&&p.y+dm.wys<=y-nadGlowaZaby(L)+1):[];
    const doLewej=[];
    for(const p of moje){
      const tekst=p.ile>1?tt("scalonyPopup",{tekst:p.tekst,n:p.ile}):p.tekst;
      const nk=naklejkaTekstu(tekst,ZC_DYMKI_KOLOR[p.rodzaj]||"#a6d861",dm.fs*(p.rodzaj==="kum"?.8:1),undefined,p.rodzaj==="kum");
      const f=(teraz-p.od)/p.zycie,wsk=ruchOgraniczony()?1:Math.min(1,f*8);   // „wskakuje” w pierwszych 12% życia
      const d={p,tekst,nk,w:nk.w,h:nk.h,alfa:f<.6?1:1-(f-.6)/.4,skala:.85+.15*wsk};
      const pietro=nad[p.stos%Math.max(1,nad.length)],kol=Math.floor(p.stos/Math.max(1,nad.length));
      if(nad.length&&p.stos<nad.length*dm.kolumny&&pietro){d.x=dm.xNad+kol*dm.kolumna;d.y=pietro.y;d.strefa="nad";out.push(d);}
      else doLewej.push(d);
    }
    // rząd na lewo od linii, pod nazwą toru: od głowy lidera w lewo do klawiatury; najnowszy jest zawsze
    // (w razie ciasnoty przy klawiaturze, ale nigdy za linią), starsze tylko jeśli się mieszczą
    const et=etykietaToru(L),granica=L.kx+L.kw+8,yRzad=L.y+4+et.h;
    let x=L.teraz-L.zaba*.6-ZC_STREFY.ODSTEP_LEWO,pierwszy=true;
    for(const d of doLewej.sort((a,b)=>b.p.od-a.p.od)){
      if(x-d.w<granica){if(!pierwszy||granica+d.w>L.teraz-2)break;x=granica+d.w;}
      d.x=x-d.w;d.y=yRzad;d.strefa="lewo";out.push(d);x=d.x-ZC_STREFY.ODSTEP_LEWO;pierwszy=false;
    }
  }
  return out;
}
// STREFY WOKÓŁ ŻABY (runda 2): plakietka z nazwą pod głową, naklejka oceny na końcu taśmy, ale nie bliżej
// linii „teraz” niż promień głowy, „+N” z lewej strony głowy nad pieczątką, w górę i w lewo (10-10), dymki
// stosem dopiero ZC_STREFY.NAD_OGNIEM px nad szczytem ognia poziomu 3 (ok. 1,25 rozmiaru żaby nad środkiem głowy).
const ZC_STREFY={OGIEN:1.25,NAD_OGNIEM:26,LOT_ODSTEP:10,BLISKO_TERAZ:70,WYSOKI:220,ODSTEP_LEWO:6};
const nadGlowaZaby=L=>L.zaba*ZC_STREFY.OGIEN+ZC_STREFY.NAD_OGNIEM;
// Lecące punkty: naklejka „+180” w kolorze oceny (zawsze atrament na limonce, zieleni i bursztynie), przy mnożniku
// mniejsze „×3”; startuje przy głowie żaby (pozycja z pierwszej klatki), idzie ok. 40 px w górę i gaśnie w 0,7 s.
const ZC_LOT={ZYCIE:700,WYS:40};
// Połysk świecących fraz (10-10): złota obwódka pulsująca w rytm, przesuwający się po taśmie odblask i iskierka na
// początku nuty. Tylko nuty jeszcze niezaśpiewane we frazie, która świeci (sekcjaSwieci). Grafika uproszczona: sama
// obwódka; ograniczony ruch: obwódka bez pulsu. Rysuje się po wszystkich torach, osobno od rysujTor (bitmapy nut).
// Płynność (prośba sesji płynności, 10-10): w klatce bez clip() i bez gradientów. Odblask i gwiazdka to gotowe bitmapy
// (odblaskSekcji, gwiazdkaSekcji: budowane w przygotujBufory), odblask rysuje się wycinkiem bitmapy tylko w prostej
// części taśmy (bez zaokrąglonych końców), a nuty przy prawym brzegu toru są ucinane szerokością, nie przycięciem.
const odblaskSekcji=()=>bufor("sekcja|odblask",64,16,o=>{
  const gr=o.createLinearGradient(0,0,64,0);
  gr.addColorStop(0,"rgba(255,250,225,0)");gr.addColorStop(.5,"rgba(255,250,225,.95)");gr.addColorStop(1,"rgba(255,250,225,0)");
  o.fillStyle=gr;o.fillRect(0,0,64,16);});
const gwiazdkaSekcji=()=>bufor("sekcja|gwiazdka",32,32,o=>{
  o.fillStyle="#ffe27a";o.strokeStyle="#211f1d";o.lineWidth=1.6;o.beginPath();
  for(let j=0;j<8;j++){const a=j*Math.PI/4,rr=j%2?5:14;o.lineTo(16+Math.cos(a)*rr,16+Math.sin(a)*rr);}
  o.closePath();o.fill();o.stroke();});
function rysujSekcje(c,teraz){
  const G=S.gra;if(!G)return;
  const pelna=grafikaPelna(),ruch=!ruchOgraniczony(),puls=ruch?.6+.3*Math.sin(G.beat*Math.PI):.8;
  const od=pelna?odblaskSekcji():null,gw=pelna?gwiazdkaSekcji():null;
  for(const L of R.tory){
    const t=L.tor;if(!t||!t.sekcje||!t.sekcje.length)continue;
    const nuty=t.def.nuty,b0=G.beat,b1=G.beat+(L.x+L.w-L.teraz)/L.pxNaBeat,prawy=L.x+L.w-8;
    const nh=Math.max(8,Math.min(30,Math.max(L.rh*.6,Math.min(L.rh*1.15,14))));
    t.sekcje.forEach((s,k)=>{
      if(nuty[s.do].t+nuty[s.do].d<=b0||nuty[s.od].t>b1||!sekcjaSwieci(t,k))return;
      for(let i=s.od;i<=s.do;i++){
        const n=nuty[i];if(n.t+n.d<=b0)continue;if(n.t>b1)break;
        const x0=xBeat(L,n.t)+1;if(x0>prawy-6)break;
        const x1=xBeat(L,n.t+n.d)-2,wc=Math.max(5,x1-x0),w=Math.min(prawy-x0,n.p?Math.max(5,Math.min(wc,wc*n.p.od)):wc),y=ySemi(L,n.m);
        c.beginPath();c.roundRect(x0-3,y-nh/2-3,w+6,nh+6,(nh+6)/2);
        c.lineWidth=9;c.strokeStyle="rgba(255,201,60,"+(puls*.45).toFixed(3)+")";c.stroke();   // poświata
        c.lineWidth=2.5;c.strokeStyle="#f2b21c";c.stroke();                                      // obwódka
        if(!pelna)continue;
        c.fillStyle="rgba(255,214,90,"+(.18+.12*puls).toFixed(3)+")";c.beginPath();c.roundRect(x0,y-nh/2,w,nh,nh/2);c.fill();   // złoty nalot
        // odblask: jasny pas wędruje po prostej części taśmy co ok. 1,4 s, każda nuta z przesunięciem
        const f=((teraz/1400+i*.23)%1)*1.6-.3,px=x0+f*w,pas=Math.max(10,nh*1.2);
        const a=Math.max(px-pas,x0+nh/2),b=Math.min(px+pas,x0+w-nh/2);
        if(b-a>1){const sx=(a-(px-pas))/(2*pas)*od.cv.width,sw=(b-a)/(2*pas)*od.cv.width;
          c.drawImage(od.cv,sx,0,Math.max(1,sw),od.cv.height,a,y-nh/2+1,b-a,nh-2);}
        // iskierka na początku nuty: gotowa gwiazdka, migocze skalą
        const r=nh*(.62+(ruch?.18*Math.sin(teraz/180+i):0));
        c.drawImage(gw.cv,x0+2-r,y-nh/2-1-r,2*r,2*r);
      }
    });
  }
}
function rysujLoty(c,teraz){
  const G=S.gra;if(!G||!G.loty.length)return;
  G.loty=G.loty.filter(l=>teraz-l.od<ZC_LOT.ZYCIE);
  const fs=Math.round(15*R.f),fm=Math.round(11*R.f);
  for(const l of G.loty){
    const L=R.tory.find(x=>x.tor===l.tor);if(!L)continue;
    // ograniczony ruch: naklejka „+N” stoi w miejscu i znika na końcu życia (jeden krok, bez lotu)
    const fl=(teraz-l.od)/ZC_LOT.ZYCIE,a=ruchOgraniczony()?{dy:0,alfa:1,skala:1}:lotPunktow(fl,ZC_LOT.WYS*Math.min(1.4,R.f));
    const tekst="+"+fmtLiczba(l.punkty),mn=l.ocena==="wpunkt"?T.wPunktLot:l.mnoznik>1?"×"+l.mnoznik:"";
    c.font="400 "+fs+"px 'Titan One','Baloo 2',sans-serif";const wt=c.measureText(tekst).width;
    c.font="400 "+fm+"px 'Titan One','Baloo 2',sans-serif";const wm=mn?c.measureText(mn).width+4:0;
    const sz=wt+wm+12,wy=fs+8;
    // Naklejka „+N” stoi przy DOLNEJ krawędzi toru, na lewo od żaby, i odpływa poziomo w lewo nad zaśpiewaną
    // już częścią taśmy. Przy głowie żaby zostają tylko pieczątki „W PUNKT”, więc punkty ich nie zasłaniają.
    if(l.x==null){const pz=pozycjaZaby(L,l.g);l.x=Math.max(L.x+sz/2+4,pz.x-L.zaba*.5-ZC_STREFY.LOT_ODSTEP-sz/2);l.y=L.y+L.h-wy/2-6;}
    c.save();c.globalAlpha=a.alfa;c.translate(Math.max(L.x+sz/2+4,l.x+a.dy*1.2),l.y);c.rotate((l.nr%2?3:-3)*Math.PI/180);c.scale(a.skala,a.skala);
    c.fillStyle="rgba(120,90,40,.28)";c.beginPath();c.roundRect(-sz/2+1,-wy/2+3,sz,wy,7);c.fill();
    c.fillStyle=l.kolor||ZC_OCENY_KOLOR[l.ocena]||"#a6d861";c.beginPath();c.roundRect(-sz/2,-wy/2,sz,wy,7);c.fill();
    c.strokeStyle="#211f1d";c.lineWidth=1.5;c.stroke();
    c.fillStyle="#211f1d";c.textBaseline="middle";c.textAlign="left";
    c.font="400 "+fs+"px 'Titan One','Baloo 2',sans-serif";c.fillText(tekst,-sz/2+6,1);
    if(mn){c.font="400 "+fm+"px 'Titan One','Baloo 2',sans-serif";c.fillText(mn,-sz/2+6+wt+4,2);}
    c.restore();
  }
}
// Stempel „W PUNKT” (10-05): okrągła pieczątka nad końcem nuty, wbita z góry (skala 1,8 → 1 w 140 ms, pierścień uderzenia
// rozchodzi się przez 400 ms), jedzie razem z taśmą i gaśnie w ostatnich 400 ms z 1,4 s. Obie krawędzie „idealnie” =
// pieczątka z gwiazdką i napisem IDEALNIE; seria ≥ 2 dopisuje „×N” pod spodem. Bitmapa z pamięci (klucz: rodzaj, seria, skala).
const ZC_STEMPEL={ZYCIE:1400,WBICIE:140,PIERSCIEN:400,GASNIE:400};
const STEMPLE=new Map();
function bitmapaStempla(oc,seria){
  const r=Math.round(23*R.f),k=oc+"|"+(seria>=2?"n":"1")+"|"+r+"|"+R.dpr;   // 10-10: bez liczby serii w kluczu (nowa bitmapa co nutę = nowe płótno i tekstura w klatce)
  let b=STEMPLE.get(k);if(b)return b;
  const pad=6,wym=2*r+2*pad,d=R.dpr,cv=document.createElement("canvas");cv.width=Math.ceil(wym*d);cv.height=Math.ceil(wym*d);
  const c=cv.getContext("2d");c.setTransform(d,0,0,d,0,0);c.translate(wym/2,wym/2);
  c.fillStyle="rgba(120,90,40,.3)";c.beginPath();c.arc(2,3,r,0,Math.PI*2);c.fill();
  c.fillStyle=ZC_WPUNKT_KOLOR;c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.fill();
  c.strokeStyle="#211f1d";c.lineWidth=2.5;c.stroke();
  c.setLineDash([3,2.5]);c.lineWidth=1.2;c.beginPath();c.arc(0,0,r-5,0,Math.PI*2);c.stroke();c.setLineDash([]);
  if(oc==="idealnie"){   // gwiazdka nad napisem
    c.fillStyle="#ec1a83";c.beginPath();
    for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*.12:r*.27;c.lineTo(Math.cos(a)*rr,-r*.5+Math.sin(a)*rr);}
    c.closePath();c.fill();c.lineWidth=1;c.stroke();
  }
  c.fillStyle="#211f1d";c.textAlign="center";c.textBaseline="middle";
  const f1=Math.round(r*.42),f2=Math.round(r*.3);
  // dwie linijki: pierwsze słowo napisu nad resztą („W” / „PUNKT”, „SPOT” / „ON”)
  const [lin1,...lin2]=String(T.wPunktLot).split(/\s+/);
  c.font="400 "+f1+"px 'Titan One','Baloo 2',sans-serif";c.fillText(lin1,0,oc==="idealnie"?-r*.08:-r*.3);
  c.fillText(lin2.join(" "),0,oc==="idealnie"?r*.28:r*.08);
  c.font="400 "+f2+"px 'Titan One','Baloo 2',sans-serif";
  if(seria<2&&oc==="idealnie")c.fillText(T.wPunktIdealnie,0,r*.6);   // „×N” serii rysuje rysujStemple na żywo
  b={cv,w:wym,h:wym,r,f2};STEMPLE.set(k,b);
  if(STEMPLE.size>64)STEMPLE.delete(STEMPLE.keys().next().value);
  return b;
}
function rysujStemple(c,teraz){
  const G=S.gra;if(!G||!G.stemple||!G.stemple.length)return;
  G.stemple=G.stemple.filter(o=>teraz-o.od<ZC_STEMPEL.ZYCIE);
  const spokoj=ruchOgraniczony();
  for(const o of G.stemple){
    const L=R.tory.find(x=>x.tor===o.tor);if(!L)continue;
    const n=o.tor.def.nuty[o.idx];if(!n)continue;
    const b=bitmapaStempla(o.oc,o.seria),wiek=teraz-o.od;
    const x=Math.min(L.x+L.w-b.r-4,Math.max(L.x+b.r+4,xBeat(L,n.t+n.d)));
    const y=Math.max(L.y+b.r+4,ySemi(L,n.m)-b.r-Math.max(8,L.rh*.6)-6);
    const fw=Math.min(1,wiek/ZC_STEMPEL.WBICIE),sk=spokoj?1:1+.8*(1-fw)*(1-fw);
    const alfa=Math.min(1,(ZC_STEMPEL.ZYCIE-wiek)/ZC_STEMPEL.GASNIE)*(spokoj?1:Math.min(1,fw*2.5));
    if(!spokoj&&wiek<ZC_STEMPEL.PIERSCIEN&&wiek>ZC_STEMPEL.WBICIE*.6){   // pierścień uderzenia
      const f=(wiek-ZC_STEMPEL.WBICIE*.6)/(ZC_STEMPEL.PIERSCIEN-ZC_STEMPEL.WBICIE*.6);
      c.save();c.globalAlpha=.7*(1-f);c.strokeStyle=o.oc==="idealnie"?"#ec1a83":"#211f1d";c.lineWidth=3*(1-f)+1;
      c.beginPath();c.arc(x,y,b.r*(1+f*1.1),0,Math.PI*2);c.stroke();c.restore();
    }
    c.save();c.globalAlpha=Math.max(0,alfa);c.translate(x,y);c.rotate(((o.idx%3)-1)*.12-.06);c.scale(sk,sk);
    c.drawImage(b.cv,-b.w/2,-b.h/2,b.w,b.h);
    if(o.seria>=2){c.font="400 "+b.f2+"px 'Titan One','Baloo 2',sans-serif";c.fillStyle="#211f1d";c.textAlign="center";c.textBaseline="middle";c.fillText("×"+Math.min(o.seria,99),0,b.r*.58);}
    c.restore();
  }
}
// „Koniec!”: naklejka z kawałkiem taśmy kraft na środku każdego toru, wbita stemplem (1,4 → 1 w 180 ms).
function rysujKoniec(c,teraz){
  const f=Math.min(1,(teraz-S.gra.koniecOd)/180),sk=ruchOgraniczony()?1:1+.4*(1-f)*(1-f);
  const nk=naklejkaTekstu(T.koniecNaklejka,"#a6d861",Math.round(22*R.f));
  for(const L of R.tory){
    c.save();c.globalAlpha=Math.min(1,f*3);c.translate(L.x+L.w*.55,L.y+L.h/2);c.rotate(-.04);c.scale(sk,sk);
    c.drawImage(nk.cv,-nk.w/2,-nk.h/2,nk.w,nk.h);
    c.fillStyle="rgba(201,173,124,.85)";c.save();c.translate(0,-nk.h/2+2);c.rotate(.06);c.fillRect(-26,-6,52,12);c.restore();
    c.restore();
  }
}
function rysujPopupy(c,teraz){
  for(const d of ukladDymkow(teraz)){
    const dw=d.w*d.skala,dh=d.h*d.skala;
    c.globalAlpha=d.alfa;c.drawImage(d.nk.cv,d.x+(d.w-dw)/2,d.y+(d.h-dh)/2,dw,dh);
  }
  c.globalAlpha=1;
}
// Instrukcja na start (M1): nad linią „teraz” każdego toru, w którym ktoś jeszcze nie zaśpiewał żadnej
// nuty (w trybie „żaba śpiewa sama”: przez pierwsze 2 takty). Jedna naklejka na rodzaj sterowania.
function potrzebujePodpowiedzi(g){
  if(g.zrodlo==="bot")return false;
  return spiewaSamaGracza(g)?S.gra.beat<2*S.gra.metrum:!g.zaspiewal;
}
// „Żaba śpiewa sama” gracza w tej piosence (10-18 wieczór: pomoc gracza; poza piosenką z karty albo ustawień)
const spiewaSamaGracza=g=>g.pomoceGry?!!g.pomoceGry.spiewaSama:!!S.ust.spiewaSama;
function rysujPodpowiedzStartu(c,teraz){
  const G=S.gra;
  for(const L of R.tory){
    const klucze=[];
    for(const g of L.tor.gracze){
      if(!potrzebujePodpowiedzi(g))continue;
      const k=kluczPodpowiedzi(g.zrodlo,spiewaSamaGracza(g));
      if(k&&!klucze.includes(k))klucze.push(k);
    }
    if(!klucze.length)continue;
    const nks=klucze.map(k=>naklejkaTekstu(T[k],"#faf6ee",14*R.f,"800 "+Math.round(14*R.f)+"px 'Baloo 2',Nunito,sans-serif"));
    const wys=nks.reduce((s,nk)=>s+nk.h+4,0)-4;
    let y=L.y+Math.round(24*R.f);   // pod nazwą toru (taśma w lewym górnym rogu)
    // żaba-duch nie może schować się pod instrukcją: gdy stoi w jej pasie, instrukcja schodzi na dół toru
    const d=L.tor.duch;
    if(d&&d.alfa>.01){
      const yd=pozycjaDucha(L,d),gora=yd-L.zaba*.62-30*R.f,dol=yd+L.zaba*.55,y2=L.y+L.h-wys-10;
      if(gora<y+wys&&dol>y&&y2>y&&!(gora<y2+wys&&dol>y2))y=y2;
    }
    for(const nk of nks){
      const puls=1+.025*Math.sin(G.beat*Math.PI);
      const x=Math.max(L.x+8,Math.min(L.x+L.w-nk.w*puls-8,L.teraz-nk.w*puls/2));
      c.save();c.translate(x,y);c.scale(puls,puls);
      c.drawImage(nk.cv,0,0,nk.w,nk.h);
      c.fillStyle="rgba(234,163,43,.75)";c.save();c.translate(nk.w/2,2);c.rotate(-.05);c.fillRect(-18,-5,36,10);c.restore();   // kawałek taśmy
      c.restore();
      y+=nk.h+4;
    }
  }
}
function rysujOdliczanie(c){
  const G=S.gra,nr=Math.max(1,Math.min(4,Math.floor(G.beat)+5)),frac=G.beat-Math.floor(G.beat);
  const top=R.tory.length?R.tory[0].y:0,bot=R.widownia.y,cx=R.W/2+R.W*.08,cy=(top+bot)/2;
  const r=Math.min(78,(bot-top)*.2)*(1+.12*(1-frac)*(1-frac));
  c.fillStyle="rgba(120,90,40,.25)";c.beginPath();c.arc(cx+3,cy+7,r,0,Math.PI*2);c.fill();
  c.fillStyle="#ec1a83";c.beginPath();c.arc(cx,cy,r,0,Math.PI*2);c.fill();
  c.strokeStyle="#211f1d";c.lineWidth=4;c.stroke();
  c.strokeStyle="rgba(250,246,238,.75)";c.lineWidth=1.6;c.setLineDash([6,5]);
  c.beginPath();c.arc(cx,cy,r-9,0,Math.PI*2);c.stroke();c.setLineDash([]);
  c.font="400 "+Math.round(r*1.15)+"px 'Titan One','Baloo 2',sans-serif";c.fillStyle="#faf6ee";
  c.textAlign="center";c.textBaseline="middle";c.fillText(String(nr),cx,cy+r*.06);
  const nk=naklejkaTekstu(nr<=2?T.odchrzakujemy:T.uwaga,"#faf6ee");
  c.drawImage(nk.cv,cx-nk.w/2,cy-r-nk.h-8,nk.w,nk.h);
  c.textAlign="start";
}

// =============================================================================================
// 6. WYNIKI
function gwiazdkiSvg(n,rozm){
  const box=h("span","gwiazdki");box.setAttribute("aria-label",n+"/5");box.title=T.gwiazdkiDymek;   // Z-75
  for(let i=0;i<5;i++){
    const s=document.createElementNS("http://www.w3.org/2000/svg","svg");
    s.setAttribute("viewBox","0 0 24 24");s.setAttribute("width",rozm);s.setAttribute("height",rozm);
    s.setAttribute("class","gwiazdka"+(i<n?" pelna":""));
    const p=document.createElementNS("http://www.w3.org/2000/svg","path");
    p.setAttribute("d","M12 2.6l2.8 6 6.5.7-4.9 4.4 1.4 6.4L12 16.9 6.2 20.1l1.4-6.4L2.7 9.3l6.5-.7z");
    s.append(p);box.append(s);
  }
  return box;
}
// Naklejka nagrody pod rankingiem (też „Największy aplauz” dokładany po 5 s braw).
function naklejkaNagrody(tytul,id,wartosc,opoznienie){
  const g=id&&S.gracze.find(x=>x.id===id);if(!g)return;
  const d=h("div","nagroda");d.style.setProperty("--kolor",g.kolor);d.style.animationDelay=(opoznienie||0)+"ms";
  const kap=h("img","nagroda-kapsel");kap.src=g.obrazekKapsla||"";kap.alt="";
  d.append(h("span","nagroda-tytul",tytul),kap,h("b","nagroda-kto",g.nazwa),h("span","nagroda-wartosc",wartosc));
  el("wynikiNagrody").append(d);
}
function pokazWyniki(){
  const W=S.wyniki,p=S.gra.piosenka;
  pokazEkran("wyniki");
  // suma premii „W jednym głosie!”: wyjaśnia, czemu chór ma więcej gwiazdek niż solista
  const sumaChoru=W.ranking.reduce((s,r)=>s+(r.premiaChoru||0),0),solo=W.lista.length===1;
  // 10-15 (przejście kolekcjonera): piosenka bez jednej zaśpiewanej nuty nie dostaje „Brawo!”, tylko podpowiedź
  const nicNieZaspiewane=W.ranking.every(r=>!(r.trafione>0)&&!(r.punkty>0));
  // Z-76 (10-18): „chór” tylko wtedy, gdy ktoś dzieli tor; solista i tory „Każdy swój” dostają „Brawo!”
  const chor=!solo&&!!(S.gra&&S.gra.tory&&S.gra.tory.some(t=>t.gracze&&t.gracze.length>1));
  el("wynikiTytul").textContent=nicNieZaspiewane?T.koniecTytulCisza:chor?T.koniecTytul:T.koniecTytulSolo;
  el("wynikiPodtytul").textContent=sumaChoru>0
    ?tt("koniecPodtytulChor",{tytul:p.tytul,procent:Math.round(W.procent),n:fmtLiczba(sumaChoru)})
    :tt(chor?"koniecPodtytul":"koniecPodtytulSolo",{tytul:p.tytul,procent:Math.round(W.procent)});
  const at=el("wynikiAtrybucja"),lic=p.licencja;at.replaceChildren();at.hidden=!lic;
  if(lic){at.append(liniaAtrybucji(p.tytul,lic)+" ");
    const b=h("button","link-przycisk",T.licSzczegoly);b.type="button";b.onclick=()=>Pakiety.szczegoly(lic,p.tytul);at.append(b);}
  const gw=el("wynikiGwiazdki");gw.replaceChildren(gwiazdkiSvg(W.gwiazdki,40));
  // gwiazdki zapalają się po kolei co 180 ms (stempel w CSS, --g = kolejność) i każda cicho dzwoni
  const cicho=ruchOgraniczony();
  gw.querySelectorAll(".gwiazdka.pelna").forEach((s,i)=>{s.style.setProperty("--g",String(i));
    setTimeout(()=>{if(S.ekran==="wyniki"&&S.wyniki===W)Glos.gwiazdka(i+1);},cicho?0:ZC_WYNIKI_RUCH.GWIAZDKI_OD+i*ZC_WYNIKI_RUCH.GWIAZDKA);});
  // Przełącznik „Ranking: Punkty / Precyzja” nie ma sensu, oba są w wierszu: bez przełącznika, kolejność wg punktów (W.wg)
  const kat=el("wynikiKategoria");kat.replaceChildren();kat.style.display="none";
  rysujRanking();
  // nagrody wchodzą po rankingu (wiersze co 35 ms), każda 120 ms po poprzedniej, z obrotem (CSS)
  let nrNagrody=0;const poRankingu=ZC_WYNIKI_RUCH.NAGRODY_OD+W.lista.length*35;
  // pod rankingiem blok „Sława” i nowe osiągnięcia; JEDNA fanfara awansu na ekran (DzwiekiUI, tor B) razem z pierwszą
  // naklejką, gdy jest awans albo nowe osiągnięcie (na wynikach dźwięki UI nie są wyciszone)
  const awanse=rysujSlawe(W,poRankingu),noweOs=rysujNoweOsiagniecia(W);
  if(awanse.length||noweOs)setTimeout(()=>{if(S.wyniki===W&&typeof DzwiekiUI!=="undefined"&&DzwiekiUI.graj)DzwiekiUI.graj("odblokowanie");},poRankingu);
  nabijPunkty(W);
  el("btnTablica").onclick=()=>Tablica.otworz(p,{nowe:true});
  // Discord: odnośnik do #pochwal-się i „Kopiuj wynik” do wklejenia tam z własnego konta
  const dc=el("wynikiDiscord");if(dc){dc.href=ZC_DISCORD.pochwal;dc.title=T.discordPochwalDymek;}
  const kw=el("btnKopiujWynik");if(kw){kw.onclick=()=>kopiujWynik(W);kw.title=T.kopiujWynikDymek;}
  const nag=el("wynikiNagrody");nag.replaceChildren();
  const naklejka=(t,id,w)=>{if(id)naklejkaNagrody(t,id,w,poRankingu+ZC_WYNIKI_RUCH.NAGRODA*nrNagrody++);};
  // solista: jedna naklejka z rekordem piosenki zamiast nagród od samego siebie
  if(W.rekord){
    const g=S.gracze.find(x=>x.id===W.ranking[0].id);
    const d=h("div","nagroda rekord");d.style.setProperty("--kolor",g.kolor);d.style.animationDelay=(poRankingu+ZC_WYNIKI_RUCH.NAGRODA*nrNagrody++)+"ms";
    const kap=h("img","nagroda-kapsel");kap.src=g.obrazekKapsla||"";kap.alt="";
    d.append(h("span","nagroda-tytul",T.rekordTytul),kap,h("b","nagroda-kto",tt("rekordWartosc",{n:fmtLiczba(W.rekord.punkty)})),
      h("span","nagroda-wartosc",W.rekord.nowy?T.rekordNowy:tt("rekordDzis",{n:fmtLiczba(W.rekord.dzis)})));
    nag.append(d);
  }
  const r=id=>W.ranking.find(x=>x.id===id)||{};
  naklejka(T.nagrodaCzysty,W.nagrody.czysty,tt("nagrodaCzystyWartosc",{n:Math.round(r(W.nagrody.czysty).celnosc||0)}));
  naklejka(T.nagrodaKombo,W.nagrody.kombo,tt("nagrodaKomboWartosc",{n:r(W.nagrody.kombo).maxKombo||0}));
  naklejka(T.nagrodaFalsz,W.nagrody.falsz,tt("nagrodaFalszWartosc",{n:r(W.nagrody.falsz).falsze||0}));
  naklejka(T.nagrodaGadula,W.nagrody.gadula,tt("nagrodaGadulaWartosc",
    {n:(r(W.nagrody.gadula).gadanie||0).toLocaleString(ZC_LOC,{maximumFractionDigits:1})}));
  // awanse sławy: naklejki „Awans” w kolorze gracza za pozostałymi, najwyżej 4 (przy większej liczbie 3 i „i jeszcze N”)
  const wieluA=new Set(awanse.map(a=>a.gracz)).size>1,pokazA=awanse.length>4?awanse.slice(0,3):awanse;
  for(const a of pokazA)naklejkaAwansu(a,wieluA,poRankingu+ZC_WYNIKI_RUCH.NAGRODA*nrNagrody++);
  if(pokazA.length<awanse.length){
    const d=h("div","nagroda awans wiecej");d.style.animationDelay=(poRankingu+ZC_WYNIKI_RUCH.NAGRODA*nrNagrody++)+"ms";
    d.append(h("span","nagroda-tytul",T.awansTytul),h("b","nagroda-kto",tt("awansWiecej",{n:awanse.length-pokazA.length})));nag.append(d);
  }
  // 5 s braw: podpowiedź z miernikiem zamiast zwykłej, po brawach wraca zwykła (zakonczAplauz)
  const pp=el("wynikiPodpowiedz");pp.replaceChildren((solo?T.aplauzPodpowiedzSolo:chor?T.aplauzPodpowiedz:T.aplauzPodpowiedzOsobno)+" ",h("span","aplauz-miernik"));
  pp.classList.add("aplauz");
  el("btnJeszczeRaz").focus();   // Z-27b (10-18): bez preventScroll, przy długiej karcie zaznaczony przycisk przewija się w widok
  // 10-16: animacja postępu (js/nagrody.js) wchodzi, gdy karta wyników zdąży nabić punkty i gwiazdki
  try{odswiezNagrodyDoOdbioru();}catch(e){}
  // 10-18 (Z-24): przy otwartej tablicy albo innym oknie nad wynikami nagrody czekają i wchodzą jednorazowo po jego zamknięciu
  const pokazNagrody=czekalo=>{
    if(S.ekran!=="wyniki"||S.wyniki!==W)return;
    if(oknoNadWynikami()){setTimeout(()=>pokazNagrody(true),250);return;}
    if(czekalo){setTimeout(()=>pokazNagrody(false),400);return;}   // chwila po zamknięciu okna, zanim wejdzie animacja
    try{Nagrody.pokaz(W);}catch(e){console.warn("RibbitBeat: nagrody",e);}
  };
  if(typeof Nagrody!=="undefined"&&Nagrody.pokaz&&!nicNieZaspiewane)setTimeout(()=>pokazNagrody(false),ruchOgraniczony()?300:ZC_WYNIKI_RUCH.NABIJ+700);
}
// Z-30 (10-18): zerowa sława ma dwa powody: krótki fragment (mniej niż MIN_NUT nut) albo brak trafionej nuty
function powodBezSlawy(W,id){
  const r=(W.ranking||[]).find(q=>q.id===id)||(W.lista||[]).find(q=>q.id===id);
  return r&&(r.nut|0)>=Postepy.MIN_NUT?T.slawaBezTrafien:tt("slawaFragment",{n:Postepy.MIN_NUT});
}
// Z-24: tablica wyników (tablica.js) albo inne okno modalne poza kartą wyników jest otwarte
function oknoNadWynikami(){
  if(typeof Tablica!=="undefined"&&Tablica.stan&&Tablica.stan().otwarta)return true;
  return [...document.querySelectorAll('[aria-modal="true"]')].some(x=>x.getClientRects().length&&!x.closest("#wyniki"));
}
// Blok „Sława” pod rankingiem: dla każdego człowieka (najwyżej 3 wiersze, resztę mówi „i jeszcze N”) cztery
// paski torów z etykietą „Widownia 7”, chip z zyskiem i plakietki mnożników („×2 pierwsza gra dnia”). Wypełnienie
// nabija się od sławy sprzed gry do nowej (900 ms, ease-out jak punkty, start razem z naklejkami); przekroczony próg
// przestawia etykietę na nowy stopień i błyska paskiem (CSS). Ograniczony ruch: od razu stan końcowy. Boty nie mają
// wiersza. Zwraca awanse wszystkich ludzi (naklejki i jedna fanfara na ekran).
function rysujSlawe(W,od){
  const lista=el("wynikiLista"),karta=lista.closest(".wyniki-karta");
  let box=el("wynikiSlawa");
  if(!box){box=h("div","slawa-wyniki");box.id="wynikiSlawa";box.setAttribute("role","status");}
  if(box.previousElementSibling!==lista)lista.after(box);
  box.replaceChildren();
  // 10-19: tryb oszusta = zamiast sławy jedna linia, że ta piosenka się nie liczy
  if(typeof TrybOszusta!=="undefined"&&TrybOszusta.aktywny){
    box.hidden=false;if(karta)karta.classList.add("ze-slawa");
    box.append(h("p","slawa-oszust",TrybOszusta.TX.wyniki));
    return [];
  }
  const wiersze=(W.osiagniecia||[]).filter(x=>x&&x.slawa);
  box.hidden=!wiersze.length;if(karta)karta.classList.toggle("ze-slawa",!!wiersze.length);
  if(!wiersze.length)return [];
  box.append(h("span","slawa-tytul",T.slawaTytul));
  const paski=[],awanse=[];let naGreEkipy=0;
  // 10-17 (Postepy.WSPOLNE): wiersze graczy pokazują tylko wkład (bez paska), pod nimi JEDEN wspólny pasek poziomu ekipy
  const ekW=(W.osiagniecia||[]).map(x=>x&&x.ekipa).find(Boolean);
  if(ekW&&ekW.wspolne){
    for(const x of wiersze.slice(0,3)){
      const g=S.gracze.find(q=>q.id===x.id),sl=x.slawa,w=h("div","slawa-wiersz slawa-wklad");
      w.style.setProperty("--kolor",g?g.kolor:"#eaa32b");w.dataset.id=x.id;
      const kap=h("img","slawa-kapsel");kap.src=(g&&g.obrazekKapsla)||"";kap.alt="";
      const zysk=Postepy.slawaRazem(sl.zyski),mn=h("span","slawa-mnozniki");
      mn.append(h("span","slawa-zysk"+(zysk?"":" zero"),zysk?tt("slawaZysk",{n:fmtSlawa(zysk)}):""));   // sława gracza z tej piosenki (do puli idzie średnia ekipy)
      for(const m of sl.mnozniki||[])mn.append(h("span","slawa-mnoznik",m.id==="dzien"?tt("slawaDzien",{x:fmtMnoznik(m.x)}):tt("slawaSeria",{x:fmtMnoznik(m.x),n:m.dni})));
      if(Postepy.TORY.every(t=>!(+sl.zaGre[t])))mn.append(h("span","slawa-fragment",powodBezSlawy(W,x.id)));
      w.append(kap,h("b","slawa-kto",pokazProfil(x.profil)),mn);box.append(w);
    }
    if(wiersze.length>3)box.append(h("span","slawa-wiecej",tt("slawaWiecej",{n:wiersze.length-3})));
    const w=h("div","slawa-wiersz slawa-wspolny"),tor="efekt";w.dataset.id="ekipa";
    w.append(h("span","slawa-kapsel slawa-kapsel-plansza"),h("b","slawa-kto",T.slawaWspolny));
    const c=h("div","slawa-tor slawa-motyw"),et=h("span","slawa-et"),pas=h("span","slawa-pasek"),wyp=h("span","slawa-pasek-w");
    c.dataset.tor=tor;pas.append(wyp);c.append(et,pas,h("span","slawa-zysk"+(ekW.zysk?"":" zero"),ekW.zysk?tt("slawaZysk",{n:fmtSlawa(ekW.zysk)}):""));
    const mn=h("span","slawa-mnozniki");
    if(ekW.mnoznikGraczy>1)mn.append(h("span","slawa-mnoznik",tt("slawaGraczy",{x:fmtMnoznik(ekW.mnoznikGraczy),n:ekW.ludzie})));
    const e=Postepy.ekipa();dodajCel(mn,Postepy.nastepnyCel(null,"efekt"),e.gry>=3?e.slawa/e.gry:Math.max(1,ekW.zysk));
    mn.append(h("span","slawa-plansza-nota",T.slawaWspolnaNota));w.append(c,mn);box.append(w);
    paski.push({c,et,wyp,tor,od:ekW.przed,do:ekW.po,n:null,awans:false});
    for(const a of ekW.awanse||[])awanse.push(Object.assign({gracz:null,profil:null},a));
  }
  else for(const x of wiersze.slice(0,3)){
    const g=S.gracze.find(q=>q.id===x.id),sl=x.slawa,w=h("div","slawa-wiersz");
    w.style.setProperty("--kolor",g?g.kolor:"#eaa32b");w.dataset.id=x.id;
    const kap=h("img","slawa-kapsel");kap.src=(g&&g.obrazekKapsla)||"";kap.alt="";
    w.append(kap,h("b","slawa-kto",pokazProfil(x.profil)));
    {   // 10-10: pasek gracza = jego EFEKT z własnej puli (suma czterech torów), do następnego efektu
      const tor="efekt",od=Postepy.slawaRazem(sl.przed),po=Postepy.slawaRazem(sl.po),zysk=Postepy.slawaRazem(sl.zyski);
      const c=h("div","slawa-tor slawa-motyw"),et=h("span","slawa-et"),pas=h("span","slawa-pasek"),wyp=h("span","slawa-pasek-w");
      c.dataset.tor=tor;pas.append(wyp);c.append(et,pas,h("span","slawa-zysk"+(zysk?"":" zero"),zysk?tt("slawaZysk",{n:fmtSlawa(zysk)}):""));
      c.title=tt("slawaOpis",{tor:nazwaToru(tor),n:Postepy.poziomZ(po,Postepy.TOR_GRACZA).stopien,ile:fmtSlawa(po),zysk:fmtSlawa(zysk)});
      w.append(c);
      paski.push({c,et,wyp,tor,od,do:po,n:null,awans:(sl.awanse||[]).length>0||(sl.noweInstrumenty||[]).length>0});
    }
    const mn=h("span","slawa-mnozniki");
    for(const m of sl.mnozniki||[])mn.append(h("span","slawa-mnoznik",m.id==="dzien"?tt("slawaDzien",{x:fmtMnoznik(m.x)}):tt("slawaSeria",{x:fmtMnoznik(m.x),n:m.dni})));
    if(Postepy.TORY.every(t=>!(+sl.zaGre[t])))mn.append(h("span","slawa-fragment",powodBezSlawy(W,x.id)));
    // 10-16: nowe instrumenty z tej gry (Postepy.noweInstrumentyZ)
    for(const i of sl.noweInstrumenty||[])mn.prepend(h("span","slawa-cel slawa-instrument",tt("nowyInstrument",{nazwa:T.instrumentyGracza[i]||i})));
    const naGre=sredniaSlawy(x.profil,Postepy.slawaRazem(sl.zaGre)/(sl.mnoznik||1));naGreEkipy+=naGre;
    dodajCel(mn,Postepy.nastepnyCel(x.profil,"efekt"),naGre);
    w.append(mn);box.append(w);
  }
  if(!(ekW&&ekW.wspolne)&&wiersze.length>3)box.append(h("span","slawa-wiecej",tt("slawaWiecej",{n:wiersze.length-3})));
  // 10-10: wiersz PLANSZY (pula ekipy: zyski wszystkich profili tej gry), pod wierszami graczy, bez kapsla
  const ek=(W.osiagniecia||[]).map(x=>x&&x.ekipa).find(Boolean);
  if(ek&&!ek.wspolne){
    const w=h("div","slawa-wiersz slawa-plansza"),tor="plansza";w.dataset.id="plansza";
    w.append(h("span","slawa-kapsel slawa-kapsel-plansza"),h("b","slawa-kto",T.scenaPlansza));
    const c=h("div","slawa-tor slawa-motyw"),et=h("span","slawa-et"),pas=h("span","slawa-pasek"),wyp=h("span","slawa-pasek-w");
    c.dataset.tor=tor;pas.append(wyp);c.append(et,pas,h("span","slawa-zysk"+(ek.zysk?"":" zero"),ek.zysk?tt("slawaZysk",{n:fmtSlawa(ek.zysk)}):""));
    c.title=tt("slawaOpis",{tor:T.scenaPlansza,n:Postepy.poziomZ(ek.po,Postepy.TOR_PLANSZY).stopien,ile:fmtSlawa(ek.po),zysk:fmtSlawa(ek.zysk)});
    const mn=h("span","slawa-mnozniki");dodajCel(mn,Postepy.nastepnyCel(null,"plansza"),naGreEkipy||ek.zysk);
    mn.append(h("span","slawa-plansza-nota",T.slawaPlanszaNota));w.append(c,mn);box.append(w);
    paski.push({c,et,wyp,tor,od:ek.przed,do:ek.po,n:null,awans:(ek.awanse||[]).length>0});
    for(const a of ek.awanse||[])awanse.push(Object.assign({gracz:null,profil:null},a));
  }
  for(const x of wiersze)for(const a of x.slawa.awanse||[])awanse.push(Object.assign({gracz:x.id,profil:x.profil},a));
  // pasek toru przy sławie v: etykieta ze stopniem, wypełnienie do następnego progu (ostatni stopień = pełny);
  // nowy stopień w trakcie nabijania = błysk (klasa zdjęta i nałożona, żeby animacja ruszyła od nowa)
  const ustaw=(p,v)=>{
    if(p.tor!=="plansza"&&Postepy.poziomGraczaZ){   // 10-16: pasek gracza = poziom drogi (nagroda co poziom)
      const z=Postepy.poziomGraczaZ(v),f=z.do!=null?(v-z.od)/Math.max(1,z.do-z.od):1;
      p.et.textContent=tt("slawaPoziom",{n:z.poziom});p.wyp.style.width=(100*Math.max(0,Math.min(1,f))).toFixed(1)+"%";
      if(p.n!=null&&z.poziom>p.n){p.c.classList.remove("awans");void p.c.offsetWidth;p.c.classList.add("awans");}
      p.n=z.poziom;return;
    }
    const z=Postepy.poziomZ(v,p.tor==="plansza"?Postepy.TOR_PLANSZY:Postepy.TOR_GRACZA),f=z.do!=null?(v-z.od)/Math.max(1,z.do-z.od):1;
    p.et.textContent=tt(p.tor==="plansza"?"slawaMotyw":"slawaEfekt",{n:z.stopien,nazwa:z.wpis?z.wpis.nazwa:""});
    p.wyp.style.width=(100*Math.max(0,Math.min(1,f))).toFixed(1)+"%";
    if(p.n!=null&&z.stopien>p.n){p.c.classList.remove("awans");void p.c.offsetWidth;p.c.classList.add("awans");}
    p.n=z.stopien;
  };
  if(ruchOgraniczony()){for(const p of paski){ustaw(p,p.do);p.c.classList.toggle("awans",p.awans);}return awanse;}
  for(const p of paski)ustaw(p,p.od);
  setTimeout(()=>{
    if(S.wyniki!==W)return;
    const t0=performance.now();
    const krok=()=>{
      if(S.wyniki!==W)return;
      const f=Math.min(1,(performance.now()-t0)/ZC_WYNIKI_RUCH.NABIJ),e=1-Math.pow(1-f,3);
      for(const p of paski)if(p.c.isConnected)ustaw(p,f>=1?p.do:p.od+(p.do-p.od)*e);
      if(f<1)requestAnimationFrame(krok);
    };
    krok();
  },od);
  return awanse;
}
// Średnia sława profilu na grę (z licznika gier), żeby „jeszcze ok. N piosenek” nie zawyżał pierwszej gry dnia (×2) ani
// osiągnięć; bez historii: sława tej gry bez premii.
function sredniaSlawy(nazwa,zaGre){
  const p=Postepy.lista().find(q=>q.nazwa===nazwa);
  return p&&p.gry>=3?p.slawa/p.gry:Math.max(1,zaGre||0);
}
function dodajCel(mn,cel,naGre){
  if(!cel||!(naGre>0))return;
  const n=Math.max(1,Math.ceil(cel.brakuje/naGre));
  const nazwa=cel.typ==="los"?T.celLosowanie:cel.typ==="instrument"?tt("celInstrument",{nazwa:T.instrumentyGracza[cel.id]||cel.id}):cel.nazwa;
  mn.prepend(h("span","slawa-cel",tt("slawaCel",{nazwa,n,piosenek:odmiana(n,T.piosenka1,T.piosenka2,T.piosenka5)})));
}
// Naklejka awansu w kolorze gracza: „Nowy efekt” + nazwa (przy kilku ludziach z profilem) albo, dla planszy
// (pula ekipy, bez kapsla i profilu), „Nowy motyw planszy” + „motyw 7 z 15”.
function naklejkaAwansu(a,wielu,opoznienie){
  const g=S.gracze.find(x=>x.id===a.gracz),d=h("div","nagroda awans"),plansza=a.tor==="plansza";
  d.style.setProperty("--kolor",g?g.kolor:"#eaa32b");d.style.animationDelay=(opoznienie||0)+"ms";d.dataset.tor=a.tor;
  const kap=h("img","nagroda-kapsel");kap.src=(g&&g.obrazekKapsla)||"";kap.alt="";
  if(plansza)d.append(h("span","nagroda-tytul",T.awansPlansza),h("b","nagroda-kto",nazwaPary("plansza",a.nazwa)),   // 10-18: „Sushi · scena”
    h("span","nagroda-wartosc",tt("awansMotywNr",{n:a.stopien,z:drabinka(Postepy.TOR_PLANSZY).length})));
  else d.append(h("span","nagroda-tytul",T.awansEfekt),kap,h("b","nagroda-kto",nazwaPary("efekt",a.nazwa)),
    h("span","nagroda-wartosc",tt("awansEfektNr",{n:a.stopien,z:drabinka(Postepy.TOR_GRACZA).length})+(wielu?" · "+pokazProfil(a.profil):"")));
  d.title=plansza?tt("awansPlanszaOpis",{n:a.stopien,nazwa:a.nazwa}):tt("awansOpis",{kto:pokazProfil(a.profil),tor:nazwaToru(a.tor),n:a.stopien,nazwa:a.nazwa});
  el("wynikiNagrody").append(d);
}
// „Kopiuj wynik”: jedna linia do wklejenia na Discordzie z wynikiem najlepszego człowieka (same boty: lider).
// Schowek przez navigator.clipboard; gdy go nie ma albo odmówi (stara przeglądarka, brak uprawnień), ukryte pole
// i execCommand("copy"). Nic nie wychodzi z gry: post publikuje gracz ze swojego konta (decyzja z 2026-08-21).
function tekstWyniku(W){
  const p=S.gra&&S.gra.piosenka,czlowiek=id=>{const g=S.gracze.find(x=>x.id===id);return !!g&&g.zrodlo!=="bot";};
  const r=W.ranking.find(x=>czlowiek(x.id))||W.ranking[0]||{},g=S.gracze.find(x=>x.id===r.id);
  return tt("kopiujSzablon",{tytul:p?p.tytul:"",gwiazdki:r.gwiazdki|0,procent:Math.round(+r.precyzja||0),kombo:r.maxKombo|0,kto:g?g.nazwa:"",punkty:fmtLiczba(r.punkty||0)});
}
function kopiujWynik(W){
  const t=tekstWyniku(W),a=document.activeElement;
  const zapas=()=>{
    const ta=h("textarea","schowek-zapas");ta.value=t;ta.setAttribute("readonly","");ta.setAttribute("aria-hidden","true");
    document.body.append(ta);ta.select();let ok=false;try{ok=document.execCommand("copy");}catch(e){ok=false;}
    ta.remove();if(a&&a.isConnected&&a.focus)a.focus({preventScroll:true});
    toast(ok?T.skopiowano:T.kopiujBlad,!ok);
  };
  if(navigator.clipboard&&typeof navigator.clipboard.writeText==="function")navigator.clipboard.writeText(t).then(()=>toast(T.skopiowano),zapas);
  else zapas();
  return t;
}
// Nowe osiągnięcia pod blokiem „Sława”: żetony jak rozbicie wyniku (kolor gracza), wchodzą razem z nagrodami.
// Najwyżej 6 żetonów, resztę mówi ostatni („i jeszcze N”), żeby karta wyników mieściła się na ekranie. Zwraca liczbę
// nowych osiągnięć (fanfarę gra pokazWyniki, jedną na ekran).
function rysujNoweOsiagniecia(W){
  let box=el("wynikiOsiagniecia");
  if(!box){box=h("div","osiag-wyniki");box.id="wynikiOsiagniecia";box.setAttribute("role","status");}
  const przed=el("wynikiSlawa")||el("wynikiLista");if(box.previousElementSibling!==przed)przed.after(box);
  box.replaceChildren();
  const zetony=[];
  for(const x of W.osiagniecia||[])for(const o of x.nowe||[])zetony.push({x,o});
  box.hidden=!zetony.length;if(!zetony.length)return 0;
  const wielu=(W.osiagniecia||[]).length>1,od=ZC_WYNIKI_RUCH.NAGRODY_OD+W.lista.length*35;
  // 10-10: skrót na efekt = własny efekt, skrót na tor planszy = motyw planszy dla wszystkich
  const NAGRODA={widownia:"nagrodaPlansza",streak:"nagrodaStreak",tlo:"nagrodaPlansza",klawisze:"nagrodaPlansza"};
  // 10-18 (Z-27b): przy 6 i więcej graczach jeden żeton „N nowych osiągnięć” (szczegóły w oknie nagród), żeby przyciski
  // wyników zostały na ekranie; nazwy w dymku
  if(W.lista.length>=6){
    const z=h("span","rozb osiag-zeton osiag-zwiniete",tt("noweOsiagnieciaRazem",{n:zetony.length,
      osiagniec:odmiana(zetony.length,T.osiagniecie1,T.osiagniecie2,T.osiagniecie5)}));
    z.style.animationDelay=od+"ms";
    z.title=zetony.map(({x,o})=>o.nazwa+(wielu?" ("+pokazProfil(x.profil)+")":"")).join(", ");box.append(z);
    return zetony.length;
  }
  const pokaz=zetony.length>6?zetony.slice(0,5):zetony;
  pokaz.forEach(({x,o},i)=>{
    const g=S.gracze.find(q=>q.id===x.id),kolor=g?g.kolor:"#eaa32b",n=o.nagroda||{};
    const z=h("span","rozb osiag-zeton");z.style.setProperty("--c",kolor);z.style.background=rgba(kolor,.18);
    z.style.boxShadow="inset 0 0 0 1.2px "+rgba(kolor,.6);z.style.animationDelay=(od+i*ZC_WYNIKI_RUCH.NAGRODA)+"ms";
    const co=tt(NAGRODA[n.tor||n.typ]||"nagrodaStreak",{nazwa:n.nazwa||""});
    z.append(h("b","",tt("noweOsiagniecie",{nazwa:o.nazwa})+(wielu?" ("+pokazProfil(x.profil)+")":"")),h("span",""," · "+tt("scenaOdblokuje",{co})));
    z.title=o.opis+" "+tt("scenaOdblokuje",{co})+(n.slawa?", "+tt("scenaNagrodaSlawa",{n:fmtSlawa(n.slawa),tor:nazwaToru(n.tor)}):"")+".";box.append(z);
  });
  if(pokaz.length<zetony.length){const z=h("span","rozb osiag-zeton",tt("noweOsiagnieciaWiecej",{n:zetony.length-pokaz.length}));
    z.style.animationDelay=(od+pokaz.length*ZC_WYNIKI_RUCH.NAGRODA)+"ms";box.append(z);}
  return zetony.length;
}
// Ruch karty wyników (runda 2): wjazd karty 260 ms (CSS), gwiazdki od 260 ms co 180 ms, punkty nabijają się 900 ms,
// nagrody po rankingu co 120 ms.
const ZC_WYNIKI_RUCH={GWIAZDKI_OD:260,GWIAZDKA:180,NABIJ:900,NAGRODY_OD:420,NAGRODA:120};
// Punkty w wierszach liczą się od 0 (requestAnimationFrame, ease-out); przy ograniczonym ruchu od razu wartość.
function nabijPunkty(W){
  const komorki=[...el("wynikiLista").querySelectorAll(".wiersz-liczba.punkty b")].map(b=>{
    const r=W.lista.find(x=>x.id===b.closest(".wiersz").dataset.id);return {b,v:r?r.punkty:0};});
  if(ruchOgraniczony()||!komorki.length)return;
  const od=performance.now();
  const krokN=()=>{
    if(S.wyniki!==W)return;
    const f=(performance.now()-od)/ZC_WYNIKI_RUCH.NABIJ;
    for(const k of komorki)if(k.b.isConnected)k.b.textContent=fmtLiczba(nabijWartosc(k.v,f));
    if(f<1)requestAnimationFrame(krokN);
  };
  krokN();
}
// Lista wyników w wybranej kategorii (W.wg). Kolumny: miejsce, kapsel, kto (z partią i jej trudnością), punkty,
// precyzja (trafione z wszystkich nut, celność w dymku), kombo, gwiazdki. Liderzy obu kategorii dostają odznaki
// (przy co najmniej dwóch graczach), a każdy wiersz miejsce na tablicy wyników w tej partii i konfiguracji.
function rysujRanking(){
  const W=S.wyniki,p=S.gra.piosenka;if(!W)return;
  for(const b of el("wynikiKategoria").querySelectorAll(".segment-opcja"))b.setAttribute("aria-checked",String(b.dataset.v===W.wg));
  const widok=rankingGraczy(W.lista,W.wg),wielu=W.lista.length>=2;
  const lider={punkty:wielu?rankingGraczy(W.lista,"punkty")[0].id:null,precyzja:wielu?rankingGraczy(W.lista,"precyzja")[0].id:null};
  const ol=el("wynikiLista");ol.replaceChildren();ol.dataset.wg=W.wg;
  ol.classList.toggle("ciasny",W.lista.length>=6);   // 6–8 wierszy: rozbicie tylko w dymku, żeby karta mieściła się na ekranie
  widok.forEach((r,i)=>{
    const g=S.gracze.find(x=>x.id===r.id);
    const li=h("li","wiersz "+(W.wg==="precyzja"?"wg-precyzja":"wg-punkty"));
    li.style.setProperty("--kolor",g.kolor);li.dataset.id=r.id;li.style.setProperty("--i",String(i));
    const kap=h("img","wiersz-kapsel");kap.src=g.obrazekKapsla||"";kap.alt="";
    const kto=h("div","wiersz-kto"),glowa=h("div","wiersz-glowa");
    glowa.append(h("b","wiersz-nazwa",g.nazwa));
    if(g.zrodlo==="bot")glowa.append(h("span","odznaka bot",nazwaPoziomuBota(g)));
    for(const k of ["punkty","precyzja"])if(lider[k]===r.id)glowa.append(h("span","odznaka lider-"+k,T["lider_"+k]));
    const t=W.tablica&&W.tablica[r.id],m=t&&t.miejsce&&t.miejsce[W.wg];
    if(m){const o=h("span","odznaka na-tablicy"+(m===1?" pierwsze":""),tt("miejsceNaTablicy",{n:m}));o.title=T.miejsceNaTablicyOpis;glowa.append(o);}
    const partia=h("span","wiersz-partia");
    partia.append(znaczekTrudnosci(r.trudnosc,"maly"),nazwaPartii(p.partie[r.partia])+
      (r.premia?" · "+tt("premia",{n:fmtLiczba(r.premia)}):"")+(r.premiaChoru>0?" · "+tt("premiaChoru",{n:fmtLiczba(r.premiaChoru)}):"")+
      (r.premiaKlik>0?" · "+tt("premiaKlik",{n:fmtLiczba(r.premiaKlik)}):""));
    // rozbicie: żetony z liczbą nut na ocenę (kolory ocen jak naklejki na torze), wibrato i „w rytm” tylko, gdy były
    const rz=rozbicieWyniku(r),rozb=h("div","wiersz-rozbicie");
    for(const x of rz.nuty.concat(rz.dodatki)){
      const z=h("span","rozb rozb-"+x.k,x.n+" "+T["rozb_"+x.k]);
      const kolor=x.k==="wibrato"?ZC_DYMKI_KOLOR.wibrato:x.k==="klik"?ZC_DYMKI_KOLOR.klik:x.k==="wpunkt"?ZC_WPUNKT_KOLOR:x.k==="pudlo"?"#8a8275":ZC_OCENY_KOLOR[x.k];
      z.style.setProperty("--c",kolor);z.style.background=rgba(kolor,x.k==="pudlo"?.14:.22);z.style.boxShadow="inset 0 0 0 1.2px "+rgba(kolor,.6);
      rozb.append(z);
    }
    rozb.title=tt("rozbicieOpis",Object.assign({wibrato:r.wibrata|0,klik:((r.kliki||{}).idealnie|0)+((r.kliki||{}).dobrze|0),
      wpunkt:r.wPunkt|0,seria:r.najSeriaWPunkt|0},r.oceny||{}));
    // runda 6: tempo ≠ 100 % = żeton „tempo 150 % · ×1,35” obok ocen i dopisek w dymkach rozbicia i punktów
    const tp=S.gra&&S.gra.tempoProc,mt=S.gra&&S.gra.mnTempa,mtTxt=mt?mt.toLocaleString(ZC_LOC,{minimumFractionDigits:2,maximumFractionDigits:2}):"";
    if(tp&&tp!==100){
      const z=h("span","rozb rozb-tempo",tt("tempoZeton",{n:tp,m:mtTxt}));
      z.style.setProperty("--c",ZC_WPUNKT_KOLOR);z.style.background=rgba(ZC_WPUNKT_KOLOR,.16);z.style.boxShadow="inset 0 0 0 1.2px "+rgba(ZC_WPUNKT_KOLOR,.6);
      rozb.append(z);rozb.title+=" "+tt("tempoMnoznik",{m:mtTxt})+".";
    }
    // 10-18: pomoce ≠ ×1 (przyciąganie, „śpiewa sama”, podpowiedź, skok do nuty na klawiaturze) = żeton „pomoce ×0,58”
    const mp=g.mnPomocy,mpTxt=mp&&mp!==1?fmtMn(mp):"";
    if(mpTxt){
      const z=h("span","rozb rozb-pomoce",tt("pomoceZeton",{m:mpTxt})),kol=mp<1?"#8a8275":ZC_OCENY_KOLOR.czysto;
      z.style.setProperty("--c",kol);z.style.background=rgba(kol,.16);z.style.boxShadow="inset 0 0 0 1.2px "+rgba(kol,.6);
      rozb.append(z);rozb.title+=" "+tt("pomoceMnoznik",{m:mpTxt})+".";
    }
    kto.append(glowa,partia,rozb);
    const liczba=(v,et,klasa)=>{const d=h("div","wiersz-liczba"+(klasa?" "+klasa:""));d.append(h("b","",v),h("span","",et));return d;};
    const prec=liczba(Math.round(r.precyzja)+"%",tt("trafionych",{t:r.trafione,n:r.nut}),"precyzja");
    prec.title=T.kolCelnosc+": "+Math.round(r.celnosc)+"%";
    const pkt=liczba(fmtLiczba(r.punkty),T.kolPunkty,"punkty");
    pkt.title=tt("punktySkad",{nuty:fmtLiczba(rz.punkty.nuty),premia:fmtLiczba(rz.punkty.premia),chor:fmtLiczba(rz.punkty.chor),klik:fmtLiczba(rz.punkty.klik)})+
      (tp&&tp!==100?" · "+tt("tempoMnoznik",{m:mtTxt}):"")+(mpTxt?" · "+tt("pomoceMnoznik",{m:mpTxt}):"");
    li.append(h("span","wiersz-miejsce",String(i+1)),kap,kto,pkt,prec,
      liczba(String(r.maxKombo),T.kolKombo),gwiazdkiSvg(r.gwiazdki,16));
    ol.append(li);
  });
}
// Aplauz kapslem (recenzja 2, pomysł 5): przez 5 s od wyników każdy gracz bije brawo swoim sterowaniem
// (kapsel: obrót, mysz: ruch, klawiatura: dowolne klawisze, bot: po swojemu). Suma napędza widownię
// i konfetti, a po brawach najgłośniejszy dostaje „Największy aplauz” (tylko w towarzystwie).
function krokAplauzu(dt){
  const W=S.wyniki,A=W&&W.aplauz;if(!A||!S.gra)return;
  const teraz=performance.now(),wiek=(teraz-W.od)/1000;
  if(!A.koniec){
    // ruch myszy wygładzony (0,25 s): zdarzenia przychodzą zrywami, a limit °/s liczy się na klatkę
    A.ruch=wygladzEMA(A.ruch||0,dt>0?S.aplauzRuch/dt:0,dt,.25);
    const probki=S.gracze.map(g=>{
      const w=zrodloGracza(g),p={id:g.id,twist:0,ruch:0,klawisze:0};
      if(g.zrodlo==="kapsel"){if(w&&w.swiezy)p.twist=w.twist||0;}
      else if(g.zrodlo==="pad"){if(w)p.twist=w.twist||0;}
      else if(g.zrodlo==="bot"){const b=A.boty[g.id];if(b&&wiek<b.trwa)p.twist=b.amp*(.55+.45*Math.sin(wiek*7+b.faza));}
      else if(g.zrodlo==="mysz")p.ruch=A.ruch;
      else p.klawisze=S.aplauzKlawisze[g.zrodlo]||0;
      return p;
    });
    S.aplauzRuch=0;S.aplauzKlawisze={};
    const z=zbierzAplauz(A.sumy,probki,dt);
    A.sumy=z.sumy;A.glos=wygladzEMA(A.glos,z.glosnosc,dt,z.glosnosc>A.glos?.08:.45);
    if(wiek>=ZC_APLAUZ.SEK)zakonczAplauz();
  }else A.glos=wygladzEMA(A.glos,0,dt,.5);
  if(A.glos>.5&&teraz-A.ostFala>1400){S.gra.fala=teraz;A.ostFala=teraz;}   // mocne brawa: fala przez widownię
  // Konfetti na końcu pasuje do wybranego tła: pierwsze 1,6 s wyników zawsze sypie,
  // także bez braw; brawa dokładają jak dotąd
  A.doKonfetti+=(wiek<1.6&&!ruchOgraniczony()?48*dt:0)+A.glos*55*dt+(wiek<2.5&&!ruchOgraniczony()?(A.zOgnia||0)/2.5*dt:0);
  while(A.doKonfetti>=1){A.doKonfetti--;if(A.konfetti.length<320)A.konfetti.push(nowyKonfetti());}
  for(const k of A.konfetti){k.x+=k.vx*dt;k.y+=k.vy*dt;k.kat+=k.wkat*dt;}
  A.konfetti=A.konfetti.filter(k=>k.y<R.H+30);
  const m=document.querySelector(".aplauz-miernik");if(m)m.style.setProperty("--glos",A.glos.toFixed(3));
}
function zakonczAplauz(){
  const W=S.wyniki,A=W.aplauz;A.koniec=true;
  if(W.ranking.length>=2){
    A.nagroda=najwiekszyAplauz(A.sumy,W.ranking.map(r=>r.id));
    const suma=Object.values(A.sumy).reduce((s,x)=>s+x,0);
    if(A.nagroda)naklejkaNagrody(T.nagrodaAplauz,A.nagroda,tt("nagrodaAplauzWartosc",{n:Math.round(100*A.sumy[A.nagroda]/Math.max(1,suma))}));
  }
  const pp=el("wynikiPodpowiedz");pp.textContent=T.wynikiPodpowiedz;pp.classList.remove("aplauz");
  // 10-17: strażnik klatek nie zmienia obrazu w piosence; tu mówi, co obniży od następnej (żeby obniżka nigdy nie była cicha)
  const wj=el("wynikiJakosc");if(wj){wj.hidden=!R.jakoscCzeka;if(R.jakoscCzeka)wj.textContent=tt("wynikiJakosc",{co:T["jakosc_"+R.jakoscCzeka]||""});}
}
function aplauzKlawisz(kod){
  const A=S.wyniki&&S.wyniki.aplauz;if(S.ekran!=="wyniki"||!A||A.koniec)return;
  let sch=null;
  for(const k in Wejscie.KLAWIATURA){const s=Wejscie.KLAWIATURA[k];
    if(kod===s.gora||kod===s.dol||kod===s.lewo||kod===s.prawo||s.spiew.includes(kod))sch=k;}
  const kl=S.gracze.filter(g=>g.zrodlo==="ws"||g.zrodlo==="strzalki");
  const g=sch?kl.find(x=>x.zrodlo===sch):(kl.length===1?kl[0]:null);   // inne klawisze: jedyny gracz klawiatury
  if(g)S.aplauzKlawisze[g.zrodlo]=(S.aplauzKlawisze[g.zrodlo]||0)+1;
}
// Konfetti z naklejek nad kartą wyników: paski papieru w kolorach marki z twardym cieniem i małe żaby, a od 10-16
// w ok. 60 % drobiazgi motywu planszy (iskra-0..5.webp z web/assets/motywy/<id>/, te same co w efekcie serii), więc
// w Halloween lecą dynie, w Kosmosie gwiazdy itd. Grafika jeszcze nie wczytana albo tryb „Wydajność” = papier.
const ZC_KONFETTI_KOLORY=["#ec1a83","#6cb33f","#eaa32b","#294aa8","#a6d861","#e9d4ae"];
function nowyKonfetti(){
  const r=Math.random;   // tylko wygląd, nie wpływa na wynik
  return {x:r()*R.W,y:-16-r()*40,vx:(r()-.5)*70,vy:110+r()*170,kat:r()*6.28,wkat:(r()-.5)*7,w:7+r()*7,h:4+r()*4,
    kolor:ZC_KONFETTI_KOLORY[Math.floor(r()*ZC_KONFETTI_KOLORY.length)],zaba:r()<.1,
    iskra:r()<.6?"iskra-"+Math.floor(r()*6)+".webp":null,rozm:22+r()*16};
}
function rysujKonfetti(){
  const cv=el("konfetti"),A=S.wyniki&&S.wyniki.aplauz,ile=A?A.konfetti.length:0;
  if(!cv||(!ile&&!cv.brudne))return;
  const d=R.dpr||1,W=innerWidth,H=innerHeight;
  if(cv.width!==Math.round(W*d)||cv.height!==Math.round(H*d)){cv.width=Math.round(W*d);cv.height=Math.round(H*d);}
  const c=cv.getContext("2d");c.setTransform(d,0,0,d,0,0);c.clearRect(0,0,W,H);
  cv.brudne=ile>0;
  const tlo=wpisTla(),idTla=tlo&&tlo.id&&typeof Motywy!=="undefined"&&Motywy.motyw&&Motywy.motyw(tlo.id)?tlo.id:null;
  for(const k of A?A.konfetti:[]){
    c.save();c.translate(k.x,k.y);c.rotate(k.kat);
    const z=k.zaba?zabaNaklejka(3,k.kolor,false):null;
    const im=!z&&k.iskra&&idTla?Motywy.zasob(idTla,k.iskra):null;
    if(z)c.drawImage(z.cv,-11,-11,22,22);
    else if(im){const s=k.rozm/Math.max(im.naturalWidth,im.naturalHeight);c.drawImage(im,-im.naturalWidth*s/2,-im.naturalHeight*s/2,im.naturalWidth*s,im.naturalHeight*s);}
    else{
      c.fillStyle="rgba(120,90,40,.28)";c.fillRect(-k.w/2+1.5,-k.h/2+2,k.w,k.h);
      c.fillStyle=k.kolor;c.fillRect(-k.w/2,-k.h/2,k.w,k.h);
      c.strokeStyle="#211f1d";c.lineWidth=1;c.strokeRect(-k.w/2,-k.h/2,k.w,k.h);
    }
    c.restore();
  }
}
function wyczyscKonfetti(){
  const cv=el("konfetti");if(!cv||!cv.brudne)return;
  cv.getContext("2d").clearRect(0,0,cv.width,cv.height);cv.brudne=false;
}
function jeszczeRaz(){if(typeof Nagrody!=="undefined"&&Nagrody.otwarte){Nagrody.dalej();return;}
  if(S.ekran==="wyniki"){Glos.odblokuj();startGry();}}
// „Od nowa” z pauzy (recenzja 10-15: standard gier rytmicznych): ta sama piosenka i skład od odliczania, bez wyjścia do lobby.
// Przerwana gra nie liczy się do sławy ani tablicy (jak „Wyjdź”); startGry sam zdejmuje pauzę i buduje głosy od nowa.
function odNowa(){if(S.gra&&(S.ekran==="gra"||S.ekran==="odliczanie")){Glos.odblokuj();startGry();}}
function innaPiosenka(){if(typeof Nagrody!=="undefined"&&Nagrody.otwarte){Nagrody.zamknij();return;}
  if(S.ekran==="wyniki"||S.ekran==="gra"||S.ekran==="odliczanie")przerwijGre();}

// =============================================================================================
// 7. PĘTLA, ZDARZENIA, PLIKI
// Krok czasu. Wzorcem jest zegar AudioContext (Glos.czas), bo na nim planowane są nuty: krok liczony
// z performance.now rozjeżdżał się z dźwiękiem przy każdym zacięciu, a dawne przycięcie dt do 50 ms
// GUBIŁO czas (klatka 80 ms = gra 30 ms w tyle, zaplanowany dźwięk już leciał, a nuty „czekały”).
// Teraz czas nie ginie: długi krok dzieli się na podkroki ≤ PODKROK, a dźwięk planuje się raz, na końcu.
// Karta w tle to pauza (visibilitychange), nie przewinięcie piosenki o kilka taktów.
function krok(dtWymuszone){
  const teraz=performance.now();
  let dt;
  if(dtWymuszone!=null){dt=dtWymuszone;S.ostatnioAudio=null;}
  else{
    const ta=Glos.czas();
    dt=ta!=null&&S.ostatnioAudio!=null&&ta>=S.ostatnioAudio?ta-S.ostatnioAudio:(teraz-S.ostatnio)/1000;
    S.ostatnioAudio=ta;
  }
  S.ostatnio=teraz;
  dt=Math.max(0,dt||0);
  const wGrze=(S.ekran==="odliczanie"||S.ekran==="gra")&&!S.pauza;
  if(S.zegarStoi&&wGrze&&dtWymuszone==null){   // pierwsze klatki po startGry (tam opis)
    const Z=S.zegarStoi;
    if(Z.zaslona)dt=0;   // zasłona wczytywania utworu: zegar puszcza koniecWczytywaniaUtworu
    else if((++Z.n>3&&dt<=.04&&(Z.graf||(Z.graf=wczytajGrafikiMotywow())))||teraz-Z.od>(Z.graf?1500:3000))S.zegarStoi=null;else dt=0;
  }
  // dłuższa przerwa (pierwszy start buduje bufory, odpluskwiacz, karta w tle bez zdarzenia visibilitychange):
  // nadrabiamy najwyżej MAKS_NADROBIENIE, resztę odpuszczamy. To jednorazowy przeskok, nie trwały rozjazd,
  // bo kolejne nuty planują się względem NOWEGO G.beat; karta w tle i tak idzie w pauzę (visibilitychange).
  if(wGrze&&dt>ZC_ZEGAR.MAKS_NADROBIENIE)console.info("RibbitBeat: klatka stała "+dt.toFixed(2)+" s, gra odpuszcza nadmiar");
  dt=Math.min(ZC_ZEGAR.MAKS_NADROBIENIE,dt);
  // pakiet piosenki z audio (pakiet-piosenki.js): grające nagranie prowadzi zegar gry; pauza, przewijanie i koniec je zatrzymują
  if(typeof PakietPiosenki!=="undefined")dt=PakietPiosenki.zegar(S.gra,dt,wGrze,dtWymuszone!=null);
  Wejscie.krok(dt,teraz);
  krokPilotow(Math.min(ZC_ZEGAR.PODKROK,dt));   // kapsel jako pilot menu: w lobby, w pauzie, na wynikach i w samouczku
  if(S.wznowienie){if(!S.gra||!S.pauza||S.ekran!=="gra"){S.wznowienie=null;pokazWznowienie(null);}else krokWznowienia(Math.min(ZC_ZEGAR.PODKROK,dt),teraz);}
  if(S.ekran==="lobby")lobbyKrok(Math.min(ZC_ZEGAR.PODKROK,dt));
  else if(wGrze){
    let zostalo=dt;
    while(zostalo>0&&S.gra&&!S.pauza&&(S.ekran==="odliczanie"||S.ekran==="gra")){
      const k=Math.min(ZC_ZEGAR.PODKROK,zostalo);zostalo-=k;
      graKrok(k,zostalo>1e-9);
    }
  }
  else if(S.ekran==="wyniki")krokAplauzu(Math.min(ZC_ZEGAR.PODKROK,dt));
}
function rysuj(){
  const teraz=performance.now();
  if(S.ekran==="lobby")rysujLobbyNaZywo(teraz);
  else if(S.ekran==="odliczanie"||S.ekran==="gra"){
    if(S.wczyt){if(!S.wczyt.rysuj)return;S.wczyt.narys++;}   // zasłona wczytywania utworu: do etapu 4 układu jeszcze nie ma
    // 10-17: próba generalna sceny w pierwszej klatce odliczania (zegar stoi): programy GPU całej piosenki przed pierwszą nutą (js/proba-sceny.js)
    // raz na układ w tej karcie: programy GPU zostają w przeglądarce do jej zamknięcia, druga piosenka ich nie kompiluje
    if(S.ekran==="odliczanie"&&S.gra&&!S.gra.proba&&ZC_DEV.proba&&grafikaPelna()&&typeof ProbaSceny!=="undefined"){S.gra.proba=true;
      const P=R.probyZrobione||(R.probyZrobione=new Set()),k=R.ukladKlucz||"?";if(!P.has(k)){P.add(k);
        // pod zasłoną wczytywania utworu próba idzie w kawałkach, po jednym stanie na klatkę (krokWczytywaniaUtworu)
        if(S.wczyt&&ProbaSceny.kawalek)S.wczyt.proba=0;else ProbaSceny.wykonaj(teraz);}}
    rysujScene(teraz);odswiezHud();}
  else if(S.ekran==="wyniki"&&S.gra){   // widownia bije brawo pod kartą; po brawach i konfetti obraz stoi
    const A=S.wyniki&&S.wyniki.aplauz;
    if(!A||!A.spokoj){rysujScene(teraz);rysujKonfetti();if(A&&A.koniec&&A.glos<.005&&!A.konfetti.length)A.spokoj=true;}
  }
}
function licznikFps(teraz){
  const f=S.fps;f.klatki++;
  if(teraz-f.od>=500){f.wartosc=f.klatki*1000/(teraz-f.od);f.klatki=0;f.od=teraz;
    if(f.pokaz)el("fps").textContent=f.wartosc.toFixed(0)+" fps";}
}
// Limit klatek (ustawienie „Klatki”, 10-04): krok gry co klatkę monitora, RYSOWANIE najwyżej `S.ust.klatki` razy na
// sekundę i zawsze co tyle samo klatek monitora. Próg = okres celu minus pół okresu odświeżania, więc 240 Hz + 60 =
// co 4. klatka, 144 Hz + 60 = co 2. (72 fps, równo), 60 Hz = każda. Okres odświeżania = 10. percentyl ostatnich 31
// odstępów rAF (najkrótsze odstępy to sam monitor, dłuższe to zacięcia). 0 = bez limitu.
function czasNaRysowanie(ts){
  const K=R.klatki||(R.klatki={ost:null,d:[],vsync:1000/60,nr:0,ostRys:-1e9});
  if(K.ost!=null){const d=ts-K.ost;if(d>1&&d<100){K.d.push(d);if(K.d.length>31)K.d.shift();if(!(K.min<=d))K.min=d;}}
  K.ost=ts;
  if(K.d.length>=10&&++K.nr%15===0){const s=K.d.slice().sort((a,b)=>a-b);K.vsync=s[Math.floor(s.length*.1)];}
  const cel=+S.ust.klatki||R.limitAuto||0;   // limitAuto: strażnik klatek przy „bez limitu” (obnizJakosc)
  if(!(cel>0)){K.ostRys=ts;K.cel=null;return true;}
  // Stała siatka czasu (10-10, płynność). Okres = pełna liczba okresów odświeżania (240 Hz: 4 × 4,17; 144 Hz: 2 × 6,94),
  // klatka rysuje się na pierwszym ticku od celu, a następny cel to POPRZEDNI CEL + okres, nie chwila rysowania.
  // Dotąd licznik szedł od chwili rysowania z progiem „okres − pół odświeżenia”: pod obciążeniem przeglądarka pomija
  // ticki, szacunek odświeżania wychodził 8,3 zamiast 4,2 ms i próg spadał do 12,5 ms, więc odstępy skakały
  // 12,5 / 16,7 / 20,8 ms (żółte słupki w F3 przy niezajętym JS). Iloczyn liczby odświeżeń i okresu się nie zmienia.
  const v=K.vsync,okres=Math.max(1,Math.round(1000/cel/v))*v,luz=Math.min(2,v/2);
  if(K.cel==null||ts-K.cel>okres/2)K.cel=ts;   // start albo spóźnienie ponad pół okresu: nowa faza od tej chwili
  if(ts<K.cel-luz)return false;
  K.cel+=okres;
  K.ostRys=ts;return true;
}
// ---- strażnik klatek: auto-jakość (10-10; 10-17: nic nie zmienia obrazu w trakcie piosenki) ----
// Jak w grach z dynamiczną rozdzielczością: w piosence (bez odliczania, pauzy i pierwszych klatek) liczy narysowane
// klatki spóźnione względem siatki (ogranicznik: 16,7 ms; spóźniona = dłuższa o ponad 0,6 okresu odświeżania, min.
// 2,5 ms, czyli żółty albo czerwony słupek w F3). 8 spóźnionych na 120 klatek = decyzja o jakości o stopień w dół:
// 1) render płócien 1× zamiast 1,5–2×, 2) bez ognia, dymu i iskier, 3) tryb wydajności. Pojedyncze zacięcie tego nie robi.
// Zmiana trybu w środku piosenki psuła imersję, więc w piosence jedyny krok, który wchodzi od razu, to
// niewidoczny limit klatek przy „bez limitu”. Obniżka jakości czeka (R.jakoscCzeka) do następnej piosenki: zapisuje się
// od razu dla tego ekranu i wybranej grafiki (następne uruchomienie też startuje płynnie), ekran wyników mówi, co się
// zmieni. Własny wybór „Grafiki” w ustawieniach kasuje obniżkę; przełącznik „Auto-jakość” wyłącza strażnika; ?straznik=0 też.
const ZC_STRAZNIK={OKNO:120,PROG:8,CISZA:1500,KLUCZ:"ribbitflip.zabiChor.jakoscAuto"};
const ekranStraznika=()=>screen.width+"x"+screen.height+"@"+(window.devicePixelRatio||1);
function wczytajJakoscAuto(){
  R.jakoscCzeka=0;
  let z=null;try{z=JSON.parse(localStorage.getItem(ZC_STRAZNIK.KLUCZ)||"null");}catch(e){}
  // 10-17 (podgląd w tier liście: zapisany poziom 3 z ramki wracał przy każdym starcie i gra nie rysowała tła motywu): ?straznik=0
  // ignoruje też zapisaną obniżkę, nie tylko zatrzymuje strażnika.
  R.autoJakosc=ZC_DEV.straznik===false?0:S.ust.autoJakosc!==false&&z&&z.ekran===ekranStraznika()&&z.grafika===S.ust.grafika?Math.max(0,Math.min(3,z.poziom|0)):0;
}
function skasujJakoscAuto(){
  R.autoJakosc=0;R.jakoscCzeka=0;R.straznik=null;
  try{localStorage.removeItem(ZC_STRAZNIK.KLUCZ);}catch(e){}
}
function straznikKlatek(ts){
  if(!ZC_DEV.straznik||S.ust.autoJakosc===false||!S.gra||S.pauza||S.ekran!=="gra"||S.zegarStoi||S.ust.grafika==="wydajnosc"||(R.autoJakosc||0)>=3||R.jakoscCzeka){R.straznik=null;return;}
  const K=R.straznik||(R.straznik={ost:null,n:0,zle:0,od:ts+ZC_STRAZNIK.CISZA});
  const d=K.ost==null?0:ts-K.ost;K.ost=ts;
  if(ts<K.od||!(d>0))return;
  const v=R.klatki?R.klatki.vsync:1000/60,cel=+S.ust.klatki||R.limitAuto||0,okres=Math.max(cel>0?1000/cel:0,1000/60);
  if(d>okres+Math.max(2.5,v*.6))K.zle++;
  if(++K.n<ZC_STRAZNIK.OKNO)return;
  const zle=K.zle;K.n=0;K.zle=0;
  if(zle>=ZC_STRAZNIK.PROG)obnizJakosc(zle);
}
function obnizJakosc(zle){
  // „Klatki: bez limitu” na ekranie 144–240 Hz (10-10): pierwszy krok to limit 120 (60 na wolniejszym), nie jakość. Pomiar: rysowanie
  // 200+ razy na sekundę zajmowało wątek GPU w 93–95 % i każde dodatkowe zadanie (nowa bitmapa, kompilacja programu) dawało zacięcie.
  if(!(+S.ust.klatki>0)&&!R.limitAuto){
    const v=R.klatki&&R.klatki.min||1000/60;R.limitAuto=v<7?120:60;   // min = najkrótszy odstęp rAF w sesji (pod obciążeniem szacunek vsync rośnie)
    console.info("RibbitBeat: strażnik klatek: bez limitu → "+R.limitAuto+" kl./s ("+zle+" spóźnionych klatek na "+ZC_STRAZNIK.OKNO+")");
    R.straznik={ost:null,n:0,zle:0,od:performance.now()+ZC_STRAZNIK.CISZA};if(R.klatki)R.klatki.cel=null;return;
  }
  let p=(R.autoJakosc||0)+1;
  if(p===1&&!((window.devicePixelRatio||1)>1))p=2;   // render już jest 1×
  if(p===2&&S.ust.grafika==="uproszczona")p=3;      // ognia już nie ma
  R.jakoscCzeka=Math.min(3,p);   // wejdzie z wczytajJakoscAuto() na starcie następnej piosenki; ta gra się nie zmienia
  try{localStorage.setItem(ZC_STRAZNIK.KLUCZ,JSON.stringify({poziom:R.jakoscCzeka,ekran:ekranStraznika(),grafika:S.ust.grafika}));}catch(e){}
  console.info("RibbitBeat: strażnik klatek: od następnej piosenki jakość w dół do poziomu "+R.jakoscCzeka+" ("+zle+" spóźnionych klatek na "+ZC_STRAZNIK.OKNO+")");
  R.straznik=null;
}
function petla(ts){
  const teraz=ts||performance.now();
  const t0=performance.now();
  krok();
  if(S.wczyt)krokWczytywaniaUtworu(teraz);
  else if(S.ekran==="lobby")krokZawczasu(teraz);
  if(czasNaRysowanie(teraz)){
    rysuj();
    straznikKlatek(teraz);
    dymkiZWyprzedzeniem(teraz);sprajtyZWyprzedzeniem();
    if(S.pomiarJs)S.pomiarJs.push(performance.now()-t0);   // czas JS jednej klatki (ZC.mierzFps)
    if(S.pomiarRys)S.pomiarRys.push(teraz);
    licznikFps(teraz);
  }
  requestAnimationFrame(petla);
}
function obsluzWejscie(z){
  if(typeof TB!=="undefined"&&TB.otwarta&&(z.typ==="wcisniecie"||z.typ==="start"||z.typ==="klawisz"))return;
  const w=z.gracz,g=S.gracze.find(x=>x.id===w.id),klawiatura=w.zrodlo==="ws"||w.zrodlo==="strzalki"||w.zrodlo==="pad";
  // W kroku 2 klawiatura i pad ustawiają swoją kartę tak samo jak kapsel (11-19): góra/dół (W/S, ↑/↓, krzyżak) wybiera
  // pole karty, krzyżak w bok je zmienia (A/D, ←/→ i gałka robią to przechyłem w lobbyKrok); gotowy gracz stoi.
  // Do 11-19 góra/dół zmieniało instrument, a bok partię, i na tym koniec.
  if(z.typ==="pion"||z.typ==="bok"){
    if(g&&klawiatura&&!g.gotowy&&S.ekran==="lobby"&&S.lobbyEkran==="konfiguracja"&&!S.wyborPlanszy&&!nakladkaLobby()&&
      !(typeof TB!=="undefined"&&TB.otwarta)){if(z.typ==="pion")przesunPoleKapsla(g,z.kier);else zmienPoleKapsla(g,z.kier);}
    return;
  }
  // Start pada: pauza w piosence (jak Esc), na wynikach „jeszcze raz”
  if(z.typ==="start"){
    if(S.ekran==="gra"||S.ekran==="odliczanie")ustawPauze(S.wznowienie?true:!S.pauza);
    else if(S.ekran==="wyniki"&&performance.now()-S.wyniki.od>2000)jeszczeRaz();
    return;
  }
  // klawiatura i pad dołączają dowolnym swoim klawiszem: przy pierwszym naciśnięciu („nowe”) i po odejściu („klawisz”)
  if(klawiatura&&(z.typ==="nowe"||z.typ==="klawisz")){
    Glos.odblokuj();
    if(S.ekran==="lobby"&&!g)dolacz(w.id);
    return;
  }
  if(z.typ==="klawisz")return;
  if(z.typ==="nowe"){if(S.ekran==="lobby")rysujGraczy();return;}
  if(z.typ==="znika"){if(g&&S.ekran==="lobby")odlacz(w.id);else if(S.ekran==="lobby")rysujGraczy();return;}
  if(z.typ==="zmiana"){
    if(g&&S.ekran==="lobby"){if(!g.nazwaWlasna)g.nazwa=w.nazwa||g.nazwa;if(!g.kolorWlasny)g.kolor=w.kolor;g.obrazekKapsla=w.obrazekKapsla;g.etykieta=w.etykieta||"";
      if(w.zrodlo==="bot")g.poziom=w.poziom||null;}
    if(S.ekran==="lobby")rysujGraczy();
    return;
  }
  if(z.typ!=="wcisniecie"||w.zrodlo==="mysz"||w.zrodlo==="bot"||S.pauza)return;
  if(S.ekran==="lobby"){
    if(S.wyborPlanszy){if(g&&w.zrodlo!=="kapsel")sterujWyboremPlanszy(g,"ok");return;}   // kapsel: krokWyboruPlanszy
    if(!g){if(w.zrodlo==="kapsel")dolaczKapsel(w);}
    else if(S.lobbyEkran==="konfiguracja"&&w.zrodlo!=="kapsel")przelaczGotowy(g);   // kapsel: krokPilota (ok / przytrzymanie)
  }   // 10-20: na wynikach kapsel jest pilotem (krokPilotow klika przycisk z fokusem, na starcie „Jeszcze raz”), więc
      // nie nabijamy mu tu drugiego „jeszcze raz” — inaczej jedno naciśnięcie robiłoby dwie rzeczy naraz
  else if(S.ekran==="wyniki"&&g&&w.zrodlo!=="kapsel"&&performance.now()-S.wyniki.od>2000)jeszczeRaz();
}
function podlaczZdarzenia(){
  Wejscie.naZdarzenie(obsluzWejscie);
  addEventListener("pointerdown",()=>Glos.odblokuj(),{capture:true});
  document.addEventListener("visibilitychange",()=>{if(document.hidden)ustawPauze(true);});   // karta w tle = pauza, nie przewinięcie
  addEventListener("pointermove",e=>{   // brawa myszą: droga kursora w px
    if(S.ekran==="wyniki"&&S.ostMysz)S.aplauzRuch+=Math.hypot(e.clientX-S.ostMysz.x,e.clientY-S.ostMysz.y);
    S.ostMysz={x:e.clientX,y:e.clientY};
  },{passive:true});
  addEventListener("keydown",e=>{
    const wGrze=S.ekran==="gra"||S.ekran==="odliczanie";
    if(S.ekran==="wyniki"&&!e.repeat&&e.key!=="Escape")aplauzKlawisz(e.code);
    if(e.key==="Escape"&&wGrze){e.preventDefault();ustawPauze(S.wznowienie?true:!S.pauza);return;}
    if(S.pauza&&!S.wznowienie&&(e.key==="q"||e.key==="Q")){e.preventDefault();innaPiosenka();return;}
    if(S.pauza&&!S.wznowienie&&(e.key==="r"||e.key==="R")&&!e.repeat){e.preventDefault();odNowa();return;}
    if(S.pauza&&!S.wznowienie&&e.key==="Tab"){   // 10-18 (Z-13b): Tab i Shift+Tab krążą w oknie pauzy (aria-modal)
      e.preventDefault();const b=[...el("pauza").querySelectorAll("button")].filter(x=>!x.disabled&&x.getClientRects().length),i=b.indexOf(document.activeElement);
      if(b.length)b[(i<0?0:i+(e.shiftKey?-1:1)+b.length)%b.length].focus({preventScroll:true});return;}
    if(S.pauza&&!S.wznowienie&&/^Arrow(Left|Right|Up|Down)$/.test(e.key)){   // 10-15: strzałki chodzą po przyciskach pauzy
      e.preventDefault();const b=[...el("pauza").querySelectorAll("button")],i=b.indexOf(document.activeElement);
      const d=e.key==="ArrowLeft"||e.key==="ArrowUp"?-1:1;b[(i<0?0:i+d+b.length)%b.length].focus({preventScroll:true});return;}
    // 10-18 (Z-73, D-20): Esc z tą samą ochroną 2 s co Spacja i Enter (Esc w ostatniej chwili piosenki nie przeskakuje wyników)
    if(e.key==="Escape"&&S.ekran==="wyniki"){e.preventDefault();if(S.wyniki&&performance.now()-S.wyniki.od>2000)innaPiosenka();return;}
    // na wynikach Spacja i Enter działają dla każdego (też dla chóru z samą myszą), po 2 s ochrony
    // 10-15: Enter/Spacja na innym zaznaczonym przycisku wyników (Inna piosenka, Tablica, Kopiuj) robi to, co on, nie „jeszcze raz”
    const fokWyn=document.activeElement;
    if((e.code==="Space"||e.code==="Enter"||e.code==="NumpadEnter")&&S.ekran==="wyniki"&&fokWyn&&fokWyn.closest&&fokWyn.closest("#wyniki")&&
       (fokWyn.tagName==="BUTTON"||fokWyn.tagName==="A")&&fokWyn.id!=="btnJeszczeRaz"){
      // 10-18 (Z-19): wejscie.js zabiera Spację i Enter graczom, gdy fokus nie przyszedł z Taba, więc klik robimy sami;
      // „Inna piosenka” z ochroną 2 s jak „Jeszcze raz”, Tablica, Kopiuj i reszta od razu
      e.preventDefault();
      if(!e.repeat&&(fokWyn.id!=="btnInnaPiosenka"||performance.now()-S.wyniki.od>2000))fokWyn.click();
      return;
    }
    if((e.code==="Space"||e.code==="Enter"||e.code==="NumpadEnter")&&S.ekran==="wyniki"&&!e.repeat&&
       performance.now()-S.wyniki.od>2000){e.preventDefault();jeszczeRaz();}
  });
  // lobby: Esc = wstecz (szuflada, powiększony podgląd i okna łapią Esc wcześniej), strzałki = nawigacja po ekranie;
  // w kroku Rozgrywka strzałki należą do gracza „Strzałki”, a Enter i Spacja dołączają (wejscie.js)
  addEventListener("keydown",e=>{
    if(S.ekran!=="lobby"||e.defaultPrevented||e.ctrlKey||e.altKey||e.metaKey)return;
    if(e.key==="Escape"){if(wsteczLobby())e.preventDefault();return;}
    if(S.lobbyEkran==="konfiguracja")return;
    const akcja={ArrowUp:"gora",ArrowDown:"dol",ArrowLeft:"lewo",ArrowRight:"prawo"}[e.key];
    const a=document.activeElement;
    if(!akcja||(a&&(a.tagName==="INPUT"||a.tagName==="SELECT"||a.tagName==="TEXTAREA"||a.isContentEditable)))return;
    e.preventDefault();nawigujLobby(akcja,e.repeat?{powt:true}:undefined);   // trzymana strzałka przewija listę i nie wychodzi z niej do „Dalej”
  });
  addEventListener("pointerdown",()=>{kolListyWcisniecie=performance.now();document.body.classList.remove("nawigacja");schowajPilota();},{passive:true});
  // Koło utworów i dwuklik: pierwsze kliknięcie wiersza spoza środka od razu wiezie go na środek, więc drugie
  // kliknięcie dwukliku trafiłoby w sąsiada, który wjechał pod kursor. Drugie wciśnięcie w tym samym miejscu
  // znaczy to, co dwuklik zawsze znaczył: „Dalej” z utworem wskazanym pierwszym kliknięciem.
  addEventListener("mousedown",e=>{
    if(e.button!==0||S.ekran!=="lobby"||S.lobbyEkran!=="wybor")return;
    const b=e.target&&e.target.closest?e.target.closest("#wybor:not(.wgraj) .biblio-lista .bkarta-wybor"):null,t=e.timeStamp;
    if(!b){kolKlik=null;return;}
    if(kolKlik&&t-kolKlik.t<500&&Math.hypot(e.clientX-kolKlik.x,e.clientY-kolKlik.y)<10&&!b.closest(".bkarta").classList.contains("wybrana")){
      e.preventDefault();e.stopPropagation();kolKlik=null;
      const d=el("btnDalej");if(d)d.click();
      kolPolknij=performance.now();   // dopiero po „Dalej”: jego kliknięcie ma przejść, połknąć trzeba kliknięcie myszy, które zaraz przyjdzie
      return;
    }
    kolKlik={t,x:e.clientX,y:e.clientY};
  },true);
  for(const typ of ["click","dblclick"])addEventListener(typ,e=>{
    if(performance.now()-kolPolknij<600){if(typ==="dblclick")kolPolknij=-1e9;e.preventDefault();e.stopPropagation();}},true);
  addEventListener("resize",()=>{
    if(!S.gra||S.ekran==="lobby")return;
    ukladGry();
    if(S.ekran==="wyniki")rysujScene(performance.now());   // płótno po zmianie rozmiaru jest puste
  });
  el("btnJeszczeRaz").onclick=jeszczeRaz;
  el("btnInnaPiosenka").onclick=innaPiosenka;
  el("btnWroc").onclick=()=>ustawPauze(false);
  el("btnOdNowa").onclick=odNowa;
  el("btnWyjdz").onclick=innaPiosenka;
  el("hudDzwiek").onclick=()=>Glos.odblokuj();
  // MIDI upuszczone w dowolnym miejscu okna
  let wglebi=0;
  const maPliki=e=>!!(e.dataTransfer&&[...(e.dataTransfer.types||[])].includes("Files"));
  addEventListener("dragenter",e=>{if(!maPliki(e))return;e.preventDefault();wglebi++;el("upusc").hidden=false;});
  addEventListener("dragover",e=>{if(!maPliki(e))return;e.preventDefault();e.dataTransfer.dropEffect="copy";});
  addEventListener("dragleave",e=>{if(!maPliki(e))return;wglebi=Math.max(0,wglebi-1);if(!wglebi)el("upusc").hidden=true;});
  addEventListener("drop",e=>{
    if(!maPliki(e))return;
    e.preventDefault();wglebi=0;el("upusc").hidden=true;
    // Z-42a (10-18): wszystkie upuszczone pliki po kolei; przy kilku jeden toast z bilansem.
    // 11-19: upuszczony folder (także kilka naraz albo folder razem z plikami): wszystkie pliki MIDI z jego drzewa.
    // Wpisy trzeba zebrać od razu, w obsłudze zdarzenia: po niej lista dataTransfer.items jest już pusta.
    const dt=e.dataTransfer,pliki=[...((dt&&dt.files)||[])];
    const wpisy=[...((dt&&dt.items)||[])].map(x=>x.webkitGetAsEntry?x.webkitGetAsEntry():null).filter(Boolean);
    if(wpisy.some(w=>w.isDirectory)){plikiMidiZWpisow(wpisy).then(p=>wczytajPliki(p,{folder:true}));return;}
    if(pliki.length<2){if(pliki[0])wczytajPlik(pliki[0]);return;}
    wczytajPliki(pliki);
  });
}
// Wiele plików naraz albo cały folder (11-19). Pliki MIDI idą do biblioteki po kolei, ale bez wybierania każdego
// po drodze: przy setkach plików samo przełączanie podglądu trwałoby dłużej niż import. Na końcu jeden toast
// z bilansem (nowe, już były, nieudane) i wybrany zostaje ostatni wczytany utwór. Jeden plik idzie starą drogą.
const ZC_IMPORT={MAKS_PLIKOW:2000,ODDECH_CO:8};   // limit na jeden import; co ile plików oddać klatkę przeglądarce
const toPlikMidi=f=>/\.(mid|midi)$/i.test(f.name||"")||/midi/i.test(f.type||"");
async function wczytajPliki(pliki,o){
  if(S.ekran!=="lobby"){toast(T.najpierwSkoncz);return 0;}
  const zFolderu=!!(o&&o.folder),midi=[...pliki].filter(toPlikMidi).slice(0,ZC_IMPORT.MAKS_PLIKOW);
  if(!midi.length){toast(zFolderu?T.folderBezMidi:T.tylkoMidi,true);return 0;}
  if(midi.length===1)return (await wczytajPlik(midi[0]))?1:0;
  let nowe=0,byly=0,zle=0,ostatni=null,i=0;
  for(const f of midi){
    try{const w=Biblioteka.dodajPlik(await f.arrayBuffer(),f.name,"upuszczona");if(w.powtorka)byly++;else nowe++;ostatni=w;}
    catch(e){zle++;}
    if(++i%ZC_IMPORT.ODDECH_CO===0)await new Promise(r=>setTimeout(r,0));
  }
  if(ostatni){Biblioteka.ustawFiltr("folder",true);wybierzPiosenkeId(ostatni.id);if(S.lobbyEkran==="menu")pokazLobby("wybor");}
  const czesci=[];
  if(nowe)czesci.push(tt("dodanoWiele",{n:nowe,utwory:odmiana(nowe,T.utwor1,T.utwor2,T.utwor5)}));
  if(byly)czesci.push(tt("importByly",{n:byly}));
  if(zle)czesci.push(tt("importZle",{n:zle}));
  toast(czesci.join(" "),!nowe&&!byly);
  return nowe;
}
// Upuszczony folder: przeglądarka daje wpisy katalogu (webkitGetAsEntry), więc trzeba przejść drzewo samemu.
// Zbiera wyłącznie pliki .mid i .midi, także z podfolderów.
async function plikiMidiZWpisow(wpisy){
  const pliki=[];
  const czytaj=w=>new Promise(gotowe=>{
    if(pliki.length>=ZC_IMPORT.MAKS_PLIKOW){gotowe();return;}
    if(w.isFile){if(!/\.(mid|midi)$/i.test(w.name||"")){gotowe();return;}w.file(f=>{pliki.push(f);gotowe();},()=>gotowe());return;}
    if(!w.isDirectory){gotowe();return;}
    const czytnik=w.createReader();
    const dalej=()=>czytnik.readEntries(async lista=>{   // readEntries oddaje katalog porcjami: wołać do pustej listy
      if(!lista.length){gotowe();return;}
      for(const x of lista)await czytaj(x);
      dalej();
    },()=>gotowe());
    dalej();
  });
  for(const w of wpisy)await czytaj(w);
  return pliki;
}
async function wczytajPlik(f){
  if(S.ekran!=="lobby"){toast(T.najpierwSkoncz);return null;}
  if(!/\.(mid|midi)$/i.test(f.name||"")&&!/midi/i.test(f.type||"")){toast(T.tylkoMidi,true);return null;}
  try{const p=dodajPiosenkeMidi(await f.arrayBuffer(),f.name);if(S.lobbyEkran==="menu")pokazLobby("wybor");return p;}
  catch(e){toast(tt("bladMidi",{powod:(e&&e.message)||e}),true);return null;}
}
function dodajPiosenkeMidi(buf,nazwa){
  const w=Biblioteka.dodajPlik(buf,nazwa,"upuszczona");
  Biblioteka.ustawFiltr("folder",true);
  wybierzPiosenkeId(w.id);
  toast(w.powtorka?tt("biblioJuzJest",{tytul:w.gra.tytul}):tt("dodanoMidi",{tytul:w.gra.tytul,partie:liczbaPartii(w.gra.partie.length)}));
  return w.gra;
}

// =============================================================================================
// 8. API DLA HARNESSU: window.ZC
function stanGry(){
  const G=S.gra,p=piosenka();
  return {
    ekran:S.ekran,lobbyEkran:S.lobbyEkran,pauza:S.pauza,
    piosenka:p?{id:p.id,tytul:p.tytul,partie:p.partie.map(nazwaPartii),tempo:p.tempo,koniec:p.koniec}:null,
    ustawienia:Object.assign({},S.ust),
    beat:G?+G.beat.toFixed(3):null,
    postep:G?Math.max(0,Math.min(1,G.beat/G.piosenka.koniec)):null,
    gracze:S.gracze.map(g=>({id:g.id,nazwa:g.nazwa,zrodlo:g.zrodlo,partia:g.partia,instrument:instrumentGracza(g),kolor:g.kolor,
      gotowy:g.gotowy,punkty:g.punkty||0,kombo:g.kombo||0,maxKombo:g.maxKombo||0,mnoznik:g.mnoznik||1,
      oceny:g.oceny?Object.assign({},g.oceny):null,spiewa:!!g.spiewa,naNucie:!!g.naNucie,
      polton:g.polton!=null?+g.polton.toFixed(2):null,offMs:g.offMs!=null?g.offMs:null,
      premiaChoru:g.premiaChoru||0,wibrata:g.wibrata||0,gadanie:+(g.gadanie||0).toFixed(2),gada:!!g.gada,
      premiaKlik:g.premiaKlik||0,kliki:g.kliki?Object.assign({},g.kliki):null,seriaKlik:g.seriaKlik||0,
      wPunkt:g.wPunkt|0,seriaWPunkt:g.seriaWPunkt|0,najSeriaWPunkt:g.najSeriaWPunkt|0,sekcjeZdobyte:g.sekcjeZdobyte|0,
      slad:g.slad?g.slad.filter(s=>s.sp).length:0,halo:+(g.halo||0).toFixed(2),rechot:+(g.rechot||0).toFixed(2),poziom:g.poziom||null,ogien:g.ogien||0,
      precyzja:g.zamknieteNut?+precyzjaZOcen(g.oceny,g.zamknieteNut).toFixed(1):null,zamknieteNut:g.zamknieteNut||0,
      mnPomocy:g.mnPomocy||null,mnPunktow:g.mnPunktow||null,maks:g.maks?g.maks.razem:null,   // 10-18: mnożniki pomocy i punktów gracza
      pomoce:G&&g.pomoceGry?Object.assign({},g.pomoceGry):pomoceGracza(g),pomoceWlasne:g.zrodlo!=="bot"&&!!g.pomoce})),   // 10-18 wieczór: pomoce gracza
    ogien:G?G.ogien||0:0,loty:G?G.loty.map(l=>({gracz:l.g.id,punkty:l.punkty,mnoznik:l.mnoznik,ocena:l.ocena})):[],
    tory:G?G.tory.map(t=>({partia:t.partia,nazwa:nazwaPartii(t.def),gracze:t.gracze.map(g=>g.id),
      trudnosc:t.trudnosc?{ocena:t.trudnosc.ocena,poziom:t.trudnosc.poziom,glowne:t.trudnosc.glowne}:null,ogien:t.ogien||0,
      ocenione:t.oceny.filter(Boolean).length,nut:t.def.nuty.length,sekcje:(t.sekcje||[]).map((s,k)=>({od:s.od,do:s.do,swieci:sekcjaSwieci(t,k)})),
      wJednymGlosie:t.oceny.filter(o=>o&&o.wJednymGlosie).length,
      duch:t.duch?{alfa:+t.duch.alfa.toFixed(3),spiewa:t.duch.spiewa,polton:+t.duch.polton.toFixed(2)}:null})):[],
    nrGry:S.nrGry,
    scena:{widownia:S.scena&&S.scena.widownia?S.scena.widownia.id:"zaby",
      streaki:Object.fromEntries(S.gracze.map(g=>[g.id,g.stylStreak?g.stylStreak.id:"ogien"]))},
    podklad:G?G.podklad.length:0,
    dymki:G?G.popupy.map(p=>({tekst:p.ile>1?tt("scalonyPopup",{tekst:p.tekst,n:p.ile}):p.tekst,rodzaj:p.rodzaj,ile:p.ile})):[],
    wyniki:S.wyniki?{procent:+S.wyniki.procent.toFixed(1),gwiazdki:S.wyniki.gwiazdki,nagrody:S.wyniki.nagrody,
      wg:S.wyniki.wg,
      tablica:Object.fromEntries(Object.entries(S.wyniki.tablica||{}).map(([k,v])=>[k,{miejsce:v.miejsce,klucz:null,
        konfId:v.wpis.konfId,rekord:v.rekord?v.rekord.punkty:null}])),
      ranking:S.wyniki.ranking.map(r=>({id:r.id,punkty:r.punkty,celnosc:+r.celnosc.toFixed(1),maxKombo:r.maxKombo,
        precyzja:+r.precyzja.toFixed(1),trafione:r.trafione,nut:r.nut,trudnosc:r.trudnosc?r.trudnosc.ocena:null,
        procent:+r.procent.toFixed(1),gwiazdki:r.gwiazdki,falsze:r.falsze,premia:r.premia,premiaChoru:r.premiaChoru,
        wibrata:r.wibrata,gadanie:+r.gadanie.toFixed(2)})),rekord:S.wyniki.rekord,
      aplauz:{koniec:S.wyniki.aplauz.koniec,glos:+S.wyniki.aplauz.glos.toFixed(3),nagroda:S.wyniki.aplauz.nagroda,
        konfetti:S.wyniki.aplauz.konfetti.length,
        sumy:Object.fromEntries(Object.entries(S.wyniki.aplauz.sumy).map(([k,v])=>[k,Math.round(v)]))},
      osiagniecia:(S.wyniki.osiagniecia||[]).map(x=>({id:x.id,profil:x.profil,nowe:x.nowe.map(o=>o.id)}))}:null,
    dzwiek:{zadane:Object.assign({},Glos.licznik.zadane),zagrane:Object.assign({},Glos.licznik.zagrane),stan:Glos.stan(),
      kum:(Glos.ostatnieKum||[]).map(k=>Object.assign({},k))},
    zywe:Wejscie.stanZywych(),
    fps:+S.fps.wartosc.toFixed(1)};
}
// Przewija czas gry o `sek` sekund krokami po 1/60 s przy wyłączonym dźwięku. Każdy krok to ta sama
// funkcja, co na żywo (wejście, boty, punktacja), więc przewinięta piosenka liczy się tak samo.
function przewin(sek){
  const n=Math.max(1,Math.round((+sek||0)*60)),przesun=window.__zcPrzesunZegar;
  dokonczWczytywanieUtworu();   // przewijanie liczy grę od razu, więc układ i bitmapy muszą już być
  Glos.wycisz(true);
  try{
    for(let i=0;i<n;i++){
      if(przesun)przesun(1000/60);
      krok(1/60);   // zawsze wymuszony: zegar audio (Glos.czas) nie zna przewijania, a performance.now jest przesunięty
    }
  }finally{if(!S.pauza)Glos.wycisz(false);}
  rysuj();
  return stanGry();
}
// Partie z harnessu: "kolejno" = gracze po kolei na 0,1,2,…; tablica = partia dla gracza o tym numerze.
function przypiszPartie(spec){
  if(!spec||!S.gracze.length)return;
  const n=piosenka().partie.length;
  if(spec==="kolejno")S.gracze.forEach((g,i)=>{g.partia=i%n;});
  else if(Array.isArray(spec))S.gracze.forEach((g,i)=>{
    if(Number.isFinite(+spec[i]))g.partia=Math.max(0,Math.min(n-1,Math.trunc(+spec[i])));});
  rysujGraczy();
}
// Start bez lobby (harness, recenzent): opcje {piosenka, tempo, glos, latwy, partie:"kolejno"|[…]}.
function startZOpcjami(o){
  o=o||{};
  if(o.piosenka){const i=S.piosenki.findIndex(p=>p.id===o.piosenka);if(i>=0)wybierzPiosenke(i);}
  if(o.tempo)S.ust.tempo=Math.max(ZC_TEMPO.MIN,Math.min(ZC_TEMPO.MAKS,+o.tempo));
  if(o.glos&&Glos.jestInstrument(o.glos))S.ust.glos=o.glos;
  if(o.latwy!=null)S.ust.spiewaSama=!!o.latwy;
  if(!S.gracze.length)dolacz("mysz");
  przypiszPartie(o.partie);
  startGry(!o.zaslona);   // harness: od razu, bez zasłony wczytywania utworu (o.zaslona = z zasłoną, jak u gracza)
  return stanGry();
}
// Mierzy prawdziwe klatki requestAnimationFrame przez `sek` sekund oraz czas, jaki gra zajmuje
// w każdej z nich (krok + rysowanie), czyli zapas do budżetu 16,7 ms klatki przy 60 Hz.
function mierzFps(sek){
  return new Promise(ok=>{
    // klatki NARYSOWANE (pętla gry zapisuje ich czas w S.pomiarRys), nie wywołania rAF: przy limicie klatek monitor
    // 240 Hz woła rAF 240 razy, a gra rysuje 60
    const t0=performance.now(),koniec=t0+(+sek||5)*1000;
    S.pomiarJs=[];S.pomiarRys=[];const czasy=S.pomiarRys;
    const f=()=>{if(performance.now()<koniec)requestAnimationFrame(f);else{S.pomiarRys=null;
      const d=czasy.slice(1).map((t,i)=>t-czasy[i]).sort((a,b)=>a-b);
      const sr=d.reduce((s,x)=>s+x,0)/Math.max(1,d.length);
      const js=S.pomiarJs.sort((a,b)=>a-b);S.pomiarJs=null;
      ok({fps:+(1000/sr).toFixed(1),klatki:czasy.length,p95ms:+(d[Math.floor(d.length*.95)]||0).toFixed(1),
        maksMs:+(d[d.length-1]||0).toFixed(1),jsSrMs:+(js.reduce((s,x)=>s+x,0)/Math.max(1,js.length)).toFixed(2),
        jsP95Ms:+(js[Math.floor(js.length*.95)]||0).toFixed(2)});}};
    requestAnimationFrame(f);
  });
}
// Geometria sceny w tej klatce (smoke i recenzent liczą z niej zasłonięcia): żaby, kapsle, dymki, w px CSS.
function geometriaSceny(){
  if(!S.gra)return null;
  const teraz=performance.now();
  return {
    naklejkiOcen:(R.naklejkiOcen||[]).map(n=>({x:+n.x.toFixed(1),y:+n.y.toFixed(1),w:n.w,h:n.h,teraz:n.teraz})),
    tory:R.tory.map(L=>({x:L.x,y:L.y,w:L.w,h:L.h,zaba:+L.zaba.toFixed(1),krok:+L.krokX.toFixed(1),teraz:L.teraz,
      px:L.pxNaBeat,yNuty:m=>ySemi(L,m),   // samouczek (js/jak-grac.js): x nuty = teraz + (t - beat) * px, y z wysokości
      zaby:L.tor.gracze.map(g=>{const p=pozycjaZaby(L,g),k=L.tor.gracze.length>=3?prostokatKapsla(L,g):null;
        return {id:g.id,x:+p.x.toFixed(1),y:+p.y.toFixed(1),kapsel:k?{x:+k.x.toFixed(1),y:+k.y.toFixed(1),w:k.rozm,h:k.rozm}:null};})})),
    dymki:ukladDymkow(teraz).map(d=>({tekst:d.tekst,x:+d.x.toFixed(1),y:+d.y.toFixed(1),w:d.w,h:d.h,alfa:+d.alfa.toFixed(2),strefa:d.strefa}))};
}
// Dla automatu myszy w smoke: gdzie musi stać kursor, żeby gracz zaśpiewał nutę pod linią (albo następną).
function celMyszy(id){
  const g=S.gracze.find(x=>x.id===(id||"mysz"));if(!g||!g.tor||!S.gra)return null;
  const def=g.tor.def,b=S.gra.beat-(g.offMs/1000)/(60/S.gra.bpm);
  let i=indeksNutyPod(def.nuty,b);const pod=i>=0;
  if(!pod)i=indeksNastepnej(def.nuty,b);
  if(i<0)return {polton:null,spiewaj:false};
  const n=def.nuty[i],deg=poltonNaStopnie(n.m,S.ust.zakres,def.lo,def.hi)*(S.ust.odwroc?-1:1);
  return {polton:celNuty(n,b),spiewaj:pod&&(n.t+n.d-b)>.12,koniecZa:(n.t+n.d-b)*60/S.gra.bpm,
    y:(deg/(2*S.ust.zakres)+.5)*innerHeight};
}
function init(o){
  o=o||{};S.opcje=o;
  if(Number.isFinite(+o.ziarno)){let a=+o.ziarno+101;losujGre=()=>{a=(a*16807)%2147483647;return (a-1)/2147483646;};}
  const zapis=wczytajUstawienia();
  if(typeof Motywy!=="undefined"&&Motywy.ustawWersje)Motywy.ustawWersje(S.ust.stylGrafik);
  ustawGlosnoscGry();
  ustawDzwiekiUI();
  // Podgląd stopni sceny z adresu (dla oka, smoke i narzędzia zrzutów; nic nie zapisuje się trwale): ?widownia=
  // ?streak= ?tlo= ?klawisze= przyjmują id stopnia albo jego numer 1–20 w drabince toru i wymuszają go wszystkim;
  // ?stopien=N ustawia cztery tory naraz (tor podany osobno wygrywa); ?gl=0 = silnik efektów w trybie 2D; ?moc=0..1
  // nadpisuje moc stopni do prób; ?odblokuj=1 odblokowuje wszystko w tej sesji. Id stopnia widowni i streaka idzie
  // też do Postepy, żeby okno „Scena” pokazywało wymuszony styl jak dotąd.
  {const Q=new URLSearchParams(location.search);
    ustawDevSceny(Q);
    if(typeof Wczytywanie==="undefined"){startSilnikaWTle();przecwiczWTle();}   // bez ekranu wczytywania: dawna droga w tle
    // grafika motywu doszła w trakcie gry (normalnie wczytuje się w lobby): złóż tło od nowa
    if(typeof Motywy!=="undefined"&&Motywy.poWczytaniu)Motywy.poWczytaniu(()=>{if(S.gra&&R.tory&&R.ctBuf)rysujTlo();});
    const idDev=tor=>{const w=stopienDev(tor);return w?w.id:Q.get(tor);};
    Postepy.ustawDev({widownia:idDev("widownia"),streak:idDev("streak"),odblokuj:/^(1|true|tak)$/i.test(Q.get("odblokuj")||"")});}
  if(o.tempo)S.ust.tempo=Math.max(ZC_TEMPO.MIN,Math.min(ZC_TEMPO.MAKS,+o.tempo));
  if(o.glos&&Glos.jestInstrument(o.glos))S.ust.glos=o.glos;
  if(o.latwy!=null)S.ust.spiewaSama=!!o.latwy;
  R.tlo=el("tlo");R.scena=el("scena");R.ct=R.tlo.getContext("2d");R.cs=R.scena.getContext("2d");
  // 10-18 (Z-78): prawy przycisk nad sceną piosenki nie otwiera menu przeglądarki (i dalej nie śpiewa: DECYZJE)
  el("gra").addEventListener("contextmenu",e=>{if(S.ekran==="gra"||S.ekran==="odliczanie")e.preventDefault();});
  Wejscie.init({zakres:S.ust.zakres,ziarno:o.ziarno,
    nazwy:{mysz:T.graczMysz,ws:T.graczWS,strzalki:T.graczStrzalki,pad:T.graczPad,boty:T.boty}});
  Wejscie.ustawCelBotow(celBota);
  // 10-18: „Skok do nuty” to pomoc (S.ust.klawDoNuty); w trybie „donuty” Wejścia przytrzymanie jedzie jak „szybko”.
  // 10-18 wieczór: pomoc gracza tej klawiatury (Wejście podaje jej klucz „ws” / „strzalki” = id gracza)
  if(Wejscie.ustawSterowanieKlawiatury)Wejscie.ustawSterowanieKlawiatury({tryb:zrodlo=>klawDoNutyZrodla(zrodlo)?"donuty":S.ust.klawiatura==="plynnie"?"plynnie":"szybko",cel:celKlawiatury});
  // Kontekst audio powstaje w menu (otwarcie urządzenia dźwięku blokuje wątek na 0,1–0,25 s), a nie w klatce
  // startu piosenki (10-04: to była część zamrożenia po „Zagraj”). Bez gestu zostaje uśpiony; gest go budzi
  // (Glos.odblokuj w obsłudze wejścia), a Glos.czas() do tego czasu daje null, więc zegar gry idzie z performance.now.
  if(typeof Wczytywanie==="undefined")setTimeout(()=>{try{Glos.odblokuj();}catch(e){}},400);   // z ekranem wczytywania: krok „dźwięk”
  Biblioteka.przygotuj();   // wbudowane od razu; zapisane i te z folderu dojdą w tle
  const id=o.piosenka||zapis.piosenka||"oda",jest=S.piosenki.findIndex(p=>p.id===id);
  S.idx=Math.max(0,jest);
  S.czekaNaId=jest<0&&/^midi-/.test(id)?id:null;   // piosenka z biblioteki: wybierze się, gdy się wczyta
  zbudujLobby();podlaczZdarzenia();
  menuPelnyEkran();
  {const d=el("menuDiscord");if(d){d.href=ZC_DISCORD.serwer;d.title=T.discordDymek;d.disabled=true;}}   // menu: Discord z Tab i myszą; disabled (pole JS, nie atrybut) wyłącza go z nawigacji strzałkami i padem (fokusowalneLobby), bo z kanapy nikt nie otwiera przeglądarki
  S.fps.pokaz=!!o.fps;el("fps").hidden=!o.fps;
  if(o.zywe)Wejscie.wlaczZywe(o.zywe===true?"/stream":o.zywe);
  S.skladZAdresu=!!(o.auto||o.mysz||(+o.boty>0)||o.partie);
  if(o.mysz)dolacz("mysz");
  for(let i=0;i<Math.min(ZC_MAKS_GRACZY,+o.boty||0);i++)dolacz(Wejscie.dodajBota(o.luz!=null?o.luz:poziomBotaZUstawien()).id);
  przypiszPartie(o.partie);
  if(o.auto&&S.gracze.length)S.autoStart=Number.isFinite(+o.czekaj)?+o.czekaj:3;
  S.ostatnio=performance.now();
  pokazEkran("lobby");
  // gracze z adresu (harness: ?auto, ?boty, ?mysz, ?partie) = mecz ustawiony: od razu krok Rozgrywka, bez menu
  pokazLobby(o.auto||o.mysz||(+o.boty>0)||o.partie?"konfiguracja":"menu");
  const obrazki=wczytajObrazki().then(()=>{R.bufor.clear();R.odcisk=null;R.zawczasu=null;if(S.ekran==="lobby"&&S.gracze.length)rysujGraczy();});   // miniatury scen w kartach
  // JetBrains Mono (nazwy dźwięków na torach) nie ma już w lobby (numery taktów podglądu są krojem Nunito):
  // ładujemy go od razu, żeby tło torów nie narysowało się krojem zapasowym, i dopiero wtedy czyścimy bufor
  if(document.fonts&&document.fonts.load)document.fonts.load("500 11px 'JetBrains Mono'").catch(()=>{});
  if(document.fonts)document.fonts.ready.then(()=>{R.bufor.clear();R.wersja++;R.odcisk=null;R.zawczasu=null;});
  requestAnimationFrame(petla);
  // Ekran wczytywania (js/wczytywanie.js, 10-10): cała ciężka praca startu pod zasłoną, po kolei, zanim pokaże się
  // menu. Dotąd szła w chwilach bezczynności widocznego już menu i cięła jego animacje (pomiar: 86–515 ms naraz).
  const kroki=[
    ["dźwięk",()=>{try{Glos.odblokuj();}catch(e){}}],   // otwarcie urządzenia audio: 0,1–0,25 s
    ["fonty",()=>Promise.race([Promise.all(ZC_FONTY_STARTU.map(f=>document.fonts&&document.fonts.load?document.fonts.load(f,"AĄĘŁŃÓŚŹŻaąęłńóśźż0123+×★"):null))
      .then(()=>document.fonts&&document.fonts.ready),new Promise(r=>setTimeout(r,2500))])],
    ["obrazki",()=>Promise.race([obrazki,new Promise(r=>setTimeout(r,2500))])],
    ["pliki menu",()=>wczytajZasobyMenu(f=>{const i=kroki.findIndex(k=>k[0]==="pliki menu");Wczytywanie.postep((i+f)/kroki.length);})],   // grafiki menu, lobby i okien
    ["silnik efektów",()=>{if(grafikaPelna())startSilnika();}],   // kontekst WebGL2 i programy
    ["płótna",()=>{przecwiczPlotna();plotnaNaStart();}],          // programy GPU rysowania 2D (przecwiczEfekty) i płótna gry w rozmiarze okna
    ["nuty GPU",()=>{if(ZC_DEV.nutyGL&&typeof NutyGL!=="undefined")NutyGL.rozgrzej(R.scena);}],   // ?nutyGL=1: program i atlas nut
    ["ekrany lobby",()=>czekajNaRozgrzewkeLobby()],               // pierwszy raster ekranów lobby (lobby-scena.js)
    ["próba ekranów",()=>probaEkranow()],                         // pierwsze otwarcie ekranów lobby i okien pod zasłoną
    ["menu",async()=>{for(let i=0;i<3;i++)await Wczytywanie.klatka();}]];   // menu rysuje się pod zasłoną
  if(typeof Wczytywanie!=="undefined")Wczytywanie.uruchom(kroki);
}
// Pliki menu i podmenu pod ekranem wczytywania (11-18). Objaw: menu, lobby i okna doczytywały obrazki dopiero przy
// pierwszym wejściu (pomiar: kapsle, ikony instrumentów, głowy robo-żab, kursory; klatki 60–230 ms przy pierwszym
// otwarciu). Lista z js/zasoby-menu.js (generuje ją tools/ribbitbeat_zasoby_menu.py, bo przeglądarka nie wylistuje
// katalogu) wczytuje się i dekoduje pod zasłoną startu, a obrazki zostają w R.zasobyMenu, żeby przeglądarka trzymała
// je w pamięci. Grafik motywów tu nie ma: te ładuje lobby dla wybranej planszy. Brak pliku albo błąd niczego nie
// zatrzymuje, a całość ma limit czasu. ?pliki=0 wyłącza (porównanie).
const ZC_PLIKI_MENU_MAKS_MS=6000;
function wczytajZasobyMenu(postep){
  if(!ZC_DEV.pliki||typeof ZC_ZASOBY_MENU==="undefined"||!ZC_ZASOBY_MENU.length||typeof Image==="undefined")return null;
  const trzymane=R.zasobyMenu=[];let gotowe=0;
  const jeden=sciezka=>new Promise(r=>{
    const im=new Image(),koniec=()=>{gotowe++;if(postep)postep(gotowe/ZC_ZASOBY_MENU.length);r();};
    trzymane.push(im);im.decoding="async";im.src="../assets/"+sciezka;
    if(im.decode)im.decode().then(koniec,koniec);else{im.onload=koniec;im.onerror=koniec;}
  });
  return Promise.race([Promise.all(ZC_ZASOBY_MENU.map(jeden)),new Promise(r=>setTimeout(r,ZC_PLIKI_MENU_MAKS_MS))]);
}
// Próba ekranów pod zasłoną startu (11-18). Objaw: pierwsze otwarcie ekranu zacinało (pomiar: wybór piosenki 98 ms,
// Rozgrywka 91 ms, Nagrody 183 ms, Zgłoś błąd 57 ms), każde następne już nie (do 33 ms). Ślad przeglądarki: karta
// graficzna kompiluje programy przy pierwszym rysowaniu danego rodzaju rzeczy, a nowe rodzaje wnosi dopiero prawdziwe
// przejście ekranów i prawdziwe okno. Sama rozgrzewka ekranów (lobby-scena.js) tego nie łapie, pamięć programów
// w profilu przeglądarki też nie. Dlatego pod zasłoną gra naprawdę przechodzi menu → wybór → Rozgrywka → menu
// i otwiera na kilka klatek „Zgłoś błąd” oraz koło nagród (gdy czeka losowanie), po czym wszystko wraca do menu.
// W trakcie: klawiatura i mysz nie docierają do gry (wczytywanie.js blokuje je, dopóki stoi zasłona), dźwięki interfejsu i gry są wyciszone,
// zapisany skład się nie odtwarza (robi to dopiero prawdziwe wejście do Rozgrywki), pad nie kręci kołem.
// Start od razu w Rozgrywce (adres z harnessu) pomija próbę. ?probaEkranow=0 wyłącza (porównanie).
async function probaEkranow(){
  if(!ZC_DEV.probaEkranow||typeof Wczytywanie==="undefined"||typeof LobbyScena==="undefined"||!LobbyScena.przejscie)return;
  if(S.ekran!=="lobby"||S.lobbyEkran!=="menu"||S.gra||S.autoStart!=null||nakladkaLobby())return;
  const stop=()=>Wczytywanie.gotowe||S.ekran!=="lobby"||!!S.gra;   // bezpiecznik zasłony zdjął ją wcześniej albo coś ruszyło grę
  const klatki=async n=>{for(let i=0;i<n;i++){if(stop())throw new Error("przerwana");await Wczytywanie.klatka();}};
  const spokoj=async()=>{const t0=performance.now();await klatki(2);while(LobbyScena.przejscie().trwa&&performance.now()-t0<2500)await klatki(1);await klatki(2);};
  const fokus=document.activeElement,sklad=S.skladOdtworzony;
  S.probaEkranow=true;S.skladOdtworzony=true;
  try{Glos.wycisz(true);}catch(e){}
  try{if(LobbyScena.tempo)LobbyScena.tempo(.5);}catch(e){}   // przejścia w połowie czasu: liczy się, że każda warstwa raz się narysuje
  try{
    pokazLobby("wybor");await spokoj();
    pokazLobby("konfiguracja");await spokoj();
    pokazLobby("menu");await spokoj();
    if(typeof ZglosBlad!=="undefined"&&ZglosBlad.otworz&&!ZglosBlad.otwarte){ZglosBlad.otworz();try{await klatki(4);}finally{ZglosBlad.zamknij();}}
    if(typeof Nagrody!=="undefined"&&Nagrody.odbierz&&!Nagrody.otwarte&&Nagrody.odbierz(profilNagrod())){try{await klatki(6);}finally{Nagrody.zamknij();}}
    await klatki(2);
  }catch(e){if(!(e&&e.message==="przerwana"))console.warn("RibbitBeat: próba ekranów",e);}
  finally{
    try{if(typeof ZglosBlad!=="undefined"&&ZglosBlad.otwarte)ZglosBlad.zamknij();}catch(e){}
    try{if(typeof Nagrody!=="undefined"&&Nagrody.otwarte)Nagrody.zamknij();}catch(e){}
    S.skladOdtworzony=sklad;
    try{if(S.ekran==="lobby"&&!S.gra&&S.lobbyEkran!=="menu")pokazLobby("menu");}catch(e){}
    try{if(LobbyScena.tempo)LobbyScena.tempo(1);}catch(e){}
    try{Glos.wycisz(false);}catch(e){}
    S.probaEkranow=false;
    try{const cel=fokus&&fokus.isConnected&&fokus!==document.body&&!fokus.closest("[hidden]")?fokus:el("btnZagraj");if(cel&&S.lobbyEkran==="menu")cel.focus({preventScroll:true});}catch(e){}
  }
}
// Trzy płótna gry w rozmiarze okna już przy starcie aplikacji: pierwsza piosenka nie przydziela ich w lobby ani pod zasłoną.
function plotnaNaStart(){
  try{if(!R.tlo||!R.scena)return;wczytajJakoscAuto();rozmiarPlocien(innerWidth,innerHeight,dprGry(),true);}catch(e){}
}
// Pełny ekran w stopce menu: jak włączyć (F11) i jak w każdej chwili wyjść (znowu F11).
// Pełny ekran z F11 nie zgłasza fullscreenElement, więc stan to także tryb wyświetlania albo okno równe ekranowi.
// Klik w napis przełącza przez Fullscreen API (wyjście: F11 albo Esc), klawiatura i pad omijają go w nawigacji menu.
function menuPelnyEkran(){
  const p=el("menuEkran");if(!p)return;
  const pelny=()=>!!document.fullscreenElement||!!(window.matchMedia&&matchMedia("(display-mode: fullscreen)").matches)||
    (Math.abs(innerWidth-screen.width)<2&&Math.abs(innerHeight-screen.height)<2);
  const pokaz=()=>{
    const [a,b]=(pelny()?T.menuEkranWyjdz:T.menuEkranWlacz).split("{F11}"),k=h("kbd","menu-kbd","F11");
    p.replaceChildren(a||"",k,b||"");p.title=T.menuEkranTytul;p.classList.toggle("pelny",pelny());
  };
  p.onclick=()=>{try{if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen();}catch(e){}};
  addEventListener("resize",pokaz);document.addEventListener("fullscreenchange",pokaz);
  pokaz();
}
// Fonty, które gra rysuje na płótnie i w HUD (bez latin-ext dociągał się sam po 1,5 s i przerysowywał menu).
const ZC_FONTY_STARTU=["400 20px 'Titan One'","500 16px 'Baloo 2'","800 16px 'Baloo 2'","500 14px Nunito","700 14px Nunito","800 14px Nunito","500 11px 'JetBrains Mono'"];
function czekajNaRozgrzewkeLobby(){
  if(typeof LobbyScena==="undefined"||!LobbyScena.rozgrzewka)return null;
  return new Promise(r=>{const t0=performance.now();
    (function sprawdz(){const g=LobbyScena.rozgrzewka();if(g.zrobiona||performance.now()-t0>3000)r();else setTimeout(sprawdz,50);})();});
}
// Przełączniki do prób na żywo (ZC.dev, narzędzia testowe): do prób na żywo. Wymuszony motyw
// idzie przez ZC_DEV, czyli tę samą drogę co ?tlo= ?widownia= ?streak= ?klawisze=, więc nic nie trafia do zapisu
// profilu i znika po przeładowaniu. Przepięcie stylu w piosence: przypiszStyle + nowy układ (bufory, sprajty nut,
// hak „reset” stopni, złożenie tła) + rozgrzanie, jak w startGry, ale bez restartu piosenki.
function devApi(){
  const ids=()=>Object.fromEntries(ZC_TORY_SCENY.map(t=>{const w=stopienDev(t);return [t,w?w.id:null];}));
  function przepnij(){
    R.bufor.clear();R.wersja++;R.odcisk=null;R.zawczasu=null;
    R.straznik=null;   // przebudowa po zmianie motywu sama zatnie klatkę: strażnik zaczyna od nowa (z okresem ciszy)
    if(S.gra&&S.ekran!=="lobby"){
      przypiszStyle();
      if(R.ctBuf){ukladGry();rozgrzejGrafike();if(S.ekran==="wyniki")rysujScene(performance.now());}
    }else if(S.ekran==="lobby"){wczytajGrafikiMotywow();rysujGraczy();}
  }
  // Ogień jak w graKrok: tor = najwyższy ogień jego żab, gra = najwyższy tor (od razu, także w pauzie)
  function przeliczOgien(){
    const G=S.gra;if(!G)return;let o=0;
    for(const t of G.tory){t.ogien=0;for(const g of t.gracze)t.ogien=Math.max(t.ogien,g.ogien||0);o=Math.max(o,t.ogien);}
    G.ogien=o;el("gra").dataset.ogien=String(o);
  }
  return {
    get S(){return S;},get R(){return R;},
    motywy:()=>typeof Motywy!=="undefined"&&Motywy.lista?Motywy.lista().map(M=>({id:M.id,nazwa:M.nazwa,kolor:M.kolor||null})):[],
    drabinka:tor=>drabinka(tor).map(w=>({id:w.id,nazwa:w.nazwa||w.id,stopien:w.stopien})),
    wymuszone:ids,
    // tor: "wszystko" albo jeden z czterech; id null = Auto (jak w progresji). ?stopien= z adresu rozpisuje się
    // najpierw na pozostałe tory, żeby zmiana jednego toru nie ruszała reszty.
    wymus(tor,id){
      const lista=tor==="wszystko"?ZC_TORY_SCENY:ZC_TORY_SCENY.includes(tor)?[tor]:[];
      if(!lista.length)return ids();
      if(ZC_DEV.stopien!=null)for(const t of ZC_TORY_SCENY)if(ZC_DEV[t]==null)ZC_DEV[t]=ZC_DEV.stopien;
      ZC_DEV.stopien=null;
      for(const t of lista)ZC_DEV[t]=id||null;
      const w=ids();
      try{Postepy.ustawDev(Object.assign({},Postepy.dev,{widownia:w.widownia,streak:w.streak}));}catch(e){}
      przepnij();
      return w;
    },
    odblokuj(){Postepy.ustawDev(Object.assign({},Postepy.dev,{odblokuj:true}));if(S.ekran==="lobby")rysujGraczy();return true;},
    // Wybór instrumentu w DEV na testy: jeden instrument wszystkim graczom (także
    // botom i zablokowany), do przeładowania strony; null = jak w progresji. W piosence głosy zmieniają się od razu.
    instrument(id){
      if(id&&!Glos.jestInstrument(id))return false;
      ZC_DEV.instrument=id||null;
      if(S.gra){const sk=Glos.skala(S.gracze.length);let nr=0;
        for(const g of S.gracze){if(!g.glos)continue;nr++;g.glos.zniszcz();g.instrument=instrumentGracza(g);g.glos=Glos.glos(g.instrument,sk,nr,null,{przejscia:przejsciaGracza(g)});}}
      else if(S.ekran==="lobby")rysujGraczy();
      return true;
    },
    get instrumentDev(){return ZC_DEV.instrument;},
    instrumenty:()=>Glos.INSTRUMENTY_GRACZA.concat(typeof Studio!=="undefined"?Studio.lista():[]).map(i=>({id:i,nazwa:T.instrumentyGracza[i]||i})),   // + własne ze Studia
    kombo(n){
      n=Math.max(0,Math.trunc(+n||0));if(!S.gra)return false;
      for(const g of S.gracze){if(!g.tor)continue;g.kombo=n;g.maxKombo=Math.max(g.maxKombo||0,n);g.mnoznik=mnoznikKombo(n);g.ogien=poziomOgnia(n);}
      przeliczOgien();return true;
    },
    dodajBota(){
      if(S.ekran!=="lobby")return null;
      const b=Wejscie.dodajBota(poziomBotaZUstawien());return dolacz(b.id)?b.id:(Wejscie.usun(b.id),null);
    },
    usunBota(){
      if(S.ekran!=="lobby")return null;
      const g=S.gracze.slice().reverse().find(x=>x.zrodlo==="bot");if(!g)return null;
      Wejscie.usun(g.id);odlacz(g.id);return g.id;
    },
    piosenki:()=>S.piosenki.map(p=>({id:p.id,tytul:p.tytul||p.id})),
    // Autoplay (dowolny utwór z podmianą stylów teł i efektów): skład = sam bot
    // „mistrz”, który śpiewa piosenkę do końca, a motywy przełącza się w trakcie (wymus, F8/F9). Trwająca piosenka
    // kończy się bez zapisu (jak „Wyjdź”); ludzie wypadają ze składu tylko na czas pokazu (wejścia zostają, dołączą
    // znów jednym klawiszem). Boty nie zbierają sławy ani nie wchodzą na tablicę jako ludzie.
    autoplay(id,o){
      o=o||{};
      if(S.gra&&(S.ekran==="gra"||S.ekran==="odliczanie"||S.ekran==="wyniki"))przerwijGre();
      if(S.ekran!=="lobby")return null;
      for(const g of S.gracze.slice())if(g.zrodlo!=="bot"||o.botow)odlacz(g.id);
      const ile=Math.max(1,Math.min(8,(o.botow|0)||1));
      while(S.gracze.filter(g=>g.zrodlo==="bot").length<ile){
        const b=Wejscie.dodajBota(o.poziom||"mistrz");if(!dolacz(b.id)){Wejscie.usun(b.id);break;}
        const g=S.gracze.find(x=>x.id===b.id);if(g&&ZC_POZIOMY_BOTA.includes(o.poziom||"mistrz"))ustawPoziomBotaGracza(g,o.poziom||"mistrz");
      }
      if(!S.gracze.length)return null;
      return startZOpcjami({piosenka:id||(piosenka()||{}).id,tempo:o.tempo,zaslona:!!o.zaslona});   // zaslona: start jak u gracza (samouczek), bez niej od razu (testy)
    },
    // do ekranu wyników: przewinięcie (te same kroki co na żywo, bez dźwięku) do 2,2 ćwierćnuty za końcem
    koniec(){
      const G=S.gra;if(!G||(S.ekran!=="gra"&&S.ekran!=="odliczanie"))return false;
      ustawPauze(false);przewin(Math.max(0,G.piosenka.koniec+2.2-G.beat)*60/G.bpm+.1);return S.ekran;
    },
    diag(){
      const G=S.gra,fx=typeof FX!=="undefined"&&FX&&FX._diag?(()=>{try{return FX._diag();}catch(e){return null;}})():null;
      let iskryTorow=0;if(G)for(const t of G.tory)iskryTorow+=(t.iskry||[]).length;
      let ac=null;try{ac=Glos.kontekst();}catch(e){}
      const id=w=>w?w.id:null;
      return {ekran:S.ekran,lobbyEkran:S.lobbyEkran,pauza:!!S.pauza,grafika:S.ust.grafika,jakoscAuto:R.autoJakosc||0,jakoscCzeka:R.jakoscCzeka||0,autoJakosc:S.ust.autoJakosc!==false,stylGrafik:S.ust.stylGrafik,uklad:S.ust.uklad,tempo:S.ust.tempo,klatki:S.ust.klatki,limitAuto:R.limitAuto||0,
        plotno:R.scena?[R.scena.width,R.scena.height]:null,W:R.W,H:R.H,dpr:R.dpr,
        gl:fx?{dziala:!!fx.gl,tryb:fx.tryb,wlaczony:!!fx.wlaczony}:null,glZadany:ZC_DEV.gl,silnik:!!R.fxStart,
        iskry:(R.iskry||[]).length,dym:(R.dym||[]).length,iskryTorow,bufory:R.bufor.size,
        scena:S.scena?{tlo:id(S.scena.tlo),widownia:id(S.scena.widownia),streak:id(S.scena.streak),klawisze:id(S.scena.klawisze)}:null,
        gracze:S.gracze.map(g=>({id:g.id,nazwa:g.nazwa,bot:g.zrodlo==="bot",streak:id(g.stylStreak),klawisze:id(g.stylKlawiszy),kombo:g.kombo|0,ogien:g.ogien|0})),
        piosenka:G?G.piosenka.tytul||G.piosenka.id:null,beat:G?G.beat:null,koniec:G?G.piosenka.koniec:null,bpm:G?G.bpm:null,ogien:G?G.ogien||0:0,
        audio:ac?{stan:ac.state,base:ac.baseLatency,out:ac.outputLatency,rate:ac.sampleRate}:null};
    }
  };
}
window.ZC={init,stan:stanGry,ff:przewin,start:startZOpcjami,mierzFps,celMyszy,dev:devApi(),
  get biblioteka(){return Biblioteka;},get tablica(){return Tablica;},
  trudnosc:(i,id)=>{const p=id?S.piosenki.find(x=>x.id===id):piosenka();const tr=p&&trudnoscPartiiW(p,i||0);
    return tr&&{ocena:tr.ocena,poziom:tr.poziom,czynniki:tr.czynniki,glowne:tr.glowne,opis:opisTrudnosci(tr)};},
  poziomBota:(id,k)=>{const g=S.gracze.find(x=>x.id===id);if(!g||g.zrodlo!=="bot")return null;
    if(!ZC_POZIOMY_BOTA.includes(k))return null;ustawPoziomBotaGracza(g,k);return g.poziom;},
  wczytajMidi:(buf,nazwa)=>dodajPiosenkeMidi(buf,nazwa||"MIDI.mid"),
  dodajBota:luz=>{const b=Wejscie.dodajBota(luz);return dolacz(b.id)?b.id:null;},
  dolacz,ustaw:(k,v)=>{ustaw(k,v);odswiezUstawienia();},
  lobby:nazwa=>{if(nazwa!=null&&S.ekran==="lobby")pokazLobby(nazwa);return S.lobbyEkran;},
  wybierzGracza:(w,zamien)=>{const g=wybierzGracza(w,zamien);return g?g.id:null;},otworzWyborGracza,
  sklad:()=>zapiszSklad(S.gracze),
  get postepy(){return Postepy;},get efekty(){return Efekty;},
  nazwij:(id,n)=>{const g=S.gracze.find(x=>x.id===id);if(!g)return null;zmienNazwe(g,n);rysujGraczy();return g.nazwa;},
  // 10-18 wieczór: pomoce gracza (smoke, recenzent): pomoce(id) = {pomoce, wlasne, mn}; pomoce(id, null | {…}) ustawia
  pomoce:(id,p)=>{const g=S.gracze.find(x=>x.id===id);if(!g||g.zrodlo==="bot")return null;if(p!==undefined)ustawPomoceGracza(g,p);
    synchronizujPomoce(g);return {pomoce:pomoceGracza(g),wlasne:!!g.pomoce,mn:mnoznikPunktowGracza(g)};},
  otworzPomoce:id=>{const g=S.gracze.find(x=>x.id===(id||"mysz"));if(!g||g.zrodlo==="bot")return false;otworzPomoceGracza(g);return true;},
  otworzScene:(id,sekcja)=>{   // widownia i tło (scena wspólna, 10-05) otwierają okno wspólne, reszta okno gracza
    if(ZC_TORY_WSPOLNE.includes(sekcja)){otworzSceneWspolna(sekcja);return true;}
    const g=S.gracze.find(x=>x.id===(id||"mysz"));if(!g||g.zrodlo==="bot")return false;otworzScene(g,sekcja||"streak");return true;},
  otworzSceneWspolna:sekcja=>{otworzSceneWspolna(sekcja||"widownia");return true;},
  osiagnieciaProfilu:(nazwa,powrot)=>otworzOsiagnieciaProfilu(nazwa,powrot),
  scenaWspolna:()=>({widownia:wyborWspolny("widownia"),tlo:wyborWspolny("tlo"),klawisze:wyborWspolny("klawisze"),odb:{widownia:odblokowaneWspolne("widownia"),tlo:odblokowaneWspolne("tlo")}}),
  plansza:()=>Postepy.ekipa(),otworzPlansze:otworzSceneWspolna,pilot:()=>({pilot:S.pilot,piloty:Object.fromEntries(Object.entries(S.piloty).map(([k,v])=>[k,v.stan?{kier:v.stan.kier,wcisniety:v.stan.wcisniety}:null]))}),pauza:ustawPauze,geometria:geometriaSceny,T};
