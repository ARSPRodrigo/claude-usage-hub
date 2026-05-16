import { test, expect } from '@playwright/test';

test.describe('Cost Comparison', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cost-comparison');
    await expect(page).toHaveURL(/cost-comparison/, { timeout: 10_000 });
  });

  test('renders cost comparison page heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /cost comparison/i })).toBeVisible();
  });

  test('shows Opus and Sonnet sections', async ({ page }) => {
    await expect(page.getByText(/Opus/i).first()).toBeVisible();
    await expect(page.getByText(/Sonnet/i).first()).toBeVisible();
  });

  test('time range selector is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: '7D' })).toBeVisible();
    await expect(page.getByRole('button', { name: '30D' })).toBeVisible();
  });

  test('navigates from sidebar', async ({ page }) => {
    await page.goto('/');
    // Click the Cost Comparison nav item in My Usage section
    const navBtn = page.locator('nav ul').first().getByRole('button', { name: /cost comparison/i });
    await navBtn.click();
    await expect(page).toHaveURL(/cost-comparison/);
    await expect(page.getByRole('heading', { name: /cost comparison/i })).toBeVisible();
  });
});
