"use strict";
// Builds the whole page layout: the three columns (navigation · content · capsules and live
// preview), the devices hub and the panels.
// Cards declared in the HTML are MOVED here (appendChild), never re-created — they keep their
// listeners, their already-built content (#axes, #stBytes…) and their ids, so trigger/macro/MIDI
// wiring done elsewhere stays valid. That also means every byId() lookup below must happen BEFORE
// the card holding the element is moved into a detached panel.
//
// UKŁAD TRZECH KOLUMN (2026-08-29). Do 2026-08-28 ten plik układał wszystko w pionowy stos:
// hub kapsli → podgląd na żywo → poziomy pasek zakładek (.tabbar) → panele. Pasek zakładek
// ZNIKNĄŁ — jego rolę przejęła pionowa nawigacja w lewej kolumnie, a kapsle i podgląd pojechały
// do prawej. Samą siatkę, zwijanie paneli i sekcję „Co wychodzi z tego kapsla" buduje
// rf-34b-cols.js (limit 800 linii na plik, .github/CONTRIBUTING.md); tutaj zostaje to,
// co było: zbieranie kart, panele, setTab, widoczność zakładek i kropki stanu.
function initTabs(){
  const wrap=document.querySelector(".wrap");
  if(!wrap||document.getElementById("rfApp"))return;
  const byId=id=>document.getElementById(id);
  // — fixed "live" bar: 3D puck + oscilloscopes (sensor lines) — always visible
  // UX 261120 L4a (piętra): kula stoi osobno na wierzchu Czujnika (piętro 1), a trzy wykresy jadą
  // do „Zaawansowanych” (piętro 3). Obie szyny mają klasę `live-rail`, więc rozmiary kafli z 05/08/20
  // działają w obu miejscach bez kopii reguł.
  const ballRail=document.createElement("div");ballRail.className="live-rail cz-ball";
  if(byId("pose3dCard"))ballRail.appendChild(byId("pose3dCard"));
  const rail=document.createElement("div");rail.className="live-rail";
  if(byId("accelCard"))rail.appendChild(byId("accelCard"));
  if(byId("gyroCard"))rail.appendChild(byId("gyroCard"));
  if(byId("filterCard"))rail.appendChild(byId("filterCard"));   // 3D filter axis oscilloscope next to channels 0-2/3-5
  // "live" GROUP — collapsible (3D orientation + channels 0-2/3-5 + 3D filter together), expanded by default
  // Wykresy z paskiem „Zakres czasu / Zeruj / Wyczyść”: blok w „Zaawansowanych” Czujnika (L4a).
  // Id `railFold` zostaje, choć to już nie zwijak: tyle nazw prowadzi do „podglądu na żywo”.
  const railFold=document.createElement("div");railFold.className="cz-charts";railFold.id="railFold";
  const railSum=document.createElement("h3");railSum.className="cz-charts-h";{const _tv=document.createElement("span");_tv.className="rfic hd-ic hd-ic-tv";_tv.setAttribute("aria-hidden","true");railSum.appendChild(_tv);railSum.appendChild(document.createTextNode("Wykresy kanałów i filtra 3D"));}
  railFold.appendChild(railSum);railFold.appendChild(rail);
  // — relocate app-bar bits: live controls (Okno/Pauza/Zeruj/Wyczyść) → over the „Podgląd na żywo"
  //   header (absolute, so control clicks never toggle the fold); language toggle → top-right corner.
  const _hdr=document.querySelector("header");
  const _ctrl=_hdr&&_hdr.querySelector(".ctrl");
  const _lang=byId("langToggle"), _spc=_hdr&&_hdr.querySelector(".spacer");
  const _mode=byId("modeToggle");
  if(_hdr&&_spc&&_mode)_hdr.insertBefore(_spc,_mode);      // spacer before the mode switch → the right-hand group packs right („Nakładka" is a tab like any other)
  // GŁÓWNY PRZEŁĄCZNIK WYJŚCIA (#armBtn). Serwer ma tę bramę od zawsze (`DeviceManager.master_armed`,
  // `POST /arm`), a `setArmed` w rf-12 zawsze umiał ją przestawić — ale przycisk zniknął z panelu
  // i nikt go nie odtworzył, więc rozbrojona aplikacja zostawała BEZ SPOSOBU na uzbrojenie jej
  // z powrotem inaczej niż restartem. Stop awaryjny (Alt+R+F albo „Zatrzymaj wszystko") tego
  // przycisku nie przestawia: wyłącza przełączniki modułów i tylko nimi włącza się wyjścia z powrotem.
  // Stoi TUTAJ, przed przełącznikiem LIVE/Symulacja: obok drugiego przełącznika, który dotyczy
  // całej aplikacji, a nie jednego kapsla, i w pasku widocznym z każdej zakładki. Napis i
  // podpowiedź pisze `setArmed` — także przy pierwszym zdarzeniu `master` ze strumienia.
  if(_hdr&&_mode&&!byId("armBtn")){
    const _arm=document.createElement("button");
    _arm.type="button";_arm.id="armBtn";_arm.className="btn";
    _arm.setAttribute("role","switch");_arm.setAttribute("aria-checked","true");
    _arm.textContent="⏻ Uzbrojone";
    _arm.onclick=()=>{if(typeof setArmed==="function")setArmed(!state.armed);};
    _hdr.appendChild(_arm);
  }
  if(_hdr&&_mode)_hdr.appendChild(_mode);   // real/simulator switch → top-right, next to the language toggle
  const _site=byId("siteLink"); if(_hdr&&_site)_hdr.appendChild(_site);   // project page → same right-hand group, before the language toggle
  // Community server → next to the project page link. The address is ASSIGNED here rather than
  // trusted from the markup: every community address in this app lives in rf-00-core, and a literal
  // left in the HTML is a second copy that wins by accident on the day somebody edits only one of
  // them. This is the „front door" invite (#start-tutaj) — its own use counter is what tells the
  // owner how many people arrived through the header button rather than through an exchange flow.
  const _dsc=byId("discordLink");
  if(_dsc)_dsc.href=RF_INVITE_HEADER;
  if(_hdr&&_dsc)_hdr.appendChild(_dsc);
  if(_hdr&&_lang){_lang.style.marginLeft="";_hdr.appendChild(_lang);}   // language toggle = rightmost corner
  if(_ctrl){   // move ONLY Zakres czasu/Pauza/Zeruj/Wyczyść here; rec/csv stay attached in the header so the
               // CSV-relocation below (getElementById) still finds them and moves them to Connection
    // UX 261120 B5b (P-G6-03): kontrolki stoją w drugim wierszu, w zwykłym przepływie pod tytułem.
    // Przyklejone absolutnie do prawego rogu nakładały się na tytuł przy 1280 px.
    const _rc=document.createElement("div");_rc.className="rail-ctrls";
    const _rng=byId("winRange");if(_rng)_rc.appendChild(_rng);                    // Zakres czasu (segment)
    for(const _id of ["tare","clear"]){const _e=byId(_id);if(_e)_rc.appendChild(_e);}
    railFold.insertBefore(_rc,rail);
    // Pauza zatrzymuje cały podgląd, także kulę, więc stoi przy kuli na wierzchu (L4a, piętro 1).
    const _pz=byId("pause"),_ph=ballRail.querySelector("#pose3dCard>.head");   // szyna jeszcze poza dokumentem
    if(_pz&&_ph){_pz.classList.add("sm","cz-pause");_ph.appendChild(_pz);}
  }
  // — tab panels
  const mk=id=>{const p=document.createElement("div");p.className="tab-panel";p.id="tab-"+id;p.setAttribute("role","tabpanel");return p;};
  const pCz=mk("czujnik"),pMap=mk("mapowanie"),pConn=mk("polaczenie");
  // Motion control is TWO tabs over one engine: the cursor half and the pad half. One capsule still
  // has one motion mode, so the two switches are mutually exclusive — see mFill/#mEnable/#kEnable.
  const pMysz=mk("mysz"),pKontroler=mk("kontroler");
  const pSkaner=mk("skaner");   // SKANER EKRANU — wybór jednym sygnałem, obok Myszy (patrz TABS)
  // KOŁO WYBORU — własna zakładka między Mapowaniem a Myszą. Stało kiedyś jako zwinięta sekcja
  // w Mapowaniu i to było zbyt ciasne miejsce: koło ma pięć trybów sterowania, drzewo wycinków
  // z podmenu, własny podgląd i własne okienko przy kursorze. To osobny moduł, tak jak Mysz czy
  // MIDI, i tak samo dostaje własny przełącznik, własną kropkę stanu i własną kolumnę w „Modułach".
  const pKolo=mk("kolo");
  // OSIE 3D NIE MAJĄ WŁASNEJ ZAKŁADKI. Przez jeden dzień (2026-08-29, etap 2 układu) miały — jako
  // moduł z listą presetów po lewej i ustawieniami po prawej. Wycofane, bo:
  // osie ustawia się PATRZĄC na odczyty, które ich dotyczą, więc rozdzielenie ich od czujnika
  // kazało skakać między dwoma ekranami przy jednej czynności. Wracają tam, gdzie stały: zwijaną
  // sekcją „Konfiguracja osi 3D" wewnątrz zakładki Czujnik, z własnym wierszem presetów w środku.
  const pMidi=mk("midi"),pKonfig=mk("konfiguracje"),pPad=mk("pad");   // focused tabs (split the old „Mapping" snake)
  // KONFIGURACJA APLIKACJI — wydzielona z „Zestawów" 2026-08-31 (zakładka REST rozbita na
  // zestawy i konfigurację). Jedna zakładka trzymała dwie rzeczy, które nie mają ze
  // sobą nic wspólnego poza tym, że obie są „poziomu aplikacji": ZESTAWY (paczka konfiguracji pod
  // jedną grę, wymiana z forum, biblioteka wszystkiego z dysku) i USTAWIENIA SAMEGO PROGRAMU
  // (stop awaryjny, serwer MCP, zgłoszenie problemu). Kto szukał skrótu awaryjnego, przewijał
  // najpierw całą bibliotekę zestawów.
  // `id` nowej zakładki to `ustawienia`, a NIE `konfiguracja`: `konfiguracje` (l. mn.) już istnieje
  // i jest w localStorage, w „Widoczności zakładek" i w rejestrze poradników — dwa idy różniące się
  // jedną literą to pomyłka czekająca na swoją kolej. Napis na przycisku mówi „Konfiguracja".
  const pUstaw=mk("ustawienia");
  const pOsc=mk("osc");        // OSC has its own tab and its own enable switch, independent of MIDI
  const pRest=mk("restapi");   // Uslugi sieciowe — panel filled in later by initRest
  // PRZEGLĄD — macierz „kapsle × moduły" (rf-45-devmods) dostała własny ekran w środkowej kolumnie.
  // Do 2026-08-28 wisiała jako stały, zwijany blok w hubie kapsli i zabierała miejsce nad KAŻDĄ
  // zakładką, choć to mapa do sprawdzenia od czasu do czasu, a nie rzecz używana przy każdej
  // zmianie. Panel jest zarejestrowany w TABS (żeby setTab go znał i żeby dostał zwykłe wejście
  // z rfStagger), ale NIE ma `grp`, więc nie pojawia się w nawigacji: wchodzi się tu przyciskiem
  // „Przegląd wszystkich kapsli" stojącym pod kapslami, bo to widok NA kapsle.
  const pPrzeglad=mk("przeglad");
  {
    const _pc=document.createElement("div");_pc.className="card";_pc.id="devModsHost";
    _pc.innerHTML=`<div class="head"><h2><span class="rfic hd-ic hd-ic-eye" aria-hidden="true"></span>Przegląd wszystkich kapsli</h2>
      <span class="hint">Co jest włączone na którym kapslu. Kliknij przełącznik, żeby zmienić.</span></div>`;
    pPrzeglad.appendChild(_pc);
  }
  // DEVICES — single hub above the live preview: list · switch active · mute · edit · add/pair.
  //  (Replaces the header pills + the per-tab „Kapsel" selectors — one place, not many.)
  const devPanel=document.createElement("div");devPanel.className="devices-panel";
  const _dh=document.createElement("div");_dh.className="devices-h";
  {const _ic=document.createElement("span");_ic.className="rfic hd-ic hd-ic-conn";_ic.setAttribute("aria-hidden","true");_dh.appendChild(_ic);
   const _b=document.createElement("b");_b.textContent="Kapsle Triki";_dh.appendChild(_b);
   // No "now editing" line HERE: the lit pill right below already answers it, and saying it twice in
   // one glance is noise. Od 2026-08-30 ta sama zasada zdjęła pasek „Aktualnie edytowany" z góry
   // zakładek: kapsle stoją w przyklejonej prawej kolumnie, więc świecąca pigułka jest na ekranie
   // ZAWSZE i powtarzanie jej słowami było tylko zabieraniem miejsca (patrz rf-11).
   // The last sentence is the answer to "which pill is the capsule in my hand?" — it belongs right
   // above the pills, because that is where the question comes up.
   // Zdanie o „sekcji Moduły" przestało być prawdziwe 2026-08-29: macierz nie jest już blokiem tuż
   // pod pigułkami, tylko własnym ekranem pod przyciskiem, który stoi linijkę niżej. Podpowiedź
   // mówiąca „w sekcji Moduły" wysyłałaby w miejsce, którego nie ma.
   // 2026-09-04: the paragraph that listed the five hover buttons and pointed at the button below
   // is gone — the buttons carry their own tooltips and the button carries its own label, so the
   // sentence repeated what the screen already says. Only the shake tip stays: nothing on screen
   // says it, and it is the one thing a person with two capsules cannot discover by looking.
   // W SYMULACJI TO ZDANIE JEST NIEPRAWDZIWE i rf-39f-simnotice.js (`_simCards`) podmienia je na
   // takie, które mówi, skąd bierze się ruch i czym go przejąć — nie ma czym potrząsnąć, gdy
   // kapsel udaje aplikacja. Klasa `.devices-hint` jest tam SELEKTOREM: zmiana nazwy klasy albo
   // treści bez zajrzenia tam zostawi w symulacji poradę „potrząśnij" przy braku sprzętu.
   const _hint=document.createElement("span");_hint.className="devices-hint";_hint.textContent="Nie wiesz, który kapsel to który? Potrząśnij nim, a jego pigułka zamiga.";_dh.appendChild(_hint);}
  devPanel.appendChild(_dh);
  if(byId("deviceSel"))devPanel.appendChild(byId("deviceSel"));   // relocate the device list out of the top bar
  // Sensor: TEXT readouts of 6 channels + status 0x21 + raw hex.
  // Axis mapping observed on the reference puck: CH0-2 = gyroscope, CH3-5 = accelerometer;
  // CH5 = cap axis, CH3 = front/back, CH4 = left/right. Unconfirmed for other units, hence
  // the user-configurable mapping in the 3D calibration panel.
  // PODGLĄD NA ŻYWO STOI W CZUJNIKU, na samej górze. Przez dwa dni (2026-08-28/29) cztery pełne
  // karty — orientacja 3D, kanały 0-2, kanały 3-5 i filtr — jechały w prawej kolumnie, wciśnięte
  // w 274 px, przez co panele były za małe i nieczytelne. Wykres, który ma
  // 274 px szerokości i 172 px wysokości razem z nagłówkiem, pokazuje kreskę, a nie przebieg.
  // Karty wracają więc tam, gdzie mają pełną szerokość i gdzie i tak stoi wszystko o czujniku,
  // a w prawej kolumnie zostaje ich MINIATURA (rfCols: puk 3D + dwa sparkline'y) — do zerknięcia
  // „czy w ogóle drga", nie do odczytania wartości.
  // UX 261120 L4a (spec „mniej naraz”, piętra): piętro 1 to kula (z Pauzą i „Steruj ręcznie”) i karta
  // „Kula kręci się odwrotnie?”; piętro 2 to zwinięty blok „Osie 3D” (rfTier, rf-33 `poseOsieTier`:
  // w nagłówku bieżące wartości i licznik zmian; w środku zwijaki dostrajania, mapy kanałów,
  // filtra i presetów); piętro 3 to jedno „Zaawansowane” na dole:
  // wykresy, sześć kanałów, status 0x21, surowy strumień i surowy `config:`.
  pCz.appendChild(ballRail);
  const flipHost=document.createElement("div");flipHost.className="cz-flip";flipHost.id="czFlipHost";
  pCz.appendChild(flipHost);
  const axesCard=byId("axesCard");
  // Blok „Osie 3D”: piętro 2, domyślnie zwinięty, w środku zwijaki dostrajania, mapy, filtra i presetów (L4a)
  const calFold=document.createElement("details");calFold.className="cardfold";calFold.id="poseCalFold";
  const calSum=document.createElement("summary");{const _ax=document.createElement("span");_ax.className="rfic hd-ic hd-ic-axes";_ax.setAttribute("aria-hidden","true");calSum.appendChild(_ax);calSum.appendChild(document.createTextNode("Osie 3D"));}
  const calBox=document.createElement("div");calBox.className="posecal";
  // renderPoseCal rysuje kartę „Kula kręci się odwrotnie?” do `_flipHost`, a „Kopiuj konfigurację”
  // z surowym `config:` do `_advHost` (rf-33). Bez nich rysuje wszystko w sobie, jak dawniej.
  calBox._flipHost=flipHost;
  const cfgHost=document.createElement("div");cfgHost.className="cz-cfg";calBox._advHost=cfgHost;
  calFold.appendChild(calSum);calFold.appendChild(calBox);
  // 3D axis configuration PRESETS row — sibling of calBox (survives renderPoseCal re-render), bound once in initPosePresets
  const posePresetRow=document.createElement("div");posePresetRow.className="pose-presets";
  posePresetRow.innerHTML=`<span class="pose-presets-lbl">🎨 Presety osi:</span>
    <select id="posePresetSelect"><option value="">— wybierz —</option></select>
    <button class="btn sm" id="posePresetLoad"><span class="bic bic-folder" aria-hidden="true"></span>Wczytaj</button>
    <input type="text" id="posePresetName" placeholder="nazwa presetu osi">
    <button class="btn sm primary" id="posePresetSave"><span class="bic bic-save" aria-hidden="true"></span>Zapisz</button>
    <button class="btn sm" id="posePresetDel" title="Usuń wybrany preset osi"><span class="bic bic-bin" aria-hidden="true"></span></button>
    <button class="btn sm" id="posePresetDiscord" aria-haspopup="dialog" aria-expanded="false"
            title="Podziel się na forum, zobacz cudze albo wczytaj od kogoś"><span class="bic bic-swap" aria-hidden="true"></span>Wymiana</button>`;
  // COPY 3D axes from another Triki device — sibling row, shown by refreshPoseCopyFrom() when ≥2 devices
  const poseCopyRow=document.createElement("div");poseCopyRow.className="pose-presets";poseCopyRow.id="poseCopyRow";poseCopyRow.style.display="none";
  poseCopyRow.innerHTML=`<span class="pose-presets-lbl">🧲 Kopiuj osie 3D z:</span>`+
    `<select id="poseCopyFrom"><option value="">— inny Triki —</option></select>`+
    `<span class="fxcap-prevwrap" id="poseCopyPrev" aria-hidden="true"></span>`+
    `<button class="btn sm" id="poseCopyBtn" title="Skopiuj konfigurację osi 3D z wybranego Triki do bieżącego">⤵ Wczytaj z Triki</button>`;
  // Presety osi to piętro 2: ustawiasz raz, więc zwinięte, z nazwą wybranego presetu w nagłówku.
  const presetFold=document.createElement("details");presetFold.className="cardfold inset pose-preset-fold";presetFold.id="posePresetFold";
  presetFold.innerHTML='<summary><span class="ra-ic" aria-hidden="true">🎨</span>Presety osi</summary>';
  const presetBody=document.createElement("div");presetBody.className="cardfold-body";
  presetBody.appendChild(posePresetRow);presetBody.appendChild(poseCopyRow);presetFold.appendChild(presetBody);
  calFold.appendChild(presetFold);
  pCz.appendChild(calFold);
  renderPoseCal(calBox);
  // Piętro 3: jedno „Zaawansowane” na dole ekranu (rfTier, rf-28d).
  const g2=document.createElement("div");g2.className="tabgrid";
  if(byId("statusCard"))g2.appendChild(byId("statusCard"));
  if(byId("feedCard"))g2.appendChild(byId("feedCard"));
  const czAdv=document.createElement("details");czAdv.className="cardfold adv";czAdv.id="czAdvFold";
  czAdv.innerHTML='<summary><span class="rfic hd-ic hd-ic-sinus" aria-hidden="true"></span>Zaawansowane</summary>';
  const czAdvBody=document.createElement("div");czAdvBody.className="cardfold-body";
  czAdvBody.appendChild(railFold);
  if(axesCard)czAdvBody.appendChild(axesCard);
  czAdvBody.appendChild(g2);czAdvBody.appendChild(cfgHost);
  czAdv.appendChild(czAdvBody);
  pCz.appendChild(czAdv);
  if(typeof rfTier==="function"){
    rfTier(czAdv,"czujnik.zaawansowane",{adv:true});
    rfTier(presetFold,"czujnik.presety",{sum:()=>{const s=byId("posePresetSelect"),o=s&&s.options[s.selectedIndex];
      return (o&&s.value)?o.textContent.trim():_gl("żaden nie jest wybrany","none selected");}});
  }else if(typeof rfFold==="function")rfFold(czAdv,"czujnik.zaawansowane");
  poseOsieTier(calFold);
  // Mapping: guide (wiki) + triggers + (collapsed) mouse mode
  const wiki=document.createElement("details");wiki.className="mapwiki";
  wiki.innerHTML=`<summary><span class="rfic guide-ic" aria-hidden="true"></span>Jak skonfigurować wyzwalacze?</summary>
    <div class="mapwiki-body">
      <h4>Co to jest wyzwalacz?</h4>
      Reguła „gdy coś zrobisz kapslem → wykonaj akcję” (np. <b>obróć kapsel → strzałka w prawo</b>). Klikasz <b>+ Nowy wyzwalacz</b> i ustawiasz 4 rzeczy poniżej.
      <!-- RYSUNEK DROGI OD RUCHU DO KLAWISZA (2026-09-20). Cztery pola wyzwalacza opisane są
           niżej po kolei, ale dopiero razem są DROGĄ: czujnik → próg → chwila → to, co idzie do
           Windows. Rysunek mówi to jednym spojrzeniem, a numery pod polami wracają w nagłówkach
           „1. Źródło", „2. Warunek"… ⚠️ Napisy mają data-i18n-en przy swoim <text>: jako klucze
           słownika („Ruch", „Próg") złapałyby pół panelu. Kolory przez klasy — var() nie działa
           w atrybutach prezentacji SVG. -->
      <figure class="g-fig">
        <svg viewBox="0 0 640 116" role="img" aria-label="Droga wyzwalacza: ruch kapsla, warunek z progiem, zachowanie, akcja wysłana do Windows">
          <rect class="g-box" x="6" y="26" width="134" height="52"/>
          <text class="g-txt" x="73" y="50" data-i18n-en="Capsule movement">Ruch kapsla</text>
          <text class="g-sub" x="73" y="68" data-i18n-en="tilt, turn, button">przechył, obrót, przycisk</text>
          <text class="g-sub" x="73" y="16" data-i18n-en="1. Source">1. Źródło</text>
          <rect class="g-box" x="174" y="26" width="134" height="52"/>
          <text class="g-txt" x="241" y="50" data-i18n-en="Condition">Warunek</text>
          <text class="g-sub" x="241" y="68" data-i18n-en="e.g. turn over 200°/s">np. obrót ponad 200°/s</text>
          <text class="g-sub" x="241" y="16" data-i18n-en="2. Threshold">2. Próg</text>
          <rect class="g-box" x="342" y="26" width="134" height="52"/>
          <text class="g-txt" x="409" y="50" data-i18n-en="Behaviour">Zachowanie</text>
          <text class="g-sub" x="409" y="68" data-i18n-en="press, hold, latch">naciśnij, trzymaj, przełącz</text>
          <text class="g-sub" x="409" y="16" data-i18n-en="3. The moment">3. Chwila</text>
          <rect class="g-box g-akcent" x="510" y="26" width="124" height="52"/>
          <text class="g-txt" x="572" y="50" data-i18n-en="Action">Akcja</text>
          <text class="g-sub" x="572" y="68" data-i18n-en="key, macro, scan:">klawisz, makro, scan:</text>
          <text class="g-sub" x="572" y="16" data-i18n-en="4. What is sent">4. Co wysyłamy</text>
          <path class="g-strzalka" d="M140 52 H174"/>
          <path class="g-strzalka" d="M308 52 H342"/>
          <path class="g-strzalka" d="M476 52 H510"/>
          <text class="g-sub" x="320" y="106" data-i18n-en="The capsule has to be armed — a paused capsule sends nothing.">Kapsel musi być uzbrojony — wstrzymany nie wysyła nic.</text>
        </svg>
      </figure>
      <h4>Gotowe gesty</h4>
      Nad polem „Nazwa” stoi lista <b>Gotowy gest</b>. Wybierasz z niej gest, a warunek, próg i zachowanie wypełniają się same, gotowe do poprawek. Zostaje Ci dopisać akcję, bo tego żaden szablon za Ciebie nie wie.
      <br>Do wyboru: potrząśnięcie, odwrócenie kapsla dnem do góry, szybki obrót w prawo i w lewo, podwójne kliknięcie przycisku i długie przytrzymanie przycisku.
      <br>Potrząśnięcie korzysta z metryki <b>Wirowanie (|żyro|)</b>, czyli energii ruchu. To nie jest kąt: liczy się w surowych LSB (131 LSB to 1°/s) i nie zmienia się razem z czułością osi, więc potrząśnięcie znaczy to samo na każdym ustawieniu.
      <h4>Nagrany gest — dwa tryby edytora</h4>
      Obok „Nowy wyzwalacz” stoi przycisk „Nagraj gest”, a u góry edytora przełącznik „Tryb edycji”: „Prosty — nagraj gest” albo „Zaawansowany”. W trybie prostym naciskasz „Nagraj”, wykonujesz gest dwa–trzy razy, jednym suwakiem mówisz, jak dokładnie trzeba go powtórzyć, opisujesz, jak wygląda, i wskazujesz akcję; linia przy „Zapisz” mówi, czego jeszcze brakuje. Nad nagraniami stoi wykres „Ruch kapsla na żywo”: energia ruchu z ostatnich ośmiu sekund, próg „start”, który trzeba przekroczyć, poziom „koniec”, pod który trzeba zejść, i pasek u góry mówiący, kiedy kapsel jest w środku gestu. Gest, który ma w środku zatrzymanie, nagraj ręcznie jednym przyciskiem „Start / Stop” albo wydłuż „Przerwę kończącą gest” — nagrywarka sama podpowie, o ile.
      <br>Tryb zaawansowany to pełna kontrola nad wyzwoleniami: wszystkie źródła, łączenie warunków, zachowania i czasy. Nagrany gest jest w nim piątym rodzajem warunku („Gest”), więc można go łączyć z przyciskiem, liczyć („X razy w czasie”) albo zrobić z niego przełącznik. Reguły proste i zaawansowane leżą na jednej liście, a reguła otwiera się w tym trybie, który pokaże ją w całości.
      <h4>1. Źródło — skąd brać sygnał</h4>
      <ul>
        <li><b>Filtr 3D</b> — gotowe wielkości: <b>Pochylenie</b>, <b>Obrót</b>, Pitch, Roll, Wirowanie. Najłatwiejsze („przechyl” / „obróć”). Zalecane na start — i właśnie od niego otwiera się nowy wyzwalacz.<br>
          <small style="color:var(--dim)">💡 <b>Czułość i kierunek (znak) osi</b> dostosujesz w zakładce <b>📡 Czujnik → 🧭 Osie 3D</b> (mapowanie kanałów, „odwróć” oraz „Przyspieszenie wychylenia”).</small></li>
        <li><b>Przycisk</b> — fizyczny przycisk na kapslu. Działa <b>od razu</b> (tryb „Auto”) — nie trzeba uczyć. Ustaw <b>Trzymaj (ms)</b> = minimum, jak długo po naciśnięciu uznawać przycisk za wciśnięty. Przytrzymany przycisk trzyma tyle, ile go trzymasz, więc dla akcji typu „hamuj, dopóki trzymam” nic tu nie musisz zmieniać. „Konkretny bit” tylko dla zaawansowanych.</li>
        <li><b>Oś (CH)</b> — surowy kanał czujnika (dla zaawansowanych).</li>
        <li><b>Inna reguła</b>: warunkiem jest reguła z tej listy, spełniony wtedy, gdy tamta jest aktywna. Tak buduje się tryby: reguła z zachowaniem <b>Przełącznik</b> trzyma stan „włączony / wyłączony”, a pozostałe pytają ją o niego zamiast powtarzać jej warunek.</li>
      </ul>
      <h4>2. Warunek i próg — kiedy ma zadziałać</h4>
      Ustaw <b>kiedy</b> sygnał uruchamia akcję, np. <code>pochylenie &gt; 30</code>. <b>Podgląd na żywo</b> pokazuje wartość i poziomą <b>linię progu</b> — ruszaj kapslem i ustaw próg tak, żeby linia była przekraczana wtedy, kiedy akcja ma się odpalić.
      <h4>Warunki — jak działają (ważne)</h4>
      Wyzwalacz może mieć <b>kilka warunków</b>, każdy w osobnej karcie (<b>Warunek 1</b> = główny, kolejne dodajesz „+ Dodaj warunek”). Każdy warunek to: <b>źródło + porównanie + próg</b> (np. <code>pochylenie &gt; 30</code>, <code>obrót &lt; -50</code>, albo przycisk wciśnięty). Karta świeci na pomarańczowo, gdy <b>jej</b> warunek jest właśnie spełniony.
      <ul>
        <li><b>Warunek spełniony</b> = wartość przekracza próg zgodnie z porównaniem (<code>&gt;</code>, <code>&lt;</code>, <code>≥</code>, <code>≤</code>); dla przycisku = wciśnięty.</li>
        <li><b>Łączenie</b> (gdy &gt;1 warunek): <b>ORAZ</b> = wszystkie muszą być spełnione naraz; <b>LUB</b> = wystarczy dowolny. Wybierasz to listą obok „+ Dodaj warunek”.</li>
        <li><b>NIE</b> — pole obok przełącznika źródła w karcie warunku ODWRACA go: warunek liczy się jako spełniony wtedy, kiedy nie jest spełniony (np. „przycisk NIE wciśnięty”, „pochylenie NIE większe niż 30”). Karta z zaznaczonym NIE ma inną ramkę, żeby dało się to zobaczyć bez czytania.</li>
        <li>Akcja odpala dopiero, gdy <b>cały</b> wyzwalacz jest spełniony (wg ORAZ/LUB). Licznik przy nagłówku sekcji „Warunki — kiedy ma zadziałać” pokazuje <b>ile warunków jest teraz spełnionych</b> (szary — 0, pomarańczowy — część, zielony — wszystkie).</li>
      </ul>
      Główny warunek stoi w zwijaku „Warunek i zachowanie”, a kolejne warunki i przycisk „Dodaj warunek” w „Zaawansowane” › „Więcej warunków” na dole edytora.
      <br>Przykład ORAZ: „pochylenie &gt; 30 <b>ORAZ</b> przycisk wciśnięty → skok” (skok tylko gdy pochylasz i trzymasz przycisk).
      <h4>3. Akcja — co ma się stać</h4>
      <ul>
        <li><b>Klawisz</b> — spacja, strzałki, <code>ctrl+c</code>… Kliknij „Naciśnij klawisz…” by przechwycić dowolny.</li>
        <li><b>Mysz</b> — klik / scroll / ruch (<code>mouse:left</code>, <code>mouse:scrollup</code>).</li>
        <li><b>Punkt na ekranie</b>: klik w konkretnym miejscu, a nie tam, gdzie akurat stoi kursor. Przycisk „Punkt na ekranie…” otwiera panel: X i Y (albo „Wskaż kursorem” z odliczaniem), przycisk lewy/prawy/środkowy, a niżej jeden klik, dwuklik, przytrzymanie przez zadany czas albo trzymanie tak długo, jak trwa warunek. Procenty przeżyją wysłanie zestawu komuś o innym ekranie, piksele nie. Zapis: <code>mouse:left@960,540 · mouse:right@50%,50% · mouse:left@960,540:800 · mouse:move@0,0</code></li>
        <li><b>Kontroler</b> — przycisk wirtualnego pada Xbox (<code>pad:a</code>, <code>pad:rt</code>, <code>pad:up</code>): A/B/X/Y, LB/RB, spusty LT/RT, krzyżak, Start, Back, klik drążkiem. Takie mapowania ustawiasz w zakładce „Kontroler”: klikasz przycisk na rysunku pada, a pod spodem otwiera się jego panel. Wszystkie razem stoją w spisie „Mapowania pada”, który karta pokazuje, gdy żadna część nie jest wybrana. To pad tego kapsla, ten sam, którym steruje ruch. Domyślnie dwa kapsle to dwa kontrolery, czyli dwaj gracze; jeden gracz obiema rękami ustawia w sekcji „Kontrolery” wspólny kontroler, a jego numer widać wtedy na rysunku pada w miejscu logo. Wymaga sterownika ViGEmBus — bez niego reguła nie wysyła nic i mówi o tym wprost, bo przycisk pada nie ma czym się zastąpić.</li>
        <li><b>Makro</b> — kilka klawiszy po kolei z odstępami (<code>a; wait 100; b</code>).</li>
      </ul>
      <h4>4. Zachowanie — jak ma reagować</h4>
      Trzy podstawowe zachowania stoją w zwijaku „Warunek i zachowanie”. Rzadsze, czyli X razy w czasie, Dokładnie N puknięć, Po odczekaniu i Przełącznik, są w „Zaawansowane” › „Więcej zachowań”.
      <ul>
        <li><b>Jednorazowo</b> — raz na każde przekroczenie.</li>
        <li><b>Ciągłe</b> — powtarza co X ms, dopóki warunek spełniony.</li>
        <li><b>Przytrzymaj</b> — trzyma klawisz, dopóki warunek spełniony (ruch w grach).</li>
        <li><b>X razy w czasie</b> — N przekroczeń progu/zakresu (lub kliknięć) w zadanym czasie, np. <b>3× w 2 s</b>.</li>
        <li><b>Po odczekaniu</b> — aktywuje po X ms <b>nieprzerwanego</b> spełnienia warunku (np. „w zakresie przez 1 s”).</li>
        <li><b>Przełącznik</b> — zatrzask: każde spełnienie warunku przerzuca regułę z „wyłączonej” na „włączoną” i z powrotem, a stan zostaje do następnego razu. Sam nic nie wysyła w kółko, tylko trzyma tryb, który inne reguły czytają warunkiem <b>Inna reguła</b> (np. „bieg włączony” na podwójne kliknięcie przycisku).</li>
      </ul>
      <h4>5. Warstwy — kilka kompletów wyzwalaczy na jednym kapslu</h4>
      Jeden kapsel może mieć do <b>czterech warstw</b>: inne wyzwalacze w grze, inne przy filmie. Każda reguła ma pole <b>Warstwa</b> w sekcji „Zachowanie”.
      <ul>
        <li><b>Zawsze</b> (domyślnie) — reguła działa w każdej warstwie. Tak ma każda reguła napisana, zanim warstwy powstały, więc dotychczasowe zestawy zachowują się bez zmian.</li>
        <li><b>Warstwa 1–4</b> — reguła nasłuchuje tylko wtedy, gdy ta warstwa jest aktywna. W pozostałych śpi dokładnie tak, jak wyłączona: puszcza trzymany klawisz i zeruje liczniki, więc przełączenie warstwy nigdy nie zostawi wciśniętego klawisza w grze. Na liście widać ją wtedy przygaszoną, z plakietką <b>W2</b>.</li>
      </ul>
      Warstwę przełączasz na dwa sposoby: paskiem <b>„Warstwa: 1 2 3 4”</b> nad listą (pojawia się, gdy któraś reguła używa warstw) albo <b>samym kapslem</b> — regułą z akcją <code>layer:2</code> (przełącz na stałe), <code>layer:next</code> (następna warstwa, w której coś jest) lub <code>layer:hold:2</code> z zachowaniem <b>Przytrzymaj</b> (warstwa 2, póki trzymasz — jak Shift). Akcje warstwy nie wychodzą do systemu: nie naciskają żadnego klawisza i działają nawet przy wyłączonej grupie „Mapowanie”, żeby z warstwy zawsze dało się wrócić.
      <h4>6. Uruchomienie i bezpieczeństwo</h4>
      Klawisze idą do Windows <b>tylko gdy grupa „Mapowanie” jest włączona</b> (przycisk „▶ Włącz” w nagłówku sekcji). Przycisk <b>⌨</b> (Testuj) wysyła do <b>aktywnego okna</b> — przy teście przełącz się na okno docelowe (gra/notatnik). <b>Presety wyzwalaczy</b> zapisują całe zestawy reguł (np. osobne na każdą grę).
      <h4>7. 🔔 Powiadomienie systemowe Windows</h4>
      Wybrana reguła może się odzywać dymkiem Windows z ikony w zasobniku — widać go nawet wtedy, gdy panel jest schowany za grą, a działa też przy panelu zamkniętym.
      <ul>
        <li><b>Włączasz:</b> w edytorze reguły, w „Zaawansowane” › „Sygnały”, zaznaczasz „wysyłaj powiadomienie”, a pod spodem wybierasz, kiedy ma przyjść: „przy zadziałaniu” (jeden dymek na każde) albo „gdy staje się aktywny (i gdy przestaje)” (dymek na początku i na końcu epizodu).</li>
        <li><b>Dźwięk:</b> pole „bez dźwięku” jest zaznaczone domyślnie — reguła potrafi zadziałać kilkadziesiąt razy w sesji, a dzwonek za każdym razem szybko męczy.</li>
        <li><b>Treść:</b> w polu pod spodem wpisujesz własne zdanie (np. „Skacz!”). Puste = nazwa reguły i klawisz.</li>
        <li><b>Wygląd:</b> dymek ma trzy linie — „RibbitFlip” z żabką, pod spodem „Mapowanie — nazwa reguły”, a najniżej Twój opis albo to, co się właśnie stało.</li>
        <li><b>Limity:</b> nie częściej niż raz na 3 s dla jednej reguły; zdławione zadziałania dolicza licznik „(x7)”. Start z flagą --no-tray odbiera ikonę w zasobniku, więc dymka nie będzie — aplikacja powie to od razu przy włączaniu opcji.</li>
      </ul>
      <h4>8. Koło wyboru</h4>
      Kapsel ma jeden przycisk, a akcji zwykle potrzeba więcej — od tego jest <b>koło wyboru</b>: przytrzymujesz przycisk, pochylasz kapsel w stronę wycinka i puszczasz. Ma własny ekran w nawigacji, a wszystko o nim stoi w jego zakładce <b>Informacje</b>.
      <h4>Konfiguracja i Biblioteka — kiedy trzeba kliknąć „Zapisz zmiany”</h4>
      Pod-zakładka <b>Konfiguracja</b> to ustawienia tego kapsla: co tu zmienisz, działa od razu i zapisuje się na kapslu, bez żadnego przycisku. Pod-zakładka <b>Biblioteka</b> to nazwane konfiguracje odłożone na później — i te zmieniają się dopiero wtedy, gdy klikniesz „Zapisz zmiany”. Właśnie dlatego przy nazwie zapala się bursztynowa kropka: na kapslu wszystko już działa, w bibliotece jeszcze nie.
      <h4>Od czego zacząć?</h4>
      Źródło <b>Filtr 3D → Pochylenie</b>, próg ~30, akcja = strzałka, zachowanie = <b>Przytrzymaj</b>. Przechyl kapsel — postać idzie.
    </div>`;
  // — distribute into FOCUSED tabs (no more one long scroll). Each card's own .head is its section
  //   header (title + group-enable toggle), so no extra fold wrapper is needed → always expanded.
  pMap.appendChild(wiki);                                       // Mapowanie = guide (collapsible) …
  // KOŁO WYBORU — własna zakładka, rozłożona karta, dokładnie jak Mysz czy MIDI. Budowana z JS
  // (rf-46b), bo lista szybkiego wyboru akcji powstaje z QUICKKEYS, a wycinki dopisuje się w
  // trakcie. Karta zajmuje całą zakładkę, więc nie ma już powodu, żeby cokolwiek tu zwijać.
  if(typeof wheelCardHtml==="function"){
    const _whHost=document.createElement("div");
    _whHost.innerHTML=wheelCardHtml();
    if(_whHost.firstElementChild)pKolo.appendChild(_whHost.firstElementChild);
  }
  if(byId("trigCard"))pMap.appendChild(byId("trigCard"));       //            … + triggers (expanded)
  if(byId("mouseCard"))pMysz.appendChild(byId("mouseCard"));         // Mysz — the cursor half
  // SKANER EKRANU — karta budowana z JS, jak koło: jej prawa kolumna powstaje z OPISU pól
  // (rf-50b), a nie z markupu, więc nie ma czego trzymać w HTML-u.
  if(typeof scanCardHtml==="function"){
    const _skHost=document.createElement("div");
    _skHost.innerHTML=scanCardHtml();
    if(_skHost.firstElementChild)pSkaner.appendChild(_skHost.firstElementChild);
  }
  if(byId("padCard"))pKontroler.appendChild(byId("padCard"));        // Kontroler — hub + stick/d-pad + pad-button rules
  if(byId("padSec"))pPad.appendChild(byId("padSec"));           // Pad XY → own tab — move OUT of the MIDI card FIRST,
                                                               //   while both are still document-attached (getElementById)
  // OSC card is built HERE because initTabs runs before initMidi in the bootstrap.
  // The "OSC output" group must be lifted out of #midiCard BEFORE the MIDI card is moved into
  // pMidi: once moved, the card hangs off a detached panel and getElementById returns null
  // (same trap as #padSec above).
  {
    const oscCard=document.createElement("div");oscCard.className="card";oscCard.id="oscCard";
    oscCard.innerHTML=`<div class="head"><h2><span class="rfic hd-ic hd-ic-osc" aria-hidden="true"></span>Kontroler OSC</h2>
        <div class="rf-toggle" id="oscEnable" role="switch" aria-checked="false" tabindex="0" title="Włącz albo wyłącz moduł OSC. Działa niezależnie od MIDI."><span class="rf-tg-lbl off">Wył.</span><span class="rf-tg-knob"></span><span class="rf-tg-lbl on">Wł.</span></div></div>
      <div class="mi-grouphint">Gdy włączone, ruch kapsla wysyła komunikaty OSC po UDP do TouchOSC, Resolume, TouchDesigner, VRChat czy ESP32. Bez sterowników: wystarczy host i port.</div>
      <div class="midibar">
        <button class="btn rf-cta" id="oscAdd"><span class="bic bic-plus" aria-hidden="true"></span>Nowe mapowanie OSC</button>
        <span class="hint">źródło (oś / pochylenie) → adres OSC; pasek = wartość na żywo</span>
        <!-- Własny węzeł statusu — miFlash pisze do tego, który stoi na AKTYWNEJ zakładce. Jeden
             wspólny #miMsg w karcie MIDI znaczył, że potwierdzenia zapisu mapowań OSC nikt nie widział. -->
        <span class="midimsg" id="oscMsg" role="status" aria-live="polite"></span>
      </div>
      <div id="oscList" class="midilist"></div>
      <!-- PIĘTRO 2 (UX 261120 L4c): cel domyślny i odbiorniki ustawia się raz; w nagłówku adres. -->
      <details class="cardfold inset mi-fold" id="oscOutFold"><summary>Cel domyślny i odbiorniki</summary>
        <div class="cardfold-body"><div class="midi-target" id="oscTarget"></div></div></details>`;
    // PIĘTRO 3: jedno „Zaawansowane” na dole ekranu OSC: poradnik i dziennik wysyłek (rf-16b → #oscLogCard).
    const oscAdv=document.createElement("details");oscAdv.className="cardfold adv";oscAdv.id="oscAdv";
    oscAdv.innerHTML=`<summary>Zaawansowane</summary><div class="cardfold-body">
      <details class="setup-details" id="oscSetup">
        <summary><span class="rfic info-ic" aria-hidden="true"></span>Jak działa OSC w RibbitFlipie: profile, zachowania, parkowanie <span class="setup-badge">przeczytaj</span></summary>
        <div class="setup-body">
          <h4>Co leci po kablu</h4>
          <p>OSC to zwykłe UDP. W jednym pakiecie jedzie adres, tag typu argumentu i wartość, i tyle. Nic nie instalujesz: wystarczy host i port programu, który nasłuchuje, oraz prefiks adresu (wszystkie trzy pola są w bloku „Cel domyślny i odbiorniki” pod listą mapowań).</p>
          <h4>Odbiorniki OSC — kilka maszyn naraz</h4>
          <p>Pola w bloku „Cel domyślny i odbiorniki” opisują cel domyślny: adres, pod który mówi każde mapowanie, któremu nie wskazano nic innego. Jeżeli jeden zestaw steruje kilkoma maszynami, na przykład lampą na ESP32 i tabletem z TouchOSC albo dwoma sterownikami w różnych rogach warsztatu, dodaj je jako odbiorniki OSC na liście pod tymi polami. Każdy ma własną nazwę, host i port, a w edytorze mapowania pole „Odbiornik” mówi, do którego z nich to mapowanie leci. Nazwa pojawia się potem w wierszu mapowania i w dzienniku wysyłek, bo przy kilku odbiornikach sam adres przestaje cokolwiek identyfikować: „/fader1” na lampie i „/fader1” na tablecie to dwie różne rzeczy.</p>
          <p>Cel domyślny stoi w tej liście jako pierwszy wiersz i nie da się go usunąć — dzięki temu usunięcie dowolnego odbiornika zawsze ma dokąd przenieść mapowania. Zanim odbiornik zniknie, dostaje jeszcze wartości parkowania tych mapowań, które do niego mówiły, więc nie zostaje z zapaloną lampą ani wykręconym serwem. Zestaw zapisany jako preset niesie wybór odbiornika razem z mapowaniem; wczytany na komputerze, który takiego odbiornika nie ma, zagra na cel domyślny, zamiast milczeć.</p>
          <h4>Profil odbiornika — czym jest, a czym nie jest</h4>
          <p>Samo OSC nie zna pojęcia „PWM”, „serwo” ani „DAC”. Na drucie są tylko trzy typy: liczba całkowita, zmiennoprzecinkowa i wartość logiczna. Profil jest więc NAZWĄ dla pary (typ argumentu, zakres), jakiej oczekuje Twój odbiornik — wygodą, żebyś nie musiał pamiętać, że „serwo” to liczba całkowita przycięta do 0–180. Co zrobi z tą liczbą, nadal decyduje program albo szkic po drugiej stronie.</p>
          <ul>
            <li><b>Analog 0–1</b> — liczba zmiennoprzecinkowa 0..1, konwencja programów AV: TouchOSC, Resolume, TouchDesigner, VRChat.</li>
            <li><b>Cyfrowy ON/OFF</b> — wartość logiczna: na drucie jedzie sam tag prawda/fałsz, bez ciała wiadomości.</li>
            <li><b>PWM 0–100%</b> — liczba całkowita 0..100, wypełnienie w procentach.</li>
            <li><b>Serwo 0–180°, 0–270°, 0–360°</b> — liczba całkowita, kąt w stopniach. Wybierz ten, który odpowiada Twojemu serwu. Uwaga: „serwo 360” bywa dwuznaczne — profil opisuje serwo POZYCYJNE o zakresie 360°, a nie serwo ciągłego obrotu, w którym liczba oznacza prędkość i kierunek, a nie kąt. Do takiego użyj profilu PWM albo szerokości impulsu i pamiętaj, że wartość środkowa oznacza postój.</li>
            <li><b>Serwo — szerokość impulsu 1000–2000 µs</b> — drugi powszechny dialekt serw: zamiast kąta wysyłasz długość impulsu sterującego, zwykle 1000 µs dla jednej skrajności, 1500 µs dla środka i 2000 µs dla drugiej.</li>
            <li><b>Analog 10-bit 0–1023</b> — liczba całkowita, gdy odbiornik liczy w skali dziesięciobitowej.</li>
            <li><b>DAC 8-bit / 12-bit</b> — 0..255 albo 0..4095. Rozdzielone celowo: ESP32 ma przetwornik ośmiobitowy, a Due czy MCP4725 dwunastobitowy, więc jeden wspólny preset musiałby okłamać jednego z nich.</li>
            <li><b>Własny</b> — typ i zakres ustawiasz ręcznie. Tak działały wszystkie mapowania, zanim profile powstały, i tak nadal działają Twoje stare mapowania — nic im się nie zmieniło.</li>
          </ul>
          <h4>Zakres roboczy — ile z odbiornika naprawdę używasz</h4>
          <p>Liczby przy profilu to pełne możliwości odbiornika, a nie zakres, którego musisz użyć. Zaznacz „własny zakres roboczy”, a mapowanie będzie pracować tylko w wybranym oknie — profil zostaje, razem ze swoimi zabezpieczeniami. Wpisane wartości są przycinane do możliwości profilu, więc serwa 0–180° nie da się poprosić o 250. Odwrócenie okna (min większy od max) odwraca kierunek: największe wychylenie kapsla daje najmniejszą wartość.</p>
          <p>To nie jest funkcja tylko dla serw. Przykłady, w których okno jest ważniejsze od pełnego zakresu: mechanika pozwala serwu na 10–25° i dalej uderza w ogranicznik, wentylator na PWM dławi się poniżej 30%, dioda mruga przy najniższym wypełnieniu, przetwornik ma bezpieczne okno napięcia, a suwak w programie AV nie powinien schodzić do zera.</p>
          <h4>Zachowanie na progu — druga, niezależna oś</h4>
          <p>Profil mówi, JAKA wartość poleci. Zachowanie mówi, KIEDY i JAK DŁUGO. To są dwie osobne decyzje, dlatego są dwoma osobnymi polami: dzięki temu da się ustawić „impuls 300 ms, ale wartością PWM 100%”. Pole pojawia się tylko w trybie progowym — w ciągłym wartość płynie razem z ruchem i nie ma żadnego zbocza.</p>
          <ul>
            <li><b>Impuls</b> — jeden komunikat w chwili przekroczenia progu.</li>
            <li><b>Bramka</b> — wartość górna, dopóki próg jest przekroczony, i dolna, gdy sygnał zejdzie poniżej.</li>
            <li><b>Przełącznik</b> — każde przekroczenie progu zmienia stan na przeciwny, jak włącznik światła. Powrót poniżej progu nic nie wysyła.</li>
            <li><b>Impuls X ms</b> — wartość górna, a po zadanym czasie odbiornik dostaje dolną, bez czekania, aż zejdziesz poniżej progu. Minimum to 20 ms, bo zbocze opadające jedzie na strumieniu próbek z kapsla (około 50 Hz) — krótszego impulsu nie dałoby się dotrzymać, tylko obiecać.</li>
          </ul>
          <h4>Tempo i niezawodność — tylko w trybie ciągłym</h4>
          <p>Trzy pola pilnują, żeby strumień nie zalał odbiornika ani nie urwał się niezauważenie. W trybie progowym ich nie ma, bo tam komunikat leci na zboczu i żadne z nich nic by nie robiło.</p>
          <ul>
            <li><b>Min odstęp</b> — górna granica tempa, czyli ile komunikatów na sekundę najwyżej. Chroni odbiornik przed zalaniem.</li>
            <li><b>Limit prędkości</b> — w jednostkach wyjścia na sekundę. Dla serwa 0–180 wpisanie 90 znaczy „pełny przejazd nie szybciej niż w dwie sekundy”. Bez tego gwałtowny ruch kapsla to dla mechaniki skok z jednej skrajności w drugą; z tym serwo dostaje gwarantowany czas przejazdu. Zero wyłącza limit.</li>
            <li><b>Powtarzaj co</b> — dolna granica, czyli bicie serca strumienia. UDP nie potwierdza dostarczenia niczego: bez powtarzania nieruchomy kapsel oznacza zupełną ciszę, więc odbiornik nie odróżni „leży spokojnie” od „padło Wi-Fi”, a zgubiony ostatni pakiet gestu zostawia go na złej wartości już na zawsze. Z powtarzaniem błąd naprawia się sam w ciągu jednego okresu. Zero wyłącza, a wartości poniżej 100 ms silnik też traktuje jak zero. Powtarzanie nigdy nie przyspieszy strumienia ponad zadeklarowany minimalny odstęp.</li>
          </ul>
          <h4>Wartość przy rozbrojeniu — czyli parkowanie</h4>
          <p>UDP nie ma potwierdzeń ani zamykania połączenia. Gdy rozbroisz aplikację, wyłączysz grupę OSC albo kapsel się rozłączy, odbiornik po prostu zostaje na ostatniej wartości, jaką dostał: serwo wykręcone, lampa zapalona. To pole wysyła wtedy jeden komunikat z wartością bezpieczną. Puste znaczy „nie parkuj”. Przełącznik i impuls parkują się same na wartości dolnej, więc nie zostawisz po sobie zapalonego światła.</p>
          <h4>Jak sprawdzić, że działa</h4>
          <p>Najprostszy podgląd jest na miejscu: „Dziennik wysyłek OSC” w „Zaawansowane” na dole tego ekranu pokazuje wszystko na żywo. Każde przekroczenie progu, parkowanie i test dostaje własny wiersz, a sterowanie ciągłe streszcza się co dwie sekundy: ile komunikatów poszło, w jakim zakresie i jaka była ostatnia wartość. Widać tam też, gdy coś się NIE wysłało i dlaczego. Zaznacz „każdy pakiet”, jeśli chcesz zobaczyć każdą wiadomość z osobna.</p>
          <p>Przycisk „Test wyjścia” w edytorze mapowania wysyła komunikat tą samą ścieżką co silnik — z typem i wartością z profilu, a nie z zastępczą jedynką. Żeby zobaczyć drugi koniec bez żadnego sprzętu, uruchom w katalogu aplikacji skrypt nasłuchujący z folderu tools (wypisuje pakiety na żywo) albo darmowy program Protokol od twórców TouchOSC.</p>
          <div class="setup-note">Od czego zacząć: „Nowe mapowanie OSC”, źródło Pochylenie, profil „Serwo 0–180°”, tryb Ciągły. Przechyl kapsel — po drugiej stronie masz kąt 0–180. Potem przełącz tryb na Próg i pobaw się zachowaniami; linijka pod polami zawsze pokazuje, co dokładnie poleci.</div>
        </div>
      </details>
      <div class="card mi-logcard" id="oscLogCard"></div></div>`;
    // move the OSC output group (host/port/prefix) out of the MIDI card — found by field id, while still attached
    const oh=byId("miOscHost");
    const grp=oh&&oh.closest(".mi-group");
    if(grp)oscCard.querySelector("#oscTarget").appendChild(grp);
    pOsc.appendChild(oscCard);
    pOsc.appendChild(oscAdv);                                   // piętro 3 zawsze ostatnie na ekranie
  }
  if(byId("midiCard"))pMidi.appendChild(byId("midiCard"));      // MIDI (now pad-less and OSC-less; always visible — see miApplyAvail)
  if(byId("miAdv"))pMidi.appendChild(byId("miAdv"));            // MIDI › Zaawansowane (piętro 3, UX 261120 L4c)
  if(byId("exchangeHero"))pKonfig.appendChild(byId("exchangeHero"));  // what OTHER PEOPLE have comes first…
  if(byId("libraryCard"))pKonfig.appendChild(byId("libraryCard"));    // …then everything saved on this disk (the save-as row lives inside it now)
  if(byId("zsAdv"))pKonfig.appendChild(byId("zsAdv"));                // Zestawy › Zaawansowane (piętro 3, UX 261120 L4c)
  // Connection: device/stats + battery saving + LED/commands + CSV recording
  // UX 261120 L4b: piętra. #powerCard to już zwijak wewnątrz #connCard, a liczniki, komendy hex
  // i częstotliwość strumienia stoją w „Zaawansowane” (#connAdv), które idzie na koniec ekranu.
  const connAdv=byId("connAdv"), connAdvBody=connAdv&&connAdv.querySelector(".cardfold-body");
  if(byId("connCard"))pConn.appendChild(byId("connCard"));
  if(connAdv)pConn.appendChild(connAdv);
  // move CSV recording from the top bar to the Connection tab (less clutter in the header)
  const rec=byId("recToggle"), csvb=byId("csv");
  if(rec&&csvb){
    const csvCard=document.createElement("div");csvCard.className="card";csvCard.id="csvCard";
    csvCard.innerHTML=`<div class="head"><h2>Nagrywanie danych (CSV)</h2>
      <span class="hint">zaznacz, co ma trafić do pliku, potem naciśnij „Nagrywaj CSV”</span></div>`;
    // What goes into the file. Ticks live here rather than in a dialog because the decision is made
    // in the same breath as pressing record, and a recording started with the wrong ticks is a
    // recording you have to repeat with the hardware in your hand.
    const picks=document.createElement("div");picks.className="csvpicks";
    const PICK_LABELS={
      imu:   ["Kanały czujnika (CH0–CH5)","Sześć surowych wartości z akcelerometru i żyroskopu, tak jak przyszły z kapsla"],
      stat:  ["Pakiety statusu 0x21 (przycisk)","Pięć bajtów, w których kapsel melduje naciśnięcie. To tutaj widać klikanie."],
      pose:  ["Filtr 3D (pochylenie, obrót, pitch, roll)","Wynik filtra orientacji, czyli to, co widzi mapowanie ruchu"],
      trig:  ["Wyzwalacze (co się odpaliło)","Moment, w którym reguła włącza się, wyłącza albo zwiększa licznik odpaleń"],
      hex:   ["Surowy hex ramki","Cała ramka bajt po bajcie. Przydatne, gdy trzeba sprawdzić coś, czego kolumny nie pokazują."],
      alldev:["Wszystkie kapsle (domyślnie tylko oglądany)","Nagrywaj też kapsle, których akurat nie oglądasz. Bez tego naciśnięcie na innym kapslu nie trafi do pliku."],
    };
    for(const s of REC_STREAMS){
      const lab=PICK_LABELS[s.k];if(!lab)continue;
      const l=document.createElement("label");l.className="csvpick";l.title=lab[1];
      const cb=document.createElement("input");cb.type="checkbox";cb.checked=recWants(s.k);
      cb.addEventListener("change",()=>{state.recPick[s.k]=cb.checked;recSavePick();});
      l.appendChild(cb);l.appendChild(document.createTextNode(lab[0]));
      picks.appendChild(l);
    }
    csvCard.appendChild(picks);
    const bar=document.createElement("div");bar.className="csvbar";
    bar.appendChild(rec);bar.appendChild(csvb);
    csvCard.appendChild(bar);
    (connAdvBody||pConn).appendChild(csvCard);
  }
  // All: CHEAT SHEET — mappings + live activations of ALL slots (read-only)
  const pAll=mk("wszystkie");
  const ovCard=document.createElement("div");ovCard.className="card";ovCard.id="overviewCard";
  // ŚCIĄGA MA WŁASNĄ ZAKŁADKĘ (2026-09-01). Do tego dnia stała na dole ekranu „Nakładka" pod kartą
  // zarządzania oknami i była tym, co się na nim widziało najpierw — czyli ekran odpowiadał na
  // „pokaż mi wszystko naraz", a miał odpowiadać na „pozwól mi skonfigurować
  // nakładkę". Nie znika, bo to ona rysuje treść okna nad grą i bo otwiera się ją na drugim
  // monitorze; schodzi o jedno kliknięcie w bok. Rozdaje zakładki rf-49p, po tym znaczniku.
  ovCard.dataset.rfpcPane="sheet";
  // PRZYCISKI NAKŁADEK STĄD ODESZŁY (2026-08-31). Stały w tym nagłówku, bo ekran nazywał się
  // „Mapowania" i był jedynym miejscem, z którego dało się wypuścić okno nad grę. Od kiedy ekran
  // nazywa się „Nakładka" i ma nad ściągą własną kartę „Nakładki nad grą" (rf-41b), pasek stoi
  // tam — razem z listą okien, edytorem każdego z nich i paskiem nazwanych układów. Tutaj został
  // sam przycisk ściągi, bo on jest o ŚCIĄDZE: otwiera ją na drugim monitorze, a nie nad grą.
  ovCard.innerHTML=`<div class="head"><h2><span class="rfic hd-ic hd-ic-axes" aria-hidden="true"></span>Wszystkie kapsle — ściąga</h2>
    <span class="hint">mapowania + aktywacje na żywo (podgląd dla grającego) · koło wyboru pokazuje się tu i w nakładce na czas wybierania</span>
    <button class="btn sm" id="ovWin" title="Otwórz ściągę w osobnym oknie (2. monitor / telefon)" style="margin-left:auto">🪟 Otwórz w oknie</button></div>
    <div id="overviewWrap" class="ov-wrap"></div>`;
  pAll.appendChild(ovCard);

  // — nawigacja (dawniej poziomy pasek zakładek)
  // "All" is no longer a tab — it's a separate screen from a header button (overview-only).
  //  pAll (cheat sheet panel) mounted further down, shown via CSS body.overview-only.
  //  Left group (input groups, carry a status dot): Mapowanie · Mysz · Kontroler · MIDI/OSC
  //  Right group (pushed right via .tab-right): Mapowania (ex-header overview button, inserted
  //  below) · Czujnik · Połączenie · Biblioteka
  // `grp` = w której sekcji pionowej nawigacji stoi pozycja: „Moduł" (rzeczy, które coś WYSYŁAJĄ
  // z kapsla i mają przełącznik oraz kropkę stanu) albo „Reszta" (ekrany, które niczego nie
  // wysyłają). `ord` porządkuje samą „Resztę" — kolejność w TABS zostaje taka, jak była, bo czyta
  // ją „Widoczność zakładek" (rf-48). Pozycja BEZ `grp` nie trafia do nawigacji w ogóle.
  // Trzecia sekcja, „Wypróbuj" (`grp:"play"`, 2026-10-03), stoi między nimi: Synth i link do gry
  // RibbitBeat, czyli najszybszy sposób, żeby usłyszeć i zobaczyć kapsel bez żadnej konfiguracji.
  const TABS=[
    {id:"mapowanie",   label:"Mapowanie",              panel:pMap,    png:"map",    dot:"map",  grp:"mod"},
    // Między Mapowaniem a Myszą, bo tam należy w kolejności czytania: najpierw reguły „ruch to
    // klawisz", potem koło jako drugi sposób na ten sam jeden przycisk kapsla, dopiero potem
    // prowadzenie kursora. Ikona ta sama, co w nagłówku karty — zakładka i karta mają wyglądać
    // na jedno miejsce.
    {id:"kolo",        label:"Koło wyboru",            panel:pKolo,   png:"radial", dot:"wheel", grp:"mod"},
    {id:"mysz",        label:"Mysz",                   panel:pMysz,      png:"mmouse", dot:"mouse", grp:"mod"},
    // SKANER zaraz za Myszą, bo odpowiada na to samo pytanie inaczej: Mysz prowadzi kursor,
    // Skaner wybiera punkt, gdy prowadzić się nie da. Ikona celownika
    // — dwie krzyżujące się linie to dokładnie to, co ten moduł rysuje na ekranie.
    {id:"skaner",      label:"Skaner",                 panel:pSkaner, png:"celownik", dot:"scan", grp:"mod",
     title:"Skaner ekranu: obsługa jednym sygnałem"},
    {id:"kontroler",   label:"Kontroler",              panel:pKontroler, png:"gamepad", dot:"padout", grp:"mod"},
    {id:"midi",        label:"MIDI",                   panel:pMidi,   png:"midi",   dot:"midi", grp:"mod"},
    {id:"osc",         label:"OSC",                    panel:pOsc,    png:"osc",    dot:"osc",  grp:"mod"},
    // id and panel stay "restapi": they are in localStorage, in every selector and in the guide
    // registry. Only the LABEL changed, because the tab stopped being about REST alone the day
    // OBS Studio moved in — it speaks a WebSocket, not HTTP.
    //
    // WHY THE SHORT WORD. The tab is called „Usługi sieciowe" everywhere it has room — the card at
    // the top of it, the guide, the notifications, the README. Not here: the left tabs share ONE
    // width (_equalizeLeftTabs), so the longest of them sets all seven. Measured at a 1280 px
    // window: „Usługi sieciowe" pushes that shared width 93 → 117 px, adds 168 px to the bar and
    // wraps it onto a second row, where „REST API" fitted on one. „Usługi" costs nothing at all —
    // „Mapowanie" is still the widest — and the full name is one hover (title) or one click away.
    {id:"restapi",     label:"Usługi",                 panel:pRest,   png:"rest",   dot:"rest",  grp:"mod",
     title:"Usługi sieciowe: HTTP i OBS Studio"},
    // SYNTH W „WYPRÓBUJ", NIE W „MODULE" (2026-10-03): Synth i RibbitBeat stoją OBOK modułów, jako
    // coś, co pozwala od razu przetestować aplikację. Synth dalej JEST modułem
    // (kropka stanu, włącznik per kapsel w macierzy „Moduły", mapowanie i pady efektów), zmienia się
    // tylko sekcja nawigacji. Kropka zostaje: rf-34b `paintOuts` liczy ją razem z modułami.
    // WHY: grp only decides the nav section; the dot, the panel and the id are untouched.
    {id:"pad",         label:"Synth",                  panel:pPad,    png:"synth", dot:"pad", grp:"play"},
    // NAKŁADKA — dawny ekran „Mapowania". Był OSOBNYM widokiem: przycisk chował pasek zakładek
    // i podgląd na żywo, zostawiając samą ściągę, przez co jedno kliknięcie wyprowadzało z panelu
    // do czegoś, co wyglądało jak inna aplikacja i wracało się stamtąd własnym przyciskiem.
    // Teraz jest zakładką jak każda inna: panel pod paskiem, wejście i wyjście tą samą drogą.
    //
    // NAZWA. „Mapowania" stało obok „Mapowania" (l. poj.) i różniło się jedną literą, choć to dwie
    // zupełnie inne rzeczy: tam ustawia się reguły jednego kapsla, tu ogląda się wszystkie naraz
    // i stąd wypuszcza się okna nad grę. Stąd nazwa „Nakładka”: poprzednie nazwy brzmiały
    // zbyt podobnie i się myliły.
    {id:"wszystkie",   label:"Nakładka",               panel:pAll,    png:"axes",   right:true, grp:"tools", ord:3,
     title:"Ściąga wszystkich kapsli. Stąd wypuszczasz okna nad grę"},
    {id:"czujnik",     label:"Czujnik",                panel:pCz,     png:"sensor", grp:"tools", ord:4},
    {id:"polaczenie",  label:"Połączenie",             panel:pConn,   png:"conn",   grp:"tools", ord:5},
    // NAZWA ZMIENIONA 2026-08-31 z „Biblioteka" na „Zestawy i wymiana", a jeszcze tego samego dnia
    // na samo „Zestawy" — po wydzieleniu z niej „Konfiguracji" (niżej) nie ma już czego dopowiadać:
    // wymiana jest jedną z rzeczy, które robi się ZESTAWOM. Od 08-31 KAŻDY moduł ma własną zakładkę
    // „Biblioteka" (rf-49m) i dwie różne rzeczy nie mogą nazywać się tak samo w jednej nawigacji:
    // tamta odpowiada na „jakie konfiguracje ma TEN moduł", ta trzyma paczkę ustawień WIELU modułów
    // naraz (per gra) razem z wymianą i spisem wszystkiego, co leży na dysku.
    // `id` i `panel` ZOSTAJĄ `konfiguracje`: siedzą w localStorage, w „Widoczności zakładek",
    // w rejestrze poradników i w deep-linkach — zmiana napisu nie ma prawa tego ruszyć.
    // UX 261120: „Zestawy” to pierwszy krok z instrukcji, więc stoją NAD sekcjami (`grp:"top"`),
    // zamiast pod krawędzią nawigacji w „Narzędziach”.
    // IKONA: filcowa kaseta magnetofonowa (2026-11-22, prośba właściciela). Zestaw to „nagranie"
    // pod jedną grę, które się wkłada i gra; każdy zestaw w Bibliotece też jest kasetą (rf-28e).
    // Sejf (`vault`) został przy „Bibliotece" modułów, więc dwie różne rzeczy mają dwa różne znaki.
    {id:"konfiguracje",label:"Zestawy",               panel:pKonfig, png:"kaseta", grp:"top", ord:1,
     title:"Zestawy (cała konfiguracja pod jedną grę), wymiana z forum i wszystko, co masz zapisane na dysku"},
    // USTAWIENIA: ustawienia samego programu, a nie kapsla i nie modułu: stop awaryjny, serwer MCP
    // i zgłoszenie problemu. Nazwa „Ustawienia” (UX 261120, D1), bo „Konfiguracja” to pierwsza
    // pod-zakładka każdego modułu, a jedno słowo nie może znaczyć dwóch miejsc. Stoi osobno na
    // samym dole nawigacji (`grp:"app"`): dotyczy programu, nie kapsla.
    {id:"ustawienia",  label:"Ustawienia",            panel:pUstaw,  png:"ustawienia", grp:"app", ord:2,
     title:"Ustawienia samego programu: stop awaryjny, serwer MCP dla asystentów AI, zgłoszenie problemu"},
    // Bez `grp` — patrz komentarz przy pPrzeglad. Stoi na końcu listy, żeby nie przesuwać
    // niczego, co „Widoczność zakładek" (rf-48) już zna, a i tak jest z niej wyłączony.
    {id:"przeglad",    label:"Przegląd",               panel:pPrzeglad, png:"eye"},
  ];
  // RIBBITFLIP-LITE (build bez Syntha i gry, 2026-10-03): serwer stawia na <html> `data-edition="lite"`
  // (_serve_html), a tu, ZANIM cokolwiek zbuduje przyciski, wypadają pozycje „Wypróbuj” (`grp:"play"`).
  // Kod Syntha zostaje w paczce, bo jest wpleciony w dziesiątki rf-*.js; znika tylko wejście do niego.
  // Panel pPad zostaje w DOM jako zwykła schowana zakładka, a setTab("pad") z innych miejsc ląduje na
  // kotwicy, bo `pad` nie ma już w TABS. rf-48 „Widoczność” i rf-34b czytają ten sam, już przycięty TABS.
  // WHY: one filter at the source keeps every reader of TABS consistent.
  const RF_LITE=document.documentElement.dataset.edition==="lite";
  if(RF_LITE)for(let i=TABS.length-1;i>=0;i--)if(TABS[i].grp==="play")TABS.splice(i,1);
  // MODUŁY WYŁĄCZONE PRZY STARCIE (--disable / --only, rf-00b-modules.js): ich zakładki wypadają z TABS
  // tą samą drogą co „Wypróbuj” w Lite, zanim powstaną przyciski — rf-48, rf-34b i setTab widzą jedną listę.
  if(typeof rfModTabOff==="function")for(let i=TABS.length-1;i>=0;i--)if(rfModTabOff(TABS[i].id))TABS.splice(i,1);
  const btns={};
  const _rightStart=TABS.findIndex(t=>t.right);
  // ---- which tabs are folded away („Widoczność", rf-48-tabvis.js) ------------------------------
  // The list is read from the injected global, NOT fetched: the bar is built in this very frame,
  // and a fetch would mean drawing the hidden tabs first and removing them a moment later. The
  // server injects it into <head> (see _serve_html) precisely so this line can be synchronous.
  //
  // Mapowanie is the ANCHOR and is never in the set, whatever arrives: it is the tab the panel
  // falls back to, so a rig that managed to hide it would have nowhere to land.
  const TAB_ANCHOR="mapowanie";
  const _tabHidden=new Set();
  try{(window.RIBBITFLIP_HIDDEN_TABS||[]).forEach(id=>{
    id=String(id||""); if(id&&id!==TAB_ANCHOR)_tabHidden.add(id);});}catch(e){}
  function setTab(id){
    // UX 261120 L23: schowana pozycja NIE jest zamknięta. Stoi pod „Więcej modułów (N)” (rf-34b
    // `placeHidden`) i da się na nią wejść jednym kliknięciem, więc do kotwicy odsyłamy tylko
    // nieznane id. Schowanie oglądanej pozycji dalej przenosi na kotwicę (rfTabsApplyVisibility).
    if(!TABS.some(t=>t.id===id))id=TAB_ANCHOR;
    // leaving the Pad tab: the sound-studio <details> stays "open" while its panel is display:none
    // (so its 'toggle' teardown never fires) — silence + free the lab bus + its timers explicitly.
    if(id!=="pad"&&typeof labStopAll==="function")labStopAll();
    // Nagrywanie makra (rf-32) trzyma nasłuch na OKNIE i połyka każdy klawisz w aplikacji. Zakładka,
    // w której je zaczęto, właśnie znika z oczu, a nasłuch by został — więc kończy się tutaj, na
    // wyjściu, a nie w każdym edytorze z osobna.
    if(typeof stopSeqRec==="function")stopSeqRec();
    // leaving Uslugi sieciowe: soft-lock the credential vault (UI back to "locked"; secrets survive
    // in RAM only for background sending — see restOnLeaveTab / settings.keepUnlockedForSend)
    if(id!=="restapi"&&typeof restOnLeaveTab==="function")restOnLeaveTab();
    // wychodząc z „Nakładki": okno otwarte NA PODGLĄD (rf-41d, „Otwieraj na żywo") żyje tyle, co
    // ekran, na którym się je ustawiało. Zostawione nad grą wyglądałoby na nakładkę, która sama
    // się włączyła — a zamykamy wyłącznie to, co sami otworzyliśmy (patrz `_ovgOpened`).
    if(id!=="wszystkie"&&typeof ovgLiveLeave==="function")try{ovgLiveLeave();}catch(e){}
    // entering Usługi sieciowe: ask once where the OBS link stands. Asked here rather than polled,
    // because the answer only changes when somebody presses something (in this panel or in OBS).
    if(id==="restapi"&&typeof restObsRefresh==="function")try{restObsRefresh();}catch(e){}
    let _active=null;
    for(const t of TABS){const on=t.id===id;t.panel.classList.toggle("active",on);
      btns[t.id].classList.toggle("active",on);btns[t.id].setAttribute("aria-selected",on?"true":"false");
      if(on)_active=t.panel;}
    // Wybrana pozycja w schowanej liście „Więcej modułów” rozwija tę listę (rf-34b), zanim
    // `_navRoving` wybierze przystanek Tab i `_navReveal` ją dociągnie.
    try{if(window.rfCols&&window.rfCols.moreSync)window.rfCols.moreSync();}catch(e){}
    _navRoving();   // aktywna pozycja = jedyny przystanek Tab w nawigacji (patrz `_navRoving`)
    // Przy 1440×900 nawigacja dalej się przewija (narzędzia stoją pod krawędzią), więc wybrana
    // pozycja jest dociągana do widoku W SAMEJ kolumnie. Ręcznie, nie `scrollIntoView`: tamto
    // przewinęłoby też stronę, a środek ma zostać tam, gdzie był.
    _navReveal(btns[id]);
    // ONE entrance language: spring-in the panel's top-level cards on every tab switch
    // (Synth == MIDI == every tab). rfStagger no-ops under reduced motion + before rf-motion-js loads.
    if(_active&&window.rfStagger)window.rfStagger(_active);
    // Wchodząc w „Koło wyboru": małe koła na kaflach kapsli (rf-46h) rysują się z WYMIARU
    // pojemnika, a schowana zakładka wymiaru nie ma. Musi to być PO nadaniu panelowi klasy
    // `active` — przed nią kafle są nadal niewidoczne i rysunek grzecznie odpuszcza.
    if(id==="kolo"&&typeof wheelCapsDraw==="function")try{wheelCapsDraw(true);}catch(e){}
    // Ramka podglądu skanera dostaje wymiar dopiero tutaj — cała geometria skanowania bierze się
    // z niej, więc bez tego pierwszy pasek jechałby po prostokącie 0×0.
    if(id==="skaner"&&typeof scanOnShow==="function")try{scanOnShow();}catch(e){}
    // Wchodząc w „Przegląd wszystkich kapsli": macierz modułów odświeża się TYLKO wtedy, gdy jest
    // widoczna (rf-45 `dmPaint` sprawdza `offsetParent`) — inaczej przemielała siatkę przy każdym
    // tiku o kapslach, siedząc w schowanej zakładce. Cena tego jest jedna: wejście musi ją
    // obudzić. Tak samo jak wyżej — PO nadaniu panelowi klasy `active`, bo wcześniej jest
    // niewidoczny i `dmPaint` grzecznie odpuści.
    if(id==="przeglad"&&typeof dmPaint==="function")try{dmPaint();}catch(e){}
    // Wchodząc w „Nakładkę": otwórz na żywo okno, które jest wybrane do ustawiania (rf-41d).
    // Tak samo jak dwa wejścia wyżej — PO nadaniu panelowi klasy `active`, bo przed nią
    // `_ovgOnScreen` grzecznie odpuszcza.
    if(id==="wszystkie"&&typeof ovgLiveEnter==="function")try{ovgLiveEnter();}catch(e){}
    if(window._padWake)window._padWake();   // ECONOMY MODE: entering the Synth tab must resume the loop NOW
    try{localStorage.setItem("ribbitflip.tab",id);}catch{}
  }
  window.setTabById=setTab;   // expose (MIDI availability guard in onConfig)
  const RF_NAV_LISTS=["#rfNavTop","#rfNavMod","#rfNavMore","#rfNavPlay","#rfNavTools","#rfNavApp"];
  function _navReveal(b){
    const rail=document.getElementById("rfRail");
    if(!b||!rail||b.offsetParent===null)return;
    const r=b.getBoundingClientRect(),R=rail.getBoundingClientRect(),M=12;
    if(r.bottom>R.bottom-M)rail.scrollTop+=r.bottom-R.bottom+M;
    else if(r.top<R.top+M)rail.scrollTop-=R.top+M-r.top;
  }
  // ---- klawiatura w nawigacji (WCAG: wzorzec „tablist") ----------------------------------------
  // TRZY LISTY, JEDNA NAWIGACJA. Pozycje mieszkają w trzech pojemnikach („Moduł", „Wypróbuj"
  // i „Reszta"), ale dla człowieka z klawiaturą są jedną kolumną: strzałka w dół z ostatniego
  // modułu ma wejść w Synth, a z niego w „Zestawy", zamiast zatrzymać się na granicy kart. Stąd
  // jedna lista złożona ze wszystkich pojemników (w kolejności dokumentu),
  // zawijana na końcach. Lewo/prawo są aliasami góry/dołu — nawigacja stoi w pionie
  // (aria-orientation w rf-34b), ale nikt nie powinien zgadywać, która strzałka działa.
  // Ukryte pozycje („Widoczność zakładek", rf-48) są pomijane: dla użytkownika ich NIE MA.
  // WHY: arrows move between tabs and Tab leaves the tablist (roving tabindex below), so the
  // navigation costs one Tab stop instead of thirteen.
  // UX 261120: pięć pojemników w jednej karcie (Zestawy, Moduły, Wypróbuj, Narzędzia, Ustawienia),
  // w kolejności dokumentu. Selektor jest jeden (`RF_NAV_LISTS`), bo czyta go też `_navRoving`.
  const _navList=()=>[...document.querySelectorAll(RF_NAV_LISTS.map(s=>s+" .tab-btn").join(", "))]
    .filter(b=>b.offsetParent!==null);
  function _navKey(e){
    if(e.altKey||e.ctrlKey||e.metaKey)return;
    const k=e.key;
    let d=0,jump=0;
    if(k==="ArrowDown"||k==="ArrowRight")d=1;
    else if(k==="ArrowUp"||k==="ArrowLeft")d=-1;
    else if(k==="Home")jump=1;
    else if(k==="End")jump=-1;
    else return;
    const L=_navList(); if(!L.length)return;
    const at=L.indexOf(e.currentTarget); if(at<0)return;
    const n=jump?(jump>0?L[0]:L[L.length-1]):L[(at+d+L.length)%L.length];
    if(!n||n===e.currentTarget&&!jump)return;
    e.preventDefault();
    setTab(n.dataset.tab);      // ta sama droga co klik — i to ona przestawia roving tabindex
    try{n.focus();}catch(err){}
  }
  // ROVING TABINDEX. Trzynaście pozycji nawigacji znaczyło trzynaście przystanków Tab przed
  // pierwszym polem na ekranie. Teraz w każdej liście jest dokładnie jeden: pozycja aktywna, a
  // jeśli lista żadnej nie ma (aktywny jest moduł, więc „Reszta" nie ma nic zaznaczonego) —
  // pierwsza widoczna, bo inaczej do drugiej listy nie dałoby się wejść z klawiatury wcale.
  // Widoczność liczona z `style.display`, a nie z `offsetParent`: to samo wywołanie jedzie przy
  // starcie panelu, zanim kolumny w ogóle coś zajmą na ekranie — wtedy `offsetParent` jest pusty
  // dla WSZYSTKICH i lista wyszłaby zerowa. Chowanie pozycji (rf-48) ustawia właśnie `style.display`.
  // WHY: one Tab stop per list; arrows do the rest.
  // UX 261120: przy pięciu pojemnikach „jeden przystanek na listę” znaczyłby pięć przystanków
  // Tab w samej nawigacji, więc przystanek jest JEDEN na całą nawigację: pozycja aktywna, a gdy
  // aktywny jest ekran spoza nawigacji (Przegląd), pierwsza widoczna.
  function _navRoving(){
    const L=[...document.querySelectorAll(RF_NAV_LISTS.concat(".rnav-fallback").map(s=>s+" .tab-btn").join(", "))]
      .filter(b=>b.style.display!=="none"&&!b.closest(".rf-navmore-list[hidden]"));
    if(!L.length)return;
    const act=L.find(b=>b.classList.contains("active"))||L[0];
    for(const b of L)b.tabIndex=(b===act)?0:-1;
  }
  for(const t of TABS){
    // Klasa `tab-btn` ZOSTAJE: trzyma ją „Widoczność zakładek", inwentarz i wszystko, co szuka
    // zakładek po klasie. `rnav-btn` dokłada wygląd pozycji w pionowej nawigacji — stary wygląd
    // z `10-icons-controls.css` był pisany pod `.tabbar .tab-btn` i tu po prostu nie trafia.
    const b=document.createElement("button");b.className="tab-btn rnav-btn"+(t.right?" tab-right":"");b.type="button";
    b.dataset.tab=t.id;b.setAttribute("role","tab");
    if(t.panel&&t.panel.id)b.setAttribute("aria-controls",t.panel.id);   // role=tab bez tego nie mówi, czym steruje
    if(_rightStart>=0&&TABS.indexOf(t)<_rightStart)b.classList.add("tab-eqw");
    if(t.png){const ic=document.createElement("span");ic.className="rfic tab-ic-"+t.png;ic.setAttribute("aria-hidden","true");b.appendChild(ic);}
    else if(t.emoji){const em=document.createElement("span");em.className="tab-emoji";em.setAttribute("aria-hidden","true");em.textContent=t.emoji;b.appendChild(em);}
    const tx=document.createElement("span");tx.textContent=t.label;   // separate node so i18n exact-match still translates
    b.appendChild(tx);
    if(t.title)b.title=t.title;   // a shortened label says the whole name on hover (the i18n walker translates `title`)
    // THE ACCESSIBLE NAME STARTS WITH THE VISIBLE LABEL (WCAG 2.5.3, „Label in Name"). Somebody
    // saying „Nakładka" to voice control has to hit the item that READS „Nakładka" - and the two
    // items whose hint does not begin with their own caption were announced by that hint instead
    // („Ściąga wszystkich kapsli…", „Ustawienia samego programu…"). The caption goes in front;
    // the visible hint (`title`) is left exactly as it was, because „Widoczność zakładek" (rf-48)
    // reads it off the button and shows it as its own row. Items whose hint already opens with the
    // caption („Usługi" / „Usługi sieciowe…") get no aria-label at all: their name is the caption
    // already, and a second copy of it would only be a second string to translate.
    // The composed sentence needs its own I18N_EN pair - see the two keys in rf-01-i18n.js.
    if(t.title&&t.title.toLowerCase().indexOf(String(t.label||"").toLowerCase())!==0)
      b.setAttribute("aria-label",t.label+": "+t.title.charAt(0).toLowerCase()+t.title.slice(1));
    if(t.dot){const d=document.createElement("span");d.className="tab-dot";d.dataset.grp=t.dot;d.setAttribute("aria-hidden","true");b.appendChild(d);}
    b.addEventListener("click",()=>setTab(t.id));
    b.addEventListener("keydown",_navKey);
    // Schowane pozycje rozdaje `rfCols.placeHidden` (pod „Więcej modułów”) zaraz po zbudowaniu
    // kolumn, w tej samej klatce, więc nie migają w swoich sekcjach.
    btns[t.id]=b;   // do nawigacji rozdaje je rfCols.build() — „Przegląd" nie trafia tam wcale
  }
  // ---- visibility: the two things rf-48 needs from here ----------------------------------------
  // `margin-left:auto` lives on ONE button and pushes everything after it to the right. Normally
  // that button is „Mapowania" (above), which is not a tab and can never be hidden. Where it is
  // absent the push sits on the first right-hand tab — and hiding THAT one would drag the whole
  // right group back into the left pack. So the pusher is re-pinned onto the first right-hand tab
  // that is actually visible.
  function _repinRight(){
    if(_rightStart<0)return;
    let taken=false;
    for(let i=_rightStart;i<TABS.length;i++){
      const b=btns[TABS[i].id]; if(!b)continue;
      const vis=!_tabHidden.has(TABS[i].id);
      b.classList.toggle("tab-right",vis&&!taken);
      if(vis)taken=true;
    }
  }
  _repinRight();                                      // first paint counts too
  // The one entry point for changing what is on the bar. rf-48 owns the LIST (it talks to the
  // server); this owns the BAR. Kept as a function call rather than a shared mutable set so there
  // is exactly one place where a hidden tab turns into a repaint — including the fallback jump,
  // which must happen here or nowhere.
  window.rfTabsApplyVisibility=function(list){
    const _hadFocus=document.activeElement;
    _tabHidden.clear();
    try{(list||[]).forEach(id=>{id=String(id||"");if(id&&id!==TAB_ANCHOR)_tabHidden.add(id);});}catch(e){}
    if(window.rfCols&&window.rfCols.placeHidden)window.rfCols.placeHidden(_tabHidden);
    else for(const t of TABS){
      const b=btns[t.id]; if(!b)continue;
      b.style.display=_tabHidden.has(t.id)?"none":"";
    }
    _repinRight();
    // Hiding the tab you are standing on: land on the anchor rather than on a blank page.
    let cur=""; try{cur=localStorage.getItem("ribbitflip.tab")||"";}catch(e){}
    const act=TABS.find(t=>t.panel.classList.contains("active"));
    const on=(act&&act.id)||cur;
    if(on&&_tabHidden.has(on))setTab(TAB_ANCHOR);
    _navRoving();
    // Pozycja, na której stał fokus, właśnie zniknęła (schowano ją w „Widoczności zakładek").
    // Fokus spadłby na <body> i klawiatura zaczynałaby od początku strony — oddajemy go pozycji
    // aktywnej. Kiedy fokus jest gdzie indziej (np. na przełączniku w szufladzie widoczności),
    // ten warunek jest fałszywy i nic nie zabieramy.
    // WHY: focus must never fall to <body> because the element under it was folded away.
    if(_hadFocus&&_hadFocus.classList&&_hadFocus.classList.contains("tab-btn")&&(_hadFocus.style.display==="none"||_hadFocus.offsetParent===null)){
      const a=document.querySelector(RF_NAV_LISTS.map(s=>s+" .tab-btn.active").join(","));
      if(a)try{a.focus();}catch(e){}
    }
    try{window._equalizeLeftTabs&&window._equalizeLeftTabs();}catch(e){}
  };
  // The registry, for whoever draws the visibility row. Labels are read LIVE off the buttons, so
  // they are whatever the i18n walker has already made of them — the row can never disagree with
  // the bar it controls.
  window.rfTabsList=function(){
    // Tylko pozycje, które NAPRAWDĘ stoją w nawigacji. „Przegląd" nie ma tam kafla, więc nie ma
    // też czego chować — wiersz przełącznika dla ekranu, którego nie widać na liście, obiecywałby
    // działanie, którego nie ma.
    return TABS.filter(t=>t.grp).map(t=>{
      const b=btns[t.id];
      const lbl=b&&b.querySelector("span:not(.rfic):not(.tab-dot):not(.tab-emoji)");
      return {id:t.id,png:t.png||"",emoji:t.emoji||"",
              label:(lbl&&lbl.textContent)||t.label||t.id,
              title:(b&&b.title)||"",
              // Sekcja i porządek W NAWIGACJI — żeby wiersz „Widoczność" mógł ułożyć przełączniki
              // w tej samej kolejności, w jakiej stoją pozycje, którymi steruje. Bez tych dwóch
              // pól rf-48 czytał surową kolejność z TABS, czyli inną niż ta na ekranie.
              grp:t.grp||"", ord:(t.ord!=null?t.ord:99),
              anchor:(t.id===TAB_ANCHOR),
              hidden:_tabHidden.has(t.id)};
    });
  };
  window.rfTabsAnchor=TAB_ANCHOR;
  // STAN MODUŁU NIE MOŻE BYĆ SAMYM KOLOREM (WCAG 1.4.1). Kropka jest `aria-hidden`, a jej dymek
  // pokazuje się pod myszą — kto chodzi po panelu klawiaturą albo czytnikiem, nie dowiadywał się
  // z nawigacji NIC o tym, czy moduł jest włączony. To samo zdanie idzie więc jako OPIS przycisku
  // (aria-describedby), a NIE jako nazwa: nazwa ma zostać samą etykietą (WCAG 2.5.3 „Label in Name",
  // patrz kom. przy budowie przycisków wyżej). Węzeł tekstowy mieszka w tym samym schowku
  // `#rf-tipdesc`, którego używa rf-05 `describe()` — dzięki temu tłumaczy go walker i18n, czego
  // `aria-description` (atrybut) by nie doczekał. Istniejącego `aria-describedby` nie nadpisujemy:
  // „Usługi" mają tam już swój dymek z rf-05 i oba zdania mają być słyszane.
  // WHY: colour alone must not carry state; the sentence becomes the tab's DESCRIPTION, not its name.
  function _dotDescribe(btn,g,tip){
    let host=document.getElementById("rf-tipdesc");
    if(!host){host=document.createElement("div");host.id="rf-tipdesc";
      host.style.cssText="position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0";
      (document.body||document.documentElement).appendChild(host);}
    const nid="rf-dotd-"+g;
    let n=document.getElementById(nid);
    if(!n){n=document.createElement("span");n.id=nid;host.appendChild(n);}
    if(n.textContent!==tip)n.textContent=tip;   // walker i18n przetłumaczy go jak każdy inny węzeł tekstowy
    const db=btn.getAttribute("aria-describedby")||"";
    if(db.split(/\s+/).indexOf(nid)<0)btn.setAttribute("aria-describedby",(db?db+" ":"")+nid);
  }
  // status dots (green = input group enabled, red = off) — refreshed on every group toggle
  function updateTabDots(){
    // Kropki wisiały kiedyś w jednym pasku i szukało się ich jednym querySelectorAll po nim.
    // Teraz przyciski są rozdane do trzech sekcji nawigacji (a „Przegląd" nie jest w żadnej), więc
    // pytamy o nie same przyciski — jedyne miejsce, które zna je wszystkie niezależnie od tego,
    // gdzie akurat wiszą.
    // ZNACZENIE KROPKI MÓWI JEJ DYMEK (2026-09-04). Legenda w lewej kolumnie („zielona — włączony,
    // szara — wyłączony…") zniknęła: pięć linijek stałego tekstu tłumaczyło coś, o co pyta się raz,
    // najeżdżając na kropkę. Napis idzie przez `title`, bo rf-05 przenosi go na dymek, a walker i18n
    // go tłumaczy; `dataset.tip` pamięta, co już ustawiono, bo rf-05 zdejmuje `title` i porównanie
    // z nim ustawiałoby go od nowa przy każdym odświeżeniu. Usługi sieciowe są jednym modułem na
    // całą aplikację, więc ich kropka nie mówi o „wybranym kapslu".
    // WSPÓLNE DLA WSZYSTKICH KAPSLI są Usługi i Skaner: oba mają jeden włącznik na całą aplikację
    // (`RESTAPI.cfg.enabled`, `_SCAN.enabled`), więc ich kropka nie mówi o „wybranym kapslu”.
    // STEROWANIE WSTRZYMANE (UX 261120): włączony moduł przy `state.armed=false` niczego nie wysyła,
    // więc kropka nie może świecić jak działająca. Klasa `held` gasi falę i przygasza zieleń
    // (20-cols.css), a dymek mówi, dlaczego. Stan `on` zostaje: moduł dalej JEST włączony.
    const held=(typeof state!=="undefined")&&state.armed===false;
    // PROBLEM (UX 261120 L23): moduł włączony, a wybrany kapsel śpi albo jest szukany, więc nic
    // z niego nie wychodzi. Tylko wtedy kropka pulsuje (`.warn`, 20-cols.css); działająca świeci
    // spokojnie. Usługi nie zależą od kapsla, więc ich to nie dotyczy.
    const _wd=state.devices&&state.devices[state.viewDev||state.activeDeviceId];
    const devBad=!!(_wd&&(_wd.parked||_wd.scanning));
    const set=(g,on)=>{
      const shared=(g==="rest"||g==="scan");
      const warn=!!on&&!held&&devBad&&g!=="rest";
      const tip=(on&&held)?"Włączony, ale sterowanie jest wstrzymane"
        :warn?"Włączony, ale kapsel nie jest połączony"
        :shared?(on?"Włączony, wspólny dla wszystkich kapsli":"Wyłączony, wspólny dla wszystkich kapsli")
        :(on?"Włączony na wybranym kapslu":"Wyłączony na wybranym kapslu");
      for(const id in btns){
        const d=btns[id].querySelector('.tab-dot[data-grp="'+g+'"]');
        if(!d)continue;
        d.classList.toggle("on",!!on);
        d.classList.toggle("held",!!on&&held);
        d.classList.toggle("warn",warn);
        if(d.dataset.tip!==tip){d.dataset.tip=tip;d.title=tip;}
        _dotDescribe(btns[id],g,tip);
      }
    };
    set("map",!!state.trigEnabled);
    // Koło wyboru ma własną zakładkę, więc i własną kropkę: zapala się razem z jego przełącznikiem
    // „On", a nie razem z wyzwalaczami. Zanim koło było osobnym modułem, jego stan doklejał się do
    // kropki Mapowania — i włączone samo koło zapalało zakładkę, w której nic nie było włączone.
    set("wheel",!!(state.wheel&&state.wheel.enabled));
    // Skaner ma własny włącznik i własną kropkę — z tego samego powodu, co koło.
    set("scan",!!(typeof scanIsEnabled==="function"&&scanIsEnabled()));
    // Motion is one engine behind two tabs, so the dot has to say WHICH of them the capsule is
    // actually driving — a green light on Mysz while the puck is running a d-pad would be a lie.
    // Auto-switching means the answer can be the broadcast mode, not the one picked in the UI.
    const _mo=state.mouse||{},_eff=(_mo.autoSwitch&&state.mousePrev&&state.mousePrev.mode)||_mo.mode;
    set("mouse",!!(_mo.enabled&&_eff==="mouse"));
    set("padout",!!(_mo.enabled&&_eff!=="mouse"));
    set("midi",!!(state.midi&&state.midi.enabled));
    set("osc",!!(state.midi&&state.midi.oscEnabled));   // OSC has its own switch, so its own dot
    // Synth ma DWIE bramki, tak samo jak jego kolumna w macierzy „Przegląd" (rf-45 `dmCellOn`):
    // wspólny przełącznik silnika dźwięku i wyciszenie TEGO kapsla. Kropka mówi o wybranym kapslu
    // (dymek kropki: „Włączony na wybranym kapslu"), więc musi czytać obie —
    // inaczej ona i macierz odpowiadają różnie na to samo pytanie.
    const _sd=state.devices&&state.devices[state.activeDeviceId];
    set("pad",!!(typeof XPAD!=="undefined"&&XPAD.enabled&&!(_sd&&_sd.meta&&_sd.meta.muted)));
    set("rest",!!(window.RESTAPI&&RESTAPI.cfg&&RESTAPI.cfg.enabled));
    // „Co wychodzi z tego kapsla" czyta DOKŁADNIE te same wielkości, co kropki wyżej, więc jedzie
    // tym samym wywołaniem. Dwa niezależne odświeżenia rozjechałyby się pierwszego dnia: kropka
    // mówiłaby „włączone", a lista obok „nic nie wychodzi".
    try{if(window.rfCols&&window.rfCols.paintOuts)window.rfCols.paintOuts();}catch(e){}
    // …a portret kapsla nad kropkami jest drugą połową tego samego zdania: kropki mówią o WYBRANYM
    // kapslu, a on mówi, który to. Wyciszenie („pad") potrafi zmienić kropkę bez ruszania pigułek,
    // więc portret nie może czekać na `renderDeviceSelector`.
    try{if(window.rfNavCapSync)window.rfNavCapSync();}catch(e){}
  }
  window.updateTabDots=updateTabDots;
  // Główny przełącznik (`#armBtn`) przestawia `setArmed` w rf-12, które kropek nie odświeża. Kropki
  // i karta „Co teraz wychodzi” czytają `state.armed`, więc słuchamy samego przycisku: każda zmiana
  // jego stanu (klik, zdarzenie `master` ze strumienia, stop awaryjny) przerysowuje je od razu.
  // WHY: one observer on the switch instead of a call in every place that flips it.
  (function(){
    const ab=byId("armBtn"); if(!ab||!window.MutationObserver)return;
    new MutationObserver(()=>{try{updateTabDots();}catch(e){}})
      .observe(ab,{attributes:true,attributeFilter:["aria-checked","disabled"]});
  })();
  // Stan kapsla (śpi, szukany, połączony) zmienia `.warn` kropek, a przychodzi przez
  // `renderDeviceSelector` (rf-11), nie przez przełączniki modułów. Zbieramy do jednej klatki.
  (function(){
    const prev=window.renderDeviceSelector; if(typeof prev!=="function")return;
    let pend=0;
    window.renderDeviceSelector=function(){
      const r=prev.apply(this,arguments);
      if(!pend)pend=requestAnimationFrame(()=>{pend=0;try{updateTabDots();}catch(e){}});
      return r;
    };
  })();
  // — assemble: clear old layout (empty <main>), build the three columns
  wrap.innerHTML="";
  const _panels=[pMap,pKolo,pMysz,pSkaner,pKontroler,pMidi,pOsc,pCz,pConn,pKonfig,pUstaw,pPad,pRest,pAll,pPrzeglad];
  if(window.rfCols&&window.rfCols.build){
    // `railFold` NIE jedzie już do rfCols — stoi w panelu Czujnika (patrz wyżej), a prawa kolumna
    // rysuje sobie własną miniaturę z tych samych buforów.
    window.rfCols.build({wrap,devPanel,panels:_panels,tabs:TABS,btns,setTab});
    if(window.rfCols.placeHidden)window.rfCols.placeHidden(_tabHidden);   // „Więcej modułów (N)”
  }else{
    // rf-34b-cols.js nie doszedł (stara paczka, wycięty plik) — składamy stary pionowy stos.
    // Lepszy panel bez trzech kolumn niż panel, którego w ogóle nie da się kliknąć.
    // railFold zostaje w Czujniku i tutaj się go NIE przenosi — przeniesienie wyjęłoby podgląd
    // z zakładki, w której właśnie zamieszkał, i zostawiło Czujnik bez obrazu.
    wrap.appendChild(devPanel);
    const _nav=document.createElement("div");_nav.className="rnav rnav-fallback";_nav.setAttribute("role","tablist");
    for(const t of TABS)if(t.grp){if(_tabHidden.has(t.id))btns[t.id].style.display="none";_nav.appendChild(btns[t.id]);}
    wrap.appendChild(_nav);
    for(const p of _panels)wrap.appendChild(p);
  }
  // „GRA” (RibbitBeat, dawniej „Żabi chór”, web/gry/) — LINK, NIE ZAKŁADKA. Od 2026-10-03 stoi w sekcji
  // „Wypróbuj” (rf-34b `#rfNavPlay`) zaraz pod Synthem, ale POZA listą zakładek (role=tablist może mieć w sobie tylko zakładki): nie ma
  // panelu ani kropki, nie ma go w TABS, więc „Widoczność zakładek” (rf-48), deep-linki i strzałki
  // (`_navList` zbiera `.tab-btn`) go nie widzą. Otwiera grę w nowej karcie; napis i dymek tłumaczy
  // walker i18n (pary w rf-01, sekcja „GRA RIBBITBEAT … W MENU”). Ikona ze zmiennej --ic-arcade.
  (function(){
    // Kolejność szukania: „Wypróbuj” (układ trzech kolumn), potem „Moduł” (starszy rf-34b bez tej
    // sekcji), potem awaryjny stos. WHY: the link must follow whichever list holds the Synth.
    // Lite: gry w paczce nie ma, więc link nie powstaje, a pusta karta „Wypróbuj” (rf-34b `#rfPlayCard`,
    // sam nagłówek bez pozycji) znika razem z nim. Schowana karta nie ma prostokątów, więc krok
    // przewodnika rf-39p, który na nią celuje, sam się pomija (`_usable`).
    if(RF_LITE){
      const pc=document.getElementById("rfPlayCard");
      if(pc&&!pc.querySelector(".tab-btn")){pc.hidden=true;pc.style.display="none";}
      return;
    }
    // Gra wyłączona przy starcie (--disable gra): tak samo jak w Lite, link nie powstaje.
    if(typeof rfModOn==="function"&&!rfModOn("gra")){
      const pc=document.getElementById("rfPlayCard");
      if(pc&&!pc.querySelector(".tab-btn")){pc.hidden=true;pc.style.display="none";}
      return;
    }
    const lista=document.getElementById("rfNavPlay")||document.getElementById("rfNavMod")||document.querySelector(".rnav-fallback");
    if(!lista||!lista.parentNode||document.getElementById("rfNavGra"))return;
    const box=document.createElement("div");box.className="rnav rnav-gra";box.style.paddingTop="0";
    const a=document.createElement("a");a.id="rfNavGra";a.className="rnav-btn";a.href="/web/gry/";
    a.target="_blank";a.rel="noopener";a.style.textDecoration="none";
    a.title="RibbitBeat: śpiewaj kapslem, padem albo myszą do nut z MIDI, otwiera się w nowej karcie";
    const ic=document.createElement("span");ic.className="rfic";ic.setAttribute("aria-hidden","true");
    ic.style.backgroundImage="var(--ic-arcade)";
    const tx=document.createElement("span");tx.textContent="RibbitBeat";   // nazwa gry (marka), bez tłumaczenia
    // Znak nowej karty (`export.png`, UX 261120): link wygląda jak pozycja nawigacji, a wyprowadza
    // z panelu, więc mówi o tym zanim ktoś kliknie. Tam, gdzie moduły mają kropkę stanu.
    const ext=document.createElement("span");ext.className="rf-nav-ext";ext.setAttribute("aria-hidden","true");
    a.appendChild(ic);a.appendChild(tx);a.appendChild(ext);box.appendChild(a);
    lista.parentNode.insertBefore(box,lista.nextSibling);
  })();
  // "Open in window" — same page in ?view=overview mode (second monitor / phone)
  const ow=document.getElementById("ovWin");
  if(ow)ow.onclick=()=>window.open(location.pathname+"?view=overview","ribbitflip-sciaga","width=1100,height=820");
  renderDeviceSelector(); renderOverview();
  let _startTab="mapowanie"; try{_startTab=localStorage.getItem("ribbitflip.tab")||"mapowanie";}catch{}
  // „Sterowanie ruchem" became two tabs; land anyone who left the app in it on the cursor half
  // rather than silently on Mapowanie (setTab's fallback for an id it no longer knows).
  if(_startTab==="sterowanie")_startTab="mysz";
  setTab(_startTab);       // restore last tab (falls back to Mapowanie if unknown)
  updateTabDots();         // initial dot colours from current group state
  _equalizeLeftTabs();     // give the left (input-group) tabs one shared width
  if(_ctrl&&!_ctrl.children.length)_ctrl.remove();   // drop the now-empty header .ctrl (avoids a doubled flex gap)
}

