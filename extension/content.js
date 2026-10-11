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
function cleanText(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

// Text of a <label>, without the text of controls inside it (e.g. every <option> of a wrapped <select>)
function labelText(label) {
  const clone = label.cloneNode(true);
  clone.querySelectorAll("input, select, textarea, button").forEach((c) => c.remove());
  return cleanText(clone.textContent);
}

// Text of the elements named by aria-labelledby / aria-describedby
function textOfIds(ids) {
  if (!ids) return "";
  return cleanText(ids.split(/\s+/).map((id) => {
    const ref = document.getElementById(id);
    return ref ? ref.textContent : "";
  }).join(" "));
}

function getLabel(el) {
  if (el.getAttribute("aria-label")) return el.getAttribute("aria-label");
  const labelledBy = textOfIds(el.getAttribute("aria-labelledby"));
  if (labelledBy) return labelledBy;

  // Native labels: <label for="id"> and <label> wrapping the control
  if (el.labels && el.labels.length) {
    const text = labelText(el.labels[0]);
    if (text) return text;
  }

  if (el.title) return el.title;
  if (el.placeholder) return el.placeholder;
  if (isRichTextBox(el)) {
    // ChatGPT/ProseMirror keep the placeholder on an attribute or an inner <p>
    const ph = el.getAttribute("aria-placeholder") || el.getAttribute("data-placeholder")
      || el.querySelector("[data-placeholder]")?.getAttribute("data-placeholder");
    if (ph) return ph;
    if (!textOf(el).trim()) return "text box";
  }

  const text = cleanText(el.textContent);
  if (text && text.length < 80) return text;

  if (el.tagName === "INPUT") return el.type || "input";
  return el.tagName.toLowerCase();
}

// The question a radio/checkbox answers, e.g. "Are you married?" for a "Yes" option.
// Forms put it on a <fieldset><legend> or an ARIA radiogroup/group label.
function getGroupQuestion(el) {
  if (!isChoice(el)) return "";
  const fieldset = el.closest("fieldset");
  if (fieldset) {
    const legend = fieldset.querySelector("legend");
    if (legend && cleanText(legend.textContent)) return cleanText(legend.textContent);
  }
  const group = el.closest("[role='radiogroup'], [role='group']");
  if (group) {
    const text = group.getAttribute("aria-label") || textOfIds(group.getAttribute("aria-labelledby"));
    if (text) return cleanText(text);
  }
  return "";
}

// --- Element type ---
// Visible text of an element (innerText where supported, e.g. not in jsdom)
function textOf(el) {
  return el.innerText !== undefined ? el.innerText : el.textContent;
}

// Rich text editors (ChatGPT, Gmail, Slack, Notion) are contenteditable divs, not inputs
function isRichTextBox(el) {
  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") return false;
  const ce = el.getAttribute("contenteditable");
  return (ce !== null && ce !== "false") || el.getAttribute("role") === "textbox";
}

// Radio buttons and checkboxes, native or custom-built (role="radio" divs, e.g. Google Forms)
function isChoice(el) {
  if (el.tagName === "INPUT") return el.type === "checkbox" || el.type === "radio";
  const role = el.getAttribute("role");
  return role === "radio" || role === "checkbox" || role === "switch" || role === "option";
}

function isChecked(el) {
  if (el.tagName === "INPUT") return el.checked;
  return el.getAttribute("aria-checked") === "true" || el.getAttribute("aria-selected") === "true";
}

// Styled forms hide the real radio/checkbox and show its <label> instead.
// Returns what the user actually sees for an element — used for visibility,
// scrolling and number tags.
function visibleTarget(el) {
  if (isVisible(el)) return el;
  if (el.tagName === "INPUT" && isChoice(el) && el.labels) {
    for (const label of el.labels) {
      if (isVisible(label)) return label;
    }
  }
  return null;
}

function getElementType(el) {
  const tag = el.tagName;
  if (isRichTextBox(el)) return "field";
  const role = el.getAttribute("role");
  if (role === "radio") return "radio";
  if (role === "checkbox" || role === "switch") return "checkbox";
  if (role === "option") return "option";
  if (role === "combobox" || role === "listbox") return "dropdown";
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

  const selectors = "a, button, input, textarea, select, [role='button'], [role='link'], [tabindex], "
    + "[contenteditable]:not([contenteditable='false']), [role='textbox'], "
    + "[role='radio'], [role='checkbox'], [role='switch'], [role='option'], [role='combobox']";
  const elements = document.querySelectorAll(selectors);

  for (const el of elements) {
    if (!visibleTarget(el)) continue;
    if (el.tagName === "INPUT" && el.type === "hidden") continue;
    if (el.closest("[aria-hidden='true']")) continue;
    // Skip elements inside an editor — only the editor itself is a target
    if (el.parentElement && el.parentElement.closest("[contenteditable]:not([contenteditable='false'])")) continue;

    let num = el.dataset.agentNum ? parseInt(el.dataset.agentNum) : null;
    if (num && oldMap[num] === el) {
      // Element kept its old number
    } else {
      num = nextNum++;
      el.dataset.agentNum = num;
    }

    newMap[num] = el;

    const type = getElementType(el);
    let label = getLabel(el).substring(0, 80);
    const question = getGroupQuestion(el);
    if (question && question !== label) {
      label = `${question.substring(0, 120)} → ${label}`;
    }

    let value = "";
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      value = el.value ? ` [value: "${el.value}"]` : "";
    } else if (isRichTextBox(el)) {
      const text = textOf(el).trim();
      value = text ? ` [value: "${text.substring(0, 60)}"]` : "";
    }
    if (el.tagName === "SELECT") {
      const opts = Array.from(el.options).filter((o) => o.value).map((o) => o.text);
      const sel = el.selectedOptions.length ? el.selectedOptions[0].text : "";
      value = sel ? ` [selected: "${sel}"]` : "";
      if (opts.length > 0 && opts.length <= 20) {
        value += ` options: ${opts.join(", ")}`;
      }
    }
    if (isChoice(el)) {
      value = isChecked(el) ? " [checked]" : " [unchecked]";
    }

    results.push({ num, type, label, value });
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
    const rect = (visibleTarget(el) || el).getBoundingClientRect();
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
    const rect = (visibleTarget(el) || el).getBoundingClientRect();
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
  (visibleTarget(el) || el).scrollIntoView({ behavior: "smooth", block: "center" });
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

// --- Rich text editors (contenteditable) ---
function typeIntoRichText(el, value) {
  el.focus();
  // Select existing content so typing replaces it
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  // insertText goes through the editor's own input handling (ProseMirror,
  // Lexical, Draft.js), so the app's state updates like a real paste.
  let inserted = false;
  try {
    inserted = typeof document.execCommand === "function" && document.execCommand("insertText", false, value);
  } catch (e) {
    inserted = false;
  }
  if (!inserted || !textOf(el).includes(value)) {
    el.textContent = value;
    el.dispatchEvent(new InputEvent("input", { data: value, bubbles: true, inputType: "insertText" }));
  }
  return textOf(el).trim() === value.trim();
}

// Returns true if the page's key handler took the Enter (called preventDefault)
function pressEnter(el) {
  const opts = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true };
  const down = new KeyboardEvent("keydown", opts);
  el.dispatchEvent(down);
  el.dispatchEvent(new KeyboardEvent("keypress", opts));
  el.dispatchEvent(new KeyboardEvent("keyup", opts));
  return down.defaultPrevented;
}

const SEND_BUTTON_SELECTOR = [
  "button[data-testid='send-button']",
  "button[aria-label*='send' i]",
  "button[aria-label*='submit' i]",
  "button[aria-label*='search' i]",
  "button[type='submit']",
].join(", ");

// Find the send/submit button that belongs to a text box (nearest ancestor that has one)
function findSendButton(el) {
  let node = el.parentElement;
  for (let depth = 0; node && depth < 8; depth++, node = node.parentElement) {
    const buttons = node.querySelectorAll(SEND_BUTTON_SELECTOR);
    for (const btn of buttons) {
      if (!btn.disabled && isVisible(btn)) return btn;
    }
  }
  return null;
}

// Custom dropdowns (role="combobox"/"listbox", e.g. Google Forms): open it, then click the matching option
function selectCustomOption(el, element, value) {
  const role = el.getAttribute("role");
  if (role !== "combobox" && role !== "listbox") {
    return { success: false, error: `Element ${element} is not a dropdown.` };
  }
  el.click();
  const lv = cleanText(value).toLowerCase();
  // The option list is usually linked by aria-controls/aria-owns; otherwise search the page
  const listId = el.getAttribute("aria-controls") || el.getAttribute("aria-owns");
  const owned = listId ? document.getElementById(listId.split(/\s+/)[0]) : null;
  const scope = owned || (role === "listbox" ? el : document);
  const options = Array.from(scope.querySelectorAll("[role='option']"));
  const text = (o) => cleanText(o.getAttribute("aria-label") || o.getAttribute("data-value") || o.textContent).toLowerCase();
  const option = options.find((o) => text(o) === lv) || options.find((o) => text(o).includes(lv));
  if (!option) {
    return {
      success: false,
      error: `Opened dropdown ${element} but no option matches "${value}". Call read_page and click the option directly.`,
    };
  }
  option.click();
  return { success: true, action: "select", element, value: cleanText(option.textContent) || value };
}

// --- Page context: headings and error messages ---
// read_page only lists controls; this adds what the page is asking and any
// validation errors, so the agent can see "Enter a valid date" and fix it.
function getPageContext() {
  const seen = new Set();
  const collect = (selector, limit) => {
    const out = [];
    for (const node of document.querySelectorAll(selector)) {
      if (out.length >= limit) break;
      if (node.closest("#voice-agent-overlays")) continue;
      if (!isVisible(node)) continue;
      const text = cleanText(node.textContent).substring(0, 150);
      if (!text || seen.has(text)) continue;
      seen.add(text);
      out.push(text);
    }
    return out;
  };
  const headings = collect("h1, h2, h3, legend, [role='heading']", 6);
  const errors = collect(
    "[role='alert'], [aria-live='assertive'], .error, .error-message, .usa-error-message, .invalid-feedback, [class*='error-message'], [class*='errorMessage']",
    5,
  );
  // Fields marked invalid point at their own error text
  for (const field of document.querySelectorAll("[aria-invalid='true']")) {
    const text = textOfIds(field.getAttribute("aria-describedby") || field.getAttribute("aria-errormessage"));
    if (text && !seen.has(text) && errors.length < 5) {
      seen.add(text);
      errors.push(`${getLabel(field)}: ${text}`.substring(0, 150));
    }
  }
  return { headings, errors };
}

// --- Fix 2: Every action reports back clearly ---
function doAction(action, element, value, submit = false) {
  if (action === "scroll") {
    const dir = value || "down";
    const amount = dir === "up" ? -400 : 400;
    window.scrollBy({ top: amount, behavior: "smooth" });
    return { success: true, action: "scroll", direction: dir };
  }

  if (action === "back") {
    window.history.back();
    return { success: true, action: "back", navigated: true };
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

  if (!visibleTarget(el)) return { success: false, error: `Element ${element} is no longer visible on the page.` };

  if (el.disabled) return { success: false, error: `Element ${element} (${getLabel(el)}) is disabled.` };

  scrollToElement(el);

  if (action === "click") {
    const willNavigate = linkWillNavigate(el);
    el.focus();
    el.click();
    if (el.type === "checkbox" || el.type === "radio") {
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
    const result = { success: true, action: "click", element, label: getLabel(el), navigated: willNavigate };
    if (isChoice(el)) result.checked = isChecked(el);
    return result;
  }

  if (action === "type") {
    if (isRichTextBox(el)) {
      const verified = typeIntoRichText(el, value);
      const result = { success: true, action: "type", element, value, verified };
      if (submit) {
        pressEnter(el);
        result.submitted = true;
      }
      return result;
    }
    if (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA") {
      return { success: false, error: `Element ${element} (${getLabel(el)}) is not a text field.` };
    }
    el.focus();
    el.dispatchEvent(new Event("focus", { bubbles: true }));
    setNativeValue(el, value);
    el.dispatchEvent(new InputEvent("input", { data: value, bubbles: true, inputType: "insertText" }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    const verified = el.value === value;
    const result = { success: true, action: "type", element, value, verified };
    if (submit) {
      const handled = pressEnter(el);
      // Code-generated Enter doesn't submit forms on its own, so submit the form
      // unless the page's own key handler already took care of it.
      if (!handled && el.form && el.tagName === "INPUT") {
        if (el.form.requestSubmit) el.form.requestSubmit();
        else el.form.submit();
        result.navigated = true;
      }
      result.submitted = true;
    }
    return result;
  }

  if (action === "select") {
    if (el.tagName !== "SELECT") return selectCustomOption(el, element, value);
    const lv = value.toLowerCase();
    const opts = Array.from(el.options);
    const option =
      opts.find((o) => o.value === value || o.text.toLowerCase() === lv) ||
      opts.find((o) => o.text.toLowerCase().includes(lv)) ||
      opts.find((o) => lv.includes(o.text.toLowerCase()) && o.text.length > 1);
    if (!option) {
      const available = opts.filter((o) => o.value).map((o) => o.text).join(", ");
      return { success: false, error: `Option "${value}" not found in dropdown. Available: ${available}` };
    }
    el.value = option.value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    const verified = el.value === option.value;
    return { success: true, action: "select", element, value: option.text, verified };
  }

  if (action === "press_key") {
    el.dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true }));
    el.dispatchEvent(new KeyboardEvent("keyup", { key: value, bubbles: true }));
    return { success: true, action: "press_key", key: value };
  }

  return { success: false, error: `Unknown action: "${action}". Valid: click, type, select, scroll, back, open, read, press_key.` };
}

// --- Waiting for the page to settle ---
// After a click or typing, pages update in place (next question, error message,
// suggestions). Wait until the DOM has been quiet for quietMs (max maxMs) before
// replying, so the agent never reads the page mid-update.
function isOverlayMutation(m) {
  const t = m.target;
  return t.id === "voice-agent-overlays" || (t.closest && t.closest("#voice-agent-overlays"));
}

function waitForSettle({ quietMs = 400, maxMs = 3000 } = {}) {
  return new Promise((resolve) => {
    const start = Date.now();
    let changed = false;
    let quietTimer = null;
    let maxTimer = null;
    let observer = null;
    const done = () => {
      if (observer) observer.disconnect();
      clearTimeout(quietTimer);
      clearTimeout(maxTimer);
      resolve({ changed, ms: Date.now() - start });
    };
    if (typeof MutationObserver === "undefined") {
      setTimeout(done, quietMs);
      return;
    }
    observer = new MutationObserver((mutations) => {
      if (mutations.every(isOverlayMutation)) return;
      changed = true;
      clearTimeout(quietTimer);
      quietTimer = setTimeout(done, quietMs);
    });
    // style is left out on purpose: animations change it constantly
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "hidden", "aria-hidden", "aria-expanded", "aria-checked", "aria-selected", "aria-invalid", "disabled", "value"],
    });
    quietTimer = setTimeout(done, quietMs);
    maxTimer = setTimeout(done, maxMs);
  });
}

// Would clicking this link load a different page? (Not for #anchors on this page.)
function linkWillNavigate(el) {
  if (el.tagName !== "A" || !el.href || el.href.startsWith("javascript:") || el.hasAttribute("download")) return false;
  try {
    const url = new URL(el.href, location.href);
    const here = new URL(location.href);
    const samePage = url.origin === here.origin && url.pathname === here.pathname && url.search === here.search;
    return !(samePage && url.hash);
  } catch (e) {
    return true;
  }
}

function sendToExtension(message) {
  if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) return;
  try {
    chrome.runtime.sendMessage(message).catch(() => {});
  } catch (e) {
    // Extension was reloaded or the side panel isn't open — nothing to tell
  }
}

// --- Fix 6: New page announces itself ---
function announceReady() {
  // Background tabs loading must not look like "the page you're on changed"
  if (document.visibilityState === "hidden") return;
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
      sendResponse({ elements, count: elements.length, title: document.title, url: location.href, context: getPageContext() });
      return true;
    }
    if (message.type === "action") {
      const result = doAction(message.action, message.element, message.value, message.submit);
      const el = elementMap[message.element];
      if (result.submitted && el && isRichTextBox(el)) {
        // Chat apps send on Enter. If the text is still sitting in the box
        // shortly after, Enter was ignored, so click the Send button instead.
        setTimeout(() => {
          if (el.isConnected && textOf(el).trim() && textOf(el).includes(message.value)) {
            const btn = findSendButton(el);
            if (btn) {
              btn.click();
              result.sentWith = "send button";
            } else {
              result.warning = "Text typed but could not find a Send button. Use read_page to find it.";
            }
          }
          const updated = listElements();
          showOverlays();
          result.updatedElements = updated.length;
          sendResponse(result);
        }, 400);
        return true;
      }
      const skipRescan = !result.success
        || message.action === "read"
        || message.action === "scroll"
        || message.action === "back"
        || message.action === "open"
        || result.navigated;
      if (skipRescan) {
        sendResponse(result);
      } else {
        waitForSettle().then(({ changed, ms }) => {
          const updated = listElements();
          showOverlays();
          result.updatedElements = updated.length;
          result.changed = changed;
          result.settleMs = ms;
          sendResponse(result);
        });
      }
      return true;
    }
  });

  announceReady();

  // Single-page apps (YouTube, Gmail, React sites) change the address without
  // loading a new page, so this script never re-runs. Watch the address and
  // announce the "new page" once it has settled.
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    if (document.visibilityState === "hidden") return;
    sendToExtension({ type: "page_loading", url: location.href });
    waitForSettle({ quietMs: 500, maxMs: 4000 }).then(announceReady);
  }, 400);

  // Switching to this tab makes it "the page you're on"
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") announceReady();
  });
}

function resetForTest() {
  elementMap = {};
  nextNum = 1;
  overlayContainer = null;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { waitForSettle, linkWillNavigate, isVisible, getLabel, getGroupQuestion, getPageContext, isChoice, visibleTarget, getElementType, listElements, doAction, isRichTextBox, typeIntoRichText, pressEnter, findSendButton, clearOverlays, showOverlays, setNativeValue, resetForTest, get elementMap() { return elementMap; } };
}
