"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import bcrypt from "bcryptjs";
import type { Id } from "./_generated/dataModel";

const SALT_ROUNDS = 12;
const INVITATION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export const sendInvitation = action({
  args: {
    token: v.string(),
    email: v.string(),
    name: v.string(),
    role: v.union(v.literal("manager"), v.literal("staff")),
    teamId: v.optional(v.id("teams")),
  },
  handler: async (ctx, args) => {
    // Validate inviter session
    const inviter = await ctx.runQuery(internal.sessions.validateSessionInternal, {
      token: args.token,
    });
    if (!inviter) throw new Error("Authentication required");
    if (inviter.role !== "superadmin" && inviter.role !== "manager") {
      throw new Error("Insufficient permissions");
    }
    if (inviter.role === "manager" && args.role === "manager") {
      throw new Error("Managers cannot invite other managers");
    }

    // Check if user already exists
    const existing = await ctx.runQuery(internal.sessions.getUserByEmail, {
      email: args.email,
    });
    if (existing) throw new Error(`User with email "${args.email}" already exists`);

    // Check for existing pending invitation
    const pendingInvitation = await ctx.runQuery(
      internal.invitations.getPendingByEmail,
      { email: args.email }
    );
    if (pendingInvitation) {
      throw new Error(`A pending invitation already exists for "${args.email}"`);
    }

    const invitationToken = crypto.randomUUID();
    const expiresAt = Date.now() + INVITATION_EXPIRY_MS;

    await ctx.runMutation(internal.invitations.createInvitation, {
      email: args.email,
      name: args.name,
      role: args.role,
      token: invitationToken,
      invitedBy: inviter._id,
      teamId: args.teamId,
      expiresAt,
    });

    // Send email via Resend
    const appUrl = process.env.APP_URL || "http://localhost:5173";
    const inviteLink = `${appUrl}/set-password?token=${invitationToken}`;

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
        subject: "You've been invited to SelectHealthAI",
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #18181b;">Welcome to SelectHealthAI</h2>
            <p>Hi ${args.name},</p>
            <p>${inviter.name} has invited you to join SelectHealthAI as a <strong>${args.role}</strong>.</p>
            <p>Click the button below to set your password and activate your account:</p>
            <p style="text-align: center; margin: 32px 0;">
              <a href="${inviteLink}" style="background-color: #18181b; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">Set Your Password</a>
            </p>
            <p style="color: #71717a; font-size: 14px;">This link will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.</p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send invitation email: ${error}`);
    }

    return { success: true, email: args.email };
  },
});

export const acceptInvitation = action({
  args: {
    invitationToken: v.string(),
    password: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args): Promise<{
    token: string;
    user: { _id: Id<"users">; email: string; name: string; role: string };
  }> => {
    const invitation = await ctx.runQuery(
      internal.invitations.getInvitationByTokenInternal,
      { token: args.invitationToken }
    );

    if (!invitation) throw new Error("Invalid or expired invitation");
    if (invitation.status !== "pending") throw new Error("Invitation is no longer valid");
    if (invitation.expiresAt < Date.now()) throw new Error("Invitation has expired");

    // Check if user already exists
    const existing = await ctx.runQuery(internal.sessions.getUserByEmail, {
      email: invitation.email,
    });
    if (existing) throw new Error("Account already exists for this email");

    if (args.password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    const passwordHash = await bcrypt.hash(args.password, SALT_ROUNDS);

    const userId = await ctx.runMutation(internal.users.createUser, {
      email: invitation.email,
      passwordHash,
      role: invitation.role,
      name: args.name,
    });

    await ctx.runMutation(internal.invitations.markAccepted, {
      invitationId: invitation._id,
    });

    // Add to team if specified
    if (invitation.teamId) {
      await ctx.runMutation(internal.teams.addMember, {
        teamId: invitation.teamId,
        userId,
        role: invitation.role === "manager" ? "manager" as const : "member" as const,
      });
    }

    // Auto-login
    const sessionToken = crypto.randomUUID();
    const expiresAt = Date.now() + SESSION_DURATION_MS;
    await ctx.runMutation(internal.sessions.createSession, {
      userId,
      token: sessionToken,
      expiresAt,
    });

    return {
      token: sessionToken,
      user: {
        _id: userId,
        email: invitation.email,
        name: args.name,
        role: invitation.role,
      },
    };
  },
});
