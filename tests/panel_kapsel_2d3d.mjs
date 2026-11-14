/* PANEL: grafika kapsla (pigułka w lewym górnym rogu) = skin kapsla w podglądzie 3D (2026-11-20).
   Uruchomienie: instancja testowa aplikacji na 8790
     py ribbitflip_monitor.py --simulate --no-keys --no-open --no-tray --allow-multi --port 8790
   potem
     node tests/panel_kapsel_2d3d.mjs
   W symulacji serwer nie zapisuje meta kapsli, więc zmiana wyglądu niczego nie zostawia. */
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
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
const glbs = [];
page.on('request', r => { if (/\.glb$/.test(r.url())) glbs.push(r.url().replace(/^.*\/kapsel\//, '')); });
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await sleep(3500);

// 1. każda grafika 1–8 ma skin i plik GLB, a pliki grafik istnieją
const pliki = await page.evaluate(async () => {
  const out = {};
  for (const id of Object.keys(CAP_IMG)) {
    const sk = CAP_SKIN[id];
    const st = async u => (await fetch(u, { method: 'HEAD' })).status;
    out[id] = { sk, img: await st(CAP_IMG[id]), hi: await st(CAP_IMG_HI[id]), glb: sk ? await st('/web/assets/kapsel/skiny/' + sk + '.glb') : 0 };
  }
  return out;
});
chk('grafiki 1–9, każda ze skinem 3D i plikami', Object.keys(pliki).length === 9 &&
  Object.values(pliki).every(p => p.sk && p.img === 200 && p.hi === 200 && p.glb === 200), pliki);

// 2. Kapsel w podglądzie, wybór wyglądu zmienia grafikę kapsla i skin 3D
const r = await page.evaluate(async () => {
  setPoseBall('kapsel');
  const dev = kapselViewDev(), D = state.devices[dev];
  const sel = document.getElementById('poseSkin');
  const przed = { cap: D.meta.cap, sel: sel.value, hidden: sel.hidden };
  const cel = D.meta.cap === '6' ? '2' : '6';
  sel.value = cel; sel.dispatchEvent(new Event('change'));
  await new Promise(q => setTimeout(q, 2500));
  const pill = [...document.querySelectorAll('[style*="/web/assets/caps/"]')].map(e => e.getAttribute('style').match(/caps\/(\d)-/)[1]);
  return { dev, przed, cel, cap: D.meta.cap, skin: kapselSkinOf(dev), st: KAPSEL3D.state, pill };
});
chk('lista wyglądu widoczna przy „Kapsel” i pokazuje grafikę kapsla', !r.przed.hidden && r.przed.sel === String(r.przed.cap), r);
chk('zmiana wyglądu ustawia grafikę kapsla (meta.cap)', r.cap === r.cel, r);
chk('pigułka pokazuje nową grafikę', r.pill.includes(r.cel), r);
chk('podgląd 3D rysuje skin tej grafiki', r.skin === (r.cel === '6' ? 'irokez' : 'zaba') && r.st === 'ready', r);
chk('ściągnięty GLB tego skinu', glbs.includes('skiny/' + r.skin + '.glb'), glbs);

// 3. grafika zmieniona gdzie indziej (np. drugie okno) — lista idzie za nią
const r3 = await page.evaluate(async () => {
  const D = state.devices[kapselViewDev()]; D.meta.cap = '8';
  await new Promise(q => setTimeout(q, 600));
  return { sel: document.getElementById('poseSkin').value, skin: kapselSkinOf(kapselViewDev()) };
});
chk('lista nadąża za grafiką zmienioną poza nią', r3.sel === '8' && r3.skin === 'strzalki_cmyk', r3);

// 4. okno edycji kapsla: rząd grafik, Anuluj nic nie zmienia, Zapisz ustawia grafikę (i skin 3D)
const r4 = await page.evaluate(async () => {
  const dev = kapselViewDev(), D = state.devices[dev], w = ms => new Promise(q => setTimeout(q, ms));
  D.meta.cap = '3'; renderDeviceSelector();
  openDeviceEditor(dev); await w(300);
  const ov = document.getElementById('devEdit'), cv = () => ov.querySelector('.de-caphead-cap');
  const btns = [...ov.querySelectorAll('.de-capskin')];
  const start = { n: btns.length, on: btns.filter(b => b.getAttribute('aria-checked') === 'true').map(b => b.dataset.cap) };
  btns.find(b => b.dataset.cap === '5').click();
  await w(2500);   // model skinu Piorun ściąga się przy pierwszym rysowaniu
  const c = cv(), px = c.getContext('2d').getImageData(c.width / 2, c.height / 2, 1, 1).data;
  const podglad = { tag: c.tagName, img: c.dataset.img, bg: c.style.backgroundImage, alfa: px[3], st: KAPSEL3D.state };
  document.getElementById('deCancel').click(); await w(300);
  const poAnuluj = D.meta.cap;
  openDeviceEditor(dev); await w(300);
  const b2 = [...ov.querySelectorAll('.de-capskin')];
  await w(300);
  b2.find(b => b.dataset.cap === '3').focus();
  b2.find(b => b.dataset.cap === '3').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  const klaw = { cap: [...ov.querySelectorAll('.de-capskin[aria-checked="true"]')].map(b => b.dataset.cap), fokus: document.activeElement.dataset.cap };
  await w(200);
  return { start, podglad, poAnuluj, klaw };
});
chk('edytor: 9 grafik, zaznaczona grafika kapsla', r4.start.n === 9 && r4.start.on.join() === '3', r4);
chk('edytor: duży kapsel to podgląd 3D wybranej grafiki', r4.podglad.tag === 'CANVAS' && /caps\/5-256\.png/.test(r4.podglad.img) &&
  r4.podglad.bg === 'none' && r4.podglad.alfa > 0 && r4.podglad.st === 'ready', r4);
chk('edytor: Anuluj nie zmienia grafiki', r4.poAnuluj === '3', r4);
chk('edytor: strzałka w prawo przechodzi do następnej grafiki', r4.klaw.cap.join() === '4' && r4.klaw.fokus === '4', r4);
await page.screenshot({ path: 'C:/tmp/rf-caps2d/test_edytor.png' });
const r5 = await page.evaluate(async () => {
  const dev = kapselViewDev(), D = state.devices[dev];
  const sent = []; const of = window.fetch;
  window.fetch = (u, o) => { if (/\/device\?dev=/.test(u)) sent.push(JSON.parse(o.body)); return of(u, o); };
  try { document.getElementById('deSave').click(); await new Promise(q => setTimeout(q, 800)); } finally { window.fetch = of; }
  const pill = [...document.querySelectorAll('[style*="/web/assets/caps/"]')].map(e => e.getAttribute('style').match(/caps\/(\d)-/)[1]);
  return { cap: D.meta.cap, sent, pill, skin: kapselSkinOf(dev), sel: document.getElementById('poseSkin').value };
});
chk('edytor: Zapisz wysyła i ustawia grafikę', r5.cap === '4' && r5.sent.some(b => b.cap === '4'), r5);
chk('edytor: pigułka, lista i skin 3D idą za zapisem', r5.pill.includes('4') && r5.skin === 'czaszka' && r5.sel === '4', r5);

await page.screenshot({ path: 'C:/tmp/rf-caps2d/test_panel.png' });
const real = errs.filter(e => !/Failed to load resource|net::ERR/.test(e));
chk('konsola bez błędów', real.length === 0, real.slice(0, 5));
await br.close();
console.log(`\n${ok} passed, ${bad} failed`);
