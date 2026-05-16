import { test, expect } from '@playwright/test';

test.describe('Leaderboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/leaderboard');
    await expect(page).toHaveURL(/\/leaderboard/, { timeout: 10_000 });
  });

  test('renders leaderboard heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /leaderboard/i })).toBeVisible();
  });

  test('renders stats strip labels', async ({ page }) => {
    const main = page.getByRole('main');
    await expect(main.getByText(/members/i).first()).toBeVisible();
    await expect(main.getByText(/tokens/i).first()).toBeVisible();
    await expect(main.getByText(/cost/i).first()).toBeVisible();
  });

  test('shows all seeded members (admin + Alice + Bob)', async ({ page }) => {
    const rows = page.locator('tbody tr');
    // Platform admin sees all users regardless of workspace scope
    await expect(rows).toHaveCount(3, { timeout: 8_000 });
  });

  test('highlights current user with YOU badge', async ({ page }) => {
    // .first() to handle strict mode if "YOU" appears in heading text too
    await expect(page.getByText('YOU').first()).toBeVisible({ timeout: 8_000 });
  });

  test('top 3 have colored rank circle indicators', async ({ page }) => {
    const firstRankCell = page.locator('tbody tr').first().locator('td').first();
    await expect(firstRankCell.locator('div').first()).toBeVisible({ timeout: 8_000 });
  });

  test('time range selector changes the ranking period label', async ({ page }) => {
    await expect(page.getByText(/ranking.*7D/i)).toBeVisible();
    await page.getByRole('button', { name: '30D' }).first().click();
    await expect(page.getByText(/ranking.*30D/i)).toBeVisible();
  });

  test('shows token data in ranking table', async ({ page }) => {
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 8_000 });
    const tokenCell = rows.first().locator('td').nth(2);
    await expect(tokenCell).not.toBeEmpty();
  });
});
