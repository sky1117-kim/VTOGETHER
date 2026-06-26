'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X, Heart, MessageCircle, ChevronLeft, ChevronRight, ArrowLeft, Send, Trash2 } from 'lucide-react'
import confetti from 'canvas-confetti'
import { toggleNoticeLike, addNoticeComment, fetchNoticeComments, deleteNoticeComment } from '@/api/actions/notices'
import type { NoticeRow, NoticeComment } from '@/api/queries/notices'
import { MentionInput, renderWithMentions } from '@/components/notices/MentionInput'

interface PopupNoticeProps {
  notices: NoticeRow[]
  userId: string | null
}

const STORAGE_KEY = 'popup_dismissed_v2'

function fireConfetti() {
  const rand = (min: number, max: number) => Math.random() * (max - min) + min
  const cfg = { startVelocity: 32, spread: 360, ticks: 90, zIndex: 200 }
  confetti({ ...cfg, particleCount: 65, origin: { x: rand(0.05, 0.3), y: -0.05 }, colors: ['#22c55e', '#fbbf24', '#f97316'] })
  confetti({ ...cfg, particleCount: 65, origin: { x: rand(0.7, 0.95), y: -0.05 }, colors: ['#ec4899', '#6366f1', '#14b8a6'] })
  setTimeout(() => {
    confetti({ ...cfg, particleCount: 50, origin: { x: rand(0.3, 0.7), y: -0.05 }, colors: ['#a78bfa', '#34d399', '#fb923c'] })
  }, 300)
}

export function PopupNotice({ notices, userId }: PopupNoticeProps) {
  const [visible, setVisible] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [idx, setIdx] = useState(0)
  const [dontShow, setDontShow] = useState(false)
  const [likedSet, setLikedSet] = useState<Set<string>>(() => new Set(notices.filter((n) => n.user_liked).map((n) => n.id)))
  const [likePending, setLikePending] = useState(false)

  // 댓글 패널
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<NoticeComment[]>([])
  const [commentsLoaded, setCommentsLoaded] = useState<Record<string, boolean>>({})
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [commentCountMap, setCommentCountMap] = useState<Record<string, number>>({})
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null)

  const notice = notices[idx]
  const total = notices.length

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const dismissed: Record<string, string> = raw ? JSON.parse(raw) : {}
      const today = new Date().toISOString().slice(0, 10)
      const hasNew = notices.some((n) => dismissed[n.id] !== today)
      if (hasNew) {
        setTimeout(() => { setVisible(true); setAnimating(true); fireConfetti() }, 350)
      }
    } catch {
      setVisible(true); setAnimating(true)
    }
  }, [notices])

  // 팝업 이동 시 댓글 패널 닫기
  useEffect(() => { setShowComments(false); setCommentText('') }, [idx])

  function dismiss() {
    setAnimating(false)
    setTimeout(() => {
      if (dontShow) {
        try {
          const raw = localStorage.getItem(STORAGE_KEY)
          const dismissed: Record<string, string> = raw ? JSON.parse(raw) : {}
          const today = new Date().toISOString().slice(0, 10)
          for (const n of notices) dismissed[n.id] = today
          localStorage.setItem(STORAGE_KEY, JSON.stringify(dismissed))
        } catch {}
      }
      setVisible(false)
    }, 260)
  }

  async function handleLike() {
    if (!userId || likePending || !notice) return
    setLikePending(true)
    setLikedSet((prev) => {
      const next = new Set(prev)
      prev.has(notice.id) ? next.delete(notice.id) : next.add(notice.id)
      return next
    })
    await toggleNoticeLike(notice.id)
    setLikePending(false)
  }

  async function openCommentPanel() {
    setShowComments(true)
    if (notice && !commentsLoaded[notice.id]) {
      const data = await fetchNoticeComments(notice.id)
      setComments(data)
      setCommentsLoaded((prev) => ({ ...prev, [notice.id]: true }))
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentText.trim() || submitting || !notice) return
    setSubmitting(true)
    const result = await addNoticeComment(notice.id, commentText, replyTo?.id ?? null)
    setSubmitting(false)
    if (!result.error) {
      setCommentText('')
      setReplyTo(null)
      const data = await fetchNoticeComments(notice.id)
      setComments(data)
      setCommentCountMap((prev) => ({ ...prev, [notice.id]: (prev[notice.id] ?? notice.comment_count ?? 0) + 1 }))
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!notice) return
    setComments((prev) => prev.filter((c) => c.id !== commentId))
    setCommentCountMap((prev) => ({ ...prev, [notice.id]: Math.max(0, (prev[notice.id] ?? notice.comment_count ?? 0) - 1) }))
    await deleteNoticeComment(commentId)
  }

  if (!visible || !notice) return null

  const liked = likedSet.has(notice.id)
  const likeCount = (notice.like_count ?? 0) + (liked && !notice.user_liked ? 1 : !liked && notice.user_liked ? -1 : 0)
  const commentCount = commentCountMap[notice.id] ?? notice.comment_count ?? 0

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${animating ? 'opacity-100' : 'opacity-0'}`}>
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={dismiss} />

      <div
        className={`relative flex w-full flex-col overflow-hidden rounded-2xl bg-white shadow-[0_25px_60px_-15px_rgba(0,0,0,0.4)] transition-all duration-300 sm:flex-row sm:rounded-[1.75rem] ${
          animating ? 'scale-100 translate-y-0' : 'scale-95 translate-y-6'
        }`}
        style={{ maxWidth: '1000px', height: '90vh', maxHeight: '900px' }}
      >
        {/* ── 좌: 이미지 ── */}
        <div className="relative h-44 w-full shrink-0 overflow-hidden sm:h-auto sm:w-[62%]">
          {notice.image_url ? (
            <div className="absolute inset-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={notice.image_url} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover scale-110 blur-2xl brightness-75 saturate-150" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={notice.image_url} alt={notice.title} className="absolute inset-0 h-full w-full object-contain" style={{ zIndex: 10 }} />
            </div>
          ) : (
            <div className="flex h-full min-h-[176px] w-full items-center justify-center bg-gradient-to-br from-green-400 via-emerald-500 to-teal-600 sm:min-h-[600px]">
              <span className="text-7xl drop-shadow-xl sm:text-9xl">🎉</span>
            </div>
          )}

          {/* 다중 팝업 네비게이션 */}
          {total > 1 && (
            <>
              <button onClick={() => setIdx((i) => (i - 1 + total) % total)} className="absolute left-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition hover:bg-black/50">
                <ChevronLeft className="size-5" />
              </button>
              <button onClick={() => setIdx((i) => (i + 1) % total)} className="absolute right-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition hover:bg-black/50">
                <ChevronRight className="size-5" />
              </button>
              <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
                {notices.map((_, i) => (
                  <button key={i} onClick={() => setIdx(i)} className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-6 bg-white' : 'w-1.5 bg-white/50'}`} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── 우: 사이드 패널 ── */}
        <div className="relative flex flex-1 flex-col overflow-hidden bg-[#fafafa]">
          <div className="h-1 w-full shrink-0 bg-gradient-to-r from-amber-400 via-orange-400 to-pink-500" />

          {/* ── 메인 패널 ── */}
          <div className={`absolute inset-0 flex flex-col justify-between overflow-y-auto px-4 pb-5 pt-6 transition-all duration-300 sm:px-7 sm:pb-8 sm:pt-10 ${showComments ? '-translate-x-full opacity-0' : 'translate-x-0 opacity-100'}`}>

            {/* 상단: X */}
            <div>
              <div className="flex items-center justify-end">
                <button onClick={dismiss} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-600">
                  <X className="size-5" />
                </button>
              </div>

              {/* 제목 */}
              <div className="mb-3 mt-3 sm:mb-6 sm:mt-14">
                <h3 className="line-clamp-3 text-xl font-black leading-tight tracking-tight text-slate-900 sm:text-[1.55rem]">
                  {notice.title}
                </h3>
                {notice.body && (
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-400 font-normal sm:mt-2.5 sm:line-clamp-3">{notice.body}</p>
                )}
              </div>

              {/* 카드 스택 */}
              <div className="space-y-2.5 pt-3 sm:space-y-3 sm:pt-6">
                {/* 좋아요 카드 */}
                <div className="relative">
                  {!liked && (
                    <div className="absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#ff3366] px-3.5 py-1 text-[10px] font-bold text-white shadow-md animate-bounce">
                      공감 꾹! 1초 응원하기
                      <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-[#ff3366]" />
                    </div>
                  )}
                  <button
                    onClick={handleLike}
                    disabled={!userId || likePending}
                    className={`w-full flex flex-col items-center justify-center gap-1.5 rounded-xl border py-2.5 transition-all active:scale-[0.99] disabled:opacity-40 sm:py-3.5 ${
                      liked
                        ? 'border-rose-400 bg-rose-500 text-white shadow-md'
                        : 'animate-heartbeat border-rose-100 bg-white hover:bg-rose-50/30'
                    }`}
                  >
                    <Heart className={`size-6 transition-transform group-hover:scale-125 ${liked ? 'fill-white text-white' : 'text-rose-400'}`} />
                    <span className={`text-[11px] font-bold tracking-tight ${liked ? 'text-white' : 'text-rose-500'}`}>
                      {liked ? '좋아요 완료! ✨' : '좋아요'}
                    </span>
                    <span className={`text-base font-black tabular-nums ${liked ? 'text-white' : 'text-rose-600'}`}>{likeCount}</span>
                  </button>
                </div>

                {/* 좋아요한 사람 미리보기 */}
                {/* 댓글 카드 */}
                <button
                  onClick={openCommentPanel}
                  className="w-full flex flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-100 bg-white py-2.5 transition hover:bg-slate-50 active:scale-[0.99] sm:py-3.5"
                >
                  <MessageCircle className="size-6 text-slate-400 transition-transform hover:scale-110" />
                  <span className="text-[11px] font-bold tracking-tight text-slate-500">댓글 확인하기</span>
                  <span className="text-base font-black tabular-nums text-slate-700">{commentCount}</span>
                </button>
              </div>

              {/* 소식 바로가기 */}
              <div className="mt-2 text-center sm:mt-4">
                <Link href="/notices" onClick={dismiss} className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 transition hover:text-slate-600">
                  소식에서 자세히 보기
                  <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                </Link>
              </div>
            </div>

            {/* 하단: 체크 + 확인 */}
            <div className="space-y-3 border-t border-slate-200/50 pt-4 sm:space-y-4 sm:pt-6">
              <label className="flex cursor-pointer select-none items-center gap-2" onClick={() => setDontShow((v) => !v)}>
                <input type="checkbox" readOnly checked={dontShow} className="h-4 w-4 rounded border-slate-300 accent-emerald-500" />
                <span className="text-xs font-medium text-slate-400 transition group-hover:text-slate-600">오늘 하루 다시 보지 않기</span>
              </label>
              <button
                onClick={dismiss}
                className="relative w-full overflow-hidden rounded-xl bg-[#03c75a] py-4 text-sm font-extrabold text-white shadow-lg shadow-emerald-500/10 transition hover:bg-[#02b34f] active:bg-[#029e46]"
              >
                확인
                <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent [animation:shimmer_2s_infinite]" />
              </button>
            </div>
          </div>

          {/* ── 댓글 패널 ── */}
          <div className={`absolute inset-0 flex flex-col bg-slate-50/50 transition-all duration-300 ${showComments ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}>
            {/* 헤더 */}
            <div className="flex shrink-0 items-center justify-between px-4 py-3 sm:px-5 sm:py-4">
              <button onClick={() => setShowComments(false)} className="flex items-center gap-1 text-xs font-bold text-slate-500 transition hover:text-slate-800">
                <ArrowLeft className="size-4" />
                소식 요약으로
              </button>
              <button onClick={dismiss} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200/60 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600">
                <X className="size-4" />
              </button>
            </div>

            {/* 댓글 목록 */}
            <div className="flex shrink-0 items-center gap-2 px-4 pb-2 sm:px-5">
              <span className="text-sm font-extrabold text-slate-800">댓글</span>
              <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-bold text-sky-500">{commentCount}</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 px-3 pb-4 sm:px-4" style={{ scrollbarWidth: 'thin' }}>
              {comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <span className="text-3xl">💬</span>
                  <p className="mt-2 text-xs font-semibold text-slate-500">첫 댓글을 남겨보세요!</p>
                </div>
              ) : (
                comments.filter((c) => !c.parent_id).map((c) => {
                  const replies = comments.filter((r) => r.parent_id === c.id)
                  const timeAgo = (iso: string) => {
                    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
                    return m < 60 ? `${m}분 전` : '방금 전'
                  }
                  return (
                    <div key={c.id}>
                      <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                        <p className="text-xs font-medium leading-relaxed text-slate-600">{renderWithMentions(c.body)}</p>
                        <div className="mt-1.5 flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-slate-400">{c.user_name || c.user_email}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400">{timeAgo(c.created_at)}</span>
                            {userId && (
                              <button
                                onClick={() => {
                                  setReplyTo({ id: c.id, name: c.user_name || c.user_email })
                                  setCommentText(`@${c.user_name || c.user_email} `)
                                }}
                                className="text-[10px] font-semibold text-sky-400 transition hover:text-sky-600"
                              >
                                답글
                              </button>
                            )}
                            {userId === c.user_id && (
                              <button onClick={() => handleDeleteComment(c.id)} className="rounded p-0.5 text-slate-300 transition hover:text-rose-400">
                                <Trash2 className="size-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* 답글 목록 */}
                      {replies.map((r) => (
                        <div key={r.id} className="ml-4 mt-1.5 rounded-xl border border-sky-50 bg-sky-50/50 p-3">
                          <p className="text-xs font-medium leading-relaxed text-slate-600">{renderWithMentions(r.body)}</p>
                          <div className="mt-1.5 flex items-center justify-between">
                            <span className="text-[10px] font-semibold text-slate-400">{r.user_name || r.user_email}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-400">{timeAgo(r.created_at)}</span>
                              {userId === r.user_id && (
                                <button onClick={() => handleDeleteComment(r.id)} className="rounded p-0.5 text-slate-300 transition hover:text-rose-400">
                                  <Trash2 className="size-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })
              )}
            </div>

            {/* 댓글 입력 */}
            {userId ? (
              <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3">
                {replyTo && (
                  <div className="mb-1.5 flex items-center justify-between rounded-lg bg-sky-50 px-2.5 py-1.5">
                    <span className="text-[10px] font-semibold text-sky-600">↩ {replyTo.name}에게 답글</span>
                    <button onClick={() => { setReplyTo(null); setCommentText('') }} className="text-[10px] text-slate-400 hover:text-slate-600">취소</button>
                  </div>
                )}
                <MentionInput
                  value={commentText}
                  onChange={setCommentText}
                  onSubmit={handleAddComment}
                  placeholder={replyTo ? `@${replyTo.name}에게 답글...` : '축하와 응원의 한마디를 남겨보세요!'}
                  disabled={submitting}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-3.5 pr-10 text-xs focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-200"
                >
                  <button
                    type="submit"
                    disabled={!commentText.trim() || submitting}
                    className={`absolute right-1.5 flex h-7 w-7 items-center justify-center rounded-lg transition ${
                      commentText.trim() ? 'bg-sky-500 text-white hover:bg-sky-600' : 'bg-slate-100 text-slate-300'
                    }`}
                  >
                    <Send className="size-3.5" />
                  </button>
                </MentionInput>
              </div>
            ) : null}

            <button
              onClick={() => setShowComments(false)}
              className="mx-4 mb-4 mt-2 shrink-0 rounded-xl border border-slate-200 py-3 text-xs font-bold text-slate-600 transition hover:bg-slate-100"
            >
              확인 후 메인으로 돌아가기
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
