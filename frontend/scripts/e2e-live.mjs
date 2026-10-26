import { chromium } from 'playwright-core'

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:5175'
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const ARTIFACTS = 'artifacts'

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await context.newPage()
const results = []

async function login(username, password) {
  await page.goto(`${BASE_URL}/login`)
  await page.locator('input[autocomplete="username"]').fill(username)
  await page.locator('input[autocomplete="current-password"]').fill(password)
  await page.getByRole('button', { name: '登 录' }).click()
  await page.waitForURL('**/chat', { timeout: 15000 })
}

try {
  await login('km', 'Km@12345')
  await page.locator('textarea').waitFor({ timeout: 10000 })
  results.push(['live login -> chat', true])

  await page.locator('textarea').fill('报销流程是什么？')
  await page.getByRole('button', { name: '发送' }).click()
  await page.getByText('30 天', { exact: false }).first().waitFor({ timeout: 20000 })
  await page.getByText('费用报销管理规范').first().waitFor({ timeout: 10000 })
  await page.getByRole('button', { name: '发送' }).waitFor({ timeout: 20000 })
  results.push(['live SSE answer with citations', true])
  await page.screenshot({ path: `${ARTIFACTS}/18-live-chat.png` })

  await page.goto(`${BASE_URL}/knowledge/units`)
  await page.locator('.table-row').first().waitFor({ timeout: 10000 })
  const unitRows = await page.locator('.table-row').count()
  results.push(['live knowledge list', unitRows >= 5])

  await page.getByPlaceholder('搜索标题或正文').fill('员工手册')
  await page.getByRole('button', { name: '查询' }).click()
  await page.getByRole('button', { name: /员工手册/ }).first().waitFor({ timeout: 10000 })
  await page.getByRole('button', { name: /员工手册/ }).first().click()
  await page.waitForURL('**/knowledge/units/*', { timeout: 10000 })
  await page.getByText('数据权限').first().click()
  await page.getByText('四维数据权限').waitFor({ timeout: 10000 })
  results.push(['live unit detail permissions', true])
  await page.screenshot({ path: `${ARTIFACTS}/19-live-unit.png` })

  await page.goto(`${BASE_URL}/dashboard`)
  await page.locator('.metric-card').first().waitFor({ timeout: 10000 })
  await page.locator('.chart canvas').first().waitFor({ timeout: 10000 })
  results.push(['live dashboard', (await page.locator('.metric-card').count()) === 5])
  await page.screenshot({ path: `${ARTIFACTS}/20-live-dashboard.png` })

  await page.getByTitle('退出登录').click()
  await page.waitForURL('**/login', { timeout: 10000 })
  await login('admin', 'Admin@123')

  await page.goto(`${BASE_URL}/org/users`)
  await page.locator('.table-row').first().waitFor({ timeout: 10000 })
  results.push(['live org users', (await page.locator('.table-row').count()) >= 7])

  await page.goto(`${BASE_URL}/org/roles`)
  await page.locator('.role-item').first().waitFor({ timeout: 10000 })
  results.push(['live org roles', (await page.locator('.role-item').count()) >= 6])

  await page.goto(`${BASE_URL}/org/departments`)
  await page.locator('.tree-node').first().waitFor({ timeout: 10000 })
  results.push(['live org departments', (await page.locator('.tree-node').count()) >= 7])
  await page.screenshot({ path: `${ARTIFACTS}/21-live-org.png` })
} finally {
  await browser.close()
}

let failed = 0
for (const [name, ok] of results) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok) failed += 1
}
process.exit(failed > 0 ? 1 : 0)
