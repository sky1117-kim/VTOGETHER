'use client'

import { useState, useMemo, useTransition, useEffect } from 'react'
import { Heart, MessageCircle, Search, X, Send, Trash2, Megaphone } from 'lucide-react'
import { toggleNoticeLike, addNoticeComment, deleteNoticeComment, fetchNoticeComments } from '@/api/actions/notices'
import type { NoticeRow, NoticeComment } from '@/api/queries/notices'
import { ImageLightbox } from './ImageLightbox'
import { MentionInput, renderWithMentions } from './MentionInput'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '방금 전'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}일 전`
  return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}

function tagStyle(notice: NoticeRow) {
  return notice.show_as_popup
    ? { label: '팝업', cls: 'bg-purple-100 text-purple-700 border border-purple-200' }
    : { label: '소식', cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200' }
}

function displayLikeCount(notice: NoticeRow, liked: boolean) {
  const base = notice.like_count ?? 0
  if (liked && !notice.user_liked) return base + 1
  if (!liked && notice.user_liked) return Math.max(0, base - 1)
  return base
}

/* ── 카드 ───────────────────────────────────────────────── */
function NoticeCard({ notice, liked, onOpen, onLike }: {
  notice: NoticeRow
  liked: boolean
  onOpen: () => void
  onLike: (e: React.MouseEvent) => void
}) {
  const tag = tagStyle(notice)
  const likeCount = displayLikeCount(notice, liked)

  return (
    <article
      onClick={onOpen}
      className="group cursor-pointer overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl flex flex-col"
    >
      {/* 이미지 */}
      <div className="relative h-64 overflow-hidden bg-slate-100 shrink-0">
        {notice.image_url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={notice.image_url} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover scale-110 blur-2xl brightness-75 saturate-150" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={notice.image_url} alt={notice.title} className="absolute inset-0 h-full w-full object-contain" style={{ zIndex: 10 }} />
          </>
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-emerald-400 via-green-500 to-teal-600">
            <Megaphone className="size-12 text-white/60" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" style={{ zIndex: 15 }} />
      </div>

      {/* 바디 */}
      <div className="flex flex-1 flex-col justify-between p-5">
        <div>
          <div className="mb-2.5 flex items-center gap-2.5 text-xs">
            <span className={`rounded-full px-2.5 py-1 font-bold ${tag.cls}`}>
              📍 {tag.label}
            </span>
            <span className="text-slate-400">{timeAgo(notice.created_at)}</span>
          </div>
          <h3 className="line-clamp-1 text-base font-bold text-slate-800 transition-colors group-hover:text-emerald-600">
            {notice.title}
          </h3>
          {notice.body && (
            <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-slate-500">
              {notice.body}
            </p>
          )}
        </div>

        {/* 액션 바 */}
        <div className="mt-4 border-t border-slate-100 pt-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-slate-400">
              <button
                onClick={onLike}
                className={`flex items-center gap-1.5 text-sm font-semibold transition-colors ${liked ? 'text-rose-500' : 'hover:text-rose-400'}`}
              >
                <Heart className={`size-4 ${liked ? 'fill-rose-500' : ''}`} />
                <span className="tabular-nums">{likeCount}</span>
              </button>
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                <MessageCircle className="size-4" />
                <span className="tabular-nums">{notice.comment_count ?? 0}</span>
              </div>
            </div>
            {/* 좋아요한 사람 아바타 */}
            {notice.liked_users.length > 0 && (
              <div className="flex items-center">
                <div className="flex -space-x-1.5">
                  {notice.liked_users.slice(0, 5).map((u) => (
                    <div
                      key={u.user_id}
                      title={u.name}
                      className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-rose-400 to-pink-500 text-[9px] font-bold text-white shadow-sm"
                    >
                      {u.name[0]}
                    </div>
                  ))}
                </div>
                {notice.liked_users.length > 5 && (
                  <span className="ml-1.5 text-[10px] text-slate-400">+{notice.liked_users.length - 5}</span>
                )}
              </div>
            )}
          </div>
          {notice.liked_users.length > 0 && (
            <p className="mt-1.5 text-[11px] text-slate-400">
              {notice.liked_users.slice(0, 3).map((u) => u.name).join(', ')}
              {notice.liked_users.length > 3 ? ` 외 ${notice.liked_users.length - 3}명` : ''}이 좋아합니다
            </p>
          )}
        </div>
      </div>
    </article>
  )
}

/* ── 상세 모달 ──────────────────────────────────────────── */
function NoticeDetailModal({ notice, currentUserId, liked, likeCount, onClose, onLike }: {
  notice: NoticeRow
  currentUserId: string | null
  liked: boolean
  likeCount: number
  onClose: () => void
  onLike: () => void
}) {
  const [comments, setComments] = useState<NoticeComment[]>([])
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [commentCount, setCommentCount] = useState(notice.comment_count ?? 0)
  const [lightbox, setLightbox] = useState(false)

  useEffect(() => {
    fetchNoticeComments(notice.id).then(setComments)
  }, [notice.id])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentText.trim() || submitting) return
    setSubmitting(true)
    const result = await addNoticeComment(notice.id, commentText)
    setSubmitting(false)
    if (!result.error) {
      setCommentText('')
      const data = await fetchNoticeComments(notice.id)
      setComments(data)
      setCommentCount((c) => c + 1)
    }
  }

  async function handleDeleteComment(id: string) {
    await deleteNoticeComment(id)
    setComments((prev) => prev.filter((c) => c.id !== id))
    setCommentCount((c) => Math.max(0, c - 1))
  }

  const tag = tagStyle(notice)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-[85vh] w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl flex-col md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 좌: 이미지 + 정보 */}
        <div className="flex w-full flex-col border-b border-slate-100 md:w-3/5 md:border-b-0 md:border-r h-1/2 md:h-full">
          {/* 이미지 */}
          <div
            className="relative flex-1 cursor-zoom-in overflow-hidden bg-slate-200"
            onClick={() => notice.image_url && setLightbox(true)}
          >
            {notice.image_url ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={notice.image_url} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover scale-110 blur-2xl brightness-75 saturate-150" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={notice.image_url} alt={notice.title} className="absolute inset-0 h-full w-full object-contain" style={{ zIndex: 10 }} />
              </>
            ) : (
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-emerald-400 to-teal-600">
                <Megaphone className="size-16 text-white/50" />
              </div>
            )}
            {/* 태그 */}
            <div className="absolute left-4 top-4 z-20">
              <span className={`rounded-full px-3 py-1 text-xs font-bold shadow-md ${tag.cls}`}>
                📍 {tag.label}
              </span>
            </div>
          </div>

          {/* 제목 + 본문 */}
          <div className="overflow-y-auto bg-white p-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">{timeAgo(notice.created_at)}</span>
              <button
                onClick={onLike}
                disabled={!currentUserId}
                className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-semibold transition ${
                  liked ? 'border-rose-100 bg-rose-50 text-rose-500' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-rose-100 hover:bg-rose-50 hover:text-rose-400'
                } disabled:opacity-40`}
              >
                <Heart className={`size-4 ${liked ? 'fill-rose-500' : ''}`} />
                <span className="tabular-nums">{likeCount}</span>
              </button>
            </div>
            <h2 className="text-xl font-bold leading-snug text-slate-900">{notice.title}</h2>
            {notice.body && (
              <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-slate-600">{notice.body}</p>
            )}
          </div>
        </div>

        {/* 우: 댓글 */}
        <div className="relative flex w-full flex-col bg-white md:w-2/5 h-1/2 md:h-full">
          {/* 헤더 */}
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800">댓글</span>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-600">{commentCount}</span>
            </div>
            <button onClick={onClose} className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
              <X className="size-5" />
            </button>
          </div>

          {/* 댓글 목록 */}
          <div className="flex-1 overflow-y-auto space-y-3 p-5 pb-24">
            {comments.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center py-12 text-center">
                <MessageCircle className="mb-2 size-10 text-slate-200" />
                <p className="text-sm font-semibold text-slate-500">아직 댓글이 없습니다.</p>
                <p className="mt-0.5 text-xs text-slate-400">첫 댓글을 남겨보세요!</p>
              </div>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="group/c flex items-start gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-xs font-bold text-white shadow-sm">
                    {(c.user_name || c.user_email)?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="relative flex-1 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <div className="mb-1 flex items-baseline gap-2">
                      <span className="text-xs font-bold text-slate-800">{c.user_name || c.user_email}</span>
                      <span className="text-[10px] text-slate-400">{timeAgo(c.created_at)}</span>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-600">{renderWithMentions(c.body)}</p>
                    {currentUserId === c.user_id && (
                      <button
                        onClick={() => handleDeleteComment(c.id)}
                        className="absolute right-2.5 top-2.5 opacity-0 transition group-hover/c:opacity-100 text-slate-300 hover:text-rose-400"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 댓글 입력 — 하단 고정 */}
          {currentUserId ? (
            <div className="absolute bottom-0 left-0 right-0 border-t border-slate-100 bg-white p-4">
              <MentionInput
                value={commentText}
                onChange={setCommentText}
                onSubmit={handleAddComment}
                placeholder="댓글을 입력하세요... (@이름으로 태그)"
                disabled={submitting}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-4 pr-12 text-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              >
                <button
                  type="submit"
                  disabled={!commentText.trim() || submitting}
                  className="absolute right-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white transition hover:bg-emerald-600 disabled:opacity-40"
                >
                  <Send className="size-3.5" />
                </button>
              </MentionInput>
            </div>
          ) : (
            <div className="absolute bottom-0 left-0 right-0 border-t border-slate-100 bg-white p-4 text-center text-xs text-slate-400">
              댓글을 달려면 로그인이 필요합니다.
            </div>
          )}
        </div>
      </div>

      {lightbox && notice.image_url && (
        <ImageLightbox src={notice.image_url} alt={notice.title} onClose={() => setLightbox(false)} />
      )}
    </div>
  )
}

/* ── 메인 export ─────────────────────────────────────────── */
export function NoticeList({ notices, currentUserId }: { notices: NoticeRow[]; currentUserId: string | null }) {
  const [search, setSearch] = useState('')
  const [selectedNotice, setSelectedNotice] = useState<NoticeRow | null>(null)
  const [likedSet, setLikedSet] = useState<Set<string>>(() => new Set(notices.filter((n) => n.user_liked).map((n) => n.id)))
  const [, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return notices.filter((n) => !q || n.title.toLowerCase().includes(q) || (n.body ?? '').toLowerCase().includes(q))
  }, [notices, search])

  function handleLike(noticeId: string, e?: React.MouseEvent) {
    e?.stopPropagation()
    if (!currentUserId) return
    setLikedSet((prev) => {
      const next = new Set(prev)
      prev.has(noticeId) ? next.delete(noticeId) : next.add(noticeId)
      return next
    })
    startTransition(() => { toggleNoticeLike(noticeId) })
  }

  const selectedLiked = selectedNotice ? likedSet.has(selectedNotice.id) : false
  const selectedLikeCount = selectedNotice ? displayLikeCount(selectedNotice, selectedLiked) : 0

  return (
    <>
      {/* 검색 바 */}
      <div className="mb-6 relative w-full sm:w-72">
        <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="소식 제목, 내용 검색..."
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-sm shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/10"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* 그리드 */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white py-20 text-center shadow-sm">
          <span className="mb-3 text-5xl">📭</span>
          <p className="text-sm font-semibold text-slate-600">조건에 맞는 소식이 없습니다.</p>
          <p className="mt-0.5 text-xs text-slate-400">다른 검색어나 필터를 시도해보세요.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((notice) => (
            <NoticeCard
              key={notice.id}
              notice={notice}
              liked={likedSet.has(notice.id)}
              onOpen={() => setSelectedNotice(notice)}
              onLike={(e) => handleLike(notice.id, e)}
            />
          ))}
        </div>
      )}

      {/* 상세 모달 */}
      {selectedNotice && (
        <NoticeDetailModal
          notice={selectedNotice}
          currentUserId={currentUserId}
          liked={selectedLiked}
          likeCount={selectedLikeCount}
          onClose={() => setSelectedNotice(null)}
          onLike={() => handleLike(selectedNotice.id)}
        />
      )}
    </>
  )
}
