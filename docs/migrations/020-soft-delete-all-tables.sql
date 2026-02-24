-- Soft Delete: 모든 테이블에 deleted_at 컬럼 추가
-- 데이터 삭제 시 실제 DELETE 대신 deleted_at에 타임스탬프 저장하여 플래그로 관리
-- Supabase SQL Editor에서 실행하세요.

-- 1. deleted_at 컬럼 추가
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE donation_targets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE point_transactions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE site_content ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE event_rounds ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE event_verification_methods ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE event_submissions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- event_rewards 테이블이 있으면 추가
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_rewards') THEN
    ALTER TABLE event_rewards ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
END $$;

-- 2. event_submissions 유니크 인덱스: 삭제된 행 제외하고 유일성 유지
DROP INDEX IF EXISTS idx_event_submissions_unique_always;
CREATE UNIQUE INDEX idx_event_submissions_unique_always
  ON event_submissions(event_id, user_id)
  WHERE round_id IS NULL AND deleted_at IS NULL;

DROP INDEX IF EXISTS idx_event_submissions_unique_seasonal;
CREATE UNIQUE INDEX idx_event_submissions_unique_seasonal
  ON event_submissions(event_id, round_id, user_id)
  WHERE round_id IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN users.deleted_at IS 'Soft delete: NULL이면 활성, 값이 있으면 삭제됨';
COMMENT ON COLUMN events.deleted_at IS 'Soft delete: NULL이면 활성, 값이 있으면 삭제됨';
