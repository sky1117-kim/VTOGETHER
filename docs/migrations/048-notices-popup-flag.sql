-- notices 테이블에 팝업 표시 여부 컬럼 추가
ALTER TABLE notices ADD COLUMN IF NOT EXISTS show_as_popup BOOLEAN NOT NULL DEFAULT false;
