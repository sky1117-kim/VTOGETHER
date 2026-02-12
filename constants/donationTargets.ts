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
  // 예전 시드 이름(로컬 DB 미반영 시에도 이미지 노출)
  '한국환경공단':
    'https://images.unsplash.com/photo-1584515933487-779824d29309?w=600&q=80',
  '한국사회복지협의회':
    'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=600&q=80',
}

/** DB에 예전 이름이 있을 때 화면에 표시할 이름 (로컬 반영용) */
export const TARGET_DISPLAY_NAMES: Record<string, string> = {
  '아름다운가게': '아름다운 가게',
  '한국환경공단': '대한적십자사',
  '한국사회복지협의회': '국제구조위원회',
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

/** 기부처별 카드/버튼 테마 (아름다운가게 초록, 혜명보육원 노랑, 대한적십자사 빨강, 국제구조위원회 파랑) */
export type TargetTheme = {
  border: string
  text: string
  bg: string
  progress: string
  button: string
}

const defaultTheme: TargetTheme = {
  border: 'border-gray-400',
  text: 'text-gray-600',
  bg: 'bg-gray-50',
  progress: 'bg-gray-500',
  button: 'border-gray-400 text-gray-600 hover:bg-gray-50',
}

export const TARGET_THEMES: Record<string, TargetTheme> = {
  '아름다운 가게': {
    border: 'border-emerald-500',
    text: 'text-emerald-600',
    bg: 'bg-emerald-50',
    progress: 'bg-emerald-500',
    button: 'border-emerald-500 text-emerald-600 hover:bg-emerald-50',
  },
  '아름다운가게': {
    border: 'border-emerald-500',
    text: 'text-emerald-600',
    bg: 'bg-emerald-50',
    progress: 'bg-emerald-500',
    button: 'border-emerald-500 text-emerald-600 hover:bg-emerald-50',
  },
  '혜명보육원': {
    border: 'border-amber-500',
    text: 'text-amber-600',
    bg: 'bg-amber-50',
    progress: 'bg-amber-500',
    button: 'border-amber-500 text-amber-600 hover:bg-amber-50',
  },
  '대한적십자사': {
    border: 'border-red-500',
    text: 'text-red-600',
    bg: 'bg-red-50',
    progress: 'bg-red-500',
    button: 'border-red-500 text-red-600 hover:bg-red-50',
  },
  '국제구조위원회': {
    border: 'border-blue-500',
    text: 'text-blue-600',
    bg: 'bg-blue-50',
    progress: 'bg-blue-500',
    button: 'border-blue-500 text-blue-600 hover:bg-blue-50',
  },
  '한국환경공단': {
    border: 'border-red-500',
    text: 'text-red-600',
    bg: 'bg-red-50',
    progress: 'bg-red-500',
    button: 'border-red-500 text-red-600 hover:bg-red-50',
  },
  '한국사회복지협의회': {
    border: 'border-blue-500',
    text: 'text-blue-600',
    bg: 'bg-blue-50',
    progress: 'bg-blue-500',
    button: 'border-blue-500 text-blue-600 hover:bg-blue-50',
  },
}

export function getTargetTheme(targetName: string): TargetTheme {
  return TARGET_THEMES[targetName] ?? defaultTheme
}
