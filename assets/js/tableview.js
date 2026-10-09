/* =============================================================
   tableview.js · 表格视图（div-grid 实现，便于逐行/逐格动画）
   ============================================================= */
(function (global) {
  'use strict';
  const { el, sleep, fmt } = global.U;
  const { isMissing } = global.DF;

  const MAX_RENDER = 400;
  const GROUP_CLS = ['group-a', 'group-b', 'group-c', 'group-d', 'group-e'];

  class TableView {
    constructor(container) {
      this.container = container;
      this.df = null;
      this.rowMap = new Map();   // rowId -> tr
      this.probeCell = null;
    }

    /* ---------------- 渲染 ---------------- */
    setData(df, opts) {
      opts = opts || {};
      this.df = df;
      this.rowMap = new Map();
      this.container.innerHTML = '';

      const names = df.names();
      const shown = df.rows.length > MAX_RENDER ? df.rows.slice(0, MAX_RENDER) : df.rows;
      const cols = `58px repeat(${names.length}, minmax(112px, 1fr))`;

      const table = el('div', { class: 'dtable', style: `--cols:${cols}` });
      const thead = el('div', { class: 'dthead' });
      thead.appendChild(el('div', { class: 'dth', text: '#' }));
      names.forEach((n) => {
        const th = el('div', { class: 'dth', 'data-col': n }, [
          el('span', { text: n }),
          el('span', { class: 'dtype', text: df.typeOf(n) === 'number' ? 'num' : 'str' }),
        ]);
        thead.appendChild(th);
      });
      table.appendChild(thead);

      const tbody = el('div', { class: 'dtbody' });
      shown.forEach((r, i) => {
        const tr = el('div', { class: 'dtr', 'data-id': r._id });
        tr.appendChild(el('div', { class: 'dtd rowidx', text: String(i) }));
        names.forEach((n) => {
          const v = r[n];
          const td = el('div', {
            class: 'dtd' + (typeof v === 'number' ? ' num' : '') + (isMissing(v) ? ' is-null' : ''),
            'data-col': n,
            text: isMissing(v) ? '' : (typeof v === 'number' ? fmt(v) : String(v)),
            title: isMissing(v) ? '缺失值' : String(v),
          });
          tr.appendChild(td);
        });
        if (!opts.silent) {
          const delay = Math.min(i * 8, 420);
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
          text: `为保证动画流畅，仅渲染前 ${MAX_RENDER} 行（共 ${df.rows.length} 行），统计与计算仍基于全量数据。`,
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
    setCell(id, col, value, tween) {
      const c = this.cellEl(id, col);
      if (!c) return Promise.resolve();
      const old = isMissing(this.df.rows.find((r) => r._id === id)?.[col]) ? null : null;
      c.classList.remove('is-null');
      c.classList.add('changed');
      setTimeout(() => c.classList.remove('changed'), 900);
      const target = typeof value === 'number' ? value : null;
      if (tween && target !== null) {
        const from = Number(c.textContent) || 0;
        return global.U.tweenNumber(from, target, 520, (v) => { c.textContent = fmt(v); })
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
