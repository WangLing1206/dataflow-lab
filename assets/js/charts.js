/* =============================================================
   charts.js · 轻量 SVG 图表（直方图 / 柱状图 / 折线图）
   数据变化时通过 CSS 过渡平滑演变
   ============================================================= */
(function (global) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const D = global.DF;
  const { fmt } = global.U;

  function svgEl(tag, attrs) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  const PALETTE = ['#35e0e8', '#6f8bff', '#8b7bff', '#3ddc97', '#ffc25c', '#ff6b8a', '#5aa9ff'];

  function render(container, df, col, legendEl) {
    container.innerHTML = '';
    if (!df || !df.length || !col) {
      container.innerHTML = '<p class="muted small">暂无可绘制的数据。</p>';
      if (legendEl) legendEl.innerHTML = '';
      return;
    }
    const W = container.clientWidth || 280;
    const H = container.clientHeight || 168;
    const pad = { l: 30, r: 8, t: 10, b: 22 };
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H });

    const isNum = df.typeOf(col) === 'number';
    let bars = [];

    if (isNum) {
      const vals = df.values(col);
      if (!vals.length) { container.innerHTML = '<p class="muted small">该列没有数值。</p>'; return; }
      const bins = Math.min(12, Math.max(5, Math.ceil(Math.sqrt(vals.length))));
      const mn = D.Stats.min(vals), mx = D.Stats.max(vals);
      const span = mx - mn || 1;
      const w = span / bins;
      const counts = new Array(bins).fill(0);
      vals.forEach((v) => {
        let i = Math.floor((v - mn) / w);
        if (i >= bins) i = bins - 1;
        if (i < 0) i = 0;
        counts[i]++;
      });
      bars = counts.map((c, i) => ({
        label: fmt(mn + w * i, 1),
        value: c,
        tip: `[${fmt(mn + w * i, 1)}, ${fmt(mn + w * (i + 1), 1)})`,
      }));
      drawBars(svg, bars, W, H, pad, '#35e0e8');
      // 均值参考线
      const mu = D.Stats.mean(vals);
      const x = pad.l + ((mu - mn) / span) * (W - pad.l - pad.r);
      const line = svgEl('line', { x1: x, x2: x, y1: pad.t, y2: H - pad.b, stroke: '#ffc25c', 'stroke-width': 1.2, 'stroke-dasharray': '4 3', opacity: 0 });
      svg.appendChild(line);
      const txt = svgEl('text', { x: x + 3, y: pad.t + 9, fill: '#ffc25c', 'font-size': 9, opacity: 0 });
      txt.textContent = '均值 ' + fmt(mu);
      svg.appendChild(txt);
      requestAnimationFrame(() => { line.setAttribute('opacity', 0.9); txt.setAttribute('opacity', 0.9); });
      if (legendEl) {
        legendEl.innerHTML = `<span><i style="background:${PALETTE[0]}"></i>${col} 分布（${bins} 个区间，共 ${vals.length} 个值）</span>
          <span><i style="background:#ffc25c"></i>均值 ${fmt(mu)}</span>`;
      }
    } else {
      const vc = df.valueCounts(col, 8);
      bars = vc.map(([k, v]) => ({ label: k, value: v, tip: `${k}：${v} 行` }));
      drawBars(svg, bars, W, H, pad, null);
      if (legendEl) {
        legendEl.innerHTML = `<span><i style="background:${PALETTE[1]}"></i>${col} 取值分布（前 ${bars.length} 类）</span>
          <span>共 ${df.uniqueValues(col).length} 个不同取值</span>`;
      }
    }

    container.appendChild(svg);
  }

  function drawBars(svg, bars, W, H, pad, singleColor) {
    const iw = W - pad.l - pad.r;
    const ih = H - pad.t - pad.b;
    const maxV = Math.max.apply(null, bars.map((b) => b.value).concat([1]));

    // 网格
    for (let i = 0; i <= 3; i++) {
      const y = pad.t + (ih * i) / 3;
      svg.appendChild(svgEl('line', { class: 'grid-line', x1: pad.l, x2: W - pad.r, y1: y, y2: y }));
      const t = svgEl('text', { x: pad.l - 5, y: y + 3, fill: '#8b9bc4', 'font-size': 9, 'text-anchor': 'end' });
      t.textContent = Math.round(maxV - (maxV * i) / 3);
      svg.appendChild(t);
    }
    svg.appendChild(svgEl('line', { class: 'axis-line', x1: pad.l, x2: W - pad.r, y1: H - pad.b, y2: H - pad.b }));

    const gap = Math.min(8, iw / bars.length * 0.28);
    const bw = (iw - gap * (bars.length - 1)) / Math.max(1, bars.length);
    bars.forEach((b, i) => {
      const h = (b.value / maxV) * ih;
      const x = pad.l + i * (bw + gap);
      const y = H - pad.b - h;
      const color = singleColor || PALETTE[i % PALETTE.length];
      const rect = svgEl('rect', {
        class: 'bar', x, y: H - pad.b, width: Math.max(1, bw), height: 0,
        rx: 3, fill: color, opacity: 0.92,
      });
      const title = svgEl('title');
      title.textContent = `${b.tip || b.label}：${b.value}`;
      rect.appendChild(title);
      svg.appendChild(rect);
      requestAnimationFrame(() => {
        setTimeout(() => { rect.setAttribute('y', y); rect.setAttribute('height', Math.max(1, h)); }, 30 + i * 22);
      });
      const lbl = svgEl('text', { class: 'bar-label', x: x + bw / 2, y: H - pad.b + 12, 'text-anchor': 'middle' });
      lbl.textContent = b.label.length > 6 ? b.label.slice(0, 5) + '…' : b.label;
      svg.appendChild(lbl);
      const vt = svgEl('text', { x: x + bw / 2, y: y - 3, fill: '#cfe3ff', 'font-size': 9, 'text-anchor': 'middle', opacity: 0 });
      vt.textContent = b.value;
      svg.appendChild(vt);
      setTimeout(() => vt.setAttribute('opacity', 1), 260 + i * 22);
    });
  }

  global.Charts = { render, PALETTE };
})(window);
