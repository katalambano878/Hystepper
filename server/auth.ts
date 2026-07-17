/**
 * GoTrue-compatible JWT helpers for plain-Postgres auth.
 * Tokens are HS256 JWTs PostgREST understands (role + sub claims).
 */
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { query } from "./db/pool";

const ISSUER = "hystepper-auth";

function jwtSecret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(s);
}

export type AppUser = {
  id: string;
  email: string;
  role: string;
  aud: string;
  user_metadata: Record<string, any>;
  app_metadata: Record<string, any>;
  email_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
  phone?: string | null;
};

function rowToUser(row: any): AppUser {
  return {
    id: row.id,
    email: row.email,
    role: row.role || "authenticated",
    aud: row.aud || "authenticated",
    user_metadata: row.raw_user_meta_data || {},
    app_metadata: row.raw_app_meta_data || {},
    email_confirmed_at: row.email_confirmed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    phone: row.phone,
  };
}

export async function mintAccessToken(user: AppUser, expiresIn = "7d"): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    role: "authenticated",
    email: user.email,
    app_metadata: user.app_metadata,
    user_metadata: user.user_metadata,
    amr: [{ method: "password", timestamp: now }],
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.id)
    .setAudience("authenticated")
    .setIssuer(ISSUER)
    .setIssuedAt(now)
    .setExpirationTime(expiresIn)
    .sign(jwtSecret());
}

export async function mintRefreshToken(user: AppUser): Promise<string> {
  return new SignJWT({ role: "authenticated", typ: "refresh" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.id)
    .setAudience("authenticated")
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(jwtSecret());
}

/** Long-lived keys that mirror Supabase anon / service_role API keys. */
export async function mintApiKey(role: "anon" | "service_role"): Promise<string> {
  return new SignJWT({ role, iss: ISSUER })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setAudience(role === "anon" ? "authenticated" : "service_role")
    .setIssuedAt()
    .setExpirationTime("10y")
    .sign(jwtSecret());
}

export async function verifyAccessToken(token: string): Promise<{ sub: string; role: string; payload: any } | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret(), { issuer: ISSUER });
    return {
      sub: String(payload.sub || ""),
      role: String((payload as any).role || "authenticated"),
      payload,
    };
  } catch {
    return null;
  }
}

export async function findUserByEmail(email: string) {
  const { rows } = await query<any>(
    `SELECT * FROM auth.users WHERE lower(email) = lower($1) AND deleted_at IS NULL LIMIT 1`,
    [email.trim()]
  );
  return rows[0] || null;
}

export async function findUserById(id: string) {
  const { rows } = await query<any>(
    `SELECT * FROM auth.users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export async function verifyPassword(row: any, password: string): Promise<boolean> {
  if (!row?.encrypted_password) return false;
  return bcrypt.compareSync(password, row.encrypted_password);
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export async function createUser(opts: {
  email: string;
  password: string;
  user_metadata?: Record<string, any>;
  email_confirm?: boolean;
}): Promise<AppUser> {
  const id = crypto.randomUUID();
  const hash = hashPassword(opts.password);
  const meta = opts.user_metadata || {};
  const confirmed = opts.email_confirm !== false ? new Date().toISOString() : null;
  const { rows } = await query<any>(
    `INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
      $1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      $2, $3, $4, $5::jsonb, $6::jsonb, now(), now()
    ) RETURNING *`,
    [
      id,
      opts.email.trim().toLowerCase(),
      hash,
      confirmed,
      JSON.stringify({ provider: "email", providers: ["email"] }),
      JSON.stringify(meta),
    ]
  );
  // Ensure profile exists (handle_new_user may or may not fire depending on triggers)
  await query(
    `INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
     VALUES ($1, $2, $3, 'customer', now(), now())
     ON CONFLICT (id) DO NOTHING`,
    [id, opts.email.trim().toLowerCase(), meta.full_name || [meta.first_name, meta.last_name].filter(Boolean).join(" ") || null]
  );
  return rowToUser(rows[0]);
}

export async function updateUserPassword(userId: string, password: string) {
  const hash = hashPassword(password);
  await query(
    `UPDATE auth.users SET encrypted_password = $1, updated_at = now(),
      recovery_token = '', recovery_sent_at = NULL WHERE id = $2`,
    [hash, userId]
  );
}

export async function updateUserMetadata(userId: string, userMeta: Record<string, any>, appMeta?: Record<string, any>) {
  if (appMeta) {
    await query(
      `UPDATE auth.users SET raw_user_meta_data = COALESCE(raw_user_meta_data,'{}'::jsonb) || $1::jsonb,
        raw_app_meta_data = COALESCE(raw_app_meta_data,'{}'::jsonb) || $2::jsonb,
        updated_at = now() WHERE id = $3`,
      [JSON.stringify(userMeta), JSON.stringify(appMeta), userId]
    );
  } else {
    await query(
      `UPDATE auth.users SET raw_user_meta_data = COALESCE(raw_user_meta_data,'{}'::jsonb) || $1::jsonb,
        updated_at = now() WHERE id = $2`,
      [JSON.stringify(userMeta), userId]
    );
  }
  return findUserById(userId);
}

export async function setRecoveryToken(email: string): Promise<string | null> {
  const row = await findUserByEmail(email);
  if (!row) return null;
  const token = randomBytes(32).toString("hex");
  await query(
    `UPDATE auth.users SET recovery_token = $1, recovery_sent_at = now(), updated_at = now() WHERE id = $2`,
    [token, row.id]
  );
  return token;
}

export async function findUserByRecoveryToken(token: string) {
  const { rows } = await query<any>(
    `SELECT * FROM auth.users WHERE recovery_token = $1 AND deleted_at IS NULL LIMIT 1`,
    [token]
  );
  return rows[0] || null;
}

export async function touchSignIn(userId: string) {
  await query(`UPDATE auth.users SET last_sign_in_at = now(), updated_at = now() WHERE id = $1`, [userId]);
}

export async function sessionPayload(user: AppUser, accessToken: string) {
  const refresh = await mintRefreshToken(user);
  return {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: 604800,
    expires_at: Math.floor(Date.now() / 1000) + 604800,
    refresh_token: refresh,
    user: {
      id: user.id,
      aud: user.aud,
      role: user.role,
      email: user.email,
      email_confirmed_at: user.email_confirmed_at,
      phone: user.phone,
      confirmed_at: user.email_confirmed_at,
      last_sign_in_at: new Date().toISOString(),
      app_metadata: user.app_metadata,
      user_metadata: user.user_metadata,
      identities: [],
      created_at: user.created_at,
      updated_at: user.updated_at,
      is_anonymous: false,
    },
  };
}

export { rowToUser };
