-- ---------------------------------------------------------------------------
-- Make sure "Shoes" lists before "Others" on /categories.
-- ---------------------------------------------------------------------------
-- The /categories page sorts by categories.position ASC. Existing rows
-- haven't had positions assigned, so we (a) seed deterministic positions
-- for any rows still at the default and (b) explicitly push Shoes ahead of
-- Others if they're still tied / out of order.

-- 1. Seed positions for categories that don't have a meaningful value yet.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
  FROM categories
  WHERE parent_id IS NULL
)
UPDATE categories c
SET position = ranked.rn
FROM ranked
WHERE c.id = ranked.id
  AND COALESCE(c.position, 0) = 0;

-- 2. Force Shoes to come before Others when both exist as top-level rows.
DO $$
DECLARE
  shoes_id    UUID;
  shoes_pos   INT;
  others_pos  INT;
BEGIN
  SELECT id, position INTO shoes_id, shoes_pos
  FROM categories
  WHERE LOWER(name) = 'shoes' AND parent_id IS NULL
  ORDER BY created_at ASC
  LIMIT 1;

  SELECT position INTO others_pos
  FROM categories
  WHERE LOWER(name) = 'others' AND parent_id IS NULL
  ORDER BY created_at ASC
  LIMIT 1;

  IF shoes_id IS NOT NULL
     AND others_pos IS NOT NULL
     AND COALESCE(shoes_pos, 0) >= COALESCE(others_pos, 0) THEN
    UPDATE categories
    SET position = COALESCE(others_pos, 1) - 1
    WHERE id = shoes_id;
  END IF;
END $$;
