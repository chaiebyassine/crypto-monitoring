import "dotenv/config";


export const env = {
  port: Number(process.env.PORT ?? 3001),

  dbUrl: process.env.DATABASE_URL ?? "file:./prisma/dev.db",

  coins: (process.env.COINS ?? "bitcoin,ethereum")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  intervalSeconds: Number(process.env.INTERVAL_SECONDS ?? 60),

  httpTimeout: Number(process.env.HTTP_TIMEOUT ?? 20000),

  provider: (process.env.PROVIDER ?? "coingecko").toLowerCase(),

  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL ?? "https://discord.com/api/webhooks/1443666875518025881/0wO-jeJUkyG_ESjnYAgndErqwDRK-0gTwzlRwqNHwDbE1apG3o7_qND3fHmxxekiCJR0",
} as const;

