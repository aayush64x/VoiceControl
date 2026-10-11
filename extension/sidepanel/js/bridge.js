/* Bridge: connects the Soft Glass panel (window.AgentPanel) to the Python
   backend over the WebSocket, and relays page commands to the content script.

   The design (panel.js, mascot, styles) only draws; everything the old panel
   did lives here: backend mic recording, answering questions by voice or
   tap, holding answers spoken early, the "stop" command, settings commands,
   site memory, number tags, Strands steps and stats, and page commands with
   a safe retry. Messages from the backend are mapped onto the panel's states. */

(function () {
  'use strict';

  // The Spline mascot loads from the internet; the local 3D orb and the simple
  // CSS mascot don't. Must be set before mascot-renderers.js (a module) runs.
  window.__NO_SPLINE = true;

  const P = window.AgentPanel;
  if (!P) return;
  P.externalSpeech = true; // this file decides what is spoken, so nothing is said twice

  const $ = (id) => document.getElementById(id);
  const siteInfoEl = $('site-info');
  const statsEl = $('strands-stats');
  const speakSwitch = $('pref-speak');
  const numbersSwitch = $('pref-numbers');
  const rateSlider = $('set-rate');

  /* ---------------- WebSocket to the backend ---------------- */

  const WS_URL = 'ws://localhost:8765';
  let ws = null;
  let wsConnected = false;
  let lastCommand = '';

  function send(obj) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  }

  function connectWs() {
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      wsConnected = true;
      P.setConnection('online');
      if (P.state === 'idle' || P.state === 'error') P.setState('idle');
      startMicIfShortcutOpenedPanel();
    };

    ws.onclose = () => {
      const wasConnected = wsConnected;
      wsConnected = false;
      P.setConnection('offline');
      if (recording) stopRecording(false);
      closeQuestion();
      if (wasConnected || P.state === 'idle') {
        P.setState('idle', {
          title: "I'm not connected yet.",
          sub: 'Start the backend (python backend/agent.py). I’ll reconnect on my own.',
        });
      }
      setTimeout(connectWs, 2000);
    };

    ws.onerror = () => { wsConnected = false; };
    ws.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      handleBackend(msg);
    };
  }

  /* ---------------- Page commands (relayed through the background worker) ---------------- */

  // Chrome may have put the background worker to sleep (e.g. while the user
  // took a minute to answer). If the message never arrived, wake it and try
  // once more. Messages that may have arrived are never resent, so nothing
  // is clicked twice.
  const NOT_DELIVERED = /Receiving end does not exist|Could not establish connection/i;
  const UNREACHABLE_MSG = "Could not reach this page. It may still be loading, or it is a browser page the extension can't control.";

  function sendToBackground(message, reply, retried = false) {
    chrome.runtime.sendMessage(message, (response) => {
      const err = chrome.runtime.lastError;
      if (!err) { reply(response); return; }
      if (!retried && NOT_DELIVERED.test(err.message || '')) {
        setTimeout(() => sendToBackground(message, reply, true), 400);
        return;
      }
      reply({ error: UNREACHABLE_MSG });
    });
  }

  /* ---------------- Microphone (recorded by the backend, not the browser) ---------------- */

  let recording = false;
  let pendingSend = false;

  function startRecording() {
    if (!P.enabled || recording) return;
    if (!wsConnected) {
      P.setState('error', {
        title: "The backend isn't connected.",
        sub: 'Start it with python backend/agent.py, then try again.',
      });
      return;
    }
    stopSpeaking(); // the backend mic would otherwise record our own voice
    recording = true;
    pendingSend = false;
    P.setState('listening', { transcript: '' });
    P.mascot.simulate(true); // the mic is on the backend, so the orb follows a voice-like rhythm
    send({ type: 'voice_start' });
  }

  function stopRecording(sendToAgent = true) {
    if (!recording) return;
    recording = false;
    P.mascot.simulate(false);
    send({ type: 'voice_stop', cancel: !sendToAgent });
    if (sendToAgent) {
      pendingSend = true;
      P.setState('thinking', { eyebrow: 'Listening', title: 'Got it…', sub: 'Turning your words into text.' });
    } else {
      restoreView();
    }
  }

  function toggleMic() {
    if (recording) stopRecording();
    else startRecording();
  }

  // Double-tap Control toggles listening while the panel has focus (on web
  // pages, the page script does the same). Control must be tapped alone.
  let lastCtrlTap = 0;
  let ctrlClean = false;
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Control') ctrlClean = !e.repeat && !(e.altKey || e.metaKey || e.shiftKey);
    else { ctrlClean = false; lastCtrlTap = 0; }
  }, true);
  document.addEventListener('keyup', (e) => {
    if (e.key !== 'Control') return;
    if (!ctrlClean) { lastCtrlTap = 0; return; }
    ctrlClean = false;
    const t = Date.now();
    if (lastCtrlTap && t - lastCtrlTap <= 400) { lastCtrlTap = 0; toggleMic(); }
    else lastCtrlTap = t;
  }, true);

  // The one button: in every state, pressing means "I want to talk", and
  // pressing again (while listening) means "I'm done".
  P.on('mic', toggleMic);
  P.on('stopListening', () => stopRecording(true));

  // Option+Shift+V (background.js) toggles the mic; if it had to open this
  // panel first, start listening as soon as we're connected.
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'toggle_mic') { toggleMic(); return; }
    if (message.type === 'page_loading') { send(message); return; }
    if (message.type === 'page_ready') { send(message); }
  });

  function startMicIfShortcutOpenedPanel() {
    if (!chrome.storage || !chrome.storage.session) return;
    chrome.storage.session.get('startMicOnOpen', ({ startMicOnOpen }) => {
      if (!startMicOnOpen) return;
      chrome.storage.session.remove('startMicOnOpen');
      if (Date.now() - startMicOnOpen < 10000 && !recording) startRecording();
    });
  }

  function handleTranscript(msg) {
    if (msg.error) {
      // Never forward an error to the agent: say so and go back to where we were
      pendingSend = false;
      if (recording) stopRecording(false);
      if (question) {
        showQuestion({ sub: "Sorry, I didn't catch that. Try again." });
      } else {
        P.setState('idle', { title: "Sorry, I didn't catch that.", sub: 'Tap the mic or press Space to try again.' });
      }
      speak("Sorry, I didn't catch that.");
      return;
    }
    if (!msg.is_final) return;
    const text = (msg.text || '').trim();
    P.setTranscript(text);
    if (!pendingSend) return;
    pendingSend = false;
    if (!text) { restoreView(); return; }
    if (handleLocalControl(text)) return;

    if (question && !isStopCommand(text)) {
      // A question is open: what the user says is the answer, not a new command
      answer(normalizeAnswer(text, question.yesNo, question.view.data.options));
    } else if (!question && formInProgress && !isStopCommand(text)) {
      // Answered before the next question appeared: keep it for that question
      holdAnswer(text);
    } else {
      sendCommand(text);
    }
  }

  /* ---------------- Control words ---------------- */
  // Instant, work at any moment, and always win over answering a question.
  // Only these exact short phrases count ("cancel my subscription" is a request).
  //  - backend ones affect the agent: sent as commands
  //  - local ones only affect the panel: handled here, nothing is sent

  function controlPhrase(text) {
    const words = (text || '').toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean);
    return words.filter((w, i) => i === 0 || w !== words[i - 1]).join(' ');
  }

  const BACKEND_CONTROL = new Set([
    'stop', 'stop it', 'stop that', 'halt', 'never mind', 'nevermind',
    'stop everything', 'stop all', 'stop all of it', 'start over', 'reset',
    'cancel', 'cancel that', 'cancel it',
  ]);
  const QUIET = new Set(['quiet', 'be quiet', 'stop talking', 'shut up', 'silence', 'hush']);
  const REPEAT = new Set(['repeat', 'repeat that', 'say that again', 'again', 'what did you say']);
  const HELP = new Set(['help', 'what can i say', 'commands', 'what can you do']);

  function isStopCommand(text) {
    return BACKEND_CONTROL.has(controlPhrase(text));
  }

  const HELP_TEXT = 'Say what you want done, like \u201Cwhat benefits do I qualify for\u201D. Control words: '
    + 'stop, stop everything, cancel, quiet, repeat, help, and start over. '
    + 'Settings: settings overlay on or off, settings speak on or off.';

  let lastReply = '';

  // Panel-only control words. Returns true if handled (nothing is sent).
  function handleLocalControl(text) {
    const phrase = controlPhrase(text);
    if (QUIET.has(phrase)) {
      stopSpeaking();
      if (question) showQuestion(); else restoreView();
      return true;
    }
    if (REPEAT.has(phrase)) {
      if (question) {
        showQuestion();
        speak(question.text, true);
      } else if (lastReply) {
        showResult(lastReply);
        speak(speakableReply(lastReply), true);
      } else {
        restoreView();
      }
      return true;
    }
    if (HELP.has(phrase)) {
      P.setState('done', { eyebrow: 'Help', title: 'What you can say', sub: HELP_TEXT });
      speak(HELP_TEXT, true);
      return true;
    }
    return false;
  }

  const NUMBER_WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth'];

  // "two", "number 2", "option three", "the second one" -> the 2nd listed answer
  function optionByNumber(text, options) {
    if (!options || !options.length) return null;
    const t = text.toLowerCase().replace(/[.!?]/g, '').trim()
      .replace(/^(number|option|answer|choice|the)\s+/, '').replace(/\s+(one|option|answer)$/, '');
    let n = /^\d$/.test(t) ? Number(t) : 0;
    if (!n) n = NUMBER_WORDS.indexOf(t) + 1 || ORDINALS.indexOf(t) + 1;
    return n >= 1 && n <= options.length ? options[n - 1] : null;
  }

  // Spoken answers in everyday words: numbers pick a listed option; yes/no map onto Yes / No
  function normalizeAnswer(text, yesNo, options) {
    const picked = optionByNumber(text, options);
    if (picked) return picked;
    if (!yesNo) return text;
    const t = text.toLowerCase().replace(/[.!?]/g, '').trim();
    if (/^(yes|yeah|yep|yup|sure|ok|okay|go ahead|do it|correct|right|submit)\b/.test(t)) return 'Yes';
    if (/^(no|nope|nah|don't|do not|not now|cancel)\b/.test(t)) return 'No';
    return text;
  }

  /* ---------------- Commands ---------------- */

  function sendCommand(text) {
    if (!wsConnected) {
      P.setState('error', {
        title: "The backend isn't connected.",
        sub: 'Start it with python backend/agent.py, then try again.',
      });
      return;
    }
    lastCommand = text;
    send({ type: 'user_said', text });
    P.setState('thinking', { sub: `“${text}”` });
  }

  P.on('text', (text) => {
    if (handleLocalControl(text)) return;
    if (question && !isStopCommand(text)) answer(text);
    else sendCommand(text);
  });
  P.on('stop', () => send({ type: 'user_said', text: 'stop' }));
  P.on('retry', () => { if (lastCommand) sendCommand(lastCommand); else P.setState('idle'); });
  P.on('new', () => P.setState('idle'));

  /* ---------------- Questions from the agent ---------------- */

  let question = null; // { reply, yesNo, view }

  const SUBMIT_QUESTION = /\b(submit|send|go ahead|place (the )?order|pay|confirm|sign up)\b/i;

  // Turn the agent's question into a panel state:
  //  - "Should I submit?"            -> confirm (Submit / Cancel)
  //  - yes/no                        -> ask with Yes / No chips
  //  - "Are you married? A; B; or C" -> ask with one chip per option
  function questionView(text, yesNo) {
    if (yesNo && SUBMIT_QUESTION.test(text)) {
      return { name: 'confirm', data: { title: text, summary: [] } };
    }
    if (yesNo) {
      return { name: 'ask', data: { title: text, sub: 'Say yes or no, or tap an answer.', options: ['Yes', 'No'] } };
    }
    const q = text.indexOf('?');
    if (q > 0 && q < text.length - 1) {
      const rest = text.slice(q + 1);
      // Options are listed with semicolons ("Yes; No, I'm widowed or divorced; or No");
      // only fall back to splitting on "or" when there are none ("Morning or afternoon?")
      const options = rest
        .split(rest.includes(';') ? /;/ : /,\s*or\s+|\s+or\s+/i)
        .map((o) => o.replace(/^\s*(or|and)\s+/i, '').replace(/[.\s]+$/, '').trim())
        .filter((o) => o.length > 0 && o.length <= 60);
      if (options.length >= 2) {
        return { name: 'ask', data: { title: text.slice(0, q + 1), sub: 'Say your answer, or tap one.', options } };
      }
    }
    return { name: 'ask', data: { title: text, sub: 'Say your answer, or type it.', options: [] } };
  }

  function showQuestion(extra = {}) {
    if (!question) return;
    const v = question.view;
    P.setState(v.name, { ...v.data, ...extra });
  }

  function answer(text) {
    if (!question) return;
    const q = question;
    question = null;
    q.reply({ answer: text });
    P.setState('working', { sub: `You said “${text}”` });
  }

  function closeQuestion() {
    question = null;
  }

  P.on('answer', (text) => {
    if (handleLocalControl(text)) return;
    if (question && !isStopCommand(text)) answer(normalizeAnswer(text, question.yesNo, question.view.data.options));
    else sendCommand(text);
  });
  P.on('confirm', () => { if (question) answer('Yes'); });
  P.on('cancel', () => {
    if (question) answer('No');
    else send({ type: 'user_said', text: 'stop' });
  });

  /* ---------------- Answering early during a form ---------------- */
  // While a form task is running, an answer spoken before the next question
  // appears is held (up to 20s) and used for that question, instead of turning
  // into a new command. If no question comes, it's sent as a command after all.

  let formInProgress = false;
  let heldAnswer = null;
  let heldTimer = null;
  const HOLD_MS = 20000;

  function holdAnswer(text) {
    heldAnswer = text;
    P.setState('working', { sub: `Got it — I'll use “${text}” for the next question.` });
    clearTimeout(heldTimer);
    heldTimer = setTimeout(() => {
      const t = takeHeldAnswer();
      if (t) send({ type: 'user_said', text: t });
    }, HOLD_MS);
  }

  function takeHeldAnswer() {
    const t = heldAnswer;
    heldAnswer = null;
    clearTimeout(heldTimer);
    return t;
  }

  function endForm() {
    formInProgress = false;
    takeHeldAnswer();
  }

  // After the mic is cancelled or nothing was heard, go back to what was showing
  function restoreView() {
    if (question) showQuestion();
    else if (P.state === 'listening' || P.state === 'thinking') P.setState('idle');
  }

  /* ---------------- Strands steps and stats ---------------- */

  const stepIds = {};
  const STATUS = { running: 'running', ok: 'done', error: 'error', cancelled: 'cancelled' };
  const VERBS = {
    click: 'Clicking', type: 'Typing', select: 'Choosing', scroll: 'Scrolling', back: 'Going back',
    open: 'Opening', search: 'Searching', ask: 'Asking', new_tab: 'Opening a new tab',
    press_key: 'Pressing', read: 'Reading',
  };

  // Plain-language label; the raw Strands tool name still shows beside it
  function stepLabel(msg) {
    const input = msg.input || '';
    switch (msg.tool) {
      case 'route': return input;
      case 'read_page': return 'Reading the page';
      case 'read_text': return 'Reading the page text';
      case 'fill_form': return input ? `Filling in ${input}` : 'Filling in the form';
      case 'ask_user': return input ? `Asking you: ${input}` : 'Asking you';
      case 'safety': return `Safety check: ${input}`;
      case 'act': {
        const [verb, ...rest] = input.split(' ');
        const words = VERBS[verb];
        return words ? `${words} ${rest.join(' ')}`.trim() : `Act: ${input}`;
      }
      default: return input ? `${msg.tool}: ${input}` : msg.tool;
    }
  }

  function renderStep(msg) {
    const status = STATUS[msg.status] || 'running';
    const key = msg.step_id;
    const ms = msg.ms != null ? ` (${msg.ms < 1000 ? `${msg.ms}ms` : `${(msg.ms / 1000).toFixed(1)}s`})` : '';
    if (key && stepIds[key]) {
      const update = { status };
      if (status !== 'running') update.label = `${stepIds[key].label}${ms}`;
      P.updateStep(stepIds[key].id, update);
      return;
    }
    const label = stepLabel(msg);
    const id = P.addStep({ tool: msg.tool === 'route' ? 'route' : msg.tool, label, status });
    if (key) stepIds[key] = { id, label };
    if (status === 'running' && P.state !== 'ask' && P.state !== 'confirm') P.setProgress(`${label}…`);
  }

  function clearStepState() {
    Object.keys(stepIds).forEach((k) => delete stepIds[k]);
    P.clearSteps();
    if (statsEl) statsEl.textContent = '';
  }

  /* ---------------- Site memory line ---------------- */

  function renderSiteInfo(site) {
    if (!siteInfoEl) return;
    if (!site.known || !site.kind) {
      siteInfoEl.textContent = `Learning ${site.domain}…`;
      siteInfoEl.dataset.state = 'learning';
      return;
    }
    const parts = [site.name, site.kind];
    if (site.search) parts.push('search box ✓');
    if (site.chat) parts.push('chat box ✓');
    siteInfoEl.textContent = parts.join(' · ');
    siteInfoEl.dataset.state = 'known';
  }

  /* ---------------- Speech ---------------- */

  // force: the user asked for this ("read it out loud"), or it's a form question
  function speak(text, force = false) {
    if (!(force || (speakSwitch && speakSwitch.checked)) || !text || !window.speechSynthesis) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rateSlider ? Number(rateSlider.value) || 1.3 : 1.3;
    speechSynthesis.speak(u);
  }

  function stopSpeaking() {
    if (window.speechSynthesis) speechSynthesis.cancel();
  }

  // No JSON, no full URLs, not too long
  function speakableReply(text) {
    if (!text) return '';
    if (text.startsWith('OK:')) return 'Done.';
    if (text.startsWith('Found ') && text.includes(' elements:')) return text.split('\n')[0];
    let out = text
      .replace(/https?:\/\/(?:www\.)?([^/\s?]+)\S*/g, '$1')
      .replace(/[*_#`>]/g, '')
      .replace(/\(element \d+\)/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (out.length > 1200) {
      const cut = out.slice(0, 1200);
      const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
      out = end > 100 ? cut.slice(0, end + 1) : `${cut}…`;
    }
    return out;
  }

  // "Always speak replies": the switch in Settings, or "settings speak on/off"
  function setAlwaysSpeak(on) {
    if (!speakSwitch) return;
    speakSwitch.checked = on;
    speakSwitch.dispatchEvent(new Event('change')); // panel.js saves the preference
    if (!on) stopSpeaking();
  }

  /* ---------------- Number tags on the page ---------------- */
  // Saved in chrome.storage; every tab's page script shows or hides them.

  function setNumbers(on) {
    if (numbersSwitch) numbersSwitch.checked = on;
    chrome.storage.local.set({ showOverlays: on });
  }
  if (numbersSwitch) {
    chrome.storage.local.get('showOverlays', (stored) => {
      numbersSwitch.checked = !(stored && stored.showOverlays === false);
    });
    numbersSwitch.addEventListener('change', () => setNumbers(numbersSwitch.checked));
  }

  /* ---------------- Backend messages ---------------- */

  function cleanReply(text) {
    return (text || '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/^#{1,6}\s+/gm, '').trim();
  }

  function showResult(text) {
    const reply = cleanReply(text);
    if (/^(Stopped|Nothing to stop|Starting over)/.test(reply)) {
      P.setState('idle', { title: reply.split(/[:.]/)[0] + '.', sub: reply.includes(':') ? reply : 'Press to talk when you\u2019re ready.' });
    } else if (/^(error|couldn't|could not|i couldn't|i was unable|unable)\b/i.test(reply)) {
      P.setState('error', { sub: reply });
    } else {
      P.setState('done', { title: 'Done.', sub: reply });
    }
  }

  function handleBackend(msg) {
    const reply = (result) => send({ id: msg.id, result });

    switch (msg.type) {
      case 'transcript': handleTranscript(msg); return;

      case 'agent_thinking':
        endForm(); // a new task starts: nothing carries over
        closeQuestion();
        clearStepState();
        stopSpeaking();
        P.setState('thinking', { sub: msg.text ? `“${msg.text}”` : undefined });
        return;

      case 'step': renderStep(msg); return;
      case 'stats': if (statsEl) statsEl.textContent = msg.summary || ''; return;
      case 'site': renderSiteInfo(msg); return;
      case 'set_overlays': setNumbers(!!msg.on); return;
      case 'set_speak': setAlwaysSpeak(!!msg.on); return;

      case 'queued':
        P.setProgress(`Next up: “${msg.text}”`);
        return;

      case 'reset':
        // "stop everything" / "start over": quiet, not listening, nothing open
        stopSpeaking();
        if (recording) stopRecording(false);
        pendingSend = false;
        endForm();
        closeQuestion();
        return;

      case 'question_cancelled':
        closeQuestion();
        P.setState('working', { sub: 'Switching to your new request…' });
        return;

      case 'agent_response':
        endForm();
        closeQuestion();
        lastReply = msg.text || '';
        showResult(msg.text);
        // Spoken only when the user asked ("read it out loud") or always-speak is on
        speak(speakableReply(msg.text), msg.speak);
        return;

      case 'ask_user': {
        formInProgress = true;
        question = { reply, yesNo: !!msg.yes_no, text: msg.question || '', view: questionView(msg.question || '', !!msg.yes_no) };
        const early = takeHeldAnswer();
        if (early) {
          // Already answered: no need to read it out
          answer(normalizeAnswer(early, question.yesNo, question.view.data.options));
          return;
        }
        showQuestion();
        // Form questions are always read aloud, so the user can answer without looking
        speak(msg.question, true);
        return;
      }

      case 'new_tab': {
        let url = msg.url || 'https://google.com';
        if (!url.startsWith('http')) url = `https://${url}`;
        chrome.tabs.create({ url }, () => reply({ success: true, url }));
        return;
      }

      case 'list_elements':
        sendToBackground({ type: 'list_elements' }, reply);
        return;

      case 'action':
        if (msg.action === 'open' && msg.value) {
          let url = msg.value;
          if (!url.startsWith('http')) url = `https://${url}`;
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
              chrome.tabs.update(tabs[0].id, { url });
              reply({ success: true, action: 'open', url, navigated: true });
            } else {
              reply({ error: 'No active tab.' });
            }
          });
          return;
        }
        sendToBackground(msg, reply);
        return;

      default:
        return;
    }
  }

  /* ---------------- What the one button will do ---------------- */

  const pressHint = $('press-hint');
  const micBtn = $('mic-btn');
  const PRESS_HINTS = {
    idle: 'Press, or tap <kbd>Control</kbd> twice, to talk',
    listening: 'Press again when you\u2019re done',
    thinking: 'Press to talk \u00B7 say \u201Cstop\u201D to cancel',
    working: 'Press to talk \u00B7 say \u201Cstop\u201D to cancel',
    ask: 'Press to answer \u00B7 say the answer or its number',
    confirm: 'Press and say \u201Cyes\u201D to submit or \u201Cno\u201D to cancel',
    done: 'Press to talk',
    error: 'Press to talk',
  };

  function syncPressHint() {
    const state = document.body.dataset.state || 'idle';
    if (pressHint) pressHint.innerHTML = PRESS_HINTS[state] || PRESS_HINTS.idle; // fixed strings only
    if (micBtn) micBtn.setAttribute('aria-label', state === 'listening' ? 'Stop listening' : 'Start listening');
  }
  new MutationObserver(syncPressHint).observe(document.body, { attributes: true, attributeFilter: ['data-state'] });

  /* ---------------- Start ---------------- */

  P.setConnection('offline'); // turns the demo script off: this is the real panel
  P.setState('idle', { sub: 'Connecting to the backend…' });
  connectWs();
})();
