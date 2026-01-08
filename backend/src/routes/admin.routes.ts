import { Router } from "express";
import { AdminService } from "../services/AdminService.js";
import { authenticate, authorize } from "../middlewares/auth.js";

const router = Router();

router.use(authenticate, authorize("ADMIN"));


router.get("/stats", async (_req, res) => {
  try {
    const stats = await AdminService.getStats();
    res.json({ data: stats });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: message });
  }
});


router.get("/users", async (req, res) => {
  try {
    const { search, role, page, limit } = req.query;
    const result = await AdminService.getUsers({
      search: search as string,
      role: role as "USER" | "ADMIN",
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    res.json({ data: result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: message });
  }
});

router.get("/users/:id", async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ error: "ID utilisateur invalide" });
    }
    const user = await AdminService.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }
    res.json({ data: user });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: message });
  }
});


router.post("/users", async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email requis" });
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ error: "Mot de passe requis (min 6 caractères)" });
    }

    const user = await AdminService.createUser(email, password, name, role);
    res.status(201).json({ data: user });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes("existe déjà")) {
      return res.status(409).json({ error: message });
    }
    res.status(500).json({ error: message });
  }
});

router.patch("/users/:id", async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ error: "ID utilisateur invalide" });
    }

    const { email, name, role, password } = req.body;
    const updateData: any = {};

    if (email !== undefined) updateData.email = email;
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role;
    if (password !== undefined) {
      if (password.length < 6) {
        return res.status(400).json({ error: "Mot de passe trop court (min 6 caractères)" });
      }
      updateData.password = password;
    }

    const user = await AdminService.updateUser(userId, updateData, req.user!.userId);
    res.json({ data: user });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes("non trouvé")) {
      return res.status(404).json({ error: message });
    }
    if (message.includes("existe déjà") || message.includes("propre rôle")) {
      return res.status(400).json({ error: message });
    }
    res.status(500).json({ error: message });
  }
});


router.delete("/users/:id", async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ error: "ID utilisateur invalide" });
    }

    await AdminService.deleteUser(userId, req.user!.userId);
    res.json({ ok: true, message: "Utilisateur supprimé" });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes("non trouvé")) {
      return res.status(404).json({ error: message });
    }
    if (message.includes("propre compte")) {
      return res.status(400).json({ error: message });
    }
    res.status(500).json({ error: message });
  }
});

export default router;
