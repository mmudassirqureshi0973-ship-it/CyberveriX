/* ==========================================================================
   CyberVeriX - router and shell
   Hash based routing, session guards, navigation state, global error handling.
   ========================================================================== */
(function (global) {
  "use strict";

  var ui = global.CVX.ui;
  var api = global.CVX.api;
  var views = global.CVX.views;

  var appShell = document.getElementById("app-shell");
  var publicShell = document.getElementById("public-shell");
  var appMain = document.getElementById("main");
  var publicMain = document.getElementById("public-main");
  var sidenav = document.getElementById("sidenav");
  var navToggle = document.getElementById("nav-toggle");

  var ROUTES = {
    "": { view: "landing", access: "public" },
    "/": { view: "landing", access: "public" },
    "/login": { view: "login", access: "public" },
    "/register": { view: "register", access: "public" },
    "/dashboard": { view: "dashboard", access: "private", nav: "dashboard", title: "Dashboard" },
    "/challenges": { view: "library", access: "private", nav: "challenges", title: "Challenges" },
    "/profile": { view: "profile", access: "private", nav: "profile", title: "Skill profile" },
    "/readiness": { view: "readiness", access: "private", nav: "readiness", title: "Career readiness" },
    "/report": { view: "report", access: "private", nav: "report", title: "Report" }
  };

  var current = null;

  function parseHash() {
    var raw = global.location.hash.replace(/^#/, "");
    var path = raw.split("?")[0];
    if (path === "") { path = "/"; }

    var challenge = path.match(/^\/challenge\/([A-Za-z0-9_\-]+)$/);
    if (challenge) {
      return { key: "/challenge", route: { view: "challenge", access: "private", nav: "challenges", title: "Challenge" }, params: { id: challenge[1] } };
    }
    var result = path.match(/^\/result\/(\d+)$/);
    if (result) {
      return { key: "/result", route: { view: "results", access: "private", nav: "challenges", title: "Result" }, params: { id: result[1] } };
    }
    var route = ROUTES[path];
    if (!route) { return { key: path, route: null, params: {} }; }
    return { key: path, route: route, params: {} };
  }

  function go(hash) {
    if (global.location.hash === hash) { render(); } else { global.location.hash = hash; }
  }

  function setShell(mode) {
    appShell.hidden = mode !== "app";
    publicShell.hidden = mode !== "public";
  }

  function closeNav() {
    sidenav.setAttribute("data-open", "false");
    navToggle.setAttribute("aria-expanded", "false");
  }

  function markNav(key) {
    Array.prototype.forEach.call(document.querySelectorAll(".sidenav__list a"), function (link) {
      if (link.getAttribute("data-route") === key) { link.setAttribute("aria-current", "page"); }
      else { link.removeAttribute("aria-current"); }
    });
  }

  function paintUser() {
    var user = api.cachedUser();
    if (!user) { return; }
    document.getElementById("nav-name").textContent = user.full_name;
    document.getElementById("nav-email").textContent = user.email;
    document.getElementById("nav-avatar").textContent = ui.initials(user.full_name);
  }

  function updateScore(score, level) {
    var host = document.getElementById("topbar-score");
    if (!host) { return; }
    if (score === null || score === undefined) { host.textContent = ""; return; }
    host.textContent = ui.num(score) + "/100 \u00b7 " + (level || "");
  }

  function notFound(target) {
    target.innerHTML = '<div class="view"><div class="empty">' +
      '<span class="eyebrow">404</span>' +
      '<h3>That page does not exist</h3>' +
      '<p>The link may be out of date. Everything is reachable from the dashboard.</p>' +
      '<a class="btn" href="#/dashboard">Go to dashboard</a></div></div>';
  }

  function handleError(target, err, retry) {
    if (err && err.status === 401) {
      api.clearSession();
      ui.toast("Session expired. Please sign in again.", "error");
      go("#/login");
      return;
    }
    target.innerHTML = ui.errorState((err && err.message) || "Unexpected error.");
    var button = target.querySelector('[data-action="retry"]');
    if (button) { button.addEventListener("click", retry); }
  }

  function render() {
    var parsed = parseHash();
    var route = parsed.route;
    var signedIn = Boolean(api.getToken());

    if (!route) {
      setShell(signedIn ? "app" : "public");
      notFound(signedIn ? appMain : publicMain);
      return;
    }
    if (route.access === "private" && !signedIn) {
      ui.toast("Sign in to continue.", "");
      go("#/login");
      return;
    }
    if (route.access === "public" && signedIn && (parsed.key === "/login" || parsed.key === "/register")) {
      go("#/dashboard");
      return;
    }

    var isApp = route.access === "private";
    setShell(isApp ? "app" : "public");
    var target = isApp ? appMain : publicMain;
    closeNav();
    if (isApp) { paintUser(); markNav(route.nav); }

    document.title = (route.title ? route.title + " \u00b7 " : "") + "CyberVeriX";
    current = parsed;

    var runner = views[route.view];
    if (!runner) { notFound(target); return; }

    Promise.resolve()
      .then(function () { return runner(target, parsed.params); })
      .then(function () {
        if (isApp) { global.scrollTo({ top: 0, behavior: "auto" }); }
        target.focus({ preventScroll: true });
      })
      .catch(function (err) {
        handleError(target, err, function () { render(); });
      });
  }

  /* --------------------------------------------------------------- listeners */
  global.addEventListener("hashchange", render);

  navToggle.addEventListener("click", function () {
    var open = sidenav.getAttribute("data-open") === "true";
    sidenav.setAttribute("data-open", String(!open));
    navToggle.setAttribute("aria-expanded", String(!open));
  });

  document.addEventListener("click", function (event) {
    if (sidenav.getAttribute("data-open") !== "true") { return; }
    if (sidenav.contains(event.target) || navToggle.contains(event.target)) { return; }
    closeNav();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") { closeNav(); }
  });

  document.getElementById("logout-btn").addEventListener("click", function () {
    api.logout().catch(function () { /* token may already be gone */ }).then(function () {
      api.clearSession();
      updateScore(null);
      ui.toast("Signed out.", "");
      go("#/");
    });
  });

  /* Keep the header score in sync whenever a view loads profile data. */
  var originalProfile = api.profile;
  api.profile = function () {
    return originalProfile().then(function (data) {
      updateScore(data.profile.overall_score, data.profile.overall_level);
      if (data.profile.user) { api.setSession(null, data.profile.user); }
      return data;
    });
  };
  var originalAttempt = api.attempt;
  api.attempt = function (id) {
    return originalAttempt(id).then(function (data) {
      updateScore(data.overall_score, data.overall_level);
      return data;
    });
  };

  global.CVX.app = { go: go, render: render, updateScore: updateScore };

  /* Boot. If a stale token is in storage, verify it before rendering. */
  function boot() {
    if (!api.getToken()) { render(); return; }
    api.me().then(function (data) {
      api.setSession(null, data.user);
      render();
    }).catch(function (err) {
      if (err.status === 401) { api.clearSession(); }
      render();
    });
  }

  boot();
})(window);
