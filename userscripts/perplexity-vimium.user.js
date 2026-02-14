// ==UserScript==
// @name         Perplexity Vimium
// @namespace    perplexity-vimium
// @version      1.1
// @description  Vimium C-style keyboard navigation for perplexity.ai
// @match        https://www.perplexity.ai/*
// @match        https://perplexity.ai/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  "use strict";

  // ── Config ──────────────────────────────────────────────
  const HINT_CHARS = "asdfghjkl";
  const SCROLL_STEP = 60;
  const SCROLL_HALF_PAGE = 0.45;

  // ── State ───────────────────────────────────────────────
  let mode = "normal"; // normal | hints | insert
  let hintLabels = [];
  let hintInput = "";
  let pendingG = false;
  let statusEl = null;
  let styleInjected = false;

  // ── Inject styles (deferred until DOM exists) ───────────
  function injectStyles() {
    if (styleInjected) return;
    const target = document.head || document.documentElement;
    if (!target) return;
    const style = document.createElement("style");
    style.textContent = `
      .pv-hint {
        position: absolute;
        z-index: 2147483647;
        background: #f2c800;
        color: #000;
        font: bold 11px/14px monospace;
        padding: 1px 4px;
        border-radius: 3px;
        border: 1px solid #c89f00;
        box-shadow: 0 1px 3px rgba(0,0,0,.3);
        pointer-events: none;
      }
      .pv-hint-matched {
        color: #999;
      }
      #pv-status {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: 24px;
        background: #1a1a1a;
        color: #aaa;
        font: 12px/24px monospace;
        padding: 0 10px;
        z-index: 2147483647;
        border-top: 1px solid #333;
      }
    `;
    target.appendChild(style);
    styleInjected = true;
  }

  // ── Status bar ──────────────────────────────────────────
  function createStatusBar() {
    if (!document.body) return;
    statusEl = document.createElement("div");
    statusEl.id = "pv-status";
    statusEl.style.display = "none";
    document.body.appendChild(statusEl);
  }

  function showStatus(text) {
    if (!document.body) return;
    if (!statusEl) createStatusBar();
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.style.display = "block";
  }

  function hideStatus() {
    if (statusEl) statusEl.style.display = "none";
  }

  // ── Detect if focus is in an input ──────────────────────
  function isInputFocused() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if (el.isContentEditable) return true;
    // Perplexity uses contenteditable divs and nested elements
    if (el.closest && el.closest('[contenteditable="true"]')) return true;
    // Check shadow DOM
    if (el.shadowRoot && el.shadowRoot.activeElement) {
      const inner = el.shadowRoot.activeElement;
      const itag = inner.tagName;
      if (itag === "INPUT" || itag === "TEXTAREA" || itag === "SELECT") return true;
      if (inner.isContentEditable) return true;
    }
    return false;
  }

  // ── Shadow DOM traversal ────────────────────────────────
  function querySelectorAllDeep(selector, root = document) {
    const results = [];
    const collect = (node) => {
      if (node.querySelectorAll) {
        results.push(...node.querySelectorAll(selector));
      }
      if (node.shadowRoot) collect(node.shadowRoot);
      const children = node.querySelectorAll ? node.querySelectorAll("*") : [];
      for (const child of children) {
        if (child.shadowRoot) collect(child.shadowRoot);
      }
    };
    collect(root);
    return results;
  }

  // ── Find clickable elements ─────────────────────────────
  function getClickableElements() {
    const selectors =
      'a[href], button, input:not([type="hidden"]), textarea, select, ' +
      '[role="button"], [role="link"], [role="tab"], [role="menuitem"], ' +
      '[role="option"], [onclick], [tabindex]:not([tabindex="-1"]), ' +
      "summary, details, label[for]";

    const elements = querySelectorAllDeep(selectors);
    return elements.filter((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      if (rect.bottom < 0 || rect.top > window.innerHeight) return false;
      if (rect.right < 0 || rect.left > window.innerWidth) return false;
      const cs = window.getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") return false;
      if (parseFloat(cs.opacity) === 0) return false;
      return true;
    });
  }

  // ── Generate hint strings ───────────────────────────────
  function generateHints(count) {
    const chars = HINT_CHARS;
    const hints = [];
    if (count <= chars.length) {
      for (let i = 0; i < count; i++) hints.push(chars[i]);
      return hints;
    }
    const len = Math.ceil(Math.log(count) / Math.log(chars.length));
    function gen(prefix, depth) {
      if (hints.length >= count) return;
      if (depth === 0) { hints.push(prefix); return; }
      for (let i = 0; i < chars.length; i++) {
        if (hints.length >= count) return;
        gen(prefix + chars[i], depth - 1);
      }
    }
    gen("", len);
    return hints.slice(0, count);
  }

  // ── Hints ───────────────────────────────────────────────
  function activateHints() {
    injectStyles();
    removeHints();
    const elements = getClickableElements();
    if (elements.length === 0) return;
    const hints = generateHints(elements.length);

    elements.forEach((el, i) => {
      const rect = el.getBoundingClientRect();
      const label = document.createElement("span");
      label.className = "pv-hint";
      label.textContent = hints[i].toUpperCase();
      label.dataset.hint = hints[i];
      label.style.left = (rect.left + window.scrollX) + "px";
      label.style.top = (rect.top + window.scrollY) + "px";
      document.body.appendChild(label);
      hintLabels.push({ label, element: el, hint: hints[i] });
    });

    mode = "hints";
    hintInput = "";
    showStatus("Hints: type to select");
  }

  function filterHints() {
    let remaining = 0;
    let lastMatch = null;
    hintLabels.forEach(({ label, element, hint }) => {
      if (hint.startsWith(hintInput)) {
        label.style.display = "";
        const matched = hintInput.toUpperCase();
        const rest = hint.slice(hintInput.length).toUpperCase();
        label.innerHTML = '<span class="pv-hint-matched">' + matched + "</span>" + rest;
        remaining++;
        lastMatch = element;
      } else {
        label.style.display = "none";
      }
    });
    if (remaining === 1 && lastMatch) {
      clickElement(lastMatch);
      exitHints();
    } else if (remaining === 0) {
      exitHints();
    } else {
      showStatus("Hints: " + hintInput);
    }
  }

  function clickElement(el) {
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable) {
      el.focus();
      mode = "insert";
      showStatus("-- INSERT --");
      return;
    }
    el.click();
  }

  function removeHints() {
    hintLabels.forEach(({ label }) => label.remove());
    hintLabels = [];
    hintInput = "";
  }

  function exitHints() {
    removeHints();
    mode = "normal";
    hideStatus();
  }

  // ── Scroll ──────────────────────────────────────────────
  function getScrollTarget() {
    return document.querySelector(".scrollable-container") ||
           document.scrollingElement ||
           document.documentElement;
  }

  function doScroll(amount) {
    getScrollTarget().scrollBy({ top: amount, behavior: "auto" });
  }

  function scrollToTop() {
    getScrollTarget().scrollTo({ top: 0 });
  }

  function scrollToBottom() {
    const t = getScrollTarget();
    t.scrollTo({ top: t.scrollHeight });
  }

  // ── Blur any focused input to enter normal mode ─────────
  function enterNormalMode() {
    const el = document.activeElement;
    if (el && el !== document.body) el.blur();
    mode = "normal";
    hideStatus();
  }

  // ── Key handler (capture phase — fires FIRST) ──────────
  function handleKey(e) {
    // Ignore modifier combos (Ctrl+C, Cmd+V, etc.)
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const key = e.key;

    // ── Escape always returns to normal ──
    if (key === "Escape") {
      if (mode === "hints") exitHints();
      enterNormalMode();
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }

    // ── Insert mode or input focused: pass keys through ──
    if (mode === "insert" || isInputFocused()) {
      return; // don't intercept
    }

    // ── Hint mode ──
    if (mode === "hints") {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (HINT_CHARS.includes(key.toLowerCase())) {
        hintInput += key.toLowerCase();
        filterHints();
      } else {
        exitHints();
      }
      return;
    }

    // ── Normal mode ──

    // gg combo
    if (pendingG) {
      pendingG = false;
      hideStatus();
      if (key === "g") {
        e.preventDefault();
        e.stopImmediatePropagation();
        scrollToTop();
      }
      return;
    }

    // Navigation keys
    const NAV_KEYS = ["j","k","d","u","f","g","G","H","L","/","y","i"];
    if (!NAV_KEYS.includes(key)) return; // let other keys through

    e.preventDefault();
    e.stopImmediatePropagation();

    switch (key) {
      case "j": doScroll(SCROLL_STEP); break;
      case "k": doScroll(-SCROLL_STEP); break;
      case "d": doScroll(window.innerHeight * SCROLL_HALF_PAGE); break;
      case "u": doScroll(-window.innerHeight * SCROLL_HALF_PAGE); break;
      case "G": scrollToBottom(); break;
      case "g":
        pendingG = true;
        showStatus("g...");
        setTimeout(() => { if (pendingG) { pendingG = false; hideStatus(); } }, 1000);
        break;
      case "f":
        activateHints();
        break;
      case "H": history.back(); break;
      case "L": history.forward(); break;
      case "/": {
        const searchInput = querySelectorAllDeep('textarea, input[type="text"]')
          .find((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
        if (searchInput) { searchInput.focus(); mode = "insert"; showStatus("-- INSERT --"); }
        break;
      }
      case "y":
        navigator.clipboard.writeText(window.location.href)
          .then(() => { showStatus("URL copied"); setTimeout(hideStatus, 1500); })
          .catch(() => {});
        break;
      case "i":
        mode = "insert";
        showStatus("-- INSERT --");
        break;
    }
  }

  // ── Register at capture phase on BOTH document and window ──
  // document-start means we register BEFORE Perplexity's scripts load
  document.addEventListener("keydown", handleKey, true);
  window.addEventListener("keydown", handleKey, true);

  // ── Auto-blur Perplexity's auto-focused search input ────
  // Perplexity focuses the search textarea on load — blur it so
  // we start in normal mode. Wait for DOM to be ready.
  function autoblurSearch() {
    const el = document.activeElement;
    if (el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT")) {
      el.blur();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      injectStyles();
      // Slight delay since Perplexity focuses after DOMContentLoaded
      setTimeout(autoblurSearch, 500);
      setTimeout(autoblurSearch, 1500);
    });
  } else {
    injectStyles();
    setTimeout(autoblurSearch, 500);
  }

  console.log("[Perplexity Vimium] v1.1 loaded — Escape to enter normal mode, f for hints, j/k to scroll");
})();
