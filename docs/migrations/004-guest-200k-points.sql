-- 게스트 테스트 유저(guest-test)에 20만 P 추가
-- Supabase SQL Editor에서 이 파일 내용을 실행하세요.

UPDATE users
SET current_points = current_points + 200000
WHERE user_id = 'guest-test';

-- 실행 후 1건 나오면 성공 (current_points가 기존 + 200000)
SELECT user_id, name, current_points FROM users WHERE user_id = 'guest-test';
