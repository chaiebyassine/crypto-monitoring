import { Router } from "express";
import { AssetService } from "../services/AssetService.js";

const router = Router();

router.get("/", async (_req, res) => {
  const assets = await AssetService.getAll();
  res.set("Cache-Control", "public, max-age=10");
  res.json({ data: assets });
});

export default router;
