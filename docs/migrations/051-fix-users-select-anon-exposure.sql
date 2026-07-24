-- 보안 점검(2026-07-24)에서 발견: users 테이블 SELECT 정책이 USING(true)이면서
-- 역할 제한이 없어 anon key만으로 로그인 없이 전체 행(email, is_admin 포함) 조회 가능했음.
-- authenticated 역할로 제한해 익명 접근을 차단한다. (랭킹 기능은 로그인 사용자만 쓰므로 영향 없음)

ALTER POLICY "Users can view own data or rankings" ON users TO authenticated;
