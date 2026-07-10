import type { NextAuthConfig, DefaultSession } from "next-auth";

// Edge-safe auth config. Contains NO database/bcrypt imports so it can run in
// Next.js middleware (Edge runtime). The DB-backed provider + jwt callback live
// in lib/auth.ts (Node runtime). When we swap to Keycloak 10.0.2 later, only
// lib/auth.ts changes; this file and all RBAC stay the same.

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      orgId: string;
      role: string;
    } & DefaultSession["user"];
  }
}

export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [], // real providers are added in lib/auth.ts (Node runtime)
  callbacks: {
    // Runs in every runtime (incl. Edge middleware). Reads claims already on
    // the token — never touches the database here.
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.uid ?? token.sub ?? "") as string;
        session.user.orgId = (token.orgId ?? "") as string;
        session.user.role = (token.role ?? "EXEC_VIEWER") as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

export default authConfig;
