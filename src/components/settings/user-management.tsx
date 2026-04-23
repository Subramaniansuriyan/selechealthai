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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { TrashIcon } from "lucide-react"
import type { Id } from "../../../convex/_generated/dataModel"

export function UserManagement() {
  const { token } = useAuth()
  const users = useQuery(api.users.listUsers, token ? { token } : "skip")
  const updateRole = useMutation(api.users.updateUserRole)
  const deleteUser = useMutation(api.users.deleteUser)
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)

  async function handleRoleChange(userId: Id<"users">, role: "superadmin" | "manager" | "staff") {
    setUpdatingRole(userId)
    try {
      await updateRole({ token, userId, role })
      toast.success("Role updated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update role")
    } finally {
      setUpdatingRole(null)
    }
  }

  async function handleDelete(userId: Id<"users">) {
    try {
      await deleteUser({ token, userId })
      toast.success("User deleted")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user")
    }
  }

  if (users === undefined) {
    return <p className="text-muted-foreground text-sm p-4">Loading users...</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">All Users ({users.length})</h3>
      </div>

      <div className="border rounded-none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Teams</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u._id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <Select
                    value={u.role}
                    onValueChange={(value) =>
                      handleRoleChange(
                        u._id as Id<"users">,
                        value as "superadmin" | "manager" | "staff"
                      )
                    }
                    disabled={updatingRole === u._id}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="superadmin">Superadmin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  {u.teams.length > 0 ? (
                    <div className="flex gap-1 flex-wrap">
                      {u.teams.map((t) => (
                        <Badge key={t.teamId} variant="outline">
                          {t.teamName}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">None</span>
                  )}
                </TableCell>
                <TableCell>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon-sm">
                        <TrashIcon className="size-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete User</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete {u.name}? This will remove
                          their account, sessions, and team memberships. This action cannot
                          be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(u._id as Id<"users">)}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
