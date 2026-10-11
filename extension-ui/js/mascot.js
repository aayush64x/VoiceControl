/* Mascot controller.
   Owns the voice level (--lvl) and the liquid-edge displacement.
   Level sources, in priority order:
     1. setLevel(v) from outside (e.g. the backend or a speech engine)
     2. the microphone, via startMic()  — real audio-reactive motion
     3. a synthetic speech-like signal, via simulate(true) — for demos
   Everything is optional: with no level source the mascot is still
   fully driven by CSS through data-state. */

(function () {
  'use strict';

  // Liquid edge strength per state (px of displacement), before voice level.
  const BASE_WOBBLE = {
    idle: 3, listening: 6, thinking: 5, working: 5,
    confirm: 2, done: 3, ask: 3, error: 2,
  };

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  class Mascot {
    constructor(el) {
      this.el = el;
      this.disp = document.querySelector('#m-liquid feDisplacementMap');
      this.state = el.dataset.state || 'idle';
      this.level = 0;
      this.target = 0;
      this.external = null;
      this.simulating = false;
      this.analyser = null;
      this.stream = null;
      this.buf = null;
      this.lastWritten = { lvl: -1, scale: -1 };
      this.reduced = this._prefersReduced();
      this.cssBody = true;      // false while a WebGL / Spline renderer replaces the CSS body
      this.subs = [];
      this._tick = this._tick.bind(this);
      requestAnimationFrame(this._tick);
    }

    setState(state) {
      this.state = state;
      this.el.dataset.state = state;
      if (state !== 'listening') {
        this.simulate(false);
        this.external = null;
      }
      this._notify();
    }

    /** Renderers subscribe to hear about state and reduced-motion changes. */
    subscribe(fn) {
      this.subs.push(fn);
      return () => { this.subs = this.subs.filter((f) => f !== fn); };
    }

    _notify() { this.subs.forEach((fn) => fn(this)); }

    /** Feed a 0..1 level from an outside source. Pass null to release. */
    setLevel(v) {
      this.external = v == null ? null : clamp(+v || 0, 0, 1);
    }

    simulate(on) { this.simulating = !!on; }

    setReducedMotion(on) { this.reduced = !!on || this._prefersReduced(); this._notify(); }

    /** Try to read the real microphone. Resolves true on success. */
    async startMic() {
      if (this.analyser) return true;
      try {
        if (!navigator.mediaDevices?.getUserMedia) return false;
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const src = ctx.createMediaStreamSource(this.stream);
        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 512;
        this.analyser.smoothingTimeConstant = 0.6;
        this.buf = new Uint8Array(this.analyser.fftSize);
        src.connect(this.analyser);
        this.ctx = ctx;
        return true;
      } catch (err) {
        this.stopMic();
        return false;
      }
    }

    stopMic() {
      this.stream?.getTracks().forEach((t) => t.stop());
      this.ctx?.close?.();
      this.stream = this.analyser = this.ctx = this.buf = null;
    }

    _prefersReduced() {
      return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        || document.documentElement.classList.contains('reduce-motion');
    }

    _micLevel() {
      this.analyser.getByteTimeDomainData(this.buf);
      let sum = 0;
      for (let i = 0; i < this.buf.length; i++) {
        const d = (this.buf[i] - 128) / 128;
        sum += d * d;
      }
      const rms = Math.sqrt(sum / this.buf.length);
      // Speech RMS sits roughly in 0.01..0.25; map it into 0..1 gently.
      return clamp((rms - 0.012) * 5.5, 0, 1);
    }

    _syntheticLevel(t) {
      // Syllable-ish envelope: a few incommensurate sines, gated into bursts.
      const s = t / 1000;
      const syll = Math.max(0, Math.sin(s * 9.1) * 0.6 + Math.sin(s * 5.3 + 1.2) * 0.4);
      const phrase = 0.55 + 0.45 * Math.sin(s * 1.3);
      const jitter = 0.15 * Math.sin(s * 23.7) * Math.sin(s * 3.1);
      return clamp(syll * phrase + jitter, 0, 1);
    }

    _tick(t) {
      const listening = this.state === 'listening';
      if (this.external != null) this.target = this.external;
      else if (listening && this.analyser) this.target = this._micLevel();
      else if (listening && this.simulating) this.target = this._syntheticLevel(t);
      else this.target = 0;

      // Fast attack, slow release reads as "breathing with the voice".
      const k = this.target > this.level ? 0.35 : 0.08;
      this.level += (this.target - this.level) * k;
      if (this.level < 0.002) this.level = 0;

      const lvl = this.reduced ? 0 : Math.round(this.level * 100) / 100;
      if (lvl !== this.lastWritten.lvl) {
        this.el.style.setProperty('--lvl', lvl);
        document.documentElement.style.setProperty('--lvl', lvl); // mic waveform
        this.lastWritten.lvl = lvl;
      }

      if (this.disp && this.cssBody) {
        const base = BASE_WOBBLE[this.state] ?? 3;
        const scale = this.reduced ? 0 : Math.round((base + lvl * 16) * 10) / 10;
        if (scale !== this.lastWritten.scale) {
          this.disp.setAttribute('scale', scale);
          this.lastWritten.scale = scale;
        }
      }
      requestAnimationFrame(this._tick);
    }
  }

  window.Mascot = Mascot;
})();
