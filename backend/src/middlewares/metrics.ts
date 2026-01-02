import { Request, Response, NextFunction } from "express";
import {
  httpRequestsTotal,
  httpRequestDuration,
  activeConnections,
} from "../metrics/prometheus.js";

/**
 * Middleware pour collecter les métriques HTTP
 * À placer au début de la chaîne de middlewares
 */
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Incrémenter les connexions actives
  activeConnections.inc();

  // Démarrer le timer
  const startTime = Date.now();

  // Nettoyer la route pour éviter les cardinalités élevées
  const getCleanRoute = (): string => {
    const path = req.route?.path || req.path;
    // Remplacer les IDs dynamiques par des placeholders
    return path
      .replace(/\/\d+/g, "/:id")
      .replace(/\/[a-f0-9-]{36}/gi, "/:uuid");
  };

  // Intercepter la fin de la réponse
  res.on("finish", () => {
    const duration = (Date.now() - startTime) / 1000; // En secondes
    const route = getCleanRoute();
    const method = req.method;
    const status = res.statusCode.toString();

    // Enregistrer les métriques
    httpRequestsTotal.inc({ method, route, status });
    httpRequestDuration.observe({ method, route, status }, duration);

    // Décrémenter les connexions actives
    activeConnections.dec();
  });

  next();
};
