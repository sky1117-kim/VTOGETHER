-- 건강 챌린지 로그 중복 방지(레이스 컨디션 방어)
-- 정책: 삭제되지 않았고(PENDING/APPROVED 상태인) 같은 시즌·사용자·종목·활동일은 1건만 허용

CREATE UNIQUE INDEX IF NOT EXISTS uq_health_logs_user_track_activity_active
  ON public.health_challenge_activity_logs(season_id, user_id, track_id, activity_date)
  WHERE deleted_at IS NULL
    AND status IN ('PENDING', 'APPROVED');
