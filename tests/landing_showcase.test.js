/** @jest-environment jsdom */
const fs = require("fs"), path = require("path");
const DIR = "/Users/aayushnakarmi/Desktop/Projects/HackMidwest/voice-control/landing-page/public/extension-ui";
const read = (f) => fs.readFileSync(path.join(DIR, f), "utf8");
function load(scene) {
  localStorage.clear();
  const html = read("index.html");
  document.body.innerHTML = html.slice(html.indexOf("<body>") + 6, html.indexOf("</body>")).replace(/<script[\s\S]*?<\/script>/g, "");
  window.history.replaceState({}, "", `/?scene=${scene}`);
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  // Like Chrome: frame times count from page load, not from 1970
  window.requestAnimationFrame = (fn) => setTimeout(() => fn(performance.now()), 16);
  window.cancelAnimationFrame = (id) => clearTimeout(id);
  // jsdom has no canvas; Chrome does. A do-nothing 2D context for the waveform.
  const fakeCtx = () => {
    const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ctx), set: (t, k, v) => ((t[k] = v), true) });
    return ctx; // every drawing call works and returns something usable (e.g. gradients)
  };
  HTMLCanvasElement.prototype.getContext = fakeCtx;
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.CSS = global.CSS = { escape: (s) => String(s) };
  for (const f of ["js/mascot.js", "js/panel.js", "js/recorder.js", "js/showcase.js"]) window.eval(read(f));
  return window.AgentPanel;
}
beforeEach(() => jest.useFakeTimers());
test.each(["idle", "ask", "working", "confirm", "done"])("scene %s renders", (scene) => {
  const P = load(scene);
  jest.advanceTimersByTime(300);
  expect(P.state).toBe(scene === "idle" ? "idle" : scene);
  expect(P.connection).toBe("online");
  if (scene === "ask") expect(document.querySelectorAll("#ask-options li").length).toBe(4);
  if (scene === "done") expect(document.getElementById("strands-stats").textContent).toMatch(/^Strands/);
  expect(document.querySelector(".brand__name").textContent).toBe("VOYA");
});
test("pressing the button plays the whole example to Done", async () => {
  const P = load("idle");
  document.getElementById("mic-btn").click();
  expect(P.state).toBe("listening");
  for (let i = 0; i < 200 && P.state !== "done"; i++) { jest.advanceTimersByTime(200); await Promise.resolve(); }
  expect(P.state).toBe("done");
  expect(document.querySelectorAll("#steps-list .step").length).toBeGreaterThan(5);
});
