import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("../repos/prisma.js", () => ({
  prisma: mockPrisma,
}));

vi.mock("../config/env.js", () => ({
  env: {
    jwtSecret: "test_secret_key_for_testing",
    jwtExpiresIn: "1h",
  },
}));

import { AuthService } from "../services/AuthService.js";

describe("AuthService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("register", () => {
    it("devrait créer un nouvel utilisateur avec succès", async () => {
      const mockUser = {
        id: 1,
        email: "test@example.com",
        name: "Test User",
        password: "hashed_password",
        role: "USER",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockUser);

      const result = await AuthService.register("test@example.com", "password123", "Test User");

      expect(result.user.email).toBe("test@example.com");
      expect(result.user.name).toBe("Test User");
      expect(result.user.role).toBe("USER");
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe("string");
    });

    it("devrait rejeter si l'email existe déjà", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: "existing@example.com",
      });

      await expect(AuthService.register("existing@example.com", "password123")).rejects.toThrow(
        "existe déjà"
      );
    });

    it("devrait hasher le mot de passe avant de sauvegarder", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockImplementation(async ({ data }) => ({
        id: 1,
        ...data,
        role: "USER",
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      await AuthService.register("test@example.com", "password123");

      const createCall = mockPrisma.user.create.mock.calls[0][0];
      expect(createCall.data.password).not.toBe("password123");
      expect(createCall.data.password.startsWith("$2")).toBe(true);
    });
  });

  describe("login", () => {
    it("devrait connecter un utilisateur avec les bons identifiants", async () => {
      const hashedPassword = await bcrypt.hash("password123", 10);
      const mockUser = {
        id: 1,
        email: "test@example.com",
        name: "Test User",
        password: hashedPassword,
        role: "USER",
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await AuthService.login("test@example.com", "password123");

      expect(result.user.email).toBe("test@example.com");
      expect(result.token).toBeDefined();
    });

    it("devrait rejeter si l'email n'existe pas", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(AuthService.login("unknown@example.com", "password123")).rejects.toThrow(
        "Email ou mot de passe incorrect"
      );
    });

    it("devrait rejeter si le mot de passe est incorrect", async () => {
      const hashedPassword = await bcrypt.hash("correct_password", 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: "test@example.com",
        password: hashedPassword,
      });

      await expect(AuthService.login("test@example.com", "wrong_password")).rejects.toThrow(
        "Email ou mot de passe incorrect"
      );
    });
  });

  describe("verifyToken", () => {
    it("devrait vérifier un token valide", () => {
      const token = AuthService.generateToken({
        id: 1,
        email: "test@example.com",
        role: "USER",
      });

      const decoded = AuthService.verifyToken(token);

      expect(decoded.userId).toBe(1);
      expect(decoded.email).toBe("test@example.com");
      expect(decoded.role).toBe("USER");
    });

    it("devrait rejeter un token invalide", () => {
      expect(() => AuthService.verifyToken("invalid_token")).toThrow("Token invalide ou expiré");
    });

    it("devrait rejeter un token expiré", () => {
      const payload = { userId: 1, email: "test@example.com", role: "USER" };
      const expiredToken = jwt.sign(payload, "test_secret_key_for_testing", {
        expiresIn: "-1s",
      });

      expect(() => AuthService.verifyToken(expiredToken)).toThrow("Token invalide ou expiré");
    });
  });

  describe("generateToken", () => {
    it("devrait générer un token JWT valide", () => {
      const token = AuthService.generateToken({
        id: 1,
        email: "test@example.com",
        role: "ADMIN",
      });

      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);

      const decoded = jwt.decode(token) as any;
      expect(decoded.userId).toBe(1);
      expect(decoded.email).toBe("test@example.com");
      expect(decoded.role).toBe("ADMIN");
    });
  });

  describe("getUserById", () => {
    it("devrait retourner un utilisateur existant", async () => {
      const mockUser = {
        id: 1,
        email: "test@example.com",
        name: "Test User",
        role: "USER",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await AuthService.getUserById(1);

      expect(result.id).toBe(1);
      expect(result.email).toBe("test@example.com");
    });

    it("devrait rejeter si l'utilisateur n'existe pas", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(AuthService.getUserById(999)).rejects.toThrow("Utilisateur non trouvé");
    });
  });

  describe("updatePassword", () => {
    it("devrait mettre à jour le mot de passe avec succès", async () => {
      const currentHashedPassword = await bcrypt.hash("current_password", 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: "test@example.com",
        password: currentHashedPassword,
      });
      mockPrisma.user.update.mockResolvedValue({});

      await expect(
        AuthService.updatePassword(1, "current_password", "new_password")
      ).resolves.toBeUndefined();

      expect(mockPrisma.user.update).toHaveBeenCalled();
    });

    it("devrait rejeter si le mot de passe actuel est incorrect", async () => {
      const currentHashedPassword = await bcrypt.hash("current_password", 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1,
        password: currentHashedPassword,
      });

      await expect(AuthService.updatePassword(1, "wrong_password", "new_password")).rejects.toThrow(
        "Mot de passe actuel incorrect"
      );
    });

    it("devrait rejeter si l'utilisateur n'existe pas", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(AuthService.updatePassword(999, "current", "new")).rejects.toThrow(
        "Utilisateur non trouvé"
      );
    });
  });
});
