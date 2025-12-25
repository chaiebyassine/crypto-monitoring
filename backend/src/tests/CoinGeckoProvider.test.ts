import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import nock from "nock";

describe("CoinGeckoProvider", () => {
  const COINGECKO_API = "https://api.coingecko.com";

  beforeEach(() => {
    nock.cleanAll();
    vi.resetModules(); // Reset les modules pour réinitialiser le rate limiter
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe("fetchFromCoinGecko", () => {
    it("devrait récupérer et normaliser les données des cryptos", async () => {
      const { fetchFromCoinGecko } = await import("../providers/CoinGeckoProvider.js");
      
      // Mock de la réponse CoinGecko
      const mockResponse = [
        {
          id: "bitcoin",
          name: "Bitcoin",
          current_price: 97500,
          market_cap: 1920000000000,
          total_volume: 45000000000,
          price_change_percentage_24h: 2.5,
        },
        {
          id: "ethereum",
          name: "Ethereum",
          current_price: 3650,
          market_cap: 440000000000,
          total_volume: 18000000000,
          price_change_percentage_24h: 1.8,
        },
      ];

      nock(COINGECKO_API)
        .get("/api/v3/coins/markets")
        .query({ vs_currency: "usd", ids: "bitcoin,ethereum" })
        .reply(200, mockResponse);

      const result = await fetchFromCoinGecko(["bitcoin", "ethereum"]);

      expect(result).toHaveLength(2);

      // Vérifier Bitcoin
      expect(result[0]).toEqual({
        providerId: "bitcoin",
        source: "coingecko",
        symbol: "bitcoin",
        name: "Bitcoin",
        priceUsd: 97500,
        volume24hUsd: 45000000000,
        marketCapUsd: 1920000000000,
        change24hPct: 2.5,
      });

      // Vérifier Ethereum
      expect(result[1]).toEqual({
        providerId: "ethereum",
        source: "coingecko",
        symbol: "ethereum",
        name: "Ethereum",
        priceUsd: 3650,
        volume24hUsd: 18000000000,
        marketCapUsd: 440000000000,
        change24hPct: 1.8,
      });
    });

    it("devrait gérer les valeurs manquantes avec null", async () => {
      const { fetchFromCoinGecko } = await import("../providers/CoinGeckoProvider.js");
      
      const mockResponse = [
        {
          id: "solana",
          name: "Solana",
          current_price: 245,
          // market_cap, total_volume, price_change_percentage_24h manquants
        },
      ];

      nock(COINGECKO_API)
        .get("/api/v3/coins/markets")
        .query({ vs_currency: "usd", ids: "solana" })
        .reply(200, mockResponse);

      const result = await fetchFromCoinGecko(["solana"]);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        providerId: "solana",
        source: "coingecko",
        symbol: "solana",
        name: "Solana",
        priceUsd: 245,
        volume24hUsd: null,
        marketCapUsd: null,
        change24hPct: null,
      });
    });

    it("devrait gérer les erreurs HTTP 500", async () => {
      const { fetchFromCoinGecko } = await import("../providers/CoinGeckoProvider.js");
      
      nock(COINGECKO_API)
        .get("/api/v3/coins/markets")
        .query({ vs_currency: "usd", ids: "bitcoin" })
        .reply(500, "Internal Server Error");

      await expect(fetchFromCoinGecko(["bitcoin"])).rejects.toThrow("HTTP 500");
    });

    it("devrait retourner un tableau vide pour une réponse vide", async () => {
      const { fetchFromCoinGecko } = await import("../providers/CoinGeckoProvider.js");
      
      nock(COINGECKO_API)
        .get("/api/v3/coins/markets")
        .query({ vs_currency: "usd", ids: "unknown_coin" })
        .reply(200, []);

      const result = await fetchFromCoinGecko(["unknown_coin"]);

      expect(result).toHaveLength(0);
      expect(result).toEqual([]);
    });

    it("devrait gérer plusieurs cryptos dans une seule requête", async () => {
      const { fetchFromCoinGecko } = await import("../providers/CoinGeckoProvider.js");
      
      const mockResponse = [
        {
          id: "bitcoin",
          name: "Bitcoin",
          current_price: 97500,
          market_cap: 1920000000000,
          total_volume: 45000000000,
          price_change_percentage_24h: 2.5,
        },
        {
          id: "ethereum",
          name: "Ethereum",
          current_price: 3650,
          market_cap: 440000000000,
          total_volume: 18000000000,
          price_change_percentage_24h: 1.8,
        },
        {
          id: "solana",
          name: "Solana",
          current_price: 245,
          market_cap: 115000000000,
          total_volume: 4500000000,
          price_change_percentage_24h: 5.2,
        },
      ];

      nock(COINGECKO_API)
        .get("/api/v3/coins/markets")
        .query({ vs_currency: "usd", ids: "bitcoin,ethereum,solana" })
        .reply(200, mockResponse);

      const result = await fetchFromCoinGecko(["bitcoin", "ethereum", "solana"]);

      expect(result).toHaveLength(3);
      expect(result.map((r) => r.providerId)).toEqual([
        "bitcoin",
        "ethereum",
        "solana",
      ]);
    });

    it("devrait gérer les erreurs réseau (timeout)", async () => {
      const { fetchFromCoinGecko } = await import("../providers/CoinGeckoProvider.js");
      
      nock(COINGECKO_API)
        .get("/api/v3/coins/markets")
        .query({ vs_currency: "usd", ids: "bitcoin" })
        .replyWithError({ code: "ETIMEDOUT", message: "Connection timed out" });

      await expect(fetchFromCoinGecko(["bitcoin"])).rejects.toThrow();
    });

    // Test rate limiting en dernier pour éviter d'affecter les autres tests
    it("devrait gérer le rate limiting (429)", async () => {
      const { fetchFromCoinGecko } = await import("../providers/CoinGeckoProvider.js");
      
      nock(COINGECKO_API)
        .get("/api/v3/coins/markets")
        .query({ vs_currency: "usd", ids: "bitcoin" })
        .reply(429, "Too Many Requests");

      await expect(fetchFromCoinGecko(["bitcoin"])).rejects.toThrow(
        "Rate limited"
      );
    });
  });
});
