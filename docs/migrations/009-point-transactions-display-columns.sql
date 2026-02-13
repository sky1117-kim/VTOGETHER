-- ============================================================
-- 실행 방법 (Supabase 대시보드)
-- 1. https://supabase.com 로그인 → 프로젝트 선택
-- 2. 왼쪽 메뉴 [SQL Editor] 클릭
-- 3. [New query] 로 새 쿼리 열기
-- 4. 이 파일 전체 내용 복사 → 붙여넣기
-- 5. [Run] (또는 Ctrl/Cmd + Enter) 실행
-- ============================================================

-- point_transactions에 "추출/조회 시 보기 쉽게" 쓰는 스냅샷 컬럼 추가
-- INSERT 시점의 user 이메일·이름, 기부 시 기부처명을 저장 → Supabase에서 데이터 뽑을 때 JOIN 없이 확인 가능

-- 1) 컬럼 추가
ALTER TABLE point_transactions
  ADD COLUMN IF NOT EXISTS user_email TEXT,
  ADD COLUMN IF NOT EXISTS user_name TEXT,
  ADD COLUMN IF NOT EXISTS donation_target_name TEXT;

COMMENT ON COLUMN point_transactions.user_email IS '기록 시점 사용자 이메일 (조회/엑셀 추출용)';
COMMENT ON COLUMN point_transactions.user_name IS '기록 시점 사용자 이름 (조회/엑셀 추출용)';
COMMENT ON COLUMN point_transactions.donation_target_name IS '기부 시 기부처명 (type=DONATED일 때만 사용)';

-- 2) 기존 행 백필: users에서 이메일·이름 채우기
UPDATE point_transactions pt
SET user_email = u.email, user_name = u.name
FROM users u
WHERE pt.user_id = u.user_id;

-- 3) 기존 행 백필: 기부 건만 기부처명 채우기 (donations → donation_targets)
UPDATE point_transactions pt
SET donation_target_name = dt.name
FROM donations d
JOIN donation_targets dt ON d.target_id = dt.target_id
WHERE pt.related_type = 'DONATION' AND pt.related_id = d.donation_id;
