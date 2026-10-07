-- 2026-10-02 경매 품목 상세 스펙 필드 추가
-- Supabase SQL Editor에서 실행하세요.

-- 배경: 노트북/모니터 경매 품목은 카테고리별로 노출해야 하는 상세 정보가 다르다.
--   모니터: 모델명(기존 model_name), 사이즈, 연식/제조년월, 시리얼번호, 어답터 유무, 기능 특이사항
--   노트북: 모델명(기존 model_name), 연식/제조년월, 시리얼번호, 사양, 기능 특이사항 (어답터는 제공하지 않음)
-- 카테고리마다 다른 테이블을 두지 않고, auction_items에 모든 필드를 nullable로 추가해
-- 프론트에서 카테고리에 맞는 필드만 입력/노출하는 방식으로 처리한다.

ALTER TABLE public.auction_items
  ADD COLUMN IF NOT EXISTS size TEXT NULL,
  ADD COLUMN IF NOT EXISTS manufacture_date TEXT NULL,
  ADD COLUMN IF NOT EXISTS serial_number TEXT NULL,
  ADD COLUMN IF NOT EXISTS has_adapter BOOLEAN NULL,
  ADD COLUMN IF NOT EXISTS spec_detail TEXT NULL,
  ADD COLUMN IF NOT EXISTS functional_notes TEXT NULL;

COMMENT ON COLUMN public.auction_items.size IS '사이즈 (주로 모니터 인치)';
COMMENT ON COLUMN public.auction_items.manufacture_date IS '연식/제조년월 (자유 입력)';
COMMENT ON COLUMN public.auction_items.serial_number IS '시리얼번호';
COMMENT ON COLUMN public.auction_items.has_adapter IS '어답터 유무 (모니터만 사용, 노트북은 제공하지 않음)';
COMMENT ON COLUMN public.auction_items.spec_detail IS '사양 (주로 노트북 CPU/RAM/SSD 등)';
COMMENT ON COLUMN public.auction_items.functional_notes IS '기능 특이사항';

NOTIFY pgrst, 'reload schema';
