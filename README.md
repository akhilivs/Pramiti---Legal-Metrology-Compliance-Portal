# Pramiti – Legal Metrology Compliance Portal

[![CI](https://github.com/akhilivs/Pramiti---Legal-Metrology-Compliance-Portal/actions/workflows/ci.yml/badge.svg)](https://github.com/akhilivs/Pramiti---Legal-Metrology-Compliance-Portal/actions/workflows/ci.yml)

*सही माप, सही दाम*: honest measure, fair price.

Pramiti is an enforcement platform for Legal Metrology departments. It checks pre-packaged commodity labels
and e-commerce listings against the **Legal Metrology (Packaged Commodities) Rules, 2011**. It turns the
findings into officer-reviewed records and show-cause notices, and gives the department state-wise and
manufacturer-wise intelligence.

> Prototype built for Smart India Hackathon. AI findings are advisory and must be verified by an officer.

## Live demo

**<https://pramiti-gamma.vercel.app>**

| Page | Link |
| --- | --- |
| Officer portal (sign in required) | <https://pramiti-gamma.vercel.app> |
| Public complaint portal | <https://pramiti-gamma.vercel.app/complaint> |
| Track a complaint | <https://pramiti-gamma.vercel.app/complaint/track> |

The frontend is hosted on Vercel, the API on Render (free plan) and the database on Neon. Render puts free
services to sleep after 15 idle minutes; [`keep-awake.yml`](.github/workflows/keep-awake.yml) pings the API
every 10 minutes to prevent that. If GitHub delays a ping, the first request can take about a minute.
Officer accounts are issued by the administrator; the demo credentials below are for local installs only.

## What it does

| Area | Features |
| --- | --- |
| **Inspect** | Photograph up to 4 faces of a pack, by upload, drag-and-drop, paste or the phone camera. Gemini reads the label and answers 15 rule-wise checks. |
| **Fraud checks** | MRP over-sticker / tampering detection (Rule 6(3)). A **computed** unit-price check (MRP ÷ quantity). **Short-quantity** check: the officer enters the weighed quantity and it is compared with the official First Schedule error limits. |
| **E-commerce** | Paste a product URL, or the listing text or screenshots, to check Rule 6(10) declarations on the listing. Requests to internal network addresses are blocked. |
| **Bulk scan** | Many photos, a ZIP (one folder per product) or a list of URLs, processed in the background with live progress. |
| **Explainable AI** | Boxes on the photo show where each declaration was read. Hovering a finding highlights it. |
| **Officer review** | Confirm or override every AI finding, with a reason. The verdict is recomputed and every change is logged. |
| **Notices** | One-click show-cause notice citing the contraventions and Section 36 penalties. Workflow: draft → approved → issued (numbered) → replied → closed. Formal PDF. |
| **Insights** | India tile map of non-compliance by State/UT, **repeat-offender ranking** with risk levels, violations by rule and category. |
| **Consumer portal** | Public `/complaint` page: citizens upload a photo, get an instant AI pre-screen and a tracking number. Officers handle it at the Complaint Desk. Rate-limited. |
| **Accuracy** | Agreement, precision and recall of the AI per rule, built from officer reviews. `benchmark.py` measures it against hand-labelled photos. |
| **Governance** | Inspector, Controller and Admin roles. PBKDF2 password hashes. Signed sessions. Full audit log. User management. |
| **Field-ready** | English / हिंदी interface, installable PWA, offline capture queue that uploads automatically when back online, text-size controls. |
| **Demo data** | About 60 fictional inspections across 18 states with drawn labels, reviews, notices and complaints. Each is marked **Demo**, and the Admin page can load or remove them with one click. |

## Requirements

| What | Notes |
| --- | --- |
| Python 3.10+ | tested on 3.13 |
| Node.js 20.9+ | tested on 22 |
| **Gemini API key** | **The only key needed.** Free at <https://aistudio.google.com/apikey>. Enable billing for heavier use, since the free tier has daily limits. |

## Setup and run

```bash
git clone https://github.com/akhilivs/Pramiti---Legal-Metrology-Compliance-Portal.git
cd Pramiti---Legal-Metrology-Compliance-Portal

cd backend
pip install -r requirements.txt
copy .env.example .env            # Windows (macOS/Linux: cp .env.example .env), then put your GEMINI_API_KEY in .env
python seed_demo.py               # optional: load demonstration data (python seed_demo.py --clear removes it)
python build_rules_index.py       # optional, one-time: transcribe the scanned Gazette (already done)

cd ../frontend
npm install
```

Run on Windows by double-clicking **`start.bat`**. To start each part by hand:
`cd backend && python -m uvicorn main:app --port 8000` and `cd frontend && npm run dev`.

Open <http://localhost:3000>. The public complaint portal is at <http://localhost:3000/complaint>.

### Accounts created on first start (local install)

| Role | E-mail | Password |
| --- | --- | --- |
| Admin | `official@metrology.gov.in` | `admin123` (from `.env`) |
| Controller | `controller@metrology.gov.in` | `controller123` |
| Inspector | `inspector@metrology.gov.in` | `inspector123` |

Change these from **Admin → Users** before any real use.

## Deploying to production

Keep every secret out of the code. Locally they live in `backend/.env` and `frontend/.env.local`, both
git-ignored. On a server, set them in the host's environment or secret settings (Vercel, AWS, Render,
Heroku and so on) instead of uploading `.env` files.

| Where | Variables |
| --- | --- |
| Backend | `PRAMITI_ENV=production`, `SECRET_KEY` (long random string), `ADMIN_PASSWORD`, `GEMINI_API_KEY`, `CORS_ORIGINS` (the real frontend URL), optionally `GOOGLE_CLIENT_ID`, `DATABASE_URL`, `UPLOAD_DIR` |
| Frontend | `NEXT_PUBLIC_API_URL`, optionally `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_SHOW_DEMO_LOGIN=false` |

With `PRAMITI_ENV=production` the backend **refuses to start** while demo defaults remain: no
`SECRET_KEY`, the demo admin password, or localhost in `CORS_ORIGINS`. It also skips creating the demo
controller and inspector accounts. "Sign in with Google" needs only the client ID; the OAuth client
secret is not used anywhere and should not be stored. Add the production frontend URL as an
*Authorised JavaScript origin* in Google Cloud Console.

Build the frontend with `npm run build` and serve it with `npm start`. Development mode (`npm run dev`) is
not minified and is much slower.

### Free hosting: Neon (database) + Render (backend) + Vercel (frontend)

None of the three needs a card. Render's free plan has no persistent disk, so the data lives in a free
Neon Postgres database. With any non-SQLite `DATABASE_URL`, every photo is also stored in the database
and written back to `uploads/` when the server starts ([`photo_store.py`](backend/photo_store.py)).

1. **Database on Neon**: sign up at neon.tech, create a project, and copy its connection string
   (`postgresql://...neon.tech/...?sslmode=require`).
2. **Backend on Render**: *New → Blueprint*, pick this repository. [`render.yaml`](render.yaml) creates
   a free web service with a generated `SECRET_KEY`. Enter `DATABASE_URL` (the Neon string),
   `GEMINI_API_KEY`, `ADMIN_PASSWORD` and `CORS_ORIGINS` (your Vercel URL) when asked. Check
   `https://<service>.onrender.com/api/health`.
3. **Frontend on Vercel**: *Add New → Project*, import this repository, set **Root Directory** to
   `frontend`, and set `NEXT_PUBLIC_API_URL` to the Render URL (no trailing slash). These values are
   built into the site, so redeploy after changing them.
4. If the Vercel URL differs from `CORS_ORIGINS`, update it on Render. For Google sign-in, add the Vercel
   URL as an Authorised JavaScript origin.

Free-plan limits: the backend sleeps after 15 idle minutes (the keep-awake workflow pings it every 10
minutes; change its URL if your Render service has a different name); Neon's free database holds 0.5 GB (several thousand inspections with photos). Every push to
`main` redeploys both. If Hindi text in notice PDFs shows as boxes, add a Noto Sans Devanagari font to the
repository and set `PDF_FONT_PATH` to it.

## Backups

`backend/backup.py` makes a consistent copy of the SQLite database and a ZIP of the photos in
`backend/backups/<date_time>/`, checks it, and deletes backups older than 14 days. It is safe to run
while the server is up.

```bash
cd backend
python backup.py                       # back up now, then verify
python backup.py --list                # list backups
python backup.py --verify              # re-check the newest one
python backup.py --restore 2026-10-22_020000   # stop the server first
```

**Schedule it daily**:

- Windows: `schtasks /create /tn "Pramiti backup" /sc daily /st 02:00 /tr "cmd /c cd /d C:\path\to\backend && python backup.py >> backups\backup.log 2>&1"`
- Linux (crontab): `0 2 * * * cd /srv/pramiti/backend && python backup.py >> backups/backup.log 2>&1`

**Disaster recovery**: copy `backend/backups/` to another machine or cloud storage (for example a
nightly `rclone`/`aws s3 sync`), because a backup on the same disk is lost with that disk. To recover,
install the app on a new machine, copy a backup folder in, and run `python backup.py --restore <name>`.
A restore keeps the replaced database as `compliance.before-restore-<time>.db`. Test a restore every
few months. With PostgreSQL (`DATABASE_URL=postgresql://...`), use the provider's automated daily backups
or `pg_dump` instead.

## Tests and CI

`.github/workflows/ci.yml` runs on every push and pull request (results in the repository's **Actions** tab):

- **Backend**: `pytest` smoke tests against a throwaway database (startup, sign-in, role checks).
- **Frontend**: lint, type check, production build, and `npm audit` of runtime dependencies.

Run the same checks locally:

```bash
cd backend  && pip install -r requirements-dev.txt && python -m pytest -q tests
cd frontend && npm run lint && npm run typecheck && npm run build
```

## Suggested 3-minute demo

1. **Dashboard**: point out the tiles and trend, then switch to **हिंदी** and back.
2. **Inspect** a label with an over-sticker. Enter a measured quantity below the declared one. The computed checks catch the unit-price mismatch and the short weight even when the AI misses the sticker.
3. Open the record, **hover findings** to see the boxes, then **Review findings** and override one with a reason.
4. **Raise show-cause notice**. Sign in as the controller to approve and issue it, then download the PDF.
5. **Insights**: show the state tile map and the high-risk repeat offenders, then open a manufacturer.
6. **Online listing**: paste listing text to show the Rule 6(10) checks.
7. Open `/complaint` in a private window, file a complaint, and track it.
8. **Accuracy** page (as controller/admin), then the **Audit log** (admin).

## Project layout

```
backend/
  main.py              app + router wiring          routers/   auth, scans, batches, insights, notices, complaints, admin
  config.py            settings from .env           database.py / models.py  SQLAlchemy setup and tables
  auth.py              passwords, sessions, roles   services.py  shared create/verdict logic
  analyzer.py          Gemini vision analysis       quantity.py  unit-price & First Schedule
  ecommerce.py         listing fetcher (SSRF-safe)  batch_worker.py  background bulk queue
  rules_kb.py          rules, checks, penalties     rag_engine.py  BM25 over rules + Gazette
  notice_pdf.py / pdf_generator.py  PDFs            build_rules_index.py  Gazette transcription
  seed_demo.py         demo data                    benchmark.py  accuracy benchmark
  backup.py            backup / restore             photo_store.py  photos kept in a hosted database
  tests/               pytest smoke tests
frontend/src/
  app/                 /, /history, /scans/[id], /batch, /batch/[id], /insights, /offenders/[key],
                       /notices, /notices/[id], /complaints, /complaint and /complaint/track (public),
                       /accuracy, /admin, /admin/audit, /account, /rules
  components/          Scanner, ScanReport, PhotoViewer, IndiaTileMap, AppShell, ...
  lib/                 api.ts, i18n.tsx (Hindi), offline.ts (IndexedDB queue)
```

## Notes

- The bundled `sih_eng.pdf` is the scanned 2011 Gazette. It has been transcribed to `backend/data/rules_corpus.json`. Later amendments (2017 e-commerce, country of origin, unit sale price 2021) are summarised in `rules_kb.py`. Verify against the current notification before enforcement.
- Penalty text in notices follows Section 36 of the Legal Metrology Act, 2009. Have the department's legal cell confirm the wording.
- The design uses original motifs. The State Emblem of India is deliberately not used, because its use is restricted by law.
