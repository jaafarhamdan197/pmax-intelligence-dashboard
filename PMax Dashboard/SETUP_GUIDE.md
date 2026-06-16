# PMax Agency Dashboard — Full Setup Guide

## Overview

Three components working together:

```
Google Ads MCC
  └── mcc_pmax_script.js  ← runs daily, all MCC accounts

Google Ads (external clients)
  └── single_account_script.js  ← one per external account, same schedule

Central Google Sheet  ←  all scripts write here
  └── r_camp, r_ag, r_prod_t, r_prod_t_180
      r_dv, r_allads, r_ads, zombies

Private GitHub Repo
  └── index.html  ← dashboard, reads Sheet via Sheets API
      deployed via GitHub Pages
```

---

## Step 1 — Create the central Google Sheet

1. Go to sheets.google.com and create a blank sheet
2. Rename the default tab to r_camp
3. Add 7 more tabs (right-click tab > Insert):
   r_dv, r_prod_t, r_prod_t_180, r_ag, r_allads, r_ads, zombies
4. Leave all tabs completely empty — scripts write headers + data on first run

Sheet ID already configured in all files:
1pADqa7-Shz0H1lUyQ8658TfN4sA6f_3ymn-BY3G5JLg

---

## Step 2 — Share the Sheet with the scripts

Option A (simplest): Share > Anyone with the link > Editor
Option B (secure): Share only with the Google account email that owns each Google Ads account > Editor

---

## Step 3 — Install the MCC script

1. Go to your MCC account in Google Ads
2. Tools > Bulk Actions > Scripts > click +
3. Paste contents of mcc_pmax_script.js
4. Authorize > grant permissions (needs Google Sheets access)
5. Run once manually > check Logs tab
6. Set schedule: Daily at 11 PM or midnight

BLOCKLIST arrays are empty by default — add account names/IDs you want to skip.

---

## Step 4 — Install single-account scripts (external clients)

For each client account NOT linked to your MCC:

1. Go into that client's Google Ads account
2. Tools > Bulk Actions > Scripts > click +
3. Paste contents of single_account_script.js
4. Authorize > Run once > check Logs
5. Set schedule: Daily at the same time as MCC script

No config needed per client — the script picks up account name and ID automatically.

---

## Step 5 — Set up GitHub Pages

5a — Create a private GitHub repo
1. Go to github.com/new
2. Name it pmax-dashboard, set to Private
3. Create repository

5b — Upload index.html
1. Add file > Upload files > upload index.html
2. Commit to main

5c — Enable GitHub Pages
1. Repo > Settings > Pages
2. Source: Deploy from a branch > main / root
3. Save — URL appears after ~60 seconds:
   https://YOUR-USERNAME.github.io/pmax-dashboard/

Note: GitHub Pages on private repos requires GitHub Pro ($4/month)

5d — Add Pages URL to Google Cloud Console
1. console.cloud.google.com > APIs & Services > Credentials
2. Click your OAuth Client ID
3. Authorized JavaScript origins > Add: https://YOUR-USERNAME.github.io
4. Save

---

## Step 6 — Configure access control in index.html

Find these lines near the top of the script section:

  const ALLOWED_DOMAINS = [];
  const ALLOWED_EMAILS  = [];

Agency domain only:
  const ALLOWED_DOMAINS = ['youragency.com'];

Specific emails (for Gmail or external users):
  const ALLOWED_EMAILS = ['person@gmail.com'];

Any Google account (least restrictive):
  Leave both arrays empty []

After editing, re-upload index.html to GitHub. Pages redeploys in ~30 seconds.

---

## Dashboard features

Client filter       — dropdown of all accounts in the Sheet
Campaign filter     — cascades from client
KPI cards           — Cost, Conv Value, ROAS, Clicks + CTR
Cost Trend          — bar chart per day over the pull window (MAIN_DAYS), hover for detail
Asset Group Strength — EXCELLENT / GOOD / POOR / PENDING counts
Top 10 by Cost      — products ranked by spend, ROAS colour coded
Wasted Spend        — products with cost > 0 and 0 conversions
Asset Groups tab    — full list with strength labels
Zombie Alert        — count of 0-click products (last 366 days)

---

## Troubleshooting

"This app is blocked" on login
> Cloud Console > OAuth consent screen > add team emails as Test Users

"redirect_uri_mismatch"
> Add your GitHub Pages URL to Authorized JavaScript Origins in Cloud Console

Dashboard shows no data
> Run the MCC script manually first. Check Logs tab in Google Ads.

"Tab not found" in script logs
> A tab name is misspelled. All 8 names are case-sensitive.

Client missing from dropdown
> Their script has not run yet or errored. Check Logs in their Google Ads account.

Single-account and MCC scripts conflicting
> They target different account_ids so they won't overwrite each other.
> If running simultaneously, stagger by 30 minutes to be safe.

---

## Security notes

- OAuth Client ID in index.html is safe to be public — it only identifies the app
- Sheet is protected by Google account access (Step 2)
- Dashboard is read-only — never writes to the Sheet
- Access tokens expire after 1 hour — users re-login after that
- To revoke access: remove email from ALLOWED_EMAILS, re-upload index.html
