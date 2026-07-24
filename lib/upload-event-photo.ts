/**
 * 이벤트 인증 사진 업로드 (클라이언트 → Supabase 직접)
 * Cloud Run을 거치지 않아 업로드 속도가 빠름
 */

import { createBrowserClient } from '@supabase/ssr'
import { fileTypeFromBlob } from 'file-type'

const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])

export type SupabaseBrowserCreds = { url: string; anonKey: string }

export async function uploadEventPhotoClient(
  file: File,
  creds: SupabaseBrowserCreds
): Promise<{ url: string | null; error: string | null }> {
  if (!file?.size) return { url: null, error: '파일을 선택하세요.' }
  if (file.size > MAX_SIZE) return { url: null, error: '파일은 5MB 이하여야 합니다.' }
  // file.type/파일명은 클라이언트가 자유롭게 조작 가능하므로 실제 파일 시그니처(매직바이트)로 확인합니다.
  const detected = await fileTypeFromBlob(file)
  if (!detected || !ALLOWED_TYPES.includes(detected.mime) || !ALLOWED_EXTENSIONS.has(detected.ext)) {
    return { url: null, error: '이미지 파일만 업로드할 수 있습니다.' }
  }
  if (!creds.url?.trim() || !creds.anonKey?.trim()) {
    return { url: null, error: '업로드 설정이 없습니다. 페이지를 새로고침하거나 관리자에게 문의하세요.' }
  }

  try {
    const supabase = createBrowserClient(creds.url, creds.anonKey)
    const path = `verification/${Date.now()}-${crypto.randomUUID()}.${detected.ext}`

    const { data, error } = await supabase.storage.from('event-verification').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })

    if (error) return { url: null, error: error.message }

    const { data: urlData } = supabase.storage.from('event-verification').getPublicUrl(data.path)
    return { url: urlData.publicUrl, error: null }
  } catch (e) {
    return { url: null, error: e instanceof Error ? e.message : '업로드 실패' }
  }
}
