import { useState, useCallback } from "react"
import { useMutation } from "convex/react"
import { api } from "../../convex/_generated/api"

const SESSION_KEY = "selectrcm_session_token"

export interface UploadFile {
  id: string
  file: File
  progress: number
  status: "pending" | "uploading" | "done" | "error"
  error?: string
}

export interface UploadGroup {
  id: string
  groupNumber: number
  files: UploadFile[]
}

export function useFileUpload() {
  const [groups, setGroups] = useState<UploadGroup[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const generateUploadUrl = useMutation(api.uploads.generateUploadUrl)
  const createBatchMut = useMutation(api.uploads.createBatch)
  const createGroupMut = useMutation(api.uploads.createGroup)
  const saveFileMut = useMutation(api.uploads.saveFile)
  const finalizeBatchMut = useMutation(api.uploads.finalizeBatch)

  const getToken = (): string => {
    const token = localStorage.getItem(SESSION_KEY)
    if (!token) throw new Error("Not authenticated")
    return token
  }

  const addGroup = useCallback(() => {
    setGroups((prev) => {
      const nextNumber =
        prev.length === 0
          ? 1
          : Math.max(...prev.map((g) => g.groupNumber)) + 1
      return [
        ...prev,
        { id: crypto.randomUUID(), groupNumber: nextNumber, files: [] },
      ]
    })
  }, [])

  const removeGroup = useCallback((groupId: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== groupId))
  }, [])

  const addFilesToGroup = useCallback(
    (groupId: string, fileList: FileList | null) => {
      if (!fileList) return
      const newFiles: UploadFile[] = Array.from(fileList).map((file) => ({
        id: crypto.randomUUID(),
        file,
        progress: 0,
        status: "pending" as const,
      }))
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId ? { ...g, files: [...g.files, ...newFiles] } : g
        )
      )
    },
    []
  )

  const removeFileFromGroup = useCallback(
    (groupId: string, fileId: string) => {
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? { ...g, files: g.files.filter((f) => f.id !== fileId) }
            : g
        )
      )
    },
    []
  )

  const updateFileStatus = (
    groupId: string,
    fileId: string,
    update: Partial<UploadFile>
  ) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              files: g.files.map((f) =>
                f.id === fileId ? { ...f, ...update } : f
              ),
            }
          : g
      )
    )
  }

  const uploadAll = useCallback(async () => {
    const token = getToken()
    const groupsWithFiles = groups.filter(
      (g) => g.files.some((f) => f.status === "pending")
    )
    if (groupsWithFiles.length === 0) return

    const totalFiles = groupsWithFiles.reduce(
      (sum, g) => sum + g.files.filter((f) => f.status === "pending").length,
      0
    )

    setIsUploading(true)
    let hasErrors = false

    try {
      // 1. Create batch
      const batchId = await createBatchMut({
        token,
        fileCount: totalFiles,
        groupCount: groupsWithFiles.length,
      })

      // 2. For each group: create group, then upload its files
      for (const group of groupsWithFiles) {
        const groupId = await createGroupMut({
          token,
          batchId,
          groupNumber: group.groupNumber,
        })

        const pendingFiles = group.files.filter((f) => f.status === "pending")

        for (const uf of pendingFiles) {
          updateFileStatus(group.id, uf.id, { status: "uploading" })

          try {
            const uploadUrl = await generateUploadUrl({ token })

            const result = await fetch(uploadUrl, {
              method: "POST",
              headers: { "Content-Type": uf.file.type },
              body: uf.file,
            })

            if (!result.ok) {
              throw new Error(`Upload failed: ${result.statusText}`)
            }

            const { storageId } = await result.json()

            await saveFileMut({
              token,
              batchId,
              groupId,
              storageId,
              fileName: uf.file.name,
              fileSize: uf.file.size,
              fileType: uf.file.type,
            })

            updateFileStatus(group.id, uf.id, {
              progress: 100,
              status: "done",
            })
          } catch (err) {
            hasErrors = true
            updateFileStatus(group.id, uf.id, {
              status: "error",
              error: err instanceof Error ? err.message : "Upload failed",
            })
          }
        }
      }

      // 3. Finalize
      if (!hasErrors) {
        await finalizeBatchMut({ token, batchId })
      }
    } finally {
      setIsUploading(false)
    }
  }, [
    groups,
    createBatchMut,
    createGroupMut,
    generateUploadUrl,
    saveFileMut,
    finalizeBatchMut,
  ])

  const reset = useCallback(() => {
    setGroups([])
  }, [])

  return {
    groups,
    isUploading,
    addGroup,
    removeGroup,
    addFilesToGroup,
    removeFileFromGroup,
    uploadAll,
    reset,
  }
}
