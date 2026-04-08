-- 상점 거래(point_transactions)에 누락된 user_name / user_email 스냅샷 보강
-- Supabase 대시보드 → SQL Editor → New query → 아래 전체 붙여넣기 → Run
--
-- 효과: 관리자 > 지급/적립 내역에서 SHOP_* 거래 줄에 이름·메일이 채워집니다.
-- (상점 주문 확인은 /admin/shop-orders 의 shop_orders 테이블이 원본입니다.)

UPDATE point_transactions pt
SET
  user_email = u.email,
  user_name = u.name
FROM users u
WHERE pt.user_id = u.user_id
  AND u.deleted_at IS NULL
  AND pt.deleted_at IS NULL
  AND pt.related_type IN ('SHOP_PURCHASE', 'SHOP_EXCHANGE')
  AND (
    pt.user_email IS NULL
    OR TRIM(COALESCE(pt.user_email, '')) = ''
    OR pt.user_name IS NULL
    OR TRIM(COALESCE(pt.user_name, '')) = ''
  );
