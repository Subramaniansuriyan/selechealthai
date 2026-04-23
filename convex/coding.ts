"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { runCodingAgent } from "./codingAgent";

// Max chars per document to avoid exceeding token limits
// OASIS documents are typically much larger (24+ pages), so we allow more content
const MAX_CONTENT_PER_DOC = 15000;

/**
 * Internal action: runs the Mastra AI coding agent for a patient.
 * Gathers all extracted documents, concatenates their content,
 * sends to GPT-4o via Mastra, and stores the structured result.
 */
export const runCoding = internalAction({
  args: {
    patientId: v.id("patients"),
    codingResultId: v.id("codingResults"),
  },
  handler: async (ctx, args) => {
    // 1. Mark as coding
    await ctx.runMutation(internal.codingHelpers.markCoding, {
      codingResultId: args.codingResultId,
    });

    try {
      // 2. Fetch all extracted documents for this patient
      const documents = await ctx.runQuery(
        internal.codingHelpers.getPatientDocumentContents,
        { patientId: args.patientId }
      );

      if (documents.length === 0) {
        throw new Error("No extracted documents found for this patient");
      }

      // 3. Build the source document references
      const sourceDocuments = documents.map((doc) => ({
        documentId: doc.documentId,
        fileName: doc.fileName,
        documentType: doc.documentType,
      }));

      // 4. Build the prompt content from all documents
      const documentContents = documents
        .map((doc, i) => {
          const data = doc.extractedData;
          const sections: string[] = [
            `=== DOCUMENT ${i + 1}: ${doc.fileName} ===`,
          ];

          if (data?.document_type) sections.push(`Type: ${data.document_type}`);
          if (data?.document_date) sections.push(`Date: ${data.document_date}`);
          if (data?.provider_name) sections.push(`Provider: ${data.provider_name}`);
          if (data?.patient_name) sections.push(`Patient: ${data.patient_name}`);
          if (data?.date_of_birth) sections.push(`DOB: ${data.date_of_birth}`);

          if (data?.diagnoses && Array.isArray(data.diagnoses)) {
            sections.push("Diagnoses:");
            for (const dx of data.diagnoses) {
              sections.push(
                `  - ${dx.description}${dx.icd_code ? ` (${dx.icd_code})` : ""}`
              );
            }
          }

          // Prefer page-level content with explicit page markers
          if (data?.pages && Array.isArray(data.pages) && data.pages.length > 0) {
            let totalChars = 0;
            sections.push(`\nDocument Content (${data.pages.length} pages):`);
            for (const page of data.pages) {
              const pageNum = page.page_number ?? "?";
              const pageContent = page.content ?? "";
              if (totalChars + pageContent.length > MAX_CONTENT_PER_DOC) {
                const remaining = MAX_CONTENT_PER_DOC - totalChars;
                if (remaining > 100) {
                  sections.push(`\n--- Page ${pageNum} ---\n${pageContent.slice(0, remaining)}\n[...truncated]`);
                }
                break;
              }
              sections.push(`\n--- Page ${pageNum} ---\n${pageContent}`);
              totalChars += pageContent.length;
            }
          } else if (data?.full_content) {
            // Fallback for older extracted docs without page-level content
            const content =
              data.full_content.length > MAX_CONTENT_PER_DOC
                ? data.full_content.slice(0, MAX_CONTENT_PER_DOC) + "\n[...truncated]"
                : data.full_content;
            sections.push(`\nFull Content:\n${content}`);
          }

          return sections.join("\n");
        })
        .join("\n\n");

      // 5. Detect whether any OASIS documents are present
      const hasOasisDocument = documents.some((doc) => {
        const docType = (doc.documentType ?? "").toLowerCase();
        const fileName = (doc.fileName ?? "").toLowerCase();
        return (
          docType.includes("oasis") ||
          fileName.includes("oasis")
        );
      });

      // 6. Run the Mastra coding agent
      const { codingResult } = await runCodingAgent(documentContents, hasOasisDocument);

      // 7. Save the result with source document references
      await ctx.runMutation(internal.codingHelpers.saveCodingResult, {
        codingResultId: args.codingResultId,
        codingData: codingResult,
        sourceDocuments,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      await ctx.runMutation(internal.codingHelpers.markCodingFailed, {
        codingResultId: args.codingResultId,
        errorMessage: message,
      });
    }
  },
});
