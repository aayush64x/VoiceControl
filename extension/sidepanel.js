const listBtn = document.getElementById("list-btn");
const statusEl = document.getElementById("status");
const elementsEl = document.getElementById("elements");
const cmdInput = document.getElementById("cmd-input");
const cmdSend = document.getElementById("cmd-send");
const cmdResult = document.getElementById("cmd-result");

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

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "page_ready") {
    renderElements(message);
  }
});
