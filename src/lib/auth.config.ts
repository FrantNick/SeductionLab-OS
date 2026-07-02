import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js config (no Prisma import) shared between the
 * middleware and the full server-side config in `auth.ts`.
 */
export const authConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.affiliateId = user.affiliateId;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = (token.role as "ADMIN" | "AFFILIATE") ?? "AFFILIATE";
      session.user.affiliateId = (token.affiliateId as string | null) ?? null;
      return session;
    },
  },
} satisfies NextAuthConfig;
