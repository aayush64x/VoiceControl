/* AgentPanel — the side panel's state machine and public API.

   One component, eight states. Each state sets the mascot, the status
   copy (eyebrow / title / sub) and which dock panel is visible.

     idle -> listening -> thinking -> working -> confirm -> working -> done
                                         |          \-> (cancel) idle
                                         +-> ask -> working
                                         +-> error

   The bridge (Slice 3+) talks to the panel in two ways:
     AgentPanel.handleMessage(msg)   backend messages from plan.md
     AgentPanel.on(event, fn)        user intents: mic, stopListening,
                                     text, answer, confirm, cancel, stop,
                                     retry, new
   Nothing here talks to the network. */

(function () {
  'use strict';

  const STATES = {
    idle: {
      eyebrow: 'Ready', title: 'How can I help?',
      sub: 'Tap the mic or press F2, then say what you need.', panel: 'idle',
    },
    listening: {
      eyebrow: 'Listening', title: 'Listening…',
      sub: 'Tell me what you want to get done.', panel: 'listening',
    },
    thinking: {
      eyebrow: 'Thinking', title: 'Understanding your request…',
      sub: 'Finding the right steps.', panel: 'busy', progress: 'Planning the steps',
    },
    working: {
      eyebrow: 'Working', title: 'Working on your request…',
      sub: 'Analyzing the page…', panel: 'busy', progress: 'Processing your request',
    },
    confirm: {
      eyebrow: 'Needs your OK', title: 'Ready to submit?',
      sub: 'Please check these details first.', panel: 'confirm',
    },
    done: {
      eyebrow: 'Done', title: 'Task completed.',
      sub: 'Everything went through.', panel: 'done',
    },
    ask: {
      eyebrow: 'Quick question', title: 'I need one more detail.',
      sub: '', panel: 'ask',
    },
    error: {
      eyebrow: 'Paused', title: "I couldn't finish that.",
      sub: 'Nothing was submitted. You can try again or tell me another way.', panel: 'error',
    },
  };

  // Plain-language progress for each Strands tool, so the main view
  // never shows raw tool names. Tool names stay visible in Steps.
  const TOOL_COPY = {
    read_page: () => 'Analyzing the page…',
    act: (input = {}) => {
      const what = input.label ? `“${input.label}”` : '';
      switch (input.action) {
        case 'click': return what ? `Selecting ${what}…` : 'Clicking…';
        case 'type': return what ? `Typing into ${what}…` : 'Typing…';
        case 'scroll': return 'Scrolling the page…';
        case 'back': return 'Going back…';
        case 'open': return 'Opening the page…';
        case 'key': return 'Pressing a key…';
        default: return 'Working on the page…';
      }
    },
    fill_form: (input = {}) => {
      const n = Array.isArray(input.fields) ? input.fields.length : input.count;
      return n ? `Filling out ${n} fields…` : 'Filling out the form…';
    },
    read_aloud: () => 'Reading the page…',
    ask_user: () => 'Checking with you…',
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem('va:' + key); return v == null ? fallback : JSON.parse(v); }
      catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('va:' + key, JSON.stringify(value)); } catch { /* storage blocked */ }
    },
  };

  const el = {
    mascot: $('#mascot'),
    status: $('#status'),
    eyebrow: $('#status-eyebrow'),
    title: $('#status-title'),
    sub: $('#status-sub'),
    panels: $$('.dock__panel'),
    transcript: $('#transcript-text'),
    progress: $('#progress-text'),
    summary: $('#summary'),
    options: $('#ask-options'),
    typeBox: $('#type-box'),
    typeInput: $('#type-input'),
    steps: $('#steps'),
    stepsList: $('#steps-list'),
    stepsCount: $('#steps-count'),
    conn: $('#conn'),
    power: $('#power-btn'),
    settings: $('#settings'),
    settingsBtn: $('#settings-btn'),
    mainView: $('#main-view'),
    prefSteps: $('#pref-steps'),
    prefSpeak: $('#pref-speak'),
    prefMotion: $('#pref-motion'),
  };

  const mascot = new window.Mascot(el.mascot);
  const listeners = {};
  let current = 'idle';
  let swapTimer = null;
  let stepSeq = 0;

  function emit(name, payload) {
    const fns = listeners[name] || [];
    fns.forEach((fn) => fn(payload));
    return fns.length > 0;
  }

  function writeStatus({ eyebrow, title, sub }) {
    el.eyebrow.textContent = eyebrow;
    el.title.textContent = title;
    el.sub.textContent = sub || '';
    el.sub.hidden = !sub;
  }

  function swapStatus(copy) {
    clearTimeout(swapTimer);
    if (document.documentElement.classList.contains('reduce-motion')) { writeStatus(copy); return; }
    el.status.classList.add('is-swapping');
    swapTimer = setTimeout(() => {
      writeStatus(copy);
      el.status.classList.remove('is-swapping');
    }, 140);
  }

  function showPanel(name) {
    el.panels.forEach((p) => { p.hidden = p.dataset.panel !== name; });
  }

  function renderSummary(rows = []) {
    el.summary.replaceChildren();
    rows.forEach(({ label, value }) => {
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = label;
      dd.textContent = value;
      el.summary.append(dt, dd);
    });
    el.summary.hidden = rows.length === 0;
  }

  function renderOptions(options = []) {
    el.options.replaceChildren();
    options.forEach((opt, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      const label = document.createElement('span');
      label.textContent = opt;
      const n = document.createElement('span');
      n.className = 'chip__n';
      n.textContent = i + 1;
      n.setAttribute('aria-hidden', 'true');
      b.append(label, n);
      b.addEventListener('click', () => emit('answer', opt));
      el.options.append(b);
    });
  }

  /**
   * Move to a state. `data` can override copy and carry state content:
   *   { eyebrow, title, sub, progress, transcript, summary: [{label, value}], options: [] }
   */
  function setState(name, data = {}) {
    const def = STATES[name];
    if (!def) throw new Error(`Unknown panel state: ${name}`);
    const prev = current;
    current = name;

    mascot.setState(name);
    document.body.dataset.state = name;

    swapStatus({
      eyebrow: data.eyebrow ?? def.eyebrow,
      title: data.title ?? def.title,
      sub: data.sub ?? def.sub,
    });
    showPanel(def.panel);

    if (def.panel === 'busy') el.progress.textContent = data.progress ?? def.progress;
    if (name === 'listening') setTranscript(data.transcript ?? '');
    if (name === 'confirm') renderSummary(data.summary);
    if (name === 'ask') renderOptions(data.options);
    if (!['idle', 'ask', 'error'].includes(name)) el.typeBox.hidden = true;

    // Move focus to the decision so keyboard and screen-reader users land on it.
    if ((name === 'confirm' || name === 'ask' || name === 'error') && prev !== name) {
      setTimeout(() => el.title.focus({ preventScroll: true }), 160);
    }
    // The backend bridge (bridge.js) sets externalSpeech and decides what is spoken itself
    if (!api.externalSpeech && (name === 'confirm' || name === 'ask' || name === 'done' || name === 'error')) {
      speak([data.title ?? def.title, data.sub ?? def.sub].filter(Boolean).join(' '));
    }

    $$('[data-jump]').forEach((b) => b.setAttribute('aria-current', String(b.dataset.jump === name)));
  }

  /** Update the supporting line while working ("Filling out the form…"). */
  function setProgress(text) {
    if (current !== 'working' && current !== 'thinking') setState('working');
    swapStatus({ eyebrow: el.eyebrow.textContent, title: el.title.textContent, sub: text });
  }

  function setTranscript(text) {
    el.transcript.textContent = text;
  }

  function addStep({ id, tool, label, status = 'running' }) {
    const li = document.createElement('li');
    li.className = 'step';
    li.dataset.id = id ?? `s${++stepSeq}`;
    li.dataset.status = status;
    li.innerHTML = `
      <span class="step__icon" aria-hidden="true"><svg viewBox="0 0 24 24"></svg></span>
      <span class="step__label"></span>
      <code class="step__tool"></code>`;
    li.querySelector('.step__label').textContent = label || tool;
    li.querySelector('.step__tool').textContent = tool;
    el.stepsList.append(li);
    paintStep(li, status);
    el.stepsCount.textContent = el.stepsList.children.length;
    syncStepsVisibility();
    li.scrollIntoView?.({ block: 'nearest' });
    return li.dataset.id;
  }

  function updateStep(id, { status, label } = {}) {
    const li = el.stepsList.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (!li) return;
    if (label) li.querySelector('.step__label').textContent = label;
    if (status) paintStep(li, status);
  }

  function paintStep(li, status) {
    li.dataset.status = status;
    const svg = li.querySelector('svg');
    svg.innerHTML = status === 'done' ? '<path d="M5 12.5l4.5 4.5L19 7.5"/>'
      : status === 'error' ? '<path d="M7 7l10 10M17 7L7 17"/>'
      : status === 'cancelled' ? '<path d="M7 12h10"/>' : '';
  }

  function clearSteps() {
    el.stepsList.replaceChildren();
    el.stepsCount.textContent = '0';
    syncStepsVisibility();
  }

  function syncStepsVisibility() {
    el.steps.hidden = !el.prefSteps.checked || el.stepsList.children.length === 0;
  }

  function speak(text) {
    if (!el.prefSpeak.checked || !text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02;
    window.speechSynthesis.speak(u);
  }

  function setConnection(mode) {
    el.conn.dataset.conn = mode;
    el.conn.querySelector('.conn__label').textContent =
      mode === 'online' ? 'Connected' : mode === 'offline' ? 'Offline' : 'Demo mode';
    api.connection = mode;
  }

  function setReducedMotion(on) {
    document.documentElement.classList.toggle('reduce-motion', on);
    mascot.setReducedMotion(on);
  }

  function openTypeBox() {
    el.typeBox.hidden = false;
    el.typeInput.focus();
  }

  /* ---------- backend messages (plan.md "Messages between the parts") ---------- */

  const openSteps = {};
  function handleMessage(msg) {
    switch (msg.type) {
      case 'listening': setState('listening'); break;
      case 'transcript': setTranscript(msg.text || ''); break;
      case 'thinking': setState('thinking'); break;
      case 'step': {
        const copy = (TOOL_COPY[msg.tool] || (() => 'Working on it…'))(msg.input);
        const key = msg.id || msg.tool;
        if (msg.status === 'done' || msg.status === 'error') {
          if (openSteps[key]) updateStep(openSteps[key], { status: msg.status });
          else addStep({ tool: msg.tool, label: copy, status: msg.status });
          delete openSteps[key];
        } else {
          openSteps[key] = addStep({ tool: msg.tool, label: copy });
          setProgress(copy);
        }
        break;
      }
      case 'ask':
        if (msg.yes_no) setState('confirm', { title: msg.question, summary: msg.summary });
        else setState('ask', { title: msg.question, sub: msg.hint, options: msg.options });
        break;
      case 'say':
        speak(msg.text);
        if (current === 'working') setProgress(msg.text);
        break;
      case 'done': setState('done', { sub: msg.text }); break;
      case 'error': setState('error', { title: msg.title, sub: msg.text }); break;
      default: break;
    }
  }

  /* ---------- wiring ---------- */

  function onMic() {
    if (!enabled) return;
    if (!emit('mic')) setState('listening');
  }

  /* ---------- on / off ---------- */

  const OFF_COPY = {
    eyebrow: 'Off', title: 'Voice Agent is off.',
    sub: 'Turn it on with the switch above to use voice commands.',
  };
  let enabled = true;

  function setEnabled(on, { quiet = false } = {}) {
    enabled = !!on;
    store.set('enabled', enabled);
    document.body.dataset.power = enabled ? 'on' : 'off';
    el.power.setAttribute('aria-checked', String(enabled));
    el.power.querySelector('.power__label').textContent = enabled ? 'On' : 'Off';
    $$('.mic, .dock [data-action="type"]').forEach((b) => { b.disabled = !enabled; });
    if (!enabled) {
      if (current !== 'idle') emit('stop');
      mascot.stopMic();
      window.speechSynthesis?.cancel();
      el.typeBox.hidden = true;
      setState('idle', OFF_COPY);
    } else if (!quiet) {
      setState('idle');
    }
  }
  el.power.addEventListener('click', () => setEnabled(!enabled));

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    const action = t.dataset.action;
    switch (action) {
      case 'mic': onMic(); break;
      case 'type': openTypeBox(); break;
      case 'confirm': emit('confirm'); break;
      case 'cancel': emit('cancel'); break;
      case 'stop': emit('stop'); break;
      case 'retry': if (!emit('retry')) setState('idle'); break;
      case 'new': clearSteps(); if (!emit('new')) setState('idle'); break;
      default: break;
    }
  });

  $('#mic-btn').addEventListener('click', onMic);
  $('#stop-listen-btn').addEventListener('click', () => emit('stopListening'));

  el.typeBox.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = el.typeInput.value.trim();
    if (!text) return;
    el.typeInput.value = '';
    el.typeBox.hidden = true;
    emit(current === 'ask' ? 'answer' : 'text', text);
  });

  document.addEventListener('keydown', (e) => {
    const typing = e.target.closest('input, textarea, [contenteditable="true"]');
    if (e.key === 'Escape') {
      if (!el.settings.hidden) { toggleSettings(false); return; }
      if (typing) { el.typeBox.hidden = true; return; }
      if (current === 'listening') emit('stopListening');
      else if (current === 'thinking' || current === 'working') emit('stop');
      else if (current === 'confirm') emit('cancel');
      return;
    }
    if (typing || !el.settings.hidden || e.target.closest('button, summary, select')) return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (current === 'listening') emit('stopListening');
      else if (['idle', 'done', 'ask', 'error'].includes(current)) onMic();
    }
    // Number keys pick a listed answer: mirrors saying "one", "two".
    if (current === 'ask' && /^[1-9]$/.test(e.key)) {
      el.options.children[+e.key - 1]?.click();
    }
  });

  /* settings view: swaps in place of the main view */
  function toggleSettings(open) {
    el.settings.hidden = !open;
    el.mainView.hidden = open;
    el.settingsBtn.setAttribute('aria-expanded', String(open));
    if (open) $('#settings-title').focus({ preventScroll: true });
    else el.settingsBtn.focus({ preventScroll: true });
  }
  el.settingsBtn.addEventListener('click', () => toggleSettings(el.settings.hidden));
  $('#settings-done').addEventListener('click', () => toggleSettings(false));
  // Demo controls return to the main view so the flow is visible.
  el.settings.addEventListener('click', (e) => {
    if (e.target.closest('[data-action^="demo"], [data-jump]')) toggleSettings(false);
  });

  /* preferences */
  el.prefSteps.checked = store.get('steps', true);
  el.prefSpeak.checked = store.get('speak', false);
  el.prefMotion.checked = store.get('motion', false);
  el.steps.open = store.get('stepsOpen', false);
  setReducedMotion(el.prefMotion.checked);
  setEnabled(store.get('enabled', true), { quiet: true });

  el.prefSteps.addEventListener('change', () => { store.set('steps', el.prefSteps.checked); syncStepsVisibility(); });
  el.prefSpeak.addEventListener('change', () => store.set('speak', el.prefSpeak.checked));
  el.prefMotion.addEventListener('change', () => { store.set('motion', el.prefMotion.checked); setReducedMotion(el.prefMotion.checked); });
  el.steps.addEventListener('toggle', () => store.set('stepsOpen', el.steps.open));

  const api = {
    STATES,
    connection: 'demo',
    externalSpeech: false,
    get state() { return current; },
    get enabled() { return enabled; },
    setEnabled,
    mascot,
    setState, setProgress, setTranscript,
    addStep, updateStep, clearSteps,
    handleMessage, setConnection, setReducedMotion, speak,
    on(name, fn) { (listeners[name] ||= []).push(fn); return () => { listeners[name] = listeners[name].filter((f) => f !== fn); }; },
  };
  window.AgentPanel = api;
})();
