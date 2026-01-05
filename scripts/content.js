shouldBlock();

// listens to extension code, so that if current page was chosen to be the blocked one, it will be blocked
chrome.runtime.onMessage.addListener((message) => {
  if (message?.action === "recheck") shouldBlock();
});

// replaces page's html body
function blockPage(rule) {
  if (document.body) {
    document.body.innerHTML = `<div><h1>No Addiction</h1><p>This page's content was replaced by No Addict extension</p><p>Matched URL: ${rule.value}</p></div>`;
  } else {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        blockPage(rule);
      },
      { once: true }
    );
  }
}

// check if url needs to be blocked
async function shouldBlock() {
  let link = window.location.href;
  let linkObj = new URL(link);

  let rules = await getRules();

  // save hostname and also clean it
  let currentHost = linkObj.hostname.toLowerCase().replace(/^www\./, "");

  let pathname = linkObj.pathname;

  // deal with trailing /
  if (linkObj.pathname !== "/") {
    pathname = pathname.replace(/\/+$/, "");
  }

  const currentUrlValue = linkObj.origin + pathname + linkObj.search;

  let matchedRule = rules.find((rule) => {
    // check if rule is enabled
    if (rule.enabled === true) {
      // domain
      if (rule.type === "domain") {
        if (
          currentHost === rule.value ||
          currentHost.endsWith("." + rule.value)
        ) {
          return true;
        }
        // rule
      } else if (rule.type === "url") {
        if (
          currentUrlValue === rule.value ||
          currentUrlValue.startsWith(rule.value + "/") ||
          currentUrlValue.startsWith(rule.value + "?")
        ) {
          return true;
        }
      }
    }
  });

  if (matchedRule) {
    blockPage(matchedRule);
  }
}

// get rules from chrome storage
async function getRules() {
  const { rules } = await chrome.storage.local.get({ rules: [] });
  return rules;
}
