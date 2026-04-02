-- users.dept_name 일괄 동기화 함수
-- 목적:
-- 1) 세아웍스 스냅샷(seah_employees + seah_org_units) 기준으로 users.dept_name을 최신화
-- 2) 로그인 시점 보정에 의존하지 않고 배치 1회로 전체 사용자 부서를 갱신

CREATE OR REPLACE FUNCTION public.sync_users_dept_name_from_seah_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count INTEGER := 0;
BEGIN
  WITH mapped AS (
    SELECT
      u.user_id,
      o.org_name AS dept_name
    FROM public.users u
    JOIN public.seah_employees e
      ON lower(trim(u.email)) = lower(trim(e.email))
    JOIN public.seah_org_units o
      ON o.org_code = e.org_code
    WHERE u.deleted_at IS NULL
      AND e.status_code IS DISTINCT FROM 'N'
      AND o.is_active = true
      AND coalesce(trim(o.org_name), '') <> ''
  ),
  updated AS (
    UPDATE public.users u
    SET dept_name = m.dept_name
    FROM mapped m
    WHERE u.user_id = m.user_id
      AND coalesce(u.dept_name, '') IS DISTINCT FROM coalesce(m.dept_name, '')
    RETURNING 1
  )
  SELECT count(*) INTO v_updated_count FROM updated;

  RETURN jsonb_build_object(
    'success', true,
    'updatedCount', v_updated_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_users_dept_name_from_seah_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_users_dept_name_from_seah_snapshot() TO service_role;
