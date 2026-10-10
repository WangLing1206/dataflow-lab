/* =============================================================
   animator.js · 动画剧本播放器
   把 operations 生成的 trace 事件逐个播放出来：
   扫描 → 比较 → 标记 → 删除 → 填充 → 聚合 → 落定
   所有文案都通过 i18n key 在播放时解析，切换语言后重算即可
   ============================================================= */
(function (global) {
  'use strict';
  const U = global.U;
  const I = global.I18n;
  const { sleep, fmt, clamp } = U;

  function badgeText(key) {
    if (!key) return I.t('ui.badgeRun');
    const map = {
      ready: 'ui.badgeReady', run: 'ui.badgeRun', done: 'ui.badgeDone', del: 'ui.badgeDel',
      core: 'ui.badgeCore', agg: 'ui.badgeAgg', trans: 'ui.badgeTrans', skip: 'ui.badgeSkip',
      raw: 'ui.badgeRaw', step: 'ui.badgeStep',
    };
    return I.t(map[key] || 'ui.badgeRun');
  }

  class Animator {
    constructor(view, hooks) {
      this.view = view;
      this.hooks = hooks || {};
      this.token = null;
      this.speed = 1;
    }
    cancel() { if (this.token) this.token.cancel(); }

    async play(result, opts) {
      opts = opts || {};
      const speed = opts.speed || 1;
      this.speed = speed;
      const token = opts.token || U.makeToken();
      this.token = token;
      const view = this.view;
      const trace = result.trace || [];
      const t = (ms) => sleep(ms / speed, token);

      if (opts.instant) {
        this.hooks.say && this.hooks.say({
          badge: badgeText('done'),
          title: I.t('msg.instantOn'),
          sub: I.t('msg.skipSub'),
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
          case 'scan': await this.evScan(ev, t); break;
          case 'mark': await this.evMark(ev, t); break;
          case 'drop': await this.evDrop(ev, t); break;
          case 'fill': await this.evFill(ev, t); break;
          case 'addcol': await this.evAddCol(ev, t); break;
          case 'removecol': await this.evRemoveCol(ev, t); break;
          case 'rename': await this.evRename(ev, t); break;
          case 'reorder': await this.evReorder(ev, t); break;
          case 'group': await this.evGroup(ev, t); break;
          case 'agg': await this.evAgg(ev, t); break;
          case 'settle': await this.evSettle(ev, result, t); break;
          default: break;
        }
      }
      this.hooks.progress && this.hooks.progress(1);
    }

    sayOf(key, args) { return I.say(key, args); }

    /* ---------------- 事件实现 ---------------- */
    async evSay(ev, t) {
      const s = this.sayOf(ev.key, ev.args);
      this.hooks.say && this.hooks.say({ badge: badgeText(ev.badge), title: s.title, sub: s.sub });
      await t(ev.hold || 820);
    }

    async evScan(ev, t) {
      const view = this.view;
      const per = ev.per || 80;
      const hud = ev.hud !== false;

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
              { label: I.t('hud.found'), value: found, cls: 'hud-max' },
              { label: I.t('hud.col'), value: view.df ? view.df.nameOf(c.col) : c.col },
              { label: I.t('hud.mark'), value: '⌀' },
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
      const vals = [];

      for (const it of items) {
        idx++;
        view.probe(it.id, col);
        if (ev.track === 'minmax' && it.v !== null && it.v !== undefined) {
          vals.push(Number(it.v));
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
              { label: I.t('hud.min'), value: minId === null ? I.t('hud.dash') : fmt(minV), cls: 'hud-min' },
              { label: I.t('hud.max'), value: maxId === null ? I.t('hud.dash') : fmt(maxV), cls: 'hud-max' },
              { label: I.t('hud.cur'), value: fmt(it.v) },
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
              { label: I.t(ev.keepKey || 'hud.hit'), value: pass, cls: 'hud-min' },
              { label: I.t(ev.dropKey || 'hud.out'), value: fail, cls: 'hud-max' },
              { label: I.t('hud.curRow'), value: it.flag === 'pass' ? I.t('hud.hit') : I.t('hud.out') },
            ],
          });
        } else {
          view.markCell(it.id, col, 'mark-hit');
          hud && this.hooks.hud && this.hooks.hud(true, {
            count: idx, total: items.length,
            rows: [{ label: I.t('hud.read'), value: `${idx} / ${items.length}` }],
          });
        }
        // 图表参与过程：扫描时同步画出统计量的形成（每 2 项刷新一次，避免抖动）
        if (this.hooks.chart && (idx % 2 === 0 || idx === items.length)) {
          this.hooks.chart('scan', ev.track === 'minmax'
            ? { mode: 'minmax', values: vals.slice(), total: items.length }
            : { mode: 'flag', keep: pass, drop: fail, total: items.length });
        }
        await t(per);
      }
      view.clearProbe();
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

    async evDrop(ev, t) {
      const view = this.view;
      const ids = ev.ids || [];
      if (!ids.length) return;
      const s = this.sayOf('say.drop.start', {
        n: ids.length,
        label: I.t(ev.labelKey || 'drop.default', ev.labelArgs || {}),
      });
      this.hooks.say && this.hooks.say({ badge: badgeText('del'), title: s.title, sub: s.sub });
      await t(560);
      const gap = clamp(320 / ids.length, 22, 90);
      const p = view.dropRows(ids, { gap, token: this.token });
      // 图表同步：被删除的行从图形中"掉出"
      if (this.hooks.chart) this.hooks.chart('drop', { ids });
      await p;
    }

    async evFill(ev, t) {
      const view = this.view;
      const cells = ev.cells || [];
      for (const c of cells) {
        view.scrollTo(c.id);
        await view.setCell(c.id, c.col, c.v, true, Math.round(520 / this.speed));
        if (this.hooks.chart) this.hooks.chart('fill', { col: c.col });
        await t(ev.per || 180);
      }
      await t(200);
    }

    async evAddCol(ev, t) {
      const view = this.view;
      const col = ev.col;               // { key, name }
      const tmp = view.df.clone();
      if (!tmp.columns.some((c) => c.key === col.key)) {
        tmp.columns.push({ key: col.key, name: col.name, type: col.type || 'number' });
      }
      tmp.rows.forEach((r) => { r[col.key] = null; });
      view.setData(tmp, { silent: true });
      const h = view.headEl(col.key);
      if (h) h.classList.add('newcol');
      view.body.querySelectorAll('.dtd[data-col="' + col.key + '"]').forEach((c) => c.classList.add('newcol'));
      const s = this.sayOf('say.assign.add', { name: col.name });
      this.hooks.say && this.hooks.say({ badge: badgeText('trans'), title: s.title, sub: ev.formula || s.sub });
      await t(420);

      const cells = ev.cells || [];
      for (const c of cells) {
        const td = view.cellEl(c.id, col.key);
        if (td) {
          td.classList.remove('is-null', 'newcol');
          if (typeof c.v === 'number') td.classList.add('num');
          if (typeof c.v === 'number' && c.v !== null) {
            await U.tweenNumber(0, c.v, Math.round(420 / this.speed), (v) => { td.textContent = fmt(v); });
            td.textContent = fmt(c.v);
          } else {
            td.textContent = (c.v === null || c.v === undefined) ? '' : String(c.v);
          }
        }
        await t(ev.per || 55);
      }
      await t(240);
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
      view.flipHeader(ev.from.key);
      await t(260);
      const h = view.headEl(ev.from.key);
      if (h) {
        const sp = h.querySelector('span');
        if (sp) sp.textContent = ev.to.name;
      }
      await t(340);
    }

    async evReorder(ev, t) {
      const view = this.view;
      view.flip(() => view.reorder(ev.ids || []), 560);
      await t(620);
    }

    async evGroup(ev, t) {
      const view = this.view;
      const groups = ev.groups || [];
      for (const g of groups) {
        for (const id of g.ids) view.groupRow(id, g.gi);
        await t(30);
      }
      await t(240);
    }

    async evAgg(ev, t) {
      const view = this.view;
      for (const g of ev.groups || []) {
        const s = this.sayOf(ev.sayKey || 'say.groupby.agg', { key: g.key, n: g.n, how: I.opt('groupby', ev.how), v: fmt(g.value) });
        this.hooks.say && this.hooks.say({ badge: badgeText('agg'), title: s.title, sub: s.sub });
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
      if (this.hooks.chart) this.hooks.chart('settle', {});
    }
  }

  global.Animator = Animator;
})(window);
