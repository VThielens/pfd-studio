/*
 * PFD Studio ISO 10628 - éditeur de schémas de procédé, 100 % local.
 * Aucune dépendance externe : ouvrir index.html dans Chrome, Edge ou Firefox.
 */
(function () {
  'use strict';

  const { CATEGORIES, SYMBOLS, autoDir, ISO_DEFS } = window.PFD_SYMBOLS;
  const I18N = window.I18N;
  const _t = I18N.t;
  const symName = (d) => I18N.name(d);
  const $ = (s) => document.querySelector(s);
  const svg = $('#svg');
  const vpEl = $('#viewport');
  const L = { frame: $('#layerFrame'), conns: $('#layerConns'), shapes: $('#layerShapes'), texts: $('#layerTexts'), over: $('#layerOverlay') };
  const propsEl = $('#props');
  const stage = $('#stage');

  // ------------------------------------------------------------------
  // Constantes
  const LINE_KINDS = {
    process:   { label: 'kind.process', w: 2.2, dash: '' },
    secondary: { label: 'kind.secondary', w: 1.4, dash: '' },
    dashdot:   { label: 'kind.dashdot', w: 1.4, dash: '12 3 2 3' },
    utility:   { label: 'kind.utility', w: 1.1, dash: '' },
    signal:    { label: 'kind.signal', w: 1, dash: '7 4' },
    electric:  { label: 'kind.electric', w: 1, dash: '3 3' },
    pneumatic: { label: 'kind.pneumatic', w: 1, dash: '', ticks: true },
    data:      { label: 'kind.data', w: 1.4, dash: '0.1 4', cap: 'round' }
  };
  const ARROW_KEYS = ['end', 'start', 'both', 'mid', 'none'];
  const arrowOpts = () => Object.fromEntries(ARROW_KEYS.map((k) => [k, _t('arrow.' + k)]));
  const DIRV = { l: [-1, 0], r: [1, 0], u: [0, -1], d: [0, 1] };
  const dirName = (d) => _t('dir.' + d);
  const MM = 2.5; // unités de dessin par millimètre (échelle des symboles ISO)
  const STUB = 16;
  const AUTOSAVE_KEY = 'pfd-iso10628-autosave';
  const PAGES = {
    'A4 landscape': [297, 210], 'A4 portrait': [210, 297],
    'A3 landscape': [420, 297], 'A3 portrait': [297, 420],
    'A2 landscape': [594, 420], 'A1 landscape': [841, 594]
  };
  const FALLBACK = { id: '?', name: 'Symbole inconnu', w: 40, h: 40, svg: '<rect width="40" height="40"/><text class="t" x="20" y="24">?</text>', ports: [] };

  // ------------------------------------------------------------------
  // État
  let doc = newDoc();
  const view = { x: 60, y: 40, k: 1 };
  let sel = new Set();
  let tool = 'select';
  let selPort = null;           // {shape, port} en mode ports
  let drag = null;
  let spaceDown = false;
  let clipboard = null;
  let pasteCount = 0;
  let fileHandle = null;
  let fileName = '';
  let dirty = false;
  let defKind = 'process';
  let defArrow = 'end';
  let lastPointer = { x: 0, y: 0 };
  let lastDown = null;
  let undoStack = [], redoStack = [], lastSnap = JSON.stringify(doc);

  function newDoc() {
    return {
      app: 'pfd-iso10628', version: 1, nextId: 1,
      shapes: [], conns: [], texts: [],
      settings: { grid: 10, snap: true, showGrid: true, page: 'A3 landscape', frame: false },
      meta: { title: '', dwg: '', rev: '', author: '', checker: '', date: '', company: '', project: '' }, seq: {}
    };
  }
  function nid(p) { return p + (doc.nextId++); }

  // ------------------------------------------------------------------
  // Utilitaires
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const r2 = (v) => Math.round(v * 100) / 100;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function snapV(v, g) { g = g || doc.settings.grid; return doc.settings.snap ? Math.round(v / g) * g : v; }
  function getShape(id) { return doc.shapes.find((s) => s.id === id); }
  function getConn(id) { return doc.conns.find((c) => c.id === id); }
  function getText(id) { return doc.texts.find((t) => t.id === id); }
  function symOf(sh) { return SYMBOLS[sh.sym] || FALLBACK; }
  function selShapes() { return doc.shapes.filter((s) => sel.has(s.id)); }
  function selConns() { return doc.conns.filter((c) => sel.has(c.id)); }
  function selTexts() { return doc.texts.filter((t) => sel.has(t.id)); }

  let hintTimer = null;
  function hint(msg, ms) {
    const h = $('#hint');
    h.textContent = msg;
    h.classList.add('show');
    clearTimeout(hintTimer);
    if (ms !== 0) hintTimer = setTimeout(() => h.classList.remove('show'), ms || 2200);
  }

  // ------------------------------------------------------------------
  // Géométrie des figures
  function l2w(sh, lx, ly) {
    const d = symOf(sh);
    const x = (lx - d.w / 2) * sh.s * (sh.fx ? -1 : 1);
    const y = (ly - d.h / 2) * sh.s * (sh.fy ? -1 : 1);
    const a = sh.rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return { x: sh.x + x * c - y * s, y: sh.y + x * s + y * c };
  }
  function w2l(sh, wx, wy) {
    const d = symOf(sh);
    const x = wx - sh.x, y = wy - sh.y;
    const a = -sh.rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const rx = x * c - y * s, ry = x * s + y * c;
    return { x: rx / (sh.s * (sh.fx ? -1 : 1)) + d.w / 2, y: ry / (sh.s * (sh.fy ? -1 : 1)) + d.h / 2 };
  }
  function portDirW(sh, p) {
    let [vx, vy] = DIRV[p.dir] || [1, 0];
    if (sh.fx) vx = -vx;
    if (sh.fy) vy = -vy;
    const a = sh.rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const x = vx * c - vy * s, y = vx * s + vy * c;
    return Math.abs(x) >= Math.abs(y) ? [Math.sign(x), 0] : [0, Math.sign(y)];
  }
  function shapeTransform(sh) {
    const d = symOf(sh);
    return 'translate(' + r2(sh.x) + ',' + r2(sh.y) + ') rotate(' + sh.rot + ') scale(' + (sh.s * (sh.fx ? -1 : 1)) + ',' + (sh.s * (sh.fy ? -1 : 1)) + ') translate(' + (-d.w / 2) + ',' + (-d.h / 2) + ')';
  }
  function shapeBBox(sh) {
    const d = symOf(sh);
    const pts = [l2w(sh, 0, 0), l2w(sh, d.w, 0), l2w(sh, 0, d.h), l2w(sh, d.w, d.h)];
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  }
  function tagPos(sh) {
    if (symOf(sh).tagInside) return { x: sh.x, y: sh.y };
    const b = shapeBBox(sh);
    return { x: sh.x + (sh.tdx || 0), y: b.y1 + 14 + (sh.tdy || 0) };
  }
  function textBBox(t) {
    const lines = String(t.text || ' ').split('\n');
    const w = Math.max(...lines.map((l) => l.length), 1) * t.size * 0.56;
    return { x0: t.x, y0: t.y, x1: t.x + w, y1: t.y + lines.length * t.size * 1.25 };
  }
  function nearestPort(sh, w) {
    let best = null, bd = Infinity;
    for (const p of sh.ports) {
      const pw = l2w(sh, p.x, p.y);
      const dd = dist(pw, w);
      if (dd < bd) { bd = dd; best = p; }
    }
    return best;
  }

  // ------------------------------------------------------------------
  // Routage des lignes
  function endPos(end) {
    if (end && end.shape) {
      const sh = getShape(end.shape);
      const p = sh && sh.ports.find((q) => q.id === end.port);
      if (sh && p) return { p: l2w(sh, p.x, p.y), d: portDirW(sh, p), attached: true };
    }
    return { p: { x: end ? end.x || 0 : 0, y: end ? end.y || 0 : 0 }, d: null, attached: false };
  }
  function unit(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy);
    return l < 1e-6 ? null : [dx / l, dy / l];
  }
  function orthoSeg(p, pd, q, qd) {
    const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
    const cands = [
      [q],
      [{ x: q.x, y: p.y }, q],
      [{ x: p.x, y: q.y }, q],
      [{ x: mx, y: p.y }, { x: mx, y: q.y }, q],
      [{ x: p.x, y: my }, { x: q.x, y: my }, q]
    ];
    let best = null, bs = Infinity;
    for (const c of cands) {
      let s = 0, prev = p, prevDir = pd, len = 0, bends = 0, ok = true;
      for (const pt of c) {
        const u = unit(prev, pt);
        if (!u) continue;
        if (Math.abs(u[0]) > 1e-6 && Math.abs(u[1]) > 1e-6) { ok = false; break; } // diagonale
        if (prevDir) {
          const dt = u[0] * prevDir[0] + u[1] * prevDir[1];
          if (dt < -0.5) s += 1000; else if (dt < 0.5) bends++;
        }
        len += dist(prev, pt);
        prevDir = u; prev = pt;
      }
      if (!ok) continue;
      if (qd && prevDir) {
        const dt = prevDir[0] * qd[0] + prevDir[1] * qd[1];
        if (dt < -0.5) s += 1000; else if (dt < 0.5) bends++;
      }
      s += bends * 25 + len * 0.05;
      if (s < bs) { bs = s; best = c; }
    }
    return best || [{ x: q.x, y: p.y }, q];
  }
  function lastDir(pts) {
    for (let i = pts.length - 1; i > 0; i--) {
      const u = unit(pts[i - 1], pts[i]);
      if (u) return u;
    }
    return null;
  }
  function simplify(pts) {
    const out = [];
    for (const p of pts) {
      const last = out[out.length - 1];
      if (last && dist(last, p) < 0.01) { if (p.wp !== undefined) last.wp = p.wp; continue; }
      out.push(p);
    }
    for (let i = out.length - 2; i > 0; i--) {
      if (out[i].wp !== undefined) continue;
      const a = out[i - 1], b = out[i], c = out[i + 1];
      const u = unit(a, b), v = unit(b, c);
      if (u && v && Math.abs(u[0] * v[1] - u[1] * v[0]) < 1e-6 && u[0] * v[0] + u[1] * v[1] > 0) out.splice(i, 1);
    }
    return out;
  }
  function connPoints(c) {
    const A = endPos(c.a), B = endPos(c.b);
    const wps = c.wps || [];
    if (c.route === 'straight') {
      return [Object.assign({}, A.p), ...wps.map((w, i) => ({ x: w.x, y: w.y, wp: i })), Object.assign({}, B.p)];
    }
    const pts = [Object.assign({}, A.p)];
    let cur = A.p, curDir = A.d;
    if (A.d) { cur = { x: A.p.x + A.d[0] * STUB, y: A.p.y + A.d[1] * STUB }; pts.push(cur); }
    wps.forEach((w, i) => {
      const seg = orthoSeg(cur, curDir, w, null).map((p) => ({ x: p.x, y: p.y }));
      seg[seg.length - 1].wp = i;
      pts.push(...seg);
      curDir = lastDir(pts);
      cur = w;
    });
    let endStub = B.p, arrive = null;
    if (B.d) { endStub = { x: B.p.x + B.d[0] * STUB, y: B.p.y + B.d[1] * STUB }; arrive = [-B.d[0], -B.d[1]]; }
    pts.push(...orthoSeg(cur, curDir, endStub, arrive).map((p) => ({ x: p.x, y: p.y })));
    if (B.d) pts.push(Object.assign({}, B.p));
    return simplify(pts);
  }
  function pathD(pts) { return pts.map((p, i) => (i ? 'L' : 'M') + r2(p.x) + ',' + r2(p.y)).join(' '); }
  function arrowHead(tip, u, w, color) {
    const len = 7 + w * 2.2, hw = 2.8 + w * 1.1;
    const bx = tip.x - u[0] * len, by = tip.y - u[1] * len;
    const px = -u[1] * hw, py = u[0] * hw;
    return '<path class="arrow" d="M' + r2(tip.x) + ',' + r2(tip.y) + ' L' + r2(bx + px) + ',' + r2(by + py) + ' L' + r2(bx - px) + ',' + r2(by - py) + ' Z" fill="' + color + '" stroke="none"/>';
  }
  function longestSeg(pts) {
    let bi = 0, bl = -1;
    for (let i = 0; i < pts.length - 1; i++) {
      const l = dist(pts[i], pts[i + 1]);
      if (l > bl) { bl = l; bi = i; }
    }
    return bi;
  }

  // ------------------------------------------------------------------
  // Rendu
  let rafPending = false;
  function requestRender() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => { rafPending = false; render(); });
  }
  function render() {
    L.frame.innerHTML = renderFrame();
    L.conns.innerHTML = renderConns(false);
    L.shapes.innerHTML = renderShapes(false);
    L.texts.innerHTML = renderTexts(false);
    L.over.innerHTML = renderOverlay();
    updateViewport();
    updateStatus();
  }

  function usedPorts() {
    const u = new Set();
    for (const c of doc.conns) {
      if (c.a && c.a.shape) u.add(c.a.shape + '|' + c.a.port);
      if (c.b && c.b.shape) u.add(c.b.shape + '|' + c.b.port);
    }
    return u;
  }

  function renderShapes(exp) {
    const used = exp ? null : usedPorts();
    const pr = 4.2 / view.k;
    let h = '';
    for (const sh of doc.shapes) {
      const d = symOf(sh);
      const tr = shapeTransform(sh);
      const style = (sh.color ? '--ink:' + sh.color + ';' : '') + (sh.fill ? '--fill:' + sh.fill + ';' : '') + (Math.abs(sh.s || 1) !== 1 ? '--s:' + Math.abs(sh.s) + ';' : '');
      h += '<g class="shape' + (!exp && sel.has(sh.id) ? ' sel' : '') + '" data-kind="shape" data-id="' + sh.id + '">';
      if (!exp) h += '<g transform="' + tr + '"><rect class="hit" x="-4" y="-4" width="' + (d.w + 8) + '" height="' + (d.h + 8) + '"/></g>';
      h += '<g class="sym' + (d.iso ? ' iso' : '') + '" data-s="' + sh.s + '" transform="' + tr + '"' + (style ? ' style="' + style + '"' : '') + '>' + d.svg + '</g>';
      if (!exp) {
        const b = shapeBBox(sh);
        h += '<rect class="selbox" x="' + r2(b.x0 - 4) + '" y="' + r2(b.y0 - 4) + '" width="' + r2(b.x1 - b.x0 + 8) + '" height="' + r2(b.y1 - b.y0 + 8) + '"/>';
      }
      if (sh.showTag && sh.tag) {
        const tp = tagPos(sh);
        const col = sh.color ? ' style="fill:' + esc(sh.color) + '"' : '';
        if (d.tagInside) {
          const parts = String(sh.tag).split(/\n| /).filter(Boolean);
          const n = Math.min(parts.length, 2);
          const lines = n <= 1 ? [sh.tag] : [parts[0], parts.slice(1).join(' ')];
          const fs = 10 * Math.min(sh.s, 1.6);
          h += '<text class="tag inside"' + col + ' x="' + r2(tp.x) + '" y="' + r2(tp.y) + '" style="font-size:' + r2(fs) + 'px' + (sh.color ? ';fill:' + esc(sh.color) : '') + '">';
          lines.forEach((ln, i) => {
            const dy = lines.length === 1 ? fs * 0.35 : (i === 0 ? -fs * 0.2 : fs * 1.05);
            h += '<tspan x="' + r2(tp.x) + '" dy="' + r2(dy) + '">' + esc(ln) + '</tspan>';
          });
          h += '</text>';
        } else {
          const lines = String(sh.tag).split('\n');
          h += '<text class="tag" data-kind="tag" data-id="' + sh.id + '"' + col + ' x="' + r2(tp.x) + '" y="' + r2(tp.y) + '">';
          lines.forEach((ln, i) => { h += '<tspan x="' + r2(tp.x) + '" dy="' + (i ? 14 : 0) + '">' + esc(ln) + '</tspan>'; });
          h += '</text>';
        }
      }
      if (!exp) {
        for (const p of sh.ports) {
          const pw = l2w(sh, p.x, p.y);
          const hot = selPort && selPort.shape === sh.id && selPort.port === p.id;
          h += '<circle class="port' + (used.has(sh.id + '|' + p.id) ? ' used' : '') + (hot ? ' hot' : '') + '" data-kind="port" data-id="' + sh.id + '" data-port="' + p.id + '" cx="' + r2(pw.x) + '" cy="' + r2(pw.y) + '" r="' + r2(pr) + '"/>';
        }
      }
      h += '</g>';
    }
    return h;
  }

  function renderFrame() {
    if (!doc.settings.frame) return '';
    const P = pageRect();
    const m = 10 * MM, x0 = m, y0 = m, x1 = P.x1 - m, y1 = P.y1 - m;
    const k = MM;
    const tbW = 180 * k, rowH = 8 * k;
    const tx0 = x1 - tbW, ty0 = y1 - 4 * rowH;
    const M = doc.meta;
    const col = (x, y, w, label, val, big) => '<text x="' + r2(x + 1.5 * k) + '" y="' + r2(y + 2.6 * k) + '" class="tb-l">' + esc(label) + '</text>' +
      '<text x="' + r2(x + 1.5 * k) + '" y="' + r2(y + (big ? 7 : 6.6) * k) + '" class="tb-v' + (big ? ' big' : '') + '">' + esc(val || '') + '</text>';
    let h = '<g class="frame">';
    h += '<rect class="fr-page" x="0" y="0" width="' + r2(P.x1) + '" height="' + r2(P.y1) + '"/>';
    h += '<rect class="fr-border" x="' + r2(x0) + '" y="' + r2(y0) + '" width="' + r2(x1 - x0) + '" height="' + r2(y1 - y0) + '"/>';
    h += '<rect class="fr-tb" x="' + r2(tx0) + '" y="' + r2(ty0) + '" width="' + r2(tbW) + '" height="' + r2(4 * rowH) + '"/>';
    const c1 = tx0 + 110 * k, c2 = tx0 + 140 * k;
    let lines = 'M' + r2(tx0) + ',' + r2(ty0 + rowH) + ' H' + r2(x1) + ' M' + r2(tx0) + ',' + r2(ty0 + 2 * rowH) + ' H' + r2(x1) + ' M' + r2(tx0) + ',' + r2(ty0 + 3 * rowH) + ' H' + r2(x1) +
      ' M' + r2(c1) + ',' + r2(ty0) + ' V' + r2(y1) + ' M' + r2(c2) + ',' + r2(ty0 + 2 * rowH) + ' V' + r2(y1) + ' M' + r2(tx0 + 55 * k) + ',' + r2(ty0 + 3 * rowH) + ' V' + r2(y1);
    h += '<path class="fr-line" d="' + lines + '"/>';
    h += col(tx0, ty0, 110 * k, _t('p.company'), M.company) + col(c1, ty0, 70 * k, _t('p.project'), M.project);
    h += '<text x="' + r2(tx0 + 1.5 * k) + '" y="' + r2(ty0 + rowH + 2.6 * k) + '" class="tb-l">' + esc(_t('tb.title')) + '</text>';
    h += '<text x="' + r2(tx0 + 1.5 * k) + '" y="' + r2(ty0 + 2 * rowH - 1.4 * k) + '" class="tb-v big">' + esc(M.title || '') + '</text>';
    h += col(c1, ty0 + rowH, 70 * k, _t('tb.dwg'), M.dwg);
    h += col(c1, ty0 + 2 * rowH, 30 * k, _t('tb.date'), M.date) + col(c2, ty0 + 2 * rowH, 40 * k, _t('tb.rev'), M.rev);
    h += col(tx0, ty0 + 3 * rowH, 55 * k, _t('tb.by'), M.author) + col(tx0 + 55 * k, ty0 + 3 * rowH, 55 * k, _t('tb.chk'), M.checker);
    h += col(c1, ty0 + 3 * rowH, 30 * k, _t('tb.sheet'), doc.settings.page.split(' ')[0]) + col(c2, ty0 + 3 * rowH, 40 * k, '', _t('tb.std'));
    h += '<text x="' + r2(tx0 + 1.5 * k) + '" y="' + r2(ty0 + 2 * rowH + 2.6 * k) + '" class="tb-l"></text>';
    h += '</g>';
    return h;
  }

  function connMarkup(c, exp, extraClass) {
    const k = LINE_KINDS[c.kind] || LINE_KINDS.process;
    const w = c.width || k.w;
    const color = c.color || '#111111';
    const pts = connPoints(c);
    if (pts.length < 2) return '';
    const arrow = c.arrow || 'none';
    const draw = pts.map((p) => ({ x: p.x, y: p.y }));
    const len = 7 + w * 2.2;
    let heads = '';
    if (arrow === 'end' || arrow === 'both') {
      const n = draw.length;
      const u = unit(draw[n - 2], draw[n - 1]);
      if (u) {
        heads += arrowHead(draw[n - 1], u, w, color);
        if (dist(draw[n - 2], draw[n - 1]) > len) { draw[n - 1] = { x: draw[n - 1].x - u[0] * len * 0.7, y: draw[n - 1].y - u[1] * len * 0.7 }; }
      }
    }
    if (arrow === 'start' || arrow === 'both') {
      const u = unit(draw[1], draw[0]);
      if (u) {
        heads += arrowHead(pts[0], u, w, color);
        if (dist(draw[0], draw[1]) > len) { draw[0] = { x: draw[0].x - u[0] * len * 0.7, y: draw[0].y - u[1] * len * 0.7 }; }
      }
    }
    if (arrow === 'mid') {
      const i = longestSeg(pts);
      const u = unit(pts[i], pts[i + 1]);
      if (u) {
        const m = { x: (pts[i].x + pts[i + 1].x) / 2 + u[0] * len / 2, y: (pts[i].y + pts[i + 1].y) / 2 + u[1] * len / 2 };
        heads += arrowHead(m, u, w, color);
      }
    }
    let ticks = '';
    if (k.ticks) {
      let dd = '';
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1], u = unit(a, b);
        if (!u) continue;
        const l = dist(a, b);
        const px = -u[1], py = u[0];
        const gx = (px + u[0] * 0.7) * 4.5, gy = (py + u[1] * 0.7) * 4.5;
        for (let t = 18; t < l - 10; t += 34) {
          for (const off of [0, 4]) {
            const mx = a.x + u[0] * (t + off), my = a.y + u[1] * (t + off);
            dd += 'M' + r2(mx - gx) + ',' + r2(my - gy) + ' L' + r2(mx + gx) + ',' + r2(my + gy) + ' ';
          }
        }
      }
      if (dd) ticks = '<path class="ticks" d="' + dd + '" fill="none" stroke="' + color + '" stroke-width="' + w + '"/>';
    }
    const d = pathD(draw);
    let h = '<g class="conn' + (extraClass || '') + (!exp && sel.has(c.id) ? ' sel' : '') + '" data-kind="conn" data-id="' + c.id + '">';
    if (!exp) h += '<path class="hitline" d="' + pathD(pts) + '" stroke-width="' + r2(Math.max(8, 12 / view.k)) + '"/>';
    h += '<path class="line" d="' + d + '" stroke="' + esc(color) + '" stroke-width="' + w + '"' +
      (k.dash ? ' stroke-dasharray="' + k.dash + '"' : '') + (k.cap ? ' stroke-linecap="' + k.cap + '"' : '') + '/>';
    h += ticks + heads;
    if (c.label) {
      const i = longestSeg(pts);
      const a = pts[i], b = pts[i + 1];
      const horiz = Math.abs(a.y - b.y) < 1e-6;
      const x = (a.x + b.x) / 2 + (horiz ? 0 : 6) + (c.ldx || 0);
      const y = (a.y + b.y) / 2 + (horiz ? -6 : 4) + (c.ldy || 0);
      h += '<text class="conn-label" data-kind="clabel" data-id="' + c.id + '" x="' + r2(x) + '" y="' + r2(y) + '" text-anchor="' + (horiz ? 'middle' : 'start') + '" style="paint-order:stroke;stroke:#fff;stroke-width:3px;fill:' + esc(color) + '">' + esc(c.label) + '</text>';
    }
    h += '</g>';
    return h;
  }
  function renderConns(exp) {
    return doc.conns.map((c) => connMarkup(c, exp)).join('');
  }
  function renderTexts(exp) {
    let h = '';
    for (const t of doc.texts) {
      const lines = String(t.text || '').split('\n');
      h += '<g class="ftext-g" data-kind="text" data-id="' + t.id + '">';
      if (!exp && sel.has(t.id)) {
        const b = textBBox(t);
        h += '<rect class="ftext-box" x="' + r2(b.x0 - 3) + '" y="' + r2(b.y0 - 2) + '" width="' + r2(b.x1 - b.x0 + 6) + '" height="' + r2(b.y1 - b.y0 + 4) + '"/>';
      }
      h += '<text class="ftext" x="' + r2(t.x) + '" y="' + r2(t.y) + '" style="font-size:' + t.size + 'px;' + (t.bold ? 'font-weight:700;' : '') + (t.color ? 'fill:' + esc(t.color) + ';' : '') + '">';
      lines.forEach((ln, i) => { h += '<tspan x="' + r2(t.x) + '" dy="' + (i ? t.size * 1.25 : t.size) + '">' + (esc(ln) || ' ') + '</tspan>'; });
      h += '</text></g>';
    }
    return h;
  }
  function renderOverlay() {
    const hs = 5 / view.k;
    let h = '';
    const ss = selShapes();
    if (ss.length === 1 && tool === 'select' && !drag) {
      const b = shapeBBox(ss[0]);
      h += '<rect class="handle resize" data-kind="h-resize" data-id="' + ss[0].id + '" x="' + r2(b.x1 + 4 - hs) + '" y="' + r2(b.y1 + 4 - hs) + '" width="' + r2(hs * 2) + '" height="' + r2(hs * 2) + '"/>';
    }
    for (const c of selConns()) {
      if (drag && drag.type === 'end' && drag.conn === c) continue;
      const pts = connPoints(c);
      (c.wps || []).forEach((w, i) => {
        h += '<rect class="handle wp" data-kind="h-wp" data-id="' + c.id + '" data-i="' + i + '" x="' + r2(w.x - hs) + '" y="' + r2(w.y - hs) + '" width="' + r2(hs * 2) + '" height="' + r2(hs * 2) + '" transform="rotate(45 ' + r2(w.x) + ' ' + r2(w.y) + ')"/>';
      });
      [['a', pts[0], c.a], ['b', pts[pts.length - 1], c.b]].forEach(([end, p, e]) => {
        h += '<circle class="handle end' + (e && e.shape ? '' : ' free') + '" data-kind="h-end" data-id="' + c.id + '" data-end="' + end + '" cx="' + r2(p.x) + '" cy="' + r2(p.y) + '" r="' + r2(hs * 1.1) + '"/>';
      });
    }
    if (drag && drag.type === 'draft' && drag.tmp) {
      h += '<g style="opacity:.65;pointer-events:none">' + connMarkup(drag.tmp, true, ' draft-line') + '</g>';
    }
    if (drag && drag.type === 'rubber' && drag.cur) {
      const x0 = Math.min(drag.start.x, drag.cur.x), y0 = Math.min(drag.start.y, drag.cur.y);
      h += '<rect class="rubber" x="' + r2(x0) + '" y="' + r2(y0) + '" width="' + r2(Math.abs(drag.cur.x - drag.start.x)) + '" height="' + r2(Math.abs(drag.cur.y - drag.start.y)) + '"/>';
    }
    return h;
  }
  function updateViewport() {
    vpEl.setAttribute('transform', 'translate(' + r2(view.x) + ',' + r2(view.y) + ') scale(' + view.k + ')');
    const g = doc.settings.grid || 10;
    const pat = $('#grid');
    pat.setAttribute('patternTransform', 'translate(' + r2(view.x) + ',' + r2(view.y) + ') scale(' + (view.k * g / 10) + ')');
    svg.classList.toggle('nogrid', !doc.settings.showGrid || view.k * g < 3);
    $('#zoomLabel').textContent = Math.round(view.k * 100) + ' %';
  }
  function updateStatus() {
    $('#stMode').textContent = _t('st.mode.' + tool);
    const n = sel.size;
    $('#stInfo').textContent = _t('st.info', { s: doc.shapes.length, c: doc.conns.length }) + (n ? ' · ' + _t('st.sel', { n }) : '');
    const fn = fileName || _t('untitled');
    $('#stFile').textContent = (dirty ? '● ' : '') + fn;
    document.title = (dirty ? '● ' : '') + fn + ' · PFD Studio ISO 10628';
  }

  // ------------------------------------------------------------------
  // Historique
  function commit() {
    const s = JSON.stringify(doc);
    if (s === lastSnap) return;
    undoStack.push(lastSnap);
    if (undoStack.length > 300) undoStack.shift();
    lastSnap = s;
    redoStack = [];
    dirty = true;
    autosave();
    updateStatus();
  }
  function restore(s) {
    doc = normalizeDoc(JSON.parse(s));
    lastSnap = s;
    for (const id of Array.from(sel)) if (!getShape(id) && !getConn(id) && !getText(id)) sel.delete(id);
    selPort = null;
    dirty = true;
    autosave();
    render();
    renderProps();
  }
  function undo() { if (!undoStack.length) return hint(_t('h.nothingUndo')); redoStack.push(lastSnap); restore(undoStack.pop()); }
  function redo() { if (!redoStack.length) return hint(_t('h.nothingRedo')); undoStack.push(lastSnap); restore(redoStack.pop()); }
  let autosaveTimer = null;
  function autosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ doc, fileName })); } catch (e) { /* stockage indisponible */ }
    }, 400);
  }
  function resetHistory() { undoStack = []; redoStack = []; lastSnap = JSON.stringify(doc); }

  function normalizeDoc(d) {
    const n = newDoc();
    const out = Object.assign(n, d || {});
    out.settings = Object.assign(newDoc().settings, (d && d.settings) || {});
    out.meta = Object.assign(newDoc().meta, (d && d.meta) || {});
    out.shapes = (out.shapes || []).map((s) => Object.assign({ rot: 0, fx: false, fy: false, s: 1, ports: [], tag: '', name: '', showTag: true, tdx: 0, tdy: 0 }, s));
    out.conns = (out.conns || []).map((c) => Object.assign({ kind: 'process', arrow: 'end', route: 'ortho', wps: [], label: '' }, c));
    out.texts = (out.texts || []).map((t) => Object.assign({ size: 14, text: '' }, t));
    out.seq = out.seq || {};
    let max = 0;
    for (const o of [].concat(out.shapes, out.conns, out.texts)) {
      const m = /\d+$/.exec(o.id || '');
      if (m) max = Math.max(max, +m[0]);
    }
    out.nextId = Math.max(out.nextId || 1, max + 1);
    return out;
  }

  // ------------------------------------------------------------------
  // Création / modification
  function defaultTag(d) {
    if (d.tagInside) {
      if (d.cat === 'instruments') { doc.seq.I = (doc.seq.I || 100) + 1; return 'TI ' + doc.seq.I; }
      if (d.id === 'flow_in') return _t('tag.in');
      if (d.id === 'flow_out') return _t('tag.out');
      return _t('tag.utility');
    }
    if (!d.prefix) return '';
    doc.seq[d.prefix] = (doc.seq[d.prefix] || 100) + 1;
    return d.prefix + '-' + doc.seq[d.prefix];
  }
  function addShape(symId, x, y) {
    const d = SYMBOLS[symId];
    if (!d) return null;
    const sh = {
      id: nid('s'), sym: symId,
      x: snapV(x - d.w / 2) + d.w / 2, y: snapV(y - d.h / 2) + d.h / 2,
      rot: 0, fx: false, fy: false, s: 1,
      ports: d.ports.map((p, i) => ({ id: 'p' + (i + 1), x: p.x, y: p.y, dir: p.dir })),
      tag: defaultTag(d), name: '', showTag: d.showTag || d.tagInside, tdx: 0, tdy: 0
    };
    doc.shapes.push(sh);
    sel = new Set([sh.id]);
    commit();
    render();
    renderProps();
    return sh;
  }
  function addConn(a, b) {
    const c = { id: nid('c'), a, b, wps: [], kind: defKind, arrow: defArrow, route: 'ortho', label: '' };
    doc.conns.push(c);
    return c;
  }
  function endWorld(end) { return endPos(end).p; }
  function detachEnds(shapeIds, portId) {
    for (const c of doc.conns) {
      for (const k of ['a', 'b']) {
        const e = c[k];
        if (e && e.shape && shapeIds.has(e.shape) && (!portId || e.port === portId)) {
          const p = endWorld(e);
          c[k] = { x: p.x, y: p.y };
        }
      }
    }
  }
  function deleteSelection() {
    if (tool === 'ports' && selPort) { deletePort(selPort.shape, selPort.port); return; }
    if (!sel.size) return;
    const shIds = new Set(selShapes().map((s) => s.id));
    doc.conns = doc.conns.filter((c) => !sel.has(c.id) && !(c.a.shape && shIds.has(c.a.shape) && c.b.shape && shIds.has(c.b.shape)));
    detachEnds(shIds);
    doc.shapes = doc.shapes.filter((s) => !shIds.has(s.id));
    doc.texts = doc.texts.filter((t) => !sel.has(t.id));
    sel.clear();
    commit(); render(); renderProps();
  }
  function deletePort(shapeId, portId) {
    const sh = getShape(shapeId);
    if (!sh) return;
    detachEnds(new Set([shapeId]), portId);
    sh.ports = sh.ports.filter((p) => p.id !== portId);
    selPort = null;
    commit(); render(); renderProps();
    hint(_t('h.portDeleted'));
  }
  function newPortId(sh) {
    let n = 1;
    const ids = new Set(sh.ports.map((p) => p.id));
    while (ids.has('p' + n)) n++;
    return 'p' + n;
  }
  function localPortPos(sh, w) {
    const d = symOf(sh);
    let p = w2l(sh, w.x, w.y);
    p.x = Math.round(p.x / 5) * 5; p.y = Math.round(p.y / 5) * 5;
    p.x = Math.max(0, Math.min(d.w, p.x)); p.y = Math.max(0, Math.min(d.h, p.y));
    // Aimantation sur le contour du cadre si proche
    if (p.x < 5) p.x = 0; if (d.w - p.x < 5) p.x = d.w;
    if (p.y < 5) p.y = 0; if (d.h - p.y < 5) p.y = d.h;
    return p;
  }
  function rotateSel(deg) {
    const ss = selShapes();
    if (!ss.length) return hint(_t('h.selectShape'));
    for (const s of ss) s.rot = ((s.rot + deg) % 360 + 360) % 360;
    commit(); render(); renderProps();
  }
  function flipSel(horizontal) {
    const ss = selShapes();
    if (!ss.length) return hint(_t('h.selectShape'));
    for (const s of ss) {
      const sideways = Math.round(s.rot / 90) % 2 !== 0;
      if (horizontal !== sideways) s.fx = !s.fx; else s.fy = !s.fy;
    }
    commit(); render(); renderProps();
  }
  function moveSel(dx, dy) {
    if (!sel.size) return;
    const shIds = new Set(selShapes().map((s) => s.id));
    for (const s of selShapes()) { s.x += dx; s.y += dy; }
    for (const t of selTexts()) { t.x += dx; t.y += dy; }
    for (const c of doc.conns) {
      const both = (sel.has(c.id) || (c.a.shape && shIds.has(c.a.shape))) && (sel.has(c.id) || (c.b.shape && shIds.has(c.b.shape)));
      const carry = sel.has(c.id) || (c.a.shape && shIds.has(c.a.shape) && c.b.shape && shIds.has(c.b.shape));
      if (carry && both) {
        for (const w of c.wps) { w.x += dx; w.y += dy; }
        for (const k of ['a', 'b']) if (!c[k].shape) { c[k].x += dx; c[k].y += dy; }
      }
    }
    commit(); render();
  }

  // Copier / coller
  function copySel(cut) {
    if (!sel.size) return;
    const shIds = new Set(selShapes().map((s) => s.id));
    const conns = doc.conns.filter((c) => sel.has(c.id) || (c.a.shape && shIds.has(c.a.shape) && c.b.shape && shIds.has(c.b.shape)))
      .map((c) => {
        const cc = JSON.parse(JSON.stringify(c));
        for (const k of ['a', 'b']) if (cc[k].shape && !shIds.has(cc[k].shape)) { const p = endWorld(c[k]); cc[k] = { x: p.x, y: p.y }; }
        return cc;
      });
    clipboard = JSON.stringify({ shapes: selShapes(), texts: selTexts(), conns });
    pasteCount = 0;
    try { localStorage.setItem('pfd-iso10628-clipboard', clipboard); } catch (e) { /* ignore */ }
    if (cut) deleteSelection(); else hint(_t('h.copied', { n: sel.size }));
  }
  function paste() {
    let data = clipboard;
    if (!data) { try { data = localStorage.getItem('pfd-iso10628-clipboard'); } catch (e) { /* ignore */ } }
    if (!data) return hint(_t('h.clipboardEmpty'));
    const c = JSON.parse(data);
    pasteCount++;
    const off = 20 * pasteCount;
    const map = {};
    sel.clear();
    for (const s of c.shapes) {
      const n = Object.assign({}, s, { id: nid('s'), x: s.x + off, y: s.y + off, ports: s.ports.map((p) => Object.assign({}, p)) });
      const d = SYMBOLS[n.sym];
      if (d && d.prefix && new RegExp('^' + d.prefix + '-\\d+$').test(n.tag || '')) n.tag = defaultTag(d);
      map[s.id] = n.id;
      doc.shapes.push(n); sel.add(n.id);
    }
    for (const t of c.texts) {
      const n = Object.assign({}, t, { id: nid('t'), x: t.x + off, y: t.y + off });
      doc.texts.push(n); sel.add(n.id);
    }
    for (const cn of c.conns) {
      const n = JSON.parse(JSON.stringify(cn));
      n.id = nid('c');
      for (const k of ['a', 'b']) {
        if (n[k].shape) n[k].shape = map[n[k].shape];
        else { n[k].x += off; n[k].y += off; }
      }
      n.wps = n.wps.map((w) => ({ x: w.x + off, y: w.y + off }));
      doc.conns.push(n); sel.add(n.id);
    }
    commit(); render(); renderProps();
  }

  function align(mode) {
    const ss = selShapes();
    if (ss.length < 2) return;
    const bbs = ss.map((s) => ({ s, b: shapeBBox(s) }));
    const minX = Math.min(...bbs.map((o) => o.b.x0)), maxX = Math.max(...bbs.map((o) => o.b.x1));
    const minY = Math.min(...bbs.map((o) => o.b.y0)), maxY = Math.max(...bbs.map((o) => o.b.y1));
    const ref = ss[0];
    for (const { s, b } of bbs) {
      if (mode === 'left') s.x += minX - b.x0;
      if (mode === 'right') s.x += maxX - b.x1;
      if (mode === 'top') s.y += minY - b.y0;
      if (mode === 'bottom') s.y += maxY - b.y1;
      if (mode === 'cx') s.x = ref.x;
      if (mode === 'cy') s.y = ref.y;
    }
    if (mode === 'dx' || mode === 'dy') {
      const key = mode === 'dx' ? 'x' : 'y';
      const sorted = ss.slice().sort((a, b) => a[key] - b[key]);
      const first = sorted[0][key], last = sorted[sorted.length - 1][key];
      sorted.forEach((s, i) => { s[key] = first + (last - first) * i / (sorted.length - 1); });
    }
    commit(); render();
  }

  // ------------------------------------------------------------------
  // Vue
  function toWorld(e) {
    const r = svg.getBoundingClientRect();
    return { x: (e.clientX - r.left - view.x) / view.k, y: (e.clientY - r.top - view.y) / view.k };
  }
  function zoomAt(f, cx, cy) {
    const k = Math.max(0.1, Math.min(8, view.k * f));
    const r = svg.getBoundingClientRect();
    if (cx === undefined) { cx = r.width / 2; cy = r.height / 2; }
    const wx = (cx - view.x) / view.k, wy = (cy - view.y) / view.k;
    view.k = k;
    view.x = cx - wx * k;
    view.y = cy - wy * k;
    render();
  }
  function pageRect() {
    const [pw, ph] = PAGES[doc.settings.page] || PAGES['A3 landscape'];
    return { x0: 0, y0: 0, x1: pw * MM, y1: ph * MM, pw, ph };
  }
  function contentBBox() { return doc.settings.frame ? pageRect() : drawBBox(); }
  function drawBBox() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const add = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
    for (const s of doc.shapes) {
      const b = shapeBBox(s); add(b.x0, b.y0); add(b.x1, b.y1);
      if (s.showTag && s.tag && !symOf(s).tagInside) { const t = tagPos(s); const w = String(s.tag).length * 3.6; add(t.x - w, t.y - 12); add(t.x + w, t.y + 4 + 14 * (String(s.tag).split('\n').length - 1)); }
    }
    for (const t of doc.texts) { const b = textBBox(t); add(b.x0, b.y0); add(b.x1, b.y1); }
    for (const c of doc.conns) {
      for (const p of connPoints(c)) add(p.x, p.y);
      if (c.label) { const pts = connPoints(c); const i = longestSeg(pts); const m = { x: (pts[i].x + pts[i + 1].x) / 2 + (c.ldx || 0), y: (pts[i].y + pts[i + 1].y) / 2 + (c.ldy || 0) }; const w = c.label.length * 6.2; add(m.x - w, m.y - 14); add(m.x + w, m.y + 14); }
    }
    if (x0 === Infinity) return null;
    return { x0, y0, x1, y1 };
  }
  function fit() {
    let b = drawBBox();
    if (doc.settings.frame) { const P = pageRect(); b = b ? { x0: Math.min(b.x0, P.x0), y0: Math.min(b.y0, P.y0), x1: Math.max(b.x1, P.x1), y1: Math.max(b.y1, P.y1) } : P; }
    const r = svg.getBoundingClientRect();
    if (!b) { view.k = 1; view.x = 60; view.y = 40; render(); return; }
    const m = 40;
    const k = Math.min(2, (r.width - 2 * m) / Math.max(1, b.x1 - b.x0), (r.height - 2 * m) / Math.max(1, b.y1 - b.y0));
    view.k = Math.max(0.1, k);
    view.x = (r.width - (b.x1 - b.x0) * view.k) / 2 - b.x0 * view.k;
    view.y = (r.height - (b.y1 - b.y0) * view.k) / 2 - b.y0 * view.k;
    render();
  }

  // ------------------------------------------------------------------
  // Interaction souris
  function hitInfo(el) {
    const h = el && el.closest && el.closest('[data-kind]');
    if (!h) return null;
    return { kind: h.dataset.kind, id: h.dataset.id, port: h.dataset.port, end: h.dataset.end, i: h.dataset.i !== undefined ? +h.dataset.i : undefined };
  }
  function hitAt(e) { return hitInfo(document.elementFromPoint(e.clientX, e.clientY)); }

  function resolveEnd(e, w, exclude) {
    const h = hitAt(e);
    if (h && h.kind === 'port' && !(exclude && exclude.shape === h.id && exclude.port === h.port)) return { shape: h.id, port: h.port };
    if (h && (h.kind === 'shape' || h.kind === 'tag')) {
      const sh = getShape(h.id);
      const p = sh && nearestPort(sh, w);
      if (p && !(exclude && exclude.shape === sh.id && exclude.port === p.id)) return { shape: sh.id, port: p.id };
    }
    // Aimantation : port proche
    let best = null, bd = 14 / view.k;
    for (const sh of doc.shapes) for (const p of sh.ports) {
      if (exclude && exclude.shape === sh.id && exclude.port === p.id) continue;
      const dd = dist(l2w(sh, p.x, p.y), w);
      if (dd < bd) { bd = dd; best = { shape: sh.id, port: p.id }; }
    }
    if (best) return best;
    return { x: snapV(w.x), y: snapV(w.y) };
  }
  function setHot(end) {
    svg.querySelectorAll('.port.hot').forEach((el) => el.classList.remove('hot'));
    if (end && end.shape) {
      const el = svg.querySelector('.port[data-id="' + end.shape + '"][data-port="' + end.port + '"]');
      if (el) el.classList.add('hot');
    }
  }
  function startDraft(a, w) {
    drag = { type: 'draft', a, start: w, moved: false, tmp: null };
    svg.classList.add('show-ports', 'dragging');
  }

  svg.addEventListener('contextmenu', (e) => e.preventDefault());

  svg.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    commitInlineEdit();
    const ae = document.activeElement;
    if (ae && ae !== document.body && ae.blur) ae.blur();
    const w = toWorld(e);
    if (e.button === 1 || (e.button === 0 && spaceDown)) {
      e.preventDefault();
      drag = { type: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
      svg.classList.add('panning');
      svg.setPointerCapture(e.pointerId);
      return;
    }
    const h = hitInfo(e.target);
    const now = Date.now();
    const isDouble = e.button === 0 && lastDown && now - lastDown.t < 400 && Math.hypot(e.clientX - lastDown.x, e.clientY - lastDown.y) < 6;
    lastDown = isDouble ? null : { t: now, x: e.clientX, y: e.clientY };
    if (isDouble && tool !== 'ports' && h && h.kind !== 'port' && h.kind !== 'h-end') {
      drag = null;
      setTimeout(() => onDouble(h), 0);
      return;
    }
    if (e.button === 2) {
      if (h && h.kind === 'port' && tool === 'ports') deletePort(h.id, h.port);
      return;
    }
    if (e.button !== 0) return;
    svg.setPointerCapture(e.pointerId);

    if (tool === 'ports') {
      if (h && h.kind === 'port') {
        selPort = { shape: h.id, port: h.port };
        sel = new Set([h.id]);
        drag = { type: 'portmove', shape: getShape(h.id), port: h.port, moved: false };
      } else if (h && (h.kind === 'shape' || h.kind === 'tag')) {
        const sh = getShape(h.id);
        const p = localPortPos(sh, w);
        const port = { id: newPortId(sh), x: p.x, y: p.y, dir: autoDir(p.x, p.y, symOf(sh).w, symOf(sh).h) };
        sh.ports.push(port);
        selPort = { shape: sh.id, port: port.id };
        sel = new Set([sh.id]);
        drag = { type: 'portmove', shape: sh, port: port.id, moved: true };
        hint(_t('h.portAdded', { d: dirName(port.dir) }));
      } else {
        selPort = null; sel.clear();
      }
      render(); renderProps();
      return;
    }

    if (h && h.kind === 'port') { startDraft({ shape: h.id, port: h.port }, w); return; }
    if (h && h.kind === 'h-end') {
      const c = getConn(h.id);
      drag = { type: 'end', conn: c, end: h.end, orig: JSON.parse(JSON.stringify(c[h.end])), moved: false };
      svg.classList.add('show-ports', 'dragging');
      return;
    }
    if (h && h.kind === 'h-wp') {
      const c = getConn(h.id);
      drag = { type: 'wp', conn: c, i: h.i, moved: false };
      return;
    }
    if (h && h.kind === 'h-resize') {
      const sh = getShape(h.id);
      drag = { type: 'resize', shape: sh, s0: sh.s, d0: Math.max(1, dist(w, sh)), moved: false };
      return;
    }
    if (tool === 'line') {
      let a;
      if (h && (h.kind === 'shape' || h.kind === 'tag')) { const sh = getShape(h.id); const p = nearestPort(sh, w); a = p ? { shape: sh.id, port: p.id } : { x: snapV(w.x), y: snapV(w.y) }; }
      else a = resolveEnd(e, w);
      startDraft(a, w);
      return;
    }
    if (tool === 'text') {
      const t = { id: nid('t'), x: snapV(w.x), y: snapV(w.y), text: '', size: 14 };
      doc.texts.push(t);
      sel = new Set([t.id]);
      setTool('select');
      setTimeout(() => inlineEdit(t.x, t.y, '', true, (v) => {
        if (!v.trim()) { doc.texts = doc.texts.filter((x) => x !== t); sel.delete(t.id); }
        else t.text = v;
        commit(); render(); renderProps();
      }, { left: true, size: 14 }), 0);
      return;
    }
    if (h && h.kind === 'tag') {
      const sh = getShape(h.id);
      if (!sel.has(sh.id) || e.shiftKey) { if (!e.shiftKey) sel.clear(); sel.add(sh.id); renderProps(); }
      drag = { type: 'tag', shape: sh, start: w, ox: sh.tdx || 0, oy: sh.tdy || 0, moved: false };
      render();
      return;
    }
    if (h && h.kind === 'clabel') {
      const c = getConn(h.id);
      sel = new Set([c.id]); renderProps();
      drag = { type: 'clabel', conn: c, start: w, ox: c.ldx || 0, oy: c.ldy || 0, moved: false };
      render();
      return;
    }
    if (h && (h.kind === 'shape' || h.kind === 'text')) {
      if (e.shiftKey) {
        if (sel.has(h.id)) sel.delete(h.id); else sel.add(h.id);
      } else if (!sel.has(h.id)) {
        sel = new Set([h.id]);
      }
      renderProps();
      if (sel.has(h.id)) startMove(w);
      render();
      return;
    }
    if (h && h.kind === 'conn') {
      const c = getConn(h.id);
      if (sel.has(c.id) && sel.size === 1 && !e.shiftKey) {
        drag = { type: 'segment', conn: c, start: w, moved: false };
      } else {
        if (e.shiftKey) { if (sel.has(c.id)) sel.delete(c.id); else sel.add(c.id); }
        else sel = new Set([c.id]);
        renderProps();
      }
      render();
      return;
    }
    // Vide : sélection par zone
    if (!e.shiftKey && sel.size) { sel.clear(); renderProps(); }
    drag = { type: 'rubber', start: w, cur: null, additive: e.shiftKey };
    render();
  });

  function startMove(w) {
    const shIds = new Set(selShapes().map((s) => s.id));
    const items = [];
    for (const s of selShapes()) items.push({ o: s, ox: s.x, oy: s.y });
    for (const t of selTexts()) items.push({ o: t, ox: t.x, oy: t.y });
    const pts = [];
    for (const c of doc.conns) {
      const aIn = c.a.shape ? shIds.has(c.a.shape) : sel.has(c.id);
      const bIn = c.b.shape ? shIds.has(c.b.shape) : sel.has(c.id);
      if (aIn && bIn) {
        for (const wp of c.wps) pts.push({ o: wp, ox: wp.x, oy: wp.y });
        for (const k of ['a', 'b']) if (!c[k].shape) pts.push({ o: c[k], ox: c[k].x, oy: c[k].y });
      }
    }
    drag = { type: 'move', start: w, items: items.concat(pts), moved: false };
  }

  svg.addEventListener('pointermove', (e) => {
    const w = toWorld(e);
    lastPointer = w;
    $('#stPos').textContent = 'x ' + Math.round(w.x) + ' · y ' + Math.round(w.y);
    if (!drag) return;
    switch (drag.type) {
      case 'pan':
        view.x = drag.vx + e.clientX - drag.sx;
        view.y = drag.vy + e.clientY - drag.sy;
        updateViewport();
        break;
      case 'move': {
        let dx = w.x - drag.start.x, dy = w.y - drag.start.y;
        if (!drag.moved && Math.hypot(dx, dy) * view.k < 3) return;
        drag.moved = true;
        dx = snapV(dx); dy = snapV(dy);
        for (const it of drag.items) { it.o.x = it.ox + dx; it.o.y = it.oy + dy; }
        requestRender();
        break;
      }
      case 'draft': {
        if (!drag.moved && dist(w, drag.start) * view.k < 4) return;
        drag.moved = true;
        const b = resolveEnd(e, w, drag.a.shape ? drag.a : null);
        drag.b = b;
        drag.tmp = { id: '_draft', a: drag.a, b: b.shape ? b : { x: w.x, y: w.y }, wps: [], kind: defKind, arrow: defArrow, route: 'ortho' };
        L.over.innerHTML = renderOverlay();
        setHot(b);
        break;
      }
      case 'end': {
        drag.moved = true;
        const other = drag.conn[drag.end === 'a' ? 'b' : 'a'];
        const b = resolveEnd(e, w, other.shape ? other : null);
        drag.target = b;
        drag.conn[drag.end] = b.shape ? b : { x: w.x, y: w.y };
        render();
        setHot(b);
        break;
      }
      case 'wp': {
        drag.moved = true;
        drag.conn.wps[drag.i] = { x: snapV(w.x), y: snapV(w.y) };
        requestRender();
        break;
      }
      case 'segment': {
        if (dist(w, drag.start) * view.k < 4) return;
        // Insère un point de passage à l'endroit tiré
        const c = drag.conn;
        const pts = connPoints(c);
        let bi = 0, bd = Infinity;
        for (let i = 0; i < pts.length - 1; i++) {
          const dd = segDist(drag.start, pts[i], pts[i + 1]);
          if (dd < bd) { bd = dd; bi = i; }
        }
        let idx = 0;
        for (let i = 0; i <= bi; i++) if (pts[i].wp !== undefined) idx = pts[i].wp + 1;
        c.wps.splice(idx, 0, { x: snapV(w.x), y: snapV(w.y) });
        drag = { type: 'wp', conn: c, i: idx, moved: true };
        requestRender();
        break;
      }
      case 'resize': {
        drag.moved = true;
        let s = drag.s0 * dist(w, drag.shape) / drag.d0;
        s = Math.max(0.2, Math.min(10, Math.round(s * 20) / 20));
        drag.shape.s = s;
        requestRender();
        break;
      }
      case 'portmove': {
        const sh = drag.shape;
        const p = sh.ports.find((q) => q.id === drag.port);
        if (!p) return;
        const lp = localPortPos(sh, w);
        if (lp.x !== p.x || lp.y !== p.y) {
          drag.moved = true;
          p.x = lp.x; p.y = lp.y;
          const d = symOf(sh);
          p.dir = autoDir(p.x, p.y, d.w, d.h);
          requestRender();
        }
        break;
      }
      case 'tag':
      case 'clabel': {
        drag.moved = true;
        const o = drag.type === 'tag' ? drag.shape : drag.conn;
        const kx = drag.type === 'tag' ? 'tdx' : 'ldx', ky = drag.type === 'tag' ? 'tdy' : 'ldy';
        o[kx] = Math.round(drag.ox + w.x - drag.start.x);
        o[ky] = Math.round(drag.oy + w.y - drag.start.y);
        requestRender();
        break;
      }
      case 'rubber':
        drag.cur = w;
        L.over.innerHTML = renderOverlay();
        break;
    }
  });

  function segDist(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    let t = l2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
  }

  function endDrag(e, cancel) {
    if (!drag) return;
    const d = drag;
    drag = null;
    svg.classList.remove('show-ports', 'dragging', 'panning');
    setHot(null);
    if (cancel) {
      if (d.type === 'end') d.conn[d.end] = d.orig;
      if (d.type === 'move' && d.moved) for (const it of d.items) { it.o.x = it.ox; it.o.y = it.oy; }
      lastSnap && restoreSilently();
      render();
      return;
    }
    switch (d.type) {
      case 'draft': {
        if (!d.moved || !d.b) break;
        const b = d.b;
        if (b.shape && d.a.shape && b.shape === d.a.shape && b.port === d.a.port) break;
        const ap = endWorld(d.a), bp = endWorld(b);
        if (!b.shape && !d.a.shape && dist(ap, bp) < 5) break;
        const c = addConn(d.a, b);
        sel = new Set([c.id]);
        commit();
        renderProps();
        if (!b.shape) hint(_t('h.freeEnd'));
        break;
      }
      case 'end': {
        if (d.target) d.conn[d.end] = d.target;
        commit();
        break;
      }
      case 'rubber': {
        if (d.cur) {
          const x0 = Math.min(d.start.x, d.cur.x), y0 = Math.min(d.start.y, d.cur.y);
          const x1 = Math.max(d.start.x, d.cur.x), y1 = Math.max(d.start.y, d.cur.y);
          const inside = (b) => b.x0 >= x0 && b.y0 >= y0 && b.x1 <= x1 && b.y1 <= y1;
          if (!d.additive) sel.clear();
          for (const s of doc.shapes) if (inside(shapeBBox(s))) sel.add(s.id);
          for (const t of doc.texts) if (inside(textBBox(t))) sel.add(t.id);
          for (const c of doc.conns) if (connPoints(c).every((p) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1)) sel.add(c.id);
          renderProps();
        }
        break;
      }
      default:
        if (d.moved) { commit(); renderProps(); }
    }
    render();
  }
  function restoreSilently() {
    const s = JSON.parse(lastSnap);
    doc = normalizeDoc(s);
  }
  svg.addEventListener('pointerup', (e) => endDrag(e, false));
  svg.addEventListener('pointercancel', (e) => endDrag(e, true));

  // Double-clic détecté à la main : le rendu remplace les éléments entre deux clics
  function onDouble(h) {
    if (!h) return false;
    if (h.kind === 'h-wp') {
      const c = getConn(h.id);
      c.wps.splice(h.i, 1);
      commit(); render();
      return true;
    }
    if (h.kind === 'shape' || h.kind === 'tag') {
      const sh = getShape(h.id);
      const tp = tagPos(sh);
      inlineEdit(tp.x, tp.y, sh.tag, false, (v) => {
        sh.tag = v; sh.showTag = !!v || sh.showTag;
        commit(); render(); renderProps();
      });
      return true;
    }
    if (h.kind === 'conn' || h.kind === 'clabel') {
      const c = getConn(h.id);
      const pts = connPoints(c);
      const i = longestSeg(pts);
      const m = { x: (pts[i].x + pts[i + 1].x) / 2 + (c.ldx || 0), y: (pts[i].y + pts[i + 1].y) / 2 - 6 + (c.ldy || 0) };
      inlineEdit(m.x, m.y, c.label || '', false, (v) => { c.label = v; commit(); render(); renderProps(); });
      return true;
    }
    if (h.kind === 'text') {
      const t = getText(h.id);
      inlineEdit(t.x, t.y, t.text, true, (v) => {
        if (!v.trim()) { doc.texts = doc.texts.filter((x) => x !== t); sel.delete(t.id); }
        else t.text = v;
        commit(); render(); renderProps();
      }, { left: true, size: t.size });
      return true;
    }
    return false;
  }

  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = svg.getBoundingClientRect();
    if (e.ctrlKey || !e.shiftKey) zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    else { view.x -= e.deltaY; updateViewport(); }
  }, { passive: false });

  // Édition en place
  let inlineEl = null;
  function inlineEdit(wx, wy, value, multiline, done, opt) {
    commitInlineEdit();
    opt = opt || {};
    const el = document.createElement(multiline ? 'textarea' : 'input');
    el.className = 'inline-edit';
    el.value = value || '';
    const sx = wx * view.k + view.x, sy = wy * view.k + view.y;
    el.style.left = (opt.left ? sx : sx - 70) + 'px';
    el.style.top = (opt.left ? sy : sy - 14) + 'px';
    if (multiline) { el.rows = Math.max(2, String(value).split('\n').length + 1); el.style.width = '220px'; }
    else el.style.width = '140px';
    stage.appendChild(el);
    el.focus(); el.select();
    let finished = false;
    const finish = (ok) => {
      if (finished) return;
      finished = true;
      inlineEl = null;
      const v = el.value;
      el.remove();
      if (ok) done(v); else render();
    };
    el.addEventListener('keydown', (ev) => {
      ev.stopPropagation();
      if (ev.key === 'Escape') finish(false);
      if (ev.key === 'Enter' && (!multiline || ev.ctrlKey)) { ev.preventDefault(); finish(true); }
    });
    el.addEventListener('blur', () => finish(true));
    inlineEl = { finish };
  }
  function commitInlineEdit() { if (inlineEl) inlineEl.finish(true); }

  // Glisser-déposer depuis la bibliothèque
  stage.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  stage.addEventListener('drop', (e) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('application/x-pfd-symbol') || e.dataTransfer.getData('text/plain');
    if (!SYMBOLS[id]) return;
    setTool('select');
    addShape(id, toWorld(e).x, toWorld(e).y);
  });

  // ------------------------------------------------------------------
  // Clavier
  function inField(e) {
    const t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  }
  document.addEventListener('keydown', (e) => {
    if (inField(e)) return;
    const k = e.key, ctrl = e.ctrlKey || e.metaKey;
    if (k === ' ') { spaceDown = true; svg.classList.add('space'); e.preventDefault(); return; }
    if (ctrl) {
      const lk = k.toLowerCase();
      if (lk === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (lk === 'y' || (lk === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
      else if (lk === 'c') { e.preventDefault(); copySel(false); }
      else if (lk === 'x') { e.preventDefault(); copySel(true); }
      else if (lk === 'v') { e.preventDefault(); paste(); }
      else if (lk === 'd') { e.preventDefault(); copySel(false); paste(); }
      else if (lk === 'a') { e.preventDefault(); sel = new Set([].concat(doc.shapes, doc.conns, doc.texts).map((o) => o.id)); render(); renderProps(); }
      else if (lk === 's') { e.preventDefault(); save(e.shiftKey); }
      else if (lk === 'o') { e.preventDefault(); openFile(); }
      return;
    }
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); deleteSelection(); return; }
    if (k === 'Escape') {
      if (drag) endDrag(null, true);
      else { sel.clear(); selPort = null; setTool('select'); render(); renderProps(); }
      return;
    }
    if (k === 'F1') { e.preventDefault(); showHelp(); return; }
    const step = (doc.settings.snap ? doc.settings.grid : 1) * (e.shiftKey ? 5 : 1);
    if (k === 'ArrowLeft') { e.preventDefault(); moveSel(-step, 0); return; }
    if (k === 'ArrowRight') { e.preventDefault(); moveSel(step, 0); return; }
    if (k === 'ArrowUp') { e.preventDefault(); moveSel(0, -step); return; }
    if (k === 'ArrowDown') { e.preventDefault(); moveSel(0, step); return; }
    switch (k.toLowerCase()) {
      case 'v': setTool('select'); break;
      case 'l': setTool('line'); break;
      case 't': setTool('text'); break;
      case 'p': setTool(tool === 'ports' ? 'select' : 'ports'); break;
      case 'r': rotateSel(e.shiftKey ? -90 : 90); break;
      case 'm': flipSel(!e.shiftKey); break;
      case '+': case '=': zoomAt(1.2); break;
      case '-': zoomAt(1 / 1.2); break;
      case '0': fit(); break;
    }
  });
  document.addEventListener('keyup', (e) => { if (e.key === ' ') { spaceDown = false; svg.classList.remove('space'); } });
  window.addEventListener('blur', () => { spaceDown = false; svg.classList.remove('space'); });

  function setTool(t) {
    tool = t;
    if (t !== 'ports') selPort = null;
    document.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === t));
    svg.classList.remove('tool-line', 'tool-text', 'tool-ports', 'show-ports');
    if (t !== 'select') svg.classList.add('tool-' + t);
    if (t === 'ports') { svg.classList.add('show-ports'); hint(_t('h.portsMode'), 5000); }
    if (t === 'line') hint(_t('h.lineMode'), 3500);
    if (t === 'text') hint(_t('h.textMode'), 3000);
    render();
    renderProps();
  }

  // ------------------------------------------------------------------
  // Panneau de propriétés
  function row(label, inner) { return '<div class="row"><label>' + label + '</label>' + inner + '</div>'; }
  function inp(target, prop, val, type, extra) {
    type = type || 'text';
    if (type === 'checkbox') return '<input type="checkbox" data-t="' + target + '" data-p="' + prop + '"' + (val ? ' checked' : '') + '>';
    return '<input type="' + type + '" data-t="' + target + '" data-p="' + prop + '" value="' + esc(val) + '"' + (extra || '') + '>';
  }
  function selectEl(target, prop, val, opts) {
    return '<select data-t="' + target + '" data-p="' + prop + '">' + Object.keys(opts).map((k) => '<option value="' + k + '"' + (k === val ? ' selected' : '') + '>' + esc(opts[k]) + '</option>').join('') + '</select>';
  }
  function symPreview(d) {
    return '<svg viewBox="' + (-6) + ' ' + (-6) + ' ' + (d.w + 12) + ' ' + (d.h + 12) + '"><g class="sym' + (d.iso ? ' iso' : '') + '">' + d.svg + '</g></svg>';
  }
  const kindOpts = () => Object.fromEntries(Object.entries(LINE_KINDS).map(([k, v]) => [k, _t(v.label)]));

  function renderProps() {
    let h = '';
    const ss = selShapes(), cs = selConns(), ts = selTexts();
    if (sel.size === 1 && ss.length === 1) {
      const sh = ss[0], d = symOf(sh);
      h += '<h3>' + esc(symName(d)) + '</h3>';
      h += '<div class="sympreview">' + symPreview(d) + '</div>';
      if (d.reg) h += row(_t('p.iso'), '<span class="isoreg">' + esc(d.reg) + '</span>');
      h += row(_t('p.tag'), inp('shape', 'tag', sh.tag));
      h += row(_t('p.showTag'), inp('shape', 'showTag', sh.showTag, 'checkbox'));
      h += row(_t('p.name'), inp('shape', 'name', sh.name || '', 'text', ' placeholder="' + esc(symName(d)) + '"'));
      h += '<h4>' + _t('p.layout') + '</h4>';
      h += row(_t('p.rotation'), inp('shape', 'rot', sh.rot, 'number', ' step="90"'));
      h += row(_t('p.mirror'), '<label class="chk">' + inp('shape', 'fx', sh.fx, 'checkbox') + ' ' + _t('p.mirrorH') + '</label><label class="chk">' + inp('shape', 'fy', sh.fy, 'checkbox') + ' ' + _t('p.mirrorV') + '</label>');
      h += row(_t('p.scale'), inp('shape', 's', sh.s, 'number', ' step="0.1" min="0.2" max="10"'));
      h += row(_t('p.xy'), inp('shape', 'x', r2(sh.x), 'number') + inp('shape', 'y', r2(sh.y), 'number'));
      h += '<h4>' + _t('p.colors') + '</h4>';
      h += row(_t('p.stroke'), '<input type="color" data-t="shape" data-p="color" value="' + (sh.color || '#111111') + '">');
      h += row(_t('p.fill'), '<input type="color" data-t="shape" data-p="fill" value="' + (sh.fill || '#ffffff') + '"> <button data-act="resetColors">' + _t('p.default') + '</button>');
      h += '<h4>' + _t('p.ports', { n: sh.ports.length }) + '</h4>';
      h += '<div class="portlist">' + (sh.ports.length ? sh.ports.map((p) => {
        const hot = selPort && selPort.shape === sh.id && selPort.port === p.id;
        return '<div class="portrow"' + (hot ? ' style="background:#fff4d6"' : '') + '><span>' + p.id + ' (' + r2(p.x) + ', ' + r2(p.y) + ')</span>' +
          '<select data-portdir="' + p.id + '">' + ['l', 'r', 'u', 'd'].map((k) => '<option value="' + k + '"' + (k === p.dir ? ' selected' : '') + '>' + dirName(k) + '</option>').join('') + '</select>' +
          '<button data-act="delPort" data-port="' + p.id + '" title="' + esc(_t('p.delPort.t')) + '">✕</button></div>';
      }).join('') : '<div class="portrow"><span>' + _t('p.noPort') + '</span></div>') + '</div>';
      h += '<div class="btns" style="margin-top:6px"><button data-act="portMode">' + (tool === 'ports' ? _t('p.portModeExit') : _t('p.portMode')) + '</button><button data-act="resetPorts">' + _t('p.resetPorts') + '</button></div>';
      h += '<p class="muted">' + _t('p.portHelp') + '</p>';
    } else if (sel.size === 1 && cs.length === 1) {
      const c = cs[0];
      h += '<h3>' + _t('p.line') + '</h3>';
      h += row(_t('p.type'), selectEl('conn', 'kind', c.kind, kindOpts()));
      h += row(_t('p.arrow'), selectEl('conn', 'arrow', c.arrow, arrowOpts()));
      h += row(_t('p.route'), selectEl('conn', 'route', c.route, { ortho: _t('p.ortho'), straight: _t('p.straight') }));
      h += row(_t('p.label'), inp('conn', 'label', c.label || '', 'text', ' placeholder="2\u2033-P-101-A1"'));
      h += row(_t('p.color'), '<input type="color" data-t="conn" data-p="color" value="' + (c.color || '#111111') + '">');
      h += row(_t('p.width'), inp('conn', 'width', c.width || '', 'number', ' step="0.2" min="0.4" placeholder="' + (LINE_KINDS[c.kind] || LINE_KINDS.process).w + '"'));
      h += '<div class="btns" style="margin-top:8px"><button data-act="reverse">' + _t('p.reverse') + '</button><button data-act="clearWps">' + _t('p.clearWps', { n: c.wps.length }) + '</button></div>';
      const endName = (e) => e.shape ? ((getShape(e.shape) || {}).tag || _t('p.shape')) + ' (' + e.port + ')' : _t('p.free');
      h += '<p class="muted">' + _t('p.from') + ' : ' + esc(endName(c.a)) + '<br>' + _t('p.to') + ' : ' + esc(endName(c.b)) + '</p>';
      h += '<p class="muted">' + _t('p.lineHelp') + '</p>';
    } else if (sel.size === 1 && ts.length === 1) {
      const tx = ts[0];
      h += '<h3>' + _t('p.text') + '</h3>';
      h += '<textarea data-t="text" data-p="text">' + esc(tx.text) + '</textarea>';
      h += row(_t('p.size'), inp('text', 'size', tx.size, 'number', ' min="6" max="96"'));
      h += row(_t('p.bold'), inp('text', 'bold', !!tx.bold, 'checkbox'));
      h += row(_t('p.color'), '<input type="color" data-t="text" data-p="color" value="' + (tx.color || '#111111') + '">');
    } else if (sel.size > 1) {
      h += '<h3>' + _t('p.items', { n: sel.size }) + '</h3>';
      if (ss.length > 1) {
        const al = [['left', 'p.alLeft'], ['cx', 'p.alCx'], ['right', 'p.alRight'], ['top', 'p.alTop'], ['cy', 'p.alCy'], ['bottom', 'p.alBottom'], ['dx', 'p.distX'], ['dy', 'p.distY']];
        h += '<h4>' + _t('p.align') + '</h4><div class="btns">' + al.map(([m, k]) => '<button data-act="align" data-m="' + m + '">' + _t(k) + '</button>').join('') + '</div>';
        h += '<p class="muted">' + _t('p.alHelp') + '</p>';
      }
      if (cs.length) {
        h += '<h4>' + _t('p.lines', { n: cs.length }) + '</h4>';
        h += row(_t('p.type'), selectEl('conns', 'kind', cs[0].kind, kindOpts()));
        h += row(_t('p.arrow'), selectEl('conns', 'arrow', cs[0].arrow, arrowOpts()));
      }
      h += '<div class="btns" style="margin-top:10px"><button data-act="rot">' + _t('p.rot90') + '</button><button data-act="delete">' + _t('p.delete') + '</button></div>';
    } else {
      const pageOpts = Object.fromEntries(Object.keys(PAGES).map((k) => [k, k.replace('landscape', _t('page.landscape')).replace('portrait', _t('page.portrait'))]));
      h += '<h3>' + _t('p.document') + '</h3>';
      h += row(_t('p.title'), inp('doc', 'meta.title', doc.meta.title || ''));
      h += row(_t('p.grid'), inp('doc', 'settings.grid', doc.settings.grid, 'number', ' min="2" max="100" step="1"'));
      h += row(_t('p.snap'), inp('doc', 'settings.snap', doc.settings.snap, 'checkbox'));
      h += row(_t('p.showGrid'), inp('doc', 'settings.showGrid', doc.settings.showGrid, 'checkbox'));
      h += row(_t('p.page'), selectEl('doc', 'settings.page', doc.settings.page, pageOpts));
      h += row(_t('p.frame'), inp('doc', 'settings.frame', !!doc.settings.frame, 'checkbox'));
      if (doc.settings.frame) {
        h += '<h4>' + _t('p.titleBlock') + '</h4>';
        h += row(_t('p.drawingNo'), inp('doc', 'meta.dwg', doc.meta.dwg || ''));
        h += row(_t('p.revision'), inp('doc', 'meta.rev', doc.meta.rev || ''));
        h += row(_t('p.date'), inp('doc', 'meta.date', doc.meta.date || ''));
        h += row(_t('p.author'), inp('doc', 'meta.author', doc.meta.author || ''));
        h += row(_t('p.checked'), inp('doc', 'meta.checker', doc.meta.checker || ''));
        h += row(_t('p.company'), inp('doc', 'meta.company', doc.meta.company || ''));
        h += row(_t('p.project'), inp('doc', 'meta.project', doc.meta.project || ''));
      }
      h += '<h4>' + _t('p.start') + '</h4><p class="muted">' + _t('p.startText') + '</p>';
      h += '<p class="muted">' + _t('p.autosave') + '</p>';
    }
    propsEl.innerHTML = h;
  }

  function setPath(obj, path, v) {
    const parts = path.split('.');
    let o = obj;
    for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
    o[parts[parts.length - 1]] = v;
  }
  function readInput(el) {
    if (el.type === 'checkbox') return el.checked;
    if (el.type === 'number') return el.value === '' ? '' : parseFloat(el.value);
    return el.value;
  }
  function applyProp(el) {
    const t = el.dataset.t, p = el.dataset.p;
    if (!t) return false;
    let v = readInput(el);
    if (t === 'shape') {
      const sh = selShapes()[0];
      if (!sh) return false;
      if (['rot', 's', 'x', 'y'].includes(p) && (v === '' || isNaN(v))) return false;
      if (p === 's') v = Math.max(0.2, Math.min(10, v));
      if (p === 'rot') v = ((v % 360) + 360) % 360;
      sh[p] = v;
    } else if (t === 'conn') {
      const c = selConns()[0];
      if (!c) return false;
      if (p === 'width' && (v === '' || isNaN(v))) { delete c.width; } else c[p] = v;
    } else if (t === 'conns') {
      for (const c of selConns()) c[p] = v;
    } else if (t === 'text') {
      const tx = selTexts()[0];
      if (!tx) return false;
      if (p === 'size' && (v === '' || isNaN(v))) return false;
      tx[p] = v;
    } else if (t === 'doc') {
      if (p === 'settings.grid' && (v === '' || isNaN(v) || v < 2)) return false;
      setPath(doc, p, v);
    }
    return true;
  }
  propsEl.addEventListener('input', (e) => { if (applyProp(e.target)) render(); });
  propsEl.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.portdir) {
      const sh = selShapes()[0];
      const p = sh && sh.ports.find((q) => q.id === el.dataset.portdir);
      if (p) { p.dir = el.value; commit(); render(); }
      return;
    }
    if (applyProp(el)) { commit(); render(); if (el.type !== 'text' && el.tagName !== 'TEXTAREA') renderProps(); }
  });
  propsEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    const sh = selShapes()[0], c = selConns()[0];
    if (act === 'delPort' && sh) deletePort(sh.id, b.dataset.port);
    if (act === 'resetPorts' && sh) {
      const d = symOf(sh);
      detachEnds(new Set([sh.id]));
      sh.ports = d.ports.map((p, i) => ({ id: 'p' + (i + 1), x: p.x, y: p.y, dir: p.dir }));
      commit(); render(); renderProps();
      hint(_t('h.portsReset'));
    }
    if (act === 'portMode') setTool(tool === 'ports' ? 'select' : 'ports');
    if (act === 'resetColors' && sh) { delete sh.color; delete sh.fill; commit(); render(); renderProps(); }
    if (act === 'reverse' && c) { const a = c.a; c.a = c.b; c.b = a; c.wps.reverse(); commit(); render(); renderProps(); }
    if (act === 'clearWps' && c) { c.wps = []; commit(); render(); renderProps(); }
    if (act === 'align') align(b.dataset.m);
    if (act === 'rot') rotateSel(90);
    if (act === 'delete') deleteSelection();
  });

  // ------------------------------------------------------------------
  // Bibliothèque
  let libBound = false;
  function buildLibrary() {
    const list = $('#libList');
    const openState = {};
    list.querySelectorAll('details').forEach((d) => { openState[d.dataset.cat] = d.open; });
    let h = '';
    let section = null;
    CATEGORIES.forEach((c) => {
      if (c.hidden || !c.symbols.length) return;
      if (c.section !== section) {
        section = c.section;
        h += '<div class="libsec">' + esc(_t(section === 'iso' ? 'lib.iso' : 'lib.extra')) + '</div>';
      }
      const isOpen = openState[c.id] !== undefined ? openState[c.id] : (c.num === 1 || c.num === 15);
      h += '<details data-cat="' + c.id + '"' + (isOpen ? ' open' : '') + '><summary>' + (c.num ? '<span class="gnum">' + c.num + '</span>' : '') + '<span class="cname">' + esc(symName(c)) + '</span><span class="count">' + c.symbols.length + '</span></summary><div class="tiles">';
      for (const s of c.symbols) {
        const nm = symName(s);
        h += '<div class="tile" draggable="true" data-sym="' + s.id + '" title="' + esc(nm + (s.reg ? ' (ISO ' + s.reg + ')' : '')) + '" data-search="' + esc((s.name + ' ' + (s.keywords || '') + ' ' + symName(c) + ' ' + nm).toLowerCase()) + '">' + symPreview(s) + '<span>' + esc(nm) + '</span></div>';
      }
      h += '</div></details>';
    });
    h += '<p class="libempty" hidden>' + esc(_t('lib.noresult')) + '</p>';
    list.innerHTML = h;
    filterLibrary();
    if (libBound) return;
    libBound = true;
    list.addEventListener('dragstart', (e) => {
      const t = e.target.closest('.tile');
      if (!t) return;
      e.dataTransfer.setData('application/x-pfd-symbol', t.dataset.sym);
      e.dataTransfer.setData('text/plain', t.dataset.sym);
      e.dataTransfer.effectAllowed = 'copy';
    });
    list.addEventListener('click', (e) => {
      const t = e.target.closest('.tile');
      if (!t) return;
      const r = svg.getBoundingClientRect();
      const c = { x: (r.width / 2 - view.x) / view.k, y: (r.height / 2 - view.y) / view.k };
      const n = doc.shapes.filter((s) => dist(s, c) < 30).length;
      setTool('select');
      addShape(t.dataset.sym, c.x + n * 30, c.y + n * 30);
    });
    $('#search').addEventListener('input', filterLibrary);
  }
  function filterLibrary() {
    const list = $('#libList');
    const q = $('#search').value.trim().toLowerCase();
    let total = 0;
    list.querySelectorAll('details').forEach((d) => {
      let any = 0;
      d.querySelectorAll('.tile').forEach((t) => {
        const m = !q || q.split(/\s+/).every((w) => t.dataset.search.includes(w));
        t.style.display = m ? '' : 'none';
        if (m) any++;
      });
      d.style.display = any ? '' : 'none';
      if (q && any) d.open = true;
      total += any;
    });
    list.querySelectorAll('.libsec').forEach((sct) => {
      let el = sct.nextElementSibling, any = false;
      while (el && !el.classList.contains('libsec') && el.tagName === 'DETAILS') { if (el.style.display !== 'none') any = true; el = el.nextElementSibling; }
      sct.style.display = any ? '' : 'none';
    });
    const empty = list.querySelector('.libempty');
    if (empty) empty.hidden = total > 0;
  }

  // ------------------------------------------------------------------
  // Fichiers
  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function baseName() { return (fileName ? fileName.replace(/\.(pfd\.)?json$/i, '') : (doc.meta.title || 'schema-pfd')).replace(/[\\/:*?"<>|]/g, '_'); }
  async function save(as) {
    const data = JSON.stringify(doc, null, 1);
    if (window.showSaveFilePicker) {
      try {
        if (as || !fileHandle) {
          fileHandle = await window.showSaveFilePicker({ suggestedName: baseName() + '.pfd.json', types: [{ description: _t('file.desc'), accept: { 'application/json': ['.json'] } }] });
        }
        const w = await fileHandle.createWritable();
        await w.write(data);
        await w.close();
        fileName = fileHandle.name;
        dirty = false; updateStatus(); autosave();
        hint(_t('h.saved', { f: fileName }));
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
        fileHandle = null;
      }
    }
    const name = baseName() + '.pfd.json';
    download(new Blob([data], { type: 'application/json' }), name);
    fileName = name;
    dirty = false; updateStatus(); autosave();
    hint(_t('h.downloaded', { f: name }));
  }
  function loadText(text, name, handle) {
    let d;
    try { d = JSON.parse(text); } catch (e) { alertMsg(_t('h.badJson')); return; }
    if (!d || !Array.isArray(d.shapes)) { alertMsg(_t('h.notPfd')); return; }
    doc = normalizeDoc(d);
    fileName = name || '';
    fileHandle = handle || null;
    sel.clear(); selPort = null; dirty = false;
    resetHistory(); autosave();
    fit(); renderProps();
    hint(_t('h.opened', { f: fileName }));
  }
  function alertMsg(m) { hint(m, 5000); }
  async function openFile() {
    if (dirty && doc.shapes.length && !confirm(_t('confirm.lose'))) return;
    if (window.showOpenFilePicker) {
      try {
        const [h] = await window.showOpenFilePicker({ types: [{ description: _t('file.desc'), accept: { 'application/json': ['.json', '.pfd'] } }] });
        const f = await h.getFile();
        loadText(await f.text(), f.name, h);
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    $('#fileInput').click();
  }
  $('#fileInput').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    loadText(await f.text(), f.name, null);
    e.target.value = '';
  });
  function newFile() {
    if (dirty && doc.shapes.length && !confirm(_t('confirm.lose'))) return;
    doc = newDoc(); sel.clear(); selPort = null; fileHandle = null; fileName = ''; dirty = false;
    resetHistory(); autosave();
    view.k = 1; view.x = 60; view.y = 40;
    render(); renderProps();
  }

  // ------------------------------------------------------------------
  // Export
  const STYLE_PROPS = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'font-size', 'font-family', 'font-weight', 'text-anchor', 'paint-order', 'opacity'];
  function buildExportSVG() {
    const b = contentBBox() || { x0: 0, y0: 0, x1: 100, y1: 100 };
    const m = 20;
    const fm = doc.settings.frame ? 0 : m;
    const x = Math.floor(b.x0 - fm), y = Math.floor(b.y0 - fm), w = Math.ceil(b.x1 - b.x0 + 2 * fm), h = Math.ceil(b.y1 - b.y0 + 2 * fm);
    const holder = document.createElement('div');
    holder.style.cssText = 'position:absolute;left:-99999px;top:0;width:10px;height:10px;overflow:hidden';
    holder.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="' + x + ' ' + y + ' ' + w + ' ' + h + '">' +
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="#ffffff"/>' +
      (doc.meta.title ? '<title>' + esc(doc.meta.title) + '</title>' : '') +
      (doc.shapes.some((s) => symOf(s).iso) ? '<defs>' + ISO_DEFS + '</defs>' : '') +
      '<g>' + renderFrame() + '</g><g>' + renderConns(true) + '</g><g>' + renderShapes(true) + '</g><g>' + renderTexts(true) + '</g></svg>';
    document.body.appendChild(holder);
    const root = holder.firstChild;
    root.querySelectorAll('*').forEach((el) => {
      if (el.tagName === 'g' || el.tagName === 'title' || el.closest('defs')) return;
      const cs = getComputedStyle(el);
      const symG = el.closest('.sym');
      const nonScaling = cs.getPropertyValue('vector-effect') === 'non-scaling-stroke';
      const sc = symG && nonScaling ? Math.abs(parseFloat(symG.getAttribute('data-s')) || 1) : 1;
      for (const p of STYLE_PROPS) {
        let v = cs.getPropertyValue(p);
        if (!v) continue;
        if (p === 'stroke-width') { const n = parseFloat(v); v = String(Math.round((n / sc) * 1000) / 1000); }
        if (p === 'stroke-dasharray') { if (v === 'none') continue; v = v.replace(/px/g, '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim(); if (sc !== 1) v = v.split(' ').map((n) => r2(parseFloat(n) / sc)).join(' '); }
        if (p === 'font-size') v = v.replace('px', '');
        if (p === 'opacity' && v === '1') continue;
        if (p === 'paint-order' && v === 'normal') continue;
        if ((p === 'font-size' || p === 'font-family' || p === 'font-weight' || p === 'text-anchor') && el.tagName !== 'text' && el.tagName !== 'tspan') continue;
        el.setAttribute(p, v);
      }
    });
    root.querySelectorAll('[class],[style],[data-kind],[data-id],[data-s]').forEach((el) => {
      ['class', 'style', 'data-kind', 'data-id', 'data-s'].forEach((a) => el.removeAttribute(a));
    });
    const out = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(root);
    holder.remove();
    return { svg: out, w, h };
  }
  function exportSVG() {
    if (!doc.shapes.length && !doc.conns.length && !doc.texts.length) return hint(_t('h.empty'));
    const r = buildExportSVG();
    download(new Blob([r.svg], { type: 'image/svg+xml' }), baseName() + '.svg');
  }
  function exportPNG() {
    if (!doc.shapes.length && !doc.conns.length && !doc.texts.length) return hint(_t('h.empty'));
    const r = buildExportSVG();
    const scale = 3;
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = r.w * scale; cv.height = r.h * scale;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      cv.toBlob((b) => download(b, baseName() + '.png'), 'image/png');
    };
    img.onerror = () => hint(_t('h.pngFail'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(r.svg);
  }
  function exportList() {
    const rows = doc.shapes.filter((s) => (s.tag && String(s.tag).trim()) || symOf(s).showTag)
      .map((s) => { const d = symOf(s); return [s.tag || '', s.name || symName(d), d.reg || '', symName(d)]; })
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true }));
    if (!rows.length) return hint(_t('h.empty'));
    const q = (v) => '"' + String(v).replace(/"/g, '""').replace(/\n/g, ' ') + '"';
    const head = [_t('list.tag'), _t('list.desc'), _t('list.iso'), _t('list.symbol')];
    const csv = '\ufeff' + [head].concat(rows).map((r) => r.map(q).join(';')).join('\r\n');
    download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), baseName() + '-equipment.csv');
  }
  function exportPDF() {
    if (!doc.shapes.length && !doc.conns.length && !doc.texts.length) return hint(_t('h.empty'));
    const r = buildExportSVG();
    const [pw, ph] = PAGES[doc.settings.page] || PAGES['A3 landscape'];
    const mg = doc.settings.frame ? 0 : 10;
    const svgSized = r.svg.replace(/^<\?xml[^>]*>\s*/, '').replace(/width="\d+" height="\d+"/, 'width="' + (pw - 2 * mg - 0.5) + 'mm" height="' + (ph - 2 * mg - 0.5) + 'mm" preserveAspectRatio="xMidYMid meet"');
    const html = '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(baseName()) + '</title><style>@page{size:' + pw + 'mm ' + ph + 'mm;margin:' + mg + 'mm}html,body{margin:0;padding:0}svg{display:block}</style></head><body>' + svgSized + '</body></html>';
    const fr = document.createElement('iframe');
    fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(fr);
    fr.contentDocument.open();
    fr.contentDocument.write(html);
    fr.contentDocument.close();
    hint(_t('h.pdf'), 5000);
    setTimeout(() => {
      fr.contentWindow.focus();
      fr.contentWindow.print();
      setTimeout(() => fr.remove(), 2000);
    }, 250);
  }

  // ------------------------------------------------------------------
  // Barre d'outils
  function showHelp() { $('#helpDlg').hidden = false; }
  $('#helpDlg').addEventListener('click', (e) => { if (e.target.matches('[data-close]') || e.target.id === 'helpDlg') $('#helpDlg').hidden = true; });
  const CMDS = {
    new: newFile, open: openFile, save: () => save(false), saveAs: () => save(true),
    undo, redo,
    rotL: () => rotateSel(-90), rotR: () => rotateSel(90), flipH: () => flipSel(true), flipV: () => flipSel(false),
    delete: deleteSelection,
    zoomIn: () => zoomAt(1.2), zoomOut: () => zoomAt(1 / 1.2), fit,
    exportSVG, exportPNG, exportPDF, exportList, help: showHelp
  };
  $('#toolbar').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.tool) setTool(b.dataset.tool);
    else if (b.dataset.cmd && CMDS[b.dataset.cmd]) CMDS[b.dataset.cmd]();
    b.blur();
  });
  const dk = $('#defKind'), da = $('#defArrow');
  function buildLineSelects() {
    dk.innerHTML = Object.entries(LINE_KINDS).map(([k, v]) => '<option value="' + k + '"' + (k === defKind ? ' selected' : '') + '>' + esc(_t(v.label)) + '</option>').join('');
    da.innerHTML = ARROW_KEYS.map((k) => '<option value="' + k + '"' + (k === defArrow ? ' selected' : '') + '>' + esc(_t('arrow.' + k)) + '</option>').join('');
  }
  const langSel = $('#lang');
  langSel.innerHTML = Object.entries(I18N.LANGS).map(([k, v]) => '<option value="' + k + '">' + v + '</option>').join('');
  function applyLanguage() {
    langSel.value = I18N.lang;
    I18N.apply();
    buildLineSelects();
    buildLibrary();
    render();
    renderProps();
  }
  langSel.addEventListener('change', () => { I18N.setLang(langSel.value); applyLanguage(); langSel.blur(); });
  dk.addEventListener('change', () => {
    defKind = dk.value;
    if (['signal', 'electric', 'pneumatic', 'data'].includes(defKind) && defArrow === 'end') { defArrow = 'none'; da.value = 'none'; }
    else if (['process', 'secondary', 'utility'].includes(defKind) && defArrow === 'none') { defArrow = 'end'; da.value = 'end'; }
    dk.blur();
  });
  da.addEventListener('change', () => { defArrow = da.value; da.blur(); });

  window.addEventListener('beforeunload', (e) => {
    if (dirty && doc.shapes.length && fileName) { e.preventDefault(); e.returnValue = ''; }
  });

  // ------------------------------------------------------------------
  // Démarrage
  if (ISO_DEFS) $('#svgDefs').insertAdjacentHTML('beforeend', ISO_DEFS);
  I18N.apply();
  langSel.value = I18N.lang;
  document.documentElement.lang = I18N.lang;
  buildLineSelects();
  buildLibrary();
  try {
    const saved = JSON.parse(localStorage.getItem(AUTOSAVE_KEY) || 'null');
    if (saved && saved.doc && Array.isArray(saved.doc.shapes) && (saved.doc.shapes.length || saved.doc.conns.length || saved.doc.texts.length)) {
      doc = normalizeDoc(saved.doc);
      fileName = saved.fileName && saved.fileName !== 'Sans titre' ? saved.fileName : '';
      resetHistory();
      setTimeout(() => { fit(); hint(_t('h.restored')); }, 0);
    }
  } catch (e) { /* pas de brouillon */ }
  render();
  renderProps();

  // Accès pour les tests et la console
  window.PFD = {
    get doc() { return doc; }, render, addShape, addConn, commit, undo, redo, fit, connPoints, l2w, buildExportSVG, view,
    select: (ids) => { sel = new Set(ids); render(); renderProps(); }, setTool
  };
})();
