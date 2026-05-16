import { test, expect } from '@playwright/test';

// Override with empty storage so these tests start truly unauthenticated
test.use({ storageState: { cookies: [], origins: [] } });

const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:8081';
const ADMIN_EMAIL = process.env['E2E_ADMIN_EMAIL'] ?? 'admin@test.local';
const ADMIN_PASSWORD = process.env['E2E_ADMIN_PASSWORD'] ?? 'test1234';

test.describe('Authentication', () => {
  test('redirects unauthenticated users to /login', async ({ page }) => {
    await page.goto(BASE);
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('shows email/password form when Google OAuth is not configured', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await expect(page.getByTestId('password-form')).toBeVisible();
    await expect(page.getByTestId('email-input')).toBeVisible();
    await expect(page.getByTestId('password-input')).toBeVisible();
    await expect(page.getByTestId('login-submit')).toBeVisible();
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.getByTestId('email-input').fill('wrong@test.local');
    await page.getByTestId('password-input').fill('wrongpassword');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('login-error')).toBeVisible();
  });

  test('logs in with valid credentials and lands on dashboard', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.getByTestId('email-input').fill(ADMIN_EMAIL);
    await page.getByTestId('password-input').fill(ADMIN_PASSWORD);
    await page.getByTestId('login-submit').click();
    await expect(page).toHaveURL(BASE + '/', { timeout: 10_000 });
    await expect(page.getByText(/total tokens/i)).toBeVisible({ timeout: 10_000 });
  });

  test('signs out and returns to login', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.getByTestId('email-input').fill(ADMIN_EMAIL);
    await page.getByTestId('password-input').fill(ADMIN_PASSWORD);
    await page.getByTestId('login-submit').click();
    await expect(page).toHaveURL(BASE + '/', { timeout: 10_000 });

    // Open user menu (bottom of sidebar) and click sign out
    const userMenu = page.locator('nav > div.relative').last();
    await userMenu.click();
    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 5_000 });
  });
});
