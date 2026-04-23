import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
} from "@/components/ui/sidebar"
import {
  FileTextIcon,
  ActivityIcon,
  UsersIcon,
  ListOrderedIcon,
} from "lucide-react"

const navItems = [
  {
    title: "Patient Files",
    url: "/",
    icon: FileTextIcon,
  },
  {
    title: "Upload Queue",
    url: "/queue",
    icon: ListOrderedIcon,
  },
  {
    title: "Coding Activity",
    url: "/coding",
    icon: ActivityIcon,
  },
  {
    title: "Users",
    url: "/users",
    icon: UsersIcon,
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg text-sm font-bold">
                  S
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Select Health</span>
                  <span className="truncate text-xs text-muted-foreground">Home Health Coding</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.url}
                  tooltip={item.title}
                >
                  <Link to={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: user?.name ?? "",
            email: user?.email ?? "",
            role: user?.role ?? "staff",
          }}
          onLogout={logout}
        />
      </SidebarFooter>
    </Sidebar>
  )
}
