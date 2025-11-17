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
} as const;

