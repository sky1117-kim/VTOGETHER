-- ESG 레벨 기준 포인트 범위 변경
-- 1단계 (ECO_KEEPER): 1만 ~ 5만 P
-- 2단계 (GREEN_MASTER): 5만1 ~ 10만 P
-- 3단계 (EARTH_HERO): 10만1 ~ P

-- calculate_esg_level 함수 업데이트
CREATE OR REPLACE FUNCTION calculate_esg_level(donated_amount INTEGER)
RETURNS TEXT AS $$
BEGIN
  IF donated_amount >= 100001 THEN
    RETURN 'EARTH_HERO';
  ELSIF donated_amount >= 50001 THEN
    RETURN 'GREEN_MASTER';
  ELSIF donated_amount >= 10000 THEN
    RETURN 'ECO_KEEPER';
  ELSE
    -- 1만 P 미만은 기본 레벨 (ECO_KEEPER)
    RETURN 'ECO_KEEPER';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 기존 사용자들의 레벨을 새로운 기준으로 재계산
UPDATE users
SET level = calculate_esg_level(total_donated_amount)
WHERE level IS NOT NULL;

-- 확인 쿼리: 레벨별 사용자 수 확인
SELECT 
  level,
  COUNT(*) as user_count,
  MIN(total_donated_amount) as min_donated,
  MAX(total_donated_amount) as max_donated
FROM users
GROUP BY level
ORDER BY 
  CASE level
    WHEN 'EARTH_HERO' THEN 1
    WHEN 'GREEN_MASTER' THEN 2
    WHEN 'ECO_KEEPER' THEN 3
  END;
