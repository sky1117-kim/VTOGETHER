-- 숫자(VALUE) 인증 방식용 단위(unit) 컬럼 추가
-- 관리자가 이벤트 등록 시 km/h, km, m, 걸음 등 선택 또는 직접 입력 가능
-- Supabase SQL Editor에서 실행.

ALTER TABLE event_verification_methods
  ADD COLUMN IF NOT EXISTS unit TEXT;

COMMENT ON COLUMN event_verification_methods.unit IS '숫자(VALUE) 인증 방식일 때만 사용. 단위 표시용 (예: km/h, km, m, 걸음). NULL이면 단위 없음';
