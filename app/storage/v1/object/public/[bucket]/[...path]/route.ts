import { serveStorageObject } from "@/server/db/serve-object";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PUBLIC_BUCKETS = new Set(["products"]);

type Ctx = { params: Promise<{ bucket: string; path: string[] }> };

async function handle(req: Request, ctx: Ctx) {
  const { bucket, path } = await ctx.params;
  if (!PUBLIC_BUCKETS.has(bucket)) {
    return Response.json({ error: "Bucket is not public" }, { status: 403 });
  }
  const objectPath = (path || []).join("/");
  return serveStorageObject(req, bucket, objectPath);
}

export async function GET(req: Request, ctx: Ctx) {
  return handle(req, ctx);
}

export async function HEAD(req: Request, ctx: Ctx) {
  return handle(req, ctx);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
      "Access-Control-Allow-Headers": "range, content-type, apikey, authorization",
      "Access-Control-Expose-Headers": "Accept-Ranges, Content-Range, Content-Length, Content-Type",
    },
  });
}
