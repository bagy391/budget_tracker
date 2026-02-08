-- Row Level Security Policy for Deleting Families
-- This allows family admins to delete their families

-- First, ensure RLS is enabled on the families table
ALTER TABLE families ENABLE ROW LEVEL SECURITY;

-- Drop existing delete policy if it exists
DROP POLICY IF EXISTS "Family admins can delete family" ON families;

-- Create policy to allow admins to delete families
CREATE POLICY "Family admins can delete family"
ON families
FOR DELETE
USING (
  id IN (
    SELECT family_id 
    FROM family_members
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Note: This policy allows only users who are admins of a family to delete that family.
-- The cascade delete should be configured on foreign keys to automatically delete:
-- - family_members
-- - expenses
-- - incomes
-- - budgets
-- - categories
-- - payment_methods
