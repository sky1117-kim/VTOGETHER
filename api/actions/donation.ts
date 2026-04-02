'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

// 공백 제거하여 .env 입력 오류 방지
const GUEST_TEST_USER_ID = (process.env.GUEST_TEST_USER_ID || '').trim()
type UserLevel = 'ECO_KEEPER' | 'GREEN_MASTER' | 'EARTH_HERO'

type DonationRpcResponse = {
  success: boolean
  completed: boolean
  levelUp?: {
    fromLevel: UserLevel
    toLevel: UserLevel
    awardedMedals: number
  } | null
}

export async function donatePoints(targetId: string, amount: number) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const useGuestTest = !user && !!GUEST_TEST_USER_ID
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
    const { data, error } = await client.rpc('process_donation_atomic', {
      p_target_id: targetId,
      p_amount: amount,
      p_user_id: rpcUserId,
    })

    if (error) {
      // 게스트 테스트 시: DB에 테스트 유저가 없을 때 기존 친화 메시지 유지
      if (useGuestTest && error.message.includes('사용자 정보를 찾을 수 없습니다')) {
        return {
          error:
            '게스트 테스트용 사용자를 찾을 수 없습니다. Supabase SQL Editor에서 docs/migrations/003-guest-test-user.sql 을 실행한 뒤, .env에 GUEST_TEST_USER_ID=guest-test 가 맞는지 확인해주세요.',
        }
      }
      return { error: error.message || '기부 처리 중 오류가 발생했습니다' }
    }

    const payload = (data ?? null) as DonationRpcResponse | null
    if (!payload?.success) {
      return { error: '기부 처리 중 오류가 발생했습니다' }
    }

    revalidatePath('/donation')
    revalidatePath('/my')
    revalidatePath('/')

    return {
      success: true,
      completed: !!payload.completed,
      levelUp: payload.levelUp ?? null,
    }
  } catch (error) {
    console.error('Donation error:', error)
    return { error: '기부 처리 중 오류가 발생했습니다' }
  }
}
