import { Router } from "express";
import { AssetService } from "../services/AssetService.js";

const router = Router();

/**
 * GET /assets
 * Liste tous les assets (cryptomonnaies) disponibles
 */
router.get("/", async (_req, res) => {
  const assets = await AssetService.getAll();
  res.set("Cache-Control", "public, max-age=10");
  res.json({ data: assets });
});

export default router;
