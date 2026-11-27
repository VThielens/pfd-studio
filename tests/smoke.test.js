// Smoke tests for PFD Studio. Run with: npm test   (needs Node 18+ and Playwright's Chromium)
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const APP = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
let browser, page, errors;

before(async () => {
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(APP);
});
after(async () => { await browser.close(); });

test('loads without errors, English by default', async () => {
  assert.equal(await page.inputValue('#lang'), 'en');
  assert.equal((await page.textContent('[data-cmd=new]')).trim(), 'New');
  assert.deepEqual(errors, []);
});

test('ISO 10628-2 library: 29 groups, 295 symbols, names in 3 languages', async () => {
  const r = await page.evaluate(() => ({
    groups: PFD_ISO.groups.length,
    symbols: PFD_ISO.symbols.length,
    named: PFD_ISO.symbols.every((s) => s.names.en && s.names.fr && s.names.nl)
  }));
  assert.equal(r.groups, 29);
  assert.equal(r.symbols, 295);
  assert.ok(r.named);
});

test('search by ISO registration number', async () => {
  await page.fill('#search', '2322');
  const visible = await page.$$eval('.tile', (t) => t.filter((x) => x.offsetParent).map((x) => x.dataset.sym));
  assert.ok(visible.includes('iso_2322'));
  await page.fill('#search', '');
});

test('lines stay attached to ports when a shape moves', async () => {
  const r = await page.evaluate(() => {
    const v = PFD.addShape('iso_2062', 200, 200);
    const p = PFD.addShape('iso_2322', 400, 300);
    const vessel = PFD.doc.shapes[PFD.doc.shapes.length - 2], pump = PFD.doc.shapes[PFD.doc.shapes.length - 1];
    const c = PFD.addConn({ shape: vessel.id, port: 'p1' }, { shape: pump.id, port: 'p2' });
    PFD.render();
    const before = PFD.connPoints(c).slice(-1)[0];
    pump.x += 100; pump.y += 40; PFD.render();
    const afterPt = PFD.connPoints(c).slice(-1)[0];
    return { dx: afterPt.x - before.x, dy: afterPt.y - before.y };
  });
  assert.ok(Math.abs(r.dx - 100) < 0.01 && Math.abs(r.dy - 40) < 0.01, JSON.stringify(r));
});

test('language switch to French and Dutch', async () => {
  await page.selectOption('#lang', 'fr');
  assert.equal((await page.textContent('[data-cmd=new]')).trim(), 'Nouveau');
  await page.selectOption('#lang', 'nl');
  assert.equal((await page.textContent('[data-cmd=new]')).trim(), 'Nieuw');
  await page.selectOption('#lang', 'en');
});

test('all symbols share one stroke width', async () => {
  const widths = await page.evaluate(() => {
    PFD.doc.shapes.length = 0; PFD.doc.conns.length = 0;
    let x = 0;
    for (const c of PFD_SYMBOLS.CATEGORIES) if (!c.hidden) for (const s of c.symbols) { PFD.addShape(s.id, x, 0); x += 120; }
    PFD.doc.shapes[1].s = 2; PFD.render();
    const vp = document.getElementById('viewport'), out = new Set();
    document.querySelectorAll('#layerShapes .sym').forEach((g) => g.querySelectorAll('path,rect,circle,ellipse,line,polyline,polygon').forEach((el) => {
      const cs = getComputedStyle(el); if (cs.stroke === 'none') return;
      const sw = parseFloat(cs.strokeWidth); if (!(sw > 0.05)) return; // a few hairline guides on the sheets are intentionally invisible
      const m = vp.getCTM().inverse().multiply(el.getCTM());
      out.add(Math.round(sw * Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) * 100) / 100);
    }));
    return [...out];
  });
  assert.deepEqual(widths, [1.5]);
});

test('SVG export embeds ISO definitions', async () => {
  const svg = await page.evaluate(() => PFD.buildExportSVG().svg);
  assert.ok(svg.startsWith('<?xml'));
  assert.ok(svg.includes('<defs>'));
  assert.deepEqual(errors, []);
});
