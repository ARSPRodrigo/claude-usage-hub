import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the dashboard to load (not redirect to login)
    await expect(page).toHaveURL('/', { timeout: 10_000 });
  });

  test('renders stat cards', async ({ page }) => {
    // Labels use CSS text-transform: uppercase but DOM text is mixed case
    await expect(page.getByText(/total tokens/i)).toBeVisible();
    await expect(page.getByText(/est\. cost/i)).toBeVisible();
    await expect(page.getByText(/active now/i)).toBeVisible();
    await expect(page.getByText(/sessions/i).first()).toBeVisible();
  });

  test('renders token usage chart', async ({ page }) => {
    await expect(page.getByText(/token usage over time/i)).toBeVisible();
    await expect(page.locator('.recharts-responsive-container').first()).toBeVisible();
  });

  test('renders model mix chart', async ({ page }) => {
    await expect(page.getByText(/model mix/i)).toBeVisible();
  });

  test('time range selector changes the active range', async ({ page }) => {
    // Default is 7D — chart header includes the range
    await expect(page.getByText(/stacked by model.*7D/i)).toBeVisible();

    await page.getByRole('button', { name: '24H' }).click();
    await expect(page.getByText(/stacked by model.*24H/i)).toBeVisible();

    await page.getByRole('button', { name: '30D' }).click();
    await expect(page.getByText(/stacked by model.*30D/i)).toBeVisible();
  });

  test('navigates to dashboard from sidebar', async ({ page }) => {
    await page.getByRole('button', { name: /sessions/i }).click();
    await expect(page).toHaveURL(/\/sessions/);
    await page.getByRole('button', { name: /^dashboard$/i }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByText(/total tokens/i)).toBeVisible();
  });
});
