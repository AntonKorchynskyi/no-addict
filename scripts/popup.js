await chrome.storage.local.set({
  rules: [
    { id: "1", type: "domain", value: "twitter.com", enabled: true },
    { id: "2", type: "url", value: "https://example.com/path", enabled: false },
  ],
});

let ruleList = document.getElementById("ruleList");

const { rules } = await chrome.storage.local.get({ rules: [] });

ruleList.innerHTML = rules
  .map(
    (rule) => `
      <li class="rule-item">
        <span class="rule-text">${rule.value}</span>

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

// structure:
// {
//   id: string,              // unique
//   type: "domain" | "url",
//   value: string,           // normalized
//   enabled: boolean
// }
