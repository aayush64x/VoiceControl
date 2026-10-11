/* Live recording waveform, in the style of iPhone Voice Memos.

   While the panel is listening, the mic button is replaced by a strip:
   a new bar is added at the playhead every SAMPLE_MS from the current
   voice level (AgentPanel.mascot.level), and the history scrolls left.
   Right of the playhead is the empty dotted track. A timer counts up.
   The whole strip is the stop button (#stop-listen-btn in panel.js). */

(function () {
  'use strict';

  const P = window.AgentPanel;
  const canvas = document.getElementById('recorder-wave');
  const timeEl = document.getElementById('recorder-time');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const SAMPLE_MS = 60;     // one bar per 60 ms, about 16 bars a second
  const BAR = 3;
  const GAP = 3;
  const STEP = BAR + GAP;
  const PLAYHEAD = 0.62;    // playhead position, share of the width
  const TOP = 22;           // room for the timer

  let samples = [];
  let startAt = 0;
  let lastSample = 0;
  let raf = 0;
  let w = 0;
  let h = 0;
  let colors = null;

  const reduced = () => document.documentElement.classList.contains('reduce-motion')
    || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    const v = (n) => cs.getPropertyValue(n).trim();
    return { sky: v('--c-sky'), lav: v('--c-lavender'), action: v('--c-action'), dot: 'rgba(36, 50, 71, 0.18)' };
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function fmt(ms) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function draw(now) {
    raf = requestAnimationFrame(draw);
    if (!w) resize();

    while (now - lastSample >= SAMPLE_MS) {
      lastSample += SAMPLE_MS;
      // sqrt lifts quiet speech so the graph reads like Voice Memos
      samples.push(Math.sqrt(Math.max(0, Math.min(1, P.mascot.level))));
      if (samples.length > 600) samples.shift();
    }
    const frac = reduced() ? 0 : (now - lastSample) / SAMPLE_MS;

    ctx.clearRect(0, 0, w, h);
    const mid = TOP + (h - TOP) / 2;
    const maxH = h - TOP - 6;
    const px = Math.round(w * PLAYHEAD);

    // empty track ahead of the playhead
    ctx.fillStyle = colors.dot;
    for (let x = px + 6; x < w - 2; x += 6) ctx.fillRect(x, mid - 0.75, 1.5, 1.5);

    // recorded bars, newest at the playhead
    const grad = ctx.createLinearGradient(0, mid - maxH / 2, 0, mid + maxH / 2);
    grad.addColorStop(0, colors.lav);
    grad.addColorStop(0.5, colors.sky);
    grad.addColorStop(1, colors.lav);
    ctx.fillStyle = grad;
    const n = samples.length;
    for (let i = n - 1; i >= 0; i--) {
      const x = px - 4 - (n - 1 - i) * STEP - frac * STEP;
      if (x < -BAR) break;
      const bh = Math.max(3, (0.04 + samples[i] * 0.96) * maxH);
      ctx.globalAlpha = Math.min(1, Math.max(0, x / (w * 0.22)));   // fade at the left edge
      ctx.beginPath();
      ctx.roundRect(x - BAR, mid - bh / 2, BAR, bh, BAR / 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // playhead
    ctx.fillStyle = colors.action;
    ctx.fillRect(px - 1, TOP - 4, 2, h - TOP);
    ctx.beginPath();
    ctx.arc(px, TOP - 4, 3.5, 0, Math.PI * 2);
    ctx.arc(px, h - 4, 3.5, 0, Math.PI * 2);
    ctx.fill();

    timeEl.textContent = fmt(now - startAt);
  }

  function start() {
    cancelAnimationFrame(raf);
    colors = readColors();
    samples = [];
    startAt = lastSample = performance.now();
    w = 0;
    raf = requestAnimationFrame(draw);
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  new ResizeObserver(() => { if (raf) resize(); }).observe(canvas);

  let listening = false;
  function sync() {
    const now = document.body.dataset.state === 'listening';
    if (now === listening) return;
    listening = now;
    if (now) start(); else stop();
  }
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['data-state'] });
  sync();   // the panel may already be listening when this loads
})();
