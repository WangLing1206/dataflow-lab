/* =============================================================
   util.js · 通用工具
   ============================================================= */
(function (global) {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v);
      }
    }
    (children || []).forEach((c) => {
      if (c === null || c === undefined) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  /** 可取消的等待：token = {cancelled:boolean} */
  function sleep(ms, token) {
    return new Promise((resolve, reject) => {
      if (token && token.cancelled) return reject({ cancelled: true });
      const t = setTimeout(() => {
        if (token && token.cancelled) return reject({ cancelled: true });
        resolve();
      }, Math.max(0, ms));
      if (token) {
        token._timers = token._timers || [];
        token._timers.push(t);
      }
    });
  }

  function makeToken() {
    return {
      cancelled: false,
      cancel() {
        this.cancelled = true;
        (this._timers || []).forEach(clearTimeout);
        this._timers = [];
      },
    };
  }

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /** 数字格式化：保留有效小数，整数不带点 */
  function fmt(v, digits) {
    if (v === null || v === undefined || v === '') return '';
    if (typeof v === 'number') {
      if (!isFinite(v)) return String(v);
      if (Number.isInteger(v)) return String(v);
      const d = digits === undefined ? 2 : digits;
      return String(Number(v.toFixed(d)));
    }
    return String(v);
  }

  /** 数值补间动画（返回 Promise） */
  function tweenNumber(from, to, ms, onUpdate) {
    return new Promise((resolve) => {
      const start = performance.now();
      const diff = to - from;
      function frame(now) {
        const p = clamp((now - start) / Math.max(1, ms), 0, 1);
        const e = 1 - Math.pow(1 - p, 3);
        onUpdate(from + diff * e);
        if (p < 1) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
  }

  let toastTimer = null;
  function toast(msg, ms) {
    const box = $('#toast');
    if (!box) return;
    box.textContent = msg;
    box.hidden = false;
    box.style.animation = 'none';
    void box.offsetWidth;
    box.style.animation = '';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { box.hidden = true; }, ms || 2200);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /** 简易 seeded random（用于可复现的采样） */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  global.U = { $, $$, el, sleep, makeToken, clamp, fmt, tweenNumber, toast, escapeHtml, mulberry32 };
})(window);
