-- 공지사항 (notices) + 좋아요 + 댓글

CREATE TABLE IF NOT EXISTS notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT,
  image_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notice_likes (
  notice_id UUID NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (notice_id, user_id)
);

CREATE TABLE IF NOT EXISTS notice_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id UUID NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- RLS
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE notice_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notice_comments ENABLE ROW LEVEL SECURITY;

-- notices: 모든 사용자 조회 가능, 관리자만 변경
CREATE POLICY "notices_select" ON notices FOR SELECT USING (is_published = true);
CREATE POLICY "notice_likes_select" ON notice_likes FOR SELECT USING (true);
CREATE POLICY "notice_likes_insert" ON notice_likes FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "notice_likes_delete" ON notice_likes FOR DELETE USING (auth.uid()::text = user_id);
CREATE POLICY "notice_comments_select" ON notice_comments FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "notice_comments_insert" ON notice_comments FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "notice_comments_delete" ON notice_comments FOR DELETE USING (auth.uid()::text = user_id);
