"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { extractDocumentWithOpenAI } from "./openaiExtract";

/**
 * Check if batch is still in "processing" state.
 * Returns false if paused, stopped, or otherwise not processing.
 */
async function isBatchStillProcessing(
  ctx: any,
  batchId: any
): Promise<boolean> {
  const status = await ctx.runQuery(
    internal.processingHelpers.getBatchStatus,
    { batchId }
  );
  return status === "processing";
}

/**
 * Entry point: triggered manually by user clicking "Start" or "Resume".
 * Kicks off group-by-group processing using OpenAI extraction.
 */
export const startBatchProcessing = internalAction({
  args: { batchId: v.id("uploadBatches") },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.processingHelpers.markBatchProcessing, {
      batchId: args.batchId,
    });

    await ctx.runMutation(internal.processingHelpers.addProcessingLog, {
      batchId: args.batchId,
      level: "info",
      message: "Batch processing started (OpenAI extraction)",
    });

    const group = await ctx.runQuery(
      internal.processingHelpers.getNextUnprocessedGroup,
      { batchId: args.batchId }
    );

    if (!group) {
      await ctx.runMutation(internal.processingHelpers.markBatchCompleted, {
        batchId: args.batchId,
      });
      return;
    }

    await ctx.scheduler.runAfter(0, internal.processing.processGroup, {
      batchId: args.batchId,
      groupId: group._id,
    });
  },
});

/**
 * Process a single group: marks it processing, then chains to first file.
 */
export const processGroup = internalAction({
  args: {
    batchId: v.id("uploadBatches"),
    groupId: v.id("uploadGroups"),
  },
  handler: async (ctx, args) => {
    if (!(await isBatchStillProcessing(ctx, args.batchId))) {
      await ctx.runMutation(internal.processingHelpers.addProcessingLog, {
        batchId: args.batchId,
        groupId: args.groupId,
        level: "info",
        message: "Processing paused/stopped before group started",
      });
      return;
    }

    await ctx.runMutation(internal.processingHelpers.markGroupProcessing, {
      groupId: args.groupId,
    });

    const files = await ctx.runQuery(
      internal.processingHelpers.getFilesForGroup,
      { groupId: args.groupId }
    );

    await ctx.runMutation(internal.processingHelpers.addProcessingLog, {
      batchId: args.batchId,
      groupId: args.groupId,
      level: "info",
      message: `Processing group with ${files.length} file(s)`,
    });

    const firstFile = files.find((f) => f.status === "uploaded");
    if (!firstFile) {
      await ctx.runMutation(internal.processingHelpers.markGroupCompleted, {
        groupId: args.groupId,
      });
      await ctx.scheduler.runAfter(0, internal.processing.groupPatientsByMRN, {
        batchId: args.batchId,
        groupId: args.groupId,
      });
      return;
    }

    await ctx.scheduler.runAfter(0, internal.processing.processOneFile, {
      batchId: args.batchId,
      groupId: args.groupId,
      fileId: firstFile._id,
    });
  },
});

/**
 * Extract a SINGLE file using OpenAI GPT-4o — single API call, no polling.
 * Then chain to the next file or grouping.
 */
export const processOneFile = internalAction({
  args: {
    batchId: v.id("uploadBatches"),
    groupId: v.id("uploadGroups"),
    fileId: v.id("uploadedFiles"),
  },
  handler: async (ctx, args) => {
    if (!(await isBatchStillProcessing(ctx, args.batchId))) {
      await ctx.runMutation(internal.processingHelpers.addProcessingLog, {
        batchId: args.batchId,
        groupId: args.groupId,
        level: "info",
        message: "Processing paused/stopped",
      });
      return;
    }

    const file = await ctx.runQuery(internal.processingHelpers.getFile, {
      fileId: args.fileId,
    });
    if (!file) return;

    // Safety: skip if file is already completed or failed (prevents retry loops)
    if (file.status === "completed" || file.status === "failed") {
      await scheduleNextFileOrGrouping(ctx, args);
      return;
    }

    const extractDocId = await ctx.runMutation(
      internal.processingHelpers.createExtractedDocument,
      {
        fileId: file._id,
        batchId: args.batchId,
        groupId: args.groupId,
        fileName: file.fileName,
      }
    );

    try {
      await ctx.runMutation(internal.processingHelpers.markFileProcessing, {
        fileId: file._id,
      });

      const blob = await ctx.storage.get(file.storageId);
      if (!blob) {
        throw new Error(`File not found in storage: ${file.storageId}`);
      }

      // Direct extraction — single OpenAI call, no polling
      const { extractedData, patientName, mrn } =
        await extractDocumentWithOpenAI(blob, file.fileName);

      console.log(
        `[Extract] ${file.fileName}: patientName=${patientName}, mrn=${mrn}, keys=${Object.keys(extractedData ?? {}).join(",")}`
      );

      await ctx.runMutation(internal.processingHelpers.saveExtractionResult, {
        extractDocId,
        fileId: file._id,
        extractedData,
        patientName,
        mrn,
      });

      await ctx.runMutation(internal.processingHelpers.addProcessingLog, {
        batchId: args.batchId,
        groupId: args.groupId,
        fileId: file._id,
        level: "info",
        message: `Extracted: ${file.fileName}${mrn ? ` (MRN: ${mrn})` : ""}${patientName ? ` (Patient: ${patientName})` : ""}`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";

      await ctx.runMutation(internal.processingHelpers.markExtractionFailed, {
        extractDocId,
        errorMessage: message,
      });
      await ctx.runMutation(internal.processingHelpers.markFileFailed, {
        fileId: file._id,
        errorMessage: message,
      });
      await ctx.runMutation(internal.processingHelpers.addProcessingLog, {
        batchId: args.batchId,
        groupId: args.groupId,
        fileId: file._id,
        level: "error",
        message: `Failed to extract ${file.fileName}: ${message}`,
      });
    }

    // Continue to next file or grouping
    await scheduleNextFileOrGrouping(ctx, args);
  },
});

/**
 * Helper: find next unprocessed file in group, or chain to grouping.
 * Only picks up files with status "uploaded" — failed files are NOT retried.
 */
async function scheduleNextFileOrGrouping(
  ctx: any,
  args: { batchId: any; groupId: any; fileId: any }
) {
  const allFiles = await ctx.runQuery(
    internal.processingHelpers.getFilesForGroup,
    { groupId: args.groupId }
  );
  const nextFile = allFiles.find(
    (f: any) => f._id !== args.fileId && f.status === "uploaded"
  );

  if (nextFile) {
    await ctx.scheduler.runAfter(0, internal.processing.processOneFile, {
      batchId: args.batchId,
      groupId: args.groupId,
      fileId: nextFile._id,
    });
  } else {
    await ctx.runMutation(internal.processingHelpers.markGroupCompleted, {
      groupId: args.groupId,
    });
    await ctx.scheduler.runAfter(0, internal.processing.groupPatientsByMRN, {
      batchId: args.batchId,
      groupId: args.groupId,
    });
  }
}

/**
 * After extraction, group ALL files in the upload group under a single patient.
 * Strategy:
 *   1. Scan extracted data to find the file that contains an MRN.
 *   2. Use that file's MRN (and patient name) as the canonical patient identity.
 *   3. Link ALL files in the group to that one patient.
 *   4. If no file has MRN but some have a patient name, fall back to name-based grouping.
 */
export const groupPatientsByMRN = internalAction({
  args: {
    batchId: v.id("uploadBatches"),
    groupId: v.id("uploadGroups"),
  },
  handler: async (ctx, args) => {
    const docs = await ctx.runQuery(
      internal.processingHelpers.getExtractedDocsForGroup,
      { groupId: args.groupId }
    );

    const extractedDocs = docs.filter((d) => d.status === "extracted");

    const mrnSource = extractedDocs.find((doc) => {
      if (doc.mrn) return true;
      if (doc.extractedData?.mrn) return true;
      return false;
    });

    const canonicalMrn =
      mrnSource?.mrn || mrnSource?.extractedData?.mrn || undefined;
    const canonicalName =
      mrnSource?.patientName ||
      mrnSource?.extractedData?.patient_name ||
      undefined;

    const nameSource = !canonicalMrn
      ? extractedDocs.find(
          (doc) => doc.patientName || doc.extractedData?.patient_name
        )
      : undefined;
    const fallbackName =
      nameSource?.patientName ||
      nameSource?.extractedData?.patient_name ||
      undefined;

    let patientId;

    if (canonicalMrn) {
      const patientName = canonicalName ?? fallbackName ?? "Unknown";
      patientId = await ctx.runMutation(
        internal.patients.findOrCreateByMRN,
        { mrn: canonicalMrn, patientName }
      );
    } else if (canonicalName || fallbackName) {
      patientId = await ctx.runMutation(
        internal.patients.findOrCreateByNameFallback,
        { patientName: (canonicalName || fallbackName)! }
      );
    }

    let linkedCount = 0;
    for (const doc of extractedDocs) {
      if (patientId) {
        await ctx.runMutation(
          internal.processingHelpers.linkDocumentToPatient,
          { extractDocId: doc._id, patientId }
        );
        linkedCount++;
      }
    }

    const logParts: string[] = [
      `Patient grouping completed — ${linkedCount}/${extractedDocs.length} file(s) linked`,
    ];
    if (canonicalMrn) {
      logParts.push(`MRN: ${canonicalMrn} (from ${mrnSource?.fileName})`);
    }
    if (canonicalName || fallbackName) {
      logParts.push(`Patient: ${canonicalName || fallbackName}`);
    }
    if (!patientId) {
      logParts.push(
        "No MRN or patient name found in any file — files left unlinked"
      );
    }

    await ctx.runMutation(internal.processingHelpers.addProcessingLog, {
      batchId: args.batchId,
      groupId: args.groupId,
      level: patientId ? "info" : "warn",
      message: logParts.join(" | "),
    });

    await ctx.scheduler.runAfter(0, internal.processing.continueNextGroup, {
      batchId: args.batchId,
    });
  },
});

/**
 * Find the next unprocessed group and continue, or mark the batch complete.
 */
export const continueNextGroup = internalAction({
  args: {
    batchId: v.id("uploadBatches"),
  },
  handler: async (ctx, args) => {
    if (!(await isBatchStillProcessing(ctx, args.batchId))) {
      await ctx.runMutation(internal.processingHelpers.addProcessingLog, {
        batchId: args.batchId,
        level: "info",
        message: "Processing chain stopped (batch paused/stopped by user)",
      });
      return;
    }

    const group = await ctx.runQuery(
      internal.processingHelpers.getNextUnprocessedGroup,
      { batchId: args.batchId }
    );

    if (group) {
      await ctx.scheduler.runAfter(0, internal.processing.processGroup, {
        batchId: args.batchId,
        groupId: group._id,
      });
    } else {
      await ctx.runMutation(internal.processingHelpers.markBatchCompleted, {
        batchId: args.batchId,
      });
      await ctx.runMutation(internal.processingHelpers.addProcessingLog, {
        batchId: args.batchId,
        level: "info",
        message: "Batch processing completed",
      });
    }
  },
});
