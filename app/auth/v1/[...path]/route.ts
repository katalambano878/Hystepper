import { NextRequest, NextResponse } from "next/server";
import {
  confirmUserEmail,
  createUser,
  emailConfirmRequired,
  findUserByConfirmationToken,
  findUserByEmail,
  findUserById,
  findUserByRecoveryToken,
  getConfirmationToken,
  mintAccessToken,
  rowToUser,
  sessionPayload,
  setConfirmationToken,
  setRecoveryToken,
  touchSignIn,
  updateUserMetadata,
  updateUserPassword,
  verifyAccessToken,
  verifyPassword,
} from "@/server/auth";
import {
  buildConfirmUrl,
  confirmationEmailHtml,
  sendAuthEmail,
} from "@/server/auth-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Headers", "authorization, apikey, content-type, x-client-info, x-supabase-api-version");
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  return res;
}

function json(data: any, status = 200) {
  return cors(NextResponse.json(data, { status }));
}

function err(message: string, status = 400, code = "invalid_request") {
  return json({ error: code, error_description: message, msg: message, message }, status);
}

function bearer(req: NextRequest): string | null {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

async function sendSignupConfirmation(user: { id: string; email: string; user_metadata?: Record<string, any> }) {
  let token = await getConfirmationToken(user.id);
  if (!token) {
    token = await setConfirmationToken(user.email);
  }
  if (!token) return false;
  const firstName = user.user_metadata?.first_name || user.user_metadata?.full_name?.split?.(" ")?.[0];
  return sendAuthEmail({
    to: user.email,
    subject: "Welcome to Hy_stepper — confirm your email",
    html: confirmationEmailHtml(buildConfirmUrl(token), firstName),
  });
}

async function handleToken(req: NextRequest) {
  const url = new URL(req.url);
  const grant = url.searchParams.get("grant_type") || "";
  let body: any = {};
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    body = await req.json().catch(() => ({}));
  } else {
    const text = await req.text();
    body = Object.fromEntries(new URLSearchParams(text));
  }

  if (grant === "password" || body.grant_type === "password" || (body.email && body.password)) {
    const email = String(body.email || "").trim();
    const password = String(body.password || "");
    const row = await findUserByEmail(email);
    if (!row || !(await verifyPassword(row, password))) {
      return err("Invalid login credentials", 400, "invalid_grant");
    }
    if (!row.email_confirmed_at && emailConfirmRequired()) {
      return err(
        "Please confirm your email before signing in. Check your inbox for the confirmation link.",
        400,
        "email_not_confirmed"
      );
    }
    const user = rowToUser(row);
    await touchSignIn(user.id);
    const access = await mintAccessToken(user);
    return json(await sessionPayload(user, access));
  }

  if (grant === "refresh_token" || body.grant_type === "refresh_token") {
    const token = String(body.refresh_token || bearer(req) || "");
    const verified = await verifyAccessToken(token);
    if (!verified?.sub) {
      return err("Invalid refresh token", 401, "invalid_grant");
    }
    const row = await findUserById(verified.sub);
    if (!row) return err("User not found", 401, "invalid_grant");
    const user = rowToUser(row);
    const access = await mintAccessToken(user);
    return json(await sessionPayload(user, access));
  }

  return err(`Unsupported grant_type: ${grant || body.grant_type}`, 400);
}

async function handleSignup(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!email || !password) return err("Email and password required");
  const existing = await findUserByEmail(email);
  if (existing) return err("User already registered", 400, "user_already_exists");

  const requireConfirm = emailConfirmRequired();
  const user = await createUser({
    email,
    password,
    user_metadata: body.data || body.user_metadata || {},
    email_confirm: !requireConfirm,
  });

  if (requireConfirm) {
    await sendSignupConfirmation(user);
    // GoTrue-compatible: return the user but no session until they confirm.
    return json({
      id: user.id,
      aud: user.aud,
      role: user.role,
      email: user.email,
      email_confirmed_at: null,
      phone: user.phone,
      confirmed_at: null,
      last_sign_in_at: null,
      app_metadata: user.app_metadata,
      user_metadata: user.user_metadata,
      identities: [],
      created_at: user.created_at,
      updated_at: user.updated_at,
      is_anonymous: false,
    });
  }

  const access = await mintAccessToken(user);
  return json(await sessionPayload(user, access));
}

async function handleUser(req: NextRequest) {
  const token = bearer(req);
  if (!token) return err("No authorization header", 401, "no_authorization");
  const verified = await verifyAccessToken(token);
  if (!verified?.sub) return err("Invalid token", 401, "invalid_token");
  const row = await findUserById(verified.sub);
  if (!row) return err("User not found", 401, "user_not_found");

  if (req.method === "GET") {
    return json(rowToUser(row));
  }

  if (req.method === "PUT" || req.method === "PATCH") {
    const body = await req.json().catch(() => ({}));
    if (body.password) {
      await updateUserPassword(row.id, String(body.password));
    }
    if (body.data || body.user_metadata) {
      await updateUserMetadata(row.id, body.data || body.user_metadata || {});
    }
    const updated = await findUserById(row.id);
    return json(rowToUser(updated));
  }

  return err("Method not allowed", 405);
}

async function handleRecover(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim();
  // Always return success to avoid email enumeration
  const token = email ? await setRecoveryToken(email) : null;
  if (token && process.env.RESEND_API_KEY) {
    try {
      const base = process.env.NEXT_PUBLIC_APP_URL || "https://hystepper.com";
      const link = `${base}/auth/reset-password#access_token=${token}&type=recovery`;
      await sendAuthEmail({
        to: email,
        subject: "Reset your Hy_stepper password",
        html: `<p>Reset your password:</p><p><a href="${link}">${link}</a></p>`,
      });
    } catch {
      /* ignore */
    }
  }
  return json({ message: "If that email exists, a recovery link was sent" });
}

async function handleVerify(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token = String(body.token || body.token_hash || "");
  const type = String(body.type || "");

  if ((type === "signup" || type === "email") && token) {
    const row = await findUserByConfirmationToken(token);
    if (!row) return err("Invalid or expired confirmation link", 401, "otp_expired");
    const user = await confirmUserEmail(row.id);
    if (!user) return err("Could not confirm email", 400);
    const access = await mintAccessToken(user);
    await touchSignIn(user.id);
    return json(await sessionPayload(user, access));
  }

  if (type === "recovery" && token) {
    const row = await findUserByRecoveryToken(token);
    if (!row) return err("Invalid recovery token", 401);
    const user = rowToUser(row);
    const access = await mintAccessToken(user);
    return json(await sessionPayload(user, access));
  }
  return err("Unsupported verify request");
}

/** Resend signup confirmation email. Always returns success to avoid enumeration. */
async function handleResend(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const type = String(body.type || "signup");
  if (email && type === "signup") {
    const row = await findUserByEmail(email);
    if (row && !row.email_confirmed_at) {
      await sendSignupConfirmation(rowToUser(row));
    }
  }
  return json({ message: "If that email needs confirmation, a new link was sent" });
}

async function handleLogout() {
  return json({});
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await ctx.params;
  const p = path.join("/");
  if (p === "user") return handleUser(req);
  if (p === "health") return json({ version: "hystepper-auth", name: "GoTrue" });

  // Email-click style: /auth/v1/verify?token=...&type=signup&redirect_to=...
  if (p === "verify") {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") || url.searchParams.get("token_hash") || "";
    const type = url.searchParams.get("type") || "signup";
    const redirectTo =
      url.searchParams.get("redirect_to") ||
      `${process.env.NEXT_PUBLIC_APP_URL || "https://hystepper.com"}/auth/login?confirmed=1`;

    if ((type === "signup" || type === "email") && token) {
      const row = await findUserByConfirmationToken(token);
      if (row) {
        await confirmUserEmail(row.id);
        return NextResponse.redirect(redirectTo);
      }
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || "https://hystepper.com"}/auth/login?error=invalid_confirmation`
      );
    }
  }

  return err(`Not found: ${p}`, 404);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await ctx.params;
  const p = path.join("/");
  if (p === "token" || path[0] === "token") return handleToken(req);
  if (p === "signup") return handleSignup(req);
  if (p === "recover") return handleRecover(req);
  if (p === "verify") return handleVerify(req);
  if (p === "resend") return handleResend(req);
  if (p === "logout") return handleLogout();
  return err(`Not found: ${p}`, 404);
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await ctx.params;
  if (path.join("/") === "user") return handleUser(req);
  return err("Not found", 404);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await ctx.params;
  if (path.join("/") === "user") return handleUser(req);
  return err("Not found", 404);
}
