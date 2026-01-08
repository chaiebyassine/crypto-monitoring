import { env } from "../config/env.js";

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  timestamp?: string;
  footer?: { text: string };
}

export interface DiscordMessage {
  content?: string;
  username?: string;
  avatar_url?: string;
  embeds?: DiscordEmbed[];
}

export interface NotifyResult {
  success: boolean;
  errorMsg?: string;
}

export async function sendDiscordNotification(message: DiscordMessage): Promise<NotifyResult> {
  const webhookUrl = env.discordWebhookUrl;

  console.log(`[Discord] Attempting to send notification to webhook...`);
  console.log(`[Discord] Webhook URL configured: ${webhookUrl ? "YES" : "NO"}`);

  if (!webhookUrl) {
    console.warn("Discord webhook URL not configured, skipping notification");
    return { success: false, errorMsg: "Discord webhook URL not configured" };
  }

  try {
    console.log(`[Discord] Sending message:`, JSON.stringify(message, null, 2));
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });

    console.log(`[Discord] Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Discord webhook failed: ${response.status} - ${errorText}`);
      return {
        success: false,
        errorMsg: `HTTP ${response.status}: ${errorText.slice(0, 200)}`,
      };
    }

    console.log(`[Discord]  Notification sent successfully!`);
    return { success: true };
  } catch (error: any) {
    const errorMsg = error?.message ?? String(error);
    console.error(`Discord webhook error: ${errorMsg}`);
    return { success: false, errorMsg };
  }
}

export async function sendAlertNotification(params: {
  assetName: string;
  assetSymbol: string;
  alertType: string;
  threshold: number;
  currentPrice: number;
  change24hPct?: number | null;
}): Promise<NotifyResult> {
  const { assetName, assetSymbol, alertType, threshold, currentPrice, change24hPct } = params;

  const isPositive = alertType === "price_above" || alertType === "change_above";
  const color = isPositive ? 0x22c55e : 0xef4444;

  const alertTypeLabels: Record<string, string> = {
    price_above: "PRIX SUPÉRIEUR À",
    price_below: "PRIX INFÉRIEUR À",
    change_above: "VARIATION 24H SUPÉRIEURE À",
    change_below: "VARIATION 24H INFÉRIEURE À",
  };
  const alertTypeDisplay = alertTypeLabels[alertType] || alertType.replace("_", " ").toUpperCase();

  const embed: DiscordEmbed = {
    title: `Alerte Déclenchée: ${assetName} (${assetSymbol.toUpperCase()})`,
    description: `Votre alerte **${alertTypeDisplay}** a été déclenchée !`,
    color,
    fields: [
      {
        name: " Prix Actuel",
        value: `$${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`,
        inline: true,
      },
      {
        name: " Seuil",
        value: alertType.includes("price")
          ? `$${threshold.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
          : `${threshold}%`,
        inline: true,
      },
    ],
    timestamp: new Date().toISOString(),
    footer: { text: "Système d'Alertes Crypto" },
  };

  if (change24hPct !== null && change24hPct !== undefined) {
    const changeSign = change24hPct >= 0 ? "+" : "";
    embed.fields?.push({
      name: " Variation 24h",
      value: `${changeSign}${change24hPct.toFixed(2)}%`,
      inline: true,
    });
  }

  return sendDiscordNotification({
    username: "Crypto Alerts",
    embeds: [embed],
  });
}
