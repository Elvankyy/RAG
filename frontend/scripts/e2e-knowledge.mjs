import { chromium } from 'playwright-core'

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:5174'
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const ARTIFACTS = 'artifacts'

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
const results = []

async function login() {
  await page.goto(`${BASE_URL}/login`)
  await page.locator('input[autocomplete="username"]').fill('km')
  await page.locator('input[autocomplete="current-password"]').fill('Km@12345')
  await page.getByRole('button', { name: '登 录' }).click()
  await page.waitForURL('**/chat', { timeout: 15000 })
}

try {
  await login()

  await page.goto(`${BASE_URL}/knowledge/units`)
  await page.getByRole('button', { name: '员工手册（2026 版）' }).waitFor({ timeout: 10000 })
  const rowCount = await page.locator('.table-row').count()
  results.push(['unit list renders seed units', rowCount >= 10])
  await page.screenshot({ path: `${ARTIFACTS}/06-unit-list.png` })

  await page.getByPlaceholder('搜索标题或正文').fill('报销')
  const filteredResponse = page.waitForResponse(
    (response) => response.url().includes('/api/knowledge/units') && response.url().includes('keyword='),
  )
  await page.getByRole('button', { name: '查询' }).click()
  await filteredResponse
  await page.waitForFunction(() => document.querySelectorAll('.table-row').length < 10, null, {
    timeout: 10000,
  })
  const filteredCount = await page.locator('.table-row').count()
  const employeeVisible = await page.getByRole('button', { name: /员工手册/ }).count()
  results.push(['unit search filters list', filteredCount >= 1 && employeeVisible === 0])
  await page.getByRole('button', { name: '重置' }).click()
  await page.getByRole('button', { name: '员工手册（2026 版）' }).waitFor({ timeout: 10000 })

  await page.getByRole('button', { name: '新建知识单元' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.locator('input').first().fill('测试新建知识单元')
  await dialog.locator('textarea').fill('# 测试新建知识单元\n\n这是通过前端创建的知识单元，保存后立即发布。')
  await dialog.getByRole('button', { name: '创建并发布' }).click()
  await page.getByText('测试新建知识单元').first().waitFor({ timeout: 10000 })
  results.push(['create unit dialog works', true])
  await page.screenshot({ path: `${ARTIFACTS}/07-unit-created.png` })

  await page.getByRole('button', { name: '员工手册（2026 版）' }).click()
  await page.waitForURL('**/knowledge/units/*', { timeout: 10000 })
  await page.getByText('四维数据权限').waitFor({ timeout: 5000 }).catch(() => {})
  await page.getByRole('button', { name: '数据权限' }).click()
  await page.getByText('四维数据权限').waitFor({ timeout: 10000 })
  await page.getByText('全局公开').first().waitFor()
  await page.getByRole('button', { name: '保存权限' }).first().click()
  await page.getByText('数据权限已保存').waitFor({ timeout: 10000 })
  results.push(['unit detail permissions save works', true])
  await page.screenshot({ path: `${ARTIFACTS}/08-unit-permissions.png` })

  await page.goto(`${BASE_URL}/knowledge/import`)
  await page.locator('input[type="file"]').first().setInputFiles([
    { name: '测试文档A.md', mimeType: 'text/markdown', buffer: Buffer.from('# 测试文档A\n\n内容 A') },
    { name: '测试文档B.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('docx-bytes') },
    { name: '测试文档C.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') },
    { name: '测试文档D.txt', mimeType: 'text/plain', buffer: Buffer.from('测试文档D') },
  ])
  await page.getByText('已选 4 个文件').waitFor()
  await page.getByRole('button', { name: '开始导入' }).click()
  await page.getByText('导入任务', { exact: true }).waitFor({ timeout: 10000 })
  await page.screenshot({ path: `${ARTIFACTS}/09-import-running.png` })

  const failedRow = page.locator('.task-row').filter({ hasText: '测试文档D.txt' })
  await failedRow.getByText('失败').waitFor({ timeout: 15000 })
  await failedRow.getByRole('button', { name: '重试' }).click()
  await failedRow.getByText('已完成').waitFor({ timeout: 10000 })
  results.push(['import batch and retry work', true])
  await page.getByText(/4\/4 成功/).waitFor({ timeout: 10000 })
  await page.screenshot({ path: `${ARTIFACTS}/10-import-success.png` })
} finally {
  await browser.close()
}

let failed = 0
for (const [name, ok] of results) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok) failed += 1
}
process.exit(failed > 0 ? 1 : 0)
