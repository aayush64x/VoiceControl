chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.url && tab.url.startsWith("chrome://")) {
    await chrome.tabs.update(tab.id, { url: "https://google.com" });
  }
});

async function ensureContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });
  } catch (e) {
    // Already injected or can't inject (chrome:// pages)
  }
}

function forwardToTab(message, sendResponse) {
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (!tabs[0]) {
      sendResponse({ error: "No active tab" });
      return;
    }
    const tabId = tabs[0].id;
    await ensureContentScript(tabId);

    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: "Could not reach page. Try refreshing." });
        return;
      }
      sendResponse(response);
    });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "list_elements" || message.type === "action") {
    forwardToTab(message, sendResponse);
    return true;
  }

  // page_ready from content scripts reaches the side panel directly, so it is
  // not re-forwarded here (that made every page report twice).
});

// Keyboard shortcut (Alt+Shift+V): start/stop voice without touching the mouse.
// Opens the side panel first if needed — sidePanel.open must run synchronously
// inside the shortcut's user gesture, so it's called before anything async.
chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== "toggle-mic") return;
  if (tab && tab.windowId !== undefined) {
    chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
  }
  chrome.runtime.sendMessage({ type: "toggle_mic" }).catch(() => {
    // Panel wasn't open yet — it starts the mic itself once it has loaded
    chrome.storage.session.set({ startMicOnOpen: Date.now() });
  });
});
