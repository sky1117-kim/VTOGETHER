-- Function Search Path Mutable 이슈 수정
-- update_user_level 함수에 search_path를 고정하여 보안 취약점 제거
-- Supabase Lint: "Function has a role mutable search_path"

CREATE OR REPLACE FUNCTION public.update_user_level()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.level = public.calculate_esg_level(NEW.total_donated_amount);
  RETURN NEW;
END;
$$;
