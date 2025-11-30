import { prisma } from "../repos/prisma.js";

// Données mock pour 5 cryptos principales
const SEED_CRYPTOS = [
  {
    providerId: "bitcoin",
    source: "coingecko",
    symbol: "bitcoin",
    name: "Bitcoin",
    priceUsd: 97500,
    volume24hUsd: 45_000_000_000,
    marketCapUsd: 1_920_000_000_000,
    change24hPct: 2.5,
  },
  {
    providerId: "ethereum",
    source: "coingecko",
    symbol: "ethereum",
    name: "Ethereum",
    priceUsd: 3650,
    volume24hUsd: 18_000_000_000,
    marketCapUsd: 440_000_000_000,
    change24hPct: 1.8,
  },
  {
    providerId: "solana",
    source: "coingecko",
    symbol: "solana",
    name: "Solana",
    priceUsd: 245,
    volume24hUsd: 4_500_000_000,
    marketCapUsd: 115_000_000_000,
    change24hPct: 5.2,
  },
  {
    providerId: "cardano",
    source: "coingecko",
    symbol: "cardano",
    name: "Cardano",
    priceUsd: 1.05,
    volume24hUsd: 850_000_000,
    marketCapUsd: 37_000_000_000,
    change24hPct: -0.8,
  },
  {
    providerId: "ripple",
    source: "coingecko",
    symbol: "ripple",
    name: "XRP",
    priceUsd: 2.45,
    volume24hUsd: 12_000_000_000,
    marketCapUsd: 140_000_000_000,
    change24hPct: 3.1,
  },
];

async function seed() {
  console.log("🌱 Seeding database...");

  for (const crypto of SEED_CRYPTOS) {
    // Créer ou mettre à jour l'asset
    const asset = await prisma.asset.upsert({
      where: { providerId: crypto.providerId },
      update: {},
      create: {
        providerId: crypto.providerId,
        source: crypto.source,
        symbol: crypto.symbol,
        name: crypto.name,
      },
    });

    console.log(`  ✓ Asset: ${asset.name} (id: ${asset.id})`);

    // Créer un snapshot initial
    await prisma.marketSnapshot.create({
      data: {
        assetId: asset.id,
        priceUsd: crypto.priceUsd,
        volume24hUsd: crypto.volume24hUsd,
        marketCapUsd: crypto.marketCapUsd,
        change24hPct: crypto.change24hPct,
      },
    });
  }

  // Créer un CollectRun pour tracer le seed
  await prisma.collectRun.create({
    data: {
      status: "success",
      assetsCount: SEED_CRYPTOS.length,
      insertedCount: SEED_CRYPTOS.length,
      endedAt: new Date(),
    },
  });

  console.log(`\n✅ Seed completed: ${SEED_CRYPTOS.length} cryptos loaded`);
}

seed()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
