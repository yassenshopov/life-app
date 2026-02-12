-- Migration: Create todo_people junction table
-- Description: Many-to-many relationship between todos and people
-- Created: 2025

CREATE TABLE IF NOT EXISTS todo_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  todo_id UUID NOT NULL, -- Reference to todos table
  person_id UUID NOT NULL, -- Reference to people table
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT fk_todo_people_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_todo_people_todo FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
  CONSTRAINT fk_todo_people_person FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE,
  CONSTRAINT unique_todo_person UNIQUE (user_id, todo_id, person_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_todo_people_user_id ON todo_people(user_id);
CREATE INDEX IF NOT EXISTS idx_todo_people_todo_id ON todo_people(todo_id);
CREATE INDEX IF NOT EXISTS idx_todo_people_person_id ON todo_people(person_id);
CREATE INDEX IF NOT EXISTS idx_todo_people_user_todo ON todo_people(user_id, todo_id);

-- Create trigger for updated_at auto-update
CREATE TRIGGER update_todo_people_updated_at
  BEFORE UPDATE ON todo_people
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE todo_people IS 'Junction table linking todos to people';
COMMENT ON COLUMN todo_people.todo_id IS 'Reference to todos table';
COMMENT ON COLUMN todo_people.person_id IS 'Reference to people table';
COMMENT ON COLUMN todo_people.user_id IS 'User who owns this relationship';




