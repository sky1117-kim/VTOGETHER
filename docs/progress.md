# 개발 진행 현황 (Progress)

작성일: 2026.02.13  
참조: PRD.md, plan-admin.md, plan-phase2.md

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
- [ ] 이벤트 수정 `/admin/events/[id]/edit` (plan-admin.md §4.2)
- [ ] 사용자 챌린지 참여 모달·동적 폼
- [ ] 칭찬 챌린지 쌍방 지급 트랜잭션

### 관리자 대시보드·심사·기부처 (plan-admin.md)
- [x] 대시보드 지표 연동 (전사 기부금, 목표 달성률, 승인 대기 건수) (2026.02.13)
- [x] 인증 심사 센터 `/admin/verifications` (대량 승인/반려) (2026.02.13)
- [x] 기부처 관리 `/admin/donation-targets` (목표 수정, 오프라인 합산) (2026.02.13)
- [x] 관리자 레이아웃 네비에 기부처 링크 추가 (2026.02.13)

---

## 문서

- [x] 관리자 페이지 설계서 `docs/plan-admin.md` (2026.02.13)
- [x] 이벤트 운영 방식 설계서 `docs/plan-events-operations.md` (SEASONAL/ALWAYS/INTERACTIVE, 2026.02.13)
- [x] ALWAYS 빈도 제한 마이그레이션 `docs/migrations/011-events-frequency-limit.sql` (2026.02.13)
