/** 이벤트 등록/관리 화면에서 쓰는 선택 옵션 (라벨·값) */

export const EVENT_CATEGORIES = [
  { value: 'CULTURE' as const, label: 'Culture' },
  { value: 'PEOPLE' as const, label: 'People' },
] as const

export const EVENT_TYPES = [
  { value: 'ALWAYS' as const, label: '상시 (ALWAYS)' },
  { value: 'SEASONAL' as const, label: '기간제 (SEASONAL)' },
] as const

export const FREQUENCY_LIMITS = [
  { value: 'ONCE' as const, label: '1회만' },
  { value: 'DAILY' as const, label: '일 1회' },
  { value: 'WEEKLY' as const, label: '주 1회' },
  { value: 'MONTHLY' as const, label: '월 1회' },
] as const

/** 카드/태그용: 빈도 제한 문구 (예: "1달에 1번 가능") */
export const FREQUENCY_TAG_LABEL: Record<string, string> = {
  ONCE: '1회만 가능',
  DAILY: '일 1회 가능',
  WEEKLY: '주 1회 가능',
  MONTHLY: '월 1회 가능',
}

/** 이미 제출했을 때 표시 문구 (빈도별) */
export const ALREADY_SUBMITTED_TAG_LABEL: Record<string, string> = {
  ONCE: '이미 제출함',
  DAILY: '오늘 제출 완료',
  WEEKLY: '이번 주 제출 완료',
  MONTHLY: '이번 달 제출 완료',
}

export const REWARD_POLICIES = [
  { value: 'SENDER_ONLY' as const, label: '참여자만 지급' },
  { value: 'BOTH' as const, label: '참여자 + 수신자 지급 (칭찬 챌린지)' },
] as const

/** 보상 유형: 하나만 선택 가능 또는 복수 선택. 굿즈는 금액 없음, V.Credit·커피쿠폰은 금액 필수 */
export const REWARD_KINDS = [
  { value: 'V_CREDIT' as const, label: 'V.Credit', needsAmount: true },
  { value: 'V_MEDAL' as const, label: 'V.Medal', needsAmount: true },
  { value: 'GOODS' as const, label: '굿즈', needsAmount: false },
  { value: 'COFFEE_COUPON' as const, label: '커피쿠폰', needsAmount: true },
] as const

/** 인증 방식: 사진 / 텍스트(복수 가능) / 숫자 / 동료 선택. 항목별로 직원 안내문(instruction) 작성. 칭찬 챌린지는 동료 선택 + 텍스트 둘 다 추가 */
export const VERIFICATION_METHOD_TYPES = [
  { value: 'PHOTO' as const, label: '사진' },
  { value: 'TEXT' as const, label: '텍스트' },
  { value: 'VALUE' as const, label: '숫자' },
  { value: 'PEER_SELECT' as const, label: '동료 선택' },
] as const

/** 동료 선택(PEER_SELECT) 방식: 개인형(1명) / 조직형(여러 명) */
export const PEER_SELECT_MODES = [
  { value: 'SINGLE' as const, label: '개인형 (1명만)' },
  { value: 'MULTIPLE' as const, label: '조직형 (여러 명)' },
] as const

/** 숫자(VALUE) 인증 방식용 항목명. 심사 시 "거리: 34 km" 등으로 표시 */
export const VALUE_LABEL_OPTIONS = [
  { value: '거리', label: '거리' },
  { value: '속도', label: '속도' },
  { value: '시간', label: '시간' },
  { value: '칼로리', label: '칼로리' },
  { value: '걸음', label: '걸음' },
  { value: '회', label: '회' },
  { value: '', label: '직접 입력' },
] as const

/** 숫자(VALUE) 인증 방식용 단위 옵션. 선택 또는 직접 입력 가능 */
export const VALUE_UNIT_OPTIONS = [
  { value: 'km/h', label: 'km/h' },
  { value: 'km', label: 'km' },
  { value: 'm', label: 'm' },
  { value: '걸음', label: '걸음' },
  { value: 'kcal', label: 'kcal' },
  { value: '분', label: '분' },
  { value: '회', label: '회' },
  { value: '', label: '단위 없음' },
] as const

/** 직접 입력 선택 시 사용하는 플레이스홀더 값 */
export const VALUE_UNIT_CUSTOM = '__CUSTOM__'
export const VALUE_LABEL_CUSTOM = '__CUSTOM__'
