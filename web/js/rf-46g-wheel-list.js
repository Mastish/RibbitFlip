"use strict";
// ------------------------------------------------------------------------------------------
//  SPIS WYCINKÓW KOŁA W KOLUMNIE KAPSLA (ściąga / nakładka)
// ------------------------------------------------------------------------------------------
// PO CO TO JEST. Ściąga jest spisem tego, co WYSYŁA każdy kapsel — i koła w tym spisie nie było,
// choć każdy kapsel ma swoje własne, osobno skonfigurowane. Rysunek koła pojawiał się tam wyłącznie
// na te sekundy, kiedy koło jest otwarte, więc ekran, który ma odpowiadać „co ten kapsel potrafi",
// odpowiadał tylko połowicznie: reguły widać zawsze, wycinki nigdy.
//
// SKĄD BIERZE SIĘ KONFIGURACJA. Karta ustawień pobiera `/wheel?dev=` wyłącznie dla kapsla, który
// jest edytowany — a tu rysujemy wszystkie naraz. Dlatego serwer rozgłasza `wheel_cfg` per kapsel
// (RadialMenu._emit_cfg + migawka przy otwarciu strumienia), a rf-08 kładzie go na `D.wheelCfg`.
//
// CZEGO TU NIE MA. Edycji. Spis mówi CO jest na kole i JAK się je otwiera; wycinki zmienia się
// w zakładce „Koło wyboru" i to jest jedyne miejsce, w którym się je zmienia.

// Etykieta trybu ze wspólnej tablicy WHEEL_MODES — jedno źródło z kartą koła, żeby te same pięć
// sposobów nie nazywało się w dwóch miejscach inaczej.
function _whListMode(m) {
  const row = WHEEL_MODES.find(x => x[0] === m) || WHEEL_MODES[0];
  return (typeof _gl === "function") ? _gl(row[1], row[2]) : row[1];
}

// SPIS WYCINKÓW jako plakietki. Tylko PIERWSZY poziom: podmenu ma tu być zapowiedziane, a nie
// rozwinięte — spis, który rośnie z każdą gałęzią, przestaje być spisem.
function wheelSliceChips(slices, cls) {
  const e = (typeof esc === "function") ? esc : (s => String(s));
  return (Array.isArray(slices) ? slices : []).map(s => {
    const kids = !!(s.children && s.children.length);
    const empty = (typeof whIsEmptySlice === "function") ? whIsEmptySlice(s) : false;
    const name = String(s.label || "").trim()
      || (empty ? _wheelT("puste pole", "empty slot") : _wheelT("bez nazwy", "unnamed"));
    return `<span class="${cls}${empty ? " is-empty" : ""}${kids ? " has-sub" : ""}">`
      + (s.icon ? `<i aria-hidden="true">${e(s.icon)}</i>` : "")
      + e(name)
      // Wycinek z podmenu nie wysyła — jest drzwiami. Strzałka mówi to bez zdania obok.
      + (kids ? `<b aria-hidden="true">›</b>` : "")
      + `</span>`;
  }).join("");
}

// Kod HTML wstawiany przez renderOverview (rf-11) do kolumny kapsla, tuż nad listą reguł.
function wheelColumnHtml(dev) {
  const D = state.devices[dev];
  const W = (D && D.wheelCfg) || null;
  const sl = (W && Array.isArray(W.slices)) ? W.slices : [];
  // MNIEJ NIŻ DWA WYCINKI TO NIE JEST KOŁO (lustro RadialMenu.MIN_SLICES). Kapsel, na którym nikt
  // koła nie tknął, nie dostaje w kolumnie spisu funkcji, której nie używa.
  if (sl.length < 2) return "";
  const e = (typeof esc === "function") ? esc : (s => String(s));
  // Wyłączone koło ZOSTAJE w spisie, tylko przygaszone: „jest, ale zgaszone" to inna odpowiedź niż
  // „nie ma go wcale", a ściąga czyta się w biegu i musi je rozróżniać.
  return `<div class="ov-whlist${W.enabled ? "" : " is-off"}">`
    + `<div class="ov-whlist-h"><b>${e(_wheelT("Koło wyboru", "Selection wheel"))}</b>`
    + `<span>${e(_whListMode(W.confirm))}</span>`
    + (W.enabled ? "" : `<i>${e(_wheelT("wyłączone", "switched off"))}</i>`)
    + `</div><div class="ov-whlist-b">${wheelSliceChips(sl, "ov-whsl")}</div></div>`;
}

// ------------------------------------------------------------------------------------------
//  RYSUNEK SPOCZYNKOWY — koło stoi w kolumnie także wtedy, gdy nikt go nie otworzył
// ------------------------------------------------------------------------------------------
// PO CO TO JEST. Kolumna kapsla to zestaw obrazków, które stoją w niej ZAWSZE i mówią wprost, że
// czekają: kula orientacji pisze „brak orientacji", kontroler „czeka", pasek naciśnięć rysuje
// pustą oś. Koło było jedynym modułem widocznym wyłącznie przez te dwie sekundy, w których ktoś
// trzyma je otwarte — więc na pytanie „czy ten kapsel ma koło i jak ono wygląda" ściąga nie
// odpowiadała wcale, mimo że moduł jest włączony. Spis plakietek wyżej mówi to SŁOWAMI; to jest
// ten sam spis jako KSZTAŁT, czyli w postaci, w jakiej zobaczy go ręka w grze.
//
// PAKIET JEST ZŁOŻONY Z SAMEJ KONFIGURACJI, dokładnie tak jak scena w karcie (whPreviewState
// w rf-46d): rysunek dostaje to, co normalnie przysyła silnik, więc nie powstaje tu drugie
// rysowanie do utrzymania. Nie ma w nim wskazania ani odliczania — spoczynkowe koło nie może
// udawać, że coś się właśnie dzieje (patrz `idle` w środku koła, rf-46 _whHubHtml).
function wheelIdleState(D) {
  const W = (D && D.wheelCfg) || null;
  const sl = (W && Array.isArray(W.slices)) ? W.slices : [];
  // TEN SAM PRÓG, CO SPIS (wheelColumnHtml): rysunek i spis pojawiają się oraz znikają razem,
  // inaczej kolumna raz mówiłaby „jest koło", a raz „nie ma".
  if (sl.length < WHEEL_MIN_SLICES) return null;
  const items = sl.map(s => ({
    label: s.label || "", icon: s.icon || "", color: _whCol(s.color),
    // PIERWSZY POZIOM I TYLKO ON, tak samo jak w spisie: wycinek z podmenu jest tu ZAPOWIEDZIANY
    // (kropkami przy krawędzi), a nie rozwinięty.
    sub: !!(s.children && s.children.length), back: false, empty: whIsEmptySlice(s)
  }));
  const dz = (+W.deadzone > 0) ? +W.deadzone : WHEEL_DEAD_DEF;
  const look = wheelLook(W.look);
  return {
    open: false, idle: true, idx: -1, n: items.length, mag: 0, ang: 0, dz: dz,
    confirm: W.confirm || "release", cyc: false, cd: 0,
    mode: "replace", crumbs: [], chips: !!W.iconChips, look: look,
    bands: [{ items: items, openIdx: null, full: true, a0: 0, a1: 360 }],
    geom: wheelBandGeom(dz, 1), sel: null,
    // PODPIS STANU dla pętli klatek. Rysunek spoczynkowy nie zmienia się sam z siebie, a pętla
    // chodzi 25 razy na sekundę przy każdym kapslu — przerysowujemy go więc dopiero wtedy, gdy
    // zmieni się konfiguracja albo szerokość kolumny (patrz wheelOverviewFrame w rf-46).
    sig: [dz, W.confirm || "", W.iconChips ? 1 : 0, look.size, look.gapDeg, look.corner].join(",")
      + "|" + items.map(i => i.label + "" + i.icon + i.color + (i.sub ? "s" : "") + (i.empty ? "e" : ""))
        .join("")
  };
}

// Co ze spisu widać na ekranie — i tylko to. Pakiet `wheel_cfg` przychodzi przy KAŻDEJ zmianie
// konfiguracji, także przy ciągnięciu suwaka wielkości koła; przerysowywanie całej ściągi (pięć
// kolumn z rysunkami) przy każdym takim kroku byłoby zauważalne, a nie zmieniałoby ani piksela.
function wheelColSig(W) {
  if (!W || !Array.isArray(W.slices)) return "";
  return [W.enabled ? 1 : 0, W.confirm || ""].concat(W.slices.map(s =>
    [s.label || "", s.icon || "", (s.children && s.children.length) ? 1 : 0,
     (typeof whIsEmptySlice === "function" && whIsEmptySlice(s)) ? 1 : 0].join("")))
    .join("");
}

// Wołane z rf-08 po każdym pakiecie `wheel_cfg`. Ściąga jest przerysowywana tylko wtedy, gdy
// zmieniło się to, co na niej widać (patrz wheelColSig).
function wheelCfgArrived(D, m) {
  if (!D) return;
  const sig = wheelColSig(m);
  const changed = (D._whColSig !== sig);
  D.wheelCfg = m;
  D._whColSig = sig;
  if (changed && typeof renderOverview === "function") renderOverview();
  // …i pas kafli w zakładce koła (rf-46h), bo to JEDYNE miejsce, w którym widać koła kapsli,
  // których nikt teraz nie edytuje. Tanie odświeżenie sprawdza samo, czy jest co przerysować.
  if (typeof wheelCapsSync === "function") wheelCapsSync();
}
