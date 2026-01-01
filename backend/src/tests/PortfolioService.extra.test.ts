import { describe, it, expect, vi, beforeEach } from "vitest";
import * as PortfolioService from "../services/PortfolioService.js";

describe("PortfolioService (extra coverage)", () => {
  const mockPrisma = {
    portfolio: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
    },
    asset: {
      findUnique: vi.fn(),
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
    marketSnapshot: {
      findFirst: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doMock("../repos/prisma.js", () => ({ prisma: mockPrisma }));
  });

  it("executeTrade throw si portfolio non trouvé", async () => {
    mockPrisma.portfolio.findUnique.mockResolvedValue(null);
    const { executeTrade } = await import("../services/PortfolioService.js");
    await expect(
      executeTrade({ portfolioId: 1, assetId: 1, side: "buy", quantity: 1, priceUsd: 100 })
    ).rejects.toThrow("Portfolio not found");
  });

  it("executeTrade throw si asset non trouvé", async () => {
    mockPrisma.portfolio.findUnique.mockResolvedValue({ id: 1 });
    mockPrisma.asset.findUnique.mockResolvedValue(null);
    const { executeTrade } = await import("../services/PortfolioService.js");
    await expect(
      executeTrade({ portfolioId: 1, assetId: 1, side: "buy", quantity: 1, priceUsd: 100 })
    ).rejects.toThrow("Asset not found");
  });

  it("executeTrade throw si quantité négative", async () => {
    const { executeTrade } = await import("../services/PortfolioService.js");
    await expect(
      executeTrade({ portfolioId: 1, assetId: 1, side: "buy", quantity: -1, priceUsd: 100 })
    ).rejects.toThrow("Quantity must be positive");
  });

  it("executeTrade throw si prix négatif", async () => {
    const { executeTrade } = await import("../services/PortfolioService.js");
    await expect(
      executeTrade({ portfolioId: 1, assetId: 1, side: "buy", quantity: 1, priceUsd: -100 })
    ).rejects.toThrow("Price must be positive");
  });

  it("getPortfolio retourne null si id inconnu", async () => {
    mockPrisma.portfolio.findUnique.mockResolvedValue(null);
    const { getPortfolio } = await import("../services/PortfolioService.js");
    const res = await getPortfolio(999);
    expect(res).toBeNull();
  });

  it("getPortfolios retourne un tableau", async () => {
    mockPrisma.portfolio.findMany.mockResolvedValue([{ id: 1, name: "Test" }]);
    const { getPortfolios } = await import("../services/PortfolioService.js");
    const res = await getPortfolios();
    expect(Array.isArray(res)).toBe(true);
  });
});
