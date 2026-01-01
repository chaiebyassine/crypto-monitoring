import { describe, it, expect, vi, beforeEach } from "vitest";

// Utiliser vi.hoisted() pour les mocks
const mockPrisma = vi.hoisted(() => ({
  portfolio: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  position: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  trade: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  asset: {
    findUnique: vi.fn(),
  },
  marketSnapshot: {
    findFirst: vi.fn(),
  },
}));

vi.mock("../repos/prisma.js", () => ({
  prisma: mockPrisma,
}));

// Import après les mocks
import {
  createPortfolio,
  getPortfolios,
  getPortfolio,
  getTradeHistory,
} from "../services/PortfolioService.js";

describe("PortfolioService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createPortfolio", () => {
    it("devrait créer un nouveau portfolio", async () => {
      const mockPortfolio = {
        id: 1,
        name: "Mon Portfolio",
        userId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.portfolio.create.mockResolvedValue(mockPortfolio);

      const result = await createPortfolio("Mon Portfolio");

      expect(result.name).toBe("Mon Portfolio");
      expect(mockPrisma.portfolio.create).toHaveBeenCalledWith({
        data: { name: "Mon Portfolio" },
      });
    });
  });

  describe("getPortfolios", () => {
    it("devrait retourner tous les portfolios", async () => {
      const mockPortfolios = [
        { id: 1, name: "Portfolio 1" },
        { id: 2, name: "Portfolio 2" },
      ];

      mockPrisma.portfolio.findMany.mockResolvedValue(mockPortfolios);

      const result = await getPortfolios();

      expect(result).toHaveLength(2);
      expect(mockPrisma.portfolio.findMany).toHaveBeenCalled();
    });
  });

  describe("getPortfolio", () => {
    it("devrait retourner un portfolio par ID avec positions et trades", async () => {
      const mockPortfolio = {
        id: 1,
        name: "Mon Portfolio",
        positions: [
          { id: 1, assetId: 1, quantity: 0.5, avgCost: 97000, asset: { symbol: "bitcoin" } },
        ],
        trades: [{ id: 1, side: "buy", quantity: 0.5 }],
      };

      mockPrisma.portfolio.findUnique.mockResolvedValue(mockPortfolio);

      const result = await getPortfolio(1);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(1);
      expect(result!.name).toBe("Mon Portfolio");
      expect(result!.positions).toHaveLength(1);
      expect(mockPrisma.portfolio.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: expect.objectContaining({
          positions: expect.any(Object),
          trades: expect.any(Object),
        }),
      });
    });

    it("devrait retourner null si portfolio n'existe pas", async () => {
      mockPrisma.portfolio.findUnique.mockResolvedValue(null);

      const result = await getPortfolio(999);

      expect(result).toBeNull();
    });
  });

  describe("getTradeHistory", () => {
    it("devrait retourner l'historique des trades", async () => {
      const mockTrades = [
        {
          id: 1,
          side: "buy",
          quantity: 1,
          priceUsd: 95000,
          executedAt: new Date(),
          asset: { symbol: "bitcoin" },
        },
        {
          id: 2,
          side: "sell",
          quantity: 0.5,
          priceUsd: 100000,
          executedAt: new Date(),
          asset: { symbol: "bitcoin" },
        },
      ];

      mockPrisma.trade.findMany.mockResolvedValue(mockTrades);

      const result = await getTradeHistory(1);

      expect(result).toHaveLength(2);
      expect(result[0].side).toBe("buy");
      expect(result[1].side).toBe("sell");
    });

    it("devrait limiter le nombre de trades retournés", async () => {
      mockPrisma.trade.findMany.mockResolvedValue([]);

      await getTradeHistory(1, 10);

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        })
      );
    });

    it("devrait trier les trades par date d'exécution décroissante", async () => {
      mockPrisma.trade.findMany.mockResolvedValue([]);

      await getTradeHistory(1);

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { executedAt: "desc" },
        })
      );
    });
  });
});
