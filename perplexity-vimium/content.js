console.log("[PV] content script injected");

document.addEventListener("keydown", function (e) {
  // Let modifier combos through (Cmd+J, Cmd+K, etc.)
  if (e.metaKey || e.ctrlKey || e.altKey) return;

  // Let input fields handle their own keys
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
    e.preventDefault();
    e.stopImmediatePropagation();
    sc.scrollBy({ top: 60 });
  } else if (e.key === "k") {
    e.preventDefault();
    e.stopImmediatePropagation();
    sc.scrollBy({ top: -60 });
  } else if (e.key === "d") {
    e.preventDefault();
    e.stopImmediatePropagation();
    sc.scrollBy({ top: window.innerHeight * 0.45 });
  } else if (e.key === "u") {
    e.preventDefault();
    e.stopImmediatePropagation();
    sc.scrollBy({ top: -window.innerHeight * 0.45 });
  } else if (e.key === "G") {
    e.preventDefault();
    e.stopImmediatePropagation();
    sc.scrollTo({ top: sc.scrollHeight });
  } else if (e.key === "H") {
    e.preventDefault();
    e.stopImmediatePropagation();
    history.back();
  } else if (e.key === "L") {
    e.preventDefault();
    e.stopImmediatePropagation();
    history.forward();
  }
}, true);

console.log("[PV] keydown listener registered");
