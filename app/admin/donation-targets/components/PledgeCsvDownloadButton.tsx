'use client'

import type { PayrollPledgeRow } from '@/api/actions/admin/donation-targets'
import { TARGET_DISPLAY_NAMES } from '@/constants/donationTargets'

interface PledgeCsvDownloadButtonProps {
  pledges: PayrollPledgeRow[]
}

function toCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

export function PledgeCsvDownloadButton({ pledges }: PledgeCsvDownloadButtonProps) {
  function handleDownload() {
    const header = ['기부처', '이름', '이메일', '신청 금액(원)', '최종 수정일']
    const rows = pledges.map((p) => [
      TARGET_DISPLAY_NAMES[p.target_name] ?? p.target_name,
      p.user_name ?? '',
      p.user_email ?? '',
      String(p.amount),
      new Date(p.updated_at).toLocaleDateString('ko-KR'),
    ])
    const csv = [header, ...rows].map((row) => row.map(toCsvCell).join(',')).join('\r\n')
    // 엑셀에서 한글이 깨지지 않도록 UTF-8 BOM을 붙인다.
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `특별모금_급여공제_신청내역_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      className="rounded-xl border border-green-600 bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700"
    >
      CSV로 다운로드
    </button>
  )
}
