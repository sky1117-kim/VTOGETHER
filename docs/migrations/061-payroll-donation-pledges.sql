-- 2026-09-28 특별모금(급여공제) 신청 로직 분리
-- 반드시 Supabase SQL Editor에서 프로덕션 DB에 직접 실행해야 적용됩니다.

-- ============================================================================
-- 배경
-- ============================================================================
-- 특별모금(네팔 대홍수 등)은 V.Credit을 쓰는 일반모금과 달리, 직원이 급여에서
-- 별도로 공제해 참여하는 방식이다. 지금까지는 특별모금도 일반모금과 동일하게
-- process_donation_atomic(V.Credit 차감 RPC)을 태우게 되어 있었는데, 이는 잘못된
-- 설계다 — 특별모금은 V.Credit을 전혀 쓰지 않으므로 별도의 "신청(선택)" 로직이
-- 필요하다. 이 마이그레이션은 (1) 급여공제 신청 내역을 저장할 테이블을 만들고,
-- (2) 신청을 원자적으로 처리하는 RPC를 추가한다. 실제 급여공제·회사 매칭 집행은
-- 이 앱 밖(HR/급여 시스템)에서 이루어지며, 이 신청 내역은 그 집행의 근거 자료로
-- 관리자가 참고한다. 신청 즉시 해당 기부처의 모금액(예상치)에는 반영하되, V.Credit
-- 잔액/등급(medal)에는 전혀 영향을 주지 않는다.
--
-- 매칭 비율은 1:1로 고정되어 있으므로(정책), 신청 금액 합계 = 회사 매칭 예상액이다.
-- 그래서 이 RPC는 donation_targets.payroll_matching_amount도 신청 총액과 함께
-- 실시간으로 갱신한다 — 그래야 신청이 들어오는 즉시 "전사 누적 기부액"(연간 4,000만원
-- 목표 진행률)에도 바로 반영된다. 관리자가 payroll_matching_amount를 수동으로 고친
-- 값은, 그 뒤에 이 기부처로 새 신청이 들어오면 신청 총액으로 다시 덮어써진다 — 모금이
-- 마감(status='COMPLETED')된 뒤에는 더 이상 신청을 받지 않으므로 관리자가 입력한
-- 최종값이 그대로 유지된다(세아윈드처럼 신청 시스템 없이 결과만 기록하는 경우 포함).

-- ============================================================================
-- 1. 급여공제 신청 내역 테이블
--    직원 1명당 기부처 1개에 신청은 1건만 유지(재신청 시 금액을 갱신) — 마감 전까지
--    자유롭게 금액을 수정할 수 있게 하기 위함.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payroll_donation_pledges (
  pledge_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID NOT NULL REFERENCES public.donation_targets(target_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_donation_pledges_unique_active
  ON public.payroll_donation_pledges(target_id, user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payroll_donation_pledges_target
  ON public.payroll_donation_pledges(target_id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_payroll_donation_pledges_updated_at ON public.payroll_donation_pledges;
CREATE TRIGGER update_payroll_donation_pledges_updated_at
  BEFORE UPDATE ON public.payroll_donation_pledges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.payroll_donation_pledges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own payroll pledges" ON public.payroll_donation_pledges;
CREATE POLICY "Users can view own payroll pledges"
  ON public.payroll_donation_pledges FOR SELECT
  USING (auth.uid()::text = user_id);

-- ============================================================================
-- 2. 급여공제 신청 원자화 RPC
--    V.Credit(current_points)·credit_lots에는 전혀 손대지 않는다. 재신청 시
--    기존 신청액과의 차액만큼만 기부처 current_amount(예상치)에 반영한다.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.submit_payroll_pledge_atomic(
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
  v_target RECORD;
  v_previous_amount INTEGER := 0;
  v_new_current_amount INTEGER;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION '신청 금액이 올바르지 않습니다';
  END IF;

  IF (p_amount % 10000) <> 0 THEN
    RAISE EXCEPTION '신청 금액은 10,000원 단위여야 합니다';
  END IF;

  v_caller_role := current_setting('request.jwt.claim.role', true);
  IF p_user_id IS NOT NULL AND v_caller_role <> 'service_role' THEN
    RAISE EXCEPTION '권한이 없습니다';
  END IF;

  v_user_id := COALESCE(p_user_id, auth.uid()::text);
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE user_id = v_user_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION '사용자 정보를 찾을 수 없습니다';
  END IF;

  SELECT target_id, name, current_amount, status
  INTO v_target
  FROM public.donation_targets
  WHERE target_id = p_target_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '기부처를 찾을 수 없습니다';
  END IF;

  IF v_target.status = 'COMPLETED' THEN
    RAISE EXCEPTION '이미 마감된 모금입니다';
  END IF;

  -- 급여공제 특별모금 기부처만 신청을 받는다(일반모금 기부처는 process_donation_atomic만 사용).
  IF v_target.name NOT IN ('네팔 대홍수 특별모금', '세아윈드 특별모금') THEN
    RAISE EXCEPTION '급여공제 신청 대상이 아닌 기부처입니다';
  END IF;

  SELECT amount
  INTO v_previous_amount
  FROM public.payroll_donation_pledges
  WHERE target_id = p_target_id
    AND user_id = v_user_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    v_previous_amount := 0;
  END IF;

  INSERT INTO public.payroll_donation_pledges (target_id, user_id, amount)
  VALUES (p_target_id, v_user_id, p_amount)
  ON CONFLICT (target_id, user_id) WHERE deleted_at IS NULL
  DO UPDATE SET amount = EXCLUDED.amount, updated_at = NOW();

  v_new_current_amount := GREATEST(COALESCE(v_target.current_amount, 0) - v_previous_amount, 0) + p_amount;

  -- 매칭 1:1 고정 정책이므로 신청 총액을 회사 매칭 예상액에도 그대로 반영한다.
  UPDATE public.donation_targets
  SET current_amount = v_new_current_amount,
      payroll_matching_amount = v_new_current_amount
  WHERE target_id = p_target_id;

  RETURN jsonb_build_object(
    'success', true,
    'amount', p_amount,
    'previousAmount', v_previous_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_payroll_pledge_atomic(UUID, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_payroll_pledge_atomic(UUID, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_payroll_pledge_atomic(UUID, INTEGER, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
