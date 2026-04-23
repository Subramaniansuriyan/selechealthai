// Pure Zod schema file — no Convex runtime dependencies
// Imported by the Mastra coding action

import { z } from "zod";

const sourceReferenceSchema = z.object({
  documentName: z
    .string()
    .describe("Exact filename of the source document (e.g., 'OASIS_Assessment.pdf')"),
  pageOrSection: z
    .string()
    .describe(
      "Page number (e.g., 'Page 2') or section name (e.g., 'Diagnoses', 'Medication List', 'Plan of Care') where the evidence was found"
    ),
});

const diagnosisSchema = z.object({
  description: z.string().describe("Clinical description of the diagnosis"),
  icdCode: z.string().describe("ICD-10-CM code (e.g., I10, E11.65)"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence score from 0.0 to 1.0"),
  supportingEvidence: z
    .string()
    .describe("Brief quote or reference from the source documents supporting this code"),
  sourceReferences: z
    .array(sourceReferenceSchema)
    .describe("List of source document locations where evidence for this diagnosis was found"),
});

const comboCodeSchema = z.object({
  primaryCode: z.string().describe("Primary ICD-10-CM code (e.g., E11 for Type 2 Diabetes)"),
  primaryDescription: z.string().describe("Description of the primary condition"),
  manifestationCode: z.string().describe("Manifestation or secondary ICD-10-CM code"),
  manifestationDescription: z.string().describe("Description of the manifestation"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence score from 0.0 to 1.0"),
  rationale: z
    .string()
    .describe("Clinical rationale for pairing these codes"),
  sourceReferences: z
    .array(sourceReferenceSchema)
    .describe("List of source document locations where evidence for this combo code was found"),
});

const diseaseEntrySchema = z.object({
  condition: z.string().describe("Name of the disease or condition"),
  icdCode: z.string().describe("ICD-10-CM code"),
  severity: z
    .enum(["mild", "moderate", "severe", "unspecified"])
    .describe("Clinical severity level"),
  acuity: z
    .enum(["acute", "chronic", "acute-on-chronic", "unspecified"])
    .describe("Acuity classification"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence score from 0.0 to 1.0"),
  sourceReferences: z
    .array(sourceReferenceSchema)
    .describe("List of source document locations where evidence for this condition was found"),
});

// ── OASIS Analysis Schema ────────────────────────────────

const oasisFunctionalScoreSchema = z.object({
  item: z.string().describe("OASIS item ID (e.g., M1800, M1860, GG0130A)"),
  label: z.string().describe("Human-readable label (e.g., Grooming, Ambulation/Locomotion)"),
  score: z.number().describe("Numeric score value as recorded in OASIS"),
  scoreDescription: z.string().describe("Text description of what the score means"),
  sourceReferences: z.array(sourceReferenceSchema),
});

const oasisFlagSchema = z.object({
  severity: z.enum(["red", "yellow", "green"]).describe("Flag severity: red = contradiction/critical, yellow = warning/review, green = passes validation"),
  category: z.enum([
    "clinical_consistency",
    "reimbursement_impact",
    "compliance_audit",
    "pdgm_grouping",
    "missed_coding",
  ]).describe("Category of the flag"),
  title: z.string().describe("Short title of the flag (e.g., 'Fall history contradiction')"),
  description: z.string().describe("Detailed explanation of what was found and why it matters"),
  referralValue: z.string().nullable().describe("What the referral document states for this item, or null if not applicable"),
  oasisValue: z.string().nullable().describe("What the OASIS document states for this item, or null if not applicable"),
  recommendation: z.string().describe("Actionable recommendation to resolve the flag"),
  sourceReferences: z.array(sourceReferenceSchema),
});

const oasisMissedCodeSchema = z.object({
  finding: z.string().describe("Clinical finding documented in the records"),
  expectedIcdCode: z.string().describe("ICD-10 code that should be present"),
  expectedDescription: z.string().describe("Description of the expected diagnosis"),
  codedInOasis: z.boolean().describe("Whether this code appears in the OASIS diagnosis list"),
  sourceReferences: z.array(sourceReferenceSchema),
});

const oasisPdgmGroupingSchema = z.object({
  clinicalGroup: z.string().describe("PDGM clinical grouping (e.g., MMTA-Endocrine, Neuro/Rehab)"),
  functionalLevel: z.string().describe("Functional impairment level (Low, Medium, High)"),
  comorbidityTier: z.string().describe("Comorbidity adjustment tier (None, Low, High)"),
  admissionSource: z.enum(["community", "institutional"]).describe("Whether patient was admitted from community or institutional setting"),
  episodeTiming: z.enum(["early", "late"]).describe("Early (first 30 days) or late episode"),
  reimbursementNotes: z.string().describe("Notes on how scores impact reimbursement"),
  sourceReferences: z.array(sourceReferenceSchema),
});

const oasisAnalysisSchema = z.object({
  // Patient summary from OASIS
  oasisSocDate: z.string().nullable().describe("OASIS Start of Care date, or null if not found"),
  certificationPeriod: z.string().nullable().describe("Certification period (e.g., 01/03/2024 - 03/02/2024), or null if not found"),
  primaryDiagnosisOasis: z.string().nullable().describe("Primary diagnosis as coded on OASIS M1021, or null if not found"),

  // Fall risk
  mahcScore: z.number().nullable().describe("MAHC-10 Fall Risk Assessment total score, or null if not found"),
  mahcRiskLevel: z.enum(["low", "high"]).nullable().describe("low if MAHC < 4, high if MAHC >= 4, or null if not assessed"),
  fallHistorySummary: z.string().describe("Summary of fall risk findings from OASIS and referral"),

  // Functional scores
  functionalScores: z.array(oasisFunctionalScoreSchema).describe(
    "Key OASIS functional item scores including M1800 (Grooming), M1810 (Upper Body Dressing), M1820 (Lower Body Dressing), M1830 (Bathing), M1840 (Toilet Transferring), M1845 (Toileting Hygiene), M1850 (Transferring), M1860 (Ambulation/Locomotion), M1870 (Feeding/Eating), M1400 (Dyspnea), and relevant GG items"
  ),

  // Assistive devices
  assistiveDevices: z.array(z.string()).describe("List of assistive devices documented (e.g., Walker, Cane, White Cane, Hospital Bed)"),

  // Cross-validation flags (OASIS vs Referral)
  flags: z.array(oasisFlagSchema).describe(
    "All flags from cross-validating OASIS against referral documents. Include clinical consistency checks, reimbursement impact, compliance/audit risks, PDGM grouping issues, and missed coding opportunities. Flag M1800 if scored 0 (minimum should be 2). Flag M1860 if scored 3-6 to verify assistive device documentation. Flag MAHC >= 4 without fall-related ICD-10 code."
  ),

  // Missed coding opportunities
  missedCodes: z.array(oasisMissedCodeSchema).describe(
    "Diagnoses found in referral or clinical notes that are NOT coded in the OASIS diagnosis list. These represent potential missed coding opportunities that could affect reimbursement or clinical accuracy."
  ),

  // PDGM grouping preview
  pdgmGrouping: oasisPdgmGroupingSchema.describe(
    "Estimated PDGM case-mix classification based on OASIS data"
  ),

  // Narrative summary
  oasisSummary: z.string().describe(
    "Comprehensive narrative summarizing OASIS findings, key flags, functional status, and overall clinical picture compared to referral documentation"
  ),
});

export const homeCodingResultSchema = z.object({
  // M1021 - Primary Diagnosis
  primaryDiagnosis: diagnosisSchema.describe(
    "M1021 Primary Diagnosis — the principal reason for home health services"
  ),

  // Additional diagnoses (M1023+)
  additionalDiagnoses: z
    .array(diagnosisSchema)
    .describe("Additional diagnoses relevant to the home health plan of care, ordered by clinical significance"),

  // Combo codes (paired codes like diabetes + manifestation)
  comboCodes: z
    .array(comboCodeSchema)
    .describe("Combination code pairs where a primary condition must be coded with its manifestation per ICD-10 conventions"),

  // Disease list with severity
  diseaseList: z
    .array(diseaseEntrySchema)
    .describe("Comprehensive list of all active conditions with severity classification"),

  // Overall coding summary
  codingSummary: z.string().describe(
    "Brief narrative summary of the patient's clinical picture and coding rationale"
  ),

  // Overall confidence
  overallConfidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Overall confidence in the coding accuracy, considering document quality and completeness"),

  // OASIS Analysis — null when no OASIS document present, object when present
  oasisAnalysis: oasisAnalysisSchema
    .nullable()
    .describe(
      "Detailed OASIS analysis section. Set to null if NO OASIS documents are present. When OASIS documents exist, populate this as a full structured object with all required fields — NOT as a string."
    ),
});

export type HomeCodingResult = z.infer<typeof homeCodingResultSchema>;
export type OasisAnalysis = z.infer<typeof oasisAnalysisSchema>;
export type OasisFlag = z.infer<typeof oasisFlagSchema>;
