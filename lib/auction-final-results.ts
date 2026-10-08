/**
 * 경매 "1인 1대" 원칙 + 단독 입찰 예외를 적용한 최종 낙찰자 계산.
 *
 * 규칙: 한 사람이 여러 품목에서 최고가를 쥐고 있으면, 그중 가장 높은 금액 품목만 낙찰되고
 * 나머지는 각 품목의 차순위 입찰자에게 넘어간다(차순위도 더 높은 다른 품목을 낙찰받으면 그다음
 * 순위로 연쇄 재배정). 단, 본인 말고 입찰자가 없는(단독 입찰) 품목은 이 제한과 무관하게 그대로
 * 낙찰된다.
 *
 * 구현: 단독 입찰 품목은 바로 확정하고, 2인 이상 경쟁 품목은 (품목, 입찰자, 금액) 전체를
 * 금액 내림차순으로 정렬해 순서대로 "품목·입찰자 둘 다 아직 비어있으면 배정"하는 그리디 방식으로
 * 처리한다. 이렇게 하면 각 입찰자는 자신의 가장 높은 금액 낙찰 건만 남고, 나머지는 자동으로
 * 차순위에게 넘어간다.
 */

export type AuctionBidLike = {
  item_id: string
  user_id: string
  bid_amount: number
}

export type FinalResultNote = '유찰' | '단독입찰' | '조정됨' | null

export type FinalWinner = {
  user_id: string
  amount: number
  note: FinalResultNote
}

/**
 * @param itemIds 대상 품목 id 목록 (경매 이벤트 내 전체 품목)
 * @param bids 해당 품목들에 대한 전체 입찰 기록 (item_id, user_id, bid_amount)
 * @param currentHighestBidderByItem 품목별 원래(가공 전) 최고 입찰자 id — '조정됨' 표시용. 생략 가능.
 * @returns item_id -> 최종 낙찰 정보 (낙찰자 없으면 맵에 없음)
 */
export function computeAuctionFinalWinners(
  itemIds: string[],
  bids: AuctionBidLike[],
  currentHighestBidderByItem?: Map<string, string | null | undefined>
): Map<string, FinalWinner> {
  const perItemBest = new Map<string, Map<string, number>>()
  for (const b of bids) {
    if (!perItemBest.has(b.item_id)) perItemBest.set(b.item_id, new Map())
    const m = perItemBest.get(b.item_id)!
    const existing = m.get(b.user_id)
    if (existing == null || b.bid_amount > existing) m.set(b.user_id, b.bid_amount)
  }

  type Candidate = { item_id: string; user_id: string; amount: number }
  const uncontestedWinner = new Map<string, Candidate>()
  const contestedCandidates: Candidate[] = []

  for (const itemId of itemIds) {
    const m = perItemBest.get(itemId)
    if (!m || m.size === 0) continue
    const ranked: Candidate[] = [...m.entries()]
      .map(([user_id, amount]) => ({ item_id: itemId, user_id, amount }))
      .sort((a, b) => b.amount - a.amount)
    if (ranked.length === 1) {
      uncontestedWinner.set(itemId, ranked[0])
    } else {
      contestedCandidates.push(...ranked)
    }
  }

  contestedCandidates.sort((a, b) => b.amount - a.amount)
  const assignedItemIds = new Set<string>()
  const assignedUserIds = new Set<string>()
  const contestedWinner = new Map<string, Candidate>()
  for (const c of contestedCandidates) {
    if (assignedItemIds.has(c.item_id) || assignedUserIds.has(c.user_id)) continue
    assignedItemIds.add(c.item_id)
    assignedUserIds.add(c.user_id)
    contestedWinner.set(c.item_id, c)
  }

  const result = new Map<string, FinalWinner>()
  for (const itemId of itemIds) {
    const uncontested = uncontestedWinner.get(itemId)
    if (uncontested) {
      result.set(itemId, { user_id: uncontested.user_id, amount: uncontested.amount, note: '단독입찰' })
      continue
    }
    const winner = contestedWinner.get(itemId)
    if (winner) {
      const rawWinnerId = currentHighestBidderByItem?.get(itemId)
      const adjusted = rawWinnerId != null && rawWinnerId !== winner.user_id
      result.set(itemId, { user_id: winner.user_id, amount: winner.amount, note: adjusted ? '조정됨' : null })
    }
    // 품목 입찰자 전원이 다른 품목에서 더 높은 금액으로 낙찰된 경우(드묾) — 낙찰자 없음(유찰)
  }
  return result
}
