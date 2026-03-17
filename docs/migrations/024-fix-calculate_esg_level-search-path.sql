-- Function Search Path Mutable 이슈 수정
-- calculate_esg_level 함수에 search_path를 고정하여 보안 취약점 제거
-- Supabase Lint: "Function has a role mutable search_path"

CREATE OR REPLACE FUNCTION public.calculate_esg_level(donated_amount INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  IF donated_amount >= 100001 THEN
    RETURN 'EARTH_HERO';
  ELSIF donated_amount >= 50001 THEN
    RETURN 'GREEN_MASTER';
  ELSIF donated_amount >= 10000 THEN
    RETURN 'ECO_KEEPER';
  ELSE
    RETURN 'ECO_KEEPER';
  END IF;
END;
$$;
