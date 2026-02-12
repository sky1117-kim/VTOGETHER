-- 기부처 이름/정보 통일 (로컬·스테이징 반영용)
-- Supabase SQL Editor에서 한 번 실행하면 대한적십자사, 국제구조위원회 등이 노출됩니다.

-- 예전 시드(한국환경공단, 한국사회복지협의회) → 새 기부처명으로 변경
UPDATE donation_targets
SET
  name = '대한적십자사',
  description = '대한적십자사와 함께 인도적 지원에 동참해요.',
  image_url = 'https://images.unsplash.com/photo-1584515933487-779824d29309?w=600&q=80',
  updated_at = NOW()
WHERE name = '한국환경공단';

UPDATE donation_targets
SET
  name = '국제구조위원회',
  description = '국제구조위원회를 통해 글로벌 구호 활동을 응원해요.',
  image_url = 'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=600&q=80',
  updated_at = NOW()
WHERE name = '한국사회복지협의회';

-- 아름다운가게 → 아름다운 가게(띄어쓰기) 및 이미지 통일
UPDATE donation_targets
SET
  name = '아름다운 가게',
  description = '사회적 기업 아름다운 가게와 함께 나눔을 실천해요.',
  image_url = COALESCE(
    NULLIF(TRIM(image_url), ''),
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&q=80'
  ),
  updated_at = NOW()
WHERE name = '아름다운가게';
