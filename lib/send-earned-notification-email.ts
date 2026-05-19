import nodemailer from 'nodemailer'
import {
  buildEarnedNotificationHtml,
  formatEarnedEmailFields,
  getVtogetherAppBaseUrl,
} from '@/lib/email/earned-notification-html'

export type EarnedNotificationEmailPayload = {
  toEmail: string | null | undefined
  userName: string | null | undefined
  description: string | null
  amount: number
  currencyType: 'V_CREDIT' | 'V_MEDAL'
  transactionId?: string | null
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

function buildSubject(amount: number, currencyType: 'V_CREDIT' | 'V_MEDAL'): string {
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
  })
  const subject = buildSubject(payload.amount, payload.currencyType)

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
