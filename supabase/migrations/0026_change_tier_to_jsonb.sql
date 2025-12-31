-- Migration: Change tier column from TEXT[] to JSONB
-- Description: Updates tier column to store objects with name and color instead of just strings
-- Created: 2025

-- Drop the existing GIN index on tier (TEXT[] uses different index type)
DROP INDEX IF EXISTS idx_people_tier;

-- Create a function to convert TEXT[] to JSONB
CREATE OR REPLACE FUNCTION convert_tier_to_jsonb(tier_array TEXT[])
RETURNS JSONB AS $$
DECLARE
  result JSONB := '[]'::jsonb;
  elem TEXT;
  parsed JSONB;
BEGIN
  IF tier_array IS NULL THEN
    RETURN NULL;
  END IF;
  
  result := '[]'::jsonb;
  
  FOREACH elem IN ARRAY tier_array
  LOOP
    BEGIN
      -- Try to parse as JSON (handles stringified JSON objects)
      IF elem LIKE '{%}' THEN
        parsed := elem::jsonb;
        -- Ensure it has name and color properties
        IF NOT (parsed ? 'name') THEN
          parsed := jsonb_build_object('name', elem, 'color', 'default');
        ELSIF NOT (parsed ? 'color') THEN
          parsed := jsonb_set(parsed, '{color}', '"default"');
        END IF;
      ELSE
        -- Plain string - convert to object
        parsed := jsonb_build_object('name', elem, 'color', 'default');
      END IF;
      
      result := result || jsonb_build_array(parsed);
    EXCEPTION
      WHEN OTHERS THEN
        -- If parsing fails, treat as plain string
        result := result || jsonb_build_array(jsonb_build_object('name', elem, 'color', 'default'));
    END;
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Change the column type using the conversion function
ALTER TABLE people 
ALTER COLUMN tier TYPE JSONB 
USING convert_tier_to_jsonb(tier);

-- Drop the temporary function
DROP FUNCTION convert_tier_to_jsonb(TEXT[]);

-- Recreate the GIN index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_people_tier ON people USING GIN (tier)
WHERE tier IS NOT NULL;

-- Add comment
COMMENT ON COLUMN people.tier IS 'Tier multi-select values stored as JSONB array of objects with name and color properties';

