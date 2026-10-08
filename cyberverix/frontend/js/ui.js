/* ==========================================================================
   CyberVeriX - UI helpers
   Escaping, formatting, toasts, loading and empty states.
   ========================================================================== */
(function (global) {
  "use strict";

  var LEVEL_TONE = {
    "Advanced": "pass", "Strong": "pass", "Intermediate": "warn",
    "Developing": "warn", "Beginner": "fail", "Not assessed": ""
  };

  /* All dynamic text passes through esc() before it reaches innerHTML. */
  function esc(value) {
    if (value === null || value === undefined) { return ""; }
    return String(value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function attr(value) { return esc(value); }

  function pct(value) {
    if (value === null || value === undefined) { return "--"; }
    return (Math.round(value * 10) / 10) + "%";
  }

  function num(value) {
    if (value === null || value === undefined) { return "--"; }
    return String(Math.round(value * 10) / 10).replace(/\.0$/, "");
  }

  function tone(percent) {
    if (percent === null || percent === undefined) { return ""; }
    if (percent >= 75) { return "pass"; }
    if (percent >= 50) { return "warn"; }
    return "fail";
  }

  function levelTone(level) { return LEVEL_TONE[level] === undefined ? "" : LEVEL_TONE[level]; }

  function date(seconds) {
    if (!seconds) { return "--"; }
    var d = new Date(seconds * 1000);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function dateTime(seconds) {
    if (!seconds) { return "--"; }
    var d = new Date(seconds * 1000);
    return d.toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
    });
  }

  function initials(name) {
    var parts = String(name || "S").trim().split(/\s+/);
    var first = parts[0] ? parts[0][0] : "S";
    var last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase();
  }

  function words(text) {
    var trimmed = String(text || "").trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }

  function toast(message, kind) {
    var host = document.getElementById("toasts");
    if (!host) { return; }
    var node = document.createElement("div");
    node.className = "toast" + (kind ? " toast--" + kind : "");
    node.textContent = message;
    host.appendChild(node);
    global.setTimeout(function () {
      node.style.transition = "opacity 200ms ease-in, transform 200ms ease-in";
      node.style.opacity = "0";
      node.style.transform = "translateY(6px)";
      global.setTimeout(function () { node.remove(); }, 220);
    }, kind === "error" ? 5200 : 3600);
  }

  function skeleton(rows) {
    var out = ['<div class="view"><div class="skeleton" aria-busy="true" aria-label="Loading">'];
    out.push('<div class="skeleton__bar" style="width:34%"></div>');
    out.push('<div class="skeleton__block"></div>');
    for (var i = 0; i < (rows || 3); i += 1) {
      out.push('<div class="skeleton__bar" style="width:' + (92 - i * 13) + '%"></div>');
    }
    out.push("</div></div>");
    return out.join("");
  }

  function errorState(message, retryLabel) {
    return '<div class="view"><div class="empty">' +
      '<h3>Something went wrong</h3>' +
      '<p>' + esc(message) + '</p>' +
      '<button class="btn btn--ghost" data-action="retry">' + esc(retryLabel || "Try again") + '</button>' +
      '</div></div>';
  }

  function pill(text, kind) {
    return '<span class="pill' + (kind ? " pill--" + kind : "") + '">' + esc(text) + '</span>';
  }

  function verdictMarker(verdict) {
    if (verdict === "correct") { return '<span class="marker marker--pass" aria-hidden="true">&#10003;</span>'; }
    if (verdict === "partial") { return '<span class="marker marker--warn" aria-hidden="true">&#8226;</span>'; }
    return '<span class="marker marker--fail" aria-hidden="true">&times;</span>';
  }

  function verdictLabel(verdict) {
    if (verdict === "correct") { return "Correct"; }
    if (verdict === "partial") { return "Partly correct"; }
    return "Incorrect";
  }

  global.CVX = global.CVX || {};
  global.CVX.ui = {
    esc: esc, attr: attr, pct: pct, num: num, tone: tone, levelTone: levelTone,
    date: date, dateTime: dateTime, initials: initials, words: words,
    toast: toast, skeleton: skeleton, errorState: errorState, pill: pill,
    verdictMarker: verdictMarker, verdictLabel: verdictLabel
  };
})(window);
