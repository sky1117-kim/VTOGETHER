import { getNoticesForAdmin } from '@/api/actions/notices'
import { PopupManager } from './PopupManager'

export default async function AdminPopupPage() {
  const all = await getNoticesForAdmin()
  // show_as_popup인 것만, 없으면 전체에서 선택 가능하도록 전달
  const popups = all.filter((n) => n.show_as_popup)

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-6">
      <div>
        <h1 className="text-xl font-black text-gray-900">팝업 공지 관리</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          메인 페이지 접속 시 표시되는 팝업입니다. 여러 개 등록하면 슬라이드로 표시됩니다.
        </p>
      </div>
      <PopupManager popups={popups} />
    </div>
  )
}
