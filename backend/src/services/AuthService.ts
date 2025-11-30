import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../repos/prisma.js";
import { env } from "../config/env.js";
import type { Role } from "@prisma/client";

export interface JwtPayload {
  userId: number;
  email: string;
  role: Role;
}

export interface AuthResponse {
  user: {
    id: number;
    email: string;
    name: string | null;
    role: Role;
  };
  token: string;
}

const SALT_ROUNDS = 10;


export const AuthService = {
  
  async register(
    email: string,
    password: string,
    name?: string
  ): Promise<AuthResponse> {
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
        role: "USER",
      },
    });

    const token = AuthService.generateToken(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    };
  },

 
  async login(email: string, password: string): Promise<AuthResponse> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new Error("Email ou mot de passe incorrect");
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      throw new Error("Email ou mot de passe incorrect");
    }

    const token = AuthService.generateToken(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    };
  },

  verifyToken(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;
      return decoded;
    } catch (error) {
      throw new Error("Token invalide ou expiré");
    }
  },

  
  generateToken(user: { id: number; email: string; role: Role }): string {
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    return jwt.sign(payload, env.jwtSecret, {
      expiresIn: env.jwtExpiresIn,
    } as jwt.SignOptions);
  },

  async getUserById(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new Error("Utilisateur non trouvé");
    }

    return user;
  },

  async updatePassword(
    userId: number,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("Utilisateur non trouvé");
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.password);

    if (!isValidPassword) {
      throw new Error("Mot de passe actuel incorrect");
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
  },
};
