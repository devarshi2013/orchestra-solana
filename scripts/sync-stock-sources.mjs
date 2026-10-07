// Downloads the official Solana mint lists for tokenized stocks and writes
// src/lib/assets/data/stock-sources.json. Run with `pnpm assets:sync-stocks`.
//
// Sources (issuers' own publications only; see docs/tokenized-stocks.md):
//  - Ondo Global Markets: the token CSV linked from https://docs.ondo.finance/addresses
//  - xStocks (Backed): https://api.xstocks.fi/api/v2/public/assets (public, paginated)
// Backpack-issued tokens are not from either source and so never appear.

import { writeFileSync } from "node:fs";

const ONDO_CSV =
  "https://www.dropbox.com/scl/fi/qjfxyg748mx0dwi6up86d/EXTERNAL-Ondo-GM-Tokens-Ondo-GM-Tokens.csv?rlkey=n3no1w78wrah3umsl0nr9s77i&dl=1";
const XSTOCKS_API = "https://api.xstocks.fi/api/v2/public/assets";
const OUT = new URL("../src/lib/assets/data/stock-sources.json", import.meta.url);

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, newlines in quotes). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const endField = () => {
    row.push(field);
    field = "";
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      endField();
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      endField();
      rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field || row.length) {
    endField();
    rows.push(row);
  }
  const [header, ...body] = rows;
  return body
    .filter((r) => r.length > 1)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

async function ondo() {
  const response = await fetch(ONDO_CSV);
  if (!response.ok) throw new Error(`Ondo CSV ${response.status}`);
  return parseCsv(await response.text())
    .filter((r) => r["Solana Deployed Address"].trim() && ["Stock", "ETF"].includes(r.Type))
    .map((r) => ({
      issuer: "ondo",
      symbol: r.Symbol,
      ticker: r["Stock Ticker"] || r.Symbol.replace(/on$/, ""),
      name: r["Stock Name"] || r.Name,
      type: r.Type === "ETF" ? "ETF" : "Stock",
      sector: r["Sector / Taxonomy"] || null,
      mint: r["Solana Deployed Address"].trim(),
      hours: "24/5",
    }));
}

/**
 * xStocks publishes no asset type. Take it from Ondo's official list when it
 * covers the same underlying, else NYSE Arca listing (an ETF venue), else
 * the name.
 */
function xstockType(node, ondoTypes) {
  const ticker = node.underlyingSymbol;
  if (ticker && ondoTypes.has(ticker)) return ondoTypes.get(ticker);
  if (node.underlying?.exchange?.mic === "ARCX") return "ETF";
  return /\bETF\b|Fund|Trust/i.test(node.name) ? "ETF" : "Stock";
}

async function xstocks(ondoTypes) {
  const assets = [];
  for (let page = 0; ; page++) {
    const response = await fetch(`${XSTOCKS_API}?page=${page}&pageSize=100`);
    if (!response.ok) throw new Error(`xStocks API ${response.status}`);
    const { nodes, page: info } = await response.json();
    for (const node of nodes) {
      const solana = (node.deployments ?? []).find((d) => d.network === "Solana");
      if (!solana) continue;
      const mode = node.trading?.tradingHoursMode;
      assets.push({
        issuer: "xstocks",
        symbol: node.symbol,
        ticker: node.underlyingSymbol ?? node.symbol.replace(/x$/, ""),
        name: node.name.replace(/ xStock$/, ""),
        type: xstockType(node, ondoTypes),
        sector: node.underlying?.type ?? null,
        mint: solana.address,
        hours:
          mode === "TwentyFourFive"
            ? "24/5"
            : mode === "MarketHours" || mode === "Regular"
              ? "Market hours"
              : "Unknown",
      });
    }
    if (!info?.hasNextPage) break;
  }
  return assets;
}

const o = await ondo();
const x = await xstocks(new Map(o.map((a) => [a.ticker, a.type])));
const all = [...x, ...o].sort(
  (a, b) => a.ticker.localeCompare(b.ticker) || a.issuer.localeCompare(b.issuer),
);
const mints = new Set(all.map((a) => a.mint));
if (mints.size !== all.length) throw new Error("Duplicate mint in sources");
writeFileSync(
  OUT,
  JSON.stringify(
    {
      syncedAt: new Date().toISOString(),
      sources: { ondo: "https://docs.ondo.finance/addresses", xstocks: XSTOCKS_API },
      assets: all,
    },
    null,
    1,
  ) + "\n",
);
console.log(
  `Wrote ${all.length} stock sources (${x.length} xStocks, ${o.length} Ondo) to ${OUT.pathname}`,
);
