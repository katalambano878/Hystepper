# Hy_stepper: Supabase → Plain Postgres (big-vps)

## Architecture

| Old (Supabase) | New (big-vps) |
|---|---|
| Hosted Postgres + RLS | `fleet-postgres` database `hystepper` |
| PostgREST (Kong) | `hystepper-rest` container (PostgREST 12) |
| GoTrue Auth | Next.js `/auth/v1/*` (JWT + bcrypt against `auth.users`) |
| Storage (S3) | Disk at `/data/hystepper/storage` → `/app/.storage` |
| `*.supabase.co` URLs | `https://hystepper.com` (same `/rest`, `/auth`, `/storage` paths) |

The browser still uses `@supabase/supabase-js` with:
- `NEXT_PUBLIC_SUPABASE_URL=https://hystepper.com`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = long-lived JWT (`role=anon`) signed with `JWT_SECRET`

## Coolify

- App UUID: `vqivdsmkfjlohkcl72lo6qh1`
- Project: `hystepper`
- PostgREST: docker `hystepper-rest` on `coolify` network
- Volume: host `/data/hystepper/storage` → container `/app/.storage`

## Secrets (local)

- `~/.config/coolify-vps/hystepper-pg-pw`
- `~/.config/coolify-vps/hystepper-jwt-secret`
- `~/.config/coolify-vps/hystepper-anon-key`
- `~/.config/coolify-vps/hystepper-service-role-key`

## DNS cutover

Point `hystepper.com` + `www` **A records** to `169.58.8.203` (big-vps).
Keep coolify-vps app stopped-but-intact for ~1 week as rollback.

## Rollback

1. Point DNS back to `84.247.165.196`
2. Old Supabase project `rwsentatgbmxlfaecnqm` remains untouched
