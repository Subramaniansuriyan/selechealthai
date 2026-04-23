import { Navigate } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import { LoginForm } from "@/components/login-form"

export default function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  )
}
