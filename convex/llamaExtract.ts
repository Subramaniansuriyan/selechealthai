// LlamaExtract Cloud API utility — imported by processing.ts actions
// No Convex runtime dependencies — pure fetch-based API wrapper

const LLAMA_API_BASE = "https://api.cloud.llamaindex.ai/api/v1";

function getApiKey(): string {
  const key = process.env.LLAMA_CLOUD_API_KEY;
  if (!key) throw new Error("LLAMA_CLOUD_API_KEY environment variable not set");
  return key;
}

function jsonHeaders(): Record<string, string> {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${getApiKey()}`,
    "Content-Type": "application/json",
  };
}

// JSON Schema for medical document extraction — defines what LlamaExtract
// should agentic-ally pull from each document
const MEDICAL_DOCUMENT_SCHEMA = {
  type: "object",
  properties: {
    patient_name: {
      anyOf: [{ type: "string" }, { type: "null" }],
      description:
        "Full name of the patient. Look for it in headers, labels like 'Patient:', 'Name:', 'Patient Name:', chart headers, or any identifying area of the document. For medication lists, check the top/header area.",
    },
    mrn: {
      anyOf: [{ type: "string" }, { type: "null" }],
      description:
        "Medical Record Number (MRN). Look for labels like 'MRN:', 'MRN#', 'Medical Record Number:', 'Chart No:', 'Chart #:', 'Acct#:', 'Account:', 'Patient ID:', 'ID#:'. Return ONLY the numeric/alphanumeric identifier, not the label.",
    },
    date_of_birth: {
      anyOf: [{ type: "string" }, { type: "null" }],
      description: "Patient date of birth in any format found (e.g., MM/DD/YYYY, YYYY-MM-DD)",
    },
    document_type: {
      type: "string",
      description:
        "Type of medical document (e.g., Progress Note, OASIS, Plan of Care, Assessment, Discharge Summary, Medication List, Referral, Lab Results, Face Sheet)",
    },
    document_date: {
      anyOf: [{ type: "string" }, { type: "null" }],
      description: "Date of the document or visit",
    },
    provider_name: {
      anyOf: [{ type: "string" }, { type: "null" }],
      description: "Name of the healthcare provider or clinician",
    },
    diagnoses: {
      type: "array",
      description: "List of diagnoses mentioned in the document",
      items: {
        type: "object",
        properties: {
          description: { type: "string", description: "Diagnosis description" },
          icd_code: {
            anyOf: [{ type: "string" }, { type: "null" }],
            description: "ICD-10 code if mentioned",
          },
        },
      },
    },
    pages: {
      type: "array",
      description:
        "Extract text content page by page. Each element represents one page of the document, in order. For single-page documents, return an array with one element.",
      items: {
        type: "object",
        properties: {
          page_number: {
            type: "integer",
            description: "1-based page number (1 for first page, 2 for second, etc.)",
          },
          content: {
            type: "string",
            description:
              "Complete extracted text content of this specific page, preserving all sections, notes, and details found on this page",
          },
        },
      },
    },
    full_content: {
      type: "string",
      description:
        "Complete extracted text content of the entire document, preserving all sections, notes, and details",
    },
  },
};

/**
 * Create a reusable extraction agent with our medical document schema.
 * Returns the agent ID to use for all subsequent extractions in this batch.
 */
export async function createExtractionAgent(): Promise<string> {
  const response = await fetch(
    `${LLAMA_API_BASE}/extraction/extraction-agents`,
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        name: `selectrcm_medical_extractor_${Date.now()}`,
        data_schema: MEDICAL_DOCUMENT_SCHEMA,
        config: {
          extraction_target: "PER_DOC",
          extraction_mode: "MULTIMODAL",
          cite_sources: true,
          use_reasoning: true,
        },
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Failed to create extraction agent: ${response.status} ${text}`
    );
  }

  const data = await response.json();
  return data.id;
}

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
    case "doc":
      return "application/msword";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    default:
      return "application/octet-stream";
  }
}

/**
 * Upload a file blob to LlamaCloud storage.
 * Returns the LlamaCloud file ID.
 */
export async function uploadFileToLlama(
  blob: Blob,
  fileName: string
): Promise<string> {
  // Convert to a File object so Node.js FormData correctly includes
  // the filename in the Content-Disposition multipart header.
  // (Blob alone doesn't carry a name, causing "error parsing the body" on the server.)
  const arrayBuffer = await blob.arrayBuffer();
  const mimeType = blob.type || guessMimeType(fileName);
  const file = new File([arrayBuffer], fileName, { type: mimeType });

  const formData = new FormData();
  formData.append("upload_file", file);

  const response = await fetch(`${LLAMA_API_BASE}/files`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${getApiKey()}`,
      // Do NOT set Content-Type — fetch sets it with multipart boundary
    },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Failed to upload file to LlamaExtract: ${response.status} ${text}`
    );
  }

  const data = await response.json();
  return data.id;
}

/**
 * Start an extraction job for a file using an existing agent.
 * Returns the job ID.
 */
export async function startExtractionJob(
  agentId: string,
  fileId: string
): Promise<string> {
  const response = await fetch(`${LLAMA_API_BASE}/extraction/jobs`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({
      extraction_agent_id: agentId,
      file_id: fileId,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Failed to start extraction job: ${response.status} ${text}`
    );
  }

  const data = await response.json();
  return data.id;
}

/**
 * Check the current status of an extraction job.
 * Returns "SUCCESS", "FAILED", or "PENDING" (covers PENDING/PROCESSING).
 */
export async function checkJobStatus(
  jobId: string
): Promise<{ status: "SUCCESS" | "FAILED" | "PENDING"; error?: string }> {
  const response = await fetch(
    `${LLAMA_API_BASE}/extraction/jobs/${jobId}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${getApiKey()}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to poll job status: ${response.status}`);
  }

  const data = await response.json();

  if (data.status === "SUCCESS") return { status: "SUCCESS" };
  if (data.status === "FAILED") {
    return { status: "FAILED", error: `LlamaExtract job failed: ${JSON.stringify(data)}` };
  }

  return { status: "PENDING" };
}

/**
 * Retrieve the extraction results for a completed job.
 */
export async function getJobResults(jobId: string): Promise<any> {
  const response = await fetch(
    `${LLAMA_API_BASE}/extraction/jobs/${jobId}/result`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${getApiKey()}`,
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Failed to get job results: ${response.status} ${text}`
    );
  }

  return await response.json();
}

/**
 * Delete an extraction agent to avoid accumulating unused agents.
 */
export async function deleteExtractionAgent(agentId: string): Promise<void> {
  try {
    await fetch(
      `${LLAMA_API_BASE}/extraction/extraction-agents/${agentId}`,
      {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${getApiKey()}`,
        },
      }
    );
  } catch {
    // Best-effort cleanup — don't fail the batch if agent deletion fails
  }
}

/**
 * Parse the extraction result from the LlamaExtract API.
 * The job result endpoint can return various formats:
 *   - { data: { ...fields } }                    (direct result)
 *   - { extraction_results: [{ data: {...} }] }   (runs array)
 *   - [{ data: {...} }]                            (array of runs)
 * We normalize to a flat extracted-data object.
 */
function parseExtractionResult(result: any): any {
  // Case: result has a top-level data object with our schema fields
  if (result?.data && typeof result.data === "object" && !Array.isArray(result.data)) {
    return result.data;
  }

  // Case: extraction_results array
  if (Array.isArray(result?.extraction_results) && result.extraction_results.length > 0) {
    const run = result.extraction_results[0];
    return run?.data ?? run;
  }

  // Case: result itself is an array of runs
  if (Array.isArray(result) && result.length > 0) {
    const run = result[0];
    return run?.data ?? run;
  }

  // Case: result has extracted_data
  if (result?.extracted_data) {
    return result.extracted_data;
  }

  // Fallback: result itself is the data
  return result;
}

/**
 * Start extraction for a single file: upload + kick off job.
 * Returns the jobId for scheduler-based polling.
 */
export async function startFileExtraction(
  blob: Blob,
  fileName: string,
  agentId: string
): Promise<string> {
  const llamaFileId = await uploadFileToLlama(blob, fileName);
  const jobId = await startExtractionJob(agentId, llamaFileId);
  return jobId;
}

/**
 * Retrieve and parse extraction results for a completed job.
 * Call this only after checkJobStatus returns SUCCESS.
 */
export async function getExtractedFileData(jobId: string): Promise<{
  extractedData: any;
  patientName: string | undefined;
  mrn: string | undefined;
}> {
  const result = await getJobResults(jobId);
  const extractedData = parseExtractionResult(result);

  const rawName = extractedData?.patient_name;
  const rawMrn = extractedData?.mrn;
  const patientName = rawName && rawName !== "null" ? String(rawName).trim() : undefined;
  const mrn = rawMrn && rawMrn !== "null" ? String(rawMrn).trim() : undefined;

  return { extractedData, patientName, mrn };
}
