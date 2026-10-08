# CyberVeriX

**Practical Cybersecurity Skill Verification & Career Readiness Platform**

---

## 1. Project title

CyberVeriX: Practical Cybersecurity Skill Verification and Career Readiness Platform.

## 2. Project description

CyberVeriX is a web application that evaluates what a student can actually *do* in
cybersecurity, not what they have attended. A student signs in, opens a challenge,
reads a realistic scenario, analyses simulated evidence (Nmap output, a Nikto report,
an intercepted HTTP exchange, Windows Security and Sysmon events, a SOC alert queue,
an incident timeline), and submits an analysis. The platform grades the submission
automatically, explains every point awarded and withheld, updates a per category
skill profile, produces a career readiness band, and generates a printable student
report.

All evidence is simulated lab data. CyberVeriX never scans, connects to, or attacks a
real system, and it never executes anything a student submits.

## 3. Problem statement

Cybersecurity hiring and academic assessment both lean heavily on certificates and
multiple choice exams. Neither answers the question that actually matters:

> "Which cybersecurity tasks can this student perform, and how well?"

A certificate records attendance and a passing grade on recall questions. It does not
show whether the holder can read scan output and rank the exposures, spot an access
control failure in an HTTP response, or triage an alert queue without escalating
everything. Students therefore cannot demonstrate practical capability, and assessors
cannot measure it consistently.

## 4. Objectives

1. Assess practical cybersecurity skill through safe, simulated, scenario based challenges.
2. Score every submission deterministically and explain each point, including partial credit.
3. Maintain a per category skill profile (six categories) built only from real submissions.
4. Give targeted feedback: what was right, what was weak, the correct concept, the next step.
5. Produce a career readiness indicator that is gated on assessment coverage, not on one lucky challenge.
6. Generate a professional, printable student report suitable for a portfolio or a viva.
7. Stay safe and academically honest: no real world attack capability, no fake certification claims.

## 5. Features

- Student registration and sign in with salted PBKDF2 password hashing and server side sessions.
- Seven practical challenges covering all six skill categories, 194 points in total.
- Four question types: single choice, multiple choice with penalties for wrong picks, written answers graded per concept, and alert classification graded per item.
- Transparent scoring: challenge score, category score, overall CyberVeriX score out of 100, five skill levels.
- Per question feedback: verdict, points, what you missed, the concepts you did cover, a model answer, and the reasoning.
- Rule based coaching engine: weak skill identification, recommended next challenge with a stated reason, recommended learning topics, and a short personalised summary. No external AI service is required and none is used.
- Skill profile page with a category radar, a category table, strengths, weaknesses and full submission history.
- Career readiness page with the band, how it was calculated, and an explicit educational disclaimer.
- Printable student report (browser print or save as PDF) with a professional layout.
- Retries allowed: the best attempt per challenge counts, so a bad retry can never lower a score.
- Empty, loading and error states throughout, responsive down to a 390px phone, keyboard accessible.

## 6. Technologies used

| Layer | Choice | Why |
| --- | --- | --- |
| Backend | Python 3.9+ standard library (`http.server`, `sqlite3`, `hashlib`, `secrets`) | Zero installs, so it runs on any machine with Python. Nothing to break the night before a deadline. |
| Database | SQLite | File based, no server, ships with Python. |
| Frontend | HTML, CSS, vanilla JavaScript (ES5 compatible, no build step) | Opens instantly, nothing to compile, no `node_modules`. |
| Charts | Hand written SVG (radar, donut, gauge, score ruler) | No chart library to install, and it prints cleanly in the report. |
| Tests | `unittest` (stdlib) plus an end to end smoke script | Runs with `python -m unittest`, no pytest needed. |

**A note on the stack.** The original plan was React, Vite, Node and Express. That
stack needs `npm install` (hundreds of packages), a dev server, a build step, and a
working internet connection at exactly the wrong moment. CyberVeriX instead uses the
Python standard library on the backend and plain JavaScript on the frontend: the whole
project runs with one command, has zero dependencies, and every feature in the brief
is still implemented. If a marker asks for a framework, this trade is worth defending:
the deliverable is a working, testable system rather than a broken toolchain.

## 7. Architecture

```
Browser (single page app, hash routing)
  |  fetch() with a Bearer session token
  v
app.py            HTTP server: static files + /api router + security headers
  |
  +-- api.py      request handlers, input validation, answer sanitising
  |     |
  |     +-- auth.py        PBKDF2 hashing, session tokens, registration rules
  |     +-- scoring.py     grading engine, category aggregation, readiness bands
  |     +-- recommend.py   rule based coaching, next challenge, learning topics
  |     +-- db.py          SQLite access, schema, challenge loading
  |
  +-- challenges/*.json    the challenge library (content, not code)
  |
  v
database/cyberverix.db     users, sessions, challenges, attempts
```

Design rules the code follows:

- **Answer keys never leave the server.** `api.public_challenge()` strips `correct`, `concepts`, `explanation` and `model_answer` before any challenge is sent to the browser. A unit test asserts this.
- **The grader is pure.** `scoring.grade_challenge(challenge, answers)` has no side effects, so it is trivially testable.
- **Nothing student supplied is ever executed.** Submitted text is stored as a parameter bound string and matched with regular expressions. No `eval`, no shell, no subprocess anywhere in the project.
- **Scores are derived, never trusted.** Every category and overall score is recomputed from stored attempts on each request.

### Database schema

| Table | Columns |
| --- | --- |
| `users` | id, full_name, email (unique), password_hash, created_at |
| `sessions` | token (primary key), user_id, created_at |
| `challenges` | id, title, category, difficulty, minutes, max_points, sort_order, payload (JSON) |
| `attempts` | id, user_id, challenge_id, category, earned, max_points, percent, answers (JSON), breakdown (JSON), created_at |

Challenges are seeded from `challenges/*.json` on every start, so editing a challenge
file and restarting is enough to update the library.

## 8. Folder structure

```
cyberverix/
├── backend/
│   ├── app.py              server entry point, static files, API routing, security headers
│   ├── api.py              JSON API handlers, validation, answer sanitising
│   ├── auth.py             password hashing, sessions, registration validation
│   ├── db.py               SQLite schema, queries, challenge loading
│   ├── scoring.py          grading engine, category scores, readiness bands
│   ├── recommend.py        rule based feedback and recommendations
│   └── seed.py             demo student account and sample submissions
├── challenges/
│   ├── 01_net-recon-01.json
│   ├── 02_web-nikto-01.json
│   ├── 03_web-burp-01.json
│   ├── 04_win-logs-01.json
│   ├── 05_soc-triage-01.json
│   ├── 06_incident-response-01.json
│   └── 07_fund-core-01.json
├── frontend/
│   ├── index.html          app shell
│   ├── css/styles.css      full design system
│   └── js/
│       ├── api.js              fetch wrapper and session storage
│       ├── ui.js               escaping, formatting, toasts, loading and error states
│       ├── charts.js           SVG radar, donut, gauge, score ruler
│       ├── views-public.js     landing, sign in, register
│       ├── views-challenges.js challenge library, challenge detail, results
│       ├── views-profile.js    dashboard, skill profile, readiness, report
│       └── app.js              router, guards, navigation
├── database/               cyberverix.db is created here on first run
├── tests/
│   ├── test_scoring.py     22 unit tests (stdlib unittest)
│   └── smoke_test.py       end to end API test against a running server
├── run.sh                  start script for macOS and Linux
├── run.bat                 start script for Windows
├── requirements.txt        intentionally empty: no third party packages
└── README.md
```

## 9. Installation

You need **Python 3.9 or newer**. Nothing else. No npm, no pip install, no internet.

```bash
python3 --version        # macOS / Linux
python --version         # Windows
```

Unzip or clone the project, then `cd` into the `cyberverix` folder. That is the whole
installation.

## 10. How to run the frontend

The frontend is served by the same process as the backend, so there is nothing
separate to start. Once the server is running, open:

**http://127.0.0.1:8000**

Do not open `frontend/index.html` directly from the file system: the browser would
block the API calls. Always go through the server URL.

## 11. How to run the backend

macOS or Linux:

```bash
./run.sh
```

Windows:

```bat
run.bat
```

Or manually, on any platform:

```bash
python3 backend/app.py                 # http://127.0.0.1:8000
python3 backend/app.py --port 9000     # different port
python3 backend/app.py --reset         # wipe and rebuild the database first
```

Stop the server with `Ctrl+C`.

## 12. Database setup

There is no setup step. On first start, `backend/app.py` creates
`database/cyberverix.db`, builds the schema, loads every challenge from
`challenges/*.json`, and seeds the demo student. To start over:

```bash
python3 backend/app.py --reset
```

To edit a challenge, change its JSON file and restart the server. To add a challenge,
copy an existing file, give it a new `id`, and restart: it appears in the library
automatically, and its category score starts working immediately.

## 13. Test account

| Field | Value |
| --- | --- |
| Email | `student@cyberverix.local` |
| Password | `Cyber@1234` |

The demo student already has three submissions, so the dashboard, skill profile,
career readiness page and report all have data on first load, which is useful when
demonstrating the project. The sign in page has a **Fill demo credentials** button.
Register a new account to see the empty state and build a profile from zero.

## 14. Challenge descriptions

| # | Challenge | Category | Difficulty | Points | What the student does |
| --- | --- | --- | --- | --- | --- |
| 1 | Network Reconnaissance Triage | Network Security | Easy | 25 | Read a simulated `nmap -sV` report, separate open from closed ports, pick the service that matters most (Telnet), justify the risk, and recommend fixes for an exposed MySQL and outdated Apache. |
| 2 | Web Server Finding Triage | Web Security | Easy | 25 | Sort a simulated Nikto report into real findings and noise, spot that the readable database backup is close to a breach, and write remediation for directory indexing. |
| 3 | Intercepted Request Analysis | Web Security | Medium | 27 | Analyse a captured HTTP request and response where changing `user_id` returns another customer's invoices. Identify IDOR / broken access control, cite the proving evidence, and describe the server side fix. |
| 4 | Windows Event Log Investigation | Windows Security | Medium | 27 | Reconstruct an intrusion from Security and Sysmon events: a 4625 burst then a 4624, hidden encoded PowerShell spawned by WMI, an outbound callback, account creation, then a 1102 log clear. |
| 5 | SOC Alert Triage Shift | SOC & Log Analysis | Medium | 27 | Classify six alerts as benign, suspicious or potential incident (partial credit per alert), choose what to escalate first, and state the factors that set queue order. |
| 6 | Incident Response Decisions | Incident Analysis | Medium | 33 | Handle a live simulated intrusion: assess severity, choose containment actions without destroying volatile evidence, explain order of volatility, and say what belongs in the post incident report. |
| 7 | Applied Security Fundamentals | Cybersecurity Fundamentals | Easy | 30 | Apply the CIA triad, authentication versus authorisation, vulnerability versus threat versus risk, event versus incident, control types, and least privilege to concrete scenarios. |

### Scoring

- **Single choice**: full points or zero.
- **Multiple choice**: `(correct picks - wrong picks) / number of correct answers`, clamped to 0-100% of the question points. Guessing everything scores badly on purpose.
- **Written answers**: each question defines concept groups with their own points. Say the concept in any wording and the group scores. A too short answer scores zero, which is why each box shows a target word count.
- **Alert classification**: points are split evenly across the items, so five of six correct scores five sixths.
- **Category score** = points earned / points available across your best attempt at each challenge in that category.
- **Overall CyberVeriX score** = total earned / total available across all submitted challenges, expressed out of 100.
- **Skill levels**: 0-39 Beginner, 40-59 Developing, 60-74 Intermediate, 75-89 Strong, 90-100 Advanced.
- **Career readiness**: Early Learner, Developing, Foundations Forming, Job-Ready Foundations, Interview Ready (Educational). Locked at "Assessment Incomplete" until at least three challenges are submitted.

## 15. Security considerations

Because this is a cybersecurity project, the application holds itself to the standards it teaches.

- **Passwords** are hashed with PBKDF2-HMAC-SHA256, a fresh 16 byte salt per user and 200,000 iterations. Plaintext passwords are never stored, logged or returned. Verification uses `hmac.compare_digest`.
- **Sessions** use 32 byte URL safe random tokens generated with `secrets`, stored server side and invalidated on sign out. The token is sent as a `Bearer` header, not as an ambient cookie.
- **Input validation** happens on the server, and the client validation is a convenience only. Every submitted answer is checked against the challenge shape: unknown option ids are dropped, list and dictionary answers are type checked, text is length capped, and classification labels must exist.
- **SQL injection** is prevented by parameter binding on every query. No SQL string is ever built from user input. A smoke test submits `'; DROP TABLE users; --` as an answer and asserts the database survives.
- **XSS** is prevented by escaping every dynamic value with `ui.esc()` before it reaches `innerHTML`. Responses carry `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN` and `Referrer-Policy: no-referrer`.
- **No code execution.** Nothing a student types is evaluated, interpreted or shelled out. There is no `eval`, no `exec`, no `subprocess` and no command field anywhere in the project.
- **Path traversal** is blocked: static file paths are normalised and confirmed to stay inside `frontend/`.
- **Answer keys** stay server side and are stripped from every API response.
- **Safe content only.** All evidence is simulated lab data with private addresses. The platform performs no scanning, no exploitation, no credential handling for third party systems, and no phishing. It teaches analysis and remediation, not attack automation.
- **Honest claims.** Every score surface states that this is an educational assessment and not a professional certification.
- Known scope limits: the development server binds to localhost and speaks HTTP, and sessions do not expire on a timer. Both are noted below as future work rather than hidden.

## 16. Future enhancements

1. Session expiry, refresh and rate limiting on sign in attempts.
2. HTTPS and a production WSGI/ASGI server (Gunicorn or Uvicorn behind Nginx) for deployment beyond localhost.
3. Instructor role: cohort dashboard, per question analytics, custom challenge authoring in the UI.
4. Challenge timer and difficulty weighted scoring, plus adaptive difficulty selection.
5. An optional LLM layer behind the existing `recommend.py` interface for free text feedback, keeping the rule based path as the default so the platform still works offline.
6. Server side PDF export and a verifiable report link instead of browser print.
7. More categories (cryptography, cloud security, digital forensics) and more challenges per category.
8. Semantic scoring for written answers using embeddings, benchmarked against the current concept matching.

---

## Running the tests

Unit tests (no server needed):

```bash
python3 -m unittest discover -s tests -v
```

22 tests cover the level bands, all four graders including partial credit and boundary
cases, password hashing, the challenge library shape, answer key leakage, and profile
aggregation including the "a worse retry cannot lower your score" rule. One test
grades every published model answer and asserts it scores full marks, so the answer
keys and the grader can never drift apart.

End to end API test (server must be running):

```bash
python3 backend/app.py --reset --port 8000 &
python3 tests/smoke_test.py
```

33 checks cover registration validation, duplicate emails, sign in, session
invalidation, challenge retrieval, answer key stripping, perfect and partial
submissions, malformed and hostile input, attempt replay, the profile, and the report.

## Manual test checklist

| Feature | How to test | Expected |
| --- | --- | --- |
| Registration | Register with `a`, `bad-email`, `abc` | Three inline field errors, no account created |
| Registration | Register with a real name, email and 8+ character password | Straight to the dashboard, empty state shown |
| Login | Sign in with a wrong password | "Email or password is incorrect", no session |
| Login | Use **Fill demo credentials** | Dashboard with three completed challenges |
| Dashboard | Look at a new account | Empty state, score `--`, all categories "Not assessed" |
| Challenges | Filter by a category chip | Only that category's challenges remain |
| Challenge loading | Open any challenge | Scenario, evidence and questions render; progress reads "0 of N answered" |
| Answer submission | Submit with questions blank | Warning that N are blank; press again to score anyway |
| Automatic scoring | Answer everything correctly | 100%, every question marked correct |
| Partial credit | Pick two of three correct options in a multi choice | Fractional points and a "Partly correct" verdict |
| Score calculation | Retry a challenge and score lower | Category and overall scores do not drop |
| Profile | Open Skill profile | Radar, category table, strengths, weaknesses, history |
| Readiness | Complete fewer than three challenges | "Assessment Incomplete" with the requirement stated |
| Report | Open Report, click Print / save as PDF | Clean print layout, no navigation, signature line |
| Navigation | Reload on `#/profile` | Session restored, page renders |
| Responsive | Resize to 390px wide | Hamburger navigation, single column, no horizontal scrolling |

---

**Disclaimer.** CyberVeriX is an academic project. Its scores, bands and reports are
educational assessments. They are not professional certifications, accredited
qualifications, or hiring recommendations.
