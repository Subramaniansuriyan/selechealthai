import React, { useCallback } from "react"
import { useQuery } from "convex/react"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { ChartConfig } from "@/components/ui/chart"
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  Cell,
  PieChart,
  Pie,
} from "recharts"
import {
  LoaderIcon,
  AlertTriangleIcon,
  BrainCircuitIcon,
  ShieldCheckIcon,
  ActivityIcon,
  TrendingUpIcon,
  AlertCircleIcon,
  ClipboardListIcon,
  FileTextIcon,
  DownloadIcon,
  InfoIcon,
  HeartPulseIcon,
  TriangleAlertIcon,
  CircleCheckIcon,
  CircleAlertIcon,
  FootprintsIcon,
  CrosshairIcon,
  DollarSignIcon,
  SearchIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover"

const SESSION_KEY = "selectrcm_session_token"

function SourceRefs({ refs }: { refs?: any[] }) {
  if (!refs || refs.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {refs.map((ref: any, i: number) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
        >
          <FileTextIcon className="h-2.5 w-2.5" />
          {ref.documentName}
          {ref.pageOrSection && (
            <span className="font-medium text-foreground">
              &middot; {ref.pageOrSection}
            </span>
          )}
        </span>
      ))}
    </div>
  )
}

function confidenceBadge(score: number) {
  const pct = (score * 100).toFixed(0)
  if (score >= 0.9)
    return <Badge variant="default">High ({pct}%)</Badge>
  if (score >= 0.7)
    return <Badge variant="secondary">Good ({pct}%)</Badge>
  if (score >= 0.5)
    return <Badge variant="outline">Moderate ({pct}%)</Badge>
  return <Badge variant="destructive">Low ({pct}%)</Badge>
}

function confidenceColor(score: number) {
  if (score >= 0.9) return "hsl(142, 76%, 36%)"
  if (score >= 0.7) return "hsl(221, 83%, 53%)"
  if (score >= 0.5) return "hsl(38, 92%, 50%)"
  return "hsl(0, 84%, 60%)"
}

// ── OASIS Analysis Section ───────────────────────────────

function flagSeverityIcon(severity: string) {
  if (severity === "red")
    return <TriangleAlertIcon className="h-3.5 w-3.5 text-red-500 shrink-0" />
  if (severity === "yellow")
    return <CircleAlertIcon className="h-3.5 w-3.5 text-amber-500 shrink-0" />
  return <CircleCheckIcon className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
}

function flagSeverityBadge(severity: string) {
  if (severity === "red")
    return <Badge variant="destructive" className="text-[10px]">Critical</Badge>
  if (severity === "yellow")
    return <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600">Review</Badge>
  return <Badge variant="outline" className="text-[10px] border-emerald-400 text-emerald-600">Pass</Badge>
}

function flagCategoryLabel(category: string) {
  const labels: Record<string, string> = {
    clinical_consistency: "Clinical Consistency",
    reimbursement_impact: "Reimbursement Impact",
    compliance_audit: "Compliance / Audit Risk",
    pdgm_grouping: "PDGM Grouping",
    missed_coding: "Missed Coding",
  }
  return labels[category] ?? category
}

function OasisAnalysisSection({ oasis }: { oasis: any }) {
  const redFlags = (oasis.flags ?? []).filter((f: any) => f.severity === "red")
  const yellowFlags = (oasis.flags ?? []).filter((f: any) => f.severity === "yellow")
  const greenFlags = (oasis.flags ?? []).filter((f: any) => f.severity === "green")

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 border-b pb-2">
        <HeartPulseIcon className="h-4 w-4 text-blue-600" />
        <h3 className="text-sm font-semibold">OASIS Analysis</h3>
        {oasis.mahcRiskLevel === "high" && (
          <Badge variant="destructive" className="text-[10px] ml-auto">
            HIGH FALL RISK — MAHC {oasis.mahcScore}
          </Badge>
        )}
      </div>

      {/* OASIS Summary Narrative */}
      {oasis.oasisSummary && (
        <div className="rounded-md border p-3 bg-blue-50/50">
          <p className="text-xs leading-relaxed">{oasis.oasisSummary}</p>
        </div>
      )}

      {/* OASIS Metadata Row */}
      <div className="grid grid-cols-3 gap-3">
        {oasis.oasisSocDate && (
          <div className="rounded-lg border p-2.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block">SOC Date</span>
            <span className="text-sm font-medium">{oasis.oasisSocDate}</span>
          </div>
        )}
        {oasis.certificationPeriod && (
          <div className="rounded-lg border p-2.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block">Cert Period</span>
            <span className="text-sm font-medium">{oasis.certificationPeriod}</span>
          </div>
        )}
        {oasis.primaryDiagnosisOasis && (
          <div className="rounded-lg border p-2.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block">OASIS Primary Dx</span>
            <span className="text-sm font-medium">{oasis.primaryDiagnosisOasis}</span>
          </div>
        )}
      </div>

      {/* Flag Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-red-200 bg-red-50/50 p-2.5 flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <TriangleAlertIcon className="h-3.5 w-3.5 text-red-500" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-red-700">Critical Flags</span>
          </div>
          <span className="text-2xl font-semibold text-red-600">{redFlags.length}</span>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-2.5 flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <CircleAlertIcon className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-amber-700">Review Items</span>
          </div>
          <span className="text-2xl font-semibold text-amber-600">{yellowFlags.length}</span>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-2.5 flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <CircleCheckIcon className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-700">Passed</span>
          </div>
          <span className="text-2xl font-semibold text-emerald-600">{greenFlags.length}</span>
        </div>
      </div>

      {/* Fall Risk */}
      {oasis.mahcScore != null && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <FootprintsIcon className="h-3.5 w-3.5" />
            Fall Risk Assessment
          </h4>
          <div className="rounded-md border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">MAHC-10 Score</span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold">{oasis.mahcScore}</span>
                <Badge variant={oasis.mahcRiskLevel === "high" ? "destructive" : "secondary"} className="text-[10px]">
                  {oasis.mahcRiskLevel === "high" ? "High Risk (≥4)" : "Low Risk (<4)"}
                </Badge>
              </div>
            </div>
            {oasis.fallHistorySummary && (
              <p className="text-xs text-muted-foreground">{oasis.fallHistorySummary}</p>
            )}
          </div>
        </div>
      )}

      {/* Functional Scores */}
      {oasis.functionalScores?.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <ActivityIcon className="h-3.5 w-3.5" />
            Functional Scores
          </h4>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs">Item</TableHead>
                  <TableHead className="text-xs">Label</TableHead>
                  <TableHead className="text-xs text-center">Score</TableHead>
                  <TableHead className="text-xs">Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {oasis.functionalScores.map((fs: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs font-mono font-medium">{fs.item}</TableCell>
                    <TableCell className="text-xs">{fs.label}</TableCell>
                    <TableCell className="text-xs text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs">
                        {fs.score}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fs.scoreDescription}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Assistive Devices */}
      {oasis.assistiveDevices?.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Assistive Devices</h4>
          <div className="flex flex-wrap gap-1.5">
            {oasis.assistiveDevices.map((device: string, i: number) => (
              <Badge key={i} variant="outline" className="text-xs">{device}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Cross-Validation Flags */}
      {oasis.flags?.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <CrosshairIcon className="h-3.5 w-3.5" />
            Cross-Validation Flags
          </h4>
          <div className="flex flex-col gap-2">
            {oasis.flags.map((flag: any, i: number) => (
              <div key={i} className={`rounded-md border p-3 space-y-1.5 ${
                flag.severity === "red" ? "border-red-200 bg-red-50/30" :
                flag.severity === "yellow" ? "border-amber-200 bg-amber-50/30" :
                "border-emerald-200 bg-emerald-50/30"
              }`}>
                <div className="flex items-center gap-2">
                  {flagSeverityIcon(flag.severity)}
                  <span className="text-xs font-medium flex-1">{flag.title}</span>
                  {flagSeverityBadge(flag.severity)}
                  <Badge variant="outline" className="text-[9px]">
                    {flagCategoryLabel(flag.category)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{flag.description}</p>
                {(flag.referralValue || flag.oasisValue) && (
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {flag.referralValue && (
                      <div className="rounded bg-muted/50 px-2 py-1">
                        <span className="text-[10px] font-medium text-muted-foreground block">Referral</span>
                        <span className="text-xs">{flag.referralValue}</span>
                      </div>
                    )}
                    {flag.oasisValue && (
                      <div className="rounded bg-muted/50 px-2 py-1">
                        <span className="text-[10px] font-medium text-muted-foreground block">OASIS</span>
                        <span className="text-xs">{flag.oasisValue}</span>
                      </div>
                    )}
                  </div>
                )}
                <p className="text-xs text-blue-700 font-medium">{flag.recommendation}</p>
                <SourceRefs refs={flag.sourceReferences} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Missed Coding Opportunities */}
      {oasis.missedCodes?.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <SearchIcon className="h-3.5 w-3.5" />
            Missed Coding Opportunities
          </h4>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs">Clinical Finding</TableHead>
                  <TableHead className="text-xs">Expected ICD-10</TableHead>
                  <TableHead className="text-xs">Description</TableHead>
                  <TableHead className="text-xs text-center">In OASIS?</TableHead>
                  <TableHead className="text-xs">Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {oasis.missedCodes.map((mc: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs">{mc.finding}</TableCell>
                    <TableCell className="text-xs font-mono font-medium">{mc.expectedIcdCode}</TableCell>
                    <TableCell className="text-xs">{mc.expectedDescription}</TableCell>
                    <TableCell className="text-xs text-center">
                      {mc.codedInOasis ? (
                        <CircleCheckIcon className="h-3.5 w-3.5 text-emerald-500 mx-auto" />
                      ) : (
                        <TriangleAlertIcon className="h-3.5 w-3.5 text-red-500 mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {mc.sourceReferences?.map((ref: any, j: number) => (
                        <span key={j} className="block text-[10px] text-muted-foreground">
                          {ref.documentName}{ref.pageOrSection ? ` · ${ref.pageOrSection}` : ""}
                        </span>
                      ))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* PDGM Grouping */}
      {oasis.pdgmGrouping && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <DollarSignIcon className="h-3.5 w-3.5" />
            PDGM Grouping Preview
          </h4>
          <div className="rounded-md border p-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <span className="text-[10px] font-medium text-muted-foreground block">Clinical Group</span>
                <span className="text-xs font-medium">{oasis.pdgmGrouping.clinicalGroup}</span>
              </div>
              <div>
                <span className="text-[10px] font-medium text-muted-foreground block">Functional Level</span>
                <span className="text-xs font-medium">{oasis.pdgmGrouping.functionalLevel}</span>
              </div>
              <div>
                <span className="text-[10px] font-medium text-muted-foreground block">Comorbidity Tier</span>
                <span className="text-xs font-medium">{oasis.pdgmGrouping.comorbidityTier}</span>
              </div>
              <div>
                <span className="text-[10px] font-medium text-muted-foreground block">Admission Source</span>
                <Badge variant="outline" className="text-[10px] capitalize">{oasis.pdgmGrouping.admissionSource}</Badge>
              </div>
              <div>
                <span className="text-[10px] font-medium text-muted-foreground block">Episode Timing</span>
                <Badge variant="outline" className="text-[10px] capitalize">{oasis.pdgmGrouping.episodeTiming}</Badge>
              </div>
            </div>
            {oasis.pdgmGrouping.reimbursementNotes && (
              <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">{oasis.pdgmGrouping.reimbursementNotes}</p>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

function ConfidenceExplainer() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors"
          aria-label="What is confidence?"
        >
          <InfoIcon className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-72 text-xs space-y-2 p-3">
        <p className="font-semibold text-sm">How confidence scores work</p>
        <p className="text-muted-foreground">
          Each code is scored based on how well the uploaded documents support it.
        </p>
        <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
          <Badge variant="default" className="text-[10px] w-fit">90-100%</Badge>
          <span className="text-muted-foreground">Clearly documented diagnosis</span>
          <Badge variant="secondary" className="text-[10px] w-fit">70-89%</Badge>
          <span className="text-muted-foreground">Strong indicators, minor inference</span>
          <Badge variant="outline" className="text-[10px] w-fit">50-69%</Badge>
          <span className="text-muted-foreground">Moderate evidence, review suggested</span>
          <Badge variant="destructive" className="text-[10px] w-fit">&lt;50%</Badge>
          <span className="text-muted-foreground">Weak evidence, needs clinical review</span>
        </div>
        <p className="text-muted-foreground">
          Codes below 70% are flagged as &ldquo;Needs Review&rdquo; and should be verified by a coder.
        </p>
      </PopoverContent>
    </Popover>
  )
}

const severityChartConfig: ChartConfig = {
  mild: { label: "Mild", color: "hsl(142, 76%, 36%)" },
  moderate: { label: "Moderate", color: "hsl(38, 92%, 50%)" },
  severe: { label: "Severe", color: "hsl(0, 84%, 60%)" },
  unspecified: { label: "Unspecified", color: "hsl(215, 16%, 57%)" },
}

const acuityChartConfig: ChartConfig = {
  acute: { label: "Acute", color: "hsl(0, 84%, 60%)" },
  chronic: { label: "Chronic", color: "hsl(221, 83%, 53%)" },
  "acute-on-chronic": { label: "Acute-on-Chronic", color: "hsl(280, 68%, 60%)" },
  unspecified: { label: "Unspecified", color: "hsl(215, 16%, 57%)" },
}

const confidenceBarConfig: ChartConfig = {
  confidence: { label: "Confidence", color: "hsl(221, 83%, 53%)" },
}

export function CodingResultsSheet({
  patientId,
  patientName,
  onClose,
}: {
  patientId: Id<"patients"> | null
  patientName: string
  onClose: () => void
}) {
  const token = localStorage.getItem(SESSION_KEY) ?? ""
  const codingResult = useQuery(
    api.codingHelpers.getCodingResult,
    patientId ? { token, patientId } : "skip"
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = codingResult?.codingData as any

  const downloadPdf = useCallback(() => {
    if (!data || !codingResult) return

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 14
    const contentWidth = pageWidth - margin * 2
    let y = 15

    const checkPage = (needed: number) => {
      if (y + needed > doc.internal.pageSize.getHeight() - 15) {
        doc.addPage()
        y = 15
      }
    }

    const confidenceLabel = (score: number) => {
      const pct = (score * 100).toFixed(0)
      if (score >= 0.9) return `High (${pct}%)`
      if (score >= 0.7) return `Good (${pct}%)`
      if (score >= 0.5) return `Moderate (${pct}%)`
      return `Low (${pct}%)`
    }

    const formatSourceRefs = (refs?: any[]) => {
      if (!refs || refs.length === 0) return ""
      return refs.map((r: any) => `${r.documentName}${r.pageOrSection ? ` - ${r.pageOrSection}` : ""}`).join("; ")
    }

    // Title
    doc.setFontSize(16)
    doc.setFont("helvetica", "bold")
    doc.text("AI Coding Results", margin, y)
    y += 7

    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(100)
    doc.text(`Patient: ${patientName}`, margin, y)
    y += 5
    if (codingResult.codedAt) {
      doc.text(`Coded: ${new Date(codingResult.codedAt).toLocaleString()}`, margin, y)
      y += 5
    }
    doc.text(`Documents analyzed: ${codingResult.documentCount ?? "N/A"}`, margin, y)
    y += 8

    // Metrics summary
    doc.setTextColor(0)
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.text("Summary Metrics", margin, y)
    y += 2

    const allDx = [data.primaryDiagnosis, ...(data.additionalDiagnoses ?? [])]
    const allConf = allDx.map((d: any) => d.confidence as number)
    const avg = allConf.reduce((a: number, b: number) => a + b, 0) / allConf.length
    const highCount = allConf.filter((c: number) => c >= 0.9).length
    const reviewCount = allConf.filter((c: number) => c < 0.7).length

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Total Codes", "Avg Confidence", "High Confidence", "Needs Review", "Overall Confidence"]],
      body: [[
        String(allDx.length),
        `${(avg * 100).toFixed(0)}%`,
        String(highCount),
        String(reviewCount),
        confidenceLabel(data.overallConfidence),
      ]],
      theme: "grid",
      headStyles: { fillColor: [41, 98, 255], fontSize: 8 },
      bodyStyles: { fontSize: 9 },
    })
    y = (doc as any).lastAutoTable.finalY + 8

    // Primary Diagnosis
    checkPage(30)
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.text("Primary Diagnosis (M1021)", margin, y)
    y += 2

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["ICD-10", "Description", "Confidence", "Supporting Evidence", "Source"]],
      body: [[
        data.primaryDiagnosis.icdCode,
        data.primaryDiagnosis.description,
        confidenceLabel(data.primaryDiagnosis.confidence),
        data.primaryDiagnosis.supportingEvidence,
        formatSourceRefs(data.primaryDiagnosis.sourceReferences),
      ]],
      theme: "grid",
      headStyles: { fillColor: [41, 98, 255], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 18 },
        3: { cellWidth: 50 },
        4: { cellWidth: 35 },
      },
    })
    y = (doc as any).lastAutoTable.finalY + 8

    // Additional Diagnoses
    if (data.additionalDiagnoses?.length > 0) {
      checkPage(20)
      doc.setFontSize(11)
      doc.setFont("helvetica", "bold")
      doc.text("Additional Diagnoses", margin, y)
      y += 2

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [["ICD-10", "Description", "Confidence", "Supporting Evidence", "Source"]],
        body: data.additionalDiagnoses.map((dx: any) => [
          dx.icdCode,
          dx.description,
          confidenceLabel(dx.confidence),
          dx.supportingEvidence,
          formatSourceRefs(dx.sourceReferences),
        ]),
        theme: "grid",
        headStyles: { fillColor: [41, 98, 255], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 18 },
          3: { cellWidth: 50 },
          4: { cellWidth: 35 },
        },
      })
      y = (doc as any).lastAutoTable.finalY + 8
    }

    // Combo Codes
    if (data.comboCodes?.length > 0) {
      checkPage(20)
      doc.setFontSize(11)
      doc.setFont("helvetica", "bold")
      doc.text("Combination Codes", margin, y)
      y += 2

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [["Primary Code", "Primary Description", "Manifestation Code", "Manifestation Description", "Confidence", "Rationale", "Source"]],
        body: data.comboCodes.map((c: any) => [
          c.primaryCode,
          c.primaryDescription,
          c.manifestationCode,
          c.manifestationDescription,
          confidenceLabel(c.confidence),
          c.rationale,
          formatSourceRefs(c.sourceReferences),
        ]),
        theme: "grid",
        headStyles: { fillColor: [41, 98, 255], fontSize: 7 },
        bodyStyles: { fontSize: 7 },
      })
      y = (doc as any).lastAutoTable.finalY + 8
    }

    // Disease List
    if (data.diseaseList?.length > 0) {
      checkPage(20)
      doc.setFontSize(11)
      doc.setFont("helvetica", "bold")
      doc.text("Disease List", margin, y)
      y += 2

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [["Condition", "ICD-10", "Severity", "Acuity", "Confidence", "Source"]],
        body: data.diseaseList.map((e: any) => [
          e.condition,
          e.icdCode,
          e.severity,
          e.acuity,
          `${(e.confidence * 100).toFixed(0)}%`,
          formatSourceRefs(e.sourceReferences),
        ]),
        theme: "grid",
        headStyles: { fillColor: [41, 98, 255], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          1: { cellWidth: 18 },
          5: { cellWidth: 35 },
        },
      })
      y = (doc as any).lastAutoTable.finalY + 8
    }

    // OASIS Analysis (if present)
    if (data.oasisAnalysis) {
      const oa = data.oasisAnalysis

      checkPage(20)
      doc.setFontSize(13)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(30, 64, 175) // blue
      doc.text("OASIS Analysis", margin, y)
      y += 3
      doc.setTextColor(0)

      // OASIS Summary
      if (oa.oasisSummary) {
        doc.setFontSize(9)
        doc.setFont("helvetica", "normal")
        const sumLines = doc.splitTextToSize(oa.oasisSummary, contentWidth)
        checkPage(sumLines.length * 4 + 5)
        doc.text(sumLines, margin, y)
        y += sumLines.length * 4 + 4
      }

      // Metadata
      checkPage(12)
      doc.setFontSize(9)
      doc.setFont("helvetica", "normal")
      const metaParts: string[] = []
      if (oa.oasisSocDate) metaParts.push(`SOC Date: ${oa.oasisSocDate}`)
      if (oa.certificationPeriod) metaParts.push(`Cert Period: ${oa.certificationPeriod}`)
      if (oa.primaryDiagnosisOasis) metaParts.push(`Primary Dx: ${oa.primaryDiagnosisOasis}`)
      if (metaParts.length > 0) {
        doc.text(metaParts.join("  |  "), margin, y)
        y += 6
      }

      // Fall Risk
      if (oa.mahcScore != null) {
        checkPage(15)
        doc.setFontSize(10)
        doc.setFont("helvetica", "bold")
        doc.text(`Fall Risk — MAHC-10 Score: ${oa.mahcScore} (${oa.mahcRiskLevel === "high" ? "HIGH RISK" : "Low Risk"})`, margin, y)
        y += 5
        if (oa.fallHistorySummary) {
          doc.setFont("helvetica", "normal")
          doc.setFontSize(8)
          const fallLines = doc.splitTextToSize(oa.fallHistorySummary, contentWidth)
          doc.text(fallLines, margin, y)
          y += fallLines.length * 3.5 + 4
        }
      }

      // Functional Scores table
      if (oa.functionalScores?.length > 0) {
        checkPage(15)
        doc.setFontSize(10)
        doc.setFont("helvetica", "bold")
        doc.text("Functional Scores", margin, y)
        y += 2
        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [["Item", "Label", "Score", "Description"]],
          body: oa.functionalScores.map((fs: any) => [fs.item, fs.label, String(fs.score), fs.scoreDescription]),
          theme: "grid",
          headStyles: { fillColor: [30, 64, 175], fontSize: 8 },
          bodyStyles: { fontSize: 7 },
          columnStyles: { 0: { cellWidth: 18 }, 2: { cellWidth: 14 } },
        })
        y = (doc as any).lastAutoTable.finalY + 6
      }

      // Assistive Devices
      if (oa.assistiveDevices?.length > 0) {
        checkPage(10)
        doc.setFontSize(10)
        doc.setFont("helvetica", "bold")
        doc.text("Assistive Devices", margin, y)
        y += 5
        doc.setFont("helvetica", "normal")
        doc.setFontSize(9)
        doc.text(oa.assistiveDevices.join(", "), margin, y)
        y += 6
      }

      // Cross-Validation Flags table
      if (oa.flags?.length > 0) {
        checkPage(15)
        doc.setFontSize(10)
        doc.setFont("helvetica", "bold")
        doc.text("Cross-Validation Flags", margin, y)
        y += 2
        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [["Severity", "Category", "Title", "Description", "Recommendation"]],
          body: oa.flags.map((f: any) => [
            f.severity.toUpperCase(),
            flagCategoryLabel(f.category),
            f.title,
            f.description,
            f.recommendation,
          ]),
          theme: "grid",
          headStyles: { fillColor: [30, 64, 175], fontSize: 7 },
          bodyStyles: { fontSize: 7 },
          columnStyles: { 0: { cellWidth: 16 }, 1: { cellWidth: 25 } },
          didParseCell: (hookData: any) => {
            if (hookData.section === "body" && hookData.column.index === 0) {
              const val = hookData.cell.text?.[0] ?? ""
              if (val === "RED") hookData.cell.styles.textColor = [220, 38, 38]
              else if (val === "YELLOW") hookData.cell.styles.textColor = [202, 138, 4]
              else hookData.cell.styles.textColor = [22, 163, 74]
            }
          },
        })
        y = (doc as any).lastAutoTable.finalY + 6
      }

      // Missed Coding Opportunities table
      if (oa.missedCodes?.length > 0) {
        checkPage(15)
        doc.setFontSize(10)
        doc.setFont("helvetica", "bold")
        doc.text("Missed Coding Opportunities", margin, y)
        y += 2
        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [["Finding", "Expected ICD-10", "Description", "In OASIS?", "Source"]],
          body: oa.missedCodes.map((mc: any) => [
            mc.finding,
            mc.expectedIcdCode,
            mc.expectedDescription,
            mc.codedInOasis ? "Yes" : "NO — MISSING",
            formatSourceRefs(mc.sourceReferences),
          ]),
          theme: "grid",
          headStyles: { fillColor: [30, 64, 175], fontSize: 7 },
          bodyStyles: { fontSize: 7 },
          columnStyles: { 1: { cellWidth: 20 } },
          didParseCell: (hookData: any) => {
            if (hookData.section === "body" && hookData.column.index === 3) {
              const val = hookData.cell.text?.[0] ?? ""
              if (val.startsWith("NO")) hookData.cell.styles.textColor = [220, 38, 38]
            }
          },
        })
        y = (doc as any).lastAutoTable.finalY + 6
      }

      // PDGM Grouping
      if (oa.pdgmGrouping) {
        checkPage(20)
        doc.setFontSize(10)
        doc.setFont("helvetica", "bold")
        doc.text("PDGM Grouping Preview", margin, y)
        y += 2
        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [["Clinical Group", "Functional Level", "Comorbidity Tier", "Admission Source", "Episode Timing"]],
          body: [[
            oa.pdgmGrouping.clinicalGroup,
            oa.pdgmGrouping.functionalLevel,
            oa.pdgmGrouping.comorbidityTier,
            oa.pdgmGrouping.admissionSource,
            oa.pdgmGrouping.episodeTiming,
          ]],
          theme: "grid",
          headStyles: { fillColor: [30, 64, 175], fontSize: 8 },
          bodyStyles: { fontSize: 8 },
        })
        y = (doc as any).lastAutoTable.finalY + 4
        if (oa.pdgmGrouping.reimbursementNotes) {
          doc.setFont("helvetica", "italic")
          doc.setFontSize(8)
          const reimLines = doc.splitTextToSize(oa.pdgmGrouping.reimbursementNotes, contentWidth)
          checkPage(reimLines.length * 3.5 + 5)
          doc.text(reimLines, margin, y)
          y += reimLines.length * 3.5 + 6
        }
      }

      y += 4
    }

    // Coding Summary
    checkPage(25)
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.text("Coding Summary", margin, y)
    y += 6
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    const summaryLines = doc.splitTextToSize(data.codingSummary ?? "", contentWidth)
    checkPage(summaryLines.length * 4 + 5)
    doc.text(summaryLines, margin, y)
    y += summaryLines.length * 4 + 8

    // Source Documents
    const sourceDocs = codingResult.sourceDocuments ?? []
    if (sourceDocs.length > 0) {
      checkPage(20)
      doc.setFontSize(11)
      doc.setFont("helvetica", "bold")
      doc.text("Source Documents", margin, y)
      y += 2

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [["File Name", "Document Type"]],
        body: sourceDocs.map((d: any) => [
          d.fileName,
          d.documentType ?? "—",
        ]),
        theme: "grid",
        headStyles: { fillColor: [41, 98, 255], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
      })
    }

    // Footer on every page
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(7)
      doc.setTextColor(150)
      doc.text(
        `SelectHealthAI — AI Coding Results — Page ${i} of ${totalPages}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: "center" }
      )
    }

    const safeName = patientName.replace(/[^a-zA-Z0-9]/g, "_")
    doc.save(`AI_Coding_Results_${safeName}.pdf`)
  }, [data, codingResult, patientName])

  // Compute metrics from data
  const metrics = React.useMemo(() => {
    if (!data) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allDiagnoses: any[] = [
      data.primaryDiagnosis,
      ...(data.additionalDiagnoses ?? []),
    ]
    const allConfidences = allDiagnoses.map((d) => d.confidence as number)
    const avgConfidence =
      allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length
    const highConfCount = allConfidences.filter((c) => c >= 0.9).length
    const needsReview = allConfidences.filter((c) => c < 0.7).length

    // severity distribution from diseaseList
    const severityCounts: Record<string, number> = {}
    const acuityCounts: Record<string, number> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const entry of (data.diseaseList ?? []) as any[]) {
      severityCounts[entry.severity] = (severityCounts[entry.severity] ?? 0) + 1
      acuityCounts[entry.acuity] = (acuityCounts[entry.acuity] ?? 0) + 1
    }

    const severityData = Object.entries(severityCounts).map(([name, value]) => ({
      name,
      value,
      fill:
        (severityChartConfig[name] as { color?: string })?.color ??
        "hsl(215, 16%, 57%)",
    }))

    const acuityData = Object.entries(acuityCounts).map(([name, value]) => ({
      name,
      value,
      fill:
        (acuityChartConfig[name] as { color?: string })?.color ??
        "hsl(215, 16%, 57%)",
    }))

    // confidence bar chart data (each diagnosis)
    const confidenceBarData = allDiagnoses.map((d) => ({
      code: d.icdCode as string,
      confidence: Math.round((d.confidence as number) * 100),
      fill: confidenceColor(d.confidence as number),
    }))

    return {
      totalDiagnoses: allDiagnoses.length,
      avgConfidence,
      highConfCount,
      needsReview,
      severityData,
      acuityData,
      confidenceBarData,
    }
  }, [data])

  return (
    <Sheet
      open={patientId !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <SheetContent side="right" className="w-[50vw] sm:max-w-none flex flex-col">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <BrainCircuitIcon className="h-5 w-5" />
              AI Coding Results
            </SheetTitle>
            {data && codingResult?.status === "completed" && (
              <Button
                size="sm"
                onClick={downloadPdf}
                className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white ml-auto"
              >
                <DownloadIcon className="h-3.5 w-3.5" />
                Download PDF
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{patientName}</p>
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0 px-4">
          {/* Loading state */}
          {!codingResult ||
          codingResult.status === "pending" ||
          codingResult.status === "coding" ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <LoaderIcon className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                AI is analyzing documents...
              </p>
            </div>
          ) : codingResult.status === "failed" ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <AlertTriangleIcon className="h-6 w-6 text-destructive" />
              <p className="text-sm text-destructive">
                {codingResult.errorMessage}
              </p>
            </div>
          ) : data && metrics ? (
            <div className="flex flex-col gap-6 pb-4">
              {/* Metric cards */}
              <div className="grid grid-cols-4 gap-3">
                <div className="rounded-lg border p-3 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <ClipboardListIcon className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-medium uppercase tracking-wider">
                      Total Codes
                    </span>
                  </div>
                  <span className="text-2xl font-semibold">
                    {metrics.totalDiagnoses}
                  </span>
                </div>
                <div className="rounded-lg border p-3 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <TrendingUpIcon className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-medium uppercase tracking-wider">
                      Avg Confidence
                    </span>
                    <ConfidenceExplainer />
                  </div>
                  <span className="text-2xl font-semibold">
                    {(metrics.avgConfidence * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="rounded-lg border p-3 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <ShieldCheckIcon className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-medium uppercase tracking-wider">
                      High Conf.
                    </span>
                  </div>
                  <span className="text-2xl font-semibold">
                    {metrics.highConfCount}
                  </span>
                </div>
                <div className="rounded-lg border p-3 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <AlertCircleIcon className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-medium uppercase tracking-wider">
                      Needs Review
                    </span>
                  </div>
                  <span className="text-2xl font-semibold text-amber-600">
                    {metrics.needsReview}
                  </span>
                </div>
              </div>

              {/* Charts row */}
              <div className="grid grid-cols-2 gap-4">
                {/* Confidence by diagnosis bar chart */}
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <ActivityIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Confidence by Code
                    </span>
                  </div>
                  <ChartContainer
                    config={confidenceBarConfig}
                    className="h-[160px] w-full"
                  >
                    <BarChart
                      data={metrics.confidenceBarData}
                      layout="vertical"
                      margin={{ left: 0, right: 8, top: 0, bottom: 0 }}
                    >
                      <XAxis type="number" domain={[0, 100]} hide />
                      <YAxis
                        type="category"
                        dataKey="code"
                        width={60}
                        tick={{ fontSize: 10 }}
                      />
                      <ChartTooltip
                        content={<ChartTooltipContent hideLabel />}
                        formatter={(value) => [`${value}%`, "Confidence"]}
                      />
                      <Bar dataKey="confidence" radius={[0, 4, 4, 0]}>
                        {metrics.confidenceBarData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                </div>

                {/* Severity + Acuity pie charts stacked */}
                <div className="flex flex-col gap-4">
                  {metrics.severityData.length > 0 && (
                    <div className="rounded-lg border p-3">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        Severity Distribution
                      </span>
                      <ChartContainer
                        config={severityChartConfig}
                        className="h-[100px] w-full"
                      >
                        <PieChart>
                          <ChartTooltip
                            content={<ChartTooltipContent nameKey="name" />}
                          />
                          <Pie
                            data={metrics.severityData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={20}
                            outerRadius={40}
                          />
                        </PieChart>
                      </ChartContainer>
                    </div>
                  )}
                  {metrics.acuityData.length > 0 && (
                    <div className="rounded-lg border p-3">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        Acuity Breakdown
                      </span>
                      <ChartContainer
                        config={acuityChartConfig}
                        className="h-[100px] w-full"
                      >
                        <PieChart>
                          <ChartTooltip
                            content={<ChartTooltipContent nameKey="name" />}
                          />
                          <Pie
                            data={metrics.acuityData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={20}
                            outerRadius={40}
                          />
                        </PieChart>
                      </ChartContainer>
                    </div>
                  )}
                </div>
              </div>

              {/* Overall confidence */}
              <div className="flex items-center justify-between rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <ShieldCheckIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium">
                    Overall Confidence
                  </span>
                  <ConfidenceExplainer />
                </div>
                {confidenceBadge(data.overallConfidence)}
              </div>

              {/* Section 1: Primary Diagnosis (M1021) */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Primary Diagnosis (M1021)
                </h3>
                <p className="text-[11px] text-muted-foreground mb-2">
                  The principal condition driving the current home health episode of care.
                </p>
                <div className="rounded-md border p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium font-mono">
                      {data.primaryDiagnosis.icdCode}
                    </span>
                    {confidenceBadge(data.primaryDiagnosis.confidence)}
                  </div>
                  <p className="text-xs">
                    {data.primaryDiagnosis.description}
                  </p>
                  <p className="text-xs text-muted-foreground italic">
                    &ldquo;{data.primaryDiagnosis.supportingEvidence}&rdquo;
                  </p>
                  <SourceRefs refs={data.primaryDiagnosis.sourceReferences} />
                </div>
              </section>

              {/* Section 2: Additional Diagnoses */}
              {data.additionalDiagnoses?.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Additional Diagnoses
                  </h3>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Secondary conditions relevant to the home health plan of care, ordered by clinical significance.
                  </p>
                  <div className="flex flex-col gap-2">
                    {data.additionalDiagnoses.map(
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      (dx: any, i: number) => (
                        <div
                          key={i}
                          className="rounded-md border p-3 space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium font-mono">
                              {dx.icdCode}
                            </span>
                            {confidenceBadge(dx.confidence)}
                          </div>
                          <p className="text-xs">{dx.description}</p>
                          <p className="text-xs text-muted-foreground italic">
                            &ldquo;{dx.supportingEvidence}&rdquo;
                          </p>
                          <SourceRefs refs={dx.sourceReferences} />
                        </div>
                      )
                    )}
                  </div>
                </section>
              )}

              {/* Section 3: Combo Codes */}
              {data.comboCodes?.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Combination Codes
                  </h3>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Paired ICD-10 codes where a primary condition must be coded with its manifestation per coding conventions.
                  </p>
                  <div className="flex flex-col gap-2">
                    {data.comboCodes.map(
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      (combo: any, i: number) => (
                        <div
                          key={i}
                          className="rounded-md border p-3 space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                {combo.primaryCode}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                +
                              </span>
                              <Badge variant="outline">
                                {combo.manifestationCode}
                              </Badge>
                            </div>
                            {confidenceBadge(combo.confidence)}
                          </div>
                          <p className="text-xs">
                            {combo.primaryDescription} +{" "}
                            {combo.manifestationDescription}
                          </p>
                          <p className="text-xs text-muted-foreground italic">
                            {combo.rationale}
                          </p>
                          <SourceRefs refs={combo.sourceReferences} />
                        </div>
                      )
                    )}
                  </div>
                </section>
              )}

              {/* Section 4: Disease List */}
              {data.diseaseList?.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Disease List
                  </h3>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Comprehensive list of all active conditions with severity and acuity classification.
                  </p>
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="text-xs">Condition</TableHead>
                          <TableHead className="text-xs">ICD-10</TableHead>
                          <TableHead className="text-xs">Severity</TableHead>
                          <TableHead className="text-xs">Acuity</TableHead>
                          <TableHead className="text-xs">Source</TableHead>
                          <TableHead className="text-xs text-right">
                            Confidence
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.diseaseList.map(
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          (entry: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell className="text-xs">
                                {entry.condition}
                              </TableCell>
                              <TableCell className="text-xs font-mono">
                                {entry.icdCode}
                              </TableCell>
                              <TableCell className="text-xs capitalize">
                                {entry.severity}
                              </TableCell>
                              <TableCell className="text-xs capitalize">
                                {entry.acuity}
                              </TableCell>
                              <TableCell className="text-xs">
                                {entry.sourceReferences?.length > 0
                                  ? entry.sourceReferences.map((ref: any, j: number) => (
                                      <span key={j} className="block text-[10px] text-muted-foreground">
                                        {ref.documentName}{ref.pageOrSection ? ` · ${ref.pageOrSection}` : ""}
                                      </span>
                                    ))
                                  : <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="text-xs text-right">
                                {(entry.confidence * 100).toFixed(0)}%
                              </TableCell>
                            </TableRow>
                          )
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </section>
              )}

              {/* Section 5: OASIS Analysis (conditional) */}
              {data.oasisAnalysis && <OasisAnalysisSection oasis={data.oasisAnalysis} />}

              {/* Section 6: Coding Summary */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Coding Summary
                </h3>
                <p className="text-[11px] text-muted-foreground mb-2">
                  AI-generated narrative of the patient's clinical picture and coding rationale.
                </p>
                <div className="rounded-md border p-3">
                  <p className="text-xs leading-relaxed">
                    {data.codingSummary}
                  </p>
                </div>
              </section>

              {/* Section 7: Source Documents */}
              {codingResult.sourceDocuments &&
                codingResult.sourceDocuments.length > 0 && (
                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      Source Documents
                    </h3>
                    <p className="text-[11px] text-muted-foreground mb-2">
                      Extracted documents used by AI for coding analysis.
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {codingResult.sourceDocuments.map(
                        (doc: any, i: number) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 rounded-md border px-3 py-2"
                          >
                            <FileTextIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-xs truncate flex-1">
                              {doc.fileName}
                            </span>
                            {doc.documentType && (
                              <Badge variant="outline" className="text-[10px] shrink-0">
                                {doc.documentType}
                              </Badge>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  </section>
                )}

              {/* Metadata — no model name */}
              <div className="text-[10px] text-muted-foreground flex items-center gap-3 pb-2">
                <span>Documents: {codingResult.documentCount}</span>
                {codingResult.codedAt && (
                  <span>
                    Coded: {new Date(codingResult.codedAt).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          ) : null}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
