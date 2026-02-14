const DURATION_STEPS = [5, 10, 15, 20, 25, 30, 45, 60, 90, 120];

const siteInput = document.getElementById("site-input");
const addSiteBtn = document.getElementById("add-site-btn");
const siteList = document.getElementById("site-list");
const appInput = document.getElementById("app-input");
const addAppBtn = document.getElementById("add-app-btn");
const appList = document.getElementById("app-list");
const slider = document.getElementById("duration-slider");
const durationLabel = document.getElementById("duration-label");
const toggleBtn = document.getElementById("toggle-btn");
const timerEl = document.getElementById("timer");
const timeRemaining = document.getElementById("time-remaining");

let sites = [];
let apps = [];
let blocking = false;
let endTime = null;
let countdownInterval = null;

// -- Tabs --
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("panel-" + tab.dataset.tab).classList.add("active");
  });
});

// -- Init --
document.addEventListener("DOMContentLoaded", async () => {
  const state = await sendMessage({ action: "getState" });
  if (state) {
    sites = state.sites || [];
    apps = state.apps || [];
    blocking = state.blocking || false;
    endTime = state.endTime || null;
  }
  renderSites();
  renderApps();
  updateUI();
  if (blocking && endTime) startCountdown();
});

// -- Add site --
addSiteBtn.addEventListener("click", addSite);
siteInput.addEventListener("keydown", (e) => { if (e.key === "Enter") addSite(); });

async function addSite() {
  let domain = siteInput.value.trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
  if (!domain || sites.includes(domain)) return;
  sites.push(domain);
  chrome.storage.local.set({ sites });
  siteInput.value = "";
  renderSites();
  updateUI();
  if (blocking) await sendMessage({ action: "updateLists", sites, apps });
}

// -- Add app --
addAppBtn.addEventListener("click", addApp);
appInput.addEventListener("keydown", (e) => { if (e.key === "Enter") addApp(); });

async function addApp() {
  let name = appInput.value.trim();
  if (!name || apps.includes(name)) return;
  apps.push(name);
  chrome.storage.local.set({ apps });
  appInput.value = "";
  renderApps();
  updateUI();
  if (blocking) await sendMessage({ action: "updateLists", sites, apps });
}

// -- Render lists --
function renderSites() {
  siteList.innerHTML = "";
  sites.forEach((site, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${site}</span><button class="remove" data-index="${i}">&times;</button>`;
    siteList.appendChild(li);
  });
  siteList.querySelectorAll(".remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      sites.splice(parseInt(btn.dataset.index), 1);
      chrome.storage.local.set({ sites });
      renderSites();
      updateUI();
    });
  });
}

function renderApps() {
  appList.innerHTML = "";
  apps.forEach((app, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${app}</span><button class="remove" data-index="${i}">&times;</button>`;
    appList.appendChild(li);
  });
  appList.querySelectorAll(".remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      apps.splice(parseInt(btn.dataset.index), 1);
      chrome.storage.local.set({ apps });
      renderApps();
      updateUI();
    });
  });
}

// -- Slider --
slider.addEventListener("input", () => {
  durationLabel.textContent = DURATION_STEPS[slider.value] + " min";
});
durationLabel.textContent = DURATION_STEPS[slider.value] + " min";

// -- Toggle blocking --
toggleBtn.addEventListener("click", async () => {
  if (blocking) {
    await sendMessage({ action: "stopBlocking" });
    blocking = false;
    endTime = null;
    clearInterval(countdownInterval);
  } else {
    if (sites.length === 0 && apps.length === 0) return;
    const duration = DURATION_STEPS[slider.value];
    await sendMessage({ action: "startBlocking", sites, apps, duration });
    blocking = true;
    endTime = Date.now() + duration * 60 * 1000;
    startCountdown();
  }
  updateUI();
});

// -- UI state --
function updateUI() {
  const hasItems = sites.length > 0 || apps.length > 0;
  if (blocking) {
    toggleBtn.textContent = "Stop Blocking";
    toggleBtn.classList.add("active");
    toggleBtn.disabled = false;
    timerEl.classList.remove("hidden");
    slider.disabled = true;
  } else {
    toggleBtn.textContent = "Start Blocking";
    toggleBtn.classList.remove("active");
    toggleBtn.disabled = !hasItems;
    timerEl.classList.add("hidden");
    slider.disabled = false;
    addSiteBtn.disabled = false;
    siteInput.disabled = false;
    addAppBtn.disabled = false;
    appInput.disabled = false;
  }
}

// -- Countdown --
function startCountdown() {
  updateCountdown();
  countdownInterval = setInterval(updateCountdown, 1000);
}

function updateCountdown() {
  if (!endTime) return;
  const remaining = Math.max(0, endTime - Date.now());
  if (remaining <= 0) {
    blocking = false;
    endTime = null;
    clearInterval(countdownInterval);
    updateUI();
    return;
  }
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  timeRemaining.textContent =
    String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
}

// -- Messaging --
function sendMessage(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (response) => {
      if (chrome.runtime.lastError) {
        console.error("[WebBlocker] sendMessage error:", chrome.runtime.lastError.message);
        resolve(null);
        return;
      }
      resolve(response);
    });
  });
}
