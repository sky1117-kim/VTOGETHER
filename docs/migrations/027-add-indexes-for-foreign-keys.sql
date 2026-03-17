-- Unindexed Foreign Keys 해결
-- 외래 키 컬럼에 인덱스 추가 → JOIN·참조 무결성 검사 시 성능 개선
-- Supabase Lint: 0001_unindexed_foreign_keys

-- event_submissions
CREATE INDEX IF NOT EXISTS idx_event_submissions_peer_user_id
  ON event_submissions(peer_user_id);

CREATE INDEX IF NOT EXISTS idx_event_submissions_reviewed_by
  ON event_submissions(reviewed_by);

CREATE INDEX IF NOT EXISTS idx_event_submissions_round_id
  ON event_submissions(round_id);

-- events
CREATE INDEX IF NOT EXISTS idx_events_created_by
  ON events(created_by);
