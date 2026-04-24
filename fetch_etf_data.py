import json
from datetime import datetime
from pathlib import Path

import requests

tickers_info = {
    "SPY": {"name": "SPDR S&P 500 ETF Trust", "region": "US", "color": "#3b82f6"},
    "EZU": {"name": "iShares MSCI Eurozone ETF", "region": "Europe", "color": "#f59e0b"},
    "INDA": {"name": "iShares MSCI India ETF", "region": "India", "color": "#f97316"},
    "KWEB": {"name": "KraneShares CSI China Internet ETF", "region": "China", "color": "#ef4444"},
    "EWH": {"name": "iShares MSCI Hong Kong ETF", "region": "Hong Kong", "color": "#ec4899"},
    "GLD": {"name": "SPDR Gold Shares", "region": "Global", "color": "#fbbf24"},
    "TLT": {"name": "iShares 20+ Year Treasury Bond ETF", "region": "US", "color": "#06b6d4"},
    "DBC": {"name": "Invesco DB Commodity Index Tracking Fund", "region": "Global", "color": "#10b981"},
    "VNQ": {"name": "Vanguard Real Estate ETF", "region": "US", "color": "#a78bfa"},
    "EWJ": {"name": "iShares MSCI Japan ETF", "region": "Japan", "color": "#84cc16"},
}

HEADERS = {
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    "accept": "application/json, text/plain, */*",
    "referer": "https://www.nasdaq.com/",
    "origin": "https://www.nasdaq.com",
}


def parse_num(value):
    if value is None:
        return None
    s = str(value).replace(",", "").replace("$", "").strip()
    if s in ("", "N/A"):
        return None
    return float(s)


def parse_date(mm_dd_yyyy):
    return datetime.strptime(mm_dd_yyyy, "%m/%d/%Y").strftime("%Y-%m-%d")

ROOT = Path(__file__).resolve().parent
OUTPUT_PATH = ROOT / "etf_daily_data_nasdaq.json"

all_data = {}

for ticker in tickers_info.keys():
    print(f"Fetching {ticker} from Nasdaq...")
    try:
        url = f"https://api.nasdaq.com/api/quote/{ticker}/historical"
        params = {
            "assetclass": "etf",
            "fromdate": "2019-01-01",
            "todate": "2026-12-31",
            "limit": 10000,
            "offset": 0,
        }
        resp = requests.get(url, headers=HEADERS, params=params, timeout=30)
        resp.raise_for_status()
        payload = resp.json()
        rows = ((payload.get("data") or {}).get("tradesTable") or {}).get("rows", [])
        if not rows:
            print(f"  No data for {ticker}")
            continue

        records = []
        for row in rows:
            if not row.get("date"):
                continue
            rec = {
                "date": parse_date(row["date"]),
                "open": parse_num(row.get("open")),
                "high": parse_num(row.get("high")),
                "low": parse_num(row.get("low")),
                "close": parse_num(row.get("close")),
                "volume": int(parse_num(row.get("volume")) or 0),
            }
            if None in (rec["open"], rec["high"], rec["low"], rec["close"]):
                continue
            records.append(rec)

        records.sort(key=lambda x: x["date"])

        all_data[ticker] = {
            "info": tickers_info[ticker],
            "records": records,
            "start_price": records[0]["close"] if records else None,
            "end_price": records[-1]["close"] if records else None,
            "total_return": round((records[-1]["close"] - records[0]["close"]) / records[0]["close"] * 100, 2) if records else None,
            "latest_date": records[-1]["date"] if records else None
        }

        print(f"  {ticker}: {len(records)} daily records, from {records[0]['date']} to {records[-1]['date']}")
        print(f"  Start: ${records[0]['close']}, End: ${records[-1]['close']}, Return: {all_data[ticker]['total_return']}%")

    except Exception as e:
        print(f"  Error fetching {ticker}: {e}")

# Save to JSON inside repository for GitHub Pages deployment
with OUTPUT_PATH.open("w", encoding="utf-8") as f:
    json.dump(all_data, f, indent=2, ensure_ascii=False)

print(f"\nData saved to {OUTPUT_PATH}")
print(f"Total ETFs: {len(all_data)}")
