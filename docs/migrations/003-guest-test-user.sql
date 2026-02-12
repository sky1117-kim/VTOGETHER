-- 로그인 없이 테스트할 때 사용하는 게스트 테스트 유저 (5만 P 보유)
-- .env에 GUEST_TEST_USER_ID=guest-test 설정 후 사용

INSERT INTO users (user_id, email, name, dept_name, current_points, total_donated_amount, level)
VALUES (
  'guest-test',
  'guest-test@local.vtogether',
  '게스트 (테스트)',
  '테스트',
  50000,
  0,
  'ECO_KEEPER'
)
ON CONFLICT (user_id) DO UPDATE SET
  current_points = 50000,
  name = EXCLUDED.name;

-- 실행 후 아래 결과가 1건 나오면 성공 (guest-test, 50000 P 보유)
SELECT user_id, name, current_points FROM users WHERE user_id = 'guest-test';
