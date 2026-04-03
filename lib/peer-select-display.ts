/**
 * PEER_SELECT(동료 선택) 제출값 표시용 공통 로직
 * — 관리자 심사 테이블·마이페이지 제출 내역에서 동일 규칙으로 팀명·멤버를 보여줍니다.
 */

export type PeerRecipientDisplay = {
  user_id: string
  name: string | null
  email: string | null
  dept_name: string | null
}

export type PeerMethodLite = { method_id: string; method_type: string }

/** verification_data에서 PEER_SELECT 항목·루트 peer_user_ids 순서로 동료 ID 목록 */
export function collectPeerUserIdsOrdered(
  vd: Record<string, unknown>,
  methods: PeerMethodLite[]
): string[] {
  for (const m of methods) {
    if (m.method_type !== 'PEER_SELECT') continue
    const val = vd[m.method_id]
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const ids = (val as { peer_user_ids?: unknown }).peer_user_ids
      if (Array.isArray(ids) && ids.length > 0) {
        const out: string[] = []
        const seen = new Set<string>()
        for (const x of ids) {
          const s = typeof x === 'string' ? x.trim() : ''
          if (s && !seen.has(s)) {
            seen.add(s)
            out.push(s)
          }
        }
        if (out.length > 0) return out
      }
    }
  }
  const root = vd.peer_user_ids
  if (Array.isArray(root) && root.length > 0) {
    const out: string[] = []
    const seen = new Set<string>()
    for (const x of root) {
      const s = typeof x === 'string' ? x.trim() : String(x).trim()
      if (s && !seen.has(s)) {
        seen.add(s)
        out.push(s)
      }
    }
    if (out.length > 0) return out
  }
  return []
}

export function peerIdsFromSelectRaw(rawValue: unknown): string[] {
  if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
    const v = rawValue as { peer_user_ids?: unknown }
    if (Array.isArray(v.peer_user_ids)) {
      return v.peer_user_ids.filter((x): x is string => typeof x === 'string' && !!x.trim())
    }
  }
  if (Array.isArray(rawValue)) {
    return rawValue.filter((x): x is string => typeof x === 'string' && !!x.trim())
  }
  return []
}

export function resolvePeerSelectTeamLabel(
  rawValue: unknown,
  recipients: PeerRecipientDisplay[] | undefined,
  ids: string[]
): string | null {
  if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
    const org = (rawValue as { organization_name?: unknown }).organization_name
    if (typeof org === 'string' && org.trim()) return org.trim()
  }
  if (ids.length <= 1 || !recipients?.length) return null
  const recMap = new Map(recipients.map((r) => [r.user_id, r]))
  const depts = new Set<string>()
  for (const id of ids) {
    const d = recMap.get(id)?.dept_name?.trim()
    if (d) depts.add(d)
  }
  if (depts.size === 1) return [...depts][0]!
  return null
}

/** 목록·카드·요약 한 줄 */
export function formatPeerSelectSummaryLine(
  rawValue: unknown,
  fallbackPeerName: string | null,
  recipients?: PeerRecipientDisplay[]
): string {
  const ids = peerIdsFromSelectRaw(rawValue)
  const recMap = new Map((recipients ?? []).map((r) => [r.user_id, r]))
  const names = ids.map((id) => recMap.get(id)?.name?.trim() || null)
  const teamLabel = resolvePeerSelectTeamLabel(rawValue, recipients, ids)

  if (ids.length === 0) {
    return fallbackPeerName ?? '동료 선택됨'
  }
  if (ids.length === 1) {
    const n = names[0] || fallbackPeerName || '동료 선택됨'
    return teamLabel ? `${teamLabel} · ${n}` : n
  }
  const resolved = names.filter(Boolean) as string[]
  if (teamLabel) {
    if (resolved.length > 0 && resolved.length <= 5) {
      return `${teamLabel} · ${resolved.join(', ')}`
    }
    return `${teamLabel} · ${ids.length}명`
  }
  const base = resolved[0] || fallbackPeerName || '동료'
  return resolved.length > 1 ? `${base} 외 ${ids.length - 1}명` : base
}

/** 팀(부서) 제목 + 멤버 줄 목록 (상세 카드·모달) */
export function buildPeerSelectMemberBlock(
  rawValue: unknown,
  recipients: PeerRecipientDisplay[],
  fallbackPeerName: string | null
): { teamLabel: string | null; memberLines: string[] } {
  const ids = peerIdsFromSelectRaw(rawValue)
  const recMap = new Map(recipients.map((r) => [r.user_id, r]))
  const teamLabel = resolvePeerSelectTeamLabel(rawValue, recipients, ids)

  const memberLines =
    ids.length > 0
      ? ids.map((id) => {
          const r = recMap.get(id)
          if (r) {
            return [r.name || '이름 없음', r.dept_name, r.email].filter(Boolean).join(' · ')
          }
          return `사용자 ID ${id.slice(0, 8)}… (프로필 조회 없음)`
        })
      : [fallbackPeerName ?? '동료 선택됨']

  return { teamLabel, memberLines }
}

export type PeerSelectRowLike = {
  peer_name: string | null
  verification_data: Record<string, unknown> | null
  verification_methods: PeerMethodLite[]
  peer_recipients?: PeerRecipientDisplay[]
}

/** 참여자 → 칭찬 대상 한 줄 (관리자 테이블 헤더 등) */
export function formatPeerHeaderSummary(row: PeerSelectRowLike): string | null {
  const vd = row.verification_data ?? {}
  const methods = row.verification_methods ?? []
  let raw: unknown = null
  for (const m of methods) {
    if (m.method_type === 'PEER_SELECT') {
      raw = vd[m.method_id]
      break
    }
  }
  const ids = peerIdsFromSelectRaw(raw)
  const pr = row.peer_recipients ?? []
  if (ids.length === 0) {
    return row.peer_name ?? null
  }
  const teamLabel = resolvePeerSelectTeamLabel(raw, pr.length > 0 ? pr : undefined, ids)
  if (ids.length > 1 && teamLabel) {
    return `${teamLabel} (${ids.length}명)`
  }
  if (ids.length > 1) {
    const recMap = new Map(pr.map((r) => [r.user_id, r]))
    const first = recMap.get(ids[0]!)?.name ?? row.peer_name ?? '동료'
    return `${first} 외 ${ids.length - 1}명`
  }
  return pr[0]?.name ?? row.peer_name ?? null
}
