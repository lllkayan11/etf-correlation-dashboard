# Nasdaq Proxy Setup

This project now supports a Nasdaq-only serverless proxy for custom symbol queries.

## 1) Create Cloudflare secrets in GitHub

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## 2) Deploy proxy from Actions

- Run workflow: `Deploy Nasdaq Proxy`
- It deploys `serverless/cloudflare-nasdaq-proxy/worker.js`

## 3) Configure dashboard to use proxy

- Open `proxy-config.json`
- Set:

```json
{
  "nasdaqProxyBaseUrl": "https://<your-worker-subdomain>.workers.dev"
}
```

## 4) Commit and push

- Push `proxy-config.json` update to `main`
- GitHub Pages picks up the new proxy endpoint automatically

## Behavior

- Query order: local Nasdaq cache -> Nasdaq proxy -> direct Nasdaq
- Data source is Nasdaq only
