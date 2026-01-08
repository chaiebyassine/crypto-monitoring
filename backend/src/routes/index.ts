import { Router } from "express";
import authRoutes from "./auth.routes.js";
import adminRoutes from "./admin.routes.js";
import assetRoutes from "./asset.routes.js";
import priceRoutes from "./price.routes.js";
import alertRoutes from "./alert.routes.js";
import portfolioRoutes from "./portfolio.routes.js";
import forecastRoutes from "./forecast.routes.js";
import healthRoutes from "./health.routes.js";

const router = Router();

// Health & Metrics (/, /health, /metrics, /collect)
router.use("/", healthRoutes);

// Auth routes (/auth/*)
router.use("/auth", authRoutes);

// Admin routes (/admin/*)
router.use("/admin", adminRoutes);

// Asset routes (/assets)
router.use("/assets", assetRoutes);

// Price routes (/prices, /prices/ohlc, /changes)
router.use("/prices", priceRoutes);
router.use("/", priceRoutes); // Pour /changes

// Alert routes (/alerts/*)
router.use("/alerts", alertRoutes);

// Portfolio routes (/portfolios/*)
router.use("/portfolios", portfolioRoutes);

// Forecast routes (/forecast)
router.use("/forecast", forecastRoutes);

export default router;
