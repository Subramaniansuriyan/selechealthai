// Two-step extraction pipeline:
// Step 1: Unstructured.io — PDF/image → raw text elements with page numbers
// Step 2: OpenAI GPT-4o — raw text → structured medical data (same schema as before)
// No polling, no agents — single pass per file.

"use node";

function getOpenAIKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY environment variable not set");
  return key;
}

function getUnstructuredKey(): string {
  const key = process.env.UNSTRUCTURED_API_KEY;
  if (!key) throw new Error("UNSTRUCTURED_API_KEY environment variable not set");
  return key;
}

const UNSTRUCTURED_API_URL = "https://api.unstructuredapp.io/general/v0/general";

// ── Step 1: Unstructured.io — Parse PDF into text elements ──

interface UnstructuredElement {
  type: string;
  text: string;
  element_id: string;
  metadata: {
    page_number?: number;
    filename?: string;
    filetype?: string;
    [key: string]: any;
  };
}

/**
 * Send a file to Unstructured.io API and get back parsed elements with page numbers.
 * Uses hi_res strategy for best quality on medical documents.
 */
async function parseWithUnstructured(
  blob: Blob,
  fileName: string
): Promise<UnstructuredElement[]> {
  const formData = new FormData();

  // Convert blob to File for proper multipart handling
  const arrayBuffer = await blob.arrayBuffer();
  const mimeType = blob.type || guessMimeType(fileName);
  const file = new File([arrayBuffer], fileName, { type: mimeType });

  formData.append("files", file);
  formData.append("strategy", "hi_res");
  formData.append("languages", "eng");
  formData.append("split_pdf_page", "true");
  formData.append("split_pdf_allow_failed", "true");
  formData.append("split_pdf_concurrency_level", "15");

  const response = await fetch(UNSTRUCTURED_API_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "unstructured-api-key": getUnstructuredKey(),
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Unstructured API failed: ${response.status} ${errorText.slice(0, 500)}`
    );
  }

  const elements: UnstructuredElement[] = await response.json();
  return elements;
}

/**
 * Group Unstructured elements by page number and build page-level text.
 */
function groupElementsByPage(
  elements: UnstructuredElement[]
): { page_number: number; content: string }[] {
  const pageMap = new Map<number, string[]>();

  for (const el of elements) {
    const pageNum = el.metadata?.page_number ?? 1;
    if (!pageMap.has(pageNum)) {
      pageMap.set(pageNum, []);
    }
    pageMap.get(pageNum)!.push(el.text);
  }

  return Array.from(pageMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([page_number, texts]) => ({
      page_number,
      content: texts.join("\n"),
    }));
}

// ── Step 2: OpenAI GPT-4o — Structure the extracted text ──

const EXTRACTION_SYSTEM_PROMPT = `You are a medical document data extractor. You receive raw text extracted from a medical document (organized by page) and must produce structured data.

EXTRACTION RULES:
1. Extract the patient's full name from headers, labels like "Patient:", "Name:", chart headers.
2. Extract the MRN (Medical Record Number) — look for "MRN:", "MRN#", "Chart No:", "Acct#:", "Patient ID:", "ID#:". Return ONLY the identifier, not the label.
3. Extract date of birth in the format found (e.g., MM/DD/YYYY).
4. Classify the document type: Progress Note, OASIS, Plan of Care, Assessment, Discharge Summary, Medication List, Referral, Lab Results, Face Sheet, or other appropriate type.
5. Extract the document/visit date.
6. Extract the provider/clinician name.
7. Extract ALL diagnoses mentioned, with ICD-10 codes if present.
8. The page-level content is already provided — preserve it as-is in the pages array.
9. Produce a full_content field with all page text concatenated.

Be thorough — capture every diagnosis, medication reference, functional status note, and clinical detail. Missing data means missed coding opportunities.`;

const EXTRACTION_SCHEMA = {
  type: "json_schema" as const,
  json_schema: {
    name: "medical_document_extraction",
    strict: true,
    schema: {
      type: "object",
      properties: {
        patient_name: {
          type: ["string", "null"],
          description: "Full name of the patient",
        },
        mrn: {
          type: ["string", "null"],
          description:
            "Medical Record Number — only the identifier, not the label",
        },
        date_of_birth: {
          type: ["string", "null"],
          description: "Patient date of birth in any format found",
        },
        document_type: {
          type: "string",
          description:
            "Type of medical document (e.g., Progress Note, OASIS, Referral, etc.)",
        },
        document_date: {
          type: ["string", "null"],
          description: "Date of the document or visit",
        },
        provider_name: {
          type: ["string", "null"],
          description: "Name of the healthcare provider or clinician",
        },
        diagnoses: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              icd_code: { type: ["string", "null"] },
            },
            required: ["description", "icd_code"],
            additionalProperties: false,
          },
        },
      },
      required: [
        "patient_name",
        "mrn",
        "date_of_birth",
        "document_type",
        "document_date",
        "provider_name",
        "diagnoses",
      ],
      additionalProperties: false,
    },
  },
};

function guessMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "tiff":
    case "tif":
      return "image/tiff";
    default:
      return "application/octet-stream";
  }
}

/**
 * Extract structured medical data from a document.
 * Pipeline: Unstructured.io (PDF → text) → OpenAI GPT-4o (text → structured JSON)
 *
 * Returns the same schema as the old LlamaExtract flow for full compatibility.
 */
export async function extractDocumentWithOpenAI(
  blob: Blob,
  fileName: string
): Promise<{
  extractedData: any;
  patientName: string | undefined;
  mrn: string | undefined;
}> {
  // Step 1: Parse with Unstructured.io
  const elements = await parseWithUnstructured(blob, fileName);

  if (elements.length === 0) {
    throw new Error("Unstructured returned no elements for this document");
  }

  // Group by page
  const pages = groupElementsByPage(elements);
  const fullContent = pages.map((p) => p.content).join("\n\n");

  // Build the prompt with page-level text
  const pageText = pages
    .map((p) => `--- Page ${p.page_number} ---\n${p.content}`)
    .join("\n\n");

  // Step 2: Send to OpenAI for structured extraction
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getOpenAIKey()}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Extract structured data from this medical document "${fileName}".\n\nDocument text by page:\n\n${pageText}`,
        },
      ],
      response_format: EXTRACTION_SCHEMA,
      max_tokens: 4096,
      temperature: 0,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenAI extraction failed: ${response.status} ${errorText.slice(0, 500)}`
    );
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI returned empty content for extraction");
  }

  let structured: any;
  try {
    structured = JSON.parse(content);
  } catch {
    throw new Error(
      `Failed to parse OpenAI extraction JSON: ${content.slice(0, 200)}`
    );
  }

  // Merge: OpenAI structured fields + Unstructured page-level content
  const extractedData = {
    ...structured,
    pages,
    full_content: fullContent,
  };

  const rawName = extractedData.patient_name;
  const rawMrn = extractedData.mrn;
  const patientName =
    rawName && rawName !== "null" ? String(rawName).trim() : undefined;
  const mrn =
    rawMrn && rawMrn !== "null" ? String(rawMrn).trim() : undefined;

  return { extractedData, patientName, mrn };
}
