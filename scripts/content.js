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
  ensureDomContentLoaded(() => {
    if (document.getElementById(BLOCK_MARKER_ID)) return;

    document.body.classList.add("noaddict-blocked");
    document.body.innerHTML = `
      <link rel="stylesheet" href="${chrome.runtime.getURL("popup.css")}" />
      <div id="${BLOCK_MARKER_ID}" class="na-blocked">
        <div class="na-blocked-card">
          <h1 class="na-blocked-title">This page is blocked</h1>
          <p class="na-blocked-copy">No Addict replaced this page so you can stay on track. You can adjust your rules from the extension popup.</p>
          <div class="na-blocked-rule">
            <span class="na-blocked-label">Matched rule: </span>
            <span class="na-blocked-value">${rule.value}</span>
          </div>
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
