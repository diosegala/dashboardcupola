ALTER TABLE email_campaigns
  ADD COLUMN IF NOT EXISTS total_delivered integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_bounced integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_dropped integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS spam_reported integer DEFAULT 0;