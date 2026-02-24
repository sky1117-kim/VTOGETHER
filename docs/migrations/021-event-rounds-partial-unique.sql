-- event_rounds: 소프트 삭제된 행은 유니크 제약에서 제외
-- deleted_at이 NULL인 행만 (event_id, round_number) 유일성 유지
-- 구간 삭제 후 같은 번호로 새 구간 추가 가능
-- Supabase SQL Editor에서 실행하세요.
-- ⚠️ 020-soft-delete-all-tables.sql 실행 후 적용하세요.

-- 기존 유니크 제약 제거
ALTER TABLE event_rounds DROP CONSTRAINT IF EXISTS event_rounds_event_id_round_number_key;

-- 삭제되지 않은 행만 유일성 유지하는 부분 유니크 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_rounds_event_id_round_number_unique
  ON event_rounds(event_id, round_number)
  WHERE deleted_at IS NULL;
