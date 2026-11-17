import type { Role } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "./db";

export class AuthzError extends Error {
  constructor(message = "You don't have permission to do that") {
    super(message);
    this.name = "AuthzError";
  }
}

export type CurrentUser = { id: string; name: string; email: string; role: Role };

/** Pure check, unit-testable without a session. */
export function assertAdmin(user: Pick<CurrentUser, "role"> | null | undefined): void {
  if (!user) throw new AuthzError("You must be signed in");
  if (user.role !== "ADMIN") throw new AuthzError("Only admins can make changes");
}

/**
 * Returns the signed-in user, re-read from the database so a deleted account or a
 * role change takes effect immediately rather than when the JWT expires.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true },
  });
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthzError("You must be signed in");
  return user;
}

/** Call at the top of every mutating server action. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  assertAdmin(user);
  return user!;
}
