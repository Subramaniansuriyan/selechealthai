import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

// ── Internal Mutations (called from processing actions) ──

export const findOrCreateByMRN = internalMutation({
  args: {
    mrn: v.string(),
    patientName: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("patients")
      .withIndex("by_mrn", (q) => q.eq("mrn", args.mrn))
      .unique();

    if (existing) return existing._id;

    return await ctx.db.insert("patients", {
      mrn: args.mrn,
      patientName: args.patientName,
      createdAt: Date.now(),
    });
  },
});

export const findOrCreateByNameFallback = internalMutation({
  args: {
    patientName: v.string(),
  },
  handler: async (ctx, args) => {
    // Look for an existing patient with same name that was created via fallback
    const candidates = await ctx.db
      .query("patients")
      .withIndex("by_patientName", (q) =>
        q.eq("patientName", args.patientName)
      )
      .collect();

    const existing = candidates.find((p) => p.fallbackCode && !p.mrn);
    if (existing) return existing._id;

    // Generate fallback code: "{lastname}-{4random}"
    const nameParts = args.patientName.trim().split(/\s+/);
    const lastPart = nameParts[nameParts.length - 1] || "unknown";
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const fallbackCode = `${lastPart.toLowerCase()}-${randomSuffix}`;

    return await ctx.db.insert("patients", {
      patientName: args.patientName,
      fallbackCode,
      createdAt: Date.now(),
    });
  },
});

// ── Public Queries (for the Patient Files page) ──────────

export const listPatients = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    if (!args.token) return [];

    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q: any) => q.eq("token", args.token))
      .unique();

    if (!session || session.expiresAt < Date.now()) return [];

    const patients = await ctx.db.query("patients").collect();

    return await Promise.all(
      patients.map(async (patient) => {
        const docs = await ctx.db
          .query("extractedDocuments")
          .withIndex("by_patientId", (q) =>
            q.eq("patientId", patient._id)
          )
          .collect();

        return {
          ...patient,
          documentCount: docs.length,
          documents: docs.map((d) => ({
            _id: d._id,
            fileName: d.fileName,
            extractedData: d.extractedData,
            extractedAt: d.extractedAt,
            status: d.status,
          })),
        };
      })
    );
  },
});

export const getPatientDocuments = query({
  args: {
    token: v.string(),
    patientId: v.id("patients"),
  },
  handler: async (ctx, args) => {
    if (!args.token) return [];

    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q: any) => q.eq("token", args.token))
      .unique();

    if (!session || session.expiresAt < Date.now()) return [];

    return await ctx.db
      .query("extractedDocuments")
      .withIndex("by_patientId", (q) =>
        q.eq("patientId", args.patientId)
      )
      .collect();
  },
});
