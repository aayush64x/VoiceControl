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

const UNREACHABLE = "Could not reach this page. It may still be loading, or it is a browser page "
  + "the extension can't control (chrome://, Web Store, PDF).";

function forwardToTab(message, sendResponse) {
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (!tabs[0]) {
      sendResponse({ error: "No active tab" });
      return;
    }
    const tab = tabs[0];
    await ensureContentScript(tab.id);
    sendToTab(tab, message, sendResponse);
  });
}

// "Receiving end does not exist" means the message never arrived (the page
// script wasn't ready — right after a load, or after Chrome put this worker
// to sleep), so sending again is safe. Any other error means it may have
// arrived, and retrying could click something twice — so never retry those.
const NOT_DELIVERED = /Receiving end does not exist|Could not establish connection/i;

// Errors include the tab's address, so the agent knows it's on e.g. a blank
// new tab (chrome://newtab) rather than the last page it could read.
function sendToTab(tab, message, sendResponse, retried = false) {
  chrome.tabs.sendMessage(tab.id, message, (response) => {
    const err = chrome.runtime.lastError;
    if (!err) {
      sendResponse(response);
      return;
    }
    if (!retried && NOT_DELIVERED.test(err.message || "")) {
      setTimeout(async () => {
        await ensureContentScript(tab.id);
        sendToTab(tab, message, sendResponse, true);
      }, 400);
      return;
    }
    sendResponse({ error: UNREACHABLE, url: tab.url || tab.pendingUrl || "", title: tab.title || "" });
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

// A tab started loading a new page — tell the backend so actions that navigate
// wait for the new page instead of reading the old one.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "loading" || !tab.active) return;
  chrome.runtime.sendMessage({ type: "page_loading", url: changeInfo.url || tab.url }).catch(() => {});
});
