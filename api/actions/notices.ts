'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

// ── 사용자 액션 ──────────────────────────────────────────────────────────────

export async function toggleNoticeLike(
  noticeId: string
): Promise<{ liked: boolean; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { liked: false, error: '로그인이 필요합니다.' }

  const { data: existing } = await supabase
    .from('notice_likes')
    .select('notice_id')
    .eq('notice_id', noticeId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    await supabase.from('notice_likes').delete().eq('notice_id', noticeId).eq('user_id', user.id)
    revalidatePath('/notices')
    return { liked: false, error: null }
  } else {
    await supabase.from('notice_likes').insert({ notice_id: noticeId, user_id: user.id })
    revalidatePath('/notices')
    return { liked: true, error: null }
  }
}

export async function addNoticeComment(
  noticeId: string,
  body: string
): Promise<{ error: string | null }> {
  const trimmed = body.trim()
  if (!trimmed) return { error: '댓글 내용을 입력하세요.' }
  if (trimmed.length > 500) return { error: '댓글은 500자 이내로 입력하세요.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const { error } = await supabase.from('notice_comments').insert({
    notice_id: noticeId,
    user_id: user.id,
    body: trimmed,
  })

  if (error) return { error: error.message }
  revalidatePath('/notices')
  return { error: null }
}

export async function deleteNoticeComment(
  commentId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const { error } = await supabase
    .from('notice_comments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', commentId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/notices')
  return { error: null }
}

// ── 관리자 액션 ──────────────────────────────────────────────────────────────

export async function toggleNoticePopup(
  id: string,
  show: boolean
): Promise<{ error: string | null }> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('notices')
    .update({ show_as_popup: show, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/notices')
  revalidatePath('/')
  return { error: null }
}

export async function createNotice(params: {
  title: string
  body: string
  image_url: string
  is_published: boolean
  show_as_popup: boolean
  popup_start_at?: string | null
  popup_end_at?: string | null
}): Promise<{ id: string | null; error: string | null }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('notices')
    .insert({ ...params, updated_at: new Date().toISOString() })
    .select('id')
    .single()
  if (error) return { id: null, error: error.message }
  revalidatePath('/notices')
  return { id: data.id, error: null }
}

export async function updateNotice(
  id: string,
  params: { title: string; body: string; image_url: string; is_published: boolean; show_as_popup?: boolean; popup_start_at?: string | null; popup_end_at?: string | null }
): Promise<{ error: string | null }> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('notices')
    .update({ ...params, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/notices')
  return { error: null }
}

export async function fetchNoticeComments(noticeId: string) {
  const { getNoticeComments } = await import('@/api/queries/notices')
  return getNoticeComments(noticeId)
}

export async function deleteNotice(id: string): Promise<{ error: string | null }> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('notices').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/notices')
  return { error: null }
}

export async function fetchMentionableUsers(query: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('users')
    .select('user_id, name, dept_name')
    .is('deleted_at', null)
    .ilike('name', `%${query}%`)
    .limit(8)
  return (data ?? []) as { user_id: string; name: string; dept_name: string | null }[]
}

export async function getNoticesForAdmin() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('notices')
    .select('id, title, body, image_url, is_published, show_as_popup, popup_start_at, popup_end_at, created_at')
    .order('created_at', { ascending: false })
  if (error) return []
  return data ?? []
}
