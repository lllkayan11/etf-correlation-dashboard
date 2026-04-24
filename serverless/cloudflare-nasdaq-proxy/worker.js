export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    if (url.pathname !== "/historical") {
      return json({ error: "Not found" }, 404);
    }

    const symbol = String(url.searchParams.get("symbol") || "").trim().toUpperCase();
    const fromdate = String(url.searchParams.get("fromdate") || "").trim();
    const todate = String(url.searchParams.get("todate") || "2099-12-31").trim();

    if (!/^[A-Z.\-]{1,10}$/.test(symbol)) {
      return json({ error: "Invalid symbol" }, 400);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromdate)) {
      return json({ error: "Invalid fromdate, expected YYYY-MM-DD" }, 400);
    }

    const classes = ["stocks", "etf"];
    for (const assetclass of classes) {
      const api = new URL(`https://api.nasdaq.com/api/quote/${symbol}/historical`);
      api.searchParams.set("assetclass", assetclass);
      api.searchParams.set("fromdate", fromdate);
      api.searchParams.set("todate", todate);
      api.searchParams.set("limit", "10000");
      api.searchParams.set("offset", "0");

      const resp = await fetch(api.toString(), {
        headers: {
          "user-agent": "Mozilla/5.0",
          "accept": "application/json, text/plain, */*",
          "origin": "https://www.nasdaq.com",
          "referer": "https://www.nasdaq.com/",
        },
      });
      if (!resp.ok) continue;

      const payload = await resp.json();
      const rows = (((payload || {}).data || {}).tradesTable || {}).rows || [];
      if (rows.length > 0) {
        return json({ source: "nasdaq", symbol, assetclass, rows }, 200);
      }
    }

    return json({ error: `No Nasdaq data for ${symbol}` }, 404);
  },
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(),
    },
  });
}
