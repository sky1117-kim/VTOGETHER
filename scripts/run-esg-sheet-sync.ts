/**
 * ESG 상점 주문 → 구글시트 수동 동기화
 * 사용: npm run sync:esg-sheet
 */
import { syncEsgOrdersToSheet } from '@/lib/shop-orders-esg-sheet-sync'

async function main() {
  const result = await syncEsgOrdersToSheet()
  console.log(JSON.stringify(result, null, 2))
  process.exit(result.success ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
