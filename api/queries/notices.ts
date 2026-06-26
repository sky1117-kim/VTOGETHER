import { createClient } from '@/lib/supabase/server'

export type NoticeRow = {
  id: string
  title: string
  body: string | null
  image_url: string | null
  is_published: boolean
  show_as_popup: boolean
  popup_start_at: string | null
  popup_end_at: string | null
  created_at: string
  like_count: number
  comment_count: number
  user_liked: boolean
}

export type NoticeComment = {
  id: string
  notice_id: string
  user_id: string
  body: string
  created_at: string
  user_name: string | null
  user_email: string
}

export async function getNotices(userId?: string | null): Promise<NoticeRow[]> {
  const supabase = await createClient()

  const { data: notices, error } = await supabase
    .from('notices')
    .select('id, title, body, image_url, is_published, show_as_popup, popup_start_at, popup_end_at, created_at')
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  if (error || !notices) return []

  const ids = notices.map((n) => n.id)
  if (ids.length === 0) return []

  const [likesRes, commentsRes, userLikesRes] = await Promise.all([
    supabase.from('notice_likes').select('notice_id').in('notice_id', ids),
    supabase.from('notice_comments').select('notice_id').in('notice_id', ids).is('deleted_at', null),
    userId
      ? supabase.from('notice_likes').select('notice_id').in('notice_id', ids).eq('user_id', userId)
      : Promise.resolve({ data: [] }),
  ])

  const likeCountMap: Record<string, number> = {}
  const commentCountMap: Record<string, number> = {}
  const userLikedSet = new Set<string>()

  for (const row of likesRes.data ?? []) likeCountMap[row.notice_id] = (likeCountMap[row.notice_id] ?? 0) + 1
  for (const row of commentsRes.data ?? []) commentCountMap[row.notice_id] = (commentCountMap[row.notice_id] ?? 0) + 1
  for (const row of (userLikesRes as { data: { notice_id: string }[] | null }).data ?? []) userLikedSet.add(row.notice_id)

  return notices.map((n) => ({
    ...n,
    popup_start_at: n.popup_start_at ?? null,
    popup_end_at: n.popup_end_at ?? null,
    like_count: likeCountMap[n.id] ?? 0,
    comment_count: commentCountMap[n.id] ?? 0,
    user_liked: userLikedSet.has(n.id),
  }))
}

export async function getPopupNotices(userId?: string | null): Promise<NoticeRow[]> {
  const supabase = await createClient()

  const now = new Date().toISOString()
  const { data: notices, error } = await supabase
    .from('notices')
    .select('id, title, body, image_url, is_published, show_as_popup, popup_start_at, popup_end_at, created_at')
    .eq('is_published', true)
    .eq('show_as_popup', true)
    .or(`popup_start_at.is.null,popup_start_at.lte.${now}`)
    .or(`popup_end_at.is.null,popup_end_at.gte.${now}`)
    .order('created_at', { ascending: false })

  if (error || !notices || notices.length === 0) return []

  const ids = notices.map((n) => n.id)
  const [likesRes, userLikesRes] = await Promise.all([
    supabase.from('notice_likes').select('notice_id').in('notice_id', ids),
    userId
      ? supabase.from('notice_likes').select('notice_id').in('notice_id', ids).eq('user_id', userId)
      : Promise.resolve({ data: [] }),
  ])

  const likeCountMap: Record<string, number> = {}
  const userLikedSet = new Set<string>()
  for (const row of likesRes.data ?? []) likeCountMap[row.notice_id] = (likeCountMap[row.notice_id] ?? 0) + 1
  for (const row of (userLikesRes as { data: { notice_id: string }[] | null }).data ?? []) userLikedSet.add(row.notice_id)

  return notices.map((n) => ({
    ...n,
    popup_start_at: n.popup_start_at ?? null,
    popup_end_at: n.popup_end_at ?? null,
    like_count: likeCountMap[n.id] ?? 0,
    comment_count: 0,
    user_liked: userLikedSet.has(n.id),
  }))
}

export async function getNoticeComments(noticeId: string): Promise<NoticeComment[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('notice_comments')
    .select('id, notice_id, user_id, body, created_at, users(name, email)')
    .eq('notice_id', noticeId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (error || !data) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((row) => ({
    id: row.id,
    notice_id: row.notice_id,
    user_id: row.user_id,
    body: row.body,
    created_at: row.created_at,
    user_name: row.users?.name ?? null,
    user_email: row.users?.email ?? '',
  }))
}
