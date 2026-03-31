-- 건강 챌린지 시즌 ↔ 이벤트 1:1 연결 (이벤트 등록 시 함께 생성할 때 사용)
ALTER TABLE public.health_challenge_seasons
  ADD COLUMN IF NOT EXISTS event_id UUID NULL REFERENCES public.events(event_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.health_challenge_seasons.event_id IS '연결된 People 이벤트(선택). 이벤트 등록 화면에서 시즌을 함께 열 때 설정.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_health_seasons_event_id_unique
  ON public.health_challenge_seasons(event_id)
  WHERE event_id IS NOT NULL AND deleted_at IS NULL;
