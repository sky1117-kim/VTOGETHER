-- 최초 로그인 시 콜백에서 public.users에 행을 넣을 수 있도록 INSERT 정책 추가
-- (기존 스키마에는 SELECT/UPDATE만 있어서 신규 로그인 사용자가 테이블에 안 들어갔음)

CREATE POLICY "Users can insert own row"
  ON users FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);
