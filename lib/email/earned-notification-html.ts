import { getEarnedDisplay } from '@/lib/point-display'

/** 운영 기본 URL (Cloud Run). NEXT_PUBLIC_APP_URL이 있으면 우선 사용 */
export const DEFAULT_VTOGETHER_APP_URL = 'https://vtogether-899896571605.asia-northeast3.run.app'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function getVtogetherAppBaseUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.NEXT_PUBLIC_DEV_APP_URL?.trim()
  const base = (fromEnv || DEFAULT_VTOGETHER_APP_URL).replace(/\/+$/, '')
  return base
}

export function formatEarnedEmailFields(
  description: string | null,
  amount: number,
  currencyType: 'V_CREDIT' | 'V_MEDAL'
): { notificationContentHtml: string; earnedDetails: string } {
  const earned = getEarnedDisplay(description)
  const parts: string[] = []
  if (earned.text) parts.push(earned.text)
  if (earned.badge) parts.push(earned.badge)
  const notificationPlain = parts.length > 0 ? parts.join('\n') : '적립'
  const notificationContentHtml = escapeHtml(notificationPlain).replace(/\n/g, '<br />')
  const unit = currencyType === 'V_MEDAL' ? 'M' : 'C'
  const earnedDetails = `+${amount.toLocaleString('ko-KR')} ${unit}`
  return { notificationContentHtml, earnedDetails }
}

export type ComplimentEmailBlock = {
  eventTitle: string
  message: string
  organizationName?: string | null
  /** 수신자용: 칭찬 보낸 사람 (익명이면 비움) */
  senderDisplayName?: string | null
  /** 발신자용: 칭찬 받은 사람 요약 */
  recipientSummary?: string | null
  audience: 'recipient' | 'sender'
}

function buildComplimentBlockHtml(block: ComplimentEmailBlock): string {
  const eventTitle = escapeHtml(block.eventTitle.trim() || '칭찬 챌린지')
  const message = escapeHtml(block.message.trim() || '(내용 없음)').replace(/\n/g, '<br />')
  const org =
    block.organizationName?.trim() ?
      `<tr><td style="padding-top:12px;font-size:14px;color:#475569;"><strong>칭찬 조직</strong><br />${escapeHtml(block.organizationName.trim())}</td></tr>`
    : ''

  let metaRow = ''
  if (block.audience === 'recipient') {
    const from =
      block.senderDisplayName?.trim() ?
        escapeHtml(block.senderDisplayName.trim())
      : '익명의 동료'
    metaRow = `<tr><td style="padding-top:12px;font-size:14px;color:#475569;"><strong>칭찬 보낸 분</strong><br />${from}</td></tr>`
  } else if (block.recipientSummary?.trim()) {
    metaRow = `<tr><td style="padding-top:12px;font-size:14px;color:#475569;"><strong>칭찬 받은 분</strong><br />${escapeHtml(block.recipientSummary.trim())}</td></tr>`
  }

  return `
                                        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:25px;">
                                            <tr>
                                                <td style="padding-bottom:8px;font-size:13px;font-weight:800;color:#7c3aed;text-transform:uppercase;letter-spacing:0.5px;">
                                                    💬 칭찬 내용
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="font-size:15px;font-weight:700;color:#0f172a;line-height:1.6;">
                                                    ${eventTitle}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding-top:14px;font-size:15px;color:#334155;line-height:1.75;word-break:keep-all;">
                                                    ${message}
                                                </td>
                                            </tr>
                                            ${org}
                                            ${metaRow}
                                        </table>
                                        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:25px;">
                                            <tr>
                                                <td style="border-top:1.5px dashed #e2e8f0;height:1px;"></td>
                                            </tr>
                                        </table>`
}

export function buildEarnedNotificationHtml(params: {
  userName: string
  notificationContentHtml: string
  earnedDetails: string
  appLink: string
  compliment?: ComplimentEmailBlock | null
}): string {
  const userName = escapeHtml(params.userName)
  const earnedDetails = escapeHtml(params.earnedDetails)
  const appLink = escapeHtml(params.appLink)
  const complimentHtml =
    params.compliment && (params.compliment.message.trim() || params.compliment.eventTitle.trim()) ?
      buildComplimentBlockHtml(params.compliment)
    : ''

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="ko">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>V.Together 알림 메일</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; -webkit-font-smoothing: antialiased;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff;">
        <tr>
            <td align="center" style="padding: 40px 0;">
                <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 32px; border: 1px solid #f1f5f9; box-shadow: 0 20px 50px rgba(15, 23, 42, 0.04); overflow: hidden; table-layout: fixed;">
                    <tr>
                        <td style="background-color: #f8fafc; padding: 45px 40px; text-align: left; border-bottom: 1px solid #f1f5f9;">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td>
                                        <div style="display: inline-block; background-color: #e6f4ea; color: #0f5132; font-size: 11px; font-weight: 800; padding: 6px 14px; border-radius: 50px; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 16px;">
                                            V.Together Notification
                                        </div>
                                        <h1 style="margin: 0; color: #0f172a; font-size: 28px; font-weight: 900; letter-spacing: -1.5px; line-height: 1.2;">새로운 알림이 도착했습니다</h1>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 50px 40px 45px 40px;">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 35px;">
                                <tr>
                                    <td style="font-size: 19px; color: #0f172a; line-height: 1.6; font-weight: 800;">
                                        안녕하세요, ${userName}님!
                                    </td>
                                </tr>
                                <tr>
                                    <td style="font-size: 16px; color: #475569; line-height: 1.6; padding-top: 15px; word-break: keep-all;">
                                        새로운 알림이 있습니다.
                                    </td>
                                </tr>
                                <tr>
                                    <td style="font-size: 16px; color: #475569; line-height: 1.6; padding-top: 8px; word-break: keep-all;">
                                        웹에 접속해서 자세히 확인해 보세요.
                                    </td>
                                </tr>
                            </table>
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-left: 6px solid #10b981; border-radius: 16px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.01); overflow: hidden; margin-bottom: 40px;">
                                <tr>
                                    <td style="padding: 30px;">
                                        ${complimentHtml}
                                        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 25px;">
                                            <tr>
                                                <td style="padding-bottom: 8px; font-size: 13px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
                                                    🔔 알림 내용
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="font-size: 16px; font-weight: 700; color: #0f172a; line-height: 1.6; word-break: keep-all;">
                                                    ${params.notificationContentHtml}
                                                </td>
                                            </tr>
                                        </table>
                                        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 25px;">
                                            <tr>
                                                <td style="border-top: 1.5px dashed #e2e8f0; height: 1px;"></td>
                                            </tr>
                                        </table>
                                        <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                            <tr>
                                                <td style="padding-bottom: 8px; font-size: 13px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
                                                    🎁 적립 내역
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="font-size: 18px; font-weight: 900; color: #10b981; line-height: 1.5;">
                                                    ${earnedDetails}
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="text-align: center; margin-bottom: 10px;">
                                <tr>
                                    <td>
                                        <a href="${appLink}" target="_blank" style="display: inline-block; background-color: #10b981; color: #ffffff !important; padding: 18px 55px; border-radius: 100px; font-weight: 700; font-size: 15.5px; text-decoration: none; box-shadow: 0 10px 20px rgba(16, 185, 129, 0.15);">
                                            V.Together 바로가기 ➔
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="background-color: #f8fafc; padding: 35px 40px; text-align: center; border-top: 1px solid #f1f5f9; border-radius: 0 0 31px 31px;">
                            <p style="margin: 0; font-size: 12px; color: #94a3b8; font-weight: 800; letter-spacing: 1px; text-transform: uppercase;">
                                VNTG V.Together Platform
                            </p>
                            <p style="margin: 8px 0 0 0; font-size: 11px; color: #94a3b8; line-height: 1.6;">
                                본 메일은 시스템 자동 발송 전용으로 회신이 불가능합니다.<br />
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`
}
