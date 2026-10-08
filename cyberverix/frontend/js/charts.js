/* ==========================================================================
   CyberVeriX - charts
   Hand rolled SVG: no chart library, nothing to install, prints cleanly.
   ========================================================================== */
(function (global) {
  "use strict";

  var esc = global.CVX.ui.esc;

  function polar(cx, cy, radius, index, total) {
    var angle = (Math.PI * 2 * index) / total - Math.PI / 2;
    return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  }

  /* Radar over the six skill categories. Unassessed categories read as 0
     but are labelled so an empty profile is not mistaken for a bad one. */
  function radar(categories) {
    var w = 440, h = 372, cx = 220, cy = 182, r = 104;
    var total = categories.length || 1;
    var rings = [0.25, 0.5, 0.75, 1];
    var svg = ['<svg class="radar" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Skill category radar">'];

    rings.forEach(function (ratio) {
      var pts = [];
      for (var i = 0; i < total; i += 1) {
        var p = polar(cx, cy, r * ratio, i, total);
        pts.push(p.x.toFixed(1) + "," + p.y.toFixed(1));
      }
      svg.push('<polygon points="' + pts.join(" ") + '" fill="none" stroke="oklch(88% 0.012 82)" stroke-width="1"></polygon>');
    });

    for (var i = 0; i < total; i += 1) {
      var edge = polar(cx, cy, r, i, total);
      svg.push('<line x1="' + cx + '" y1="' + cy + '" x2="' + edge.x.toFixed(1) + '" y2="' + edge.y.toFixed(1) +
        '" stroke="oklch(88% 0.012 82)" stroke-width="1"></line>');
    }

    var shape = [];
    categories.forEach(function (cat, idx) {
      var value = Math.max(0, Math.min(100, cat.percent || 0)) / 100;
      var p = polar(cx, cy, r * value, idx, total);
      shape.push(p.x.toFixed(1) + "," + p.y.toFixed(1));
    });
    svg.push('<polygon points="' + shape.join(" ") + '" fill="oklch(43% 0.152 300 / 0.16)" stroke="oklch(43% 0.152 300)" stroke-width="2" stroke-linejoin="round"></polygon>');

    categories.forEach(function (cat, idx) {
      var value = Math.max(0, Math.min(100, cat.percent || 0)) / 100;
      var p = polar(cx, cy, r * value, idx, total);
      svg.push('<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="3.5" fill="' +
        (cat.assessed ? "oklch(43% 0.152 300)" : "oklch(75% 0.02 300)") + '"></circle>');

      var label = polar(cx, cy, r + 30, idx, total);
      var anchor = "middle";
      if (label.x > cx + 8) { anchor = "start"; }
      if (label.x < cx - 8) { anchor = "end"; }
      var short = cat.name.replace("Cybersecurity ", "").replace(" & Log Analysis", " / Logs");
      svg.push('<text x="' + label.x.toFixed(1) + '" y="' + (label.y + 4).toFixed(1) + '" text-anchor="' + anchor + '">' +
        esc(short) + '</text>');
      svg.push('<text x="' + label.x.toFixed(1) + '" y="' + (label.y + 17).toFixed(1) + '" text-anchor="' + anchor +
        '" style="font-weight:700;fill:' + (cat.assessed ? "oklch(23% 0.028 300)" : "oklch(65% 0.018 300)") + '">' +
        (cat.assessed ? Math.round(cat.percent) + "%" : "n/a") + '</text>');
    });

    svg.push("</svg>");
    return svg.join("");
  }

  /* Score donut used on the results page. */
  function donut(percent, label) {
    var value = Math.max(0, Math.min(100, percent || 0));
    var r = 52, c = 2 * Math.PI * r;
    var colour = value >= 75 ? "oklch(48% 0.118 155)" : (value >= 50 ? "oklch(70% 0.145 66)" : "oklch(50% 0.17 24)");
    return '<svg class="donut" viewBox="0 0 132 132" role="img" aria-label="Score ' + Math.round(value) + ' percent">' +
      '<circle cx="66" cy="66" r="' + r + '" fill="none" stroke="oklch(94.6% 0.011 82)" stroke-width="12"></circle>' +
      '<circle cx="66" cy="66" r="' + r + '" fill="none" stroke="' + colour + '" stroke-width="12" stroke-linecap="round"' +
      ' stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + (c * (1 - value / 100)).toFixed(1) + '"' +
      ' transform="rotate(-90 66 66)"></circle>' +
      '<text x="66" y="64" text-anchor="middle" style="font:700 26px var(--sans);fill:oklch(23% 0.028 300)">' +
      Math.round(value) + '%</text>' +
      '<text x="66" y="82" text-anchor="middle" style="font:600 10px var(--sans);letter-spacing:.08em;fill:oklch(60% 0.018 300)">' +
      esc((label || "").toUpperCase()) + '</text>' +
      '</svg>';
  }

  /* Half gauge used on the career readiness page. */
  function gauge(percent) {
    var value = Math.max(0, Math.min(100, percent || 0));
    var start = Math.PI, end = Math.PI + (Math.PI * value) / 100;
    var cx = 95, cy = 96, r = 74;
    function pt(angle) { return (cx + r * Math.cos(angle)).toFixed(1) + " " + (cy + r * Math.sin(angle)).toFixed(1); }
    var large = value > 50 ? 0 : 0;
    return '<svg class="gauge" viewBox="0 0 190 110" role="img" aria-label="Readiness score ' + Math.round(value) + ' of 100">' +
      '<path d="M ' + pt(Math.PI) + ' A ' + r + ' ' + r + ' 0 0 1 ' + pt(2 * Math.PI) + '" fill="none" stroke="oklch(94.6% 0.011 82)" stroke-width="14" stroke-linecap="round"></path>' +
      '<path d="M ' + pt(start) + ' A ' + r + ' ' + r + ' 0 ' + large + ' 1 ' + pt(end) + '" fill="none" stroke="oklch(43% 0.152 300)" stroke-width="14" stroke-linecap="round"></path>' +
      '<text x="95" y="90" text-anchor="middle" style="font:700 30px var(--serif);fill:oklch(23% 0.028 300)">' + Math.round(value) + '</text>' +
      '</svg>';
  }

  /* Level ruler: shows where a score sits inside the five level bands. */
  function ruler(percent) {
    var value = Math.max(0, Math.min(100, percent || 0));
    return '<div class="ruler">' +
      '<div class="ruler__scale"><div class="ruler__marker" style="left:' + value.toFixed(1) + '%">' +
      '<b>' + (Math.round(value * 10) / 10) + '</b><i></i></div></div>' +
      '<div class="ruler__bands" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>' +
      '<div class="ruler__labels" aria-hidden="true">' +
      '<span>Beginner</span><span>Developing</span><span>Intermediate</span><span>Strong</span><span>Advanced</span>' +
      '</div></div>';
  }

  global.CVX.charts = { radar: radar, donut: donut, gauge: gauge, ruler: ruler };
})(window);
