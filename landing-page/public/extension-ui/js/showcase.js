/* Showcase driver for the landing page.

   This is the real VOYA side panel (same markup, styles, mascot and state
   machine as the extension), but instead of the backend it shows sample
   content from a real benefits-check run. No microphone, no network, no
   speech.

     ?scene=idle | ask | working | confirm | done   which moment to show
     pressing the button                           plays the whole example

   The parent page can also switch scenes with postMessage({ voyaScene }). */

(function () {
  'use strict';

  window.__NO_SPLINE = true; // the local 3D orb only; nothing loads from the internet

  const P = window.AgentPanel;
  if (!P) return;
  P.externalSpeech = true; // silent: this is a picture of the panel, not a voice demo
  P.setConnection('online');

  const $ = (id) => document.getElementById(id);
  const stats = $('strands-stats');
  const siteInfo = $('site-info');
  const stepsBox = $('steps');

  const REQUEST = 'What benefits do I qualify for?';
  const MARRIED = {
    title: 'Are you married?',
    sub: 'Say the answer or its number.',
    options: [
      'Yes',
      "Yes, but we don't live together",
      "No, I'm widowed or divorced",
      "No, I've never been married",
    ],
  };
  const RESULT = 'The page says you may be eligible for Social Security Disability Insurance (SSDI). '
    + 'It also lists how to apply.';
  const STATS = 'Strands · Claude Sonnet · 19 model calls · 18 tool calls · 41.2k tokens · 86% cached · 74s';

  // The opening steps of a real run, from a blank tab
  const OPENING = [
    { tool: 'route', label: 'Strands agent · Claude Sonnet (multi-step task)' },
    { tool: 'act', label: 'Opening google.com/search?q=check eligibility for disability benefits (0.7s)' },
    { tool: 'read_text', label: 'Reading the page text (24ms)' },
    { tool: 'act', label: 'Opening ssa.gov (1.0s)' },
    { tool: 'act', label: 'Clicking #18 "Start" (0.6s)' },
  ];
  const ANSWERS = [
    { tool: 'ask_user', label: 'Asking you: Who do you want to check eligibility for?' },
    { tool: 'fill_form', label: 'Filling in 2 fields (0.6s)' },
    { tool: 'ask_user', label: 'Asking you: Enter your date of birth.' },
    { tool: 'fill_form', label: 'Filling in 4 fields (0.7s)' },
    { tool: 'ask_user', label: 'Asking you: Have you ever worked and paid Social Security taxes?' },
    { tool: 'fill_form', label: 'Filling in 2 fields (0.6s)' },
  ];

  /* ---------- the hint under the one button (as in the extension) ---------- */
  const pressHint = $('press-hint');
  const PRESS_HINTS = {
    idle: 'Press the button to play an example',
    listening: 'Press again when you’re done',
    thinking: 'Press to talk · say “stop” to cancel',
    working: 'Press to talk · say “stop” to cancel',
    ask: 'Press to answer · say the answer or its number',
    confirm: 'Press and say “yes” to submit or “no” to cancel',
    done: 'Press the button to play it again',
    error: 'Press to talk',
  };
  function syncPressHint() {
    if (pressHint) pressHint.textContent = PRESS_HINTS[document.body.dataset.state] || PRESS_HINTS.idle;
  }
  new MutationObserver(syncPressHint).observe(document.body, { attributes: true, attributeFilter: ['data-state'] });

  /* ---------- helpers ---------- */
  function steps(list, status = 'done') {
    list.forEach((s) => P.addStep({ tool: s.tool, label: s.label, status }));
  }
  function reset() {
    P.clearSteps();
    if (stats) stats.textContent = '';
    if (siteInfo) siteInfo.textContent = '';
  }
  function site() {
    if (siteInfo) siteInfo.textContent = 'Social Security Administration · government';
  }
  function openSteps(open) {
    if (stepsBox) stepsBox.open = open;
  }

  /* ---------- single moments, for the landing-page slides ---------- */
  const SCENES = {
    idle() {
      reset();
      P.setState('idle');
    },
    ask() {
      reset(); site();
      steps(OPENING); steps(ANSWERS);
      steps([{ tool: 'ask_user', label: 'Asking you: Are you married? Yes; Yes, but we don’t live together; …' }], 'running');
      openSteps(false);
      P.setState('ask', MARRIED);
    },
    working() {
      reset(); site();
      steps(OPENING); steps(ANSWERS);
      steps([{ tool: 'fill_form', label: 'Filling in 2 fields' }], 'running');
      openSteps(true);
      P.setState('working', { sub: 'Filling in 2 fields…' });
    },
    confirm() {
      reset(); site();
      steps(OPENING.slice(0, 1));
      steps([{ tool: 'safety', label: 'Safety check: “Submit request” — asking you first' }], 'running');
      openSteps(true);
      P.setState('confirm', {
        title: 'Before I click “Submit request”: should I go ahead and submit?',
        summary: [
          { label: 'Name', value: 'Jordan Rivera' },
          { label: 'Phone', value: '816-555-0142' },
          { label: 'Preferred time', value: 'Tuesday morning' },
        ],
      });
    },
    done() {
      reset(); site();
      steps(OPENING); steps(ANSWERS);
      steps([{ tool: 'read_text', label: 'Reading the page text (31ms)' }]);
      if (stats) stats.textContent = STATS;
      openSteps(true);
      P.setState('done', { title: 'Done.', sub: RESULT });
    },
  };

  function show(name) {
    stopPlaying();
    (SCENES[name] || SCENES.idle)();
  }

  /* ---------- pressing the button plays the whole example ---------- */
  let run = 0;
  let recording = false;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function stopPlaying() {
    run++;
    recording = false;
    P.mascot.simulate(false);
  }

  async function typeTranscript(text, id) {
    for (let i = 1; i <= text.length; i++) {
      if (id !== run) return;
      P.setTranscript(text.slice(0, i));
      await wait(45);
    }
  }

  async function play() {
    const id = ++run;
    const alive = () => id === run;
    reset();
    openSteps(true);

    recording = true;
    P.setState('listening', { transcript: '' });
    P.mascot.simulate(true);
    await typeTranscript(REQUEST, id);
    await wait(500); if (!alive()) return;
    recording = false;
    P.mascot.simulate(false);

    P.setState('thinking', { sub: `“${REQUEST}”` });
    await wait(900); if (!alive()) return;
    for (const s of OPENING) {
      const stepId = P.addStep({ tool: s.tool, label: s.label.replace(/ \(.*\)$/, ''), status: 'running' });
      P.setProgress(`${s.label.replace(/ \(.*\)$/, '')}…`);
      await wait(700); if (!alive()) return;
      P.updateStep(stepId, { status: 'done', label: s.label });
    }
    site();

    P.addStep({ tool: 'ask_user', label: 'Asking you: Are you married?', status: 'running' });
    P.setState('ask', MARRIED);
    await wait(2600); if (!alive()) return;

    // "Number four"
    P.setState('listening', { transcript: '' });
    P.mascot.simulate(true);
    await typeTranscript('Number four', id);
    await wait(400); if (!alive()) return;
    P.mascot.simulate(false);
    P.setState('working', { sub: 'You said “No, I’ve never been married”' });
    const fill = P.addStep({ tool: 'fill_form', label: 'Filling in 2 fields', status: 'running' });
    await wait(1100); if (!alive()) return;
    P.updateStep(fill, { status: 'done', label: 'Filling in 2 fields (0.6s)' });
    const read = P.addStep({ tool: 'read_text', label: 'Reading the page text', status: 'running' });
    P.setProgress('Reading the results…');
    await wait(1000); if (!alive()) return;
    P.updateStep(read, { status: 'done', label: 'Reading the page text (31ms)' });

    if (stats) stats.textContent = STATS;
    P.setState('done', { title: 'Done.', sub: RESULT });
  }

  P.on('mic', () => (recording ? stopPlaying() : play()));
  P.on('stopListening', stopPlaying);
  P.on('text', () => play());
  P.on('answer', () => play());
  P.on('stop', () => show('idle'));

  window.addEventListener('message', (e) => {
    if (e.data && typeof e.data.voyaScene === 'string') show(e.data.voyaScene);
  });

  show(new URLSearchParams(location.search).get('scene') || 'idle');
  syncPressHint();
})();
