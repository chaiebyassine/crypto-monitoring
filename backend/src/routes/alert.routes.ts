import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import { AssetService } from "../services/AssetService.js";
import {
  createAlert,
  getAlertById,
  getUserAlerts,
  activateAlert,
  deactivateAlert,
  deleteAlert,
  type AlertType,
} from "../services/AlertService.js";

const router = Router();

// Tous les endpoints alerts nécessitent une authentification
router.use(authenticate);

/**
 * GET /alerts
 * Liste les alertes de l'utilisateur connecté
 */
router.get("/", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const assetId = req.query.assetId ? Number(req.query.assetId) : undefined;
    const activeOnly = req.query.active === "true";

    const alerts = await getUserAlerts(userId, { assetId, activeOnly });
    res.json({ data: alerts });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /alerts/:id
 * Récupère une alerte par ID
 */
router.get("/:id", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Invalid alert ID" });
    }

    const alert = await getAlertById(id);
    if (!alert || alert.userId !== userId) {
      return res.status(404).json({ error: "Alert not found" });
    }

    res.json({ data: alert });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /alerts
 * Crée une nouvelle alerte
 */
router.post("/", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { assetId, type, threshold } = req.body;

    if (!Number.isFinite(assetId)) {
      return res.status(400).json({ error: "assetId must be a number" });
    }

    const validTypes: AlertType[] = ["price_above", "price_below", "change_above", "change_below"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${validTypes.join(", ")}` });
    }

    if (!Number.isFinite(threshold)) {
      return res.status(400).json({ error: "threshold must be a number" });
    }

    const asset = await AssetService.getById(assetId);
    if (!asset) {
      return res.status(404).json({ error: "Asset not found" });
    }

    const alert = await createAlert(userId, assetId, type, threshold);
    res.status(201).json({ data: alert });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: message });
  }
});

/**
 * PATCH /alerts/:id/activate
 * Active une alerte
 */
router.patch("/:id/activate", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Invalid alert ID" });
    }

    const existing = await getAlertById(id);
    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ error: "Alert not found" });
    }

    const alert = await activateAlert(id);
    res.json({ data: alert });
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Alert not found" });
    }
    res.status(500).json({ error: err.message ?? String(e) });
  }
});

/**
 * PATCH /alerts/:id/deactivate
 * Désactive une alerte
 */
router.patch("/:id/deactivate", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Invalid alert ID" });
    }

    const existing = await getAlertById(id);
    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ error: "Alert not found" });
    }

    const alert = await deactivateAlert(id);
    res.json({ data: alert });
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Alert not found" });
    }
    res.status(500).json({ error: err.message ?? String(e) });
  }
});

/**
 * DELETE /alerts/:id
 * Supprime une alerte
 */
router.delete("/:id", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Invalid alert ID" });
    }

    const existing = await getAlertById(id);
    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ error: "Alert not found" });
    }

    await deleteAlert(id);
    res.json({ ok: true, message: "Alert deleted" });
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Alert not found" });
    }
    res.status(500).json({ error: err.message ?? String(e) });
  }
});

export default router;
