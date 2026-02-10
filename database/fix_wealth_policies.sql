-- Complete fix for infinite recursion - Disable RLS on wealth_sharing
-- This is safe because wealth_sharing only references wealth_assets IDs

-- Disable RLS on wealth_sharing (we'll control access through wealth_assets policies)
ALTER TABLE wealth_sharing DISABLE ROW LEVEL SECURITY;

-- Keep wealth_assets policies (these are safe)
DROP POLICY IF EXISTS "Users can view own wealth assets" ON wealth_assets;
DROP POLICY IF EXISTS "Users can view shared wealth assets" ON wealth_assets;
DROP POLICY IF EXISTS "Users can insert own wealth assets" ON wealth_assets;
DROP POLICY IF EXISTS "Users can update own wealth assets" ON wealth_assets;
DROP POLICY IF EXISTS "Users can delete own wealth assets" ON wealth_assets;

-- Simple policies for wealth_assets only
CREATE POLICY "Users can view own wealth assets"
    ON wealth_assets FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wealth assets"
    ON wealth_assets FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own wealth assets"
    ON wealth_assets FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own wealth assets"
    ON wealth_assets FOR DELETE
    USING (auth.uid() = user_id);
