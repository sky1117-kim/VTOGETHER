-- ESG 레벨 기준 변경 (2026-03-31)
-- ECO_KEEPER: 0 ~ 100,000
-- GREEN_MASTER: 100,001 ~ 150,000
-- EARTH_HERO: 150,001~

CREATE OR REPLACE FUNCTION public.calculate_esg_level(donated_amount INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  IF donated_amount >= 150001 THEN
    RETURN 'EARTH_HERO';
  ELSIF donated_amount >= 100001 THEN
    RETURN 'GREEN_MASTER';
  ELSE
    RETURN 'ECO_KEEPER';
  END IF;
END;
$$;

-- 기존 사용자 레벨 재계산
UPDATE users
SET level = public.calculate_esg_level(total_donated_amount)
WHERE deleted_at IS NULL;
