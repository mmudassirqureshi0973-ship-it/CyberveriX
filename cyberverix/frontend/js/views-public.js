/* ==========================================================================
   CyberVeriX - public views: landing, sign in, register
   ========================================================================== */
(function (global) {
  "use strict";

  var ui = global.CVX.ui;
  var api = global.CVX.api;
  var esc = ui.esc;

  var SAMPLE = [
    { name: "SOC & Log Analysis", value: 82 },
    { name: "Cybersecurity Fundamentals", value: 88 },
    { name: "Network Security", value: 78 },
    { name: "Web Security", value: 65 },
    { name: "Windows Security", value: 70 }
  ];

  var FLOW = [
    "Pick a skill", "Read the scenario", "Analyse the evidence", "Submit your answer",
    "Automatic scoring", "Feedback and correct concept", "Profile updates", "Readiness report"
  ];

  var CATEGORIES = [
    ["Network Security", "Scan output, exposed services, hardening calls"],
    ["Web Security", "Scanner findings, headers, cookies, access control"],
    ["SOC & Log Analysis", "Alert triage, classification, escalation order"],
    ["Windows Security", "Event IDs, Sysmon, process ancestry"],
    ["Incident Analysis", "Severity, containment order, evidence handling"],
    ["Fundamentals", "CIA, threat vs risk, control types"]
  ];

  function landing(container) {
    var bars = SAMPLE.map(function (row) {
      return '<div class="samplebar__row">' +
        '<div class="samplebar__meta"><span>' + esc(row.name) + '</span><b>' + row.value + '%</b></div>' +
        '<div class="samplebar__track"><div class="samplebar__fill" style="width:' + row.value + '%"></div></div>' +
        '</div>';
    }).join("");

    var features = [
      ["01", "Practical, not recall", "Every challenge hands you real artefacts: scan output, an intercepted request, an event log. You interpret them, the platform scores the interpretation."],
      ["02", "Transparent scoring", "Full marks, partial marks, zero. Written answers score per concept, so you can see exactly which idea you missed and why."],
      ["03", "Evidence backed feedback", "Each result names what you got right, what needs work, the correct concept and the next step. No black box, no AI service required."],
      ["04", "Safe by design", "Simulated lab evidence only. Nothing scans, connects to, or attacks a real system, and no submitted text is ever executed."]
    ].map(function (f) {
      return '<li><span class="num">' + f[0] + '</span><h3>' + esc(f[1]) + '</h3><p>' + esc(f[2]) + '</p></li>';
    }).join("");

    container.innerHTML = '' +
      '<div class="public">' +
        '<nav class="public-nav">' +
          '<a class="brand" href="#/"><span class="brand__mark" aria-hidden="true">CV</span>' +
          '<span><span class="brand__name">CyberVeriX</span>' +
          '<span class="brand__sub">Skill verification</span></span></a>' +
          '<div class="row">' +
            '<a class="btn btn--ghost btn--sm" href="#/login">Sign in</a>' +
            '<a class="btn btn--sm" href="#/register">Create account</a>' +
          '</div>' +
        '</nav>' +

        '<section class="hero">' +
          '<div class="hero__claim">' +
            '<span class="eyebrow">Practical skill verification &middot; academic project</span>' +
            '<h1>A certificate says you attended. This says what you can actually do.</h1>' +
            '<p class="lede">CyberVeriX puts you in front of simulated scan output, intercepted requests and Windows event logs, then scores the analysis you produce. The result is a skill profile with evidence behind every number.</p>' +
            '<div class="row">' +
              '<a class="btn" href="#/register">Start the assessment</a>' +
              '<a class="btn btn--ghost" href="#/login">Use the demo account</a>' +
            '</div>' +
            '<p class="hero__note">Educational assessment built for a final year cybersecurity project. It is not a professional certification and does not replace one.</p>' +
          '</div>' +
          '<div class="hero__panel">' +
            '<span class="eyebrow">Sample skill profile</span>' +
            '<div class="samplebar">' + bars + '</div>' +
            '<p style="font-size:.8125rem;color:oklch(82% 0.03 300)">Overall 81 / 100 &middot; Strong &middot; Job-Ready Foundations</p>' +
          '</div>' +
        '</section>' +

        '<hr class="divider" style="margin:var(--s-8) 0">' +

        '<section class="stack">' +
          '<div class="section-head"><span class="eyebrow">How an assessment runs</span>' +
          '<h2>Eight steps, about twelve minutes each</h2></div>' +
          '<ul class="flow">' + FLOW.map(function (step, i) {
            return '<li><b class="mono" style="color:var(--signal)">' + (i + 1) + '</b> ' + esc(step) + '</li>';
          }).join("") + '</ul>' +
        '</section>' +

        '<section class="stack" style="margin-top:var(--s-8)">' +
          '<ul class="feature-list">' + features + '</ul>' +
        '</section>' +

        '<section class="stack" style="margin-top:var(--s-8)">' +
          '<div class="section-head"><span class="eyebrow">Six skill categories</span>' +
          '<h2>Scored separately, so strengths and gaps stay visible</h2></div>' +
          '<div class="cat-grid">' + CATEGORIES.map(function (c) {
            return '<div><h4>' + esc(c[0]) + '</h4><p>' + esc(c[1]) + '</p></div>';
          }).join("") + '</div>' +
        '</section>' +

        '<section class="panel" style="margin-top:var(--s-8);display:grid;gap:var(--s-4)">' +
          '<span class="eyebrow">Scoring bands</span>' +
          '<h2 style="font-size:var(--step-1)">0-39 Beginner &middot; 40-59 Developing &middot; 60-74 Intermediate &middot; 75-89 Strong &middot; 90-100 Advanced</h2>' +
          '<p class="prose" style="font-size:var(--step--1)">Your overall score is the points you earned divided by the points available across every challenge you submitted. Retries keep your best result. Career readiness stays locked until at least three challenges are complete, because a band from one challenge would be a guess.</p>' +
          '<div class="row"><a class="btn" href="#/register">Create your account</a>' +
          '<span class="muted" style="font-size:var(--step--1)">Demo login: student@cyberverix.local / Cyber@1234</span></div>' +
        '</section>' +
      '</div>';

    return Promise.resolve();
  }

  function authShell(mode) {
    var isRegister = mode === "register";
    return '' +
      '<div class="auth-wrap"><div class="auth-card">' +
        '<a class="brand" href="#/" style="justify-content:center"><span class="brand__mark" aria-hidden="true">CV</span>' +
        '<span class="brand__name">CyberVeriX</span></a>' +
        '<div class="panel">' +
          '<div class="section-head">' +
            '<span class="eyebrow">' + (isRegister ? "Create account" : "Sign in") + '</span>' +
            '<h1 style="font-size:var(--step-2)">' + (isRegister ? "Start your skill profile" : "Welcome back") + '</h1>' +
          '</div>' +
          '<div id="auth-alert"></div>' +
          '<form id="auth-form" novalidate>' +
            (isRegister ? '<div class="field" data-field="full_name"><label for="full_name">Full name</label>' +
              '<input id="full_name" name="full_name" autocomplete="name" required></div>' : "") +
            '<div class="field" data-field="email"><label for="email">Email</label>' +
            '<input id="email" name="email" type="email" autocomplete="email" required></div>' +
            '<div class="field" data-field="password"><label for="password">Password</label>' +
            '<input id="password" name="password" type="password" autocomplete="' +
              (isRegister ? "new-password" : "current-password") + '" required>' +
            (isRegister ? '<small>At least 8 characters, including a number or symbol.</small>' : "") + '</div>' +
            '<button class="btn btn--block" type="submit" id="auth-submit">' +
              (isRegister ? "Create account" : "Sign in") + '</button>' +
          '</form>' +
          (isRegister ? "" : '<button class="btn btn--ghost btn--block btn--sm" id="demo-fill" style="margin-top:var(--s-3)">Fill demo credentials</button>') +
        '</div>' +
        '<p class="auth-switch">' + (isRegister
          ? 'Already have an account? <a href="#/login">Sign in</a>'
          : 'No account yet? <a href="#/register">Create one</a>') + '</p>' +
      '</div></div>';
  }

  function bindAuth(container, mode) {
    var form = container.querySelector("#auth-form");
    var button = container.querySelector("#auth-submit");
    var alertBox = container.querySelector("#auth-alert");
    var demo = container.querySelector("#demo-fill");

    if (demo) {
      demo.addEventListener("click", function () {
        form.email.value = "student@cyberverix.local";
        form.password.value = "Cyber@1234";
        form.password.focus();
      });
    }

    function clearErrors() {
      alertBox.innerHTML = "";
      Array.prototype.forEach.call(container.querySelectorAll(".field"), function (field) {
        field.classList.remove("field--error");
        var msg = field.querySelector(".field__error");
        if (msg) { msg.remove(); }
      });
    }

    function fieldError(name, message) {
      var field = container.querySelector('[data-field="' + name + '"]');
      if (!field) { return false; }
      field.classList.add("field--error");
      if (!field.querySelector(".field__error")) {
        var span = document.createElement("span");
        span.className = "field__error";
        span.textContent = message;
        field.appendChild(span);
      }
      return true;
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      clearErrors();

      var payload = {
        email: form.email.value.trim(),
        password: form.password.value
      };
      if (mode === "register") { payload.full_name = form.full_name.value.trim(); }

      var problems = [];
      if (mode === "register" && payload.full_name.length < 2) { problems.push(["full_name", "Enter your full name."]); }
      if (!/^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/.test(payload.email)) { problems.push(["email", "Enter a valid email address."]); }
      if (mode === "register" && payload.password.length < 8) { problems.push(["password", "At least 8 characters."]); }
      if (!payload.password) { problems.push(["password", "Enter your password."]); }
      if (problems.length) {
        problems.forEach(function (p) { fieldError(p[0], p[1]); });
        container.querySelector(".field--error input").focus();
        return;
      }

      button.disabled = true;
      button.innerHTML = '<span class="spinner"></span> Working';

      var call = mode === "register" ? api.register(payload) : api.login(payload);
      call.then(function (data) {
        api.setSession(data.token, data.user);
        ui.toast("Signed in as " + data.user.full_name, "pass");
        global.CVX.app.go("#/dashboard");
      }).catch(function (err) {
        button.disabled = false;
        button.textContent = mode === "register" ? "Create account" : "Sign in";
        var list = (err.details || []).map(function (d) { return "<li>" + esc(d) + "</li>"; }).join("");
        alertBox.innerHTML = '<div class="alert alert--error" role="alert"><strong>' + esc(err.message) + '</strong>' +
          (list ? "<ul>" + list + "</ul>" : "") + '</div>';
        (err.details || []).forEach(function (detail) {
          if (/name/i.test(detail)) { fieldError("full_name", detail); }
          else if (/email/i.test(detail)) { fieldError("email", detail); }
          else if (/password/i.test(detail)) { fieldError("password", detail); }
        });
      });
    });
  }

  function login(container) {
    container.innerHTML = authShell("login");
    bindAuth(container, "login");
    var email = container.querySelector("#email");
    if (email) { email.focus(); }
    return Promise.resolve();
  }

  function register(container) {
    container.innerHTML = authShell("register");
    bindAuth(container, "register");
    var name = container.querySelector("#full_name");
    if (name) { name.focus(); }
    return Promise.resolve();
  }

  global.CVX.views = global.CVX.views || {};
  global.CVX.views.landing = landing;
  global.CVX.views.login = login;
  global.CVX.views.register = register;
})(window);
