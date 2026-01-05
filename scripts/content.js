shouldBlock();

chrome.runtime.onMessage.addListener((message) => {
  if (message?.action === "recheck") shouldBlock();
});

// --- Blocking helpers ---

const BLOCK_MARKER_ID = "noaddict-blocked-root";
let observer = null;
let stopTimer = null;

function ensureBodyReady(cb) {
  if (document.body) return cb();
  // Wait until body exists (earlier than DOMContentLoaded in many cases)
  new MutationObserver((_, obs) => {
    if (document.body) {
      obs.disconnect();
      cb();
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
}

function applyBlock(rule) {
  ensureBodyReady(() => {
    // Idempotent: if we already blocked, don't rebuild again
    if (document.getElementById(BLOCK_MARKER_ID)) return;

    document.body.innerHTML = `
      <div id="${BLOCK_MARKER_ID}" style="padding:24px;font-family:system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;">
        <h1 style="margin:0 0 8px 0;">No Addict</h1>
        <p style="margin:0 0 8px 0;">This page's content was replaced by No Addict extension.</p>
        <p style="margin:0;color:#666;">Matched rule: ${rule.value}</p>
      </div>
    `;

    // Start "fight back" observer so the site can't re-render over us
    startBlockObserver(rule);
  });
}

function startBlockObserver(rule) {
  // Clear any previous observer/timers
  if (observer) observer.disconnect();
  if (stopTimer) clearTimeout(stopTimer);

  observer = new MutationObserver(() => {
    // If site replaces the DOM, re-apply the block
    // But keep it cheap: only reapply if our marker is missing
    if (!document.getElementById(BLOCK_MARKER_ID)) {
      // This will recreate our blocked body and restart observer
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
  }, 2000); // 2 seconds is usually enough
}

// --- Matching logic ---

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

async function getRules() {
  const { rules } = await chrome.storage.local.get({ rules: [] });
  return rules;
}
