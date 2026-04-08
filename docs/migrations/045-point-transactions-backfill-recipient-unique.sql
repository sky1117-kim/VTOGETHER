-- 045-point-transactions-backfill-recipient-unique.sql
-- 목적:
-- - 칭찬챌린지 "사후 반영 수신" 적립이 중복으로 들어가는 문제를 DB 레벨에서 차단
-- - 동일 제출(related_id) + 동일 사용자(user_id) + 동일 통화/금액 + 동일 설명 접두어에 대해 1건만 허용

create unique index if not exists uq_pt_backfill_recipient_once
  on public.point_transactions (related_id, user_id, currency_type, amount, description)
  where deleted_at is null
    and type = 'EARNED'
    and related_type = 'EVENT'
    and description like '칭찬챌린지 (사후 반영 수신)%';
