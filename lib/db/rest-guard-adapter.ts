// Adapter between rest-guard.ts and this app's auth module: rest-guard expects
// verifyAccessToken() to return { userId, payload } for a signed-in session.
import { verifyAccessToken as verifyAppToken } from "@/server/auth";

export async function verifyAccessToken(
  token: string
): Promise<{ userId: string; payload: Record<string, any> } | null> {
  const v = await verifyAppToken(token);
  // Refresh tokens and keys without a subject (anon / service) are not sessions.
  if (!v || !v.sub || v.payload?.typ === "refresh") return null;
  return { userId: v.sub, payload: v.payload as Record<string, any> };
}
