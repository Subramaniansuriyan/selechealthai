import { useState } from "react"
import { useQuery, useMutation, useAction } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { useAuth } from "@/hooks/useAuth"
import { toast } from "sonner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { SendIcon, XIcon } from "lucide-react"
import type { Id } from "../../../convex/_generated/dataModel"

const statusBadge: Record<string, { variant: "default" | "secondary" | "outline" | "destructive"; label: string }> = {
  pending: { variant: "secondary", label: "Pending" },
  accepted: { variant: "default", label: "Accepted" },
  expired: { variant: "outline", label: "Expired" },
  revoked: { variant: "destructive", label: "Revoked" },
}

export function InvitationManagement() {
  const { user, token } = useAuth()
  const invitations = useQuery(api.invitations.listInvitations, token ? { token } : "skip")
  const teams = useQuery(api.teams.listTeams, token ? { token } : "skip")
  const sendInvitation = useAction(api.invitationActions.sendInvitation)
  const revokeInvitation = useMutation(api.invitations.revokeInvitation)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [role, setRole] = useState<"manager" | "staff">("staff")
  const [teamId, setTeamId] = useState<string>("")
  const [isSending, setIsSending] = useState(false)

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setIsSending(true)
    try {
      await sendInvitation({
        token,
        email,
        name,
        role,
        teamId: teamId && teamId !== "none" ? (teamId as Id<"teams">) : undefined,
      })
      toast.success(`Invitation sent to ${email}`)
      setInviteOpen(false)
      setEmail("")
      setName("")
      setRole("staff")
      setTeamId("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send invitation")
    } finally {
      setIsSending(false)
    }
  }

  async function handleRevoke(invitationId: Id<"invitations">) {
    try {
      await revokeInvitation({ token, invitationId })
      toast.success("Invitation revoked")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke invitation")
    }
  }

  if (invitations === undefined) {
    return <p className="text-muted-foreground text-sm p-4">Loading invitations...</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Invitations ({invitations.length})</h3>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <SendIcon className="size-3.5 mr-1" />
              Invite User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleInvite}>
              <DialogHeader>
                <DialogTitle>Invite User</DialogTitle>
                <DialogDescription>
                  Send an invitation email with a link to set their password.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="invite-email">Email</FieldLabel>
                    <Input
                      id="invite-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="user@example.com"
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="invite-name">Full Name</FieldLabel>
                    <Input
                      id="invite-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="John Doe"
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Role</FieldLabel>
                    <Select
                      value={role}
                      onValueChange={(v) => setRole(v as "manager" | "staff")}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {user?.role === "superadmin" && (
                          <SelectItem value="manager">Manager</SelectItem>
                        )}
                        <SelectItem value="staff">Staff</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel>Team (optional)</FieldLabel>
                    <Select value={teamId} onValueChange={setTeamId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="No team" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No team</SelectItem>
                        {(teams ?? []).map((t) => (
                          <SelectItem key={t._id} value={t._id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </FieldGroup>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isSending}>
                  {isSending ? "Sending..." : "Send Invitation"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Invited By</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-[60px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.map((inv) => {
              const status = statusBadge[inv.status] ?? statusBadge.pending
              return (
                <TableRow key={inv._id}>
                  <TableCell>{inv.email}</TableCell>
                  <TableCell>{inv.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {inv.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {inv.teamName ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  <TableCell>{inv.inviterName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(inv.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {inv.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleRevoke(inv._id as Id<"invitations">)}
                        title="Revoke invitation"
                      >
                        <XIcon className="size-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
            {invitations.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No invitations yet. Invite a user to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
