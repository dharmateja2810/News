# n8n (Automation) for DailyDigest

This folder contains local n8n setup + starter workflows to ingest news and push into the DailyDigest backend.

## Local setup (recommended right now: **no Docker**)

Docker image pulls are timing out on this machine, so the fastest path is to run n8n via `npx`.

### 1) Start the backend first

Backend should be running at `http://localhost:3000/api`.

### 2) Start n8n

From repo root:

```powershell
cd automation\n8n
.\start.ps1
```

Then open:
- **n8n UI**: `http://localhost:5678`

### 3) Import workflow

In n8n UI:
- Workflows → Import from file
- Import `automation/n8n/workflows/afr-homepage-to-backend.json`

Run it manually once to verify it inserts articles.

## What this workflow does

- Fetches the AFR homepage (`https://www.afr.com/`)
- Extracts a small set of article links/titles from the HTML (best-effort; selectors can change)
- Posts each item into the backend:
  - `POST http://localhost:3000/api/articles`
  - Header `x-webhook-secret: dailydigest-n8n-webhook-secret` (configured in `start.ps1`)

## Important note (AFR scraping)

AFR is a commercial publisher. Scraping may be restricted by their terms, paywall, or robots rules.
For production, prefer a licensed feed/API and/or only ingest metadata you’re permitted to use, with proper attribution.

AFR homepage: `https://www.afr.com/`



