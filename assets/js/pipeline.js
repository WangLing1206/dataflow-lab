/* =============================================================
   pipeline.js · 流水线模型 + 操作库 / 步骤卡片 UI（全量 i18n）
   ============================================================= */
(function (global) {
  'use strict';
  const { el, toast } = global.U;
  const I = global.I18n;

  /* ---------------- 模型 ---------------- */
  function defaultsFor(opId, df) {
    const op = global.OPS[opId];
    const defs = op.params(df);
    const out = {};
    defs.forEach((d) => { out[d.key] = Array.isArray(d.default) ? d.default.slice() : d.default; });
    return out;
  }

  function computeFrom(state, from) {
    for (let i = from; i < state.steps.length; i++) {
      const s = state.steps[i];
      const df = i === 0 ? state.base : state.steps[i - 1].dfAfter;
      if (!df) break;
      s.dfBefore = df;
      const op = global.OPS[s.op];
      try {
        s.result = op.run(df, s.params);
        s.error = null;
      } catch (e) {
        s.error = e.message || String(e);
        s.result = {
          df: df.clone(),
          code: '# ' + s.error,
          trace: [saySkip(s.error)],
        };
      }
      s.dfAfter = s.result.df;
      s.code = op.code(s.params, df);
    }
  }

  function saySkip(err) {
    return { t: 'say', key: 'msg.stepError', args: { err }, badge: 'skip' };
  }

  function dfAt(state, index) {
    if (index <= 0) return state.base;
    const s = state.steps[index - 1];
    return s && s.dfAfter ? s.dfAfter : state.base;
  }

  function buildFromDemo(state, demo) {
    state.steps = [];
    let df = state.base;
    (demo || []).forEach((d) => {
      if (!global.OPS[d.op]) return;
      const params = Object.assign(defaultsFor(d.op, df), d.params || {});
      const step = { id: 's' + Math.random().toString(36).slice(2, 8), op: d.op, params, enabled: true };
      step.dfBefore = df;
      state.steps.push(step);
      try {
        step.result = global.OPS[d.op].run(df, params);
        step.dfAfter = step.result.df;
        step.code = global.OPS[d.op].code(params, df);
        step.error = null;
        df = step.dfAfter;
      } catch (e) {
        step.error = e.message;
        step.result = { df: df.clone(), code: '#' + e.message, trace: [saySkip(e.message)] };
        step.dfAfter = df;
      }
    });
  }

  /* ---------------- 操作库 UI ---------------- */
  function renderOpLibrary(app) {
    const box = document.getElementById('opLibrary');
    box.innerHTML = '';
    global.OPS.byCat().forEach((pair) => {
      const cat = pair[0], ops = pair[1];
      const g = el('div', { class: 'op-group' }, [el('div', { class: 'op-group-title', text: global.OPS.catName(cat) })]);
      ops.forEach((id, i) => {
        const op = global.OPS[id];
        g.appendChild(el('button', {
          class: 'op-item', title: op.desc, style: `animation-delay:${Math.min(i * 26, 300)}ms`,
          onclick: () => app.addStep(id),
        }, [
          el('span', { class: 'op-ico', text: op.icon }),
          el('span', {}, [
            el('div', { class: 'op-name', text: op.name }),
            el('div', { class: 'op-desc', text: op.desc }),
          ]),
        ]));
      });
      box.appendChild(g);
    });
  }

  /* ---------------- 流水线 UI ---------------- */
  function renderPipeline(app) {
    const wrap = document.getElementById('pipeline');
    const state = app.state;
    wrap.innerHTML = '';

    const selIdx0 = activeIndex(app);
    const srcActive = app.runningIndex < 0 && selIdx0 < 0;
    const src = el('div', {
      class: 'step-card' + (srcActive ? ' is-active' : '') + (app.viewIndex > 0 ? ' is-done' : ''),
      onclick: () => app.goto(0),
    }, [
      el('div', { class: 'step-top' }, [
        el('span', { class: 'step-idx', text: '0' }),
        el('span', { class: 'step-title', text: I.t('ui.sourceNode') }),
      ]),
      el('div', { class: 'step-sub', text: I.t('ui.shape', { r: state.base.length, c: state.base.columns.length }) }),
    ]);
    wrap.appendChild(src);

    state.steps.forEach((s, i) => {
      wrap.appendChild(el('div', { class: 'connector' + (app.viewIndex > i ? ' done' : '') }));
      const op = global.OPS[s.op];
      const active = activeIndex(app) === i;
      const done = app.runningIndex < 0 && app.viewIndex > i + 1;
      const card = el('div', {
        class: 'step-card' + (active ? ' is-active' : '') + (done ? ' is-done' : '')
          + (app.runningIndex === i ? ' is-running' : '') + (s.enabled === false ? ' is-disabled' : ''),
        onclick: (e) => { if (e.target.closest('button, select, input')) return; app.selectStep(i); },
      }, [
        el('div', { class: 'step-top' }, [
          el('span', { class: 'step-idx', text: String(i + 1) }),
          el('span', { class: 'step-title', text: op.icon + ' ' + op.name }),
        ]),
        el('div', { class: 'step-sub', text: op.title(s.params, s.dfBefore || state.base) }),
        el('div', { class: 'step-tools' }, [
          el('button', { text: '↑', title: I.t('ui.up'), onclick: (e) => { e.stopPropagation(); app.moveStep(i, -1); } }),
          el('button', { text: '↓', title: I.t('ui.down'), onclick: (e) => { e.stopPropagation(); app.moveStep(i, 1); } }),
          el('button', { text: '✕', title: I.t('ui.del'), onclick: (e) => { e.stopPropagation(); app.removeStep(i); } }),
        ]),
      ]);
      if (s.error) card.appendChild(el('div', { class: 'step-sub', style: 'color:' + cssVar('--danger'), text: '⚠ ' + s.error }));
      if (active) card.appendChild(renderParams(app, s, i));
      wrap.appendChild(card);
    });

    requestAnimationFrame(() => {
      const card = wrap.querySelector('.step-card.is-active');
      if (!card) return;
      const target = card.offsetLeft - wrap.clientWidth / 2 + card.clientWidth / 2;
      wrap.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
    });
  }

  function activeIndex(app) {
    if (app.runningIndex >= 0) return app.runningIndex;
    if (app.selectedStep !== undefined && app.selectedStep >= 0) return app.selectedStep;
    return app.viewIndex - 1;
  }
  function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#e5484d'; }

  function renderParams(app, step, index) {
    const df = step.dfBefore || app.state.base;
    const op = global.OPS[step.op];
    const defs = op.params(df);
    const box = el('div', { class: 'step-params' });
    defs.forEach((d) => {
      const row = el('div', { class: 'param-row' }, [el('label', { text: I.pl(op.id, d.key) })]);
      let input;
      if (d.type === 'cols') {
        const wrapTags = el('div', { class: 'col-multi' });
        d.options.forEach((o) => {
          const on = (step.params[d.key] || []).indexOf(o.v) >= 0;
          wrapTags.appendChild(el('span', {
            class: 'tag' + (on ? ' on' : ''), text: o.l,
            onclick: () => {
              const arr = (step.params[d.key] || []).slice();
              const k = arr.indexOf(o.v);
              if (k >= 0) arr.splice(k, 1); else arr.push(o.v);
              step.params[d.key] = arr;
              app.onParamsChanged(index);
            },
          }));
        });
        input = wrapTags;
      } else if (d.type === 'col' || d.type === 'select') {
        const sel = el('select', { onchange: (e) => { step.params[d.key] = e.target.value; app.onParamsChanged(index); } });
        d.options.forEach((o) => sel.appendChild(el('option', { value: o.v, text: o.l, selected: step.params[d.key] === o.v })));
        if (!d.options.some((o) => o.v === step.params[d.key])) {
          sel.insertBefore(el('option', { value: step.params[d.key], text: step.params[d.key] + I.t('ui.notExist'), selected: true }), sel.firstChild);
        }
        input = sel;
      } else if (d.type === 'number') {
        input = el('input', {
          type: 'number', value: step.params[d.key], min: d.min, max: d.max,
          onchange: (e) => { step.params[d.key] = Number(e.target.value); app.onParamsChanged(index); },
        });
      } else if (d.type === 'name') {
        const cur = resolveName(step.params[d.key]);
        input = el('input', {
          type: 'text', value: cur.name,
          onchange: (e) => {
            const typed = e.target.value;
            step.params[d.key] = (typed === cur.name) ? step.params[d.key] : typed;
            app.onParamsChanged(index);
          },
        });
      } else {
        input = el('input', {
          type: 'text', value: step.params[d.key],
          onchange: (e) => { step.params[d.key] = e.target.value; app.onParamsChanged(index); },
        });
      }
      row.appendChild(input);
      box.appendChild(row);
    });
    return box;
  }

  function resolveName(v) {
    const s = String(v || '');
    if (s.charAt(0) === '@') return { key: s.slice(1), name: I.t('colname.' + s.slice(1)) };
    return { key: s, name: s };
  }

  global.Pipe = { defaultsFor, computeFrom, dfAt, buildFromDemo, renderOpLibrary, renderPipeline };
})(window);
