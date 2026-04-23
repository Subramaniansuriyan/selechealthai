import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const getUser = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    if (!args.token) return null;
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!session || session.expiresAt < Date.now()) return null;
    return await ctx.db.get(session.userId);
  },
});

export const patchUserName = internalMutation({
  args: { userId: v.id("users"), name: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { name: args.name });
  },
});

export const storeOTP = internalMutation({
  args: { userId: v.id("users"), code: v.string(), expiresAt: v.float64() },
  handler: async (ctx, args) => {
    await ctx.db.insert("otpCodes", {
      userId: args.userId,
      code: args.code,
      expiresAt: args.expiresAt,
      used: false,
      createdAt: Date.now(),
    });
  },
});

export const getValidOTP = internalQuery({
  args: { userId: v.id("users"), code: v.string() },
  handler: async (ctx, args) => {
    const otps = await ctx.db
      .query("otpCodes")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    return (
      otps.find(
        (o) =>
          o.code === args.code &&
          !o.used &&
          o.expiresAt > Date.now()
      ) ?? null
    );
  },
});

export const markOTPUsed = internalMutation({
  args: { otpId: v.id("otpCodes") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.otpId, { used: true });
  },
});

export const patchUserPassword = internalMutation({
  args: { userId: v.id("users"), passwordHash: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { passwordHash: args.passwordHash });
  },
});
