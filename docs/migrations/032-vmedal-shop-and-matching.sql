-- V.Medal + 상점 + FIFO 매칭기부 로직용 스키마 확장
-- Supabase SQL Editor에서 실행하세요.

-- 1) users에 V.Medal 잔액 컬럼 추가
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS current_medals INTEGER NOT NULL DEFAULT 0;

-- 2) events.category를 PEOPLE/CULTURE로 정규화
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

UPDATE public.events SET category = 'CULTURE' WHERE category = 'V_TOGETHER';

ALTER TABLE public.events
  ADD CONSTRAINT events_category_check
  CHECK (category IN ('PEOPLE', 'CULTURE'));

-- 3) event_rewards에 V_MEDAL 보상 종류 추가
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

ALTER TABLE public.event_rewards
  ADD CONSTRAINT event_rewards_reward_kind_check
  CHECK (reward_kind IN ('V_CREDIT', 'V_MEDAL', 'GOODS', 'COFFEE_COUPON'));

-- 4) 포인트 거래 테이블에 재화 구분 컬럼 추가
ALTER TABLE public.point_transactions
  ADD COLUMN IF NOT EXISTS currency_type TEXT NOT NULL DEFAULT 'V_CREDIT'
  CHECK (currency_type IN ('V_CREDIT', 'V_MEDAL'));

-- 5) Credit 출처 Lot (FIFO 차감용)
CREATE TABLE IF NOT EXISTS public.credit_lots (
  lot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('ACTIVITY', 'MEDAL_EXCHANGE', 'ADMIN_GRANT')),
  initial_amount INTEGER NOT NULL CHECK (initial_amount > 0),
  remaining_amount INTEGER NOT NULL CHECK (remaining_amount >= 0),
  related_id UUID NULL,
  description TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_credit_lots_user_created
  ON public.credit_lots(user_id, created_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_credit_lots_source
  ON public.credit_lots(source_type)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_credit_lots_updated_at ON public.credit_lots;
CREATE TRIGGER update_credit_lots_updated_at
  BEFORE UPDATE ON public.credit_lots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) 기부 시 lot 차감 내역
CREATE TABLE IF NOT EXISTS public.donation_lot_allocations (
  allocation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id UUID NOT NULL REFERENCES public.donations(donation_id) ON DELETE CASCADE,
  lot_id UUID NOT NULL REFERENCES public.credit_lots(lot_id) ON DELETE CASCADE,
  allocated_amount INTEGER NOT NULL CHECK (allocated_amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_donation_lot_allocations_donation
  ON public.donation_lot_allocations(donation_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_donation_lot_allocations_lot
  ON public.donation_lot_allocations(lot_id)
  WHERE deleted_at IS NULL;

-- 7) 상점 상품
CREATE TABLE IF NOT EXISTS public.shop_products (
  product_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NULL,
  product_type TEXT NOT NULL CHECK (product_type IN ('GOODS', 'CREDIT_PACK')),
  price_medal INTEGER NOT NULL CHECK (price_medal > 0),
  credit_amount INTEGER NULL CHECK (credit_amount IS NULL OR credit_amount > 0),
  stock INTEGER NULL CHECK (stock IS NULL OR stock >= 0),
  image_url TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT NULL REFERENCES public.users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_shop_products_active
  ON public.shop_products(is_active)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_shop_products_updated_at ON public.shop_products;
CREATE TRIGGER update_shop_products_updated_at
  BEFORE UPDATE ON public.shop_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8) 상점 주문
CREATE TABLE IF NOT EXISTS public.shop_orders (
  order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.shop_products(product_id) ON DELETE RESTRICT,
  product_snapshot_name TEXT NOT NULL,
  product_type TEXT NOT NULL CHECK (product_type IN ('GOODS', 'CREDIT_PACK')),
  payment_medal INTEGER NOT NULL CHECK (payment_medal > 0),
  credit_granted INTEGER NOT NULL DEFAULT 0 CHECK (credit_granted >= 0),
  status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_shop_orders_user_created
  ON public.shop_orders(user_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- 9) RLS (서비스 롤/서버 액션 환경 호환용 최소 정책)
ALTER TABLE public.credit_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donation_lot_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own credit lots" ON public.credit_lots;
CREATE POLICY "Users can view own credit lots"
  ON public.credit_lots FOR SELECT
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can view own shop orders" ON public.shop_orders;
CREATE POLICY "Users can view own shop orders"
  ON public.shop_orders FOR SELECT
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Anyone can view active shop products" ON public.shop_products;
CREATE POLICY "Anyone can view active shop products"
  ON public.shop_products FOR SELECT
  USING (is_active = true AND deleted_at IS NULL);
