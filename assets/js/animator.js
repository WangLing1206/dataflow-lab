/* =============================================================
   animator.js · 动画剧本播放器
   把 operations 生成的 trace 事件逐个播放出来：
   扫描 → 比较 → 标记 → 删除 → 填充 → 聚合 → 落定
   ============================================================= */
(function (global) {
  'use strict';
  const { sleep, fmt } = global.U;
  const D = global.DF;

  class Animator {
    constructor(view, hooks) {
      this.view = view;
      this.hooks = hooks || {};
      this.speed = 1;
      this.token = null;
    }

    cancel() { if (this.token) this.token.cancel(); }

    /** 播放一条操作结果 */
    async play(result, opts) {
      opts = opts || {};
      const speed = opts.speed || 1;
      const token = opts.token || global.U.makeToken();
      this.token = token;
      this.speed = speed;
      const view = this.view;
      const trace = result.trace || [];
      const t = (ms) => sleep(ms / speed, token);

      if (opts.instant) {
        this.hooks.say && this.hooks.say({
          badge: '完成',
          title: result.trace && result.trace.length ? (result.trace[0].title || '执行完成') : '执行完成',
          sub: '已跳过过程动画，直接给出结果',
        });
        view.setData(result.df);
        this.hooks.progress && this.hooks.progress(1);
        return;
      }

      let step = 0;
      for (const ev of trace) {
        step++;
        this.hooks.progress && this.hooks.progress(step / trace.length);
        switch (ev.t) {
          case 'say': await this.evSay(ev, t); break;
          case 'hud': this.hooks.hud && this.hooks.hud(ev.show, null); await t(160); break;
          case 'wait': await t(ev.ms || 300); break;
          case 'scan': await this.evScan(ev, t, speed); break;
          case 'mark': await this.evMark(ev, t); break;
          case 'drop': await this.evDrop(ev, t, speed); break;
          case 'fill': await this.evFill(ev, t); break;
          case 'addcol': await this.evAddCol(ev, t, speed); break;
          case 'removecol': await this.evRemoveCol(ev, t); break;
          case 'rename': await this.evRename(ev, t); break;
          case 'group': await this.evGroup(ev, t); break;
          case 'agg': await this.evAgg(ev, t, speed); break;
          case 'settle': await this.evSettle(ev, result, t); break;
          default: break;
        }
      }
      this.hooks.progress && this.hooks.progress(1);
    }

    /* ---------------- 事件实现 ---------------- */
    async evSay(ev, t) {
      this.hooks.say && this.hooks.say({ badge: ev.badge || '运行', title: ev.title || '', sub: ev.sub || '' });
      await t(ev.hold || 820);
    }

    async evScan(ev, t, speed) {
      const view = this.view;
      const per = ev.per || 80;
      const hud = !!ev.hud;

      if (ev.mode === 'cells') {
        const cells = ev.cellItems || [];
        let found = 0;
        for (const c of cells) {
          view.probe(c.id, c.col);
          view.markCell(c.id, c.col, 'mark-max');
          view.markRow(c.id, 'row-drop');
          found++;
          hud && this.hooks.hud && this.hooks.hud(true, {
            count: found, total: cells.length,
            rows: [
              { label: '已发现缺失', value: found, cls: 'hud-max' },
              { label: '当前列', value: c.col },
              { label: '标记', value: '⌀ 空值' },
            ],
          });
          await t(per);
        }
        view.clearProbe();
        return;
      }

      const items = ev.items || [];
      const col = ev.col;
      let minV = Infinity, maxV = -Infinity, minId = null, maxId = null;
      let pass = 0, fail = 0, idx = 0;

      for (const it of items) {
        idx++;
        view.probe(it.id, col);
        if (ev.track === 'minmax' && it.v !== null && it.v !== undefined) {
          if (it.v < minV) {
            if (minId !== null) { view.unmarkCell(minId, col, 'mark-min'); view.unmarkRow(minId, 'row-min'); }
            minV = it.v; minId = it.id;
            view.markCell(minId, col, 'mark-min'); view.markRow(minId, 'row-min');
          }
          if (it.v > maxV) {
            if (maxId !== null) { view.unmarkCell(maxId, col, 'mark-max'); view.unmarkRow(maxId, 'row-max'); }
            maxV = it.v; maxId = it.id;
            view.markCell(maxId, col, 'mark-max'); view.markRow(maxId, 'row-max');
          }
          hud && this.hooks.hud && this.hooks.hud(true, {
            count: idx, total: items.length,
            rows: [
              { label: '当前最小', value: minId === null ? '–' : fmt(minV), cls: 'hud-min' },
              { label: '当前最大', value: maxId === null ? '–' : fmt(maxV), cls: 'hud-max' },
              { label: '当前值', value: fmt(it.v) },
            ],
          });
        } else if (ev.track === 'flag') {
          if (it.flag === 'pass') { view.markCell(it.id, col, 'mark-hit'); pass++; }
          else {
            fail++;
            view.markCell(it.id, col, 'mark-max');
            if (it.flag === 'dup') view.markRow(it.id, 'row-dup');
            else if (it.flag === 'outlier') view.markRow(it.id, 'row-drop');
            else view.flashRow(it.id, 'bad');
          }
          hud && this.hooks.hud && this.hooks.hud(true, {
            count: idx, total: items.length,
            rows: [
              { label: ev.keepLabel || '命中', value: pass, cls: 'hud-min' },
              { label: ev.dropLabel || '剔除', value: fail, cls: 'hud-max' },
              { label: '当前行', value: it.flag === 'pass' ? '命中' : '剔除' },
            ],
          });
        } else {
          view.markCell(it.id, col, 'mark-hit');
          hud && this.hooks.hud && this.hooks.hud(true, {
            count: idx, total: items.length,
            rows: [{ label: '已读取', value: `${idx} / ${items.length}` }],
          });
        }
        await t(per);
      }
      view.clearProbe();
      if (ev.track === 'minmax') { minId = maxId = null; }
    }

    async evMark(ev, t) {
      const view = this.view;
      for (const r of ev.rows || []) {
        view.markRow(r.id, r.kind);
        if (ev.col) view.markCell(r.id, ev.col, r.kind === 'row-min' ? 'mark-min' : 'mark-max');
        await t(45);
      }
      await t(320);
    }

    async evDrop(ev, t, speed) {
      const view = this.view;
      const ids = ev.ids || [];
      if (!ids.length) return;
      this.hooks.say && this.hooks.say({
        badge: '删除',
        title: `开始删除：${ids.length} 行（${ev.label || '不满足条件'}）`,
        sub: '红色标记的行会依次淡出并收起，剩余行自然上移',
      });
      const gap = U.clamp(260 / ids.length, 22, 90);
      await view.dropRows(ids, { gap, token: this.token });
    }

    async evFill(ev, t) {
      const view = this.view;
      const cells = ev.cells || [];
      for (const c of cells) {
        view.scrollTo(c.id);
        await view.setCell(c.id, c.col, c.v, true);
        await t(ev.per || 180);
      }
      await t(200);
    }

    async evAddCol(ev, t, speed) {
      const view = this.view;
      const col = ev.col;
      // 1) 先插入空列（右侧滑入）
      const tmp = view.df.clone();
      if (!tmp.columns.some((c) => c.name === col)) tmp.columns.push({ name: col, type: 'number' });
      tmp.rows.forEach((r) => { r[col] = null; });
      view.setData(tmp, { silent: true });
      const h = view.headEl(col);
      if (h) h.classList.add('newcol');
      view.body.querySelectorAll(`.dtd[data-col="${col}"]`).forEach((c) => c.classList.add('newcol'));
      this.hooks.say && this.hooks.say({
        badge: '变换',
        title: `插入新列「${col}」`,
        sub: `计算方式：${ev.formula || '逐行计算'}`,
      });
      await t(420);
      // 2) 逐行填充（数字滚动）
      const cells = ev.cells || [];
      const per = ev.per || 60;
      for (const c of cells) {
        const td = view.cellEl(c.id, col);
        if (td) {
          td.classList.remove('is-null', 'newcol');
          td.classList.add('num');
          await global.U.tweenNumber(0, c.v === null ? 0 : c.v, 420, (v) => { td.textContent = fmt(v); });
          td.textContent = c.v === null ? '' : fmt(c.v);
        }
        await t(per);
      }
      await t(260);
    }

    async evRemoveCol(ev, t) {
      const view = this.view;
      for (const c of ev.cols || []) {
        view.dimColumn(c, true);
        await t(140);
      }
      await t(320);
    }

    async evRename(ev, t) {
      const view = this.view;
      view.flipHeader(ev.from);
      await t(260);
      const h = view.headEl(ev.from);
      if (h) {
        h.querySelector('span').textContent = ev.to;
        h.dataset.col = ev.to;
      }
      view.body.querySelectorAll(`.dtd[data-col="${ev.from}"]`).forEach((c) => { c.dataset.col = ev.to; });
      await t(340);
    }

    async evGroup(ev, t) {
      const view = this.view;
      const groups = ev.groups || [];
      for (const g of groups) {
        for (const id of g.ids) view.groupRow(id, g.gi);
        await t(30);
      }
      await t(240);
      const order = [];
      groups.forEach((g) => g.ids.forEach((id) => order.push(id)));
      view.flip(() => view.reorder(order));
      await t(620);
    }

    async evAgg(ev, t, speed) {
      const view = this.view;
      const howName = { mean: '均值', sum: '求和', count: '计数', max: '最大值', min: '最小值', median: '中位数' }[ev.how] || ev.how;
      for (const g of ev.groups || []) {
        this.hooks.say && this.hooks.say({
          badge: '聚合',
          title: `组「${g.key}」：${g.n} 行 → ${howName} = ${fmt(g.value)}`,
          sub: `组内 ${g.n} 行先聚拢，再坍缩成 1 行汇总结果`,
        });
        g.ids.forEach((id) => view.flashRow(id, 'ok'));
        await t(320);
        await view.collapseInto(g.ids, g.ids[0], this.token);
      }
      await t(300);
    }

    async evSettle(ev, result, t) {
      const view = this.view;
      if (ev.mode === 'flip') {
        view.df = result.df;
        view.renumber();
        view.resetStates();
        await t(200);
      } else if (ev.mode === 'none') {
        view.df = result.df;
        await t(120);
      } else {
        view.resetStates();
        await t(120);
        view.setData(result.df);
        await t(360);
      }
    }
  }

  const U = global.U;
  global.Animator = Animator;
})(window);
