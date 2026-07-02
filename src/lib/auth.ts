import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          include: { affiliate: true },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return null;

        if (user.affiliate && user.affiliate.status === "BANNED") return null;

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          affiliateId: user.affiliate?.id ?? null,
        };
      },
    }),
  ],
});

export class AuthError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Returns the session or throws — for API routes that require a login. */
export async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new AuthError(401, "Unauthorized");
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (session.user.role !== "ADMIN") throw new AuthError(403, "Forbidden");
  return session;
}

export async function requireAffiliate() {
  const session = await requireSession();
  if (!session.user.affiliateId) throw new AuthError(403, "No affiliate profile");
  return { session, affiliateId: session.user.affiliateId };
}
