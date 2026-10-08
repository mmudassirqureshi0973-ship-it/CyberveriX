/* ==========================================================================
   CyberVeriX - challenge views: library, challenge detail, results
   ========================================================================== */
(function (global) {
  "use strict";

  var ui = global.CVX.ui;
  var api = global.CVX.api;
  var charts = global.CVX.charts;
  var esc = ui.esc;

  /* ---------------------------------------------------------------- library */
  function library(container) {
    container.innerHTML = ui.skeleton(4);
    return api.challenges().then(function (data) {
      var active = "all";

      function itemHtml(ch) {
        var done = ch.completed;
        return '<article class="ch-item' + (done ? " ch-item--done" : "") + '" data-category="' + esc(ch.category) + '">' +
          '<div>' +
            '<div class="ch-item__meta">' +
              '<span class="eyebrow">' + esc(ch.category_name) + '</span>' +
              ui.pill(ch.difficulty, ch.difficulty === "Easy" ? "" : "signal") +
              '<span class="muted" style="font-size:.75rem">' + ch.question_count + ' questions &middot; ' +
              ch.max_points + ' points &middot; ~' + ch.minutes + ' min</span>' +
            '</div>' +
            '<h3><a href="#/challenge/' + esc(ch.id) + '">' + esc(ch.title) + '</a></h3>' +
            '<p>' + esc(ch.summary) + '</p>' +
          '</div>' +
          '<div class="ch-item__side">' +
            (done
              ? '<span class="ch-item__score">' + ui.pct(ch.percent) + '</span>' +
                '<a class="btn btn--ghost btn--sm" href="#/result/' + esc(ch.attempt_id) + '">Review result</a>' +
                '<a class="btn btn--ghost btn--sm" href="#/challenge/' + esc(ch.id) + '">Retry</a>'
              : '<span class="pill">Not attempted</span>' +
                '<a class="btn btn--sm" href="#/challenge/' + esc(ch.id) + '">Start challenge</a>') +
          '</div>' +
        '</article>';
      }

      var recommended = data.recommended;
      var chips = ['<button class="chip" data-filter="all" aria-pressed="true">All ' + data.challenges.length + '</button>'];
      data.categories.forEach(function (cat) {
        var count = data.challenges.filter(function (c) { return c.category === cat.key; }).length;
        if (count) {
          chips.push('<button class="chip" data-filter="' + esc(cat.key) + '" aria-pressed="false">' +
            esc(cat.name) + ' ' + count + '</button>');
        }
      });

      container.innerHTML = '<div class="view">' +
        '<div class="view__head">' +
          '<span class="eyebrow">Challenge library</span>' +
          '<h1>Seven practical challenges across six skill categories</h1>' +
          '<p class="prose">All evidence is simulated lab data. Nothing here scans, connects to, or attacks a real system.</p>' +
        '</div>' +
        (recommended ? '<div class="next-up"><span class="eyebrow">Recommended next</span>' +
          '<div class="row row--between">' +
            '<div><div class="next-up__title">' + esc(recommended.title) + '</div>' +
            '<p class="next-up__reason">' + esc(recommended.reason) + '</p></div>' +
            '<a class="btn btn--signal" href="#/challenge/' + esc(recommended.id) + '">Open challenge</a>' +
          '</div></div>' : "") +
        '<div class="chips" role="group" aria-label="Filter by category">' + chips.join("") + '</div>' +
        '<div class="panel panel--flush"><div class="panel__body"><div class="ch-list" id="ch-list">' +
        data.challenges.map(itemHtml).join("") +
        '</div><p class="empty" id="ch-empty" hidden><strong>No challenges in that category yet.</strong></p></div></div>' +
      '</div>';

      container.querySelector(".chips").addEventListener("click", function (event) {
        var chip = event.target.closest(".chip");
        if (!chip) { return; }
        active = chip.getAttribute("data-filter");
        Array.prototype.forEach.call(container.querySelectorAll(".chip"), function (c) {
          c.setAttribute("aria-pressed", String(c === chip));
        });
        var shown = 0;
        Array.prototype.forEach.call(container.querySelectorAll(".ch-item"), function (item) {
          var match = active === "all" || item.getAttribute("data-category") === active;
          item.hidden = !match;
          if (match) { shown += 1; }
        });
        container.querySelector("#ch-empty").hidden = shown > 0;
      });
    });
  }

  /* --------------------------------------------------------------- evidence */
  function evidenceHtml(blocks) {
    if (!blocks || !blocks.length) { return ""; }
    return '<div class="evidence">' + blocks.map(function (block) {
      var head = '<div class="evidence__head"><span>' + esc(block.title || "Evidence") + '</span>' +
        '<span>' + esc((block.type || "").toUpperCase()) + '</span></div>';
      var body;
      if (block.type === "terminal") {
        body = '<pre class="evidence__pre">' + esc(block.content) + '</pre>';
      } else if (block.type === "http") {
        body = '<pre class="evidence__pre evidence__pre--http">' + esc(block.content) + '</pre>';
      } else if (block.type === "list") {
        body = '<ul class="evidence__list">' + (block.items || []).map(function (item) {
          return "<li>" + esc(item) + "</li>";
        }).join("") + '</ul>';
      } else {
        body = '<p class="evidence__note">' + esc(block.content) + '</p>';
      }
      return '<div class="evidence__block">' + head + body + '</div>';
    }).join("") + '</div>';
  }

  /* -------------------------------------------------------------- questions */
  function questionHtml(question, index) {
    var body = "";
    if (question.type === "single" || question.type === "multi") {
      body = '<div class="options" role="group" aria-labelledby="' + esc(question.id) + '-prompt">' +
        question.options.map(function (opt) {
          var input = question.type === "single"
            ? '<input type="radio" name="' + esc(question.id) + '" value="' + esc(opt.id) + '">'
            : '<input type="checkbox" name="' + esc(question.id) + '" value="' + esc(opt.id) + '">';
          return '<label class="option">' + input + '<span>' + esc(opt.label) + '</span></label>';
        }).join("") + '</div>';
    } else if (question.type === "keywords") {
      body = '<div class="field" style="margin:0">' +
        '<textarea class="answer" id="' + esc(question.id) + '-input" name="' + esc(question.id) + '"' +
        ' placeholder="' + esc(question.placeholder) + '" aria-labelledby="' + esc(question.id) + '-prompt"></textarea>' +
        '<div class="wordcount" data-words-for="' + esc(question.id) + '">0 words &middot; aim for ' +
        question.min_words + '+</div></div>';
    } else if (question.type === "classify") {
      body = '<div class="classify">' + question.items.map(function (item) {
        return '<div class="classify__item">' +
          '<div><span class="classify__ref">' + esc(item.ref) + '</span></div>' +
          '<p class="classify__text">' + esc(item.text) + '</p>' +
          '<div class="classify__choices">' + question.labels.map(function (label) {
            return '<label><input type="radio" name="' + esc(question.id) + ":" + esc(item.id) + '" value="' +
              esc(label.id) + '"><span>' + esc(label.label) + '</span></label>';
          }).join("") + '</div>' +
        '</div>';
      }).join("") + '</div>';
    }

    var typeHint = {
      single: "Choose one", multi: "Choose all that apply",
      keywords: "Written answer, graded per concept", classify: "Label every item"
    }[question.type] || "";

    return '<section class="question" data-question="' + esc(question.id) + '" data-type="' + esc(question.type) + '">' +
      '<div class="question__head">' +
        '<div class="row row--between">' +
          '<span class="eyebrow">Question ' + (index + 1) + ' &middot; ' + esc(typeHint) + '</span>' +
          '<span class="pill">' + question.points + ' pts</span>' +
        '</div>' +
        '<p class="question__prompt" id="' + esc(question.id) + '-prompt">' + esc(question.prompt) + '</p>' +
        (question.hint ? '<p class="question__hint">' + esc(question.hint) + '</p>' : "") +
      '</div>' + body +
    '</section>';
  }

  function collectAnswers(form, challenge) {
    var answers = {};
    challenge.questions.forEach(function (question) {
      if (question.type === "single") {
        var picked = form.querySelector('input[name="' + question.id + '"]:checked');
        if (picked) { answers[question.id] = picked.value; }
      } else if (question.type === "multi") {
        var all = form.querySelectorAll('input[name="' + question.id + '"]:checked');
        if (all.length) {
          answers[question.id] = Array.prototype.map.call(all, function (i) { return i.value; });
        }
      } else if (question.type === "keywords") {
        var field = form.querySelector('textarea[name="' + question.id + '"]');
        if (field && field.value.trim()) { answers[question.id] = field.value.trim(); }
      } else if (question.type === "classify") {
        var map = {};
        question.items.forEach(function (item) {
          var choice = form.querySelector('input[name="' + question.id + ":" + item.id + '"]:checked');
          if (choice) { map[item.id] = choice.value; }
        });
        if (Object.keys(map).length) { answers[question.id] = map; }
      }
    });
    return answers;
  }

  /* ------------------------------------------------------- challenge detail */
  function detail(container, params) {
    container.innerHTML = ui.skeleton(5);
    return api.challenge(params.id).then(function (data) {
      var challenge = data.challenge;

      container.innerHTML = '<div class="view view--wide">' +
        '<div class="view__head">' +
          '<div class="row"><a href="#/challenges" class="muted" style="font-size:var(--step--1)">&larr; Challenge library</a></div>' +
          '<div class="row">' +
            '<span class="eyebrow">' + esc(challenge.category_name) + '</span>' +
            ui.pill(challenge.difficulty, challenge.difficulty === "Easy" ? "" : "signal") +
            ui.pill(challenge.max_points + " points", "primary") +
            '<span class="muted" style="font-size:.75rem">~' + challenge.minutes + ' min</span>' +
          '</div>' +
          '<h1>' + esc(challenge.title) + '</h1>' +
          '<p class="lede">' + esc(challenge.objective) + '</p>' +
        '</div>' +
        '<div class="detail">' +
          '<div class="detail__brief">' +
            '<div class="panel"><span class="eyebrow">Scenario</span>' +
            '<p class="scenario" style="margin-top:var(--s-3)">' + esc(challenge.scenario) + '</p></div>' +
            evidenceHtml(challenge.evidence) +
          '</div>' +
          '<form class="qform" id="challenge-form" novalidate>' +
            '<div class="qprogress"><div class="qprogress__meta">' +
              '<span id="answer-count">0 of ' + challenge.questions.length + ' answered</span>' +
              '<span>' + challenge.max_points + ' points available</span>' +
            '</div><div class="qprogress__track"><div class="qprogress__fill" id="answer-fill" style="width:0%"></div></div></div>' +
            challenge.questions.map(questionHtml).join("") +
            '<div id="submit-alert"></div>' +
            '<div class="submit-bar">' +
              '<p class="muted" style="font-size:.75rem;max-width:38ch">Submitted text is stored and pattern matched only. It is never executed.</p>' +
              '<button class="btn" type="submit" id="submit-btn">Submit for scoring</button>' +
            '</div>' +
          '</form>' +
        '</div>' +
      '</div>';

      var form = container.querySelector("#challenge-form");
      var count = container.querySelector("#answer-count");
      var fill = container.querySelector("#answer-fill");
      var alertBox = container.querySelector("#submit-alert");
      var button = container.querySelector("#submit-btn");
      var confirmed = false;

      function refresh() {
        var answers = collectAnswers(form, challenge);
        var answered = Object.keys(answers).length;
        var total = challenge.questions.length;
        count.textContent = answered + " of " + total + " answered";
        fill.style.width = Math.round((answered / total) * 100) + "%";
        return answered;
      }

      form.addEventListener("input", function (event) {
        var target = event.target;
        if (target.tagName === "TEXTAREA") {
          var meter = form.querySelector('[data-words-for="' + target.name + '"]');
          if (meter) {
            var question = challenge.questions.filter(function (q) { return q.id === target.name; })[0];
            var n = ui.words(target.value);
            meter.textContent = n + (n === 1 ? " word" : " words") + " &middot; aim for " + question.min_words + "+";
            meter.innerHTML = n + (n === 1 ? " word" : " words") + " &middot; aim for " + question.min_words + "+";
            meter.style.color = n >= question.min_words ? "var(--pass)" : "var(--ink-faint)";
          }
        }
        refresh();
      });
      form.addEventListener("change", refresh);

      form.addEventListener("submit", function (event) {
        event.preventDefault();
        var answers = collectAnswers(form, challenge);
        var answered = Object.keys(answers).length;
        var total = challenge.questions.length;

        if (answered === 0) {
          alertBox.innerHTML = '<div class="alert alert--error" role="alert">Answer at least one question before submitting.</div>';
          return;
        }
        if (answered < total && !confirmed) {
          confirmed = true;
          alertBox.innerHTML = '<div class="alert alert--info" role="alert"><strong>' +
            (total - answered) + ' question' + (total - answered === 1 ? "" : "s") + ' still blank.</strong>' +
            ' Unanswered questions score zero. Press submit again to score it as it stands.</div>';
          button.textContent = "Submit anyway";
          return;
        }

        button.disabled = true;
        button.innerHTML = '<span class="spinner"></span> Scoring';
        api.submit(challenge.id, answers).then(function (data) {
          ui.toast("Scored " + ui.pct(data.result.percent) + " on " + data.result.title,
            data.result.percent >= 60 ? "pass" : "");
          global.CVX.app.go("#/result/" + data.result.attempt_id);
        }).catch(function (err) {
          button.disabled = false;
          button.textContent = "Submit for scoring";
          alertBox.innerHTML = '<div class="alert alert--error" role="alert">' + esc(err.message) + '</div>';
        });
      });

      refresh();
    });
  }

  /* ---------------------------------------------------------------- results */
  function results(container, params) {
    container.innerHTML = ui.skeleton(4);
    return api.attempt(params.id).then(function (data) {
      var result = data.result;
      var category = data.category_score || {};

      var questions = result.questions.map(function (q, i) {
        var pieces = [];
        pieces.push('<div class="qresult__block"><span class="eyebrow">Why</span><p>' + esc(q.explanation) + '</p></div>');
        if (q.verdict !== "correct" && q.missed && q.missed.length) {
          pieces.push('<div class="qresult__block qresult__block--gap"><span class="eyebrow">What you missed</span><ul>' +
            q.missed.map(function (m) { return "<li>" + esc(m) + "</li>"; }).join("") + '</ul></div>');
        }
        if (q.notes && q.notes.length && q.verdict !== "incorrect") {
          pieces.push('<div class="qresult__block"><span class="eyebrow">Concepts you covered</span><ul>' +
            q.notes.map(function (m) { return "<li>" + esc(m) + "</li>"; }).join("") + '</ul></div>');
        }
        if (q.model_answer) {
          pieces.push('<div class="qresult__block qresult__block--model"><span class="eyebrow">Model answer</span><p>' +
            esc(q.model_answer) + '</p></div>');
        }
        return '<details class="qresult"' + (q.verdict === "correct" ? "" : " open") + '>' +
          '<summary>' + ui.verdictMarker(q.verdict) +
            '<span class="qresult__prompt">' + esc(q.prompt) + '</span>' +
            '<span class="qresult__pts">' + ui.num(q.earned) + " / " + q.points + '</span>' +
          '</summary>' +
          '<div class="qresult__body">' + pieces.join("") + '</div>' +
        '</details>';
      }).join("");

      var nxt = result.next_challenge;

      container.innerHTML = '<div class="view">' +
        '<div class="view__head">' +
          '<div class="row"><a href="#/challenges" class="muted" style="font-size:var(--step--1)">&larr; Challenge library</a></div>' +
          '<span class="eyebrow">Result &middot; ' + esc(result.category_name) + '</span>' +
          '<h1>' + esc(result.title) + '</h1>' +
        '</div>' +

        '<div class="panel"><div class="result-hero">' +
          charts.donut(result.percent, result.level) +
          '<div class="result-hero__meta">' +
            '<h2 style="font-size:var(--step-2)">' + ui.num(result.earned) + ' of ' + ui.num(result.max_points) +
            ' points</h2>' +
            '<div class="row">' + ui.pill(result.level, ui.levelTone(result.level)) +
              ui.pill("Category now " + ui.pct(category.percent), "primary") +
              ui.pill("Overall " + ui.pct(data.overall_score), "signal") + '</div>' +
            '<p class="prose">' + esc(result.feedback) + '</p>' +
          '</div>' +
        '</div></div>' +

        '<div class="takeaway">' +
          '<div class="takeaway__col panel"><span class="eyebrow">What you got right</span>' +
            (result.right.length ? '<ul>' + result.right.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + '</ul>'
              : '<p class="muted" style="font-size:var(--step--1)">Nothing scored full marks this time. Work the concept below, then retry.</p>') +
          '</div>' +
          '<div class="takeaway__col panel"><span class="eyebrow">What needs improvement</span>' +
            (result.improve.length ? '<ul>' + result.improve.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + '</ul>'
              : '<p class="muted" style="font-size:var(--step--1)">Clean sweep. Nothing outstanding on this challenge.</p>') +
          '</div>' +
        '</div>' +

        '<div class="panel"><span class="eyebrow">Correct concept</span>' +
          '<p class="prose" style="margin-top:var(--s-2)">' + esc(result.concept) + '</p>' +
          (result.remediation && result.remediation.length ?
            '<hr class="divider"><span class="eyebrow">Remediation checklist</span><ul style="margin-top:var(--s-3);font-size:var(--step--1);color:var(--ink-soft);display:grid;gap:6px">' +
            result.remediation.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + '</ul>' : "") +
        '</div>' +

        '<div class="panel panel--flush">' +
          '<div class="panel__head"><h3>Question by question</h3>' +
          '<span class="muted" style="font-size:.75rem">Partial credit is shown per question</span></div>' +
          '<div class="panel__body" style="padding-top:0">' + questions + '</div>' +
        '</div>' +

        (nxt ? '<div class="next-up"><span class="eyebrow">Recommended next step</span>' +
          '<div class="row row--between"><div>' +
            '<div class="next-up__title">' + esc(nxt.title) + '</div>' +
            '<p class="next-up__reason">' + esc(nxt.reason) + '</p></div>' +
          '<div class="row"><a class="btn btn--ghost" href="#/profile">View skill profile</a>' +
          '<a class="btn btn--signal" href="#/challenge/' + esc(nxt.id) + '">Start challenge</a></div>' +
          '</div></div>' : '<div class="row"><a class="btn" href="#/report">Open your report</a></div>') +
      '</div>';
    });
  }

  global.CVX.views = global.CVX.views || {};
  global.CVX.views.library = library;
  global.CVX.views.challenge = detail;
  global.CVX.views.results = results;
})(window);
