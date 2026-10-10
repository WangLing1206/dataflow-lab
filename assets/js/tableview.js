/* =============================================================
   tableview.js · 表格视图（div-grid 实现，便于逐行/逐格动画）
   ============================================================= */
(function (global) {
  'use strict';
  const { el, sleep, fmt } = global.U;
  const { isMissing } = global.DF;
  const I18n = global.I18n;

  const MAX_RENDER = 400;
  const GROUP_CLS = ['group-a', 'group-b', 'group-c', 'group-d', 'group-e'];

  class TableView {
    constructor(container, hooks) {
      this.container = container;
      this.df = null;
      this.rowMap = new Map();   // rowId -> tr
      this.probeCell = null;
      this.hooks = hooks || {};
      this.hoverId = null;

      // 行 ↔ 图 联动：悬停行 → 高亮图上对应的图元；点击行 → 选中
      this.container.addEventListener('mouseover', (e) => {
        const tr = e.target.closest && e.target.closest('.dtr');
        if (!tr) return;
        const id = tr.dataset.id;
        if (id !== this.hoverId) {
          this.hoverId = id;
          if (this.hooks.onRowHover) this.hooks.onRowHover(id);
        }
      });
      this.container.addEventListener('mouseleave', () => {
        this.hoverId = null;
        if (this.hooks.onRowHover) this.hooks.onRowHover(null);
      });
      this.container.addEventListener('click', (e) => {
        const tr = e.target.closest && e.target.closest('.dtr');
        if (tr && this.hooks.onRowClick) this.hooks.onRowClick(tr.dataset.id);
      });
    }

    /** 选中若干行（由图形刷选触发） */
    selectRows(ids) {
      this.container.querySelectorAll('.dtr.is-sel').forEach((n) => n.classList.remove('is-sel'));
      const set = new Set((ids || []).map(String));
      let first = null;
      // 行 id 可能是数字或字符串，两种都要能命中
      const find = (id) => this.rowMap.get(id) || this.rowMap.get(Number(id)) || this.rowMap.get(String(id));
      set.forEach((id) => {
        const tr = find(id);
        if (tr) { tr.classList.add('is-sel'); if (!first) first = tr; }
      });
      if (first) {
        const box = first.getBoundingClientRect(), cb = this.container.getBoundingClientRect();
        if (box.top < cb.top || box.bottom > cb.bottom) {
          this.container.scrollTop += box.top - cb.top - cb.height;
        }
      }
      return set.size;
    }
    clearSelection() {
      this.container.querySelectorAll('.dtr.is-sel').forEach((n) => n.classList.remove('is-sel'));
    }

    /* ---------------- 渲染 ---------------- */
    setData(df, opts) {
      opts = opts || {};
      this.df = df;
      this.rowMap = new Map();
      this.container.innerHTML = '';

      const shown = df.rows.length > MAX_RENDER ? df.rows.slice(0, MAX_RENDER) : df.rows;
      const cols = `58px repeat(${df.columns.length}, minmax(112px, 1fr))`;

      // 数值列的极值（用于单元格内嵌数据条）
      const range = {};
      df.columns.forEach((c) => {
        if (c.type !== 'number') return;
        const v = df.values(c.key);
        if (v.length) range[c.key] = { min: global.DF.Stats.min(v), max: global.DF.Stats.max(v) };
      });

      const table = el('div', { class: 'dtable', style: `--cols:${cols}` });
      const thead = el('div', { class: 'dthead' });
      thead.appendChild(el('div', { class: 'dth', text: '#' }));
      df.columns.forEach((c) => {
        const th = el('div', { class: 'dth', 'data-col': c.key }, [
          el('span', { text: c.name }),
          el('span', { class: 'dtype', text: c.type === 'number' ? I18n.t('ui.typeNum') : I18n.t('ui.typeStr') }),
        ]);
        // 表头内嵌分布迷你图（sparkline）——一眼看出这一列的分布形态
        if (c.type === 'number' && global.Charts) {
          const vals = df.values(c.key);
          if (vals.length > 1) {
            const spark = global.Charts.sparkline(vals, 92, 20, getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#4f6ef7');
            spark.classList.add('th-spark');
            th.appendChild(spark);
          }
        }
        thead.appendChild(th);
      });
      table.appendChild(thead);

      const tbody = el('div', { class: 'dtbody' });
      shown.forEach((r, i) => {
        const tr = el('div', { class: 'dtr', 'data-id': r._id });
        tr.appendChild(el('div', { class: 'dtd rowidx', text: String(i) }));
        df.columns.forEach((c) => {
          const v = r[c.key];
          const td = el('div', {
            class: 'dtd' + (typeof v === 'number' ? ' num' : '') + (isMissing(v) ? ' is-null' : ''),
            'data-col': c.key,
            text: isMissing(v) ? '' : (typeof v === 'number' ? fmt(v) : String(v)),
            title: isMissing(v) ? I18n.t('ui.missingCell') : String(v),
          });
          // 单元格内嵌数据条：长度 = 该值在这一列中的相对大小
          if (typeof v === 'number' && range[c.key]) {
            const rg = range[c.key], span = (rg.max - rg.min) || 1;
            td.appendChild(el('i', { class: 'cellbar', style: `width:${Math.max(2, Math.round((v - rg.min) / span * 100))}%` }));
          }
          tr.appendChild(td);
        });
        if (!opts.silent) {
          const delay = Math.min(i * 6, 220);
          tr.classList.add('entering');
          tr.style.animationDelay = delay + 'ms';
        }
        tbody.appendChild(tr);
        this.rowMap.set(r._id, tr);
      });
      table.appendChild(tbody);
      this.container.appendChild(table);

      if (df.rows.length > MAX_RENDER) {
        this.container.appendChild(el('div', {
          class: 'muted small',
          style: 'padding:8px 12px',
          text: I18n.t('ui.renderLimit', { n: MAX_RENDER, t: df.rows.length }),
        }));
      }
      this.body = tbody;
      this.head = thead;
      this.table = table;
    }

    clear() { this.container.innerHTML = ''; this.rowMap = new Map(); this.df = null; }

    rowEl(id) { return this.rowMap.get(id); }
    cellEl(id, col) {
      const r = this.rowEl(id);
      return r ? r.querySelector(`.dtd[data-col="${cssEsc(col)}"]`) : null;
    }
    headEl(col) { return this.head ? this.head.querySelector(`.dth[data-col="${cssEsc(col)}"]`) : null; }

    resetStates() {
      this.rowMap.forEach((tr) => { tr.className = 'dtr'; tr.style.transform = ''; tr.style.opacity = ''; });
      this.container.querySelectorAll('.dtd').forEach((td) => {
        td.classList.remove('probe', 'mark-min', 'mark-max', 'mark-hit', 'changed');
      });
    }

    /* ---------------- 单格交互 ---------------- */
    probe(id, col) {
      this.clearProbe();
      const c = this.cellEl(id, col);
      if (c) { c.classList.add('probe'); this.probeCell = c; this.scrollTo(id); }
    }
    clearProbe() {
      if (this.probeCell) this.probeCell.classList.remove('probe');
      this.probeCell = null;
    }
    markCell(id, col, cls) {
      const c = this.cellEl(id, col);
      if (c) { c.classList.add(cls); c.classList.remove('probe'); }
    }
    unmarkCell(id, col, cls) {
      const c = this.cellEl(id, col);
      if (c) c.classList.remove(cls);
    }
    markRow(id, cls) { const r = this.rowEl(id); if (r) r.classList.add(cls); }
    unmarkRow(id, cls) { const r = this.rowEl(id); if (r) r.classList.remove(cls); }
    groupRow(id, gi) {
      const r = this.rowEl(id);
      if (!r) return;
      GROUP_CLS.forEach((c) => r.classList.remove(c));
      r.classList.add(GROUP_CLS[gi % GROUP_CLS.length]);
    }
    flashRow(id, kind) {
      const r = this.rowEl(id);
      if (!r) return;
      const cls = kind === 'ok' ? 'flash-ok' : 'flash-bad';
      r.classList.remove(cls);
      void r.offsetWidth;
      r.classList.add(cls);
      setTimeout(() => r.classList.remove(cls), 760);
    }
    setCell(id, col, value, tween, ms) {
      const c = this.cellEl(id, col);
      if (!c) return Promise.resolve();
      c.classList.remove('is-null');
      c.classList.add('changed');
      setTimeout(() => c.classList.remove('changed'), 900);
      const target = typeof value === 'number' ? value : null;
      if (tween && target !== null) {
        const from = Number(c.textContent) || 0;
        return global.U.tweenNumber(from, target, ms || 520, (v) => { c.textContent = fmt(v); })
          .then(() => { c.textContent = fmt(target); });
      }
      c.textContent = isMissing(value) ? '' : (typeof value === 'number' ? fmt(value) : String(value));
      return Promise.resolve();
    }

    /* ---------------- 行级动画 ---------------- */
    async dropRows(ids, opts) {
      opts = opts || {};
      const gap = opts.gap === undefined ? 60 : opts.gap;
      for (const id of ids) {
        const r = this.rowEl(id);
        if (!r) continue;
        r.classList.add('row-drop', 'dropping');
        await sleep(gap, opts.token);
      }
      await sleep(240, opts.token);
      ids.forEach((id) => { const r = this.rowEl(id); if (r) r.classList.add('collapsed'); });
      await sleep(320, opts.token);
    }

    hideRows(ids) {
      ids.forEach((id) => { const r = this.rowEl(id); if (r) { r.classList.add('collapsed'); r.classList.add('ghost'); } });
    }

    /** 行聚拢到目标行（分组聚合的坍缩效果） */
    async collapseInto(ids, targetId, token) {
      const target = this.rowEl(targetId);
      const base = target ? target.getBoundingClientRect() : null;
      if (!base) { await this.dropRows(ids, { token }); return; }
      ids.forEach((id) => {
        const r = this.rowEl(id);
        if (!r || id === targetId) return;
        const b = r.getBoundingClientRect();
        const dx = 0, dy = base.top - b.top + 2;
        r.style.transition = 'transform .5s var(--ease-out), opacity .45s var(--ease)';
        r.style.transform = `translate(${dx}px, ${dy}px) scale(.96)`;
        r.style.opacity = '0.15';
      });
      await sleep(520, token);
      ids.forEach((id) => { const r = this.rowEl(id); if (r && id !== targetId) r.classList.add('collapsed'); });
      await sleep(300, token);
    }

    /** FLIP：重排行动画 */
    flip(mutate, duration) {
      const rows = Array.from(this.body.children);
      const first = new Map();
      rows.forEach((r) => first.set(r.dataset.id, r.getBoundingClientRect().top));
      mutate();
      Array.from(this.body.children).forEach((r) => {
        const f = first.get(r.dataset.id);
        if (f === undefined) return;
        const l = r.getBoundingClientRect().top;
        const dy = f - l;
        if (Math.abs(dy) < 0.5) return;
        r.style.transition = 'none';
        r.style.transform = `translateY(${dy}px)`;
        requestAnimationFrame(() => {
          r.style.transition = `transform ${duration || 520}ms cubic-bezier(.22,.61,.36,1)`;
          r.style.transform = '';
        });
      });
    }

    reorder(orderIds) {
      const frag = document.createDocumentFragment();
      orderIds.forEach((id) => { const r = this.rowEl(id); if (r) frag.appendChild(r); });
      Array.from(this.body.children).forEach((r) => { if (!orderIds.includes(Number(r.dataset.id))) frag.appendChild(r); });
      this.body.appendChild(frag);
    }

    renumber() {
      Array.from(this.body.children).forEach((tr, i) => {
        const c = tr.querySelector('.rowidx');
        if (c) c.textContent = String(i);
      });
    }

    scrollTo(id) {
      const r = this.rowEl(id);
      if (!r) return;
      const box = this.container;
      const top = r.offsetTop - box.clientHeight / 2 + 20;
      if (Math.abs(box.scrollTop - top) > 4) {
        box.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      }
    }

    dimColumn(col, on) {
      const h = this.headEl(col);
      if (h) h.classList.toggle('is-dim', on);
      this.body.querySelectorAll(`.dtd[data-col="${cssEsc(col)}"]`).forEach((c) => {
        c.style.opacity = on ? '0.25' : '';
      });
    }

    flipHeader(col) {
      const h = this.headEl(col);
      if (!h) return;
      h.classList.remove('flip');
      void h.offsetWidth;
      h.classList.add('flip');
    }
  }

  function cssEsc(s) { return String(s).replace(/["\\]/g, '\\$&'); }

  global.TableView = TableView;
})(window);
