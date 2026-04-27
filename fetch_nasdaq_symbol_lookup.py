import json
import time
from pathlib import Path

import requests

HEADERS = {
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    "accept": "application/json, text/plain, */*",
    "referer": "https://www.nasdaq.com/",
    "origin": "https://www.nasdaq.com",
}

ROOT = Path(__file__).resolve().parent
OUTPUT_PATH = ROOT / "nasdaq_symbol_lookup.json"


def fetch_page(limit: int, offset: int):
    url = "https://api.nasdaq.com/api/screener/stocks"
    params = {
        "tableonly": "true",
        "limit": limit,
        "offset": offset,
        "download": "true",
    }
    last_err = None
    for _ in range(3):
        try:
            resp = requests.get(url, headers=HEADERS, params=params, timeout=30)
            resp.raise_for_status()
            payload = resp.json()
            break
        except Exception as err:
            last_err = err
            time.sleep(1.2)
    else:
        raise RuntimeError(f"Failed Nasdaq screener request: {last_err}")
    data = payload.get("data") or {}
    rows = data.get("rows") or []
    total = data.get("totalRecords") or len(rows)
    return rows, int(total)


def main() -> None:
    limit = 5000
    offset = 0
    all_rows = []

    try:
        rows, total = fetch_page(limit=limit, offset=offset)
        all_rows.extend(rows)
    except Exception as err:
        if OUTPUT_PATH.exists():
            print(f"Warning: refresh lookup failed, keep existing file: {err}")
            return
        raise

    symbols = {}
    for row in all_rows:
        symbol = str(row.get("symbol") or "").strip().upper()
        name = str(row.get("name") or "").strip()
        if not symbol:
            continue
        if symbol in symbols:
            continue
        symbols[symbol] = {
            "symbol": symbol,
            "name": name,
            "exchange": str(row.get("exchange") or "").strip(),
            "country": str(row.get("country") or "").strip(),
        }

    items = sorted(symbols.values(), key=lambda r: r["symbol"])
    OUTPUT_PATH.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved {len(items)} symbols to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
