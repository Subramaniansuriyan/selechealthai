import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    passwordHash: v.string(),
    role: v.union(v.literal("superadmin"), v.literal("manager"), v.literal("staff")),
    name: v.string(),
    createdAt: v.float64(),
  }).index("by_email", ["email"]),

  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.float64(),
  })
    .index("by_token", ["token"])
    .index("by_userId", ["userId"]),

  uploadBatches: defineTable({
    uploadedBy: v.id("users"),
    status: v.union(
      v.literal("uploading"),
      v.literal("queued"),
      v.literal("processing"),
      v.literal("paused"),
      v.literal("completed"),
      v.literal("failed")
    ),
    fileCount: v.float64(),
    groupCount: v.float64(),
    createdAt: v.float64(),
  })
    .index("by_status", ["status"])
    .index("by_createdAt", ["createdAt"]),

  uploadGroups: defineTable({
    batchId: v.id("uploadBatches"),
    groupNumber: v.float64(),
    fileCount: v.float64(),
    createdAt: v.float64(),
    processingStatus: v.optional(v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    )),
    processedAt: v.optional(v.float64()),
  }).index("by_batchId", ["batchId"]),

  uploadedFiles: defineTable({
    batchId: v.id("uploadBatches"),
    groupId: v.id("uploadGroups"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.float64(),
    fileType: v.string(),
    status: v.union(
      v.literal("uploaded"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    uploadedAt: v.float64(),
  })
    .index("by_batchId", ["batchId"])
    .index("by_groupId", ["groupId"]),

  patients: defineTable({
    mrn: v.optional(v.string()),
    patientName: v.string(),
    fallbackCode: v.optional(v.string()),
    createdAt: v.float64(),
  })
    .index("by_mrn", ["mrn"])
    .index("by_patientName", ["patientName"])
    .index("by_fallbackCode", ["fallbackCode"]),

  extractedDocuments: defineTable({
    fileId: v.id("uploadedFiles"),
    batchId: v.id("uploadBatches"),
    groupId: v.id("uploadGroups"),
    patientId: v.optional(v.id("patients")),
    fileName: v.string(),
    extractedData: v.any(),
    patientName: v.optional(v.string()),
    mrn: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("extracting"),
      v.literal("extracted"),
      v.literal("grouped"),
      v.literal("failed")
    ),
    errorMessage: v.optional(v.string()),
    extractedAt: v.optional(v.float64()),
    createdAt: v.float64(),
  })
    .index("by_fileId", ["fileId"])
    .index("by_batchId", ["batchId"])
    .index("by_groupId", ["groupId"])
    .index("by_patientId", ["patientId"])
    .index("by_status", ["status"]),

  invitations: defineTable({
    email: v.string(),
    name: v.string(),
    role: v.union(v.literal("manager"), v.literal("staff")),
    token: v.string(),
    invitedBy: v.id("users"),
    teamId: v.optional(v.id("teams")),
    expiresAt: v.float64(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("expired"),
      v.literal("revoked")
    ),
    createdAt: v.float64(),
  })
    .index("by_token", ["token"])
    .index("by_email", ["email"])
    .index("by_status", ["status"]),

  teams: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.float64(),
  }).index("by_name", ["name"]),

  teamMembers: defineTable({
    teamId: v.id("teams"),
    userId: v.id("users"),
    role: v.union(v.literal("manager"), v.literal("member")),
    addedAt: v.float64(),
  })
    .index("by_teamId", ["teamId"])
    .index("by_userId", ["userId"])
    .index("by_teamId_userId", ["teamId", "userId"]),

  processingLogs: defineTable({
    batchId: v.id("uploadBatches"),
    groupId: v.optional(v.id("uploadGroups")),
    fileId: v.optional(v.id("uploadedFiles")),
    level: v.union(v.literal("info"), v.literal("warn"), v.literal("error")),
    message: v.string(),
    createdAt: v.float64(),
  })
    .index("by_batchId", ["batchId"]),

  codingResults: defineTable({
    patientId: v.id("patients"),
    status: v.union(
      v.literal("pending"),
      v.literal("coding"),
      v.literal("completed"),
      v.literal("failed")
    ),
    codingData: v.optional(v.any()),
    sourceDocuments: v.optional(
      v.array(
        v.object({
          documentId: v.id("extractedDocuments"),
          fileName: v.string(),
          documentType: v.optional(v.string()),
        })
      )
    ),
    documentCount: v.float64(),
    modelUsed: v.string(),
    codedBy: v.id("users"),
    errorMessage: v.optional(v.string()),
    codedAt: v.optional(v.float64()),
    createdAt: v.float64(),
  })
    .index("by_patientId", ["patientId"])
    .index("by_status", ["status"]),

  otpCodes: defineTable({
    userId: v.id("users"),
    code: v.string(),
    expiresAt: v.float64(),
    used: v.boolean(),
    createdAt: v.float64(),
  })
    .index("by_userId", ["userId"]),

  passwordResets: defineTable({
    email: v.string(),
    token: v.string(),
    expiresAt: v.float64(),
    used: v.boolean(),
    createdAt: v.float64(),
  })
    .index("by_token", ["token"])
    .index("by_email", ["email"]),
});
