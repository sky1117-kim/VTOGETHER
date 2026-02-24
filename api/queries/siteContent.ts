import { createClient } from '@/lib/supabase/server'

export type SiteContentMap = Record<string, string>

export async function getSiteContent(): Promise<SiteContentMap> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('site_content')
    .select('key, value')
    .is('deleted_at', null)
  if (error) return {}
  const map: SiteContentMap = {}
  for (const row of data ?? []) {
    map[row.key] = row.value ?? ''
  }
  return map
}
