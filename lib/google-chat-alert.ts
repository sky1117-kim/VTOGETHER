type AlertSource = 'server' | 'client'

interface GoogleChatAlertPayload {
  title: string
  message: string
  source: AlertSource
  path?: string
  userAgent?: string
}

function trimText(value: string, max = 1200) {
  if (value.length <= max) return value
  return `${value.slice(0, max)}...`
}

// 서버에서만 사용하는 구글 챗 웹훅 알림 함수입니다.
export async function sendGoogleChatAlert(payload: GoogleChatAlertPayload) {
  const webhookUrl = process.env.GOOGLE_CHAT_WEBHOOK_URL
  if (!webhookUrl) return

  const lines = [
    `🚨 [${payload.source.toUpperCase()}] ${payload.title}`,
    `- env: ${process.env.NODE_ENV ?? 'unknown'}`,
    payload.path ? `- path: ${payload.path}` : null,
    payload.userAgent ? `- ua: ${trimText(payload.userAgent, 300)}` : null,
    `- time: ${new Date().toISOString()}`,
    '',
    trimText(payload.message),
  ].filter(Boolean)

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ text: lines.join('\n') }),
      cache: 'no-store',
    })
  } catch (error) {
    // 알림 전송 실패가 본 요청까지 실패시키지 않도록 로그만 남깁니다.
    console.error('[Alert] Google Chat 전송 실패:', error)
  }
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) return `${error.name}: ${error.message}`
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return '알 수 없는 에러'
  }
}
