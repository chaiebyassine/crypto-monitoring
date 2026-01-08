import { Router } from "express";
import { AuthService } from "../services/AuthService.js";
import { authenticate, authorize } from "../middlewares/auth.js";
import { prisma } from "../repos/prisma.js";

const router = Router();

router.post("/register", async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email requis" });
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ error: "Mot de passe requis (min 6 caractères)" });
    }

    const result = await AuthService.register(email, password, name);
    res.status(201).json({ data: result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes("existe déjà")) {
      return res.status(409).json({ error: message });
    }
    res.status(500).json({ error: message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email requis" });
    }
    if (!password || typeof password !== "string") {
      return res.status(400).json({ error: "Mot de passe requis" });
    }

    const result = await AuthService.login(email, password);
    res.json({ data: result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(401).json({ error: message });
  }
});

router.get("/me", authenticate, async (req, res) => {
  try {
    const user = await AuthService.getUserById(req.user!.userId);
    res.json({ data: user });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(404).json({ error: message });
  }
});

router.patch("/password", authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || typeof currentPassword !== "string") {
      return res.status(400).json({ error: "Mot de passe actuel requis" });
    }
    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
      return res.status(400).json({ error: "Nouveau mot de passe requis (min 6 caractères)" });
    }

    await AuthService.updatePassword(req.user!.userId, currentPassword, newPassword);
    res.json({ ok: true, message: "Mot de passe mis à jour" });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(400).json({ error: message });
  }
});

router.get("/users", authenticate, authorize("ADMIN"), async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ data: users });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: message });
  }
});

export default router;
