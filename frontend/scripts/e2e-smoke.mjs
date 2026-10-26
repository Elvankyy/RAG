import { chromium } from 'playwright-core'

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:5174'
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const ARTIFACTS = 'artifacts'

async function login(page, username, password) {
  await page.goto(`${BASE_URL}/login`)
  await page.getByText('欢迎回来').waitFor()
  await page.locator('input[autocomplete="username"]').fill(username)
  await page.locator('input[autocomplete="current-password"]').fill(password)
  await page.getByRole('button', { name: '登 录' }).click()
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
const results = []

try {
  await page.goto(`${BASE_URL}/login`)
  await page.getByText('欢迎回来').waitFor()
  await page.locator('input[autocomplete="username"]').fill('km')
  await page.locator('input[autocomplete="current-password"]').fill('wrong-password')
  await page.getByRole('button', { name: '登 录' }).click()
  await page.getByText('用户名或密码错误').waitFor({ timeout: 10000 })
  results.push(['invalid password rejected', true])

  await login(page, 'km', 'Km@12345')
  await page.waitForURL('**/chat', { timeout: 15000 })
  results.push(['knowledge_admin login -> /chat', page.url().endsWith('/chat')])
  await page.screenshot({ path: `${ARTIFACTS}/01-chat.png` })

  await page.goto(`${BASE_URL}/org/users`)
  await page.waitForURL('**/403', { timeout: 10000 })
  results.push(['knowledge_admin blocked from /org/users', page.url().endsWith('/403')])
  await page.screenshot({ path: `${ARTIFACTS}/02-forbidden.png` })

  await page.getByTitle('退出登录').click()
  await page.waitForURL('**/login', { timeout: 10000 })
  results.push(['logout -> /login', page.url().includes('/login')])

  await login(page, 'admin', 'Admin@123')
  await page.waitForURL('**/chat', { timeout: 15000 })
  await page.goto(`${BASE_URL}/org/users`)
  await page.getByText('用户管理').first().waitFor()
  results.push(['system_admin can open /org/users', page.url().endsWith('/org/users')])
  await page.screenshot({ path: `${ARTIFACTS}/03-org-users.png` })

  await page.getByTitle('退出登录').click()
  await page.waitForURL('**/login', { timeout: 10000 })
  await page.getByText('欢迎回来').waitFor()
  await page.screenshot({ path: `${ARTIFACTS}/00-login.png` })
  results.push(['login page renders after logout', page.url().includes('/login')])
} finally {
  await browser.close()
}

let failed = 0
for (const [name, ok] of results) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok) failed += 1
}
process.exit(failed > 0 ? 1 : 0)
