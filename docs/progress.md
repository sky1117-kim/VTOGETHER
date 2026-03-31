# 개발 진행 현황 (Progress)

작성일: 2026.02.13  
참조: PRD.md, plan-admin.md, plan-phase2.md, plan-phase3.md

---

## Phase 1: 기반 구축 & 기부 (MVP)

- [x] 사용자 DB·OAuth 연동
- [x] 메인 대시보드(레벨, 포인트)·기부(목표/마감) 구현
- [x] 관리자 기본 페이지 (/admin) — 사용자 목록, 포인트 지급, 메인 문구, 관리자 토글

---

## Phase 2: 챌린지 & 보상 시스템

### 이벤트 관리 (CMS)
- [x] 이벤트 목록 `/admin/events`
- [x] 이벤트 등록 `/admin/events/new`
- [x] 이벤트 상세·수정 `/admin/events/[eventId]` (소개문구·상태·보상 금액·구간 추가/삭제)
- [x] 사용자 챌린지 참여 모달·동적 폼 (인증하기, 구간별 상태)
- [x] 칭찬 챌린지 쌍방 지급 (승인 시 참여자+수신자 포인트 지급)
- [x] 반려 알림 (카드/상세에 "반려됨" 표시, 마이페이지 참여 내역에서 반려 사유)
- [x] 보상 선택 CHOICE/복수 보상: 승인 후 사용자가 V.Credit·커피 쿠폰·굿즈 중 선택 (2026.02.13)
- [x] 관리자 쿠폰/굿즈 발송 대상 페이지 `/admin/reward-fulfillment` (2026.02.13)
- [x] 쿠폰/굿즈 발송 완료 체크·필터(전체/미발송/발송완료), 마이그레이션 017 (2026.02.24)
- [x] 이벤트별 제출 목록 엑셀 다운로드 (이벤트 목록·상세에서 버튼) (2026.02.24)
- [x] ALWAYS 이벤트 빈도 제한(일/주/월 1회): 제출 전 검사 + 모달 안내 (2026.02.13)
- [x] 칭찬 챌린지 인증 모달 개선: 조직명 직접 입력 + 동료 다중 선택 + UI 리디자인 (2026.03.30)
- [x] 동료 선택 인증 항목별 인원 정책 설정: 개인형(1명) / 조직형(여러 명) (2026.03.30)

### 관리자 대시보드·심사·기부처 (plan-admin.md)
- [x] 대시보드 지표 연동 (전사 기부금, 목표 달성률, 승인 대기 건수) (2026.02.13)
- [x] 인증 심사 센터 `/admin/verifications` (대량 승인/반려) (2026.02.13)
- [x] 기부처 관리 `/admin/donation-targets` (목표 수정, 오프라인 합산) (2026.02.13)
- [x] 관리자 레이아웃 네비에 기부처 링크 추가 (2026.02.13)
- [x] **관리자 UX 고도화** (2026.03.18): 네비 아이콘·승인 대기 배지, 설정 섹션 접기/펼치기, 인증 심사 기본 필터·검색, 포인트 지급 퀵 버튼, AdminPageHeader·breadcrumb, 기부처 표시명 통일
- [x] **지급/적립 내역 통합** `/admin/point-grant` (2026.03.27): 수동 지급 + 직원 거래 내역(적립/기부/사용) 통합 조회, 검색/필터/페이지네이션, 관리자 네비 명칭 통일

---

## Phase 3: 고도화 & 안정화 (plan-phase3.md)

- [x] V.Honors 메인만 TOP 10 (전체 보기·전용 페이지 제거) (2026.02.23)
- [x] 모바일 UX: 랭킹 테이블 가로 스크롤, 터치 영역 44px 이상 (2026.02.23)
- [x] **MAU 지표**: 관리자 대시보드 카드, `users.last_active_at` + 접속 시 갱신, 마이그레이션 016 (2026.02.23)
- [ ] V.Honors Redis 캐싱 (선택, 인프라 도입 시)
- [ ] Vertex AI 이미지 분류 (선택, 별도 설계 후)

---

## Phase 4: V.Medal / 상점 / 매칭기부

- [x] `users.current_medals`, `credit_lots`, `donation_lot_allocations`, `shop_products`, `shop_orders` 스키마 추가 (2026.03.26)
- [x] People=V.Medal, Culture=V.Credit 이벤트 보상 분기 반영 (2026.03.26)
- [x] 사용자 상점 `/shop` 및 구매 액션 추가 (굿즈/크레딧 전환) (2026.03.26)
- [x] 관리자 상점 상품 관리 `/admin/shop-products` 추가 (등록/활성화) (2026.03.26)
- [x] 기부 시 Credit lot FIFO 차감 + 출처 할당 저장 반영 (2026.03.26)
- [x] 관리자 매칭 지표를 lot 기반으로 전환 (2026.03.26)

---

## 문서

- [x] 관리자 페이지 설계서 `docs/plan-admin.md` (2026.02.13)
- [x] 이벤트 운영 방식 설계서 `docs/plan-events-operations.md` (SEASONAL/ALWAYS/INTERACTIVE, 2026.02.13)
- [x] ALWAYS 빈도 제한 마이그레이션 `docs/migrations/011-events-frequency-limit.sql` (2026.02.13)
- [x] Phase 3 기술 설계서 `docs/plan-phase3.md` (2026.02.23)
- [x] 쿠폰/굿즈 발송 완료 컬럼 마이그레이션 `docs/migrations/017-event-submissions-non-point-fulfilled-at.sql` (2026.02.24)
- [x] V.Medal 구현 설계서 `docs/plan.md` (2026.03.26)
- [x] 세아웍스 배치 동기화 스키마/크론 연동 `docs/migrations/036-seah-org-sync-tables.sql` (2026.03.30)
