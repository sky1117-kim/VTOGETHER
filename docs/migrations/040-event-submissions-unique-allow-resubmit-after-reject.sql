-- 이벤트 인증 제출: 관리자 반려(REJECTED) 후 재제출 허용
-- 정책: 삭제되지 않은 행 중 PENDING 또는 APPROVED 상태만 중복 제출 제한 대상으로 본다.

DROP INDEX IF EXISTS public.idx_event_submissions_unique_always;
CREATE UNIQUE INDEX idx_event_submissions_unique_always
  ON public.event_submissions (event_id, user_id)
  WHERE round_id IS NULL
    AND deleted_at IS NULL
    AND status IN ('PENDING', 'APPROVED');

DROP INDEX IF EXISTS public.idx_event_submissions_unique_seasonal;
CREATE UNIQUE INDEX idx_event_submissions_unique_seasonal
  ON public.event_submissions (event_id, round_id, user_id)
  WHERE round_id IS NOT NULL
    AND deleted_at IS NULL
    AND status IN ('PENDING', 'APPROVED');
