import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

// Internal: create a password reset record
export const createReset = internalMutation({
  args: {
    email: v.string(),
    token: v.string(),
    expiresAt: v.float64(),
  },
  handler: async (ctx, args) => {
    // Invalidate any existing unused resets for this email
    const existing = await ctx.db
      .query("passwordResets")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .collect();
    for (const reset of existing) {
      if (!reset.used) {
        await ctx.db.patch(reset._id, { used: true });
      }
    }

    return await ctx.db.insert("passwordResets", {
      email: args.email,
      token: args.token,
      expiresAt: args.expiresAt,
      used: false,
      createdAt: Date.now(),
    });
  },
});

// Internal: get reset by token
export const getResetByTokenInternal = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("passwordResets")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
  },
});

// Internal: mark reset as used
export const markUsed = internalMutation({
  args: { resetId: v.id("passwordResets") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.resetId, { used: true });
  },
});

// Internal: update user password
export const updatePasswordHash = internalMutation({
  args: { userId: v.id("users"), passwordHash: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { passwordHash: args.passwordHash });
  },
});

// Public query: validate a reset token (for the frontend)
export const validateResetToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    if (!args.token) return null;

    const reset = await ctx.db
      .query("passwordResets")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    if (!reset || reset.used || reset.expiresAt < Date.now()) {
      return null;
    }

    return { email: reset.email };
  },
});
