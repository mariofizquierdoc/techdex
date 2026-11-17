import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe part of the Auth.js config (no Prisma / bcrypt), shared by
 * middleware and the full config in `auth.ts`.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const loggedIn = !!auth?.user;
      if (request.nextUrl.pathname.startsWith("/login")) {
        return loggedIn ? Response.redirect(new URL("/", request.nextUrl)) : true;
      }
      return loggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id;
      if (token.role) session.user.role = token.role;
      return session;
    },
  },
} satisfies NextAuthConfig;
