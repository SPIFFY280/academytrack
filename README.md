# AcademyTrack

A standalone, mobile-responsive academic companion for one institution with multiple programmes. You own the source and database. No Lovable subscription, API key, cloud account or package installation is required.

## Start

Use Node.js 24 or newer. From this folder, run:

```sh
node server.mjs
```

Open http://localhost:3000. Windows users can also run Start-AcademyTrack.ps1. Stop with Ctrl+C. Records remain in data/academytrack.sqlite.

For a new fictional sample database only, run `node seed.mjs`. To extend an existing v1 sample campus, run `node seed-v2.mjs`. Neither replaces existing results. The supplied local database already has sample accounts.

| Demo | Email | Password |
| --- | --- | --- |
| University student | student@academytrack.demo | AcademyDemo2026! |
| Lecturer / trainer | lecturer@academytrack.demo | AcademyDemo2026! |
| Department / exams | department@academytrack.demo | AcademyDemo2026! |
| Finance | finance@academytrack.demo | AcademyDemo2026! |
| TVET student | tvet@academytrack.demo | AcademyDemo2026! |

Students may also sign in by registration number. Use separate browser profiles for simultaneous users.

## Included

- Configurable GPA, percentage or competency results, programme metadata, grade bands, assessment weights and completion requirements.
- CAT, assignment and exam components with distinct missing, unmarked, not-submitted and confirmed states.
- Competent, not-yet-competent and not-assessed outcomes, without converting them into GPA.
- Missing-mark references, owners, deadlines, evidence, history, overdue escalation and resolution.
- Registration requests, prerequisite checks, decisions and downloadable approved-unit records.
- Graduation readiness: units, credits, reports, applications, project, attachment, fees and department clearance.
- Unreflected-payment claims with receipts; finance verification credits a claim once.
- Special/supplementary applications, decisions, schedule, fees and numeric or competency results.
- Notices from authorised staff and class representatives.
- Private, self-reported funding checklists with official HEF/HELB links.
- Live in-app updates, calendar downloads, small evidence files and report drafts.

## Institution setup

Read [Kenya setup](docs/KENYA-SETUP.md) and [operations](docs/OPERATIONS.md). Sample policies are not national standards.

For real records, set DB_PATH to a new database and do not seed it. Staff sign up as lecturers. A trusted server operator assigns office roles:

```sh
node manage.mjs staff academic-office@example.edu department
node manage.mjs staff finance-office@example.edu finance
```

These users must sign in again. Department officers approve lecturers, configure programmes and units, review registrations/reports and record clearance. Finance officers maintain statements and payment claims. Public signup cannot grant an office role.

Programme rules and student programme assignments lock after results exist. Later policy changes or transfers need an explicitly reviewed migration. This pilot uses one institution-wide active academic period with semester, trimester or term labels; it is not a national multi-institution service.

## Tests

```sh
node --test test/*.test.mjs
```

Tests cover authorization, live events, evidence privacy, escalation, double-credit prevention, registration, notices, calculations, policy locks and competency records. Localhost connections must be permitted.

## Source

- public/: frontend and static shell cache.
- server.mjs: HTTP, authentication, core API and live events.
- upgrades.mjs: upgraded workflows and authorization.
- db.mjs and schema-v2.mjs: schema, additive migration and policies.
- manage.mjs and approve.mjs: trusted server administration.
- seed.mjs and seed-v2.mjs: fictional sample data.
- test/: automated checks.
- docs/: configuration and operational guidance.
- data/: private SQLite records, evidence, audit entries and sessions; excluded from Git.

## CSV

Download a template from Marks & analytics → Import CSV. Required columns:

```csv
reg_no,course_code,score,semester
CIT/001/2026,CIT101,84,2026/2027 · Semester 1
```

Maximum 500 rows and 200 KB. Invalid batches roll back. Students must be enrolled and the lecturer must own the unit. A final total replaces its old component breakdown. Competency programmes use the competency form.

## Hosting

Use one Node.js 24+ instance with persistent disk, HTTPS termination and streaming HTTP support. Start with node server.mjs; no build is needed.

| Variable | Default | Purpose |
| --- | --- | --- |
| PORT | 3000 | HTTP port |
| HOST | 127.0.0.1 | Use 0.0.0.0 behind a hosting proxy |
| DB_PATH | ./data/academytrack.sqlite | Persistent database file |
| APP_ORIGIN | http:// + request host | Exact public HTTPS origin |
| NODE_ENV | unset | Set production for Secure cookies |

Use shell/host environment variables; .env files are not automatically loaded. Run every command from this folder or provide the same absolute DB_PATH. Do not deploy known demo credentials with real student data.

## Boundaries

This is a configurable pilot, not a certified ERP or accredited assessment system. There is no automatic connection to university portals, KNEC, TVET CDACC, KNQA, HELB, HEF, banks or M-Pesa. The app does not issue official certificates or determine qualification equivalence.

Notifications are in-app; email, SMS and push are not connected. Only static files are cached, never private API records or evidence. An already-open app retains report text while disconnected; sign-in, live records and submission require a connection. Sign-out clears the user's local draft; account-synced drafts remain. Attachments are not saved in drafts.

The backend uses scrypt, HttpOnly sessions, origin checks, basic throttling, role checks and an operational audit trail. Before real deployment, add verified account ownership, password recovery, institutional privacy and retention procedures, independent security review and regular backups.

Nothing has been pushed to GitHub. You can edit, copy, move or self-host this source independently.
