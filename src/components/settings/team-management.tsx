import { useState } from "react"
import { useQuery, useMutation } from "convex/react"
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  PlusIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  TrashIcon,
  UserPlusIcon,
} from "lucide-react"
import type { Id } from "../../../convex/_generated/dataModel"

export function TeamManagement() {
  const { user, token } = useAuth()
  const teams = useQuery(api.teams.listTeams, token ? { token } : "skip")
  const users = useQuery(api.users.listUsers, token ? { token } : "skip")
  const createTeam = useMutation(api.teams.createTeam)
  const deleteTeam = useMutation(api.teams.deleteTeam)
  const addMember = useMutation(api.teams.addTeamMember)
  const removeMember = useMutation(api.teams.removeTeamMember)

  const [expandedTeam, setExpandedTeam] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [teamName, setTeamName] = useState("")
  const [teamDescription, setTeamDescription] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  // Add member dialog state
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [addMemberTeamId, setAddMemberTeamId] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState("")
  const [selectedMemberRole, setSelectedMemberRole] = useState<"manager" | "member">("member")
  const [isAddingMember, setIsAddingMember] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setIsCreating(true)
    try {
      await createTeam({ token, name: teamName, description: teamDescription || undefined })
      toast.success("Team created")
      setCreateOpen(false)
      setTeamName("")
      setTeamDescription("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create team")
    } finally {
      setIsCreating(false)
    }
  }

  async function handleDelete(teamId: Id<"teams">) {
    try {
      await deleteTeam({ token, teamId })
      toast.success("Team deleted")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete team")
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault()
    if (!addMemberTeamId || !selectedUserId) return
    setIsAddingMember(true)
    try {
      await addMember({
        token,
        teamId: addMemberTeamId as Id<"teams">,
        userId: selectedUserId as Id<"users">,
        memberRole: selectedMemberRole,
      })
      toast.success("Member added")
      setAddMemberOpen(false)
      setSelectedUserId("")
      setSelectedMemberRole("member")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add member")
    } finally {
      setIsAddingMember(false)
    }
  }

  async function handleRemoveMember(memberId: Id<"teamMembers">) {
    try {
      await removeMember({ token, teamMemberId: memberId })
      toast.success("Member removed")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove member")
    }
  }

  function openAddMember(teamId: string) {
    setAddMemberTeamId(teamId)
    setSelectedUserId("")
    setSelectedMemberRole("member")
    setAddMemberOpen(true)
  }

  if (teams === undefined) {
    return <p className="text-muted-foreground text-sm p-4">Loading teams...</p>
  }

  // Get users not already in the target team for the add-member dialog
  const currentTeam = teams.find((t) => t._id === addMemberTeamId)
  const currentTeamMemberIds = new Set(currentTeam?.members.map((m) => m.userId) ?? [])
  const availableUsers = (users ?? []).filter((u) => !currentTeamMemberIds.has(u._id))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Teams ({teams.length})</h3>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <PlusIcon className="size-3.5 mr-1" />
              Create Team
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Create Team</DialogTitle>
                <DialogDescription>
                  Create a new team. You will be added as the team manager.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="team-name">Team Name</FieldLabel>
                    <Input
                      id="team-name"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder="e.g. Coding Team A"
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="team-desc">Description (optional)</FieldLabel>
                    <Input
                      id="team-desc"
                      value={teamDescription}
                      onChange={(e) => setTeamDescription(e.target.value)}
                      placeholder="Brief description"
                    />
                  </Field>
                </FieldGroup>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Add Member Dialog */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent>
          <form onSubmit={handleAddMember}>
            <DialogHeader>
              <DialogTitle>Add Team Member</DialogTitle>
              <DialogDescription>
                Add an existing user to {currentTeam?.name ?? "this team"}.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <FieldGroup>
                <Field>
                  <FieldLabel>User</FieldLabel>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUsers.map((u) => (
                        <SelectItem key={u._id} value={u._id}>
                          {u.name} ({u.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Role in Team</FieldLabel>
                  <Select
                    value={selectedMemberRole}
                    onValueChange={(v) => setSelectedMemberRole(v as "manager" | "member")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {user?.role === "superadmin" && (
                        <SelectItem value="manager">Manager</SelectItem>
                      )}
                      <SelectItem value="member">Member</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldGroup>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isAddingMember || !selectedUserId}>
                {isAddingMember ? "Adding..." : "Add Member"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="border rounded-none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30px]" />
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Members</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.map((team) => {
              const isExpanded = expandedTeam === team._id
              return (
                <>
                  <TableRow
                    key={team._id}
                    className="cursor-pointer"
                    onClick={() => setExpandedTeam(isExpanded ? null : team._id)}
                  >
                    <TableCell>
                      {isExpanded ? (
                        <ChevronDownIcon className="size-3.5" />
                      ) : (
                        <ChevronRightIcon className="size-3.5" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{team.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {team.description || "—"}
                    </TableCell>
                    <TableCell>{team.memberCount}</TableCell>
                    <TableCell>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openAddMember(team._id)}
                        >
                          <UserPlusIcon className="size-3.5" />
                        </Button>
                        {user?.role === "superadmin" && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon-sm">
                                <TrashIcon className="size-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Team</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{team.name}"? All team
                                  memberships will be removed. This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(team._id as Id<"teams">)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow key={`${team._id}-members`}>
                      <TableCell colSpan={5} className="bg-muted/50 p-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="pl-10">Name</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Team Role</TableHead>
                              <TableHead className="w-[60px]">Remove</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {team.members.map((member) => (
                              <TableRow key={member._id}>
                                <TableCell className="pl-10">{member.name}</TableCell>
                                <TableCell>{member.email}</TableCell>
                                <TableCell>
                                  <Badge
                                    variant={
                                      member.teamRole === "manager" ? "secondary" : "outline"
                                    }
                                  >
                                    {member.teamRole}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() =>
                                      handleRemoveMember(member._id as Id<"teamMembers">)
                                    }
                                  >
                                    <TrashIcon className="size-3.5" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                            {team.members.length === 0 && (
                              <TableRow>
                                <TableCell
                                  colSpan={4}
                                  className="text-center text-muted-foreground py-4"
                                >
                                  No members yet.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              )
            })}
            {teams.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No teams yet. Create one to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
