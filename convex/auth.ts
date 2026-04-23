"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import bcrypt from "bcryptjs";
import type { Id } from "./_generated/dataModel";

const SALT_ROUNDS = 12;
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const login = action({
  args: { email: v.string(), password: v.string() },
  returns: v.object({
    token: v.string(),
    user: v.object({
      _id: v.id("users"),
      email: v.string(),
      name: v.string(),
      role: v.union(v.literal("superadmin"), v.literal("manager"), v.literal("staff")),
    }),
  }),
  handler: async (ctx, args): Promise<{
    token: string;
    user: {
      _id: Id<"users">;
      email: string;
      name: string;
      role: "superadmin" | "manager" | "staff";
    };
  }> => {
    const user = await ctx.runQuery(internal.sessions.getUserByEmail, {
      email: args.email,
    });
    if (!user) {
      throw new Error("Invalid email or password");
    }

    const valid = await bcrypt.compare(args.password, user.passwordHash);
    if (!valid) {
      throw new Error("Invalid email or password");
    }

    const token = crypto.randomUUID();
    const expiresAt = Date.now() + SESSION_DURATION_MS;

    await ctx.runMutation(internal.sessions.createSession, {
      userId: user._id,
      token,
      expiresAt,
    });

    return {
      token,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  },
});

export const createSuperUser = action({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
  },
  returns: v.object({
    userId: v.id("users"),
    email: v.string(),
    role: v.literal("superadmin"),
  }),
  handler: async (ctx, args): Promise<{
    userId: Id<"users">;
    email: string;
    role: "superadmin";
  }> => {
    const existing = await ctx.runQuery(internal.sessions.getUserByEmail, {
      email: args.email,
    });
    if (existing) {
      throw new Error(`User with email "${args.email}" already exists`);
    }

    const passwordHash = await bcrypt.hash(args.password, SALT_ROUNDS);

    const userId = await ctx.runMutation(internal.users.createUser, {
      email: args.email,
      passwordHash,
      role: "superadmin",
      name: args.name,
    });

    return { userId, email: args.email, role: "superadmin" };
  },
});
