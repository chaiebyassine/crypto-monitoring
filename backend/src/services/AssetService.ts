import { prisma } from "../repos/prisma.js";

/**
 * Service pour la gestion des assets (cryptomonnaies)
 */
export const AssetService = {
  /**
   * Récupère tous les assets
   */
  async getAll() {
    return prisma.asset.findMany({
      orderBy: { symbol: "asc" },
      select: { id: true, symbol: true, name: true },
    });
  },

  /**
   * Récupère un asset par ID
   */
  async getById(id: number) {
    return prisma.asset.findUnique({ where: { id } });
  },

  /**
   * Récupère un asset par symbole
   */
  async getBySymbol(symbol: string) {
    return prisma.asset.findFirst({
      where: { symbol: symbol.toLowerCase() },
    });
  },
};
