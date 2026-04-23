import { useState, type FormEvent } from "react"
import { useSearchParams, Link } from "react-router-dom"
import { useQuery, useAction } from "convex/react"
import { api } from "../../convex/_generated/api"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const SESSION_KEY = "selectrcm_session_token"

function RequestResetForm() {
  const requestReset = useAction(api.passwordReset.requestReset)
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await requestReset({ email })
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset email")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (sent) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            If an account exists for <strong>{email}</strong>, we've sent a password reset link. Check your inbox and spam folder.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/login">
            <Button variant="outline" className="w-full">
              Back to login
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>
          Enter your email address and we'll send you a link to reset your password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            {error && <FieldError>{error}</FieldError>}
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Sending..." : "Send reset link"}
            </Button>
            <Link to="/login" className="text-center text-sm text-muted-foreground hover:underline">
              Back to login
            </Link>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}

function ResetPasswordForm({ token }: { token: string }) {
  const resetInfo = useQuery(api.passwordResetHelpers.validateResetToken, { token })
  const resetPassword = useAction(api.passwordReset.resetPassword)

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }

    setIsSubmitting(true)
    try {
      const result = await resetPassword({ token, password })
      localStorage.setItem(SESSION_KEY, result.token)
      window.location.href = "/"
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password")
      setIsSubmitting(false)
    }
  }

  // Loading
  if (resetInfo === undefined) {
    return (
      <p className="text-muted-foreground text-sm">Validating reset link...</p>
    )
  }

  // Invalid or expired
  if (resetInfo === null) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Link expired</CardTitle>
          <CardDescription>
            This password reset link is invalid or has expired. Please request a new one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/reset-password">
            <Button variant="outline" className="w-full">
              Request new link
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Set new password</CardTitle>
        <CardDescription>
          Enter a new password for <strong>{resetInfo.email}</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            {error && <FieldError>{error}</FieldError>}
            <Field>
              <FieldLabel htmlFor="password">New password</FieldLabel>
              <Input
                id="password"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </Field>
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Resetting..." : "Reset password"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token")

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        {token ? <ResetPasswordForm token={token} /> : <RequestResetForm />}
      </div>
    </div>
  )
}
