-- 2026-10-07 경매 품목 두 번째 사진(닫힌 상태/열린 상태) 지원
-- Supabase SQL Editor에서 실행하세요.

-- 배경: 노트북은 닫힌 상태(번호 식별용)와 펼친 상태(사용감 확인용) 사진을 함께 보여줘야 한다.
-- image_url을 대표 사진(1번, 닫힌 상태)으로 쓰고, image_url_2를 보조 사진(2번, 펼친 상태)으로 추가한다.

ALTER TABLE public.auction_items
  ADD COLUMN IF NOT EXISTS image_url_2 TEXT NULL;

COMMENT ON COLUMN public.auction_items.image_url_2 IS '두 번째 사진 (주로 노트북 펼친 상태)';

NOTIFY pgrst, 'reload schema';
