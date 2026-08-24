-- 관리자: 상점 실물/알맹 주문(상품 요청) 취소 기능
-- 반드시 Supabase SQL Editor에서 프로덕션 DB에 직접 실행해야 적용됩니다.

-- ============================================================================
-- 배경
-- ============================================================================
-- /admin/shop-orders 에서 실물 굿즈·알맹 스토어 주문을 지급 완료 처리하는 체크박스는
-- 있지만, 지급 전 요청을 취소하는 기능은 없었다. 재고 오류, 사이즈 착오, 사용자 실수
-- 등으로 요청을 취소해야 할 때 관리자가 직접 메달을 돌려주고 재고를 복구해야 했다.
--
-- V.Credit 전환(CREDIT_PACK) 주문은 수량을 한 번에 여러 개 구매해도 크레딧이 한 번에
-- 지급되어(credit_lots 1건), 개별 주문 행 1건만 취소할 때 정확히 얼마의 크레딧을
-- 회수해야 하는지 특정할 수 없다. 이번 취소 기능은 그 모호함이 없는 실물 굿즈·알맹
-- 스토어 주문(지급 전)으로 범위를 제한한다.

CREATE OR REPLACE FUNCTION public.cancel_shop_order_atomic(
  p_order_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_order RECORD;
  v_user RECORD;
BEGIN
  v_caller_role := COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  );
  IF v_caller_role IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION '권한이 없습니다';
  END IF;

  SELECT order_id, user_id, product_id, product_type, payment_medal, status, variant_id, fulfilled_at
  INTO v_order
  FROM public.shop_orders
  WHERE order_id = p_order_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '주문을 찾을 수 없습니다';
  END IF;

  IF v_order.status <> 'COMPLETED' THEN
    RAISE EXCEPTION '이미 취소된 주문입니다';
  END IF;

  IF v_order.product_type NOT IN ('GOODS', 'ALMAENG_STORE') THEN
    RAISE EXCEPTION 'V.Credit 전환 주문은 이 기능으로 취소할 수 없습니다';
  END IF;

  IF v_order.fulfilled_at IS NOT NULL THEN
    RAISE EXCEPTION '이미 지급 완료된 주문은 취소할 수 없습니다';
  END IF;

  SELECT user_id, current_medals, name, email
  INTO v_user
  FROM public.users
  WHERE user_id = v_order.user_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '사용자 정보를 찾을 수 없습니다';
  END IF;

  -- 메달 환불
  UPDATE public.users
  SET current_medals = COALESCE(current_medals, 0) + v_order.payment_medal
  WHERE user_id = v_order.user_id;

  -- 재고 복구 (주문 1건 = 1개, 옵션 상품이면 옵션 재고를, 아니면 상품 재고를 복구.
  -- 무제한 재고(stock IS NULL) 상품은 건드리지 않는다)
  IF v_order.variant_id IS NOT NULL THEN
    UPDATE public.shop_product_variants
    SET stock = stock + 1
    WHERE variant_id = v_order.variant_id
      AND deleted_at IS NULL;
  ELSE
    UPDATE public.shop_products
    SET stock = stock + 1
    WHERE product_id = v_order.product_id
      AND deleted_at IS NULL
      AND stock IS NOT NULL;
  END IF;

  UPDATE public.shop_orders
  SET status = 'CANCELLED'
  WHERE order_id = p_order_id;

  INSERT INTO public.point_transactions (
    user_id, type, amount, currency_type, related_id, related_type, description, user_email, user_name
  ) VALUES (
    v_order.user_id, 'EARNED', v_order.payment_medal, 'V_MEDAL', v_order.order_id, 'SHOP_ORDER_CANCEL',
    '관리자에 의한 상품 요청 취소 환불',
    v_user.email, v_user.name
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_shop_order_atomic(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_shop_order_atomic(UUID) TO service_role;

-- PostgREST가 변경된 함수를 즉시 반영하도록 캐시를 갱신합니다.
NOTIFY pgrst, 'reload schema';
