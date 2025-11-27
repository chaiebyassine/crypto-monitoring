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

export async function sendDiscordNotification(
  message: DiscordMessage
): Promise<NotifyResult> {
  const webhookUrl = env.discordWebhookUrl;

  if (!webhookUrl) {
    console.warn("Discord webhook URL not configured, skipping notification");
    return { success: false, errorMsg: "Discord webhook URL not configured" };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Discord webhook failed: ${response.status} - ${errorText}`);
      return {
        success: false,
        errorMsg: `HTTP ${response.status}: ${errorText.slice(0, 200)}`,
      };
    }

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
  const { assetName, assetSymbol, alertType, threshold, currentPrice, change24hPct } =
    params;

  const isPositive = alertType === "price_above" || alertType === "change_above";
  const color = isPositive ? 0x22c55e : 0xef4444; 
  const alertTypeDisplay = alertType.replace("_", " ").toUpperCase();

  const embed: DiscordEmbed = {
    title: `🚨 Alert Triggered: ${assetName} (${assetSymbol.toUpperCase()})`,
    description: `Your **${alertTypeDisplay}** alert has been triggered!`,
    color,
    fields: [
      {
        name: "Current Price",
        value: `$${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`,
        inline: true,
      },
      {
        name: "Threshold",
        value: alertType.includes("price")
          ? `$${threshold.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
          : `${threshold}%`,
        inline: true,
      },
    ],
    timestamp: new Date().toISOString(),
    footer: { text: "Crypto Alert System" },
  };

  if (change24hPct !== null && change24hPct !== undefined) {
    const changeSign = change24hPct >= 0 ? "+" : "";
    embed.fields?.push({
      name: "24h Change",
      value: `${changeSign}${change24hPct.toFixed(2)}%`,
      inline: true,
    });
  }

  return sendDiscordNotification({
    username: "Crypto Alerts",
    embeds: [embed],
  });
}
