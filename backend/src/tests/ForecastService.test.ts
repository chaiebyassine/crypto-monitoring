import { describe, it, expect, vi, beforeEach } from "vitest";

// Utiliser vi.hoisted() pour les mocks
const mockPrisma = vi.hoisted(() => ({
  asset: {
    findFirst: vi.fn(),
  },
  marketSnapshot: {
    findMany: vi.fn(),
  },
}));

vi.mock("../repos/prisma.js", () => ({
  prisma: mockPrisma,
}));

// Import après les mocks
import { generateForecast } from "../services/ForecastService.js";

describe("ForecastService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Générer des données historiques pour les tests (ordre DESC comme la BDD retourne)
  function generateHistoricalDataDesc(count: number, basePrice: number) {
    const data = [];
    const now = new Date();
    for (let i = 0; i < count; i++) {
      const date = new Date(now.getTime() - i * 5 * 60 * 1000);
      const variation = Math.sin(i * 0.5) * basePrice * 0.01; // Variation sinusoïdale
      data.push({
        ingestedAt: date,
        priceUsd: basePrice + variation,
      });
    }
    return data; // Le plus récent en premier (DESC)
  }

  describe("generateForecast", () => {
    it("devrait retourner null si l'asset n'existe pas", async () => {
      mockPrisma.asset.findFirst.mockResolvedValue(null);

      const result = await generateForecast("unknown_coin");

      expect(result).toBeNull();
    });

    it("devrait retourner null si pas assez de données historiques", async () => {
      mockPrisma.asset.findFirst.mockResolvedValue({
        id: 1,
        symbol: "bitcoin",
      });
      mockPrisma.marketSnapshot.findMany.mockResolvedValue([
        { ingestedAt: new Date(), priceUsd: 97500 },
        { ingestedAt: new Date(), priceUsd: 97600 },
      ]);

      const result = await generateForecast("bitcoin");

      expect(result).toBeNull();
    });

    it("devrait générer une prévision SMA valide", async () => {
      mockPrisma.asset.findFirst.mockResolvedValue({
        id: 1,
        symbol: "bitcoin",
      });
      mockPrisma.marketSnapshot.findMany.mockResolvedValue(generateHistoricalDataDesc(20, 97500));

      const result = await generateForecast("bitcoin", "sma", 20, 5);

      expect(result).not.toBeNull();
      expect(result!.symbol).toBe("bitcoin");
      expect(result!.method).toBe("sma");
      expect(result!.historical).toHaveLength(20);
      expect(result!.predicted).toHaveLength(5);
      expect(result!.metrics.lastPrice).toBeGreaterThan(0);
    });

    it("devrait générer une prévision EMA valide", async () => {
      mockPrisma.asset.findFirst.mockResolvedValue({
        id: 1,
        symbol: "ethereum",
      });
      mockPrisma.marketSnapshot.findMany.mockResolvedValue(generateHistoricalDataDesc(30, 3650));

      const result = await generateForecast("ethereum", "ema", 30, 10);

      expect(result).not.toBeNull();
      expect(result!.method).toBe("ema");
      expect(result!.predicted).toHaveLength(10);
    });

    it("devrait générer une prévision Linear valide", async () => {
      mockPrisma.asset.findFirst.mockResolvedValue({
        id: 1,
        symbol: "solana",
      });
      mockPrisma.marketSnapshot.findMany.mockResolvedValue(generateHistoricalDataDesc(25, 245));

      const result = await generateForecast("solana", "linear", 25, 8);

      expect(result).not.toBeNull();
      expect(result!.method).toBe("linear");
      expect(result!.predicted).toHaveLength(8);
    });

    it("devrait utiliser EMA par défaut si méthode non spécifiée", async () => {
      mockPrisma.asset.findFirst.mockResolvedValue({
        id: 1,
        symbol: "bitcoin",
      });
      mockPrisma.marketSnapshot.findMany.mockResolvedValue(generateHistoricalDataDesc(15, 97500));

      const result = await generateForecast("bitcoin");

      expect(result).not.toBeNull();
      expect(result!.method).toBe("ema");
    });

    it("devrait gérer le symbol en lowercase", async () => {
      mockPrisma.asset.findFirst.mockResolvedValue({
        id: 1,
        symbol: "bitcoin",
      });
      mockPrisma.marketSnapshot.findMany.mockResolvedValue(generateHistoricalDataDesc(10, 97500));

      await generateForecast("BITCOIN");

      expect(mockPrisma.asset.findFirst).toHaveBeenCalledWith({
        where: { symbol: "bitcoin" },
      });
    });

    it("devrait avoir des métriques définies", async () => {
      mockPrisma.asset.findFirst.mockResolvedValue({
        id: 1,
        symbol: "bitcoin",
      });
      mockPrisma.marketSnapshot.findMany.mockResolvedValue(generateHistoricalDataDesc(20, 97500));

      const result = await generateForecast("bitcoin", "ema", 20, 5);

      expect(result).not.toBeNull();
      expect(result!.metrics.lastPrice).toBeDefined();
      expect(result!.metrics.predictedChange).toBeDefined();
      expect(result!.metrics.predictedChangePct).toBeDefined();
    });
  });
});
