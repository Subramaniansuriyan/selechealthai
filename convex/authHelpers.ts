// Shared authentication and authorization helpers.
// This file exports plain functions only (no Convex query/mutation/action exports).

type UserRecord = {
  _id: any;
  email: string;
  name: string;
  role: "superadmin" | "manager" | "staff";
};

export async function authenticate(
  ctx: { db: any },
  token: string
): Promise<UserRecord> {
  if (!token) throw new Error("Authentication required");

  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q: any) => q.eq("token", token))
    .unique();

  if (!session || session.expiresAt < Date.now()) {
    throw new Error("Session expired or invalid");
  }

  const user = await ctx.db.get(session.userId);
  if (!user) throw new Error("User not found");

  return { _id: user._id, email: user.email, name: user.name, role: user.role };
}

export function requireRole(
  user: { role: string },
  ...allowedRoles: string[]
): void {
  if (!allowedRoles.includes(user.role)) {
    throw new Error("Insufficient permissions");
  }
}
