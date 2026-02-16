# SMS & Payment Integration Status Report

**Date:** February 4, 2026
**Status:** Partial Success (SMS Sending works, Automated Trigger failing)

## 1. Overview
The SMS notification system has been implemented using the Moolre API. Direct sending works perfectly (verified via the new SMS Debugger), but the automated trigger during the Order Checkout flow is failing, likely due to the Payment Callback not successfully updating the order status.

## 2. Configuration (`.env.local` / Vercel Env)
The system supports distinct credentials for SMS vs Payments, falling back to Payment credentials if SMS ones are missing.

| Variable | Purpose | Status |
|----------|---------|--------|
| `MOOLRE_SMS_API_USER` | SMS-specific User ID | **Implemented** (Optional) |
| `MOOLRE_SMS_API_KEY` | SMS-specific VAS Key | **Implemented** (Optional) |
| `MOOLRE_SMS_API_PUBKEY`| SMS Public Key | **Implemented** (Optional) |
| `MOOLRE_API_USER` | Payment User ID (Fallback) | Used if SMS User missing |
| `MOOLRE_API_KEY` | Payment VAS Key (Fallback) | Used if SMS Key missing |

**Key Logic:** If `MOOLRE_SMS_API_USER` is set, we do *not* send the Payment Public Key to the SMS endpoint to avoid auth mismatches.

## 3. Implemented Features

### A. SMS Sending Logic (`lib/notifications.ts`)
*   **E.164 Formatting:** Automatically converts local numbers (e.g., `024...`, `050...`) to international format (`+23324...`) required by Moolre.
*   **Sender ID:** Hardcoded as `SarahLawson` (Verified).
*   **Fallback Auth:** Smartly chooses between SMS and Payment credentials.

### B. SMS Debugger (`/admin/test-sms`)
A dedicated admin page was built to isolate and test the SMS API.
*   **Path:** `app/admin/test-sms/page.tsx`
*   **Function:** sendTestSmsAction (`app/admin/test-sms/actions.ts`)
*   **Result:** CONFIRMED working. Messages are delivered.

### C. Payment Callback (`app/api/payment/moolre/callback/route.ts`)
Refactored to be extremely robust against common failures:
1.  **Robust Parsing:** Can read both `application/json` and `multipart/form-data` (in case Moolre changes payload format).
2.  **Flexible References:** Checks `externalref`, `orderRef`, and `external_reference` to find the Order ID.
3.  **Case Insensitive Status:** Accepts `Success`, `success`, `Completed`, or `1`.
4.  **Direct Notification Trigger:** Awaits the `sendOrderConfirmation` function directly instead of making an external HTTP fetch (preventing race conditions in Serverless).

## 4. Database Changes (Supabase)

### A. RLS Policies
Fixed overly strict policies that prevented Order Placement.
*   **Orders:** Guests (`user_id` is null) can now INSERT orders.
*   **Order Items:** Guests can INSERT items if they link to a valid order.
*   **Viewing:** Guests can SELECT their own orders (by ID) to view the Success Page.

### B. Secure Update Function (RPC)
Added a Postgres Function to bypass RLS permissions during callbacks (since the Callback might run as 'Anonymous' if the Service Key is missing).

*   **Function:** `mark_order_paid(order_ref, moolre_ref)`
*   **Security:** `SECURITY DEFINER` (runs as admin).
*   **Usage:** Called by the Callback endpoint to force the status to 'paid'.

## 5. Current Issue & Debugging Guide
**Symptom:** User places order -> Payment flows -> Success Page loads -> **No SMS sent.**
**Diagnosis:** The database order status remains `pending`. This means the Callback is failing to execute the RPC function.

### Troubleshooting Steps for Next Dev:
1.  **Check Vercel Logs:** Look at the logs for `POST /api/payment/moolre/callback`.
    *   Do you see `Moolre Callback Received: ...`?
    *   If NOT, Moolre is not hitting the URL. Check the `callback` URL sent in the Payment Initialization (`app/api/payment/moolre/route.ts`).
    *   If YES, look for `Callback Critical Error` or `Body parsing failed`.
2.  **Verify Payload:** The logs will show the exact JSON/Body Moolre sends. Ensure `externalref` matches the Order ID pattern (`ORD-...`).
3.  **Check Service Key:** Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel. While the RPC bypasses RLS, having the correct key is still best practice.

## 6. Relevant Files
*   `lib/notifications.ts`
*   `app/admin/test-sms/*`
*   `app/api/payment/moolre/callback/route.ts`
*   `supabase/migrations/20260204000001_fix_rls.sql`
*   `supabase/migrations/20260204000002_fix_callback.sql`
