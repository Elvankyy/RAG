import { chromium } from 'playwright-core'

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:5174'
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const ARTIFACTS = 'artifacts'

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } })
const page = await context.newPage()
const results = []

try {
  await page.goto(`${BASE_URL}/login`)
  await page.locator('input[autocomplete="username"]').fill('km')
  await page.locator('input[autocomplete="current-password"]').fill('Km@12345')
  await page.getByRole('button', { name: '登 录' }).click()
  await page.waitForURL('**/chat', { timeout: 15000 })

  await page.goto(`${BASE_URL}/dashboard`)
  await page.getByRole('heading', { name: '数据看板' }).waitFor({ timeout: 10000 })
  await page.locator('.metric-card').first().waitFor()
  const metricCount = await page.locator('.metric-card').count()
  results.push(['metric cards render', metricCount === 5])

  await page.locator('.chart canvas').first().waitFor({ timeout: 10000 })
  const chartCount = await page.locator('.chart canvas').count()
  results.push(['echarts render', chartCount >= 2])

  const questionRows = await page.locator('.ranking-card').first().locator('.ranking-row').count()
  const unitRows = await page.locator('.ranking-card').nth(1).locator('.ranking-row').count()
  results.push(['rankings render', questionRows === 5 && unitRows === 5])

  await page.locator('.days-select').click()
  const statsResponse = page.waitForResponse((response) =>
    response.url().includes('/api/dashboard/stats/tokens'),
  )
  await page.locator('.el-select-dropdown__item').filter({ hasText: '近 7 天' }).click()
  await statsResponse
  await page.getByText('近 7 天').first().waitFor()
  results.push(['range switch works', true])
  await page.screenshot({ path: `${ARTIFACTS}/14-dashboard.png`, fullPage: true })
} finally {
  await browser.close()
}

let failed = 0
for (const [name, ok] of results) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok) failed += 1
}
process.exit(failed > 0 ? 1 : 0)
