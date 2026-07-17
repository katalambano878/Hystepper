import { NextRequest, NextResponse } from "next/server";

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
  const body = await upstream.arrayBuffer();
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

export async function GET(req: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return proxy(req, path);
}
export async function POST(req: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return proxy(req, path);
}
export async function PUT(req: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return proxy(req, path);
}
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return proxy(req, path);
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return proxy(req, path);
}
export async function HEAD(req: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return proxy(req, path);
}
