import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { AdminService } from "../services/AdminService.js";
import { prisma } from "../repos/prisma.js";

describe("AdminService", () => {
  beforeEach(async () => {
    await prisma.notificationLog.deleteMany();
    await prisma.trade.deleteMany();
    await prisma.position.deleteMany();
    await prisma.portfolio.deleteMany();
    await prisma.alert.deleteMany();
    await prisma.user.deleteMany();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getUsers", () => {
    it("should return paginated users", async () => {
      // Créer des utilisateurs de test
      await prisma.user.createMany({
        data: [
          { email: "user1@test.com", password: "hash1", name: "User One", role: "USER" },
          { email: "user2@test.com", password: "hash2", name: "User Two", role: "USER" },
          { email: "admin@test.com", password: "hash3", name: "Admin", role: "ADMIN" },
        ],
      });

      const result = await AdminService.getUsers({ page: 1, limit: 10 });

      expect(result.users).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it("should filter users by role", async () => {
      await prisma.user.createMany({
        data: [
          { email: "user1@test.com", password: "hash1", role: "USER" },
          { email: "admin@test.com", password: "hash2", role: "ADMIN" },
        ],
      });

      const result = await AdminService.getUsers({ role: "ADMIN" });

      expect(result.users).toHaveLength(1);
      expect(result.users[0].role).toBe("ADMIN");
    });

    it("should filter users by search term", async () => {
      await prisma.user.createMany({
        data: [
          { email: "john@test.com", password: "hash1", name: "John Doe", role: "USER" },
          { email: "jane@test.com", password: "hash2", name: "Jane Smith", role: "USER" },
        ],
      });

      const result = await AdminService.getUsers({ search: "john" });

      expect(result.users).toHaveLength(1);
      expect(result.users[0].email).toBe("john@test.com");
    });
  });

  describe("getUserById", () => {
    it("should return user by id", async () => {
      const user = await prisma.user.create({
        data: { email: "test@test.com", password: "hash", name: "Test User", role: "USER" },
      });

      const result = await AdminService.getUserById(user.id);

      expect(result).not.toBeNull();
      expect(result!.email).toBe("test@test.com");
      expect(result!.name).toBe("Test User");
    });

    it("should return null for non-existent user", async () => {
      const result = await AdminService.getUserById(99999);
      expect(result).toBeNull();
    });
  });

  describe("createUser", () => {
    it("should create a new user", async () => {
      const result = await AdminService.createUser(
        "new@test.com",
        "password123",
        "New User",
        "USER"
      );

      expect(result.email).toBe("new@test.com");
      expect(result.name).toBe("New User");
      expect(result.role).toBe("USER");
    });

    it("should create an admin user", async () => {
      const result = await AdminService.createUser(
        "admin@test.com",
        "password123",
        "Admin",
        "ADMIN"
      );

      expect(result.role).toBe("ADMIN");
    });

    it("should throw error for duplicate email", async () => {
      await prisma.user.create({
        data: { email: "existing@test.com", password: "hash", role: "USER" },
      });

      await expect(AdminService.createUser("existing@test.com", "password123")).rejects.toThrow(
        "existe déjà"
      );
    });
  });

  describe("updateUser", () => {
    it("should update user email and name", async () => {
      const user = await prisma.user.create({
        data: { email: "old@test.com", password: "hash", name: "Old Name", role: "USER" },
      });
      const admin = await prisma.user.create({
        data: { email: "admin@test.com", password: "hash", role: "ADMIN" },
      });

      const result = await AdminService.updateUser(
        user.id,
        { email: "new@test.com", name: "New Name" },
        admin.id
      );

      expect(result.email).toBe("new@test.com");
      expect(result.name).toBe("New Name");
    });

    it("should update user role", async () => {
      const user = await prisma.user.create({
        data: { email: "user@test.com", password: "hash", role: "USER" },
      });
      const admin = await prisma.user.create({
        data: { email: "admin@test.com", password: "hash", role: "ADMIN" },
      });

      const result = await AdminService.updateUser(user.id, { role: "ADMIN" }, admin.id);

      expect(result.role).toBe("ADMIN");
    });

    it("should prevent admin from changing their own role", async () => {
      const admin = await prisma.user.create({
        data: { email: "admin@test.com", password: "hash", role: "ADMIN" },
      });

      await expect(AdminService.updateUser(admin.id, { role: "USER" }, admin.id)).rejects.toThrow(
        "propre rôle"
      );
    });

    it("should throw error for non-existent user", async () => {
      await expect(AdminService.updateUser(99999, { name: "Test" }, 1)).rejects.toThrow(
        "non trouvé"
      );
    });

    it("should throw error for duplicate email", async () => {
      await prisma.user.create({
        data: { email: "existing@test.com", password: "hash", role: "USER" },
      });
      const user = await prisma.user.create({
        data: { email: "user@test.com", password: "hash", role: "USER" },
      });
      const admin = await prisma.user.create({
        data: { email: "admin@test.com", password: "hash", role: "ADMIN" },
      });

      await expect(
        AdminService.updateUser(user.id, { email: "existing@test.com" }, admin.id)
      ).rejects.toThrow("existe déjà");
    });
  });

  describe("deleteUser", () => {
    it("should delete a user", async () => {
      const user = await prisma.user.create({
        data: { email: "todelete@test.com", password: "hash", role: "USER" },
      });
      const admin = await prisma.user.create({
        data: { email: "admin@test.com", password: "hash", role: "ADMIN" },
      });

      await AdminService.deleteUser(user.id, admin.id);

      const deletedUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(deletedUser).toBeNull();
    });

    it("should prevent admin from deleting themselves", async () => {
      const admin = await prisma.user.create({
        data: { email: "admin@test.com", password: "hash", role: "ADMIN" },
      });

      await expect(AdminService.deleteUser(admin.id, admin.id)).rejects.toThrow("propre compte");
    });

    it("should throw error for non-existent user", async () => {
      await expect(AdminService.deleteUser(99999, 1)).rejects.toThrow("non trouvé");
    });
  });

  describe("getStats", () => {
    it("should return correct stats", async () => {
      // Créer des utilisateurs
      await prisma.user.createMany({
        data: [
          { email: "user1@test.com", password: "hash", role: "USER" },
          { email: "user2@test.com", password: "hash", role: "USER" },
          { email: "admin@test.com", password: "hash", role: "ADMIN" },
        ],
      });

      const stats = await AdminService.getStats();

      expect(stats.totalUsers).toBe(3);
      expect(stats.adminCount).toBe(1);
      expect(stats.userCount).toBe(2);
      expect(stats.newUsersThisWeek).toBe(3);
      expect(stats.newUsersThisMonth).toBe(3);
    });
  });
});
