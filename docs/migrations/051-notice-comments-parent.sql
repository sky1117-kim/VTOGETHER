-- 댓글 답글 기능: parent_id 추가
ALTER TABLE notice_comments
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES notice_comments(id) ON DELETE CASCADE;
