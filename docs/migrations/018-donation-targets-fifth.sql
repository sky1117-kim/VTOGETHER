-- 기부처 5곳 확보: 한국환경공단이 없으면 1건 추가
-- (기존 시드: 아름다운 가게, 혜명보육원, 대한적십자사, 국제구조위원회 = 4곳)
-- Supabase SQL Editor에서 실행

INSERT INTO donation_targets (name, description, image_url, target_amount, current_amount, status)
SELECT
  '한국환경공단',
  '한국환경공단과 함께 환경 보전 활동을 지원해요.',
  'https://images.unsplash.com/photo-1569163136549-3a469214d1c2?w=600&q=80',
  10000000,
  0,
  'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM donation_targets WHERE name = '한국환경공단');
