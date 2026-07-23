import { NextRequest } from "next/server";
import { verifyObjectToken } from "@/server/db/storage";
import { serveStorageObject } from "@/server/db/serve-object";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ bucket: string; path: string[] }> };

async function handle(req: NextRequest, ctx: Ctx) {
  const { bucket, path } = await ctx.params;
  const objectPath = (path || []).join("/");
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const exp = Number(url.searchParams.get("exp") || "0");
  if (!verifyObjectToken(bucket, objectPath, exp, token)) {
    return Response.json({ error: "Invalid or expired token" }, { status: 401 });
  }
  return serveStorageObject(req, bucket, objectPath);
}

export async function GET(req: NextRequest, ctx: Ctx) {
  return handle(req, ctx);
}

export async function HEAD(req: NextRequest, ctx: Ctx) {
  return handle(req, ctx);
}
