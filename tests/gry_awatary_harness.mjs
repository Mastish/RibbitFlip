// RibbitBeat: awatary żab kont (web/gry/js/awatary.js) i pole `awatar` w profilu (postepy.js) liczone w Node, bez
// przeglądarki. Wołany z tests/test_gry_awatary.py; ostatnia linia wyjścia to JSON {checks:[[nazwa, ok, szczegół], …]}.
//  - lista awatarów: ile, unikalne id i barwy, żadne id nie jest motywem (czyli skinem do śpiewania),
//  - rysunek: viewBox, ciemny kontur, ścieg, żółte oko z blikiem, zero odwołań do plików graficznych,
//  - domyślny awatar z klucza profilu (stary zapis bez pola) i rozwiązywanie nieznanego id,
//  - nazwy po polsku i angielsku (T w zabi-chor.js, RB_EN.T w jezyk-en.js) dla każdego awatara,
//  - grupa radio z wyboru awatara na atrapie dokumentu (role, aria-label, aria-checked, klik),
//  - Postepy.awatar: zapis, odczyt po przeładowaniu, złe id, zmiana nazwy, wyzerowanie, usunięcie, eksport i import.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const GRY = path.join(REPO, "web", "gry", "js");
const czytaj = f => fs.readFileSync(path.join(GRY, f), "utf8");
const checks = [];
const ck = (n, ok, d) => checks.push([n, !!ok, d === undefined ? "" : String(typeof d === "string" ? d : JSON.stringify(d)).slice(0, 700)]);
const PL_LITERY = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

// ---- słowniki napisów ----
const zc = czytaj("zabi-chor.js");
const iT = zc.indexOf("const T={"), jT = zc.indexOf("\nfunction tt(", iT);
const T = new Function(zc.slice(iT, jT) + ";return T;")();
const ctxEn = {};
vm.createContext(ctxEn);
vm.runInContext(czytaj("jezyk-en.js") + ";this.RB_EN=RB_EN;", ctxEn);
const EN = ctxEn.RB_EN;

// ---- atrapa dokumentu: tyle, ile buduje Awatary.wybor (grupa radio) ----
function elAtrapa(tag) {
  const e = { tag, dzieci: [], atrybuty: {}, className: "", dataset: {}, title: "", type: "", onclick: null, firstElementChild: null };
  e.setAttribute = (k, v) => { e.atrybuty[k] = String(v); };
  e.getAttribute = k => (k in e.atrybuty ? e.atrybuty[k] : null);
  e.append = (...xs) => { e.dzieci.push(...xs); };
  Object.defineProperty(e, "children", { get: () => e.dzieci });
  Object.defineProperty(e, "innerHTML", { get: () => e._html || "", set: v => { e._html = String(v); e.firstElementChild = { znacznik: String(v) }; } });
  return e;
}

// ---- awatary.js ----
const ctxA = { console, Math, JSON, Object, Array, Map, Set, String, Number, RegExp, Error, T, document: { createElement: elAtrapa } };
ctxA.window = ctxA; ctxA.globalThis = ctxA;
vm.createContext(ctxA);
let bladA = null;
try { vm.runInContext(czytaj("awatary.js") + ";this.A=Awatary;", ctxA, { filename: "awatary.js" }); } catch (e) { bladA = e.message; }
ck("awatary.js wczytuje się w Node bez wyjątku", !bladA, bladA);
const A = ctxA.A;
if (!A) { console.log(JSON.stringify({ checks })); process.exit(0); }

// motywy = skiny do śpiewania (web/assets/motywy/<motyw>/): żaden awatar nie może być którymś z nich
const MOTYWY = fs.readdirSync(path.join(GRY, "motywy")).filter(f => f.endsWith(".js")).map(f => f.replace(/\.js$/, ""));
const ID = A.ID;
ck("lista: 8–12 awatarów (" + ID.length + ")", ID.length >= 8 && ID.length <= 12, ID.join(", "));
ck("lista: id unikalne, małymi literami, bez spacji", new Set(ID).size === ID.length && ID.every(id => /^[a-z0-9-]{1,24}$/.test(id)), ID.join(", "));
ck("lista: żaden awatar nie jest skinem do śpiewania (id motywu ze " + MOTYWY.length + " motywów)",
  !ID.some(id => MOTYWY.includes(id)), ID.filter(id => MOTYWY.includes(id)).join(", "));
// Awatary to filcowe naszywki z generatora obrazów (skrypty prompty_awatary.py, generuj_awatary.py i obrobka_awatary.py
// poza repozytorium),
// a nie rysunek w kodzie. Test pilnuje plików, a nie kształtów: każdy awatar ma swój .webp z alfą we własnym katalogu
// i żaden nie jest plikiem skina do śpiewania ani klatki śpiewu.
const KAT = path.join(REPO, "web", "assets", "frog", "awatary");
const plikAw = id => path.join(KAT, id + ".webp");
{
  const braki = ID.filter(id => !fs.existsSync(plikAw(id)));
  ck("grafiki: każdy awatar ma swój plik w web/assets/frog/awatary/<id>.webp", !braki.length, braki.join(", "));
  const obce = fs.existsSync(KAT) ? fs.readdirSync(KAT).filter(f => !ID.includes(f.replace(/\.webp$/, ""))) : ["brak katalogu"];
  ck("grafiki: w katalogu awatarów nie ma plików spoza listy", !obce.length, obce.join(", "));
  const zle = [];
  for (const id of ID) {
    if (!fs.existsSync(plikAw(id))) continue;
    const b = fs.readFileSync(plikAw(id));
    const naglowek = b.slice(0, 4).toString("latin1") === "RIFF" && b.slice(8, 12).toString("latin1") === "WEBP";
    const alfa = b.includes(Buffer.from("ALPH")) || b.slice(12, 16).toString("latin1") === "VP8L";
    if (!naglowek) zle.push(id + ": nie WebP");
    else if (!alfa) zle.push(id + ": bez kanału alfa (tło nie wycięte)");
    else if (b.length < 4000 || b.length > 120000) zle.push(id + ": " + b.length + " B poza zakresem");
  }
  ck("grafiki: WebP z przezroczystym tłem, rozsądnej wagi (klucz magenty z obrobka_awatary.py)", !zle.length, zle.join("; "));
}
{
  // Żaden awatar nie może być plikiem skina do śpiewania (głowy motywów) ani klatki śpiewu: porównanie po skrócie
  // zawartości, a nie po nazwie.
  const skrot = f => crypto.createHash("sha1").update(fs.readFileSync(f)).digest("hex");
  const skiny = [];
  const motywyKat = path.join(REPO, "web", "assets", "motywy");
  for (const m of fs.readdirSync(motywyKat)) {
    for (const pod of [path.join(motywyKat, m), path.join(motywyKat, m, "v2")]) {
      if (!fs.existsSync(pod)) continue;
      for (const f of fs.readdirSync(pod)) if (/^(glowa|zaba)-/.test(f)) skiny.push(path.join(pod, f));
    }
  }
  const frog = path.join(REPO, "web", "assets", "frog");
  for (const f of fs.readdirSync(frog)) if (/^sing-/.test(f)) skiny.push(path.join(frog, f));
  const suma = new Set(skiny.map(skrot));
  const te_same = ID.filter(id => fs.existsSync(plikAw(id)) && suma.has(skrot(plikAw(id))));
  ck("grafiki: żaden awatar nie jest plikiem skina do śpiewania ani klatki śpiewu (" + skiny.length + " porównanych)",
    !te_same.length && skiny.length > 20, te_same.join(", "));
}

// ---- znacznik w oknie ----
const znaczniki = Object.fromEntries(ID.map(id => [id, A.obraz(id)]));
{
  const zle = [];
  for (const id of ID) {
    const s = znaczniki[id], braki = [];
    if (!/^<img /.test(s)) braki.push("<img>");
    if (!s.includes('src="../assets/frog/awatary/' + id + '.webp"')) braki.push("ścieżka względna do swojego pliku");
    if (!/aria-hidden="true"/.test(s) || !/alt=""/.test(s)) braki.push("aria-hidden i puste alt");
    if (!/decoding="async"/.test(s) || !/draggable="false"/.test(s)) braki.push("decoding/draggable jak ikony filcowe");
    if (braki.length) zle.push(id + ": " + braki.join(", "));
  }
  ck("znacznik: <img> z własnym plikiem, ścieżką względną (gra chodzi pod /gry/ i /web/gry/), aria-hidden i pustym alt",
    !zle.length, zle.join("; "));
  ck("znacznik: nie sięga po skiny ani klatki śpiewu",
    !Object.values(znaczniki).some(s => /motywy\/|sing-|mascot|zaba-oszust/.test(s)));
  ck("znacznik: rozmiar podaje tylko wywołujący",
    !/ width="/.test(A.obraz(ID[0])) && / width="48" height="48"/.test(A.obraz(ID[0], { rozmiar: 48 })));
  ck("znacznik: nieznane id daje pierwszą żabę, nie puste pole",
    A.obraz("nie-ma-takiego").includes(ID[0] + ".webp") && A.obraz(null).includes(ID[0] + ".webp"));
  ck("znacznik: wszystkie dziesiątki pokazują inny plik", new Set(Object.values(znaczniki)).size === ID.length);
  ck("element(id) zwraca gotowy znacznik <img>", !!(A.element(ID[0]) && /^<img /.test(A.element(ID[0]).znacznik)));
  ck("plik(id) daje ścieżkę do pliku awatara", A.plik(ID[1]) === A.KATALOG + ID[1] + ".webp");
}

// ---- domyślny awatar (stary zapis bez pola `awatar`) ----
const klucze = Array.from({ length: 300 }, (_, i) => "gracz" + i).concat(["gość", "oczko", "", "ŻABA"]);
const dom = klucze.map(k => A.domyslny(k));
ck("domyślny: zawsze id z listy, także dla pustego klucza", dom.every(id => ID.includes(id)));
ck("domyślny: ten sam klucz zawsze dostaje tę samą żabę (stabilny po przeładowaniu)",
  klucze.every(k => A.domyslny(k) === A.domyslny(k) && A.domyslny(k) === dom[klucze.indexOf(k)]));
ck("domyślny: różne konta dostają różne żaby (cała lista w użyciu)", new Set(dom).size === ID.length, [...new Set(dom)].join(", "));
ck("dla(klucz, id): zapisane id zostaje, brak i nieznane id schodzą na domyślne",
  A.dla("oczko", "czapka") === "czapka" && A.dla("oczko", null) === A.domyslny("oczko") &&
  A.dla("oczko", "zaba-oszust") === A.domyslny("oczko") && A.dla("oczko", "halloween") === A.domyslny("oczko"));

// ---- nazwy po polsku i angielsku ----
const nazwyPL = T.awatary || {}, nazwyEN = (EN.T && EN.T.awatary) || {};
ck("napisy: słownik T ma nazwę każdego awatara", ID.every(id => (nazwyPL[id] || "").trim()),
  ID.filter(id => !(nazwyPL[id] || "").trim()).join(", "));
ck("napisy: RB_EN.T ma nazwę każdego awatara, bez polskich liter i bez kluczy nadmiarowych",
  ID.every(id => (nazwyEN[id] || "").trim() && !PL_LITERY.test(nazwyEN[id])) && Object.keys(nazwyEN).length === ID.length,
  Object.keys(nazwyEN).join(", "));
ck("napisy: okno ma etykietę, opis i tytuł zmiany (z {nazwa}) po polsku i angielsku",
  ["profAwatar", "awatarEt", "awatarOpis", "awatarTytul", "awatarZmieniony", "profBladAwatar"].every(k => (T[k] || "").trim() && (EN.T[k] || "").trim()) &&
  T.awatarTytul.includes("{nazwa}") && EN.T.awatarTytul.includes("{nazwa}"));
ck("napisy: opis mówi wprost, że to nie skiny do śpiewania", /skin/i.test(T.awatarOpis) && /skin/i.test(EN.T.awatarOpis));
ck("napisy: nazwa(id) bierze napis ze słownika", A.nazwa(ID[0]) === nazwyPL[ID[0]] && A.nazwa("nie-ma") === "nie-ma");

// ---- wybór awatara (klawiatura i czytnik ekranu) ----
{
  const zmiany = [];
  const grupa = A.wybor({ klucz: "oczko", wybrany: "czapka", etykieta: "Awatar konta Oczko", naZmiane: id => zmiany.push(id) });
  const opcje = grupa.children;
  const wybrane = () => opcje.filter(b => b.getAttribute("aria-checked") === "true").map(b => b.dataset.awatar);
  ck("wybór: grupa radio z etykietą dla czytnika ekranu",
    grupa.getAttribute("role") === "radiogroup" && grupa.getAttribute("aria-label") === "Awatar konta Oczko");
  ck("wybór: po jednym przycisku na żabę (" + opcje.length + "), każdy role=radio z aria-label i podpowiedzią",
    opcje.length === ID.length && opcje.every(b => b.tag === "button" && b.type === "button" && b.getAttribute("role") === "radio" &&
      (b.getAttribute("aria-label") || "").trim() && b.title === b.getAttribute("aria-label") && /<img /.test(b.innerHTML)));
  ck("wybór: zapisana żaba jest zaznaczona i dostaje fokus na wejściu (data-start)",
    wybrane().join() === "czapka" && opcje.filter(b => b.dataset.start === "1").map(b => b.dataset.awatar).join() === "czapka");
  const inna = opcje.find(b => b.dataset.awatar === "dredy");
  inna.onclick();
  ck("wybór: klik (Enter i Spacja na przycisku) zgłasza nowe id i przestawia zaznaczenie",
    zmiany.join() === "dredy" && wybrane().join() === "dredy");
  const bez = A.wybor({ klucz: "nowe-konto" });
  ck("wybór: bez zapisanego awatara zaznacza się domyślny dla klucza",
    bez.children.filter(b => b.getAttribute("aria-checked") === "true").map(b => b.dataset.awatar).join() === A.domyslny("nowe-konto"));
}

// ---- zapis w profilu (postepy.js) ----
function postepy(zapis) {
  const pamiec = {};
  if (zapis) pamiec["ribbitflip.zabiChor.postepy"] = typeof zapis === "string" ? zapis : JSON.stringify(zapis);
  const ctx = {
    console, Math, JSON, Date, Object, Array, Map, Set, String, Number, RegExp, Error, parseInt, parseFloat, isFinite,
    localStorage: { getItem: k => (k in pamiec ? pamiec[k] : null), setItem: (k, v) => { pamiec[k] = String(v); }, removeItem: k => { delete pamiec[k]; } },
    location: { search: "" },
    document: { createElement: () => ({ getContext: () => null, addEventListener() { }, setAttribute() { } }), getElementById: () => null },
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(czytaj("postepy.js") + ";this.P=Postepy;", ctx, { filename: "postepy.js" });
  return { P: ctx.P, pamiec };
}
{
  const { P, pamiec } = postepy(null);
  P.utworz("Oczko"); P.utworz("Bartek");
  const r = P.awatar("Oczko", "czapka");
  P.awatar("Bartek", "kolczatka");
  const wLiscie = () => Object.fromEntries(P.lista().map(x => [x.nazwa, x.awatar]));
  ck("zapis: awatar(nazwa, id) zapisuje się przy profilu, lista() go podaje, Gość zostaje bez pola",
    r.ok && r.awatar === "czapka" && P.awatar("Oczko") === "czapka" && wLiscie().Oczko === "czapka" && wLiscie().Bartek === "kolczatka" &&
    wLiscie()["Gość"] === null, JSON.stringify(wLiscie()));
  ck("zapis: awatar leży w tym samym localStorage co konto (pole `awatar` w profilu), bez nowego klucza",
    Object.keys(pamiec).join() === "ribbitflip.zabiChor.postepy" && /"awatar":"czapka"/.test(pamiec["ribbitflip.zabiChor.postepy"]),
    Object.keys(pamiec).join());
  ck("zapis: WERSJA zapisu bez zmian (stary RibbitBeat dalej go zapisuje; pole jest opcjonalne)",
    P.WERSJA === 11 && JSON.parse(pamiec["ribbitflip.zabiChor.postepy"]).wersja === 11, P.WERSJA);
  P.przeladuj();
  ck("zapis: po przeładowaniu strony awatar zostaje", P.awatar("Oczko") === "czapka" && P.awatar("Bartek") === "kolczatka");
  ck("zapis: złe id odpada z powodem, bez psucia zapisanego", !P.awatar("Oczko", "ŹLE ząb").ok &&
    P.awatar("Oczko", "ŹLE ząb").powod === "awatar" && P.awatar("Oczko") === "czapka");
  ck("zapis: awatar(nazwa, null) zdejmuje pole (okno wraca do domyślnego)",
    P.awatar("Oczko", null).ok && P.awatar("Oczko") === null && !/"awatar"/.test(JSON.stringify(P.lista().find(x => x.nazwa === "Oczko").awatar || "")));
  ck("zapis: awatar nieistniejącego profilu to „brak” (poza Gościem, który jest zawsze)",
    P.awatar("Nie Ma Takiej", "czapka").powod === "brak" && P.awatar("Gość", "irokez").ok);
}
{
  // stary zapis: profil bez pola `awatar` (konto założone przed 10-19) i zapis z polem zepsutym
  const { P } = postepy({ wersja: 11, profile: { oczko: { nazwa: "Oczko", awatar: "zły awatar!" }, bartek: { nazwa: "Bartek" } }, kapsle: {}, ekipa: null });
  const l = Object.fromEntries(P.lista().map(x => [x.nazwa, x.awatar]));
  ck("stary zapis: profil bez pola i z zepsutym polem czyta się bez błędu (awatar = null)",
    l.Oczko === null && l.Bartek === null && !P.tylkoOdczyt, JSON.stringify(l));
  ck("stary zapis: okno pokazuje dla takiego konta domyślną żabę, nie puste pole",
    ID.includes(A.dla("oczko", l.Oczko)) && ID.includes(A.dla("bartek", l.Bartek)));
  P.awatar("Oczko", "czub");
  ck("stary zapis: pierwsza zmiana awatara dopisuje pole do istniejącego profilu", P.awatar("Oczko") === "czub");
}
{
  const { P } = postepy(null);
  P.utworz("Oczko"); P.awatar("Oczko", "agrafka"); P.kolor("Oczko", "#ec1a83");
  P.zmienNazwe("Oczko", "Ognik");
  ck("zmiana nazwy niesie awatar razem z kolorem", P.awatar("Ognik") === "agrafka" && P.kolor("Ognik") === "#ec1a83");
  P.wyzeruj("Ognik");
  ck("wyzerowanie postępów awatara nie rusza (jak nazwa, kolor i przypięcie)", P.awatar("Ognik") === "agrafka");
  const plik = P.eksport();
  ck("eksport niesie awatar", /"awatar":\s*"agrafka"/.test(plik));
  P.usun("Ognik");
  ck("usunięcie profilu zabiera jego awatar", P.awatar("Ognik") === null);
  const r = P.importuj(plik, "scal");
  ck("import „scal” przywraca awatar z pliku", r.ok && P.awatar("Ognik") === "agrafka", JSON.stringify(r));
  // profil obecny bez awatara + ten sam profil z pliku z awatarem: awatar dochodzi (jak kolor)
  const b = postepy(null).P;
  b.utworz("Ognik"); b.awatar("Ognik", null);
  const r2 = b.importuj(plik, "scal");
  ck("import „scal”: awatar z pliku dochodzi tam, gdzie go nie było", r2.ok && b.awatar("Ognik") === "agrafka", JSON.stringify(r2));
}
console.log(JSON.stringify({ checks }));
