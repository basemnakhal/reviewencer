-- ============================================================
-- Reviews table RLS setup
-- ============================================================

-- Security-definer function avoids RLS recursion if profiles
-- ever gets row-level security enabled later.
CREATE OR REPLACE FUNCTION is_moderator_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('moderator', 'admin')
  );
$$;

-- Enable RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (clean slate)
DROP POLICY IF EXISTS "anon insert review"             ON reviews;
DROP POLICY IF EXISTS "moderators full reviews"        ON reviews;
DROP POLICY IF EXISTS "public read reviews"            ON reviews;
DROP POLICY IF EXISTS "users update own pending review" ON reviews;
DROP POLICY IF EXISTS "reviews_insert"                 ON reviews;
DROP POLICY IF EXISTS "reviews_select"                 ON reviews;
DROP POLICY IF EXISTS "reviews_update_own"             ON reviews;
DROP POLICY IF EXISTS "reviews_moderator_all"          ON reviews;

-- 1. INSERT — anon + authenticated (supports unauthenticated draft flow)
CREATE POLICY "reviews_insert"
ON reviews
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- 2. SELECT — published reviews visible to all; own reviews visible to author;
--            moderators/admins see everything
CREATE POLICY "reviews_select"
ON reviews
FOR SELECT
TO anon, authenticated
USING (
  moderation_status = 'published'
  OR auth.uid() = author_id
  OR is_moderator_or_admin()
);

-- 3. UPDATE — authors can only touch their own pending reviews;
--             both USING and WITH CHECK enforce pending so they
--             cannot flip moderation_status themselves
CREATE POLICY "reviews_update_own"
ON reviews
FOR UPDATE
TO authenticated
USING  (auth.uid() = author_id AND moderation_status = 'pending')
WITH CHECK (auth.uid() = author_id AND moderation_status = 'pending');

-- 4. ALL — moderators and admins have unrestricted access
CREATE POLICY "reviews_moderator_all"
ON reviews
FOR ALL
TO authenticated
USING  (is_moderator_or_admin())
WITH CHECK (is_moderator_or_admin());
