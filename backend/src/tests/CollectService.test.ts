import { describe, it, expect, vi, beforeEach } from "vitest";
// CollectService module is mocked below

describe("CollectService", () => {
  const mockPrisma = {
    collectRun: {
      create: vi.fn(),
      update: vi.fn(),
    },
    asset: {
      upsert: vi.fn(),
    },
    marketSnapshot: {
      create: vi.fn(),
    },
    alert: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
  const mockEnv = { coins: ["bitcoin"], provider: "mock", useMockFallback: false };
  const mockFetchFromMock = vi.fn().mockResolvedValue([
    {
      providerId: "bitcoin",
      source: "mock",
      symbol: "bitcoin",
      name: "Bitcoin",
      priceUsd: 100,
      volume24hUsd: 1000,
      marketCapUsd: 10000,
      change24hPct: 1.5,
    },
  ]);
  const mockEvaluateAlerts = vi.fn().mockResolvedValue({ evaluated: 1, triggered: 1 });

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doMock("../repos/prisma.js", () => ({ prisma: mockPrisma }));
    vi.doMock("../config/env.js", () => ({ env: mockEnv }));
    vi.doMock("../providers/MockProvider.js", () => ({ fetchFromMock: mockFetchFromMock }));
    vi.doMock("./AlertService.js", () => ({ evaluateAlerts: mockEvaluateAlerts }));
  });

  it("runOnce insère les données et met à jour le run", async () => {
    mockPrisma.collectRun.create.mockResolvedValue({ id: 1 });
    mockPrisma.collectRun.update.mockResolvedValue({});
    mockPrisma.asset.upsert.mockResolvedValue({ id: 1 });
    mockPrisma.marketSnapshot.create.mockResolvedValue({});

    const { runOnce } = await import("../services/CollectService.js");
    const res = await runOnce();
    expect(res.inserted).toBe(1);
    expect(res.total).toBe(1);
    expect(res.alerts.evaluated).toBe(0);
    expect(mockPrisma.collectRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 } })
    );
  });

  it("runOnce gère les erreurs et met à jour le run en fail", async () => {
    mockPrisma.collectRun.create.mockResolvedValue({ id: 2 });
    mockPrisma.collectRun.update.mockResolvedValue({});
    mockFetchFromMock.mockRejectedValueOnce(new Error("fail fetch"));

    const { runOnce } = await import("../services/CollectService.js");
    await expect(runOnce()).rejects.toThrow("fail fetch");
    expect(mockPrisma.collectRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 2 },
        data: expect.objectContaining({ status: "fail" }),
      })
    );
  });
});
