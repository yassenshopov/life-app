-- Migration: Add color_settings column to finances_assets table
-- Description: Allows manual override of asset colors for UI display
-- Created: 2025

ALTER TABLE finances_assets
ADD COLUMN IF NOT EXISTS color_settings JSONB NULL;

COMMENT ON COLUMN finances_assets.color_settings IS 'Manual color settings for asset display (e.g., {"primary": "#228B22", "badge": "#228B22"})';

