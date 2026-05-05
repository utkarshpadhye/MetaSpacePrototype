import { test, expect } from '@playwright/test'

test('opens docs and crm overlays', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Docs' }).click()
  await expect(page.getByText('Docs Studio')).toBeVisible()

  await page.getByRole('button', { name: 'CRM' }).click()
  await expect(page.getByText('CRM Suite')).toBeVisible()

  await page.getByRole('button', { name: 'Projects' }).click()
  await expect(page.getByText('Projects Room')).toBeVisible()
})
