'use client'

import { useState } from 'react'
import { getEventSubmissionsForExport } from '@/api/actions/admin/events'
import * as XLSX from 'xlsx'

interface ExportEventExcelButtonProps {
  eventId: string
  eventTitle: string
  /** 버튼 스타일: row(이벤트 목록 행 내), detail(상세 페이지) */
  variant?: 'row' | 'detail'
}

export function ExportEventExcelButton({
  eventId,
  eventTitle,
  variant = 'row',
}: ExportEventExcelButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const { data, eventTitle: title, error } = await getEventSubmissionsForExport(eventId)
      if (error) {
        alert(error)
        return
      }
      const fileName = `${title ?? eventTitle}_제출목록_${new Date().toISOString().slice(0, 10)}.xlsx`
      if (!data || data.length === 0) {
        const ws = XLSX.utils.json_to_sheet([{ 이벤트명: title, 구간: '', 참여자명: '', 이메일: '', 상태: '', 제출일시: '', 보상유형: '', 반려사유: '', 인증요약: '제출 건 없음' }])
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, '제출목록')
        XLSX.writeFile(wb, fileName)
      } else {
        const ws = XLSX.utils.json_to_sheet(data)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, '제출목록')
        XLSX.writeFile(wb, fileName)
      }
    } finally {
      setLoading(false)
    }
  }

  const isRow = variant === 'row'

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={loading}
      className={
        isRow
          ? 'shrink-0 rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 btn-press-link'
          : 'rounded-xl border border-green-600 bg-white px-4 py-2 text-sm font-medium text-green-600 transition hover:bg-green-50 disabled:opacity-50 btn-press'
      }
    >
      {loading ? '다운로드 중…' : '엑셀 다운로드'}
    </button>
  )
}
