-- 칭찬 챌린지 제출 시 익명 선택 가능. 관리자는 제출자 이름 조회, 수신자는 익명으로 표시.
ALTER TABLE event_submissions
  ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN event_submissions.is_anonymous IS 'true면 칭찬 수신자에게는 익명으로 표시, 관리자는 제출자 확인 가능';
