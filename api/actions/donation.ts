'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

// 공백 제거하여 .env 입력 오류 방지
const GUEST_TEST_USER_ID = (process.env.GUEST_TEST_USER_ID || '').trim()

export async function donatePoints(targetId: string, amount: number) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 비로그인 + 테스트 모드: 테스트 유저로 기부 처리 (admin 클라이언트 사용)
  const effectiveUserId = user?.id ?? (GUEST_TEST_USER_ID || null)
  if (!effectiveUserId) {
    return { error: '로그인이 필요합니다' }
  }

  const useGuestTest = !user && GUEST_TEST_USER_ID
  let client
  if (useGuestTest) {
    try {
      client = createAdminClient()
    } catch {
      return { error: '테스트 모드: .env에 SUPABASE_SERVICE_ROLE_KEY를 설정해주세요.' }
    }
  } else {
    client = supabase
  }

  // 사용자 정보 조회 (포인트 + 추출용 이메일/이름)
  const { data: userData, error: userError } = await client
    .from('users')
    .select('current_points, total_donated_amount, email, name')
    .eq('user_id', effectiveUserId)
    .single()

  if (userError || !userData) {
    // 게스트 테스트 시: DB에 테스트 유저가 없을 때 안내
    if (useGuestTest) {
      return {
        error:
          '게스트 테스트용 사용자를 찾을 수 없습니다. Supabase SQL Editor에서 docs/migrations/003-guest-test-user.sql 을 실행한 뒤, .env에 GUEST_TEST_USER_ID=guest-test 가 맞는지 확인해주세요.',
      }
    }
    return { error: '사용자 정보를 찾을 수 없습니다' }
  }

  // 포인트 확인
  if (userData.current_points < amount) {
    return { error: '보유 포인트가 부족합니다' }
  }

  // 기부처 정보 조회
  const { data: target, error: targetError } = await client
    .from('donation_targets')
    .select('*')
    .eq('target_id', targetId)
    .single()

  if (targetError || !target) {
    return { error: '기부처를 찾을 수 없습니다' }
  }

  if (target.status === 'COMPLETED') {
    return { error: '이미 목표를 달성한 기부처입니다' }
  }

  try {
    // 트랜잭션 시작 (Supabase는 자동으로 트랜잭션 처리)
    // 1. 사용자 포인트 차감 및 기부 금액 누적
    const newTotalDonated = userData.total_donated_amount + amount
    const { error: updateUserError } = await client
      .from('users')
      .update({
        current_points: userData.current_points - amount,
        total_donated_amount: newTotalDonated,
      })
      .eq('user_id', effectiveUserId)

    if (updateUserError) {
      return { error: '사용자 정보 업데이트 실패' }
    }

    // 2. 기부 내역 기록
    const { data: donation, error: donationError } = await client
      .from('donations')
      .insert({
        user_id: effectiveUserId,
        target_id: targetId,
        amount: amount,
      })
      .select()
      .single()

    if (donationError || !donation) {
      return { error: '기부 내역 기록 실패' }
    }

    // 3. 포인트 거래 내역 기록 (차감) — 추출 시 보기 쉽게 이메일·이름·기부처명도 함께 저장
    const { error: transactionError } = await client
      .from('point_transactions')
      .insert({
        user_id: effectiveUserId,
        type: 'DONATED',
        amount: -amount,
        related_id: donation.donation_id,
        related_type: 'DONATION',
        description: `${target.name}에 ${amount.toLocaleString()}P 기부`,
        user_email: userData.email ?? null,
        user_name: userData.name ?? null,
        donation_target_name: target.name,
      })

    if (transactionError) {
      return { error: '거래 내역 기록 실패' }
    }

    // 4. 기부처 모금액 업데이트
    const newCurrentAmount = target.current_amount + amount
    const isCompleted = newCurrentAmount >= target.target_amount

    const { error: updateTargetError } = await client
      .from('donation_targets')
      .update({
        current_amount: newCurrentAmount,
        status: isCompleted ? 'COMPLETED' : 'ACTIVE',
      })
      .eq('target_id', targetId)

    if (updateTargetError) {
      return { error: '기부처 정보 업데이트 실패' }
    }

    // 5. 페이지 재검증
    revalidatePath('/donation')
    revalidatePath('/my')
    revalidatePath('/')

    return { success: true, completed: isCompleted }
  } catch (error) {
    console.error('Donation error:', error)
    return { error: '기부 처리 중 오류가 발생했습니다' }
  }
}
