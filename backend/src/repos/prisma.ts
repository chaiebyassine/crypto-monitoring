// Client Prisma singleton : on crée une seule instance et on la réutilise partout
import { PrismaClient } from "@prisma/client";

// Prisma gère les connexions à la base + les requêtes.
// Une seule instance évite les problèmes en dev (hot-reload) ou en prod.
export const prisma = new PrismaClient();
