import { NextRequest, NextResponse } from "next/server";
import { readObject, verifyObjectToken } from "@/server/db/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ bucket: string; path: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { bucket, path } = await ctx.params;
  const objectPath = (path || []).join("/");
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const exp = Number(url.searchParams.get("exp") || "0");
  if (!verifyObjectToken(bucket, objectPath, exp, token)) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }
  const obj = await readObject(bucket, objectPath);
  if (!obj) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(obj.bytes), {
    headers: {
      "Content-Type": obj.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
