// --- State ---
let elementMap = {};
let nextNum = 1;
let overlayContainer = null;

// --- Fix 3: Overlay container so MutationObserver can ignore our own tags ---
function getOverlayContainer() {
  if (overlayContainer && overlayContainer.parentNode) return overlayContainer;
  overlayContainer = document.createElement("div");
  overlayContainer.id = "voice-agent-overlays";
  overlayContainer.setAttribute("aria-hidden", "true");
  document.body.appendChild(overlayContainer);
  return overlayContainer;
}

// --- Visibility ---
function isVisible(el) {
  if (!el.offsetParent && el.tagName !== "BODY") return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

// --- Labels ---
function getLabel(el) {
  if (el.getAttribute("aria-label")) return el.getAttribute("aria-label");
  if (el.title) return el.title;
  if (el.placeholder) return el.placeholder;

  if (el.id) {
    const label = document.querySelector(`label[for="${el.id}"]`);
    if (label) return label.textContent.trim();
  }

  const text = el.textContent.trim();
  if (text && text.length < 80) return text;

  if (el.tagName === "INPUT") return el.type || "input";
  return el.tagName.toLowerCase();
}

// --- Element type ---
function getElementType(el) {
  const tag = el.tagName;
  if (tag === "A") return "link";
  if (tag === "BUTTON" || (tag === "INPUT" && el.type === "submit")) return "button";
  if (tag === "INPUT") return el.type === "checkbox" ? "checkbox" : el.type === "radio" ? "radio" : "field";
  if (tag === "TEXTAREA") return "field";
  if (tag === "SELECT") return "dropdown";
  if (el.getAttribute("role") === "button") return "button";
  if (el.getAttribute("role") === "link") return "link";
  if (el.onclick || el.getAttribute("tabindex")) return "clickable";
  return "element";
}

// --- Fix 1: Stable numbers across re-scans ---
function listElements() {
  const oldMap = elementMap;
  const newMap = {};
  const results = [];

  const selectors = "a, button, input, textarea, select, [role='button'], [role='link'], [tabindex]";
  const elements = document.querySelectorAll(selectors);

  for (const el of elements) {
    if (!isVisible(el)) continue;
    if (el.tagName === "INPUT" && el.type === "hidden") continue;
    if (el.closest("[aria-hidden='true']")) continue;

    let num = el.dataset.agentNum ? parseInt(el.dataset.agentNum) : null;
    if (num && oldMap[num] === el) {
      // Element kept its old number
    } else {
      num = nextNum++;
      el.dataset.agentNum = num;
    }

    newMap[num] = el;

    const type = getElementType(el);
    const label = getLabel(el);

    let value = "";
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      value = el.value ? ` [value: "${el.value}"]` : "";
    }
    if (el.tagName === "SELECT" && el.selectedOptions.length) {
      value = ` [selected: "${el.selectedOptions[0].text}"]`;
    }
    if (el.type === "checkbox" || el.type === "radio") {
      value = el.checked ? " [checked]" : " [unchecked]";
    }

    results.push({ num, type, label: label.substring(0, 60), value });
  }

  elementMap = newMap;
  results.sort((a, b) => a.num - b.num);
  return results;
}

// --- Overlays ---
function clearOverlays() {
  const container = getOverlayContainer();
  container.innerHTML = "";
}

function showOverlays() {
  clearOverlays();
  const container = getOverlayContainer();
  for (const [num, el] of Object.entries(elementMap)) {
    const rect = el.getBoundingClientRect();
    const tag = document.createElement("div");
    tag.textContent = num;
    tag.dataset.overlayFor = num;
    tag.style.cssText = `
      position: fixed;
      left: ${rect.left - 2}px;
      top: ${rect.top - 2}px;
      background: #ff6600;
      color: white;
      font-size: 11px;
      font-weight: bold;
      padding: 1px 4px;
      border-radius: 3px;
      z-index: 999999;
      pointer-events: none;
      font-family: monospace;
    `;
    container.appendChild(tag);
  }
}

function updateOverlayPositions() {
  if (!overlayContainer) return;
  const tags = overlayContainer.querySelectorAll("[data-overlay-for]");
  for (const tag of tags) {
    const num = tag.dataset.overlayFor;
    const el = elementMap[num];
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    tag.style.left = (rect.left - 2) + "px";
    tag.style.top = (rect.top - 2) + "px";
  }
}

// --- Scroll listener ---
let scrollTimer = null;
if (typeof window !== "undefined") {
  window.addEventListener("scroll", () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(updateOverlayPositions, 50);
  }, true);
}

// --- Fix 3: MutationObserver ignores our overlay container ---
let mutationTimer = null;
if (typeof MutationObserver !== "undefined") {
  const observer = new MutationObserver((mutations) => {
    const ours = mutations.every((m) => {
      const target = m.target;
      return target.id === "voice-agent-overlays" ||
        (target.parentElement && target.parentElement.id === "voice-agent-overlays");
    });
    if (ours) return;

    clearTimeout(mutationTimer);
    mutationTimer = setTimeout(() => {
      if (Object.keys(elementMap).length > 0) {
        listElements();
        showOverlays();
      }
    }, 500);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

// --- Fix 5: Scroll into view accounting for sticky headers ---
function scrollToElement(el) {
  el.scrollIntoView({ behavior: "smooth", block: "center" });
}

// --- Fix 4: React-compatible typing ---
function setNativeValue(el, value) {
  const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value");
  if (setter && setter.set) {
    setter.set.call(el, value);
  } else {
    el.value = value;
  }
}

// --- Fix 2: Every action reports back clearly ---
function doAction(action, element, value) {
  if (action === "scroll") {
    const dir = value || "down";
    const amount = dir === "up" ? -400 : 400;
    window.scrollBy({ top: amount, behavior: "smooth" });
    return { success: true, action: "scroll", direction: dir };
  }

  if (action === "back") {
    window.history.back();
    return { success: true, action: "back" };
  }

  if (action === "open") {
    if (!value) return { success: false, error: "No URL provided." };
    if (!value.startsWith("http")) value = "https://" + value;
    window.location.href = value;
    return { success: true, action: "open", url: value };
  }

  if (action === "read") {
    const elements = listElements();
    return { success: true, elements, count: elements.length };
  }

  if (!element) return { success: false, error: "No element number provided." };

  const el = elementMap[element];
  if (!el) return { success: false, error: `Element ${element} not found. Run read first to get the current element list.` };

  if (!isVisible(el)) return { success: false, error: `Element ${element} is no longer visible on the page.` };

  if (el.disabled) return { success: false, error: `Element ${element} (${getLabel(el)}) is disabled.` };

  scrollToElement(el);

  if (action === "click") {
    const willNavigate = el.tagName === "A" && el.href && !el.href.startsWith("javascript:");
    el.focus();
    el.click();
    if (el.type === "checkbox" || el.type === "radio") {
      el.checked = !el.checked;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return { success: true, action: "click", element, label: getLabel(el), navigated: willNavigate };
  }

  if (action === "type") {
    if (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA") {
      return { success: false, error: `Element ${element} (${getLabel(el)}) is not a text field.` };
    }
    el.focus();
    el.dispatchEvent(new Event("focus", { bubbles: true }));
    setNativeValue(el, value);
    el.dispatchEvent(new InputEvent("input", { data: value, bubbles: true, inputType: "insertText" }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return { success: true, action: "type", element, value };
  }

  if (action === "select") {
    if (el.tagName !== "SELECT") return { success: false, error: `Element ${element} is not a dropdown.` };
    const option = Array.from(el.options).find(
      (o) => o.value === value || o.text.toLowerCase() === value.toLowerCase()
    );
    if (!option) return { success: false, error: `Option "${value}" not found in dropdown.` };
    el.value = option.value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return { success: true, action: "select", element, value: option.text };
  }

  if (action === "press_key") {
    el.dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true }));
    el.dispatchEvent(new KeyboardEvent("keyup", { key: value, bubbles: true }));
    return { success: true, action: "press_key", key: value };
  }

  return { success: false, error: `Unknown action: "${action}". Valid: click, type, select, scroll, back, open, read, press_key.` };
}

// --- Fix 6: New page announces itself ---
function announceReady() {
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
    try {
      const elements = listElements();
      chrome.runtime.sendMessage({
        type: "page_ready",
        url: window.location.href,
        title: document.title,
        elements,
        count: elements.length,
      }).catch(() => {});
    } catch (e) {
      // Side panel may not be open yet
    }
  }
}

// --- Message listener (guard against double injection) ---
if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage && !window._voiceAgentLoaded) {
  window._voiceAgentLoaded = true;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "list_elements") {
      const elements = listElements();
      showOverlays();
      sendResponse({ elements, count: elements.length });
      return true;
    }
    if (message.type === "action") {
      const result = doAction(message.action, message.element, message.value);
      const skipRescan = !result.success
        || message.action === "read"
        || message.action === "scroll"
        || message.action === "back"
        || message.action === "open"
        || result.navigated;
      if (skipRescan) {
        sendResponse(result);
      } else {
        setTimeout(() => {
          const updated = listElements();
          showOverlays();
          result.updatedElements = updated.length;
          sendResponse(result);
        }, 300);
      }
      return true;
    }
  });

  announceReady();
}

function resetForTest() {
  elementMap = {};
  nextNum = 1;
  overlayContainer = null;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { isVisible, getLabel, getElementType, listElements, doAction, clearOverlays, showOverlays, setNativeValue, resetForTest, get elementMap() { return elementMap; } };
}
