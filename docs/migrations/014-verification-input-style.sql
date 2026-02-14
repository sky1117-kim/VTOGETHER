-- 인증 방식별 입력 스타일: 단답(SHORT) / 장문(LONG)
-- 관리자 화면에서 텍스트·숫자 등에 단답/장문 선택 가능
-- Supabase SQL Editor에서 실행.

ALTER TABLE event_verification_methods
  ADD COLUMN IF NOT EXISTS input_style TEXT CHECK (input_style IS NULL OR input_style IN ('SHORT', 'LONG'));

COMMENT ON COLUMN event_verification_methods.input_style IS 'SHORT=한 줄 입력, LONG=여러 줄 입력. NULL이면 LONG(기본)';
