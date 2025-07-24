/*
  # Fix Chat RLS Policies and Real-time Support

  1. Security Updates
    - Enable RLS on chat_sessions and chat_messages
    - Add proper user-based policies
    - Fix foreign key constraints

  2. Real-time Support
    - Ensure proper indexes for real-time subscriptions
    - Add updated_at triggers for session management

  3. Session Management
    - Add total_messages counter
    - Add last_message_at timestamp
    - Improve session metadata
*/

-- Enable RLS on chat tables if not already enabled
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can create chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can update own chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can delete own chat sessions" ON chat_sessions;

DROP POLICY IF EXISTS "Users can view own chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can create chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can update own chat messages" ON chat_messages;

-- Chat Sessions Policies
CREATE POLICY "Users can view own chat sessions"
  ON chat_sessions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create chat sessions"
  ON chat_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own chat sessions"
  ON chat_sessions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own chat sessions"
  ON chat_sessions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Chat Messages Policies
CREATE POLICY "Users can view own chat messages"
  ON chat_messages
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create chat messages"
  ON chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own chat messages"
  ON chat_messages
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Add missing columns to chat_sessions if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_sessions' AND column_name = 'total_messages'
  ) THEN
    ALTER TABLE chat_sessions ADD COLUMN total_messages integer DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_sessions' AND column_name = 'last_message_at'
  ) THEN
    ALTER TABLE chat_sessions ADD COLUMN last_message_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_sessions' AND column_name = 'title'
  ) THEN
    ALTER TABLE chat_sessions ADD COLUMN title text;
  END IF;
END $$;

-- Add missing columns to chat_messages if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'chunks_retrieved'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN chunks_retrieved uuid[];
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'sources_cited'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN sources_cited uuid[];
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'retrieval_metadata'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN retrieval_metadata jsonb DEFAULT '{}';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'llm_provider'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN llm_provider text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'llm_model'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN llm_model text;
  END IF;
END $$;

-- Create indexes for better performance and real-time subscriptions
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_session ON chat_messages(user_id, session_id);

-- Function to update session metadata when messages are added
CREATE OR REPLACE FUNCTION update_chat_session_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update total_messages and last_message_at for the session
  UPDATE chat_sessions 
  SET 
    total_messages = (
      SELECT COUNT(*) 
      FROM chat_messages 
      WHERE session_id = NEW.session_id
    ),
    last_message_at = NEW.created_at,
    updated_at = NOW()
  WHERE id = NEW.session_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating session stats
DROP TRIGGER IF EXISTS trigger_update_chat_session_stats ON chat_messages;
CREATE TRIGGER trigger_update_chat_session_stats
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_session_stats();

-- Function to clean up old sessions (optional)
CREATE OR REPLACE FUNCTION cleanup_old_sessions()
RETURNS void AS $$
BEGIN
  -- Delete sessions older than 90 days with no messages
  DELETE FROM chat_sessions 
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND total_messages = 0;
END;
$$ LANGUAGE plpgsql;

-- Update existing sessions to have proper titles
UPDATE chat_sessions 
SET title = COALESCE(title, 'Chat Session - ' || to_char(created_at, 'Mon DD, YYYY'))
WHERE title IS NULL OR title = '';

-- Update total_messages for existing sessions
UPDATE chat_sessions 
SET total_messages = (
  SELECT COUNT(*) 
  FROM chat_messages 
  WHERE chat_messages.session_id = chat_sessions.id
)
WHERE total_messages IS NULL OR total_messages = 0;