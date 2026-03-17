-- RLS 성능 개선: auth_rls_initplan + multiple_permissive_policies
-- 1. auth.uid() → (select auth.uid()) : 쿼리당 1회만 평가되도록 initPlan 적용
-- 2. 동일 role/action의 복수 permissive 정책을 OR 조건으로 병합
-- Supabase Lint: 0003_auth_rls_initplan, 0006_multiple_permissive_policies

-- ========== users ==========
DROP POLICY IF EXISTS "Users can view own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Users can insert own row" ON users;
DROP POLICY IF EXISTS "Public can view user rankings" ON users;

-- SELECT: 랭킹용 전체 조회 허용 (기존 "Public can view" + "Users can view own" 병합 → 모두 허용)
CREATE POLICY "Users can view own data or rankings"
  ON users FOR SELECT
  USING (true);

CREATE POLICY "Users can update own data"
  ON users FOR UPDATE
  USING ((select auth.uid())::text = user_id);

CREATE POLICY "Users can insert own row"
  ON users FOR INSERT
  WITH CHECK ((select auth.uid())::text = user_id);

-- ========== donations ==========
DROP POLICY IF EXISTS "Users can view own donations" ON donations;
DROP POLICY IF EXISTS "Users can create own donations" ON donations;

CREATE POLICY "Users can view own donations"
  ON donations FOR SELECT
  USING ((select auth.uid())::text = user_id);

CREATE POLICY "Users can create own donations"
  ON donations FOR INSERT
  WITH CHECK ((select auth.uid())::text = user_id);

-- ========== point_transactions ==========
DROP POLICY IF EXISTS "Users can view own transactions" ON point_transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON point_transactions;

CREATE POLICY "Users can view own transactions"
  ON point_transactions FOR SELECT
  USING ((select auth.uid())::text = user_id);

CREATE POLICY "Users can insert own transactions"
  ON point_transactions FOR INSERT
  WITH CHECK ((select auth.uid())::text = user_id);

-- ========== events ==========
DROP POLICY IF EXISTS "Anyone can view active events" ON events;
DROP POLICY IF EXISTS "Admins can manage events" ON events;

-- SELECT: ACTIVE 이벤트 조회 또는 관리자 전체 조회 (병합)
CREATE POLICY "Anyone can view active or admins manage events"
  ON events FOR SELECT
  USING (
    status = 'ACTIVE'
    OR EXISTS (
      SELECT 1 FROM users
      WHERE user_id = (select auth.uid())::text
      AND is_admin = true
    )
  );

-- 관리자: INSERT, UPDATE, DELETE (SELECT는 위 정책에 포함)
CREATE POLICY "Admins can insert events"
  ON events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE user_id = (select auth.uid())::text
      AND is_admin = true
    )
  );

CREATE POLICY "Admins can update events"
  ON events FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE user_id = (select auth.uid())::text
      AND is_admin = true
    )
  );

CREATE POLICY "Admins can delete events"
  ON events FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE user_id = (select auth.uid())::text
      AND is_admin = true
    )
  );

-- ========== event_submissions ==========
DROP POLICY IF EXISTS "Users can view own submissions" ON event_submissions;
DROP POLICY IF EXISTS "Users can create own submissions" ON event_submissions;
DROP POLICY IF EXISTS "Admins can view all submissions" ON event_submissions;
DROP POLICY IF EXISTS "Admins can update submissions" ON event_submissions;

-- SELECT: 본인 제출물 또는 관리자 전체 조회 (병합)
CREATE POLICY "Users or admins can view submissions"
  ON event_submissions FOR SELECT
  USING (
    user_id = (select auth.uid())::text
    OR EXISTS (
      SELECT 1 FROM users
      WHERE user_id = (select auth.uid())::text
      AND is_admin = true
    )
  );

CREATE POLICY "Users can create own submissions"
  ON event_submissions FOR INSERT
  WITH CHECK ((select auth.uid())::text = user_id);

CREATE POLICY "Admins can update submissions"
  ON event_submissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE user_id = (select auth.uid())::text
      AND is_admin = true
    )
  );

-- ========== event_rewards (테이블 존재 시에만) ==========
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_rewards') THEN
    DROP POLICY IF EXISTS "Admins can manage event_rewards" ON event_rewards;
    DROP POLICY IF EXISTS "Anyone can view event_rewards" ON event_rewards;

    -- SELECT: 모두 조회 가능 (병합)
    CREATE POLICY "Anyone can view event_rewards"
      ON event_rewards FOR SELECT
      USING (true);

    -- 관리자: INSERT, UPDATE, DELETE
    CREATE POLICY "Admins can manage event_rewards"
      ON event_rewards FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users
          WHERE user_id = (select auth.uid())::text
          AND is_admin = true
        )
      );

    CREATE POLICY "Admins can update event_rewards"
      ON event_rewards FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE user_id = (select auth.uid())::text
          AND is_admin = true
        )
      );

    CREATE POLICY "Admins can delete event_rewards"
      ON event_rewards FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE user_id = (select auth.uid())::text
          AND is_admin = true
        )
      );
  END IF;
END $$;
