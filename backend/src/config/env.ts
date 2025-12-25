import "dotenv/config";

export const env = {
  port: Number(process.env.PORT ?? 3001),
  dbUrl: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  coins: (process.env.COINS ?? "bitcoin,ethereum")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  intervalSeconds: Number(process.env.INTERVAL_SECONDS ?? 300),
  httpTimeout: Number(process.env.HTTP_TIMEOUT ?? 20000),
  provider: (process.env.PROVIDER ?? "coingecko").toLowerCase() as "coingecko" | "mock",
  useMockFallback: process.env.USE_MOCK_FALLBACK === "true",
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "default_secret_change_me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
} as const;

