// await chrome.storage.local.set({
//   rules: [
//     { id: "1", type: "domain", value: "twitter.com", enabled: true },
//     { id: "2", type: "url", value: "https://example.com/path", enabled: false },
//   ],
// });

const ruleList = document.getElementById("ruleList");
const form = document.querySelector("form");
const input = document.getElementById("ruleInput");
const statusPara = document.getElementById("status");

render();

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
      statusPara.textContent = "Successfully added!";
      input.value = "";
    }
  }
});

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
            <input type="checkbox" ${rule.enabled ? "checked" : ""} />
            <span class="slider"></span>
          </label>
          <span class="rule-type">${rule.type}</span>
        </div>

        <button class="icon-btn" title="Delete">✕</button>
      </li>
    `
      )
      .join("");
  }
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

// structure:
// {
//   id: string,              // unique
//   type: "domain" | "url",
//   value: string,           // normalized
//   enabled: boolean
// }
