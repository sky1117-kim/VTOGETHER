'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

// 공백 제거하여 .env 입력 오류 방지
const GUEST_TEST_USER_ID = (process.env.GUEST_TEST_USER_ID || '').trim()
type UserLevel = 'ECO_KEEPER' | 'GREEN_MASTER' | 'EARTH_HERO'
const LEVEL_ORDER: UserLevel[] = ['ECO_KEEPER', 'GREEN_MASTER', 'EARTH_HERO']
const LEVEL_MEDAL_REWARD: Record<Exclude<UserLevel, 'ECO_KEEPER'>, number> = {
  GREEN_MASTER: 5,
  EARTH_HERO: 10,
}

function getLevelByTotalDonated(totalDonated: number): UserLevel {
  if (totalDonated >= 150001) return 'EARTH_HERO'
  if (totalDonated >= 100001) return 'GREEN_MASTER'
  return 'ECO_KEEPER'
}

function getLevelUpAwards(fromLevel: UserLevel, toLevel: UserLevel): { level: Exclude<UserLevel, 'ECO_KEEPER'>; medals: number }[] {
  const fromIdx = LEVEL_ORDER.indexOf(fromLevel)
  const toIdx = LEVEL_ORDER.indexOf(toLevel)
  if (fromIdx < 0 || toIdx < 0 || toIdx <= fromIdx) return []
  const crossed = LEVEL_ORDER.slice(fromIdx + 1, toIdx + 1)
  return crossed
    .filter((lvl): lvl is Exclude<UserLevel, 'ECO_KEEPER'> => lvl !== 'ECO_KEEPER')
    .map((lvl) => ({ level: lvl, medals: LEVEL_MEDAL_REWARD[lvl] }))
}

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
    .select('current_points, current_medals, total_donated_amount, email, name, level')
    .eq('user_id', effectiveUserId)
    .is('deleted_at', null)
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

  // FIFO lot 확인: 오래된 순서대로 차감 가능한 lot를 미리 계산
  const { data: lots, error: lotsError } = await client
    .from('credit_lots')
    .select('lot_id, remaining_amount')
    .eq('user_id', effectiveUserId)
    .is('deleted_at', null)
    .gt('remaining_amount', 0)
    .order('created_at', { ascending: true })

  if (lotsError) {
    return { error: '기부 출처 조회 실패' }
  }
  const creditLots = lots ?? []
  const totalRemaining = creditLots.reduce((sum, lot) => sum + (lot.remaining_amount ?? 0), 0)
  if (totalRemaining < amount) {
    return { error: '기부 가능한 V.Credit 출처가 부족합니다. 상점 전환 내역을 확인해주세요.' }
  }

  // 기부처 정보 조회
  const { data: target, error: targetError } = await client
    .from('donation_targets')
    .select('*')
    .eq('target_id', targetId)
    .is('deleted_at', null)
    .single()

  if (targetError || !target) {
    return { error: '기부처를 찾을 수 없습니다' }
  }

  if (target.status === 'COMPLETED') {
    return { error: '이미 목표를 달성한 기부처입니다' }
  }

  try {
    const previousLevel = getLevelByTotalDonated(userData.total_donated_amount ?? 0)
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

    // 2-1. FIFO lot 차감 및 할당 내역 저장
    let remain = amount
    for (const lot of creditLots) {
      if (remain <= 0) break
      const available = lot.remaining_amount ?? 0
      if (available <= 0) continue
      const useAmount = Math.min(available, remain)
      remain -= useAmount

      const { error: lotUpdateErr } = await client
        .from('credit_lots')
        .update({ remaining_amount: available - useAmount })
        .eq('lot_id', lot.lot_id)
      if (lotUpdateErr) return { error: '기부 출처 차감 실패' }

      const { error: allocErr } = await client
        .from('donation_lot_allocations')
        .insert({
          donation_id: donation.donation_id,
          lot_id: lot.lot_id,
          allocated_amount: useAmount,
        })
      if (allocErr) return { error: '기부 출처 기록 실패' }
    }
    if (remain > 0) return { error: '기부 출처 계산 오류가 발생했습니다.' }

    // 3. 포인트 거래 내역 기록 (차감) — 추출 시 보기 쉽게 이메일·이름·기부처명도 함께 저장
    const { error: transactionError } = await client
      .from('point_transactions')
      .insert({
        user_id: effectiveUserId,
        type: 'DONATED',
        amount: -amount,
        currency_type: 'V_CREDIT',
        related_id: donation.donation_id,
        related_type: 'DONATION',
        description: `${target.name}에 ${amount.toLocaleString()}C 기부`,
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

    // 4-1. 등급 상승 체크 후 V.Medal 지급
    let levelUpPayload: { fromLevel: UserLevel; toLevel: UserLevel; awardedMedals: number } | null = null
    const { data: latestUser } = await client
      .from('users')
      .select('current_medals')
      .eq('user_id', effectiveUserId)
      .is('deleted_at', null)
      .single()
    const newLevel = getLevelByTotalDonated(newTotalDonated)
    const awards = getLevelUpAwards(previousLevel, newLevel)
    if (awards.length > 0) {
      const medalSum = awards.reduce((sum, a) => sum + a.medals, 0)
      const currentMedals = latestUser?.current_medals ?? userData.current_medals ?? 0
      const { error: medalUpdateErr } = await client
        .from('users')
        .update({ current_medals: currentMedals + medalSum })
        .eq('user_id', effectiveUserId)
      if (medalUpdateErr) return { error: '레벨업 메달 지급 실패' }

      for (const a of awards) {
        const levelLabel = a.level === 'GREEN_MASTER' ? 'Green Master' : 'Earth Hero'
        const { error: levelTxErr } = await client.from('point_transactions').insert({
          user_id: effectiveUserId,
          type: 'EARNED',
          amount: a.medals,
          currency_type: 'V_MEDAL',
          related_id: null,
          related_type: 'LEVEL_UP',
          description: `레벨업 축하: ${levelLabel} 달성으로 ${a.medals} M 지급`,
          user_email: userData.email ?? null,
          user_name: userData.name ?? null,
        })
        if (levelTxErr) return { error: '레벨업 거래 내역 기록 실패' }
      }
      levelUpPayload = { fromLevel: previousLevel, toLevel: newLevel, awardedMedals: medalSum }
    }

    // 5. 페이지 재검증
    revalidatePath('/donation')
    revalidatePath('/my')
    revalidatePath('/')

    return { success: true, completed: isCompleted, levelUp: levelUpPayload }
  } catch (error) {
    console.error('Donation error:', error)
    return { error: '기부 처리 중 오류가 발생했습니다' }
  }
}
