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
    expect(results[0].value).toBe(' [selected: "Afternoon"]');
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
