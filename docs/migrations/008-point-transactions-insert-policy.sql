-- 기부 시 포인트 거래 내역(point_transactions) INSERT 허용
-- 기존에는 SELECT만 있어서 로그인 사용자가 기부하면 "거래 내역 기록 실패" 발생

CREATE POLICY "Users can insert own transactions"
  ON point_transactions FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);
