import { describe, it, expect, beforeAll, afterAll as _afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";

// Mock Prisma avant d'importer le serveur
const mockPrisma = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  asset: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  marketSnapshot: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  alert: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  notificationLog: {
    deleteMany: vi.fn(),
  },
  portfolio: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  position: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  trade: {
    findMany: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock("../repos/prisma.js", () => ({
  prisma: mockPrisma,
}));

// Mock AuthService pour les tests
const mockAuthService = vi.hoisted(() => ({
  register: vi.fn(),
  login: vi.fn(),
  getUserById: vi.fn(),
  updatePassword: vi.fn(),
  verifyToken: vi.fn(),
}));

vi.mock("../services/AuthService.js", () => ({
  AuthService: mockAuthService,
}));

// Mock CollectService
vi.mock("../services/CollectService.js", () => ({
  runOnce: vi.fn().mockResolvedValue({ collected: 3 }),
}));

// Mock ForecastService
const mockGenerateForecast = vi.hoisted(() => vi.fn());
vi.mock("../services/ForecastService.js", () => ({
  generateForecast: mockGenerateForecast,
}));

// Mock PortfolioService
const mockPortfolioService = vi.hoisted(() => ({
  createPortfolio: vi.fn(),
  getPortfolios: vi.fn(),
  getPortfolio: vi.fn(),
  executeTrade: vi.fn(),
  getPortfolioPnL: vi.fn(),
  getTradeHistory: vi.fn(),
}));

vi.mock("../services/PortfolioService.js", () => mockPortfolioService);

// Import après les mocks
import { createServer } from "../api/server.js";

describe("API Integration Tests", () => {
  let app: Express;
  const validToken = "valid-test-token";
  const testUser = { userId: 1, email: "test@example.com", role: "USER" };

  beforeAll(() => {
    app = createServer();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default mock pour authenticate middleware
    mockAuthService.verifyToken.mockImplementation((token: string) => {
      if (token === validToken) {
        return testUser;
      }
      throw new Error("Token invalide");
    });
  });

  // ==================== ENDPOINTS PUBLICS ====================

  describe("Public Endpoints", () => {
    describe("GET /", () => {
      it("devrait retourner un message de bienvenue", async () => {
        const res = await request(app).get("/");
        expect(res.status).toBe(200);
        expect(res.text).toContain("Backend OK");
      });
    });

    describe("GET /health", () => {
      it("devrait retourner ok si la DB est connectée", async () => {
        mockPrisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

        const res = await request(app).get("/health");

        expect(res.status).toBe(200);
        expect(res.body.status).toBe("healthy");
        expect(res.body).toHaveProperty("timestamp");
        expect(res.body).toHaveProperty("uptime");
      });

      it("devrait retourner error si la DB est déconnectée", async () => {
        mockPrisma.$queryRaw.mockRejectedValue(new Error("DB error"));

        const res = await request(app).get("/health");

        expect(res.status).toBe(503);
        expect(res.body.status).toBe("unhealthy");
        expect(res.body.error).toBe("Database connection failed");
      });
    });

    describe("GET /assets", () => {
      it("devrait retourner la liste des assets", async () => {
        mockPrisma.asset.findMany.mockResolvedValue([
          { id: 1, symbol: "bitcoin", name: "Bitcoin" },
          { id: 2, symbol: "ethereum", name: "Ethereum" },
        ]);

        const res = await request(app).get("/assets");

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(2);
        expect(res.body.data[0].symbol).toBe("bitcoin");
      });
    });

    describe("GET /changes", () => {
      it("devrait retourner les changements de prix", async () => {
        mockPrisma.asset.findMany.mockResolvedValue([
          { id: 1, symbol: "bitcoin", name: "Bitcoin" },
        ]);
        mockPrisma.marketSnapshot.findFirst.mockResolvedValue({
          priceUsd: 97500,
          change24hPct: 2.5,
        });

        const res = await request(app).get("/changes");

        expect(res.status).toBe(200);
        expect(res.body.data[0]).toEqual({
          symbol: "bitcoin",
          name: "Bitcoin",
          last: 97500,
          change24hPct: 2.5,
        });
      });
    });

    describe("GET /prices", () => {
      it("devrait retourner 400 si symbol manquant", async () => {
        const res = await request(app).get("/prices");
        expect(res.status).toBe(400);
        expect(res.body.error).toBe("symbol required");
      });

      it("devrait retourner les prix pour un symbol valide", async () => {
        mockPrisma.asset.findFirst.mockResolvedValue({ id: 1, symbol: "bitcoin" });
        mockPrisma.marketSnapshot.findMany.mockResolvedValue([
          {
            ingestedAt: new Date("2025-12-25T10:00:00Z"),
            priceUsd: 97500,
            volume24hUsd: 45000000000,
            marketCapUsd: 1920000000000,
            change24hPct: 2.5,
          },
        ]);

        const res = await request(app).get("/prices?symbol=bitcoin");

        expect(res.status).toBe(200);
        expect(res.body.symbol).toBe("bitcoin");
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].priceUsd).toBe(97500);
      });

      it("devrait retourner tableau vide pour un symbol inconnu", async () => {
        mockPrisma.asset.findFirst.mockResolvedValue(null);

        const res = await request(app).get("/prices?symbol=unknown");

        expect(res.status).toBe(200);
        expect(res.body.data).toEqual([]);
      });
    });

    describe("GET /prices/ohlc", () => {
      it("devrait retourner 400 si symbol manquant", async () => {
        const res = await request(app).get("/prices/ohlc");
        expect(res.status).toBe(400);
      });

      it("devrait retourner les données OHLC", async () => {
        mockPrisma.asset.findFirst.mockResolvedValue({ id: 1, symbol: "bitcoin" });
        mockPrisma.marketSnapshot.findMany.mockResolvedValue([
          { ingestedAt: new Date("2025-12-25T10:00:00Z"), priceUsd: 97000 },
          { ingestedAt: new Date("2025-12-25T10:05:00Z"), priceUsd: 97500 },
          { ingestedAt: new Date("2025-12-25T10:10:00Z"), priceUsd: 97200 },
        ]);

        const res = await request(app).get("/prices/ohlc?symbol=bitcoin&granularity=1h");

        expect(res.status).toBe(200);
        expect(res.body.symbol).toBe("bitcoin");
        expect(res.body.granularity).toBe("1h");
      });
    });

    describe("POST /collect", () => {
      it("devrait déclencher la collecte", async () => {
        const res = await request(app).post("/collect");

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
      });
    });

    describe("GET /forecast", () => {
      it("devrait retourner 400 si symbol manquant", async () => {
        const res = await request(app).get("/forecast");
        expect(res.status).toBe(400);
        expect(res.body.error).toBe("symbol is required");
      });

      it("devrait retourner 400 pour méthode invalide", async () => {
        const res = await request(app).get("/forecast?symbol=bitcoin&method=invalid");
        expect(res.status).toBe(400);
      });

      it("devrait retourner une prévision valide", async () => {
        mockGenerateForecast.mockResolvedValue({
          symbol: "bitcoin",
          method: "ema",
          historical: [],
          predicted: [],
          metrics: { lastPrice: 97500, predictedChange: 100, predictedChangePct: 0.1 },
        });

        const res = await request(app).get("/forecast?symbol=bitcoin&method=ema");

        expect(res.status).toBe(200);
        expect(res.body.data.symbol).toBe("bitcoin");
      });

      it("devrait retourner 404 si asset non trouvé", async () => {
        mockGenerateForecast.mockResolvedValue(null);

        const res = await request(app).get("/forecast?symbol=unknown");

        expect(res.status).toBe(404);
      });
    });
  });

  // ==================== ENDPOINTS AUTHENTIFICATION ====================

  describe("Auth Endpoints", () => {
    describe("POST /auth/register", () => {
      it("devrait créer un nouvel utilisateur", async () => {
        mockAuthService.register.mockResolvedValue({
          user: { id: 1, email: "new@example.com", name: "New User" },
          token: "new-token",
        });

        const res = await request(app)
          .post("/auth/register")
          .send({ email: "new@example.com", password: "password123", name: "New User" });

        expect(res.status).toBe(201);
        expect(res.body.data.user.email).toBe("new@example.com");
        expect(res.body.data.token).toBe("new-token");
      });

      it("devrait retourner 400 si email manquant", async () => {
        const res = await request(app).post("/auth/register").send({ password: "password123" });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Email requis");
      });

      it("devrait retourner 400 si mot de passe trop court", async () => {
        const res = await request(app)
          .post("/auth/register")
          .send({ email: "test@example.com", password: "123" });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain("min 6 caractères");
      });

      it("devrait retourner 409 si email existe déjà", async () => {
        mockAuthService.register.mockRejectedValue(new Error("Email existe déjà"));

        const res = await request(app)
          .post("/auth/register")
          .send({ email: "existing@example.com", password: "password123" });

        expect(res.status).toBe(409);
      });
    });

    describe("POST /auth/login", () => {
      it("devrait connecter un utilisateur valide", async () => {
        mockAuthService.login.mockResolvedValue({
          user: { id: 1, email: "test@example.com" },
          token: "login-token",
        });

        const res = await request(app)
          .post("/auth/login")
          .send({ email: "test@example.com", password: "password123" });

        expect(res.status).toBe(200);
        expect(res.body.data.token).toBe("login-token");
      });

      it("devrait retourner 401 pour credentials invalides", async () => {
        mockAuthService.login.mockRejectedValue(new Error("Mot de passe incorrect"));

        const res = await request(app)
          .post("/auth/login")
          .send({ email: "test@example.com", password: "wrong" });

        expect(res.status).toBe(401);
      });

      it("devrait retourner 400 si email manquant", async () => {
        const res = await request(app).post("/auth/login").send({ password: "password123" });

        expect(res.status).toBe(400);
      });
    });

    describe("GET /auth/me", () => {
      it("devrait retourner 401 sans token", async () => {
        const res = await request(app).get("/auth/me");
        expect(res.status).toBe(401);
      });

      it("devrait retourner l'utilisateur connecté", async () => {
        mockAuthService.getUserById.mockResolvedValue({
          id: 1,
          email: "test@example.com",
          name: "Test User",
        });

        const res = await request(app).get("/auth/me").set("Authorization", `Bearer ${validToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.email).toBe("test@example.com");
      });
    });

    describe("PATCH /auth/password", () => {
      it("devrait mettre à jour le mot de passe", async () => {
        mockAuthService.updatePassword.mockResolvedValue(undefined);

        const res = await request(app)
          .patch("/auth/password")
          .set("Authorization", `Bearer ${validToken}`)
          .send({ currentPassword: "oldpass", newPassword: "newpass123" });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
      });

      it("devrait retourner 400 si nouveau mot de passe trop court", async () => {
        const res = await request(app)
          .patch("/auth/password")
          .set("Authorization", `Bearer ${validToken}`)
          .send({ currentPassword: "oldpass", newPassword: "123" });

        expect(res.status).toBe(400);
      });
    });
  });

  // ==================== ENDPOINTS ALERTES ====================

  describe("Alerts Endpoints", () => {
    describe("GET /alerts", () => {
      it("devrait retourner 401 sans authentification", async () => {
        const res = await request(app).get("/alerts");
        expect(res.status).toBe(401);
      });

      it("devrait retourner les alertes de l'utilisateur", async () => {
        mockPrisma.alert.findMany.mockResolvedValue([
          { id: 1, assetId: 1, type: "price_above", threshold: 100000, isActive: true },
        ]);

        const res = await request(app).get("/alerts").set("Authorization", `Bearer ${validToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
      });
    });

    describe("POST /alerts", () => {
      it("devrait créer une nouvelle alerte", async () => {
        mockPrisma.asset.findUnique.mockResolvedValue({ id: 1, symbol: "bitcoin" });
        mockPrisma.alert.create.mockResolvedValue({
          id: 1,
          assetId: 1,
          type: "price_above",
          threshold: 100000,
          isActive: true,
          asset: { symbol: "bitcoin" },
        });

        const res = await request(app)
          .post("/alerts")
          .set("Authorization", `Bearer ${validToken}`)
          .send({ assetId: 1, type: "price_above", threshold: 100000 });

        expect(res.status).toBe(201);
        expect(res.body.data.type).toBe("price_above");
      });

      it("devrait retourner 400 pour type invalide", async () => {
        const res = await request(app)
          .post("/alerts")
          .set("Authorization", `Bearer ${validToken}`)
          .send({ assetId: 1, type: "invalid_type", threshold: 100000 });

        expect(res.status).toBe(400);
      });

      it("devrait retourner 404 si asset non trouvé", async () => {
        mockPrisma.asset.findUnique.mockResolvedValue(null);

        const res = await request(app)
          .post("/alerts")
          .set("Authorization", `Bearer ${validToken}`)
          .send({ assetId: 999, type: "price_above", threshold: 100000 });

        expect(res.status).toBe(404);
      });
    });

    describe("GET /alerts/:id", () => {
      it("devrait retourner une alerte par ID", async () => {
        mockPrisma.alert.findUnique.mockResolvedValue({
          id: 1,
          userId: 1,
          assetId: 1,
          type: "price_above",
          threshold: 100000,
          asset: { symbol: "bitcoin" },
          notifications: [],
        });

        const res = await request(app)
          .get("/alerts/1")
          .set("Authorization", `Bearer ${validToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe(1);
      });

      it("devrait retourner 404 pour alerte non trouvée", async () => {
        mockPrisma.alert.findUnique.mockResolvedValue(null);

        const res = await request(app)
          .get("/alerts/999")
          .set("Authorization", `Bearer ${validToken}`);

        expect(res.status).toBe(404);
      });
    });

    describe("PATCH /alerts/:id/deactivate", () => {
      it("devrait désactiver une alerte", async () => {
        mockPrisma.alert.findUnique.mockResolvedValue({ id: 1, userId: 1, isActive: true });
        mockPrisma.alert.update.mockResolvedValue({
          id: 1,
          isActive: false,
          asset: { symbol: "bitcoin" },
        });

        const res = await request(app)
          .patch("/alerts/1/deactivate")
          .set("Authorization", `Bearer ${validToken}`);

        expect(res.status).toBe(200);
      });
    });

    describe("DELETE /alerts/:id", () => {
      it("devrait supprimer une alerte", async () => {
        mockPrisma.alert.findUnique.mockResolvedValue({ id: 1, userId: 1 });
        mockPrisma.notificationLog.deleteMany.mockResolvedValue({ count: 0 });
        mockPrisma.alert.delete.mockResolvedValue({ id: 1 });

        const res = await request(app)
          .delete("/alerts/1")
          .set("Authorization", `Bearer ${validToken}`);

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
      });

      it("devrait retourner 404 pour alerte d'un autre utilisateur", async () => {
        mockPrisma.alert.findUnique.mockResolvedValue({ id: 1, userId: 999 });

        const res = await request(app)
          .delete("/alerts/1")
          .set("Authorization", `Bearer ${validToken}`);

        expect(res.status).toBe(404);
      });
    });
  });

  // ==================== ENDPOINTS PORTFOLIOS ====================

  describe("Portfolios Endpoints", () => {
    describe("GET /portfolios", () => {
      it("devrait retourner 401 sans authentification", async () => {
        const res = await request(app).get("/portfolios");
        expect(res.status).toBe(401);
      });

      it("devrait retourner les portfolios de l'utilisateur", async () => {
        mockPrisma.portfolio.findMany.mockResolvedValue([
          { id: 1, name: "Mon Portfolio", userId: 1 },
        ]);

        const res = await request(app)
          .get("/portfolios")
          .set("Authorization", `Bearer ${validToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
      });
    });

    describe("POST /portfolios", () => {
      it("devrait créer un nouveau portfolio", async () => {
        mockPrisma.portfolio.create.mockResolvedValue({
          id: 1,
          name: "Nouveau Portfolio",
          userId: 1,
        });

        const res = await request(app)
          .post("/portfolios")
          .set("Authorization", `Bearer ${validToken}`)
          .send({ name: "Nouveau Portfolio" });

        expect(res.status).toBe(201);
        expect(res.body.data.name).toBe("Nouveau Portfolio");
      });

      it("devrait retourner 400 si nom manquant", async () => {
        const res = await request(app)
          .post("/portfolios")
          .set("Authorization", `Bearer ${validToken}`)
          .send({});

        expect(res.status).toBe(400);
      });
    });

    describe("GET /portfolios/:id", () => {
      it("devrait retourner un portfolio par ID", async () => {
        mockPrisma.portfolio.findUnique.mockResolvedValue({
          id: 1,
          name: "Mon Portfolio",
          userId: 1,
          positions: [],
        });

        const res = await request(app)
          .get("/portfolios/1")
          .set("Authorization", `Bearer ${validToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe(1);
      });

      it("devrait retourner 404 pour portfolio non trouvé", async () => {
        mockPrisma.portfolio.findUnique.mockResolvedValue(null);

        const res = await request(app)
          .get("/portfolios/999")
          .set("Authorization", `Bearer ${validToken}`);

        expect(res.status).toBe(404);
      });
    });

    describe("DELETE /portfolios/:id", () => {
      it("devrait supprimer un portfolio", async () => {
        mockPrisma.portfolio.findUnique.mockResolvedValue({ id: 1, userId: 1 });
        mockPrisma.trade.deleteMany.mockResolvedValue({ count: 0 });
        mockPrisma.position.deleteMany.mockResolvedValue({ count: 0 });
        mockPrisma.portfolio.delete.mockResolvedValue({ id: 1 });

        const res = await request(app)
          .delete("/portfolios/1")
          .set("Authorization", `Bearer ${validToken}`);

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
      });
    });

    describe("GET /portfolios/:id/pnl", () => {
      it("devrait retourner le PnL du portfolio", async () => {
        mockPrisma.portfolio.findUnique.mockResolvedValue({ id: 1, userId: 1 });
        mockPortfolioService.getPortfolioPnL.mockResolvedValue({
          totalValue: 10000,
          totalCost: 9000,
          totalPnL: 1000,
          totalPnLPct: 11.11,
        });

        const res = await request(app)
          .get("/portfolios/1/pnl")
          .set("Authorization", `Bearer ${validToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.totalPnL).toBe(1000);
      });
    });

    describe("GET /portfolios/:id/positions", () => {
      it("devrait retourner les positions du portfolio", async () => {
        mockPrisma.portfolio.findUnique.mockResolvedValue({ id: 1, userId: 1 });
        mockPrisma.position.findMany.mockResolvedValue([
          { id: 1, assetId: 1, quantity: 0.5, avgCost: 97000, asset: { symbol: "bitcoin" } },
        ]);

        const res = await request(app)
          .get("/portfolios/1/positions")
          .set("Authorization", `Bearer ${validToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
      });
    });

    describe("GET /portfolios/:id/trades", () => {
      it("devrait retourner l'historique des trades", async () => {
        mockPrisma.portfolio.findUnique.mockResolvedValue({ id: 1, userId: 1 });
        mockPortfolioService.getTradeHistory.mockResolvedValue([
          { id: 1, side: "buy", quantity: 0.5, priceUsd: 97000 },
        ]);

        const res = await request(app)
          .get("/portfolios/1/trades")
          .set("Authorization", `Bearer ${validToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
      });
    });

    describe("POST /portfolios/:id/trades", () => {
      it("devrait exécuter un trade", async () => {
        mockPrisma.portfolio.findUnique.mockResolvedValue({ id: 1, userId: 1 });
        mockPortfolioService.executeTrade.mockResolvedValue({
          trade: { id: 1, side: "buy", quantity: 0.5, priceUsd: 97000 },
          position: { quantity: 0.5 },
        });

        const res = await request(app)
          .post("/portfolios/1/trades")
          .set("Authorization", `Bearer ${validToken}`)
          .send({ assetId: 1, side: "buy", quantity: 0.5, priceUsd: 97000 });

        expect(res.status).toBe(201);
      });

      it("devrait retourner 400 pour side invalide", async () => {
        mockPrisma.portfolio.findUnique.mockResolvedValue({ id: 1, userId: 1 });

        const res = await request(app)
          .post("/portfolios/1/trades")
          .set("Authorization", `Bearer ${validToken}`)
          .send({ assetId: 1, side: "invalid", quantity: 0.5, priceUsd: 97000 });

        expect(res.status).toBe(400);
      });

      it("devrait retourner 400 pour quantité négative", async () => {
        mockPrisma.portfolio.findUnique.mockResolvedValue({ id: 1, userId: 1 });

        const res = await request(app)
          .post("/portfolios/1/trades")
          .set("Authorization", `Bearer ${validToken}`)
          .send({ assetId: 1, side: "buy", quantity: -1, priceUsd: 97000 });

        expect(res.status).toBe(400);
      });

      it("devrait retourner 400 pour position insuffisante (sell)", async () => {
        mockPrisma.portfolio.findUnique.mockResolvedValue({ id: 1, userId: 1 });
        mockPortfolioService.executeTrade.mockRejectedValue(new Error("Insufficient position"));

        const res = await request(app)
          .post("/portfolios/1/trades")
          .set("Authorization", `Bearer ${validToken}`)
          .send({ assetId: 1, side: "sell", quantity: 100, priceUsd: 97000 });

        expect(res.status).toBe(400);
      });
    });
  });
});
