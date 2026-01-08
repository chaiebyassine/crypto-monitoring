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

router.use("/", healthRoutes);

router.use("/auth", authRoutes);

router.use("/admin", adminRoutes);

router.use("/assets", assetRoutes);

router.use("/prices", priceRoutes);
router.use("/", priceRoutes);

router.use("/alerts", alertRoutes);

router.use("/portfolios", portfolioRoutes);

router.use("/forecast", forecastRoutes);

export default router;
