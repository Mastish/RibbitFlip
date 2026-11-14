/* PANEL: drobne poprawki przed 1.0.0 (D1, D3, W2-W8, A9, C-06).
   Uruchomienie: instancja testowa aplikacji na 8790
     py ribbitflip_monitor.py --simulate --no-keys --no-open --no-tray --allow-multi --port 8790
   potem
     node tests/panel_drobne_harness.mjs
   Zapisy na serwer (sejf, Synth, presety) są przechwytywane w stronie, więc test niczego nie zapisuje. */
import { createRequire } from 'module';
import path from 'path';
const req = createRequire(import.meta.url);
const { rfBezPierwszegoStartu } = req("./_rf_pierwszy_start.cjs");   // bez pytania i zaproszenia pierwszego startu
const { chromium } = req(path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@playwright', 'test'));
const URL = process.env.RF_URL || 'http://127.0.0.1:8790/';
let ok = 0, bad = 0; const errs = [];
const chk = (n, c, x) => { if (c) { ok++; console.log('  OK   ' + n); } else { bad++; console.log('  ZLE  ' + n + (x !== undefined ? '  -> ' + JSON.stringify(x) : '')); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const br = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await rfBezPierwszegoStartu(br.newContext({ viewport: { width: 1600, height: 1000 } }));
// C-06: /health z fałszywym stanem ustawień; reszta odpowiedzi prawdziwa.
await ctx.route('**/health', async route => {
  const r = await route.fetch(); const j = await r.json();
  j.settingsWritable = false; j.settingsDir = 'C:\\Program Files\\RibbitFlip\\Settings';
  j.settingsCorrupt = [{ file: 'ribbitflip_rules.json', copy: 'ribbitflip_rules.json.uszkodzony-1' }];
  await route.fulfill({ response: r, json: j });
});
// WebGL: łapiemy konteksty, żeby móc zasymulować ich utratę.
await ctx.addInitScript(() => {
  window.__gls = [];
  const g = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (t, o) { const c = g.call(this, t, o); if (c && /webgl/.test(t)) window.__gls.push(c); return c; };
});
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await sleep(3500);

// C-06
const toasts = await page.evaluate(() => document.body.innerText);
chk('C-06: ostrzeżenie o braku zapisu', /Nie mogę zapisywać ustawień w C:\\Program Files\\RibbitFlip\\Settings/.test(toasts) || /cannot save settings/.test(toasts));
chk('C-06: informacja o uszkodzonym pliku', /ribbitflip_rules\.json\.uszkodzony-1/.test(toasts));
await page.reload({ waitUntil: 'domcontentloaded' }); await sleep(3000);
const t2 = await page.evaluate(() => document.body.innerText);
chk('C-06: po przeładowaniu bez powtórki', !/Nie mogę zapisywać ustawień/.test(t2));

// D3
const d3 = await page.evaluate(async () => {
  const ex = document.getElementById('setupExe'); if (!ex) return 'brak pola';
  ex.value = 'gra.exe';
  _gsLoaded = true; _gsState.supported = true; _gsState.enabled = true; _gsExeHint();
  await new Promise(r => setTimeout(r, 300));
  const h = document.getElementById('setupExeGs');
  const on = h.getAttribute('data-rftip') || h.title;
  _gsState.enabled = false; _gsExeHint();
  await new Promise(r => setTimeout(r, 300));
  return { on, off: h.getAttribute('data-rftip'), desc: h.getAttribute('aria-describedby'), txt: h.textContent };
});
chk('D3: włączone ma dymek', d3 && /włączone|is on/.test(d3.on || ''), d3);
chk('D3: wyłączone bez starego dymka', d3 && !d3.off && !d3.desc && /wyłączone|is off/.test(d3.txt), d3);

// W2
const w2 = await page.evaluate(() => ({ g: rfSetupGuardGroups({ config: { rules: [], scan: { boards: [] } } }), n: _rfgGroupName('scan'), m: _RFG_MODS.some(m => m.g === 'scan' && m.tab === 'skaner') }));
chk('W2: sekcja scan w grupach, nazwie i modułach', w2.g.includes('scan') && !!w2.n && w2.m, w2);

// W6
const w6 = await page.evaluate(async () => {
  const of = window.fetch;
  window.fetch = (u, o) => (String(u) === '/setups') ? Promise.resolve(new Response(JSON.stringify({ setups: ['Przed Half-Life Alyx', 'przed exo one'] }))) : of(u, o);
  try { return [await _rfgFreeName('Przed Half-Life: Alyx'), await _rfgFreeName('Przed Exo One'), await _rfgFreeName('Nowa')]; }
  finally { window.fetch = of; }
});
chk('W6: wolna nazwa po obróbce serwera i bez wielkości liter', w6[0] === 'Przed Half-Life Alyx (2)' && w6[1] === 'Przed Exo One (2)' && w6[2] === 'Nowa', w6);

// W7
const w7 = await page.evaluate(async () => {
  const seen = []; const of = window.fetch;
  window.fetch = (u, o) => { if (String(u) === '/synth') { seen.push({ ka: !!(o && o.keepalive), n: (o && o.body || '').length }); return Promise.resolve(new Response('{"ok":true}')); } return of(u, o); };
  try {
    const small = { pads: [{ id: 'p1' }] };
    const big = { pads: [{ id: 'p1' }], customSounds: { x: { blob: 'a'.repeat(70000) } } };
    const p = padAdoptState(small); const isP = p && typeof p.then === 'function'; await p;
    await padAdoptState(big);
    return { isP, seen };
  } finally { window.fetch = of; }
});
chk('W7: obietnica, keepalive tylko dla małej treści', w7.isP && w7.seen.length === 2 && w7.seen[0].ka === true && w7.seen[1].ka === false, w7);

// W3
const w3 = await page.evaluate(async () => {
  const of = window.fetch; let posts = 0;
  const other = { v: 1, iter: 1000, salt: 'c2FsdA==', iv: 'aXZpdml2aXZpdml2', data: 'ZGF0YQ==' };
  window.fetch = (u, o) => {
    if (String(u).startsWith('/rest/vault')) {
      if (o && o.method === 'POST') { posts++; return Promise.resolve(new Response('{"ok":true}')); }
      return Promise.resolve(new Response(JSON.stringify({ ok: true, vault: other })));
    }
    return of(u, o);
  };
  try {
    let err = '';
    try { await _RaVault.create('haslo-testowe-123'); } catch (e) { err = e.message; }
    return { err, posts, state: _RaVault.state() };
  } finally { window.fetch = of; }
});
chk('W3: założenie sejfu odmawia, gdy inne okno już go założyło', w3.err === 'exists' && w3.posts === 0, w3);
const w3b = await page.evaluate(async () => {
  // Sejf założony tu (serwer pusty), potem inne okno zmienia plik: zapis musi odmówić.
  const of = window.fetch; let posts = 0, server = null;
  window.fetch = (u, o) => {
    if (String(u).startsWith('/rest/vault')) {
      if (o && o.method === 'POST') { posts++; server = JSON.parse(o.body).vault; return Promise.resolve(new Response('{"ok":true}')); }
      return Promise.resolve(new Response(JSON.stringify({ ok: true, vault: server })));
    }
    return of(u, o);
  };
  try {
    await _RaVault.create('haslo-testowe-123');
    const after = posts;
    server = Object.assign({}, server, { iv: 'aW5uZW9rbm8xMjM0', data: 'aW5uZQ==' });   // inne okno zapisało
    _RaVault.add();
    await _RaVault.flush();
    return { created: after, posts, state: _RaVault.state(), ready: _RaVault.ready() };
  } finally { window.fetch = of; try { _RaVault.lockNow(); } catch (e) {} }
});
chk('W3: zapis odmawia przy nowszym sejfie z innego okna i blokuje kartę', w3b.created === 1 && w3b.posts === 1 && w3b.state === 'locked' && !w3b.ready, w3b);

// W4: dwa okna w jednym profilu = wspólny localStorage
const page2 = await ctx.newPage();
page2.on('pageerror', e => errs.push('pageerror(2): ' + e.message));
await page2.goto(URL, { waitUntil: 'domcontentloaded' }); await sleep(3000);
const s1 = await page.evaluate(() => _ra4IsSender()), s2 = await page2.evaluate(() => _ra4IsSender());
const o2 = await page2.evaluate(() => _ra4OtherSends());
chk('W4: dokładnie jedno okno wysyła', s1 !== s2 && (s1 || s2), { s1, s2, o2 });
await page2.close(); await sleep(4800);
const s1b = await page.evaluate(() => _ra4IsSender());
chk('W4: po zamknięciu drugiego okna pierwsze jest nadawcą', s1b === true);

// W5: zdarzenie gameswitch z `pad` i `backup`
const w5 = await page.evaluate(async () => {
  const got = []; const orig = padAdoptState;
  padAdoptState = function (b) { got.push(b); return Promise.resolve(); };
  const inp = document.createElement('input'); inp.style.cssText = 'position:fixed;top:0;left:0;z-index:99999';
  document.body.appendChild(inp); inp.focus();
  try {
    onGameSwitch({ exe: 'gra.exe', applied: { name: 'Zestaw testowy', kind: 'setup' }, matches: [], pad: { pads: [{ id: 'p' }] }, backup: 'Przed Zestaw testowy', dev: 'd1' });
    await new Promise(r => setTimeout(r, 700));
    const btn = [...document.querySelectorAll('button')].find(b => /Cofnij|Undo/.test(b.textContent) && b.offsetParent !== null);
    return { pads: got.length, undo: !!btn, txt: /Przed Zestaw testowy/.test(document.body.innerText), focus: document.activeElement === inp };
  } finally { padAdoptState = orig; inp.remove(); }
});
chk('W5: sekcja pad z gry idzie przez padAdoptState', w5.pads === 1, w5);
chk('W5: dymek z Cofnij i nazwą kopii (bez przeładowania)', w5.undo && w5.txt, w5);
// …a gdy panel się przeładowuje, propozycja przeżywa przeładowanie
const nav = page.waitForNavigation({ timeout: 8000 }).catch(() => null);
await page.evaluate(() => { document.activeElement && document.activeElement.blur();
  padAdoptState = function (b) { sessionStorage.setItem('t.pad', '1'); return Promise.resolve(); };
  onGameSwitch({ exe: 'gra.exe', applied: { name: 'Zestaw testowy', kind: 'setup' }, matches: [], pad: { pads: [{ id: 'p' }] }, backup: { name: 'Przed Zestaw testowy', dev: 'd1' } }); });
await nav; await sleep(3500);
const w5r = await page.evaluate(() => ({ pad: sessionStorage.getItem('t.pad'), txt: /Przed Zestaw testowy/.test(document.body.innerText),
  undo: [...document.querySelectorAll('button')].some(b => /Cofnij|Undo/.test(b.textContent) && b.offsetParent !== null),
  left: localStorage.getItem('ribbitflip.gs.undo') }));
chk('W5: po przeładowaniu dymek z Cofnij, wpis zabrany', w5r.pad === '1' && w5r.txt && w5r.undo && !w5r.left, w5r);
const w5b = await page.evaluate(async () => {
  const got = []; const orig = padAdoptState;
  padAdoptState = function (b) { got.push(b); return Promise.resolve(); };
  const inp = document.createElement('input'); inp.style.cssText = 'position:fixed;top:0;left:0;z-index:99999';
  document.body.appendChild(inp); inp.focus();
  try { onGameSwitch({ exe: 'gra.exe', applied: { name: 'Nie ma takiego', kind: 'setup' }, matches: [] });
    await new Promise(r => setTimeout(r, 800)); return { pads: got.length };
  } finally { padAdoptState = orig; inp.remove(); }
});
chk('W5: bez pól pad/backup działa (brak błędu)', w5b.pads === 0, w5b);

// W8
const w8 = await page.evaluate(async () => {
  const of = window.fetch; let saved = 0;
  window.fetch = (u, o) => { if (o && o.method === 'POST' && /preset|profile\/save|pose/.test(String(u))) { saved++; return Promise.resolve(new Response('{"ok":true}')); } return of(u, o); };
  try {
    _rflKind = 'profile'; _rflData.profile = [{ name: 'Istniejący' }]; _rflRenderTools();
    const host = document.getElementById('libSave'); if (!host) return 'brak libSave';
    host.querySelector('input').value = 'istniejący';
    host.querySelector('button').click();
    await new Promise(r => setTimeout(r, 400));
    const dlg = document.querySelector('.rfm-backdrop');
    const txt = dlg ? dlg.innerText : '';
    const cancel = dlg && [...dlg.querySelectorAll('button')].find(b => /Anuluj|Cancel/.test(b.textContent));
    if (cancel) cancel.click();
    await new Promise(r => setTimeout(r, 300));
    return { dlg: !!dlg, ask: /Nadpisać preset/.test(txt), saved };
  } finally { window.fetch = of; }
});
chk('W8: zajęta nazwa presetu pyta i po Anuluj nie zapisuje', w8.dlg && w8.ask && w8.saved === 0, w8);

// D1
const d1 = await page.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = c.height = 200; const x = c.getContext('2d');
  const C = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const drawN = async (n) => { let r = false; for (let i = 0; i < n; i++) { r = KAPSEL3D.draw(x, 100, 100, 80, C, 1); await new Promise(q => setTimeout(q, 100)); } return r; };
  await drawN(30);
  const s0 = KAPSEL3D.state;
  const gl = window.__gls[window.__gls.length - 1];
  const ext = gl && gl.getExtension('WEBGL_lose_context');
  if (!ext) return { s0, noExt: true };
  ext.loseContext(); await new Promise(q => setTimeout(q, 200));
  const rLost = KAPSEL3D.draw(x, 100, 100, 80, C, 1); const sLost = KAPSEL3D.state;
  ext.restoreContext(); await new Promise(q => setTimeout(q, 300));
  const rBack = await drawN(30);
  return { s0, sLost, rLost, sBack: KAPSEL3D.state, rBack };
});
chk('D1: po utracie kontekstu stan lost i rysuje kulę', d1.s0 === 'ready' && d1.sLost === 'lost' && d1.rLost === false, d1);
chk('D1: po przywróceniu wraca do ready', d1.sBack === 'ready' && d1.rBack === true, d1);

// A9
const a9 = await page.evaluate(async () => {
  setLang('en'); await new Promise(r => setTimeout(r, 600));
  const en = document.body.innerHTML.includes('Windows does not pass the hotkey on');
  setLang('pl'); await new Promise(r => setTimeout(r, 600));
  const pl = document.body.innerHTML.includes('Windows nie przekazuje skrótu');
  return { en, pl };
});
chk('A9: zdanie w poradniku PL i EN', a9.en && a9.pl, a9);

const real = errs.filter(e => !/Failed to load resource|net::ERR/.test(e));
chk('konsola bez błędów', real.length === 0, real.slice(0, 5));
await br.close();
console.log(`\n${ok} passed, ${bad} failed`);
