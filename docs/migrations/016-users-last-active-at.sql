-- MAU(월간 활성 사용자) 집계용: 사용자별 마지막 접속일 시각
-- Supabase SQL Editor에서 실행 (006, 006-1 등 기존 마이그레이션 이후)

ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN users.last_active_at IS '마지막 접속 시각 (MAU 집계: 최근 30일 내 접속한 고유 사용자 수)';

-- 인덱스: MAU 카운트 쿼리용
CREATE INDEX IF NOT EXISTS idx_users_last_active_at
ON users (last_active_at)
WHERE last_active_at IS NOT NULL;
