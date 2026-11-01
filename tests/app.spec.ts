import { expect, test } from '@playwright/test'

test('sample workspace supports navigation, triage, filtering, and report export', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/app')
  await expect(page.getByRole('heading', { name: 'security overview' })).toBeVisible()
  await expect(page.locator('.topbar-sample')).toBeVisible()
  await page.screenshot({ path: 'test-results/overview-desktop.png', fullPage: true })
  await page.locator('.severity-summary-rows button').first().click()
  await expect(page.getByLabel('filter by severity')).toHaveValue('critical')
  await page.getByRole('navigation').getByRole('button', { name: 'vulnerabilities' }).click()
  await page.getByLabel('filter by severity').selectOption('critical')
  await expect(page.locator('tbody tr')).toHaveCount(2)
  await page.getByRole('button', { name: 'view CVE-2025-29927', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(
    page.getByText('this example is prewritten. it is not a live ai response.'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'view sample analysis' }).click()
  await expect(page.getByText('sample analysis', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'ignore', exact: true }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await page.getByLabel('filter by severity').selectOption('all')
  await page.getByRole('tab', { name: 'ignored' }).click()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await page.getByRole('navigation').getByRole('button', { name: 'projects' }).click()
  await page.getByRole('button', { name: /api-gateway.*manifest upload/ }).click()
  await expect(page.getByLabel('search vulnerabilities')).toHaveValue('api-gateway')
  const download = page.waitForEvent('download')
  await page.getByLabel('export workspace report').click()
  expect((await download).suggestedFilename()).toBe('obscura-sample.json')
  expect(errors).toEqual([])
})

test('live scan stores the manifest and completes a durable OSV workflow', async ({ page }) => {
  test.setTimeout(120000)
  await page.goto('/app')
  await page.getByRole('button', { name: 'new scan', exact: true }).click()
  await page.getByRole('textbox', { name: 'project name' }).fill('integration-check')
  await page.getByLabel('dependency manifest').setInputFiles({
    name: 'package.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({ name: 'integration-check', dependencies: { lodash: '4.17.20' } }),
    ),
  })
  await page.getByRole('button', { name: 'run vulnerability scan' }).click()
  await expect(page.getByRole('heading', { name: 'scan history', exact: true })).toBeVisible()
  await expect(page.locator('.topbar-sample')).not.toBeVisible()
  await expect(
    page
      .locator('.scan-item')
      .filter({ hasText: 'integration-check' })
      .first()
      .locator('.scan-status'),
  ).toHaveText('completed', { timeout: 100000 })
  await page.getByRole('navigation').getByRole('button', { name: 'vulnerabilities' }).click()
  await expect(page.locator('tbody tr').first()).toBeVisible()
  await page.locator('.finding-title').first().click()
  const health = await (await page.request.get('/api/health')).json()
  if (health.ai) {
    await page.getByRole('button', { name: 'analyze with ai' }).click()
    await expect(page.locator('.analysis-content')).toBeVisible({ timeout: 60000 })
    await expect(page.getByText('ai generated', { exact: true })).toBeVisible()
    expect((await page.locator('.analysis-content').innerText()).length).toBeGreaterThan(100)
    await page.screenshot({ path: 'test-results/live-ai-analysis.png' })
  } else {
    await expect(page.getByRole('button', { name: 'ai unavailable' })).toBeDisabled()
  }
  await page.getByRole('button', { name: 'prepare a fix', exact: true }).click()
  await expect(page.getByText('a fix is ready for review')).toBeVisible({ timeout: 30000 })
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'download package.json' }).click()
  expect((await download).suggestedFilename()).toBe('package.json')
})

test('mobile layout remains usable without page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/app')
  await expect(page.getByRole('heading', { name: 'security overview' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.screenshot({ path: 'test-results/overview-mobile.png', fullPage: true })
  await page.getByRole('button', { name: 'toggle navigation' }).click()
  await page.getByRole('navigation').getByRole('button', { name: 'projects' }).click()
  await expect(page.getByRole('heading', { name: 'projects', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'new scan', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
})

test('theme switching persists and glass surfaces work in both modes', async ({ page }) => {
  await page.goto('/app')
  await expect(page.getByRole('heading', { name: 'security overview' })).toBeVisible()
  await expect(page.getByText('latest scans only', { exact: true })).toHaveCount(0)
  await expect(page.getByText('review first', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'switch to light mode' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.screenshot({ path: 'test-results/overview-light.png', fullPage: true })
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByRole('button', { name: 'new scan', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(
    await page.getByRole('dialog').evaluate((element) => getComputedStyle(element).backdropFilter),
  ).toContain('blur')
  await page.screenshot({ path: 'test-results/light-glass-dialog.png' })
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'switch to dark mode' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'switch to light mode' }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('schedules dispatch once per occurrence and support pause, edit, run now, and removal', async ({
  page,
}) => {
  test.setTimeout(90000)
  const project = 'scheduled-integration-check'
  const upload = await page.request.post('/api/scans', {
    multipart: {
      project,
      manifest: {
        name: 'package.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify({ name: project, dependencies: { lodash: '4.17.20' } })),
      },
    },
  })
  expect(upload.status()).toBe(202)
  await expect
    .poll(
      async () =>
        (await (await page.request.get('/api/workspace')).json()).scans.find(
          (scan: { project: string }) => scan.project === project,
        )?.status,
      { timeout: 30000 },
    )
    .toBe('completed')
  await page.goto('/app')
  await page.getByLabel('workspace data source').selectOption('live')
  await page.getByRole('navigation').getByRole('button', { name: 'schedules' }).click()
  await page.getByRole('button', { name: 'add schedule' }).click()
  await page.getByRole('textbox', { name: 'schedule name' }).fill('recurring integration check')
  await page.getByLabel('project', { exact: true }).selectOption(project)
  await page.getByLabel('repeat', { exact: true }).selectOption('hourly')
  await page.getByRole('button', { name: 'save schedule' }).click()
  const item = page.locator('.schedule-item').filter({ hasText: 'recurring integration check' })
  await expect(item).toBeVisible()
  await expect(item.getByRole('switch')).toBeChecked()
  const workspace = await (await page.request.get('/api/workspace')).json()
  const schedule = workspace.schedules.find(
    (item: { name: string }) => item.name === 'recurring integration check',
  )
  const due = Date.now() + 1500
  expect(
    (
      await page.request.patch('/api/schedules/' + schedule.id, {
        data: {
          name: schedule.name,
          project,
          frequency: 'hourly',
          nextRunAt: new Date(due).toISOString(),
        },
      })
    ).ok(),
  ).toBe(true)
  await expect.poll(() => Date.now() >= due, { timeout: 5000 }).toBe(true)
  const trigger = () =>
    page.request.post('/cdn-cgi/local/explorer/api/local/scheduled?worker=obscura', {
      data: { cron: '* * * * *', scheduled_time: Date.now() },
    })
  expect((await trigger()).ok()).toBe(true)
  expect((await trigger()).ok()).toBe(true)
  await expect
    .poll(
      async () => {
        const state = await (await page.request.get('/api/workspace')).json()
        return state.scans.filter(
          (scan: { scheduleId: string; status: string }) =>
            scan.scheduleId === schedule.id && scan.status === 'completed',
        ).length
      },
      { timeout: 30000 },
    )
    .toBe(1)
  await page.reload()
  await expect(item).toBeVisible()
  await item.getByRole('switch').click()
  await expect(item.getByRole('switch')).not.toBeChecked()
  await item.getByRole('button', { name: 'edit recurring integration check' }).click()
  await page.getByRole('textbox', { name: 'schedule name' }).fill('weekly integration check')
  await page.getByLabel('repeat', { exact: true }).selectOption('weekly')
  await page.getByRole('button', { name: 'save schedule' }).click()
  const edited = page.locator('.schedule-item').filter({ hasText: 'weekly integration check' })
  await expect(edited).toBeVisible()
  await expect(edited.getByRole('switch')).not.toBeChecked()
  await edited.getByRole('button', { name: 'run weekly integration check now' }).click()
  await expect
    .poll(
      async () => {
        const state = await (await page.request.get('/api/workspace')).json()
        return state.scans.filter(
          (scan: { scheduleId: string; status: string }) =>
            scan.scheduleId === schedule.id && scan.status === 'completed',
        ).length
      },
      { timeout: 30000 },
    )
    .toBe(2)
  await page.screenshot({ path: 'test-results/schedules.png', fullPage: true })
  await edited.getByRole('button', { name: 'remove weekly integration check' }).click()
  await expect(edited).toHaveCount(0)
})

test('graph stays inside the plot and displays valid absolute coordinates', async ({ page }) => {
  await page.goto('/app')
  await expect(page.getByRole('heading', { name: 'security overview' })).toBeVisible()
  const line = page.locator('.chart-line')
  const path = await line.getAttribute('d')
  expect(path).toMatch(/^M/)
  expect(path).toContain('L')
  const bounds = await line.evaluate((element) => {
    const box = (element as SVGGraphicsElement).getBBox()
    return { x: box.x, y: box.y, right: box.x + box.width, bottom: box.y + box.height }
  })
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.y).toBeGreaterThanOrEqual(0)
  expect(bounds.right).toBeLessThanOrEqual(700)
  expect(bounds.bottom).toBeLessThanOrEqual(156)
  await page.getByLabel('chart period').selectOption('7')
  await expect(page.getByRole('img', { name: /sample finding counts/ })).toBeVisible()
  await page.screenshot({ path: 'test-results/graph-fixed.png', fullPage: true })
})

test('landing showcase scrolls through square cards and supports themes and mobile', async ({
  page,
}) => {
  await page.goto('/landing')
  const showcase = page
  await expect(showcase.getByRole('heading', { name: /know what’s/ })).toBeVisible()
  await expect(showcase.locator('.feature-card')).toHaveCount(6)
  await expect(showcase.locator('.landing-kicker')).toHaveCount(0)
  await expect(showcase.getByText(/comparison/i)).toHaveCount(0)
  expect(
    await showcase
      .locator('.feature-card')
      .first()
      .evaluate((el) => getComputedStyle(el).borderRadius),
  ).toBe('0px')
  expect(await showcase.locator('body').evaluate((el) => el.scrollHeight)).toBeGreaterThan(3000)
  await showcase.getByRole('link', { name: '03 fix' }).click()
  await expect(
    showcase.getByRole('heading', { name: 'a change you can inspect.' }),
  ).toBeInViewport()
  await showcase.getByRole('button', { name: 'switch to light mode' }).click()
  await expect(showcase.getByRole('button', { name: 'switch to dark mode' })).toBeVisible()
  await showcase.getByRole('button', { name: 'switch to dark mode' }).click()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(
    await showcase.locator('.trace').evaluate((el) => getComputedStyle(el).animationName),
  ).toBe('none')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await showcase.locator('body').evaluate((el) => el.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await showcase.getByRole('link', { name: 'explore the demo' }).first().click()
  await expect(page.getByRole('heading', { name: 'security overview' })).toBeVisible()
  await page.goto('/obscura.html')
  await expect(page.getByRole('heading', { name: /know what’s/ })).toBeVisible()
  await page.setViewportSize({ width: 1440, height: 1050 })
  await page.screenshot({ path: 'test-results/landing-scroll-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: 'test-results/landing-scroll-mobile.png', fullPage: true })
})

test('landing wheel scrolling eases to rest and stops for keyboard navigation', async ({
  page,
}) => {
  await page.goto('/')
  await page.mouse.move(700, 500)
  await page.mouse.wheel(0, 600)
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(20)
  const early = await page.evaluate(() => scrollY)
  expect(early).toBeLessThan(650)
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(680)
  await page.mouse.wheel(0, 1000)
  await page.keyboard.press('Home')
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(
    await page.evaluate(() => {
      const event = new WheelEvent('wheel', { deltaY: 500, cancelable: true, bubbles: true })
      window.dispatchEvent(event)
      return event.defaultPrevented
    }),
  ).toBe(false)
})

test('combined vite routes support reloads and browser history', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('iframe')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: /know what’s/ })).toBeVisible()
  await page.getByRole('link', { name: 'explore the demo' }).first().click()
  await expect(page).toHaveURL('/app')
  await page.getByRole('navigation').getByRole('button', { name: 'vulnerabilities' }).click()
  await expect(page).toHaveURL('/app/vulnerabilities')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'vulnerabilities', exact: true })).toBeVisible()
  await page.goto('/app/schedules')
  await expect(page.getByRole('heading', { name: 'schedules', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'landing page', exact: true }).first().click()
  await expect(page).toHaveURL('/')
  await page.goBack()
  await expect(page).toHaveURL('/app/schedules')
  await expect(page.getByRole('heading', { name: 'schedules', exact: true })).toBeVisible()
})
