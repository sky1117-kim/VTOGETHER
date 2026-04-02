-- 칭찬 챌린지 수신자가 자신이 peer로 지정된 제출 행을 조회할 수 있도록 SELECT RLS 확장.
-- 기존: 제출자(user_id) 본인 또는 관리자만 event_submissions 조회 가능 → 마이페이지「받은 칭찬」쿼리가 항상 비어 메시지를 볼 수 없었음.

DROP POLICY IF EXISTS "Users or admins can view submissions" ON event_submissions;

CREATE POLICY "Users or admins can view submissions"
  ON event_submissions FOR SELECT
  USING (
    user_id = (select auth.uid())::text
    OR peer_user_id = (select auth.uid())::text
    OR (
      verification_data ? 'peer_user_ids'
      AND jsonb_typeof(verification_data->'peer_user_ids') = 'array'
      AND (verification_data->'peer_user_ids') @> jsonb_build_array((select auth.uid())::text)
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE user_id = (select auth.uid())::text
      AND is_admin = true
    )
  );
