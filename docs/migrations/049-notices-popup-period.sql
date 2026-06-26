-- notices 팝업 게시 기간 컬럼 추가
ALTER TABLE notices ADD COLUMN IF NOT EXISTS popup_start_at TIMESTAMPTZ;
ALTER TABLE notices ADD COLUMN IF NOT EXISTS popup_end_at TIMESTAMPTZ;
