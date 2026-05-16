import { test, expect } from '@playwright/test';

test.describe('Profile & API Keys', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/profile/, { timeout: 10_000 });
  });

  test('renders profile page heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /profile/i })).toBeVisible();
  });

  test('shows current user email', async ({ page }) => {
    const adminEmail = process.env['E2E_ADMIN_EMAIL'] ?? 'admin@test.local';
    await expect(page.getByText(adminEmail)).toBeVisible();
  });

  test('shows API keys section', async ({ page }) => {
    await expect(page.getByText(/api key/i).first()).toBeVisible();
  });

  test('shows the One per machine section with seeded API key', async ({ page }) => {
    // Profile page groups keys under "One per machine" heading
    await expect(page.getByText(/one per machine/i)).toBeVisible({ timeout: 8_000 });
  });

  test('navigates to profile via user menu', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/', { timeout: 10_000 });
    // Sidebar user widget is the bottom element in the nav
    const userWidget = page.locator('nav > div').last();
    await userWidget.click();
    await page.getByRole('button', { name: /profile/i }).click();
    await expect(page).toHaveURL(/\/profile/, { timeout: 5_000 });
  });
});
