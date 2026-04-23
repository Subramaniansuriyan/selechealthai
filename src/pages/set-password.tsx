import { useState, type FormEvent } from "react"
import { useSearchParams } from "react-router-dom"
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

export default function SetPasswordPage() {
  const [searchParams] = useSearchParams()
  const invitationToken = searchParams.get("token") ?? ""

  const invitation = useQuery(
    api.invitations.getInvitationByToken,
    invitationToken ? { token: invitationToken } : "skip"
  )

  const acceptInvitation = useAction(api.invitationActions.acceptInvitation)

  const [name, setName] = useState("")
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
      const result = await acceptInvitation({
        invitationToken,
        password,
        name: name || invitation?.name || "",
      })
      localStorage.setItem(SESSION_KEY, result.token)
      window.location.href = "/"
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set password")
      setIsSubmitting(false)
    }
  }

  // No token in URL
  if (!invitationToken) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Invalid Link</CardTitle>
            <CardDescription>
              This invitation link is missing a token. Please check the link in your email.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  // Loading
  if (invitation === undefined) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center">
        <p className="text-muted-foreground text-sm">Validating invitation...</p>
      </div>
    )
  }

  // Invalid or expired
  if (invitation === null) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Invitation Expired</CardTitle>
            <CardDescription>
              This invitation link is invalid or has expired. Please contact your administrator for a new invitation.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle>Set Your Password</CardTitle>
            <CardDescription>
              Welcome! You've been invited as <strong>{invitation.role}</strong>.
              Set your password to activate your account.
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
                    value={invitation.email}
                    disabled
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="name">Full Name</FieldLabel>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Your full name"
                    value={name || invitation.name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
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
                  <FieldLabel htmlFor="confirmPassword">Confirm Password</FieldLabel>
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
                  {isSubmitting ? "Creating account..." : "Create Account"}
                </Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
