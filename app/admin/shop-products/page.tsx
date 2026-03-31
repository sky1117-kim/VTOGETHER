import { AdminPageHeader } from '../components/AdminPageHeader'
import { getShopProductsForAdmin } from '@/api/actions/admin/shop-products'
import { ShopProductsAdminClient } from './ShopProductsAdminClient'

export default async function AdminShopProductsPage() {
  const { data, error } = await getShopProductsForAdmin()
  const products = (data ?? []) as {
    product_id: string
    name: string
    description: string | null
    product_type: 'GOODS' | 'CREDIT_PACK' | 'ALMAENG_STORE'
    price_medal: number
    credit_amount: number | null
    stock: number | null
    image_url: string | null
    is_active: boolean
  }[]

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="상점 상품 관리"
        description="V.Medal 상점 상품을 등록하고 판매 상태를 관리합니다."
        breadcrumbs={[{ label: '관리자', href: '/admin' }, { label: '상점 상품' }]}
      />

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <ShopProductsAdminClient products={products} />
    </div>
  )
}
