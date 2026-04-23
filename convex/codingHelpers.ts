import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { authenticate } from "./authHelpers";

// ── Internal Queries ──────────────────────────────────────

export const getPatientDocumentContents = internalQuery({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("extractedDocuments")
      .withIndex("by_patientId", (q) => q.eq("patientId", args.patientId))
      .collect();

    return docs
      .filter((d) => d.status === "grouped" || d.status === "extracted")
      .map((d) => ({
        documentId: d._id,
        fileName: d.fileName,
        documentType: d.extractedData?.document_type as string | undefined,
        extractedData: d.extractedData,
      }));
  },
});

// ── Internal Mutations ────────────────────────────────────

export const markCoding = internalMutation({
  args: { codingResultId: v.id("codingResults") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.codingResultId, { status: "coding" as const });
  },
});

export const saveCodingResult = internalMutation({
  args: {
    codingResultId: v.id("codingResults"),
    codingData: v.any(),
    sourceDocuments: v.optional(
      v.array(
        v.object({
          documentId: v.id("extractedDocuments"),
          fileName: v.string(),
          documentType: v.optional(v.string()),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.codingResultId, {
      codingData: args.codingData,
      sourceDocuments: args.sourceDocuments,
      status: "completed" as const,
      codedAt: Date.now(),
    });
  },
});

export const markCodingFailed = internalMutation({
  args: {
    codingResultId: v.id("codingResults"),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.codingResultId, {
      status: "failed" as const,
      errorMessage: args.errorMessage,
    });
  },
});

// ── Public Mutations (user-facing) ────────────────────────

export const startCoding = mutation({
  args: {
    token: v.string(),
    patientId: v.id("patients"),
  },
  handler: async (ctx, args) => {
    const user = await authenticate(ctx, args.token);

    const patient = await ctx.db.get(args.patientId);
    if (!patient) throw new Error("Patient not found");

    // Check for extracted documents
    const docs = await ctx.db
      .query("extractedDocuments")
      .withIndex("by_patientId", (q) => q.eq("patientId", args.patientId))
      .collect();
    const extractedDocs = docs.filter(
      (d) => d.status === "grouped" || d.status === "extracted"
    );
    if (extractedDocs.length === 0) {
      throw new Error("No extracted documents for this patient");
    }

    // Check if coding is already in progress
    const existing = await ctx.db
      .query("codingResults")
      .withIndex("by_patientId", (q) => q.eq("patientId", args.patientId))
      .collect();
    const inProgress = existing.find(
      (r) => r.status === "pending" || r.status === "coding"
    );
    if (inProgress) {
      throw new Error("Coding is already in progress for this patient");
    }

    // Delete any prior result (re-code replaces)
    for (const result of existing) {
      await ctx.db.delete(result._id);
    }

    // Create the coding result record
    const codingResultId = await ctx.db.insert("codingResults", {
      patientId: args.patientId,
      status: "pending",
      documentCount: extractedDocs.length,
      modelUsed: "gpt-4o",
      codedBy: user._id,
      createdAt: Date.now(),
    });

    // Schedule the coding action
    await ctx.scheduler.runAfter(0, internal.coding.runCoding, {
      patientId: args.patientId,
      codingResultId,
    });

    return codingResultId;
  },
});

// ── Public Queries ────────────────────────────────────────

export const getCodingResult = query({
  args: {
    token: v.string(),
    patientId: v.id("patients"),
  },
  handler: async (ctx, args) => {
    if (!args.token) return null;

    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q: any) => q.eq("token", args.token))
      .unique();
    if (!session || session.expiresAt < Date.now()) return null;

    const results = await ctx.db
      .query("codingResults")
      .withIndex("by_patientId", (q) => q.eq("patientId", args.patientId))
      .collect();

    if (results.length === 0) return null;

    return results.sort((a, b) => b.createdAt - a.createdAt)[0];
  },
});

export const listCodingActivity = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    if (!args.token) return [];

    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q: any) => q.eq("token", args.token))
      .unique();
    if (!session || session.expiresAt < Date.now()) return [];

    const results = await ctx.db.query("codingResults").collect();

    return await Promise.all(
      results
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(async (result) => {
          const patient = await ctx.db.get(result.patientId);
          const coder = await ctx.db.get(result.codedBy);
          return {
            ...result,
            patientName: patient?.patientName ?? "Unknown",
            mrn: patient?.mrn ?? patient?.fallbackCode ?? "N/A",
            coderName: coder?.name ?? "Unknown",
          };
        })
    );
  },
});
