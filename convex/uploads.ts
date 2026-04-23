import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authenticate } from "./authHelpers";

// ── Mutations ──────────────────────────────────────────────

export const generateUploadUrl = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await authenticate(ctx, args.token);
    return await ctx.storage.generateUploadUrl();
  },
});

export const createBatch = mutation({
  args: {
    token: v.string(),
    fileCount: v.float64(),
    groupCount: v.float64(),
  },
  handler: async (ctx, args) => {
    const user = await authenticate(ctx, args.token);
    return await ctx.db.insert("uploadBatches", {
      uploadedBy: user._id,
      status: "uploading",
      fileCount: args.fileCount,
      groupCount: args.groupCount,
      createdAt: Date.now(),
    });
  },
});

export const createGroup = mutation({
  args: {
    token: v.string(),
    batchId: v.id("uploadBatches"),
    groupNumber: v.float64(),
  },
  handler: async (ctx, args) => {
    await authenticate(ctx, args.token);

    const batch = await ctx.db.get(args.batchId);
    if (!batch) throw new Error("Batch not found");

    return await ctx.db.insert("uploadGroups", {
      batchId: args.batchId,
      groupNumber: args.groupNumber,
      fileCount: 0,
      createdAt: Date.now(),
    });
  },
});

export const saveFile = mutation({
  args: {
    token: v.string(),
    batchId: v.id("uploadBatches"),
    groupId: v.id("uploadGroups"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.float64(),
    fileType: v.string(),
  },
  handler: async (ctx, args) => {
    await authenticate(ctx, args.token);

    const batch = await ctx.db.get(args.batchId);
    if (!batch) throw new Error("Batch not found");

    return await ctx.db.insert("uploadedFiles", {
      batchId: args.batchId,
      groupId: args.groupId,
      storageId: args.storageId,
      fileName: args.fileName,
      fileSize: args.fileSize,
      fileType: args.fileType,
      status: "uploaded",
      uploadedAt: Date.now(),
    });
  },
});

export const finalizeBatch = mutation({
  args: {
    token: v.string(),
    batchId: v.id("uploadBatches"),
  },
  handler: async (ctx, args) => {
    await authenticate(ctx, args.token);

    const batch = await ctx.db.get(args.batchId);
    if (!batch) throw new Error("Batch not found");

    const files = await ctx.db
      .query("uploadedFiles")
      .withIndex("by_batchId", (q: any) => q.eq("batchId", args.batchId))
      .collect();

    const groups = await ctx.db
      .query("uploadGroups")
      .withIndex("by_batchId", (q: any) => q.eq("batchId", args.batchId))
      .collect();

    // Update file counts on each group
    for (const group of groups) {
      const groupFiles = files.filter(
        (f: any) => f.groupId === group._id
      );
      await ctx.db.patch(group._id, { fileCount: groupFiles.length });
    }

    await ctx.db.patch(args.batchId, {
      status: "queued",
      fileCount: files.length,
      groupCount: groups.length,
    });
  },
});

// ── Queries ────────────────────────────────────────────────

export const listBatches = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    if (!args.token) return [];

    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q: any) => q.eq("token", args.token))
      .unique();

    if (!session || session.expiresAt < Date.now()) return [];

    const batches = await ctx.db
      .query("uploadBatches")
      .order("desc")
      .collect();

    return await Promise.all(
      batches.map(async (batch) => {
        const user = await ctx.db
          .query("users")
          .filter((q) => q.eq(q.field("_id"), batch.uploadedBy))
          .unique();
        return {
          ...batch,
          uploaderName: user?.name ?? "Unknown",
          uploaderEmail: user?.email ?? "",
        };
      })
    );
  },
});

export const getGroupsInBatch = query({
  args: {
    token: v.string(),
    batchId: v.id("uploadBatches"),
  },
  handler: async (ctx, args) => {
    if (!args.token) return [];

    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q: any) => q.eq("token", args.token))
      .unique();

    if (!session || session.expiresAt < Date.now()) return [];

    return await ctx.db
      .query("uploadGroups")
      .withIndex("by_batchId", (q: any) => q.eq("batchId", args.batchId))
      .collect();
  },
});

export const getFilesInGroup = query({
  args: {
    token: v.string(),
    groupId: v.id("uploadGroups"),
  },
  handler: async (ctx, args) => {
    if (!args.token) return [];

    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q: any) => q.eq("token", args.token))
      .unique();

    if (!session || session.expiresAt < Date.now()) return [];

    const files = await ctx.db
      .query("uploadedFiles")
      .withIndex("by_groupId", (q: any) => q.eq("groupId", args.groupId))
      .collect();

    return await Promise.all(
      files.map(async (file: any) => {
        const url = await ctx.storage.getUrl(file.storageId);
        return { ...file, url };
      })
    );
  },
});

export const getQueueStats = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    if (!args.token) return null;

    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q: any) => q.eq("token", args.token))
      .unique();

    if (!session || session.expiresAt < Date.now()) return null;

    const batches = await ctx.db.query("uploadBatches").collect();

    return {
      total: batches.length,
      queued: batches.filter((b: any) => b.status === "queued").length,
      processing: batches.filter((b: any) => b.status === "processing").length,
      paused: batches.filter((b: any) => b.status === "paused").length,
      completed: batches.filter((b: any) => b.status === "completed").length,
    };
  },
});
