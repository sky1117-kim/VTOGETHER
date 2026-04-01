/**
 * 이벤트 보상 표시 (관리자 목록·메인 카드·모달 공통)
 * event_rewards 우선, 없으면 events.reward_type / reward_amount
 */
export type EventRewardDisplayInput = {
  reward_preview_kind?: 'V_CREDIT' | 'V_MEDAL' | null
  reward_preview_amount?: number | null
  reward_type?: string | null
  reward_amount?: number | null
}

/** 예: "50 메달", "100 크레딧", "보상 미설정" */
export function formatEventRewardLabel(event: EventRewardDisplayInput): string {
  if (event.reward_preview_kind && event.reward_preview_amount != null) {
    return event.reward_preview_kind === 'V_MEDAL'
      ? `${event.reward_preview_amount.toLocaleString()} 메달`
      : `${event.reward_preview_amount.toLocaleString()} 크레딧`
  }

  if (event.reward_type === 'V_CREDIT' || event.reward_type === 'POINTS') {
    return event.reward_amount != null
      ? `${event.reward_amount.toLocaleString()} 크레딧`
      : '크레딧'
  }
  if (event.reward_type === 'V_MEDAL') {
    return event.reward_amount != null
      ? `${event.reward_amount.toLocaleString()} 메달`
      : '메달'
  }

  return '보상 미설정'
}

/** 카드·뱃지용 숫자 + M/C (포인트 내역 표기와 통일) */
export function formatEventRewardShort(event: EventRewardDisplayInput): {
  amountText: string
  unit: 'M' | 'C' | null
  unset: boolean
} {
  if (event.reward_preview_kind && event.reward_preview_amount != null) {
    return {
      amountText: event.reward_preview_amount.toLocaleString(),
      unit: event.reward_preview_kind === 'V_MEDAL' ? 'M' : 'C',
      unset: false,
    }
  }
  if (event.reward_type === 'V_CREDIT' || event.reward_type === 'POINTS') {
    return {
      amountText: event.reward_amount != null ? event.reward_amount.toLocaleString() : '',
      unit: 'C',
      unset: event.reward_amount == null,
    }
  }
  if (event.reward_type === 'V_MEDAL') {
    return {
      amountText: event.reward_amount != null ? event.reward_amount.toLocaleString() : '',
      unit: 'M',
      unset: event.reward_amount == null,
    }
  }
  return { amountText: '', unit: null, unset: true }
}
