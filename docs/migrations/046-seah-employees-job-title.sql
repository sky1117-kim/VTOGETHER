-- 세아웍스 직원 스냅샷: 직책(팀장 CC 등) 저장
ALTER TABLE public.seah_employees
  ADD COLUMN IF NOT EXISTS job_title text NULL;

COMMENT ON COLUMN public.seah_employees.job_title IS '세아웍스 직책명(예: 팀장). 칭찬 챌린지 메일 팀장 CC 조회에 사용.';

CREATE INDEX IF NOT EXISTS seah_employees_org_code_job_title_idx
  ON public.seah_employees (org_code, job_title)
  WHERE job_title IS NOT NULL;
