import * as React from "react"
import { useQuery, useMutation } from "convex/react"
import { useNavigate } from "react-router-dom"
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  SearchIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FileTextIcon,
  DownloadIcon,
  FolderIcon,
  PlayIcon,
  PauseIcon,
  SquareIcon,
  XIcon,
  RefreshCwIcon,
  LoaderIcon,
  FileSearchIcon,
  UsersIcon,
  CheckCircle2Icon,
  XCircleIcon,
  AlertTriangleIcon,
  InfoIcon,
  Trash2Icon,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Bar, BarChart, CartesianGrid, Label, Pie, PieChart, XAxis, YAxis } from "recharts"

const SESSION_KEY = "selectrcm_session_token"

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  uploading: { label: "Uploading", variant: "outline" },
  queued: { label: "Queued", variant: "secondary" },
  processing: { label: "Processing", variant: "default" },
  paused: { label: "Paused", variant: "outline" },
  completed: { label: "Completed", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
}

const groupStatusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pending: { label: "Pending", variant: "outline" },
  processing: { label: "Processing", variant: "secondary" },
  completed: { label: "Done", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function UploadQueue() {
  const token = localStorage.getItem(SESSION_KEY) ?? ""
  const batches = useQuery(api.uploads.listBatches, token ? { token } : "skip")
  const stats = useQuery(api.uploads.getQueueStats, token ? { token } : "skip")
  const [search, setSearch] = React.useState("")
  const [expandedBatch, setExpandedBatch] = React.useState<Id<"uploadBatches"> | null>(null)
  const [logsBatchId, setLogsBatchId] = React.useState<Id<"uploadBatches"> | null>(null)

  const filteredBatches = React.useMemo(() => {
    if (!batches) return []
    if (!search) return batches
    const q = search.toLowerCase()
    return batches.filter(
      (b) =>
        b.uploaderName.toLowerCase().includes(q) ||
        b.uploaderEmail.toLowerCase().includes(q)
    )
  }, [batches, search])

  if (batches === undefined || stats == null) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
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
      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard label="Total Batches" value={stats.total} />
        <StatCard label="Queued" value={stats.queued} />
        <StatCard label="Processing" value={stats.processing} />
        <StatCard label="Paused" value={stats.paused} />
        <StatCard label="Completed" value={stats.completed} />
      </div>

      {/* Charts */}
      <BatchCharts stats={stats} batches={batches} />

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by uploader..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Batches table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Batch</TableHead>
              <TableHead>Uploaded By</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Groups</TableHead>
              <TableHead>Files</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBatches.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-32 text-center text-muted-foreground"
                >
                  {search
                    ? "No batches match your search."
                    : "No upload batches yet."}
                </TableCell>
              </TableRow>
            ) : (
              filteredBatches.map((batch) => {
                const status = statusConfig[batch.status] ?? statusConfig.queued
                const isExpanded = expandedBatch === batch._id
                return (
                  <React.Fragment key={batch._id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() =>
                        setExpandedBatch(isExpanded ? null : batch._id)
                      }
                    >
                      <TableCell>
                        {isExpanded ? (
                          <ChevronDownIcon className="h-4 w-4" />
                        ) : (
                          <ChevronRightIcon className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {batch._id.slice(-8)}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-xs font-medium">
                            {batch.uploaderName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {batch.uploaderEmail}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(batch.createdAt)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {batch.groupCount}
                      </TableCell>
                      <TableCell className="text-xs">
                        {batch.fileCount}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant={status.variant}>{status.label}</Badge>
                          {batch.status === "processing" && (
                            <LoaderIcon className="h-3 w-3 animate-spin text-muted-foreground" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <BatchActions
                          batchId={batch._id}
                          status={batch.status}
                          token={token}
                          onViewLogs={() => setLogsBatchId(batch._id)}
                        />
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={8} className="bg-muted/30 p-0">
                          <BatchGroups
                            batchId={batch._id}
                            batchStatus={batch.status}
                            token={token}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Batch Logs Dialog */}
      <BatchLogsDialog
        batchId={logsBatchId}
        token={token}
        onClose={() => setLogsBatchId(null)}
      />
    </>
  )
}

function BatchActions({
  batchId,
  status,
  token,
  onViewLogs,
}: {
  batchId: Id<"uploadBatches">
  status: string
  token: string
  onViewLogs: () => void
}) {
  const navigate = useNavigate()
  const startProcessing = useMutation(api.processingHelpers.startProcessing)
  const pauseProcessing = useMutation(api.processingHelpers.pauseProcessing)
  const stopProcessing = useMutation(api.processingHelpers.stopProcessing)
  const removeFromQueue = useMutation(api.processingHelpers.removeFromQueue)
  const retryProcessing = useMutation(api.processingHelpers.retryProcessing)
  const reprocessBatch = useMutation(api.processingHelpers.reprocessBatch)
  const deleteBatch = useMutation(api.processingHelpers.deleteBatch)
  const [confirmAction, setConfirmAction] = React.useState<"reprocess" | "delete" | null>(null)
  const [loading, setLoading] = React.useState(false)

  const handleClick = (e: React.MouseEvent, action: () => Promise<unknown>) => {
    e.stopPropagation()
    action().catch(console.error)
  }

  const handleConfirm = async () => {
    setLoading(true)
    try {
      if (confirmAction === "reprocess") {
        await reprocessBatch({ token, batchId })
      } else if (confirmAction === "delete") {
        await deleteBatch({ token, batchId })
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
      setConfirmAction(null)
    }
  }

  const canDelete = status !== "processing"
  const canReprocess = status === "completed" || status === "failed"

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        {/* Queued: Start + Remove */}
        {status === "queued" && (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              title="Start Processing"
              onClick={(e) =>
                handleClick(e, () => startProcessing({ token, batchId }))
              }
            >
              <PlayIcon className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              title="Remove from Queue"
              onClick={(e) =>
                handleClick(e, () => removeFromQueue({ token, batchId }))
              }
            >
              <XIcon className="h-3.5 w-3.5" />
            </Button>
          </>
        )}

        {/* Processing: Pause + Stop */}
        {status === "processing" && (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              title="Pause Processing"
              onClick={(e) =>
                handleClick(e, () => pauseProcessing({ token, batchId }))
              }
            >
              <PauseIcon className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              title="Stop Processing"
              onClick={(e) =>
                handleClick(e, () => stopProcessing({ token, batchId }))
              }
            >
              <SquareIcon className="h-3.5 w-3.5" />
            </Button>
          </>
        )}

        {/* Paused: Resume + Stop + Remove */}
        {status === "paused" && (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              title="Resume Processing"
              onClick={(e) =>
                handleClick(e, () => startProcessing({ token, batchId }))
              }
            >
              <PlayIcon className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              title="Stop Processing"
              onClick={(e) =>
                handleClick(e, () => stopProcessing({ token, batchId }))
              }
            >
              <SquareIcon className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              title="Remove from Queue"
              onClick={(e) =>
                handleClick(e, () => removeFromQueue({ token, batchId }))
              }
            >
              <XIcon className="h-3.5 w-3.5" />
            </Button>
          </>
        )}

        {/* Completed: View Logs + View Patients */}
        {status === "completed" && (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              title="View Logs"
              onClick={(e) => {
                e.stopPropagation()
                onViewLogs()
              }}
            >
              <FileSearchIcon className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              title="View Patients"
              onClick={(e) => {
                e.stopPropagation()
                navigate("/")
              }}
            >
              <UsersIcon className="h-3.5 w-3.5" />
            </Button>
          </>
        )}

        {/* Failed: View Logs + Retry + Remove */}
        {status === "failed" && (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              title="View Logs"
              onClick={(e) => {
                e.stopPropagation()
                onViewLogs()
              }}
            >
              <FileSearchIcon className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              title="Retry Processing"
              onClick={(e) =>
                handleClick(e, () => retryProcessing({ token, batchId }))
              }
            >
              <RefreshCwIcon className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              title="Remove from Queue"
              onClick={(e) =>
                handleClick(e, () => removeFromQueue({ token, batchId }))
              }
            >
              <XIcon className="h-3.5 w-3.5" />
            </Button>
          </>
        )}

        {/* Reprocess: available for completed/failed */}
        {canReprocess && (
          <Button
            variant="ghost"
            size="icon-sm"
            title="Reprocess Batch"
            onClick={(e) => {
              e.stopPropagation()
              setConfirmAction("reprocess")
            }}
          >
            <RefreshCwIcon className="h-3.5 w-3.5" />
          </Button>
        )}

        {/* Delete: available for all except processing */}
        {canDelete && (
          <Button
            variant="ghost"
            size="icon-sm"
            title="Delete Batch"
            onClick={(e) => {
              e.stopPropagation()
              setConfirmAction("delete")
            }}
          >
            <Trash2Icon className="h-3.5 w-3.5 text-destructive" />
          </Button>
        )}
      </div>

      {/* Confirmation dialog */}
      <Dialog
        open={confirmAction !== null}
        onOpenChange={(open) => !open && !loading && setConfirmAction(null)}
      >
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>
              {confirmAction === "reprocess"
                ? "Reprocess Batch"
                : "Delete Batch"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === "reprocess"
                ? "This will delete all extraction results and patient links for this batch, then re-queue it for processing. Patients with no remaining documents will be removed."
                : "This will permanently delete this batch and all its groups, files, extraction results, and logs. Patients with no remaining documents will be removed. This cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={(e) => {
                e.stopPropagation()
                setConfirmAction(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant={confirmAction === "delete" ? "destructive" : "default"}
              size="sm"
              disabled={loading}
              onClick={(e) => {
                e.stopPropagation()
                handleConfirm()
              }}
            >
              {loading && <LoaderIcon className="h-3 w-3 mr-1.5 animate-spin" />}
              {confirmAction === "reprocess" ? "Reprocess" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function BatchGroups({
  batchId,
  batchStatus,
  token,
}: {
  batchId: Id<"uploadBatches">
  batchStatus: string
  token: string
}) {
  const groups = useQuery(api.uploads.getGroupsInBatch, { token, batchId })
  const progress = useQuery(
    api.processingHelpers.getProcessingProgress,
    batchStatus === "processing" || batchStatus === "paused"
      ? { token, batchId }
      : "skip"
  )
  const deleteGroup = useMutation(api.processingHelpers.deleteGroup)
  const [expandedGroup, setExpandedGroup] = React.useState<Id<"uploadGroups"> | null>(null)
  const [confirmDeleteGroupId, setConfirmDeleteGroupId] = React.useState<Id<"uploadGroups"> | null>(null)
  const [deleteLoading, setDeleteLoading] = React.useState(false)

  const canDeleteGroups = batchStatus !== "processing"

  const handleDeleteGroup = async () => {
    if (!confirmDeleteGroupId) return
    setDeleteLoading(true)
    try {
      await deleteGroup({ token, groupId: confirmDeleteGroupId })
    } catch (err) {
      console.error(err)
    } finally {
      setDeleteLoading(false)
      setConfirmDeleteGroupId(null)
    }
  }

  if (groups === undefined) {
    return (
      <div className="p-4">
        <Skeleton className="h-16" />
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <p className="p-4 text-xs text-muted-foreground">
        No groups in this batch.
      </p>
    )
  }

  return (
    <div className="p-4 flex flex-col gap-2">
      {/* Progress bar for processing/paused batches */}
      {progress && (
        <div className="mb-2 rounded-md border bg-background p-3">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-muted-foreground flex items-center gap-1.5">
              {batchStatus === "processing" && (
                <LoaderIcon className="h-3 w-3 animate-spin text-blue-500" />
              )}
              {batchStatus === "paused" ? "Paused" : "Extracting documents with AI"}
              {progress.currentGroupNumber !== null &&
                ` — Group ${progress.currentGroupNumber}`}
            </span>
            <span className="font-medium">
              {progress.completedGroups} / {progress.totalGroups} groups done
              {progress.failedGroups > 0 && (
                <span className="text-destructive ml-1">
                  ({progress.failedGroups} failed)
                </span>
              )}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: `${progress.totalGroups > 0 ? (progress.completedGroups / progress.totalGroups) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {groups.map((group) => {
        const isExpanded = expandedGroup === group._id
        const groupStatus = group.processingStatus
          ? groupStatusConfig[group.processingStatus]
          : null

        return (
          <div key={group._id} className="rounded-md border bg-background">
            <div
              className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30"
              onClick={() =>
                setExpandedGroup(isExpanded ? null : group._id)
              }
            >
              {isExpanded ? (
                <ChevronDownIcon className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <ChevronRightIcon className="h-3.5 w-3.5 shrink-0" />
              )}
              <FolderIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-xs font-medium">Group {group.groupNumber}</p>
              {groupStatus && (
                <Badge variant={groupStatus.variant} className="text-[10px] px-1.5 py-0">
                  {group.processingStatus === "processing" && (
                    <LoaderIcon className="h-2.5 w-2.5 mr-1 animate-spin" />
                  )}
                  {groupStatus.label}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                {group.fileCount} file{group.fileCount !== 1 ? "s" : ""}
              </span>
              {canDeleteGroups && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Delete Group"
                  onClick={(e) => {
                    e.stopPropagation()
                    setConfirmDeleteGroupId(group._id)
                  }}
                >
                  <Trash2Icon className="h-3 w-3 text-destructive" />
                </Button>
              )}
            </div>
            {isExpanded && <GroupFiles groupId={group._id} token={token} />}
          </div>
        )
      })}

      {/* Group delete confirmation dialog */}
      <Dialog
        open={confirmDeleteGroupId !== null}
        onOpenChange={(open) => !open && !deleteLoading && setConfirmDeleteGroupId(null)}
      >
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Delete Group</DialogTitle>
            <DialogDescription>
              This will permanently delete this group and all its files, extraction results, and logs.
              Patients with no remaining documents will be removed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              disabled={deleteLoading}
              onClick={(e) => {
                e.stopPropagation()
                setConfirmDeleteGroupId(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteLoading}
              onClick={(e) => {
                e.stopPropagation()
                handleDeleteGroup()
              }}
            >
              {deleteLoading && <LoaderIcon className="h-3 w-3 mr-1.5 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function GroupFiles({
  groupId,
  token,
}: {
  groupId: Id<"uploadGroups">
  token: string
}) {
  const files = useQuery(api.uploads.getFilesInGroup, { token, groupId })

  if (files === undefined) {
    return (
      <div className="px-3 pb-3">
        <Skeleton className="h-10" />
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <p className="px-3 pb-3 text-xs text-muted-foreground">
        No files in this group.
      </p>
    )
  }

  return (
    <div className="px-3 pb-3 flex flex-col gap-1.5">
      {files.map((file) => {
        const status = file.status as string
        return (
          <div
            key={file._id}
            className="flex items-center gap-2 rounded border p-2"
          >
            {status === "processing" ? (
              <LoaderIcon className="h-3.5 w-3.5 shrink-0 text-blue-500 animate-spin" />
            ) : status === "completed" ? (
              <CheckCircle2Icon className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
            ) : status === "failed" ? (
              <XCircleIcon className="h-3.5 w-3.5 shrink-0 text-destructive" />
            ) : (
              <FileTextIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{file.fileName}</p>
              <p className="text-[10px] text-muted-foreground">
                {formatFileSize(file.fileSize)} &middot; {file.fileType}
              </p>
            </div>
            {status === "processing" && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
                <LoaderIcon className="h-2.5 w-2.5 animate-spin" />
                Extracting with AI...
              </Badge>
            )}
            {status === "completed" && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-emerald-600 border-emerald-300">
                Extracted
              </Badge>
            )}
            {status === "failed" && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                Failed
              </Badge>
            )}
            {file.url && (
              <Button variant="ghost" size="icon-sm" asChild>
                <a
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DownloadIcon className="h-3 w-3" />
                </a>
              </Button>
            )}
          </div>
        )
      })}
    </div>
  )
}

function BatchLogsDialog({
  batchId,
  token,
  onClose,
}: {
  batchId: Id<"uploadBatches"> | null
  token: string
  onClose: () => void
}) {
  const logs = useQuery(
    api.processingHelpers.getBatchLogs,
    batchId ? { token, batchId } : "skip"
  )
  const summary = useQuery(
    api.processingHelpers.getBatchSummary,
    batchId ? { token, batchId } : "skip"
  )
  const navigate = useNavigate()

  const logLevelIcon = (level: string) => {
    switch (level) {
      case "error":
        return <XCircleIcon className="h-3.5 w-3.5 shrink-0 text-destructive" />
      case "warn":
        return <AlertTriangleIcon className="h-3.5 w-3.5 shrink-0 text-yellow-500" />
      default:
        return <InfoIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    }
  }

  return (
    <Sheet open={batchId !== null} onOpenChange={(open: boolean) => !open && onClose()}>
      <SheetContent side="right" className="sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileSearchIcon className="h-5 w-5" />
            Processing Logs
            {batchId && (
              <span className="text-xs font-mono text-muted-foreground">
                ({batchId.slice(-8)})
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-3 gap-3 px-4">
            <div className="rounded-md border p-2.5 overflow-hidden">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Status
              </p>
              <Badge
                variant={
                  summary.status === "completed"
                    ? "default"
                    : summary.status === "failed"
                      ? "destructive"
                      : "secondary"
                }
                className="mt-1 max-w-full shrink truncate"
              >
                {summary.status === "completed" ? (
                  <CheckCircle2Icon className="h-3 w-3 mr-1" />
                ) : summary.status === "failed" ? (
                  <XCircleIcon className="h-3 w-3 mr-1" />
                ) : null}
                {summary.status}
              </Badge>
            </div>
            <div className="rounded-md border p-2.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Files
              </p>
              <p className="text-xs font-medium mt-1">
                <span className="text-green-600">{summary.completedFiles}</span>
                {summary.failedFiles > 0 && (
                  <span className="text-destructive"> / {summary.failedFiles} failed</span>
                )}
                <span className="text-muted-foreground"> of {summary.totalFiles}</span>
              </p>
            </div>
            <div className="rounded-md border p-2.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Patients
              </p>
              <p className="text-xs font-medium mt-1">{summary.patientsFound}</p>
            </div>
          </div>
        )}

        {/* Log entries */}
        <ScrollArea className="flex-1 min-h-0 mx-4 rounded-md border">
          <div className="p-3 flex flex-col gap-1.5">
            {logs === undefined ? (
              <div className="flex items-center justify-center py-8">
                <LoaderIcon className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                No processing logs for this batch.
              </p>
            ) : (
              logs.map((log) => (
                <div
                  key={log._id}
                  className={`flex items-start gap-2 rounded px-2 py-1.5 text-xs ${
                    log.level === "error"
                      ? "bg-destructive/10"
                      : log.level === "warn"
                        ? "bg-yellow-500/10"
                        : "bg-muted/30"
                  }`}
                >
                  {logLevelIcon(log.level)}
                  <span className="flex-1 break-words">{log.message}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {new Date(log.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Footer actions */}
        {summary?.status === "completed" && summary.patientsFound > 0 && (
          <SheetFooter>
            <Button
              size="sm"
              className="w-full"
              onClick={() => {
                onClose()
                navigate("/")
              }}
            >
              <UsersIcon className="h-3.5 w-3.5 mr-2" />
              View Patient Files
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
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

// ── Chart configs ────────────────────────────────────────

const statusChartConfig = {
  count: { label: "Batches" },
  queued: { label: "Queued", color: "var(--color-muted-foreground)" },
  processing: { label: "Processing", color: "var(--color-primary)" },
  paused: { label: "Paused", color: "var(--color-muted-foreground)" },
  completed: { label: "Completed", color: "var(--color-chart-2)" },
  failed: { label: "Failed", color: "var(--color-destructive)" },
} satisfies ChartConfig

const batchBarConfig = {
  files: { label: "Files", color: "var(--color-primary)" },
  groups: { label: "Groups", color: "var(--color-chart-4)" },
} satisfies ChartConfig

function BatchCharts({
  stats,
  batches,
}: {
  stats: { total: number; queued: number; processing: number; paused: number; completed: number }
  batches: Array<{ _id: string; fileCount: number; groupCount: number; createdAt: number; status: string }>
}) {
  const statusData = React.useMemo(() => {
    const items = [
      { status: "queued", count: stats.queued, fill: "var(--color-queued)" },
      { status: "processing", count: stats.processing, fill: "var(--color-processing)" },
      { status: "paused", count: stats.paused, fill: "var(--color-paused)" },
      { status: "completed", count: stats.completed, fill: "var(--color-completed)" },
    ]
    // Add failed count (total minus known statuses)
    const failed = stats.total - stats.queued - stats.processing - stats.paused - stats.completed
    if (failed > 0) {
      items.push({ status: "failed", count: failed, fill: "var(--color-failed)" })
    }
    return items.filter((d) => d.count > 0)
  }, [stats])

  const barData = React.useMemo(() => {
    return batches
      .slice(0, 10)
      .reverse()
      .map((b) => ({
        batch: b._id.slice(-6),
        files: b.fileCount,
        groups: b.groupCount,
        date: new Date(b.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      }))
  }, [batches])

  if (stats.total === 0) return null

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {/* Status Distribution Donut */}
      <Card size="sm">
        <CardHeader>
          <CardTitle>Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={statusChartConfig} className="mx-auto aspect-square max-h-[200px]">
            <PieChart>
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Pie
                data={statusData}
                dataKey="count"
                nameKey="status"
                innerRadius={50}
                strokeWidth={3}
              >
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      return (
                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-bold">
                            {stats.total}
                          </tspan>
                          <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 20} className="fill-muted-foreground text-xs">
                            Batches
                          </tspan>
                        </text>
                      )
                    }
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Files per Batch Bar Chart */}
      <Card size="sm">
        <CardHeader>
          <CardTitle>Batch Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={batchBarConfig} className="max-h-[200px] w-full">
            <BarChart accessibilityLayer data={barData}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                tickMargin={8}
                axisLine={false}
                fontSize={10}
              />
              <YAxis tickLine={false} axisLine={false} fontSize={10} width={30} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="files" fill="var(--color-files)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="groups" fill="var(--color-groups)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
