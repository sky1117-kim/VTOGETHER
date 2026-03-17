-- event-verification 버킷: 로그인한 사용자가 verification/ 폴더에 직접 업로드 가능
-- 클라이언트 → Supabase 직접 업로드로 속도 개선 (Cloud Run 경유 제거)
-- Supabase SQL Editor에서 실행하세요.

-- 기존 정책이 있으면 제거 (이름이 다를 수 있음)
DROP POLICY IF EXISTS "Allow authenticated uploads to event-verification" ON storage.objects;

CREATE POLICY "Allow authenticated uploads to event-verification"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'event-verification'
    AND (storage.foldername(name))[1] = 'verification'
  );
