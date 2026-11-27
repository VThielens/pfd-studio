// Step 3: give every stroked element the same line weight in drawing units.
// Usage: node normsw.js iso-symbols.js ../../js/iso-symbols.js
const { chromium } = require('playwright');
const fs = require('fs');
const SRC = process.argv[2], DST = process.argv[3];
(async () => {
  const txt = fs.readFileSync(SRC, 'utf8');
  const i = txt.indexOf('window.PFD_ISO');
  const header = txt.slice(0, i);
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.setContent('<svg id="s" xmlns="http://www.w3.org/2000/svg" width="400" height="400"></svg>');
  await p.addScriptTag({ content: txt });
  const res = await p.evaluate(() => {
    const host = document.getElementById('s');
    host.innerHTML = '<defs>' + window.PFD_ISO.defs + '</defs>';
    const stats = { n: 0, skipped: 0, w: {} };
    for (const s of window.PFD_ISO.symbols) {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      host.appendChild(g);
      g.innerHTML = s.svg;
      const inv = g.getCTM().inverse();
      g.querySelectorAll('path,rect,circle,ellipse,line,polyline,polygon').forEach((el) => {
        const cs = getComputedStyle(el);
        if (cs.stroke === 'none' || el.closest('defs')) return;
        const sw = parseFloat(cs.strokeWidth);
        if (!(sw > 0.05)) { stats.skipped++; return; }
        const m = inv.multiply(el.getCTM());
        const eff = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
        const F = Math.round(1e4 / eff) / 1e4;
        const before = Math.round(sw * eff * 100) / 100;
        stats.w[before] = (stats.w[before] || 0) + 1;
        el.style.setProperty('stroke-width', 'calc(var(--sym-sw, 1.5px) * ' + F + ' / var(--s, 1))');
        el.style.removeProperty('vector-effect');
        stats.n++;
      });
      s.svg = g.innerHTML;
      g.remove();
    }
    return { json: JSON.stringify(window.PFD_ISO), stats };
  });
  console.log('normalised', res.stats.n, 'skipped', res.stats.skipped, 'world widths before', JSON.stringify(res.stats.w));
  fs.writeFileSync(DST, header.replace(' */', ' * Stroke widths are normalised so all symbols share one line weight (CSS variable --sym-sw).\n */') + 'window.PFD_ISO = ' + res.json + ';\n');
  await b.close();
})();
