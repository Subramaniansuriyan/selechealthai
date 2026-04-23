import { useState, type FormEvent } from "react"
import { useAction } from "convex/react"
import { api } from "../../convex/_generated/api"
import { useAuth } from "@/hooks/useAuth"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field"
import { KeyRoundIcon, UserPenIcon } from "lucide-react"

export function AccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { user, token } = useAuth()
  const updateName = useAction(api.account.updateName)
  const requestOTP = useAction(api.account.requestPasswordOTP)
  const resetPassword = useAction(api.account.verifyOTPAndResetPassword)

  const [name, setName] = useState(user?.name ?? "")
  const [nameLoading, setNameLoading] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  // Password reset state
  const [otpStep, setOtpStep] = useState<"idle" | "sent" | "success">("idle")
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpCode, setOtpCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  // Reset form when dialog opens
  const handleOpenChange = (value: boolean) => {
    if (value) {
      setName(user?.name ?? "")
      setNameError(null)
      setOtpStep("idle")
      setOtpCode("")
      setNewPassword("")
      setConfirmPassword("")
      setResetError(null)
    }
    onOpenChange(value)
  }

  async function handleNameSubmit(e: FormEvent) {
    e.preventDefault()
    setNameError(null)
    setNameLoading(true)
    try {
      await updateName({ token, name: name.trim() })
      toast.success("Name updated")
    } catch (err) {
      setNameError(err instanceof Error ? err.message : "Failed to update name")
    } finally {
      setNameLoading(false)
    }
  }

  async function handleSendOTP() {
    setResetError(null)
    setOtpLoading(true)
    try {
      await requestOTP({ token })
      setOtpStep("sent")
      toast.success("OTP sent to your email")
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Failed to send OTP")
    } finally {
      setOtpLoading(false)
    }
  }

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault()
    setResetError(null)

    if (otpCode.length !== 6) {
      setResetError("OTP must be 6 digits")
      return
    }
    if (newPassword.length < 6) {
      setResetError("Password must be at least 6 characters")
      return
    }
    if (newPassword !== confirmPassword) {
      setResetError("Passwords do not match")
      return
    }

    setResetLoading(true)
    try {
      await resetPassword({ token, code: otpCode, newPassword })
      setOtpStep("success")
      toast.success("Password reset successfully")
      setOtpCode("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Failed to reset password")
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Account Settings</DialogTitle>
          <DialogDescription>
            Update your personal information and security settings.
          </DialogDescription>
        </DialogHeader>

        {/* Section 1: Edit Name */}
        <form onSubmit={handleNameSubmit}>
          <div className="flex items-center gap-2 mb-3">
            <UserPenIcon className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Personal Info</h3>
          </div>
          <FieldGroup>
            {nameError && <FieldError>{nameError}</FieldError>}
            <Field>
              <FieldLabel htmlFor="account-name">Display Name</FieldLabel>
              <Input
                id="account-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
              />
            </Field>
            <Field>
              <FieldLabel>Email</FieldLabel>
              <Input value={user?.email ?? ""} disabled className="opacity-60" />
            </Field>
            <Button type="submit" size="sm" disabled={nameLoading || name.trim() === user?.name}>
              {nameLoading ? "Saving..." : "Save Name"}
            </Button>
          </FieldGroup>
        </form>

        <Separator />

        {/* Section 2: Password Reset */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <KeyRoundIcon className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Reset Password</h3>
          </div>

          {resetError && <FieldError className="mb-3">{resetError}</FieldError>}

          {otpStep === "idle" && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                We'll send a verification code to <span className="font-medium">{user?.email}</span>
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleSendOTP}
                disabled={otpLoading}
              >
                {otpLoading ? "Sending..." : "Send OTP"}
              </Button>
            </div>
          )}

          {otpStep === "sent" && (
            <form onSubmit={handleResetPassword}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="otp-code">Verification Code</FieldLabel>
                  <Input
                    id="otp-code"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6-digit code"
                    maxLength={6}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="new-password">New Password</FieldLabel>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="confirm-password">Confirm Password</FieldLabel>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </Field>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={resetLoading}>
                    {resetLoading ? "Resetting..." : "Reset Password"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleSendOTP}
                    disabled={otpLoading}
                  >
                    {otpLoading ? "Sending..." : "Resend Code"}
                  </Button>
                </div>
              </FieldGroup>
            </form>
          )}

          {otpStep === "success" && (
            <div className="space-y-2">
              <p className="text-sm text-green-600 font-medium">Password updated successfully.</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setOtpStep("idle")}
              >
                Done
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
