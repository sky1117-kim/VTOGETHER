-- 기부 처리 원자화 RPC
-- 목적: 크레딧 차감/기부내역/거래내역/lot 차감이 한 트랜잭션에서 함께 성공 또는 함께 실패하도록 보장

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

  IF v_target.status = 'COMPLETED' THEN
    RAISE EXCEPTION '이미 목표를 달성한 기부처입니다';
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
  v_is_completed := v_new_current_amount >= COALESCE(v_target.target_amount, 0);

  UPDATE public.donation_targets
  SET current_amount = v_new_current_amount,
      status = CASE WHEN v_is_completed THEN 'COMPLETED' ELSE 'ACTIVE' END
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

REVOKE ALL ON FUNCTION public.process_donation_atomic(UUID, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_donation_atomic(UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_donation_atomic(UUID, INTEGER, TEXT) TO service_role;
