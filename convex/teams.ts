import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { authenticate, requireRole } from "./authHelpers";

export const addMember = internalMutation({
  args: {
    teamId: v.id("teams"),
    userId: v.id("users"),
    role: v.union(v.literal("manager"), v.literal("member")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("teamMembers")
      .withIndex("by_teamId_userId", (q) =>
        q.eq("teamId", args.teamId).eq("userId", args.userId)
      )
      .unique();
    if (existing) return existing._id;

    return await ctx.db.insert("teamMembers", {
      teamId: args.teamId,
      userId: args.userId,
      role: args.role,
      addedAt: Date.now(),
    });
  },
});

export const createTeam = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await authenticate(ctx, args.token);
    requireRole(user, "superadmin", "manager");

    const existing = await ctx.db
      .query("teams")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .unique();
    if (existing) throw new Error(`Team "${args.name}" already exists`);

    const teamId = await ctx.db.insert("teams", {
      name: args.name,
      description: args.description,
      createdBy: user._id,
      createdAt: Date.now(),
    });

    // Auto-add creator as team manager
    await ctx.db.insert("teamMembers", {
      teamId,
      userId: user._id,
      role: "manager",
      addedAt: Date.now(),
    });

    return teamId;
  },
});

export const deleteTeam = mutation({
  args: {
    token: v.string(),
    teamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    const user = await authenticate(ctx, args.token);
    requireRole(user, "superadmin");

    const team = await ctx.db.get(args.teamId);
    if (!team) throw new Error("Team not found");

    const members = await ctx.db
      .query("teamMembers")
      .withIndex("by_teamId", (q) => q.eq("teamId", args.teamId))
      .collect();
    for (const member of members) {
      await ctx.db.delete(member._id);
    }

    await ctx.db.delete(args.teamId);
  },
});

export const addTeamMember = mutation({
  args: {
    token: v.string(),
    teamId: v.id("teams"),
    userId: v.id("users"),
    memberRole: v.union(v.literal("manager"), v.literal("member")),
  },
  handler: async (ctx, args) => {
    const user = await authenticate(ctx, args.token);
    requireRole(user, "superadmin", "manager");

    const team = await ctx.db.get(args.teamId);
    if (!team) throw new Error("Team not found");

    // Managers can only add to their own teams
    if (user.role === "manager") {
      const membership = await ctx.db
        .query("teamMembers")
        .withIndex("by_teamId_userId", (q) =>
          q.eq("teamId", args.teamId).eq("userId", user._id)
        )
        .unique();
      if (!membership || membership.role !== "manager") {
        throw new Error("You can only add members to teams you manage");
      }
      if (args.memberRole === "manager") {
        throw new Error("Only superadmins can assign the manager role");
      }
    }

    const existing = await ctx.db
      .query("teamMembers")
      .withIndex("by_teamId_userId", (q) =>
        q.eq("teamId", args.teamId).eq("userId", args.userId)
      )
      .unique();
    if (existing) throw new Error("User is already a member of this team");

    return await ctx.db.insert("teamMembers", {
      teamId: args.teamId,
      userId: args.userId,
      role: args.memberRole,
      addedAt: Date.now(),
    });
  },
});

export const removeTeamMember = mutation({
  args: {
    token: v.string(),
    teamMemberId: v.id("teamMembers"),
  },
  handler: async (ctx, args) => {
    const user = await authenticate(ctx, args.token);
    requireRole(user, "superadmin", "manager");

    const membership = await ctx.db.get(args.teamMemberId);
    if (!membership) throw new Error("Team member not found");

    if (user.role === "manager") {
      const myMembership = await ctx.db
        .query("teamMembers")
        .withIndex("by_teamId_userId", (q) =>
          q.eq("teamId", membership.teamId).eq("userId", user._id)
        )
        .unique();
      if (!myMembership || myMembership.role !== "manager") {
        throw new Error("You can only remove members from teams you manage");
      }
    }

    await ctx.db.delete(args.teamMemberId);
  },
});

export const listTeams = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await authenticate(ctx, args.token);

    const teams = await ctx.db.query("teams").order("desc").collect();

    return await Promise.all(
      teams.map(async (team) => {
        const members = await ctx.db
          .query("teamMembers")
          .withIndex("by_teamId", (q) => q.eq("teamId", team._id))
          .collect();

        const memberDetails = await Promise.all(
          members.map(async (m) => {
            const u = await ctx.db.get(m.userId);
            return {
              _id: m._id,
              userId: m.userId,
              name: u?.name ?? "Unknown",
              email: u?.email ?? "",
              teamRole: m.role,
            };
          })
        );

        return {
          ...team,
          memberCount: members.length,
          members: memberDetails,
        };
      })
    );
  },
});
