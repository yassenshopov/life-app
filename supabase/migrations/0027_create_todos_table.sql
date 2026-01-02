-- Migration: Create todos table
-- Description: Stores synced To-Do List entries from Notion database
-- Created: 2025

CREATE TABLE IF NOT EXISTS todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  notion_page_id TEXT NOT NULL,
  notion_database_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Core fields
  title TEXT NOT NULL DEFAULT 'Untitled',
  
  -- Status and priority
  status TEXT NULL, -- To-Do, In progress, Done
  priority TEXT NULL, -- Immediate, Quick, Scheduled, 1st Priority, 2nd Priority, etc.
  
  -- Dates
  do_date TIMESTAMP WITH TIME ZONE NULL, -- When to do the task (from Do-Date)
  due_date DATE NULL, -- When the task is due (from Due-Date)
  start_date TIMESTAMP WITH TIME ZONE NULL, -- Calculated start date (from Start formula)
  end_date TIMESTAMP WITH TIME ZONE NULL, -- Calculated end date (from End formula)
  
  -- Tags and assignments
  mega_tags TEXT[] NOT NULL DEFAULT '{}', -- Array of tags (from Mega Tag multi_select)
  assignee JSONB NULL, -- People assigned (from Assignee people property)
  projects JSONB NULL, -- Related projects (from Projects relation)
  
  -- Additional metadata
  gcal_id TEXT NULL, -- Google Calendar event ID (from GCal_ID)
  duration_hours NUMERIC(10, 2) NULL, -- Duration in hours (from Duration (h) formula)
  
  -- Flexible properties storage - all other Notion properties stored as JSONB
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  CONSTRAINT fk_todos_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT unique_todos_user_page UNIQUE (user_id, notion_page_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_notion_page_id ON todos(notion_page_id);
CREATE INDEX IF NOT EXISTS idx_todos_notion_database_id ON todos(notion_database_id);
CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);
CREATE INDEX IF NOT EXISTS idx_todos_priority ON todos(priority);
CREATE INDEX IF NOT EXISTS idx_todos_do_date ON todos(do_date);
CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);
CREATE INDEX IF NOT EXISTS idx_todos_mega_tags ON todos USING GIN (mega_tags);
CREATE INDEX IF NOT EXISTS idx_todos_properties ON todos USING GIN (properties);

-- Create trigger for updated_at auto-update
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_todos_updated_at
  BEFORE UPDATE ON todos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE todos IS 'Synced To-Do List entries from Notion database';
COMMENT ON COLUMN todos.notion_page_id IS 'Notion page ID for this todo entry';
COMMENT ON COLUMN todos.notion_database_id IS 'Notion database ID that this todo belongs to';
COMMENT ON COLUMN todos.last_synced_at IS 'When this entry was last synced from Notion';
COMMENT ON COLUMN todos.title IS 'Title of the action item (from Action Item title property)';
COMMENT ON COLUMN todos.status IS 'Status of the todo: To-Do, In progress, or Done';
COMMENT ON COLUMN todos.priority IS 'Priority level: Immediate, Quick, Scheduled, or 1st-5th Priority, Errand, Remember';
COMMENT ON COLUMN todos.do_date IS 'When to do the task (from Do-Date property)';
COMMENT ON COLUMN todos.due_date IS 'When the task is due (from Due-Date property)';
COMMENT ON COLUMN todos.start_date IS 'Calculated start date (from Start formula)';
COMMENT ON COLUMN todos.end_date IS 'Calculated end date (from End formula)';
COMMENT ON COLUMN todos.mega_tags IS 'Array of category tags (from Mega Tag multi_select)';
COMMENT ON COLUMN todos.assignee IS 'People assigned to this task (from Assignee people property)';
COMMENT ON COLUMN todos.projects IS 'Related projects (from Projects relation property)';
COMMENT ON COLUMN todos.gcal_id IS 'Google Calendar event ID if synced to calendar';
COMMENT ON COLUMN todos.duration_hours IS 'Duration in hours (from Duration (h) formula)';
COMMENT ON COLUMN todos.properties IS 'All other Notion properties stored as JSONB for flexible schema';

