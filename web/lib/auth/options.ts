import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { initialsFromName } from "@/lib/types/game";

/**
 * Auth.js (NextAuth) + Google OAuth — remplace Supabase Auth.
 *
 * Config requise dans Google Cloud Console (OAuth consent screen + Identifiants) :
 *   Origine JS autorisée   : http://localhost:3000
 *   URI de redirection     : http://localhost:3000/api/auth/callback/google
 * Puis dans web/.env.local : GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET
 * (générer NEXTAUTH_SECRET avec `openssl rand -base64 32`).
 */
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async session({ session }) {
      if (session.user?.name) {
        (session.user as { initials?: string }).initials = initialsFromName(session.user.name);
      }
      return session;
    },
  },
};
