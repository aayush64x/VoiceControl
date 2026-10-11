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
  ws.binaryType = "arraybuffer";

  ws.onopen = () => {
    wsConnected = true;
    updateConnectionStatus();
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

    // --- Voice transcript results ---
    if (msg.type === "transcript") {
      if (msg.is_final) {
        finalText += (finalText ? " " : "") + msg.text;
        transcriptEl.innerHTML = finalText;
      } else {
        const partial = `<span class="partial">${msg.text}</span>`;
        transcriptEl.innerHTML = finalText ? finalText + " " + partial : partial;
      }
      return;
    }

    if (msg.type === "agent_thinking") {
      cmdResult.textContent = "Agent is thinking...";
      cmdResult.className = "";
      return;
    }

    if (msg.type === "agent_response") {
      cmdResult.textContent = msg.text;
      cmdResult.className = "";
      return;
    }

    // --- Existing message handlers ---
    if (msg.type === "new_tab") {
      let url = msg.url || "https://google.com";
      if (!url.startsWith("http")) url = "https://" + url;
      chrome.tabs.create({ url: url }, () => {
        sendReply({ success: true, url: url });
      });
      return;
    }

    if (msg.type === "ask_user") {
      showQuestion(msg.question, msg.yes_no, (answer) => {
        sendReply({ answer });
      });
      return;
    }

    if (msg.type === "list_elements") {
      chrome.runtime.sendMessage({ type: "list_elements" }, (response) => {
        if (chrome.runtime.lastError) {
          sendReply({ error: "Could not reach page. Try refreshing." });
          return;
        }
        sendReply(response);
      });
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
      chrome.runtime.sendMessage(msg, (response) => {
        if (chrome.runtime.lastError) {
          sendReply({ error: "Could not reach page. Try refreshing." });
          return;
        }
        sendReply(response);
      });
    }
  };
}

function updateConnectionStatus() {
  const el = document.getElementById("ws-status");
  if (el) {
    el.textContent = wsConnected ? "Backend: connected" : "Backend: disconnected";
    el.style.color = wsConnected ? "#8f8" : "#f88";
  }
}

connectWs();

// --- Microphone recording ---
let recording = false;
let audioContext = null;
let mediaStream = null;
let processor = null;
let finalText = "";

async function startRecording() {
  if (!wsConnected) {
    micStatus.textContent = "Backend not connected";
    return;
  }

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    micStatus.textContent = "Mic access denied";
    micStatus.classList.remove("listening");
    return;
  }

  try {
    audioContext = new AudioContext({ sampleRate: 16000 });
  } catch {
    audioContext = new AudioContext();
  }

  const source = audioContext.createMediaStreamSource(mediaStream);
  processor = audioContext.createScriptProcessor(4096, 1, 1);

  source.connect(processor);
  processor.connect(audioContext.destination);

  ws.send(JSON.stringify({ type: "voice_start" }));

  processor.onaudioprocess = (e) => {
    if (!recording || !ws || ws.readyState !== WebSocket.OPEN) return;
    const float32 = e.inputBuffer.getChannelData(0);
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    ws.send(int16.buffer);
  };

  recording = true;
  finalText = "";
  transcriptEl.textContent = "";
  micBtn.classList.add("recording");
  micStatus.textContent = "Listening...";
  micStatus.classList.add("listening");
}

function stopRecording(sendToAgent = true) {
  recording = false;

  if (processor) { processor.disconnect(); processor = null; }
  if (audioContext) { audioContext.close().catch(() => {}); audioContext = null; }
  if (mediaStream) { mediaStream.getTracks().forEach((t) => t.stop()); mediaStream = null; }

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "voice_stop" }));
  }

  const text = finalText.trim();
  if (sendToAgent && text && ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "user_said", text: text }));
    cmdResult.textContent = "Processing: " + text;
    cmdResult.className = "";
  }

  finalText = "";
  micBtn.classList.remove("recording");
  micStatus.textContent = "Click mic to speak";
  micStatus.classList.remove("listening");
}

micBtn.addEventListener("click", () => {
  if (recording) {
    stopRecording();
  } else {
    startRecording();
  }
});

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
  }

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

// --- Listen for page_ready from content script ---
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "page_ready") {
    renderElements(message);
    if (ws && wsConnected) {
      ws.send(JSON.stringify(message));
    }
  }
});
