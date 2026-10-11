/* Mascot renderer switch.

   Three ways to draw the mascot, chosen in the ··· menu:
     three   local Three.js recreation of the Spline orb (default; reacts to voice)
     spline  the original Spline scene in an iframe (needs network; can't
             follow voice or panel states, since it is a cross-origin page)
     css     the earlier CSS glass blob (no WebGL; lightest)

   Chosen in Settings → Mascot. Whatever is chosen, the halo, rings, badges, status text and the
   state machine stay the same. If WebGL fails, or the Spline embed
   doesn't load in time, the panel falls back to the next option.

   Settings also shows a live readout (load time, FPS, JS heap) so the
   options can be compared on the demo laptop. A cross-origin iframe's
   memory is not part of this page's heap; check Chrome's Task Manager
   (Shift+Esc), which lists the side panel and the Spline subframe. */

const SPLINE_URL = 'https://my.spline.design/aiassistanthoverandclickinteraction-7yFCdoBgUTHnlSjQc483FxY1/';
const SPLINE_TIMEOUT_MS = 10000;

const P = window.AgentPanel;
const controller = P.mascot;
const host = document.getElementById('mascot');
const diag = document.getElementById('mascot-diag');
const radios = Array.from(document.querySelectorAll('input[name="renderer"]'));
const eyesToggle = document.getElementById('pref-eyes');
const splineAllowed = !window.__NO_SPLINE;

const store = {
  get(k, d) { try { const v = localStorage.getItem('va:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('va:' + k, JSON.stringify(v)); } catch { /* blocked */ } },
};

let active = null;     // { kind, dispose, stats }
let note = '';

/* ---------- renderers ---------- */

async function mountThree() {
  // Loaded on demand so the CSS and Spline options never pay for Three.js.
  // (The single-file preview build pre-registers the module on window.)
  const { createGlassMascot } = window.__createGlassMascot
    ? { createGlassMascot: window.__createGlassMascot }
    : await import('./mascot-gl.js');
  const r = createGlassMascot(host, controller);
  return { kind: 'three', ...r };
}

function mountSpline() {
  return new Promise((resolve, reject) => {
    if (!splineAllowed) { reject(new Error('Embedding other sites is blocked on this page')); return; }
    if (navigator.onLine === false) { reject(new Error('Offline')); return; }
    const t0 = performance.now();
    const wrap = document.createElement('div');
    wrap.className = 'mascot__spline';
    const frame = document.createElement('iframe');
    frame.src = SPLINE_URL;
    frame.title = 'Voice Agent mascot';
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.loading = 'eager';
    frame.referrerPolicy = 'no-referrer';
    frame.setAttribute('allow', '');
    wrap.append(frame);
    host.prepend(wrap);

    const stats = { renderer: 'spline', loadMs: 0 };
    const timer = setTimeout(() => {
      wrap.remove();
      reject(new Error(`No response after ${SPLINE_TIMEOUT_MS / 1000}s`));
    }, SPLINE_TIMEOUT_MS);

    // `load` fires when the document arrives. The 3D scene keeps streaming
    // in after that, so the fade-in waits a moment longer.
    frame.addEventListener('load', () => {
      clearTimeout(timer);
      stats.loadMs = Math.round(performance.now() - t0);
      setTimeout(() => wrap.classList.add('is-ready'), 600);
      resolve({ kind: 'spline', stats, dispose() { wrap.remove(); } });
    }, { once: true });
  });
}

function mountCss() {
  return { kind: 'css', stats: { renderer: 'css', loadMs: 0 }, dispose() {} };
}

const MOUNT = { three: mountThree, spline: mountSpline, css: mountCss };
const FALLBACK = { spline: 'three', three: 'css', css: null };

let useSeq = 0;
async function use(kind) {
  const seq = ++useSeq;
  active?.dispose();
  active = null;
  host.dataset.renderer = 'css';
  controller.cssBody = true;
  note = '';
  let want = kind;
  while (want) {
    try {
      const r = await MOUNT[want]();
      if (seq !== useSeq) { r.dispose(); return; }   // a newer choice won
      active = r;
      host.dataset.renderer = r.kind;
      controller.cssBody = r.kind === 'css';
      break;
    } catch (err) {
      note = `${label(want)} unavailable (${err.message}). Using ${label(FALLBACK[want])}.`;
      console.warn('[mascot]', note);
      want = FALLBACK[want];
    }
  }
  radios.forEach((r) => { r.checked = r.value === (active?.kind || 'css'); });
  renderDiag();
}

function label(kind) {
  return { three: '3D', spline: 'Spline', css: 'Light' }[kind] || kind;
}

/* ---------- diagnostics ---------- */

let fpsSamples = [];
let fpsLast = performance.now();
function sampleFps(now) {
  // Page-level frame rate (what the user feels), independent of renderer.
  fpsSamples.push(now - fpsLast);
  fpsLast = now;
  if (fpsSamples.length > 60) fpsSamples.shift();
  if (!diag.closest('[hidden]')) requestAnimationFrame(sampleFps);
}

function renderDiag() {
  if (!diag) return;
  const s = active?.stats || {};
  const parts = [`Renderer: ${label(active?.kind || 'css')}`];
  if (s.loadMs) parts.push(`ready in ${s.loadMs} ms`);
  if (fpsSamples.length > 10) {
    const avg = fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length;
    parts.push(`${Math.round(1000 / avg)} fps`);
  }
  if (performance.memory) parts.push(`JS heap ${(performance.memory.usedJSHeapSize / 1048576).toFixed(0)} MB`);
  if (active?.kind === 'spline') parts.push('iframe memory: see Shift+Esc');
  diag.textContent = parts.join(' · ') + (note ? `\n${note}` : '');
}

const menu = document.getElementById('settings');
new MutationObserver(() => {
  if (!menu.hidden) {
    fpsSamples = [];
    fpsLast = performance.now();
    requestAnimationFrame(sampleFps);
    renderDiag();
  }
}).observe(menu, { attributes: true, attributeFilter: ['hidden'] });
setInterval(() => { if (!menu.hidden) renderDiag(); }, 1000);

/* ---------- prefs ---------- */

radios.forEach((r) => {
  if (r.value === 'spline' && !splineAllowed) r.closest('label').hidden = true;
  r.addEventListener('change', () => {
    if (!r.checked) return;
    store.set('renderer', r.value);
    use(r.value);
  });
});

eyesToggle.checked = store.get('eyes', false);
host.dataset.eyes = eyesToggle.checked ? 'on' : 'off';
eyesToggle.addEventListener('change', () => {
  store.set('eyes', eyesToggle.checked);
  host.dataset.eyes = eyesToggle.checked ? 'on' : 'off';
});

const params = new URLSearchParams(location.search);
use(params.get('renderer') || store.get('renderer', 'three'));

window.MascotRenderer = { use, get active() { return active; } };
