import type { NextConfig } from 'next'
import path from 'path'
import fs from 'fs'
import { config as loadEnv, parse } from 'dotenv'

const projectRoot = process.cwd()

/**
 * .env 파일에 정의된 키만 process.env 에서 제거합니다.
 * (Next가 이미 병합해 둔 값 중, 다른 환경 파일에서 덮어쓰지 않을 항목을 비웁니다.)
 */
function unsetKeysDefinedInFile(filePath: string) {
  if (!fs.existsSync(filePath)) return
  const parsed = parse(fs.readFileSync(filePath))
  for (const key of Object.keys(parsed)) {
    if (Object.prototype.hasOwnProperty.call(process.env, key)) {
      delete process.env[key]
    }
  }
}

/**
 * 로컬(npm run dev): .env 로 정의된 값은 제거한 뒤 .env.local 만 적용.
 * 운영(next build / next start): .env.local 로 정의된 값은 제거한 뒤 .env 만 적용.
 * (배포 서버에 .env.local 이 없으면 strip 은 noop.)
 */
function applyEnvSplitForNext() {
  const isProd = process.env.NODE_ENV === 'production'
  const envPath = path.join(projectRoot, '.env')
  const localPath = path.join(projectRoot, '.env.local')

  if (isProd) {
    unsetKeysDefinedInFile(localPath)
    if (fs.existsSync(envPath)) {
      loadEnv({ path: envPath, override: true, quiet: true })
    }
    return
  }

  if (!fs.existsSync(localPath)) {
    console.warn(
      '[env] .env.local 이 없습니다. 로컬 실행 시 .env.example 을 참고해 만드세요. (지금은 Next 기본 병합 규칙만 적용됩니다.)'
    )
    return
  }

  unsetKeysDefinedInFile(envPath)
  loadEnv({ path: localPath, override: true, quiet: true })
}

applyEnvSplitForNext()

const supabaseHost = (() => {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!raw) return null
  try {
    return new URL(raw).hostname
  } catch {
    return null
  }
})()

const connectSrcHosts = ['https://www.google-analytics.com', ...(supabaseHost ? [`https://${supabaseHost}`, `wss://${supabaseHost}`] : [])].join(' ')

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${connectSrcHosts}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const nextConfig: NextConfig = {
  output: 'standalone', // Cloud Run 등 컨테이너 배포용 최소 빌드
  poweredByHeader: false,
  experimental: {
    // Server Action 기본 본문 제한(1MB) 초과 에러 방지
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
      ...(supabaseHost ? [{ protocol: 'https' as const, hostname: supabaseHost, pathname: '/**' }] : []),
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
        ],
      },
    ]
  },
}

export default nextConfig
