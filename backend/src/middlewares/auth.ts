import { Request, Response, NextFunction } from "express";
import { AuthService, JwtPayload } from "../services/AuthService.js";
import type { Role } from "@prisma/client";

// Étendre le type Request d'Express pour inclure l'utilisateur
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Middleware d'authentification - vérifie le token JWT
 * Le token doit être dans le header Authorization: Bearer <token>
 */
export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({ error: "Token d'authentification requis" });
      return;
    }

    // Format attendu: "Bearer <token>"
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      res.status(401).json({ error: "Format de token invalide. Utilisez: Bearer <token>" });
      return;
    }

    const token = parts[1];

    // Vérifier et décoder le token
    const decoded = AuthService.verifyToken(token);
    
    // Ajouter les infos utilisateur à la requête
    req.user = decoded;

    next();
  } catch (error) {
    res.status(401).json({ error: "Token invalide ou expiré" });
  }
};

/**
 * Middleware d'autorisation - vérifie que l'utilisateur a le bon rôle
 * À utiliser APRÈS le middleware authenticate
 * 
 * @param allowedRoles - Liste des rôles autorisés
 * 
 * Exemple: authorize("ADMIN") ou authorize("USER", "ADMIN")
 */
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
        current: req.user.role
      });
      return;
    }

    next();
  };
};

/**
 * Middleware optionnel d'authentification
 * Ne bloque pas si pas de token, mais ajoute l'utilisateur si présent
 */
export const optionalAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
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
    // Token invalide, on continue sans utilisateur
  }

  next();
};
