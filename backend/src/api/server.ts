import express from "express";
import cors from "cors";
import { metricsMiddleware } from "../middlewares/metrics.js";
import routes from "../routes/index.js";

export function createServer() {
  const app = express();

  app.use(cors({ origin: true }));

  app.use(express.json());

  app.use(metricsMiddleware);

  app.use("/", routes);

  return app;
}
