-- 인증 방식 입력 형태에 객관식(CHOICE) 추가
-- 관리자가 선택지를 여러 개 정하고, 참여자는 그 중 하나를 선택하는 방식
-- Supabase SQL Editor에서 실행.

-- 1) 기존 CHECK 제약 제거 후 CHOICE 추가
ALTER TABLE event_verification_methods
  DROP CONSTRAINT IF EXISTS event_verification_methods_input_style_check;

ALTER TABLE event_verification_methods
  ADD CONSTRAINT event_verification_methods_input_style_check
  CHECK (input_style IS NULL OR input_style IN ('SHORT', 'LONG', 'CHOICE'));

-- 2) 객관식 선택지 저장용 JSONB 컬럼 추가
ALTER TABLE event_verification_methods
  ADD COLUMN IF NOT EXISTS options JSONB DEFAULT NULL;

COMMENT ON COLUMN event_verification_methods.options IS '객관식(CHOICE)일 때만 사용. 선택지 문자열 배열 예: ["A", "B", "C"]';
