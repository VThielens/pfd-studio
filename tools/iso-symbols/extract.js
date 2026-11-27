// Step 1: extract the symbols from the ISO 10628-2:2012 sheets (S. B. Sandoval, Wikimedia Commons, CC BY-SA 4.0).
// Usage: node extract.js [sheets-dir]   -> writes iso.json in the current directory
const path = require('path');
const SHEETS = path.resolve(process.argv[2] || path.join(__dirname, 'sheets'));
const { chromium } = require('playwright');
const fs = require('fs');
const S = 2.5; // mm -> unités de l'application

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1200 } });
  const all = { symbols: [], groups: {}, defs: '' };
  const defsSeen = new Set();
  for (const n of [1, 2, 3, 4, 5, 6, 7]) {
    await p.goto('file://' + path.join(SHEETS, `ISO_10628-2_2012_Symbols_Sheet_${n}.svg`));
    const res = await p.evaluate(({ n, S }) => {
      const svg = document.documentElement;
      const rootInv = svg.getCTM().inverse();
      const rel = (el) => rootInv.multiply(el.getCTM());
      const tp = (m, x, y) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f });
      const bboxOf = (el) => {
        let bb; try { bb = el.getBBox(); } catch (e) { return null; }
        const m = rel(el);
        const pts = [tp(m, bb.x, bb.y), tp(m, bb.x + bb.width, bb.y), tp(m, bb.x, bb.y + bb.height), tp(m, bb.x + bb.width, bb.y + bb.height)];
        const xs = pts.map(q => q.x), ys = pts.map(q => q.y);
        return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
      };
      const inDefs = (el) => !!el.closest('defs, marker, pattern, metadata, title');
      // Régions des groupes (contours pointillés) et titres
      const titles = [];
      for (const t of svg.querySelectorAll('text')) {
        const m = /GROUP\s+(\d+)\s*—\s*(.+)/i.exec(t.textContent.replace(/\s+/g, ' '));
        if (m) { const bb = bboxOf(t); titles.push({ num: +m[1], name: m[2].trim(), cx: (bb.x0 + bb.x1) / 2, cy: (bb.y0 + bb.y1) / 2 }); }
      }
      // Régions : remplissage à partir des titres, bornées par les traits pointillés noirs
      const GW = 842 * 2, GH = 595 * 2;
      const grid = new Int16Array(GW * GH);
      const mark = (x, y) => { const i = Math.round(x * 2), j = Math.round(y * 2); for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) { const ii = i + a, jj = j + c; if (ii >= 0 && jj >= 0 && ii < GW && jj < GH) grid[jj * GW + ii] = -1; } };
      for (const el of svg.querySelectorAll('path, rect, polygon, line, polyline')) {
        if (inDefs(el)) continue;
        const cs = getComputedStyle(el);
        if (!cs.strokeDasharray || cs.strokeDasharray === 'none') continue;
        if (cs.stroke !== 'rgb(0, 0, 0)') continue;
        const bb = bboxOf(el);
        if (!bb || Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0) < 60) continue;
        const m = rel(el);
        const L = el.getTotalLength();
        const sc = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
        for (let t = 0; t <= L; t += 0.2 / sc) { const q = el.getPointAtLength(t); const w = tp(m, q.x, q.y); mark(w.x, w.y); }
      }
      titles.forEach((t, k) => {
        const id = k + 1;
        const st = [[Math.round(t.cx * 2), Math.round(t.cy * 2)]];
        while (st.length) {
          const [i, j] = st.pop();
          if (i < 0 || j < 0 || i >= GW || j >= GH) continue;
          const v = grid[j * GW + i];
          if (v !== 0) continue;
          grid[j * GW + i] = id;
          st.push([i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]);
        }
      });
      const regionAt = (x, y) => {
        const i = Math.round(x * 2), j = Math.round(y * 2);
        if (i < 0 || j < 0 || i >= GW || j >= GH) return null;
        const v = grid[j * GW + i];
        return v > 0 ? { title: titles[v - 1] } : null;
      };
      const regions = [];
      // Textes REG/DESC
      const regs = [];
      for (const t of svg.querySelectorAll('text')) {
        const tx = t.textContent;
        if (!/REG#/.test(tx)) continue;
        const full = tx.replace(/\s+/g, ' ');
        const mm = /REG#:?\s*([A-Z]*\d+)\s*:?\s*DESC:\s*(.*)$/.exec(full);
        if (!mm) continue;
        let reg = mm[1], desc = mm[2].replace(/^REG#:\S+:\s*/, '').trim();
        const bb = bboxOf(t);
        const r = regionAt(bb.x0, bb.y0 + 2);
        if (!r || !r.title) continue;
        regs.push({ reg, desc: desc.replace(/\s+/g, ' '), x: bb.x0, y: bb.y0, group: r.title, region: r, el: t });
      }
      // Éléments graphiques candidats
      const cands = [];
      for (const el of svg.querySelectorAll('path, rect, circle, ellipse, line, polyline, polygon, text, use')) {
        if (inDefs(el)) continue;
        if (el.tagName === 'text' && (/REG#|GROUP/.test(el.textContent) || !el.textContent.trim())) continue;
        if (el.closest('text') && el.tagName !== 'text') continue;
        const bb = bboxOf(el);
        if (!bb) continue;
        if ((bb.x1 - bb.x0) > 90 || (bb.y1 - bb.y0) > 90) continue;
        const r = regionAt((bb.x0 + bb.x1) / 2, (bb.y0 + bb.y1) / 2);
        if (!r || !r.title) continue;
        cands.push({ el, bb });
      }
      // Regroupement par proximité
      const G = 4.2;
      const parent = cands.map((_, i) => i);
      const find = (i) => parent[i] === i ? i : (parent[i] = find(parent[i]));
      for (let i = 0; i < cands.length; i++) for (let j = i + 1; j < cands.length; j++) {
        const a = cands[i].bb, c = cands[j].bb;
        if (a.x0 - G <= c.x1 && c.x0 - G <= a.x1 && a.y0 - G <= c.y1 && c.y0 - G <= a.y1) parent[find(i)] = find(j);
      }
      const clusters = {};
      cands.forEach((c, i) => { (clusters[find(i)] = clusters[find(i)] || []).push(c); });
      // Attribution des grappes aux textes REG
      const byReg = new Map();
      for (const cl of Object.values(clusters)) {
        const bb = { x0: Math.min(...cl.map(c => c.bb.x0)), y0: Math.min(...cl.map(c => c.bb.y0)), x1: Math.max(...cl.map(c => c.bb.x1)), y1: Math.max(...cl.map(c => c.bb.y1)) };
        let best = null, bs = Infinity;
        for (const r of regs) {
          const dx = r.x - bb.x1;
          if (dx < -1 || dx > 55) continue;
          const dy = r.y + 2 < bb.y0 ? bb.y0 - r.y - 2 : (r.y + 2 > bb.y1 ? r.y + 2 - bb.y1 : 0);
          const sc = dy * 3 + dx * 0.2;
          if (sc < bs) { bs = sc; best = r; }
        }
        if (best && bs < 60) { if (!byReg.has(best)) byReg.set(best, []); byReg.get(best).push(...cl); }
      }
      const defsUsed = new Set();
      const out = [];
      for (const r of regs) {
        const items = byReg.get(r) || [];
        if (!items.length) { out.push({ reg: r.reg, desc: r.desc, group: r.group.num, groupName: r.group.name, empty: true }); continue; }
        // Talons de connexion
        const info = items.map(c => {
          const el = c.el;
          const cs = getComputedStyle(el);
          const m = rel(el);
          const sw = parseFloat(cs.strokeWidth) * Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
          const w = c.bb.x1 - c.bb.x0, h = c.bb.y1 - c.bb.y0;
          let straight = false;
          if ((el.tagName === 'path' || el.tagName === 'line') && (w < 0.15 || h < 0.15)) {
            const len = el.getTotalLength ? el.getTotalLength() * Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) : 0;
            straight = Math.abs(len - Math.max(w, h)) < 0.3;
          }
          const dashed = cs.strokeDasharray && cs.strokeDasharray !== 'none';
          const isStub = straight && !dashed && sw <= 0.3 && Math.max(w, h) >= 2.5 && Math.max(w, h) <= 8 && cs.markerEnd === 'none' && cs.markerStart === 'none';
          return Object.assign({}, c, { isStub, horiz: h < 0.15 });
        });
        let body = info.filter(c => !c.isStub);
        if (!body.length) body = info;
        let bb = { x0: Math.min(...body.map(c => c.bb.x0)), y0: Math.min(...body.map(c => c.bb.y0)), x1: Math.max(...body.map(c => c.bb.x1)), y1: Math.max(...body.map(c => c.bb.y1)) };
        // un talon à l'intérieur du corps fait partie du dessin
        const stubs = [];
        for (const c of info) {
          if (!c.isStub || body.includes(c)) continue;
          const t = 0.3;
          const inside = c.bb.x0 > bb.x0 + t && c.bb.x1 < bb.x1 - t && c.bb.y0 > bb.y0 + t && c.bb.y1 < bb.y1 - t;
          if (inside) { body.push(c); continue; }
          stubs.push(c);
        }
        bb = { x0: Math.min(...body.map(c => c.bb.x0)), y0: Math.min(...body.map(c => c.bb.y0)), x1: Math.max(...body.map(c => c.bb.x1)), y1: Math.max(...body.map(c => c.bb.y1)) };
        if (bb.x1 - bb.x0 < 0.5) { bb.x0 -= 1; bb.x1 += 1; }
        if (bb.y1 - bb.y0 < 0.5) { bb.y0 -= 1; bb.y1 += 1; }
        const ports = [];
        for (const s of stubs) {
          const cx = (s.bb.x0 + s.bb.x1) / 2, cy = (s.bb.y0 + s.bb.y1) / 2;
          let x, y, dir;
          if (s.horiz) {
            y = Math.min(Math.max(cy, bb.y0), bb.y1);
            if (cx < (bb.x0 + bb.x1) / 2) { x = bb.x0; dir = 'l'; } else { x = bb.x1; dir = 'r'; }
          } else {
            x = Math.min(Math.max(cx, bb.x0), bb.x1);
            if (cy < (bb.y0 + bb.y1) / 2) { y = bb.y0; dir = 'u'; } else { y = bb.y1; dir = 'd'; }
          }
          // Pour les talons dans l'axe d'une ligne (tuyauteries), garder l'extrémité du corps
          ports.push([Math.round((x - bb.x0) * S * 10) / 10, Math.round((y - bb.y0) * S * 10) / 10, dir]);
        }
        // Markup
        let markup = '';
        for (const c of body.sort((a, b) => cands.indexOf(a) - cands.indexOf(b))) {
          const el = c.el;
          const m = rel(el);
          const cl = el.cloneNode(true);
          cl.removeAttribute('transform');
          for (const e of [cl, ...cl.querySelectorAll('*')]) {
            for (const a of [...e.attributes]) {
              if (a.name === 'id' || a.name.includes(':') && a.name !== 'xlink:href' && a.name !== 'xml:space') e.removeAttribute(a.name);
            }
            let st = e.getAttribute('style') || '';
            st = st.replace(/-inkscape-[^;]+;?/g, '').replace(/font-family:[^;]+/g, 'font-family:Arial,sans-serif')
              .replace(/stroke:#000000/g, 'stroke:var(--ink,#111)').replace(/fill:#000000/g, 'fill:var(--ink,#111)')
              .replace(/stroke:black/g, 'stroke:var(--ink,#111)').replace(/fill:black/g, 'fill:var(--ink,#111)');
            st = st.replace(/url\(#([^)]+)\)/g, (_, id) => { defsUsed.add(id); return `url(#iso${n}_${id})`; });
            if (st) e.setAttribute('style', st);
            for (const at of ['fill', 'stroke', 'marker-end', 'marker-start', 'marker-mid']) {
              const v = e.getAttribute(at);
              if (v && /url\(#/.test(v)) e.setAttribute(at, v.replace(/url\(#([^)]+)\)/g, (_, id) => { defsUsed.add(id); return `url(#iso${n}_${id})`; }));
            }
          }
          const r3 = (v) => Math.round(v * 10000) / 10000;
          markup += `<g transform="matrix(${r3(m.a)},${r3(m.b)},${r3(m.c)},${r3(m.d)},${r3(m.e)},${r3(m.f)})">${cl.outerHTML}</g>`;
        }
        markup = markup.replace(/ xmlns="http:\/\/www.w3.org\/2000\/svg"/g, '').replace(/\s+/g, ' ');
        const r1 = (v) => Math.round(v * 1000) / 1000;
        const w = Math.round((bb.x1 - bb.x0) * S * 10) / 10, h = Math.round((bb.y1 - bb.y0) * S * 10) / 10;
        out.push({
          reg: r.reg, desc: r.desc, group: r.group.num, groupName: r.group.name,
          w, h, ports,
          svg: `<g transform="scale(${S}) translate(${r1(-bb.x0)},${r1(-bb.y0)})">${markup}</g>`
        });
      }
      // defs utilisés (avec chaînes href)
      const defs = [];
      const queue = [...defsUsed], done = new Set();
      while (queue.length) {
        const id = queue.shift();
        if (done.has(id)) continue;
        done.add(id);
        const d = svg.getElementById(id);
        if (!d) continue;
        const cl = d.cloneNode(true);
        for (const e of [cl, ...cl.querySelectorAll('*')]) {
          if (e.id) e.id = `iso${n}_${e.id}`;
          for (const a of [...e.attributes]) if (a.name.includes(':') && a.name !== 'xlink:href') e.removeAttribute(a.name);
          const href = e.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || e.getAttribute('href');
          if (href && href[0] === '#') { queue.push(href.slice(1)); e.removeAttributeNS('http://www.w3.org/1999/xlink', 'href'); e.setAttribute('href', `#iso${n}_${href.slice(1)}`); }
          let st = e.getAttribute('style') || '';
          st = st.replace(/url\(#([^)]+)\)/g, (_, id2) => { queue.push(id2); return `url(#iso${n}_${id2})`; });
          if (st) e.setAttribute('style', st);
        }
        defs.push(cl.outerHTML.replace(/ xmlns="http:\/\/www.w3.org\/2000\/svg"/g, '').replace(/\s+/g, ' '));
      }
      return { out, defs, titles: titles.map(t => [t.num, t.name]) };
    }, { n, S });
    for (const t of res.titles) all.groups[t[0]] = t[1];
    for (const s of res.out) { s.sheet = n; all.symbols.push(s); }
    all.defs += res.defs.join('');
    console.log('sheet', n, res.out.length, 'empty', res.out.filter(s => s.empty).map(s => s.reg).join(','));
  }
  fs.writeFileSync('iso.json', JSON.stringify(all, null, 1));
  await b.close();
})();
