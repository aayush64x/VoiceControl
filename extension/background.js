chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

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

  // Fix 6: page_ready from content script — forward to side panel
  if (message.type === "page_ready") {
    chrome.runtime.sendMessage(message).catch(() => {});
  }
});
