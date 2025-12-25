

type MockCryptoData = {
  providerId: string;
  source: "mock";
  symbol: string;
  name: string;
  priceUsd: number;
  volume24hUsd: number | null;
  marketCapUsd: number | null;
  change24hPct: number | null;
};

const BASE_PRICES: Record<string, { price: number; name: string; marketCap: number; volume: number }> = {
  bitcoin: { price: 97500, name: "Bitcoin", marketCap: 1_920_000_000_000, volume: 45_000_000_000 },
  ethereum: { price: 3650, name: "Ethereum", marketCap: 440_000_000_000, volume: 18_000_000_000 },
  solana: { price: 245, name: "Solana", marketCap: 115_000_000_000, volume: 4_500_000_000 },
  cardano: { price: 1.05, name: "Cardano", marketCap: 37_000_000_000, volume: 850_000_000 },
  ripple: { price: 2.45, name: "XRP", marketCap: 140_000_000_000, volume: 12_000_000_000 },
  dogecoin: { price: 0.42, name: "Dogecoin", marketCap: 62_000_000_000, volume: 3_200_000_000 },
  polkadot: { price: 9.8, name: "Polkadot", marketCap: 15_000_000_000, volume: 450_000_000 },
  avalanche: { price: 52, name: "Avalanche", marketCap: 21_000_000_000, volume: 780_000_000 },
  chainlink: { price: 24, name: "Chainlink", marketCap: 15_000_000_000, volume: 650_000_000 },
  polygon: { price: 0.62, name: "Polygon", marketCap: 6_200_000_000, volume: 320_000_000 },
};

function randomVariation(basePrice: number): number {
  const variation = (Math.random() - 0.5) * 0.06;
  return basePrice * (1 + variation);
}

function random24hChange(): number {
  return (Math.random() - 0.5) * 20;
}


export async function fetchFromMock(ids: string[]): Promise<MockCryptoData[]> {
  await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 100));

  const results: MockCryptoData[] = [];

  for (const id of ids) {
    const base = BASE_PRICES[id];

    if (base) {
      results.push({
        providerId: id,
        source: "mock",
        symbol: id,
        name: base.name,
        priceUsd: randomVariation(base.price),
        volume24hUsd: randomVariation(base.volume),
        marketCapUsd: randomVariation(base.marketCap),
        change24hPct: random24hChange(),
      });
    } else {
      results.push({
        providerId: id,
        source: "mock",
        symbol: id,
        name: id.charAt(0).toUpperCase() + id.slice(1),
        priceUsd: Math.random() * 100,
        volume24hUsd: Math.random() * 1_000_000_000,
        marketCapUsd: Math.random() * 10_000_000_000,
        change24hPct: random24hChange(),
      });
    }
  }

  console.log(`[mock] Generated ${results.length} mock prices`);
  return results;
}
