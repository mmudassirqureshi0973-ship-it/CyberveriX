/* ==========================================================================
   CyberVeriX - dashboard, skill profile, career readiness, student report
   ========================================================================== */
(function (global) {
  "use strict";

  var ui = global.CVX.ui;
  var api = global.CVX.api;
  var charts = global.CVX.charts;
  var esc = ui.esc;

  function skillBars(categories) {
    return '<div class="skillbars">' + categories.map(function (cat) {
      var assessed = cat.assessed;
      var value = assessed ? cat.percent : 0;
      return '<div class="skillbar' + (assessed ? "" : " skillbar--empty") + '">' +
        '<span class="skillbar__name">' + esc(cat.name) + '</span>' +
        '<span class="skillbar__val">' + (assessed ? ui.pct(cat.percent) + " &middot; " + esc(cat.level)
          : "Not assessed") + '</span>' +
        '<div class="skillbar__track">' + (assessed
          ? '<div class="skillbar__fill skillbar__fill--' + ui.tone(cat.percent) + '" style="width:' + value + '%"></div>'
          : "") + '</div>' +
      '</div>';
    }).join("") + '</div>';
  }

  function categoryTable(categories) {
    return '<table class="cat-table"><thead><tr>' +
      '<th>Category</th><th>Progress</th><th class="num">Points</th><th class="num">Score</th><th>Level</th>' +
      '</tr></thead><tbody>' + categories.map(function (cat) {
        return '<tr>' +
          '<td>' + esc(cat.name) + '</td>' +
          '<td><span class="muted" style="font-size:.75rem">' + cat.completed + " / " + cat.total + ' challenges</span>' +
            '<div class="minibar"><span style="width:' + (cat.assessed ? cat.percent : 0) + '%"></span></div></td>' +
          '<td class="num">' + (cat.assessed ? ui.num(cat.earned) + " / " + ui.num(cat.max_points) : "--") + '</td>' +
          '<td class="num"><strong>' + (cat.assessed ? ui.pct(cat.percent) : "--") + '</strong></td>' +
          '<td>' + (cat.assessed ? ui.pill(cat.level, ui.levelTone(cat.level)) : '<span class="muted">--</span>') + '</td>' +
        '</tr>';
      }).join("") + '</tbody></table>';
  }

  /* -------------------------------------------------------------- dashboard */
  function dashboard(container) {
    container.innerHTML = ui.skeleton(4);
    return api.profile().then(function (data) {
      var p = data.profile;
      var nxt = p.next_challenge;
      var firstName = String(p.user.full_name || "Student").split(" ")[0];
      var fresh = p.challenges_completed === 0;

      var recent = (p.history || []).slice(0, 5).map(function (row) {
        return '<li><span><a href="#/result/' + row.attempt_id + '">' + esc(row.title) + '</a>' +
          '<small>' + esc(row.category_name) + ' &middot; ' + ui.dateTime(row.created_at) + '</small></span>' +
          '<span class="attempt-list__score">' + ui.pct(row.percent) + '</span>' +
          '<span class="muted" style="font-size:.75rem">' + ui.num(row.earned) + "/" + ui.num(row.max_points) + '</span></li>';
      }).join("");

      container.innerHTML = '<div class="view">' +
        '<div class="greeting">' +
          '<div class="view__head">' +
            '<span class="eyebrow">Dashboard</span>' +
            '<h1>' + esc(firstName) + '\u2019s skill assessment</h1>' +
          '</div>' +
          '<a class="btn btn--ghost btn--sm" href="#/report">Open report</a>' +
        '</div>' +

        (fresh ? '<div class="empty">' +
          '<span class="eyebrow">Nothing scored yet</span>' +
          '<h3>Your profile is waiting for its first challenge</h3>' +
          '<p>Pick any category and submit one challenge. Scores, strengths, weaknesses and the readiness band all build from real submissions, so nothing is estimated for you.</p>' +
          '<a class="btn" href="#/challenges">Browse challenges</a>' +
        '</div>' : "") +

        '<div class="panel"><div class="scorecard">' +
          '<div class="scoreline">' +
            '<span class="eyebrow">Overall CyberVeriX score</span>' +
            '<div class="scoreline__value">' + (fresh ? "--" : ui.num(p.overall_score)) + '<span>/100</span></div>' +
            '<div class="scoreline__level">' + esc(p.overall_level) + '</div>' +
            '<p class="muted" style="font-size:.75rem">' + ui.num(p.points_earned) + ' of ' + ui.num(p.points_possible) +
            ' points earned on submitted challenges</p>' +
          '</div>' +
          '<div>' + charts.ruler(p.overall_score) + '</div>' +
        '</div>' +
        '<hr class="divider">' +
        '<dl class="stats">' +
          '<div><dt>Challenges completed</dt><dd>' + p.challenges_completed + '<small> / ' + p.challenges_total + '</small></dd></div>' +
          '<div><dt>Assessment coverage</dt><dd>' + ui.pct(p.coverage) + '</dd></div>' +
          '<div><dt>Submissions logged</dt><dd>' + p.attempts_logged + '</dd></div>' +
          '<div><dt>Career readiness</dt><dd style="font-size:var(--step-0)">' + esc(p.readiness.band) + '</dd></div>' +
        '</dl></div>' +

        '<div class="dash-grid">' +
          '<div class="panel"><div class="row row--between" style="margin-bottom:var(--s-5)">' +
            '<h3>Skill breakdown</h3>' +
            '<a href="#/profile" style="font-size:var(--step--1)">Full profile</a></div>' +
            skillBars(p.categories) +
          '</div>' +
          '<div class="stack">' +
            (nxt ? '<div class="next-up"><span class="eyebrow">Recommended next</span>' +
              '<div class="next-up__title">' + esc(nxt.title) + '</div>' +
              '<div class="row">' + ui.pill(nxt.category_name, "primary") + ui.pill(nxt.difficulty) +
              ui.pill(nxt.max_points + " pts") + '</div>' +
              '<p class="next-up__reason">' + esc(nxt.reason) + '</p>' +
              '<a class="btn btn--signal btn--block" href="#/challenge/' + esc(nxt.id) + '">Start challenge</a>' +
            '</div>' : "") +
            '<div class="coach"><span class="eyebrow">Coach</span><p>' + esc(p.feedback) + '</p></div>' +
          '</div>' +
        '</div>' +

        (recent ? '<div class="panel panel--flush">' +
          '<div class="panel__head"><h3>Recent submissions</h3>' +
          '<a href="#/profile" style="font-size:var(--step--1)">Full history</a></div>' +
          '<ul class="attempt-list">' + recent + '</ul></div>' : "") +
      '</div>';
    });
  }

  /* ---------------------------------------------------------- skill profile */
  function profile(container) {
    container.innerHTML = ui.skeleton(4);
    return api.profile().then(function (data) {
      var p = data.profile;

      var history = (p.history || []).map(function (row) {
        return '<tr><td><a href="#/result/' + row.attempt_id + '">' + esc(row.title) + '</a></td>' +
          '<td>' + esc(row.category_name) + '</td>' +
          '<td class="num">' + ui.num(row.earned) + " / " + ui.num(row.max_points) + '</td>' +
          '<td class="num"><strong>' + ui.pct(row.percent) + '</strong></td>' +
          '<td>' + ui.dateTime(row.created_at) + '</td></tr>';
      }).join("");

      var learning = (p.learning_areas || []).map(function (row) {
        return '<li><small>' + esc(row.category) + '</small><strong>' + esc(row.topic) + '</strong></li>';
      }).join("");

      container.innerHTML = '<div class="view view--wide">' +
        '<div class="view__head"><span class="eyebrow">Skill profile</span>' +
        '<h1>Where the points are, and where they are not</h1>' +
        '<p class="prose">Category scores come from your best attempt at each challenge. A retry can raise a category but never lower it.</p></div>' +

        '<div class="profile-grid">' +
          '<div class="panel" style="display:grid;gap:var(--s-4);justify-items:center">' +
            '<span class="eyebrow" style="justify-self:start">Category radar</span>' +
            charts.radar(p.categories) +
            '<p class="muted" style="font-size:.75rem;text-align:center">Unassessed categories sit at the centre and are marked n/a.</p>' +
          '</div>' +
          '<div class="stack">' +
            '<div class="panel"><h3 style="margin-bottom:var(--s-4)">Category detail</h3>' + categoryTable(p.categories) + '</div>' +
            '<div class="takeaway">' +
              '<div class="panel takeaway__col"><span class="eyebrow">Strong areas</span>' +
                (p.strengths.length ? '<ul>' + p.strengths.map(function (c) {
                  return "<li><strong>" + esc(c.name) + "</strong> " + ui.pct(c.percent) + "</li>";
                }).join("") + '</ul>' : '<p class="muted" style="font-size:var(--step--1)">Nothing at 70% or above yet.</p>') +
              '</div>' +
              '<div class="panel takeaway__col"><span class="eyebrow">Weak areas</span>' +
                (p.weaknesses.length ? '<ul>' + p.weaknesses.map(function (c) {
                  return "<li><strong>" + esc(c.name) + "</strong> " + ui.pct(c.percent) + "</li>";
                }).join("") + '</ul>' : '<p class="muted" style="font-size:var(--step--1)">No assessed category is below 70%.</p>') +
              '</div>' +
            '</div>' +
            (learning ? '<div class="panel"><span class="eyebrow">Recommended learning areas</span>' +
              '<ul class="learn-list" style="margin-top:var(--s-4)">' + learning + '</ul></div>' : "") +
          '</div>' +
        '</div>' +

        '<div class="panel panel--flush"><div class="panel__head"><h3>Submission history</h3>' +
        '<span class="muted" style="font-size:.75rem">' + p.attempts_logged + ' submissions</span></div>' +
        '<div class="panel__body">' + (history
          ? '<table class="cat-table"><thead><tr><th>Challenge</th><th>Category</th><th class="num">Points</th><th class="num">Score</th><th>Submitted</th></tr></thead><tbody>' + history + '</tbody></table>'
          : '<p class="muted" style="font-size:var(--step--1)">No submissions yet. <a href="#/challenges">Start a challenge</a> and this table fills up.</p>') +
        '</div></div>' +
      '</div>';
    });
  }

  /* -------------------------------------------------------- career readiness */
  function readiness(container) {
    container.innerHTML = ui.skeleton(3);
    return api.profile().then(function (data) {
      var p = data.profile;
      var r = p.readiness;

      var notes = (r.notes || []).map(function (note) {
        return '<li><span class="marker marker--' + (r.eligible ? "pass" : "warn") + '" aria-hidden="true">&#8226;</span>' +
          '<span>' + esc(note) + '</span></li>';
      }).join("");

      var learning = (p.learning_areas || []).map(function (row) {
        return '<li><small>' + esc(row.category) + '</small><strong>' + esc(row.topic) + '</strong></li>';
      }).join("");

      container.innerHTML = '<div class="view">' +
        '<div class="view__head"><span class="eyebrow">Career readiness</span>' +
        '<h1>What this profile says about practical readiness</h1></div>' +

        '<div class="panel"><div class="readiness-hero">' +
          '<div class="stack--tight">' +
            '<span class="eyebrow">Result</span>' +
            '<div class="readiness-band">' + esc(r.band) + '</div>' +
            '<p class="prose">' + esc(r.summary) + '</p>' +
            '<div class="row">' + ui.pill("Score " + ui.num(r.score) + "/100", "primary") +
              ui.pill(p.challenges_completed + " of " + p.challenges_total + " challenges") +
              (r.consistency ? ui.pill("Profile " + r.consistency, r.consistency === "Even" ? "pass" : "warn") : "") +
            '</div>' +
          '</div>' +
          '<div>' + charts.gauge(r.score) + '</div>' +
        '</div></div>' +

        '<div class="dash-grid">' +
          '<div class="panel"><h3 style="margin-bottom:var(--s-4)">How this was calculated</h3>' +
            '<ul class="checklist">' + notes + '</ul>' +
            '<hr class="divider">' +
            '<p class="prose" style="font-size:var(--step--1)">The band is a function of two things only: your overall score and how much of the assessment you have completed. It is deliberately withheld below ' +
            r.requirement + ' challenges because a band drawn from one or two submissions would say more about which challenge you picked than about your skills.</p>' +
          '</div>' +
          '<div class="stack">' +
            '<div class="panel"><span class="eyebrow">Bands</span><ul style="margin-top:var(--s-3);font-size:var(--step--1);color:var(--ink-soft);display:grid;gap:6px">' +
              '<li>90+ Interview Ready (Educational)</li><li>75-89 Job-Ready Foundations</li>' +
              '<li>60-74 Foundations Forming</li><li>40-59 Developing</li><li>Below 40 Early Learner</li>' +
            '</ul></div>' +
            (learning ? '<div class="panel"><span class="eyebrow">Close the gap</span>' +
              '<ul class="learn-list" style="margin-top:var(--s-4)">' + learning + '</ul>' +
              '<a class="btn btn--ghost btn--block btn--sm" href="#/challenges" style="margin-top:var(--s-4)">Pick a challenge</a></div>' : "") +
          '</div>' +
        '</div>' +

        '<div class="alert alert--info"><strong>Educational assessment.</strong> CyberVeriX is a student project. This band is not a professional certification, an accredited qualification, or a hiring recommendation, and it does not replace one.</div>' +
      '</div>';
    });
  }

  /* ------------------------------------------------------------------ report */
  function report(container) {
    container.innerHTML = ui.skeleton(4);
    return api.report().then(function (data) {
      var r = data.report;
      var generated = ui.dateTime(r.generated_at);

      var completed = r.completed.map(function (c) {
        return '<tr><td>' + esc(c.title) + '</td><td>' + esc(c.category_name) + '</td>' +
          '<td class="num">' + ui.num(c.earned) + " / " + ui.num(c.max_points) + '</td>' +
          '<td class="num"><strong>' + ui.pct(c.percent) + '</strong></td>' +
          '<td>' + ui.date(c.completed_at) + '</td></tr>';
      }).join("");

      container.innerHTML = '<div class="view view--wide">' +
        '<div class="row row--between no-print">' +
          '<div class="view__head"><span class="eyebrow">Student report</span>' +
          '<h1 style="font-size:var(--step-2)">Printable assessment record</h1></div>' +
          '<div class="row"><a class="btn btn--ghost btn--sm" href="#/dashboard">Back to dashboard</a>' +
          '<button class="btn btn--sm" id="print-btn">Print / save as PDF</button></div>' +
        '</div>' +

        '<article class="report">' +
          '<header class="report__masthead">' +
            '<div class="brand"><span class="brand__mark" aria-hidden="true">CV</span>' +
            '<span><span class="brand__name">CyberVeriX</span>' +
            '<span class="brand__sub">Practical skill verification</span></span></div>' +
            '<div class="report__id">Report ref CVX-' + String(r.student.id).padStart(5, "0") + '<br>' +
            'Generated ' + esc(generated) + '<br>Educational assessment</div>' +
          '</header>' +

          '<section class="report__subject">' +
            '<span class="eyebrow">Student</span>' +
            '<h2>' + esc(r.student.full_name) + '</h2>' +
            '<p class="muted" style="font-size:var(--step--1)">' + esc(r.student.email) + '</p>' +
          '</section>' +

          '<section class="report__score">' +
            charts.donut(r.overall_score, r.overall_level) +
            '<div class="stack--tight">' +
              '<span class="eyebrow">Overall CyberVeriX score</span>' +
              '<div style="font-family:var(--serif);font-size:var(--step-2);font-weight:600">' +
                ui.num(r.overall_score) + ' / 100 &middot; ' + esc(r.overall_level) + '</div>' +
              '<p style="font-size:var(--step--1);color:var(--ink-soft)">' + ui.num(r.points_earned) + ' of ' +
                ui.num(r.points_possible) + ' points across ' + r.challenges_completed + ' of ' +
                r.challenges_total + ' challenges. Career readiness: <strong>' + esc(r.readiness.band) + '</strong>.</p>' +
            '</div>' +
          '</section>' +

          '<section><h3>Skill category scores</h3>' + categoryTable(r.categories) + '</section>' +

          '<section><h3>Completed challenges</h3>' + (completed
            ? '<table class="cat-table"><thead><tr><th>Challenge</th><th>Category</th><th class="num">Points</th><th class="num">Score</th><th>Date</th></tr></thead><tbody>' + completed + '</tbody></table>'
            : '<p class="muted" style="font-size:var(--step--1)">No challenges submitted yet, so this report has no performance data.</p>') +
          '</section>' +

          '<section class="report__two">' +
            '<div><h3>Strengths</h3>' + (r.strengths.length ? '<ul>' + r.strengths.map(function (c) {
              return "<li><strong>" + esc(c.name) + "</strong> " + ui.pct(c.percent) + " (" + esc(c.level) + ")</li>";
            }).join("") + '</ul>' : '<p class="muted" style="font-size:var(--step--1)">No category at 70% or above yet.</p>') + '</div>' +
            '<div><h3>Weaknesses</h3>' + (r.weaknesses.length ? '<ul>' + r.weaknesses.map(function (c) {
              return "<li><strong>" + esc(c.name) + "</strong> " + ui.pct(c.percent) + " (" + esc(c.level) + ")</li>";
            }).join("") + '</ul>' : '<p class="muted" style="font-size:var(--step--1)">No assessed category below 70%.</p>') + '</div>' +
          '</section>' +

          '<section><h3>Recommended learning areas</h3>' + (r.learning_areas.length
            ? '<ul>' + r.learning_areas.map(function (a) {
                return "<li><strong>" + esc(a.category) + ":</strong> " + esc(a.topic) + "</li>";
              }).join("") + '</ul>'
            : '<p class="muted" style="font-size:var(--step--1)">Complete more challenges to generate targeted recommendations.</p>') +
          '</section>' +

          '<section><h3>Assessor summary</h3><p style="font-size:var(--step--1);color:var(--ink-soft);max-width:74ch">' +
          esc(r.feedback) + '</p></section>' +

          '<footer class="report__foot">' + esc(r.disclaimer) +
          '<br>Signature: ______________________________ &nbsp;&nbsp; Date: ' + esc(ui.date(r.generated_at)) +
          '</footer>' +
        '</article>' +
      '</div>';

      var print = container.querySelector("#print-btn");
      if (print) { print.addEventListener("click", function () { global.print(); }); }
    });
  }

  global.CVX.views = global.CVX.views || {};
  global.CVX.views.dashboard = dashboard;
  global.CVX.views.profile = profile;
  global.CVX.views.readiness = readiness;
  global.CVX.views.report = report;
})(window);
