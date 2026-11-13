'use strict';
// Forecast builders. Method (documented, no fake precision):
// - Direction (yes/no + confidence): sign of the price change over the
//   horizon window; confidence grows with |change|, capped at 0.75.
//   A confident wrong call costs more than a hedged one, so the cap is low.
// - Close (single number): last close * (1 + 0.5 * mean daily return of the
//   last 5 days) — a damped naive trend forecast.
// - If price data cannot be fetched, the builder returns a NEUTRAL prediction
//   (confidence 0.5) and flags fallback:true in the transcript instead of
//   inventing a price.
const prices = require('../prices');

function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }

function directionFromCloses(closes) {
  if (!closes || closes.length < 2) return { answer: 'yes', confidence: 0.5, fallback: true };
  const first = closes[0], last = closes[closes.length - 1];
  const change = (last - first) / first;
  return {
    answer: change >= 0 ? 'yes' : 'no',
    confidence: Math.round(clamp(0.5 + Math.min(Math.abs(change), 0.1) * 2, 0.51, 0.75) * 100) / 100,
    fallback: false, windowChange: Math.round(change * 10000) / 10000,
  };
}

function closeFromCloses(closes) {
  if (!closes || closes.length < 2) return null;
  const last = closes[closes.length - 1];
  const rets = [];
  for (let i = 1; i < closes.length; i++) rets.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  return Math.round(last * (1 + 0.5 * mean) * 100) / 100;
}

async function buildForecast(slug, priceApi = prices) {
  switch (slug) {
    case 'btc-tomorrow': {
      const closes = await priceApi.cryptoCloses('bitcoin', 2).catch(() => null);
      const p = directionFromCloses(closes);
      return { prediction: { answer: p.answer, confidence: p.confidence }, meta: p };
    }
    case 'forecast-eth-24h':
    case 'signal-eth-pnl-24h': {
      const closes = await priceApi.cryptoCloses('ethereum', 2).catch(() => null);
      const p = directionFromCloses(closes);
      // signal-eth-pnl-24h wants a directional call; same yes/no shape as the
      // documented forecast payload (answer + confidence).
      return { prediction: { answer: p.answer, confidence: p.confidence }, meta: p };
    }
    case 'forecast-btc-7d': {
      const closes = await priceApi.cryptoCloses('bitcoin', 8).catch(() => null);
      const p = directionFromCloses(closes);
      return { prediction: { answer: p.answer, confidence: p.confidence }, meta: p };
    }
    case 'spy-close-1dollar': {
      const { closes } = await priceApi.yahooCloses('SPY').catch(() => ({ closes: null }));
      const v = closeFromCloses(closes);
      if (v == null) return null;
      return { prediction: { answer: v }, meta: { lastClose: closes[closes.length - 1] } };
    }
    case 'forecast-gold-tomorrow': {
      const { closes } = await priceApi.yahooCloses('GLD').catch(() => ({ closes: null }));
      const v = closeFromCloses(closes);
      if (v == null) return null;
      return { prediction: { answer: v }, meta: { lastClose: closes[closes.length - 1] } };
    }
    case 'forecast-nvda-3d': {
      const { closes } = await priceApi.yahooCloses('NVDA').catch(() => ({ closes: null }));
      const v = closeFromCloses(closes);
      if (v == null) return null;
      return { prediction: { answer: v }, meta: { lastClose: closes[closes.length - 1] } };
    }
    default:
      return null;
  }
}

module.exports = { buildForecast, directionFromCloses, closeFromCloses };
