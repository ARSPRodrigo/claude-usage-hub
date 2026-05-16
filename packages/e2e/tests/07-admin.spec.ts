import { test, expect } from '@playwright/test';

test.describe('Admin — Team Overview', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/org');
    await expect(page).toHaveURL(/\/admin\/org/, { timeout: 10_000 });
  });

  test('renders team overview heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /team overview/i })).toBeVisible();
  });

  test('shows all seeded members in the table', async ({ page }) => {
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(3, { timeout: 8_000 });
  });

  test('shows seeded member names', async ({ page }) => {
    await expect(page.getByText('Alice Chen')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText('Bob Smith')).toBeVisible({ timeout: 8_000 });
  });

  test('shows ranked by consumption header', async ({ page }) => {
    await expect(page.getByText(/ranked by consumption/i)).toBeVisible();
  });

  test('clicking a developer navigates to their detail page', async ({ page }) => {
    await page.locator('tbody tr').first().click();
    await expect(page).toHaveURL(/\/admin\/developer\//, { timeout: 8_000 });
  });

  test('time range selector is functional', async ({ page }) => {
    await page.getByRole('button', { name: '24H' }).first().click();
    await expect(page.getByRole('button', { name: '24H' }).first()).toBeVisible();
    await page.getByRole('button', { name: '7D' }).first().click();
  });
});

test.describe('Admin — Developer Detail', () => {
  test('shows usage charts for the selected developer', async ({ page }) => {
    await page.goto('/admin/org');
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 8_000 });
    await page.locator('tbody tr').first().click();
    await expect(page).toHaveURL(/\/admin\/developer\//, { timeout: 8_000 });
    await expect(page.locator('.recharts-responsive-container').first()).toBeVisible();
  });

  test('back button (Overview) returns to team overview', async ({ page }) => {
    await page.goto('/admin/org');
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 8_000 });
    await page.locator('tbody tr').first().click();
    await expect(page).toHaveURL(/\/admin\/developer\//, { timeout: 8_000 });
    // Back button in the main content area (sidebar also has "Overview" nav item)
    await page.getByRole('main').getByRole('button', { name: /overview/i }).click();
    await expect(page).toHaveURL(/\/admin\/org/, { timeout: 5_000 });
  });
});
