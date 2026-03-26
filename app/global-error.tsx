'use client'

import { useEffect } from 'react'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    const key = `client-error:${error.digest ?? error.message}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')

    void fetch('/api/report-client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        path: window.location.pathname,
      }),
    })
  }, [error])

  return (
    <html>
      <body className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center">
          <h2 className="text-lg font-semibold">문제가 발생했습니다.</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            같은 문제가 반복되면 관리자에게 문의해 주세요.
          </p>
          <button
            className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            onClick={() => reset()}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  )
}
