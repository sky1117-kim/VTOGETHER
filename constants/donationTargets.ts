/**
 * 기부처 기본 정보 (이름 매칭 시 이미지, 카테고리 태그)
 * DB에 예전 이름(한국환경공단, 한국사회복지협의회)이 있어도 화면에는 새 이름으로 표시
 */
export const DEFAULT_TARGET_IMAGES: Record<string, string> = {
  '아름다운 가게':
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&q=80',
  '아름다운가게':
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&q=80',
  '혜명보육원':
    'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=600&q=80',
  '대한적십자사':
    'https://images.unsplash.com/photo-1584515933487-779824d29309?w=600&q=80',
  '국제구조위원회':
    'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=600&q=80',
  '네팔 대홍수 특별모금':
    'https://images.unsplash.com/photo-1547683905-f686c993aae5?w=600&q=80',
  '세아윈드 특별모금': '/images/donation/seawind-ian-pascoe.jpg',
  // 예전 시드 이름(로컬 DB 미반영 시에도 이미지 노출)
  '한국환경공단':
    'https://images.unsplash.com/photo-1584515933487-779824d29309?w=600&q=80',
  '한국사회복지협의회':
    'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=600&q=80',
}

/**
 * 급여공제 기반 매칭 기부처 (직원 급여 = 회사 예산 아님 → current_amount를 예산 합산에서 제외하고
 * 매칭분만 donation_targets.payroll_matching_amount로 기부처별 수동 추적)
 */
export const PAYROLL_BASED_TARGET_NAMES = new Set(['네팔 대홍수 특별모금', '세아윈드 특별모금'])

/**
 * 모금 유형: 일반모금(상시 V.Medal→V.Credit 전환 기부, 4개 기부처)과
 * 특별모금(급여공제 기반 매칭 기부, 재난·긴급 이슈 대응용)을 구분해서 보여준다.
 * 일반모금은 평소 적립한 크레딧으로 기부하는 것이고, 특별모금은 그 시점에 발생한
 * 특정 이슈(재난 등)에 맞춰 직원이 급여에서 별도로 공제해 참여하는 방식이라
 * 기부처별 상시 목표(1,000만원) 체계와는 별개로 운영된다.
 */
export function getDonationFundingType(name: string): '일반모금' | '특별모금' {
  return PAYROLL_BASED_TARGET_NAMES.has(name) ? '특별모금' : '일반모금'
}

/**
 * 기부처별 금액 표시 단위. 일반모금은 V.Credit(단위 C)이지만, 특별모금은
 * 급여공제로 걷는 실제 원화이므로 "C"가 아니라 "원"으로 표기해야 한다.
 */
export function getDonationAmountUnit(name: string): 'C' | '원' {
  return PAYROLL_BASED_TARGET_NAMES.has(name) ? '원' : 'C'
}

export const DONATION_FUNDING_TYPE_INFO: Record<
  '일반모금' | '특별모금',
  { label: string; description: string }
> = {
  일반모금: {
    label: '일반모금 · 크레딧 기부',
    description: '보유한 V.Credit(적립한 V.Medal을 전환한 크레딧 포함)으로 기부합니다.',
  },
  특별모금: {
    label: '특별모금 · 급여공제 기부',
    description: '재난 등 긴급 이슈에 대응하는 모금으로, 급여에서 별도 공제해 참여합니다.',
  },
}

/** DB에 예전 이름이 있을 때 화면에 표시할 이름 (로컬 반영용) */
export const TARGET_DISPLAY_NAMES: Record<string, string> = {
  '아름다운가게': '아름다운 가게',
  '한국환경공단': '대한적십자사',
  '한국사회복지협의회': '국제구조위원회',
}

/** 기부처 DB 이름 → 사용자에게 보여줄 이름 (카드·모달·내역 공통) */
export function getDonationTargetDisplayName(dbName: string): string {
  return TARGET_DISPLAY_NAMES[dbName] ?? dbName
}

/** 거래 설명 등 긴 문자열 속 예전 기부처명을 표시명으로 치환 */
export function rewriteLegacyDonationTargetNamesInText(text: string): string {
  let out = text
  for (const [legacy, display] of Object.entries(TARGET_DISPLAY_NAMES)) {
    if (legacy !== display) out = out.split(legacy).join(display)
  }
  return out
}

/** 기부처별 좌측 상단 카테고리 태그 (색상 구분) */
export const TARGET_CATEGORY_TAGS: Record<
  string,
  { label: string; className: string }
> = {
  '아름다운 가게': {
    label: '자원순환 및 나눔사업',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  '아름다운가게': {
    label: '자원순환 및 나눔사업',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  '대한적십자사': {
    label: '긴급구호 및 헌혈지원',
    className: 'bg-red-100 text-red-800 border-red-300',
  },
  '국제구조위원회': {
    label: '난민 생존 및 회복 지원',
    className: 'bg-blue-100 text-blue-800 border-blue-300',
  },
  '혜명보육원': {
    label: '보육원 아동 지원',
    className: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  '네팔 대홍수 특별모금': {
    label: '재난 긴급구호',
    className: 'bg-violet-100 text-violet-800 border-violet-300',
  },
  '세아윈드 특별모금': {
    label: '동료 추모 · 유가족 지원',
    className: 'bg-slate-100 text-slate-700 border-slate-300',
  },
  // 예전 시드 이름 → 동일 태그/색상 적용
  '한국환경공단': {
    label: '긴급구호 및 헌혈지원',
    className: 'bg-red-100 text-red-800 border-red-300',
  },
  '한국사회복지협의회': {
    label: '난민 생존 및 회복 지원',
    className: 'bg-blue-100 text-blue-800 border-blue-300',
  },
}

/**
 * 기부처별 카드/버튼 테마. 각 기부처는 서로 겹치지 않는 고유 색상을 갖고,
 * 모금이 종료(status='COMPLETED')된 뒤에도 동일 색상 계열의 차분한 버전으로
 * 정체성을 유지한다(전부 회색으로 뭉개지지 않도록).
 * 아름다운가게 초록, 혜명보육원 노랑, 대한적십자사 빨강, 국제구조위원회 파랑,
 * 네팔 대홍수 주황, 세아윈드 슬레이트.
 */
export type TargetTheme = {
  border: string
  text: string
  bg: string
  progress: string
  button: string
  /** 모금 종료 후 카드 테두리(ring) */
  completedRing: string
  /** 모금 종료 후 카드 테두리(border, ring 미사용 카드용) */
  completedBorder: string
  /** 모금 종료 후 우측 상단 '지급 완료' 배지 배경 */
  completedBadge: string
  /** 모금 종료 후 하단 상태 버튼(테두리/배경/텍스트) */
  completedButton: string
}

const defaultTheme: TargetTheme = {
  border: 'border-gray-400',
  text: 'text-gray-600',
  bg: 'bg-gray-50',
  progress: 'bg-gray-500',
  button: 'border-gray-400 text-gray-600 hover:bg-gray-50',
  completedRing: 'ring-gray-300',
  completedBorder: 'border-gray-300',
  completedBadge: 'bg-gray-600',
  completedButton: 'border-gray-300 bg-gray-50 text-gray-500',
}

export const TARGET_THEMES: Record<string, TargetTheme> = {
  '아름다운 가게': {
    border: 'border-emerald-500',
    text: 'text-emerald-600',
    bg: 'bg-emerald-50',
    progress: 'bg-emerald-500',
    button: 'border-emerald-500 text-emerald-600 hover:bg-emerald-50',
    completedRing: 'ring-emerald-300',
    completedBorder: 'border-emerald-300',
    completedBadge: 'bg-emerald-600',
    completedButton: 'border-emerald-300 bg-emerald-50 text-emerald-600',
  },
  '아름다운가게': {
    border: 'border-emerald-500',
    text: 'text-emerald-600',
    bg: 'bg-emerald-50',
    progress: 'bg-emerald-500',
    button: 'border-emerald-500 text-emerald-600 hover:bg-emerald-50',
    completedRing: 'ring-emerald-300',
    completedBorder: 'border-emerald-300',
    completedBadge: 'bg-emerald-600',
    completedButton: 'border-emerald-300 bg-emerald-50 text-emerald-600',
  },
  '혜명보육원': {
    border: 'border-amber-500',
    text: 'text-amber-600',
    bg: 'bg-amber-50',
    progress: 'bg-amber-500',
    button: 'border-amber-500 text-amber-600 hover:bg-amber-50',
    completedRing: 'ring-amber-300',
    completedBorder: 'border-amber-300',
    completedBadge: 'bg-amber-600',
    completedButton: 'border-amber-300 bg-amber-50 text-amber-600',
  },
  '대한적십자사': {
    border: 'border-red-500',
    text: 'text-red-600',
    bg: 'bg-red-50',
    progress: 'bg-red-500',
    button: 'border-red-500 text-red-600 hover:bg-red-50',
    completedRing: 'ring-red-300',
    completedBorder: 'border-red-300',
    completedBadge: 'bg-red-600',
    completedButton: 'border-red-300 bg-red-50 text-red-600',
  },
  '국제구조위원회': {
    border: 'border-blue-500',
    text: 'text-blue-600',
    bg: 'bg-blue-50',
    progress: 'bg-blue-500',
    button: 'border-blue-500 text-blue-600 hover:bg-blue-50',
    completedRing: 'ring-blue-300',
    completedBorder: 'border-blue-300',
    completedBadge: 'bg-blue-600',
    completedButton: 'border-blue-300 bg-blue-50 text-blue-600',
  },
  '네팔 대홍수 특별모금': {
    border: 'border-violet-500',
    text: 'text-violet-600',
    bg: 'bg-violet-50',
    progress: 'bg-violet-500',
    button: 'border-violet-500 text-violet-600 hover:bg-violet-50',
    completedRing: 'ring-violet-300',
    completedBorder: 'border-violet-300',
    completedBadge: 'bg-violet-600',
    completedButton: 'border-violet-300 bg-violet-50 text-violet-600',
  },
  '세아윈드 특별모금': {
    border: 'border-slate-500',
    text: 'text-slate-600',
    bg: 'bg-slate-50',
    progress: 'bg-slate-500',
    button: 'border-slate-500 text-slate-600 hover:bg-slate-50',
    completedRing: 'ring-slate-300',
    completedBorder: 'border-slate-300',
    completedBadge: 'bg-slate-600',
    completedButton: 'border-slate-300 bg-slate-50 text-slate-600',
  },
  '한국환경공단': {
    border: 'border-red-500',
    text: 'text-red-600',
    bg: 'bg-red-50',
    progress: 'bg-red-500',
    button: 'border-red-500 text-red-600 hover:bg-red-50',
    completedRing: 'ring-red-300',
    completedBorder: 'border-red-300',
    completedBadge: 'bg-red-600',
    completedButton: 'border-red-300 bg-red-50 text-red-600',
  },
  '한국사회복지협의회': {
    border: 'border-blue-500',
    text: 'text-blue-600',
    bg: 'bg-blue-50',
    progress: 'bg-blue-500',
    button: 'border-blue-500 text-blue-600 hover:bg-blue-50',
    completedRing: 'ring-blue-300',
    completedBorder: 'border-blue-300',
    completedBadge: 'bg-blue-600',
    completedButton: 'border-blue-300 bg-blue-50 text-blue-600',
  },
}

export function getTargetTheme(targetName: string): TargetTheme {
  return TARGET_THEMES[targetName] ?? defaultTheme
}

export type DonationBreakdownSegment = {
  key: string
  label: string
  amount: number
  colorClass: string
}

/**
 * 전사 누적 기부액(totalCurrent)을 기부처별 구성으로 분해한다. 특별모금(급여공제)
 * 자체 모금액은 회사 예산 합산에서 제외되므로, totalCurrent에 실제로 포함된
 * "특별모금 매칭분"만 하나의 세그먼트로 묶어 보여준다(개별 특별모금 기부처 단위로는
 * 쪼개지 않음 — 매칭 집행이 기부처 단위로 나뉘어 추적되지 않기 때문).
 */
export function getDonationBreakdownSegments(
  targets: { target_id: string; name: string; current_amount: number; payroll_matching_amount?: number }[]
): DonationBreakdownSegment[] {
  const segments: DonationBreakdownSegment[] = []

  for (const t of targets) {
    const theme = getTargetTheme(t.name)
    if (getDonationFundingType(t.name) === '일반모금') {
      if (t.current_amount > 0) {
        segments.push({
          key: t.target_id,
          label: getDonationTargetDisplayName(t.name),
          amount: t.current_amount,
          colorClass: theme.progress,
        })
      }
    } else {
      // 특별모금은 직원 급여(current_amount)가 아니라 회사가 실제 매칭 집행한
      // 금액만 전사 합산/구성에 반영한다 — 모금별로 각각 세그먼트를 만든다.
      const matching = t.payroll_matching_amount ?? 0
      if (matching > 0) {
        segments.push({
          key: `${t.target_id}-matching`,
          label: `${getDonationTargetDisplayName(t.name)} 매칭`,
          amount: matching,
          colorClass: theme.progress,
        })
      }
    }
  }

  return segments
}

/** 기부처별 차트 색상 (고유 색상 — 아름다운가게 초록, 혜명보육원 노랑, 대한적십자사 빨강, 국제구조위원회 파랑) */
export const TARGET_CHART_COLORS: Record<string, string> = {
  '아름다운 가게': '#059669',
  '아름다운가게': '#059669',
  '혜명보육원': '#d97706',
  '대한적십자사': '#dc2626',
  '국제구조위원회': '#2563eb',
  '한국환경공단': '#dc2626',
  '한국사회복지협의회': '#2563eb',
}
