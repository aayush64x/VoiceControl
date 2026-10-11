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

  test("truncates label at 80 chars via substring", () => {
    const text = "B".repeat(100);
    document.body.innerHTML = `<button aria-label="${text}">Click</button>`;
    document.querySelectorAll("button").forEach(makeVisible);

    const results = listElements();
    expect(results[0].label.length).toBe(80);
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

describe("real-world forms", () => {
  const { getGroupQuestion, getPageContext } = content;
  const visibleAll = () => document.querySelectorAll("*").forEach(makeVisible);

  test("radio options include their fieldset question", () => {
    document.body.innerHTML = `
      <fieldset><legend>Are you married?</legend>
        <input type="radio" id="y" name="m"><label for="y">Yes</label>
        <input type="radio" id="n" name="m"><label for="n">No</label>
      </fieldset>`;
    visibleAll();
    const labels = listElements().map((e) => e.label);
    expect(labels).toEqual(["Are you married? → Yes", "Are you married? → No"]);
  });

  test("radio options include an ARIA radiogroup question", () => {
    document.body.innerHTML = `
      <h3 id="q">Have you ever worked and paid Social Security taxes?</h3>
      <div role="radiogroup" aria-labelledby="q">
        <div role="radio" aria-checked="true" aria-label="Yes" tabindex="0"></div>
        <div role="radio" aria-checked="false" aria-label="No" tabindex="-1"></div>
      </div>`;
    visibleAll();
    const radios = listElements().filter((e) => e.type === "radio");
    expect(radios).toHaveLength(2);
    expect(radios[0].label).toBe("Have you ever worked and paid Social Security taxes? → Yes");
    expect(radios[0].value).toBe(" [checked]");
    expect(radios[1].value).toBe(" [unchecked]");
  });

  test("getGroupQuestion is empty for non-choice fields", () => {
    document.body.innerHTML = `<fieldset><legend>Name</legend><input type="text" id="t"></fieldset>`;
    expect(getGroupQuestion(document.getElementById("t"))).toBe("");
  });

  test("wrapping <label> is used as the label", () => {
    document.body.innerHTML = `<label>First name <input type="text"></label>`;
    visibleAll();
    expect(listElements()[0].label).toBe("First name");
  });

  test("wrapping label around a select does not include option text", () => {
    document.body.innerHTML = `<label>State <select><option value="MO">Missouri</option><option value="KS">Kansas</option></select></label>`;
    visibleAll();
    expect(listElements()[0].label).toBe("State");
  });

  test("aria-labelledby is used as the label", () => {
    document.body.innerHTML = `<span id="dob">Date of birth (month)</span><input type="text" aria-labelledby="dob">`;
    visibleAll();
    const field = listElements().find((e) => e.type === "field");
    expect(field.label).toBe("Date of birth (month)");
  });

  test("label beats placeholder", () => {
    document.body.innerHTML = `<label for="e">Email address</label><input id="e" placeholder="you@example.com">`;
    visibleAll();
    expect(listElements().find((e) => e.type === "field").label).toBe("Email address");
  });

  test("visually hidden radio with a visible label is still listed and clickable", () => {
    document.body.innerHTML = `
      <fieldset><legend>Do you have permanent kidney failure?</legend>
        <input type="radio" id="k1" name="k" class="sr-only"><label for="k1">Yes</label>
        <input type="radio" id="k2" name="k" class="sr-only"><label for="k2">No</label>
      </fieldset>`;
    // Only the labels are visible — the real inputs are hidden (no offsetParent)
    document.querySelectorAll("label, legend, fieldset").forEach(makeVisible);
    const radios = listElements().filter((e) => e.type === "radio");
    expect(radios.map((r) => r.label)).toEqual([
      "Do you have permanent kidney failure? → Yes",
      "Do you have permanent kidney failure? → No",
    ]);
    const result = doAction("click", radios[1].num);
    expect(result.success).toBe(true);
    expect(result.checked).toBe(true);
    expect(document.getElementById("k2").checked).toBe(true);
  });

  test("hidden radio without a visible label is not listed", () => {
    document.body.innerHTML = `<input type="radio" id="x"><label for="x">Ghost</label>`;
    expect(listElements()).toHaveLength(0);
  });

  test("custom role=checkbox reports checked state", () => {
    document.body.innerHTML = `<div role="checkbox" aria-checked="true" aria-label="I agree"></div>`;
    visibleAll();
    const el = listElements()[0];
    expect(el.type).toBe("checkbox");
    expect(el.value).toBe(" [checked]");
  });

  test("select on a custom combobox clicks the matching option", () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Preferred time" aria-controls="list" tabindex="0">Choose</div>
      <div id="list" role="listbox">
        <div role="option">Morning</div><div role="option">Afternoon</div>
      </div>`;
    visibleAll();
    const opened = jest.fn();
    const combo = document.querySelector("[role='combobox']");
    combo.addEventListener("click", opened);
    const picked = jest.fn();
    document.querySelectorAll("[role='option']")[1].addEventListener("click", picked);
    const num = listElements().find((e) => e.type === "dropdown").num;
    const result = doAction("select", num, "afternoon");
    expect(result.success).toBe(true);
    expect(result.value).toBe("Afternoon");
    expect(opened).toHaveBeenCalled();
    expect(picked).toHaveBeenCalled();
  });

  test("select on a custom combobox with no match tells the agent what to do", () => {
    document.body.innerHTML = `<div role="combobox" aria-label="Time" tabindex="0"></div><div role="option">Morning</div>`;
    visibleAll();
    const num = listElements().find((e) => e.type === "dropdown").num;
    const result = doAction("select", num, "midnight");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/read_page/);
  });

  test("getPageContext returns headings and error messages", () => {
    document.body.innerHTML = `
      <h1>Check eligibility</h1>
      <legend>Enter your date of birth.</legend>
      <div role="alert">Enter a valid year.</div>
      <span id="err">Month must be 1 to 12</span>
      <input aria-label="Month" aria-invalid="true" aria-describedby="err">`;
    visibleAll();
    const ctx = getPageContext();
    expect(ctx.headings).toEqual(["Check eligibility", "Enter your date of birth."]);
    expect(ctx.errors).toEqual(["Enter a valid year.", "Month: Month must be 1 to 12"]);
  });

  test("getPageContext ignores hidden errors", () => {
    document.body.innerHTML = `<div role="alert">Hidden problem</div>`;
    expect(getPageContext().errors).toEqual([]);
  });
});

describe("waiting for the page (navigation and in-place updates)", () => {
  const { waitForSettle, linkWillNavigate } = content;

  test("waitForSettle resolves after the page goes quiet and reports a change", async () => {
    setTimeout(() => document.body.appendChild(document.createElement("p")), 20);
    const { changed, ms } = await waitForSettle({ quietMs: 80, maxMs: 1000 });
    expect(changed).toBe(true);
    expect(ms).toBeGreaterThanOrEqual(80);
    expect(ms).toBeLessThan(1000);
  });

  test("waitForSettle reports no change when nothing happens", async () => {
    const { changed } = await waitForSettle({ quietMs: 50, maxMs: 500 });
    expect(changed).toBe(false);
  });

  test("waitForSettle gives up at maxMs on a page that never stops changing", async () => {
    const timer = setInterval(() => document.body.appendChild(document.createElement("span")), 10);
    const { changed, ms } = await waitForSettle({ quietMs: 100, maxMs: 300 });
    clearInterval(timer);
    expect(changed).toBe(true);
    expect(ms).toBeGreaterThanOrEqual(290);
    expect(ms).toBeLessThan(600);
  });

  test("waitForSettle ignores our own number tags", async () => {
    content.showOverlays(); // creates the overlay container
    setTimeout(() => {
      document.getElementById("voice-agent-overlays").appendChild(document.createElement("div"));
    }, 10);
    const { changed } = await waitForSettle({ quietMs: 60, maxMs: 500 });
    expect(changed).toBe(false);
  });

  test("linkWillNavigate: real links yes; same-page anchors, javascript: and downloads no", () => {
    const link = (href, attrs = {}) => {
      const a = document.createElement("a");
      a.href = href;
      for (const [k, v] of Object.entries(attrs)) a.setAttribute(k, v);
      return a;
    };
    expect(linkWillNavigate(link("https://example.com/other"))).toBe(true);
    expect(linkWillNavigate(link("/next-page"))).toBe(true);
    expect(linkWillNavigate(link(location.href.split("#")[0] + "#section"))).toBe(false);
    expect(linkWillNavigate(link("javascript:void(0)"))).toBe(false);
    expect(linkWillNavigate(link("/file.pdf", { download: "" }))).toBe(false);
    expect(linkWillNavigate(document.createElement("button"))).toBe(false);
  });

  test("back reports navigation so the backend waits for the previous page", () => {
    window.history.back = jest.fn();
    expect(doAction("back").navigated).toBe(true);
  });
});

describe("readMainText", () => {
  const { readMainText } = content;
  const visibleAll = () => document.querySelectorAll("*").forEach(makeVisible);

  test("reads the main content and skips nav, header, footer and buttons", () => {
    document.body.innerHTML = `
      <header>Site header</header>
      <nav><a href="/">Home</a></nav>
      <main>
        <h1>7-Day Forecast</h1>
        <p>Tonight: Clear, low around 65.</p>
        <p>Sunday: Sunny, high near 87.</p>
        <button>Share</button>
      </main>
      <footer>Footer links</footer>`;
    visibleAll();
    const { text, truncated } = readMainText();
    expect(text).toBe("7-Day Forecast\nTonight: Clear, low around 65.\nSunday: Sunny, high near 87.");
    expect(truncated).toBe(false);
  });

  test("falls back to the body and skips hidden text", () => {
    document.body.innerHTML = `<div><p>Visible fact.</p><p id="h">Hidden fact.</p></div>`;
    visibleAll();
    Object.defineProperty(document.getElementById("h"), "offsetParent", { get: () => null });
    expect(readMainText().text).toBe("Visible fact.");
  });

  test("caps long pages at a sentence boundary and says it was cut", () => {
    document.body.innerHTML = `<main>${Array.from({ length: 400 }, (_, i) => `<p>This is sentence ${i}.</p>`).join("")}</main>`;
    visibleAll();
    const { text, truncated } = readMainText(500);
    expect(truncated).toBe(true);
    expect(text.length).toBeLessThanOrEqual(500);
    expect(text.endsWith(".")).toBe(true);
  });

  test("doAction read_text returns title and text", () => {
    document.title = "Forecast";
    document.body.innerHTML = `<main><p>Hot.</p></main>`;
    visibleAll();
    const r = doAction("read_text");
    expect(r).toMatchObject({ success: true, action: "read_text", title: "Forecast", text: "Hot." });
  });
});

describe("site memory: finding a site's search box and chat box", () => {
  const { findSearchBox, findChatBox, findKeyElements, stableSelector, resolveKeyElement, typeAndSubmit } = content;
  const visibleAll = () => document.querySelectorAll("*").forEach(makeVisible);

  test("Google-style: textarea name=q in a search form", () => {
    document.body.innerHTML = `
      <form action="/search" role="search"><textarea name="q" aria-label="Search"></textarea></form>
      <input type="text" aria-label="Your name">`;
    visibleAll();
    expect(findSearchBox().getAttribute("name")).toBe("q");
  });

  test("YouTube-style: input name=search_query", () => {
    document.body.innerHTML = `<form id="search-form" action="/results"><input id="search" name="search_query" placeholder="Search"></form>`;
    visibleAll();
    const box = findSearchBox();
    expect(box.id).toBe("search");
    expect(stableSelector(box)).toBe("#search");
  });

  test("a plain text field is not mistaken for search", () => {
    document.body.innerHTML = `<input type="text" aria-label="First name"><input type="email" placeholder="Email">`;
    visibleAll();
    expect(findSearchBox()).toBe(null);
  });

  test("ChatGPT-style: contenteditable prompt box with a Send button is the chat box", () => {
    document.body.innerHTML = `
      <form><div id="prompt-textarea" contenteditable="true"><p data-placeholder="Ask anything"></p></div>
      <button aria-label="Send prompt">↑</button></form>`;
    visibleAll();
    expect(findChatBox().id).toBe("prompt-textarea");
    expect(findSearchBox()).toBe(null);
  });

  test("a page with both: search box and chat box are told apart", () => {
    document.body.innerHTML = `
      <input type="search" name="q" placeholder="Search chats">
      <div><textarea aria-label="Message the assistant"></textarea><button aria-label="Send">Send</button></div>`;
    visibleAll();
    const keys = findKeyElements();
    expect(keys.search.selector).toBe('input[name="q"]');
    expect(keys.chat.selector).toBe('textarea[aria-label="Message the assistant"]');
  });

  test("stableSelector skips generated ids and uses a stable attribute", () => {
    document.body.innerHTML = `<input id="input-83920417" name="query">`;
    expect(stableSelector(document.querySelector("input"))).toBe('input[name="query"]');
  });

  test("stableSelector returns null when nothing unique identifies the element", () => {
    document.body.innerHTML = `<input><input>`;
    expect(stableSelector(document.querySelector("input"))).toBe(null);
  });

  test("resolveKeyElement uses the remembered selector, or re-detects if it's gone", () => {
    document.body.innerHTML = `<input type="search" id="new-search" placeholder="Search">`;
    visibleAll();
    expect(resolveKeyElement("search", "#new-search").via).toBe("memory");
    const redetected = resolveKeyElement("search", "#old-search-from-last-redesign");
    expect(redetected.via).toBe("detected");
    expect(redetected.el.id).toBe("new-search");
  });

  test("typeAndSubmit on a search form submits the form", async () => {
    document.body.innerHTML = `<form action="/results"><input name="search_query" placeholder="Search"></form>`;
    visibleAll();
    const form = document.querySelector("form");
    form.requestSubmit = jest.fn();
    const result = await typeAndSubmit(document.querySelector("input"), "cat videos");
    expect(document.querySelector("input").value).toBe("cat videos");
    expect(form.requestSubmit).toHaveBeenCalled();
    expect(result).toMatchObject({ success: true, submitted: true, navigated: true });
  });

  test("typeAndSubmit in a chat box clicks Send when Enter is ignored", async () => {
    document.body.innerHTML = `<div><div contenteditable="true" aria-label="Message"></div><button aria-label="Send">Send</button></div>`;
    visibleAll();
    const send = document.querySelector("button");
    const clicked = jest.fn();
    send.addEventListener("click", clicked);
    const result = await typeAndSubmit(document.querySelector("[contenteditable]"), "hello");
    expect(clicked).toHaveBeenCalled();
    expect(result.sentWith).toBe("send button");
  });

  test("typeAndSubmit doesn't click Send when the app handled Enter itself", async () => {
    document.body.innerHTML = `<div><div contenteditable="true" aria-label="Message"></div><button aria-label="Send">Send</button></div>`;
    visibleAll();
    const box = document.querySelector("[contenteditable]");
    box.addEventListener("keydown", (e) => { e.preventDefault(); box.textContent = ""; }); // app sends + clears
    const clicked = jest.fn();
    document.querySelector("button").addEventListener("click", clicked);
    await typeAndSubmit(box, "hello");
    expect(clicked).not.toHaveBeenCalled();
  });

  test("site_info reports host, title and key elements", () => {
    document.title = "YouTube";
    document.body.innerHTML = `<h1>Home</h1><input type="search" name="search_query" placeholder="Search">`;
    visibleAll();
    const info = doAction("site_info");
    expect(info).toMatchObject({ success: true, action: "site_info", title: "YouTube" });
    expect(info.keys.search.selector).toBe('input[name="search_query"]');
    expect(info.keys.chat).toBe(null);
  });
});

describe("question text above radio groups (SSA-style markup, B4)", () => {
  const { getGroupQuestion, getPageContext } = content;
  const visibleAll = () => document.querySelectorAll("*").forEach(makeVisible);

  test("SSA: <p> question in a container, radios in a sibling div", () => {
    document.body.innerHTML = `
      <div data-test="progress">13%</div>
      <div data-test="question-container">
        <p data-test="question-title">Have you ever worked and paid Social Security taxes?</p>
        <div>
          <input type="radio" id="y" name="worked"><label for="y">Yes</label>
          <input type="radio" id="n" name="worked"><label for="n">No</label>
        </div>
      </div>
      <button>Next</button>`;
    visibleAll();
    const radios = listElements().filter((e) => e.type === "radio");
    expect(radios.map((r) => r.label)).toEqual([
      "Have you ever worked and paid Social Security taxes? → Yes",
      "Have you ever worked and paid Social Security taxes? → No",
    ]);
  });

  test("help text between the question and the options doesn't replace the question", () => {
    document.body.innerHTML = `
      <div>
        <p>Will the condition affect your ability to work for a year or more, or result in death?</p>
        <p>A condition can be physical or mental.</p>
        <div><label><input type="radio" name="year"> Yes</label><label><input type="radio" name="year"> No</label></div>
      </div>`;
    visibleAll();
    expect(getGroupQuestion(document.querySelector("input"))).toBe(
      "Will the condition affect your ability to work for a year or more, or result in death?");
  });

  test("several questions in one form: each gets its own question", () => {
    document.body.innerHTML = `
      <form>
        <p>Are you married?</p>
        <div><input type="radio" name="m" id="m1"><label for="m1">Yes</label><input type="radio" name="m" id="m2"><label for="m2">No</label></div>
        <p>Do you have permanent kidney failure?</p>
        <div><input type="radio" name="k" id="k1"><label for="k1">Yes</label><input type="radio" name="k" id="k2"><label for="k2">No</label></div>
      </form>`;
    visibleAll();
    expect(getGroupQuestion(document.getElementById("m1"))).toBe("Are you married?");
    expect(getGroupQuestion(document.getElementById("k2"))).toBe("Do you have permanent kidney failure?");
  });

  test("a lone checkbox doesn't borrow an unrelated paragraph", () => {
    document.body.innerHTML = `<p>Welcome to our site.</p><div><input type="checkbox" id="c"><label for="c">I agree</label></div>`;
    visibleAll();
    expect(getGroupQuestion(document.getElementById("c"))).toBe("");
    expect(listElements()[0].label).toBe("I agree");
  });

  test("fieldset legend still wins when present", () => {
    document.body.innerHTML = `<p>Other text?</p><fieldset><legend>Are you a veteran?</legend>
      <input type="radio" name="v" id="v1"><label for="v1">Yes</label><input type="radio" name="v" id="v2"><label for="v2">No</label></fieldset>`;
    visibleAll();
    expect(getGroupQuestion(document.getElementById("v1"))).toBe("Are you a veteran?");
  });

  test("custom role=radio options with text in a plain container", () => {
    document.body.innerHTML = `
      <div><span>What is the value of your resources?</span>
        <div><div role="radio" aria-checked="false">$0 to $2,000</div><div role="radio" aria-checked="false">$2,001 to $17,220</div></div>
      </div>`;
    visibleAll();
    expect(getGroupQuestion(document.querySelector("[role='radio']"))).toBe("What is the value of your resources?");
  });

  test("the question also appears in page headings for read_page", () => {
    document.body.innerHTML = `
      <h1>Eligibility</h1>
      <div><p>Are you married?</p><div><input type="radio" name="m" id="a"><label for="a">Yes</label><input type="radio" name="m" id="b"><label for="b">No</label></div></div>`;
    visibleAll();
    expect(getPageContext().headings).toEqual(["Eligibility", "Are you married?"]);
  });
});

describe("number tags on/off", () => {
  const { setOverlaysEnabled } = content;
  const tags = () => document.querySelectorAll("#voice-agent-overlays [data-overlay-for]").length;

  afterEach(() => setOverlaysEnabled(true));

  test("turning numbers off removes them and keeps them off after a re-scan", () => {
    document.body.innerHTML = `<button>One</button><button>Two</button>`;
    document.querySelectorAll("button").forEach(makeVisible);
    listElements();
    content.showOverlays();
    expect(tags()).toBe(2);

    setOverlaysEnabled(false);
    expect(tags()).toBe(0);
    listElements();
    content.showOverlays(); // e.g. after a click — still hidden
    expect(tags()).toBe(0);
  });

  test("numbers still work for clicking while hidden", () => {
    document.body.innerHTML = `<button>Go</button>`;
    makeVisible(document.querySelector("button"));
    setOverlaysEnabled(false);
    const num = listElements()[0].num;
    expect(doAction("click", num).success).toBe(true);
  });

  test("turning numbers back on shows them, scanning first if needed", () => {
    document.body.innerHTML = `<button>One</button>`;
    makeVisible(document.querySelector("button"));
    setOverlaysEnabled(false);
    setOverlaysEnabled(true);
    expect(tags()).toBe(1);
  });
});
