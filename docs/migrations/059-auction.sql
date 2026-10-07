-- 노트북/모니터 경매 이벤트 (RE:Boot 경매 등)
-- 목적: 관리자가 경매 이벤트(기간)와 품목을 등록하면, 사용자가 기간 내 실시간으로 입찰가를 제출하고
-- 품목별 현재 최고가를 즉시 확인할 수 있게 한다. 낙찰/결제는 온라인 결제 없이 기록만 남기고
-- (급여 공제 등) 실제 정산은 운영팀이 수동으로 처리한다.
-- 동시 입찰 시 이중 최고가 갱신을 막기 위해 상점 구매(053-shop-purchase-atomic-rpc.sql)와 동일하게
-- 입찰 처리는 FOR UPDATE 행 잠금을 쓰는 단일 원자적 RPC로만 수행한다.
-- Supabase SQL Editor에서 실행하세요.

-- 1) 경매 이벤트 (기간 단위 캠페인)
CREATE TABLE IF NOT EXISTS public.auction_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT NULL REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT auction_events_period_check CHECK (end_at > start_at)
);

DROP TRIGGER IF EXISTS update_auction_events_updated_at ON public.auction_events;
CREATE TRIGGER update_auction_events_updated_at
  BEFORE UPDATE ON public.auction_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) 경매 품목 (노트북/모니터 등 개별 물품)
CREATE TABLE IF NOT EXISTS public.auction_items (
  item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.auction_events(event_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  model_name TEXT NULL,
  category TEXT NOT NULL DEFAULT 'ETC' CHECK (category IN ('LAPTOP', 'MONITOR', 'ETC')),
  image_url TEXT NULL,
  description TEXT NULL,
  starting_price INTEGER NOT NULL CHECK (starting_price > 0),
  min_bid_increment INTEGER NOT NULL DEFAULT 5000 CHECK (min_bid_increment > 0),
  current_highest_bid INTEGER NULL,
  current_highest_bidder_id TEXT NULL REFERENCES public.users(user_id) ON DELETE SET NULL,
  current_highest_bid_at TIMESTAMPTZ NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_auction_items_event
  ON public.auction_items(event_id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_auction_items_updated_at ON public.auction_items;
CREATE TRIGGER update_auction_items_updated_at
  BEFORE UPDATE ON public.auction_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) 입찰 기록 (제출 로그, 하루 1회/품목 제한의 근거)
CREATE TABLE IF NOT EXISTS public.auction_bids (
  bid_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.auction_items(item_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  bid_amount INTEGER NOT NULL CHECK (bid_amount > 0),
  bid_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 사용자 1명당 품목 1개에 하루 1회만 입찰 제출 가능
CREATE UNIQUE INDEX IF NOT EXISTS idx_auction_bids_unique_per_day
  ON public.auction_bids(item_id, user_id, bid_date);

CREATE INDEX IF NOT EXISTS idx_auction_bids_item
  ON public.auction_bids(item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auction_bids_user
  ON public.auction_bids(user_id, created_at DESC);

-- 4) RLS
ALTER TABLE public.auction_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_bids ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active auction events" ON public.auction_events;
CREATE POLICY "Anyone can view active auction events"
  ON public.auction_events FOR SELECT
  USING (is_active = true AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Anyone can view active auction items" ON public.auction_items;
CREATE POLICY "Anyone can view active auction items"
  ON public.auction_items FOR SELECT
  USING (
    is_active = true
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.auction_events e
      WHERE e.event_id = auction_items.event_id
        AND e.is_active = true
        AND e.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Users can view own auction bids" ON public.auction_bids;
CREATE POLICY "Users can view own auction bids"
  ON public.auction_bids FOR SELECT
  USING (auth.uid()::text = user_id);

-- 5) 입찰 처리 원자화 RPC
-- 목적: "현재 최고가 조회 → 조건 확인 → 갱신"을 하나의 트랜잭션에서 품목 행을 잠근 채 처리해,
-- 동시에 여러 명이 입찰해도 실제보다 낮은 금액이 최고가로 잘못 저장되는 것을 방지한다.
CREATE OR REPLACE FUNCTION public.place_auction_bid_atomic(
  p_item_id UUID,
  p_user_id TEXT,
  p_bid_amount INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_item RECORD;
  v_event RECORD;
  v_user RECORD;
  v_today DATE;
  v_min_required INTEGER;
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

  IF p_bid_amount IS NULL OR p_bid_amount <= 0 THEN
    RAISE EXCEPTION '입찰가가 올바르지 않습니다';
  END IF;

  SELECT user_id, name, email
  INTO v_user
  FROM public.users
  WHERE user_id = p_user_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION '사용자 정보를 찾을 수 없습니다';
  END IF;

  SELECT item_id, event_id, name, starting_price, min_bid_increment,
         current_highest_bid, current_highest_bidder_id, is_active
  INTO v_item
  FROM public.auction_items
  WHERE item_id = p_item_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND OR NOT v_item.is_active THEN
    RAISE EXCEPTION '입찰 가능한 품목이 아닙니다';
  END IF;

  SELECT start_at, end_at, is_active
  INTO v_event
  FROM public.auction_events
  WHERE event_id = v_item.event_id
    AND deleted_at IS NULL;

  IF NOT FOUND OR NOT v_event.is_active THEN
    RAISE EXCEPTION '진행 중인 경매가 아닙니다';
  END IF;

  IF NOW() < v_event.start_at THEN
    RAISE EXCEPTION '아직 경매 기간이 시작되지 않았습니다';
  END IF;

  IF NOW() > v_event.end_at THEN
    RAISE EXCEPTION '경매가 마감되었습니다';
  END IF;

  v_min_required := COALESCE(v_item.current_highest_bid + v_item.min_bid_increment, v_item.starting_price);

  IF p_bid_amount < v_min_required THEN
    RAISE EXCEPTION '현재 최고가보다 낮은 금액입니다. 최소 %원 이상 입력하세요', v_min_required;
  END IF;

  IF MOD(p_bid_amount - v_item.starting_price, v_item.min_bid_increment) <> 0 THEN
    RAISE EXCEPTION '입찰가는 %원 단위로만 입력할 수 있습니다', v_item.min_bid_increment;
  END IF;

  v_today := (NOW() AT TIME ZONE 'Asia/Seoul')::date;

  IF EXISTS (
    SELECT 1 FROM public.auction_bids
    WHERE item_id = p_item_id AND user_id = p_user_id AND bid_date = v_today
  ) THEN
    RAISE EXCEPTION '오늘 이미 이 품목에 입찰하셨습니다. 내일 다시 시도하세요';
  END IF;

  INSERT INTO public.auction_bids (item_id, user_id, bid_amount, bid_date)
  VALUES (p_item_id, p_user_id, p_bid_amount, v_today);

  UPDATE public.auction_items
  SET current_highest_bid = p_bid_amount,
      current_highest_bidder_id = p_user_id,
      current_highest_bid_at = NOW()
  WHERE item_id = p_item_id;

  RETURN jsonb_build_object(
    'success', true,
    'itemName', v_item.name,
    'bidAmount', p_bid_amount,
    'userName', v_user.name,
    'userEmail', v_user.email
  );
END;
$$;

REVOKE ALL ON FUNCTION public.place_auction_bid_atomic(UUID, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_auction_bid_atomic(UUID, TEXT, INTEGER) TO service_role;

NOTIFY pgrst, 'reload schema';
