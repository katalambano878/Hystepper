import { NextRequest, NextResponse } from "next/server";
import { guardRpc, guardTable } from "@/lib/db/rest-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POSTGREST = (process.env.POSTGREST_URL || "http://hystepper-rest:3000").replace(/\/$/, "");

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, prefer, range, x-client-info, accept-profile, content-profile, x-supabase-api-version",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Expose-Headers": "content-range, prefer-count",
  };
}

async function proxy(req: NextRequest, pathParts: string[]) {
  const incoming = new URL(req.url);
  const targetPath = pathParts.map(encodeURIComponent).join("/");
  const target = `${POSTGREST}/${targetPath}${incoming.search}`;

  const headers = new Headers();
  // Forward auth / prefer / range / content-type / accept-profile
  for (const key of [
    "authorization",
    "apikey",
    "prefer",
    "range",
    "content-type",
    "accept",
    "accept-profile",
    "content-profile",
  ]) {
    const v = req.headers.get(key);
    if (v) headers.set(key, v);
  }

  // PostgREST expects the JWT role; if only apikey is present (anon JWT), that's enough.
  const init: RequestInit = {
    method: req.method,
    headers,
    duplex: "half",
  } as RequestInit;

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = Buffer.from(await req.arrayBuffer());
  }

  const upstream = await fetch(target, init);
  // 204/205/304 must not carry a body — Response() throws otherwise
  // (PostgREST returns 204 for updates/deletes without return=representation).
  const bodyless = upstream.status === 204 || upstream.status === 205 || upstream.status === 304;
  const body = bodyless ? null : await upstream.arrayBuffer();
  const out = new NextResponse(body, { status: upstream.status });
  for (const [k, v] of Object.entries(corsHeaders())) out.headers.set(k, v);
  const cr = upstream.headers.get("content-range");
  if (cr) out.headers.set("content-range", cr);
  const ct = upstream.headers.get("content-type");
  if (ct) out.headers.set("content-type", ct);
  return out;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

type Ctx = { params: Promise<{ path?: string[] }> };

/**
 * Access rules (lib/db/rest-guard.ts) in front of the PostgREST proxy.
 * /rest/v1/rpc/<fn> is judged as an RPC call, /rest/v1/<table> as a table;
 * any other path (schema root, nested paths) as table "" = staff only.
 */
function guarded(method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE") {
  return async (req: NextRequest, ctx: Ctx) => {
    const { path = [] } = await ctx.params;
    const forward = (r: NextRequest) => proxy(r, path);
    if (path[0] === "rpc" && path.length === 2) {
      return guardRpc(forward)(req, { params: Promise.resolve({ fn: path[1] }) });
    }
    const table = path.length === 1 ? path[0] : "";
    return guardTable(method, forward)(req, { params: Promise.resolve({ table }) });
  };
}

export const GET = guarded("GET");
export const POST = guarded("POST");
export const PUT = guarded("PUT");
export const PATCH = guarded("PATCH");
export const DELETE = guarded("DELETE");
// HEAD is a read (count with head: true): same rules as GET.
export const HEAD = guarded("GET");
