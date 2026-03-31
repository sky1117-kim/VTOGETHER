import { syncSeahOrgsyncSnapshot } from '@/api/actions/admin/seah-orgsync'
import { NextResponse } from 'next/server'

/**
 * 세아웍스 인사 배치 동기화 (하루 1회 호출 권장)
 * - 보호: Authorization: Bearer ${SEAH_ORGSYNC_CRON_SECRET}
 */
export async function GET(request: Request) {
  const secret = process.env.SEAH_ORGSYNC_CRON_SECRET?.trim()
  if (!secret) {
    return NextResponse.json(
      { success: false, error: 'SEAH_ORGSYNC_CRON_SECRET 미설정' },
      { status: 500 }
    )
  }

  const auth = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  if (auth !== expected) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const result = await syncSeahOrgsyncSnapshot()
  return NextResponse.json(result, { status: result.success ? 200 : 500 })
}

