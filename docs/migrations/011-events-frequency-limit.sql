-- ALWAYS 타입 이벤트용 참여 빈도 제한 (일/주/월 1회 등)
-- plan-events-operations.md §3, §4 참고. Supabase SQL Editor에서 실행.

-- events 테이블에 frequency_limit 컬럼 추가
-- NULL = 기존 동작 유지(상시 1회 참여 제한 등 기존 인덱스 로직 따름)
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS frequency_limit TEXT
  CHECK (frequency_limit IS NULL OR frequency_limit IN ('ONCE', 'DAILY', 'WEEKLY', 'MONTHLY'));

COMMENT ON COLUMN events.frequency_limit IS 'ALWAYS 타입 전용: 참여 빈도. ONCE=1회만, DAILY=일1회, WEEKLY=주1회, MONTHLY=월1회';
