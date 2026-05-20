-- Add column to track when feedback reminder email was sent per post
ALTER TABLE post ADD COLUMN IF NOT EXISTS feedback_email_sent_at TIMESTAMP WITH TIME ZONE;
