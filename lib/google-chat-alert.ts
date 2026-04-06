type AlertSource = 'server' | 'client'

interface GoogleChatAlertPayload {
  title: string
  message: string
  source: AlertSource
  path?: string
  userAgent?: string
  userId?: string
  userEmail?: string
  userName?: string
}

function trimText(value: string, max = 1200) {
  if (value.length <= max) return value
  return `${value.slice(0, max)}...`
}

async function postGoogleChatMessage(webhookUrl: string, text: string) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ text }),
    cache: 'no-store',
  })
  // 웹훅 URL 만료·권한 오류 시에도 fetch는 끝나므로 상태를 확인해 서버 로그에 남깁니다.
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    console.error('[Alert] Google Chat 웹훅 HTTP 오류:', res.status, errText.slice(0, 500))
  }
}

// 서버에서만 사용하는 구글 챗 "에러 알림" 웹훅 함수입니다.
export async function sendGoogleChatAlert(payload: GoogleChatAlertPayload) {
  const webhookUrl = process.env.GOOGLE_CHAT_WEBHOOK_URL
  if (!webhookUrl) return

  const lines = [
    `🚨 [${payload.source.toUpperCase()}] ${payload.title}`,
    `- env: ${process.env.NODE_ENV ?? 'unknown'}`,
    payload.path ? `- path: ${payload.path}` : null,
    payload.userAgent ? `- ua: ${trimText(payload.userAgent, 300)}` : null,
    payload.userId ? `- user_id: ${payload.userId}` : null,
    payload.userEmail ? `- user_email: ${payload.userEmail}` : null,
    payload.userName ? `- user_name: ${payload.userName}` : null,
    `- time: ${new Date().toISOString()}`,
    '',
    trimText(payload.message),
  ].filter(Boolean)

  try {
    await postGoogleChatMessage(webhookUrl, lines.join('\n'))
  } catch (error) {
    // 알림 전송 실패가 본 요청까지 실패시키지 않도록 로그만 남깁니다.
    console.error('[Alert] Google Chat 전송 실패:', error)
  }
}

interface AdminGoogleChatAlertPayload {
  title: string
  message: string
  userEmail?: string
  userName?: string
}

// 서버에서만 사용하는 구글 챗 "관리자 운영 알림" 웹훅 함수입니다.
export async function sendGoogleChatAdminAlert(payload: AdminGoogleChatAlertPayload) {
  const webhookUrl = process.env.GOOGLE_CHAT_ADMIN_WEBHOOK_URL
  if (!webhookUrl) return

  const lines = [
    `📌 [ADMIN] ${payload.title}`,
    payload.userEmail ? `- user_email: ${payload.userEmail}` : null,
    payload.userName ? `- user_name: ${payload.userName}` : null,
    `- time: ${new Date().toISOString()}`,
    '',
    trimText(payload.message),
  ].filter(Boolean)

  try {
    await postGoogleChatMessage(webhookUrl, lines.join('\n'))
  } catch (error) {
    // 관리자 알림 실패도 본 요청을 막지 않도록 로그만 남깁니다.
    console.error('[Alert] Google Chat 관리자 알림 전송 실패:', error)
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
