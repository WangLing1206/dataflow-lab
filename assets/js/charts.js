/* =============================================================
   charts.js · 轻量 SVG 图表（分析级）
   基础：auto / hist / line / bar / pie
   分布：box / boxgroup / histmulti
   关系：scatter / splom / corr
   质量：missmap / profile / beforeafter
   另外支持：扫描过程实时图（live minmax / live flag）、刷选联动、自动洞察
   ============================================================= */
(function (global) {
  'use strict';
  const U = global.U;
  const D = global.DF;
  const I = global.I18n;
  const S = D.Stats;
  const fmt = U.fmt;

  const SVGNS = 'http://www.w3.org/2000/svg';
  const ID_LIKE = /(^|_|\s)(id|学号|编号|序号|index|no)$/i;

  /* ---------------- 类型与分组 ---------------- */
  const TYPES = ['auto', 'hist', 'line', 'bar', 'pie', 'box', 'boxgroup', 'histmulti', 'scatter', 'splom', 'corr', 'missmap', 'profile', 'beforeafter'];
  const GROUP = {
    auto: 'basic', hist: 'basic', line: 'basic', bar: 'basic', pie: 'basic',
    box: 'dist', boxgroup: 'dist', histmulti: 'dist',
    scatter: 'rel', splom: 'rel', corr: 'rel',
    missmap: 'quality', profile: 'quality', beforeafter: 'quality',
  };
  const GROUPS = ['basic', 'dist', 'rel', 'quality'];

  /* ---------------- SVG 工具 ---------------- */
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
  function yTicksFor(min, max) {
    if (min === max) { min = min - 1; max = max + 1; }
    const step = niceStep(max - min);
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    const out = [];
    for (let v = lo; v <= hi + 1e-9; v += step) out.push({ v: Number(v.toFixed(6)) });
    return { ticks: out, min: lo, max: hi };
  }

  /* ---------------- 数据准备 ---------------- */
  function preferNum(df, nums) {
    const cand = nums.filter((k) => !ID_LIKE.test(k));
    return (cand.length ? cand : nums)[0] || null;
  }
  /** 适合分组的类别列：取值数量接近 √n */
  function preferCat(df, texts) {
    if (!texts.length) return null;
    const lim = Math.max(2, Math.min(20, df.length / 2));
    const ideal = Math.sqrt(Math.max(1, df.length));
    const scored = texts
      .map((c) => ({ c, d: Math.abs(df.uniqueValues(c).length - ideal) }))
      .filter((x) => df.uniqueValues(x.c).length > 1 && df.uniqueValues(x.c).length <= lim)
      .sort((a, b) => a.d - b.d);
    return scored.length ? scored[0].c : texts[0];
  }
  function corrData(df) {
    if (df.has('corr_a') && df.has('corr_r')) {
      const cols = [], idx = new Map();
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
  function binOf(vals, nBins) {
    const mn = S.min(vals), mx = S.max(vals), span = (mx - mn) || 1;
    const bins = new Array(nBins).fill(0);
    vals.forEach((v) => { bins[U.clamp(Math.floor((v - mn) / span * nBins), 0, nBins - 1)]++; });
    return { bins, mn, mx, span, nBins };
  }
  function quartiles(vals) {
    const s = vals.slice().sort((a, b) => a - b);
    return {
      min: S.min(s), q1: S.quantile(s, 0.25), q2: S.quantile(s, 0.5),
      q3: S.quantile(s, 0.75), max: S.max(s),
      iqr: S.quantile(s, 0.75) - S.quantile(s, 0.25),
    };
  }

  /* ---------------- 可用性与推荐 ---------------- */
  function available(df, extra) {
    const nums = df.numericColumns().length;
    const texts = df.textColumns().length;
    const hasPrev = !!(extra && extra.prev);
    return TYPES.filter((t) => {
      switch (t) {
        case 'hist': case 'line': case 'box': return nums >= 1;
        case 'boxgroup': return nums >= 1 && texts >= 1;
        case 'histmulti': return nums >= 2;
        case 'scatter': case 'splom': return nums >= 2;
        case 'corr': return nums >= 2 || df.has('corr_r');
        case 'pie': return texts >= 1 || nums >= 1;
        case 'beforeafter': return hasPrev && nums >= 1;
        default: return true;
      }
    });
  }

  function recommend(df) {
    const nums = df.numericColumns();
    const texts = df.textColumns();
    if (df.totalMissing() > 0 && df.length > 4) return 'missmap';
    if (df.length >= 8 && nums.length >= 3) return 'splom';
    if (nums.length >= 2 && df.length >= 8) return 'corr';
    if (texts.length && nums.length && df.length >= 10) return 'boxgroup';
    if (texts.length && df.length <= 15) return 'bar';
    if (nums.length) return 'hist';
    return 'profile';
  }

  function resolve(opts, df) {
    const type = !opts.type || opts.type === 'auto' ? recommend(df) : opts.type;
    const nums = df.numericColumns();
    const texts = df.textColumns();
    let y = opts.yKey && df.has(opts.yKey) ? opts.yKey : preferNum(df, nums);
    let x = opts.xKey && df.has(opts.xKey) ? opts.xKey : (preferCat(df, texts) || (nums[1] || nums[0] || null));
    if (type === 'scatter') {
      const xk = opts.xKey && df.has(opts.xKey) && df.typeOf(opts.xKey) === 'number' ? opts.xKey : preferNum(df, nums);
      const rest = nums.filter((k) => k !== xk);
      x = xk;
      y = opts.yKey && df.has(opts.yKey) && df.typeOf(opts.yKey) === 'number' ? opts.yKey : (preferNum(df, rest) || xk);
      if (y === x && rest.length) y = rest[0];
    }
    if ((type === 'boxgroup' || type === 'bar') && (!x || df.typeOf(x) === 'number')) x = preferCat(df, texts) || x;
    return { type, x, y };
  }

  /* ---------------- 主渲染 ---------------- */
  function render(box, df, opts, legendBox, extra) {
    if (!box || !df) return;
    extra = extra || {};
    const W = Math.max(240, box.clientWidth || 320);
    const H = Math.max(180, box.clientHeight || 220);
    box.innerHTML = '';
    const { type, x, y } = resolve(opts, df);
    const svg = svgEl('svg', { width: '100%', height: '100%', viewBox: `0 0 ${W} ${H}`, class: 'chart-svg' });
    const ctx = {
      svg, W, H, df, x, y, extra,
      P: palette(), text: css('--text', '#10141c'), grid: css('--grid', '#e6e8ec'),
      accent: css('--accent', '#4f6ef7'), danger: css('--danger', '#e5484d'), ok: css('--ok', '#15a34a'),
      onSelect: extra.onSelect,
    };
    let note = '';
    try {
      if (extra.live && extra.live.mode === 'minmax') note = drawLiveMinMax(ctx);
      else if (extra.live && extra.live.mode === 'flag') note = drawLiveFlag(ctx);
      else if (type === 'hist') note = drawHist(ctx);
      else if (type === 'line') note = drawLine(ctx);
      else if (type === 'scatter') note = drawScatter(ctx);
      else if (type === 'bar') note = drawBar(ctx);
      else if (type === 'box') note = drawBox(ctx);
      else if (type === 'boxgroup') note = drawBoxGroup(ctx);
      else if (type === 'histmulti') note = drawHistMulti(ctx);
      else if (type === 'pie') note = drawPie(ctx);
      else if (type === 'corr') note = drawCorr(ctx);
      else if (type === 'splom') note = drawSplom(ctx);
      else if (type === 'missmap') note = drawMissMap(ctx);
      else if (type === 'profile') note = drawProfile(ctx);
      else if (type === 'beforeafter') note = drawBeforeAfter(ctx);
    } catch (e) {
      box.innerHTML = '<div class="chart-empty">' + I.t('chart.noData') + '</div>';
      if (legendBox) legendBox.textContent = '';
      return;
    }
    bindSelect(svg, ctx);
    box.appendChild(svg);
    requestAnimationFrame(() => svg.classList.add('in'));
    if (legendBox) {
      legendBox.innerHTML = '';
      if (note) legendBox.appendChild(U.el('span', { class: 'legend-note', text: note }));
    }
  }

  /** 点击图形 → 选中对应行（刷选联动） */
  function bindSelect(svg, ctx) {
    if (!ctx.onSelect) return;
    svg.addEventListener('click', (e) => {
      const m = e.target.closest ? e.target.closest('[data-ids]') : null;
      if (!m || !m.getAttribute('data-ids')) return;
      const ids = m.getAttribute('data-ids').split(' ').filter(Boolean);
      ctx.onSelect(ids, m.getAttribute('data-label') || '');
    });
  }
  function mark(node, ids, label) {
    if (ids && ids.length) node.setAttribute('data-ids', ids.join(' '));
    if (label) node.setAttribute('data-label', label);
    node.classList.add('mark');
    return node;
  }

  function frame(ctx, o) {
    const { svg, W, H, text, grid } = ctx;
    const pad = Object.assign({ l: 46, r: 14, t: 16, b: 34 }, o.pad || {});
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const g = svgEl('g', { class: 'grid' });
    (o.yTicks || []).forEach((tk) => {
      const yy = pad.t + ih - (tk.v - o.yMin) / ((o.yMax - o.yMin) || 1) * ih;
      g.appendChild(svgEl('line', { x1: pad.l, x2: W - pad.r, y1: yy, y2: yy, stroke: grid, 'stroke-width': 1 }));
      const tx = svgEl('text', { x: pad.l - 8, y: yy + 4, 'text-anchor': 'end', fill: text, 'font-size': 10, class: 'axis-text' });
      tx.textContent = fmt(tk.v, 1);
      g.appendChild(tx);
    });
    svg.appendChild(g);
    return { pad, iw, ih };
  }
  function label(ctx, x, y, t, size, fill, anchor) {
    const n = svgEl('text', { x, y, fill: fill || ctx.text, 'font-size': size || 9, 'text-anchor': anchor || 'middle', class: 'axis-text' });
    n.textContent = t;
    ctx.svg.appendChild(n);
    return n;
  }
  function anim(node) { node.classList.add('grow'); return node; }

  /* ================= 过程实时图 ================= */
  /** 扫描中：running min / running max 阶梯线 */
  function drawLiveMinMax(ctx) {
    const { svg, W, H, P, text, grid, accent, danger, extra } = ctx;
    const live = extra.live;
    const vals = live.values || [];
    if (!vals.length) return I.t('chart.scanning');
    const yt = yTicksFor(S.min(vals), S.max(vals));
    const f = frame(ctx, { yTicks: yt.ticks, yMin: yt.min, yMax: yt.max, pad: { b: 30 } });
    const sy = (v) => f.pad.t + f.ih - (v - yt.min) / ((yt.max - yt.min) || 1) * f.ih;
    const sx = (i) => f.pad.l + (vals.length === 1 ? f.iw / 2 : (i / (vals.length - 1)) * f.iw);
    const runningMin = [], runningMax = [];
    let mn = Infinity, mx = -Infinity;
    vals.forEach((v) => { mn = Math.min(mn, v); mx = Math.max(mx, v); runningMin.push(mn); runningMax.push(mx); });
    // 原始值折线
    const d = vals.map((v, i) => (i ? 'L' : 'M') + sx(i).toFixed(1) + ' ' + sy(v).toFixed(1)).join(' ');
    svg.appendChild(svgEl('path', { d, fill: 'none', stroke: grid, 'stroke-width': 1.4, opacity: .9 }));
    // running min / max 阶梯线
    const stepPath = (arr) => arr.map((v, i) => {
      const px = sx(i), py = sy(v);
      if (i === 0) return 'M' + px.toFixed(1) + ' ' + py.toFixed(1);
      return 'L' + px.toFixed(1) + ' ' + sy(arr[i - 1]).toFixed(1) + ' L' + px.toFixed(1) + ' ' + py.toFixed(1);
    }).join(' ');
    svg.appendChild(svgEl('path', { d: stepPath(runningMax), fill: 'none', stroke: danger, 'stroke-width': 2, class: 'draw' }));
    svg.appendChild(svgEl('path', { d: stepPath(runningMin), fill: 'none', stroke: P[0], 'stroke-width': 2, class: 'draw' }));
    // 当前值
    const ci = vals.length - 1;
    svg.appendChild(svgEl('circle', { cx: sx(ci), cy: sy(vals[ci]), r: 4, fill: accent, class: 'dot' }));
    label(ctx, f.pad.l + 4, f.pad.t + 10, `${I.t('hud.min')} ${fmt(mn)}`, 10, P[0], 'start');
    label(ctx, f.pad.l + 4, f.pad.t + 24, `${I.t('hud.max')} ${fmt(mx)}`, 10, danger, 'start');
    label(ctx, W - f.pad.r, H - 8, `${I.t('hud.progress')} ${vals.length}/${live.total || vals.length}`, 9, text, 'end');
    return I.t('chart.liveMinMax');
  }

  /** 扫描中：保留 / 剔除 计数条 */
  function drawLiveFlag(ctx) {
    const { svg, W, H, P, text, danger, ok, extra } = ctx;
    const live = extra.live;
    const total = Math.max(1, live.total || ((live.keep || 0) + (live.drop || 0)));
    const pad = 22, bh = 34, gap = 10;
    const rows = [
      { c: ok, k: 'keep', v: live.keep || 0 },
      { c: danger, k: 'drop', v: live.drop || 0 },
    ];
    rows.forEach((r, i) => {
      const y = pad + i * (bh + gap);
      const w = Math.max(2, (r.v / total) * (W - pad * 2));
      label(ctx, pad, y - 4, `${I.t('hud.' + r.k)}  ${r.v}`, 10, text, 'start');
      svg.appendChild(svgEl('rect', { x: pad, y, width: W - pad * 2, height: bh, rx: 6, fill: css('--grid', '#eee'), opacity: .5 }));
      const bar = svgEl('rect', { x: pad, y, width: w, height: bh, rx: 6, fill: r.c, opacity: .9 });
      anim(bar);
      svg.appendChild(bar);
      label(ctx, W - pad, y + bh - 3, Math.round(r.v / total * 100) + '%', 10, '#fff', 'end');
    });
    return I.t('chart.liveFlag', { k: live.keep || 0, d: live.drop || 0 });
  }

  /* ================= 基础图表 ================= */
  function drawHist(ctx) {
    const { svg, W, H, df, y, P, text, accent } = ctx;
    const vals = df.values(y);
    if (!vals.length) return I.t('chart.noData');
    const { bins, mn, span } = binOf(vals, U.clamp(Math.ceil(Math.sqrt(vals.length)), 5, 12));
    const yt = yTicksFor(0, S.max(bins));
    const f = frame(ctx, { yTicks: yt.ticks, yMin: yt.min, yMax: yt.max });
    const bw = f.iw / bins.length;
    // 每个柱记录行 id → 点击可选中
    const bucket = bins.map(() => []);
    df.rows.forEach((r) => {
      const v = r[y];
      if (typeof v !== 'number' || v === null) return;
      bucket[U.clamp(Math.floor((v - mn) / span * bins.length), 0, bins.length - 1)].push(r._id);
    });
    bins.forEach((c, i) => {
      const h = (c - yt.min) / ((yt.max - yt.min) || 1) * f.ih;
      const r = mark(svgEl('rect', {
        x: f.pad.l + i * bw + 2, y: f.pad.t + f.ih - h, width: Math.max(1, bw - 4), height: Math.max(0, h),
        rx: 3, fill: P[0], opacity: .92,
      }), bucket[i], `${fmt(mn + span * (i + 0.5) / bins.length)} ±`);
      anim(r);
      svg.appendChild(r);
      label(ctx, f.pad.l + i * bw + bw / 2, H - f.pad.b + 14, fmt(mn + span * (i + 0.5) / bins.length, 1), 9);
    });
    const mean = S.mean(vals);
    const mx2 = f.pad.l + (mean - mn) / span * f.iw;
    svg.appendChild(svgEl('line', { x1: mx2, x2: mx2, y1: f.pad.t, y2: f.pad.t + f.ih, stroke: accent, 'stroke-width': 1.4, 'stroke-dasharray': '4 4', opacity: .9 }));
    return `${I.t('chart.hist')} · ${df.nameOf(y)} · ${I.t('chart.meanLine')} ${fmt(mean)}`;
  }

  function drawLine(ctx) {
    const { svg, W, H, df, y, accent, text } = ctx;
    const vals = df.rawValues(y).map((v) => (v === null || v === undefined || !isFinite(Number(v)) ? null : Number(v)));
    if (!vals.length) return I.t('chart.noData');
    const clean = vals.filter((v) => v !== null);
    const yt = yTicksFor(S.min(clean), S.max(clean));
    const f = frame(ctx, { yTicks: yt.ticks, yMin: yt.min, yMax: yt.max });
    const pts = vals.map((v, i) => [
      f.pad.l + (vals.length === 1 ? f.iw / 2 : (i / (vals.length - 1)) * f.iw),
      v === null ? f.pad.t + f.ih : f.pad.t + f.ih - (v - yt.min) / ((yt.max - yt.min) || 1) * f.ih,
    ]);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    svg.appendChild(svgEl('path', { d: d + ` L ${pts[pts.length - 1][0]} ${f.pad.t + f.ih} L ${pts[0][0]} ${f.pad.t + f.ih} Z`, fill: accent, opacity: .12 }));
    svg.appendChild(svgEl('path', { d, fill: 'none', stroke: accent, 'stroke-width': 2.2, 'stroke-linejoin': 'round', class: 'draw' }));
    pts.forEach((p, i) => {
      const c = svgEl('circle', { cx: p[0], cy: p[1], r: 2.6, fill: accent, class: 'dot' });
      if (df.rows[i]) c.setAttribute('data-ids', df.rows[i]._id);
      svg.appendChild(c);
    });
    label(ctx, W - f.pad.r, H - 8, df.rows.length + ' ' + I.t('c.rows'), 9, text, 'end');
    return `${I.t('chart.line')} · ${df.nameOf(y)}`;
  }

  function drawScatter(ctx) {
    const { svg, W, H, df, x, y, P, text, accent } = ctx;
    if (!x || !y) return I.t('chart.noData');
    const xs = [], ys = [], ids = [];
    df.rows.forEach((r) => {
      const a = Number(r[x]), b = Number(r[y]);
      if (isFinite(a) && isFinite(b) && r[x] !== null && r[y] !== null) { xs.push(a); ys.push(b); ids.push(r._id); }
    });
    if (!xs.length) return I.t('chart.noData');
    const yt = yTicksFor(S.min(ys), S.max(ys));
    const f = frame(ctx, { yTicks: yt.ticks, yMin: yt.min, yMax: yt.max, pad: { b: 42 } });
    const xmn = S.min(xs), xmx = S.max(xs), xspan = (xmx - xmn) || 1;
    xs.forEach((a, i) => {
      const px = f.pad.l + (a - xmn) / xspan * f.iw;
      const py = f.pad.t + f.ih - (ys[i] - yt.min) / ((yt.max - yt.min) || 1) * f.ih;
      const c = mark(svgEl('circle', { cx: px, cy: py, r: 4, fill: P[0], opacity: .8, class: 'dot' }), [ids[i]], `${df.nameOf(x)}=${fmt(a)} ${df.nameOf(y)}=${fmt(ys[i])}`);
      svg.appendChild(c);
    });
    [0, .5, 1].forEach((q) => label(ctx, f.pad.l + q * f.iw, H - f.pad.b + 16, fmt(xmn + q * xspan, 1), 9));
    const r = S.corr(xs, ys);
    label(ctx, f.pad.l + 6, f.pad.t + 12, `r = ${fmt(r, 3)}`, 10, accent, 'start');
    return `${I.t('chart.scatter')} · ${df.nameOf(x)} × ${df.nameOf(y)}`;
  }

  function drawBar(ctx) {
    const { svg, W, H, df, x, y, P, text } = ctx;
    let labels = [], values = [], idSets = [];
    const numY = y && df.typeOf(y) === 'number';
    if (x && df.typeOf(x) !== 'number' && numY) {
      const m = new Map();
      df.rows.forEach((r) => {
        const k = r[x] === null || r[x] === undefined ? I.t('c.other') : String(r[x]);
        const v = Number(r[y]);
        if (!isFinite(v)) return;
        if (!m.has(k)) m.set(k, { v: [], ids: [] });
        m.get(k).v.push(v); m.get(k).ids.push(r._id);
      });
      Array.from(m.entries()).slice(0, 14).forEach(([k, o]) => {
        labels.push(k); values.push(Number(S.mean(o.v).toFixed(4))); idSets.push(o.ids);
      });
    } else if (x) {
      const m = new Map();
      df.rows.forEach((r) => {
        const k = r[x] === null || r[x] === undefined ? I.t('c.other') : String(r[x]);
        if (!m.has(k)) m.set(k, { n: 0, ids: [] });
        m.get(k).n++; m.get(k).ids.push(r._id);
      });
      df.valueCounts(x, 12).forEach(([k, n]) => {
        const o = m.get(k) || { n, ids: [] };
        labels.push(k); values.push(n); idSets.push(o.ids);
      });
    }
    if (!labels.length) {
      const nums = df.numericColumns();
      if (!nums.length) return I.t('chart.noData');
      df.rows.slice(0, 12).forEach((r, i) => { labels.push(String(i + 1)); values.push(Number(r[nums[0]])); idSets.push([r._id]); });
    }
    const yt = yTicksFor(Math.min(0, S.min(values)), S.max(values));
    const f = frame(ctx, { yTicks: yt.ticks, yMin: yt.min, yMax: yt.max, pad: { b: 42 } });
    const bw = f.iw / Math.max(1, labels.length);
    labels.forEach((lb, i) => {
      const h = (values[i] - yt.min) / ((yt.max - yt.min) || 1) * f.ih;
      const r = mark(svgEl('rect', {
        x: f.pad.l + i * bw + bw * .15, y: f.pad.t + f.ih - h, width: bw * .7, height: Math.max(0, h),
        rx: 4, fill: P[i % P.length], opacity: .92,
      }), idSets[i], lb);
      anim(r);
      svg.appendChild(r);
      label(ctx, f.pad.l + i * bw + bw / 2, H - f.pad.b + 15, lb.length > 8 ? lb.slice(0, 7) + '…' : lb, 9);
    });
    return `${I.t('chart.bar')} · ${x ? df.nameOf(x) : ''}${numY && y ? ' · ' + df.nameOf(y) : ''}`;
  }

  function drawPie(ctx) {
    const { svg, W, H, df, x, P, text } = ctx;
    const col = x || df.textColumns()[0] || df.keys()[0];
    const data = df.valueCounts(col, 12);
    if (!data.length) return I.t('chart.noData');
    const top = data.slice(0, 7);
    if (data.length > 7) top.push([I.t('c.other'), data.slice(7).reduce((s, d) => s + d[1], 0)]);
    const total = top.reduce((s, d) => s + d[1], 0) || 1;
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 26, r0 = R * .58;
    const idMap = new Map();
    df.rows.forEach((r) => {
      const k = r[col] === null || r[col] === undefined ? I.t('c.other') : String(r[col]);
      if (!idMap.has(k)) idMap.set(k, []);
      idMap.get(k).push(r._id);
    });
    let a0 = -Math.PI / 2;
    top.forEach((d, i) => {
      const frac = d[1] / total, a1 = a0 + frac * Math.PI * 2, large = frac > .5 ? 1 : 0;
      const p = `M ${cx + R * Math.cos(a0)} ${cy + R * Math.sin(a0)} A ${R} ${R} 0 ${large} 1 ${cx + R * Math.cos(a1)} ${cy + R * Math.sin(a1)} L ${cx + r0 * Math.cos(a1)} ${cy + r0 * Math.sin(a1)} A ${r0} ${r0} 0 ${large} 0 ${cx + r0 * Math.cos(a0)} ${cy + r0 * Math.sin(a0)} Z`;
      const path = mark(svgEl('path', { d: p, fill: P[i % P.length], opacity: .92, class: 'pie-slice' }), idMap.get(d[0]) || [], d[0]);
      svg.appendChild(path);
      if (frac > .06) {
        const am = (a0 + a1) / 2;
        label(ctx, cx + (R + r0) / 2 * Math.cos(am), cy + (R + r0) / 2 * Math.sin(am) + 3, Math.round(frac * 100) + '%', 10, '#fff');
      }
      a0 = a1;
    });
    top.slice(0, 6).forEach((d, i) => {
      const yy = 14 + i * 15;
      svg.appendChild(svgEl('rect', { x: 6, y: yy - 7, width: 9, height: 9, rx: 2, fill: P[i % P.length] }));
      label(ctx, 20, yy, (d[0].length > 8 ? d[0].slice(0, 7) + '…' : d[0]) + ' ' + d[1], 9, text, 'start');
    });
    return I.t('chart.pieTip', { n: 7 });
  }

  /* ================= 分布对比 ================= */
  function drawBox(ctx) {
    const { svg, df, y, P, accent, danger } = ctx;
    const vals = df.values(y);
    if (!vals.length) return I.t('chart.noData');
    const pts = df.rows.map((r) => ({ v: Number(r[y]), id: r._id })).filter((p) => isFinite(p.v));
    return drawBoxes(ctx, [{ label: df.nameOf(y), q: quartiles(vals), ids: pts.map((p) => p.id), pts }], P, accent, danger, df.nameOf(y));
  }

  function drawBoxGroup(ctx) {
    const { df, x, y, P, accent, danger } = ctx;
    const by = x || df.textColumns()[0];
    const m = new Map();
    df.rows.forEach((r) => {
      const k = r[by] === null || r[by] === undefined ? I.t('c.other') : String(r[by]);
      const v = Number(r[y]);
      if (!isFinite(v)) return;
      if (!m.has(k)) m.set(k, { v: [], ids: [], pts: [] });
      m.get(k).v.push(v); m.get(k).ids.push(r._id); m.get(k).pts.push({ v, id: r._id });
    });
    const groups = Array.from(m.entries()).slice(0, 10).map(([k, o]) => ({ label: k, q: quartiles(o.v), ids: o.ids, pts: o.pts }));
    if (!groups.length) return I.t('chart.noData');
    return drawBoxes(ctx, groups, P, accent, danger, `${df.nameOf(y)} · ${I.t('chart.byGroup')} ${df.nameOf(by)}`);
  }

  function drawBoxes(ctx, groups, P, accent, danger, title) {
    const { svg, W, H, text } = ctx;
    const all = [];
    groups.forEach((g) => all.push(g.q.min, g.q.max));
    const yt = yTicksFor(S.min(all), S.max(all));
    const f = frame(ctx, { yTicks: yt.ticks, yMin: yt.min, yMax: yt.max, pad: { b: 40 } });
    const sy = (v) => f.pad.t + f.ih - (v - yt.min) / ((yt.max - yt.min) || 1) * f.ih;
    const bw = Math.min(90, f.iw / groups.length * .6);
    const step = f.iw / groups.length;
    groups.forEach((g, i) => {
      const cx = f.pad.l + step * i + step / 2;
      const q = g.q, lo = q.q1 - 1.5 * q.iqr, hi = q.q3 + 1.5 * q.iqr;
      const gids = g.ids || [];
      svg.appendChild(svgEl('line', { x1: cx, x2: cx, y1: sy(q.min), y2: sy(q.q1), stroke: text, 'stroke-width': 1.2, opacity: .55 }));
      svg.appendChild(svgEl('line', { x1: cx, x2: cx, y1: sy(q.q3), y2: sy(q.max), stroke: text, 'stroke-width': 1.2, opacity: .55 }));
      [q.min, q.max].forEach((v) => svg.appendChild(svgEl('line', { x1: cx - bw / 4, x2: cx + bw / 4, y1: sy(v), y2: sy(v), stroke: text, 'stroke-width': 1.2, opacity: .55 })));
      const box = mark(svgEl('rect', { x: cx - bw / 2, y: sy(q.q3), width: bw, height: Math.max(2, sy(q.q1) - sy(q.q3)), rx: 5, fill: P[i % P.length], opacity: .3, stroke: P[i % P.length], 'stroke-width': 1.5 }), gids, g.label);
      anim(box);
      svg.appendChild(box);
      svg.appendChild(svgEl('line', { x1: cx - bw / 2, x2: cx + bw / 2, y1: sy(q.q2), y2: sy(q.q2), stroke: accent, 'stroke-width': 2.4 }));
      // 异常点（1.5 IQR 之外），点击可定位到具体行
      (g.pts || []).filter((p) => p.v < lo || p.v > hi).slice(0, 24).forEach((p) => {
        const c = mark(svgEl('circle', { cx: cx, cy: sy(p.v), r: 3.2, fill: danger, class: 'dot' }), [p.id], `${g.label} = ${fmt(p.v)}`);
        svg.appendChild(c);
      });
      label(ctx, cx, H - f.pad.b + 15, g.label.length > 7 ? g.label.slice(0, 6) + '…' : g.label, 9);
      label(ctx, cx, sy(q.max) - 5, fmt(q.max, 1), 8, text);
      label(ctx, cx, sy(q.min) + 12, fmt(q.min, 1), 8, text);
    });
    return `${I.t('chart.box')} · ${title}`;
  }

  function drawHistMulti(ctx) {
    const { svg, W, H, df, P, text } = ctx;
    const nums = df.numericColumns().filter((k) => !ID_LIKE.test(k));
    const cols = (nums.length ? nums : df.numericColumns()).slice(0, 3);
    if (cols.length < 2) return I.t('chart.noData');
    const nBins = 10;
    const series = cols.map((k) => {
      const vals = df.values(k);
      const mn = S.min(vals), mx = S.max(vals), span = (mx - mn) || 1;
      const bins = new Array(nBins).fill(0);
      vals.forEach((v) => bins[U.clamp(Math.floor((v - mn) / span * nBins), 0, nBins - 1)]++);
      const peak = S.max(bins) || 1;
      return { k, bins: bins.map((b) => b / peak) };
    });
    const yt = yTicksFor(0, 1);
    const f = frame(ctx, { yTicks: yt.ticks, yMin: yt.min, yMax: yt.max, pad: { b: 40 } });
    const step = f.iw / nBins, bw = step / (series.length + .4);
    series.forEach((s, si) => {
      s.bins.forEach((v, i) => {
        const h = (v - yt.min) / ((yt.max - yt.min) || 1) * f.ih;
        const x0 = f.pad.l + i * step + bw * si + 2;
        const r = svgEl('rect', { x: x0, y: f.pad.t + f.ih - h, width: Math.max(1, bw - 2), height: Math.max(0, h), rx: 2, fill: P[si % P.length], opacity: .85 });
        anim(r);
        svg.appendChild(r);
      });
    });
    series.forEach((s, si) => {
      const lx = f.pad.l + 4 + si * 74;
      svg.appendChild(svgEl('rect', { x: lx, y: f.pad.t - 2, width: 9, height: 9, rx: 2, fill: P[si % P.length] }));
      label(ctx, lx + 13, f.pad.t + 6, df.nameOf(s.k).length > 6 ? df.nameOf(s.k).slice(0, 5) + '…' : df.nameOf(s.k), 9, text, 'start');
    });
    label(ctx, f.pad.l + f.iw / 2, H - 8, I.t('chart.histMultiTip'), 9);
    return I.t('chart.histmulti');
  }

  /* ================= 关系 ================= */
  function drawCorr(ctx) {
    const { svg, W, H, df, text } = ctx;
    const cm = corrData(df);
    if (!cm.cols.length) return I.t('chart.noData');
    const n = cm.cols.length;
    const pad = { l: 62, r: 12, t: 34, b: 20 };
    const cell = Math.min((W - pad.l - pad.r) / n, (H - pad.t - pad.b) / n);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const v = U.clamp(cm.matrix[i][j], -1, 1), a = Math.abs(v);
        const col = v >= 0 ? `rgba(79,110,247,${(.08 + a * .82).toFixed(3)})` : `rgba(239,108,156,${(.08 + a * .82).toFixed(3)})`;
        svg.appendChild(svgEl('rect', { x: pad.l + j * cell, y: pad.t + i * cell, width: cell - 2, height: cell - 2, rx: 3, fill: col, class: 'cell' }));
        const t = svgEl('text', { x: pad.l + j * cell + cell / 2, y: pad.t + i * cell + cell / 2 + 3, 'text-anchor': 'middle', fill: a > .55 ? '#fff' : text, 'font-size': Math.min(11, cell * .34), class: 'axis-text' });
        t.textContent = fmt(v, 2);
        svg.appendChild(t);
      }
      const nm = cm.cols[i].length > 7 ? cm.cols[i].slice(0, 6) + '…' : cm.cols[i];
      label(ctx, pad.l - 6, pad.t + i * cell + cell / 2 + 3, nm, 9, text, 'end');
      label(ctx, pad.l + i * cell + cell / 2, pad.t - 6, nm, 9, text);
    }
    return I.t('chart.corrTip');
  }

  function drawSplom(ctx) {
    const { svg, W, H, df, P, text, grid, accent } = ctx;
    let cols = df.numericColumns().filter((k) => !ID_LIKE.test(k));
    if (cols.length < 2) cols = df.numericColumns();
    cols = cols.slice(0, 5);
    if (cols.length < 2) return I.t('chart.noData');
    const n = cols.length;
    const pad = { l: 34, r: 8, t: 24, b: 8 };
    const cell = Math.min((W - pad.l - pad.r) / n, (H - pad.t - pad.b) / n);
    const data = cols.map((k) => df.rows.map((r) => ({ v: Number(r[k]), id: r._id })));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const x0 = pad.l + j * cell, y0 = pad.t + i * cell, s = cell - 6;
        svg.appendChild(svgEl('rect', { x: x0 + 2, y: y0 + 2, width: cell - 4, height: cell - 4, rx: 4, fill: grid, opacity: .28 }));
        if (i === j) {
          label(ctx, x0 + cell / 2, y0 + cell / 2 + 4, df.nameOf(cols[i]).slice(0, 6), 10, accent);
          continue;
        }
        const xs = data[j].map((d) => d.v).filter(isFinite);
        const ys = data[i].map((d) => d.v).filter(isFinite);
        const xmn = S.min(xs), xmx = S.max(xs), ymn = S.min(ys), ymx = S.max(ys);
        const xsp = (xmx - xmn) || 1, ysp = (ymx - ymn) || 1;
        data[j].forEach((d, k) => {
          const dy = data[i][k];
          if (!isFinite(d.v) || !isFinite(dy.v)) return;
          const px = x0 + 4 + (d.v - xmn) / xsp * s;
          const py = y0 + cell - 4 - (dy.v - ymn) / ysp * s;
          const c = mark(svgEl('circle', { cx: px, cy: py, r: 1.9, fill: P[j % P.length], opacity: .7, class: 'dot' }), [d.id], `${df.nameOf(cols[j])}=${fmt(d.v)}`);
          svg.appendChild(c);
        });
        if (i > j) {
          const r = S.corr(xs, ys);
          const a = Math.abs(r);
          const bg = svgEl('rect', { x: x0 + 2, y: y0 + 2, width: cell - 4, height: cell - 4, rx: 4, fill: r >= 0 ? `rgba(79,110,247,${(a * .8).toFixed(2)})` : `rgba(239,108,156,${(a * .8).toFixed(2)})`, class: 'cell' });
          svg.insertBefore(bg, svg.firstChild.nextSibling);
          const t = svgEl('text', { x: x0 + cell / 2, y: y0 + cell / 2 + 4, 'text-anchor': 'middle', fill: a > .5 ? '#fff' : text, 'font-size': Math.min(12, cell * .3), class: 'axis-text' });
          t.textContent = fmt(r, 2);
          svg.appendChild(t);
        }
      }
      label(ctx, pad.l + i * cell + cell / 2, pad.t - 6, df.nameOf(cols[i]).slice(0, 6), 9, text);
    }
    return I.t('chart.splomTip');
  }

  /* ================= 数据质量 ================= */
  function drawMissMap(ctx) {
    const { svg, W, H, df, text, grid, danger } = ctx;
    const rows = df.rows.slice(0, 60);
    const cols = df.keys();
    const pad = { l: 52, r: 44, t: 30, b: 14 };
    const cw = (W - pad.l - pad.r) / cols.length;
    const ch = Math.min(14, (H - pad.t - pad.b) / Math.max(1, rows.length));
    cols.forEach((k, j) => {
      let miss = 0;
      rows.forEach((r, i) => {
        const m = r[k] === null || r[k] === undefined || r[k] === '';
        if (m) miss++;
        svg.appendChild(svgEl('rect', {
          x: pad.l + j * cw, y: pad.t + i * ch, width: Math.max(1, cw - 1), height: Math.max(1, ch - 1), rx: 1,
          fill: m ? danger : grid, opacity: m ? .85 : .35,
        }));
      });
      const rate = rows.length ? miss / rows.length : 0;
      svg.appendChild(svgEl('rect', { x: pad.l + j * cw, y: 8, width: Math.max(1, cw - 1), height: Math.max(0, 16 * rate), rx: 2, fill: danger, opacity: .9 }));
      svg.appendChild(svgEl('rect', { x: pad.l + j * cw, y: 8, width: Math.max(1, cw - 1), height: 16, rx: 2, fill: 'none', stroke: grid }));
      const nm = df.nameOf(k);
      const t = svgEl('text', { x: pad.l + j * cw + cw / 2, y: pad.t - 5, 'text-anchor': 'middle', fill: text, 'font-size': 8, class: 'axis-text' });
      t.textContent = nm.length > 5 ? nm.slice(0, 4) + '…' : nm;
      svg.appendChild(t);
    });
    rows.forEach((r, i) => {
      let miss = 0;
      cols.forEach((k) => { if (r[k] === null || r[k] === undefined || r[k] === '') miss++; });
      const rate = cols.length ? miss / cols.length : 0;
      svg.appendChild(svgEl('rect', { x: W - pad.r + 6, y: pad.t + i * ch, width: Math.max(0, 30 * rate), height: Math.max(1, ch - 1), rx: 1, fill: danger, opacity: .8 }));
    });
    label(ctx, pad.l / 2, 20, I.t('chart.missCol'), 8, text, 'start');
    label(ctx, W - pad.r + 6, pad.t - 5, I.t('chart.missRow'), 8, text, 'start');
    return I.t('chart.missmapTip', { m: df.totalMissing(), n: cols.length });
  }

  function drawProfile(ctx) {
    const { svg, W, H, df, text, grid, danger, P, ok } = ctx;
    const cols = df.keys().slice(0, 9);
    const rowH = Math.min(26, (H - 34) / Math.max(1, cols.length));
    label(ctx, 6, 12, I.t('chart.profileHead'), 9, text, 'start');
    cols.forEach((k, i) => {
      const y = 22 + i * rowH;
      const nm = df.nameOf(k);
      const t = svgEl('text', { x: 6, y: y + rowH / 2 + 3, fill: text, 'font-size': 9, class: 'axis-text' });
      t.textContent = nm.length > 7 ? nm.slice(0, 6) + '…' : nm;
      svg.appendChild(t);
      const type = df.typeOf(k);
      const tb = svgEl('text', { x: 74, y: y + rowH / 2 + 3, fill: text, 'font-size': 8, opacity: .7, class: 'axis-text' });
      tb.textContent = type === 'number' ? 'num' : 'str';
      svg.appendChild(tb);
      // 缺失率条
      const miss = df.rows.filter((r) => r[k] === null || r[k] === undefined || r[k] === '').length;
      const rate = df.length ? miss / df.length : 0;
      const bx = 104, bw = 54;
      svg.appendChild(svgEl('rect', { x: bx, y: y + rowH / 2 - 4, width: bw, height: 8, rx: 4, fill: grid, opacity: .5 }));
      svg.appendChild(svgEl('rect', { x: bx, y: y + rowH / 2 - 4, width: Math.max(0, bw * rate), height: 8, rx: 4, fill: rate > 0 ? danger : ok, opacity: .9 }));
      const mt = svgEl('text', { x: bx + bw + 6, y: y + rowH / 2 + 3, fill: text, 'font-size': 8, class: 'axis-text' });
      mt.textContent = Math.round(rate * 100) + '%';
      svg.appendChild(mt);
      // 分布迷你图
      const sx = bx + bw + 34, sw = Math.max(30, W - sx - 44);
      if (type === 'number') {
        const vals = df.values(k);
        if (vals.length) {
          const b = binOf(vals, 10);
          const peak = S.max(b.bins) || 1;
          const step = sw / b.bins.length;
          b.bins.forEach((v, j) => {
            const hh = (v / peak) * (rowH - 6);
            svg.appendChild(svgEl('rect', { x: sx + j * step, y: y + rowH - 3 - hh, width: Math.max(1, step - 1), height: Math.max(0, hh), rx: 1, fill: P[0], opacity: .8 }));
          });
        }
      } else {
        const counts = df.valueCounts(k, 5);
        const peak = counts.length ? counts[0][1] : 1;
        const step = sw / Math.max(1, counts.length);
        counts.forEach((c, j) => {
          const hh = (c[1] / peak) * (rowH - 6);
          svg.appendChild(svgEl('rect', { x: sx + j * step, y: y + rowH - 3 - hh, width: Math.max(1, step - 1), height: Math.max(0, hh), rx: 1, fill: P[1 % P.length], opacity: .8 }));
        });
      }
      const card = df.uniqueValues(k).length;
      const ct = svgEl('text', { x: W - 6, y: y + rowH / 2 + 3, 'text-anchor': 'end', fill: text, 'font-size': 8, class: 'axis-text' });
      ct.textContent = card + '';
      svg.appendChild(ct);
    });
    return I.t('chart.profileTip');
  }

  function drawBeforeAfter(ctx) {
    const { svg, W, H, df, y, P, text, accent, extra } = ctx;
    const prev = extra.prev;
    if (!prev || !prev.has(y)) return I.t('chart.noData');
    const a = prev.values(y), b = df.values(y);
    if (!a.length || !b.length) return I.t('chart.noData');
    const mn = Math.min(S.min(a), S.min(b)), mx = Math.max(S.max(a), S.max(b)), span = (mx - mn) || 1;
    const nBins = U.clamp(Math.ceil(Math.sqrt(Math.max(a.length, b.length))), 5, 12);
    const binA = new Array(nBins).fill(0), binB = new Array(nBins).fill(0);
    const bucketB = binB.map(() => []);
    a.forEach((v) => binA[U.clamp(Math.floor((v - mn) / span * nBins), 0, nBins - 1)]++);
    df.rows.forEach((r) => {
      const v = r[y];
      if (typeof v !== 'number' || v === null) return;
      const k = U.clamp(Math.floor((v - mn) / span * nBins), 0, nBins - 1);
      binB[k]++; bucketB[k].push(r._id);
    });
    const yt = yTicksFor(0, Math.max(S.max(binA), S.max(binB)));
    const f = frame(ctx, { yTicks: yt.ticks, yMin: yt.min, yMax: yt.max, pad: { b: 34 } });
    const step = f.iw / nBins, bw = step * .42;
    const sy = (v) => f.pad.t + f.ih - (v - yt.min) / ((yt.max - yt.min) || 1) * f.ih;
    binA.forEach((v, i) => {
      svg.appendChild(svgEl('rect', {
        x: f.pad.l + i * step + 1, y: sy(v), width: bw, height: Math.max(0, f.pad.t + f.ih - sy(v)),
        rx: 3, fill: text, opacity: .16,
      }));
    });
    binB.forEach((v, i) => {
      const h = f.pad.t + f.ih - sy(v);
      const r = mark(svgEl('rect', { x: f.pad.l + i * step + bw + 2, y: sy(v), width: bw, height: Math.max(0, h), rx: 3, fill: P[0], opacity: .92 }), bucketB[i], `${fmt(mn + span * (i + .5) / nBins)}`);
      anim(r);
      svg.appendChild(r);
    });
    label(ctx, f.pad.l + 6, f.pad.t + 10, I.t('chart.before'), 9, text, 'start');
    label(ctx, f.pad.l + 6, f.pad.t + 22, I.t('chart.after'), 9, accent, 'start');
    svg.appendChild(svgEl('rect', { x: f.pad.l + 44, y: f.pad.t + 3, width: 9, height: 9, rx: 2, fill: text, opacity: .3 }));
    svg.appendChild(svgEl('rect', { x: f.pad.l + 44, y: f.pad.t + 15, width: 9, height: 9, rx: 2, fill: P[0] }));
    return I.t('chart.beforeAfterTip', { a: prev.length, b: df.length, col: df.nameOf(y) });
  }

  /* ================= 表头迷你图 / 洞察 ================= */
  /** 返回一个小 SVG（表头 sparkline） */
  function sparkline(vals, w, h, color) {
    const svg = svgEl('svg', { width: w, height: h, viewBox: `0 0 ${w} ${h}`, class: 'spark' });
    const clean = vals.filter((v) => typeof v === 'number' && isFinite(v));
    if (clean.length < 2) return svg;
    const mn = S.min(clean), mx = S.max(clean), span = (mx - mn) || 1;
    const nBins = Math.max(4, Math.min(12, clean.length));
    const bins = new Array(nBins).fill(0);
    clean.forEach((v) => bins[U.clamp(Math.floor((v - mn) / span * nBins), 0, nBins - 1)]++);
    const peak = S.max(bins) || 1;
    const step = w / nBins;
    bins.forEach((v, i) => {
      const hh = Math.max(1, (v / peak) * (h - 2));
      svg.appendChild(svgEl('rect', { x: i * step, y: h - hh, width: Math.max(1, step - .6), height: hh, rx: .5, fill: color, opacity: .75 }));
    });
    return svg;
  }

  /** 自动洞察：用图形读出来的结论（最多 3 条） */
  function insight(df, opts) {
    const out = [];
    const nums = df.numericColumns();
    if (!nums.length) return out;
    const y = (opts && opts.yKey && df.has(opts.yKey)) ? opts.yKey : preferNum(df, nums);
    const vals = df.values(y);
    if (vals.length >= 4) {
      const mean = S.mean(vals), med = S.median(vals), sd = S.std(vals);
      const skew = sd ? (mean - med) / sd : 0;
      if (skew > .25) out.push(I.t('insight.skewRight', { col: df.nameOf(y), v: fmt(skew, 2) }));
      else if (skew < -.25) out.push(I.t('insight.skewLeft', { col: df.nameOf(y), v: fmt(skew, 2) }));
      const q = quartiles(vals);
      const lo = q.q1 - 1.5 * q.iqr, hi = q.q3 + 1.5 * q.iqr;
      const nOut = vals.filter((v) => v < lo || v > hi).length;
      if (nOut > 0) out.push(I.t('insight.outlier', { col: df.nameOf(y), n: nOut, lo: fmt(lo), hi: fmt(hi) }));
      const rng = q.max - q.min;
      if (rng > 0) out.push(I.t('insight.range', { col: df.nameOf(y), min: fmt(q.min), max: fmt(q.max), med: fmt(med) }));
    }
    const miss = df.totalMissing();
    if (miss > 0) {
      let worst = null, wv = 0;
      df.keys().forEach((k) => {
        const m = df.rows.filter((r) => r[k] === null || r[k] === undefined || r[k] === '').length;
        if (m > wv) { wv = m; worst = k; }
      });
      if (worst) out.push(I.t('insight.missing', { n: miss, col: df.nameOf(worst) }));
    }
    if (nums.length >= 2) {
      let best = null, bv = 0;
      for (let i = 0; i < nums.length; i++) {
        for (let j = i + 1; j < nums.length; j++) {
          const pa = [], pb = [];
          df.rows.forEach((r) => {
            if (typeof r[nums[i]] === 'number' && typeof r[nums[j]] === 'number') { pa.push(r[nums[i]]); pb.push(r[nums[j]]); }
          });
          if (pa.length >= 3) {
            const c = Math.abs(S.corr(pa, pb));
            if (c > bv) { bv = c; best = [nums[i], nums[j], S.corr(pa, pb)]; }
          }
        }
      }
      if (best && bv > .2) out.push(I.t('insight.corr', { a: df.nameOf(best[0]), b: df.nameOf(best[1]), r: fmt(best[2], 2) }));
    }
    const constCols = df.keys().filter((k) => df.uniqueValues(k).length <= 1);
    if (constCols.length) out.push(I.t('insight.constant', { n: constCols.length }));
    return out.slice(0, 3);
  }

  /** 表格行 → 图上高亮 */
  function hot(box, id) {
    if (!box) return;
    box.querySelectorAll('.mark[data-ids]').forEach((m) => {
      const on = id && m.getAttribute('data-ids').split(' ').indexOf(String(id)) >= 0;
      m.classList.toggle('is-hot', !!on);
    });
  }

  global.Charts = {
    TYPES, GROUPS, GROUP_OF: GROUP,
    typeName(t) { return I.t('chart.' + t); },
    groupName(g) { return I.t('chartGroup.' + g); },
    render, resolve, available, recommend, insight, sparkline, hot, mark,
  };
})(window);
