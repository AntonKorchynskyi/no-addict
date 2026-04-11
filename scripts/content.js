shouldBlock();

chrome.runtime.onMessage.addListener((message) => {
  if (message?.action === "recheck") shouldBlock();
});

const BLOCK_MARKER_ID = "noaddict-blocked-root";
let observer = null;
let stopTimer = null;

function ensureDomContentLoaded(cb) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", cb, { once: true });
    return;
  }
  cb();
}

function applyBlock(rule) {
  ensureDomContentLoaded(async () => {
    if (document.getElementById(BLOCK_MARKER_ID)) return;

    // Propagate user's theme preference to the blocked page
    const { theme } = await chrome.storage.local.get({ theme: "light" });
    document.documentElement.dataset.theme = theme;

    document.body.classList.add("noaddict-blocked");
    document.body.innerHTML = `
      <link rel="stylesheet" href="${chrome.runtime.getURL("popup.css")}" />
      <div id="${BLOCK_MARKER_ID}" class="na-blocked">
        <div class="na-blocked-card">
          <p class="na-blocked-prompt">check-focus.sh --url ${escHtml(location.href)}</p>
          <div class="na-blocked-err">
            <span class="dot"></span>Access denied
          </div>
          <h1 class="na-blocked-title">page blocked<span class="cursor" aria-hidden="true"></span></h1>
          <p class="na-blocked-copy">No Addict intercepted this request. You told past-you not to open this — past-you is looking out for present-you.</p>
          <p class="na-blocked-label">Matched rule</p>
          <div class="na-blocked-rule">
            <span class="na-blocked-value">${escHtml(rule.value)}</span>
            <span class="na-blocked-tag">${escHtml(rule.type)}</span>
          </div>
          <p class="na-blocked-hint">toggle the rule from the extension popup to allow this site</p>
        </div>
      </div>
    `;

    startBlockObserver(rule);
  });
}

function startBlockObserver(rule) {
  // Clear any previous observer/timers
  if (observer) observer.disconnect();
  if (stopTimer) clearTimeout(stopTimer);

  observer = new MutationObserver(() => {
    // If site replaces the DOM, re-apply the block
    if (!document.getElementById(BLOCK_MARKER_ID)) {
      applyBlock(rule);
    }
  });

  // Watch for DOM changes that SPAs do during hydration/render
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  // Stop after a short window to avoid running forever
  stopTimer = setTimeout(() => {
    if (observer) observer.disconnect();
    observer = null;
    stopTimer = null;
  }, 2000);
}

async function shouldBlock() {
  const linkObj = new URL(window.location.href);
  const rules = await getRules();

  const currentHost = linkObj.hostname.toLowerCase().replace(/^www\./, "");

  let pathname = linkObj.pathname;
  if (pathname !== "/") pathname = pathname.replace(/\/+$/, "");

  const currentUrlValue = linkObj.origin + pathname + linkObj.search;

  const matchedRule = rules.find((rule) => {
    if (!rule.enabled) return false;

    if (rule.type === "domain") {
      return (
        currentHost === rule.value || currentHost.endsWith("." + rule.value)
      );
    }

    if (rule.type === "url") {
      return (
        currentUrlValue === rule.value ||
        currentUrlValue.startsWith(rule.value + "/") ||
        currentUrlValue.startsWith(rule.value + "?")
      );
    }

    return false;
  });

  if (matchedRule) {
    applyBlock(matchedRule);
  }
}

// get rules from chrome storage
async function getRules() {
  const { rules } = await chrome.storage.local.get({ rules: [] });
  return rules;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
