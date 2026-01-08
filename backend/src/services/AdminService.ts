import { prisma } from "../repos/prisma.js";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";

export interface UserInfo {
  id: number;
  email: string;
  name: string | null;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    portfolios: number;
    alerts: number;
  };
}

export interface UpdateUserData {
  email?: string;
  name?: string;
  role?: Role;
  password?: string;
}

export interface UserFilters {
  search?: string;
  role?: Role;
  page?: number;
  limit?: number;
}

const SALT_ROUNDS = 10;

export const AdminService = {
  async getUsers(filters: UserFilters = {}): Promise<{
    users: UserInfo[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const { search, role, page = 1, limit = 10 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
      ];
    }

    if (role) {
      where.role = role;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              portfolios: true,
              alerts: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  },

  async getUserById(userId: number): Promise<UserInfo | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            portfolios: true,
            alerts: true,
          },
        },
      },
    });

    return user;
  },

  async updateUser(userId: number, data: UpdateUserData, adminId: number): Promise<UserInfo> {
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      throw new Error("Utilisateur non trouvé");
    }

    if (userId === adminId && data.role && data.role !== existingUser.role) {
      throw new Error("Vous ne pouvez pas modifier votre propre rôle");
    }

    if (data.email && data.email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: data.email },
      });
      if (emailExists) {
        throw new Error("Un utilisateur avec cet email existe déjà");
      }
    }

    const updateData: any = { ...data };
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, SALT_ROUNDS);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            portfolios: true,
            alerts: true,
          },
        },
      },
    });

    return updatedUser;
  },

  async deleteUser(userId: number, adminId: number): Promise<void> {
    if (userId === adminId) {
      throw new Error("Vous ne pouvez pas supprimer votre propre compte");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("Utilisateur non trouvé");
    }

    const portfolios = await prisma.portfolio.findMany({
      where: { userId: userId },
      select: { id: true },
    });
    const portfolioIds = portfolios.map((p) => p.id);

    await prisma.$transaction([
      prisma.trade.deleteMany({
        where: {
          portfolioId: { in: portfolioIds },
        },
      }),
      prisma.position.deleteMany({
        where: {
          portfolioId: { in: portfolioIds },
        },
      }),
      prisma.portfolio.deleteMany({
        where: { userId: userId },
      }),
      prisma.notificationLog.deleteMany({
        where: {
          alert: {
            userId: userId,
          },
        },
      }),
      prisma.alert.deleteMany({
        where: { userId: userId },
      }),
      prisma.user.delete({
        where: { id: userId },
      }),
    ]);
  },

  async getStats(): Promise<{
    totalUsers: number;
    adminCount: number;
    userCount: number;
    newUsersThisWeek: number;
    newUsersThisMonth: number;
  }> {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [totalUsers, adminCount, newUsersThisWeek, newUsersThisMonth] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "ADMIN" } }),
      prisma.user.count({ where: { createdAt: { gte: oneWeekAgo } } }),
      prisma.user.count({ where: { createdAt: { gte: oneMonthAgo } } }),
    ]);

    return {
      totalUsers,
      adminCount,
      userCount: totalUsers - adminCount,
      newUsersThisWeek,
      newUsersThisMonth,
    };
  },

  async createUser(
    email: string,
    password: string,
    name?: string,
    role: Role = "USER"
  ): Promise<UserInfo> {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error("Un utilisateur avec cet email existe déjà");
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name ?? null,
        role,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            portfolios: true,
            alerts: true,
          },
        },
      },
    });

    return user;
  },
};
