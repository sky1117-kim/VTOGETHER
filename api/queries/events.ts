import { createClient } from '@/lib/supabase/server'

/** 메인/이벤트 페이지: ACTIVE 상태 이벤트만 조회 */
export async function getEventsForPublic() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: false })
  if (error) return []
  return data ?? []
}
