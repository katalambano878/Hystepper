-- Normalize products.heel_height values to the canonical filter buckets
-- (Flat / Low / Mid / High) so legacy products that used the old free-text
-- input still match the homepage "Shop by Heel Height" links.
--
-- Anything that obviously refers to one of the buckets (case-insensitive,
-- including a "flats" plural) is rewritten. Numeric heights like
-- "0.5 inch" / "2 inches" / "3in" are bucketed by approximate inches:
--   < 1"  -> Flat
--   1..<2 -> Low
--   2..<3 -> Mid
--   >= 3" -> High
-- Anything we can't confidently classify is left as-is so the admin can
-- re-pick from the new dropdown.

UPDATE public.products
SET heel_height = CASE
    WHEN btrim(heel_height) ILIKE 'flat%' THEN 'Flat'
    WHEN btrim(heel_height) ILIKE 'low%'  THEN 'Low'
    WHEN btrim(heel_height) ILIKE 'mid%'  THEN 'Mid'
    WHEN btrim(heel_height) ILIKE 'high%' THEN 'High'
    WHEN heel_height ~* '^\s*([0-9]+(?:\.[0-9]+)?)\s*(in|inch|"|inches)?\s*$' THEN
        CASE
            WHEN (regexp_match(heel_height, '([0-9]+(?:\.[0-9]+)?)'))[1]::numeric < 1   THEN 'Flat'
            WHEN (regexp_match(heel_height, '([0-9]+(?:\.[0-9]+)?)'))[1]::numeric < 2   THEN 'Low'
            WHEN (regexp_match(heel_height, '([0-9]+(?:\.[0-9]+)?)'))[1]::numeric < 3   THEN 'Mid'
            ELSE 'High'
        END
    ELSE heel_height
END
WHERE heel_height IS NOT NULL
  AND btrim(heel_height) <> ''
  AND heel_height NOT IN ('Flat', 'Low', 'Mid', 'High');
