import { env } from "../config/env.js";

// Petite fonction utilitaire de pause (pour le retry)
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

  // On tente jusqu’à 3 fois avec backoff 300ms, 800ms
  const attempts = 3;
  let lastErr: unknown;

  for (let i = 1; i <= attempts; i++) {
    // Timeout via AbortController
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), env.httpTimeout);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "accept": "application/json",
          // "user-agent": "gla-collector/1.0" // parfois utile
        },
      });
      clearTimeout(t);

      if (!res.ok) {
        // HTTP != 200 : on jette une erreur explicite
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
      // On mémorise l’erreur et on retente (sauf dernier essai)
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

  // Dernier échec → on propage une erreur détaillée
  const le = lastErr as any;
  const code = le?.cause?.code || le?.code || le?.name || "unknown";
  const msg = le?.message || String(le);
  throw new Error(`CoinCap fetch failed: ${code} ${msg}`);
}

