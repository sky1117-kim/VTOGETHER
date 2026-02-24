-- 쿠폰/굿즈 발송 대상 관리: 발송 완료 체크용
-- Supabase SQL Editor에서 실행 (016 등 기존 마이그레이션 이후)

ALTER TABLE event_submissions
ADD COLUMN IF NOT EXISTS non_point_fulfilled_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN event_submissions.non_point_fulfilled_at IS '비포인트 보상(쿠폰/굿즈) 발송 완료 시각. NULL이면 미발송';

-- 인덱스: 발송 대기 목록 필터용
CREATE INDEX IF NOT EXISTS idx_event_submissions_non_point_fulfilled
ON event_submissions (non_point_fulfilled_at)
WHERE reward_type IN ('COFFEE_COUPON', 'GOODS', 'COUPON') AND reward_received = true;
