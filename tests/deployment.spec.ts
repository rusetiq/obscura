import { test, expect } from '@playwright/test'

test('deployed showcase links to a public sample and protected live workspace', async ({
  page,
  request,
}) => {
  test.skip(process.env.OBSCURA_VERIFY_PRODUCTION !== '1')
  const app = 'https://obscura.aarush-uae.workers.dev'
  const showcase = 'https://obscura-showcase.aarush-uae.workers.dev'
  await page.goto(showcase)
  await expect(page.getByRole('heading', { name: /know what’s/ })).toBeVisible()
  await expect(page.locator('.feature-card')).toHaveCount(6)
  await expect(page.getByRole('link', { name: 'explore the demo' }).first()).toHaveAttribute(
    'href',
    `${app}/?sample=1`,
  )
  await page.screenshot({ path: 'test-results/production-showcase.png' })
  await page.getByRole('link', { name: 'explore the demo' }).first().click()
  await expect(page.getByRole('heading', { name: 'security overview' })).toBeVisible()
  expect((await request.get(`${app}/api/workspace`)).status()).toBe(401)
  await page.goto(`${app}/landing`)
  await expect(
    page.frameLocator('iframe').getByRole('heading', { name: /know what’s/ }),
  ).toBeVisible()
  await page.frameLocator('iframe').getByRole('link', { name: 'open workspace' }).click()
  await expect(page.locator('input[type=password]')).toBeVisible()
})
