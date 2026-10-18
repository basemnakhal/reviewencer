-- ============================================================
-- Add tier column to profiles + auto-sync trigger
-- ============================================================

-- 1. Add column
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'reviewer'
  CHECK (tier IN ('reviewer', 'top_reviewer', 'reviewencer'));

-- 2. Core recalculation function — called by trigger and backfill
CREATE OR REPLACE FUNCTION recalculate_tier(p_author_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_legit integer;
  new_tier    text;
BEGIN
  SELECT COALESCE(SUM(legit_count), 0)
  INTO total_legit
  FROM reviews
  WHERE author_id = p_author_id;

  new_tier := CASE
    WHEN total_legit >= 100 THEN 'reviewencer'
    WHEN total_legit >= 10  THEN 'top_reviewer'
    ELSE                        'reviewer'
  END;

  UPDATE profiles SET tier = new_tier WHERE id = p_author_id;
END;
$$;

-- 3. Trigger function
CREATE OR REPLACE FUNCTION trigger_sync_author_tier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.author_id IS NOT NULL THEN
      PERFORM recalculate_tier(OLD.author_id);
    END IF;
    RETURN OLD;
  END IF;

  -- INSERT: always recalculate (review starts at 0 legit but keeps logic consistent)
  -- UPDATE: only recalculate when legit_count actually changed
  IF TG_OP = 'INSERT'
     OR (TG_OP = 'UPDATE' AND NEW.legit_count IS DISTINCT FROM OLD.legit_count)
  THEN
    IF NEW.author_id IS NOT NULL THEN
      PERFORM recalculate_tier(NEW.author_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Attach trigger (drop first so re-runs are idempotent)
DROP TRIGGER IF EXISTS sync_author_tier ON reviews;
CREATE TRIGGER sync_author_tier
AFTER INSERT OR UPDATE OF legit_count OR DELETE
ON reviews
FOR EACH ROW EXECUTE FUNCTION trigger_sync_author_tier();

-- 5. Backfill all existing authors
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT author_id
    FROM reviews
    WHERE author_id IS NOT NULL
  LOOP
    PERFORM recalculate_tier(r.author_id);
  END LOOP;
END;
$$;
