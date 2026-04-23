import * as React from "react"
import { useQuery } from "convex/react"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CodingResultsSheet } from "@/components/coding-results-sheet"
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
  AreaChart,
  Area,
  CartesianGrid,
  Cell,
} from "recharts"
import {
  SearchIcon,
  LoaderIcon,
  CheckCircle2Icon,
  XCircleIcon,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

const SESSION_KEY = "selectrcm_session_token"

const confidenceBarConfig: ChartConfig = {
  count: { label: "Patients", color: "hsl(221, 83%, 53%)" },
}

const topCodesConfig: ChartConfig = {
  frequency: { label: "Frequency", color: "hsl(262, 83%, 58%)" },
}

const trendConfig: ChartConfig = {
  confidence: { label: "Avg Confidence", color: "hsl(142, 76%, 36%)" },
}

function confidenceBucket(score: number) {
  if (score >= 0.9) return "90-100%"
  if (score >= 0.8) return "80-89%"
  if (score >= 0.7) return "70-79%"
  if (score >= 0.6) return "60-69%"
  return "<60%"
}

function bucketColor(bucket: string) {
  if (bucket === "90-100%") return "hsl(142, 76%, 36%)"
  if (bucket === "80-89%") return "hsl(173, 58%, 39%)"
  if (bucket === "70-79%") return "hsl(221, 83%, 53%)"
  if (bucket === "60-69%") return "hsl(38, 92%, 50%)"
  return "hsl(0, 84%, 60%)"
}

export default function CodingActivityPage() {
  const token = localStorage.getItem(SESSION_KEY) ?? ""
  const activity = useQuery(
    api.codingHelpers.listCodingActivity,
    token ? { token } : "skip"
  )
  const [search, setSearch] = React.useState("")
  const [selectedPatientId, setSelectedPatientId] =
    React.useState<Id<"patients"> | null>(null)
  const [selectedPatientName, setSelectedPatientName] = React.useState("")

  const filtered = React.useMemo(() => {
    if (!activity) return []
    if (!search) return activity
    const q = search.toLowerCase()
    return activity.filter(
      (a) =>
        a.patientName.toLowerCase().includes(q) ||
        a.mrn.toLowerCase().includes(q) ||
        a.coderName.toLowerCase().includes(q)
    )
  }, [activity, search])

  const stats = React.useMemo(() => {
    if (!activity) return { total: 0, completed: 0, inProgress: 0, failed: 0 }
    return {
      total: activity.length,
      completed: activity.filter((a) => a.status === "completed").length,
      inProgress: activity.filter(
        (a) => a.status === "pending" || a.status === "coding"
      ).length,
      failed: activity.filter((a) => a.status === "failed").length,
    }
  }, [activity])

  const chartData = React.useMemo(() => {
    if (!activity) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const completed = activity.filter((a) => a.status === "completed" && (a as any).codingData)

    if (completed.length === 0) return null

    // 1. Confidence distribution histogram
    const bucketOrder = ["<60%", "60-69%", "70-79%", "80-89%", "90-100%"]
    const buckets: Record<string, number> = {}
    for (const b of bucketOrder) buckets[b] = 0
    for (const item of completed) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (item as any).codingData
      if (data?.overallConfidence != null) {
        const b = confidenceBucket(data.overallConfidence)
        buckets[b] = (buckets[b] ?? 0) + 1
      }
    }
    const confidenceDistribution = bucketOrder.map((name) => ({
      name,
      count: buckets[name] ?? 0,
      fill: bucketColor(name),
    }))

    // 2. Top ICD-10 codes by frequency
    const codeCounts: Record<string, number> = {}
    for (const item of completed) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (item as any).codingData
      if (data?.primaryDiagnosis?.icdCode) {
        const c = data.primaryDiagnosis.icdCode
        codeCounts[c] = (codeCounts[c] ?? 0) + 1
      }
      if (data?.additionalDiagnoses) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const dx of data.additionalDiagnoses as any[]) {
          if (dx.icdCode) {
            codeCounts[dx.icdCode] = (codeCounts[dx.icdCode] ?? 0) + 1
          }
        }
      }
    }
    const topCodes = Object.entries(codeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([code, frequency]) => ({ code, frequency }))

    // 3. Confidence trend over time
    const byDate: Record<string, { total: number; count: number }> = {}
    for (const item of completed) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (item as any).codingData
      const ts = item.codedAt ?? item.createdAt
      if (data?.overallConfidence != null && ts) {
        const day = new Date(ts).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
        if (!byDate[day]) byDate[day] = { total: 0, count: 0 }
        byDate[day].total += data.overallConfidence as number
        byDate[day].count += 1
      }
    }
    const confidenceTrend = Object.entries(byDate).map(([date, val]) => ({
      date,
      confidence: Math.round((val.total / val.count) * 100),
    }))

    return { confidenceDistribution, topCodes, confidenceTrend }
  }, [activity])

  if (activity === undefined) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    )
  }

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total Coded" value={stats.total} />
        <StatCard label="Completed" value={stats.completed} />
        <StatCard label="In Progress" value={stats.inProgress} />
        <StatCard label="Failed" value={stats.failed} />
      </div>

      {/* Charts */}
      {chartData && (
        <div className="grid grid-cols-3 gap-4">
          {/* Confidence distribution */}
          <div className="rounded-lg border p-4">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Confidence Distribution
            </span>
            <p className="text-[11px] text-muted-foreground mb-2">
              Overall AI confidence scores across all coded patients.
            </p>
            <ChartContainer
              config={confidenceBarConfig}
              className="h-[160px] w-full"
            >
              <BarChart
                data={chartData.confidenceDistribution}
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
                  formatter={(value) => [`${value}`, "Patients"]}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {chartData.confidenceDistribution.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>

          {/* Top ICD-10 codes */}
          <div className="rounded-lg border p-4">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Top ICD-10 Codes
            </span>
            <p className="text-[11px] text-muted-foreground mb-2">
              Most frequently assigned diagnosis codes across patients.
            </p>
            <ChartContainer
              config={topCodesConfig}
              className="h-[160px] w-full"
            >
              <BarChart
                data={chartData.topCodes}
                layout="vertical"
                margin={{ left: 0, right: 8, top: 0, bottom: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="code"
                  width={56}
                  tick={{ fontSize: 9 }}
                />
                <ChartTooltip
                  content={<ChartTooltipContent hideLabel />}
                  formatter={(value) => [`${value}`, "Occurrences"]}
                />
                <Bar
                  dataKey="frequency"
                  radius={[0, 4, 4, 0]}
                  fill="var(--color-frequency)"
                />
              </BarChart>
            </ChartContainer>
          </div>

          {/* Confidence trend */}
          <div className="rounded-lg border p-4">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Confidence Trend
            </span>
            <p className="text-[11px] text-muted-foreground mb-2">
              Average coding confidence over time.
            </p>
            <ChartContainer
              config={trendConfig}
              className="h-[160px] w-full"
            >
              <AreaChart
                data={chartData.confidenceTrend}
                margin={{ left: 0, right: 8, top: 4, bottom: 0 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={30}
                  tickFormatter={(v) => `${v}%`}
                />
                <ChartTooltip
                  content={<ChartTooltipContent hideLabel />}
                  formatter={(value) => [`${value}%`, "Avg Confidence"]}
                />
                <Area
                  type="monotone"
                  dataKey="confidence"
                  fill="var(--color-confidence)"
                  fillOpacity={0.2}
                  stroke="var(--color-confidence)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search patient, MRN, or coder..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Activity table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patient</TableHead>
              <TableHead>MRN</TableHead>
              <TableHead>Coded By</TableHead>
              <TableHead>Documents</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-32 text-center text-muted-foreground"
                >
                  {search
                    ? "No results match your search."
                    : "No coding activity yet."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((item) => (
                <TableRow
                  key={item._id}
                  className={
                    item.status === "completed" ? "cursor-pointer" : ""
                  }
                  onClick={() => {
                    if (item.status === "completed") {
                      setSelectedPatientId(item.patientId)
                      setSelectedPatientName(item.patientName)
                    }
                  }}
                >
                  <TableCell className="text-xs font-medium">
                    {item.patientName}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {item.mrn}
                  </TableCell>
                  <TableCell className="text-xs">{item.coderName}</TableCell>
                  <TableCell className="text-xs">
                    {item.documentCount}
                  </TableCell>
                  <TableCell>
                    <CodingStatusBadge status={item.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {item.codedAt
                      ? new Date(item.codedAt).toLocaleDateString()
                      : new Date(item.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CodingResultsSheet
        patientId={selectedPatientId}
        patientName={selectedPatientName}
        onClose={() => setSelectedPatientId(null)}
      />
    </>
  )
}

function CodingStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return (
        <Badge variant="default">
          <CheckCircle2Icon className="h-3 w-3 mr-1" />
          Completed
        </Badge>
      )
    case "pending":
    case "coding":
      return (
        <Badge variant="secondary">
          <LoaderIcon className="h-3 w-3 mr-1 animate-spin" />
          In Progress
        </Badge>
      )
    case "failed":
      return (
        <Badge variant="destructive">
          <XCircleIcon className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      )
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  )
}
