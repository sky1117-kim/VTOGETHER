-- Phase 2: 관리자 권한 컬럼 추가
-- campaigns 테이블 생성 전에 실행하거나 함께 실행하세요.

-- users 테이블에 관리자 여부 컬럼 추가
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- 관리자 인덱스 생성 (관리자 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin) WHERE is_admin = true;

-- 초기 관리자 설정 예시 (실제 관리자 user_id로 변경 필요)
-- UPDATE users SET is_admin = true WHERE email = 'admin@vntg.co.kr';
