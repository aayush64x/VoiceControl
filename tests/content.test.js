/**
 * @jest-environment jsdom
 */

const content = require("../extension/content");
const { isVisible, getLabel, getElementType, listElements, doAction, setNativeValue, resetForTest } = content;

function makeVisible(el) {
  Object.defineProperty(el, "offsetParent", { get: () => document.body, configurable: true });
  el.getBoundingClientRect = () => ({ width: 100, height: 30, left: 0, top: 0, right: 100, bottom: 30 });
  el.scrollIntoView = jest.fn();
}

window.scrollBy = jest.fn();

beforeEach(() => {
  document.body.innerHTML = "";
  resetForTest();
});

describe("isVisible", () => {
  test("visible button returns true", () => {
    const btn = document.createElement("button");
    btn.textContent = "Click me";
    document.body.appendChild(btn);
    makeVisible(btn);
    expect(isVisible(btn)).toBe(true);
  });

  test("hidden input returns false", () => {
    const input = document.createElement("input");
    input.type = "hidden";
    document.body.appendChild(input);
    expect(isVisible(input)).toBe(false);
  });

  test("display:none element returns false", () => {
    const div = document.createElement("div");
    div.style.display = "none";
    document.body.appendChild(div);
    expect(isVisible(div)).toBe(false);
  });

  test("zero-size element returns false", () => {
    const btn = document.createElement("button");
    document.body.appendChild(btn);
    Object.defineProperty(btn, "offsetParent", { get: () => document.body, configurable: true });
    btn.getBoundingClientRect = () => ({ width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0 });
    expect(isVisible(btn)).toBe(false);
  });
});

describe("getLabel", () => {
  test("uses aria-label first", () => {
    const btn = document.createElement("button");
    btn.setAttribute("aria-label", "Submit form");
    btn.textContent = "Go";
    expect(getLabel(btn)).toBe("Submit form");
  });

  test("uses title when no aria-label", () => {
    const a = document.createElement("a");
    a.title = "Home page";
    a.textContent = "Some very long text that we don't want";
    expect(getLabel(a)).toBe("Home page");
  });

  test("uses placeholder for inputs", () => {
    const input = document.createElement("input");
    input.placeholder = "Enter email";
    expect(getLabel(input)).toBe("Enter email");
  });

  test("uses associated label element", () => {
    const label = document.createElement("label");
    label.setAttribute("for", "name-field");
    label.textContent = "Full Name";
    document.body.appendChild(label);

    const input = document.createElement("input");
    input.id = "name-field";
    document.body.appendChild(input);

    expect(getLabel(input)).toBe("Full Name");
  });

  test("uses text content for short text", () => {
    const btn = document.createElement("button");
    btn.textContent = "Next";
    expect(getLabel(btn)).toBe("Next");
  });

  test("falls back to input type", () => {
    const input = document.createElement("input");
    input.type = "email";
    expect(getLabel(input)).toBe("email");
  });

  test("falls back to tag name", () => {
    const el = document.createElement("textarea");
    expect(getLabel(el)).toBe("textarea");
  });
});

describe("getElementType", () => {
  test("anchor is link", () => {
    const a = document.createElement("a");
    expect(getElementType(a)).toBe("link");
  });

  test("button element is button", () => {
    const btn = document.createElement("button");
    expect(getElementType(btn)).toBe("button");
  });

  test("submit input is button", () => {
    const input = document.createElement("input");
    input.type = "submit";
    expect(getElementType(input)).toBe("button");
  });

  test("text input is field", () => {
    const input = document.createElement("input");
    input.type = "text";
    expect(getElementType(input)).toBe("field");
  });

  test("checkbox input is checkbox", () => {
    const input = document.createElement("input");
    input.type = "checkbox";
    expect(getElementType(input)).toBe("checkbox");
  });

  test("radio input is radio", () => {
    const input = document.createElement("input");
    input.type = "radio";
    expect(getElementType(input)).toBe("radio");
  });

  test("textarea is field", () => {
    const el = document.createElement("textarea");
    expect(getElementType(el)).toBe("field");
  });

  test("select is dropdown", () => {
    const el = document.createElement("select");
    expect(getElementType(el)).toBe("dropdown");
  });

  test("role=button is button", () => {
    const div = document.createElement("div");
    div.setAttribute("role", "button");
    expect(getElementType(div)).toBe("button");
  });

  test("role=link is link", () => {
    const span = document.createElement("span");
    span.setAttribute("role", "link");
    expect(getElementType(span)).toBe("link");
  });
});

describe("listElements", () => {
  test("finds and numbers visible interactive elements", () => {
    document.body.innerHTML = `
      <a href="/home">Home</a>
      <button>Submit</button>
      <input type="text" placeholder="Name">
      <select><option>Option A</option></select>
    `;
    document.querySelectorAll("a, button, input, select").forEach(makeVisible);

    const results = listElements();
    expect(results.length).toBe(4);
    expect(results[0].type).toBe("link");
    expect(results[0].label).toBe("Home");
    expect(results[1].type).toBe("button");
    expect(results[2].type).toBe("field");
    expect(results[3].type).toBe("dropdown");
  });

  test("skips hidden inputs", () => {
    document.body.innerHTML = `
      <input type="hidden" name="csrf">
      <input type="text" placeholder="Visible">
    `;
    document.querySelectorAll("input[type=text]").forEach(makeVisible);

    const results = listElements();
    expect(results.length).toBe(1);
    expect(results[0].label).toBe("Visible");
  });

  test("skips aria-hidden elements", () => {
    document.body.innerHTML = `
      <div aria-hidden="true"><button>Hidden</button></div>
      <button>Visible</button>
    `;
    document.querySelectorAll("button").forEach(makeVisible);

    const results = listElements();
    expect(results.length).toBe(1);
    expect(results[0].label).toBe("Visible");
  });

  test("captures input values", () => {
    document.body.innerHTML = `<input type="text" placeholder="Email" value="test@test.com">`;
    document.querySelectorAll("input").forEach(makeVisible);

    const results = listElements();
    expect(results[0].value).toBe(' [value: "test@test.com"]');
  });

  test("captures checkbox state", () => {
    document.body.innerHTML = `
      <input type="checkbox" id="c1">
      <input type="checkbox" id="c2" checked>
    `;
    document.querySelectorAll("input").forEach(makeVisible);

    const results = listElements();
    expect(results[0].value).toBe(" [unchecked]");
    expect(results[1].value).toBe(" [checked]");
  });

  test("captures select value", () => {
    document.body.innerHTML = `<select><option>Morning</option><option selected>Afternoon</option></select>`;
    document.querySelectorAll("select").forEach(makeVisible);

    const results = listElements();
    expect(results[0].value).toContain('[selected: "Afternoon"]');
    expect(results[0].value).toContain("Morning");
    expect(results[0].value).toContain("Afternoon");
  });

  test("numbers are sequential starting at 1", () => {
    document.body.innerHTML = `
      <button>A</button>
      <button>B</button>
      <button>C</button>
    `;
    document.querySelectorAll("button").forEach(makeVisible);

    const results = listElements();
    expect(results.map((r) => r.num)).toEqual([1, 2, 3]);
  });

  test("skips long text content and falls back to tag name", () => {
    const longText = "A".repeat(100);
    document.body.innerHTML = `<button>${longText}</button>`;
    document.querySelectorAll("button").forEach(makeVisible);

    const results = listElements();
    expect(results[0].label).toBe("button");
  });

  test("truncates label at 60 chars via substring", () => {
    const text = "B".repeat(70);
    document.body.innerHTML = `<button aria-label="${text}">Click</button>`;
    document.querySelectorAll("button").forEach(makeVisible);

    const results = listElements();
    expect(results[0].label.length).toBe(60);
  });
});

describe("doAction", () => {
  test("scroll down returns success", () => {
    const result = doAction("scroll", null, "down");
    expect(result.success).toBe(true);
    expect(result.direction).toBe("down");
  });

  test("scroll up returns success", () => {
    const result = doAction("scroll", null, "up");
    expect(result.success).toBe(true);
    expect(result.direction).toBe("up");
  });

  test("back returns success", () => {
    const result = doAction("back");
    expect(result.success).toBe(true);
    expect(result.action).toBe("back");
  });

  test("open returns success", () => {
    const result = doAction("open", null, "https://weather.gov");
    expect(result.success).toBe(true);
    expect(result.url).toBe("https://weather.gov");
  });

  test("click on missing element returns error", () => {
    const result = doAction("click", 999);
    expect(result.success).toBe(false);
    expect(result.error).toContain("999");
  });

  test("click on existing element returns success", () => {
    document.body.innerHTML = '<button>Go</button>';
    document.querySelectorAll("button").forEach(makeVisible);
    const results = listElements();

    const result = doAction("click", results[0].num);
    expect(result.success).toBe(true);
    expect(result.action).toBe("click");
  });

  test("type into a field sets value", () => {
    document.body.innerHTML = '<input type="text" placeholder="Name">';
    document.querySelectorAll("input").forEach(makeVisible);
    const results = listElements();

    const result = doAction("type", results[0].num, "Jordan");
    expect(result.success).toBe(true);
    const input = document.querySelector("input");
    expect(input.value).toBe("Jordan");
  });

  test("select on non-dropdown returns error", () => {
    document.body.innerHTML = '<button>Click</button>';
    document.querySelectorAll("button").forEach(makeVisible);
    const results = listElements();

    const result = doAction("select", results[0].num, "something");
    expect(result.success).toBe(false);
    expect(result.error).toContain("not a dropdown");
  });

  test("select sets dropdown value", () => {
    document.body.innerHTML = '<select><option value="am">Morning</option><option value="pm">Afternoon</option></select>';
    document.querySelectorAll("select").forEach(makeVisible);
    const results = listElements();

    const result = doAction("select", results[0].num, "Afternoon");
    expect(result.success).toBe(true);
    expect(document.querySelector("select").value).toBe("pm");
  });

  test("unknown action on element lists valid actions", () => {
    document.body.innerHTML = '<button>Go</button>';
    document.querySelectorAll("button").forEach(makeVisible);
    const results = listElements();

    const result = doAction("fly", results[0].num);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Valid:");
  });

  test("read returns elements", () => {
    document.body.innerHTML = '<button>A</button><button>B</button>';
    document.querySelectorAll("button").forEach(makeVisible);

    const result = doAction("read");
    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
  });

  test("returns error for disabled element", () => {
    document.body.innerHTML = '<button disabled>Nope</button>';
    document.querySelectorAll("button").forEach(makeVisible);
    const results = listElements();

    const result = doAction("click", results[0].num);
    expect(result.success).toBe(false);
    expect(result.error).toContain("disabled");
  });

  test("returns error when typing into non-field", () => {
    document.body.innerHTML = '<button>Go</button>';
    document.querySelectorAll("button").forEach(makeVisible);
    const results = listElements();

    const result = doAction("type", results[0].num, "hello");
    expect(result.success).toBe(false);
    expect(result.error).toContain("not a text field");
  });

  test("returns error with no element number", () => {
    const result = doAction("click", null);
    expect(result.success).toBe(false);
    expect(result.error).toContain("No element number");
  });

  test("open without URL returns error", () => {
    const result = doAction("open", null, null);
    expect(result.success).toBe(false);
    expect(result.error).toContain("No URL");
  });

  test("click checkbox toggles it on", () => {
    document.body.innerHTML = '<input type="checkbox" id="cb">';
    const cb = document.getElementById("cb");
    makeVisible(cb);
    listElements();
    const num = cb.dataset.agentNum;
    expect(cb.checked).toBe(false);

    const result = doAction("click", parseInt(num), null);
    expect(result.success).toBe(true);
    expect(cb.checked).toBe(true);
  });

  test("click checkbox twice toggles it off again", () => {
    document.body.innerHTML = '<input type="checkbox" id="cb">';
    const cb = document.getElementById("cb");
    makeVisible(cb);
    listElements();
    const num = parseInt(cb.dataset.agentNum);

    doAction("click", num, null);
    expect(cb.checked).toBe(true);
    doAction("click", num, null);
    expect(cb.checked).toBe(false);
  });

  test("click radio button selects it", () => {
    document.body.innerHTML = `
      <input type="radio" name="g" id="r1" value="a">
      <input type="radio" name="g" id="r2" value="b">
    `;
    const r1 = document.getElementById("r1");
    const r2 = document.getElementById("r2");
    makeVisible(r1);
    makeVisible(r2);
    listElements();

    doAction("click", parseInt(r1.dataset.agentNum), null);
    expect(r1.checked).toBe(true);

    doAction("click", parseInt(r2.dataset.agentNum), null);
    expect(r2.checked).toBe(true);
  });
});

describe("stable numbers (fix 1)", () => {
  test("elements keep their numbers across re-scans", () => {
    document.body.innerHTML = '<button>A</button><button>B</button>';
    document.querySelectorAll("button").forEach(makeVisible);

    const first = listElements();
    const numA = first.find((e) => e.label === "A").num;
    const numB = first.find((e) => e.label === "B").num;

    const second = listElements();
    expect(second.find((e) => e.label === "A").num).toBe(numA);
    expect(second.find((e) => e.label === "B").num).toBe(numB);
  });

  test("new elements get new numbers, not reused ones", () => {
    document.body.innerHTML = '<button>A</button>';
    document.querySelectorAll("button").forEach(makeVisible);
    const first = listElements();
    const numA = first[0].num;

    document.body.innerHTML = '<button>A</button><button>C</button>';
    document.querySelectorAll("button").forEach(makeVisible);
    const second = listElements();

    const numC = second.find((e) => e.label === "C").num;
    expect(numC).toBeGreaterThan(numA);
    expect(numC).not.toBe(numA);
  });
});

describe("dropdown fuzzy matching", () => {
  test("partial match selects containing option", () => {
    document.body.innerHTML = '<select><option value="">Choose</option><option value="tp">City of Topeka, KS</option><option value="lw">City of Lawrence, KS</option></select>';
    document.querySelectorAll("select").forEach(makeVisible);
    const results = listElements();

    const result = doAction("select", results[0].num, "Topeka");
    expect(result.success).toBe(true);
    expect(document.querySelector("select").value).toBe("tp");
  });

  test("exact match takes priority over partial", () => {
    document.body.innerHTML = '<select><option value="a">Morning</option><option value="b">Good Morning</option></select>';
    document.querySelectorAll("select").forEach(makeVisible);
    const results = listElements();

    const result = doAction("select", results[0].num, "Morning");
    expect(result.success).toBe(true);
    expect(document.querySelector("select").value).toBe("a");
  });

  test("case insensitive partial match", () => {
    document.body.innerHTML = '<select><option value="mo">MO - Missouri</option><option value="ks">KS - Kansas</option></select>';
    document.querySelectorAll("select").forEach(makeVisible);
    const results = listElements();

    const result = doAction("select", results[0].num, "missouri");
    expect(result.success).toBe(true);
    expect(document.querySelector("select").value).toBe("mo");
  });

  test("no match still returns available options", () => {
    document.body.innerHTML = '<select><option value="a">Alpha</option><option value="b">Beta</option></select>';
    document.querySelectorAll("select").forEach(makeVisible);
    const results = listElements();

    const result = doAction("select", results[0].num, "Narnia");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Alpha");
    expect(result.error).toContain("Beta");
  });
});

describe("dropdown options in listElements", () => {
  test("shows options for small dropdowns", () => {
    document.body.innerHTML = '<select><option value="">Choose</option><option value="a">Red</option><option value="b">Blue</option></select>';
    document.querySelectorAll("select").forEach(makeVisible);
    const results = listElements();

    expect(results[0].value).toContain("Red");
    expect(results[0].value).toContain("Blue");
  });
});

describe("setNativeValue (fix 4)", () => {
  test("sets value on input", () => {
    const input = document.createElement("input");
    input.type = "text";
    setNativeValue(input, "hello");
    expect(input.value).toBe("hello");
  });

  test("sets value on textarea", () => {
    const ta = document.createElement("textarea");
    setNativeValue(ta, "world");
    expect(ta.value).toBe("world");
  });
});

describe("rich text boxes (ChatGPT-style contenteditable)", () => {
  const { isRichTextBox, typeIntoRichText, pressEnter, findSendButton } = content;

  function makeEditor(placeholder) {
    const form = document.createElement("form");
    const editor = document.createElement("div");
    editor.setAttribute("contenteditable", "true");
    editor.id = "prompt-textarea";
    if (placeholder) {
      const p = document.createElement("p");
      p.setAttribute("data-placeholder", placeholder);
      editor.appendChild(p);
    }
    const send = document.createElement("button");
    send.setAttribute("aria-label", "Send prompt");
    send.type = "button";
    form.append(editor, send);
    document.body.appendChild(form);
    makeVisible(editor);
    makeVisible(send);
    return { form, editor, send };
  }

  test("contenteditable and role=textbox are rich text boxes; inputs are not", () => {
    const { editor } = makeEditor();
    const tb = document.createElement("div");
    tb.setAttribute("role", "textbox");
    const off = document.createElement("div");
    off.setAttribute("contenteditable", "false");
    expect(isRichTextBox(editor)).toBe(true);
    expect(isRichTextBox(tb)).toBe(true);
    expect(isRichTextBox(off)).toBe(false);
    expect(isRichTextBox(document.createElement("input"))).toBe(false);
  });

  test("listed as a field with its placeholder label", () => {
    makeEditor("Ask anything");
    const elements = listElements();
    const field = elements.find((e) => e.type === "field");
    expect(field).toBeDefined();
    expect(field.label).toBe("Ask anything");
  });

  test("children inside the editor are not listed separately", () => {
    const { editor } = makeEditor();
    const link = document.createElement("a");
    link.href = "https://example.com";
    link.textContent = "inner link";
    editor.appendChild(link);
    makeVisible(link);
    const types = listElements().map((e) => e.type);
    // Just the editor and the Send button — not the link inside the editor
    expect(types.sort()).toEqual(["button", "field"]);
  });

  test("contenteditable=false is not listed as a field", () => {
    const off = document.createElement("div");
    off.setAttribute("contenteditable", "false");
    off.textContent = "read only";
    document.body.appendChild(off);
    makeVisible(off);
    expect(listElements().map((e) => e.label)).not.toContain("read only");
  });

  test("typeIntoRichText replaces content and fires input", () => {
    const { editor } = makeEditor();
    editor.textContent = "old text";
    const onInput = jest.fn();
    editor.addEventListener("input", onInput);
    expect(typeIntoRichText(editor, "what is the biggest animal")).toBe(true);
    expect(editor.textContent).toBe("what is the biggest animal");
    expect(onInput).toHaveBeenCalled();
  });

  test("doAction type works on a rich text box", () => {
    makeEditor();
    const num = listElements().find((e) => e.type === "field").num;
    const result = doAction("type", num, "hello");
    expect(result.success).toBe(true);
    expect(result.verified).toBe(true);
  });

  test("doAction type with submit presses Enter in the editor", () => {
    const { editor } = makeEditor();
    const keys = [];
    editor.addEventListener("keydown", (e) => keys.push(e.key));
    const num = listElements().find((e) => e.type === "field").num;
    const result = doAction("type", num, "hello", true);
    expect(result.submitted).toBe(true);
    expect(keys).toEqual(["Enter"]);
  });

  test("pressEnter reports whether the page handled it", () => {
    const { editor } = makeEditor();
    expect(pressEnter(editor)).toBe(false);
    editor.addEventListener("keydown", (e) => e.preventDefault());
    expect(pressEnter(editor)).toBe(true);
  });

  test("findSendButton finds the nearby Send button, skipping disabled ones", () => {
    const { editor, send } = makeEditor();
    expect(findSendButton(editor)).toBe(send);
    send.disabled = true;
    expect(findSendButton(editor)).toBe(null);
  });
});

describe("type with submit on normal inputs", () => {
  test("submits the input's form when the page doesn't handle Enter", () => {
    const form = document.createElement("form");
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Search";
    form.appendChild(input);
    document.body.appendChild(form);
    makeVisible(input);
    form.requestSubmit = jest.fn();
    const num = listElements().find((e) => e.label === "Search").num;
    const result = doAction("type", num, "cat videos", true);
    expect(input.value).toBe("cat videos");
    expect(form.requestSubmit).toHaveBeenCalled();
    expect(result.navigated).toBe(true);
  });

  test("does not double-submit when the page's own Enter handler took it", () => {
    const form = document.createElement("form");
    const input = document.createElement("input");
    input.placeholder = "Search";
    form.appendChild(input);
    document.body.appendChild(form);
    makeVisible(input);
    input.addEventListener("keydown", (e) => e.preventDefault());
    form.requestSubmit = jest.fn();
    const num = listElements().find((e) => e.label === "Search").num;
    doAction("type", num, "cat videos", true);
    expect(form.requestSubmit).not.toHaveBeenCalled();
  });

  test("type without submit does not submit", () => {
    const form = document.createElement("form");
    const input = document.createElement("input");
    input.placeholder = "Name";
    form.appendChild(input);
    document.body.appendChild(form);
    makeVisible(input);
    form.requestSubmit = jest.fn();
    const num = listElements().find((e) => e.label === "Name").num;
    const result = doAction("type", num, "Jordan");
    expect(form.requestSubmit).not.toHaveBeenCalled();
    expect(result.submitted).toBeUndefined();
  });
});
