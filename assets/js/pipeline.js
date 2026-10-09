/* =============================================================
   pipeline.js · 流水线模型 + 操作库 / 步骤卡片 UI
   ============================================================= */
(function (global) {
  'use strict';
  const { el, toast } = global.U;
  const D = global.DF;

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
          trace: [{ t: 'say', badge: '跳过', title: '该步骤无法执行：' + s.error, sub: '请调整参数或前置步骤' }],
        };
      }
      s.dfAfter = s.result.df;
      s.code = op.code(s.params);
    }
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
      state.steps.push(step);
      try {
        step.result = global.OPS[d.op].run(df, params);
        step.dfAfter = step.result.df;
        step.code = global.OPS[d.op].code(params);
        df = step.dfAfter;
      } catch (e) {
        step.error = e.message;
        step.dfAfter = df;
      }
    });
  }

  /* ---------------- 操作库 UI ---------------- */
  function renderOpLibrary(app) {
    const box = document.getElementById('opLibrary');
    box.innerHTML = '';
    const map = global.OPS.byCat();
    const df = app.currentDf();
    map.forEach((ops, cat) => {
      if (!ops.length) return;
      const g = el('div', { class: 'op-group' }, [el('div', { class: 'op-group-title', text: cat })]);
      ops.forEach((op) => {
        g.appendChild(el('button', {
          class: 'op-item', title: op.desc,
          onclick: () => app.addStep(op.id),
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
    void df;
  }

  /* ---------------- 流水线 UI ---------------- */
  function renderPipeline(app) {
    const wrap = document.getElementById('pipeline');
    const state = app.state;
    wrap.innerHTML = '';

    // 数据源节点
    const selIdx0 = app.selectedStep !== undefined && app.selectedStep >= 0 ? app.selectedStep : app.viewIndex - 1;
    const srcActive = app.runningIndex < 0 && selIdx0 < 0;
    const src = el('div', {
      class: 'step-card' + (srcActive ? ' is-active' : '') + (app.viewIndex > 0 ? ' is-done' : ''),
      onclick: () => app.goto(0),
    }, [
      el('div', { class: 'step-top' }, [
        el('span', { class: 'step-idx', text: '0' }),
        el('span', { class: 'step-title', text: '原始数据' }),
      ]),
      el('div', { class: 'step-sub', text: `${state.base.length} 行 × ${state.base.columns.length} 列` }),
    ]);
    wrap.appendChild(src);

    state.steps.forEach((s, i) => {
      if (i > 0) wrap.appendChild(el('div', { class: 'connector' + (app.viewIndex > i ? ' done' : '') }));
      else wrap.appendChild(el('div', { class: 'connector' + (app.viewIndex > 0 ? ' done' : '') }));

      const op = global.OPS[s.op];
      const selIdx = app.selectedStep !== undefined && app.selectedStep >= 0 ? app.selectedStep : app.viewIndex - 1;
      const activeIdx = app.runningIndex >= 0 ? app.runningIndex : selIdx;
      const active = activeIdx === i;
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
        el('div', { class: 'step-sub', text: op.title(s.params) || op.desc }),
        el('div', { class: 'step-tools' }, [
          el('button', { text: '↑', title: '上移', onclick: (e) => { e.stopPropagation(); app.moveStep(i, -1); } }),
          el('button', { text: '↓', title: '下移', onclick: (e) => { e.stopPropagation(); app.moveStep(i, 1); } }),
          el('button', { text: '✕', title: '删除', onclick: (e) => { e.stopPropagation(); app.removeStep(i); } }),
        ]),
      ]);

      if (s.error) card.appendChild(el('div', { class: 'step-sub', style: 'color:#ff6b8a', text: '⚠ ' + s.error }));
      if (active) card.appendChild(renderParams(app, s, i));
      wrap.appendChild(card);
    });

    // 让当前步骤卡片自动滚入视野（横向），长流水线也能始终看到"正在进行的那一步"
    requestAnimationFrame(() => {
      const card = wrap.querySelector('.step-card.is-active');
      if (!card) return;
      const target = card.offsetLeft - wrap.clientWidth / 2 + card.clientWidth / 2;
      wrap.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
    });
  }

  function renderParams(app, step, index) {
    const df = step.dfBefore || app.state.base;
    const op = global.OPS[step.op];
    const defs = op.params(df);
    const box = el('div', { class: 'step-params' });
    defs.forEach((d) => {
      const row = el('div', { class: 'param-row' }, [el('label', { text: d.label })]);
      let input;
      if (d.type === 'cols') {
        const wrapTags = el('div', { class: 'col-multi' });
        d.options.forEach((c) => {
          const on = (step.params[d.key] || []).includes(c);
          wrapTags.appendChild(el('span', {
            class: 'tag' + (on ? ' on' : ''), text: c,
            onclick: () => {
              const arr = (step.params[d.key] || []).slice();
              const k = arr.indexOf(c);
              if (k >= 0) arr.splice(k, 1); else arr.push(c);
              step.params[d.key] = arr;
              app.onParamsChanged(index);
            },
          }));
        });
        input = wrapTags;
      } else if (d.type === 'col' || d.type === 'select') {
        const sel = el('select', {
          onchange: (e) => { step.params[d.key] = e.target.value; app.onParamsChanged(index); },
        });
        d.options.forEach((o) => {
          sel.appendChild(el('option', { value: o, text: o, selected: step.params[d.key] === o }));
        });
        if (!d.options.includes(step.params[d.key])) {
          sel.insertBefore(el('option', { value: step.params[d.key], text: step.params[d.key] + '（不存在）', selected: true }), sel.firstChild);
        }
        input = sel;
      } else if (d.type === 'number') {
        input = el('input', {
          type: 'number', value: step.params[d.key], min: d.min, max: d.max,
          onchange: (e) => { step.params[d.key] = Number(e.target.value); app.onParamsChanged(index); },
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

  global.Pipe = { defaultsFor, computeFrom, dfAt, buildFromDemo, renderOpLibrary, renderPipeline };
})(window);
