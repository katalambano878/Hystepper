import { NextRequest, NextResponse } from "next/server";
import { createStorageClient } from "@/server/db/storage";
import { verifyAccessToken } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Supabase storage upload:
 * POST /storage/v1/object/{bucket}/{path}
 */
type Ctx = { params: Promise<{ bucket: string; path: string[] }> };

function cors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Headers", "authorization, apikey, content-type, x-upsert, x-client-info");
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  return res;
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { bucket, path } = await ctx.params;
  const objectPath = (path || []).join("/");
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  // Allow service role or any authenticated staff JWT
  const verified = token ? await verifyAccessToken(token) : null;
  const apikey = req.headers.get("apikey") || "";
  const serviceOk =
    !!process.env.SUPABASE_SERVICE_ROLE_KEY &&
    (token === process.env.SUPABASE_SERVICE_ROLE_KEY || apikey === process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!verified && !serviceOk) {
    return cors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }

  const buf = Buffer.from(await req.arrayBuffer());
  const contentType = req.headers.get("content-type") || "application/octet-stream";
  const upsert = (req.headers.get("x-upsert") || "").toLowerCase() === "true";
  const storage = createStorageClient();
  const result = await storage.from(bucket).upload(objectPath, buf, { contentType, upsert });
  if (result.error) {
    return cors(NextResponse.json({ error: result.error.message }, { status: 400 }));
  }
  return cors(
    NextResponse.json({
      Key: `${bucket}/${objectPath}`,
      Id: objectPath,
    })
  );
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { bucket, path } = await ctx.params;
  const objectPath = (path || []).join("/");
  const storage = createStorageClient();
  await storage.from(bucket).remove([objectPath]);
  return cors(NextResponse.json({}));
}
