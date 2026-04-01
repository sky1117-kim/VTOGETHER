-- 건강 챌린지: 관리자 반려(REJECTED) 후 동일 종목·같은 활동일로 재제출 가능
-- 037과 동일 정책이나, 기존 DB에 전체 컬럼 유니크만 있었거나 인덱스 정의가 달랐을 때
-- CREATE UNIQUE INDEX IF NOT EXISTS 가 스킵되는 문제를 DROP 후 재생성으로 해소합니다.
-- 정책: 삭제되지 않은 행 중 PENDING 또는 APPROVED 인 경우에만 (시즌·사용자·종목·활동일) 중복 1건.

DROP INDEX IF EXISTS public.uq_health_logs_user_track_activity_active;

CREATE UNIQUE INDEX uq_health_logs_user_track_activity_active
  ON public.health_challenge_activity_logs (season_id, user_id, track_id, activity_date)
  WHERE deleted_at IS NULL
    AND status IN ('PENDING', 'APPROVED');
