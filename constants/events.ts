/** 이벤트 등록/관리 화면에서 쓰는 선택 옵션 (라벨·값) */

export const EVENT_CATEGORIES = [
  { value: 'V_TOGETHER' as const, label: 'V.Together' },
  { value: 'CULTURE' as const, label: 'Culture' },
] as const

export const EVENT_TYPES = [
  { value: 'ALWAYS' as const, label: '상시 (ALWAYS)' },
  { value: 'SEASONAL' as const, label: '기간제 (SEASONAL)' },
] as const

export const FREQUENCY_LIMITS = [
  { value: 'ONCE' as const, label: '1회만' },
  { value: 'DAILY' as const, label: '1일 1회' },
  { value: 'WEEKLY' as const, label: '1주 1회' },
  { value: 'MONTHLY' as const, label: '1월 1회' },
] as const

export const REWARD_POLICIES = [
  { value: 'SENDER_ONLY' as const, label: '참여자만 지급' },
  { value: 'BOTH' as const, label: '참여자 + 수신자 지급 (칭찬 챌린지)' },
] as const

/** 보상 유형: 하나만 선택 가능 또는 복수 선택. 굿즈는 금액 없음, V.Point·커피쿠폰은 금액 필수 */
export const REWARD_KINDS = [
  { value: 'V_POINT' as const, label: 'V.Point', needsAmount: true },
  { value: 'GOODS' as const, label: '굿즈', needsAmount: false },
  { value: 'COFFEE_COUPON' as const, label: '커피쿠폰', needsAmount: true },
] as const

/** 인증 방식: 사진 / 텍스트(복수 가능) / 숫자 / 동료 선택+텍스트. 항목별로 직원 안내문(instruction) 작성 */
export const VERIFICATION_METHOD_TYPES = [
  { value: 'PHOTO' as const, label: '사진' },
  { value: 'TEXT' as const, label: '텍스트' },
  { value: 'VALUE' as const, label: '숫자' },
  { value: 'PEER_SELECT' as const, label: '동료 선택 + 텍스트' },
] as const
