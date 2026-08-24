-- 상점 굿즈 색상/사이즈 옵션(재고) 관리
-- 목적: 야구모자·후드집업처럼 색상/사이즈가 있는 굿즈를 옵션 조합별로 재고 관리할 수 있게 한다.
-- 가격은 상품당 하나로 고정, 옵션은 재고만 나눠 관리한다. 옵션 사용 여부는 상품별 선택(has_variants).
-- Supabase SQL Editor에서 실행하세요.

-- 1) 상품에 옵션 사용 여부 컬럼 추가
ALTER TABLE public.shop_products
  ADD COLUMN IF NOT EXISTS has_variants BOOLEAN NOT NULL DEFAULT FALSE;

-- 2) 상품 옵션(색상/사이즈) 테이블
CREATE TABLE IF NOT EXISTS public.shop_product_variants (
  variant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.shop_products(product_id) ON DELETE CASCADE,
  color TEXT NULL,
  size TEXT NULL,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT shop_product_variants_option_required CHECK (color IS NOT NULL OR size IS NOT NULL)
);

-- 동일 상품 내 동일 (색상, 사이즈) 조합 중복 등록 방지 (NULL은 빈 문자열로 취급)
CREATE UNIQUE INDEX IF NOT EXISTS idx_shop_product_variants_unique_option
  ON public.shop_product_variants(product_id, COALESCE(color, ''), COALESCE(size, ''))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_shop_product_variants_product
  ON public.shop_product_variants(product_id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_shop_product_variants_updated_at ON public.shop_product_variants;
CREATE TRIGGER update_shop_product_variants_updated_at
  BEFORE UPDATE ON public.shop_product_variants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.shop_product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active shop product variants" ON public.shop_product_variants;
CREATE POLICY "Anyone can view active shop product variants"
  ON public.shop_product_variants FOR SELECT
  USING (
    is_active = true
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.shop_products p
      WHERE p.product_id = shop_product_variants.product_id
        AND p.is_active = true
        AND p.deleted_at IS NULL
    )
  );

-- 3) 주문에 구매 시점 옵션 스냅샷 컬럼 추가 (옵션이 나중에 변경/삭제돼도 주문 기록 보존)
ALTER TABLE public.shop_orders
  ADD COLUMN IF NOT EXISTS variant_id UUID NULL REFERENCES public.shop_product_variants(variant_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variant_color TEXT NULL,
  ADD COLUMN IF NOT EXISTS variant_size TEXT NULL;

-- 4) 구매 원자화 RPC에 옵션 재고 차감 지원 추가
-- 파라미터 목록이 바뀌므로(오버로드 방지) 기존 함수를 먼저 제거하고 재생성한다.
DROP FUNCTION IF EXISTS public.purchase_shop_product_atomic(UUID, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION public.purchase_shop_product_atomic(
  p_product_id UUID,
  p_quantity INTEGER,
  p_user_id TEXT,
  p_variant_id UUID DEFAULT NULL
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
  v_variant RECORD;
  v_variant_color TEXT;
  v_variant_size TEXT;
  v_total_payment INTEGER;
  v_credit_per_unit INTEGER;
  v_total_credit INTEGER;
  v_new_points INTEGER;
  v_shop_tx_id UUID;
  i INTEGER;
BEGIN
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

  SELECT product_id, name, product_type, price_medal, credit_amount, stock, is_active, has_variants
  INTO v_product
  FROM public.shop_products
  WHERE product_id = p_product_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND OR NOT v_product.is_active THEN
    RAISE EXCEPTION '구매 가능한 상품이 아닙니다';
  END IF;

  IF v_product.has_variants THEN
    IF p_variant_id IS NULL THEN
      RAISE EXCEPTION '옵션을 선택하세요';
    END IF;

    SELECT variant_id, color, size, stock, is_active
    INTO v_variant
    FROM public.shop_product_variants
    WHERE variant_id = p_variant_id
      AND product_id = p_product_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND OR NOT v_variant.is_active THEN
      RAISE EXCEPTION '선택한 옵션을 구매할 수 없습니다';
    END IF;

    IF v_variant.stock < p_quantity THEN
      RAISE EXCEPTION '재고가 부족합니다';
    END IF;

    v_variant_color := v_variant.color;
    v_variant_size := v_variant.size;
  ELSE
    IF v_product.stock IS NOT NULL AND v_product.stock < p_quantity THEN
      RAISE EXCEPTION '재고가 부족합니다';
    END IF;
    v_variant_color := NULL;
    v_variant_size := NULL;
  END IF;

  v_total_payment := v_product.price_medal * p_quantity;

  IF COALESCE(v_user.current_medals, 0) < v_total_payment THEN
    RAISE EXCEPTION 'V.Medal이 부족합니다';
  END IF;

  UPDATE public.users
  SET current_medals = COALESCE(current_medals, 0) - v_total_payment
  WHERE user_id = p_user_id;

  IF v_product.has_variants THEN
    UPDATE public.shop_product_variants
    SET stock = stock - p_quantity
    WHERE variant_id = p_variant_id;
  ELSIF v_product.stock IS NOT NULL THEN
    UPDATE public.shop_products
    SET stock = stock - p_quantity
    WHERE product_id = p_product_id;
  END IF;

  v_credit_per_unit := CASE WHEN v_product.product_type = 'CREDIT_PACK' THEN COALESCE(v_product.credit_amount, 0) ELSE 0 END;

  FOR i IN 1..p_quantity LOOP
    INSERT INTO public.shop_orders (
      user_id, product_id, product_snapshot_name, product_type,
      payment_medal, credit_granted, status, variant_id, variant_color, variant_size
    ) VALUES (
      p_user_id, v_product.product_id, v_product.name, v_product.product_type,
      v_product.price_medal, v_credit_per_unit, 'COMPLETED', p_variant_id, v_variant_color, v_variant_size
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

REVOKE ALL ON FUNCTION public.purchase_shop_product_atomic(UUID, INTEGER, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purchase_shop_product_atomic(UUID, INTEGER, TEXT, UUID) TO service_role;
