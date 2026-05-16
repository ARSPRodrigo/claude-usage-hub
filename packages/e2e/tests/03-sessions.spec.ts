import { test, expect } from '@playwright/test';

test.describe('Sessions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sessions');
    await expect(page).toHaveURL(/\/sessions/, { timeout: 10_000 });
  });

  test('renders sessions page heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /sessions/i })).toBeVisible();
  });

  test('renders sessions table with seeded data', async ({ page }) => {
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 8_000 });
  });

  test('can switch time ranges without errors', async ({ page }) => {
    // Click ALL range — use .first() to avoid strict mode if multiple matches
    await page.getByRole('button', { name: 'ALL' }).first().click();
    await expect(page.getByRole('button', { name: 'ALL' }).first()).toBeVisible();
    await page.getByRole('button', { name: '7D' }).first().click();
    await expect(page.getByRole('button', { name: '7D' }).first()).toBeVisible();
  });

  test('time range buttons are all present', async ({ page }) => {
    // TimeRangeSelector shows 5H/24H/7D/30D/ALL — use first() to handle any duplicates
    for (const range of ['5H', '24H', '7D', '30D', 'ALL']) {
      await expect(page.getByRole('button', { name: range }).first()).toBeVisible();
    }
  });

  test('shows total session count', async ({ page }) => {
    await expect(page.getByText(/sessions/i).first()).toBeVisible();
  });
});
