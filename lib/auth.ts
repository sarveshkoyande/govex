import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import authConfig from "@/lib/auth.config";

// ===========================================================================
// NODE-runtime auth (has DB access). Composed from the edge-safe authConfig.
//
// KEYCLOAK 10.0.2 SWAP (later) is additive and isolated to this file:
//   import Keycloak from "next-auth/providers/keycloak";
//   providers: [ Keycloak({ clientId: ..., clientSecret: ..., issuer: ... }) ]
//   ...and in `jwt`, on first sign-in, upsert/match the local User by email and
//   set token.uid. Authorization (Membership → role) below is unchanged.
// ===========================================================================

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "").toLowerCase().trim();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // DB-aware. Runs in Node (sign-in POST + server `auth()` calls). Resolves
    // role/org ONCE at sign-in and stores them on the token, so the Edge
    // middleware never needs the database.
    async jwt({ token, user }) {
      if (user?.id) {
        const m = await prisma.membership.findFirst({
          where: { userId: user.id },
          select: { orgId: true, role: true },
        });
        token.uid = user.id;
        token.orgId = m?.orgId ?? "";
        token.role = m?.role ?? "EXEC_VIEWER";
      }
      return token;
    },
  },
});
