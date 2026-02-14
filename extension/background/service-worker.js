const ALARM_NAME = "web-blocker-timer";
const APP_KILL_ALARM = "app-kill-interval";
const NATIVE_HOST = "com.webblocker.appblocker";
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
  if (alarm.name === APP_KILL_ALARM) {
    killBlockedApps();
  }
});

// -- Kill blocked apps via native host --
async function killBlockedApps() {
  const data = await chrome.storage.local.get(["blocking", "apps"]);
  if (!data.blocking || !data.apps || data.apps.length === 0) return;

  try {
    const response = await sendNativeMessage({ action: "kill", apps: data.apps });
    console.log("[WebBlocker] Kill results:", response);
  } catch (err) {
    console.error("[WebBlocker] Native messaging error:", err);
  }
}

function sendNativeMessage(msg) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendNativeMessage(NATIVE_HOST, msg, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
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
    // Kill immediately
    try {
      await sendNativeMessage({ action: "kill", apps });
    } catch (err) {
      console.warn("[WebBlocker] Native host not available:", err.message);
    }
    // Set recurring alarm to re-kill every 5 seconds
    await chrome.alarms.create(APP_KILL_ALARM, { periodInMinutes: 5 / 60 });
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

  // Rebuild website rules
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

  // Update app kill alarm
  if (apps.length > 0) {
    try { await sendNativeMessage({ action: "kill", apps }); } catch (_) {}
    await chrome.alarms.create(APP_KILL_ALARM, { periodInMinutes: 5 / 60 });
  } else {
    await chrome.alarms.clear(APP_KILL_ALARM);
  }

  await chrome.storage.local.set({ sites, apps });
}

// -- Stop blocking --
async function stopBlocking() {
  console.log("[WebBlocker] Stopping all blocks");

  // Clear website rules
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const existingIds = existing.map((r) => r.id);
  if (existingIds.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: existingIds });
  }

  // Clear all alarms
  await chrome.alarms.clear(ALARM_NAME);
  await chrome.alarms.clear(APP_KILL_ALARM);

  // Update state
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
