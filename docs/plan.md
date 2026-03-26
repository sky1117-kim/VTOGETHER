# V.Medal / 상점 / 매칭기부 구현안

작성일: 2026.03.26

## 1) 목표

- 재화를 `V.Credit` + `V.Medal`로 이원화합니다.
- 이벤트 보상 정책을 고정합니다.
  - `People` 참여 보상: `V.Medal`
  - `Culture` 참여 보상: `V.Credit`
- `V.Medal` 상점을 추가합니다.
  - 굿즈 구매
  - `V.Credit` 전환 상품 구매
- 기부 매칭은 `V.Medal -> V.Credit` 전환 출처분만 인정합니다.

## 2) DB 스키마

- `users.current_medals` 추가
- `point_transactions.currency_type` 추가 (`V_CREDIT` / `V_MEDAL`)
- `credit_lots` 신설 (Credit 출처 lot, FIFO 차감)
- `donation_lot_allocations` 신설 (기부별 lot 차감 기록)
- `shop_products` 신설 (상점 상품)
- `shop_orders` 신설 (상점 주문)
- `event_rewards.reward_kind`에 `V_MEDAL` 추가
- `events.category`를 `PEOPLE` / `CULTURE` 기준으로 정규화

## 3) 페이지 구조

- 사용자
  - `app/(main)/shop/page.tsx`: 상점 상품 목록/구매
- 관리자
  - `app/admin/shop-products/page.tsx`: 상점 상품 등록/활성화 관리

## 4) 서버 액션

- `api/actions/shop.ts`
  - `getShopProducts()`
  - `purchaseShopProduct(productId)`
- `api/actions/admin/shop-products.ts`
  - `getShopProductsForAdmin()`
  - `createShopProduct(input)`
  - `updateShopProduct(input)`
  - `toggleShopProductActive(productId, isActive)`
- 기존 액션 보강
  - `api/actions/admin/verifications.ts`: People/Culture 보상 재화 분기
  - `api/actions/events.ts`: 보상 선택 시 `V_MEDAL` 지원
  - `api/actions/donation.ts`: FIFO lot 차감 + 할당 기록
  - `api/actions/admin.ts`: lot 기반 매칭 집계

## 5) 매칭기부 판정

- 기부 시 `credit_lots`를 오래된 순서(FIFO)로 차감합니다.
- 차감 내역은 `donation_lot_allocations`에 저장합니다.
- `source_type='MEDAL_EXCHANGE'` lot에서 차감된 금액 합계만 매칭 대상입니다.
