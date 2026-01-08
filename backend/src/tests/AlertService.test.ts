import { describe, it, expect, vi, beforeEach } from "vitest";

// Utiliser vi.hoisted() pour les mocks
const mockPrisma = vi.hoisted(() => ({
  alert: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  marketSnapshot: {
    findFirst: vi.fn(),
  },
  notificationLog: {
    create: vi.fn(),
  },
}));

const mockSendAlertNotification = vi.hoisted(() => vi.fn());

vi.mock("../repos/prisma.js", () => ({
  prisma: mockPrisma,
}));

// Corriger le chemin vers NotifierService
vi.mock("../services/NotifierService.js", () => ({
  sendAlertNotification: mockSendAlertNotification,
}));

// Import après les mocks
import {
  evaluateAlerts,
  createAlert,
  deactivateAlert,
  getAlertsByAsset,
  getActiveAlerts,
} from "../services/AlertService.js";

describe("AlertService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendAlertNotification.mockResolvedValue({ success: true });
  });

  describe("evaluateAlerts", () => {
    it("devrait retourner 0 si aucune alerte active", async () => {
      mockPrisma.alert.findMany.mockResolvedValue([]);

      const result = await evaluateAlerts();

      expect(result).toEqual({ evaluated: 0, triggered: 0 });
    });

    it("devrait déclencher une alerte price_above quand le prix dépasse le seuil", async () => {
      const mockAlert = {
        id: 1,
        assetId: 1,
        type: "price_above",
        threshold: 90000,
        isActive: true,
        asset: { name: "Bitcoin", symbol: "bitcoin" },
      };

      mockPrisma.alert.findMany.mockResolvedValue([mockAlert]);
      mockPrisma.marketSnapshot.findFirst.mockResolvedValue({
        assetId: 1,
        priceUsd: 97500,
        change24hPct: 2.5,
      });
      mockPrisma.alert.update.mockResolvedValue({});
      mockPrisma.notificationLog.create.mockResolvedValue({});

      const result = await evaluateAlerts();

      expect(result.evaluated).toBe(1);
      expect(result.triggered).toBe(1);
      expect(mockSendAlertNotification).toHaveBeenCalledWith({
        assetName: "Bitcoin",
        assetSymbol: "bitcoin",
        alertType: "price_above",
        threshold: 90000,
        currentPrice: 97500,
        change24hPct: 2.5,
      });
    });

    it("ne devrait PAS déclencher une alerte price_above si prix < seuil", async () => {
      const mockAlert = {
        id: 1,
        assetId: 1,
        type: "price_above",
        threshold: 100000,
        isActive: true,
        asset: { name: "Bitcoin", symbol: "bitcoin" },
      };

      mockPrisma.alert.findMany.mockResolvedValue([mockAlert]);
      mockPrisma.marketSnapshot.findFirst.mockResolvedValue({
        assetId: 1,
        priceUsd: 97500,
        change24hPct: 2.5,
      });

      const result = await evaluateAlerts();

      expect(result.evaluated).toBe(1);
      expect(result.triggered).toBe(0);
      expect(mockSendAlertNotification).not.toHaveBeenCalled();
    });

    it("devrait déclencher une alerte price_below quand le prix est sous le seuil", async () => {
      const mockAlert = {
        id: 1,
        assetId: 1,
        type: "price_below",
        threshold: 100000,
        isActive: true,
        asset: { name: "Bitcoin", symbol: "bitcoin" },
      };

      mockPrisma.alert.findMany.mockResolvedValue([mockAlert]);
      mockPrisma.marketSnapshot.findFirst.mockResolvedValue({
        assetId: 1,
        priceUsd: 97500,
        change24hPct: 2.5,
      });
      mockPrisma.alert.update.mockResolvedValue({});
      mockPrisma.notificationLog.create.mockResolvedValue({});

      const result = await evaluateAlerts();

      expect(result.triggered).toBe(1);
    });

    it("devrait déclencher une alerte change_above quand la variation dépasse le seuil", async () => {
      const mockAlert = {
        id: 1,
        assetId: 1,
        type: "change_above",
        threshold: 2,
        isActive: true,
        asset: { name: "Bitcoin", symbol: "bitcoin" },
      };

      mockPrisma.alert.findMany.mockResolvedValue([mockAlert]);
      mockPrisma.marketSnapshot.findFirst.mockResolvedValue({
        assetId: 1,
        priceUsd: 97500,
        change24hPct: 5.0,
      });
      mockPrisma.alert.update.mockResolvedValue({});
      mockPrisma.notificationLog.create.mockResolvedValue({});

      const result = await evaluateAlerts();

      expect(result.triggered).toBe(1);
    });

    it("devrait déclencher une alerte change_below quand la variation est sous le seuil", async () => {
      const mockAlert = {
        id: 1,
        assetId: 1,
        type: "change_below",
        threshold: -5,
        isActive: true,
        asset: { name: "Bitcoin", symbol: "bitcoin" },
      };

      mockPrisma.alert.findMany.mockResolvedValue([mockAlert]);
      mockPrisma.marketSnapshot.findFirst.mockResolvedValue({
        assetId: 1,
        priceUsd: 97500,
        change24hPct: -7.5,
      });
      mockPrisma.alert.update.mockResolvedValue({});
      mockPrisma.notificationLog.create.mockResolvedValue({});

      const result = await evaluateAlerts();

      expect(result.triggered).toBe(1);
    });

    it("ne devrait pas déclencher change_above si change24hPct est null", async () => {
      const mockAlert = {
        id: 1,
        assetId: 1,
        type: "change_above",
        threshold: 2,
        isActive: true,
        asset: { name: "Bitcoin", symbol: "bitcoin" },
      };

      mockPrisma.alert.findMany.mockResolvedValue([mockAlert]);
      mockPrisma.marketSnapshot.findFirst.mockResolvedValue({
        assetId: 1,
        priceUsd: 97500,
        change24hPct: null,
      });

      const result = await evaluateAlerts();

      expect(result.triggered).toBe(0);
    });

    it("devrait évaluer plusieurs alertes", async () => {
      const mockAlerts = [
        {
          id: 1,
          assetId: 1,
          type: "price_above",
          threshold: 90000,
          isActive: true,
          asset: { name: "Bitcoin", symbol: "bitcoin" },
        },
        {
          id: 2,
          assetId: 2,
          type: "price_below",
          threshold: 4000,
          isActive: true,
          asset: { name: "Ethereum", symbol: "ethereum" },
        },
      ];

      mockPrisma.alert.findMany.mockResolvedValue(mockAlerts);
      mockPrisma.marketSnapshot.findFirst
        .mockResolvedValueOnce({ assetId: 1, priceUsd: 97500, change24hPct: 2 })
        .mockResolvedValueOnce({ assetId: 2, priceUsd: 3650, change24hPct: 1 });
      mockPrisma.alert.update.mockResolvedValue({});
      mockPrisma.notificationLog.create.mockResolvedValue({});

      const result = await evaluateAlerts();

      expect(result.evaluated).toBe(2);
      expect(result.triggered).toBe(2);
    });
  });

  describe("createAlert", () => {
    it("devrait créer une nouvelle alerte", async () => {
      const mockCreatedAlert = {
        id: 1,
        userId: 1,
        assetId: 2,
        type: "price_above",
        threshold: 100000,
        isActive: true,
        createdAt: new Date(),
        asset: { id: 2, symbol: "btc", name: "Bitcoin" },
      };

      mockPrisma.alert.create.mockResolvedValue(mockCreatedAlert);

      const result = await createAlert(1, 2, "price_above", 100000);

      expect(result).toEqual(mockCreatedAlert);
      expect(mockPrisma.alert.create).toHaveBeenCalledWith({
        data: {
          userId: 1,
          assetId: 2,
          type: "price_above",
          threshold: 100000,
          isActive: true,
        },
        include: { asset: true },
      });
    });
  });

  describe("deactivateAlert", () => {
    it("devrait désactiver une alerte", async () => {
      const mockUpdatedAlert = {
        id: 1,
        isActive: false,
        asset: { symbol: "bitcoin" },
      };

      mockPrisma.alert.update.mockResolvedValue(mockUpdatedAlert);

      const result = await deactivateAlert(1);

      expect(result.isActive).toBe(false);
      expect(mockPrisma.alert.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { isActive: false },
        include: { asset: true },
      });
    });
  });

  describe("getAlertsByAsset", () => {
    it("devrait retourner les alertes d'un asset", async () => {
      const mockAlerts = [
        { id: 1, assetId: 1, type: "price_above", threshold: 100000 },
        { id: 2, assetId: 1, type: "price_below", threshold: 90000 },
      ];

      mockPrisma.alert.findMany.mockResolvedValue(mockAlerts);

      const result = await getAlertsByAsset(1);

      expect(result).toHaveLength(2);
      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith({
        where: { assetId: 1 },
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("getActiveAlerts", () => {
    it("devrait retourner toutes les alertes actives", async () => {
      const mockAlerts = [
        { id: 1, isActive: true, asset: { name: "Bitcoin" } },
        { id: 2, isActive: true, asset: { name: "Ethereum" } },
      ];

      mockPrisma.alert.findMany.mockResolvedValue(mockAlerts);

      const result = await getActiveAlerts();

      expect(result).toHaveLength(2);
      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: { asset: true },
        orderBy: { createdAt: "desc" },
      });
    });
  });
});
