import { Request, Response, NextFunction } from "express";
import { AuthService, JwtPayload } from "../services/AuthService.js";
import type { Role } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}


export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({ error: "Token d'authentification requis" });
      return;
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      res.status(401).json({ error: "Format de token invalide. Utilisez: Bearer <token>" });
      return;
    }

    const token = parts[1];

    const decoded = AuthService.verifyToken(token);

    req.user = decoded;

    next();
  } catch (_error) {
    res.status(401).json({ error: "Token invalide ou expiré" });
  }
};

export const authorize = (...allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Non authentifié" });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: "Accès refusé. Rôle insuffisant",
        required: allowedRoles,
        current: req.user.role,
      });
      return;
    }

    next();
  };
};


export const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader) {
      const parts = authHeader.split(" ");
      if (parts.length === 2 && parts[0] === "Bearer") {
        const token = parts[1];
        const decoded = AuthService.verifyToken(token);
        req.user = decoded;
      }
    }
  } catch {
  }

  next();
};
