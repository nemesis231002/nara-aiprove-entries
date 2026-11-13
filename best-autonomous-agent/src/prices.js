'use strict';
// Public, keyless price data for the forecast builders.
// - Crypto: CoinGecko (no key). - Stocks/ETF: Yahoo Finance chart API (no key).
// Stooq was tried and is bot-blocked from this host. Every function falls
// back to null so the caller can use an explicit neutral prediction instead
// of inventing a price.
async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'best-autonomous-agent/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} GET ${url}`);
  return res.json();
}

// Daily closes for a CoinGecko coin id over the last `days` days.
async function cryptoCloses(id, days) {
  const data = await fetchJson(
    `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}&interval=daily`);
  return (data.prices || []).map(p => p[1]);
}

// Daily closes for a Yahoo symbol over the last 5 days.
async function yahooCloses(symbol) {
  const data = await fetchJson(
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=5d&interval=1d`);
  const r = data?.chart?.result?.[0];
  const closes = r?.indicators?.quote?.[0]?.close?.filter(x => x != null) || [];
  return { closes, last: r?.meta?.regularMarketPrice ?? closes[closes.length - 1] };
}

module.exports = { fetchJson, cryptoCloses, yahooCloses };
