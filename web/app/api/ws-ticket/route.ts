import crypto from "crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";

/**
 * Ticket éphémère pour le WebSocket du serveur de partie (FastAPI).
 *
 * Le backend n'a pas accès à la session NextAuth : sans preuve d'identité,
 * n'importe qui pouvait ouvrir /ws/rooms/... en prétendant être un autre
 * joueur (player_id libre). On émet donc ici un ticket court (2 min)
 * signé en HMAC-SHA256 avec NEXTAUTH_SECRET — secret partagé avec le
 * backend, qui vérifie signature + expiration + correspondance du sub.
 *
 * Format : base64url(payload JSON {sub, exp}) + "." + base64url(hmac)
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.email;
  if (!userId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const payload = Buffer.from(
    JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 120 })
  ).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");

  return NextResponse.json({ ticket: `${payload}.${signature}` });
}
