import { chromium } from 'playwright-core'

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:5174'
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const ARTIFACTS = 'artifacts'

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
const results = []

async function confirmDelete() {
  const box = page.locator('.el-message-box')
  await box.getByRole('button', { name: '删除' }).click()
}

try {
  await page.goto(`${BASE_URL}/login`)
  await page.locator('input[autocomplete="username"]').fill('admin')
  await page.locator('input[autocomplete="current-password"]').fill('Admin@123')
  await page.getByRole('button', { name: '登 录' }).click()
  await page.waitForURL('**/chat', { timeout: 15000 })

  await page.goto(`${BASE_URL}/org/users`)
  await page.getByRole('heading', { name: '用户管理' }).waitFor({ timeout: 10000 })
  await page.locator('.table-row').first().waitFor()
  const userRows = await page.locator('.table-row').count()
  results.push(['user list renders', userRows >= 7])

  await page.getByPlaceholder('搜索用户名或显示名').fill('陈思远')
  await page.getByRole('button', { name: '查询' }).click()
  await page.getByText('陈思远').first().waitFor({ timeout: 10000 })
  await page.waitForFunction(() => document.querySelectorAll('.table-row').length === 1)
  results.push(['user search filters', true])
  await page.getByRole('button', { name: '重置', exact: true }).click()
  await page.locator('.table-row').first().waitFor()

  await page.getByRole('button', { name: '新增用户' }).click()
  const userDialog = page.getByRole('dialog')
  await userDialog.locator('input').nth(0).fill('testuser')
  await userDialog.locator('input[type="password"]').fill('Test@123')
  await userDialog.locator('input').nth(2).fill('测试用户')
  await userDialog.getByRole('button', { name: '保存' }).click()
  await page.getByText('用户已创建').waitFor({ timeout: 10000 })
  await page.getByText('测试用户').first().waitFor({ timeout: 10000 })
  results.push(['create user works', true])
  await page.screenshot({ path: `${ARTIFACTS}/11-org-users.png` })

  const testRow = page.locator('.table-row').filter({ hasText: 'testuser' })
  await testRow.getByRole('button', { name: '重置密码' }).click()
  const resetDialog = page.getByRole('dialog')
  await resetDialog.locator('input[type="password"]').fill('NewPass@123')
  await resetDialog.getByRole('button', { name: '重置', exact: true }).click()
  await page.getByText('密码已重置').waitFor({ timeout: 10000 })
  results.push(['reset password works', true])

  await testRow.getByRole('button', { name: '停用' }).click()
  await page.getByText('已停用').waitFor({ timeout: 10000 })
  await page.waitForFunction(() => {
    const row = [...document.querySelectorAll('.table-row')].find((item) =>
      item.textContent?.includes('testuser'),
    )
    return row?.textContent?.includes('停用')
  })
  results.push(['toggle user status works', true])

  await testRow.getByRole('button', { name: '删除' }).click()
  await confirmDelete()
  await page.getByText('用户已删除').waitFor({ timeout: 10000 })
  results.push(['delete user works', true])

  await page.goto(`${BASE_URL}/org/roles`)
  await page.getByRole('heading', { name: '角色管理' }).waitFor({ timeout: 10000 })
  await page.getByRole('button', { name: /知识管理员/ }).first().click()
  await page.getByText('knowledge_admin').first().waitFor()
  const permissionChecks = await page.locator('.permission-item').count()
  results.push(['role permission tree renders', permissionChecks >= 20])
  await page.getByRole('button', { name: '保存权限' }).first().click()
  await page.getByText(/已保存 \d+ 项权限/).waitFor({ timeout: 10000 })
  results.push(['save role permissions works', true])
  await page.screenshot({ path: `${ARTIFACTS}/12-org-roles.png` })

  await page.getByRole('button', { name: '新建角色' }).click()
  const roleDialog = page.getByRole('dialog')
  await roleDialog.locator('input').nth(0).fill('审计员')
  await roleDialog.locator('input').nth(1).fill('auditor')
  await roleDialog.locator('textarea').fill('只读审计角色')
  await roleDialog.getByRole('button', { name: '保存' }).click()
  await page.getByText('角色已创建').waitFor({ timeout: 10000 })
  await page.getByText('审计员').first().waitFor({ timeout: 10000 })
  results.push(['create role works', true])

  await page.goto(`${BASE_URL}/org/departments`)
  await page.getByRole('heading', { name: '部门管理' }).waitFor({ timeout: 10000 })
  await page.getByRole('button', { name: /技术部/ }).first().click()
  await page.getByText('部门成员').waitFor()
  results.push(['department tree and detail render', true])

  await page.getByRole('button', { name: '新增部门' }).click()
  const deptDialog = page.getByRole('dialog')
  await deptDialog.locator('input').nth(0).fill('测试部门')
  await deptDialog.getByRole('button', { name: '保存' }).click()
  await page.getByText('部门已创建').waitFor({ timeout: 10000 })
  await page.getByRole('button', { name: /测试部门/ }).first().waitFor({ timeout: 10000 })
  results.push(['create department works', true])
  await page.screenshot({ path: `${ARTIFACTS}/13-org-departments.png` })

  await page.getByRole('button', { name: '删除' }).click()
  await confirmDelete()
  await page.getByText('部门已删除').waitFor({ timeout: 10000 })
  results.push(['delete department works', true])
} finally {
  await browser.close()
}

let failed = 0
for (const [name, ok] of results) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok) failed += 1
}
process.exit(failed > 0 ? 1 : 0)
