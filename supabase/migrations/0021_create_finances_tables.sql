-- Migration: Create finances tables
-- Description: Stores synced finance data from Notion databases (Assets, Individual Investments, Places)
-- Created: 2025

-- Assets Table (e.g., Bitcoin, SPY, etc.)
CREATE TABLE IF NOT EXISTS finances_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  notion_page_id TEXT NOT NULL,
  notion_database_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Core fields
  name TEXT NOT NULL,
  
  -- Common finance properties (can be null if not present in Notion)
  symbol TEXT NULL, -- ticker symbol (from Ticker select field)
  current_price NUMERIC NULL, -- current price per unit (from Current Price)
  summary TEXT NULL, -- summary/description (from Summary rich_text)
  currency TEXT NULL DEFAULT 'USD',
  icon JSONB NULL, -- Notion page icon (emoji, external, or file)
  
  -- Flexible properties storage - all Notion properties stored as JSONB
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  CONSTRAINT fk_finances_assets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT unique_finances_assets_user_page UNIQUE (user_id, notion_page_id)
);

-- Places Table (bank accounts, brokerage accounts, etc.)
-- Created before investments because investments reference places
CREATE TABLE IF NOT EXISTS finances_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  notion_page_id TEXT NOT NULL,
  notion_database_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Core fields
  name TEXT NOT NULL,
  
  -- Common finance properties
  place_type TEXT NULL, -- from Tags multi_select (first tag: Bank Account, Investments, Crypto Exchange Wallet, Cold Wallet)
  balance NUMERIC NULL, -- bank balance (from Value [Bank])
  total_value NUMERIC NULL, -- total value in USD (from Value [USD] formula)
  currency TEXT NULL DEFAULT 'USD',
  
  -- Flexible properties storage - all Notion properties stored as JSONB
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  CONSTRAINT fk_finances_places_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT unique_finances_places_user_page UNIQUE (user_id, notion_page_id)
);

-- Individual Investments Table (individual investment entries)
CREATE TABLE IF NOT EXISTS finances_individual_investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  notion_page_id TEXT NOT NULL,
  notion_database_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Core fields
  name TEXT NOT NULL,
  
  -- Common finance properties
  asset_id UUID NULL, -- relation to finances_assets (from Asset relation)
  place_id UUID NULL, -- relation to finances_places (from Facet in NW relation)
  quantity NUMERIC NULL, -- number of shares/units (from Units formula)
  purchase_price NUMERIC NULL, -- price per unit at purchase (from Price at BUY)
  purchase_date TIMESTAMP WITH TIME ZONE NULL, -- when purchased (from Date)
  current_price NUMERIC NULL, -- current price per unit (from Current price rollup)
  current_value NUMERIC NULL, -- current total value (from Result formula)
  currency TEXT NULL DEFAULT 'USD',
  
  -- Flexible properties storage - all Notion properties stored as JSONB
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  CONSTRAINT fk_finances_investments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_finances_investments_asset FOREIGN KEY (asset_id) REFERENCES finances_assets(id) ON DELETE SET NULL,
  CONSTRAINT fk_finances_investments_place FOREIGN KEY (place_id) REFERENCES finances_places(id) ON DELETE SET NULL,
  CONSTRAINT unique_finances_investments_user_page UNIQUE (user_id, notion_page_id)
);

-- Create indexes for efficient queries
-- Assets
CREATE INDEX IF NOT EXISTS idx_finances_assets_user_id ON finances_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_finances_assets_notion_page_id ON finances_assets(notion_page_id);
CREATE INDEX IF NOT EXISTS idx_finances_assets_notion_database_id ON finances_assets(notion_database_id);
CREATE INDEX IF NOT EXISTS idx_finances_assets_properties ON finances_assets USING GIN (properties);
CREATE INDEX IF NOT EXISTS idx_finances_assets_symbol ON finances_assets(symbol);

-- Places
CREATE INDEX IF NOT EXISTS idx_finances_places_user_id ON finances_places(user_id);
CREATE INDEX IF NOT EXISTS idx_finances_places_notion_page_id ON finances_places(notion_page_id);
CREATE INDEX IF NOT EXISTS idx_finances_places_notion_database_id ON finances_places(notion_database_id);
CREATE INDEX IF NOT EXISTS idx_finances_places_properties ON finances_places USING GIN (properties);
CREATE INDEX IF NOT EXISTS idx_finances_places_place_type ON finances_places(place_type);

-- Individual Investments
CREATE INDEX IF NOT EXISTS idx_finances_investments_user_id ON finances_individual_investments(user_id);
CREATE INDEX IF NOT EXISTS idx_finances_investments_notion_page_id ON finances_individual_investments(notion_page_id);
CREATE INDEX IF NOT EXISTS idx_finances_investments_notion_database_id ON finances_individual_investments(notion_database_id);
CREATE INDEX IF NOT EXISTS idx_finances_investments_properties ON finances_individual_investments USING GIN (properties);
CREATE INDEX IF NOT EXISTS idx_finances_investments_asset_id ON finances_individual_investments(asset_id);
CREATE INDEX IF NOT EXISTS idx_finances_investments_place_id ON finances_individual_investments(place_id);
CREATE INDEX IF NOT EXISTS idx_finances_investments_purchase_date ON finances_individual_investments(purchase_date);

-- Add comments
COMMENT ON TABLE finances_assets IS 'Synced Assets entries from Notion database (e.g., Bitcoin, SPY)';
COMMENT ON TABLE finances_individual_investments IS 'Synced Individual Investments entries from Notion database';
COMMENT ON TABLE finances_places IS 'Synced Places entries from Notion database (bank accounts, brokerage accounts, etc.)';

COMMENT ON COLUMN finances_assets.notion_page_id IS 'Notion page ID for this asset entry';
COMMENT ON COLUMN finances_assets.notion_database_id IS 'Notion database ID that this asset belongs to';
COMMENT ON COLUMN finances_assets.last_synced_at IS 'When this entry was last synced from Notion';
COMMENT ON COLUMN finances_assets.properties IS 'All Notion properties stored as JSONB for flexible schema';

COMMENT ON COLUMN finances_individual_investments.notion_page_id IS 'Notion page ID for this investment entry';
COMMENT ON COLUMN finances_individual_investments.notion_database_id IS 'Notion database ID that this investment belongs to';
COMMENT ON COLUMN finances_individual_investments.last_synced_at IS 'When this entry was last synced from Notion';
COMMENT ON COLUMN finances_individual_investments.properties IS 'All Notion properties stored as JSONB for flexible schema';
COMMENT ON COLUMN finances_individual_investments.asset_id IS 'Foreign key to finances_assets table';

COMMENT ON COLUMN finances_places.notion_page_id IS 'Notion page ID for this place entry';
COMMENT ON COLUMN finances_places.notion_database_id IS 'Notion database ID that this place belongs to';
COMMENT ON COLUMN finances_places.last_synced_at IS 'When this entry was last synced from Notion';
COMMENT ON COLUMN finances_places.properties IS 'All Notion properties stored as JSONB for flexible schema';

