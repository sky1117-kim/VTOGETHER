'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

// 공백 제거하여 .env 입력 오류 방지
const GUEST_TEST_USER_ID = (process.env.GUEST_TEST_USER_ID || '').trim()

type PledgeRpcResponse = {
  success: boolean
  amount: number
  previousAmount: number
}

/** 특별모금(급여공제) 신청 — V.Credit을 전혀 쓰지 않고, 신청 금액만 기록한다 */
export async function submitPayrollPledge(targetId: string, amount: number) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const allowGuestTestUser = process.env.NODE_ENV !== 'production'
  const useGuestTest = !user && allowGuestTestUser && !!GUEST_TEST_USER_ID
  if (!user && !useGuestTest) {
    return { error: '로그인이 필요합니다' }
  }

  let client: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>
  let rpcUserId: string | null = null
  if (useGuestTest) {
    try {
      client = createAdminClient()
      rpcUserId = GUEST_TEST_USER_ID
    } catch {
      return { error: '테스트 모드: .env에 SUPABASE_SERVICE_ROLE_KEY를 설정해주세요.' }
    }
  } else {
    client = supabase
    rpcUserId = null
  }

  try {
    const { data, error } = await client.rpc('submit_payroll_pledge_atomic', {
      p_target_id: targetId,
      p_amount: amount,
      p_user_id: rpcUserId,
    })

    if (error) {
      return { error: error.message || '신청 처리 중 오류가 발생했습니다' }
    }

    const payload = (data ?? null) as PledgeRpcResponse | null
    if (!payload?.success) {
      return { error: '신청 처리 중 오류가 발생했습니다' }
    }

    revalidatePath('/donation')
    revalidatePath('/')
    revalidatePath('/admin/donation-targets')

    return { success: true, amount: payload.amount, previousAmount: payload.previousAmount }
  } catch (error) {
    console.error('Payroll pledge error:', error)
    return { error: '신청 처리 중 오류가 발생했습니다' }
  }
}
