'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useState } from 'react'

function formatLoginError(raw: string, fromUrl: boolean) {
  if (raw === 'invalid_domain') {
    return 'VNTG 직원 전용입니다. vntgcorp.com 메일 계정으로 로그인해주세요.'
  }
  if (raw === 'pkce_verifier_missing') {
    return '로그인 과정이 만료되었거나 중복 요청이 발생했습니다. 다시 로그인해 주세요.'
  }
  if (fromUrl) {
    try {
      return decodeURIComponent(raw)
    } catch {
      return raw
    }
  }
  return raw
}

export default function LoginForm({
  error,
  next,
  supabaseUrl,
  supabaseAnonKey,
}: {
  error?: string
  next?: string
  /** 서버에서 런타임 env로 넘김 (클라이언트 번들의 NEXT_PUBLIC 빈 값 회피) */
  supabaseUrl: string
  supabaseAnonKey: string
}) {
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const displayError = error
    ? formatLoginError(error, true)
    : localError
    ? formatLoginError(localError, false)
    : null

  async function handleGoogleLogin() {
    setLocalError(null)
    setLoading(true)
    try {
      if (!supabaseUrl?.trim() || !supabaseAnonKey?.trim()) {
        setLocalError(
          'Supabase 연결 정보가 없습니다. 운영 환경에 SERVER_SUPABASE_PUBLIC_* 또는 NEXT_PUBLIC_SUPABASE_* 를 설정해주세요.'
        )
        return
      }
      const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
      // redirectTo는 반드시 "지금 주소창의 origin"과 같아야 합니다. NEXT_PUBLIC_APP_URL만 쓰면
      // Cloud Run 기본 URL로 들어왔는데 env는 커스텀 도메인인 경우 등 PKCE 쿠키가 콜백까지 안 맞아
      // "code challenge does not match ... code verifier" 가 납니다.
      const appOrigin = window.location.origin
      const callbackUrl =
        next && next.startsWith('/')
          ? `${appOrigin}/auth/callback?next=${encodeURIComponent(next)}`
          : `${appOrigin}/auth/callback`

      // PKCE code verifier는 브라우저(document.cookie)에 저장되어야 콜백에서 세션 교환이 됩니다.
      // Server Action + redirect()로 시작하면 Set-Cookie가 누락되는 경우가 있어 클라이언트에서 시작합니다.
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl,
          queryParams: {
            hd: 'vntgcorp.com',
            prompt: 'select_account',
          },
        },
      })

      if (oauthError) {
        setLocalError(oauthError.message)
        return
      }
      if (data.url) {
        window.location.assign(data.url)
        return
      }
      setLocalError('로그인 URL을 생성할 수 없습니다.')
    } catch (e) {
      setLocalError(
        e instanceof Error ? e.message : '로그인 시작에 실패했습니다.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 selection:bg-green-100 selection:text-green-900 relative overflow-hidden bg-slate-100">
      {/* 배경 장식 요소 */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-green-300 rounded-full mix-blend-multiply filter blur-[120px] opacity-30 animate-pulse pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-300 rounded-full mix-blend-multiply filter blur-[120px] opacity-30 pointer-events-none"></div>

      {/* 로그인 카드 컨테이너 */}
      <div className="max-w-4xl w-full bg-white rounded-[2rem] shadow-2xl shadow-slate-200/50 flex flex-col md:flex-row overflow-hidden relative z-10 animate-fade-up">
        {/* 왼쪽: 브랜딩 (모바일에서는 숨김) */}
        <div className="hidden md:flex md:w-5/12 bg-slate-900 p-12 flex-col justify-between relative overflow-hidden">
          {/* 배경 패턴 */}
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px]"></div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-green-500/30 to-transparent rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-12">
              <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm">
                V
              </div>
              <span className="font-bold text-xl tracking-tight text-white">
                V.Together
              </span>
            </div>
          </div>

          <div className="relative z-10 mt-auto">
            <span className="bg-white/10 text-green-300 text-[10px] font-bold px-2.5 py-1 rounded-md mb-4 inline-block uppercase tracking-widest border border-white/10">
              Employee ESG Platform
            </span>
            <h1 className="text-3xl font-extrabold mb-4 leading-tight tracking-tight text-white">
              나의 활동이<br />
              <span className="text-green-400">세상의 기회</span>가 되도록
            </h1>
            <p className="text-slate-300 text-sm leading-relaxed font-medium whitespace-nowrap">
              VNTGian 여러분의 실천을 모아 큰 변화를 만듭니다.
            </p>
          </div>
        </div>

        {/* 오른쪽: 로그인 폼 */}
        <div className="w-full md:w-7/12 p-8 md:p-16 flex flex-col justify-center bg-white">
          {/* 모바일 로고 (모바일에서만 표시) */}
          <div className="md:hidden flex items-center gap-2 mb-10 justify-center">
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
              V
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-800">
              V.Together
            </span>
          </div>

          <div className="max-w-sm mx-auto w-full">
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-2 tracking-tight text-center md:text-left">
              로그인
            </h2>
            <p className="text-slate-500 text-sm mb-10 font-medium text-center md:text-left">
              VNTG 계정으로 접속해주세요.
            </p>

            {/* 에러 메시지 표시 */}
            {displayError && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-start gap-2.5">
                  <svg
                    className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div>
                    <p className="text-sm text-red-800 font-medium">
                      {displayError}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Google 로그인 버튼 — OAuth는 브라우저에서 시작 (PKCE 쿠키 유지) */}
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleGoogleLogin()}
              className="btn-google w-full flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 font-bold text-[15px] py-3.5 px-4 rounded-xl relative group transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:shadow-none disabled:opacity-60 disabled:pointer-events-none"
            >
                <svg
                  className="w-5 h-5 absolute left-5"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                {loading ? '이동 중…' : 'Google 계정으로 로그인'}
              </button>

            <div className="mt-8 flex items-center before:mt-0.5 before:flex-1 before:border-t before:border-slate-100 after:mt-0.5 after:flex-1 after:border-t after:border-slate-100">
              <p className="mx-4 mb-0 text-center text-[11px] font-bold text-slate-300 uppercase tracking-widest">
                Notice
              </p>
            </div>

            <div className="mt-6 bg-slate-50 rounded-xl p-4 border border-slate-100">
              <div className="flex items-start gap-2.5">
                <svg
                  className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <p className="text-[12px] text-slate-600 leading-relaxed font-medium">
                    이 시스템은 VNTG 직원 전용입니다.
                    <br />
                    반드시{' '}
                    <span className="font-bold text-slate-800">
                      vntgcorp.com
                    </span>{' '}
                    메일 계정을 사용해주세요.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 푸터 */}
          <div className="mt-12 text-center md:text-left text-[11px] text-slate-400 font-medium">
            &copy; 2026 VNTG Corp. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  )
}
