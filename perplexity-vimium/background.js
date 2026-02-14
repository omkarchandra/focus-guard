function injectVimium() {
  if (window.__pvInjected) return;
  window.__pvInjected = true;

  console.log("[PV] injected into page");

  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    var tag = document.activeElement ? document.activeElement.tagName : "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (document.activeElement && document.activeElement.isContentEditable) return;

    var sc = document.querySelector(".scrollable-container");
    if (!sc) return;

    if (e.key === "Escape") {
      if (document.activeElement) document.activeElement.blur();
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }

    if (e.key === "j") {
      e.preventDefault(); e.stopImmediatePropagation();
      sc.scrollBy({ top: 60 });
    } else if (e.key === "k") {
      e.preventDefault(); e.stopImmediatePropagation();
      sc.scrollBy({ top: -60 });
    } else if (e.key === "d") {
      e.preventDefault(); e.stopImmediatePropagation();
      sc.scrollBy({ top: window.innerHeight * 0.45 });
    } else if (e.key === "u") {
      e.preventDefault(); e.stopImmediatePropagation();
      sc.scrollBy({ top: -window.innerHeight * 0.45 });
    } else if (e.key === "G") {
      e.preventDefault(); e.stopImmediatePropagation();
      sc.scrollTo({ top: sc.scrollHeight });
    } else if (e.key === "H") {
      e.preventDefault(); e.stopImmediatePropagation();
      history.back();
    } else if (e.key === "L") {
      e.preventDefault(); e.stopImmediatePropagation();
      history.forward();
    }
  }, true);
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    tab.url.includes("perplexity.ai")
  ) {
    // Try MAIN world first
    chrome.scripting.executeScript(
      { target: { tabId }, func: injectVimium, world: "MAIN" },
      () => {
        if (chrome.runtime.lastError) {
          // Fallback: inject without world option
          chrome.scripting.executeScript(
            { target: { tabId }, func: injectVimium },
            () => {
              if (chrome.runtime.lastError) {
                console.error("[PV] injection failed:", chrome.runtime.lastError.message);
              }
            }
          );
        }
      }
    );
  }
});

console.log("[PV] background service worker started");
