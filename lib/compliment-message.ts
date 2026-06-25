/**
 * 칭찬 챌린지 제출(verification_data)에서 추천 사유·조직명 추출
 * 마이페이지·메일·관리자 화면에서 동일 규칙 사용
 */

export type ComplimentMessageContext = {
  message: string
  organization_name: string | null
}

type VerificationMethodRow = {
  method_id: string
  method_type: string
  input_style?: string | null
}

function longestStringInKeys(vd: Record<string, unknown>, methodIds: string[]): string {
  let best = ''
  for (const mid of methodIds) {
    const v = vd[mid]
    if (typeof v !== 'string') continue
    const t = v.trim()
    if (t.length > best.length) best = t
  }
  return best
}

function extractPeerOrgAndLegacyString(
  vd: Record<string, unknown>,
  peerMethodId: string | undefined
): { organizationName: string; legacyMessage: string } {
  if (!peerMethodId) return { organizationName: '', legacyMessage: '' }
  const raw = vd[peerMethodId]
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = (raw as { organization_name?: unknown }).organization_name
    const organizationName = typeof o === 'string' ? o.trim() : ''
    return { organizationName, legacyMessage: '' }
  }
  if (typeof raw === 'string') {
    const t = raw.trim()
    if (t && !/^[0-9a-f-]{36}$/i.test(t)) return { organizationName: '', legacyMessage: t }
  }
  return { organizationName: '', legacyMessage: '' }
}

/** 이벤트 인증 방식 목록 + verification_data → 칭찬 본문 */
export function extractComplimentMessageFromSubmission(
  verificationData: Record<string, unknown> | null | undefined,
  methods: VerificationMethodRow[]
): ComplimentMessageContext {
  const vd = verificationData ?? {}
  const peerMethod = methods.find((m) => m.method_type === 'PEER_SELECT')
  const peerMethodId = peerMethod?.method_id

  const textLongIds: string[] = []
  const textShortIds: string[] = []
  const textChoiceIds: string[] = []
  const hasPeer = !!peerMethod

  for (const m of methods) {
    if (!hasPeer || m.method_type !== 'TEXT') continue
    if (m.input_style === 'SHORT') textShortIds.push(m.method_id)
    else if (m.input_style === 'CHOICE') textChoiceIds.push(m.method_id)
    else textLongIds.push(m.method_id)
  }

  const fromLong = longestStringInKeys(vd, textLongIds)
  if (fromLong) {
    const { organizationName } = extractPeerOrgAndLegacyString(vd, peerMethodId)
    return { message: fromLong, organization_name: organizationName || null }
  }
  const fromShort = longestStringInKeys(vd, textShortIds)
  if (fromShort) {
    const { organizationName } = extractPeerOrgAndLegacyString(vd, peerMethodId)
    return { message: fromShort, organization_name: organizationName || null }
  }
  const fromChoice = longestStringInKeys(vd, textChoiceIds)
  if (fromChoice) {
    const { organizationName } = extractPeerOrgAndLegacyString(vd, peerMethodId)
    return { message: fromChoice, organization_name: organizationName || null }
  }
  const { organizationName, legacyMessage } = extractPeerOrgAndLegacyString(vd, peerMethodId)
  return {
    message: legacyMessage,
    organization_name: organizationName || null,
  }
}
