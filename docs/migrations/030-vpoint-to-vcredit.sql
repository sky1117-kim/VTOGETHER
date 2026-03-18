-- V.Point → V.Credit 전면 변경
-- Supabase SQL Editor에서 실행하세요.
--
-- ⚠️ 순서 중요: 제약조건을 먼저 DROP해야 UPDATE/INSERT가 성공합니다.

-- 1. event_rewards.reward_kind CHECK 제약조건 DROP
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.event_rewards'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%reward_kind%'
  ) LOOP
    EXECUTE format('ALTER TABLE public.event_rewards DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;
ALTER TABLE event_rewards DROP CONSTRAINT IF EXISTS event_rewards_reward_kind_check;

-- 2. event_rewards: V_POINT → V_CREDIT (ADD 전에 데이터 수정 필수)
UPDATE event_rewards SET reward_kind = 'V_CREDIT' WHERE reward_kind = 'V_POINT';

-- 3. event_rewards 새 CHECK 제약조건 ADD
ALTER TABLE event_rewards ADD CONSTRAINT event_rewards_reward_kind_check
  CHECK (reward_kind IN ('V_CREDIT', 'GOODS', 'COFFEE_COUPON'));

-- 4. events.reward_type CHECK 제약조건 DROP
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.events'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%reward_type%'
  ) LOOP
    EXECUTE format('ALTER TABLE public.events DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_reward_type_check;

-- 5. events.reward_type: POINTS → V_CREDIT (ADD 전에 데이터 수정 필수)
UPDATE events SET reward_type = 'V_CREDIT' WHERE reward_type = 'POINTS';

-- 6. events 새 CHECK 제약조건 ADD
ALTER TABLE events ADD CONSTRAINT events_reward_type_check
  CHECK (reward_type IN ('V_CREDIT', 'COUPON', 'CHOICE'));

-- 7. event_submissions.reward_type: POINTS → V_CREDIT (제약조건 없음)
UPDATE event_submissions SET reward_type = 'V_CREDIT' WHERE reward_type = 'POINTS';
