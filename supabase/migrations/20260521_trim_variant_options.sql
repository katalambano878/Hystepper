-- Clean up product_variants: strip stray leading/trailing whitespace from
-- the identifying columns so exact-match comparisons in the UI don't fail
-- silently (e.g. "Black " never matching the trimmed "Black" the colour
-- picker stores in state). Also backfill option1 (size) from the "Size /
-- Colour" prefix in `name` when it's null, so the data model is consistent
-- and future code can rely on option1 alone for the size axis.

UPDATE public.product_variants
SET
    name    = btrim(name),
    option1 = NULLIF(btrim(option1), ''),
    option2 = NULLIF(btrim(option2), ''),
    option3 = NULLIF(btrim(option3), '')
WHERE
    name    IS DISTINCT FROM btrim(name)
    OR option1 IS DISTINCT FROM NULLIF(btrim(option1), '')
    OR option2 IS DISTINCT FROM NULLIF(btrim(option2), '')
    OR option3 IS DISTINCT FROM NULLIF(btrim(option3), '');

-- Backfill option1 from the size prefix in `name` (e.g. "36 / Black" -> "36")
-- when option1 is currently null/blank but the name follows the convention.
UPDATE public.product_variants
SET option1 = btrim(split_part(name, ' / ', 1))
WHERE
    (option1 IS NULL OR btrim(option1) = '')
    AND name IS NOT NULL
    AND position(' / ' IN name) > 0
    AND btrim(split_part(name, ' / ', 1)) <> '';
