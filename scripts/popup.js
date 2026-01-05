// rule structure:
// {
//   id: string,              // uuid - unique
//   type: "domain" | "url",
//   value: string,           // normalized
//   enabled: boolean
// }

const ruleList = document.getElementById("ruleList");
const form = document.querySelector("form");
const input = document.getElementById("ruleInput");
const statusPara = document.getElementById("status");
const themeToggle = document.getElementById("themeToggle");

const THEME_KEY = "theme";
const DEFAULT_THEME = "light";

await initTheme();

// load rule list
await render();

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const raw = input.value;

  // clean already existing text
  statusPara.textContent = "";

  // validation
  let result = validate(raw);

  // render error or add to the list
  if (result.ok === false) {
    statusPara.textContent = result.error;
  } else {
    const addResult = await addToStorage(result.rule);
    if (addResult) {
      await render();
      await reloadActiveTab();
      statusPara.textContent = "Successfully added!";
      input.value = "";
    }
  }
});

themeToggle.addEventListener("click", async () => {
  const nextTheme =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  await chrome.storage.local.set({ [THEME_KEY]: nextTheme });
  applyTheme(nextTheme);
});

// One handler for both delete + switch (event delegation)
ruleList.addEventListener("click", async (e) => {
  const deleteBtn = e.target.closest(".delete-btn");
  const switchBox = e.target.closest(".switch-box");

  // If user clicked neither a delete button nor a switch, ignore
  if (!deleteBtn && !switchBox) return;

  const { rules } = await chrome.storage.local.get({ rules: [] });

  // DELETE
  if (deleteBtn) {
    const id = deleteBtn.dataset.id;

    // Find the rule being deleted (so we know if it was enabled)
    const deletedRule = rules.find((r) => r.id === id);
    if (!deletedRule) return; // safety

    // Remove it
    const newRules = rules.filter((r) => r.id !== id);
    await chrome.storage.local.set({ rules: newRules });

    await render();

    // If it WAS enabled, we might have blocked the current page -> reload to restore
    if (deletedRule.enabled) {
      await reloadActiveTab();
    }

    return;
  }

  // TOGGLE (switch)
  if (switchBox) {
    const id = switchBox.dataset.id;

    // Find current rule so we know its old state
    const currentRule = rules.find((r) => r.id === id);
    if (!currentRule) return; // safety

    const newEnabled = !currentRule.enabled;

    // Update rule in-place (immutably) while keeping the order
    const newRules = rules.map((r) =>
      r.id === id ? { ...r, enabled: newEnabled } : r
    );

    await chrome.storage.local.set({ rules: newRules });

    await render();

    await reloadActiveTab();
  }
});

// if current tab is active then unblock it (reload)
async function reloadActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  chrome.tabs.reload(tab.id);
}

// output rule list
async function render() {
  const { rules } = await chrome.storage.local.get({ rules: [] });

  if (rules.length === 0) {
    ruleList.innerHTML = "<li>The list is currently empty!</li>";
  } else {
    ruleList.innerHTML = rules
      .map(
        (rule) => `
      <li class="rule-item">
        <span class="rule-text" title="${rule.value}" tabindex="0">${
          rule.value
        }</span>

        <div class="rule-mid">
          <label class="switch">
            <input type="checkbox" class="switch-box" data-id="${rule.id}" ${
          rule.enabled ? "checked" : ""
        } />
            <span class="slider"></span>
          </label>
          <span class="rule-type">${rule.type}</span>
        </div>

        <button data-id="${
          rule.id
        }" class="delete-btn" title="Delete">✕</button>
      </li>
    `
      )
      .join("");
  }
}

async function initTheme() {
  const { [THEME_KEY]: storedTheme } = await chrome.storage.local.get({
    [THEME_KEY]: DEFAULT_THEME,
  });
  applyTheme(storedTheme);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

// add to chrome storage
async function addToStorage(newRule) {
  const { rules } = await chrome.storage.local.get({ rules: [] });
  if (
    // applies callback to each item, once the first element is truthful, it automatically stops and returns true
    rules.some(
      (existingRule) =>
        existingRule.type === newRule.type &&
        existingRule.value === newRule.value
    )
  ) {
    statusPara.textContent = "Already in the list.";
    return false;
  }
  await chrome.storage.local.set({ rules: [...rules, newRule] });
  return true;
}

function validate(raw) {
  let url;
  let urlType;
  let value;
  let hostname;
  let pathname;

  // trim
  let newInput = raw.trim();

  // check if empty
  if (!newInput) {
    return { ok: false, error: "Enter a domain or URL." };
  }

  // add URL check
  if (newInput.startsWith("http://") || newInput.startsWith("https://")) {
    try {
      url = new URL(newInput);
    } catch (e) {
      return { ok: false, error: "URL is incorrect" };
    }
  } else {
    try {
      url = new URL(`https://${newInput}`);
    } catch (e) {
      return { ok: false, error: "URL is incorrect" };
    }
  }

  // allow only https or http
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "Only http and https is supported" };
  }

  // check if hostname exists
  if (!url.hostname) {
    return { ok: false, error: "Please include a website name." };
  }

  // to lower case
  hostname = url.hostname.toLowerCase();

  // delete www. before the string
  hostname = hostname.replace(/^www\./, "");

  // check if url or domain
  if (url.pathname !== "/" || url.search !== "") {
    urlType = "url";

    pathname = url.pathname;

    // deal with trailing /
    if (url.pathname !== "/" || url.search !== "") {
      pathname = pathname.replace(/\/+$/, "");
    }

    value = url.origin + pathname + url.search;
  } else {
    urlType = "domain";
    value = hostname;
  }

  return {
    ok: true,
    rule: {
      id: crypto.randomUUID(),
      type: urlType,
      value: value,
      enabled: true,
    },
  };
}
