"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import bcrypt from "bcryptjs";
import { Resend } from "resend";

const SALT_ROUNDS = 12;
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

export const updateName = action({
  args: { token: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.accountHelpers.getUser, { token: args.token });
    if (!user) throw new Error("Authentication required");

    const trimmed = args.name.trim();
    if (!trimmed) throw new Error("Name cannot be empty");

    await ctx.runMutation(internal.accountHelpers.patchUserName, {
      userId: user._id,
      name: trimmed,
    });
  },
});

export const requestPasswordOTP = action({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.accountHelpers.getUser, { token: args.token });
    if (!user) throw new Error("Authentication required");

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + OTP_EXPIRY_MS;

    await ctx.runMutation(internal.accountHelpers.storeOTP, {
      userId: user._id,
      code,
      expiresAt,
    });

    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "SelectHealthAI <subbu@selecthealthai.com>",
      to: user.email,
      subject: "Your password reset code",
      html: `
        <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto;">
          <h2>Password Reset</h2>
          <p>Your verification code is:</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 16px; background: #f4f4f5; border-radius: 8px; margin: 16px 0;">
            ${code}
          </div>
          <p style="color: #666; font-size: 14px;">This code expires in 10 minutes.</p>
        </div>
      `,
    });
  },
});

export const verifyOTPAndResetPassword = action({
  args: {
    token: v.string(),
    code: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.accountHelpers.getUser, { token: args.token });
    if (!user) throw new Error("Authentication required");

    if (args.newPassword.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }

    const otp = await ctx.runQuery(internal.accountHelpers.getValidOTP, {
      userId: user._id,
      code: args.code,
    });

    if (!otp) {
      throw new Error("Invalid or expired OTP code");
    }

    const passwordHash = await bcrypt.hash(args.newPassword, SALT_ROUNDS);

    await ctx.runMutation(internal.accountHelpers.markOTPUsed, { otpId: otp._id });
    await ctx.runMutation(internal.accountHelpers.patchUserPassword, {
      userId: user._id,
      passwordHash,
    });
  },
});
