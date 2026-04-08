-- 상점 주문 지급 완료 체크 컬럼 추가
-- 관리자 /admin/shop-orders 에서 실물·알맹 주문의 지급 완료 여부를 체크할 때 사용

ALTER TABLE public.shop_orders
ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.shop_orders.fulfilled_at IS '실물/알맹 주문 지급 완료 시각. NULL이면 미지급';

-- 미지급/지급완료 필터 조회용 인덱스 (실물·알맹 주문만 대상)
CREATE INDEX IF NOT EXISTS idx_shop_orders_fulfilled_at_physical
ON public.shop_orders (fulfilled_at, created_at DESC)
WHERE deleted_at IS NULL
  AND status = 'COMPLETED'
  AND product_type IN ('GOODS', 'ALMAENG_STORE');
