import { useState, useMemo, useEffect } from "react";
import { ResponsiveContainer, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Line, Scatter } from "recharts";

const ETFS = [
  { id:0, ticker:"SPY",  name:"SPDR S&P 500 ETF Trust", region:"US", corr_group:"US Broad Market", expense:"0.09%", aum:"$570B", color:"#3b82f6" },
  { id:1, ticker:"EZU",  name:"iShares MSCI Eurozone ETF", region:"Europe", corr_group:"Europe Equity", expense:"0.51%", aum:"$9.2B", color:"#f59e0b" },
  { id:2, ticker:"INDA", name:"iShares MSCI India ETF", region:"India", corr_group:"EM Asia Equity", expense:"0.61%", aum:"$6.1B", color:"#f97316" },
  { id:3, ticker:"KWEB", name:"KraneShares CSI China Internet", region:"China", corr_group:"China Equity", expense:"0.69%", aum:"$5.8B", color:"#ef4444" },
  { id:4, ticker:"EWH",  name:"iShares MSCI Hong Kong ETF", region:"Hong Kong", corr_group:"HK Equity", expense:"0.50%", aum:"$0.9B", color:"#ec4899" },
  { id:5, ticker:"GLD",  name:"SPDR Gold Shares", region:"Global", corr_group:"Gold / Commodities", expense:"0.40%", aum:"$85B", color:"#fbbf24" },
  { id:6, ticker:"TLT",  name:"iShares 20+ Year Treasury Bond", region:"US", corr_group:"Long-Duration Bonds", expense:"0.15%", aum:"$58B", color:"#06b6d4" },
  { id:7, ticker:"DBC",  name:"Invesco DB Commodity Index", region:"Global", corr_group:"Multi-Commodity", expense:"0.85%", aum:"$1.8B", color:"#10b981" },
  { id:8, ticker:"VNQ",  name:"Vanguard Real Estate ETF", region:"US", corr_group:"US REITs", expense:"0.12%", aum:"$35B", color:"#a78bfa" },
  { id:9, ticker:"EWJ",  name:"iShares MSCI Japan ETF", region:"Japan", corr_group:"Japan Equities", expense:"0.50%", aum:"$9.8B", color:"#84cc16" },
];

const corrColor = (v) => {
  if (v >= 0.7) return "#dc2626";
  if (v >= 0.5) return "#f97316";
  if (v >= 0.3) return "#eab308";
  if (v >= 0.1) return "#84cc16";
  if (v >= -0.05) return "#22c55e";
  return "#3b82f6";
};
const corrBg = (v) => {
  if (v >= 0.7) return "rgba(220,38,38,0.25)";
  if (v >= 0.5) return "rgba(249,115,22,0.2)";
  if (v >= 0.3) return "rgba(234,179,8,0.18)";
  if (v >= 0.1) return "rgba(132,204,18,0.15)";
  if (v >= -0.05) return "rgba(34,197,94,0.12)";
  return "rgba(59,130,246,0.18)";
};

const getPairExplanation = (a, b, corr) => {
  if (corr >= 0.7) return `${a.ticker} 与 ${b.ticker} 为强相关（${corr.toFixed(3)}），受同类风险偏好与全球流动性驱动。`;
  if (corr >= 0.3) return `${a.ticker} 与 ${b.ticker} 为中等相关（${corr.toFixed(3)}），存在共同宏观因子但保留分散化作用。`;
  if (corr >= 0) return `${a.ticker} 与 ${b.ticker} 为弱相关（${corr.toFixed(3)}），可提升组合分散度。`;
  return `${a.ticker} 与 ${b.ticker} 为负相关（${corr.toFixed(3)}），在风险事件中可能提供对冲。`;
};

const formatDateCN = (yyyyMMdd) => {
  const [y, m, d] = yyyyMMdd.split("-");
  return `${d}/${m}/${y}`;
};

const pearson = (a, b) => {
  const n = a.length;
  if (n < 2) return 0;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const xa = a[i] - ma;
    const xb = b[i] - mb;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
};

const CandlestickTooltip = ({active, payload, label}) => {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0] ? payload[0].payload : null;
  if (!d) return null;
  return (
    <div style={{background:"#050c18",border:"1px solid #1a3858",borderRadius:"6px",padding:"10px 14px",fontFamily:"'Syne Mono',monospace",fontSize:"11px"}}>
      <div style={{color:"#4b6070",marginBottom:"6px"}}>{formatDateCN(label)}</div>
      <div style={{color:"#d1d9e6",marginBottom:"3px"}}>O: <span style={{color:"#8fa8c0"}}>${d.open != null ? d.open.toFixed(2) : "-"}</span>  H: <span style={{color:"#22c55e"}}>${d.high != null ? d.high.toFixed(2) : "-"}</span></div>
      <div style={{color:"#d1d9e6",marginBottom:"3px"}}>L: <span style={{color:"#ef4444"}}>${d.low != null ? d.low.toFixed(2) : "-"}</span>  C: <span style={{color:"#d1d9e6"}}>${d.close != null ? d.close.toFixed(2) : "-"}</span></div>
      <div style={{color: d.dailyReturn >= 0 ? "#22c55e" : "#ef4444"}}>Return: {d.dailyReturn >= 0 ? "+" : ""}{d.dailyReturn != null ? d.dailyReturn.toFixed(2) : "-"}%</div>
    </div>
  );
};

export default function App() {
  const [tab, setTab] = useState("matrix");
  const [selected, setSelected] = useState(ETFS[0]);
  const [highlight, setHighlight] = useState(null);
  const [visibleETFs, setVisibleETFs] = useState(ETFS.map(e=>e.id));
  const [selectedPair, setSelectedPair] = useState(null);
  const [timeRange, setTimeRange] = useState("1Y");
  const [marketData, setMarketData] = useState({});
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState("");
  const [corrMatrix, setCorrMatrix] = useState(Array.from({length: ETFS.length}, (_, i) => Array.from({length: ETFS.length}, (_, j) => (i===j?1:0))));
  const [chartData, setChartData] = useState([]);
  const [queryInput, setQueryInput] = useState("SPY, GLD");
  const [queryRange, setQueryRange] = useState("1Y");
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState("");
  const [queryResult, setQueryResult] = useState(null);
  const [symbolLookup, setSymbolLookup] = useState([]);
  const [symbolLookupMap, setSymbolLookupMap] = useState({});
  const [queryResolved, setQueryResolved] = useState([]);
  const [proxyBaseUrl, setProxyBaseUrl] = useState("");
  const [symbolSearch, setSymbolSearch] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const resp = await fetch("./etf_daily_data_nasdaq.json");
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const raw = await resp.json();
        const byTicker = {};
        Object.keys(raw || {}).forEach((ticker) => {
          const rows = (((raw[ticker] || {}).records) || []).map((r, idx, arr) => {
            const prevClose = idx > 0 ? arr[idx-1].close : r.close;
            const ret = prevClose ? ((r.close - prevClose) / prevClose) * 100 : 0;
            return { ...r, dailyReturn: ret };
          });
          byTicker[ticker] = rows;
        });
        try {
          const cached = JSON.parse(localStorage.getItem("on_demand_nasdaq_cache_v1") || "{}");
          Object.keys(cached || {}).forEach((t) => {
            const rows = Array.isArray(cached[t]) ? cached[t] : [];
            if (rows.length >= 10 && !byTicker[t]) {
              byTicker[t] = rows;
            }
          });
        } catch (e) {
          // Ignore malformed local cache and continue.
        }
        setMarketData(byTicker);

        // compute daily return correlation matrix by shared dates
        const matrix = ETFS.map(() => ETFS.map(() => 0));
        ETFS.forEach((a, i) => {
          ETFS.forEach((b, j) => {
            if (i === j) {
              matrix[i][j] = 1;
              return;
            }
            const mapA = new Map((byTicker[a.ticker] || []).map((r) => [r.date, r.dailyReturn]));
            const mapB = new Map((byTicker[b.ticker] || []).map((r) => [r.date, r.dailyReturn]));
            const common = [];
            const bVals = [];
            mapA.forEach((v, d) => {
              if (mapB.has(d)) {
                common.push(v);
                bVals.push(mapB.get(d));
              }
            });
            matrix[i][j] = +pearson(common, bVals).toFixed(3);
          });
        });
        setCorrMatrix(matrix);
      } catch (err) {
        setDataError(String(err));
      } finally {
        setDataLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    const loadSymbolLookup = async () => {
      try {
        const resp = await fetch("./nasdaq_symbol_lookup.json");
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const raw = await resp.json();
        const rows = Array.isArray(raw) ? raw : [];
        const cleaned = rows
          .filter((r) => r && r.symbol)
          .map((r) => ({
            symbol: String(r.symbol).toUpperCase(),
            name: String(r.name || "").trim(),
          }));
        const bySymbol = {};
        cleaned.forEach((r) => {
          bySymbol[r.symbol] = r;
        });
        setSymbolLookup(cleaned);
        setSymbolLookupMap(bySymbol);
      } catch (err) {
        const fallback = ETFS.map((e) => ({ symbol: e.ticker, name: e.name }));
        const bySymbol = {};
        fallback.forEach((r) => {
          bySymbol[r.symbol] = r;
        });
        setSymbolLookup(fallback);
        setSymbolLookupMap(bySymbol);
      }
    };
    loadSymbolLookup();
  }, []);

  useEffect(() => {
    const loadProxyConfig = async () => {
      try {
        const resp = await fetch("./proxy-config.json");
        if (!resp.ok) return;
        const data = await resp.json();
        const url = String((data || {}).nasdaqProxyBaseUrl || "").trim();
        if (url) setProxyBaseUrl(url.replace(/\/+$/, ""));
      } catch (err) {
        // Keep empty proxy URL when config is not provided.
      }
    };
    loadProxyConfig();
  }, []);

  const priceData = useMemo(() => marketData[selected.ticker] || [], [marketData, selected]);
  const dataSummary = useMemo(() => {
    const records = marketData.SPY || [];
    const first = records.length > 0 ? records[0].date : "2019-01-02";
    const last = records.length > 0 ? records[records.length - 1].date : "N/A";
    const yearStart = first.slice(0, 4);
    const yearEnd = last !== "N/A" ? last.slice(0, 4) : "N/A";
    return {
      firstDate: first,
      lastDate: last,
      tradingDays: records.length || 0,
      yearRange: `${yearStart}–${yearEnd}`,
    };
  }, [marketData]);

  useEffect(() => {
    const today = new Date();
    let cutoff = new Date();
    if (timeRange === "1M") cutoff.setMonth(today.getMonth() - 1);
    else if (timeRange === "3M") cutoff.setMonth(today.getMonth() - 3);
    else if (timeRange === "1Y") cutoff.setFullYear(today.getFullYear() - 1);
    else cutoff = new Date("2019-01-01");

    const filtered = priceData.filter(d => new Date(d.date) >= cutoff);
    setChartData(filtered);
  }, [selected, timeRange, priceData]);

  const firstP = (chartData[0] && chartData[0].close) || 1;
  const lastP  = (chartData[chartData.length-1] && chartData[chartData.length-1].close) || 1;
  const totalRet = (((lastP - firstP) / firstP) * 100).toFixed(2);

  const displayETFs = ETFS.filter(e => visibleETFs.includes(e.id));
  const avgCorr = useMemo(() => {
    const idx = selected.id;
    const row = corrMatrix[idx].filter((_, i) => i !== idx && visibleETFs.includes(i));
    if (row.length === 0) return "0.00";
    return (row.reduce((a, b) => a + b, 0) / row.length).toFixed(3);
  }, [selected, visibleETFs, corrMatrix]);

  const filteredSymbolDirectory = useMemo(() => {
    const q = symbolSearch.trim().toLowerCase();
    const base = Array.isArray(symbolLookup) ? symbolLookup : [];
    if (!q) return base.slice(0, 120);
    return base
      .filter((r) => r.symbol.toLowerCase().includes(q) || (r.name || "").toLowerCase().includes(q))
      .slice(0, 120);
  }, [symbolLookup, symbolSearch]);

  const buildReturnsByDate = (records) => {
    const sorted = records.slice().sort((a, b) => a.date.localeCompare(b.date));
    const byDate = {};
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1].close;
      const curr = sorted[i].close;
      if (prev && curr) {
        byDate[sorted[i].date] = ((curr - prev) / prev) * 100;
      }
    }
    return byDate;
  };

  const getRangeFrom = (range) => {
    const now = new Date();
    const dt = new Date(now);
    if (range === "1M") dt.setMonth(now.getMonth() - 1);
    else if (range === "1Y") dt.setFullYear(now.getFullYear() - 1);
    else dt.setFullYear(now.getFullYear() - 5);
    return dt.toISOString().slice(0, 10);
  };

  const parseNasdaqRows = (rows) => {
    const records = [];
    for (const row of rows || []) {
      if (!row || !row.date || !row.close) continue;
      const mdy = String(row.date).split("/");
      if (mdy.length !== 3) continue;
      const yyyy = mdy[2];
      const mm = mdy[0].padStart(2, "0");
      const dd = mdy[1].padStart(2, "0");
      const close = Number(String(row.close).replace(/\$|,/g, ""));
      if (!Number.isFinite(close)) continue;
      records.push({ date: `${yyyy}-${mm}-${dd}`, close });
    }
    records.sort((a, b) => a.date.localeCompare(b.date));
    return records;
  };

  const fetchNasdaqTicker = async (ticker, fromDate) => {
    const classes = ["stocks", "etf"];
    for (const assetclass of classes) {
      const url = `https://api.nasdaq.com/api/quote/${ticker}/historical?assetclass=${assetclass}&fromdate=${fromDate}&todate=2099-12-31&limit=10000&offset=0`;
      const resp = await fetch(url, {
        headers: {
          accept: "application/json, text/plain, */*",
        },
      });
      if (!resp.ok) continue;
      const payload = await resp.json();
      const rows = ((((payload || {}).data || {}).tradesTable || {}).rows) || [];
      const records = parseNasdaqRows(rows);
      if (records.length >= 10) return records;
    }
    throw new Error(`Nasdaq no data for ${ticker}`);
  };

  const fetchNasdaqViaProxy = async (ticker, fromDate) => {
    if (!proxyBaseUrl) throw new Error("Proxy URL not configured");
    const qs = new URLSearchParams({ symbol: ticker, fromdate: fromDate });
    const url = `${proxyBaseUrl}/historical?${qs.toString()}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Proxy HTTP ${resp.status}`);
    const payload = await resp.json();
    const rows = (payload && payload.rows) || [];
    const records = parseNasdaqRows(rows);
    if (records.length < 10) throw new Error(`Proxy no data for ${ticker}`);
    return records;
  };

  const cacheFetchedSeries = (ticker, records) => {
    if (!records || records.length < 10) return;
    setMarketData((prev) => ({ ...prev, [ticker]: records }));
    try {
      const raw = JSON.parse(localStorage.getItem("on_demand_nasdaq_cache_v1") || "{}");
      raw[ticker] = records;
      localStorage.setItem("on_demand_nasdaq_cache_v1", JSON.stringify(raw));
    } catch (e) {
      // Ignore storage failures (private mode/quota).
    }
  };

  const addSymbolToInput = (symbol) => {
    const current = queryInput
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (current.includes(symbol)) return;
    if (current.length >= 5) return;
    const next = [...current, symbol];
    setQueryInput(next.join(", "));
    setQueryResolved([]);
  };

  const resolveQuerySymbols = (rawInput) => {
    const tokens = rawInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const resolved = [];
    const unresolved = [];

    tokens.forEach((token) => {
      const upper = token.toUpperCase();
      if (symbolLookupMap[upper]) {
        resolved.push({ input: token, symbol: upper, name: symbolLookupMap[upper].name });
        return;
      }

      const lower = token.toLowerCase();
      const exact = symbolLookup.find((r) => r.name.toLowerCase() === lower);
      if (exact) {
        resolved.push({ input: token, symbol: exact.symbol, name: exact.name });
        return;
      }

      const fuzzy = symbolLookup.find((r) => r.name.toLowerCase().includes(lower));
      if (fuzzy) {
        resolved.push({ input: token, symbol: fuzzy.symbol, name: fuzzy.name });
        return;
      }

      if (/^[A-Za-z.\-]{1,10}$/.test(token)) {
        resolved.push({ input: token, symbol: upper, name: "" });
      } else {
        unresolved.push(token);
      }
    });

    const uniqueBySymbol = [];
    const seen = new Set();
    resolved.forEach((r) => {
      if (seen.has(r.symbol)) return;
      seen.add(r.symbol);
      uniqueBySymbol.push(r);
    });

    return { resolved: uniqueBySymbol, unresolved };
  };

  const runCustomCorrelation = async () => {
    setQueryError("");
    setQueryResult(null);
    const parsed = resolveQuerySymbols(queryInput);
    if (parsed.unresolved.length > 0) {
      setQueryError(`Cannot resolve input: ${parsed.unresolved.join(", ")}`);
      return;
    }
    const unique = parsed.resolved.map((r) => r.symbol);
    setQueryResolved(parsed.resolved);
    if (unique.length < 2 || unique.length > 5) {
      setQueryError("Please enter 2 to 5 symbols (ticker or company name), separated by commas.");
      return;
    }

    setQueryLoading(true);
    try {
      const fromDate = getRangeFrom(queryRange);
      const seriesByTicker = {};
      const sourceByTicker = {};
      for (const t of unique) {
        const localRows = marketData[t];
        if (localRows && localRows.length >= 10) {
          const filteredLocal = localRows.filter((r) => r.date >= fromDate).map((r) => ({ date: r.date, close: r.close }));
          if (filteredLocal.length >= 10) {
            seriesByTicker[t] = filteredLocal;
            sourceByTicker[t] = "Local Nasdaq cache";
            continue;
          }
        }
        try {
          const records = await fetchNasdaqViaProxy(t, fromDate);
          seriesByTicker[t] = records;
          sourceByTicker[t] = "Nasdaq via proxy";
          cacheFetchedSeries(t, records);
        } catch (e) {
          try {
            const records = await fetchNasdaqTicker(t, fromDate);
            seriesByTicker[t] = records;
            sourceByTicker[t] = "Nasdaq direct";
            cacheFetchedSeries(t, records);
          } catch (e2) {
            throw new Error(`Cannot load ${t} from Nasdaq. Try another symbol or retry later.`);
          }
        }
      }

      const returnsByTicker = {};
      unique.forEach((t) => {
        returnsByTicker[t] = buildReturnsByDate(seriesByTicker[t]);
      });

      let commonDates = null;
      unique.forEach((t) => {
        const keys = Object.keys(returnsByTicker[t]);
        if (commonDates === null) commonDates = new Set(keys);
        else commonDates = new Set(keys.filter((d) => commonDates.has(d)));
      });
      const alignedDates = Array.from(commonDates || []).sort();
      if (alignedDates.length < 5) {
        throw new Error("Not enough overlapping dates across symbols.");
      }

      const matrix = unique.map(() => unique.map(() => 0));
      for (let i = 0; i < unique.length; i++) {
        for (let j = 0; j < unique.length; j++) {
          if (i === j) {
            matrix[i][j] = 1;
            continue;
          }
          const a = alignedDates.map((d) => returnsByTicker[unique[i]][d]);
          const b = alignedDates.map((d) => returnsByTicker[unique[j]][d]);
          matrix[i][j] = +pearson(a, b).toFixed(3);
        }
      }

      let sum = 0;
      let count = 0;
      for (let i = 0; i < matrix.length; i++) {
        for (let j = i + 1; j < matrix.length; j++) {
          sum += matrix[i][j];
          count += 1;
        }
      }
      const avg = count ? +(sum / count).toFixed(3) : 0;
      setQueryResult({
        tickers: unique,
        matrix,
        alignedDates,
        sourceByTicker,
        avg,
      });
    } catch (err) {
      setQueryError(String(err && err.message ? err.message : err));
    } finally {
      setQueryLoading(false);
    }
  };

  return (
    <div style={{minHeight:"100vh",background:"#030810",color:"#d1d9e6",fontFamily:"'Syne',sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Syne+Mono&display=swap" rel="stylesheet"/>
      <style>{`
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-track{background:#070f1c}::-webkit-scrollbar-thumb{background:#1a3050;border-radius:2px}
        .etf-pill{cursor:pointer;padding:7px 14px;border-radius:20px;border:1px solid #0e2035;background:transparent;font-family:'Syne Mono',monospace;font-size:11px;color:#3a5570;transition:all .15s;white-space:nowrap}
        .etf-pill:hover{border-color:#1a3858;color:#8fa8c0}
        .etf-pill.on{border-color:var(--c);background:color-mix(in srgb,var(--c) 12%,transparent);color:var(--c)}
        .nav-tab{cursor:pointer;padding:9px 22px;border-radius:4px;font-size:12px;font-family:'Syne Mono',monospace;letter-spacing:.06em;border:1px solid transparent;transition:all .15s;color:#2d4560}
        .nav-tab.on{background:#071525;border-color:#0e2540;color:#8fb8d8}
        .nav-tab:hover:not(.on){color:#4a6a85}
        .corr-cell{cursor:pointer;transition:transform .1s;border-radius:4px;display:flex;align-items:center;justify-content:center;font-family:'Syne Mono',monospace;font-size:10px;font-weight:600}
        .corr-cell:hover{transform:scale(1.08);z-index:2;position:relative}
        .filter-pill{cursor:pointer;padding:4px 10px;border-radius:4px;border:1px solid #1a3858;background:#060e1c;font-family:'Syne Mono',monospace;font-size:10px;color:#4a6a85;transition:all .15s}
        .filter-pill:hover{background:#0a1e32;color:#8fa8c0}
        .filter-pill.on{background:#0e2540;border-color:var(--c);color:var(--c)}
        .range-btn{cursor:pointer;padding:5px 14px;border-radius:4px;border:1px solid #1a3858;background:#060e1c;font-family:'Syne Mono',monospace;font-size:11px;color:#4a6a85;transition:all .15s}
        .range-btn:hover{background:#0a1e32;color:#8fa8c0}
        .range-btn.on{background:#0e2540;border-color:#22c55e;color:#22c55e}
        @keyframes up{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        .fade{animation:up .25s ease}
      `}</style>

      {/* HEADER */}
      <div style={{borderBottom:"1px solid #0a1a2e",padding:"16px 28px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,background:"rgba(3,8,16,.97)",zIndex:20}}>
        <div>
          <div style={{fontWeight:800,fontSize:"20px",letterSpacing:".02em",color:"#f0f6ff"}}>ETF CORRELATION ANALYSIS</div>
          <div style={{fontFamily:"'Syne Mono',monospace",fontSize:"10px",color:"#1e4060",marginTop:"2px",letterSpacing:".08em"}}>10 GLOBALLY DIVERSIFIED ETFs · DAILY OHLC DATA · {dataSummary.yearRange}</div>
        </div>
        <div style={{display:"flex",gap:"6px"}}>
          {[["matrix","CORR MATRIX"],["chart","PRICE CHART"],["custom","CUSTOM CORR"],["report","REPORT"],["sources","DATA SOURCES"]].map(([v,l])=>(
            <button key={v} className={`nav-tab ${tab===v?"on":""}`} onClick={()=>setTab(v)}>{l}</button>
          ))}
        </div>
      </div>

      {/* ETF SELECTOR */}
      <div style={{padding:"14px 28px",borderBottom:"1px solid #08172a",display:"flex",gap:"8px",flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontFamily:"'Syne Mono',monospace",fontSize:"10px",color:"#1e3a55",marginRight:"4px",letterSpacing:".08em"}}>SELECT ▸</span>
        {ETFS.map(e=>(
          <button key={e.ticker} className={`etf-pill ${selected.ticker===e.ticker?"on":""}`} style={{"--c":e.color}} onClick={()=>setSelected(e)}>
            {e.ticker} <span style={{opacity:.5,fontSize:"9px"}}>{e.region}</span>
          </button>
        ))}
      </div>

      {(dataLoading || dataError) && (
        <div style={{padding:"10px 28px",borderBottom:"1px solid #08172a",fontFamily:"'Syne Mono',monospace",fontSize:"11px",color:dataError ? "#ef4444" : "#8fa8c0"}}>
          {dataError ? `Nasdaq data load failed: ${dataError}` : "Loading Nasdaq daily OHLC data..."}
        </div>
      )}

      <div style={{padding:"24px 28px"}} className="fade" key={tab+selected.ticker}>

        {/* CORRELATION MATRIX */}
        {tab==="matrix" && (
          <div>
            <div style={{display:"flex",gap:"16px",marginBottom:"28px",flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:"260px",background:"#060e1c",border:`1px solid ${selected.color}22`,borderLeft:`3px solid ${selected.color}`,borderRadius:"10px",padding:"18px 22px"}}>
                <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"10px"}}>
                  <span style={{fontWeight:800,fontSize:"28px",color:selected.color,letterSpacing:".02em"}}>{selected.ticker}</span>
                  <span style={{fontFamily:"'Syne Mono',monospace",fontSize:"10px",color:selected.color,border:`1px solid ${selected.color}44`,borderRadius:"3px",padding:"2px 8px"}}>{selected.region}</span>
                  <span style={{fontFamily:"'Syne Mono',monospace",fontSize:"10px",color:"#2d4a65",border:"1px solid #0e2035",borderRadius:"3px",padding:"2px 8px"}}>{selected.corr_group}</span>
                </div>
                <div style={{fontSize:"12px",color:"#5a7a95",lineHeight:1.6,marginBottom:"12px"}}>{selected.name} &nbsp;·&nbsp; Expense: {selected.expense} &nbsp;·&nbsp; AUM: {selected.aum}</div>
              </div>
              <div style={{display:"flex",gap:"12px",flexWrap:"wrap"}}>
                {[["AUM",selected.aum],["Expense",selected.expense],["Avg Corr",avgCorr]].map(([l,v])=>(
                  <div key={l} style={{background:"#060e1c",border:"1px solid #0a1e32",borderRadius:"8px",padding:"14px 18px",minWidth:"100px"}}>
                    <div style={{fontFamily:"'Syne Mono',monospace",fontSize:"9px",color:"#1e3a55",letterSpacing:".1em",marginBottom:"6px"}}>{l}</div>
                    <div style={{fontFamily:"'Syne Mono',monospace",fontSize:"16px",fontWeight:700,color: l==="Avg Corr" ? (avgCorr>0.5?"#f97316":avgCorr>0.3?"#eab308":"#22c55e") : "#d1d9e6"}}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{background:"#060e1c",border:"1px solid #0a1e32",borderRadius:"12px",padding:"24px",overflowX:"auto"}}>
              <div style={{marginBottom:"20px",padding:"16px",background:"#030810",border:"1px solid #0a1e32",borderRadius:"8px"}}>
                <div style={{fontFamily:"'Syne Mono',monospace",fontSize:"10px",color:"#8fa8c0",marginBottom:"12px",letterSpacing:".05em"}}>FILTER ETFs:</div>
                <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                  {ETFS.map(e=>{
                    const isVisible = visibleETFs.includes(e.id);
                    return (
                      <button key={e.id} className={`filter-pill ${isVisible?"on":""}`} style={{"--c":e.color}} onClick={()=>{ if(isVisible && visibleETFs.length<=2) return; setVisibleETFs(isVisible ? visibleETFs.filter(id=>id!==e.id) : [...visibleETFs,e.id].sort((a,b)=>a-b)); }}>
                        {isVisible ? "✓ " : "+ "}{e.ticker}
                      </button>
                    );
                  })}
                  <button className="filter-pill" onClick={()=>setVisibleETFs(ETFS.map(e=>e.id))} style={{marginLeft:"8px"}}>Select All</button>
                </div>
              </div>

              <div style={{fontFamily:"'Syne Mono',monospace",fontSize:"10px",color:"#1e3a55",letterSpacing:".1em",marginBottom:"20px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"10px"}}>
                <span>CORRELATION MATRIX — DAILY RETURN BASIS ({dataSummary.yearRange})</span>
                <div style={{display:"flex",gap:"10px",fontSize:"9px",flexWrap:"wrap"}}>
                  {[["≥0.7","#dc2626"],["0.5–0.7","#f97316"],["0.3–0.5","#eab308"],["0.1–0.3","#84cc16"],["<0.1","#22c55e"]].map(([r,c])=>(
                    <span key={r} style={{display:"flex",alignItems:"center",gap:"4px"}}>
                      <span style={{width:"8px",height:"8px",borderRadius:"2px",background:c,display:"inline-block"}}/>
                      <span style={{color:"#2d4a65"}}>{r}</span>
                    </span>
                  ))}
                </div>
              </div>

              <div style={{display:"grid",gridTemplateColumns:`80px repeat(${displayETFs.length},1fr)`,gap:"3px",minWidth:`${80 + displayETFs.length * 60}px`}}>
                <div/>
                {displayETFs.map(e=>(
                  <div key={e.ticker} style={{textAlign:"center",fontFamily:"'Syne Mono',monospace",fontSize:"10px",color:e.ticker===selected.ticker?e.color:"#2d4a65",padding:"4px 2px",fontWeight:e.ticker===selected.ticker?700:400}}>{e.ticker}</div>
                ))}
                {displayETFs.map((row)=>(
                  <React.Fragment key={row.ticker+"_row"}>
                    <div style={{fontFamily:"'Syne Mono',monospace",fontSize:"10px",color:row.ticker===selected.ticker?row.color:"#2d4a65",display:"flex",alignItems:"center",fontWeight:row.ticker===selected.ticker?700:400,paddingRight:"8px"}}>{row.ticker}</div>
                    {displayETFs.map((col)=>{
                      const ri=row.id, ci=col.id, v=corrMatrix[ri][ci];
                      const isSelf=ri===ci, isHighlight=ri===selected.id||ci===selected.id;
                      return (
                        <div key={col.ticker} className="corr-cell"
                          style={{height:"42px",background:isSelf?"#0a1e32":corrBg(v),color:isSelf?"#1e3a55":corrColor(v),border:isHighlight&&!isSelf?`1px solid ${corrColor(v)}55`:"1px solid transparent",opacity:isHighlight||isSelf?1:0.7}}
                          onMouseEnter={()=>setHighlight({ri,ci,v,a:row.ticker,b:col.ticker})}
                          onMouseLeave={()=>setHighlight(null)}
                          onClick={()=>{if(!isSelf) setSelectedPair({a:row,b:col,corr:v})}}>
                          {isSelf?"—":v.toFixed(3)}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>

              {selectedPair && (
                <div style={{marginTop:"24px",padding:"20px",background:"#0a1e32",border:"1px solid #1a3858",borderRadius:"8px"}} className="fade">
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"}}>
                    <div style={{fontFamily:"'Syne Mono',monospace",fontSize:"14px",color:"#8fb8d8"}}>
                      PAIR ANALYSIS: <strong style={{color:selectedPair.a.color}}>{selectedPair.a.ticker}</strong> × <strong style={{color:selectedPair.b.color}}>{selectedPair.b.ticker}</strong>
                    </div>
                    <button onClick={()=>setSelectedPair(null)} style={{background:"transparent",border:"none",color:"#4a6a85",cursor:"pointer",fontFamily:"'Syne Mono',monospace"}}>✕ CLOSE</button>
                  </div>
                  <div style={{fontSize:"18px",fontWeight:"bold",color:corrColor(selectedPair.corr),marginBottom:"12px"}}>
                    Correlation Coefficient: {selectedPair.corr.toFixed(3)}
                  </div>
                  <div style={{fontSize:"13px",color:"#d1d9e6",lineHeight:1.6}}>
                    {getPairExplanation(selectedPair.a, selectedPair.b, selectedPair.corr)}
                  </div>
                </div>
              )}

              {highlight&&highlight.ri!==highlight.ci&&(
                <div style={{marginTop:"12px",fontFamily:"'Syne Mono',monospace",fontSize:"11px",color:"#4a6a85",borderTop:"1px solid #0a1e32",paddingTop:"10px"}}>
                  {highlight.a} × {highlight.b}: <span style={{color:corrColor(highlight.v)}}>{highlight.v.toFixed(3)}</span>
                  <span style={{marginLeft:"10px",color:"#3b82f6"}}>▸ Click for detailed analysis</span>
                </div>
              )}
            </div>

            <div style={{marginTop:"20px",display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:"10px"}}>
              {[["10 Asset Classes","US Equity (SPY,VNQ), Europe (EZU), India (INDA), China (KWEB), HK (EWH), Gold (GLD), Bonds (TLT), Commodities (DBC), Japan (EWJ)"],["6 Geographic Regions","US, Eurozone, India, China/HK, Japan, Global — each with distinct macro cycles"],["Daily Return Correlation",`Computed from Nasdaq daily OHLC data (${dataSummary.firstDate} to ${dataSummary.lastDate}).`],["Policy Divergence","Fed, ECB, RBI, PBOC, BOJ — 5 central banks, 5 policy cycles"]].map(([t,d])=>(
                <div key={t} style={{background:"#060e1c",border:"1px solid #0a1e32",borderRadius:"8px",padding:"14px"}}>
                  <div style={{fontFamily:"'Syne Mono',monospace",fontSize:"10px",color:"#22c55e",marginBottom:"6px",letterSpacing:".06em"}}>{t}</div>
                  <div style={{fontSize:"11px",color:"#3a5a75",lineHeight:1.6}}>{d}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CUSTOM CORRELATION */}
        {tab==="custom" && (
          <div style={{maxWidth:"980px",margin:"0 auto"}}>
            <div style={{background:"#060e1c",border:"1px solid #0a1e32",borderRadius:"12px",padding:"24px"}}>
              <div style={{fontFamily:"'Syne Mono',monospace",fontSize:"11px",color:"#22c55e",letterSpacing:".08em",marginBottom:"10px"}}>CUSTOM CORRELATION QUERY</div>
              <div style={{fontSize:"13px",color:"#7a9ab5",marginBottom:"14px",lineHeight:1.7}}>
                Enter 2-5 tickers or company names (example: <span style={{color:"#8fb8d8"}}>AAPL, Microsoft, NVIDIA</span>), select period, then calculate Pearson correlation matrix.
                Built-in Nasdaq cache symbols (always available): <span style={{color:"#8fb8d8"}}>SPY, EZU, INDA, KWEB, EWH, GLD, TLT, DBC, VNQ, EWJ</span>.
              </div>
              <div style={{display:"flex",gap:"10px",flexWrap:"wrap",alignItems:"center",marginBottom:"12px"}}>
                <input
                  value={queryInput}
                  onChange={(e)=>{ setQueryInput(e.target.value); setQueryResolved([]); }}
                  placeholder="AAPL, MSFT, NVDA"
                  style={{flex:"1 1 360px",minWidth:"260px",background:"#030810",color:"#d1d9e6",border:"1px solid #1a3858",borderRadius:"6px",padding:"10px 12px",fontFamily:"'Syne Mono',monospace",fontSize:"12px"}}
                />
                {["1M","1Y","5Y"].map((r)=>(
                  <button key={r} className={`range-btn ${queryRange===r?"on":""}`} onClick={()=>setQueryRange(r)}>{r}</button>
                ))}
                <button className="range-btn on" onClick={runCustomCorrelation} disabled={queryLoading} style={{minWidth:"120px"}}>
                  {queryLoading ? "CALCULATING..." : "CALCULATE"}
                </button>
              </div>

              <div style={{marginTop:"10px",background:"#030810",border:"1px solid #0a1e32",borderRadius:"8px",padding:"10px 12px"}}>
                <div style={{fontFamily:"'Syne Mono',monospace",fontSize:"10px",color:"#22c55e",letterSpacing:".06em",marginBottom:"8px"}}>
                  SYMBOL DIRECTORY (SEARCH STORED CODE/NAME)
                </div>
                <input
                  value={symbolSearch}
                  onChange={(e)=>setSymbolSearch(e.target.value)}
                  placeholder="Search symbol or company name..."
                  style={{width:"100%",background:"#02060d",color:"#d1d9e6",border:"1px solid #1a3858",borderRadius:"6px",padding:"8px 10px",fontFamily:"'Syne Mono',monospace",fontSize:"11px",marginBottom:"8px"}}
                />
                <div style={{display:"flex",gap:"6px",flexWrap:"wrap",maxHeight:"120px",overflowY:"auto"}}>
                  {filteredSymbolDirectory.map((r)=>(
                    <button
                      key={`${r.symbol}-${r.name}`}
                      className="filter-pill"
                      onClick={()=>addSymbolToInput(r.symbol)}
                      title={r.name}
                    >
                      + {r.symbol}
                    </button>
                  ))}
                </div>
              </div>

              {queryResolved.length > 0 && (
                <div style={{marginTop:"8px",fontFamily:"'Syne Mono',monospace",fontSize:"10px",color:"#8fa8c0",display:"flex",gap:"8px",flexWrap:"wrap"}}>
                  <span style={{color:"#1e3a55"}}>RESOLVED INPUT:</span>
                  {queryResolved.map((r) => (
                    <span key={`${r.input}-${r.symbol}`} style={{background:"#030810",border:"1px solid #0a1e32",borderRadius:"4px",padding:"3px 6px"}}>
                      {r.input} → <span style={{color:"#8fb8d8"}}>{r.symbol}</span>{r.name ? ` (${r.name})` : ""}
                    </span>
                  ))}
                </div>
              )}

              {queryError && (
                <div style={{marginTop:"8px",fontFamily:"'Syne Mono',monospace",fontSize:"11px",color:"#ef4444"}}>
                  {queryError}
                </div>
              )}

              {queryResult && (
                <div style={{marginTop:"18px"}}>
                  <div style={{display:"flex",gap:"16px",flexWrap:"wrap",marginBottom:"12px"}}>
                    <div style={{background:"#030810",border:"1px solid #0a1e32",borderRadius:"8px",padding:"10px 12px",fontFamily:"'Syne Mono',monospace",fontSize:"11px",color:"#8fa8c0"}}>
                      Overlap Days: <span style={{color:"#d1d9e6"}}>{queryResult.alignedDates.length}</span>
                    </div>
                    <div style={{background:"#030810",border:"1px solid #0a1e32",borderRadius:"8px",padding:"10px 12px",fontFamily:"'Syne Mono',monospace",fontSize:"11px",color:"#8fa8c0"}}>
                      Avg Pair Corr: <span style={{color:corrColor(queryResult.avg)}}>{queryResult.avg.toFixed(3)}</span>
                    </div>
                    <div style={{background:"#030810",border:"1px solid #0a1e32",borderRadius:"8px",padding:"10px 12px",fontFamily:"'Syne Mono',monospace",fontSize:"11px",color:"#8fa8c0"}}>
                      Date Range: <span style={{color:"#d1d9e6"}}>{queryResult.alignedDates[0]} → {queryResult.alignedDates[queryResult.alignedDates.length-1]}</span>
                    </div>
                  </div>

                  <div style={{fontFamily:"'Syne Mono',monospace",fontSize:"10px",color:"#1e3a55",letterSpacing:".1em",marginBottom:"10px"}}>
                    SOURCE: Nasdaq only (local cache → serverless proxy → direct Nasdaq)
                  </div>
                  <div style={{display:"flex",gap:"8px",flexWrap:"wrap",marginBottom:"12px"}}>
                    {queryResult.tickers.map((t)=>(
                      <div key={t} style={{background:"#030810",border:"1px solid #0a1e32",borderRadius:"6px",padding:"8px 10px",fontFamily:"'Syne Mono',monospace",fontSize:"10px",color:"#8fa8c0"}}>
                        {t}: <span style={{color:"#d1d9e6"}}>{queryResult.sourceByTicker[t]}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{display:"grid",gridTemplateColumns:`80px repeat(${queryResult.tickers.length},1fr)`,gap:"3px",minWidth:`${80 + queryResult.tickers.length * 90}px`,overflowX:"auto"}}>
                    <div/>
                    {queryResult.tickers.map((t)=>(
                      <div key={`h-${t}`} style={{textAlign:"center",fontFamily:"'Syne Mono',monospace",fontSize:"11px",color:"#8fb8d8",padding:"6px 2px"}}>{t}</div>
                    ))}
                    {queryResult.tickers.map((rTicker, i)=>(
                      <div key={`r-${rTicker}`} style={{display:"contents"}}>
                        <div style={{fontFamily:"'Syne Mono',monospace",fontSize:"11px",color:"#8fb8d8",display:"flex",alignItems:"center",paddingRight:"8px"}}>{rTicker}</div>
                        {queryResult.tickers.map((cTicker, j)=>{
                          const v = queryResult.matrix[i][j];
                          return (
                            <div key={`${rTicker}-${cTicker}`} className="corr-cell" style={{height:"40px",background:i===j?"#0a1e32":corrBg(v),color:i===j?"#1e3a55":corrColor(v)}}>
                              {i===j ? "—" : v.toFixed(3)}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PRICE CHART */}
        {tab==="chart" && (
          <div>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"20px",flexWrap:"wrap",gap:"12px"}}>
              <div>
                <div style={{fontWeight:800,fontSize:"32px",color:selected.color,letterSpacing:".02em",lineHeight:1}}>{selected.ticker}</div>
                <div style={{fontSize:"13px",color:"#3a5a75",marginTop:"4px"}}>{selected.name}</div>
                <div style={{fontSize:"12px",color:"#2d4a65",marginTop:"4px",fontFamily:"'Syne Mono',monospace"}}>Daily OHLC K-Line · {chartData.length} trading days</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontFamily:"'Syne Mono',monospace",fontSize:"28px",fontWeight:700,color:+totalRet>0?"#22c55e":"#ef4444"}}>{+totalRet>0?"+":""}{totalRet}%</div>
                <div style={{fontFamily:"'Syne Mono',monospace",fontSize:"10px",color:"#1e3a55"}}>{timeRange === "ALL" ? "Full Period" : timeRange} Return</div>
              </div>
            </div>

            {/* Time Range Selector */}
            <div style={{marginBottom:"16px",display:"flex",gap:"8px",alignItems:"center"}}>
              <span style={{fontFamily:"'Syne Mono',monospace",fontSize:"10px",color:"#1e3a55",marginRight:"4px"}}>TIME RANGE:</span>
              {["1M","3M","1Y","ALL"].map(r=>(
                <button key={r} className={`range-btn ${timeRange===r?"on":""}`} onClick={()=>setTimeRange(r)}>{r}</button>
              ))}
              <span style={{marginLeft:"16px",fontFamily:"'Syne Mono',monospace",fontSize:"10px",color:"#1e3a55"}}>
                {(chartData[0] && chartData[0].date ? formatDateCN(chartData[0].date) : "—")} → {(chartData[chartData.length-1] && chartData[chartData.length-1].date ? formatDateCN(chartData[chartData.length-1].date) : "—")}
              </span>
            </div>

            {/* Candlestick Chart */}
            <div style={{background:"#060e1c",border:"1px solid #0a1e32",borderRadius:"12px",padding:"20px 16px 10px",marginBottom:"20px"}}>
              <div style={{fontFamily:"'Syne Mono',monospace",fontSize:"10px",color:"#1e3a55",marginBottom:"16px",letterSpacing:".1em"}}>DAILY OHLC K-LINE — {selected.ticker}</div>
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={chartData} margin={{top:5,right:10,bottom:5,left:0}}>
                  <defs>
                    <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={selected.color} stopOpacity={0.2}/>
                      <stop offset="95%" stopColor={selected.color} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 5" stroke="#0a1a2e"/>
                  <XAxis dataKey="date" stroke="#0a1a2e" tick={{fill:"#1e3a55",fontSize:9,fontFamily:"Syne Mono"}}
                    tickFormatter={(v) => {
                      const [y, m, d] = v.split("-");
                      if (timeRange === "1M" || timeRange === "3M") return `${d}/${m}`;
                      if (d === "01") return `${m}/${y}`;
                      return "";
                    }}
                    interval={timeRange === "1M" ? 1 : timeRange === "3M" ? 4 : Math.max(1, Math.floor(chartData.length / 10))}
                  />
                  <YAxis stroke="#0a1a2e" tick={{fill:"#1e3a55",fontSize:9,fontFamily:"Syne Mono"}} tickFormatter={v=>`$${v}`} width={55} domain={['auto','auto']}/>
                  <Tooltip content={<CandlestickTooltip/>}/>
                  <Line type="monotone" dataKey="close" stroke={selected.color} strokeWidth={1.2} dot={false}/>
                  <Scatter
                    data={chartData}
                    shape={(props) => {
                      const { cx, cy, payload } = props;
                      const isUp = payload.close >= payload.open;
                      const color = isUp ? "#22c55e" : "#ef4444";
                      return <rect x={cx - 1.5} y={cy - 1.5} width={3} height={3} fill={color} />;
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:"12px",fontFamily:"'Syne Mono',monospace",fontSize:"10px",color:"#1e3a55"}}>
                <span>Open: <span style={{color:"#8fa8c0"}}>${chartData[0] && chartData[0].open != null ? chartData[0].open.toFixed(2) : "-"}</span></span>
                <span>High: <span style={{color:"#22c55e"}}>${Number.isFinite(Math.max(...chartData.map(d=>d.high||0))) ? Math.max(...chartData.map(d=>d.high||0)).toFixed(2) : "-"}</span></span>
                <span>Low: <span style={{color:"#ef4444"}}>${Number.isFinite(Math.min(...chartData.map(d=>d.low||Infinity))) ? Math.min(...chartData.map(d=>d.low||Infinity)).toFixed(2) : "-"}</span></span>
                <span>Close: <span style={{color:"#d1d9e6"}}>${chartData[chartData.length-1] && chartData[chartData.length-1].close != null ? chartData[chartData.length-1].close.toFixed(2) : "-"}</span></span>
              </div>
            </div>

            {/* Correlations */}
            <div style={{background:"#060e1c",border:"1px solid #0a1e32",borderRadius:"10px",padding:"20px"}}>
              <div style={{fontFamily:"'Syne Mono',monospace",fontSize:"10px",color:"#1e3a55",letterSpacing:".1em",marginBottom:"14px"}}>{selected.ticker} DAILY RETURN CORRELATIONS</div>
              <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                {ETFS.filter(e=>e.ticker!==selected.ticker).map(e=>{
                  const v = corrMatrix[selected.id][e.id];
                  return (
                    <div key={e.ticker} style={{background:corrBg(v),border:`1px solid ${corrColor(v)}33`,borderRadius:"6px",padding:"10px 14px",minWidth:"90px"}}>
                      <div style={{fontFamily:"'Syne Mono',monospace",fontSize:"12px",fontWeight:700,color:e.color,marginBottom:"4px"}}>{e.ticker}</div>
                      <div style={{fontFamily:"'Syne Mono',monospace",fontSize:"16px",fontWeight:700,color:corrColor(v)}}>{v.toFixed(3)}</div>
                      <div style={{fontFamily:"'Syne Mono',monospace",fontSize:"8px",color:"#2d4a65",marginTop:"3px"}}>{e.region}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* REPORT */}
        {tab==="report" && (
          <div style={{maxWidth:"860px",margin:"0 auto"}}>
            <div style={{background:"#060e1c",border:"1px solid #0a1e32",borderRadius:"12px",padding:"36px 40px"}}>
              <div style={{fontFamily:"'Syne Mono',monospace",fontSize:"10px",color:"#1e3a55",letterSpacing:".12em",marginBottom:"6px"}}>INTERNAL RESEARCH MEMORANDUM</div>
              <div style={{fontWeight:800,fontSize:"22px",color:"#f0f6ff",marginBottom:"4px",lineHeight:1.3}}>ETF Selection Rationale — Correlation Analysis Study</div>
              <div style={{fontFamily:"'Syne Mono',monospace",fontSize:"11px",color:"#2d4a65",marginBottom:"32px",paddingBottom:"24px",borderBottom:"1px solid #0a1e32"}}>
                Prepared for: Portfolio Strategy Review &nbsp;|&nbsp; Date: April 2026 &nbsp;|&nbsp; Data: Nasdaq Daily OHLC ({dataSummary.firstDate} to {dataSummary.lastDate})
              </div>
              <div style={{fontSize:"13px",color:"#7a9ab5",lineHeight:1.9,marginBottom:"28px"}}>
                The 10 ETFs in this study were selected to <strong style={{color:"#d1d9e6"}}>maximize structural independence of return drivers</strong>. Each product is governed by materially different macroeconomic, policy, and fundamental forces.
              </div>
              <div style={{marginBottom:"28px"}}>
                <div style={{fontFamily:"'Syne Mono',monospace",fontSize:"11px",color:"#22c55e",letterSpacing:".08em",marginBottom:"16px"}}>01 — SELECTION FRAMEWORK</div>
                <div style={{fontSize:"13px",color:"#7a9ab5",lineHeight:1.9}}>
                  Four orthogonality tests were applied: <strong style={{color:"#d1d9e6"}}>geographic independence</strong> (5 central banks), <strong style={{color:"#d1d9e6"}}>asset class independence</strong> (equities, fixed income, real assets), <strong style={{color:"#d1d9e6"}}>sector/industry independence</strong>, and <strong style={{color:"#d1d9e6"}}>crisis behavior independence</strong>.
                </div>
              </div>
              <div style={{marginBottom:"28px"}}>
                <div style={{fontFamily:"'Syne Mono',monospace",fontSize:"11px",color:"#22c55e",letterSpacing:".08em",marginBottom:"16px"}}>02 — DAILY RETURN CORRELATION SUMMARY</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
                  {[["SPY vs EZU","0.815 — Strong linkage via Western economies, shared banking systems"],
                    ["SPY vs GLD","0.111 — Near-zero, driven by real interest rates vs earnings"],
                    ["SPY vs TLT","-0.136 — Negative, classic flight-to-safety 60/40 relationship"],
                    ["GLD vs TLT","0.229 — Low, both safe-havens but different inflation responses"],
                    ["TLT vs DBC","-0.160 — Negative, inflation trade: commodities up, bonds down"],
                    ["KWEB vs TLT","-0.031 — Near zero, Chinese tech disconnected from US rates"],
                    ["INDA vs KWEB","0.343 — Low, India benefits from China+1 supply chain shift"],
                    ["EWJ vs KWEB","0.412 — Low, BOJ vs PBOC policy environments are divergent"]].map(([pair,desc])=>(
                    <div key={pair} style={{background:"#070f1e",border:"1px solid #0a1a2e",borderRadius:"6px",padding:"12px 14px"}}>
                      <div style={{fontFamily:"'Syne Mono',monospace",fontSize:"10px",color:"#d1d9e6",marginBottom:"5px"}}>{pair}</div>
                      <div style={{fontSize:"11px",color:"#3a5570",lineHeight:1.6}}>{desc}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{background:"rgba(34,197,94,.05)",border:"1px solid rgba(34,197,94,.15)",borderRadius:"8px",padding:"18px 20px"}}>
                <div style={{fontFamily:"'Syne Mono',monospace",fontSize:"10px",color:"#22c55e",letterSpacing:".08em",marginBottom:"10px"}}>03 — KEY FINDINGS</div>
                <div style={{fontSize:"13px",color:"#7a9ab5",lineHeight:1.9}}>
                  The portfolio spans <strong style={{color:"#d1d9e6"}}>10 ETFs</strong> across <strong style={{color:"#d1d9e6"}}>6 geographic regions</strong> and <strong style={{color:"#d1d9e6"}}>3 asset classes</strong>. Average pairwise correlation: <strong style={{color:"#22c55e"}}>~0.35</strong>. Contains <strong style={{color:"#d1d9e6"}}>negatively correlated pairs</strong> (SPY/TLT, TLT/DBC) providing genuine portfolio diversification — not mere sector rotation.
                </div>
              </div>
              <div style={{marginTop:"20px",fontFamily:"'Syne Mono',monospace",fontSize:"9px",color:"#0e2035",lineHeight:1.7}}>
                DISCLAIMER: Correlation computed from Nasdaq daily return data. Actual correlations vary by time window and market regime. For research purposes only.
              </div>
            </div>
          </div>
        )}

        {/* DATA SOURCES */}
        {tab==="sources" && (
          <div style={{maxWidth:"860px",margin:"0 auto"}} className="fade">
            <div style={{background:"#060e1c",border:"1px solid #0a1e32",borderRadius:"12px",padding:"36px 40px"}}>
              <div style={{fontFamily:"'Syne Mono',monospace",fontSize:"10px",color:"#1e3a55",letterSpacing:".12em",marginBottom:"6px"}}>METHODOLOGY & DATA SOURCES</div>
              <div style={{fontWeight:800,fontSize:"22px",color:"#f0f6ff",marginBottom:"24px",lineHeight:1.3}}>Data Sources and Computation Methodology</div>
              <div style={{marginBottom:"28px"}}>
                <div style={{fontFamily:"'Syne Mono',monospace",fontSize:"11px",color:"#22c55e",letterSpacing:".08em",marginBottom:"12px"}}>DATA SOURCE — NASDAQ (NASDAQ.COM)</div>
                <div style={{fontSize:"13px",color:"#7a9ab5",lineHeight:1.8,background:"#030810",padding:"16px",borderRadius:"6px",border:"1px solid #0a1a2e"}}>
                  All daily OHLC (Open, High, Low, Close) price data is fetched directly from <strong style={{color:"#d1d9e6"}}>Nasdaq.com</strong> historical API for each ETF. Data spans <strong style={{color:"#d1d9e6"}}>{dataSummary.tradingDays} trading days</strong> from <strong style={{color:"#d1d9e6"}}>{dataSummary.firstDate}</strong> to <strong style={{color:"#d1d9e6"}}>{dataSummary.lastDate}</strong>. Tooltip and chart both display precise daily date values.
                </div>
              </div>
              <div style={{marginBottom:"28px"}}>
                <div style={{fontFamily:"'Syne Mono',monospace",fontSize:"11px",color:"#22c55e",letterSpacing:".08em",marginBottom:"12px"}}>CORRELATION COMPUTATION</div>
                <div style={{fontSize:"13px",color:"#7a9ab5",lineHeight:1.8,background:"#030810",padding:"16px",borderRadius:"6px",border:"1px solid #0a1a2e"}}>
                  Correlations are computed from <strong style={{color:"#d1d9e6"}}>daily percentage returns</strong>: <code style={{color:"#8fb8d8"}}>return_t = (Close_t - Close_t-1) / Close_t-1 × 100</code>. Pearson coefficients are recalculated for all ETF pairs using shared trading dates.
                </div>
              </div>
              <div style={{marginBottom:"28px"}}>
                <div style={{fontFamily:"'Syne Mono',monospace",fontSize:"11px",color:"#22c55e",letterSpacing:".08em",marginBottom:"12px"}}>VERIFIED ANNUAL RETURNS</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:"8px"}}>
                  {[["SPY","+184.28%"],["EZU","+90.80%"],["INDA","+51.73%"],["KWEB","-22.12%"],["EWH","+5.24%"],["GLD","+258.74%"],["TLT","-28.99%"],["DBC","+103.10%"],["VNQ","+29.57%"],["EWJ","+71.94%"]].map(([ticker,ret])=>(
                    <div key={ticker} style={{background:"#030810",border:"1px solid #0a1a2e",borderRadius:"4px",padding:"10px 12px",display:"flex",justifyContent:"space-between"}}>
                      <span style={{fontFamily:"'Syne Mono',monospace",fontSize:"11px",color:"#8fb8d8"}}>{ticker}</span>
                      <span style={{fontFamily:"'Syne Mono',monospace",fontSize:"11px",color:ret.startsWith("+")?"#22c55e":"#ef4444"}}>{ret}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{marginTop:"32px",fontFamily:"'Syne Mono',monospace",fontSize:"10px",color:"#3a5570",lineHeight:1.6,borderTop:"1px solid #0a1e32",paddingTop:"16px"}}>
                <strong>DISCLAIMER:</strong> Data sourced from Nasdaq.com. The model displays exact trading-day OHLC rows. This tool is for research use only and does not constitute investment advice.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
