import { chromium } from 'playwright-core'

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:5174'
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const ARTIFACTS = 'artifacts'

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await context.newPage()
const results = []

async function confirmBox(label) {
  await page.locator('.el-message-box').getByRole('button', { name: label }).click()
}

try {
  await page.goto(`${BASE_URL}/login`)
  await page.locator('input[autocomplete="username"]').fill('km')
  await page.locator('input[autocomplete="current-password"]').fill('Km@12345')
  await page.getByRole('button', { name: '登 录' }).click()
  await page.waitForURL('**/chat', { timeout: 15000 })

  await page.goto(`${BASE_URL}/settlement/faqs`)
  await page.getByRole('heading', { name: '知识沉淀' }).waitFor({ timeout: 10000 })
  await page.locator('.rec-item').first().waitFor()
  const recCount = await page.locator('.rec-item').count()
  results.push(['faq recommendations render', recCount === 3])

  await page.getByRole('button', { name: /出差住宿标准是多少/ }).click()
  await page.getByRole('button', { name: '通过并发布' }).click()
  await page.getByText('已通过并写入缓存').waitFor({ timeout: 10000 })
  await page.waitForFunction(() => document.querySelectorAll('.rec-item').length === 2)
  results.push(['approve faq works', true])

  await page.getByRole('button', { name: /如何申请会议室/ }).click()
  await page.getByRole('button', { name: '驳回' }).click()
  await page.getByText('已驳回该推荐').waitFor({ timeout: 10000 })
  results.push(['reject faq works', true])
  await page.screenshot({ path: `${ARTIFACTS}/15-settlement-faqs.png` })

  await page.getByRole('button', { name: /已发布 FAQ/ }).click()
  await page.locator('.table-row').first().waitFor()
  const publishedRows = await page.locator('.table-row').count()
  results.push(['published faq list renders', publishedRows >= 4])

  const offlineRow = page.locator('.table-row').filter({ hasText: '如何申请 VPN 权限' })
  await offlineRow.getByRole('button', { name: '下线' }).click()
  await confirmBox('下线')
  await page.getByText('FAQ 已下线').waitFor({ timeout: 10000 })
  results.push(['offline faq works', true])

  await page.getByRole('button', { name: '手动新建 FAQ' }).click()
  const faqDialog = page.getByRole('dialog')
  await faqDialog.locator('input').nth(0).fill('办公用品如何申请？')
  await faqDialog.locator('textarea').fill('在 OA 行政服务模块提交物品申请，主管审批后由行政统一采购。')
  await faqDialog.locator('input').nth(1).fill('行政管理')
  await faqDialog.getByRole('button', { name: '创建并发布' }).click()
  await page.getByText('FAQ 已创建并发布').waitFor({ timeout: 10000 })
  await page.getByText('办公用品如何申请？').first().waitFor({ timeout: 10000 })
  results.push(['create faq works', true])
  await page.screenshot({ path: `${ARTIFACTS}/16-settlement-published.png` })

  await page.goto(`${BASE_URL}/settlement/gaps`)
  await page.getByRole('heading', { name: '知识缺口' }).waitFor({ timeout: 10000 })
  await page.locator('.table-row').first().waitFor()
  const gapRows = await page.locator('.table-row').count()
  results.push(['gap list renders', gapRows >= 4])

  const visaRow = page.locator('.table-row').filter({ hasText: '海外差旅签证如何办理' })
  await visaRow.getByRole('button', { name: '创建知识单元' }).click()
  const gapDialog = page.getByRole('dialog')
  await gapDialog.locator('input').nth(1).fill('行政管理')
  await gapDialog.getByRole('button', { name: '创建并标记解决' }).click()
  await page.getByText(/已创建知识单元/).waitFor({ timeout: 10000 })
  await visaRow.getByText('已解决').waitFor({ timeout: 10000 })
  results.push(['create unit from gap works', true])
  await page.screenshot({ path: `${ARTIFACTS}/17-settlement-gaps.png` })

  const remoteRow = page.locator('.table-row').filter({ hasText: '公司支持远程办公吗' })
  await remoteRow.getByRole('button', { name: '忽略' }).click()
  await confirmBox('忽略')
  await page.getByText('已忽略该知识缺口').waitFor({ timeout: 10000 })
  results.push(['ignore gap works', true])
} finally {
  await browser.close()
}

let failed = 0
for (const [name, ok] of results) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok) failed += 1
}
process.exit(failed > 0 ? 1 : 0)
