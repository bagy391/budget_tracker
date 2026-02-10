-- Remove family_id from wealth_assets since wealth is user-based, not family-based
ALTER TABLE wealth_assets DROP COLUMN family_id;
