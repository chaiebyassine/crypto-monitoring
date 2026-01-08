import { Request, Response, NextFunction } from "express";
import {
  httpRequestsTotal,
  httpRequestDuration,
  activeConnections,
} from "../metrics/prometheus.js";

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  activeConnections.inc();

  const startTime = Date.now();

  const getCleanRoute = (): string => {
    const path = req.route?.path || req.path;
    return path.replace(/\/\d+/g, "/:id").replace(/\/[a-f0-9-]{36}/gi, "/:uuid");
  };

  res.on("finish", () => {
    const duration = (Date.now() - startTime) / 1000; // En secondes
    const route = getCleanRoute();
    const method = req.method;
    const status = res.statusCode.toString();

    httpRequestsTotal.inc({ method, route, status });
    httpRequestDuration.observe({ method, route, status }, duration);

    activeConnections.dec();
  });

  next();
};
