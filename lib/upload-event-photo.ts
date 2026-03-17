/**
 * 이벤트 인증 사진 업로드 (클라이언트 → Supabase 직접)
 * Cloud Run을 거치지 않아 업로드 속도가 빠름
 */

import { createClient } from '@/lib/supabase/client'

const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export async function uploadEventPhotoClient(
  file: File
): Promise<{ url: string | null; error: string | null }> {
  if (!file?.size) return { url: null, error: '파일을 선택하세요.' }
  if (file.size > MAX_SIZE) return { url: null, error: '파일은 5MB 이하여야 합니다.' }
  if (!ALLOWED_TYPES.includes(file.type)) return { url: null, error: '이미지 파일만 업로드할 수 있습니다.' }

  try {
    const supabase = createClient()
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `verification/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

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
