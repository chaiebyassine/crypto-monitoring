import { prisma } from "../repos/prisma.js";

export type ForecastMethod = "sma" | "ema" | "linear";

export interface ForecastPoint {
  t: Date;
  price: number;
  predicted?: boolean;
}

export interface ForecastResult {
  symbol: string;
  method: ForecastMethod;
  historical: ForecastPoint[];
  predicted: ForecastPoint[];
  metrics: {
    lastPrice: number;
    predictedChange: number;
    predictedChangePct: number;
  };
}

/**
 * Generate price forecast for an asset
 */
export async function generateForecast(
  symbol: string,
  method: ForecastMethod = "ema",
  historyLimit: number = 50,
  forecastSteps: number = 10
): Promise<ForecastResult | null> {
  // Find asset
  const asset = await prisma.asset.findFirst({
    where: { symbol: symbol.toLowerCase() },
  });

  if (!asset) return null;

  // Get historical data
  const snapshots = await prisma.marketSnapshot.findMany({
    where: { assetId: asset.id },
    orderBy: { ingestedAt: "desc" },
    take: historyLimit,
    select: { ingestedAt: true, priceUsd: true },
  });

  if (snapshots.length < 5) return null;

  const historical = snapshots.reverse().map((s) => ({
    t: s.ingestedAt,
    price: s.priceUsd,
  }));

  const prices = historical.map((h) => h.price);

  let predicted: ForecastPoint[];

  switch (method) {
    case "sma":
      predicted = forecastSMA(historical, forecastSteps);
      break;
    case "ema":
      predicted = forecastEMA(historical, forecastSteps);
      break;
    case "linear":
      predicted = forecastLinear(historical, forecastSteps);
      break;
    default:
      predicted = forecastEMA(historical, forecastSteps);
  }

  const lastPrice = prices[prices.length - 1];
  const lastPredicted = predicted[predicted.length - 1]?.price ?? lastPrice;
  const predictedChange = lastPredicted - lastPrice;
  const predictedChangePct = (predictedChange / lastPrice) * 100;

  return {
    symbol,
    method,
    historical,
    predicted,
    metrics: {
      lastPrice,
      predictedChange,
      predictedChangePct,
    },
  };
}

function forecastSMA(
  historical: ForecastPoint[],
  steps: number,
  period: number = 10
): ForecastPoint[] {
  const prices = historical.map((h) => h.price);
  const lastTime = historical[historical.length - 1].t.getTime();

  const intervals: number[] = [];
  for (let i = 1; i < historical.length; i++) {
    intervals.push(historical[i].t.getTime() - historical[i - 1].t.getTime());
  }
  const avgInterval =
    intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 60000; // Default 1 minute

  const smaValues = calculateSMA(prices, Math.min(period, prices.length));
  const lastSMA = smaValues[smaValues.length - 1];

  const smaTrend =
    smaValues.length >= 2
      ? (smaValues[smaValues.length - 1] - smaValues[smaValues.length - 2]) /
        smaValues[smaValues.length - 2]
      : 0;

  const predicted: ForecastPoint[] = [];
  let currentPrice = lastSMA;

  for (let i = 1; i <= steps; i++) {
    currentPrice = currentPrice * (1 + smaTrend * 0.5); // Dampen trend
    predicted.push({
      t: new Date(lastTime + avgInterval * i),
      price: currentPrice,
      predicted: true,
    });
  }

  return predicted;
}

function forecastEMA(
  historical: ForecastPoint[],
  steps: number,
  period: number = 10
): ForecastPoint[] {
  const prices = historical.map((h) => h.price);
  const lastTime = historical[historical.length - 1].t.getTime();

  const intervals: number[] = [];
  for (let i = 1; i < historical.length; i++) {
    intervals.push(historical[i].t.getTime() - historical[i - 1].t.getTime());
  }
  const avgInterval =
    intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 60000;

  const emaValues = calculateEMA(prices, Math.min(period, prices.length));
  const lastEMA = emaValues[emaValues.length - 1];
  const lastPrice = prices[prices.length - 1];

  const momentum = (lastPrice - lastEMA) / lastEMA;

  const emaTrend =
    emaValues.length >= 3
      ? (emaValues[emaValues.length - 1] - emaValues[emaValues.length - 3]) /
        emaValues[emaValues.length - 3] /
        2
      : 0;

  const predicted: ForecastPoint[] = [];
  let currentPrice = lastPrice;

  for (let i = 1; i <= steps; i++) {
    const decay = Math.exp(-i * 0.1);
    const change = (emaTrend + momentum * 0.3) * decay;
    currentPrice = currentPrice * (1 + change);

    predicted.push({
      t: new Date(lastTime + avgInterval * i),
      price: currentPrice,
      predicted: true,
    });
  }

  return predicted;
}

function forecastLinear(historical: ForecastPoint[], steps: number): ForecastPoint[] {
  const prices = historical.map((h) => h.price);
  const lastTime = historical[historical.length - 1].t.getTime();

  const intervals: number[] = [];
  for (let i = 1; i < historical.length; i++) {
    intervals.push(historical[i].t.getTime() - historical[i - 1].t.getTime());
  }
  const avgInterval =
    intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 60000;

  const n = prices.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const y = prices;

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
  const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const predicted: ForecastPoint[] = [];

  for (let i = 1; i <= steps; i++) {
    const futureX = n - 1 + i;
    const predictedPrice = slope * futureX + intercept;

    predicted.push({
      t: new Date(lastTime + avgInterval * i),
      price: Math.max(0, predictedPrice), // Ensure non-negative
      predicted: true,
    });
  }

  return predicted;
}

function calculateSMA(prices: number[], period: number): number[] {
  const result: number[] = [];

  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      const slice = prices.slice(0, i + 1);
      result.push(slice.reduce((a, b) => a + b, 0) / slice.length);
    } else {
      const slice = prices.slice(i - period + 1, i + 1);
      result.push(slice.reduce((a, b) => a + b, 0) / period);
    }
  }

  return result;
}

function calculateEMA(prices: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);

  for (let i = 0; i < prices.length; i++) {
    if (i === 0) {
      result.push(prices[0]);
    } else {
      const ema = (prices[i] - result[i - 1]) * multiplier + result[i - 1];
      result.push(ema);
    }
  }

  return result;
}
