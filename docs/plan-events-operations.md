# 이벤트 운영 방식 설계 (Event Operations)

작성일: 2026.02.13  
목적: 이벤트 타입별 운영 방식(SEASONAL / ALWAYS / INTERACTIVE)을 정의하고, 상태·빈도·보상 로직을 Front/Back 공통 규격으로 정리합니다.

---

## 1. 이벤트 타입과 운영 방식 매핑

| 타입 | 설명 | 대표 예시 | 핵심 제어 |
|------|------|-----------|-----------|
| **SEASONAL** | 특정 기간 내 **N개 구간(Round)**. 구간별 기간·참여 1회. | 걷기 챌린지 (1월 3회) | 날짜 비교, 구간별 상태 |
| **ALWAYS** | 기간 제한 없음. **참여 빈도(Frequency)** 제한만 있음. | 텀블러, 플로깅 | 쿨타임(일/주/월 1회) |
| **INTERACTIVE** | **수신자(Target)** 존재, 쌍방 보상. | 칭찬 릴레이 | 동료 검색, 원자적 트랜잭션 |

현재 DB 필드 매핑:
- `events.type`: `ALWAYS` | `SEASONAL` (INTERACTIVE는 **보상 정책**으로 표현 → `reward_policy = 'BOTH'` + 인증 방식 `PEER_SELECT`)
- `events.reward_policy`: `SENDER_ONLY` | `BOTH` → INTERACTIVE = BOTH
- ALWAYS 빈도 제한: `events.frequency_limit` (추가 제안, 아래 §4)

---

## 2. Case A. SEASONAL — Multi Round (걷기 챌린지)

### 2.1 시나리오
- 1월 한 달 동안 **10일 간격 3회** 참여 기회.
- 구조: **Event(부모) — Event Rounds(자식 N개)**.
- 구간별 1회만 제출 가능 (기존 UNIQUE 제약: `event_id + round_id + user_id`).

### 2.2 상태 정의 (Front/Back 공통)

구간(Round) 단위로 사용자별 상태를 다음 6가지로 정의합니다.

| 상태 | 조건 | UI |
|------|------|-----|
| **LOCKED** | `Today < round.start_date` | 구간 미오픈, 버튼 비활성 |
| **OPEN** | `round.start_date <= Today <= round.end_date` 이고 **해당 구간 미제출** | [인증하기] 버튼 활성 |
| **SUBMITTED** | 해당 구간으로 인증 제출 완료 AND `submission.status = 'PENDING'` | "승인 대기중" 표시 |
| **APPROVED** | `submission.status = 'APPROVED'` AND `reward_received = false` | [보상 받기] 또는 [보상 선택] 버튼 활성 |
| **DONE** | `reward_received = true` (또는 보상 선택 후 지급 완료) | "완료" 뱃지 |
| **FAILED** | `Today > round.end_date` AND 해당 구간 **미제출** | "기회 마감" 표시 |

- **날짜 기준**: 서버·클라이언트 모두 **UTC 또는 정해진 타임존(예: Asia/Seoul)** 기준으로 `Today`를 통일할 것.
- **상태 우선순위**: 한 구간에 대해 위 표 순서대로 먼저 만족하는 것을 사용 (예: 제출했으면 OPEN이 아니라 SUBMITTED).

### 2.3 상태 결정 로직 (의사코드)

```ts
function getRoundStatus(
  round: { start_date: Date; end_date: Date },
  submission: { status: string; reward_received: boolean } | null,
  today: Date
): 'LOCKED' | 'OPEN' | 'SUBMITTED' | 'APPROVED' | 'DONE' | 'FAILED' {
  if (today < round.start_date) return 'LOCKED';
  if (submission) {
    if (submission.status === 'PENDING') return 'SUBMITTED';
    if (submission.status === 'REJECTED') return 'OPEN'; // 반려 시 해당 구간 재도전 가능 여부는 정책에 따름
    if (submission.status === 'APPROVED') {
      if (submission.reward_received) return 'DONE';
      return 'APPROVED'; // 보상 받기/선택 대기
    }
  }
  if (today > round.end_date) return 'FAILED';
  return 'OPEN';
}
```

- **REJECTED** 처리: 정책에 따라 "해당 구간 재제출 불가"라면 FAILED와 유사하게 처리하거나, 별도 상태를 둘 수 있음.

### 2.4 보상 로직 (CHOICE)

- 이벤트/구간의 `reward_type = 'CHOICE'`인 경우:
  - 상태가 **APPROVED**일 때 [보상 선택] 버튼 노출.
  - 사용자가 **POINT** vs **COUPON** 중 택 1 → 선택한 값으로 `event_submissions.reward_type`, `reward_amount`(포인트일 때) 업데이트 후 지급 처리.
  - 지급 완료 후 `reward_received = true` → 상태 **DONE**.

- 단일 보상(POINTS/COUPON)이면 [보상 받기] 한 번에 지급 후 `reward_received = true`.

---

## 3. Case B. ALWAYS — Frequency Limit (텀블러, 플로깅)

### 3.1 시나리오
- 기간 제한 없음. **참여 빈도**만 제한 (일/주/월 1회 등).
- 예: 매일 1회 → 오늘 참여하면 내일 다시 버튼 활성화.

### 3.2 빈도 제한 (Frequency Check)

- **데이터 소스**: 별도 UserHistory 테이블 없이, **event_submissions**에서 해당 이벤트(`event_id`) + 사용자(`user_id`)의 **가장 최근 제출일** `max(created_at)` 조회.
- ALWAYS 이벤트는 `round_id = NULL`이므로, `WHERE event_id = ? AND user_id = ? AND round_id IS NULL ORDER BY created_at DESC LIMIT 1`로 `last_submitted_at` 확보.

| 빈도 설정 | 버튼 활성 조건 (활성 = 참여 가능) |
|-----------|-----------------------------------|
| **1일 1회** | `last_submitted_at`이 **오늘(Today 00:00~23:59)**이 아니어야 함 |
| **1주 1회** | `last_submitted_at`이 **이번 주(월~일)** 안에 없어야 함 |
| **1월 1회** | `last_submitted_at`의 **월(Month)**이 이번 달과 같지 않아야 함 |
| **1회만** | 해당 이벤트에 대한 제출이 **0건**이어야 함 (기존 상시 1회 제한과 동일) |

- **초기화**: 별도 상태 초기화 없음. 제출 버튼 렌더 시 **날짜/빈도만 비교**하면 됨.

### 3.3 DB 제안: `events.frequency_limit`

- ALWAYS 타입에서만 의미 있음.
- 값: `'ONCE'` | `'DAILY'` | `'WEEKLY'` | `'MONTHLY'` (NULL이면 기본값 `'ONCE'` 또는 정책에 따라 전체 허용).
- 마이그레이션: `docs/migrations/011-events-frequency-limit.sql` 참고.

### 3.4 의사코드 (서버/쿼리)

```ts
// "지금 참여 가능한가?" 판단
async function canParticipateNow(eventId: string, userId: string): Promise<boolean> {
  const event = await getEvent(eventId); // type, frequency_limit
  if (event.type !== 'ALWAYS') return true; // SEASONAL은 구간별 로직으로 별도 처리

  const last = await getLastSubmissionForAlwaysEvent(eventId, userId);
  if (!last) return true;

  const now = new Date();
  switch (event.frequency_limit) {
    case 'ONCE': return false;
    case 'DAILY': return !isSameDay(now, last.created_at);
    case 'WEEKLY': return !isSameWeek(now, last.created_at);
    case 'MONTHLY': return !isSameMonth(now, last.created_at);
    default: return true;
  }
}
```

---

## 4. Case C. INTERACTIVE — Dual Reward (칭찬 릴레이)

### 4.1 시나리오
- A가 B를 칭찬 → 관리자 승인 후 **A와 B 모두** 포인트 지급.
- 입력: **수신자(receiver_id)**, **칭찬 메시지(message)**.

### 4.2 DB/폼 매핑
- `event_submissions.peer_user_id` = 수신자(B)의 `user_id`.
- `verification_data`: `{ [method_id]: value }` — PEER_SELECT 항목에는 peer_user_id, TEXT 항목에는 칭찬 메시지.
- 이벤트 설정: `reward_policy = 'BOTH'`, 인증 방식에 `PEER_SELECT`(동료 선택) + `TEXT`(칭찬 메시지) 각각 추가.

### 4.3 승인 시 트랜잭션 (이미 구현)

- **api/actions/admin/verifications.ts**의 `approveSubmission()`에서:
  1. 발신자(A) 포인트 지급 + `point_transactions` 1건 (사유: 이벤트 보상)
  2. 수신자(B) 포인트 지급 + `point_transactions` 1건
  3. `event_submissions.status = 'APPROVED'`, `reward_received = true` 등 업데이트
- 실패 시 전체 롤백하도록 순차 처리 (Supabase는 트랜잭션을 스크립트/Edge Function에서 명시 가능; 현재는 순차 실행으로 원자성 보장).

### 4.4 알림
- "User B에게 '칭찬이 도착했습니다!' 알림" — PRD에는 향후 구현으로 두고, 알림 테이블/발송 로직은 별도 설계.

---

## 5. 정리 및 구현 체크리스트

| 항목 | 내용 |
|------|------|
| **SEASONAL** | 구간별 6단계 상태(LOCKED/OPEN/SUBMITTED/APPROVED/DONE/FAILED) 공통 로직 문서화 완료. CHOICE 보상은 [보상 선택] 후 DB 업데이트 + 지급. |
| **ALWAYS** | `event_submissions`의 `max(created_at)`으로 빈도 체크. `events.frequency_limit` 컬럼 추가 권장. |
| **INTERACTIVE** | BOTH + PEER_SELECT, 쌍방 지급은 `approveSubmission()`에 이미 반영. |

### 권장 구현 순서
1. **마이그레이션**: `events.frequency_limit` 추가 (ALWAYS용). → `011-events-frequency-limit.sql`
2. **쿼리/API (구현 완료)**: `api/queries/event-status.ts`
   - SEASONAL: `getRoundsWithStatusForUser(eventId, userId)` → 구간별 `RoundParticipantStatus` (LOCKED/OPEN/SUBMITTED/APPROVED/DONE/FAILED), `getRoundStatus()` 순수 함수.
   - ALWAYS: `getLastSubmissionForAlwaysEvent(eventId, userId)`, `canParticipateNow(eventId, userId)` → `allowed`, `reason`, `nextAvailableAt`(DAILY 시 다음 가능일).
3. **프론트**: 이벤트/구간 카드에 위 상태별 UI (버튼 비활성/활성, "승인 대기중", "보상 받기", "보상 선택", "완료", "기회 마감") 적용.
4. **CHOICE 보상**: [보상 선택] 모달 → Server Action으로 `reward_type`/`reward_amount` 업데이트 + 포인트 지급 + `reward_received = true`.

이 문서는 `docs/plan-admin.md`, `docs/plan-phase2.md`와 함께 참고하면 됩니다.
