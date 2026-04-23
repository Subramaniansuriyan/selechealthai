import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"

export function AuthGuard() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
