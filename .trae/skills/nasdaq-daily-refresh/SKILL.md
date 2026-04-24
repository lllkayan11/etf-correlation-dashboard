---
name: "nasdaq-daily-refresh"
description: "Updates ETF daily OHLC data from Nasdaq and republishes GitHub Pages. Invoke when user asks for daily auto-refresh, data sync, or scheduled market updates."
---

# Nasdaq Daily Refresh

## Purpose
Automate daily synchronization of ETF OHLC data from Nasdaq and publish updated dashboard data to GitHub Pages.

## Invoke When
- User asks to run daily data refresh.
- User asks to sync latest closing prices from Nasdaq.
- User asks to schedule automatic data updates (e.g., every morning).

## Workflow
1. Run `python fetch_etf_data.py` to refresh `etf_daily_data_nasdaq.json`.
2. Run `python compile_jsx.py` to rebuild `app.compiled.js`.
3. Commit changed files to `main`.
4. Push to remote; GitHub Pages deployment workflow publishes updates.
5. Write run notification summary to GitHub Actions run page and `daily_refresh_summary.json`.

## Schedule
- GitHub Actions cron: `0 22 * * *` (UTC), equal to 06:00 Beijing time daily.
- Can also be triggered manually via `workflow_dispatch`.
