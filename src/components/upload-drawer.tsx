import * as React from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import {
  UploadIcon,
  FileTextIcon,
  XIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  LoaderIcon,
  PlusIcon,
} from "lucide-react"
import { useFileUpload, type UploadGroup } from "@/hooks/useFileUpload"

export function UploadDrawer({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const {
    groups,
    isUploading,
    addGroup,
    removeGroup,
    addFilesToGroup,
    removeFileFromGroup,
    uploadAll,
    reset,
  } = useFileUpload()

  const totalFiles = groups.reduce((sum, g) => sum + g.files.length, 0)
  const pendingCount = groups.reduce(
    (sum, g) => sum + g.files.filter((f) => f.status === "pending").length,
    0
  )
  const allDone =
    totalFiles > 0 &&
    groups.every((g) => g.files.every((f) => f.status === "done"))
  const hasGroupsWithFiles = groups.some((g) => g.files.length > 0)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Upload Patient Files</SheetTitle>
          <SheetDescription>
            Create groups to organize files by patient, then upload.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 p-4 flex-1 overflow-auto">
          {/* Add Group button */}
          <Button
            variant="outline"
            className="w-full"
            onClick={addGroup}
            disabled={isUploading}
          >
            <PlusIcon className="mr-2 h-4 w-4" />
            Add Group
          </Button>

          {groups.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-8">
              Add a group to start uploading files.
            </p>
          )}

          {/* Group cards */}
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              isUploading={isUploading}
              onAddFiles={(fileList) => addFilesToGroup(group.id, fileList)}
              onRemoveFile={(fileId) => removeFileFromGroup(group.id, fileId)}
              onRemoveGroup={() => removeGroup(group.id)}
            />
          ))}
        </div>

        {/* Footer */}
        {groups.length > 0 && hasGroupsWithFiles && (
          <div className="p-4 border-t">
            {allDone ? (
              <Button
                className="w-full"
                onClick={() => {
                  reset()
                  onOpenChange(false)
                }}
              >
                Done
              </Button>
            ) : (
              <Button
                className="w-full"
                disabled={isUploading || pendingCount === 0}
                onClick={uploadAll}
              >
                {isUploading
                  ? "Uploading..."
                  : `Upload ${pendingCount} File${pendingCount !== 1 ? "s" : ""} in ${groups.length} Group${groups.length !== 1 ? "s" : ""}`}
              </Button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function GroupCard({
  group,
  isUploading,
  onAddFiles,
  onRemoveFile,
  onRemoveGroup,
}: {
  group: UploadGroup
  isUploading: boolean
  onAddFiles: (fileList: FileList | null) => void
  onRemoveFile: (fileId: string) => void
  onRemoveGroup: () => void
}) {
  const [isDragging, setIsDragging] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    onAddFiles(e.dataTransfer.files)
  }

  return (
    <div className="rounded-lg border">
      {/* Group header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <p className="text-xs font-medium">Group {group.groupNumber}</p>
        {!isUploading && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRemoveGroup}
          >
            <XIcon className="h-3 w-3" />
          </Button>
        )}
      </div>

      <div className="p-3 flex flex-col gap-3">
        {/* Drop zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-4 cursor-pointer transition-colors
            ${isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
            }
          `}
        >
          <UploadIcon className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            {isDragging ? "Drop files here" : "Drop files or click to browse"}
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept=".pdf,.docx,.doc,.png,.jpg,.jpeg"
          onChange={(e) => {
            onAddFiles(e.target.files)
            e.target.value = ""
          }}
        />

        {/* File list */}
        {group.files.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {group.files.map((uf) => (
              <div
                key={uf.id}
                className="flex items-center gap-2 rounded-md border p-2"
              >
                <FileTextIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">
                    {uf.file.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {(uf.file.size / 1024).toFixed(0)} KB
                  </p>
                  {uf.status === "uploading" && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <LoaderIcon className="h-3 w-3 animate-spin text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">
                        Uploading...
                      </span>
                    </div>
                  )}
                  {uf.status === "error" && (
                    <p className="text-[10px] text-destructive mt-0.5">
                      {uf.error ?? "Upload failed"}
                    </p>
                  )}
                </div>
                {uf.status === "done" ? (
                  <CheckCircleIcon className="h-3.5 w-3.5 shrink-0 text-green-600" />
                ) : uf.status === "error" ? (
                  <AlertCircleIcon className="h-3.5 w-3.5 shrink-0 text-destructive" />
                ) : uf.status === "pending" ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveFile(uf.id)
                    }}
                  >
                    <XIcon className="h-3 w-3" />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
