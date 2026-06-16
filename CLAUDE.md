# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

A read-only **PMax (Performance Max) intelligence dashboard** built for Initiative (the media agency). It has three components that work together:

1. **Google Ads Scripts** — run daily, pull PMax data via GAQL, write to a central Google Sheet
2. **Central Google Sheet** (`1pADqa7-Shz0H1lUyQ8658TfN4sA6f_3ymn-BY3G5JLg`) — the data store; 8 named tabs
3. **`index.html`** — a single-file dashboard deployed on GitHub Pages; reads the Sheet via the Sheets API using an OAuth token

## File Map

| File | Purpose |
|------|---------|
| `PMax Dashboard/mcc_pmax_script.js` | Google Ads script for MCC (multi-client) accounts |
| `PMax Dashboard/single_account_script.js` | Google Ads script for external accounts not under MCC |
| `single_account_script.js` | Copy of the above at repo root |
| `PMax Dashboard/index.html` | The entire dashboard — HTML + CSS + JS in one file |
| `PMax Dashboard/SETUP_GUIDE.md` | Step-by-step deployment guide |
| `PMax Dashboard/launch_dashboard_*.{bat,command}` | Local launcher scripts |

## Architecture: Data Flow

```
Google Ads (GAQL queries)
  → Google Ads Script (mcc_pmax_script.js or single_account_script.js)
    → Google Sheet tabs: r_camp, r_dv, r_prod_t, r_prod_t_180, r_ag, r_allads, r_ads, zombies
      → index.html (Sheets API v4, OAuth)
        → in-browser DL (Derived Layer) object → Chart.js + HTML tables
```

## index.html Architecture

The dashboard is entirely self-contained in one HTML file. Key architectural concepts:

**Auth flow**: Google Identity Services (GSI) OAuth 2.0 implicit flow. `CLIENT_ID` and `SHEET_ID` are hardcoded near the top of the `<script>` block. Access is gated by `ALLOWED_DOMAINS` and `ALLOWED_EMAILS` arrays.

**Data load**: `loadData()` fetches 6 sheet tabs in parallel via `Promise.all`. Raw data lives in `raw{}` (keyed by tab name).

**Derived Layer (`DL`)**: `buildDL()` joins and aggregates `raw` into structured objects consumed by all render functions:
- `DL.cd` — campaign+date rows with channel cost split (shop/video/display/search inferred from asset types in `r_allads`)
- `DL.totals` — campaign totals (sum over all dates)
- `DL.skp` — per-campaign sparkline arrays aligned to `DL.allDates`
- `DL.agm` — asset group rows with ad strength
- `DL.topp` — product rows with ROAS/CPA computed

**Channel attribution**: The `r_dv` tab provides asset-level interaction costs. `r_allads` maps `asset.resource_name → channel` (video/display/shop). Search cost = total campaign cost minus attributed channel costs.

**Rendering**: `renderAll()` calls five render functions (`renderOverview`, `renderCharts`, `renderCampaigns`, `renderAG`, `renderProducts`) and `renderZombies`. Charts are Chart.js instances stored in `charts{}` — destroyed and recreated on re-render. Tables are built with `innerHTML` from helper functions (`tbl()`, `th()`, `td()`).

**Filters**: Client dropdown → cascades to Campaign dropdown. Both filter the DL arrays via `fcd()`, `ftot()`, `fagm()`, `fskp()`, `fprod()` before rendering.

## Google Ads Script Architecture

Both scripts (`mcc_pmax_script.js` and `single_account_script.js`) share identical internal logic via `runForAccount()`. The MCC version iterates all accounts via `MccApp.accounts()`.

**Write strategy**: Before writing, `clearAccountRows(ss, accountId)` removes only rows belonging to the current `accountId` across all 8 tabs via a bulk read-filter-rewrite (keeps header + other accounts' rows, one `setValues` + one trailing `clearContent` per tab — not row-by-row `deleteRow`).

**Date windows** are set by constants in each script's `main()` CONFIG: `MAIN_DAYS` (currently 180) drives `r_camp`/`r_dv`/`r_prod_t`/`r_ag`, `PROD_DAYS` (181) drives `r_prod_t_180`, `ZOMBIE_DAYS` (366) drives `zombies`. They're applied via a `segments.date BETWEEN` clause built in `runForAccount`.

**Sheet tabs written**:
- `r_camp` — daily campaign metrics (MAIN_DAYS window)
- `r_dv` — asset interaction breakdown (for channel attribution)
- `r_prod_t` — product performance (MAIN_DAYS window)
- `r_prod_t_180` — product performance (PROD_DAYS = 181; not read by the dashboard)
- `r_ag` — asset group performance by date
- `r_allads` — all assets with type (used to map resource_name → channel)
- `r_ads` — ad-level data
- `zombies` — products with 0 clicks in last 366 days

## Deployment

There is no build step. To update the dashboard:
1. Edit `index.html` directly
2. Upload/commit it to the GitHub repo — GitHub Pages redeploys in ~30 seconds

To update scripts:
1. Edit the `.js` file
2. Paste updated code into Google Ads > Tools > Scripts

## Key Config Values (in index.html)

```js
const CLIENT_ID = '525596564772-6uglraensi4slajm7nl96umvbkoe6el6.apps.googleusercontent.com';
const SHEET_ID  = '1pADqa7-Shz0H1lUyQ8658TfN4sA6f_3ymn-BY3G5JLg';
const ALLOWED_DOMAINS = []; // e.g. ['initiative.com']
const ALLOWED_EMAILS  = []; // e.g. ['person@gmail.com']
```

OAuth origins must be registered in Google Cloud Console for the deployed Pages URL.

## Common Editing Tasks

**Add a new dashboard tab**: Add a `.nav-tab` button in the `<nav>`, add a `.page` div with matching `id="pg-X"`, add a render function `renderX(f)`, call it from `renderAll()`.

**Add a new Sheet tab / metric**: Add the tab name to the `tabs` array in `loadData()`, add the GAQL query to both scripts, then consume `raw['tab_name']` in `buildDL()`.

**Change the date window**: Edit the `MAIN_DAYS` (primary), `PROD_DAYS`, or `ZOMBIE_DAYS` constants in each script's CONFIG block — the `BETWEEN` clauses derive from them, no query edits needed. The dashboard reads whatever is in the Sheet and derives its day-count labels from the data span (`WIN_DAYS` / `updateScopeLabels()`), so labels stay correct automatically.

**Add/remove accounts from MCC script**: Add account name or ID to `BLOCKLIST` / `BLOCKLIST_IDS` arrays in `mcc_pmax_script.js`.
