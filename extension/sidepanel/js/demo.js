/* Demo driver: a scripted run of the full flow with made-up details,
   for design review and as the stage backup. It only acts while the
   panel is in demo mode; once the bridge calls
   AgentPanel.setConnection('online') these handlers step aside.

   URL options (handy for screenshots and the states gallery):
     ?state=confirm   open directly in a state with sample content
     ?reduce=1        force reduced motion */

(function () {
  'use strict';

  const P = window.AgentPanel;
  const params = new URLSearchParams(location.search);
  const isDemo = () => P.connection === 'demo';
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const REQUEST = 'Fill out my prescription refill form using my saved details.';
  const SUMMARY = [
    { label: 'Name', value: 'Jordan Rivera' },
    { label: 'Date of birth', value: 'Mar 14, 1988' },
    { label: 'Prescription', value: 'Lisinopril 10 mg' },
    { label: 'Rx number', value: '7730192' },
    { label: 'Pharmacy', value: 'Walgreens, Main St' },
    { label: 'Pickup', value: 'Tomorrow after 2 PM' },
  ];
  const ASK = {
    title: 'Which pharmacy should I send it to?',
    sub: 'You have two saved. Pick one, or say the name.',
    options: ['Walgreens, Main St', 'CVS, Oak Ave'],
  };

  // Sample content for jumping straight into a state.
  const SAMPLES = {
    listening: { transcript: REQUEST },
    working: { progress: 'Processing your request', sub: 'Filling out 6 fields…' },
    confirm: { summary: SUMMARY },
    done: { sub: 'Your refill request was sent. Confirmation RX-48213.' },
    ask: ASK,
    error: { sub: "I couldn't find a submit button on this page. Nothing was sent." },
  };
  const SAMPLE_STEPS = [
    { tool: 'read_page', label: 'Analyzing the page…', status: 'done' },
    { tool: 'fill_form', label: 'Filling out 6 fields…', status: 'done' },
    { tool: 'read_page', label: 'Verifying information…', status: 'running' },
  ];

  let run = 0;          // bumps on every new run; stale runs bail out
  let withQuestion = false;
  let pickedPharmacy = SUMMARY[4].value;

  const alive = (id) => id === run && isDemo();

  async function typeOut(id, text) {
    const words = text.split(' ');
    for (let i = 1; i <= words.length; i++) {
      if (!alive(id) || P.state !== 'listening') return false;
      P.setTranscript(words.slice(0, i).join(' '));
      await wait(170 + Math.random() * 120);
    }
    return true;
  }

  async function listen() {
    const id = ++run;
    P.clearSteps();
    P.setState('listening');
    const live = await P.mascot.startMic();
    if (!live) P.mascot.simulate(true);
    await wait(500);
    if (!(await typeOut(id, REQUEST))) return;
    await wait(700);
    if (alive(id) && P.state === 'listening') understand(id, REQUEST);
  }

  async function step(id, tool, label, ms) {
    if (!alive(id)) return false;
    const s = P.addStep({ tool, label });
    P.setProgress(label);
    await wait(ms);
    if (!alive(id)) return false;
    P.updateStep(s, { status: 'done' });
    return true;
  }

  async function understand(id) {
    P.mascot.stopMic();
    P.setState('thinking');
    await wait(1700);
    if (!alive(id)) return;
    P.setState('working');
    await wait(300);
    if (!(await step(id, 'read_page', 'Analyzing the page…', 1400))) return;
    if (!(await step(id, 'read_page', 'Identifying form fields…', 1100))) return;
    if (withQuestion) {
      if (!alive(id)) return;
      P.addStep({ tool: 'ask_user', label: 'Asked which pharmacy', status: 'done' });
      P.setState('ask', ASK);
      return; // resumes from the 'answer' handler
    }
    fill(id);
  }

  async function fill(id) {
    if (!alive(id)) return;
    P.setState('working', { sub: 'Filling out 6 fields…' });
    if (!(await step(id, 'fill_form', 'Filling out 6 fields…', 2000))) return;
    if (!(await step(id, 'read_page', 'Verifying information…', 1200))) return;
    const summary = SUMMARY.map((r) => (r.label === 'Pharmacy' ? { ...r, value: pickedPharmacy } : r));
    P.addStep({ tool: 'ask_user', label: 'Asked to confirm before submitting', status: 'done' });
    P.setState('confirm', { summary });
  }

  async function submit() {
    const id = ++run;
    P.setState('working', { sub: 'Submitting the form…' });
    if (!(await step(id, 'act', 'Pressing “Submit refill request”…', 1300))) return;
    if (!(await step(id, 'read_page', 'Checking the result…', 900))) return;
    P.setState('done', SAMPLES.done);
  }

  function start(question) {
    if (!P.enabled) return;
    withQuestion = question;
    pickedPharmacy = SUMMARY[4].value;
    listen();
  }

  P.on('mic', () => { if (isDemo()) start(withQuestion); });
  P.on('stopListening', () => {
    if (!isDemo()) return;
    const id = run;
    P.mascot.stopMic();
    understand(id);
  });
  P.on('text', (text) => {
    if (!isDemo()) return;
    const id = ++run;
    P.clearSteps();
    understand(id, text);
  });
  P.on('answer', (answer) => {
    if (!isDemo()) return;
    pickedPharmacy = answer;
    fill(run);
  });
  P.on('confirm', () => { if (isDemo()) submit(); });
  P.on('cancel', () => {
    if (!isDemo()) return;
    run++;
    P.setState('idle', {
      eyebrow: 'Cancelled',
      title: 'Okay, nothing was sent.',
      sub: 'The form is still filled in if you change your mind.',
    });
  });
  P.on('stop', () => {
    if (!isDemo()) return;
    run++;
    P.mascot.stopMic();
    P.setState('idle', { eyebrow: 'Stopped', title: 'Stopped.', sub: 'I left the page as it is.' });
  });
  P.on('retry', () => { if (isDemo()) start(false); });

  // Menu
  document.querySelectorAll('[data-action="demo"], [data-action="demo-ask"]').forEach((b) => {
    b.addEventListener('click', () => start(b.dataset.action === 'demo-ask'));
  });
  document.querySelectorAll('[data-jump]').forEach((b) => {
    b.addEventListener('click', () => jump(b.dataset.jump));
  });

  function jump(state) {
    run++;
    P.mascot.stopMic();
    P.clearSteps();
    if (['working', 'confirm', 'done'].includes(state)) {
      SAMPLE_STEPS.forEach((s, i) => P.addStep({ ...s, status: state === 'working' && i === 2 ? 'running' : 'done' }));
    }
    P.setState(state, SAMPLES[state] || {});
    if (state === 'listening') P.mascot.simulate(true);
  }

  if (params.get('reduce') === '1') P.setReducedMotion(true);
  if (params.get('state')) jump(params.get('state'));
})();
