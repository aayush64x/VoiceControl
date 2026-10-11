const listBtn = document.getElementById("list-btn");
const statusEl = document.getElementById("status");
const elementsEl = document.getElementById("elements");
const cmdInput = document.getElementById("cmd-input");
const cmdSend = document.getElementById("cmd-send");
const cmdResult = document.getElementById("cmd-result");
const micBtn = document.getElementById("mic-btn");
const micStatus = document.getElementById("mic-status");
const transcriptEl = document.getElementById("transcript");

// --- WebSocket bridge to Python backend ---
const WS_URL = "ws://localhost:8765";
let ws = null;
let wsConnected = false;

function connectWs() {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
    return;
  }

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    wsConnected = true;
    updateConnectionStatus();
    startMicIfShortcutOpenedPanel();
  };

  ws.onclose = () => {
    wsConnected = false;
    updateConnectionStatus();
    if (recording) stopRecording(false);
    setTimeout(connectWs, 2000);
  };

  ws.onerror = () => {
    wsConnected = false;
  };

  ws.onmessage = (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }
    const replyId = msg.id;

    function sendReply(result) {
      try {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ id: replyId, result: result }));
        }
      } catch {}
    }

    // Transcript from backend
    if (msg.type === "transcript") {
      if (msg.error) {
        // Never forward an error to the agent — show it and reset the mic
        pendingSend = false;
        finalText = "";
        if (recording) stopRecording(false);
        transcriptEl.textContent = "";
        micStatus.textContent = msg.error + " — click mic to try again";
        speak("Sorry, I didn't catch that.");
        return;
      }
      if (msg.is_final) {
        finalText = msg.text;
        transcriptEl.textContent = finalText;
        if (pendingSend && finalText.trim() && answerQuestion && !isStopCommand(finalText)) {
          // A question is on screen: what the user says is the answer, not a new command
          pendingSend = false;
          micStatus.textContent = "Click mic to speak";
          answerQuestion(normalizeAnswer(finalText.trim(), currentQuestionYesNo));
          finalText = "";
        } else if (pendingSend && finalText.trim()) {
          pendingSend = false;
          ws.send(JSON.stringify({ type: "user_said", text: finalText.trim() }));
          cmdResult.textContent = "Processing: " + finalText.trim();
          cmdResult.className = "";
          micStatus.textContent = "Click mic to speak";
          finalText = "";
        } else if (pendingSend) {
          pendingSend = false;
          micStatus.textContent = "Click mic to speak";
        }
      }
      return;
    }

    if (msg.type === "agent_thinking") {
      cmdResult.textContent = msg.text ? "Working on: " + msg.text : "Agent is thinking...";
      cmdResult.className = "";
      clearSteps();
      stopSpeaking();
      return;
    }

    if (msg.type === "step") {
      renderStep(msg);
      return;
    }

    if (msg.type === "site") {
      renderSiteInfo(msg);
      return;
    }

    if (msg.type === "set_overlays") {
      setOverlays(!!msg.on);
      return;
    }

    if (msg.type === "set_speak") {
      setAlwaysSpeak(!!msg.on);
      return;
    }

    if (msg.type === "queued") {
      const ahead = msg.ahead === 1 ? "1 command" : msg.ahead + " commands";
      cmdResult.textContent += "\n\nQueued: " + msg.text + " (after " + ahead + ")";
      return;
    }

    if (msg.type === "question_cancelled") {
      if (closeQuestion) closeQuestion();
      return;
    }

    if (msg.type === "agent_response") {
      // Models sometimes reply in markdown; show plain text
      cmdResult.textContent = (msg.text || "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/^#{1,6}\s+/gm, "");
      cmdResult.className = "";
      // Spoken only when the user asked ("read it out loud") or always-speak is on
      speak(speakableReply(msg.text), msg.speak);
      return;
    }

    if (msg.type === "new_tab") {
      let url = msg.url || "https://google.com";
      if (!url.startsWith("http")) url = "https://" + url;
      chrome.tabs.create({ url: url }, () => {
        sendReply({ success: true, url: url });
      });
      return;
    }

    if (msg.type === "ask_user") {
      speak(msg.question + (msg.yes_no ? " Say yes or no." : ""));
      showQuestion(msg.question, msg.yes_no, (answer) => {
        sendReply({ answer });
      });
      return;
    }

    if (msg.type === "list_elements") {
      sendToBackground({ type: "list_elements" }, sendReply);
    }

    if (msg.type === "action") {
      if (msg.action === "open" && msg.value) {
        let url = msg.value;
        if (!url.startsWith("http")) url = "https://" + url;
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.update(tabs[0].id, { url: url });
            sendReply({ success: true, action: "open", url: url, navigated: true });
          } else {
            sendReply({ error: "No active tab." });
          }
        });
        return;
      }
      sendToBackground(msg, sendReply);
    }
  };
}

// Relay a page command through the background worker. Chrome may have put the
// worker to sleep (e.g. while the user took a minute to answer a question);
// if the message never arrived, wake it and try once more. Messages that may
// have arrived are never resent, so nothing is clicked twice.
const NOT_DELIVERED = /Receiving end does not exist|Could not establish connection/i;
const UNREACHABLE_MSG = "Could not reach this page. It may still be loading, or it is a browser page the extension can't control.";

function sendToBackground(message, reply, retried = false) {
  chrome.runtime.sendMessage(message, (response) => {
    const err = chrome.runtime.lastError;
    if (!err) {
      reply(response);
      return;
    }
    if (!retried && NOT_DELIVERED.test(err.message || "")) {
      setTimeout(() => sendToBackground(message, reply, true), 400);
      return;
    }
    reply({ error: UNREACHABLE_MSG });
  });
}

function updateConnectionStatus() {
  const el = document.getElementById("ws-status");
  if (el) {
    el.textContent = wsConnected ? "Backend: connected" : "Backend: disconnected";
    el.style.color = wsConnected ? "#8f8" : "#f88";
  }
}

connectWs();

// --- Microphone recording (native capture on backend) ---
let recording = false;
let finalText = "";
let pendingSend = false;

function startRecording() {
  if (!wsConnected) {
    micStatus.textContent = "Backend not connected";
    return;
  }

  stopSpeaking(); // the backend mic would otherwise record our own voice
  recording = true;
  finalText = "";
  pendingSend = false;
  transcriptEl.textContent = "";
  micBtn.classList.add("recording");
  micStatus.textContent = "Listening...";
  micStatus.classList.add("listening");

  ws.send(JSON.stringify({ type: "voice_start" }));
}

function stopRecording(sendToAgent = true) {
  recording = false;

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "voice_stop", cancel: !sendToAgent }));
  }

  micBtn.classList.remove("recording");
  micStatus.classList.remove("listening");

  if (sendToAgent) {
    micStatus.textContent = "Transcribing...";
    pendingSend = true;
  } else {
    finalText = "";
    micStatus.textContent = "Click mic to speak";
  }
}

function toggleMic() {
  if (recording) {
    stopRecording();
  } else {
    startRecording();
  }
}

micBtn.addEventListener("click", toggleMic);

// The Alt+Shift+V shortcut opened this panel: start listening right away
function startMicIfShortcutOpenedPanel() {
  if (!chrome.storage || !chrome.storage.session) return;
  chrome.storage.session.get("startMicOnOpen", ({ startMicOnOpen }) => {
    if (!startMicOnOpen) return;
    chrome.storage.session.remove("startMicOnOpen");
    if (Date.now() - startMicOnOpen < 10000 && !recording) startRecording();
  });
}

// --- Spoken replies ---
const speakToggle = document.getElementById("speak-replies");
try {
  speakToggle.checked = localStorage.getItem("speakReplies") === "on";
} catch {}
// "Always speak replies" — the checkbox, or "settings speak on/off"
function setAlwaysSpeak(on) {
  speakToggle.checked = on;
  try { localStorage.setItem("speakReplies", on ? "on" : "off"); } catch {}
  if (!on) stopSpeaking();
}
speakToggle.addEventListener("change", () => setAlwaysSpeak(speakToggle.checked));

// force: the user asked for this reply to be read aloud
function speak(text, force = false) {
  if (!(force || speakToggle.checked) || !text || !window.speechSynthesis) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.05;
  speechSynthesis.speak(utterance);
}

function stopSpeaking() {
  if (window.speechSynthesis) speechSynthesis.cancel();
}

// Turn an agent reply into something worth hearing: no JSON, no full URLs, not too long
function speakableReply(text) {
  if (!text) return "";
  if (text.startsWith("OK:")) return "Done.";
  if (text.startsWith("Found ") && text.includes(" elements:")) return text.split("\n")[0];
  let out = text
    .replace(/https?:\/\/(?:www\.)?([^\/\s?]+)\S*/g, "$1")
    .replace(/[*_#`>]/g, "")
    .replace(/\(element \d+\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (out.length > 1200) {
    const cut = out.slice(0, 1200);
    const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
    out = end > 100 ? cut.slice(0, end + 1) : cut + "…";
  }
  return out;
}

function isStopCommand(text) {
  return /^(stop|cancel|stop it|never mind|nevermind)[.!]?$/i.test(text.trim());
}

// Spoken yes/no answers in everyday words map onto the Yes/No buttons
function normalizeAnswer(text, yesNo) {
  if (!yesNo) return text;
  const t = text.toLowerCase().replace(/[.!?]/g, "").trim();
  if (/^(yes|yeah|yep|yup|sure|ok|okay|go ahead|do it|correct|right)\b/.test(t)) return "Yes";
  if (/^(no|nope|nah|don't|do not|not now)\b/.test(t)) return "No";
  return text;
}

// --- List elements button ---
listBtn.addEventListener("click", () => {
  statusEl.textContent = "Scanning page...";
  elementsEl.innerHTML = "";

  chrome.runtime.sendMessage({ type: "list_elements" }, (response) => {
    if (chrome.runtime.lastError) {
      statusEl.textContent = "Error: " + chrome.runtime.lastError.message;
      return;
    }
    if (!response || !response.elements) {
      statusEl.textContent = "No response from page. Try refreshing the page.";
      return;
    }

    statusEl.textContent = `Found ${response.count} interactive elements.`;

    for (const el of response.elements) {
      const div = document.createElement("div");
      div.className = "el-item";
      div.innerHTML = `<span class="el-num">${el.num}:</span>${el.label}<span class="el-type">${el.type}</span>${el.value ? ` <span class="el-value">${el.value}</span>` : ""}`;
      elementsEl.appendChild(div);
    }
  });
});

// --- Command parser (direct commands) ---
function parseCommand(text) {
  const parts = text.trim().split(/\s+/);
  const action = parts[0].toLowerCase();

  if (action === "click" && parts[1] && /^\d+$/.test(parts[1])) {
    return { action: "click", element: parseInt(parts[1]) };
  }
  if (action === "type" && parts[1] && /^\d+$/.test(parts[1]) && parts[2]) {
    return { action: "type", element: parseInt(parts[1]), value: parts.slice(2).join(" ") };
  }
  if (action === "select" && parts[1] && /^\d+$/.test(parts[1]) && parts[2]) {
    return { action: "select", element: parseInt(parts[1]), value: parts.slice(2).join(" ") };
  }
  if (action === "scroll") {
    return { action: "scroll", value: parts[1] || "down" };
  }
  if (action === "back") {
    return { action: "back" };
  }
  if (action === "open" && parts[1]) {
    let url = parts[1];
    if (!url.startsWith("http")) url = "https://" + url;
    return { action: "open", value: url };
  }
  if (action === "read") {
    return { action: "read" };
  }
  return null;
}

function runCommand() {
  const text = cmdInput.value.trim();
  if (!text) return;

  const parsed = parseCommand(text);
  if (parsed) {
    cmdResult.textContent = "Running...";
    cmdResult.className = "";

    chrome.runtime.sendMessage({ type: "action", ...parsed }, (response) => {
      if (chrome.runtime.lastError) {
        cmdResult.textContent = "Error: " + chrome.runtime.lastError.message;
        cmdResult.className = "error";
        return;
      }
      if (!response) {
        cmdResult.textContent = "No response from page.";
        cmdResult.className = "error";
        return;
      }
      if (response.success) {
        cmdResult.textContent = JSON.stringify(response, null, 2);
        cmdResult.className = "";
      } else {
        cmdResult.textContent = response.error || "Action failed.";
        cmdResult.className = "error";
      }
    });
  } else if (wsConnected) {
    ws.send(JSON.stringify({ type: "user_said", text: text }));
    cmdResult.textContent = "Processing: " + text;
    cmdResult.className = "";
  } else {
    cmdResult.textContent = "Backend not connected for natural language commands.";
    cmdResult.className = "error";
  }

  cmdInput.value = "";
}

cmdSend.addEventListener("click", runCommand);
cmdInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") runCommand();
});

// --- Number tags on the page: on/off ---
// Saved in chrome.storage; every tab's page script listens and shows/hides them.
const overlayToggle = document.getElementById("show-overlays");

function setOverlays(on) {
  overlayToggle.checked = on;
  chrome.storage.local.set({ showOverlays: on });
}

chrome.storage.local.get("showOverlays", (stored) => {
  overlayToggle.checked = !(stored && stored.showOverlays === false);
});
overlayToggle.addEventListener("change", () => setOverlays(overlayToggle.checked));

// --- What site memory knows about the current website ---
const siteInfoEl = document.getElementById("site-info");

function renderSiteInfo(site) {
  siteInfoEl.textContent = "";
  if (!site.known || !site.kind) {
    const span = document.createElement("span");
    span.className = "learning";
    span.textContent = `Learning ${site.domain}…`;
    siteInfoEl.appendChild(span);
    return;
  }
  const parts = [`Site memory: ${site.name}`, site.kind];
  if (site.search) parts.push("search box ✓");
  if (site.chat) parts.push("chat box ✓");
  siteInfoEl.textContent = parts.join(" · ");
}

// --- Agent step list (one row per Strands tool call) ---
const stepsSection = document.getElementById("steps-section");
const stepsEl = document.getElementById("steps");
const STEP_NAMES = {
  route: "Route",
  read_page: "Read page",
  read_text: "Read text",
  act: "Act",
  search: "Search",
  fill_form: "Fill form",
  ask_user: "Ask you",
  search_memory: "Recall saved details",
  add_memory: "Save to memory",
};
const STEP_ICONS = { running: "●", ok: "✓", error: "✗", cancelled: "⊘" };

function clearSteps() {
  stepsEl.textContent = "";
  stepsSection.classList.remove("has-steps");
}

// Page text ends up in step details, so everything is set with textContent — never innerHTML
function renderStep(step) {
  let row = step.step_id ? stepsEl.querySelector(`[data-step-id="${CSS.escape(step.step_id)}"]`) : null;
  if (!row) {
    row = document.createElement("li");
    if (step.step_id) row.dataset.stepId = step.step_id;
    row.innerHTML = '<span class="step-icon"></span><div><div><span class="step-name"></span> <span class="step-input"></span></div><div class="step-detail"></div></div><span class="step-ms"></span>';
    stepsEl.appendChild(row);
    stepsSection.classList.add("has-steps");
  }
  const status = step.status || "running";
  row.className = `step ${status}${step.tool === "route" ? " route" : ""}`;
  row.querySelector(".step-icon").textContent = STEP_ICONS[status] || "●";
  row.querySelector(".step-name").textContent = STEP_NAMES[step.tool] || step.tool;
  if (step.input !== undefined) row.querySelector(".step-input").textContent = step.input;
  if (step.detail !== undefined) row.querySelector(".step-detail").textContent = step.detail;
  if (step.ms != null) row.querySelector(".step-ms").textContent = step.ms < 1000 ? `${step.ms}ms` : `${(step.ms / 1000).toFixed(1)}s`;
  stepsEl.scrollTop = stepsEl.scrollHeight;
}

// --- Render elements list ---
function renderElements(response) {
  elementsEl.innerHTML = "";
  statusEl.textContent = `Found ${response.count} elements on: ${response.title || "page"}`;
  for (const el of response.elements) {
    const div = document.createElement("div");
    div.className = "el-item";
    div.innerHTML = `<span class="el-num">${el.num}:</span>${el.label}<span class="el-type">${el.type}</span>${el.value ? ` <span class="el-value">${el.value}</span>` : ""}`;
    elementsEl.appendChild(div);
  }
}

// --- Ask-user UI ---
// Set while a question is on screen, so a new command can dismiss it
// and a spoken reply can answer it
let closeQuestion = null;
let answerQuestion = null;
let currentQuestionYesNo = false;

function showQuestion(question, yesNo, callback) {
  const container = document.getElementById("ask-container");
  const questionEl = document.getElementById("ask-question");
  const inputEl = document.getElementById("ask-input");
  const yesBtn = document.getElementById("ask-yes");
  const noBtn = document.getElementById("ask-no");
  const sendBtn = document.getElementById("ask-send");

  questionEl.textContent = question;
  container.style.display = "block";
  container.classList.add("ask-active");

  if (yesNo) {
    inputEl.style.display = "none";
    sendBtn.style.display = "none";
    yesBtn.style.display = "inline-block";
    noBtn.style.display = "inline-block";
  } else {
    inputEl.style.display = "block";
    sendBtn.style.display = "inline-block";
    yesBtn.style.display = "inline-block";
    noBtn.style.display = "inline-block";
    inputEl.value = "";
    inputEl.focus();
  }

  function cleanup() {
    container.style.display = "none";
    container.classList.remove("ask-active");
    yesBtn.onclick = null;
    noBtn.onclick = null;
    sendBtn.onclick = null;
    inputEl.onkeydown = null;
    closeQuestion = null;
    answerQuestion = null;
  }
  closeQuestion = cleanup;
  currentQuestionYesNo = !!yesNo;
  answerQuestion = (answer) => { cleanup(); callback(answer); };

  yesBtn.onclick = () => { cleanup(); callback("Yes"); };
  noBtn.onclick = () => { cleanup(); callback("No"); };

  function submitText() {
    const text = inputEl.value.trim();
    if (!text) return;
    cleanup();
    callback(text);
  }
  sendBtn.onclick = submitText;
  inputEl.onkeydown = (e) => { if (e.key === "Enter") submitText(); };
}

// --- Listen for messages from background/content ---
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "toggle_mic") {
    toggleMic();
    return;
  }
  if (message.type === "page_loading") {
    if (ws && wsConnected) ws.send(JSON.stringify(message));
    return;
  }
  if (message.type === "page_ready") {
    renderElements(message);
    if (ws && wsConnected) {
      ws.send(JSON.stringify(message));
    }
  }
});
