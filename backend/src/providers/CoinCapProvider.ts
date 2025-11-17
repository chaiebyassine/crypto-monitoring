import { env } from "../config/env.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type CoinCapAsset = {
  id: string;
  priceUsd: string;
  volumeUsd24Hr?: string;
  marketCapUsd?: string;
  changePercent24Hr?: string;
};

export async function fetchFromCoinCap(ids: string[]) {
  const url =
    "https://api.coincap.io/v2/assets?ids=" + encodeURIComponent(ids.join(","));

  const attempts = 3;
  let lastErr: unknown;

  for (let i = 1; i <= attempts; i++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), env.httpTimeout);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "accept": "application/json",
        },
      });
      clearTimeout(t);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      const json = (await res.json()) as { data: CoinCapAsset[] };

      return json.data.map((it) => ({
        providerId: it.id,
        source: "coincap" as const,
        symbol: it.id,
        name: it.id,
        priceUsd: Number(it.priceUsd),
        volume24hUsd: it.volumeUsd24Hr ? Number(it.volumeUsd24Hr) : null,
        marketCapUsd: it.marketCapUsd ? Number(it.marketCapUsd) : null,
        change24hPct: it.changePercent24Hr
          ? Number(it.changePercent24Hr)
          : null,
      }));
    } catch (e: any) {
      clearTimeout(t);
      lastErr = e;
      const code =
        e?.cause?.code || e?.code || e?.name || "unknown";
      const msg = e?.message || String(e);

      console.error(
        `[coincap] fetch attempt ${i}/${attempts} failed: ${code} ${msg}`
      );

      if (i < attempts) {
        await sleep(i === 1 ? 300 : 800);
        continue;
      }
    }
  }

  const le = lastErr as any;
  const code = le?.cause?.code || le?.code || le?.name || "unknown";
  const msg = le?.message || String(le);
  throw new Error(`coingeckop fetch failed: ${code} ${msg}`);
}

