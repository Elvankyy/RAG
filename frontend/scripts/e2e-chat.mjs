import { chromium } from 'playwright-core'

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:5174'
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const ARTIFACTS = 'artifacts'

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
const results = []

try {
  await page.goto(`${BASE_URL}/login`)
  await page.locator('input[autocomplete="username"]').fill('km')
  await page.locator('input[autocomplete="current-password"]').fill('Km@12345')
  await page.getByRole('button', { name: '登 录' }).click()
  await page.waitForURL('**/chat', { timeout: 15000 })

  await page.getByText('VPN 权限与办公网络').first().waitFor({ timeout: 10000 })
  await page.getByText('VPN 与办公网络使用指南').first().waitFor({ timeout: 10000 })
  await page.getByText(/另有/).first().waitFor()
  results.push(['seed session citations render', true])
  results.push(['permission notice renders count only', true])

  const composer = page.locator('textarea')
  await composer.fill('报销流程是什么？')
  await page.getByRole('button', { name: '发送' }).click()
  await page.getByText('30 天', { exact: false }).first().waitFor({ timeout: 15000 })
  await page.getByText('FAQ 命中').first().waitFor({ timeout: 10000 })
  await page.getByRole('button', { name: '发送' }).waitFor({ timeout: 15000 })
  results.push(['stream answer renders', true])
  results.push(['FAQ hit badge shown', true])
  await page.screenshot({ path: `${ARTIFACTS}/04-chat-answer.png` })

  await page.getByTitle('新建会话').click()
  await page.getByText('开始一次知识问答').waitFor()
  await page.getByRole('button', { name: '年假有多少天？' }).click()
  await page.getByText('15 天', { exact: false }).first().waitFor({ timeout: 15000 })
  await page.getByRole('button', { name: '发送' }).waitFor({ timeout: 15000 })
  results.push(['suggestion starts new stream', true])
  await page.screenshot({ path: `${ARTIFACTS}/05-chat-new-session.png` })

  const sessionCountAfter = await page.locator('.session-item').count()
  results.push(['new session persisted in list', sessionCountAfter >= 5])
} finally {
  await browser.close()
}

let failed = 0
for (const [name, ok] of results) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok) failed += 1
}
process.exit(failed > 0 ? 1 : 0)
