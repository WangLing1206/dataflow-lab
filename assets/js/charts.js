/* =============================================================
   charts.js · 轻量 SVG 图表（7 种可切换，随分析步骤联动）
   hist / line / scatter / bar / box / pie / corr
   ============================================================= */
(function (global) {
  'use strict';
  const U = global.U;
  const D = global.DF;
  const I = global.I18n;
  const S = D.Stats;
  const fmt = U.fmt;

  const SVGNS = 'http://www.w3.org/2000/svg';
  const TYPES = ['auto', 'hist', 'line', 'scatter', 'bar', 'box', 'pie', 'corr'];

  function svgEl(tag, attrs) {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    return n;
  }
  function css(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name);
    return (v && v.trim()) || fallback;
  }
  function palette() {
    return ['--c1', '--c2', '--c3', '--c4', '--c5', '--c6'].map((n, i) => css(n, ['#4f6ef7', '#14b8a6', '#f59e0b', '#ef6f9c', '#8b5cf6', '#22c55e'][i]));
  }
  function niceStep(range) {
    const raw = range / 5;
    const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    const n = raw / mag;
    return (n >= 5 ? 5 : n >= 2 ? 2 : 1) * mag;
  }

  /* ---------------- 数据准备 ---------------- */
  function corrData(df) {
    if (df.has('corr_a') && df.has('corr_r')) {
      const cols = [];
      const idx = new Map();
      df.rows.forEach((r) => {
        [r.corr_a, r.corr_b].forEach((c) => {
          if (c === null || c === undefined || idx.has(c)) return;
          idx.set(c, cols.length); cols.push(c);
        });
      });
      const m = cols.map(() => cols.map(() => 1));
      df.rows.forEach((r) => {
        const i = idx.get(r.corr_a), j = idx.get(r.corr_b);
        if (i === undefined || j === undefined) return;
        m[i][j] = Number(r.corr_r); m[j][i] = Number(r.corr_r);
      });
      return { cols, matrix: m };
    }
    return df.corrMatrix();
  }

  function pickAuto(df) {
    const nums = df.numericColumns();
    if (df.has('corr_r')) return 'corr';
    if (!nums.length && df.textColumns().length) return 'bar';
    if (df.length <= 15 && df.textColumns().length) return 'bar';
    return 'hist';
  }

  const ID_LIKE = /(^|_|\s)(id|学号|编号|序号|index|no)$/i;
  function preferNum(df, nums) {
    const cand = nums.filter((k) => !ID_LIKE.test(k));
    return (cand.length ? cand : nums)[0] || null;
  }

  function resolve(opts, df) {
    const type = !opts.type || opts.type === 'auto' ? pickAuto(df) : opts.type;
    const nums = df.numericColumns();
    const texts = df.textColumns();
    let y = opts.yKey && df.has(opts.yKey) ? opts.yKey : preferNum(df, nums);
    let x = opts.xKey && df.has(opts.xKey) ? opts.xKey : (texts[0] || (nums[1] || nums[0] || null));
    if (type === 'scatter') {
      const xk = opts.xKey && df.has(opts.xKey) && df.typeOf(opts.xKey) === 'number' ? opts.xKey : preferNum(df, nums);
      const rest = nums.filter((k) => k !== xk);
      x = xk;
      y = opts.yKey && df.has(opts.yKey) && df.typeOf(opts.yKey) === 'number' ? opts.yKey : (rest[0] || xk);
      // 避免 X、Y 落在同一列（散点图没有意义）
      if (y === x && rest.length) y = rest[0];
    }
    return { type, x, y };
  }

  /* ---------------- 主渲染 ---------------- */
  function render(box, df, opts, legendBox) {
    if (!box || !df) return;
    const W = Math.max(240, box.clientWidth || 320);
    const H = Math.max(180, box.clientHeight || 220);
    box.innerHTML = '';
    const { type, x, y } = resolve(opts, df);
    const svg = svgEl('svg', { width: '100%', height: '100%', viewBox: `0 0 ${W} ${H}`, class: 'chart-svg' });
    const P = palette();
    const text = css('--text', '#10141c'), grid = css('--grid', '#e6e8ec'), accent = css('--accent', '#4f6ef7');
    const ctx = { svg, W, H, P, text, grid, accent, df, x, y };

    let note = '';
    try {
      if (type === 'hist') note = drawHist(ctx);
      else if (type === 'line') note = drawLine(ctx);
      else if (type === 'scatter') note = drawScatter(ctx);
      else if (type === 'bar') note = drawBar(ctx);
      else if (type === 'box') note = drawBox(ctx);
      else if (type === 'pie') note = drawPie(ctx);
      else if (type === 'corr') note = drawCorr(ctx);
    } catch (e) {
      box.innerHTML = '<div class="chart-empty">' + I.t('chart.noData') + '</div>';
      if (legendBox) legendBox.textContent = '';
      return;
    }
    box.appendChild(svg);
    // 入场动画
    requestAnimationFrame(() => svg.classList.add('in'));
    if (legendBox) {
      legendBox.innerHTML = '';
      if (note) legendBox.appendChild(U.el('span', { class: 'legend-note', text: note }));
    }
  }

  function frame(ctx, o) {
    const { svg, W, H, text, grid } = ctx;
    const pad = Object.assign({ l: 44, r: 14, t: 16, b: 34 }, o.pad || {});
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const g = svgEl('g', { class: 'grid' });
    if (o.yTicks) {
      o.yTicks.forEach((tk) => {
        const yy = pad.t + ih - (tk.v - o.yMin) / ((o.yMax - o.yMin) || 1) * ih;
        g.appendChild(svgEl('line', { x1: pad.l, x2: W - pad.r, y1: yy, y2: yy, stroke: grid, 'stroke-width': 1 }));
        const tx = svgEl('text', { x: pad.l - 8, y: yy + 4, 'text-anchor': 'end', fill: text, 'font-size': 10, class: 'axis-text' });
        tx.textContent = fmt(tk.v, 1);
        g.appendChild(tx);
      });
    }
    svg.appendChild(g);
    return { pad, iw, ih };
  }

  function yTicksFor(min, max) {
    if (min === max) { min = min - 1; max = max + 1; }
    const step = niceStep(max - min);
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    const out = [];
    for (let v = lo; v <= hi + 1e-9; v += step) out.push({ v: Number(v.toFixed(6)) });
    return { ticks: out, min: lo, max: hi };
  }

  function barAnim(rect) { rect.classList.add('grow'); }

  /* ---------------- 直方图 ---------------- */
  function drawHist(ctx) {
    const { svg, W, H, df, y, P, text, accent } = ctx;
    const vals = df.values(y);
    if (!vals.length) return I.t('chart.noData');
    const nBins = U.clamp(Math.ceil(Math.sqrt(vals.length)), 5, 12);
    const mn = S.min(vals), mx = S.max(vals);
    const span = (mx - mn) || 1;
    const bins = new Array(nBins).fill(0);
    vals.forEach((v) => { bins[U.clamp(Math.floor((v - mn) / span * nBins), 0, nBins - 1)]++; });
    const yt = yTicksFor(0, S.max(bins));
    const f = frame(ctx, { yTicks: yt.ticks, yMin: yt.min, yMax: yt.max });
    const bw = f.iw / nBins;
    bins.forEach((c, i) => {
      const h = (c - yt.min) / ((yt.max - yt.min) || 1) * f.ih;
      const r = svgEl('rect', {
        x: f.pad.l + i * bw + 2, y: f.pad.t + f.ih - h, width: Math.max(1, bw - 4), height: Math.max(0, h),
        rx: 3, fill: P[0], opacity: 0.92,
      });
      barAnim(r);
      svg.appendChild(r);
      const t = svgEl('text', { x: f.pad.l + i * bw + bw / 2, y: H - f.pad.b + 14, 'text-anchor': 'middle', fill: text, 'font-size': 9, class: 'axis-text' });
      t.textContent = fmt(mn + span * (i + 0.5) / nBins, 1);
      svg.appendChild(t);
    });
    const mean = S.mean(vals);
    const mx2 = f.pad.l + (mean - mn) / span * f.iw;
    svg.appendChild(svgEl('line', { x1: mx2, x2: mx2, y1: f.pad.t, y2: f.pad.t + f.ih, stroke: accent, 'stroke-width': 1.4, 'stroke-dasharray': '4 4', opacity: 0.9 }));
    return `${I.t('chart.hist')} · ${df.nameOf(y)} · ${I.t('chart.meanLine')} ${fmt(mean)}`;
  }

  /* ---------------- 折线图 ---------------- */
  function drawLine(ctx) {
    const { svg, W, H, df, y, accent, text } = ctx;
    const vals = df.rawValues(y).map((v) => (v === null || v === undefined || !isFinite(Number(v)) ? null : Number(v)));
    if (!vals.length) return I.t('chart.noData');
    const clean = vals.filter((v) => v !== null);
    const yt = yTicksFor(S.min(clean), S.max(clean));
    const f = frame(ctx, { yTicks: yt.ticks, yMin: yt.min, yMax: yt.max });
    const pts = [];
    vals.forEach((v, i) => {
      const px = f.pad.l + (vals.length === 1 ? f.iw / 2 : (i / (vals.length - 1)) * f.iw);
      const py = v === null ? f.pad.t + f.ih : f.pad.t + f.ih - (v - yt.min) / ((yt.max - yt.min) || 1) * f.ih;
      pts.push([px, py]);
    });
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const area = svgEl('path', { d: d + ` L ${pts[pts.length - 1][0]} ${f.pad.t + f.ih} L ${pts[0][0]} ${f.pad.t + f.ih} Z`, fill: accent, opacity: 0.12 });
    svg.appendChild(area);
    const path = svgEl('path', { d, fill: 'none', stroke: accent, 'stroke-width': 2.2, 'stroke-linejoin': 'round', class: 'draw' });
    svg.appendChild(path);
    pts.forEach((p) => svg.appendChild(svgEl('circle', { cx: p[0], cy: p[1], r: 2.6, fill: accent, class: 'dot' })));
    const t = svgEl('text', { x: W - f.pad.r, y: H - 8, 'text-anchor': 'end', fill: text, 'font-size': 9, class: 'axis-text' });
    t.textContent = df.rows.length + ' ' + I.t('c.rows');
    svg.appendChild(t);
    return `${I.t('chart.line')} · ${df.nameOf(y)}`;
  }

  /* ---------------- 散点图 ---------------- */
  function drawScatter(ctx) {
    const { svg, W, H, df, x, y, P, text, accent } = ctx;
    if (!x || !y) return I.t('chart.noData');
    const xs = [], ys = [];
    df.rows.forEach((r) => {
      const a = Number(r[x]), b = Number(r[y]);
      if (isFinite(a) && isFinite(b) && r[x] !== null && r[y] !== null) { xs.push(a); ys.push(b); }
    });
    if (!xs.length) return I.t('chart.noData');
    const yt = yTicksFor(S.min(ys), S.max(ys));
    const f = frame(ctx, { yTicks: yt.ticks, yMin: yt.min, yMax: yt.max, pad: { b: 42 } });
    const xmn = S.min(xs), xmx = S.max(xs), xspan = (xmx - xmn) || 1;
    xs.forEach((a, i) => {
      const px = f.pad.l + (a - xmn) / xspan * f.iw;
      const py = f.pad.t + f.ih - (ys[i] - yt.min) / ((yt.max - yt.min) || 1) * f.ih;
      svg.appendChild(svgEl('circle', { cx: px, cy: py, r: 4, fill: P[0], opacity: 0.75, class: 'dot' }));
    });
    [0, 0.5, 1].forEach((q) => {
      const px = f.pad.l + q * f.iw;
      const t = svgEl('text', { x: px, y: H - f.pad.b + 16, 'text-anchor': 'middle', fill: text, 'font-size': 9, class: 'axis-text' });
      t.textContent = fmt(xmn + q * xspan, 1);
      svg.appendChild(t);
    });
    const r = S.corr(xs, ys);
    const t2 = svgEl('text', { x: f.pad.l + 6, y: f.pad.t + 12, fill: accent, 'font-size': 10, class: 'axis-text' });
    t2.textContent = `r = ${fmt(r, 3)}`;
    svg.appendChild(t2);
    return `${I.t('chart.scatter')} · ${df.nameOf(x)} × ${df.nameOf(y)}`;
  }

  /* ---------------- 条形图 ---------------- */
  function drawBar(ctx) {
    const { svg, W, H, df, x, y, P, text } = ctx;
    let labels = [], values = [];
    const numY = y && df.typeOf(y) === 'number';
    if (x && df.typeOf(x) !== 'number' && numY) {
      const m = new Map();
      df.rows.forEach((r) => {
        const k = r[x] === null || r[x] === undefined ? '(缺失)' : String(r[x]);
        const v = Number(r[y]);
        if (isFinite(v)) { if (!m.has(k)) m.set(k, []); m.get(k).push(v); }
      });
      Array.from(m.entries()).slice(0, 14).forEach(([k, arr]) => { labels.push(k); values.push(Number(S.mean(arr).toFixed(4))); });
    } else if (x) {
      df.valueCounts(x, 12).forEach(([k, n]) => { labels.push(k); values.push(n); });
    }
    if (!labels.length) {
      const nums = df.numericColumns();
      if (!nums.length) return I.t('chart.noData');
      df.rows.slice(0, 12).forEach((r, i) => { labels.push(String(i + 1)); values.push(Number(r[nums[0]])); });
    }
    const yt = yTicksFor(Math.min(0, S.min(values)), S.max(values));
    const f = frame(ctx, { yTicks: yt.ticks, yMin: yt.min, yMax: yt.max, pad: { b: 42 } });
    const bw = f.iw / Math.max(1, labels.length);
    labels.forEach((lb, i) => {
      const v = values[i];
      const h = (v - yt.min) / ((yt.max - yt.min) || 1) * f.ih;
      const r = svgEl('rect', {
        x: f.pad.l + i * bw + bw * 0.15, y: f.pad.t + f.ih - h, width: bw * 0.7, height: Math.max(0, h),
        rx: 4, fill: P[i % P.length], opacity: 0.92,
      });
      barAnim(r);
      svg.appendChild(r);
      const t = svgEl('text', {
        x: f.pad.l + i * bw + bw / 2, y: H - f.pad.b + 15, 'text-anchor': 'middle',
        fill: text, 'font-size': 9, class: 'axis-text',
      });
      t.textContent = lb.length > 8 ? lb.slice(0, 7) + '…' : lb;
      svg.appendChild(t);
    });
    return `${I.t('chart.bar')} · ${x ? df.nameOf(x) : ''}${numY && y ? ' · ' + df.nameOf(y) : ''}`;
  }

  /* ---------------- 箱线图 ---------------- */
  function drawBox(ctx) {
    const { svg, W, H, df, y, P, text, accent } = ctx;
    const vals = df.values(y);
    if (!vals.length) return I.t('chart.noData');
    const q1 = S.quantile(vals, 0.25), q2 = S.quantile(vals, 0.5), q3 = S.quantile(vals, 0.75);
    const iqr = q3 - q1, lo = q1 - 1.5 * iqr, hi = q3 + 1.5 * iqr;
    const inl = vals.filter((v) => v >= lo && v <= hi);
    const out = vals.filter((v) => v < lo || v > hi);
    const ymin = S.min(inl), ymax = S.max(inl);
    const yt = yTicksFor(Math.min(ymin, S.min(vals)), Math.max(ymax, S.max(vals)));
    const f = frame(ctx, { yTicks: yt.ticks, yMin: yt.min, yMax: yt.max, pad: { b: 34 } });
    const cx = f.pad.l + f.iw / 2;
    const bw = Math.min(120, f.iw * 0.5);
    const sy = (v) => f.pad.t + f.ih - (v - yt.min) / ((yt.max - yt.min) || 1) * f.ih;
    svg.appendChild(svgEl('line', { x1: cx, x2: cx, y1: sy(ymin), y2: sy(q1), stroke: text, 'stroke-width': 1.2, opacity: 0.6 }));
    svg.appendChild(svgEl('line', { x1: cx, x2: cx, y1: sy(q3), y2: sy(ymax), stroke: text, 'stroke-width': 1.2, opacity: 0.6 }));
    [ymin, ymax].forEach((v) => svg.appendChild(svgEl('line', { x1: cx - bw / 4, x2: cx + bw / 4, y1: sy(v), y2: sy(v), stroke: text, 'stroke-width': 1.2, opacity: 0.6 })));
    const box = svgEl('rect', { x: cx - bw / 2, y: sy(q3), width: bw, height: Math.max(2, sy(q1) - sy(q3)), rx: 5, fill: P[0], opacity: 0.28, stroke: P[0], 'stroke-width': 1.5 });
    barAnim(box);
    svg.appendChild(box);
    svg.appendChild(svgEl('line', { x1: cx - bw / 2, x2: cx + bw / 2, y1: sy(q2), y2: sy(q2), stroke: accent, 'stroke-width': 2.4 }));
    out.slice(0, 30).forEach((v) => svg.appendChild(svgEl('circle', { cx: cx, cy: sy(v), r: 3, fill: css('--danger', '#ef4444'), class: 'dot' })));
    return `${I.t('chart.box')} · ${df.nameOf(y)} · ${I.t('chart.boxTip')}`;
  }

  /* ---------------- 饼图 ---------------- */
  function drawPie(ctx) {
    const { svg, W, H, df, x, P, text } = ctx;
    let data = [];
    if (x) data = df.valueCounts(x, 12);
    else data = df.valueCounts(df.textColumns()[0] || df.keys()[0], 12);
    if (!data.length) return I.t('chart.noData');
    const top = data.slice(0, 7);
    if (data.length > 7) {
      const rest = data.slice(7).reduce((s, d) => s + d[1], 0);
      top.push([I.t('c.other'), rest]);
    }
    const total = top.reduce((s, d) => s + d[1], 0) || 1;
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 26, r0 = R * 0.58;
    let a0 = -Math.PI / 2;
    top.forEach((d, i) => {
      const frac = d[1] / total;
      const a1 = a0 + frac * Math.PI * 2;
      const large = frac > 0.5 ? 1 : 0;
      const p = `M ${cx + R * Math.cos(a0)} ${cy + R * Math.sin(a0)} A ${R} ${R} 0 ${large} 1 ${cx + R * Math.cos(a1)} ${cy + R * Math.sin(a1)} L ${cx + r0 * Math.cos(a1)} ${cy + r0 * Math.sin(a1)} A ${r0} ${r0} 0 ${large} 0 ${cx + r0 * Math.cos(a0)} ${cy + r0 * Math.sin(a0)} Z`;
      const path = svgEl('path', { d: p, fill: P[i % P.length], opacity: 0.92, class: 'pie-slice' });
      svg.appendChild(path);
      if (frac > 0.06) {
        const am = (a0 + a1) / 2;
        const t = svgEl('text', {
          x: cx + (R + r0) / 2 * Math.cos(am), y: cy + (R + r0) / 2 * Math.sin(am) + 3,
          'text-anchor': 'middle', fill: '#fff', 'font-size': 10, class: 'axis-text',
        });
        t.textContent = Math.round(frac * 100) + '%';
        svg.appendChild(t);
      }
      a0 = a1;
    });
    const legend = top.map((d, i) => ({ c: P[i % P.length], t: d[0], v: d[1] }));
    legend.forEach((l, i) => {
      const yy = 14 + i * 15;
      svg.appendChild(svgEl('rect', { x: 6, y: yy - 7, width: 9, height: 9, rx: 2, fill: l.c }));
      const t = svgEl('text', { x: 20, y: yy, fill: text, 'font-size': 9, class: 'axis-text' });
      t.textContent = (l.t.length > 8 ? l.t.slice(0, 7) + '…' : l.t) + ' ' + l.v;
      svg.appendChild(t);
    });
    return I.t('chart.pieTip', { n: 7 });
  }

  /* ---------------- 相关性热力图 ---------------- */
  function drawCorr(ctx) {
    const { svg, W, H, df, text } = ctx;
    const cm = corrData(df);
    if (!cm.cols.length) return I.t('chart.noData');
    const n = cm.cols.length;
    const pad = { l: 62, r: 12, t: 34, b: 20 };
    const cell = Math.min((W - pad.l - pad.r) / n, (H - pad.t - pad.b) / n);
    const g = svgEl('g', {});
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const v = U.clamp(cm.matrix[i][j], -1, 1);
        const a = Math.abs(v);
        const col = v >= 0
          ? `rgba(79,110,247,${(0.08 + a * 0.82).toFixed(3)})`
          : `rgba(239,108,156,${(0.08 + a * 0.82).toFixed(3)})`;
        const r = svgEl('rect', {
          x: pad.l + j * cell, y: pad.t + i * cell, width: cell - 2, height: cell - 2, rx: 3,
          fill: col, class: 'cell',
        });
        g.appendChild(r);
        const t = svgEl('text', {
          x: pad.l + j * cell + cell / 2, y: pad.t + i * cell + cell / 2 + 3,
          'text-anchor': 'middle', fill: a > 0.55 ? '#fff' : text, 'font-size': Math.min(11, cell * 0.34), class: 'axis-text',
        });
        t.textContent = fmt(v, 2);
        g.appendChild(t);
      }
      const th = svgEl('text', { x: pad.l - 6, y: pad.t + i * cell + cell / 2 + 3, 'text-anchor': 'end', fill: text, 'font-size': 9, class: 'axis-text' });
      th.textContent = cm.cols[i].length > 7 ? cm.cols[i].slice(0, 6) + '…' : cm.cols[i];
      g.appendChild(th);
      const tv = svgEl('text', { x: pad.l + i * cell + cell / 2, y: pad.t - 6, 'text-anchor': 'middle', fill: text, 'font-size': 9, class: 'axis-text' });
      tv.textContent = cm.cols[i].length > 7 ? cm.cols[i].slice(0, 6) + '…' : cm.cols[i];
      g.appendChild(tv);
    }
    svg.appendChild(g);
    return I.t('chart.corrTip');
  }

  global.Charts = {
    TYPES,
    typeName(t) { return I.t('chart.' + t); },
    render,
    resolve,
    /** 当前数据可用的图表类型（无数值列时隐藏散点/箱线等） */
    available(df) {
      const nums = df.numericColumns().length;
      return TYPES.filter((t) => {
        if (t === 'scatter') return nums >= 2;
        if (t === 'corr') return nums >= 2 || df.has('corr_r');
        if (t === 'hist' || t === 'line' || t === 'box') return nums >= 1;
        return true;
      });
    },
  };
})(window);
