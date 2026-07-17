import { NextResponse } from "next/server";
import { readObject } from "@/server/db/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PUBLIC_BUCKETS = new Set(["products"]);

type Ctx = { params: Promise<{ bucket: string; path: string[] }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { bucket, path } = await ctx.params;
  if (!PUBLIC_BUCKETS.has(bucket)) {
    return NextResponse.json({ error: "Bucket is not public" }, { status: 403 });
  }
  const objectPath = (path || []).join("/");
  const obj = await readObject(bucket, objectPath);
  if (!obj) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(obj.bytes), {
    headers: {
      "Content-Type": obj.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
