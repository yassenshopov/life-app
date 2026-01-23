-- Migration: Add related_notion_page_ids to media table
-- Description: Stores Notion "Related" relation page IDs for grouping
-- Created: 2026

ALTER TABLE media
ADD COLUMN IF NOT EXISTS related_notion_page_ids TEXT[] NULL;

CREATE INDEX IF NOT EXISTS idx_media_related_notion_page_ids
ON media USING GIN (related_notion_page_ids);

COMMENT ON COLUMN media.related_notion_page_ids IS 'Array of related Notion page IDs from the Related relation property';
