-- 상점 구매 처리 원자화 RPC
-- 목적: V.Medal 잔액 확인·차감, 재고 확인·차감, 주문/거래 기록, (CREDIT_PACK인 경우) V.Credit 적립을
-- 한 트랜잭션에서 함께 성공 또는 함께 실패하도록 보장합니다.
-- 기존 api/actions/shop.ts의 purchaseShopProduct()는 "잔액 확인 → 차감"을 별개의 두 쿼리로 처리해
-- 동시에 두 번 요청하면 둘 다 잔액 검사를 통과한 뒤 순차 차감되어 실제 잔액보다 많이 소비(더블 스펜딩)
-- 하거나 재고를 초과 판매할 수 있었습니다. FOR UPDATE로 행을 잠가 이를 방지합니다.
-- Supabase SQL Editor에서 실행하세요.

CREATE OR REPLACE FUNCTION public.purchase_shop_product_atomic(
  p_product_id UUID,
  p_quantity INTEGER,
  p_user_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_user RECORD;
  v_product RECORD;
  v_total_payment INTEGER;
  v_credit_per_unit INTEGER;
  v_total_credit INTEGER;
  v_new_points INTEGER;
  v_shop_tx_id UUID;
  i INTEGER;
BEGIN
  -- 이 함수는 서버 액션이 이미 로그인 사용자를 확인한 뒤 서비스 롤로만 호출해야 합니다.
  -- PostgREST가 개별 GUC(request.jwt.claim.role) 대신 JSON GUC(request.jwt.claims)만 채우는
  -- 환경에서는 위 값이 항상 NULL이 되어 정상 호출까지 막히므로, auth.role()과 동일하게
  -- request.jwt.claims JSON에서도 role을 읽어오도록 폴백을 둡니다.
  v_caller_role := COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  );
  IF v_caller_role IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION '권한이 없습니다';
  END IF;

  IF p_user_id IS NULL OR p_user_id = '' THEN
    RAISE EXCEPTION '로그인이 필요합니다';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 OR p_quantity > 99 THEN
    RAISE EXCEPTION '수량이 올바르지 않습니다';
  END IF;

  SELECT user_id, current_medals, current_points, name, email
  INTO v_user
  FROM public.users
  WHERE user_id = p_user_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '사용자 정보를 찾을 수 없습니다';
  END IF;

  SELECT product_id, name, product_type, price_medal, credit_amount, stock, is_active
  INTO v_product
  FROM public.shop_products
  WHERE product_id = p_product_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND OR NOT v_product.is_active THEN
    RAISE EXCEPTION '구매 가능한 상품이 아닙니다';
  END IF;

  IF v_product.stock IS NOT NULL AND v_product.stock < p_quantity THEN
    RAISE EXCEPTION '재고가 부족합니다';
  END IF;

  v_total_payment := v_product.price_medal * p_quantity;

  IF COALESCE(v_user.current_medals, 0) < v_total_payment THEN
    RAISE EXCEPTION 'V.Medal이 부족합니다';
  END IF;

  UPDATE public.users
  SET current_medals = COALESCE(current_medals, 0) - v_total_payment
  WHERE user_id = p_user_id;

  IF v_product.stock IS NOT NULL THEN
    UPDATE public.shop_products
    SET stock = stock - p_quantity
    WHERE product_id = p_product_id;
  END IF;

  v_credit_per_unit := CASE WHEN v_product.product_type = 'CREDIT_PACK' THEN COALESCE(v_product.credit_amount, 0) ELSE 0 END;

  FOR i IN 1..p_quantity LOOP
    INSERT INTO public.shop_orders (
      user_id, product_id, product_snapshot_name, product_type,
      payment_medal, credit_granted, status
    ) VALUES (
      p_user_id, v_product.product_id, v_product.name, v_product.product_type,
      v_product.price_medal, v_credit_per_unit, 'COMPLETED'
    );
  END LOOP;

  INSERT INTO public.point_transactions (
    user_id, type, amount, currency_type, related_id, related_type, description, user_email, user_name
  ) VALUES (
    p_user_id, 'USED', -v_total_payment, 'V_MEDAL', v_product.product_id, 'SHOP_PURCHASE',
    '상점 구매: ' || v_product.name || ' x' || p_quantity::text,
    v_user.email, v_user.name
  );

  v_total_credit := v_credit_per_unit * p_quantity;

  IF v_total_credit > 0 THEN
    v_new_points := COALESCE(v_user.current_points, 0) + v_total_credit;

    UPDATE public.users
    SET current_points = v_new_points
    WHERE user_id = p_user_id;

    INSERT INTO public.credit_lots (
      user_id, source_type, initial_amount, remaining_amount, related_id, description
    ) VALUES (
      p_user_id, 'MEDAL_EXCHANGE', v_total_credit, v_total_credit, v_product.product_id,
      'V.Medal 전환 구매: ' || v_product.name || ' x' || p_quantity::text
    );

    INSERT INTO public.point_transactions (
      user_id, type, amount, currency_type, related_id, related_type, description, user_email, user_name
    ) VALUES (
      p_user_id, 'EARNED', v_total_credit, 'V_CREDIT', v_product.product_id, 'SHOP_EXCHANGE',
      'V.Medal 전환: ' || v_product.name || ' x' || p_quantity::text,
      v_user.email, v_user.name
    )
    RETURNING transaction_id INTO v_shop_tx_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'productName', v_product.name,
    'totalCreditGranted', v_total_credit,
    'creditTransactionId', v_shop_tx_id,
    'userEmail', v_user.email,
    'userName', v_user.name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_shop_product_atomic(UUID, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purchase_shop_product_atomic(UUID, INTEGER, TEXT) TO service_role;
