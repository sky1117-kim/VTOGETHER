-- 건강 챌린지 시즌: 참가자용 기준표(PDF·이미지 등) URL
ALTER TABLE public.health_challenge_seasons
  ADD COLUMN IF NOT EXISTS criteria_attachment_url TEXT NULL;

COMMENT ON COLUMN public.health_challenge_seasons.criteria_attachment_url IS '참가 기준표·안내 파일 공개 URL (Storage 등). 메인 건강 챌린지 영역에서 링크로 노출.';
