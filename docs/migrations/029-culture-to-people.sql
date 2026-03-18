-- Culture 카테고리를 People로 변경
-- Supabase SQL Editor에서 실행하세요.
--
-- ⚠️ 순서 중요: 제약조건을 먼저 DROP해야 UPDATE가 성공합니다.

-- 1. category CHECK 제약조건 DROP (PEOPLE은 아직 허용 안 됨 → UPDATE 전에 제거 필수)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.events'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%category%'
  ) LOOP
    EXECUTE format('ALTER TABLE public.events DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- 2. 기존 CULTURE 데이터를 PEOPLE로 업데이트
UPDATE events SET category = 'PEOPLE' WHERE category = 'CULTURE';

-- 3. 새 CHECK 제약조건 추가
ALTER TABLE events ADD CONSTRAINT events_category_check CHECK (category IN ('V_TOGETHER', 'PEOPLE'));
