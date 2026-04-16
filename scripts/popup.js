const ruleList = document.getElementById("ruleList");
const form = document.querySelector("form");
const input = document.getElementById("ruleInput");
const statusPara = document.getElementById("status");
const themeToggle = document.getElementById("themeToggle");
const activeCountEl = document.getElementById("activeCount");
const ruleCountEl = document.getElementById("ruleCount");
const versionEl = document.getElementById("version");

const THEME_KEY = "theme";
const DEFAULT_THEME = "light";

// Init
versionEl.textContent = `v${chrome.runtime.getManifest().version}`;
await initTheme();
await render();

// ---- Form submit ----
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearStatus();

  const result = validate(input.value);

  if (!result.ok) {
    setStatus(result.error, "error");
  } else {
    const added = await addToStorage(result.rule);
    if (added) {
      await render();
      await reloadActiveTab();
      setStatus("added", "ok");
      input.value = "";
    }
  }
});

// ---- Theme toggle ----
themeToggle.addEventListener("click", async () => {
  const next =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  await chrome.storage.local.set({ [THEME_KEY]: next });
  applyTheme(next);
});

// ---- Rule list: delete + toggle (event delegation) ----
ruleList.addEventListener("click", async (e) => {
  const deleteBtn = e.target.closest(".delete-btn");
  const switchBox = e.target.closest(".switch-box");

  if (!deleteBtn && !switchBox) return;

  const { rules } = await chrome.storage.local.get({ rules: [] });

  if (deleteBtn) {
    const id = deleteBtn.dataset.id;
    const deleted = rules.find((r) => r.id === id);
    if (!deleted) return;

    await chrome.storage.local.set({ rules: rules.filter((r) => r.id !== id) });
    await render();
    if (deleted.enabled) await reloadActiveTab();
    return;
  }

  if (switchBox) {
    const id = switchBox.dataset.id;
    const current = rules.find((r) => r.id === id);
    if (!current) return;

    const newRules = rules.map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled } : r,
    );
    await chrome.storage.local.set({ rules: newRules });
    await render();
    await reloadActiveTab();
  }
});

// ---- Helpers ----

async function reloadActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) chrome.tabs.reload(tab.id);
}

async function render() {
  const { rules } = await chrome.storage.local.get({ rules: [] });

  if (rules.length === 0) {
    ruleList.innerHTML = `<li class="empty-state"># no rules yet. add one above.</li>`;
  } else {
    ruleList.innerHTML = rules
      .map(
        (rule) => `
      <li class="rule-item${rule.enabled ? "" : " off"}">
        <span class="rule-text" title="${rule.value}">${rule.value}</span>
        <span class="rule-type">${rule.type}</span>
        <label class="switch" title="${rule.enabled ? "Disable" : "Enable"} rule">
          <input
            type="checkbox"
            class="switch-box"
            data-id="${rule.id}"
            ${rule.enabled ? "checked" : ""}
            aria-label="Toggle ${rule.value}"
          />
          <span class="slider"></span>
        </label>
        <button data-id="${rule.id}" class="delete-btn" title="Delete rule">rm</button>
      </li>`,
      )
      .join("");
  }

  updateCounts(rules);
}

function updateCounts(rules) {
  const active = rules.filter((r) => r.enabled).length;
  activeCountEl.textContent = `${active} active`;
  ruleCountEl.textContent = `# ${rules.length} rule${rules.length === 1 ? "" : "s"}`;
}

async function initTheme() {
  const { [THEME_KEY]: stored } = await chrome.storage.local.get({
    [THEME_KEY]: DEFAULT_THEME,
  });
  applyTheme(stored);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const icon = document.querySelector(".theme-icon");
  if (icon) icon.textContent = theme === "dark" ? "◑" : "◐";
}

function setStatus(message, type) {
  statusPara.textContent = message;
  statusPara.className = type === "error" ? "status-error" : "status-ok";
}

function clearStatus() {
  statusPara.textContent = "";
  statusPara.className = "";
}

async function addToStorage(newRule) {
  const { rules } = await chrome.storage.local.get({ rules: [] });
  const exists = rules.some(
    (r) => r.type === newRule.type && r.value === newRule.value,
  );
  if (exists) {
    setStatus("already in the list", "error");
    return false;
  }
  await chrome.storage.local.set({ rules: [...rules, newRule] });
  return true;
}

function validate(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "enter a domain or url" };

  let url;
  const withScheme =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;

  try {
    url = new URL(withScheme);
  } catch {
    return { ok: false, error: "url is incorrect" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "only http and https supported" };
  }
  if (!url.hostname) {
    return { ok: false, error: "include a website name" };
  }

  let hostname = url.hostname.toLowerCase().replace(/^www\./, "");

  if (url.pathname !== "/" || url.search !== "") {
    let pathname = url.pathname.replace(/\/+$/, "");
    const value = url.origin + pathname + url.search;
    return {
      ok: true,
      rule: { id: crypto.randomUUID(), type: "url", value, enabled: true },
    };
  }

  return {
    ok: true,
    rule: {
      id: crypto.randomUUID(),
      type: "domain",
      value: hostname,
      enabled: true,
    },
  };
}
