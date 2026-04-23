import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { authenticate, requireRole } from "./authHelpers";

export const createUser = internalMutation({
  args: {
    email: v.string(),
    passwordHash: v.string(),
    role: v.union(v.literal("superadmin"), v.literal("manager"), v.literal("staff")),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("users", {
      email: args.email,
      passwordHash: args.passwordHash,
      role: args.role,
      name: args.name,
      createdAt: Date.now(),
    });
  },
});

export const getMe = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    if (!args.token) return null;

    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    if (!session || session.expiresAt < Date.now()) {
      return null;
    }

    const user = await ctx.db.get(session.userId);
    if (!user) return null;

    return {
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  },
});

export const listUsers = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await authenticate(ctx, args.token);
    requireRole(user, "superadmin", "manager");

    const users = await ctx.db.query("users").collect();

    return await Promise.all(
      users.map(async (u) => {
        const memberships = await ctx.db
          .query("teamMembers")
          .withIndex("by_userId", (q) => q.eq("userId", u._id))
          .collect();

        const teams = await Promise.all(
          memberships.map(async (m) => {
            const team = await ctx.db.get(m.teamId);
            return { teamId: m.teamId, teamName: team?.name ?? "Unknown", role: m.role };
          })
        );

        return {
          _id: u._id,
          email: u.email,
          name: u.name,
          role: u.role,
          createdAt: u.createdAt,
          teams,
        };
      })
    );
  },
});

export const updateUserRole = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
    role: v.union(v.literal("superadmin"), v.literal("manager"), v.literal("staff")),
  },
  handler: async (ctx, args) => {
    const user = await authenticate(ctx, args.token);
    requireRole(user, "superadmin");

    if (args.userId === user._id) {
      throw new Error("Cannot change your own role");
    }

    await ctx.db.patch(args.userId, { role: args.role });
  },
});

export const deleteUser = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await authenticate(ctx, args.token);
    requireRole(user, "superadmin");

    if (args.userId === user._id) {
      throw new Error("Cannot delete your own account");
    }

    // Remove sessions
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
    for (const s of sessions) {
      await ctx.db.delete(s._id);
    }

    // Remove team memberships
    const memberships = await ctx.db
      .query("teamMembers")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
    for (const m of memberships) {
      await ctx.db.delete(m._id);
    }

    await ctx.db.delete(args.userId);
  },
});
