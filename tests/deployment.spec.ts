import { test, expect } from '@playwright/test'

test('deployed landing and workspace share one vite application', async ({ page, request }) => {
  test.skip(process.env.OBSCURA_VERIFY_PRODUCTION !== '1')
  const app = process.env.OBSCURA_URL || 'https://obscura.aarush-uae.workers.dev'
  await page.goto(app)
  await expect(page.getByRole('heading', { name: /know what’s/ })).toBeVisible()
  await expect(page.locator('iframe')).toHaveCount(0)
  await expect(page.locator('.feature-card')).toHaveCount(6)
  await page.screenshot({ path: 'test-results/production-combined.png' })
  await page.getByRole('link', { name: 'explore the demo' }).first().click()
  await expect(page).toHaveURL(`${app}/app`)
  await expect(page.getByRole('heading', { name: 'security overview' })).toBeVisible()
  await page.getByRole('navigation').getByRole('button', { name: 'vulnerabilities' }).click()
  await expect(page).toHaveURL(`${app}/app/vulnerabilities`)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'vulnerabilities', exact: true })).toBeVisible()
  expect((await request.get(`${app}/api/workspace`)).status()).toBe(401)
  await page.goto(app)
  await page.getByRole('link', { name: 'open workspace' }).click()
  await expect(page).toHaveURL(`${app}/app`)
  await expect(page.locator('input[type=password]')).toBeVisible()
})
