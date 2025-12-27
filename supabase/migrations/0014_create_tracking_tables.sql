-- Migration: Create tracking tables
-- Description: Stores synced Daily/Weekly/Monthly/Quarterly/Yearly tracking entries from Notion databases
-- Created: 2024

-- Daily Tracking Table
CREATE TABLE IF NOT EXISTS tracking_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  notion_page_id TEXT NOT NULL,
  notion_database_id TEXT NOT NULL,
  period TEXT NOT NULL DEFAULT 'daily',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Core fields
  title TEXT NOT NULL DEFAULT 'Untitled',
  
  -- Flexible properties storage - all Notion properties stored as JSONB
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  CONSTRAINT fk_tracking_daily_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT unique_tracking_daily_user_page UNIQUE (user_id, notion_page_id)
);

-- Weekly Tracking Table
CREATE TABLE IF NOT EXISTS tracking_weekly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  notion_page_id TEXT NOT NULL,
  notion_database_id TEXT NOT NULL,
  period TEXT NOT NULL DEFAULT 'weekly',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Core fields
  title TEXT NOT NULL DEFAULT 'Untitled',
  
  -- Flexible properties storage - all Notion properties stored as JSONB
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  CONSTRAINT fk_tracking_weekly_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT unique_tracking_weekly_user_page UNIQUE (user_id, notion_page_id)
);

-- Monthly Tracking Table
CREATE TABLE IF NOT EXISTS tracking_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  notion_page_id TEXT NOT NULL,
  notion_database_id TEXT NOT NULL,
  period TEXT NOT NULL DEFAULT 'monthly',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Core fields
  title TEXT NOT NULL DEFAULT 'Untitled',
  
  -- Flexible properties storage - all Notion properties stored as JSONB
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  CONSTRAINT fk_tracking_monthly_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT unique_tracking_monthly_user_page UNIQUE (user_id, notion_page_id)
);

-- Quarterly Tracking Table
CREATE TABLE IF NOT EXISTS tracking_quarterly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  notion_page_id TEXT NOT NULL,
  notion_database_id TEXT NOT NULL,
  period TEXT NOT NULL DEFAULT 'quarterly',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Core fields
  title TEXT NOT NULL DEFAULT 'Untitled',
  
  -- Flexible properties storage - all Notion properties stored as JSONB
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  CONSTRAINT fk_tracking_quarterly_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT unique_tracking_quarterly_user_page UNIQUE (user_id, notion_page_id)
);

-- Yearly Tracking Table
CREATE TABLE IF NOT EXISTS tracking_yearly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  notion_page_id TEXT NOT NULL,
  notion_database_id TEXT NOT NULL,
  period TEXT NOT NULL DEFAULT 'yearly',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Core fields
  title TEXT NOT NULL DEFAULT 'Untitled',
  
  -- Flexible properties storage - all Notion properties stored as JSONB
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  CONSTRAINT fk_tracking_yearly_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT unique_tracking_yearly_user_page UNIQUE (user_id, notion_page_id)
);

-- Create indexes for efficient queries
-- Daily
CREATE INDEX IF NOT EXISTS idx_tracking_daily_user_id ON tracking_daily(user_id);
CREATE INDEX IF NOT EXISTS idx_tracking_daily_notion_page_id ON tracking_daily(notion_page_id);
CREATE INDEX IF NOT EXISTS idx_tracking_daily_notion_database_id ON tracking_daily(notion_database_id);
CREATE INDEX IF NOT EXISTS idx_tracking_daily_properties ON tracking_daily USING GIN (properties);

-- Weekly
CREATE INDEX IF NOT EXISTS idx_tracking_weekly_user_id ON tracking_weekly(user_id);
CREATE INDEX IF NOT EXISTS idx_tracking_weekly_notion_page_id ON tracking_weekly(notion_page_id);
CREATE INDEX IF NOT EXISTS idx_tracking_weekly_notion_database_id ON tracking_weekly(notion_database_id);
CREATE INDEX IF NOT EXISTS idx_tracking_weekly_properties ON tracking_weekly USING GIN (properties);

-- Monthly
CREATE INDEX IF NOT EXISTS idx_tracking_monthly_user_id ON tracking_monthly(user_id);
CREATE INDEX IF NOT EXISTS idx_tracking_monthly_notion_page_id ON tracking_monthly(notion_page_id);
CREATE INDEX IF NOT EXISTS idx_tracking_monthly_notion_database_id ON tracking_monthly(notion_database_id);
CREATE INDEX IF NOT EXISTS idx_tracking_monthly_properties ON tracking_monthly USING GIN (properties);

-- Quarterly
CREATE INDEX IF NOT EXISTS idx_tracking_quarterly_user_id ON tracking_quarterly(user_id);
CREATE INDEX IF NOT EXISTS idx_tracking_quarterly_notion_page_id ON tracking_quarterly(notion_page_id);
CREATE INDEX IF NOT EXISTS idx_tracking_quarterly_notion_database_id ON tracking_quarterly(notion_database_id);
CREATE INDEX IF NOT EXISTS idx_tracking_quarterly_properties ON tracking_quarterly USING GIN (properties);

-- Yearly
CREATE INDEX IF NOT EXISTS idx_tracking_yearly_user_id ON tracking_yearly(user_id);
CREATE INDEX IF NOT EXISTS idx_tracking_yearly_notion_page_id ON tracking_yearly(notion_page_id);
CREATE INDEX IF NOT EXISTS idx_tracking_yearly_notion_database_id ON tracking_yearly(notion_database_id);
CREATE INDEX IF NOT EXISTS idx_tracking_yearly_properties ON tracking_yearly USING GIN (properties);

-- Add comments
COMMENT ON TABLE tracking_daily IS 'Synced Daily tracking entries from Notion database';
COMMENT ON TABLE tracking_weekly IS 'Synced Weekly tracking entries from Notion database';
COMMENT ON TABLE tracking_monthly IS 'Synced Monthly tracking entries from Notion database';
COMMENT ON TABLE tracking_quarterly IS 'Synced Quarterly tracking entries from Notion database';
COMMENT ON TABLE tracking_yearly IS 'Synced Yearly tracking entries from Notion database';

COMMENT ON COLUMN tracking_daily.notion_page_id IS 'Notion page ID for this tracking entry';
COMMENT ON COLUMN tracking_daily.notion_database_id IS 'Notion database ID that this entry belongs to';
COMMENT ON COLUMN tracking_daily.last_synced_at IS 'When this entry was last synced from Notion';
COMMENT ON COLUMN tracking_daily.properties IS 'All Notion properties stored as JSONB for flexible schema';
COMMENT ON COLUMN tracking_daily.period IS 'Tracking period type (daily, weekly, monthly, quarterly, yearly)';

