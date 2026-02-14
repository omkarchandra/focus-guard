const ALARM_NAME = "web-blocker-timer";
const KILL_SERVER = "http://127.0.0.1:7532";
const RULE_ID_START = 1;

console.log("[WebBlocker] Service worker loaded");

// -- Message handler --
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("[WebBlocker] Message received:", msg.action);

  if (msg.action === "startBlocking") {
    startBlocking(msg.sites, msg.apps, msg.duration)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.error("[WebBlocker] startBlocking error:", err);
        sendResponse({ ok: false, error: err.message });
      });
    return true;
  }

  if (msg.action === "stopBlocking") {
    stopBlocking()
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.error("[WebBlocker] stopBlocking error:", err);
        sendResponse({ ok: false, error: err.message });
      });
    return true;
  }

  if (msg.action === "updateLists") {
    updateLists(msg.sites, msg.apps)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.error("[WebBlocker] updateLists error:", err);
        sendResponse({ ok: false, error: err.message });
      });
    return true;
  }

  if (msg.action === "getState") {
    getState()
      .then((state) => sendResponse(state))
      .catch((err) => {
        console.error("[WebBlocker] getState error:", err);
        sendResponse({
          blocking: false, sites: [], apps: [],
          endTime: null, duration: null,
        });
      });
    return true;
  }
});

// -- Alarms --
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    console.log("[WebBlocker] Timer expired, stopping");
    stopBlocking();
  }
});

// -- App blocking via local server --
async function blockApps(apps) {
  const res = await fetch(KILL_SERVER + "/block", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apps }),
  });
  return res.json();
}

async function unblockApps() {
  const res = await fetch(KILL_SERVER + "/unblock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return res.json();
}

// -- Start blocking --
async function startBlocking(sites, apps, durationMinutes) {
  console.log("[WebBlocker] Starting block — sites:", sites, "apps:", apps, "for", durationMinutes, "min");

  // --- Website blocking ---
  const blockedPageURL = chrome.runtime.getURL("/blocked/blocked.html");
  const rules = [];

  sites.forEach((domain, i) => {
    const ruleBase = RULE_ID_START + i * 2;
    rules.push({
      id: ruleBase,
      priority: 1,
      action: { type: "redirect", redirect: { url: blockedPageURL } },
      condition: { urlFilter: "||" + domain, resourceTypes: ["main_frame"] },
    });
    rules.push({
      id: ruleBase + 1,
      priority: 1,
      action: { type: "block" },
      condition: {
        urlFilter: "||" + domain,
        resourceTypes: [
          "sub_frame", "stylesheet", "script", "image", "font",
          "xmlhttprequest", "media", "websocket", "other",
        ],
      },
    });
  });

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const existingIds = existing.map((r) => r.id);
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existingIds,
    addRules: rules,
  });

  // --- App blocking ---
  if (apps.length > 0) {
    try {
      await blockApps(apps);
    } catch (err) {
      console.warn("[WebBlocker] Kill server not available:", err.message);
    }
  }

  // --- Timer ---
  const endTime = Date.now() + durationMinutes * 60 * 1000;
  await chrome.alarms.create(ALARM_NAME, { when: endTime });

  // --- Save state ---
  await chrome.storage.local.set({
    blocking: true,
    sites,
    apps,
    endTime,
    duration: durationMinutes,
  });
}

// -- Update lists while blocking --
async function updateLists(sites, apps) {
  console.log("[WebBlocker] Updating lists — sites:", sites, "apps:", apps);

  const blockedPageURL = chrome.runtime.getURL("/blocked/blocked.html");
  const rules = [];
  sites.forEach((domain, i) => {
    const ruleBase = RULE_ID_START + i * 2;
    rules.push({
      id: ruleBase,
      priority: 1,
      action: { type: "redirect", redirect: { url: blockedPageURL } },
      condition: { urlFilter: "||" + domain, resourceTypes: ["main_frame"] },
    });
    rules.push({
      id: ruleBase + 1,
      priority: 1,
      action: { type: "block" },
      condition: {
        urlFilter: "||" + domain,
        resourceTypes: [
          "sub_frame", "stylesheet", "script", "image", "font",
          "xmlhttprequest", "media", "websocket", "other",
        ],
      },
    });
  });

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const existingIds = existing.map((r) => r.id);
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existingIds,
    addRules: rules,
  });

  if (apps.length > 0) {
    try { await blockApps(apps); } catch (_) {}
  } else {
    try { await unblockApps(); } catch (_) {}
  }

  await chrome.storage.local.set({ sites, apps });
}

// -- Stop blocking --
async function stopBlocking() {
  console.log("[WebBlocker] Stopping all blocks");

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const existingIds = existing.map((r) => r.id);
  if (existingIds.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: existingIds });
  }

  await chrome.alarms.clear(ALARM_NAME);
  try { await unblockApps(); } catch (_) {}

  await chrome.storage.local.set({
    blocking: false,
    endTime: null,
    duration: null,
  });
}

// -- Get current state --
async function getState() {
  const data = await chrome.storage.local.get([
    "blocking", "sites", "apps", "endTime", "duration",
  ]);
  return {
    blocking: data.blocking || false,
    sites: data.sites || [],
    apps: data.apps || [],
    endTime: data.endTime || null,
    duration: data.duration || null,
  };
}
