# Auto Project – Jira Ticket Management Dashboard

A read-only dashboard for your company's **Jira Cloud** projects (default: `TDF` and `BE`).
It shows live ticket counts per workflow status, charts, and a searchable, filterable,
sortable, paginated ticket explorer with CSV export and links straight to Jira.

Nothing about your tickets, statuses, assignees, priorities or issue types is hard-coded.
Everything is discovered from the Jira API at run time, so renamed or new statuses appear
without any code change.

## 1. Quick start (Windows PowerShell)

You only need three values: **Jira URL, Jira email, Jira API token**.
Create a token at <https://id.atlassian.com/manage-profile/security/api-tokens>.

**Terminal 1 – backend**

```powershell
cd auto-project\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1          # if blocked: Set-ExecutionPolicy -Scope Process Bypass
pip install -r requirements.txt
Copy-Item .env.example .env
notepad .env                           # fill JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 – frontend**

```powershell
cd auto-project\frontend
npm install
npm run dev
```

| What | URL |
|---|---|
| Dashboard (open this) | <http://localhost:5173> |
| Backend API | <http://localhost:8000/api> |
| API docs (development only) | <http://localhost:8000/docs> |

The green **Connected to Jira** indicator in the sidebar confirms the credentials work.
If something is wrong, the dashboard tells you exactly what to fix.

## 2. Technology stack

* **Frontend:** React 18, TypeScript (strict), Vite, Tailwind CSS, Lucide icons, React Router, Fetch API
* **Backend:** Python 3.12, FastAPI, HTTPX, Pydantic v2, python-dotenv
* **Jira:** Cloud REST API v3, using `GET /rest/api/3/search/jql` with `nextPageToken` pagination
* **Tests:** pytest + respx (backend), Vitest + Testing Library (frontend)
* **Deployment:** Docker, Docker Compose, nginx

## 3. Folder structure

```text
auto-project/
├── backend/
│   ├── app/
│   │   ├── api/            HTTP routes (read-only GET endpoints)
│   │   ├── core/           config, errors, logging, TTL cache
│   │   ├── integrations/   Jira REST client (retries, rate limits, pagination)
│   │   ├── schemas/        Pydantic request/response models
│   │   ├── services/       JQL builder, normalizer, dashboard/issue logic
│   │   ├── models/ utils/  (reserved; the app owns no persistent data)
│   │   └── main.py         FastAPI app factory
│   ├── tests/              automated tests (mock Jira lives only here)
│   ├── requirements.txt    pinned runtime deps
│   ├── requirements-dev.txt
│   ├── .env.example
│   └── Dockerfile
├── frontend/
│   ├── src/  components/ pages/ layouts/ hooks/ services/ context/ types/ utils/ styles/ test/
│   ├── package.json  vite.config.ts  tailwind.config.js  tsconfig.json
│   ├── .env.example  nginx.conf  Dockerfile
├── docker-compose.yml
├── README.md
└── .gitignore
```

## 4. Prerequisites

* Python 3.12 or newer
* Node.js 20 or newer (22 recommended) and npm
* A Jira Cloud account with permission to browse the `TDF` and `BE` projects
* Optional: Docker Desktop for the container setup

## 5. Configure Jira credentials

Edit **`backend/.env`** (copied from `backend/.env.example`). Never commit it.

```env
JIRA_BASE_URL=https://your-company.atlassian.net
JIRA_EMAIL=your-email@company.com
JIRA_API_TOKEN=your-api-token
JIRA_PROJECT_KEYS=TDF,BE
```

The token is only ever read by the backend. It is never sent to the browser, returned by
the API, or written to logs. All Jira calls are `GET` requests; the app cannot create,
edit, delete or transition tickets. Restart the backend after editing `.env`.

Optional settings (defaults in `.env.example`): `APP_ENV`, `LOG_LEVEL`, `FRONTEND_ORIGINS`,
`CACHE_TTL_SECONDS`, `JIRA_TIMEOUT_SECONDS`, `JIRA_MAX_RETRIES`, `DEFAULT_PAGE_SIZE`, `MAX_PAGE_SIZE`.

## 6. Features

* **Overview:** per project, a total plus one card per Jira status, a status donut and bars,
  and priority / issue-type breakdowns.
* **Project explorer (one per configured project):** clickable status cards, status dropdown,
  search (ticket ID or summary), assignee, issue type, priority, created and updated date
  ranges, sortable Created/Updated columns, server-side pagination, result count, reset,
  refresh and **CSV export of every ticket matching the current filters** (not just the page).
* Ticket IDs and **Open in Jira** buttons open the real issue (`<JIRA_BASE_URL>/browse/<KEY>`) in a new tab.
* **Last synced** time, **cached** badge, manual **Refresh from Jira** (bypasses the cache),
  connection indicator, loading skeletons, empty and error states, responsive sidebar.

Filters combine with AND and are translated to JQL on the server, e.g.
`project = "TDF" AND status = "Closed" AND priority = "High" AND summary ~ "login*"`.

## 7. How accuracy and caching work

* Dashboard counts come from **one pass per project** over every issue (following
  `nextPageToken`), de-duplicated by key, so no ticket is skipped or counted twice and the
  per-status counts always add up to the project total.
* A short-lived cache (`CACHE_TTL_SECONDS`, default 60 s; `0` disables it) avoids repeated Jira
  calls. Every response says when its data was **actually fetched** and whether it was
  **cached**; the UI shows both. **Refresh** forces fresh data.
* Failures are shown as errors, never as zero counts. If one project fails (for example a
  permission problem), the other project still renders.

## 8. API reference

All endpoints are `GET` and also available under `/api/v1/...`.

| Endpoint | Purpose |
|---|---|
| `/api/health` | Liveness (no Jira call) |
| `/api/ready` | Readiness: tests the Jira connection (503 + reason if not ready) |
| `/api/projects` | Configured projects with names discovered from Jira |
| `/api/dashboard` | Summaries for all projects |
| `/api/projects/{key}/summary` | Total, status counts, filter options |
| `/api/projects/{key}/statuses` | Workflow statuses with counts |
| `/api/projects/{key}/issues` | Paginated issues |
| `/api/projects/{key}/issues/{issue_key}` | One issue |
| `/api/projects/{key}/export` | CSV of all issues matching the filters |

Query parameters for `issues` / `export`: `status`, `search`, `assignee` (account id or
`__unassigned__`), `issue_type`, `priority`, `created_after`, `created_before`,
`updated_after`, `updated_before` (`YYYY-MM-DD`), `sort_by` (`created|updated`),
`sort_order` (`asc|desc`); `issues` also takes `page`, `page_size`, `refresh`.
Errors always look like `{"error": {"code", "message", "hint"}}`.

## 9. Troubleshooting

**Authentication errors (`Jira rejected the email or API token`, code `jira_auth_failed`)**
1. `JIRA_EMAIL` must be the Atlassian account email that created the token.
2. Create a fresh API token and paste it without quotes or spaces.
3. `JIRA_BASE_URL` must be your site root, e.g. `https://your-company.atlassian.net`.
4. Restart the backend after editing `.env`.

**Permission errors (`No permission to read this Jira data`, code `jira_forbidden`)**
The account lacks *Browse Projects* on that project. Ask a Jira admin to grant it. Only tickets
your account can see are counted ("accessible tickets").

**Project not found / not configured**
Check the spelling of `JIRA_PROJECT_KEYS` (uppercase keys, comma separated).

**"The backend is not reachable"** — start the backend (`uvicorn app.main:app --port 8000`).
**Rate limiting** — the backend retries automatically (honouring `Retry-After`); wait a minute if it persists.
**Slow first load on very large projects** — the first load reads every issue once; later loads use the cache.

## 10. Change project keys

Edit `JIRA_PROJECT_KEYS` in `backend/.env` (e.g. `JIRA_PROJECT_KEYS=TDF,BE,OPS`) and restart the
backend. The sidebar, overview and explorers update automatically; no code changes.

## 11. Tests and validation

```powershell
# backend
cd backend; pip install -r requirements-dev.txt; python -m pytest
# frontend
cd frontend; npm run typecheck; npm test; npm run build
```

Mocked Jira responses exist **only** inside the automated tests. Running the app always uses the real Jira API.

## 12. Production build and deployment

**Without Docker**

```powershell
cd frontend; npm run build            # static files in frontend\dist
cd ..\backend; $env:APP_ENV="production"; uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Serve `frontend/dist` with any web server and proxy `/api` to the backend (see `frontend/nginx.conf`).

**With Docker Compose**

```powershell
Copy-Item backend\.env.example backend\.env   # fill in the three Jira values
docker compose up --build -d
```

Open <http://localhost:8080>. The frontend container (nginx) proxies `/api` to the backend, so the
browser never talks to Jira or sees the token. Both containers have health checks.

Production notes:
* Put the stack behind HTTPS (reverse proxy or load balancer). With `APP_ENV=production` the backend
  requires an `https://` Jira URL, hides `/docs`, and logs JSON.
* Use a dedicated Jira account with read-only access to the needed projects (least privilege) and store
  the token in your secret manager rather than a file when possible.
* **Backup and recovery:** the app owns no database or persistent data; Jira is the source of truth.
  The only state to protect is `backend/.env` (keep it in a secret store). Recovery = redeploy and
  restore that configuration.

## 13. Known limitations

* The cache is per backend process; multiple replicas each keep their own.
* Jira's enhanced search does not return totals, so exact counts are obtained by walking all pages
  (cached). Projects with hundreds of thousands of issues will load slowly the first time.
* Assignee, issue-type and priority options list values that exist on the project's tickets.
* Jira Cloud only (REST API v3); Jira Server / Data Center is not supported.
