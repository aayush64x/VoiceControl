/**
 * @jest-environment jsdom
 *
 * Smoke test for the Soft Glass side panel + bridge.js: loads the real panel
 * markup and scripts, fakes Chrome and the backend WebSocket, and plays a
 * conversation through it.
 */

const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "extension", "sidepanel");
const read = (f) => fs.readFileSync(path.join(DIR, f), "utf8");

let sockets;
let runtimeListeners;
let sentToBackground;
let storage;

class FakeSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.sent = [];
    sockets.push(this);
  }
  send(data) { this.sent.push(JSON.parse(data)); }
  open() { this.readyState = 1; this.onopen && this.onopen(); }
  receive(msg) { this.onmessage({ data: JSON.stringify(msg) }); }
  close() { this.readyState = 3; this.onclose && this.onclose(); }
}
FakeSocket.CONNECTING = 0;
FakeSocket.OPEN = 1;

function loadPanel() {
  sockets = [];
  runtimeListeners = [];
  sentToBackground = [];
  storage = {};
  localStorage.clear();

  const html = read("sidepanel.html");
  document.body.innerHTML = html.slice(html.indexOf("<body>") + 6, html.indexOf("</body>")).replace(/<script[\s\S]*?<\/script>/g, "");

  window.WebSocket = FakeSocket;
  global.WebSocket = FakeSocket;
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  window.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 16);
  window.cancelAnimationFrame = (id) => clearTimeout(id);
  HTMLCanvasElement.prototype.getContext = () => null;
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }; // jsdom lacks it; Chrome has it
  global.CSS = { escape: (s) => String(s).replace(/([^\w-])/g, "\\$1") };
  window.CSS = global.CSS;
  window.chrome = global.chrome = {
    runtime: {
      sendMessage: (msg, cb) => { sentToBackground.push(msg); cb && cb({ ok: true, echo: msg }); },
      onMessage: { addListener: (fn) => runtimeListeners.push(fn) },
      lastError: null,
    },
    storage: {
      local: { get: (k, cb) => cb({ [k]: storage[k] }), set: (o) => Object.assign(storage, o) },
      session: { get: (k, cb) => cb({}), remove() {} },
    },
    tabs: { create: (o, cb) => cb && cb(), query: (q, cb) => cb([{ id: 1 }]), update() {} },
  };

  for (const f of ["js/mascot.js", "js/panel.js", "js/recorder.js", "js/bridge.js"]) {
    window.eval(read(f));
  }
  return { P: window.AgentPanel, ws: sockets[0] };
}

const title = () => document.getElementById("status-title").textContent;
const sub = () => document.getElementById("status-sub").textContent;
const chips = () => Array.from(document.querySelectorAll("#ask-options .chip span:first-child")).map((c) => c.textContent);
const steps = () => Array.from(document.querySelectorAll("#steps-list .step")).map((s) => [s.dataset.status, s.querySelector(".step__label").textContent]);

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("side panel bridge", () => {
  test("starts offline, goes online when the backend connects", () => {
    const { P, ws } = loadPanel();
    expect(ws.url).toBe("ws://localhost:8765");
    expect(P.connection).toBe("offline");
    expect(document.querySelector("#conn .conn__label").textContent).toBe("Offline");
    ws.open();
    jest.advanceTimersByTime(200);
    expect(P.connection).toBe("online");
    expect(P.state).toBe("idle");
    expect(window.__NO_SPLINE).toBe(true);
  });

  test("mic -> backend records -> transcript becomes a command", () => {
    const { P, ws } = loadPanel();
    ws.open();
    document.getElementById("mic-btn").click();
    expect(P.state).toBe("listening");
    expect(ws.sent).toContainEqual({ type: "voice_start" });

    document.getElementById("stop-listen-btn").click();
    expect(ws.sent).toContainEqual({ type: "voice_stop", cancel: false });
    ws.receive({ type: "transcript", text: "what benefits do I qualify for", is_final: true });
    expect(ws.sent).toContainEqual({ type: "user_said", text: "what benefits do I qualify for" });
    expect(P.state).toBe("thinking");
  });

  test("a misheard recording goes back to idle without sending anything", () => {
    const { P, ws } = loadPanel();
    ws.open();
    document.getElementById("mic-btn").click();
    document.getElementById("stop-listen-btn").click();
    ws.receive({ type: "transcript", text: "", is_final: true, error: "Could not understand audio" });
    jest.advanceTimersByTime(200);
    expect(P.state).toBe("idle");
    expect(title()).toBe("Sorry, I didn't catch that.");
    expect(ws.sent.filter((m) => m.type === "user_said")).toEqual([]);
  });

  test("Strands steps, plain labels, statuses and stats", () => {
    const { ws } = loadPanel();
    ws.open();
    ws.receive({ type: "agent_thinking", text: "fill the form" });
    ws.receive({ type: "step", tool: "route", input: "Strands agent · Claude Sonnet (multi-step task)", status: "ok" });
    ws.receive({ type: "step", step_id: "a", tool: "act", input: 'search "cat videos"', status: "running" });
    ws.receive({ type: "step", step_id: "a", tool: "act", status: "ok", ms: 840 });
    ws.receive({ type: "step", step_id: "s", tool: "safety", input: '"Submit" — asking you first', status: "running" });
    ws.receive({ type: "step", step_id: "s", tool: "safety", status: "cancelled" });
    ws.receive({ type: "stats", summary: "Strands · Claude Sonnet · 3 model calls · 2 tool calls · 4.1k tokens · 80% cached · 9s" });
    expect(steps()).toEqual([
      ["done", "Strands agent · Claude Sonnet (multi-step task)"],
      ["done", 'Searching "cat videos" (840ms)'],
      ["cancelled", 'Safety check: "Submit" — asking you first'],
    ]);
    expect(document.getElementById("strands-stats").textContent).toMatch(/^Strands · Claude Sonnet · 3 model calls/);
  });

  test("a question with options shows chips; tapping one answers it", () => {
    const { P, ws } = loadPanel();
    ws.open();
    ws.receive({ type: "agent_thinking", text: "benefits" });
    ws.receive({ id: 7, type: "ask_user", yes_no: false,
      question: "Are you married? Yes; Yes, but we don't live together; No, I'm widowed or divorced; or No, I've never been married." });
    jest.advanceTimersByTime(200);
    expect(P.state).toBe("ask");
    expect(title()).toBe("Are you married?");
    expect(chips()).toEqual(["Yes", "Yes, but we don't live together", "No, I'm widowed or divorced", "No, I've never been married"]);

    document.querySelectorAll("#ask-options .chip")[3].click();
    expect(ws.sent).toContainEqual({ id: 7, result: { answer: "No, I've never been married" } });
    expect(P.state).toBe("working");
  });

  test("a yes/no question answered by voice maps 'yeah' to Yes", () => {
    const { ws } = loadPanel();
    ws.open();
    ws.receive({ id: 8, type: "ask_user", yes_no: true, question: "Have you ever worked and paid Social Security taxes?" });
    expect(chips()).toEqual(["Yes", "No"]);
    document.querySelector('[data-action="mic"]').click(); // the mic in the question view
    document.getElementById("stop-listen-btn").click();
    ws.receive({ type: "transcript", text: "yeah", is_final: true });
    expect(ws.sent).toContainEqual({ id: 8, result: { answer: "Yes" } });
  });

  test("'Should I submit?' becomes the Submit / Cancel card", () => {
    const { P, ws } = loadPanel();
    ws.open();
    ws.receive({ id: 9, type: "ask_user", yes_no: true, question: "I'll submit: Jordan, Tuesday morning. Should I submit?" });
    jest.advanceTimersByTime(200);
    expect(P.state).toBe("confirm");
    document.getElementById("cancel-btn").click();
    expect(ws.sent).toContainEqual({ id: 9, result: { answer: "No" } });
  });

  test("an answer spoken before the next question is held for it", () => {
    const { ws } = loadPanel();
    ws.open();
    ws.receive({ type: "agent_thinking", text: "benefits" });
    ws.receive({ id: 1, type: "ask_user", yes_no: true, question: "Are you unable to work?" });
    document.querySelectorAll("#ask-options .chip")[0].click(); // answer Q1
    // User speaks the next answer before Q2 arrives
    document.getElementById("mic-btn").click();
    document.getElementById("stop-listen-btn").click();
    ws.receive({ type: "transcript", text: "yes", is_final: true });
    expect(ws.sent.filter((m) => m.type === "user_said")).toEqual([]); // not a new command
    ws.receive({ id: 2, type: "ask_user", yes_no: true, question: "Will it last a year or more?" });
    expect(ws.sent).toContainEqual({ id: 2, result: { answer: "Yes" } });
  });

  test("results show as Done; 'Stopped.' goes back to idle", () => {
    const { P, ws } = loadPanel();
    ws.open();
    ws.receive({ type: "agent_response", text: "You may qualify for **SSDI**." });
    jest.advanceTimersByTime(200);
    expect(P.state).toBe("done");
    expect(sub()).toBe("You may qualify for SSDI.");
    ws.receive({ type: "agent_response", text: "Stopped." });
    jest.advanceTimersByTime(200);
    expect(P.state).toBe("idle");
  });

  test("page commands are relayed to the page; open navigates the tab", () => {
    const { ws } = loadPanel();
    ws.open();
    ws.receive({ id: 3, type: "list_elements" });
    expect(sentToBackground).toContainEqual({ type: "list_elements" });
    expect(ws.sent.find((m) => m.id === 3).result.ok).toBe(true);
    ws.receive({ id: 4, type: "action", action: "open", value: "weather.gov" });
    expect(ws.sent).toContainEqual({ id: 4, result: { success: true, action: "open", url: "https://weather.gov", navigated: true } });
  });

  test("site memory line and settings commands", () => {
    const { ws } = loadPanel();
    ws.open();
    ws.receive({ type: "site", domain: "youtube.com", name: "YouTube", kind: "video", search: true, chat: false, known: true });
    expect(document.getElementById("site-info").textContent).toBe("YouTube · video · search box ✓");
    ws.receive({ type: "set_overlays", on: false });
    expect(storage.showOverlays).toBe(false);
    expect(document.getElementById("pref-numbers").checked).toBe(false);
    ws.receive({ type: "set_speak", on: true });
    expect(document.getElementById("pref-speak").checked).toBe(true);
  });

  test("typed request goes to the backend; Option+Shift+V toggles the mic", () => {
    const { P, ws } = loadPanel();
    ws.open();
    document.getElementById("type-input").value = "search cat videos";
    document.getElementById("type-box").dispatchEvent(new Event("submit", { cancelable: true }));
    expect(ws.sent).toContainEqual({ type: "user_said", text: "search cat videos" });
    runtimeListeners.forEach((fn) => fn({ type: "toggle_mic" }));
    expect(P.state).toBe("listening");
  });
});

describe("question options without semicolons", () => {
  test("'or' separates options only when there are no semicolons", () => {
    const { ws } = loadPanel();
    ws.open();
    ws.receive({ id: 5, type: "ask_user", yes_no: false, question: "Which time works best? Morning or afternoon." });
    expect(chips()).toEqual(["Morning", "afternoon"]);
    ws.receive({ id: 6, type: "ask_user", yes_no: false, question: "What is your date of birth?" });
    expect(chips()).toEqual([]);
  });
});
