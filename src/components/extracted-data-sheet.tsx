import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
  FileTextIcon,
  UserIcon,
  HashIcon,
  CalendarIcon,
  StethoscopeIcon,
  ClipboardListIcon,
  FileIcon,
} from "lucide-react"

interface ExtractedData {
  patient_name?: string | null
  mrn?: string | null
  date_of_birth?: string | null
  document_type?: string | null
  document_date?: string | null
  provider_name?: string | null
  diagnoses?: Array<{
    description?: string
    icd_code?: string | null
  }>
  full_content?: string | null
  [key: string]: unknown
}

export function ExtractedDataSheet({
  open,
  onClose,
  fileName,
  extractedData,
  extractedAt,
  status,
}: {
  open: boolean
  onClose: () => void
  fileName: string
  extractedData: ExtractedData | null
  extractedAt?: number
  status?: string
}) {
  const data = extractedData as ExtractedData | null

  // Collect any extra fields not in the known set
  const knownKeys = new Set([
    "patient_name",
    "mrn",
    "date_of_birth",
    "document_type",
    "document_date",
    "provider_name",
    "diagnoses",
    "full_content",
  ])
  const extraFields = data
    ? Object.entries(data).filter(
        ([k, v]) => !knownKeys.has(k) && v != null && v !== ""
      )
    : []

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-[45vw] sm:max-w-none flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileTextIcon className="h-5 w-5" />
            Extracted Document Data
          </SheetTitle>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground truncate">
              {fileName}
            </p>
            {status && (
              <Badge
                variant={status === "grouped" ? "default" : "secondary"}
              >
                {status}
              </Badge>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0 px-4">
          {!data ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <FileIcon className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No extracted data available for this document.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-5 pb-4">
              {/* Patient Info Card */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Patient Information
                </h3>
                <div className="rounded-md border divide-y">
                  <InfoRow
                    icon={<UserIcon className="h-3.5 w-3.5" />}
                    label="Patient Name"
                    value={data.patient_name}
                  />
                  <InfoRow
                    icon={<HashIcon className="h-3.5 w-3.5" />}
                    label="MRN"
                    value={data.mrn}
                  />
                  <InfoRow
                    icon={<CalendarIcon className="h-3.5 w-3.5" />}
                    label="Date of Birth"
                    value={data.date_of_birth}
                  />
                  <InfoRow
                    icon={<StethoscopeIcon className="h-3.5 w-3.5" />}
                    label="Provider"
                    value={data.provider_name}
                  />
                </div>
              </section>

              {/* Document Info Card */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Document Details
                </h3>
                <div className="rounded-md border divide-y">
                  <InfoRow
                    icon={<FileTextIcon className="h-3.5 w-3.5" />}
                    label="Document Type"
                    value={data.document_type}
                  />
                  <InfoRow
                    icon={<CalendarIcon className="h-3.5 w-3.5" />}
                    label="Document Date"
                    value={data.document_date}
                  />
                  {extractedAt && (
                    <InfoRow
                      icon={<CalendarIcon className="h-3.5 w-3.5" />}
                      label="Extracted At"
                      value={new Date(extractedAt).toLocaleString()}
                    />
                  )}
                </div>
              </section>

              {/* Diagnoses */}
              {data.diagnoses && data.diagnoses.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Diagnoses ({data.diagnoses.length})
                  </h3>
                  <div className="flex flex-col gap-2">
                    {data.diagnoses.map((dx, i) => (
                      <div
                        key={i}
                        className="rounded-md border p-3 flex items-start justify-between gap-3"
                      >
                        <div className="flex items-start gap-2 min-w-0">
                          <ClipboardListIcon className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                          <p className="text-xs">
                            {dx.description || "No description"}
                          </p>
                        </div>
                        {dx.icd_code && (
                          <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
                            {dx.icd_code}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Extra fields (any additional data the AI returned) */}
              {extraFields.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Additional Fields
                  </h3>
                  <div className="rounded-md border divide-y">
                    {extraFields.map(([key, value]) => (
                      <div key={key} className="px-3 py-2 flex items-start gap-3">
                        <span className="text-xs font-medium text-muted-foreground min-w-[120px] shrink-0">
                          {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </span>
                        <span className="text-xs break-all">
                          {typeof value === "object"
                            ? JSON.stringify(value, null, 2)
                            : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Full Content */}
              {data.full_content && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Full Extracted Content
                  </h3>
                  <div className="rounded-md border p-3 bg-muted/30">
                    <pre className="text-xs leading-relaxed whitespace-pre-wrap break-words font-sans">
                      {data.full_content}
                    </pre>
                  </div>
                </section>
              )}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value?: string | null
}) {
  return (
    <div className="px-3 py-2.5 flex items-center gap-3">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="text-xs font-medium text-muted-foreground min-w-[100px]">
        {label}
      </span>
      <span className="text-xs">
        {value || <span className="text-muted-foreground italic">N/A</span>}
      </span>
    </div>
  )
}
