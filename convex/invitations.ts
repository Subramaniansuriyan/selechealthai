import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { authenticate, requireRole } from "./authHelpers";

export const createInvitation = internalMutation({
  args: {
    email: v.string(),
    name: v.string(),
    role: v.union(v.literal("manager"), v.literal("staff")),
    token: v.string(),
    invitedBy: v.id("users"),
    teamId: v.optional(v.id("teams")),
    expiresAt: v.float64(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("invitations", {
      ...args,
      status: "pending" as const,
      createdAt: Date.now(),
    });
  },
});

export const getInvitationByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const invitation = await ctx.db
      .query("invitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!invitation) return null;
    if (invitation.status !== "pending") return null;
    if (invitation.expiresAt < Date.now()) return null;
    return {
      _id: invitation._id,
      email: invitation.email,
      name: invitation.name,
      role: invitation.role,
      teamId: invitation.teamId,
    };
  },
});

export const getInvitationByTokenInternal = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("invitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
  },
});

export const getPendingByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const invitations = await ctx.db
      .query("invitations")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .collect();
    return (
      invitations.find(
        (inv) => inv.status === "pending" && inv.expiresAt > Date.now()
      ) ?? null
    );
  },
});

export const markAccepted = internalMutation({
  args: { invitationId: v.id("invitations") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.invitationId, { status: "accepted" as const });
  },
});

export const listInvitations = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await authenticate(ctx, args.token);
    requireRole(user, "superadmin", "manager");

    const invitations = await ctx.db.query("invitations").order("desc").collect();

    const enriched = await Promise.all(
      invitations.map(async (inv) => {
        const inviter = await ctx.db.get(inv.invitedBy);
        let teamName: string | undefined;
        if (inv.teamId) {
          const team = await ctx.db.get(inv.teamId);
          teamName = team?.name;
        }
        return {
          ...inv,
          inviterName: inviter?.name ?? "Unknown",
          teamName,
        };
      })
    );

    // Managers only see their own invitations
    if (user.role === "manager") {
      return enriched.filter((inv) => inv.invitedBy === user._id);
    }

    return enriched;
  },
});

export const revokeInvitation = mutation({
  args: {
    token: v.string(),
    invitationId: v.id("invitations"),
  },
  handler: async (ctx, args) => {
    const user = await authenticate(ctx, args.token);
    requireRole(user, "superadmin", "manager");

    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation) throw new Error("Invitation not found");
    if (invitation.status !== "pending") throw new Error("Invitation is not pending");

    if (user.role === "manager" && invitation.invitedBy !== user._id) {
      throw new Error("You can only revoke invitations you sent");
    }

    await ctx.db.patch(args.invitationId, { status: "revoked" as const });
  },
});
