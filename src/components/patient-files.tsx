import * as React from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { UploadDrawer } from "@/components/upload-drawer"
import { CodingResultsSheet } from "@/components/coding-results-sheet"
import { ExtractedDataSheet } from "@/components/extracted-data-sheet"
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
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  CartesianGrid,
} from "recharts"
import {
  UploadIcon,
  FileTextIcon,
  SearchIcon,
  ChevronRightIcon,
  UserIcon,
  BrainCircuitIcon,
  LoaderIcon,
  RefreshCwIcon,
  EyeIcon,
} from "lucide-react"
import { Input } from "@/components/ui/input"

const SESSION_KEY = "selectrcm_session_token"

const statusColors: Record<string, string> = {
  grouped: "hsl(142, 76%, 36%)",
  extracted: "hsl(221, 83%, 53%)",
  pending: "hsl(38, 92%, 50%)",
  failed: "hsl(0, 84%, 60%)",
  unknown: "hsl(215, 16%, 57%)",
}

const statusChartConfig: ChartConfig = {
  grouped: { label: "Grouped", color: "hsl(142, 76%, 36%)" },
  extracted: { label: "Extracted", color: "hsl(221, 83%, 53%)" },
  pending: { label: "Pending", color: "hsl(38, 92%, 50%)" },
  failed: { label: "Failed", color: "hsl(0, 84%, 60%)" },
  unknown: { label: "Unknown", color: "hsl(215, 16%, 57%)" },
}

const docsBarConfig: ChartConfig = {
  docs: { label: "Documents", color: "hsl(221, 83%, 53%)" },
}

const timelineConfig: ChartConfig = {
  count: { label: "Documents", color: "hsl(221, 83%, 53%)" },
}

export function PatientFiles() {
  const [uploadOpen, setUploadOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [expandedPatient, setExpandedPatient] = React.useState<string | null>(
    null
  )
  const [codingSheetPatientId, setCodingSheetPatientId] =
    React.useState<Id<"patients"> | null>(null)
  const [codingSheetPatientName, setCodingSheetPatientName] =
    React.useState("")
  const [extractedDataDoc, setExtractedDataDoc] = React.useState<{
    fileName: string
    extractedData: any
    extractedAt?: number
    status?: string
  } | null>(null)

  const token = localStorage.getItem(SESSION_KEY) ?? ""
  const patients = useQuery(
    api.patients.listPatients,
    token ? { token } : "skip"
  )

  const filteredPatients = React.useMemo(() => {
    if (!patients) return []
    if (!search) return patients
    const q = search.toLowerCase()
    return patients.filter(
      (p) =>
        p.patientName.toLowerCase().includes(q) ||
        (p.mrn && p.mrn.toLowerCase().includes(q)) ||
        p.documents.some((d) => d.fileName.toLowerCase().includes(q))
    )
  }, [patients, search])

  const stats = React.useMemo(() => {
    if (!patients) return { total: 0, patients: 0, grouped: 0, pending: 0 }
    const allDocs = patients.flatMap((p) => p.documents)
    return {
      total: allDocs.length,
      patients: patients.length,
      grouped: allDocs.filter((d) => d.status === "grouped").length,
      pending: allDocs.filter((d) => d.status !== "grouped").length,
    }
  }, [patients])

  const chartData = React.useMemo(() => {
    if (!patients || patients.length === 0) return null

    // Top patients by document count (max 8)
    const docsPerPatient = [...patients]
      .sort((a, b) => b.documentCount - a.documentCount)
      .slice(0, 8)
      .map((p) => ({
        name: p.patientName.split(" ").pop() ?? p.patientName,
        docs: p.documentCount,
      }))

    // Status breakdown for pie chart
    const allDocs = patients.flatMap((p) => p.documents)
    const statusCounts: Record<string, number> = {}
    for (const d of allDocs) {
      const s = d.status ?? "unknown"
      statusCounts[s] = (statusCounts[s] ?? 0) + 1
    }
    const statusData = Object.entries(statusCounts).map(([name, value]) => ({
      name,
      value,
      fill: statusColors[name] ?? "hsl(215, 16%, 57%)",
    }))

    // Upload timeline — documents grouped by date
    const byDate: Record<string, number> = {}
    for (const d of allDocs) {
      if (d.extractedAt) {
        const day = new Date(d.extractedAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
        byDate[day] = (byDate[day] ?? 0) + 1
      }
    }
    const timeline = Object.entries(byDate).map(([date, count]) => ({
      date,
      count,
    }))

    return { docsPerPatient, statusData, timeline }
  }, [patients])

  return (
    <>
      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total Documents" value={stats.total} />
        <StatCard label="Patients" value={stats.patients} />
        <StatCard label="Grouped" value={stats.grouped} />
        <StatCard label="Pending" value={stats.pending} />
      </div>

      {/* Charts */}
      {chartData && (
        <div className="grid grid-cols-3 gap-4">
          {/* Documents per patient */}
          <div className="rounded-lg border p-4">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Documents per Patient
            </span>
            <p className="text-[11px] text-muted-foreground mb-2">
              Top patients by uploaded document count.
            </p>
            <ChartContainer config={docsBarConfig} className="h-[160px] w-full">
              <BarChart
                data={chartData.docsPerPatient}
                margin={{ left: 0, right: 8, top: 4, bottom: 0 }}
              >
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis hide />
                <ChartTooltip
                  content={<ChartTooltipContent hideLabel />}
                  formatter={(value) => [`${value}`, "Documents"]}
                />
                <Bar
                  dataKey="docs"
                  radius={[4, 4, 0, 0]}
                  fill="var(--color-docs)"
                />
              </BarChart>
            </ChartContainer>
          </div>

          {/* Document status breakdown */}
          <div className="rounded-lg border p-4">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Status Breakdown
            </span>
            <p className="text-[11px] text-muted-foreground mb-2">
              Distribution of document processing statuses.
            </p>
            <ChartContainer
              config={statusChartConfig}
              className="h-[160px] w-full"
            >
              <PieChart>
                <ChartTooltip
                  content={<ChartTooltipContent nameKey="name" />}
                />
                <Pie
                  data={chartData.statusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={60}
                >
                  {chartData.statusData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          </div>

          {/* Upload timeline */}
          <div className="rounded-lg border p-4">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Extraction Timeline
            </span>
            <p className="text-[11px] text-muted-foreground mb-2">
              Documents extracted over time.
            </p>
            <ChartContainer
              config={timelineConfig}
              className="h-[160px] w-full"
            >
              <AreaChart
                data={chartData.timeline}
                margin={{ left: 0, right: 8, top: 4, bottom: 0 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis hide />
                <ChartTooltip
                  content={<ChartTooltipContent hideLabel />}
                  formatter={(value) => [`${value}`, "Documents"]}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  fill="var(--color-count)"
                  fillOpacity={0.2}
                  stroke="var(--color-count)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search patients, MRN, or files..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={() => setUploadOpen(true)}>
          <UploadIcon className="mr-2 h-4 w-4" />
          Upload Files
        </Button>
      </div>

      {/* Patients table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>MRN</TableHead>
              <TableHead className="text-right">Documents</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {patients === undefined ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-32 text-center text-muted-foreground"
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredPatients.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-32 text-center text-muted-foreground"
                >
                  {search
                    ? "No patients match your search."
                    : "No patient records yet. Upload files to get started."}
                </TableCell>
              </TableRow>
            ) : (
              filteredPatients.map((patient) => {
                const isExpanded = expandedPatient === patient._id
                return (
                  <React.Fragment key={patient._id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() =>
                        setExpandedPatient(isExpanded ? null : patient._id)
                      }
                    >
                      <TableCell className="w-8">
                        <ChevronRightIcon
                          className={`h-4 w-4 text-muted-foreground transition-transform ${
                            isExpanded ? "rotate-90" : ""
                          }`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {patient.patientName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {patient.mrn ?? patient.fallbackCode ?? "\u2014"}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {patient.documentCount}
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <>
                        {patient.documents.map((doc) => (
                          <TableRow key={doc._id} className="bg-muted/30">
                            <TableCell></TableCell>
                            <TableCell colSpan={2}>
                              <div className="flex items-center gap-2 pl-4">
                                <FileTextIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-medium truncate">
                                    {doc.fileName}
                                  </p>
                                  {doc.extractedAt && (
                                    <p className="text-xs text-muted-foreground">
                                      Extracted{" "}
                                      {new Date(
                                        doc.extractedAt
                                      ).toLocaleDateString()}
                                    </p>
                                  )}
                                </div>
                                {doc.extractedData && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setExtractedDataDoc({
                                        fileName: doc.fileName,
                                        extractedData: doc.extractedData,
                                        extractedAt: doc.extractedAt ?? undefined,
                                        status: doc.status,
                                      })
                                    }}
                                  >
                                    <EyeIcon className="h-3 w-3 mr-1" />
                                    View Data
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge
                                variant={
                                  doc.status === "grouped"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {doc.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Coding action row */}
                        <TableRow className="bg-muted/30">
                          <TableCell></TableCell>
                          <TableCell colSpan={3}>
                            <div className="flex items-center gap-2 pl-4 py-1">
                              <CodingButton
                                patientId={patient._id as Id<"patients">}
                                token={token}
                                onViewResults={() => {
                                  setCodingSheetPatientId(
                                    patient._id as Id<"patients">
                                  )
                                  setCodingSheetPatientName(
                                    patient.patientName
                                  )
                                }}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      </>
                    )}
                  </React.Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <UploadDrawer open={uploadOpen} onOpenChange={setUploadOpen} />
      <CodingResultsSheet
        patientId={codingSheetPatientId}
        patientName={codingSheetPatientName}
        onClose={() => setCodingSheetPatientId(null)}
      />
      <ExtractedDataSheet
        open={extractedDataDoc !== null}
        onClose={() => setExtractedDataDoc(null)}
        fileName={extractedDataDoc?.fileName ?? ""}
        extractedData={extractedDataDoc?.extractedData ?? null}
        extractedAt={extractedDataDoc?.extractedAt}
        status={extractedDataDoc?.status}
      />
    </>
  )
}

function CodingButton({
  patientId,
  token,
  onViewResults,
}: {
  patientId: Id<"patients">
  token: string
  onViewResults: () => void
}) {
  const startCoding = useMutation(api.codingHelpers.startCoding)
  const codingResult = useQuery(api.codingHelpers.getCodingResult, {
    token,
    patientId,
  })
  const [loading, setLoading] = React.useState(false)

  const isInProgress =
    codingResult?.status === "pending" || codingResult?.status === "coding"

  const handleStartCoding = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setLoading(true)
    try {
      await startCoding({ token, patientId })
    } catch (err) {
      console.error("Failed to start coding:", err)
    } finally {
      setLoading(false)
    }
  }

  if (!codingResult || codingResult.status === "failed") {
    return (
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="default"
          disabled={loading}
          onClick={handleStartCoding}
        >
          {loading ? (
            <LoaderIcon className="h-3 w-3 mr-1.5 animate-spin" />
          ) : (
            <BrainCircuitIcon className="h-3 w-3 mr-1.5" />
          )}
          Start Coding
        </Button>
        {codingResult?.status === "failed" && (
          <span className="text-xs text-destructive">
            Failed: {codingResult.errorMessage}
          </span>
        )}
      </div>
    )
  }

  if (isInProgress) {
    return (
      <Badge variant="secondary">
        <LoaderIcon className="h-3 w-3 mr-1 animate-spin" />
        AI Coding...
      </Badge>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button
        size="sm"
        variant="outline"
        onClick={(e) => {
          e.stopPropagation()
          onViewResults()
        }}
      >
        <BrainCircuitIcon className="h-3 w-3 mr-1.5" />
        View Coding Results
      </Button>
      <Button
        size="sm"
        variant="ghost"
        title="Re-run Coding"
        onClick={handleStartCoding}
        disabled={loading}
      >
        <RefreshCwIcon className="h-3 w-3" />
      </Button>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  )
}
