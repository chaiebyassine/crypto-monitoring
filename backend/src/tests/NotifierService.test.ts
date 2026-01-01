import { describe, it, expect, vi, beforeEach } from "vitest";

describe("NotifierService", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("sendDiscordNotification retourne success si pas de webhook", async () => {
    vi.doMock("../config/env.js", () => ({ env: { discordWebhookUrl: undefined } }));
    const { sendDiscordNotification } = await import("../services/NotifierService.js");
    const res = await sendDiscordNotification({ content: "test" });
    expect(res.success).toBe(false);
    expect(res.errorMsg).toMatch(/not configured/);
  });

  it("sendDiscordNotification gère fetch ok", async () => {
    vi.doMock("../config/env.js", () => ({ env: { discordWebhookUrl: "http://fake" } }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 204 }));
    const { sendDiscordNotification } = await import("../services/NotifierService.js");
    const res = await sendDiscordNotification({ content: "ok" });
    expect(res.success).toBe(true);
  });

  it("sendDiscordNotification gère fetch erreur HTTP", async () => {
    vi.doMock("../config/env.js", () => ({ env: { discordWebhookUrl: "http://fake" } }));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => "bad req" })
    );
    const { sendDiscordNotification } = await import("../services/NotifierService.js");
    const res = await sendDiscordNotification({ content: "fail" });
    expect(res.success).toBe(false);
    expect(res.errorMsg).toMatch(/HTTP 400/);
  });

  it("sendDiscordNotification gère fetch throw", async () => {
    vi.doMock("../config/env.js", () => ({ env: { discordWebhookUrl: "http://fake" } }));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("fail fetch")));
    const { sendDiscordNotification } = await import("../services/NotifierService.js");
    const res = await sendDiscordNotification({ content: "fail" });
    expect(res.success).toBe(false);
    expect(res.errorMsg).toMatch(/fail fetch/);
  });

  it("sendAlertNotification construit le message Discord", async () => {
    vi.doMock("../config/env.js", () => ({ env: { discordWebhookUrl: "http://fake" } }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 204 }));
    const { sendAlertNotification } = await import("../services/NotifierService.js");
    const res = await sendAlertNotification({
      assetName: "Bitcoin",
      assetSymbol: "BTC",
      alertType: "price_above",
      threshold: 10000,
      currentPrice: 12000,
      change24hPct: 2.5,
    });
    expect(res.success).toBe(true);
  });
});
