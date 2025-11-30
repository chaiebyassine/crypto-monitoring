import { prisma } from "../repos/prisma.js";
import { sendAlertNotification } from "./NotifierService.js";

export type AlertType = "price_above" | "price_below" | "change_above" | "change_below";

interface LatestPrice {
  assetId: number;
  priceUsd: number;
  change24hPct: number | null;
}

interface AlertWithAsset {
  id: number;
  assetId: number;
  type: string;
  threshold: number;
  asset: {
    name: string;
    symbol: string;
  };
}


export async function evaluateAlerts(): Promise<{
  evaluated: number;
  triggered: number;
}> {
  const activeAlerts = await prisma.alert.findMany({
    where: { isActive: true },
    include: { asset: true },
  });

  if (activeAlerts.length === 0) {
    return { evaluated: 0, triggered: 0 };
  }

  const assetIds = [...new Set(activeAlerts.map((a) => a.assetId))];

  const latestPrices = await getLatestPrices(assetIds);
  const priceMap = new Map(latestPrices.map((p) => [p.assetId, p]));

  let triggered = 0;

  for (const alert of activeAlerts) {
    const latest = priceMap.get(alert.assetId);
    if (!latest) continue;

    const isTriggered = checkAlertCondition(
      alert.type as AlertType,
      alert.threshold,
      latest.priceUsd,
      latest.change24hPct
    );

    if (isTriggered) {
      await triggerAlert(alert as AlertWithAsset, latest);
      triggered++;
    }
  }

  return { evaluated: activeAlerts.length, triggered };
}

async function getLatestPrices(assetIds: number[]): Promise<LatestPrice[]> {
  const results: LatestPrice[] = [];

  for (const assetId of assetIds) {
    const snapshot = await prisma.marketSnapshot.findFirst({
      where: { assetId },
      orderBy: { ingestedAt: "desc" },
      select: { assetId: true, priceUsd: true, change24hPct: true },
    });

    if (snapshot) {
      results.push({
        assetId: snapshot.assetId,
        priceUsd: snapshot.priceUsd,
        change24hPct: snapshot.change24hPct,
      });
    }
  }

  return results;
}

function checkAlertCondition(
  type: AlertType,
  threshold: number,
  currentPrice: number,
  change24hPct: number | null
): boolean {
  switch (type) {
    case "price_above":
      return currentPrice >= threshold;
    case "price_below":
      return currentPrice <= threshold;
    case "change_above":
      return change24hPct !== null && change24hPct >= threshold;
    case "change_below":
      return change24hPct !== null && change24hPct <= threshold;
    default:
      return false;
  }
}

async function triggerAlert(
  alert: AlertWithAsset,
  latest: LatestPrice
): Promise<void> {
  const now = new Date();

  await prisma.alert.update({
    where: { id: alert.id },
    data: { lastTriggered: now },
  });

  const notifyResult = await sendAlertNotification({
    assetName: alert.asset.name,
    assetSymbol: alert.asset.symbol,
    alertType: alert.type,
    threshold: alert.threshold,
    currentPrice: latest.priceUsd,
    change24hPct: latest.change24hPct,
  });

  await prisma.notificationLog.create({
    data: {
      alertId: alert.id,
      channel: "discord",
      payload: {
        currentPrice: latest.priceUsd,
        threshold: alert.threshold,
        alertType: alert.type,
        triggeredAt: now.toISOString(),
      },
      success: notifyResult.success,
      errorMsg: notifyResult.errorMsg ?? null,
    },
  });

  if (notifyResult.success) {
    console.log(
      `Alert ${alert.id} triggered: ${alert.asset.symbol} ${alert.type} ${alert.threshold} (current: ${latest.priceUsd})`
    );
  } else {
    console.error(
      `Alert ${alert.id} triggered but notification failed: ${notifyResult.errorMsg}`
    );
  }
}
export async function createAlert(
  assetId: number,
  type: AlertType,
  threshold: number
) {
  return prisma.alert.create({
    data: {
      assetId,
      type,
      threshold,
      isActive: true,
    },
  });
}

export async function deactivateAlert(alertId: number) {
  return prisma.alert.update({
    where: { id: alertId },
    data: { isActive: false },
  });
}

export async function getAlertsByAsset(assetId: number) {
  return prisma.alert.findMany({
    where: { assetId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getActiveAlerts() {
  return prisma.alert.findMany({
    where: { isActive: true },
    include: { asset: true },
    orderBy: { createdAt: "desc" },
  });
}
