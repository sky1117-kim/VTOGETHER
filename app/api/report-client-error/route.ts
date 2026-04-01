import { getErrorMessage, sendGoogleChatAlert } from '@/lib/google-chat-alert'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface ClientErrorBody {
  message?: string
  stack?: string
  path?: string
}

// 클라이언트에서 올라온 에러를 서버에서 받아 구글 챗으로 전달합니다.
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const body = (await request.json()) as ClientErrorBody
    const message = body.message ?? '클라이언트 에러 메시지 없음'
    const stack = body.stack ? `\n\nstack:\n${body.stack}` : ''

    await sendGoogleChatAlert({
      source: 'client',
      title: '브라우저 에러 발생',
      message: `${message}${stack}`,
      path: body.path,
      userAgent: request.headers.get('user-agent') ?? undefined,
      userId: user?.id ?? undefined,
      userEmail: user?.email ?? undefined,
      userName:
        (typeof user?.user_metadata?.full_name === 'string' && user.user_metadata.full_name) ||
        (typeof user?.user_metadata?.name === 'string' && user.user_metadata.name) ||
        undefined,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error) },
      { status: 400 }
    )
  }
}
