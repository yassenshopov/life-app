-- Migration: Drop unused GIN indexes on tracking table properties
-- Description: Remove unused GIN indexes on properties -> 'Date' and properties -> 'date' 
--              for all tracking tables to avoid unnecessary write overhead
-- Created: 2025

-- Drop GIN indices on specific JSONB paths that are unused
-- These were created in migration 0016 but are not being used in queries

-- Daily tracking table
DROP INDEX IF EXISTS idx_tracking_daily_properties_date;
DROP INDEX IF EXISTS idx_tracking_daily_properties_date_lower;

-- Weekly tracking table
DROP INDEX IF EXISTS idx_tracking_weekly_properties_date;
DROP INDEX IF EXISTS idx_tracking_weekly_properties_date_lower;

-- Monthly tracking table
DROP INDEX IF EXISTS idx_tracking_monthly_properties_date;
DROP INDEX IF EXISTS idx_tracking_monthly_properties_date_lower;

-- Quarterly tracking table
DROP INDEX IF EXISTS idx_tracking_quarterly_properties_date;
DROP INDEX IF EXISTS idx_tracking_quarterly_properties_date_lower;

-- Yearly tracking table
DROP INDEX IF EXISTS idx_tracking_yearly_properties_date;
DROP INDEX IF EXISTS idx_tracking_yearly_properties_date_lower;






