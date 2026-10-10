const listBtn = document.getElementById("list-btn");
const statusEl = document.getElementById("status");
const elementsEl = document.getElementById("elements");
const cmdInput = document.getElementById("cmd-input");
const cmdSend = document.getElementById("cmd-send");
const cmdResult = document.getElementById("cmd-result");

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
  };

  ws.onclose = () => {
    wsConnected = false;
    updateConnectionStatus();
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

    if (msg.type === "new_tab") {
      let url = msg.url || "https://google.com";
      if (!url.startsWith("http")) url = "https://" + url;
      chrome.tabs.create({ url: url }, () => {
        sendReply({ success: true, url: url });
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

// --- Command parser ---
function parseCommand(text) {
  const parts = text.trim().split(/\s+/);
  const action = parts[0].toLowerCase();

  if (action === "click" && parts[1]) {
    return { action: "click", element: parseInt(parts[1]) };
  }
  if (action === "type" && parts[1] && parts[2]) {
    return { action: "type", element: parseInt(parts[1]), value: parts.slice(2).join(" ") };
  }
  if (action === "select" && parts[1] && parts[2]) {
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
  if (!parsed) {
    cmdResult.textContent = "Unknown command. Try: click 7, type 3 hello, scroll down, back, open weather.gov";
    cmdResult.className = "error";
    return;
  }

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

// --- Listen for page_ready from content script ---
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "page_ready") {
    renderElements(message);
    if (ws && wsConnected) {
      ws.send(JSON.stringify(message));
    }
  }
});
