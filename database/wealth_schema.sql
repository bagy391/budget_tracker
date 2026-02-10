-- Wealth Management Schema
-- This creates tables for tracking various wealth assets with privacy controls

-- Create wealth_assets table
CREATE TABLE IF NOT EXISTS wealth_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    asset_type TEXT NOT NULL CHECK (asset_type IN ('mutual_fund', 'stock', 'epf', 'nps', 'bank', 'fd')),
    asset_name TEXT NOT NULL,
    invested_amount DECIMAL(12, 2) DEFAULT 0,
    current_amount DECIMAL(12, 2) DEFAULT 0,
    maturity_amount DECIMAL(12, 2), -- Only for FDs
    maturity_date DATE, -- Only for FDs
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create wealth_sharing table for privacy controls
CREATE TABLE IF NOT EXISTS wealth_sharing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES wealth_assets(id) ON DELETE CASCADE,
    shared_with_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(asset_id, shared_with_user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_wealth_assets_user_id ON wealth_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_wealth_assets_family_id ON wealth_assets(family_id);
CREATE INDEX IF NOT EXISTS idx_wealth_assets_maturity_date ON wealth_assets(maturity_date) WHERE maturity_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wealth_sharing_asset_id ON wealth_sharing(asset_id);
CREATE INDEX IF NOT EXISTS idx_wealth_sharing_shared_with_user_id ON wealth_sharing(shared_with_user_id);

-- Enable Row Level Security
ALTER TABLE wealth_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wealth_sharing ENABLE ROW LEVEL SECURITY;

-- RLS Policies for wealth_assets
-- Users can view their own assets
CREATE POLICY "Users can view own wealth assets"
    ON wealth_assets FOR SELECT
    USING (auth.uid() = user_id);

-- Users can view assets shared with them
CREATE POLICY "Users can view shared wealth assets"
    ON wealth_assets FOR SELECT
    USING (
        id IN (
            SELECT asset_id 
            FROM wealth_sharing 
            WHERE shared_with_user_id = auth.uid()
        )
    );

-- Users can insert their own assets
CREATE POLICY "Users can insert own wealth assets"
    ON wealth_assets FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own assets
CREATE POLICY "Users can update own wealth assets"
    ON wealth_assets FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own assets
CREATE POLICY "Users can delete own wealth assets"
    ON wealth_assets FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies for wealth_sharing
-- Users can view sharing records for their own assets
CREATE POLICY "Users can view sharing for own assets"
    ON wealth_sharing FOR SELECT
    USING (
        asset_id IN (
            SELECT id 
            FROM wealth_assets 
            WHERE user_id = auth.uid()
        )
    );

-- Users can insert sharing records for their own assets
CREATE POLICY "Users can create sharing for own assets"
    ON wealth_sharing FOR INSERT
    WITH CHECK (
        asset_id IN (
            SELECT id 
            FROM wealth_assets 
            WHERE user_id = auth.uid()
        )
    );

-- Users can delete sharing records for their own assets
CREATE POLICY "Users can delete sharing for own assets"
    ON wealth_sharing FOR DELETE
    USING (
        asset_id IN (
            SELECT id 
            FROM wealth_assets 
            WHERE user_id = auth.uid()
        )
    );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_wealth_assets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_wealth_assets_timestamp ON wealth_assets;
CREATE TRIGGER update_wealth_assets_timestamp
    BEFORE UPDATE ON wealth_assets
    FOR EACH ROW
    EXECUTE FUNCTION update_wealth_assets_updated_at();
