import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { authenticate } from "./authHelpers";

// ── Internal Queries ──────────────────────────────────────

export const getNextUnprocessedGroup = internalQuery({
  args: { batchId: v.id("uploadBatches") },
  handler: async (ctx, args) => {
    const groups = await ctx.db
      .query("uploadGroups")
      .withIndex("by_batchId", (q) => q.eq("batchId", args.batchId))
      .collect();

    return (
      groups.find(
        (g) => !g.processingStatus || g.processingStatus === "pending"
      ) ?? null
    );
  },
});

export const getFilesForGroup = internalQuery({
  args: { groupId: v.id("uploadGroups") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("uploadedFiles")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();
  },
});

export const getFile = internalQuery({
  args: { fileId: v.id("uploadedFiles") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.fileId);
  },
});

export const getExtractedDocsForGroup = internalQuery({
  args: { groupId: v.id("uploadGroups") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("extractedDocuments")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();
  },
});

export const getBatchStatus = internalQuery({
  args: { batchId: v.id("uploadBatches") },
  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.batchId);
    return batch?.status ?? null;
  },
});

// ── Internal Mutations ────────────────────────────────────

export const markBatchProcessing = internalMutation({
  args: { batchId: v.id("uploadBatches") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.batchId, { status: "processing" as const });
  },
});

export const markBatchCompleted = internalMutation({
  args: { batchId: v.id("uploadBatches") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.batchId, { status: "completed" as const });
  },
});

export const markGroupProcessing = internalMutation({
  args: { groupId: v.id("uploadGroups") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.groupId, {
      processingStatus: "processing" as const,
    });
  },
});

export const markGroupCompleted = internalMutation({
  args: { groupId: v.id("uploadGroups") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.groupId, {
      processingStatus: "completed" as const,
      processedAt: Date.now(),
    });
  },
});

export const markGroupFailed = internalMutation({
  args: { groupId: v.id("uploadGroups"), error: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.groupId, {
      processingStatus: "failed" as const,
    });
  },
});

export const markFileProcessing = internalMutation({
  args: { fileId: v.id("uploadedFiles") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.fileId, { status: "processing" as const });
  },
});

export const markFileFailed = internalMutation({
  args: { fileId: v.id("uploadedFiles"), errorMessage: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.fileId, { status: "failed" as const });
  },
});

export const createExtractedDocument = internalMutation({
  args: {
    fileId: v.id("uploadedFiles"),
    batchId: v.id("uploadBatches"),
    groupId: v.id("uploadGroups"),
    fileName: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("extractedDocuments", {
      fileId: args.fileId,
      batchId: args.batchId,
      groupId: args.groupId,
      fileName: args.fileName,
      extractedData: null,
      status: "pending" as const,
      createdAt: Date.now(),
    });
  },
});

export const saveExtractionResult = internalMutation({
  args: {
    extractDocId: v.id("extractedDocuments"),
    fileId: v.id("uploadedFiles"),
    extractedData: v.any(),
    patientName: v.optional(v.string()),
    mrn: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.extractDocId, {
      extractedData: args.extractedData,
      patientName: args.patientName,
      mrn: args.mrn,
      status: "extracted" as const,
      extractedAt: Date.now(),
    });
    await ctx.db.patch(args.fileId, { status: "completed" as const });
  },
});

export const markExtractionFailed = internalMutation({
  args: {
    extractDocId: v.id("extractedDocuments"),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.extractDocId, {
      status: "failed" as const,
      errorMessage: args.errorMessage,
    });
  },
});

export const linkDocumentToPatient = internalMutation({
  args: {
    extractDocId: v.id("extractedDocuments"),
    patientId: v.id("patients"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.extractDocId, {
      patientId: args.patientId,
      status: "grouped" as const,
    });
  },
});

export const addProcessingLog = internalMutation({
  args: {
    batchId: v.id("uploadBatches"),
    groupId: v.optional(v.id("uploadGroups")),
    fileId: v.optional(v.id("uploadedFiles")),
    level: v.union(v.literal("info"), v.literal("warn"), v.literal("error")),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("processingLogs", {
      batchId: args.batchId,
      groupId: args.groupId,
      fileId: args.fileId,
      level: args.level,
      message: args.message,
      createdAt: Date.now(),
    });
  },
});

// ── Public Control Mutations (user-facing) ────────────────

export const startProcessing = mutation({
  args: {
    token: v.string(),
    batchId: v.id("uploadBatches"),
  },
  handler: async (ctx, args) => {
    await authenticate(ctx, args.token);

    const batch = await ctx.db.get(args.batchId);
    if (!batch) throw new Error("Batch not found");
    if (batch.status !== "queued" && batch.status !== "paused") {
      throw new Error(`Cannot start batch with status "${batch.status}"`);
    }

    await ctx.scheduler.runAfter(
      0,
      internal.processing.startBatchProcessing,
      { batchId: args.batchId }
    );
  },
});

export const pauseProcessing = mutation({
  args: {
    token: v.string(),
    batchId: v.id("uploadBatches"),
  },
  handler: async (ctx, args) => {
    await authenticate(ctx, args.token);

    const batch = await ctx.db.get(args.batchId);
    if (!batch) throw new Error("Batch not found");
    if (batch.status !== "processing") {
      throw new Error(`Cannot pause batch with status "${batch.status}"`);
    }

    await ctx.db.patch(args.batchId, { status: "paused" as const });
  },
});

export const stopProcessing = mutation({
  args: {
    token: v.string(),
    batchId: v.id("uploadBatches"),
  },
  handler: async (ctx, args) => {
    await authenticate(ctx, args.token);

    const batch = await ctx.db.get(args.batchId);
    if (!batch) throw new Error("Batch not found");
    if (batch.status !== "processing" && batch.status !== "paused") {
      throw new Error(`Cannot stop batch with status "${batch.status}"`);
    }

    await ctx.db.patch(args.batchId, { status: "queued" as const });

    // Reset any in-progress groups back to pending
    const groups = await ctx.db
      .query("uploadGroups")
      .withIndex("by_batchId", (q) => q.eq("batchId", args.batchId))
      .collect();

    for (const group of groups) {
      if (group.processingStatus === "processing") {
        await ctx.db.patch(group._id, {
          processingStatus: "pending" as const,
        });
      }
    }
  },
});

export const removeFromQueue = mutation({
  args: {
    token: v.string(),
    batchId: v.id("uploadBatches"),
  },
  handler: async (ctx, args) => {
    await authenticate(ctx, args.token);

    const batch = await ctx.db.get(args.batchId);
    if (!batch) throw new Error("Batch not found");
    if (batch.status !== "queued" && batch.status !== "paused" && batch.status !== "failed") {
      throw new Error(`Cannot remove batch with status "${batch.status}"`);
    }

    // Reset batch back to uploading (dequeue)
    await ctx.db.patch(args.batchId, { status: "uploading" as const });

    // Clear all group processing statuses
    const groups = await ctx.db
      .query("uploadGroups")
      .withIndex("by_batchId", (q) => q.eq("batchId", args.batchId))
      .collect();

    for (const group of groups) {
      if (group.processingStatus) {
        await ctx.db.patch(group._id, {
          processingStatus: undefined,
          processedAt: undefined,
        });
      }
    }
  },
});

export const retryProcessing = mutation({
  args: {
    token: v.string(),
    batchId: v.id("uploadBatches"),
  },
  handler: async (ctx, args) => {
    await authenticate(ctx, args.token);

    const batch = await ctx.db.get(args.batchId);
    if (!batch) throw new Error("Batch not found");
    if (batch.status !== "failed") {
      throw new Error(`Cannot retry batch with status "${batch.status}"`);
    }

    await ctx.db.patch(args.batchId, { status: "queued" as const });

    const groups = await ctx.db
      .query("uploadGroups")
      .withIndex("by_batchId", (q) => q.eq("batchId", args.batchId))
      .collect();

    for (const group of groups) {
      if (group.processingStatus === "failed") {
        await ctx.db.patch(group._id, {
          processingStatus: "pending" as const,
        });
      }
    }

    const files = await ctx.db
      .query("uploadedFiles")
      .withIndex("by_batchId", (q) => q.eq("batchId", args.batchId))
      .collect();

    for (const file of files) {
      if (file.status === "failed") {
        await ctx.db.patch(file._id, { status: "uploaded" as const });
      }
    }
  },
});

// ── Reprocess / Delete Mutations ──────────────────────────

export const reprocessBatch = mutation({
  args: {
    token: v.string(),
    batchId: v.id("uploadBatches"),
  },
  handler: async (ctx, args) => {
    await authenticate(ctx, args.token);

    const batch = await ctx.db.get(args.batchId);
    if (!batch) throw new Error("Batch not found");
    if (batch.status !== "completed" && batch.status !== "failed") {
      throw new Error(`Cannot reprocess batch with status "${batch.status}"`);
    }

    // Collect extracted docs and gather patient IDs for orphan cleanup
    const extractedDocs = await ctx.db
      .query("extractedDocuments")
      .withIndex("by_batchId", (q) => q.eq("batchId", args.batchId))
      .collect();

    const patientIds = new Set<string>();
    for (const doc of extractedDocs) {
      if (doc.patientId) patientIds.add(doc.patientId);
      await ctx.db.delete(doc._id);
    }

    // Delete processing logs
    const logs = await ctx.db
      .query("processingLogs")
      .withIndex("by_batchId", (q) => q.eq("batchId", args.batchId))
      .collect();
    for (const log of logs) {
      await ctx.db.delete(log._id);
    }

    // Reset groups
    const groups = await ctx.db
      .query("uploadGroups")
      .withIndex("by_batchId", (q) => q.eq("batchId", args.batchId))
      .collect();
    for (const group of groups) {
      await ctx.db.patch(group._id, {
        processingStatus: undefined,
        processedAt: undefined,
      });
    }

    // Reset files
    const files = await ctx.db
      .query("uploadedFiles")
      .withIndex("by_batchId", (q) => q.eq("batchId", args.batchId))
      .collect();
    for (const file of files) {
      await ctx.db.patch(file._id, { status: "uploaded" as const });
    }

    // Set batch to queued
    await ctx.db.patch(args.batchId, { status: "queued" as const });

    // Cleanup orphaned patients
    for (const patientId of patientIds) {
      const remaining = await ctx.db
        .query("extractedDocuments")
        .withIndex("by_patientId", (q) => q.eq("patientId", patientId as any))
        .first();
      if (!remaining) {
        await ctx.db.delete(patientId as any);
      }
    }
  },
});

export const deleteGroup = mutation({
  args: {
    token: v.string(),
    groupId: v.id("uploadGroups"),
  },
  handler: async (ctx, args) => {
    await authenticate(ctx, args.token);

    const group = await ctx.db.get(args.groupId);
    if (!group) throw new Error("Group not found");

    const batch = await ctx.db.get(group.batchId);
    if (!batch) throw new Error("Batch not found");
    if (batch.status === "processing") {
      throw new Error("Cannot delete group while batch is processing");
    }

    // Collect extracted docs and gather patient IDs
    const extractedDocs = await ctx.db
      .query("extractedDocuments")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();

    const patientIds = new Set<string>();
    for (const doc of extractedDocs) {
      if (doc.patientId) patientIds.add(doc.patientId);
      await ctx.db.delete(doc._id);
    }

    // Delete processing logs referencing this group
    const logs = await ctx.db
      .query("processingLogs")
      .withIndex("by_batchId", (q) => q.eq("batchId", group.batchId))
      .collect();
    for (const log of logs) {
      if (log.groupId === args.groupId) {
        await ctx.db.delete(log._id);
      }
    }

    // Delete files and their storage blobs
    const files = await ctx.db
      .query("uploadedFiles")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();
    for (const file of files) {
      await ctx.storage.delete(file.storageId);
      await ctx.db.delete(file._id);
    }

    // Delete the group
    await ctx.db.delete(args.groupId);

    // Recalculate batch counts
    const remainingGroups = await ctx.db
      .query("uploadGroups")
      .withIndex("by_batchId", (q) => q.eq("batchId", group.batchId))
      .collect();
    const remainingFiles = await ctx.db
      .query("uploadedFiles")
      .withIndex("by_batchId", (q) => q.eq("batchId", group.batchId))
      .collect();

    if (remainingGroups.length === 0) {
      // No groups left — delete the batch and remaining logs
      const remainingLogs = await ctx.db
        .query("processingLogs")
        .withIndex("by_batchId", (q) => q.eq("batchId", group.batchId))
        .collect();
      for (const log of remainingLogs) {
        await ctx.db.delete(log._id);
      }
      await ctx.db.delete(group.batchId);
    } else {
      await ctx.db.patch(group.batchId, {
        fileCount: remainingFiles.length,
        groupCount: remainingGroups.length,
      });
    }

    // Cleanup orphaned patients
    for (const patientId of patientIds) {
      const remaining = await ctx.db
        .query("extractedDocuments")
        .withIndex("by_patientId", (q) => q.eq("patientId", patientId as any))
        .first();
      if (!remaining) {
        await ctx.db.delete(patientId as any);
      }
    }
  },
});

export const deleteBatch = mutation({
  args: {
    token: v.string(),
    batchId: v.id("uploadBatches"),
  },
  handler: async (ctx, args) => {
    await authenticate(ctx, args.token);

    const batch = await ctx.db.get(args.batchId);
    if (!batch) throw new Error("Batch not found");
    if (batch.status === "processing") {
      throw new Error("Cannot delete batch while it is processing");
    }

    // Collect extracted docs and gather patient IDs
    const extractedDocs = await ctx.db
      .query("extractedDocuments")
      .withIndex("by_batchId", (q) => q.eq("batchId", args.batchId))
      .collect();

    const patientIds = new Set<string>();
    for (const doc of extractedDocs) {
      if (doc.patientId) patientIds.add(doc.patientId);
      await ctx.db.delete(doc._id);
    }

    // Delete files and their storage blobs
    const files = await ctx.db
      .query("uploadedFiles")
      .withIndex("by_batchId", (q) => q.eq("batchId", args.batchId))
      .collect();
    for (const file of files) {
      await ctx.storage.delete(file.storageId);
      await ctx.db.delete(file._id);
    }

    // Delete groups
    const groups = await ctx.db
      .query("uploadGroups")
      .withIndex("by_batchId", (q) => q.eq("batchId", args.batchId))
      .collect();
    for (const group of groups) {
      await ctx.db.delete(group._id);
    }

    // Delete processing logs
    const logs = await ctx.db
      .query("processingLogs")
      .withIndex("by_batchId", (q) => q.eq("batchId", args.batchId))
      .collect();
    for (const log of logs) {
      await ctx.db.delete(log._id);
    }

    // Delete the batch
    await ctx.db.delete(args.batchId);

    // Cleanup orphaned patients
    for (const patientId of patientIds) {
      const remaining = await ctx.db
        .query("extractedDocuments")
        .withIndex("by_patientId", (q) => q.eq("patientId", patientId as any))
        .first();
      if (!remaining) {
        await ctx.db.delete(patientId as any);
      }
    }
  },
});

// ── Public Queries ────────────────────────────────────────

export const getBatchLogs = query({
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
      .query("processingLogs")
      .withIndex("by_batchId", (q) => q.eq("batchId", args.batchId))
      .collect();
  },
});

export const getBatchSummary = query({
  args: {
    token: v.string(),
    batchId: v.id("uploadBatches"),
  },
  handler: async (ctx, args) => {
    if (!args.token) return null;

    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q: any) => q.eq("token", args.token))
      .unique();
    if (!session || session.expiresAt < Date.now()) return null;

    const batch = await ctx.db.get(args.batchId);
    if (!batch) return null;

    const groups = await ctx.db
      .query("uploadGroups")
      .withIndex("by_batchId", (q) => q.eq("batchId", args.batchId))
      .collect();

    const files = await ctx.db
      .query("uploadedFiles")
      .withIndex("by_batchId", (q) => q.eq("batchId", args.batchId))
      .collect();

    const extractedDocs = await ctx.db
      .query("extractedDocuments")
      .withIndex("by_batchId", (q) => q.eq("batchId", args.batchId))
      .collect();

    const patientsLinked = new Set(
      extractedDocs
        .filter((d) => d.patientId)
        .map((d) => d.patientId!.toString())
    );

    return {
      status: batch.status,
      totalGroups: groups.length,
      completedGroups: groups.filter((g) => g.processingStatus === "completed").length,
      failedGroups: groups.filter((g) => g.processingStatus === "failed").length,
      totalFiles: files.length,
      completedFiles: files.filter((f) => f.status === "completed").length,
      failedFiles: files.filter((f) => f.status === "failed").length,
      totalExtracted: extractedDocs.length,
      successfulExtractions: extractedDocs.filter((d) => d.status === "grouped" || d.status === "extracted").length,
      failedExtractions: extractedDocs.filter((d) => d.status === "failed").length,
      patientsFound: patientsLinked.size,
    };
  },
});

export const getProcessingProgress = query({
  args: {
    token: v.string(),
    batchId: v.id("uploadBatches"),
  },
  handler: async (ctx, args) => {
    if (!args.token) return null;

    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q: any) => q.eq("token", args.token))
      .unique();
    if (!session || session.expiresAt < Date.now()) return null;

    const groups = await ctx.db
      .query("uploadGroups")
      .withIndex("by_batchId", (q) => q.eq("batchId", args.batchId))
      .collect();

    const totalGroups = groups.length;
    const completedGroups = groups.filter(
      (g) => g.processingStatus === "completed"
    ).length;
    const currentGroup = groups.find(
      (g) => g.processingStatus === "processing"
    );
    const failedGroups = groups.filter(
      (g) => g.processingStatus === "failed"
    ).length;

    return {
      totalGroups,
      completedGroups,
      failedGroups,
      currentGroupNumber: currentGroup?.groupNumber ?? null,
    };
  },
});
