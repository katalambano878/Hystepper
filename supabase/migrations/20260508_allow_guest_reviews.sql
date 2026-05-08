-- Allow customers without an account to leave product reviews.
--
-- Rationale: most POS / delivery customers don't have site accounts. The
-- delivered-order SMS link drops them on the review form, so we need
-- guest-friendly columns and an RLS policy that lets anon insert. Reviews
-- still default to status='pending' and only show to the public after an
-- admin approves them, so this isn't a spam vector.

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS guest_name  TEXT,
  ADD COLUMN IF NOT EXISTS guest_email TEXT,
  ADD COLUMN IF NOT EXISTS guest_phone TEXT;

-- Replace the old "auth.uid() = user_id" insert policy so we can also
-- accept guest reviews. Authenticated users still must own their row;
-- anon must include a non-empty guest_name and not pretend to be someone
-- by setting user_id.
DROP POLICY IF EXISTS "Users create reviews" ON public.reviews;

CREATE POLICY "Users create reviews"
ON public.reviews
FOR INSERT
WITH CHECK (
  -- Inserts must always start in pending state — admin approves before
  -- the public can see them. Belt-and-braces against a guest sneaking in
  -- a self-approved review.
  status = 'pending'
  AND (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR
    (auth.uid() IS NULL AND user_id IS NULL AND coalesce(btrim(guest_name), '') <> '')
  )
);

-- Helpful for the admin reviews list when joining by guest_phone to spot
-- repeat reviewers / abusers.
CREATE INDEX IF NOT EXISTS idx_reviews_guest_phone
  ON public.reviews (guest_phone)
  WHERE guest_phone IS NOT NULL;
