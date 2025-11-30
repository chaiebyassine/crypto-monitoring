import { prisma } from "../repos/prisma.js";

export type TradeSide = "buy" | "sell";

export interface TradeInput {
  portfolioId: number;
  assetId: number;
  side: TradeSide;
  quantity: number;
  priceUsd: number;
  notes?: string;
}

export interface TradeResult {
  trade: {
    id: number;
    side: string;
    quantity: number;
    priceUsd: number;
    totalUsd: number;
    executedAt: Date;
  };
  position: {
    quantity: number;
    avgCost: number;
    totalCost: number;
  };
  realizedPnl?: number;
}

export interface PositionWithPnL {
  id: number;
  assetId: number;
  symbol: string;
  name: string;
  quantity: number;
  avgCost: number;
  totalCost: number;
  currentPrice: number;
  currentValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
}

export interface PortfolioPnL {
  portfolioId: number;
  portfolioName: string;
  positions: PositionWithPnL[];
  totals: {
    totalCost: number;
    totalValue: number;
    unrealizedPnl: number;
    unrealizedPnlPct: number;
    realizedPnl: number;
  };
}


export async function createPortfolio(name: string) {
  return prisma.portfolio.create({
    data: { name },
  });
}

export async function getPortfolios() {
  return prisma.portfolio.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function getPortfolio(id: number) {
  return prisma.portfolio.findUnique({
    where: { id },
    include: {
      positions: { include: { asset: true } },
      trades: { orderBy: { executedAt: "desc" }, take: 50 },
    },
  });
}


export async function executeTrade(input: TradeInput): Promise<TradeResult> {
  const { portfolioId, assetId, side, quantity, priceUsd, notes } = input;

  if (quantity <= 0) {
    throw new Error("Quantity must be positive");
  }
  if (priceUsd <= 0) {
    throw new Error("Price must be positive");
  }

  const portfolio = await prisma.portfolio.findUnique({
    where: { id: portfolioId },
  });
  if (!portfolio) {
    throw new Error("Portfolio not found");
  }

  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) {
    throw new Error("Asset not found");
  }

  const totalUsd = quantity * priceUsd;

  const existingPosition = await prisma.position.findUnique({
    where: { portfolioId_assetId: { portfolioId, assetId } },
  });

  let realizedPnl: number | undefined;
  let newQuantity: number;
  let newAvgCost: number;

  if (side === "buy") {
    const currentQty = existingPosition?.quantity ?? 0;
    const currentAvgCost = existingPosition?.avgCost ?? 0;
    const currentTotalCost = currentQty * currentAvgCost;

    newQuantity = currentQty + quantity;
    newAvgCost =
      newQuantity > 0 ? (currentTotalCost + totalUsd) / newQuantity : priceUsd;
  } else {
    const currentQty = existingPosition?.quantity ?? 0;
    const currentAvgCost = existingPosition?.avgCost ?? 0;

    if (quantity > currentQty) {
      throw new Error(
        `Insufficient position: have ${currentQty}, trying to sell ${quantity}`
      );
    }

    realizedPnl = (priceUsd - currentAvgCost) * quantity;

    newQuantity = currentQty - quantity;
    newAvgCost = currentAvgCost;
  }

  const result = await prisma.$transaction(async (tx) => {
    const trade = await tx.trade.create({
      data: {
        portfolioId,
        assetId,
        side,
        quantity,
        priceUsd,
        totalUsd,
        notes,
      },
    });

    let position;
    if (newQuantity > 0) {
      position = await tx.position.upsert({
        where: { portfolioId_assetId: { portfolioId, assetId } },
        create: {
          portfolioId,
          assetId,
          quantity: newQuantity,
          avgCost: newAvgCost,
        },
        update: {
          quantity: newQuantity,
          avgCost: newAvgCost,
        },
      });
    } else {
      if (existingPosition) {
        await tx.position.delete({
          where: { id: existingPosition.id },
        });
      }
      position = { quantity: 0, avgCost: 0 };
    }

    return { trade, position };
  });

  return {
    trade: {
      id: result.trade.id,
      side: result.trade.side,
      quantity: result.trade.quantity,
      priceUsd: result.trade.priceUsd,
      totalUsd: result.trade.totalUsd,
      executedAt: result.trade.executedAt,
    },
    position: {
      quantity: newQuantity,
      avgCost: newAvgCost,
      totalCost: newQuantity * newAvgCost,
    },
    realizedPnl,
  };
}

async function getCurrentPrice(assetId: number): Promise<number | null> {
  const snapshot = await prisma.marketSnapshot.findFirst({
    where: { assetId },
    orderBy: { ingestedAt: "desc" },
    select: { priceUsd: true },
  });
  return snapshot?.priceUsd ?? null;
}

export function calculateUnrealizedPnL(
  quantity: number,
  avgCost: number,
  currentPrice: number
): { pnl: number; pnlPct: number } {
  const totalCost = quantity * avgCost;
  const currentValue = quantity * currentPrice;
  const pnl = currentValue - totalCost;
  const pnlPct = totalCost > 0 ? (pnl / totalCost) * 100 : 0;

  return { pnl, pnlPct };
}

export async function getPortfolioPnL(
  portfolioId: number
): Promise<PortfolioPnL | null> {
  const portfolio = await prisma.portfolio.findUnique({
    where: { id: portfolioId },
    include: {
      positions: { include: { asset: true } },
    },
  });

  if (!portfolio) return null;

  const positions: PositionWithPnL[] = [];
  let totalCost = 0;
  let totalValue = 0;

  for (const pos of portfolio.positions) {
    const currentPrice = await getCurrentPrice(pos.assetId);
    if (currentPrice === null) continue;

    const posTotalCost = pos.quantity * pos.avgCost;
    const currentValue = pos.quantity * currentPrice;
    const { pnl, pnlPct } = calculateUnrealizedPnL(
      pos.quantity,
      pos.avgCost,
      currentPrice
    );

    positions.push({
      id: pos.id,
      assetId: pos.assetId,
      symbol: pos.asset.symbol,
      name: pos.asset.name,
      quantity: pos.quantity,
      avgCost: pos.avgCost,
      totalCost: posTotalCost,
      currentPrice,
      currentValue,
      unrealizedPnl: pnl,
      unrealizedPnlPct: pnlPct,
    });

    totalCost += posTotalCost;
    totalValue += currentValue;
  }

  const realizedPnl = await calculateRealizedPnL(portfolioId);

  const unrealizedPnl = totalValue - totalCost;
  const unrealizedPnlPct = totalCost > 0 ? (unrealizedPnl / totalCost) * 100 : 0;

  return {
    portfolioId,
    portfolioName: portfolio.name,
    positions,
    totals: {
      totalCost,
      totalValue,
      unrealizedPnl,
      unrealizedPnlPct,
      realizedPnl,
    },
  };
}


async function calculateRealizedPnL(portfolioId: number): Promise<number> {
  const trades = await prisma.trade.findMany({
    where: { portfolioId },
    orderBy: { executedAt: "asc" },
  });

  const assetState = new Map<
    number,
    { quantity: number; avgCost: number; realizedPnl: number }
  >();

  for (const trade of trades) {
    const state = assetState.get(trade.assetId) ?? {
      quantity: 0,
      avgCost: 0,
      realizedPnl: 0,
    };

    if (trade.side === "buy") {
      const newTotalCost =
        state.quantity * state.avgCost + trade.quantity * trade.priceUsd;
      state.quantity += trade.quantity;
      state.avgCost = state.quantity > 0 ? newTotalCost / state.quantity : 0;
    } else {
      const pnl = (trade.priceUsd - state.avgCost) * trade.quantity;
      state.realizedPnl += pnl;
      state.quantity -= trade.quantity;
    }

    assetState.set(trade.assetId, state);
  }

  let totalRealizedPnl = 0;
  for (const state of assetState.values()) {
    totalRealizedPnl += state.realizedPnl;
  }

  return totalRealizedPnl;
}
export async function getTradeHistory(
  portfolioId: number,
  limit: number = 50
) {
  return prisma.trade.findMany({
    where: { portfolioId },
    include: { asset: true },
    orderBy: { executedAt: "desc" },
    take: limit,
  });
}
export async function getAssetTradeHistory(
  portfolioId: number,
  assetId: number,
  limit: number = 50
) {
  return prisma.trade.findMany({
    where: { portfolioId, assetId },
    orderBy: { executedAt: "desc" },
    take: limit,
  });
}
