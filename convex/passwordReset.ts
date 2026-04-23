"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import bcrypt from "bcryptjs";
import type { Id } from "./_generated/dataModel";

const SALT_ROUNDS = 12;
const RESET_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

// Action: request a password reset (sends email)
export const requestReset = action({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    // Always return success to avoid leaking whether the email exists
    const user = await ctx.runQuery(internal.sessions.getUserByEmail, {
      email: args.email,
    });

    if (!user) {
      return { success: true };
    }

    const token = crypto.randomUUID();
    const expiresAt = Date.now() + RESET_EXPIRY_MS;

    await ctx.runMutation(internal.passwordResetHelpers.createReset, {
      email: args.email,
      token,
      expiresAt,
    });

    // Send email via Resend
    const appUrl = process.env.APP_URL || "http://localhost:5173";
    const resetLink = `${appUrl}/reset-password?token=${token}`;

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY environment variable not set");
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "SelectHealthAI <subbu@selecthealthai.com>",
        to: [args.email],
        subject: "Reset your SelectHealthAI password",
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #18181b;">Reset Your Password</h2>
            <p>Hi ${user.name},</p>
            <p>We received a request to reset your password. Click the button below to set a new password:</p>
            <p style="text-align: center; margin: 32px 0;">
              <a href="${resetLink}" style="background-color: #18181b; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">Reset Password</a>
            </p>
            <p style="color: #71717a; font-size: 14px;">This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send reset email: ${error}`);
    }

    return { success: true };
  },
});

// Action: reset password with token
export const resetPassword = action({
  args: {
    token: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args): Promise<{
    token: string;
    user: { _id: Id<"users">; email: string; name: string; role: string };
  }> => {
    const reset = await ctx.runQuery(
      internal.passwordResetHelpers.getResetByTokenInternal,
      { token: args.token }
    ) as { email: string; used: boolean; expiresAt: number; _id: Id<"passwordResets"> } | null;

    if (!reset) throw new Error("Invalid or expired reset link");
    if (reset.used) throw new Error("This reset link has already been used");
    if (reset.expiresAt < Date.now()) throw new Error("This reset link has expired");

    if (args.password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    const user = await ctx.runQuery(internal.sessions.getUserByEmail, {
      email: reset.email,
    });
    if (!user) throw new Error("Account not found");

    const passwordHash = await bcrypt.hash(args.password, SALT_ROUNDS);

    await ctx.runMutation(internal.passwordResetHelpers.updatePasswordHash, {
      userId: user._id,
      passwordHash,
    });

    await ctx.runMutation(internal.passwordResetHelpers.markUsed, {
      resetId: reset._id,
    });

    // Auto-login after password reset
    const sessionToken = crypto.randomUUID();
    const expiresAt = Date.now() + SESSION_DURATION_MS;
    await ctx.runMutation(internal.sessions.createSession, {
      userId: user._id,
      token: sessionToken,
      expiresAt,
    });

    return {
      token: sessionToken,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  },
});
