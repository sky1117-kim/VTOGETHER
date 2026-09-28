-- 2026-09-21 연간 전사 기부 목표(4,000만원) 도입 + 네팔 대홍수/세아윈드 특별모금 기부처 추가
-- 반드시 Supabase SQL Editor에서 프로덕션 DB에 직접 실행해야 적용됩니다.

-- ============================================================================
-- 배경
-- ============================================================================
-- 지금까지는 기부처별 목표(1,000만원, 매칭 포함) 개별 마감 판정 + 전사 4,000만원
-- 캡을 함께 썼다. 이번엔 기부처별 1,000만원 목표라는 개념 자체를 없앤다 —
-- 특정 기부처만 먼저 닫히면 그쪽으로 가려던 기부 의사가 사장되므로, 어느 기부처든
-- 자유롭게 받다가 "전사 합산 4,000만원"에 도달하는 즉시 전체를 마감하는 방식으로
-- 바꾼다. 이미 개별적으로 마감 확정된 기부처(혜명보육원 등, status='COMPLETED')는
-- 그대로 닫힌 채로 두고 재오픈하지 않는다.
-- 이 마이그레이션은 (1) site_content에 연간 목표액을 admin에서 수정 가능한 값으로
-- 추가하고, (2) 네팔 기부처를 신규 생성하고, (3) process_donation_atomic RPC의
-- 기부처별 target_amount 마감 체크를 없애고 전사 합산(매칭 포함) 체크 하나로
-- 통합한다. 안내 문구는 "예산 소진"이 아니라 "목표 달성"으로 긍정적으로 노출한다.

-- ============================================================================
-- 1. 연간 기부 목표액 (admin에서 수정 가능, 기본 4,000만원)
-- ============================================================================
INSERT INTO public.site_content (key, value)
VALUES ('annual_donation_goal', '40000000')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 1-1. 특별모금(급여공제)의 기부처별 회사 매칭액
--      급여공제 기부처(세아윈드, 네팔 등)는 current_amount가 직원 급여라 회사
--      예산에 잡히면 안 되므로, 회사가 실제로 매칭 집행한 금액만 기부처별로
--      이 컬럼에 관리자가 수동 입력한다(전사 합산·화면의 "전사 누적 기부액" 구성
--      모두 이 컬럼 기준). 기부처마다 따로 추적하므로 하나의 site_content 값으로
--      뭉뚱그리지 않는다.
-- ============================================================================
ALTER TABLE public.donation_targets
  ADD COLUMN IF NOT EXISTS payroll_matching_amount INTEGER NOT NULL DEFAULT 0
  CHECK (payroll_matching_amount >= 0);

-- ============================================================================
-- 2. 네팔 대홍수 특별모금 기부처 추가 (진행 중 — 참고 목표 1,000만원, 0원부터 시작.
--    회사 매칭은 실제 급여공제 집행 후 관리자가 payroll_matching_amount에 입력)
-- ============================================================================
INSERT INTO public.donation_targets (name, description, target_amount, current_amount, status, payroll_matching_amount)
SELECT '네팔 대홍수 특별모금', '2026년 네팔 대홍수 피해 복구를 위해 대한적십자사가 진행 중인 긴급구호 캠페인에 동참하는 특별 모금입니다.', 10000000, 0, 'ACTIVE', 0
WHERE NOT EXISTS (
  SELECT 1 FROM public.donation_targets WHERE name = '네팔 대홍수 특별모금' AND deleted_at IS NULL
);

-- ============================================================================
-- 2-1. 세아윈드 특별모금 기부처 추가 (이미 종료된 모금 — 급여공제로 328만원 모금 +
--      회사 동일 매칭 328만원 완료. 최종 결과값을 그대로 시드하고 바로 마감 처리한다.)
--      故 Ian Pascoe(세아윈드 트레이닝팀)님이 영국 하틀풀 시턴 카루 해변에서 위험에
--      처한 아이들을 구하고 유명을 달리하신 일을 기리며, 유가족을 지원하기 위한 모금.
-- ============================================================================
INSERT INTO public.donation_targets (name, description, target_amount, current_amount, status, payroll_matching_amount)
SELECT '세아윈드 특별모금', '故 Ian Pascoe(세아윈드 트레이닝팀)님은 영국 하틀풀 시턴 카루 해변에서 위험에 처한 아이들을 구하고 끝내 가족의 품으로 돌아오지 못하셨습니다. 타인을 위해 목숨을 바친 숭고한 희생을 기리며, 남겨진 유가족을 지원하기 위해 급여공제로 모금하였고 회사가 동일 금액을 매칭하였습니다.', 3280000, 3280000, 'COMPLETED', 3280000
WHERE NOT EXISTS (
  SELECT 1 FROM public.donation_targets WHERE name = '세아윈드 특별모금' AND deleted_at IS NULL
);

-- 이미 마이그레이션이 적용된 환경(세아윈드 행이 payroll_matching_amount=0으로 먼저
-- 생성된 경우)을 위한 백필 — 위 INSERT는 신규 생성 시에만 동작하므로 안전하게 병행.
UPDATE public.donation_targets
SET payroll_matching_amount = 3280000
WHERE name = '세아윈드 특별모금'
  AND deleted_at IS NULL
  AND payroll_matching_amount = 0;

-- ============================================================================
-- 3. process_donation_atomic — 기부처별 체크에 더해 전사 연간 목표 체크 추가
-- ============================================================================
CREATE OR REPLACE FUNCTION public.process_donation_atomic(
  p_target_id UUID,
  p_amount INTEGER,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_user_id TEXT;
  v_user RECORD;
  v_target RECORD;
  v_donation_id UUID;
  v_new_total_donated INTEGER;
  v_new_current_amount INTEGER;
  v_is_completed BOOLEAN;
  v_remain INTEGER;
  v_use_amount INTEGER;
  v_level_from TEXT;
  v_level_to TEXT;
  v_awarded_medals INTEGER := 0;
  v_level_up JSONB := NULL;
  v_lot RECORD;
  v_existing_matching INTEGER;
  v_new_matching INTEGER;
  v_annual_goal INTEGER;
  v_aggregate_effective INTEGER;
  v_payroll_matching INTEGER;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION '기부 금액이 올바르지 않습니다';
  END IF;

  IF (p_amount % 1000) <> 0 THEN
    RAISE EXCEPTION '기부 금액은 1,000 C 단위여야 합니다';
  END IF;

  v_caller_role := current_setting('request.jwt.claim.role', true);
  IF p_user_id IS NOT NULL AND v_caller_role <> 'service_role' THEN
    RAISE EXCEPTION '권한이 없습니다';
  END IF;

  v_user_id := COALESCE(p_user_id, auth.uid()::text);
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다';
  END IF;

  SELECT user_id, current_points, current_medals, total_donated_amount, email, name
  INTO v_user
  FROM public.users
  WHERE user_id = v_user_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '사용자 정보를 찾을 수 없습니다';
  END IF;

  IF v_user.current_points < p_amount THEN
    RAISE EXCEPTION '보유 포인트가 부족합니다';
  END IF;

  SELECT target_id, name, target_amount, current_amount, status
  INTO v_target
  FROM public.donation_targets
  WHERE target_id = p_target_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '기부처를 찾을 수 없습니다';
  END IF;

  -- 매칭금(V.Medal 전환 크레딧으로 낸 기부분) 합산 — 홈페이지 표시와 동일 기준
  SELECT COALESCE(SUM(dla.allocated_amount), 0)
  INTO v_existing_matching
  FROM public.donation_lot_allocations dla
  JOIN public.credit_lots cl ON cl.lot_id = dla.lot_id
  JOIN public.donations d ON d.donation_id = dla.donation_id
  WHERE d.target_id = p_target_id
    AND d.deleted_at IS NULL
    AND dla.deleted_at IS NULL
    AND cl.source_type = 'MEDAL_EXCHANGE';

  -- 기부처별 target_amount(1,000만원) 마감 판정은 더 이상 쓰지 않는다 — 개별
  -- 기부처가 먼저 닫히면 그쪽으로 가려던 기부 의사가 사장되므로, 어느 기부처든
  -- 자유롭게 받다가 아래의 전사 합산 4,000만원 체크 하나로만 마감을 판단한다.
  -- 이미 개별적으로 마감 확정된 기부처(status='COMPLETED')만 그대로 막는다.
  IF v_target.status = 'COMPLETED' THEN
    RAISE EXCEPTION '이미 마감된 기부처입니다';
  END IF;

  -- 전사 연간 기부 목표(기본 4,000만원, site_content.annual_donation_goal) 체크
  -- 기부처별 한도와 별개로, 매칭 포함 전사 합산이 이미 목표 이상이면 신규 기부를 막는다.
  SELECT COALESCE(value::INTEGER, 40000000)
  INTO v_annual_goal
  FROM public.site_content
  WHERE key = 'annual_donation_goal';

  IF v_annual_goal IS NULL THEN
    v_annual_goal := 40000000;
  END IF;

  -- 급여공제 기반 매칭 기부(세아윈드, 네팔 등)의 기부처별 매칭액 합계
  SELECT COALESCE(SUM(payroll_matching_amount), 0)
  INTO v_payroll_matching
  FROM public.donation_targets
  WHERE deleted_at IS NULL
    AND name IN ('네팔 대홍수 특별모금', '세아윈드 특별모금');

  -- 전사 합산 = (V.Medal 전환 기부처의 직원기부+매칭) + (급여공제 기부처별 매칭액 합계)
  -- 네팔/세아윈드처럼 급여공제로 운영되는 기부처는 current_amount가 직원 급여(회사 예산
  -- 아님)이므로 이 합산에서 제외하고, 그 매칭분(payroll_matching_amount)만 반영한다.
  SELECT COALESCE(SUM(dt.current_amount), 0) + COALESCE((
    SELECT SUM(dla2.allocated_amount)
    FROM public.donation_lot_allocations dla2
    JOIN public.credit_lots cl2 ON cl2.lot_id = dla2.lot_id
    JOIN public.donations d2 ON d2.donation_id = dla2.donation_id
    WHERE d2.deleted_at IS NULL
      AND dla2.deleted_at IS NULL
      AND cl2.source_type = 'MEDAL_EXCHANGE'
  ), 0) + COALESCE(v_payroll_matching, 0)
  INTO v_aggregate_effective
  FROM public.donation_targets dt
  WHERE dt.deleted_at IS NULL
    AND dt.name NOT IN ('네팔 대홍수 특별모금', '세아윈드 특별모금');

  IF v_aggregate_effective >= v_annual_goal THEN
    RAISE EXCEPTION '올해 목표였던 전사 기부금 4,000만원을 이미 달성했습니다! 뜨거운 관심과 참여에 감사드리며, 내년 시즌에 또 만나요 :)';
  END IF;

  SELECT COALESCE(SUM(remaining_amount), 0)
  INTO v_remain
  FROM public.credit_lots
  WHERE user_id = v_user_id
    AND deleted_at IS NULL
    AND remaining_amount > 0;

  IF v_remain < p_amount THEN
    RAISE EXCEPTION '기부 가능한 V.Credit 출처가 부족합니다. 상점 전환 내역을 확인해주세요.';
  END IF;

  INSERT INTO public.donations (user_id, target_id, amount)
  VALUES (v_user_id, p_target_id, p_amount)
  RETURNING donation_id INTO v_donation_id;

  v_remain := p_amount;
  FOR v_lot IN
    SELECT lot_id, remaining_amount
    FROM public.credit_lots
    WHERE user_id = v_user_id
      AND deleted_at IS NULL
      AND remaining_amount > 0
    ORDER BY created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remain <= 0;
    v_use_amount := LEAST(v_lot.remaining_amount, v_remain);
    IF v_use_amount <= 0 THEN
      CONTINUE;
    END IF;

    UPDATE public.credit_lots
    SET remaining_amount = remaining_amount - v_use_amount
    WHERE lot_id = v_lot.lot_id;

    INSERT INTO public.donation_lot_allocations (donation_id, lot_id, allocated_amount)
    VALUES (v_donation_id, v_lot.lot_id, v_use_amount);

    v_remain := v_remain - v_use_amount;
  END LOOP;

  IF v_remain > 0 THEN
    RAISE EXCEPTION '기부 출처 계산 오류가 발생했습니다';
  END IF;

  INSERT INTO public.point_transactions (
    user_id,
    type,
    amount,
    currency_type,
    related_id,
    related_type,
    description,
    user_email,
    user_name,
    donation_target_name
  )
  VALUES (
    v_user_id,
    'DONATED',
    -p_amount,
    'V_CREDIT',
    v_donation_id,
    'DONATION',
    v_target.name || '에 ' || p_amount::text || 'C 기부',
    v_user.email,
    v_user.name,
    v_target.name
  );

  v_new_current_amount := COALESCE(v_target.current_amount, 0) + p_amount;

  -- 방금 이 기부 건 자체가 V.Medal 전환 크레딧에서 나간 몫(있다면)도 매칭에 반영
  SELECT COALESCE(SUM(dla.allocated_amount), 0)
  INTO v_new_matching
  FROM public.donation_lot_allocations dla
  JOIN public.credit_lots cl ON cl.lot_id = dla.lot_id
  WHERE dla.donation_id = v_donation_id
    AND dla.deleted_at IS NULL
    AND cl.source_type = 'MEDAL_EXCHANGE';

  -- 개별 기부처 target_amount 기준 완료 판정은 더 이상 하지 않는다(위 설명 참고).
  -- 'completed'는 이제 "이 기부로 전사 연간 목표(4,000만원)에 도달했는가"를 뜻한다.
  v_is_completed := (v_aggregate_effective + p_amount + v_new_matching) >= v_annual_goal;

  UPDATE public.donation_targets
  SET current_amount = v_new_current_amount
  WHERE target_id = p_target_id;

  v_new_total_donated := COALESCE(v_user.total_donated_amount, 0) + p_amount;

  UPDATE public.users
  SET current_points = COALESCE(current_points, 0) - p_amount,
      total_donated_amount = v_new_total_donated
  WHERE user_id = v_user_id;

  v_level_from := public.calculate_esg_level(COALESCE(v_user.total_donated_amount, 0));
  v_level_to := public.calculate_esg_level(v_new_total_donated);

  IF v_level_from <> v_level_to THEN
    IF v_level_from = 'ECO_KEEPER' AND v_level_to IN ('GREEN_MASTER', 'EARTH_HERO') THEN
      v_awarded_medals := v_awarded_medals + 5;
      INSERT INTO public.point_transactions (
        user_id, type, amount, currency_type, related_id, related_type, description, user_email, user_name
      )
      VALUES (
        v_user_id, 'EARNED', 5, 'V_MEDAL', NULL, 'LEVEL_UP',
        '레벨업 축하: Green Master 달성으로 5 M 지급', v_user.email, v_user.name
      );
    END IF;

    IF (v_level_from IN ('ECO_KEEPER', 'GREEN_MASTER')) AND v_level_to = 'EARTH_HERO' THEN
      v_awarded_medals := v_awarded_medals + 10;
      INSERT INTO public.point_transactions (
        user_id, type, amount, currency_type, related_id, related_type, description, user_email, user_name
      )
      VALUES (
        v_user_id, 'EARNED', 10, 'V_MEDAL', NULL, 'LEVEL_UP',
        '레벨업 축하: Earth Hero 달성으로 10 M 지급', v_user.email, v_user.name
      );
    END IF;

    IF v_awarded_medals > 0 THEN
      UPDATE public.users
      SET current_medals = COALESCE(current_medals, 0) + v_awarded_medals
      WHERE user_id = v_user_id;

      v_level_up := jsonb_build_object(
        'fromLevel', v_level_from,
        'toLevel', v_level_to,
        'awardedMedals', v_awarded_medals
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'completed', v_is_completed,
    'levelUp', v_level_up
  );
END;
$$;

-- PostgREST가 변경된 함수를 즉시 반영하도록 캐시를 갱신합니다.
NOTIFY pgrst, 'reload schema';
