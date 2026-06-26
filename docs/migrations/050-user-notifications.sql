-- 유저 알림 테이블 (멘션, 댓글 등)

CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'MENTION',   -- 'MENTION' | 'COMMENT' 등 확장 가능
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_notifications_select" ON user_notifications
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "user_notifications_update" ON user_notifications
  FOR UPDATE USING (auth.uid()::text = user_id);
