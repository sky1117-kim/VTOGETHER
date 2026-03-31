/**
 * 포인트 적립 내역 표시용: 칭찬 챌린지 "받음 vs 함" 구분
 * DB description:
 * - 구형: "칭찬을 받음: ..." / "칭찬을 함: ..."
 * - 신형: "칭찬챌린지 (수신): ..." / "칭찬챌린지 (발신): ..."
 */
export type ComplimentBadge = 'received' | 'gave' | null

export function getComplimentBadge(description: string | null): ComplimentBadge {
  const d = description?.trim() ?? ''
  if (d.startsWith('칭찬을 받음') || d.startsWith('칭찬챌린지 (수신)')) return 'received'
  if (d.startsWith('칭찬을 함') || d.startsWith('칭찬챌린지 (발신)')) return 'gave'
  return null
}

/** 알림·내역에 표시할 라벨: 내가 칭찬한 건 vs 내가 칭찬 받은 건 구분 */
export const COMPLIMENT_BADGE_LABEL: Record<NonNullable<ComplimentBadge>, string> = {
  received: '내가 칭찬 받은 내역',
  gave: '내가 칭찬한 내역',
}

/** 칭찬 챌린지 적립 건 공통 설명 문구 */
export const COMPLIMENT_EVENT_LABEL = '칭찬 챌린지'

/** 일반 이벤트 적립 건 배지: 보상 지급 완료 */
export const GENERAL_EVENT_BADGE_LABEL = '보상 지급 완료'

/** 건강 챌린지 종목 레벨 달성 (예: 런닝 레벨 2 달성) */
export const HEALTH_CHALLENGE_BADGE_LABEL = '건강 챌린지'

/** 적립 내역 배지 스타일 구분 */
export type EarnedBadgeVariant = 'general' | 'received' | 'gave'

/** getEarnedDisplay 옵션: 알림 등 짧은 영역용 텍스트 길이 제한 */
export type GetEarnedDisplayOptions = {
  /** 알림 팝업 등에서 한 줄로 보이도록 텍스트 최대 길이 (초과 시 ... 처리) */
  maxTextLength?: number
}

/**
 * 적립(EARNED) 내역 표시용: 통일 형식 [이벤트명] · [상태]
 * - 일반 이벤트: 이벤트명 N구간 · 보상 지급 완료
 * - 칭찬: 칭찬 챌린지 · 내가 칭찬 받은 내역 / 내가 칭찬한 내역
 *
 * 주의: 칭찬 패턴을 일반 패턴보다 먼저 체크 (칭찬도 "승인되어 ... 적립" 형식이라 generalMatch에 걸림)
 */
export function getEarnedDisplay(
  description: string | null,
  options?: GetEarnedDisplayOptions
): {
  badge: string | null
  text: string
  variant: EarnedBadgeVariant | null
} {
  const d = description?.trim() ?? ''
  if (!d) return { badge: null, text: '적립', variant: null }

  const maxLen = options?.maxTextLength

  // 칭찬 패턴을 먼저 체크 (일반 패턴보다 우선)
  if (d.startsWith('칭찬을 받음') || d.startsWith('칭찬챌린지 (수신)')) {
    return { badge: COMPLIMENT_BADGE_LABEL.received, text: COMPLIMENT_EVENT_LABEL, variant: 'received' }
  }
  if (d.startsWith('칭찬을 함') || d.startsWith('칭찬챌린지 (발신)')) {
    return { badge: COMPLIMENT_BADGE_LABEL.gave, text: COMPLIMENT_EVENT_LABEL, variant: 'gave' }
  }

  // 건강 챌린지: "런닝 레벨 2 달성" (종목명 + 달성 레벨)
  if (/\s레벨\s\d+\s달성$/.test(d)) {
    return { badge: HEALTH_CHALLENGE_BADGE_LABEL, text: d, variant: 'general' }
  }

  // 일반 이벤트: "이벤트명 N구간 승인되어 10,000 C 적립" → 이벤트명 N구간 · 보상 지급 완료
  const generalMatch = d.match(/^(.+?)\s+승인되어\s+.+적립$/)
  if (generalMatch) {
    let text = generalMatch[1]!.trim()
    if (maxLen != null && text.length > maxLen) {
      text = text.slice(0, maxLen) + '…'
    }
    return { badge: GENERAL_EVENT_BADGE_LABEL, text, variant: 'general' }
  }

  let text = d
  if (maxLen != null && text.length > maxLen) {
    text = text.slice(0, maxLen) + '…'
  }
  return { badge: null, text, variant: null }
}
