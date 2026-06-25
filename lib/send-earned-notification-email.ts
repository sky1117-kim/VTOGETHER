import nodemailer from 'nodemailer'
import {
  buildEarnedNotificationHtml,
  formatEarnedEmailFields,
  getVtogetherAppBaseUrl,
  type ComplimentEmailBlock,
} from '@/lib/email/earned-notification-html'

export type EarnedNotificationEmailPayload = {
  toEmail: string | null | undefined
  userName: string | null | undefined
  description: string | null
  amount: number
  currencyType: 'V_CREDIT' | 'V_MEDAL'
  transactionId?: string | null
  /** 칭찬 챌린지: 본문·조직명 등 상세 블록 */
  compliment?: ComplimentEmailBlock | null
  /** 칭찬 수신 알림 시 같은 부서 팀장 등 참조 */
  ccEmails?: string[]
}

function resolveDisplayName(userName: string | null | undefined): string {
  const trimmed = userName?.trim()
  if (trimmed) return trimmed
  return '회원'
}

function buildAppLink(transactionId?: string | null): string {
  const base = getVtogetherAppBaseUrl()
  if (transactionId?.trim()) {
    return `${base}/my?highlight=${encodeURIComponent(transactionId.trim())}#point-history`
  }
  return `${base}/my#point-history`
}

function buildSubject(
  amount: number,
  currencyType: 'V_CREDIT' | 'V_MEDAL',
  compliment?: ComplimentEmailBlock | null
): string {
  if (compliment?.audience === 'recipient' && compliment.message.trim()) {
    const title = compliment.eventTitle.trim() || '칭찬 챌린지'
    return `[V.Together] 칭찬이 도착했습니다 — ${title}`
  }
  const unit = currencyType === 'V_MEDAL' ? 'M' : 'C'
  return `[V.Together] +${amount.toLocaleString('ko-KR')} ${unit} 적립`
}

function isSmtpConfigured(): boolean {
  const host = process.env.SMTP_HOST?.trim()
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.trim()
  return Boolean(host && user && pass)
}

/** 벨 알림(EARNED)과 동일 내용의 HTML 메일 발송. SMTP 미설정 시 조용히 스킵 */
export async function sendEarnedNotificationEmail(
  payload: EarnedNotificationEmailPayload
): Promise<void> {
  const to = payload.toEmail?.trim()
  if (!to) return
  if (!isSmtpConfigured()) {
    if (process.env.NODE_ENV === 'development') {
      console.info('[Email] SMTP 미설정 — 적립 알림 메일 스킵:', to)
    }
    return
  }

  const { notificationContentHtml, earnedDetails } = formatEarnedEmailFields(
    payload.description,
    payload.amount,
    payload.currencyType
  )
  const html = buildEarnedNotificationHtml({
    userName: resolveDisplayName(payload.userName),
    notificationContentHtml,
    earnedDetails,
    appLink: buildAppLink(payload.transactionId),
    compliment: payload.compliment,
  })
  const subject = buildSubject(payload.amount, payload.currencyType, payload.compliment)

  const ccList = [...new Set((payload.ccEmails ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean))]
    .filter((cc) => cc !== to.toLowerCase())

  const host = process.env.SMTP_HOST!.trim()
  const port = Number(process.env.SMTP_PORT?.trim() || '587')
  const secure = process.env.SMTP_SECURE?.trim() === 'true' || port === 465
  const from =
    process.env.MAIL_FROM?.trim() || process.env.SMTP_USER!.trim()

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER!.trim(),
      pass: process.env.SMTP_PASS!.trim(),
    },
  })

  await transporter.sendMail({
    from,
    to,
    ...(ccList.length > 0 ? { cc: ccList.join(', ') } : {}),
    subject,
    html,
  })
}

/** 적립 기록 성공 후 비동기 발송 (본 요청 실패 방지) */
export function scheduleEarnedNotificationEmail(payload: EarnedNotificationEmailPayload): void {
  void sendEarnedNotificationEmail(payload).catch((error) => {
    console.error('[Email] 적립 알림 메일 전송 실패:', error)
  })
}
