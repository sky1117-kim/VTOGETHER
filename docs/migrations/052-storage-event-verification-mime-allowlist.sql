-- event-verification 버킷에 허용 MIME 타입·용량 제한을 서버(Storage) 레벨에서도 강제합니다.
-- 애플리케이션 코드의 매직바이트 검증과 별개로, Storage에 직접 업로드하는 경로(클라이언트 → Supabase 직접,
-- lib/upload-event-photo.ts)까지 포함해 이중 방어선을 둡니다.
-- Supabase SQL Editor에서 실행하세요.

UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'],
  file_size_limit = 15728640 -- 15MB (health-criteria PDF 첨부 기준). 이미지 업로드는 애플리케이션에서 5MB로 별도 제한.
WHERE id = 'event-verification';
