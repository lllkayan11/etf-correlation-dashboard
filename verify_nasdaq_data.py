import json
import random
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent
DATA_PATH = ROOT / "etf_daily_data_nasdaq.json"

HEADERS = {
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    "accept": "application/json, text/plain, */*",
    "referer": "https://www.nasdaq.com/",
    "origin": "https://www.nasdaq.com",
}


def parse_close(value):
    s = str(value).replace("$", "").replace(",", "").strip()
    return float(s)


def fetch_nasdaq_rows(symbol, assetclass):
    url = f"https://api.nasdaq.com/api/quote/{symbol}/historical"
    params = {
        "assetclass": assetclass,
        "fromdate": "2019-01-01",
        "todate": "2026-12-31",
        "limit": 10000,
        "offset": 0,
    }
    resp = requests.get(url, headers=HEADERS, params=params, timeout=30)
    resp.raise_for_status()
    payload = resp.json()
    rows = ((payload.get("data") or {}).get("tradesTable") or {}).get("rows", [])
    by_date = {}
    for r in rows:
        if not r.get("date") or not r.get("close"):
            continue
        mm, dd, yyyy = r["date"].split("/")
        iso = f"{yyyy}-{mm.zfill(2)}-{dd.zfill(2)}"
        by_date[iso] = parse_close(r["close"])
    return by_date


def main():
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    symbols = sorted(data.keys())

    rng = random.Random(20260424)
    sample_symbols = symbols if len(symbols) <= 8 else rng.sample(symbols, 8)

    total_checks = 0
    failed = []

    for symbol in sample_symbols:
        entry = data[symbol]
        records = entry.get("records", [])
        if len(records) < 10:
            continue
        assetclass = ((entry.get("info") or {}).get("assetclass") or "stocks").lower()
        remote = fetch_nasdaq_rows(symbol, assetclass)
        sample_rows = rng.sample(records[-120:], min(5, len(records[-120:])))

        for r in sample_rows:
            d = r["date"]
            local_close = round(float(r["close"]), 4)
            remote_close = round(float(remote.get(d, -1)), 4)
            total_checks += 1
            if remote_close < 0 or abs(local_close - remote_close) > 1e-4:
                failed.append(
                    {
                        "symbol": symbol,
                        "date": d,
                        "local_close": local_close,
                        "nasdaq_close": remote.get(d),
                    }
                )

    result = {
        "sample_symbols": sample_symbols,
        "total_checks": total_checks,
        "failed_checks": len(failed),
        "failures": failed,
    }
    out_path = ROOT / "nasdaq_data_verification_report.json"
    out_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"Verification report: {out_path}")
    print(f"Total checks: {total_checks}")
    print(f"Failed checks: {len(failed)}")
    if failed:
        for x in failed[:10]:
            print(f"- {x['symbol']} {x['date']} local={x['local_close']} nasdaq={x['nasdaq_close']}")


if __name__ == "__main__":
    main()
