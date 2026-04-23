import { useAuth } from "@/hooks/useAuth"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UserManagement } from "@/components/settings/user-management"
import { TeamManagement } from "@/components/settings/team-management"
import { InvitationManagement } from "@/components/settings/invitation-management"

export default function UsersPage() {
  const { user } = useAuth()

  if (!user || user.role === "staff") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground text-sm">
          Account settings coming soon.
        </p>
      </div>
    )
  }

  const defaultTab = user.role === "superadmin" ? "users" : "teams"

  return (
    <Tabs defaultValue={defaultTab} className="flex flex-col gap-4">
      <TabsList>
        {user.role === "superadmin" && (
          <TabsTrigger value="users">Users</TabsTrigger>
        )}
        <TabsTrigger value="teams">Teams</TabsTrigger>
        <TabsTrigger value="invitations">Invitations</TabsTrigger>
      </TabsList>

      {user.role === "superadmin" && (
        <TabsContent value="users">
          <UserManagement />
        </TabsContent>
      )}
      <TabsContent value="teams">
        <TeamManagement />
      </TabsContent>
      <TabsContent value="invitations">
        <InvitationManagement />
      </TabsContent>
    </Tabs>
  )
}
