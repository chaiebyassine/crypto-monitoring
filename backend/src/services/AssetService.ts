import { prisma } from "../repos/prisma.js";

export const AssetService = {
  async getAll() {
    return prisma.asset.findMany({
      orderBy: { symbol: "asc" },
      select: { id: true, symbol: true, name: true },
    });
  },

  async getById(id: number) {
    return prisma.asset.findUnique({ where: { id } });
  },

  async getBySymbol(symbol: string) {
    return prisma.asset.findFirst({
      where: { symbol: symbol.toLowerCase() },
    });
  },
};
