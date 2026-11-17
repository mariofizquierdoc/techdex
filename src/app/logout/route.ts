import { signOut } from "@/auth";

/**
 * Clears the session cookie. Used when a valid session points at a user that no
 * longer exists (e.g. deleted by an admin), which would otherwise loop between
 * the app layout and the login page.
 */
export async function GET() {
  await signOut({ redirectTo: "/login" });
}
