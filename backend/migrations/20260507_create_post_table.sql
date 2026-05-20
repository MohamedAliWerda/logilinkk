-- Create post table for job offers
CREATE TABLE IF NOT EXISTS post (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre_poste VARCHAR(255) NOT NULL,
  societe VARCHAR(255) NOT NULL,
  exigences TEXT NOT NULL,
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  societe_id UUID,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX idx_post_societe_id ON post(societe_id);
CREATE INDEX idx_post_date_creation ON post(date_creation DESC);
CREATE INDEX idx_post_status ON post(status);

-- Enable Row Level Security (RLS)
ALTER TABLE post ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all authenticated users to view active posts
CREATE POLICY "Allow all to view active posts" ON post
  FOR SELECT
  USING (status = 'active');

-- Create policy to allow inserts for authenticated users
CREATE POLICY "Allow authenticated users to create posts" ON post
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
