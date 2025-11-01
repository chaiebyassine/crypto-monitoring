import 'dotenv/config';

export const env = {
  port: Number(process.env.PORT ?? 3001),
  dbUrl: process.env.DATABASE_URL ?? 'file:./dev.db',
  coins: (process.env.COINS ?? 'bitcoin,ethereum').split(','),
  intervalSeconds: Number(process.env.INTERVAL_SECONDS ?? 300),
  httpTimeout: Number(process.env.HTTP_TIMEOUT ?? 20000),
  provider: process.env.PROVIDER ?? 'coincap',
} as const;
