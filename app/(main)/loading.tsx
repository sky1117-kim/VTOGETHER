import { HomePageSkeleton } from '@/components/main/HomePageSkeleton'

/**
 * (main) 레이아웃 하위 페이지 로딩 시 표시되는 스켈레톤.
 * Next.js가 해당 세그먼트를 로드하는 동안 자동으로 표시됨.
 */
export default function MainLoading() {
  return <HomePageSkeleton />
}
