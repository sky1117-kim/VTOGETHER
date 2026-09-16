-- 상점 상품 구분 '알맹상점(ALMAENG_STORE)' → 'ESG'로 변경
-- 반드시 Supabase SQL Editor에서 프로덕션 DB에 직접 실행해야 적용됩니다. (코드 배포만으로는 반영되지 않음)
--
-- 배경: shop_products/shop_orders.product_type 값 'ALMAENG_STORE'를 'ESG'로 바꾼다.
-- CHECK 제약이 032 마이그레이션 이후 대시보드에서 수동으로 'ALMAENG_STORE'를 허용하도록
-- 바뀐 상태라 이름이 고정돼 있지 않으므로, 이름이 아닌 "product_type을 검사하는 제약"
-- 기준으로 찾아 제거한 뒤 데이터를 갱신하고 새 제약을 건다.

DO $$
DECLARE
  con RECORD;
BEGIN
  FOR con IN
    SELECT conname, conrelid::regclass AS tbl
    FROM pg_constraint
    WHERE contype = 'c'
      AND conrelid IN ('public.shop_products'::regclass, 'public.shop_orders'::regclass)
      AND pg_get_constraintdef(oid) ILIKE '%product_type%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', con.tbl, con.conname);
    RAISE NOTICE '제약 %.% 삭제 완료', con.tbl, con.conname;
  END LOOP;
END $$;

UPDATE public.shop_products SET product_type = 'ESG' WHERE product_type = 'ALMAENG_STORE';
UPDATE public.shop_orders SET product_type = 'ESG' WHERE product_type = 'ALMAENG_STORE';

ALTER TABLE public.shop_products
  ADD CONSTRAINT shop_products_product_type_check
  CHECK (product_type IN ('GOODS', 'CREDIT_PACK', 'ESG'));

ALTER TABLE public.shop_orders
  ADD CONSTRAINT shop_orders_product_type_check
  CHECK (product_type IN ('GOODS', 'CREDIT_PACK', 'ESG'));

-- 044 마이그레이션에서 만든 부분 인덱스도 'ALMAENG_STORE' 조건을 포함하고 있어 다시 만든다.
DROP INDEX IF EXISTS public.idx_shop_orders_fulfilled_at_physical;
CREATE INDEX IF NOT EXISTS idx_shop_orders_fulfilled_at_physical
ON public.shop_orders (fulfilled_at, created_at DESC)
WHERE deleted_at IS NULL
  AND status = 'COMPLETED'
  AND product_type IN ('GOODS', 'ESG');

COMMENT ON COLUMN public.shop_orders.fulfilled_at IS '실물/ESG 주문 지급 완료 시각. NULL이면 미지급';

-- 057 마이그레이션에서 만든 취소 함수도 'ALMAENG_STORE' 체크를 포함하고 있어 다시 정의한다.
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

  IF v_order.product_type NOT IN ('GOODS', 'ESG') THEN
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

-- PostgREST가 변경된 제약/함수를 즉시 반영하도록 캐시를 갱신합니다.
NOTIFY pgrst, 'reload schema';
