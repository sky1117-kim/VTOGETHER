import { fileTypeFromBuffer } from 'file-type'

export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
const ALLOWED_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])

const ALLOWED_IMAGE_OR_PDF_MIME_TYPES = [...ALLOWED_IMAGE_MIME_TYPES, 'application/pdf'] as const
const ALLOWED_IMAGE_OR_PDF_EXTENSIONS = new Set([...ALLOWED_IMAGE_EXTENSIONS, 'pdf'])

/**
 * 업로드된 파일의 실제 시그니처(매직바이트)를 확인합니다.
 * `file.type`은 요청자가 자유롭게 조작 가능한 값이라 서버에서는 신뢰할 수 없습니다.
 * 반환된 확장자를 저장 경로에 사용하고, 클라이언트가 보낸 원본 파일명은 신뢰하지 않습니다.
 */
async function detectExtension(
  file: File,
  allowedMimeTypes: readonly string[],
  allowedExtensions: Set<string>,
  errorMessage: string
): Promise<{ ext: string; error: null } | { ext: null; error: string }> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const detected = await fileTypeFromBuffer(buffer)
  if (!detected || !allowedMimeTypes.includes(detected.mime) || !allowedExtensions.has(detected.ext)) {
    return { ext: null, error: errorMessage }
  }
  return { ext: detected.ext, error: null }
}

export function detectImageExtension(file: File) {
  return detectExtension(
    file,
    ALLOWED_IMAGE_MIME_TYPES,
    ALLOWED_IMAGE_EXTENSIONS,
    '이미지 파일(jpg, png, webp, gif)만 업로드할 수 있습니다.'
  )
}

export function detectImageOrPdfExtension(file: File) {
  return detectExtension(
    file,
    ALLOWED_IMAGE_OR_PDF_MIME_TYPES,
    ALLOWED_IMAGE_OR_PDF_EXTENSIONS,
    'PDF 또는 이미지(jpg, png, webp, gif)만 업로드할 수 있습니다.'
  )
}
