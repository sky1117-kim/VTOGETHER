import { redirect } from 'next/navigation'

/** 예전 경로 호환: 인증 심사로 통합됨 */
export default function AdminHealthChallengeLogsRedirectPage() {
  redirect('/admin/verifications')
}
