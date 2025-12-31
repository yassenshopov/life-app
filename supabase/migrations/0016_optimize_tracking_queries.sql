-- Migration: Optimize tracking table queries
-- Description: Add indices for efficient date-based queries and sorting
-- Created: 2025

-- Add indices on created_at for efficient sorting
CREATE INDEX IF NOT EXISTS idx_tracking_daily_created_at ON tracking_daily(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_weekly_created_at ON tracking_weekly(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_monthly_created_at ON tracking_monthly(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_quarterly_created_at ON tracking_quarterly(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_yearly_created_at ON tracking_yearly(created_at DESC);

-- Add composite indices for user_id + created_at (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_tracking_daily_user_created ON tracking_daily(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_weekly_user_created ON tracking_weekly(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_monthly_user_created ON tracking_monthly(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_quarterly_user_created ON tracking_quarterly(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_yearly_user_created ON tracking_yearly(user_id, created_at DESC);

-- Add GIN indices on specific JSONB paths for faster property extraction
-- These help with queries that filter by date in properties
CREATE INDEX IF NOT EXISTS idx_tracking_daily_properties_date ON tracking_daily USING GIN ((properties -> 'Date'));
CREATE INDEX IF NOT EXISTS idx_tracking_daily_properties_date_lower ON tracking_daily USING GIN ((properties -> 'date'));
CREATE INDEX IF NOT EXISTS idx_tracking_weekly_properties_date ON tracking_weekly USING GIN ((properties -> 'Date'));
CREATE INDEX IF NOT EXISTS idx_tracking_weekly_properties_date_lower ON tracking_weekly USING GIN ((properties -> 'date'));
CREATE INDEX IF NOT EXISTS idx_tracking_monthly_properties_date ON tracking_monthly USING GIN ((properties -> 'Date'));
CREATE INDEX IF NOT EXISTS idx_tracking_monthly_properties_date_lower ON tracking_monthly USING GIN ((properties -> 'date'));
CREATE INDEX IF NOT EXISTS idx_tracking_quarterly_properties_date ON tracking_quarterly USING GIN ((properties -> 'Date'));
CREATE INDEX IF NOT EXISTS idx_tracking_quarterly_properties_date_lower ON tracking_quarterly USING GIN ((properties -> 'date'));
CREATE INDEX IF NOT EXISTS idx_tracking_yearly_properties_date ON tracking_yearly USING GIN ((properties -> 'Date'));
CREATE INDEX IF NOT EXISTS idx_tracking_yearly_properties_date_lower ON tracking_yearly USING GIN ((properties -> 'date'));



